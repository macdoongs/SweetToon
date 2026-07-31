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
import {
  ApiError,
  getJson,
  isUncertainRequestError,
  postJson,
} from "@/lib/api";
import { getDemoEntitlement } from "@/lib/demo-entitlements";
import {
  getCandyWalletToken,
  notifyCandyUpdated,
  type CandyUnlockResponse,
  type CandyWallet,
} from "@/lib/candy-wallet";
import { episodeLabel } from "@/lib/episode-label";
import type { EpisodeReader } from "@/lib/reader-types";
import {
  getEpisodeProgress,
  saveReadingProgress,
} from "@/lib/reading-progress";
import { useReaderPresence } from "@/lib/use-reader-presence";
import { ReaderPaywall } from "./reader-paywall";
import { ErrorState, PageLoading } from "./reader-states";

type ReaderMode = "webtoon" | "double";
type ScaleType = "screen" | "width" | "height" | "original";
type Background = "black" | "gray" | "white";
type ReadingDirection = "ltr" | "rtl";
type ModeSource = "auto" | "user";
type Page = EpisodeReader["pages"][number];

const SETTINGS_KEY = "sweettoon:reader-settings";
const READER_CHROME_HIDE_DELAY_MS = 2400;
const MOBILE_VIEWPORT_QUERY = "(max-width: 900px)";
const LANDSCAPE_QUERY = "(orientation: landscape)";

function RecoverablePageImage({
  page,
  title,
  sizes,
  preload = false,
  thumbnail = false,
}: {
  page: Page;
  title: string;
  sizes: string;
  preload?: boolean;
  thumbnail?: boolean;
}) {
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  if (failed) {
    return thumbnail ? (
      <span className="reader-image-error reader-image-error--thumbnail">
        미리보기 실패
      </span>
    ) : (
      <div className="reader-image-error" role="alert">
        <strong>{page.order}쪽 이미지를 불러오지 못했어요.</strong>
        <button
          className="button button--ghost"
          onClick={() => {
            setAttempt((current) => current + 1);
            setFailed(false);
          }}
          type="button"
        >
          이미지 다시 불러오기
        </button>
      </div>
    );
  }

  return (
    <Image
      alt={
        thumbnail
          ? `${page.order}쪽 미리보기`
          : `${title} ${page.order}번째 페이지`
      }
      height={thumbnail ? 180 : 1200}
      key={`${page.id}-${attempt}`}
      onError={() => setFailed(true)}
      preload={preload}
      sizes={sizes}
      src={page.imageUrl}
      unoptimized={isExternalImage(page.imageUrl)}
      width={thumbnail ? 120 : 800}
    />
  );
}

function isExternalImage(url: string) {
  return /^https?:\/\//i.test(url);
}

function loadSettings(): {
  mode: ReaderMode;
  scale: ScaleType;
  background: Background;
  direction: ReadingDirection;
  modeSource: ModeSource;
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
      modeSource: value.modeSource === "user" ? "user" : "auto",
    };
  } catch {
    return {
      mode: "webtoon",
      scale: "screen",
      background: "black",
      direction: "ltr",
      modeSource: "auto",
    };
  }
}

