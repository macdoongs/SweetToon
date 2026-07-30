"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ApiError, getJson } from "@/lib/api";
import type { SeriesDetail } from "@/lib/reader-types";
import {
  getAllReadingProgress,
  type ReadingProgress,
} from "@/lib/reading-progress";
import { ErrorState, PageLoading } from "./reader-states";
import { FavoriteButton } from "./favorite-button";
import { DiscoverLink } from "./discover-link";

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ko-KR", {
    month: "short",
    day: "numeric",
    timeZone: "Asia/Seoul",
  }).format(new Date(value));
}

export function SeriesDetailPage({
  slug,
  activeSort,
  activeVolume,
  initialData = null,
}: {
  slug: string;
  activeSort: "oldest" | "latest";
  activeVolume?: string;
  initialData?: SeriesDetail | null;
}) {
  const [series, setSeries] = useState<SeriesDetail | null>(initialData);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [requestKey, setRequestKey] = useState(0);
  const [readingProgress, setReadingProgress] = useState<
    Record<string, ReadingProgress>
  >({});
  const [selectedEditionKey, setSelectedEditionKey] = useState("");

  const retry = useCallback(() => {
    setError(null);
    setRequestKey((current) => current + 1);
  }, []);

  useEffect(() => {
    const refresh = () => setReadingProgress(getAllReadingProgress());
    const frame = requestAnimationFrame(refresh);
    window.addEventListener("sweettoon:progress", refresh);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("sweettoon:progress", refresh);
    };
  }, []);

  useEffect(() => {
    if (initialData && requestKey === 0) {
      return;
    }

    const controller = new AbortController();
    getJson<SeriesDetail>(
      `/api/series/${encodeURIComponent(slug)}`,
      controller.signal,
    )
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
  }, [initialData, requestKey, slug]);

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

  const volumeOptions = series.seasons.flatMap((season) =>
    [...new Set(season.episodes.map((episode) => episode.volumeNumber))].map(
      (volumeNumber) => ({
        key: `${season.id}:${volumeNumber}`,
        season,
        volumeNumber,
        episodes: season.episodes.filter(
          (episode) => episode.volumeNumber === volumeNumber,
        ),
      }),
    ),
  );
  const completedVolumes = volumeOptions.filter(
    (volume) => volume.season.status === "completed",
  );
  const selectedEdition =
    completedVolumes.find((volume) => volume.key === selectedEditionKey) ??
    completedVolumes[0];
  const orderedVolumes = [...volumeOptions].sort((left, right) => {
    const direction = activeSort === "latest" ? -1 : 1;
    const seasonDifference = left.season.number - right.season.number;
    if (seasonDifference !== 0) return seasonDifference * direction;
    return (left.volumeNumber - right.volumeNumber) * direction;
  });
  const selectedVolumes = activeVolume
    ? orderedVolumes.filter((volume) => volume.key === activeVolume)
    : orderedVolumes;
  const filterHref = (
    sort: "oldest" | "latest",
    volume?: string,
  ) => {
    const params = new URLSearchParams();
    if (sort === "latest") params.set("sort", sort);
    if (volume) params.set("volume", volume);
    const query = params.toString();
    return `/series/${encodeURIComponent(series.slug)}${query ? `?${query}` : ""}#episodes`;
  };

  return (
    <main className="series-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <DiscoverLink>작품</DiscoverLink>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{series.title}</strong>
      </nav>
      <header className="series-hero">
        <div className="series-hero__cover">
          {series.coverUrl ? (
            <Image
              alt={`${series.title} 표지`}
              height={840}
              preload
              sizes="(max-width: 700px) min(300px, 82vw), 360px"
              src={series.coverUrl}
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
                href={`/read/${encodeURIComponent(firstEpisode.id)}`}
              >
                첫 화부터 읽기
              </Link>
            ) : null}
            <a className="button button--ghost" href="#edition">
              소장본 알아보기
            </a>
            <FavoriteButton
              series={{
                slug: series.slug,
                title: series.title,
                synopsis: series.synopsis,
                genre: series.genre,
                coverUrl: series.coverUrl,
                authorName: series.author.name,
              }}
            />
          </div>
        </div>
      </header>

      <section className="episode-library" id="episodes">
        <div className="section-heading section-heading--compact">
          <div>
            <p className="eyebrow">Episodes</p>
            <h2>에피소드</h2>
          </div>
          <p>다섯 화씩 한 권으로 묶어 차례대로 감상할 수 있어요.</p>
        </div>

        <div className="episode-controls">
          <nav aria-label="에피소드 정렬">
            <strong>정렬</strong>
            <Link
              aria-current={activeSort === "oldest" ? "page" : undefined}
              href={filterHref("oldest", activeVolume)}
            >
              처음부터
            </Link>
            <Link
              aria-current={activeSort === "latest" ? "page" : undefined}
              href={filterHref("latest", activeVolume)}
            >
              최신화부터
            </Link>
          </nav>
          <nav aria-label="권별 에피소드 필터">
            <strong>소장본</strong>
            <Link
              aria-current={!activeVolume ? "page" : undefined}
              href={filterHref(activeSort)}
            >
              전체
            </Link>
            {orderedVolumes.map((volume) => (
              <Link
                aria-current={
                  activeVolume === volume.key ? "page" : undefined
                }
                href={filterHref(activeSort, volume.key)}
                key={volume.key}
              >
                시즌 {volume.season.number} · {volume.volumeNumber}권
              </Link>
            ))}
          </nav>
        </div>

        <div className="season-list">
          {selectedVolumes.map(
            ({ key, season, volumeNumber, episodes }) => (
            <section className="season-panel" key={key}>
              <header className="season-panel__header">
                <div>
                  <span>시즌 {season.number} · 5화 단위</span>
                  <h3>{volumeNumber}권</h3>
                </div>
                <span
                  className={`status-badge status-badge--${season.status}`}
                >
                  {season.status === "completed" ? "완결" : "연재 중"}
                </span>
              </header>
              {episodes.length === 0 ? (
                <p className="season-panel__empty">
                  첫 에피소드를 준비하고 있어요.
                </p>
              ) : (
                <ol className="episode-list">
                  {[...episodes]
                    .sort((left, right) =>
                      activeSort === "latest"
                        ? right.number - left.number
                        : left.number - right.number,
                    )
                    .map((episode) => (
                    <li key={episode.id}>
                      <Link
                        className="episode-list__item"
                        href={`/read/${encodeURIComponent(episode.id)}`}
                      >
                        <span className="episode-list__number">
                          {String(episode.number).padStart(2, "0")}
                        </span>
                        <span className="episode-list__title">
                          {episode.title}
                        </span>
                        <time dateTime={episode.publishedAt}>
                          {formatDate(episode.publishedAt)}
                        </time>
                        <span className="episode-list__access">
                          {readingProgress[episode.id]?.completed
                            ? "읽음"
                            : readingProgress[episode.id]
                              ? `${readingProgress[episode.id].percent}% 읽음`
                              : episode.access === "free"
                                ? "무료"
                                : "캔디 1개 또는 소장본 이용권"}
                        </span>
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
          <h2>완결된 시즌은 5화씩 소장본으로 이어집니다.</h2>
          <p>
            읽던 순서 그대로 5화씩 한 권에 묶고, 표지와 판형을 골라 소장본을
            주문할 수 있어요. 실제 인쇄 API를 호출하지 않고 주문 기록과 제작 상태를
            안전한 Mock 흐름으로 먼저 경험하게 됩니다.
          </p>
        </div>
        <div className="edition-card__status">
          <div className="edition-card__metric">
            <strong>{completedVolumes.length}</strong>
            <span>소장 가능한 권</span>
          </div>
          {selectedEdition ? (
            <div className="edition-card__picker">
              <label>
                <span>주문할 소장본</span>
                <select
                  onChange={(event) =>
                    setSelectedEditionKey(event.target.value)
                  }
                  value={selectedEdition.key}
                >
                  {completedVolumes.map(
                    ({ key, season, volumeNumber, episodes }) => (
                      <option key={key} value={key}>
                        시즌 {season.number} · {volumeNumber}권 ·{" "}
                        {episodes.at(0)?.number}~{episodes.at(-1)?.number}화
                      </option>
                    ),
                  )}
                </select>
              </label>
              <Link
                className="button edition-card__order"
                href={`/series/${encodeURIComponent(series.slug)}/order?season=${encodeURIComponent(selectedEdition.season.id)}&volume=${selectedEdition.volumeNumber}`}
              >
                선택한 {selectedEdition.volumeNumber}권 주문하기
                <small>
                  시즌 {selectedEdition.season.number} ·{" "}
                  {selectedEdition.episodes.at(0)?.number}~
                  {selectedEdition.episodes.at(-1)?.number}화
                </small>
              </Link>
            </div>
          ) : (
            <span className="edition-card__unavailable">
              완결 시즌이 생기면 주문할 수 있어요
            </span>
          )}
        </div>
      </section>
    </main>
  );
}
