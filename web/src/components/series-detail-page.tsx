"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, getJson } from "@/lib/api";
import type { SeriesDetail } from "@/lib/reader-types";
import { ErrorState, PageLoading } from "./reader-states";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

export function SeriesDetailPage({ slug }: { slug: string }) {
  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [requestKey, setRequestKey] = useState(0);

  const retry = useCallback(() => {
    setError(null);
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    getJson<SeriesDetail>(`/api/series/${slug}`, controller.signal)
      .then(setSeries)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError({
            message:
              reason instanceof Error
                ? reason.message
                : "작품을 불러오지 못했습니다.",
            status: reason instanceof ApiError ? reason.status : undefined,
          });
        }
      });
    return () => controller.abort();
  }, [requestKey, slug]);

  const firstEpisode = useMemo(
    () => series?.seasons.flatMap((season) => season.episodes)[0],
    [series],
  );

  if (error) {
    return (
      <ErrorState
        title={error.status === 404 ? "이 작품은 찾을 수 없어요" : undefined}
        message={error.message}
        onRetry={error.status === 404 ? undefined : retry}
      />
    );
  }

  if (!series) {
    return <PageLoading label="작품의 페이지를 펼치고 있어요" />;
  }

  const completedSeasons = series.seasons.filter(
    (season) => season.status === "completed",
  );

  return (
    <main className="series-page">
      <div className="series-hero">
        <div className="series-hero__cover">
          {series.coverUrl ? (
            <Image
              alt={`${series.title} 표지`}
              height={840}
              priority
              src={series.coverUrl}
              unoptimized
              width={600}
            />
          ) : (
            <div className="series-cover series-cover--empty">
              {series.title}
            </div>
          )}
        </div>
        <div className="series-hero__content">
          <Link className="back-link" href="/">
            ← 모든 작품
          </Link>
          <div className="series-hero__badges">
            <span>{series.genre}</span>
            <span>{series.status === "completed" ? "완결" : "연재 중"}</span>
          </div>
          <h1>{series.title}</h1>
          <p className="series-hero__synopsis">{series.synopsis}</p>
          <div className="author-note">
            <span className="author-note__avatar">
              {series.author.name.slice(0, 1)}
            </span>
            <div>
              <strong>{series.author.name}</strong>
              <p>{series.author.bio ?? "이야기를 만드는 창작자입니다."}</p>
            </div>
          </div>
          <div className="series-hero__actions">
            {firstEpisode ? (
              <Link
                className="button button--primary"
                href={`/read/${firstEpisode.id}`}
              >
                첫 화부터 읽기
              </Link>
            ) : null}
            <a className="button button--ghost" href="#edition">
              소장본 알아보기
            </a>
          </div>
        </div>
      </div>

      <section className="episode-library">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">Episodes</p>
            <h2>에피소드</h2>
          </div>
          <p>시즌별로 차례대로 감상할 수 있어요.</p>
        </div>

        <div className="season-list">
          {series.seasons.map((season) => (
            <section className="season-panel" key={season.id}>
              <header className="season-panel__header">
                <div>
                  <span>시즌 {season.number}</span>
                  <h3>{season.title ?? `시즌 ${season.number}`}</h3>
                </div>
                <span
                  className={`status-badge status-badge--${season.status}`}
                >
                  {season.status === "completed" ? "완결" : "연재 중"}
                </span>
              </header>
              {season.episodes.length === 0 ? (
                <p className="season-panel__empty">
                  첫 에피소드를 준비하고 있어요.
                </p>
              ) : (
                <ol className="episode-list">
                  {season.episodes.map((episode) => (
                    <li key={episode.id}>
                      <Link href={`/read/${episode.id}`}>
                        <span className="episode-list__number">
                          {String(episode.number).padStart(2, "0")}
                        </span>
                        <span className="episode-list__title">
                          {episode.title}
                        </span>
                        <time dateTime={episode.publishedAt}>
                          {formatDate(episode.publishedAt)}
                        </time>
                        <span className="episode-list__arrow">→</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          ))}
        </div>
      </section>

      <section className="edition-card" id="edition">
        <div>
          <p className="eyebrow">Shelf edition</p>
          <h2>완결된 시즌은 한 권으로 이어집니다.</h2>
          <p>
            읽던 순서 그대로 묶고, 표지와 판형을 골라 소장본을 주문할 수
            있어요. 실제 인쇄 API를 호출하지 않고 주문 기록과 제작 상태를
            안전한 Mock 흐름으로 먼저 경험하게 됩니다.
          </p>
        </div>
        <div className="edition-card__status">
          <strong>{completedSeasons.length}</strong>
          <span>소장 가능한 시즌</span>
          <button className="button button--muted" disabled>
            주문 기능 준비 중
          </button>
        </div>
      </section>
    </main>
  );
}
