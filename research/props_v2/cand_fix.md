# Candidate A: fix the model's own parts

Research only, 5 November 2026. Nothing here is fitted, chosen or scored on the 2026-27 season (season 2027):
`cand_fix_lib.js` loads through `cut2026.js`, which drops `data/games.csv`'s rows after 2026, opens only the box files of
seasons up to 2026, and throws if one of them holds a row of a later game (README, "The rules kept"). The trial's graded
lines were read only by the diagnosis (`diag_trial.md`). That diagnosis suggested which parts to try changing (`debut`,
`kappa` and `vm` among them), and nothing more. `tools/props.js` is required and never changed.

## The rule (written before the archive was scored)

> *Added after the review:* of this rule, what a reader can check is `results/cand_fix_rule.json`, written by `--select`
> with its own stamp (18:41Z) before `--score` read it (its log begins 18:42:58). This prose, saved with the results at
> 18:57, is the writer's account (README, "The rules kept", rule 4).

The candidate is `tools/props.js` with eleven changes. Each one was fitted on the seasons before each fold. A change was
kept only if the walk-forward's **mean log score over the 11 stats** (the negative binomial's, on the rows `tools/props.js
research` scores) fell on **both** of these:

- the 2025 fold (fitted 2023-2024);
- the 2026 regular season (fitted 2023-2025, games to 12 April).

The 2026 play-in and playoffs were not looked at during selection. Those are the archive's games and the archive's
results.

The changes were tried in a fixed order, each one added to the changes kept before it. Every constant downstream of a
changed part was then refitted: the rates, pace, opponent, playoffs and spreads after a minutes change. The search is
`cand_fix.js --select` (`results/cand_fix_select.json`). The rule froze at 18:41Z (`results/cand_fix_rule.json`), before
`--score` ran.

