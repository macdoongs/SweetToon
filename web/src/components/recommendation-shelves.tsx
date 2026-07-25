"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  FAVORITES_UPDATED_EVENT,
  getFavorites,
  type FavoriteSeries,
} from "@/lib/favorites";
import {
  getAllReadingProgress,
  type ReadingProgress,
} from "@/lib/reading-progress";
import {
  buildRecommendationShelves,
  type RecommendationShelf,
} from "@/lib/recommendations";
import type { SeriesSummary } from "@/lib/reader-types";

function RecommendationCard({ series }: { series: SeriesSummary }) {
  return (
    <li className="recommendation-card">
      <Link href={`/series/${encodeURIComponent(series.slug)}`}>
        <div className="recommendation-card__cover">
          {series.coverUrl ? (
            <Image
              alt={`${series.title} 표지`}
              height={560}
              sizes="(max-width: 700px) 42vw, 210px"
              src={series.coverUrl}
              width={400}
            />
          ) : (
            <span>{series.title}</span>
          )}
          <span className="recommendation-card__status">
            {series.status === "completed" ? "완결" : "연재 중"}
          </span>
        </div>
        <span className="recommendation-card__genre">{series.genre}</span>
        <strong>{series.title}</strong>
        <small>{series.author.name}</small>
      </Link>
    </li>
  );
}

function Shelf({ shelf }: { shelf: RecommendationShelf }) {
  const railId = `recommendation-${shelf.id}`;
  const scroll = (direction: -1 | 1) => {
    document.getElementById(railId)?.scrollBy({
      left: direction * 720,
      behavior: "smooth",
    });
  };

  return (
    <section
      className="recommendation-shelf"
      aria-labelledby={`${railId}-title`}
    >
      <header className="recommendation-shelf__header">
        <div>
          <p className="eyebrow">{shelf.eyebrow}</p>
          <h3 id={`${railId}-title`}>{shelf.title}</h3>
          <p>{shelf.description}</p>
        </div>
        <div className="recommendation-shelf__controls">
          <button
            aria-label={`${shelf.title} 이전 작품 보기`}
            onClick={() => scroll(-1)}
            type="button"
          >
            ←
          </button>
          <button
            aria-label={`${shelf.title} 다음 작품 보기`}
            onClick={() => scroll(1)}
            type="button"
          >
            →
          </button>
        </div>
      </header>
      <ul className="recommendation-rail" id={railId}>
        {shelf.items.map((series) => (
          <RecommendationCard key={series.id} series={series} />
        ))}
      </ul>
    </section>
  );
}

export function RecommendationShelves({
  series,
}: {
  series: SeriesSummary[];
}) {
  const [favorites, setFavorites] = useState<FavoriteSeries[]>([]);
  const [progress, setProgress] = useState<
    Record<string, ReadingProgress>
  >({});

  useEffect(() => {
    const refresh = () => {
      setFavorites(getFavorites());
      setProgress(getAllReadingProgress());
    };
    const frame = requestAnimationFrame(refresh);
    window.addEventListener(FAVORITES_UPDATED_EVENT, refresh);
    window.addEventListener("sweettoon:progress", refresh);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener(FAVORITES_UPDATED_EVENT, refresh);
      window.removeEventListener("sweettoon:progress", refresh);
    };
  }, []);

  const shelves = useMemo(
    () => buildRecommendationShelves(series, favorites, progress),
    [favorites, progress, series],
  );

  if (!shelves.length) return null;

  return (
    <section
      className="recommendations"
      aria-labelledby="recommendations-title"
    >
      <div className="recommendations__inner">
        <header className="recommendations__intro">
          <div>
            <p className="eyebrow">Picked for you</p>
            <h2 id="recommendations-title">취향을 이어갈 다음 작품</h2>
          </div>
          <p>
            찜과 최근 열람 기록을 바탕으로 추천해요.
            {!favorites.length && !Object.keys(progress).length
              ? " 아직 기록이 없어 장르별 작품부터 준비했어요."
              : ""}
          </p>
        </header>
        {shelves.map((shelf) => (
          <Shelf key={shelf.id} shelf={shelf} />
        ))}
      </div>
    </section>
  );
}
