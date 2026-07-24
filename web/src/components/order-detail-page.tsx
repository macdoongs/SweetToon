import Link from "next/link";
import type { OrderDetail } from "@/lib/order-types";

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

export function OrderDetailPage({ order }: { order: OrderDetail }) {
  return (
    <main className="order-detail-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <Link href="/orders">주문 현황</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">{order.series.title}</strong>
      </nav>

      <header className="order-result">
        <span className={`order-status order-status--${order.status}`}>
          {statusLabel[order.status]}
        </span>
        <p className="eyebrow">Order received</p>
        <h1>
          {order.status === "canceled"
            ? "주문이 취소되었어요."
            : "소장본 주문을 받았어요."}
        </h1>
        <p>
          {order.series.title} 시즌 {order.season.number}을 한 권의 책으로
          준비합니다.
        </p>
      </header>

      <div className="order-detail-grid">
        <section className="order-detail-card">
          <div className="section-heading section-heading--compact">
            <div>
              <p className="eyebrow">Progress</p>
              <h2>제작 타임라인</h2>
            </div>
            <Link className="refresh-link" href={`/orders/${order.id}`}>
              상태 새로고침
            </Link>
          </div>
          <ol className="order-timeline">
            {order.events.map((event, index) => (
              <li key={event.id}>
                <span className="order-timeline__mark">{index + 1}</span>
                <div>
                  <strong>{statusLabel[event.status]}</strong>
                  <p>{event.message ?? "상태가 변경되었어요."}</p>
                  <time dateTime={event.createdAt}>
                    {new Intl.DateTimeFormat("ko-KR", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(event.createdAt))}
                  </time>
                </div>
              </li>
            ))}
          </ol>
        </section>

        <aside className="order-detail-card order-detail-card--summary">
          <p className="eyebrow">Details</p>
          <h2>{order.series.title}</h2>
          <p>시즌 {order.season.number} · {order.season.title}</p>
          <dl>
            <div><dt>판형</dt><dd>{order.bookSize}</dd></div>
            <div>
              <dt>표지</dt>
              <dd>{order.coverType === "hardcover" ? "하드커버" : "소프트커버"}</dd>
            </div>
            <div><dt>수량</dt><dd>{order.quantity}권</dd></div>
            {order.pageCount ? (
              <div><dt>페이지</dt><dd>{order.pageCount}쪽</dd></div>
            ) : null}
            {order.totalPrice !== null ? (
              <div className="order-detail-card__total">
                <dt>예상 제작비</dt>
                <dd>{won.format(order.totalPrice)}</dd>
              </div>
            ) : null}
          </dl>
          <small>주문 번호 {order.id}</small>
        </aside>
      </div>
    </main>
  );
}
