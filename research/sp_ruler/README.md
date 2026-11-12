# One ruler for Suggested Parlays: the evidence

Why a Suggested Parlays set should rank and state every leg at DraftKings' fair chance (`legFair`), and not at the team
model's chance it ranks a team leg at today. Read only: nothing here is fitted, tuned or chosen, and nothing on the site
reads these files.

```
node research/sp_ruler/evidence.js --extract   # once, in a full clone: lines.json's git history -> dk_game_lines_2027.csv
node research/sp_ruler/evidence.js             # the committed files -> results/evidence.json, and the summary below
```

The second command reads only committed files (`research/backtest_games.csv`, `data/odds_hist.csv`, `data/games.csv`,
`data/predictions.csv`, `research/sp_ruler/dk_game_lines_2027.csv`, `data/props_2026.csv`, `data/props_2027.csv`,
`data/box_2026.csv`, `data/box_2027.csv`, `data/props_shadow_lines.csv`) and gives the same `results/evidence.json` byte
for byte on every run: every interval is a 90% bootstrap over games (a game's rows resampled together), 10,000
resamples, seeded; there is no clock in the output. A difference is the first chance's log loss (or Brier score) less the
second's, so a negative difference favours the first. Seasons are named as the NBA names them (2023-24 is the files'
2024).

## Evidence

### Which chance a set's team legs are ranked at today

`spPool` (`app/parts/suggested.html`) takes its team legs from `pbPriced` and `pbTotals` (`app/parts/parlay.html`),
whose chance is `pbView`'s `p`, `legModel(l)` in `app/nba_hub.html`:

- **a moneyline**: `g.model.pHome` (the away side `1 - pHome`), the player model's win chance, the number Tonight shows,
  **raw: never pulled toward the market**;
- **a spread**: `Phi((m + h) / SIGMA)`, `m` the side's expected margin from the player model's spread (minus
  `g.model.spread` for the home side), `h` the side's line, `SIGMA` 14.5 points, again never pulled toward the market;
- **a total**: the market's own chance, its two prices with the margin out in proportion. That is the same number as
  `legFair` gives, so a total is already on the one ruler; the model's own total is scored below as an aside only.

`spPool` keeps a team side whose chance is in [45%, 97%) and less than 15 points over `legFair` (the far-off guard), and
marks it Value where that chance is 3 points or more over its price's implied chance. Every number below scores exactly
those chances: `evidence.js` copies `legModel`'s rules, the page's `SIGMA` and `Phi`, and `legFair`'s proportional rule.

### The team model against the market's no-vig chance

