import { expect, test } from "@playwright/test";

test("독자가 소장본을 주문하고 공개 응답에서 개인정보가 제외된다", async ({
  page,
}) => {
  await page.goto("/");

  const orderableSeries = page
    .locator(".series-card")
    .filter({ hasText: "소장 가능" })
    .first();
  await orderableSeries.locator("h3 a").click();
  await page.getByRole("link", { name: /시즌 \d+ 주문하기/ }).first().click();

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
  await expect(page.getByText("E2E독자", { exact: true })).toHaveCount(0);
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
});
