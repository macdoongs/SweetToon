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

  // 이전 ?mode= 주소는 분리된 하위 라우트로 이동한다.
  await page.goto("/studio?mode=draft");
  await expect(page).toHaveURL(/\/studio\/drafts$/);
  await expect(
    page.getByRole("heading", {
      name: "비공개 보관함을 불러오지 못했어요.",
    }),
  ).toBeVisible();

  await page.goto("/studio/packaging");
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
      name: /아직 패키징 신청 내역이 없어요|책 패키징 신청 내역/,
    }),
  ).toBeVisible();
  await page.getByRole("link", { name: "비공개 보관함" }).click();
  await expect(page).toHaveURL(/\/studio\/drafts$/);
  await expect(
    page.getByRole("heading", {
      level: 2,
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

  // 봇 API 실패는 봇 화면에만 나타난다.
  await page.goto("/operations");
  await expect(page.getByText("봇 상태를 불러오지 못했어요.")).toBeVisible();

  // 주문·패키징 화면은 봇 실패와 무관하게 정상 동작한다.
  await page.getByRole("link", { name: "소장본 주문" }).click();
  await expect(page).toHaveURL(/\/operations\/orders$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "소장본 제작 관리" }),
  ).toBeVisible();
  await expect(page.getByText("봇 상태를 불러오지 못했어요.")).toHaveCount(0);

  await page.getByRole("link", { name: "패키징 신청" }).click();
  await expect(page).toHaveURL(/\/operations\/packaging$/);
  await expect(
    page.getByRole("heading", { level: 1, name: "책 패키징 신청 관리" }),
  ).toBeVisible();
  await expect(
    page.getByText("패키징 신청을 불러오는 중…"),
  ).toHaveCount(0);
});

test("사라진 주문의 실시간 스트림은 무한 재연결을 중단한다", async ({
  page,
}) => {
  const ordersResponse = await page.request.get("/api/orders");
  const orders = await ordersResponse.json();
  const orderId = orders.items[0].id as string;
  const encodedOrderId = encodeURIComponent(orderId);

  await page.route(`**/api/orders/${encodedOrderId}/events`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        code: "ORDER_NOT_FOUND",
        message: "주문을 찾을 수 없습니다.",
      }),
    }),
  );
  await page.route(`**/api/orders/${encodedOrderId}`, (route) =>
    route.fulfill({
      status: 404,
      contentType: "application/json",
      body: JSON.stringify({
        code: "ORDER_NOT_FOUND",
        message: "주문을 찾을 수 없습니다.",
      }),
    }),
  );

  await page.goto(`/orders/${encodedOrderId}`);
  await expect(page.getByRole("status")).toContainText("실시간 갱신 중단");
  await expect(page.getByText(`주문 번호 ${orderId}`)).toBeVisible();
});

test("오프라인 안내는 실제 연결 상태에 맞춰 재시도를 활성화한다", async ({
  context,
  page,
}) => {
  await page.goto("/offline");
  await expect(
    page.getByRole("button", { name: "다시 연결하기" }),
  ).toBeEnabled();

  await context.setOffline(true);
  await expect(
    page.getByRole("button", { name: "연결을 기다리는 중" }),
  ).toBeDisabled();

  await context.setOffline(false);
  await expect(
    page.getByRole("button", { name: "다시 연결하기" }),
  ).toBeEnabled();
});
