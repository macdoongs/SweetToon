import { expect, test } from "@playwright/test";
import {
  expectSameCardPositions,
  prepareLoopBoundary,
  snapshotVisibleCards,
} from "./circular-rail";

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
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.getByRole("link", { name: "오늘의 작품 보기" }).click();
  await expect(page).toHaveURL(/\/#discover$/);
  await expect
    .poll(() =>
      page.locator("#discover").evaluate((element) => {
        return Math.abs(element.getBoundingClientRect().top);
      }),
    )
    .toBeLessThan(2);

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
  await footer.getByRole("link", { name: "작품 둘러보기" }).click();
  await expect(page).toHaveURL(/\/#discover$/);
  expect(await page.evaluate(() => window.location.hash)).toBe("#discover");
  await expect
    .poll(() =>
      page.locator("#discover").evaluate((element) => {
        return Math.abs(element.getBoundingClientRect().top);
      }),
    )
    .toBeLessThan(2);
  await expect(footer.getByText("실제 결제·배송 없음")).toBeVisible();
  await expect(
    footer.getByRole("link", { name: "GitHub 저장소 ↗" }),
  ).toHaveAttribute("href", "https://github.com/macdoongs/SweetToon");
});

test("찜 취향을 바탕으로 가로 추천 레일을 갱신한다", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto("/");

  const recommendations = page.getByRole("region", {
    name: "취향을 이어갈 다음 작품",
  });
  await expect(recommendations).toBeVisible();
  await expect(recommendations).toContainText(
    "아직 기록이 없어도 괜찮아요.",
  );
  await expect(
    recommendations.locator(".recommendation-shelf"),
  ).toHaveCount(3);
  await expect(
    recommendations.locator(".recommendation-card img").first(),
  ).toBeVisible();
  const discoveryRail = recommendations
    .locator(".recommendation-rail")
    .first();
  await expect(discoveryRail).toHaveAttribute(
    "aria-roledescription",
    "순환형 캐러셀",
  );
  await expect(discoveryRail).toHaveCSS("scrollbar-width", "none");
  const duplicateImages = discoveryRail.locator(
    '.recommendation-card[data-preloaded="true"] img',
  );
  expect(await duplicateImages.count()).toBeGreaterThan(0);
  await expect
    .poll(() =>
      duplicateImages.evaluateAll((images) =>
        images.every(
          (image) =>
            (image as HTMLImageElement).loading === "eager" &&
            (image as HTMLImageElement).complete &&
            (image as HTMLImageElement).naturalWidth > 0,
        ),
      ),
    )
    .toBe(true);
  await expect
    .poll(() =>
      discoveryRail.evaluate(
        (element) => element.scrollWidth > element.clientWidth,
      ),
    )
    .toBe(true);
  const initialScrollLeft = await discoveryRail.evaluate(
    (element) => element.scrollLeft,
  );
  await recommendations
    .getByRole("button", { name: /다음 작품 보기/ })
    .first()
    .click();
  await expect
    .poll(() => discoveryRail.evaluate((element) => element.scrollLeft))
    .toBeGreaterThan(initialScrollLeft);
  await page.waitForTimeout(600);
  const beforeBoundary = await prepareLoopBoundary(discoveryRail);
  await discoveryRail.dispatchEvent("scrollend");
  await page.waitForTimeout(100);
  const afterBoundary = await snapshotVisibleCards(discoveryRail);
  expectSameCardPositions(beforeBoundary, afterBoundary);
  expect(
    await discoveryRail.evaluate((element) => {
      const rail = element as HTMLElement;
      return getComputedStyle(rail).scrollBehavior;
    }),
  ).toBe("smooth");
  await expect
    .poll(() =>
      discoveryRail.evaluate((element) => {
        const rail = element as HTMLElement;
        const itemCount = rail.children.length / 5;
        const firstOriginal = rail.children.item(itemCount * 2) as HTMLElement;
        const trailingCopy = rail.children.item(itemCount * 4) as HTMLElement;
        const railRect = rail.getBoundingClientRect();
        const contentLeft = (item: HTMLElement) =>
          item.getBoundingClientRect().left -
          railRect.left +
          rail.scrollLeft;
        return rail.scrollLeft >= contentLeft(firstOriginal) - 0.5 &&
          rail.scrollLeft < contentLeft(trailingCopy) - 0.5;
      }),
    )
    .toBe(true);

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

test("모든 홈 콘텐츠 레일이 순환 경계 위치를 보존한다", async ({ page }) => {
  test.setTimeout(60_000);

  for (const width of [1234, 1100, 390]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator(".live-popular__rail")).toBeVisible();
    const rails = page.locator(".circular-content-rail");
    const railCount = await rails.count();
    expect(railCount).toBeGreaterThan(3);

    for (let railIndex = 0; railIndex < railCount; railIndex += 1) {
      const rail = rails.nth(railIndex);
      const railId = await rail.getAttribute("id");
      await expect(rail).toBeVisible();
      await expect(rail).toHaveClass(/horizontal-scroll-surface/);
      await expect(rail).toHaveCSS("scrollbar-width", "none");

      await expect
        .poll(() =>
          rail.evaluate((element) => {
            const carousel = element as HTMLElement;
            const itemCount = carousel.children.length / 5;
            const centerCopy = carousel.children.item(
              itemCount * 2,
            ) as HTMLElement;
            const railRect = carousel.getBoundingClientRect();
            const expectedLeft =
              centerCopy.getBoundingClientRect().left -
              railRect.left +
              carousel.scrollLeft;
            return Math.abs(carousel.scrollLeft - expectedLeft);
          }),
        )
        .toBeLessThan(0.5);

      const beforeBoundary = await prepareLoopBoundary(rail);
      await rail.dispatchEvent("scrollend");
      await page.waitForTimeout(100);
      const afterBoundary = await snapshotVisibleCards(rail);
      expectSameCardPositions(
        beforeBoundary,
        afterBoundary,
        `${width}px ${railId ?? `rail ${railIndex + 1}`}`,
      );
    }
  }
});

