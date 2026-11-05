# The props model on past seasons: what can be measured without lines

`node research/props_v2/diag_history.js` (about 40 seconds with the cached fold constants, 4 minutes with `--refit`)
writes `results/diag_history.json` and `results/diag_history_tables.md`, which has every table this note quotes and more
(sections A to L).

## What was done, and on what

- **Seasons 2022-2026 only.** `data/games.csv`'s rows after 2026 are dropped, and the box scores and team boxes are cut
  to the games kept, so nothing of 2026-27 enters a row, a rate, a pace or an opponent figure. (When this was written,
  every box file was parsed whole, 2026-27's included, and cut afterwards; since the review the script loads through
  `cut2026.js`, which opens only the files of seasons up to 2026. Every number is the same: README, "The rules kept".) Nothing
  here reads the trial's ledger or this season's lines; the trial's figures quoted below are the brief's.
- **The walk-forward folds**, exactly as `node tools/props.js research` makes them: 2024 projected by constants fitted on
  2023, 2025 on 2023-2024, 2026 on 2023-2025 (2022 warms the ratings up), by `tools/props.js`'s own exported `replay`,
  `fit` and `project`, unchanged. The three fitted constant sets came out identical to the ones `research/props.json`
  stores. "Pooled" is the three test seasons together, each by its own fold.
- **The constants on trial** (`props.json` `params`, fitted on 2023-2026) applied to 2023-2026 as a second view. That is
  in sample, so it is read for its shape (does the trial's own model lean early in every season it was fitted on?), never
  as a score.
- **Rows**: every player-game the walk-forward scores (he played, and had a game this season or last), 84,342 in the
  three test seasons; "projected 8+" (77,254), the ledger's universe, unless a table says otherwise. Tiers are by
  **projected** minutes.
- **A book-like line** is the walk-forward's: the player's own average (this season, else last) floored, plus a half.
  It is not DraftKings' line (none exists before 2026's playoffs), so a "said against happened" here is the same kind of
  number as the trial's (48.8% said, 47.5% happened), on other lines.
- **The spread** is read by the randomized PIT (F(y-1) + U P(y), U seeded): calibrated, it is flat, its mean 0.5, and the
  central 50% and 80% intervals ([0.25, 0.75] and [0.1, 0.9] of the PIT) cover 50% and 80%.
