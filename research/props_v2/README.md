# A second props model: the study

Research only, 5 November 2026. Nothing here goes on the page, into the job or into `tools/props.js`; every file is in
`research/props_v2/`.

**The short answer.** Three candidates were built and each was scored once against DraftKings' closing lines. None
beats DraftKings:
- **A** fixes the model's own parts. Its log score beats `tools/props.js`'s on every box-score fold (its playoff mean
  absolute error is a little worse), but it still trails DraftKings, closing only about a seventh of the current model's
  gap.
- **B** blends toward DraftKings. Fitted honestly, it becomes DraftKings' own chance and has almost nothing to bet.
- **C** picks the lines to trust. Its rules pick lines where DraftKings wins by more.

No candidate is worth a new shadow trial now. One cheap test on data that already exists could answer the question
before anyone waits on a live trial, though less firmly than a blind test (its season is not blind); it is the owner's
call, below.

## The question

The props model (`tools/props.js`) was on a pre-registered shadow trial against DraftKings' closing lines. At 12,298
graded lines from 121 games it was behind:
- log loss +0.0184 [+0.0136, +0.0233];
- Brier +0.0083 [+0.0060, +0.0105];
- flat bets at a 3-point edge: 6,027 bets, −222.8 units (Overs 2,796 bets, −226.5; Unders 3,231 bets, +3.7).

The trial is being ended as a fail (a separate change). The owner asked to pivot: find out, the careful way, whether a
second model can do better. The deliverable is a study and, at most, one candidate with a bar for a new shadow trial on
games after it is frozen.

## The rules kept

