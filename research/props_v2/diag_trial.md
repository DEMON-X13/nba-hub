# Why the props trial loses to DraftKings: a diagnosis

Read only. Written by `research/props_v2/diag_trial.js` (`node research/props_v2/diag_trial.js`) on 2026-11-05T20:02Z, from the
trial's frozen calls (`data/props_shadow.json`), its graded lines (`data/props_shadow_lines.csv`), DraftKings' closing
lines and prices (`data/props_2027.csv`), the box scores, the injury log and the schedule; the comparison is the 2026
play-in and playoff archive (`data/props_2026.csv`) against the 2026 fold's model (fitted on 2023-2025), as README "Against
DraftKings' closing lines" scores it. **Nothing here is fitted, chosen or scored on 2026-27**: the tables describe where
the frozen model lost, and the what-ifs on 2026-27 (marked hindsight) only say which piece the loss comes from. Two
rows of table 15 are near a candidate's shape (the chance moved halfway to DraftKings' fair chance, and the spread
scaled to the walk-forward's ratio): they are yardsticks, scored here on the trial's lines before candidate B's rule
was written, and they set no candidate's constant (README, "The rules kept").

Checks: 12298 trial lines (the ledger's 12298), each line's model chance recomputed from the frozen call and the fit
(all agree to 4 decimals); the replay of tools/props.js reproduces each call's mean from its minutes, rate, pace and
opponent factor to a median 0.12% (90th percentile 0.51%), so the decomposition below is of the
call itself. Archive: 11395 lines, log loss model - DK +0.0147 [+0.0083, +0.0214] (README: 11,395 lines, +0.0147).

Columns: lines; how often the Over hit; the model's mean chance of the Over; DraftKings' fair chance (the whole margin
on the Over); log loss and Brier, model minus DraftKings (positive: the model is worse; a 90% interval resampling
games where a group has 300 lines or more); the model's mean minus the stat (its bias); the model's mean minus the line;
flat one-unit bets at a 3-point edge over the price's implied chance, as the bar counts them.

## Findings

The trial, 12298 lines on 121 games: log loss +0.0184 against DraftKings, the Over 47.5% where the model said 48.8% and DraftKings 46.1%. Three things account for the loss, the first by far the largest.

**1. The model is far too sure of itself: it prices its own mean as if it were known.** Its chances sit 9.0% from 50% on average where DraftKings' sit 5.2% (archive: 9.5% against 6.2%). Where it said the Over under 30%, the Over hit 44.6% (said 25.2%); where it said 70% or more, 51.5% (said 74.2%). The 3866 lines (31.4%) where it and DraftKings differ by 10 points or more carry 91.9% of its log-loss deficit (archive: 98.3%), and there DraftKings was right: with the model 10+ above, the Over hit 48.1% where the model said 61.7% and DraftKings 45.8%; with DraftKings 10+ above, 48.2% where the model said 30.8% and DraftKings 46.4%. Within 5 points of each other the two are nearly level (+0.0017). It is not the outcome's spread: the squared errors are smaller than the variance the call said (points 0.839 of it, pts+reb+ast 0.879; the 2026 walk-forward's own 0.872 and 0.906), and narrowing it to the walk-forward's ratio makes the loss worse (+0.0202). The missing piece is the uncertainty in the mean itself, which a negative binomial around a point mean leaves out; a yardstick, not a candidate: halfway to DraftKings' fair chance the deficit is +0.0031. The archive shows the same, so this is the model, not the season.

**2. Minutes are one of the two largest parts of the disagreements, the scoring rate the other, and the minutes rule over-hands minutes to the players it calls.** On the 3-point Over bets the call said 29.0 minutes and they played 26.6 (of the +2.45 the mean ran over the stat, minutes +1.09 and the rate +1.09: on the Overs the two weigh the same); on the Under bets it said 27.4 and they played 29.5 (minutes -0.88 of -1.20: there minutes are most of it). How much a better minutes forecast would gain is not measured: the what-if priced on the minutes played (table 15, -0.0560) is an upper bound inflated by the game's own results. The call's minutes miss by 4.79 a player, no worse than the walk-forward rule on the side the box lists (4.80; priced on those minutes the loss is the same, +0.0185), so live availability (the roster less the report) is not the problem: the rule is, against a market that may well know more of the rotations, restrictions and roles (this cannot show what it knows). Every opening fortnight the rule gives the called players more minutes than they play (+0.62, +0.65, +0.94, +1.01 a player in 2023-24 to 2026-27, the walk-forward rule on the box's side; in the trial a side's called players who played were said 238.8 minutes and played 229.6), the rest going to players it has no call for (rookies without a game on record, the deep bench: 65 of 242 trial sides had one play 15 minutes or more). It is worst at the ends: projected 34+, said 35.6 and played 33.8 (minutes +0.77 of +1.07); off the bench the model said the Over 53.5% where it hit 46.7%.

**3. A season-specific lean to the Over: the mean ran +0.56 a line over the stat (points +1.01, pts+reb +1.12).** Of the +0.56: minutes +0.09, pace missed +0.11, the opponent factor +0.09, the rate at the pace played +0.27 (points: +0.14, +0.13, +0.11, +0.64). The league scored less: 226.9 points a game against 231.2 last season and 234.1 in its opening fortnight (the posted totals averaged 229.9, so the market ran high too). The model expected a pace of 103.24 and the games were played at 102.32 (-0.92; the three openers before, -0.25, +0.30, +0.54); the points rate it carried in from last season was 17.80 per 36 minutes where 16.94 was made (the three openers before: +0.52, +0.04, -0.15); the opponent factor averages above 1 every opening fortnight (1.005, 1.009, 1.006, 1.008 on points). Taking the pace and opponent factors off alone brings the Over to 46.8% (log loss +0.0167): the lean is real but only a slice of the loss. In money it is worse than in log loss because DraftKings puts its margin on the Over: the Over bets said 61.4%, won 48.0% (fair 45.8%), -226.5 units; the Unders said 63.4%, won 53.9% (fair 53.7%), +3.7: both sides about as over-sure, the price punishing the Overs. In the 2026 playoffs it leaned the other way (the Over said 44.6%, hit 45.9%): the playoff factor (-0.82 a line) and the opponent factor (-0.26) outweighed the rate it carried in (+0.80) and the minutes (+0.22), leaving the mean level with the stat (+0.07) but its chance of the Over low; there the Unders won. The lean's sign moves with the season and its context; the over-sureness (1) and the minutes (2) do not.

**The other splits** (tables 3 to 8) sharpen these rather than add a cause. By his games this season: his season opener +0.0436, 1-2 games +0.0079, 3-5 +0.0192, 6+ +0.0138 (no player has 16 yet); a new club +0.0282 against the same club +0.0154; the largest quarter of lines +0.0319 against the smallest +0.0146 (the largest lines' Overs -93.2 units on 372); bench +0.0297 against starters +0.0151; a late scratch on his side (a called teammate of 20+ who did not play) +0.0280 and an uncalled teammate playing 15+ +0.0270 against neither +0.0131; a rotation teammate Out on the report +0.0202 against none +0.0164; his club on a back-to-back +0.0256 against rested +0.0171; the point spread no pattern. The worst cells are where the minutes are least known (a new season's first game, a new club, a surprise on the side); the model is level with DraftKings (its interval reaching zero) only in small corners: steals, blocks, a player 1-2 games into the season, the opponent on a back-to-back.

What this suggests for a second model (said here, decided in the study, on seasons up to 2026 only): carry the uncertainty of the mean into the chance (a minutes distribution, or a mean shrunk toward a market-free prior with its own error), and treat the minutes and the scoring rate carried across the summer as the first things to get right (who takes the uncalled minutes, the stars' early-season minutes, the bench's role; the rate a player brings into a new season), before finer refinements; season-start pace and the opponent factor's level are small, checkable corrections.

### 1. By stat (trial)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| All | 12298 | 47.5% | 48.8% | 46.1% | +0.0184 [+0.0138, +0.0233] | +0.0083 | +0.56 | +0.52 | 2796, 1343, -226.5 (-8.1%) | 3231, 1741, +3.7 (+0.1%) |
| Points | 1703 | 48.0% | 49.7% | 46.9% | +0.0175 [+0.0096, +0.0260] | +0.0081 | +1.01 | +0.95 | 458, 231, -19.9 (-4.3%) | 497, 263, -1.2 (-0.2%) |
| Rebounds | 1583 | 49.6% | 49.3% | 45.9% | +0.0126 [+0.0038, +0.0212] | +0.0055 | +0.13 | +0.30 | 363, 183, -10.9 (-3.0%) | 336, 182, -2.7 (-0.8%) |
| Assists | 1207 | 46.6% | 48.1% | 46.1% | +0.0223 [+0.0103, +0.0347] | +0.0095 | +0.10 | +0.17 | 273, 128, -25.9 (-9.5%) | 360, 208, +28.4 (+7.9%) |
| Threes | 1381 | 46.2% | 47.3% | 44.4% | +0.0071 [+0.0004, +0.0146] | +0.0030 | +0.09 | +0.17 | 226, 106, -3.8 (-1.7%) | 265, 141, -10.3 (-3.9%) |
| Steals | 582 | 47.4% | 46.5% | 45.7% | +0.0026 [-0.0047, +0.0100] | +0.0012 | +0.00 | +0.09 | 30, 15, +2.6 (+8.8%) | 129, 75, +5.1 (+3.9%) |
| Blocks | 320 | 43.8% | 47.0% | 43.8% | +0.0124 [-0.0024, +0.0277] | +0.0057 | +0.08 | +0.17 | 47, 22, -4.7 (-10.0%) | 47, 26, -1.5 (-3.2%) |
| Pts+reb+ast | 1308 | 46.7% | 49.1% | 46.5% | +0.0283 [+0.0196, +0.0373] | +0.0129 | +1.12 | +0.73 | 333, 152, -47.9 (-14.4%) | 406, 215, -3.5 (-0.9%) |
| Pts+reb | 1593 | 48.1% | 50.0% | 46.6% | +0.0182 [+0.0086, +0.0277] | +0.0084 | +1.12 | +0.97 | 447, 220, -35.4 (-7.9%) | 424, 227, -0.3 (-0.1%) |
| Pts+ast | 1234 | 46.5% | 49.0% | 46.5% | +0.0300 [+0.0197, +0.0410] | +0.0134 | +0.92 | +0.68 | 313, 141, -48.4 (-15.5%) | 388, 206, -1.8 (-0.5%) |
| Ast+reb | 1212 | 48.9% | 49.3% | 46.6% | +0.0223 [+0.0114, +0.0336] | +0.0099 | +0.23 | +0.32 | 290, 140, -25.6 (-8.8%) | 334, 177, -1.6 (-0.5%) |
| Stl+blk | 175 | 45.7% | 45.4% | 44.8% | +0.0274 | +0.0125 | -0.04 | +0.04 | 16, 5, -6.8 (-42.3%) | 45, 21, -6.8 (-15.2%) |

### 1b. By stat (2026 play-in and playoffs archive)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| All | 11395 | 45.9% | 44.6% | 45.6% | +0.0147 [+0.0083, +0.0214] | +0.0064 | +0.07 | -0.01 | 967, 442, -106.4 (-11.0%) | 4271, 2357, +135.3 (+3.2%) |
| Points | 1328 | 45.8% | 43.8% | 46.9% | +0.0288 [+0.0180, +0.0398] | +0.0129 | +0.06 | +0.08 | 120, 50, -26.2 (-21.8%) | 657, 353, +8.0 (+1.2%) |
| Rebounds | 1234 | 49.7% | 48.5% | 46.3% | +0.0082 [-0.0012, +0.0186] | +0.0035 | +0.14 | +0.25 | 218, 107, -9.2 (-4.2%) | 297, 148, -14.0 (-4.7%) |
| Assists | 1094 | 45.1% | 43.3% | 46.2% | +0.0092 [-0.0009, +0.0194] | +0.0038 | -0.01 | -0.07 | 61, 27, -9.4 (-15.4%) | 527, 302, +37.2 (+7.1%) |
| Threes | 1079 | 46.2% | 44.1% | 44.9% | +0.0083 [+0.0002, +0.0166] | +0.0035 | +0.00 | +0.07 | 54, 29, +5.2 (+9.6%) | 371, 195, -2.0 (-0.5%) |
| Steals | 888 | 48.1% | 47.2% | 46.8% | -0.0010 [-0.0064, +0.0043] | -0.0004 | -0.05 | +0.13 | 23, 11, -1.0 (-4.5%) | 212, 115, +4.3 (+2.0%) |
| Blocks | 795 | 38.9% | 38.9% | 37.9% | -0.0005 [-0.0072, +0.0056] | -0.0001 | +0.01 | +0.02 | 45, 22, +10.0 (+22.3%) | 158, 98, +12.8 (+8.1%) |
| Pts+reb+ast | 1113 | 45.4% | 44.2% | 46.6% | +0.0277 [+0.0137, +0.0425] | +0.0121 | +0.18 | -0.30 | 111, 46, -24.7 (-22.3%) | 521, 295, +31.4 (+6.0%) |
| Pts+reb | 1204 | 45.1% | 45.1% | 46.5% | +0.0239 [+0.0123, +0.0355] | +0.0109 | +0.19 | +0.03 | 129, 53, -30.0 (-23.2%) | 516, 284, +14.0 (+2.7%) |
| Pts+ast | 1029 | 45.0% | 43.5% | 46.6% | +0.0267 [+0.0126, +0.0425] | +0.0114 | -0.04 | -0.36 | 75, 31, -16.6 (-22.1%) | 498, 285, +35.9 (+7.2%) |
| Ast+reb | 1041 | 47.8% | 45.5% | 46.1% | +0.0127 [+0.0020, +0.0238] | +0.0056 | +0.13 | -0.02 | 114, 58, -4.2 (-3.7%) | 375, 202, +1.7 (+0.5%) |
| Stl+blk | 590 | 46.8% | 44.5% | 43.8% | +0.0010 [-0.0067, +0.0086] | +0.0005 | +0.03 | +0.04 | 17, 8, -0.3 (-1.8%) | 139, 80, +5.9 (+4.2%) |

### 2. The 3-point bets by side and stat (trial)

Each bet: the side whose model chance is 3 points or more above its price's implied chance. "Said" is the model's chance of that side, "won" the rate it won, "fair" DraftKings' fair chance of it.

| Stat | Overs: bets | said | won | fair | units | Unders: bets | said | won | fair | units |
|---|---|---|---|---|---|---|---|---|---|---|
| All | 2796 | 61.4% | 48.0% | 45.8% | -226.5 | 3231 | 63.4% | 53.9% | 53.7% | +3.7 |
| Points | 458 | 62.2% | 50.4% | 46.7% | -19.9 | 497 | 62.6% | 52.9% | 53.0% | -1.2 |
| Rebounds | 363 | 60.0% | 50.4% | 45.3% | -10.9 | 336 | 63.6% | 54.2% | 54.3% | -2.7 |
| Assists | 273 | 61.4% | 46.9% | 45.6% | -25.9 | 360 | 64.1% | 57.8% | 53.6% | +28.4 |
| Threes | 226 | 55.8% | 46.9% | 42.2% | -3.8 | 265 | 62.7% | 53.2% | 55.0% | -10.3 |
| Steals | 30 | 52.6% | 50.0% | 40.5% | +2.6 | 129 | 61.4% | 58.1% | 55.2% | +5.1 |
| Blocks | 47 | 58.1% | 46.8% | 44.5% | -4.7 | 47 | 64.8% | 55.3% | 57.2% | -1.5 |
| Pts+reb+ast | 333 | 63.1% | 45.6% | 46.5% | -47.9 | 406 | 64.0% | 53.0% | 53.5% | -3.5 |
| Pts+reb | 447 | 62.7% | 49.2% | 46.6% | -35.4 | 424 | 63.6% | 53.5% | 53.4% | -0.3 |
| Pts+ast | 313 | 63.0% | 45.0% | 46.4% | -48.4 | 388 | 63.5% | 53.1% | 53.4% | -1.8 |
| Ast+reb | 290 | 62.0% | 48.3% | 46.2% | -25.6 | 334 | 63.5% | 53.0% | 53.2% | -1.6 |
| Stl+blk | 16 | 58.9% | 31.3% | 46.7% | -6.8 | 45 | 63.1% | 46.7% | 55.6% | -6.8 |

Archive (2026 playoffs), all stats: Overs 967, 59.1%, 45.7%, 44.9%, -106.4; Unders 4271, 63.1%, 55.2%, 53.4%, +135.3.

### 3. By line size (trial; quartiles of the line within its stat)

Quartile cut points: pts 9.5/12.5/17.5, reb 3.5/4.5/6.5, ast 2.5/3.5/4.5, tpm 1.5/1.5/2.5, stl 0.5/1.5/1.5, blk 0.5/0.5/1.5, pra 18.5/23.5/30.5, pr 14.5/18.5/23.5, pa 13.5/18.5/24.5, ar 6.5/8.5/10.5, sb 1.5/1.5/2.5.

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| Smallest quarter | 4831 | 48.1% | 51.1% | 46.9% | +0.0146 [+0.0074, +0.0223] | +0.0066 | +0.69 | +0.80 | 1271, 633, -62.5 (-4.9%) | 1000, 535, +7.4 (+0.7%) |
| Second | 2576 | 46.0% | 48.1% | 45.1% | +0.0105 [+0.0019, +0.0202] | +0.0045 | +0.72 | +0.63 | 629, 316, -23.5 (-3.7%) | 648, 387, +56.3 (+8.7%) |
| Third | 2637 | 48.6% | 47.4% | 45.5% | +0.0216 [+0.0114, +0.0319] | +0.0095 | +0.40 | +0.34 | 524, 246, -47.4 (-9.0%) | 735, 383, -25.5 (-3.5%) |
| Largest quarter | 2254 | 46.8% | 46.4% | 46.2% | +0.0319 [+0.0213, +0.0425] | +0.0149 | +0.28 | +0.01 | 372, 148, -93.2 (-25.0%) | 848, 436, -34.5 (-4.1%) |

### 3b. Points lines by size (trial)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| under 10 | 552 | 47.1% | 51.8% | 47.2% | +0.0146 [-0.0018, +0.0308] | +0.0067 | +1.33 | +1.47 | 190, 98, -5.3 (-2.8%) | 127, 72, +10.1 (+8.0%) |
| 10 to 15.5 | 613 | 46.5% | 50.0% | 46.7% | +0.0132 [-0.0003, +0.0278] | +0.0059 | +1.38 | +1.06 | 172, 90, -0.1 (-0.1%) | 162, 93, +12.6 (+7.8%) |
| 16 to 21.5 | 346 | 52.6% | 47.6% | 46.8% | +0.0243 [+0.0073, +0.0420] | +0.0114 | +0.27 | +0.47 | 70, 34, -5.5 (-7.8%) | 128, 58, -19.1 (-14.9%) |
| 22 to 27.5 | 165 | 47.3% | 46.7% | 46.9% | +0.0351 | +0.0168 | +0.38 | +0.14 | 24, 8, -8.9 (-37.3%) | 65, 31, -6.5 (-10.0%) |
| 28 and up | 27 | 44.4% | 43.2% | 46.5% | -0.0212 | -0.0102 | -0.55 | -0.80 | 2, 1, 0.0 (-2.4%) | 15, 9, +1.7 (+11.1%) |

### 4. By projected minutes (trial: the frozen call's)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| under 20 | 834 | 49.5% | 42.0% | 46.3% | +0.0240 [-0.0066, +0.0573] | +0.0090 | -0.62 | -0.17 | 111, 63, +8.2 (+7.4%) | 437, 241, +10.1 (+2.3%) |
| 20 to 26 | 2677 | 47.1% | 49.2% | 45.9% | +0.0176 [+0.0044, +0.0311] | +0.0077 | +0.58 | +0.65 | 746, 379, -14.8 (-2.0%) | 717, 389, +2.3 (+0.3%) |
| 26 to 30 | 3066 | 46.6% | 49.0% | 46.2% | +0.0249 [+0.0141, +0.0360] | +0.0116 | +0.66 | +0.52 | 690, 316, -87.0 (-12.6%) | 846, 444, -21.6 (-2.6%) |
| 30 to 34 | 3649 | 48.5% | 48.9% | 46.0% | +0.0147 [+0.0062, +0.0231] | +0.0067 | +0.44 | +0.47 | 717, 344, -60.0 (-8.4%) | 834, 438, -23.0 (-2.8%) |
| 34 and up | 2072 | 47.0% | 50.6% | 46.3% | +0.0143 [+0.0016, +0.0262] | +0.0066 | +1.07 | +0.71 | 532, 241, -73.0 (-13.7%) | 397, 229, +36.0 (+9.1%) |

### 4b. By minutes actually played (trial; hindsight)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| under 20 | 1336 | 23.7% | 51.9% | 46.1% | +0.0728 [+0.0490, +0.0972] | +0.0340 | +3.79 | +1.06 | 457, 126, -216.0 (-47.3%) | 259, 205, +123.0 (+47.5%) |
| 20 to 26 | 2574 | 39.0% | 50.5% | 46.0% | +0.0241 [+0.0108, +0.0387] | +0.0112 | +2.03 | +0.81 | 793, 343, -131.5 (-16.6%) | 553, 361, +117.3 (+21.2%) |
| 26 to 30 | 2290 | 48.2% | 48.1% | 46.1% | +0.0013 [-0.0110, +0.0125] | +0.0000 | +0.51 | +0.44 | 475, 278, +55.4 (+11.7%) | 655, 377, +44.3 (+6.8%) |
| 30 to 34 | 2852 | 52.7% | 47.6% | 46.1% | +0.0088 [-0.0022, +0.0196] | +0.0038 | -0.19 | +0.30 | 513, 285, +30.4 (+5.9%) | 824, 398, -85.6 (-10.4%) |
| 34 and up | 3246 | 59.1% | 47.7% | 46.1% | +0.0121 [+0.0025, +0.0227] | +0.0051 | -1.26 | +0.31 | 558, 311, +35.2 (+6.3%) | 940, 400, -195.3 (-20.8%) |

### 4c. By minutes played minus projected (trial; hindsight)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| 8 or more under | 1048 | 17.0% | 54.6% | 46.2% | +0.1295 [+0.1019, +0.1598] | +0.0610 | +5.48 | +1.34 | 429, 76, -282.6 (-65.9%) | 106, 90, +62.6 (+59.1%) |
| 3 to 8 under | 2308 | 33.0% | 51.7% | 46.0% | +0.0293 [+0.0177, +0.0409] | +0.0143 | +2.70 | +0.92 | 724, 300, -151.5 (-20.9%) | 384, 279, +136.9 (+35.6%) |
| within 3 | 5421 | 49.1% | 49.1% | 46.0% | -0.0071 [-0.0141, +0.0001] | -0.0036 | +0.53 | +0.58 | 1224, 664, +45.0 (+3.7%) | 1273, 775, +169.9 (+13.3%) |
| 3 to 8 over | 2844 | 62.5% | 45.8% | 46.2% | +0.0024 [-0.0091, +0.0142] | +0.0003 | -1.89 | +0.09 | 383, 271, +137.5 (+35.9%) | 1074, 465, -216.0 (-20.1%) |
| 8 or more over | 677 | 68.5% | 39.7% | 46.2% | +0.0816 [+0.0455, +0.1256] | +0.0348 | -3.86 | -0.75 | 36, 32, +25.1 (+69.7%) | 394, 132, -149.7 (-38.0%) |

### 4d. By projected minutes (archive)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| under 20 | 1424 | 46.1% | 40.2% | 45.6% | +0.0097 [-0.0083, +0.0292] | +0.0040 | -0.32 | -0.08 | 74, 29, -18.2 (-24.6%) | 849, 484, +51.8 (+6.1%) |
| 20 to 26 | 1838 | 49.2% | 44.9% | 46.0% | +0.0366 [+0.0210, +0.0538] | +0.0161 | -0.27 | +0.15 | 172, 72, -33.3 (-19.4%) | 721, 350, -63.7 (-8.8%) |
| 26 to 30 | 1369 | 47.2% | 43.8% | 45.8% | +0.0242 [+0.0036, +0.0450] | +0.0100 | -0.44 | -0.13 | 123, 66, +1.5 (+1.2%) | 572, 296, -20.8 (-3.6%) |
| 30 to 34 | 2299 | 47.5% | 44.4% | 45.6% | +0.0110 [-0.0012, +0.0232] | +0.0049 | -0.03 | -0.09 | 213, 109, -0.8 (-0.4%) | 902, 481, -6.6 (-0.7%) |
| 34 and up | 4465 | 43.3% | 46.1% | 45.4% | +0.0062 [-0.0020, +0.0142] | +0.0030 | +0.53 | +0.03 | 385, 166, -55.7 (-14.5%) | 1227, 746, +174.6 (+14.2%) |

### 5. Starter or bench (trial; the box's starter flag)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| Started | 9482 | 47.8% | 47.4% | 46.1% | +0.0151 [+0.0101, +0.0202] | +0.0068 | +0.35 | +0.30 | 1632, 781, -142.5 (-8.7%) | 2825, 1522, +1.7 (+0.1%) |
| Came off the bench | 2816 | 46.7% | 53.5% | 46.1% | +0.0297 [+0.0160, +0.0441] | +0.0132 | +1.23 | +1.25 | 1164, 562, -84.0 (-7.2%) | 406, 219, +2.0 (+0.5%) |

### 5b. Starter or bench (archive)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| Started | 8389 | 46.0% | 44.3% | 45.5% | +0.0127 [+0.0054, +0.0208] | +0.0055 | +0.05 | -0.14 | 601, 291, -28.7 (-4.8%) | 3077, 1699, +98.0 (+3.2%) |
| Came off the bench | 3006 | 45.8% | 45.4% | 45.8% | +0.0202 [+0.0110, +0.0303] | +0.0090 | +0.11 | +0.34 | 366, 151, -77.8 (-21.2%) | 1194, 658, +37.3 (+3.1%) |

### 6. By his games this season before this one (trial)

The trial runs 20 October to 4 November 2026, so no player has 16 games yet; the finer rows split the first bucket.

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 to 5 | 9572 | 47.9% | 48.7% | 46.1% | +0.0198 [+0.0141, +0.0254] | +0.0088 | +0.55 | +0.51 | 2233, 1066, -197.3 (-8.8%) | 2624, 1412, +3.4 (+0.1%) |
| 6 to 15 | 2726 | 46.1% | 49.0% | 46.1% | +0.0138 [+0.0034, +0.0240] | +0.0065 | +0.57 | +0.55 | 563, 277, -29.2 (-5.2%) | 607, 329, +0.4 (+0.1%) |
| 16 or more | 0 | | | | | | | | | |
|   of which 0 (his season opener) | 1653 | 44.6% | 50.2% | 46.1% | +0.0436 [+0.0281, +0.0579] | +0.0196 | +1.04 | +0.72 | 483, 221, -62.7 (-13.0%) | 447, 231, -17.9 (-4.0%) |
|   1 to 2 | 3093 | 50.9% | 48.0% | 46.1% | +0.0079 [-0.0026, +0.0181] | +0.0029 | +0.31 | +0.40 | 710, 376, +6.3 (+0.9%) | 933, 523, +37.4 (+4.0%) |
|   3 to 5 | 4826 | 47.1% | 48.7% | 46.1% | +0.0192 [+0.0118, +0.0263] | +0.0089 | +0.54 | +0.51 | 1040, 469, -140.9 (-13.6%) | 1244, 658, -16.1 (-1.3%) |

### 6b. Same club as last season or a new one (trial)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| Same club | 9111 | 46.7% | 48.6% | 46.1% | +0.0154 [+0.0095, +0.0215] | +0.0070 | +0.60 | +0.49 | 1937, 916, -182.9 (-9.4%) | 2386, 1333, +94.7 (+4.0%) |
| New club | 2389 | 46.8% | 50.1% | 45.8% | +0.0282 [+0.0129, +0.0434] | +0.0123 | +0.86 | +0.72 | 733, 354, -56.3 (-7.7%) | 591, 315, -9.7 (-1.6%) |
| No game last season (rookie, back from a year out) | 798 | 58.8% | 47.5% | 46.2% | +0.0244 [+0.0049, +0.0432] | +0.0111 | -0.88 | +0.32 | 126, 73, +12.6 (+10.0%) | 254, 93, -81.3 (-32.0%) |

### 6c. By his games this season (archive: the playoffs, so nearly all 16+)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| 0 to 15 | 28 | 53.6% | 48.6% | 47.3% | +0.0100 | +0.0052 | -1.68 | +0.46 | 2, 1, -0.1 (-3.7%) | 5, 2, -1.6 (-32.0%) |
| 16 or more | 11367 | 45.9% | 44.6% | 45.6% | +0.0147 [+0.0083, +0.0214] | +0.0064 | +0.07 | -0.01 | 965, 441, -106.4 (-11.0%) | 4266, 2355, +136.9 (+3.2%) |

### 7. Teammates out (trial)

The call already drops the report's absentees and scales the side (tools/props.js sideScale); a late scratch or an uncalled player is what the call could not know. "Usual minutes": his appearances this season if 3 or more, else last regular season's.

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| A teammate of 24+ usual minutes Out on the day's report | 6610 | 48.1% | 47.5% | 46.1% | +0.0202 [+0.0133, +0.0270] | +0.0091 | +0.29 | +0.34 | 1293, 621, -109.6 (-8.5%) | 2053, 1086, -34.3 (-1.7%) |
| No such teammate on the report | 5688 | 46.9% | 50.3% | 46.1% | +0.0164 [+0.0084, +0.0243] | +0.0073 | +0.87 | +0.72 | 1503, 722, -116.9 (-7.8%) | 1178, 655, +38.0 (+3.2%) |
| A called teammate (projected 20+) did not play: a late scratch | 3037 | 49.8% | 48.4% | 46.1% | +0.0280 [+0.0162, +0.0387] | +0.0121 | +0.39 | +0.48 | 689, 349, -19.3 (-2.8%) | 881, 433, -75.6 (-8.6%) |
| A teammate played 15+ minutes with no call | 3185 | 47.1% | 48.7% | 46.1% | +0.0270 [+0.0179, +0.0366] | +0.0122 | +0.72 | +0.50 | 725, 338, -79.4 (-10.9%) | 882, 463, -21.1 (-2.4%) |
| Neither surprise | 7614 | 46.9% | 49.1% | 46.1% | +0.0131 [+0.0067, +0.0196] | +0.0060 | +0.63 | +0.56 | 1789, 851, -163.9 (-9.2%) | 1881, 1061, +90.7 (+4.8%) |

### 8. Back-to-backs (trial)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| His club on the second night of a back-to-back | 1871 | 49.5% | 47.5% | 46.1% | +0.0256 [+0.0105, +0.0428] | +0.0111 | +0.11 | +0.32 | 410, 201, -26.4 (-6.4%) | 579, 295, -30.3 (-5.2%) |
| His club rested | 10427 | 47.2% | 49.0% | 46.1% | +0.0171 [+0.0119, +0.0221] | +0.0078 | +0.64 | +0.56 | 2386, 1142, -200.1 (-8.4%) | 2652, 1446, +34.1 (+1.3%) |
| The opponent on a back-to-back | 1980 | 52.6% | 47.2% | 46.0% | +0.0059 [-0.0049, +0.0178] | +0.0022 | -0.03 | +0.32 | 350, 207, +51.5 (+14.7%) | 623, 319, -28.8 (-4.6%) |
| Neither | 9303 | 46.3% | 49.2% | 46.1% | +0.0191 [+0.0138, +0.0245] | +0.0087 | +0.71 | +0.57 | 2192, 1027, -230.8 (-10.5%) | 2338, 1285, +49.2 (+2.1%) |

### 8b. By the game's point spread (trial; blowout risk)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| Spread under 4 | 4703 | 47.1% | 48.5% | 46.0% | +0.0207 [+0.0126, +0.0293] | +0.0093 | +0.56 | +0.47 | 1067, 516, -79.8 (-7.5%) | 1323, 715, +7.7 (+0.6%) |
| 4 to 7.5 | 4179 | 47.6% | 48.6% | 46.1% | +0.0160 [+0.0076, +0.0242] | +0.0073 | +0.49 | +0.50 | 901, 429, -83.0 (-9.2%) | 1138, 619, +12.7 (+1.1%) |
| 8 or more | 3416 | 47.9% | 49.4% | 46.2% | +0.0183 [+0.0094, +0.0268] | +0.0082 | +0.63 | +0.61 | 828, 398, -63.8 (-7.7%) | 770, 407, -16.7 (-2.2%) |

### 9. By the model's mean minus the line, in the model's own standard deviations (trial)

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| under -0.5 sd | 301 | 46.2% | 22.4% | 43.1% | +0.1505 [+0.0792, +0.2146] | +0.0603 | -3.46 | -3.03 | 0 | 299, 160, -17.9 (-6.0%) |
| -0.5 to -0.15 | 2013 | 42.1% | 34.3% | 42.8% | +0.0237 [+0.0114, +0.0354] | +0.0109 | -1.11 | -1.31 | 0 | 1646, 923, +19.9 (+1.2%) |
| -0.15 to +0.15 | 4489 | 45.9% | 45.1% | 44.8% | +0.0028 [-0.0002, +0.0059] | +0.0014 | +0.24 | +0.07 | 143, 58, -3.5 (-2.5%) | 1181, 616, +7.4 (+0.6%) |
| +0.15 to +0.5 | 4688 | 50.6% | 56.7% | 48.0% | +0.0117 [+0.0040, +0.0198] | +0.0057 | +1.44 | +1.52 | 2002, 956, -165.8 (-8.3%) | 105, 42, -5.7 (-5.4%) |
| over +0.5 sd | 807 | 52.4% | 69.9% | 51.3% | +0.0822 [+0.0439, +0.1188] | +0.0357 | +2.81 | +3.10 | 651, 329, -57.3 (-8.8%) | 0 |

### 9b. By the model's chance of the Over minus DraftKings' fair chance (trial): who is right when they disagree

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| DK 10+ points above the model | 1186 | 48.2% | 30.8% | 46.4% | +0.0776 [+0.0490, +0.1071] | +0.0336 | -2.48 | -2.18 | 0 | 1186, 614, -40.0 (-3.4%) |
| DK 5 to 10 above | 1334 | 44.2% | 39.0% | 46.3% | +0.0043 [-0.0051, +0.0141] | +0.0020 | -0.48 | -0.78 | 0 | 1334, 745, +48.0 (+3.6%) |
| within 5 | 4729 | 47.3% | 46.5% | 46.1% | +0.0017 [+0.0001, +0.0033] | +0.0008 | +0.27 | +0.21 | 0 | 711, 382, -4.2 (-0.6%) |
| model 5 to 10 above | 2369 | 48.9% | 53.4% | 46.1% | +0.0019 [-0.0052, +0.0096] | +0.0009 | +1.03 | +1.06 | 116, 53, -15.3 (-13.2%) | 0 |
| model 10+ above | 2680 | 48.1% | 61.7% | 45.8% | +0.0435 [+0.0267, +0.0601] | +0.0199 | +2.50 | +2.42 | 2680, 1290, -211.2 (-7.9%) | 0 |

### 9c. The same on the archive

| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |
|---|---|---|---|---|---|---|---|---|---|---|
| DK 10+ points above the model | 1500 | 48.0% | 30.5% | 47.0% | +0.0773 [+0.0407, +0.1153] | +0.0327 | -2.32 | -2.29 | 0 | 1500, 780, -30.4 (-2.0%) |
| DK 5 to 10 above | 1779 | 43.4% | 39.2% | 46.4% | +0.0028 [-0.0052, +0.0110] | +0.0013 | -0.32 | -0.59 | 0 | 1779, 1007, +95.9 (+5.4%) |
| within 5 | 5491 | 45.3% | 45.4% | 45.3% | -0.0001 [-0.0016, +0.0015] | -0.0001 | +0.33 | +0.19 | 0 | 992, 570, +69.8 (+7.0%) |
| model 5 to 10 above | 1725 | 48.9% | 52.0% | 44.8% | -0.0010 [-0.0086, +0.0067] | -0.0003 | +0.78 | +0.91 | 68, 32, +3.8 (+5.6%) | 0 |
| model 10+ above | 900 | 45.7% | 59.6% | 45.1% | +0.0538 [+0.0246, +0.0821] | +0.0255 | +1.81 | +1.94 | 899, 410, -110.2 (-12.3%) | 0 |

### 9d. Where the log loss is lost

The 3866 trial lines (31.4%) where the model's chance of the Over and DraftKings' fair chance differ by 10 points or more carry 91.9% of the model's whole log-loss deficit; on the archive, 2400 lines (21.1%) carry 98.3%.

### 10. Calibration: the chance of the Over said against what happened

| Chance said | Model: lines | said | Over hit | DraftKings: lines | said | Over hit | Archive model: lines | said | hit |
|---|---|---|---|---|---|---|---|---|---|
| 0-30% | 588 | 25.2% | 44.6% | 94 | 27.6% | 27.7% | 1062 | 23.7% | 36.3% |
| 30-40% | 2149 | 35.8% | 40.8% | 1316 | 36.2% | 38.1% | 2566 | 35.9% | 42.6% |
| 40-45% | 1726 | 42.6% | 46.1% | 2789 | 43.2% | 44.6% | 2059 | 42.5% | 42.3% |
| 45-50% | 2079 | 47.6% | 47.5% | 6057 | 47.2% | 48.5% | 2114 | 47.5% | 47.2% |
| 50-55% | 2125 | 52.5% | 49.4% | 1437 | 52.0% | 53.7% | 1725 | 52.4% | 52.2% |
| 55-60% | 1676 | 57.4% | 51.2% | 408 | 57.1% | 57.4% | 1095 | 57.3% | 51.7% |
| 60-70% | 1631 | 63.8% | 51.9% | 197 | 62.4% | 65.5% | 699 | 63.3% | 53.6% |
| 70-100% | 324 | 74.2% | 51.5% | 0 | | | 75 | 74.1% | 57.3% |

How far from 50% each says, on average: the model 9.0%, DraftKings 5.2% (archive: model 9.5%, DraftKings 6.2%).

### 11. Where the bias comes from

Mean minus stat on the graded lines (positive: the model said too much), split into parts that add up: minutes (the call's mean against the same mean at the minutes he played); pace missed (the pace factor against the one the game's played pace would have given: his rate x minutes played x (expected - played pace) / his recent games' pace); the opponent factor at the minutes he played; the playoff factor (archive only); and the rate at the pace played (his projected rate per minute, before the opponent, at the game's played pace and the minutes he played, minus the stat). In brackets, the whole pace factor the call applied (pace missed plus the part the game bore out, which the rate column already holds).

### 11a. By stat (trial)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| All | 12298 | +0.56 | +0.09 | +0.11 | +0.09 | 0.00 | +0.27 | 0.00 | (+0.22) | 28.8 | 28.6 |
| Points | 1703 | +1.01 | +0.14 | +0.13 | +0.11 | 0.00 | +0.64 | 0.00 | (+0.27) | 27.6 | 27.3 |
| Rebounds | 1583 | +0.13 | +0.05 | +0.05 | +0.02 | 0.00 | +0.00 | 0.00 | (+0.10) | 28.1 | 27.8 |
| Assists | 1207 | +0.10 | +0.03 | +0.04 | +0.05 | 0.00 | -0.01 | 0.00 | (+0.07) | 29.4 | 29.2 |
| Threes | 1381 | +0.09 | +0.02 | +0.02 | +0.01 | 0.00 | +0.04 | 0.00 | (+0.04) | 28.5 | 28.2 |
| Steals | 582 | +0.00 | +0.01 | +0.01 | +0.01 | 0.00 | -0.02 | +0.00 | (+0.03) | 30.9 | 30.8 |
| Blocks | 320 | +0.08 | +0.01 | +0.01 | +0.00 | 0.00 | +0.06 | +0.00 | (+0.02) | 29.6 | 29.6 |
| Pts+reb+ast | 1308 | +1.12 | +0.17 | +0.25 | +0.18 | 0.00 | +0.53 | -0.01 | (+0.46) | 29.1 | 28.9 |
| Pts+reb | 1593 | +1.12 | +0.19 | +0.19 | +0.14 | 0.00 | +0.61 | 0.00 | (+0.38) | 28.1 | 27.8 |
| Pts+ast | 1234 | +0.92 | +0.13 | +0.19 | +0.16 | 0.00 | +0.44 | -0.01 | (+0.38) | 29.3 | 29.1 |
| Ast+reb | 1212 | +0.23 | +0.07 | +0.09 | +0.07 | 0.00 | 0.00 | 0.00 | (+0.17) | 29.5 | 29.2 |
| Stl+blk | 175 | -0.04 | -0.02 | +0.02 | -0.01 | 0.00 | -0.04 | +0.00 | (+0.04) | 30.9 | 31.3 |

### 11b. By projected minutes (trial)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| under 20 | 834 | -0.62 | -1.26 | +0.13 | +0.02 | 0.00 | +0.49 | +0.00 | (+0.12) | 17.7 | 20.8 |
| 20 to 26 | 2677 | +0.58 | -0.04 | +0.09 | +0.08 | 0.00 | +0.45 | 0.00 | (+0.14) | 23.5 | 23.6 |
| 26 to 30 | 3066 | +0.66 | +0.09 | +0.04 | +0.09 | 0.00 | +0.45 | -0.01 | (+0.18) | 28.1 | 27.8 |
| 30 to 34 | 3649 | +0.44 | +0.12 | +0.10 | +0.10 | 0.00 | +0.12 | 0.00 | (+0.27) | 31.9 | 31.5 |
| 34 and up | 2072 | +1.07 | +0.77 | +0.26 | +0.08 | 0.00 | -0.04 | +0.00 | (+0.32) | 35.6 | 33.8 |

### 11c. Points lines by projected minutes (trial)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| under 20 | 188 | -0.14 | -1.11 | +0.09 | +0.05 | 0.00 | +0.84 | +0.00 | (+0.12) | 17.7 | 20.4 |
| 20 to 26 | 463 | +1.27 | +0.08 | +0.09 | +0.10 | 0.00 | +1.02 | 0.00 | (+0.18) | 23.3 | 23.1 |
| 26 to 30 | 394 | +1.23 | +0.17 | +0.05 | +0.13 | 0.00 | +0.88 | -0.01 | (+0.24) | 28.1 | 27.5 |
| 30 to 34 | 422 | +0.84 | +0.18 | +0.13 | +0.14 | 0.00 | +0.41 | -0.01 | (+0.37) | 31.9 | 31.5 |
| 34 and up | 236 | +1.34 | +1.11 | +0.37 | +0.10 | 0.00 | -0.23 | +0.00 | (+0.45) | 35.6 | 33.7 |

### 11c2. Starter or bench (trial)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Started | 9482 | +0.35 | -0.07 | +0.11 | +0.09 | 0.00 | +0.23 | 0.00 | (+0.24) | 30.3 | 30.5 |
| Came off the bench | 2816 | +1.23 | +0.65 | +0.10 | +0.06 | 0.00 | +0.42 | 0.00 | (+0.14) | 23.7 | 22.0 |

### 11d. By games this season (trial)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 0 to 2 | 4746 | +0.56 | +0.10 | -0.12 | +0.11 | 0.00 | +0.48 | -0.01 | (+0.25) | 28.6 | 28.4 |
| 3 to 5 | 4826 | +0.54 | +0.13 | +0.24 | +0.07 | 0.00 | +0.10 | +0.00 | (+0.22) | 28.8 | 28.5 |
| 6 or more | 2726 | +0.57 | +0.03 | +0.27 | +0.07 | 0.00 | +0.20 | +0.00 | (+0.16) | 29.0 | 28.9 |

### 11e. By stat (archive)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| All | 11395 | +0.07 | +0.22 | +0.12 | -0.26 | -0.82 | +0.80 | +0.00 | (-0.06) | 30.2 | 29.5 |
| Points | 1328 | +0.06 | +0.31 | +0.18 | -0.38 | -1.28 | +1.24 | +0.00 | (-0.08) | 27.9 | 27.3 |
| Rebounds | 1234 | +0.14 | +0.13 | +0.07 | -0.08 | -0.16 | +0.19 | 0.00 | (-0.03) | 28.9 | 28.2 |
| Assists | 1094 | -0.01 | +0.06 | +0.05 | -0.13 | -0.45 | +0.45 | +0.00 | (-0.02) | 30.4 | 29.7 |
| Threes | 1079 | +0.00 | +0.04 | +0.02 | -0.02 | -0.17 | +0.13 | 0.00 | (-0.01) | 29.9 | 29.1 |
| Steals | 888 | -0.05 | +0.02 | +0.02 | -0.03 | -0.07 | +0.01 | +0.00 | (-0.01) | 32.1 | 31.4 |
| Blocks | 795 | +0.01 | +0.02 | +0.01 | -0.02 | +0.00 | +0.01 | 0.00 | (0.00) | 32.0 | 31.0 |
| Pts+reb+ast | 1113 | +0.18 | +0.52 | +0.28 | -0.62 | -2.00 | +2.00 | +0.00 | (-0.14) | 29.9 | 29.3 |
| Pts+reb | 1204 | +0.19 | +0.44 | +0.24 | -0.48 | -1.51 | +1.50 | +0.00 | (-0.11) | 29.1 | 28.5 |
| Pts+ast | 1029 | -0.04 | +0.41 | +0.23 | -0.57 | -1.93 | +1.82 | +0.00 | (-0.11) | 31.0 | 30.3 |
| Ast+reb | 1041 | +0.13 | +0.20 | +0.11 | -0.21 | -0.62 | +0.65 | +0.00 | (-0.05) | 30.8 | 30.1 |
| Stl+blk | 590 | +0.03 | +0.06 | +0.02 | -0.06 | -0.07 | +0.07 | +0.00 | (-0.01) | 33.3 | 32.2 |

### 11f. By projected minutes (archive)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| under 20 | 1424 | -0.32 | -0.29 | +0.05 | -0.12 | -0.43 | +0.47 | 0.00 | (-0.04) | 15.0 | 16.0 |
| 20 to 26 | 1838 | -0.27 | -0.11 | +0.08 | -0.17 | -0.58 | +0.50 | 0.00 | (-0.04) | 23.1 | 23.5 |
| 26 to 30 | 1369 | -0.44 | -0.15 | +0.10 | -0.21 | -0.72 | +0.55 | 0.00 | (-0.05) | 28.0 | 28.4 |
| 30 to 34 | 2299 | -0.03 | +0.05 | +0.15 | -0.25 | -0.84 | +0.87 | +0.00 | (-0.04) | 32.2 | 32.0 |
| 34 and up | 4465 | +0.53 | +0.71 | +0.15 | -0.35 | -1.06 | +1.08 | +0.00 | (-0.08) | 37.6 | 35.3 |

### 11g. On the 3-point bets (trial)

| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Over bets | 2796 | +2.45 | +1.09 | +0.10 | +0.17 | 0.00 | +1.09 | -0.01 | (+0.24) | 29.0 | 26.6 |
| Under bets | 3231 | -1.20 | -0.88 | +0.14 | +0.05 | 0.00 | -0.51 | 0.00 | (+0.24) | 27.4 | 29.5 |
| No bet | 6271 | +0.62 | +0.15 | +0.10 | +0.07 | 0.00 | +0.31 | 0.00 | (+0.19) | 29.4 | 28.9 |

### 12. Minutes, on every called player who played (trial)

| Projected | Players | Said | Played | Said - played | Mean abs. error | Walk-forward rule on the box's side (hindsight): said | its error | Base b (before the side's scale) | Side scale m / b |
|---|---|---|---|---|---|---|---|---|---|
| All | 2383 | 24.2 | 23.3 | +0.94 | 4.79 | 24.3 | 4.80 | 23.9 | 1.015 |
| under 20 | 750 | 15.2 | 14.5 | +0.71 | 5.29 | 15.3 | 5.30 | 14.9 | 1.016 |
| 20 to 26 | 571 | 23.1 | 21.8 | +1.32 | 5.14 | 23.2 | 5.15 | 22.7 | 1.014 |
| 26 to 30 | 402 | 28.0 | 27.3 | +0.75 | 4.76 | 28.2 | 4.74 | 27.7 | 1.014 |
| 30 to 34 | 424 | 31.9 | 31.4 | +0.49 | 3.97 | 32.0 | 4.03 | 31.6 | 1.010 |
| 34 and up | 236 | 35.6 | 33.7 | +1.84 | 3.84 | 35.6 | 3.85 | 34.9 | 1.015 |

A side's called players who played: said 238.8 minutes, played 229.6 (a game has 240, more in overtime). Sides with a late scratch (a called player of 20+ who did not play): 64 of 242; with a player of 15+ minutes and no call: 65.

### 13. Pace and the league's scoring, expected against played

| Games | Count | Expected pace | Played | Played - expected |
|---|---|---|---|---|
| Trial games (2026-27) | 121 | 103.24 | 102.32 | -0.92 |
| 2023-24: its first 15 game days | 117 | 102.75 | 102.50 | -0.25 |
| 2024-25: its first 15 game days | 120 | 101.64 | 101.94 | +0.30 |
| 2025-26: its first 15 game days | 109 | 102.66 | 103.20 | +0.54 |
| 2023-24: whole regular season | 1232 | 101.14 | 100.79 | -0.36 |
| 2024-25: whole regular season | 1236 | 101.31 | 101.23 | -0.08 |
| 2025-26: whole regular season | 1237 | 101.91 | 101.85 | -0.06 |

Per 36 minutes, every player who played: the rate the model carried into the game (his rate before pace and opponent) against what was made.

| Games | Player-games | Points: carried in | made | Rebounds | made | Assists | made | Threes | made |
|---|---|---|---|---|---|---|---|---|---|
| Trial games (2026-27) | 2664 | 17.80 | 16.94 | 6.57 | 6.59 | 3.94 | 3.90 | 2.00 | 1.96 |
| 2023-24: first 15 game days | 2488 | 17.44 | 16.92 | 6.56 | 6.62 | 3.81 | 3.83 | 1.88 | 1.85 |
| 2024-25: first 15 game days | 2584 | 17.01 | 16.97 | 6.48 | 6.59 | 3.87 | 3.86 | 1.89 | 1.98 |
| 2025-26: first 15 game days | 2381 | 17.31 | 17.46 | 6.65 | 6.51 | 3.79 | 3.92 | 1.98 | 1.98 |
| 2023-24: whole regular season | 26216 | 17.23 | 17.03 | 6.49 | 6.49 | 3.92 | 3.98 | 1.90 | 1.91 |
| 2024-25: whole regular season | 26229 | 16.85 | 16.98 | 6.54 | 6.58 | 3.93 | 3.96 | 1.95 | 2.02 |
| 2025-26: whole regular season | 26579 | 17.08 | 17.25 | 6.55 | 6.53 | 3.93 | 3.99 | 1.96 | 1.99 |
| 2026 play-in and playoffs (fold model's rates) | 1876 | 18.01 | 16.07 | 6.67 | 6.35 | 4.08 | 3.47 | 1.97 | 1.79 |

The earlier seasons' rows use the live constants' rate rule on the replay (a description of the rule, not a refit); the replay's rows are every player the box lists who played and had a game on record.

### 13b. The season's opening weeks, this season and the three before

The first 15 regular-season game days of each season (the trial's span). Points: both teams' points a game; the posted total where games.csv has one. Opponent factor: the factor the model applied (the opponent's allowed rate over the league's, to the fitted power), averaged over every player-game's minutes, points and rebounds. Minutes: the walk-forward rule on the box's side, each season by its own fold's constants (fitted on the seasons before it; the trial's row by the live constants), on players projected 8 or more who played, as the ledger calls them.

| Season | Games | Points a game | Posted total | Opponent factor, points | rebounds | Minutes: players | said - played | of the side: said | played |
|---|---|---|---|---|---|---|---|---|---|
| 2023-24 | 117 | 226.8 |  | 1.005 | 1.001 | 2282 | +0.62 | 239.8 | 233.8 |
| 2024-25 | 120 | 226.9 |  | 1.009 | 1.003 | 2316 | +0.65 | 237.9 | 231.6 |
| 2025-26 | 109 | 234.1 |  | 1.006 | 1.004 | 2157 | +0.94 | 240.6 | 231.3 |
| 2026-27 | 121 | 226.9 | 229.9 | 1.008 | 1.005 | 2437 | +1.01 | 242.4 | 232.3 |

Whole regular seasons, points a game: 2023-24 228.4, 2024-25 227.6, 2025-26 231.2. The minutes rows of the trial's games here are the walk-forward rule's on the box's side, not the frozen calls' (those are in table 12).

### 14. The spread: squared error against the variance the call said

On the graded lines: the mean of (stat - mean)^2 over the mean of the call's variance (1.00 is right; above, the spread is too narrow). The walk-forward column is the same ratio on the 2026 regular season's backtest rows (box's side, constants fitted on 2023-2025), where the spreads were fitted on such rows.

| Stat | Trial: ratio | at the walk-forward's minutes (hindsight) | 2026 regular season walk-forward | Archive |
|---|---|---|---|---|
| Points | 0.839 | 0.841 | 0.872 | 0.837 |
| Rebounds | 0.921 | 0.918 | 0.965 | 0.937 |
| Assists | 0.964 | 0.961 | 1.021 | 0.919 |
| Threes | 0.925 | 0.922 | 0.987 | 0.946 |
| Steals | 0.942 | 0.939 | 1.016 | 1.126 |
| Blocks | 1.030 | 1.031 | 1.000 | 1.021 |
| Pts+reb+ast | 0.879 | 0.881 | 0.906 | 0.866 |
| Pts+reb | 0.865 | 0.867 | 0.895 | 0.862 |
| Pts+ast | 0.900 | 0.902 | 0.887 | 0.846 |
| Ast+reb | 0.907 | 0.905 | 0.978 | 0.899 |
| Stl+blk | 1.230 | 1.227 | 1.005 | 0.999 |

### 15. Which piece costs the log loss (trial; what-ifs with hindsight, diagnosis only, not candidates)

Each row prices every graded line again with one piece of the call replaced, the rest and the fit's spread as they were. "The minutes he played" is the call's rate times his actual minutes (the call's mean x played / said): the minutes he went on to play, which no model has before tip. It is an upper bound inflated by hindsight, not what a better minutes forecast would gain: the minutes played carry the game's own results (foul trouble, a blowout, an injury, overtime), so pricing on them reads part of the result, and its bets win on both sides, which no forecast made before tip does. "Walk-forward minutes" is tools/props.js's own backtest rule on the box's side (who dressed, known after the fact). Lines where the replay has no row are left out of every row.

| Version | Lines | Model said | Over hit | Log loss, model - DK | 3-pt Overs | 3-pt Unders |
|---|---|---|---|---|---|---|
| The frozen call | 12298 | 48.8% | 47.5% | +0.0184 [+0.0138, +0.0233] | 2796, 1343, -226.5 (-8.1%) | 3231, 1741, +3.7 (+0.1%) |
| Walk-forward minutes (the box's side) | 12298 | 49.1% | 47.5% | +0.0185 [+0.0138, +0.0236] | 2902, 1395, -235.1 (-8.1%) | 3065, 1649, -3.5 (-0.1%) |
| The minutes he played | 12298 | 48.0% | 47.5% | -0.0560 [-0.0639, -0.0480] | 3636, 2370, +862.5 (+23.7%) | 4273, 2988, +1305.0 (+30.5%) |
| No pace or opponent factor | 12298 | 46.8% | 47.5% | +0.0167 [+0.0122, +0.0217] | 2134, 1055, -113.2 (-5.3%) | 4189, 2262, +20.4 (+0.5%) |
| No pace factor | 12298 | 47.3% | 47.5% | +0.0170 [+0.0124, +0.0220] | 2236, 1094, -138.2 (-6.2%) | 3900, 2098, -1.2 (0.0%) |
| Spread scaled to the 2026 regular season walk-forward's own ratio (table 14; no 2026-27 number) | 12298 | 49.1% | 47.5% | +0.0202 [+0.0154, +0.0253] | 3006, 1465, -207.8 (-6.9%) | 3174, 1710, +0.4 (+0.0%) |
| Halfway to DraftKings' fair chance (a yardstick only) | 12298 | 47.4% | 47.5% | +0.0031 [+0.0010, +0.0053] | 543, 274, -22.0 (-4.1%) | 2183, 1172, -1.3 (-0.1%) |

On the archive the same narrowed spread says the Over 44.8% (as fitted 44.6%; it happened 45.9%), log loss model - DK +0.0157 (as fitted +0.0147).

