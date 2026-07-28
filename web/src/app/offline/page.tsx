import type { Metadata } from "next";
import { OfflineRetry } from "@/components/offline-retry";

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
        오프라인에서는 새 화면을 불러올 수 없습니다. 연결이 복구되면 아래
        버튼으로 홈을 다시 불러와 주세요.
      </p>
      <OfflineRetry />
    </main>
  );
}
