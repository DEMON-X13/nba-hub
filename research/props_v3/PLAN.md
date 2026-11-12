# The plan for MA: DraftKings' price, nudged by the hub's read of the player

Research only, 12 November 2026. The owner asked (11 November): "i also want to figure out why the model failed and if
we can build a more reliable one." `why_it_failed.md` is the first half. This is the plan for the second: one candidate,
MA, how it is built, the bar it must meet on development data before anything is spent, the one-shot test on
DraftKings' 2022-23 lines and the bar written for it, and what a pass or a fail leads to. **Nothing here is the
candidate.** The numbers below come from small sizing checks on development data (`plan_sizing/`, their tables in
`results/plan_tables.md`), made with a stand-in forecaster that no candidate may stand on (section 6). This plan is not
the preregistration: that is written from sections 3 to 5 once MA is built and has met section 2 on its own
projections, with its files hashed, and is committed, pushed and audited before any 2022-23 line is fetched.

## In plain English

- **What MA is.** It starts from DraftKings' own fair chance on each main line. It reads DraftKings' view of how much a
  player will do overall in a game (his minutes, role and usage: what `why_it_failed.md` found DraftKings knows best) off
  that player's other lines in the same game. It takes from the hub's box scores only his *mix*: which stats he does more
  or less of, per minute, against this opponent. Where DraftKings' line on one stat sits away from the hub's mix at
  DraftKings' own level, it nudges that line. It never forecasts minutes.
- **Why it might work.** On DraftKings' 2023-24 lines (development data), a stand-in built this way, fitted on part of the
  season and scored on the rest, added about 0.0010 log loss a line beyond DraftKings' price and beyond every
  information-free adjustment we could name, at about the size it was fitted at. The old model's whole disagreement,
  shrunk the same way, added about 0.0004. The nudge does not know who left a game early or how many minutes anyone
  played, and it holds when DraftKings' level is read without the points line. It helps on steals most, then blocks,
  threes, assists and rebounds, and not on points.
- **What would count.** The test asks one thing: does the nudge add information beyond DraftKings' price? Two criteria,
  each built so that no rival without player information can meet it. On development data 26 such rivals and 40
  shuffled copies of the candidate were tried, and none met either.
- **The odds, honestly.** The stand-in meets the bar on every development split. At half its development effect it would
  pass a test the size of 2022-23's about nine times in ten by the development bar's protocol, and five to eight times
  in ten by the alternate-nights splits. But it was fitted on 2022-23 box scores, so it is no candidate. MA's own
  projections are fitted on 2021-22 alone and will be weaker, and 2022-23 is a different season. The development bar
  must be met again with them before the test is spent. A small, real edge on the small stats, or nothing, are the
  likely answers. Beating DraftKings on points is not.
- **What a pass starts.** Only a quiet forward shadow on 2026-27 games called after the freeze. Nothing on the page
  changes.
- **"More reliable."** MA would also be calibrated stat by stat, where the hub's fair chance (the whole margin on the
  Over) under-says the Over by 1.7 to 2.3 points on four stats. But that correction needs no player information. It is a
  question about the hub's devig rule, it is reported, and it decides nothing here (section 4.5).

## 1. The candidate

### 1.1 What MA computes

For each game, on DraftKings' main lines of the six base stats (points, rebounds, assists, threes, steals, blocks):

