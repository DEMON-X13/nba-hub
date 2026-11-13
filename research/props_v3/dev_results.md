# MA on its development bar

Research only, 13 November 2026. This is the second half of the owner's ask of 11 November ("i also want to figure out
why the model failed and if we can build a more reliable one"): MA, the candidate `PLAN.md` describes, built on its own
projections and held to the development bar of `PLAN.md` section 2, criterion by criterion, as written before any of its
scores was seen. `why_it_failed.md` is the first half. Revised the same day after a review of these results (section 9):
its eleven findings were all real; the test's machinery was fixed, T1 (and D1) made independent of the nudge's scale,
and several sentences made more careful. No criterion was loosened and the verdict is unchanged.

The data are development data only. DraftKings' 2023-24 regular-season lines on ESPN's provider-40 feed were scored once
before, against props_v2's A on 6 November 2026, so they are development data here, said. The 2026 play-in and playoff
archive (`data/props_2026.csv`) is spent and serves only D8's sign check. No 2022-23 prop line was fetched, read or
scored, and no file of the 2026-27 season in play was opened.

## In plain English

- **The answer: MA does not meet its development bar as written.** It meets seven of its nine criteria, D1 to D7 (D1
  under the review's stronger form too). It misses D8, the sign check on the spent 2026 playoff lines, by a hair. D9's
  machinery was left part built once D8 had stopped the plan (the review then fixed the test's fetch, its left-out games
  and its hash checks, which were wrong; the shadow's runner and V4's tightening are still not written). By `PLAN.md`
  section 7 a miss stops the plan, so **DraftKings' 2022-23 lines, the one clean test season, stay unfetched and
  unspent**, and nothing on the page or in the job changes. The site keeps DraftKings' own chance.
- **What MA showed on development data.** MA starts from DraftKings' fair chance, reads DraftKings' level for each
  player off his other lines in the game, and nudges a line where the hub's box scores give him a different stat mix at
  that level. Fitted month by month on the months before and scored on the rest of 2023-24 (68,850 lines on 863 games),
  the nudge added information beyond DraftKings' price and beyond every information-free adjustment the plan names: a
  weight of 1.22 [1.07, 1.37] on it, where the bar asks for an interval above 0.25, 13.7 standard errors clear of zero
  where the review's stronger bar asks for 4, and 0.0011 log loss a line [0.0008, 0.0014] at its fitted size. The gain
  is clear on steals, blocks and threes; on rebounds and assists it is not established once five stats are tested
  together (their corrected intervals reach 0). On points it helps nothing, and its weight there is 0 by the plan's
  rule. None of 66 information-free rivals met either criterion at its fitted size; but the weight bar alone moves with
  a nudge's scale, and five of the 24 scaled or regularised rivals the review built cleared it with no player information.
  None of them, and none of the 66, comes near the four standard errors: the highest stands at 2.85. Its link to the
  minutes a player went on to play is small, a correlation of 0.028 [0.012, 0.044], under the bar's 0.05 but not zero,
  and it moves early exits as it moves everyone else.
- **More reliable, in the calibration sense, yes, on development data.** The old model was far too sure of itself (a
  calibration slope of about 0.27). MA's chance is calibrated on rebounds, assists, threes, steals and blocks: slopes
  0.90 to 1.08, each measured close to 1. On points it is poorly measured, 0.70 [0.45, 0.95], as DraftKings' own fair
  chance is, 0.79 [0.51, 1.06], because nearly every points line sits close to even. On the same lines MA's log loss is
  0.0018 a line better than DraftKings' fair chance and 0.012 better than `tools/props.js` and props_v2's A. About a
  sixth of the gain on DraftKings is MA's information-free part, which corrects the hub's devig rule and needs no player
  information; on the spent playoff archive that part did not carry, and MA was a little worse than DraftKings' fair
  chance there (0.0004 a line, well inside its noise: section 5).
- **Why it stops.** MA was frozen on all of 2023-24 and applied to the 2026 play-in and playoff lines (83 games). The
  weight on its nudge is positive there, 0.78 [0.24, 1.32], as D8's sign check asks, though not by T1's own standard
  (the lower bound 0.244 is under 0.25, and it stands 2.4 standard errors from zero, under 4). And at its frozen size it
  does not lower the log loss: **+0.000025 a line [−0.00096, +0.00102], where D8 asks for 0 or below**. That miss is
  tiny and well inside its own noise. The review found its sign turns on how the 83 games happen to be split into folds
  when the bar's reference is cross-fitted: on 40 other random splits it comes out above 0 on 40% of them, its spread
  twice the miss. The archive also differs from the test in ways that may count against MA (playoff games; P23's
  constants four seasons old there against one season for 2022-23), besides being small (83 games). But D8 and its
  split were written before any score, and the plan says a miss stops it. The bar was not moved.
- **What the evidence supports.** A model anchored on DraftKings' price that is calibrated and a little better than
  DraftKings' fair chance on development data, its extra information shown on development data alone. Not that it beats
  DraftKings on a season it has never seen: that test was not run. On the one later season checked, the spent playoffs,
  the weight on the nudge was positive but did not pay at its frozen size, a sign the archive is too small to settle.
- **What could come next is the owner's call** (section 8): leave it here; run MA as a quiet forward shadow on 2026-27
  with a bar of its own registered first; or build another candidate on development data, keeping 2022-23 unspent for
  it. Spending 2022-23 on MA now would set aside a criterion after seeing it missed, which the hubs' rules allow only by a
  new plan that says so.

## 1. What was built

- **The 2020-21 box scores**, P23's warm-up history (`fetch_box2021.js`, into the gitignored `cache/box2021/`): ESPN's
  scoreboard for each of 191 days, then each game's summary, 1,362 requests, every one HTTP 200 and logged in
  `cache/box2021/requests.tsv`; 1,171 games parsed, 31,571 player rows and 2,342 team rows. The six play-in boxes carry
  no minutes and are left out of the replay (`results/ma_p23.json`, `droppedNoMinutes`).
- **P23**, the projection layer (`ma/p23_fit.js` → `results/ma_p23.json`): `tools/props.js`'s own fit, its structure and
  grids unchanged, on 2021-22 alone (33,536 training rows), 2020-21 warming up. Nothing of 2022-23 or later is in the
  fit, which refuses such a game. `ma/ma_lib.js`'s replay, which reads each posted player before his game's results, is
  checked row for row against `tools/props.js`'s own replay on 2021-22 (`verifyReplay`, which throws on any difference).
- **MA's rows** (`ma/ma_rows.js` → `cache/ma/rows_<set>.json`, gitignored): for every posted line of the six base stats
  with both prices, DraftKings' fair chance by the hub's rule (the whole margin on the Over: fair Over = 1 − the Under's
  implied chance), P23's mean at a nominal 30 minutes, DraftKings' implied mean, the player-game's level κ and the mix's
  disagreement d (PLAN.md 1.1). On 2023-24: 92,295 posted lines on 1,116 games. The club rule of PLAN.md 1.5 (his last
  club on an earlier box) leaves out 394 of them (305 whose club on record is not one of the game's two, 89 with no box
  on record), which leaves 91,901 in the sample, 88,739 graded and 3,162 void. No line is a push, and every graded line
  in the sample has a projection. Only 12 graded lines are on player-games with a single posted line. The archive: 6,590
  posted lines, 6,418 graded and 172 void, none left out by the club rule.
- **The references for D4** (`ma/refs.js` → `cache/ma/refs_2024.json`): `tools/props.js`'s 2024 fold and props_v2's A on
  the same lines, as props_v2 scored them.
- **The development bar** (`ma/dev_bar.js`, `ma/dev_lib.js`, `plan_sizing/lib.js`), the rivals (`ma/dev_rivals.js`), the
  leak checks (`ma/dev_leaks.js`), the archive's sign check (`ma/dev_archive.js`), the reports (`ma/dev_report.js`), and
  the test step's machinery (`test/`, section 6).
- **The review's checks** (section 9): the scaled and regularised rivals (`ma/dev_scale.js`), the statistical findings
  (`ma/dev_review.js`), and the test's machinery on planted cases (`test/machinery_check.js`, `test/inputs.js`,
  `test/fetch_record.js`, `test/seen_2023.json`). After the review `ma/dev_bar.js`, `ma/dev_rivals.js` and
  `ma/dev_archive.js` were run again with the strengthened T1: every earlier figure came back the same (and
  `cache/ma/dev_oof.json` byte for byte), with z and D1 as first written beside.

