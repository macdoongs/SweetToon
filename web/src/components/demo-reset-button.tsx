"use client";

import { useState } from "react";
import { clearDemoRecords } from "@/lib/demo-reset";

export function DemoResetButton() {
  const [state, setState] = useState<"idle" | "confirm" | "done" | "error">(
    "idle",
  );

  if (state === "done") {
    return (
      <span className="demo-reset__done" role="status">
        찜·진행도·캔디·이용권 기록을 지웠어요.
      </span>
    );
  }

  return (
    <span className="demo-reset">
      <button
        className="demo-reset__button"
        onClick={() => {
          if (state !== "confirm") {
            setState("confirm");
            return;
          }
          setState(clearDemoRecords() ? "done" : "error");
        }}
        type="button"
      >
        {state === "confirm" ? "정말 초기화" : "데모 기록 초기화"}
      </button>
      {state === "confirm" ? (
        <button
          className="demo-reset__button"
          onClick={() => setState("idle")}
          type="button"
        >
          취소
        </button>
      ) : null}
      {state === "error" ? (
        <span role="alert">
          브라우저 저장소 설정 때문에 기록을 지우지 못했어요.
        </span>
      ) : null}
    </span>
  );
}
