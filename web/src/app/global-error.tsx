"use client";

import { useEffect } from "react";

export default function GlobalError({
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
    <html lang="ko">
      <body
        style={{
          alignItems: "center",
          background: "#fff8ef",
          color: "#2d2118",
          display: "flex",
          fontFamily: "Arial, sans-serif",
          justifyContent: "center",
          margin: 0,
          minHeight: "100vh",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "520px", textAlign: "center" }}>
          <p style={{ color: "#9b5d35", fontWeight: 700 }}>SweetToon</p>
          <h1>화면을 표시하지 못했어요.</h1>
          <p>
            잠시 문제가 생겼습니다. 연결 상태를 확인한 뒤 다시 시도해 주세요.
          </p>
          <button
            onClick={unstable_retry}
            style={{
              background: "#2d2118",
              border: 0,
              borderRadius: "999px",
              color: "white",
              cursor: "pointer",
              fontWeight: 700,
              marginTop: "16px",
              padding: "12px 20px",
            }}
            type="button"
          >
            다시 시도
          </button>
        </main>
      </body>
    </html>
  );
}
