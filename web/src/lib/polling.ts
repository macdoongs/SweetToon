"use client";

type BackoffPollingOptions = {
  intervalMs: number;
  maxIntervalMs: number;
};

// 실시간 보조 데이터(인기 순위, 동시 접속 수) 폴링용. 실패가 이어지면
// 간격을 2배씩 늘려 죽은 API를 고정 주기로 두드리지 않고, 성공하면
// 기본 주기로 되돌린다. task는 성공 여부를 반환한다.
export function startBackoffPolling(
  task: () => Promise<boolean>,
  { intervalMs, maxIntervalMs }: BackoffPollingOptions,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let delay = intervalMs;

  const run = async () => {
    const ok = await task().catch(() => false);
    if (stopped) return;
    delay = ok ? intervalMs : Math.min(delay * 2, maxIntervalMs);
    timer = setTimeout(() => void run(), delay);
  };

  void run();
  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
  };
}
