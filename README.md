# SweetToon

읽던 웹툰을 세로 스크롤·양면 보기로 감상하고, 5화 단위 소장본으로
주문할 수 있는 웹툰 플랫폼입니다.

![SweetToon 홈](./docs/screenshots/home.png)

## 기획 배경과 사용자

웹툰 독자는 작품을 디지털로 읽지만, 좋아하는 완결 시즌은 책장에 둘 수 있는
물건으로 소장하고 싶어 합니다. 반대로 개인 창작자는 연재 원고를 다시 정리해
인쇄용 콘텐츠로 접수하는 과정이 번거롭습니다. SweetToon은 두 요구를
`읽기 → 소장본 주문`과 `ZIP 원고 → 회차 발행`이라는 짧은 흐름으로 연결합니다.

- **핵심 사용자 — 웹툰 독자:** 출퇴근·등하교나 휴식 시간에 모바일로 연재작을
  읽고, 집에서는 PC로 이어 보는 10~30대 독자입니다. 익숙한 웹툰 탐색과 읽기
  흐름 안에서 좋아하는 완결 시즌을 실물 소장본으로 남기고 싶어 합니다.
- **보조 사용자 — 개인 창작자:** 데스크톱에서 PNG/JPEG/WebP 원고가 든
  ZIP/CBZ를 올려 순서를 확인하고 에피소드로 발행하는 독립 작가입니다.
- **데모 역할 — 제작 운영자:** 주문을 허용된 다음 제작 단계로 이동시키고
  독자에게 보이는 타임라인을 확인합니다.

로그인 없는 공용 데모이므로 `/orders`와 `/operations/orders`는 개인 계정 화면이
아님을 UI에 명시하고 검색 색인에서도 제외했습니다. 실제 서비스에서는 인증과
역할별 접근 제어가 먼저 추가되어야 합니다.
로그인하지 않은 독자의 책갈피·읽기 진행도와 Mock 주문 해금 정보는 서버 계정
대신 현재 브라우저의 `localStorage`에만 저장합니다. 따라서 같은 브라우저에서는
다시 읽던 페이지로 돌아갈 수 있지만 다른 기기와 동기화되지는 않습니다.

## 핵심 사용자 흐름

1. 홈에서 상태·요일·장르와 찜·열람 기록 기반 추천으로 작품을 탐색합니다.
2. 작품 상세에서 최신화/첫 화 순서와 5화 단위 권을 고릅니다.
3. 무료 공개 범위는 세로 스크롤 또는 양면 보기로 감상하고 책갈피를 남깁니다.
4. 잠긴 회차는 캔디 1개로 해금하거나, 판형·표지·수량을 선택한 소장본 Mock
   주문으로 해당 5화 단위 권을 해금합니다.
5. 주문 후 한국 시간으로 표시되는 제작 타임라인을 확인합니다.
   운영자가 상태를 변경하면 새로고침 없이 실시간으로 반영됩니다.
6. 창작자는 ZIP/CBZ 원고를 올릴 때 목적을 고릅니다 — 바로 공개, 링크로만
   보이는 비공개 보관(검수 뒤 공개 전환), 또는 플랫폼 밖 원고를 실물 책으로
   접수하는 패키징 신청.
7. 창작자는 새 작품(시즌 1 포함)을 만들고, 발행한 회차의 제목 수정·원고
   교체·삭제와 시즌 완결 처리까지 스튜디오 한 화면에서 관리합니다.
8. 데모 운영자는 소장본 주문을 접수·제작·배송·완료 순서로, 패키징 신청을
   접수·검토·제작 완료 순서로만 허용된 상태 변경으로 진행합니다.

| 웹툰 감상 | 제작 상태 관리 |
| --- | --- |
| ![달빛 세탁소 대표 에피소드](./docs/screenshots/reader.png) | ![데모 운영자 주문 관리](./docs/screenshots/operations.png) |

## UI/UX 설계 기준

- 네이버 웹툰처럼 작품 탐색 밀도와 익숙한 세로 스크롤 읽기 방식을 참고하되,
  종이색·코럴 톤과 편집숍 같은 시각 언어로 `소장`이라는 제품 정체성을
  구분했습니다.
