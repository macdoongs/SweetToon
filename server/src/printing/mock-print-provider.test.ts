import { createPrintProvider } from "./mock-print-provider";

test("mock 견적은 외부 요청 없이 재현 가능한 금액을 계산한다", async () => {
  const provider = createPrintProvider();
  const quote = await provider.quote({
    size: "A5",
    binding: "perfect",
    pageCount: 100,
    quantity: 2,
  });

  expect(quote).toEqual({
    provider: "mock",
    currency: "KRW",
    unitPrice: 7_700,
    totalPrice: 15_400,
    estimatedBusinessDays: 5,
  });
});

test("과제 환경에서 mock 이외 provider는 fail-closed 처리한다", () => {
  expect(() => createPrintProvider("sweetbook")).toThrow(
    "과제 환경은 mock만 허용합니다",
  );
});

test("mock 주문은 외부 전송 없이 메모리에서 상태를 조회한다", async () => {
  const provider = createPrintProvider();
  const created = await provider.createOrder({
    referenceId: "order-1",
    recipientName: "홍길동",
    specification: {
      size: "B5",
      binding: "perfect",
      pageCount: 160,
      quantity: 1,
    },
  });

  expect(created.providerOrderId).toMatch(/^mock_/);
  await expect(provider.getOrder(created.providerOrderId)).resolves.toEqual(
    created,
  );
  await expect(provider.getOrder("missing")).resolves.toBeNull();
});
