import { SPRITE_FRAME_COUNT } from "@/lib/constants";
import { normalizeFrameIndexes } from "@/lib/image-processing";

interface GifCacheRecord {
  id: string;
  blob: Blob;
  updatedAt: string;
}

const DB_NAME = "gifwechat-cache";
const STORE_NAME = "gifs";
const DB_VERSION = 1;
const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 100;

function isRetryableError(error: unknown): boolean {
  if (!error) return false;
  const message = error instanceof Error ? error.message : String(error);
  // Retry on timeout, transient, or quota-related errors that might resolve
  return (
    message.includes("timeout") ||
    message.includes("transient") ||
    message.includes("busy") ||
    message.includes("locked") ||
    message.includes("interrupted")
  );
}

async function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withIndexedDBRetry<T>(
  operation: () => Promise<T>,
  operationName: string,
): Promise<T> {
  let lastError: unknown;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      return await operation();
    } catch (error) {
      lastError = error;
      const isRetryable = isRetryableError(error);
      const isLastAttempt = attempt === MAX_RETRIES;

      if (!isRetryable || isLastAttempt) {
        throw error;
      }

      if (process.env.NODE_ENV !== "production") {
        console.warn(`[gif-cache] ${operationName} failed (attempt ${attempt}/${MAX_RETRIES}), retrying...`, error);
      }

      await delay(RETRY_DELAY_MS * attempt); // Exponential backoff
    }
  }

  throw lastError;
}

export interface StorageQuota {
  quota: number;
  usage: number;
  remaining: number;
}

export async function checkStorageQuota(): Promise<StorageQuota | null> {
  if (typeof navigator === "undefined" || !("storage" in navigator)) {
    return null;
  }
  try {
    const estimate = await navigator.storage.estimate();
    const quota = estimate.quota ?? 0;
    const usage = estimate.usage ?? 0;
    return {
      quota,
      usage,
      remaining: Math.max(0, quota - usage),
    };
  } catch {
    return null;
  }
}

export async function hasEnoughStorage(bytesNeeded: number): Promise<boolean> {
  const quota = await checkStorageQuota();
  if (!quota) return true; // Assume sufficient if we can't check
  return quota.remaining >= bytesNeeded;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      // Handle version downgrade scenario
      if (db.version > DB_VERSION) {
        db.close();
        // Clear the database and reopen with current version
        const deleteRequest = indexedDB.deleteDatabase(DB_NAME);
        deleteRequest.onsuccess = () => {
          // Recursively reopen with the correct version
          openDb().then(resolve).catch(reject);
        };
        deleteRequest.onerror = () => {
          reject(new Error(`Failed to downgrade IndexedDB from version ${db.version} to ${DB_VERSION}`));
        };
        return;
      }
      resolve(db);
    };

    request.onerror = () => {
      const error = request.error ?? new Error(`IndexedDB open error (version ${DB_VERSION})`);
      reject(error);
    };

    request.onblocked = () => {
      reject(new Error("IndexedDB open blocked - close other tabs using this app"));
    };
  });
}

export async function putGifBlob(id: string, blob: Blob): Promise<void> {
  await withIndexedDBRetry(() => putBlobById(`gif:${id}`, blob), `putGifBlob(${id})`);
}

export async function getGifBlob(id: string): Promise<Blob | undefined> {
  return withIndexedDBRetry(() => getBlobById(`gif:${id}`), `getGifBlob(${id})`);
}

function hashRemovedFrameIndexes(indexes: number[]): string {
  const normalized = normalizeFrameIndexes(indexes, SPRITE_FRAME_COUNT);
  if (!normalized.length) return "none";
  return normalized.join("-");
}

function getEditedGifCacheId(id: string, fps: number, removedFrameIndexes: number[]): string {
  return `gif-edited:${id}:fps:${fps}:removed:${hashRemovedFrameIndexes(removedFrameIndexes)}`;
}

function getExportedGifCacheId(
  id: string,
  fps: number,
  removedFrameIndexes: number[],
  size: "original" | number,
): string {
  return `gif-exported:${id}:fps:${fps}:removed:${hashRemovedFrameIndexes(removedFrameIndexes)}:size:${size}`;
}

export async function putEditedGifBlob(
  id: string,
  fps: number,
  removedFrameIndexes: number[],
  blob: Blob,
): Promise<void> {
  const cacheId = getEditedGifCacheId(id, fps, removedFrameIndexes);
  await withIndexedDBRetry(() => putBlobById(cacheId, blob), `putEditedGifBlob(${id})`);
}

export async function getEditedGifBlob(
  id: string,
  fps: number,
  removedFrameIndexes: number[],
): Promise<Blob | undefined> {
  const cacheId = getEditedGifCacheId(id, fps, removedFrameIndexes);
  return withIndexedDBRetry(() => getBlobById(cacheId), `getEditedGifBlob(${id})`);
}

