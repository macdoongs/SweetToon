"use client";

export type SecurityAccessKind = "studio" | "operations";

function storageKey(kind: SecurityAccessKind): string {
  return `sweettoon:${kind}-access-key`;
}

export function loadSecurityAccessKey(kind: SecurityAccessKind): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(storageKey(kind)) ?? "";
}

export function saveSecurityAccessKey(
  kind: SecurityAccessKind,
  value: string,
): void {
  if (typeof window === "undefined") return;
  const normalized = value.trim();
  if (normalized) {
    window.sessionStorage.setItem(storageKey(kind), normalized);
  } else {
    window.sessionStorage.removeItem(storageKey(kind));
  }
}
