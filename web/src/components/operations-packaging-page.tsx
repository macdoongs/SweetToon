"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, getJson, patchJson } from "@/lib/api";
import { operationHeaders } from "@/lib/operations-headers";
import type { PackagingRequest } from "@/lib/studio-types";

const packagingStatusLabel: Record<PackagingRequest["status"], string> = {
  received: "접수됨",
  reviewing: "검토 중",
  completed: "제작 완료",
  canceled: "취소됨",
};

const packagingNextAction: Partial<
  Record<
    PackagingRequest["status"],
    { status: "reviewing" | "completed"; label: string }
  >
> = {
  received: { status: "reviewing", label: "검토 시작" },
  reviewing: { status: "completed", label: "제작 완료 처리" },
};

export function OperationsPackagingPage() {
  const [packagingRequests, setPackagingRequests] = useState<
    PackagingRequest[]
  >([]);
  const [packagingState, setPackagingState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [packagingBusyId, setPackagingBusyId] = useState<string | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback((signal?: AbortSignal) => {
    return getJson<{ items: PackagingRequest[] }>(
      "/api/studio/packaging-requests",
      signal,
    ).then(
      (response) => {
        if (signal?.aborted) return;
        setPackagingRequests(response.items);
        setPackagingState("ready");
      },
      () => {
        if (!signal?.aborted) setPackagingState("error");
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

  async function advancePackaging(
    request: PackagingRequest,
    status: "reviewing" | "completed" | "canceled",
  ) {
    setPackagingBusyId(request.id);
    setError(null);
    try {
      const updated = await patchJson<
        { status: "reviewing" | "completed" | "canceled" },
        PackagingRequest
      >(
        `/api/studio/packaging-requests/${encodeURIComponent(request.id)}/status`,
        { status },
        operationHeaders(),
      );
      setPackagingRequests((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "패키징 상태를 변경하지 못했습니다.",
      );
    } finally {
      setPackagingBusyId(null);
    }
  }

  return (
    <>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Packaging intake</p>
        <h1>책 패키징 신청 관리</h1>
        <p>
          창작자가 스튜디오에서 접수한 원고 묶음입니다. 접수 → 검토 → 제작
          완료 순서로만 진행할 수 있어요.
        </p>
      </header>

      {error ? (
        <p className="operations-error" role="alert">{error}</p>
      ) : null}

      <section
        className="operations-list operations-packaging"
        aria-label="패키징 신청 목록"
      >
        {packagingState === "loading" ? (
          <p aria-busy="true">패키징 신청을 불러오는 중…</p>
        ) : packagingState === "error" ? (
          <div className="orders-empty" role="alert">
            <h2>패키징 신청을 불러오지 못했어요.</h2>
            <button
              className="button button--ghost"
              onClick={() => void refresh()}
              type="button"
            >
              다시 시도
            </button>
          </div>
        ) : packagingRequests.length === 0 ? (
          <div className="orders-empty">
            <h2>아직 접수된 패키징 신청이 없어요.</h2>
            <p>창작자가 신청하면 이곳에서 검토 상태를 관리할 수 있어요.</p>
          </div>
        ) : (
          packagingRequests.map((request) => {
            const action = packagingNextAction[request.status];
            return (
              <article className="operations-card" key={request.id}>
                <div>
                  <span
                    className={`studio-packaging-status studio-packaging-status--${request.status}`}
                  >
                    {packagingStatusLabel[request.status]}
                  </span>
                  <h2>《{request.bookTitle}》</h2>
                  <p>
                    {request.applicantName} · 내지 {request.pageCount}쪽 ·{" "}
                    {request.bookSize} ·{" "}
                    {request.coverType === "hardcover"
                      ? "하드커버"
                      : "소프트커버"}{" "}
                    · {request.quantity}부
                  </p>
                  {request.memo ? <small>{request.memo}</small> : null}
                </div>
                <div className="operations-card__actions">
                  {action ? (
                    <>
                      <button
                        className="button button--ghost"
                        disabled={packagingBusyId === request.id}
                        onClick={() =>
                          void advancePackaging(request, "canceled")
                        }
                        type="button"
                      >
                        취소
                      </button>
                      <button
                        className="button button--primary"
                        disabled={packagingBusyId === request.id}
                        onClick={() =>
                          void advancePackaging(request, action.status)
                        }
                        type="button"
                      >
                        {packagingBusyId === request.id
                          ? "변경 중…"
                          : action.label}
                      </button>
                    </>
                  ) : (
                    <span className="operations-card__done">
                      {request.status === "canceled" ? "취소됨" : "처리 완료"}
                    </span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </>
  );
}
