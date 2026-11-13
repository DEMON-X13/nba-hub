# props_v3: why the props model failed, and whether a more reliable one can be built

Research only, 11 to 13 November 2026. Nothing here goes on the page, into the job or into `tools/`; every file is in
`research/props_v3/`, and its downloads are in the gitignored `cache/` folders. The owner asked (11 November): "i also
want to figure out why the model failed and if we can build a more reliable one."

## The short answer

- **Why it failed** (`why_it_failed.md`): the props model was far too sure of itself (a calibration slope of about 0.27
  where DraftKings' was about 1), nearly all of its loss sat on the bets where it disagreed most with DraftKings, and the
  result landed at DraftKings' number. What DraftKings knew better was mostly playing time, and only about an eighth of
  that was late news. Toning the model down closes much of the gap, not all of it, because DraftKings' price already
  holds nearly everything the model knows.
- **A more reliable one** (`PLAN.md`, `dev_results.md`): MA starts from DraftKings' own fair chance and nudges a line
  only where the hub's box scores give a player a different stat mix at DraftKings' own level for him. On development
  data (DraftKings' 2023-24 lines, fitted on earlier months and scored on later ones) it is calibrated on rebounds,
  assists, threes, steals and blocks (poorly measured on points, as DraftKings' own chance is), a little better than
  DraftKings' fair chance (0.0018 log loss a line), and its nudge adds information beyond DraftKings' price: its weight
  stands 13.7 standard errors clear of zero, where none of the 88 information-free rivals tried reaches 3, at any size
  (a review of 13 November found the bar's first weight test could be met by a rival merely shrunk, and added this
  one). The gain is
  clear on steals, blocks and threes, not established on rebounds and assists, nil on points. **But it did not meet its
  development bar as written:** frozen and applied to the spent 2026 playoff lines, the weight on its nudge was positive
  but the nudge did not pay at its frozen size (+0.000025 log loss a line [−0.00096, +0.00102], where the bar asks for 0
  or below), a sign so close to zero that how the archive's 83 games were split for the bar's reference decides it (on
  40% of other random splits it comes out above 0). The bar was not moved, so the one clean test, DraftKings' 2022-23
  lines, was not spent: they are still unfetched and unseen. The site keeps DraftKings' own chance, and what comes next
  is the owner's call (`dev_results.md` section 8).

## Read in this order

| File | What it is |
|---|---|
| `why_it_failed.md` | the first half: why `tools/props.js` lost its shadow trial, re-derived with this folder's scripts (tables in `results/why_tables.md`) |
| `data.md` | the data inventory, and DraftKings' 2023-24 lines fetched again (without the column that gives the result away) |
| `PLAN.md` | the candidate MA, its development bar (D1 to D9), the one-shot test on 2022-23 and its bar, the critique of 12 November with what it changed (section 8), and the review of 13 November with what it changed (section 9) |
| `dev_results.md` | MA built and held to its development bar, criterion by criterion: met D1 to D7, missed D8, D9 left part built; the review's findings, all real, and what they changed (section 9) |
| `NOTES.md` | where each step stood, as it went |

## The rules this research kept

- The 2026-27 season in play was read only for the diagnosis of the trial (`why_it_failed.md`), never to fit, choose or
  score a candidate.
- The 2026 play-in and playoff archive is spent: development only, here a sign check (D8).
- DraftKings' 2023-24 provider-40 lines had been scored once before (props_v2's A, 6 November 2026), so here they are
  development data, said.
- DraftKings' 2022-23 provider-40 lines are the one-shot test. None was fetched, read or printed; what had been seen of
  them before is listed in `PLAN.md` section 3.3, including one availability probe this research made
  (`probe_dk40_2023.js`, its body discarded unread). The replay walked 2022-23's box scores as history, as the rules
  allow. The review's fix step wrote the 31 left-out games' ids into `test/seen_2023.json` and showed the first two rows
  of `data/odds_hist.csv` (2022-23 game lines), both listed in `PLAN.md` 3.3.

## Folders

| Folder | What |
|---|---|
| top level | the data step (`data_inventory.js`, `lines_clean.js`, `fetch_dk40_logged.sh`, `fetch_check.js`, `espn_depth.js`, `probe_dk40_2023.js`), the diagnosis (`why_*.js`), the 2020-21 box-score fetch (`fetch_box2021.js`) |
| `plan_sizing/` | the plan's sizing checks on a stand-in forecaster (never a candidate) |
| `ma/` | MA: its library, P23's fit, its rows, the development bar, the rivals, the leak checks, the archive's sign check, the reports, the freeze, and the review's checks (`dev_scale.js`, `dev_review.js`) |
| `test/` | the one-shot test's machinery, written and checked on development data and (since the review) on planted cases in sandbox repositories, never run on 2022-23: the gated fetch and its public record, the cleaner, every input's hash, the left-out games, the validity checks' copy, the scorer, the planted in-game prices |
| `frozen/` | `ma_frozen.json`, MA as D8 scored it, every input of the test's scorer hashed, data too |
| `results/` | every committed result: aggregates only, no line, price or player id |

Each document ends with a table of the commands that rebuild its figures, from the repository's root.
