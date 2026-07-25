import { expect, type Locator } from "@playwright/test";

type VisibleCardSnapshot = Array<{
  left: number;
  title: string | null;
}>;

export async function prepareLoopBoundary(rail: Locator) {
  return rail.evaluate(async (element) => {
    const carousel = element as HTMLElement;
    const itemCount = carousel.children.length / 5;
    const trailingCopy = carousel.children.item(
      itemCount * 4,
    ) as HTMLElement;
    const carouselRect = carousel.getBoundingClientRect();
    const targetLeft =
      trailingCopy.getBoundingClientRect().left -
      carouselRect.left +
      carousel.scrollLeft;

    carousel.style.scrollBehavior = "auto";
    carousel.style.scrollSnapType = "none";
    carousel.scrollLeft = targetLeft;
    carousel.style.removeProperty("scroll-behavior");
    carousel.style.removeProperty("scroll-snap-type");
    await new Promise<void>((resolve) =>
      requestAnimationFrame(() => requestAnimationFrame(() => resolve())),
    );

    const railRect = carousel.getBoundingClientRect();
    return Array.from(carousel.children)
      .map((child) => {
        const card = child as HTMLElement;
        const rect = card.getBoundingClientRect();
        return {
          left: rect.left - railRect.left,
          title: card.querySelector("strong, h2")?.textContent ?? null,
          visible: rect.right > railRect.left && rect.left < railRect.right,
        };
      })
      .filter((card) => card.visible)
      .map(({ left, title }) => ({ left, title }));
  });
}

export async function snapshotVisibleCards(rail: Locator) {
  return rail.evaluate((element) => {
    const carousel = element as HTMLElement;
    const railRect = carousel.getBoundingClientRect();
    return Array.from(carousel.children)
      .map((child) => {
        const card = child as HTMLElement;
        const rect = card.getBoundingClientRect();
        return {
          left: rect.left - railRect.left,
          title: card.querySelector("strong, h2")?.textContent ?? null,
          visible: rect.right > railRect.left && rect.left < railRect.right,
        };
      })
      .filter((card) => card.visible)
      .map(({ left, title }) => ({ left, title }));
  });
}

export function expectSameCardPositions(
  before: VisibleCardSnapshot,
  after: VisibleCardSnapshot,
  context = "content rail",
) {
  expect(after.map((card) => card.title)).toEqual(
    before.map((card) => card.title),
  );
  expect(after).toHaveLength(before.length);
  const maximumShift = Math.max(
    0,
    ...after.map((card, index) =>
      Math.abs(card.left - before[index].left),
    ),
  );
  expect(
    maximumShift,
    `${context} boundary shift must stay below 0.5px`,
  ).toBeLessThan(0.5);
}
