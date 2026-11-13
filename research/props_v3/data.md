# The data for a third props model: what there is, what is clean, and what each source may be used for

Research only, 12 November 2026. A first run of this research was lost with its clone and caches on 11 November
(`lessons.md` outside the repo); every number here is re-derived by this folder's own scripts, and where one of the
first run's leads is confirmed it says so. Nothing here fits, tunes, chooses or scores a candidate, and no model's chance
of any line is computed. Seasons are named as `data/` names them, by the year they end (2024 is 2023-24).

| File | What |
|---|---|
| `fetch_dk40_logged.sh` | Runs `research/props_v2/fetch_dk40.js`, unchanged, with every request it makes logged (a stand-in for `curl` first on its PATH, passing output and exit code through); refuses any range touching 2022-23. Logs go to `cache/` (gitignored) |
| `fetch_check.js` → `results/fetch_check.json` | The 2023-24 fetch counted, held to props_v2's test and samples, and checked for what is clean; `--write-window` writes the regular-season window's rows alone for the validity check |
| `lines_clean.js` → `cache/dk40_2024_lines.csv`, `cache/dk40_2024_starts.csv` | The 2023-24 lines without `last_updated` (section 1), and each game's scheduled start |
| `probe_dk40_2023.js` → `results/probe_dk40_2023.json` | The one availability probe of the 2022-23 feed: one request, its body discarded unread, the HTTP status kept |
| `espn_depth.js` → `results/espn_depth.json` | How far back ESPN's game summaries keep a box score, and what each carries: four games a season, 1992-93 to 2023-24, shape only |
| `data_inventory.js` → `results/data_inventory.json` | Every file on disk: its shape, completeness, consistency and what the rules allow it for; files only, no network |

The result files hold counts, hashes, game ids and DraftKings' aggregate figures: no line, price or player id.

**The short answers.**
- **DraftKings' 2023-24 lines are back, byte for byte.** The regular-season window's rows hash to the very SHA-256
  props_v2's test recorded for the csv it scored: 92,295 rows on 1,116 games, graded to 89,032 lines, and props_v2's
  validity check gives back its published figures to the last digit. They are development data: scored once, against
  props_v2's candidate A on 6 November 2026 (FAIL).
- **One column is not clean.** `last_updated`, which the fetch writes beside each line, calls 95.5% of the graded lines
  right on its own (AUC 0.968), where DraftKings' fair chance calls 58.2%. It records when DraftKings last touched the
  line, and a line whose Over landed was touched when it landed. No candidate may read it; `cache/dk40_2024_lines.csv`
  is the lines without it. The 2022-23 lines will carry the same column.
- **The 2022-23 feed is still served** (one request, HTTP 200, nothing read).
- **ESPN's box scores go back to 1993-94** (sampled): minutes and starters throughout, plus-minus only from 2008-09,
  did-not-play reasons from 2012-13, and gaps (games with no minutes at all in 2014-15 and 2015-16).
- **No past season has a pre-game injury report**, on disk or on ESPN. The hub's log starts on 20 September 2026.
- What the rules allow each source for is section 6.

## 1. DraftKings' 2023-24 lines, fetched again

### How

`bash research/props_v3/fetch_dk40_logged.sh 2023-10-24 2024-04-30`: props_v2's recipe over the 2023-24 range its
`data.md` gives, writing to `research/props_v2/cache/` (gitignored) as it always has. The range holds 1,273 finals (no
preseason); 5 have no ESPN id (`2024_20231109_ORL_ATL`, `2024_20231207_LAL_NOP`, `2024_20231207_MIL_IND`,
`2024_20240111_CLE_BKN`, `2024_20240317_SAS_BKN`) and are not asked, as before. For each of the other 1,268 the recipe
asks for the event (its scheduled start) and then each propBets page of provider 40.

### The fetch, logged

