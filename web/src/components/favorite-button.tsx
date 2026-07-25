"use client";

import { useEffect, useState } from "react";
import {
  FAVORITES_UPDATED_EVENT,
  isFavorite,
  toggleFavorite,
  type FavoriteSeries,
} from "@/lib/favorites";

export function FavoriteButton({
  series,
}: {
  series: Omit<FavoriteSeries, "addedAt">;
}) {
  const [favorite, setFavorite] = useState(false);

  useEffect(() => {
    const refresh = () => setFavorite(isFavorite(series.slug));
    refresh();
    window.addEventListener(FAVORITES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, refresh);
  }, [series.slug]);

  return (
    <button
      aria-pressed={favorite}
      className={`button favorite-button${favorite ? " favorite-button--active" : ""}`}
      onClick={() => setFavorite(toggleFavorite(series))}
      type="button"
    >
      <span aria-hidden="true">{favorite ? "♥" : "♡"}</span>
      {favorite ? "찜 해제" : "찜하기"}
    </button>
  );
}