## 2. The development bar, criterion by criterion

The protocol is PLAN.md section 2's. The nudge's weights and E are fitted on the months before each month from December
to April (October and November only train). The 68,850 out-of-fold lines on 863 games are scored together, with F, the
information-free family of 194 columns, cross-fitted on them. Intervals are 90%, by resampling games (seed 0).

| | What the bar asks | MA | |
|---|---|---|---|
| D1, information | in logit P(Over) = F + b·n, b's interval (1,000 resamples) wholly above 0.25, z = b / SE at least 4 (added by the review, section 9), and 5% of n's variance outside F | b 1.218 [1.073, 1.365]; z 13.7; 82.7% outside F | met |
| D2, value | n added to cross-fitted F: log loss's interval (10,000 resamples) wholly below −0.0001, Brier's below −0.00005, no stat's log loss wholly above 0 | log loss −0.00112 [−0.00140, −0.00083], Brier −0.00052 [−0.00065, −0.00038]; no stat above 0 | met |
| D3, power | at half the effect, 1,100 games at 74 lines, T1 (both its parts) and T2 (both its criteria at once) each met with probability 0.8 or more | T1 0.997, T2 0.867 | met |
| D4, references | MA's chance beats DraftKings' fair chance, `tools/props.js`'s 2024 fold and props_v2's A, log loss and Brier, each interval wholly below 0 | −0.00183, −0.01250, −0.01221 a line (table below) | met |
| D5, calibration | per stat: (a) mean chance within 1.5 points of the Over rate; (b) slope's interval reaching into [0.8, 1.25]; (b') not clearly more than 5% further from 1 than DraftKings' slope | every stat (table below) | met |
| D6, rivals | the shuffles and every named, held-out and critique rival fail D1 and D2 (and, since the review, the scaled and regularised rivals) | none of 66 meets either (the highest lower bound on b 0.109, the highest z 2.85), nor any of the review's 24 (z at most 2.85) | met |
| D7, leak checks | the six checks of PLAN.md 1.5 | all six (section 4) | met |
| D8, the archive | frozen on all of 2023-24, on the spent archive: T1's b point above 0, **T2's log-loss point at or below 0** | b 0.780; **T2 +0.000025** | **not met** |
| D9, machinery | the fetch, P23's fit, the freeze, the test's fetch, validity checks and scorer, the shadow's runner, the planted in-game prices | part built (section 6) | not finished |

**By the bar as written, MA does not meet its development bar.** D8 decides it on its own. D9 is not finished either,
which would not have changed the verdict: D9 is a list of things to build before a preregistration, and with D8 missed
none will be written.

**D2 by stat**, the nudge's paired log-loss difference a line, × 10⁻⁴ (10,000 game resamples; the last two rows the
review's, `results/ma_dev_review.json` S2):

