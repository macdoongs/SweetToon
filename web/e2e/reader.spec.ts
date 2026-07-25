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
  await page.getByRole("link", { name: "첫 화부터 읽기" }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect(page.locator(".site-footer")).toBeHidden();
  const episodeHeading = page.locator(".reader-toolbar h1");
  await expect(episodeHeading).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1);
  const currentEpisode = await episodeHeading.innerText();
  await expect(page.locator(".reader-page")).toHaveClass(
    /reader-page--chrome-hidden/,
    { timeout: 5_000 },
  );
  await page.locator(".reader-page").dispatchEvent("pointermove");
  await expect(page.locator(".reader-page")).not.toHaveClass(
    /reader-page--chrome-hidden/,
  );

  await page.getByRole("button", { name: "양면 보기" }).click();
  await expect(page.locator(".reader-paged")).toBeVisible();
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
  await page.getByRole("button", { name: "세로 스크롤" }).click();

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
  await page.getByRole("button", { name: "책갈피" }).click();
  await expect(page.getByRole("status")).toContainText("책갈피에 저장");
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
});

test("Swagger UI와 OpenAPI 계약을 같은 웹 주소에서 확인한다", async ({
  page,
}) => {
  const contractResponse = await page.request.get("/openapi.json");
  expect(contractResponse.ok()).toBeTruthy();
  const contract = await contractResponse.json();
  expect(contract.openapi).toBe("3.1.0");
  expect(contract.paths).toHaveProperty("/api/studio/uploads");

  const docsResponse = await page.request.get("/api-docs/");
  expect(docsResponse.ok()).toBeTruthy();
  expect(await docsResponse.text()).toContain("SweetToon API");
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
  await page.getByRole("link", { name: /시즌 1 · 1권 주문/ }).click();
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
