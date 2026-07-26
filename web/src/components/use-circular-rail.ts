"use client";

import { useCallback, useEffect, useRef } from "react";

const LOOP_COPY_COUNT = 5;
const CENTER_COPY_INDEX = 2;
const LOWER_RESET_COPY_INDEX = 1;
const UPPER_RESET_COPY_INDEX = 4;
const FALLBACK_SETTLE_DELAY_MS = 140;
const STABLE_SCROLL_EPSILON = 0.01;

type CircularRailOptions = {
  cardWidth: (viewportWidth: number) => number;
  itemCount: number;
  scrollDistance?: number;
};

export type CircularRailCopy<T> = {
  copyIndex: number;
  duplicate: boolean;
  eager: boolean;
  item: T;
};

export function prioritizeThumbnailItems<T>(
  items: readonly T[],
  hasThumbnail: (item: T) => boolean,
): T[] {
  return [...items].sort(
    (left, right) =>
      Number(hasThumbnail(right)) - Number(hasThumbnail(left)),
  );
}

function getContentLeft(
  rail: HTMLElement,
  item: HTMLElement,
  railRect = rail.getBoundingClientRect(),
) {
  return item.getBoundingClientRect().left - railRect.left + rail.scrollLeft;
}

export function buildCircularRailCopies<T>(
  items: T[],
): CircularRailCopy<T>[] {
  if (items.length <= 1) {
    return items.map((item) => ({
      copyIndex: 0,
      duplicate: false,
      eager: false,
      item,
    }));
  }

  return Array.from({ length: LOOP_COPY_COUNT }, (_, copyIndex) =>
    items.map((item) => ({
      copyIndex,
      duplicate: copyIndex !== CENTER_COPY_INDEX,
      eager: copyIndex > CENTER_COPY_INDEX,
      item,
    })),
  ).flat();
}

export function useCircularRail<T extends HTMLElement>({
  cardWidth,
  itemCount,
  scrollDistance = 720,
}: CircularRailOptions) {
  const railRef = useRef<T>(null);
  const restoreScrollBehaviorFrameRef = useRef<number | null>(null);
  const stableScrollFrameRef = useRef<number | null>(null);
  const repositioningRef = useRef(false);
  const loopEnabled = itemCount > 1;

  const jumpWithoutAnimation = useCallback(
    (rail: HTMLElement, left: number) => {
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
      !loopEnabled ||
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
  }, [itemCount, jumpWithoutAnimation, loopEnabled]);

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
    if (!rail) {
      return;
    }

    const alignCardGrid = () => {
      rail.style.setProperty(
        "--circular-rail-card-width",
        `${Math.round(cardWidth(window.innerWidth))}px`,
      );
      const firstCenterCopy = rail.children.item(
        itemCount * CENTER_COPY_INDEX,
      ) as HTMLElement | null;
      if (loopEnabled && firstCenterCopy) {
        jumpWithoutAnimation(rail, getContentLeft(rail, firstCenterCopy));
      }
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
    const supportsScrollEnd = loopEnabled && Reflect.has(rail, "onscrollend");
    if (supportsScrollEnd) {
      rail.addEventListener("scrollend", normalizeAfterStableFrame);
    } else if (loopEnabled) {
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
      rail.style.removeProperty("--circular-rail-card-width");
      rail.style.removeProperty("scroll-behavior");
      rail.style.removeProperty("scroll-snap-type");
      if (supportsScrollEnd) {
        rail.removeEventListener("scrollend", normalizeAfterStableFrame);
      } else if (loopEnabled) {
        rail.removeEventListener("scroll", normalizeAfterSettlingFallback);
      }
    };
  }, [
    cardWidth,
    itemCount,
    jumpWithoutAnimation,
    loopEnabled,
    normalizeAfterStableFrame,
  ]);

  const scroll = useCallback(
    (direction: -1 | 1) => {
      railRef.current?.scrollBy({
        left: direction * scrollDistance,
        behavior: "smooth",
      });
    },
    [scrollDistance],
  );

  return { loopEnabled, railRef, scroll };
}
