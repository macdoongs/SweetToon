"use client";

import { useEffect, useState } from "react";

// 오프라인 폴백 화면에서 홈으로 Link 이동하면 서비스워커가 다시 이
// 페이지를 돌려줘 아무 변화가 없어 보인다. 연결이 돌아왔을 때만 실제
// 내비게이션을 일으키고, 여전히 오프라인이면 이유를 보여 준다.
export function OfflineRetry() {
  const [stillOffline, setStillOffline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      window.location.replace("/");
    };
    window.addEventListener("online", handleOnline);
    return () => window.removeEventListener("online", handleOnline);
  }, []);

  function retry() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setStillOffline(true);
      return;
    }
    window.location.replace("/");
  }

  return (
    <>
      <button className="button button--primary" onClick={retry} type="button">
        다시 연결하기
      </button>
      {stillOffline ? (
        <p role="status">
          아직 오프라인이에요. 연결이 돌아오면 자동으로 홈으로 이동합니다.
        </p>
      ) : null}
    </>
  );
}
