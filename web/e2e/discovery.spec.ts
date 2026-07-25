import { expect, test } from "@playwright/test";

test("독자가 URL 필터로 연재작과 소장 가능한 작품을 탐색한다", async ({
  page,
}) => {
  await page.goto("/");

  const cards = page.locator(".series-card");
  const allCount = await cards.count();
  expect(allCount).toBe(12);
  await expect(cards.first().locator(".series-cover")).toBeVisible();
  await expect(cards.locator(".series-cover--empty")).toHaveCount(0);
  await expect(cards.locator("img.series-cover")).toHaveCount(12);
  await expect(page.locator(".featured-book__cover img")).toBeVisible();
  await expect(
    page.getByRole("link", {
      name: "전체",
      description: "모든 작품",
    }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "연재 중", exact: true }).click();
  await expect(page).toHaveURL(/\/\?filter=ongoing#discover$/);
  await expect(
    page.getByRole("link", { name: "연재 중", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(await cards.count()).toBeGreaterThan(0);

  await page
    .getByRole("link", { name: "완결·소장 가능", exact: true })
    .click();
  await expect(page).toHaveURL(/\/\?filter=collectible#discover$/);
  await expect(
    page.getByRole("link", { name: "완결·소장 가능", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(await cards.count()).toBeGreaterThan(0);
  await expect(cards.locator(".series-card__collectible")).toHaveCount(
    await cards.count(),
  );

  await page.goBack();
  await expect(page).toHaveURL(/\/\?filter=ongoing#discover$/);
  await expect(
    page.getByRole("link", { name: "연재 중", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("navigation", { name: "요일별 작품" })
    .getByRole("link", { name: "월", exact: true })
    .click();
  await expect(page).toHaveURL(/weekday=mon/);
  await expect(
    page.getByRole("navigation", { name: "요일별 작품" })
      .getByRole("link", { name: "월", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.goto("/#discover");
  const initialPageCount = await cards.count();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect.poll(() => cards.count()).toBeGreaterThan(initialPageCount);
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect.poll(() => cards.count()).toBe(28);
  const optimizedCover = cards.locator("img").first();
  await expect(optimizedCover).toHaveAttribute(
    "src",
    /\/_next\/image\?url=%2Fapi%2Fimages%2F[^&]+cover\.webp/,
  );
  await expect
    .poll(() =>
      optimizedCover.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);

  const footer = page.locator(".site-footer");
  await expect(footer).toBeVisible();
  await expect(footer.getByText("실제 결제·배송 없음")).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "GitHub 저장소 ↗" }),
  ).toHaveAttribute("href", "https://github.com/macdoongs/SweetToon");
});

test("찜 취향을 바탕으로 가로 추천 레일을 갱신한다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const recommendations = page.getByRole("region", {
    name: "취향을 이어갈 다음 작품",
  });
  await expect(recommendations).toBeVisible();
  await expect(recommendations).toContainText(
    "아직 기록이 없어 장르별 작품부터 준비했어요.",
  );
  await expect(
    recommendations.locator(".recommendation-shelf"),
  ).toHaveCount(3);
  await expect(
    recommendations.locator(".recommendation-card img").first(),
  ).toBeVisible();

  await page.goto("/series/moonlight-laundry");
  await page.getByRole("button", { name: "찜하기" }).click();
  await page.goto("/");

  const personalizedShelf = page
    .locator(".recommendation-shelf")
    .filter({ hasText: "〈달빛 세탁소〉을 찜한 당신을 위해" });
  await expect(personalizedShelf).toBeVisible();
  await expect(recommendations).not.toContainText(
    "아직 기록이 없어 장르별 작품부터 준비했어요.",
  );
  await expect(
    personalizedShelf.getByRole("link", { name: /달빛 세탁소/ }),
  ).toHaveCount(0);

  const rail = personalizedShelf.locator(".recommendation-rail");
  await expect
    .poll(() =>
      rail.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    )
    .toBe(true);
  await personalizedShelf
    .getByRole("button", { name: /다음 작품 보기/ })
    .click();
  await expect
    .poll(() => rail.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(0);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("설치 가능한 PWA 셸과 서비스 워커를 제공한다", async ({ page }) => {
  await page.goto("/");

  const manifestResponse = await page.request.get("/manifest.webmanifest");
  expect(manifestResponse.ok()).toBeTruthy();
  const manifest = await manifestResponse.json();
  expect(manifest).toMatchObject({
    name: "SweetToon — 읽고, 한 권으로 소장하다",
    short_name: "SweetToon",
    start_url: "/",
    display: "standalone",
  });
  expect(manifest.icons).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ sizes: "192x192" }),
      expect.objectContaining({ sizes: "512x512", purpose: "maskable" }),
    ]),
  );

  const workerResponse = await page.request.get("/sw.js");
  expect(workerResponse.ok()).toBeTruthy();
  expect(workerResponse.headers()["cache-control"]).toContain("no-store");
  expect(workerResponse.headers()["content-type"]).toContain(
    "application/javascript",
  );

  await expect
    .poll(() =>
      page.evaluate(async () => {
        if (!("serviceWorker" in navigator)) return null;
        const registration = await navigator.serviceWorker.ready;
        return new URL(registration.scope).pathname;
      }),
    )
    .toBe("/");
});

test("최신 회차 RSS를 발견하고 구독할 수 있다", async ({ page }) => {
  await page.goto("/");

  await expect(page.locator('link[type="application/rss+xml"]')).toHaveAttribute(
    "href",
    "/feed.xml",
  );
  await expect(
    page.getByRole("link", { name: "새 회차 RSS" }),
  ).toHaveAttribute("href", "/feed.xml");

  const response = await page.request.get("/feed.xml");
  expect(response.ok()).toBeTruthy();
  expect(response.headers()["content-type"]).toContain("application/rss+xml");

  const feed = await response.text();
  expect(feed).toContain('<rss version="2.0"');
  expect(feed).toContain("<language>ko-KR</language>");
  expect(feed).toContain("<item>");
  expect(feed).toContain("https://sweettoon.katsuranbo.com/read/");
});
