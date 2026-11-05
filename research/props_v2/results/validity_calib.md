# The validity check's thresholds (validity_calib.js)

Generated 2026-11-05T21:34Z by `node research/props_v2/validity_calib.js`, from `results/validity_calib.json`. The 2026 play-in and playoff archive (6418 graded base-stat lines, 83 games) and the box scores of 2023-24 and 2025-26; no provider-40 line, no candidate, nothing of 2026-27. z = 2.45 (a VOID on a genuine set at most 5% of the time across 7 one-sided checks); a test of 500 games.

## V3: DraftKings' gain over the naive, less the yardstick's

| Stat | Archive: DraftKings' gain | Yardstick | Figure | Its sd (games) | Slack, worked | Slack, registered | Yardstick, 2023-24 regular season less the archive | 2025-26 | First version's room (0.02 less the 2023-24 shift) |
|---|---|---|---|---|---|---|---|---|---|
| Points | +0.0666 | +0.0383 | +0.0283 | 0.0080 | 0.0212 | 0.025 | −0.0068 | −0.0057 | +0.0268 |
| Rebounds | +0.0213 | +0.0095 | +0.0118 | 0.0056 | 0.0148 | 0.015 | +0.0151 | +0.0156 | +0.0049 |
| Assists | +0.0374 | +0.0312 | +0.0062 | 0.0066 | 0.0175 | 0.020 | +0.0021 | +0.0006 | +0.0179 |
| Threes | +0.0269 | +0.0194 | +0.0074 | 0.0052 | 0.0138 | 0.015 | +0.0072 | +0.0050 | +0.0128 |
| Steals | +0.0115 | +0.0125 | −0.0010 | 0.0039 | 0.0103 | 0.015 | +0.0254 | +0.0260 | −0.0054 |
| Blocks | +0.0155 | +0.0165 | −0.0011 | 0.0041 | 0.0108 | 0.015 | +0.0169 | +0.0199 | +0.0031 |

## V2: early exits

- The archive, players projected 24+ who played their side's previous game: 6 early exits (30 lines), figure −0.0077; with every player projected 24+, 8 exits, −0.0158. Its spread when the exits are chance alone: sd 0.0149 at 6 exits, 0.0059 at 40 (a bootstrap of games gives 0.0086 at 6, too few to trust).
- Expected in 2023-24: 86 early exits read (the regular season's 95 of players who played their side's previous game, at provider 40's 91% of games); the fewest a test decides on, about half: 40. Floor, worked −0.0469, registered −0.05.
- Who leaves early: in the 2023-24 regular season 115 of 12808 player-games projected 24+ (0.9%); among those who missed their side's previous game 20 of 714 (2.8%), the rest 0.8%. 2025-26: 130 of 12755, 2.4% and 0.9%. The archive: 8 of 874, 2 of its 51 who had missed.
- The exits V2 reads whose night was over by a share of the game (minutes played under that share of minutes projected): 0.05: 2023-24 2.2%, the archive 16.7%; 0.1: 2023-24 6.6%, the archive 16.7%; 0.25: 2023-24 42.9%, the archive 50%; 0.5: 2023-24 100%, the archive 100%; 0.75: 2023-24 100%, the archive 100%.

## Planted in-game prices: every archive line read at a share tau of its game

| tau | DraftKings' gain moves (by stat: points, rebounds, assists, threes, steals, blocks) | V2 moves | DraftKings' log loss moves (six stats) | Share of games at tau V3 flags | V2 flags | that moves DraftKings by the bar's 0.002 |
|---|---|---|---|---|---|---|
| 0.05 | 0.023, 0.020, 0.020, 0.022, 0.025, 0.024 | −0.078 | −0.022 | 59.1% | 54.5% | 9% |
| 0.1 | 0.046, 0.039, 0.040, 0.044, 0.051, 0.049 | −0.083 | −0.044 | 29.5% | 50.8% | 4.5% |
| 0.25 | 0.121, 0.105, 0.107, 0.118, 0.131, 0.127 | −0.228 | −0.117 | 11.4% | 18.6% | 1.7% |
| 0.5 | 0.258, 0.231, 0.240, 0.257, 0.276, 0.268 | −0.368 | −0.253 | 5.4% | 11.5% | 0.8% |
| 0.75 | 0.439, 0.426, 0.427, 0.437, 0.455, 0.441 | −0.361 | −0.436 | 3.3% | 11.7% | 0.5% |

At tau = 0 every planted price is DraftKings' own (largest difference 2.6e-15). A share is where the expected figure crosses its limit, the reference taken as the test's expectation. V2's moves rest on the archive's 6 early exits: from tau = 0.25 on they are like a regular season's (the share of exits already over above), but at 0.05 and 0.1 one of the six was over and moves them, where a regular season's exits are over by then 2.2% and 6.6% of the time, so V2 sees almost nothing that early. The planted prices are a model: a points total thinned point by point is more telling early than baskets of two and three, so the moves at small tau are if anything high for points.
