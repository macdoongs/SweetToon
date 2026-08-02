"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, getJson, patchJson, postJson } from "@/lib/api";
import type {
  DemoBotSpeed,
  DemoBotStatus,
  DemoBotUpdate,
} from "@/lib/demo-bot-types";
import { operationHeaders } from "@/lib/operations-headers";

export function OperationsBotPage() {
  const [botBusy, setBotBusy] = useState(false);
  const [botStatus, setBotStatus] = useState<DemoBotStatus | null>(null);
  const [botState, setBotState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((signal?: AbortSignal) => {
    return getJson<DemoBotStatus>("/api/realtime/demo-bot", signal).then(
      (nextBotStatus) => {
        if (signal?.aborted) return;
        setBotStatus(nextBotStatus);
        setBotState("ready");
      },
      () => {
        if (!signal?.aborted) setBotState("error");
      },
    );
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void refresh(controller.signal);
    const interval = window.setInterval(
      () => void refresh(controller.signal),
      3_000,
    );
    return () => {
      controller.abort();
      window.clearInterval(interval);
    };
  }, [refresh]);

  async function updateBot(input: DemoBotUpdate) {
    setBotBusy(true);
    setError(null);
    try {
      const updated = await patchJson<DemoBotUpdate, DemoBotStatus>(
        "/api/realtime/demo-bot",
        input,
        operationHeaders(),
      );
      setBotStatus(updated);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "실시간 데모 봇을 변경하지 못했습니다.",
      );
    } finally {
      setBotBusy(false);
    }
  }

  async function resetBot() {
    setBotBusy(true);
    setError(null);
    try {
      const updated = await postJson<Record<string, never>, DemoBotStatus>(
        "/api/realtime/demo-bot/reset",
        {},
        undefined,
        operationHeaders(),
      );
      setBotStatus(updated);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "데모 봇 데이터를 초기화하지 못했습니다.",
      );
    } finally {
      setBotBusy(false);
    }
  }

  return (
    <>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Operations demo</p>
        <h1>실시간 데모 봇</h1>
        <p>
          가상 독자가 작품을 옮겨 읽고, 데모 주문이 일정 시간마다 다음
          단계로 이동합니다. 공용 시연 환경을 여기서 제어하세요.
        </p>
      </header>

      {error ? (
        <p className="operations-error" role="alert">{error}</p>
      ) : null}

      <section className="demo-bot-panel" aria-label="실시간 데모 봇">
        <div className="demo-bot-panel__heading">
          <div>
            <p className="eyebrow">Realtime simulator</p>
            <h2>봇 제어</h2>
            <p>변경 사항은 모든 방문자의 화면에 함께 반영됩니다.</p>
          </div>
          <span
            className={`demo-bot-status ${
              botStatus?.running ? "demo-bot-status--running" : ""
            }`}
          >
            {botStatus?.running
              ? botStatus.leader
                ? "실행 중"
                : "대기 중"
              : "정지"}
          </span>
        </div>
        {botState === "error" ? (
          <div className="demo-bot-panel__activity" role="alert">
            <p>봇 상태를 불러오지 못했어요.</p>
            <button
              className="button button--ghost"
              onClick={() => void refresh()}
              type="button"
            >
              다시 시도
            </button>
          </div>
        ) : botStatus ? (
          <>
            <div className="demo-bot-metrics">
              <strong>{botStatus.activeBotCount}명</strong>
              <span>현재 가상 독자</span>
              <strong>{botStatus.tickIntervalSeconds}초</strong>
              <span>갱신 주기</span>
            </div>
            <div className="demo-bot-controls">
              <button
                className="button button--primary"
                disabled={botBusy || !botStatus.available}
                onClick={() =>
                  void updateBot({ running: !botStatus.running })
                }
                type="button"
              >
                {botStatus.running ? "봇 일시정지" : "봇 시작"}
              </button>
              <label>
                <span>목표 독자 수</span>
                <select
                  disabled={botBusy || !botStatus.available}
                  onChange={(event) =>
                    void updateBot({ readerCount: Number(event.target.value) })
                  }
                  value={botStatus.readerCount}
                >
                  {[0, 4, 8, 12, 20, 30].map((count) => (
                    <option key={count} value={count}>
                      {count}명
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>변경 속도</span>
                <select
                  disabled={botBusy || !botStatus.available}
                  onChange={(event) =>
                    void updateBot({
                      speed: event.target.value as DemoBotSpeed,
                    })
                  }
                  value={botStatus.speed}
                >
                  <option value="slow">천천히</option>
                  <option value="normal">보통</option>
                  <option value="fast">빠르게</option>
                </select>
              </label>
              <button
                className="button button--ghost"
                disabled={botBusy || !botStatus.available}
                onClick={() => void resetBot()}
                type="button"
              >
                데모 데이터 초기화
              </button>
            </div>
            <p className="demo-bot-panel__activity" aria-live="polite">
              {botStatus.available
                ? botStatus.lastAction ?? "첫 갱신을 준비하고 있습니다."
                : "이 환경에서는 데모 봇이 비활성화되어 있습니다."}
            </p>
          </>
        ) : (
          <p className="demo-bot-panel__activity">봇 상태를 불러오는 중…</p>
        )}
      </section>
    </>
  );
}
