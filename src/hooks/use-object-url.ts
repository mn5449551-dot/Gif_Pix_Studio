"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Manages a URL created via URL.createObjectURL.
 * Returns [url, setBlob] — call setBlob(blob) to create a new URL (revoking the previous one),
 * or setBlob(null) to clear. Revokes on unmount automatically.
 */
export function useObjectUrl(): readonly [string, (blob: Blob | null | undefined) => void] {
  const [url, setUrl] = useState("");
  const urlRef = useRef("");

  const setBlob = useCallback((blob: Blob | null | undefined) => {
    const prev = urlRef.current;
    if (prev) URL.revokeObjectURL(prev);
    if (blob) {
      const next = URL.createObjectURL(blob);
      urlRef.current = next;
      setUrl(next);
    } else {
      urlRef.current = "";
      setUrl("");
    }
  }, []);

  useEffect(() => {
    return () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    };
  }, []);

  return [url, setBlob] as const;
}
