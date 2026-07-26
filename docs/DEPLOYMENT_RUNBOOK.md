# SweetToon 배포·복구 Runbook

이 문서는 개발 서버 배포 전에 데이터베이스를 보존하고, 검증 실패 시 복구 여부를
판단하는 운영 절차다. 저장소에는 운영 데이터 덤프를 커밋하거나 Jenkins 일반
artifact로 업로드하지 않는다.

## 배포 전 확인

1. CI가 전달한 `EXPECTED_COMMIT`과 배포 checkout의 SHA가 같은지 확인한다.
2. 백업을 저장할 암호화된 호스트 경로와 보존 기간을 확인한다.
3. 현재 배포 SHA와 `docker compose images` 결과를 변경 기록에 남긴다.
4. 현재 migration이 기존 컬럼 삭제·타입 축소 없이 이전 앱과 호환되는지 확인한다.

## 데이터베이스 백업

Linux 배포 노드에서 다음처럼 실행한다. 출력 경로는 Jenkins workspace 밖의
접근 제한된 저장소를 사용한다.

```sh
umask 077
./scripts/backup-database.sh \
  /secure/sweettoon-backups/predeploy-$(date -u +%Y%m%dT%H%M%SZ).dump \
  -f docker-compose.yml \
  -f docker-compose.prod.yml \
  --env-file "$DEPLOY_ENV_FILE"
```

스크립트는 기존 파일을 덮어쓰지 않으며 PostgreSQL custom-format 덤프를 권한
`0600`으로 만든다. 생성 후에는 별도의 검증용 PostgreSQL에 복원하거나 최소한
`pg_restore --list BACKUP.dump`가 성공하는지 확인한다.

## 배포와 검증

`Jenkinsfile.deploy`은 migration·seed를 일회성 `migrate` 서비스에서 먼저
실행한다. 이 서비스가 성공해야 API가 시작된다. 이후 API, 웹, Traefik 경로와
SSE를 검증한다.

검증 실패 시 새 컨테이너를 계속 정상 버전으로 간주하지 않는다. 로그, 새 SHA,
직전 정상 SHA, DB migration 적용 여부를 먼저 기록한다.

## 애플리케이션 롤백

현재 파이프라인은 레지스트리 digest 승격을 사용하지 않으므로 자동 롤백을
지원하지 않는다. 이전 이미지를 로컬 캐시나 `latest` 추정으로 선택하지 않는다.

이전 앱이 새 DB 스키마와 호환되고 정확한 이전 이미지 digest를 보존한 경우에만
이미지를 되돌린다. 호환성을 확신할 수 없으면 앱 롤백보다 수정 버전의 roll-forward를
우선한다.

## 데이터베이스 복구

데이터베이스 복구는 주문과 캔디 원장을 되돌리는 파괴적 작업이다. 다음 조건이
모두 충족된 경우에만 운영자가 수동으로 수행한다.

- 쓰기 트래픽과 demo bot을 중지했다.
- 복구 대상 백업의 생성 시각과 SHA를 확인했다.
- 현재 DB를 별도로 다시 백업했다.
- 격리 DB에서 `pg_restore --clean --if-exists` 복원 검증을 완료했다.

복구 후에는 `prisma migrate deploy`를 다시 실행하고 API
`/health/ready`(DB·Redis 포함), Web `/health`, 주문 목록,
캔디 잔액·원장, 실시간 주문 이벤트를 순서대로 확인한다.

## 자동화 전제

Jenkins 자동 백업을 활성화하려면 먼저 다음 외부 계약이 필요하다.

- Jenkins가 쓸 수 있는 암호화된 백업 저장소
- 저장 경로 credential과 최소 권한
- 보존 기간 및 삭제 정책
- 정기적인 복원 훈련과 실패 알림

이 계약 없이 운영 데이터를 Jenkins 일반 artifact로 보관하지 않는다.

## 이미지 승격·자동 롤백 전제

CI에서 테스트한 애플리케이션 이미지를 그대로 배포하려면 다음 외부 계약을 먼저
준비한다.

- SweetToon 전용 OCI registry와 push/pull 최소 권한 credential
- `server`, `migrate`, `web` 이미지를 Git SHA로 push하는 명명 규칙
- 배포 잡이 tag가 아니라 registry가 반환한 digest만 받는 파라미터 계약
- 직전 정상 digest 보존 기간과 DB 하위 호환성 확인 절차

계약이 준비되면 CI가 이미지를 한 번만 빌드·검증·push하고, 배포 잡에서는
`build`를 실행하지 않고 전달받은 digest를 pull해야 한다. 검증 실패 시에도 DB
복구를 자동 수행하지 않으며, 이전 앱이 새 스키마와 호환되는 경우에만 직전 정상
digest로 애플리케이션 컨테이너를 되돌린다.

현재 저장소와 Jenkinsfile에는 registry 주소나 credential ID가 없으므로 임의의
개인 registry를 코드에 고정하지 않는다.

## 보안 점검과 알림 전제

일반 CI는 production dependency의 high 이상 취약점을 계속 차단한다. 별도 정기
audit 잡이나 Slack 알림을 추가하려면 Jenkins 잡, 알림 플러그인과 credential
소유자를 먼저 정한다. 이 계약 없이 현재 보안 게이트를 non-blocking으로 낮추거나
존재하지 않는 알림 채널을 Jenkinsfile에 추가하지 않는다.