| Run | When (UTC, 12 November 2026) | Requests | What came back |
|---|---|---|---|
| 2023-10-24 to 2024-04-30 | 00:07:06 to 00:18:27 | 2,536: 1,268 events, 1,268 propBets pages | every event 200; pages 1,141 HTTP 200, 126 HTTP 404 ("No propBets found"), 1 failed (curl exit 56, the connection dropped mid-answer: `2024_20231126_ATL_BOS`) |
| 2023-11-26 (the failed game's date) | 00:18:50 to 00:18:53 | 16: 8 events, 8 pages | all 200; ATL at BOS answered with 76 lines; the day's other 7 games read again row for row as the first pass had them |

So 2,552 requests in all, every game one page (limit 1000 is honoured), none refused by the server (a 404 is the feed's
"No propBets found"), and in the end every game of the range read: **1,142 games with lines, 126 with none, none
failed**. The cache holds **94,485 main lines**:

| Kind of game | Games read | With lines | Lines |
|---|---|---|---|
| Regular season, 24 October 2023 to 14 April 2024 (props_v2's test window) | 1,226 | 1,116 | 92,295 |
| Play-in, 16 to 19 April (games.csv types it REG) | 6 | 6 (all) | 511 |
| Playoffs, 20 to 30 April | 36 | 20 (20 to 26 April; none from 27 April) | 1,679 |

By stat: points 15,857, rebounds 16,880, assists 10,345, threes 16,025, steals 17,778, blocks 17,600 (the six base
stats: provider 40 carries no combos, ladders or double-doubles). 6 to 120 lines a game (median 83), 445 players. No
game, player and stat twice; both prices on every line, every one an American price; every line a half point, so no
push is possible; every line stamped; every game's scheduled start read.

### The same lines props_v2 scored

| | This fetch | props_v2's test (`results/test2024.json`, 6 November 2026) |
|---|---|---|
| Window games, with no ESPN id, with one | 1,231, 5, 1,226 | 1,231, 5, 1,226 |
| Read: lines, none, failed | 1,116, 110, 0 | 1,116, 110, 0 |
| Rows in the window | 92,295 | 92,295 |
| SHA-256 of the window's rows, as the recipe writes them | `9ff28cff993bc32aa50967c795764e0259f0404cc89b23c44fb4be0c84c4a0e5` | `9ff28cff993bc32aa50967c795764e0259f0404cc89b23c44fb4be0c84c4a0e5` |

The window's rows, written as `fetch_dk40.js` writes its csv (its header, the window's games in game order, a closing
newline), are the very bytes props_v2's test scored. The whole file hashes otherwise
(`98e6d677953941325297f48537db096a4694d8489c36801df3f104cfff7ecc4f`) because it also holds the range's play-in and
playoff games, which props_v2's own fetch did not: its csv had no row outside the window, so it was evidently run over the
window alone. The 110 games with none fall where props_v2's README says, by date: 21-22 November (19 games), 12-23
January (78), 22 February (6 of the day's 12), and one game on each of seven other dates (2, 9 and 14 December; 27
February; 8, 9 and 16 March).

Against props_v2's samples of the same feed (5 November 2026):
- `espn_coverage.tsv` asked one 2023-24 game in four of provider 40: of its 329, the 317 inside this range answer as
  they did (286 with lines both times, 31 with none both times); the other 12 are playoff games of May and June 2024,
  outside the range, all with none then.
- `espn_validate40.json` read 34 games whole (29 regular-season, 5 playoff): each game's count of main lines then is its
  rows now, and its event's start the same, on all 34.

The first run's lead (89,032 lines on 1,116 games) holds.

### props_v2's validity check, on them

`validity.js` (props_v2's, unchanged), run twice: on the window's bytes alone
(`node research/props_v3/fetch_check.js --write-window`, then `node research/props_v2/validity.js --lines
research/props_v3/cache/props40_2024_window/props40_2024.csv --season 2024`) and on the whole file in
`research/props_v2/cache/` (the check cuts to the window itself). Both give back every figure of `test2024.json`'s
validity block: 89,032 lines graded on 1,116 games (3,224 void, 39 with no projection, no push); V0 holds on every stat
(points 0.6920 reading the first item as the Over against 0.6972 swapped, blocks 0.6121 against 0.9281); V1, no line
stamped before its start (median 3.23 hours after), so pre-game is inferred, not shown; V2 holds (414 lines on 77 early
exits, +0.0016 against a floor of -0.05); V3 holds on every stat (points 0.0209 against a limit of 0.0533, rebounds 0.0128
against 0.0268, assists 0.0169 against 0.0262, threes 0.0056 against 0.0224, steals 0.0033 against 0.0140, blocks 0.0024
against 0.0139). Verdict, as before: "the bar applies (pre-game not shown by the feed: inferred from V2 and V3)".

`validity.js` loads every box file to 2026, as props_v2 wrote it: the 2023-24 projections it needs are `tools/props.js`'s
2024 fold, fitted on 2022-23, and its naive forecaster's spread is fitted on the seasons before 2024, which is 2022-23. It
prints no 2022-23 figure. That is listed in section 2.

### What in them is clean

Graded as `tools/props.js` grades a line (a player who played, minutes above 0 and not flagged did-not-play; the Over
landing when the stat is above the line), the window's 92,295 lines are: 89,071 on players who played (89,032 of them have
a projection, the validity check's lines), 1,105 on players the box lists as not playing and 2,110 on players the box does
not list (void, as DraftKings voids them), and 9 on players who played under half a minute, whose box minutes read 0:
void by the hub's rule, though DraftKings would grade them as played. The Over went in 45.33% where DraftKings' fair
chance (the whole margin on the Over) said 43.89%. The margin is 6.0% to 6.8% at the median by stat (points 6.78%,
rebounds 6.23%, assists 6.19%, threes 6.13%, steals 6.13%, blocks 6.03%).

The prices read as pre-game: V2 and V3 hold, and on the lines whose Over landed, DraftKings' mean fair chance does not
climb with how late in the game the Over landed (by quintile of the stamp: 0.473, 0.465, 0.465, 0.455, 0.456), where a
price set during the game would. As props_v2 said, V2 and V3 rule out gross contamination, not a small share of prices
read early in their games.

### The one column that is not clean: `last_updated` tells the result

`fetch_dk40.js` writes, beside the record's six columns, each line's `last_updated` (the later of its two items'
`lastUpdated` as the feed gives it), for the validity check's V1. On the window's graded lines:

| The line's stamp, by quarter (hours after the scheduled start) | Lines | The Over went in | DraftKings' fair chance said |
|---|---|---|---|
| 2.88 to 3.17 | 2,269 | 2.0% | 41.9% |
| 3.17 to 3.23 | 42,065 | 2.2% | 42.1% |
| 3.23 to 4.48 | 22,440 | 81.4% | 45.8% |
| 4.48 and after | 22,297 | 94.7% | 45.5% |

(The quarters are unequal because stamps tie.) The stamp alone has an AUC of 0.968 for the Over (0.978 at the median within
a game), and a rule with no price in it, "the Over where the line's stamp is more than five minutes after its game's
first stamp", calls 85,032 of the 89,071 lines right (95.5%), where DraftKings' fair chance calls 58.2%. A game's latest
stamp also tells whether it went past regulation: every one of the 53 overtime games' latest stamps (median 5.72 hours)
is later than the regulation games' median (5.32), and the overtime games went Over 52.2% against a fair 44.0%.

The reading that fits: `lastUpdated` runs about three hours ahead of UTC while labelled Z (the hub's README found it so on
provider 100), each line was last touched at about tip-off unless its Over landed, when it was touched at that moment in
the game, and a game's latest stamp is its end. So the column is an outcome, not an input. This is the first run's lead
L1 ("the last_updated column leaked timing"), re-derived and measured. The rules that follow:
- **No candidate, and nothing that chooses anything, reads `last_updated`.** `lines_clean.js` writes the lines without it,
  in `data/props_2026.csv`'s six columns (`cache/dk40_2024_lines.csv`, 94,485 rows, SHA-256
  `0082ede70dc60184a2cefe96a43633a592b19a9f9ae42319fa0ab7fe54d08b0c`), and each game's scheduled start, which is known
  before tip-off, apart (`cache/dk40_2024_starts.csv`, 1,268 games, SHA-256
  `86dfd6e2cfa5f26788c0f8ae7a727abfd83673963c6d0c2de0daf0a7ca5b9703`). A candidate's loader should refuse a file with a
  seventh column.
- Only the validity check's V1 reads the stamp, and only to say whether pre-game is shown.
- The 2022-23 lines will come with the same column: the Test step strips it before any candidate reads them.
- Anything else that reveals a game's length or a line's settlement is an outcome too (the game's box minutes, overtime).

### A stray fetch, disclosed

A first test of the wrapper's 2022-23 guard ran three ranges: the two that touch 2022-23 were refused with no request, but
the third, a 2021-22 range meant only to show the guard lets earlier seasons through, ran the real recipe. It was stopped
by hand after 373 games (19 October to 8 December 2021): 746 requests, every event 200 and every propBets page 404, so no
line or price came back (props_v2's coverage had found none in 2021-22's regular season). 2021-22 is development data, so no
rule was broken, but it was not asked for. Its files (a csv with only its header, 350 reads flushed, the logs) were moved
out of `research/props_v2/cache/` into `research/props_v3/cache/stray_2021-22/` before the 2023-24 fetch, so that cache
holds the 2023-24 fetch alone. `fetch_check.js` counts it (`fetch.stray`).

## 2. The 2022-23 lines: the one-shot test, not fetched

**Is the feed still served? One probe.** `probe_dk40_2023.js` made one request at 00:24:35 UTC on 12 November 2026:
provider 40's propBets for `2023_20230115_GSW_CHI` (ESPN 401468805, `limit=1`), the first regular-season game from 15
January 2023 that props_v2's coverage found answering on 5 November. curl wrote the answer to `/dev/null` and kept only the
status: **HTTP 200, still served**. No price, line, item count or outcome was read. The script refuses a second run.

**What is known without reading them** (props_v2's committed results): its coverage asked one game in four on 5 November
2026, and provider 40 answered for 303 of 309 sampled regular-season games and 20 of 21 sampled playoff games; its data.md
scales that to about 1,210 regular-season games, which at 2023-24's rate (about 80 lines a game) is about 90,000 lines.

**What has been seen of 2022-23, for the preregistration's list.** Its prices have been seen nowhere in bulk, but:
- props_v2 (5 November 2026): `espn_coverage` (status and item count, one game in four), `espn_validate40` (31 sampled
  regular-season games and 20 playoff games read whole: DraftKings' own log loss, Brier, over rate and mean fair chance on
  them, lines a game, margins, stamps, all committed in `results/espn_validate40.json` and quoted in its data.md),
  `espn_shape` (11 answers read whole in memory for their shape, one of them a 2023 playoff game, LAC at PHX on 16 April
  2023) and `espn_probe.sh` (the same game, status and item count).
- The first run of this research: one or two availability probes (lessons.md), the details lost.
- This run: the one probe above; and this agent's terminal showed the 2022-23 rows of props_v2's
  `results/espn_validate40.json`, `espn_coverage.json` and the first lines of `espn_coverage.tsv` while surveying
  props_v2's results (the figures named above, nothing beyond what props_v2 committed).
- Its outcomes are not blind: `data/box_2023.csv`, `teambox_2023.jsonl`, `games.csv`'s finals and `odds_hist.csv`'s
  game lines of 2022-23 were read by `tools/props.js`'s live constants (fitted on 2023-2026), its 2024 fold (fitted on
  2023), props_v2's candidate A and its validity check (2024 fold, and the naive spread fitted on 2023), the same-game
  table (`data/corr.json`, measured on 2023-2026) and the hub's game models (fitted or tested on them). This run's
  `data_inventory.js` read the 2022-23 box scores and team boxes for their shape only (header, rows, games, players,
  dates, which finals have a box, duplicates, starters a side) and counted games.csv's and odds_hist.csv's 2022-23 rows
  and their fields' fill; no minutes, stat, plus-minus, score, line or price of 2022-23 entered a figure.
- A 2022-23 fold fitted only on seasons before it needs box scores the hub does not have (2021-22 is its first season,
  and only warms the ratings up); ESPN has them (section 4). The first run's code had "a loader for 2020-21 box scores,
  a 2023 fold" (lessons.md), most likely for this. Freezing a candidate on 2023-24 to 2025-26 and running it on 2022-23
  is the other way; which is the preregistration's call. Either way nothing the candidate stands on may have been
  fitted on 2022-23, and everything `tools/props.js` has fitted was (its live constants on 2022-23 to 2025-26, each of
  `research/props.json`'s folds on seasons from 2022-23), as were props_v2's A and `data/corr.json` (section 6).

## 3. Every source on disk

### Box scores and team boxes

`data/box_<season>.csv`, from 2021-22 on, one row a player a game, ESPN's game summaries read by `tools/fetch_box.js`:
`game_id, date, team, opp, home, player_id, name, pos, starter, min, fgm, fga, tpm, tpa, ftm, fta, orb, drb, ast, stl,
blk, tov, pf, pm, pts, dnp`. That is whole minutes, a starter flag, plus-minus (`pm`) and a did-not-play flag; **there is
no did-not-play reason** (ESPN's summary carries one from 2012-13 on, section 4, which the fetch does not keep). A box
lists who dressed; a player inactive for the game is on no row. `data/teambox_<season>.jsonl`, one line a team a game: 23
team statistics (turnovers with team turnovers, points in the paint, fast-break points, largest lead, technicals and so
on; 2025-26 adds lead changes and lead percentage part way through).

| Season | Finals with a box | Rows | Players | Sides with 5 starters | Consistency (development seasons only) |
|---|---|---|---|---|---|
| 2021-22 | 1,323 of 1,323 | 33,857 | 623 | all | 28,051 played rows, 5,806 did-not-play (none with minutes), 109 played with 0 minutes; side minutes 240 at the median (238 to 266, 1st to 99th percentile), 59 games past regulation; points equal the final and plus-minus sums to 5 x the margin in every game |
| 2022-23 (test season) | 1,320 of 1,320 | 34,033 | 549 | all | shape only |
| 2023-24 | 1,314 of 1,319 (the 5 with no ESPN id) | 34,871 | 589 | all | 28,260 played, 6,611 did-not-play, 268 played with 0 minutes, 61 past regulation; every game's points and plus-minus balance |
| 2024-25 | 1,320 of 1,321 (1 with no ESPN id) | 35,170 | 580 | all | 28,322 played, 6,848 did-not-play, 193 played with 0 minutes, 66 past regulation; every game balances |
| 2025-26 | 1,322 of 1,322 | 34,810 | 592 | all | 28,738 played, 6,072 did-not-play, 157 played with 0 minutes, 60 past regulation; 43 rows with no player id (one Chicago player ESPN gives no athlete id), and 12 Chicago games whose box points fall 2 to 9 short of the final (a Chicago player missing from the box); plus-minus balances in 98.3% |
| 2026-27 (in play, to 10 November) | 160 of 160 | 4,304 | 483 | all | shape only |

Rows a side: 13 at the median (10 to 18). No duplicate rows. The team boxes cover the same finals.

### Game lines

`data/odds_hist.csv`: the closing game lines on the 2022-23 to 2025-26 finals, from ESPN's game summaries and core feed
(`tools/fetch_odds_hist.js`, a finished backfill), one row a game: the provider, both moneylines, the home line, the total,
and the openers where carried.

| Season | Rows (finals covered) | Provider | Openers |
|---|---|---|---|
| 2022-23 | 1,320 (all) | "consensus" on every game | none |
| 2023-24 | 1,314 (all with an ESPN id) | DraftKings 1,250, ESPN BET 64 | most |
| 2024-25 | 1,320 (all with an ESPN id) | ESPN BET | all |
| 2025-26 | 1,318 of 1,322 | DraftKings 1,061, ESPN BET 257 | all |

`data/games.csv` carries game lines, totals, moneylines and tip times only from 2026-27 (the job's); for earlier games the
lines are odds_hist's and a 2023-24 game's scheduled start is the provider-40 fetch's.

### Player-prop lines on disk

| File | What | Rows, games, dates |
|---|---|---|
| `data/props_2026.csv` (+ `data/props_reads.json`) | DraftKings' closing main lines of the 2026 play-in and playoffs (provider 100), all eleven stats, read 15 October 2026 | 11,697 rows on 83 games (2 play-in, 81 playoff; 8 answered none), 17 April to 13 June 2026, 173 players |
| `research/props_v2/cache/props40_2024.csv` (gitignored; `cache/dk40_2024_lines.csv` without the stamp) | DraftKings' 2023-24 lines, provider 40, six base stats (section 1) | 94,485 rows on 1,142 games |
| `data/props_2027.csv` (+ the 2027 reads) | The job's record of 2026-27's closing main lines, read after each final | 17,073 rows on 160 games, 20 October to 10 November 2026 (counted only) |
| `data/props_shadow.json`, `data/props_shadow_lines.csv` | The props model's shadow ledger: bar registered 2026-10-15T11:35Z, stopped early as a FAIL at 2026-11-05T19:16Z on 12,298 lines of 121 games | 12,298 graded rows (counted only) |
| `lines.json` (the job's) | DraftKings' game lines and every player prop for the next two dates with a game, as the job's last run read them | today's state |

### Availability, rosters, coaches, priors

| File | What | Span |
|---|---|---|
| `data/injuries_log.csv` | ESPN's injury report, one line a player a day: date, team, player, status | **2026-09-20 to 2026-11-11** (52 days, 4,700 rows, 370 players; Day-To-Day 2,641, Out 2,058, Suspension 1). Nothing earlier |
| `data/injuries.json` | Today's report (status, detail, expected return) | 2026-11-11 |
| `data/rosters_espn.json` | Each team's roster as ESPN lists it today | 2026-11-11 (520 players). No past season's roster is kept; who was on a team then is read from its box scores |
| `data/coaches.csv`, `data/coaches_espn.json` | Head coach by team and season, hand-kept with mid-season changes dated (1 to 4 a season); and today's | 2021-22 to 2026-27 |
| `data/raptor.csv` | FiveThirtyEight's RAPTOR, offence and defence a player (its lines end `\r\n`) | 2019-20 to 2021-22 |
| `data/predictions.csv` | The game numbers the site published before each 2026-27 game | 20 October to 3 December 2026 |

### The rest

`data/corr.json` (the same-game correlation table, measured on 2022-23 to 2025-26 box scores), `data/calls.json`,
`data/suggest_ledger.json` and `data/sample_summary.json` (one ESPN summary of a 2021-22 game, kept for its shape) are no
props source. The job's root files (`state.json`, `props.json`, `players.json`, `model.json`, `history.json`,
`pickem.json`, `lines.json`) are today's state of the site; `research.json` and `research/*.json` are earlier studies'
results. `results/data_inventory.json` lists each file with its size and SHA-256.

## 4. What can be fetched, and how far back

### DraftKings' player props on ESPN's feed

From props_v2's coverage (5 November 2026, one game in four but where said) and this fetch:

| Season | Provider | What is served | Status here |
|---|---|---|---|
| 2021-22 | 40 | Nothing in the regular season (0 of 309 sampled; and 373 games asked by the stray fetch, all 404); the late playoffs, 2 of 22 sampled (May and June 2022) | fetchable, not fetched |
| 2022-23 | 40 | 303 of 309 sampled regular-season games, 20 of 21 sampled playoff games; still served on 12 November (the probe) | **the one-shot test**: not fetched |
| 2023-24 | 40 | 1,116 of 1,226 regular-season games, all 6 play-in games, 20 playoff games to 26 April 2024, none after | fetched (section 1) |
| 2024-25 | 58 (ESPN BET) | Alternate lines with no side field, several at one number, stamped after the start: `propParse` pairs 10 to 13 a game | not usable without a study of its own |
| 2025-26 | 100 | 18 regular-season games with any items (12 in January 2026; props_v2 counted 11 complete, 14 and 15 January), 2 play-in and 81 playoff games (the archive) | the 11 never fetched or scored; too few to test anything |
| 2026-27 | 100 | every game so far: the job reads them | the season in play |

### ESPN's box scores, back to 1993-94

`espn_depth.js` read four games a season (two finals on each of two regular-season dates), 1992-93 to 2023-24 but 2022-23,
183 requests, keeping only each summary's shape. games.csv has no ESPN id before 2021-22, so an older game's id comes off
the day's scoreboard. A sample of four games a season shows what a season carries, not that every game has it.

| Seasons | Box | Minutes | Did-not-play flag and reason | Plus-minus | Play-by-play |
|---|---|---|---|---|---|
| 1992-93 | none (one game found, with no box) | | | | |
| 1993-94 to 2003-04 | yes, 5 starters a side; one game of four had no box in 1998-99 and in 1999-2000 | whole minutes on every player who played | flagged, no reason | 0 for everyone (not kept) | from 2002-03 (2 of 4 in 2001-02) |
| 2004-05 to 2007-08 | yes | whole, but `--` on some players not flagged (3 to 23 of about 100 rows) | flagged, no reason | 0 for everyone | yes |
| 2008-09 to 2011-12 | yes | `--` on 28 to 31 rows: the players who did not play, no longer flagged | **not flagged** | real, from 2008-09 | yes |
| 2012-13, 2013-14 | yes | complete | flagged, **every one with a reason** ("COACH'S DECISION", an injury) | real | yes |
| 2014-15, 2015-16 | yes | **2 of 4 and 1 of 4 games with no minutes for anyone** (and no plus-minus) | flagged with reasons | real where there | yes |
| 2016-17 to 2021-22, and 2023-24 | yes | complete | flagged with reasons ("COACH'S DECISION", "REST", an injury such as "SORE LEFT KNEE") | real | yes |

Also in the summaries: the officials (nearly every game from 1993-94), team statistics (22 or 23 a team, in every sampled
game but 2 of 2014-15's four and 1 of 2015-16's), a pickcenter of game lines in every sampled game of 2012-13 to 2021-22
and none of 2023-24's (as `tools/fetch_odds_hist.js` notes, which took 2023-24's lines from the core feed). And an
injuries block that is **today's list**: in every sampled season its entries are dated July to November 2026, so it says
nothing about who was out then.

How to fetch more: `tools/fetch_box.js`'s `parseSummary` reads a summary into the hub's columns, but its run is not for
research: for a season with no ESPN ids it writes the ids it finds into `data/games.csv` itself (whatever
`NBA_DATA_DIR` says), and it then writes today's injury report, coaches and rosters into its data folder. A research fetch
loops on its own (a day's scoreboard, then each game's summary: about 1,400 requests a season), into
`research/props_v3/cache/`, and before 2016-17 reads `--` minutes as did-not-play, a plus-minus of 0 before 2008-09 as
missing, and a game with no minutes as unusable for minutes.

### What is not to be had

- **A pre-game injury report for any past season.** None on disk before 20 September 2026; ESPN's summaries carry only
  today's. Who was out for a past game is known after it: whether he is on the box, flagged did-not-play, and (from 2012-13)
  why. Live, the job has the report; a backtest does not, so a backtest's availability is always hindsight or none.
- **Past rosters as listed**: read them from the box scores.
- **Other books' or paid histories**: props_v2's `data.md` section 2 (The Odds API's history is paid; DunkAPI,
  OddsPapi, SportsGameOdds and BALLDONTLIE need accounts; nothing free and licensed).

## 5. The traps

- **`last_updated` (section 1)**: an outcome in the lines' own file.
- **The game's own box is hindsight.** Who dressed, who started, the minutes and the did-not-play reasons are written
  after the game. By tip-off, when the lines close, the starters and the inactive list are known, but a live call is made
  by the job's last run before tip-off, which can be hours before it; a backtest that reads the game's own list of who
  dressed (as props_v2's A did) knows more than a live call can.
- **Voids are an outcome.** Which lines go void (the player did not play) is known after the game. Anything built from
  the graded lines only (the first run's night factor, lesson L4) leaks who played; an aggregate of a night's or a game's
  lines must be built from every line posted.
- **Overtime is an outcome**, and moves the result: on 2023-24's lines, games past regulation went Over 52.2% where
  DraftKings said 44.0%.
- **Minutes of 0 that are not did-not-play**: 109 to 268 rows a season, players in for under half a minute. The hub voids
  their lines; DraftKings grades them (9 lines of 2023-24's window).
- **2025-26's Chicago rows** (43 with no player id; 12 games short 2 to 9 points), and **6 finals with no box** (5 of
  2023-24, 1 of 2024-25, no ESPN id).
- **games.csv types the play-in as REG** (from mid-April), and the in-season tournament final too.
- **odds_hist's provider changes by season** (consensus, DraftKings, ESPN BET), and 2022-23 has no openers.
- **ESPN's older boxes** (section 4): plus-minus 0 before 2008-09, unflagged did-not-play 2008-09 to 2011-12, games
  without minutes in 2014-15 and 2015-16.
- **The summary's injuries block is today's**, never a historical report.
- **The 2023-24 fetch's file holds play-in and playoff rows** that props_v2's test's file did not: cut to the window
  (`validity.js` and `test2024.js` do) wherever the regular season is meant.

## 6. What the rules allow each source for

| Source | Seasons | Allowed for |
|---|---|---|
| Box scores and team boxes (`data/box_*`, `data/teambox_*`) | 2021-22, 2023-24, 2024-25, 2025-26 | development |
| | 2022-23 | the test season: the history a frozen candidate reads before each test game and the outcomes the Test step grades; nothing fitted, re-scaled or chosen on them; already read by the earlier fits listed in section 2 |
| | 2026-27 | forward shadow only, from a frozen candidate's freeze time on |
| ESPN box scores before 2021-22 (fetchable, section 4) | 1993-94 to 2020-21 | development history, into a gitignored cache |
| `data/games.csv` | to 2025-26 | development (2022-23's rows as the test season's, above) |
| | 2026-27 | forward shadow only |
| `data/odds_hist.csv` (game lines) | 2023-24 to 2025-26 | development |
| | 2022-23 | the test season: a pre-game input a frozen candidate may read; never fitted on |
| DraftKings' 2023-24 lines, provider 40 (`research/props_v2/cache/props40_2024.csv`, `cache/dk40_2024_lines.csv`) | 2023-24 | **development data for a new candidate**: scored once, against props_v2's A on 6 November 2026 (FAIL), so they test nothing now. Never `last_updated` |
| DraftKings' 2022-23 regular-season lines, provider 40 | 2022-23 | **the one-shot test**: never fetched, read or printed before the preregistration is committed, pushed and audited sound; the Test step alone fetches them (the same recipe, the gitignored cache) and strips `last_updated` |
| DraftKings' 2023 playoff lines, provider 40 | 2022-23 | not fetched: no 2022-23 line before the preregistration; whether the Test step uses them, or they stay unseen, is the preregistration's call |
| DraftKings' 2022 late playoff lines, provider 40 | 2021-22 | development (fetchable; a few games) |
| `data/props_2026.csv` (the 2026 play-in and playoff archive) | 2025-26 | **spent**: development only, never a test |
| DraftKings' 11 complete 2025-26 regular-season games, provider 100 | 2025-26 | development (fetchable; never fetched or scored; too few to test anything) |
| Provider 58 (ESPN BET), 2024-25 | 2024-25 | not usable as served |
| `data/props_2027.csv`, the 2027 reads, `data/props_shadow*`, `lines.json`, `props.json`, `data/predictions.csv` | 2026-27 | **forward shadow only**: never used to fit, tune, choose or score a candidate |
| `data/injuries_log.csv`, `data/injuries.json`, `data/rosters_espn.json`, `data/coaches_espn.json` | 2026-27 (from 2026-09-20) | forward shadow only (a live input) |
| `data/coaches.csv` | 2021-22 to 2025-26 | development (2022-23 as the test season's) |
| | 2026-27 | forward shadow only |
| `data/raptor.csv` | 2019-20 to 2021-22 | development |
| `data/corr.json` | measured on 2022-23 to 2025-26 | development; not for a candidate tested on 2022-23 as it stands (below) |
| Anything an earlier model fitted: `tools/props.js`'s live constants (2022-23 to 2025-26) and `research/props.json`'s 2024 to 2026 folds (each fitted on seasons from 2022-23), props_v2's A (its folds and its frozen constants), `data/corr.json` | include 2022-23 | development; a candidate tested on 2022-23 may not stand on them, since each carries 2022-23's outcomes: such a piece is fitted again without 2022-23 (on seasons before it, fetched, or on 2023-24 to 2025-26) |

## Re-running

From the repository's root (no package needed):

| Command | What | Time |
|---|---|---|
| `bash research/props_v3/fetch_dk40_logged.sh 2023-10-24 2024-04-30` | the fetch, logged (refuses 2022-23) | about 11 minutes |
| `node research/props_v3/fetch_check.js --write-window`, then `node research/props_v2/validity.js --lines research/props_v3/cache/props40_2024_window/props40_2024.csv --season 2024` | the window's bytes, then props_v2's validity check on them | seconds, then 20 s |
| `node research/props_v2/validity.js --lines research/props_v2/cache/props40_2024.csv --season 2024` | the same check on the whole file | 20 s |
| `node research/props_v3/fetch_check.js` | the fetch counted and checked | seconds |
| `node research/props_v3/lines_clean.js` | the lines without `last_updated`, and the starts | seconds |
| `node research/props_v3/espn_depth.js` | ESPN's box scores by season (183 requests) | about 2 minutes |
| `node research/props_v3/data_inventory.js` | every file on disk | a second |

`probe_dk40_2023.js` has been run and refuses to run again. Nothing in `cache/` (the logs, the window's copy, the clean
lines) or in `research/props_v2/cache/` is committed; the SHA-256s above let a later step check it reads the same bytes.
