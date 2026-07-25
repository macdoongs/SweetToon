import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "오프라인",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="offline-page">
      <span className="offline-page__mark" aria-hidden="true">S</span>
      <p className="eyebrow">Offline shelf</p>
      <h1>잠시 인터넷 서가와 연결이 끊겼어요.</h1>
      <p>
        연결 상태를 확인한 뒤 다시 시도해 주세요. 이미 열어 둔 화면은
        브라우저에서 계속 볼 수 있습니다.
      </p>
      <Link className="button button--primary" href="/">
        다시 연결하기
      </Link>
    </main>
  );
}
