# nba-hub

One repo, one scheduled job, one site. The job pulls last night's box scores and today's injury report,
replays a team model and a player, coach and matchup model, prices the slate, and commits the page.
GitHub Pages serves the repo root: `index.html` is the site, `admin.html` the same page with a Data tab.
The NBA has no weeks, so the unit is the slate, one Eastern calendar day. Ratings update after every
final, the job runs every morning, and the page will show today's and tomorrow's games.

## Layout

| Path | What |
|---|---|
| `data/games.csv` | Every game since the 2004-05 season, one row each: id, season (the year it ends), date, REG or POST, away, home, scores, neutral site, status, the home side's line and total when ESPN carried them, the source, the ESPN id |
| `data/box_<season>.csv` | From 2021-22 on, one row per player per game: minutes, the box line, starter and did-not-play flags |
| `data/teambox_<season>.jsonl` | One line per team per game with every team statistic the feed gives (turnovers including team turnovers, points in the paint, and so on) |
| `data/injuries.json`, `data/injuries_log.csv` | Today's injury report by team, and one line per player per day so availability can be replayed later |
| `data/coaches.csv`, `data/coaches_espn.json` | Head coach by team and season, hand-kept for 2022-2026 with mid-season changes dated; and what the roster feed lists today, which covers the current season |
| `data/rosters_espn.json` | Each team's roster as the feed lists it today, so offseason moves are known before a game is played |
| `data/raptor.csv` | FiveThirtyEight RAPTOR 2020-2022, offence and defence per player: the priors |
| `model.json` | The team model: fitted parameters, the fit and holdout report, every team's rating after the last final, and its number on each game not yet final |
| `players.json` | The player model: parameters, the report against the team model, every current player's offence and defence, every coach, each team's strength and pace, and tonight's numbers with lineups and absentees |
| `tools/lib.js` | The games table, team codes, dates, ESPN access |
| `tools/history.js` | One-time import of the history the team model is fitted on |
| `tools/fetch.js` | Daily pull of finals, the coming slate and its lines |
| `tools/fetch_box.js` | Daily pull of box scores, the injury report, the coaches and the rosters |
| `tools/elo.js` | The team model: replay, fit, report |
| `tools/players.js` | The player, coach and matchup model: replay, fit, report, tonight's lineups; logs the day's numbers to `data/predictions.csv` |
| `data/predictions.csv` | The number the site published on each game before it was played: the record is graded against this, never against a replay |
| `tools/publish.js` | Writes `state.json`, the one file the site loads: the slate, the record, teams, players, coaches, the backtest |
| `tools/props.js`, `props.json` | The props model (README "Player props"): each expected player's eleven stat distributions and double chances for the next five game days, its walk-forward and market tests (`research/props.json`) |
| `tools/props_feed.js` | DraftKings' player props as ESPN's feed carries them: the parse the job and the page share, the fair-chance rules |
| `tools/props_record.js`, `data/props_<season>.csv`, `data/props_reads.json` | DraftKings' closing main lines, read once after each final (2026: the play-in and playoffs ESPN still served) |
| `tools/props_ledger.js`, `tools/props_check.js`, `data/props_shadow.json`, `data/props_shadow_lines.csv` | The props shadow ledger: the model's call frozen at tip-off, graded against the closing lines, its pre-registered bar, and the check that holds it to the last commit |
| `app/nba_hub.html`, `tools/build.js` | The site, one file; `build.js` makes `index.html` (public) and `admin.html` (adds a Data tab with backup and restore) |
| `tools/smoke.js` | Loads the built viewer in jsdom with a fabricated game and checks the tabs, a pick, a parlay ticket and its grading, Refresh odds on a stubbed ESPN, and the player props view on a press (section 8, README "Player props") |
| `tools/test_props.js` | The props parse, record, model, ledger and bar on stubbed answers and a scratch folder |
| `tools/fixtures/` | ESPN answers recorded on 2026-10-15: scoreboards (finals, preseason lines, opening night's lines), which the smoke holds the page's reading of to `fetch.js`'s, and one game's DraftKings props (opening night, Celtics at Pistons), which `test_props.js` and the smoke hold the parse to; and that morning's rosters and injury report as the props model reads them (`props_live_20261015.json`), on which `test_props.js` holds the live minutes to the backtest's |

No dependencies for the job's tools: Node 22 and its built-in fetch. The smoke test needs jsdom (`npm ci` in `tools/`).

## Data

- **History**: Neil Paine's continuation of the FiveThirtyEight NBA Elo game file
  (`github.com/Neil-Paine-1/NBA-elo`), every game since 1946 with scores. Seasons from 2005 on are
  kept. It runs to 2025-03-17. `history.js` maps its team codes onto this site's and folds defunct
  franchises into their current team (Sonics into OKC, Nets into BKN, the two Hornets into NOP and CHA).
- **From 2025-03-18 on**: ESPN's public scoreboard feed, the one the season tracker already uses,
  one request per day. It gives finals, the schedule about ten days out, the neutral-site flag (the
  Cup final), and a consensus line and total on games not yet played. It looks thirty days ahead so
  opening night is known from the schedule; the page shows ten. Postponed games are dropped.
  **Preseason** games are kept, typed `PRE`: the page shows them with a Preseason tag and a note, but
  neither model learns from them, no box score is pulled for them and the record leaves them out,
  because preseason rotations are experiments. The NBA's own stats site blocks cloud runners and is
  not used.
- **Box scores**: ESPN's game summary feed, one request per game, from the 2021-22 season on
  (about 6,600 games; the one-time backfill took the job fifty minutes, a morning now takes a minute).
  Six games in five seasons could not be matched to an ESPN id and have no box score.
- **Injuries, coaches, rosters**: ESPN's injury feed and each team's roster feed, daily.
- Team codes: `ATL BOS BKN CHA CHI CLE DAL DEN DET GSW HOU IND LAC LAL MEM MIA MIL MIN NOP NYK OKC ORL PHI PHX POR SAC SAS TOR UTA WAS`.

## The team model

Elo with FiveThirtyEight's margin multiplier. Each team starts a season carried part way back to
1500. Before a game each side is adjusted for home court (none at a neutral site), altitude (Denver
and Utah at home), a back to back, three games in four nights, and three or more days off. The home
win chance is the logistic of the adjusted difference; the spread is that difference over a scale
fitted by least squares on the fit seasons.

Fit on 2008-2022 by coordinate search on log loss, holdout 2023-2026 (2005-2007 only warm the
ratings up). The fit is deterministic. What it found:

| Parameter | Value | In points |
|---|---|---|
| K | 20 | |
| home court, to start | 60 Elo | 2.3 |
| altitude, on top | 60 Elo | 2.3 |
| back to back | -40 Elo | -1.5 |
| three in four | -5 Elo | -0.2 |
| three days off | +5 Elo | +0.2 |
| season carry | 0.70 | |
| scale | 26.2 Elo per point | |

The home court is where the fit starts it; from there it is learned as the finals come, a thousandth of
the way toward what each home margin said. Home teams win less than they did in the fit's seasons, and a
fixed 60 priced every home side about three points of win chance too high in 2023-24 to 2025-26 (the
model said 58% on average, home teams won 54.5-55.5% and the market said 55%); learned, it stood at 45
Elo for the player model in October 2026.

Holdout (5,282 games): 66.1% straight up, log loss 0.616 (0.617 with the home court fixed), spread error
10.9 points. That is what a public NBA Elo does. It picks winners; it does not know who is playing tonight.

## The player, coach and matchup model

Every player carries two ratings, offence and defence, in Elo points for a player on the floor all
game. A team's strength for a game is 1500 plus its coach plus each player's ratings weighted by his
share of the minutes, five shares in all, so a team is exactly the sum of who plays and how much.
The situational terms (court, altitude, rest) are the team model's, with the home court learned the same
way and on its own (players.json's `homeEdge`); learning it lowered the walk-forward log loss in every
backtested season and lineup mode (known lineups: 0.6152, 0.5932 and 0.5914 to 0.6139, 0.5917 and
0.5906). Blending the model with the market's chance where a moneyline is posted was tested the same way
and given no weight: fitted on the seasons before, the best blend was the market alone.

After a final, each side's offensive efficiency (points per 100 possessions, possessions from the
team box) is compared with what the ratings expected. The surprise moves the offence of the players
who were on the floor, by their minutes, and the defence of the players they faced, the other way.
The coach moves with the margin surprise, and carries his rating when he changes teams. A player's
first rating is his last RAPTOR (2020-2022, matched by name; 249 of the current players); a player
with none starts as a rookie, below average. Ratings carry part way toward zero each season.

Tonight's strength uses projected minutes: each available player's average over his last eight
appearances, filled into the game's 240 minutes in rotation order (starters keep their workload, the
end of a long roster drops off), from the club's roster on the roster feed. ESPN's injury report says
only Out or Day-To-Day, with a return date: a listed player is out of every game before his return
date, an Out player out of the report's own day whatever it says, and a suspended one out. A player on
the roster with no game on record yet is projected at his prior (the rookie rating or RAPTOR's) for twelve
minutes, last in the rotation order: on a full roster the regulars' minutes reach 240 first, so a rookie
counts only where a roster is short (the backtest's known lineups, which know who played, always count him). The first game of a new season rolls every player over once, carried part way toward zero,
with his minutes taken from his last five regular-season games (a playoff run's 45 minutes in a short
rotation would leave a contender's bench out), so the opening slate is not priced on last June's
ratings. Pace is a running average of each team's possessions per 48, reset each season to the
league's pace as the last regular season ended plus the 1.5 possessions opening weeks have run faster (carried over, a
playoff team's slow games had new-season totals 5 to 7 points low); the total is the two expected
efficiencies times the expected pace. A back to back, three in four and rest are read from the club's
games still to play too, so a game two days out sees tomorrow's. The final win chance blends in a
tenth of the team model's difference.

Fit on 2023-2025 by coordinate search on log loss with the lineup known and minutes projected;
2022 warms up; 2026 held out (1,322 games). Every knob has an off value the search can choose, so
the fit decides what to use. What it kept: efficiency surprises clipped at 20, moving a full-time
player 0.5 Elo per point; a win update of 6 Elo on the result beside the efficiency one; the update
falling on players by the square root of their minutes share (so bench players move relatively
more); playoff updates at half weight; season carry 0.7 for players; rookies start at -80; RAPTOR
priors scaled by 1.25; a tenth of the team model's difference blended in. What it turned off: each
player's own plus-minus (not robust across seasons), shrinkage toward the prior, recency weighting of
minutes. The coach term fits to zero; it is kept at 0.05 per point of margin surprise so the coach
table means something, at no measurable cost (0.0002 of log loss on the fit seasons, and slightly
better on 2026 cold).

The 2026 holdout, four ways:

| | Log loss | Straight up | Spread error |
|---|---|---|---|
| Team model | 0.602 | 68.4% | 11.51 |
| Player model, previous game's lineup (no report) | 0.602 | 68.3% | 11.45 |
| Player model, lineup known, minutes projected (a good report) | 0.591 | 69.4% | 11.30 |
| Player model, actual minutes (perfect lineup knowledge) | 0.589 | 69.4% | 11.26 |

Totals: 15.3 points of error.

### Walk-forward test (`node tools/players.js research`, writes `research.json`)

One holdout can flatter a model, so each season from 2024 on is also scored cold: the parameters are
searched again on only the seasons before it, then that season is played through once. Log loss /
straight up / spread error:

| Season scored | Team model | Player model, no report | Player model, lineup known | Player model, actual minutes |
|---|---|---|---|---|
| 2024 | 0.609 / 66.4% / 11.07 | 0.617 / 67.0% | 0.615 / 66.6% / 11.28 | 0.612 / 67.0% |
| 2025 | 0.611 / 65.9% / 11.12 | 0.604 / 68.0% | 0.593 / 67.9% / 10.95 | 0.591 / 69.1% |
| 2026 | 0.602 / 68.4% / 11.51 | 0.602 / 68.0% | 0.591 / 69.4% / 11.34 | 0.589 / 69.4% |

With one season to learn from (2024) the player model is not yet ahead of the team model. With two
or three it is clearly ahead, by about two points of accuracy and 0.01 to 0.02 of log loss, and the
gap between "no report" and "lineup known" is the injury report's worth: about a point and a half.

### What each piece is worth (2026 cold, parameters fitted on 2023-2025, one piece switched off)

| Switched off | Log loss | Straight up | Change |
|---|---|---|---|
| nothing (the model) | 0.5913 | 69.4% | |
| rookies start at zero instead of below average | 0.5995 | 68.8% | +0.0082 |
| no RAPTOR priors | 0.5928 | 68.7% | +0.0015 |
| no win update, efficiency only | 0.5934 | 69.3% | +0.0021 |
| no blend with the team model | 0.5914 | 69.2% | +0.0001 |
| update by minutes share, not its square root | 0.5913 | 69.2% | +0.0000 |
| playoffs updated at full weight | 0.5911 | 69.2% | -0.0002 |

The priors carry the most: a rookie really is below average, and last season's RAPTOR is a better
start than zero. The rest are small and real. Adding a signal that does not survive the walk-forward
is how a model gets weaker while looking stronger, so plus-minus stays off until it does.

`research.json` and the tables above were produced before the October 2026 data fixes (a side's points
from the final score, a new season's minutes from the regular season, the play-in typed as regular
season). Rerun on them, the walk-forward's 2025 and 2026 folds pick slightly different parameters and
the final fit turns plus-minus on (0.25), for about 0.0006 in log loss on 2026, which is within the
noise. The live parameters in players.json change only on a refit (the job's `fit` switch); none was
run before the 2026-27 opener, and a refit should be a deliberate choice with a new research.json.

The "lineup known" rows are scored with who actually played: a perfect injury report, which the site
does not have. What runs here, the roster minus the report's absences filled to 240, has not been
scored on its own; it sits between "lineup known" and "no report".

What the ratings say after the 2026 Finals: Gilgeous-Alexander first, then Jokić and Leonard;
Daigneault, Mitch Johnson and Bickerstaff the top coaches; with the 2026-27 rosters, Oklahoma City,
San Antonio and New York the strongest teams and the Wizards the weakest.

## Player props

DraftKings' NBA player props, read from ESPN's free feed, with the hub's own projection beside each line. The owner's
go-ahead, 15 October 2026. **The model is on trial**: it has not been shown to beat DraftKings, so it is shown beside
DraftKings' line and fair chance and suggests nothing. No prop goes into a suggested parlay, a pick or a Safe, Medium or
Aggressive level because of it, and nothing on the page says "model says" or "edge" on a prop until the shadow ledger
(below) has passed its bar. Player legs in the Parlay Builder are not part of this round: they need the owner's call on
the one-leg-a-game rule and a same-game correlation table, so the props view is display only.

### DraftKings' props on ESPN's feed (`tools/props_feed.js`)

`sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/<E>/competitions/<E>/odds/100/propBets?lang=en&region=us&limit=1000&page=<n>`
(provider 100, DraftKings, the only one listed; `access-control-allow-origin: *`). Unlike the NFL feed, every item
carries DraftKings' real American price. One game is one page (limit 1000 is honoured; a reader follows `pageCount`);
a 404 "No propBets found" means nothing posted yet. Each item names its market (type id), its athlete (a `$ref` ending
in ESPN's athlete id, which is this hub's player id everywhere: no name matching), its line and its price. There is no
Over/Under field and no DraftKings outcome id on a player item, and `lastUpdated` runs about three hours ahead of UTC
while labelled Z, so nothing reads it. The rules, from the scoping study of 15 October 2026 (48,106 items):

- A main line (points, rebounds, assists, threes, steals, blocks and the five combos) is two adjacent items on one
  market, athlete and line: **the first is the Over** (on 3,162 of 3,162 archived pairs whose sides are 8+ points
  apart, the first item's price was the nearer to the "k+" rung at line + 0.5, which is the same bet).
- A pair the rung at line + 0.5 contradicts is dropped (the rung within 10 points of one side, nearer the second item,
  the two sides 3+ points apart); a market, athlete and line with other than two adjacent items is no pair; two lines on
  one stat keep the one nearest even.
- "k+" milestones and double- and triple-doubles are a Yes price. Team markets, halves, quarters and first baskets are
  left out.

`propParse` is pure and dependency-free so the page carries a copy line for line; `propRead` reads every page through a
`getJSON` it is handed. `tools/fixtures/propbets_401909088.json` is a recorded answer (opening night, Celtics at Pistons,
Cunningham and Tatum, read 15 October 2026).

### DraftKings' fair chance

Eight ways of taking the margin out of a main line's two prices, scored on the 11,395 archived closing lines graded
from the box scores (83 games of the 2026 play-in and playoffs; Overs hit 45.9%; `research/props.json` `fair`, from
`data/props_2026.csv`):

| Method | Log loss | Brier | Mean fair Over |
|---|---|---|---|
| **Whole margin on the Over** (fair Over = 1 - implied Under) | **0.6788** | **0.2430** | 45.6% |
| Power | 0.6805 | 0.2439 | 48.9% |
| Additive | 0.6806 | 0.2440 | 49.0% |
| Shin | 0.6806 | 0.2440 | 49.0% |
| Multiplicative | 0.6807 | 0.2440 | 49.0% |
| Whole margin on the longshot | 0.6821 | 0.2447 | 48.8% |
| Whole margin on the favourite | 0.6836 | 0.2455 | 49.1% |
| Whole margin on the Under | 0.6870 | 0.2471 | 52.3% |

The whole margin on the Over scored best, as it did for the NHL (its paired interval against the multiplicative split,
resampling games, is -0.0035 to +0.0005: the best estimate, not a settled one, and playoffs only), so a main line's fair
chance is that. One-sided prices are estimates, marked est. on the page (`state.json` `props.fair`):

- A "k+" rung sits a near-constant 6.8 points of chance above the main line's fair Over at the same number (6.1 on
  points; 8,055 archived rungs at line + 0.5, every price band from 30% to 70%; 6.8 again on opening night's 146), so
  its fair chance is its implied chance less that, scaled toward 0 below 30% and toward 1 above 70% (`propFairRung`;
  outside 30-70% nothing was measured). Measured on the raw answers the scoping study read on 15 October 2026, which
  the repo does not keep: the record keeps main lines only, and archived rungs are too sparse and too often wrong to
  record (5.2% contradict their main line by 15 points or more).
- A double-double or triple-double is one Yes price with no other side and no main line, so nothing can measure its own
  margin: its fair chance is the rung rule (`propFairRung`) with the rungs' margin, 6.8 points, assumed to hold there
  (`props.fair.yes`), marked est. and said to be an assumption. On the archived playoff prices these markets ran far richer
  than that: double-doubles happened 11.9% where 1,027 prices said 16.8% (16 to 17 points under the price from 30% implied
  up), triple-doubles 1.5% where 328 prices said 4.2% (5 hits). One playoff run cannot tell a bigger margin from the market
  misjudging the playoffs, and a fair chance fitted to those results would be the results, not DraftKings' view (the first
  version divided by 1.41 and 2.0 so, which put Tatum's double-double "level" with the model on opening night), so the page
  says the figure may run high.

### The model (`tools/props.js`)

Per player per game, from the hub's own box scores, a mean and a full distribution for the eleven stats, and the
chance of a double-double and a triple-double. Every constant is chosen on finished seasons only; the live ones were
fitted on 2023-2026 (`props.json` `params`), and are refitted only between seasons (`node tools/props.js fit`), never on
the season in progress.

- **Minutes**, its own rule. The game model's opening-night rule (the last five regular-season games) missed 2023-2026
  openers by 7.25 minutes against 6.00 for the whole previous season (Cade Cunningham projected 24 with a 33.9 season
  average and a 24.5 points line). The props rule: the player's minutes this season weighted toward his last
  appearances (half-life 2), with a prior worth a quarter of a game, his whole previous regular season (when he played
  20 games of it; else his last 20 regular-season appearances), so an opener is last season's average. Then the side is
  scaled toward a full game, m = b x (250 / S)^0.5, S the sum of b over the side's 10 with the most (`ROT`), and in the
  playoffs m + 0.2 x (m - 24). **The side is the same kind of thing in the backtest and live**: in a backtest every player
  the box score lists (who dressed), all counted, nobody left out for not having played; live the roster minus the injury
  report, of which the 13 with the most minutes dress (a box lists 13 at the median) and are projected. Only the top 10 count
  toward the scale because the live pool is a roster (training camp carries 20, a season 15 and its two-way players) where
  the box lists the 13 who dress: the two agree on a side's top 10 and differ below it (on the box's lists 10 to 15 gave the
  same error, 4.823 to 4.830 minutes on the 2024 fold, so the smallest, the median number who play, is the one a longer
  roster moves least). The first version scaled the backtest's side by who had actually played (a listed player with b of
  15 or more who sat was read as out) and the live side by its roster's 13 with the most minutes, so the backtest had
  hindsight and the live sides summed far more minutes: opening night's scales came out 0.88 to 0.93 where the backtest's
  openers sat at 0.998 at the median, and starters lost a tenth of their minutes (Maxey 38.1 to 33.6, Tatum 33.5 to 30.4).
  On 15 October 2026's rosters and report the live scales now sit at 0.969 at the median (0.914 to 1.046; opening night
  0.936 to 1.023), against the backtest's openers' 0.952 to 1.069 (10th to 90th percentile); Tatum is projected 32.6, Maxey
  35.7, Cunningham 33.9 (`test_props.js` 3b holds this). It misses by 4.82-4.83 minutes a game (4.88-4.90 with no side
  scale), the game model's rule by 5.07-5.09; on a player's first game of a season 5.83-6.17 against 7.07-7.38. The 13
  shown live are each projected his minutes if he plays, so a side's whole list sums to more than a game (a median 302 on
  that week, where a box's list, ending in players who seldom play, sums to 260 over its players projected 8 minutes or
  more); its top 10 sum to 258 at the median, in the backtest's openers' range (233 to 263, 10th to 90th percentile).
  **The game model's own minutes and lineups are not changed** (the owner's call): its opening-night rule is worth a look.
