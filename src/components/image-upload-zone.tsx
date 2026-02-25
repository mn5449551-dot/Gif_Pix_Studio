"use client";

import { type DragEvent } from "react";
import { AssetImage } from "@/components/asset-image";

interface ImageUploadZoneProps {
  imageDataUrl: string;
  generating: boolean;
  status: string;
  progress: number;
  onPickFile: (file: File | null) => void;
  onClearImage: () => void;
}

export function ImageUploadZone({
  imageDataUrl,
  generating,
  status,
  progress,
  onPickFile,
  onClearImage,
}: ImageUploadZoneProps) {
  function handleDragOver(event: DragEvent<HTMLElement>) {
    event.preventDefault();
  }

  function handleDrop(event: DragEvent<HTMLElement>) {
    event.preventDefault();
    if (generating) return;
    onPickFile(event.dataTransfer.files?.[0] ?? null);
  }

  return (
    <label
      className={`upload-dropzone relative block h-[clamp(300px,58vh,420px)] min-h-[300px] w-full overflow-hidden ${
        generating ? "cursor-not-allowed" : "cursor-pointer"
      }`}
      onDragOver={handleDragOver}
      onDragLeave={(e) => e.preventDefault()}
      onDrop={handleDrop}
      aria-busy={generating}
    >
      <input
        type="file"
        className={`absolute inset-0 h-full w-full opacity-0 ${
          generating ? "cursor-not-allowed" : "cursor-pointer"
        }`}
        accept="image/png,image/jpeg,image/webp"
        disabled={generating}
        onChange={(event) => {
          if (generating) return;
          onPickFile(event.target.files?.[0] ?? null);
        }}
      />

      {imageDataUrl ? (
        <div className="relative h-full w-full p-4">
          <div className="photo-frame h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imageDataUrl}
              alt="preview"
              className="h-full w-full object-contain pixelated"
            />
          </div>
          <button
            type="button"
            className="absolute right-6 top-6 rounded-md bg-white/85 p-1 transition hover:scale-105"
            aria-label="清除已上传图片"
            onClick={(event) => {
              event.preventDefault();
              onClearImage();
            }}
          >
            <AssetImage
              src="/assets/icons/btn-close.png"
              alt="Close"
              className="h-6 w-6 pixelated hover:scale-110 transition-transform"
              fallbackClassName="asset-fallback-sm"
            />
          </button>
        </div>
      ) : (
        <div className="upload-inner-dashed m-4 flex h-[calc(100%-2rem)] flex-col items-center justify-center px-4 text-center text-text-muted">
          <AssetImage
            src="/assets/icons/upload-cloud.png"
            alt="Upload"
            className="mb-4 h-16 w-16 pixelated mx-auto"
            fallbackClassName="asset-fallback-md"
          />
          <p className="text-xl text-text-primary">拖拽图片到这里，或者点击唤醒我</p>
          <p className="mt-2 text-base">支持 png / jpg / webp</p>
        </div>
      )}

      {generating && (
        <div className="paper-overlay generate-overlay p-6">
          <div className="generate-status-card w-full max-w-sm space-y-4 text-center" aria-live="polite">
            <AssetImage
              src="/assets/icons/loading-potion.png"
              alt="Loading"
              className="w-16 h-16 pixelated animate-bounce mx-auto mb-2"
              fallbackClassName="asset-fallback-md"
            />
            <p className="text-xl text-text-primary">{status}</p>
            <div className="loading-meter">
              <span style={{ width: `${progress}%` }} />
            </div>
            <p className="generate-progress-text text-base text-text-muted">{progress}%</p>
          </div>
        </div>
      )}
    </label>
  );
}
