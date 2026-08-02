import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  getEpisodeLikeViewerToken,
  isEpisodeLiked,
  rememberEpisodeLiked,
} from "./episode-likes";

const generatedToken = "6cb5ef1b-dc12-4d59-9f1c-0fa42a145989";

beforeEach(() => {
  const values = new Map<string, string>();
  vi.stubGlobal("window", {});
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => values.set(key, value),
  });
  vi.stubGlobal("crypto", { randomUUID: () => generatedToken });
});

describe("episode likes browser identity", () => {
  it("creates and reuses a UUID without exposing account data", () => {
    expect(getEpisodeLikeViewerToken()).toBe(generatedToken);
    expect(getEpisodeLikeViewerToken()).toBe(generatedToken);
  });

  it("remembers the episode state independently from the aggregate", () => {
    expect(isEpisodeLiked("episode-1")).toBe(false);
    rememberEpisodeLiked("episode-1", true);
    expect(isEpisodeLiked("episode-1")).toBe(true);
    rememberEpisodeLiked("episode-1", false);
    expect(isEpisodeLiked("episode-1")).toBe(false);
  });
});