**The walk-forward folds** (`research/backtest_games.csv`, `tools/backtest.js`: each season called by the player
model's parameters fitted on the seasons before it alone, against the closing line in `data/odds_hist.csv`). Two lineups
bound what the site sees: "known" (the players who did play: a perfect injury report, the model's best case) and
"naive" (the previous game's). No closing spread or total price is kept, so the market's spread and total chance there
is 50% (-110 a side). Log loss, model less market:

| Season | Moneyline, known | Moneyline, naive | Spread, known | Spread, naive |
|---|---|---|---|---|
| 2023-24 | +0.0297 [+0.0202, +0.0393] | +0.0318 [+0.0217, +0.0419] | +0.0333 [+0.0223, +0.0443] | +0.0334 [+0.0221, +0.0450] |
| 2024-25 | +0.0060 [-0.0008, +0.0131] | +0.0144 [+0.0056, +0.0236] | +0.0155 [+0.0077, +0.0231] | +0.0196 [+0.0100, +0.0290] |
| 2025-26 | +0.0128 [+0.0057, +0.0198] | +0.0266 [+0.0172, +0.0363] | +0.0213 [+0.0136, +0.0292] | +0.0287 [+0.0190, +0.0386] |
| Pooled | **+0.0162 [+0.0116, +0.0208]** (3,952 games: 0.5977 against 0.5815) | +0.0243 [+0.0188, +0.0297] | **+0.0233 [+0.0180, +0.0286]** (3,928) | +0.0272 [+0.0213, +0.0332] |

Brier says the same everywhere (moneyline pooled, known: +0.0067 [+0.0047, +0.0087]; spread +0.0110 [+0.0086,
+0.0135]). The model lost to the market on the moneyline in every season and both lineups, the one interval that
reaches zero being 2024-25 with a perfect injury report; and its cover chance lost to a coin. `SIGMA` was measured on
the 2025-26 fold (`research/sigma.json`), so that season's spread row is not wholly out of sample, and it lost all the
same. The model's own total (`Phi((T - line) / 19.1)`, an aside) lost to 50% too: pooled +0.0278 [+0.0215, +0.0340].

**The season in play** (2026-27, read only: never fitted or tuned on). The model is `data/predictions.csv`, the player
model's pre-tip call frozen at tip; the market is the job's own last read of DraftKings' game lines before each tip
(`dk_game_lines_2027.csv`, extracted from `lines.json`'s history, which begins 26 October 2026: 117 graded games, every
price DraftKings' own, so a spread's market chance is its two prices in proportion), and beside it the line
`data/games.csv` froze at tip (160 games from 20 October, no spread price):

| Market | DraftKings, the job's read (117) | The line frozen at tip (160) |
|---|---|---|
| Moneyline | +0.0221 [+0.0002, +0.0442] (0.5620 against 0.5399) | +0.0291 [+0.0111, +0.0476] |
| Spread | +0.0198 [-0.0037, +0.0438] | +0.0175 [-0.0026, +0.0371] |
| Total (the model's own, an aside) | +0.0170 [-0.0144, +0.0484] | +0.0155 [-0.0117, +0.0430] |

Team Elo, the other column of `data/predictions.csv` (the page ranks no leg on it), did worse on the moneyline: +0.0353
[+0.0070, +0.0644].

**Where the model and the market part** (walk-forward, known lineup, pooled; each game's side the model rates above the
market, by how far):

| The model over the market | Games | The model said | The market said | Won |
|---|---|---|---|---|
| 0-3 points | 1,235 | 48.8% | 47.3% | 45.8% |
| 3-7 points | 1,236 | 45.8% | 40.9% | 43.5% |
| 7-15 points | 1,163 | 46.6% | 36.2% | 36.3% |
| 15 points or more | 318 | 49.6% | 30.7% | 29.9% |

The further the model sits from the market, the more plainly the market is right: where the model saw a 15-point edge
the side won as often as the market said, not as the model said. By band of the model's own (home side's) chance it sits too
close to even: under 50% it said 15.7% where 5.7% won and 42.8% where 37.8% won, at 65-80% it said 71.9% where 74.2% won; the spread's cover
chance is flat whatever the model says (it said 31.8% where 54.2% covered and 68.6% where 46.9% did). The bands are in
`results/evidence.json` (`calibration`, `fromMarket`) for every season.

**On the sides a set takes** (the sides `spPool` keeps, as above): the model's chance still loses to `legFair` on them
(moneyline, known, 4,455 sides: +0.0132 [+0.0087, +0.0177]; spread, 4,988: +0.0096 [+0.0063, +0.0129]; 2026-27 at
DraftKings' read, moneyline 126 sides +0.0116 [-0.0089, +0.0320], spread 165 sides +0.0201 [+0.0050, +0.0359]). The
Value-marked sides, the ones the model rates 3 points or more over their price, did as the market said: on the
walk-forward 784 moneyline Value sides (known lineup) the model said 58.9%, the fair chance 49.5%, they won 51.4% and
returned -0.5% a dollar at the closing price [-6.5%, +5.6%] (naive lineup: 875 sides, won 48.1%, -9.9% [-15.3%,
-4.4%]); 1,926 spread Value sides the model said 59.4%, they covered 49.4% and returned -5.7% [-9.3%, -2.2%] at -110.

**Verdict: `modelBeatsMarket` is false.** On no market does the team model's chance beat DraftKings' (or the closing
line's) no-vig chance on log loss out of sample: every difference is positive, and every interval but one (the
moneyline of 2024-25 with a perfect injury report, which still lost) lies wholly above zero on the walk-forward. Ranking
a set's team legs at the model's chance rates them above what the market and the results say, so they crowd out player
legs a set at the fair chance would take.

### The ruler itself: the proportional devig against a power devig

`legFair` takes a team line's margin out in proportion. A power devig (each side's implied chance raised to the k that
makes the two sum to 1) leaves a heavy favourite more of its chance. Log loss, power less proportional, on the market's
own chance:

| Season | Moneyline |
|---|---|
| 2022-23 (consensus closing line) | +0.0018 [+0.0001, +0.0036] |
| 2023-24 | -0.0005 [-0.0022, +0.0013] |
| 2024-25 | -0.0000 [-0.0020, +0.0020] |
| 2025-26 | -0.0009 [-0.0025, +0.0008] |
| 2026-27, DraftKings' read (the season in play, reported, never chosen on) | -0.0059 [-0.0089, -0.0026] |

On 2026-27 the spread and the total are level (-0.0000 [-0.0002, +0.0002] and -0.0001 [-0.0002, +0.0001]: their prices
sit near -110 a side). Before the season in play the power devig was level with the proportional rule, and worse on
2022-23; it is better only on 2026-27, which is never chosen on. **Keep `legFair` as it is.** (Whether the proportional
rule understates heavy favourites turns on the season: 2025-26's favourites of 80-90% by it won 83.0% where it said 84.6%
and the power devig 87.1%, while 2026-27's won 20 of 20 where it said 83.8% and the power devig 86.0%.)

### The ruler on player legs: DraftKings' main lines against `legFair`'s fair chance

A sanity check, never a refit. `legFair` puts a main line's whole margin on the Over (fair Over = 1 - the Under's implied
chance), so it rates an Under at exactly its own price's implied chance and an Over below its price's. Every graded main
line DraftKings closed at (`data/props_<season>.csv`, graded from the box scores; a player who did not play is void; the
props ledger's own graded subset, `data/props_shadow_lines.csv`, agrees: 12,298 lines, fair Over 46.1%, Overs hit
47.5%):

| Lines | Side | Lines graded | Fair chance | Hit | Returned on $1 |
|---|---|---|---|---|---|
| 2026-27 regular season (160 games) | Unders | 16,439 | 53.9% | 53.1% | -1.65% [-3.71%, +0.47%] |
| | Overs | 16,439 | 46.1% | 46.9% | -11.26% [-13.42%, -9.17%] |
| | Unders in the set's band (45-97%) | 15,640 | 54.6% | 53.8% | -1.51% [-3.73%, +0.58%] |
| | Overs in the band | 10,829 | 48.9% | 49.9% | -10.40% [-12.71%, -8.10%] |
| 2026 play-in and playoffs (83 games) | Unders | 11,395 | 54.4% | 54.1% | -0.67% [-3.35%, +1.94%] |
| | Overs | 11,395 | 45.6% | 45.9% | -12.49% [-15.01%, -9.93%] |

So under one ruler a set at the default filters will lean on Unders, because DraftKings' prices put its margin on the
Over: this season Unders hit a little less often than their fair chance and lost about 1.7% a dollar, and Overs lost
about 11%. **An Under does not break even**; it is the side DraftKings charges least for. Team sides at DraftKings'
prices in the job's 2026-27 reads (both sides of every moneyline, spread and total, 702 sides on 117 games) were
expected to return -4.4% a dollar at `legFair`'s fair chance and returned -7.4% (moneylines -13.0%, their favourites
having won more often than the price said; spreads -4.5%, totals -4.6%; with both sides of every game in the sample their
intervals measure little but the margin). Every leg returns at most about $1 on $1 at its fair chance, so a parlay paying
$F lands at most about 1/F: that is what the one ruler states, honestly.

### Where these numbers differ from the lost attempt's

The lost attempt's figures (its scripts are gone) were leads; this script reproduces most of them:

- the walk-forward moneyline, pooled, known lineup: the same, +0.0162 [+0.0116, +0.0208] (the lead's upper end +0.0207,
  another seed);
- 2026-27 moneyline: +0.0290 [+0.0109, +0.0479] in the lead matches this script's line frozen at tip, +0.0291 [+0.0111,
  +0.0476]; on DraftKings' own reads, from 26 October only, it is +0.0221 [+0.0002, +0.0442], a smaller sample;
- the 15-point gap: the same (model 49.6%, market 30.7%, won 29.9%);
- the devig: the same reading (level on 2023-26, better only on 2026-27);
- player lines: Unders -1.65% where the lead said about -2.0%, Overs -11.3% where it said about -10.9% (the lead's
  grading and voids are unknown; this script voids a player with no minutes in the box score, 634 of 17,073 lines);
- team legs: the lead's "about -4.5%" is close to their expected return at the fair chance, -4.4% (spreads and totals -4.5%);
  what they actually returned was -7.4%, the moneylines' -13.0% pulling it down.
