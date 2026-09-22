#!/usr/bin/env bash
set -euo pipefail
PROJECT="tngc-scoring-v2-beta"
DATABASE="tngc-scoring-v2-beta"

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

echo "D1:"
npx --yes wrangler@latest d1 info "$DATABASE" --json

echo "Pages:"
npx --yes wrangler@latest pages deployment list --project-name="$PROJECT" --environment=production --json
