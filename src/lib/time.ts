import { RESULT_TTL_MS } from "@/lib/constants";

export function nowIso(): string {
  return new Date().toISOString();
}

export function computeExpiresAt(createdAtIso: string): string {
  const created = new Date(createdAtIso).getTime();
  return new Date(created + RESULT_TTL_MS).toISOString();
}

export function isExpired(expiresAtIso?: string): boolean {
  if (!expiresAtIso) return false;
  return Date.now() > new Date(expiresAtIso).getTime();
}

export function msLeft(expiresAtIso?: string): number {
  if (!expiresAtIso) return 0;
  return Math.max(new Date(expiresAtIso).getTime() - Date.now(), 0);
}

export function formatCountdown(milliseconds: number): string {
  const total = Math.floor(milliseconds / 1000);
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}
