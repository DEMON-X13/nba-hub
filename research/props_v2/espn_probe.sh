#!/usr/bin/env bash
# Does ESPN's free feed keep DraftKings' player props for older games? One request a game a provider, limit=1, so only
# the HTTP status and the item count are read; no line is kept. Writes results/espn_probe.tsv.
#
#   bash research/props_v2/espn_probe.sh
#
# For each event: the providers its odds list names (`/odds`), then `/odds/<p>/propBets?limit=1` for each of those and for
# DraftKings (100) and ESPN BET (58) whether listed or not. The events are picked from data/games.csv: the 2025-26 regular
# season (October, January, March, its last week) and play-in, the 2026 playoffs, 2024-25's regular season and playoffs,
# 2023-24's and 2022-23's playoffs, and three games of this season (counted only; nothing of them is graded or scored).
set -u
cd "$(dirname "$0")"
OUT=results/espn_probe.tsv
B='https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events'
EVENTS='2026_20251022_BKN_CHA:401809933 2026_20260115_ATL_POR:401810440 2026_20260301_CLE_BKN:401810724 2026_20260410_BKN_MIL:401811034 2026_20260414_MIA_CHA:401866755
2026_20260417_CHA_ORL:%PLAYIN% 2026_20260418_ATL_NYK:401869189 2026_20260603_NYK_SAS:401859963
2025_20241101_BOS_CHA:401704698 2025_20250301_BKN_DET:401705427 2025_20250420_GSW_HOU:401767823 2025_20250605_IND_OKC:401766122
2024_20240421_DAL_LAC:401654763 2024_20240606_DAL_BOS:401656359 2023_20230416_LAC_PHX:401540757
2027_20261020_BOS_DET:401909088 2027_20261025_DET_PHI:401909866 2027_20261101_BKN_IND:401909904'
PLAYIN=$(awk -F, '$1=="2026_20260417_CHA_ORL"{print $14}' ../../data/games.csv)
printf 'game_id\tespn_id\tproviders_listed\tprovider\thttp\titems\tprobed_at\n' > "$OUT"
for pair in $EVENTS; do
  gid=${pair%%:*}; E=${pair#*:}; [ "$E" = '%PLAYIN%' ] && E=$PLAYIN
  prov=$(curl -sS -m 25 "$B/$E/competitions/$E/odds?lang=en&region=us" | python3 -I -c 'import sys,json
try: d=json.load(sys.stdin); print(",".join(str(i.get("provider",{}).get("id")) for i in d.get("items",[])) or "-")
except Exception: print("?")')
  for p in $(printf '%s\n' 100 58 ${prov//,/ } | grep -v -e '^-$' -e '^?$' | sort -u); do
    body=$(curl -sS -m 25 -w '\n%{http_code}' "$B/$E/competitions/$E/odds/$p/propBets?lang=en&region=us&limit=1")
    code=${body##*$'\n'}; json=${body%$'\n'*}
    n=$(printf '%s' "$json" | python3 -I -c 'import sys,json
try: print(json.load(sys.stdin).get("count", 0))
except Exception: print("-")')
    printf '%s\t%s\t%s\t%s\t%s\t%s\t%s\n' "$gid" "$E" "$prov" "$p" "$code" "$n" "$(date -u +%Y-%m-%dT%H:%MZ)" >> "$OUT"
  done
done
cat "$OUT"
