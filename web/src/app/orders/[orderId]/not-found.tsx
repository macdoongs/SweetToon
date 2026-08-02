import Link from "next/link";

export default function OrderNotFound() {
  return (
    <main className="orders-error">
      <section className="orders-empty">
        <h2>해당 주문을 찾을 수 없어요.</h2>
        <p>
          주문이 삭제됐거나 주소가 잘못됐을 수 있어요. 주문 목록에서 다시
          찾아보세요.
        </p>
        <Link className="button button--primary" href="/orders">
          주문 목록 보기
        </Link>
      </section>
    </main>
  );
}
