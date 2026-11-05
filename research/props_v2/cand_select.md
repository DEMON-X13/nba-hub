# Candidate C: a selection rule, not a new chance

## The rules, written down before any was scored (5 November 2026, 18:03 UTC)

> *Added after the review:* that this section came before the scoring run is the writer's account. The repository cannot
> show it: the section and the results share this file, last saved after the run, and git keeps no file times (README,
> "The rules kept", rule 4).

This section was written before `cand_select.js` read a single outcome on the archive. What it was written from is
`results/cand_select_explore.md` (`cand_select_explore.js`: box scores of 2022-2026 only; it never opens
`data/props_2026.csv`), plus `diag_history.md` (the same seasons).

### What the rule writer already knew of the archive

The archive cannot be a clean test of every rule below, and this says which. Before writing, the writer had read:
- the README's archive results by stat (level on steals and blocks, furthest behind on points);
- its flat bets at 3, 5 and 8 points by side (Unders up at the low bars, Overs down at every bar);
- `cand_blend.md`'s per-stat shares;
- the trial diagnosis's headline that disagreements of 10+ points carry 98% of the archive's deficit.

The writer had not read `diag_trial.md`'s archive breakdowns by projected minutes, starter or bench, games played,
line size or role change, and did not read them before the scoring run.

So:
- a rule on **side** or **stat** is "seen": its archive score is reported, but it cannot count as evidence;
- a rule on **minutes tier**, **line size** or **role change** is "unseen" as far as the writer knows. The tables exist
  in this folder, though, so a reader should treat even these as weaker than a blind test.

The trial (2026-27) informs none of the rules (brief, rule 1).

> **Corrected after the scoring run** (5 November 2026, after an independent review; the rules themselves are unchanged).
> Two statements above are looser than the facts:
> - **"Unseen" is unseen in prices only.** The history the rules were written from (`results/cand_select_explore.md`)
>   checks each rule on the 2025 and 2026 folds, and the 2026 fold holds the 2026 play-in and playoff box scores: the
>   archive's own games' outcomes. Its playoff rows ("playoffs, model above the naive: share 0.41 / 0.29", and the rest)
>   include them. So the four rules on minutes tier, line size and role change are unseen in the archive's prices and
>   its scores against them, not in its outcomes. They are labelled "prices unseen" below and in the tables. That could
>   only flatter them, and they failed anyway.
> - **"The trial informs none of the rules"** means none was chosen on the trial's lines: each comes from the box-score
>   history. But the writer had read the trial's diagnosis (`diag_trial.md`'s findings and the brief's headline
>   numbers), so the trial was in view, as the README's cautions say.

### What history can and cannot say

Before the 2026 playoffs there are no prices. History can only say where the model's own information is right-sized.
It measures this at the walk-forward's book-like line, against the walk-forward's naive forecaster (the player's own
average on the same negative binomial):
- **share** is how much of the model's disagreement with the naive forecaster survives a maximum-likelihood fit. 1 means
  right-sized; under 1 means over-sized.
- **slope** is the model's own recalibration slope.

Read from the 2024 fold and checked on 2025 and 2026 (all three were in view when writing):

