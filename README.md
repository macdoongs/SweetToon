# SweetToon

읽던 웹툰의 완결 시즌을 실물 단행본으로 소장할 수 있는 웹툰 플랫폼입니다.

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
server/   Express 5 + Prisma 6
db        PostgreSQL 16
```

웹, API, DB는 별도 컨테이너로 실행되지만 하나의 모노레포와 Docker Compose 실행 계약으로 관리합니다.

## CI

루트 `Jenkinsfile`은 다음 검증을 수행합니다.

1. 웹 의존성 설치, lint, production build
2. 서버 의존성 설치, Prisma schema 검증, TypeScript build, 테스트
3. 격리된 Docker Compose 프로젝트에서 전체 서비스 기동 및 health check

CD는 핵심 사용자 플로우와 배포 대상 환경이 준비된 후 `main`의 검증된 이미지에 연결합니다.

## 개발 브랜치와 배포

- 기능 작업: `dev`에서 분기한 별도 branch/worktree
- 통합: 검증된 PR을 `dev`에 병합
- 개발 배포: `Jenkinsfile.deploy`이 `.48` Linux 노드에서 `docker-compose.prod.yml`을 적용
- 제출 후보: 검증된 `dev`를 `main`으로 승격

개발 배포는 기존 `traefik-net`에 연결되며 `sweettoon.katsuranbo.com` Host 규칙으로만 노출됩니다.
운영 DB 값은 Jenkins secret-file credential `sweettoon-prod-env`로 주입하고 저장소에는 커밋하지 않습니다.
