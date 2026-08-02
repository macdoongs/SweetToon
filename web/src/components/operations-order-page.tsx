"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getJson, patchJson } from "@/lib/api";
import { operationHeaders } from "@/lib/operations-headers";
import type {
  OrderDetail,
  OrderListResponse,
  OrderStatus,
  OrderSummary,
  OrderTransitionRequest,
} from "@/lib/order-types";

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

type OrdersFilter = {
  status: "" | "active" | "done";
  source: "" | "reader" | "bot";
  series: string;
};

function buildOrdersQuery(filters: OrdersFilter) {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.source) params.set("source", filters.source);
  if (filters.series.trim()) params.set("series", filters.series.trim());
  const query = params.toString();
  return query ? `?${query}` : "";
}

export function OperationsOrderPage({
  initialResponse,
}: {
  initialResponse: OrderListResponse;
}) {
  const [orders, setOrders] = useState(initialResponse.items);
  const [nextCursor, setNextCursor] = useState(initialResponse.nextCursor);
  const [loadingMore, setLoadingMore] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ordersRefreshFailed, setOrdersRefreshFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  // 필터는 서버 쿼리로 적용해 다음 페이지 주문도 누락하지 않는다.
  const [filters, setFilters] = useState<OrdersFilter>(() => {
    if (typeof window === "undefined") {
      return { status: "", source: "", series: "" };
    }
    const params = new URLSearchParams(window.location.search);
    const status = params.get("status");
    const source = params.get("source");
    return {
      status: status === "active" || status === "done" ? status : "",
      source: source === "reader" || source === "bot" ? source : "",
      series: params.get("series") ?? "",
    };
  });
  const [seriesInput, setSeriesInput] = useState(filters.series);
  const ordersQuery = buildOrdersQuery(filters);
  const matchesFilters = useCallback(
    (order: OrderSummary) => {
      if (
        filters.status === "active" &&
        ["completed", "canceled"].includes(order.status)
      ) {
        return false;
      }
      if (
        filters.status === "done" &&
        !["completed", "canceled"].includes(order.status)
      ) {
        return false;
      }
      if (filters.source && (filters.source === "bot") !== order.isDemo) {
        return false;
      }
      const keyword = filters.series.trim().toLowerCase();
      return !keyword || order.series.title.toLowerCase().includes(keyword);
    },
    [filters],
  );

  function applyFilters(next: OrdersFilter) {
    setFilters(next);
    setOrders([]);
    setNextCursor(null);
    const query = buildOrdersQuery(next);
    window.history.replaceState(
      window.history.state,
      "",
      `/operations/orders${query}`,
    );
  }

  const refresh = useCallback(
    (signal?: AbortSignal) => {
      if (refreshInFlight.current) return Promise.resolve();
      refreshInFlight.current = true;
      return getJson<OrderListResponse>(`/api/orders${ordersQuery}`, signal)
        .then(
          (orderResponse) => {
            if (signal?.aborted) return;
            setOrdersRefreshFailed(false);
            setOrders((current) => {
              const refreshedIds = new Set(
                orderResponse.items.map((order) => order.id),
              );
              // 커서로 불러온 이전 페이지는 유지하되, 현재 필터에 맞지
              // 않는 항목(예: 필터 없는 SSR 초기 목록)은 걷어낸다.
              return [
                ...orderResponse.items,
                ...current.filter(
                  (order) =>
                    !refreshedIds.has(order.id) && matchesFilters(order),
                ),
              ];
            });
          },
          () => {
            if (!signal?.aborted) setOrdersRefreshFailed(true);
          },
        )
        .finally(() => {
          refreshInFlight.current = false;
        });
    },
    [ordersQuery, matchesFilters],
  );

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

  async function advance(order: OrderSummary) {
    const action = nextAction[order.status];
    if (!action) return;
    setBusyId(order.id);
    setError(null);
    try {
      const updated = await patchJson<OrderTransitionRequest, OrderDetail>(
        `/api/orders/${encodeURIComponent(order.id)}/status`,
        { status: action.status },
        operationHeaders(),
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

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setError(null);
    try {
      const response = await getJson<OrderListResponse>(
        `/api/orders?cursor=${encodeURIComponent(nextCursor)}&limit=20${
          ordersQuery ? `&${ordersQuery.slice(1)}` : ""
        }`,
      );
      setOrders((current) => {
        const currentIds = new Set(current.map((order) => order.id));
        return [
          ...current,
          ...response.items.filter((order) => !currentIds.has(order.id)),
        ];
      });
      setNextCursor(response.nextCursor);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "이전 주문을 더 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
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

      {error ? (
        <p className="operations-error" role="alert">{error}</p>
      ) : null}
      {ordersRefreshFailed ? (
        <p className="operations-error" role="status">
          최신 주문 정보를 가져오지 못해 마지막 결과를 표시합니다. 자동으로
          다시 시도합니다.
        </p>
      ) : null}

      <section className="operations-filters" aria-label="주문 필터">
        <nav aria-label="제작 상태 필터">
          <strong>상태</strong>
          {(
            [
              ["", "전체"],
              ["active", "처리 필요"],
              ["done", "완료"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={filters.status === value}
              className="operations-filter"
              key={value || "all"}
              onClick={() => applyFilters({ ...filters, status: value })}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <nav aria-label="주문 출처 필터">
          <strong>출처</strong>
          {(
            [
              ["", "전체"],
              ["reader", "독자 주문"],
              ["bot", "봇 데모"],
            ] as const
          ).map(([value, label]) => (
            <button
              aria-pressed={filters.source === value}
              className="operations-filter"
              key={value || "all"}
              onClick={() => applyFilters({ ...filters, source: value })}
              type="button"
            >
              {label}
            </button>
          ))}
        </nav>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            applyFilters({ ...filters, series: seriesInput });
          }}
        >
          <label className="field">
            <span>작품명</span>
            <input
              maxLength={80}
              onChange={(event) => setSeriesInput(event.target.value)}
              placeholder="작품 제목으로 검색"
              value={seriesInput}
            />
          </label>
          <button className="button button--ghost" type="submit">
            검색
          </button>
        </form>
      </section>

      <section className="operations-list" aria-label="제작 주문 목록">
        {orders.length === 0 ? (
          <div className="orders-empty">
            <h2>조건에 맞는 제작 주문이 없어요.</h2>
            <p>독자가 소장본을 주문하면 이곳에서 제작 상태를 관리할 수 있어요.</p>
          </div>
        ) : (
          orders.map((order) => {
            const action = nextAction[order.status];
            return (
              <article className="operations-card" key={order.id}>
                <div>
                  <span className={`order-status order-status--${order.status}`}>
                    {statusLabel[order.status]}
                  </span>
                  {order.isDemo ? (
                    <span className="demo-order-badge">봇 데모</span>
                  ) : null}
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
          })
        )}
      </section>
      {nextCursor ? (
        <button
          className="button button--secondary"
          disabled={loadingMore}
          onClick={() => void loadMore()}
          type="button"
        >
          {loadingMore ? "불러오는 중…" : "이전 주문 더 보기"}
        </button>
      ) : null}
    </>
  );
}
