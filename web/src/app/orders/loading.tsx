export default function OrdersLoading() {
  return (
    <main className="orders-loading" aria-busy="true">
      <header className="page-header page-header--compact">
        <p className="eyebrow">Orders</p>
        <h1>주문 정보를 불러오는 중…</h1>
      </header>
      <section className="order-list" aria-hidden="true">
        {Array.from({ length: 3 }, (_, index) => (
          <div className="skeleton skeleton--order-card" key={index} />
        ))}
      </section>
    </main>
  );
}
