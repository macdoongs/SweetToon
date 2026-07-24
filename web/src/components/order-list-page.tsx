import Image from "next/image";
import Link from "next/link";
import { formatKoreanDateTime } from "@/lib/date-time";
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
    </main>
  );
}
