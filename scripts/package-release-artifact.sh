#!/bin/bash

set -euo pipefail

SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
REPO_ROOT=$(cd "$SCRIPT_DIR/.." && pwd)

EXPECTED_VERSION="${1:-}"
OUTPUT_PATH="${2:-}"

read_json_version() {
  local file_path="$1"
  node -e "const fs = require('fs'); console.log(JSON.parse(fs.readFileSync(process.argv[1], 'utf8')).version);" "$file_path"
}

resolve_output_path() {
  local candidate="$1"

  if [[ -z "$candidate" ]]; then
    echo "$REPO_ROOT/planmypeak-importer-webstore-v${PACKAGE_VERSION}.zip"
    return
  fi

  if [[ "$candidate" = /* ]]; then
    echo "$candidate"
    return
  fi

  echo "$REPO_ROOT/$candidate"
}

cd "$REPO_ROOT"

PACKAGE_VERSION=$(read_json_version "package.json")
MANIFEST_VERSION=$(read_json_version "public/manifest.json")

if [[ "$PACKAGE_VERSION" != "$MANIFEST_VERSION" ]]; then
  echo "Error: package.json version ($PACKAGE_VERSION) does not match public/manifest.json version ($MANIFEST_VERSION)." >&2
  exit 1
fi

if [[ -n "$EXPECTED_VERSION" && "$EXPECTED_VERSION" != "$PACKAGE_VERSION" ]]; then
  echo "Error: expected version $EXPECTED_VERSION but source version is $PACKAGE_VERSION." >&2
  exit 1
fi

if [[ ! -d "dist" ]]; then
  echo "Error: dist/ does not exist. Run 'npm run build:bundle' first." >&2
  exit 1
fi

DIST_MANIFEST_PATH="dist/manifest.json"

if [[ ! -f "$DIST_MANIFEST_PATH" ]]; then
  echo "Error: dist/manifest.json does not exist. Build output is incomplete." >&2
  exit 1
fi

DIST_VERSION=$(read_json_version "$DIST_MANIFEST_PATH")

if [[ "$DIST_VERSION" != "$PACKAGE_VERSION" ]]; then
  echo "Error: dist/manifest.json version ($DIST_VERSION) does not match source version ($PACKAGE_VERSION)." >&2
  exit 1
fi

OUTPUT_PATH=$(resolve_output_path "$OUTPUT_PATH")
OUTPUT_DIR=$(dirname "$OUTPUT_PATH")

mkdir -p "$OUTPUT_DIR"
rm -f "$OUTPUT_PATH"

TMP_DIR=$(mktemp -d)
trap 'rm -rf "$TMP_DIR"' EXIT

cp -R dist/. "$TMP_DIR/"

rm -rf "$TMP_DIR/.vite"
find "$TMP_DIR" -name '.gitkeep' -delete

# Normalize mtimes and zip entry order so release artifacts are reproducible.
find "$TMP_DIR" -exec touch -t 202001010000 {} +

(
  cd "$TMP_DIR"
  LC_ALL=C find . -mindepth 1 -print | sort | zip -X -q "$OUTPUT_PATH" -@
)

echo "Created release artifact: $OUTPUT_PATH"