| | points | rebounds | assists | threes | steals | blocks |
|---|---|---|---|---|---|---|
| the difference | 0 (weight 0) | −6.6 | −5.0 | −8.7 | −28.6 | −14.1 |
| 90% interval, seed 0 (the bar's) | 0 | [−13.1, −0.2] | [−10.0, −0.2] | [−14.0, −3.4] | [−39.5, −18.1] | [−21.8, −6.1] |
| 90% interval, seed 1 | 0 | [−13.1, +0.04] | [−9.9, −0.2] | [−14.0, −3.4] | [−39.4, −18.0] | [−21.9, −6.3] |
| 98% interval (five stats tested: Bonferroni), seed 0 | 0 | [−15.8, +2.6] | [−11.8, +1.9] | [−16.1, −1.3] | [−44.0, −13.7] | [−25.2, −2.8] |

D2 asks only that no stat's interval lie wholly above 0, which holds. What the rows say beyond that: the nudge's gain
is clear on steals, blocks and threes, whose intervals stay below 0 under the correction for five stats (98.33%, for
six, too). On rebounds and assists it is not established: their uncorrected intervals clear 0 by 0.2 × 10⁻⁴, which
another seed takes away for rebounds, and corrected they reach 0.

**D3.** The standard errors scaled to the test's 1,100 games at 74.4 graded lines a game, the larger of the two
scalings: at half the development effect, T1 0.997 (both its parts; the weight bar alone 0.997, z alone 1.000, so the
review's z part does not bind there) and both T2 criteria at once 0.867 (log loss alone 0.882, Brier alone 0.871).
Reported beside: 0.800 at 900 games; with the effect reweighted to the price mix of 2022-23's 31 seen games, which keeps
0.98 of it, 0.828.

**D4**, MA's chance less each reference, a line, 90% interval (10,000 game resamples):

| MA less | log loss | Brier |
|---|---|---|
| DraftKings' fair chance | −0.00183 [−0.00226, −0.00139] | −0.00082 [−0.00101, −0.00062] |
| `tools/props.js`'s 2024 fold | −0.01250 [−0.01409, −0.01090] | −0.00520 [−0.00585, −0.00454] |
| props_v2's A | −0.01221 [−0.01370, −0.01072] | −0.00522 [−0.00585, −0.00457] |

Against DraftKings this is partly E, MA's information-free part. E alone, without the nudge, is −0.00032 [−0.00065,
−0.000005] against DraftKings' fair chance on log loss, an interval that only just clears 0, and −0.00012 [−0.00026,
+0.00002] on Brier, which includes it: it corrects the hub's devig rule, which puts the whole margin on the Over.