- 28개 작품을 상태·요일·장르 URL 필터로 나누고 12개씩 이어 불러와, 빈 섹션 없이
  탐색 밀도와 무한 스크롤 상태를 확인할 수 있게 했습니다.
- 찜과 최근 열람 기록이 있으면 가까운 작품을 우선하고, 기록이 없어도 주제별
  추천 레일을 제공합니다. 모든 추천 레일은 스크롤바 없이 끊김 없이 순환합니다.
- 필터 상태를 query string에 보존해 뒤로가기·공유·서버 렌더링이 일치합니다.
- 홈·작품·뷰어·주문·스튜디오마다 목적에 맞는 헤더와 breadcrumb를 제공합니다.
- 리더의 최근 1분 익명 presence를 집계해 현재 독자 수와 홈 실시간 인기 작품을
  표시합니다.
- 데모 모드에서는 가상 독자가 작품을 옮겨 읽고 데모 주문이 다음 단계로 진행되어,
  운영자 화면에서 새로고침 없이 실시간 변화를 확인할 수 있습니다.
- 일반 페이지의 푸터에는 서비스 탐색 링크와 함께 과제용 데모, Mock API,
  실제 결제·배송 없음 같은 운영 범위를 명확히 표시합니다.
- 로딩, 빈 데이터, 잘못된 ZIP, 중복 회차, 주문 실패와 동시 상태 변경을
  개발자 용어가 아닌 사용자 문장으로 구분합니다.
- 모바일 리더는 사용자가 모드를 직접 고르기 전까지 화면 방향을 따라갑니다 —
  세로는 이미지가 화면 폭을 채우는 스크롤, 가로는 화면을 가득 채우는 양면
  보기. 스크롤 감상 중에는 헤더를 숨기고 화면을 탭해야 다시 표시해, 콘텐츠
  몰입과 조작 접근을 분리했습니다. 열린 도구는 화면 어디를 탭해도 닫힙니다.
- 비공개 보관 회차는 목록·피드·검색·이전/다음 이동에서 제외되는 unlisted
  방식입니다. 회원 인증이 없는 과제 범위에서 "작가 본인의 검수용 미리보기"를
  가능하게 하는 절충으로, 링크(추측이 어려운 고유 ID)를 아는 사람은 열람할 수
  있음을 스튜디오와 리더 배지에 명시합니다. 비공개 회차의 번호는 유지되므로
  독자 목록에는 결번으로 보일 수 있습니다.
- 파괴적 작업은 인증 부재를 전제로 범위를 제한했습니다 — 회차 삭제는 2단계
  확인과 감사 로그를 거치고, 캔디로 열람권을 산 독자가 있는 회차는 독자
  자산을 지키기 위해 삭제 대신 비공개 전환을 안내합니다. 작품 삭제는
  시즌·주문 이력까지 연쇄되므로 의도적으로 제공하지 않습니다.
- 회차 번호와 제목은 등록 후에도 수정할 수 있어 비공개·삭제로 생긴 결번을
  정리할 수 있고, 작품 표지는 원고와 같은 래스터 검증을 거쳐 WebP로 교체되어
  새 작품도 탐색 목록에서 완성된 카드로 노출됩니다.
- 대표작 `달빛 세탁소` 첫 화는 8개의 일관된 AI 생성 컷으로 실제 감상 흐름을
  보여주고, 나머지 회차는 기능 검증용 플레이스홀더를 사용합니다.

각 공개 콘텐츠 페이지는 서버에서 초기 데이터를 렌더링합니다. 홈·작품·뷰어별
title, description, canonical, Open Graph/Twitter Card와 JSON-LD를 제공하고,
`robots.txt`, 동적 `sitemap.xml`, PNG 공유 이미지를 생성합니다. Web App
Manifest와 서비스 워커를 제공해 홈 화면 설치가 가능하며, 네트워크가 끊긴
탐색 요청은 전용 오프라인 안내 화면으로 전환합니다. 최신 회차는
`/feed.xml` RSS 2.0 피드로 구독할 수 있습니다.

운영 분석이 필요하면 `GOOGLE_ANALYTICS_ID=G-...`를 설정해 GA4 방문 분석과
Core Web Vitals 수집을 함께 켤 수 있습니다. 기본값은 비활성이라 로컬·과제
실행에서는 외부 분석 스크립트를 불러오지 않습니다. 측정 ID는 web 이미지에
포함되므로 값을 바꾼 뒤에는 web 이미지를 다시 빌드해야 하며, 실제 운영에서
활성화할 때는 배포 지역의 개인정보·동의 정책도 함께 적용해야 합니다.

