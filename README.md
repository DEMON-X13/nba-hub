# nba-hub

One repo, one scheduled job, one site. The job pulls last night's box scores and today's injury report,
replays a team model and a player, coach and matchup model, prices the slate, and commits the page.
GitHub Pages serves the repo root: `index.html` is the site, `admin.html` the same page with a Data tab.
The NBA has no weeks, so the unit is the slate, one Eastern calendar day. Ratings update after every
final, the job runs every morning, and the page shows the games from yesterday to ten days out.

## Layout

| Path | What |
|---|---|
| `data/games.csv` | Every game since the 2004-05 season, one row each: id, season (the year it ends), date, REG or POST, away, home, scores, neutral site, status, the home side's line and total when ESPN carried them, the source, the ESPN id, the tip-off, the two moneylines, and the national networks (`tv`, README "The lines feed") |
| `data/box_<season>.csv` | From 2021-22 on, one row per player per game: minutes, the box line, starter and did-not-play flags |
| `data/teambox_<season>.jsonl` | One line per team per game with every team statistic the feed gives (turnovers including team turnovers, points in the paint, and so on) |
| `data/injuries.json`, `data/injuries_log.csv` | Today's injury report by team, and one line per player per day so availability can be replayed later |
| `data/coaches.csv`, `data/coaches_espn.json` | Head coach by team and season, hand-kept for 2022-2026 with mid-season changes dated; and what the roster feed lists today, which covers the current season |
| `data/rosters_espn.json` | Each team's roster as the feed lists it today, so offseason moves are known before a game is played |
| `data/raptor.csv` | FiveThirtyEight RAPTOR 2020-2022, offence and defence per player: the priors |
| `model.json` | The team model: fitted parameters, the fit and holdout report, every team's rating after the last final, and its number on each game not yet final |
| `players.json` | The player model: parameters, the report against the team model, every current player's offence and defence, every coach, each team's strength and pace, tonight's numbers with lineups and absentees, and the rating history (`history`: every listed player's, coach's and club's rating after each final since the season before the one the ratings are carried into, each centred as its day ended, with the day-by-day centring) |
| `history.json` | The rating over time the page draws, from `players.json`'s history by `publish.js` (THE HISTORY): each series on the ladder its table shows, its change over 7 and 30 days and this season. The page reads it only when a window opens |
| `tools/lib.js` | The games table, team codes, dates, ESPN access |
| `tools/history.js` | One-time import of the history the team model is fitted on |
| `tools/fetch.js` | Daily pull of finals, the coming slate and its lines |
| `tools/fetch_box.js` | Daily pull of box scores, the injury report, the coaches and the rosters |
| `tools/elo.js` | The team model: replay, fit, report |
| `tools/players.js` | The player, coach and matchup model: replay, fit, report, tonight's lineups; logs the day's numbers to `data/predictions.csv` |
| `data/predictions.csv` | The number the site published on each game before it was played: the record is graded against this, never against a replay |
| `tools/publish.js` | Writes `state.json`, the one file the site loads: the slate, the record, teams, players and coaches (with their overall Elo on the ladder the tier shields are drawn on, and its change over 7 days), the backtest, the market table (`vsMarket`, from `research/backtest.json`), the props model's block, the last week's box lines a player's leg is graded from and the same-game table (README "Same-game parlays"); and `history.json` |
| `tools/lines.js`, `lines.json` | The lines feed (README "The lines feed"): DraftKings' game lines, with both prices and their betslip ids, and every player prop on the games of the next two Eastern dates with a game to come, read by the job from ESPN's free feeds after the props model |
| `tools/lines_feed.js` | DraftKings' game lines as ESPN's scoreboard carries them: the page's own reading (`oddsDkHref`, `oddsIdOk`, `oddsGameLines`), line for line, and lines.json's shape of it |
| `tools/props.js`, `props.json` | The props model (README "Player props"): each expected player's eleven stat distributions and double chances for the next five game days, its walk-forward and market tests (`research/props.json`) |
| `tools/props_feed.js` | DraftKings' player props as ESPN's feed carries them: the parse the job and the page share, the fair-chance rules |
| `tools/props_record.js`, `data/props_<season>.csv`, `data/props_reads.json` | DraftKings' closing main lines, read once after each final (2026: the play-in and playoffs ESPN still served) |
| `tools/props_ledger.js`, `tools/props_check.js`, `data/props_shadow.json`, `data/props_shadow_lines.csv` | The props shadow ledger: the model's call frozen at tip-off, graded against the closing lines, its pre-registered bar, and the check that holds it to the last commit |
| `app/nba_hub.html`, `tools/build.js` | The site, one file; `build.js` makes `index.html` (public) and `admin.html` (adds a Data tab with backup and restore) |
| `app/parts/parlay.html` | The Parlay Builder tab (README "Parlay Builder"): the NFL hub's choices, Top 50 lines, builder and level engine on this page's tokens, set into the page by `build.js` at its `<!--part:parlay-->` marker |
| `tools/sigma.js`, `research/sigma.json` | The spread of the real margin about the player model's own number, which the Parlay Builder prices a cover from (14.5 points, the 2026 walk-forward fold), and what the Value rule's team picks were worth on each fold; run by hand |
| `tools/smoke.js` | Loads the built viewer in jsdom with a fabricated game and checks the tabs, the tier shields and ladders, a bet graded as a book settles it, Refresh odds on a stubbed ESPN, the player props view on a press (section 8, README "Player props"), your parlay: player props and same-game legs (section 9, README "Same-game parlays"), the rating over time (section 10), the Pick'em Record (section 12, README "Pick'em Record"), the lines feed's readings held to the page's (section lines, README "The lines feed"), X Parlays (`tools/smoke_xparlays.js`, `SMOKE_ONLY=xparlays`, README "X Parlays") and the Parlay Builder (`tools/smoke_parlay.js`, `SMOKE_ONLY=pb`, README "Parlay Builder") |
| `liveparlays/parlays.json` | X's placed parlays, kept by hand from the slips the owner sends (README "X Parlays"); the page reads it when its X Parlays tab opens, and the job's `tools/autoclear.js` marks a finished one cleared two Eastern days after its last game |
| `app/parts/xparlays.html` | The X Parlays tab: its markup, its styles (all under `#lpCard`) and its script in a closure of its own, set into the page by `build.js` at its `<!--part:xparlays-->` marker |
| `tools/autoclear.js`, `tools/test_autoclear.js` | X's finished parlays clear themselves (README "X Parlays"); the test runs first in the job's step |
| `tools/corr.js`, `data/corr.json`, `research/corr.json` | The same-game correlation table (README "Same-game parlays"): measured on the finished seasons' box scores, written by the script only; the report beside it |
| `tools/backtest.js`, `research/backtest.json`, `research/backtest_games.csv` | The walk-forward of the model's picks and the earlier Parlay Builder's suggested parlays (its rules kept in the file as a frozen copy since 25 October 2026) against the closing line, run by hand; `publish.js` reads its summary into state.json's `vsMarket` for the Record tab |
| `tools/fetch_odds_hist.js`, `data/odds_hist.csv` | The closing lines on the 2023-2026 finals from ESPN's game summaries: a finished backfill, run by hand from a machine that reaches ESPN only to add a season (the daily job keeps each game's closing moneylines in `games.csv` from now on); its `check()` is shared with `backtest.js` and `corr.js` |
| `tools/test_corr.js` | The bivariate normal, the fit, the lookup's sign rules, and the committed table held to its rules |
| `tools/test_props.js` | The props parse, record, model, ledger and bar on stubbed answers and a scratch folder |
| `tools/test_lines.js` | The lines feed on the recorded answers and made-up ones, through a stubbed reader and a scratch file: the parse, the drops, the last good read, the quiet run, and the committed lines.json held to its shape |
| `tools/fixtures/` | ESPN answers recorded on 2026-10-15: scoreboards (finals, preseason lines, opening night's lines), which the smoke holds the page's reading of to `fetch.js`'s; two more recorded on 2026-10-25 (that Sunday's seven games with DraftKings' lines and their local and national listings, and Tuesday 27 October's, Peacock and NBC beside a home market's network), on which `test_fetch.js`, `test_lines.js` and the smoke hold the national networks and the lines feed; and one game's DraftKings props (opening night, Celtics at Pistons), which `test_props.js` and the smoke hold the parse to; and that morning's rosters and injury report as the props model reads them (`props_live_20261015.json`), on which `test_props.js` holds the live minutes to the backtest's |

No dependencies for the job's tools: Node 22 and its built-in fetch. The smoke test needs jsdom (`npm ci` in `tools/`).

## Data

- **History**: Neil Paine's continuation of the FiveThirtyEight NBA Elo game file
  (`github.com/Neil-Paine-1/NBA-elo`), every game since 1946 with scores. Seasons from 2005 on are
  kept. It runs to 2025-03-17. `history.js` maps its team codes onto this site's and folds defunct
  franchises into their current team (Sonics into OKC, Nets into BKN, the two Hornets into NOP and CHA).
- **From 2025-03-18 on**: ESPN's public scoreboard feed,
  one request per day. It gives finals, the schedule about ten days out, the neutral-site flag (the
  Cup final), the national networks a game is on, and a consensus line and total on games not yet played. It looks thirty days ahead so
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
| home court, to start | 60 Elo | 2.2 |
| altitude, on top | 60 Elo | 2.2 |
| back to back | -40 Elo | -1.5 |
| three in four | -5 Elo | -0.2 |
| three days off | +5 Elo | +0.2 |
| season carry | 0.70 | |
| scale | 26.7 Elo per point | |

The home court is where the fit starts it (`params.hfa`); from there it is learned as the finals come, a thousandth of
the way toward what each home margin said, and `model.json`'s `homeEdge` is where it stands. Home teams win less
than they did in the fit's seasons, and a fixed 60 priced every home side about three points of win chance too high
in 2023-24 to 2025-26 (the model said 58% on average, home teams won 54.5-55.5% and the market said 55%); learned, it
stood at 44 Elo for the team model and 42 for the player model on 23 October 2026.

Holdout (2022-23 on, 5,310 games to 23 October 2026, `model.json` `holdout`): 65.9% straight up, log loss 0.617
(0.6167; 0.6173 with the home court fixed), spread error 11.0 points. That is what a public NBA Elo does. It picks winners; it does not know who is playing tonight.

## The player, coach and matchup model

Every player carries two ratings, offence and defence, in Elo points for a player on the floor all
game. A team's strength for a game is 1500 plus its coach plus each player's ratings weighted by his
share of the minutes, five shares in all, so a team is exactly the sum of who plays and how much.
The situational terms (court, altitude, rest) are the team model's, with the home court learned the same
way and on its own (players.json's `homeEdge`); learning it lowered the walk-forward log loss in every
backtested season and lineup mode (known lineups: 0.6152, 0.5932 and 0.5914 to 0.6139, 0.5917 and
0.5906). One term is the player model's own, **travel** (October 2026): a side whose last game was two days or less
before loses `tz` Elo for every hour between that venue's clock and this one's. A game's venue is its home club's and
a neutral site has none; both clocks are read on the game's date, so Phoenix sits with the Pacific clubs from March
and a club that stays put over the clocks' change has crossed nothing. A coast-to-coast trip on a back to back costs
about 30 Elo, a point. The fit took 10, the top of its grid, in every season it was given (on the fit seasons alone 15
to 20 scored a shade better; the grid was set before the test and is kept). Blending the model with the market's
chance where a moneyline is posted was tested the same way and given no weight: fitted on the seasons before, the
best blend was the market alone (a test run by hand in October 2026; the script was not kept).

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
2022 warms up; 2026 on held out. Every knob has an off value the search can choose, so the fit decides what to use.
The live parameters (`players.json` `params`) are the search's of 20 September 2026 with travel added in October:
efficiency surprises clipped at 20, moving a full-time player 0.5 Elo per point; a win update of 6 Elo on the result
beside the efficiency one; the update falling on players by the square root of their minutes share (so bench players
move relatively more); playoff updates at half weight; season carry 0.7 for players; rookies start at -80; RAPTOR
priors scaled by 1.25; a tenth of the team model's difference blended in; travel at 10 Elo an hour. Off: each
player's own plus-minus, shrinkage toward the prior, recency weighting of minutes. The coach term fits to zero; it is
kept at 0.05 per point of the two sides' efficiency surprise so the coach table means something, at no measurable
cost (0.0002 of log loss on the fit seasons, and slightly better on 2026 cold).

**The October 2026 refresh.** Seven ideas were each walked forward on 2023-24 and 2024-25 (the fit choosing the
knob from the seasons before each, nothing tuned on the season scored), with the rule set before: lower log loss in
both seasons, by 0.0005 between them, and the spread error no worse. One passed, travel, and was then scored once on
2025-26, which none of the others had seen. Change in log loss with the lineup known (lower is better):

| Idea | 2023-24 | 2024-25 | Kept |
|---|---|---|---|
| Travel: Elo off per time zone crossed on two days' rest or less | -0.0008 | -0.0004 | yes: 2025-26 -0.0008, accuracy level, spread error +0.01 |
| Faster updates in a player's first games of a season (or a club's) | 0 (the fit left it off) | -0.0008 | no |
| The rest and altitude terms fitted by the player model | -0.0004 | +0.0019 | no |
| The home edge's learning rate and start | -0.0007 | +0.0001 | no |
| A calibration temperature on the win chance | +0.0014 | -0.0030 | no |
| Young players (no RAPTOR prior) gaining at the season's turn | 0 (off) | +0.0005 | no |
| The team model refitted with the home court learned, and with faster early-season updates | +0.0001 pooled on 2023-2025 | -0.0006 pooled, halved and inside the noise at the scale a refit publishes | no |

A full refit of the player model on today's code (`node tools/players.js research`) was scored against the live
parameters on 2025-26 and not taken: lineup known 0.5889 against 0.5893 for the live parameters with travel, but
with no report 0.6043 against 0.6007, and 68.3% straight up against 69.8%. It turns plus-minus on and the team
model's blend off, which helps when the lineup is known and hurts when it is not, and the site runs between the two.
The live parameters with travel beat the live parameters without it both ways (lineup known 0.5893 against 0.5902,
no report 0.6007 against 0.6015). That choice looked at 2025-26, so 2025-26 is no longer untouched for it.

The holdout, 2025-26 and the season in play so far (1,350 games to 23 October 2026, `players.json` `report`, which
the Record tab's backtest table shows), four ways:

| | Log loss | Straight up | Spread error |
|---|---|---|---|
| Team model | 0.603 | 68.4% | 11.58 |
| Player model, previous game's lineup (no report) | 0.601 | 67.6% | 11.52 |
| Player model, lineup known, minutes projected (a good report) | 0.590 | 69.7% | 11.37 |
| Player model, actual minutes (perfect lineup knowledge) | 0.588 | 69.8% | 11.33 |

Totals: 15.1 points of error.

### Walk-forward test (`node tools/players.js research`, writes `research.json`)

One holdout can flatter a model, so each finished season from 2024 on is also scored cold: the parameters are
searched again on only the seasons before it, then that season is played through once (a season with games still to
play is not a fold). On the October 2026 code, travel among the knobs. Log loss / straight up / spread error:

| Season scored | Team model | Player model, no report | Player model, lineup known | Player model, actual minutes |
|---|---|---|---|---|
| 2024 | 0.609 / 66.0% / 11.07 | 0.615 / 67.7% | 0.613 / 66.3% / 11.28 | 0.610 / 67.0% |
| 2025 | 0.609 / 65.4% / 11.13 | 0.600 / 67.7% | 0.591 / 67.6% / 10.96 | 0.589 / 68.9% |
| 2026 | 0.601 / 68.8% / 11.53 | 0.603 / 66.7% | 0.589 / 68.5% / 11.38 | 0.588 / 68.8% |

With one season to learn from (2024) the player model is not yet ahead of the team model. With two or three it is
ahead on log loss with the lineup known, by 0.01 to 0.02 (0.018 in 2025, 0.012 in 2026); with no report it is only
level with the team model (0.009 ahead in 2025, 0.002 behind in 2026). The gap between "no report" and "lineup known"
is the injury report's worth: about 0.01 of log loss (0.008 in 2025, 0.014 in 2026).

### What each piece is worth (2026 cold, the refit's parameters fitted on 2023-2025, one piece switched off)

| Switched off | Log loss | Straight up | Change |
|---|---|---|---|
| nothing (the refit) | 0.5889 | 68.3% | |
| rookies start at zero instead of below average | 0.5979 | 69.2% | +0.0089 |
| no plus-minus | 0.5920 | 69.1% | +0.0030 |
| no win update, efficiency only | 0.5909 | 68.5% | +0.0019 |
| no travel | 0.5898 | 68.0% | +0.0009 |
| no RAPTOR priors | 0.5895 | 68.4% | +0.0005 |
| update by minutes share, not its square root | 0.5892 | 68.3% | +0.0002 |
| playoffs updated at full weight | 0.5888 | 68.2% | -0.0001 |

The priors carry the most: a rookie really is below average, and last season's RAPTOR is a better
start than zero. Plus-minus is worth 0.003 here with the lineup known, and costs more than that with no report (the
refresh above), so it stays off. Adding a signal that does not survive the walk-forward is how a model gets weaker
while looking stronger.

The "lineup known" rows are scored with who actually played: a perfect injury report, which the site
does not have. What runs here, the roster minus the report's absences filled to 240, has not been
scored on its own; it sits between "lineup known" and "no report".

What the ratings say after the 2026 Finals: Gilgeous-Alexander first, then Jokić and Leonard;
Daigneault, Mitch Johnson and Bickerstaff the top coaches. The Teams tab has the live order of the teams.

The site's own numbers through the 2026-27 preseason (graded once it ended, from the state.json each run
published before tip-off): 26-28 straight up over 54 games, and of the six suggested parlays it showed on
13 and 14 October, Safe and Medium on the 14th won and the other four lost. Preseason games are never in the
record.

## Player props

DraftKings' NBA player props, read from ESPN's free feed, with the hub's own projection beside each line. The owner's
go-ahead, 15 October 2026. **The model is on trial**: it has not been shown to beat DraftKings, so it is shown beside
DraftKings' line and fair chance, and nothing in the Player props view says "model says" or "edge" on a prop until the
shadow ledger (below) has passed its bar. Until 25 October 2026 it suggested nothing; since then (the owner's call) the
Parlay Builder's Top 50 lines take a player's line where its chance clears their bar, Value picks among them, each marked
**on trial** beside its chance there, in the builder and on a level's card (README "Parlay Builder"); a failed bar takes
every prop off the list. A DraftKings price in the view is also the control that puts that leg in the visitor's own
parlay in the Parlay Builder, at DraftKings' price (the owner's go-ahead, 15 October 2026, README "Same-game parlays").

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
  research: { market: {...the archive test} }
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

Every game still to come has a **Player props** button on its card on Tonight (44px, beside Lineups). It opens that game's props in a sheet: a window over the page on a wide screen, the whole
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
to beat DraftKings and its chances are marked on trial wherever they show (the Parlay Builder's Top 50 lines take its
lines since 25 October 2026), with the walk-forward and the market test in brief and the shadow ledger's running
numbers. The Record tab gives the ledger quietly: how many of the 30,000 graded lines are in, and the model
against DraftKings on log loss and Brier, never a verdict or a word of one before the bar is decided (a PASS, when it
comes, is said to move nothing by itself). Nothing in the view says "model says" or "edge". From the view a prop goes only into the
visitor's own parlay, by their tap on DraftKings' price (README "Same-game parlays"); the Parlay Builder's Top 50 lines
reach the same lines on their own rules, marked on trial (README "Parlay Builder").

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
tips while its props are read, one ESPN still calls scheduled with its own tip passed and the published one to come
(dated by ESPN's tip, as the page's parse dates a row, so it holds across midnight Eastern), and on a second press a game whose page 2 is a 404, which keeps its earlier read whole); every line, rung and Yes price the sheet shows worked out on its own from
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
node tools/smoke.js               # the page; section 8 is the props view, section 9 your parlay; ends "all good"
```

## Same-game parlays

Player legs in the Parlay Builder, the owner's go-ahead of 15 October 2026: a visitor builds a parlay of their own from
DraftKings' player props and game lines, with more than one leg of a game where DraftKings would take them together,
priced as a same-game parlay from a correlation table measured on the hub's own box scores. Since 25 October 2026 the
builder is the NFL hub's Parlay Builder (README "Parlay Builder"), whose Top 50 lines add legs to the same parlay by the
same rules and price it by the same engine; every leg in a visitor's parlay is still the visitor's own Add or tap.

### Your parlay, on the page (`app/nba_hub.html`)

**Adding a leg.** After a Refresh odds press, every DraftKings price in a game's Player props is the control that adds
that leg: each main line's Over and Under (points, rebounds, assists, threes, steals, blocks and the five combos), each
milestone (k+), each double- and triple-double, and a Game lines block over the players with the game's moneylines,
spreads and total, read from the same press's scoreboard answer (`oddsGameLines`: DraftKings' own two prices on each,
the spread and the total only where their number is the one the page shows, and each outcome's betslip id from ESPN's
link, kept only in its side's shape and naming the line's own number, as the NHL hub keeps them). Each is a real button,
44px, in the tab order, named for what it adds and pressed while that leg is in. A tap puts the leg in at DraftKings'
price as read, dated by the read; a second tap takes it out; the sheet's foot says what the tap did and shows the parlay
in a line ("Your parlay: 3 legs, +441 est."), with a button to it. Before a press there is nothing to add.

**Kept, and read again.** The legs are the visitor's own, in the page's one key (`nba_hub_2027`, `slip`): the game, its
clubs, date and tip, the player (ESPN athlete id, name, club), the stat, the line or the milestone, the side, DraftKings'
price and the other side's, the read's time, and a game line's betslip id. Nothing else from a read is stored. A reload
keeps every leg at the price it was added at, dated ("as read 9:58 AM"). A later press that reads a leg's line again
takes its new price and time; a line DraftKings has moved, no longer lists, or a game whose props it has taken down
(ESPN's 404) takes the leg out; a read that fails leaves it as it was. What a press changed is said once, in Your parlay
and in a word on the press's own status line ("Your parlay: 2 legs left it and 1 took a new price"). A leg leaves at
its game's tip, said once, on any tab.

**What goes together.** Legs of different games join as they always have. In one game:

| | Taken | Refused, with the reason said |
|---|---|---|
| Side bets | the moneyline or the spread, on one team | the other team's side, or the moneyline beside the spread |
| Total | the Over or the Under, once | the total twice |
| Player legs | one a player a stat (a milestone is its stat's leg); two stats of one player; teammates, opponents, beside the side and the total | his stat beside a combo holding it (points with points + rebounds), two combos sharing a part (points + assists with points + rebounds), his double- with his triple-double |

DraftKings publishes no list of what it takes on one same-game ticket that this build could find, so the builder is
conservative: the refused pairs are `data/corr.json`'s, which `tools/corr.js` also leaves unpriced (a stat beside a sum
holding it is not jointly gaussian at these lines: steals with blocks measure 0.07, steals + blocks with steals 0.90 and
with blocks 0.78, three values no correlation matrix holds). Points with threes, and a double- or triple-double with
points, rebounds or assists, are taken. A player leg on a preseason game is refused (no box score is pulled for one, so
it could never be graded), and so is a second leg of a game beside a player the hub places on neither of its clubs (no
table names him, or the tables put him on another club, as after a trade they have not caught up with): priced as
everyone's opponent, his sign with a side bet would be turned, so he goes alone in his game.

**The price.** Different games: the legs' prices multiplied, as a book does. One game's legs, as the NFL hub prices a
same-game parlay (`parlayDec`, `SGP_HOLD`): their joint chance J from each leg's implied chance (its price's own, the
margin left in) joined by a gaussian copula with the rho of the table below, and the price min(the prices multiplied,
HOLD / J), never above the product. Two legs exactly (`joint2`, tools/corr.js's bivariate normal); three or more by the
GHK simulator on 20,000 points of a shifted Halton sequence, a fixed seed, so a parlay always prices the same (within a
few parts in 100,000 of the exact integral on three legs; a plain simulation of the NFL hub's kind was off by parts in
1,000 at that count). The price is an estimate and says so wherever it shows (est.), with the line "DraftKings prices
same-game parlays its own way: this is an estimate from the legs' prices and how they move together", and the legs
multiplied beside it.

**The chances.** The summary leads with DraftKings' fair chance of the whole parlay: each leg's (a player's main line
with the whole margin on the Over, as the Player props view; a milestone's or a Yes price's by the rung rule, est.; a
team line's two prices with the margin taken out in proportion, the page's market chance) joined the same way, est.
wherever a same-game correction or an est. leg is in it. The model's chance stands beside it only where every leg has
one (a player's from the props model, labelled on trial; a moneyline's from the game model; since 25 October 2026 a
spread's from the game model's margin and a total's the market's own, README "Parlay Builder"). Then the price and what
the stake pays.

Until 25 October 2026 **Lock in** put the parlay in the Bet Build; the Bet Build is gone (README "Parlay Builder", "What
went"). **Finish parlay** shows it as a card (Eastern time, since it goes to other people): each leg with its price and read
time, the price est. with the legs multiplied, the fair chance first, what the stake pays, the model's chance where
every leg has one (on trial with a player leg) or the line saying why there is none, Open in DraftKings and Share link.
ESPN's feed carries no DraftKings betslip id for a player's line, so each player leg says "DraftKings' player lines
carry no betslip id in ESPN's feed: add this leg by hand"; the betslip link (`sportsbook.draftkings.com/?outcomes=`)
opens the game lines that carry an id, the note under it says which legs it opens, as DraftKings had them at the oldest
read, and which to add by hand, never that every leg lands; with no id it opens the game's page or DraftKings' NBA page.
Share link sends one text (a title and the text, never a url field, as on the NFL and NHL hubs) with each leg, the
betslip link alone on its line and the legs to add by hand with why; with no share sheet the same text is copied.

### Grading a player's leg

Once its game is final, a player's leg is graded as DraftKings settles it, from the box score: the stat as the box has
it (a combo the sum of its parts; a double- or triple-double two or three of points, rebounds, assists, steals and blocks
at 10 or more), a push on a whole line, void for a player who did not play (the box lists him as not playing, or not at
all). A leg on a game not played on its date is void too, as a team bet on it is: a game the published slate has called
off, or one on no published list two days after its date ("not played on its date"). A void or a push drops out of a
parlay, and a same-game parlay is then priced again by the same rule on the legs left (one leg left pays its own
price). A leg whose game is final and whose box score is not read yet waits. Until 25 October 2026 a grade once made was
written into the visitor's own Bet Build entry (`res`: the result and the stat); the Bet Build is drawn no more, and its
kept bets are graded by `NBA_GRADE.gradeBet` when asked, a grade written then still read first.

The smallest honest way to give the page what it grades from: `state.json` carries `boxes`, the box line of every player
who played in each regular-season and playoff final of the last seven days ([points, rebounds, assists, threes, steals,
blocks] by ESPN athlete id, about 36 KB at a full week of games), and nothing else. A leg still ungraded once its game is
older than that (a visitor who does not look for a week) is graded from `data/box_<season>.csv`, which Pages serves, read
once a page load, no-store, only then. `corr` carries the table's rho, the refused pairs and the hold, said untested.

### The correlation table (`tools/corr.js`, `data/corr.json`, `research/corr.json`)

`node tools/corr.js` (about four minutes, the same output every run) measures it on the finished seasons only, never the
season in play (it refuses to read one): the shipped table on 2022-23 to 2025-26, 5,276 games and 94,613 player-games of
players projected 12 minutes or more (about the players a book lines). Written by the script, never by hand.

- **The legs.** Each is a yes/no outcome at the line a book would hang: a player's stat at the half point where the
  props model, as it stood that morning, gives the Over the chance nearest 50%; his double- and triple-double at the
  model's own chance; his club's win, cover and the game's Over at the closing lines (`data/odds_hist.csv`). Each kind's
  chances are moved by one shift on the normal scale so they average what happened, so rho measures how two legs move
  together and not the model's miss.
- **The estimate.** For every pair of leg kinds that shared a game, rho is the maximum likelihood of the four outcomes
  (both hit, one, the other, neither) under the bivariate normal, each pair at its own two thresholds: a tetrachoric
  correlation, which is what the copula consumes. Not a correlation of the stats' normal scores: steals, blocks and threes
  are counts of 0, 1 and 2, whose normal scores would understate it.
- **Thin pairs.** Each rho carries a jackknife error over groups of games and is shrunk toward 0 by it (empirical Bayes
  within its relation); a pair with under 300 observations, under 5 expected in any outcome, or a likelihood peaking at
  |rho| 0.97 or more is 0. Two teammates' triple-doubles (4 of 10,228 pairs both) measure 0.04 with an error of 0.12, so
  they shrink to 0 (the positive-definite repair below then moves them to 0.03, which is what the page prices).
- **Positive definite in use.** As measured the table is not (least eigenvalue -0.515), mostly because triple-double pairs
  are measured on the few players who can get one. It is moved to the nearest table that is positive definite over every
  leg one game can carry (13 players a side, every kind each, the win, the cover and the total: 341 legs), each value held
  by its precision, and checked by a Cholesky factor of that whole matrix (least eigenvalue 0.029), so any set of legs the
  builder can join is valid. Most values barely moved (one player's pairs 0.009 on average); the largest moves are
  triple-double pairs (assists with a triple-double 0.875 to 0.799, points with one 0.115 to 0.192); a player with his
  club's result moved 0.042 at most, teammates and opponents 0.03.

The table in brief (the sign turns for each Under, and for a side bet on the other club):

| Pair | rho |
|---|---|
| One player | points-rebounds 0.33, points-assists 0.21, rebounds-assists 0.25, points-threes 0.74, points-steals 0.19, steals-blocks 0.07, rebounds-double-double 0.72, points-double-double 0.43, assists-triple-double 0.80, rebounds-triple-double 0.61 |
| A player with his club's win | points 0.13, rebounds 0.11, assists 0.10, points + rebounds + assists 0.16, double-double 0.14, triple-double 0.17 (with the cover about the same: points 0.12) |
| A player with the game's Over | points 0.13, assists 0.11, threes 0.11, points + assists 0.15, rebounds -0.07, blocks -0.03 |
| Teammates | about 0: points-points -0.024, assists-points +0.034, all within 0.04 (the largest assists-threes +0.039) |
| Opponents | about 0, all within 0.02 (the largest blocks-double-double +0.019) |
| The side bet with the total | 0 (measured 0.03 with an error of 0.02; the repair took it to 0, as the NFL hub uses) |
| A player with his club's points | 0.19 (points + assists 0.22): measured, not used, since no team-total leg is offered |

**Validated** on a season the table never saw (the table measured on 2022-23 to 2024-25, tested on 2025-26), the joint
hit rate of every two-leg combination the builder could join, as the copula says, as the plain product (independence)
says, and as happened:

| Test | Combinations | Happened | Copula | Independence |
|---|---|---|---|---|
| DraftKings' closing lines, 2026 play-in and playoffs (83 games, 11,395 lines; DraftKings' fair chances as the margins), the copula saying more likely | 156,652 | 26.00% | 26.17% | 23.79% |
| the same, the copula saying less likely | 156,949 | 21.49% | 21.44% | 23.81% |
| one player's two legs, more likely | 62,877 | 28.05% | 29.06% | 25.02% |
| one player's two legs, less likely | 63,030 | 21.63% | 20.63% | 24.67% |
| 2025-26 regular season, model-set lines (1,237 games), more likely | 4,969,386 | 20.71% | 20.80% | 18.93% |
| the same, less likely | 4,890,948 | 17.24% | 17.28% | 19.18% |
| milestone lines (the Over at about 30%, the main line's rho), more likely | 2,967,391 | 8.72% | 8.94% | 7.87% |

Log loss of the combination landing, copula minus independence, on DraftKings' lines: one player's two legs -0.0055
[90%: -0.0066, -0.0044], a player with a game leg -0.0015 [-0.0019, -0.0011] (teammates and opponents 0.0000). By lift
the copula's predicted lift matched what happened on the regular season (1.452 said, 1.446 happened, in the 1.3 to
1.6 band; 0.497 and 0.495 below 0.7), and ran high only at the very top (1.73 said, 1.60 happened, above 1.6). Rho measured at milestone-like lines differs from the main line's by 0.007 on average
(0.02 at most), so a milestone uses its stat's main-line rho. ESPN keeps no regular-season DraftKings
lines, so those lines are the model's; and no spread or total prices are on file for past games, so in the DraftKings test
those legs sit at even odds.

### The same-game hold

No DraftKings same-game price is recorded anywhere this hub reads (ESPN's feed carries none), so HOLD is the NFL hub's
0.896, fitted there to two real DraftKings tickets on Detroit at Buffalo (cuts of 0.852 and 0.942, their geometric mean),
**untested on the NBA**, and the page and `state.json` (`corr.holdTested: false`) say so. It applies to J of the implied
chances, as the NFL fitted it: applied to the fair joint it would overpay correlated tickets by about a tenth. Worked
examples (`research/corr.json` `hold.examples`, both legs -110/-110): one player's points Over and rebounds Over, 3.64
multiplied, 2.74 with the hold; two teammates' points Overs, 3.64 and 3.31 (the hold alone cuts 10.4% from
independent legs, as it does on the NFL hub; this pair's slight negative rho, -0.024, gives a little back, so about 9%
here); one player's points Over and rebounds Under, held at the 3.64 product.

### Live, 15 October 2026

In Chromium against ESPN at 1280 and 390 wide (the third look, 20:05 UTC, after the review's fixes): one press read 57
games' lines (20 with DraftKings' lines, 37 with none yet) and their player props (5 games with props posted, 166 main
lines, 52 with none yet), nothing read on load or on a reload, every request a plain GET with no header of its own, none
failed at either width. Celtics at Pistons on opening night had DraftKings' game lines with every betslip id, its sheet
offered 441 add controls, every one 44px or more, and its six lined players were each placed on one of its clubs. (The
second look's "11 could not be read" at 1280 was the test browser's, not a visitor's: ESPN answers HeadlessChrome's user
agent with a 403 and no CORS header and a real browser's with the answer, so the desktop run now gives Chrome's own user
agent.) Two Pistons' points and the total went in, and Cunningham's points + rebounds + assists beside his points was
refused with its reason:

| Leg | DraftKings | Fair chance |
|---|---|---|
| Cade Cunningham, points Over 24.5 | -104 (Under -123) | 44.8% |
| Jalen Duren, points Over 14.5 | -123 (Under -103) | 49.3% |
| Total Over 221.5 | -115 (Under -105) | 51.1% |
| The parlay | legs multiplied +565; same-game price +427 est. | 13.0% est. (11.3% multiplied) |

The two teammates move apart a little (teammates' points -0.024) and each with the Over (0.13), so the three landing
together is likelier than the product says, and the estimate pays less: $20 pays $105.30 where the product would pay
$132.97. The page's numbers are Node's from `data/corr.json` and `tools/corr.js` (J 0.17018 of the implied chances, so
0.896 / J = 5.2650, the page's 5.2650; the fair chance 0.13027 on both). The sheet's foot read "Your parlay: 3 legs,
+427 est."; the card opened the total on DraftKings' betslip (`?outcomes=0OU85841510O22150_1`) and named the two player
legs to add by hand; Share link sent a title and a text, no url field; storage held the three legs and nothing else of
the read; a reload showed them at the prices they were added at, dated by their read, and asked ESPN for nothing;
neither width scrolled sideways. (The first look, 14:02 UTC, had Derrick White's points Over 15.5 at -113 and Jayson
Tatum's Over 26.5 at -106 with the total: +441 est. where the legs multiplied paid +585; the second, 19:10 UTC, White at
-123 and Tatum at -112: +409 est. against +542.)

### The checks

Since the Parlay Builder of 25 October 2026 (README "Parlay Builder") section 9 holds the builder in its place: its
four figures, rows and same-game note against the sums below, the Bet amount typed into it, Finish parlay, the kept Bet
Build undrawn and graded by `NBA_GRADE.gradeBet`, and no Lock in; the levels, the plan and Lock in it names below are
gone, and the breaks in the table were planted on the page as it then stood. `node tools/smoke.js` section 9 holds it
all with rules of its own, on a stubbed ESPN (the recorded opening-night props
and scoreboard answers, and made-up games in their shapes): nothing to add before a press; after one, every price an add
control, 44px, named, in the tab order; the recorded game lines and ids read as ESPN has them, another book's odds, a
spread on another number, a total on another number or with its Over and Under on two, and ids in the wrong shape
refused; every leg added stored with its read time and nothing else of the read; the sheet's foot (a single leg at its
price, two legs of one game at the same-game price worked out here and marked est., a leg in each of two games at their
prices multiplied with no est.); each refusal with its reason (a combo holding a stat, a milestone beside the main line,
an Under beside the Over, a triple-double beside a double-double, two totals, the moneyline beside the spread or the
other team's, a preseason player leg, and another leg of the game beside a player no table names or one the tables put
on another club, whichever comes first, each taken alone); the price, the fair chance and the model's chance of eight
two-leg pairs of every kind worked out here exactly from `data/corr.json` and `tools/corr.js`, and of three legs by this
file's own integration (to 0.02%), never above the product; eight more sets of three and four legs of one game priced
one after another in one page session, each against that integration (four legs by its extension to a fourth, to 0.1%),
three of them at one set of implied chances with other relations, priced apart; the summary and the card leading with
the fair chance, est., the price est. beside the legs multiplied, what the stake pays to the cent (a stake typed into
the Stake box, $37.50, not the $20 every store there starts on, followed by the summary, Lock in, the card, its Share
text and the Bet Build), the why line, the model's chance labelled on trial (a second card, on a parlay with a model
chance on every leg) or absent with its reason, and neither saying "edge" or "model says"; the suggested parlays and the
plan byte for byte the same with legs in and without; the card's legs, add-by-hand lines, betslip link and note, Share
text (what the stake pays, to the cent), copy, Escape and focus, and the note and Share text dated by the older read
when the legs it opens were read at two presses; Lock in (staked $37.50, to win the same-game price's profit on it); a
reload; a later press moving, dropping and repricing legs, a failed read keeping one, a none-posted read dropping one,
said once; a tip; grading seventeen bets by its own sums (a void leg dropped and the
same-game parlay repriced, a push, a milestone, a double-double, a triple-double short, an Under, a final with no box
waiting, a leg three weeks old read from its season's box file, a double-double of rebounds and blocks and a
triple-double of points, rebounds and steals, a same-game parlay with a player's whole line pushing priced again on the
two legs left and one with the total pushing paid at the leg left's own price, a player's leg on a game postponed in the
slate and on one off every list two days past its date void with the stake back, alone and beside a winner) and a
straight bet on every other stat (each combo, threes, steals and blocks, by its own sum of the parts); from the season's
box file, four players' every stat and combo, each at a whole line at this file's own sum of the file's columns (every
column a different number on a row, rebounds both boards), so only the exact value pushes, and their double- and
triple-doubles (one through blocks, one through steals); the grades written into the Bet Build (a called-off game's void
with its reason) and holding with the box scores gone; and the page's copies of `tools/corr.js` (`rhoFor`, `joint2`,
`bvnUpper` and their pieces) and `tools/props.js` (`normCdf`, `normInv`) line for line. Section 0 holds `state.json`'s
`boxes` to `games.csv` and the box files (today, and a full mid-season week through `publish.js`'s own `boxesState`) and
its `corr` to `data/corr.json`. `node tools/test_corr.js` holds the table (the workflow's tests run it now). Each check
was shown to fail on a planted break: `NBA_HTML=<copy> SMOKE_ONLY=9 node tools/smoke.js` runs section 9 on a broken copy
of the page.

The 75 breaks (70 in the page, 5 in `publish.js`, the latter run in a scratch copy of the repo: publish, then sections 0
and 9), each red. The second sweep's first run left one green, a combo graded without its rebounds: no check graded a
combo, so the straight bets on every stat went in, and it and two more breaks of the same kind turned red. A review then
planted six that passed every check (the box file's rebounds and assists read from the wrong columns, the foot's price
without its est., the card dated by the newest read, a total on another number offered, the unplaced player's refusal
deleted); the checks above went in for them, and the third sweep, these 13 among them, left none green. A second review
planted four more that passed every check (a double- or triple-double counted on points, rebounds and assists alone, a
push kept in a same-game parlay's reprice, the void for a game called off deleted, the same-game cache keyed by the
chances alone) and found the card's payout and model tile read by nothing; the checks went in for those, and the four
and six breaks of the card (the last ten rows) are red:

| Planted break | What failed |
|---|---|
| the Over leg added at the Under's price | 10 checks: the stored leg, the sheet's words, the summary, the card |
| the hold taken on the fair joint, not the implied chances | the eight two-leg pairs, three legs against the integration, the summary, Lock in's price |
| the same-game price not capped at the legs multiplied | the pairs (the Under pair pays more than its product) |
| one game's legs joined with no correlation | the pairs, three legs, the fair chance, the price shown |
| an Under's sign ignored in the copied `rhoFor` | the pairs with an Under; the copy's text |
| no one-side-bet-a-game rule | 22: the spread and the other moneyline taken, and everything priced after |
| refused pairs not refused | 24: points + rebounds + assists beside points, a triple-double beside a double-double, and after |
| no one-leg-per-player-per-stat rule | the milestone and the Under beside the Over |
| two totals allowed | the Under beside the Over |
| a player leg on a preseason game allowed | the preseason refusal and the legs after |
| the price tile not marked est. | the price, marked est. |
| the why line reworded | the builder's and the card's why line |
| the first tile the model's chance, not DraftKings' fair chance | the summary leads with the fair chance |
| the fair chance not est. on a same-game parlay | the pairs, the summary, the card |
| a model chance shown where a leg has none (the total) | the pairs, three legs, no model chance with its reason |
| the model not labelled on trial in the builder | the model's chance labelled on trial |
| the props read stored with a leg | storage holds the legs and nothing else |
| a reload re-dating the legs | the later press's re-read (the read no longer newer than the legs) |
| a moved line kept | 7: the re-read, said once, the status line, the tip |
| a new price not taken | the re-read |
| a leg kept past its tip | the tip |
| a push on a whole line graded lost | the ten bets, the grades written |
| a player who did not play graded lost | the ten bets, the grades written |
| a same-game parlay with a void leg paid at its locked price | the ten bets, the grades holding |
| a final with no box read graded at once | the ten bets, the waiting leg's title, the grades written |
| no box file read for a leg past the window | the ten bets, the one read, the grades |
| grades not written into the Bet Build | the grades written, the grades holding |
| the card's add-by-hand line dropped | the card's legs |
| player legs put on the betslip link | the card's legs, the link, its note, the Share text |
| a url field in the share | Share link sends a title and a text |
| the suggestions drawn differently with legs in your parlay | the levels and the plan byte for byte |
| the add control under 44px | each at least 44px |
| a leg dated when added, not by its read | the stored leg |
| the control losing the focus on a tap | the control keeps the focus |
| a game line's id kept in the other side's shape | the junk cases |
| a spread on another number than the line shown offered | the junk cases |
| the game lines read with no ids | the recorded ids, the card's link |
| a leg kept when DraftKings takes its game's props down | the none-posted press, and after |
| the moneyline leg worded otherwise | the refusal's words |
| the levels drawn without the games your parlay has legs on | the levels and the plan byte for byte |
| a game with two of your legs taken out of the levels | the levels and the plan byte for byte |
| a void player leg graded won | the ten bets, the grades written |
| a double-double needing three categories | the ten bets, the grades written |
| a combo summed without its rebounds | the straight bets on every stat |
| steals graded from the blocks column | the straight bets on every stat |
| threes graded from the steals column | the straight bets on every stat |
| three legs of one game priced on the plain product | three legs against the integration |
| the sheet's foot price not marked est. | the foot with two legs of one game, and after the reload |
| the box file's rebounds from the defensive board alone | the box file's bets, and the grades holding |
| the box file's assists from the steals column | the box file's bets, and the grades holding |
| the box file's steals from the blocks column | the box file's bets, and the grades holding |
| the box file's threes from the steals column | the box file's bets, and the grades holding |
| the box file's points from field goals made | the ten bets, the box file's bets, the grades written and holding |
| the card's note dated by the newest read | the two reads' card |
| the card's note dated by the first leg's read | the two reads' card |
| a total on another number than the line shown offered | the junk cases |
| a total with its Over and Under on two numbers offered | the junk cases |
| the refusal beside a player on neither club deleted | 6: the legs beside the unplaced players, each way |
| a player the tables put on another club taken as placed | 5: the legs beside Moved Wing, each way |
| only the leg being added checked for a club | 5: the legs added before the unplaced players' |
| publish.js: rebounds from the defensive board alone | section 0: the mid-season box lines |
| publish.js: players who did not play listed | section 0: the mid-season box lines |
| publish.js: a six-day window | section 0: the published box lines, and the mid-season ones |
| publish.js: the same-game table left out of the state | 17: the published table, and every same-game price in section 9 |
| publish.js: the hold said tested | the published table |
| a double- or triple-double counted on points, rebounds and assists alone | the steals and blocks doubles, the box file's doubles, the grades written and holding |
| a push kept in a same-game parlay's reprice | the pushed same-game parlays, the grades holding |
| the void for a game called off deleted | the called-off legs, the grades written and holding |
| the same-game cache keyed by the chances alone | the sets of three and four legs |
| the card's payout on the legs multiplied | both cards' payout |
| the Share text's payout on the legs multiplied | the Share text |
| the card's model tile the fair chance, labelled "model says" | the second card |
| the card's model not labelled on trial | the second card |
| the card's no-model reason dropped | the card with a total |
| the card saying "edge" and "model says" | both cards, and the card's note |

## The lines feed

DraftKings' lines on the next nights' games, published by the job, so the Parlay Builder, Suggested Parlays and the
suggestions record can price those games from the moment a page loads rather than only after a Refresh odds press (the
build plan's "Prices on load", 25 October 2026). Free: ESPN's public scoreboard and propBets feeds, no key, no credits.
The Parlay Builder reads it (README "Parlay Builder"): once a page load, no-store, the first time its tab opens; a Refresh
odds press's read of a game's lines or props takes its place where it is newer.

### What is read (`tools/lines.js`, `tools/lines_feed.js`)

The games are every game `data/games.csv` has still to come (status scheduled and tip-off not passed, as `props.js` picks
its horizon; never preseason, which DraftKings posts only milestones for and the page prices from no model) on the next
two Eastern dates with such a game: Sunday night and Monday, then Monday and Tuesday once Sunday's last game has tipped. For each of those dates one scoreboard
request, the one `fetch.js` makes, and for each game one propBets request by ESPN's event id (another only past a page,
six at a time). Every request is a plain GET with no headers of its own, past any cache (`cache: 'no-store'` and a
cache-buster), dropped after 15 seconds, and tried once more after a second on a timeout, a reset or a 408, 425, 429 or
5xx; any other refusal is answered at once, so a 404 on the props reads as nothing posted.

A game's **game lines** are read from its event in the day's answer by `tools/lines_feed.js`, whose `oddsDkHref`,
`oddsIdOk` and `oddsGameLines` are the page's own text (Refresh odds and your parlay read the same way), copied whole:
DraftKings' odds object only (provider 100); the two moneylines as the scoreboard parse takes them (`parseDay`'s, both
or neither); the spread only on the number the parse took, with its two prices; the total only with its Over and Under
on that one number, with its two prices; and each outcome's betslip id from ESPN's DraftKings link, kept only in its
outcome's own shape naming its own number (`0ML<n>_1` home, `_3` away; `0HC<n>N150_1` the home side at -1.5;
`0OU<n>O22150_1` the Over 221.5). Player props carry no betslip id on ESPN's feed, so none is kept for them. A game's
**player props** are its propBets answer parsed by `tools/props_feed.js` (README "Player props"): each player's main
line with DraftKings' two prices, the "k+" rungs and the double- and triple-double Yes prices, every player DraftKings
lists.

### `lines.json`

At the repo root, beside `state.json`, one line a game by game id so a change is that line's diff:

```
{ v: 1, at,                                            // when the run that last changed the file read
  games: { <game_id>: {
    at, espn,                                          // when the game lines below were read; ESPN's event id
    ml: { home, away } | null,                         // DraftKings' American prices
    spread: { line, home, away } | null,               // line: the home side's number (the away side's is -line)
    total: { line, over, under } | null,
    ids: { event, ml: { home, away } | null, spread: { home, away } | null, total: { over, under } | null } | null,
    props: { at, mains: [{ player, stat, line, over, under }], ladders: [{ player, stat, k, price }],
             yes: [{ player, market, price }] } | null } } }
