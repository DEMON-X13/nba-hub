# PLAN.md sizing tables (development data only)

Drawn by `plan_sizing/tables.js` from `plan_sizing.json`, `plan_sizing2.json`, `plan_leakcheck.json` and `plan_bootcheck.json`. Log-loss and Brier differences are in units of 0.0001 (negative: the nudge helps). The bar sized: T1, b's 90% interval above 0.25 with at least 0.05 of the nudge outside the family's span; T2, the log-loss difference's 90% interval below -1 (x 0.0001), Brier's below -0.5, no stat's log-loss interval wholly above 0. The family F has 194 columns. The stand-in forecaster is tools/props.js's 2024 fold (fitted on 2022-23 box scores): a size, never a candidate.

## A. The stand-in nudges, on lines they were not fitted on

| Split | Nudge | T1: b [90%] | orth | T1 | T2: log loss [90%] | Brier [90%] | T2 | power T1 / T2 (1,100 games) | at half the effect |
|---|---|---|---|---|---|---|---|---|---|
| Chronological (508 games) | S_mix | 1.34 [1.16, 1.52] | 0.82 | met | -12.7 [-16.2, -9.2] | -5.8 [-7.4, -4.2] | met | 1.00 / 1.00 | 1.00 / 0.97 |
| Chronological (508 games) | S_d | 0.83 [0.58, 1.09] | 0.88 | met | -3.9 [-7.7, 0.0] | -1.8 [-3.6, 0.0] | not met | 1.00 / 0.54 | 0.47 / 0.13 |
| Alternate A|B (574 games) | S_mix | 1.03 [0.88, 1.18] | 0.85 | met | -10.1 [-13.8, -6.4] | -4.8 [-6.5, -3.1] | met | 1.00 / 1.00 | 0.99 / 0.80 |
| Alternate A|B (574 games) | S_d | 1.06 [0.79, 1.33] | 0.89 | met | -5.4 [-8.3, -2.4] | -2.6 [-3.9, -1.2] | met | 1.00 / 0.96 | 0.77 / 0.37 |
| Alternate B|A (542 games) | S_mix | 0.88 [0.73, 1.03] | 0.85 | met | -8.4 [-12.7, -3.8] | -3.9 [-6.0, -1.8] | met | 1.00 / 0.99 | 0.90 / 0.51 |
| Alternate B|A (542 games) | S_d | 0.64 [0.43, 0.85] | 0.88 | met | -1.5 [-5.6, 2.6] | -0.7 [-2.6, 1.2] | not met | 1.00 / 0.09 | 0.19 / 0.04 |
| Forward-chained, Dec to Apr (863 games) | S_mix | 1.23 [1.08, 1.37] | 0.84 | met | -10.9 [-13.6, -8.2] | -5.0 [-6.3, -3.8] | met | 1.00 / 1.00 | 1.00 / 0.90 |
| Forward-chained, Dec to Apr (863 games) | S_d | 0.86 [0.66, 1.05] | 0.89 | met | -4.2 [-7.0, -1.3] | -1.9 [-3.3, -0.6] | met | 1.00 / 0.64 | 0.52 / 0.16 |
| The archive, frozen on all 2023-24 (83 games, spent) | S_mix | 1.04 [0.50, 1.58] | 0.69 | | -4.6 [-14.2, 5.1] | -2.3 | | | |

## B. Every information-free rival, against the bar (the margin by which each fails)

"On q": fitted on top of DraftKings' fair chance, as a rival would be built. "Held out": features F does not hold, fitted the candidate's way (jointly with F), to size the margin against a rival nobody named. T1 margin: B_MIN less the interval's lower bound (positive: fails); "span" where the rival lies in F's span (no b). T2 margin: the interval's upper bound plus M_LL (positive: fails).

