"use client";

import Link from "next/link";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent,
  type PointerEvent,
} from "react";
import { getJson } from "@/lib/api";
import { episodeLabel } from "@/lib/episode-label";
import type {
  ShortsPreviewItem,
  ShortsPreviewResponse,
} from "@/lib/shorts-types";
import { FavoriteButton } from "./favorite-button";

const PRELOAD_AHEAD = 2;
const THUMBNAIL_DURATION_MS = 1000;
const DRAG_THRESHOLD_PX = 56;

type ShortsEventName =
  | "shorts_preview_complete"
  | "shorts_preview_open"
  | "shorts_preview_view";

function trackShortsEvent(
  name: ShortsEventName,
  item: ShortsPreviewItem,
  index: number,
) {
  const gtag = (
    window as typeof window & {
      gtag?: (
        command: "event",
        eventName: string,
        parameters: Record<string, string | number>,
      ) => void;
    }
  ).gtag;
  gtag?.("event", name, {
    episode_id: item.episode.id,
    position: index + 1,
    series_slug: item.series.slug,
  });
}

function ShortsPreviewMedia({
  active,
  item,
  onComplete,
  paused,
  shouldLoad,
}: {
  active: boolean;
  item: ShortsPreviewItem;
  onComplete: () => void;
  paused: boolean;
  shouldLoad: boolean;
}) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const stripRef = useRef<HTMLDivElement>(null);
  const [panDistance, setPanDistance] = useState(0);
  const [previewStarted, setPreviewStarted] = useState(false);

  useEffect(() => {
    if (!shouldLoad || paused || previewStarted) return;
    if (!active) return;
    const timer = window.setTimeout(
      () => setPreviewStarted(true),
      THUMBNAIL_DURATION_MS,
    );
    return () => window.clearTimeout(timer);
  }, [active, paused, previewStarted, shouldLoad]);

  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const strip = stripRef.current;
    if (!viewport || !strip) return;
    setPanDistance(Math.max(0, strip.scrollHeight - viewport.clientHeight));
  }, []);

  useEffect(() => {
    if (!shouldLoad) return;
    const resizeObserver = new ResizeObserver(measure);
    if (viewportRef.current) resizeObserver.observe(viewportRef.current);
    if (stripRef.current) resizeObserver.observe(stripRef.current);
    measure();
    return () => resizeObserver.disconnect();
  }, [measure, shouldLoad]);

  const style = {
    "--shorts-pan-distance": `-${panDistance}px`,
    animationPlayState: paused ? "paused" : "running",
  } as CSSProperties;

  return (
    <div className="shorts-preview" ref={viewportRef}>
      {shouldLoad ? (
        <div
          className={`shorts-preview__strip${active && previewStarted ? " shorts-preview__strip--active" : ""}`}
          onAnimationEnd={() => {
            if (active) onComplete();
          }}
          ref={stripRef}
          style={style}
        >
          {item.pages.map((page, index) => (
            // 전용 리더 WebP를 그대로 사용해 브라우저 HTTP 캐시와 공유한다.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              alt={`${item.series.title} ${item.episode.number}화 미리보기 ${index + 1}페이지`}
              decoding="async"
              draggable={false}
              key={page.id}
              loading={active || index === 0 ? "eager" : "lazy"}
              onLoad={measure}
              src={page.imageUrl}
            />
          ))}
        </div>
      ) : (
        <div className="shorts-preview__placeholder" aria-hidden="true" />
      )}
      {shouldLoad ? (
        <div
          aria-hidden={previewStarted}
          className={`shorts-preview__cover${previewStarted ? " shorts-preview__cover--hidden" : ""}`}
        >
          {/* API 이미지 프록시 URL을 사용해 리더 미리보기와 브라우저 캐시를 공유한다. */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt={`${item.series.title} 썸네일`}
            decoding="async"
            draggable={false}
            loading={active ? "eager" : "lazy"}
            src={item.series.coverUrl ?? item.pages[0]?.imageUrl}
          />
          <span>잠시 후 미리보기</span>
        </div>
      ) : null}
    </div>
  );
}

