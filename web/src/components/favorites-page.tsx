"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import {
  FAVORITES_UPDATED_EVENT,
  getFavorites,
  removeFavorite,
  type FavoriteSeries,
} from "@/lib/favorites";
import { DiscoverLink } from "./discover-link";
import {
  buildCircularRailCopies,
  prioritizeThumbnailItems,
  useCircularRail,
} from "./use-circular-rail";

function getFavoriteCardWidth(viewportWidth: number) {
  return viewportWidth <= 700
    ? Math.min(viewportWidth * 0.86, 420)
    : Math.min(Math.max(viewportWidth * 0.4, 380), 520);
}

function FavoriteCard({
  duplicate,
  eager,
  series,
}: {
  duplicate: boolean;
  eager: boolean;
  series: FavoriteSeries;
}) {
  return (
    <li
      aria-hidden={duplicate || undefined}
      className="favorite-card"
      data-preloaded={eager || undefined}
    >
      <Link
        className="favorite-card__cover"
        href={`/series/${encodeURIComponent(series.slug)}`}
        tabIndex={duplicate ? -1 : undefined}
      >
        {series.coverUrl ? (
          <Image
            alt={`${series.title} 표지`}
            height={480}
            loading={eager ? "eager" : undefined}
            sizes="(max-width: 700px) 42vw, 220px"
            src={series.coverUrl}
            width={340}
          />
        ) : (
          <span>{series.title}</span>
        )}
      </Link>
      <div className="favorite-card__content">
        <span>{series.genre}</span>
        <Link
          href={`/series/${encodeURIComponent(series.slug)}`}
          tabIndex={duplicate ? -1 : undefined}
        >
          <h2>{series.title}</h2>
        </Link>
        <p>{series.synopsis}</p>
        <small>{series.authorName} 작가</small>
        <button
          className="favorite-card__remove"
          onClick={() => removeFavorite(series.slug)}
          tabIndex={duplicate ? -1 : undefined}
          type="button"
        >
          찜 해제
        </button>
      </div>
    </li>
  );
}

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteSeries[] | null>(null);
  const favoriteItems = prioritizeThumbnailItems(
    favorites ?? [],
    (series) => Boolean(series.coverUrl),
  );
  const { loopEnabled, railRef, scroll } =
    useCircularRail<HTMLUListElement>({
      cardWidth: getFavoriteCardWidth,
      itemCount: favoriteItems.length,
    });
  const railCopies = buildCircularRailCopies(favoriteItems);

  useEffect(() => {
    const refresh = () => setFavorites(getFavorites());
    refresh();
    window.addEventListener(FAVORITES_UPDATED_EVENT, refresh);
    return () => window.removeEventListener(FAVORITES_UPDATED_EVENT, refresh);
  }, []);

  return (
    <main className="favorites-page">
      <header className="page-title">
        <p className="eyebrow">My favorites</p>
        <h1>찜 목록</h1>
        <p>이 브라우저에서 찜한 작품을 모아두었어요.</p>
        {loopEnabled ? (
          <div className="circular-rail-controls favorites-page__controls">
            <button
              aria-label="찜 목록 이전 작품 보기"
              onClick={() => scroll(-1)}
              type="button"
            >
              ←
            </button>
            <button
              aria-label="찜 목록 다음 작품 보기"
              onClick={() => scroll(1)}
              type="button"
            >
              →
            </button>
          </div>
        ) : null}
      </header>
      {favorites === null ? (
        <p className="favorites-page__loading">찜 목록을 불러오는 중…</p>
      ) : favorites.length === 0 ? (
        <section className="favorites-empty">
          <span aria-hidden="true">♡</span>
          <h2>아직 찜한 작품이 없어요</h2>
          <p>관심 있는 작품 상세에서 찜하기를 눌러보세요.</p>
          <DiscoverLink className="button button--primary">
            작품 둘러보기
          </DiscoverLink>
        </section>
      ) : (
        <ul
          aria-roledescription={
            loopEnabled ? "순환형 캐러셀" : "작품 목록"
          }
          className="circular-content-rail favorites-rail horizontal-scroll-surface"
          ref={railRef}
        >
          {railCopies.map(
            ({ copyIndex, duplicate, eager, item: series }) => (
              <FavoriteCard
                duplicate={duplicate}
                eager={eager}
                key={`${copyIndex}-${series.slug}`}
                series={series}
              />
            ),
          )}
        </ul>
      )}
      <p className="favorites-page__notice">
        로그인 기능이 없는 데모이므로 찜 목록은 현재 브라우저에 저장됩니다.
      </p>
    </main>
  );
}
