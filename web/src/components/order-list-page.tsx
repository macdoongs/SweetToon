"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ApiError, getJson } from "@/lib/api";
import { getMyOrders, type MyOrderRecord } from "@/lib/my-orders";
import { formatKoreanDateTime } from "@/lib/date-time";
import type { OrderListResponse, OrderSummary } from "@/lib/order-types";
import { DiscoverLink } from "./discover-link";

const statusLabel: Record<OrderSummary["status"], string> = {
  pending: "접수",
  processing: "제작 중",
  shipped: "배송 중",
  completed: "완료",
  canceled: "취소",
};

export function OrderListPage({
  initialNextCursor,
  orders,
}: {
  initialNextCursor: string | null;
  orders: OrderSummary[];
}) {
  const [items, setItems] = useState(orders);
  const [nextCursor, setNextCursor] = useState(initialNextCursor);
  const [myOrders, setMyOrders] = useState<MyOrderRecord[]>([]);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMyOrders(getMyOrders()));
    return () => cancelAnimationFrame(frame);
  }, []);
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState<string | null>(null);

  async function loadMore() {
    if (!nextCursor || loadingMore) return;
    setLoadingMore(true);
    setLoadMoreError(null);
    try {
      const response = await getJson<OrderListResponse>(
        `/api/orders?cursor=${encodeURIComponent(nextCursor)}&limit=20`,
      );
      setItems((current) => [...current, ...response.items]);
      setNextCursor(response.nextCursor);
    } catch (reason) {
      setLoadMoreError(
        reason instanceof ApiError
          ? reason.message
          : "주문을 더 불러오지 못했습니다.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <main className="orders-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">주문 현황</strong>
      </nav>
      <header className="page-header page-header--compact">
        <p className="eyebrow">Shared demo</p>
        <h1>데모 주문 현황</h1>
        <p>
          로그인 없는 공용 데모입니다. 소장본 제작 흐름과 상태 변화를
          확인해 보세요.
        </p>
        <Link className="operations-link" href="/operations/orders">
          데모 운영자 화면에서 상태 변경하기 →
        </Link>
      </header>

      {myOrders.length > 0 ? (
        <section className="my-orders" aria-label="이 브라우저의 주문">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">My orders</p>
              <h2>이 브라우저에서 만든 주문</h2>
            </div>
            <p>주문 기록은 이 브라우저에만 저장돼요.</p>
          </div>
          <ul>
            {myOrders.map((order) => (
              <li key={order.id}>
                <Link href={`/orders/${encodeURIComponent(order.id)}`}>
                  <strong>
                    {order.seriesTitle} · 시즌 {order.seasonNumber} ·{" "}
                    {order.volumeNumber}권
                  </strong>
                  <span>{formatKoreanDateTime(order.createdAt)} 주문</span>
                  <em>제작 타임라인 보기 →</em>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {items.length === 0 ? (
        <section className="orders-empty">
          <h2>아직 주문한 소장본이 없어요.</h2>
          <p>완결된 시즌을 골라 첫 번째 책을 만들어 보세요.</p>
          <DiscoverLink className="button button--primary">
            작품 둘러보기
          </DiscoverLink>
        </section>
      ) : (
        <section className="order-list" aria-label="주문 목록">
          {items.map((order) => (
            <Link
              className="order-list-card"
              href={`/orders/${encodeURIComponent(order.id)}`}
              key={order.id}
            >
              <div className="order-list-card__cover">
                {order.series.coverUrl ? (
                  <Image
                    alt=""
                    height={168}
                    sizes="(max-width: 700px) 64px, 86px"
                    src={order.series.coverUrl}
                    width={120}
                  />
                ) : (
                  <span>{order.series.title.slice(0, 1)}</span>
                )}
              </div>
              <div className="order-list-card__content">
                <div>
                  <span className={`order-status order-status--${order.status}`}>
                    {statusLabel[order.status]}
                  </span>
                  {order.isDemo ? (
                    <span className="demo-order-badge">봇 데모</span>
                  ) : null}
                  <time dateTime={order.createdAt}>
                    {formatKoreanDateTime(order.createdAt)}
                  </time>
                </div>
                <h2>{order.series.title}</h2>
                <p>
                  시즌 {order.season.number} · {order.bookSize} ·{" "}
                  {order.quantity}권
                </p>
              </div>
              <span className="order-list-card__arrow" aria-hidden="true">→</span>
            </Link>
          ))}
        </section>
      )}

      {nextCursor ? (
        <div className="order-list__more">
          {loadMoreError ? <p role="alert">{loadMoreError}</p> : null}
          <button
            className="button"
            disabled={loadingMore}
            onClick={() => void loadMore()}
            type="button"
          >
            {loadingMore ? "불러오는 중…" : "지난 주문 더 보기"}
          </button>
        </div>
      ) : null}
    </main>
  );
}
