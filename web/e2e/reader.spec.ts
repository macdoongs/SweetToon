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

  await page.getByRole("button", { name: "양면 보기" }).click();
  await expect(page.locator(".reader-paged")).toBeVisible();
  await expect(page.getByText(/1 \//)).toBeVisible();
  await page.getByRole("button", { name: "페이지", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "페이지 탐색기" }))
    .toBeVisible();
  await page.getByRole("button", { name: "닫기" }).click();
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

  await page.getByRole("link", { name: /다음 화 이어보기/ }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".reader-toolbar h1")).not.toHaveText(currentEpisode);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
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

test("무료 미리보기 뒤 소장본 주문으로 해당 권을 해금한다", async ({
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
    (candidate: { number: number }) => candidate.number === 4,
  );

  await page.goto(`/read/${episode.id}`);
  await expect(
    page.getByRole("heading", { name: /첫 3화까지 무료/ }),
  ).toBeVisible();
  await expect(page.locator(".webtoon-strip")).toHaveCount(0);

  await page.getByRole("link", { name: /1권 소장하고 계속 읽기/ }).click();
  await page.getByLabel("주문자 닉네임").fill("해금독자");
  await page.getByRole("button", { name: "견적 확인하기" }).click();
  await page.getByRole("button", { name: "이 사양으로 주문하기" }).click();
  await expect(page).toHaveURL(/\/orders\/[^/]+$/);

  await page.goto(`/read/${episode.id}`);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect(page.locator(".reader-paywall")).toHaveCount(0);
});
