"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type MouseEvent } from "react";
import { getJson } from "@/lib/api";
import {
  CANDY_UPDATED_EVENT,
  getCandyWalletToken,
  type CandyWallet,
} from "@/lib/candy-wallet";
import { ThemePicker } from "./theme-picker";
import { DiscoverLink } from "./discover-link";

function closeMoreMenu(event: MouseEvent<HTMLAnchorElement>) {
  event.currentTarget.closest("details")?.removeAttribute("open");
}

export function SiteHeader() {
  const [balance, setBalance] = useState<number | null>(null);
  const refreshCandy = useCallback(() => {
    const token = getCandyWalletToken();
    void getJson<CandyWallet>(
      `/api/candy-wallets/${encodeURIComponent(token)}`,
    )
      .then((wallet) => setBalance(wallet.balance))
      .catch(() => setBalance(null));
  }, []);

  useEffect(() => {
    refreshCandy();
    window.addEventListener(CANDY_UPDATED_EVENT, refreshCandy);
    return () => window.removeEventListener(CANDY_UPDATED_EVENT, refreshCandy);
  }, [refreshCandy]);

  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="SweetToon 홈">
          <span className="brand__mark">S</span>
          <span className="brand__word">SweetToon</span>
        </Link>
        <nav className="site-nav" aria-label="주요 메뉴">
          <DiscoverLink>
            작품<span className="site-nav__label-tail"> 둘러보기</span>
          </DiscoverLink>
          <Link href="/shorts">쇼츠</Link>
          <Link href="/orders">
            주문<span className="site-nav__label-tail"> 현황</span>
          </Link>
          <Link className="site-nav__secondary" href="/studio">
            작가 스튜디오
          </Link>
          <Link className="site-nav__secondary" href="/favorites">
            찜 목록
          </Link>
          <Link
            className="site-nav__candy"
            href="/candy"
            title="캔디 1개로 유료 회차 1편을 볼 수 있어요"
          >
            <span aria-hidden="true">🍬</span>
            캔디 {balance ?? "—"}
          </Link>
          <ThemePicker />
          <details className="site-nav__more">
            <summary aria-label="전체 메뉴">
              <span aria-hidden="true">☰</span>
            </summary>
            <div className="site-nav__more-panel">
              <Link href="/shorts" onClick={closeMoreMenu}>
                웹툰 쇼츠
              </Link>
              <Link href="/studio" onClick={closeMoreMenu}>
                작가 스튜디오
              </Link>
              <Link href="/favorites" onClick={closeMoreMenu}>
                찜 목록
              </Link>
              <Link href="/candy" onClick={closeMoreMenu}>
                캔디 충전소
              </Link>
            </div>
          </details>
          <span className="site-nav__divider" aria-hidden="true" />
          <span className="site-nav__hint">읽고, 한 권으로 소장하세요</span>
        </nav>
      </div>
    </header>
  );
}
