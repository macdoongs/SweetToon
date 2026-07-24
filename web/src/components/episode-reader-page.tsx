"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { ApiError, getJson } from "@/lib/api";
import { episodeLabel } from "@/lib/episode-label";
import type { EpisodeReader } from "@/lib/reader-types";
import { ErrorState, PageLoading } from "./reader-states";

export function EpisodeReaderPage({
  episodeId,
  initialData = null,
}: {
  episodeId: string;
  initialData?: EpisodeReader | null;
}) {
  const [episode, setEpisode] = useState<EpisodeReader | null>(initialData);
  const [error, setError] = useState<{ message: string; status?: number } | null>(
    null,
  );
  const [progress, setProgress] = useState(0);
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
    getJson<EpisodeReader>(`/api/episodes/${episodeId}`, controller.signal)
      .then(setEpisode)
      .catch((reason: unknown) => {
        if (!controller.signal.aborted) {
          setError({
            message:
              reason instanceof ApiError
                ? reason.message
                : "에피소드를 불러오지 못했습니다.",
            status: reason instanceof ApiError ? reason.status : undefined,
          });
        }
      });
    return () => controller.abort();
  }, [episodeId, initialData, requestKey]);

  useEffect(() => {
    const updateProgress = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      setProgress(
        scrollable <= 0
          ? 100
          : Math.min(100, Math.round((window.scrollY / scrollable) * 100)),
      );
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [episode]);

  if (error) {
    return (
      <ErrorState
        title={
          error.status === 404 ? "이 에피소드는 찾을 수 없어요" : undefined
        }
        message={error.message}
        onRetry={error.status === 404 ? undefined : retry}
      />
    );
  }

  if (!episode) {
    return <PageLoading label="웹툰을 불러오고 있어요" />;
  }

  return (
    <main className="reader-page">
      <div
        className="reader-progress"
        aria-hidden="true"
        style={{ width: `${progress}%` }}
      />
      <header className="reader-toolbar">
        <Link
          className="reader-toolbar__back"
          href={`/series/${episode.series.slug}`}
          aria-label="작품으로 돌아가기"
        >
          ←
        </Link>
        <div className="reader-toolbar__title">
          <span>
            {episode.series.title} · 시즌 {episode.season.number}
          </span>
          <h1>{episodeLabel(episode.number, episode.title)}</h1>
        </div>
        <span className="reader-toolbar__progress">{progress}%</span>
      </header>

      {episode.pages.length === 0 ? (
        <div className="reader-empty">
          <h1>아직 등록된 원고가 없어요.</h1>
          <Link
            className="button button--light"
            href={`/series/${episode.series.slug}`}
          >
            에피소드 목록으로
          </Link>
        </div>
      ) : (
        <article
          className="webtoon-strip"
          aria-label={`${episode.title} 웹툰 본문`}
        >
          {episode.pages.map((page) => (
            <div className="webtoon-strip__cut" key={page.id}>
              <Image
                alt={`${episode.title} ${page.order}번째 컷`}
                height={1200}
                priority={page.order <= 2}
                src={page.imageUrl}
                unoptimized
                width={800}
              />
            </div>
          ))}
        </article>
      )}

      <section className="reader-finish">
        <p className="eyebrow">여기까지 읽었어요</p>
        <h2>
          {episode.series.title} {episode.number}화를 완독했습니다.
        </h2>
        <div className="reader-navigation">
          {episode.navigation.previousEpisodeId ? (
            <Link
              className="button button--dark-ghost"
              href={`/read/${episode.navigation.previousEpisodeId}`}
            >
              ← 이전 화
            </Link>
          ) : (
            <span />
          )}
          {episode.navigation.nextEpisodeId ? (
            <Link
              className="button button--light"
              href={`/read/${episode.navigation.nextEpisodeId}`}
            >
              다음 화 이어보기 →
            </Link>
          ) : (
            <Link
              className="button button--light"
              href={`/series/${episode.series.slug}#edition`}
            >
              시즌 소장본 알아보기 →
            </Link>
          )}
        </div>
        <Link
          className="reader-finish__back"
          href={`/series/${episode.series.slug}`}
        >
          에피소드 목록으로 돌아가기
        </Link>
      </section>
    </main>
  );
}
