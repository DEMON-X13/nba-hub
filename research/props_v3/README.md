# props_v3: why the props model failed, and whether a more reliable one can be built

Research only, 11 to 13 November 2026. The owner asked on 11 November: "i also want to figure out why the model failed
and if we can build a more reliable one." Nothing here goes on the page, into the job or into `tools/`. Every file is in
`research/props_v3/`, and its downloads sit in gitignored `cache/` folders.

## The short answer

- **Why the model failed.** `tools/props.js` was far too sure of itself.
  - Its calibration slope on the trial was 0.27, where DraftKings' was 1.01. When it gave a bet 70% or more, the bet won
    51.5% of the time.
  - Nine-tenths of its loss came from the third of the bets where it and DraftKings were 10 points or more apart. On
    those, the result landed at DraftKings' number.
  - What DraftKings knew better was mostly playing time, 59% to 70% of it. Only about an eighth of that was late injury
    news. The early-season lean toward Overs was real but small, 2% to 3% of the loss.
  - Toning the model down closes much of the gap, not all of it. DraftKings' price already holds nearly everything the
    model knows.
- **What was tried.** One new candidate, MA. MA starts from DraftKings' own fair chance for each line. It then nudges a
  line only where the hub's box scores give the player a different mix of stats at DraftKings' own level for him.
  - Before MA was chosen, a first run of this research (lost to a restart) sized two other designs on development data
    and set them aside: one built on minutes first, and a learned (gradient-boosting) model blended toward DraftKings.
    That choice is listed in `PLAN.md` section 6.
  - MA was held to a development bar of nine criteria, D1 to D9, written down before any of its scores. The development
    data were DraftKings' 2023-24 lines, already used once by props_v2.
- **What it showed on development data.**
  - It is calibrated on rebounds, assists, threes, steals and blocks.
  - It is a little better than DraftKings' fair chance, by 0.0018 log loss a line.
  - Its nudge carries information DraftKings' price does not, 13.7 standard errors clear of zero. None of the
    information-free rivals tried reached 3: 66 rivals, plus 24 scaled or regularised versions.
  - The gain is clear on steals, blocks and threes. It is not established on rebounds and assists, and it is nil on
    points.
- **What the test found: no test was run.** MA met D1 to D7 and missed D8.
  - D8 is the sign check on the spent 2026 playoff lines. Its nudge, frozen, did not lower the log loss there:
    +0.000025 a line, where the bar asks for 0 or below.
  - That miss is tiny and well inside its noise. On 40% of other ways of splitting those 83 games it would have come
    out the other side.
  - But the bar was fixed before the score, and a miss stops the plan. D9, the test machinery, was also left
    unfinished.
  - So the one clean test season, DraftKings' 2022-23 lines, was never fetched. It is still unseen and unspent.
- **The recommendation: leave the site as it is.** The site keeps showing DraftKings' fair chance as the prop chance,
  with the old projections for reference. If you want to keep the question open, run MA as a quiet forward shadow on
  2026-27. Do not show MA's chance on the site yet. What each choice would mean:
  - **Stop here.** Nothing on the site changes. The finding stands as a development-data result only: the hub's box
    scores seem to carry a little about a player's mix of stats that DraftKings misses. Whether that holds on a season
    the model has never seen is untested.
  - **A forward shadow of MA (recommended if you want to go on).** Nothing on the site changes. MA is frozen, its bar
    registered first, and its calls logged before each tip-off. It needs about 65,000 graded lines, about 1,160 games,
    to be decided, so a verdict would come well into 2027-28. A PASS would only make MA a candidate for a change of its
    own. MA's player model is fitted on 2021-22, five seasons old by then, so that needs a decision before the freeze.
  - **Show a calibrated model as information only (not recommended now).** The Player props view would show MA's chance
    beside DraftKings', labelled as information. It has not earned that. On the one later season it was checked on,
    the 2026 playoffs, its chance was slightly worse than DraftKings' fair chance: +0.00038 a line, inside the noise.
    And DraftKings' fair chance, which the page already shows, is calibrated too.
  - **Spending 2022-23 on MA** is possible only by a new plan that sets D8 aside openly and is written before any
    2022-23 line is fetched. It is not among the steps this plan allows.

## The figures behind it

Every figure was checked against the result file named beside it. Intervals are 90%, resampling games. Log loss and
Brier are per line, and a minus sign means better than the comparison.

**Why it failed** (`why_it_failed.md`; `results/why_trial.json`, `why_lines_archive.json`, `why_lines_2024.json`,
`why_tables.md`).

