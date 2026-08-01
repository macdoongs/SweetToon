import AdmZip from "adm-zip";
import { expect, test } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=",
  "base64",
);

function episodeArchive(): Buffer {
  const archive = new AdmZip();
  archive.addFile("10.png", png);
  archive.addFile("2.png", png);
  archive.addFile("1.png", png);
  return archive.toBuffer();
}

async function expectStudioContentAlignment(
  page: import("@playwright/test").Page,
  selectors: string[],
) {
  const headerBox = await page.locator(".page-header").boundingBox();
  expect(headerBox).not.toBeNull();
  for (const selector of selectors) {
    const box = await page.locator(selector).boundingBox();
    expect(box, `${selector} should be visible`).not.toBeNull();
    expect(Math.abs(box!.x - headerBox!.x), selector).toBeLessThan(1);
    expect(Math.abs(box!.width - headerBox!.width), selector).toBeLessThan(1);
  }
}

test("비공개 보관함과 책 패키징이 공통 콘텐츠 여백을 유지한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/drafts");
  await expect(page.locator(".studio-drafts")).toBeVisible();
  await expectStudioContentAlignment(page, [
    ".studio-security-access",
    ".studio-drafts",
  ]);

  await page.goto("/studio/packaging");
  await expect(page.locator(".studio-packaging-list")).toBeVisible();
  await expectStudioContentAlignment(page, [
    ".studio-security-access",
    ".studio-packaging-form",
    ".studio-workspace",
    ".studio-packaging-list",
  ]);

  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio/drafts");
  await expectStudioContentAlignment(page, [
    ".studio-security-access",
    ".studio-drafts",
  ]);
  await page.goto("/studio/packaging");
  await expectStudioContentAlignment(page, [
    ".studio-security-access",
    ".studio-packaging-form",
    ".studio-workspace",
    ".studio-packaging-list",
  ]);
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("등록 회차를 시즌·권·검색으로 좁히고 관리 메뉴를 연다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/studio/series/moonlight-laundry");

  const manager = page.getByRole("region", { name: "등록된 회차 관리" });
  await expect(manager).toBeVisible();

  const manageGrid = page.locator(".studio-manage-grid");
  const [managerBox, manageGridBox] = await Promise.all([
    manager.boundingBox(),
    manageGrid.boundingBox(),
  ]);
  expect(managerBox).not.toBeNull();
  expect(manageGridBox).not.toBeNull();
  expect(Math.abs(managerBox!.x - manageGridBox!.x)).toBeLessThan(1);
  expect(
    Math.abs(
      managerBox!.x + managerBox!.width -
        (manageGridBox!.x + manageGridBox!.width),
    ),
  ).toBeLessThan(1);

  const season = manager.getByLabel("관리할 시즌");
  await expect(season.locator("option")).toHaveCount(2);
  await season.selectOption({ index: 0 });
  await expect(manager.getByText("전체 60화")).toBeVisible();

  const search = manager.getByLabel("회차 검색");
  await search.fill("60");
  await expect(manager.locator("ul > li")).toHaveCount(1);
  await expect(manager.locator("ul > li").first()).toContainText("60화");

  await search.fill("");
  await manager.getByLabel("소장본 권").selectOption("12");
  await expect(manager.locator("ul > li")).toHaveCount(5);
  await expect(manager.locator("ul > li").first()).toContainText("60화");

  await manager.getByLabel("소장본 권").selectOption("all");
  await expect(manager.locator("ul > li")).toHaveCount(12);
  await expect(
    manager.getByRole("navigation", { name: "등록 회차 페이지" }),
  ).toBeVisible();

  await manager.getByLabel(/화 관리 메뉴/).first().click();
  await expect(
    manager.getByRole("button", { name: "정보 수정" }).first(),
  ).toBeVisible();
  await expect(
    manager.getByRole("button", { name: "원고 교체" }).first(),
  ).toBeVisible();
  await expect(
    manager.getByRole("button", { name: "회차 삭제" }).first(),
  ).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();
});

