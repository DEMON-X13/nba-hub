# What a second props model could be built and tested on

Research only, 5 November 2026. Nothing here is fitted, chosen or scored on the 2026-27 season. The one model scored is the
walk-forward's 2026 fold (constants fitted on 2023-2025, read from `research/props.json`), on the 2026 play-in and playoff
archive, which the README's market test already scored; it is used only to measure how much a test there can tell. No
candidate is scored anywhere in this note. `data/props_2027.csv` is counted (rows, games, stats) and nothing more.

**The headline: ESPN's feed keeps far more than the README says.** DraftKings' player props for about 2,340 regular-season
games of 2022-23 and 2023-24, and about 100 playoff games from 2022 to April 2024, are still on ESPN's free feed under
DraftKings' older provider id, **40** (the README's "ESPN keeps no regular-season lines" holds only for provider 100 in
2025-26). They are main-line pairs on the six base stats, read by the hub's own `propParse`. That they are pre-game prices is
inferred, not shown (below), so a test on them first checks it (README, "The validity check"). That is about 180,000 gradable regular-season lines: sixteen times the 2026 archive, in the regime the trial
runs in, and never yet scored by any model. Backfilling them is the owner's call (they are third-party prices on an
unlicensed feed, the same one `data/props_2026.csv` came from). Without them, a second model can be fitted only lightly
inside the 2026 archive, and its 90% interval can tell a difference from DraftKings only once that difference is about 0.01
log loss.

Scripts and outputs, all in `research/props_v2/`:

| File | What |
|---|---|
| `data_describe.js` → `results/data_describe.json` | The 2026 archive described; the dispersion of score differences, clustered; the flat bets' error; the cross-validation folds |
| `espn_probe.sh` → `results/espn_probe.tsv` | 18 games across five seasons: every provider ESPN lists, plus 100 and 58, one `limit=1` request each (status and count only) |
| `espn_shape.js` → `results/espn_shape.json` | 11 (game, provider) answers read whole in memory: market types, `propParse` counts, Over orientation (counts only) |
| `espn_coverage.js` (`--early`) → `results/espn_coverage*.{tsv,json}` | Which past games answer for DraftKings: every 2025-26 game (provider 100), one in four of 2020-21 to 2024-25 (providers 40 and 100) |
| `espn_validate40.js` → `results/espn_validate40.json` | 85 provider-40 games read whole in memory: lines a game, players on the box, margins, orientation, whether pre-game |
| `fetch_dk40.js` | How to fetch provider 40 into the record's columns (and each line's `lastUpdated`, and the event's start), into `cache/` (gitignored). Not run on the real feed. Its first version was tried with `--dry` on one day, which then still downloaded that day's answers (only the write was skipped) |
| `fetch_dk40_test.js` → `results/fetch_dk40_test.json` | The recipe on a local fake of the feed, no network: `--dry` requests nothing; a range run again, or two that overlap, repeat no line |
| `validity.js` → `results/validity_ref.json` | The validity check a test on these lines must pass before its bar (README), and its references on the 2026 archive (DraftKings and the box scores only) |

No price or line from ESPN or anyone else is saved or committed by any of these. The results hold game ids, counts and
DraftKings' own aggregate scores only.

## 1. `data/props_2026.csv`, precisely

