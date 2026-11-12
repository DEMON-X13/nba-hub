# The tables of why_it_failed.md

Drawn by `node research/props_v3/why_tables.js` from `results/why_trial.json`, `results/why_lines_archive.json` and `results/why_lines_2024.json`; it computes no number of its own.

### A. The gap, rebuilt from the raw inputs (model less DraftKings; positive: DraftKings is better; 90% intervals resampling games)

| Set | Lines | Games | Log loss: model / DraftKings | Difference [90%] | Brier difference [90%] |
| --- | --- | --- | --- | --- | --- |
| The trial (2026-27, 20 Oct to 4 Nov), tools/props.js | 12298 | 121 | 0.7044 / 0.6860 | +0.0184 [+0.0136, +0.0233] | +0.0083 [+0.0060, +0.0105] |
|   of which the six base stats | 6776 | 121 | 0.6952 / 0.6816 | +0.0136 [+0.0094, +0.0177] | +0.0060 [+0.0041, +0.0079] |
| The 2026 play-in and playoffs (archive), tools/props.js | 11395 | 83 | 0.6934 / 0.6788 | +0.0147 [+0.0083, +0.0214] | +0.0064 [+0.0036, +0.0094] |
| The 2026 play-in and playoffs (archive), candidate A | 11395 | 83 | 0.6913 / 0.6788 | +0.0125 [+0.0065, +0.0189] | +0.0056 [+0.0029, +0.0084] |
| DraftKings 2023-24 regular season, tools/props.js | 89032 | 1116 | 0.6770 / 0.6672 | +0.0098 [+0.0084, +0.0112] | +0.0040 [+0.0035, +0.0046] |
| DraftKings 2023-24 regular season, candidate A | 89032 | 1116 | 0.6769 / 0.6672 | +0.0097 [+0.0084, +0.0110] | +0.0041 [+0.0036, +0.0047] |

### B. How sure each is: the average distance of its chance from 50%, and its calibration slope (1 is right; under 1 too sure)

| Set | Model: from 50% | DraftKings: from 50% | Model slope [90%] | DraftKings slope [90%] | Candidate A slope [90%] |
| --- | --- | --- | --- | --- | --- |
| The trial (2026-27, 20 Oct to 4 Nov) | 9.0% | 5.2% | 0.27 [0.18, 0.37] | 1.01 [0.86, 1.17] | – |
|   of which the six base stats (6776 lines) | 9.2% | 6.5% | 0.44 [0.34, 0.53] | 1.04 [0.88, 1.20] | – |
|   of which the five combos (5522 lines) | 8.8% | 3.7% | 0.07 [−0.04, 0.19] | 0.83 [0.39, 1.25] | – |
| The 2026 play-in and playoffs (archive) | 9.5% | 6.2% | 0.43 [0.32, 0.56] | 1.00 [0.87, 1.12] | 0.46 [0.34, 0.59] |
| DraftKings 2023-24 regular season | 11.0% | 8.9% | 0.66 [0.63, 0.68] | 0.94 [0.92, 0.97] | 0.68 [0.65, 0.70] |

The chance said, in bands, against how often the Over went in (the trial):

| Chance said | Model: lines | said | hit | DraftKings: lines | said | hit |
| --- | --- | --- | --- | --- | --- | --- |
| 0-30% | 588 | 25.2% | 44.6% | 94 | 27.6% | 27.7% |
| 30-40% | 2149 | 35.8% | 40.8% | 1316 | 36.2% | 38.1% |
| 40-45% | 1726 | 42.6% | 46.1% | 2789 | 43.2% | 44.6% |
| 45-50% | 2079 | 47.6% | 47.5% | 6057 | 47.2% | 48.5% |
| 50-55% | 2125 | 52.5% | 49.4% | 1437 | 52.0% | 53.7% |
| 55-60% | 1676 | 57.4% | 51.2% | 408 | 57.1% | 57.4% |
| 60-70% | 1631 | 63.8% | 51.9% | 197 | 62.4% | 65.5% |
| 70-100% | 324 | 74.2% | 51.5% | 0 | – | – |

### C. The calibration slope by stat: model / DraftKings [90%]

