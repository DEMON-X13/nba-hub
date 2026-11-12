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