test("스튜디오 홈이 전체 작품을 보여주고 새 작품 관리로 바로 이동한다 @demo", async ({
  page,
}) => {
  await page.goto("/studio");

  // 공개 목록 한 페이지(12개)에 갇히지 않고 시드 전체가 보여야 한다.
  expect(await page.locator(".studio-home-card").count()).toBeGreaterThan(12);

  const seriesGridBox = await page.locator(".studio-home-grid").boundingBox();
  const newSeriesBox = await page
    .getByRole("region", { name: "새 작품 만들기" })
    .boundingBox();
  expect(newSeriesBox?.x).toBe(seriesGridBox?.x);
  expect(newSeriesBox?.width).toBe(seriesGridBox?.width);

  const uniqueSlug = `e2e-night-market-${Date.now()}`;
  const newSeriesForm = page.locator(".studio-new-series-form");
  await newSeriesForm.getByLabel("주소(slug)").fill(uniqueSlug);
  await newSeriesForm.getByLabel("새 작품 제목").fill("E2E 밤의 시장");
  await newSeriesForm.getByLabel("줄거리").fill("밤에만 열리는 시장 이야기");
  await newSeriesForm.getByLabel("장르").fill("판타지");
  await newSeriesForm.getByLabel("작가 이름").fill("E2E작가");
  await newSeriesForm.getByRole("button", { name: "작품 만들기" }).click();

  // 생성 즉시 새 작품 관리 화면으로 이동한다.
  await expect(page).toHaveURL(new RegExp(`/studio/series/${uniqueSlug}$`));
  await expect(
    page.getByRole("heading", { level: 1, name: "E2E 밤의 시장" }),
  ).toBeVisible();

  await page.getByRole("link", { name: "새 회차 올리기" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/studio/series/${uniqueSlug}/episodes/new$`),
  );
  await expect(
    page.getByRole("spinbutton", { name: "회차", exact: true }),
  ).toHaveValue("1");
});

test("작가가 모바일 화면에서 ZIP 순서를 확인하고 에피소드를 발행한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });

  // 새 회차 화면에서 추천 번호를 읽고, 작품 관리에서 공개 범위를 맞춘다.
  await page.goto("/studio/series/rooftop-garden/episodes/new");
  const nextEpisodeNumber = Number(
    await page
      .getByRole("spinbutton", { name: "회차", exact: true })
      .inputValue(),
  );

  await page.goto("/studio/series/rooftop-garden");
  await expect(page.getByText("독자 공개 범위")).toBeVisible();
  const freeVolumeInput = page.getByLabel("무료 공개 권 수");
  const previewSelect = page.getByLabel("다음 권 미리보기");
  const originalPolicy = {
    freeVolumeCount: Number(await freeVolumeInput.inputValue()),
    previewEpisodeCount: Number(await previewSelect.inputValue()),
  };
  await freeVolumeInput.fill(String(Math.ceil(nextEpisodeNumber / 5)));
  await previewSelect.selectOption("0");
  const policyResponse = page.waitForResponse(
    (response) =>
      response.url().includes("/api/studio/series/") &&
      response.url().endsWith("/access-policy") &&
      response.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: "공개 범위 저장" }).click();
  const updatedPolicy = await (await policyResponse).json();
  await expect(page.getByText("독자 공개 범위를 저장했어요.")).toBeVisible();

  await page.goto("/studio/series/rooftop-garden/episodes/new");
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("원고 한 묶음을");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();

  await page.getByLabel(/^제목/).fill("E2E 새벽 원고");
  await page.locator('input[accept=".zip,.cbz,application/zip"]').first().setInputFiles({
    name: "e2e-episode.cbz",
    mimeType: "application/zip",
    buffer: episodeArchive(),
  });

  const pageNames = page.locator(".page-preview-list li strong");
  await expect(pageNames).toHaveText(["1.png", "2.png", "10.png"]);
  const previewUrl = await page
    .locator(".page-preview-list img")
    .first()
    .getAttribute("src");
  expect(previewUrl).toBeTruthy();
  const previewResponse = await page.request.get(previewUrl!);
  expect(previewResponse.headers()["cache-control"]).toContain("no-store");
  await page
    .getByRole("button", { name: "2.png 뒤로 이동" })
    .click();
  await expect(pageNames).toHaveText(["1.png", "10.png", "2.png"]);

  const publishRequest = page.waitForRequest(
    (request) =>
      request.url().endsWith("/api/studio/episodes") &&
      request.method() === "POST",
  );
  const publishResponse = page.waitForResponse(
    (response) =>
      response.url().endsWith("/api/studio/episodes") &&
      response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "에피소드 등록" }).click();
  const originalRequest = await publishRequest;
  const originalResponse = await publishResponse;
  const requestBody = originalRequest.postDataJSON();
  const createdEpisode = await originalResponse.json();
  const replay = await page.request.post("/api/studio/episodes", {
    data: requestBody,
  });
  expect(replay.status()).toBe(201);
  expect((await replay.json()).episodeId).toBe(createdEpisode.episodeId);
  const conflict = await page.request.post("/api/studio/episodes", {
    data: { ...requestBody, title: "같은 키의 다른 원고" },
  });
  expect(conflict.status()).toBe(409);
  expect((await conflict.json()).code).toBe("IDEMPOTENCY_KEY_REUSED");
  await expect(
    page.getByRole("heading", {
      level: 2,
      name: "새 에피소드가 독자에게 열렸어요.",
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "등록한 에피소드 보기" }).click();

  await expect(page).toHaveURL(/\/read\/[^/]+$/);
  await expect(page.locator(".webtoon-strip")).toBeVisible();
  await expect(page.locator(".webtoon-strip img")).toHaveCount(3);

  const renderedUrl = await page
    .locator(".webtoon-strip img")
    .first()
    .getAttribute("src");
  const objectStorage = process.env.E2E_ASSET_STORAGE === "r2";
  const publishedUrl = objectStorage
    ? renderedUrl
    : new URL(renderedUrl!, "http://sweettoon.local").searchParams.get("url");
  if (objectStorage) {
    expect(publishedUrl).toMatch(/^http:\/\/localhost:\d+\/sweettoon-assets\//);
  } else {
    expect(renderedUrl).toContain("/_next/image?");
    expect(publishedUrl).toContain("/api/images/studio/");
  }
  expect(publishedUrl).toContain("/reader/001.webp");

  const publishedResponse = await page.request.get(publishedUrl!);
  expect(publishedResponse.headers()["cache-control"]).toContain("immutable");
  expect(publishedResponse.headers()["content-type"]).toContain("image/webp");

  if (objectStorage) {
    const privateOriginalUrl = publishedUrl!
      .replace("/sweettoon-assets/", "/sweettoon-originals/")
      .replace("/reader/001.webp", "/.original/001.png");
    const privateResponse = await page.request.get(privateOriginalUrl);
    expect(privateResponse.status()).toBe(403);
  }

  if (!objectStorage) {
    const optimizedQuery = new URLSearchParams({
      url: publishedUrl!,
      w: "640",
      q: "75",
    });
    const optimizedResponse = await page.request.get(
      `/_next/image?${optimizedQuery.toString()}`,
      { headers: { Accept: "image/webp" } },
    );
    expect(optimizedResponse.ok()).toBeTruthy();
    expect(optimizedResponse.headers()["content-type"]).toContain("image/webp");
  }

  const restoreResponse = await page.request.patch(
    `/api/studio/series/${encodeURIComponent(updatedPolicy.seriesId)}/access-policy`,
    { data: originalPolicy },
  );
  expect(restoreResponse.ok()).toBeTruthy();
});
