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