| Stat | Trial: model | Trial: DraftKings | Archive: model | Archive: DraftKings | 2023-24: model | 2023-24: DraftKings |
| --- | --- | --- | --- | --- | --- | --- |
| Points | 0.15 [−0.02, 0.33] | 0.84 [0.00, 1.77] | −0.10 [−0.31, 0.14] | 1.21 [0.31, 2.15] | 0.08 [0.02, 0.15] | 0.90 [0.66, 1.15] |
| Rebounds | 0.34 [0.16, 0.51] | 1.27 [0.87, 1.70] | 0.31 [0.08, 0.56] | 0.74 [0.28, 1.20] | 0.34 [0.28, 0.40] | 1.09 [0.97, 1.21] |
| Assists | 0.26 [0.08, 0.48] | 0.90 [0.54, 1.27] | 0.57 [0.35, 0.83] | 1.09 [0.76, 1.46] | 0.29 [0.22, 0.35] | 0.95 [0.81, 1.09] |
| Threes | 0.53 [0.35, 0.73] | 0.78 [0.57, 1.04] | 0.74 [0.55, 0.95] | 0.97 [0.77, 1.19] | 0.78 [0.72, 0.84] | 1.04 [0.98, 1.12] |
| Steals | 1.02 [0.75, 1.32] | 1.15 [0.86, 1.46] | 1.20 [0.95, 1.49] | 1.23 [0.98, 1.52] | 0.85 [0.80, 0.91] | 1.04 [0.98, 1.10] |
| Blocks | 1.06 [0.73, 1.43] | 1.58 [1.18, 2.01] | 0.92 [0.71, 1.14] | 0.93 [0.71, 1.17] | 0.83 [0.79, 0.88] | 0.87 [0.83, 0.91] |
| Pts+reb+ast | 0.04 [−0.11, 0.18] | 1.43 [−0.18, 3.22] | −0.01 [−0.22, 0.23] | 1.25 [−0.16, 2.72] | – | – |
| Pts+reb | 0.17 [0.00, 0.34] | 1.32 [0.00, 2.73] | 0.05 [−0.17, 0.29] | 2.51 [1.22, 3.96] | – | – |
| Pts+ast | −0.01 [−0.17, 0.17] | 0.71 [−0.55, 1.96] | −0.03 [−0.25, 0.22] | 1.61 [0.35, 2.92] | – | – |
| Ast+reb | 0.09 [−0.10, 0.28] | 0.95 [0.22, 1.66] | 0.27 [0.03, 0.54] | 0.89 [0.21, 1.62] | – | – |
| Stl+blk | −0.29 [−0.89, 0.30] | 0.23 [−0.71, 1.15] | 0.63 [0.26, 1.08] | 0.77 [0.30, 1.28] | – | – |

### D. Where the gap sits: lines where the two disagree by 10 points or more

| Set | Share of lines | Share of the gap | Model 10+ higher: model said / DraftKings / the Over hit | DraftKings 10+ higher: model said / DraftKings / hit |
| --- | --- | --- | --- | --- |
| The trial (2026-27, 20 Oct to 4 Nov) | 31.4% | 91.9% | 61.7% / 45.8% / 48.1% (2680 lines) | 30.8% / 46.4% / 48.2% (1186 lines) |
| The 2026 play-in and playoffs (archive) | 21.1% | 98.3% | 59.6% / 45.1% / 45.7% (900 lines) | 30.5% / 47.0% / 48.0% (1500 lines) |
| DraftKings 2023-24 regular season | 17.7% | 89.7% | 57.9% / 43.6% / 47.9% (6975 lines) | 30.5% / 47.0% / 45.9% (8760 lines) |

### E. The gap taken apart (each part at most, by a recalibration fitted on the very lines: an upper bound, not a candidate)

| Set | Gap | The Over lean | Over-sureness | Information DraftKings had | Slope a recalibration needs |
| --- | --- | --- | --- | --- | --- |
| The trial (2026-27, 20 Oct to 4 Nov) | 0.0184 | 0.0006 (3%) | 0.0139 (76%) | 0.0039 (21%) | 0.27 |
|   of which the six base stats | 0.0136 | 0.0004 (3%) | 0.0082 (61%) | 0.0049 (36%) | 0.44 |
|   of which the five combos | 0.0244 | 0.0009 (4%) | 0.0230 (94%) | 0.0005 (2%) | 0.07 |
| The 2026 play-in and playoffs (archive) | 0.0147 | 0.0004 (3%) | 0.0084 (57%) | 0.0059 (40%) | 0.43 |
| DraftKings 2023-24 regular season | 0.0098 | 0.0003 (3%) | 0.0043 (44%) | 0.0052 (53%) | 0.66 |

