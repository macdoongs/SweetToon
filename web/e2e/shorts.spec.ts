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

  const strip = cards.first().locator(".shorts-preview__strip");
  await expect(strip).toHaveCSS("animation-name", "shorts-preview-pan");
  const initialTransform = await strip.evaluate(
    (element) => getComputedStyle(element).transform,
  );
  await page.waitForTimeout(600);
  await expect
    .poll(() => strip.evaluate((element) => getComputedStyle(element).transform))
    .not.toBe(initialTransform);

  await cards.first().getByRole("button", { name: "다음 작품" }).click();
  await expect(cards.nth(1)).toHaveClass(/shorts-card--active/);
  await expect(cards.nth(3).locator(".shorts-preview__strip img").first()).toBeAttached();
  await expect(cards.nth(4).locator(".shorts-preview__strip img")).toHaveCount(0);

  await expect
    .poll(() =>
      page.evaluate(() => localStorage.getItem("sweettoon:reading-progress")),
    )
    .toBeNull();
  expect(presenceRequests).toEqual([]);

  await cards.nth(1).getByRole("link", { name: "1화부터 읽기" }).click();
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
  await firstCard.getByRole("button", { name: "다음 작품" }).click();
  await expect(page.locator(".shorts-card").nth(1)).toHaveClass(
    /shorts-card--active/,
  );
});
