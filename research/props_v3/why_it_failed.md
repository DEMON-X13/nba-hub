# Why the props model failed

Research only, 12 November 2026. The owner asked (11 November): "i also want to figure out why the model failed and if
we can build a more reliable one." This is the first half: why the props model (`tools/props.js`) lost its shadow trial
to DraftKings, checked with this folder's own code. Every number below comes from a script here and its committed result
file, named where it is used; the tables are `results/why_tables.md`, drawn from those files by `why_tables.js`. A first
run of this research was lost with its clone on 11 November; its leads were re-derived here, not repeated, and where one
holds or does not it says so.

## In plain English

- **It was far too sure of itself.** When it gave a bet a 70% chance or better, the bet won about half the time.
  DraftKings' chances were about the right size.
- **Nearly all of the loss came from the bets where it disagreed most with DraftKings, and DraftKings was right on
  those.** In the trial, the third of the bets where their chances were 10 percentage points or more apart carried
  nine-tenths of the loss.
- **When they disagreed, the result landed at DraftKings' number, not the model's**: on average the whole way there in
  the trial, and about four-fifths of the way in the 2026 playoffs and the 2023-24 season.
- **What DraftKings knew better was mostly playing time.** Six or seven parts in ten of it came through the minutes the
  player went on to play. Where the model was much keener on the Over, it expected 29 minutes and the players played 27;
  where DraftKings was keener, the model expected 26 and they played 29. The rest was how much they did per minute.
- **It was not mainly late injury news.** News the model could not have had (a teammate scratched late, or a teammate
  playing big minutes it had not counted on) explains only about an eighth of the playing-time part. In 2023-24, where
  the model was handed the exact list of who dressed for every game, minutes were still two-thirds of what DraftKings
  knew better.
- **The early-season lean toward Overs was real but small**: about 2 to 3% of the loss.
- **Points, assists and the combined stats were where DraftKings was hardest to beat; steals and blocks were
  closest.** On points and the combined stats the model's chances said almost nothing about whether the Over would
  land. In 2023-24 DraftKings was ahead in every month and on every stat.
- **Toning the model down would close much of the gap, not all of it, and the second try did not change that.** Even
  toned down perfectly, it still trails, by a fifth of the gap in the trial and half of it in 2023-24, because
  DraftKings' price already holds nearly everything the model knows. The model adds a little on rebounds, assists,
  threes, steals and blocks (most on steals and blocks) and nothing on points. Candidate A fixed parts of the model and
  predicted box scores better, but against DraftKings' lines it stayed about as over-sure, and in 2023-24 just as far
  behind.

## What was read, and under which rules

| Set | What it is | How it may be used here |
|---|---|---|
| The trial | 12,298 graded closing lines of 121 games, 20 October to 4 November 2026 (`data/props_shadow*`, `data/props_2027.csv`, `data/box_2027.csv`, `data/injuries_log.csv`) | The season in play: **diagnosis only**. Read to say where the frozen model lost; every regression on it is a description fitted on those very lines, and nothing from it is a candidate, a constant or a choice |
| The archive | DraftKings' 11,395 graded closing lines of the 2026 play-in and playoffs (`data/props_2026.csv`), the 2026 fold's model | **Spent**: development only, never a test |
| 2023-24 | DraftKings' provider-40 lines of the 2023-24 regular season, 89,032 graded on 1,116 games, fetched again on 12 November by the data step (`research/props_v2/cache/props40_2024.csv`, gitignored; byte for byte the window props_v2 scored, `data.md`) | **Development data**: it was scored once, against candidate A on 6 November 2026 (FAIL), so it is no test. Its `last_updated` column, which gives the result away (`data.md`), is never read |
| 2022-23 | DraftKings' provider-40 lines: the one-shot test's | **Not touched**: not fetched, read or printed. The replay that builds the 2023-24 projections walks 2022-23's box scores as history, as `tools/props.js` and props_v2's test do (the 2024 fold was fitted on 2022-23); no 2022-23 row is collected, projected, graded, summed or printed (`why_lines.js`) |

