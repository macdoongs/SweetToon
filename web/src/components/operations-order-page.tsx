"use client";

import Link from "next/link";
import { useState } from "react";
import { ApiError, patchJson } from "@/lib/api";
import type {
  OrderDetail,
  OrderStatus,
  OrderTransitionRequest,
} from "@/lib/order-types";
import {
  loadSecurityAccessKey,
  saveSecurityAccessKey,
} from "@/lib/security-access";

const statusLabel: Record<OrderStatus, string> = {
  pending: "접수",
  processing: "제작 중",
  shipped: "배송 중",
  completed: "완료",
  canceled: "취소",
};

const nextAction: Partial<
  Record<
    OrderStatus,
    { status: OrderTransitionRequest["status"]; label: string }
  >
> = {
  pending: { status: "processing", label: "제작 시작" },
  processing: { status: "shipped", label: "배송 시작" },
  shipped: { status: "completed", label: "완료 처리" },
};

export function OperationsOrderPage({
  initialOrders,
}: {
  initialOrders: OrderDetail[];
}) {
  const [orders, setOrders] = useState(initialOrders);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [accessKey, setAccessKey] = useState(() =>
    loadSecurityAccessKey("operations"),
  );

  async function advance(order: OrderDetail) {
    const action = nextAction[order.status];
    if (!action) return;
    setBusyId(order.id);
    setError(null);
    try {
      const updated = await patchJson<OrderTransitionRequest, OrderDetail>(
        `/api/orders/${encodeURIComponent(order.id)}/status`,
        { status: action.status },
        accessKey.trim()
          ? { "x-sweettoon-operations-key": accessKey.trim() }
          : {},
      );
      setOrders((current) =>
        current.map((item) => (item.id === updated.id ? updated : item)),
      );
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "상태를 변경하지 못했습니다.",
      );
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="operations-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">데모 운영자</strong>
      </nav>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Operations demo</p>
        <h1>소장본 제작 관리</h1>
        <p>
          실제 운영 권한 화면이 아닌 과제용 공용 데모입니다. 주문을 다음
          제작 단계로만 이동할 수 있습니다.
        </p>
        <Link className="operations-link" href="/orders">
          독자 주문 현황으로 돌아가기 →
        </Link>
      </header>

      <details className="operations-security-access">
        <summary>운영 보안 설정</summary>
        <label className="field">
          <span>운영자 접근 키</span>
          <input
            autoComplete="off"
            onChange={(event) => {
              setAccessKey(event.target.value);
              saveSecurityAccessKey("operations", event.target.value);
            }}
            placeholder="운영 strict 모드에서만 필요"
            type="password"
            value={accessKey}
          />
        </label>
        <p>키는 현재 탭의 sessionStorage에만 보관됩니다.</p>
      </details>

      {error ? (
        <p className="operations-error" role="alert">{error}</p>
      ) : null}

      <section className="operations-list" aria-label="제작 주문 목록">
        {orders.map((order) => {
          const action = nextAction[order.status];
          return (
            <article className="operations-card" key={order.id}>
              <div>
                <span className={`order-status order-status--${order.status}`}>
                  {statusLabel[order.status]}
                </span>
                <h2>{order.series.title}</h2>
                <p>
                  시즌 {order.season.number} · {order.bookSize} ·{" "}
                  {order.quantity}권
                </p>
                <small>주문 {order.id}</small>
              </div>
              <div className="operations-card__actions">
                <Link href={`/orders/${encodeURIComponent(order.id)}`}>
                  타임라인 보기
                </Link>
                {action ? (
                  <button
                    className="button button--primary"
                    disabled={busyId === order.id}
                    onClick={() => void advance(order)}
                    type="button"
                  >
                    {busyId === order.id ? "변경 중…" : action.label}
                  </button>
                ) : (
                  <span className="operations-card__done">
                    {order.status === "canceled" ? "취소됨" : "처리 완료"}
                  </span>
                )}
              </div>
            </article>
          );
        })}
      </section>
    </main>
  );
}