| What | Figure |
|---|---|
| The trial | 12,298 graded closing lines on 121 games, 20 October to 4 November 2026 |
| The trial's loss to DraftKings | +0.0184 log loss a line [+0.0136, +0.0233] |
| Model's calibration slope on the trial | 0.27 [0.18, 0.37] |
| DraftKings' calibration slope on the trial | 1.01 [0.86, 1.17] |
| Slope on the trial's five combo stats | 0.07 |
| Slope on points | 0.15 |
| Steals and blocks | close to calibrated |
| Bets the model put at 70% or more | 324 lines; went in 51.5% |
| The bets where the two were 10 points or more apart | carried nine-tenths of the trial's loss |
| How far the result moved toward DraftKings' number on those | the whole way on the trial; about four-fifths in the 2026 playoffs and 2023-24 |
| Share of DraftKings' edge that came through the minutes played | 59% to 70% |
| Share of that playing-time part that was late news | about an eighth |
| The early Over lean | 2% to 3% of the loss |
| Toned down perfectly, the model still trails by | a fifth of the gap on the trial; half of it in 2023-24 |

props_v2's candidate A predicted box scores better. Against DraftKings' lines it stayed about as over-sure: a slope of
0.68 in 2023-24, where the old model's was 0.66.

**MA on development data**: DraftKings' 2023-24 lines, already scored once against props_v2's A, so development data
(`dev_results.md`; `results/ma_dev_bar.json`, `ma_dev_report.json`, `ma_dev_rivals.json`, `ma_dev_scale.json`). MA was
fitted on earlier months and scored on later ones: 68,850 lines on 863 games, of 88,739 graded lines.

| What | MA | The bar |
|---|---|---|
| D1, the weight on its nudge beyond the information-free family F | b 1.22 [1.07, 1.37], z 13.7 | interval above 0.25 and z at least 4: met |
| D2, log loss of the nudge at its fitted size | −0.00112 [−0.00140, −0.00083] (Brier −0.00052) | wholly below 0: met |
| MA against DraftKings' fair chance | −0.0018 [−0.0022, −0.0014] (0.6651 against 0.6669) | reported |
| MA against `tools/props.js` and props_v2's A | about 0.012 better (0.6651 against 0.6775 and 0.6773) | reported |
| D3, power at 1,100 test games and half the development effect | 0.87 for both T2 criteria at once | met |
| D5, calibration slopes | rebounds 0.90, assists 1.06, threes 0.96, steals 1.08, blocks 1.06, each close to 1; points 0.70 [0.45, 0.95], poorly measured, as DraftKings' own 0.79 is | met |
| D6, rivals | none of 66 information-free rivals meets D1 or D2; 5 of the review's 24 scaled or regularised rivals met D1 as first written, none as strengthened; the highest z of any of them is 2.85 | met |
| D7, leak checks | blindfold and scramble give the same result to the bit; the link to minutes actually played is 0.028 [0.012, 0.044], small but not zero | met |
| Points | weight 0 by the plan's rule (its point estimate was above 0) | |

Run one at a time, the nudge's log loss by stat (× 10⁻⁴) is:

| Stat | Log loss change × 10⁻⁴ |
|---|---|
| Steals | −28.6 |
| Blocks | −14.1 |
| Threes | −8.7 |
| Rebounds | −6.6 |
| Assists | −5.0 |

Corrected for testing five stats together, the intervals for rebounds and assists reach 0 (`results/ma_dev_review.json`).

**D8, the sign check on the spent 2026 play-in and playoffs** (`results/ma_dev_archive.json`, `ma_dev_review.json`).
MA was frozen on all 88,739 development lines and applied to 6,418 graded lines on 83 games.

| What | Figure |
|---|---|
| The weight on the nudge | 0.78 [0.24, 1.32], z 2.40: a positive point, as D8 asks; T1's bar is not cleared |
| Log loss at the frozen size | **+0.000025** [−0.00096, +0.00102]: D8 asks for 0 or below, so **not met** |
| Brier at the frozen size | −0.000010 [−0.00047, +0.00046] |
| On 40 other random 5-fold splits of the 83 games | mean −0.0000062, sd 0.000050, above 0 on 40% of them |
| On 10 folds | −0.000062 |
| One game left out at a time | −0.000013 |
| MA's chance against DraftKings' fair chance | +0.00038 [−0.00075, +0.00155] |
| On development data, for comparison | MA was 0.0018 better than DraftKings' fair chance |

D8 and its split were fixed before any score, so none of this turns the miss into a pass.

**D9, the machinery.**

| Part | State |
|---|---|
| The test's fetch, cleaner, scorer and hash checks | written and held to 26 planted cases in sandbox repositories, all as expected (`results/ma_machinery_check.json`); never run on the feed |
| The scorer's development path | gives back D1 and D2 to the digit (`results/ma_score_devcheck.json`) |
| The forward shadow's runner | not written |
| Tightening V4 against in-game prices | not made (planted in-game prices, `results/ma_plant_ingame.json`: V2 and V4 did not react) |

## How the work went

