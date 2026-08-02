"use client";

import Link from "next/link";

export default function OrdersError({ reset }: { reset: () => void }) {
  return (
    <main className="orders-error">
      <section className="orders-empty" role="alert">
        <h2>주문 정보를 불러오지 못했어요.</h2>
        <p>네트워크 상태를 확인한 뒤 다시 시도해 주세요.</p>
        <div className="orders-error__actions">
          <button
            className="button button--primary"
            onClick={reset}
            type="button"
          >
            다시 시도
          </button>
          <Link className="button button--ghost" href="/orders">
            주문 목록으로 돌아가기
          </Link>
        </div>
      </section>
    </main>
  );
}