- **Role changes**, from the box scores in order: a teammate who played 20+ minutes in the team's previous game does not
  play (absent from the box: inactive; or listed, not playing: a coach's decision, which the backtest counts available);
  the player returns after missing 3+ team games; a 20+ minute teammate returns; the player's previous game was for
  another club; a debut on the side (a player with no game on record, who has no projection and so sits outside the
  side's minutes scale). The intervals are a cluster bootstrap over games (2,000 resamples).

## The answer: yes, the over lean is there in every past season, in the same weeks and at the same size

The model over-projects the first weeks of every season and under-projects the last, a steady slide across the year
(points, projected 8+, folds pooled):

| | Oct | Nov | Dec | Jan | Feb | Mar | Apr | Playoffs |
|---|---|---|---|---|---|---|---|---|
| Minutes, projected - actual | +0.87 | +0.39 | +0.46 | +0.35 | +0.29 | +0.11 | -0.38 | +0.99 |
| Points, projected - actual | +0.74 | +0.28 | +0.23 | +0.27 | +0.09 | -0.07 | -0.54 | +0.17 |
| Points, projected / actual | 1.065 | 1.024 | 1.020 | 1.024 | 1.008 | 0.994 | 0.954 | 1.015 |
| PRA, projected - actual | +1.11 | +0.45 | +0.36 | +0.35 | +0.10 | -0.04 | -0.75 | +0.40 |
| P(over) said, every stat | 42.0% | 43.6% | 43.2% | 43.2% | 43.4% | 44.3% | 45.3% | 36.0% |
| P(over) happened | 40.2% | 43.9% | 43.6% | 43.7% | 44.5% | 45.5% | 48.0% | 35.2% |

By the club's game number: games 1-5 points +0.73 (1.064), PRA +1.08 (1.059), minutes +0.84; games 6-10 +0.37; 11-20
+0.21; 21-41 +0.25; 42 on -0.05. It is every season, not one:

| Season | first 121 games: points bias [90%] | P(over) said - happened, every stat [90%] | Dec-Apr said - happened |
|---|---|---|---|
| 2024 (fold) | +0.78 [+0.60, +0.96] (1.069) | +0.8 [-0.1, +1.6] pts | -0.8 [-1.2, -0.5] |
| 2025 (fold) | +0.50 [+0.32, +0.69] (1.044) | +0.2 [-0.8, +1.2] | -1.5 [-1.8, -1.1] |
| 2026 (fold) | +0.48 [+0.29, +0.68] (1.042) | +2.1 [+1.3, +3.0] | -0.8 [-1.2, -0.4] |
| the constants on trial, 2023-2026, in sample | +0.68 [+0.59, +0.77] (1.060) | **+1.4 [+0.9, +1.8]** | -0.8 [-1.0, -0.6] |

"The first 121 games" is the length of the trial so far (121 games), the first 121 regular-season games of each season by date; over the three folds together it is +1.1 (42.5% said, 41.4% happened). The trial's own model, on the four
seasons it was fitted on, said the Over 1.4 points of chance more often than it happened in exactly that span, and 0.8
points less often from December to April; the trial says 48.8% where 47.5% happened, +1.3. **The trial's over lean is
what this model has always done in the first two weeks of a season**, not something new in 2026-27. By stat (folds
pooled, first 121 games, said - happened): rebounds +2.0, ast+reb +1.9, assists +1.8, PRA and pts+reb +1.7, pts+ast +1.4,
points +1.3, blocks +1.0, threes +0.6; steals -1.4 and stl+blk -0.6 run the other way. Over October and November
together the lean thins: +0.6 for the constants on trial, +0.2 over the folds.

But it is a small part of the trial's loss. The best recalibration of the chance at the book-like line, fitted on the very
rows it is scored on (a logit shift and slope: a size, not a candidate), takes the first 121 games' log loss from 0.6203
to 0.6197 (folds pooled; 0.6214 to 0.6205 for the constants on trial), a gain of 0.0006-0.0009, and the whole season's by
0.0002. A pure lean of 1.3 points costs about 0.0003 of log loss. The trial is 0.0184 behind DraftKings. **The lean
is real and every season's, but if the trial's is like history's it explains perhaps 3-5% of the log-loss gap**; the rest is what the line knows that
yesterday's box scores do not (the role-change rows below are where the model is most wrong). It may explain more of the
flat bets' loss than of the log loss: a uniform +1-2 point lean pushes Overs across a 3-point bar, and the rows that lean
most (below) are the ones it pushes. That is a suggestion for the diagnosis of the trial's lines, not something measured
here.

## Where the early lean comes from

The pieces, points in the club's games 1-5 (+0.73): with the pace factor off, +0.55; with the opponent factor off,
+0.64; with each player's actual minutes put in for the projected ones (the rate alone), +0.36. **About half is minutes,
a quarter the pace factor, an eighth the opponent factor, the rest the per-minute rate itself.** Four mechanisms, each measured:

1. **The rates are weighted across the season break, so a season opens on last season's closing stretch.** A player whose
   last 15 regular-season games ran 10%+ above his season per minute (pts+reb+ast) is over-projected on the rate alone by
   +0.67 points in his club's games 1-10 (all-in +0.77, ratio 1.076) and +0.34 in games 11-20; an ordinary closing
   stretch, +0.14 and -0.04. The mirror is April itself, under-projected by 0.54 points (ratio 0.954): the end-of-season
   rest and tank minutes inflate whoever plays, and those games carry into October through rate half-lives of 8 to 40
   appearances.
2. **Players from clubs that missed the playoffs.** Games 1-10: +0.84 points (minutes +0.88, rate alone +0.45) against
   +0.22 for players who played in last season's playoffs (minutes +0.37, rate alone +0.06). Even with an ordinary closing
   stretch a non-playoff club's player is +0.90 (rate alone +0.44, minutes +0.95). The pace factor is not the cause: it is
   largest for playoff players (mean 1.021 in games 1-10, their pace history leaning on slow playoff games), and there it
   offsets their playoff-depressed rates (pace off, their bias is -0.04).
3. **A debut on the side.** A player with no game on record has no projection, and so no place in the side's minutes
   scale: the rest are scaled up as if he were not there. In games 1-10, a side where debutants played 1-24 minutes
   over-projects its players' minutes by 1.57 and points by 1.04 (ratio 1.094); 25+ minutes, 3.60 and 1.61 (1.147); a side
   with none, 0.43 and 0.46 (1.040). 14% of early rows. Live works the same way (no game on record, no projection), and a
   season's first two weeks are when the rookies debut.
4. **The pace start** (`EARLY_PACE`, league + 1.5): the mean pace factor is 1.0136 in games 1-5, 1.0086 in 11-20,
   0.9986 from game 42; taking it off removes 0.18 of the 0.73. It is a constant taken from `players.js`'s rule, never fitted
   on this model, and worth testing as one.

## Minutes (projected - actual, rows projected 8+)

| Projected | 8-15 | 15-20 | 20-25 | 25-30 | 30-35 | 35+ | all 8+ |
|---|---|---|---|---|---|---|---|
| Bias | -0.34 | +0.23 | +0.19 | +0.17 | +0.54 | **+1.74** | +0.33 |
| Mean absolute error | 5.79 | 5.34 | 5.04 | 4.70 | 4.18 | 4.01 | 4.87 |

The heaviest-minute players run 1.7 minutes over (37.1 projected, 35.4 played): their stats follow (points +0.58, ratio
1.027; rebounds 1.057; blocks 1.098), though on their actual minutes their rate is a little low (-0.38 points). Players
with no role change at all ("stable") are over-projected by 0.70 minutes all season (0.74 in games 1-10, 0.66 after), which
the teammate-out rows pull back to +0.33 on average. The minutes are fitted on absolute error, which aims at the median,
while minutes are skewed low (blowouts, foul trouble, a player hurt in the game) and the stats' means need the mean: a
likely reason for the steady +0.3 to +0.7.

Role changes (minutes bias, then points bias and ratio):

| Group | rows | minutes | points | PRA |
|---|---|---|---|---|
| no role change, games 1-10 | 6,475 | +0.74 | +0.63 (1.055) | +0.92 |
| no role change, game 11 on | 36,037 | +0.66 | +0.38 (1.033) | +0.57 |
| back after 3-9 missed games | 1,696 | +1.83 | +0.57 (1.073) | +0.98 |
| back after 10+ missed games | 390 | +3.60 | +1.35 (1.173) | +2.25 |
| a 20+ minute teammate returns | 7,666 | +1.04 | +0.47 (1.044) | +0.77 |
| a 20+ minute teammate out (inactive) | 17,223 | -0.49 | -0.49 (0.958) | -0.69 |
| a 20+ minute teammate listed, not playing | 10,476 | -1.73 | -0.97 (0.918) | -1.46 |
| new club, his first 10 games | 356 | +4.34 | +2.19 (1.349) | +3.51 |
| new club, after | 162 | +2.10 | +0.90 (1.113) | +1.33 |

When a regular is out, the side's scale (T / S)^0.5 hands his minutes to the top of the rotation, and coaches hand them to
the bench: by projected tier the teammates' minutes bias is -2.96 (8-15), -1.36 (15-20), -0.86 (20-25), -0.14 (25-30),
+1.15 (30-35) and +2.61 (35+). A player back from an absence plays well under his old minutes (+1.8 to +3.6 over), and so
his teammates get more than he takes (+1.0 over). The coach's-decision case is the backtest's own blind spot (it counts the
listed player available); live, its analog is a late scratch the report did not carry.

## The spread

Over all rows projected 8+, the coverage is right: points 50.6% and 80.1%, rebounds 50.9% and 80.7%, assists 50.0% and
80.0%, every stat 49.5-50.9% and 79.7-80.7%. Two things are wrong under it:

- **The shape, on points and the points combos.** Points' PIT tenths, lowest to highest: 11.7, 8.3, 8.3, 9.0, 9.8, 10.7,
  11.2, 11.6, 11.3, 8.2%. Real points have more duds than the negative binomial allows (a short night), fewer huge nights,
  and more mass just above the middle. So at a line near the mean the chance of the Over is said too low: at the model's
  own mean floored plus a half, points 42.0% said where 44.5% happened, PRA 43.8% against 45.5%; at the book-like line
  from December on, points 45.5% against 48.5%. Rebounds, assists, threes, steals and blocks are flat to within half a
  point a tenth (bar the top tenth of rebounds, 9.1%). In the first weeks the over-projected mean and this shape error point
  opposite ways and roughly cancel at own-average lines (Oct-Nov points 46.5% said, 47.0% happened); later the shape error
  is left, which is how the same model ran low on the Over in the 2026 playoffs archive (44.6% said, 45.9% happened).
- **The width, by minutes.** One variance curve per stat (A x mean^B) cannot know minutes: the same mean from 12 minutes
  or from 34 gets the same spread. Too narrow for the bench (8-15 projected: points 44.8% and 75.5% coverage), too wide
  for the rotation DraftKings lines most (25-30: 52.3% and 82.0%; 30-35: 53.2% and 82.5%; 35+: 53.5% and 81.7%; rebounds at
  35+ 54.1% and 84.3%).

By the chance said (every stat, the book-like line): the middle-low deciles happen more than said (30-40%: 35.4% said,
37.1% happened; 20-30%: 25.7%, 27.3%), the top less (Oct-Nov 80-90%: 84.0%, 81.1%; 90-100%: 93.7%, 85.6%, 369 rows).
The recalibration slope is 0.93-0.94 in every fold: the model trusts its departures from the player's own average a
little too much.

## What this suggests for a second model (nothing here was chosen or scored on a candidate)

Each of these is a mechanism the history shows, to be written as a rule, fitted on 2023-2026 and frozen before any new
trial; none of them closes a 0.018 log-loss gap by calibration alone.

1. **The season break**: start a season's rates from last season's whole-season rate (or down-weight its closing
   stretch, April above all), not from the exponential weights running straight across the summer.
2. **Debutants in the side's scale**: give a player with no game on record a minutes prior (live, the roster lists him),
   so the rest are not scaled up as if he were absent.
3. **Minutes aimed at the mean**, or a minutes distribution (play, blowout, early exit) with the stats conditional on it:
   that fixes the +0.3-0.7 minutes lean, the points shape (the duds are short-minute nights) and the width by minutes at
   once.
4. **Redistribution by role** when a regular is out (the bench gains, the stars less than the power law gives), and a
   minutes restriction for the first games back after 3+ missed.
5. **The pace start** (`EARLY_PACE`) tested on its own.

## Limits

The lines are book-like, not DraftKings' (whose fair chance ran under what happened in the trial: 46.1% said, 47.5%
happened); the folds know who dressed (the box's list), so errors the live report adds are not here; 2023 has no
fold (no season before it to fit on), so the four-season view is the in-sample one; some groups are small (a new club's
first ten games, 356 rows; debut sides with 25+ minutes, 196); a role change's flags are approximate (a 20+ minute
teammate in the previous game).
