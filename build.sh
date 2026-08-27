#!/usr/bin/env bash
# Sigal Group Realty — production build
# Copies only visitor-facing files into dist/ (never src/, node_modules/, etc.)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$ROOT"

echo "→ Building reviews marquee…"
npm run build:reviews

echo "→ Assembling dist/…"
rm -rf dist
mkdir -p dist

cp -R assets dist/
cp -R listings dist/
cp -R admin dist/
cp -R blog dist/

for f in "$ROOT"/*.html; do
  cp "$f" dist/
done

for f in "$ROOT"/*.{jpg,jpeg,png,webp}; do
  [ -e "$f" ] || continue
  cp "$f" dist/
done

cp _redirects dist/
cp _headers dist/

count="$(find dist -type f | wc -l | tr -d ' ')"
echo "✓ dist/ ready ($count files)"

# Leak guard — these must never ship
for forbidden in package.json tsconfig.json vite.config.ts .git; do
  if [ -e "dist/$forbidden" ]; then
    echo "ERROR: dist/ contains forbidden path: $forbidden" >&2
    exit 1
  fi
done