Two further disclosures for any preregistration's list of what was seen. `why_rerun_v2.js` ran props_v2's
`diag_trial.js` (which replays every box file, 2022-23's and 2026-27's included, and reports nothing of 2022-23) and, in
its first version, once, `diag_history.js`, whose in-sample view pools 2022-23's box scores with later seasons: both gave
back their committed results but for the stamp, their files were put back as committed, and none of their figures was
printed or read (`results/why_rerun_v2.json`; the second script is not run again). The first run of `why_lines.js`
collected 2022-23's replay rows (as props_v2's scripts do) and used none; its second, the one committed, does not collect
them, and gives every number the same. The candidates' scores here are their published ones, rebuilt: nothing was
refitted.

Read "the model" as `tools/props.js`, the model on trial: on the archive and 2023-24 it is its walk-forward fold
(`research/props_v2/results/fold_params.json`, the constants `research/props.json` stores), projected on the box
score's list of who dressed, as both earlier tests scored it. Candidate A is props_v2's, from
`results/cand_fix_score.json`. DraftKings' fair chance is the hub's rule, the whole margin on the Over.

## 1. The gap, rebuilt

`why_trial.js` rebuilds each of the trial's 12,298 lines from the frozen call, the fit and the two closing prices: every
model chance agrees with the ledger's to 0.00005 and every fair chance exactly, and the gap is the ledger's to the digit,
log loss +0.018439 with the bar's interval [+0.013592, +0.023297] (`results/why_trial.json`, `reproduce`).
`why_lines.js` does the same for the other two sets (`results/why_lines_archive.json`, `results/why_lines_2024.json`,
`toolsProps.reproduce`, `A.reproduce`), and props_v2's own `diag_trial.js`, run again unchanged, gives back its committed
result but for the stamp (`results/why_rerun_v2.json`).

| Set | Lines | Games | Log loss: model / DraftKings | Model less DraftKings [90%] | Brier [90%] |
|---|---|---|---|---|---|
| The trial | 12,298 | 121 | 0.7044 / 0.6860 | +0.0184 [+0.0136, +0.0233] | +0.0083 [+0.0060, +0.0105] |
| the trial's six base stats | 6,776 | 121 | 0.6952 / 0.6816 | +0.0136 [+0.0094, +0.0177] | +0.0060 [+0.0041, +0.0079] |
| The archive | 11,395 | 83 | 0.6934 / 0.6788 | +0.0147 [+0.0083, +0.0214] | +0.0064 [+0.0036, +0.0094] |
| the archive, candidate A | 11,395 | 83 | 0.6913 / 0.6788 | +0.0125 [+0.0065, +0.0189] | +0.0056 [+0.0029, +0.0084] |
| 2023-24 | 89,032 | 1,116 | 0.6770 / 0.6672 | +0.0098 [+0.0084, +0.0112] | +0.0040 [+0.0035, +0.0046] |
| 2023-24, candidate A | 89,032 | 1,116 | 0.6769 / 0.6672 | +0.0097 [+0.0084, +0.0110] | +0.0041 [+0.0036, +0.0047] |

Every published gap comes back: the trial's +0.0184, the archive's +0.0147 and +0.0125, 2023-24's +0.0098 and +0.0097,
each to the digit with its interval (90% intervals resample games, 10,000 times; positive means DraftKings is better).
2023-24's lines are the six base stats only, so they compare with the trial's six (+0.0136), not its whole (+0.0184): the
trial's five combos (5,522 lines) lost +0.0244.

## 2. It was far too sure of itself

The calibration slope is the weight a forecaster's own chance earns when the outcome is fitted on it (in log-odds, on
the lines themselves): 1 when its departures from 50% are the right size, under 1 when they are too big, 0 when they
carry nothing (`sureness` in each file; table B and C of `results/why_tables.md`).

