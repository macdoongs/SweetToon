import type { ReactNode } from "react";
import Link from "next/link";
import { StudioAccessKey, StudioNav } from "@/components/studio-nav";

export default function StudioLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="studio-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">작가 스튜디오</strong>
      </nav>
      <StudioNav />
      <StudioAccessKey />
      {children}
    </main>
  );
}
