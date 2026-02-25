"use client";

import { useSyncExternalStore, useState } from "react";
import { DEFAULT_SETTINGS } from "@/lib/constants";
import { readSettings, saveSettings } from "@/lib/storage";
import type { LocalSettings } from "@/lib/types";

// Stable no-op subscriber.
function subscribeToNothing(): () => void {
  return () => {};
}

export function useSettings() {
  // useSyncExternalStore correctly handles SSR/hydration: server gets false, client gets true.
  const isClient = useSyncExternalStore(subscribeToNothing, () => true, () => false);

  // Lazy initializer reads from localStorage on the client; returns defaults for SSR.
  const [settings, setSettings] = useState<LocalSettings>(() => {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    return readSettings();
  });

  function persistSettings(next: LocalSettings) {
    saveSettings(next);
    setSettings(next);
  }

  return { settings, setSettings, persistSettings, isClient };
}
