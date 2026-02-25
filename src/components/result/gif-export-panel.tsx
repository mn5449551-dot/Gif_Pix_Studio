"use client";

import { AssetImage } from "@/components/asset-image";
import { GIF_EXPORT_SIZE_OPTIONS } from "@/lib/constants";
import type { GifExportSize } from "@/lib/types";

interface GifExportPanelProps {
  gifDisplayUrl: string;
  reencoding: boolean;
  reencodeProgress: number;
  reencodeError: string;
  regenerating: boolean;
  regenerateStatus: string;
  regenerateProgress: number;
  regenerateError: string;
  exportGifSize: GifExportSize;
  exportingGif: boolean;
  onSetExportSize: (size: GifExportSize) => void;
  onDownloadGif: () => void;
  onRegenerate: () => void;
}

export function GifExportPanel({
  gifDisplayUrl,
  reencoding,
  reencodeProgress,
  reencodeError,
  regenerating,
  regenerateStatus,
  regenerateProgress,
  regenerateError,
  exportGifSize,
  exportingGif,
  onSetExportSize,
  onDownloadGif,
  onRegenerate,
}: GifExportPanelProps) {
  const busy = reencoding || regenerating;

  return (
    <article className="history-card h-fit self-start rounded-xl border-4 border-border-dim p-3">
      <p className="pixel-label">GIF 输出</p>
      <div className="mb-2 flex flex-wrap gap-2">
        <span className="cyber-chip muted">预览</span>
        <span className="cyber-chip muted">导出尺寸</span>
        <span className="cyber-chip ok">下载 / 重生成</span>
      </div>
      <div className="photo-frame relative h-[320px] w-full">
        <div className="relative h-full w-full">
          {gifDisplayUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={gifDisplayUrl} alt="gif" className="h-full w-full object-contain pixelated" />
          ) : (
            <p className="grid h-full place-items-center text-lg text-text-muted">GIF 加载中...</p>
          )}

          {regenerating && (
            <div className="paper-overlay p-6">
              <div className="space-y-3 text-center">
                <AssetImage
                  src="/assets/icons/loading-potion.png"
                  alt="Loading"
                  className="h-14 w-14 pixelated animate-bounce mx-auto"
                  fallbackClassName="asset-fallback-md"
                />
                <p className="text-xl text-text-primary">{regenerateStatus || "重新生成中..."}</p>
                <p className="text-base text-text-muted">{regenerateProgress}%</p>
              </div>
            </div>
          )}

          {reencoding && !regenerating && (
            <div className="paper-overlay p-6">
              <div className="space-y-3 text-center">
                <AssetImage
                  src="/assets/icons/hourglass.png"
                  alt="Hourglass"
                  className="h-14 w-14 pixelated animate-spin mx-auto"
                  fallbackClassName="asset-fallback-md"
                />
                <p className="text-xl text-text-primary">正在为你重新施法...</p>
                <p className="text-base text-text-muted">{reencodeProgress}%</p>
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="mt-3">
        <p className="pixel-label">GIF 导出尺寸</p>
        <select
          className="terminal-input"
          value={String(exportGifSize)}
          onChange={(event) => {
            const value = event.target.value;
            onSetExportSize(
              value === "original" ? "original" : (Number(value) as GifExportSize),
            );
          }}
          disabled={busy || exportingGif}
        >
          {GIF_EXPORT_SIZE_OPTIONS.map((option) => (
            <option key={String(option.value)} value={String(option.value)}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      <button
        className="arcade-button mint mt-3 w-full text-xs"
        onClick={onDownloadGif}
        disabled={!gifDisplayUrl || exportingGif || busy}
      >
        {exportingGif ? "导出中..." : "下载 GIF"}
      </button>

      <button
        className="arcade-button primary mt-2 w-full text-xs"
        onClick={onRegenerate}
        disabled={busy}
      >
        {regenerating ? `重新生成中... ${regenerateProgress}%` : "重新生成（同配置）"}
      </button>

      <p className="mt-2 text-base text-text-muted">
        若你刚修改了删帧或速度，请先点击左侧“应用速度与删帧”，再导出 GIF。
      </p>

      {regenerateError && <p className="mt-2 text-danger animate-pulse">{regenerateError}</p>}
      {reencodeError && <p className="mt-2 text-danger animate-pulse">{reencodeError}</p>}
    </article>
  );
}