function buildSpreads(
  pages: Page[],
  dimensions: Record<string, { width: number; height: number }>,
  singlePageOnly: boolean,
): Page[][] {
  const spreads: Page[][] = [];
  let index = 0;
  while (index < pages.length) {
    const page = pages[index];
    const size = dimensions[page.id];
    const landscape = size ? size.width > size.height : false;
    const isEdge = index === 0 || index === pages.length - 1;
    if (singlePageOnly || isEdge || landscape) {
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
  const candyUnlockRequestKey = useRef<string | null>(null);
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
  const [modeSource, setModeSource] = useState<ModeSource>("auto");
  const [isMobileViewport, setIsMobileViewport] = useState(false);
  const [isLandscape, setIsLandscape] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [thumbnailsOpen, setThumbnailsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [spreadIndex, setSpreadIndex] = useState(0);
  const [dimensions, setDimensions] = useState<
    Record<string, { width: number; height: number }>
  >({});
  const [bookmarkMessage, setBookmarkMessage] = useState<string | null>(null);
  const [chromeVisible, setChromeVisible] = useState(true);
  const [webtoonCompleted, setWebtoonCompleted] = useState(false);
  const [candyBalance, setCandyBalance] = useState<number | null>(null);
  const [candyBusy, setCandyBusy] = useState(false);
  const [candyMessage, setCandyMessage] = useState<string | null>(null);
  const chromeHideTimer = useRef<number | null>(null);
  const lastScrollY = useRef(0);
  const lastSavedPercent = useRef(-10);
  const restoredProgressKey = useRef<string | null>(null);
  const suppressDoubleProgressSave = useRef(false);
  const suppressWebtoonProgressSave = useRef(false);
  const requestedDimensionPageIds = useRef(new Set<string>());
  const readerMounted = useRef(true);
  const progressRestorationKey = episode ? `${episode.id}:${mode}` : null;

  useEffect(() => {
    readerMounted.current = true;
    return () => {
      readerMounted.current = false;
    };
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setRequestKey((current) => current + 1);
  }, []);

  const viewerCount = useReaderPresence(episode?.series.slug);

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
      setModeSource(saved.modeSource);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      SETTINGS_KEY,
      JSON.stringify({ mode, scale, background, direction, modeSource }),
    );
  }, [background, direction, mode, modeSource, scale]);

  useEffect(() => {
    const mobileQuery = window.matchMedia(MOBILE_VIEWPORT_QUERY);
    const landscapeQuery = window.matchMedia(LANDSCAPE_QUERY);
    const sync = () => {
      setIsMobileViewport(mobileQuery.matches);
      setIsLandscape(landscapeQuery.matches);
    };
    sync();
    mobileQuery.addEventListener("change", sync);
    landscapeQuery.addEventListener("change", sync);
    return () => {
      mobileQuery.removeEventListener("change", sync);
      landscapeQuery.removeEventListener("change", sync);
    };
  }, []);

  // 모바일 기본값: 사용자가 직접 모드를 고르기 전에는 세로=스크롤,
  // 가로=양면 보기를 화면 방향에 맞춰 따라간다.
  useEffect(() => {
    if (!isMobileViewport || modeSource !== "auto") return;
    const nextMode: ReaderMode = isLandscape ? "double" : "webtoon";
    setMode((current) => {
      if (current === nextMode) return current;
      restoredProgressKey.current = null;
      if (nextMode === "webtoon") {
        suppressWebtoonProgressSave.current = true;
      } else {
        window.scrollTo({ top: 0 });
      }
      return nextMode;
    });
    if (nextMode === "double") setSpreadIndex(0);
  }, [isLandscape, isMobileViewport, modeSource]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setWebtoonCompleted(getEpisodeProgress(episodeId)?.completed ?? false);
    });
    return () => cancelAnimationFrame(frame);
  }, [episodeId]);

  useEffect(() => {
    const locked = initialData?.access.state === "locked";
    const token = locked
      ? getDemoEntitlement(
          initialData.season.id,
          initialData.access.volumeNumber,
        ) ?? getCandyWalletToken()
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
    if (episode?.access.state !== "locked") return;
    const controller = new AbortController();
    const token = getCandyWalletToken();
    getJson<CandyWallet>(
      `/api/candy-wallets/${encodeURIComponent(token)}`,
      controller.signal,
    )
      .then((wallet) => setCandyBalance(wallet.balance))
      .catch(() => setCandyBalance(null));
    return () => controller.abort();
  }, [episode?.access.state]);

  async function unlockWithCandy() {
    if (!episode || episode.access.state !== "locked" || candyBusy) return;
    setCandyBusy(true);
    setCandyMessage(null);
    try {
      candyUnlockRequestKey.current ??= crypto.randomUUID();
      const result = await postJson<
        { walletToken: string; requestKey: string },
        CandyUnlockResponse
      >(`/api/episodes/${encodeURIComponent(episode.id)}/candy-unlock`, {
        walletToken: getCandyWalletToken(),
        requestKey: candyUnlockRequestKey.current,
      });
      candyUnlockRequestKey.current = null;
      setCandyBalance(result.balance);
      setCandyMessage(
        result.spent
          ? "캔디 1개를 사용해 이 회차를 열었어요."
          : "이미 열어 둔 회차예요.",
      );
      notifyCandyUpdated();
      setRequestKey((current) => current + 1);
    } catch (reason) {
      if (!isUncertainRequestError(reason)) {
        candyUnlockRequestKey.current = null;
      }
      setCandyMessage(
        reason instanceof ApiError
          ? reason.message
          : "캔디를 사용하지 못했습니다.",
      );
    } finally {
      setCandyBusy(false);
    }
  }

  useEffect(() => {
    if (mode !== "webtoon") return;
    const allowProgressSave = () => {
      suppressWebtoonProgressSave.current = false;
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (
        [
          "ArrowDown",
          "ArrowUp",
          "End",
          "Home",
          "PageDown",
          "PageUp",
          " ",
        ].includes(event.key)
      ) {
        allowProgressSave();
      }
    };
    window.addEventListener("wheel", allowProgressSave, { passive: true });
    window.addEventListener("touchmove", allowProgressSave, {
      passive: true,
    });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("wheel", allowProgressSave);
      window.removeEventListener("touchmove", allowProgressSave);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [mode]);

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
      if (nextProgress >= 95) {
        setWebtoonCompleted(true);
      }
      if (
        episode &&
        episode.access.state !== "locked" &&
        !suppressWebtoonProgressSave.current &&
        (restoredProgressKey.current === progressRestorationKey ||
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
  }, [episode, mode, progressRestorationKey]);

  useEffect(() => {
    if (!episode || mode !== "double") return;
    const requestedPageIds = requestedDimensionPageIds.current;
    for (const page of episode.pages) {
      if (requestedPageIds.has(page.id)) continue;
      requestedPageIds.add(page.id);
      const image = new window.Image();
      image.onload = () => {
        if (!readerMounted.current) return;
        setDimensions((current) => ({
          ...current,
          [page.id]: {
            width: image.naturalWidth,
            height: image.naturalHeight,
          },
        }));
      };
      image.onerror = () => {
        requestedPageIds.delete(page.id);
      };
      image.src = page.imageUrl;
    }
  }, [episode, mode]);

  const singlePageSpreads = isMobileViewport && !isLandscape;
  const spreads = useMemo(
    () =>
      buildSpreads(episode?.pages ?? [], dimensions, singlePageSpreads),
    [dimensions, episode?.pages, singlePageSpreads],
  );
  const readerProgress =
    mode === "double" && spreads.length > 0
      ? Math.round(((spreadIndex + 1) / spreads.length) * 100)
      : progress;
  const isLastSpread =
    mode === "double" &&
    spreads.length > 0 &&
    spreadIndex === spreads.length - 1;
  const showFinish =
    episode?.access.state !== "locked" &&
    (mode === "double" ? isLastSpread : webtoonCompleted);
  const chromePinned =
    settingsOpen || thumbnailsOpen || helpOpen || bookmarkMessage !== null;

  const revealChrome = useCallback(() => {
    if (chromeHideTimer.current) {
      window.clearTimeout(chromeHideTimer.current);
    }
    setChromeVisible(true);
    if (!chromePinned) {
      chromeHideTimer.current = window.setTimeout(() => {
        setChromeVisible(false);
      }, READER_CHROME_HIDE_DELAY_MS);
    }
  }, [chromePinned]);

  useEffect(() => {
    const frame = requestAnimationFrame(revealChrome);
    return () => {
      cancelAnimationFrame(frame);
      if (chromeHideTimer.current) {
        window.clearTimeout(chromeHideTimer.current);
      }
    };
  }, [chromePinned, episodeId, mode, revealChrome]);

  useEffect(() => {
    const onPointerActivity = () => {
      lastScrollY.current = window.scrollY;
      revealChrome();
    };
    // 터치 스크롤 제스처가 헤더를 되살리지 않도록 마우스 이동만 취급한다.
    const onMousePointerMove = (event: PointerEvent) => {
      if (event.pointerType && event.pointerType !== "mouse") return;
      onPointerActivity();
    };
    const onFocus = () => revealChrome();
    const onScroll = () => {
      const nextScrollY = window.scrollY;
      if (nextScrollY <= 24) {
        revealChrome();
      } else if (mode === "webtoon" && !chromePinned) {
        // 스크롤 감상 중에는 방향과 무관하게 이미지만 남기고 숨긴다.
        if (Math.abs(nextScrollY - lastScrollY.current) > 8) {
          if (chromeHideTimer.current) {
            window.clearTimeout(chromeHideTimer.current);
          }
          setChromeVisible(false);
        }
      } else if (nextScrollY < lastScrollY.current - 8) {
        revealChrome();
      }
      lastScrollY.current = nextScrollY;
    };
    window.addEventListener("pointermove", onMousePointerMove, {
      passive: true,
    });
    if (mode === "webtoon") {
      // 스크롤 모드에서는 탭(클릭)으로만 다시 활성화한다.
      window.addEventListener("click", onPointerActivity);
    } else {
      window.addEventListener("pointerdown", onPointerActivity, {
        passive: true,
      });
    }
    window.addEventListener("focusin", onFocus);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("pointermove", onMousePointerMove);
      window.removeEventListener("click", onPointerActivity);
      window.removeEventListener("pointerdown", onPointerActivity);
      window.removeEventListener("focusin", onFocus);
      window.removeEventListener("scroll", onScroll);
    };
  }, [chromePinned, mode, revealChrome]);

  useEffect(() => {
    if (
      !episode ||
      episode.access.state === "locked" ||
      mode !== "double" ||
      spreads.length === 0
    ) {
      return;
    }
    if (
      restoredProgressKey.current !== progressRestorationKey &&
      getEpisodeProgress(episode.id)
    ) {
      return;
    }
    if (suppressDoubleProgressSave.current) return;
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
  }, [episode, mode, progressRestorationKey, spreadIndex, spreads]);

  useEffect(() => {
    if (
      !episode ||
      episode.access.state === "locked" ||
      !progressRestorationKey ||
      restoredProgressKey.current === progressRestorationKey
    ) {
      return;
    }
    const saved = getEpisodeProgress(episode.id);
    if (!saved || saved.completed) {
      restoredProgressKey.current = progressRestorationKey;
      return;
    }
    if (mode === "double" && spreads.length > 0) {
      const index = spreads.findIndex((spread) =>
        spread.some((page) => page.order === saved.pageOrder),
      );
      const frame = requestAnimationFrame(() => {
        if (index >= 0) {
          suppressDoubleProgressSave.current = true;
          setSpreadIndex(index);
        }
        restoredProgressKey.current = progressRestorationKey;
      });
      return () => cancelAnimationFrame(frame);
    } else if (mode === "webtoon") {
      const frame = requestAnimationFrame(() => {
        suppressWebtoonProgressSave.current = true;
        document
          .getElementById(`page-${saved.pageOrder}`)
          ?.scrollIntoView({ block: "start" });
        restoredProgressKey.current = progressRestorationKey;
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [episode, mode, progressRestorationKey, spreads]);

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
      suppressDoubleProgressSave.current = false;
      setSpreadIndex(Math.max(0, Math.min(spreads.length - 1, index)));
    },
    [spreads.length],
  );

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.matches("input, textarea, select, button")) return;
      revealChrome();
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
  }, [direction, goToSpread, mode, revealChrome, spreadIndex]);

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
      className={
        `reader-page reader-page--${background} reader-page--${mode}` +
        (chromeVisible ? "" : " reader-page--chrome-hidden")
      }
    >
      <div
        className="reader-progress"
        aria-hidden="true"
        style={{ width: `${readerProgress}%` }}
      />
      <header className="reader-toolbar">
        <Link
          className="reader-toolbar__back"
          href={`/series/${encodeURIComponent(episode.series.slug)}`}
          aria-label="작품으로 돌아가기"
        >
          ←
        </Link>
        <div className="reader-toolbar__title">
          <span>
            {episode.series.title} · 시즌 {episode.season.number} ·{" "}
            {episode.access.volumeNumber}권
            {episode.visibility === "private" ? (
              <em className="reader-toolbar__private">비공개</em>
            ) : null}
          </span>
          <h1>{episodeLabel(episode.number, episode.title)}</h1>
          {viewerCount !== null ? (
            <small className="reader-toolbar__live" role="status">
              <i aria-hidden="true" />
              지금 {viewerCount}명이 읽는 중
            </small>
          ) : null}
        </div>
        <span className="reader-toolbar__progress">{readerProgress}%</span>
      </header>

      <nav
        className="horizontal-scroll-surface reader-controls"
        aria-label="뷰어 도구"
      >
        <div role="group" aria-label="읽기 모드">
          <button
            aria-pressed={mode === "webtoon"}
            onClick={() => {
              setModeSource("user");
              if (mode === "webtoon") return;
              restoredProgressKey.current = null;
              suppressWebtoonProgressSave.current = true;
              setMode("webtoon");
              setSpreadIndex(0);
            }}
          >
            세로 스크롤
          </button>
          <button
            aria-pressed={mode === "double"}
            onClick={() => {
              setModeSource("user");
              if (mode === "double") return;
              restoredProgressKey.current = null;
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

      {settingsOpen || helpOpen || thumbnailsOpen ? (
        <button
          aria-label="열린 도구 닫기"
          className="reader-popover-backdrop"
          onClick={() => {
            setSettingsOpen(false);
            setHelpOpen(false);
            setThumbnailsOpen(false);
          }}
          type="button"
        />
      ) : null}

      {settingsOpen ? (
        <section className="reader-popover reader-settings" aria-label="화면 설정">
          <header className="reader-popover__header">
            <strong>화면 설정</strong>
            <button onClick={() => setSettingsOpen(false)} type="button">
              닫기
            </button>
          </header>
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
        <section className="reader-popover reader-help" aria-label="읽기 도움말">
          <header className="reader-popover__header">
            <strong>읽는 방법</strong>
            <button onClick={() => setHelpOpen(false)} type="button">
              닫기
            </button>
          </header>
          <dl>
            <div><dt>터치</dt><dd>양면 보기에서 화면 좌우 가장자리를 눌러 페이지 이동</dd></div>
            <div><dt>← / →</dt><dd>읽기 방향에 맞춰 양면 이동</dd></div>
            <div><dt>Space</dt><dd>다음 양면</dd></div>
            <div><dt>T</dt><dd>페이지 탐색기 열기</dd></div>
            <div><dt>?</dt><dd>도움말 열기</dd></div>
            <div><dt>Esc</dt><dd>열린 도구 닫기</dd></div>
          </dl>
        </section>
      ) : null}

      {episode.access.state === "locked" ? (
        <ReaderPaywall
          candyBalance={candyBalance}
          candyBusy={candyBusy}
          candyMessage={candyMessage}
          episode={episode}
          onUnlockWithCandy={() => void unlockWithCandy()}
          orderHref={orderHref}
        />
      ) : episode.pages.length === 0 ? (
        <div className="reader-empty">
          <h2>아직 등록된 원고가 없어요.</h2>
          <Link
            className="button button--light"
            href={`/series/${encodeURIComponent(episode.series.slug)}`}
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
              <RecoverablePageImage
                page={page}
                preload={page.order <= 2}
                sizes="min(100vw, 800px)"
                title={episode.title}
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
          <div
            className={
              "horizontal-scroll-surface reader-paged__spread" +
              ((spreads[spreadIndex]?.length ?? 0) <= 1
                ? " reader-paged__spread--single"
                : "")
            }
          >
            {(spreads[spreadIndex] ?? []).map((page) => (
              <RecoverablePageImage
                key={page.id}
                page={page}
                preload
                sizes="(max-width: 900px) 100vw, min(46vw, 800px)"
                title={episode.title}
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
                    suppressWebtoonProgressSave.current = false;
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
                <RecoverablePageImage
                  page={page}
                  sizes="120px"
                  thumbnail
                  title={episode.title}
                />
                <span>{page.order}</span>
              </button>
            ))}
          </div>
        </aside>
      ) : null}

      {showFinish ? (
        <section
          className={
            "reader-finish" +
            (mode === "double" ? " reader-finish--double" : "")
          }
        >
          <p className="eyebrow">
            {mode === "double" ? "마지막 페이지예요" : "여기까지 읽었어요"}
          </p>
          <h2>
            {episode.series.title} {episode.number}화를 모두 읽었습니다.
          </h2>
          <div className="reader-navigation">
            {episode.navigation.previousEpisodeId ? (
              <Link
                className="button button--dark-ghost"
                href={`/read/${encodeURIComponent(episode.navigation.previousEpisodeId)}`}
                scroll={false}
              >
                ← 이전 화
              </Link>
            ) : (
              <span />
            )}
            {episode.navigation.nextEpisodeId ? (
              <Link
                className="button button--light"
                href={`/read/${encodeURIComponent(episode.navigation.nextEpisodeId)}`}
                scroll={false}
              >
                {episode.navigation.nextEpisodeSeasonNumber !== null &&
                episode.navigation.nextEpisodeSeasonNumber !==
                  episode.season.number
                  ? `시즌 ${episode.navigation.nextEpisodeSeasonNumber} · 1화 시작하기 →`
                  : "다음 화 이어보기 →"}
              </Link>
            ) : (
              <Link
                className="button button--light"
                href={`/series/${encodeURIComponent(episode.series.slug)}#edition`}
              >
                소장본 알아보기 →
              </Link>
            )}
          </div>
          <Link
            className="reader-finish__back"
            href={`/series/${encodeURIComponent(episode.series.slug)}`}
          >
            에피소드 목록으로 돌아가기
          </Link>
        </section>
      ) : null}
    </main>
  );
}
