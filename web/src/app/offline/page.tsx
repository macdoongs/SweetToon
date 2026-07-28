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
        연결 상태를 확인한 뒤 다시 시도해 주세요. 연결이 돌아오면
        자동으로 홈으로 이동합니다.
      </p>
      <OfflineRetry />
    </main>
  );
}
