#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT_DIR"

if [ ! -f "contracts/openapi.json" ]; then
  echo "contracts/openapi.json not found. Run: python3 scripts/export_openapi.py"
  exit 1
fi

echo "Generating TypeScript contract types..."
npx --yes openapi-typescript contracts/openapi.json -o frontend/lib/generated/openapi.types.ts

echo "Generating Dart SDK (dart-dio)..."
docker run --rm \
  -v "$ROOT_DIR:/local" \
  openapitools/openapi-generator-cli:v7.10.0 generate \
  -i /local/contracts/openapi.json \
  -g dart-dio \
  -o /local/mobile/lib/generated/oku_api

echo "SDK generation complete."
