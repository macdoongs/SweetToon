import Image from "next/image";
import Link from "next/link";
import type { OrderDetail } from "@/lib/order-types";

const statusLabel: Record<OrderDetail["status"], string> = {
  pending: "접수",
  processing: "제작 중",
  shipped: "배송 중",
  completed: "완료",
  canceled: "취소",
};

export function OrderListPage({ orders }: { orders: OrderDetail[] }) {
  return (
    <main className="orders-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">내 주문</strong>
      </nav>
      <header className="page-header page-header--compact">
        <p className="eyebrow">My shelf</p>
        <h1>내 주문</h1>
        <p>데모 계정에 접수된 소장본 제작 상태를 한눈에 확인하세요.</p>
      </header>

      {orders.length === 0 ? (
        <section className="orders-empty">
          <h2>아직 주문한 소장본이 없어요.</h2>
          <p>완결된 시즌을 골라 첫 번째 책을 만들어 보세요.</p>
          <Link className="button button--primary" href="/#discover">
            작품 둘러보기
          </Link>
        </section>
      ) : (
        <section className="order-list" aria-label="주문 목록">
          {orders.map((order) => (
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
                  <time dateTime={order.createdAt}>
                    {new Intl.DateTimeFormat("ko-KR", {
                      dateStyle: "medium",
                    }).format(new Date(order.createdAt))}
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
    </main>
  );
}
