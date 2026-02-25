import {
  DEFAULT_FPS,
  DEFAULT_SETTINGS,
  HISTORY_KEY,
  MAX_HISTORY,
  PENDING_TASK_STALE_MS,
  PET_CHAT_HISTORY_KEY,
  PET_PROFILE_KEY,
  SETTINGS_KEY_V1,
  SETTINGS_KEY,
  SPRITE_FRAME_COUNT,
} from "@/lib/constants";
import { normalizeFrameIndexes } from "@/lib/image-processing";
import type { LocalHistoryItem, LocalSettings } from "@/lib/types";

function hasWindow(): boolean {
  return typeof window !== "undefined";
}

/**
 * Sort items by createdAt in descending order (newest first)
 */
function sortByCreatedAt<T extends { createdAt: string }>(items: T[]): T[] {
  return [...items].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt));
}

export class StorageQuotaError extends Error {
  constructor(message = "存储空间已满，请清理浏览器数据后重试") {
    super(message);
    this.name = "StorageQuotaError";
  }
}

function isQuotaExceededError(error: unknown): boolean {
  if (!error) return false;
  if (error instanceof DOMException) {
    return error.name === "QuotaExceededError" || error.code === 22 || error.code === 1014;
  }
  const message = String(error);
  return message.includes("quota") || message.includes("storage") || message.includes("exceeded");
}

function safeSetItem(key: string, value: string): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.setItem(key, value);
  } catch (error) {
    if (isQuotaExceededError(error)) {
      throw new StorageQuotaError(`存储空间已满，无法保存 ${key}`);
    }
    throw error;
  }
}

function safeParse<T>(raw: string | null, fallback: T, context?: string): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[storage] JSON parse error${context ? ` (${context})` : ""}:`, error);
    }
    return fallback;
  }
}

function normalizeSettingsInput(input: Partial<LocalSettings>): LocalSettings {
  return {
    ...DEFAULT_SETTINGS,
    ...input,
    trustedLlmHosts: Array.isArray(input.trustedLlmHosts)
      ? input.trustedLlmHosts
      : DEFAULT_SETTINGS.trustedLlmHosts,
  };
}

function normalizeHistory(item: LocalHistoryItem): LocalHistoryItem {
  const normalizedFps = Number.isFinite(item.fps) ? Number(item.fps) : DEFAULT_FPS;
  const normalizedRemovedFrameIndexes = Array.isArray(item.removedFrameIndexes)
    ? normalizeFrameIndexes(item.removedFrameIndexes.map(Number), SPRITE_FRAME_COUNT)
    : [];
  const updatedMs = Number.isFinite(new Date(item.updatedAt).getTime())
    ? new Date(item.updatedAt).getTime()
    : new Date(item.createdAt).getTime();
  const pendingStale = Date.now() - updatedMs > PENDING_TASK_STALE_MS;

  const base = {
    ...item,
    fps: normalizedFps,
    removedFrameIndexes: normalizedRemovedFrameIndexes,
  };

  if (pendingStale && item.status === "queued" && !item.providerTaskId) {
    return { ...base, status: "failed", error: item.error || "任务已取消（启动前中断）", failureReason: item.failureReason || "cancelled_before_submit" };
  }

  if (pendingStale && (item.status === "queued" || item.status === "running")) {
    return { ...base, status: "failed", error: item.error || "任务超时或中断，已自动归档为失败", failureReason: item.failureReason || "pending_timeout" };
  }

  if (item.status === "expired") {
    return { ...base, status: "succeeded" };
  }

  return base;
}

export function readSettings(): LocalSettings {
  if (!hasWindow()) return DEFAULT_SETTINGS;
  const v2Raw = window.localStorage.getItem(SETTINGS_KEY);
  if (v2Raw) {
    const parsed = safeParse<Partial<LocalSettings>>(v2Raw, {}, "readSettings.v2");
    return normalizeSettingsInput(parsed);
  }

  // v1 compatibility: migrate legacy settings object into v2 shape.
  const v1 = safeParse<Partial<LocalSettings>>(
    window.localStorage.getItem(SETTINGS_KEY_V1),
    {},
    "readSettings.v1",
  );
  const merged = normalizeSettingsInput(v1);
  safeSetItem(SETTINGS_KEY, JSON.stringify(merged));
  return merged;
}

export function saveSettings(settings: LocalSettings): void {
  if (!hasWindow()) return;
  const merged = normalizeSettingsInput(settings);
  safeSetItem(SETTINGS_KEY, JSON.stringify(merged));
}

export function readHistory(): LocalHistoryItem[] {
  if (!hasWindow()) return [];
  const parsed = safeParse<LocalHistoryItem[]>(window.localStorage.getItem(HISTORY_KEY), [], "readHistory");
  const normalized = parsed.map(normalizeHistory);
  const changed = JSON.stringify(parsed) !== JSON.stringify(normalized);
  if (changed) {
    safeSetItem(HISTORY_KEY, JSON.stringify(normalized));
  }
  return sortByCreatedAt(normalized);
}

export function saveHistory(items: LocalHistoryItem[]): void {
  if (!hasWindow()) return;
  const sorted = sortByCreatedAt(items.map(normalizeHistory)).slice(0, MAX_HISTORY);
  safeSetItem(HISTORY_KEY, JSON.stringify(sorted));
}

export function upsertHistoryItem(item: LocalHistoryItem): LocalHistoryItem[] {
  const current = readHistory();
  const index = current.findIndex((it) => it.id === item.id);
  if (index === -1) {
    current.push(item);
  } else {
    current[index] = item;
  }
  saveHistory(current);
  return readHistory();
}

export function getHistoryItem(id: string): LocalHistoryItem | undefined {
  return readHistory().find((item) => item.id === id);
}

export function removeHistoryItem(id: string): LocalHistoryItem[] {
  const next = readHistory().filter((item) => item.id !== id);
  saveHistory(next);
  return next;
}

export function clearHistory(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[storage] Failed to clear history:", error);
    }
  }
}

export function clearAllLocalData(): void {
  if (!hasWindow()) return;
  try {
    window.localStorage.removeItem(HISTORY_KEY);
    window.localStorage.removeItem(SETTINGS_KEY);
    window.localStorage.removeItem(SETTINGS_KEY_V1);
    window.localStorage.removeItem(PET_CHAT_HISTORY_KEY);
    window.localStorage.removeItem(PET_PROFILE_KEY);
  } catch (error) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[storage] Failed to clear all local data:", error);
    }
  }
}
