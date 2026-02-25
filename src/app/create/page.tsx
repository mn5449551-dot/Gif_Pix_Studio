"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ImageUploadZone } from "@/components/image-upload-zone";
import { ACTION_LABELS, CUSTOM_PROMPT_MAX_LENGTH } from "@/lib/constants";
import { usePetEvent } from "@/lib/pet/pet-events";
import { useGenerateTask } from "@/hooks/use-generate-task";
import { useSettings } from "@/hooks/use-settings";
import type { ActionType } from "@/lib/types";

const ACTION_GROUPS: Array<{ title: string; actions: ActionType[] }> = [
  { title: "循环动作", actions: ["walk", "run", "idle"] },
  { title: "瞬时动作", actions: ["jump", "attack", "fall"] },
];

type UploadAudit = {
  fileName: string;
  mime: string;
  sizeBytes: number;
  width: number;
  height: number;
};

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error("图片读取失败"));
    reader.readAsDataURL(file);
  });
}

function getImageDimensions(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error("图片尺寸读取失败"));
    img.src = dataUrl;
  });
}

export default function CreatePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    emitPetEvent,
    updateCreateContext,
    promptCommand,
    consumePromptCommand,
    pendingPromptFill,
    consumePendingPromptFill,
    optimizeDraftPrompt,
  } = usePetEvent();
  const { settings, isClient } = useSettings();

  // Read URL params directly for initial state
  const actionIdParam = searchParams.get("actionId") as ActionType | null;
  const promptParam = searchParams.get("prompt");

  const [actionId, setActionId] = useState<ActionType>(actionIdParam || "walk");
  const [customPrompt, setCustomPrompt] = useState(promptParam ? decodeURIComponent(promptParam) : "");
  const [imageDataUrl, setImageDataUrl] = useState("");
  const [uploadAudit, setUploadAudit] = useState<UploadAudit | null>(null);
  const [showUploadChecklist, setShowUploadChecklist] = useState(false);
  const customPromptRef = useRef<HTMLTextAreaElement>(null);

  // Emit page-entered event once on mount using a stable ref.
  const emitOnMountRef = useRef(emitPetEvent);
  useEffect(() => {
    emitOnMountRef.current("page:create:entered", {
      actionId: "walk",
      actionLabel: ACTION_LABELS["walk"],
      customPrompt: "",
      hasImage: false,
    });
  }, []);

  // Keep pet context in sync.
  useEffect(() => {
    updateCreateContext({
      actionId,
      actionLabel: ACTION_LABELS[actionId],
      customPrompt,
      hasImage: Boolean(imageDataUrl),
    });
  }, [actionId, customPrompt, imageDataUrl, updateCreateContext]);

  const generateTask = useGenerateTask({
    settings,
    actionId,
    customPrompt,
    imageDataUrl,
    onSuccess: (id) => router.push(`/result/${id}`),
  });

  const {
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
    handleGenerate,
  } = generateTask;

  // Track which prompt command has already been applied so we process each one exactly once.
  const [lastAppliedCommandId, setLastAppliedCommandId] = useState<string | null>(null);
  const lastAppliedRef = useRef<string | null>(null);

  const activePromptCommand = useMemo(() => {
    if (pendingPromptFill && promptCommand && pendingPromptFill.id === promptCommand.id) {
      return pendingPromptFill;
    }
    return pendingPromptFill ?? promptCommand;
  }, [pendingPromptFill, promptCommand]);

  // Update the ref when active command changes
  useEffect(() => {
    if (activePromptCommand && activePromptCommand.id !== lastAppliedRef.current) {
      lastAppliedRef.current = activePromptCommand.id;
    }
  }, [activePromptCommand]);

  // Process the prompt command in an effect using the ref value
  useEffect(() => {
    const commandId = lastAppliedRef.current;
    if (!commandId || commandId === lastAppliedCommandId) return;

    // Mark as applied in state
    setLastAppliedCommandId(commandId);

    // Update form state
    setActionId("custom");
    setCustomPrompt((prev) => {
      if (activePromptCommand && activePromptCommand.mode === "append" && prev.trim()) {
        return `${prev.trim()}\n${activePromptCommand.text}`;
      }
      return activePromptCommand?.text ?? "";
    });

    // Consume the command and show feedback
    const shouldConsumePrompt = promptCommand?.id === commandId;
    const shouldConsumePending = pendingPromptFill?.id === commandId;

    if (shouldConsumePrompt) consumePromptCommand(commandId);
    if (shouldConsumePending) consumePendingPromptFill(commandId);
    setStatus("桌宠已填充提示词（已切换自定义）");
  }, [
    activePromptCommand,
    consumePendingPromptFill,
    consumePromptCommand,
    lastAppliedCommandId,
    pendingPromptFill,
    promptCommand,
    setStatus,
  ]);

  const hasApiKey = useMemo(() => settings.apiKey.trim().length > 0, [settings.apiKey]);
  const canGenerate = useMemo(
    () => isClient && hasApiKey && Boolean(imageDataUrl) && !generating,
    [isClient, hasApiKey, imageDataUrl, generating],
  );
  const canRetry = useMemo(
    () => phase === "failed" && isClient && hasApiKey && Boolean(imageDataUrl) && !generating,
    [phase, isClient, hasApiKey, imageDataUrl, generating],
  );
  const generateDisabledReason = useMemo(() => {
    if (generating && !hasActiveRun) return "检测到残留状态，自动恢复中...";
    if (generating) return "生成进行中，请稍候";
    if (!isClient) return "页面初始化中...";
    if (!hasApiKey) return "请先到设置页填写 API Key";
    if (!imageDataUrl) return "请先上传参考图";
    return "";
  }, [generating, hasActiveRun, hasApiKey, imageDataUrl, isClient]);
  const phaseDisplay = useMemo(() => {
    if (!lastRunId) return "等待点击生成";
    return `第 ${lastRunId} 次尝试 · ${phaseMessage}`;
  }, [lastRunId, phaseMessage]);
  const clickTimeDisplay = useMemo(() => {
    if (!lastClickAt) return "";
    return new Date(lastClickAt).toLocaleTimeString();
  }, [lastClickAt]);
  const diagnosticClass = useMemo(() => {
    if (phase === "failed") return "task-diagnostic is-failed";
    if (phase === "success") return "task-diagnostic is-success";
    if (generating) return "task-diagnostic is-running";
    return "task-diagnostic is-idle";
  }, [generating, phase]);
  const shouldSuggestSettings = useMemo(
    () =>
      phase === "failed" &&
      (lastErrorSource === "validation" ||
        lastErrorSource === "api_submit" ||
        lastErrorSource === "api_poll"),
    [phase, lastErrorSource],
  );
  const recoveryHint = useMemo(() => {
    if (phase !== "failed") return "";
    if (lastErrorSource === "validation") return "先补齐 API Key 或上传参考图，再重试。";
    if (lastErrorSource === "api_submit" || lastErrorSource === "api_poll") {
      return "请检查 API 接口地址、API Key 与网络连通性，确认后再重试。";
    }
    return "可直接点击重试；若重复失败，建议切换动作或更换参考图。";
  }, [phase, lastErrorSource]);
  const isCustomAction = actionId === "custom";
  const primaryStatusText = useMemo(() => {
    if (!isClient) return "页面初始化中...";
    if (!hasApiKey) return "请先到设置页填写 API Key。";
    if (!imageDataUrl) return "请先上传参考图，再开始生成。";
    if (generating) return "任务进行中，主进度请查看左侧上传区。";
    return `准备就绪：动作 ${ACTION_LABELS[actionId]}，可点击生成。`;
  }, [isClient, hasApiKey, imageDataUrl, generating, actionId]);
  const primaryStatusClass = useMemo(() => {
    if (!isClient || generating) return "status-line muted";
    if (!hasApiKey || !imageDataUrl) return "status-line warn";
    return "status-line ok";
  }, [isClient, generating, hasApiKey, imageDataUrl]);
  const auditItems = useMemo(() => {
    if (!uploadAudit) {
      return [
        { key: "resolution", label: "分辨率", level: "info" as const, text: "建议 ≥ 512 x 512" },
        { key: "ratio", label: "画面比例", level: "info" as const, text: "建议接近 1:1，便于动作稳定" },
        { key: "size", label: "文件大小", level: "info" as const, text: "建议小于 5MB" },
        { key: "format", label: "图片格式", level: "info" as const, text: "支持 png / jpg / webp" },
      ];
    }

    const minSide = Math.min(uploadAudit.width, uploadAudit.height);
    const ratio = uploadAudit.width / uploadAudit.height;
    const sizeMb = uploadAudit.sizeBytes / (1024 * 1024);
    const ratioOffset = Math.abs(ratio - 1);

    const resolutionItem =
      minSide >= 512
        ? { key: "resolution", label: "分辨率", level: "ok" as const, text: `${uploadAudit.width} x ${uploadAudit.height}` }
        : minSide >= 320
          ? { key: "resolution", label: "分辨率", level: "warn" as const, text: `${uploadAudit.width} x ${uploadAudit.height}，建议更高` }
          : { key: "resolution", label: "分辨率", level: "warn" as const, text: `${uploadAudit.width} x ${uploadAudit.height}，可能影响细节` };

    const ratioItem =
      ratioOffset <= 0.2
        ? { key: "ratio", label: "画面比例", level: "ok" as const, text: `${ratio.toFixed(2)}，适合动作稳定` }
        : { key: "ratio", label: "画面比例", level: "warn" as const, text: `${ratio.toFixed(2)}，建议更接近 1:1` };

    const sizeItem =
      sizeMb <= 5
        ? { key: "size", label: "文件大小", level: "ok" as const, text: `${sizeMb.toFixed(2)} MB` }
        : sizeMb <= 10
          ? { key: "size", label: "文件大小", level: "warn" as const, text: `${sizeMb.toFixed(2)} MB，建议压缩` }
          : { key: "size", label: "文件大小", level: "warn" as const, text: `${sizeMb.toFixed(2)} MB，可能上传不稳定` };

    const formatItem = {
      key: "format",
      label: "图片格式",
      level: "ok" as const,
      text: uploadAudit.mime.replace("image/", "").toUpperCase(),
    };

    return [resolutionItem, ratioItem, sizeItem, formatItem];
  }, [uploadAudit]);

  async function onPickFile(file: File | null) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      return;
    }
    const dataUrl = await fileToDataUrl(file);
    const dimensions = await getImageDimensions(dataUrl);
    setImageDataUrl(dataUrl);
    setShowUploadChecklist(true);
    setUploadAudit({
      fileName: file.name,
      mime: file.type,
      sizeBytes: file.size,
      width: dimensions.width,
      height: dimensions.height,
    });

    const minSide = Math.min(dimensions.width, dimensions.height);
    const ratio = dimensions.width / dimensions.height;
    const ratioOffset = Math.abs(ratio - 1);
    const sizeMb = file.size / (1024 * 1024);
    const warningCount =
      (minSide < 512 ? 1 : 0) +
      (ratioOffset > 0.2 ? 1 : 0) +
      (sizeMb > 5 ? 1 : 0);
    const grade = warningCount === 0 ? "good" : warningCount === 1 ? "ok" : "warn";
    const summary =
      warningCount === 0
        ? "分辨率、比例和大小都比较理想。"
        : warningCount === 1
          ? "整体可用，建议小幅优化后再生成。"
          : "建议先优化分辨率/比例/大小，再生成会更稳定。";

    emitPetEvent("image:uploaded", {
      actionId,
      actionLabel: ACTION_LABELS[actionId],
      customPrompt,
      hasImage: true,
    });
    emitPetEvent("image:audit", { grade, summary });
  }

  function handleClearImage() {
    setImageDataUrl("");
    setUploadAudit(null);
    setShowUploadChecklist(false);
    emitPetEvent("image:cleared", {
      actionId,
      actionLabel: ACTION_LABELS[actionId],
      customPrompt,
      hasImage: false,
    });
  }

  return (
    <section className="grid grid-cols-1 gap-8 md:grid-cols-[1.1fr_1fr] fade-in-up">
      <div className="cute-panel space-y-4">
        <div className="flex items-center justify-between gap-3">
          <p className="pixel-title text-xs">参考图上传</p>
          <Link className="arcade-button secondary text-[10px]" href="/settings">
            API 设置
          </Link>
        </div>

        <ImageUploadZone
          imageDataUrl={imageDataUrl}
          generating={generating}
          status={status}
          progress={progress}
          onPickFile={(file) => void onPickFile(file)}
          onClearImage={handleClearImage}
        />

        <div className={primaryStatusClass}>{primaryStatusText}</div>

        {error && <p className="status-line warn animate-pulse">{error}</p>}
        {warning && <p className="status-line muted">{warning}</p>}

        <div className="rounded-md border-2 border-border-dim bg-[#fffdf8] p-3">
          <button
            type="button"
            className="flex w-full items-center justify-between gap-2 text-left"
            onClick={() => setShowUploadChecklist((prev) => !prev)}
          >
            <p className="pixel-title text-xs">素材体检</p>
            <span className="cyber-chip muted text-[10px]">
              {showUploadChecklist ? "收起" : uploadAudit ? "展开（已检测）" : "展开"}
            </span>
          </button>

          {showUploadChecklist && (
            <>
              {uploadAudit && (
                <p className="mt-2 text-sm text-text-muted truncate" title={uploadAudit.fileName}>
                  文件: {uploadAudit.fileName}
                </p>
              )}

              <div className="mt-3 grid grid-cols-1 gap-2">
                {auditItems.map((item) => (
                  <div key={item.key} className="flex items-center justify-between gap-2 rounded border border-border-dim/20 bg-white px-2 py-1.5">
                    <span className="text-sm text-text-primary">{item.label}</span>
                    <span
                      className={`cyber-chip text-[10px] ${
                        item.level === "ok" ? "ok" : item.level === "warn" ? "fail" : "muted"
                      }`}
                    >
                      {item.text}
                    </span>
                  </div>
                ))}
              </div>

              <div className="mt-3 rounded border border-dashed border-border-dim/30 bg-[#fff8fb] px-2 py-1.5 text-sm text-text-muted">
                生成前手动确认：主体尽量居中、背景尽量干净，可明显提升动作连贯性。
              </div>
            </>
          )}
        </div>

        {!showUploadChecklist && (
          <div className="text-sm text-text-muted">
            素材体检已折叠，建议上传后展开检查一次。
          </div>
        )}
      </div>

      <div className={`space-y-6 transition-opacity ${generating ? "pointer-events-none opacity-70" : ""}`}>
        <div className="cute-panel space-y-5">
          <p className="pixel-title text-xs">动作与描述</p>
          {ACTION_GROUPS.map((group) => (
            <div key={group.title}>
              <p className="pixel-label mb-2">{group.title}</p>
              <div className="grid grid-cols-3 gap-2">
                {group.actions.map((action) => {
                  const selected = actionId === action;
                  return (
                    <button
                      key={action}
                      className={`arcade-button py-3 text-center text-xs w-full transition ${
                        selected ? "-translate-y-0.5" : "secondary"
                      }`}
                      onClick={() => {
                        setActionId(action);
                        emitPetEvent("action:preview", { actionId: action });
                      }}
                    >
                      {ACTION_LABELS[action]}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}

          <div>
            <p className="pixel-label mb-2">自定义动作</p>
            <button
              className={`arcade-button py-3 text-center text-xs w-full transition ${
                actionId === "custom" ? "-translate-y-0.5" : "secondary"
              }`}
              onClick={() => {
                setActionId("custom");
                // 移动端展开后跳转到输入框
                if (window.innerWidth < 1024 && customPromptRef.current) {
                  setTimeout(() => {
                    customPromptRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                  }, 100);
                }
              }}
            >
              {ACTION_LABELS.custom}
            </button>
          </div>

          <label className="block" id="custom-prompt-area">
            <p className="pixel-label mb-2">自定义描述</p>
            <textarea
              ref={customPromptRef}
              className="terminal-input min-h-[120px] text-lg disabled:cursor-not-allowed disabled:opacity-60"
              maxLength={CUSTOM_PROMPT_MAX_LENGTH}
              value={customPrompt}
              onChange={(event) => setCustomPrompt(event.target.value)}
              suppressHydrationWarning
              onBlur={() => {
                if (isCustomAction) {
                  emitPetEvent("prompt:input:blur", { hasContent: customPrompt.trim().length > 0 });
                }
              }}
              placeholder={
                isCustomAction
                  ? "描述动作细节、道具、镜头节奏等..."
                  : "仅在选择「自定义」动作后可输入描述"
              }
              disabled={!isCustomAction}
            />
            {isCustomAction ? (
              <button
                type="button"
                className="arcade-button secondary mt-2 w-full py-2 text-xs"
                onClick={() => {
                  emitPetEvent("prompt:input:blur", { hasContent: customPrompt.trim().length > 0 });
                  void optimizeDraftPrompt(customPrompt);
                }}
              >
                让桌宠帮我优化描述
              </button>
            ) : (
              <p className="mt-2 text-base text-text-muted">当前为模板动作，可直接生成；描述输入已锁定。</p>
            )}
          </label>
        </div>

        <div className="cute-panel space-y-4">
          <button
            className="arcade-button lime w-full py-4 text-base"
            disabled={!canGenerate}
            title={generateDisabledReason || "开始生成"}
            onClick={() => void handleGenerate()}
          >
            {generating ? "生成中..." : "生成GIF图"}
          </button>

          <div className={diagnosticClass}>
            <div className="task-diagnostic-summary">
              <p className="text-text-primary">{phaseDisplay}</p>
              {clickTimeDisplay && <p>最近点击: {clickTimeDisplay}</p>}
            </div>
            <details className="task-diagnostic-details" open={phase === "failed"}>
              <summary className="cursor-pointer select-none text-sm text-text-muted">运行详情</summary>
              <div className="mt-2 space-y-2">
                {!canGenerate && <p>{generateDisabledReason}</p>}
                {generating && (
                  <p>生成进行中，详细进度请查看左侧上传区。</p>
                )}
                {phase === "failed" && lastErrorMessage && (
                  <p className="text-danger">
                    失败来源: {lastErrorSource} · {lastErrorMessage}
                  </p>
                )}
                {recoveryHint && <p>{recoveryHint}</p>}
              </div>
            </details>
          </div>

          {canRetry && shouldSuggestSettings ? (
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              <button
                className="arcade-button secondary w-full py-3 text-xs"
                onClick={() => void handleGenerate()}
              >
                立即重试
              </button>
              <Link className="arcade-button warm w-full py-3 text-center text-xs" href="/settings">
                去设置检查 Key
              </Link>
            </div>
          ) : canRetry ? (
            <button
              className="arcade-button secondary w-full py-3 text-xs"
              onClick={() => void handleGenerate()}
            >
              立即重试
            </button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