```

A real entry, Sunday 25 October 2026 (`2027_20261025_DET_PHI`, the Pistons 1.5-point favourites at Philadelphia), read
at 17:45 UTC, its props lists counted:

```
"at":"2026-10-25T17:45:27Z","espn":"401909866","ml":{"home":-108,"away":-112},"spread":{"line":1.5,"home":-118,"away":-102},
"total":{"line":227.5,"over":-110,"under":-110},"ids":{"event":"34888879","ml":{"home":"0ML86898039_1","away":"0ML86898039_3"},
"spread":{"home":"0HC86898039P150_1","away":"0HC86898039N150_3"},"total":{"over":"0OU86898039O22750_1","under":"0OU86898039U22750_3"}},
"props":{"at":"2026-10-25T17:45:27Z","mains":[66 main lines],"ladders":[550 rungs],"yes":[13 Yes prices]}
```

`player` is ESPN's athlete id, the hub's player id; `stat` is one of `pts reb ast tpm stl blk pra pr pa ar sb`, a rung's
`k` a whole number and `market` `dd` or `td`, all in `propParse`'s order. `linesGl` in `tools/lines_feed.js` turns an
entry back into the shape `oddsGameLines` gives (what the page keeps for a press in `SG_LINES`), and back again is the
same. The rules:

- **Each half of a game is its own read**: its game lines (the entry's `at`) and its props (`props.at`). A read that
  answers replaces that half. A read that finds exactly what the file already holds keeps the file's time, so `at` is
  when the job first read what the half holds, and a run that finds nothing new writes nothing at all: the file is
  rewritten only when anything but its top-level `at` changed.
- **A failed read keeps the last good one**: a day's scoreboard refused, timed out or not a scoreboard, a game missing
  from its day's answer, or a game's props refused leave that half as the last file had it, with its own `at` (only
  under the same ESPN event id). A half never read is null (`at` null with no game lines), and a game neither of whose
  halves has ever been read is left out. A 404 on the props ("No propBets found") is an answer: DraftKings has posted
  none, and the lists are empty; a game with no DraftKings odds on the scoreboard has no line (null), dated.
- **A game that tips leaves**: one games.csv has as started or final is not read; one the fresh scoreboard calls live or
  final, or whose own tip there has passed, is dropped; one whose tip passes while the reads are out is not taken; and
  every game of the last file no longer among the games to come (tipped, postponed, past the two dates) goes.
- **When nothing answers** (every scoreboard and every propBets request failed) the file is left byte for byte as it
  was and the run exits 1. A run with some reads failed exits 0 and says which in its log line.
- A last file that is not JSON, not version 1 or has an entry out of the shape (`entryBad`) is not carried: those games
  start afresh, and the file is rewritten.

Size: on 25 October 2026 at 17:45 UTC the two dates held 16 games, Sunday's 7 with DraftKings' game lines and props (605
main lines, 4,569 rungs, 94 Yes prices) and Monday's 9 with neither posted yet: 286 KB, 32 KB gzipped (GitHub Pages serves
it compressed). A game with props is about 42 KB, five sixths of it the rungs; a full two-date slate with every game
posted, 15 or 16 games, is about 650 KB, some 70 KB gzipped. The run took about a second.

### The national networks (`tv` in `data/games.csv`)

`fetch.js` keeps the national networks a game is on as a games.csv column, `tv`, names joined by `|`: every name ESPN's
scoreboard lists under `competitions[0].broadcasts` in the national market, then any national TV listing its
`geoBroadcasts` adds (market type National, type TV), each once, as ESPN writes it with any comma, quote or bar taken
out (the table is a plain CSV). A local listing (the home or away market: a regional sports network, League Pass, a
team's own app or station) is never one. On the recorded answers: opening night's three games `NBC`; two of the seven
preseason games of 14 October `NBA TV`; of Sunday 25 October's seven, `NBA TV` on Raptors at Timberwolves and none on
the rest, whose listings are all local; Tuesday 27 October's Trail Blazers at Lakers `Peacock|NBC` (broadcasts lists
Peacock nationally, geoBroadcasts adds NBC as TV), beside the home market's Spectrum, left out. It is kept by `merge`'s
rules for the lines: a read before tip-off takes a new listing and a read with none keeps the last, and from tip-off it
is frozen at the last pre-game read, so what a game was on is what ESPN listed before it tipped; a game first seen after
its tip has none. Every row before 25 October 2026 has none. The page's copy of the parse (`oddsParseDay`, with
`oddsNational`) keeps it the same way, held to `fetch.js`'s on the recorded answers and their variants.

### The checks

`node tools/test_lines.js` (its header lists them) runs `lines.js` through a stubbed reader and a scratch file on the
recorded answers (opening night with its props, Sunday 25 and Tuesday 27 October) and made-up ones: one scoreboard a
date for the next two dates only and one propBets read a game; every game's prices, spread number and betslip ids worked
out from the answer on its own, the page's reading, and back through `linesGl`; opening night's props as `propParse`
gives them, a 404 as none posted, a two-page answer read whole; another book's odds, a spread or total on another
number and an id naming another number taken as nothing; the drops (live by ESPN, past ESPN's own tip, tipping during
the reads, a final, a preseason game, a game no longer to come in the last file, a junk entry); the last good read (a
refused or junk scoreboard, a game missing from its answer, refused props, a half never read, a game never read, a last
read under another event id); nothing answering, through `run` and from the command line (exit 1, the file untouched);
the reader itself on a stubbed fetch (no headers, no-store, the cache-buster, which refusals are tried again); the quiet
run (the same answers write nothing, the file's time included; a moved moneyline and moved props rewrite those halves
alone); and the committed `lines.json`, where there is one, held to its shape. `node tools/test_fetch.js` section 5
holds the national networks on the recorded answers and made-up listings and `merge`'s freeze. `node tools/smoke.js`
section lines (`SMOKE_ONLY=lines`) holds the page's `oddsDkHref`, `oddsIdOk` and `oddsGameLines` to
`tools/lines_feed.js`'s text, and their results on every recorded scoreboard event with DraftKings' odds as recorded and under fourteen
variations (another book, DraftKings by name only, spread and total on other numbers, links off DraftKings, swapped,
with no gateway, not URLs or missing, an id on an older number, OFF, EVEN and junk prices, current prices for close, a
market missing, no odds); lines.json's shape and back; and the page's parse keeping `tv` as `fetch.js` does on the
recorded answers and six variations (either list alone, streaming and local only, both with a name twice and markets
in capitals or as objects, names with commas, bars, quotes and line breaks, lists that are not lists). Each was shown to
fail on a planted break in a scratch copy:

| Planted break | What failed |
|---|---|
| the file written on every run | the quiet run (1) |
| a failed game-lines read keeping nothing | the last good read (2, then the test stops on the missing line) |
| a failed props read keeping nothing | the last good read (1) |
| a game ESPN calls live kept / ESPN's status ignored / ESPN's own tip ignored | the drops (3 / 2 / 1) |
| a game tipping while its reads are out kept | the drops (1) |
| three dates read | the parse (5) |
| a total failure writing the file | nothing answering, by `run` and from the command line (3) |
| a game-lines read finding the same lines taking a new time / the same for props | the last good read and the quiet run (5) / the quiet run (3) |
| preseason games read | the drops (3) |
| a last read carried under another event id | the last good read (1) |
| `linesOf` giving the away side's number as the spread's line | `test_lines.js` (4); smoke section lines, the shape and back (1) |
| the page's `oddsNational` not reading geoBroadcasts | smoke section lines (3) |
| the page's `oddsIdOk` not checking the id's number | smoke section lines: the text, and an id on an older number (2) |

## Parlay Builder

The NFL hub's Parlay Builder tab, carried to the NBA on 25 October 2026 (the build plan's "Parlay Builder"; the NFL hub's
README, "Bets and Stats: the loop", and its `props/build/part3.js` at app v114 are the source). It is
`app/parts/parlay.html`, set in at its `<!--part:parlay-->` marker: its styles on the page's tokens and its script, which
shares the page's globals (the visitor's store `M`, the lines a press reads, the same-game engine). It replaced the tab's
day plan, its Safe, Medium and Aggressive parlays grown from one core, the Value card and the Bet Build (below, "What
went").

### On the page

**The choices**, at the top, each the visitor's own in the page's one key (`M.pb`; `M.stake` for the amount):
- **Bet amount** (`#pbStake`): dollars, the decimal keypad on a phone, $1 to $100,000, cents kept, $20 to start. One
  number, the builder's stake and every level's on Suggested Parlays when that tab comes: the builder's own stake box and
  its one-tap amounts set the same number. A typed amount is read by `stakeRead` ($ and thousands commas allowed); one that
  is not a positive number leaves the amount as it was, and a saved one that is not an amount reads as $20, so nothing
  drawn from it is NaN. A browser that kept the old builder's stake (`slip.stake`) and no Bet amount has it read once as
  the Bet amount.
