"use client";

import { zipSync } from "fflate";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ACTION_LABELS,
  BG_REMOVAL_TOLERANCE,
  DEFAULT_FPS,
  MAX_REMOVED_FRAMES,
  SPRITE_COLS,
  SPRITE_FRAME_COUNT,
  SPRITE_ROWS,
} from "@/lib/constants";
import {
  getSourceBlob,
  getEditedGifBlob,
  getExportedGifBlob,
  getGifBlob,
  getSpriteBlob,
  putSourceBlob,
  putEditedGifBlob,
  putExportedGifBlob,
  putGifBlob,
  putSpriteBlob,
} from "@/lib/gif-cache";
import { createNanoTask, waitForNanoResult } from "@/lib/grsai";
import {
  buildTransparentGifFromSpriteSource,
  buildTransparentGifFromFrames,
  buildTransparentGifFromFramesWithSize,
  canvasToBlob,
  clampFps,
  dataUrlToBlob,
  downloadBlob,
  extractFramesFromSpriteSource,
  filterFramesByRemovedIndexes,
  normalizeFrameIndexes,
  removeBackgroundColorKey,
} from "@/lib/image-processing";
import { usePetEvent } from "@/lib/pet/pet-events";
import { composePrompt } from "@/lib/prompt";
import { getHistoryItem, removeHistoryItem, upsertHistoryItem } from "@/lib/storage";
import { computeExpiresAt, formatCountdown, isExpired, msLeft, nowIso } from "@/lib/time";
import type { GifExportSize, LocalHistoryItem, LocalSettings } from "@/lib/types";
import { useObjectUrl } from "./use-object-url";

export interface UseFrameEditorResult {
  item: LocalHistoryItem | undefined;
  effectiveFps: number;
  fpsOverride: number | undefined;
  setFpsOverride: (fps: number) => void;
  localGifUrl: string;
  loadingLocalGif: boolean;
  localSpriteUrl: string;
  loadingLocalSprite: boolean;
  spriteFrames: HTMLCanvasElement[];
  removedFrameIndexes: number[];
  selectedFrameIndex: number;
  setSelectedFrameIndex: (index: number) => void;
  framesLoading: boolean;
  frameError: string;
  reencoding: boolean;
  reencodeProgress: number;
  reencodeError: string;
  regenerating: boolean;
  regenerateStatus: string;
  regenerateProgress: number;
  regenerateError: string;
  exportingZip: "all" | "kept" | null;
  exportGifSize: GifExportSize;
  setExportGifSize: (size: GifExportSize) => void;
  exportingGif: boolean;
  expired: boolean;
  left: string;
  gifDisplayUrl: string;
  spriteDisplayUrl: string;
  applyGifSettings: (indexes: number[], options?: { forceGenerate?: boolean }) => Promise<void>;
  handleToggleRemovedFrame: (frameIndex: number) => void;
  handleClearRemovedFrames: () => void;
  handleDownloadGif: () => Promise<void>;
  handleDownloadSprite: () => void;
  handleDownloadSingleFrame: (frameIndex: number) => Promise<void>;
  handleDownloadFrameZip: (mode: "all" | "kept") => Promise<void>;
  handleRegenerate: () => Promise<void>;
}

