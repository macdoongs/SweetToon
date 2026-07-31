import type { ReactNode } from "react";
import Link from "next/link";
import { OperationsAccessKey } from "@/components/operations-access-key";
import { OperationsNav } from "@/components/operations-nav";

export default function OperationsLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <main className="operations-page">
      <nav className="page-breadcrumb" aria-label="현재 위치">
        <Link href="/">홈</Link>
        <span aria-hidden="true">/</span>
        <strong aria-current="page">데모 운영자</strong>
      </nav>
      <OperationsNav />
      <OperationsAccessKey />
      {children}
    </main>
  );
}
