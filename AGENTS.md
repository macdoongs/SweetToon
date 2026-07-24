# SweetToon 개발 규약

이 문서는 저장소 전체에서 Codex, Claude와 사람이 공유하는 개발 계약의
단일 진실 공급원(SSOT)이다. 하위 디렉터리의 `AGENTS.md`는 해당 영역의
추가 규칙만 정의하며 이 문서와 충돌해서는 안 된다.

## 서비스와 사용자

SweetToon은 독자가 웹툰을 감상하고 완결 시즌을 실물 소장본으로 주문하며,
창작자가 작품을 연재하고 독립 출판하는 과제용 콘텐츠 서비스다. 기능 수보다
독자와 창작자의 실제 흐름, 명확한 오류·빈 상태, 한 번에 실행되는 데모를
우선한다.

## 현재 구조

- `web/`: Next.js 16 App Router + React 19 + TypeScript
- `server/`: Express 5 + Prisma 6 + TypeScript
- `db`: PostgreSQL 16
- 실행 계약: 루트 `docker compose up --build`
- 개발 통합: 기능 worktree/branch → GitHub PR → `dev` → Jenkins 검증·배포

웹 작업 전에는 학습 데이터의 기억에 의존하지 말고
`web/node_modules/next/dist/docs/`의 관련 Next.js 16 문서를 읽는다.

## 아키텍처 경계

- 기본 의존성 방향은 `route → service(use case) → repository/provider
  interface → Prisma/Mock adapter`다.
- 단순 조회 route는 repository를 직접 호출할 수 있다. 주문, 업로드처럼
  규칙과 상태 전이가 생기면 service 계층을 둔다.
- DI 컨테이너보다 `createApp({ ...dependencies })` 같은 명시적 함수·생성자
  주입을 우선한다.
- Factory는 PrintProvider, 저장소, 스토리지처럼 런타임 구현 선택이 필요한
  경계에서만 사용한다.
- PostgreSQL 연결 수명은 프로세스당 단일 `PrismaClient`에 맡긴다. 파일·이미지
  처리의 동시성은 객체 풀이 아니라 작업 큐나 concurrency limiter로 제한한다.

## API와 데이터 계약

- 외부 입력과 API 응답은 Zod 계약으로 검증한다.
- 사용자에게 노출되는 API 오류는 안정적인 `code`와 사용자가 이해할 수 있는
  한국어 `message`를 함께 제공한다.
- route에서 Prisma 모델을 그대로 노출하지 않고 repository가 응답 모델로
  변환한다.
- URL path segment를 클라이언트에서 조립할 때는 `encodeURIComponent`를 쓴다.
- 로딩, 빈 데이터, 404, 재시도 가능한 오류를 서로 구분한다.

## Book Print API 제약

- 과제 환경에서는 `api.sweetbook.com`을 포함한 실제 인쇄 API를 호출하지 않는다.
- 인쇄 기능은 `PrintProvider` 포트를 통해서만 접근하고, 허용 구현은
  `MockPrintProvider`뿐이다.
- `PRINT_PROVIDER=mock` 이외의 설정은 fail-closed로 기동을 거부한다.
- Lv2 주문은 PostgreSQL의 `Order`를 로컬 진실 공급원으로 사용한다. provider는
  인쇄사 측 견적·접수·상태를 모사하며 영속 주문을 대신하지 않는다.

## Next.js와 SEO

- 검색 대상 페이지는 실제 콘텐츠가 초기 HTML에 포함되도록 서버 렌더링한다.
- 동적 페이지는 고유 title, description, canonical과 적절한 구조화 데이터를
  제공한다.
- Client Component의 상태 보존·초기화 동작은 추측으로 규칙화하지 않는다.
  동적 내비게이션 버그는 실제 브라우저에서 URL과 화면 데이터를 함께 검증한다.
- JSON-LD 문자열은 `<`를 `\u003c`로 치환해 주입 위험을 줄인다.

## 데이터베이스와 시드

- 스키마 변경은 Prisma migration으로 기록한다.
- 기존 데이터를 삭제하지 않는 백필과 호환 가능한 기본값을 우선한다.
- 시드는 멱등이어야 하며 재기동 시 사용자·주문 데이터를 삭제하지 않는다.
- 제출 전 빈 볼륨과 기존 볼륨 양쪽에서 `migrate deploy`를 검증한다.

## 파일 업로드 수용 기준

ZIP/CBZ 업로드를 구현할 때 다음을 필수 조건으로 적용한다.

- path traversal/zip-slip 차단
- 압축 파일 크기, 항목 수, 압축 해제 총용량 제한
- PNG, JPEG, WebP 같은 래스터 이미지만 허용하고 SVG는 거부
- MIME signature와 확장자 교차 검증
- 파일명 natural sort 후 순서 미리보기 제공
- 부분 실패 시 DB와 파일을 함께 정리하거나 재시도 가능한 상태로 보존

## 환경과 공개 저장소

- 포트, 호스트, provider 선택은 환경변수화하고 `.env.example`에 문서화한다.
- 비밀번호, 토큰, Jenkins credential 값, 개인 경로를 커밋하지 않는다.
- 사설 배포 주소는 코드에 직접 넣지 않고 Jenkins credential 또는 환경변수로
  주입한다.
- 공개 CI/CD 예시는 유지할 수 있지만 클론만으로 특정 개인 인프라를 요구해서는
  안 된다.

## 작업과 검증

- 사용자의 기존 변경과 다른 worktree의 작업을 보존한다.
- 기능은 `dev`에서 새 `agent/<description>` branch/worktree로 분리한다.
- 검증된 PR만 `dev`에 병합하고 GitHub와 Gitea의 `dev` 커밋을 맞춘다.
- 리뷰 요청은 읽기 전용으로 처리하고, 수정 요청이 있을 때만 코드를 변경한다.

변경 범위에 맞춰 다음 스크립트를 실행한다.

```powershell
pwsh -File scripts/verify-web.ps1
pwsh -File scripts/verify-server.ps1
pwsh -File scripts/smoke-compose.ps1
```

제출 후보는 세 검증을 모두 통과해야 한다. Compose 스모크 테스트는 항상 고유한
project name을 사용하고 `finally`에서 해당 project의 컨테이너와 볼륨만 정리한다.