- **Rate** per minute of each stat, exponentially weighted (half-lives 15 to 40 appearances), shrunk toward the
  position's league rate (G, F or C; the box writes PG, SG, SF and PF for some players) with 25 to 200 pseudo-minutes.
- **Pace**: x (the game's expected pace / the pace of the games he played lately)^1, a club's pace by players.js's rule.
- **Opponent**: x (what the opponent allowed per minute on that stat over the league's, shrunk)^0.75-1.
- **Playoffs**: x a per-stat factor fitted on the earlier playoffs (points 0.93, assists 0.88).
- **Spread**: negative binomial with variance A x mean^B, fitted by maximum likelihood per stat; a combo's mean is the
  sum of its parts' and its spread is fitted on the combo's own results, so how a player's stats move together is in
  it. P(over a line) = P(stat >= floor(line) + 1).
- **Double- and triple-doubles** from the same five distributions joined by a one-factor Gaussian copula (rho 0.4).

### Walk-forward test (`node tools/props.js research`, writes `research/props.json`)

Each season scored cold by constants fitted only on the seasons before it (2022 warms up), on every player who played
and had a game this season or last, against the naive own average (his average this season, else last season's, with
its own fitted spread). The structure (which pieces, which grids) was chosen on the 2024 fold alone; 2025 and 2026 are
tests. Each cell: mean absolute error, model / naive · log score of the stat (lower is better) · log loss of the over
at a line where a book would hang it (the player's own average to the half point below):

| Stat | 2024 (development) | 2025 (test) | 2026 (test) |
|---|---|---|---|
| Points | 4.48 / 4.63 · 2.993 / 3.170 · 0.671 / 0.723 | 4.55 / 4.71 · 3.015 / 3.164 · 0.676 / 0.723 | 4.51 / 4.70 · 3.019 / 3.160 · 0.669 / 0.720 |
| Rebounds | 1.85 / 1.91 · 2.152 / 2.224 · 0.665 / 0.704 | 1.89 / 1.95 · 2.174 / 2.245 · 0.667 / 0.706 | 1.86 / 1.92 · 2.157 / 2.238 · 0.661 / 0.705 |
| Assists | 1.32 / 1.36 · 1.736 / 1.819 · 0.654 / 0.701 | 1.31 / 1.35 · 1.743 / 1.817 · 0.655 / 0.702 | 1.32 / 1.36 · 1.747 / 1.825 · 0.655 / 0.702 |
| Threes | 0.85 / 0.87 · 1.261 / 1.319 · 0.579 / 0.617 | 0.88 / 0.90 · 1.307 / 1.366 · 0.588 / 0.626 | 0.88 / 0.90 · 1.299 / 1.357 · 0.587 / 0.625 |
| Steals | 0.67 / 0.68 · 1.066 / 1.136 · 0.625 / 0.675 | 0.70 / 0.72 · 1.127 / 1.195 · 0.636 / 0.684 | 0.71 / 0.73 · 1.134 / 1.203 · 0.634 / 0.683 |
| Blocks | 0.52 / 0.53 · 0.828 / 0.883 · 0.550 / 0.593 | 0.52 / 0.52 · 0.811 / 0.864 · 0.544 / 0.586 | 0.51 / 0.51 · 0.798 / 0.849 · 0.538 / 0.579 |
| Pts+reb+ast | 5.92 / 6.21 · 3.350 / 3.473 · 0.666 / 0.715 | 5.96 / 6.25 · 3.362 / 3.462 · 0.669 / 0.717 | 5.92 / 6.24 · 3.363 / 3.482 · 0.661 / 0.711 |
| Pts+reb | 5.44 / 5.66 · 3.246 / 3.377 · 0.669 / 0.716 | 5.48 / 5.72 · 3.262 / 3.368 · 0.671 / 0.717 | 5.43 / 5.70 · 3.260 / 3.385 · 0.663 / 0.712 |
| Pts+ast | 4.93 / 5.15 · 3.128 / 3.281 · 0.667 / 0.721 | 4.99 / 5.21 · 3.169 / 3.270 · 0.671 / 0.720 | 4.97 / 5.21 · 3.149 / 3.275 · 0.664 / 0.717 |
| Ast+reb | 2.55 / 2.67 · 2.503 / 2.578 · 0.665 / 0.709 | 2.59 / 2.70 · 2.515 / 2.588 · 0.665 / 0.710 | 2.56 / 2.67 · 2.505 / 2.596 · 0.658 / 0.707 |
| Stl+blk | 0.89 / 0.92 · 1.364 / 1.439 · 0.644 / 0.691 | 0.91 / 0.94 · 1.399 / 1.473 · 0.644 / 0.692 | 0.92 / 0.95 · 1.402 / 1.478 · 0.648 / 0.695 |

The model beats its own-average baseline on every stat in every season (27,872 to 28,463 player-games a season; on
players projected 20+ minutes, points 5.14-5.24 against 5.31-5.39). Its points run 0.20 high in 2024, 0.03 low and 0.05
high in 2025 and 2026. Double-doubles: log loss 0.183-0.193 against 0.287-0.298 for the player's own rate, said 8.0% in
2026 where 7.2% happened; triple-doubles said 0.60% where 0.50% happened.

These folds know who dressed (the box's list): a perfect inactive list, though not who would sit, which the first
version's backtest also knew and the live side never can. Live, the roster minus ESPN's report stands in for the box's
list and is weaker; it has not been scored on its own, and the shadow ledger is where it will be.

### Against DraftKings' closing lines (2026 play-in and playoffs, the 2026 fold's model, fitted on 2023-2025)

11,395 closing main lines on 83 games (302 more, on players the box score lists as not playing or not at all, are void,
as DraftKings voids them). The model was fitted and frozen before it saw them, its minutes by the rule above (the side
the box lists, nobody read as out for having sat); nothing was changed after.

| | Model | DraftKings' fair chance | Difference [90%, resampling games] |
|---|---|---|---|
| Log loss | 0.6934 | 0.6788 | +0.0147 [+0.0083, +0.0214] |
| Brier | 0.2495 | 0.2430 | +0.0064 [+0.0036, +0.0094] |
| Chance of the Over (it happened 45.9%) | 44.6% | 45.6% | |
| Guess of the stat (mean absolute error) | 3.19 | 3.11 (the line) | model 0.01 under the line |

**It loses to DraftKings**, as the scoping baseline did (0.7095 there): better, but not good enough. By stat it is level
on steals (0.6529 against 0.6539) and blocks (0.6345 against 0.6349), and furthest behind on points (0.7172 against
0.6884) and the points combos. It runs low on the Over (45% where 46% happened). Flat one-unit bets at the closing
price where the model's chance of a side beats the chance its price implies:

| Edge bar | Overs: bets, won, units (return) | Unders: bets, won, units (return) |
|---|---|---|
| 3 points | 967, 442, -106.4 (-11.0%) | 4,271, 2,357, +135.3 (+3.2%) |
| 5 points | 616, 269, -101.3 (-16.4%) | 3,279, 1,787, +65.5 (+2.0%) |
| 8 points | 316, 121, -86.3 (-27.3%) | 2,063, 1,094, -6.8 (-0.3%) |

The Unders made money at the low bars and the Overs lost it: one playoff run, where every Under returned -0.7% and Overs
were the side DraftKings shaded. It is no evidence of an edge (at 8 points the Unders are level), and is why the bar below
is judged on the regular season, on lines the model has never seen, before anything moves. (The first version's minutes,
with the hindsight above, scored 0.6935 and 0.2493 here: the same loss.) ESPN keeps no regular-season lines (none of 2025-26), so there is no
regular-season test set except the one the hub now keeps.

### The record (`tools/props_record.js`, in the job)

Once a game is final the job reads its closing props once (one free request a game; the read lands the morning after,
and the answer then holds DraftKings' lines at tip) and appends its main lines to `data/props_<season>.csv`
(game_id, player_id, stat, line, over, under), logging every read in `data/props_reads.json` (ok, none for a 404, failed
and asked again on the next run, gave_up after three failures). A game read ok or none is never asked for again and its
rows are never rewritten. `data/props_2026.csv` is the backfill of what ESPN still served on 15 October 2026 (83 of the
91 play-in and playoff games, 11,697 main lines; `node tools/props_record.js --backfill 2026-04-14 2026-06-30`).
Whether ESPN still serves a regular-season game's closing props the next morning is known only from 21 October: if it
does not, the reads come back none and the ledger has nothing to grade, which its numbers will show. Source the job
writes, never edited by hand.

### The shadow ledger (`tools/props_ledger.js`, `tools/props_check.js`, in the job)

Modelled on the NFL hub's game-totals shadow. For every game to come (the next five game days), the job's call on
every player projected 8 minutes or more: his minutes, the eleven means and his double chances, the spread being the
fit's (the fit is stored by id, `fits`), so the call is the whole distribution. A call is rewritten by any run before
tip-off whose numbers differ and frozen by the first run at or after it; from then on it never changes. Once the game is
final, its box score is in and its closing lines are read, every closing main line on a player with a call is graded
and appended to `data/props_shadow_lines.csv` in grading order: the model's chance of the Over from the frozen call,
DraftKings' fair chance (the whole margin on the Over), and the stat from the box score (a player who did not play is
void; a line on a player with no call is counted, not graded).

**The bar** (`BAR` in `props_ledger.js`, written into `data/props_shadow.json` at 2026-10-15T11:35Z, before the first
call, and held there by the check, its numbers with it: lines 30000, edge 0.03, ci [0.05, 0.95], boot 10000, seed 0). It
was first registered at 09:08Z without those numbers in it; they were written into `BAR` before any game had tipped, so
the ledger was started again with the full bar and no call, and the calls made after it (the check allows that once, a
re-registration, only while the old bar has no call frozen or past its tip-off, no graded line and no verdict):

- **When**: decided once, at 30,000 graded lines that went over or under (about five weeks of the regular season at
  ~120 graded lines a game), on the first 30,000 in grading order, and never revisited.
- **PASS only if all three hold**: (1) log loss, the model's chance minus DraftKings' fair chance (clipped to 1e-6):
  the bootstrap 90% interval (10,000 resamples of the sample's games, seed 0, 5th to 95th percentile) wholly below 0;
  (2) Brier score: the same; (3) flat one-unit bets on the side whose model chance is 3 points or more above the chance
  its closing price implies (the margin left in), at that price, are up (no bets is not up).
- **Otherwise FAIL**: the calls stop (frozen ones are still graded), and the page never puts a prop in a suggestion or
  says "model says" or "edge" on one.
- **A PASS** makes the model a candidate to be shown as more than on trial, by a change of its own; nothing moves by
  itself (`state.json` `props.onTrial` stays true).
- **Before 30,000**: running numbers and how many are in, never a verdict or a word of passing.

The check runs right after the job's props step and fails it (putting every props data file back as the last commit
had it, and turning the run red) when the bar is not the registered one or the last commit's (but for a re-registration
as above), or was registered after a call; a call was made at or after its tip-off; a call the last commit had frozen, or whose tip-off has passed, is
gone, open again or changed in any field (the one change allowed: this run's rewrite, before tip-off, of a call not yet
frozen); a fit, a freeze time or a grade once written changed; the last commit's graded lines are not, byte for byte,
the start of the file; a graded line is not what the frozen call, the fit, the closing line and the box score give; a
game's lines are not exactly its closing lines on players with a call who played; a game graded is not final, frozen and
read, or one that can be graded is left ungraded; a verdict is early, missing, not the first 30,000's, or changed; the
summary does not follow; or the record lost or changed a game it had read.

### What `state.json` carries for the page (`props`, from `props.json` and the ledger)

```
props: {
  onTrial: true,                                  // until a change of its own; a PASS never flips it
  build, asOf, fitSeasons: "2023-2026", horizonGameDays: 5, minShown: 8,
  stats: [pts, reb, ast, tpm, stl, blk, pra, pr, pa, ar, sb], combos: { pra: [pts, reb, ast], pr: [...], pa, ar, sb },
  layout: [name, team, pos, min, pts, reb, ast, tpm, stl, blk, dd, td],
  dist: { kind: "negative binomial", var: { pts: [A, B], ... every stat and combo }, rule },
  fair: { main, mainWhy, rung: { form, a: { pts: 0.061, ... }, measured }, yes: { form, a: { dd: 0.068, td: 0.068 }, measured, playoffs }, estimated },
  games: { <game_id>: { tip, away, home, players: { <ESPN athlete id>: [ ...layout ] } } },   // the slate's games not yet started
  ledger: { registered, bar: { lines, passIf, otherwise, before }, decision, summary: { standing, gradedGames, lines, voids, scores, flat, toCome } },
  research: { folds: [...the walk-forward: minutes, points, rebounds, assists, pts+reb+ast], market: {...the archive test} }
}
```

A player's means are the six base stats; a combo's mean is the sum of its parts (`combos`), to two decimals, which is
exactly the shadow ledger's call (`props.js` publishes a combo as that sum, so the page prices every line on the call
the ledger freezes, to the digit). To price a DraftKings line
L on stat k: mean mu, variance `A x mu^B` from `dist.var[k]`, P(over) = P(stat >= floor(L) + 1) for a negative binomial
with that mean and variance (Poisson where the variance is not above the mean): `nbSf` and `nbVar` in
`tools/props.js`, dependency-free for the page to copy. A real entry, opening night (`2027_20261020_BOS_DET`):

```
"4432166": ["Cade Cunningham", "DET", "G", 33.9, 22.19, 4.82, 7.21, 2.24, 1.05, 0.62, 0.2416, 0.026]
```

33.9 minutes, 22.2 points, 4.8 rebounds, 7.2 assists, 2.2 threes, 1.1 steals, 0.6 blocks, a 24.2% double-double and
2.6% triple-double (DraftKings' points line on him was 24.5; the page shows the two side by side, the model on trial).
A player DraftKings lines with no game on record has no projection, and is said so.

### On the page (`app/nba_hub.html`)

Every game still to come has a **Player props** button: on its card on Tonight (44px, beside Lineups) and on its row
in the Parlay Builder's plan. It opens that game's props in a sheet: a window over the page on a wide screen, the whole
screen on a phone. Escape, Close (44px) or a tap outside closes it, Tab stays inside, and the focus goes back to the
button that opened it. Nothing in it is saved, not even the team switch.

**Before any press** the sheet says to press Refresh odds for DraftKings' props, with the button in it, and shows the
model's projections for the players expected to play (each projected 8 minutes or more): minutes, points, rebounds,
assists, threes, steals, blocks, points + rebounds + assists and the double-double chance, both teams or one, and who
the injury report has out (on a phone, 520px and under, steals and blocks are left out of the table, which says so, so
points + rebounds + assists and the double-double chance stay on the screen). A game the model does not project says
why (preseason, or beyond the next five game days).

**The press.** Refresh odds reads DraftKings' player props with the lines, never on load or on a timer: once the
scoreboard has answered, one request for each game still to come (a second only if an answer runs past a page), six at
a time, each dropped after 15 seconds, past any cache and with no headers of its own. The ESPN event id is the press's
own scoreboard row's, or the slate's published one (`espn`, which `publish.js` now writes) where that day did not
answer. A game that has started (by its published tip, ESPN's status or ESPN's own tip, as the lines are judged) is not
asked for, and one that tips while its read is out is not taken. A 404 is "none posted yet"; a read that fails or answers
junk keeps an earlier press's props for that game, with their read time. What is read lives in memory only (`PP_LIVE`):
nothing is stored, and a reload is the published page again. A second status line under the button says what was read
("DraftKings' player props, read 5:36 AM: 3 games, 167 main lines, under Player props on each game. 54 have none posted
yet."), and each card's button counts its game's main lines.

**After a press**, for each player DraftKings lines (matched by ESPN athlete id; his name from the projections, the
game's lineups and absentees or the rated players), each main line: the line, DraftKings' Over and Under, and

```
Points   24.5   O -104   U -123   projection 20.8 · model 29% · DraftKings 45%
```

the model's mean, its chance of the Over (`pOver` on the published mean and the fitted spread; a combo's mean the sum
of its parts', to two decimals, the ledger's call to the digit) and DraftKings' fair chance of the Over (the whole margin
on the Over). Then his milestones (k+), folded, each with its price, DraftKings' fair chance (est.) and the model's chance
of reaching it; and his double- and triple-double prices with the model's chance and DraftKings' (est., the rungs' margin
taken out, its title saying that margin was never measured on these markets and the figure may run high). A player with no projection says why (out on the
injury report, projected under 8 minutes or no game on record) and shows DraftKings' chance alone. The projected players
DraftKings has no line on are listed under, folded.

**On trial, everywhere it shows.** The sheet's head says Model on trial, and its note says the model has not been shown
to beat DraftKings and suggests nothing, with the walk-forward and the market test in brief and the shadow ledger's
running numbers. The Record tab gives the ledger quietly: how many of the 30,000 graded lines are in, and the model
against DraftKings on log loss and Brier, never a verdict or a word of one before the bar is decided (a PASS, when it
comes, is said to move nothing by itself). Nothing in the view says "model says" or "edge". No prop reaches the suggested
parlays, the Value card, a pick, the plan or the Bet Build: the view is display only.

The parse and the fair chances are `tools/props_feed.js`'s and the distribution `tools/props.js`'s (`propParse`,
`propRead`, `propFairOver`, `propFairRung`, `nbVar`, `nbPmf`, `nbSf`, `pOver` and their pieces), copied
into the page line for line; the smoke holds the text and the results to the tools' own, so the two cannot drift.

Live on 15 October 2026 (the second look, 11:53 UTC, after the minutes fix), in Chromium at 1280 and 390 wide: one press
read 57 games, 52 answered 404 (nothing posted), the three opening-night games answered with 167 main lines in all and
two preseason games with no player market; every answer carried `access-control-allow-origin: *`, every request was a
plain GET with no header of its own, nothing was read on load, nothing was stored, no page or sheet scrolled sideways (at
390 the projections table fits its 358px with PRA and DD on screen), the page's parse equalled `props_feed.js`'s on all
five answers, and each of the 46 lines on Celtics at Pistons read as Node works it out from `props.js`; a reload asked
ESPN for nothing and showed the published page. Celtics at Pistons, as the sheet showed it:

| Player | Line | DraftKings | Projection · model · DraftKings |
|---|---|---|---|
| Jayson Tatum | points 26.5 | O -111, U -114 | 22.4 · 29% · 47% |
| Jayson Tatum | rebounds 8.5 | O -143, U +109 | 9.3 · 55% · 52% |
| Jayson Tatum | double-double | Yes -114 | model 46% · DraftKings 46% est. |
| Jayson Tatum | triple-double | Yes +940 | model 6% · DraftKings 7% est. |
| Cade Cunningham | points 24.5 | O -104, U -123 | 22.2 · 35% · 45% |
| Cade Cunningham | assists 9.5 | O +109, U -144 | 7.2 · 21% · 41% |
| Cade Cunningham | threes 1.5 | O -175, U +132 | 2.2 · 62% · 57% |
| Cade Cunningham | double-double | Yes -108 | model 24% · DraftKings 45% est. |
| Derrick White | points 15.5 | O -106, U -121 | 13.9 · 36% · 45% |
| Derrick White | pts + reb + ast 23.5 | O -107, U -122 | 21.6 · 37% · 45% |

The model is still under DraftKings on opening night's points (Tatum 22.4 against a 26.5 line, Cunningham 22.2 against
24.5), less than before the minutes fix (21.0 and 20.8, when the live sides shaved starters' minutes by about a tenth).
The rest of the gap is the rate, not the minutes (Tatum's 32.6 minutes are his last season's): it is the kind of gap the
shadow ledger will grade, and nothing was tuned to close it. Tatum's double-double reading level with DraftKings is a
coincidence of the two numbers (46.1% and 46.5%), where the first version made it level by its fitted divisor.

### The checks

`node tools/test_props.js` holds the parse, the record, the model, the ledger and the bar (its header lists them),
including: a 404 on page 2 after page 1 answered is a failed read, and the record asks for that game again and reads it
whole; a double- or triple-double priced by the rung rule, the playoff calibration said beside it; every combo published
as the sum of its published parts, and every number the page reads the open call's to the digit; the live minutes on the
fixture of 15 October 2026 (3b: every side's scale in the backtest's range, the week's median within its openers' 10th to
90th percentile, the rotation's minutes likewise, no side showing more than the 13 who dress, a camp roster's extra
bodies leaving a scale as it is); a call open in the last commit and past its tip, rewritten with a later tip as a delay
would, failing the check; a re-registration of the bar passing before anything is on record and refused once a call is
frozen or past its tip, a line graded, a verdict written, its time not later, a call made before it or a bar not `BAR`;
and the committed ledger's bar being `BAR`, every call made after its registration. `node tools/smoke.js` section 8 holds
the page: the props view on a press against a stubbed ESPN (the recorded
opening-night answer with made-up lines added, two pages, a 404, junk, a 503, a game ESPN has under way, one that
tips while its props are read, one ESPN still calls scheduled with its own tip passed and the published one to come, and
on a second press a game whose page 2 is a 404, which keeps its earlier read whole); every line, rung and Yes price the sheet shows worked out on its own from
`props_feed.js`, `props.js` and the state's props block; the on-trial wording; nothing suggested (the Parlay Builder
drawn with the props read is byte for byte the one drawn without them, and names no player); nothing read before a
press (on load, opening a sheet, switching its team, on every timer and event the page sets); nothing stored; a reload
returning to the published page; a sheet left open while its game tips; the ledger's running numbers on made-up
summaries (no verdict before the bar, then a FAIL and a PASS); the page's copies held to the tools' text and results;
every game the real state projects opening without a NaN; the page's own means, combos included, the ledger's open calls
to the digit; the phone table's dropped columns. Each check was shown to fail on a planted break, in a scratch copy: the
job side's 24 (the Over read second, the rung cross-check removed, a 404 read as a failure, a game asked for again, rows
rewritten, the negative binomial off by one, a frozen call recomputed, the bar's verdict a line early, a moved call
unchecked, and the rest), the page's 22, and the review's fixes' 16:

| Planted break (the review's fixes) | What failed |
|---|---|
| the ledger left with the bar as first registered | the committed bar is `BAR`; the page's numbers the open calls'; `props_check.js`: 2 failures |
| a re-registration allowed with a call frozen / with no later time | refused once a call was frozen / refused when not later |
| no re-registration at all | the re-registration passes; `props_check.js` against the last commit |
| the live side scaled on its 13 who dress (the first version's sum) | every side's scale and the week's median (0.894) |
| the live side showing the whole roster | none showing more than the 13 who dress |
| a side's scale over every player, not its top 10 | a camp roster's extra bodies leave the scale as it is |
| the check letting a call past its tip be rewritten when its tip moves later | the delayed rewrite fails the check |
| a 404 on any page read as none posted (feed and page) | 4 in `test_props.js` (the read, the record twice, the reread); 3 in the smoke (the status line, the kept read, the page's read) |
| a combo published as the rounded sum of unrounded parts | each live projection's combo the sum of its published parts |
| the results-fitted factors back in `FAIR.yes` | the playoff calibration said beside it, not passed off |
| the page dividing a double-double by 1.41 | the double- and triple-double prices by the rung rule |
| the Yes prices' est. not saying it may run high | their est. and the on-trial note |
| the page reading ESPN's status and not its tip | the requests a press makes, the status line, nothing taken |
| the page summing a combo without rounding | the page's own means the ledger's open calls |
| every column kept on a phone | the phone table drops Stl and Blk |

The page's 22:

| Planted break (the page) | What failed |
|---|---|
| the Over read as the second item | 17 checks: the copy's text, the parse on every variant, every line, the card's count, the status line |
| the fair chance split evenly | every line, the copy's text, the fair chances |
| the negative binomial off by one | every line and rung, the copy's text, the distribution |
| props read on load / on a 30-second timer | nothing read before a press, the requests a press makes, the reload |
| props kept in localStorage | nothing stored, by the press and by the sheet |
| ESPN's status and tip not read | the requests a press makes, the status line, the game under way taken |
| a game that tips during its read taken | the status line, nothing taken |
| a prop put in the suggestions | the Parlay Builder with props against without |
| the line worded "model edge" | every line, the "edge" and "model says" check |
| the model's chance of the Under shown | every line |
| a combo's mean not summed | the projections, every line and rung, the combo |
| a 404 read as a failure | none posted yet, the status lines, the copy's text, the read on both 404 cases |
| the card's `.team` class on the table's team row | every row a table row |
| a header of its own and no cache-buster | the plain GET check |
| players not matched by ESPN id | every line, rung and Yes price, the projected minutes |
| Escape left alone | Escape closes it |
| a failed read wiping the earlier props | a failed read keeps them |
| "So far it is passing" in the ledger | no verdict, nor a word of one |
| an open sheet not following its game's tip | once it tips, the sheet says so |
| a main line's chance from the rung rule | every line |
| the on-trial label taken off | the model labelled on trial |

```
node tools/props.js               # the job's step: closing lines, projections, ledger; writes props.json
node tools/props_check.js         # the ledger against the last commit's; ends "props check: 0 failures"
node tools/props.js research      # the walk-forward and market tests (about seven minutes)
node tools/props.js fit           # refit the constants on the finished seasons (between seasons only)
node tools/props_ledger.js init   # once: the ledger with its bar and no call
node tools/test_props.js          # the parse, the record, the model, the ledger and the bar; ends "all good"
node tools/smoke.js               # the page; section 8 is the props view; ends "all good"
```

## Runs

`.github/workflows/update.yml` is queued at 07:17, 11:17 and 13:17 UTC. GitHub starts this repo's
scheduled runs 3 to 9 hours late, so they land from the morning to the late afternoon Eastern: the first
for last night's finals and box scores, the other two for the day's lines and injury report. Each run reads
from the earlier of the first day in the last three weeks with a game not final (today included) and the day
after the last final, to thirty days ahead; then the new box scores, the injury report, the coaches and
rosters, both models, and publishes. A game's line and its logged number are frozen at its tip-off, so a run
that lands during a game changes neither.

ESPN answering with no events at all for a day the table has games on, from yesterday to ten days out, is a
failed read and the rows stay (a postponed game comes back as an event, so it leaves at once); ten failed days
stop the run before anything is written. A run red on "answered with no games" for days on end means ESPN has
stopped listing them, and needs a person to look. An injury report that answers with no list or under half the
last one's players is refused, and the last report stands with its date; a club whose roster answers short or
fails keeps its last good roster and coach, dated in `rosters_espn.json`'s `asOf`; `data/coaches.csv` takes the
season's coaches from ESPN and a dated row when a club changes coach.

After the players model, the props step reads DraftKings' closing lines for the new finals, writes the projections
(`props.json`) and the shadow ledger, and runs the ledger's check; when either fails, every props data file goes back to
the last commit's and the run is red (README "Player props").

After the pull, each step may fail on its own: the data folder and the model files are committed whenever the
pull succeeded, and state.json and the pages only when publishing and the tests (`tools/test_fetch.js`,
`tools/test_fetch_box.js`, then the page's smoke test on the new state) pass; the run is red when any step
failed. The page says when the injury report is older than the file it came in. On demand the job
takes a date range and a refit switch. A push that changes the tools or the app runs it once (on a
`claude/` branch too, committing there and in its own queue; the schedule only fires from `main`).

Local:

```
node tools/history.js      # once; downloads the history file (or --file path/to/nba_elo.csv)
node tools/fetch.js        # needs ESPN reachable; --from / --to for a range
node tools/fetch_box.js    # needs ESPN reachable; --from / --to for seasons, --budget minutes
node tools/elo.js          # team model replay; add "fit" to refit
node tools/players.js      # player model replay; add "fit" to refit
```

## The site

`index.html`, its own look: graphite blue with an orange accent, bold display type, faint court lines, team-coloured badges, cards like tickets; one card per game. Tabs:

- **Tonight**: a day strip from yesterday to ten days out. Each card has the two teams (tap a badge to
  make it your pick), the model's win chance and a probability bar, the spread and total, the market
  line with an edge chip when the model is three or more points away, who is out on each side and what
  it costs in points, a lineups drawer with projected minutes and each player's contribution and the
  coach, two buttons that put the model's side on a parlay ticket (moneyline or spread), and a Player props
  button that opens the game's props: the model's projections, and DraftKings' player lines beside them once
  Refresh odds has read them (README "Player props"; the model on trial, suggesting nothing). Finals
  show the score and whether the model hit. Before the schedule appears the tab counts down to
  opening night over the preseason board.
- **Refresh odds**, over Tonight and the Parlay Builder: the job's lines are as old as its last run, so a
  press reads DraftKings' current lines from ESPN's public scoreboard in the browser (one request a day with a
  game still to come; ESPN answers any page), taken exactly as `fetch.js` takes them (the page carries a copy of
  its `parseDay` and of `merge` for a game not started, and the smoke holds both to the job's on the recorded
  answers in `tools/fixtures/`). Only games not yet started (by the published tip, ESPN's status or ESPN's own
  tip); one that tips while the read is out, a day that fails or answers junk, a game ESPN has no line for, and
  a read older than the published one keep the lines they show (the published ones, or an earlier press's), and
  the status line beside the button says how many, and which games have no line yet. Everything priced from the lines
  follows: the edge chips, the market's chance and Vegas pick, the prices and est marks, the suggested parlays,
  the plan and what Lock in records. The same press then reads DraftKings' player props for the same games, one
  request each, by the ESPN event id the scoreboard gives (or the slate's `espn`), shown under each game's Player
  props with a second status line (README "Player props"); nothing is priced or suggested from them. It is all held
  in memory only, never saved: a reload is the published state again. Nothing is read on load or on a timer, only on
  a press.
- **Teams, Players, Coaches**: sortable tables of the ratings; players searchable and filterable by team.
- **Record**: the season graded straight up, against the spread and on totals, by month and game, from
  `predictions.csv`; the suggested parlays and the model's picks against the closing line, season by
  season, from `research/backtest.json` (state.json's `vsMarket`, beside the two-biggest-favourites
  baseline); and the backtest table.
- **My Picks**: the visitor's picks, graded against the published finals; browser only.
- **Parlay Builder**: in the spirit of the NFL hub's. Suggested parlays at the top (Safe, Medium,
  Aggressive), grown from one core out of the games where the model's pick is also the market's
  favourite (the model's chance stands in where no line is up yet), likeliest first: the two likeliest,
  then more while the chance every leg lands stays above 50%, 30% and 15%. A leg's chance is the
  market's with the book's cut removed. (Ranking added legs by chance times payout, the first rule, ranked
  nothing: with chance and price from the same market the product is the same for every leg up to the
  book's cut.) A separate, labelled Value card lists the model's picks whose chance beats the market's by
  5 points or more, biggest gap first, shown for interest. Below, a day's plan: day, stake, confidence
  band (ALL, MED + HIGH, HIGH only), straight up or parlay, and a tickable table of the model's picks with
  the market's pick (outlined red where it disagrees), the band and the price. Straight bets share the
  stake evenly unless an amount is typed; a parlay shows its odds, payout and the chance it hits. Lock in
  sends bets to the Bet Build, which grades them as games go final, from `finals` in `state.json` once a
  game has left the slate. Prices are the book's moneylines (`moneyline.home.close.odds` on ESPN's odds
  object, DraftKings'); before a line is up they are estimated, from the spread or else the model's
  chance, with a typical book cut, and marked est.
- **How it works**: the model in plain words with the fitted numbers.

Nothing a visitor does reaches the published files. The job runs `publish.js`, `build.js` and the
smoke test after the models, and commits `state.json` and both pages.

## What comes next, in order

1. **Style matchups**: the four factors each team forces and allows (shooting, turnovers, rebounding,
   free throws) as a fitted term on the residual, on top of pace and efficiency.
2. **Player legs in the Parlay Builder**: DraftKings' props and the model on trial are on the page (README "Player
   props"); legs need the owner's call on the one-leg-a-game rule and a same-game correlation table like the NFL props
   model's, and nothing is suggested from the model until its shadow ledger passes.
