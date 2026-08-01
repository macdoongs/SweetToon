import { expect, test } from "@playwright/test";

test("랜덤 웹툰 쇼츠를 미리 보고 정식 1화로 이동한다 @demo", async ({
  page,
}) => {
  const presenceRequests: string[] = [];
  await page.addInitScript(() => {
    const target = window as typeof window & {
      __shortsEvents?: string[];
      gtag?: (
        command: "event",
        eventName: string,
        parameters: Record<string, string | number>,
      ) => void;
    };
    target.__shortsEvents = [];
    target.gtag = (_command, eventName) => {
      target.__shortsEvents?.push(eventName);
    };
  });
  page.on("request", (request) => {
    if (request.url().includes("/presence")) {
      presenceRequests.push(request.url());
    }
  });

  const response = await page.request.get("/api/discovery/shorts?limit=10");
  expect(response.ok()).toBeTruthy();
  const payload = (await response.json()) as {
    items: Array<{
      episode: { id: string };
      pages: Array<{ imageUrl: string }>;
    }>;
  };
  expect(payload.items).toHaveLength(10);
  expect(payload.items.every((item) => item.pages.length >= 1)).toBeTruthy();
  expect(payload.items.every((item) => item.pages.length <= 2)).toBeTruthy();

  const episodeResponse = await page.request.get(
    `/api/episodes/${encodeURIComponent(payload.items[0].episode.id)}`,
  );
  expect(episodeResponse.ok()).toBeTruthy();
  expect((await episodeResponse.json()).access.state).toBe("free");

  await page.goto("/shorts");
  await expect(
    page.getByRole("heading", { name: "첫 장면으로 만나는 랜덤 웹툰" }),
  ).toBeVisible();

  const cards = page.locator(".shorts-card");
  await expect(cards).toHaveCount(10);
  await expect(cards.first()).toHaveClass(/shorts-card--active/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { __shortsEvents?: string[] }
        ).__shortsEvents?.includes("shorts_preview_view"),
      ),
    )
    .toBe(true);
  await expect(cards.nth(0).locator(".shorts-preview__strip img").first()).toBeVisible();
  await expect(cards.nth(1).locator(".shorts-preview__strip img").first()).toBeAttached();
  await expect(cards.nth(2).locator(".shorts-preview__strip img").first()).toBeAttached();
  await expect(cards.nth(3).locator(".shorts-preview__strip img")).toHaveCount(0);

  const cover = cards.first().locator(".shorts-preview__cover");
  await expect(cover).toBeVisible();
  await expect(cover.locator("img")).toHaveAttribute("alt", /썸네일$/);
  const strip = cards.first().locator(".shorts-preview__strip");
  await expect(strip).toHaveCSS("animation-name", "none");
  await expect(cover).toHaveClass(/shorts-preview__cover--hidden/, {
    timeout: 2_000,
  });
  await expect(strip).toHaveCSS("animation-name", "shorts-preview-pan");
  const previewDurationSeconds = Number.parseFloat(
    await strip.evaluate(
      (element) => getComputedStyle(element).animationDuration,
    ),
  );
  expect(previewDurationSeconds).toBeGreaterThanOrEqual(7);
  expect(previewDurationSeconds).toBeLessThanOrEqual(10);
  const initialTransform = await strip.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.waitForTimeout(600);
  await expect
    .poll(() => strip.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initialTransform);

  await strip.evaluate((element) => {
    element.style.animationDuration = "100ms";
  });
  await expect(cards.nth(1)).toHaveClass(/shorts-card--active/);
  await expect
    .poll(() =>
      page.evaluate(() =>
        (
          window as typeof window & { __shortsEvents?: string[] }
        ).__shortsEvents?.includes("shorts_preview_complete"),
      ),
    )
    .toBe(true);
  await expect(cards.nth(3).locator(".shorts-preview__strip img").first()).toBeAttached();
  await expect(cards.nth(4).locator(".shorts-preview__strip img")).toHaveCount(0);

  const feed = page.getByRole("region", { name: "웹툰 쇼츠" });
  const box = await feed.boundingBox();
  expect(box).not.toBeNull();
  await page.mouse.move(box!.x + box!.width / 2, box!.y + box!.height / 2);
  await page.mouse.down();
  await page.mouse.move(
    box!.x + box!.width / 2,
    box!.y + box!.height / 2 - 140,
    { steps: 5 },
  );
  await page.mouse.up();
  await expect(cards.nth(2)).toHaveClass(/shorts-card--active/);

  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("sweettoon:reading-progress")),
    )
    .toBeNull();
  expect(presenceRequests).toEqual([]);

  await cards.nth(2).getByRole("link", { name: "1화부터 읽기" }).click();
  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".reader-page")).toBeVisible();
  expect(
    await page.evaluate(() =>
      (
        window as typeof window & { __shortsEvents?: string[] }
      ).__shortsEvents?.includes("shorts_preview_open"),
    ),
  ).toBe(true);
});

test("모바일과 모션 축소 환경에서 쇼츠를 정지 화면으로 탐색한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shorts");

  const feed = page.getByRole("region", { name: "웹툰 쇼츠" });
  await expect(feed).toBeVisible();
  const firstCard = page.locator(".shorts-card").first();
  await expect(firstCard.locator(".shorts-preview__strip")).toHaveCSS(
    "animation-name",
    "none",
  );
  await expect(firstCard.locator(".shorts-preview__cover")).toBeVisible();
  const feedBox = await feed.boundingBox();
  expect(feedBox).not.toBeNull();
  await feed.dispatchEvent("pointerdown", {
    button: 0,
    clientY: feedBox!.y + 400,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });
  await feed.dispatchEvent("pointerup", {
    button: 0,
    clientY: feedBox!.y + 280,
    isPrimary: true,
    pointerId: 7,
    pointerType: "touch",
  });
  await expect(page.locator(".shorts-card").nth(1)).toHaveClass(
    /shorts-card--active/,
  );
});