- **12 November:**
  - The data step: `data.md`. DraftKings' 2023-24 lines were fetched again byte for byte, and their `last_updated`
    column, which gives the result away, was dropped.
  - The diagnosis: `why_it_failed.md`.
  - The plan's sizing on a stand-in forecaster: `plan_sizing/`.
  - `PLAN.md`, then its critique (C1 to C7, all real; section 8).
- **13 November:**
  - The 2020-21 box scores were fetched: 1,362 requests, all HTTP 200, logged.
  - P23 (MA's player model) was fitted on 2021-22, MA's rows were built, and the development bar was run. MA met D1 to
    D7 and missed D8, so the plan stopped.
  - A review of the results raised eleven findings, all real (`PLAN.md` section 9; `dev_results.md` section 9).
  - Three of them were in the test machinery and would have mattered had the test run:
    - the scorer would have left out none of the 31 already-seen 2022-23 games;
    - the fetch's guard against a second fetch lived in the cache;
    - the hash check trusted the working tree.
  - The weight test (T1 and D1) was made scale-free, by adding z ≥ 4.
  - None of it changed the verdict.

## The rules this research kept

- **The 2026-27 season in play** was read only to diagnose the trial (`why_it_failed.md`). It was never used to fit,
  choose or score a candidate.
- **The 2026 play-in and playoff archive is spent.** It was used here for development only, as D8's sign check.
- **DraftKings' 2023-24 provider-40 lines** had been scored once before, against props_v2's A on 6 November 2026, so
  here they are development data.
- **DraftKings' 2022-23 provider-40 lines are the one-shot test.** None was fetched, read or printed.
  - Everything already seen of 2022-23 is listed in `PLAN.md` section 3.3.
  - That includes one availability probe this research made (`probe_dk40_2023.js`; its answer was discarded unread).
  - It also includes the 31 left-out game ids written into `test/seen_2023.json`, and the first rows of
    `data/odds_hist.csv` (2022-23 consensus game lines) that two steps' terminals showed.
  - The replay walked 2022-23's box scores as history, as the rules allow.
- **Every choice made on development data is listed** (`PLAN.md` section 6, `dev_results.md` section 7). That includes
  choosing MA over a minutes-first model and a learned model, and the review's z ≥ 4, chosen after MA's and the rivals'
  figures were seen.

## Read in this order

| File | What it is |
|---|---|
| `why_it_failed.md` | the first half: why `tools/props.js` lost its shadow trial, re-derived with this folder's scripts (tables in `results/why_tables.md`) |
| `data.md` | the data inventory, and DraftKings' 2023-24 lines fetched again |
| `PLAN.md` | MA; its development bar, D1 to D9; the one-shot test on 2022-23 and its bar; the critique (section 8) and the review (section 9) |
| `dev_results.md` | MA held to its development bar, criterion by criterion, with the next steps (section 8) and the review (section 9) |

`NOTES.md`, the running log of each step, is folded into "How the work went" above and removed.

## Folders

| Folder | What |
|---|---|
| top level | the data step (`data_inventory.js`, `lines_clean.js`, `fetch_dk40_logged.sh`, `fetch_check.js`, `espn_depth.js`, `probe_dk40_2023.js`); the diagnosis (`why_lib.js`, `why_trial.js`, `why_lines.js`, `why_tables.js`, `why_rerun_v2.js`); the 2020-21 box-score fetch (`fetch_box2021.js`) |
| `plan_sizing/` | the plan's sizing on a stand-in forecaster, never a candidate (below) |
| `ma/` | MA: `ma_lib.js` (the library and replay), `p23_fit.js`, `ma_rows.js`, `refs.js`, `dev_lib.js`, `dev_bar.js` (D1 to D5), `dev_rivals.js` (D6), `dev_leaks.js` (D7), `dev_archive.js` (D8), `dev_report.js`, `freeze.js`, and the review's `dev_scale.js` and `dev_review.js` |
| `test/` | the one-shot test's machinery, never run on 2022-23: the gated fetch and its public record, the cleaner, every input's hash (`inputs.js`), the left-out games (`seen_2023.json`), the validity checks' copy, the scorer, the planted in-game prices, the machinery check |
| `frozen/` | `ma_frozen.json`: MA as D8 scored it, with every input of the test's scorer hashed, data included |
| `results/` | every committed result: aggregates only, no line, price or player id |

What each sizing script in `plan_sizing/` sized:

| Script | What it sized |
|---|---|
| `rows.js` | the development lines (2023-24 and the archive) as one table, with the stand-in's projection, into `cache/plan_sizing/` |
| `lib.js` | the shared code: the features, the information-free family F, the fits, the cluster-robust error, the cross-fit, T1 and T2 |
| `size.js` | round 1: the bar's criteria with a small information-free family; three rivals met T1 there, so F became the union of every rival's features (`results/plan_sizing.json`) |
| `leakcheck.js` | whether the stat-mix nudge's strength is an artefact of in-game prices (`results/plan_leakcheck.json`) |
| `size2.js` | round 2: the bar as `PLAN.md` writes it, on F, against every rival and the shuffles (`results/plan_sizing2.json`) |
| `boot_check.js` | the cluster-robust interval on T1's b against the game-clustered bootstrap the test uses (`results/plan_bootcheck.json`) |
| `power_rev.js` | the test's and the shadow's power by lines a game as well as games, for critiques C1 and C2 (`results/plan_power_rev.json`) |
| `tables.js` | the sizing tables, drawn from those results (`results/plan_tables.md`) |

## Re-running

Run from the repository's root, with `tools/node_modules` in place (`cp -r` from a checkout with `npm ci` done in
`tools/`). Everything is Node; no Python was used, so there is no requirements file. Every random draw is seeded and no
result depends on the clock. Timing fields in the result files are the only part that changes between runs.
Downloads go only to the gitignored `research/props_v3/cache/` and `research/props_v2/cache/`, both covered by their
folder's `.gitignore` (`cache/`).

