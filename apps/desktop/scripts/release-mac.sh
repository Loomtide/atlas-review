#!/usr/bin/env bash
set -euo pipefail

#
# release-mac.sh — Build, sign, and publish Mac releases (both architectures)
#
# Usage:
#   ./scripts/release-mac.sh              # auto-reads version from tauri.conf.json
#   ./scripts/release-mac.sh 0.25.27      # verify the committed version
#   ./scripts/release-mac.sh --build-only # build without publishing
#
# Prerequisites:
#   - apps/desktop/.env.local with APPLE_* credentials
#   - apps/desktop/.env with TAURI_SIGNING_PRIVATE_KEY_PASSWORD
#   - apps/desktop/.tauri_updater_key
#   - gh CLI authenticated
#

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
DESKTOP_DIR="$(dirname "$SCRIPT_DIR")"
PROJECT_ROOT="$(cd "$DESKTOP_DIR/../.." && pwd)"

BUILD_ONLY=false
VERSION=""

for arg in "$@"; do
  case "$arg" in
    --build-only) BUILD_ONLY=true ;;
    *) VERSION="$arg" ;;
  esac
done

cd "$DESKTOP_DIR"

# Read current version if not provided
if [ -z "$VERSION" ]; then
  VERSION=$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
  echo "Using current version: $VERSION"
else
  CURRENT_VERSION=$(python3 -c "import json; print(json.load(open('src-tauri/tauri.conf.json'))['version'])")
  if [ "$VERSION" != "$CURRENT_VERSION" ]; then
    echo "Update all version files and commit them before building $VERSION." >&2
    exit 1
  fi
fi

STAGING="$PROJECT_ROOT/release-staging/$VERSION"

echo ""
echo "========================================="
echo "  Building AtlasReview v$VERSION (Mac)"
echo "========================================="
echo ""

# Build Apple Silicon (signed + notarized)
echo "▸ Building aarch64 (Apple Silicon)..."
npm run release:local:build:signed -- --version "$VERSION" --target aarch64-apple-darwin

echo ""
echo "▸ Building x86_64 (Intel)..."
npm run release:local:build:signed -- --version "$VERSION" --target x86_64-apple-darwin

echo ""
echo "✅ Both builds complete. Artifacts in: $STAGING"
ls -lh "$STAGING/"

if [ "$BUILD_ONLY" = true ]; then
  echo ""
  echo "Build-only mode. Skipping publish."
  exit 0
fi

echo ""
echo "▸ Publishing to release repo..."
npm run release:local:publish -- --version "$VERSION" --artifacts-dir "$STAGING"

echo ""
echo "========================================="
echo "  ✅ v$VERSION released!"
echo "  https://github.com/Loomtide/atlas-review/releases/tag/v$VERSION"
echo "========================================="