By stat (the gap, then lean / over-sureness / information):

| Stat | Trial | Archive | 2023-24 |
| --- | --- | --- | --- |
| Points | +0.0175: +0.0007 / +0.0170 / −0.0002 | +0.0288: +0.0021 / +0.0257 / +0.0010 | +0.0221: +0.0010 / +0.0206 / +0.0004 |
| Rebounds | +0.0126: 0.0000 / +0.0099 / +0.0027 | +0.0082: +0.0001 / +0.0096 / −0.0015 | +0.0135: +0.0003 / +0.0097 / +0.0034 |
| Assists | +0.0223: +0.0010 / +0.0169 / +0.0043 | +0.0092: +0.0004 / +0.0046 / +0.0042 | +0.0188: +0.0006 / +0.0153 / +0.0029 |
| Threes | +0.0071: +0.0007 / +0.0052 / +0.0013 | +0.0083: +0.0005 / +0.0023 / +0.0056 | +0.0053: +0.0004 / +0.0016 / +0.0033 |
| Steals | +0.0026: +0.0002 / 0.0000 / +0.0024 | −0.0010: +0.0003 / +0.0010 / −0.0022 | +0.0026: +0.0002 / +0.0007 / +0.0016 |
| Blocks | +0.0124: +0.0022 / +0.0003 / +0.0100 | −0.0005: +0.0001 / +0.0002 / −0.0007 | +0.0013: +0.0002 / +0.0014 / −0.0003 |
| Pts+reb+ast | +0.0283: +0.0016 / +0.0259 / +0.0008 | +0.0277: +0.0019 / +0.0253 / +0.0005 | – |
| Pts+reb | +0.0182: +0.0007 / +0.0179 / −0.0005 | +0.0239: +0.0018 / +0.0200 / +0.0022 | – |
| Pts+ast | +0.0300: +0.0019 / +0.0279 / +0.0003 | +0.0267: +0.0022 / +0.0235 / +0.0011 | – |
| Ast+reb | +0.0223: +0.0001 / +0.0212 / +0.0010 | +0.0127: +0.0006 / +0.0121 / 0.0000 | – |
| Stl+blk | +0.0274: +0.0027 / +0.0324 / −0.0077 | +0.0010: +0.0005 / +0.0029 / −0.0025 | – |

### F. When they disagreed, whose number the result landed on, and through what