test("라이트·다크·시스템 테마를 저장하고 즉시 적용한다", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/");

  const root = page.locator("html");
  const themePicker = page.getByLabel("화면 테마");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect(root).toHaveAttribute("data-theme-preference", "system");
  await expect(themePicker).toHaveValue("system");
  const themeColors = page.locator('meta[name="theme-color"]');
  await expect(themeColors.first()).toHaveAttribute(
    "content",
    "#1b1817",
  );
  expect(
    await themeColors.evaluateAll((metas) =>
      metas.every((meta) => meta.getAttribute("content") === "#1b1817"),
    ),
  ).toBe(true);

  await themePicker.selectOption("light");
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(root).toHaveAttribute("data-theme-preference", "light");
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    )
    .toBe("rgb(245, 240, 231)");

  await page.reload();
  await expect(root).toHaveAttribute("data-theme", "light");
  await expect(themePicker).toHaveValue("light");

  await themePicker.selectOption("dark");
  await expect(root).toHaveAttribute("data-theme", "dark");
  await expect
    .poll(() =>
      page.evaluate(() => getComputedStyle(document.body).backgroundColor),
    )
    .toBe("rgb(27, 24, 23)");
  await expect
    .poll(() =>
      page
        .locator(".discover-section")
        .evaluate((element) => getComputedStyle(element).backgroundColor),
    )
    .toBe("rgb(33, 29, 27)");
  const selectedFilter = page.locator(
    '.discover-filter[aria-current="page"]',
  );
  await expect
    .poll(() =>
      selectedFilter.evaluate(
        (element) => getComputedStyle(element).backgroundColor,
      ),
    )
    .toBe("rgb(229, 216, 204)");
  await expect
    .poll(() =>
      selectedFilter.evaluate((element) => getComputedStyle(element).color),
    )
    .toBe("rgb(27, 24, 23)");

  await page.goto("/series/moonlight-laundry");
  const selectedEpisodeSort = page
    .getByRole("navigation", { name: "에피소드 정렬" })
    .locator('[aria-current="page"]');
  await expect(selectedEpisodeSort).toHaveCSS(
    "background-color",
    "rgb(229, 216, 204)",
  );
  await expect(selectedEpisodeSort).toHaveCSS("color", "rgb(27, 24, 23)");
  const editionCard = page.locator(".edition-card");
  await expect(editionCard).toHaveCSS(
    "background-color",
    "rgb(43, 37, 34)",
  );
  await expect(editionCard).toHaveCSS("color", "rgb(246, 238, 229)");
  const editionPicker = page.getByLabel("주문할 소장본");
  expect(await editionPicker.locator("option").count()).toBeGreaterThan(1);
  await expect(editionCard.getByRole("link")).toHaveCount(1);
  await editionPicker.selectOption({
    label: "시즌 1 · 2권 · 6~10화",
  });
  await expect(
    editionCard.getByRole("link", { name: /선택한 2권 주문하기/ }),
  ).toHaveAttribute("href", /volume=2$/);

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("홈의 대표 데모 경로가 읽기→주문→제작 확인으로 이어진다", async ({
  page,
}) => {
  await page.goto("/");

  await page.getByRole("link", { name: "3분 데모 경로" }).click();
  await expect(page).toHaveURL(/#demo-path$/);

  const demoPath = page.locator(".demo-path");
  await expect(
    demoPath.getByRole("heading", {
      name: "읽고, 주문하고, 제작을 지켜보세요",
    }),
  ).toBeVisible();
  await expect(
    demoPath.getByRole("link", { name: /무료 회차 고르기/ }),
  ).toHaveAttribute("href", /\/series\/[^/]+#episodes$/);
  await expect(
    demoPath.getByRole("link", { name: /제작 상태 확인/ }),
  ).toHaveAttribute("href", "/orders");

  await demoPath.getByRole("link", { name: /소장본 고르기/ }).click();
  await expect(page).toHaveURL(/\/series\/[^/?]+#edition$/);
  await expect(page.locator(".edition-card")).toBeVisible();

  await page.goto("/?filter=ongoing");
  await expect(page.locator(".demo-path")).toBeVisible();
});

test("완독한 회차는 이어보기 대신 다음 행동으로 안내한다", async ({
  page,
}) => {
  const seriesResponse = await page.request.get(
    "/api/series/moonlight-laundry",
  );
  expect(seriesResponse.ok()).toBeTruthy();
  const series = await seriesResponse.json();
  const episode = series.seasons[0].episodes[0] as {
    id: string;
    number: number;
    title: string;
  };

  await page.addInitScript(
    ({ episodeId, episodeNumber, episodeTitle }) => {
      localStorage.setItem(
        "sweettoon:reading-progress",
        JSON.stringify({
          [episodeId]: {
            seriesSlug: "moonlight-laundry",
            episodeId,
            episodeNumber,
            episodeTitle,
            pageOrder: 4,
            percent: 100,
            completed: true,
            updatedAt: "2026-07-26T00:00:00.000Z",
          },
        }),
      );
    },
    {
      episodeId: episode.id,
      episodeNumber: episode.number,
      episodeTitle: episode.title,
    },
  );

  await page.goto("/");
  const card = page
    .locator(".series-card")
    .filter({ hasText: "달빛 세탁소" })
    .first();
  const continueLink = card.locator(".series-card__continue");
  await expect(continueLink).toContainText(
    `${episode.number}화 완독 · 다음 화 고르기`,
  );
  await expect(continueLink).toHaveAttribute(
    "href",
    "/series/moonlight-laundry#episodes",
  );
  await continueLink.click();
  await expect(page).toHaveURL(/\/series\/moonlight-laundry#episodes$/);
});

test("데모 기록 초기화가 개인 기록만 지우고 설정은 보존한다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    localStorage.setItem("sweettoon:favorites", JSON.stringify(["demo"]));
    localStorage.setItem(
      "sweettoon:reading-progress",
      JSON.stringify({ ep: { seriesSlug: "demo" } }),
    );
    localStorage.setItem("sweettoon:candy-wallet-token", "reset-target");
    localStorage.setItem(
      "sweettoon:demo-entitlements",
      JSON.stringify({ "season:1": "token" }),
    );
    localStorage.setItem("sweettoon:theme", "dark");
  });

  await page.goto("/");
  const reset = page.getByRole("button", { name: "데모 기록 초기화" });
  await reset.scrollIntoViewIfNeeded();
  await reset.click();
  await page.getByRole("button", { name: "정말 초기화" }).click();
  await expect(
    page.getByText("찜·진행도·캔디·이용권·주문 기록을 지웠어요."),
  ).toBeVisible();

  const remaining = await page.evaluate(() => ({
    favorites: localStorage.getItem("sweettoon:favorites"),
    progress: localStorage.getItem("sweettoon:reading-progress"),
    candy: localStorage.getItem("sweettoon:candy-wallet-token"),
    entitlements: localStorage.getItem("sweettoon:demo-entitlements"),
    theme: localStorage.getItem("sweettoon:theme"),
  }));
  expect(remaining.favorites).toBeNull();
  expect(remaining.progress).toBeNull();
  // 헤더가 잔액 조회 중 새 지갑 토큰을 만들 수 있으므로, 기존 지갑과
  // 분리됐는지(토큰 교체)를 검증한다.
  expect(remaining.candy).not.toBe("reset-target");
  expect(remaining.entitlements).toBeNull();
  expect(remaining.theme).toBe("dark");
});

test("모바일 뷰포트에서도 핵심 내비게이션이 유지된다", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const nav = page.getByRole("navigation", { name: "주요 메뉴" });
  await expect(nav.getByRole("link", { name: "작품" })).toBeVisible();
  await expect(nav.getByRole("link", { name: "주문" })).toBeVisible();
  await expect(nav.locator(".site-nav__candy")).toBeVisible();

  const moreMenu = nav.locator(".site-nav__more");
  await expect(moreMenu).toBeVisible();
  await moreMenu.locator("summary").click();
  await expect(
    moreMenu.getByRole("link", { name: "작가 스튜디오" }),
  ).toBeVisible();
  await moreMenu.getByRole("link", { name: "찜 목록" }).click();
  await expect(page).toHaveURL(/\/favorites$/);
  await expect(
    page.getByRole("heading", { name: "찜 목록" }),
  ).toBeVisible();

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
  expect(feed).toContain(
    `${process.env.SITE_URL ?? "http://localhost:3000"}/read/`,
  );

  const sitemapResponse = await page.request.get("/sitemap.xml");
  expect(sitemapResponse.ok()).toBeTruthy();
  const sitemap = await sitemapResponse.text();
  const expectedSiteUrl =
    process.env.SITE_URL ?? "http://localhost:3000";
  expect(sitemap).toContain(
    `<loc>${expectedSiteUrl}/series/moonlight-laundry</loc>`,
  );
  expect(sitemap).toContain(`<loc>${expectedSiteUrl}/read/`);
});
