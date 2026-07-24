import { expect, test } from "@playwright/test";

test("독자가 URL 필터로 연재작과 소장 가능한 작품을 탐색한다", async ({
  page,
}) => {
  await page.goto("/");

  const cards = page.locator(".series-card");
  const allCount = await cards.count();
  expect(allCount).toBeGreaterThan(1);
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
});
