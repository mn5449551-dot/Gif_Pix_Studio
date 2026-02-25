"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { usePetEvent } from "@/lib/pet/pet-events";

const PENDING_FILL_TTL_MS = 2 * 60 * 1000;

export function PetRouterBridge() {
  const pathname = usePathname();
  const router = useRouter();
  const { pendingPromptFill, consumePendingPromptFill } = usePetEvent();

  useEffect(() => {
    if (!pendingPromptFill) return;
    if (Date.now() - pendingPromptFill.createdAt > PENDING_FILL_TTL_MS) {
      consumePendingPromptFill(pendingPromptFill.id);
      return;
    }
    if (pathname !== "/create") {
      router.push("/create");
    }
  }, [consumePendingPromptFill, pathname, pendingPromptFill, router]);

  return null;
}

