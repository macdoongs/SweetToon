import { expect, test } from "@playwright/test";

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
