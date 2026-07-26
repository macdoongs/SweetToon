#!/bin/sh
set -eu

env_file="${1:?environment file path is required}"
site_url="$(
  sed -n 's/^SITE_URL=//p' "$env_file" |
    tail -n 1 |
    tr -d '\r' |
    sed 's/^["'\'']//; s/["'\'']$//'
)"

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

printf '%s' "$site_host"
