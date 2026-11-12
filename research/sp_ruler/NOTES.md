# wip/sp-engine: the ruler search (engine step) -- where this attempt is

Started 12 Nov 2026 16:00 UTC from origin/main aed2605. Dev scratch (not committed): scratchpad/spfilter/dev/.

Plan (decided after measuring the copula primitives in jsdom on 10 Nov's files):
- spOrth(3) 59 us, spOrth(4) 780 us, spOrth(5) 11.3 ms; the builder's GHK (sgJoint) 18/22/34 ms for 3/4/5 legs; joint2 1.7 us.
- data/corr.json: player-player |rho| <= 0.039 (mates), <= 0.019 (opponents); player-team up to 0.17; side-total ~0.
- 10 Nov games: 120-175 legs each, 68-99 Unders (d 1.42 to 2.21, none heavier than -236), Overs e 0.86-0.91, team e ~0.955.
Engine design:
- Delta = ln(D/F) + sum of unit losses, every unit (a leg alone, or a game's group) returns <= 1 (singles) or <= HOLD (groups).
- Singles: per game Pareto frontier (d up, p up); a suffix table B[j][t][cell] = max sum ln c over t legs of games j.. with
  rounded-up log prices (a relaxation, so a valid upper bound) including each game's groups relaxed at HOLD / price; DFS
  with B as the bound, near-best pruning (eta < ETA).
- Groups: within a game, legs by chance; pairs exact (joint2), 3-5 legs spOrth +-0.1% then the builder's GHK; first-order
  Plackett bounds on J and C for the last leg; return bound HOLD.
- Certificate by size: hi[k] (proven upper bound on C*_k), lo[k] (found); rule out k when hi[k] < (1-TAU+ETA) Lo; settle
  k when lo[k] >= (1-ETA) hi[k] and lo[k] >= (1-TAU) max hi; a counted work budget, never a clock.

## 17:20 UTC: dev engine in research/sp_ruler/dev/ (ruler_search.js, ruler_pool.js; h1.js runs 10 Nov's cuts)
Default filters, 10 Nov 21:57 files: the night settles in ~140 ms (three levels); every one-game cut settles, 0.12-0.45 s
for three levels (MIL_NYK the slowest, 442 ms). Fixed so far: side-side correlation excluded from the group bounds
(one side a group), exact per-group G for impure legs (R10), cells tight, -Inf bounds pruned, a probe before the
near-best search, groups worked lazily in the order of their pairwise estimate, last leg by a window on byP.
Next: two-game cuts (F8 slow), filter cases, the best found kept when the work runs out, port into suggested.html.

## 19:40 UTC: bound fixes; two-game cuts settle
Fixed: a game's group cap used the pure bound with no pure leg in it; a partial group did not carry its impure legs'
factors; the one-factor composition undercounted when a leg's team link was below its mate link. Default filters: all 15
two-game cuts settle, 65-210 ms for three levels; night filter cases settle (players, teams, no unders, -300, -200) but
Overs only at Aggressive, which needs 26M work units (45 s): 4 legs 8.0749% @8.026. Next: keep the best found with its
proven gap when the work runs out, count gv/cap per call, the conditional-sd step of R10, the fixture nights.

## 21:00 UTC: R10 tightened; the work runs out on a best found
A group must hold at least s - nPure impure legs, so its bound carries gm^(that many) (Overs-only or no-unders games: every
leg impure): Overs-only Aggressive on the night settles in 0.37 s (was 45 s). R10's g now takes the conditional sd
(a at its least over sigma in [sqrt(1 - s^2), 1]); TH 1/16 fixed (every cut a level meets is over it); the return tables
come in two tiers (groups landing TH or more, at R10; any group at HOLD while the cut is under TH). The search descends
from each size's bound (1%, 2%, 4%... under it), after a probe for a first parlay; the work runs out on the best found
and the last bound proved. Work counted per call (deterministic whatever the caches hold), costs recalibrated (two
integrals a group). Non-PD games: pair bounds at max(rho,0)/min(rho,0); no one-factor cap past 0.81.
Default: every level of the night and every 1/2-game cut of 10 Nov settled (night 0.18 s for three levels; MIL_NYK alone
0.36 s). Overs only and no unders: the night settles; 21 and 25 of the 1/2-game cut Aggressives stop at the budget
(1e6 units, about 1 s) with a parlay and a proven gap (worst 12% and 33%).

## 18:00 UTC: shipped in suggested.html (not wired), held and timed
THE RULER SEARCH is in app/parts/suggested.html with its proof (R1-R11); the dev copies are gone from the branch.
tools/test_suggest_ruler.js: (i) 171 levels held to the rule by full enumeration (made-up nights, a non-PD table, team
legs of real 2- and 3-game cuts), the three planted errors each caught (113, 78 and 16 failures); (ii) 1,533 levels
timed (7 Nov, 10 Nov 17:00, 10 Nov 21:57; whole, every game, every two games; seven filter cases): every default level
settled, the nights' three levels 45-182 ms, the slowest level 652 ms; 150 levels on Overs-only and no-Unders cuts
stop on the work with a proven gap (worst 39%). engine.md has the tables; timing.json the rows.

# wip/sp-one-ruler: the build step (wiring the ruler, the filters, the record) -- where this attempt is

## 18:10 UTC 12 Nov: started
Branch wip-sp = origin/main 0cc6014 + merge origin/wip/sp-engine (d2b36f8) + merge origin/wip/sp-evidence (c8d763c).
Scratch: .../scratchpad/spfilter/repo (this clone). Next: read README "Suggested Parlays", suggested.html, the guard.

## 19:25 UTC: the page wired (not yet the record, the guard or the tests)
Design: the page is clock-gated at SP_RULER_FROM (placeholder 2026-11-13T15:00Z): from it, live sets (the site's at the
default filters, and "Your filters" sets) are the ruler's, built a piece a task (SP_RB cache, spSoft); before it main's
search, byte for byte. Heads: chance 'fair' (SP_RULER_LEVELS) for the ruler's levels. Filters in M.sp (normMine keeps it).
Record: spEntry takes the ruler's set at the default filters from the cutoff, kept pool spPoolOutRuler (team legs + the
levels' player legs + the levels' same-game groups). Tests can move the cutoff by rewriting the page copy's constant
(and the guard's by SUGGEST_RULER_FROM, still to write). Dev scratch: ../b2 (boot.js, t_tab.js, patch/).
Next: the guard (RULER_FROM, own DP bound, property check), suggest_ledger.js take, then the tests.

## 19:15 UTC (clock said 19:1x): the record and the guard
suggest_check.js: RULER_FROM (placeholder 2026-11-13T15:00Z, SUGGEST_RULER_FROM moves it for tests), NIGHT_LEVELS_RULER
(heads chance 'fair'), TAU_G 0.01, rulerOk/rulerLateOk (cutoff both ways, held as the file holds it), teamOwn/glOwn (own
team reading), nightPoolRuler, rulerBound (staged DP: legs alone; if under HOLD/F then exact pairs, the HOLD envelope
capped by one-factor Slepian bounds, exact triples where few), rulerPays, rulerLevelBad (property), rulerFull,
rulerEntryBad, nightUpdatesBad (split out). Measured (b2/t_bound.js): bound/level <= 1.006 on all 219 real cuts (whole
nights <= 0.06%; one-game $4 up to 0.6%, the roof HOLD/F), slowest 0.86 s. suggest_ledger.js: ready() checks the ruler
levels and cutoff, plants made-up filters in the boot's storage, takes no unsettled set, rebuild passes chance.
Scratch record run with the cutoff moved back: 12 Nov rewritten under the ruler, guard 0 failures.
Next: tests (test_suggest_ledger: old sections run with the cutoff moved to the future via SUGGEST_RULER_FROM and the page
copy; new section R), smoke_suggested (old sections the same; a ruler + filters section), speed, README.

## 19:25 UTC: the tests

- tools/test_suggest_ledger.js: every section before R runs with the cutoff far ahead (SUGGEST_RULER_FROM, the page copied
  with its SP_RULER_FROM moved the same); R (R1-R8) holds the ruler's take by its own enumeration of every parlay, the
  cutoff both ways and on the real record, the guard's breaks and TAU_G itself, ties among Unders at +100, a rebuild after
  the lock under each rule, the kept pool, one game, and a night with a level not settled never taken; G at the real
  cutoff. 380 checks passed.
- tools/smoke_suggested.js: section 9 (one ruler and your filters) on a made-up night built for the filters (DF) and on
  D1, D2 and D3; section 8 property-checks the real night with the guard once the page's cutoff has passed.
- Found by section 9: on DF (three games, short Unders at -241/-384/-385) the default filters' Aggressive does not settle
  within SPR_WORK; the job then takes no set for such a night. An empty level not settled now keeps gap 1 in the record
  shape (spTierOut) so the job never takes it; its words "Not settled within the search's work on ...".

## 20:05 UTC: the guard's bound, the breaks, the job run, the README

- test_suggest_ruler.js part (iii) found the guard's bound under the page's level on 6 one-game cuts: the legs it was
  handed carried no player's club, and the correlations (mate or opponent, a player's club against a team leg) read it.
  With the clubs the bound holds on all 219 settled real levels (at most 0.596% over, within TAU_G, slowest 0.82 s) and is
  at C* or more on the 163 enumerated pools. The record's kept pool carries no club, so the guard now works its bound only
  on its own reading of the run's files (a set the run took, a level the run built again), and holds a set the file it is
  held to holds as it is to its pool alone: that also keeps the record step from working every past set again each run.
- Planted breaks: all caught (counts in README, The checks). The record's test missed the fewest legs reversed until R9
  (the pair of Unders at -241 against the likelier triple) was added.
- Scratch job run (jobrun, the cutoff 18:37 UTC for the run): the job rewrote 12 November's set under the ruler in 1.07 s
  with its guard; the levels and four filter cases are in the report.
- Screenshots: shots/sp_390_*.png and sp_1280_*.png (Chromium, 10 November's files at 21:55 UTC).

# The review's findings (S-1..S-5, F1..F3): where this attempt is (21:40 UTC 12 Nov)
Scratch harness: ../fix (the reviewers' scripts pointed at this clone; sites/ = their 14 nights' pre-lock files).
- S-5 (real, nit): the frontier kept a dearer leg tied on chance over a lower-keyed one; now a leg is dropped only for one
  likelier, or as likely with a lower key. The reviewer's tie case and fuzz seeds 12, 13 pass.
- S-1 (real): NOP at GSW alone (9 Nov) $4 needs 5.37M units, ORL at UTA (11 Nov) $8 1.78M; every one of the 90 real one-game
  cuts settles under 2e7 (one_2e7.out). The site's set (default filters: the record's and the page's copy) now has
  SPR_WORK_SITE 2e7, other filters SPR_WORK 1e6.
- F1 (real): the search is a generator now (sprLevel; spRulerLevel drains it): the soft build runs SPR_SLICE (2e4) units a
  task; identical levels and work on 1,533 timed levels and 132 real cuts, +1-5% time.
Next: the guard (S-2 exact singles/pairs, S-4 witnesses), replaceRuledOut (S-3/F2), tests, F3, README, the final check.
## 22:30 UTC: the guard (S-2, S-4), the rebuild (S-3/F2), the ruler test
- S-2 (real): the guard's legs alone, and with pairs, now walked exactly (rbExact: the cells only cut, each parlay held to
  its own price); 30 Oct's IND_MIA+DEN_PHX job run takes the night (was refused). Return bound + RB_TIE in the walk.
- S-4 (real): rulerWitness: the exact walk's likeliest of each size j < k (singles; pairs too on 3 games or fewer) and k;
  refuses (3) at (1 - TAU + ETA) of the bound and (4) over the level by ETA; the filler case refused, the pair passed.
- guard_all.out: 1,203 real levels (14 nights, every cut, the site's work): 0 refusals, slowest bound 654 ms, witness
  206 ms, never capped.
- S-3/F2 (real): replaceRuledOut keeps the locked level where the rebuilt one has a gap (said); SP_RB_WORK reaches
  spRebuild; test_suggest_ledger R5's new case.
- test_suggest_ruler: nov9one/nov11one fixtures, the site's work at the default filters with half of it as headroom, a
  slice part, the tie case; RULER_ONLY takes a list (the job: enum,site,slice).
Next: R9's guard plant (fewest legs reversed), F3 workflow, README, smoke, full suite, planted breaks, the final check.
## 21:43 UTC: every finding fixed, each held and planted
Plants (each fix taken back out in a scratch copy; the record's test 394 passed on a control copy): S-5 ruler 1, S-1
ruler 8, F1 ruler 2, S-2 ruler 1 (near miss), S-4 record 1, S-3 gap record 1, the knob record 1, F3 record 1.
Chromium (fix/lt.js, lt2.js on main's 20:55 files, the cutoff moved): 1x every press's longest task 52 ms (was 188),
every one- and two-game cut at Overs only and Player unders off none over 50 ms (was up to 285); 4x at 390 wide the
longest 155 ms (was 783 to 1063). Next: the final check (rebase on main, RULER_FROM, one commit).

## 22:14 UTC 12 Nov: the final check, squashed into ade9ee4 on wip/sp-one-ruler
- On main 243d6af (the 20:55 UTC update): the change's 20 files (this file left out), the pages rebuilt, unchanged on
  a second build. RULER_FROM 2026-11-13T04:00:00Z, for 13 November's night (9 games, first tip-off 00:00 UTC on the
  14th, lock 22:00 UTC on the 13th); 12 November's night locked at 22:00 UTC, before the commit.
- Words: no line of the change says an Under returns $1 or its dollar, or calls Unders even-return (README, engine.md,
  the page's and the guard's comments, two test names); the pages rebuilt and every test run again on them: the ruler
  test 4446, the record's 394, the speed test 137, the smoke all good, every other test all good.
- Scratch job (fix/jobrun_at.sh, the cutoff at 21:00 UTC for the run): at 22:11 UTC the file byte for byte (12 Nov
  locked, 13 Nov with no DraftKings line yet), the guard 0 failures; at 21:59 UTC only 12 Nov's entry rewritten under
  the ruler, the guard 0 failures (Safe Wade u1.5 3PM -237 + Irving u1.5 stl -244, 49.88% at 2.005; Medium Martin u5.5
  PR +100 + O'Neale u1.5 3PM +100, 25% at 4.00; Aggressive those two + Walter u5.5 AR +100, 12.5% at 8.00).
- This branch (the milestones and these notes) is kept at wip/sp-one-ruler-dev; wip/sp-one-ruler is the one commit.
