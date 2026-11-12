#!/usr/bin/env bash
# DraftKings' provider-40 lines for a date range, fetched by research/props_v2/fetch_dk40.js RUN UNCHANGED (the reviewed
# recipe: its cache, research/props_v2/cache/, gitignored), with every request it makes logged so the fetch can be
# counted. fetch_dk40.js calls `curl` by name; this puts a stand-in first on PATH for that one run, which calls the real
# curl with the very same arguments, passes its output and exit code through untouched, and adds one line to a request
# log: the time, curl's exit code, the HTTP status (the last line of the output, which fetch_dk40.js asks curl to write)
# and the address. The log holds addresses only, never an answer.
#
#   bash research/props_v3/fetch_dk40_logged.sh 2023-10-24 2024-04-30
#
# Writes, all in research/props_v3/cache/ (gitignored): fetch_dk40_<from>_<to>.requests.tsv (the request log) and
# fetch_dk40_<from>_<to>.stdout.log (fetch_dk40.js's own lines). research/props_v3/fetch_check.js reads them.
#
# It refuses any range that touches the 2022-23 season (1 July 2022 to 30 September 2023): those lines are the one-shot
# test's, fetched only by its Test step after the preregistration (research/props_v3/data.md).
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/../.." && pwd)"
FROM="${1:-}"; TO="${2:-}"
if [[ ! "$FROM" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ || ! "$TO" =~ ^[0-9]{4}-[0-9]{2}-[0-9]{2}$ ]]; then
  echo "usage: bash research/props_v3/fetch_dk40_logged.sh <from YYYY-MM-DD> <to YYYY-MM-DD>" >&2; exit 1
fi
if [[ ! "$FROM" > "2023-09-30" && ! "$TO" < "2022-07-01" ]]; then
  echo "refused: $FROM to $TO touches the 2022-23 season (2022-07-01 to 2023-09-30), the one-shot test's lines" >&2; exit 1
fi
REAL_CURL="$(command -v curl)"
LOGDIR="$HERE/cache"; mkdir -p "$LOGDIR"
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
cd "$ROOT"
PATH="$SHIM:$PATH" REAL_CURL="$REAL_CURL" DK40_REQLOG="$REQLOG" node research/props_v2/fetch_dk40.js "$FROM" "$TO" | tee -a "$OUTLOG"
printf 'finished\t%s\t%s\t%s\n' "$(date -u +%Y-%m-%dT%H:%M:%SZ)" "$FROM" "$TO" >> "$REQLOG"
