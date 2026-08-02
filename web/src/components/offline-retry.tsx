"use client";

import { useSyncExternalStore } from "react";

export function OfflineRetry() {
  const online = useSyncExternalStore(
    subscribeToConnection,
    getConnectionSnapshot,
    getServerConnectionSnapshot,
  );

  return (
    <>
      <button
        className="button button--primary"
        disabled={!online}
        onClick={() => window.location.assign("/")}
        type="button"
      >
        {online ? "다시 연결하기" : "연결을 기다리는 중"}
      </button>
      <span aria-live="polite" className="sr-only">
        {online ? "인터넷 연결이 복구되었습니다." : "현재 오프라인입니다."}
      </span>
    </>
  );
}

function subscribeToConnection(notify: () => void): () => void {
  window.addEventListener("online", notify);
  window.addEventListener("offline", notify);
  return () => {
    window.removeEventListener("online", notify);
    window.removeEventListener("offline", notify);
  };
}

function getConnectionSnapshot(): boolean {
  return navigator.onLine;
}

function getServerConnectionSnapshot(): boolean {
  return false;
}
