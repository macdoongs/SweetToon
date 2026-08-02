<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## UI 일관성 계약

- 일반 페이지의 주요 섹션은 `--content` 폭과 좌우 `auto` 여백을 공유한다.
  리더, 히어로처럼 의도된 full-bleed 영역만 예외로 둔다.
- 관리·찜·검색 결과처럼 항목을 비교하거나 조작하는 화면은 세로 목록 또는
  반응형 그리드를 기본으로 한다. 가로 레일은 탐색·추천 콘텐츠에만 사용한다.
- 의미 색상은 `--surface`, `--feature-*`, `--*-ink` 토큰을 사용하고 라이트와
  다크 테마에서 함께 확인한다. 배경을 바꾸면서 고정 `white`나 `--ink`를
  전경색으로 짝지어 대비를 추측하지 않는다.
- 데이터에 회차 번호나 순번이 이미 표시되면 `ol`의 기본 marker처럼 브라우저가
  생성하는 번호와 중복되지 않는지 확인한다.
- `sticky`·`fixed` 도구는 스크롤 중 숨김, 포인터로 선택한 뒤의 포커스,
  키보드 `:focus-visible`, 모바일 화면을 각각 검증한다.
- UI 변경은 최소한 데스크톱·모바일·다크 테마를 확인하고, 재발 가능성이 있는
  동작은 Playwright의 실제 레이아웃 또는 브라우저 동작을 oracle로 남긴다.