export function useFrameEditor(
  id: string | undefined,
  settings: LocalSettings,
  onRegenerated?: (nextId: string) => void,
): UseFrameEditorResult {
  const { emitPetEvent } = usePetEvent();

  const [item, setItem] = useState<LocalHistoryItem | undefined>(undefined);
  const [fpsOverride, setFpsOverride] = useState<number | undefined>(undefined);
  const [loadingLocalGif, setLoadingLocalGif] = useState(false);
  const [loadingLocalSprite, setLoadingLocalSprite] = useState(false);
  const [spriteFrames, setSpriteFrames] = useState<HTMLCanvasElement[]>([]);
  const [removedFrameIndexes, setRemovedFrameIndexes] = useState<number[]>([]);
  const [selectedFrameIndex, setSelectedFrameIndex] = useState(0);
  const [framesLoading, setFramesLoading] = useState(false);
  const [frameError, setFrameError] = useState("");
  const [reencoding, setReencoding] = useState(false);
  const [reencodeProgress, setReencodeProgress] = useState(0);
  const [reencodeError, setReencodeError] = useState("");
  const [regenerating, setRegenerating] = useState(false);
  const [regenerateStatus, setRegenerateStatus] = useState("等待重新生成");
  const [regenerateProgress, setRegenerateProgress] = useState(0);
  const [regenerateError, setRegenerateError] = useState("");
  const [exportingZip, setExportingZip] = useState<"all" | "kept" | null>(null);
  const [exportGifSize, setExportGifSize] = useState<GifExportSize>("original");
  const [exportingGif, setExportingGif] = useState(false);

  const [localGifUrl, setGifBlob] = useObjectUrl();
  const [localSpriteUrl, setSpriteBlob] = useObjectUrl();

  const reencodeSeqRef = useRef(0);
  const regenerateAbortRef = useRef<AbortController | null>(null);
  const emitRef = useRef(emitPetEvent);
  emitRef.current = emitPetEvent;

  useEffect(() => {
    return () => {
      regenerateAbortRef.current?.abort();
      regenerateAbortRef.current = null;
    };
  }, []);

  // Load item when id changes.
  useEffect(() => {
    if (!id) return;
    const historyItem = getHistoryItem(id);
    setItem(historyItem);
    setRemovedFrameIndexes(
      normalizeFrameIndexes(historyItem?.removedFrameIndexes ?? [], SPRITE_FRAME_COUNT),
    );
    setFpsOverride(undefined);
  }, [id]);

  const effectiveFps = clampFps(fpsOverride ?? item?.fps ?? DEFAULT_FPS);
  const persistedRemovedKey = useMemo(
    () => (item?.removedFrameIndexes ?? []).join(","),
    [item?.removedFrameIndexes],
  );

  function persistItemPatch(patch: Partial<LocalHistoryItem>) {
    setItem((previous) => {
      if (!previous) return previous;
      const next = { ...previous, ...patch, updatedAt: nowIso() };
      upsertHistoryItem(next);
      return next;
    });
  }

  function blobToDataUrl(blob: Blob): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(new Error("本地图片读取失败"));
      reader.readAsDataURL(blob);
    });
  }

  async function resolveRegenerateInput(
    currentItem: LocalHistoryItem,
  ): Promise<{ inputSource: string; sourceBlob: Blob | null }> {
    const sourceBlob = await getSourceBlob(currentItem.id);
    if (sourceBlob) return { inputSource: await blobToDataUrl(sourceBlob), sourceBlob };

    const spriteBlob = await getSpriteBlob(currentItem.id);
    if (spriteBlob) return { inputSource: await blobToDataUrl(spriteBlob), sourceBlob: spriteBlob };

    if (currentItem.resultUrl) return { inputSource: currentItem.resultUrl, sourceBlob: null };
    throw new Error("缺少可用参考图，请回到创作页重新上传后生成");
  }

  // Load local GIF + sprite blobs from IndexedDB.
  useEffect(() => {
    if (!item?.id) return;
    const itemId = item.id;
    const itemFps = item.fps;
    const controller = new AbortController();

    async function loadLocalAssets() {
      setLoadingLocalGif(true);
      setLoadingLocalSprite(true);
      try {
        const normalizedRemoved = normalizeFrameIndexes(
          persistedRemovedKey ? persistedRemovedKey.split(",").map(Number) : [],
          SPRITE_FRAME_COUNT,
        );
        const persistedFps = clampFps(itemFps ?? DEFAULT_FPS);
        const [editedGifBlob, gifBlobResult, spriteBlobResult] = await Promise.all([
          getEditedGifBlob(itemId, persistedFps, normalizedRemoved),
          getGifBlob(itemId),
          getSpriteBlob(itemId),
        ]);

        if (controller.signal.aborted) return;

        setGifBlob((editedGifBlob ?? gifBlobResult) ?? null);
        setSpriteBlob(spriteBlobResult ?? null);
      } finally {
        if (!controller.signal.aborted) {
          setLoadingLocalGif(false);
          setLoadingLocalSprite(false);
        }
      }
    }

    void loadLocalAssets();
    return () => controller.abort();
  }, [item?.id, item?.fps, persistedRemovedKey, setGifBlob, setSpriteBlob]);

  // Extract sprite frames from the sprite URL.
  useEffect(() => {
    if (!item?.id) return;
    const itemId = item.id;
    const itemResultUrl = item.resultUrl;
    const controller = new AbortController();

    async function loadSpriteFrames() {
      setFramesLoading(true);
      setFrameError("");
      try {
        let spriteSource = localSpriteUrl;

        if (!spriteSource) {
          if (!itemResultUrl) throw new Error("无可用精灵图");
          const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(itemResultUrl)}`;
          const transparentSprite = await removeBackgroundColorKey(proxiedUrl, BG_REMOVAL_TOLERANCE);
          if (controller.signal.aborted) return;
          const blobData = dataUrlToBlob(transparentSprite);
          await putSpriteBlob(itemId, blobData);
          if (controller.signal.aborted) return;
          setSpriteBlob(blobData);
          // Use the data URL for frame extraction in this run.
          spriteSource = transparentSprite;
        }

        const frames = await extractFramesFromSpriteSource(spriteSource, SPRITE_ROWS, SPRITE_COLS);
        if (controller.signal.aborted) return;
        setSpriteFrames(frames);
        setRemovedFrameIndexes((current) => normalizeFrameIndexes(current, frames.length));
      } catch (error) {
        if (!controller.signal.aborted) {
          setFrameError(error instanceof Error ? error.message : "帧提取失败");
        }
      } finally {
        if (!controller.signal.aborted) setFramesLoading(false);
      }
    }

    void loadSpriteFrames();
    return () => controller.abort();
  }, [item?.id, item?.resultUrl, localSpriteUrl, setSpriteBlob]);

  // Clamp selectedFrameIndex when frame count changes.
  useEffect(() => {
    if (!spriteFrames.length) return;
    if (selectedFrameIndex < spriteFrames.length) return;
    setSelectedFrameIndex(0);
  }, [selectedFrameIndex, spriteFrames.length]);

  const expired = isExpired(item?.urlExpiresAt);
  const left = formatCountdown(msLeft(item?.urlExpiresAt));
  const gifDisplayUrl = localGifUrl;
  const spriteDisplayUrl = localSpriteUrl || item?.resultUrl || "";

  // Keep refs so applyGifSettings can be referenced from mount-time effects without
  // causing them to re-run on every render.
  const effectiveFpsRef = useRef(effectiveFps);
  effectiveFpsRef.current = effectiveFps;
  const itemRef = useRef(item);
  itemRef.current = item;
  const spriteFramesRef = useRef(spriteFrames);
  spriteFramesRef.current = spriteFrames;

  async function applyGifSettings(
    nextRemovedFrameIndexes: number[],
    options?: { forceGenerate?: boolean },
  ) {
    const currentItem = itemRef.current;
    const currentFrames = spriteFramesRef.current;
    const currentFps = effectiveFpsRef.current;

    if (!currentItem) return;
    if (!currentFrames.length) {
      setReencodeError("精灵图尚未完成切帧");
      return;
    }

    const normalizedRemovedFrameIndexes = normalizeFrameIndexes(
      nextRemovedFrameIndexes,
      currentFrames.length,
    );
    const validFrames = filterFramesByRemovedIndexes(currentFrames, normalizedRemovedFrameIndexes);
    if (!validFrames.length) {
      setReencodeError("至少保留 1 帧，无法全部剔除");
      return;
    }

    const seq = reencodeSeqRef.current + 1;
    reencodeSeqRef.current = seq;
    setReencoding(true);
    setReencodeError("");
    setReencodeProgress(0);
    emitRef.current("task:reencode:start");

    try {
      const fpsChanged = currentFps !== clampFps(currentItem.fps ?? DEFAULT_FPS);
      const editedGifReadyNext =
        normalizedRemovedFrameIndexes.length > 0 || fpsChanged || Boolean(currentItem.editedGifReady);

      if (!options?.forceGenerate) {
        if (!normalizedRemovedFrameIndexes.length && !fpsChanged) {
          const cachedGif = await getGifBlob(currentItem.id);
          if (cachedGif) {
            if (seq !== reencodeSeqRef.current) return;
            setGifBlob(cachedGif);
            setReencodeProgress(100);
            persistItemPatch({
              removedFrameIndexes: [],
              editedGifReady: Boolean(currentItem.editedGifReady),
              localGifReady: true,
              editedAt: nowIso(),
            });
            emitRef.current("task:reencode:success");
            return;
          }
        }

        const cachedEdited = await getEditedGifBlob(
          currentItem.id,
          currentFps,
          normalizedRemovedFrameIndexes,
        );
        if (cachedEdited) {
          if (seq !== reencodeSeqRef.current) return;
          setGifBlob(cachedEdited);
          setReencodeProgress(100);
          persistItemPatch({
            fps: currentFps,
            removedFrameIndexes: normalizedRemovedFrameIndexes,
            editedGifReady: editedGifReadyNext,
            localGifReady: true,
            localSpriteReady: true,
            editedAt: nowIso(),
          });
          emitRef.current("task:reencode:success");
          return;
        }
      }

      const gifBlob = await buildTransparentGifFromFrames({
        frames: validFrames,
        fps: currentFps,
        onProgress: (progress) => {
          if (seq !== reencodeSeqRef.current) return;
          setReencodeProgress(Math.round(Math.max(0, Math.min(1, progress)) * 100));
        },
      });
      if (seq !== reencodeSeqRef.current) return;

      await putEditedGifBlob(currentItem.id, currentFps, normalizedRemovedFrameIndexes, gifBlob);
      if (!normalizedRemovedFrameIndexes.length) {
        await putGifBlob(currentItem.id, gifBlob);
      }

      if (seq !== reencodeSeqRef.current) return;
      setGifBlob(gifBlob);
      persistItemPatch({
        fps: currentFps,
        removedFrameIndexes: normalizedRemovedFrameIndexes,
        editedGifReady: editedGifReadyNext,
        localGifReady: true,
        localSpriteReady: true,
        editedAt: nowIso(),
      });
      setReencodeProgress(100);
      emitRef.current("task:reencode:success");
    } catch (error) {
      if (seq !== reencodeSeqRef.current) return;
      const message = error instanceof Error ? error.message : "重编码失败";
      setReencodeError(message);
      emitRef.current("task:reencode:failed", { reason: message });
    } finally {
      if (seq === reencodeSeqRef.current) setReencoding(false);
    }
  }

  // Keep a ref to applyGifSettings so the initial-load effect can call the latest version
  // without listing it (and all its deps) in the dependency array.
  const applyGifSettingsRef = useRef(applyGifSettings);
  applyGifSettingsRef.current = applyGifSettings;

  // When frames first load and there are persisted removed indexes, apply them.
  const removedFrameIndexesRef = useRef(removedFrameIndexes);
  removedFrameIndexesRef.current = removedFrameIndexes;

  useEffect(() => {
    if (!item?.id || !spriteFrames.length) return;
    if (!removedFrameIndexesRef.current.length) return;
    void applyGifSettingsRef.current(removedFrameIndexesRef.current);
  }, [item?.id, spriteFrames.length]);

  function handleToggleRemovedFrame(frameIndex: number) {
    if (!spriteFrames[frameIndex]) return;
    setSelectedFrameIndex(frameIndex);
    const currentIndexes = removedFrameIndexesRef.current;
    const isRemoved = currentIndexes.includes(frameIndex);
    let nextIndexes: number[] = currentIndexes;

    if (isRemoved) {
      nextIndexes = currentIndexes.filter((index) => index !== frameIndex);
    } else {
      if (currentIndexes.length >= MAX_REMOVED_FRAMES) {
        setReencodeError(`最多可剔除 ${MAX_REMOVED_FRAMES} 帧`);
        return;
      }
      if (spriteFrames.length - (currentIndexes.length + 1) < 1) {
        setReencodeError("至少保留 1 帧，无法全部剔除");
        return;
      }
      nextIndexes = [...currentIndexes, frameIndex].sort((a, b) => a - b);
    }

    removedFrameIndexesRef.current = nextIndexes;
    setRemovedFrameIndexes(nextIndexes);
    setReencodeError("");
    persistItemPatch({
      removedFrameIndexes: nextIndexes,
      editedAt: nowIso(),
    });
    void applyGifSettings(nextIndexes);
  }

  function handleClearRemovedFrames() {
    if (!removedFrameIndexesRef.current.length) return;
    removedFrameIndexesRef.current = [];
    setRemovedFrameIndexes([]);
    persistItemPatch({ removedFrameIndexes: [], editedAt: nowIso() });
    void applyGifSettings([]);
  }

  async function handleDownloadGif() {
    if (!item || !gifDisplayUrl) return;

    if (exportGifSize === "original") {
      const link = document.createElement("a");
      link.href = gifDisplayUrl;
      link.download = `gifwechat_${item.actionId}_${Date.now()}.gif`;
      link.click();
      return;
    }

    if (!spriteFrames.length) {
      setReencodeError("精灵图尚未完成切帧，暂时无法按尺寸导出");
      return;
    }

    setExportingGif(true);
    setReencodeError("");

    try {
      const normalizedRemovedFrameIndexes = normalizeFrameIndexes(
        removedFrameIndexes,
        spriteFrames.length,
      );
      const cached = await getExportedGifBlob(
        item.id,
        effectiveFps,
        normalizedRemovedFrameIndexes,
        exportGifSize,
      );
      if (cached) {
        downloadBlob(cached, `gifwechat_${item.actionId}_${exportGifSize}_${Date.now()}.gif`);
        return;
      }

      const validFrames = filterFramesByRemovedIndexes(spriteFrames, normalizedRemovedFrameIndexes);
      if (!validFrames.length) throw new Error("至少保留 1 帧，无法导出 GIF");

      const gifBlob = await buildTransparentGifFromFramesWithSize({
        frames: validFrames,
        fps: effectiveFps,
        targetSize: exportGifSize,
      });
      await putExportedGifBlob(item.id, effectiveFps, normalizedRemovedFrameIndexes, exportGifSize, gifBlob);
      downloadBlob(gifBlob, `gifwechat_${item.actionId}_${exportGifSize}_${Date.now()}.gif`);
    } catch (error) {
      setReencodeError(error instanceof Error ? error.message : "按尺寸导出 GIF 失败");
    } finally {
      setExportingGif(false);
    }
  }

  function handleDownloadSprite() {
    if (!localSpriteUrl && !spriteDisplayUrl) return;
    const link = document.createElement("a");
    link.href = localSpriteUrl || spriteDisplayUrl;
    link.download = `gifwechat_sprite_${item?.actionId}_${Date.now()}.png`;
    link.click();
  }

  async function handleDownloadSingleFrame(frameIndex: number) {
    const frame = spriteFrames[frameIndex];
    if (!frame) return;
    try {
      const blob = await canvasToBlob(frame, "image/png");
      downloadBlob(
        blob,
        `gifwechat_frame_${String(frameIndex + 1).padStart(2, "0")}_${Date.now()}.png`,
      );
    } catch (error) {
      setReencodeError(error instanceof Error ? error.message : "导出单帧失败");
    }
  }

  async function handleDownloadFrameZip(mode: "all" | "kept") {
    if (!spriteFrames.length || !item) return;
    setExportingZip(mode);
    setReencodeError("");

    try {
      const indexes =
        mode === "all"
          ? spriteFrames.map((_, index) => index)
          : spriteFrames.map((_, index) => index).filter((index) => !removedFrameIndexes.includes(index));

      if (!indexes.length) throw new Error("当前没有可导出的帧");

      const entries: Record<string, Uint8Array> = {};
      for (const frameIndex of indexes) {
        const frameBlob = await canvasToBlob(spriteFrames[frameIndex], "image/png");
        const frameArray = new Uint8Array(await frameBlob.arrayBuffer());
        entries[`frame_${String(frameIndex + 1).padStart(2, "0")}.png`] = frameArray;
      }

      const zipBytes = zipSync(entries, { level: 0 });
      const zipBytesSafe = new Uint8Array(zipBytes.length);
      zipBytesSafe.set(zipBytes);
      const zipBlob = new Blob([zipBytesSafe.buffer], { type: "application/zip" });
      downloadBlob(
        zipBlob,
        mode === "all"
          ? `gifwechat_frames_all_${Date.now()}.zip`
          : `gifwechat_frames_kept_${Date.now()}.zip`,
      );
    } catch (error) {
      setReencodeError(error instanceof Error ? error.message : "导出切帧失败");
    } finally {
      setExportingZip(null);
    }
  }

  async function handleRegenerate() {
    const currentItem = itemRef.current;
    if (!currentItem) return;
    if (!settings.apiKey.trim()) {
      setRegenerateError("请先在设置页填写 API Key");
      return;
    }

    regenerateAbortRef.current?.abort();
    const controller = new AbortController();
    regenerateAbortRef.current = controller;

    const replaceExistingFailed = currentItem.status === "failed";
    const localId = replaceExistingFailed
      ? currentItem.id
      : (globalThis.crypto?.randomUUID?.() ?? `${Date.now()}`);
    const createdAt = nowIso();
    const baseFps = clampFps(currentItem.fps ?? DEFAULT_FPS);
    const taskModel = settings.defaultModel.trim() || "nano-banana-pro";
    const finalPrompt =
      currentItem.finalPrompt?.trim() ||
      composePrompt({
        actionType: currentItem.actionId,
        userCustomPrompt: currentItem.prompt,
      }).finalPrompt;

    let taskItem: LocalHistoryItem = {
      id: localId,
      actionId: currentItem.actionId,
      prompt: currentItem.prompt,
      fps: baseFps,
      finalPrompt,
      model: taskModel,
      createdAt,
      updatedAt: createdAt,
      status: "queued",
      progress: 0,
    };

    function persistRegenerateTask(next: LocalHistoryItem) {
      taskItem = next;
      upsertHistoryItem(next);
      if (replaceExistingFailed) {
        setItem(next);
      }
    }

    setRegenerating(true);
    setRegenerateError("");
    setRegenerateProgress(0);
    setRegenerateStatus("正在呼叫像素小精灵...");
    setReencodeError("");
    emitRef.current("task:generate:start", {
      actionId: currentItem.actionId,
      actionLabel: ACTION_LABELS[currentItem.actionId],
      customPrompt: currentItem.prompt,
      hasImage: true,
    });

    try {
      persistRegenerateTask(taskItem);

      const { inputSource, sourceBlob } = await resolveRegenerateInput(currentItem);
      if (controller.signal.aborted) return;
      if (sourceBlob) {
        await putSourceBlob(localId, sourceBlob);
        if (controller.signal.aborted) return;
      }

      const providerTaskId = await createNanoTask({
        settings,
        prompt: finalPrompt,
        urls: [inputSource],
        signal: controller.signal,
      });
      if (controller.signal.aborted) return;

      taskItem = {
        ...taskItem,
        providerTaskId,
        status: "running",
        progress: 0,
        updatedAt: nowIso(),
      };
      persistRegenerateTask(taskItem);

      const final = await waitForNanoResult({
        settings,
        id: providerTaskId,
        signal: controller.signal,
        onTick: (tick) => {
          if (controller.signal.aborted) return;
          const value = Math.max(0, Math.min(100, Number(tick.progress ?? 0)));
          setRegenerateProgress(value);
          setRegenerateStatus(`施展变身魔法中... ${value}%`);
          taskItem = {
            ...taskItem,
            status: tick.status === "failed" ? "failed" : "running",
            progress: value,
            updatedAt: nowIso(),
            error: tick.error,
            failureReason: tick.failure_reason,
          };
          persistRegenerateTask(taskItem);
          emitRef.current("task:generate:progress", { progress: value });
        },
      });
      if (controller.signal.aborted) return;

      if (final.status === "failed") {
        const message = final.error || final.failure_reason || "重新生成失败";
        setRegenerateError(message);
        setRegenerateStatus("生成失败");
        taskItem = {
          ...taskItem,
          status: "failed",
          progress: Number(final.progress ?? taskItem.progress ?? 0),
          updatedAt: nowIso(),
          error: message,
          failureReason: final.failure_reason,
        };
        persistRegenerateTask(taskItem);
        emitRef.current("task:generate:failed", { reason: message });
        return;
      }

      const resultUrl = final.results?.[0]?.url;
      if (!resultUrl) throw new Error("第三方未返回结果 URL");

      setRegenerateStatus("拼装动画碎片中...");
      const proxiedUrl = `/api/image-proxy?url=${encodeURIComponent(resultUrl)}`;
      const transparentSprite = await removeBackgroundColorKey(
        proxiedUrl,
        BG_REMOVAL_TOLERANCE,
        controller.signal,
      );
      if (controller.signal.aborted) return;

      const spriteBlob = dataUrlToBlob(transparentSprite);
      await putSpriteBlob(localId, spriteBlob);
      if (controller.signal.aborted) return;

      setRegenerateStatus("封装透明 GIF 中...");
      const gifBlob = await buildTransparentGifFromSpriteSource({
        spriteSource: transparentSprite,
        fps: baseFps,
        signal: controller.signal,
        onProgress: (progress) => {
          if (controller.signal.aborted) return;
          const value = Math.round(Math.max(0, Math.min(1, progress)) * 100);
          setRegenerateProgress(value);
          setRegenerateStatus(`封装透明 GIF 中... ${value}%`);
        },
      });
      if (controller.signal.aborted) return;

      await Promise.all([
        putGifBlob(localId, gifBlob),
        putEditedGifBlob(localId, baseFps, [], gifBlob),
      ]);
      if (controller.signal.aborted) return;

      setSpriteBlob(spriteBlob);
      setGifBlob(gifBlob);
      setRemovedFrameIndexes([]);
      setSelectedFrameIndex(0);

      setRegenerateProgress(100);
      setRegenerateStatus("生成成功");
      taskItem = {
        ...taskItem,
        status: "succeeded",
        progress: 100,
        providerTaskId,
        resultUrl,
        finalPrompt,
        fps: baseFps,
        removedFrameIndexes: [],
        editedGifReady: false,
        localGifReady: true,
        localSpriteReady: true,
        editedAt: nowIso(),
        updatedAt: nowIso(),
        urlExpiresAt: computeExpiresAt(createdAt),
        error: undefined,
        failureReason: undefined,
      };
      persistRegenerateTask(taskItem);
      emitRef.current("task:generate:success", { milestone: false });
      onRegenerated?.(localId);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        setRegenerateStatus("生成已取消");
        emitRef.current("task:generate:cancelled", {});
        if (!replaceExistingFailed && taskItem.status === "queued" && !taskItem.providerTaskId) {
          removeHistoryItem(localId);
        } else {
          persistRegenerateTask({
            ...taskItem,
            status: "failed",
            updatedAt: nowIso(),
            error: taskItem.error || "任务已取消",
            failureReason: taskItem.failureReason || "cancelled",
          });
        }
        return;
      }

      const message = error instanceof Error ? error.message : "重新生成失败";
      setRegenerateError(message);
      setRegenerateStatus("生成失败");
      persistRegenerateTask({
        ...taskItem,
        status: "failed",
        updatedAt: nowIso(),
        error: message,
      });
      emitRef.current("task:generate:failed", { reason: message });
    } finally {
      if (regenerateAbortRef.current === controller) {
        regenerateAbortRef.current = null;
      }
      setRegenerating(false);
    }
  }

  return {
    item,
    effectiveFps,
    fpsOverride,
    setFpsOverride,
    localGifUrl,
    loadingLocalGif,
    localSpriteUrl,
    loadingLocalSprite,
    spriteFrames,
    removedFrameIndexes,
    selectedFrameIndex,
    setSelectedFrameIndex,
    framesLoading,
    frameError,
    reencoding,
    reencodeProgress,
    reencodeError,
    regenerating,
    regenerateStatus,
    regenerateProgress,
    regenerateError,
    exportingZip,
    exportGifSize,
    setExportGifSize,
    exportingGif,
    expired,
    left,
    gifDisplayUrl,
    spriteDisplayUrl,
    applyGifSettings,
    handleToggleRemovedFrame,
    handleClearRemovedFrames,
    handleDownloadGif,
    handleDownloadSprite,
    handleDownloadSingleFrame,
    handleDownloadFrameZip,
    handleRegenerate,
  };
}
