#!/bin/sh
set -eu

env_file="${1:?environment file path is required}"
output="${2:-host}"
site_url="$(
  sed -n 's/^SITE_URL=//p' "$env_file" |
    tail -n 1 |
    tr -d '\r' |
    sed 's/^["'\'']//; s/["'\'']$//'
)"

if [ -z "$site_url" ] && [ -n "${SITE_URL:-}" ]; then
  site_url="$SITE_URL"
fi

# 기존 배포가 하드코딩 기본값을 사용했던 경우의 일회성 마이그레이션 경로다.
# 신규 노드는 컨테이너가 없으므로 SITE_URL 미설정 시 아래 검증에서 중단된다.
if [ -z "$site_url" ] && command -v docker >/dev/null 2>&1; then
  site_url="$(
    docker inspect sweettoon-web \
      --format '{{range .Config.Env}}{{println .}}{{end}}' 2>/dev/null |
      sed -n 's/^SITE_URL=//p' |
      tail -n 1 |
      tr -d '\r' || true
  )"
fi

case "$site_url" in
  http://* | https://*) ;;
  *)
    echo "SITE_URL must use http or https." >&2
    exit 1
    ;;
esac

site_host="${site_url#*://}"
site_host="${site_host%%/*}"
site_host="${site_host%%:*}"

case "$site_host" in
  "" | *[!A-Za-z0-9.-]*)
    echo "SITE_URL contains an invalid host." >&2
    exit 1
    ;;
esac

case "$output" in
  url) printf '%s' "$site_url" ;;
  host) printf '%s' "$site_host" ;;
  *)
    echo "output must be url or host." >&2
    exit 1
    ;;
esac
