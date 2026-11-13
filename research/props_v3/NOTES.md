# Where this step is (PLAN.md for MA)

- 12 Nov 2026 22:55 UTC: plan_sizing/ rows.js, lib.js, size.js, leakcheck.js written and run on development data
  (2023-24 lines, the archive as a sign check); results/plan_sizing.json and plan_leakcheck.json. The stat-mix nudge
  (DraftKings' level, the hub's mix) is the strong stand-in; the small information-free family lets month x stat,
  signed spread and the all-rivals rival meet T1 on the alternate-nights split, so the family must be the union of the
  rivals' features. Next: size.js on that family (sparse fits), the held-out rivals, then PLAN.md.
- 12 Nov 2026 23:45 UTC: round 2 (size2.js) on the union family F (194 columns: every named rival's features, the
  posting indicator and rest), the held-out rivals and the shuffles; boot_check.js; tables.js draws
  results/plan_tables.md. No rival meets T1 (b above 0.25, 5% outside F) or T2 (below -0.0001 log loss, -0.00005
  Brier); the stat-mix stand-in meets both on every split. Next: PLAN.md itself.
- 13 Nov 2026 00:00 UTC: PLAN.md written (the candidate, its folds and guards, the development bar D1-D9, the one-shot
  test on DraftKings' 2022-23 lines with its validity checks, the bar T1/T2 with every rival sized, the forward
  shadow's pinned rules, every development choice, what stops early). Next step: build MA (the 2020-21 fetch, P23,
  the screening) and run the development bar on its own projections.
- 13 Nov 2026 00:05 UTC: the critique of PLAN.md (C1 to C7) checked: all seven real (C1 and C4 reproduced with the
  critic's scripts and C1, C2 with plan_sizing/power_rev.js -> results/plan_power_rev.json; C2's committed 2022-23
  aggregates read again, disclosed in PLAN.md 3.3; C3, C5, C6, C7 read in the files they cite). PLAN.md revised
  (section 8 says what changed): the shadow decided at 65,000 lines, D3 by lines and both T2 criteria at once, D5(b'),
  matched shuffles and three more rivals in D6, the club rule, the shadow's grading order, planted in-game prices in D9,
  V6. fetch_box2021.js (the 2020-21 box scores for P23's warm-up) is running into cache/box2021/. Next: P23's fit,
  MA's rows, the development bar.
- 13 Nov 2026 00:30 UTC: the 2020-21 boxes fetched (1,171 games, 1,341 requests all HTTP 200, logged in
  cache/box2021/requests.tsv; the six play-in boxes carry no minutes and are left out). P23 fitted on 2021-22
  (ma/p23_fit.js -> results/ma_p23.json; ma_lib.js's replay checked row for row against tools/props.js's). MA's rows
  built (ma/ma_rows.js: 91,901 of 92,295 posted 2023-24 lines in the sample, 88,739 graded; the club rule leaves out
  394). D4's references cached (ma/refs.js). ma/dev_bar.js (D1 to D5) running. Next: D6 rivals, D7 leak checks, D8.
- 13 Nov 2026 00:35 UTC: ma/dev_bar.js (D1 to D5) done -> results/ma_dev_bar.json: points' weight 0 by the rule, no
  secondary admitted (teammates out clearly hurt), D1 b 1.218 [1.073, 1.365], D2 -0.00112 [-0.00140, -0.00083], D3
  0.867 both T2 criteria at half the effect, D4 against all three references, D5 on every stat (points poorly
  measured). D6 (dev_rivals.js) and D7 (dev_leaks.js) running; dev_archive.js (D8) and freeze.js written; the test
  step's fetch wrapper written and its refusals tried (it fetched nothing). Next: D8, then D9's validity checks,
  scorer, planted in-game prices and shadow runner.
- 13 Nov 2026 00:45 UTC: D6 met (66 rivals, none meets D1 or D2: closest T1 lower bound 0.109, matched shuffles at
  most 0.101), D7 met (blindfold and scramble to the bit on 210 games, early exits, minutes surprise 0.028, without
  points 0.87 of the gain). D8 NOT MET: on the spent archive the frozen nudge's T2 point estimate is +0.000025
  [-0.00096, +0.00102] where the bar asks for 0 or below (b 0.78 [0.24, 1.32]). So MA does not meet the development
  bar as written and the 2022-23 test is not spent. Planted in-game prices: V2 and V4 do not react (the plants push the
  nudge toward the Over and cost it: T2 -0.00042 at 10%, +0.00023 at 20%). validity_ma.js gives back validity.js's
  2023-24 figures exactly. score.js --dev-check running. Next: dev_results.md.
- 13 Nov 2026 00:57 UTC (a retry of this step, continuing from the notes above, which the earlier attempt timed ahead
  of its commits): the earlier results checked against their scripts; dev_results.md drafted (the verdict: MA meets D1
  to D7 and misses D8, so it does not meet the development bar as written; D9 left part built; no 2022-23 line
  fetched). A correction: the 2020-21 fetch made 1,362 requests (191 scoreboard days, 1,171 summaries), all HTTP 200,
  not 1,341. freeze.js run: frozen/ma_frozen.json, a record of MA as D8 scored it (its weights equal D8's), its files
  hashed; no test follows from it. score.js --dev-check re-run (the earlier run was cut off). Next: its result, then
  commit and push.
- 13 Nov 2026 01:02 UTC: score.js --dev-check done (16 minutes): it gives back ma_dev_bar.json's D1 and D2 to the digit
  through the scorer's own path, V4 and V5 hold on the development lines (results/ma_score_devcheck.json).
  dev_results.md finished and README.md written for the folder. The step's verdict: MA does not meet the development
  bar as written (D8 missed), so the 2022-23 test is not spent. Nothing outside research/props_v3/ changed.
- 13 Nov 2026 02:40 UTC (the review's fix step; a fresh start, nothing of it on wip/props-v3 before): the review's
  findings checked. F1 real (score.js read Object.keys of espn_validate40.json's games array: 0 games left out, where
  31 must be), F3 and F4 real (the gate took an audit untied to PREREG.md, a cache marker as the only once-guard, and
  V-hash a working-tree hash list, an empty list, a sibling .sha256 and no data), F7 real (p23_fit.js's header). Fixed:
  score.js (by gid, test/seen_2023.json's 31, vHash), test/fetch_record.js (the public start and finish on origin),
  the wrapper, the cleaner, test/inputs.js (every input hashed, data too), freeze.js; test/machinery_check.js holds them
  to 22 planted cases in sandbox repositories: all as expected. F2 real: T1 now also asks z = b / SE >= 4
  (dev_lib.js); dev_rivals.js re-run (every earlier figure the same; highest z 2.85, 9 rivals with a lower bound above
  0); dev_bar.js re-running, dev_scale.js (scaled and ridge rivals) running; dev_review.js (S1, S2, F5, N1, N2) next.
  This step's terminal showed the first two rows of data/odds_hist.csv (2022-23 consensus game lines of two
  opening-night games), as the plan's own step did; no 2022-23 prop line was read.
