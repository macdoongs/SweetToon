import type { Metadata } from "next";
import { FavoritesPage } from "@/components/favorites-page";

export const metadata: Metadata = {
  title: "찜 목록",
  description: "SweetToon에서 찜한 작품을 확인합니다.",
  robots: { index: false, follow: false },
};

export default function Page() {
  return <FavoritesPage />;
}