**D5**, per stat. "Mean less Over rate" is the mean chance less the share of Overs that landed, in points (negative:
the chance under-says the Over); the slope is s in P(Over) = sigm(α + s·logit P); (b') is the interval of |ln s_MA| −
|ln s_DK| (1,000 game resamples, both slopes refitted in each), which must not lie wholly above ln 1.05 = 0.049.

| | lines | MA: mean less Over rate | DraftKings | MA's slope | DraftKings' slope | (b') | claim |
|---|---|---|---|---|---|---|---|
| points | 11,550 | +0.10 | −1.66 | 0.70 [0.45, 0.95] | 0.79 [0.51, 1.06] | [−0.040, +0.164] | poorly measured |
| rebounds | 12,331 | +0.89 | 0.00 | 0.90 [0.78, 1.02] | 1.03 [0.89, 1.17] | [−0.134, +0.161] | calibrated |
| assists | 7,463 | +0.73 | −2.27 | 1.06 [0.89, 1.22] | 0.93 [0.78, 1.09] | [−0.158, +0.133] | calibrated |
| threes | 11,724 | −0.72 | −2.06 | 0.96 [0.89, 1.03] | 1.02 [0.94, 1.10] | [−0.062, +0.063] | calibrated |
| steals | 12,964 | +0.02 | −0.16 | 1.08 [1.01, 1.15] | 1.07 [1.00, 1.14] | [−0.013, +0.032] | calibrated |
| blocks | 12,818 | +0.51 | −1.95 | 1.06 [1.00, 1.12] | 0.88 [0.84, 0.93] | [−0.171, +0.042] | calibrated |

Each stat meets (a), (b) and (b'). "Calibrated" is the plan's narrower claim: the slope's point in [0.8, 1.25] and its
interval wholly inside [0.67, 1.5]. On points neither MA nor DraftKings can be shown calibrated on these lines. The
critic's fuller version of D5 (C3), which PLAN.md section 8 took in part before any of MA's scores was seen, would have
failed points for MA and for DraftKings alike; it is not the bar, and D8 decides the verdict either way. The ten-band
reliability tables per stat, MA's and DraftKings', are in `results/ma_dev_bar.json` (D5, `bands`).

## 3. The reports beside the bar, deciding nothing

`results/ma_dev_report.json`: MA's chance (the forward-chained E + n), DraftKings' fair chance, `tools/props.js`'s 2024
fold and props_v2's A on the same 68,850 out-of-fold lines. "MA less DraftKings" is a line's log loss, × 10⁻⁴, 90%
interval (2,000 game resamples); "the nudge" is D2's figure on that part of the lines.

| lines | n | Over rate | MA | DraftKings | `tools/props.js` | props_v2's A | MA less DraftKings | the nudge |
|---|---|---|---|---|---|---|---|---|
| all | 68,850 | 0.452 | 0.6651 | 0.6669 | 0.6775 | 0.6773 | −18.3 [−22.4, −13.9] | −11.2 [−13.9, −8.3] |
| points | 11,550 | 0.483 | 0.6919 | 0.6923 | 0.7156 | 0.7133 | −4.0 [−9.2, +1.1] | 0 |
| rebounds | 12,331 | 0.464 | 0.6846 | 0.6848 | 0.7004 | 0.6998 | −2.1 [−9.1, +5.3] | −6.6 [−12.9, −0.2] |
| assists | 7,463 | 0.481 | 0.6854 | 0.6870 | 0.7075 | 0.7084 | −16.2 [−28.8, −3.1] | −5.0 [−9.9, −0.4] |
| threes | 11,724 | 0.477 | 0.6705 | 0.6726 | 0.6777 | 0.6775 | −21.0 [−28.3, −13.5] | −8.7 [−13.9, −3.3] |
| steals | 12,964 | 0.473 | 0.6624 | 0.6657 | 0.6689 | 0.6690 | −33.3 [−44.1, −22.7] | −28.6 [−39.0, −18.4] |
| blocks | 12,818 | 0.353 | 0.6080 | 0.6110 | 0.6124 | 0.6131 | −30.2 [−43.3, −17.2] | −14.1 [−21.7, −5.8] |
| December | 16,257 | 0.451 | 0.6697 | 0.6710 | 0.6804 | 0.6807 | −13.4 [−23.3, −2.8] | −8.2 [−14.2, −2.1] |
| January | 11,884 | 0.447 | 0.6657 | 0.6674 | 0.6768 | 0.6759 | −17.1 [−26.7, −7.7] | −10.6 [−16.7, −4.1] |
| February | 13,374 | 0.459 | 0.6625 | 0.6641 | 0.6727 | 0.6724 | −16.9 [−25.9, −8.2] | −6.3 [−12.4, −0.1] |
| March | 18,241 | 0.450 | 0.6630 | 0.6651 | 0.6754 | 0.6752 | −20.8 [−28.5, −13.4] | −15.3 [−20.4, −10.0] |
| April | 9,094 | 0.456 | 0.6637 | 0.6663 | 0.6850 | 0.6842 | −25.4 [−39.3, −12.2] | −16.4 [−26.9, −6.8] |
| the Over favoured | 17,011 | 0.569 | 0.6780 | 0.6796 | 0.6900 | 0.6903 | −15.8 [−23.5, −7.6] | −11.1 [−17.6, −4.2] |
| the Under favoured | 51,839 | 0.414 | 0.6608 | 0.6627 | 0.6735 | 0.6730 | −19.1 [−24.2, −14.2] | −11.3 [−14.5, −8.0] |
| at home | 34,578 | 0.455 | 0.6648 | 0.6665 | 0.6770 | 0.6767 | −17.5 [−23.3, −11.6] | −10.0 [−13.9, −5.8] |
| away | 34,272 | 0.449 | 0.6653 | 0.6672 | 0.6781 | 0.6779 | −19.1 [−25.2, −12.9] | −12.4 [−16.7, −8.3] |

Brier follows log loss in every row (`results/ma_dev_report.json`). The nudge helps in every month and on both sides.

**Calibration by band**, all stats together: the lines whose chance falls in each band, the mean chance and the Over
rate.

| chance | MA: lines, said, landed | DraftKings | `tools/props.js` | props_v2's A |
|---|---|---|---|---|
| 0.0-0.1 | 23, 0.089, 0.087 | 451, 0.090, 0.102 | 453, 0.076, 0.234 | 414, 0.080, 0.200 |
| 0.1-0.2 | 1,835, 0.162, 0.144 | 2,563, 0.157, 0.188 | 3,025, 0.156, 0.228 | 3,212, 0.156, 0.227 |
| 0.2-0.3 | 4,012, 0.258, 0.253 | 3,570, 0.259, 0.290 | 6,699, 0.258, 0.325 | 7,407, 0.258, 0.328 |
| 0.3-0.4 | 10,962, 0.358, 0.357 | 10,514, 0.351, 0.365 | 14,815, 0.356, 0.414 | 15,665, 0.356, 0.417 |
| 0.4-0.5 | 29,157, 0.456, 0.455 | 31,605, 0.448, 0.456 | 22,665, 0.451, 0.462 | 22,543, 0.450, 0.470 |
| 0.5-0.6 | 18,785, 0.541, 0.535 | 17,045, 0.536, 0.547 | 15,835, 0.544, 0.528 | 15,008, 0.543, 0.532 |
| 0.6-0.7 | 4,032, 0.631, 0.641 | 3,102, 0.621, 0.641 | 4,807, 0.636, 0.598 | 4,210, 0.635, 0.604 |
| 0.7-0.8 | 44, 0.713, 0.750 | none | 516, 0.727, 0.599 | 359, 0.728, 0.607 |
| 0.8-1.0 | none | none | 35, 0.853, 0.629 | 32, 0.849, 0.563 |

The old models' overconfidence shows at both ends (said 8%, landed 23%; said 85%, landed 63%). DraftKings' fair chance
under-says the Over in every band, by 1 to 3 points: that is the whole margin put on the Over. Pooled over the six stats,
MA tracks the Over rate within 2 points in every band with more than a hundred lines. Stat by stat it is looser (D5's
ten-band tables; `results/ma_dev_review.json` N1): its worst band of 100 lines or more is assists' 0.3-0.4, 416 lines,
where it says 5.2 points more than lands (about 2.2 binomial standard errors), then about 2 points in one band each of
rebounds (0.5-0.6, 3,975 lines, 2.4 standard errors), steals (0.2-0.3, 832 lines, 1.3) and blocks (0.1-0.2, 1,744
lines, 2.3), and less on threes and points. D5's per-stat slopes, which decide, are as the table above gives them.

**The blend's weight by stat** (D1's regression on one stat's lines, cluster-robust 90% intervals): rebounds 0.96 [0.63,
1.30], assists 1.48 [0.68, 2.28], threes 1.83 [1.30, 2.36], steals 1.21 [0.99, 1.44], blocks 1.20 [0.90, 1.50]; points
carries no nudge.

## 4. The rivals and the leak checks

**D6** (`results/ma_dev_rivals.json`), each rival refitted in the forward-chained protocol on MA's own projections and
held to D1 and D2:

| rivals | how many | D1: the highest lower bound on b (bar: above 0.25) | D1: the highest z (bar: 4, since the review) | D2: the lowest upper bound on log loss (bar: below −0.0001) |
|---|---|---|---|---|
| MA's d shuffled across players within stat and month | 20 | 0.007 (b −0.13 to +0.14) | 1.74 | +0.00114: every one's interval wholly above 0, so each clearly hurts |
| MA's d shuffled within matched cells (stat, month, position, price band, line) | 20 | 0.101 (b −0.11 to +0.24) | 2.85 | +0.00093: each clearly hurts |
| the named rivals on top of DraftKings' fair chance (R1 to R9, R_all) | 16 | −0.75 (the game lines), three in F's span with no b | −0.86 | 0 (the month, in F's span); every other one clearly hurts, +0.0010 or more |
| the held-out rivals | 7 | 0.109 (DraftKings' own move of the line since his last game) | 2.11 (the same) | 0 (the price band by month, in F's span); then the line's move, +0.00013 [−0.00009 its lower bound]; the rest clearly hurt |
| the critique's three (his other DraftKings lines, by position; F's pairwise products) | 3 | −0.06 | −0.36 | +0.0059: each clearly hurts |

None meets D1 or D2, as first written or as strengthened. No rival's lower bound came within 0.05 of 0.25, nor its z
within 0.5 of 4, so none needed the bootstrap. A rival in F's span comes out a nudge of exactly 0, and fails D2 by
exactly its margin of 0.0001: no nudge, no pass. (Columns where a rival fits nearly inside F, under 5% of its variance
outside it, are left out of the highest lower bound and z, as D1 leaves them out.) Nine of the 66 have a lower bound
above 0 at their fitted size (six matched shuffles, two coarse ones and the line's move), which is why the review's
scaling found D1 as first written too weak (section 9).

**The review's rivals** (`results/ma_dev_scale.json`, finding F2), each held to D1 and D2 as D6 holds a rival: two of
D6's with a lower bound above 0 multiplied by c (1, 0.6, 0.5, 0.4 and 0.3), and four sets fitted the candidate's way
with a ridge on their own columns as well, as a careful rival might be built.

| rivals | sizes or ridges | D1 as first written met at | the highest lower bound on b | the highest z | D1 as strengthened | D2: the lowest upper bound |
|---|---|---|---|---|---|---|
| DraftKings' own move of the line since his last game (U9), scaled | 5 | c 0.4 and 0.3 (at 0.3 by the bar's bootstrap too: [0.258, 2.941]) | 0.363 | 2.11 | none | +0.000007 |
| MA's d shuffled within matched cells (seed 13), scaled | 5 | c 0.4 and 0.3 | 0.336 | 2.85 | none | +0.000043 |
| U9 with a ridge (300 to 10,000) | 4 | none | 0.201 | 2.08 | none | +0.000004 |
| a dummy for each line by price band cell, with U9 and home by favourite, with a ridge (20 to 5,000) | 5 | the ridge of 1,500 | 0.256 | 2.08 | none | +0.000004 |
| every held-out rival at once, with a ridge (100 to 10,000) | 3 | none | −0.285 | 0.11 | none | +0.000017 |
| the critique's three at once, with a ridge (1,000 and 10,000) | 2 | none | −0.137 | 0.51 | none | +0.00051 |

z does not move with c (2.11 and 2.85 at every size): a shrunk rival's weight and interval grow together. None of the
24 meets D2: shrinking an information-free nudge brings its gain toward 0, never below −0.0001.

**D7** (`results/ma_dev_leaks.json`):

- the loader refuses a seventh column, a wrong header and a short row, and takes the six clean columns;
- **the blindfold check:** every input and chance of 210 games on 29 nights (17,497 lines, 16,881 chances) rebuilt from a
  folder holding only the box scores of earlier dates, the night's six-column lines, the schedule to that night with
  its scores taken out, and the night's game lines: the same to the bit;
- **the scramble:** the same nights with each night's own boxes dealt out again among each side's players: nothing
  moves;
- **early exits** (58 player-games, 313 lines: projected 24+ minutes, played the previous game, played under 12): the
  nudge moves DraftKings' fair chance 0.27 points toward the Over there and 0.26 points elsewhere, so 0.009 points less
  toward the Under on exits, where the bar allows half a point more;
- **the minutes surprise:** per player-game, the nudge's correlation with the minutes he went on to play less P23's
  projection is 0.028, under 0.05; by 2,000 game resamples (the review, `results/ma_dev_review.json` F5) its 90%
  interval is [0.012, 0.044], so the link is small but not zero (the level κ's own, read against P23 at the nominal 30
  minutes, is 0.042 [0.022, 0.061]). The blindfold check shows every input is known before tip-off, so this is no leak:
  a player's earlier boxes say a little about his minutes that DraftKings' price does not;
- **the level read without the points line** keeps 0.87 of the nudge's gain on the other stats (−0.00117 against
  −0.00135 as built), where half is asked.

## 5. D8, the archive: the miss

`results/ma_dev_archive.json`. MA frozen on all 88,739 graded development lines (its nudge's weights fitted jointly with
F, E with the frozen nudge as an offset), applied to the archive's six base stats: 6,418 graded lines on 83 games of the
2026 play-in and playoffs, F fitted on them as the bar fits it.

| | D8 asks | MA |
|---|---|---|
| T1, the weight on the nudge | the point above 0 | 0.780 [0.244, 1.316] (robust), 61.8% of n's variance outside F: **met**. Reported, deciding nothing: z 2.40; the test's T1 (lower bound above 0.25, z at least 4) would not hold here |
| T2, the log loss a line at the frozen size | the point at or below 0 | **+0.000025** [−0.00096, +0.00102]: **not met** |
| T2, Brier (reported) | | −0.000010 [−0.00047, +0.00046] |

By stat, × 10⁻⁴: points 0 (weight 0), rebounds −4.6 [−26.6, +18.6], assists −5.7 [−20.2, +9.4], threes +11.3 [−16.3,
+38.8], steals +1.4 [−39.5, +42.6], blocks +0.2 [−28.6, +28.6].

How to read it, without moving the bar:

- The miss is by 0.000025 a line, with an interval forty times wider than that either way. The interval only just leaves
  out the development effect of −0.00112, and contains half of it: the nudge paid less there than on development data,
  by how much the archive's 83 games cannot say.
- **The split decides the sign** (the review, S1; `results/ma_dev_review.json`). T2 compares the nudge with F
  cross-fitted on the archive, five folds of games by a hash of each game id, fixed before any score. On 40 other random
  splits of the 83 games into five folds T2's point estimate averages −0.0000062 with a spread (sd) of 0.000050, twice
  the miss, from −0.000125 to +0.000093, and is above 0 on 40% of them; on ten folds it is −0.000062, one game at a time
  −0.000013. On the 68,850 development lines the same spread is 0.0000035, too small to matter against the bar's
  margins. And F cross-fitted on 83 games is a poor reference there: its log loss is 0.6776 a line, where DraftKings'
  fair chance scores 0.6718 and MA's frozen chance 0.6722 (on development data F and DraftKings are level, 0.6673
  against 0.6669). So on the archive D8's sign is close to a coin toss on the split, which the plan's sign check could
  not tell from a real miss. It is reported as context: D8 and its split were fixed before any score, and choosing
  another split, or averaging over many, now that this one has missed would turn a FAIL into a PASS on a rule chosen
  after the score. (A later plan should read a sign check on a set this small over many splits, or against
  DraftKings' price, chosen before it is scored: `PLAN.md` section 9.)
- MA's own chance (E + n, frozen) is a little worse than DraftKings' fair chance on the archive, 0.6722 against 0.6718 a
  line (+0.00038 [−0.00075, +0.00155]), where on development data it was 0.0018 better; E alone is worse by +0.00060
  [−0.00007, +0.00127] (`results/ma_dev_review.json`). E's correction of the hub's devig rule, fitted on 2023-24's
  provider-40 lines, does not carry to the archive's provider-100 playoff lines, as `PLAN.md` 4.5 said it might not on
  2022-23's (deciding nothing).
- The archive differs from the test in ways that may count against MA: playoff games, which no development line is;
  another feed (provider 100's closing lines, where the development and test lines are provider 40's); P23's constants
  fitted on 2021-22, four seasons before the archive against one season before 2022-23. The plan's stand-in met D8
  (−0.00046 [−0.00142, +0.00051]) on projections fitted on 2022-23 to 2024-25 and on each game's list of who dressed
  (hindsight MA never has), so stale constants are one possible reason, untested.
- None of that turns the miss into a pass. D8 was written into the bar before any of MA's scores, knowing the archive
  was the archive and that P23 is fitted on 2021-22. It was put there to stop a candidate whose development gain does
  not show on another season's lines at its frozen size, and on its own terms it does stop MA.

## 6. D9, the machinery, as far as it went

| | State |
|---|---|
| the 2020-21 fetch | done: 1,362 requests, all HTTP 200, logged (section 1) |
| P23's fit | done, its replay checked row for row (section 1) |
| MA's freeze (`ma/freeze.js`) | run: `frozen/ma_frozen.json`, P23's constants, the nudge's weights and E fitted on all 88,739 graded development lines. Its weights are D8's, checked equal. Since the review (F4) it hashes every input the test's scorer stands on, `test/inputs.js`'s list (every module the scorer loads, the fetch's machinery, and the data: the 2020-21 boxes, the boxes of 2021-22 to 2025-26, `games.csv`'s and `odds_hist.csv`'s rows the test reads, the left-out list and V0 to V3's thresholds), and what its own fit read; until then seven code files and no data. It is the record of what D8 scored; no test follows from it |
| the test step's fetch (`test/fetch_dk40_2023_logged.sh`, `test/fetch_record.js`) | written, **never run on the feed**. Since the review (F3) its gate refuses a preregistration whose audit does not name the SHA-256 of the PREREG.md and PREREG_HASHES.json it audited, or names others than the commit holds; it pushes the fetch's start to origin before any request and refuses a second fetch by origin's record, not a marker in the cache; it resumes an interrupted fetch only under the same preregistration, and fetches a lost cache again only with `PROPS_V3_RECOVER=1`, byte for byte; it finishes the record with every file's SHA-256. Held by the machinery check's planted cases in sandbox repositories (`test/machinery_check.js` → `results/ma_machinery_check.json`: 26 cases, all as expected, among them the gate as first written passing each of the review's three gaps, B0), with a stand-in that requests nothing: nothing was fetched |
| the cleaner (`test/lines_clean_2023.js`) | written, never run on the real lines: it refuses unless origin holds the fetch's record under the preregistration (a cache marker until the review), and writes no hash of its own (the record's finish hashes what it wrote) |
| the validity checks (`test/validity_ma.js`) | `--reproduce` gives back `validity.js`'s 2023-24 figures exactly (89,032 graded lines on 1,116 games; V0 holds; V2 +0.0016; V3 holds) |
| the scorer (`test/score.js`) | `--dev-check`, through the scorer's own path (the clean six-column lines, MA's rows rebuilt, F's fields, the sample), gives back D1 and D2 to the digit (`results/ma_score_devcheck.json`, run again after the review's edits: b 1.21844 [1.07345, 1.36529], log loss −0.00112107 [−0.0014043, −0.000831875], Brier −0.000517197); on the development lines V4 holds (58 exits) and so does V5 (99.98% of graded lines on player-games with two or more posted lines). Its `--test` path was never run, and the review found it wrong (F1, F4): it read the 31 left-out games as `Object.keys` of an array and would have left out none, and its V-hash trusted the working tree and a sibling file in the cache. Fixed: the 31 read by `gid` and held to `test/seen_2023.json`, printed before any number; V-hash from the preregistration commit, every required input named and unmoved, the clean lines held to the fetch's record on origin. `--dev-check` cannot reach those paths, so the machinery check holds them on planted cases |
| the shadow's runner | **not written**: with D8 missed no shadow can follow this plan |
| planted in-game prices | run: V2 and V4 **do not react** (below); the tightening D9 then asks for was not made |

