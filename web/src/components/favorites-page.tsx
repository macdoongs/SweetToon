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

export function FavoritesPage() {
  const [favorites, setFavorites] = useState<FavoriteSeries[] | null>(null);

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
      </header>
      {favorites === null ? (
        <p className="favorites-page__loading">찜 목록을 불러오는 중…</p>
      ) : favorites.length === 0 ? (
        <section className="favorites-empty">
          <span aria-hidden="true">♡</span>
          <h2>아직 찜한 작품이 없어요</h2>
          <p>관심 있는 작품 상세에서 찜하기를 눌러보세요.</p>
          <Link className="button button--primary" href="/#discover">
            작품 둘러보기
          </Link>
        </section>
      ) : (
        <ul className="favorites-grid">
          {favorites.map((series) => (
            <li className="favorite-card" key={series.slug}>
              <Link
                className="favorite-card__cover"
                href={`/series/${encodeURIComponent(series.slug)}`}
              >
                {series.coverUrl ? (
                  <Image
                    alt={`${series.title} 표지`}
                    height={480}
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
                <Link href={`/series/${encodeURIComponent(series.slug)}`}>
                  <h2>{series.title}</h2>
                </Link>
                <p>{series.synopsis}</p>
                <small>{series.authorName} 작가</small>
                <button
                  className="favorite-card__remove"
                  onClick={() => removeFavorite(series.slug)}
                  type="button"
                >
                  찜 해제
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
      <p className="favorites-page__notice">
        로그인 기능이 없는 데모이므로 찜 목록은 현재 브라우저에 저장됩니다.
      </p>
    </main>
  );
}
