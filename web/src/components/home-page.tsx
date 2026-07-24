"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getJson } from "@/lib/api";
import type { SeriesListResponse, SeriesSummary } from "@/lib/reader-types";
import { ErrorState, LoadingCards } from "./reader-states";

const statusLabel = {
  ongoing: "연재 중",
  completed: "완결",
} as const;

function SeriesCover({
  series,
  priority = false,
}: {
  series: SeriesSummary;
  priority?: boolean;
}) {
  return series.coverUrl ? (
    <Image
      alt={`${series.title} 표지`}
      className="series-cover"
      height={840}
      priority={priority}
      src={series.coverUrl}
      unoptimized
      width={600}
    />
  ) : (
    <div className="series-cover series-cover--empty">{series.title}</div>
  );
}

export function HomePage({
  initialData = null,
}: {
  initialData?: SeriesListResponse | null;
}) {
  const [data, setData] = useState<SeriesListResponse | null>(initialData);
  const [error, setError] = useState<string | null>(null);
  const [requestKey, setRequestKey] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    if (initialData && requestKey === 0) {
      return;
    }

    const controller = new AbortController();
    getJson<SeriesListResponse>("/api/series", controller.signal)
      .then(setData)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError(
            reason instanceof Error
              ? reason.message
              : "작품을 불러오지 못했습니다.",
          );
        }
      });
    return () => controller.abort();
  }, [initialData, requestKey]);

  if (error) {
    return <ErrorState message={error} onRetry={retry} />;
  }

  const featured = data?.items[0];

  return (
    <main>
      <header className="hero">
        <div className="hero__copy">
          <p className="eyebrow">웹툰의 마지막 장면, 그다음</p>
          <h1>
            좋아한 이야기를
            <br />
            <span>책장에 오래.</span>
          </h1>
          <p className="hero__description">
            SweetToon은 웹툰을 읽고, 완결된 시즌을 나만의 단행본으로
            소장하는 독자를 위한 공간입니다.
          </p>
          <div className="hero__actions">
            <Link className="button button--primary" href="#discover">
              오늘의 작품 보기
            </Link>
            <span className="hero__note">
              로그인 없이 바로 읽을 수 있어요
            </span>
          </div>
        </div>
        {featured ? (
          <Link
            className="featured-book"
            href={`/series/${featured.slug}`}
            aria-label={`${featured.title} 작품 보기`}
          >
            <div className="featured-book__halo" />
            <div className="featured-book__cover">
              <SeriesCover priority series={featured} />
            </div>
            <div className="featured-book__caption">
              <span>오늘의 이야기</span>
              <strong>{featured.title}</strong>
            </div>
          </Link>
        ) : (
          <div className="featured-book featured-book--loading">
            <div className="skeleton skeleton--hero" />
          </div>
        )}
      </header>

      <section className="discover-section" id="discover">
        <div className="section-heading">
          <div>
            <p className="eyebrow">지금 펼쳐볼 이야기</p>
            <h2>당신의 다음 웹툰</h2>
          </div>
          <p>
            완결작은 한 권으로 소장할 수 있고,
            <br className="desktop-only" /> 연재작은 새 화를 이어서 볼 수
            있어요.
          </p>
        </div>

        {!data ? (
          <LoadingCards />
        ) : data.items.length === 0 ? (
          <div className="empty-library">
            <span>첫 작품을 준비하고 있어요.</span>
            <p>잠시 후 다시 찾아와 주세요.</p>
          </div>
        ) : (
          <div className="card-grid">
            {data.items.map((series) => (
              <article className="series-card" key={series.id}>
                <Link
                  className="series-card__image"
                  href={`/series/${series.slug}`}
                >
                  <SeriesCover series={series} />
                  <span
                    className={`status-badge status-badge--${series.status}`}
                  >
                    {statusLabel[series.status]}
                  </span>
                </Link>
                <div className="series-card__body">
                  <div className="series-card__meta">
                    <span>{series.genre}</span>
                    <span>{series.author.name}</span>
                  </div>
                  <h3>
                    <Link href={`/series/${series.slug}`}>{series.title}</Link>
                  </h3>
                  <p>{series.synopsis}</p>
                  <div className="series-card__footer">
                    <span>{series.episodeCount}화</span>
                    {series.completedSeasonCount > 0 ? (
                      <span>소장 가능 {series.completedSeasonCount}시즌</span>
                    ) : (
                      <span>매주 이어지는 이야기</span>
                    )}
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="print-promise">
        <p className="eyebrow">From scroll to shelf</p>
        <h2>스크롤로 만난 이야기를, 종이 위에서 다시.</h2>
        <p>
          완결 시즌의 에피소드를 순서대로 묶어 표지와 판형을 고르면
          나만의 소장본 주문으로 이어집니다.
        </p>
        <div className="print-promise__steps" aria-label="소장본 이용 순서">
          <span>01 작품 감상</span>
          <span>02 완결 시즌 선택</span>
          <span>03 단행본 주문</span>
        </div>
      </section>
    </main>
  );
}
