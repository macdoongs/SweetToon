import { expect, test } from "@playwright/test";

test("브라우저 저장소가 막혀도 성공한 주문을 실패로 되돌리지 않는다", async ({
  page,
}) => {
  await page.addInitScript(() => {
    Storage.prototype.setItem = () => {
      throw new DOMException("blocked", "SecurityError");
    };
  });
  await page.goto("/series/moonlight-laundry");
  await page
    .getByRole("link", { name: /선택한 \d+권 주문하기/ })
    .click();
  await page.getByLabel("주문자 닉네임").fill("저장소차단독자");
  await page.getByRole("button", { name: "견적 확인하기" }).click();
  await page.getByRole("button", { name: "이 사양으로 주문하기" }).click();

  await expect(page).toHaveURL(/\/orders\/[^/?]+\?storage=unavailable$/);
  await expect(
    page.getByText("주문은 정상 접수됐지만 이 브라우저에"),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "소장본 주문을 받았어요." }),
  ).toBeVisible();
});

test("운영자가 주문을 상태·출처로 필터링하고 잘못된 주문 주소는 전용 안내를 받는다", async ({
  page,
}) => {
  await page.goto("/operations/orders");
  await page.getByRole("button", { name: "완료", exact: true }).click();
  await expect(page).toHaveURL(/\/operations\/orders\?status=done$/);
  await page.getByRole("button", { name: "봇 데모", exact: true }).click();
  await expect(page).toHaveURL(
    /\/operations\/orders\?status=done&source=bot$/,
  );
  // 서버 필터가 다음 페이지까지 적용되는지 API 응답으로 확정한다.
  const filtered = await page.request.get("/api/orders?status=done&source=bot");
  expect(filtered.ok()).toBeTruthy();
  const filteredBody = (await filtered.json()) as {
    items: Array<{ status: string; isDemo: boolean }>;
  };
  expect(
    filteredBody.items.every(
      (item) =>
        ["completed", "canceled"].includes(item.status) && item.isDemo,
    ),
  ).toBeTruthy();

  const chips = page.locator(".operations-card .order-status");
  await expect
    .poll(async () => {
      const texts = await chips.allTextContents();
      return texts.every((text) => /^(완료|취소)$/.test(text.trim()));
    })
    .toBeTruthy();

  // cuid 형식은 유효하지만 존재하지 않는 주문
  await page.goto("/orders/cm00000000000000000000000");
  await expect(
    page.getByRole("heading", { name: "해당 주문을 찾을 수 없어요." }),
  ).toBeVisible();
});

test("독자가 소장본을 주문하고 공개 응답에서 개인정보가 제외된다", async ({
  page,
}) => {
  await page.goto("/");

  const orderableSeries = page
    .locator(".series-card")
    .filter({ hasText: "소장 가능" })
    .first();
  await orderableSeries.locator("h3 a").click();
  await page
    .getByRole("link", { name: /선택한 \d+권 주문하기/ })
    .click();

  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("읽던 이야기를");

  await page.getByLabel("주문자 닉네임").fill("E2E독자");
  await page
    .getByLabel(/제작 메모/)
    .fill("E2E_PRIVATE_MARKER 공개 응답에 나오면 안 됩니다.");
  await page.getByRole("button", { name: "견적 확인하기" }).click();
  await expect(page.getByText(/Mock 견적/)).toBeVisible();
  await page.getByRole("button", { name: "이 사양으로 주문하기" }).click();

  await expect(page).toHaveURL(/\/orders\/[^/]+$/);
  await expect(
    page.getByRole("heading", { level: 1 }),
  ).toContainText("소장본 주문을 받았어요");
  await expect(
    page.getByRole("link", { name: "열린 회차 바로 읽기" }),
  ).toHaveAttribute("href", /\/series\/[^/]+#episodes$/);
  await expect(
    page.getByRole("link", { name: "주문 목록 보기" }),
  ).toBeVisible();
  await expect(page.getByText("E2E독자", { exact: true })).toHaveCount(0);

  // 헤더의 주문 메뉴가 방금 만든 주문으로 돌아가는 경로가 된다.
  const createdOrderId = new URL(page.url()).pathname.split("/").at(-1)!;
  await page.goto("/orders");
  const myOrders = page.locator(".my-orders");
  await expect(
    myOrders.getByRole("heading", { name: "이 브라우저에서 만든 주문" }),
  ).toBeVisible();
  await expect(
    myOrders.locator(`a[href="/orders/${createdOrderId}"]`),
  ).toBeVisible();

  // 공용 피드는 /orders/demo로 분리되어 있고 방금 주문도 포함한다.
  await page.getByRole("link", { name: "공용 데모 주문 피드 보기 →" }).click();
  await expect(page).toHaveURL(/\/orders\/demo$/);
  await expect(
    page.getByRole("heading", { name: "공용 데모 주문 피드" }),
  ).toBeVisible();
  await expect(
    page.locator(`a[href="/orders/${createdOrderId}"]`),
  ).toBeVisible();
  await page.goto(`/orders/${createdOrderId}`);
  await expect(page.getByText(/E2E_PRIVATE_MARKER/)).toHaveCount(0);

  const orderId = new URL(page.url()).pathname.split("/").at(-1);
  expect(orderId).toBeTruthy();
  const response = await page.request.get(
    `/api/orders/${encodeURIComponent(orderId ?? "")}`,
  );
  expect(response.ok()).toBeTruthy();
  const body = await response.json();
  expect(body).not.toHaveProperty("ordererName");
  expect(body).not.toHaveProperty("memo");
  expect(body).not.toHaveProperty("entitlementToken");
  const firstEvent = page.locator("time").first();
  await expect(firstEvent).toHaveAttribute(
    "datetime",
    body.events[0].createdAt,
  );
  await expect(firstEvent).toContainText("KST");

  const transition = await page.request.patch(
    `/api/orders/${encodeURIComponent(orderId ?? "")}/status`,
    { data: { status: "shipped" } },
  );
  expect(transition.ok()).toBeTruthy();
  await expect(page.getByText("배송 중", { exact: true }).first()).toBeVisible();
  await expect(
    page.getByText("소장본 제작을 마치고 배송을 시작했어요."),
  ).toBeVisible();
  await expect(page.getByRole("status")).toContainText("실시간 연결됨");

  await page.goto("/operations/orders");
  await expect(
    page.getByRole("heading", { level: 1, name: "소장본 제작 관리" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { level: 2, name: "실시간 데모 봇" }),
  ).toBeVisible();
  await page.getByLabel("변경 속도").selectOption("fast");
  await page.getByRole("button", { name: "봇 일시정지" }).click();
  await expect(page.locator(".demo-bot-status")).toHaveText("정지");
  await page.getByRole("button", { name: "봇 시작" }).click();
  await expect(page.locator(".demo-bot-status")).toHaveText("실행 중");
  await expect(page.locator(".demo-order-badge").first()).toBeVisible({
    timeout: 12_000,
  });
  const operation = page
    .locator(".operations-card")
    .filter({ hasText: orderId ?? "" });
  await expect(operation.getByText("배송 중", { exact: true })).toBeVisible();
  await operation.getByRole("button", { name: "완료 처리" }).click();
  await expect(operation.getByText("완료", { exact: true })).toBeVisible();

  await operation.getByRole("link", { name: "타임라인 보기" }).click();
  await expect(page).toHaveURL(new RegExp(`/orders/${orderId}$`));
  await expect(page.getByText("소장본 배송이 완료되었어요.")).toBeVisible();
});
