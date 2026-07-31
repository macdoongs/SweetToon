import { expect, test } from "@playwright/test";

test("독자가 홈에서 작품을 발견하고 다음 화까지 읽는다", async ({ page }) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("좋아한 이야기를");

  const seriesLink = page.locator(
    '.series-card h3 a[href="/series/moonlight-laundry"]',
  );
  const seriesTitle = (await seriesLink.textContent())?.trim();
  expect(seriesTitle).toBeTruthy();
  await seriesLink.click();

  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    seriesTitle ?? "",
  );
  await expect(page.locator(".episode-list__item")).toHaveCount(105);
  await expect(page.locator(".episode-list").first()).toHaveCSS(
    "list-style-type",
    "none",
  );
  await page.getByRole("link", { name: "첫 화부터 읽기" }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect(page.getByText(/지금 \d+명이 읽는 중/)).toBeVisible();
  await expect(page.locator(".site-footer")).toBeHidden();
  const episodeHeading = page.locator(".reader-toolbar h1");
  await expect(episodeHeading).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const currentEpisode = await episodeHeading.innerText();
  await expect(page.locator(".reader-page")).toHaveClass(
    /reader-page--chrome-hidden/,
    { timeout: 5_000 },
  );
  await page.mouse.move(21, 21);
  await expect(page.locator(".reader-page")).not.toHaveClass(
    /reader-page--chrome-hidden/,
  );

  await page.getByRole("button", { name: "양면 보기" }).click();
  await expect(page.locator(".reader-paged")).toBeVisible();
  await expect(page.locator(".reader-controls")).toHaveClass(
    /horizontal-scroll-surface/,
  );
  await expect(page.locator(".reader-paged__spread")).toHaveClass(
    /horizontal-scroll-surface/,
  );
  await expect(page.locator(".reader-paged__spread")).toHaveCSS(
    "scrollbar-width",
    "none",
  );
  await expect(page.getByText(/1 \//)).toBeVisible();
  await expect(page.locator(".reader-finish")).toHaveCount(0);
  await page.getByRole("button", { name: "화면 설정" }).click();
  await page.getByLabel("오른쪽에서 왼쪽").check();
  await page.getByRole("button", { name: "화면 설정" }).click();
  await expect(page.locator(".reader-paged--rtl")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "다음 양면" }),
  ).toHaveClass(/reader-paged__turn--previous/);
  await page.getByRole("button", { name: "페이지", exact: true }).click();
  const pageNavigator = page.getByRole("complementary", {
    name: "페이지 탐색기",
  });
  await expect(pageNavigator).toBeVisible();
  await pageNavigator.locator(":scope > div button").last().click();
  await expect(page.locator(".reader-finish--double")).toContainText(
    "마지막 페이지예요",
  );
  await expect(page.locator(".reader-finish--double")).toContainText(
    "모두 읽었습니다",
  );
  await page.getByRole("button", { name: "책갈피" }).click();
  const bookmarkToast = page.locator(".reader-bookmark-toast");
  await expect(bookmarkToast).toContainText("책갈피에 저장");
  await expect
    .poll(() =>
      page.evaluate(() => {
        const saved = JSON.parse(
          localStorage.getItem("sweettoon:reading-progress") ?? "{}",
        ) as Record<string, { pageOrder?: number; percent?: number }>;
        return Object.values(saved).some(
          (progress) =>
            (progress.pageOrder ?? 0) > 0 &&
            (progress.percent ?? 0) > 0,
        );
      }),
    )
    .toBe(true);
  await expect(bookmarkToast).toBeHidden({ timeout: 5_000 });
  await page.getByRole("button", { name: "세로 스크롤" }).click();

  const firstCut = page.locator(".webtoon-strip__cut img").first();
  await expect(firstCut).toBeVisible();
  await expect(firstCut).toHaveAttribute("srcset", /\/_next\/image\?/);
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
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await page.mouse.move(20, 20);
  await expect(page.locator(".reader-page")).not.toHaveClass(
    /reader-page--chrome-hidden/,
  );

  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect(page.locator(".reader-finish")).toContainText(
    "모두 읽었습니다",
  );
  await page.getByRole("link", { name: /다음 화 이어보기/ }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".reader-toolbar h1")).not.toHaveText(currentEpisode);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeLessThan(80);

  await page.goto("/");
  const livePopular = page.getByRole("region", {
    name: "지금 인기 있는 작품",
  });
  await expect(livePopular).toBeVisible();
  await expect(
    livePopular.getByRole("link", { name: /달빛 세탁소/ }),
  ).toBeVisible();
});

