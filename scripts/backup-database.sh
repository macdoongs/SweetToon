#!/usr/bin/env sh
set -eu

if [ "$#" -lt 1 ]; then
  echo "Usage: $0 OUTPUT_PATH [docker compose options...]" >&2
  exit 2
fi

output_path=$1
shift

if [ -e "$output_path" ]; then
  echo "Refusing to overwrite existing backup: $output_path" >&2
  exit 2
fi

output_dir=$(dirname "$output_path")
mkdir -p "$output_dir"
umask 077

db_container=$(docker compose "$@" ps -q db)
if [ -z "$db_container" ]; then
  echo "The Compose database container is not running." >&2
  exit 1
fi

temporary_path="/tmp/sweettoon-predeploy-$$.dump"
cleanup() {
  docker exec "$db_container" rm -f "$temporary_path" >/dev/null 2>&1 || true
}
trap cleanup EXIT INT TERM

docker exec "$db_container" sh -eu -c \
  'pg_dump --format=custom --no-owner --no-acl \
    --username="$POSTGRES_USER" --dbname="$POSTGRES_DB" \
    --file="$1"' sh "$temporary_path"
docker cp "${db_container}:${temporary_path}" "$output_path"

if [ ! -s "$output_path" ]; then
  echo "Backup was created but is empty: $output_path" >&2
  exit 1
fi

chmod 600 "$output_path"
echo "Database backup created: $output_path"
