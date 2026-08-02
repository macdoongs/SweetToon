"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/operations", label: "데모 봇" },
  { href: "/operations/orders", label: "소장본 주문" },
  { href: "/operations/packaging", label: "패키징 신청" },
] as const;

export function OperationsNav() {
  const pathname = usePathname();
  return (
    <nav className="operations-nav" aria-label="운영 메뉴">
      {LINKS.map(({ href, label }) => (
        <Link
          aria-current={pathname === href ? "page" : undefined}
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
