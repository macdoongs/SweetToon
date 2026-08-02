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

test("섞기와 마지막 추가 드래그가 이미 나온 작품을 제외한다", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shorts");

  const cards = page.locator(".shorts-card");
  await expect(cards).toHaveCount(10);
  const firstBatch = await cards.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-series-slug")),
  );

  await page.getByRole("button", { name: "다른 작품 섞기" }).click();
  await expect
    .poll(() =>
      cards.evaluateAll((items) =>
        items.map((item) => item.getAttribute("data-series-slug")),
      ),
    )
    .not.toEqual(firstBatch);
  const secondBatch = await cards.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-series-slug")),
  );
  expect(secondBatch.every((slug) => !firstBatch.includes(slug))).toBe(true);

  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.last()).toHaveClass(/shorts-card--active/);
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

  await expect.poll(() => cards.count()).toBeGreaterThan(secondBatch.length);
  await expect(cards.nth(10)).toHaveClass(/shorts-card--active/);
  const continuedBatch = await cards.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-series-slug")),
  );
  expect(continuedBatch.slice(0, 10)).toEqual(secondBatch);
  expect(
    continuedBatch.slice(10).every((slug) => !secondBatch.includes(slug)),
  ).toBe(true);
});

test("한 배치 안에서 같은 작가가 연속되거나 같은 장르가 세 번 이어지지 않는다", async ({
  page,
}) => {
  // 순서가 무작위이므로 여러 번 뽑아 규칙이 항상 지켜지는지 확인한다.
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await page.request.get("/api/discovery/shorts?limit=10");
    expect(response.ok()).toBeTruthy();
    const payload = (await response.json()) as {
      items: Array<{ series: { authorName: string; genre: string } }>;
    };
    expect(payload.items).toHaveLength(10);

    const authors = payload.items.map((item) => item.series.authorName);
    expect(
      authors.some((author, index) => index > 0 && authors[index - 1] === author),
    ).toBe(false);

    const genres = payload.items.map((item) => item.series.genre);
    expect(
      genres.some(
        (genre, index) =>
          index > 1 && genres[index - 1] === genre && genres[index - 2] === genre,
      ),
    ).toBe(false);
  }
});

test("마지막 작품의 미리보기가 끝나면 추가 입력 없이 다음 배치로 이어진다", async ({
  page,
}) => {
  await page.goto("/shorts");

  const cards = page.locator(".shorts-card");
  await expect(cards).toHaveCount(10);
  const firstBatch = await cards.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-series-slug")),
  );

  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.last()).toHaveClass(/shorts-card--active/);

  const strip = cards.last().locator(".shorts-preview__strip");
  await expect(strip).toHaveCSS("animation-name", "shorts-preview-pan");
  await strip.evaluate((element) => {
    element.style.animationDuration = "100ms";
  });

  await expect.poll(() => cards.count()).toBeGreaterThan(firstBatch.length);
  await expect(cards.nth(10)).toHaveClass(/shorts-card--active/);
  const continuedBatch = await cards.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-series-slug")),
  );
  expect(continuedBatch.slice(0, 10)).toEqual(firstBatch);
  expect(
    continuedBatch.slice(10).every((slug) => !firstBatch.includes(slug)),
  ).toBe(true);
});

test("다음 배치 요청이 실패하면 현재 작품을 유지하고 재시도만 제공한다", async ({
  page,
}) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/shorts");

  const cards = page.locator(".shorts-card");
  await expect(cards).toHaveCount(10);

  await page.route("**/api/discovery/shorts**", (route) => route.abort());
  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.last()).toHaveClass(/shorts-card--active/);

  const tail = page.locator(".shorts-card__tail");
  const retry = tail.getByRole("button", { name: "다시 시도" });
  await expect(retry).toBeVisible();
  // 감상 중인 화면은 그대로 두고 상단 배너로 올리지 않는다.
  await expect(page.locator(".shorts-error")).toHaveCount(0);
  await expect(cards).toHaveCount(10);
  await expect(cards.last()).toHaveClass(/shorts-card--active/);

  await page.unroute("**/api/discovery/shorts**");
  await retry.click();
  await expect.poll(() => cards.count()).toBeGreaterThan(10);
  await expect(cards.nth(10)).toHaveClass(/shorts-card--active/);
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

  const cards = page.locator(".shorts-card");
  const firstBatch = await cards.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-series-slug")),
  );
  await cards.last().scrollIntoViewIfNeeded();
  await expect(cards.last()).toHaveClass(/shorts-card--active/);
  await feed.dispatchEvent("pointerdown", {
    button: 0,
    clientY: feedBox!.y + 400,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });
  await feed.dispatchEvent("pointerup", {
    button: 0,
    clientY: feedBox!.y + 280,
    isPrimary: true,
    pointerId: 8,
    pointerType: "touch",
  });
  await expect.poll(() => cards.count()).toBeGreaterThan(firstBatch.length);
  await expect(cards.nth(10)).toHaveClass(/shorts-card--active/);
  const nextBatch = await cards.evaluateAll((items) =>
    items.map((item) => item.getAttribute("data-series-slug")),
  );
  expect(nextBatch.slice(0, 10)).toEqual(firstBatch);
  expect(
    nextBatch.slice(10).every((slug) => !firstBatch.includes(slug)),
  ).toBe(true);
});
