"use client";

import { useEffect, useState } from "react";
import { putJson } from "@/lib/api";
import {
  getEpisodeLikeViewerToken,
  isEpisodeLiked,
  rememberEpisodeLiked,
} from "@/lib/episode-likes";

type EpisodeLikeResponse = {
  episodeId: string;
  liked: boolean;
  likeCount: number;
};

export function EpisodeLikeButton({
  episodeId,
  initialCount,
  variant = "default",
}: {
  episodeId: string;
  initialCount: number;
  variant?: "default" | "reader" | "shorts";
}) {
  const [liked, setLiked] = useState(false);
  const [count, setCount] = useState(initialCount);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const refresh = () => {
      setLiked(isEpisodeLiked(episodeId));
      setCount(initialCount);
      setError(null);
    };
    refresh();
  }, [episodeId, initialCount]);

  const formattedCount = new Intl.NumberFormat("ko-KR").format(count);

  async function toggle() {
    if (busy) return;
    const nextLiked = !liked;
    const previousCount = count;
    setBusy(true);
    setError(null);
    setLiked(nextLiked);
    setCount(Math.max(0, previousCount + (nextLiked ? 1 : -1)));
    try {
      const response = await putJson<
        { viewerToken: string; liked: boolean },
        EpisodeLikeResponse
      >(`/api/episodes/${encodeURIComponent(episodeId)}/like`, {
        viewerToken: getEpisodeLikeViewerToken(),
        liked: nextLiked,
      });
      setLiked(response.liked);
      setCount(response.likeCount);
      rememberEpisodeLiked(episodeId, response.liked);
    } catch {
      setLiked(!nextLiked);
      setCount(previousCount);
      setError("좋아요를 반영하지 못했어요. 다시 눌러 주세요.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className={`episode-like episode-like--${variant}`}>
      <button
        aria-label={`${liked ? "좋아요 취소" : "좋아요"} · ${formattedCount}개`}
        aria-pressed={liked}
        className={`episode-like__button${liked ? " episode-like__button--active" : ""}`}
        disabled={busy}
        onClick={toggle}
        type="button"
      >
        <span aria-hidden="true">{liked ? "♥" : "♡"}</span>
        <span>좋아요</span>
        <strong>{formattedCount}</strong>
      </button>
      {error ? (
        <small className="episode-like__error" role="status">
          {error}
        </small>
      ) : null}
    </span>
  );
}