`SITE_URL`은 canonical, Open Graph, `robots.txt`, sitemap과 RSS의 기준
주소입니다. `robots.txt`는 web 이미지 빌드 시 생성되므로 배포 주소를 바꾸면
`SITE_URL`과 `SITE_HOST`를 함께 갱신한 뒤 web 이미지를 다시 빌드해야 합니다.

## 완성한 레벨과 구현 범위

**Lv3까지 완성했습니다.** 각 레벨에서 구현한 범위는 다음과 같습니다.

- **Lv1 콘텐츠 서비스:** 상태·요일·장르 탐색, 무한 스크롤, 상세 정렬,
  세로/양면 뷰어, 이전·다음 화, 익명 책갈피와 읽기 진행도, ZIP/CBZ 검증·
  자연 정렬 미리보기·회차 발행·무료 정책 설정, 작품 생성·정보 수정과
  회차 제목 수정·원고 교체·비공개 보관·삭제까지의 창작자 회차 관리
- **Lv2 자체 주문 기능:** 작가별 무료 범위, 5화 단위 권, 판형·표지·수량 선택,
  캔디 Mock 충전·회차 해금, Mock 견적과 주문, PostgreSQL 원장·주문 보존,
  독자 주문 조회, 운영자의 `접수 → 제작 중 → 배송 중 → 완료` 상태 관리와
  실시간 타임라인
- **Lv3 사용자 경험:** 모바일·데스크톱 반응형 화면, 사용자 언어로 구분한
  로딩·빈 목록·404·입력 오류·재시도 상태, 키보드 독서, 라이트·다크 테마,
  읽기 중 헤더·푸터 숨김, 주문·발행 흐름의 다음 행동 안내
- **추가 구현:** SEO, 이미지 검증·WebP 파생,
  PWA 설치·오프라인 폴백, RSS, Swagger/OpenAPI, 선택형 R2 저장,
  Mock 계약, 찜·개인화 추천, 주문 SSE·실시간 독자 presence와 데모 봇,
  자동화된 Compose/E2E 검증
- **의도적 비대상:** 회원/권한, 실제 결제·배송사, 알림, 계정 기반 추천·댓글,
  Komga 연동, 실제 Book Print API 호출

## Book Print API 정책

과제 안내에 따라 `api.sweetbook.com`에는 직접 요청하지 않습니다. 애플리케이션은 외부 서비스 없이
독립적으로 실행되며, 인쇄 연동 경계는 서버의 `PrintProvider` 인터페이스로 분리했습니다.

- 기본값과 유일하게 허용되는 구현은 `MockPrintProvider`입니다.
- `PRINT_PROVIDER=mock` 이외의 값은 서버가 명시적으로 거부하는 fail-closed 방식입니다.
- Mock은 견적·주문·상태 확인 계약을 구현하므로 이후 실제 연동이 허용되더라도 도메인 로직과 UI를
  바꾸지 않고 어댑터만 교체할 수 있습니다.
- 완결 시즌은 판형·표지·수량 선택, Mock 견적, 주문 접수와 제작 타임라인까지 체험할 수 있습니다.
  주문은 PostgreSQL에 보존되며 실제 결제나 외부 요청을 만들지 않습니다.
- 실물 책으로 가는 길은 두 가지로 구분했습니다. **소장본 주문**은 플랫폼에
  연재된 완결 시즌을 대상으로 견적·주문·제작 타임라인을 제공하고, **패키징
  신청**은 플랫폼에 연재하지 않은 원고 묶음을 책 사양과 함께 접수하는 창작자
  전용 창구입니다. 패키징도 실제 인쇄 API를 호출하지 않으며 접수 기록과
  운영자 상태 관리(접수·검토·제작 완료·취소)까지가 데모 범위입니다.
- 공개 데모에서는 실명·개인정보 입력을 안내로 제한하고, 주문 조회 API 응답에서 주문자 닉네임과
  제작 메모를 제외합니다.

## 실행

Docker Desktop이 실행 중인 환경에서 다음 명령으로 전체 애플리케이션을 시작합니다.