**The planted in-game prices** (`results/ma_plant_ingame.json`, critique C7). At 10% and 20% of the out-of-fold
player-games, one of the player's posted stats was repriced as a price read a quarter of the way into the game would be
(props_v2's `validity_calib.js` rule), his other lines left as they were:

| share planted | player-games | V2 (floor −0.05) | V4: the nudge toward the Under on exits more than elsewhere (limit +0.5 points) | V4b: the nudge's log-loss change a line on exits less elsewhere (+ is worse on exits) | the nudge's T2 |
|---|---|---|---|---|---|
| none | 0 | +0.0034 | −0.01 points | +0.0043 | −0.00112 [−0.00139, −0.00083] |
| 10% | 1,308 | −0.0044 | −0.08 points | +0.0061 | −0.00042 [−0.00070, −0.00013] |
| 20% | 2,641 | +0.0020 | −0.10 points | +0.0059 | +0.00023 [−0.00006, +0.00053] |

V2 here is read on the out-of-fold lines with P23's projected minutes; `validity.js`'s own figure, on all of 2023-24
with the 2024 fold's minutes, is the +0.0016 above. Neither check reacts at these shares, so by D9 V4 would have had to
be tightened, or joined by a check of the nudge's gain on early exits with a threshold set on the planting, before any
preregistration. That was not done, since D8 had already stopped the plan. What the planting does show: a price moved
during the game makes the nudge disagree with that one line, pushes it the wrong way on the very players who left
early, and costs it, so in-game prices among the test's lines would have counted against MA, not for it.

## 7. Every choice made in this step, on development data

- **Points' weight 0**, by PLAN.md 1.1's rule: its forward-chained T2 point estimate with all six stats was +0.0000193,
  above 0.
- **No secondary admitted** (PLAN.md 1.3, tried once each in order). Each needed the paired log-loss difference, with it
  less without it, wholly below 0: the level that is left +0.000125 [−0.000027, +0.000277]; his minutes trend −0.000022
  [−0.000179, +0.000134]; teammates out +0.000386 [+0.000175, +0.000592] (it clearly hurts); his return +0.000070
  [−0.000017, +0.000157]; early season +0.000059 [−0.000026, +0.000147]. The candidate scored is the stat mix alone on
  five stats.
- **The club rule's 394 lines** and **the six 2020-21 play-in boxes** left out (section 1).
- **F's game total centred on the set's own mean**, a constant of each set (the blindfold check says it, and does not
  compare it).
- **V4b**, the nudge's gain on early exits less elsewhere, computed beside V4 on the planting, with no threshold set.
- Until the review nothing was changed after any score was seen: the bar was PLAN.md section 2 as committed in 2a54d9c,
  before MA's rows existed.
- **The review's strengthening of T1 and D1** (z = b / SE at least 4; the bootstrap taken again where a rival's z comes
  within 0.5 of it) was chosen after MA's development figures (z 13.7) and D6's rivals' (the highest 2.85) had been
  seen. It only adds a criterion and changes no verdict here; it is listed because the rule is that every choice made
  on development data is (PLAN.md sections 6 and 9). So are the review's other checks: the scaled rivals' sizes (1, 0.6,
  0.5, 0.4, 0.3) and the ridges of the regularised ones; the 40 random splits (seeds 1000 to 1039) and the 10 on
  development data (2000 to 2009); the correction for five stats; and the 2,000 resamples of the minutes surprise.

