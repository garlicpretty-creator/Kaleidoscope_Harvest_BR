#!/usr/bin/env bash
# Packs both packs into dist/Kaleidoscope-Harvest-v<version>.mcaddon.
# Run from anywhere: bash tools/build.sh (npm run build also validates and tests first).
# ## The zipping is done by tools/build.mjs in plain Node: no zip, python3 or python needed
# ## (this used to need zip or python3, which some Windows machines do not have).
set -euo pipefail
root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
exec node "$root/tools/build.mjs"