export async function putExportedGifBlob(
  id: string,
  fps: number,
  removedFrameIndexes: number[],
  size: "original" | number,
  blob: Blob,
): Promise<void> {
  const cacheId = getExportedGifCacheId(id, fps, removedFrameIndexes, size);
  await withIndexedDBRetry(() => putBlobById(cacheId, blob), `putExportedGifBlob(${id})`);
}

export async function getExportedGifBlob(
  id: string,
  fps: number,
  removedFrameIndexes: number[],
  size: "original" | number,
): Promise<Blob | undefined> {
  const cacheId = getExportedGifCacheId(id, fps, removedFrameIndexes, size);
  return withIndexedDBRetry(() => getBlobById(cacheId), `getExportedGifBlob(${id})`);
}

export async function putSpriteBlob(id: string, blob: Blob): Promise<void> {
  await withIndexedDBRetry(() => putBlobById(`sprite:${id}`, blob), `putSpriteBlob(${id})`);
}

export async function getSpriteBlob(id: string): Promise<Blob | undefined> {
  return withIndexedDBRetry(() => getBlobById(`sprite:${id}`), `getSpriteBlob(${id})`);
}

export async function putSourceBlob(id: string, blob: Blob): Promise<void> {
  await withIndexedDBRetry(() => putBlobById(`source:${id}`, blob), `putSourceBlob(${id})`);
}

export async function getSourceBlob(id: string): Promise<Blob | undefined> {
  return withIndexedDBRetry(() => getBlobById(`source:${id}`), `getSourceBlob(${id})`);
}

async function putBlobById(id: string, blob: Blob): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const payload: GifCacheRecord = { id, blob, updatedAt: new Date().toISOString() };
      const request = store.put(payload);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error(`IndexedDB put error for key: ${id}`));
      tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB write error for key: ${id}`));
      tx.onabort = () => reject(new Error(`IndexedDB transaction aborted for key: ${id}`));
    });
  } finally {
    db.close();
  }
}

async function getBlobById(id: string): Promise<Blob | undefined> {
  const db = await openDb();
  try {
    const blob = await new Promise<Blob | undefined>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readonly");
      const store = tx.objectStore(STORE_NAME);
      const request = store.get(id);
      request.onsuccess = () => {
        const record = request.result as GifCacheRecord | undefined;
        resolve(record?.blob);
      };
      request.onerror = () => reject(request.error ?? new Error(`IndexedDB read error for key: ${id}`));
      tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB read transaction error for key: ${id}`));
    });
    return blob;
  } finally {
    db.close();
  }
}

export async function deleteGifBlob(id: string): Promise<void> {
  await withIndexedDBRetry(() => deleteBlobById(`gif:${id}`), `deleteGifBlob(${id})`);
}

export async function deleteSpriteBlob(id: string): Promise<void> {
  await withIndexedDBRetry(() => deleteBlobById(`sprite:${id}`), `deleteSpriteBlob(${id})`);
}

export async function deleteSourceBlob(id: string): Promise<void> {
  await withIndexedDBRetry(() => deleteBlobById(`source:${id}`), `deleteSourceBlob(${id})`);
}

async function deleteBlobById(id: string): Promise<void> {
  const db = await openDb();
  try {
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      const store = tx.objectStore(STORE_NAME);
      const request = store.delete(id);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error ?? new Error(`IndexedDB delete error for key: ${id}`));
      tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB delete transaction error for key: ${id}`));
      tx.onabort = () => reject(new Error(`IndexedDB delete transaction aborted for key: ${id}`));
    });
  } finally {
    db.close();
  }
}

export async function clearGifCache(): Promise<void> {
  await withIndexedDBRetry(async () => {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const request = tx.objectStore(STORE_NAME).clear();
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error ?? new Error("IndexedDB clear request error"));
        tx.onerror = () => reject(tx.error ?? new Error("IndexedDB clear transaction error"));
        tx.onabort = () => reject(new Error("IndexedDB clear transaction aborted"));
      });
    } finally {
      db.close();
    }
  }, "clearGifCache");
}

export async function deleteTaskCache(id: string): Promise<void> {
  await withIndexedDBRetry(async () => {
    const db = await openDb();
    try {
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        store.delete(`gif:${id}`);
        store.delete(`sprite:${id}`);
        store.delete(`source:${id}`);

        const request = store.openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) {
            // Cursor iteration finished, transaction can complete
            return;
          }
          const key = String(cursor.key);
          if (
            key.startsWith(`gif-edited:${id}:`) ||
            key.startsWith(`gif-exported:${id}:`)
          ) {
            cursor.delete();
          }
          cursor.continue();
        };
        request.onerror = () => {
          const error = request.error ?? new Error(`IndexedDB cursor error while deleting task ${id}`);
          reject(error);
        };
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error ?? new Error(`IndexedDB delete task cache error for ${id}`));
        tx.onabort = () => reject(new Error(`IndexedDB transaction aborted while deleting task ${id}`));
      });
    } finally {
      db.close();
    }
  }, `deleteTaskCache(${id})`);
}