Slope of what happened (the stat less the model's mean) on DraftKings' disagreement (the mean its price implies less the model's), in the model's standard deviations: 1 means the result landed, on average, at DraftKings' number; 0 at the model's. The minutes share is the part of that which came through the minutes played rather than the production per minute.

| Lines | Trial: slope [90%] | Trial: minutes share [90%] | Archive: slope | Archive: minutes share | 2023-24: slope | 2023-24: minutes share |
| --- | --- | --- | --- | --- | --- | --- |
| All | 1.02 [0.92, 1.12] | 59% [52%, 65%] | 0.82 [0.66, 0.99] | 70% [61%, 80%] | 0.77 [0.72, 0.82] | 67% [64%, 70%] |
| The six base stats | 0.98 [0.88, 1.08] | 54% [48%, 61%] | – | – | 0.77 [0.72, 0.82] | 67% [64%, 70%] |
| Started | 1.02 [0.91, 1.14] | 53% [46%, 60%] | 0.80 [0.61, 0.99] | 68% [58%, 79%] | 0.77 [0.70, 0.83] | 67% [64%, 71%] |
| Off the bench | 0.96 [0.75, 1.16] | 69% [54%, 84%] | 0.90 [0.69, 1.09] | 76% [62%, 95%] | 0.76 [0.70, 0.83] | 64% [60%, 70%] |
| Points | 0.95 [0.84, 1.08] | 63% [55%, 73%] | 1.03 [0.85, 1.22] | 57% [48%, 68%] | 0.89 [0.84, 0.94] | 67% [64%, 71%] |
| Rebounds | 1.11 [0.92, 1.29] | 65% [55%, 78%] | 0.72 [0.50, 0.94] | 88% [68%, 118%] | 0.84 [0.79, 0.90] | 84% [79%, 89%] |
| Assists | 1.01 [0.83, 1.21] | 33% [26%, 42%] | 0.77 [0.53, 0.99] | 58% [46%, 76%] | 0.73 [0.56, 0.91] | 52% [48%, 57%] |
| Threes | 0.85 [0.61, 1.10] | 56% [40%, 81%] | 0.76 [0.40, 1.14] | 62% [41%, 110%] | 0.74 [0.66, 0.82] | 63% [57%, 70%] |
| Steals | 0.82 [0.32, 1.40] | 50% [27%, 130%] | 0.08 [−0.42, 0.56] | – (no disagreement came true to split) | 0.63 [0.55, 0.72] | 65% [57%, 75%] |
| Blocks | 0.58 [0.14, 1.03] | 53% [26%, 166%] | 0.54 [0.12, 1.02] | 50% [23%, 179%] | 0.67 [0.57, 0.80] | 50% [43%, 59%] |
| Pts+reb+ast | 1.05 [0.94, 1.17] | 64% [56%, 72%] | 0.92 [0.72, 1.11] | 72% [63%, 84%] | – | – |
| Pts+reb | 1.03 [0.92, 1.14] | 70% [62%, 79%] | 0.96 [0.76, 1.16] | 69% [60%, 80%] | – | – |
| Pts+ast | 1.08 [0.94, 1.20] | 54% [46%, 62%] | 0.98 [0.76, 1.18] | 62% [52%, 74%] | – | – |
| Ast+reb | 1.01 [0.84, 1.18] | 59% [49%, 71%] | 0.77 [0.54, 1.01] | 90% [72%, 114%] | – | – |
| Stl+blk | 1.54 [0.91, 2.41] | 39% [25%, 71%] | 0.62 [0.05, 1.16] | 101% [44%, 450%] | – | – |

The trial's late news (lines on a side where a called teammate projected 20+ minutes did not play, or a teammate played 15+ with no call: 4684 of 12298 lines): slope 1.11, minutes share 56% [47%, 65%]; lines with no late news (and the player not on the day's report): slope 0.94, minutes share 63% [54%, 72%]. The late-news lines carry 46% of the minutes part on 38% of the lines: beyond the no-news lines' rate per line, 13% [-1%, 25%] of the minutes part. The calls were made a median 9.40 hours before tip-off.

2023-24, every line on the box score's list of who dressed (so no inactive news was missing): his first game of the season slope 0.29, minutes 71%; back after 3+ missed games slope 0.69, minutes 105%; his first 10 games for a new club slope 0.85, minutes 72%; every other line slope 0.80, minutes 65% [62%, 68%].

Minutes said and played where they disagreed most:

| Set | Model 10+ higher on the Over: said / played | DraftKings 10+ higher: said / played | Within 5 points: said / played |
| --- | --- | --- | --- |
| The trial (2026-27, 20 Oct to 4 Nov) | 29.05 / 26.60 | 25.82 / 29.44 | 29.17 / 29.26 |
| The 2026 play-in and playoffs (archive) | 31.16 / 27.70 | 26.28 / 29.50 | 31.01 / 29.76 |
| DraftKings 2023-24 regular season | 28.59 / 25.87 | 24.10 / 28.27 | 28.57 / 28.31 |

The trial's points lines: where the model was 10+ points higher on the Over (408 lines) it said 15.14 points, DraftKings' price implied 12.46, the line averaged 11.91 and they scored 11.91; where DraftKings was 10+ higher (184), 13.01, 15.68, 15.20 and 15.55.

### G. The Over lean

| Set | Model said the Over / it hit / DraftKings said | Mean less the stat | One shift removes, at most (share of the gap) | A shift each month removes, at most |
| --- | --- | --- | --- | --- |
| The trial | 48.8% / 47.5% / 46.1% | +0.56 | 0.0003 (1.9%) | – |
| The 2026 play-in and playoffs (archive) | 44.6% / 45.9% / 45.6% | +0.07 | 0.0004 (2.6%) | 0.0006 (4.1%) |
| DraftKings 2023-24 regular season | 43.6% / 45.3% / 43.9% | 0.00 | 0.0006 (6.4%) | 0.0007 (7.4%) |

2023-24's first two months (20106 lines): the model said the Over 44.9%, it hit 45.7%; removing that lean in sample gains 0.0001 a line there, 0.3% of the season's gap.

Removing the trial's lean from the means instead (each stat's mean moved by its own average error, the spread unchanged) makes its log loss worse, 0.7044 to 0.7057: the model's distribution already shaded the Over at a line near its mean.

