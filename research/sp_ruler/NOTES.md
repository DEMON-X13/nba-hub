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
