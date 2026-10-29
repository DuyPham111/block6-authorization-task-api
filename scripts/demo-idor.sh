#!/usr/bin/env bash
# Demo IDOR bằng curl: chạy server tạm, Alice (Owner Alpha) đọc A1 và B1 (project Beta).
cd "$(dirname "$0")/.." || exit 1
PORT=${PORT:-3006}
BASE="http://localhost:$PORT"

PORT=$PORT node src/server.js > /dev/null &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT

ALICE=$(node scripts/token.js alice)
for id in A1 B1; do
  echo "\$ curl -i $BASE/tasks/$id -H 'Authorization: Bearer <token Alice>'"
  curl -s -i --retry 10 --retry-connrefused --retry-delay 1 "$BASE/tasks/$id" \
    -H "Authorization: Bearer $ALICE" | grep -v -i -E '^(date|etag|connection|keep-alive|x-powered-by):'
  echo
  echo
done
