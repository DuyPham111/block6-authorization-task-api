#!/usr/bin/env bash
# Chạy bộ test HIỆN TẠI trên src của một git tag cũ (vd: starter) mà không đụng vào working tree.
# Dùng để tạo evidence "đỏ trước khi sửa" và bảng oracle theo từng phiên bản.
# Usage: bash scripts/test-against.sh <tag> [tham số jest...]
set -e
cd "$(dirname "$0")/.."
TAG=$1
shift
WORK=$(mktemp -d)
trap 'rm -rf "$WORK"' EXIT

# Tag cũ chỉ có src/; từ bản nộp có thêm data/seed.json.
git archive "$TAG" $(git ls-tree --name-only "$TAG" | grep -E '^(src|data)$') | tar -x -C "$WORK"
cp -r test package.json "$WORK"/

set -o pipefail
FORCE_COLOR=0 npx jest --rootDir "$WORK" --modulePaths "$PWD/node_modules" --runInBand "$@" 2>&1 |
  sed -E "s#[^ ]*tmp\.[A-Za-z0-9]+/#[src@$TAG] #g"