| Where | share, 2024 / 2025-26 | slope | What it says |
|---|---|---|---|
| All rows | 0.96 / 0.95 | 0.94 | the model's disagreement with its own average is nearly right-sized overall |
| Playoffs, model above the naive | **0.41 / 0.29** | 0.83 / 0.78 | in the playoffs its Over leans are badly over-sized |
| Playoffs, model below | 0.79 / 0.93 | 0.91 / 0.96 | its Under leans much less so |
| Regular season, model above / below (lean rows, nearly all regular season) | 0.99 / 0.995 against 0.83 / 0.78 | | the other way round in the regular season |
| Line size: the stat's largest quarter (Q4) / Q3 / Q2 / Q1 | 0.75 / 0.73, 0.83 / 0.82, 0.92 / 0.90, 0.99 / 0.98 | 0.84 / 0.80 for Q4 | disagreements on big lines are over-sized |
| Projected 35+ minutes | 0.88 / 0.86 | 0.93 / 0.90 | over-sized, and minutes run +1.74 over (`diag_history`) |
| Projected 8-15 minutes | 1.02 / 0.97 | 0.98 / 0.90 | right-sized against the naive forecaster, but the spread is too narrow (50% and 80% intervals cover 44.8% and 75.5%, `diag_history`) |
| Back after 3+ missed / a 20+ minute teammate back / new club | 0.95 / 0.84, 0.87 / 0.80, 0.58 / 0.70 | 0.89 / 0.83, 0.86 / 0.88, 0.58 / 0.67 | the role changes where the model's adjustments are over-sized |
| A 20+ minute teammate inactive; the club's games 1-10 | 1.02 / 1.02; 0.99 / 0.97 | | right-sized: not excluded |
| Points family (pts, pra, pr, pa) / the rest | 0.95 / 0.96 against 0.97 / 0.95 | **0.90 / 0.90** against 0.95 / 0.94 | shares level, but points are the most overconfident; their spread is mis-shaped (`diag_history` H), the rest's is flat |
| Disagreement 12+ points above the naive / 3-5 points | 0.99 / 1.00 against 0.89 / 0.97 | | larger disagreements are no worse sized |

**On edge size, history gives no ground for a band.** Against the naive forecaster, the larger disagreements are
right-sized or better (table above). The reasons to cap an edge come from the trial, which may not choose, and from the
archive's published bars, which are seen. So no rule here caps the edge. Every rule bets at the standard 3-point edge
over the price's implied chance, with the margin left in, as `tools/props.js` `flatBets` does. Within each rule the bets
are split by edge (3-5, 5-8, 8+ points), as description only.

### The rules

Each rule selects lines. It never changes a chance. On the lines it selects, the model's own chance is scored against
DraftKings' fair chance and bet at a 3-point edge. On every other line the rule says nothing (it would show DraftKings'
chance and bet nothing).

The archive is the play-in and the playoffs, so wherever a rule turns on the phase, the archive gets its playoff
branch. Its line size is DraftKings' line against the 2024 cut points above (`results/cand_select_explore.md`).

| Rule | Selects | Archive branch | Seen? (label corrected after the run: it read "unseen") |
|---|---|---|---|
| **C-A (primary)** | projected minutes 15 to under 35; no return after 3+ missed games, no 20+ minute teammate back, no new club; the line at or under the stat's median (Q1-Q2); both sides | the same | prices unseen |
| C-B | C-A, then the model's side by phase: Unders only in the playoffs, Overs only in the regular season | C-A, Unders only | **seen** (side) |
| C-side | every line, side by phase as C-B | Unders only | **seen** |
| C-stat | the non-points stats (reb, ast, tpm, stl, blk, ar, sb), both sides | the same | **seen** |
| C-tier | projected 15 to under 35 minutes, both sides | the same | prices unseen |
| C-size | lines at or under the stat's median (Q1-Q2), both sides | the same | prices unseen |
| C-role | no return after 3+ missed, no 20+ minute teammate back, no new club, both sides | the same | prices unseen |

Projected minutes are the model's own (the walk-forward's minutes on the box's list, as the archive's projections have
always been made). The role flags are `diag_history.js`'s and known before tip-off. A coach's decision not to play a
listed teammate is not read.

### How each is scored, once

All on the 2026 play-in and playoff archive: 11,395 graded lines on 83 games, the 2026 fold's model fitted on 2023-2025.
The model's chances must reproduce the README first.

