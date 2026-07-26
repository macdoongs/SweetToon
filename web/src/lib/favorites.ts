"use client";

import { writeLocalStorage } from "./local-storage";

const STORAGE_KEY = "sweettoon:favorites";
export const FAVORITES_UPDATED_EVENT = "sweettoon:favorites-updated";

export type FavoriteSeries = {
  slug: string;
  title: string;
  synopsis: string;
  genre: string;
  coverUrl: string | null;
  authorName: string;
  addedAt: string;
};

function isFavoriteSeries(value: unknown): value is FavoriteSeries {
  if (!value || typeof value !== "object") return false;
  const item = value as Record<string, unknown>;
  return (
    typeof item.slug === "string" &&
    typeof item.title === "string" &&
    typeof item.synopsis === "string" &&
    typeof item.genre === "string" &&
    (typeof item.coverUrl === "string" || item.coverUrl === null) &&
    typeof item.authorName === "string" &&
    typeof item.addedAt === "string"
  );
}

export function getFavorites(): FavoriteSeries[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return [];
    const parsed: unknown = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed.filter(isFavoriteSeries) : [];
  } catch {
    return [];
  }
}

export function isFavorite(slug: string): boolean {
  return getFavorites().some((item) => item.slug === slug);
}

export function toggleFavorite(
  series: Omit<FavoriteSeries, "addedAt">,
): boolean {
  const favorites = getFavorites();
  const existing = favorites.some((item) => item.slug === series.slug);
  const next = existing
    ? favorites.filter((item) => item.slug !== series.slug)
    : [{ ...series, addedAt: new Date().toISOString() }, ...favorites];
  if (!writeLocalStorage(STORAGE_KEY, JSON.stringify(next))) {
    return existing;
  }
  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
  return !existing;
}

export function removeFavorite(slug: string): boolean {
  const next = getFavorites().filter((item) => item.slug !== slug);
  if (!writeLocalStorage(STORAGE_KEY, JSON.stringify(next))) {
    return false;
  }
  window.dispatchEvent(new Event(FAVORITES_UPDATED_EVENT));
  return true;
}