| Set | Model: distance from 50% | DraftKings: distance from 50% | Model's slope [90%] | DraftKings' slope [90%] |
|---|---|---|---|---|
| The trial | 9.0 points | 5.2 | 0.27 [0.18, 0.37] | 1.01 [0.86, 1.17] |
| the trial's six base stats | 9.2 | 6.5 | 0.44 [0.34, 0.53] | 1.04 [0.88, 1.20] |
| the trial's five combos | 8.8 | 3.7 | 0.07 [−0.04, 0.19] | 0.83 [0.39, 1.25] |
| The archive | 9.5 | 6.2 | 0.43 [0.32, 0.56] (A 0.46) | 1.00 [0.87, 1.12] |
| 2023-24 | 11.0 | 8.9 | 0.66 [0.63, 0.68] (A 0.68) | 0.94 [0.92, 0.97] |

The first run's lead holds: 0.27 against DraftKings' 1.01 on the trial. In the trial's own bands, when the model said
the Over 70% or more (324 lines, 74.2% on average) it went in 51.5% of the time; when it said under 30% (588 lines,
25.2%), 44.6%. DraftKings' bands track what happened (its 60-70% said 62.4% and hit 65.5%).

By stat (the first run's slope was pooled over the stats, and its reviewers asked for them one by one): the model is
close to calibrated on steals and blocks, better on threes, over-sure on rebounds and assists, and so over-sure on
points and every combo with points in it that its chance there carries almost nothing.

| Stat | Trial | Archive | 2023-24 |
|---|---|---|---|
| Points | 0.15 [−0.02, 0.33] | −0.10 [−0.31, 0.14] | 0.08 [0.02, 0.15] |
| Rebounds | 0.34 [0.16, 0.51] | 0.31 [0.08, 0.56] | 0.34 [0.28, 0.40] |
| Assists | 0.26 [0.08, 0.48] | 0.57 [0.35, 0.83] | 0.29 [0.22, 0.35] |
| Threes | 0.53 [0.35, 0.73] | 0.74 [0.55, 0.95] | 0.78 [0.72, 0.84] |
| Steals | 1.02 [0.75, 1.32] | 1.20 [0.95, 1.49] | 0.85 [0.80, 0.91] |
| Blocks | 1.06 [0.73, 1.43] | 0.92 [0.71, 1.14] | 0.83 [0.79, 0.88] |
| The five combos | 0.07 [−0.04, 0.19] (pooled) | −0.03 to 0.63 by combo | – |

On points, and on points + rebounds + assists, points + rebounds and points + assists, a slope near 0 means that at
DraftKings' lines the model's chance said almost nothing about whether the Over would land. DraftKings' own slopes sit
near 1: on 2023-24 every stat's interval holds 1 but blocks' (0.87 [0.83, 0.91]), and pooled it is a shade too sure
(0.94); on the two smaller sets they scatter more widely about 1 (table C), most where its chances hug 50% (its points
chances sit 3.1 points from 50% on the trial).

That is not the outcome's spread. props_v2 found the squared errors smaller than the variance the model stated (points
0.84 of it on the trial), and its spread narrowed to its own walk-forward ratio lost more (`diag_trial.md` tables 14 and
15). The model's error is in its mean, measured against the line: when its mean sits away from DraftKings' line, that
distance is mostly its own error (section 4), and it prices the distance as if it were known.

## 3. Where the loss sits

| Set | Lines 10+ points apart | Their share of the gap | Model 10+ higher: model / DraftKings / the Over hit | DraftKings 10+ higher: model / DraftKings / hit |
|---|---|---|---|---|
| The trial | 31.4% | 91.9% | 61.7% / 45.8% / 48.1% (2,680 lines) | 30.8% / 46.4% / 48.2% (1,186) |
| The archive | 21.1% | 98.3% | 59.6% / 45.1% / 45.7% (900) | 30.5% / 47.0% / 48.0% (1,500) |
| 2023-24 | 17.7% | 89.7% | 57.9% / 43.6% / 47.9% (6,975) | 30.5% / 47.0% / 45.9% (8,760) |