```bash
docker compose up --build
```

- 웹: http://localhost:3000
- API 생존 확인: http://localhost:4000/health/live
- API 준비 상태(DB·Redis): http://localhost:4000/health/ready
- Web 상태 확인: http://localhost:3000/health
- Swagger UI: http://localhost:4000/api-docs
- OpenAPI JSON: http://localhost:4000/openapi.json
- PostgreSQL: localhost:5432

기본값만으로 `.env` 없이 실행됩니다. 포트가 이미 사용 중이면
`.env.example`을 `.env`로 복사하고 `WEB_PORT`, `SERVER_PORT`, `DB_PORT`를 변경합니다.
첫 실행에서는 PostgreSQL과 내부 전용 Redis가 준비된 뒤 Prisma 마이그레이션과
데모 데이터 생성이 자동으로 수행됩니다. Redis는 호스트 포트를 열지 않으며 업로드
제한 횟수만 공유합니다. 이후 재시작에서는 기존 콘텐츠와 주문 데이터를 보존합니다.
Compose는 DB·Redis 준비, migration 완료, API 준비, Web 준비 순서로 기동하며,
프로덕션 오버레이는 장기 실행 서비스에 `restart: unless-stopped`를 적용합니다.

기본 파일 저장소 대신 로컬 S3 호환 경계를 검증하려면 MinIO 오버레이를 함께
실행합니다. API `9000`, 관리 콘솔 `9001`을 사용하며 별도 자격증명 없이 데모용
버킷을 자동 생성합니다.

```bash
docker compose -f docker-compose.yml -f docker-compose.minio.yml up --build
```

ClamAV 악성코드 검사까지 로컬에서 검증하려면 별도 오버레이를 사용합니다. 바이러스
정의 DB를 처음 준비할 때 시간이 더 걸리며, 검사기가 준비되지 않으면 업로드는
`503`으로 거부됩니다.

```bash
docker compose -f docker-compose.yml -f docker-compose.clamav.yml up --build
```

바로 확인할 수 있는 경로:

- `/` — 독자 작품 탐색
- `/series/moonlight-laundry` — 대표 작품과 첫 화
- `/orders` — 공용 데모 주문 현황
- `/studio` — 창작자 ZIP/CBZ 업로드
- `/operations/orders` — 공용 데모 제작 상태 관리

## 구조

```text
web/      Next.js 16 + React 19 (독립 컨테이너 이미지)
server/   Express 5 + Prisma 6 + Mock PrintProvider (독립 컨테이너 이미지)
db        PostgreSQL 16
assets    로컬 파일 기본값, 선택적으로 MinIO/Cloudflare R2
```

웹, API, DB는 별도 컨테이너로 실행되지만 하나의 모노레포와 Docker Compose 실행 계약으로 관리합니다.
Next.js Route Handler 대신 독립 Express API를 둔 이유는 웹 외 클라이언트와 B2B API 확장을 고려한
API-first 경계를 보여주고, 이미지·압축 파일 처리와 웹 렌더링의 책임을 분리하기 위해서입니다.

PostgreSQL은 주문·상태 이벤트와 업로드 발행처럼 동시 쓰기가 있는 운영 전환을
고려해 선택했습니다. 의존성 주입은 프레임워크 없이 조립 지점에서 명시적으로
수행하고, `ReaderRepository`, `OrderRepository`, `PrintProvider` 인터페이스만
교체할 수 있게 두었습니다. 현재 트래픽 규모에서 별도 DI 컨테이너나 범용 factory,
애플리케이션 수준 connection pool 추상화는 복잡도만 늘리므로 Prisma의 pool과
작은 provider factory만 사용합니다.

작가 원고는 `StudioStorage` 경계 뒤에 있습니다. 기본 `filesystem` 구현은
클린 클론 실행성을 보장하고, `ASSET_STORAGE_PROVIDER=r2`는 Cloudflare R2의
S3 API로 확정 발행된 원본과 리더용 WebP를 올립니다. 원본은 비공개 전용
`R2_PRIVATE_BUCKET`, 리더용 파생본만 공개 `R2_BUCKET`에 분리합니다. ZIP 미리보기는 두 모드
모두 1시간짜리 로컬 staging에만 두며, R2 access key·secret·bucket은 Jenkins
credential이나 배포 환경변수로만 주입합니다. MinIO 오버레이도 같은 어댑터를
사용하므로 로컬에서 R2 경계를 재현할 수 있습니다.