| Rival | Chronological: T1 margin, T2 margin | Alternate A|B: T1 margin, T2 margin | Alternate B|A: T1 margin, T2 margin |
|---|---|---|---|
| R1_rescale (on q) | span (orth 2e-7), 11.3 | span (orth 1e-7), 9.8 | span (orth 2e-7), 9.4 |
| R1s_rescale_by_stat (on q) | span (orth 2e-7), 14.1 | span (orth 9e-8), 12.4 | span (orth 1e-7), 13.9 |
| R2_mult (on q) | span (orth 2e-7), 34.0 | span (orth 2e-7), 32.5 | span (orth 2e-7), 34.5 |
| R2_power (on q) | span (orth 3e-4), 27.4 | span (orth 3e-4), 25.9 | span (orth 3e-4), 27.6 |
| R2_additive (on q) | span (orth 6e-5), 29.2 | span (orth 6e-5), 27.8 | span (orth 6e-5), 29.5 |
| R2_marginOnUnder (on q) | span (orth 6e-5), 99.2 | span (orth 6e-5), 95.4 | span (orth 6e-5), 99.3 |
| R2_devig_fitted (on q) | span (orth 3e-7), 14.1 | span (orth 4e-8), 12.6 | span (orth 6e-7), 14.1 |
| R3_stat (on q) | span (orth 3e-9), 11.1 | span (orth 5e-9), 10.3 | span (orth 2e-8), 11.0 |
| R3_band (on q) | span (orth 1e-9), 16.6 | span (orth 6e-9), 15.7 | span (orth 2e-8), 17.3 |
| R3_side (on q) | span (orth 4e-10), 14.5 | span (orth 1e-9), 13.6 | span (orth 6e-9), 13.1 |
| R4_month (on q) | span (orth 0e+0), 1.0 | span (orth 8e-9), 15.6 | span (orth 2e-8), 17.6 |
| R5_night (on q) | span (orth 7e-8), 12.4 | span (orth 3e-7), 11.8 | span (orth 2e-7), 11.6 |
| R7_game (on q) | span (orth 4e-9), 15.1 | span (orth 7e-9), 13.7 | span (orth 9e-9), 14.7 |
| R8_position (on q) | span (orth 1e-9), 17.2 | span (orth 2e-9), 14.1 | span (orth 8e-9), 17.6 |
| R9_posting (on q) | span (orth 4e-8), 18.0 | span (orth 7e-8), 15.6 | span (orth 1e-7), 17.8 |
| R_all (on q) | span (orth 9e-8), 34.5 | span (orth 1e-7), 34.5 | span (orth 4e-7), 38.7 |
| R2_mult (the candidate's way) | span (orth 4e-8), 124.3 | span (orth 4e-8), 119.1 | span (orth 3e-8), 294.8 |
| R2_power (the candidate's way) | span (orth 2e-6), 183.5 | span (orth 2e-6), 180.4 | span (orth 2e-6), 234.4 |
| R2_additive (the candidate's way) | span (orth 9e-7), 157.7 | span (orth 1e-6), 157.2 | span (orth 6e-7), 286.0 |
| U1_band_by_month (held out) | span (orth 0e+0), 1.0 | 0.23, 28.1 | 0.22, 20.7 |
| U2_weekday (held out) | 2.20, 1.9 | 1.79, 9.0 | 1.44, 5.5 |
| U3_home_by_favourite (held out) | 1.12, 3.6 | 1.34, 3.1 | 1.08, 3.9 |
| U4_posted_margins (held out) | 8.74, 645.9 | 0.59, 111.4 | 0.36, 116.3 |
| U5_line_size_bands (held out) | 0.66, 14.6 | 0.80, 22.0 | 0.84, 29.2 |
| U9_line_move (held out) | 0.47, 3.3 | 0.59, 4.9 | 0.45, 5.0 |
| U11_schedule_density (held out) | 1.12, 5.9 | 1.22, 2.9 | 0.76, 5.1 |
| S_mix shuffled across players (within stat and month) | 0.26 (closest of 20), 12.0 | 0.31 (closest of 10), 16.1 | 0.29 (closest of 10), 18.8 |

Of 78 rival fits (three splits), none meets T1 or T2. The closest to T1, with at least 0.05 of its variance outside F: margin 0.22; the closest to T2 among rivals whose nudge is not zero: margin 1.9 (x 0.0001); a rival whose nudge comes out zero (a month its training half never held) fails T2 by M_LL exactly. Every shuffle fails both.

## C. The stand-in candidate's calibration by stat (forward-chained, December to April)

P(Over) = sigm(a + s logit p) on each stat's lines; "said less hit" is the mean chance less the Over rate, in points. MA is the stand-in candidate (its information-free part frozen with the nudge).

| Stat | Lines | MA: slope [90%] | MA: said less hit | DraftKings' fair chance: slope [90%] | said less hit | the nudge's T2 on the stat [90%] |
|---|---|---|---|---|---|---|
| pts | 11564 | 0.64 [0.40, 0.88] | 0.05 | 0.77 [0.50, 1.04] | -1.68 | 2.4 [-1.3, 6.0] |
| reb | 12344 | 0.92 [0.80, 1.04] | 1.04 | 1.04 [0.89, 1.18] | -0.02 | -6.3 [-11.3, -1.3] |
| ast | 7471 | 1.07 [0.90, 1.23] | 0.72 | 0.94 [0.78, 1.09] | -2.26 | -7.0 [-12.5, -1.9] |
| tpm | 11737 | 0.96 [0.89, 1.03] | -0.62 | 1.02 [0.94, 1.10] | -2.05 | -9.9 [-15.3, -4.5] |
| stl | 12978 | 1.08 [1.01, 1.15] | -0.02 | 1.07 [1.00, 1.14] | -0.18 | -26.7 [-36.6, -16.7] |
| blk | 12832 | 1.06 [1.00, 1.12] | 0.58 | 0.88 [0.83, 0.93] | -1.93 | -14.4 [-21.0, -6.9] |

The stand-in candidate less DraftKings' fair chance (forward-chained): log loss -17.6 [-21.9, -13.4], Brier -7.9 [-9.8, -6.0]; less tools/props.js -124.6 [-139.6, -109.3].

By split (slope [90%], said less hit):

| Split | pts | reb | ast | tpm | stl | blk |
|---|---|---|---|---|---|---|
| Chronological, MA | 0.59 [0.27, 0.91], 0.4 | 1.22 [1.04, 1.39], -0.1 | 1.28 [1.05, 1.51], 0.4 | 0.99 [0.89, 1.08], -0.7 | 1.14 [1.05, 1.23], -1.4 | 1.14 [1.06, 1.21], 0.7 |
| Chronological, DraftKings | 0.64 [0.28, 1.00], -1.5 | 1.23 [1.04, 1.41], -0.5 | 1.05 [0.85, 1.26], -2.3 | 1.02 [0.92, 1.12], -2.4 | 1.11 [1.02, 1.21], -0.7 | 0.93 [0.86, 0.99], -1.6 |
| Alternate A|B, MA | 0.71 [0.40, 1.02], -0.1 | 1.09 [0.94, 1.25], 0.8 | 1.09 [0.90, 1.28], -0.9 | 0.99 [0.90, 1.08], -0.7 | 1.18 [1.10, 1.27], -1.2 | 1.00 [0.93, 1.06], 1.1 |
| Alternate A|B, DraftKings | 0.74 [0.40, 1.08], -1.8 | 1.13 [0.96, 1.30], -0.2 | 0.96 [0.78, 1.15], -2.9 | 1.04 [0.94, 1.14], -2.0 | 1.12 [1.03, 1.20], -1.0 | 0.88 [0.82, 0.94], -1.6 |
| Alternate B|A, MA | 1.41 [0.97, 1.86], 0.2 | 0.90 [0.75, 1.06], -0.8 | 0.92 [0.73, 1.10], 0.9 | 1.02 [0.93, 1.12], 0.7 | 0.83 [0.76, 0.91], 1.2 | 1.00 [0.93, 1.07], -1.1 |
| Alternate B|A, DraftKings | 1.07 [0.71, 1.42], -1.6 | 1.05 [0.86, 1.23], -0.9 | 0.94 [0.75, 1.14], -2.0 | 1.05 [0.95, 1.15], -1.4 | 0.96 [0.87, 1.05], 0.1 | 0.87 [0.80, 0.93], -2.7 |

## D. Is the stat mix an artefact? (`plan_leakcheck.json`)

- Early exits (projected 24+ minutes, played his club's previous game, played under 12): 414 lines on 77 player-games; the nudge moves their chance by 0.06 points on average, the rest's 0.02; DraftKings said 45.0% and 44.9%.
- The level read without the points line: the gain on the other stats -10.7 [-14.0, -7.5], as built -11.9, from points alone -8.7.
- Correlation with the minutes surprise (played less projected), per player-game: the nudge 0.002; the raw disagreement -0.396; DraftKings' level 0.393.
- Where his points line is posted: -11.5; where it is not: -15.1 (7076 lines).

## E. The interval for T1: cluster-robust against the game-clustered bootstrap (`plan_bootcheck.json`)

Chronological split, S_mix: robust b 1.34 [1.16, 1.52], standard error 0.112; bootstrap (400 resamples of games) [1.18, 1.55], standard deviation 0.114.

## F. Round 1 (the small family), kept for the record

With a family of per-stat intercepts, logit q, logit of the implied Over, the total, the spread's size and the generic mix, and pooled hinges, favourite, home, month and night/game features (52 columns), three rivals met T1 on the alternate-nights split:

- R4_month: Alternate A|B b 0.60 [0.31, 0.88]; Alternate B|A b 0.50 [0.23, 0.78]
- R7_game: Alternate A|B b 1.17 [0.66, 1.68]; Alternate B|A b 0.51 [0.15, 0.86]
- R_all: Alternate A|B b 0.28 [0.11, 0.44]; Alternate B|A b 0.23 [0.08, 0.38]

which is why F is the union of the named rivals' features (round 2).
