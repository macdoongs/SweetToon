"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ApiError, getJson } from "@/lib/api";
import { getDemoEntitlement } from "@/lib/demo-entitlements";
import { episodeLabel } from "@/lib/episode-label";
import type { EpisodeReader } from "@/lib/reader-types";
import {
  getEpisodeProgress,
  saveReadingProgress,
} from "@/lib/reading-progress";
import { ErrorState, PageLoading } from "./reader-states";

type ReaderMode = "webtoon" | "double";
type ScaleType = "screen" | "width" | "height" | "original";
type Background = "black" | "gray" | "white";
type ReadingDirection = "ltr" | "rtl";
type Page = EpisodeReader["pages"][number];

const SETTINGS_KEY = "sweettoon:reader-settings";

function loadSettings(): {
  mode: ReaderMode;
  scale: ScaleType;
  background: Background;
  direction: ReadingDirection;
} {
  try {
    const value = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}");
    return {
      mode: value.mode === "double" ? "double" : "webtoon",
      scale:
        value.scale === "width" ||
        value.scale === "height" ||
        value.scale === "original"
          ? value.scale
          : "screen",
      background:
        value.background === "gray" || value.background === "white"
          ? value.background
          : "black",
      direction: value.direction === "rtl" ? "rtl" : "ltr",
    };
  } catch {
    return {
      mode: "webtoon",
      scale: "screen",
      background: "black",
      direction: "ltr",
    };
  }
}