### H. Month by month, DraftKings 2023-24 (tools/props.js; candidate A beside it)

| Month | Lines | Gap [90%] | A's gap | Model said / hit / DraftKings | Mean less stat | Calibration slope | Lean removed, at most |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 2023-10 | 4600 | +0.0106 [+0.0043, +0.0171] | +0.0123 | 45.9% / 46.9% / 43.6% | +0.18 | 0.54 | 0.0002 |
| 2023-11 | 15506 | +0.0055 [+0.0030, +0.0082] | +0.0057 | 44.6% / 45.3% / 43.7% | +0.07 | 0.73 | 0.0001 |
| 2023-12 | 16257 | +0.0093 [+0.0066, +0.0123] | +0.0097 | 43.2% / 45.1% / 43.8% | −0.05 | 0.61 | 0.0007 |
| 2024-01 | 11908 | +0.0094 [+0.0062, +0.0124] | +0.0085 | 43.4% / 44.7% / 43.9% | +0.05 | 0.66 | 0.0004 |
| 2024-02 | 13426 | +0.0088 [+0.0053, +0.0120] | +0.0084 | 43.9% / 45.9% / 44.0% | 0.00 | 0.73 | 0.0009 |
| 2024-03 | 18241 | +0.0102 [+0.0075, +0.0130] | +0.0100 | 43.1% / 45.0% / 44.0% | −0.03 | 0.68 | 0.0008 |
| 2024-04 | 9094 | +0.0187 [+0.0116, +0.0265] | +0.0179 | 42.6% / 45.6% / 44.0% | −0.11 | 0.56 | 0.0021 |

The gap by stat and month (2023-24, tools/props.js):

| Month | Points | Rebounds | Assists | Threes | Steals | Blocks |
| --- | --- | --- | --- | --- | --- | --- |
| 2023-10 | +0.0275 | +0.0145 | +0.0167 | +0.0160 | −0.0060 | −0.0007 |
| 2023-11 | +0.0144 | +0.0043 | +0.0121 | +0.0021 | +0.0023 | +0.0012 |
| 2023-12 | +0.0183 | +0.0184 | +0.0179 | +0.0034 | +0.0032 | −0.0011 |
| 2024-01 | +0.0185 | +0.0170 | +0.0158 | +0.0025 | +0.0007 | +0.0049 |
| 2024-02 | +0.0182 | +0.0121 | +0.0115 | +0.0069 | +0.0041 | +0.0019 |
| 2024-03 | +0.0249 | +0.0107 | +0.0229 | +0.0081 | +0.0010 | +0.0008 |
| 2024-04 | +0.0440 | +0.0225 | +0.0397 | +0.0040 | +0.0097 | +0.0023 |

### I. The gap by stat (tools/props.js; 90% intervals resampling games)

| Stat | Trial | Archive | 2023-24 |
| --- | --- | --- | --- |
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

Candidate A by stat, 2023-24: Points +0.0206 [+0.0175, +0.0237]; Rebounds +0.0132 [+0.0105, +0.0160]; Assists +0.0193 [+0.0152, +0.0232]; Threes +0.0054 [+0.0033, +0.0075]; Steals +0.0028 [+0.0011, +0.0045]; Blocks +0.0017 [−0.0002, +0.0035].

### J. Where minutes are least known: the gap by kind of line (tools/props.js)