1. **DraftKings' fair chance** q on each posted line, from its two prices by the hub's rule: the whole margin on the Over
   (fair Over = 1 − the Under's implied chance).
2. **The projection layer, P23.** For every player DraftKings posted a line for, his mean on each of the six stats and its
   negative-binomial spread, from his earlier games alone. These are `tools/props.js`'s own pieces and code: his rate per
   minute on each stat (weighted toward recent appearances, shrunk toward his position's league rate) times what the
   opponent has allowed on that stat. The constants are refitted on 2021-22 (section 1.4). Each mean is taken at a
   nominal 30 minutes and the game's expected pace. Minutes and pace multiply all six of his stats alike, so they cancel
   in step 4. MA needs no minutes forecast and no list of who plays.
3. **DraftKings' implied means.** On each of his lines: the mean at which P23's negative binomial for that stat gives the
   Over the chance q.
4. **DraftKings' level for him, κ.** The weighted average, over **every** line DraftKings posted for him in that game, of
   log(DraftKings' implied mean / P23's mean). Each is weighted by the precision of DraftKings' implied mean: its square
   over P23's variance at it. Points carries most of the weight. κ is DraftKings' read of how much he will do overall.
5. **The hub's mix at DraftKings' level.** Each stat's P23 mean times e^κ, priced at DraftKings' line on P23's spread:
   m. What disagreement is left, d = logit m − logit q, is the hub's read of which stats he does more or less of than
   DraftKings' lines say, with DraftKings' level held. Within a player-game these disagreements offset one another in
   the level by construction, so the nudge cannot lean all of a player's lines one way.
6. **The nudge.** n = w_s × d, one weight per stat, plus any secondary term that passes section 1.3. A stat whose nudge
   does not help on development data gets weight 0. Rule: a forward-chained T2 point estimate above 0 on that stat, in
   section 2's protocol. The stand-in's points nudge was +0.00024 a line, so points would get none.
7. **MA's chance.** logit P = E + n. E is MA's own information-free part: per stat an intercept and weights on logit q
   and on logit of the Over's implied chance, each shrunk toward DraftKings' own chance (a ridge of 5), fitted with n as
   an offset.

A player with a single posted line has d = 0 (his level is that line), so MA is E there. On 2023-24, 99.99% of graded
lines are on player-games with two or more lines.

The weights w_s are fitted jointly with the information-free family F of section 4.1 as controls, so they carry only
what F does not; E is then fitted with the frozen n as an offset.

### 1.2 Every input, and why it is known before tip-off

| Input | Where it comes from | Why it is known before tip-off | Never read |
|---|---|---|---|
| DraftKings' two prices on each line | provider 40's closing lines (backtest); the job's read before tip (shadow) | posted before tip-off | the feed's `last_updated` (an outcome: `data.md` section 1), ESPN's `lastUpdated` |
| His other posted lines in the game (for κ) | the same feed | every line posted, whatever is graded later | which of them are graded, voided or pushed |
| His rates, his position, the opponent's allowed rates, pace | box scores of games strictly before this game's date | earlier games: the replay takes a day's features before its results, as `tools/props.js` does | the game's own box (who dressed, who started, minutes, did-not-play reasons) and any later box |
| Which players to project | DraftKings' posted lines | the lines name them | the game's box (the stand-in projected the box's list; MA may not) |
| P23's constants | `tools/props.js`'s fit on 2021-22, 2020-21 warming up | fitted once, frozen | nothing fitted on 2022-23 or later |
| w_s, E, any secondary weight | DraftKings' 2023-24 lines (development) | fitted once, frozen | 2022-23's lines, 2026-27's |
| Secondary inputs (section 1.3) | box scores of earlier games, the schedule | earlier games and a published schedule | as above |

### 1.3 The secondary inputs: tried once each, in this order, on development data

The owner's list (stat mix, minutes trend, teammates out, rest, early-season rates) and "whatever honest signal the
minutes part leaves" go in as follows:

- **The stat mix** is the primary nudge (1.1).
- **Rest with no player in it** (his club's and its opponent's second night of a back-to-back) is information-free by
  P1: it uses no read of the player. So it sits in F, the controls, and can never be credited to MA.
- The others are tried once each, in this order, with the nudge's weights refitted each time:
  1. **The level that is left:** the projection's own level against DraftKings', d_lvl = logit(P23 at its own level) −
     logit m. This is the minutes part's honest remainder.
  2. **His minutes trend:** log of his last three appearances' minutes over his previous ten's.
  3. **Teammates out:** the share of his club's minutes over its last five games played by players absent from (or flagged
     did-not-play in) its previous game.
  4. **His return:** whether he missed his club's previous game.
  5. **Early season:** d × [fewer than 10 appearances this season], a weight of its own.

Each enters with a weight per stat, and only if both hold:
- in section 2's forward-chained protocol, the full nudge with it beats the nudge without it on log loss, the paired
  90% interval wholly below 0;
- the full nudge still meets D1 and D2.

Expect the first three to fail. DraftKings knows minutes better (`why_it_failed.md` section 4), and the stand-in with the
level part added did a little worse than without it on every split of the first sizing round (`results/plan_sizing.json`,
`S_mixlvl`).

### 1.4 The folds: which seasons go where

| Data | Season | Used for |
|---|---|---|
| ESPN box scores, fetched into `cache/` (gitignored) | 2020-21 | P23's warm-up history (the replay only; nothing fitted on it). The research fetch of `data.md` section 4: a day's scoreboard, then each game's summary, about 2,400 requests |
| `data/box_2022.csv`, `teambox_2022.jsonl` | 2021-22 | P23's one fit season (`tools/props.js`'s fit, its structure and grids unchanged), and history |
| `data/box_2023.csv`, `teambox_2023.jsonl` | 2022-23 | history the replay walks into every later projection (allowed), and the outcomes the test grades. **Nothing fitted, re-scaled or chosen on it** |
| `data/box_2024.csv` ... `box_2026.csv` | 2023-24 to 2025-26 | history; 2023-24's outcomes grade the development lines |
| DraftKings' provider-40 lines (`cache/dk40_2024_lines.csv`, six columns) | 2023-24 | **development**: w_s, E and the secondaries fitted, by months for the development bar, all of it for the frozen candidate |
| DraftKings' archive (`data/props_2026.csv`) | 2026 play-in, playoffs | **spent**: a sign check only (D8) |
| DraftKings' provider-40 lines | 2022-23 | **the one-shot test** (section 3) |
| `data/odds_hist.csv` | 2022-23, 2023-24 | the game total and spread in F (pre-game inputs of the bar's controls; never fitted for MA) |
| `data/games.csv` | to 2025-26 | dates, types, the schedule (rest in F) |
| `data/props_2027.csv`, `lines.json`, `box_2027.csv`, the shadow ledger | 2026-27 | **the forward shadow only**, from MA's freeze on (section 5) |

Every piece is fitted only on what came before the lines it is scored on, with one exception that cannot be avoided: w_s
and E are fitted on DraftKings' 2023-24 lines, the season after the test's. No DraftKings regular-season lines before
2022-23 exist to fit them on: 2021-22's regular season has none on the feed (`data.md` section 4). Nothing of 2022-23
enters them. A backward test can be hurt by drift between seasons, never helped by it. P23 is fitted on 2021-22 for both
the development lines and the test's. The development projections then stand two seasons after their fit and the test's
one, so the test's projections are, if anything, fresher than the ones MA's weights were fitted on. Nothing MA stands on
was fitted on 2022-23: not `tools/props.js`'s live constants, its folds, props_v2's A or `data/corr.json` (`data.md`
section 6).

### 1.5 The guards against the lost run's leaks, built in from the start

- **L1, `last_updated`.** MA's line loader reads only `game_id, player_id, stat, line, over, under`, and a separate file
  of scheduled starts. It refuses a file with a seventh column. The Test step strips the stamp before any MA code runs
  and hashes the result. Only the validity check's V1 reads the stamp.
- **L2, the lines' rebuild.** Which lines exist, their pairing and their prices come from the feed's pre-tip fields
  alone, by `propParse`'s rules, never from a box score, a grade or a stamp. MA projects every posted player from his
  earlier games, never from the game's box. Held by the **blindfold check** (D7): for 200 development games, every
  input and chance is recomputed from a data folder holding only (a) the box scores of earlier dates and (b) the game's
  six-column lines, and must be the same to the bit. Every graded outcome scrambled must change no input or chance.
- **L4, pushes and voids in aggregates.** κ, and F's night, game and player-game aggregates, are built from every line
  posted: graded, void, no call or push alike. The blindfold check covers it.
- **A new one, for a cross-line candidate.** κ reads a player's other lines. If a share of those prices had been moved
  during the game (the feed cannot show they were not), the level would carry the game's news, and the nudge would
  know it on his other lines. On development data it does not:
  - on 414 lines of 77 early exits its average shift is +0.06 points against +0.02 elsewhere;
  - its per-player-game average correlates 0.002 with the minutes he went on to play against his projection (the
    model's raw disagreement −0.40, DraftKings' level +0.39);
  - read without the points line, its gain on the other stats is 0.00107 against 0.00119 as built
    (`results/plan_tables.md` D).
  The test repeats the first of these as V4.

## 2. The development bar: what MA must meet before the test is spent

**The protocol.** On DraftKings' 2023-24 lines, with MA's own P23 projections:
- w_s, E and the secondaries are fitted on the months before each month from December to April (October and November
  only train);
- the months' out-of-fold lines (about 69,000 on 863 games) are scored together;
- F is cross-fitted on them, as the test fits it;
- intervals resample games: 1,000 times for b, 10,000 for a mean difference, seed 0.

MA must meet every criterion; a miss stops the plan (section 7).

- **D1, information (the test's T1).** On the out-of-fold lines, in logit P(Over) = F + b·n, b's 90% interval lies wholly
  above 0.25. At least 5% of n's variance lies outside F's span.
- **D2, value at the frozen size (the test's T2).** n added to F, cross-fitted on the out-of-fold lines: the log-loss
  difference's 90% interval lies wholly below −0.0001 and Brier's below −0.00005. On no stat does the log-loss
  difference's interval lie wholly above 0.
- **D3, power.** From D1's and D2's effects and standard errors, scaled from 863 games to 1,100, T1 and T2 are each met
  with probability at least 0.8 at half the development effect. A candidate too weak to test with confidence does not
  spend the one-shot season.
- **D4, the references.** On the same out-of-fold lines, MA's chance beats DraftKings' fair chance, `tools/props.js`'s
  2024 fold and props_v2's A (its 2024 fold, as scored on 6 November 2026) on log loss and Brier, each paired interval
  wholly below 0. Necessary, not sufficient: against DraftKings this is partly E's information-free correction, which is
  why D1 and D2 exist.
- **D5, calibrated per stat, in this sense.** On each stat's out-of-fold lines:
  - (a) MA's mean chance is within 1.5 points of the Over rate;
  - (b) the slope of its recalibration (P(Over) = sigm(α + s·logit P)) has a 90% interval that reaches into
    [0.8, 1.25]. That is, MA is not clearly too sure by more than a fifth, nor too shy by more than a quarter, on any
    stat;
  - (c) a ten-band reliability table is reported beside it, with DraftKings' own.
  Points' chances sit close to 50%, so its slope is poorly measured (the stand-in's 0.64 [0.40, 0.88]).
- **D6, rivals fail on MA's own projections.** MA with its d values shuffled across players within stat and month, 20
  shuffles, fails D1 and D2 every time. The held-out rivals of section 4.3, refitted in this protocol, fail them too.
- **D7, the leak checks** of 1.5, each as stated:
  - the blindfold check, to the bit;
  - the scrambled-outcome check;
  - the loader's refusal of a seventh column;
  - the early-exit shift (minutes projected by P23's own rule) within half a point of the shift elsewhere;
  - the minutes-surprise correlation under 0.05 in size;
  - read without the points line, at least half the gain on the other stats.
- **D8, the archive, a sign check.** MA frozen on all of 2023-24, applied to the archive's six base stats (spent): T1's b
  point estimate above 0 and T2's log-loss point estimate at or below 0. The stand-in gives 1.04 [0.50, 1.58] and
  −0.00046 [−0.00142, +0.00051].
- **D9, the machinery.** These are written and tested on development data, with planted cases, and their code hashed,
  before the preregistration is committed:
  - the 2020-21 fetch, P23's fit and MA's freeze;
  - the Test step's fetch, validity checks and scorer, which must give back D1 and D2 to the digit on the development
    lines;
  - the shadow's runner.

**Where the stand-in stands** (`results/plan_tables.md` A and C; tools/props.js's 2024 fold in place of P23, so a size,
not a result). Forward-chained:
- D1: b 1.23 [1.08, 1.37], 84% of the nudge outside F;
- D2: log loss −0.00109 [−0.00136, −0.00082], Brier −0.00050 [−0.00063, −0.00038];
- D3: power at half the effect 1.00 for T1 and 0.90 for T2;
- D4: MA less DraftKings −0.00176 [−0.00219, −0.00134];
- D5: met on every stat: slopes 0.64 to 1.08; mean chance within 1.04 points of the Over rate, where DraftKings' fair
  chance is −1.68, −2.26, −2.05 and −1.93 points off on points, assists, threes and blocks;
- D6 and D7 as above;
- D8: met.

## 3. The one-shot test: DraftKings' 2022-23 regular-season lines

### 3.1 The sample

- **The lines.** DraftKings' main lines on ESPN's provider-40 feed, for every regular-season game from 18 October 2022
  to 9 April 2023. games.csv types the play-in (11 to 14 April 2023) REG; it is left out. Six base stats, both prices
  present. Fetched by `research/props_v2/fetch_dk40.js`, unchanged, through a test-only copy of `fetch_dk40_logged.sh`
  that allows this range alone (written and reviewed with the scorer), into the gitignored cache. The stamp is stripped
  (L1) and both files hashed.
- **Grading.** By the hub's rule: the Over lands when the stat is above the line; a player who did not play (minutes 0
  or flagged) is void, as DraftKings voids him; a push drops out. Every line is a half point, so none is expected.
- **Left out.** The 31 regular-season games props_v2's `espn_validate40` read whole on 5 November 2026. Their
  DraftKings aggregates were seen (3.3). The scorer lists them from that file's game ids.
- **The 2023 playoff lines stay unfetched and unseen.** This test does not use them.
- **Expected.** About 1,200 games answer (props_v2's coverage found 303 of 309 sampled; lesson P3: review found part of
  that probe's reading wrong, its count of games answering held). Less the 31, at about 80 lines a game, about 90,000
  lines, about 87,000 graded.

### 3.2 Why it is clean

No model has been scored on these prices. Nobody has read them in bulk: what was seen is the short list in 3.3, every
item a count, a status, a shape or DraftKings' own aggregate on 31 games, which are left out. Nothing MA stands on was fitted or
chosen on 2022-23 (1.4). The season's box scores are not blind: earlier fits read them, and MA's replay walks them as
history, as the rules allow. But no outcome of a 2022-23 line has entered anything MA carries.

### 3.3 Everything already seen of 2022-23, for the preregistration's list

- **props_v2, 5 November 2026:**
  - `espn_coverage`: status and item count for one game in four (309 regular-season, 21 playoff);
  - `espn_validate40`: 31 regular-season and 20 playoff games read whole. DraftKings' own log loss, Brier, Over rate,
    mean fair chance, lines a game, margins and stamps on them are committed in `results/espn_validate40.json`;
  - `espn_shape`: 11 answers read in memory for their shape, one of them a 2023 playoff game;
  - `espn_probe.sh`: status and item count.
- **The lost first run of this research:** one or two availability probes, the details lost (`lessons.md`, outside
  the repository).
- **This research's data step, 12 November:**
  - `probe_dk40_2023.js`: one request, HTTP 200, the body discarded unread;
  - its terminal showed `espn_validate40`'s and `espn_coverage`'s 2022-23 rows (props_v2's committed aggregates);
  - `data_inventory.js` read the 2022-23 box scores for their shape and counted `games.csv`'s and `odds_hist.csv`'s
    rows.
- **This plan:**
  - no 2022-23 prop line was read;
  - the terminal showed the first six rows of `data/odds_hist.csv`, which are 2022-23 consensus game lines (moneylines,
    spread and total of six opening-week games): game lines F may read at test, never fitted on;
  - `plan_sizing/rows.js` reads `odds_hist.csv` whole but parses only 2023-24's and 2025-26's rows;
  - the game ids of `espn_validate40.json` were listed to count the 31 games.
- **2022-23's box scores and finals:**
  - read by `tools/props.js`'s live constants and folds, props_v2's A and its validity check, `data/corr.json` and the
    hub's game models;
  - walked as history by every development projection here;
  - the sizing's stand-in (the 2024 fold) was fitted on them (section 6).

### 3.4 The validity checks, run first, and what each outcome decides

These run in order on the fetched lines, before any of MA's chances is computed. Each is printed as it passes; no score
is printed until all have.

- **V-fetch.** At least 900 games with lines and at least 60,000 graded lines. Below either, the test cannot reach the
  power D3 promised: VOID.
- **V-hash.** MA's frozen files, the scorer and the clean lines match the SHA-256s the preregistration records.
  Otherwise stop: nothing is scored until they do.
- **V0, V1, V2, V3.** props_v2's `validity.js`, its thresholds unchanged:
  - V0: the first item is the Over, on every stat;
  - V1: the stamps, read by this check alone, say only whether pre-game is shown (expected: not shown, inferred);
  - V2: DraftKings knows nothing of early exits: −0.05 or above, on 40 exits or more;
  - V3: DraftKings' gain over the naive forecaster against the yardstick, per stat, within its limits.
  Its projections, the naive spread and the yardstick for 2022-23 come from P23 and fits on 2021-22, never from anything
  fitted on 2022-23. This is a change of the script's inputs, written and tested on 2023-24 (where it must give back
  `data.md`'s figures with the 2024 fold) before the preregistration.
- **V4, the nudge knows no early exits.** On early exits (projected 24+ minutes by P23's own minutes rule, as V2
  projects them; played his club's previous game; played under 12), MA's frozen nudge moves the chance by no more than 0.5 points more toward the Under than elsewhere, on 40
  exits or more. On 2023-24: +0.06 against +0.02 points.
- **V5, the level can be read.** At least 90% of graded lines are on player-games with two or more posted lines (2023-24:
  99.99%).

**What each outcome decides.**
- **Any V fails: VOID.** No verdict is read, no shadow starts, and the 2022-23 lines are spent all the same: seen, they
  can test nothing again. Whether to try MA on a forward shadow instead is the owner's call, with a bar of its own.
- **All pass: the bar of section 4 is applied, once.**

## 4. The preregistered test bar

### 4.1 F, the information-free family

F is fitted on the test lines themselves, as the NFL touchdown test fits its regression's α and γ. It is the bar's
benchmark, never part of MA.

F holds every feature the named information-free rivals use, so each named rival lies in its span. It is 194 columns
(`plan_sizing/lib.js` `bigSparse`, the same code the scorer will carry).

Per stat, each column zero off its stat:
- an intercept;
- logit q, logit of the Over's implied chance, logit of the multiplicative devig less logit q, and the margin;
- the price band as six steps (q above 0.35 to 0.60: the favourite side is one);
- home;
- the season's month (November to April; October the base);
- the game total less the season's mean, and its square;
- his club's spread and its size;
- the generic position mix: his position's league rates carried to DraftKings' level like MA's mix, which uses no read of
  the player but his position;
- guard and centre;
- the line's size;
- his number of posted lines, and whether all six are posted;
- his player-game's mean logit q;
- his club's and his opponent's back-to-back.

Pooled:
- the price band's three hinges;
- a night's and a game's posted lines (their count and mean logit q);
- the line's logit q standardised within its night.

### 4.2 The criteria

n is MA's frozen nudge on each graded test line (logit P_MA − E). Both criteria must be met:

- **T1, information beyond DraftKings' price.** In logit P(Over) = F + b·n, fitted on all graded test lines (unpenalised
  but for a ridge of 0.001 on F alone, never on b, to settle F's exact collinearities):
  - b's 90% interval (1,000 resamples of games, seed 0, the fit warm-started) lies wholly above **0.25**;
  - at least **5%** of n's variance lies outside F's span (least squares of n on F). A nudge inside F has no b, and
    cannot meet T1.
- **T2, value at the frozen size.** F is cross-fitted on the test lines: 5 folds by game (the game id's FNV-1a hash mod
  5), a ridge of 5 on all but the per-stat intercepts. Each line's z is from the folds that do not hold its game. On the
  paired differences ll(sigm(z + n)) − ll(sigm(z)) and the same in Brier:
  - the log loss's 90% interval (10,000 resamples of games, seed 0) lies wholly below **−0.0001**;
  - Brier's lies wholly below **−0.00005**;
  - on no stat does the log-loss interval lie wholly above 0.

**PASS** if both are met; **FAIL** otherwise. A FAIL with T1 met is reported as "information shown, but the frozen nudge
does not help at its size". It starts nothing: a re-sized nudge would be fitted on the test season.

Nothing of MA is fitted, re-scaled or chosen on 2022-23. Only F, the bar's information-free benchmark, is fitted there,
in both criteria. That is what makes the criteria about information: whatever an information-free model could learn
from these very lines, F has learned it before n is credited with anything.

### 4.3 Why no information-free rival can meet either criterion, sized on development data

**The rivals.** Each named rival was fitted on training lines of 2023-24 as a rival would be built, on top of DraftKings'
fair chance, or fixed by its rule. Each was then held to T1 and T2 on lines it was not fitted on, in three splits:
- chronological: training to 31 January 2024, evaluation from 1 February, 508 games;
- alternate nights, both ways (574 and 542 games): the split that favours a rival most, since no season drift can hurt
  it.

The named rivals:
- R1: DraftKings' fair chance re-scaled and shifted, pooled and by stat;
- R2: another devig rule (multiplicative, power, additive, the whole margin on the Under) and a fitted one;
- R3: a prior by stat, by side (favourite, home), by price band;
- R4: a time-of-season shift by stat and month;
- R5: a night factor alone, built from every posted line;
- R7: the game lines;
- R8: a position prior;
- R9: DraftKings' posting pattern;
- R_all: all of them at once;
- the candidate with its player inputs shuffled across players (the stand-in's d shuffled within stat and month: the
  same sizes, no link to the player), 40 times.

Two further sets:
- the devig rules again, fitted the candidate's way (jointly with F);
- seven **held-out** rivals, features F does not hold, fitted the candidate's way, to size the margin against a rival
  nobody named:
  - the price band by month;
  - the day of the week;
  - home by favourite;
  - the night's, game's and player-game's posted margins;
  - the line's size in bands;
  - DraftKings' own move of the line since his last game;
  - schedule density and long rest.

`results/plan_tables.md` B has every one:

| | T1 | T2 |
|---|---|---|
| Named rivals on top of DraftKings (16) | all in F's span: no b | all hurt (upper bounds +0.0008 to +0.0098), but R4 on the chronological split, which comes out zero: its months were never in the training half |
| Devig rules the candidate's way (3) | in F's span | all hurt badly |
| Held-out rivals (7) | none met; closest the price band by month, b's lower bound 0.02 and 0.03 against 0.25 on the alternate splits | none met; closest the day of the week, upper bound +0.00009 (chronological) |
| Shuffled candidate (40) | none met; b between −0.16 and +0.16, lower bound at most −0.01 | none met; every one hurts, by +0.00075 to +0.0020 |
| The stand-in (stat mix) | met on every split: lower bound 0.73 to 1.16 | met on every split: upper bound −0.00038 to −0.00092 |

**The margins.**
- T1's 0.25 sits 0.22 above the closest information-free rival's lower bound and 0.26 above the closest shuffle's. The
  stand-in's lowest lower bound is 0.73. The 5% rule shuts out what sits nearly in F's span, where b's interval is
  enormous and could stray above 0.25 by chance: R2's power devig, on the alternate split B|A, has b = 23.6 [0.07, 47.1]
  with 0.03% of its variance outside F.
- T2's −0.0001 sits 0.00019 beyond the closest nonzero information-free rival. A rival whose nudge comes out zero fails
  it by exactly 0.0001, and the margin is there for that: no nudge, no pass. The stand-in's weakest split clears it by
  0.0003.
- Each criterion carries its margin (lesson E1: the lost run's E1 decided an outcome with none).
- Both criteria were first tried with a small F (52 columns). Three rivals then met T1 on the alternate splits:
  - month by stat: b 0.60 [0.31, 0.88];
  - the signed spread: b 1.17 [0.66, 1.68];
  - all at once: b 0.28 [0.11, 0.44].
  That is why F is their union. This is lesson P1, measured.

**What is left, said.** A rival using information-free signal F does not hold, steady across seasons and strong enough,
could still meet T1. F covers every class named here and by the lost run, and the held-out classes came nowhere near.
A pure-noise nudge meets "an interval wholly beyond 0" about one time in twenty by construction, so the margins, not the
intervals alone, carry the protection. The intervals for T1 are the game-clustered bootstrap. The sizing used the
cluster-robust standard error, which matched a 400-resample bootstrap (`results/plan_bootcheck.json`: 0.112 against
0.114).

### 4.4 Power

The stand-in's effects and standard errors, scaled to the test's 1,100 games:
- **At the full effect:** T1 and T2 are each met with probability 0.99 or more on every split.
- **At half the effect:**
  - forward-chained: 1.00 for T1, 0.90 for T2 (log loss and Brier, the lower);
  - at 900 games: 0.87;
  - on the alternate splits: 0.99/0.80 and 0.90/0.51 (`results/plan_tables.md` A).

The old model's raw disagreement, shrunk the same way, would have 0.16 at half its effect. So the mix is what makes the
test worth running. D3 asks MA's own numbers for at least 0.8.

### 4.5 Reported beside the verdict, deciding nothing

- MA's own chance (E + n, frozen) against DraftKings' fair chance, and `tools/props.js`'s P23 fold against it;
- per stat: T2, b, and D5's calibration figures and reliability table for MA and for DraftKings;
- month by month;
- the hindsight what-if (every line on the minutes played) for scale;
- **E alone against DraftKings' fair chance.** This is information-free: whether a calibrated devig beats the whole
  margin on the Over. On 2023-24, E frozen on one half against the other gave −0.00031 [−0.00070, +0.00008], −0.00052
  [−0.00088, −0.00016] and −0.00049 [−0.00090, −0.00010]. It is a question about the hub's fair-chance rule, not about
  the player, and this test does not settle it.

## 5. What a PASS starts, and what a FAIL ends

**A FAIL (or a VOID)** ends MA:
- no shadow, no change anywhere, and the 2022-23 lines are spent;
- the answer to the owner then reads: the hub's box scores add nothing to DraftKings' price that shows on a season they
  have never seen, and the page keeps DraftKings' own chance;
- any further candidate starts from development data with only forward shadows left as tests.

**A PASS** starts only a quiet forward shadow, and only once the owner says so. Nothing on the page, in the job or in
`tools/` changes. The shadow's runner lives in `research/props_v3/shadow/`, run by hand or by a workflow added in a
change of its own (the owner's call). Its rules are pinned here and copied into its bar file before it is
registered.

- **Registration.** `shadow/bar.json` (MA's frozen files and the runner, each with its SHA-256, and every number below)
  is committed and pushed before the first call. The runner's `--register` writes every rule of this section into it and
  refuses to register with any left open (the lost run left one). Its commit time is the freeze. Only regular-season
  games of 2026-27 whose scheduled tip (`games.csv`) is at least an hour after it are called.
- **The call.** For each such game, MA's chance on every DraftKings main line of the six base stats:
  - on the last `lines.json` committed to main before the tip whose read of the game (its `props.at`) is at least 10
    minutes before the tip (the job commits every read, so the read and its time are in git);
  - with the projection from `data/box_2027.csv` as committed in that same commit;
  - q_call is DraftKings' fair chance on that read.
  The runner reads every input with `git show <that commit>:<path>`, never the working tree. So it may compute a call
  after the tip, but only from what was committed before it. It records the commit and its time. A game with no such
  read has no call, and is counted. A call once computed is never recomputed.
- **The grade.** Once `data/box_2027.csv` holds the game: the Over lands when the stat is above the line; void if he did
  not play; pushes drop out.
  - The criteria compare MA with q_call, the price the call was made on: the shadow asks whether the nudge adds to
    DraftKings' price as it stood at the call;
  - DraftKings' closing fair chance (`data/props_2027.csv`) is reported beside.
- **The bar.**
  - Decided once at **40,000** graded lines, in grading order, or at the regular season's last game if fewer. Below
    20,000 it is UNDECIDED. About 56 graded lines a game, so 40,000 is about 700 games. At half the stand-in's effect,
    T2's chance there is about 0.8.
  - **PASS** only if T1 and T2 of section 4.2 hold on the shadow's lines, with F fitted on them, and the same numbers
    (0.25, 5%, −0.0001, −0.00005, no stat's interval wholly above 0). The game lines in F are the read's own total and
    spread.
  - Reported beside, deciding nothing: MA against q_call, D5's calibration per stat, and MA against the closing price.
- **Futility stop.** At 15,000 graded lines, if T2's log-loss interval lies wholly above 0 (the frozen nudge clearly
  hurts), the shadow stops as a FAIL. That is the only early verdict, and it can only fail.
- **What its verdict does.**
  - A shadow PASS makes MA a candidate to be shown on the page as "DraftKings' price, nudged by the hub's read of the
    player", by a change of its own and the owner's call. Nothing moves by itself.
  - A shadow FAIL ends MA.
- **The off switch.** The owner may stop the shadow at any time; it then has no verdict. Games missed while it is off are
  never called.

## 6. Every choice made on development data

- **The design.** The lost first run chose MA over M (minutes first, with honest uncertainty) and G-mix (a learned
  gradient-boosting distribution with a fixed blend toward DraftKings), after sizing all three on development data, on 11
  November 2026. This run did not size M or G-mix again.
- **MA's form.**
  - The stat mix over the raw disagreement: chosen on 2023-24, where the mix stand-in's development effect was about 2.5
    times the raw one's and its power at half the effect 0.90 against 0.16.
  - The level part left out: it did a little worse on every split of round 1.
  - One weight per stat. Points set to 0 if its nudge does not help on development data (1.1, step 6).
- **The level's weights.** The precision of DraftKings' implied mean, at that mean. The stand-in weighted at the model's
  mean, which depends on its minutes; MA's choice makes the level independent of any minutes figure.
- **E's form.** Per stat an intercept, logit q and logit of the Over's implied chance, with a ridge of 5. Chosen after
  seeing DraftKings' fair chance under-say the Over by about 2 points on four stats on 2023-24, and its slopes move from
  split to split.
- **F's composition.** The union of the named rivals' features, plus the posting indicator and rest. Chosen after round
  1 showed three rivals meeting T1 with a smaller family. The held-out rivals were then chosen to size the margin.
- **The bar's numbers.** b above 0.25 with 5% outside F; −0.0001 and −0.00005; 90% intervals; 5 folds and a ridge of 5
  for the cross-fit; 1,000 and 10,000 resamples. All sized on 2023-24 (section 4.3).
- **The sizing's splits and the development bar's protocol.** Chronological at 1 February, alternate nights, months
  December to April.
- **The power standard.** D3's 0.8 at half the effect, with the 1,100 and 900 games of 3.1.
- **P23.**
  - `tools/props.js`'s structure, which was itself chosen on its 2024 fold: 2023-24's box scores, with constants fitted
    on 2022-23. The structure, not its constants, so said. Refitted on 2021-22 alone.
  - The nominal 30 minutes.
- **The secondaries.** Their list, order and rule (1.3), and whatever they turn out to admit.
- **The hub's fair-chance rule** (the whole margin on the Over), chosen on the archive, which is spent.
- **The test's sample.** The window, the 31 games left out, the 2023 playoffs left unfetched.
- **The validity checks.** props_v2's thresholds (set on the archive); V4's half point and V5's 90%, from 2023-24's
  figures.
- **The shadow's rules** (section 5), including its 40,000, 20,000 and 15,000.
- **The sizing's stand-in.** `tools/props.js`'s 2024 fold, fitted on 2022-23 box scores and projected on each game's
  list of who dressed (hindsight, which the mix's level cancels but for the level's weights), used to size everything
  above. No candidate stands on it, but the choices it informed were made with it, and are listed here for that reason.
- **The archive** was used as a sign check (D8): its lines are spent, its result is a sign.

## 7. What would stop early

- **Before the test.**
  - Any of D1 to D9 missed with MA's own projections: no test. MA is reported as not worth the one-shot season, with its
    numbers.
  - A leak check failing: stop, fix, run the whole development bar again from the start. The fix is listed as a choice;
    if it changes MA's form, every D is met again.
  - The preregistration's audit finding a hole: fixed and audited again before any 2022-23 line is fetched.
  - A reason, after the freeze, to change any of MA's files or the bar: the test is not run on that preregistration. A
    new one is written and audited.
- **At the test.**
  - V-fetch or a validity check failing: VOID (3.4).
  - The scorer stopped part way, by a usage limit or a lost container: it is run again, unchanged, on the same
    hash-checked files. A test is scored once by one preregistered scorer on one fixed set of lines, and running that
    deterministic function to its end is not a second score.
  - A scorer that cannot run without a change: the change is committed with its reason and audited before any number is
    printed.
  - A mistake found after the verdict: the verdict stands as recorded. A correction is published beside it with both
    numbers. A correction may turn a PASS into a FAIL, never a FAIL into a PASS.
- **During the shadow.** The futility stop, the owner's call, or the job's reads stopping. A gap is never filled in
  afterwards from later reads.

## Files and re-running

From the repository's root, after `node research/props_v3/lines_clean.js` (`data.md`):

| Command | What | Time |
|---|---|---|
| `node research/props_v3/plan_sizing/rows.js` | every posted 2023-24 and archive line, with the stand-in's projection, into `cache/plan_sizing/` | about 10 s |
| `node research/props_v3/plan_sizing/size.js` | round 1, the small family → `results/plan_sizing.json` | about 3 minutes |
| `node research/props_v3/plan_sizing/leakcheck.js` | is the mix an artefact → `results/plan_leakcheck.json` | about 10 s |
| `node research/props_v3/plan_sizing/size2.js` | round 2, the bar on F, every rival and the shuffles → `results/plan_sizing2.json` | about 3 minutes |
| `node research/props_v3/plan_sizing/boot_check.js` | the robust interval against the bootstrap → `results/plan_bootcheck.json` | about 5 minutes |
| `node research/props_v3/plan_sizing/tables.js` | every sizing table → `results/plan_tables.md` | a second |

`plan_sizing/lib.js` holds the shared code: the features, F, the fits (Newton's method, sparse, a ridge where said), the
cluster-robust standard error, the cross-fit, and T1 and T2. Every random draw is seeded. The result files hold
aggregates only: no line, price or player id.