업로드 경계는 25MB 요청 크기와 15분당 10회 제한을 먼저 적용합니다. 압축 내부는
경로 탈출, 항목·이미지 수, 선언·실제 해제 크기, 래스터 시그니처, 픽셀 수와
애니메이션 여부를 검증합니다. API에는 Helmet 보안 헤더를 적용하고 CORS는
`CORS_ALLOWED_ORIGINS`에 명시한 origin만 허용합니다. 외부 전송 암호화는
Cloudflare/Traefik의 HTTPS 경계가 담당하며 애플리케이션 컨테이너 포트는 운영에서
호스트에 직접 공개하지 않습니다. 운영 Traefik도 약 26MiB를 넘는 요청은 Next.js와
API로 전달하기 전에 거부합니다.

기본 `API_SECURITY_MODE=demo`는 심사자가 로그인 없이 전체 흐름을 확인하기 위한
과제 모드입니다. 운영에서는 `strict`로 바꾸고 `STUDIO_API_KEY`,
`OPERATIONS_API_KEY`, 32자 이상의 `AUDIT_HASH_SECRET`을 secret으로 주입합니다.
demo에서 감사 해시 secret을 비워 두면 서버가 기동할 때 임의 값을 생성하며,
strict에서는 빈 값이나 32자 미만의 값을 허용하지 않습니다.
이 경우 스튜디오 변경 요청과 주문 상태 변경은 각각 전용 헤더 없이는 `401`로
거부됩니다. 업로드와 상태 변경 결과는 원문 IP 대신 HMAC 해시와 최소 사용자
에이전트만 PostgreSQL 감사 로그에 기록합니다.

업로드 제한 횟수는 Redis에 저장해 여러 API replica가 같은 제한을 공유합니다.
주문 상태 변경은 PostgreSQL에 먼저 확정한 뒤 Redis Pub/Sub으로 SSE 구독자에게
전달합니다. 작품별 현재 독자 수는 브라우저 익명 UUID의 heartbeat를 Redis Sorted
Set에 60초 동안만 보존하며, DB 주문 전이나 Redis 장애가 주문 상태 전이를
되돌리지는 않습니다.
`REALTIME_BOT_ENABLED=true`인 demo 보안 모드에서는 Redis lease를 획득한 서버
한 대만 가상 독자 heartbeat와 `isDemo` 주문을 생성·전이합니다. 봇 주문은 실제
주문과 명시적으로 구분되며 최근 완료 주문 5개만 유지됩니다. strict 보안 모드에서는
설정값과 관계없이 봇이 실행되지 않습니다.
선택적 ClamAV 모드는 ZIP/CBZ를 staging에 쓰기 전에 INSTREAM으로 검사하며, 감염
판정이나 검사기 장애 모두 fail-closed로 처리합니다. ClamAV를 끈 기본 과제
모드에서도 래스터 디코딩·재인코딩과 압축 안전 검증은 항상 수행됩니다.

리더는 웹툰 세로 스크롤과 양면 보기를 제공하며, 양면 보기에서는 좌→우·우→좌
읽기 방향, 화면 맞춤, 배경, 썸네일 탐색과 키보드 이동을 지원합니다. 다음 화로
이동할 때는 스크롤 위치를 애니메이션 없이 즉시 맨 위로 초기화해 다음 화의 결말이
먼저 노출되지 않도록 합니다.

## 개발 규약과 검증 하네스

- [`AGENTS.md`](./AGENTS.md) — 사람·Codex·Claude가 공유하는 아키텍처와 안전 규약
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — 남은 사용자 흐름과 비대상 범위
- [`docs/REVIEW_CHECKLIST.md`](./docs/REVIEW_CHECKLIST.md) — 과제 기준과 PR 리뷰 체크리스트
- `scripts/verify-web.ps1` — 의존성, audit, lint, Vitest 단위 테스트, Next.js production build
- `scripts/verify-server.ps1` — 의존성, audit, Prisma 검증, TypeScript build, Jest
- `scripts/smoke-compose.ps1` — 격리된 Compose 전체 기동과 Mock/API/SSR 스모크 검증
- `scripts/verify-e2e.ps1` — 격리된 Compose 환경에서 Chromium 사용자 흐름 검증
- `scripts/backup-database.sh` — 운영자가 지정한 보안 경로에 배포 전 DB 덤프 생성
- [`docs/DEPLOYMENT_RUNBOOK.md`](./docs/DEPLOYMENT_RUNBOOK.md) — 백업·복구·롤백 판단 절차