test("양면 보기 전환 후 스크롤하면 뷰어 도구 전체가 숨는다 @demo", async ({
  page,
}) => {
  const seriesResponse = await page.request.get(
    "/api/series/moonlight-laundry",
  );
  expect(seriesResponse.ok()).toBeTruthy();
  const series = await seriesResponse.json();
  const episodeId = series.seasons[0].episodes[0].id as string;

  await page.goto(`/read/${episodeId}`);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await page.mouse.move(200, 200);

  await page.getByRole("button", { name: "양면 보기" }).click();
  const paged = page.locator(".reader-paged");
  await expect(paged).toBeVisible();
  const counter = page.locator(".reader-paged__counter");
  const firstCounter = await counter.innerText();
  await page.getByRole("button", { name: "다음 양면" }).click();
  await expect(counter).not.toHaveText(firstCounter);

  await page.getByRole("button", { name: "세로 스크롤" }).click();
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await page.locator(".webtoon-strip").hover({ position: { x: 20, y: 200 } });
  await page.mouse.wheel(0, 900);
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(0);
  await expect(page.locator(".reader-page")).toHaveClass(
    /reader-page--chrome-hidden/,
  );
  await expect(page.locator(".reader-toolbar")).toHaveCSS("opacity", "0");
  await expect(page.locator(".reader-controls")).toHaveCSS("opacity", "0");
});

