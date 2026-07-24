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
  const currentEpisode = await page.locator(".reader-toolbar strong").innerText();

  await page.getByRole("link", { name: /다음 화 이어보기/ }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".reader-toolbar strong")).not.toHaveText(
    currentEpisode,
  );
  await expect(page.locator(".webtoon-strip")).toBeVisible();
});