export function ShortsFeed({
  initialError = null,
  initialItems,
}: {
  initialError?: string | null;
  initialItems: ShortsPreviewItem[];
}) {
  const feedRef = useRef<HTMLDivElement>(null);
  const cardRefs = useRef<Array<HTMLElement | null>>([]);
  const viewedPreviews = useRef(new Set<string>());
  const activeIndexRef = useRef(0);
  const dragRef = useRef<{
    pointerId: number;
    pointerType: string;
    startIndex: number;
    startScrollTop: number;
    startY: number;
  } | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(initialError);
  const [items, setItems] = useState(initialItems);
  const [loading, setLoading] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    activeIndexRef.current = activeIndex;
  }, [activeIndex]);

  useEffect(() => {
    const root = feedRef.current;
    if (!root || items.length === 0) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((left, right) => right.intersectionRatio - left.intersectionRatio)[0];
        if (!visible) return;
        const index = Number((visible.target as HTMLElement).dataset.index);
        if (Number.isInteger(index)) {
          setActiveIndex(index);
          setPaused(false);
        }
      },
      { root, threshold: [0.6, 0.8] },
    );
    cardRefs.current.forEach((card) => {
      if (card) observer.observe(card);
    });
    return () => observer.disconnect();
  }, [items]);

  useEffect(() => {
    const end = Math.min(items.length, activeIndex + PRELOAD_AHEAD + 1);
    const images = items
      .slice(activeIndex, end)
      .flatMap((item) => [
        ...(item.series.coverUrl ? [item.series.coverUrl] : []),
        ...item.pages.map((page) => page.imageUrl),
      ])
      .map((src) => {
        const image = new window.Image();
        image.decoding = "async";
        image.src = src;
        return image;
      });
    return () => {
      images.forEach((image) => {
        image.src = "";
      });
    };
  }, [activeIndex, items]);

  useEffect(() => {
    const item = items[activeIndex];
    if (!item) return;
    const key = `${item.series.slug}:${item.episode.id}`;
    if (viewedPreviews.current.has(key)) return;
    viewedPreviews.current.add(key);
    trackShortsEvent("shorts_preview_view", item, activeIndex);
  }, [activeIndex, items]);

  const moveTo = useCallback(
    (index: number) => {
      const nextIndex = Math.max(0, Math.min(items.length - 1, index));
      cardRefs.current[nextIndex]?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    },
    [items.length],
  );

  const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowDown" || event.key === "PageDown") {
      event.preventDefault();
      moveTo(activeIndex + 1);
    } else if (event.key === "ArrowUp" || event.key === "PageUp") {
      event.preventDefault();
      moveTo(activeIndex - 1);
    }
  };

  const handlePointerDown = (event: PointerEvent<HTMLDivElement>) => {
    if (!event.isPrimary || (event.pointerType === "mouse" && event.button !== 0)) {
      return;
    }
    if ((event.target as HTMLElement).closest("a, button")) return;
    const feed = feedRef.current;
    if (!feed) return;
    dragRef.current = {
      pointerId: event.pointerId,
      pointerType: event.pointerType,
      startIndex: activeIndexRef.current,
      startScrollTop: feed.scrollTop,
      startY: event.clientY,
    };
    if (event.pointerType === "mouse") {
      event.currentTarget.setPointerCapture(event.pointerId);
      setDragging(true);
    }
  };

  const handlePointerMove = (event: PointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    const feed = feedRef.current;
    if (!drag || !feed || drag.pointerId !== event.pointerId) return;
    if (drag.pointerType === "mouse") {
      event.preventDefault();
      feed.scrollTop = drag.startScrollTop + drag.startY - event.clientY;
    }
  };

  const finishPointerGesture = (
    event: PointerEvent<HTMLDivElement>,
    cancelled = false,
  ) => {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    setDragging(false);
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    if (cancelled) return;
    const distance = drag.startY - event.clientY;
    if (Math.abs(distance) < DRAG_THRESHOLD_PX) {
      if (drag.pointerType === "mouse") moveTo(drag.startIndex);
      return;
    }
    moveTo(drag.startIndex + (distance > 0 ? 1 : -1));
  };

  const shuffle = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await getJson<ShortsPreviewResponse>(
        `/api/discovery/shorts?limit=10&shuffle=${Date.now()}`,
      );
      setItems(response.items);
      viewedPreviews.current.clear();
      setActiveIndex(0);
      requestAnimationFrame(() => moveTo(0));
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "새로운 쇼츠를 불러오지 못했습니다.",
      );
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return (
      <main className="shorts-page shorts-page--empty">
        <section className="shorts-empty" aria-live="polite">
          <p className="eyebrow">SweetToon shorts</p>
          <h1>미리 볼 수 있는 작품을 준비하고 있어요</h1>
          <p>{error ?? "공개된 무료 회차가 생기면 이곳에서 먼저 보여드릴게요."}</p>
          <button className="button button--primary" disabled={loading} onClick={shuffle}>
            {loading ? "불러오는 중…" : "다시 시도"}
          </button>
        </section>
      </main>
    );
  }

  return (
    <main className="shorts-page">
      <header className="shorts-heading">
        <div>
          <p className="eyebrow">SweetToon shorts</p>
          <h1>첫 장면으로 만나는 랜덤 웹툰</h1>
        </div>
        <button className="button button--ghost" disabled={loading} onClick={shuffle}>
          {loading ? "섞는 중…" : "다른 작품 섞기"}
        </button>
      </header>

      {error ? <p className="shorts-error" role="status">{error}</p> : null}
      <div
        aria-label="웹툰 쇼츠"
        aria-describedby="shorts-gesture-help"
        className={`shorts-feed${dragging ? " shorts-feed--dragging" : ""}`}
        onKeyDown={handleKeyDown}
        onPointerCancel={(event) => finishPointerGesture(event, true)}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={finishPointerGesture}
        ref={feedRef}
        role="region"
        tabIndex={0}
      >
        <p className="sr-only" id="shorts-gesture-help">
          위아래로 스와이프하거나 마우스로 드래그해 작품을 전환할 수 있습니다.
        </p>
        {items.map((item, index) => {
          const active = index === activeIndex;
          const shouldLoad =
            index >= Math.max(0, activeIndex - 1) &&
            index <= activeIndex + PRELOAD_AHEAD;
          return (
            <article
              aria-label={`${item.series.title} 미리보기`}
              className={`shorts-card${active ? " shorts-card--active" : ""}`}
              data-index={index}
              key={`${item.series.slug}-${item.episode.id}`}
              ref={(element) => {
                cardRefs.current[index] = element;
              }}
            >
              <ShortsPreviewMedia
                active={active}
                item={item}
                onComplete={() => {
                  trackShortsEvent("shorts_preview_complete", item, index);
                  if (index < items.length - 1) moveTo(index + 1);
                }}
                paused={active && paused}
                shouldLoad={shouldLoad}
              />
              <div className="shorts-card__shade" aria-hidden="true" />
              <div className="shorts-card__meta">
                <span>{item.series.genre}</span>
                <h2>{item.series.title}</h2>
                <p>{item.series.authorName}</p>
                <small>
                  {episodeLabel(item.episode.number, item.episode.title)} · 첫 {item.pages.length}페이지 미리보기
                </small>
                <div className="shorts-card__actions">
                  <FavoriteButton
                    series={{
                      slug: item.series.slug,
                      title: item.series.title,
                      synopsis: item.series.synopsis,
                      genre: item.series.genre,
                      coverUrl: item.series.coverUrl,
                      authorName: item.series.authorName,
                    }}
                  />
                  <Link
                    className="button button--light"
                    href={`/read/${encodeURIComponent(item.episode.id)}`}
                    onClick={() =>
                      trackShortsEvent("shorts_preview_open", item, index)
                    }
                  >
                    {item.episode.number === 1
                      ? "1화부터 읽기"
                      : `${item.episode.number}화 읽기`}
                  </Link>
                </div>
              </div>
              <div className="shorts-card__controls">
                <span aria-live="polite">{index + 1} / {items.length}</span>
                <button
                  aria-label={paused ? "미리보기 계속 재생" : "미리보기 일시정지"}
                  onClick={() => setPaused((current) => !current)}
                  type="button"
                >
                  {paused ? "▶" : "Ⅱ"}
                </button>
                <button
                  aria-label="이전 작품"
                  disabled={index === 0}
                  onClick={() => moveTo(index - 1)}
                  type="button"
                >
                  ↑
                </button>
                <button
                  aria-label="다음 작품"
                  disabled={index === items.length - 1}
                  onClick={() => moveTo(index + 1)}
                  type="button"
                >
                  ↓
                </button>
              </div>
            </article>
          );
        })}
      </div>
    </main>
  );
}
