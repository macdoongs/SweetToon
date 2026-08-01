"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  loadSecurityAccessKey,
  saveSecurityAccessKey,
} from "@/lib/security-access";

const LINKS = [
  { href: "/studio", label: "내 작품" },
  { href: "/studio/drafts", label: "비공개 보관함" },
  { href: "/studio/packaging", label: "책 패키징" },
] as const;

export function StudioNav() {
  const pathname = usePathname();
  return (
    <nav className="operations-nav" aria-label="스튜디오 메뉴">
      {LINKS.map(({ href, label }) => (
        <Link
          aria-current={
            (href === "/studio"
              ? pathname === "/studio" ||
                pathname.startsWith("/studio/series")
              : pathname === href)
              ? "page"
              : undefined
          }
          href={href}
          key={href}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}

export function StudioAccessKey() {
  const [accessKey, setAccessKey] = useState(() =>
    loadSecurityAccessKey("studio"),
  );
  return (
    <details className="studio-security-access">
      <summary>운영 보안 설정</summary>
      <label className="field">
        <span>스튜디오 접근 키</span>
        <input
          autoComplete="off"
          onChange={(event) => {
            setAccessKey(event.target.value);
            saveSecurityAccessKey("studio", event.target.value);
          }}
          placeholder="운영 strict 모드에서만 필요"
          type="password"
          value={accessKey}
        />
      </label>
      <p>키는 현재 탭의 sessionStorage에만 보관됩니다.</p>
    </details>
  );
}
