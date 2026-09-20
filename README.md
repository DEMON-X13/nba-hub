# NBA Hub

The NBA half of the hub: a team model, a player, coach and matchup model, a daily job, and (next) a betting page like `betting/`.
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
| `tools/players.js` | The player, coach and matchup model: replay, fit, report, tonight's lineups |

No dependencies: Node 22 and its built-in fetch.

## Data

- **History**: Neil Paine's continuation of the FiveThirtyEight NBA Elo game file
  (`github.com/Neil-Paine-1/NBA-elo`), every game since 1946 with scores. Seasons from 2005 on are
  kept. It runs to 2025-03-17. `history.js` maps its team codes onto this site's and folds defunct
  franchises into their current team (Sonics into OKC, Nets into BKN, the two Hornets into NOP and CHA).
- **From 2025-03-18 on**: ESPN's public scoreboard feed, the one the season tracker already uses,
  one request per day. It gives finals, the schedule about ten days out, the neutral-site flag (the
  Cup final), and a consensus line and total on games not yet played. Preseason and postponed games
  are dropped. The NBA's own stats site blocks cloud runners and is not used.
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
| home court | 60 Elo | 2.3 |
| altitude, on top | 60 Elo | 2.3 |
| back to back | -40 Elo | -1.5 |
| three in four | -5 Elo | -0.2 |
| three days off | +5 Elo | +0.2 |
| season carry | 0.70 | |
| scale | 26.2 Elo per point | |

Holdout (5,282 games): 66.2% straight up, log loss 0.617, spread error 10.9 points. That is what a
public NBA Elo does. It picks winners; it does not know who is playing tonight.

## The player, coach and matchup model

Every player carries two ratings, offence and defence, in Elo points for a player on the floor all
game. A team's strength for a game is 1500 plus its coach plus each player's ratings weighted by his
share of the minutes, five shares in all, so a team is exactly the sum of who plays and how much.
The situational terms (court, altitude, rest) are the team model's.

After a final, each side's offensive efficiency (points per 100 possessions, possessions from the
team box) is compared with what the ratings expected. The surprise moves the offence of the players
who were on the floor, by their minutes, and the defence of the players they faced, the other way.
The coach moves with the margin surprise, and carries his rating when he changes teams. A player's
first rating is his last RAPTOR (2020-2022, matched by name; 249 of the current players); a player
with none starts as a rookie, below average. Ratings carry part way toward zero each season.

Tonight's strength uses projected minutes: each available player's average over his last eight
appearances, scaled to 240, with the injury report's Out and Doubtful players removed and the
roster from the roster feed. Pace is a running average of each team's possessions per 48; the total
is the two expected efficiencies times the expected pace. The final win chance blends in a tenth of
the team model's difference.

Fit on 2023-2024 by coordinate search on log loss with the lineup known and minutes projected;
2022 warms up; holdout 2025-2026 (2,642 games). The same holdout games, four ways:

| | Log loss | Straight up | Spread error |
|---|---|---|---|
| Team model | 0.606 | 67.2% | 11.31 |
| Player model, previous game's lineup (no report) | 0.603 | 67.3% | 11.30 |
| Player model, lineup known, minutes projected (a good report) | 0.597 | 67.6% | 11.21 |
| Player model, actual minutes (perfect lineup knowledge) | 0.594 | 68.3% | 11.18 |

So knowing who plays is worth about a point of accuracy, and the player ratings are worth a little
on their own. Totals: 15.1 points of error. What it found: efficiency surprises clipped at 30 and
moving a full-time player 0.4 Elo per point; coach 0.05 per point of margin surprise; season carry
0.6 for players and 0.5 for coaches; rookies start at -60; RAPTOR priors scaled by 1.25.

What the ratings say after the 2026 Finals: Gilgeous-Alexander first, then Leonard, Jokić, Brunson,
Hart, Towns; Jokić the best offence, Gilgeous-Alexander and Gobert the best defence; Daigneault,
Mitch Johnson and Bickerstaff the top coaches; the Knicks the strongest team and the Wizards the
weakest.

## Runs

`.github/workflows/nba.yml` runs every morning at 7am Eastern: the days since the last final plus ten
days ahead, the new box scores, the injury report, the coaches and rosters, then both models. It
commits the data folder and the two model files only if they changed. On demand it takes a date
range and a refit switch. A push that changes `nba-hub/tools/*.js` runs it once (on a `claude/`
branch too, committing there; the schedule only fires from `main`).

Local:

```
node nba-hub/tools/history.js      # once; downloads the history file (or --file path/to/nba_elo.csv)
node nba-hub/tools/fetch.js        # needs ESPN reachable; --from / --to for a range
node nba-hub/tools/fetch_box.js    # needs ESPN reachable; --from / --to for seasons, --budget minutes
node nba-hub/tools/elo.js          # team model replay; add "fit" to refit
node nba-hub/tools/players.js      # player model replay; add "fit" to refit
```

## What comes next, in order

1. **The page**: `nba-hub/index.html` and `nba-hub/admin.html` built the way `betting/` builds them,
   reading the published files: today's and tomorrow's slate with the model's pick, chance, spread
   and total beside the line, each side's lineup with who is out and what it costs, the ratings tabs
   (teams, players by offence and defence, coaches), a record by day and month, picks kept in the
   browser and graded against the published finals, and a Parlay Builder whose legs are independent
   games, so a team parlay's fair price is the product of the model's chances.
2. **Style matchups**: the four factors each team forces and allows (shooting, turnovers, rebounding,
   free throws) as a fitted term on the residual, on top of pace and efficiency.
3. **Player props on the same page**: projections are minutes times a per-minute rate, so they reuse
   the projected minutes and the injury report. Fair lines first, book prices only where credits
   allow; same-game legs priced with a correlation table like the NFL props model's.