로컬 PowerShell 7 또는 Jenkins의 Windows PowerShell에서 전체 검증을 순서대로 실행합니다.

```powershell
pwsh -File scripts/verify-web.ps1
pwsh -File scripts/verify-server.ps1
pwsh -File scripts/smoke-compose.ps1
pwsh -File scripts/verify-e2e.ps1
```

Compose 스모크 스크립트는 `sweettoon-verify-*` 이름의 독립 project와 임의 호스트
포트를 사용하며 성공·실패 여부와 관계없이 자신이 만든 컨테이너와 볼륨을 정리합니다.
브라우저 E2E도 같은 방식으로 독립 DB와 업로드 볼륨을 만들고 URL 기반 작품 탐색,
PWA·RSS, 독자 감상, 소장본 주문, 모바일 작가 스튜디오 흐름을 검증합니다. 실패하면
Playwright trace, 스크린샷, 비디오와 HTML 리포트를 남깁니다. Jenkins도 같은
스크립트를 호출하므로 로컬 검증과 CI 계약이 분리되지 않습니다.

프론트엔드 E2E는 MSW나 `route.fulfill()`로 임시 HTTP 응답을 만들지 않고,
Compose에서 실제 Express API와 PostgreSQL 시드 데이터를 호출합니다. 외부 인쇄
서비스만 `PrintProvider` 경계의 Mock으로 대체하며, 서버 HTTP 테스트에서는
repository와 use case를 fake 구현으로 주입해 DB 없이 오류 계약을 검증합니다.

## API 문서

전체 엔드포인트와 요청·응답 계약은 실행 중인 앱의 `/api-docs/` Swagger UI에서
확인할 수 있습니다. 기계가 읽을 수 있는 OpenAPI 3.1 JSON은 `/openapi.json`에
제공합니다.

요청 파라미터와 응답은 Zod 계약으로 검증합니다. 조회 라우트는 저장소 인터페이스에,
상태 규칙이 있는 주문 라우트는 service(use case)에 의존해 HTTP 테스트에서 DB 없이
경계 조건을 검증합니다.

## AI 도구 사용 내역과 데모 데이터

| AI 도구 | 활용 방법 | 판단과 검증 |
| --- | --- | --- |
| OpenAI Codex | 서비스 구조·API 경계 설계, 구현, 테스트 작성, 코드 리뷰와 CI 분석 | 제안된 변경을 실제 diff로 검토하고 lint·단위 테스트·클린 Compose·Playwright를 통과한 경우에만 반영 |
| Codex ImageGen | 오리지널 웹툰 표지와 `달빛 세탁소` 대표 회차의 일관된 이미지 제작 | 생성 결과를 직접 선별하고 화면 비율·가독성·작품 간 시각적 구분을 브라우저에서 확인 |

AI가 한 번에 만든 구현을 그대로 제출하지 않았습니다. 예를 들어 테마를 추가한
뒤 선택된 버튼의 배경과 글자 명도가 겹쳤고, 소장 가능한 권마다 주문 버튼을
반복해 작품이 길어질수록 화면이 과도하게 늘어났습니다. 실제 다크 모드 화면과
Playwright 실패를 기준으로 색상 토큰을 분리하고, 권 선택 목록과 단일 주문
버튼으로 다시 설계했습니다. 의존성·네트워크·배포 상태처럼 AI가 추측하기 쉬운
부분도 클린 클론 Docker와 공개 URL에서 별도로 확인했습니다.

표지 4장과 `달빛 세탁소` 대표 1화 8컷은 이 과제를 위해 생성한 오리지널 데모
이미지입니다. 상업 만화나 개인 Komga 라이브러리의 이미지는 포함하지 않습니다.
출처와 가공 방식은
[`server/prisma/assets/covers/README.md`](./server/prisma/assets/covers/README.md)와
[`server/prisma/assets/episodes/README.md`](./server/prisma/assets/episodes/README.md)에
기록했습니다.

