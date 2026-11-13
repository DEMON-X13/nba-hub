#!/usr/bin/env bash
# THE TEST STEP'S FETCH (PLAN.md 3.1): DraftKings' 2022-23 regular-season provider-40 lines, fetched by
# research/props_v2/fetch_dk40.js RUN UNCHANGED into its gitignored cache, every request logged, exactly as
# research/props_v3/fetch_dk40_logged.sh fetched 2023-24 (the same stand-in for curl, which passes output and exit code
# through and logs the time, curl's exit code, the HTTP status and the address, never an answer).
#
# WRITTEN AND TESTED IN A SANDBOX (test/machinery_check.js, with a stand-in for fetch_dk40.js), NEVER RUN ON THE FEED.
# It runs only for the one window PLAN.md 3.1 names (18 October 2022 to 9 April 2023), and only once the preregistration
# is committed, pushed and audited sound. Its gate is test/fetch_record.js (since the review of 13 November 2026,
# finding F3): the commit (PROPS_V3_PREREG=<sha>) must be on origin's branch PROPS_V3_BRANCH and hold PREREG.md,
# PREREG_HASHES.json and PREREG_AUDIT.md, the audit reading "verdict: sound" and naming the SHA-256 of the PREREG.md and
# PREREG_HASHES.json it audited, which must be those the commit holds; and the fetch's start is committed and pushed to
# origin (research/props_v3/test/fetch_2023.json) BEFORE the first request, so a second fetch is refused by origin's
# record, not by a marker in the cache (which a lost container wipes). An interrupted fetch is run again under the same
# preregistration ("resume", fetch_dk40.js keeping what an earlier read found by its own rule); a cache lost after the
# fetch finished is fetched again only with PROPS_V3_RECOVER=1, and its clean lines must come out byte for byte as the
# record holds them. When the fetch ends the cleaner runs and the record is finished, with every file's SHA-256, and
# pushed: the scorer reads the lines' hashes from there.
#
#   PROPS_V3_PREREG=<sha> PROPS_V3_BRANCH=<branch> bash research/props_v3/test/fetch_dk40_2023_logged.sh
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../../.." && pwd)"
FROM="2022-10-18"; TO="2023-04-09"
cd "$ROOT"
DECISION="$(node research/props_v3/test/fetch_record.js start)"
case "$DECISION" in
  start) echo "the fetch's start is on origin: fetching" ;;
  resume) echo "resuming the fetch started under this preregistration" ;;
  recover) echo "recovering the lost cache of the finished fetch (its clean lines must come out as recorded)" ;;
  *) echo "refused: no decision ($DECISION)" >&2; exit 1 ;;
esac
LOGDIR="$HERE/../cache"; mkdir -p "$LOGDIR"
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
printf 'started\t%s\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FROM" "$TO" "$DECISION" >> "$REQLOG"
PATH="$SHIM:$PATH" REAL_CURL="$REAL_CURL" DK40_REQLOG="$REQLOG" node research/props_v2/fetch_dk40.js "$FROM" "$TO" | tee -a "$OUTLOG"
printf 'finished\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FROM" "$TO" >> "$REQLOG"
node research/props_v3/test/lines_clean_2023.js
node research/props_v3/test/fetch_record.js finish
