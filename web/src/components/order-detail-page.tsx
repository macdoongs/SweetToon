"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { OrderDetail } from "@/lib/order-types";
import { formatKoreanDateTime } from "@/lib/date-time";

const statusLabel: Record<OrderDetail["status"], string> = {
  pending: "주문 접수",
  processing: "책 제작 중",
  shipped: "배송 중",
  completed: "배송 완료",
  canceled: "주문 취소",
};

const won = new Intl.NumberFormat("ko-KR", {
  style: "currency",
  currency: "KRW",
  maximumFractionDigits: 0,
});

export function OrderDetailPage({
  order,
  browserStorageUnavailable = false,
}: {
  order: OrderDetail;
  browserStorageUnavailable?: boolean;
}) {
  const [liveOrder, setLiveOrder] = useState(order);
  const [connection, setConnection] = useState<
    "connecting" | "live" | "retrying"
  >("connecting");

  useEffect(() => {
    const source = new EventSource(
      `/api/orders/${encodeURIComponent(order.id)}/events`,
    );
    source.addEventListener("open", () => setConnection("live"));
    source.addEventListener("error", () => setConnection("retrying"));
    source.addEventListener("order", (event) => {
      const incoming = JSON.parse((event as MessageEvent<string>).data) as OrderDetail;
      setLiveOrder((current) =>
        Date.parse(incoming.updatedAt) >= Date.parse(current.updatedAt)
          ? incoming
          : current,
      );
      setConnection("live");
    });
    return () => source.close();
  }, [order.id]);

  return (
    <main className="order-detail-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <Link href="/orders">주문 현황</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{liveOrder.series.title}</strong>
      </nav>

      <header className="order-result">
        <span className={`order-status order-status--${liveOrder.status}`}>
          {statusLabel[liveOrder.status]}
        </span>
        {liveOrder.isDemo ? (
          <span className="demo-order-badge">봇 데모</span>
        ) : null}
        <p className="eyebrow">Order received</p>
        <h1>
          {liveOrder.status === "canceled"
            ? "주문이 취소되었어요."
            : "소장본 주문을 받았어요."}
        </h1>
        <p>
          {liveOrder.series.title} 시즌 {liveOrder.season.number} ·{" "}
          {liveOrder.volumeNumber}권을 준비합니다.{" "}
          {liveOrder.candyBonus > 0
            ? `보너스 캔디 ${liveOrder.candyBonus}개도 이 브라우저에 지급했어요.`
            : "수록 회차도 이 브라우저에서 바로 열렸어요."}
        </p>
      </header>
      {browserStorageUnavailable ? (
        <p className="form-error" role="alert">
          주문은 정상 접수됐지만 이 브라우저에 디지털 이용권을 저장하지
          못했어요. 브라우저 저장소 설정을 확인해 주세요.
        </p>
      ) : null}

      <div className="order-detail-grid">
        <section className="order-detail-card">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">Progress</p>
              <h2>제작 타임라인</h2>
            </div>
            <span
              className={`realtime-status realtime-status--${connection}`}
              role="status"
            >
              <i aria-hidden="true" />
              {connection === "live"
                ? "실시간 연결됨"
                : connection === "retrying"
                  ? "재연결 중"
                  : "연결 중"}
            </span>
          </div>
          <ol className="order-timeline">
            {liveOrder.events.map((event, index) => (
              <li key={event.id}>
                <span className="order-timeline__mark">{index + 1}</span>
                <div>
                  <strong>{statusLabel[event.status]}</strong>
                  <p>{event.message ?? "상태가 변경되었어요."}</p>
                  <time dateTime={event.createdAt}>
                    {formatKoreanDateTime(event.createdAt)}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="order-detail-card order-detail-card--summary">
          <p className="eyebrow">Details</p>
          <h2>{liveOrder.series.title}</h2>
          <p>시즌 {liveOrder.season.number} · {liveOrder.season.title}</p>
          <dl>
            <div><dt>판형</dt><dd>{liveOrder.bookSize}</dd></div>
            <div>
              <dt>표지</dt>
              <dd>{liveOrder.coverType === "hardcover" ? "하드커버" : "소프트커버"}</dd>
            </div>
            <div><dt>수량</dt><dd>{liveOrder.quantity}권</dd></div>
            <div><dt>수록 범위</dt><dd>{liveOrder.volumeNumber}권 · 최대 5화</dd></div>
            {liveOrder.candyBonus > 0 ? (
              <div className="order-detail-card__benefit">
                <dt>구매 혜택</dt>
                <dd>🍬 캔디 {liveOrder.candyBonus}개</dd>
              </div>
            ) : null}
            {liveOrder.pageCount ? (
              <div><dt>페이지</dt><dd>{liveOrder.pageCount}쪽</dd></div>
            ) : null}
            {liveOrder.totalPrice !== null ? (
              <div className="order-detail-card__total">
                <dt>예상 제작비</dt>
                <dd>{won.format(liveOrder.totalPrice)}</dd>
              </div>
            ) : null}
          </dl>
          <small>주문 번호 {liveOrder.id}</small>
        </aside>
      </div>
    </main>
  );
}