| Step | Command | Time |
|---|---|---|
| 1. DraftKings' 2023-24 lines (props_v2's recipe, logged; refuses any range touching 2022-23) | `bash research/props_v3/fetch_dk40_logged.sh 2023-10-24 2024-04-30` | about 11 minutes |
| 2. Count the fetch, check the window, clean the lines | `node research/props_v3/fetch_check.js`, `node research/props_v3/fetch_check.js --write-window`, `node research/props_v3/lines_clean.js` | seconds |
| 3. Data inventory and ESPN depth (`data.md`) | `node research/props_v3/data_inventory.js`, `node research/props_v3/espn_depth.js` | about 2 minutes |
| 4. The diagnosis (`why_it_failed.md`) | `node research/props_v3/why_trial.js`, `node research/props_v3/why_lines.js archive 2024`, `node research/props_v3/why_tables.js`, `node research/props_v3/why_rerun_v2.js` | about 5 minutes |
| 5. The plan's sizing (`PLAN.md`) | `node research/props_v3/plan_sizing/rows.js`, then `size.js`, `leakcheck.js`, `size2.js`, `boot_check.js`, `power_rev.js`, `tables.js` in that folder | about 30 minutes in all |
| 6. MA's inputs | `node research/props_v3/fetch_box2021.js` (1,362 ESPN requests), `node research/props_v3/ma/p23_fit.js`, `node research/props_v3/ma/ma_rows.js`, `node research/props_v3/ma/refs.js` | about 18 minutes |
| 7. The development bar | `node research/props_v3/ma/dev_bar.js` (D1 to D5), `dev_rivals.js` (D6), `dev_leaks.js` (D7), `dev_archive.js` (D8), `dev_report.js`, all in `ma/` | about 25 minutes |
| 8. The review's checks | `node research/props_v3/ma/dev_scale.js`, `node research/props_v3/ma/dev_review.js`, `node research/props_v3/test/machinery_check.js` | about 20 minutes |
| 9. The machinery on development data | `node research/props_v3/test/plant_ingame.js`, `node research/props_v3/test/validity_ma.js --reproduce`, `node research/props_v3/test/score.js --dev-check` | about 18 minutes |
| 10. The freeze | `node research/props_v3/ma/freeze.js` | about a minute |

Each document's own table gives each command's outputs and the files it needs. Checked on 13 November 2026, on the
caches above:
- `why_tables.js`, `plan_sizing/tables.js` and `ma/dev_archive.js` rewrote their results byte for byte.
- `ma/dev_review.js` differed only in its `seconds` field.
- `test/machinery_check.js` gave 26 of 26 cases as expected.

The longer steps were last run by the steps that committed their results, and their reruns are recorded in
`dev_results.md` and `PLAN.md` section 9.

Never run `test/fetch_dk40_2023_logged.sh` outside the test step. It fetches the one-shot test's lines, and its gate
refuses to run without an audited preregistration pushed to origin.

## Open

- **The next step is the owner's call:** stop, a forward shadow, or a new candidate with 2022-23 kept unspent
  (`dev_results.md` section 8).
- **A forward shadow would need, before its freeze:**
  - its own registered bar;
  - a decision on P23's 2021-22 constants;
  - the shadow runner, which is not written;
  - V4's tightening against in-game prices.
- **The hub's devig rule can be asked about apart from all of these.** That rule puts the whole margin on the Over. MA's
  information-free part E alone was 0.0003 a line better on 2023-24, −0.00032 [−0.00065, −0.000005], and level on
  Brier. It did not carry to the playoff archive, and it may run the other way on 2022-23.
- **None of this is on `main`.** The work lives on `wip/props-v3`.