function buildSpreads(
  pages: Page[],
  dimensions: Record<string, { width: number; height: number }>,
): Page[][] {
  const spreads: Page[][] = [];
  let index = 0;
  while (index < pages.length) {
    const page = pages[index];
    const size = dimensions[page.id];
    const landscape = size ? size.width > size.height : false;
    const isEdge = index === 0 || index === pages.length - 1;
    if (isEdge || landscape) {
      spreads.push([page]);
      index += 1;
      continue;
    }
    const next = pages[index + 1];
    const nextSize = next ? dimensions[next.id] : undefined;
    const nextLandscape = nextSize
      ? nextSize.width > nextSize.height
      : false;
    if (next && index + 1 < pages.length - 1 && !nextLandscape) {
      spreads.push([page, next]);
      index += 2;
    } else {
      spreads.push([page]);
      index += 1;
    }
  }
  return spreads;
}

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
  const [mode, setMode] = useState<ReaderMode>("webtoon");
  const [scale, setScale] = useState<ScaleType>("screen");
  const [background, setBackground] = useState<Background>("black");
  const [direction, setDirection] = useState<ReadingDirection>("ltr");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [dimensions, setDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const lastSavedPercent = useRef(-10);
  const restoredEpisode = useRef<string | null>(null);

  const retry = useCallback(() => {
    setError(null);
    setRequestKey((current) => current + 1);
  }, []);

  useLayoutEffect(() => {
    const root = document.documentElement;
    const previousBehavior = root.style.scrollBehavior;
    root.style.scrollBehavior = "auto";
    window.scrollTo(0, 0);
    const frame = requestAnimationFrame(() => {
      root.style.scrollBehavior = previousBehavior;
    });
    return () => {
      cancelAnimationFrame(frame);
      root.style.scrollBehavior = previousBehavior;
    };
  }, [episodeId]);

  useEffect(() => {
    const saved = loadSettings();
    const frame = requestAnimationFrame(() => {
      setMode(saved.mode);
      setScale(saved.scale);
      setBackground(saved.background);
      setDirection(saved.direction);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ mode, scale, background, direction }),
    );
  }, [background, direction, mode, scale]);

  useEffect(() => {
    const locked = initialData?.access.state === "locked";
    const token = locked
      ? getDemoEntitlement(
          initialData.season.id,
          initialData.access.volumeNumber,
        )
      : null;
    if (initialData && requestKey === 0 && (!locked || !token)) {
      return;
    }

    const controller = new AbortController();
    getJson<EpisodeReader>(
      `/api/episodes/${encodeURIComponent(episodeId)}`,
      controller.signal,
      token ? { Authorization: `Bearer ${token}` } : {},
    )
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
    if (mode !== "webtoon") return;
    const updateProgress = () => {
      const scrollable =
        document.documentElement.scrollHeight - window.innerHeight;
      const nextProgress =
        scrollable <= 0
          ? 100
          : Math.min(100, Math.round((window.scrollY / scrollable) * 100));
      setProgress(nextProgress);
      if (
        episode &&
        episode.access.state !== "locked" &&
        (restoredEpisode.current === episode.id ||
          !getEpisodeProgress(episode.id)) &&
        (Math.abs(nextProgress - lastSavedPercent.current) >= 5 ||
          nextProgress === 100)
      ) {
        const cuts = [...document.querySelectorAll<HTMLElement>(
          ".webtoon-strip__cut",
        )];
        const activeCut =
          [...cuts]
            .reverse()
            .find((cut) => cut.getBoundingClientRect().top <= 180) ?? cuts[0];
        const pageOrder = Number(activeCut?.id.replace("page-", "")) || 1;
        lastSavedPercent.current = nextProgress;
        saveReadingProgress({
          seriesSlug: episode.series.slug,
          episodeId: episode.id,
          episodeNumber: episode.number,
          episodeTitle: episode.title,
          pageOrder,
          percent: nextProgress,
          completed: nextProgress >= 95,
          updatedAt: new Date().toISOString(),
        });
      }
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => {
      window.removeEventListener("scroll", updateProgress);
      window.removeEventListener("resize", updateProgress);
    };
  }, [episode, mode]);

  useEffect(() => {
    if (!episode || mode !== "double") return;
    for (const page of episode.pages) {
      if (dimensions[page.id]) continue;
      const image = new window.Image();
      image.onload = () => {
        setDimensions((current) => ({
          ...current,
          [page.id]: {
            width: image.naturalWidth,
            height: image.naturalHeight,
          },
        }));
      };
      image.src = page.imageUrl;
    }
  }, [dimensions, episode, mode]);

  const spreads = useMemo(
    () => buildSpreads(episode?.pages ?? [], dimensions),
    [dimensions, episode?.pages],
  );
  const readerProgress =
    mode === "double" && spreads.length > 0
      ? Math.round(((spreadIndex + 1) / spreads.length) * 100)
      : progress;

  useEffect(() => {
    if (
      !episode ||
      episode.access.state === "locked" ||
      mode !== "double" ||
      spreads.length === 0
    ) {
      return;
    }
    const currentPage = spreads[spreadIndex]?.[0];
    const nextProgress = Math.round(
      ((spreadIndex + 1) / spreads.length) * 100,
    );
    saveReadingProgress({
      seriesSlug: episode.series.slug,
      episodeId: episode.id,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      pageOrder: currentPage?.order ?? 1,
      percent: nextProgress,
      completed: nextProgress >= 100,
      updatedAt: new Date().toISOString(),
    });
  }, [episode, mode, spreadIndex, spreads]);

  useEffect(() => {
    if (
      !episode ||
      episode.access.state === "locked" ||
      restoredEpisode.current === episode.id
    ) {
      return;
    }
    const saved = getEpisodeProgress(episode.id);
    if (!saved || saved.completed) {
      restoredEpisode.current = episode.id;
      return;
    }
    if (mode === "double" && spreads.length > 0) {
      const index = spreads.findIndex((spread) =>
        spread.some((page) => page.order === saved.pageOrder),
      );
      const frame = requestAnimationFrame(() => {
        if (index >= 0) setSpreadIndex(index);
        restoredEpisode.current = episode.id;
      });
      return () => cancelAnimationFrame(frame);
    } else if (mode === "webtoon") {
      const frame = requestAnimationFrame(() => {
        document
          .getElementById(`page-${saved.pageOrder}`)
          ?.scrollIntoView({ block: "start" });
        restoredEpisode.current = episode.id;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [episode, mode, spreads]);

  const bookmark = useCallback(() => {
    if (!episode || episode.access.state === "locked") return;
    const pageOrder =
      mode === "double"
        ? spreads[spreadIndex]?.[0]?.order ?? 1
        : Number(
            [...document.querySelectorAll<HTMLElement>(
              ".webtoon-strip__cut",
            )]
              .reverse()
              .find((cut) => cut.getBoundingClientRect().top <= 180)
              ?.id.replace("page-", ""),
          ) || 1;
    saveReadingProgress({
      seriesSlug: episode.series.slug,
      episodeId: episode.id,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
      pageOrder,
      percent: readerProgress,
      completed: readerProgress >= 95,
      updatedAt: new Date().toISOString(),
    });
    setBookmarkMessage(`${pageOrder}쪽을 책갈피에 저장했어요.`);
    window.setTimeout(() => setBookmarkMessage(null), 2200);
  }, [episode, mode, readerProgress, spreadIndex, spreads]);

  const goToSpread = useCallback(
    (index: number) => {
      setSpreadIndex(Math.max(0, Math.min(spreads.length - 1, index)));
    },
    [spreads.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      if (event.key === "?") setHelpOpen((open) => !open);
      if (event.key.toLowerCase() === "t") {
        setThumbnailsOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setHelpOpen(false);
        setThumbnailsOpen(false);
        setSettingsOpen(false);
      }
      if (mode === "double" && event.key === "ArrowLeft") {
        goToSpread(spreadIndex + (direction === "rtl" ? 1 : -1));
      }
      if (
        mode === "double" &&
        (event.key === "ArrowRight" || event.key === " ")
      ) {
        event.preventDefault();
        goToSpread(
          event.key === " "
            ? spreadIndex + 1
            : spreadIndex + (direction === "rtl" ? -1 : 1),
        );
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [direction, goToSpread, mode, spreadIndex]);

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

  const orderHref =
    `/series/${encodeURIComponent(episode.series.slug)}/order?` +
    `season=${encodeURIComponent(episode.season.id)}` +
    `&volume=${episode.access.volumeNumber}`;

  return (
    <main
      className={`reader-page reader-page--${background} reader-page--${mode}`}
    >
      <div
        className="reader-progress"
        aria-hidden="true"
        style={{ width: `${readerProgress}%` }}
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
            {episode.series.title} · 시즌 {episode.season.number} ·{" "}
            {episode.access.volumeNumber}권
          </span>
          <h1>{episodeLabel(episode.number, episode.title)}</h1>
        </div>
        <span className="reader-toolbar__progress">{readerProgress}%</span>
      </header>

      <nav className="reader-controls" aria-label="뷰어 도구">
        <div role="group" aria-label="읽기 모드">
          <button
            aria-pressed={mode === "webtoon"}
            onClick={() => {
              setMode("webtoon");
              setSpreadIndex(0);
            }}
          >
            세로 스크롤
          </button>
          <button
            aria-pressed={mode === "double"}
            onClick={() => {
              setMode("double");
              window.scrollTo({ top: 0 });
            }}
          >
            양면 보기
          </button>
        </div>
        <div>
          <button onClick={bookmark}>책갈피</button>
          <button onClick={() => setThumbnailsOpen((open) => !open)}>
            페이지
          </button>
          <button onClick={() => setSettingsOpen((open) => !open)}>
            화면 설정
          </button>
          <button onClick={() => setHelpOpen((open) => !open)}>도움말</button>
        </div>
      </nav>
      {bookmarkMessage ? (
        <p className="reader-bookmark-toast" role="status">
          {bookmarkMessage}
        </p>
      ) : null}

      {settingsOpen ? (
        <section className="reader-popover reader-settings" aria-label="화면 설정">
          <fieldset>
            <legend>페이지 맞춤</legend>
            {(
              [
                ["screen", "화면에 맞춤"],
                ["width", "너비에 맞춤"],
                ["height", "높이에 맞춤"],
                ["original", "원본 크기"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  checked={scale === value}
                  name="scale"
                  onChange={() => setScale(value)}
                  type="radio"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>배경</legend>
            {(
              [
                ["black", "검정"],
                ["gray", "회색"],
                ["white", "흰색"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  checked={background === value}
                  name="background"
                  onChange={() => setBackground(value)}
                  type="radio"
                />
                {label}
              </label>
            ))}
          </fieldset>
          <fieldset>
            <legend>양면 읽기 방향</legend>
            {(
              [
                ["ltr", "왼쪽에서 오른쪽"],
                ["rtl", "오른쪽에서 왼쪽"],
              ] as const
            ).map(([value, label]) => (
              <label key={value}>
                <input
                  checked={direction === value}
                  name="direction"
                  onChange={() => setDirection(value)}
                  type="radio"
                />
                {label}
              </label>
            ))}
          </fieldset>
        </section>
      ) : null}

      {helpOpen ? (
        <section className="reader-popover reader-help" aria-label="키보드 도움말">
          <h2>키보드로 읽기</h2>
          <dl>
            <div><dt>← / →</dt><dd>읽기 방향에 맞춰 양면 이동</dd></div>
            <div><dt>Space</dt><dd>다음 양면</dd></div>
            <div><dt>T</dt><dd>페이지 탐색기 열기</dd></div>
            <div><dt>?</dt><dd>도움말 열기</dd></div>
            <div><dt>Esc</dt><dd>열린 도구 닫기</dd></div>
          </dl>
        </section>
      ) : null}

      {episode.access.state === "locked" ? (
        <section className="reader-paywall">
          <span aria-hidden="true">🔒</span>
          <p className="eyebrow">무료 미리보기 종료</p>
          <h2>
            {episode.access.freeVolumeCount > 0
              ? `${episode.access.freeVolumeCount}권과 다음 ${episode.access.previewEpisodeCount}화`
              : `첫 ${episode.access.previewEpisodeCount}화`}
            까지 무료로 읽을 수 있어요.
          </h2>
          <p>
            이 회차는 시즌 {episode.season.number} ·{" "}
            {episode.access.volumeNumber}권에 수록됩니다. 소장본을 Mock
            주문하면 이 브라우저에서 해당 권의 다섯 화가 바로 열립니다.
          </p>
          <Link className="button button--primary" href={orderHref}>
            {episode.access.volumeNumber}권 소장하고 계속 읽기
          </Link>
          <Link
            className="reader-finish__back"
            href={`/series/${episode.series.slug}#episodes`}
          >
            무료 회차 목록으로
          </Link>
        </section>
      ) : episode.pages.length === 0 ? (
        <div className="reader-empty">
          <h2>아직 등록된 원고가 없어요.</h2>
          <Link
            className="button button--light"
            href={`/series/${episode.series.slug}`}
          >
            에피소드 목록으로
          </Link>
        </div>
      ) : mode === "webtoon" ? (
        <article
          className="webtoon-strip"
          aria-label={`${episode.title} 웹툰 본문`}
        >
          {episode.pages.map((page) => (
            <div className="webtoon-strip__cut" id={`page-${page.order}`} key={page.id}>
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
      ) : (
        <section
          className={`reader-paged reader-paged--${scale} reader-paged--${direction}`}
          aria-label={`${episode.title} 양면 본문`}
        >
          <button
            aria-label={direction === "rtl" ? "다음 양면" : "이전 양면"}
            className="reader-paged__turn reader-paged__turn--previous"
            disabled={
              direction === "rtl"
                ? spreadIndex >= spreads.length - 1
                : spreadIndex === 0
            }
            onClick={() =>
              goToSpread(spreadIndex + (direction === "rtl" ? 1 : -1))
            }
          >
            ←
          </button>
          <div className="reader-paged__spread">
            {(spreads[spreadIndex] ?? []).map((page) => (
              <Image
                alt={`${episode.title} ${page.order}번째 페이지`}
                height={1200}
                key={page.id}
                priority
                src={page.imageUrl}
                unoptimized
                width={800}
              />
            ))}
          </div>
          <button
            aria-label={direction === "rtl" ? "이전 양면" : "다음 양면"}
            className="reader-paged__turn reader-paged__turn--next"
            disabled={
              direction === "rtl"
                ? spreadIndex === 0
                : spreadIndex >= spreads.length - 1
            }
            onClick={() =>
              goToSpread(spreadIndex + (direction === "rtl" ? -1 : 1))
            }
          >
            →
          </button>
          <span className="reader-paged__counter">
            {spreadIndex + 1} / {spreads.length}
          </span>
        </section>
      )}

      {thumbnailsOpen && episode.pages.length > 0 ? (
        <aside className="reader-thumbnails" aria-label="페이지 탐색기">
          <header>
            <strong>전체 페이지</strong>
            <button onClick={() => setThumbnailsOpen(false)}>닫기</button>
          </header>
          <div>
            {episode.pages.map((page) => (
              <button
                key={page.id}
                onClick={() => {
                  if (mode === "webtoon") {
                    document
                      .getElementById(`page-${page.order}`)
                      ?.scrollIntoView({ behavior: "smooth" });
                  } else {
                    const index = spreads.findIndex((spread) =>
                      spread.some((candidate) => candidate.id === page.id),
                    );
                    goToSpread(index);
                  }
                  setThumbnailsOpen(false);
                }}
              >
                <Image
                  alt={`${page.order}쪽 미리보기`}
                  height={180}
                  src={page.imageUrl}
                  unoptimized
                  width={120}
                />
                <span>{page.order}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      {episode.access.state !== "locked" ? (
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
                소장본 알아보기 →
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
      ) : null}
    </main>
  );
}