- **Refresh odds**, with its own status line beside it (and again in the builder): the board's press (README "The site"),
  which reads DraftKings' current game lines and player props from ESPN; the board's odds bar is not shown over this tab.
- **Build from**: All, Teams only or Players only, which set five boxes, **Moneyline**, **Spread**, **Game total**,
  **Player overs** and **Player unders** (a milestone and a double- or triple-double are overs); a box changed by hand
  lights the mix it makes, or none.
- **Games**: every game still to tip on the lines feed's two Eastern dates (the next two with a game to come that is not
  preseason, README "The lines feed"), listed under their day ("Sun Oct 25") with each tip-off in the viewer's own zone
  and weekday, all ticked to start, All and None; the list is open on a screen 761px or wider and folded on a phone until
  the visitor opens it. A game that tips while the page is open leaves the list, the Top 50 and the builder at the page's
  half-minute look. Tonight's card has a **Parlay Builder** button for each of these games, which opens the tab with that
  game alone ticked.

**The Top 50 lines** (`getPbTop`, `pbTopBuild`): every leg on the ticks that qualifies, in two parts, **Value picks**
(each marked Value) then **Other lines** (the thin-edge legs, then the game totals), each part ranked by what $1 on it is
expected to make at the model's chance (the chance times the decimal price, less the $1), best first, the totals set after
every thin-edge line, 50 lines at most in all (`PB_TOP_N`). Each bet is listed once: a milestone k+ lands exactly when the
player's main Over at k - 0.5 does (DraftKings' NBA rungs sit at the main line + 0.5), so where that main Over qualifies
the rung is left out and its slot goes to the next line; a whole-number main line, an Under, a main Over that does not
qualify and the same rung in another game never take a rung's place. Each row gives its rank, the player or team, the bet
and its game, the Value mark, DraftKings' price, the model's chance (marked **on trial** on a player's line), DraftKings'
fair chance (est. where it is), what $1 wins and what $1 is expected to make, and an **Add**. The notes say how many lines
were left out far off the market and for want of a betslip id, and that the totals come last; an empty list says why (no
box or game ticked, no player prices read yet, none the props model prices, or nothing qualifying).

**A line qualifies** with DraftKings' real price, the model's chance from 45% to 97% and at or above the chance that price
implies (the book's margin left in): 3 points above it or more is a **Value pick**, less a thin-edge line. Left out and
counted: a line the model rates 15 points or more above DraftKings' fair chance (`legFarOff`, the NFL's `FAR_OFF`), and a
game's moneyline, spread or total with no DraftKings betslip id at its number where its game's lines carry ids. A game
total is at the book's own chance, so never a Value pick and always last.

**Add** puts that one leg in the builder by the builder's own rules, reads **Added** while it is in, and a second press
takes it out, the focus kept on it. **The builder** (`#parlayBody`) is the visitor's own parlay (`M.slip.legs`, the same
legs a game's Player props adds, README "Same-game parlays"), in the builder's order (the day, then the name): each leg with
its projection, the model's chance and its confidence band (on trial on a player), DraftKings' fair chance, its price and
read time, a line where it will not go on DraftKings' slip as built, and Remove; then **What it pays**: the stake, the
one-tap amounts, a parlay price of the visitor's own book to type over the estimate, and four figures, DraftKings' fair
chance that every leg lands first (est. where a leg is priced on one side or the legs share a game), the model's beside it,
the fair price for the model's chance, what the stake returns and the confidence band of the whole; the same-game note
where legs share a game; **Finish parlay** (the card, README "Same-game parlays") and **Clear ALL** (asked first); and the
legs that move together. Both Refresh odds there and in the controls keep the focus on the button pressed.

**The engine** the NFL's levels are built by is carried whole for Suggested Parlays to draw on: `pbLegs`, `pbPool`,
`pbTier` and its searches (a beam over a pairwise copula reading, the finalists worked by the builder's own sums),
`getPbTiers` (Safe the likeliest pair; Medium, Aggressive and Extreme the 3-, 4- and 5-leg parlay with the best expected
return that lands 25%, 12% and 5% by the model, else the likeliest of that size), `pbTierCard` (with `o.quiet`) and a
level's **Add to builder**, and `parlayProb`, `parlayDec`, `parlayFair`, `legFair`, `legFarOff`, `pbOrder`, `pbIsValue`,
`pbValMark`, `toggleLeg` on `window`. Nothing on this tab draws a level.

### Where the NBA differs, and why

| The NFL hub | Here | Why |
|---|---|---|
| A week's games | Every game still to tip on the lines feed's two Eastern dates, under their day; never preseason | The NBA has no weeks; the dates are the ones the job reads DraftKings' lines for |
| The payload's prices, a Refresh odds press over them | `lines.json`, read once a page load, no-store, the first time the tab opens (never on load or a timer), and a press's read, the newer of the two for each game's lines and its props; every price DraftKings' real one, nothing estimated | The NBA's prices come from the lines feed, which carries both prices on every line |
| A moneyline's or a cover's chance from the NFL's game model | A moneyline's the player model's win chance (the number Tonight shows); a spread's Phi((m + h) / sigma), m the side's expected margin (minus the model's spread for the home side) and h its line, sigma 14.5 points | The NBA's game model gives a margin; sigma is measured, below. Until this change the page put no chance on a spread |
| A total at the market's own chance | The same: its two prices with the margin out in proportion (50% where one is missing), never a Value pick, last | The NBA's total has never been tested against the market |
| A player's chance from the props model, on a book price | The props model's (README "Player props"), which is **on trial**: marked so beside its chance on every Top 50 row, builder row and level card, the mark titled with the shadow ledger's count, and said once in the lead; never a player it does not project or the report has out; none at all once its ledger fails its bar | The owner's call of 25 October 2026: props in the Top 50, Value picks allowed, every one marked |
| Value: the 3-point edge with market + form agreeing on a player's line | The 3-point edge alone, which the panel says | The NBA has no market + form (no player Elo is fitted to the props) |
| DraftKings' fair chance by `legFair` | The NBA's `legFair`: a main line's whole margin on the Over (measured on DraftKings' archived lines), a milestone's and a Yes price's by the rung rule, est., a team line's two prices in proportion | The NBA's measured rule |
| Every suggested leg needs DraftKings' betslip id | Game legs only, where the game's lines carry ids; a player's leg carries none on ESPN's feed and goes on the slip by hand, which its builder row says ("Not on DraftKings' slip yet: no betslip id in ESPN's feed") | ESPN's feed has no outcome id for a player's line |
| `parlayProb` and `parlayDec` by the NFL's copula draws and its hold | The NBA's same-game engine behind the NFL's names: legs of different games multiplied, one game's joined by the gaussian copula at `data/corr.json`'s rho (two legs exactly, more by the GHK sum), worked in one order a game (`sgOrder`), so the same legs price the same in the list, the builder, a card and the sheet; the price min(the prices multiplied, 0.896 / J) | The NBA's table and engine (README "Same-game parlays"), with the NFL's hold, untested here |
| A second leg on one bet's key replaces the first | Refused, the reason said at its row and in the builder's status line, by the NBA's same-game rules (`slipWhy`: one side bet a game, one total, one leg a player a stat, no stat beside a sum holding it, no double- beside a triple-double) | The NBA's rules, as the sheet applies them |
| The builder's confidence band | The NBA's band (HIGH from 75%, MED 60%, LOW 55%), under 55% "UNDER 55%" | The page's own band |
| Market + form and the Elo matchup on each builder row; the matchup bubble on each name | Neither; names are plain | Neither exists for NBA props yet |

