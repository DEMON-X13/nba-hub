#!/usr/bin/env bash
# THE TEST STEP'S FETCH (PLAN.md 3.1): DraftKings' 2022-23 regular-season provider-40 lines, fetched by
# research/props_v2/fetch_dk40.js RUN UNCHANGED into its gitignored cache, every request logged, exactly as
# research/props_v3/fetch_dk40_logged.sh fetched 2023-24 (the same stand-in for curl, which passes output and exit code
# through and logs the time, curl's exit code, the HTTP status and the address, never an answer).
#
# WRITTEN AND REVIEWED, NOT RUN. It runs only for the one window PLAN.md 3.1 names (18 October 2022 to 9 April 2023), and
# only once the preregistration is committed, pushed and audited sound: it is handed the commit (PROPS_V3_PREREG=<sha>),
# which must be on a branch of origin and hold research/props_v3/PREREG.md and research/props_v3/PREREG_AUDIT.md, the
# audit's file with a line reading exactly "verdict: sound". It refuses a second run (a marker in the cache).
#
#   PROPS_V3_PREREG=<sha> bash research/props_v3/test/fetch_dk40_2023_logged.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
FROM="2022-10-18"; TO="2023-04-09"
SHA="${PROPS_V3_PREREG:-}"
if [[ -z "$SHA" ]]; then echo "refused: no preregistration commit (PROPS_V3_PREREG)" >&2; exit 1; fi
cd "$ROOT"
git cat-file -e "$SHA:research/props_v3/PREREG.md" 2>/dev/null || { echo "refused: $SHA holds no research/props_v3/PREREG.md" >&2; exit 1; }
git show "$SHA:research/props_v3/PREREG_AUDIT.md" 2>/dev/null | grep -qx 'verdict: sound' || { echo "refused: $SHA holds no audit reading 'verdict: sound'" >&2; exit 1; }
[[ -n "$(git branch -r --contains "$SHA" 2>/dev/null)" ]] || { echo "refused: $SHA is not on a branch of origin (pushed)" >&2; exit 1; }
LOGDIR="$HERE/../cache"; mkdir -p "$LOGDIR"
MARK="$LOGDIR/fetch_dk40_2023.ran"
if [[ -e "$MARK" ]]; then echo "refused: the 2022-23 fetch has run already ($MARK)" >&2; exit 1; fi
printf '%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$SHA" > "$MARK"
REAL_CURL="$(command -v curl)"
REQLOG="$LOGDIR/fetch_dk40_${FROM}_${TO}.requests.tsv"
OUTLOG="$LOGDIR/fetch_dk40_${FROM}_${TO}.stdout.log"
SHIM="$(mktemp -d)"; trap 'rm -rf "$SHIM"' EXIT
cat > "$SHIM/curl" <<'EOS'
#!/usr/bin/env bash
t="$(mktemp)"
"$REAL_CURL" "$@" > "$t"; rc=$?
code="$(tail -n 1 "$t" 2>/dev/null | tr -dc '0-9')"
printf '%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$rc" "${code}" "${@: -1}" >> "$DK40_REQLOG"
cat "$t"; rm -f "$t"
exit $rc
EOS
chmod +x "$SHIM/curl"
printf 'started\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FROM" "$TO" >> "$REQLOG"
PATH="$SHIM:$PATH" REAL_CURL="$REAL_CURL" DK40_REQLOG="$REQLOG" node research/props_v2/fetch_dk40.js "$FROM" "$TO" | tee -a "$OUTLOG"
printf 'finished\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FROM" "$TO" >> "$REQLOG"
