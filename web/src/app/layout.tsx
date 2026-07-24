import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "SweetToon — 읽고, 한 권으로 소장하다",
    template: "%s | SweetToon",
  },
  description:
    "웹툰을 감상하고 완결 시즌을 나만의 단행본으로 소장하는 콘텐츠 플랫폼",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <SiteHeader />
        {children}
      </body>
    </html>
  );
}
