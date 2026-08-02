"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { formatKoreanDateTime } from "@/lib/date-time";
import { getMyOrders, type MyOrderRecord } from "@/lib/my-orders";
import { DiscoverLink } from "./discover-link";

export function MyOrdersPage() {
  const [myOrders, setMyOrders] = useState<MyOrderRecord[] | null>(null);
  useEffect(() => {
    const frame = requestAnimationFrame(() => setMyOrders(getMyOrders()));
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <main className="orders-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">주문 현황</strong>
      </nav>
      <header className="page-header page-header--compact">
        <p className="eyebrow">My orders</p>
        <h1>주문 현황</h1>
        <p>
          이 브라우저에서 만든 소장본 주문으로 바로 돌아갈 수 있어요. 주문
          기록은 이 브라우저에만 저장됩니다.
        </p>
        <Link className="operations-link" href="/orders/demo">
          공용 데모 주문 피드 보기 →
        </Link>
      </header>

      {myOrders === null ? (
        <section className="order-list" aria-busy="true" aria-hidden="true">
          <div className="skeleton skeleton--order-card" />
        </section>
      ) : myOrders.length === 0 ? (
        <section className="orders-empty">
          <h2>아직 이 브라우저에서 주문한 소장본이 없어요.</h2>
          <p>
            완결된 시즌을 골라 첫 번째 책을 만들어 보세요. 다른 사람들의
            주문은 공용 데모 피드에서 볼 수 있어요.
          </p>
          <DiscoverLink className="button button--primary">
            작품 둘러보기
          </DiscoverLink>
        </section>
      ) : (
        <section className="my-orders" aria-label="이 브라우저의 주문">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">This browser</p>
              <h2>이 브라우저에서 만든 주문</h2>
            </div>
            <p>주문을 누르면 제작 타임라인으로 이동해요.</p>
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
      )}
    </main>
  );
}
