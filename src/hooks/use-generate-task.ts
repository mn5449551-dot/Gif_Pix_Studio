"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ACTION_LABELS, BG_REMOVAL_TOLERANCE, DEFAULT_FPS } from "@/lib/constants";
import { putGifBlob, putSourceBlob, putSpriteBlob } from "@/lib/gif-cache";
import { createNanoTask, waitForNanoResult } from "@/lib/grsai";
import {
  buildTransparentGifFromSpriteSource,
  dataUrlToBlob,
  isAbortError,
  removeBackgroundColorKey,
} from "@/lib/image-processing";
import { usePetEvent } from "@/lib/pet/pet-events";
import { composePrompt } from "@/lib/prompt";
import { removeHistoryItem, StorageQuotaError, upsertHistoryItem } from "@/lib/storage";
import { computeExpiresAt, nowIso } from "@/lib/time";
import type { ActionType, LocalHistoryItem, LocalSettings } from "@/lib/types";

export interface UseGenerateTaskParams {
  settings: LocalSettings;
  actionId: ActionType;
  customPrompt: string;
  fps?: number;
  imageDataUrl: string;
  onSuccess: (id: string) => void;
}

export type GeneratePhase =
  | "idle"
  | "clicked"
  | "blocked"
  | "validating"
  | "persisting_local"
  | "submitting_task"
  | "polling"
  | "post_processing_sprite"
  | "post_processing_gif"
  | "success"
  | "failed";

export type GenerateErrorSource =
  | "none"
  | "validation"
  | "storage"
  | "api_submit"
  | "api_poll"
  | "postprocess"
  | "unknown";

export type GenerateStatus =
  | "等待生成"
  | "正在呼叫像素小精灵..."
  | "正在校验 API Key 与上传图片..."
  | "正在保存本地任务数据..."
  | "正在请求第三方创建任务..."
  | "正在轮询生成进度..."
  | "拼装动画碎片中..."
  | "封装透明 GIF 中..."
  | "生成成功"
  | "生成失败"
  | "生成已取消"
  | "生成完成（GIF 后处理失败）"
  | "桌宠已填充提示词（已切换自定义）"
  | "施展变身魔法中..."
  | "封装透明 GIF 中...";

export interface UseGenerateTaskResult {
  generating: boolean;
  hasActiveRun: boolean;
  status: GenerateStatus;
  progress: number;
  error: string;
  warning: string;
  phase: GeneratePhase;
  phaseMessage: string;
  lastErrorSource: GenerateErrorSource;
  lastErrorMessage: string;
  lastRunId: number;
  lastClickAt: number | null;
  setStatus: (s: GenerateStatus) => void;
  resetGenerateState: () => void;
  handleGenerate: () => Promise<void>;
}

class PostProcessError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PostProcessError";
  }
}

const MAX_PERSIST_RETRIES = 3;
const PERSIST_RETRY_DELAY_MS = 50;
const VISUAL_PROGRESS_TICK_MS = 120;

