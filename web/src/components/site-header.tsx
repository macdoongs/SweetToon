import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="site-header__inner">
        <Link className="brand" href="/" aria-label="SweetToon 홈">
          <span className="brand__mark">S</span>
          <span className="brand__word">SweetToon</span>
        </Link>
        <nav className="site-nav" aria-label="주요 메뉴">
          <Link href="/#discover">작품 둘러보기</Link>
          <Link href="/orders">내 주문</Link>
          <Link href="/studio">작가 스튜디오</Link>
          <span className="site-nav__divider" aria-hidden="true" />
          <span className="site-nav__hint">읽고, 한 권으로 소장하세요</span>
        </nav>
      </div>
    </header>
  );
}