1. **Nothing was fitted, chosen or tuned on 2026-27, and no candidate was scored on its lines** (`data/box_2027.csv`,
   `data/props_2027.csv`, the shadow ledger).
   - What reads 2026-27:
     - `diag_trial.js` reads the trial's calls, its graded lines, `data/props_2027.csv` and every box file, to say
       where the frozen model lost.
     - `data_describe.js` reads `data/props_2027.csv` for counts only (rows, games, rows a game, each stat's share).
     - `espn_shape.js` and `espn_validate40.js`, which query ESPN, parse every box file, 2026-27's included, and look up
       only the 2022-23 to 2025-26 games they probe. `espn_probe.sh` asked ESPN about three games of 2026-27 (the
       answer's status and item count only).
     - `cut2026_check.js` parses every box file the old way, once, to show the new loader returns the same.
     - `data/games.csv` is one file for every season. Every script reads it whole and drops its 2026-27 rows (the
       schedule and the finals so far) before anything else uses it.
   - Every other script that reads box scores (the candidates', `diag_history.js`, `data_describe.js`, `validity.js`)
     loads through `cut2026.js`. It opens only the box files of seasons up to 2026, never `box_2027.csv` or
     `teambox_2027.jsonl`, and its guard throws if one of those files holds a row of a later game.
   - That loader is a fix. Until then the scripts parsed every box file whole, 2026-27's included, and cut them to the
     games kept afterwards; the guard ran after that cut, so it could never fire. No 2026-27 value was used either way:
     - `cut2026_check.js` (`results/cut2026_check.json`) shows the new loader returns what the old way did, to the byte;
       that no 2027 file is opened; and that the guard fires on a planted row where the old one did not.
     - Every script on it was re-run and reproduced its results (below, "Re-running").
   - **What the trial's lines did inform.**
     - `diag_trial.js` first ran at 17:10-17:11 UTC (its first outputs' stamps), before B's rule was written at 17:42.
       It scored two candidate-like versions on the trial's lines, as yardsticks (`diag_trial.md` table 15):
       - the model's chance averaged half and half with DraftKings' fair chance (in probability, not B's logit):
         +0.0031 log loss against DraftKings;
       - the spread scaled to the 2026 walk-forward's own ratio: +0.0202.
     - B's form, a share of the way from DraftKings to the model, was written after the first of these was seen.
     - A's list of changes to try came partly from the trial's findings: `debut` (the uncalled rookies and deep bench),
       `kappa` (who takes a side's spare minutes) and `vm` (the bench's wider spread) each answer one.
     - Every constant, every keep-or-drop and every rule was fitted or chosen on 2026 and earlier.
2. **Nothing outside `research/props_v2/` was changed.** `tools/props.js` is required for its exported functions and
   never changed. `research/props.json`, `state.json` and `data/*` are untouched.
3. **No paid data, no account, no third-party data committed.** The search for more historical lines read ESPN's
   free feed in memory and saved game ids, counts and DraftKings' aggregate scores only; no price is in this folder. The
   fetch recipe writes only to a gitignored `cache/`, and has not been run on the real feed.
4. **Each candidate's rule was written down before it was scored, then scored once.** That is the study's own account;
   for B, C and A's prose the repository cannot show the order:

   | Candidate | Rule written (as stated) | One scoring run | What a reader can check |
   |---|---|---|---|
   | B (blend) | 17:42 UTC, in `cand_blend.md` | 17:47 | nothing: the rule and its results share `cand_blend.md`, last saved at 17:50 |
   | C (selection) | 18:03 UTC, in `cand_select.md` | 18:09-18:12 | nothing: the rules and their results share `cand_select.md`, last saved at 18:13 |
   | A (fix the parts) | frozen 18:41 UTC, `results/cand_fix_rule.json` | 18:43-18:55 | the machine-written rule only |

   - All 46 of the study's files arrived in one commit (19:12 UTC), and git keeps no file times.
   - A's rule file is written by `cand_fix.js --select` at the end of its run, and carries its own `"frozen":
     "2026-11-05T18:41Z"`. The scoring run reads that file, and its log begins at 18:42:58 (`results/cand_fix_score.log`).
     That order can be checked from what the scripts write.
   - A's prose (`cand_fix.md`, its rule section with its results) was last saved at 18:57.
   - B's and C's stated times are the writer's word, and the files were last saved after their scoring runs (17:50 after
     17:47, 18:13 after 18:12), because the results were written into the same files.

   Each run was preceded by a check that reproduced the published numbers to the digit and printed no candidate score:
   - the archive's 11,395 lines at log loss 0.6934 against 0.6788;
   - the model's flat bets;
   - `research/props.json`'s 2025 and 2026 folds.

   Each scoring script was run once more, from 18:59 UTC, to confirm its numbers reproduce. They do, every number in
   every result file; only the files' "generated" stamps moved, and the first runs' files are the ones kept here. After
   the review the scripts were run again on `cut2026.js`, and A's scoring once more to add its units' intervals
   ("Re-running", below).

**Three cautions about what "unseen" means here.**
- A's list of changes to try came from diagnoses that had read the trial's lines and the archive (rule 1 above). No
  constant came from either, but the archive is not a blind test of them.
- C's rules were written from the box-score history (`results/cand_select_explore.md`, `diag_history.md`). The writer had
  read the trial's diagnosis and the archive's published results. The history's check span, the 2025 and 2026 folds, also
  holds the 2026 play-in and playoff box scores, which are the archive's own games' outcomes; its playoff rows (for
  example "playoffs, model above the naive: share 0.41 / 0.29") include them. So the four rules `cand_select.md`
  marked "unseen" (now "prices unseen") are unseen only in the archive's prices. That could only flatter C, and C
  failed anyway.
- DraftKings' fair-chance rule (the whole margin on the Over) was itself chosen on this archive, which favours the market
  a little in every comparison here.

## The diagnosis

### Why the trial lost (`diag_trial.md`)

The analysis rebuilt every graded line from the frozen calls and the fit, and agreed with the ledger on every line. It
also reproduces each call's mean to a median of 0.12%, so the breakdown is of the call itself. Three causes, in order of
size.

**1. Overconfidence: the model treats its own mean as if it were known.** This is the largest cause by far.
- Its chances sit 9.0 points from 50% on average; DraftKings' sit 5.2 (archive: 9.5 against 6.2).
- When it said the Over under 30% (mean 25%), the Over hit 44.6%. When it said 70% or more (mean 74%), the Over hit
  51.5%.
- The 31% of lines where it and DraftKings differ by 10 points or more carry 92% of the log-loss deficit (archive: 21% of
  lines, 98%). DraftKings was right there:
  - model 10+ points higher: the Over hit 48.1%, the model said 61.7%, DraftKings 45.8%;
  - DraftKings 10+ points higher: the Over hit 48.2%, the model said 30.8%, DraftKings 46.4%.
- Within 5 points of each other the two are nearly level (+0.0017).
- The spread of outcomes is not the problem. It is slightly too wide (squared error is 0.84 of the stated variance on
  points), and narrowing it makes the loss worse (+0.0202). What is missing is the uncertainty in the mean.

**2. Minutes are one of the two largest parts of the disagreements; the scoring rate is the other.**
- On the Over bets the calls said 29.0 minutes and the players played 26.6. Of the +2.45 the mean ran over the stat,
  minutes account for +1.09 and the scoring rate (at the pace played) for the same +1.09.
- On the Under bets the calls said 27.4 minutes and the players played 29.5. There minutes are most of it: −0.88 of
  −1.20.
- Live availability (the roster minus the injury report) is not the cause. The calls miss by 4.79 minutes a player, and
  the backtest's rule on the box score's list of who dressed misses by 4.80, with the same loss (+0.0185). The rule is
  the problem.
- In every one of the last four opening fortnights the rule gave the players it calls too many minutes (+0.62, +0.65,
  +0.94, +1.01 a player). In the trial a side's called players were given 238.8 minutes and played 229.6. Uncalled
  players took the rest: rookies with no game on record and the deep bench.
- It is worst at the ends:
  - players projected 34+ minutes were given 35.6 and played 33.8;
  - for bench players the model said the Over 53.5% and it hit 46.7%.
- How much better minutes would gain is not measured. A what-if prices the same calls on the minutes each player
  actually played and beats DraftKings by 0.0560 log loss. That is an upper bound inflated by hindsight, not an
  estimate:
  - the minutes a player plays carry the game's own results: foul trouble, a blowout, an injury, overtime;
  - so pricing on them reads part of the result, and its 3-point bets win on both sides (Overs +23.7%, Unders +30.5%),
    which no forecast made before tip does.

**3. A lean toward the Over that belongs to the season.**
- The mean ran +0.56 a line over the stat (points +1.01, points + rebounds +1.12). It splits into:
  - minutes +0.09;
  - pace +0.11;
  - the opponent factor +0.09;
  - the scoring rate itself +0.27.
- League scoring fell: 226.9 points a game against 231.2 last season and 234.1 in last season's opening fortnight.
  Posted game totals averaged 229.9, so the market ran high too.
- Pace was expected at 103.24 and played at 102.32. The points rate carried in from last season was 17.80 per 36 minutes
  against 16.94 made, the widest gap of the last four openers.
- The money loss is uneven because DraftKings puts its margin on the Over. Both sides were about equally overconfident:
  - Over bets said 61.4% and won 48.0% (−226.5 units);
  - Under bets said 63.4% and won 53.9% (+3.7).
- In the 2026 playoffs the lean ran the other way (the Over said 44.6%, hit 45.9%), and the Unders won. Causes 1 and 2
  show up the same way in both runs; this lean changes sign.

The worst groups are where minutes are least known (log loss against DraftKings):

| Group | Log loss vs DraftKings |
|---|---|
| A player's first game of the season | +0.0436 |
| A new club | +0.0282 (same club +0.0154) |
| Largest quarter of lines | +0.0319 (its Overs −93 units on 372 bets) |
| Bench players | +0.0297 |
| A late scratch on his side | +0.0280 |
| Neither a late scratch nor an uncalled teammate | +0.0131 |

### What past seasons show (`diag_history.md`)

This used `tools/props.js`'s own replay, fit and projection on seasons 2022-2026 only. Each test season was projected by
constants fitted on the seasons before it.

**The early-season Over lean is in every past season, but it is a small part of the loss.**

| | Points, projected minus actual [90%] | Chance of the Over, said minus happened [90%] |
|---|---|---|
| 2024, first 121 games | +0.78 [+0.60, +0.96] | +0.8 [−0.1, +1.6] |
| 2025, first 121 games | +0.50 [+0.32, +0.69] | +0.2 [−0.8, +1.2] |
| 2026, first 121 games | +0.48 [+0.29, +0.68] | +2.1 [+1.3, +3.0] |
| The trial's constants on 2023-2026, in sample | +0.68 | +1.4 [+0.9, +1.8] |

- The trial's +1.3 (48.8% said, 47.5% happened) is what this model has always done in its first two weeks. From December
  to April it leans the other way, −0.8 every season.
- The best possible recalibration, fitted on the very rows it is scored on, gains only 0.0006-0.0009 log loss in those
  weeks. The trial is 0.0184 behind DraftKings, so the lean explains about 3-5% of the gap.
- About half of the early lean is minutes. The rest comes from rates carried across the summer, players from
  non-playoff clubs, rookies who sit outside the side's minutes scale, and the season-start pace bump.

**Minutes run high where the stakes are highest.**
- Projected 35+ minutes: +1.74. Projected 8-15: −0.34. Overall +0.33, mean absolute error 4.87.
- Back after 10+ missed games: +3.60. A new club's first 10 games: +4.34.
- When a regular is out, the model hands his minutes to the stars (+2.61 at 35+) where coaches hand them to the bench
  (−2.96 at 8-15).

**The spread is right on average and wrong underneath.**
- Real points have more bad nights and fewer huge ones than the model's distribution allows, so at a line near the mean
  the Over is said too low (42.0% said, 44.5% happened).
- One variance curve per stat ignores minutes: too narrow for the bench, too wide for the rotation DraftKings lines most.

## The data there is, and its limits (`data.md`)

**The 2026 play-in and playoff archive (`data/props_2026.csv`)**
- 11,395 graded lines on 83 games and 18 clubs, 17 April to 13 June 2026, half-point lines (no pushes).
- It is the playoffs: shortened rotations, repeated opponents, 141 lines a game against the trial's 106, and far more
  steals and blocks lines.
- The unit of independence is the game. The standard error of a log-loss difference is 0.0040 by game against 0.0018 if
  lines were independent.
- **It is now spent.** Its by-stat and by-side results were published before this study, and A, B and C have each been
  scored on it. It is clean only for a new box-score model frozen elsewhere and scored once.

**How small a difference a test can tell apart** (a 90% interval clear of zero four times in five, for a model as far
from DraftKings as the current one):

| Data | Difference it can tell apart |
|---|---|
| The archive (83 games) | about 0.0099 log loss (0.0045 Brier) |
| A bar of 30,000 lines (about 250 games) | about 0.005 |
| A full regular season (1,230 games) | about 0.0025 |
| ESPN provider 40, one season, base stats | about 0.002 |
| ESPN provider 40, both seasons | about 0.0014 |

**ESPN's feed keeps far more than the hub's README says.**
- DraftKings' player props are still served for about 2,340 regular-season games of 2022-23 and 2023-24, under
  DraftKings' older provider id, 40. That is about 180,000 gradable lines, never scored by any model, in the regime the
  trial ran in.
- They are main-line pairs on the six base stats (points, rebounds, assists, threes, steals, blocks), read by the hub's
  own `propParse`. The first item is the Over.
- That they are pre-game prices is inferred, not shown:
  - the feed's only time stamp, each item's `lastUpdated`, fell about 5.4 hours after the scheduled start in an
    85-game sample, at about the game's end;
  - points and rebounds score like the 2026 archive, but threes and blocks score lower: 2023-24's sampled games 0.647
    and 0.606 against the archive's 0.665 and 0.635, 2022-23's 0.609 and 0.590 (its 2023 playoff blocks 0.546);
  - more lopsided prices explain part of that (2022-23's threes and blocks), but not 2023-24's threes, which are less
    lopsided than the archive's; a price that saw part of the game would explain it too (`data.md` section 3). The
    proposed test therefore checks it before its bar (below).
- Limits:
  - no combos, which were about 40% of the trial's lines;
  - DraftKings of 2022-24 may price differently from DraftKings now;
  - 2024-25 is a gap (ESPN BET's alternate lines only);
  - ESPN publishes no licence. It is the same feed `data/props_2026.csv` came from, with no account. Fetching it is the
    owner's call.
- `fetch_dk40.js` is the recipe. It writes only to the gitignored `cache/`, and has not been run on the real feed.
  - It keeps the cache a game at a time and rewrites each file whole, so running a range again, or two ranges that
    overlap, never repeats a line. Its first version appended, and would have written a game's lines once per run that
    read it.
  - Its `--dry` now requests nothing. The first version's `--dry` still downloaded every answer and only skipped the
    write; it was tried that way on one day.
  - Both rules are held by `fetch_dk40_test.js` on a local fake of the feed (`results/fetch_dk40_test.json`, 16 checks,
    no network).

**Nothing else is usable.**
- The Odds API's history is for paid plans only.
- DunkAPI, OddsPapi, SportsGameOdds and BALLDONTLIE all need an account and key.
- PropLine's free sample has no NBA, the Polymarket set is a paid product, and Kalshi has player ladders only from the
  2026 playoffs on.
- Kaggle has game lines only. The GitHub projects are scrapers with no licence or data they don't distribute.

## The candidates, on one table

- **A, fix the model's own parts** (`cand_fix.md`). `tools/props.js` with eleven changes, each tried in a fixed order,
  fitted on the seasons before each fold and kept only if the walk-forward's mean log score over the 11 stats fell on
  both the 2025 fold and the 2026 regular season. The 2026 playoffs were not looked at while choosing. Most of the gain is
  four changes:
  - fit minutes on squared error (the mean), not absolute error;
  - a straight-line calibration of minutes;
  - share a side's spare or missing minutes equally rather than in proportion;
  - widen the spread for bench players.
- **B, anchor to the market** (`cand_blend.md`). DraftKings' fair chance moved a share w of the way to the model, in
  logit, w fitted by maximum likelihood with each game held out. B1 has one w, B2 one per stat. The control tempers the
  model toward 50% with no market; it is not a candidate.
- **C, a selection rule** (`cand_select.md`). Trust the model only on lines where history says its disagreement is the
  right size. C-A, the primary rule: projected 15-35 minutes, no role change, line at or under the stat's median. It
  never changes a chance.

All archive figures are against DraftKings' fair chance on the same 2026 play-in and playoff lines (11,395 lines, 83
games), with 90% intervals from resampling games (10,000 resamples, seed 0). A positive difference means DraftKings is
better. Bets are flat one-unit bets at the closing price where the chance beats the price's implied chance by 3 points.

| | Log loss vs DraftKings [90%] | Brier vs DraftKings [90%] | Overs: bets, units [90%] | Unders: bets, units [90%] | Walk-forward vs `tools/props.js`: mean log score over 11 stats [90%], 2024 / 2025 / 2026 reg. / 2026 playoffs | Walk-forward mean absolute error, 11 stats |
|---|---|---|---|---|---|---|
| `tools/props.js` (the reference) | +0.0147 [+0.0083, +0.0214] | +0.0064 [+0.0036, +0.0094] | 967, −106.4 [−181.4, −32.0] | 4,271, +135.3 [−47.0, +315.6] | (the reference) | 2.674 / 2.706 / 2.703 / 2.535 |
| **A**, its parts fixed | +0.0125 [+0.0065, +0.0189] | +0.0056 [+0.0029, +0.0084] | 1,201, −120.3 [−198.7, −42.0] | 3,579, +159.0 [−14.5, +332.9] | −0.0133 [−0.0187, −0.0089] / −0.0164 [−0.0245, −0.0107] / −0.0083 [−0.0098, −0.0070] / −0.0550 [−0.0845, −0.0281] | 2.661 / 2.688 / 2.689 / 2.547 |
| **B1**, blend, one weight, each game held out | +0.0002 [−0.0004, +0.0008] | +0.0001 [−0.0002, +0.0004] | none | 115, −18.7 [−54.5, +13.1] | 0 by construction (no prices in the box scores, so B is `tools/props.js`) | the reference's |
| B2, blend, a weight per stat | +0.0001 [−0.0006, +0.0008] | +0.0001 [−0.0003, +0.0004] | 3, −0.9 | 511, −15.8 [−62.2, +29.5] | 0 by construction | the reference's |
| **C-A**, selection, on the 4,979 lines it picks | +0.0178 [+0.0098, +0.0259] | +0.0080 [+0.0043, +0.0118] | 502, −36.5 [−94.7, +20.9] | 1,791, −81.7 [−205.9, +39.9] | 0 by construction (it moves no mean) | the reference's on its rows |
| C-A over all lines (DraftKings' chance elsewhere) | +0.0078 [+0.0042, +0.0115] | +0.0035 [+0.0019, +0.0052] | as above | as above | | |
| Control: the model tempered toward 50%, no market | +0.0066 [+0.0035, +0.0097] | +0.0031 [+0.0017, +0.0046] | 953, −155.8 [−231.4, −81.3] | 2,347, −59.8 [−194.6, +73.4] | | |

How to read it:
- **A scores better than `tools/props.js`, and is still far from beating DraftKings.**
  - Its log score improves on every box-score fold: 2024, 2025, the 2026 regular season and the playoffs. 2024 is the
    fold A's selection never used, but it is no clean hold-out: it is the fold `tools/props.js`'s structure was chosen
    on, and its box scores trained both folds A was selected on.
  - Its mean absolute error falls on the three regular-season folds and gets slightly worse in the playoffs (2.535 to
    2.547), while its log score there improves most.
  - On the archive it beats `tools/props.js` on the same lines (log loss −0.0021 [−0.0037, −0.0005]) but closes only a
    seventh of the gap. It is still 9.0 points from 50% on average against DraftKings' 6.2.
  - Its units are no evidence: Overs −120.3 [−198.7, −42.0], Unders +159.0 [−14.5, +332.9]. Less `tools/props.js`'s,
    on the same resamples: Overs −13.8 [−65.5, +37.4], Unders +23.7 [−30.9, +76.0].
  - Points and the points combos are still about 0.025 behind; steals and steals + blocks are now just ahead.
  - Box-score gains carry over to the lines only weakly: the playoffs' log score improved by 0.055, their lines by 0.002.
  - Early in the season the points lean is gone in every past season (+0.78, +0.50, +0.48 become −0.04, −0.21, −0.15).
    That uncovers the shape problem: at a line near his average the Over now runs about 2 points low in 2024 and 2025.
- **B, fitted honestly, is DraftKings.** The weight settles at about 0.09, so B sits 0.6 points from DraftKings' chance on
  average.
  - The 83 leave-one-game-out fits range from 0.07 to 0.13. That is how much the fit moves with one game out, not its
    uncertainty: the archive's own optimum, 0.091, has a bootstrap 90% interval of −0.066 to +0.253, which takes in zero.
  - No fixed weight from 0.05 to 1 has an interval wholly below zero; from 0.55 up it is clearly worse than DraftKings.
  - It can barely bet, by construction: DraftKings puts its whole margin on the Over, so an Over needs B 10 points above
    DraftKings' fair chance, and an Under needs about 30 points of model disagreement.
  - Its useful finding is a yardstick, in sample and loose. The share the model earns is about zero on points and the
    points combos (points −0.10 [−0.30, +0.11]), 0.27 [+0.03, +0.52] on rebounds, 0.59 [+0.10, +1.12] on steals and
    0.54 [+0.08, +1.01] on blocks (`results/cand_blend_tables.md` D).
- **C's primary rule points the wrong way.** It picked the lines where history says the model is right-sized against its
  own average, and DraftKings beat it there by more (+0.0178 against +0.0147).
  - No rule of seven has a log-loss interval below zero, or a side whose units interval is above zero, even at 90%.
  - The only rule that narrows the gap much, non-points stats (+0.0062), was a known finding, so it cannot count as
    evidence.
- **The control halves the gap and still trails.** Tempering alone takes the deficit from +0.0147 to +0.0066. The rest is
  what DraftKings' price carries and the model's chance does not; this study does not show which inputs that is.

## Recommendation

**No candidate is worth a new shadow trial now.**

Why:
- **None is shown to beat DraftKings.**
  - A, the best of them, trails by +0.0125 log loss [+0.0065, +0.0189] on the archive, the interval well clear of zero.
  - B is DraftKings' own chance moved 0.6 points; on the page it would show DraftKings' price back under the model's name,
    with almost nothing to bet.
  - C's rules all lose to DraftKings on the lines they pick, the primary one by more than the model as a whole.
- **A trial of A would almost surely fail.**
  - A bar of 30,000 lines passes a model about 0.005 ahead of DraftKings four times in five. A is about 0.0125 behind on
    the playoffs, and the current model ran further behind in the regular season (+0.0184) than in the playoffs (+0.0147).
  - My estimate is that A's chance of passing such a trial is under 1 in 20.
  - It would also need a change to the live code first (A's extra inputs, below), so weeks of calls and that change would
    most likely end in a FAIL.
- **Tuning is not what is missing.**
  - The lines where the model and DraftKings differ by 10+ points carry all of A's deficit, and DraftKings was right on
    them.
  - Minutes are one large part of those disagreements, not most of them. On the trial's Over bets, minutes and the
    scoring rate each account for +1.09 of the +2.45 points the mean ran over the stat. Only on the Unders are minutes
    most of it (−0.88 of −1.20).
  - How much better minutes would gain is not known. The what-if priced on the minutes each player actually played
    (−0.0560 against DraftKings) is an upper bound inflated by in-game results: foul trouble, blowouts, injuries,
    overtime. Its bets win on both sides (Overs +23.7%, Unders +30.5%), which no forecast made before tip does. It does
    not show that a pre-game minutes forecast would beat DraftKings.
  - Recalibration does not close the gap: tempering toward 50% halves it and still trails (+0.0066).

**What I recommend instead** (each step is the owner's call):

1. **Keep A frozen as it stands** as the base for anything next. That is `results/cand_fix_rule.json` with its fold
   constants and `frozen` in `results/cand_fix_score.json`. Nothing in it is retuned.
   - Its log score beats `tools/props.js`'s on every box-score fold, including 2024, which its selection never used.
     2024 is not a clean hold-out, though: it is the fold `tools/props.js`'s structure was chosen on, and its box scores
     trained both folds A was selected on.
   - Its mean absolute error is better on the three regular-season folds and a little worse in the playoffs (2.535 to
     2.547).

2. **Score A once on regular-season lines that already exist.** ESPN's free feed still serves DraftKings' 2023-24 main
   lines (provider 40, about 85,000 gradable lines on the six base stats), and no model has been scored on them.
   - This would answer in about a day, with regular-season evidence, what a live trial would take months to say. It
     would also give `tools/props.js` its first regular-season market test.
   - **It is not a blind test.** The lines' prices are unseen by any model, but the season's outcomes are not:
     - 2023-24 is the fold `tools/props.js`'s structure was chosen on (`research/props.json`: "development: the
       structure was chosen on this fold");
     - its box scores trained both folds A was selected on (the 2025 fold, fitted on 2023-2024; the 2026 regular
       season, fitted on 2023-2025);
     - `diag_history.js` read its outcomes (the early-season lean of its first 121 games), which motivated A's changes,
       and C's history step derived its rules on its fold;
     - `espn_validate40.js` read DraftKings' prices on 29 of its games (every tenth that answered) and scored DraftKings'
       own fair chance there; no model was scored on them.

     So a PASS there is weaker evidence than a blind test's. It would say that A's frozen structure and constants beat
     DraftKings on prices they never saw, in a season whose outcomes helped shape them.
   - Fetching them is the owner's call. The feed publishes no licence, though it is the one `data/props_2026.csv` came
     from and needs no account. The lines would stay in the gitignored `cache/`, never committed.
   - **The validity check, applied before the bar.** It is in `validity.js`, with its thresholds, written before any of
     these lines is fetched (the 29 sampled games apart). It reads DraftKings' prices, the feed's stamps and the box
     scores only, and nothing a model says. That the lines are pre-game prices is inferred, not shown (above: the stamps
     fall at about the game's end, and threes and blocks score below the archive). So, once, on the fetched lines:
     - **V0, the Over is the first item.** On every stat, reading the first item as the Over scores the lower log loss.
     - **V1, timing from the feed.** `fetch_dk40.js` keeps each line's `lastUpdated` and the event's scheduled start.
       - If 95% or more of the graded lines are stamped before the start, the lines are shown pre-game.
       - Otherwise, which the sample predicts, the feed cannot show it. Pre-game then rests on V2 and V3, and every
         report of the result says "pre-game inferred, not shown".
     - **V2, the prices know nothing of the minutes played.** Take lines of players projected 24+ minutes. DraftKings'
       mean fair chance of the Over where he then played under 12 (an early exit: an injury, foul trouble, a blowout),
       less its mean where he played 12 or more, weighted by stat, must be −0.05 or above, on 100 early-exit lines or
       more (fewer cannot decide it). A price made after the exit would sit tens of points lower. The archive's figure
       is −0.016, on 41 early-exit lines (`results/validity_ref.json`), a reference rather than a test.
     - **V3, score-likeness, threes and blocks named.** On every stat, DraftKings' gain over the naive forecaster in log
       loss must be no more than the archive's gain on that stat plus 0.02. The naive forecaster is the player's own
       average before the game, priced at DraftKings' line on the walk-forward's spread.
       - The archive's gains: points 0.067, rebounds 0.021, assists 0.037, threes 0.027, steals 0.012, blocks 0.016.
       - Lower, more lopsided lines lower both scores alike. A price that saw part of the game gains far more.
     - **If V0, V2 or V3 fails, the test is VOID.** The bar is not applied, neither PASS nor FAIL is read, and the lines
       settle nothing. No new trial follows from a VOID; what to do next is the owner's call.
   - The bar, written now, before any of those lines is fetched for the test:
     - **Candidate:** A exactly as frozen at 18:41 UTC, with its 2024 fold's constants (fitted on 2023; 2022 warms up).
       The side is the box score's list of who dressed, as the archive was scored. That hindsight favours the model, so a
       PASS here is necessary, not sufficient.
     - **Lines:** every 2023-24 regular-season game provider 40 answers (24 October 2023 to 14 April 2024, the play-in
       left out), the six base stats, main lines with both prices. They are graded on the box scores as `tools/props.js`
       grades them; a player who did not play is void. DraftKings' fair chance is the hub's rule, the whole margin on the
       Over.
     - **Decided once, on every graded line, and never revisited.** PASS only if all three hold:
       1. log loss, A minus DraftKings' fair chance: the 90% interval (10,000 resamples of games, seed 0) wholly below
          zero;
       2. Brier: the same;
       3. flat one-unit bets at a 3-point edge over the price's implied chance (margin left in) are up.

       Otherwise FAIL. Test 3 is weak on its own. On the archive, models well behind DraftKings already meet it: A's two
       sides came to +38.7 units and `tools/props.js`'s to +28.8, at 0.0125 and 0.0147 log loss behind. It only guards
       against a model that scores well but bets the wrong lines; tests 1 and 2 carry the bar. `tools/props.js`'s own
       score, A minus `tools/props.js`, and the share of A's disagreement a blend keeps (B's yardstick, by stat) are
       reported beside it and decide nothing.
   - **The odds.** At about 85,000 lines this test can tell a difference of about 0.002 four times in five. A would need
     to be about 0.002 ahead of DraftKings; on these six stats in the playoffs it was about 0.008 behind. I expect FAIL,
     and I'd put the chance of a PASS at under 1 in 20.
   - **On FAIL:** no new shadow trial. The answer to the owner's question is then that a second model built from box
     scores does not beat DraftKings, in the regular season either, and props stay off the picks.
     - A third try would need inputs the box scores before the game do not hold, and this study does not say which.
       Minutes and the scoring rate weigh about equally in the trial's Over misses, and the gain from better minutes is
       unmeasured: the hindsight figure is only an upper bound.
     - Its first step would be to measure that on the 2022-23 lines, its development set, before building anything.
   - **On VOID:** no new shadow trial on this evidence. The lines are not shown to be pre-game prices, so they can
     neither pass nor fail A.
   - **On PASS:** a new shadow trial of A, with nothing on the page. Its bar is written into a new ledger before its
     first call:
     - **What:** A with the `frozen` constants (fitted 2023-2026), every DraftKings main line, all eleven stats.
     - **When:** only games tipping after the bar's registration time are called, and that registration comes after the
       2023-24 test is published. It is decided once, at the 2026-27 regular season's last game, on every graded line
       from registration on: about 80,000 if it starts by mid-December, where it can tell about 0.003.
     - **PASS:** the same three tests as the old bar.
     - **What PASS and FAIL do:** a PASS makes A a candidate to be shown as more than on trial, by a change of its own. A
       FAIL stops the calls and ends this line of work.
     - **Before it starts:** `tools/props.js`, or a sibling, has to carry A's extra inputs, all known before tip: the
       club's games played, games missed since a player's last appearance, appearances for a new club, and the side's
       players with no game on record. That is a change of its own, and its projections must reproduce
       `cand_fix_lib.js`'s on the 2026 rows to the digit before the bar is registered.

Plainly: I'd put the chance that this path ends with A passing a live trial at about 1 in 50 or less. The 2023-24 test is
still worth running. It answers the question with regular-season evidence at a scale the playoffs cannot give, and costs
no live trial. Its season is not blind, so it answers less firmly than a live trial would.

## Re-running

From the repository's root (the scripts need no package from `tools/node_modules`):

| Command | What | Time |
|---|---|---|
| `node research/props_v2/diag_trial.js` | the trial's diagnosis (reads the trial's lines, to diagnose only) | about a minute |
| `node research/props_v2/diag_history.js` | past seasons, on cached fold constants (`--refit` refits them, about 4 minutes) | about 35 s |
| `node research/props_v2/data_describe.js` | the archive described, and the power tables | about 10 s |
| `node research/props_v2/cand_fix.js --verify` / `--select` / `--score` | candidate A | about 3 / 42 / 13 minutes |
| `node research/props_v2/cand_blend.js` (`--check`) | candidate B | about 90 s |
| `node research/props_v2/cand_select_explore.js`, then `cand_select.js` (`--check`) | candidate C | about 2 and 3 minutes |
| `node research/props_v2/cut2026_check.js` | the loader against the old way, and its guard on planted rows | a few seconds |
| `node research/props_v2/fetch_dk40_test.js` | the fetch recipe on a local fake of the feed (no network) | a few seconds |
| `node research/props_v2/validity.js` | the validity check's references on the archive (`--lines ... --season 2024` runs the check on fetched lines) | about a minute |

`espn_probe.sh`, `espn_shape.js`, `espn_coverage.js` and `espn_validate40.js` query ESPN's feed. `fetch_dk40.js` is the
recipe for provider 40 and has not been run on the real feed.

**After the review (5 November 2026, from 19:37 UTC).** Every script that loads through `cut2026.js` was run again on it:
- `cand_fix.js --verify`, `--select` and `--score`, `cand_blend.js`, `cand_select_explore.js`, `cand_select.js --check`
  and `cand_select.js`, `diag_history.js` and `data_describe.js`.
- Every number in every result file came back the same; only the stamps moved ("generated", and the rule file's
  "frozen"), and `--select`'s log matches the first run's line for line but for its clock times. Files whose only change
  was a stamp were put back to the first runs' versions, as before, so `results/cand_fix_rule.json` still reads 18:41Z.
- Three outputs were kept from the new runs, because what they say changed:
  - `results/cand_fix_score.json`: `--score` now bootstraps A's units on the archive (`archive.units`). Its log is
    `results/cand_fix_score_units.log`; the first run's, `results/cand_fix_score.log`, is kept. Every other number in the
    file is the first run's.
  - `results/cand_select_tables.md`: the four rules' label is now "prices unseen".
  - `diag_trial.md`: its text on the hindsight minutes, on minutes against the scoring rate, and on the table 15
    yardsticks. Every table is as before, and `results/diag_trial.json` is the first run's.
- `diag_trial.js` was run again for its text (it reads the trial's lines to diagnose, as before). No other script was
  changed in a way that moves a number.

## Files

| File | What |
|---|---|
| `diag_trial.md`, `diag_trial.js`, `results/diag_trial.json` | why the trial lost |
| `diag_history.md`, `diag_history.js`, `results/diag_history_tables.md`, `results/diag_history.json`, `results/fold_params.json` | the model on 2022-2026, no lines |
| `data.md`, `data_describe.js`, `espn_*.{sh,js}`, `fetch_dk40.js`, `fetch_dk40_test.js`, `results/data_describe.json`, `results/espn_*`, `results/fetch_dk40_test.json` | the data there is, and the recipe and its test |
| `validity.js`, `results/validity_ref.json` | the validity check the 2023-24 test must pass before its bar, and its references on the archive |
| `cut2026.js`, `cut2026_check.js`, `results/cut2026_check.json` | the loader every candidate script uses (seasons up to 2026 only), and its check |
| `cand_fix.md`, `cand_fix.js`, `cand_fix_lib.js`, `results/cand_fix_*` | candidate A |
| `cand_blend.md`, `cand_blend.js`, `results/cand_blend*` | candidate B |
| `cand_select.md`, `cand_select.js`, `cand_select_lib.js`, `cand_select_explore.js`, `results/cand_select*` | candidate C |
| `.gitignore` | keeps `cache/` (fetched lines) out of git |