1. **Log loss and Brier** on the rule's lines: the model's chance minus DraftKings' fair chance, with a 90% interval
   from 10,000 resamples of the games (seed 0, `tools/props.js` `bootCI`'s method). Also the same over all 11,395 lines
   for the candidate's chance: the model's on selected lines, DraftKings' elsewhere. That is the selected lines'
   difference, scaled by their share.
2. **Flat one-unit bets** at the closing price on the rule's lines, where the model's chance of a side beats its price's
   implied chance by 3 points. Overs and Unders are counted apart; a side the rule does not allow is not bet. Units carry
   a 90% interval from resampling games, and the edge bands are shown as description.
3. **The family.** With seven rules, the same intervals are also given at the Bonferroni level (two-sided
   1 − 0.10/7: the 0.71st and 99.29th percentiles).

**What counts.**
- A rule's lines carry information DraftKings lacks only if the log-loss difference on them has a 90% interval wholly
  below zero.
- They are worth betting only if a side's units have a 90% interval wholly above zero.
- A rule **survives** if either holds at the Bonferroni level too and it is unseen (in prices: see the correction above).
- A seen rule that clears either bar is reported as "clears, but seen". It is not evidence.
- If none survives, the answer is that no rule survives.

**The box-score walk-forward (2025 and 2026 folds, `tools/props.js` as it stands).** A selection rule changes no mean, so
on the rows it selects its mean absolute error and log score are `tools/props.js`'s, and the difference from
`tools/props.js` is zero by construction. Reported, per rule and fold:
- the rows it selects, as a share of all;
- `tools/props.js`'s mean absolute error and log score on those rows and on the rest (points, PRA and the eleven stats'
  mean);
- at the book-like line, the model's log loss against the naive forecaster's, and its share and slope.

The side rule selects bets, not rows, so for it the walk-forward reports the lean the rule bets: the model below the
naive forecaster in the playoffs, above it in the regular season.

**What it spends.** After this run the archive has been used to test selection rules on minutes tier, line size and role
change too. It is no longer clean for any rule of these kinds.

## Results

The rules above were written at 18:03 UTC.
- `--check` ran at 18:04-18:09. It reproduced the published numbers: the archive's 11,395 lines on 83 games, log loss
  0.6934 against 0.6788, and the model's flat bets (Overs 967, −106.4; Unders 4,271, +135.3). It also reproduced the
  walk-forward's 2025 and 2026 folds (`research/props.json`, to the digit), the explore step's cut points, and the
  bootstrap's 5th and 95th percentiles (`tools/props.js` `bootCI`'s, exactly). It printed each rule's line and bet
  counts, which read no outcome.
- The one scoring run was at 18:09-18:12. Nothing was changed between the two.

Every table is in `results/cand_select_tables.md` (A to F), and every number is in `results/cand_select.json`.

### The answer: no rule survives

On the lines each rule selects, the model against DraftKings' fair chance, with 90% intervals from resampling the 83
games:

| Rule | Seen? | Lines | Log loss diff [90%] | Brier diff [90%] | Overs: bets, units [90%] | Unders: bets, units [90%] |
|---|---|---|---|---|---|---|
| The model, every line | | 11,395 | +0.0147 [+0.0083, +0.0214] | +0.0064 [+0.0036, +0.0094] | 967, −106.4 [−181.4, −32.0] | 4,271, +135.3 [−47.0, +315.6] |
| **C-A (primary)** | prices unseen | 4,979 | **+0.0178 [+0.0098, +0.0259]** | +0.0080 [+0.0043, +0.0118] | 502, −36.5 [−94.7, +20.9] | 1,791, −81.7 [−205.9, +39.9] |
| C-B (C-A, Unders only) | seen | 4,979 | +0.0178 (its lines are C-A's) | +0.0080 | not bet | 1,791, −81.7 [−205.9, +39.9] |
| C-side (Unders only) | seen | 11,395 | +0.0147 (every line) | +0.0064 | not bet | 4,271, +135.3 [−47.0, +315.6] |
| C-stat (non-points) | seen | 6,721 | +0.0062 [+0.0015, +0.0110] | +0.0027 [+0.0005, +0.0048] | 532, −8.9 [−52.8, +34.6] | 2,079, +46.0 [−40.0, +131.9] |
| C-tier (15-35 min) | prices unseen | 7,054 | +0.0215 [+0.0124, +0.0311] | +0.0094 [+0.0054, +0.0136] | 655, −69.8 [−139.3, −1.3] | 2,861, −49.9 [−213.8, +109.2] |
| C-size (line at or under the median) | prices unseen | 7,562 | +0.0150 [+0.0084, +0.0219] | +0.0068 [+0.0037, +0.0099] | 698, −58.4 [−124.6, +7.2] | 2,671, −9.7 [−149.6, +129.0] |
| C-role (no return, teammate back or new club) | prices unseen | 10,781 | +0.0137 [+0.0074, +0.0204] | +0.0060 [+0.0032, +0.0090] | 899, −85.9 [−160.4, −13.3] | 3,997, +114.1 [−60.0, +289.7] |

**On information.**
- No rule's lines show a log-loss or Brier interval below zero, even at 90%.
- On every rule's lines, DraftKings is ahead with an interval wholly above zero at 90%.
- On the candidate's chance over all lines (the model's on the selected lines, DraftKings' elsewhere; table B), every
  rule is still behind DraftKings alone. The best is C-stat at +0.0037 [+0.0009, +0.0065].

**On money.**
- No side of any rule has a units interval wholly above zero.
- C-side's Unders are the model's own published Unders, unchanged.
- Three Over sets have intervals wholly below zero: C-tier's, C-role's, and the model's own.

**At the family level.** At the Bonferroni level for seven rules nothing changes, except that C-stat's interval reaches
zero from above ([−0.0009, +0.0134]). That is the bar for being worse than DraftKings, not better.

**The primary rule points the wrong way.** C-A is the history composite on dimensions whose archive prices the rule
writer had not seen. It picks the lines where the model's disagreement with its own average was right-sized in history.
In the walk-forward those rows have a share of 1.006 and a slope of 0.99-1.01, against all rows' 0.95-0.96 and 0.93-0.94
(table F). Yet on the archive, DraftKings beats the model by more there than on the whole: +0.0178 against +0.0147. Its
minutes tier is the largest part of that (C-tier +0.0215).

The lines C-tier leaves out (players projected 35+ or under 15 minutes, 4,341 lines) work out from table A at about
+0.0036, where the model is least far behind DraftKings. That is arithmetic on the scored rows, not a test. History's
sizing put the 35+ tier among the over-sized.

**Right-sized against a naive forecaster is not right-sized against DraftKings.** The market already has what the
model knows, and the model's disagreement with DraftKings is mostly its own error. History's yardstick cannot see that.

### Seen rules: reported, not evidence

- **C-stat (the non-points stats)** is the only rule that narrows the gap much: from +0.0147 to +0.0062. That is the
  README's and `cand_blend.md`'s known finding (points and their combos are where the model loses), and it is still
  behind DraftKings. Its Unders are +46.0 [−40.0, +131.9] on 2,079 bets.
- **C-side (Unders only in the playoffs)** is history's clearest phase-side signal. In the playoffs the model's Over
  leans were badly over-sized against the naive forecaster (share 0.41 and 0.29) and its Under leans much less so. It
  agrees with the archive's published result: Unders +135.3, Overs −106.4. That agreement cannot count, because the
  result was known.
- The same rule's regular-season branch, Overs only, is the side of the trial that lost: 2,796 Over bets, −226.5 units.
  (The trial's lines are read here only to diagnose. Nothing was chosen or scored on them.) So history's side asymmetry
  against the naive forecaster did not carry to DraftKings in the one regular-season sample there is.
- **C-B** loses its Unders (−81.7) because C-A's lines are the wrong lines.

### By edge (table D, described, not tested)

In every rule the 8+ point edges lose: the model's Overs −86.3 and Unders −6.8; C-A's Unders −91.3; C-tier's −93.1. The
model's Unders at 3-8 points are +142.1 on 2,208 bets, and those bars were published.

So the one band with any sign of value is the published one, and every rule's bets carry the same pattern the trial
diagnosis found: DraftKings is right where the two disagree most. A cap on the edge would have to be chosen on the trial
or on the archive's published bars, and neither may choose.

### The box-score walk-forward (table F)

A selection rule moves no mean. On the rows it selects, its mean absolute error and log score are `tools/props.js`'s
exactly, so the difference from `tools/props.js` is zero by construction. `research/props.json` is reproduced to the digit:
- points: mean absolute error 4.55 and 4.51, log score 3.0147 and 3.0192.

What a rule changes is which rows it keeps (rows projected 8+, 2025 and 2026 folds):
- **C-A** keeps half the rows, with lower error: points 4.54 and 4.50 against 4.97 and 4.88 on the rest. That is mostly
  mechanical, since its lines are the smaller half. At the book-like line its share is 1.006 and its slope 0.99-1.01.
- **C-size** has the same mechanical gap: points 4.33 against 6.06.
- **C-tier and C-role** keep rows with higher error than the rest: C-tier points 4.82 against 4.57; C-role 4.77 against
  4.62. The excluded bench, stars and role changes are lower-error rows in absolute terms.
- **C-stat** keeps whole stats, so each stat's numbers are `tools/props.js`'s on all rows.

These checks are not independent of the rules. The 2025 and 2026 folds were in view when the rules were written.

### Honest read

1. **No selection rule survives.** Seven were written down from 2022-2026 box scores (the archive's own games' box
   scores among them) before the archive's lines were scored. On the lines each selects, DraftKings is ahead of the
   model with an interval wholly above zero, and no side of any rule makes money with an interval above zero.
2. **The primary rule, the one test unseen in prices, is worse than the model as a whole.** It took the lines where
   history says the model's own adjustments are right-sized, and those are where DraftKings beat it by more (+0.0178).
   History has no prices, so it measures the model against its own average. That says nothing about what DraftKings
   knows, and here it pointed the wrong way.
3. **What does narrow the gap is already known**: the non-points stats (+0.0062), and in the playoffs the Unders. Both
   were in the README before this study, so neither is evidence. The Unders flip to the losing side in the regular
   season (the trial's Overs −226.5).
4. **A selection rule cannot rescue a model that DraftKings beats on every subset.** It only helps on top of a model that
   earns a share of the disagreement above zero against DraftKings (`cand_blend.md`'s yardstick: about 0.09 now, its
   90% interval −0.066 to +0.253 even in sample, and about zero on points).
   - I do not recommend C, or any rule here, for a new shadow trial on its own.
   - A second model that earns that share would be the candidate. A selection rule for it should be written on its own
     walk-forward and then registered with its trial.
5. **What this run spent.** The archive has now been used to test selection rules by minutes tier, line size and role
   change, on top of the stat, side and edge breakdowns published before. It is no longer a clean test for any
   selection rule. It stays clean only for a new chance from a box-score model frozen elsewhere, scored once on its own.

### Files

Re-run from the worktree:
- `node research/props_v2/cand_select_explore.js`: the history step, about 2 minutes. It never reads the archive.
- `node research/props_v2/cand_select.js --check`: the reproductions and each rule's size, about 4 minutes.
- `node research/props_v2/cand_select.js`: the scoring run, about 3 minutes.

The pieces:
- `cand_select_lib.js`: the data cut to 2026, the role flags (`diag_history.js`'s rule), the walk-forward rows and the
  archive's lines.
- `results/cand_select_explore.md` and `.json`
- `results/cand_select_tables.md`
- `results/cand_select.json`