### The spread's sigma (`tools/sigma.js`, `research/sigma.json`)

The cover chance needs the spread of the real margin about the model's own number. On the 2026 fold of the walk-forward
(`research/backtest_games.csv`, every final called by the parameters fitted on the seasons before, the lineup known), the
root mean square of the home margin less the model's expected home margin is 14.54 points over 1,322 finals (the standard
deviation about the residuals' own mean 14.54, their mean -0.19), so sigma is **14.5**. The folds before it: 14.41 on
2024 (1,314 finals) and 14.07 on 2025 (1,320). The root mean square is used because the page draws the margin about the
model's number, bias in. Until this change the page's `SIGMA` was 12.5, assumed, and priced only the old builder's market
chance from a spread where no moneyline was posted.

### What the team picks have been worth

Shown for the owner, not acted on: nothing on the page is chosen from these numbers. Every side the Value rule's 3-point
edge would have listed on each fold, lineup known, at the closing price (a cover at -110, which `data/odds_hist.csv` keeps
no spread price for; a push left out), the model's chance said on average, how often it won, and the profit on $1; and
the same with the far-off guard as the page applies it:

| Fold | Moneyline Value picks | with the far-off guard | Cover Value picks | with the far-off guard |
|---|---|---|---|---|
| 2024 | 368, said 56.3%, won 43.8%, -16.3u | 287, said 56.5%, won 44.6%, -25.6u | 904, said 62.2%, won 48.7%, -64.0u | 658, said 59.7%, won 49.4%, -37.6u |
| 2025 | 299, said 59.3%, won 53.8%, +18.2u | 253, said 59.7%, won 56.9%, +20.5u | 707, said 60.2%, won 50.9%, -19.7u | 634, said 59.3%, won 51.9%, -5.9u |
| 2026 | 304, said 61.2%, won 51.6%, -0.7u | 244, said 61.1%, won 53.7%, +1.0u | 728, said 60.3%, won 47.0%, -75.1u | 634, said 59.2%, won 46.9%, -67.0u |

