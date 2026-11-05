# A second props model: the study

Research only, 5 November 2026. Nothing here goes on the page, into the job or into `tools/props.js`; every file is in
`research/props_v2/`.

**The short answer.** Three candidates were built and each was scored once against DraftKings' closing lines. None
beats DraftKings:
- **A** fixes the model's own parts. It is a better model than `tools/props.js` on every box-score season, but it still
  trails DraftKings, closing only about a seventh of the current model's gap.
- **B** blends toward DraftKings. Fitted honestly, it becomes DraftKings' own chance and has almost nothing to bet.
- **C** picks the lines to trust. Its rules pick lines where DraftKings wins by more.

No candidate is worth a new shadow trial now. One cheap test on data that already exists could settle the question
before anyone waits on a live trial; it is the owner's call, below.

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

1. **Nothing was fitted, chosen, tuned or scored on 2026-27** (`data/box_2027.csv`, `data/props_2027.csv`, the shadow
   ledger).
   - The trial's graded lines were read only by the diagnosis (`diag_trial.js`), to say where the frozen model lost.
   - Every other script cuts `data/games.csv` to season 2026 and earlier before it reads a box score, and throws if a
     later row appears.
2. **Nothing outside `research/props_v2/` was changed.** `tools/props.js` is required for its exported functions and
   never changed. `research/props.json`, `state.json` and `data/*` are untouched.
3. **No paid data, no account, no third-party data committed.** The search for more historical lines read ESPN's
   free feed in memory and saved game ids, counts and DraftKings' aggregate scores only; no price is in this folder. The
   fetch recipe writes only to a gitignored `cache/`, and was not run.
4. **Each candidate's rule was written down before it was scored, then scored once:**

   | Candidate | Rule written | One scoring run |
   |---|---|---|
   | B (blend) | 17:42 UTC, in `cand_blend.md` | 17:47 |
   | C (selection) | 18:03 UTC, in `cand_select.md` | 18:09-18:12 |
   | A (fix the parts) | frozen 18:41 UTC, `results/cand_fix_rule.json` | 18:43-18:55 |

   Each run was preceded by a check that reproduced the published numbers to the digit and printed no candidate score:
   - the archive's 11,395 lines at log loss 0.6934 against 0.6788;
   - the model's flat bets;
   - `research/props.json`'s 2025 and 2026 folds.

   Each scoring script was run once more, from 18:59 UTC, to confirm its numbers reproduce. They do, every number in
   every result file; only the files' "generated" stamps moved, and the first runs' files are the ones kept here.

**Two cautions about what "unseen" means here.**
- The list of changes A tried, and the rules C wrote, came from diagnoses that had read the trial's lines and the
  archive. No constant came from either, but the archive is not a blind test of any of them.
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

**2. Minutes drive most of the disagreements.**
- On the Over bets the calls said 29.0 minutes and the players played 26.6. Minutes account for +1.09 of the +2.45 the
  mean ran over the stat.
- On the Under bets the calls said 27.4 minutes and the players played 29.5.
- Live availability (the roster minus the injury report) is not the cause. The calls miss by 4.79 minutes a player, and
  the backtest's rule on the box score's list of who dressed misses by 4.80, with the same loss (+0.0185). The rule is
  the problem.
- In every one of the last four opening fortnights the rule gave the players it calls too many minutes (+0.62, +0.65,
  +0.94, +1.01 a player). In the trial a side's called players were given 238.8 minutes and played 229.6. Uncalled
  players took the rest: rookies with no game on record and the deep bench.
- It is worst at the ends:
  - players projected 34+ minutes were given 35.6 and played 33.8;
  - for bench players the model said the Over 53.5% and it hit 46.7%.
- A what-if with hindsight shows how much is at stake (a diagnosis, not a model): priced on the minutes each player
  actually played, the same calls would have beaten DraftKings by 0.0560 log loss. No model knows those minutes; the market
  knows more of them than the box score does.

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
  own `propParse`. The first item is the Over, and by stat they score like the 2026 archive, so they are pre-game prices
  (that each is the last price before tip cannot be proven from the feed).
- Limits:
  - no combos, which were about 40% of the trial's lines;
  - DraftKings of 2022-24 may price differently from DraftKings now;
  - 2024-25 is a gap (ESPN BET's alternate lines only);
  - ESPN publishes no licence. It is the same feed `data/props_2026.csv` came from, with no account. Fetching it is the
    owner's call.
- `fetch_dk40.js` is the recipe. It writes only to the gitignored `cache/`, was tested only with `--dry`, and was not
  run.

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
games), with 90% intervals from resampling games. A positive difference means DraftKings is better. Bets are flat one-unit
bets at the closing price where the chance beats the price's implied chance by 3 points.

