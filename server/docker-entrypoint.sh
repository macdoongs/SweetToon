#!/bin/sh
set -eu

upload_dir="${UPLOAD_DIR:-/app/data/uploads}"
mkdir -p "$upload_dir"
chown -R node:node "$upload_dir"

export HOME=/home/node
exec su-exec node "$@"
