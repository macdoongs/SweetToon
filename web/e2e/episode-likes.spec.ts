import { expect, test } from "@playwright/test";

function countFrom(text: string | null): number {
  return Number((text ?? "0").replaceAll(",", ""));
}

test("쇼츠와 본편이 같은 회차 좋아요와 집계를 공유한다 @demo", async ({
  page,
}) => {
  await page.goto("/shorts");
  const card = page.locator(".shorts-card").first();
  const episodeId = await card.getAttribute("data-episode-id");
  expect(episodeId).toBeTruthy();

  const shortsLike = card.locator(".episode-like__button");
  const initialCount = countFrom(await shortsLike.locator("strong").textContent());
  await expect(shortsLike).toHaveAttribute("aria-pressed", "false");
  await shortsLike.click();
  await expect(shortsLike).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => countFrom(await shortsLike.locator("strong").textContent()))
    .toBe(initialCount + 1);

  await page.goto(`/read/${encodeURIComponent(episodeId!)}`);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  const readerLike = page.locator(".reader-finish .episode-like__button");
  await expect(readerLike).toBeVisible();
  await expect(readerLike).toHaveAttribute("aria-pressed", "true");
  await expect
    .poll(async () => countFrom(await readerLike.locator("strong").textContent()))
    .toBe(initialCount + 1);

  await readerLike.click();
  await expect(readerLike).toHaveAttribute("aria-pressed", "false");
  await expect
    .poll(async () => countFrom(await readerLike.locator("strong").textContent()))
    .toBe(initialCount);
});

test("모바일 다크 화면에서도 쇼츠 좋아요가 카드 안에 유지된다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/shorts");

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const card = page.locator(".shorts-card").first();
  const like = card.locator(".episode-like__button");
  await expect(like).toBeVisible();
  const [cardBox, likeBox] = await Promise.all([
    card.boundingBox(),
    like.boundingBox(),
  ]);
  expect(cardBox).not.toBeNull();
  expect(likeBox).not.toBeNull();
  expect(likeBox!.x).toBeGreaterThanOrEqual(cardBox!.x);
  expect(likeBox!.x + likeBox!.width).toBeLessThanOrEqual(
    cardBox!.x + cardBox!.width,
  );
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
