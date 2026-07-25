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

test("작가가 모바일 화면에서 ZIP 순서를 확인하고 에피소드를 발행한다", async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/studio");
  await expect(page.getByText("독자 공개 범위")).toBeVisible();
  await page.getByLabel("작품").selectOption({ label: "옥상 정원 클럽" });
  const freeVolumeInput = page.getByLabel("무료 공개 권 수");
  const previewSelect = page.getByLabel("다음 권 미리보기");
  const originalPolicy = {
    freeVolumeCount: Number(await freeVolumeInput.inputValue()),
    previewEpisodeCount: Number(await previewSelect.inputValue()),
  };
  const nextEpisodeNumber = Number(
    await page.getByLabel("회차").inputValue(),
  );
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

  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("원고 한 묶음을");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBeTruthy();

  await page.getByLabel("제목").fill("E2E 새벽 원고");
  await page.locator('input[type="file"]').first().setInputFiles({
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

  await page.getByRole("button", { name: "에피소드 등록" }).click();
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

  const publishedUrl = await page
    .locator(".webtoon-strip img")
    .first()
    .getAttribute("src");
  const objectStorage = process.env.E2E_ASSET_STORAGE === "r2";
  if (objectStorage) {
    expect(publishedUrl).toMatch(/^http:\/\/localhost:\d+\/sweettoon-assets\//);
  } else {
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