(`where`.) The first run's and props_v2's lead holds on all three sets: the disagreements of 10 points or more carry
nine-tenths or more of the loss, and on both sides of them the Over landed near DraftKings' chance, far from the model's.
Within 5 points of each other the two are nearly level (the trial +0.0017 a line, 38% of its lines).

The gap taken apart, by how much of it a recalibration of the model's own chance could at most remove, fitted on the
very lines (so an upper bound, never a candidate: `parts`, `gapParts`; table E): a shift alone (the lean), a slope (the
over-sureness; the two averaged over the order they are taken in), and what is left, which is information DraftKings
had and the model did not.

| Set | Gap | The lean | Over-sureness | Information DraftKings had | The slope it takes |
|---|---|---|---|---|---|
| The trial | 0.0184 | 0.0006 (3%) | 0.0139 (76%) | 0.0039 (21%) | 0.27 |
| the trial's six base stats | 0.0136 | 0.0004 (3%) | 0.0082 (61%) | 0.0049 (36%) | 0.44 |
| the trial's five combos | 0.0244 | 0.0009 (4%) | 0.0230 (94%) | 0.0005 (2%) | 0.07 |
| The archive | 0.0147 | 0.0004 (3%) | 0.0084 (57%) | 0.0059 (40%) | 0.43 |
| 2023-24 | 0.0098 | 0.0003 (3%) | 0.0043 (44%) | 0.0052 (53%) | 0.66 |

So tempering the chance and taking out its lean would have removed at most about four-fifths of the trial's gap (most of
it on the combos), three-fifths of the archive's and under half of 2023-24's: the rest is DraftKings knowing more. By
stat (table E), points' gap is nearly all over-sureness on all three sets (2023-24: 0.0206 of 0.0221), so a tempered
points model would be about level with DraftKings and would say almost nothing: its information part is 0.0004 on
2023-24 and below 0.0011 on the other two sets.

## 4. Whose number the result landed on, and what DraftKings knew

