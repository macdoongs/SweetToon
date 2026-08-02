import { z } from "zod";
import { fieldIssueMessage } from "./validation";

const schema = z.object({
  quantity: z
    .number("수량은 숫자로 입력해 주세요.")
    .max(50, "수량은 한 번에 50권까지 주문할 수 있어요."),
  requestKey: z.string().uuid(),
  ordererName: z.string().min(2),
});

const labels = { quantity: "수량", ordererName: "주문자 닉네임" };
const fallback = "입력값을 다시 확인해 주세요.";

function issuesOf(input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) throw new Error("expected validation failure");
  return result.error;
}

describe("fieldIssueMessage", () => {
  it("사용자 입력 필드의 한국어 스키마 메시지를 그대로 노출한다", () => {
    const message = fieldIssueMessage(
      issuesOf({ quantity: 999, requestKey: "k", ordererName: "달콤" }),
      labels,
      fallback,
    );
    expect(message).toBe("수량은 한 번에 50권까지 주문할 수 있어요.");
  });

  it("한국어 메시지가 없는 필드는 라벨 기반 문구로 대체한다", () => {
    const message = fieldIssueMessage(
      issuesOf({
        quantity: 1,
        requestKey: "0b62f6e5-3a63-4f19-b6ae-3f4f2ea14b9a",
        ordererName: "달",
      }),
      labels,
      fallback,
    );
    expect(message).toBe("주문자 닉네임 값을 다시 확인해 주세요.");
  });

  it("내부 필드만 실패하면 fallback 문구로 뭉갠다", () => {
    const message = fieldIssueMessage(
      issuesOf({ quantity: 1, requestKey: "bad", ordererName: "달콤" }),
      labels,
      fallback,
    );
    expect(message).toBe(fallback);
  });
});
