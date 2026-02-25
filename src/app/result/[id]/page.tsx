"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { GifExportPanel } from "@/components/result/gif-export-panel";
import { SpriteFrameSelector } from "@/components/result/sprite-frame-selector";
import { TaskInfoPanel } from "@/components/result/task-info-panel";
import { FPS_OPTIONS } from "@/lib/constants";
import { clampFps } from "@/lib/image-processing";
import { useFrameEditor } from "@/hooks/use-frame-editor";
import { useSettings } from "@/hooks/use-settings";

function subscribeToNothing(): () => void {
  return () => {};
}

export default function ResultPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const isClient = useSyncExternalStore(subscribeToNothing, () => true, () => false);
  const { settings } = useSettings();
  const [, setTick] = useState(0);
  const [panelMode, setPanelMode] = useState<"focus" | "advanced">("focus");
  const [detailTab, setDetailTab] = useState<"task" | "prompt">("task");

  useEffect(() => {
    const timer = window.setInterval(() => setTick((n) => n + 1), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const editor = useFrameEditor(id, settings, (nextId) => {
    if (nextId !== id) {
      router.push(`/result/${nextId}`);
    }
  });
  const {
    item,
    effectiveFps,
    setFpsOverride,
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
    gifDisplayUrl,
    spriteDisplayUrl,
    loadingLocalGif,
    loadingLocalSprite,
    applyGifSettings,
    handleToggleRemovedFrame,
    handleClearRemovedFrames,
    handleDownloadGif,
    handleDownloadSprite,
    handleDownloadSingleFrame,
    handleDownloadFrameZip,
    handleRegenerate,
  } = editor;

  const hasRightPanels = panelMode === "advanced";

  if (!isClient) return null;

  if (!item) {
    return (
      <section className="cute-panel p-6 text-center">
        <p className="pixel-title text-lg">记录不存在</p>
        <p className="mt-4 text-xl text-text-muted">该记录可能已被清除或不存在。</p>
        <Link href="/history" className="arcade-button secondary mt-6 inline-flex">
          返回历史
        </Link>
      </section>
    );
  }

  return (
    <section
      className={`grid grid-cols-1 gap-8 fade-in-up ${
        hasRightPanels ? "xl:grid-cols-[1.35fr_0.65fr]" : ""
      }`}
    >
      <div className="space-y-4">
        <div className="cute-panel space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="pixel-title text-xs">编辑流程</p>
            <button
              className={`arcade-button px-3 py-2 text-xs ${panelMode === "advanced" ? "" : "secondary"}`}
              onClick={() => {
                const newMode = panelMode === "focus" ? "advanced" : "focus";
                setPanelMode(newMode);
                // 移动端展开后跳转到高级面板
                if (newMode === "advanced" && typeof window !== "undefined" && window.innerWidth < 1024) {
                  setTimeout(() => {
                    const panel = document.getElementById("advanced-panel");
                    panel?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }, 150);
                }
              }}
            >
              {panelMode === "advanced" ? "收起高级面板" : "展开高级面板"}
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            <span className="cyber-chip muted">1. 选择剔除帧</span>
            <span className="cyber-chip muted">2. 调整 FPS</span>
            <span className="cyber-chip ok">3. 下载或重新生成</span>
          </div>
          {(reencoding || regenerating) && (
            <p className="text-base text-text-muted">
              {regenerating
                ? `重新生成中：${regenerateStatus || "处理中"} ${regenerateProgress}%`
                : `应用参数中：${reencodeProgress}%`}
            </p>
          )}
        </div>

        <div className="cute-panel">
          <p className="pixel-title text-xs">结果预览</p>
          <div className="mt-4 grid grid-cols-1 items-start gap-4 md:grid-cols-2">
            <SpriteFrameSelector
              spriteDisplayUrl={spriteDisplayUrl}
              spriteFrames={spriteFrames}
              removedFrameIndexes={removedFrameIndexes}
              selectedFrameIndex={selectedFrameIndex}
              reencoding={reencoding || regenerating}
              framesLoading={framesLoading}
              frameError={frameError}
              exportingZip={exportingZip}
              regenerating={regenerating}
              onToggleFrame={handleToggleRemovedFrame}
              onClearRemoved={handleClearRemovedFrames}
              onDownloadSprite={handleDownloadSprite}
              onDownloadFrameZip={(mode) => void handleDownloadFrameZip(mode)}
              onDownloadSingleFrame={(index) => void handleDownloadSingleFrame(index)}
              onSelectFrame={setSelectedFrameIndex}
            />

            <GifExportPanel
              gifDisplayUrl={gifDisplayUrl}
              reencoding={reencoding}
              reencodeProgress={reencodeProgress}
              reencodeError={reencodeError}
              regenerating={regenerating}
              regenerateStatus={regenerateStatus}
              regenerateProgress={regenerateProgress}
              regenerateError={regenerateError}
              exportGifSize={exportGifSize}
              exportingGif={exportingGif}
              onSetExportSize={setExportGifSize}
              onDownloadGif={() => void handleDownloadGif()}
              onRegenerate={() => void handleRegenerate()}
            />
          </div>

          <div className="mt-4 rounded-md border-2 border-border-dim bg-[#fffcf8] p-3">
            <p className="pixel-title text-xs">本地调速</p>
            <div className="mt-3 flex flex-col gap-3 md:grid md:grid-cols-[1fr_auto] md:items-center xl:flex xl:flex-row">
              <div className="space-y-3">
                <div className="grid grid-cols-[1fr_auto] items-center gap-3">
                  <input
                    type="range"
                    min={4}
                    max={24}
                    step={1}
                    value={effectiveFps}
                    onChange={(event) => setFpsOverride(clampFps(Number(event.target.value)))}
                  />
                  <span className="cyber-chip">{effectiveFps} fps</span>
                </div>
                <div className="flex flex-wrap gap-2">
                  {FPS_OPTIONS.map((option) => (
                    <button
                      key={option}
                      className={`arcade-button px-3 py-2 text-xs ${effectiveFps === option ? "mint" : "secondary"}`}
                      onClick={() => setFpsOverride(option)}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>
              <button
                className="arcade-button mint w-full md:w-auto xl:min-w-[220px]"
                onClick={() => void applyGifSettings(removedFrameIndexes, { forceGenerate: true })}
                disabled={reencoding || regenerating}
              >
                {reencoding ? `重编码中 ${reencodeProgress}%` : "应用速度与删帧"}
              </button>
            </div>
            <p className="mt-3 text-base text-text-muted">
              建议流程：左侧剔除帧 + 本区调速后点击“应用”，再在右侧导出 GIF。
            </p>
            {reencodeError && <p className="mt-2 text-danger animate-pulse">{reencodeError}</p>}
          </div>
        </div>
      </div>

      {hasRightPanels && (
        <div className="space-y-4" id="advanced-panel">
          <div className="cute-panel space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="pixel-title text-xs">高级信息</p>
              <span className="cyber-chip muted text-[10px]">辅助信息</span>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                className={`arcade-button px-3 py-2 text-xs ${detailTab === "task" ? "" : "secondary"}`}
                onClick={() => setDetailTab("task")}
              >
                任务状态
              </button>
              <button
                className={`arcade-button px-3 py-2 text-xs ${detailTab === "prompt" ? "" : "secondary"}`}
                onClick={() => setDetailTab("prompt")}
              >
                提示词文本
              </button>
            </div>
            <p className="text-sm text-text-muted">
              这里展示调试与复用信息，不影响主流程编辑。
            </p>
          </div>

          {detailTab === "task" ? (
            <TaskInfoPanel
              item={item}
              removedFrameIndexes={removedFrameIndexes}
              loadingLocalSprite={loadingLocalSprite}
              loadingLocalGif={loadingLocalGif}
            />
          ) : (
            <div className="history-card rounded-xl border-4 border-border-dim p-3">
              <p className="pixel-label">提示词</p>
              <p className="mt-2 whitespace-pre-wrap break-words text-base leading-relaxed text-text-muted">
                {item.finalPrompt || "(无)"}
              </p>
            </div>
          )}
        </div>
      )}
    </section>
  );
}
