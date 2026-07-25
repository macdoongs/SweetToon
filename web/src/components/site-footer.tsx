import Link from "next/link";
import { DiscoverLink } from "./discover-link";

const repositoryUrl = "https://github.com/macdoongs/SweetToon";

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <Link className="brand" href="/" aria-label="SweetToon 홈">
            <span className="brand__mark">S</span>
            <span className="brand__word">SweetToon</span>
          </Link>
          <p>
            좋아한 웹툰의 마지막 장면 다음을,
            <br />
            한 권의 소장본으로 이어갑니다.
          </p>
          <span className="site-footer__badge">Portfolio demo</span>
        </div>

        <nav className="site-footer__nav" aria-label="푸터 메뉴">
          <div>
            <strong>서비스</strong>
            <DiscoverLink>작품 둘러보기</DiscoverLink>
            <Link href="/orders">주문 현황</Link>
            <Link href="/studio">작가 스튜디오</Link>
          </div>
          <div>
            <strong>프로젝트</strong>
            <Link href="/operations/orders">제작 운영 데모</Link>
            <a href="/api-docs/">API 문서</a>
            <a href={`${repositoryUrl}#readme`}>서비스 소개</a>
            <a href={repositoryUrl} rel="noreferrer" target="_blank">
              GitHub 저장소 ↗
            </a>
            <a href="/feed.xml">새 회차 RSS</a>
          </div>
        </nav>
      </div>

      <div className="site-footer__legal">
        <div className="site-footer__notices" aria-label="데모 안내">
          <span>채용 과제용 데모</span>
          <span>실제 결제·배송 없음</span>
          <span>Mock Print API 사용</span>
          <span>AI 생성 데모 이미지 포함</span>
        </div>
        <p>
          SweetToon은 포트폴리오를 위해 만든 가상 서비스입니다. 표시된 작품,
          작가와 주문 정보는 모두 데모 데이터이며 개인정보 입력을 권장하지
          않습니다.
        </p>
        <small>© 2026 SweetToon. Built for the SweetBook assignment.</small>
      </div>
    </footer>
  );
}