function clampProgress(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function getVisualProgressTarget(
  phase: GeneratePhase,
  rawProgress: number,
  pollingStartedAt: number | null,
): number {
  const clampedRaw = clampProgress(rawProgress);
  switch (phase) {
    case "persisting_local":
      return Math.max(clampedRaw, 8);
    case "submitting_task":
      return Math.max(clampedRaw, 14);
    case "polling": {
      // Provider progress often stalls at low values; map and gently crawl to keep feedback flowing.
      const mappedRaw = 18 + clampedRaw * 0.62;
      const elapsedMs = pollingStartedAt ? Date.now() - pollingStartedAt : 0;
      const crawl = Math.min(16, Math.floor(elapsedMs / 2500));
      return Math.min(88, Math.max(mappedRaw, 22 + crawl));
    }
    case "post_processing_sprite":
      return Math.max(clampedRaw, 90);
    case "post_processing_gif":
      return Math.max(clampedRaw, 96);
    case "success":
      return 100;
    default:
      return clampedRaw;
  }
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function persistTaskWithRetry(
  taskItem: LocalHistoryItem,
  sourceBlob: Blob,
): Promise<void> {
  for (let attempt = 1; attempt <= MAX_PERSIST_RETRIES; attempt += 1) {
    try {
      // Write to IndexedDB first (more likely to fail due to quota)
      await putSourceBlob(taskItem.id, sourceBlob);
      // Then write to localStorage
      upsertHistoryItem(taskItem);
      return;
    } catch (error) {
      const isRetryable =
        error instanceof StorageQuotaError ||
        (error instanceof Error && error.message.includes("busy"));
      const isLastAttempt = attempt === MAX_PERSIST_RETRIES;
      if (!isRetryable || isLastAttempt) {
        throw error;
      }
      if (process.env.NODE_ENV !== "production") {
        console.warn(
          `[use-generate-task] Persist failed (attempt ${attempt}/${MAX_PERSIST_RETRIES}), retrying...`,
          error,
        );
      }
      await delay(PERSIST_RETRY_DELAY_MS * attempt);
    }
  }
}

export function useGenerateTask(params: UseGenerateTaskParams): UseGenerateTaskResult {
  const { emitPetEvent } = usePetEvent();
  const paramsRef = useRef(params);
  paramsRef.current = params;

  const [generating, setGenerating] = useState(false);
  const [hasActiveRun, setHasActiveRun] = useState(false);
  const [status, setStatus] = useState<GenerateStatus>("等待生成");
  const [progress, setProgress] = useState(0);
  const [rawProgress, setRawProgress] = useState(0);
  const [error, setError] = useState("");
  const [warning, setWarning] = useState("");
  const [phase, setPhase] = useState<GeneratePhase>("idle");
  const [phaseMessage, setPhaseMessage] = useState("等待点击生成");
  const [lastErrorSource, setLastErrorSource] = useState<GenerateErrorSource>("none");
  const [lastErrorMessage, setLastErrorMessage] = useState("");
  const [lastRunId, setLastRunId] = useState(0);
  const [lastClickAt, setLastClickAt] = useState<number | null>(null);

  const emitRef = useRef(emitPetEvent);
  emitRef.current = emitPetEvent;

  const mountedRef = useRef(true);
  const runSeqRef = useRef(0);
  const activeAbortRef = useRef<AbortController | null>(null);
  const pollingStartedAtRef = useRef<number | null>(null);
  const lastPetProgressRef = useRef(-1);

  function setPhaseState(nextPhase: GeneratePhase, message: string) {
    if (nextPhase === "polling" && pollingStartedAtRef.current === null) {
      pollingStartedAtRef.current = Date.now();
    }
    if (nextPhase !== "polling") {
      pollingStartedAtRef.current = null;
    }
    setPhase(nextPhase);
    setPhaseMessage(message);
  }

  function debugLog(
    runId: number,
    nextPhase: GeneratePhase,
    message: string,
    extra?: Record<string, unknown>,
  ) {
    if (process.env.NODE_ENV === "production") return;
    console.info(`[generate][runId=${runId}][phase=${nextPhase}] ${message}`, extra ?? {});
  }

  const resetGenerateState = useCallback(() => {
    activeAbortRef.current?.abort();
    activeAbortRef.current = null;
    setGenerating(false);
    setHasActiveRun(false);
    setStatus("等待生成");
    setRawProgress(0);
    setProgress(0);
    setError("");
    setWarning("");
    setPhase("idle");
    setPhaseMessage("等待点击生成");
    setLastErrorSource("none");
    setLastErrorMessage("");
    setLastRunId(0);
    setLastClickAt(null);
  }, []);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      activeAbortRef.current?.abort();
      activeAbortRef.current = null;
      pollingStartedAtRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!generating) {
      setProgress(clampProgress(rawProgress));
      return;
    }

    const timer = window.setInterval(() => {
      setProgress((previous) => {
        const target = getVisualProgressTarget(
          phase,
          rawProgress,
          pollingStartedAtRef.current,
        );
        if (target <= previous) return previous;

        const gap = target - previous;
        const step = gap >= 30 ? 4 : gap >= 18 ? 3 : gap >= 8 ? 2 : 1;
        return Math.min(target, previous + step);
      });
    }, VISUAL_PROGRESS_TICK_MS);

    return () => {
      window.clearInterval(timer);
    };
  }, [generating, phase, rawProgress]);

  useEffect(() => {
    if (!generating) {
      lastPetProgressRef.current = -1;
      return;
    }

    if (
      phase !== "persisting_local" &&
      phase !== "submitting_task" &&
      phase !== "polling" &&
      phase !== "post_processing_sprite" &&
      phase !== "post_processing_gif"
    ) {
      return;
    }

    const visualValue = clampProgress(progress);
    if (visualValue === lastPetProgressRef.current) return;
    lastPetProgressRef.current = visualValue;
    emitRef.current("task:generate:progress", { progress: visualValue });
  }, [generating, phase, progress]);

  async function handleGenerate() {
    const { settings, actionId, customPrompt, fps = DEFAULT_FPS, imageDataUrl, onSuccess } = paramsRef.current;
    let errorSource: GenerateErrorSource = "unknown";

    const runId = runSeqRef.current + 1;
    runSeqRef.current = runId;
    setLastRunId(runId);
    setLastClickAt(Date.now());
    setLastErrorSource("none");
    setLastErrorMessage("");
    setPhaseState("clicked", "已触发生成，正在检查条件...");
    debugLog(runId, "clicked", "generate button clicked");
    const isCurrentRun = () => runSeqRef.current === runId;
    const canUpdateCurrentRunUi = () => mountedRef.current && isCurrentRun();

    function setValidationFailure(
      uiMessage: string,
      logMessage: string,
      errorMessage: string,
    ): void {
      setError(uiMessage);
      setLastErrorSource("validation");
      setLastErrorMessage(errorMessage);
      setPhaseState("failed", `校验失败：${errorMessage}`);
      debugLog(runId, "failed", logMessage);
    }

    if (generating) {
      if (!activeAbortRef.current || !hasActiveRun) {
        setLastErrorSource("unknown");
        setLastErrorMessage("检测到残留任务状态，已自动恢复并继续本次生成");
        setPhaseState("validating", "检测到残留状态，已自动恢复并继续...");
        debugLog(runId, "blocked", "stale generating state detected, auto-recover and continue");
        activeAbortRef.current?.abort();
        activeAbortRef.current = null;
        setGenerating(false);
        setHasActiveRun(false);
        setStatus("等待生成");
        setRawProgress(0);
        setProgress(0);
        setError("");
        setWarning("");
      } else {
        setLastErrorSource("unknown");
        setLastErrorMessage("当前已有任务进行中");
        setPhaseState("blocked", "当前已有任务在进行中，请稍候");
        debugLog(runId, "blocked", "ignored because another run is in progress");
        return;
      }
    }

    errorSource = "validation";
    setPhaseState("validating", "正在校验 API Key 与上传图片...");
    debugLog(runId, "validating", "validating inputs");
    if (!settings.apiKey.trim()) {
      setValidationFailure("请先在设置页填写 API Key", "validation failed: missing api key", "缺少 API Key");
      return;
    }
    if (!imageDataUrl) {
      setValidationFailure("请先上传图片", "validation failed: missing image", "缺少参考图");
      return;
    }

    activeAbortRef.current?.abort();
    const controller = new AbortController();
    activeAbortRef.current = controller;
    setHasActiveRun(true);
    const isRunActive = () => isCurrentRun() && !controller.signal.aborted;

    const createdAt = nowIso();
    const localId = globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`;
    const composed = composePrompt({ actionType: actionId, userCustomPrompt: customPrompt });
    const taskModel = settings.defaultModel.trim() || "nano-banana-pro";

    let latestProgress = 0;
    let taskItem: LocalHistoryItem = {
      id: localId,
      actionId,
      prompt: customPrompt,
      fps,
      finalPrompt: composed.finalPrompt,
      model: taskModel,
      createdAt,
      updatedAt: createdAt,
      status: "queued",
      progress: 0,
    };

    try {
      if (!isRunActive()) return;

      setGenerating(true);
      setError("");
      setWarning("");
      setRawProgress(0);
      setProgress(0);
      setStatus("正在呼叫像素小精灵...");
      setPhaseState("persisting_local", "前置校验通过，正在保存本地任务数据...");
      debugLog(runId, "persisting_local", "persisting local history and source blob");
      emitRef.current("task:generate:start", {
        actionId,
        actionLabel: ACTION_LABELS[actionId],
        customPrompt,
        hasImage: true,
      });

      errorSource = "storage";
      // Persist both IndexedDB and localStorage atomically with retry
      await persistTaskWithRetry(taskItem, dataUrlToBlob(imageDataUrl));
      if (!isRunActive()) return;

      errorSource = "api_submit";
      setPhaseState("submitting_task", "已提交本地数据，正在请求第三方创建任务...");
      debugLog(runId, "submitting_task", "creating provider task");
      const providerTaskId = await createNanoTask({
        settings,
        prompt: composed.finalPrompt,
        urls: [imageDataUrl],
        signal: controller.signal,
      });
      if (!isRunActive()) return;

      taskItem = { ...taskItem, providerTaskId, status: "running", updatedAt: nowIso() };
      upsertHistoryItem(taskItem);

      errorSource = "api_poll";
      setPhaseState("polling", "任务已创建，正在轮询生成进度...");
      debugLog(runId, "polling", "polling provider task status", { providerTaskId });
      const final = await waitForNanoResult({
        settings,
        id: providerTaskId,
        signal: controller.signal,
        onTick: (tick) => {
          if (!isRunActive()) return;
          const value = Math.max(0, Math.min(100, Number(tick.progress ?? 0)));
          latestProgress = value;
          setRawProgress(value);
          setStatus("施展变身魔法中...");
          setPhaseState("polling", "正在生成中...");
          taskItem = {
            ...taskItem,
            status: tick.status === "failed" ? "failed" : "running",
            progress: value,
            updatedAt: nowIso(),
            error: tick.error,
            failureReason: tick.failure_reason,
          };
          upsertHistoryItem(taskItem);
        },
      });
      if (!isRunActive()) return;

      if (final.status === "failed") {
        taskItem = {
          ...taskItem,
          status: "failed",
          progress: Number(final.progress ?? latestProgress),
          failureReason: final.failure_reason,
          error: final.error || "生成失败",
          updatedAt: nowIso(),
        };
        upsertHistoryItem(taskItem);
        setStatus("生成失败");
        const failedMessage = final.error || final.failure_reason || "第三方返回失败";
        setError(failedMessage);
        setLastErrorSource("api_poll");
        setLastErrorMessage(failedMessage);
        setPhaseState("failed", `生成失败：${failedMessage}`);
        debugLog(runId, "failed", "provider returned failed status", { failedMessage });
        emitRef.current("task:generate:failed", {
          reason: final.error || final.failure_reason || "第三方返回失败",
        });
        return;
      }

      const resultUrl = final.results?.[0]?.url;
      if (!resultUrl) {
        throw new Error("第三方未返回结果 URL");
      }
      taskItem = {
        ...taskItem,
        resultUrl,
        updatedAt: nowIso(),
        urlExpiresAt: computeExpiresAt(createdAt),
      };
      upsertHistoryItem(taskItem);

      try {
        errorSource = "postprocess";
        setPhaseState("post_processing_sprite", "生成完成，正在处理透明精灵图...");
        debugLog(runId, "post_processing_sprite", "removing background from sprite");
        setStatus("拼装动画碎片中...");
        const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(resultUrl)}`;
        const transparentSprite = await removeBackgroundColorKey(
          proxiedUrl,
          BG_REMOVAL_TOLERANCE,
          controller.signal,
        );
        if (!isRunActive()) return;

        const spriteBlob = dataUrlToBlob(transparentSprite);
        await putSpriteBlob(localId, spriteBlob);
        if (!isRunActive()) return;

        taskItem = { ...taskItem, localSpriteReady: true, updatedAt: nowIso() };
        upsertHistoryItem(taskItem);

        setPhaseState("post_processing_gif", "正在封装透明 GIF...");
        debugLog(runId, "post_processing_gif", "encoding transparent gif");
        setStatus("封装透明 GIF 中...");
        const gifBlob = await buildTransparentGifFromSpriteSource({
          spriteSource: transparentSprite,
          fps,
          signal: controller.signal,
          onProgress: () => {
            if (!isRunActive()) return;
            setStatus("封装透明 GIF 中...");
            setPhaseState("post_processing_gif", "正在封装透明 GIF...");
          },
        });
        if (!isRunActive()) return;

        await putGifBlob(localId, gifBlob);
      } catch (postError) {
        if (isAbortError(postError)) throw postError;
        const message = postError instanceof Error ? postError.message : "后处理失败";
        throw new PostProcessError(message);
      }

      if (!isRunActive()) return;

      taskItem = {
        ...taskItem,
        status: "succeeded",
        progress: 100,
        resultUrl,
        localSpriteReady: true,
        localGifReady: true,
        updatedAt: nowIso(),
        urlExpiresAt: computeExpiresAt(createdAt),
      };
      upsertHistoryItem(taskItem);
      setRawProgress(100);
      setProgress(100);
      setStatus("生成成功");
      setPhaseState("success", "生成成功，正在跳转结果页...");
      debugLog(runId, "success", "generation succeeded", { localId });
      emitRef.current("task:generate:success", { milestone: false });
      setGenerating(false);
      onSuccess(localId);
    } catch (err) {
      if (isAbortError(err)) {
        // Do not leave pending placeholders forever after cancel/restart/navigation.
        // If provider task has not been created yet, remove the local queued record.
        if (taskItem.status === "queued" && !taskItem.providerTaskId) {
          removeHistoryItem(localId);
        } else {
          taskItem = {
            ...taskItem,
            status: "failed",
            updatedAt: nowIso(),
            error: taskItem.error || "任务已取消",
            failureReason: taskItem.failureReason || "cancelled",
          };
          upsertHistoryItem(taskItem);
        }
        if (canUpdateCurrentRunUi()) {
          setStatus("生成已取消");
          setPhaseState("failed", "生成已取消");
          setLastErrorSource("unknown");
          setLastErrorMessage("任务已取消");
          debugLog(runId, "failed", "generation cancelled");
          emitRef.current("task:generate:cancelled", {});
        }
        return;
      }

      const message = err instanceof Error ? err.message : "生成失败";
      const isPostProcessError = err instanceof PostProcessError;
      const normalizedErrorSource: GenerateErrorSource =
        isPostProcessError ? "postprocess" : errorSource;
      setLastErrorSource(normalizedErrorSource);
      setLastErrorMessage(message);
      setPhaseState("failed", `失败(${normalizedErrorSource})：${message}`);
      debugLog(runId, "failed", "generation failed", {
        source: normalizedErrorSource,
        message,
      });

      if (isPostProcessError && taskItem.resultUrl) {
        taskItem = {
          ...taskItem,
          status: "succeeded",
          progress: 100,
          localSpriteReady: taskItem.localSpriteReady ?? false,
          localGifReady: false,
          updatedAt: nowIso(),
          urlExpiresAt: taskItem.urlExpiresAt ?? computeExpiresAt(createdAt),
          error: message,
        };
        upsertHistoryItem(taskItem);
        if (isRunActive()) {
          setWarning("精灵图转 GIF 失败，已保留原结果 URL，可重试。");
          setStatus("生成完成（GIF 后处理失败）");
          emitRef.current("task:generate:success", { milestone: false });
          onSuccess(localId);
        }
      } else {
        taskItem = { ...taskItem, status: "failed", updatedAt: nowIso(), error: message };
        upsertHistoryItem(taskItem);
        if (isRunActive()) {
          setError(message);
          setStatus("生成失败");
          emitRef.current("task:generate:failed", { reason: message });
        }
      }
    } finally {
      if (activeAbortRef.current === controller) {
        activeAbortRef.current = null;
      }
      if (canUpdateCurrentRunUi()) {
        setGenerating(false);
        setHasActiveRun(false);
      }
    }
  }

  return {
    generating,
    hasActiveRun,
    status,
    progress,
    error,
    warning,
    phase,
    phaseMessage,
    lastErrorSource,
    lastErrorMessage,
    lastRunId,
    lastClickAt,
    setStatus,
    resetGenerateState,
    handleGenerate,
  };
}
