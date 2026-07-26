import { writeLocalStorage } from "./local-storage";

const STORAGE_KEY = "sweettoon:reading-progress";
const MAX_PROGRESS_ENTRIES = 300;

export type ReadingProgress = {
  seriesSlug: string;
  episodeId: string;
  episodeNumber: number;
  episodeTitle: string;
  pageOrder: number;
  percent: number;
  completed: boolean;
  updatedAt: string;
};

type ProgressStore = Record<string, ReadingProgress>;

function readStore(): ProgressStore {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}") as ProgressStore;
  } catch {
    return {};
  }
}

export function saveReadingProgress(progress: ReadingProgress): boolean {
  const store = readStore();
  store[progress.episodeId] = progress;
  const recentStore = Object.fromEntries(
    Object.entries(store)
      .sort(
        ([, left], [, right]) =>
          Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
      )
      .slice(0, MAX_PROGRESS_ENTRIES),
  );
  if (!writeLocalStorage(STORAGE_KEY, JSON.stringify(recentStore))) {
    return false;
  }
  window.dispatchEvent(new CustomEvent("sweettoon:progress"));
  return true;
}

export function getEpisodeProgress(
  episodeId: string,
): ReadingProgress | undefined {
  return readStore()[episodeId];
}

export function getSeriesProgress(
  seriesSlug: string,
): ReadingProgress | undefined {
  return Object.values(readStore())
    .filter((progress) => progress.seriesSlug === seriesSlug)
    .sort(
      (left, right) =>
        Date.parse(right.updatedAt) - Date.parse(left.updatedAt),
    )[0];
}

export function getAllReadingProgress(): ProgressStore {
  return readStore();
}
