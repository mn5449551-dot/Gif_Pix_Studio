"use client";

import Link from "next/link";
import { ACTION_LABELS, DEFAULT_FPS, MAX_HISTORY } from "@/lib/constants";
import { readHistory } from "@/lib/storage";
import type { LocalHistoryItem } from "@/lib/types";

interface TaskInfoPanelProps {
  item: LocalHistoryItem;
  removedFrameIndexes: number[];
  loadingLocalSprite: boolean;
  loadingLocalGif: boolean;
}

export function TaskInfoPanel({
  item,
  removedFrameIndexes,
  loadingLocalSprite,
  loadingLocalGif,
}: TaskInfoPanelProps) {
  const remainingCapacity = Math.max(MAX_HISTORY - readHistory().length, 0);

  return (
    <article className="history-card rounded-xl border-4 border-border-dim p-3">
      <p className="pixel-label">任务状态</p>
      <div className="mt-3 space-y-2 text-base text-text-muted">
        <p>
          <span className="text-text-primary">动作:</span> {ACTION_LABELS[item.actionId]}
        </p>
        <p>
          <span className="text-text-primary">原始帧率:</span> {item.fps ?? DEFAULT_FPS} fps
        </p>
        <p>
          <span className="text-text-primary">已剔除帧:</span> {removedFrameIndexes.length}
        </p>
        <p>
          <span className="text-text-primary">创建时间:</span>{" "}
          {new Date(item.createdAt).toLocaleString()}
        </p>
        <p className={remainingCapacity > 0 ? "text-neon-lime" : "text-danger"}>
          <span className="text-text-primary">剩余容量:</span>{" "}
          {remainingCapacity > 0 ? `还可保存 ${remainingCapacity} 张` : "已满（200/200）"}
        </p>
        {(loadingLocalSprite || loadingLocalGif) && (
          <p className="text-neon-cyan animate-pulse">本地资源读取中...</p>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-2">
        <Link className="arcade-button secondary text-xs" href="/history">
          返回历史
        </Link>
      </div>
    </article>
  );
}