| # | Change | Kept? | Log score change, 2025 / 2026 reg. | What it fitted (2025 fold / 2026 fold) |
|---|---|---|---|---|
| 1 | `sq`: every minutes constant fitted on squared error (the mean), not absolute error (the median) | kept | -0.00395 / -0.00045 | b's prior weight 0.25 to 0.5, T 250 to 240, floor 0 to 8 (the scale's exponent goes 0.5 to 1 once `kappa` is in) |
| 2 | `cal`: minutes m + c0 + c1 (m - 24), by least squares | kept | -0.00628 / -0.00129 | c0 +0.23 / +0.31, c1 -0.020 / -0.014 (after the later changes) |
| 3 | `open`: the season-opening prior (his last regular season's minutes) times a factor | kept | -0.00016 / -0.00028 | 0.95 / 0.95 |
| 4 | `ret`: first game back after 3-9 (10+) of the club's games missed, b times a (b) | kept | -0.00139 / -0.00046 | 0.90 (0.80) / 0.90 (0.80) |
| 5 | `nt`: a new club, b times r0 on his first game for it (r1 on his 2nd-5th) | kept | -0.00012 / -0.00005 | 0.85 (1) / 0.85 (1) |
| 6 | `debut`: each listed player with no game on record claims d minutes in the side's S | kept | -0.00006 / -0.00029 | 2 / 4 |
| 7 | `kappa`: the side's change in minutes (sum of m - b) shared in proportion to b^kappa, not to b | kept | -0.00212 / -0.00358 | 0 / 0 (equal shares) |
| 8 | `lam`: at a new season, the carried-in rate swapped toward his whole last regular season's | dropped | +0.00006 / -0.00012 | |
| 9 | `dE`: EARLY_PACE (1.5) moved by dE, fitted with the pace exponent | kept | -0.00008 / -0.00012 | -1.5 / -1.5 (no season-start bump) |
| 10 | `shrink`: each stat's mean pulled toward his own average a game, naive + beta (mu - naive) | kept | -0.00087 / -0.00054 | beta 0.88-0.95 (points 0.894 / 0.884) |
| 11 | `phase`: regular-season mean x (actual / projected) by the club's games played (0-9, 10-29, 30-59, 60+) | kept | -0.00021 / -0.00026 | points 0.964, 1.003, 1.000, 1.029 / 0.971, 0.997, 1.003, 1.036 |
| 12 | `vm`: each spread times (projected minutes / 24)^C, C per stat by maximum likelihood | kept | -0.00120 / -0.00101 | C 0 to -0.3 (wider for the bench, narrower for starters) |
| 13 | `vEarly`: each spread times E while he has under 5 appearances this season | dropped | 0 / 0 | E = 1 everywhere |

Together the changes cut the mean log score by 0.0164 on the 2025 fold (2.1712 to 2.1548) and by 0.0083 on the 2026
regular season (2.1707 to 2.1624).

How to read the table:

- **The order matters.** `cal` fixes a bias that `sq` leaves behind: on squared error the scale under-projects minutes by
  0.2-0.4. The two are a pair.
- **Several gains are tiny.** `nt`, `debut` and `dE` each move the score by 0.0001 or less on one fold. The rule kept them
  because it asks only for a fall on both folds.
- **Most of the gain comes from four changes:** `cal`, `kappa`, `vm` and `sq`. `kappa` 0 means a side's spare or missing
  minutes are shared equally among its players, not in proportion to what each was projected to play. That matches the
  diagnosis: when a regular sits, the extra minutes go to the bench, not to the stars.

Live, every input to these changes can be worked out the same way, from the replay's state and the club's schedule:

- the club's games played and games missed since a player's last appearance;
- appearances for a new club;
- the roster's players with no game on record;
- each club's season-start pace.

**What is scored, once, after the freeze** (`cand_fix.js --score` → `results/cand_fix_score.json`):

1. The box-score walk-forward against `tools/props.js` as it stands, each fold fitted on the seasons before it: 2024 (fitted
   on 2023 alone, a fold the selection never used), 2025, the 2026 regular season and the 2026 play-in and playoffs. Each
   fold reports mean absolute error, log score and the log loss at a book-like line (his own average floored, plus a half),
   each with the difference's 90% interval, resampling games.
2. DraftKings' 2026 play-in and playoff closing lines (`data/props_2026.csv`, 11,395 graded), using the 2026 fold's
   constants (fitted 2023-2025). It reports log loss and Brier against DraftKings' fair chance, with 90% intervals
   resampling games; the candidate against `tools/props.js` on the same lines; and flat one-unit bets at a 3-point edge (and
   5 and 8), Overs and Unders apart.
3. The constants a new shadow trial would freeze, fitted on 2023-2026.

## Checked first: every change off is `tools/props.js`

`cand_fix.js --verify` (`results/cand_fix_verify.json`) ran the machinery with every change switched off and compared it
with `tools/props.js`:

- The replay rows were identical (137,883 rows, 0 differing).
- The fitted constants were identical for the 2025 and 2026 folds.
- The walk-forward scores were identical to `research/props.json`.
- The archive was identical: 11,395 lines, log loss 0.6934 against 0.6788.

## The results, scored once after the freeze

The baseline in every row below is `tools/props.js` as it stands. Each fold is fitted only on the seasons before it.

### Box-score walk-forward

| Fold | Rows | Mean log score (11 stats) | Log loss at a book-like line | Mean absolute error (11 stats) | Minutes MAE |
|---|---|---|---|---|---|
| 2024 (fit 2023; not used by the selection) | 27,872 | 2.1480 → 2.1347, **-0.0133 [-0.0187, -0.0089]** | 0.6413 → 0.6349, -0.0065 [-0.0093, -0.0041] | 2.674 → 2.661 | 4.82 → 4.79 |
| 2025 (fit 2023-2024) | 28,007 | 2.1712 → 2.1548, **-0.0164 [-0.0245, -0.0107]** | 0.6442 → 0.6372, -0.0070 [-0.0094, -0.0049] | 2.706 → 2.688 | 4.83 → 4.79 |
| 2026 regular season (fit 2023-2025) | 26,440 | 2.1707 → 2.1624, **-0.0083 [-0.0098, -0.0070]** | 0.6425 → 0.6380, -0.0045 [-0.0055, -0.0036] | 2.703 → 2.689 | 4.81 → 4.75 |
| 2026 play-in and playoffs (fit 2023-2025) | 2,023 | 2.1138 → 2.0588, **-0.0550 [-0.0845, -0.0281]** | 0.6056 → 0.5834, -0.0222 [-0.0369, -0.0094] | 2.535 → 2.547 (worse) | 4.98 → 4.90 |

The intervals are 90%, resampling games. The book-like line is his own average floored, plus a half.

- **Every fold's log score improves.** That includes 2024, which the selection never used, by about as much as the folds
  it chose on. 2024 is no clean hold-out, though: it is the fold `tools/props.js`'s structure was chosen on
  (`research/props.json`), and its box scores trained both folds the selection used (2025 on 2023-2024, 2026 on
  2023-2025). Mean absolute error improves on the three regular-season folds, not in the playoffs (below).
- **Every stat's log score improves** on every regular-season fold. Mean absolute error falls on nearly every stat:
  points 4.55 → 4.52 on the 2025 fold and 4.53 → 4.51 on the 2026 regular season.
- **In the playoffs the log score improves most** while mean absolute error gets slightly worse. The candidate's playoff
  means run higher: points bias +0.45 against +0.17.

### The early-season lean (each season's first 121 regular-season games, the trial's span; players projected 8+ minutes)

| Season | Points bias: tools/props.js → candidate | Chance of the Over at the book-like line: said → said (happened) |
|---|---|---|
| 2024 | +0.78 → -0.04 | 42.1% → 39.0% (41.4%) |
| 2025 | +0.50 → -0.21 | 42.4% → 40.0% (42.0%) |
| 2026 | +0.48 → -0.15 | 42.9% → 40.9% (40.7%) |

The points lean is gone. But the chance of the Over at a line near his average now runs 2.0-2.4 points **low** in 2024
and 2025 (0.1 in 2026). This is the shape problem `diag_history.md` found: real points have more bad nights and fewer huge
ones than the negative binomial allows. The old mean's over-projection had hidden it early in the season, and nothing in
this candidate changes the shape.

### DraftKings' 2026 play-in and playoff closing lines (11,395 graded, 83 games; the 2026 fold, fitted 2023-2025)

| | tools/props.js | Candidate A | DraftKings' fair chance |
|---|---|---|---|
| Log loss | 0.6934 | **0.6913** | 0.6788 |
| vs DraftKings [90%, resampling games] | +0.0147 [+0.0083, +0.0214] | **+0.0125 [+0.0065, +0.0189]** | |
| Brier | 0.2495 | 0.2486 | 0.2430 |
| vs DraftKings | +0.0064 [+0.0036, +0.0094] | +0.0056 [+0.0029, +0.0084] | |
| Chance of the Over (it happened 45.9%) | 44.6% | 45.8% | 45.6% |
| Mean distance of a chance from 50% | 9.5 points | 9.0 points | 6.2 points |
| Lines where it and DraftKings differ by 10+ points | 21.1%, carrying 98% of the deficit | 19.8%, carrying 102% | |
| Guess of the stat (mean absolute error) | 3.19 | 3.20 | 3.11 (the line) |

**Candidate A against `tools/props.js`, on the same lines:**

- Log loss -0.0021 [-0.0037, -0.0005].
- Brier -0.0009 [-0.0016, -0.0002].

**By stat** (log loss: tools/props.js → candidate, DraftKings in brackets):

| Stat | Log loss | Note |
|---|---|---|
| Points | 0.7172 → 0.7143 (0.6884) | still furthest behind |
| Rebounds | 0.7008 → 0.6966 (0.6925) | |
| Assists | 0.6850 → 0.6814 (0.6758) | |
| Threes | 0.6737 → 0.6739 (0.6654) | |
| Steals | 0.6529 → 0.6515 (0.6539) | now just ahead of DraftKings |
| Blocks | 0.6345 → 0.6345 (0.6349) | |
| Points + rebounds + assists | 0.7160 → 0.7139 (0.6883) | |
| Points + rebounds | 0.7100 → 0.7104 (0.6861) | |
| Points + assists | 0.7138 → 0.7130 (0.6870) | |
| Assists + rebounds | 0.7031 → 0.6967 (0.6905) | |
| Steals + blocks | 0.6874 → 0.6858 (0.6865) | now just ahead of DraftKings |

**Flat one-unit bets at the closing price** (the model's chance of a side beating its price's implied chance by the edge):

| Edge | tools/props.js: Overs | tools/props.js: Unders | Candidate A: Overs | Candidate A: Unders |
|---|---|---|---|---|
| 3 points | 967 bets, -106.4 (-11.0%) [-181.4, -32.0] | 4,271, +135.3 (+3.2%) [-47.0, +315.6] | 1,201, -120.3 (-10.0%) [-198.7, -42.0] | 3,579, +159.0 (+4.4%) [-14.5, +332.9] |
| 5 points | 616, -101.3 (-16.4%) | 3,279, +65.5 (+2.0%) | 770, -106.8 (-13.9%) | 2,659, +76.7 (+2.9%) |
| 8 points | 316, -86.3 (-27.3%) | 2,063, -6.8 (-0.3%) | 393, -87.9 (-22.4%) | 1,626, -2.9 (-0.2%) |

The 3-point row's brackets are 90% intervals on the units, from 10,000 resamples of the 83 games (seed 0), as
`cand_blend.js` and `cand_select.js` give `tools/props.js`'s (the same brackets come back here). They were added after the
one scoring run, by running `--score` again for them alone; every other number in `results/cand_fix_score.json` is the
same (`results/cand_fix_score_units.log`). On the same resamples, A less `tools/props.js`: Overs -13.8 [-65.5, +37.4],
Unders +23.7 [-30.9, +76.0]. (Until then the brackets here and in the README were scaled from a per-bet spread: about
-213 to -27 and -2 to +320.)

These playoff flat bets are no more evidence of an edge than the old model's were:

- The Overs still lose at every bar.
- The Unders' return is in line with every Under in this run returning -0.7% (README), and is level at 8 points.
- No side's interval clears zero upward, and A's two sides together (+38.7 units, [-149.8, +230.4]) are "up" as
  `tools/props.js`'s are (+28.8 [-166.5, +224.8]), while both trail DraftKings clearly on log loss.

### The constants a new shadow trial would freeze (fitted 2023-2026; `results/cand_fix_score.json` `frozen`)

**Minutes:**

| Constant | Value |
|---|---|
| Half-life | 2 |
| Prior weight | 0.5 (prior from 20 games) |
| Scale | (240 / S over 8+)^1, the side's change shared equally (`kappa` 0) |
| Playoffs | +0.2 (m - 24) |
| Calibration | m + 0.247 - 0.0217 (m - 24) |
| Opening prior | x 0.90 |
| Returners | x 0.85 after 3-9 games missed, x 0.75 after 10+ |
| New club | x 0.85 on his first game |
| Debutants | each claims 2 minutes |

**Rates, pace and the opponent:**

- EARLY_PACE: 0 (dE -1.5).
- Pace exponent: 1.25.
- Opponent exponents: 1 for points, assists, steals and blocks; 0.75 for rebounds and threes.

**The mean:**

| Stat | Shrink toward his own average (beta) |
|---|---|
| Points | 0.886 |
| Rebounds | 0.889 |
| Assists | 0.883 |
| Threes | 0.891 |
| Steals | 0.944 |
| Blocks | 0.938 |

Each stat also carries the four phase multipliers (by the club's games played; points 0.976, 0.998, 1.003, 1.039).

**The spread:**

| Spread exponent C | Stats |
|---|---|
| -0.30 | rebounds |
| -0.15 | points, assists, steals, blocks, points + rebounds + assists, points + rebounds, assists + rebounds, steals + blocks |
| 0 | threes, points + assists |

The copula's rho is 0.40.

Running this live needs `tools/props.js` to carry the extras `cand_fix_lib.js` keeps (`row.x`): the club's games played,
games missed since a player's last appearance, appearances for a new club, and the side's players with no game on record.
Each is known before tip from the replay state and the schedule.

## Honest read

**The parts can be fixed.** The fixes hold across folds: the 2024 fold, which the selection never used (but which is not
blind: above), improves about as much as the folds it chose on, and the playoffs' log score improves too, though their
mean absolute error does not (2.535 to 2.547).

- The biggest gains are in minutes:
  - aim at the mean, not the median, and calibrate the result;
  - when a side is short or over, share the minutes equally rather than in proportion to each player's projection;
  - shade a returning player's minutes.
- After those: the shrink of each mean toward his own average, and a spread that widens for the bench.

The early-season over-projection of points is gone in every past season.

**It closes about a seventh of the gap to DraftKings, and no more.**

- On the archive the candidate beats `tools/props.js` (-0.0021 [-0.0037, -0.0005]).
- It still trails DraftKings by +0.0125 [+0.0065, +0.0189] log loss and +0.0056 Brier, the interval well clear of zero.
- It is still overconfident against the market: 9.0 points from 50% against DraftKings' 6.2. The lines where the two differ
  by 10+ points still carry the whole deficit.
- Points and the points combos are still about 0.025 behind.

Gains on box scores turn into gains against DraftKings only weakly. The playoffs' log score improves by 0.055, the playoff
lines by 0.002. What the market knows that this model does not is not shown here. The trial's diagnosis puts minutes
and the scoring rate about level in the Over misses (`diag_trial.md` table 11g), and its hindsight figure on the minutes
actually played is an upper bound inflated by the game's own results. Who plays tonight, and for how long, is one
candidate, not a finding.

**What the candidate leaves:**

1. **The shape.** With the mean's lean gone, the chance of the Over at a line near his average runs about 2 points low early
   in the season. This is the next part to fix, for example with a minutes mixture under the stats. It would be its own
   change, frozen and scored on its own. The archive has now been used once for this candidate, so it is no longer clean
   for a second look.
2. **The overconfidence.** `vm` and `shrink` move it only a little. A box-score model whose mean is noisier than the line
   cannot see, from box scores alone, when its mean is wrong.

**What it would take to beat DraftKings.** Candidate A would be a better base for whatever comes next: a better mean, a
better spread, no early lean. On this evidence, though, it would not beat DraftKings alone. That needs the market's own
information, for example a blend or a shrink toward DraftKings' fair chance (another candidate), or better minutes from
the live report.

**Caveats:**

- The stage list was chosen from diagnoses that had read the trial's lines and the archive. No constant came from either,
  but the archive is only partly unseen.
- Several kept changes are tiny (`nt`, `debut`, `dE`, each 0.0001 or less on a fold). They pass the rule but could be
  noise.
- The archive is playoffs. The trial's regime is the regular season's opening weeks, where only a new shadow trial can
  score it.

## Re-running

```
node research/props_v2/cand_fix.js --verify    # about 3 minutes
node research/props_v2/cand_fix.js --select    # about 42 minutes (two folds in parallel a stage)
node research/props_v2/cand_fix.js --score     # about 13 minutes; the archive once
```

The files, all in `research/props_v2/`:

| File | What |
|---|---|
| `cand_fix_lib.js` | the replay, fit and projection with the changes |
| `cand_fix.js` | the three modes above |
| `results/cand_fix_verify.json` | every change off against `tools/props.js` |
| `results/cand_fix_select.json` and `.log` | each stage's fit and scores |
| `results/cand_fix_rule.json` | the frozen rule |
| `results/cand_fix_score.json` and `.log` | the one scoring, and the frozen constants |
