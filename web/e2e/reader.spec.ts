import { expect, test } from "@playwright/test";

test("독자가 홈에서 작품을 발견하고 다음 화까지 읽는다", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("좋아한 이야기를");

  const seriesLink = page.locator(".series-card h3 a").first();
  const seriesTitle = (await seriesLink.textContent())?.trim();
  expect(seriesTitle).toBeTruthy();
  await seriesLink.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    seriesTitle ?? "",
  );
  await page.getByRole("link", { name: "첫 화부터 읽기" }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeHidden();
  const episodeHeading = page.locator(".reader-toolbar h1");
  await expect(episodeHeading).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const currentEpisode = await episodeHeading.innerText();

  const firstCut = page.locator(".webtoon-strip__cut img").first();
  await expect(firstCut).toBeVisible();
  expect(
    await firstCut.evaluate((image) => {
      const strip = image.closest(".webtoon-strip");
      return strip !== null && image.clientWidth <= strip.clientWidth;
    }),
  ).toBeTruthy();

  await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight / 2);
  });
  await expect
    .poll(async () =>
      page.locator(".reader-progress").evaluate((element) => element.clientWidth),
    )
    .toBeGreaterThan(0);

  await page.getByRole("link", { name: /다음 화 이어보기/ }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".reader-toolbar h1")).not.toHaveText(currentEpisode);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
});
