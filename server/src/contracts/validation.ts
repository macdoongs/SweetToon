import type { ZodError } from "zod";

// 사용자가 직접 입력하는 필드만 라벨을 등록한다. requestKey처럼 내부에서
// 채우는 필드의 오류는 필드명을 노출하지 않고 fallback 문구로 뭉갠다.
export function fieldIssueMessage(
  error: ZodError,
  labels: Record<string, string>,
  fallback: string,
): string {
  for (const issue of error.issues) {
    const field = String(issue.path[0] ?? "");
    const label = labels[field];
    if (!label) continue;
    return /[가-힣]/.test(issue.message)
      ? issue.message
      : `${label} 값을 다시 확인해 주세요.`;
  }
  return fallback;
}
