"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getJson, patchJson, postJson } from "@/lib/api";
import type {
  DemoBotSpeed,
  DemoBotStatus,
  DemoBotUpdate,
} from "@/lib/demo-bot-types";
import type {
  OrderDetail,
  OrderListResponse,
  OrderStatus,
  OrderSummary,
  OrderTransitionRequest,
} from "@/lib/order-types";
import type { PackagingRequest } from "@/lib/studio-types";
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
  const [packagingRequests, setPackagingRequests] = useState<
    PackagingRequest[]
  >([]);
  const [packagingState, setPackagingState] = useState<
    "loading" | "ready" | "error"
  >("loading");
  const [packagingBusyId, setPackagingBusyId] = useState<string | null>(
    null,
  );
  const [botBusy, setBotBusy] = useState(false);
  const [botStatus, setBotStatus] = useState<DemoBotStatus | null>(null);
  const [botState, setBotState] = useState<"loading" | "ready" | "error">(
    "loading",
  );
  const [ordersRefreshFailed, setOrdersRefreshFailed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refreshInFlight = useRef(false);
  const [accessKey, setAccessKey] = useState(() =>
    loadSecurityAccessKey("operations"),
  );
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
      if (filters.status === "active" && ["completed", "canceled"].includes(order.status)) {
        return false;
      }
      if (filters.status === "done" && !["completed", "canceled"].includes(order.status)) {
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

  const refresh = useCallback(async (signal?: AbortSignal) => {
    if (refreshInFlight.current) return;
    refreshInFlight.current = true;
    try {
      await Promise.allSettled([
        getJson<OrderListResponse>(`/api/orders${ordersQuery}`, signal).then(
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
        ),
        getJson<DemoBotStatus>("/api/realtime/demo-bot", signal).then(
          (nextBotStatus) => {
            if (signal?.aborted) return;
            setBotStatus(nextBotStatus);
            setBotState("ready");
          },
          () => {
            if (!signal?.aborted) setBotState("error");
          },
        ),
        getJson<{ items: PackagingRequest[] }>(
          "/api/studio/packaging-requests",
          signal,
        ).then(
          (packagingResponse) => {
            if (signal?.aborted) return;
            setPackagingRequests(packagingResponse.items);
            setPackagingState("ready");
          },
          () => {
            if (!signal?.aborted) setPackagingState("error");
          },
        ),
      ]);
    } finally {
      refreshInFlight.current = false;
    }
  }, [ordersQuery, matchesFilters]);

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

  const operationHeaders: Record<string, string> = accessKey.trim()
    ? { "x-sweettoon-operations-key": accessKey.trim() }
    : {};

  async function updateBot(input: DemoBotUpdate) {
    setBotBusy(true);
    setError(null);
    try {
      const updated = await patchJson<DemoBotUpdate, DemoBotStatus>(
        "/api/realtime/demo-bot",
        input,
        operationHeaders,
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
        operationHeaders,
      );
      setBotStatus(updated);
      const orderResponse = await getJson<OrderListResponse>("/api/orders");
      setOrders(orderResponse.items);
      setNextCursor(orderResponse.nextCursor);
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

  async function advance(order: OrderSummary) {
    const action = nextAction[order.status];
    if (!action) return;
    setBusyId(order.id);
    setError(null);
    try {
      const updated = await patchJson<OrderTransitionRequest, OrderDetail>(
        `/api/orders/${encodeURIComponent(order.id)}/status`,
        { status: action.status },
        accessKey.trim()
          ? operationHeaders
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
        operationHeaders,
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

      <section className="demo-bot-panel" aria-label="실시간 데모 봇">
        <div className="demo-bot-panel__heading">
          <div>
            <p className="eyebrow">Realtime simulator</p>
            <h2>실시간 데모 봇</h2>
            <p>
              가상 독자가 작품을 옮겨 읽고, 데모 주문이 일정 시간마다 다음
              단계로 이동합니다.
            </p>
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
            <h2>아직 접수된 제작 주문이 없어요.</h2>
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

      <section
        className="operations-list operations-packaging"
        aria-label="패키징 신청 목록"
      >
        <header className="operations-packaging__header">
          <p className="eyebrow">Packaging intake</p>
          <h2>책 패키징 신청 관리</h2>
          <p>
            창작자가 스튜디오에서 접수한 원고 묶음입니다. 접수 → 검토 → 제작
            완료 순서로만 진행할 수 있어요.
          </p>
        </header>
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
            const terminal =
              request.status === "completed" ||
              request.status === "canceled";
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
                      {terminal && request.status === "canceled"
                        ? "취소됨"
                        : "처리 완료"}
                    </span>
                  )}
                </div>
              </article>
            );
          })
        )}
      </section>
    </main>
  );
}
