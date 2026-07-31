import type { Metadata } from "next";
import { CandyPage } from "@/components/candy-page";

export const metadata: Metadata = {
  title: "캔디 충전",
  description: "SweetToon 데모 캔디를 충전합니다.",
  robots: { index: false, follow: false },
};

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ returnTo?: string | string[] }>;
}) {
  const query = await searchParams;
  const raw = Array.isArray(query.returnTo)
    ? query.returnTo[0]
    : query.returnTo;
  // 외부 리디렉션을 막기 위해 리더 내부 경로만 복귀 주소로 허용한다.
  const returnTo = raw && /^\/read\/[A-Za-z0-9_-]+$/.test(raw) ? raw : null;
  return <CandyPage returnTo={returnTo} />;
}
