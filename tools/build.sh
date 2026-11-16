#!/usr/bin/env bash
# Packs both packs into dist/Kaleidoscope-Harvest-v<version>.mcaddon.
# Run from anywhere: bash tools/build.sh (npm run build also validates and tests first).
set -euo pipefail

zipdir() {
  if command -v zip >/dev/null 2>&1; then
    zip -q -r "$1" .
  else
    python3 -c 'import os, sys, zipfile
with zipfile.ZipFile(sys.argv[1], "w", zipfile.ZIP_DEFLATED) as z:
    for base, dirs, files in os.walk("."):
        dirs.sort()
        for name in sorted(files):
            path = os.path.join(base, name)
            z.write(path, os.path.relpath(path, ".").replace(os.sep, "/"))' "$1"
  fi
}

root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
version="$(node -e 'const m = JSON.parse(require("fs").readFileSync(process.argv[1], "utf8")); console.log(m.header.version.join("."))' "$root/packs/BP/manifest.json")"
name="Kaleidoscope Harvest v$version"
stage="$(mktemp -d)"
trap 'rm -rf "$stage"' EXIT

cp -R "$root/packs/BP" "$stage/$name [BP]"
cp -R "$root/packs/RP" "$stage/$name [RP]"

mkdir -p "$root/dist"
out="$root/dist/Kaleidoscope-Harvest-v$version.mcaddon"
rm -f "$out"
(cd "$stage" && zipdir "$out")
echo "built ${out#"$root/"}"
