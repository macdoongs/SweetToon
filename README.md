# SweetToon

읽던 웹툰을 세로 스크롤로 감상하고, 완결 시즌을 실물 단행본으로 소장할 수 있는 웹툰 플랫폼입니다.

## 누구를 위한 서비스인가

- **독자**는 작품을 발견하고 에피소드를 감상한 뒤, 좋아하는 완결 시즌을 소장본으로 주문합니다.
- **창작자**는 웹툰 원고 묶음을 업로드해 연재하고 자기 작품을 독립 출판합니다.

현재 구현된 첫 번째 사용자 흐름은 **홈에서 작품 발견 → 작품·회차 선택 → 세로 스크롤 감상**입니다.
로그인 없이 데모 데이터를 바로 탐색할 수 있고, 로딩·빈 데이터·오류 상태를 각 화면에서 처리합니다.

각 페이지는 검색 엔진과 공유 미리보기가 콘텐츠를 이해할 수 있도록 서버에서 초기 데이터를 렌더링합니다.
홈·작품·뷰어별 title, description, canonical, Open Graph/Twitter Card와 JSON-LD를 제공하며,
`robots.txt`, 동적 `sitemap.xml`, PNG 공유 이미지를 함께 생성합니다. 화면 헤더도 홈 소개,
작품 breadcrumb·작품 정보, 뷰어 회차·진행률처럼 페이지 목적에 맞게 구분했습니다.

## Book Print API 정책

과제 안내에 따라 `api.sweetbook.com`에는 직접 요청하지 않습니다. 애플리케이션은 외부 서비스 없이
독립적으로 실행되며, 인쇄 연동 경계는 서버의 `PrintProvider` 인터페이스로 분리했습니다.

- 기본값과 유일하게 허용되는 구현은 `MockPrintProvider`입니다.
- `PRINT_PROVIDER=mock` 이외의 값은 서버가 명시적으로 거부하는 fail-closed 방식입니다.
- Mock은 견적·주문·상태 확인 계약을 구현하므로 이후 실제 연동이 허용되더라도 도메인 로직과 UI를
  바꾸지 않고 어댑터만 교체할 수 있습니다.
- 완결 시즌은 판형·표지·수량 선택, Mock 견적, 주문 접수와 제작 타임라인까지 체험할 수 있습니다.
  주문은 PostgreSQL에 보존되며 실제 결제나 외부 요청을 만들지 않습니다.
- 공개 데모에서는 실명·개인정보 입력을 안내로 제한하고, 주문 조회 API 응답에서 주문자 닉네임과
  제작 메모를 제외합니다.

## 실행

Docker Desktop이 실행 중인 환경에서 다음 명령으로 전체 애플리케이션을 시작합니다.

```bash
cp .env.example .env
docker compose up --build
```

- 웹: http://localhost:3000
- API 상태 확인: http://localhost:4000/health
- PostgreSQL: localhost:5432

포트가 이미 사용 중이면 `.env`의 `WEB_PORT`, `SERVER_PORT`, `DB_PORT`를 변경합니다.
첫 실행에서는 Prisma 마이그레이션과 데모 데이터 생성이 자동으로 수행됩니다. 이후 재시작에서는 기존 데이터를 보존합니다.

## 구조

```text
web/      Next.js 16 + React 19
server/   Express 5 + Prisma 6 + Mock PrintProvider
db        PostgreSQL 16
```

웹, API, DB는 별도 컨테이너로 실행되지만 하나의 모노레포와 Docker Compose 실행 계약으로 관리합니다.
Next.js Route Handler 대신 독립 Express API를 둔 이유는 웹 외 클라이언트와 B2B API 확장을 고려한
API-first 경계를 보여주고, 이미지·압축 파일 처리와 웹 렌더링의 책임을 분리하기 위해서입니다.

## 개발 규약과 검증 하네스

- [`AGENTS.md`](./AGENTS.md) — 사람·Codex·Claude가 공유하는 아키텍처와 안전 규약
- [`docs/ROADMAP.md`](./docs/ROADMAP.md) — 남은 사용자 흐름과 비대상 범위
- [`docs/REVIEW_CHECKLIST.md`](./docs/REVIEW_CHECKLIST.md) — 과제 기준과 PR 리뷰 체크리스트
- `scripts/verify-web.ps1` — 의존성, audit, lint, Next.js production build
- `scripts/verify-server.ps1` — 의존성, audit, Prisma 검증, TypeScript build, Jest
- `scripts/smoke-compose.ps1` — 격리된 Compose 전체 기동과 Mock/API/SSR 스모크 검증

로컬 PowerShell 7 또는 Jenkins의 Windows PowerShell에서 전체 검증을 순서대로 실행합니다.

```powershell
pwsh -File scripts/verify-web.ps1
pwsh -File scripts/verify-server.ps1
pwsh -File scripts/smoke-compose.ps1
```

Compose 스모크 스크립트는 `sweettoon-verify-*` 이름의 독립 project와 임의 호스트
포트를 사용하며 성공·실패 여부와 관계없이 자신이 만든 컨테이너와 볼륨을 정리합니다.
Jenkins도 같은 스크립트를 호출하므로 로컬 검증과 CI 계약이 분리되지 않습니다.

## 구현된 API

- `GET /api/series` — 작품 목록
- `GET /api/series/:slug` — 작품, 시즌, 에피소드 상세
- `GET /api/episodes/:id` — 에피소드 컷과 이전·다음 회차
- `POST /api/print-quotes` — 완결 시즌 페이지 수 기반 Mock 견적
- `POST /api/orders` — 멱등 요청 키를 사용한 소장본 주문 접수
- `GET /api/orders` — 데모 사용자의 주문 목록
- `GET /api/orders/:id` — 주문 사양과 상태 변경 타임라인
- `POST /api/studio/uploads` — ZIP/CBZ 검증과 자연 정렬 미리보기
- `GET /api/studio/uploads/:sessionId/pages/:pageId` — 만료되는 원고 미리보기
- `POST /api/studio/episodes` — 확인한 페이지 순서로 에피소드 등록
- `DELETE /api/studio/uploads/:sessionId` — 임시 업로드 취소·정리
- `GET /api/images/*` — 데모 및 업로드 이미지

요청 파라미터와 응답은 Zod 계약으로 검증합니다. 조회 라우트는 저장소 인터페이스에,
상태 규칙이 있는 주문 라우트는 service(use case)에 의존해 HTTP 테스트에서 DB 없이
경계 조건을 검증합니다.

## CI

루트 `Jenkinsfile`은 다음 검증을 수행합니다.

1. 웹 의존성 설치, lint, production build
2. 서버 의존성 설치, Prisma schema 검증, TypeScript build, API·Mock provider 테스트
3. 격리된 Docker Compose 프로젝트에서 전체 서비스 기동 및 health check

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
