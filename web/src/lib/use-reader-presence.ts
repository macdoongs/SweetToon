"use client";

import { useEffect, useState } from "react";
import { postJson } from "@/lib/api";
import { startBackoffPolling } from "@/lib/polling";
import {
  getReaderSessionId,
  type PresenceResponse,
} from "@/lib/realtime";

// 리더가 열려 있는 동안 시리즈 실시간 접속을 심장박동으로 알리고
// 현재 함께 읽는 독자 수를 돌려받는다.
export function useReaderPresence(seriesSlug: string | undefined) {
  const [viewerCount, setViewerCount] = useState<number | null>(null);

  useEffect(() => {
    if (!seriesSlug) return;
    let active = true;
    const heartbeat = async () => {
      // 숨겨진 탭은 실패가 아니므로 backoff를 키우지 않는다.
      if (document.visibilityState !== "visible") return true;
      try {
        const response = await postJson<
          { sessionId: string },
          PresenceResponse
        >(`/api/series/${encodeURIComponent(seriesSlug)}/presence`, {
          sessionId: getReaderSessionId(),
        });
        if (active) setViewerCount(response.viewerCount);
        return true;
      } catch {
        if (active) setViewerCount(null);
        return false;
      }
    };
    const stop = startBackoffPolling(heartbeat, {
      intervalMs: 20_000,
      maxIntervalMs: 160_000,
    });
    const onVisibilityChange = () => void heartbeat();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      active = false;
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [seriesSlug]);

  return viewerCount;
}
