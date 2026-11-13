# The plan for MA: DraftKings' price, nudged by the hub's read of the player

Research only, 12 November 2026, revised 13 November after an independent critique (section 8 lists what it found, how
each point was checked and what changed), and revised again on 13 November after a review of MA's development results
(section 9: T1 made independent of the nudge's scale, and the test's machinery fixed; no criterion loosened, D8 kept as
written). The owner asked (11 November): "i also want to figure out why the model
failed and if we can build a more reliable one." `why_it_failed.md` is the first half. This is the plan for the second:
one candidate, MA, how it is built, the bar it must meet on development data before anything is spent, the one-shot test
on DraftKings' 2022-23 lines and the bar written for it, and what a pass or a fail leads to. **Nothing here is the
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
  shuffled copies of the candidate were tried, and none met either. That held only at each rival's own fitted size:
  T1's weight bar moves with the nudge's scale, so a rival shrunk far enough clears it with no information in it. Since
  13 November T1 also asks the weight to stand four standard errors clear of zero, which no rescaling changes
  (section 9).
- **The odds, honestly.** The stand-in meets the bar on every development split. At half its development effect it would
  pass a test the size of 2022-23's (1,100 games at 74 graded lines a game) about 0.87 of the time by the development
  bar's protocol, about 0.74 if 2022-23's prices are as unlike 2023-24's as the 31 games of it already seen suggest (far
  more lines priced away from even), and five to eight times in ten by the alternate-nights splits. But it was fitted
  on 2022-23 box scores, so it is no candidate. MA's own projections are fitted on 2021-22 alone and will be weaker, and
  2022-23 is a different season. The development bar must be met again with them before the test is spent. A small,
  real edge on the small stats, or nothing, are the likely answers. Beating DraftKings on points is not.
- **What a pass starts.** Only a quiet forward shadow on 2026-27 games (and 2027-28's, if it needs them to reach its
  size) called after the freeze. Nothing on the page changes.
- **"More reliable."** MA must also be not clearly too sure, and not clearly worse calibrated than DraftKings' own fair
  chance, on any stat (D5). It is called calibrated only on a stat where that is shown, its slope measured close to 1;
  on points neither MA's chance nor DraftKings' can be shown calibrated on 2023-24, where nearly every line sits close to
  even. On 2023-24 the hub's fair chance (the whole margin on the Over) under-says the Over by 1.7 to 2.3 points on four
  stats, which MA's information-free part corrects. That correction needs no player information, and on the 31 games of
  2022-23 already seen the Over landed 1.9 points *under* DraftKings' fair chance, so it may well run the wrong way there.
  It is a question about the hub's devig rule, reported and deciding nothing here (section 4.5).

## 1. The candidate

### 1.1 What MA computes

For each game, on DraftKings' main lines of the six base stats (points, rebounds, assists, threes, steals, blocks):

1. **DraftKings' fair chance** q on each posted line, from its two prices by the hub's rule: the whole margin on the Over
   (fair Over = 1 − the Under's implied chance).
2. **The projection layer, P23.** For every player DraftKings posted a line for, his mean on each of the six stats and its
   negative-binomial spread, from his earlier games alone, for the club whose box last listed him (1.5). These are
   `tools/props.js`'s own pieces and code: his rate per
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
lines are on player-games with two or more lines. A player with no game played on record has no projection: his lines
stay in the sample with n = 0, MA being E there too.

The weights w_s are fitted jointly with the information-free family F of section 4.1 as controls, so they carry only
what F does not; E is then fitted with the frozen n as an offset.

### 1.2 Every input, and why it is known before tip-off

| Input | Where it comes from | Why it is known before tip-off | Never read |
|---|---|---|---|
| DraftKings' two prices on each line | provider 40's closing lines (backtest); the job's read before tip (shadow) | posted before tip-off | the feed's `last_updated` (an outcome: `data.md` section 1), ESPN's `lastUpdated` |
| His other posted lines in the game (for κ) | the same feed | every line posted, whatever is graded later | which of them are graded, voided or pushed |
| His rates, his position, the opponent's allowed rates, pace | box scores of games strictly before this game's date | earlier games: the replay takes a day's features before its results, as `tools/props.js` does | the game's own box (who dressed, who started, minutes, did-not-play reasons) and any later box |
| Which players to project | DraftKings' posted lines | the lines name them | the game's box (the stand-in projected the box's list; MA may not) |
| His club for the game, so his opponent, home and away, his club's spread and rest | the club whose box last listed him, dressed or not, on an earlier date; the game's two clubs from its id and `games.csv` | earlier boxes and the published schedule | the game's own box (the stand-in took his club from it: critique C5) |
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
enters them. Drift between seasons can hurt a backward test or help it (were DraftKings weaker on steals in 2022-23,
say, the nudge would look stronger there than it is now; the plan said until 13 November that drift could never help,
which was wrong: critique C2). F, fitted on the test lines, takes out any shift in DraftKings' level or price mix, but not
a change in what the nudge's information is worth. P23 is fitted on 2021-22 for both
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
  input and chance is recomputed from a data folder holding only (a) the box scores of earlier dates, (b) the six-column
  lines of the game's night, (c) `games.csv`'s rows to that night with that night's scores taken out (read by the replay
  for the order of games, by MA for the game's two clubs, and by F for rest), and (d) `odds_hist.csv`'s rows of that
  night's games (read by F alone, for the game's total and spread; never by MA), and must be the same to the bit. Every
  graded outcome scrambled must change no input or chance.
- **The club (critique C5).** A player's club for a game is the club whose box last listed him on an earlier date,
  dressed or not. A line whose player has no box on record, or whose club on record is neither of the game's two clubs
  (his first game after a trade or a summer move), is left out of the sample, development and test alike: on 2023-24
  that is about 317 graded lines on 55 player-games by the replay's own count of first games for a new club, plus any
  debut. The rule reads earlier boxes and the game's id alone; the game's own box never says who is in the sample.
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
- the months' out-of-fold lines (about 69,000 on 863 games: every graded line of the sample of 1.5, a line with no
  projection at n = 0) are scored together;
