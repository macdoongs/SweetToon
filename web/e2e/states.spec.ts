import { expect, test } from "@playwright/test";

test("없는 경로를 한국어 404와 홈 복귀 동선으로 안내한다", async ({ page }) => {
  await page.goto("/series/does-not-exist");

  await expect(
    page.getByRole("heading", { name: "페이지를 찾을 수 없어요" }),
  ).toBeVisible();
  await expect(page.getByRole("link", { name: "홈으로 돌아가기" })).toHaveAttribute(
    "href",
    "/",
  );
});

test("뷰어 이미지 실패를 알리고 개별 이미지를 다시 불러온다", async ({
  page,
}) => {
  const detailResponse = await page.request.get(
    "/api/series/moonlight-laundry",
  );
  const detail = await detailResponse.json();
  const episodeId = detail.seasons[0].episodes[0].id as string;
  await page.route("**/_next/image**", (route) => route.abort("failed"));

  await page.goto(`/read/${encodeURIComponent(episodeId)}`);
  const firstPageError = page
    .locator(".reader-image-error")
    .filter({ hasText: "1쪽 이미지를 불러오지 못했어요." });
  const retry = firstPageError.getByRole("button", {
    name: "이미지 다시 불러오기",
  });
  await expect(retry).toBeVisible();

  await page.unroute("**/_next/image**");
  await retry.click();
  await expect(firstPageError).toHaveCount(0);
});

test("캔디 지갑 조회 실패를 알리고 다시 시도한다", async ({ page }) => {
  let failWallet = true;
  await page.route("**/api/candy-wallets/*", async (route) => {
    if (route.request().method() !== "GET") {
      await route.continue();
      return;
    }
    if (failWallet) {
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          code: "INTERNAL_ERROR",
          message: "캔디 지갑을 불러오지 못했습니다.",
        }),
      });
      return;
    }
    await route.continue();
  });

  await page.goto("/candy");
  await expect(page.locator(".candy-page__error")).toContainText(
    "캔디 지갑을 불러오지 못했습니다.",
  );
  failWallet = false;
  await page
    .locator(".candy-page__error")
    .getByRole("button", { name: "다시 시도" })
    .click();
  await expect(page.locator(".candy-balance strong")).not.toContainText("—");
});

test("스튜디오의 빈 목록과 조회 실패를 구분한다", async ({ page }) => {
  await page.route("**/api/studio/drafts", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL_ERROR", message: "조회 실패" }),
    }),
  );
  await page.route("**/api/studio/packaging-requests", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL_ERROR", message: "조회 실패" }),
    }),
  );

  await page.goto("/studio");
  await expect(
    page.getByRole("heading", {
      name: "비공개 보관함을 불러오지 못했어요.",
    }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", {
      name: "패키징 신청 내역을 불러오지 못했어요.",
    }),
  ).toBeVisible();

  await page.unroute("**/api/studio/drafts");
  await page.unroute("**/api/studio/packaging-requests");
  await page.getByRole("button", { name: "다시 시도" }).first().click();
  await expect(
    page.getByRole("heading", {
      name: /비공개로 보관한 회차가 없어요|비공개 보관함/,
    }),
  ).toBeVisible();
});

test("운영 보조 API 하나가 실패해도 다른 상태를 분리해 표시한다", async ({
  page,
}) => {
  await page.route("**/api/realtime/demo-bot", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ code: "INTERNAL_ERROR", message: "조회 실패" }),
    }),
  );

  await page.goto("/operations/orders");
  await expect(page.getByText("봇 상태를 불러오지 못했어요.")).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "책 패키징 신청 관리" }),
  ).toBeVisible();
  await expect(
    page.getByText("패키징 신청을 불러오는 중…"),
  ).toHaveCount(0);
});