test("저장된 페이지를 양면 모드에서 복원한 뒤 모드 전환에도 진행도를 보존한다", async ({
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
      const trackedWindow = window as typeof window & {
        __sweettoonPreloadImageCount: number;
      };
      const NativeImage = window.Image;
      trackedWindow.__sweettoonPreloadImageCount = 0;
      Object.defineProperty(window, "Image", {
        configurable: true,
        value: class extends NativeImage {
          constructor(width?: number, height?: number) {
            super(width, height);
            trackedWindow.__sweettoonPreloadImageCount += 1;
          }
        },
      });
      localStorage.setItem(
        "sweettoon:reader-settings",
        JSON.stringify({
          mode: "double",
          scale: "screen",
          background: "black",
          direction: "ltr",
        }),
      );
      localStorage.setItem(
        "sweettoon:reading-progress",
        JSON.stringify({
          [episodeId]: {
            seriesSlug: "moonlight-laundry",
            episodeId,
            episodeNumber,
            episodeTitle,
            pageOrder: 5,
            percent: 50,
            completed: false,
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

  const readerResponse = await page.request.get(`/api/episodes/${episode.id}`);
  expect(readerResponse.ok()).toBeTruthy();
  const reader = await readerResponse.json();
  const pageCount = reader.pages.length as number;

  await page.goto(`/read/${episode.id}`);
  await expect(page.locator(".reader-paged")).toBeVisible();
  await expect
    .poll(() =>
      page.evaluate(
        () =>
          (
            window as typeof window & {
              __sweettoonPreloadImageCount: number;
            }
          ).__sweettoonPreloadImageCount,
      ),
    )
    .toBe(pageCount);
  await expect(page.locator(".reader-paged__counter")).not.toHaveText(/^1 \//);
  await expect
    .poll(() =>
      page.evaluate((episodeId) => {
        const saved = JSON.parse(
          localStorage.getItem("sweettoon:reading-progress") ?? "{}",
        ) as Record<string, { pageOrder?: number }>;
        return saved[episodeId]?.pageOrder;
      }, episode.id),
    )
    .toBe(5);

  await page.getByRole("button", { name: "세로 스크롤" }).click();
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect
    .poll(() =>
      page.locator(".webtoon-strip__cut").evaluateAll((elements) => {
        const active = [...elements]
          .reverse()
          .find((element) => element.getBoundingClientRect().top <= 180);
        return active?.id;
      }),
    )
    .toBe("page-5");

  await page.getByRole("button", { name: "양면 보기" }).click();
  await expect(page.locator(".reader-paged__counter")).not.toHaveText(/^1 \//);
  await expect
    .poll(() =>
      page.evaluate((episodeId) => {
        const saved = JSON.parse(
          localStorage.getItem("sweettoon:reading-progress") ?? "{}",
        ) as Record<string, { pageOrder?: number }>;
        return saved[episodeId]?.pageOrder;
      }, episode.id),
    )
    .toBe(5);
  expect(
    await page.evaluate(
      () =>
        (
          window as typeof window & {
            __sweettoonPreloadImageCount: number;
          }
        ).__sweettoonPreloadImageCount,
    ),
  ).toBe(pageCount);
});

test("Swagger UI와 OpenAPI 계약을 같은 웹 주소에서 확인한다", async ({
  page,
}) => {
  const contractResponse = await page.request.get("/openapi.json");
  expect(contractResponse.ok()).toBeTruthy();
  const contract = await contractResponse.json();
  expect(contract.openapi).toBe("3.1.0");
  expect(contract.paths).toHaveProperty("/api/studio/uploads");
  expect(contract.paths).toHaveProperty("/api/candy-wallets/{token}");

  const docsResponse = await page.request.get("/api-docs/");
  expect(docsResponse.ok()).toBeTruthy();
  expect(await docsResponse.text()).toContain("SweetToon API");
});

test("최신화 정렬은 최신 시즌의 최신 권부터 보여준다", async ({ page }) => {
  await page.goto("/series/moonlight-laundry");

  await page.getByRole("link", { name: "최신화부터" }).click();
  await expect(page).toHaveURL(/sort=latest/);
  const panels = page.locator(".season-panel");
  await expect(panels.first().locator(".season-panel__header")).toContainText(
    "시즌 2",
  );
  await expect(
    panels.first().getByRole("heading", { level: 3 }),
  ).toHaveText("9권");
  await expect(
    panels.first().locator(".episode-list__number").first(),
  ).toHaveText("45");

  const volumeFilters = page
    .getByRole("navigation", { name: "권별 에피소드 필터" })
    .getByRole("link");
  await expect(volumeFilters.nth(1)).toHaveText("시즌 2 · 9권");

  await page.getByRole("link", { name: "처음부터" }).click();
  await expect(panels.first().locator(".season-panel__header")).toContainText(
    "시즌 1",
  );
  await expect(
    panels.first().getByRole("heading", { level: 3 }),
  ).toHaveText("1권");
  await expect(
    panels.first().locator(".episode-list__number").first(),
  ).toHaveText("01");
});

test("작품을 찜하고 목록에서 확인한 뒤 해제한다", async ({ page }) => {
  await page.goto("/series/moonlight-laundry");

  await page.getByRole("button", { name: "찜하기" }).click();
  await expect(
    page.getByRole("button", { name: "찜 해제" }),
  ).toHaveAttribute("aria-pressed", "true");

  await page.goto("/series/corner-store");
  await page.getByRole("button", { name: "찜하기" }).click();

  await page.goto("/favorites");
  await expect(page.getByRole("heading", { name: "찜 목록" })).toBeVisible();
  await expect(page.getByText("찜한 작품 2개를 모아두었어요.")).toBeVisible();
  const grid = page.locator(".favorites-grid");
  // 캐러셀 복제 없이 찜한 수만큼만 카드를 렌더링한다.
  await expect(grid.locator(".favorite-card")).toHaveCount(2);

  await page.getByLabel("제목 검색").fill("달빛");
  await expect(grid.locator(".favorite-card")).toHaveCount(1);
  await page.getByLabel("제목 검색").fill("");

  const card = grid
    .locator(".favorite-card")
    .filter({ hasText: "달빛 세탁소" });
  await expect(card.getByRole("heading", { name: "달빛 세탁소" })).toBeVisible();
  await expect(card.locator("img")).toBeVisible();

  await card.getByRole("button", { name: "찜 해제" }).click();
  await expect(grid.locator(".favorite-card")).toHaveCount(1);
  await grid.getByRole("button", { name: "찜 해제" }).click();
  await expect(
    page.getByRole("heading", { name: "아직 찜한 작품이 없어요" }),
  ).toBeVisible();
});

test("실제 결제 없이 고정 패키지로 캔디를 충전한다", async ({ page }) => {
  await page.goto("/candy");

  await expect(
    page.getByRole("heading", { name: "캔디 충전" }),
  ).toBeVisible();
  await expect(page.getByText("결제 없는 Mock 충전")).toBeVisible();
  await expect(page.locator(".candy-balance")).toContainText("0");

  const tenCandy = page.locator(".candy-package").filter({ hasText: "10개" });
  await expect(tenCandy).toContainText("1,000원");
  await tenCandy.getByRole("button", { name: "데모로 충전" }).click();

  await expect(page.locator(".candy-balance")).toContainText("10");
  await expect(page.locator(".site-nav__candy")).toContainText("캔디 10");
  await expect(page.getByRole("status")).toContainText(
    "데모 캔디 10개를 충전했습니다",
  );
});

test("0캔디 페이월에서 충전소를 왕복해 회차를 해금한다", async ({ page }) => {
  const detailResponse = await page.request.get(
    "/api/series/moonlight-laundry",
  );
  const series = await detailResponse.json();
  const season = series.seasons.find(
    (candidate: { number: number }) => candidate.number === 1,
  );
  const episode = season.episodes.find(
    (candidate: { number: number }) => candidate.number === 6,
  );

  await page.goto(`/read/${episode.id}`);
  await page.getByRole("link", { name: "캔디 충전하고 돌아오기" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/candy\\?returnTo=%2Fread%2F${episode.id}$`),
  );

  await page.getByRole("button", { name: "데모로 충전" }).first().click();
  const returnLink = page.getByRole("link", {
    name: "읽던 회차로 돌아가기 →",
  });
  await expect(returnLink).toBeVisible();
  await returnLink.click();
  await expect(page).toHaveURL(new RegExp(`/read/${episode.id}$`));
  await expect(
    page.getByRole("button", { name: "캔디 1개로 이 화 보기" }),
  ).toBeEnabled();
});

test("다음 화 이동이 시즌 경계를 넘어 이어진다", async ({ page }) => {
  const detailResponse = await page.request.get(
    "/api/series/moonlight-laundry",
  );
  const series = await detailResponse.json();
  const seasonOne = series.seasons.find(
    (candidate: { number: number }) => candidate.number === 1,
  );
  const seasonTwo = series.seasons.find(
    (candidate: { number: number }) => candidate.number === 2,
  );
  const lastOfSeasonOne = seasonOne.episodes.at(-1);
  const firstOfSeasonTwo = seasonTwo.episodes[0];

  const readerResponse = await page.request.get(
    `/api/episodes/${lastOfSeasonOne.id}`,
  );
  const reader = await readerResponse.json();
  expect(reader.navigation.nextEpisodeId).toBe(firstOfSeasonTwo.id);
  expect(reader.navigation.nextEpisodeSeasonNumber).toBe(2);

  const nextReaderResponse = await page.request.get(
    `/api/episodes/${firstOfSeasonTwo.id}`,
  );
  const nextReader = await nextReaderResponse.json();
  expect(nextReader.navigation.previousEpisodeId).toBe(lastOfSeasonOne.id);
});

test("연재 중 시즌의 잠긴 회차는 주문 대신 캔디를 안내한다", async ({
  page,
}) => {
  const detailResponse = await page.request.get("/api/series/rooftop-garden");
  const series = await detailResponse.json();
  const season = series.seasons.find(
    (candidate: { number: number }) => candidate.number === 1,
  );
  const episode = season.episodes.find(
    (candidate: { number: number }) => candidate.number === 6,
  );

  // 전제: 이 회차는 잠겨 있고 시즌은 연재 중이다.
  const readerResponse = await page.request.get(
    `/api/episodes/${episode.id}`,
  );
  const reader = await readerResponse.json();
  expect(reader.access.state).toBe("locked");
  expect(reader.season.status).toBe("ongoing");

  await page.goto(`/read/${episode.id}`);
  const paywall = page.locator(".reader-paywall");
  await expect(
    paywall.getByText("완결 후 소장본으로 주문할 수 있어요", {
      exact: false,
    }),
  ).toBeVisible();
  await expect(
    paywall.getByRole("link", { name: /소장하고/ }),
  ).toHaveCount(0);
  await expect(
    paywall.getByRole("button", { name: "캔디 1개로 이 화 보기" }),
  ).toBeVisible();

  // 연재 시즌 주문 딥링크는 404가 아니라 주문 불가 안내를 보여준다.
  await page.goto(
    `/series/rooftop-garden/order?season=${season.id}&volume=2`,
  );
  await expect(
    page.getByRole("heading", {
      name: "이 권은 시즌 완결 후 주문할 수 있어요.",
    }),
  ).toBeVisible();
});

test("1권 주문 보너스 캔디로 유료 회차를 한 번만 차감해 해금한다", async ({
  page,
}) => {
  const detailResponse = await page.request.get(
    "/api/series/moonlight-laundry",
  );
  expect(detailResponse.ok()).toBeTruthy();
  const series = await detailResponse.json();
  const season = series.seasons.find(
    (candidate: { number: number }) => candidate.number === 1,
  );
  const episode = season.episodes.find(
    (candidate: { number: number }) => candidate.number === 6,
  );

  await page.goto(`/read/${episode.id}`);
  await expect(
    page.getByRole("heading", { name: /첫 1권\(5화\)까지 무료/ }),
  ).toBeVisible();
  await expect(page.locator(".webtoon-strip")).toHaveCount(0);
  await expect(
    page.getByRole("button", { name: "캔디 1개로 이 화 보기" }),
  ).toBeDisabled();

  await page.goto("/series/moonlight-laundry#edition");
  await page.getByRole("link", { name: /선택한 1권 주문하기/ }).click();
  await expect(page.getByText("1권 혜택 · 보너스 캔디 5개")).toBeVisible();
  await page.getByLabel("주문자 닉네임").fill("해금독자");
  await page.getByRole("button", { name: "견적 확인하기" }).click();
  await page.getByRole("button", { name: "이 사양으로 주문하기" }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  await expect(page.getByText("보너스 캔디 5개도")).toBeVisible();
  await expect(page.locator(".site-nav__candy")).toContainText("캔디 5");

  await page.goto(`/read/${episode.id}`);
  await expect(page.locator(".reader-paywall")).toBeVisible();
  await page.getByRole("button", { name: "캔디 1개로 이 화 보기" }).click();
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect(page.locator(".reader-paywall")).toHaveCount(0);
  await expect(page.locator(".site-nav__candy")).toContainText("캔디 4");

  await page.reload();
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect(page.locator(".site-nav__candy")).toContainText("캔디 4");
});

test("무료 권이 없는 작품도 1권 주문 entitlement로 즉시 읽는다", async ({
  page,
}) => {
  const detailResponse = await page.request.get(
    "/api/series/moonlight-laundry",
  );
  expect(detailResponse.ok()).toBeTruthy();
  const series = await detailResponse.json();
  const season = series.seasons.find(
    (candidate: { number: number }) => candidate.number === 1,
  );
  const firstEpisode = season.episodes.find(
    (candidate: { number: number }) => candidate.number === 1,
  );
  const policyUrl = `/api/studio/series/${encodeURIComponent(series.id)}/access-policy`;

  const restrict = await page.request.patch(policyUrl, {
    data: { freeVolumeCount: 0, previewEpisodeCount: 0 },
  });
  expect(restrict.ok()).toBeTruthy();

  try {
    await page.goto(`/read/${encodeURIComponent(firstEpisode.id)}`);
    await expect(page.locator(".reader-paywall")).toBeVisible();

    await page.goto("/series/moonlight-laundry#edition");
    await page.getByRole("link", { name: /선택한 1권 주문하기/ }).click();
    await page.getByLabel("주문자 닉네임").fill("소장독자");
    await page.getByRole("button", { name: "견적 확인하기" }).click();
    await page.getByRole("button", { name: "이 사양으로 주문하기" }).click();
    await expect(page).toHaveURL(/\/orders\/[^/]+$/);

    await page.goto(`/read/${encodeURIComponent(firstEpisode.id)}`);
    await expect(page.locator(".webtoon-strip")).toBeVisible();
    await expect(page.locator(".reader-paywall")).toHaveCount(0);
  } finally {
    const restore = await page.request.patch(policyUrl, {
      data: { freeVolumeCount: 1, previewEpisodeCount: 0 },
    });
    expect(restore.ok()).toBeTruthy();
  }
});
