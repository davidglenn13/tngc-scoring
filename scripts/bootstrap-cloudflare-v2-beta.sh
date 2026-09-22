#!/usr/bin/env bash
set -euo pipefail

PROJECT="tngc-scoring-v2-beta"
DATABASE="tngc-scoring-v2-beta"
BRANCH="v2-platform-rebuild"

: "${CLOUDFLARE_API_TOKEN:?CLOUDFLARE_API_TOKEN is required}"
: "${CLOUDFLARE_ACCOUNT_ID:?CLOUDFLARE_ACCOUNT_ID is required}"

if [[ "$PROJECT" == *"ballyhack"* || "$DATABASE" == *"ballyhack"* ]]; then
  echo "Safety stop: this script must never target Ballyhack." >&2
  exit 40
fi
if [[ "$PROJECT" != "tngc-scoring-v2-beta" || "$DATABASE" != "tngc-scoring-v2-beta" ]]; then
  echo "Safety stop: unexpected V2 beta target." >&2
  exit 41
fi

echo "1/6 Preflight"
npm run test:v2

echo "2/6 Verify/create isolated D1 database"
DB_JSON="$(npx --yes wrangler@latest d1 list --json)"
if node -e 'const a=JSON.parse(process.argv[1]); process.exit(a.some(x=>x.name===process.argv[2])?0:1)' "$DB_JSON" "$DATABASE"; then
  echo "D1 already exists: $DATABASE"
else
  npx --yes wrangler@latest d1 create "$DATABASE" --location=enam --binding=DB --update-config
fi

if ! grep -q 'database_name = "tngc-scoring-v2-beta"' wrangler.toml; then
  echo "Safety stop: wrangler.toml is not bound to the isolated V2 beta database." >&2
  exit 42
fi

echo "3/6 Apply V2 migrations to isolated D1"
npx --yes wrangler@latest d1 migrations apply "$DATABASE" --remote

echo "4/6 Verify/create isolated Pages project"
PROJECTS_JSON="$(npx --yes wrangler@latest pages project list --json)"
if node -e 'const a=JSON.parse(process.argv[1]); process.exit(a.some(x=>x.name===process.argv[2])?0:1)' "$PROJECTS_JSON" "$PROJECT"; then
  echo "Pages project already exists: $PROJECT"
else
  npx --yes wrangler@latest pages project create "$PROJECT" --production-branch="$BRANCH"
fi

echo "5/6 Deploy V2 branch directly to isolated Pages project"
npx --yes wrangler@latest pages deploy .   --project-name="$PROJECT"   --branch="$BRANCH"   --commit-message="TNGC V2 isolated beta"

echo "6/6 Show deployment inventory"
npx --yes wrangler@latest pages deployment list --project-name="$PROJECT" --environment=production --json

echo "V2 beta bootstrap/deploy complete."
