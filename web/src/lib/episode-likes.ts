"use client";

import { writeLocalStorage } from "./local-storage";

const VIEWER_TOKEN_KEY = "sweettoon:episode-like-viewer";
const LIKED_EPISODES_KEY = "sweettoon:episode-likes";
const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

let volatileViewerToken: string | null = null;
const volatileLikedEpisodes = new Set<string>();

export function getEpisodeLikeViewerToken(): string {
  const stored = localStorage.getItem(VIEWER_TOKEN_KEY);
  if (stored && UUID_PATTERN.test(stored)) return stored;
  if (!volatileViewerToken) volatileViewerToken = crypto.randomUUID();
  writeLocalStorage(VIEWER_TOKEN_KEY, volatileViewerToken);
  return volatileViewerToken;
}

function readLikedEpisodes(): Set<string> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(LIKED_EPISODES_KEY) ?? "[]",
    );
    if (!Array.isArray(parsed)) return new Set(volatileLikedEpisodes);
    return new Set([
      ...volatileLikedEpisodes,
      ...parsed.filter((item): item is string => typeof item === "string"),
    ]);
  } catch {
    return new Set(volatileLikedEpisodes);
  }
}

export function isEpisodeLiked(episodeId: string): boolean {
  return readLikedEpisodes().has(episodeId);
}

export function rememberEpisodeLiked(episodeId: string, liked: boolean): void {
  const episodes = readLikedEpisodes();
  if (liked) {
    episodes.add(episodeId);
    volatileLikedEpisodes.add(episodeId);
  } else {
    episodes.delete(episodeId);
    volatileLikedEpisodes.delete(episodeId);
  }
  writeLocalStorage(LIKED_EPISODES_KEY, JSON.stringify([...episodes]));
}
