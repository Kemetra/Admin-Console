#!/usr/bin/env bash
# RT-584: materialise the pinned Backend-Core commits for `pnpm generate:client`.
#
# The generator reads OpenAPI sources with `git show <pin>:<path>` from the repo
# named by DATA_PULSE_2_REPO, so CI needs a git repo that contains every pin.
# Pins are derived from openapi-ts.config.ts (the global pin plus any temporary
# per-source hold), so a re-pin never needs a workflow edit. Backend-Core is
# public: anonymous shallow fetch, no secret. The repo lives outside the
# workspace so tsc, biome and `git status` never see a nested repository.
#
# Usage (from the repo root): .github/scripts/fetch-pinned-contracts.sh <dest-dir>
set -euo pipefail

dest="${1:?usage: fetch-pinned-contracts.sh <dest-dir>}"
repo_url="https://github.com/Kemetra/Backend-Core.git"
max_attempts=3

pins="$(node --disable-warning=ExperimentalWarning --experimental-strip-types --input-type=module -e '
  const { OPENAPI_SOURCE_SPECS, pinOf } = await import("./openapi-ts.config.ts");
  console.log([...new Set(OPENAPI_SOURCE_SPECS.map(pinOf))].join("\n"));
')"

if [ -z "$pins" ]; then
  echo "::error title=Contract pin::No Backend-Core pins found in openapi-ts.config.ts"
  exit 1
fi

git init -q "$dest"

for pin in $pins; do
  for attempt in $(seq 1 "$max_attempts"); do
    if git -C "$dest" fetch -q --depth=1 "$repo_url" "$pin"; then
      git -C "$dest" cat-file -e "${pin}^{commit}"
      echo "Fetched Backend-Core @ ${pin}"
      break
    fi
    if [ "$attempt" -eq "$max_attempts" ]; then
      echo "::error title=Contract fetch::Could not fetch Backend-Core @ ${pin} after ${max_attempts} attempts"
      exit 1
    fi
    echo "Fetch of ${pin} failed (attempt ${attempt}/${max_attempts}); retrying"
    sleep $((attempt * 5))
  done
done