| | Log loss vs DraftKings [90%] | Brier vs DraftKings [90%] | Overs: bets, units [90%] | Unders: bets, units [90%] | Walk-forward vs `tools/props.js`: mean log score over 11 stats [90%], 2024 / 2025 / 2026 reg. / 2026 playoffs | Walk-forward mean absolute error, 11 stats |
|---|---|---|---|---|---|---|
| `tools/props.js` (the reference) | +0.0147 [+0.0083, +0.0214] | +0.0064 [+0.0036, +0.0094] | 967, −106.4 [−181.4, −32.0] | 4,271, +135.3 [−47.0, +315.6] | (the reference) | 2.674 / 2.706 / 2.703 / 2.535 |
| **A**, its parts fixed | +0.0125 [+0.0065, +0.0189] | +0.0056 [+0.0029, +0.0084] | 1,201, −120.3 [about −213, −27]* | 3,579, +159.0 [about −2, +320]* | −0.0133 [−0.0187, −0.0089] / −0.0164 [−0.0245, −0.0107] / −0.0083 [−0.0098, −0.0070] / −0.0550 [−0.0845, −0.0281] | 2.661 / 2.688 / 2.689 / 2.547 |
| **B1**, blend, one weight, each game held out | +0.0002 [−0.0004, +0.0008] | +0.0001 [−0.0002, +0.0004] | none | 115, −18.7 [−54.5, +13.1] | 0 by construction (no prices in the box scores, so B is `tools/props.js`) | the reference's |
| B2, blend, a weight per stat | +0.0001 [−0.0006, +0.0008] | +0.0001 [−0.0003, +0.0004] | 3, −0.9 | 511, −15.8 [−62.2, +29.5] | 0 by construction | the reference's |
| **C-A**, selection, on the 4,979 lines it picks | +0.0178 [+0.0098, +0.0259] | +0.0080 [+0.0043, +0.0118] | 502, −36.5 [−94.7, +20.9] | 1,791, −81.7 [−205.9, +39.9] | 0 by construction (it moves no mean) | the reference's on its rows |
| C-A over all lines (DraftKings' chance elsewhere) | +0.0078 [+0.0042, +0.0115] | +0.0035 [+0.0019, +0.0052] | as above | as above | | |
| Control: the model tempered toward 50%, no market | +0.0066 [+0.0035, +0.0097] | +0.0031 [+0.0017, +0.0046] | 953, −155.8 [−231.4, −81.3] | 2,347, −59.8 [−194.6, +73.4] | | |

\* A's units were not bootstrapped. The bracket is scaled from the archive's per-game spread of a bet's result (`data.md`:
a return's standard error of 2.26% over 5,238 bets). That scaling gives the reference's own intervals to within about 10
units.

How to read it:
- **A is a better model than `tools/props.js`, and still far from beating DraftKings.**
  - It improves every box-score fold, including 2024, which the selection never saw, and the playoffs.
  - On the archive it beats `tools/props.js` on the same lines (log loss −0.0021 [−0.0037, −0.0005]) but closes only a
    seventh of the gap. It is still 9.0 points from 50% on average against DraftKings' 6.2.
  - Points and the points combos are still about 0.025 behind; steals and steals + blocks are now just ahead.
  - In the playoffs its mean absolute error got slightly worse (2.535 to 2.547) while its log score improved most.
  - Box-score gains carry over to the lines only weakly: the playoffs' log score improved by 0.055, their lines by 0.002.
  - Early in the season the points lean is gone in every past season (+0.78, +0.50, +0.48 become −0.04, −0.21, −0.15).
    That uncovers the shape problem: at a line near his average the Over now runs about 2 points low in 2024 and 2025.
- **B, fitted honestly, is DraftKings.** The weight settles at about 0.09 (0.07 to 0.13 across held-out games), so B sits
  0.6 points from DraftKings' chance on average.
  - No fixed weight from 0.05 to 1 has an interval wholly below zero; from 0.55 up it is clearly worse than DraftKings.
  - It can barely bet, by construction: DraftKings puts its whole margin on the Over, so an Over needs B 10 points above
    DraftKings' fair chance, and an Under needs about 30 points of model disagreement.
  - Its useful finding is a yardstick. The share the model earns is about zero on points and the points combos, 0.27 on
    rebounds, and 0.5-0.6 on steals and blocks.
- **C's primary rule points the wrong way.** It picked the lines where history says the model is right-sized against its
  own average, and DraftKings beat it there by more (+0.0178 against +0.0147).
  - No rule of seven has a log-loss interval below zero, or a side whose units interval is above zero, even at 90%.
  - The only rule that narrows the gap much, non-points stats (+0.0062), was a known finding, so it cannot count as
    evidence.
- **The control halves the gap and still trails.** Tempering alone takes the deficit from +0.0147 to +0.0066. The rest is
  information DraftKings has and the model lacks.

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
- **What is missing is information, not tuning.**
  - The lines where the model and DraftKings differ by 10+ points carry all of A's deficit, and DraftKings was right on
    them.
  - Those disagreements are mostly minutes: who plays tonight and for how long. The box scores before the game don't hold
    that, and a perfect minutes forecast, with hindsight, would have beaten DraftKings by a wide margin.
  - Recalibration does not supply it: tempering toward 50% halves the gap and still trails (+0.0066).

**What I recommend instead** (each step is the owner's call):

1. **Keep A frozen as it stands** as the base for anything next. That is `results/cand_fix_rule.json` with its fold
   constants and `frozen` in `results/cand_fix_score.json`. It beats `tools/props.js` on every box-score fold, including
   the 2024 fold it never chose on. Nothing in it is retuned.

2. **Score A once on regular-season lines that already exist.** ESPN's free feed still serves DraftKings' 2023-24 main
   lines (provider 40, about 85,000 gradable lines on the six base stats), and no model has been scored on them.
   - This would settle in about a day what a live trial would take months to say, and give `tools/props.js` its first
     regular-season market test as well.
   - Fetching them is the owner's call. The feed publishes no licence, though it is the one `data/props_2026.csv` came
     from and needs no account. The lines would stay in the gitignored `cache/`, never committed.
   - The bar, written now, before any of those lines is read:
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

       Otherwise FAIL. `tools/props.js`'s own score, A minus `tools/props.js`, and the share of A's disagreement a blend
       keeps (B's yardstick, by stat) are reported beside it and decide nothing.
   - **The odds.** At about 85,000 lines this test can tell a difference of about 0.002 four times in five. A would need
     to be about 0.002 ahead of DraftKings; on these six stats in the playoffs it was about 0.008 behind. I expect FAIL,
     and I'd put the chance of a PASS at under 1 in 20.
   - **On FAIL:** no new shadow trial. The answer to the owner's question is then that a second model built from box
     scores does not beat DraftKings, in the regular season either, and props stay off the picks. A third try would
     have to bring in live information (rotations, restrictions, late scratches), with the 2022-23 lines as its
     development set.
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
still worth running, because it answers the question with regular-season evidence at a scale the playoffs cannot give,
and costs no live trial.

## Re-running

From the repository's root (the scripts need no package from `tools/node_modules`):

| Command | What | Time |
|---|---|---|
| `node research/props_v2/diag_trial.js` | the trial's diagnosis (reads the trial's lines, to diagnose only) | not timed |
| `node research/props_v2/diag_history.js` | past seasons, on cached fold constants (`--refit` refits them, about 4 minutes) | about 35 s |
| `node research/props_v2/data_describe.js` | the archive described, and the power tables | not timed |
| `node research/props_v2/cand_fix.js --verify` / `--select` / `--score` | candidate A | about 3 / 42 / 13 minutes |
| `node research/props_v2/cand_blend.js` (`--check`) | candidate B | about 90 s |
| `node research/props_v2/cand_select_explore.js`, then `cand_select.js` (`--check`) | candidate C | about 2 and 3 minutes |

`espn_probe.sh`, `espn_shape.js`, `espn_coverage.js` and `espn_validate40.js` query ESPN's feed. `fetch_dk40.js` is the
recipe for provider 40 and was not run.

## Files

| File | What |
|---|---|
| `diag_trial.md`, `diag_trial.js`, `results/diag_trial.json` | why the trial lost |
| `diag_history.md`, `diag_history.js`, `results/diag_history_tables.md`, `results/diag_history.json`, `results/fold_params.json` | the model on 2022-2026, no lines |
| `data.md`, `data_describe.js`, `espn_*.{sh,js}`, `fetch_dk40.js`, `results/data_describe.json`, `results/espn_*` | the data there is |
| `cand_fix.md`, `cand_fix.js`, `cand_fix_lib.js`, `results/cand_fix_*` | candidate A |
| `cand_blend.md`, `cand_blend.js`, `results/cand_blend*` | candidate B |
| `cand_select.md`, `cand_select.js`, `cand_select_lib.js`, `cand_select_explore.js`, `results/cand_select*` | candidate C |
| `.gitignore` | keeps `cache/` (fetched lines) out of git |
