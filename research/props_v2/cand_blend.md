# Candidate B: anchor to the market

## The rule, written down before it was scored (5 November 2026, 17:42 UTC)

This section was written before `cand_blend.js` produced any score for a candidate on the archive. The script was then
run once for the scores (its `--check` mode, run before that, reproduces the published model and market numbers and
tests the fitting on made-up data, and prints no candidate score).

**The candidate.** For a DraftKings main line with both prices:
- q is DraftKings' fair chance of the Over, by the hub's rule (`FAIR.main`: 1 minus the Under's implied chance).
- m is `tools/props.js`'s chance of the Over (`pOver` on its mean and spread).

The candidate's chance of the Over is

  p = σ( logit q + w · (logit m − logit q) ),

where w is the share of the model's disagreement that is kept, clamped to [0, 1]: 0 is DraftKings alone, 1 the model
alone. There is no intercept, so the candidate moves off DraftKings only in the direction the model disagrees.

**Variants.**
- B1, pooled: one w for every stat.
- B2, per stat: one w for each of the eleven stats.

w is fitted by maximum likelihood on log loss (Newton's method, on a convex objective), then clamped.

**The model.** The walk-forward's 2026 fold (`research/props.json`, constants fitted on 2023-2025), projected as the
walk-forward projects it, with the box's list as the side. This must reproduce the README: 11,395 graded lines, log loss
0.6934 against 0.6788. The data is cut to seasons up to 2026 before anything is read. No line, box score or call of
2026-27 is read.

**Out of sample.** Leave one game out (83 folds): each game's lines are scored at the w fitted on the other 82 games.

- **Primary:** B1 under leave one game out.
- **Robustness:** leave one series out (17 groups) and leave one round out (5).

**Described, not tested.**
- The archive's own optimum w* (unclamped), with a 90% interval from refitting on 2,000 resamples of games (seed 0).
  Its score is in sample and labelled so.
- A curve of the difference at fixed w (0, 0.05, ..., 1), with intervals. The best point on it is picked on the archive,
  so it is not a test.

**Control (not a candidate).** C tempers the model with no market: p = σ(t · logit m), with t fitted the same way
(leave one game out). It shows how much of what B gains comes from tempering the model's overconfidence alone.

**Scores.** Each is taken against DraftKings' fair chance on the same lines:
- log loss and Brier, with the difference and a 90% interval from 10,000 resamples of games (`tools/props.js` `bootCI`,
  seed 0);
- the chance of the Over said, against what happened;
- flat one-unit bets at the closing price, where the candidate's chance of a side beats its price's implied chance by
  3 points, Overs and Unders apart (`tools/props.js` `flatBets`), with a 90% interval on each side's units from
  resampling games.

**What counts.**
- B beats the market alone out of sample only if its leave-one-game-out log-loss difference has a 90% interval wholly
  below zero.
- A point estimate below zero with the interval across zero is "not shown".
- B2's per-stat results are read as a whole: with eleven stats, one clearing the bar by chance is likely.

**The box-score walk-forward.** The candidate needs a DraftKings price, and the box scores of 2022-2026 carry none. ESPN
keeps no regular-season lines before the hub's own record, which is 2026-27 and out of bounds.
- On the 2025 and 2026 folds the candidate is therefore `tools/props.js` exactly. Its means and spreads are unchanged,
  and its mean absolute error and log score are props.js's by construction.
- They are recomputed here (each fold's constants fitted on the seasons before it, the data cut to 2026) and checked
  against `research/props.json`.
- The nearest test is on the archive. At a posted line, the candidate's distribution is props.js's negative binomial
  with its mean moved until its chance of the Over is the candidate's, the spread rule unchanged. That moved mean is
  scored for mean absolute error and the stat for log score, against props.js's own, on the archive's graded lines,
  with w from leave one game out.

**What it spends.** Fitting a weight on the archive uses the archive up. After this run it is no longer a clean one-shot
check for any market-anchored candidate.

## Results

The rule above was written at 17:42 UTC. `--check` ran at 17:45 and the one scoring run at 17:47; nothing was changed
between them. The check reproduced the published numbers:
- the archive: 11,395 lines on 83 games, log loss 0.6934 against 0.6788;
- the model's flat bets: Overs 967 bets, −106.4 units; Unders 4,271 bets, +135.3 units;
- the walk-forward's 2025 and 2026 folds, every stat's mean absolute error and log score, to the digit.

The fitting recovered known shares on made-up data, and the inversion of the mean is exact to 4e-15. Every table is in
`results/cand_blend_tables.md` (A to G), and every number in `results/cand_blend.json`.

### The answer: no weight above zero is shown to beat DraftKings alone

Out of sample on the archive, each against DraftKings' fair chance on the same 11,395 lines, with 90% intervals from
resampling games:

| Chance | Log loss diff [90%] | Brier diff [90%] | Over said (hit 45.9%) | Distance from DraftKings |
|---|---|---|---|---|
| The model alone (fitted 2023-2025) | +0.0147 [+0.0083, +0.0214] | +0.0064 [+0.0036, +0.0094] | 44.6% | 6.7 pts |
| **B1 pooled, leave one game out (primary)** | **+0.0002 [−0.0004, +0.0008]** | +0.0001 [−0.0002, +0.0004] | 45.5% | 0.6 pts |
| B2 per stat, leave one game out | +0.0001 [−0.0006, +0.0008] | +0.0001 [−0.0003, +0.0004] | 45.6% | 1.0 pts |
| B1, leave one series out | +0.0002 [−0.0004, +0.0008] | +0.0001 [−0.0002, +0.0004] | 45.5% | 0.6 pts |
| B1, leave one round out | +0.0001 [−0.0008, +0.0010] | 0.0000 [−0.0004, +0.0005] | 45.4% | 0.9 pts |
| C, the control: model tempered, no market | +0.0066 [+0.0035, +0.0097] | +0.0031 [+0.0017, +0.0046] | 47.2% | 4.9 pts |

**The fitted share.** It is small and stable: w = 0.09 in every fold (leave one game out 0.073 to 0.127, series 0.042 to
0.150, round 0.060 to 0.175), and never clamped.

**The archive's own optimum**, in sample: w* = 0.091 with a 90% interval of −0.066 to +0.253, which takes in zero. Even
in sample, w* gains only −0.0002 [−0.0007, +0.0004] on DraftKings.

**Fixed weights.** On the curve of fixed w (table E):
- No w from 0.05 to 1 has an interval wholly below zero.
- The best point, w = 0.10, is −0.0002 [−0.0007, +0.0004].
- From w = 0.55 up, the interval is wholly above zero: the blend is worse than DraftKings.
- Halfway (w = 0.5) is +0.0030 [−0.0001, +0.0061].

**So B, fitted honestly, collapses onto DraftKings.** It is DraftKings' chance moved 0.6 points on average toward the
model, and it scores DraftKings' number. By the rule's own test (an interval wholly below zero) it does not beat the
market, under any of the three hold-outs, pooled or per stat.

### Flat bets at a 3-point edge (the closing price; units with 90% from resampling games)

| Chance | Overs: bets, won, units | Unders: bets, won, units |
|---|---|---|
| The model alone | 967, 442, −106.4 (−11.0%) [−181.4, −32.0] | 4,271, 2,357, +135.3 (+3.2%) [−47.0, +315.6] |
| DraftKings alone | none | none |
| B1, leave one game out | none | 115, 52, −18.7 (−16.2%) [−54.5, +13.1] |
| B2, leave one game out | 3, 1, −0.9 | 511, 270, −15.8 (−3.1%) [−62.2, +29.5] |
| C, leave one game out | 953, 319, −155.8 (−16.3%) [−231.4, −81.3] | 2,347, 1,122, −59.8 (−2.5%) [−194.6, +73.4] |

B almost never bets, and that is built into it, not a finding:
- **Overs.** DraftKings puts its whole margin (about 7 points) on the Over. To bet an Over, B must move about 10 points
  above DraftKings' fair chance.
- **Unders.** To bet an Under, B must move 3 points below it. At w ≈ 0.09 that takes a model disagreement of around 30
  points, which is exactly the kind of line the trial's diagnosis found DraftKings right on.
- **The few bets it made lost.** None of the five rows' intervals separates from zero.

### By stat (leave one game out; the in-sample optimum per stat, described, not tested)

| Stat | Model alone | B1 pooled | B2 per stat | Archive's w* [90%] |
|---|---|---|---|---|
| Points | +0.0288 | +0.0011 [+0.0002, +0.0021] | 0.0000 (w clamped to 0 in all 83 folds) | −0.098 [−0.297, +0.111] |
| Rebounds | +0.0082 | −0.0006 [−0.0014, +0.0003] | −0.0006 [−0.0031, +0.0020] | 0.272 [+0.027, +0.523] |
| Assists | +0.0092 | −0.0004 [−0.0012, +0.0005] | 0.0000 [−0.0023, +0.0022] | 0.232 [−0.030, +0.521] |
| Threes | +0.0083 | +0.0001 | +0.0011 [+0.0002, +0.0021] | 0.100 [−0.273, +0.490] |
| Steals | −0.0010 | −0.0005 [−0.0010, −0.0001] | −0.0008 [−0.0040, +0.0024] | 0.592 [+0.101, +1.121] |
| Blocks | −0.0005 | −0.0005 [−0.0011, +0.0000] | −0.0008 [−0.0042, +0.0024] | 0.537 [+0.077, +1.010] |
| Pts+reb+ast | +0.0277 | +0.0009 | +0.0004 [+0.0002, +0.0007] | −0.005 [−0.223, +0.233] |
| Pts+reb | +0.0239 | +0.0008 | +0.0005 [+0.0003, +0.0008] | 0.001 [−0.209, +0.226] |
| Pts+ast | +0.0267 | +0.0009 | +0.0003 [+0.0001, +0.0006] | −0.020 [−0.265, +0.225] |
| Ast+reb | +0.0127 | −0.0001 | +0.0003 [−0.0016, +0.0024] | 0.179 [−0.062, +0.438] |
| Stl+blk | +0.0010 | −0.0004 | +0.0008 [−0.0021, +0.0039] | 0.419 [−0.223, +1.024] |

**The useful finding here is a diagnosis, not a candidate.**
- **Points and its combos.** The model's disagreement with DraftKings carries no information: the share is −0.10 to
  0.00, and B2 drops points altogether. These are the lines the model loses most on, through the minutes and scoring
  rate the trial diagnosis found.
- **Rebounds, steals and blocks.** It does carry some. Their in-sample shares are 0.27, 0.59 and 0.54, with intervals
  above zero. The model alone is already level with DraftKings on steals and blocks.
- **Out of sample**, per-stat weights do not turn that into a gain that can be measured. B2 is level with B1, and its
  intervals all cross zero, except where fitting a share near zero costs a little: threes and the points combos.
- **The one stat interval below zero.** B1's steals interval, −0.0005 [−0.0010, −0.0001], is wholly below zero. That is
  one of eleven stats, and was read as a whole, as the rule said it would be.

### The control: tempering alone is not enough

Shrinking the model's chance toward 50% with no market (C, t ≈ 0.48 in every fold) halves the deficit, from +0.0147 to
+0.0066, but leaves it clearly behind DraftKings. It also pushes the Over up (47.2% said where 45.9% happened), and its
Overs then lose −155.8 units, because DraftKings shades the Over.

So the model's overconfidence explains about half the gap. The rest is information DraftKings has and the model lacks.
Tempering cannot fix that, and anchoring to the market only hides it.

### The box-score walk-forward

The candidate needs a price, and the box scores of 2022-2026 have none. On the 2025 and 2026 folds the candidate is
therefore `tools/props.js` exactly (table G):
- points: mean absolute error 4.55 and 4.51, log score 3.0147 and 3.0192;
- every stat matches `research/props.json` to the digit;
- minutes: 4.83 and 4.82.

The difference is zero by construction, so the walk-forward cannot judge this candidate.

The nearest test is on the archive, at the posted lines (table F). The candidate's distribution is the model's negative
binomial with its mean moved to the candidate's chance. Measured at the lines:
- **Mean absolute error:** B1 3.099, against props.js's 3.194 and the line's 3.109.
- **Log score of the stat:** B1 2.4423, against props.js's 2.4622.

DraftKings' own fair chance on the same shape gives 3.098 and 2.4425, so the improvement is DraftKings', not the
blend's.

### Honest read

1. **No weight above zero beats DraftKings alone out of sample on the archive.** The honest share of the model's
   disagreement is about 0.09. Its interval takes in zero even in sample, and the blend at that share ties DraftKings
   (+0.0002 [−0.0004, +0.0008]).
2. **B is not a second model.** It is DraftKings' chance, nudged:
   - It bets almost never (115 Unders in 83 games, which lost).
   - Its distribution's gain over props.js is DraftKings' own.
   - On the box scores it is props.js unchanged.
   - Showing it on the page would show DraftKings' price back to the reader under the model's name.
   - **I do not recommend it for a shadow trial.** A trial able to separate the in-sample gain of 0.0002 from zero would
     need about 220,000 graded lines. That is about two regular seasons at the trial's 106 lines a game: the 90% interval
     needs to clear zero 80% of the time, and the out-of-sample spread here is 0.00036 per mean over 11,395 lines. Even
     if it passed, there would be nothing to bet.
3. **What B is good for is a yardstick.** The share a model earns against DraftKings measures what it knows that the
   market does not:
   - props.js earns about 0.09 overall, about zero on points and its combos, and 0.3 to 0.6 on rebounds, steals and
     blocks.
   - A second model is worth a trial only if it earns a share clearly above zero. On points, where the money and the
     loss are, it earns none now.
   - The minutes and rate fixes the diagnosis points to are where that has to come from. Recalibration alone does not
     get there: the control C is still +0.0066.
4. **What this run spent.**
   - The archive has now been used to fit a share against DraftKings, so it is no longer a clean one-shot check for any
     market-anchored candidate.
   - It stays clean for a box-score model frozen elsewhere, scored once on its own chance.
   - DraftKings' fair-chance rule (the whole margin on the Over) was itself chosen on this archive, which favours the
     market a little in every row here, as it does for every candidate.

### Files

Re-run with `node research/props_v2/cand_blend.js` from the worktree; it takes about 90 seconds. `--check` runs only the
reproductions and the tests on made-up data.
- `cand_blend.js`
- `results/cand_blend.json`
- `results/cand_blend_tables.md`