The model has said 56% to 62% on its team Value picks and they have won 44% to 57%: on these folds a team Value pick has
been a pick the model rates above the market, not one that has beaten it. The covers' 2026 row uses a sigma measured on
those same games. `node tools/sigma.js` writes the file only when it changes and prints these lines.

### What went

Until 25 October 2026 the tab was a day's plan (a confidence band, straight bets or a parlay of the model's picks, Lock
in), Safe, Medium and Aggressive parlays of team moneylines grown from one core, a Value card and a Bet Build graded as
games went final. What a browser kept for them (`M.build`, `M.bank`, `slip.stake`) stays in its storage, undrawn, and goes
into a backup as before; a kept bet is still graded by the page's own settlement, `NBA_GRADE.gradeBet` (the one X Parlays
grades by), and nothing writes its grades back. The Record tab's table of those rules against the market is labelled as
the earlier rules' backtest, and `tools/backtest.js` keeps them as a frozen copy (it no longer reads the page), giving the
same numbers.

### The checks

`SMOKE_ONLY=pb node tools/smoke.js` (`tools/smoke_parlay.js`), blocking, boots the built page on made-up games tomorrow and
the two days after (so it holds at any hour, the off-season included), a made-up `lines.json` in `tools/lines.js`'s shape,
a props block of its own and a stubbed ESPN, and works every number out on its own copies of the rules (`qualOwn`,
`pbTopOwn`, `sameBetOwn`, `PB_TOP_N_OWN` 50; the model's chances from `tools/props.js`'s distribution, `research/sigma.json`
and the market's prices; the fair chances by `tools/props_feed.js`'s rules): nothing read before the tab opens, then
`lines.json` once, no-store; the games, their days and the preseason and started games left out; the list line for line
(its parts, ranks, prices, chances, fair chances, wins and expected on $1), Value first, the totals last and never Value,
the on-trial mark on every player leg and nowhere else and the Value mark on every Value pick and nowhere else, each bet
once (a rung left out for its half-point main Over, a whole-number Over, an Under, a main Over that does not qualify and a
rung in another game each keeping it, a Value-pick rung left out for its thin main Over), a total priced on its Over
alone at +120, put at 50% and expected to make $0.10, still after every thin-edge line, the far-off and no-id rules and
their notes; the four levels by the builder's own sums, their cards' marks and `o.quiet`, and a level's Add to builder;
every control 44px; the mix, the boxes and the games, saved; Add, Added and a second press, the refusals with their
reasons (a combo holding a stat, the moneyline beside the spread); the builder's numbers against `data/corr.json` and
`tools/corr.js` (two legs of one game exactly) and the page's `parlayProb`, `parlayDec` and `parlayFair`, its rows, its
fair chance first, the model's on trial, the payout, the band, the slip lines and the same-game note; `stakeRead` on 24
cases, the Bet amount typed, left empty, set by a chip and by the builder's box, and read from saved junk, from 250,000
and from the old stake; Finish parlay on the builder's legs, order and price; a game tipping while the page is open; Clear
ALL; a press taking DraftKings' newer price and storing nothing, and a reload; the cut on sixty made-up games (forty Value
picks, twenty thin, the first 50 of their order under "Top 50 lines", the other lines ranked from 41); a `lines.json` that
does not load; a slate with no game to build from; and the real `state.json` and `lines.json`, the list this file's own
line for line wherever no game tips within two minutes. Sections 7, 8 and 9 follow the tab: a press's prices in the Top
50 and the builder's leg repriced, the props a press reads reaching the list marked on trial, the builder held to section
9's own same-game sums. Eight breaks planted in a copy of the built page (`NBA_HTML=<copy> SMOKE_ONLY=pb`) each turn it
red: the list cut at 40, the each-bet-once rule dropped, a 2-point Value edge, the on-trial mark on team legs, the far-off
guard dropped, the old sigma of 12.5, a $0 Bet amount taken, and the totals ranked with the thin-edge lines (which passed
until the one-sided total went in).