**What it is.** DraftKings' closing main lines as ESPN served them on 15 October 2026 (`node tools/props_record.js --backfill
2026-04-14 2026-06-30`, one read at 08:16Z), one row a game, player and stat: `game_id, player_id, stat, line, over, under`
(American prices, the Over first). It has 11,697 rows, no duplicate game-player-stat, and every line a half point, so there
are no pushes.

**Games.** 91 games were asked for and 83 answered (`data/props_reads.json`); the other 8 answered 404. The 83 run from 17
April to 13 June 2026 and involve 18 clubs. Rounds and series come from the box scores' team pairs (a POST game's series is
its two clubs, its round the clubs' how-many-th series); games.csv types the play-in as REG, from 14 April, after the
regular season ended on 12 April.

| Round | Scheduled | Read | Series | Rows | Dates |
|---|---|---|---|---|---|
| Play-in | 6 | 2 (the 17 April pair: CHA at ORL, GSW at PHX) | 6 single games | 288 | 17 Apr |
| First round | 48 | 47 (missing DEN-MIN 30 Apr) | 8 | 6,211 | 18 Apr - 3 May |
| Second round | 21 | 19 (missing CLE-DET 7 and 13 May) | 4 | 2,690 | 4 - 17 May |
| Conference finals | 11 | 10 (missing NYK at CLE 23 May) | 2 | 1,664 | 18 - 30 May |
| Finals | 5 | 5 | 1 (NYK-SAS) | 844 | 3 - 13 Jun |

**Lines.** A game has 74 to 186 rows (median 138, mean 140.9). Graded on the box scores as `tools/props.js` grades them,
11,395 lines are on players who played. 302 are void: 222 on players the box does not list, 80 on players listed who did
not play. Every player who played has a projection, so none is "no call". Overs went in 45.9% where DraftKings' fair chance
(the whole margin on the Over) said 45.6%. The margin (the two implied chances summed, less 1) is 6.8% at the median (6.1% to
7.0%, 10th to 90th percentile; 6.05% on points, about 6.8% elsewhere). The Over is the favourite on 46% of lines, and prices
run from -10000 to +6600.

| Stat | Rows | Players | Line min / median / max | Graded | Over went in | DraftKings' fair Over |
|---|---|---|---|---|---|---|
| Points | 1,369 | 172 | 0.5 / 11.5 / 31.5 | 1,328 | 45.8% | 46.9% |
| Rebounds | 1,270 | 166 | 0.5 / 4.5 / 14.5 | 1,234 | 49.7% | 46.3% |
| Assists | 1,122 | 155 | 0.5 / 2.5 / 10.5 | 1,094 | 45.1% | 46.2% |
| Threes | 1,112 | 155 | 0.5 / 1.5 / 4.5 | 1,079 | 46.2% | 44.9% |
| Steals | 907 | 130 | 0.5 / 0.5 / 2.5 | 888 | 48.1% | 46.8% |
| Blocks | 810 | 123 | 0.5 / 0.5 / 4.5 | 795 | 38.9% | 37.9% |
| Pts+reb+ast | 1,142 | 159 | 3.5 / 20.5 / 55.5 | 1,113 | 45.4% | 46.6% |
| Pts+reb | 1,237 | 164 | 3.5 / 17.5 / 44.5 | 1,204 | 45.1% | 46.5% |
| Pts+ast | 1,058 | 150 | 3.5 / 15.5 / 40.5 | 1,029 | 45.0% | 46.6% |
| Ast+reb | 1,070 | 150 | 2.5 / 8.5 / 24.5 | 1,041 | 47.8% | 46.1% |
| Stl+blk | 600 | 107 | 1.5 / 1.5 / 5.5 | 590 | 46.8% | 43.8% |

**Players.** There are 173 players and 1,374 player-games (16.6 a game). A player-game carries 1 to 11 lines (median 10,
mean 8.5). A player has a median of 53 lines over 7 games (at most 244 lines, 23 games); 22 players appear in one game, and
the ten most-lined players hold 18.5% of the lines. Of the graded lines, 73.6% are on starters, at 31 minutes played at the
median (16 to 40, 10th to 90th percentile).

**How it differs from the trial's season** (counts only). `data/props_2027.csv` has 12,856 rows on 121 games: 106 a game
and 14.8 players a game, against 141 and 16.6 here. Its mix leans to points and the combos: steals are 4.6% of rows against
7.8% here, blocks 2.6% against 6.9%, steals + blocks 1.4% against 5.1%, points 13.9% against 11.7%. It is the regular
season, every club and fuller benches. The archive is 18 playoff clubs, shortened rotations and repeated opponents. The
trial's own diagnosis (the brief) has the model high on the Over in the regular season and low in the playoffs, so a
correction fitted on this archive could push the wrong way in the trial's regime.

**What has been seen.** The archive is not untouched. The README publishes its overall and by-stat scores against the
current model and the flat bets at three bars, and the trial diagnosis reads it. A candidate designed in answer to those
findings (points worst, Overs low, Unders up) is not cleanly tested on these lines.

### Fitting and testing inside it

The unit of independence is the game, not the line. Lines of one player-game move together: the correlation of (result
minus DraftKings' fair chance) between two lines of one player-game is 0.28 overall, 0.74 between points and pts+reb+ast,
0.22 between points and rebounds, and 0.04 between steals and blocks. The standard error of the model's log-loss difference
grows with the cluster: 0.0018 treating lines as independent, 0.0034 by player-game, 0.0038 by player, 0.0040 by game and
0.0043 by series. By round it reads 0.0032, but with 5 clusters that is not a usable estimate. A player's run within a series
leaves no trace once DraftKings is taken out: his points residuals across games of one series correlate at -0.02. So the
game is the right resampling unit (as `bootCI` and the bar already use), and the series only a little more conservative.

Folds the archive allows:

- **Leave one round out**: 5 folds of very unequal size (graded lines and games: play-in 270 / 2, first round 6,025 / 47,
  second round 2,650 / 19, conference finals 1,606 / 10, finals 844 / 5). The first round is 53% of the data. It does not
  hold players out: 99% or more of the lines from the second round on are on players with lines in another round (61% of
  the first round's, 48% of the play-in's).
- **Leave one series out**: 17 groups (15 series and the two play-in games), 134 to 1,166 graded lines each. This is the
  natural grouped cross-validation. A candidate with per-player terms still borrows a player's other series, so those terms
  must be fitted inside the training folds only, and backward in time where a later series trains an earlier one.
- **Forward in time** (fit on the rounds before, test on the next): only 34 games are ever tested (5,100 lines). Its
  standard error is about 0.0063, so its 80%-power threshold is about 0.016 log loss: it can tell almost nothing.
- **By game** (k-fold over the 83 games): legitimate for parameters shared across players, and leaky for anything per
  player within a series.

What fits inside it honestly is a handful of shared, market-relative parameters: a blend weight between the model and
DraftKings' fair chance, a per-side or per-stat-group shrink, a calibration slope. Each is chosen by leave-one-series-out
log loss, with the whole rule written down before the archive is read for it. Anything with per-player or per-stat freedom
(11 stats x several terms) is far beyond about 83 independent games.

### How much power

The size of a true log-loss difference (candidate minus DraftKings' fair chance) whose 90% interval lands wholly on one side
of 0, from the archive's own per-game spread (`results/data_describe.json` `power`). "50%" means half the time (1.645
standard errors) and "80%" means four times in five (2.487 standard errors).

| Candidate (archive, 83 games) | SE by game | 50% | 80% | Brier SE, 80% |
|---|---|---|---|---|
| The walk-forward model (published: +0.0147 [+0.0083, +0.0214], reproduced) | 0.0040 | 0.0066 | 0.0099 | 0.0018, 0.0045 |
| A blend moved half the way from DraftKings to the model, in logit (spread only) | 0.0019 | 0.0031 | 0.0047 | 0.0009, 0.0022 |
| The same, a quarter of the way (spread only) | 0.0009 | 0.0015 | 0.0022 | 0.0004, 0.0010 |
| The same, a tenth of the way (spread only) | 0.0004 | 0.0007 | 0.0010 | 0.0002, 0.0005 |
| Two box-score models a little apart (every mean x 1.03), one against the other | 0.0009 | 0.0015 | 0.0022 | 0.0004, 0.0010 |

The blends' mean differences were deliberately not computed for this note: a blend is a candidate. The spread scales almost
linearly with how far a candidate moves from DraftKings, so a market-anchored candidate is measured more finely, but it can
also gain only a little. Two box-score models compared with each other are measured four times as finely as either against
DraftKings, which is how a second model should be chosen against the first.

Scaled by games (the archive's per-game spread, and the trial's published interval, 121 games: SE 0.0029 log loss and 0.0014
Brier), the 80% threshold for a model as far from DraftKings as the current one:

| Games | Log loss (archive / trial scaling) | Brier (archive / trial) |
|---|---|---|
| 83 | 0.0099 / 0.0089 | 0.0045 / 0.0041 |
| 121 | 0.0082 / 0.0073 | 0.0037 / 0.0034 |
| 250 (about the bar's 30,000 lines) | 0.0057 / 0.0051 | 0.0026 / 0.0024 |
| 600 | 0.0037 / 0.0033 | 0.0017 / 0.0015 |
| 1,230 (a regular season) | 0.0026 / 0.0023 | 0.0012 / 0.0011 |

On the six base stats alone (what provider 40 carries) the design effect is smaller: SE 0.0029 by game on the archive's 6,418
base-stat lines. A season of provider-40 lines (about 1,000 games, 80,000 lines) has an 80% threshold of about 0.0021, and
both seasons (about 2,340 games, 180,000 lines) about 0.0014.

**The flat bets** (the bar's third test, "up" with no interval). The model's 3-point bets on the archive were 5,238 bets,
+28.8 units (+0.55%). A bet's result has a spread of 0.95 units. The return's standard error is 2.26% by game against 1.32%
if bets were independent (a design effect of 3.0). At their prices, these bets would return -2.4% if their chance were
exactly DraftKings' fair chance, so a model with no edge is still "up" over 6,000 bets about one time in eight. The bets
test adds little beyond the two intervals; it guards against a model that scores well but bets the wrong lines.

## 2. Free historical player-prop lines elsewhere

Searched on 5 November 2026: Kaggle's dataset API (no account needed to search; about 20 queries), Hugging Face's dataset
search, GitHub repository search and READMEs, the web, and the vendors' own pages. **Nothing found is both free of an
account and openly licensed for NBA player-prop prices from past regular seasons.** The one free source with the depth needed
is ESPN's own feed (section 3).

| Source | NBA player props held | Books | Licence and access | Verdict |
|---|---|---|---|---|
| ESPN's feed, provider 40 | 2022 conference finals to 26 April 2024: about 98% of 2022-23's regular season, 91% of 2023-24's, about 80 games of the 2023 playoffs, the first week of the 2024 playoffs | DraftKings | No published licence; the unofficial feed the hub already reads with the owner's go-ahead; no account. `fetch_dk40.js` | **The lead.** Section 3 |
| [The Odds API](https://the-odds-api.com/historical-odds-data/) | Player props from 3 May 2023, 5-minute snapshots | Many, DraftKings among them | "Historical data is only available on paid usage plans" | Out: paid |
| [DunkAPI](https://dunkapi.com/data/player-props) ([repo](https://github.com/noahowsh/dunkapi-mcp), MIT for its code) | From May 2023 (2023 about 3%), 2024 to 2026 seasons in full; points, rebounds, assists, threes, pra, blocks, steals | DraftKings, FanDuel, BetMGM, ESPN BET, Pinnacle and others | Account and key; 500 free credits a month; 20 credits a played game, so 26,420 a season (about one month of its $49 plan); data terms not stated; "closing" before October 2026 is usually a single capture near the start | Out: account, paid at scale, no grant to keep or redistribute. The only source found that claims DraftKings for 2024-25 and 2025-26 |
| [OddsPapi](https://oddspapi.io/blog/?p=2877) | Historical odds endpoint "works for player prop markets"; depth not stated | Up to 3 books a call | "Historical data is included on the free tier", behind a key (account); terms not read | Out: account; depth unverified |
| [SportsGameOdds](https://sportsgameodds.com/nba-odds-api) | Line movement; past props not stated | Many | Free key tier (account) | Out: account, unverified |
| [BALLDONTLIE](https://www.balldontlie.io/) | "Live odds and player props"; history for props not stated | Not named | Tiers $0 to $299.99 a month; props tier not stated | Out: account, unverified |
| PropLine ([HF sample](https://huggingface.co/datasets/propline/graded-player-props-sample), CC BY 4.0) | The free sample is 14 days of MLB and NFL only; NBA history is in its paid tiers | 25+ | The sample is open; the rest is paid | Out: no NBA in the free part |
| [Polymarket sample](https://huggingface.co/datasets/Karmane/polymarket-sports-lines-and-player-props-sample) (CC BY 4.0) | 575-row preview of a paid 11,509-row set | Polymarket | Full set sold | Out |
| Kalshi public API (`api.elections.kalshi.com/trade-api/v2/historical/markets`, no key) | NBA player ladders (`KXNBAPTS` "40+ points", assists, threes, PRA) settled in the 2026 playoffs (the newest 1,000 settled points markets close 12 May to 14 June 2026; when they began was not established, and NBA props were reported as launched in October 2026) | Kalshi (an exchange) | Public, no account; Kalshi's terms, not an open licence | A second market from the 2026 playoffs on, ladders only, no past regular season. Not a substitute for DraftKings |
| BettingPros (the source of [seantanger/nba-props-research](https://github.com/seantanger/nba-props-research)'s backtests) | Several seasons | Several | Not distributed ("not included, and neither is a downloader") | Out: terms |
| Kaggle | No NBA player-prop price dataset found. Game lines only: e.g. cviaxmiwnptr/nba-betting-data-october-2007-to-june-2024 (CC0), the minmaxer closing-line sets (CC BY 4.0), erichqiu/nba-odds-and-scores (CC0) | | | Nothing for props |
| GitHub hobby projects (about 35 listed, 12 READMEs read) | Scrapers and models; the data, where any, is unlicensed (all rights reserved) and scraped from books, PrizePicks or Underdog (pick'em lines, no prices), or made up (RayKang8/propsbasket trains on "simulated prop lines") | | | Nothing usable |
| SportsbookReviewsOnline, sportsoddshistory.com | Game lines and season-long futures, no player props | | | Nothing for props |

## 3. What ESPN's feed keeps

`sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/<E>/competitions/<E>/odds/<provider>/propBets`, probed on
5 November 2026 (`espn_probe.sh`, `espn_coverage.js`). ESPN's odds list names a different set of providers in different
years, and the props sit under the provider that priced them:

| Seasons | Providers listed for a game | Player props on the feed |
|---|---|---|
| 2020-21 | none (games.csv has no ESPN ids for it) | not probed |
| 2021-22 (one game in four) | | None in the regular season; provider 40 from the late playoffs (1 of 10 May games sampled, the 1 June game) |
| 2022-23 | 17 providers, among them **40 DraftKings**, 41 SugarHouse, 45 Caesars NJ, 47 MGM, 48 PointsBet and 58 ESPN BET | **Provider 40: 303 of 309 sampled regular-season games (98%), 20 of 21 playoff games.** 41, 45, 47 and 48 answer for a 2023 playoff game too |
| 2023-24 | the same list, then only 58 and 59 (ESPN BET) | **Provider 40: 281 of 308 sampled (91%; January 2024 37 of 57), the playoffs to about 26 April 2024 (5 of 21 sampled), none after.** 58 holds clean pairs for an April 2024 playoff game |
| 2024-25 | 58 ESPN BET, 59 ESPN BET live | Provider 58 answers with 1,600-1,800 items a game, but its items are alternate lines with no side field, several at one number, stamped hours after the start: `propParse` pairs 10 to 13 a game. Not usable without a study of its own |
| 2025-26 | 58 and 59 in October, then 100 DraftKings | Provider 58 in October (the same loose shape). **Provider 100: 11 complete regular-season games, 14 and 15 January 2026** (a further 7 answer with 1 to 6 items); 2 of 6 play-in games; 81 of 85 playoff games (the archive). So "none of 2025-26" was right but for those 11 |
| 2026-27 | 100 | Every game read so far (the trial's record; opening night still answers) |

The 2026 playoff answers are still served on 5 November 2026, so the feed keeps them at least five months.

**Provider 40 checked** (`espn_validate40.js`: 85 games, every tenth answering regular-season game of each season and every
answering playoff game; 6,527 graded lines; DraftKings' own scores only, no model).

- **Shape.** About 180 to 200 items a game. Main lines come as pairs on points, rebounds, assists, threes, steals and blocks
  (`propParse` drops nothing), about 80 a game (fewer in October 2022), plus turnovers, which the hub does not model. There
  are no combos, no ladders and no double-doubles. ESPN's athlete ids match the box scores: 94% to 97% of lines are on
  players who played, 1% to 2% on players listed who did not, and the rest (1% to 5%) on players not on the box, which are
  void as in the archive.
- **The first item is the Over.** DraftKings' fair chance scores 0.639 / 0.650 / 0.659 / 0.651 log loss (2022-23 regular
  season / 2023 playoffs / 2023-24 regular season / 2024 playoffs) reading the first item as the Over, and 0.815 / 0.797 /
  0.771 / 0.782 reading it as the Under, on every stat.
- **Pre-game prices? Inferred, not shown.** By stat, points and rebounds score as the 2026 archive does (points
  0.675-0.694 against 0.688, rebounds 0.678-0.690 against 0.693). Threes and blocks score lower: threes 0.609-0.676
  against 0.665, blocks 0.546-0.628 against 0.635; on 2023-24's 29 sampled regular-season games, 0.647 and 0.606, and on
  2022-23's 31, 0.609 and 0.590 (its 2023 playoff blocks 0.546). In 2022-23 those stats' prices are more lopsided (the
  share of fair chances between 40% and 60%: threes 36% and blocks 12%, against the archive's 58% and 40%), which lowers
  the score of a pre-game price. That does not explain 2023-24's threes, which are less lopsided than the archive's
  (70%) and still score lower. A price taken during the game, knowing part of the result, would score lower too. The raw
  scores cannot tell the two apart, which is why the test's validity check (README) sets DraftKings against a forecaster
  that knows only the box scores before the game. Their lower overall figure is mostly the stat mix: a third of the
  lines are steals and blocks at 0.5, priced long.
- **Over rates, margins and stamps.** Overs went in 36% to 45% where the fair chance said 38% to 44%. The margin is 6.1%
  to 6.8% at the median (4.3% on the five 2024 playoff games). The items' `lastUpdated` reads about 5.4 hours after the
  scheduled start (provider 100's runs about three hours ahead of UTC while labelled Z, which would make this the game's
  end, when the market closed). A few games read 22 and 71 hours after. So the stamps cannot show that a price is
  pre-game, let alone the last before tip; that it is pre-game is what the scores suggest, and the test's validity check
  has to hold before its bar is read.
- **Size.** Scaled from the sample: about 1,210 games of 2022-23's regular season, 1,130 of 2023-24's, about 80 of the 2023
  playoffs, about 20 of the 2024 playoffs and a few of the late 2022 playoffs. At about 80 lines a game and 95% gradable,
  that is about 180,000 graded regular-season lines and about 8,500 playoff ones.

**How to fetch** (the owner's call): `node research/props_v2/fetch_dk40.js 2022-10-18 2023-06-12` and `... 2023-10-24
2024-04-30`. That is the event and one or two propBets pages a game, about 2,500 games in all, into
`research/props_v2/cache/props40_<season>.csv` in the record's columns and each line's `lastUpdated`, gitignored here.
A range run again, or two that overlap, repeats no line, and `--dry` requests nothing (`fetch_dk40_test.js`). `tools/props_record.js` reads provider 100 only; backfilling into `data/` as
`data/props_2026.csv` was would be a change of its own.

**What it would allow, and its limits.** `tools/props.js`' box scores start in 2021-22, which only warms the ratings up
(`FIRST`), so 2022-23 has no out-of-sample constants: its projections would use constants fitted on 2022-23 itself (a mild
leak, in a few dozen box-score constants, not in anything fitted to lines). 2023-24 is the first season with walk-forward
constants (the 2024 fold, fitted on 2022-23). So: develop a candidate's line-facing choices on 2022-23's lines, freeze it,
and test it once on 2023-24's regular-season lines with the 2024 fold's constants. Then check it once more, as a different
regime, on the 2026 playoff archive, and only then shadow it on games after the freeze. All of that sits inside the brief's
seasons. The same 2023-24 lines would give the current model its first regular-season market test (the 2024 fold, out of
sample). 2023-24 is also the fold the current model's structure was chosen on in box-score terms (never against lines), so
that test set's outcomes have been seen, though not its prices. They have been seen more since this note was written:
candidate A's selection folds were fitted on 2023-24's box scores among others, `diag_history.js` read its outcomes,
and C's rules were derived on its fold (README, "It is not a blind test"). Five limits come with it:

- The six base stats only: about 40% of the trial's lines are combos, which this set cannot test.
- DraftKings of 2022-24 may price differently from DraftKings of 2026-27.
- 2024-25 is a gap.
- The bar's power on it is fine: about 0.002 log loss a season.
- The trial's model was 0.015 to 0.018 behind DraftKings. A candidate needs to close nearly all of that to pass, and the data
  can tell whether it has.

## Sources

- [The Odds API, historical odds data](https://the-odds-api.com/historical-odds-data/)
- [DunkAPI player props data](https://dunkapi.com/data/player-props), [dunkapi-mcp](https://github.com/noahowsh/dunkapi-mcp), [mcpservers.org listing](https://mcpservers.org/servers/noahowsh/dunkapi-mcp)
- [OddsPapi player props guide](https://oddspapi.io/blog/?p=2877), [OddsPapi pricing](https://oddspapi.io/en/pricing)
- [SportsGameOdds NBA odds API](https://sportsgameodds.com/nba-odds-api)
- [BALLDONTLIE](https://www.balldontlie.io/)
- [PropLine graded player props sample](https://huggingface.co/datasets/propline/graded-player-props-sample), [PropLine on Capterra](https://www.capterra.com.au/software/1105139/PropLine)
- [Polymarket sports lines and player props sample](https://huggingface.co/datasets/Karmane/polymarket-sports-lines-and-player-props-sample)
- [Front Office Sports: Kalshi adds NBA prop markets](https://frontofficesports.com/kalshi-adds-nba-prop-markets-as-betting-crackdowns-surge/)
- [seantanger/nba-props-research](https://github.com/seantanger/nba-props-research), [RayKang8/propsbasket](https://github.com/RayKang8/propsbasket), [johnshun001/nba-props](https://github.com/johnshun001/nba-props)
- [SportsOddsHistory, about](https://www.sportsoddshistory.com/about-us), [bettingtools nba_data (SBR archives)](https://rdrr.io/github/pwu97/bettingtools/src/R/nba_data.R)
- Kaggle dataset API search (`www.kaggle.com/api/v1/datasets/list?search=...`), Hugging Face dataset API search (`huggingface.co/api/datasets?search=...`)