- F is cross-fitted on them, as the test fits it;
- intervals resample games: 1,000 times for b, 10,000 for a mean difference, seed 0.

MA must meet every criterion; a miss stops the plan (section 7).

- **D1, information (the test's T1).** On the out-of-fold lines, in logit P(Over) = F + b·n, b's 90% interval lies wholly
  above 0.25, **and z = b / SE is at least 4**, SE being the standard error that interval implies ((hi − lo) / 3.29).
  At least 5% of n's variance lies outside F's span. (The z part was added on 13 November, section 9: b and its
  interval scale as 1/c when n is multiplied by c, so the 0.25 alone checks the frozen nudge's size, and a rival shrunk
  far enough meets it; z does not move with c.)
- **D2, value at the frozen size (the test's T2).** n added to F, cross-fitted on the out-of-fold lines: the log-loss
  difference's 90% interval lies wholly below −0.0001 and Brier's below −0.00005. On no stat does the log-loss
  difference's interval lie wholly above 0.
- **D3, power.** From D1's and D2's effects and standard errors, scaled to 1,100 games at 74 graded lines a game (the
  rate props_v2's committed 31 games of 2022-23 show, against about 80 on the development lines), each standard error by
  the larger of the two scalings, games and lines (critique C1: a sample with fewer lines a game than the development
  lines is noisier than its games alone say), T1 and T2 are each met with probability at least 0.8 at half the
  development effect, T2's chance being that of both its criteria at once (log loss and Brier, drawn together with the
  game sums' own correlation; until 13 November the lower of the two). A candidate too weak to test with confidence does
  not spend the one-shot season. Reported beside, deciding nothing: the same at 900 games, and with the effect reweighted
  to the price mix of 2022-23's 31 seen games (critique C2).
- **D4, the references.** On the same out-of-fold lines, MA's chance beats DraftKings' fair chance, `tools/props.js`'s
  2024 fold and props_v2's A (its 2024 fold, as scored on 6 November 2026) on log loss and Brier, each paired interval
  wholly below 0. Necessary, not sufficient: against DraftKings this is partly E's information-free correction, which is
  why D1 and D2 exist.
- **D5, not clearly miscalibrated per stat, in this sense** (strengthened on 13 November: critique C3). On each stat's
  out-of-fold lines:
  - (a) MA's mean chance is within 1.5 points of the Over rate;
  - (b) the slope of its recalibration (P(Over) = sigm(α + s·logit P)) has a 90% interval that reaches into
    [0.8, 1.25]. That is, MA is not clearly too sure by more than a fifth, nor too shy by more than a quarter, on any
    stat;
  - (b') **and** MA's slope is not clearly further from 1 than DraftKings' own fair chance's on the same lines by more
    than 5%: the 90% interval (1,000 resamples of games, seed 0, both slopes refitted in each) of |ln s_MA| − |ln s_DK|
    does not lie wholly above ln 1.05. MA may not be shown calibrated where it is plainly worse calibrated than the
    price it starts from;
  - (c) a ten-band reliability table is reported beside it, with DraftKings' own.
  (a), (b) and (b') decide. **What may be claimed** is narrower than what passes: MA is called *calibrated* on a stat
  only where its slope's point estimate lies in [0.8, 1.25] and its 90% interval wholly inside [0.67, 1.5]; a stat that
  passes but is not so measured is reported as *poorly measured*, with its slope, never as calibrated. Points' chances
  sit close to 50%, so its slope is poorly measured (the stand-in's 0.64 [0.40, 0.88]; DraftKings' own 0.77 [0.50,
  1.04]).
- **D6, rivals fail on MA's own projections.** MA with its d values shuffled across players within stat and month, 20
  shuffles, fails D1 and D2 every time; so does MA with its d values shuffled within matched cells (stat × month ×
  position × price band × line), 20 shuffles (critique C4: such a shuffle keeps whatever the cells' own mean
  disagreement carries, which is no read of the player, and on the stand-in kept a b of about 0.07, its highest lower
  bound 0.07, so the margin against it is about 0.18 where the coarse shuffles' was 0.26). The named rivals (on top of
  DraftKings' fair chance) and the held-out rivals of section 4.3, with the critique's three (DraftKings' own other lines
  for the player, their sizes and prices; the same by position; the pairwise products of F's continuous features), all
  refitted in this protocol, fail them too, and so do (since 13 November, section 9) two of them shrunk to as little as
  0.3 of their fitted size and four sets of rivals fitted with a ridge on their own columns (`ma/dev_scale.js`). The
  shuffles' and rivals' T1 intervals use the cluster-robust standard error (`results/plan_bootcheck.json`: within 2%
  of the bootstrap's), and any whose lower bound comes within 0.05 of 0.25, or whose z comes within 0.5 of 4, the
  other part met or near, is taken again by the 1,000-resample bootstrap.
- **D7, the leak checks** of 1.5, each as stated:
  - the blindfold check, to the bit, its folder as 1.5 says;
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
    lines; and (since 13 November, section 9) the fetch's gate and public record, the left-out games and V-hash, each
    held to planted cases in sandbox repositories (`test/machinery_check.js`), since a scorer that gives back D1 and D2
    on the development lines never runs the test's own path;
  - the shadow's runner;
  - **planted in-game prices** (critique C7): on the development lines, at 10% and at 20% of player-games, one of the
    player's posted stats repriced as a price read a quarter of the way into the game would be (props_v2's
    `validity_calib.js` rule: DraftKings' own pre-game distribution, the stat so far a binomial share of the final, the
    rest at the pre-game rate, his night known done where it ended before then), his other lines left as they were. V2
    lets about a fifth of lines read so pass (its own calibration: −0.23 a line read at a quarter, against a floor of
    −0.05), so V4 must react at those shares: where it does not, V4's threshold is tightened, or a check of the nudge's
    gain on early exits against its gain elsewhere is added, its threshold set on the planting, before the
    preregistration is written. How far the plants move the nudge's T2 is reported.

**Where the stand-in stands** (`results/plan_tables.md` A and C; tools/props.js's 2024 fold in place of P23, so a size,
not a result). Forward-chained:
- D1: b 1.23 [1.08, 1.37], 84% of the nudge outside F;
- D2: log loss −0.00109 [−0.00136, −0.00082], Brier −0.00050 [−0.00063, −0.00038];
- D3: power at half the effect 1.00 for T1 and 0.87 for T2 by the revised rule (0.90 as first written; 0.81 at 900
  games, 0.74 at 2022-23's seen price mix: `results/plan_power_rev.json`);
- D4: MA less DraftKings −0.00176 [−0.00219, −0.00134];
- D5 as first written: met on every stat: slopes 0.64 to 1.08; mean chance within 1.04 points of the Over rate, where
  DraftKings' fair chance is −1.68, −2.26, −2.05 and −1.93 points off on points, assists, threes and blocks. Under (b')
  the stand-in's points (0.64 against DraftKings' 0.77) may well fail; its other stats are level with DraftKings' or
  closer to 1;
- D6 and D7 as above;
- D8: met.

## 3. The one-shot test: DraftKings' 2022-23 regular-season lines

### 3.1 The sample

- **The lines.** DraftKings' main lines on ESPN's provider-40 feed, for every regular-season game from 18 October 2022
  to 9 April 2023. games.csv types the play-in (11 to 14 April 2023) REG; it is left out. Six base stats, both prices
  present. Fetched by `research/props_v2/fetch_dk40.js`, unchanged, through a test-only copy of `fetch_dk40_logged.sh`
  that allows this range alone (written and reviewed with the scorer), into the gitignored cache. The stamp is stripped
  (L1) and both files hashed. Since 13 November (section 9, F3) the fetch's gate and record are public: the wrapper
  (`test/fetch_dk40_2023_logged.sh`, through `test/fetch_record.js`) refuses a preregistration whose audit does not name
  the SHA-256 of the PREREG.md and PREREG_HASHES.json it audited, or names others than the commit holds; it commits and
  pushes the fetch's start (`test/fetch_2023.json`) to origin before the first request, refuses to fetch again once
  origin holds a record (any branch, any commit: a wiped cache cannot hide one), lets an interrupted fetch be run again
  only under the same preregistration, and lets a cache lost after the fetch be fetched again only with
  `PROPS_V3_RECOVER=1`, its clean lines then required to come out byte for byte as recorded. When the fetch ends the
  cleaner runs and the record is finished, with the SHA-256 of the fetched csv, its reads, the request log, the clean
  lines and their starts, and pushed.
- **Grading.** By the hub's rule: the Over lands when the stat is above the line; a player who did not play (minutes 0
  or flagged) is void, as DraftKings voids him; a push drops out. Every line is a half point, so none is expected.
- **Left out.** The 31 regular-season games props_v2's `espn_validate40` read whole on 5 November 2026. Their
  DraftKings aggregates were seen (3.3). The scorer reads them from that file's `games[].gid` and refuses to score
  unless they are exactly the 31 game ids committed in `test/seen_2023.json`; it prints how many were left out, and how
  many of their lines dropped, before any other number. (Until 13 November it read `Object.keys` of that array, which
  gives its indices: it would have left out none. Section 9, F1.)
- **The 2023 playoff lines stay unfetched and unseen.** This test does not use them.
- **The club.** By 1.5's rule: a line whose player has no club on record that is one of the game's two clubs is left
  out, so a player's first game after a trade or a summer move is not scored (on opening week of 2022-23, every player
  who changed clubs over the summer).
- **Expected.** About 1,200 games answer (props_v2's coverage found 303 of 309 sampled; lesson P3: review found part of
  that probe's reading wrong, its count of games answering held). Less the 31, at the 74 graded lines a game the 31
  show (2023-24's development lines: about 80), about 86,000 graded.

### 3.2 Why it is clean

No model has been scored on these prices. Nobody has read them in bulk: what was seen is the short list in 3.3, every
item a count, a status, a shape or DraftKings' own aggregate on 31 games, which are left out. Nothing MA stands on was
fitted or chosen on 2022-23 (1.4). The season's box scores are not blind: earlier fits read them, and MA's replay walks
them as history, as the rules allow. But no outcome of a 2022-23 line has entered anything MA carries.

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
- **What those committed aggregates show of 2022-23's prices** (critique C2; read again, those figures alone, by the
  critique and by this revision): on the 31 games, 2,305 graded lines, DraftKings priced far more lines away from even
  than in 2023-24. The share of lines with a fair chance of 40 to 60% was, 2022-23 against 2023-24's 29 sampled games:
  points 0.92 against 1.00, rebounds 0.68 against 0.91, assists 0.45 against 0.83, threes 0.36 against 0.70, steals 0.25
  against 0.58, blocks 0.12 against 0.31. And the Over landed 36.4% of the time where DraftKings' fair chance said 38.3%
  (in 2023-24's sample 44.6% against 44.0%; on all of 2023-24 the fair chance under-says the Over by 1.7 to 2.3 points on
  four stats). So E, which corrects 2023-24's under-said Over, may move 2022-23's chances the wrong way, and no level or
  calibration claim is assumed to carry over (4.5). T1 and T2 do not depend on it: F is fitted on the test lines. The
  points lines priced away from even, about 8% at the test, are all but untested on 2023-24 (21 lines).
- **This plan:**
  - no 2022-23 prop line was read;
  - the terminal showed the first six rows of `data/odds_hist.csv`, which are 2022-23 consensus game lines (moneylines,
    spread and total of six opening-week games): game lines F may read at test, never fitted on;
  - `plan_sizing/rows.js` reads `odds_hist.csv` whole but parses only 2023-24's and 2025-26's rows;
  - the game ids of `espn_validate40.json` were listed to count the 31 games.
- **This plan's critique and revision, 12 and 13 November:** the critique printed `espn_validate40.json`'s committed
  2022-23 aggregates (over rates, mean fair Over, shares 40 to 60%, per-stat log losses on the 31 games) and
  `espn_coverage.json`'s monthly 2022-23 item medians; the revision printed again the first of these (graded lines and
  games, over rate and mean fair Over, and by stat the lines, over rate, mean fair Over and share 40 to 60%), and
  `plan_sizing/power_rev.js` reads the graded lines, games and by-stat lines and shares to size the power. No 2022-23 prop
  line, and nothing else of 2022-23, was read.
- **MA's development step and its review, 13 November** (`dev_results.md`): no 2022-23 prop line was read. The
  development step's replay walked 2022-23's box scores as history. The review counted `espn_validate40.json`'s game
  ids by season and type (51 of 2022-23, 31 of them regular-season in the window); its fix wrote those 31 ids into
  `test/seen_2023.json` (game ids alone); `test/machinery_check.js` feeds the scorer's pieces made-up rows only; and the
  fix step's terminal showed the first two rows of `data/odds_hist.csv` (2022-23 consensus game lines of two
  opening-night games, as this plan's own step had shown six).
- **2022-23's box scores and finals:**
  - read by `tools/props.js`'s live constants and folds, props_v2's A and its validity check, `data/corr.json` and the
    hub's game models;
  - walked as history by every development projection here;
  - the sizing's stand-in (the 2024 fold) was fitted on them (section 6).

### 3.4 The validity checks, run first, and what each outcome decides

These run in order on the fetched lines, before any of MA's chances is computed. Each is printed as it passes; no score
is printed until all have.

- **V-hash** (revised 13 November, section 9, F4). Every input is hashed as it stands on disk and must equal a recorded
  SHA-256, the records coming from two places, each read from git, never from a file in the working tree or the cache:
  - **from the preregistration commit** (`git show <prereg>:research/props_v3/PREREG_HASHES.json`, written by
    `test/inputs.js --write`): every input `test/inputs.js` requires, as it stood when the preregistration was written:
    the frozen candidate; every module of this repository the scorer loads (read off Node's module cache) and the
    fetch's machinery; and the data the replay and F read, the 2020-21 boxes (gitignored: a re-fetch must give back these
    very bytes), `data/box_*` and `teambox_*` of 2021-22 to 2025-26, `games.csv`'s rows of those seasons,
    `odds_hist.csv`'s rows of 2022-23, the left-out list and its source, and V0 to V3's thresholds. A list that does not
    name every required input, or any input whose bytes moved, stops the scorer;
  - **from the fetch's finished record on origin** (`test/fetch_2023.json`, pushed after the fetch, since the
    preregistration is committed before the lines exist): the clean lines' and starts' SHA-256; and the fetched csv, cut
    by the cleaner's own rule, must give back the clean lines byte for byte.
  Otherwise stop: nothing is scored until they do. (Until 13 November V-hash read PREREG_HASHES.json from the working
  tree, passed an empty list, held the clean lines to a sibling file the cleaner wrote in the same gitignored cache, and
  hashed no data.)
- **The left-out games** (3.1), printed with V-fetch before any number.
- **V-fetch.** At least 900 games with lines and at least 60,000 graded lines. Below either, the test cannot reach the
  power D3 promised: VOID.
- **V0, V1, V2, V3.** props_v2's `validity.js`, its thresholds unchanged:
  - V0: the first item is the Over, on every stat;
  - V1: the stamps, read by this check alone, say only whether pre-game is shown (expected: not shown, inferred);
  - V2: DraftKings knows nothing of early exits: −0.05 or above, on 40 exits or more;
  - V3: DraftKings' gain over the naive forecaster against the yardstick, per stat, within its limits.
  Its projections, the naive spread and the yardstick for 2022-23 come from P23 and fits on 2021-22, never from anything
  fitted on 2022-23. This is a change of the script's inputs, written and tested on 2023-24 (where it must give back
  `data.md`'s figures with the 2024 fold) before the preregistration.
- **V4, the nudge knows no early exits.** On early exits (projected 24+ minutes by P23's own minutes rule, as V2
  projects them; played his club's previous game; played under 12), MA's frozen nudge moves the chance by no more than
  0.5 points more toward the Under than elsewhere, on 40 exits or more. On 2023-24: +0.06 against +0.02 points. Its
  threshold, and whether a check of the nudge's gain on early exits joins it, are fixed by D9's planted in-game prices
  before the preregistration (critique C7).
- **V5, the level can be read.** At least 90% of graded lines are on player-games with two or more posted lines (2023-24:
  99.99%).
- **V6, the price mix, reported (deciding nothing).** Each stat's share of test lines by price band (fair chance in the
  six steps of F) beside 2023-24's, and the power at half the development effect reweighted to the test's own mix, so the
  report says plainly how unlike the development lines the test lines were (critique C2).

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
  - b's 90% interval (1,000 resamples of games, seed 0, the fit warm-started) lies wholly above **0.25**: a check of
    the frozen nudge's size, which means what it says only for a nudge fitted unpenalised at its own scale, as MA's is
    (b and its interval scale as 1/c when n is multiplied by c);
  - **z = b / SE is at least 4**, SE the standard error b's own 90% interval implies, (hi − lo) / 3.29: the check of
    information, which no rescaling of n moves (added 13 November, section 9);
  - at least **5%** of n's variance lies outside F's span (least squares of n on F). A nudge inside F has no b, and
    cannot meet T1.
- **T2, value at the frozen size.** F is cross-fitted on the test lines: 5 folds by game (the game id's FNV-1a hash mod
  5), a ridge of 5 on all but the per-stat intercepts. Each line's f is from the folds that do not hold its game (f
  was written z until 13 November, when T1's z took the letter). On the paired differences ll(sigm(f + n)) −
  ll(sigm(f)) and the same in Brier:
  - the log loss's 90% interval (10,000 resamples of games, seed 0) lies wholly below **−0.0001**;
  - Brier's lies wholly below **−0.00005**;
  - on no stat does the log-loss interval lie wholly above 0.

**PASS** if both are met; **FAIL** otherwise. A FAIL with T1 met is reported as "information shown, but the frozen nudge
does not help at its size". It starts nothing: a re-sized nudge would be fitted on the test season. (Since 13 November
"information shown" asks T1's z as well: as first written a rival shrunk far enough could have earned the label.)

Nothing of MA is fitted, re-scaled or chosen on 2022-23. Only F, the bar's information-free benchmark, is fitted there,
in both criteria. That is what makes the criteria about information: whatever an information-free model could learn
from these very lines, F has learned it before n is credited with anything.

### 4.3 Why no information-free rival can meet either criterion, sized on development data (revised: section 9)

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
  stand-in's lowest lower bound is 0.73. **These margins hold at each rival's fitted, unpenalised size only** (the
  review of 13 November, section 9): b and its interval scale as 1/c when a nudge is multiplied by c, so a rival whose
  lower bound is above 0 clears 0.25 once shrunk enough, and on MA's development lines five of 24 scaled and regularised
  rivals did. The margin no rescaling moves is T1's z: the highest information-free z there is 2.85 against the bar's 4
  (`results/ma_dev_scale.json`, `ma_dev_rivals.json`); MA's own is 13.7. The 5% rule shuts out what sits nearly in F's
  span, where b's interval is enormous and could stray above 0.25 by chance: R2's power devig, on the alternate split
  B|A, has b = 23.6 [0.07, 47.1] with 0.03% of its variance outside F.
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

The stand-in's effects and standard errors, scaled to the test's 1,100 games at 74 graded lines a game, each standard
error by the larger of the games' and the lines' scalings, and T2's chance that of both its criteria at once
(`results/plan_power_rev.json`; revised 13 November, critiques C1 and C2):
- **At the full effect:** T1 and T2 are each met with probability 0.99 or more on every split.
- **At half the effect:**
  - forward-chained: 1.00 for T1, 0.87 for T2 (0.89 on log loss alone, 0.88 on Brier alone); as first written, by
    games alone and the lower of the two, 0.90 (T1 here is its weight bar; with the z part added on 13 November, MA's
    own figures give 0.997 both parts at once, the weight bar alone binding: `dev_results.md` D3);
  - at 900 games: 0.99 and 0.81;
  - reweighted to the price mix of 2022-23's 31 seen games (each stat's lines priced 40 to 60% or not, each cell's
    effect its development one: 0.88 of the log-loss effect and 0.86 of Brier's): 1.00 and 0.74 at 1,100 games, 0.99 and
    0.67 at 900;
  - on the alternate splits (games alone, as first sized): 0.99/0.80 and 0.90/0.51 (`results/plan_tables.md` A).

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
  the player, and this test does not settle it. Said in advance: on the 31 games already seen, 2022-23's Over landed
  under DraftKings' fair chance, where 2023-24's landed over it, so E may well do worse than DraftKings' fair chance on
  the test; that would say E's correction does not carry across seasons, and nothing about the nudge.

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
  refuses to register with any left open (the lost run left one), the grading order among them (below). Its commit time
  is the freeze. Only regular-season games of 2026-27 and, if the shadow has not reached its size by 2026-27's last
  regular-season game, of 2027-28, whose scheduled tip (`games.csv`) is at least an hour after it are called.
- **The call.** For each such game, MA's chance on every DraftKings main line of the six base stats:
  - on the last `lines.json` committed to main before the tip whose read of the game (its `props.at`) is at least 10
    minutes before the tip (the job commits every read, so the read and its time are in git);
  - with the projection from `data/box_2027.csv` as committed in that same commit;
  - q_call is DraftKings' fair chance on that read.
  The runner reads every input with `git show <that commit>:<path>`, never the working tree. So it may compute a call
  after the tip, but only from what was committed before it. It records the commit and its time. A game with no such
  read has no call, and is counted. A call once computed is never recomputed.
- **The grade.** Once the season's box file holds the game: the Over lands when the stat is above the line; void if he
  did not play; pushes drop out. **Grading order** (critique C6), which decides which lines are the first 15,000 and
  the first 65,000: by the time of the first commit to main whose box file holds the game, then the game's scheduled
  tip, then its game id, the player's id and the stat. `--register` refuses a bar file without it.
  - The criteria compare MA with q_call, the price the call was made on: the shadow asks whether the nudge adds to
    DraftKings' price as it stood at the call;
  - DraftKings' closing fair chance (`data/props_2027.csv`) is reported beside.
- **The bar.**
  - Decided once at **65,000** graded lines, in grading order, or at 2027-28's last regular-season game if fewer.
    Below 20,000 then it is UNDECIDED. About 56 graded lines a game, so 65,000 is about 1,160 games: more than a season
    leaves after a freeze in its autumn, so the shadow will most likely run into 2027-28. At half the stand-in's
    effect, T2's chance (both criteria) is 0.80 there, sized by lines a game as well as games
    (`results/plan_power_rev.json`; critique C1). The plan said until 13 November "40,000 ... about 0.8", which scaled by
    games alone: at 40,000 lines it is 0.62 (0.65 on log loss alone).
  - **Said in advance, against the shadow.** It is called on the job's read of DraftKings' lines (provider 100, the last
    read at least 10 minutes before tip, which can be hours before), not the closing provider-40 lines MA was fitted on;
    and P23's constants, fitted on 2021-22, will then be five and six seasons old. Both are expected to weaken the nudge
    against its development size; the shadow is the frozen candidate as it is, not a refreshed one.
  - **PASS** only if T1 and T2 of section 4.2 hold on the shadow's lines, with F fitted on them, and the same numbers
    (0.25, z 4, 5%, −0.0001, −0.00005, no stat's interval wholly above 0). The game lines in F are the read's own total and
    spread.
  - Reported beside, deciding nothing: MA against q_call, D5's calibration per stat, and MA against the closing price.
- **Futility stop.** At 15,000 graded lines in grading order, if T2's log-loss interval lies wholly above 0 (the frozen
  nudge clearly hurts), the shadow stops as a FAIL. That is the only early verdict, and it can only fail.
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
  for the cross-fit; 1,000 and 10,000 resamples. All sized on 2023-24 (section 4.3). T1's z of at least 4, and the
  bootstrap taken again where a rival's z comes within 0.5 of it, were chosen on 13 November (section 9) on development
  data, after MA's development figures (its z 13.7) and D6's rivals' (the highest 2.85) had been seen.
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
- **The shadow's rules** (section 5), including its 65,000 (40,000 until 13 November), 20,000 and 15,000, and its
  grading order.
- **The revision of 13 November** (section 8): every change it made was chosen after the critique and after these
  development numbers: D3's scaling by lines and both T2 criteria at once, with 74 lines a game taken from props_v2's
  committed 31 games of 2022-23; D5(b') and its 5% (a tolerance chosen so that a calibration step too small to matter does
  not decide, and so that a chance nearly a fixed transform of DraftKings', where the interval of the difference is very
  narrow, is held to a difference that matters), and the claim's band [0.67, 1.5]; D6's matched shuffles and the
  critique's three rivals; the club rule; D9's planted prices at 10% and 20% and a quarter of the game; V6.
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
  - The fetch stopped part way, by a usage limit or a lost container: run again under the same preregistration, which
    the public record allows (3.1); never under another. A cache lost after the fetch finished: fetched again only with
    `PROPS_V3_RECOVER=1`, and scored only if its clean lines come out byte for byte as the record holds them; if they do
    not, nothing can be scored on that preregistration.
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

## 8. The critique of 12 November, checked, and what changed

An independent critic read the plan as committed (376c393) and raised seven points (C1 to C7), each with a script in a
scratch folder outside the repository. Each was checked here before anything changed: its code read, and its numbers
reproduced with code of this folder's own where they decide something (`plan_sizing/power_rev.js`) or by running the
critic's own script and reading the files it cites. All seven are real. None was refuted outright; one fix was taken in
part, said below. No criterion was loosened.

- **C1 (should): the shadow's power was overstated. Real.** The plan scaled the development standard error by games
  alone, but the shadow has about 56 graded lines a game where the development lines have 80. `power_rev.js` draws the
  shadow's samples game by game with 56 of each game's lines: at 40,000 lines and half the stand-in's effect T2's chance
  is 0.65 on log loss, 0.62 on Brier and 0.62 for both at once (the critic's 0.648, 0.624 and 0.617, within 0.001),
  where the plan's games-only scaling gave 0.79 and 0.77. Changed: the shadow is decided at 65,000 graded lines (0.80 for
  both criteria at half the effect), over 2026-27 and 2027-28 if needed; its two handicaps are said in advance (the read
  hours before tip on provider 100; P23's constants five and six seasons old). D3 now scales the test's standard errors
  by lines as well as games, at the 74 graded lines a game 2022-23's seen games show, and asks for both T2 criteria at
  once: 0.87 for the stand-in at half its effect (0.90 as first written).
- **C2 (should): already-seen aggregates show 2022-23 priced differently. Real.** props_v2's committed
  `espn_validate40.json` (31 games, left out of the test, already in 3.3's list) shows far more lines priced away from even
  in 2022-23 than in 2023-24, and an Over rate under DraftKings' fair chance where 2023-24's is over it (3.3 gives the
  figures). Reweighting the stand-in's effect stat by stat to that price mix leaves 0.88 of its log-loss effect (the
  critic's −9.56 against −10.89 × 0.0001, reproduced). Changed: 3.3 lists the evidence; 4.4 and D3 report the reweighted
  power (0.74 at half the effect); 4.5 says in advance that E and any level or calibration claim may not carry over; the
  sentence in 1.4 that drift could only hurt a backward test is corrected; V6 reports the test lines' price mix. The
  points lines priced away from even are noted as all but untested in development.
- **C3 (should): D5 passed a noisy stat and the claim was overstated. Real.** As written, D5(b) passes whenever the
  slope's interval touches [0.8, 1.25], so an imprecise stat passes more easily, and the stand-in passed on points at 0.64
  [0.40, 0.88], an interval excluding 1, worse than DraftKings' own 0.77; across the splits 0.59 to 1.41 all passed.
  Changed: D5 adds (b'), that MA's slope be not clearly more than 5% further from 1 than DraftKings' own on the same
  lines, which only strengthens it; and what may be claimed is narrowed: "calibrated" only where the slope's point lies in
  [0.8, 1.25] and its interval inside [0.67, 1.5], else "poorly measured"; the plain-English text says so. Taken in part:
  the critic's fix would also make that positive evidence a condition of the bar on every stat. It is not one, because
  on points DraftKings' own fair chance fails it on these very lines (0.77 [0.50, 1.04]): there it would measure the
  noise of near-even lines, not MA. The bar holds MA to not clearly too sure, and not clearly worse calibrated than the
  price it starts from, on every stat; the claim holds it to positive evidence.
- **C4 (nit): a matched shuffle keeps a little b. Real.** Shuffling the stand-in's d within stat × month × position ×
  price band × line keeps a b of about 0.07 on average with no read of the player (26 seeds on the chronological split:
  b −0.06 to +0.25, lower bounds up to +0.068, every one hurting on T2 by 0.0006 to 0.0012; reproduced with the critic's
  script). The bar holds, with a margin of about 0.18 against that rival. Changed: D6 adds 20 matched shuffles, and the
  critic's three further rivals, which by the critic's figures met neither criterion on the stand-in (DraftKings' own
  other lines for the player: b −0.04 [−0.33, 0.25]; by position: −0.07 [−0.30, 0.17]; the pairwise products of F's
  features: 0.04 [−0.11, 0.19]; not re-run here on the stand-in), are run against MA's own projections. The critic's
  further check, that MA's own level weights keep the stand-in's effect (b 1.33 against 1.23), is the critic's figure;
  MA's own numbers are in `dev_results.md`.
- **C5 (nit): the club came from the game's own box. Real.** The stand-in's rows took a player's club, and so home and
  away, his spread and rest, from the game's box; on 2023-24, 317 graded lines on 55 player-games are a player's first
  game for a new club, where his last box names the wrong club (reproduced). Changed: the club rule of 1.5 (his last
  club on an earlier box; a line where that is not one of the game's clubs left out), and the blindfold folder holds the
  schedule and the game lines, each input that reads them named.
- **C6 (nit): the shadow's grading order was open. Real.** Many games are graded in one commit of the box file. Changed:
  the order is pinned (section 5) and `--register` refuses a bar file without it.
- **C7 (nit): V4 was not tied to the contamination V2 lets through. Real.** By `validity.js`'s own calibration, about a
  fifth of lines read a quarter of the way into their games would still pass V2's floor, and V4's half point had no
  planted case. Changed: D9 plants in-game prices on 10% and 20% of player-games (one stat moved, the player's others
  not) and V4 must react, or be tightened or joined by a check of the nudge's gain on early exits, before the
  preregistration.

## 9. The review of 13 November, checked, and what changed

Two reviewers read MA's development results as committed (c3e9a5c), one for leakage and the protocol, one for the
statistics, and raised eleven findings, F1 to F7, S1, S2, N1 and N2, each with a probe in a scratch folder outside the
repository. Each was checked here before anything changed, by reading the code it cites and by reproducing its numbers
with this folder's own code (`ma/dev_scale.js`, `ma/dev_review.js`, `test/machinery_check.js`; their results in
`results/`). All eleven are real; none was refuted. No criterion was loosened, and D8 is kept as written, so MA's
verdict is unchanged: it does not meet the development bar (`dev_results.md`), and the 2022-23 lines stay unfetched.

- **F1 (blocking): the scorer would have left none of the 31 seen games out. Real.** `score.js --test` built its
  left-out set from `Object.keys` of `espn_validate40.json`'s `games`, which is an array: the keys are its indices, none
  matches a game id, and the set was empty, so the one-shot test would have scored the 31 games whose DraftKings
  aggregates had been seen, V0 to V3 included. `--dev-check` never runs that path. Changed (3.1, 3.4): the set is read
  from `games[].gid` (51 of 2022-23, 31 of them regular-season games in the window), the 31 ids are committed in
  `test/seen_2023.json`, the scorer refuses unless the two agree exactly, and it prints the left-out count before any
  number. `test/machinery_check.js` holds it: the set read by `gid` is the committed 31 (`Object.keys` gave 0), and fed
  made-up rows of the 31, of three other games, a play-in game and a game of 2023-24, the scorer's line filter keeps the
  three alone.
- **F2 (should): T1's 0.25 moves with the nudge's scale. Real.** Multiplying n by c divides b and its interval by c and
  leaves its share outside F as it was, so any rival whose lower bound is above 0 at its fitted size clears 0.25 once
  shrunk, with no player information. Nine of D6's 66 rivals have a lower bound above 0. On MA's development lines
  (`results/ma_dev_scale.json`): DraftKings' own move of the line since his last game (U9) at 0.4 and 0.3 of its fitted
  size has b 1.23 [0.27, 2.20] and 1.65 [0.36, 2.93] by the robust error, and [0.258, 2.941] by the bar's own
  1,000-resample bootstrap at 0.3 (z 2.02, under 4); MA's d shuffled within matched cells (seed 13) at 0.4 and 0.3, 0.60
  [0.25, 0.94] and 0.80 [0.34, 1.26]; and a rival fitted with a ridge of 1,500 on its own columns (a dummy for each line
  value by price band cell, with U9 and home by favourite), 1.42 [0.26, 2.58] robust (its bootstrap, the reviewer's,
  [0.20, 2.57]). Five of the review's 24 scaled and regularised rivals meet D1 as first written; none meets D2. So 4.3's
  "no information-free rival can meet either criterion" held only at each rival's fitted size, and "information shown"
  could have been earned with none. Changed (2, 4.2, 4.3, 4.4, 5, 6): T1 and D1 also ask **z = b / SE at least 4**, SE =
  (hi − lo) / 3.29 from b's own interval, which no rescaling moves; the 0.25 stays, as the check of the frozen nudge's
  size, said to mean what it says only for a nudge fitted unpenalised at its own scale, as MA's is; a rival near either
  part is bootstrapped; D3's T1 is both parts at once. Why 4: with no information z reaches 4 about three times in
  100,000; the highest z of an information-free rival on development data is 2.85 (the matched shuffle, seed 13, whose
  cells' mean disagreement carries some signal with no read of the player), which a steady information-free effect would
  carry to about 3.1 at the test's size (the square root of the ratio of lines); the regularised rivals reach 2.08; and
  at half MA's development effect on a test the size of 2022-23's, T1's weight part binds, not z (power 0.997 both
  parts, 0.997 the weight alone, 1.000 z alone), so the power D3 promised is unchanged. MA's own z is 13.7. Not taken:
  the likelihood-ratio form the reviewer offered, which for one weight is z squared and would add nothing.
- **F3 (should): the test fetch's gate had three gaps. Real**, each reproduced in a sandbox on the wrapper as first
  written (the machinery check's B0.1 to B0.4): an audit not tied to the PREREG.md it audited (one edited after its
  audit passed); a once-only guard that was a marker in the gitignored cache, which a lost container, the first run's
  fate, wipes (with the cache wiped the fetch ran again); and that marker written before the fetch began, so an
  interrupted fetch could be finished only by deleting the very marker that guards against a second one. Changed (3.1,
  7): `test/fetch_record.js` and the wrapper. The audit must name the SHA-256 of the PREREG.md and PREREG_HASHES.json it
  audited, held to the commit's; the fetch's start is committed and pushed to origin before any request, and origin's
  record (every commit that ever held it, any branch) refuses a second fetch; an interrupted fetch is run again only
  under the same preregistration, fetch_dk40.js keeping what an earlier read found by its own rule; a cache lost after
  the fetch is fetched again only with `PROPS_V3_RECOVER=1`, its clean lines then held byte for byte to the record; and
  the record is finished with every file's SHA-256, then pushed. Held by the machinery check's cases B1 to B13 (no
  preregistration, one not pushed, an audit naming no hashes, a PREREG.md edited after its audit, the sound run with its
  start on origin before the stand-in fetched, a second run, a run after the cache was wiped, a recovery byte for byte
  and one that is not, an interrupted fetch resumed, another preregistration, the cleaner with no record). A force-push
  that rewrote origin's history could still hide a record; this research never force-pushes.
- **F4 (should): V-hash pinned little. Real**, reproduced in a sandbox: it read PREREG_HASHES.json from the working tree,
  so a frozen file edited with that file rewritten to match passed; an empty list passed; the clean lines were held to
  a sibling .sha256 the cleaner wrote into the same gitignored cache, so both replaced together passed; and no data
  input was hashed, nor could the plan's version have been built, since the preregistration is committed before the
  lines exist. Changed (3.4): `test/inputs.js` lists every input (every module the scorer loads, read off Node's module
  cache; the fetch's machinery; the 2020-21 boxes, the boxes of 2021-22 to 2025-26, the rows of `games.csv` and
  `odds_hist.csv` the test reads, the left-out list and its source, V0 to V3's thresholds), `--write` puts them in
  PREREG_HASHES.json for the preregistration commit, and V-hash reads that file by `git show <prereg>:`, refusing a list
  that misses any required input or any input whose bytes moved; the clean lines and starts are held to the SHA-256 in
  the fetch's finished record on origin, and the fetched csv, cut by the cleaner's rule, to the clean lines;
  `ma/freeze.js` records the same inputs. Held by the machinery check's cases C1 to C6, each of the review's three
  passing the old rule and refused by the new.
- **F5 (nit): "it does not know how many minutes anyone played" overstated. Real.** The minutes surprise's correlation,
  0.028, has a 90% interval of [0.012, 0.044] by 2,000 game resamples: under D7's 0.05, not zero. No leak (the blindfold
  check holds every input pre-game); `dev_results.md` says the link is small.
- **F6 (nit): "its information shows" on the archive. Real.** D8 asks only b's point above 0. By T1's own standard the
  archive's b, 0.78 [0.244, 1.316], does not clear 0.25, and its z, 2.40, does not reach 4. `dev_results.md` says so.
- **F7 (nit): P23's fit said nothing of 2022-23 was in memory. Real.** `loadData` reads every season first and the fit is
  handed a copy of 2020-21 and 2021-22 alone, refusing any later game. Its header says that now.
- **S1 (should): D8's sign turns on the cross-fit's split. Real**, reproduced in this folder's code: on 40 other random
  splits of the archive's 83 games into five folds T2 averages −0.0000062 with a spread of 0.000050, twice the miss, and
  is above 0 on 40% of them (the reviewer's 40 in numpy: 42.5%); on ten folds −0.000062, one game at a time −0.000013;
  on development data the spread is 0.0000035. And F, cross-fitted on 83 games, is a poor reference: log loss 0.6776 a
  line against DraftKings' 0.6718. **D8 is kept as written** (the reviewer's advice too): its split was fixed before any
  score, and choosing another, or averaging over many, after seeing this one miss would turn a FAIL into a PASS on a
  rule chosen after the score. `dev_results.md` section 5 reports it as context. For a later plan, not this one: a sign
  check on a set this small should be read over many splits, or against DraftKings' price, chosen before it is scored.
  On a test of about 1,100 games the split's spread is as small as on the development lines.
- **S2 (should): the per-stat claims ignored multiplicity. Real.** Rebounds' and assists' 90% intervals cleared 0 by 0.2
  × 10⁻⁴; with another seed rebounds' reaches 0, and corrected for five stats (98%) both span it, while threes, steals
  and blocks stay below 0. `dev_results.md` says the gain is clear on those three and not established on rebounds and
  assists. D2's rule (no stat's interval wholly above 0) is unaffected.
- **N1 (nit): "within 2 points in every band" was pooled only. Real.** Stat by stat MA's worst band of 100 lines or more is
  assists' 0.3-0.4 (416 lines, 5.2 points, about 2.2 standard errors). Said in `dev_results.md` section 3.
- **N2 (nit): E alone's intervals. Real.** Log loss −0.00032 [−0.00065, −0.000005], only just clear of 0; Brier
  −0.00012 [−0.00026, +0.00002], spanning 0. Both now given wherever the 0.0003 is.

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
| `node research/props_v3/plan_sizing/power_rev.js` | the revision's power, by lines a game as well as games, for the test and the shadow (critiques C1, C2) → `results/plan_power_rev.json` | about 2 minutes |
| `node research/props_v3/ma/dev_scale.js` | the review's F2: scaled and regularised information-free rivals on MA's development lines, D1 as first written and as strengthened → `results/ma_dev_scale.json` | about 20 minutes |
| `node research/props_v3/ma/dev_review.js` | the review's S1, S2, N1, N2 and F5 checked → `results/ma_dev_review.json` | about a minute |
| `node research/props_v3/test/machinery_check.js` | the review's F1, F3 and F4: the test's machinery on planted cases in sandbox repositories → `results/ma_machinery_check.json` | seconds |

`plan_sizing/lib.js` holds the shared code: the features, F, the fits (Newton's method, sparse, a ridge where said), the
cluster-robust standard error, the cross-fit, and T1 and T2. Every random draw is seeded. The result files hold
aggregates only: no line, price or player id.