| Lines | Trial: lines, gap [90%] | Trial: minutes said / played | 2023-24: lines, gap [90%] | 2023-24: minutes said / played |
| --- | --- | --- | --- | --- |
| his first game of the season | 1653, +0.0436 [+0.0284, +0.0585] | 28.48 / 27.31 | 1353, −0.0017 [−0.0206, +0.0159] | 27.77 / 27.19 |
| a new club (another club last season) | 2389, +0.0282 [+0.0129, +0.0435] | 27.42 / 26.94 | 4339, +0.0227 [+0.0156, +0.0307] | 24.64 / 25.18 |
| back after missing 3+ of his club's games | – | – | 1076, +0.0060 [−0.0091, +0.0226] | 27.47 / 25.76 |
| started | 9482, +0.0151 [+0.0101, +0.0205] | 30.28 / 30.50 | 61198, +0.0111 [+0.0095, +0.0126] | 30.79 / 31.17 |
| off the bench | 2816, +0.0297 [+0.0154, +0.0441] | 23.71 / 21.99 | 27834, +0.0070 [+0.0049, +0.0091] | 22.06 / 21.19 |
| projected under 20 minutes | 834, +0.0240 [−0.0065, +0.0539] | 17.66 / 20.78 | 12710, +0.0308 [+0.0249, +0.0366] | 17.00 / 19.00 |
| projected 20 to 30 | 5743, +0.0215 [+0.0134, +0.0293] | 25.94 / 25.87 | 37086, +0.0092 [+0.0074, +0.0110] | 25.52 / 25.71 |
| projected 30 to 34 | 3649, +0.0147 [+0.0059, +0.0232] | 31.91 / 31.53 | 20144, +0.0032 [+0.0014, +0.0052] | 32.01 / 31.60 |
| projected 34+ | 2072, +0.0143 [+0.0018, +0.0270] | 35.55 / 33.85 | 19092, +0.0040 [+0.0022, +0.0060] | 36.20 / 34.88 |
| a late scratch or an uncalled teammate on his side | 4684, +0.0271 [+0.0190, +0.0356] | 28.58 / 27.98 | – | – |
| neither | 7614, +0.0131 [+0.0071, +0.0192] | 28.89 / 28.90 | – | – |

(The trial's "new club" is a player whose last appearance of 2025-26 was for another club, in the trial's first two weeks; 2023-24's is his first 10 games for a new club.)

### K. What the model adds beyond DraftKings' price: the share w of its disagreement worth keeping (fitted on the lines; 0 is nothing)

| Stat | Trial: w [90%] | Archive: w [90%] | 2023-24: w [90%] |
| --- | --- | --- | --- |
| All, pooled | 0.10 [0.00, +0.20] | 0.09 [−0.06, +0.26] | 0.18 [+0.15, +0.22] |
| The six base stats, pooled | 0.15 [+0.05, +0.25] | – | 0.18 [+0.15, +0.22] |
| Points | 0.15 [−0.02, +0.32] | −0.10 [−0.29, +0.12] | 0.02 [−0.03, +0.08] |
| Rebounds | 0.19 [−0.02, +0.38] | 0.27 [+0.03, +0.52] | 0.15 [+0.09, +0.22] |
| Assists | 0.07 [−0.13, +0.29] | 0.23 [−0.03, +0.50] | 0.11 [+0.05, +0.19] |
| Threes | 0.23 [−0.04, +0.49] | 0.10 [−0.30, +0.47] | 0.28 [+0.20, +0.37] |
| Steals | 0.29 [−0.30, +0.89] | 0.59 [+0.08, +1.14] | 0.37 [+0.29, +0.46] |
| Blocks | −0.01 [−0.61, +0.55] | 0.54 [+0.05, +0.97] | 0.43 [+0.33, +0.53] |
| Pts+reb+ast | 0.02 [−0.12, +0.16] | −0.01 [−0.22, +0.23] | – |
| Pts+reb | 0.17 [+0.01, +0.33] | 0.00 [−0.22, +0.23] | – |
| Pts+ast | −0.02 [−0.18, +0.15] | −0.02 [−0.23, +0.24] | – |
| Ast+reb | 0.06 [−0.14, +0.26] | 0.18 [−0.07, +0.44] | – |
| Stl+blk | −0.88 [−1.75, −0.17] | 0.42 [−0.23, +1.09] | – |

Candidate A, pooled: archive 0.11 [−0.05, +0.29], 2023-24 0.18 [+0.14, +0.22]. With a free intercept and a free weight on DraftKings' own chance, the trial's pooled w is 0.07 [−0.02, +0.17], the archive's 0.10 [−0.05, +0.26], 2023-24's 0.19 [+0.15, +0.23]. Keeping that share, in sample, gains 0.0002 log loss on the trial, 0.0002 on the archive and 0.0006 on 2023-24.
