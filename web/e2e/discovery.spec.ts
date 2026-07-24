import { expect, test } from "@playwright/test";

test("독자가 URL 필터로 연재작과 소장 가능한 작품을 탐색한다", async ({
  page,
}) => {
  await page.goto("/");

  const cards = page.locator(".series-card");
  const allCount = await cards.count();
  expect(allCount).toBeGreaterThan(1);
  const firstCover = cards.first().locator("img");
  await expect(firstCover).toHaveAttribute(
    "src",
    /\/_next\/image\?url=%2Fapi%2Fimages%2F[^&]+cover\.webp/,
  );
  await expect
    .poll(() =>
      firstCover.evaluate(
        (image) => (image as HTMLImageElement).naturalWidth,
      ),
    )
    .toBeGreaterThan(0);
  await expect(
    page.getByRole("link", { name: "전체", exact: true }),
  ).toHaveAttribute("aria-current", "page");

  await page.getByRole("link", { name: "연재 중", exact: true }).click();
  await expect(page).toHaveURL(/\/\?filter=ongoing#discover$/);
  await expect(
    page.getByRole("link", { name: "연재 중", exact: true }),
  ).toHaveAttribute("aria-current", "page");
  expect(await cards.count()).toBeGreaterThan(0);
  expect(await cards.count()).toBeLessThan(allCount);

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

  const footer = page.locator(".site-footer");
  await expect(footer).toBeVisible();
  await expect(footer.getByText("실제 결제·배송 없음")).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "GitHub 저장소 ↗" }),
  ).toHaveAttribute("href", "https://github.com/macdoongs/SweetToon");
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
