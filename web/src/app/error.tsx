"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/reader-states";

export default function ErrorPage({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      message="잠시 문제가 생겼습니다. 연결을 확인한 뒤 다시 시도해 주세요."
      onRetry={unstable_retry}
    />
  );
}