## 현재 한계

- 회원 인증은 과제 범위 밖이어서 주문 화면은 공용 데모입니다. 운영용 API key
  경계는 구현했지만 사용자 계정이나 작가별 작품 소유권 모델을 대신하지 않습니다.
  주문 API 응답은 주문자 닉네임과 메모를 제외합니다.
- 익명 진행도와 Mock 해금은 현재 브라우저에만 남습니다. 운영 서비스에서는 계정
  동기화, 결제 검증과 짧은 수명의 서명 URL을 사용해야 하며, 공개 R2 파생본 URL은
  과제 데모용 난수 경로 경계입니다.
- Redis 공유 속도 제한과 선택적 ClamAV 사전 검사는 구현되어 있습니다. 대용량
  상용 운영에서는 동기 검사 대신 별도 격리 버킷과 비동기 검사 작업 큐가 필요합니다.
- Mock 인쇄 주문은 로컬 PostgreSQL 상태의 출발점만 제공합니다. 결제·배송 조회와
  외부 인쇄사 동기화는 구현하지 않았습니다.
- 대표 1화를 제외한 콘텐츠는 기능 확인용 플레이스홀더입니다.
- 현재 독자 수는 최근 60초 heartbeat 기반의 근사치이며 장기 조회수나 개인화
  추천 점수로 사용하지 않습니다.
- CSV 내보내기와 창작자용 시즌 일괄 가져오기는 핵심 사용자 흐름을 흐리지 않기
  위해 제외했습니다.

## 사업 가능성과 다음 단계

웹툰 감상에서 끝나지 않고 완결 시즌의 주문 전환까지 한 서비스 안에서 연결하면,
독자는 좋아하는 작품을 소장하고 독립 작가는 재고를 먼저 만들지 않고도 수요를
확인할 수 있습니다. 향후에는 캔디와 소장본 주문 수익을 작가와 배분하고,
주문량이 확인된 권만 주문형 인쇄로 제작하는 창작자 중심 플랫폼으로 확장할 수
있습니다.

시간이 더 주어진다면 먼저 회원 계정과 기기 간 읽기·구매 동기화, 작가별 작품
소유권과 운영자 권한, 결제 검증과 짧은 수명의 이미지 URL을 구현하겠습니다.
그다음 현재 `PrintProvider` 경계에 실제 인쇄사 샌드박스 어댑터를 추가하고,
접근성 사용자 테스트와 주문 취소·환불 흐름을 검증하겠습니다. 실제 인쇄 API는
과제 조건에 따라 현재 버전에서는 의도적으로 연결하지 않았습니다.

## CI

루트 `Jenkinsfile`은 다음 검증을 수행합니다.

1. 웹 의존성 설치, lint, Vitest 단위 테스트, production build
2. 서버 의존성 설치, Prisma schema 검증, TypeScript build, API·Mock provider 테스트
3. 격리된 Docker Compose 프로젝트에서 migration 재실행, DB-schema drift와 전체 서비스 health check
4. Chromium에서 작품 탐색·독자·주문·스튜디오 핵심 흐름 E2E

CD는 CI가 검증한 동일 Git SHA만 개발 서버에 전달합니다.

## 개발 브랜치와 배포

- 기능 작업: `dev`에서 분기한 별도 branch/worktree
- 통합: 검증된 PR을 `dev`에 병합
- 개발 배포: `Jenkinsfile.deploy`이 `.48` Linux 노드에서 `docker-compose.prod.yml`을 적용
- 제출 후보: 검증된 `dev`를 `main`으로 승격

개발 배포는 기존 `traefik-net`에 연결되며 `sweettoon.katsuranbo.com` Host 규칙으로만 노출됩니다.
운영 DB 값은 Jenkins secret-file credential `sweettoon-prod-env`로 주입하고 저장소에는 커밋하지 않습니다.
CI 검증이 모두 성공하면 검증한 Git SHA를 `SweetToon-Deploy-Dev`에 전달합니다.
배포 작업은 체크아웃한 SHA가 전달받은 SHA와 다르면 중단하여, 검증되지 않은 최신
커밋이 우연히 배포되는 것을 방지합니다.
