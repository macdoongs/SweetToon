"use client";

import type { PackagingRequest } from "@/lib/studio-types";
import type { StudioCollectionState } from "@/lib/use-studio-collections";

const PACKAGING_STATUS_LABEL: Record<PackagingRequest["status"], string> = {
  received: "접수됨",
  reviewing: "검토 중",
  completed: "제작 완료",
  canceled: "취소됨",
};

export function StudioPackagingHistory({
  onRetry,
  requests,
  state,
}: {
  onRetry: () => void;
  requests: PackagingRequest[];
  state: StudioCollectionState;
}) {
  if (state === "loading") {
    return (
      <section className="studio-packaging-list" aria-busy="true">
        <h2>패키징 신청 내역을 불러오는 중…</h2>
      </section>
    );
  }
  if (state === "error") {
    return (
      <section className="studio-packaging-list" role="alert">
        <h2>패키징 신청 내역을 불러오지 못했어요.</h2>
        <button
          className="button button--ghost"
          onClick={onRetry}
          type="button"
        >
          다시 시도
        </button>
      </section>
    );
  }
  if (requests.length === 0) {
    return (
      <section className="studio-packaging-list">
        <h2>아직 패키징 신청 내역이 없어요.</h2>
        <p>원고 업로드 목적에서 ‘책 패키징 신청’을 선택해 접수할 수 있어요.</p>
      </section>
    );
  }
  return (
    <section className="studio-packaging-list" aria-label="패키징 신청 내역">
      <header>
        <div>
          <p className="eyebrow">Packaging</p>
          <h2>책 패키징 신청 내역</h2>
        </div>
        <p>실제 인쇄 없이 접수와 상태만 관리하는 데모 흐름입니다.</p>
      </header>
      <ul>
        {requests.map((request) => (
          <li key={request.id}>
            <div>
              <strong>《{request.bookTitle}》</strong>
              <span>
                {request.applicantName} · 내지 {request.pageCount}쪽 ·{" "}
                {request.bookSize} ·{" "}
                {request.coverType === "hardcover"
                  ? "하드커버"
                  : "소프트커버"}{" "}
                · {request.quantity}부
              </span>
              {request.memo ? <small>{request.memo}</small> : null}
            </div>
            <span
              className={`studio-packaging-status studio-packaging-status--${request.status}`}
            >
              {PACKAGING_STATUS_LABEL[request.status]}
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