In Chromium at 1280 and 390 wide on the published `state.json` and that afternoon's `lines.json` (16 games, 726 lines
qualifying for the 50), with three legs in the builder and the games list open: no sideways scroll, every control 44px or
taller (93), and every one of 984 and 978 texts at 4.5:1 or better on what is under it (the lowest 5.1:1). The quiet text
is the NHL hub's #B3B9CB, not the page's `--muted`, which falls under 4.5:1 on `--panel-2`; the on-trial mark is the rose
#FFA2B8 (5.7:1 on the panel) and the Value mark dark text on the gold (12.1:1).

**What the owner may want to look at.** On that afternoon's lines 48 of the 50 were player lines and 44 of them Unders,
every row a Value pick: the props model runs low on the Over against DraftKings (README "Player props": on the 2026
play-in and playoffs its chance of a side beat the price's by 3 points on 4,271 Unders and 967 Overs), so its Unders clear
the 3-point edge most often, and 232 lines were left out as far off the market. The levels over every game ticked, which no
tab draws yet, made a Safe pair at 92.7% by the model (-484) and a Medium at 86.6%. These are the on-trial model's
chances, marked so wherever they show.

## X Parlays

The parlays X placed at the book, the same on every device and read only everywhere: a tab of their own, after the
Parlay Builder, from one file kept by hand, `liveparlays/parlays.json`. It is the NFL hub's X Parlays carried over (the
NFL hub's `liveparlays/build/page.html` and its checks, `nflbets/build/smoke_live.js`), with the NBA's game ids, stats,
settlement and look. Each parlay is followed live against ESPN's scoreboard and box scores in the visitor's browser:
every leg has its target, a bar, a word for where it stands and a mark (✓ won, ✗ lost, P a push, V void), each game a
score chip coloured by how the parlay stands in it. Nothing on the page writes anywhere but one list, in the visitor's
own browser, of the parlays they chose to hide.

### The file

```
{ "how": "...", "updated": "2026-10-25T17:30:00Z" | null,
  "games": ["2027_20261024_BKN_CLE", ...],
  "parlays": [ { "id": "w1-dk-bkncle-3", "date": "2026-10-24", "stake": 10, "price": 264, "payout": 36.4, "note": "same game",
                 "legs": [ { "game": 0, "player": "Cade Cunningham", "pid": "4432166", "team": "DET", "stat": "pts", "line": 24.5, "side": "over", "main": true } ],
                 "cleared": true, "cleared_on": "2026-10-26", "cleared_by": "auto" } ] }
```

Claude keeps it from the slips the owner sends in chat, as its `how` says: `games` lists each game once by the site's id
(`season_YYYYMMDD_AWAY_HOME`, the season the year it ends, the date Eastern, as `data/games.csv` writes it) and a leg
points at one by its place in that list. A parlay is `id` (any name not used before), `date` (optional: the Eastern date
of its first game; without it the page takes the first game's), `stake`, `price` (the American odds it was placed at),
`payout` (stake included), an optional `note` and its `legs`. A leg is `game`, `player` (as ESPN spells him), `pid` (his
ESPN athlete id: optional, but the page finds him by it first), `team` (his club's code), `stat`, `line`, `side` (over or
under) and `main` (true for a book main line like 24.5, false for an "N+" milestone written with line N). The stats are
the props view's: `pts reb ast tpm stl blk pra pr pa ar sb`, `dd` and `td` (a Yes bet: line 1, side over, main false), and
`ml` or `spread` for a whole-game bet (`ats` is read as `spread`), `total` for the game's points. A whole-game bet takes
`team` set to the side bet on, `line` 0 for `ml` and the spread from that team's side; a total its line and either club.
A line the book moved before X placed the bet is written as the line X took. A parlay X no longer wants on the page is
marked `"cleared": true` and stays as history, drawn by no device and its games never read. `updated` is when the file
last changed what the tab shows. The file is written as `JSON.stringify(doc, null, 1)` writes it (one-space indent, a
newline at the end), so the job's edits to it are small diffs; the page reads it at runtime, so an edit needs no rebuild,
and the job's push trigger does not fire on it.

### On the page (`app/parts/xparlays.html`)

**When it reads.** The file (`liveparlays/parlays.json?t=…`), then one ESPN scoreboard for each Eastern date of the
parlays' games, then a box score for each game with a player's leg, when the tab is first shown in a page load (a page
that opens on it from the saved tab too) and on Refresh now: never before that, never on a timer, never on focus or
visibility, as the Refresh odds rule is. Showing the tab again draws what was read. Every read is a plain GET, no-store,
past any cache, dropped after 15 seconds. A scoreboard that fails, or answers anything but a scoreboard, fails the whole
read (the scores stand as they were and a note says ESPN is not answering, most often a blocker); a box score that
fails leaves its game's player legs waiting. A box score is not asked for before tip, and a final's is read once.

**How a leg is graded.** Wherever the published state has its game's final, by the page's own settlement, so X Parlays
and the page's own grading (`NBA_GRADE`, which grades a browser's kept bets) never disagree: `legResult` on the published score for a team's leg, `propGrade` on the published box
lines (`state.json`'s `boxes`, else the season's box file) for a player's, the player placed by his `pid` or by his
name and club among the published players. A game the published state grades for every leg on it is read from nobody.
Otherwise ESPN's live answers carry the leg: a moneyline or a spread is points clear of the line on the side bet,
settled at the final (a whole line can push); a total is settled the moment it passes its line (an Over won, an Under
lost: points only go up, overtime included) and else at the final; a player's Over main line is won the moment he
passes it and an Under lost, else each waits for the final, where a whole line pushes; a milestone (N+) is won the
moment it is reached; a combo is the sum of its parts; a double-double or triple-double is two or three of points,
rebounds, assists, steals and blocks at 10 or more, won the moment they are. In the box a player is found by his ESPN
id, else his whole name, else his last name and first initial, and only where one player answers to it.

**Void.** Every leg on a game ESPN calls postponed or canceled, or one of this season or the last on no published list
two days after its date (the page's `offList`), is void: "not played on its date". A player who did not take the floor
is void once the game is final, as DraftKings settles it: the box lists him as not playing (with its reason, "coach's
decision"), with no line, or not at all. While the game is on, a player with no line yet is graded on nothing and said
to be "not in yet"; one not on the box at all, "not on the box score".

**What it draws.** The parlays still running first, under the Eastern day of their first game ("Sunday games", its date
and first tip in the viewer's own time), in the order they tip, a pill where one runs into the next night; then, under
Finished, each settled parlay in full ("each clears itself the day after its last game"). Settled is a leg lost (gone,
whatever is still to play) or every game over or not played and every leg graded: "landed" only when every leg is won,
pushed or void, so a leg waiting on its box score is never counted (the NFL hub's tab could say landed there), "void"
or "push" when every leg came back, and "N void" beside landed. A main line reads "Over 24.5" or "Under 24.5" (the NFL
hub's tab wrote an Over as "24.5+"), a milestone "25+", a double- or triple-double "Yes". A player's row has his box line
and minutes under his name ("24 pts, 9 reb, 7 ast, 3 3PM, 1 stl, 0 blk · 28 min"; before tip his leg's parts at
nought); a team row has its score chip, coloured by the bet. Each card has the stake, the price and what it pays, the
date (in place of the NFL's week) and the note. With nothing to show: "Nothing to watch yet".

**Clear this parlay?** Every card has an X at its top right, the same for every visitor (a 44px button, first in its
card). It opens a small window naming the parlay ("4-leg parlay · Sun Oct 25 · +580 · same game") and saying it is
cleared from this device only, nothing is sent anywhere, and X's parlays clear themselves for everyone the day after
their last game, with Cancel and Clear: Escape, Cancel or a click outside clear nothing and give the focus back to the X;
Tab stays inside; a tap within 0.4 seconds of the window opening (a double tap's second) neither clears nor closes; the
page behind is held still; it scrolls when taller than the screen; leaving the tab closes it, quietly. Clear takes the
parlay off this browser's X Parlays alone: its id, with when, goes into `nba_lp_cleared_v1`, the tab's own key, never
the NFL hub's `lp_cleared_here_v1` (the two hubs are one origin, `demon-x13.github.io`, and share a browser's storage, so
each list is pruned by its own file alone), never into the page's own key or the Data tab's backup. Each change starts
from what storage holds then, so two tabs of the site never write an older list over each other, and a tab follows
another's change (the `storage` event). The list is pruned on every read of the file to the ids it still has and has
not cleared (a file that does not answer prunes nothing), and the key is removed once empty. With some cleared, a quiet
line at the foot says how many, with Show it (them) again, which brings back the ones this tab shows as cleared and
reads their games. Where storage refuses, the list lives in memory for the visit.

### Clearing itself (`tools/autoclear.js`)

The job's step right after the pull: `node tools/test_autoclear.js && node tools/autoclear.js`, or the file is put back
as committed and the step (and so the run) is red. A parlay is cleared, `"cleared": true` with `cleared_on` (the Eastern
date) and `cleared_by: "auto"`, when every game it is on is final in `data/games.csv` (status final, or both scores) and
its last game's date is two or more Eastern days before today: a Saturday night's on Monday. A game games.csv no longer
lists (ESPN drops a postponed one, and the job with it) counts as played on its date and void, as the page grades it,
once two days have passed, for this season or the last; a game of an older season, an id not in the site's shape or a
leg on no game is never cleared. The file is written only when something cleared, in its own style, with `updated` now.

### The checks

`SMOKE_ONLY=xparlays node tools/smoke.js` (`tools/smoke_xparlays.js`) boots the built page on the published state, a
stubbed file and a stubbed ESPN (answers in the shapes of `tools/fixtures/` and `data/sample_summary.json`, on made-up
games tonight, tomorrow and yesterday, so it holds on any day) and holds, in 137 checks: nothing read before the tab
is shown, on a timer, on focus or visibility, then the file and the scoreboard once, each read a plain no-store GET, and
Refresh now reading again; every leg's target, value, status, bar and stat line mid-game (an Over passed, an Under to
spare, a milestone short, a combo summed), the strip and the money; the order and the night's heading; the browser's own
Bet Build and parlay neither drawn nor touched; parlays alike but for a side kept apart; a player who did not take the
floor (void at the final with the box score's reason, not on the box at all, no line; "not in yet" while the game is on),
a postponed game and one on no list two days after its date (void, the parlay void or landed beside them, and that date
never read); a double-double hit mid-game, a triple-double short, steals + blocks summed, a push on a whole line (points,
spread and total) and a parlay of pushes, a parlay into the next night read from that night's own scoreboard (a game
of the same clubs listed for another day not taken), "landed" only once a final's box score answers (and that box never
read again); a published final graded by the page's own settlement from the published box lines and read from nobody,
and one whose box line is not published yet graded from ESPN's; the chips and the totals settling mid-game; nought
before tip; an empty, missing, junk or wrong-shaped file; ESPN down, a scoreboard answering junk (all or nothing) and a
box score failing (that game alone); a box score only where a player's leg needs one; `ats` as a spread and bad legs
dropped; a player found by his id whatever the file calls him; a cleared parlay never drawn or followed; the updated
line; the real file and a parlay on the published state's own last finals; the page's box reading held to
`tools/fetch_box.js`'s on the recorded summary; the part's code touching no storage but its key and sending nothing; and
section O of the NFL hub's checks whole (the X on every card, its window, Cancel, Escape, a click outside, Tab, Clear,
Show them again, the double tap, leaving the tab, two tabs, the prune, a reload, a fresh browser, storage refused), with
the NFL hub's key on the same origin seeded and left exactly as it was. `node tools/test_autoclear.js` holds the clear to
its cases (the game day and the next clearing nothing, Monday clearing the Saturday parlays and the one on a game no list
has, Tuesday Sunday's, the rest never; the fields; a second run; the command on a scratch copy; the real file's style).

Each check was shown to fail on a planted break (35, run on a copy of the built page with `NBA_HTML`): the NFL hub's key,
a player who did not play graded on zero, a postponed game read as not started, a combo graded on its first part, a push
graded lost, landed with a leg ungraded, a read on load, a read from a cache, the published final ignored, a
double-double needing three, no double-tap guard, Escape reaching the page, no prune, Show them again clearing another
tab's, the key kept when empty, another day's game taken (green on the first sweep: the case went in), a spread read from
the other side, the X not first in its card, the window left open on a tab change, a total settled only at the final, a
box read before tip, a final box read again, `ats` not read, rebounds from the offensive board, the minutes dropped, "not
in yet" voided mid-game, a cleared parlay drawn, the all-or-nothing rule dropped for a scoreboard with no events (green on
the first sweep), a player found by name before his id (green on the first sweep), "None of X's parlays" with some
cleared here, the focus not given back, the storage event ignored, a postponed game's team leg graded, the X under 44px
and Refresh now not reading. In Chromium at 360, 390, 768 and 1280 wide on stubbed answers (25 October 2026): no sideways
scroll and nothing past an edge, every button 44px or more, every text at 5.14:1 or more on what is under it (the open
window's at 5.36:1), the window inside the screen with the focus on Cancel and given back to the X on Escape.

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

Right after the pull, X's finished parlays clear themselves (`tools/test_autoclear.js`, then `tools/autoclear.js`, README
"X Parlays"): a failure there marks that step alone, puts `liveparlays/parlays.json` back as committed and turns the run
red at the end; the file rides on the data's commit.

After the players model, the props step reads DraftKings' closing lines for the new finals, writes the projections
(`props.json`) and the shadow ledger, and runs the ledger's check; when either fails, every props data file goes back to
the last commit's and the run is red (README "Player props"). Then the lines step (`node tools/lines.js`) reads
DraftKings' lines on the next two dates' games into `lines.json` (README "The lines feed"), committed with the data
whenever the pull succeeded; when nothing answers the file stays as it was and the step is red.

After the pull, each step may fail on its own: the data folder and the model files are committed whenever the pull
succeeded, and state.json and the pages only when publishing and the tests (`tools/test_fetch.js`,
`tools/test_fetch_box.js`, `tools/test_props.js`, `tools/test_corr.js`, `tools/test_lines.js`, then the page's smoke test on the new state)
pass; the run is red when any step failed. The page says when the injury report is older than the file it came in. On
demand the job takes a date range and a refit switch. A push that changes the tools or the app runs it once (on a
`claude/` branch too, committing there and in its own queue; the schedule only fires from `main`).

Local:

```
node tools/history.js      # once; downloads the history file (or --file path/to/nba_elo.csv)
node tools/fetch.js        # needs ESPN reachable; --from / --to for a range
node tools/fetch_box.js    # needs ESPN reachable; --from / --to for seasons, --budget minutes
node tools/elo.js          # team model replay; add "fit" to refit
node tools/players.js      # player model replay; add "fit" to refit
node tools/lines.js        # needs ESPN reachable; DraftKings' lines on the next two dates' games -> lines.json
node tools/backtest.js     # by hand: the walk-forward against data/odds_hist.csv -> research/backtest.json
```

## The site

`index.html`, its own look: graphite blue with an orange accent, bold display type, faint court lines, team-coloured badges; one card per game. Tabs:

- **Tonight**: a day strip from yesterday to ten days out. Each card has the two teams (the model's pick
  lit), the model's win chance and a probability bar, the spread and total, the market
  line with a chip saying how far the model's spread is from it, who is out on each side and what
  it costs in points, a lineups drawer with projected minutes and each player's contribution and the
  coach (the two sides side by side on a wide card, one above the other on a narrow one, so nothing is cut
  off), a Parlay Builder button on each game the builder lists that opens it with that game alone ticked, and a
  Player props button that opens the game's props: the model's projections, and DraftKings' player lines beside them
  once Refresh odds has read them (README "Player props"; the model on trial). Finals
  show the score and whether the model hit. Before the schedule appears the tab counts down to
  opening night over the preseason board.
- **Refresh odds**, over Tonight (the Parlay Builder has its own in its controls and its builder): the job's lines are as old as its last run, so a
  press reads DraftKings' current lines from ESPN's public scoreboard in the browser (one request a day with a
  game still to come; ESPN answers any page), taken exactly as `fetch.js` takes them (the page carries a copy of
  its `parseDay` and of `merge` for a game not started, and the smoke holds both to the job's on the recorded
  answers in `tools/fixtures/`). Only games not yet started (by the published tip, ESPN's status or ESPN's own
  tip); one that tips while the read is out, a day that fails or answers junk, a game ESPN has no line for, and
  a read older than the published one keep the lines they show (the published ones, or an earlier press's), and
  the status line beside the button says how many, and which games have no line yet. Everything priced from the lines
  follows: the Market and Over/under chips, the market's chance and Vegas pick, and the Parlay Builder's lines where
  the read is newer than `lines.json`. The same press then reads DraftKings' player props for the same games, one
  request each, by the ESPN event id the scoreboard gives (or the slate's `espn`), shown under each game's Player
  props with a second status line (README "Player props") and taken by the Parlay Builder's Top 50 lines, marked on
  trial. It is all held
  in memory only, never saved: a reload is the published state again. Nothing is read on load or on a timer, only on
  a press.
- **Teams, Players, Coaches**: sortable tables of the ratings; players searchable and filterable by team. Each
  rating wears its tier, as on the NFL hub: a player's and a coach's overall Elo is put on a bell curve by
  `publish.js` (THE LADDER: 1500 the ranked pool's average, 100 points a standard deviation; the pool is rostered
  players with ten minutes or more over twenty games or more, and coaches with ten games rated), and the shields
  split it as a ranked ladder does: the Wood League under 1350, Iron, Bronze, Silver, Gold, Platinum, Diamond,
  Master and Elite 50 points apart, and HOF from 1750, worn as a gem. A team's strength, already on the Elo scale,
  wears its shield as it is. Over each table, the ladder: every tier, its range and how many are in it. On a
  phone a table keeps its rating in view and lets its secondary columns go.
- **The rating over time**: each of the three tables has a **7d** column, the rating's change over the last seven days,
  and a name (a team's badge) opens a window with its rating game by game since last season began: the line, the
  change over 7 and 30 days and this season, and its last ten games this season, newest first, with each one's change
  (before its first game, the last five of last season). Every point is on the ladder its table uses: this season's on
  today's (so the line ends on the table's number), last season's on its own as it ended, each centred on the league's
  average player as its day ended, so a line moves with the player and not with the league's average, and a point once
  drawn never changes. The season's turn keeps 70% of a player's rating, which moves him little on his ladder; a coach
  keeps half of his, and coaches out of work keep all of theirs, so a coach's line can step toward the middle; a club's
  line, which is not on a ladder, steps toward 1500. A change counts from the season's start, never across it. A club's
  line is its recent rotation's strength (who played in its last five games, at their usual minutes, filled to 240 as
  the Teams tab fills today's): one night's lineup would move a club fifty points for the stars who sat a blowout. The
  Teams tab's strength is today's roster instead, with who is out taken off and anyone back or new counted, so the two
  can differ either way, and the window says both. In the preseason the line runs to last season's end and today's
  carried rating. `history.json` is read when a window first opens, once a page load (a read that fails is made again
  by the next window), and kept in memory only.
- **Record**: the season graded straight up, against the spread and on totals, by month and game, from
  `predictions.csv`; the earlier Parlay Builder's suggested parlays (its rules until 25 October 2026, labelled so)
  and the model's picks against the closing line, season by season, from `research/backtest.json` (state.json's
  `vsMarket`, beside the two-biggest-favourites baseline); and the backtest table.
- **Parlay Builder**: the NFL hub's (README "Parlay Builder"). Its choices (the Bet amount, Refresh odds, All, Teams
  only or Players only, five bet types and the games of the lines feed's two dates, under their day), the Top 50 lines
  they make from DraftKings' prices (`lines.json`, or a press's newer read), Value picks first, then the other lines
  with the game totals last, each ranked by what $1 is expected to make, every player's line marked on trial, each with
  its own Add; and the builder under them: the visitor's own parlay, from the list or a game's Player props, priced by
  the same-game engine, DraftKings' fair chance first and the model's beside it, what the Bet amount returns, Finish
  parlay (a card to place at DraftKings or share, README "Same-game parlays") and Clear ALL.

- **X Parlays**: the parlays X placed at the book, the same on every device and read only, each followed live through
  its games; read from `liveparlays/parlays.json` and ESPN when the tab is first opened in a visit and on Refresh now,
  never on load before that or on a timer (README "X Parlays").

Nothing a visitor does reaches the published files. The job runs `publish.js`, `build.js` and the
smoke test after the models, and commits `state.json`, `history.json` and both pages (and `liveparlays/parlays.json`
when a finished parlay of X's cleared itself).

## What comes next, in order

1. **Style matchups**: the four factors each team forces and allows (shooting, turnovers, rebounding,
   free throws) as a fitted term on the residual, on top of pace and efficiency.
2. **The same-game hold**: the price of two legs of one game uses the NFL hub's hold, untested here (README "Same-game
   parlays"). A few real DraftKings same-game tickets on NBA games, recorded with their legs' own prices, would test it;
   until then it stays an estimate and says so. The props model's lines are on the Parlay Builder's Top 50, marked on
   trial, until its shadow ledger decides its bar; a FAIL takes them off.
3. **Suggested Parlays**: the NFL hub's tab on the Parlay Builder's engine (`getPbTiers`, `pbTierCard`, a level's Add to
   builder, README "Parlay Builder"), with its lock and its record; and the parlay card and matchup bubble upgrades.
