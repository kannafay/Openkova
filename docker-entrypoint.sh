#!/bin/sh
set -eu

if [ -z "${API_KEY:-}" ]; then
  echo "API_KEY不能为空" >&2
  exit 1
fi

exec node apps/web/server.js
