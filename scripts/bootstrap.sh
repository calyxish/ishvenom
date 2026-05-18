#!/usr/bin/env bash
# Bootstrap a fresh clone of IshVenom.
set -euo pipefail

echo "🐍 Bootstrapping IshVenom..."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm not found. Install via: corepack enable && corepack prepare pnpm@9.12.0 --activate"
  exit 1
fi

echo "Installing workspace dependencies..."
pnpm install

echo "Building shared-types..."
pnpm --filter @ishvenom/shared-types build

if [ ! -f services/api/.env ]; then
  echo "Creating services/api/.env from example (edit with your Neon URL)..."
  cp services/api/.env.example services/api/.env
fi

echo "Running checks..."
pnpm run check || {
  echo "⚠️  Initial checks failed — expected until all workspaces are built."
  echo "    Run: pnpm --filter @ishvenom/api prisma:generate"
}

echo "✅ Bootstrap complete. Next: pnpm --filter @ishvenom/api dev"
