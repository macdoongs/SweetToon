import type { Metadata } from "next";
import { ErrorState } from "@/components/reader-states";

export const metadata: Metadata = {
  title: "페이지를 찾을 수 없습니다",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <ErrorState
      title="페이지를 찾을 수 없어요"
      message="주소가 바뀌었거나 요청한 작품·회차·주문이 존재하지 않습니다."
    />
  );
}
