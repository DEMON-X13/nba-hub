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
| `tools/elo_model.js`, `models/elo.json`, `research/elo.json` | The ELO Model (README "The ELO Model"): the NFL hub's player Elo and logistic on the NBA's box scores; its call on every game of the season in play on the previous game's rotation, the games to come apart on today's report, its fitted weights and the pick study's prices (`params.pick`, research only since the Elo picks went on 5 November 2026); and its walk-forward with every design choice tried |
| `tools/test_elo_model.js` | The ELO Model's leakage check (a game's inputs the morning it is played are its inputs once final; a game under way and a final of today called on the previous game's rotation), its ratings by hand on a made-up league, tonight's rotation on made-up reports, the committed files and a refusal's, and every phase of a season |
| `tools/joker.js`, `tools/gbm.js` | The Joker (README "The Joker"): gradient-boosted trees, written out in plain Node, on every number the job has before tip-off; its rows, walk-forward, by-hand fit and the job's step |
| `models/joker.json`, `research/joker.json` | The Joker's frozen trees, its call on every game of the season in play with a moneyline, the season's input rows as the job saw them before each tip; and its walk-forward with the design choice |
| `tools/test_joker.js`, `tools/test_gbm.js` | The Joker's leakage check (a game's row the morning it is played is its row once final), its rows by hand, its run's and a refusal's file, and on the real data in any phase of a season the file against today's data and the last commit; the trees on sets worked out by hand |
| `tools/publish.js` | Writes `state.json`, the one file the site loads: the slate, the record, teams, players and coaches (with their overall Elo on the ladder the tier shields are drawn on, and its change over 7 days), the backtest, the market table (`vsMarket`, from `research/backtest.json`), the props model's block, the last week's box lines a player's leg is graded from and the same-game table (README "Same-game parlays"), and the injury report's statuses (`report`, README "Suggested Parlays"), and each club's team stats (`teamStats`, README "The game's three windows"); and `history.json` |
| `tools/calls.js`, `tools/calls_check.js`, `data/calls.json` | The calls ledger (README "Pick'em Record"): each game model's call on each game of the season in play, published before tip-off and frozen from it, and its check against the last commit |
| `tools/test_calls.js` | The calls ledger and its check on made-up games and model files |
| `pickem.json`, `app/parts/pickem.html` | The Pick'em Record (README "Pick'em Record"): the season's games, each model's call and the weeks, written by `publish.js`; the tab that grades them against Vegas |
| `tools/lines.js`, `lines.json` | The lines feed (README "The lines feed"): DraftKings' game lines, with both prices and their betslip ids, and every player prop on the games of the next two Eastern dates with a game to come, read by the job from ESPN's free feeds after the props model |
| `tools/lines_feed.js` | DraftKings' game lines as ESPN's scoreboard carries them: the page's own reading (`oddsDkHref`, `oddsIdOk`, `oddsGameLines`), line for line, and lines.json's shape of it |
| `tools/alpha.js`, `models/alpha.json`, `research/alpha.json` | The Alpha Model (README "The Alpha Model"): the NFL hub's main game model refitted on NBA games; its calls on the season in play and the games to come, and its walk-forward and every design choice tried |
| `tools/test_alpha.js` | Alpha's leakage check, its state by hand on a made-up league, tonight's rotation on made-up reports, and the committed files held to their rules |
| `tools/props.js`, `props.json` | The props model (README "Player props"): each expected player's eleven stat distributions and double chances for the next five game days, its walk-forward and market tests (`research/props.json`) |
| `tools/props_feed.js` | DraftKings' player props as ESPN's feed carries them: the parse the job and the page share, the fair-chance rules |
| `tools/props_record.js`, `data/props_<season>.csv`, `data/props_reads.json` | DraftKings' closing main lines, read once after each final (2026: the play-in and playoffs ESPN still served) |
| `tools/props_ledger.js`, `tools/props_check.js`, `data/props_shadow.json`, `data/props_shadow_lines.csv` | The props shadow ledger: the model's call frozen at tip-off, graded against the closing lines, its pre-registered bar, and the check that holds it to the last commit |
| `app/nba_hub.html`, `tools/build.js` | The site, one file; `build.js` makes `index.html` (public) and `admin.html` (adds a Data tab with backup and restore), setting each `app/parts/<name>.html` in at its marker, and stops if the card or the bubble fetches or stores |
| `app/parts/parlay.html` | The Parlay Builder tab (README "Parlay Builder"): the NFL hub's choices, Top 50 lines, builder and level engine on this page's tokens, set into the page by `build.js` at its `<!--part:parlay-->` marker |
| `app/parts/card.html` | The parlay card (README "The parlay card"): the NFL hub's Finish card, its window, image, Share link and Open in DraftKings, `window.PARLAY_CARD`, set in at its `<!--part:card-->` marker |
| `app/parts/glance.html` | The matchup bubble (README "The matchup bubble"): the NFL hub's bubble on every leg's name, with the NBA's numbers, set in at its `<!--part:glance-->` marker |
| `app/parts/gamewin.html` | A game's three windows (README "The game's three windows"): Matchup, Mismatches and Team Stats, the NFL game page's three buttons under the head card of the Player props view, each a small window over it, set in at its `<!--part:gamewin-->` marker |
| `tools/test_gamewin.js` | The job's numbers behind those windows on made-up data, each worked by hand: the team stats from a made-up season's team boxes, each club's defence and its multiplier (`oppTable`), the projections' own multiplier, and what `state.json` carries |
| `app/parts/suggested.html` | The Suggested Parlays tab (README "Suggested Parlays"): one set a night across every game of the night, Safe the likeliest paying $2 or more on $1, Medium $4, Aggressive $8, no leg limit (since 8 November 2026; until then Safe the likeliest pair and Medium and Aggressive 5 legs at most), on the night's team legs and (from the first set the page with player legs takes after 7 November 2026) DraftKings' main lines on its players at DraftKings' own fair chance, locked 2 hours before the first tip-off, and the record's pills, on the Parlay Builder's legs and sums, set in at its `<!--part:suggested-->` marker |
| `tools/suggest_ledger.js`, `tools/suggest_check.js`, `data/suggest_ledger.json` | The suggestions record (README "Suggested Parlays"): each night's set as the job last published it before its lock (the per-game sets before 7 November 2026 kept as they were), taken from the built page in jsdom, graded as its games finish by the page's own settlement, one entry a line; and its guard, which works each level out again on the set's own pool and holds the file to the last commit |
| `tools/test_suggest_ledger.js` | The record on made-up days: taken (three levels), rewritten, locked, a ruled-out level replaced, graded against settlements worked out from raw scores and box lines, a set from before kept with its Extreme, and the guard on hand-made ledgers; it runs first in the record's step |
| `tools/test_suggest_speed.js` | The time Suggested Parlays' exact search takes with no leg limit: the built page in jsdom on the pools of `tools/fixtures/sp_nights.json` (7 November 2026's night, each of its games alone, two and three of them, and the review's heavy-favourite nights), each level stopped at its limit and held to the exact search's answer; run in the job's record step and, for the heavy-favourite nights, by the smoke (README "Its time") |
| `tools/sigma.js`, `research/sigma.json` | The spread of the real margin about the player model's own number, which the Parlay Builder prices a cover from (14.5 points, the 2026 walk-forward fold), the total's about the model's total (`sigmaTotal`, 19.1 points), which the Record tab's totals picks stand on, what the Value rule's team picks were worth on each fold and what the Record tab's rule would have been (`record`); run by hand |
| `tools/smoke.js` | Loads the built viewer in jsdom with a fabricated game and checks the tabs, the tier shields and ladders, a bet graded as a book settles it, the confidence pill on each card and the key over them (section conf), the Record tab on a made-up season (section record), Refresh odds on a stubbed ESPN, the player props view on a press (section 8, README "Player props"), your parlay: player props and same-game legs (section 9, README "Same-game parlays"), the rating over time (section 10), the Pick'em Record (section 12, README "Pick'em Record"), the lines feed's readings held to the page's (section lines, README "The lines feed"), X Parlays (`tools/smoke_xparlays.js`, `SMOKE_ONLY=xparlays`, README "X Parlays"), the Parlay Builder (`tools/smoke_parlay.js`, `SMOKE_ONLY=pb`, README "Parlay Builder"), the parlay card (`tools/smoke_card.js`, `SMOKE_ONLY=card`, README "The parlay card") the matchup bubble (`tools/smoke_glance.js`, `SMOKE_ONLY=glance`, README "The matchup bubble"), Suggested Parlays (`tools/smoke_suggested.js`, `SMOKE_ONLY=sp`, README "Suggested Parlays") and a game's three windows (`tools/smoke_gamewin.js`, `SMOKE_ONLY=gw`, README "The game's three windows") |
| `liveparlays/parlays.json` | X's placed parlays, kept by hand from the slips the owner sends (README "X Parlays"); the page reads it when its X Parlays tab opens, and the job's `tools/autoclear.js` marks a finished one cleared two Eastern days after its last game |
| `app/parts/xparlays.html` | The X Parlays tab: its markup, its styles (all under `#lpCard`) and its script in a closure of its own, set into the page by `build.js` at its `<!--part:xparlays-->` marker |
| `tools/autoclear.js`, `tools/test_autoclear.js` | X's finished parlays clear themselves (README "X Parlays"); the test runs first in the job's step |
| `tools/corr.js`, `data/corr.json`, `research/corr.json` | The same-game correlation table (README "Same-game parlays"): measured on the finished seasons' box scores, written by the script only; the report beside it |
| `tools/backtest.js`, `research/backtest.json`, `research/backtest_games.csv` | The walk-forward of the model's picks and the earlier Parlay Builder's suggested parlays (its rules kept in the file as a frozen copy since 25 October 2026) against the closing line, run by hand; `publish.js` reads its summary into state.json's `vsMarket` (no longer drawn on the Record tab since 31 October 2026) |
| `tools/fetch_odds_hist.js`, `data/odds_hist.csv` | The closing lines on the 2023-2026 finals from ESPN's game summaries: a finished backfill, run by hand from a machine that reaches ESPN only to add a season (the daily job keeps each game's closing moneylines in `games.csv` from now on); its `check()` is shared with `backtest.js` and `corr.js` |
| `tools/test_corr.js` | The bivariate normal, the fit, the lookup's sign rules, and the committed table held to its rules |
| `tools/test_props.js` | The props parse, record, model, ledger and bar on stubbed answers and a scratch folder |
| `tools/test_lines.js` | The lines feed on the recorded answers and made-up ones, through a stubbed reader and a scratch file: the parse, the drops, the last good read, the quiet run, the committed lines.json held to its shape, and the job's lines step (its test run there, lines.json put back when it fails) |
| `tools/fixtures/` | ESPN answers recorded on 2026-10-15: scoreboards (finals, preseason lines, opening night's lines), which the smoke holds the page's reading of to `fetch.js`'s; two more recorded on 2026-10-25 (that Sunday's seven games with DraftKings' lines and their local and national listings, and Tuesday 27 October's, Peacock and NBC beside a home market's network), on which `test_fetch.js`, `test_lines.js` and the smoke hold the national networks and the lines feed; and one game's DraftKings props (opening night, Celtics at Pistons), which `test_props.js` and the smoke hold the parse to; and that morning's rosters and injury report as the props model reads them (`props_live_20261015.json`), on which `test_props.js` holds the live minutes to the backtest's; `sp_nights.json`, the night pools `tools/test_suggest_speed.js` times the search on, written once from the page by hand |

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
the Record tab's backtest table showed until 31 October 2026; its How it was fitted line gives the lineup-known row), four ways:

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

## The Alpha Model

The NFL hub's main game model, Alpha, rebuilt on NBA games (`tools/alpha.js`, `models/alpha.json`): the same recipe,
every constant fitted here. A least-squares formula for the home margin over a rating state, rest, the home court and a
lineup term, and the home win chance the logistic of that margin with one slope fitted by log loss. It never reads the
betting line. It keeps its own Elo, its own net rating from the team box scores and its own player ratings, so it is a
second opinion beside the team model and the player model, not either of them again.

The margin, in home points, fitted on 2021-22 to 2025-26 (6,599 games):

| Term | What | Coefficient |
|---|---|---|
| home | 1 on the home club's court, 0 at a neutral site | 1.965 points |
| Elo difference | each club's Elo before the game, updated after every final since 2004-05 by the NFL app's rule (a log-of-margin multiplier damped by the gap, K 20 over 2.3, 60 Elo of home court inside the expectation only), 70% carried into a new season | 0.0236 a point of Elo: 100 Elo is 2.4 points |
| rest | days since each club's last game, capped at 4, home less away, clipped at 3 | 0.264 a day |
| back to back | home less away | -1.748 points |
| net rating | each club's points per 100 possessions less its opponents', weighted 3% a game (team box scores, 2021-22 on), 60% carried into a new season | 0.514 a point |
| rotation drop | each club's usual rotation less tonight's, home less away (below) | -89.5: a median 1.5 points a game, a tenth of games over 4.4 |

The home win chance is 1 / (1 + e^(-0.1308 m)): a 3-point margin is 60%, 7 points 71%, 10 points 79%. The spread is
the margin, written as a home line (-m). Alpha makes no total.

**The rotation drop**, the NFL quarterback term's analogue. Each player is rated by his on-court plus-minus a minute,
shrunk by 500 minutes toward the replacement level (the plus-minus a minute of the players outside each side's top eight
by minutes, over every final before the day), each season's sums worth 0.6 of the next's. A rotation's strength is its
players at their projected minutes (the mean of their last eight appearances, the player model's rule) filled into 240
in rotation order, each weighted by his minutes over 240, above replacement. A club's usual strength is the mean, over
its last 40 games, of the rotation that played each, every player at today's rating: a player out for half of them
counts half, an absence the window has rolled past costs nothing (the club's Elo and net rating, which move about as
slowly, have taken it in), and a player traded away counts against his old club until the window rolls past him.
Tonight's strength is the rotation expected before tip-off, read one of two ways:

- the games to come, `upcoming` in `models/alpha.json`, the calls the Pick'em Record publishes: the hub's one
  availability rule, players.js `makeLiveLineup` on today's roster and injury report, run on Alpha's own players (out
  before his return date, Out out on the report's own day, suspended out), filled to 240;
- every call in `games`, the season in play's games final, under way or to come (the record takes one for a game played
  before Alpha's first published call, its backtest call), and every game of the walk-forward: the club's previous
  game's rotation, less anyone since gone to another club, each player at the rating the finals before the day left.
  A club's first game of a season has no previous game of the season, so no drop, whoever last played for it. So a
  call in `games` is always what was known before its tip-off, never this run's roster or report, and never the injury
  log (`data/injuries_log.csv`), which keeps each day's last read: on a late run that lands after a tip-off.

Should today's roster or report not read, the games to come are called the second way too, and the file's status says
so (`{ok: true, note}`), the error logged.

The drop is usual less tonight, so a club at full strength has none. Its coefficient is fitted on who actually played,
the cost of an absence that is known, which is what the report gives the live call. Early in a season the window is
mostly last season's games, so a club that remade its roster carries a drop or a gain until its new rotation fills the
window, as its carried Elo and net rating are still last season's club's: on 25 October 2026 the Lakers' was 3.1 points
(last season's LeBron James, Rui Hachimura, Marcus Smart, Luke Kennard and Deandre Ayton have all played for other clubs
since).

### Walk-forward test (`node tools/alpha.js research`, writes `research/alpha.json`)

Each season fitted on the seasons before it (from 2021-22) and scored cold on its regular-season and playoff finals with
both box scores, the player model's own games. Alpha is the call made before tip-off on the previous game's rotation,
the honest number and the reading of every call in `games`; "lineup known" is the same model told who played, never a
call, only the bound a perfect report would reach. Live, in `upcoming`, Alpha runs on the injury report, between the
two. The team model is model.json's (fitted on 2008-2022), on the same games; the player model is research.json's
walk-forward; the market is the consensus closing moneyline with the margin out and its closing spread
(`data/odds_hist.csv`). Log loss / straight up / spread error:

| Season scored | Alpha | Alpha without the rotation drop | Alpha, lineup known | Team model | Player model, no report | Player model, lineup known | Market |
|---|---|---|---|---|---|---|---|
| 2024 (1,314 games) | 0.600 / 67.8% / 10.87 | 0.609 / 66.8% / 11.03 | 0.598 / 67.2% / 10.91 | 0.609 / 66.1% / 11.06 | 0.615 / 67.7% / 11.30 | 0.613 / 66.3% / 11.28 | 0.583 / 69.1% / 10.66 |
| 2025 (1,320) | 0.602 / 66.8% / 11.01 | 0.607 / 66.7% / 11.04 | 0.592 / 68.0% / 10.81 | 0.609 / 65.5% / 11.12 | 0.600 / 67.7% / 11.04 | 0.591 / 67.6% / 10.96 | 0.585 / 68.7% / 10.63 |
| 2026 (1,322) | 0.598 / 69.1% / 11.37 | 0.603 / 68.3% / 11.44 | 0.590 / 67.9% / 11.20 | 0.601 / 68.8% / 11.53 | 0.603 / 66.7% / 11.52 | 0.589 / 68.5% / 11.38 | 0.576 / 68.7% / 11.00 (1,318 games) |

The rotation drop is what makes Alpha more than a copy of the team model: without it Alpha is level with the team model
(0.609 against 0.609, 0.607 against 0.609, 0.603 against 0.601); with it Alpha is ahead in all three seasons, by 0.009,
0.007 and 0.0025, on nothing but the previous game's rotation. 2026, scored once with the design 2024 and 2025 chose:
0.5985 against the team model's 0.6010 and the player model's 0.6026 with no report. Told who played, Alpha (0.590) is
level with the player model told the same (0.589). The market is ahead of every model in every season, by 0.016 to 0.023.

The design was chosen on 2024 and 2025 alone, one knob at a time from a start, each change kept only by the hub's rule
(lower log loss in both seasons, by 0.0005 between them, and the spread error no worse; 73 trials, every one in
`research/alpha.json`). Kept, in order: the rest gap and the back to back both (the gap alone was the start);
plus-minus over Hollinger's Game Score for the player ratings; a 40-game usual window (5 to 82 tried; the grid was
widened twice when the search stopped at its top); the fit from 2021-22 rather than 2022-23; 3% a game on the net
rating (3% to 12% tried); the NFL app's Elo rule over FiveThirtyEight's NBA multiplier. Tried and not kept: altitude
(Denver and Utah at home), K 15 and 25, the net rating carried 40% or 80%, 250 or 1,000 minutes of shrinkage, a season
decay of 0.4 or 0.8, a usual rotation of only the players still at the club, and the drop fitted on the previous game's
rotation instead of on who played. The rotation drop itself passes the same rule on the chosen design (2024 0.609 to
0.600, 2025 0.607 to 0.602); had it not, Alpha would have shipped without it and said so. One development run, on the
starting design, printed three baseline variants' 2026 numbers before the search existed, and no other 2026 number was
printed before the design was fixed; nothing was chosen on them (the file's notes give them).

What it does not use, and why: the betting line (the market is the yardstick, as for the NFL's Alpha); the player model's
ratings, coaches or travel (its own ratings keep it a second opinion); altitude (tried, not kept); preseason games (never
learned from, never called); a Day-To-Day player as half a player (the hub's one rule, out before his return date); a
total (the player model publishes the site's); the injury log (above); and the season in play, which is never fitted,
tuned or scored here (its calls are graded on the Pick'em Record like every model's).

In the job, `node tools/alpha.js` (about 3 seconds) replays every final since 2004-05 with the fitted numbers in
`models/alpha.json` and writes the calls: `games`, every regular-season and playoff game of the season in play on the
previous game's rotation, and `upcoming`, the games to come on today's roster and report (above). It never refits;
`node tools/alpha.js fit` refits by hand on the seasons before the one in play (so a season just finished joins the fit
once the next season's schedule is in, about 30 days before its opening night), and `node tools/alpha.js research` walks
forward, chooses the design and refits. An unchanged file keeps its stamp, so a quiet day commits nothing; a failed run
(no final in the games table, a research file that does not read, any error) keeps the last good calls and writes
`status: {ok: false, why}`, and a model file that does not read is left as it is, never refitted in its place.
`node tools/test_alpha.js` (about ten seconds), which the job runs straight after it on the same data, holds in every
phase of a season (tried on copies of the data set back to before opening night, opening night, 15 January, the
playoffs and July): the leakage rule (the day's games read before tip-off and once final give the same inputs and the
same call, on the season in play's last day with a final, else the last day with one of any season), every call in
`games` on the previous game's rotation and none moved by today's roster or report, each club's first game of the
season in play with no drop; the state by hand on a made-up league (the Elo update, the net rating, a club's first game
of a season, in `games` too, a neutral site, a postponed game, a club with no box score, every player out); tonight's
rotation through makeLiveLineup on made-up reports (Out, Day-To-Day returning after the game and on it, suspended, a
debutant, a trade, and a report that does not read); the fit on planted data and its own conditions on a frozen
made-up league; determinism and a quiet day, and a run that refuses (the last calls kept, status `{ok: false, why}`);
and the model file (the contract's shape whatever its status, every game of the season in play called, the fit's
seasons before the season in play, the walk-forward research/alpha.json's). A refit of the fit's seasons on today's
data is printed beside it as a note, never a failure: ESPN back-fills an old final's box score now and then.
## The ELO Model

The NFL hub's third game model, the ELO Model, rebuilt on NBA box scores (`tools/elo_model.js`, `models/elo.json`; its
id on the record is `elo`, and the file is named apart from `tools/elo.js`, the team model). Every player carries his
own Elo rating, moved after each final by how his game compared with a typical one against the opposing club, and a
game is called on the ratings of the rotation each club is expected to play. It is the NFL's form, its update and its
logistic, with its constants wherever they carry over. It never reads the betting line, and it shares nothing with the
hub's player model but the box scores and the availability rule: its ratings, its scores and its fit are its own, so it
is a third opinion on the record, not the player model again.

**The ratings.** After each final, each player who played is rated against the opposing club's unit, the NFL's update:

```
z = clip((score - mu) / sd, -3, 3)       mu, sd: a regular's game (12 minutes or more) of the season before
S = 1 / (1 + e^(-1.5 z))                 an average game is 0.5, one sd better 0.82
E = 1 / (1 + 10^((U - R) / 400))         U: the opposing club's unit, 1500 to start
R += K w (S - E)                         K 56 for a player's first 8 rated games, 32 after; w = min(1, minutes / 24)
U -= 60 x the mean of w (S - E) over the players it faced, after the game
```

The score is his on-court plus-minus plus Hollinger's Game Score (`pts + 0.4 fgm - 0.7 fga - 0.4 (fta - ftm) + 0.7 orb
+ 0.3 drb + stl + 0.7 ast + 0.7 blk - 0.4 pf - tov`). A player who plays under 0.35 of his usual minutes (the median of
his last five, a starter's 19 or more) left early: that game is not rated, but a second short game in a row is (a
smaller role, not an injury). A row with no minutes is not rated, and a game with no box score moves nobody. Every
rating and unit is carried 0.75 of the way into a new season; a player new to the files from 2022-23 on starts at 1450
(2021-22, the first season, rates everyone from 1500). The typical game is the season before's, so a season's ratings
never read a figure computed over that season (2021-22 reads its own games before each day). What the ratings say on
25 October 2026: Wembanyama 1717, Gilgeous-Alexander 1716, Jokić 1690, Towns 1667 and Brunson 1665.

**The game model.** A club's strength is its expected rotation's: the eight players with the most projected minutes
(each one's mean over his last eight appearances, a new season's from his last five regular-season games, as the player
model's are) filled into the game's 240 minutes in rotation order, sorted by rating and weighted 1, 0.9, 0.8, 0.7, 0.6,
0.45, 0.3 and 0.2, an empty slot at 1450 (the NFL's `strength()` and its replacement level, one group where the NFL has
eight positions). The home win chance is the logistic, with no intercept, of

```
0.264 home + 1.326 (rotation_home - rotation_away) / 100 - 0.323 b2b
```

`home` 1 on the home club's court and 0 at a neutral site, `b2b` a back to back, home less away. Fitted by Newton's
method with a ridge of 0.5 on every weight but home's (the NFL's `logistic_fit`) on the 6,605 decided finals of 2021-22
to 2025-26: even rotations at home are 56.6%, ten Elo of rotation is 3.3 points of win chance at even, a back to back
costs 8. The margin is the same logit times 7.73 points (least squares on the same games), so the pick and the spread
never disagree: ten Elo of rotation is a point, the home court two, a back to back 2.5. The spread is the margin written
as a home line (-m). The model's own spread chance is `Phi((m + line) / 14.64)` for the home side at
its line (`params.sigma`, the root mean square of the margin's miss in the 2026 fold, called before tip-off), and its
moneyline chance `pHome`. No total. Its calls stand on the Pick'em Record and in the matchup bubble's model list; until 5
November 2026 Suggested Parlays' Elo picks stood on its own chance too (a moneyline its `pHome`, a spread
`Phi((m + line) / 14.133)`, its margin at the miss research measured for the model alone on 2024-2025,
`research/elo.json`'s `pick.spread.sigmaModel`), which the owner took off the page that day (README "Suggested Parlays",
"What went"); `params.pick` and its study below stay as research, and no page reads them.

**Who plays, before tip-off.** Every call in `games`, which is what `tools/calls.js` takes as the call of a game played
before the model's first published call (a backtest), is read on the previous game's rotation, whatever the game's state:
a final, a game under way, a final of the run's own day, a game to come. That is the reading the walk-forward scores
(`pretip`): the club's previous box-scored game's players, less anyone who has since played for another club; a club's
first game of a season reads its last game of the season before by the same rule. It never reads this run's roster or
injury report, or `injuries_log.csv`, which keeps each day's last read and on a late run is written after tip-off. The
files keep no past rosters, so a player who moved in the summer counts for his old club's first game until he has played
for his new one: on opening night 2026-10-20, 11 of the 59 rotation slots (246 of 1,384 minutes) were players who had
moved (Jaylen Brown still on Boston, Paul George on Philadelphia), by the rule the walk-forward scored in every season.
Only `upcoming`, the games not yet final, is read on the hub's one availability rule, players.js `makeLiveLineup` on today's
roster and injury report (out before his return date, Out out on the report's own day, suspended out, a debutant at twelve
minutes), filled to 240. It runs on a copy of the ELO Model's players made for each game, so nothing it does (a roster
player with no game on record is made up for it) can move a rating, a player's minutes or his club: it shapes the games
to come and nothing else. Who actually played ("lineup known") is a hindsight row the walk-forward shows beside the honest
one, never a call.

### Walk-forward test (`node tools/elo_model.js research`, writes `research/elo.json`)

Each season fitted on the seasons before it (from 2021-22) and scored cold on its decided regular-season and playoff
finals with both box scores, the games every model on the record counts (1,314, 1,320 and 1,322; `eloAllFinals` in the
file adds the six finals with no box score, called on the games before them: 1,319 and 1,321 in 2024 and 2025, log loss
0.6007 and 0.6050). The ELO Model is the call made before tip-off on the previous game's rotation; "lineup known" is the
same model told who played. Live it runs on the injury report, between the two. The team model is model.json's (fitted on
2008-2022) and the player model research.json's walk-forward, both on the same games; the market is the consensus closing
moneyline with the margin out and its closing spread (`data/odds_hist.csv`), on those with a line. Log loss / straight
up / spread error:

| Season scored | ELO Model | ELO Model, lineup known | Team model | Player model, no report | Player model, lineup known | Market |
|---|---|---|---|---|---|---|
| 2024 (1,314 games) | 0.601 / 67.6% / 10.90 | 0.596 / 66.8% / 10.89 | 0.609 / 66.1% / 11.06 | 0.615 / 67.7% / 11.30 | 0.613 / 66.3% / 11.28 | 0.583 / 69.1% / 10.66 |
| 2025 (1,320) | 0.605 / 68.0% / 11.05 | 0.595 / 68.6% / 10.88 | 0.609 / 65.5% / 11.12 | 0.600 / 67.7% / 11.04 | 0.591 / 67.6% / 10.96 | 0.585 / 68.7% / 10.63 |
| 2026 (1,322) | 0.602 / 67.5% / 11.44 | 0.592 / 67.4% / 11.25 | 0.601 / 68.8% / 11.53 | 0.603 / 66.7% / 11.52 | 0.589 / 68.5% / 11.38 | 0.576 / 68.7% / 11.00 (1,318) |

On the previous game's rotation, with no report at all, the ELO Model is ahead of the team model in 2024 and 2025 (by
0.008 and 0.004) and a shade behind it in 2026, scored once with the design 2024 and 2025 chose: 0.6023 against 0.6010.
Against the player model with no report it is ahead in 2024, behind in 2025 and level in 2026 (0.6026). Told who played,
it gains 0.005 to 0.011, and is ahead of the player model told the same in 2024 and behind it in 2025 and 2026 (0.595
against 0.591, 0.592 against 0.589). The market is ahead of it in every season, by 0.017, 0.019 and 0.026 on the same
games. On those games its pick is the market favourite's in 85% to 89% of them, and Team Elo's in 86% to 89%: close to
both, a copy of neither. Its spread error is the lowest of the three models' honest calls in 2024 and 2026 (the
market's is lower still) and level with the player model's in 2025 (11.05 against 11.04).

The design was chosen on 2024 and 2025 alone, one knob at a time from the NFL's own form (Game Score, the NFL's
production scoring; three positions, G, F and C, weighted 1, 0.7, 0.45 and C 1, 0.5; home court only; the NFL's
constants), each change kept only by the hub's rule: lower log loss in both seasons, by 0.0005 between them, and the
spread error no worse, each season scored on every decided final it has (28 changes tried over two passes, every one in
`research/elo.json`, each knob's own start value among its choices so a second pass could move it back; none moved).
Kept, in order: plus-minus over Game Score (2024 0.642 to 0.612, 2025 0.655 to 0.614: a box line says less about winning
than the score of the minutes a player was on the floor); plus-minus and Game Score summed (0.608, 0.613); one rotation
of eight over the three positions (0.606, 0.610; ESPN's three labels are loose in today's game); the back-to-back column
(0.602, 0.606); new players at 1450 (0.601, 0.606); the unit's K at 60 rather than the NFL's 120 (0.601, 0.605). Tried
and not kept: the weights fitted on who played instead of the previous game's rotation, the fit from 2022-23, K halved
and half again, the unit's K at 240, a carry of 0.6 or 0.9, a game counting in full at 36 minutes. The design is frozen:
`research` re-scores it, and only `research search` runs the search again (for a new version of the design).

2026 numbers were seen before the search, though it never read them. The planning pilot (not in the repo; its table is
in the build plan) printed 2026 log loss for Game Score (0.6424), plus-minus (0.6036), the two summed (0.6038), plus-minus
with the back-to-back column (0.6050), plus-minus told who played (0.6072), one rotation of eight against the three
positions (0.610 against 0.607, at other K values) and new players at 1450 (0.602 against 0.604), and the first 36 finals
of 2026-27 for Game Score (0.641) and plus-minus (0.619); a timing run of this code printed the starting design's 2026
numbers under each of the three scores. Of the six changes the search kept, those 2026 numbers favoured two (plus-minus
over Game Score, new players at 1450) and were against three (the sum, one rotation, the back-to-back column); the unit's
K at 60 was not compared on its own there. Every decision was taken on 2024 and 2025 by the rule, but the 2026 fold is
not a clean first look at the design.

What it does not use, and why: the betting line (the market is the yardstick); the player model's ratings, RAPTOR priors
and coaches (its own ratings keep it a third opinion); travel and altitude (the player model's and the team model's
terms, not in the NFL's form, and not tried); a total (the player model publishes the site's); seasons before 2021-22
(no box scores); a ladder of its own ratings on the page (the Players tab ranks the player model's, and two player
ladders would contradict each other); preseason games (never rated, called or graded); and the season in play, which is
never fitted or tuned on. Its 36 finals so far, called as backtests on the previous game's rotation: 22 right, log loss
0.612, too few to read anything (on the injury log, which the first version read, they were 20 right and 0.633).

### Pricing the Elo picks (`params.pick`, `research/elo.json`'s `pick`)

Kept as research: the page no longer uses it. Suggested Parlays' Elo picks were the ELO Model's moneylines and spreads where
its chance beat the price, until the owner took them off on 5 November 2026 (README "Suggested Parlays", "What went"),
after the evidence below: on the closing line its picks lost against the market, and its honest price was the market's
own. `params.pick` is still fitted by `research` and written to `models/elo.json`, and nothing reads it. On the closing
line the model's own numbers are no price: its cover chance `Phi((m + line) / sigma)` scores worse than a coin flip in
every fold, and its moneyline edges, said about 60%, win about half. So the research measures the model pulled toward the market,
on the 2024 and 2025 folds alone (each fold's model fitted on the seasons before it; a grid of 0 to 1 by 0.05, the pooled
log loss), then scores 2026 once:

- a spread leg, home side at home line h: `Phi((wSpread m + (1 - wSpread)(-h) + h) / sigma)`, m the model's home margin
  (`-spread`) and sigma that blended margin's own miss on 2024-2025; scored on the cover at the closing line, a push left
  out (there the market's own chance is a coin flip, 0.6931);
- a moneyline, home side: the logistic of `wMl logit(pHome) + (1 - wMl) logit(q)`, q the market's no-vig chance.

Both weights come out at 0: any weight on the model's margin makes the cover log loss worse in both 2024 and 2025, and on
the moneyline the pooled best is about 0.02 (0.584448 against 0.584453 at 0, worse in 2024, better in 2025), 0 on the grid. So
`params.pick` is `{wSpread: 0, wMl: 0, sigma: 13.722}`: priced honestly, an Elo pick is the market's own chance, never 3
points above its price, so the Elo picks section would show none. The integrator's decision of 25 October 2026, as the NFL
hub's Elo picks stand on the model's own chance, was to stand the picks on the ELO Model's own chance, every card led by
DraftKings' fair chance, the far-off guard applied, and the record below said in the section's title, with a switch
(`ELO_PICK_BLEND`, off) to price them by `params.pick`; the section, the switch and `state.json`'s `eloPicks` went with
the owner's call of 5 November 2026.
The numbers, log loss of the model alone (w = 1) and pulled (the weight chosen), with the NFL Value rule's 3-point-edge picks (a spread side at 55.4% or more, 3 points over -110, since the file
keeps no spread price; a moneyline side at 45% to 97% and 3 points over the chance its price implies, margin in):

| Fold | Spread, model alone | 3-pt picks won | Spread pulled (w 0) | Coin | Moneyline, model alone | 3-pt picks: said, won, units on $1 | Moneyline pulled (w 0) = market |
|---|---|---|---|---|---|---|---|
| 2024 (1,291 / 1,314 games) | 0.7081 | 626, 49.4% | 0.6931 | 0.6931 | 0.6007 | 334: 59.1%, 51.5%, +9.1 | 0.5835 |
| 2025 (1,319 / 1,320) | 0.7166 | 753, 52.2% | 0.6931 | 0.6931 | 0.6046 | 393: 61.3%, 50.6%, +7.0 | 0.5854 |
| 2026 (1,318 / 1,318) | 0.7181 | 784, 49.4% | 0.6931 | 0.6931 | 0.6020 | 376: 59.6%, 45.7%, -17.9 | 0.5757 |

Against the opening line and opening moneylines (2023-24 on in `odds_hist.csv`; `pick.open`, for information, never priced
on), chosen the same way, the weights are 0.25 (spread, sigma 14.03) and 0.3 (moneyline): pulled, 0.6934 and 0.6904
against the coin's 0.6931 in 2024 and 2025, and 0.5940 and 0.5956 against the opening market's 0.5951 and 0.5976; scored
once on 2026, 0.6935 against 0.6931 and 0.5869 against 0.5859, a shade worse than the opener on both. A line read on game
day is nearer the close than the open, and on 2026 the model added nothing even to the opener.

In the job, `node tools/elo_model.js` (about 2 seconds) replays every box score since 2021-22 with the fitted weights
in `models/elo.json` and writes the calls: `games`, every regular-season and playoff game of the season in play on the
previous game's rotation, and `upcoming`, the games not yet final on today's roster and report, each `{pHome, spread}`;
`tools/calls.js` freezes them at tip-off for the Pick'em Record. The ratings move with every final, the weights never:
`node tools/elo_model.js fit` refits them by hand on the finished seasons before the season in play (between seasons,
once the new schedule is in games.csv: in the summer the season just played is still the season in play, so it is never
in a fit; the run logs a note when a season has finished since the fit), and `node tools/elo_model.js research` (about
4 seconds) re-scores the frozen design, re-runs the pick study (research only) and refits. An unchanged file keeps its stamp, so a quiet day
commits nothing. A run that cannot call refuses: it exits 1, keeps the last good calls and writes `status: {ok: false,
why}` (no final in games.csv, the injury rule not loading, a research file that does not read, no design to fit; a model
file that does not read is left as it is), says why in the log; the job commits that file (the step red, the Pick'em
Record saying why) and puts the last commit's back only when the test fails.

The job runs `node tools/elo_model.js`, then `node tools/test_elo_model.js` whatever the model's exit, in one step, so the test (about 10 seconds) passes
in every phase of a season on the data as the job sees it, and turns on nothing ESPN can fill in late: an old final's box
score back-filled moves the refit and the folds' counts, which the test prints as notes, never failures, while the fit
procedure is held on made-up data. It holds the leakage rule (on the real data's latest day with a final and a mid-season
day, and on every morning of a made-up season whose bench sits in turn, a game read before tip-off and once final gives
the same inputs and the same call; no row of a season moves with a later season's games), a game under way and a final of
the day each called in `games` on the previous game's rotation, never this run's report, the ratings by hand (the first
final's update and its unit, a row that did not play, the left-early skip once and the second short game rated, the
offseason carry, a club's first game of a season and its first ever, a player who moved in the summer before and after he
plays for his new club), a neutral site (no home court, the call turned exactly over when the clubs swap), a postponed
game (left out by `load()`, or left as scheduled a season back with the live reading on: no rating, player or final's
input moved), a club with no box score, the strength's slots, fill and ties, tonight's rotation through makeLiveLineup on
made-up reports (Out, Day-To-Day returning after the game and on it, suspended, a debutant, a trade) and the live reading
moving nothing, the fit (planted weights recovered, equal clubs at a neutral site 50/50, fitLive by hand on a made-up
season), the pick study's weights (a made-up model that knows each margin given nearly all of it, one that knows nothing
none), determinism (a box file's row order changes nothing, `games` the same with the live reading off) and a quiet day,
the committed files (the contract's shape whether the run called or refused, a refusal on a scratch copy keeping the last
calls and saying why, every game of the season in play called on the previous game's rotation, the walk-forward
research/elo.json's on the box-scored finals, the design and the pick weights research/elo.json's, the weights fitted on
finished seasons), and every phase of a season built in memory on the real data cut back (no final yet, opening night,
the playoffs, the summer).
## The Joker

The NFL hub's Joker is one boosted-tree classifier on every variable its job has before kickoff, fitted on finished
seasons and frozen for the season. This is the NBA's, with the NFL's settings: gradient-boosted trees on binomial
deviance, depth 4, 25 rounds at a learning rate of 0.1, at least 5 games in a leaf, a missing number given the training
rows' median and each category one-hot. The NFL fits them with scikit-learn's histogram trees; the job here has no
dependencies, so `tools/gbm.js` writes the same algorithm out in plain Node, with exact splits over the sorted values
in place of 255 bins (the same method, not the same trees to the bit), deterministic to the bit and held to small sets
worked out by hand in `tools/test_gbm.js`. It gives the chance the home side wins, and a spread: the home margin that
chance implies, at a scale fitted by least squares on the training rows (9.2 points a unit of log-odds), so the spread
always names the side the pick does.

Its inputs, built by one function (`build`) for the rows it is trained on and for the games it calls:

- **The market**: the two moneylines' chance with the book's margin taken out (each side's implied chance over their
  sum), the home line and the total where `fetch_odds_hist.js`'s `check()` passes them. Closing lines from
  `data/odds_hist.csv` for 2022-23 to 2025-26; from 2026-27 on `games.csv`'s, the job's last read before tip, which
  `fetch.js` freezes at tip-off.
- **The two models**: Team Elo's pre-game chance, and the player model's chance, spread, total and pace with the
  previous game's lineup at its projected minutes (the "no report" lineup: it can be replayed for every past game, and a
  game to come has the same one). Each fold of the walk-forward replays the player model on that fold's `research.json`
  parameters, fitted on the seasons before it; the live trees on `players.json`'s as they stood when the trees were
  fitted, which the Joker keeps in its own file so a later refit of the player model does not move its inputs under it.
- **The setting**: the play-offs, the day of the season, a neutral site, altitude (Denver and Utah at home), each side's
  days of rest (capped at 10), a back to back, three games in four nights, the time zones crossed since a game two days
  or less before (the player model's travel rule; none at a neutral site), same division, same conference, and in the
  play-offs the series game and the home side's lead in it. All read from the schedule, whatever has been played.
- **Running form**, from the team box scores: each side's points per 100 possessions scored and allowed and its pace
  (possessions as the player model counts them), a running average at 0.1 a game, carried 0.7 of the way toward the
  league's at a season's turn (Team Elo's carry), the league's a running mean at 0.005 a team-game (the player model's
  league efficiency); 2021-22, the first season with box scores, only warms it up.
- **The people and the teams**, as categories: home and away, both coaches (`coachOf`, a dated change honoured, read as
  the game's day began: below) and each side's top player by minutes in its previous game.

Every input is known before tip. A row reads the state as its Eastern day began: every final of an earlier day and
nothing of its own day, and each club's coach as `coaches.csv` had him the day before, since the job dates a coach
change by the day it read it and a late run reads it after that day's tip-off (a change dated on a game's own day is the
club's from the next game, in the categories and in the player model's replay alike). The two models' numbers are read
the same way: each replay is run on the finals with a copy of each game, marked a game to come and set in front of its
day's finals, so a model prices a final exactly as it would have that morning. (Read off the replays' own finals
instead, three things would differ between a game's training row and its live one: the home edge after the day's
earlier finals, Team Elo's spread rounded to the tenth the player model blends, and a team's first game of a season,
whose naive lineup the player model prices on ratings not yet carried into the season where a game to come is priced on
carried ones.) Nothing reads the injury report or the rosters. So the only input that moves once a game's day has begun
is the market: the job reads it again on every run until tip-off and freezes it there (`fetch.js`'s `merge`), so a game's
call is the call on its last read before tip-off, the same before and after its tip, a game under way or played today
included, and `games`, which the Pick'em Record takes as the Joker's call for every game of the season played before its
first published call, is pre-tip by construction; the games to come are called the same way, on the market's latest
read. `tools/test_joker.js` rebuilds every day of a
made-up season, the play-offs among them, as its morning saw it, and the job's own last day with finals, and holds every
game's row to the row it has once final; with a day's finals reaching its own rows, the copies set after them, a coach
change read on a game's own day, or the top player taken from the game's own box score, it fails.

**The design** was chosen by a rule set before any fold was scored. Four designs: the inputs above without the people
(base), with them (people), base with the four factors scored and allowed (factors), and base without the teams
(noteams); the one with the lowest mean log loss on 2024 and 2025, then for it the spread with the lower mean error on
the same folds. The people survived in both seasons (0.6265 and 0.6055 against base's 0.6271 and 0.6080), the four
factors did not (0.6350, 0.6081), dropping the teams helped 2024 and hurt 2025 (0.6254, 0.6101), and a second set of
trees fitted to the home margin beat the margin the chance implies (10.97 points of error against 11.19). The design is
kept as chosen (`CHOSEN`): a re-scoring reports what the rule would pick (`rulePick`) and never re-chooses. The margin
trees' spread named the other side from the pick in 147, 108 and 56 games of the folds (8 of the 59 calls of 25 October
2026, `2027_20261030_LAL_GSW` 55% to Golden State and Los Angeles by 3.2), so on review the published spread was set to
the one the chance implies, 0.2 points worse on 2024 and 2025 and in agreement with the pick by construction; the
margin trees' error stays in `research/joker.json` beside it, and nothing publishes them.

2026 was first scored after the choice, on the chosen design only, and has been scored again since, on the same design:
while the code and the data were finished on 25 October 2026 (the job's data moved between runs), and in the review's
fixes of that day (the coach as the day began, the spread from the chance, every box-scored final counted), each time
reported as it came out, with nothing chosen or tuned on it. The spread was switched knowing every fold's numbers, for
agreement with the pick, not for its error. And the 2026 numbers of the market, Team Elo and the player model were
published (above, `research.json`, `research/backtest.json`) before the Joker's designs were set.

### Walk-forward test (`node tools/joker.js research`, writes `research/joker.json`)

Each fold fits the trees on the finals with a closing moneyline from 2022-23 to the season before, and scores the season
cold, every model on the same games: every decided final with both box scores (1,314, 1,320 and 1,322; 6 finals with a
side's box score missing are left out, named in the file), the set every model on the Pick'em Record is scored on and
the walk-forward `models/joker.json` publishes. Four 2026 play-off finals have no moneyline anywhere
(`2026_20260430_DEN_MIN`, `2026_20260507_CLE_DET`, `2026_20260513_CLE_DET`, `2026_20260523_NYK_CLE`): the trees call
them with the market missing, imputed as any missing input is, which the live job never does. Log loss / straight up /
spread error:

| Season scored | The Joker | Team Elo | Player model, no report | Player model, lineup known |
|---|---|---|---|---|
| 2024 (trained on 2023), 1,314 finals | 0.627 / 66.2% / 11.40 | 0.609 / 66.1% / 11.06 | 0.615 / 67.7% / 11.29 | 0.613 / 66.3% / 11.27 |
| 2025 (on 2023-2024), 1,320 | 0.606 / 67.1% / 10.98 | 0.609 / 65.5% / 11.12 | 0.600 / 67.7% / 11.03 | 0.591 / 67.6% / 10.94 |
| 2026 (on 2023-2025), 1,322 | 0.591 / 68.5% / 11.27 | 0.601 / 68.8% / 11.53 | 0.603 / 66.7% / 11.51 | 0.589 / 68.5% / 11.37 |

And on the finals among them with a closing moneyline (all of 2024's and 2025's, 1,318 of 2026's), beside the market:

| Season scored | The Joker | Market (no-vig moneyline) | Its margin trees' spread error, for comparison |
|---|---|---|---|
| 2024, 1,314 finals | 0.627 / 66.2% / 11.40 | 0.583 / 69.1% / 10.66 | 11.12 |
| 2025, 1,320 | 0.606 / 67.1% / 10.98 | 0.585 / 68.7% / 10.63 | 10.81 |
| 2026, 1,318 | 0.590 / 68.6% / 11.27 | 0.576 / 68.7% / 11.00 | 11.13 |

(The market's spread error is on the games with a line that passes `check()`.) The market beats it in every season, by
0.043 of log loss with one season to learn from, 0.020 with two and 0.015 with three, each 90% interval (days
resampled, `backtest.js`'s seeded bootstrap) clear of zero. It takes the market's favourite in 86%, 92% and 98% of
games, and where it does not it went 75-110, 41-63 and 13-14: it is the market, read coarsely, with more to learn from
each season. Against the hub's own models it is behind Team Elo and the player model in 2024, ahead of Team Elo and
behind the player model in 2025 (by 0.006 with no report, 0.014 with the lineup known), and in 2026 ahead of Team Elo
and of the player model with no report, and within 0.002 of the player model on a perfect report (0.591 against 0.589);
its spread error is the lowest of the hub's models in 2026, behind the player model on a perfect report in 2025 (10.98
against 10.94) and the highest in 2024. The same trees on the market's three numbers alone did better than the whole
Joker in every season (0.604, 0.601, 0.581): at these settings, which are the NFL's and were not tuned, the rest adds
more noise than signal. The player model's travel term, in every fold's parameters, was kept after the October 2026
refresh looked at 2023-24 to 2025-26, and Team Elo's learned home court was added after a look at the same seasons;
`research/joker.json` lists what was looked at.

The folds train and score on closing lines, while the job calls on its last read before tip, which is earlier. Scored on
the opening lines instead, where `odds_hist.csv` has them, it loses 0.007, 0.010 and 0.005 of log loss (the market
itself 0.011, 0.012 and 0.010): a bound on what the earlier read costs.

### The live trees and the job step (`node tools/joker.js`, writes `models/joker.json`)

The live trees are fitted by hand, `node tools/joker.js fit`, on the design the walk-forward chose: the 5,272 finals with
a closing moneyline of 2022-23 to 2025-26 (in sample 0.560 and 71.0%; `params.splits` counts what the trees split on,
the market's chance 76 times of 345, its line 20, then the running form and the two models, the people and the
teams 93 between them), and never refitted by the job. They were refitted once, in the review's fixes of 25 October
2026, for the coach read as the day began (the same design and settings; no chance of that day's 59 calls moved by
more than 1.2 percentage points). While
a season is under way, a fit whose inputs read it (the trees' own seasons, or the seasons `players.json`'s or
`model.json`'s parameters were fitted on, as a players.js refit taking in the season in play would) is refused unless
`--force` is passed: its trees would call games they were fitted on. A refused fit leaves the file as it was.

The job's step is `node tools/joker.js`, then `node tools/test_gbm.js` and `node tools/test_joker.js` whatever its exit,
after `players.js` and before `calls.js`, with `models/joker.json` put back to the last commit's when the tests fail; the test runs whole, about ten seconds on the
real data (twenty when the training rows have drifted, below), in every phase of a season. `node tools/joker.js`
rebuilds the rows from the data and scores the season in play with them, in about five seconds: a call (`pHome`,
`spread`) on every final and game not final that has a moneyline, a final's being the call on its last read before
tip-off (for the games before its first published call, the backtest the Pick'em Record counts as such), `upcoming` the
games not final, and each call's input row of the season in play logged in `inputs` while its game is still to tip, then
frozen, so a later refit can train on what the job saw rather than on closing lines (a game that loses its line before
tip keeps its last row; a postponed one leaves, and so does every row of an earlier season). A game with no moneyline
posted gets no call: a missing market would be imputed as a typical favourite; on 25 October 2026 that was 202 of the
225 games to come. It refuses a season more than one past its fit (from about 20 September 2027, when the 2027-28
schedule comes in, until the trees are refitted by hand) and an empty schedule: a refusal writes `status: {ok: false,
why}`, keeps its last good calls less every game no longer to come (so the file never lists a tipped game as one to
come), and exits 0, so the job publishes it and the Pick'em Record says why. Anything else that goes wrong (a file that
does not read, a fault in the code) writes the same and exits 1, so the step is red and that file, the last good calls
saying why, is committed; the last commit's file is put back only when the tests fail. An
unchanged file keeps its stamp, so a quiet rerun writes nothing.

The test holds, on the real data in whatever phase it is in: the leakage check on the last day with finals; the file's
shape whatever its status; a file that ran being exactly what this code makes of today's data (its calls, its games to
come, its about and walk-forward), with every spread agreeing with its pick; and the input rows against the last
commit's (none of the season's dropped while its game is on the schedule, a changed one rewritten after it and before
its tip). It rebuilds the trees' training rows from today's data and, where they are not the ones fitted on (ESPN
back-fills old box scores), refits and prints how far the season's calls would move: a note, never a failure. It was
run on copies of the data set to each phase: no game of the season played and none priced, the opening night priced,
the opening night under way, mid-season, the 2025-26 play-offs to come, the summer, and the 2027-28 schedule pulled
(the refusal); each passed.

What it does not use, and why:

- **The injury report**: its log starts on 20 September 2026, so no game it is trained on has one, and an input only the
  live games had would be the skew the NFL Joker has with its quarterbacks. The moneyline carries the news.
- **Who played**: the player model's "lineup known" and "actual minutes" know the box score, which no morning does.
- **The season as a number**: a tree cannot carry it past the last season it saw. **Tip times**: `games.csv` has them
  from 2026-27 only. **Referees, arenas**: not in the hub's data, and the arena is the home club.
- **A refit in the season**: none. If one is ever made, the NFL's rule holds: the calls it replaced go in a file the job
  never writes, and the record grades those.

## Pick'em Record

The NFL hub's Pick'em Record, on NBA games: every model's straight-up record this season against Vegas's, on the calls
each published before tip-off. The models are the three ported from the NFL hub (the Alpha Model, the Joker, the ELO
Model: README sections above), the hub's own Player Model (the number Tonight shows, `data/predictions.csv`'s `pHome`)
and Team Elo (`team_pHome` there); Vegas is the zero line.

### The calls ledger (`tools/calls.js`, `data/calls.json`)

`data/calls.json` is `{season, about, calls: {alpha|joker|elo: {<game id>: {pick, pHome, at, src}}}}`, one call a line,
written by `node tools/calls.js` from each model's `models/<id>.json` (the Player Model's and Team Elo's calls are
`data/predictions.csv`'s, frozen the same way by `players.js`). A game still to tip takes this run's call (`src:
'published'`, `at` the run's time; an unchanged chance keeps its old stamp, so a quiet run writes nothing); from tip-off
(its status no longer scheduled, or its tip time passed) the call is frozen and never written again. A game played before
a model's first published call (the model is new, or the season is) gets one call from the model's own replay, worked out
on what was known before that game's tip by the model fitted on earlier seasons only (`src: 'backtest'`, each model's
section says its pre-tip reading); a game a publishing model missed (it could not run that day) gets none. A model whose
file is missing or says it could not run adds nothing and keeps what it had. A new season starts a new ledger (the last
season's stays in git). `CALLS_NOW` stands in for the clock (to the minute, `YYYY-MM-DDTHH:MMZ`, as both scripts read
it): the job hands the run's one clock to the script and its check, as the suggestions record's step does, so a tip-off
minute that turns in the moment between the two is judged by the check as the script judged it, never as a frozen call
moved; the tests hand their own.

`node tools/calls_check.js` holds the file to the last commit's (`git show HEAD:data/calls.json`) and `data/games.csv`: a
call the last commit had on a game that has since tipped is still there, unchanged; a published call was logged before its
game's tip; a backtest call is on a game that tipped at or before the model's first published call (tipped as `calls.js`
reads it, at or before the minute: a first run stamps its published calls with its own minute, and backfills a game
tipping in that minute); every pick is the side its
chance favours, its game a regular-season or playoff game of the file's season. A first file is held to the last three
rules alone. In the job a failure puts `data/calls.json` back as committed and turns the run red (README "Runs"). A run
on a branch writes and checks the ledger but never commits it: the commit step puts `data/calls.json` and
`data/suggest_ledger.json` back as committed (removed where new) on any ref but `main`, so only the job on main writes
them, and no call counts as published before the site showed it (`tools/test_calls.js` runs the step on a branch and on
main). On `main` too the step puts `data/suggest_ledger.json` back as committed whenever the suggestions record's step
did not succeed (failed, stopped at its 12-minute limit, or skipped), since a step stopped by its time limit never reaches
its own put-back (the review of 8 November 2026; the Tests step has a limit of its own, 20 minutes); the test runs it on
main with that step failed, cancelled and skipped.

### The record (`tools/publish.js`, `pickem.json`, `app/parts/pickem.html`)

`publish.js` writes `pickem.json`: every regular-season and playoff game of the season in play from its first to today
(Eastern), with the moneylines and spread as the games table froze them at tip, the score once final, each model's call
(`c`, with `backtest` naming the models whose call on that game is a backtest, kept as data: the page draws every call
alike, as the NFL owner asked) and the weeks: Monday to Sunday, Eastern, week 1 holding the season's first
regular-season game, the playoffs in their own weeks, P1 on (the play-in is typed regular season, as in the history,
so it stays in the regular weeks). A model whose file says it could not run
is named with why (`status`). Two things more, read by the matchup bubble alone (README "The matchup bubble"): `next`,
the Alpha Model's, the Joker's and the ELO Model's calls on the games after today out to the slate's ten days, and `off`
on a final a club's standings record leaves out (`cup`, the NBA Cup final; `playin`, a play-in game), which the Pick'em
Record still grades like any other. It is committed with `state.json`, and put back with it when publishing or the
tests fail.

The tab (`#pickem`, its own part) reads `pickem.json` no-store when it is first opened, never on load or a timer, and
grades the finals itself. **Vegas** is the moneyline favourite with the margin out; where the two prices are level, or
there is no moneyline, the spread's favourite; with neither, no side (that game is in no model's net). Top to bottom:
Vegas's tiles (straight up; its confidence bands, `band`'s 75/60/55, counting only a side read from a moneyline, since the
hub reads no chance from a spread; the spread's average miss), the chart **Wins against Vegas** (each model's wins minus
Vegas's on the same games, added up week by week, Vegas the zero line; a model is counted only on the games it called,
and Vegas on the same ones), the **week by week** grid (each model's record a week and the season, shaded red under .500
and green above), and **Show every pick**, a pick grid one Eastern day at a time. Model colours: Alpha green, the Joker
red, the ELO Model orange, the Player Model violet, Team Elo ice blue.

### The checks

`node tools/test_calls.js` holds the ledger and its check on made-up games and model files (backtest and published
calls, a quiet run, a moved chance restamped, a frozen call kept whatever the model says, a model that cannot run, a new
model backfilling only the games before its first call, every refusal of the check, a new season, a first run in a
game's own tip-off minute backfilling it and passing its check, and a call restamped the minute before its tip reading as
moved on a clock a minute later) and the job's calls step itself, its run block taken from `update.yml` and run under
`bash -e` with stand-ins, both scripts handed one clock to the minute. `node tools/smoke.js`
section 12 holds the tab on a made-up season worked out by hand (the tiles, the legend, the chart's lines and weeks, the
tooltip, the grid, the pick grid, a model that could not run, level moneylines falling to the spread, the bands counting
only moneyline sides) and on the real `pickem.json`.

## Player props

DraftKings' NBA player props, read from ESPN's free feed, with the hub's own projection beside each line. The owner's
go-ahead, 15 October 2026. **The model is on trial**: it has not been shown to beat DraftKings, so it is shown beside
DraftKings' line and fair chance, and nothing in the Player props view says "model says" or "edge" on a prop until the
shadow ledger (below) has passed its bar. Until 25 October 2026 it suggested nothing; since then (the owner's call) the
Parlay Builder's Top 50 lines and Suggested Parlays' sets take a player's line where its chance clears their bar, Value
picks among them, each marked **on trial** beside its chance there, in the builder and on a level's card, whose chance
reads "model (on trial)" (README "Parlay Builder", "Suggested Parlays"); a failed bar takes every prop off them. A DraftKings price in the view is also the control that puts that leg in the visitor's own
parlay in the Parlay Builder, at DraftKings' price (the owner's go-ahead, 15 October 2026, README "Same-game parlays").
**On 5 November 2026 the owner stopped the trial early as a FAIL** ("The early stop", under the shadow ledger below): at
12,298 graded lines the model was behind DraftKings on both scores with its intervals wholly above zero and its flat bets
down 223 units. The job's first run with the stop in its code, at or after 18:00 UTC that day, writes the FAIL into the
ledger; from then its chances are out of the Parlay Builder's Top 50 lines and Suggested Parlays, its calls stop, and its
projections stay in the Player props view for reference.

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
- **Before 30,000**: running numbers and how many are in, never a verdict or a word of passing, but for the one early
  stop below.

**The early stop** (`EARLY_STOP` in `props_ledger.js`, the owner's call of 5 November 2026). At 12,298 graded lines
(121 games, the last 4 November) the model was behind DraftKings' fair chance on both scores with its 90% intervals
wholly above zero, log loss +0.0184 [+0.0136, +0.0233] (0.7044 against 0.6860) and Brier +0.0083 [+0.0060, +0.0105]
(0.2547 against 0.2465), and its flat bets at the 3-point edge were down 222.81 units on 6,027 (Overs -226.54 on 2,796,
Unders +3.73 on 3,231). To finish 30,000 lines merely level on log loss the other 17,702 would have had to beat
DraftKings by 0.0128 a line, where it had been 0.0184 a line behind. The owner asked to stop then rather than wait
("if its going to fail anyway shouldnt we pivot"), so the stop is registered in the code beside the bar:
`{ at: '2026-11-05T18:00:00Z', by: 'the owner', why: 'behind DraftKings on both scores with 90% intervals wholly above
zero, and the flat bets down, on the lines graded by then; stopped early as a FAIL rather than wait for 30,000',
bar_registered: '2026-10-15T11:35Z' }`. The figures above are those at the owner's call; the decision is on every line
graded by the job's first run with the stop in its code, which is 12,298 unless a run grades another game first, so the
`why` it carries names no count and the decision's own `lines`, `scores` and `flat` are its numbers (the page reads
those). The rule:

- It is a futility stop and can only fail. The first run at or after `at` with no decision writes `verdict: 'FAIL'`,
  `decided_at` the run's time, `lines` every line graded and compared by then (in grading order, that run's own grades
  among them), `games`, `last_game`, and `scores` and `flat` worked by the bar's own functions on exactly those lines, as
  `decide` works them on the first 30,000 (`stopEarly`), and `early: { at, by, why }` copied from `EARLY_STOP`. It never
  writes a PASS, even on lines the model wins, and never on no graded line.
- It ends this trial alone: the ledger whose bar was registered at `bar_registered`, 2026-10-15T11:35Z, the one the job
  has kept since (`stopsLedger`). A ledger registered since, a new props model's with a bar of its own, calls, grades
  and is judged on its own bar through and after the stop's time, and an early decision on it is refused.
- The bar in the ledger is not changed, and nothing in the record is edited by hand: the decision is the job's, written
  by its run.
- From then on it is the bar's own FAIL path: no new call, every call not yet frozen dropped, frozen calls still graded
  when their games are final, the summary counting on (its standing "decided at <lines> lines on <time>: FAIL, stopped
  early by the owner before the 30000 the bar is judged at"), and the decision never revisited.
- Had the bar's 30,000 been in first, the bar's own decision would stand and the early stop would do nothing; once any
  decision is written it does nothing either.

What follows on the page: the Parlay Builder's Top 50 lines and their Value picks take no player line at the model's
chance (`pbPropsOn`, which reads any FAIL), and no list or set takes the model's chance on one; Suggested Parlays' night
sets, from the night after 7 November 2026, take DraftKings' main lines on players at DraftKings' own fair chance, with no
model claim (the owner's call of that day: README "Suggested Parlays", "Player legs, at DraftKings' odds"), and so, from
10 November 2026, does the Top 50 in a part of its own (README "Parlay Builder", "Player lines in the Top 50"); the
Player props view
says so from the decision's own numbers: "Stopped early on 5 November 2026, the owner's call, at 12,298 graded lines: behind DraftKings on both scores and its
flat bets down 223 units. FAIL: its chances are no longer used in the Parlay Builder's Top 50 lines or Suggested
Parlays, and its calls have stopped; the projections stay for reference." The Top 50's note and a set's empty level say
why in the same terms (`pbPropsOffWhy`): "no player lines: the props model's trial was stopped early as a FAIL on 5
November 2026, so the sets take none." (the bar's own FAIL, never reached now, would read "failed its shadow ledger's
bar"), and those words are what the suggestions record keeps for a level it locks empty (the Top 50's note no longer
says it since 10 November 2026, when the list took DraftKings' player lines). The Parlay Builder's lead no
longer calls the model on trial, and a player's leg a visitor adds by hand from the Player props view is drawn in the
builder as its row in the view is, at DraftKings' fair chance, marked "failed trial", the model's chance small and muted
for reference only, which no list or set takes (README "Parlay Builder", "After the FAIL", 6 November 2026). The Player
props view says it too: on a FAIL its header's tag reads "Props model: failed trial" and its folded note's summary "The
props model failed its trial against DraftKings: the chances here are DraftKings' own, its projections for reference",
every player line drawn at DraftKings' fair chance (README "Player props", "What a FAIL changes"). Run end to end on a scratch copy of 5 November's data at 18:05 UTC
(`NBA_DATA_DIR`, `NBA_PROPS_LEDGER`, `NBA_PROPS_LINES`, `NBA_PROPS_OUT` and `NBA_NOW`, the real files untouched), the run
wrote that decision on 12,298 lines and 121 games, dropped the 33 open calls, and the check passed; a run at 17:59 UTC
on another copy changed nothing. On the built page the Top 50 went from 50 lines, 49 of them a player's, to 6 game lines
and none, and that evening's set from 8 player legs to none: with only one side bet and one total a game, it kept its
Safe pair and left Medium and Aggressive empty, saying why. Run again at 18:55 UTC, the run and
its check on one clock, the decision was the same (12,298 lines, 121 games, the last MIA at LAC on 4 November; log loss
0.70439 against 0.685951, Brier 0.254732 against 0.246454; 6,027 flat bets down 222.81 units) and the check passed,
where the same ledger checked on a clock of 02:00:05 the next morning was refused, Orlando at Phoenix's call (tip-off
02:00) taken as tipped and gone: why the job hands the two one clock. The suggestions record then rewrote that evening's
Heat at Warriors set to a Safe pair of its spread and total, Medium and Aggressive empty with "Only 2 legs in this game,
and no player lines: the props model's trial was stopped early as a FAIL on 5 November 2026, so the sets take none."
A new props model would be a change of its own, with a bar
of its own written down before its first call.

The check runs right after `props.js` in the job's props step, the two handed one clock (`NBA_NOW`, the run's time to
the second, as the calls and suggestions steps hand theirs), so a tip-off that turns in the moment between the run and
its check (the early stop's run dropping a call that tips in the next minute, say) is judged as the run judged it. It
fails the step (putting every props data file back as the last commit had it, and turning the run red) when the
ledger was written after the check's clock, its run time went back from the last commit's, or a ledger this run changed
carries another time than the check's clock; a time it stamps (a call made, frozen or graded, a fit registered, a
verdict) is after the run that wrote it, or one new since the last commit is not that run's own; the bar is not the registered one or the last commit's (but for a re-registration
as above), or was registered after a call; a call was made at or after its tip-off; a call the last commit had frozen, or whose tip-off has passed, is
gone, open again or changed in any field (the one change allowed: this run's rewrite, before tip-off, of a call not yet
frozen); a fit, a freeze time or a grade once written changed; the last commit's graded lines are not, byte for byte,
the start of the file; a graded line is not what the frozen call, the fit, the closing line and the box score give; a
game's lines are not exactly its closing lines on players with a call who played; a game graded is not final, frozen and
read, or one that can be graded is left ungraded; a verdict is early, missing, not the first 30,000's, or changed; a
FAIL leaves a call open; the summary does not follow; or the record lost or changed a game it had read. The one verdict
it accepts before 30,000 is the early stop's: a decision of fewer than `bar.lines` lines passes only on the ledger the
stop ends (`stopsLedger`), with its `early` exactly `EARLY_STOP`, FAIL, decided at or after `EARLY_STOP.at` and not
after the run that wrote the ledger (at that run's time, where the last commit had no verdict), on exactly the lines
graded and compared by then and at least one (no more and no fewer: the run grades first and stamps its grades with its
own time, which is the check's clock, so it can neither leave a grade of its own out nor date itself back past what it
graded), its scores, flat bets, games and last game what `stopEarly` gives on them, re-worked; and a ledger the stop
ends, written at or after `EARLY_STOP.at` with a line graded and no verdict, fails. That last is read off the ledger's
own `run_at`, which the check holds to its clock wherever this run changed the ledger: so a run at or after the stop
cannot date itself back before it to keep calling, and with no earlier ledger to hold it to (`--no-prev`), where the
run's time is not known, a run just before the stop checked just after it passes. A check by hand after a run by hand
needs the run's clock too (below). A decision of 30,000 lines is checked as before.

### What `state.json` carries for the page (`props`, from `props.json` and the ledger)

```
props: {
  onTrial: true,                                  // until a change of its own; a PASS never flips it
  build, asOf, fitSeasons: "2023-2026", horizonGameDays: 5, minShown: 8,
  stats: [pts, reb, ast, tpm, stl, blk, pra, pr, pa, ar, sb], combos: { pra: [pts, reb, ast], pr: [...], pa, ar, sb },
  layout: [name, team, pos, min, pts, reb, ast, tpm, stl, blk, dd, td],
  oppCols: [ratio, mult, rank, z],                // each club's defence in a game's opp: z where props.json carries oppLeague; [ratio, mult, rank] on one written before it (README "The game's three windows")
  dist: { kind: "negative binomial", var: { pts: [A, B], ... every stat and combo }, rule },
  fair: { main, mainWhy, rung: { form, a: { pts: 0.061, ... }, measured }, yes: { form, a: { dd: 0.068, td: 0.068 }, measured, playoffs }, estimated },
  games: { <game_id>: { tip, away, home, players: { <ESPN athlete id>: [ ...layout ] },       // the slate's games not yet started
    opp: { <club>: { pts: [ratio, mult, rank, z], reb, ast, tpm, stl, blk } } } },       // each club's defence, the Mismatches'
  ledger: { registered, bar: { lines, passIf, otherwise, before },
    decision: { verdict, decidedAt, lines, games, scores, flat, early: { at, by, why } } | null,   // early only on the early stop's FAIL
    summary: { standing, gradedGames, lines, voids, scores, flat, toCome } },
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

Every game still to come has a **Player props** button on its card on Tonight (44px, beside Lineups). It opens the
game's own page, laid out as the NFL hub's game page (its Props tab, a game opened; `renderGame` in its
`props/build/part3.js`) since the owner's call of 5 November 2026 ("when I click the player props in the nba, i want the
layout to look as much like the nfl huub one"): the same window (1,100px at most, the whole screen on a phone), the same
pieces in the same order, on this hub's numbers and colours (the NFL's gold stripe this hub's orange; the bars lime, gold
and grey for High, Med and Low). Escape, ✕ Close (44px) or a tap outside closes it (a press that begins on the sheet and
is let go outside, a selection dragged past its edge, is no tap outside), Tab stays inside, and the focus goes
back to the button that opened it; a redraw (a press landing, a switch, a box ticked) keeps the focus on its control, or,
where that control is gone (a milestone taken out with Milestones off, a box whose line a press moved), on the next box
of the same stat block, the player's row or the nearest control still drawn, brought into view, never on the page or on a
✕ Close scrolled away. On a phone the sheet is the whole screen, so its bar stays at the top as it scrolls; a focused
control is kept clear of that bar and of the parlay bar at the foot. Its native controls are drawn dark, as the NFL's.
Top to bottom:

- **The bar**: ✕ Close at the left; at the right the NFL's quiet switches, **Include backups** (the rest of each club's
  expected rotation, the board model's lineup, and its rated players: each in his place with nothing to bet, not a
  button, saying why he has no projection) and **Milestones** (each player's k+ rungs under his stats, the NFL's
  Threshold ladders; off to start, as there). No Book's cut: every price here is DraftKings' own.
- **Find a player** (16px, so a phone does not zoom in on it), which keeps the rows whose name holds what is typed, a
  club's heading only while it has one; a search no player matches says so ("No player in this game matches "zzzz"."),
  in a status line of its own where the rows would be.
- **Refresh odds**, the board's press (plain, as the NFL's), with its status line beside it, short as the NFL's, saying
  what the view stands on: "DraftKings as published, Thu 11:22 AM ET · 89 main lines" (the job's lines.json) or
  "DraftKings via ESPN, Thu 4:32 PM ET · 89 main lines · this visit only" after a press; every kind's count (main lines,
  milestone prices, double- and triple-double prices) is in its title. None posted yet, a read that failed (the lines
  before it stand), lines.json still loading or not loaded are said there too. The search, the button and its status are
  drawn once and changed in place (the status is a live region that stays, so each change is heard).
- **The head card**: Tip-off (the day, the date, the tip in ET; the NFL's Kickoff), Matchup, Biggest projections (the
  props model's top projected player in the game for points, rebounds and assists, with the Model on trial tag, or once
  the trial has failed "Props model: failed trial"), Expected score (the board model's total split by its spread,
  "114 – 117"), Total pt (the board model's, "points" under it, the NFL's word) and Vegas pick (the
  favourite on DraftKings' spread as Game bets has it, "GSW by 7.5"; where DraftKings' prices are not read yet, the
  board's line, marked "the board's line", so it never reads as the line Game bets lacks).
- **Matchup, Mismatches and Team Stats**, the NFL game page's three quiet buttons under the head card (a row of three,
  44px), each opening one small window over the view (README "The game's three windows"). Then the model's on-trial note
  (the FAIL's, once it has failed: below), folded.
- **Game bets**, the NFL's card: each team (its pill, nickname, "our margin", the board model's, and "book line") with
  **To win** and **To cover**, then the **Game total** ("model's points", "book line") over and under, on DraftKings' game
  lines as the Parlay Builder has them (`pbGl`). Each row: the box, the bet, the chance as a bar, its percentage and
  band (the NFL's: High from 70%, Med from 45%, else Low, worked on the whole percent the row prints: below), "book 51%" (DraftKings' fair chance, `legFair`) and
  DraftKings' price. The chances are the Parlay Builder's own for the same legs (`legModel`: the player model's win
  chance, its margin against the line at the measured sigma, the total the market's own). With no line, "No DraftKings
  line yet."; where the board has a line and DraftKings' prices are not read yet, "No DraftKings prices yet: the
  board's line is CLE -1.5."; while lines.json is still being read, "Loading DraftKings' lines…" (here and in every
  stat block).
- **Each team**, away then home, under the NFL's team header ("MIA Heat playing GSW"), who the report rules out said under
  it ("Not projected, on the injury report: …"), then a row a player by projected minutes: every player the props model
  projects and every one DraftKings lines (a player DraftKings lines whom the hub places on neither club comes last, under
  Other DraftKings lines). A row is the NFL's: his tier shield and rank exactly as the Players tab draws them (its #
  column, none for a player the ladder does not rank), his name, his position line in the NFL's depth label's place
  ("G · 31 min": his projected minutes, which the sheet has always shown; "G · backup" for one Include backups adds, as
  the NFL marks a backup, on a game the props model projects), his injury chip, **Show stats** where the page has his
  recent games (the published box scores, the last week's: a line a game, each opponent the hub's team pill, and the
  average under the NFL's uppercase headers; no fetch; named "Show stats: … games this past week", its words its state),
  the NFL's **MISMATCH** tag beside his name where he is one of the game's top five in the Mismatches window (titled with
  his row there, "mismatch #2 in this game" in the row's name; a tap on it opens the row as the row would), and at the
  right his projected points, rebounds and assists; on a phone the name line, the projection under it, the
  chevron at the right, the position line moving down whole where the name line runs out (the NFL's), never split "G ·"
  over "31 min" beside a MISMATCH tag. The whole row is the button that opens him (`aria-expanded`, named in full for a screen reader:
  name, position, rank, projected minutes, points, rebounds and assists), one player open at a time, as the NFL's.
- **A player opened**: a stat block a stat he is projected on (points, rebounds, assists, threes, the four combos,
  steals, blocks, steals + blocks), headed "Points  projected 14.3 … DraftKings line 12.5" as the NFL's (its words for
  DraftKings' line read from ESPN; "book line" until 5 November 2026; no mark on a heading), his body opening on one quiet on-trial line ("on trial", titled as the Parlay Builder's) that covers every
  chance in it, his lines' and his double- and triple-double's, line or none; its Over and Under as the NFL's rows (the box, the bet, the props model's chance as bar, percentage
  and band, "book 48%", DraftKings' price), and with Milestones on its rungs ("25+ points", "book 15% est.").
  His double- and triple-double are the NFL's touchdown block ("Double-double  projected 23%", a row "Gets one" with its
  price and "book 19% est."). A stat with no line says "No DraftKings line yet." A player DraftKings lines with no
  projection shows his lines with DraftKings' chance alone and says why (out on the injury report, projected under 8
  minutes or no game on record).
- **Your parlay**, the sheet's foot, as before.

**Its lines are the Parlay Builder's.** The player props and game lines are `pbPr` and `pbGl`: the job's published read
(lines.json, read once a load, no-store, when the view first opens or the Parlay Builder or Suggested Parlays does) or
a press's, whichever is newer, so the view shows DraftKings' lines before any press; a press's newer read takes the
published one's place. Each box puts that leg in the visitor's own parlay exactly as the price buttons did (`slipToggle`:
the same leg, the same refusals, said on the foot), dated by the read it came from. Nothing in the view is saved: the
switches hold for the visit, the search, the open player and the stats shown are the game's. A game that has tipped off
says so and offers nothing.

**The press.** Refresh odds reads DraftKings' player props with the lines, never on load or on a timer: once the
scoreboard has answered, one request for each game still to come (a second only if an answer runs past a page), six at
a time, each dropped after 15 seconds, past any cache and with no headers of its own. The ESPN event id is the press's
own scoreboard row's, or the slate's published one (`espn`, which `publish.js` now writes) where that day did not
answer. A game that has started (by its published tip, ESPN's status or ESPN's own tip, as the lines are judged) is not
asked for, and one that tips while its read is out is not taken. A 404 is "none posted yet"; a read that fails or answers
junk keeps an earlier press's props for that game, with their read time. What is read lives in memory only (`PP_LIVE`):
nothing is stored, and a reload is the published page again. A second status line under the button says what was read
("DraftKings' player props, read 5:36 AM: 3 games, 167 main lines, under Player props on each game. 54 have none posted
yet."), and each card's button counts the main lines its view shows (`pbPr`: the published read or a newer press; put
right in place when lines.json answers).

**What each number is.** A player is matched by ESPN athlete id (his name from the projections, the game's lineups and
absentees or the rated players). A main line's chance is the props model's of the Over (`pOver` on the published mean and
the fitted spread; a combo's mean the sum of its parts', to two decimals, the ledger's call to the digit), the Under its
complement; DraftKings' fair chance of the Over is its two prices with the whole margin on the Over. A milestone's chance
is the model's of reaching it, its fair chance an estimate (est.); a double- or triple-double's the model's, its fair
chance est. by the rungs' margin, its title saying that margin was never measured on these markets and the figure may
run high.

**On trial, everywhere it shows.** The head card says Model on trial, each stat block that draws a chance wears the
on-trial mark (the Parlay Builder's, titled with the ledger's count), and the note after the head card (and the game's
three buttons) says the model has not been shown to beat DraftKings and its chances are marked on trial wherever they
show (the Parlay Builder's Top 50 lines take its lines since 25 October 2026), with the walk-forward and the market test in brief and the shadow ledger's running
numbers: how many of the 30,000 graded lines are in, and the model against DraftKings on log loss and Brier, never a
verdict or a word of one before the bar is decided (a PASS, when it comes, is said to move nothing by itself). Once
the early stop's FAIL is written it says that instead, from the decision (`ppEarly`: the day, whose call, the lines, which
scores were behind DraftKings and the flat bets' units, rounded), then the running numbers as before. The
Record tab drew the same until 31 October 2026, when it took the NHL hub's layout. Nothing in the view says "model says", "edge" or "value". From the view a prop goes only into the
visitor's own parlay, by their tick of its box (README "Same-game parlays"); the Parlay Builder's Top 50 lines
reach the same lines on their own rules, marked on trial (README "Parlay Builder"), until the trial failed.

**What a FAIL changes** (since 5 November 2026, when the trial was stopped early as a FAIL, the owner's call). Once the
ledger's decision is a FAIL (`pbPropsOn()` false: the early stop's, or the bar's own at 30,000 lines), the view no longer
presents the props model's chance as a number to bet on. The same code draws both views, chosen by `pbPropsOn()`
(`ppFail`); before a FAIL (no decision, the trial running, or a PASS, which moves nothing by itself) the view is the
trial's, as above. On a FAIL:

- **Every player line is drawn at DraftKings' fair chance**, the NFL hub's row since its app v138: the bar, the
  percentage and the band (High, Med, Low) are `legFair`'s, the very function the Parlay Builder gives the leg (a main
  line's two prices with the whole margin on the Over; a milestone's or a double- or triple-double's one price with the
  measured margin out, its "est." under the percentage), named "DraftKings' fair chance" in its title and for a screen
  reader; a line with no fair chance (a milestone on a stat the published rules hold no margin for: none today, since
  every milestone market the feed reads has one) shows a dash and "no DraftKings chance". No "book N%" cell: the chance
  is DraftKings' already.
- **The props model's chance is small and muted beside it**, where "book" stood: "props model 61%", in the quiet ink,
  titled with why it is not used (`pbTrialTitle`, the Parlay Builder's: the trial stopped early as a FAIL, not shown to
  beat DraftKings' closing lines, for reference only, no list or set takes it); on a phone "props model" over "61%". Its
  projections stay as information: each stat's heading keeps "projected 14.3", each row's summary his points, rebounds
  and assists. A double- or triple-double's projection is itself a chance, so on a FAIL its heading carries it only
  where DraftKings has no price, small and muted the same way ("props model 19%", over "No DraftKings line yet."); with a
  price it is the row's.
- **The tags and the note say it failed.** The head card's tag and the mark that opens each projected player's body read
  "Props model: failed trial", titled with why; the body's line says "His chances here are DraftKings' fair chances; the
  props model's own, small beside them, are for reference." The folded note is the FAIL's: its summary "The props model
  failed its trial against DraftKings: the chances here are DraftKings' own, its projections for reference", then the
  decision's own sentence and the running numbers (`ppLedger`: the early stop's from its numbers, `ppEarly`, "Stopped
  early on 5 November 2026, the owner's call, at 12,298 graded lines: behind DraftKings on both scores and its flat bets
  down 223 units. FAIL: its chances are no longer used in the Parlay Builder's Top 50 lines or Suggested Parlays, and its
  calls have stopped; the projections stay for reference."; the bar's own, "Its bar was decided on Nov 25 at 30,000
  lines: FAIL. Its chances are no longer used …", which until this change said it "stays on trial"), then what the view
  shows, the walk-forward and the est. note. No word, title or name in the view says "on trial", nor that a list or set
  takes a player's line.
- **Unchanged**: Game bets (the moneyline's and the spread's chances are the board's player model's, which did not fail;
  the total's DraftKings' own; "book N%" beside them), and each box, which puts in your parlay exactly the leg the trial's
  view did, at DraftKings' price and its read's time. In the Parlay Builder that leg is drawn as its row here was
  (README "Parlay Builder", "After the FAIL").

**The band on the chance as shown** (6 November 2026). The High, Med and Low band (`ppConf`) was worked on the unrounded
chance, so 0.4488 printed "45%" and banded Low: Brandin Podziemski's points 17+ read "45% est. LOW" right under his Over
16.5's "45% MED", the same bet at the same price, and 15 of the 864 rows on 5 November read a band their percentage did
not. It is now worked on the whole percent the row prints (`ppPct`): 70% and up High, 45% to 69% Med, under 45% Low, so
a chance printed 45% is Med and one printed 44% Low, 70% High and 69% Med, wherever the view or the builder's FAIL rows
draw it. The builder's own band for a team leg or a leg on trial (`band`: HIGH from 75%, MED from 60%, LOW from 55%) was
already worked on the percent it prints.

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
and the committed ledger's bar being `BAR`, every call made after its registration. Its section 6 is the early stop, on
made-up games either side of 18:00 UTC on 5 November 2026: no decision a minute before; the first run at it a FAIL on
all 7 lines graded by then (its own game among them), the numbers worked out there on their own and exactly `scores`'s
and `flat`'s on those lines, `early` the code's; the open call dropped, no new one, a call frozen before the stop graded
after it with the decision as it was; never a PASS, even where the model wins; nothing with the bar's 30,000 in or a
decision already made; what `publish.js` carries; the check clean on each honest run and refusing a tampered early
decision (its `why`, `by` or `at`, no `early`, a PASS, its log loss, interval, units, games or last game, decided before
the stop, after the check's clock or before the run that wrote it, a line more than were graded, the first 4 lines alone
with their numbers re-worked,
no decision on a ledger written at the stop, the decision changed after its commit). Twenty planted breaks, each
failing its test: 16 in the ledger, the check and `publish.js` (`test_props.js`), 3 in the page's sentence (section 8),
and the page's reading of a FAIL made to pass over an early one (`pbPropsOn`), which the Parlay Builder's and Suggested
Parlays' sections catch. `node tools/smoke.js` section 8 holds
the page: the props view on a press against a stubbed ESPN (the recorded
opening-night answer with made-up lines added, two pages, a 404, junk, a 503, a game ESPN has under way, one that
tips while its props are read, one ESPN still calls scheduled with its own tip passed and the published one to come
(dated by ESPN's tip, as the page's parse dates a row, so it holds across midnight Eastern), and on a second press a game whose page 2 is a 404, which keeps its earlier read whole); the view laid
out as the NFL hub's game page (since 5 November 2026: its window, ✕ Close at the bar's left and the two switches at its
right, Find a player, Refresh odds with its status line, the head card's every number worked out on its own, Game bets
with no line, the team headers away then home, a row for every projected player by projected minutes, each the NFL's
row and a full-width button with `aria-expanded`, one open at a time, his body's stat blocks in the sheet's order with
their projections, the rank and shield read off the Players tab itself, Show stats only where the box scores have his
games and its table and average, who is out said under each club, Include backups' bench rows, the search, the Tab trap
over the boxes and the search, the phone layout's rules); the published lines.json shown before any press (its status,
each box's leg dated by the job's read, Game bets' six chances the Parlay Builder's own for the same legs, lines.json read
once a load and no-store) and a press's newer read taking its place; every line, rung and Yes price the view shows worked
out on its own from `props_feed.js`, `props.js` and the state's props block (each row's box, bet, chance, bar, band,
fair chance and price), the one on-trial mark a block that draws a chance; the on-trial wording; the props a press reads reaching the
Parlay Builder's Top 50 lines, every player line marked on trial and no team line, never a player the report has out,
none before a press and none once the read is taken away (since 25 October 2026, when props reached the Top 50 lines;
until then the section held that nothing was suggested); nothing read before a
press (on load, opening a sheet, its rows, switches or search, on every timer and event the page sets); nothing stored; a reload
returning to the published page; a sheet left open while its game tips; the ledger's running numbers on made-up
summaries (no verdict before the bar, then a FAIL and a PASS, and the early stop's FAIL word for word, its words
following made-up decisions' numbers: one score behind, the bets up or none; the section's own props block carries the
published ledger with its verdict taken off, so the rest of it holds the model on trial after the early stop as before);
the page's copies held to the tools' text and results;
every game the real state projects opening with a row for each of its projected players and without a NaN; the page's
own means, combos included, the ledger's open calls to the digit; and the view on a FAIL (since 5 November 2026), on the
job's published lines for the section's own game, so at any hour and in the off-season: no decision and a PASS drawing
the trial's view, an early FAIL from made-up numbers (with one stat's milestone margin taken away, so a line with no fair
chance is met), a full-bar FAIL and the real ledger's own decision each drawing the FAIL's, every row's DraftKings fair
chance, est. and band and the props model's muted chance and its title worked out on its own from `props_feed.js` and
`props.js`, the headings, the tags and the note word for word from the decision, no "on trial" and no list taking a
player's line in any word, title or name, Game bets the Parlay Builder's as before, Tatum offered the very lines of the
trial's view and a box putting in the very leg it did, nothing thrown; then the real state with the job's real
lines.json, every game to come on the FAIL's view and each of its player rows worked out the same way. Each check was shown to fail on a planted break, in a scratch copy: the
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

The page's 22, planted on the page as it then stood, before 25 October 2026, when props reached the Top 50 lines (so the
row "a prop put in the suggestions" is now the intended behaviour, which section 8 holds the other way: a press's props
reach the Top 50 lines, each marked on trial):

| Planted break (the page) | What failed |
|---|---|
| the Over read as the second item | 17 checks: the copy's text, the parse on every variant, every line, the card's count, the status line |
| the fair chance split evenly | every line, the copy's text, the fair chances |
| the negative binomial off by one | every line and rung, the copy's text, the distribution |
| props read on load / on a 30-second timer | nothing read before a press, the requests a press makes, the reload |
| props kept in localStorage | nothing stored, by the press and by the sheet |
| ESPN's status and tip not read | the requests a press makes, the status line, the game under way taken |
| a game that tips during its read taken | the status line, nothing taken |
| a prop put in the suggestions (before 25 October 2026) | the Parlay Builder with props against without (a check since replaced) |
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

The view laid out as the NFL hub's game page (5 November 2026) was held the same way: each of its new checks shown to
fail on a break planted in a scratch copy of the built page (`NBA_HTML`), 51 breaks, every one caught by the check
named (§8 or §9 is the smoke's section). The checks of the old sheet's projections table, its team switch and its
phone columns went with them (the rows above that name them were planted on the page as it then stood):

| Planted break (the view, 5 November 2026) | The check that failed |
|---|---|
| the window 900px wide, not the NFL's 1,100 | §8: NFL hub's game window… |
| Close a bare × | §8: focus moves to its 44px ✕ Close… |
| Milestones called Threshold ladders | §8: NFL's quiet switches… |
| the search box's placeholder changed | §8: then a 44px Find a player box… |
| the status line's wording with no lines.json | §8: then Refresh odds with its status line… |
| a head card label changed | §8: head card, the NFL… |
| the smallest projection taken as the biggest | §8: its biggest projections are… |
| the expected score's two sides swapped | §8: expected score is the board model… |
| Vegas's pick the underdog | §8: expected score is the board model… |
| the Model on trial tag gone | §8: and it keeps the Model on trial tag… |
| the on-trial note after Game bets | §8: model is labelled on trial… |
| Game bets with no line worded otherwise | §8: Game bets, with no line read… |
| the home team first | §8: each team in turn, away then home… |
| players projected 10 minutes or less left out | §8: a row for every projected player… |
| rows by minutes, low to high | §8: each team's rows are its players, by projected minutes… |
| the summary's assists its rebounds | §8: each row is the NFL's: his name and position… |
| a row with aria-pressed, not aria-expanded | §8: each row is a full-width button… |
| the phone rule putting the summary beside the name | §8: on a phone (760px and under) a row stacks… |
| the stat blocks in the old order | §8: his body is a stat block a stat… |
| a block's projection off by 0.1 | §8: his body is a stat block a stat… |
| a second player opened beside the first | §8: one player open at a time… |
| every rank one too high | §8: each player's rank and shield are the Players tab… |
| a shield and rank for an unranked player | §8: each player's rank and shield are the Players tab… |
| Show stats on every row | §8: Show stats is offered only where… |
| the stats' average off | §8: a tap shows his games as the box scores have them… |
| who is out worded otherwise | §8: who the injury report has out is said under each club… |
| the home club's bench left out | §8: Include backups adds the rest… |
| Include backups on to start | §8: with Include backups off, no backup is shown… |
| the search case-sensitive | §8: Find a player shows the rows… |
| Tab from the last control not taken back to the first | §8: Tab stays inside… |
| lines.json read again on each open | §8: published lines (lines.json) are asked for once… |
| the press's status line without "this visit only" | §8: the status line beside Refresh odds, short as the NFL's, says the view stands on the press… |
| the model's chance of a main line a point off | §8: each of the … |
| High from 60% | §8: main lines is its stat block… |
| the bar half the chance | §8: main lines is its stat block… |
| the fair chance of the other side | §8: main lines is its stat block… |
| no on-trial mark on a stat block (since: no on-trial line on a projected player's body) | §8: each projected player's body … opens on one quiet "on trial" line… |
| the rungs shown with Milestones off | §8: with Milestones off again… |
| the Yes price's title not saying it may run high | §8: double- and triple-double prices are the NFL… |
| no injury chip | §8: a player DraftKings lines whom the report has out… |
| the unplaced players' heading changed | §8: an athlete no file knows is shown by his ESPN id… |
| the view's Refresh odds never busy | §8: view's own Refresh odds is the same press… |
| a box's leg dated now, not by its read | §8: its lines show with no press, each box… |
| the view on a press's read alone | §8: with no press, the view stands on the job… |
| Game bets on a press's lines alone | §8: Game bets reads the published game lines too… |
| a spread's chance with the line's sign turned | §9: each Game bets row's chance is the Parlay Builder… |
| "our margin" without its + | §9: each Game bets row's chance is the Parlay Builder… |
| a box that is not a checkbox | §9: each is a real checkbox… |
| a box's label 24px | §9: each sits in a 44px label… |
| a refused box left ticked | §9: is refused with a plain reason, its box left unticked… |
| a milestone in the parlay hidden with Milestones off | §9: with Milestones off, the milestone in your parlay… |

The review of the view (5 November 2026) found it short of the NFL's page in places, and short of a dialog's duties in
others; each fix came with a check, shown to fail on a break planted in a scratch copy, 38 breaks, every one caught:

| Planted break (the review's fixes, 5 November 2026) | The check that failed |
|---|---|
| no `color-scheme:dark` on the sheet (white boxes, a blue search ×) | §8: its native controls … are drawn dark |
| Over 23.5 free to wrap at 914 | §8: Over 23.5 and its book chance keep their line… |
| "book 29%" free to wrap on a phone; the heading free to wrap | §8: "book 29%" keeps its line on a phone… (two breaks) |
| the percentage 16px; the cells 14.5px under 900 | §8: the NFL's type in the rows… (two breaks) |
| the chevron's line height 1 (a row 6px short) | §8: the chevron's line box is the NFL's… |
| Show stats' opponent plain text; its headers not uppercase | §8: the table is the NFL's… (two breaks) |
| an icon on Refresh odds | §8: then Refresh odds, plain as the NFL's… |
| the press's status line without "this visit only" | §8: the status line beside Refresh odds, short as the NFL's… |
| a backup Include backups adds not marked | §8: each one Include backups adds is marked so… |
| a starter marked a backup on a game with no projection | §8: a game the props model has not projected… |
| no on-trial line on a projected player's body | §8: his double- and triple-double chances are the props model's… |
| an on-trial mark on a heading | §8: each projected player's body … opens on one quiet "on trial" line… |
| "No DraftKings line yet." while lines.json is read | §8: while lines.json is still being read… |
| the card's button counting a press's lines alone; lines.json's answer not putting it right | §8: and the card's button under it counts… (two breaks) |
| Vegas's pick from the board's line over DraftKings' spread | §8: Vegas's pick is DraftKings' spread as Game bets has it… |
| the board's line not said so | §8: with no DraftKings line read, Vegas's pick is the board's line… |
| Game bets silent on the board's line | §8: Game bets, with no DraftKings line read and the board's line there… |
| the note's summary with no key (the focus lost in a redraw) | §8: a redraw with the note's summary focused… |
| the focus sent to ✕ Close when its box goes | §8: taken out, it leaves the view… |
| no stand-in in the same stat block | §8: a box whose line the press moved… |
| the focus left on a hidden search at the tip | §8: the focus, on the search when it went, moves to ✕ Close… |
| the status line made anew on each draw | §8: a redraw keeps the very same status line… |
| no scroll padding for the foot bar | §8: a control the focus moves to is kept clear… |
| Find a player 15px | §8: Find a player is 16px… |
| Show stats with aria-pressed; named "Show …'s games"; a closed row naming its body | §8: it is named by its own words…; each row is a full-width button… (three breaks) |
| a box named for its player alone | §9: each box's name is its own row's leg in full… |
| the row's button named for the player alone | §8: each row's button is named in full… |
| the note's double- and triple-double sentence gone | §8: and the note says the milestones' fair chances are estimates… |
| no projected minutes on the position line | §8: each row is the NFL's: his name and his position line… |
| the bar not sticky on a phone | §8: on a phone … the bar with ✕ Close stays at the top… |
| a search no player matches saying nothing | §8: a search no player matches says so… |
| the expected score free to wrap | §8: the expected score keeps its line… |

The view after the props model's FAIL (5 November 2026) was held the same way: each of its new checks shown to fail on
a break planted in a scratch copy of the built page (`NBA_HTML`, section 8), 22 breaks, every one caught by the check
named (two of them first ended the section with a throw where the trial's checks met a FAIL row, so those reads were
made to fail rather than throw, and the two caught again):

| Planted break (the FAIL's view, 5 November 2026) | The check that failed |
|---|---|
| a FAIL row's bar and percentage the model's chance | §8: an early FAIL: each of the … player rows is drawn at DraftKings' fair chance… |
| a FAIL row's band the model's | §8: an early FAIL: each of the … player rows… |
| the muted chance without "props model" | §8: an early FAIL: each of the … player rows… |
| the muted chance untitled | §8: an early FAIL: each of the … player rows… |
| a one-sided fair chance not marked est. | §8: an early FAIL: each of the … player rows… |
| no "no DraftKings chance" where there is none | §8: an early FAIL: each of the … player rows… |
| the head card's tag still Model on trial | §8: the head card's tag reads "Props model: failed trial"… |
| the tag's title not saying why | §8: the head card's tag reads… |
| the note's summary changed | §8: the folded note after the head card and the game's three buttons is the FAIL's… |
| the note without the decision's sentence | §8: the folded note after the head card and the game's three buttons is the FAIL's… |
| the bar's own FAIL saying the model stays on trial | §8: a full-bar FAIL: the folded note…; a FAIL is said… |
| the body's mark reading "on trial" | §8: each projected player's body opens on one line that his chances here are DraftKings'… |
| a double-double heading "projected 23%" on a FAIL | §8: an early FAIL: each heading keeps the projection… |
| the heading "book line" | §8: an early FAIL: each heading keeps the projection… |
| "on trial" in the FAIL's note | §8: an early FAIL: no word, title or name in the view says "on trial"… |
| the FAIL's note saying the Top 50 lines take a player's line | §8: an early FAIL: no word, title or name … nor that a list or set takes a player's line |
| Game bets drawn at DraftKings' chance on a FAIL | §8: an early FAIL: Game bets are as before… |
| a FAIL row's box putting in a leg with no read time | §8: ticking a FAIL row's box puts in your parlay exactly the leg… |
| the trial's view drawn as a FAIL | §8: with no decision (the trial running) the view is the trial's… |
| the early stop read as no FAIL | §8: on the real state, whose ledger has the FAIL, every game to come opens on the FAIL's view… |
| the muted chance kept on one line on a phone | §8: on a phone the muted chance wraps under its words… |
| Total pt's label "our model" | §8: the expected score is the board model's… |

```
now=$(date -u +%Y-%m-%dT%H:%M:%SZ)
NBA_NOW=$now node tools/props.js        # the job's step: closing lines, projections, ledger; writes props.json
NBA_NOW=$now node tools/props_check.js  # the ledger against the last commit's, on the run's clock; ends "props check: 0 failures"
node tools/props.js research      # the walk-forward and market tests (about seven minutes)
node tools/props.js fit           # refit the constants on the finished seasons (between seasons only)
node tools/props_ledger.js init   # once: the ledger with its bar and no call
node tools/test_props.js          # the parse, the record, the model, the ledger and the bar; ends "all good"
node tools/smoke.js               # the page; section 8 is the props view, section 9 your parlay; ends "all good"
```

## The game's three windows

The owner's ask of 5 November 2026, after the Player props view took the NFL hub's game-page layout: "after dont forget to
add the mismatches and team stats". On the NFL hub's game page three quiet buttons sit under the game's head card,
**Matchup**, **Mismatches** and **Team Stats** (its `props/build/part3.js` `gameWinBtns`), each opening one card of its Game
snapshot in a small window (its `nflbets/build/snapshot.html` `gameWindow`). The NBA's view has the same three, in the same
place (`ppWinBtns` in `app/nba_hub.html`: `div.gwin[role=group][aria-label="More on this game"]`, each
`button.btn.quiet.gwin-btn[data-gp-pop=units|mism|stats][aria-haspopup=dialog]`, 44px), drawn only where the windows are on
the page (`window.gameWindow`, `app/parts/gamewin.html`, set in by `build.js`, which stops if the part fetches or stores
anything). Each is a dialog over the view, the NFL's: 720px at most, the matchup's two pills and "Team Stats · Thu, Nov 5"
over one card (labelled by both), Close (44px); Escape, Close or a click outside closes it back to the view (Escape never
closes the view too) with the focus on the button that opened it (a press that begins in the window and is let go
outside, a selection dragged past its edge, is no click outside), Tab stays inside, and a window taller than the screen
scrolls inside. Its look is the NFL's window rule by rule: the panel panel-2 to panel under a darker bg-2 bar, 39px from
the card's foot to the panel's, its quiet text (the matchup line, the "vs" between the boxes, the foot, a mismatch's
position and its "vs") the NFL's muted #B3B9CB (`--pb-q`), and at 760px and under the NFL's phone window: 10px of the
page around it, a 58px bar 12px in, the body 12px in and the card 14px in. A redraw of the view under an open window (a read answering, a box ticked) binds it to its button as drawn
now; a game that tips off under it closes it, the focus on the view's Close. Nothing in them is computed beyond what is
said below: every number is read from `state.json` as the page has it.

**Team Stats**: the two clubs' season so far side by side, the NFL's rows: each club's number at its side with its league
rank under it ("#4"), a bar between them split in the two clubs' colours (the NFL's split: where fewer is better each side
by the inverse of its number, else both shifted up by the lower of the two and 0, so a negative still splits), the better
side's number marked (lime on a lime tint; a screen reader hears each value with its club, its rank in words and the
better side: "MIA: −4.9, 21st in the league", "GSW: +2.9, 12th in the league, the better"), "MIA better on 5, GSW on 8" at the top, and under them "2026-27 season through
Nov 4: MIA 8 games, GSW 8 games." Fourteen rows: point differential, points, points allowed (each a game), offensive rating
(points per 100 possessions), defensive rating (allowed per 100), pace (possessions per 48 minutes), field goal %,
three-point %, threes made, rebounds, assists, turnovers (fewer is better) and steals and blocks (each a game). Fewer is
better on points allowed, the defensive rating and turnovers; pace is neither, so it marks neither side and counts toward
neither club, nor does a row whose two published numbers are level. Pace's row is labelled on the window "possessions per
48 this season, est. from the box scores", since Matchup gives each club's other pace, the Teams tab's (below), and until
6 November 2026 each was said only in a tooltip, so MIA's 105.3 (#2) here and 104.1 (4th fastest) there read side by side
as a contradiction. The page only reads them: `publish.js` writes
`teamStats` (THE TEAM STATS there) from `data/teambox_<season>.jsonl` (both sides of every game ESPN's team box gives),
the scores in `data/games.csv` and the players' minutes in `data/box_<season>.csv`, nothing downloaded:

```
teamStats: { v: 1, season: 2027, through: "2026-11-04", games: 121,
  clubs: { MIA: { g: 8, last: "2026-11-04", pd: [-4.9, 21], ppg: [118, 7], pa: [122.9, 27], ortg: [110.7, 14], drtg: [115.2, 26],
    pace: [105.3, 2], fg: [47.2, 9], tp: [33.5, 20], tpm: [13, 17], reb: [43.3, 19], ast: [29.5, 2], tov: [15.1, 11], stl: [8.4, 17], blk: [5, 15] }, ... } }
```

The games: the season's finals typed regular season as the standings count them, the NBA Cup's group and knockout games
among them; never the NBA Cup final or a play-in game (`offFinals`: the standings, the NBA's season statistics and the
club's record in the matchup bubble leave both out, so a finalist's game count is its record's), a preseason game or a
playoff game (until the review of 5 November 2026 the Cup final was counted, a game more than the finalists' records). A final counts once both its clubs' team boxes
are read and carry every figure used. A game's possessions are the usual estimate, field-goal attempts less offensive
rebounds plus turnovers plus 0.44 of free-throw attempts, each side's averaged with its opponent's, so both clubs of a game
are given the same number (the window says so in the foot's and the ratings' titles); its minutes are 48 plus 5 an overtime,
the overtimes read from the players' minutes in the box (240 a side in regulation, 25 more an overtime; 48 where the box has
none). Turnovers are the team box's total, team turnovers in. Each value is published to one decimal with its rank among the
clubs with a game counted, 1 the best (the most, or the fewest where fewer is better; on pace the fastest), on the value
to four decimals, ties by club code. A club with no game counted is not listed: the window shows its side as a dash and
says "No game counted yet this season: GSW.", or "Neither club has a game counted yet this season."; another season's
stats are never shown as this game's. On 5 November 2026 the file is 7.7 KB for the 30 clubs and 121 finals.

**Matchup**: the NFL's Offense vs defense card, each side with the ball ("Heat Possession", the NFL's "Seahawks
Possession"): the offence's rating against the other club's defence, two boxes either side of "vs", the higher of the two
tinted (and said "(the higher)" to a screen reader). The ratings are the board model's
for the lineups it expects in this game (the slate's `model.away`/`model.home` `offence` and `defence`): each player's
offence and defence in rating points, for a player on the floor all game, weighted by his share of the minutes, as the
Players and Teams tabs give them, drawn rounded as the Teams tab rounds them (−45.5 is −46). Under each, its rank in the
Teams tab's Offence or Defence column, ranked as that table sorts (high to low, the file's order on a tie): "Teams tab 9th
of 30", and, where the tab's own figure (today's lineup) rounds to another number than this game's, that figure too
("Teams tab +31, 9th of 30"). Then pace: each club's on the Teams tab (its running possessions per 48, "4th fastest of
30") either side of the game's expected (the board model's), under the heading's label "The Teams tab's pace, the board
model's: possessions per 48", so it is never read as Team Stats' box-score pace. Nothing new is worked out: no model, no
headline number.

**Mismatches**: from the props model's opponent term (README "Player props", "The model"). A player's projected stat is
multiplied by his opponent's defence on it, `oppF[k]^opp[k]`: `oppF[k]` what the club's opponents made of the stat per
minute over the league's, half-life 20 games and shrunk toward average by 2,400 minutes (`oppFactor`), `opp[k]` the
exponent the fit chose (`props.json`'s `params.opp`: 1 on points, assists, steals and blocks, 0.75 on rebounds and threes).
So his projection with the matchup is his published mean, and without it the mean over that multiplier; the matchup's lift
is the difference. `props.js` publishes, for each game it projects, each club's defence on each base stat (`oppTable`,
on what the club allowed read for the game's season as the projections read it, a new season's at half): the ratio, the
multiplier and the club's rank in the league on that stat, 1 the club that allows the least, on the ratio to four
decimals, ties by club code; `publish.js` carries it compactly into the game's props block (`opp`, by the club defending,
`[ratio, mult, rank]` as `oppCols` names them). Nothing projected moved: on today's data `props.json` was the same to the
byte but for `opp`. The window ranks the game's players shown at 20 minutes or more, both sides, none on the game's out
lists (the minutes as his row in the view prints them, whole: 19.8 is "20 min" and counts, 19.4 is "19 min" and does not;
until the review of 5 November 2026 the bar read the published 19.8 as under 20 while his row said 20), each at his stat among points, rebounds, assists and threes with the largest lift in standard deviations of the stat
at his mean (the props model's own spread, the square root of `nbVar(mean, var[k])`), positive lifts only.

**Graded on the NFL's old steps** (6 November 2026). The NFL hub's Mismatches graded each mismatch on four steps, in
standard deviations, the figure rounded to a tenth (its `tab_elo.html` and `snapshot.html` `mmGrade`): Slight under 1,
Solid from 1, Big from 2, Huge from 3, its game page tagging Solid and up. Its live Mismatches no longer do: since 4
November 2026 they draw the size in points ("+7 pts") and one Mismatch tag at its matchups file's measured tag, with no
grade words, and `mmGrade` and the Solid-and-up tag run only between its OLD-MISMATCHES marks, for a matchups file from
before that score. The grades here follow those old steps on this hub's numbers (the review of 6 November 2026 found the
NFL's live page had dropped them two days before this change; whether this hub keeps the four words or moves to the
NFL's one tag is the owner's call). Here the grade is how far the defence a player faces is from the 30 clubs' mean on
his stat: z = (the club's published opponent ratio on that stat, the "allows 12% more" figure, - the mean of all 30
clubs' ratios on it) / their standard deviation, population, over the 30. The job works it (`publish.js` THE MISMATCH
GRADES, `oppLeagueZ`) from every club's ratio, never the two in a game alone: `props.js` writes the league's table into
`props.json` (`oppLeague`: for each season of the games to come, every club's ratio on each base stat, `oppTable`'s own
figures, so each game's two clubs carry exactly the league's number; 2.6 KB), and `publish.js` puts each club's z beside
its ratio, multiplier and rank, rounded to two places, `oppCols` naming it (`[ratio, mult, rank, z]`); none for a club, or
on a stat, where the season's table lacks a club of the 30 or the 30 are level. The window grades each player at his best
stat by the lift in SD as before, on the z of the defence on that stat, with the NFL's old rounding and steps, lists them
by the grade first (Huge, Big, Solid, Slight), then the lift in SD, then the lift and the player's id, the top five; so a
game's Solid-or-better mismatches are always among its five. Each row draws its grade as the NFL's old row did, the
four-step meter lit to its step and the word, both in the grade's colour (the NFL's dark theme's: Huge the hub's lime, Big
#7BD88F, Solid #F2B84B, Slight the quiet ink), after the lift on the right, "+0.16 SD lift" (a screen reader hears "SD
lift" too), and the MISMATCH chip under them only on Solid and up. The figure the grade is worked on is on the row
itself, beside the defence it is of, rounded to a tenth as the grade rounds it (0.95 is "1.0" and Solid): "vs MIA
three-point defence #30, 2.2 SD weaker than the 30 clubs' mean (allows 12% more threes a minute than the league's rate)",
"at the 30 clubs' mean" where it rounds to 0. Until the review of 6 November 2026 it was in the title alone, which a phone
never shows, and the one SD figure a phone showed was the lift, "+0.16 SD" under Big, which those steps call Slight
(MIA at SAC drew "+0.07 SD Big" over "+0.16 SD Solid"). The two figures on the row are measured from two places, each
named: the "allows" ratio from the league's rate (a ratio of 1, where the lift is 0), z from the mean of the 30 clubs'
ratios, which sits a little above 1 (points 1.0062, rebounds 1.0050, assists 1.0102, threes 1.0070 on 6 November). Until
that review both said "average", and a club between the two read as a contradiction: SAS's rebounding defence (ratio
1.0047) "allows 0.5% more rebounds a minute than average" on its row and "0.01 standard deviations stronger than the
league's average" in its title, 7 of that day's 165 rows. Its title says what each is: "Big mismatch: #1 in this game. …
Big: MIA's three-point defence is 2.2 standard deviations weaker than the 30 clubs' mean on threes, across its 30 clubs;
the grade is on that figure (Slight under 1, Solid from 1, Big from 2, Huge from 3). +0.16 SD lift: what the matchup adds
to his projection, over the spread of his threes at his projection (2.4 on 6 November). Listed by the grade, then that lift." Under the
window's note, where no row is Solid or more: "No player in this game faces a defence a standard deviation or more weaker
than the 30 clubs' mean on his stat." On a state published
before the grades (`oppCols` without z, or a club with none): the five by the lift as before, no grade, no tag, and "The
mismatch grades are not published yet: the job adds them on its next run." Until this change any positive lift was listed
and tagged: ORL at PHX listed five Magic players at +0.03 to +0.05 SD against a scoring defence ranked 20th ("allows 2%
more points"), every one MISMATCH, and 52 of the 165 rows across the 33 games were under 0.05 SD. On 6 November's data, the
job's own run: MIA's three-point defence is z 2.19, so MIA at GSW lists five Warriors at their threes, Stephen Curry
(+0.16 SD), Yaxel Lendeborg (+0.12), Georges Niang (+0.10), De'Anthony Melton (+0.10) and Al Horford (+0.09), all Big
(Draymond Green's and Brandin Podziemski's assists, +0.14 and +0.12 SD against a defence graded lower, left the five);
ORL at PHX's five are Slight against PHX's scoring defence at z 0.38, untagged, under the no-mismatch line; of the 165 rows
87 are tagged (18 Big, 69 Solid) and 78 are Slight, none Huge, and 44 are under 0.05 SD.

Each row the NFL's: his season shield where the Players tab ranks him (none
where it does not), "#1 Stephen Curry G GSW vs MIA · vs MIA three-point defence #30, 2.2 SD weaker than the 30 clubs'
mean (allows 12% more threes a minute than the league's rate). 4.8 threes projected (+0.4 from the matchup).", at its
right "+0.16 SD lift",
its grade and, Solid and up, the MISMATCH tag, its title the grade, the row's sentence, what each figure is and the note. A lift is printed to one decimal
and the spread to two, more where that would round a figure to nothing: a lift of 0.017 is "+0.02", of 0.003 "+0.003",
under 0.0005 "under 0.001" (SAS at POR on 7 November reads "+0.04" and "+0.02" where it read "+0.0"; on 5 November 21 of
the 165 rows across the 33 projected games read "+0.0"). Any positive lift is listed; only Solid and up is tagged (above).
The note is one line: "From the props
model's opponent adjustment; the model lost to DraftKings in its trial, so read these as context, not picks." (on trial,
before a decision: "the model is on trial against DraftKings"). Nothing in the window, its titles included, says edge,
value or model says. On the player rows of the view, each of the five graded Solid or more wears the NFL's MISMATCH tag
beside his name, the same title ("Big mismatch: …", its grade in `data-pp-mmgrade`), and his row's name says it (", Big
mismatch, #1 in this game"); a row graded Slight wears none. MIA at GSW on 5 November 2026, before the grades, all five
Warriors against the Heat's defence: Stephen Curry threes (MIA 30th, 12% more a minute than the league's rate, 4.8 projected, +0.4,
+0.16 SD), Draymond Green assists (29th, 7% more, 6.2, +0.4, +0.14), Brandin Podziemski assists (4.5, +0.3, +0.12),
Yaxel Lendeborg threes (2.6, +0.2, +0.12) and Georges Niang threes (2.1, +0.2, +0.10).

**Before the job's next run**, and on any state without them, each window says why and nothing throws: "The team stats
are not published yet: the job writes them on its next run."; "The props model's opponent adjustment is not published for
this game yet: the job adds it on its next run." (and no row wears a tag); a game the props model does not project says
why, as the view does ("No projection for this game yet: …"); a game with no board numbers, "The board model has no
ratings for this game's lineups yet."

### The checks

`node tools/test_gamewin.js` (in the job's tests, before the smoke) holds the job's numbers on made-up data, each figure
worked by hand in its comments: the team
stats of a made-up season's team boxes (three finals counted; the NBA Cup final, whose boxes would move every number, a
preseason game, a play-in, a playoff game, a final missing a side's team box or its assists, a game to play and last
season's never; an overtime read from the box and 48 minutes where it has none; two overtimes read as 58; every stat and
rank of three clubs, a tie in point differential and in pace ranked by club code); `oppTable` on made-up allowed figures (the ratio, the multiplier with the
fitted exponents and with none, the rank, ties by code, the league's 30 by default); `liveProjections` on a made-up replay, on
exponents of its own (1 on points, assists, steals and blocks, 0.75 on rebounds and threes), never the published fit's,
which a refit may set to 0 on points and so leave the check below nothing to tell apart
(each game's `opp` is `oppTable`'s for its season, a new season's halved, the club defending under its own code, and each
of its 96 projected stats is the player's mean without the matchup times that multiplier, within rounding, where the wrong
club's misses by 0.77); `propsState` carrying it as `[ratio, mult, rank]`, and nothing on a `props.json` from before;
and the grades: `oppLeague` on the same replay (each season once, all 30 clubs, `oppTable`'s ratios to the digit, a new
season's halved, so each game's two clubs carry the league's own figure), and `oppLeagueZ` and `propsState` on a made-up
league of the 30 worked by hand, its mean and spread too (points 28 clubs at 1, BOS 1.1 and NYK 0.9: the spread 0.025820,
BOS +3.87; rebounds 15 and 15 at 1.02 and 0.98: ±1; assists three tens at 1.06, 1 and 0.94: ±1.22; threes PHX 1.3 and the
rest 1: the mean 1.01, PHX +5.39 and the rest -0.19; steals and blocks level: none), none for a season or a club the table
lacks, and no z, nor `oppCols` naming it, on a `props.json` from before the table.

`SMOKE_ONLY=gw node tools/smoke.js` (`tools/smoke_gamewin.js`), blocking, boots the built page on made-up games tomorrow
(any hour, any day of the season, the off-season): a props block whose opponent table and means are its own (eight
players with a lift, two of them alike to the digit, one at 19.4 minutes ("19 min") and one out each strong enough to be
in the five were he counted, one with no lift; two rated players ranked and one rated but not ranked, for the shields),
a second game for the small figures and the bar (NYK at PHI: a guard at 19.5 minutes, "20 min", counted and one at 19.4
left out whose lift would put him second; lifts of 0.016, 0.003 and 0.0004 and spreads to match, printed "+0.02",
"+0.003" and "under 0.001", "+0.003", "+0.001" and "<0.001"; a defence 0.42% over average, "0.4% more", each figure also
worked by hand in its comments), the job's team stats and the Teams tab made up with level values and a tie the file's
order breaks, a club with no game counted, a game with no projection, one with no opponent table and one with no board
numbers, a failed ledger and one on trial; the grades on every made-up game (BOS at DET's five Solid, NYK at PHI's all
Slight under the no-mismatch line, PHI's rebounding defence at z 0.94 among them), and CHI at TOR for each boundary on the
NFL's rounding and the order: z 2.95 Huge, 1.95 Big, 0.95 Solid and 0.94 Slight on TOR's defence, the largest lift of the
game listed fifth as Slight and untagged, a small lift against CHI's rebounding defence at 1.31 listed fourth and tagged,
a sixth Slight cut (each worked by hand in its comments); a state published before the grades and one with a club's z
missing, each listing the five by the lift with no grade or tag and the line saying the grades come next run; then on the
real state, one of its projected games moved to three hours from
now, its team stats as published (else as `publish.js` writes them from today's files) and its opponent table as
published (else `oppTable` on a replay of today's boxes). Every number a window states is worked out there on its own: the
team stats from `data/teambox_<season>.jsonl`, `data/games.csv` and `data/box_<season>.csv` (equal to the job's to the
digit), the Teams tab's ranks as its table sorts, each mismatch's lift, spread, grade and place from the published
multipliers, z and means, and every published z from the published ratios of all 30 clubs the state's games carry (and
`props.json`'s league table on the same build; on a state from before the grades, the job's `oppLeagueZ` on today's replay
against this file's own z for every club and stat); never by calling the page's functions; each mismatch's shield from the published players (none where they do
not rank him), no figure that rounds to nothing, and what a screen reader hears of each Team Stats value (its club, its
rank in words, the better side), of each Team Stats label (a word apart from its note: "Points allowed per game") and of
the higher Matchup box. Since the review of 6 November 2026 each graded row's z is read off the row itself and held to the
published z rounded to a tenth, the grade drawn the one the steps give that figure; the lift reads "SD lift"; no row or
title says "average"; and on the real state an opponent table published with no grades fails (props.js writing `opp`
without `oppLeague`, which would have every window say the grades are not published yet, on every run), where it had
passed as a state from before the grades: a state with no `opp` at all is the one from before them, and goes to the
replay. The window's look, rule by rule as the page's CSSOM has it
(jsdom lays nothing out), against the NFL's values: its panel and the 39px under the card, its quiet text, a mismatch
row (unfilled, 600, 4px, the shield 16 by 18), the phone window at 760px (no rule of it at another width) and its
geometry, and the view's position line kept whole on a phone. The grade's colours and meter, rule by rule (Huge `var(--lime)`, Big #7BD88F, Solid
#F2B84B, Slight `var(--pb-q)`, the word 13px and 700; 4px bars 2px apart, 5 to 14px, unlit `--line-2`), and the two paces'
labels word for word in their places. And the buttons (under the head card, their roles and names, 44px), the
dialog's name, Escape, Close and a click outside (the focus back on the button, the view still open), a press inside let
go on the backdrop (no click outside: open; section 8 holds the view's own backdrop the same), a click inside, Tab
kept inside, the focus after a redraw, a window over a game that tips off, the tags (exactly the five graded Solid or more, beside the name,
titled with the row and its grade, said in the row's name, a tap opening the row), the words a failed model may not use, every window
before the job's next run, and nothing fetched or stored. Section 8's checks of the folded note now find it after the
three buttons. In Chromium, on the real state with the fields the job will write, at 360, 390, 914 and 1280 with each
window open and the view under them (a tagged player opened): no text under 4.5:1 (the lowest 4.87 in the view, 5.17 in
the windows, once the ranks on the lime tint took the full ink: the quiet ink was 4.43:1 there; 4.87 in the windows too
since their quiet text took the NFL's #B3B9CB), nothing wider than the screen, the window or its cards, and every control
44px. After the review of 5 November 2026, against the live NFL page (JAX at BAL) at 1280 and 390: the panel's gradient,
the bar, the quiet text, the mismatch rows and the phone geometry computed alike; 39px from the card's foot to the panel's
at every width from 320 to 1280; from 320 to 760 the NFL's phone window, each mismatch's clubs on their own line 27px
under his name (from 761 on the line, never touching the position); no player's position line split at 320, 360, 390,
414, 914 or 1280; a selection dragged from a window or the view past its edge leaving it open with the text selected.

Breaks planted one at a time, each failing the check it aims at (the page's in a copy of `index.html` through `NBA_HTML`,
the job's in `tools/publish.js` or `tools/props.js`, put back after):

| Planted | Caught by |
|---|---|
| the buttons after the note, not under the head card; one without `aria-haspopup`; under 44px | the buttons' place and roles; their 44px |
| the window not modal; titled without its date | Team Stats opens a dialog so named |
| fewer-is-better marked the wrong way; a rank one off; the bars split as if more were better; pace counted in the summary; a game too many in the foot | Team Stats' values, ranks, marks, bars, count and foot |
| pace marked | pace marks neither side |
| no word before the team stats are published; a club with no game unsaid; last season's stats shown | each said |
| the tint reversed; the Teams tab ranked low to high; the tab's own figure unsaid where it differs; pace ranked from the slow end | Matchup's boxes and pace |
| a level possession tinted | level ratings tint neither box |
| the lift as mean x mult less mean; 19 minutes for 20; a player out counted; ties against the id; the lift ranked raw, without the spread; the SD to one place; six listed; the trial's note on a FAIL | the Mismatches' five, their order and words |
| the note saying edge | no word of edge, value or model says |
| no word before the opponent table is published; a game with no projection or no board numbers unexplained | each said |
| a tag titled with less than its row; not said in the row's name; after the position, not beside the name | the tags |
| a tap on a tag doing nothing | a tap on a tag opens its row |
| Escape doing nothing; Escape closing the view too; the focus not given back | Escape and the focus back |
| Tab not kept inside; a click outside doing nothing; a click inside closing it | Tab; a click outside and inside |
| the focus lost after a redraw; the window left open over a tipped game | the focus after a redraw; a tipped game |
| the window keeping something in storage | nothing stored and nothing fetched |
| after the review of 5 November 2026: a lift printed to one place ("+0.0"); the spread to two ("+0.00") | NYK at PHI's Mismatches and its tags' titles |
| the 20-minute bar on the minutes as published (19.5, "20 min" on his row, left out); the bar past 20, not at it | NYK at PHI's Mismatches and tags |
| a defence under half a percent over average rounded whole ("0%") | NYK at PHI's Mismatches and tags |
| no shield in Mismatches; a shield on a player the players do not rank; the shield after the name; the shield at the badge's own size | the Mismatches' rows (and on trial); a mismatch row is the NFL's |
| "Heat possession" in lower case | Matchup's boxes (made-up, level and real) |
| the panel flat bg-2; 20px under the card | the window's panel is the NFL's |
| the matchup line or the foot in ink-2; a mismatch row's "vs" at 12px | its quiet text is the NFL's muted |
| a mismatch row filled; its name at 700; its score column 5px apart | a mismatch row is the NFL's |
| the clubs left on the name's line on a phone; the phone window at 620px | at 760px and under, the NFL's phone window (and its geometry) |
| the phone bar 64px and 8px in; the body 10px in; the card 12px in | on a phone the NFL's geometry |
| a Team Stats value not naming its club; the better side unsaid; the rank read as "#21"; the higher Matchup box unsaid | what a screen reader hears, made-up and real |
| the position line free to split on a phone | on a phone a player's position line moves down whole |
| the window, or the view, closed by a selection dragged onto its backdrop; the window never closed by a click with no press | a press inside let go on the backdrop (gw and section 8); a click outside |
| the job counting the NBA Cup final | `test_gamewin.js`: the team stats (three finals; BOS's and NYK's every stat) |
| `props.json`'s points exponent set to 0, as a refit may, or its `opp` taken out | nothing, rightly: `test_gamewin.js`'s part 3 stands on exponents of its own (until the review it failed on both, and the job's tests would have held back every publish) |
| the job's possessions at 0.4 of free throws; its ties ranked against the club code; its overtime minutes ignored | the job's team stats are the smoke's own reading of the files |
| the job counting the play-in or a preseason game; a game missing a side; turnovers without the team's; turnovers ranked the most first | `test_gamewin.js`: the team stats |
| each club's defence ranked the most first; its ties against the code; the multiplier without its exponent | `test_gamewin.js`: `oppTable` |
| each club given the other's defence; a new season's not halved | `test_gamewin.js`: the projections' own multiplier |
| `state.json`'s `opp` in another order | `test_gamewin.js`: what `state.json` carries |
| 6 November 2026, the grades (the page in a copy through `NBA_HTML`): the grade on z unrounded, so 0.95 reads Slight | gw: CHI at TOR's grades on the NFL's steps and rounding, and its tags |
| the list by the lift alone, not the grade first | gw: CHI at TOR's order (and its grades and tags) |
| every graded row tagged, Slight too | gw: NYK at PHI's five untagged, CHI at TOR's chips, the tags |
| Big and up tagged, not Solid | gw: BOS at DET's five, CHI at TOR's chips, the tags |
| no line where none is a mismatch | gw: NYK at PHI's Mismatches |
| a state without z graded as if its z were 0 | gw: a state before the grades and one with a club's z missing |
| Big drawn in Solid's gold | gw: a mismatch's grade is the NFL's (its colours) |
| the view tagging a row graded Slight | gw: NYK at PHI's five wear no tag; the tags |
| a tag titled without its grade | gw: the five's rows and tags (titles, "Big mismatch: …") |
| the job's spread over n - 1, a sample's, not the 30's | `test_gamewin.js`: the league's mean and spread by hand; gw: the job's z is this file's own |
| the job's z rounded to one place | `test_gamewin.js`: each club's z by hand (gw too, where the state carries z) |
| the job's z set against the game's two clubs alone | `test_gamewin.js`: each club's z by hand (gw too, where the state carries z: every published z from the 30 clubs) |
| the league table's new season not halved | `test_gamewin.js`: `oppLeague` each season as `oppTable` gives it |
| Matchup's pace label back to "possessions per 48 minutes" | gw: Matchup states … the pace (made-up, level and real) |
| Team Stats' pace label only in a tooltip ("possessions per 48") | gw: Team Stats states every value … (made-up and real) |
| the review of 6 November 2026 (the page in a copy through `NBA_HTML`): the row's "allows" against "average" | gw: the five's rows (and no "average" on a row or its title), made-up and real |
| the title's z against "the league's average", two places | gw: the five's titles, and no "average" |
| no z on the row | gw: the row shows the z its grade is worked on |
| the lift unlabelled ("+0.16 SD") | gw: the lift reads "SD lift" |
| z shown by `toFixed(1)`, not the grade's rounding (1.95 read "1.9" beside Big) | gw: CHI at TOR's grades: the row's z against its grade, and its tags' titles |
| Team Stats' label and its note with no space between ("Points allowedper game") | gw: Team Stats … every label heard a word apart from its note (made-up and real) |
| `props.js` writing `opp` without `oppLeague` (the job's two steps run locally on a copy) | gw: the published state has the opponent table but no grades (it passed before, as "from before the grades") |
| README's shape of `state.json` without z | `test_gamewin.js` part 5: README's shape names the columns `propsState` writes |
| README's heading and sentence put back to the NFL hub grading now; `gamewin.html`'s comment put back to its old present tense | `test_gamewin.js` part 6: README and the code call the four steps the NFL's old Mismatches' |

In Chromium on 6 November 2026, on a copy of the site whose `state.json` the job's two steps wrote locally (`props.js`
offline and `publish.js`: z for all 30 clubs, 396 figures across the 33 games, none missing), the page's clock held at
00:30 UTC: MIA at GSW's window as above, five Big rows each tagged, and on the view Curry, Lendeborg, Melton, Niang and
Horford tagged with Draymond Green and Brandin Podziemski between them untagged; ORL at PHX's five Slight, untagged, under
the no-mismatch line; Matchup's pace "The Teams tab's pace, the board model's: possessions per 48" over MIA 104.1, 4th
fastest, and Team Stats' "possessions per 48 this season, est. from the box scores" beside MIA's 105.3 (#2), each
wrapping inside its card at 360. At 360, 390, 914 and 1280, on both games with each window open and the view under it: no
text under 4.5:1 (the lowest 4.87, unchanged; the grade words in their colours all above it), nothing wider than the
screen, the window or its cards, and every control 44px.

After the review's fixes of 6 November 2026, on the same local run and clock: MIA at GSW's five read "vs MIA three-point
defence #30, 2.2 SD weaker than the 30 clubs' mean (allows 12% more threes a minute than the league's rate)", "+0.16 SD
lift" and Big at the right; SAS at POR's five (7 November) "vs SAS rebounding defence #16, at the 30 clubs' mean (allows
0.5% more rebounds a minute than the league's rate)", Slight, their titles "at the 30 clubs' mean on rebounds" where they
had said "0.01 standard deviations stronger than the league's average"; Team Stats' labels heard "Points allowed per
game", "Pace possessions per 48 this season, est. from the box scores". At 360, 390, 914 and 1280, MIA at GSW, ORL at PHX
and SAS at POR with Mismatches and Team Stats open: no text under 4.5:1 (the lowest 4.87), nothing wider than the screen,
every control 44px; at 360 the longer row wraps inside its card.

## Same-game parlays

Player legs in the Parlay Builder, the owner's go-ahead of 15 October 2026: a visitor builds a parlay of their own from
DraftKings' player props and game lines, with more than one leg of a game where DraftKings would take them together,
priced as a same-game parlay from a correlation table measured on the hub's own box scores. Since 25 October 2026 the
builder is the NFL hub's Parlay Builder (README "Parlay Builder"), whose Top 50 lines add legs to the same parlay by the
same rules and price it by the same engine; every leg in a visitor's parlay is still the visitor's own Add or tap.

### Your parlay, on the page (`app/nba_hub.html`)

**Adding a leg.** Every DraftKings line in a game's Player props is a box that adds that leg (the NFL hub's game page,
since 5 November 2026; until then a price button, and only after a Refresh odds press): each main line's Over and Under
(points, rebounds, assists, threes, steals, blocks and the five combos), each milestone (k+, with Milestones on), each
double- and triple-double, and Game bets' moneylines, spreads and total, on the lines the Parlay Builder has (the job's
lines.json, or a press's scoreboard answer where newer: `oddsGameLines`, DraftKings' own two prices on each, the spread
and the total only where their number is the one the page shows, and each outcome's betslip id from ESPN's link, kept
only in its side's shape and naming the line's own number, as the NHL hub keeps them). Each is a real checkbox in a
44px label, in the tab order, named for what it adds and ticked while that leg is in. A tick puts the leg in at
DraftKings' price as read, dated by the read; unticking takes it out; a refused leg's box stays unticked; the sheet's foot
says what the tick did and shows the parlay in a line ("Your parlay: 3 legs, +441 est."), with a button to it. With no
line read for a game there is nothing to add.

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
went"). **Finish parlay** shows it as the NFL hub's parlay card (README "The parlay card"): each leg with its price, the
parlay's price (est. where legs share a game), the stake and what it pays, DraftKings' fair chance first and the model's
beside it (on trial with a player leg), Download image, Open in DraftKings (the game lines' betslip ids, each player leg to
add by hand: ESPN's feed carries no id for a player's line) and Share link.

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
and scoreboard answers, and made-up games in their shapes): nothing to add before a press where no lines.json answers; after one, every line a
box (each player's row opened in turn, Milestones on), a checkbox in a 44px label, named, in the tab order, a refused
one left unticked; Game bets' rows, their prices and book lines, and their chances worked out on their own as the
Parlay Builder's (the moneyline the player model's, the spread at the measured sigma, the total the market's own), the
NFL's band, the fair chance, "our margin" and "model's points"; a milestone in the parlay kept in sight with Milestones
off; the recorded game lines and ids read as ESPN has them, another book's odds, a
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
the fair chance, est. (the summary's "model says …%, on trial" beside it, the card's "model (on trial) says …% · the
price says …%" under it; the card's price the builder's same-game price, said to be an estimate, with the why), what the
stake pays to the cent (a stake typed into the builder, $37.50, not the $20 every store there starts on, which the Bet
amount box follows, then the summary, the card and its Share text), the why line, the model's chance labelled on trial
(a second card, on a parlay with a model chance on every leg) or absent with its reason (a card with a player the props
model does not project), and the game's sheet saying neither "edge" nor "model says"; the suggested parlays and the
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
six at a time). Every request is a GET past any cache (`cache: 'no-store'` and a cache-buster), dropped after 15
seconds, made with `tools/lib.js`'s header sets in turn (the named nba-hub User-Agent with Accept: application/json
first, then none, then a browser's), the box-score pull's proven fallback: up to three tries a second apart, the next
set on a timeout, a reset or a 403, 408, 425, 429, 500, 502, 503 or 504; any other refusal is answered at once, so a
404 on the props reads as nothing posted.

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
  was and the run exits 1. When a whole half fails for every game (every scoreboard refused, or every propBets read
  tried), the other half is written, the failed half keeps its last good reads and the run exits 1 too, so the step is
  red and a stale feed is seen. A run with only some reads failed exits 0 and says which in its log line.
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
the reader itself on a stubbed fetch (lib's header sets in turn, the named User-Agent first, a 403 moving to the next,
no-store, the cache-buster, which refusals are tried again); a whole half down (the run partial, exit 1 from the
command line, the last good reads kept) and a junk last entry never carried; the quiet
run (the same answers write nothing, the file's time included; a moved moneyline and moved props rewrite those halves
alone); the committed `lines.json`, where there is one, held to its shape; and the job's lines step itself, its run
block taken from `.github/workflows/update.yml` and run as the job runs it (`bash -e`) in a scratch repository with a
stand-in reader and test: a failed test putting `lines.json` back as committed (removed where it is new), whatever the
read's exit, a partial read's exit 1 kept, a clean one green. `node tools/test_fetch.js` section 5
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
  number, the builder's stake and every level's on Suggested Parlays: the builder's own stake box and
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
every thin-edge line, 50 lines at most in all (`PB_TOP_N`); and since 10 November 2026, once the props model has failed,
a third part after them, **Player lines**, DraftKings' main lines on players at DraftKings' own fair chance, a mix of
stats, the room shared (each part 25 where it has that many: "After the FAIL", "Player lines in the Top 50", below). Each bet is listed once: a milestone k+ lands exactly when the
player's main Over at k - 0.5 does (DraftKings' NBA rungs sit at the main line + 0.5), so where that main Over qualifies
the rung is left out and its slot goes to the next line; a whole-number main line, an Under, a main Over that does not
qualify and the same rung in another game never take a rung's place. Each row gives its rank, the player or team, the bet
and its game, the Value mark, DraftKings' price, the model's chance (marked **on trial** on a player's line), DraftKings'
fair chance (est. where it is), what $1 wins and what $1 is expected to make, and an **Add**. The notes say how many lines
were left out far off the market and for want of a betslip id, and that the totals come last; an empty list says why (no
box or game ticked, no player prices read yet, none the props model prices, or nothing qualifying).

**No DraftKings line yet** (the owner's question of 7 November 2026: "why is there no available parlay legs being
recommended for tomorrows games? i think something must have broke"). Nothing was broken: on the Friday evening DraftKings
had posted game lines on ESPN for none of Saturday's 7 games (DEN at IND's came at about 01:40 UTC), the list takes only
bets with DraftKings' real price, and its empty line said "No line on your picks qualifies yet, and no player lines: …",
as if lines were there and failed. Now, wherever a team bet type is ticked and some ticked games have no DraftKings game
line (`pbHasGl`: no moneyline, spread or total from the job's `lines.json` or a press), the empty line says so first
(`pbTopWhy`, `pbNoGlSay`), in two groups. A game a read covered and found none is "No DraftKings lines yet for your 7
games (as of Fri 6:45 PM)." ("6 of your 7 games" where some have lines), the time `pbGlAsOf`'s: `lines.json`'s own `at`
where the file holds the game with its game lines read (its entry's own `at` set), or a Refresh odds press that read the
game (`ODDS_SEEN`, memory only), the later, and for the group the oldest of the games' own, in the visitor's own time. It
is said "as of", never "last read": the file's `at` is when the run that last changed it read (`tools/lines.js` writes
nothing when a run finds nothing new, and keeps a half's last good read when its read fails), so it dates what the
published file held, not each game's read. A game no read has covered (no entry in `lines.json`, an entry holding its props
alone, or `lines.json` not loading) is never said to have none, since the page cannot know: "DraftKings’ lines for your
7 games have not been read yet.", or "did not load." where `lines.json` did not load (the note over the list says the
same). Then "The job reads them through the day; Refresh odds reads them now." ("Refresh odds reads them now." alone where
`lines.json` did not load), then "No line on the other game qualifies yet." where some have lines (a spread or a total
alone counts). Until the review of 7 November 2026 a game no read covered was counted with those found to have none, so
with `lines.json` not loading the line said "No DraftKings lines yet for your 9 games" under the note saying the lines did
not load, and the time was given as "last read". Where player bet types are
ticked and DraftKings has posted no player main line on the ticked games, the player-lines reason follows as a sentence
of its own ("No DraftKings player lines yet for your 3 games (as of Tue 11:37 AM)."; until 10 November 2026 "No player lines: the props
model’s trial was stopped early as a FAIL on 5 November 2026, so the list takes none.": "Player lines in the Top 50",
under "After the FAIL", below); with player types alone, that reason alone; with lines on every ticked game and nothing
qualifying, "No line on your picks qualifies yet: tick more games or bet types." as before. Where the list is not empty and some ticked games still have no line, the same sentence is a note over it.
`pbWhy`, the all-games levels' empty line, is drawn nowhere and was left as it was (but that on a FAIL, since the review
of 10 November 2026, it says those levels' pool takes no player line, "No player lines: the props model’s trial was stopped
early as a FAIL on 5 November 2026, so these levels take none.", never that DraftKings has posted none); Suggested Parlays already said this
case per game (`spWhy`: "no DraftKings line has been read for it yet"). `tools/smoke_parlay.js` section 9b holds it word for
word on its own reading of the lines (`hasGlOwn`, `asOfOwn`, `noGlOwn`, never the page's), on made-up games at any hour: no
line on any game, lines on some, a spread alone and a total alone (lines, none qualifying), lines on all and none
qualifying, each with player types and alone; no entry, entries holding their props alone, and `lines.json` as junk and
as a 404 (the note and the empty line agreeing); a mix of all three groups, as the empty line and as the note over a list;
and Refresh odds presses that find nothing, one failing a date (the sentence as of the older time) and one after
`lines.json` did not load. Breaks planted in a copy of the built page, each turning it red: every game with no line
counted as read (the review's case, 12 failures), "did not load" said "not read yet" (6), an entry holding its props
alone taken for a read (1), "last read" for "as of" (14), the group dated by its newest read (1) and a game counted as
having lines only with a moneyline (1).

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
where legs share a game; **Finish parlay** (the card, README "The parlay card") and **Clear ALL** (asked first); and the
legs that move together. Both Refresh odds there and in the controls keep the focus on the button pressed.

**The engine** the NFL's levels are built by is carried whole for Suggested Parlays to draw on: `pbLegs`, `pbPool`,
`pbTier` and its searches (a beam over a pairwise copula reading, the finalists worked by the builder's own sums),
`getPbTiers` (Safe the likeliest pair; Medium, Aggressive and Extreme the 3-, 4- and 5-leg parlay with the best expected
return that lands 25%, 12% and 5% by the model, else the likeliest of that size), `pbTierCard` (with `o.quiet`) and a
level's **Add to builder**, and `parlayProb`, `parlayDec`, `parlayFair`, `legFair`, `legFarOff`, `pbOrder`, `pbIsValue`,
`pbValMark`, `toggleLeg` on `window`. Nothing on this tab draws a level; Suggested Parlays draws three of them (Safe, Medium
and Aggressive, not Extreme) one set a featured game until 7 November 2026, and since draws its own night levels on these
legs and sums with its own exact search (README "Suggested Parlays"); the one change it made here a level
card's chance reading "model (on trial) 38%" where a leg is a player's (it read "model says 38%, on trial"), and
lines.json's one read shared with it as one promise. `pbTierCard`'s options for the Elo picks' cards (whose chance it said,
a rule of their own, a leg's chance of their own) went with them on 5 November 2026: every card it draws states the model's.

### After the FAIL

The props model's trial was stopped early as a FAIL on 5 November 2026 (README "Player props"), and the Player props view
draws every player line at DraftKings' fair chance from then on, the props model's own small beside it. Until 6 November
2026 the builder did not follow: a player's leg there still wore "on trial" (`pbTrialMark` printed it whatever the
ledger said, only its title changing) and led with the props model's chance, and the summary said "model says 50.4%, on
trial". Stephen Curry's Threes Over 4.5, ticked in MIA at GSW's view at DraftKings' fair chance (40% Low that evening), sat
in the builder as "50% ON TRIAL" over "fair 40%". On a FAIL (`pbPropsOn` false), with nothing changed before one or on a
PASS:
- **A player's leg** (`pbChanceCell`): its Chance cell is his row in the view's, DraftKings' fair chance first at the
  view's percentage (`ppPct`, so ">99%" and "<1%" at the ends), labelled "fair" as a team row's fair chance is and heard
  as "DraftKings' fair chance" (est. where it is one), and the view's band worked on it (`ppConf`, High, Med or Low); under
  it the props model's chance small and muted, "props model 50%", titled as the view's muted chance (`pbTrialTitle`), with
  **failed trial** beside that figure, titled "The props model's trial was stopped early as a FAIL on 5 November 2026, the
  owner's call: it was not shown to beat DraftKings' closing lines, so this leg's chance is DraftKings' fair chance, and
  the props model's own, beside it, is for reference only" (`pbFailLegTitle`). A screen reader hears "DraftKings' fair
  chance: 40% LOW props model 50% failed trial". Where DraftKings gives no fair chance, "no DraftKings chance" and the
  model's muted with its mark. No "fair N%" line under it: the fair chance is the lead. Until the review of 6 November
  2026 the lead figure had no label but a title (which a phone never shows), and the mark sat right after it, where "on
  trial" had labelled the model's chance, so DraftKings' 40% read as the failed model's.
- **No far-off flag**: a player's leg wears no "far off the market" (`farText`) once the model has failed. Its chance is
  DraftKings' own, which cannot be far off itself, and the rule no longer chooses any list; until that review the gold
  flag led with the failed model's figure ("model 100% · DraftKings 84% est.: far off the market" on Giannis
  Antetokounmpo's 2+ rebounds, rounded where the same row said ">99%"), on 109 of that day's 1,813 player legs. A team leg,
  and every leg on the trial, keep it.
- **The summary**, wherever the parlay holds a player leg: "model says 17.6%, its player leg the props model's, which
  failed its trial" (`pbFailedSay`, "its player legs" for two or more) under the fair chance; with no fair chance, "–" and
  "no DraftKings fair chance: a leg has one price only", the model's line under it, and the note "The fair chance needs
  both of DraftKings' prices on every leg; one leg has one only, so there is none to show. The model's chance under it is
  for reference only." (on the trial and for team legs alone, "... so this is the model's chance alone."); the fair price
  box is DraftKings' fair chance's ("fair price for DraftKings' fair chance"), and the confidence box is drawn on the fair
  chance alone, never on the failed model's, on the view's scale (`ppConf`: HIGH from 70, MED from 45, else LOW), the one
  every player row above it uses, so a one-leg parlay's box and row say one band (a leg at 70% fair read "HIGH" in its row
  and "MED" in the box until that review).
- **The parlay card** says the same ("model says 17.6%, its player leg the props model's, which failed its trial · the
  price says 20.0%"), its window, image and Share text alike; with no fair chance it says why first. The image lays each
  chance line out by measure (README "The parlay card").
- **The matchup bubble** on a player's leg gives Price, Fair, then Model, muted whole ("props model 50% failed trial", its
  figure in the quiet ink too), each figure printed as the view and the builder print it (`ppPct`: ">99%" and "<1%" at
  the ends, never "100%" or "0%"), and marks the projections and the model's chance "failed trial", a word apart from what
  it marks ("Projected failed trial", never "Projectedfailed trial"), each titled that it is for reference only.
- **Unchanged**: a team leg (the board model's chance, its band, "fair N%"), the board model's chance for a parlay of team
  legs alone, every price and payout, the same-game sums and what the builder adds. Suggested Parlays, the Top 50, Tonight,
  the Record and X Parlays show no props model chance on a FAIL (until 10 November 2026 the list took no player line, and
  the sets none until 7 November; since, each takes DraftKings' main lines on players at DraftKings' own fair chance, with
  no model claim: "Player lines in the Top 50", below, and README "Suggested Parlays"), so nothing there moved.

`tools/smoke.js` section 8 holds it: on the trial (no decision) and on three FAILs (the early stop, the bar's own and the
real ledger's) on its own game, a player's main line, his milestone (est.) and the home side to win are ticked by the
view's own boxes and read back in the builder: each player row's fair chance, percentage, est. and band the view's row's
for that leg and its own reading (`tools/props_feed.js`'s fair-chance rules), its "fair" label, what a screen reader hears
of it word for word, the mark on the muted line and its title, the muted model's chance and title (`tools/props.js`'s
distribution); no player row with a far-off flag or a model figure outside the muted line; the team row the trial's to
the character; the summary's fair chance, model chance and payout the trial's, its confidence the view's band on the fair
chance and its words the FAIL's, counted; the card's lines the trial's with the FAIL's words; the bubble's order, marks,
figures and header; and no "on trial" in any text, title or name anywhere on the page. Its own game also carries planted
lines (`EDGE8`) for the edges, held on the bar's FAIL and the real ledger's: Cade Cunningham's 3+ points at -50000 and
Det Center's 15+ assists at +50000, both figures ">99%" and "<1%" in the view, the builder and the bubble; Bos Guard's 1+
rebounds at +100 (the model 95%, DraftKings' fair 43%) with no far-off flag, which the trial's builder still flags; and
Det Wing's points Over 9.5 at -300 / +257 alone, 72% fair, "HIGH" in its row and in its confidence box (the builder's own
scale would say MED), its words "its player leg". On the early stop's FAIL, whose points milestones have no margin, a
parlay of Jayson Tatum's 15+ points and the home side: the cell "no DraftKings chance props model 78% failed trial", the
summary "–" with no fair price and no confidence box, the note that there is none to show, and the card why first. On the
real state and the job's `lines.json`, the first game to come with a player's main line priced both ways and its
moneylines (Georges Niang's points Over 7.5 and GSW to win, on 6 November: the model 64% against DraftKings' 48%, which
wore the gold flag until that review) is held the same way on its real numbers. On the trial the same legs draw exactly
as before, which section 9 also holds on a trial ledger whatever the published one says.

In Chromium on 6 November 2026, on a copy of the site whose `state.json` the local publish wrote (the page's clock held
at 00:30 UTC, before MIA at GSW and ORL at PHX tipped), with Stephen Curry's Threes Over 4.5 (40% Low in the view, at
DraftKings' fair chance) and the Heat to win ticked in the view: the builder drew "40% LOW · FAILED TRIAL · props model
50%" and "14.5% fair chance all 2 land, est., model says 17.6%, its player legs the props model's, which failed its
trial", the fair price +592; at 360, 390, 914 and 1280 no text under 4.5:1 on the tab (the lowest 5.51), nothing wider
than the screen and every control 44px; Curry's bubble at 390 and 1280 the same (the lowest 5.05, the "failed trial" mark).

After the review's fixes of 6 November 2026, in Chromium on a copy whose `state.json` the job's two steps wrote locally
(`props.js` offline and `publish.js`, z for all 30 clubs), the clock at 00:30 UTC, with Georges Niang's points Over 7.5,
Giannis Antetokounmpo's 2+ rebounds, the Heat to win and Stephen Curry's threes Over 4.5 ticked in MIA at GSW's view: the
builder drew "fair 48% MED" over "props model 64% FAILED TRIAL", "fair 84% est. HIGH" over "props model >99% FAILED TRIAL"
and "fair 40% LOW" over "props model 50% FAILED TRIAL", no far-off flag on any (Niang's and Giannis's wore the gold one
before), each cell heard as "DraftKings' fair chance: 48% MED props model 64% failed trial"; the summary "5.2% fair chance
all 4 land, est.", "model says 10.1%, its player legs the props model's, which failed its trial", LOW on the fair chance;
Giannis's bubble "Fair 84% est." and "Model props model >99% failed trial", its header heard "Projected failed trial"; the
card's image 1080 by 1356, its model line on two rows inside the card. At 360, 390, 914 and 1280 no text under 4.5:1 in
the builder (the lowest 5.13), the bubbles (5.05) or the card's window (its price, large, 4.33 as before), nothing wider
than the screen, and every control 44px tall (the Heat's name in its row, an inline name, 30px wide as before).

Breaks planted one at a time in a copy of the built page (`NBA_HTML=<copy> SMOKE_ONLY=8`), each failing the check named:

| Planted | Caught by |
|---|---|
| the FAIL's mark still "on trial" | §8: in the builder a player's leg leads with DraftKings' fair chance…; no "on trial" anywhere on the page (each FAIL, and the real state) |
| the FAIL's cell leading with the model's chance | §8: in the builder a player's leg leads with DraftKings' fair chance… (each FAIL, and the real state) |
| the FAIL's band on the builder's own scale, not the view's | §8: the same |
| the summary still ", on trial" on a FAIL | §8: the summary's … its model line…; no "on trial" anywhere on the page |
| the fair price still the failed model's | §8: the summary's … the fair price DraftKings' fair chance's |
| the card still "(on trial)" on a FAIL | §8: the card's chance lines…; no "on trial" anywhere on the page |
| the bubble leading with the model on a FAIL | §8: the player's matchup bubble leads with DraftKings' fair chance… |
| the bubble's projection marked "on trial" on a FAIL | §8: the player's matchup bubble… its marks "failed trial" |
| the FAIL's rows drawn on the trial too | §8: on trial, the builder draws a player's legs as before… |
| the band on the unrounded chance (0.4488 "45%" Low) | §8: the band is worked on the chance as printed; every row against its band (the view's rows on each FAIL and the real state) |
| the review of 6 November 2026: the far-off flag back on a player's leg after the FAIL | §8: a leg the props model rates 95% against DraftKings' fair 43% wears no "far off the market" flag (the bar's FAIL and the real ledger's) |
| the far-off flag drawn on no leg at all, the trial's too | §8: on the trial a leg the model rates far above DraftKings' fair chance still wears its flag |
| the confidence box on the builder's own scale after the FAIL | §8: the summary's … its confidence the view's band on the fair chance (each FAIL); a parlay of one leg at 72% bands it once |
| the bubble's figures by `toFixed(0)` ("100%", "0%") | §8: the matchup bubble prints them as the view and the builder do |
| the cell's fair chance by `pbPct`; its muted model figure by `pbPct` | §8: at the clamps the builder prints each figure as the view does (each, alone) |
| the cell with no "DraftKings' fair chance" for a screen reader; with no visible "fair" | §8: the lead figure is labelled "fair" and heard as DraftKings' fair chance (each FAIL) |
| "failed trial" back after the band, off the model's line | §8: the same, and the no-fair leg's cell |
| the no-fair note's "so this is the model's chance alone" after the FAIL | §8: its summary leads with no chance … and says there is none to show |
| "its player legs" whatever the count | §8: with one player leg the summary and the card say "its player leg"; the no-fair parlay's; the real state's; and the card's section 10 |
| the card's image drawing each chance line on one row | the card's section 10: the image keeps every chance piece inside the card |
| "Projected" and the model's figure run into "failed trial" in the bubble | §8: the player's matchup bubble … each a word apart from what it marks |
| the no-fair cell leading with the model's chance in full ink; the no-fair summary leading with the model's chance; the no-fair card leading with it, never saying why | §8: a player's leg with no DraftKings fair chance reads …; its summary leads with no chance …; the card says why there is no fair chance first (one each) |
| README's sentence that the view's "Model on trial" tag is unchanged | `test_props.js` part 7: README's shadow ledger says the view's FAIL tag and summary |

**Player lines in the Top 50** (the owner's ask of 10 November 2026, with a screenshot of Suggested Parlays: "why is it
still only showing team legs and not players", then "when i go to the parlay builder I also dont see any player odds and
there is only 13 lines when you can fit several others."). From the FAIL of 5 November the list took no player line
(`pbPriced` prices a player's leg only while `pbPropsOn()`), so on a night of 13 qualifying game bets it was 13 lines.
Suggested Parlays' night pool took players' lines back on 7 November, at DraftKings' odds (README "Suggested Parlays",
"Player legs, at DraftKings' odds"); the Top 50 never did. Now, once the props model has failed (`pbPropsOn()` false; on
the trial the list is as it was, the model's chance on every player leg), the list has a third part after the game bets,
**Player lines**, at DraftKings' own fair chance and with no model claim. `pbPropsOn` stays off, and the failed model's
chance is used for nothing but the muted figure the matchup bubble already draws.

- **Which lines** (`pbPlayerLines`, in `app/parts/parlay.html`, the twin of `spPool`'s player half in
  `app/parts/suggested.html`: the two change together): every player's **main line** DraftKings has posted for the
  ticked games (`lines.json`'s `props.mains`, or a newer Refresh odds read: `pbPr`), on a stat the page offers
  (`PROP_STATS`), with **both prices on file**; on a player the props model places in the game on one of its two clubs
  (`pbWho`) whom neither the game's out lists nor today's report lists (`pbHeldWhy`, Day-To-Day among them, a probable
  player playing; such a line is counted in the note on the report, as a game leg's was); never a line priced with no
  margin (its two implied chances summing under 1; counted, `vig`); each side at DraftKings' fair chance by the page's
  rule (`legFair`: the whole margin on the Over, so an Under's is its own implied chance and an Over's 1 less the
  Under's), never est., from 45% to 97%; no milestone, no Yes market, nothing one-sided; then the reader's boxes
  (`pbAllows`: the games, **Player overs**, **Player unders**).
- **One side a line.** The builder holds one leg a player a stat (`slipWhy`: "One leg per player per stat"; the levels'
  `pbKeyOf` and `pbFits` read a line's two sides as one key), so a line's Over and Under could never both go in, and
  the list shows only the likelier of the sides its boxes leave in (`pbLikely`: DraftKings' fair chance, ties within 1e-9
  to the lower key, which puts an Over before its Under when both are 50%, at a +100 Under). With Player overs unticked
  a line's Under is listed where its Over was; with the whole margin on the Over, the Under is the likelier side unless
  the Over is a clear favourite (tonight 389 of the 460 lines that qualify are Unders).
- **The order** (`pbPlayerMix`): a mix of stats, each stat's likeliest first, the NFL hub's rule of its app v141 (its
  CLAUDE.md, "The Top 50's player lines are a mix of bet types"): round 1 takes each stat's likeliest line, round 2
  each stat's second, a stat run out skipped, each round likeliest first, the part that order cut where the room ends.
- **The room** (`PB_TOP_N` 50, `PB_TOP_MIN` 25): with G game bets qualifying (their two parts and order as before: the
  Value picks, then the other lines, the totals last) and P player lines, the list takes g = min(G, max(25, 50 - P)) game
  bets and then min(P, 50 - g) player lines: each part 25 where it has that many, the one with more filling the rest. The
  game bets come first, the player lines after, the ranks running on.
- **Each row**: its rank, the player (his name the matchup bubble's button, `glanceName`, handed the props model's chance
  as a night set's card hands it, which the bubble draws muted, "failed trial"), the bet and its game, DraftKings' price,
  "fair" (DraftKings' fair chance, titled so, labelled as a game row's and a night card's are), what $1 wins and what $1
  is expected to return at that chance (an Under +$0.00; an Over below it), and the Add. No Value mark, no model column,
  no far-off flag. Its four cells sit on the game rows' five columns with the model's column left empty
  (`.pb-tcs.pl>.pb-tc:nth-child(2)` starts at the third), so price, fair, wins and expected stand under the game rows'
  own at every width (until the review of 10 November 2026 a grid of four put the price under the game rows' model).
- **Add** puts the leg in the builder exactly as a night set's player leg goes in (`slipToggle(pbSlipOf(l))`, the leg a
  game's Player props stores), so the builder draws it as every player leg after the FAIL ("After the FAIL", above:
  DraftKings' fair chance first with its band, the props model's muted beside it, marked failed trial) and prices it by
  the same sums (`parlayProb`, `parlayFair`, `slipDec`).
- **The words**: the part's heading "Player lines" with its count, one line under it, "At DraftKings’ odds: no model
  claim."; the lead adds "then the player lines at DraftKings’ odds, a mix of stats". The foot, on a FAIL (`pbFootFail`;
  on the trial `pbFootTrial`, the foot as it was), says the game bets' rules and the Player lines' apart, shorter than
  before: "Game bets: DraftKings’ price … and a model chance of 45% to 97%, at or above the price’s implied chance …
  Player lines: DraftKings’ main lines priced both ways, at DraftKings’ fair chance (the whole margin on the Over), 45% to
  97%, the likelier side the boxes leave, with no model claim (…)", then the order, the room and expected on $1 (until
  the review of 10 November 2026 it said every line had a model chance at or above its price's implied chance and a
  far-off rule, false of the Player lines). Where DraftKings has posted no player main line on the ticked games, a note
  over the game bets (or the empty line) says so (`pbNoPl`), in the game lines' sentence's shape (`pbNoGlSay`): "No
  DraftKings player lines yet for your 3 games (as of Tue 11:37 AM).", as of the oldest read that found none, "No
  DraftKings player lines yet for 2 of your 3 games (…). DraftKings’ player lines for 1 of your 3 games have not been read
  yet." where some were never read, "… for your game …" with one ticked, and "DraftKings’ player lines for your 3 games
  have not been read yet." ("did not load." where `lines.json` did not load); with both player boxes off nothing is said
  of player lines. Nothing on the tab says the list takes no player line.
- **A Refresh odds press** reads DraftKings' player lines now (`PP_LIVE`); `pbPr` takes it over `lines.json`'s where it
  is newer by its time (a 404, none posted, is a read with no line), and the list's cache key carries it (`pbDataSig`), so
  the Player lines follow a press with no other read beside it.

Tonight, on the published `state.json` and the job's `lines.json` of 15:37 UTC (16 games over two dates, DraftKings'
player lines on tonight's 6): 16 game bets qualify and 460 player lines (30 more held out for the report, none with no
margin), so the list is the 16 game bets (3 Value picks, 13 other lines) and then 34 player lines: Bobby Portis Under 1.5
threes -233 (70% fair), Jalen Green Under 1.5 steals -223 (69%), Neemias Queta Under 1.5 blocks -215 (68%), Dillon
Brooks Under 2.5 assists -194 (66%), Josh Green Under 2.5 rebounds -172 (63%), Jalen Green Under 7.5 assists + rebounds
-150 (60%), Aday Mara Under 8.5 points -135 (57%), Klay Thompson Under 16.5 points + assists -129 (56%), Collin
Gillespie Under 16.5 points + rebounds + assists -128 (56%) and Alex Caruso Under 9.5 points + rebounds -128 (56%) as
round 1, then each stat's second. All 34 listed are Unders, each +$0.00 expected on $1 at DraftKings' fair chance;
the 71 Overs that qualify, none of them listed, run from -$0.09 to -$0.12 (to -$0.13 with Player unders unticked, when
304 Overs qualify). In Chromium at 390, 914 and 1280 wide on that copy, served locally, with a player line and a
game total added by their Adds: no sideways scroll, every one of the tab's 144 controls 44px or taller, no page error, and
each player row's price, fair, wins and expected cells ending where the game rows' own do (measured after the review of
10 November 2026: at 1280 both at 803, 959, 1037 and 1139 px, the game rows' model at 881; at 914 at 153, 309, 387 and
489; at 390 price and fair on the first line and wins and expected on the second, as a game row's).

`tools/smoke_parlay.js` holds it, blocking, on its own reading (`plOwn`, `mixOwn`, `topOwn`, `plRead`, `plWant`, never the
page's functions) and fixtures of its own at any hour: on a made-up early-stop FAIL, the list line for line (5 game bets,
then 7 player lines worked by hand: each line's likelier side, Cy Center's rebounds Over at 54.5% where his Under is
45.5%, two ties to the lower key, Ivy Doubt held for the report and counted in the note, Gus Out and an unplaced player
never a line), each player row's price, fair, wins and expected on $1 (an Under +$0.00, an Over less), no mark or
model figure, its cells on the game rows' five columns with the model's left empty (jsdom's cascade), the heading, its
line, the list's start and name, the lead and the foot word for word (its own copy, `FOOT_OWN`), and nothing saying the
list takes none; the page's own list (`getPbTop`) in the same order; the bubble on a player line (price, fair, the
props model's muted, failed trial); Add (the builder's leg field for field, its row, a second leg of the game priced by
this file's copula of DraftKings' fair chances and of the model's, and its same-game price; a second press taking it
out); the boxes (Player overs off, an Under in an Over's place; Player unders off; a game unticked, its lines gone and the
note counting the ticked games alone; Players only); a line at +105 both ways left out; the rule's other parts on lines of their own (a main on turnovers, a stat the
page offers none for; one on a player the props block places on a third club; one with no Under price), none listed and
each shown to be listed with its own rule off (`plOwn`'s `relax`); a Refresh odds press (ESPN's scoreboard refused, the
props read answering one game with a line moved, one added and one gone, the others 404): the Player lines the press's,
row for row, by this file's own reading of the newer read (`prOwn`, by its time); a read older than `lines.json`'s,
planted, never taken; the same read made newer with no scoreboard read beside it, the list drawn again on it; a press
finding none posted on every game, the game bets alone and the note dated by the press; Players only, the four levels
the tab draws nowhere (`getPbTiers`) saying their pool takes no player line; no player lines (none posted on any game,
two read and one never, all read, read at two times as of the older, none read, Players only, `lines.json` not loading,
one game ticked never read and read with none, both player boxes off with nothing said), the list the game bets alone and
the words word for word; the mix on a made-up game of nine lines on four
stats, worked by hand and shown to differ from the plain order and from rounds left unsorted; the room on sixty made-up
games (60 and 60 qualifying: 25 and 25; 60 and 10: 40 and 10; 10 and 60: 10 and 40; 60 and 0: 50 game bets); no Player
lines part on the trial; and the real state and `lines.json`, line for line. Breaks planted one at a time in a copy of
the built page (`NBA_HTML=<copy> SMOKE_ONLY=pb`), each turning it red (every count as of the review of 10 November 2026,
whose findings added the last fourteen):

| Planted | Checks failed |
|---|---|
| a player line at the props model's chance, not DraftKings' fair chance | 15 |
| both sides of a line listed | 8 |
| the less likely side of a line listed | 8 |
| a player the report lists not held out | 11 |
| a line priced with no margin kept | 1 |
| the 45% to 97% band dropped | 1 |
| Player overs and Player unders ignored | 2 |
| the games' boxes ignored for the player lines (pbPlayerLines on every game) | 1 |
| no mix: the plain order by chance | 6 |
| each round left in the stats' own order | 11 |
| ties to the higher key | 8 |
| no 25 each: the game bets take the room | 2 |
| the player lines before the game bets in the list (getPbTop) | 2 |
| the Player lines part drawn before the game bets | 14 |
| a Player lines part on the trial too | 3 (and the section then stops on a throw) |
| expected on $1 at the props model's chance | 15 |
| a model column in a player row | 17 |
| a Value mark on a player line | 15 |
| the bubble handed DraftKings' chance as the props model's | 1 |
| "fair" labelled "model" | 14 |
| Add putting the leg in with no other price | 3 (and the section then stops on a throw) |
| the heading's count one off | 4 |
| the player lines' ranks starting again at 1 | 13 |
| the line under the heading changed | 1 |
| the lead not naming the player lines | 1 |
| the old "so the list takes none" words back | 10 |
| the no-player-lines note dropped | 8 |
| as of the newest read, not the oldest | 1 |
| the report's note not counting player lines | 1 |
| a read with no main line counted as posted | 7 |
| review R1, F1: a press never read, the Player lines from `lines.json` alone | 3 |
| review F1: a press read taken however old | 1 |
| review R1: the press read dropped from the list's cache key (`pbDataSig`) | 3 |
| review F2: a stat the page offers no line for kept | 1 |
| review F2: a player of a third club kept (`pbWho` without its club test) | 1 |
| review F2: a one-sided line taken at its one price (the both-price, est. and margin tests, each of which holds it out, relaxed for it) | 1 |
| review R2: the four levels' reason back on what DraftKings posted, on a FAIL | 1 |
| review R3, F3: the old foot back on a FAIL | 2 |
| review F3: "the likelier side", not "the likelier side the boxes leave" | 1 |
| review F4: the player rows labelled "DK fair" | 14 |
| review F5: the player cells on a grid of four again | 1 |
| review F6: one game said "your 1 games" | 2 |
| review F6: the no-player-lines note with both player boxes off | 1 |
| review F6: the old no-player-lines words ("of these 3 games …; the other game’s have not been read yet") | 9 |

### Where the NBA differs, and why

| The NFL hub | Here | Why |
|---|---|---|
| A week's games | Every game still to tip on the lines feed's two Eastern dates, under their day; never preseason | The NBA has no weeks; the dates are the ones the job reads DraftKings' lines for |
| The payload's prices, a Refresh odds press over them | `lines.json`, read once a page load, no-store, the first time the tab opens (never on load or a timer), and a press's read, the newer of the two for each game's lines and its props; every price DraftKings' real one, nothing estimated | The NBA's prices come from the lines feed, which carries both prices on every line |
| A moneyline's or a cover's chance from the NFL's game model | A moneyline's the player model's win chance (the number Tonight shows); a spread's Phi((m + h) / sigma), m the side's expected margin (minus the model's spread for the home side) and h its line, sigma 14.5 points | The NBA's game model gives a margin; sigma is measured, below. Until this change the page put no chance on a spread |
| A total at the market's own chance | The same: its two prices with the margin out in proportion (50% where one is missing), never a Value pick, last | The NBA's total has never been tested against the market |
| A player's chance from the props model, on a book price | The props model's (README "Player props"), which is **on trial**: marked so beside its chance on every Top 50 row, builder row and level card, the mark titled with the shadow ledger's count, and said once in the lead; never a player it does not project or today's report lists, Probable aside (the next row); none at all once its ledger fails its bar, or the trial is stopped early as a FAIL (5 November 2026, README "Player props"), which `tools/smoke.js`'s Parlay Builder and Suggested Parlays sections hold on a made-up early decision; and from then a leg added by hand drawn in the builder at DraftKings' fair chance, marked "failed trial", the model's muted ("After the FAIL", above), and from 10 November 2026 DraftKings' main lines on players listed again in a part of their own, Player lines, at DraftKings' fair chance with no model claim ("Player lines in the Top 50", above) | The owner's call of 25 October 2026: props in the Top 50, Value picks allowed, every one marked |
| A questionable, doubtful or out player never listed (`pricedLegs` skips `!suggestable`), a Q on a leg on him added by hand | The game's out lists and every other listing on today's report, Day-To-Day included, a probable player playing (`pbHeldWhy`, read by `pbWho`: the one rule the Top 50 lines, the all-games levels and Suggested Parlays' sets keep, as the NFL's `pricedLegs` is theirs), the lines left out counted in a note; a leg on him added by hand wears his status (DAY-TO-DAY) in the builder and in his bubble, titled with why | ESPN's NBA feed has no Questionable or Doubtful: every status between playing and out is Day-To-Day |
| Value: the 3-point edge with market + form agreeing on a player's line | The 3-point edge alone, which the panel says | The NBA has no market + form (no player Elo is fitted to the props) |
| DraftKings' fair chance by `legFair` | The NBA's `legFair`: a main line's whole margin on the Over (measured on DraftKings' archived lines), a milestone's and a Yes price's by the rung rule, est., a team line's two prices in proportion | The NBA's measured rule |
| Every suggested leg needs DraftKings' betslip id | Game legs only, where the game's lines carry ids; a player's leg carries none on ESPN's feed and goes on the slip by hand, which its builder row says ("Not on DraftKings' slip yet: no betslip id in ESPN's feed") | ESPN's feed has no outcome id for a player's line |
| `parlayProb` and `parlayDec` by the NFL's copula draws and its hold | The NBA's same-game engine behind the NFL's names: legs of different games multiplied, one game's joined by the gaussian copula at `data/corr.json`'s rho (two legs exactly, more by the GHK sum), worked in one order a game (`sgOrder`), so the same legs price the same in the list, the builder, a card and the sheet; the price min(the prices multiplied, 0.896 / J) | The NBA's table and engine (README "Same-game parlays"), with the NFL's hold, untested here |
| A second leg on one bet's key replaces the first | Refused, the reason said at its row and in the builder's status line, by the NBA's same-game rules (`slipWhy`: one side bet a game, one total, one leg a player a stat, no stat beside a sum holding it, no double- beside a triple-double) | The NBA's rules, as the sheet applies them |
| The builder's confidence band | The NBA's band (HIGH from 75%, MED 60%, LOW 55%), under 55% "UNDER 55%" | The page's own band |
| Market + form and the Elo matchup on each builder row | Neither | Neither exists for NBA props yet |
| The matchup bubble on each name, with a player's season Elo, the ELO Ratings tab's units and the Mismatches | The bubble on each name, with the ladder's rating and rank, the Teams tab's columns and the props model's projection (README "The matchup bubble") | The NBA's own numbers |
| DraftKings' ids for every leg the paid pull priced | The game lines' ids only, each player leg to add by hand (README "The parlay card") | ESPN's feed carries no id for a player's line |

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
grades by), and nothing writes its grades back. `tools/backtest.js` keeps those rules as a frozen copy (it no longer reads
the page), giving the same numbers, in `research/backtest.json`; the Record tab drew its table of them, labelled as the
earlier rules' backtest, until 31 October 2026.

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
their notes; a player today's report lists Day-To-Day with a line that would be a Value pick held out of the list and
counted in its note, a probable one listed, and his leg added by hand wearing DAY-TO-DAY in the builder; the four levels
by the builder's own sums, their cards' marks and `o.quiet`, and a level's Add to builder;
every control 44px; the mix, the boxes and the games, saved; Add, Added and a second press, the refusals with their
reasons (a combo holding a stat, the moneyline beside the spread); the builder's numbers against `data/corr.json` and
`tools/corr.js` (two legs of one game exactly) and the page's `parlayProb`, `parlayDec` and `parlayFair`, its rows, its
fair chance first, the model's on trial, the payout, the band, the slip lines and the same-game note; `stakeRead` on 24
cases, the Bet amount typed, left empty, set by a chip and by the builder's box, and read from saved junk, from 250,000
and from the old stake; Finish parlay on the builder's legs, order and price; a game tipping while the page is open; Clear
ALL; a press taking DraftKings' newer price and storing nothing, and a reload; the cut on sixty made-up games (forty Value
picks, twenty thin, the first 50 of their order under "Top 50 lines", the other lines ranked from 41); a `lines.json` that
does not load; a slate with no game to build from; an empty list's words, each worked out on this file's own reading of
the lines (`noGlOwn`), word for word: no DraftKings line on any of three ticked games (with when `lines.json` read them;
none at all where the file holds none of them), with player bet types ticked and alone, lines on one and on two of the
three with none qualifying, a qualifying one listed with the sentence as a note, lines on all three with none qualifying,
and a press that finds no line dating the sentence by the press; and the real `state.json` and `lines.json`, the list
this file's own line for line wherever no game tips within two minutes. Sections 7, 8 and 9 follow the tab: a press's prices in the Top
50 and the builder's leg repriced, the props a press reads reaching the list marked on trial, the builder held to section
9's own same-game sums. Eight breaks planted in a copy of the built page (`NBA_HTML=<copy> SMOKE_ONLY=pb`) each turn it
red: the list cut at 40, the each-bet-once rule dropped, a 2-point Value edge, the on-trial mark on team legs, the far-off
guard dropped, the old sigma of 12.5, a $0 Bet amount taken, and the totals ranked with the thin-edge lines (which passed
until the one-sided total went in). For the empty list (7 November 2026), five more: the old wording put back (10
failures), "of your N games" counting one game too many (4), every ticked game counted as having no line (6), the note
over a list that is not empty dropped (1), and a press not dating what it read (1). Since 10 November 2026 it holds the
Top 50's Player lines after the FAIL too, with breaks of their own ("After the FAIL", "Player lines in the Top 50").

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

## The parlay card

The NFL hub's parlay card (its `nflbets/build/card.html` at app v114, and its `smoke_live.js` section J), carried to the
NBA on 25 October 2026: `app/parts/card.html`, set in at its `<!--part:card-->` marker, its styles, its window and its
script in a closure of its own, `window.PARLAY_CARD`. It replaced the page's own Finish card (a sheet with the legs, the
fair chance, Open in DraftKings and Share link, no image, no Start over).

**The window.** Finish parlay in the builder opens it over the page (a modal dialog, "Your parlay card", the focus on
Download image, or on the share sheet's button where a phone can share a file). The card: the site's mark ("NBA Hub", the
page's orange accent where the NFL hub has gold, its lighter steps #FF8C4A and #FFB27A for text, so the price and the
kicker hold their contrast) and the kicker ("Your parlay"); "4-leg parlay" and its price; the legs' days ("Mon Oct 26",
or "Mon Oct 26 – Tue Oct 27"; the NBA has no weeks), the decimal price, its implied chance and what the price is (book
price, estimated same-game price, or your book's price where one is typed in the builder); each leg with who and what
(as the builder words them), its position, clubs and tip-off in Eastern time, and DraftKings' price, tagged book; the
stake (the one Bet amount), what it pays and the profit, every figure whole with its thousands marked, the tiles sharing
the row and wrapping rather than cutting a figure; then the chances in two lines, DraftKings' fair chance first ("Fair
chance all 4 land 4.7% (est.)") and the model's beside the price's ("model (on trial) says 6.4% · the price says 5.7%",
on trial wherever a player's leg is in it), or with no fair chance the model's and why; under them, in the window only,
why an estimate is one (a one-sided leg's margin, legs of one game joined by the copula, DraftKings' own same-game
pricing) and a parlay with no model chance; the site's address, `demon-x13.github.io/nba-hub`, and the day it was made.
Its price is the builder's own: the builder's sums are `pbQuote` (app/parts/parlay.html), which the builder draws and the
card reads, so the two cannot drift. Finishing saves nothing anywhere.

**Download image** draws the same card on a canvas at twice its size, in the card's own colours written out (so the image
never depends on the page), and saves it as `parlay-2026-10-26-4legs.png` (the first leg's day; `1leg` for one). The
money tiles step their type down from 19px to 14px to stay three across, then take a second row, then one a row; a dollar
figure is never cut. The chance lines are laid out by measure at the card's 13px: each line's words fill a row to the
text's right edge (498 on the 540 canvas), the next word starting a row 18px down, and the card grows 18px for each row
past two, so no line runs past the card. After the props model's FAIL the model's line is long ("model says 17.6%, its
player leg the props model's, which failed its trial · the price says 20.0%", 566px at 13px Manrope against 456px of
room), and until the review of 6 November 2026 it was drawn on one row past the card's edge, the price's chance cut off
at the canvas's; the window always wrapped it. Where the browser can share a file (a phone), **Share or save to Photos**
shows and leads: the share sheet with the image, which is how it reaches Photos.

**Open in DraftKings** is a link to DraftKings' betslip, `https://sportsbook.draftkings.com/?outcomes=<id>+<id>`, each id
encoded (a `#` written `%23`), in a new tab, the legs in the card's order. Only game lines carry an id on ESPN's feed:
each game leg keeps the one it was added with, dated by its read, and the game's current lines carry theirs (lines.json's,
or a Refresh odds press's, the newer of the two, as the Parlay Builder prices from). The newer of the leg's own id and the
game's is taken: at the leg's own number it is the same bet; at another number DraftKings has moved the line since, and the
leg goes on at DraftKings' number for the same team (a spread) or the same side (a total), which the note and Share link
name ("goes on as Warriors -4.5", "Over 221.5 points") with that DraftKings prices it at its own line, so the slip's payout
can differ. A moneyline has no number: the newer id for that team, or nothing. A player's leg has no id ("DraftKings'
player lines carry no betslip id in ESPN's feed") and is one to add by hand, as is a game leg whose game has tipped off,
whose lines have not been read, whose lines carry no ids, or whose market carried none, each with why. The button reads
**Open in DraftKings** where every leg goes on, **Open 2 of 3 legs in DraftKings** where some cannot, and with none on the
slip **Open game in DraftKings** (the game's page, where every leg is in one game with its event id) or **Open DraftKings**
(`https://sportsbook.draftkings.com/leagues/basketball/nba`). The note under the buttons is dated by the oldest read of the
legs it opens and never promises that every leg lands ("opens 2 of the 3 legs as DraftKings had them then; a leg whose
line DraftKings has moved or pulled since will not be on the slip, so check it before you bet"), with each leg's own link
(a 44px button a leg) and the legs to add by hand. The builder says it first: under each of its legs that will not go on
as built, a quiet line read from the card's own plan (`dkSlipRows`, `dkSlipLine`): "On DraftKings as Warriors -4.5", or
"Not on DraftKings' slip yet: no betslip id in ESPN's feed".

**Share link** sends one plain text, a title ("4-leg parlay +1646 (estimated same-game price)") and the text, never a
`url` field (on an iPhone the share sheet hands a text and a url as two items, Messages shows the url as a card with only
the domain and the sheet's Copy drops it, WebKit bug 203221): a line a leg, the stake and what it pays, the chances, what
the link opens ("DraftKings betslip (opens 2 of the 3 legs as DraftKings had them; add leg 2 by hand):"), the link alone on
its line, the read and its caution, the legs going on at DraftKings' number, the legs to add by hand with why in a few
words, and the site's address last; with no leg on the slip, the game's page or DraftKings' NBA page instead. By the
share sheet where the browser has one and can share it; a cancel does nothing; otherwise, or where it fails, the same text
is copied (the clipboard, else a hidden read-only box), "Link copied", or "The link could not be copied." Neither button
draws or downloads the image.

**Keys.** Escape closes it (ahead of anything under it), as do Close and a click on the backdrop, the focus back on the
button that opened it (Finish parlay where a redraw replaced it); Tab stays inside, in the order Close, Open in DraftKings,
Share link, Download, Start over, each leg's link. **Start over** (a card from the builder only) empties the builder in
this browser, as Clear ALL does, and puts the focus on the tab's first control.

**A suggested level's Finish.** A tab that draws a level's card with `pbTierCard` draws its Finish as
`data-pc-finish="<prefix>|<id>"`, and one listener in the card opens it; the tab registers what its levels are with
`PARLAY_CARD.from(prefix, id => ({ legs, kicker, chance }))` (Suggested Parlays' `sp|<night id>:<level>`; the Parlay
Builder's own all-games levels are `pb|<level>`). Until the tab registers its own, the card reads Suggested Parlays' levels
by the NFL hub's name, `window.spTier(id)`, the level as the tab shows it, live or locked. The NFL hub's other, the Elo
picks' `elo|<level>` through `window.eloPicks()`, is not here: the NBA hub took its Elo picks off on 5 November 2026
(README "Suggested Parlays", "What went"), and with them the card's Elo chance ("Elo says"), so every chance it states is
the model's. The card lays the legs out in the builder's order and prices them by the builder's own sums (`parlayDec`,
`parlayProb`, `parlayFair`), on the Bet amount; the chance is the level's own where it says so. A page drawn before a game
tipped off is drawn again rather than finishing a parlay nobody saw. `pcOpen` and `pcClose` are kept as names for the builder's card.

### The checks

`SMOKE_ONLY=card node tools/smoke.js` (`tools/smoke_card.js`), blocking, boots the page on made-up games tomorrow and the
day after (any hour, the off-season included), a made-up `lines.json` with made-up betslip ids and a builder of four legs of
three games (a player's points, a moneyline whose own id is newer than its game's lines, a spread DraftKings has moved since
its read, a total DraftKings has at another number), and holds every number and word to this file's own reading: the
builder's order and price against `tools/corr.js`'s bivariate normal and `data/corr.json`, the card's head, legs, money
($1,250 paying $14,735.18), chances and small print, the betslip link with `%23`, its title and note dated by the oldest
read, each leg's link, the converted legs and the leg by hand, the builder's slip lines, Share link's title and text word
for word with no url field and every fallback, the image through a recorder canvas (every figure whole; the type stepping
down at $412,500, the tiles a second row at $41,250,000), the Tab order, Escape, the backdrop, Close, Start over, fourteen
DraftKings cases one at a time, a press newer and older than `lines.json`, no leg on the slip (the game's page, the NBA
page), a typed book price, a one-sided leg with no fair chance, a level's Finish through `PARLAY_CARD.from` and through `window.spTier` with none registered (and an `elo|<level>` Finish opening nothing though a page defines `window.eloPicks`, the card's chance lines with no Elo wording left), the share
sheet for the image, every control 44px, and nothing written or fetched by any of it; after the FAIL (section 10), the
image's chance lines on a parlay of one player leg, one with a moneyline, two player legs and one with no fair chance,
every 13px piece starting at or after the text's left edge and ending at or before its right edge on the recorder's own
measure, the rows joined the window's lines word for word, the card 18px taller a row past two, the words counted ("its
player leg", "its player legs"). The model's chance is marked on
trial wherever a player leg is in the parlay and nowhere else, its price called what it is, and the fair chance's est.
given its own reason: two team legs of two games at the builder's price (a book price, "model says", no small print), a
milestone beside a team leg of another game (est. for the one-sided reason, never the same-game one, and on trial), a
level of a moneyline and a player leg (est., the same-game price, on trial) and a level of two team legs (neither). Start
over after an Add the builder refused clears what was said of it at its row and in the builder, as Clear ALL does.
Section 9 and the Parlay Builder's section hold the card on their own parlays too. Seventeen breaks planted in a copy of
the built page each turn it red, and since the review of 6 November 2026 two more: the image's chance lines drawn on one
row each as before (section 10: past the card's edge on each of its four FAIL parlays) and "its player legs" whatever the
count (section 10, on the three parlays of one player leg).

In Chromium at 1280 and 390 wide, on the published `state.json` and that afternoon's `lines.json`, with four legs in the
builder: every control in the window 44px or more (7), no sideways scroll, every text at 4.5:1 or better on what is under it
(3:1 for the price, which is large: 4.3:1), the lowest small text 4.8:1 (the kicker on its pill).

## The matchup bubble

The NFL hub's matchup bubble (its `nflbets/build/glance.js` at app v114; its owner's call of 17 October 2026: "when i click
on a player or a team, bring up a bubble pop up where it shows their matchup for the day so i can see info at a glance"),
carried to the NBA on 25 October 2026 with the NBA's numbers: `app/parts/glance.html`, set in at its `<!--part:glance-->`
marker.

**The names.** Every name on a leg the Parlay Builder draws (a Top 50 row, a builder row) and on any level card a tab
draws with `pbTierCard` is a button (`glanceName`, on `window` for Suggested Parlays' cards too): `data-glance` `p:<ESPN
athlete id>` for a player's line, `t:<club>` for a moneyline or spread, `g:<game id>` for a game total, the leg's game in
`data-glance-game`, the leg kept as its row drew it (`window.glanceLeg`, outside `M`, the last 600), named "Ace Guard: his
matchup" (the team's, the game's), with no chrome, a dotted underline and a 44px target from padding a negative margin takes
back out of the line, so no row moves.

**The window.** A dialog, not modal, labelled by its heading, the focus in it and Tab kept there; Escape, Close (44px), a
click outside or a click on another name closes it, the focus back on the name (with one of the page's windows open,
Escape is that window's). It sits under the page's windows, below its name, above it where there is no room below, kept on
the screen; a sheet across the foot of the screen at 640px and under, and wherever neither side of the name has 160px for
it. It keeps the place it was opened from (the builder, the Top 50, a level card) and the leg's key, side and line, and a
MutationObserver, connected only while it is open, follows every redraw (a tip-off, a press, a leg added or taken out):
bound to its leg's copy in that place, drawn again with that copy's numbers (and the line a press moved), the reader's
scroll kept; where the place no longer draws the leg, it closes, the focus on the leg's neighbour there.

**A player's bubble**: his position and club and his status as the page reads it (OUT where the lineups have him out, his
listing where today's report has him otherwise, DAY-TO-DAY say, which holds him out of the Top 50 and every suggestion, NOT
PROJECTED where the props model does not); his overall Elo with its tier shield and tier, and his rank among the rated
players at his position ("#15 of 182 rated guards", the Players tab's own numbers), or why the ladder does not rank him (not
on a roster, under its ten minutes a game or its twenty games); the game and its tip-off in Eastern time; **Faces**: the
opponent's defence as the player model rates it, the Teams tab's Defence column ranked as that column sorts ("TOR Defence
+59 ranked 6th of 30", the figure rounded as the tab rounds it: −45.5 is −46), or its offence for a steals, blocks or steals + blocks line, made at the other end of the floor;
the props model's projection for his minutes, points, rebounds, assists, threes and the leg's own stat (lit), marked on
trial; and the leg: its line, the price its row shows, the model's chance (on trial) and DraftKings' fair chance. Where the
NFL hub shows a season Elo by position, the ELO Ratings tab's units and the Mismatches, the NBA has the ladder's rating,
the Teams tab's columns and the props model; it has no market + form or Elo matchup chance to show.

**A team's or a game total's bubble**: the game and its tip-off; both clubs' records this season as the standings count
them (the Pick'em Record's regular-season finals less the NBA Cup final and the play-in, which ESPN types as regular-season
games and the standings leave out, the playoffs beside them once there are any); each club's strength with its tier shield and its rank
on the Teams tab; the line the leg stands on, the Parlay Builder's own (DraftKings' as `lines.json` read it, or a press's
where newer, dated; the published line where neither has one, else none yet); offence against defence each way, rated and
ranked as the Teams tab's columns; and every model's pick and chance: Vegas (the moneyline favourite on that line with the
margin out, else the spread's favourite), the Player Model and Team Elo (Tonight's numbers), and the Alpha Model, the Joker
and the ELO Model (their calls as the Pick'em Record has them, "no call" where a model has none on the game: on a game of
the job's today or before, the call on its row of `pickem.json`'s games; on a game after it, which the record does not run
to and the Parlay Builder lists all the same, the call in its `next`). The leg's club
is marked "this leg" and, on a moneyline alone, each model picking it to win is ticked; then the leg and **Open game on
Tonight**. The leg's Model is always the player model's chance, the one the builder prices the same leg on and the Picks
list's Player Model, with no line of the ELO Model's chance under it: that line was for a leg opened from the Elo picks,
which went on 5 November 2026 (README "Suggested Parlays", "What went"), and no leg comes from one now. **Open game on Tonight** opens the board on the game's day with its card in focus. It reads `pickem.json` through the Pick'em
Record's own loader (once a page load, no-store; asked for by the first team's bubble where the tab has not read it), and
says in its own line while it is read or where it did not load, the rest drawn. Nothing else is fetched and nothing is
stored; `build.js` stops if the part fetches or touches a browser store.

Two things in `pickem.json` are the bubble's alone, written by `publish.js` beside the record's games and read by nothing
else: `next`, the Alpha Model's, the Joker's and the ELO Model's calls (`pHome`, by game id) on the games after the job's
today to the slate's horizon, ten days out, since the record runs to today while the Parlay Builder lists the next two
Eastern dates (on a game day tomorrow's games, and between midnight and the first run of the day every game it lists);
and `off` on a final a club's record leaves out (`offFinals`): `cup`, the NBA Cup final, a December final at a neutral
site whose two clubs each played another neutral-site final, their semifinals, two games and neither against this
opponent, in the four days before; and `playin`, a final past either club's 82nd of the season in tip order, the Cup
final not counted. On every season in `data/games.csv` the rule marks exactly each season's Cup final (2024 to 2026) and
every play-in game of 2022 to 2026, and leaves each club of those seasons its 82 games; the short seasons (2012, 2020, 2021) are not 82 games
long and would need their own count. The record grades every game as before. `node tools/test_calls.js` holds both on
made-up seasons (the horizon, a preseason game, a game no model called; a Cup's semifinals, a two-game series abroad in
December, a neutral game six days after the last, a play-in game still to play).

### The checks

`SMOKE_ONLY=glance node tools/smoke.js` (`tools/smoke_glance.js`), blocking, on made-up games tomorrow, a made-up
`lines.json`, rated players, a props block and a `pickem.json` of its own, and a builder of eight legs (a player's points, a
steals line, a player the ladder does not rank, one the report has out, one the props model does not project, a moneyline,
a spread, a total, and on a page of its own a player today's report lists Day-To-Day, whose bubble says so): every name its leg's button (kind and id, the leg it keeps, its words, its 44px target) in the builder
and the Top 50, each leg drawn once in a place; every number in each bubble on this file's own reading (the rating, tier and
rank at his position, the game, Faces against the Teams tab's own table sorted on its column, the projection, the leg's
chances; the records, strength and ranks, the line, offence against defence, Vegas with the margin out and every model's
call, the moneyline-only tick, "this leg"), on a `pickem.json` in the shape `publish.js` writes it (tomorrow's calls in
`next`, and on game day on its games, the same picks), an NBA Cup final and a play-in counting in no club's record, and the
Celtics' offence planted at −45.5, drawn −46 in the bubble as the Teams tab, read off the tab, draws it; the keys and focus; below, above and as a sheet; the reader's scroll; the
builder redrawn, a price moved, the leg taken out, the Top 50 redrawn and a level card's names; no Elo pick's line left (a
leg carrying an ELO Model chance beside the model's, as an Elo pick's did, shows the model's as Model and no ELO Model line);
Open game on Tonight; the
Pick'em Record's file read once, no-store, still loading, missing and asked again; a press newer than `lines.json`; the
observer connected only while a bubble is open; and nothing written or fetched beyond that file. Fourteen breaks planted in a
copy of the built page each turn it red. In Chromium at 1280 and 390, a player's and a team's bubble: every control 44px,
every name in the builder and the Top 50 44px tall (54), every text 5.0:1 or better, on the screen, a sheet at 390.

## Suggested Parlays

The NFL hub's Suggested Parlays tab (`#suggest`), carried to the NBA on 25 October 2026 (the build plan's "Suggested
Parlays"; the NFL hub's README, "Bets and Stats: the loop", and its `props/build/part3.js` at app v114 are the source),
reshaped on 7 November 2026: **one set a night**, across every game of the night, its three levels Safe, Medium and
Aggressive each the parlay of the night's legs likeliest to land at the price its level asks (since 8 November 2026 with
no leg limit, Safe $2 on $1, Medium $4, Aggressive $8: "No leg limit", below; a team leg at the model's
chance; from the first set the page with them takes after 7 November 2026 DraftKings' main lines on players join them, each at DraftKings' own fair
chance: "Player legs, at DraftKings' odds", below; since 10 November 2026 each level holds at least one player leg wherever
the night's legs make such a parlay, else it is the likeliest without one and says why: "At least one player leg", below),
set out from 6:00 AM Eastern, locked 2 hours before the night's first tip-off, and kept and graded by the job as a record. Until that day each game on national TV had a set of its own
("Before 7 November", below). It is `app/parts/suggested.html`, set in at its `<!--part:suggested-->` marker after the
Parlay Builder's, on the Parlay Builder's legs, sums, cards and builder (README "Parlay Builder"); the tab sits after
Tonight. Its address is `#suggest` (a tab's address is its button's `data-tab`, read on load and on a hash change, and
written as a tab is shown, with no history entry).

### Why one set a night (the owner's call of 7 November 2026)

He asked why Medium and Aggressive were empty. Since the props model's trial was stopped as a FAIL on 5 November 2026
(README "Player props") a set took team legs only, and each set was one featured game's legs; a parlay takes one side
(the moneyline or the spread) and one total a game, so a game gives 2 legs at most, and Medium (3 legs) and Aggressive (4)
could never fill; Safe went empty too where only one of a game's team legs cleared the Value bar (the night's two sets on 7
November: Nuggets at Pacers, Safe alone; Knicks at Cavaliers, nothing). Asked how to fill them, he answered: "I want there
to always be suggested [parlays]. i want the med [parlay] to be at least $4 outcome from 1$ and aggressive to be $8 or
more. I want the best possible model confidence to match what level bet." So a set now spans the night's games, its
levels are set by what they pay rather than by a chance floor, and each is the likeliest parlay that pays it.

### Player legs, at DraftKings' odds (the owner's call of 7 November 2026)

He asked why the sets showed no player parlays. The props model had failed: its trial was stopped early as a FAIL on 5
November 2026 (README "Player props", "The early stop": behind DraftKings on both scores at 12,298 graded lines, its flat
bets down 223 units), and the second props model's one test on DraftKings' 2023-24 lines failed too on 6 November
(`research/props_v2/README.md`). So the model has no chance worth putting on a player's line, and the sets had taken none.
Offered DraftKings' own chance instead, with its cost said as "about -5% expected per leg" (a player leg then has no
edge), he chose "Add at DraftKings' odds". **That cost was said wrong, and is corrected here** (the review of 7 November
2026): -5% is the average of the two sides, but the page's rule for a main line's fair chance (below) puts the whole
margin on the Over, so at that chance **an Under breaks even** (its fair chance is its own price's implied chance: $1 back
on $1 on average) and **an Over gives up about 12%** (the whole margin: $0.86 to $0.91 back on $1 on 7 November's lines,
$0.88 on average). The levels are the likeliest parlays at their price, so they take short-priced Unders (steals, threes,
blocks and assists at -180 to -240) and almost never an Over: every player leg the job's runs took on 7 November's files
was an Under. The owner was told so. So every night set the page with player legs takes from `PL_FROM`
(`tools/suggest_check.js`, 23:00 UTC on 7 November 2026, after that night's set, taken at 19:12 UTC with team legs alone,
had locked) holds in its pool, beside the team legs (a set of team legs alone newly taken from `PL_FROM` is refused; one a
run of the page before the change took after it, landing before the change reached `main`, is kept as it was taken, as
`THREE_FROM` keeps Extreme; a set is rewritten until its lock, so the first night that carries player legs is the first
whose last run before its lock is the new page's with DraftKings' player lines posted: 8 November 2026 if the change
lands before that night's lock, 18:30 UTC, and a run after DraftKings posts its player lines lands before it):

- every player's **main line** DraftKings has posted for the night's games (`lines.json`'s `props.mains`, or a newer
  Refresh odds read: `pbPr`, as the Parlay Builder reads them), **over and under**, on a stat the page offers
  (`PROP_STATS`), with **both prices on file**; never a milestone (25+ points), a Yes market (a double-double) or a line
  priced on one side only, whose fair chance is an estimate; never a line **priced with no margin** (its two implied
  chances summing under 1: none of the 25,819 archived main lines, the least 1.005, nor any in `lines.json`), whose fair
  Over would read over its own price, and the same for a game's total (both counted, `vig`): the search below stands on
  no leg but a side being over its price;
- each at **DraftKings' own fair chance** (`legFair`, the page's measured rule for a main line: the whole margin on the
  Over, so the Over's chance is 1 less the Under's implied chance and the Under's is its implied chance), never the props
  model's; so an Under is priced exactly at its fair chance and an Over below it;
- in the builder's band, 45% to 97% by that chance;
- on a player the props model projects in the game on one of its two clubs (`pbWho`), whom neither the game's out lists
  nor today's injury report lists (`spOutWhy`, the Parlay Builder's `pbHeldWhy`: Out, Doubtful, Questionable and Day-To-
  Day are out; ESPN's NBA feed writes every status short of out as Day-To-Day, and a probable player plays).

A team leg keeps the model's chance. A level is still the likeliest parlay at its payout, on the chance every leg lands:
the team legs' at the model's, the player legs' at DraftKings', joined game by game by the same-game copula
(`parlayProb`) and priced by the builder's own `parlayDec` (a game's legs at the lower of their prices multiplied and
the hold over their implied joint chance). One leg a player, one side and one total a game. On 7 November 2026's
committed files (Saturday's seven games, their lines read at 16:58 UTC: 603 player main lines, 1,206 sides, 68 sides on
players the report listed and 16 on players placed on neither club) the pool held 922 player legs of 77 players in the
band beside 30 team legs; the job's run on them at 18:00 UTC took Medium as the Hawks' moneyline, the Pacers +7.5 and
Tari Eason's Under 1.5 threes (-180, fair 64.3%), +301 at 28.7% (DraftKings' fair chance 22.9%), and Safe and Aggressive
kept team legs alone (the likeliest pair was two short-priced moneylines, and no player leg made a likelier $8 parlay).

**What the cards say.** A player leg shows his name, the line, its game, DraftKings' price and "fair 64%", its fair
chance (`data-pb-plfair`); no Value mark, no model figure and no far-off flag, since it carries no model claim, and his
name's matchup bubble keeps the props model's projection for reference. The level's chance line says what it is made of:
"model says 31%" on a level of team legs alone; "model + DraftKings 29%" on one that mixes them (`data-pb-mix="mixed"`,
titled "The chance the levels are ranked on: each team leg at the model's chance, each player leg at DraftKings' fair
chance (the props model failed its trial, so a player leg carries no model claim), joined by the same-game copula"); and
"every leg at DraftKings’ chance" where every leg is a player's (`player`); both titles say what a player leg costs
there ("at that chance a player Under breaks even and an Over gives up about 12%, so the levels take Unders"). The parlay
card (its window, its image and Share link's text) says the mixed chance as "ranked at 31.0% (model on team legs,
DraftKings on player legs)", never "model + DraftKings says", which under DraftKings' own fair chance read as DraftKings
saying it (the review of 7 November 2026), with one line of small print under it: "Team legs at the model’s chance,
player legs at DraftKings’ fair chance: no model claim on a player leg, and at it a player Under breaks even and an Over
gives up about 12%." Player legs go on DraftKings by hand (ESPN's feed carries no DraftKings id for a player's line), as
the parlay card says.

**After the lock.** A player can be listed after the set locks, and a set holding him would then hold a leg DraftKings
voids or he plays hurt. So from the lock to the night's first tip-off a level holding a player the report has listed
since is built again from the lines at hand, that level alone, on the same rule (`spRebuild`), and said in one line
under it: "Updated: Ace Guard listed day-to-day (ankle), so held out (Sat 5:15 PM ET); this level was built again." The
job does it in the record (`replaceRuledOut` in `tools/suggest_ledger.js`: the level marked `updated` {pid, name, reason,
at} with the pool it was built on, and the entry's `updates` growing by one), and the page shows the record's; where the
record has not (no run landed since), the page builds the level itself, says so ("Updated in this browser: ..."), and keeps
it in this browser beside the set (`nba_sp_lock_v1`'s `rep`) for a level holding that player, until the record names
him. From the first tip-off nothing is built again, and a level the page built again before it stands (until the review
of 7 November 2026 the level as it locked came back under way, the listed player in it, its Adds live while its games
were still to tip). The page builds a level again only on DraftKings' lines as published (`lines.json` loaded: never from
none, where it did not load) and only where that makes a parlay; a kept replacement with no legs is dropped and never
applied. A level that still holds a listed player (no lines to build it from, or none would make a parlay without him) is
shown as it locked and closed to the builder, no Add, Add to builder or Finish (`spOpen`, `spHeldOf`), with one line
under it: "Ace Guard listed day-to-day (ankle), so held out: this level is closed." A set of team legs alone (7 November
2026's) is never built again.

**The search, and why it is exact.** With about a thousand player legs a night (932 in the band on 8 November) and,
since 8 November 2026, no leg limit (below), the parlays are far too many to list, so the levels are found by a branch
and bound (`spSearch`, `spWalk` and `spGroups`, under "THE SEARCH" in `app/parts/suggested.html`, whose comment is the
proof) that cuts only what it proves cannot rank first.

*The invariant.* Every bound on two or more legs of a game stands on the gaussian copula at the same-game table's own
correlations, which is what the builder works out wherever it does not shrink a group's matrix (`sgJoint` shrinks it
toward 0 only where its Cholesky factor fails). A game's legs stand on its variables (a player's stat, the home side's
win and its cover, the over), each leg its variable or its negative, so every group a parlay may hold is positive
definite wherever the variables' matrix is: the page factors it for each game at load (`spPosDef`; `tools/corr.js`
repairs the published table so, for 13 players a side, and every game of 7 November has least eigenvalue 0.37 or more).
A game where it fails is held to bounds true of the shrunk matrix too: two legs by `joint2` at max(rho, 0), no exact
integral. Until the review of 8 November 2026 the proof said its bounds held "whatever the correlation" and of the
shrunk matrix, which the pair cut did not: on a planted table that is not positive definite three legs of a game
landed 28.7% together where two of them land 26.7% at the table's -0.6, and the page missed that level.

*What the walk stands on* (I a leg's implied chance, e = p x price what it returns on $1, HOLD 0.896):
1. A parlay's chance never rises as a leg joins it, and its price never falls; so a parlay that meets its floor is
   ranked and nothing is grown past it: every parlay holding it is less likely and pays the floor too.
2. A game's "fair" legs (chance at most the implied one: every player leg at DraftKings' fair chance, every total, any
   side the model rates under its price) land together no oftener than their implied joint chance J and are priced at
   most HOLD / J, so they return at most HOLD on $1 at any size; a fair leg alone returns at most $1.
3. A parlay paying F or more on $1 has chance at most what it returns over F.
4. An edge leg (a side over its price, one a game) with fair legs returns at most HOLD + (e - 1) x L, L by Slepian's
   inequality from the equicorrelated copula at the largest correlation they can have (48 Gauss-Legendre nodes).
5. By Slepian's inequality again a group lands no oftener than a one-factor copula of its legs' largest correlations,
   and a group grown by k legs no oftener than that with the game's k likeliest beside it, which falls to 0 as k grows:
   that ends the walk with no leg limit, never a count of legs.
6. The rest of the night: a branch of chance c and return u reaches at most the largest over the later games used with
   an edge leg of min(c x their chances, u x their returns / F), read off a Pareto frontier built from the last game
   back (256 points, neighbours merged upward, which only raises it).
7. In the walk's last game, a group grown from T that pays the floor has J at most HOLD x D / F and lands no oftener
   than min(J(T), HOLD x D / F) plus the edge leg's band at T.
8. Two player legs of one club, stat and side have the same correlation with every other player's leg, so the less
   likely of the two (by at least 0.2%) is let go wherever the other's group already paid the floor.
9. In the last game, where every fair leg has a correlation of 0 or more with the edge leg a, P(a + B) <= e_a x J.

The walk leaves a branch once its bound is under the best found less the tie (1e-12). A group of three to five legs is
worked first by the copula's own integral (`spOrth`, Gauss-Legendre on fixed pieces, within 5e-5 of the integral at 64
nodes a piece on 630 random groups of 7 November's legs), and only one that integral leaves in reach is worked by the
builder's GHK sum; every bound that stands on an integral or a sum is taken 0.1% wider before it cuts. Every parlay it
reaches is worked by the builder's own `parlayProb` and `parlayDec`, the numbers the card states. It starts from a
parlay to beat, the best of its seeds: the team legs' own best, the night's likeliest legs taken until the floor is met,
and the walk itself with at most two and then three legs of a game (each a parlay the rule takes, ranked with the rest),
so its cuts bite from the first branch. Until the review a one- or two-game night had no such seed (neither the team
legs nor one leg a game reached the floor), and the walk started with nothing to beat.

**What the old walk's cuts stood on, and why they went** (the review of 8 November 2026's change, each cut of the 2-to-5
walk read again with no leg limit): its split of every parlay into "at most one game's group of three legs or more, the
rest one or two legs a game" held only while a parlay had 5 legs at most, so the walk takes a group of any size at every
game; its bound on what later games return was a table by the legs left (`spDP`), which with no most is the product over
every later game, so it is the frontier (6); its bound on a group growing by k legs more grew without end as k did and
was taken only up to the cap, so the growth is held by (5); its three-leg quick check and its 0.1% allowance stand at any
size. The first walk with no leg limit ranked a parlay that met the floor and walked on past it; (1) proves nothing past
it can rank first, so the walk now stops there.

**Its time.** `tools/test_suggest_speed.js` holds it (in the job's record step, beside the record's own test), on the
pools of `tools/fixtures/sp_nights.json` as the page built them, each level stopped at a limit several times what it
takes and held to the exact search's answer:

| Night (jsdom) | Safe | Medium | Aggressive |
|---|---|---|---|
| 7 November, 7 games, 971 legs | 0.14 s | 0.12 s | 0.15 s |
| Each of its games alone (112 to 166 legs) | 0.03 to 0.08 s | 0.06 to 1.0 s | 2.5 s (DEN at IND, ORL at GSW), 4.7 s (SAS at POR), 7.8 s (HOU at PHX) |
| DEN at IND with WAS at OKC (246 legs) | 0.03 s | 0.09 s | 2.9 s |
| Those two with ORL at GSW (375 legs) | 0.04 s | 0.07 s | 0.13 s |
| 8 games at -900 (the review's) | 0.01 s | 0.08 s | 2.7 s |
| 8 games at -400, 32 player lines a game | 0.03 s | 0.25 s | 1.4 s |
| 7 November's player lines, every home side -600 to -1000 | 0.12 s | 0.12 s | 0.6 s |
| Three of its games at -400, -350 and -300 | 0.07 s | 0.12 s | 1.9 s |
| 10 November, 6 games, 775 legs (since the rule with a player) | 0.09 s | 0.11 s | 0.21 s |
| 8 games at -900 whose only player legs are long shots (232 legs) | 0.02 s | 0.11 s | 0.45 s |

The page as the review found it took over 8 s on every one of those games' Medium and over 30 s on their Aggressive, and
over 12 s on every heavy-favourite night's Aggressive (30 of the test's 80 checks failed on it). Not held, and said: three
of 7 November's games alone as an Aggressive night are still slow, WAS at OKC about 19 s, NYK at CLE about 51 s and BKN
at ATL about 2 minutes in jsdom (8.5 million group nodes). On those every leg is a player's line at DraftKings' fair
chance, so by (2) every parlay returns under HOLD and thousands sit within a hair of the same chance at $8; the page
before the change (5 legs at most) took over 100 s on each. A one-game night (the NBA Cup's knockout nights, most
playoff nights) can so still freeze the tab for that long when it opens; the job's record step stops at 12 minutes, and
its commit puts the ledger back whenever that step did not succeed.

tools/smoke_suggested.js holds the page's search to its own enumeration of every parlay on its made-up nights and 36
random ones, and the heavy-favourite nights above by the speed test; tools/test_suggest_ledger.js to its own copula and
enumeration on its nights (a night whose Safe needs 6 legs and Medium 12, and one of heavy Unders whose Safe is 9 legs
with a group of four and one of three); the record's guard to its own enumeration (below).

### No leg limit (the owner's call of 8 November 2026)

He wrote: "we can eliminate maximum legs for all the sections, it can be multiple legs as long as it meets the criteria
of safe, med, aggressive and meets min payout requirements. so for example the safe section could sometimes have up to
5-6 legs but it meets safe req and min payout req". Safe was the likeliest 2-leg parlay with no floor, so with no leg
limit and no floor it would always be 2 legs (a leg never raises the chance); asked what Safe's floor should be, he chose
"$2 on $1 (+100)". So each level is the likeliest parlay of the night's legs, of 2 legs or more and no most, whose price
meets its floor: Safe $2 on $1 (a decimal price of 2.00, +100 or longer), Medium $4 (+300), Aggressive $8 (+700). Every
other rule is as it was: the chance it is ranked on (team legs at the model's chance, player legs at DraftKings' fair
chance, a game's legs joined by the builder's own sums), one side and one total a game, one leg a player, the pool and
its band, injury and main-line rules, and ties to the higher price, then the fewer legs, then the legs' ids. A card says
its rule as "likeliest paying $2+" ("$4+", "$8+"), its title "No leg limit: ..." and what more legs cost.

**What more legs cost.** A level is the likeliest at its floor, so on a night of heavy favourites the model rates over
their price it stacks them: on 8 November's lines Safe is the Mavericks to win at -324 with Walker Kessler's Under 1.5
assists, 2 legs, but a night of heavy favourites makes a deep one (the record's test: fourteen moneylines at -900 and -700 make a Safe of 6 legs and a Medium of 12). Every team leg stands on the
model's chance, which has run over-confident: on the per-game record the model's expected wins ran about twice DraftKings'
fair chance's (Medium 3.9 against 2.0, Aggressive 2.0 against 0.7, over fourteen sets), and a parlay multiplies that
over-confidence leg by leg. More legs on favourites make a level likelier by the model, not by the market. The owner was
told so.

**The record.** The sets taken from `NOCAP_FROM` (`tools/suggest_check.js`, 18:00 UTC on 8 November 2026) are held to
the new rule; one taken before keeps the rule it was taken under (Safe the likeliest pair, Medium and Aggressive 2 to 5
legs), its levels' heads (`min`, `max`, `price`: 2, 2, 0 and 2, 5, 4 and 2, 5, 8, where the new are 2, null, 2 and 2,
null, 4 and 2, null, 8) saying which, and stays as it was: 7 November's set and every per-game set byte for byte. A set of
the old heads taken from `NOCAP_FROM` is refused unless the file it is held to already holds it so, taken at the same
time (a run of the old page that landed before the change reached `main`, as `PL_FROM` keeps a set of team legs alone). A
night not yet locked is rewritten by the next run under the new rule, as a set is rewritten until its lock (8 November's,
taken at 03:04 UTC on the old rule, is rewritten only where a run of the new page lands before its 18:30 UTC lock;
else it locks as taken, on the old rule). A level of a set taken under the old rule that is built again after its lock,
for a player the report lists, is built under that rule (`spLvOf` reads the level's head, the page's `SP_OLD_LEVELS`;
the job hands `spRebuildOut` the head), so the set keeps one rule's heads; until the review of 8 November 2026 it was built
under the new one, and a set of mixed heads was refused on every run to its first tip-off. The pool the record keeps is
gathered by the same walk with no leg limit (every option of every parlay within 1% of a level's chance), so it holds
every leg a level's winner can use, at any size: the walk's every cut is a proof that no parlay of the branch could reach
that 1% ("The search, and why it is exact", above). The guard holds a set the run took to that kept pool as well as to
its own reading of the run's files (since the review of 8 November 2026: until then only to its own reading at the take,
so a kept pool that could not make its own level was written and then refused on every run from the lock), and its own
reading builds groups of three legs or more of a game itself ("The guard's own groups", under the record).

### At least one player leg (the owner's call of 10 November 2026)

He sent a screenshot of that night's Suggested Parlays, every level team legs alone, and asked "why is it still only
showing team legs and not players", and of the Parlay Builder "I also dont see any player odds". The why: each level is the
likeliest parlay paying its floor, and a team leg stands on the model's chance, which runs above DraftKings' (the Value
tags), while a player leg stands on DraftKings' own fair chance, at which an Under breaks even and an Over gives up about
12% ("Player legs, at DraftKings' odds", above). So at the same price a team leg always looks likelier, and that night the
record's pool kept no player leg at all (its `pl`: 920 lines read, 172 out of the band, 60 held out, the 748 in the band all
cut, none within 1% of a level). Offered "at least one player leg in every level" as the fix, his reply made plain he
expects player legs on the tab. So:

- each level (Safe, Medium, Aggressive) is the likeliest parlay of the night's pool, 2 legs or more and no most, paying at
  least its floor ($2, $4, $8 on $1), **that holds at least one player leg** (a leg `spPool` marks `pl`), wherever the pool
  makes such a parlay;
- where it makes none (DraftKings has posted no player line for the night's games still to tip, or every player is held
  out, out of the band, or none can make the level), the level is the likeliest such parlay without one, the rule before,
  so **a level is never empty for want of a player**; it is empty only where no parlay at all meets its rule, as before;
- the card's rule says which in a few words: "likeliest paying $2+ with a player", or "likeliest paying $2+ · no player
  lines yet" (no player main line read for the night's games still to tip: the pool's `pl` counts none read, held, placed
  on no club or priced with no margin) and "likeliest paying $2+ · no player leg fits" (lines read, and no parlay holding
  one meets the level); its title says the rule whole;
- everything else is as it was: the chances (the model's on team legs, DraftKings' fair chance on player legs), the floors,
  the pool, one side and one total a game and one leg a player, the builder's own sums (`parlayProb`, `parlayDec`), the lock
  2 hours before the night's first tip-off, and ties to the higher price, then the fewer legs, then the legs' ids.

What it costs, said: the level is still the likeliest at its floor, now among the parlays holding a player, so where the
best of all held none the level gives up some chance by the numbers it is ranked on. A player leg carries no model claim
(DraftKings' own fair chance), so the level's chance is at least as honest as before, and the levels take short-priced
Unders, which break even at that chance. On 10 November 2026's committed files at 17:00 UTC (6 games, 775 legs in the pool)
Safe went from 52.07% (two team legs) to 49.92% with a player, Medium from 28.62% to 27.95% and Aggressive from 15.42% to
14.87%; on 7 November's night only Safe moved (51.38% to 51.34%); on the speed test's night of eight -900 favourites whose
only player legs are long shots (every player leg 45% to 53%), Safe falls from seven moneylines at 55.78% to one moneyline and an
Under at 47.12%.

**In the code** (`app/parts/suggested.html`): `SP_LEVELS` gains a sixth field, `'player'`, which a level's head carries as
`need: 'player'`; the levels of 8 to 10 November are `SP_NOCAP_LEVELS` (no need), and `SP_OLD_LEVELS` before them. `spRule`
is the rule's search: the best of every parlay (`spSearch`, as before); where it already holds a player leg it is the
answer (the best of a wider field, and in this one) and nothing more is searched; where it holds none, `spSearchPl` (the
walk with the rule's word, `spWalk`'s `o.pl`, seeded by `spAddPl`, the best of all with one player leg more, `spGreedyPl`,
and the walk with at most two and three legs of a game) finds the best holding one; where there is none, the best of all,
its why worked out by `spNoPlOf` and kept on the level as `nopl` (`lines` or `fit`). The proof is the search's own comment,
(10), and below. A level built again after the lock for a player listed since is built under the rule its set was taken
under (`spLvOf` reads the head: `need: 'player'` the rule with a player, a head without it the rule of 8 November, the old
heads the old rule; the job hands `spRebuildOut` the head with its `need`), and the kept pool (`spPoolOut`) gathers, for a
level holding a player, every option of every parlay holding one within 1% of the level's chance (`spWalk` with `pl` and
`keep`), and for a level holding none every option of every parlay within 1%, as before (there is then no parlay holding a
player to keep).

**Why the search stays exact.** Every bound of the walk ((1) to (9), "The search, and why it is exact", above) bounds every
parlay of a branch, so it bounds the parlays holding a player leg too and stands as it is. What the word changes is
which parlays rank and where the walk stops: (a) a parlay is ranked only where it holds a player leg; (b) (1)'s stop: a
branch that meets the floor with no player leg yet is not ranked, and any parlay of it that holds one holds the branch and
some later player leg x, so it is no likelier than the branch with x alone, which pays the floor too (a leg only raises the
price) and is a parlay the rule takes (x is the only leg of its player, and a player leg fits any game's side and total); so
from there the walk tries each later game's player legs alone, likeliest first, and nothing else, and in a game's groups a
group that pays the floor with no player leg grows only by one of that game's player legs (`onlyPl`) and is handed on to
the walk for a later game's; (c) a branch with no player leg that needs one reaches at most its chance times the likeliest
player leg of the games still to walk (`maxPLfrom`: a leg's own chance bounds every group that holds it, by (1)), and a
group holding none, handed on, at most that from the next game on; (d) (8)'s let-go of a less likely leg of the same club,
stat and side stands where that leg's group paid the floor holding a player leg, and both are player legs. The review of
that day also found (9), the edge ratio, handed on as a bound to the groups a group grows to: it bounds a group that pays
the floor and holds no leg of a correlation under 0 with its edge leg, so a grown group with such a leg (or a group that
did not pay the floor) inherited a cut that was never proved; it now bounds the group itself alone (no case had met it: no
answer of the speed test or the record's test moved when it went).

**Its time** (`tools/test_suggest_speed.js`, each level as `spBuild` searches it, the rule's word where the best of all
holds no player, in jsdom): 10 November's night (6 games, 775 legs) 0.09 s Safe, 0.11 s Medium, 0.21 s Aggressive; the
night of eight -900 favourites whose only player legs are long shots (232 legs) 0.02 s, 0.11 s and 0.45 s; the levels the
word moved (7 November's Safe, the two and three games' Safe, eight games at -900's Safe, 7 November's player lines at
-600 to -1000's Safe) 0.03 to 0.17 s; every other level within the times above, the best of all already holding a player
leg. Every answer the word moved was held, before it went into the test, to the record's guard's own reading of the same
legs (every pair by its own copula, its own groups, its own enumeration with the word): the same parlay on all 21 levels of
the seven nights, and on the six of the two new ones.

**The record.** Every set taken from `PLAYER_FROM` (`tools/suggest_check.js`, 18:00 UTC on 10 November 2026, before the
change could reach `main` and before that night's 22:30 UTC lock) is held to the rule with a player, its levels' heads
carrying `need: 'player'`; a set taken before keeps the rule it was taken under (the heads without `need`, held by
`NIGHT_LEVELS_NOCAP`, or the old heads), byte for byte, and every check it had; a set of the heads without `need` taken from
`PLAYER_FROM` is refused unless the file it is held to already holds it so, taken at the same time (a run of the page
before the change that landed after the cutoff: the `NOCAP_FROM` pattern, `nocapOk`). That night's set, taken at 15:42 UTC
on the rule before and taken again so by the job's runs from 18:47 UTC (the page before the change, after the cutoff:
each kept only as the file holds it), is rewritten by the first run of the new page before its lock, as a set is
rewritten until its lock.
The guard holds the new rule on its own: a level's head its rule's (`need` among it); a level holding a player leg ranked
over every parlay holding one by its own enumeration with the rule's word (`nightBest`'s `needPl`: a parlay ranked only
where one of its games' options holds a player leg, and a branch holding none let go once its chance times the likeliest
such option of a later game is under the best's, and at once where no later game has such an option: the review of that
day found the walk, with no best yet on a night with no player line, listing every parlay of the night, about 36 s a call
on nine games and 4 to 8 minutes on ten, six calls a set, so the record's step would have overrun its cap on every run that took a big night before DraftKings
posted its props, and the smoke's tests step too); a level holding none ranked over every parlay, standing only where its
pool makes no parlay holding one that its rule takes ("holds no player leg, and the pool makes a parlay holding one that
its rule takes"), and saying why, `nopl`, as the guard reads its pool's counts (`noPlOf`: `lines` where none was read,
held, placed on no club or priced with no margin, else `fit`); a level holding one saying no why. On a set the run took,
that is on the guard's own reading of the run's files (every player leg read again, every pair by its own copula, its own
groups: a game's team legs are a side and a total at most, so every group of three legs or more it builds holds a player
leg), and on the pool the set keeps.

### On the page

Top to bottom: the heading and the night's date; the record's pills; Refresh odds and its status line; the night's set,
or the wait line, or why there is none. Nothing else: as on the NFL hub since its app v113 (the owner's call of 17 October
2026, "get rid of all the long paragraph description stuff"), no lead paragraph, no foot, no sentence under the record,
the cards drawn quiet, each lock line one short line.

**The night** is the first Eastern date with a game still to tip, never preseason: every game of that date but preseason
ones, national TV or local alike (`spNight`, `spNightOf`), id `<season>_<YYYYMMDD>_NIGHT`. Its set goes up at 6:00 AM
Eastern that morning; before it one line stands in its place, "Next up: Saturday’s 7 games. The set goes up Sat 6:00 AM
ET." (`data-sp-wait` the instant, `data-sp-next` the games), worked out through the time zone database (`spEtAt`), so the
Sundays the clocks turn open at 6:00 AM New York time either way. Once the night's last game has tipped the next date is
the night, and its wait line stands until its morning. The set is headed "Saturday’s games", its count in a pill and its
first tip-off in Eastern time.

**The pool** (`spPool`): every team leg of the night's games still to tip with DraftKings' price, the moneyline and spread
of each side and the total's over and under, priced exactly as the Parlay Builder takes them (`lines.json` through
`pbGl`, or a Refresh odds press's newer read; `pbPriced`, `pbTotals`), at the builder's own chance (`legModel`: a
moneyline's and a spread's the model's, a total's DraftKings' own fair chance, as the NBA builder takes it), held to the
builder's band (45% to 97% by that chance, `PB_PMIN`, `PB_PMAX`), its far-off guard (none 15 points or more over
DraftKings' fair chance, `legFarOff`) and its betslip id rule (a game line with no id where its game's lines carry ids).
No value bar: a leg need not beat its price (the owner wants the levels filled). The band is kept as the builder has it:
on 7 November 2026's seven games it left 30 legs of 42 (the 12 out were 7 underdogs' moneylines and 5 favourites'
spreads the model rated under 45%; none was over 97%, the likeliest leg in the pool the Thunder's moneyline at 81.6%), and
all three levels built. A leg 3 points over its price still wears the
Parlay Builder's Value mark, a total never. Beside them, from the first set the page with them takes after 7 November 2026, every player's main line
at DraftKings' own fair chance ("Player legs, at DraftKings' odds", above). The far-off guard is kept on
purpose: the levels are chosen on the model's chance, so without it they would gather exactly the legs where the model
is furthest from DraftKings (an underdog the model rates 48% where DraftKings' fair chance is 30%).

**The levels** (`SP_LEVELS`: `[id, label, the fewest legs, the most (null: no limit), the least decimal price]`), each
chosen on the chance that every leg lands, by the builder's own sums (`parlayProb`, the same-game copula; `parlayDec`, the
price, a game's legs priced together at the same-game hold), since 8 November 2026 with no leg limit ("No leg limit",
above):
- **Safe**: the likeliest parlay of 2 legs or more whose decimal price is 2.00 or more, $1 paying $2 or more, +100 or
  longer ("likeliest paying $2+");
- **Medium**: the likeliest of 2 legs or more at 4.00 or more, +300 or longer ("likeliest paying $4+");
- **Aggressive**: the likeliest of 2 legs or more at 8.00 or more, +700 or longer ("likeliest paying $8+").
Until then Safe was the likeliest 2-leg parlay ("likeliest pair") and Medium and Aggressive took 2 to 5 legs
(`SP_OLD_LEVELS`: a set taken then is drawn with its own rule; an empty level's pill reads "2+ legs" where it read "2–5
legs"). Since 10 November 2026 each is the likeliest such parlay holding at least one player leg wherever the night's legs
make one, its rule "likeliest paying $2+ with a player"; where they make none, the likeliest without one, "likeliest paying
$2+ · no player lines yet" or "· no player leg fits" ("At least one player leg", above; `SP_LEVELS`' sixth field,
`'player'`; a set taken from 8 November until then, `SP_NOCAP_LEVELS`, is drawn with its own words, "likeliest paying
$2+").
One side (the moneyline or the spread) and one total a game, as the builder takes them (`pbFits`, `slipWhy`); ties go to
the higher price, then the fewer legs, then the legs' ids (`spBetter`). The search is exact (`spSearch`): a parlay's
chance and price are the products of its games' own (`parlayProb` and `slipDec` work game by game), so each game's options
are worked once by the builder's sums (a side, a total, or its side and total together: `spOpts`), and the search walks the
games, each one's options likeliest first, dropping a branch once its chance is under the best found (each leg can only
lower it: a joint chance is never above a leg's own) or its price, at the dearest leg left for every leg it may still
take, cannot reach the level's floor. (That was the team rule's search, `spOpts` and `spSearch` over each game's options;
with player legs it is `spWalk`'s branch and bound, "The search, and why it is exact", above: a night of 15 games, 80 team
legs and 1,200 player lines, builds in about 1.6 s in jsdom.) The chosen
parlays are then worked again by `pbExact` on the legs in the builder's order, the numbers the card states. A level that
cannot be built says why in one line: "No parlay of the night’s legs pays $8 or more on $1: one game makes 2 legs at
most." (a one-game night makes $4 only where the model rates an underdog of about +130 or longer at 45% or more, its
moneyline with the total, and never $8: the band and the far-off guard let in no underdog much longer than +220, which
with the total pays under $6), "Only 1 leg tonight: ...", "No legs yet:
DraftKings had posted no game lines for the night’s games as of Sat 11:12 PM ET.".

Each level is a card (`pbTierCard`, quiet), three across on a wide screen and one a row at 1100px and under: its legs in a
pill and its rule in words; DraftKings' fair chance first and the model's beside it; the price and what the Bet amount
pays (redrawn in place as the amount is typed); its legs, each saying its game ("To win · WAS at OKC"; a total is named by
its game), each with its own **Add** (the leg as the card drew it, a locked set's at its locked line and price; Added while
it is in, a second press taking it out, the focus kept); **Add to builder** (exactly its legs, in the builder's order, so
the builder pays what the card said) and **Finish** (the parlay card on its legs at the Bet amount, `sp|<night id>:<level>`,
headed "Medium parlay · Sat Nov 7", stating the level's own chance). An Add, a refusal and Add to builder are said on the
tab's own status line.

**The lock.** The set is live until 2 hours before the night's first tip-off (`spLockAt`): "Locks Sat 3:00 PM ET, 2 hours
before the first tip-off." From then the tab shows the record's set, the job's last before the lock, the same for every
visitor and the one the record grades: "Locked since Sat 3:00 PM ET." Where the record has none (no run landed before the
lock, or the file did not load), the page builds the set once on the lines at hand and keeps it in this browser under
`nba_sp_lock_v1` (`{v: 2, season, nights: {<night id>: {tip, own, at, tiers}}}`, outside `M` and never sent anywhere,
pruned once the night's last game tips or the night leaves the slate): "Locked since Sat 3:00 PM ET. This browser’s own
set: the site’s was not published in time, so the record does not grade it." A value of the
per-game rule (`v: 1`, games keyed by game id) or of another season is taken out on its first read. A locked night waits
for the record's read ("Loading the site’s set…") and for DraftKings' lines ("Loading DraftKings’ lines…") before building
its own, and a set built with no published lines at all, or before DraftKings had posted any line of the night, is shown
and never kept, so a reload (or the lines, once posted) builds it again. **A set of no lines is no set**: the job takes
no set of a night DraftKings has posted no line for (the lines feed's second date, read a day ahead, mostly), and the page
reads a record's entry whose pool holds no leg and none left out by a rule (`spNoLines`, one an older job took) as none,
building its own from the lock on the lines it has. Until 7 November 2026's review the job took such a night's three
empty levels a day ahead, and where no run that read the posted lines landed before the lock, that entry was the night's
record and every visitor saw three empty levels all night, dated the day before. **A night once locked stays locked**
(`spLockOf`): once a set of it has locked, in the record or in this browser, the night stays locked though ESPN moves its
first tip-off later (the job takes no new set of it on later lines, and the page never sets it out live again); one
whose first tip-off moved earlier past its lock is locked from then, its set as the last run took it. From the first
tip-off the set is **under way**: the locked set as it locked, "Locked since Sat 3:00 PM ET. Under way since Sat 5:00 PM
ET.", each level keeping its Add, Add to builder and Finish (and each leg its Add) while every one of its games is still
to tip (`spOpen`; `spTier` finds only such a level), and losing them once one tips (the half-minute look draws the tab
again at each tip-off). Until that review no level could be added from the first tip-off, though on a night of seven
games six were still to come. With no locked set, none is built of the games left: "... The site’s set was not published
in time." and no card. From the lock to the first tip-off a level holding a player the report has listed since is built
again, that level alone, and said so ("Player legs, at DraftKings' odds", "After the lock"); a set of team legs alone,
which no injury report moves, never is. A level the set locked empty says so as of the take ("Empty when the
set locked: ..."). The record is read again when the night reaches its lock whichever tab is on the screen, once Suggested
Parlays has been opened in that page load.

**The record's pills**: a pill a level, Safe, Medium and Aggressive, its won-lost and units on $1 from the night map's
grades alone (each season's night and level once, from the last key that holds it), starting fresh on 7 November 2026;
each titled with the wins expected by DraftKings' fair chance and by the set's own chance (the one it was ranked on and
showed: the model's on team legs, DraftKings' on player legs, never called the model's: the review of 7 November 2026), its
pushes, and the per-game rule's
record before it ("Safe: 0 graded, 0 won; before 7 Nov, one game’s legs: 5–9, −7.48 units"); Pending (the night's
levels still to settle).

The tab is drawn only while it is on the screen: a hidden tab builds nothing and keeps nothing. Nothing is read before it
first opens; then the record and lines.json, once each a page load, no-store (lines.json's read is the Parlay Builder's,
one promise for the two tabs), and the record again, no-store, when the night reaches its lock. The half-minute look redraws
the tab where what it shows is stale: the 6:00 AM turn, the lock, each tip-off of the night (`spState`).

### Before 7 November: one set a featured game

From 25 October to 7 November 2026 each game on national TV (a featured game: one the slate lists on any network ESPN's
scoreboard names in the national market, NBA TV among them, never preseason; `FEATURED_TV`, whose copy
`tools/suggest_check.js` keeps for the entries taken then) had a set of its own, set out one night at a time from 6:00 AM
Eastern the morning after the featured date before it and locked 2 hours before its own tip-off: the Parlay Builder's levels
on that one game's legs and every bet type, Safe the likeliest pair, Medium and Aggressive the 3- and 4-leg parlays with
the best expected return that land 25% and 12% by the model's chance (else the likeliest of that size), Value picks first,
thin-edge legs to fill and the total last (`SP_SEARCH`, the NFL's widths), a player's chance the props model's on trial,
no player the injury report listed, and a locked level holding a player listed since built again, that level alone. Its
record went 5–9 at Safe (−7.48 units), 4–10 at Medium (+7.91) and 1–13 at Aggressive (−1.17) over fourteen graded sets,
and stays in the record's `featured` map as it was taken and graded (the pills' titles carry it).

**What went on 5 November 2026** (the owner's calls, "Remove the Elo picks section", and "get rid of the extreme section as
well"):
- **The Elo picks**, the ELO Model's moneylines and spreads where its own chance beat DraftKings' price, four levels on that
  chance under the sets. On the walk-forward folds, each called by the model fitted on the seasons before it, against the
  consensus closing line (`research/elo.json`'s `pick`, README "Pricing the Elo picks"), such picks lost against the
  market:

  | Fold | Moneylines 3 points over the price | said | won | units on $1 | Spreads 3 points over -110 | won |
  |---|---|---|---|---|---|---|
  | 2024 | 334 | 59.1% | 51.5% | +9.1 | 626 | 49.4% |
  | 2025 | 393 | 61.3% | 50.6% | +7.0 | 753 | 52.2% |
  | 2026 | 376 | 59.6% | 45.7% | -17.9 | 784 | 49.4% |

  Gone with it: the section, its Add, Add to builder and Finish, the parlay card's `elo|<level>` resolver and its Elo
  chance, the matchup bubble's ELO Model line on an Elo pick's leg, and `state.json`'s `eloPicks`. The ELO Model itself
  stays (README "The ELO Model").
- **Extreme**, each set's 5-leg level: 0-12 on the record when it went. The entries taken before (`THREE_FROM` in
  `tools/suggest_check.js`) keep it, and the summary keeps its record under its own key (below).

### Where the NBA differs, and why

| The NFL hub | Here | Why |
|---|---|---|
| Prime time: a Thursday, Sunday or Monday kickoff at 7:00 pm Eastern or later, a set a game, and the Sunday slot's games together | Every game of the night together, never preseason, one set (until 7 November 2026: a set a game on national TV) | The NBA has games most nights at every hour; the owner's call of 7 November 2026: one game's team legs make 2 legs at most |
| Safe the likeliest pair; Medium to Extreme the best expected return over 25%, 12% and 5% (since its app v138, the least costly at DraftKings' fair chance) | The likeliest parlay of any size from 2 paying $2 (Safe), $4 (Medium) and $8 (Aggressive) or more on $1, holding a player leg wherever the night's legs make one (until 8 November 2026 Safe the likeliest pair and the others 2 to 5 legs; until 10 November no player leg asked) | The owner's calls of 7 November 2026, "the best possible model confidence to match what level bet", of 8 November, "we can eliminate maximum legs for all the sections", and of 10 November, "why is it still only showing team legs and not players" |
| Value picks first, thin legs to fill | No value bar: every team leg in the builder's band, the far-off guard kept | So the levels always fill; the guard keeps the model's widest misses out |
| One night a week's prime-time games, "week 6" in the head | The first Eastern date with a game to come, its date in the head, up from 6:00 AM that morning | The NBA has no weeks |
| Lock 2 hours before kickoff | 2 hours before the night's first tip-off | |
| Three levels shown (Extreme hidden since its app v132) | Three, Safe, Medium and Aggressive | Extreme went 0-12 here (5 November 2026) |
| The model's chance on player legs | DraftKings' own fair chance on player main lines, from the first set the page with them takes after 7 November 2026 (`PL_FROM`; no player legs from 5 to 7 November) | The props model's trial was stopped as a FAIL on 5 November 2026, and the second props model failed its test on 6 November: the owner's call, "Add at DraftKings' odds" |
| Every suggested leg needs DraftKings' id | Game legs need theirs where the game's lines carry ids | The Parlay Builder's rule |
| The record's `prime` and `slot` maps | `night`, and `featured` from before | |
| Graded by `settleLeg` | By the page's own `NBA_GRADE.legResult` | |
| Elo picks | None since 5 November 2026 | No player Elo is fitted to NBA props, and the ELO Model's team picks lost against the market |
| The record written by the props job after its audit, never turning it red | Its own step after the tests, which marks that step alone and puts the file back on a failure | The NBA job's pattern (the props ledger's check) |

### The record (`tools/suggest_ledger.js`, `tools/suggest_check.js`, `data/suggest_ledger.json`)

The NFL hub's `props/build/suggest_ledger.js` on this page. `node tools/suggest_ledger.js` boots the built `index.html`
in jsdom on the `state.json` just published and the `lines.json` just read, the window's clock held at the run's time so a
boot of seconds never crosses a lock, every file it asks for served from the checkout but the record itself, which answers
404 so every set is built from the data. It takes the night set of each date on the lines feed's two dates by the page's
own `spTakes` and `spEntry`, whether the tab shows it yet or not (so the next night's set is taken the night before, since
the job's runs land hours late), and refuses a page whose levels are not the three (`NIGHT_LEVELS`, its own copy) or that
locks at another time, no lines.json, or one that threw.

`data/suggest_ledger.json`, one entry a line so a run's diff is the entries it took or graded:

```
{ how, since, updated, featured_summary, night_summary,
  featured: { "<season>|<date>|<tip>|<game id>": <a per-game set, before 7 November 2026> },
  night: { "<season>|<date>|<first tip>|<season>_<YYYYMMDD>_NIGHT": {
      season, date, nid, games: [ { gid, away, home, tip, type } ], tip, last, lock, generated,
      pool: { legs: [ [ <team leg key>, <DraftKings' price>, <the model's chance, kept whole> ]
                    | [ <player leg key>, <DraftKings' price>, <its fair chance>, <the other side's price> ] ],
              pairs: [ [ <leg>, <leg>, <their joint chance>, <their price> ] ],
              sets: [ [ <leg>, <leg>, <leg>, ..., <their joint chance>, <their price> ] ],
              pl: { lines, band, held, none, vig, cut }, band, far, noId, vig },
      ...
      a level built again after the lock: + updated: { pid, name, reason, at }, pool: <its own, as above>
      updates: [ { tier, pid, name, reason, at } ]   (the player-leg rule's sets, from `PL_FROM`;
      7 November's set of team legs alone has the pool below, pairs alone and no pl)
      pool: { legs: [ [ <leg key>, <DraftKings' price>, <the model's chance, kept whole> ] ],
              pairs: [ [ <leg>, <leg>, <their joint chance>, <their price> ] ], band, far, noId },
      tiers: [ { id, label, min, max, price, legs: [ <the builder's own leg> + name, label, p, fair, fair_est, thin, market ],
                 p, fair, fair_est, dec } | { id, label, min, max, price, why } ] x3,
      taken_at[, grade: { <level>: { result, legs: [win|loss|push|void|null ...], payout } }] } } }
```

The pool is kept so the guard can work each level out again on its own, its chances and prices whole, as the search
ranked them (until 7 November 2026's review they were rounded to 6 places, so two parlays the page told apart by less
than that read as level to the guard, which then ranked them by the tie's rules and refused a correct set). While a
night's lock is to come a run rewrites its entry whenever the set has changed (lines read), keeping it otherwise; from the
first run at or after the lock it stands as the last run before the lock left it, and nothing changes but its grade. No
set is taken of a night DraftKings has posted no line for ("no set of <night>: DraftKings has posted no line for its games
yet"), and one an earlier run took stays as it was. A night once locked stays locked: an entry whose own lock has passed
holds its night though ESPN moves the first tip-off later ("<night> (locked at ...) held: its first tip-off moved after
the lock, and no new set is taken"), and one whose night has locked at a first tip-off moved earlier is kept as it was.
An entry not yet locked whose night is still to lock at another first tip-off (moved before the lock) is dropped, and the
night taken again at its new one. From the first tip-off each level is graded by the page's
own settlement (`NBA_GRADE.legResult`, the one X Parlays grades by), leg by leg as its games finish: a leg lost loses the
parlay at once, as a book settles it, though another leg's game is still to play; a push or void drops out as a book drops
it, the rest paid at the builder's own price on the legs left (`parlayDec`); every leg a push or void is a push, the stake
back; otherwise pending while a game is out. A grade once complete is never undone by a state that can no longer settle it,
and another season's entries keep theirs. `night_summary` counts each season's night and level once, from the last key,
as the pills do.

The `featured` map, the per-game sets of the rule before, stays as it was taken and graded: the job takes no set there any
more, a set still to lock when the change ran is dropped (no longer offered, as the job always dropped such a set), and the
rest stand, graded as before (a set taken before 5 November 2026 with Extreme, `THREE_FROM`, the cutover, its rules in
`tools/suggest_check.js`), `featured_summary` keeping their record and Extreme's under its own key. Run on a scratch copy
of 7 November 2026's committed files at 18:53 UTC, the new page and job dropped the three per-game sets still to lock that
day (Nuggets at Pacers, Knicks at Cavaliers, Lakers at Pistons), kept the other seventeen as they were, took Saturday's
night set (7 games, 30 legs in its pool), took none of Sunday's ("no set of 2027_20261108_NIGHT: DraftKings has posted no
line for its games yet"), and the guard passed it held to the committed file.

`tools/suggest_check.js` is the guard, its rules worked out on its own from the file, the clock and the last commit's
file; since `NOCAP_FROM` (8 November 2026) a night entry's levels are the new rule's (2 legs or more, no most, $2, $4,
$8) or, on a set taken before it or held so by the file it is held to, the old rule's (`NIGHT_LEVELS_OLD`), its heads
saying which, and its own enumeration (`nightBest`) takes options of any size and leaves a branch by its own frontier of
what the later games' options can land and return (the page's (6) on the pool's own figures); since `PLAYER_FROM` (10
November 2026) a night entry's levels are the rule with a player's (their heads carrying `need: 'player'`, each level
holding a player leg wherever its pool makes a parlay holding one, else saying why, `nopl`), or, on a set taken before it
or held so by the file it is held to, the rule it was taken under (`NIGHT_LEVELS_NOCAP`, `nocapOk`): "At least one player
leg", above. The rest of it, as before.
A night entry: keyed on its own season, date, first tip-off and night id; its night id its season's and date's; each
game's id of its season, date and clubs, never preseason, tipping on the night's Eastern date (Intl); its tip-off its
games' first and its last their last; locking exactly 2 hours before the first; taken before the lock; its levels the
three in order with their labels, ranges and floors; each level's legs games of the night, team legs alone on a set of
the team rule, and on the player-leg rule's (from `PL_FROM`; a set of team legs alone taken since is refused) team legs
and players' main lines over or under with both prices on a stat the page offers, no leg twice, one side and one total a
game and one leg a player, a count within its range, each in the entry's pool at its own price and chance, its chance
and price its legs' as the pool has them (a game's two legs at the pool's joint figures), its price at its floor or over;
and, by its own enumeration of every parlay the pool makes (`nightBest`: each game nothing or one of its options,
multiplied across games), no parlay the rule ranks above it (likelier, or level within `NIGHT_TIE`, the page's own
tolerance, and dearer, fewer or first by ids) and no level empty where a parlay meets its rule; no pool of no leg and
none left out (a set taken before DraftKings had posted a line of the night); no second set of a night taken at or after
another set of it locked; no grade before the first
tip-off, every grade following its legs (a loss pays 0 though a leg is still out; a push 1; a win over 1 and exactly its
price when every leg won, and with a leg dropped, a push or a void, at most the legs left's prices multiplied and exactly
that where each game is left one leg: until the review of 7 November 2026 any payout over 1 passed, routine voids now that
a player who does not play voids his leg); against the previous file, the night map there wherever that file has one (a ledger that
drops it and its summary passes no night rule by having none), no locked night gone or changed in anything but its grade, no other
entry new or changed but by this run before its lock, another season's grade never redone; the summary the entries'. The
per-game entries are held to their own rules as before. The script runs it against the file it started from and, where
that differs, the last commit's, and refuses to write (exit 1, the file put back, the last commit's where the file on disk
had itself moved a locked entry); the job then runs it again from the command line against the last commit.

In the job, after the tests (it needs their `npm ci` for jsdom): `node tools/test_suggest_ledger.js`, then one clock read
(`now=$(date -u +%Y-%m-%dT%H:%M:%SZ)`) handed to both `SUGGEST_NOW=$now node tools/suggest_ledger.js` and `SUGGEST_NOW=$now
node tools/suggest_check.js`, so the check reads which sets are locked at the instant the script rewrote or froze them; a
failure marks that step alone, puts the file back as committed, and turns the run red at the end; the record never holds
back state.json or the data, and is committed with the data from `main` alone (README "Runs"). Timing: GitHub starts this
repo's runs 3 to 9 hours late, so the locked set is the last run's before the lock, possibly hours before it, or the night
before (the job takes the next night's set too); a night no run reached before its lock has no entry (each visitor's page
then shows its own set, said so).

### The checks

**At least one player leg** (the owner's call of 10 November 2026). The record's test runs every night of its own on the
rule: its own enumeration takes each night's player legs beside its team legs (its own reading of DraftKings' main lines,
the props model's rows and the report) and ranks every level by the rule's word (`levelsP`: every parlay by brute force,
the likeliest holding a player leg where any meets the level, else the likeliest of all and the why it works out itself,
`noplOwn`), so A, B and D (D1's night holds two players' lines: every level holds a player, and on A the rule before would
take team legs alone on a level) and T, N, Q and U (no player line: every level the likeliest of all, saying "lines") hold
it, with P, X and W; and Y: Y1 three games whose rule before takes team legs alone on Safe, the levels each holding a player,
the kept pool making every level again by the guard's own enumeration with the rule's word, and the guard refusing a level
with its player leg taken off, a why on a level holding a player, and the same set under the heads of the rule before taken
after `PLAYER_FROM`; Y1b a page with the word dropped (every level the best of all, saying "no player leg fits") refused at
the take by the guard's own reading of the run's files; Y2 no player line posted ("lines") and Y2b lines posted with both
players listed Out ("fit"), every level built, never empty for want of a player, and a why that is not its pool's refused;
Y3 a one-game night, every level a group of its legs holding a player; Y4 the cutoff on the real record's sets of the rule
before (held as the guard holds them; one taken after `PLAYER_FROM`, as the job's runs from 18:47 UTC on 10 November
2026 took that night's, refused with no file to hold it to; one taken before it standing as it was taken with no file to
hold it to, re-dated after `PLAYER_FROM` refused, and kept where the file it is held to holds it so); Y5 a level built
again after the lock under each rule, the rule with a player's and the rule before's (heads without `need`, taken before
`PLAYER_FROM`), each its own enumeration's under its rule and the guard passing; Y6 a night of ten games with DraftKings'
game lines and no player line, as the read a day ahead has them: every level "lines", the job (its own check of the guard
included) within 120 s and `suggest_check.js` within 60 s, and the guard's walk for a parlay holding a player finding none
on the kept pool in milliseconds. The smoke's own enumeration (`ENUM_OWN`) carries the word (its levels the rule's, and
the rule before's beside them), so every level it holds is the rule's: its made-up night (where the word moves Medium and
Aggressive), the players listed and the lines with no margin, the one-game night with no player line (Safe "likeliest
paying $2+ · no player lines yet", word for word), the fair-pair night, the eight favourites at -900, the 36 random nights
(the page's levels by `spRule`, as `spBuild` takes them), the 15-game night and the real night (the guard's own reading
with the word); the cards' rule words on its own reading (`ruleOwn`, `noplOwn`), and a kept level drawn back in its own
rule's words ("likeliest paying $8+" for the rule before, "with a player", "· no player lines yet", "· no player leg
fits"); since the review of 10 November 2026 each rule's title word for word (`titleOwn`: the only place the page states
the rule whole, on the live cards, the kept levels of each rule and the one-game night's fallback), and a live night whose
player lines are posted with every player on them listed Out, each card "· no player leg fits".
`tools/test_suggest_speed.js` holds every level as `spBuild` searches it (`spRule`) to its answer and to holding a player
leg, with 10 November's night and the long shots' night added.

The rule's breaks, each planted on a copy of the tree (the page built again where it is the page's), each turn the checks
red: the word dropped (`spRule` returning the best of all, still headed "with a player": the record's
test 13 of 17, the job refused at its first run and the test stopped; the smoke 15; the speed test 18 of 137); the fallback
dropped (a level left empty where no parlay holds a player: the test 13 of 17, the job refused, "empty, and the pool makes
a parlay its rule takes", on a night with no player line; the smoke 2, one a throw; the speed test 0, every fixture night
having player legs); the guard accepting a level of team legs alone where its pool makes one holding a player (its check
taken out: the test 2 of 306, Y1's planted level and Y1b's page with the word dropped written; the smoke 0); the cutoff
reversed (`nocapOk` taking the rule before from `PLAYER_FROM` and refusing it before: the test 3 of 306, Y1 and Y4 twice;
the smoke 0); and a bound that prunes the winner with a player (a branch needing a player leg bounded by the later games'
player legs alone, `maxPLfrom[j + 1]`: the test 13 of 17, the job refused by the guard's own reading at its first run; the
smoke 8, 12 of the 36 random nights differing; the speed test 4 of 137, 7 November's Safe and 10 November's three levels).
The review's, the same way: the guard's let-go where no later game has a player option taken out (the record's test 2 of
308, Y6's job killed at its 120 s bound with no entry); the rule's title saying the opposite ("holds NO player leg": the
smoke 4, every title it reads); the title's wording before the review ("at DraftKings’ fair chance" read as the level's
chance: the smoke 4); and the why always "lines" (the smoke 1, the live night with every player Out; the record's test 1 of
303, Y2b refused by the guard).

**No leg limit** (the owner's call of 8 November 2026). The record's test runs U, a night of fourteen heavy favourites
(home moneylines at -900 and -700, the model's 92% and 90%, two with a total): the job's Safe takes 6 legs to pay $2
(2.048) and its Medium 12 to pay $4 (4.076), each the likeliest of the test's own enumeration of every parlay with no leg
limit, one side and one total a game at any depth, and a cap of 5 (with Safe a pair) taking other parlays on the same
pool; a night of the floors' very edges (-500 with -150 pays exactly $2.00 and is Safe, -500 with -155, as likely,
pays 1.974 and is not; +100 legs make exactly $4.00 and $8.00); P, two games of player legs, where Aggressive holds four
legs of one game (its moneyline, a player over, another's under and the total) and the kept pool makes every level again
by the guard's own enumeration; Q and X re-priced so a pair pays $2 (OKC -200 and ATL -170 a near tie apart by 6e-7; a
fair same-game pair at -150 and -150 paying $2.36 at the hold); and the sets taken before `NOCAP_FROM` (the real record's
7 and 8 November, of the old heads, passing the old rule's checks; the 8 November set re-dated after `NOCAP_FROM`
refused, and kept where the file it is held to holds it so; its Medium of 6 legs refused, outside the old 2 to 5; and its
levels under the new heads refused, Safe a pair paying under $2). The smoke's own enumeration (`ENUM_OWN`) takes every
option of a game, of any size, worked once by the builder's own sums, and leaves a branch only where its chance is under
the best (1), on its made-up night, its one-game night (Safe its side and total, now paying $2 or more; the empty levels'
pill "2+ legs"), the fair-pair night (re-priced as X), a night of eight favourites at -900 whose Safe takes 7 legs (one
leg a player at that depth, two Unders of one player beside them) and 36 random nights; its real-night check holds the live levels to
the guard's own reading of the real files (`nightFull`, `nightBest`), where until then it enumerated every parlay of
the real night by brute force, which on 8 November 2026, the first night DraftKings posted player lines for before the
lock, ran the job's runner out of memory (14:32 UTC: "tests failure, suggestions record skipped"), so no run took
Sunday's set on its player lines.

The no-leg-limit rule's breaks, each planted in `app/parts/suggested.html` on a copy of the tree and the page built
again, turn the record's test and the smoke (`SMOKE_ONLY=sp`) red: a leg cap of 5 put back in the walk, the levels still
saying no limit (test 1 failure, U refused by the guard, which finds likelier parlays of 6 and 12 legs; smoke 1, 3 of the
36 random nights differing); Safe ranked without its floor (test 4: U, P and the real files refused, "pays under its floor
2"; smoke 7); a cut that assumes the cap, a game's group grown to 3 legs at most (test 3: P's Aggressive, four legs of one
game, not the test's own enumeration's, and the test stopped; smoke 1, Aggressive on 8 of the 36 random nights differing); and the kept pool dropping every group
of four legs or more (test 2: the job refuses P, "a leg, or a game's legs together, not in its pool"; smoke 0: no level on its nights holds a group of four legs, so the record's test is the check that bites).

**The review of 8 November 2026.** The record's test runs W: W1, four games of heavy player Unders (-865 to -915) whose
Safe is 9 legs, a group of four of one game and one of three among them, each level the test's own enumeration's of
32,752 parlays, and the page with a leg limit of 5 put back (in the walk and the greedy start) refused by the guard's
own groups ("empty, and the pool (this file's own reading of the run's files) makes a parlay its rule takes"), where
ranking the kept pool alone it passed; W2, the page that keeps the record's pool without its single player legs refused
at the take ("its pool as kept"), not first at the lock; W3, a set of the old heads holding a player (taken before
`NOCAP_FROM`), listed Out after its lock, its levels built again under the old rule with their heads kept and the guard
passing it; W4, a planted table that is not positive definite, where Medium is three Unders of one game with the other
game's moneyline (28.7% for the three, where two of them land 26.7% at the table's own -0.6) and the guard passes the
kept group of three. Test U holds the real record's old sets as the guard holds them (`oldOk(e, e)`), so a set of the old
heads a run of the page before the change took after `NOCAP_FROM` never jams it. `node tools/test_suggest_speed.js`
holds the search's time ("Its time", above), and the smoke runs it on the heavy-favourite nights. Each fix's break,
planted on a copy of the tree, turns them red: the guard's own groups taken out (test 1, W1: the run with the leg limit
put back written); the take's check of the kept pool taken out (test 1, W2: written); test U holding the old sets by
`taken_at < NOCAP_FROM` again (test 1); `spLvOf` reading no head (test 1, W3: the levels built again under the new
heads); no game counted as shrunk on the page (test 2, W4: the page misses the three, and the guard refuses it); the
guard's cap at the table's own correlation (test 2, W4 refused); and the search as the review found it (the speed test
30 of 80: every game alone's Medium over 8 s, Aggressive over 30 s, every heavy-favourite night's Aggressive over 12 s).

`node tools/test_suggest_ledger.js` (about 40 seconds, "N checks passed") runs the script itself on made-up November days
of its own (a state, lines.json and box file in a scratch folder, the clock set), never the real ledger, and works every
night, pool, level and settlement out on its own (the pool from its own reading of the made-up model and lines; each
level by its own brute-force enumeration of every parlay the pool makes, at chances and prices it works out itself with
`tools/corr.js`'s copula and the same-game hold; never the page's search): M the migration (a ledger of per-game sets
alone, one still to lock: that one dropped, the rest kept but for their grades, the night map added, the guard passing it
held to the file it started from; the per-game settlement rules on planted entries, a moneyline, a whole-line push, a
player with no box line void, the same-game price on two legs left, a box not read pending, a grade kept, last season's
never redone, Extreme's record); A the morning of D1 (a night set for D1 and D2 and none for D3, keyed, every game of its
date but a preseason one, its pool the test's own with no player leg though the props model prices two, the same-game
copula met, each level the test's own enumeration's); B prices moved (rewritten; the other night unchanged; the same again
nothing written; a second before the lock rewritten); C after the lock (the set to the byte, a game moved after the lock
changing nothing; after the first tip-off every level pending); D the night played with one game still out (each level
graded as worked out here, lost at once where a leg lost; the one-game night's Safe its side and total and its Medium and
Aggressive empty, word for word), the last game final (every level settled), the summary; E no game to come; F the guard
(a locked night edited on disk refused and the last commit's put back, one still to lock rewritten not refused, no state
refused, a page whose levels are not the three refused, the command line, the job's one clock; `check()` on hand-made
ledgers failing every night rule and the per-game rules); T a night of exact ties (four games alike, three pricing the
likeliest leg at -105 and one at -115: Safe and Medium the dearer, then the first by ids; Aggressive the four); G the real
ledger, copied, on the real state and lines at the real clock: nothing refused, every locked set as it was.

`SMOKE_ONLY=sp node tools/smoke.js` (`tools/smoke_suggested.js`), blocking, boots the built page on a made-up November of
its own, the page's clock moved to each moment a case needs, so it holds at any hour, the off-season included, and works
every rule out on its own: nothing read before the tab opens, then the record and lines.json once each, no-store, and
nothing else; the tab after Tonight at `#suggest`; the night set out (`nightOwn`, through Intl, America/New_York), its
games every game of the date but preseason, its head; the wait line's instant, games and words, the 6:00 AM turn redrawn
by the half-minute look, the two Sundays the clocks turn, no game to come and a preseason game alone; the pool (its own
reading); each level against its own enumeration of every parlay the pool makes, each one's chance and price the builder's
own `parlayProb` and `parlayDec` on its legs (10,634 parlays on its made-up night; 113,537 on 7 November's real one); the
floors, one side and one total a game, the fair chance; each card's rule in words, its legs' games, the payouts on the Bet
amount and following it, the Value mark, no on-trial mark, the cards quiet, the lock line word for word, every control
44px; the same set after the props model's FAIL; a one-game night's empty levels word for word; ties on the page's own
search; a night of 15 games built in under 2 seconds and held to the guard's enumeration; Add, Added and a second press,
Add to builder and the builder paying the level's price, Finish and its card, the focus on closing it; this browser's own
set at the lock, its line and its key (`v: 2`, a per-game value taken out), nothing else stored, lines.json not there
(never kept), a reload with the prices moved showing the same set, a locked leg's Add at its locked price, the record's
set taking its place after waiting for its read, a level the record took empty, under way (no Add, Add to builder or
Finish; with no set, none built), the night leaving the tab and the key at its last tip-off; the pills from a made-up
record, the real one and one with no night map, every number and title its own, the per-game record in each title, a junk
record drawing nothing; and the real files, on what the day offers (the real night's live levels against its own
enumeration where it is live).

**The guard's own reading** (the review of 7 November 2026). The pool the record keeps is gathered by the page's own walk,
so a branch that walk wrongly let go would leave a leg out of the pool, and an enumeration on that pool alone would agree
with the page. So for a set of the player-leg rule the run took (new or changed since the file it is held to, its lock to
come), and a level the run built again, the guard reads the run's own `lines.json` and `state.json` (the job hands them to
`check()`; the command line reads the checkout's, or `SUGGEST_LINES` and `SUGGEST_STATE`) and works out on its own every
player leg of the night's games still to tip (`plOwn`: its own copy of each rule above), holds the pool's counts and
every player leg it keeps to that reading, works every two legs of one game that go together out by its own copy of the
builder's two-leg sums (`pairOwn`: `tools/corr.js`'s `joint2` at its `rhoFor` correlation, the page's line for line, the
price the lower of the two prices multiplied and the hold over their implied joint chance), holds the pool's pairs to
them, and ranks each level again over every leg alone, every such pair and the pool's groups of three legs or more of one
game (each held under its own pairs' chances): `nightFull`. So each level is the best its rule takes over every parlay
whose games each give one or two legs, worked out from the files alone, and a parlay holding three legs or more of one
game is ranked over the groups the record keeps, which the page's walk gathers, and over groups of its own (next).

**The guard's own groups** (the review of 8 November 2026). With no leg limit a level often stands on three legs or more
of one game, and a page that missed a deep winner (a leg limit put back, a cut too keen) would keep none of its groups,
so ranking the kept groups alone the guard passed the level it took, or a level left empty: with a limit of 5 put back,
a night of heavy Unders whose Safe is 9 legs was left empty and the guard passed it. So `nightFull` builds groups of its
own in every game whose table is positive definite (`gamePosDef`), on its own copula (`ownJoint`: three legs by
Simpson's rule over the first leg's normal with `bvnUpper`, four or more by a GHK sum on its own 10,000 Halton points),
priced as the builder prices a game's legs (`ownFig`): each game's chains (its legs that go together taken greedily, the
likeliest first, and again the best return on $1 first, every prefix of three legs or more up to 12, a chain stopping
once its chance is under the least level's or it pays $8), and each level's own groups of a game grown by one of the 12
likeliest legs of that game that go with it (`ownGroups`). It is not every group, but it is what a deep winner is made of
on the nights that hid one. Its figures are its own and not the builder's GHK sum, so each counts 0.5% less, its chance
and its price (`OWN_TOL`): an own group outranks a level, or fills an empty one, only by more than the two sums can
differ. A game whose table is not positive definite gets none (there the builder shrinks a group's matrix, which the
guard does not copy) and its kept groups are capped by two of their legs at max(rho, 0), the page's own bound there. On 7 November 2026's 16:58 UTC files
at 18:00 UTC it takes about 0.2 s (922 player legs, about 60,000 pairs); on the smoke's made-up 15-game night about
0.15 s. A replacement after the lock is held to the state of the run that made it (each run commits, so what is new since
the last commit is that run's): it names a player that state lists (`plListed`, the page's own rule), and the level built
again holds, in its own pool, no player the state holds out or the props model does not place.

**Player legs** (from `PL_FROM`). The guard holds each player leg of a pool to its own reading of
DraftKings' fair chance (`plFair`: the Over 1 less the Under's implied chance, the Under that implied chance), the band
and its key's shape (a main line, over or under, its other side's price on file), and, while the set is still to lock,
no player the state's report lists (anything but Probable), on a game's out list, or not placed by the props model on one
of the game's clubs (`plHeld`); each game's legs together (`pairs`, and `sets` of three or more) at a chance no greater
than any leg's and a price no greater than their prices multiplied; a level built again after the lock to its own pool,
which holds the player nowhere, its mark the last of the entry's `updates`, each made between the lock and the first
tip-off; and its own enumeration (`nightBest`) on whichever pool the level stands on. **The pool the record keeps is
compact**: every team leg and each game's side and total together, as before, and of the player legs and games' legs
together only those in some parlay within 1% of a level's chance (`SP_NEAR`, gathered by the same walk), so the guard's
own enumeration on it finds every level again; on 7 November 2026's files at 18:00 UTC that was 11 player legs of 922
(`cut` 911), 41 legs in all, 32 pairs and no set, 4,346 bytes of an 8,561-byte entry (on the committed 20:17 UTC files at
19:30 UTC: 3,963 of 8,234; the 15-game night's pool: 101 legs, 11,210 bytes); `pl` counts the player
lines read (`lines`), out of the band (`band`), held out (`held`), placed on no club (`none`), priced with no margin
(`vig`, with the pool's own `vig` for a total) and left out of the kept pool (`cut`).

`node tools/test_suggest_ledger.js` section P runs the job on a made-up night of two games with player legs: five player
legs in its own pool beside the team legs (a player listed Questionable held out, a line priced on the Over alone, a
milestone and a Yes market taken nowhere), each level the likeliest of its own enumeration of every parlay (2,178; each
game's legs together by its own copula: two legs by `tools/corr.js`'s `joint2`, three or more by conditioning on the
first leg's normal, Gauss-Legendre in six panels of 20 points down to the bivariate, held to Simpson's rule on three
legs to 1e-10), the levels mixing team and player legs and a game's legs together, the pool kept compact and making every
level again by the guard's own enumeration, the guard passing it and failing each break planted on the entry (a player's
leg at the model's chance, two legs of one player, a milestone, a player listed Questionable in the pool, a pool
compacted past a leg its level needs); after the lock a player of two levels listed Day-To-Day, those two built again
without him, each its own enumeration's, marked and recorded, the third to the byte, the guard passing, a later run
building nothing again, a replaced level still holding him failed by the guard, and nothing built again from the first
tip-off though another player is listed then; played, every level graded from the box lines (a player with no box line
void and a whole line pushing, each dropping out, the rest paid by its own sums), the guard passing. The smoke's own pool
reading takes the player legs (`poolOwn`), its enumeration one side, one total and one leg a player a game, and it holds a
player leg's words on the card, the chance line's words and title, a player listed Day-To-Day or Questionable left out
and a Probable one kept (each night the enumeration's), the after-lock rebuild on the page (this browser's own, its line
word for word, kept and shown again on a reload, given way to the record's replacement with the browser keeping nothing,
built by the page over a record's set with none, nothing after the first tip-off), and the 15-game night with 1,200
player lines, held to the guard's enumeration and its own reading of the files, its time said (and held only under 15 s,
far above a runner's noise: until the review of 7 November 2026 a 2-second bar in the smoke that gates the publish ran at
80% of it here). Since that review: a fair same-game pair that moves together beating every pair across games, and 36
random nights of made-up legs, each level held to the smoke's own enumeration (`bruteOwn`); a main line and a total
priced with no margin left out and counted; the parlay card's chance words for a team, a mixed and a player level; and,
after the lock, a level the page built again standing under way, a level holding a listed player closed with its line, no
level built again from no lines and none kept, and a kept replacement with no legs never applied. The record's test (X)
takes a night whose likeliest pair is a fair same-game pair through the job, every level its own enumeration's; holds the
guard's own reading passing the job's sets and failing a ledger whose winning player leg was cut with its levels the
runner-up (which the kept pool alone passes), a line priced with no margin in the pool, a replacement for a player the
run's state does not list, a level built again on a pool holding a listed player, and a win with a leg dropped paying its
whole price, over it or barely over 1.

Breaks planted in scratch copies (`NBA_HTML` for the smoke; a copy of the tree for the test) each turn them red: the
floors loosened (a level at 85% of its price floor taken: the job refuses the ledger, the guard saying the level pays under
its floor), the likeliest rule turned (the dearer parlay first: the guard and the test's enumeration find likelier ones),
one side and one total a game broken (a game's moneyline and spread paired: the guard refuses the pool and the level), the
page's lock moved to 3 hours (the job refuses the page), and the guard's own lock rule switched off (the test's locked
night edited on disk passes, and the guard's hand-made locked-night cases pass). Counts are in the commit that made the
change.

The player-leg rule's breaks, each planted in `app/parts/suggested.html` on a copy of the tree and the page built again,
turn the smoke (`SMOKE_ONLY=sp`) and the record's test red: a player leg at the props model's chance in place of
DraftKings' fair chance (smoke 3 failures, the 15-game night taking 239 s; the test 13 of 17, the job refused at its
first run); two legs of one player in a parlay (smoke 5, test 2: the job refused, "two legs of one player"); a milestone
admitted at its estimated fair chance (smoke 16, test 2); a player the report lists Questionable or Day-To-Day admitted
(smoke 6, test 4: after the lock the level built again still held him, and the guard refused it); the kept pool dropping a
player leg a level needs (smoke 1, test 2: "not in its pool").

In Chromium at 1280 and 390 wide on 7 November 2026's committed files at the real clock (Saturday's 7 games, live): one
set, three cards three across at 1280 and one a row at 390, no sideways scroll, every control 44px or taller, and no
script error. With player legs, on the 16:58 UTC files of that day at 18:00 UTC: Medium holding Tari Eason's Under 1.5
threes, "fair 64%" at 6.0:1, its chance line "model + DraftKings 29%" at 7.1:1, no sideways scroll at 390 or 1280, every
control 44px, no script error; its parlay card reads "Fair chance all 3 land 22.9%" over "ranked at 28.7% (model on team
legs, DraftKings on player legs) · the price says 25.0%" (until the review of 7 November 2026, "model + DraftKings says
28.7%"), its small print saying what a player leg is, and lists his leg to add by hand on DraftKings.

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

`.github/workflows/update.yml` is queued at 07:17, 11:17, 13:17, 16:17 and 19:17 UTC. GitHub starts this repo's
scheduled runs 3 to 9 hours late, so they land from the morning to the late evening Eastern: the first
for last night's finals and box scores, the next two for the day's lines and injury report, and the last two (added 25
October 2026) nearer the evening locks of Suggested Parlays' sets, 2 hours before tip-off, which the record keeps as the
last run before the lock left them (README "Suggested Parlays"). Each run reads
from the earlier of the first day in the last three weeks with a game not final (today included) and the day
after the last final, to thirty days ahead; then the new box scores, the injury report, the coaches and
rosters, the team and player models, the three game models ported from the NFL hub and the calls ledger, and
publishes. A game's line and its logged number are frozen at its tip-off, so a run
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
DraftKings' lines on the next two dates' games into `lines.json` (README "The lines feed"), then runs the feed's test
(`node tools/test_lines.js`) whatever the read's exit, as the models' steps run theirs: a test that fails puts
`lines.json` back as committed (removed where it is new) and turns the step red, so a broken reader never publishes its
prices to every visitor while the run is red; the read's own exit is kept past the step's `bash -e`. Otherwise it is
committed with the data whenever the pull succeeded (added only once it exists: until the feed's first read there is
none); when nothing answers the file stays as it was, and when every game-lines or every props read fails that half
keeps its last good reads; either way the step is red.

After the player model, the three game models run one step each (`node tools/alpha.js`, `node tools/joker.js`, `node
tools/elo_model.js`, each followed by its test whatever its exit): a model that cannot run keeps its last calls, says
why and the file is committed, the step red unless it is the Joker's planned refusal; a test that fails puts the model's
file back as committed. Then the calls ledger (`node tools/calls.js && node tools/calls_check.js`, both handed the run's
one clock as `CALLS_NOW`, README "Pick'em Record") freezes each model's call at tip-off; a failure puts `data/calls.json`
back as committed. `publish.js` reads
both into `pickem.json`, committed with `state.json`.

After the pull, each step may fail on its own: the data folder and the model files are committed whenever the pull
succeeded, and state.json and the pages only when publishing and the tests (`tools/test_fetch.js`,
`tools/test_fetch_box.js`, `tools/test_props.js`, `tools/test_corr.js`, `tools/test_lines.js`, `tools/test_calls.js`,
`tools/test_gamewin.js`, then the page's smoke test on the new state)
pass; the run is red when any step failed. After the tests, the suggestions record (`tools/test_suggest_ledger.js`, then
`tools/suggest_ledger.js`, then `tools/suggest_check.js`, README "Suggested Parlays") takes, locks and grades each
night's set into `data/suggest_ledger.json`, committed with the data; a failure marks that step alone and puts the file back
as committed. The page says when the injury report is older than the file it came in. On
demand the job takes a date range and a refit switch. A push that changes the tools or the app runs it once (on a
`claude/` branch too, committing there and in its own queue, all but the two frozen ledgers, `data/calls.json` and
`data/suggest_ledger.json`, which the commit step puts back as committed on any ref but `main`, since only the site's own
record may hold a call or a set as published; the schedule only fires from `main`).

Local:

```
node tools/history.js      # once; downloads the history file (or --file path/to/nba_elo.csv)
node tools/fetch.js        # needs ESPN reachable; --from / --to for a range
node tools/fetch_box.js    # needs ESPN reachable; --from / --to for seasons, --budget minutes
node tools/elo.js          # team model replay; add "fit" to refit
node tools/players.js      # player model replay; add "fit" to refit
node tools/lines.js        # needs ESPN reachable; DraftKings' lines on the next two dates' games -> lines.json
node tools/alpha.js        # the Alpha Model's calls; "fit" refits by hand, "research" walks it forward (by hand)
node tools/elo_model.js    # the ELO Model's calls; "fit" refits by hand, "research" re-scores its walk-forward (by hand)
node tools/joker.js && node tools/test_joker.js   # The Joker: score the season in play with its frozen trees -> models/joker.json, then its test, whole
node tools/joker.js research   # by hand: its walk-forward -> research/joker.json; "fit" refits the live trees (refused mid-season if it reads that season; --force)
node tools/backtest.js     # by hand: the walk-forward against data/odds_hist.csv -> research/backtest.json
```

## The site

`index.html`, its own look: graphite blue with an orange accent, bold display type, faint court lines, team-coloured badges; one card per game. Tabs:

- **Tonight**: a day strip from yesterday to ten days out. Each card has the two teams (the model's pick
  lit), the model's win chance with its **confidence** under it (below) and a probability bar, the spread and total, the market
  line with a chip saying how far the model's spread is from it, who is out on each side and what
  it costs in points, a lineups drawer with projected minutes and each player's contribution and the
  coach (the two sides side by side on a wide card, one above the other on a narrow one, so nothing is cut
  off), a Parlay Builder button on each game the builder lists that opens it with that game alone ticked, and a
  Player props button that opens the game's own page, laid out as the NFL hub's game page: its head card, Game bets
  and a row a player, the model's projections and DraftKings' lines as published or read by Refresh odds (README
  "Player props"; the model on trial). Finals
  show the score and whether the model hit. Before the schedule appears the tab counts down to
  opening night over the preseason board.
- **Confidence** (the owner's question of 7 November 2026: "is there a way to show me what confidence level each game is?
  I assume its 78% is the confidence level but i dont know if its low med or high"): the page has one scale, the
  confidence band the Parlay Builder already drew on a leg and the Pick'em Record bands Vegas by (`band`, the NFL hub's
  game confidence): **High** 75%+, **Med** 60-74%, **Low** 55-59%, **50/50** under 55%, on the chance rounded to a whole
  percent, as `fmtPct` shows it, so the band and the percentage beside it can never disagree (74.5% shows 75% and is
  High; 74.49% shows 74% and is Med; a home chance of 0.455 shows the away side's 54% and is 50/50). Each card with a
  number wears its band as a pill under the percentage and the pick (`confPill`: High lime, Med orange, Low ice, 50/50
  neutral, as the builder's bands are), worked on exactly the chance the card shows, titled and read aloud as
  "Confidence: High, the model gives its pick 75%+. Its High picks this season: 24-4." Over the cards, wherever the day
  shown has a card with a number, one key line (`confKey`): "Confidence · W-L this season" and the four bands, each its
  range and this season's record of the model's picks in it, straight up, from state.json's `record` (each graded game
  on the number published before tip-off, a tie left out; a band with no graded game shows no record). On 7 November
  2026: High 24-4, Med 34-19, Low 9-12, 50/50 10-11. It wraps on a phone; the Record tab's By confidence table is on the
  same bands, in the same words. The smoke's section `conf` (`SMOKE_ONLY=conf`) holds it on its own copy of the scale
  (`CONF_OWN`, never the page's `band`): every card's pill against the percentage the card shows (its band, word, title,
  spoken text and place under the pick), on twenty made-up chances at the scale's edges, home and away, and every day of
  the real state's strip; the key's words and records worked out from the record, on a made-up record in every band (its
  edges and a tie among them), one with a band of ties only and one empty, before anything is graded and on a day with no
  number (no key); the pill's colours on the stylesheet's own rule text, since jsdom resolves no `var()` (each band's
  colour this file's and its rule the builder's `.pb-conf` twin's, colour and border, and no other rule colouring a pill,
  50/50 among them); and section `record` the By confidence rows and their pills on a made-up season with a game at each
  edge, and `window.NBA_RECORD` (the tab's scale and tally) against the same copy: its bands' names and ranges, each
  chance's band, the edges among them, and each band's record. Breaks planted in a copy of the built page (`NBA_HTML`), each turning it red: the pill on the unrounded chance (7
  failures: the edges and four real days), the key counting a tie as a loss (4) and on the unrounded chance (the real
  record's games at 74.95% and 54.99% moving bands, High 24-3 and Med 34-20, 26 failures), the old 70/60/50 table (4),
  Med's and Low's colours swapped (1), 50/50 given a colour (1), and `NBA_RECORD.band` on the home chance alone (2).
- **Refresh odds**, over Tonight (the Parlay Builder has its own in its controls and its builder, Suggested Parlays at its head): the job's lines are as old as its last run, so a
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
- **Pick'em Record** (`#pickem`, between Coaches and Record): every game model's straight-up record this season against
  Vegas's, on the calls each published before tip-off (`data/calls.json`): Vegas's tiles, Wins against Vegas, the
  week-by-week grid and Show every pick. It is read from `pickem.json` when the tab is first opened, never on load or on
  a timer (README "Pick'em Record").
- **Record**: the NHL hub's record, laid out as its Record tab (the owner's call of 31 October 2026, "simple and
  cleaner"): **The model's record**, a short note, five tiles (straight up, the straight-up rate, and the moneyline,
  spread and totals picks), **By month** and **By confidence** side by side, and **How it was fitted**. The calls are the
  Player Model's numbers as published before tip-off (`predictions.csv`). A pick is the NHL hub's rule: a side on the
  moneyline, the spread or the total wherever the model's chance beat the chance the book's price implies (its margin
  left in) by 5 points or more, worked out by `publish.js` into each game of state.json's `record` (`pk`, its rule in
  `recordRule`): the moneyline at DraftKings' prices as `games.csv` froze them at tip, the spread and the total at -110
  a side (the table keeps no price of theirs), a spread's chance Phi((m + h) / 14.5) for the home side at its line h, m
  the model's expected home margin, a total's Phi((t - line) / 19.1) for the over, t the model's total, both sigmas the
  model's own miss on the last finished season (`tools/sigma.js`); a push graded as one. Confidence is the model's
  straight-up chance on the page's one scale (High 75%+, Med 60-74%, Low 55-59%, 50/50 under 55%, each row led by the
  card's pill, which sits over its range on a phone so every column fits); until 7 November 2026 this table banded it
  70+, 60-70 and 50-60 as the NHL hub does, a second scale beside the cards'. The playoffs are a month of their own. How it
  was fitted gives the fit and the holdout as `research.json` publishes them, lineups known. The same rule on the
  walk-forward folds (`research/sigma.json`'s `record`) lost money on spreads and totals in each of 2023-24 to 2025-26
  and on moneylines in two of the three, so a tile in green is a run, not an edge. The earlier rules' backtest table,
  the latest games and the props model's shadow ledger (in each game's props sheet) are no longer drawn here.
- **Parlay Builder**: the NFL hub's (README "Parlay Builder"). Its choices (the Bet amount, Refresh odds, All, Teams
  only or Players only, five bet types and the games of the lines feed's two dates, under their day), the Top 50 lines
  they make from DraftKings' prices (`lines.json`, or a press's newer read), Value picks first, then the other lines
  with the game totals last, each ranked by what $1 is expected to make, every player's line marked on trial (none since
  the props trial was stopped early as a FAIL, 5 November 2026, README "Player props"), each with its own Add; and the builder under them: the visitor's own parlay, from the list or a game's Player props, priced by
  the same-game engine, DraftKings' fair chance first and the model's beside it, what the Bet amount returns, Finish
  parlay (a card to download, place at DraftKings or share, README "The parlay card") and Clear ALL. Every name on a leg
  opens its matchup bubble (README "The matchup bubble").

- **Suggested Parlays** (`#suggest`, after Tonight): one set a night across every game of the night (since 7 November
  2026; until then a set a game on national TV), Safe the likeliest paying $2 or more on $1, Medium $4, Aggressive $8,
  no leg limit (since 8 November 2026; until then Safe the likeliest pair and Medium and Aggressive 5 legs at most), on
  the night's team legs, set out from 6:00 AM Eastern, live until 2 hours before the first
  tip-off and then the record's locked set (or this browser's own, said so), with the record's pills and Refresh odds
  (README "Suggested Parlays").
- **X Parlays**: the parlays X placed at the book, the same on every device and read only, each followed live through
  its games; read from `liveparlays/parlays.json` and ESPN when the tab is first opened in a visit and on Refresh now,
  never on load before that or on a timer (README "X Parlays").

Nothing a visitor does reaches the published files, and the one thing the page keeps of its own making is a locked
Suggested Parlays set it built where the record had none (`nba_sp_lock_v1`, to the night's last tip-off, outside `M` and never sent
anywhere), which the record's set replaces as soon as a load reads one. The job runs `publish.js`, `build.js` and the
smoke test after the models, and commits `state.json`, `pickem.json`, `history.json` and both pages (`index.html`,
`admin.html`) when publishing and the tests pass. Whenever the pull succeeded it also commits the data folder
(`data/calls.json` and `data/suggest_ledger.json` among it, from `main` alone), the model files and `lines.json` (put
back when the feed's test fails), and `liveparlays/parlays.json` when a finished parlay of X's cleared itself (README
"Runs").

## What comes next, in order

1. **Style matchups**: the four factors each team forces and allows (shooting, turnovers, rebounding,
   free throws) as a fitted term on the residual, on top of pace and efficiency.
2. **The same-game hold**: the price of two legs of one game uses the NFL hub's hold, untested here (README "Same-game
   parlays"). A few real DraftKings same-game tickets on NBA games, recorded with their legs' own prices, would test it;
   until then it stays an estimate and says so. The props model's lines were on the Parlay Builder's Top 50, marked on
   trial, until the owner stopped its trial early as a FAIL on 5 November 2026 (README "Player props"), which takes
   them off.
