import Link from "next/link";

export function LoadingCards() {
  return (
    <div className="card-grid" aria-label="작품을 불러오는 중" aria-busy="true">
      {Array.from({ length: 4 }, (_, index) => (
        <div className="series-card series-card--loading" key={index}>
          <div className="skeleton skeleton--cover" />
          <div className="skeleton skeleton--line" />
          <div className="skeleton skeleton--line skeleton--short" />
        </div>
      ))}
    </div>
  );
}

export function PageLoading({ label }: { label: string }) {
  return (
    <main className="state-page" aria-busy="true">
      <span className="state-page__eyebrow">잠시만요</span>
      <h1>{label}</h1>
      <div className="state-page__pulse" />
    </main>
  );
}

export function ErrorState({
  title = "페이지를 불러오지 못했어요",
  message,
  onRetry,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
}) {
  return (
    <main className="state-page">
      <span className="state-page__eyebrow">문제가 생겼어요</span>
      <h1>{title}</h1>
      <p>{message}</p>
      <div className="state-page__actions">
        {onRetry ? (
          <button className="button button--primary" onClick={onRetry}>
            다시 시도
          </button>
        ) : null}
        <Link className="button button--ghost" href="/">
          홈으로 돌아가기
        </Link>
      </div>
    </main>
  );
}
