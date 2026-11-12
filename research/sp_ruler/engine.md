# The ruler search

The engine for Suggested Parlays' sets taken from `RULER_FROM`: one ruler (DraftKings' fair chance, `legFair`) for every
leg, every level the likeliest parlay that pays its floor, under the rule below, on the visitor's filters. It lives in
`app/parts/suggested.html`, section THE RULER SEARCH, whose comment is the proof; it is **not wired** yet (`spSet`, the
tab and the record still run THE SEARCH, and every set taken before `RULER_FROM` keeps it byte for byte). Its test is
`tools/test_suggest_ruler.js`; 10 November's pre-lock pool is `tools/fixtures/sp_ruler_nights.json`.

## Interface

```js
const pool = spRulerPool(N, filters);   // N a night (spNightOf / spTakes); filters as the Parlay Builder's choices:
                                         // { k: { ml, ats, total, over, under } (false = box off), off: [game ids unticked],
                                         //   st: [stats off], short: null | -500 | -300 | -200 (the shortest leg allowed) }
                                         // -> { games, legs, band, far: 0, noId, vig, filt, pl, u, rule: 'fair' }
const L = spRulerLevel(pool, F, { work });  // F = 2, 4 or 8; work defaults to SPR_WORK (1e6 units)
// -> { legs, p, d, n, k, settled, gap, bound, boundK, why, tie, groups, found: { c, d }, work: { used, budget, ...counts }, log }
```

`spRulerClean(v)` reads filters (anything unreadable is the default), `spRulerAll(v)` says whether they are the defaults,
`spRulerAllows(l, u)` and `spRulerLeg(v, isPlayer, u)` are the pool's per-leg rule (a leg, or why it is left out:
`vig`, `band`, `noId`, `filt`). `spPool` is untouched. A level's `p` and `d` are `pbExact`'s on its legs (the builder's
own sums); `settled` false comes with `why` (`work`: the best found, with `gap = 1 - p / bound`; `edge` or `dear`: a pool
the proof does not cover, no level); a level with no parlay says `why` `legs` or `pays`, settled.

## The rule (decided)

A parlay is two legs or more, one leg a player, one side (a moneyline or a spread) and one total a game, every leg in the
pool on the filters. Its chance C and price D are the builder's own sums with every leg at `legFair`: C the product over
its games of each game's chance (`joint2`, `sgJoint`), D the product of its singles' prices and each same-game group's
min(prices multiplied, HOLD / J). With C* the most C of a parlay paying F and C*_k the most of k legs, the level L:

1. D(L) >= F (to `SP_FLOOR_EPS`);
2. C(L) >= (1 - TAU) C*, TAU = 0.005;
3. no parlay paying F with fewer legs has C >= (1 - TAU + ETA) C*, ETA = 0.001;
4. C(L) >= (1 - ETA) C*_k(L).

Deterministic: no clock, no random draw; the work is counted, never timed, and counted the same for a call whatever an
earlier call left in the caches; ties go to the lower sorted slip keys. Where the tie pass runs (`tie` true) the level is
exactly the likeliest parlay of its size, ties to the lower slip keys.

## The algorithm

1. **Prep** (once a pool): each leg's price d, implied chance I, fair chance p, return e = p d, thresholds t and tI, pure
   (p = I, an Under) or not; each game's legs by slip key, its frontier on (price, chance), its legs by chance, its
   suffix of dearest prices, its largest correlations (player-player, player-team, side-total; the side-side pair is out,
   one side a group), its pure legs' count.
2. **Tables** (each level): B[j][t][cell], the most log chance of t legs of games j.. reaching a price cell (512 cells
   of ln F, prices rounded up), singles from each frontier and groups relaxed to their cap (one-factor Slepian) and their
   return bound (R10, in two tiers); R[j][t] and R0[j][t], the most t legs return (groups at R10, or at HOLD).
3. **Singles first**: the tables without groups, groups bounded by the most a group can return; the groups only where a
   group's bound keeps a size's bound over the singles'.
4. **Each size k**, fewest legs first: a probe for a first parlay (the search's first find, its branches best bound
   first), then a cut a step under k's bound (1%, doubled each time nothing reaches it), never under what the level
   needs or what is found; `sprQ` visits every parlay of k legs whose bound reaches the cut, keeps those within
   SPR_NEAR (0.09%) of its best and raises the cut, and leaves k's bound at its best over (1 - SPR_NEAR) (or at the cut,
   strictly, with none). A game's groups of s legs are gathered on cheap bounds (pairs exact, Plackett for one more leg,
   the R10 factors of the legs chosen and of those the group must still hold), then worked in the order of a pairwise
   estimate: held to the page's integral (spOrth) and, where they may still reach the cut, worked by the builder's own
   `sgJoint`, in batches of 256 so the cut rises as it goes.
5. **The certificate**: with Lo the best found and out = (1 - TAU + ETA) Lo, k* the fewest legs whose bound is out or
   more; settled when the best of k* is within ETA of its bound and within TAU of U, the most of every size's bound
   and the tail (parlays of more legs than are searched: their likeliest K + 1 legs). Where (2) is not yet shown, the size
   with the highest bound is searched for any parlay over best / (1 - TAU).
6. **The tie pass**: the likeliest parlay of k* legs, ties to the lower slip keys, within SPR_TIEW (60,000 units) more
   work; where that runs out the level found stands (it already meets the rule) and `tie` is false.
7. **The work**: every step counted at about its jsdom microseconds (`SPR_COST`); at SPR_WORK (1e6 units, about a
   second) the level is the best parlay found, with the last bound proved (bounds only fall) and its gap.

## The proof

The code comment above `spRulerPool` in `app/parts/suggested.html` is the proof, cut by cut (R1-R11). In short:

- **R1 units**: legs of different games are independent in the builder's sums, so C and D are products over units.
- **R2 returns**: every leg returns p / I <= 1 (an Under's p is I itself, the whole margin being on the Over), and a group C min(mult, HOLD / J) <= HOLD C / J <=
  HOLD, its event at the fair thresholds lying inside its event at the implied ones; a parlay paying F has C <= its
  return over F (R3). An edge leg (p over I) or a price of 2.9 or more is refused, not searched.
- **R4 the table**: every real unit lies under a relaxed one (a chance at least its, a price cell at least its), so the
  table bounds every completion of a branch.
- **R5 returns ahead**, two tiers: a parlay reaching a cut of SPR_TH (1/16) or more has every group landing that much
  (its chance is at most each group's), so groups are taken at R10 there; under it, at HOLD.
- **R6** two legs exact (`joint2`, never shrunk); **R7** three to five legs held to `spOrth` within SPR_SIG = 0.1%, and
  every group taken worked by `sgJoint` itself. The one measured premise: `sgJoint` and `spOrth` agree to SPR_SIG / 2
  (measured within 1.3e-5 on triples; main's `SP_SLACK` stands on the same).
- **R8 caps** (Slepian against the one-factor model at each leg's largest |rho|), **R9** first-order Plackett for one more
  leg, **R11** the tail.
- **R10 an impure leg's factor**: writing Z_v = M + sigma e (M its regression on the group's others, variance s^2),
  raising v's threshold from tI to t multiplies the group's chance by at most g + (1 - g) Phi(-mu / s) / SPR_TH,
  g = Phi(-(t - mu)/sigma) / Phi(-(tI - mu)/sigma), for any mu >= 0, the group landing SPR_TH or more; over every impure
  leg, C / J is at most the product. g is taken at its most over sigma in [sqrt(1 - s_bar^2), 1] (h(a, b) =
  Phi(-(a+b)) / Phi(-a) falls in a and in b), s_bar the group's own (its Cholesky factor) or, at its worst over every
  group of s legs, the most squared correlation over the least eigenvalue (Weyl). A group of s legs holds at least
  s - nPure impure legs, so its bound carries the game's worst factor that many times: that is what lets Overs-only and
  no-Unders levels settle.
- **Not positive definite** (spPosDef false): pair bounds at max(rho, 0) for C and min(rho, 0) for J (the builder's shrunk
  correlation lies between rho and 0); no integral of three or more legs as a bound; R8-R10 read |rho| only.
- **The certificate** gives (1)-(4): (1) every parlay taken pays F; (2) C(L) >= (1 - TAU) U >= (1 - TAU) C*; (3) every
  k < k* has C*_k <= its bound < out <= (1 - TAU + ETA) C*; (4) C(L) >= (1 - ETA) bound_k* >= (1 - ETA) C*_k*.

## How it was checked

`tools/test_suggest_ruler.js` part (i) enumerates every valid parlay of small pools (171 levels, 2.58 million paying parlays: made-up nights of
6 to 24 legs over 1 to 4 games cut from 10 November's real legs, at prices of their own where a case needs them, and every two-game cut and
a spread of three-game cuts of 7 and 10 November's team legs), each game's legs priced together by the builder's own
`sgJoint`, and holds each level to (1)-(4), to the likeliest parlay of its size with ties to the lower slip keys where
its tie pass ran, its bound to C* or more, and the same answer and work a second time. The cases: a game's groups of three
legs and more; three games of 24 legs (both sides at the moneyline and the spread, the total, three players a game); four games of Unders at their implied chance tying (the case checks that ties stand at every level); parlays paying
their floor exactly ($2 at -200 and -300, $4 at +100 and +100); Unders off; Overs only; shortest -200; a table that is
not positive definite (BOS at PHI with mate pts-reb 0.9, opposite ast-pts 0.9, ast-reb -0.9, so the builder shrinks a
group of the three); a filter that leaves no leg.

Planted in scratch copies of the built page (`RULER_PAGE`), each caught by the enumeration:

| Planted error | Checks failed |
|---|---|
| The table's bound 1% too tight (`C.B` lowered by ln 0.99) | 113 of 1,292 |
| The fewest-legs check off by one (sizes from 3) | 78 of 1,262 |
| The tie order reversed (found's and the tie pass's slip-key order) | 16 of 1,326 |

Part (ii) times every real night (below) and holds: every level at the default filters settled; a night's three levels at
the default filters within 1.5 s and any level within 4 s (runner-safe limits; the jsdom figures are below); a level that
stops on its work shows a parlay with its proven gap.

## Timings

jsdom on this machine, `node tools/test_suggest_ruler.js` part (ii) (RULER_OUT wrote research/sp_ruler/timing.json): 1,533 levels (three real nights, each whole, cut to every game and every two games, at seven filter cases, three levels) in 103 s. At the default filters every level settled; the whole nights' three levels in 182 ms (7 November), 45 ms (10 November 17:00) and 61 ms (10 November 21:57); the slowest level of any case 652 ms.

### The nights, whole: every filter case and level

| Night | Filter | Legs | Safe ($2) | Medium ($4) | Aggressive ($8) | ms (Safe / Medium / Aggressive) | Three levels |
|---|---|---|---|---|---|---|---|
| 7 November | Default | 971 | 2L 49.70% @2.012 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 47 / 17 / 118 | 182 ms |
| 7 November | Players only | 940 | 2L 49.70% @2.012 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 23 / 5 / 73 | 101 ms |
| 7 November | Teams only | 31 | 2L 46.05% @2.002 | 3L 21.99% @4.006 | 4L 10.51% @8.003 | 1 / 6 / 6 | 13 ms |
| 7 November | Overs only | 388 | 2L 38.71% @2.107 | 3L 18.12% @4.004 | 4L 8.02% @8.000 | 40 / 21 / 25 | 86 ms |
| 7 November | Player unders off | 419 | 2L 46.05% @2.002 | 3L 21.99% @4.006 | 4L 10.51% @8.003 | 6 / 36 / 142 | 185 ms |
| 7 November | Shortest -300 | 968 | 2L 49.70% @2.012 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 16 / 3 / 67 | 86 ms |
| 7 November | Shortest -200 | 946 | 2L 43.39% @2.305 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 74 / 2 / 37 | 114 ms |
| 10 November 17:00 UTC | Default | 775 | 2L 48.96% @2.043 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 11 / 1 / 33 | 45 ms |
| 10 November 17:00 UTC | Players only | 748 | 2L 48.96% @2.043 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 11 / 2 / 37 | 50 ms |
| 10 November 17:00 UTC | Teams only | 27 | 2L 45.31% @2.033 | 2L 22.76% @4.027 | 3L 10.98% @8.013 | 1 / 0 / 3 | 4 ms |
| 10 November 17:00 UTC | Overs only | 304 | 2L 37.82% @2.161 | 3L 18.12% @4.000 | 4L 8.01% @8.010 | 28 / 14 / 323 | 364 ms |
| 10 November 17:00 UTC | Player unders off | 331 | 2L 45.31% @2.033 | 2L 22.76% @4.027 | 3L 10.98% @8.013 | 4 / 0 / 28 | 32 ms |
| 10 November 17:00 UTC | Shortest -300 | 773 | 2L 48.96% @2.043 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 11 / 2 / 38 | 51 ms |
| 10 November 17:00 UTC | Shortest -200 | 757 | 2L 43.69% @2.289 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 80 / 3 / 40 | 123 ms |
| 10 November 21:57 UTC | Default | 922 | 2L 49.27% @2.030 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 14 / 2 / 45 | 61 ms |
| 10 November 21:57 UTC | Players only | 890 | 2L 49.27% @2.030 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 16 / 2 / 46 | 64 ms |
| 10 November 21:57 UTC | Teams only | 32 | 2L 45.31% @2.033 | 2L 22.81% @4.022 | 3L 11.00% @8.004 | 1 / 0 / 3 | 4 ms |
| 10 November 21:57 UTC | Overs only | 372 | 2L 41.16% @2.002 | 3L 18.20% @4.007 | 4L 8.07% @8.026 | 7 / 25 / 234 | 265 ms |
| 10 November 21:57 UTC | Player unders off | 404 | 2L 45.31% @2.033 | 2L 22.81% @4.022 | 3L 11.00% @8.004 | 7 / 1 / 29 | 36 ms |
| 10 November 21:57 UTC | Shortest -300 | 920 | 2L 49.27% @2.030 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 14 / 2 / 48 | 64 ms |
| 10 November 21:57 UTC | Shortest -200 | 898 | 2L 44.22% @2.261 | 2L 25.00% @4.000 | 3L 12.50% @8.000 | 87 / 3 / 31 | 121 ms |

### Every cut, by night and filter case

Each night whole, cut to each of its games and to each two of them; per filter case: the levels settled of all, the median and the slowest level, and the slowest three levels of one cut.

| Night | Filter | Cuts | Levels settled | Median level | Slowest level | Slowest three levels |
|---|---|---|---|---|---|---|
| nov7 | Default | 29 | 87 of 87 | 6 ms | 582 ms (DEN_IND, Aggressive) | 712 ms (DEN_IND) |
| nov7 | Players only | 29 | 87 of 87 | 6 ms | 112 ms (NYK_CLE+SAS_POR, Aggressive) | 138 ms (DEN_IND) |
| nov7 | Teams only | 29 | 87 of 87 | 1 ms | 6 ms (night, Aggressive) | 13 ms (night) |
| nov7 | Overs only | 29 | 59 of 87 | 49 ms | 476 ms (HOU_PHX+ORL_GSW, Aggressive) | 578 ms (HOU_PHX+ORL_GSW) |
| nov7 | Player unders off | 29 | 54 of 87 | 97 ms | 542 ms (SAS_POR+WAS_OKC, Aggressive) | 781 ms (BKN_ATL+HOU_PHX) |
| nov7 | Shortest -300 | 29 | 87 of 87 | 5 ms | 166 ms (DEN_IND+HOU_PHX, Aggressive) | 172 ms (DEN_IND+HOU_PHX) |
| nov7 | Shortest -200 | 29 | 87 of 87 | 17 ms | 131 ms (BKN_ATL+HOU_PHX, Aggressive) | 164 ms (BKN_ATL+HOU_PHX) |
| nov10 | Default | 22 | 66 of 66 | 5 ms | 154 ms (MIA_UTA+OKC_POR, Aggressive) | 241 ms (BOS_PHI) |
| nov10 | Players only | 22 | 66 of 66 | 6 ms | 163 ms (BOS_PHI+OKC_POR, Aggressive) | 172 ms (BOS_PHI) |
| nov10 | Teams only | 22 | 66 of 66 | 1 ms | 3 ms (night, Aggressive) | 4 ms (night) |
| nov10 | Overs only | 22 | 46 of 66 | 59 ms | 487 ms (LAC_PHX+MIA_UTA, Aggressive) | 584 ms (LAC_PHX) |
| nov10 | Player unders off | 22 | 43 of 66 | 42 ms | 580 ms (LAC_PHX+MIA_UTA, Aggressive) | 714 ms (BOS_PHI+MIL_NYK) |
| nov10 | Shortest -300 | 22 | 66 of 66 | 6 ms | 216 ms (MIL_NYK+OKC_POR, Aggressive) | 220 ms (MIL_NYK+OKC_POR) |
| nov10 | Shortest -200 | 22 | 66 of 66 | 21 ms | 322 ms (BOS_PHI, Medium) | 435 ms (BOS_PHI) |
| nov10b | Default | 22 | 66 of 66 | 6 ms | 202 ms (OKC_POR, Aggressive) | 292 ms (BOS_PHI) |
| nov10b | Players only | 22 | 66 of 66 | 8 ms | 151 ms (BOS_PHI+OKC_POR, Aggressive) | 211 ms (BOS_PHI) |
| nov10b | Teams only | 22 | 66 of 66 | 1 ms | 3 ms (night, Aggressive) | 4 ms (night) |
| nov10b | Overs only | 22 | 45 of 66 | 76 ms | 583 ms (LAC_PHX+OKC_POR, Aggressive) | 705 ms (LAC_PHX+OKC_POR) |
| nov10b | Player unders off | 22 | 41 of 66 | 97 ms | 652 ms (MIL_NYK+OKC_POR, Aggressive) | 787 ms (BOS_PHI+MIL_NYK) |
| nov10b | Shortest -300 | 22 | 66 of 66 | 11 ms | 164 ms (BOS_PHI+OKC_POR, Aggressive) | 226 ms (BOS_PHI) |
| nov10b | Shortest -200 | 22 | 66 of 66 | 24 ms | 128 ms (MIL_NYK+OKC_POR, Aggressive) | 226 ms (BOS_PHI) |

### Every cut at every filter case: its three levels in ms

A cell is the three levels together; * marks a cut with a level that stopped on its work (listed below).

7 November (sp_nights.json):

| Cut | Legs | Default | Players only | Teams only | Overs only | Player unders off | Shortest -300 | Shortest -200 |
|---|---|---|---|---|---|---|---|---|
| night | 971 | 182 | 101 | 13 | 86 | 185 | 86 | 114 |
| BKN_ATL | 138 | 215 | 69 | 1 | 475* | 594* | 82 | 97 |
| DEN_IND | 112 | 712 | 138 | 1 | 332* | 376* | 140 | 162 |
| HOU_PHX | 166 | 153 | 120 | 1 | 527* | 518* | 138 | 125 |
| NYK_CLE | 132 | 124 | 78 | 1 | 271* | 490* | 76 | 74 |
| ORL_GSW | 129 | 173 | 69 | 1 | 398* | 517* | 66 | 68 |
| SAS_POR | 160 | 192 | 100 | 1 | 512* | 542* | 110 | 92 |
| WAS_OKC | 134 | 141 | 63 | 1 | 406* | 554* | 64 | 64 |
| BKN_ATL+DEN_IND | 250 | 83 | 67 | 4 | 313* | 536* | 73 | 91 |
| BKN_ATL+HOU_PHX | 304 | 125 | 116 | 4 | 474* | 781* | 138 | 164 |
| BKN_ATL+NYK_CLE | 270 | 67 | 70 | 4 | 308* | 548* | 74 | 66 |
| BKN_ATL+ORL_GSW | 267 | 73 | 72 | 4 | 487* | 773* | 77 | 80 |
| BKN_ATL+SAS_POR | 298 | 98 | 96 | 4 | 542* | 633* | 98 | 106 |
| BKN_ATL+WAS_OKC | 272 | 78 | 69 | 4 | 479* | 594* | 66 | 75 |
| DEN_IND+HOU_PHX | 278 | 123 | 106 | 4 | 482* | 520* | 172 | 133 |
| DEN_IND+NYK_CLE | 244 | 110 | 59 | 4 | 300* | 401* | 88 | 68 |
| DEN_IND+ORL_GSW | 241 | 78 | 68 | 4 | 361* | 378* | 80 | 77 |
| DEN_IND+SAS_POR | 272 | 103 | 96 | 4 | 488* | 443* | 112 | 102 |
| DEN_IND+WAS_OKC | 246 | 72 | 108 | 6 | 345* | 496* | 73 | 86 |
| HOU_PHX+NYK_CLE | 298 | 91 | 86 | 2 | 491* | 481* | 66 | 76 |
| HOU_PHX+ORL_GSW | 295 | 107 | 87 | 2 | 578* | 520* | 83 | 87 |
| HOU_PHX+SAS_POR | 326 | 105 | 97 | 2 | 536* | 585* | 122 | 109 |
| HOU_PHX+WAS_OKC | 300 | 96 | 75 | 2 | 513* | 656* | 85 | 74 |
| NYK_CLE+ORL_GSW | 261 | 75 | 99 | 2 | 517* | 410* | 108 | 78 |
| NYK_CLE+SAS_POR | 292 | 97 | 117 | 2 | 523* | 518* | 96 | 100 |
| NYK_CLE+WAS_OKC | 266 | 72 | 77 | 2 | 360* | 579* | 88 | 67 |
| ORL_GSW+SAS_POR | 289 | 104 | 96 | 2 | 462* | 478* | 107 | 93 |
| ORL_GSW+WAS_OKC | 263 | 83 | 74 | 2 | 417* | 644* | 73 | 66 |
| SAS_POR+WAS_OKC | 294 | 72 | 105 | 2 | 395* | 660* | 78 | 62 |

10 November 17:00 UTC (sp_nights.json):

| Cut | Legs | Default | Players only | Teams only | Overs only | Player unders off | Shortest -300 | Shortest -200 |
|---|---|---|---|---|---|---|---|---|
| night | 775 | 45 | 50 | 4 | 364 | 32 | 51 | 123 |
| BOS_PHI | 170 | 241 | 172 | 1 | 435* | 572* | 195 | 435 |
| LAC_PHX | 166 | 172 | 112 | 1 | 584* | 532* | 95 | 155 |
| MIA_UTA | 96 | 151 | 41 | 1 | 342* | 379* | 32 | 49 |
| MIL_NYK | 46 | 173 | 50 | 1 | 96 | 286* | 51 | 78 |
| OKC_POR | 172 | 146 | 170 | 1 | 562* | 538* | 132 | 207 |
| ORL_SAC | 125 | 120 | 56 | 3 | 278* | 579* | 58 | 84 |
| BOS_PHI+LAC_PHX | 336 | 107 | 114 | 2 | 528* | 657* | 101 | 150 |
| BOS_PHI+MIA_UTA | 266 | 72 | 59 | 2 | 408* | 597* | 67 | 104 |
| BOS_PHI+MIL_NYK | 216 | 88 | 101 | 3 | 421* | 714* | 86 | 116 |
| BOS_PHI+OKC_POR | 342 | 146 | 169 | 2 | 565* | 217* | 156 | 227 |
| BOS_PHI+ORL_SAC | 295 | 69 | 83 | 2 | 420* | 490* | 102 | 67 |
| LAC_PHX+MIA_UTA | 262 | 66 | 61 | 2 | 583* | 630* | 98 | 69 |
| LAC_PHX+MIL_NYK | 212 | 75 | 72 | 2 | 453* | 635* | 95 | 74 |
| LAC_PHX+OKC_POR | 338 | 156 | 124 | 2 | 534* | 452* | 202 | 165 |
| LAC_PHX+ORL_SAC | 291 | 74 | 59 | 2 | 474* | 578* | 86 | 77 |
| MIA_UTA+MIL_NYK | 142 | 35 | 28 | 1 | 284* | 363* | 55 | 40 |
| MIA_UTA+OKC_POR | 268 | 159 | 166 | 2 | 456* | 458* | 213 | 145 |
| MIA_UTA+ORL_SAC | 221 | 58 | 72 | 2 | 310* | 492* | 88 | 75 |
| MIL_NYK+OKC_POR | 218 | 150 | 127 | 1 | 538* | 436* | 220 | 158 |
| MIL_NYK+ORL_SAC | 171 | 76 | 59 | 2 | 272* | 448* | 116 | 69 |
| OKC_POR+ORL_SAC | 297 | 65 | 76 | 2 | 418* | 424* | 95 | 72 |

10 November 21:57 UTC (sp_ruler_nights.json):

| Cut | Legs | Default | Players only | Teams only | Overs only | Player unders off | Shortest -300 | Shortest -200 |
|---|---|---|---|---|---|---|---|---|
| night | 922 | 61 | 64 | 4 | 265 | 36 | 64 | 121 |
| BOS_PHI | 170 | 292 | 211 | 1 | 560* | 659* | 226 | 226 |
| LAC_PHX | 165 | 164 | 98 | 1 | 512* | 539* | 98 | 88 |
| MIA_UTA | 147 | 142 | 91 | 1 | 440* | 601* | 78 | 68 |
| MIL_NYK | 120 | 263 | 91 | 1 | 364* | 484* | 150 | 111 |
| OKC_POR | 176 | 223 | 166 | 1 | 515* | 587* | 161 | 131 |
| ORL_SAC | 144 | 158 | 126 | 1 | 533* | 667* | 98 | 84 |
| BOS_PHI+LAC_PHX | 335 | 113 | 150 | 2 | 595* | 579* | 97 | 95 |
| BOS_PHI+MIA_UTA | 317 | 79 | 97 | 3 | 354* | 655* | 100 | 78 |
| BOS_PHI+MIL_NYK | 290 | 136 | 136 | 4 | 511* | 787* | 152 | 127 |
| BOS_PHI+OKC_POR | 346 | 137 | 158 | 2 | 602* | 538* | 171 | 152 |
| BOS_PHI+ORL_SAC | 314 | 89 | 117 | 2 | 469* | 594* | 89 | 101 |
| LAC_PHX+MIA_UTA | 312 | 76 | 74 | 3 | 456* | 520* | 70 | 79 |
| LAC_PHX+MIL_NYK | 285 | 124 | 119 | 2 | 501* | 736* | 116 | 120 |
| LAC_PHX+OKC_POR | 341 | 132 | 141 | 2 | 705* | 576* | 131 | 140 |
| LAC_PHX+ORL_SAC | 309 | 86 | 143 | 2 | 491* | 572* | 93 | 118 |
| MIA_UTA+MIL_NYK | 267 | 104 | 138 | 2 | 312* | 448* | 108 | 110 |
| MIA_UTA+OKC_POR | 323 | 138 | 129 | 2 | 472* | 505* | 137 | 144 |
| MIA_UTA+ORL_SAC | 291 | 93 | 95 | 2 | 328* | 656* | 88 | 99 |
| MIL_NYK+OKC_POR | 296 | 167 | 156 | 1 | 492* | 660* | 134 | 155 |
| MIL_NYK+ORL_SAC | 264 | 102 | 87 | 2 | 536* | 784* | 80 | 111 |
| OKC_POR+ORL_SAC | 320 | 99 | 108 | 2 | 504* | 486* | 87 | 108 |

### Every level that stopped on its work

| Night | Cut | Filter | Level | Shown | Proven gap | ms |
|---|---|---|---|---|---|---|
| nov10 | BOS_PHI | Player unders off | Aggressive | 4L 6.33% @8.433 | 35.8% | 422 |
| nov10 | BOS_PHI+LAC_PHX | Player unders off | Aggressive | 4L 6.86% @8.015 | 34.4% | 512 |
| nov10 | BOS_PHI+MIA_UTA | Player unders off | Aggressive | 4L 7.73% @8.005 | 29.2% | 541 |
| nov10 | BOS_PHI+MIL_NYK | Player unders off | Medium | 3L 17.77% @4.064 | 2.5% | 238 |
| nov10 | BOS_PHI+MIL_NYK | Player unders off | Aggressive | 4L 6.59% @8.445 | 37.0% | 474 |
| nov10 | BOS_PHI+OKC_POR | Player unders off | Aggressive | 3L 8.76% @8.047 | 18.4% | 201 |
| nov10 | BOS_PHI+ORL_SAC | Player unders off | Aggressive | 4L 7.63% @8.044 | 23.6% | 414 |
| nov10 | LAC_PHX | Player unders off | Aggressive | 4L 6.86% @8.015 | 34.4% | 440 |
| nov10 | LAC_PHX+MIA_UTA | Player unders off | Aggressive | 4L 7.73% @8.005 | 29.2% | 580 |
| nov10 | LAC_PHX+MIL_NYK | Player unders off | Medium | 3L 18.61% @4.022 | 9.0% | 232 |
| nov10 | LAC_PHX+MIL_NYK | Player unders off | Aggressive | 4L 6.59% @8.445 | 37.0% | 396 |
| nov10 | LAC_PHX+OKC_POR | Player unders off | Aggressive | 4L 7.51% @8.042 | 30.3% | 438 |
| nov10 | LAC_PHX+ORL_SAC | Player unders off | Aggressive | 4L 7.63% @8.044 | 27.0% | 493 |
| nov10 | MIA_UTA | Player unders off | Aggressive | 4L 7.78% @8.188 | 28.7% | 336 |
| nov10 | MIA_UTA+MIL_NYK | Player unders off | Aggressive | 4L 8.60% @8.064 | 21.2% | 334 |
| nov10 | MIA_UTA+OKC_POR | Player unders off | Aggressive | 4L 7.51% @8.042 | 31.2% | 446 |
| nov10 | MIA_UTA+ORL_SAC | Player unders off | Aggressive | 4L 7.63% @8.044 | 30.1% | 448 |
| nov10 | MIL_NYK | Player unders off | Aggressive | 4L 8.20% @8.173 | 21.6% | 251 |
| nov10 | MIL_NYK+OKC_POR | Player unders off | Aggressive | 4L 7.51% @8.042 | 30.3% | 428 |
| nov10 | MIL_NYK+ORL_SAC | Player unders off | Aggressive | 4L 7.63% @8.044 | 27.0% | 383 |
| nov10 | OKC_POR | Player unders off | Aggressive | 4L 7.51% @8.042 | 30.0% | 445 |
| nov10 | OKC_POR+ORL_SAC | Player unders off | Aggressive | 4L 7.63% @8.044 | 29.2% | 415 |
| nov10 | ORL_SAC | Player unders off | Aggressive | 4L 7.63% @8.044 | 23.6% | 482 |
| nov10 | BOS_PHI | Overs only | Aggressive | 4L 6.98% @8.014 | 9.5% | 332 |
| nov10 | BOS_PHI+LAC_PHX | Overs only | Aggressive | 4L 6.84% @8.122 | 12.6% | 432 |
| nov10 | BOS_PHI+MIA_UTA | Overs only | Aggressive | 4L 6.79% @8.006 | 13.0% | 349 |
| nov10 | BOS_PHI+MIL_NYK | Overs only | Aggressive | 4L 6.66% @8.225 | 13.6% | 369 |
| nov10 | BOS_PHI+OKC_POR | Overs only | Aggressive | 4L 6.92% @8.038 | 10.9% | 476 |
| nov10 | BOS_PHI+ORL_SAC | Overs only | Aggressive | 4L 6.84% @8.057 | 11.5% | 362 |
| nov10 | LAC_PHX | Overs only | Aggressive | 4L 6.84% @8.122 | 12.6% | 476 |
| nov10 | LAC_PHX+MIA_UTA | Overs only | Aggressive | 4L 6.79% @8.006 | 13.3% | 487 |
| nov10 | LAC_PHX+MIL_NYK | Overs only | Aggressive | 4L 6.66% @8.225 | 14.9% | 404 |
| nov10 | LAC_PHX+OKC_POR | Overs only | Aggressive | 4L 6.92% @8.038 | 10.9% | 436 |
| nov10 | LAC_PHX+ORL_SAC | Overs only | Aggressive | 4L 6.84% @8.057 | 12.6% | 405 |
| nov10 | MIA_UTA | Overs only | Aggressive | 4L 7.13% @8.018 | 4.8% | 271 |
| nov10 | MIA_UTA+MIL_NYK | Overs only | Aggressive | 4L 7.13% @8.018 | 4.8% | 265 |
| nov10 | MIA_UTA+OKC_POR | Overs only | Aggressive | 4L 6.92% @8.038 | 10.9% | 378 |
| nov10 | MIA_UTA+ORL_SAC | Overs only | Aggressive | 4L 6.98% @8.071 | 6.7% | 273 |
| nov10 | MIL_NYK+OKC_POR | Overs only | Aggressive | 4L 6.92% @8.038 | 10.9% | 471 |
| nov10 | MIL_NYK+ORL_SAC | Overs only | Aggressive | 4L 7.07% @8.016 | 4.6% | 233 |
| nov10 | OKC_POR | Overs only | Aggressive | 4L 7.09% @8.001 | 8.7% | 453 |
| nov10 | OKC_POR+ORL_SAC | Overs only | Aggressive | 4L 7.07% @8.016 | 8.9% | 340 |
| nov10 | ORL_SAC | Overs only | Aggressive | 4L 7.07% @8.016 | 4.6% | 238 |
| nov10b | BOS_PHI | Player unders off | Aggressive | 4L 7.78% @8.191 | 27.3% | 521 |
| nov10b | BOS_PHI+LAC_PHX | Player unders off | Aggressive | 4L 7.92% @8.100 | 26.5% | 465 |
| nov10b | BOS_PHI+MIA_UTA | Player unders off | Aggressive | 4L 7.36% @8.032 | 32.7% | 446 |
| nov10b | BOS_PHI+MIL_NYK | Player unders off | Medium | 3L 17.77% @4.045 | 12.8% | 268 |
| nov10b | BOS_PHI+MIL_NYK | Player unders off | Aggressive | 4L 7.41% @8.157 | 32.9% | 515 |
| nov10b | BOS_PHI+OKC_POR | Player unders off | Aggressive | 4L 7.60% @8.060 | 29.1% | 521 |
| nov10b | BOS_PHI+ORL_SAC | Player unders off | Aggressive | 4L 7.52% @8.106 | 30.6% | 487 |
| nov10b | LAC_PHX | Player unders off | Aggressive | 4L 7.92% @8.100 | 26.5% | 447 |
| nov10b | LAC_PHX+MIA_UTA | Player unders off | Aggressive | 4L 7.36% @8.032 | 32.7% | 391 |
| nov10b | LAC_PHX+MIL_NYK | Player unders off | Medium | 3L 18.56% @4.019 | 9.3% | 271 |
| nov10b | LAC_PHX+MIL_NYK | Player unders off | Aggressive | 4L 7.41% @8.157 | 32.9% | 458 |
| nov10b | LAC_PHX+OKC_POR | Player unders off | Aggressive | 4L 7.60% @8.060 | 29.5% | 459 |
| nov10b | LAC_PHX+ORL_SAC | Player unders off | Aggressive | 4L 7.52% @8.106 | 30.6% | 475 |
| nov10b | MIA_UTA | Player unders off | Medium | 3L 18.18% @4.005 | 10.2% | 228 |
| nov10b | MIA_UTA | Player unders off | Aggressive | 4L 7.36% @8.032 | 32.7% | 367 |
| nov10b | MIA_UTA+MIL_NYK | Player unders off | Aggressive | 4L 7.41% @8.157 | 32.9% | 369 |
| nov10b | MIA_UTA+OKC_POR | Player unders off | Aggressive | 4L 7.60% @8.060 | 30.5% | 496 |
| nov10b | MIA_UTA+ORL_SAC | Player unders off | Aggressive | 4L 7.52% @8.106 | 31.2% | 556 |
| nov10b | MIL_NYK | Player unders off | Medium | 3L 17.08% @4.083 | 5.7% | 208 |
| nov10b | MIL_NYK | Player unders off | Aggressive | 4L 7.89% @8.303 | 28.6% | 270 |
| nov10b | MIL_NYK+OKC_POR | Player unders off | Aggressive | 4L 7.60% @8.060 | 31.1% | 652 |
| nov10b | MIL_NYK+ORL_SAC | Player unders off | Aggressive | 4L 7.52% @8.106 | 31.9% | 493 |
| nov10b | OKC_POR | Player unders off | Aggressive | 4L 7.60% @8.060 | 29.1% | 465 |
| nov10b | OKC_POR+ORL_SAC | Player unders off | Aggressive | 4L 7.52% @8.106 | 30.6% | 468 |
| nov10b | ORL_SAC | Player unders off | Aggressive | 4L 7.52% @8.106 | 30.6% | 565 |
| nov10b | BOS_PHI | Overs only | Aggressive | 4L 6.95% @8.025 | 10.8% | 439 |
| nov10b | BOS_PHI+LAC_PHX | Overs only | Aggressive | 4L 6.96% @8.027 | 10.1% | 472 |
| nov10b | BOS_PHI+MIA_UTA | Overs only | Aggressive | 4L 6.93% @8.049 | 10.8% | 263 |
| nov10b | BOS_PHI+MIL_NYK | Overs only | Aggressive | 4L 7.07% @8.012 | 9.2% | 437 |
| nov10b | BOS_PHI+OKC_POR | Overs only | Aggressive | 4L 6.87% @8.016 | 11.7% | 467 |
| nov10b | BOS_PHI+ORL_SAC | Overs only | Aggressive | 4L 6.86% @8.118 | 11.9% | 402 |
| nov10b | LAC_PHX | Overs only | Aggressive | 4L 6.96% @8.027 | 10.1% | 383 |
| nov10b | LAC_PHX+MIA_UTA | Overs only | Aggressive | 4L 6.93% @8.049 | 10.9% | 323 |
| nov10b | LAC_PHX+MIL_NYK | Overs only | Aggressive | 4L 7.10% @8.014 | 8.3% | 426 |
| nov10b | LAC_PHX+OKC_POR | Overs only | Aggressive | 4L 6.87% @8.016 | 11.7% | 583 |
| nov10b | LAC_PHX+ORL_SAC | Overs only | Aggressive | 4L 7.07% @8.043 | 8.7% | 415 |
| nov10b | MIA_UTA | Overs only | Aggressive | 4L 6.93% @8.049 | 10.8% | 272 |
| nov10b | MIA_UTA+MIL_NYK | Overs only | Aggressive | 4L 7.07% @8.012 | 8.9% | 237 |
| nov10b | MIA_UTA+OKC_POR | Overs only | Aggressive | 4L 6.87% @8.016 | 12.1% | 387 |
| nov10b | MIA_UTA+ORL_SAC | Overs only | Aggressive | 4L 6.86% @8.118 | 11.6% | 271 |
| nov10b | MIL_NYK | Overs only | Aggressive | 4L 7.10% @8.014 | 3.0% | 322 |
| nov10b | MIL_NYK+OKC_POR | Overs only | Aggressive | 4L 6.87% @8.016 | 11.7% | 413 |
| nov10b | MIL_NYK+ORL_SAC | Overs only | Aggressive | 4L 6.86% @8.118 | 10.4% | 470 |
| nov10b | OKC_POR | Overs only | Aggressive | 4L 6.87% @8.016 | 11.7% | 398 |
| nov10b | OKC_POR+ORL_SAC | Overs only | Aggressive | 4L 6.86% @8.118 | 11.8% | 392 |
| nov10b | ORL_SAC | Overs only | Aggressive | 4L 6.86% @8.118 | 10.4% | 465 |
| nov7 | BKN_ATL | Player unders off | Aggressive | 4L 7.42% @8.049 | 31.8% | 478 |
| nov7 | BKN_ATL+DEN_IND | Player unders off | Aggressive | 4L 7.64% @8.086 | 29.9% | 416 |
| nov7 | BKN_ATL+HOU_PHX | Player unders off | Medium | 3L 18.48% @4.013 | 7.3% | 297 |
| nov7 | BKN_ATL+HOU_PHX | Player unders off | Aggressive | 4L 7.65% @8.075 | 29.8% | 474 |
| nov7 | BKN_ATL+NYK_CLE | Player unders off | Aggressive | 4L 7.73% @8.251 | 29.0% | 478 |
| nov7 | BKN_ATL+ORL_GSW | Player unders off | Medium | 3L 18.47% @4.003 | 1.2% | 230 |
| nov7 | BKN_ATL+ORL_GSW | Player unders off | Aggressive | 4L 7.79% @8.051 | 28.4% | 536 |
| nov7 | BKN_ATL+SAS_POR | Player unders off | Aggressive | 4L 7.86% @8.070 | 27.9% | 498 |
| nov7 | BKN_ATL+WAS_OKC | Player unders off | Aggressive | 4L 6.71% @8.003 | 39.0% | 440 |
| nov7 | DEN_IND | Player unders off | Aggressive | 4L 7.87% @8.032 | 21.2% | 306 |
| nov7 | DEN_IND+HOU_PHX | Player unders off | Aggressive | 4L 7.65% @8.075 | 29.8% | 382 |
| nov7 | DEN_IND+NYK_CLE | Player unders off | Aggressive | 4L 7.73% @8.251 | 25.3% | 355 |
| nov7 | DEN_IND+ORL_GSW | Player unders off | Aggressive | 4L 7.79% @8.051 | 25.3% | 332 |
| nov7 | DEN_IND+SAS_POR | Player unders off | Aggressive | 4L 7.86% @8.070 | 27.7% | 388 |
| nov7 | DEN_IND+WAS_OKC | Player unders off | Aggressive | 4L 6.71% @8.003 | 39.0% | 399 |
| nov7 | HOU_PHX | Player unders off | Aggressive | 4L 7.65% @8.075 | 29.6% | 403 |
| nov7 | HOU_PHX+NYK_CLE | Player unders off | Aggressive | 4L 7.73% @8.251 | 28.9% | 400 |
| nov7 | HOU_PHX+ORL_GSW | Player unders off | Aggressive | 4L 7.79% @8.051 | 28.3% | 442 |
| nov7 | HOU_PHX+SAS_POR | Player unders off | Aggressive | 4L 7.86% @8.070 | 27.7% | 485 |
| nov7 | HOU_PHX+WAS_OKC | Player unders off | Medium | 3L 18.51% @4.243 | 11.2% | 240 |
| nov7 | HOU_PHX+WAS_OKC | Player unders off | Aggressive | 4L 6.71% @8.003 | 39.0% | 406 |
| nov7 | NYK_CLE | Player unders off | Aggressive | 4L 7.73% @8.251 | 22.4% | 421 |
| nov7 | NYK_CLE+ORL_GSW | Player unders off | Aggressive | 4L 7.79% @8.051 | 21.9% | 349 |
| nov7 | NYK_CLE+SAS_POR | Player unders off | Aggressive | 4L 7.86% @8.070 | 27.4% | 412 |
| nov7 | NYK_CLE+WAS_OKC | Player unders off | Aggressive | 4L 6.71% @8.003 | 39.0% | 495 |
| nov7 | ORL_GSW | Player unders off | Aggressive | 4L 7.79% @8.051 | 21.9% | 446 |
| nov7 | ORL_GSW+SAS_POR | Player unders off | Aggressive | 4L 7.86% @8.070 | 27.4% | 389 |
| nov7 | ORL_GSW+WAS_OKC | Player unders off | Medium | 3L 18.47% @4.028 | 11.3% | 226 |
| nov7 | ORL_GSW+WAS_OKC | Player unders off | Aggressive | 4L 6.71% @8.003 | 39.0% | 409 |
| nov7 | SAS_POR | Player unders off | Aggressive | 4L 7.86% @8.070 | 27.4% | 424 |
| nov7 | SAS_POR+WAS_OKC | Player unders off | Aggressive | 4L 6.71% @8.003 | 39.0% | 542 |
| nov7 | WAS_OKC | Player unders off | Medium | 3L 17.93% @4.040 | 12.8% | 235 |
| nov7 | WAS_OKC | Player unders off | Aggressive | 4L 8.07% @8.030 | 26.6% | 312 |
| nov7 | BKN_ATL | Overs only | Aggressive | 4L 7.00% @8.036 | 7.1% | 378 |
| nov7 | BKN_ATL+DEN_IND | Overs only | Aggressive | 4L 6.97% @8.047 | 7.5% | 269 |
| nov7 | BKN_ATL+HOU_PHX | Overs only | Aggressive | 4L 6.94% @8.042 | 11.6% | 377 |
| nov7 | BKN_ATL+NYK_CLE | Overs only | Aggressive | 4L 6.86% @8.043 | 9.0% | 259 |
| nov7 | BKN_ATL+ORL_GSW | Overs only | Aggressive | 4L 6.95% @8.033 | 7.7% | 422 |
| nov7 | BKN_ATL+SAS_POR | Overs only | Aggressive | 4L 6.86% @8.120 | 12.6% | 466 |
| nov7 | BKN_ATL+WAS_OKC | Overs only | Aggressive | 4L 7.04% @8.071 | 6.6% | 416 |
| nov7 | DEN_IND | Overs only | Aggressive | 4L 6.97% @8.047 | 4.2% | 297 |
| nov7 | DEN_IND+HOU_PHX | Overs only | Aggressive | 4L 6.94% @8.042 | 10.2% | 430 |
| nov7 | DEN_IND+NYK_CLE | Overs only | Aggressive | 4L 6.86% @8.043 | 9.4% | 264 |
| nov7 | DEN_IND+ORL_GSW | Overs only | Aggressive | 4L 6.73% @8.025 | 12.8% | 320 |
| nov7 | DEN_IND+SAS_POR | Overs only | Aggressive | 4L 6.86% @8.120 | 10.7% | 426 |
| nov7 | DEN_IND+WAS_OKC | Overs only | Aggressive | 4L 6.81% @8.071 | 11.6% | 310 |
| nov7 | HOU_PHX | Overs only | Aggressive | 4L 6.94% @8.042 | 10.2% | 450 |
| nov7 | HOU_PHX+NYK_CLE | Overs only | Aggressive | 4L 6.86% @8.043 | 11.2% | 434 |
| nov7 | HOU_PHX+ORL_GSW | Overs only | Aggressive | 4L 6.73% @8.025 | 12.9% | 476 |
| nov7 | HOU_PHX+SAS_POR | Overs only | Aggressive | 4L 6.86% @8.120 | 11.2% | 448 |
| nov7 | HOU_PHX+WAS_OKC | Overs only | Aggressive | 4L 6.81% @8.071 | 11.8% | 439 |
| nov7 | NYK_CLE | Overs only | Aggressive | 4L 6.86% @8.043 | 8.0% | 231 |
| nov7 | NYK_CLE+ORL_GSW | Overs only | Aggressive | 4L 6.73% @8.025 | 12.8% | 442 |
| nov7 | NYK_CLE+SAS_POR | Overs only | Aggressive | 4L 6.86% @8.120 | 10.7% | 442 |
| nov7 | NYK_CLE+WAS_OKC | Overs only | Aggressive | 4L 6.81% @8.071 | 11.6% | 311 |
| nov7 | ORL_GSW | Overs only | Aggressive | 4L 6.95% @8.033 | 6.1% | 353 |
| nov7 | ORL_GSW+SAS_POR | Overs only | Aggressive | 4L 6.86% @8.120 | 11.1% | 397 |
| nov7 | ORL_GSW+WAS_OKC | Overs only | Aggressive | 4L 6.81% @8.071 | 11.7% | 356 |
| nov7 | SAS_POR | Overs only | Aggressive | 4L 6.86% @8.120 | 10.7% | 415 |
| nov7 | SAS_POR+WAS_OKC | Overs only | Aggressive | 4L 6.81% @8.071 | 11.6% | 332 |
| nov7 | WAS_OKC | Overs only | Aggressive | 4L 7.04% @8.071 | 5.0% | 322 |

### 10 November (21:57 UTC, before the lock): the three levels at each filter case, with their legs

The page booted on the night's last lines.json and state.json (the pool `tools/fixtures/sp_ruler_nights.json` keeps), every level settled:

Default (922 legs):

- Safe ($2): 2 legs, 49.27% at 2.030: Jayson Tatum Under 1.5 stl -236; Keegan Murray Under 1.5 tpm -235
- Medium ($4): 2 legs, 25.00% at 4.000: Kyle Kuzma Under 4.5 reb +100; Payton Pritchard Under 2.5 reb +100
- Aggressive ($8): 3 legs, 12.50% at 8.000: Andrew Wiggins Under 4.5 ar +112; Jalen Green Under 2.5 ast +114; Sam Hauser Under 10.5 pra -131

Players only (890 legs):

- Safe ($2): 2 legs, 49.27% at 2.030: Jayson Tatum Under 1.5 stl -236; Keegan Murray Under 1.5 tpm -235
- Medium ($4): 2 legs, 25.00% at 4.000: Kyle Kuzma Under 4.5 reb +100; Payton Pritchard Under 2.5 reb +100
- Aggressive ($8): 3 legs, 12.50% at 8.000: Andrew Wiggins Under 4.5 ar +112; Jalen Green Under 2.5 ast +114; Sam Hauser Under 10.5 pra -131

Teams only (32 legs):

- Safe ($2): 2 legs, 45.31% at 2.033: BOS to win -117; NYK to win -1040
- Medium ($4): 2 legs, 22.81% at 4.022: MIA -9.5 -105; POR to win +106
- Aggressive ($8): 3 legs, 11.00% at 8.004: PHI to win -101; MIA -9.5 -105; POR to win +106

Overs only (372 legs):

- Safe ($2): 2 legs, 41.16% at 2.002: Bam Adebayo Over 0.5 tpm -241; Neemias Queta Over 0.5 blk -241
- Medium ($4): 3 legs, 18.20% at 4.007: Bam Adebayo Over 0.5 tpm -241; Joel Embiid Over 0.5 tpm -192; Robert Williams III Over 5.5 pts -116
- Aggressive ($8): 4 legs, 8.07% at 8.026: Bam Adebayo Over 0.5 tpm -241; Jamal Cain Over 8.5 pts -130; Jared McCain Over 11.5 pts -126; Neemias Queta Over 8.5 pts -127

Player unders off (404 legs):

- Safe ($2): 2 legs, 45.31% at 2.033: BOS to win -117; NYK to win -1040
- Medium ($4): 2 legs, 22.81% at 4.022: MIA -9.5 -105; POR to win +106
- Aggressive ($8): 3 legs, 11.00% at 8.004: PHI to win -101; MIA -9.5 -105; POR to win +106

Shortest -300 (920 legs):

- Safe ($2): 2 legs, 49.27% at 2.030: Jayson Tatum Under 1.5 stl -236; Keegan Murray Under 1.5 tpm -235
- Medium ($4): 2 legs, 25.00% at 4.000: Kyle Kuzma Under 4.5 reb +100; Payton Pritchard Under 2.5 reb +100
- Aggressive ($8): 3 legs, 12.50% at 8.000: Andrew Wiggins Under 4.5 ar +112; Jalen Green Under 2.5 ast +114; Sam Hauser Under 10.5 pra -131

Shortest -200 (898 legs):

- Safe ($2): 2 legs, 44.22% at 2.261: Andrew Wiggins Under 1.5 tpm -199; Brook Lopez Under 1.5 blk -198
- Medium ($4): 2 legs, 25.00% at 4.000: Kyle Kuzma Under 4.5 reb +100; Payton Pritchard Under 2.5 reb +100
- Aggressive ($8): 3 legs, 12.50% at 8.000: Andrew Wiggins Under 4.5 ar +112; Jalen Green Under 2.5 ast +114; Sam Hauser Under 10.5 pra -131

## What is left, said plainly

- **Custom filters on one- and two-game cuts.** 150 of the 1,533 levels timed stop on their work, every one at Overs
  only (69) or Player unders off (81), every one on a cut of one or two games, none on a whole night and none at the
  default filters. Each shows the best parlay found with its proven gap (the table above; the worst 39.0%). There every
  leg the filter leaves is impure (an Over, or a team leg at DraftKings' fair chance), so a game's groups cannot be put
  away by their price alone: R10 bounds a group of s such legs at HOLD times their factors, each about 1.5% over the
  leg's own p / I, and a game's four- and five-leg groups sit within that of the cut, each then worked by the integral.
  Making them settle wants a tighter bound on an impure group's C / J than R10's split (its tail is divided by the
  least chance a group may have, SPR_TH).
- **The work budget at the default filters.** The whole nights use at most 104,724 units of the 1,000,000 (7 November's
  Aggressive); the heaviest cut, 7 November's DEN at IND alone at Aggressive, 722,532. The count is the same on every
  machine (the answer never depends on the clock); its wall time is about 0.5 to 0.8 microseconds a unit in jsdom here.
  Since the review of 12 November the site's set (the default filters: the record's take, and the page's own copy of it)
  has `SPR_WORK_SITE`, 20 million units; any other filters `SPR_WORK`, a million. A million left two real nights of one
  game unsettled: of the 90 one-game cuts of the 14 nights' last pre-lock files (26 October to 12 November), 9 November's
  NOP at GSW alone at $4 needs 5.37 million (a pair of short Unders, $4.0204 at 22.286%, a hair under half a percent of
  the hold's envelope over $4, against size after size of groups at that envelope, each ruled out to a hundredth of a
  percent by its integrals) and 11 November's ORL at UTA alone at $8 1.78 million; the next, 7 November's DEN at IND at
  $8, 0.73 million. Every one settles within the site's work. The search is a generator since (`sprLevel`), paused every
  `SPR_SLICE` units (20,000) so the tab's soft build runs a level a slice a task; whole or sliced the same level and
  work, on 1,533 timed levels and 132 real cuts.
- **The tail.** The smoke's made-up night DF (three games of short Unders at -241, -384 and -385) leaves its Aggressive
  unsettled at 77,572 units whatever the work (9.72% found where 10.20% pays): R11 bounds every parlay longer than the
  most legs searched (K, six on three games) by its likeliest legs and the hold, and there that bound stands over the
  level. No real night measured meets it; a larger K for such nights is left.
- **The tie pass** completes on every level of every whole night; on 72 of the 210 levels of the cuts at the
  default filters it stops at its 60,000 units, and those levels meet (1)-(4) with no proof that a parlay of the same chance and
  lower slip keys does not exist (an exact tie is all but impossible on real legs; the made-up tie case is held).
- **One premise is measured, not proved**: the builder's `sgJoint` (GHK on 20,000 Halton points) is within SPR_SIG / 2
  (0.05%) of the orthant probability it stands for (measured within 1.3e-5 on triples). Main's search stands on the same
  (`SP_SLACK`).
- **Preconditions**, refused rather than searched: an edge leg (fair chance over its implied chance by more than 1e-12;
  the pool keeps none, its margin check), and a price of 2.9 or more (the pool's band, 45% to 97%, keeps every price under
  2.23). A game whose variables are not positive definite is searched on bounds that hold for the builder's shrunk matrix
  (the real tables are repaired by `tools/corr.js`, so this is the made-up case's path).
- **Wired** (the build step): the tab's sets (`spRB`), the record's take (`spEntry`) and a level built again after the
  lock (`spRebuild`), from `RULER_FROM`. The tie order (a tie on the chance to the lower sorted slip keys) holds since the
  review of 12 November: the frontier no longer drops a leg tied on the chance with a dearer one of a higher key.
- **For the owner, a follow-up**: the Parlay Builder's Top 50 still ranks team legs as Value picks on the model's chance
  (`legModel`), not on DraftKings' fair chance, though the evidence (research/sp_ruler, the team model against DraftKings'
  no-vig) is that the model loses to it. The ruler pool does not read the model at all; the Top 50 is untouched here.
