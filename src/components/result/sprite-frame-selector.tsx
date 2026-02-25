"use client";

import { MAX_REMOVED_FRAMES, SPRITE_FRAME_COUNT } from "@/lib/constants";

interface SpriteFrameSelectorProps {
  spriteDisplayUrl: string;
  spriteFrames: HTMLCanvasElement[];
  removedFrameIndexes: number[];
  selectedFrameIndex: number;
  reencoding: boolean;
  regenerating: boolean;
  framesLoading: boolean;
  frameError: string;
  exportingZip: "all" | "kept" | null;
  onToggleFrame: (frameIndex: number) => void;
  onClearRemoved: () => void;
  onDownloadSprite: () => void;
  onDownloadFrameZip: (mode: "all" | "kept") => void;
  onDownloadSingleFrame: (frameIndex: number) => void;
  onSelectFrame: (frameIndex: number) => void;
}

export function SpriteFrameSelector({
  spriteDisplayUrl,
  spriteFrames,
  removedFrameIndexes,
  selectedFrameIndex,
  reencoding,
  regenerating,
  framesLoading,
  frameError,
  exportingZip,
  onToggleFrame,
  onClearRemoved,
  onDownloadSprite,
  onDownloadFrameZip,
  onDownloadSingleFrame,
  onSelectFrame,
}: SpriteFrameSelectorProps) {
  const frameCount = spriteFrames.length || SPRITE_FRAME_COUNT;

  return (
    <article className="history-card rounded-xl border-4 border-border-dim p-3">
      <p className="pixel-label">帧筛选</p>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <span className="cyber-chip muted">总帧 {frameCount}</span>
          <span className={`cyber-chip ${removedFrameIndexes.length ? "fail" : "ok"}`}>
            已剔除 {removedFrameIndexes.length}
          </span>
          <span className="cyber-chip muted">最多 {MAX_REMOVED_FRAMES}</span>
        </div>

        <div className="photo-frame w-full p-3">
          {framesLoading ? (
            <p className="grid h-[420px] place-items-center text-lg text-text-muted">
              正在切分 {SPRITE_FRAME_COUNT} 帧...
            </p>
          ) : spriteDisplayUrl ? (
            <div className="mx-auto w-full max-w-[460px]">
              <div className="relative aspect-square overflow-hidden rounded-[6px] border-[3px] border-[#2D1B4E] bg-white">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={spriteDisplayUrl}
                  alt="sprite full"
                  className="h-full w-full object-contain pixelated"
                />
                <div className="absolute inset-0 grid grid-cols-4 grid-rows-4">
                  {Array.from({ length: SPRITE_FRAME_COUNT }).map((_, frameIndex) => {
                    const removed = removedFrameIndexes.includes(frameIndex);
                    const selected = frameIndex === selectedFrameIndex;
                    return (
                      <button
                        key={`cell-${frameIndex}`}
                        type="button"
                        className={`relative border border-[#2D1B4E]/35 transition ${
                          removed ? "bg-[#ffd8d4]/45" : "bg-transparent hover:bg-[#d6f0ff]/35"
                        } ${selected ? "ring-2 ring-[#2D1B4E]" : ""}`}
                        onClick={() => onToggleFrame(frameIndex)}
                        disabled={reencoding || regenerating || !spriteFrames.length}
                        title={removed ? "点击恢复该帧" : "点击剔除该帧"}
                      >
                        <span className="absolute left-1 top-1 rounded bg-white/90 px-1 text-[10px] text-[#2D1B4E]">
                          {frameIndex + 1}
                        </span>
                        {removed && (
                          <span className="absolute inset-0 grid place-items-center text-[10px] font-bold text-[#7d173a]">
                            已剔除
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
              <p className="mt-2 text-center text-sm text-text-muted">
                点击格子切换剔除状态，右侧 GIF 会同步更新
              </p>
            </div>
          ) : (
            <p className="grid h-[420px] place-items-center text-lg text-text-muted">
              原始精灵图加载中...
            </p>
          )}
        </div>

        {frameError && <p className="text-danger animate-pulse">{frameError}</p>}

        {/* 桌面端显示ZIP下载按钮，移动端隐藏 */}
        <div className="hidden md:grid md:grid-cols-2 gap-2">
          <button
            className="arcade-button secondary w-full text-xs"
            onClick={() => onDownloadFrameZip("all")}
            disabled={!spriteFrames.length || Boolean(exportingZip) || regenerating}
          >
            {exportingZip === "all" ? "打包中..." : `下载切帧 ZIP (${SPRITE_FRAME_COUNT}帧)`}
          </button>
          <button
            className="arcade-button secondary w-full text-xs"
            onClick={() => onDownloadFrameZip("kept")}
            disabled={!spriteFrames.length || Boolean(exportingZip) || regenerating}
          >
            {exportingZip === "kept" ? "打包中..." : "下载保留帧 ZIP"}
          </button>
        </div>

        {/* 始终显示的按钮：原始精灵图 + 清空剔除帧 */}
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <button
            className="arcade-button secondary w-full text-xs"
            onClick={onDownloadSprite}
            disabled={!spriteDisplayUrl || regenerating}
          >
            下载原始精灵图
          </button>
          <button
            className="arcade-button danger w-full text-xs"
            onClick={onClearRemoved}
            disabled={!removedFrameIndexes.length || reencoding || regenerating}
          >
            清空剔除帧
          </button>
        </div>

        <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_auto]">
          <select
            className="terminal-input"
            value={selectedFrameIndex}
            onChange={(event) => onSelectFrame(Number(event.target.value))}
            disabled={!spriteFrames.length || regenerating}
          >
            {Array.from({ length: frameCount }).map((_, frameIndex) => {
              const removed = removedFrameIndexes.includes(frameIndex);
              return (
                <option key={`export-frame-${frameIndex}`} value={frameIndex}>
                  第 {frameIndex + 1} 帧{removed ? "（已剔除）" : ""}
                </option>
              );
            })}
          </select>
          <button
            className="arcade-button mint w-full text-xs sm:w-auto"
            onClick={() => onDownloadSingleFrame(selectedFrameIndex)}
            disabled={!spriteFrames.length || regenerating}
          >
            导出所选单帧
          </button>
        </div>
      </div>
    </article>
  );
}
