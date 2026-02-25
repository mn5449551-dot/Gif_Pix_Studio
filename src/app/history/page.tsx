"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { AssetImage } from "@/components/asset-image";
import { ACTION_LABELS, DEFAULT_FPS } from "@/lib/constants";
import { clearGifCache, deleteTaskCache, getGifBlob } from "@/lib/gif-cache";
import { clearHistory, readHistory, removeHistoryItem, saveHistory } from "@/lib/storage";
import type { LocalHistoryItem, LocalTaskStatus } from "@/lib/types";

type FilterType = "all" | "succeeded" | "running" | "failed";

const FILTER_OPTIONS: Array<{ value: FilterType; label: string }> = [
  { value: "all", label: "全部" },
  { value: "succeeded", label: "成功" },
  { value: "running", label: "运行中" },
  { value: "failed", label: "失败" },
];

const STATUS_CLASS: Record<LocalTaskStatus, string> = {
  succeeded: "cyber-chip ok",
  failed: "cyber-chip fail",
  expired: "cyber-chip ok",
  queued: "cyber-chip muted",
  running: "cyber-chip muted",
};

export default function HistoryPage() {
  const [items, setItems] = useState<LocalHistoryItem[]>([]);
  const [filter, setFilter] = useState<FilterType>("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [notice, setNotice] = useState("");
  const [gifPreviewUrls, setGifPreviewUrls] = useState<Record<string, string>>({});
  const previewRef = useRef<Record<string, string>>({});

  useEffect(() => {
    setItems(readHistory());
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return items;
    return items.filter((item) => {
      const status = item.status === "expired" ? "succeeded" : item.status;
      return status === filter;
    });
  }, [filter, items]);
  const filterCounts = useMemo(() => {
    const counts: Record<FilterType, number> = {
      all: items.length,
      succeeded: 0,
      running: 0,
      failed: 0,
    };
    for (const item of items) {
      const status = item.status === "expired" ? "succeeded" : item.status;
      if (status in counts) {
        counts[status as Exclude<FilterType, "all">] += 1;
      }
    }
    return counts;
  }, [items]);

  useEffect(() => {
    let active = true;
    async function loadPreviews() {
      const next: Record<string, string> = {};
      const createdUrls: string[] = [];
      const succeededItems = items.filter((item) => item.status === "succeeded" || item.status === "expired");

      await Promise.all(
        succeededItems.map(async (item) => {
          try {
            const gifBlob = await getGifBlob(item.id);
            if (!gifBlob) return;
            const objectUrl = URL.createObjectURL(gifBlob);
            next[item.id] = objectUrl;
            createdUrls.push(objectUrl);
          } catch {
            // Ignore preview loading errors and fallback to text-only card.
          }
        }),
      );

      if (!active) {
        for (const url of createdUrls) URL.revokeObjectURL(url);
        return;
      }

      for (const url of Object.values(previewRef.current)) {
        URL.revokeObjectURL(url);
      }
      previewRef.current = next;
      setGifPreviewUrls(next);
    }

    void loadPreviews();

    return () => {
      active = false;
    };
  }, [items]);

  useEffect(() => {
    return () => {
      for (const url of Object.values(previewRef.current)) {
        URL.revokeObjectURL(url);
      }
    };
  }, []);

  async function handleClear() {
    const confirmed = window.confirm("确认清空全部历史记录和本地缓存吗？此操作不可恢复。");
    if (!confirmed) return;
    setNotice("");
    try {
      await clearGifCache();
      clearHistory();
      setItems([]);
      setNotice("已清空全部历史与本地缓存。");
    } catch (error) {
      setNotice(error instanceof Error ? `清空失败：${error.message}` : "清空失败，请稍后重试。");
    }
  }

  async function handleDeleteOne(item: LocalHistoryItem) {
    const confirmed = window.confirm("确认删除这条历史记录吗？此操作不可恢复。");
    if (!confirmed) return;
    setNotice("");
    setDeletingId(item.id);
    try {
      await deleteTaskCache(item.id);
      const next = removeHistoryItem(item.id);
      setItems(next);
      setNotice("已删除该条历史记录。");
    } catch (error) {
      setNotice(error instanceof Error ? `删除失败：${error.message}` : "删除失败，请稍后重试。");
    } finally {
      setDeletingId(null);
    }
  }

  async function handlePruneFailedOnly() {
    const targets = items.filter((item) => item.status === "failed");
    if (!targets.length) {
      setNotice("没有可清理的失败记录。");
      return;
    }
    const confirmed = window.confirm(`确认清理 ${targets.length} 条失败记录吗？`);
    if (!confirmed) return;

    setNotice("");
    setDeletingId("bulk");
    let cacheErrorCount = 0;
    try {
      for (const target of targets) {
        try {
          await deleteTaskCache(target.id);
        } catch {
          cacheErrorCount += 1;
        }
      }
      const targetIdSet = new Set(targets.map((target) => target.id));
      const next = readHistory().filter((item) => !targetIdSet.has(item.id));
      saveHistory(next);
      setItems(next);
      setNotice(
        cacheErrorCount
          ? `已清理 ${targets.length} 条记录（${cacheErrorCount} 条缓存删除失败，可稍后清空全部历史）。`
          : `已清理 ${targets.length} 条失败记录。`,
      );
    } catch (error) {
      setNotice(error instanceof Error ? `批量清理失败：${error.message}` : "批量清理失败。");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <section className="space-y-6 fade-in-up">
      <div className="cute-panel">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="pixel-title text-sm md:text-base">历史记录</p>
            <p className="text-lg text-text-muted">本地最多保留 200 条。成功记录支持本地 GIF 预览与长期保存。</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              className="arcade-button warm"
              onClick={() => void handlePruneFailedOnly()}
              disabled={deletingId === "bulk"}
            >
              {deletingId === "bulk" ? "清理中..." : "清理失败"}
            </button>
            <button className="arcade-button danger" onClick={() => void handleClear()}>
              清空历史
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          {FILTER_OPTIONS.map((option) => (
            <button
              key={option.value}
              className={`arcade-button py-2 text-xs ${filter === option.value ? "" : "secondary"}`}
              onClick={() => setFilter(option.value)}
            >
              {option.label}
              <span className="ml-1 opacity-75">{filterCounts[option.value]}</span>
            </button>
          ))}
        </div>
        {notice && <p className="mt-3 text-base text-neon-cyan">{notice}</p>}
      </div>

      {filtered.length === 0 ? (
        <div className="cute-panel p-8 text-center">
          <AssetImage
            src="/assets/illustrations/empty-sleeping-cat.png"
            alt="Empty"
            className="w-32 h-32 pixelated mx-auto mb-4 opacity-80"
            fallbackClassName="asset-fallback-lg"
          />
          <p className="pixel-title text-sm">暂无记录</p>
          <p className="mt-2 text-xl text-text-muted">空空如也，快去制作可爱的表情包吧喵~</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((item) => {
            const displayStatus = item.status === "expired" ? "succeeded" : item.status;
            const previewUrl = gifPreviewUrls[item.id];
            const hasPreview = Boolean(previewUrl);

            return (
              <article
                key={item.id}
                className="cute-panel history-card p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <p className="pixel-title text-xs">{ACTION_LABELS[item.actionId]}</p>
                    <p className="mt-1 text-base text-text-muted">
                      {new Date(item.createdAt).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={STATUS_CLASS[displayStatus]}>{displayStatus}</span>
                  </div>
                </div>

                {(displayStatus === "succeeded" || previewUrl) && (
                  <div className="mt-3 h-32 w-full overflow-hidden rounded-[6px] border-[3px] border-border-dim bg-white">
                    {previewUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl}
                        alt="历史 GIF 预览"
                        className="h-full w-full object-contain pixelated"
                      />
                    ) : (
                      <p className="grid h-full place-items-center text-base text-text-muted">
                        GIF 预览加载中...
                      </p>
                    )}
                  </div>
                )}

                <p className="mt-3 line-clamp-2 text-lg text-text-primary">
                  {item.prompt || "(无自定义文本)"}
                </p>

                <div className="mt-4 flex flex-wrap gap-4 text-base text-text-muted">
                  <span>
                    帧率: <span className="text-text-primary">{item.fps ?? DEFAULT_FPS} fps</span>
                  </span>
                  <span>
                    本地 GIF:{" "}
                    <span className={hasPreview ? "text-neon-lime" : "text-text-muted"}>
                      {hasPreview ? "已缓存" : "未找到缓存"}
                    </span>
                  </span>
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <Link
                    className="arcade-button primary flex-1 min-w-[100px] justify-center text-xs"
                    href={`/result/${item.id}`}
                  >
                    查看结果
                  </Link>
                  <Link
                    className="arcade-button secondary flex-1 min-w-[100px] justify-center text-xs"
                    href={`/create?actionId=${item.actionId}&prompt=${encodeURIComponent(item.prompt)}`}
                  >
                    复用参数
                  </Link>
                  <button
                    className="arcade-button danger flex-1 min-w-[100px] justify-center text-xs"
                    onClick={() => void handleDeleteOne(item)}
                    disabled={deletingId === item.id || deletingId === "bulk"}
                  >
                    {deletingId === item.id ? "删除中..." : "删除记录"}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