## 8. What was seen of 2022-23, and what could come next

**Seen in this step:** no 2022-23 prop line. The replay walked 2022-23's box scores as history, as the rules allow
(every development projection stands on them as earlier games, never as a fit). `validity_ma.js` ran on 2023-24 alone.
The test step's fetch was run only to try its refusals, and fetched nothing. The review counted `espn_validate40.json`'s
game ids by season and type; its fix wrote the 31 left-out ids into `test/seen_2023.json` (ids alone), fed the scorer's
pieces made-up rows only, ran the fetch's machinery only in sandbox repositories with a stand-in that requests nothing,
and its terminal showed the first two rows of `data/odds_hist.csv` (2022-23 consensus game lines of two opening-night
games, which F may read at the test and nothing is fitted on, as the plan's own step had shown six). What the plan's
section 3.3 lists as seen before stands as it was, and the 2022-23 lines remain unfetched and unseen.

**What could come next, each the owner's call:**

1. **Leave it here.** The props panel keeps DraftKings' own chance. The finding stands: the hub's box scores carry a
   little information about a player's stat mix that DraftKings' price does not, on development data; whether it holds
   on a season the model has never seen is untested.
2. **A quiet forward shadow of MA on 2026-27**, research only, frozen first, with a bar of its own registered before its
   first call (PLAN.md section 5's rules could be taken over). The plan starts a shadow only after a test's PASS, so this
   would be the owner's choice to try MA forward despite D8, said so in its bar. It would need its own decision on P23's
   constants (fitted on 2021-22, five seasons old by then; a refit on 2025-26 would be a change to MA needing its own
   development check), and about 65,000 graded lines (about 1,160 games, so well into 2027-28) to reach 0.8 power at
   half the development effect.
3. **Another candidate**, built and sized on development data, keeping 2022-23 unspent for whichever earns it.
4. **The devig rule, apart from all of these.** E alone is 0.0003 a line better than the hub's fair chance on 2023-24
   on log loss, −0.00032 [−0.00065, −0.000005], an interval that only just clears 0, and level on Brier, −0.00012
   [−0.00026, +0.00002]. That is a question about putting the whole margin on the Over, needs no player information,
   and may run the other way on 2022-23, where the 31 seen games' Over landed 1.9 points under DraftKings' fair chance
   (PLAN.md 3.3); on the spent archive MA's chance with E was a little worse than DraftKings' fair chance (section 5).

Spending the 2022-23 test on MA now is not among them as the plan stands: it would set D8 aside after seeing it missed.
If the owner wanted that, the honest route is a new plan saying so, written before any 2022-23 line is fetched.

## 9. The review of 13 November, and what it changed here

Two reviewers read these results as first committed (c3e9a5c) and raised eleven findings. Each was checked with this
folder's own code before anything changed; all eleven are real, none refuted. `PLAN.md` section 9 gives each in full,
with what it changed in the bar and the machinery. In short:

| Finding | Verdict | What changed |
|---|---|---|
| F1, blocking: the scorer read the 31 left-out games as `Object.keys` of an array and would have left out none | real (0 of 31) | read by `gid`, held to `test/seen_2023.json`'s 31, printed first; machinery check A1 to A3 |
| F2: T1's 0.25 moves with the nudge's scale, so a shrunk information-free rival meets it | real: U9 at 0.3, b [0.258, 2.941] by the bar's bootstrap; 5 of 24 scaled or regularised rivals meet D1 as first written | T1 and D1 also ask z = b / SE ≥ 4; MA's z 13.7, the highest rival's 2.85; D1, D3 and D6 met as before (sections 2, 4) |
| F3: the fetch's gate took an audit untied to PREREG.md, kept its once-only guard in the cache, and could not resume | real, each reproduced in a sandbox on the wrapper as first written (machinery check B0) | the audit names the SHA-256 it audited; the fetch's start and finish are pushed to origin; resume and recovery rules; machinery check B1 to B13 |
| F4: V-hash read the working tree, passed an empty list, trusted a sibling file, hashed no data | real, each reproduced | every input listed (`test/inputs.js`) and read from the preregistration commit; the lines held to the pushed record; the freeze hashes the data too; machinery check C1 to C6 |
| F5: "does not know how many minutes anyone played" | real: 0.028 [0.012, 0.044] | worded as small but not zero (summary, section 4) |
| F6: "its information shows" on the archive | real: lower bound 0.244, z 2.40 | worded as a positive point, T1's bar not cleared (summary, section 5) |
| F7: P23's fit's header | real | the comment corrected |
| S1: D8's sign turns on the cross-fit's split | real: above 0 on 40% of 40 random splits, spread twice the miss | reported as context; D8 kept as written (section 5) |
| S2: per-stat claims ignore multiplicity | real: rebounds and assists reach 0 under a five-stat correction | the gain is said to be clear on steals, blocks and threes only (summary, section 2) |
| N1: "within 2 points in every band" was pooled | real: assists' 0.3-0.4 band, 5.2 points | said per stat (section 3) |
| N2: E alone's intervals | real | both intervals given (sections 2, 8) |

**What the review changes in the verdict: nothing.** D1 is met under its stronger form, D6 more clearly, D8 is missed as
before, and D9 is unfinished as before: the review's fixes make the test's fetch, left-out games and hash checks what
the plan said they were, held to planted cases, but the shadow's runner and V4's tightening are not written. MA does
not meet its development bar, so the 2022-23 lines stay unfetched and unspent.

## Files and re-running

From the repository's root, after `node research/props_v3/lines_clean.js` (`data.md`), with `tools/node_modules` in
place. Every random draw is seeded; the result files hold aggregates only, no line, price or player id.

| Command | What | Time |
|---|---|---|
| `node research/props_v3/fetch_box2021.js` | the 2020-21 box scores into `cache/box2021/`, every request logged | about 12 minutes |
| `node research/props_v3/ma/p23_fit.js` | P23 on 2021-22 → `results/ma_p23.json` | about 3 minutes |
| `node research/props_v3/ma/ma_rows.js` | MA's rows, 2023-24 and the archive → `cache/ma/` | about a minute |
| `node research/props_v3/ma/refs.js` | D4's references → `cache/ma/refs_2024.json` | about 2 minutes |
| `node research/props_v3/ma/dev_bar.js` | D1 to D5 → `results/ma_dev_bar.json`, `cache/ma/dev_oof.json` | about 16 minutes |
| `node research/props_v3/ma/dev_rivals.js` | D6 → `results/ma_dev_rivals.json` | about 4 minutes |
| `node research/props_v3/ma/dev_leaks.js` | D7 → `results/ma_dev_leaks.json` | about a minute |
| `node research/props_v3/ma/dev_archive.js` | D8 → `results/ma_dev_archive.json` | about a minute |
| `node research/props_v3/ma/dev_report.js` | section 3 → `results/ma_dev_report.json` | about a minute |
| `node research/props_v3/test/plant_ingame.js` | the planted in-game prices → `results/ma_plant_ingame.json` | about a minute |
| `node research/props_v3/test/validity_ma.js --reproduce` | the validity checks' copy against `validity.js` on 2023-24 | about a minute |
| `node research/props_v3/test/score.js --dev-check` | the scorer's path against D1 and D2 → `results/ma_score_devcheck.json` | about 16 minutes |
| `node research/props_v3/ma/dev_scale.js` | the review's F2, scaled and regularised rivals → `results/ma_dev_scale.json` | about 17 minutes |
| `node research/props_v3/ma/dev_review.js` | the review's S1, S2, N1, N2 and F5 → `results/ma_dev_review.json` | about a minute |
| `node research/props_v3/test/machinery_check.js` | the review's F1, F3 and F4 on planted cases in sandbox repositories → `results/ma_machinery_check.json` | seconds |
| `node research/props_v3/ma/freeze.js` | MA as D8 scored it, every input of the test's scorer hashed (`test/inputs.js`), data too → `frozen/ma_frozen.json` | about a minute |
