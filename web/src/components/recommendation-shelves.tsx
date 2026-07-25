"use client";

import Image from "next/image";
import Link from "next/link";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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

const LOOP_COPY_COUNT = 5;
const CENTER_COPY_INDEX = 2;
const LOWER_RESET_COPY_INDEX = 1;
const UPPER_RESET_COPY_INDEX = 4;
const FALLBACK_SETTLE_DELAY_MS = 140;
const STABLE_SCROLL_EPSILON = 0.01;
const MOBILE_RECOMMENDATION_BREAKPOINT = 700;

function getRoundedCardWidth(viewportWidth: number) {
  const responsiveWidth =
    viewportWidth <= MOBILE_RECOMMENDATION_BREAKPOINT
      ? Math.min(viewportWidth * 0.44, 180)
      : Math.min(Math.max(viewportWidth * 0.17, 156), 210);
  return Math.round(responsiveWidth);
}

function getContentLeft(
  rail: HTMLUListElement,
  item: HTMLElement,
  railRect = rail.getBoundingClientRect(),
) {
  return item.getBoundingClientRect().left - railRect.left + rail.scrollLeft;
}

function RecommendationCard({
  duplicate = false,
  eager = false,
  series,
}: {
  duplicate?: boolean;
  eager?: boolean;
  series: SeriesSummary;
}) {
  return (
    <li
      aria-hidden={duplicate || undefined}
      className="recommendation-card"
      data-preloaded={eager || undefined}
    >
      <Link
        href={`/series/${encodeURIComponent(series.slug)}`}
        tabIndex={duplicate ? -1 : undefined}
      >
        <div className="recommendation-card__cover">
          {series.coverUrl ? (
            <Image
              alt={`${series.title} 표지`}
              height={560}
              loading={eager ? "eager" : undefined}
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
  const railRef = useRef<HTMLUListElement>(null);
  const restoreScrollBehaviorFrameRef = useRef<number | null>(null);
  const stableScrollFrameRef = useRef<number | null>(null);
  const repositioningRef = useRef(false);

  const jumpWithoutAnimation = useCallback(
    (rail: HTMLUListElement, left: number) => {
      if (restoreScrollBehaviorFrameRef.current !== null) {
        cancelAnimationFrame(restoreScrollBehaviorFrameRef.current);
      }
      repositioningRef.current = true;
      rail.style.scrollBehavior = "auto";
      rail.style.scrollSnapType = "none";
      rail.scrollLeft = left;
      restoreScrollBehaviorFrameRef.current = requestAnimationFrame(() => {
        rail.style.removeProperty("scroll-behavior");
        rail.style.removeProperty("scroll-snap-type");
        restoreScrollBehaviorFrameRef.current = requestAnimationFrame(() => {
          repositioningRef.current = false;
          restoreScrollBehaviorFrameRef.current = null;
        });
      });
    },
    [],
  );

  const normalizeCircularPosition = useCallback(() => {
    const rail = railRef.current;
    const itemCount = shelf.items.length;
    const firstCenterCopy = rail?.children.item(
      itemCount * CENTER_COPY_INDEX,
    ) as HTMLElement | null;
    const firstNextCopy = rail?.children.item(
      itemCount * (CENTER_COPY_INDEX + 1),
    ) as HTMLElement | null;
    const lowerResetBoundary = rail?.children.item(
      itemCount * LOWER_RESET_COPY_INDEX,
    ) as HTMLElement | null;
    const upperResetBoundary = rail?.children.item(
      itemCount * UPPER_RESET_COPY_INDEX,
    ) as HTMLElement | null;
    if (
      !rail ||
      !firstCenterCopy ||
      !firstNextCopy ||
      !lowerResetBoundary ||
      !upperResetBoundary
    ) {
      return;
    }

    const railRect = rail.getBoundingClientRect();
    const centerCopyLeft = getContentLeft(rail, firstCenterCopy, railRect);
    const nextCopyLeft = getContentLeft(rail, firstNextCopy, railRect);
    const lowerBoundaryLeft = getContentLeft(
      rail,
      lowerResetBoundary,
      railRect,
    );
    const upperBoundaryLeft = getContentLeft(
      rail,
      upperResetBoundary,
      railRect,
    );
    if (rail.scrollLeft < lowerBoundaryLeft) {
      const forwardResetDistance = nextCopyLeft - lowerBoundaryLeft;
      jumpWithoutAnimation(rail, rail.scrollLeft + forwardResetDistance);
    } else if (rail.scrollLeft >= upperBoundaryLeft) {
      const backwardResetDistance = upperBoundaryLeft - centerCopyLeft;
      jumpWithoutAnimation(rail, rail.scrollLeft - backwardResetDistance);
    }
  }, [jumpWithoutAnimation, shelf.items.length]);

  const normalizeAfterStableFrame = useCallback(() => {
    const rail = railRef.current;
    if (!rail || repositioningRef.current) {
      return;
    }
    if (stableScrollFrameRef.current !== null) {
      cancelAnimationFrame(stableScrollFrameRef.current);
    }

    let previousScrollLeft = rail.scrollLeft;
    const confirmStablePosition = () => {
      if (repositioningRef.current) {
        stableScrollFrameRef.current = null;
        return;
      }
      const currentScrollLeft = rail.scrollLeft;
      if (
        Math.abs(currentScrollLeft - previousScrollLeft) >
        STABLE_SCROLL_EPSILON
      ) {
        previousScrollLeft = currentScrollLeft;
        stableScrollFrameRef.current = requestAnimationFrame(
          confirmStablePosition,
        );
        return;
      }

      stableScrollFrameRef.current = null;
      normalizeCircularPosition();
    };

    stableScrollFrameRef.current = requestAnimationFrame(
      confirmStablePosition,
    );
  }, [normalizeCircularPosition]);

  useEffect(() => {
    const rail = railRef.current;
    const firstCenterCopy = rail?.children.item(
      shelf.items.length * CENTER_COPY_INDEX,
    ) as HTMLElement | null;
    if (!rail || !firstCenterCopy) {
      return;
    }

    const alignCardGrid = () => {
      rail.style.setProperty(
        "--recommendation-card-width",
        `${getRoundedCardWidth(window.innerWidth)}px`,
      );
      jumpWithoutAnimation(rail, getContentLeft(rail, firstCenterCopy));
    };
    alignCardGrid();
    let resizeFrame: number | undefined;
    const realignAfterResize = () => {
      if (resizeFrame !== undefined) {
        cancelAnimationFrame(resizeFrame);
      }
      resizeFrame = requestAnimationFrame(alignCardGrid);
    };
    window.addEventListener("resize", realignAfterResize);

    let settleTimer: ReturnType<typeof setTimeout> | undefined;
    const normalizeAfterSettlingFallback = () => {
      if (repositioningRef.current) {
        return;
      }
      clearTimeout(settleTimer);
      settleTimer = setTimeout(
        normalizeAfterStableFrame,
        FALLBACK_SETTLE_DELAY_MS,
      );
    };
    const supportsScrollEnd = Reflect.has(rail, "onscrollend");
    if (supportsScrollEnd) {
      rail.addEventListener("scrollend", normalizeAfterStableFrame);
    } else {
      rail.addEventListener("scroll", normalizeAfterSettlingFallback, {
        passive: true,
      });
    }
    return () => {
      clearTimeout(settleTimer);
      window.removeEventListener("resize", realignAfterResize);
      if (resizeFrame !== undefined) {
        cancelAnimationFrame(resizeFrame);
      }
      if (restoreScrollBehaviorFrameRef.current !== null) {
        cancelAnimationFrame(restoreScrollBehaviorFrameRef.current);
      }
      if (stableScrollFrameRef.current !== null) {
        cancelAnimationFrame(stableScrollFrameRef.current);
      }
      repositioningRef.current = false;
      rail.style.removeProperty("--recommendation-card-width");
      rail.style.removeProperty("scroll-behavior");
      rail.style.removeProperty("scroll-snap-type");
      if (supportsScrollEnd) {
        rail.removeEventListener("scrollend", normalizeAfterStableFrame);
      } else {
        rail.removeEventListener("scroll", normalizeAfterSettlingFallback);
      }
    };
  }, [
    jumpWithoutAnimation,
    normalizeAfterStableFrame,
    shelf.items.length,
  ]);

  const scroll = (direction: -1 | 1) => {
    railRef.current?.scrollBy({
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
      <ul
        aria-roledescription="순환형 캐러셀"
        className="horizontal-scroll-surface recommendation-rail"
        id={railId}
        ref={railRef}
      >
        {Array.from({ length: LOOP_COPY_COUNT }, (_, copyIndex) =>
          shelf.items.map((series) => (
            <RecommendationCard
              duplicate={copyIndex !== CENTER_COPY_INDEX}
              eager={copyIndex > CENTER_COPY_INDEX}
              key={`${copyIndex}-${series.id}`}
              series={series}
            />
          )),
        )}
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
            {!favorites.length && !Object.keys(progress).length
              ? "아직 기록이 없어도 괜찮아요. 서로 어울리는 장르를 세 가지 분류로 모았어요."
              : "찜과 최근 열람 기록을 바탕으로 추천해요."}
          </p>
        </header>
        {shelves.map((shelf) => (
          <Shelf key={shelf.id} shelf={shelf} />
        ))}
      </div>
    </section>
  );
}