DraftKings' price is read as a mean on the model's own distribution (the mean at which the model's negative binomial
gives DraftKings' fair chance at its line). Its disagreement with the model's mean, in the model's standard deviations,
is set against what happened (the stat less the model's mean), which splits exactly into the minutes he played (the
model's mean at the minutes played, less its mean) and what he did per minute (the rest). The slope of what happened on
DraftKings' disagreement is how far toward DraftKings' number the result landed (1: all the way; 0: at the model's), and
the slope of the minutes part over it is the share of what DraftKings knew that came through the minutes
(`minutes`; table F).

| | Trial: slope [90%] | its minutes share [90%] | Archive: slope | its minutes share | 2023-24: slope | its minutes share |
|---|---|---|---|---|---|---|
| All lines | 1.02 [0.92, 1.12] | 59% [52%, 65%] | 0.82 [0.66, 0.99] | 70% [61%, 80%] | 0.77 [0.72, 0.82] | 67% [64%, 70%] |
| Started | 1.02 [0.91, 1.14] | 53% [46%, 60%] | 0.80 [0.61, 0.99] | 68% [58%, 79%] | 0.77 [0.70, 0.83] | 67% [64%, 71%] |
| Off the bench | 0.96 [0.75, 1.16] | 69% [54%, 84%] | 0.90 [0.69, 1.09] | 76% [62%, 95%] | 0.76 [0.70, 0.83] | 64% [60%, 70%] |
| Points | 0.95 [0.84, 1.08] | 63% [55%, 73%] | 1.03 [0.85, 1.22] | 57% [48%, 68%] | 0.89 [0.84, 0.94] | 67% [64%, 71%] |
| Rebounds | 1.11 [0.92, 1.29] | 65% [55%, 78%] | 0.72 [0.50, 0.94] | 88% [68%, 118%] | 0.84 [0.79, 0.90] | 84% [79%, 89%] |
| Assists | 1.01 [0.83, 1.21] | 33% [26%, 42%] | 0.77 [0.53, 0.99] | 58% [46%, 76%] | 0.73 [0.56, 0.91] | 52% [48%, 57%] |

(Every stat is in table F. Where a slope's interval reaches 0, as the archive's steals, there is nothing to split.)

- **When they disagreed, DraftKings was right**: the result landed the whole way at its number on the trial, and 77-82%
  of the way on the other two. Had the model known things DraftKings did not, results would stop short of DraftKings'
  number when they disagreed; on the trial they did not stop short at all, on the other two sets by 18-23%. That is an
  upper bound on the model's own information: noise in reading a mean off a price pulls these slopes under 1 by itself
  (section 7 measures the model's share directly). The minutes share is a ratio of two slopes on the same reading, so
  that noise cancels in it.
- **What DraftKings knew was mostly minutes: 59% on the trial, 70% on the archive, 67% on 2023-24.** The first run's
  lead (60-70%) holds. On points 57-67%, on rebounds 65-88%; assists and blocks lean most on the rate per minute (about
  half or less through the minutes: assists 33-58%, blocks 50-53%).
- The minutes said and played where they disagreed most (`minutes.disagreementGroups`):

| Set | Model 10+ higher on the Over: minutes said / played | DraftKings 10+ higher: said / played | Within 5 points: said / played |
|---|---|---|---|
| The trial | 29.0 / 26.6 | 25.8 / 29.4 | 29.2 / 29.3 |
| The archive | 31.2 / 27.7 | 26.3 / 29.5 | 31.0 / 29.8 |
| 2023-24 | 28.6 / 25.9 | 24.1 / 28.3 | 28.6 / 28.3 |

  On the trial's points lines where the model was 10+ points higher (408 lines) it said 15.1 points, DraftKings' price
  implied 12.5, the line was 11.9 and they scored 11.9; where DraftKings was 10+ higher (184), the model said 13.0,
  DraftKings 15.7, the line 15.2, and they scored 15.6.
- For scale, not as a target: priced on the minutes each player went on to play, the same calls would beat DraftKings by
  0.056 on the trial (props_v2's `diag_trial.md` table 15, its script re-run unchanged by `why_rerun_v2.js`), 0.056 on
  the archive and 0.040 on 2023-24 (`minutes.hindsightMinutes`). No forecast made before tip-off has those minutes: they
  carry the game's own blowouts, fouls and injuries.

### Was it late news?

Mostly not (`minutes.lateNews`, `noLateNews`, `contributions`, `lateNewsExcess`, `callAgeHours`).

- On the trial, 4,684 of 12,298 lines were on a side with news the call could not have had: a called teammate projected
  20+ minutes who did not play, or a teammate who played 15+ minutes with no call. Those lines carry 46% of the minutes
  part on 38% of the lines. Beyond the no-news lines' rate per line, **late news explains 13% [−1%, 25%] of the minutes
  part**: about an eighth. The first run's lead, "not mostly late injury news", holds.
- On the lines with no late news at all (and the player himself not on the day's report), the result still landed
  nearly at DraftKings' number (slope 0.94 [0.80, 1.08]) and 63% [54%, 72%] of that came through the minutes.
- The calls were made a median 9.4 hours before tip-off (the 10th percentile 0.75 hours), so DraftKings' closing line
  had hours of news the call did not; yet the calls made within 2 hours of tip-off show much the same picture (2,450
  lines: slope 1.04 [0.74, 1.35], minutes share 49% [37%, 64%]).
- On 2023-24 the model was given the box score's list of who dressed, a perfect inactive list no live model has. The
  result still landed 77% of the way to DraftKings' number, and 67% [64%, 70%] of that came through the minutes; 65%
  [62%, 68%] on lines with no role change (not a first game of the season, not back from 3+ missed games, not a new
  club's first 10 games).

So DraftKings' edge in minutes is mostly not about who is out. It is about how coaches share the minutes among the
players who are there: starters' load, the bench's role, and players coming back or settling into a new club.

### Where minutes are least known

The gap by kind of line (`roles`; table J):

| Lines | Trial: lines, gap | minutes said / played | 2023-24: lines, gap | minutes said / played |
|---|---|---|---|---|
| His first game of the season | 1,653, +0.0436 | 28.5 / 27.3 | 1,353, −0.0017 | 27.8 / 27.2 |
| A new club (trial: another club last season; 2023-24: his first 10 games) | 2,389, +0.0282 | 27.4 / 26.9 | 4,339, +0.0227 | 24.6 / 25.2 |
| Off the bench | 2,816, +0.0297 | 23.7 / 22.0 | 27,834, +0.0070 | 22.1 / 21.2 |
| Projected under 20 minutes | 834, +0.0240 | 17.7 / 20.8 | 12,710, +0.0308 | 17.0 / 19.0 |
| Projected 34+ minutes | 2,072, +0.0143 | 35.6 / 33.9 | 19,092, +0.0040 | 36.2 / 34.9 |

Too few minutes for the low-minute players, too many for the heaviest, on both sets; a new club is hard both times. The
trial's opening games were its worst lines (+0.0436). 2023-24's first games, projected on the box score's list of who
dressed, were level (−0.0017), so the opener's trouble may be the live side's opening-night minutes (props_v2 found the
rule's openers over-minuted in each of the last four seasons) or 2026-27's own; these lines cannot tell which.

## 5. The early Over lean

(`lean`; table G.)

| Set | The model said the Over / it hit / DraftKings said | Removing a lean at most recovers (in sample) |
|---|---|---|
| The trial (its first two weeks) | 48.8% / 47.5% / 46.1% | 0.0003, 1.9% of the gap (3% with the order averaged, section 3) |
| The archive | 44.6% / 45.9% / 45.6% (an Under lean) | 0.0004, 2.6% |
| 2023-24 | 43.6% / 45.3% / 43.9% (an Under lean all season) | 0.0006, 6.4%; its first two months 0.3% |

The trial's early Over lean is real (the mean ran +0.56 over the stat; props_v2 traced about half of such leans to
minutes and the rest to rates carried across the summer, debutants and the season-start pace) but worth about 2-3% of
the gap: the first run's "about 2%" holds. It is not the cause. In 2023-24 the model leaned the other way at
DraftKings' lines, toward the Under, all season. Taking the trial's lean out of the means instead (each stat's mean
moved by its own average error) makes the log loss worse, 0.7044 to 0.7057 (`lean.meanShift`): at a line near its mean
the model's distribution already shades the Over (props_v2's "shape" finding), so the lean in the chance and the lean in
the mean are not the same thing.

## 6. Stat by stat and month by month

The gap by stat (`byStat`; table I):

| Stat | Trial | Archive | 2023-24 |
|---|---|---|---|
| Points | +0.0175 [+0.0092, +0.0259] | +0.0288 [+0.0181, +0.0396] | +0.0221 [+0.0188, +0.0254] |
| Rebounds | +0.0126 [+0.0042, +0.0213] | +0.0082 [−0.0012, +0.0177] | +0.0135 [+0.0106, +0.0162] |
| Assists | +0.0223 [+0.0102, +0.0345] | +0.0092 [−0.0006, +0.0193] | +0.0188 [+0.0146, +0.0230] |
| Threes | +0.0071 [−0.0001, +0.0143] | +0.0083 [+0.0003, +0.0169] | +0.0053 [+0.0031, +0.0074] |
| Steals | +0.0026 [−0.0048, +0.0099] | −0.0010 [−0.0065, +0.0046] | +0.0026 [+0.0008, +0.0044] |
| Blocks | +0.0124 [−0.0021, +0.0278] | −0.0005 [−0.0070, +0.0057] | +0.0013 [−0.0006, +0.0033] |
| Pts+reb+ast | +0.0283 [+0.0196, +0.0370] | +0.0277 [+0.0143, +0.0418] | – |
| Pts+reb | +0.0182 [+0.0087, +0.0279] | +0.0239 [+0.0128, +0.0356] | – |
| Pts+ast | +0.0300 [+0.0198, +0.0404] | +0.0267 [+0.0126, +0.0412] | – |
| Ast+reb | +0.0223 [+0.0115, +0.0332] | +0.0127 [+0.0015, +0.0238] | – |
| Stl+blk | +0.0274 [+0.0130, +0.0418] | +0.0010 [−0.0069, +0.0084] | – |

The first run's lead mostly holds: points is the hardest single stat on the archive and on 2023-24, the points combos
are among the hardest lines on the trial and the archive, and on the trial assists (+0.0223) ran behind points
(+0.0175); steals and blocks are closest everywhere (the trial's blocks, 320 lines, are noisy). Candidate A's are within
0.002 of these on 2023-24 (table I).

Month by month, 2023-24 (`byMonth`; table H):

| Month | Lines | Gap [90%] | Model said / hit / DraftKings | Calibration slope | Minutes said / played (average miss) | Minutes share |
|---|---|---|---|---|---|---|
| October 2023 | 4,600 | +0.0106 [+0.0043, +0.0171] | 45.9% / 46.9% / 43.6% | 0.54 | 27.7 / 27.3 (4.3) | 47% |
| November | 15,506 | +0.0055 [+0.0030, +0.0082] | 44.6% / 45.3% / 43.7% | 0.73 | 28.2 / 28.0 (4.4) | 61% |
| December | 16,257 | +0.0093 [+0.0066, +0.0123] | 43.2% / 45.1% / 43.8% | 0.61 | 28.2 / 28.1 (4.5) | 69% |
| January 2024 | 11,908 | +0.0094 [+0.0062, +0.0124] | 43.4% / 44.7% / 43.9% | 0.66 | 28.2 / 27.9 (4.8) | 62% |
| February | 13,426 | +0.0088 [+0.0053, +0.0120] | 43.9% / 45.9% / 44.0% | 0.73 | 28.2 / 28.2 (4.4) | 72% |
| March | 18,241 | +0.0102 [+0.0075, +0.0130] | 43.1% / 45.0% / 44.0% | 0.68 | 27.9 / 28.2 (4.6) | 69% |
| April (to the 14th) | 9,094 | +0.0187 [+0.0116, +0.0265] | 42.6% / 45.6% / 44.0% | 0.56 | 27.8 / 28.0 (5.4) | 73% |

DraftKings is ahead in every month, each interval above zero, and furthest in April, the season's last two weeks
(+0.0187), where the model's minutes missed most (5.4 minutes a player on average, against 4.3 to 4.8 in the other
months) and 73% of what DraftKings knew came through them; October's gap leaned least on minutes (47%). Candidate A's
month by month is within 0.002 of these (table H). By stat and month (42 cells) the model is ahead in three, by little:
steals in October (−0.0060) and blocks in October and December (−0.0007, −0.0011); points are behind in every month, by
+0.0144 to +0.0440. The first run's "behind in every month and stat" holds for every month and for every stat over the
season, blocks only just (its interval reaches zero), not for every month of every stat.

## 7. Did the model know anything DraftKings did not?

A little, on some stats. The share w of the model's disagreement with DraftKings worth keeping, P(Over) = sigm(logit q +
w (logit m − logit q)) with q DraftKings' fair chance and m the model's, fitted on the lines themselves (`beyond`; table
K: an in-sample measurement, so a ceiling, not a weight to use):

| | Trial | Archive | 2023-24 |
|---|---|---|---|
| All, pooled | 0.10 [0.00, 0.20] | 0.09 [−0.06, 0.26] | 0.18 [0.15, 0.22] |
| The six base stats | 0.15 [0.05, 0.25] | – | 0.18 [0.15, 0.22] |
| Points | 0.15 [−0.02, 0.32] | −0.10 [−0.29, 0.12] | 0.02 [−0.03, 0.08] |
| Rebounds | 0.19 [−0.02, 0.38] | 0.27 [0.03, 0.52] | 0.15 [0.09, 0.22] |
| Threes | 0.23 [−0.04, 0.49] | 0.10 [−0.30, 0.47] | 0.28 [0.20, 0.37] |
| Steals | 0.29 [−0.30, 0.89] | 0.59 [0.08, 1.14] | 0.37 [0.29, 0.46] |
| Blocks | −0.01 [−0.61, 0.55] | 0.54 [0.05, 0.97] | 0.43 [0.33, 0.53] |

On 2023-24 nearly a fifth of the model's disagreement is worth keeping (candidate A 0.18 [0.14, 0.22], props_v2's
0.176), a third or more on steals and blocks, and none on points; keeping it gains 0.0006 log loss there in sample,
0.0002 on the trial. The combos earn almost nothing (on the trial −0.88 to 0.17 by combo, only points + rebounds'
interval above zero, just, and steals + blocks' below it; on the archive −0.02 to 0.42, none clear of zero; table K).
That is the model's whole edge: real on the small stats, too small to cover the over-sureness, and absent on points and
every combo with points in it.

## 8. So, why it failed

1. **Over-sureness** (the largest part of the trial's gap, 76%, and of the archive's, 57%; 44% of 2023-24's). The model
   priced its own mean as if it were known. Against DraftKings' line its mean's distance was mostly its own error, and
   on points and the combos almost wholly.
2. **What DraftKings knew and the model did not** (21-53% of the gap is left after any tempering, the largest part of
   2023-24's): mostly minutes, three-fifths to two-thirds, the rest the rate per minute. Not mainly late news: it holds
   where there was none and on 2023-24's perfect list of who dressed. It is how the minutes are shared among the
   players who play, worst for the low-minute players, the heaviest-minute starters, new clubs and, in the trial, the
   first games of a season.
3. **The early Over lean**: 2-3% of the trial's gap, a season's quirk that changed sign in the playoffs and in 2023-24.

What it means for a more reliable model (the second half of the owner's question, for the next step to take up): a
model that tempers its chance to its real information would be calibrated and close to level with DraftKings (within
the information part: about 0.004-0.006 log loss behind on these sets), and could be shown honestly as information.
Whether it adds anything beyond DraftKings' price is the narrower claim: on 2023-24 the model's disagreement earns a
positive share on rebounds, assists, threes, steals and blocks, none on points, measured in sample, so it has to be shown
on lines a candidate has never seen. Beating DraftKings outright would take what DraftKings has here, better minutes,
and nothing in this diagnosis shows that box scores alone can give it.

## Re-running

From the repository's root (`node` only; nothing from `tools/node_modules`):

| Command | What | Time |
|---|---|---|
| `node research/props_v3/why_trial.js` | the trial, diagnosis only → `results/why_trial.json` | about 30 s |
| `node research/props_v3/why_lines.js archive 2024` | the archive and 2023-24 (needs `research/props_v2/cache/props40_2024.csv`) → `results/why_lines_archive.json`, `results/why_lines_2024.json` | about 4 minutes |
| `node research/props_v3/why_tables.js` | every table above, from the three files → `results/why_tables.md` | a second |
| `node research/props_v3/why_rerun_v2.js` | props_v2's `diag_trial.js` again, unchanged, against its committed result → `results/why_rerun_v2.json` | about 10 s |

`why_lib.js` holds the shared code: the scores, the game-clustered bootstrap (its own seeded generator; 10,000 resamples
for a gap, 1,000 for a regression), the logistic fits and the market's implied mean. `WHY_BOOT` sets the regressions'
resamples. Every interval is a 90% interval resampling games, the unit of independence.
