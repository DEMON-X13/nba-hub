/* THE TOLERANCE SEARCH (design angle B), a prototype evaluated into the booted page's realm, on the page's own sums.
 *
 * A parlay is at most one UNIT a game: a single leg, or a same-game group (two legs or more of one game that go together:
 * one leg a player, one side, one total). Units of different games are independent, so a parlay's chance C and price D
 * are the products of its units' own (the builder's own sums: a single at its chance and price; a group at sgJoint of its
 * legs' chances, and min(the prices multiplied, HOLD / J), J the copula's joint chance of their implied chances). Every
 * unit's return r = c x d is at most 1 on one ruler (an Under's is 1 by legFair, an Over's and a team leg's under 1, a
 * group's at most HOLD): so any parlay paying F lands at most R / F <= 1 / F of the time.
 *
 * THE RULE, as a definition an enumeration can check (DP.rule):
 *   V    = every parlay of 2 legs or more of the pool (one unit a game) whose price D >= F - 1e-9;
 *   q(P) = Math.round(C(P) x 1e12), C(P) the product of its units' chances in the order of their game ids;
 *   q*   = max over V of q;
 *   E    = { P in V : q(P) >= (1 - TAU) x q* };
 *   the level is the P in E with the fewest legs, then the highest q, then the least ids (its legs' slip keys sorted and
 *   joined by ","), compared as strings; none where V is empty.
 *
 * THE SEARCH, by the fewest legs first (DP.level):
 *   for k = 2, 3, ...: B_k = the exact best k-leg parlay (BEST, a branch and bound that never cuts a parlay that could
 *   rank first among k-leg ones); it is the level when q(B_k) >= (1 - TAU) x U (U an upper bound on every parlay's
 *   chance, proven below), or when no parlay of any size has (1 - TAU) x C > C(B_k) (EXCEED, the same walk stopped at the
 *   first parlay over the bar). A k whose bound U_k cannot reach (1 - TAU) x L (L the best chance found) is skipped.
 *   Since the levels before k failed, the first k that passes is the rule's fewest legs, and B_k its highest q.
 *
 * The walk's cuts (each a proof that no parlay of the branch can pass the bar theta):
 *   (a) a parlay's chance only falls as a unit joins it (every unit's chance is at most 1): a branch below theta ends;
 *       units of a game are tried likeliest first, so the first under theta ends the game's loop;
 *   (b) a branch that pays the floor is a candidate and is never grown: every parlay holding it is less likely and has
 *       more legs, so it never ranks above it (a minimal parlay: the rule's level is never one with a paying part);
 *   (c) return: an incomplete branch with return r still needs a unit, each returns at most the most any unit of a later
 *       game returns (Rsuf), and the parlay pays F or more, so it lands at most r x Rsuf / F;
 *   (d) price: an incomplete branch can pay F only if its price times the most every later game's longest unit pays
 *       (Dsuf) reaches F;
 *   (e) groups: a group returns at most HOLD x (1 + EPSG) (its chance at fair chances is at most J, the same copula at its
 *       implied ones, and it is priced at most HOLD / J; EPSG covers the GHK sum's own noise on three legs or more), so a
 *       night whose best parlay without one is over that bar (times 1 - TAU) needs no group at all, and a group of three
 *       legs or more is screened by the page's own integral (spOrth, within 3.3e-5 of the GHK sum on random groups)
 *       before the GHK sum works it.
 */
module.exports = String.raw`
var DP = (function () {
  const TAU = 0.005, EPSG = 2e-3, QS = 1e12, KMAX = 12, FE = 1e-9, ORTH_SLACK = 2e-4;
  const qOf = c => Math.round(c * QS);
  function prep(legs, opt) {
    opt = opt || {};
    const hold = S.corr && S.corr.rho && S.corr.hold ? S.corr.hold : null, byG = new Map();
    for (const l of legs) {
      const d = amToDec(l.price); if (!(d > 1) || !(l.p > 0 && l.p < 1)) continue;
      const x = { l, sk: l.sk, gid: l.gid, pid: l.kind === 'prop' ? String(l.pid) : null, side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', p: l.p, d, I: propImplied(l.price) };
      x.r = x.p * x.d;
      if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(x);
    }
    const games = [...byG.keys()].sort().map((gid, gi) => {
      const xs = byG.get(gid).sort((a, b) => a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0);
      xs.forEach((x, i) => { x.i = i; x.gi = gi; });
      const singles = xs.map(x => ({ n: 1, c: x.p, d: x.d, r: x.r, legs: [x] }));
      return { gid, gi, xs, singles, units: singles.slice().sort((a, b) => b.c - a.c || (a.legs[0].sk < b.legs[0].sk ? -1 : 1)), pairs: null, groups: false, rho: new Map() };
    });
    const X = { games, hold, G: games.length, stats: { nodes: 0, cands: 0, pairs: 0, orth: 0, ghk: 0, tri: 0 }, memo: new Map() };
    return X;
  }
  const fits = (a, b) => a.sk !== b.sk && !(a.pid && a.pid === b.pid) && !(a.side && b.side) && !(a.tot && b.tot);
  function rho(X, g, a, b) { const k = a.i < b.i ? a.i * 4096 + b.i : b.i * 4096 + a.i; let r = g.rho.get(k); if (r === undefined) { r = pbRho(a.l, b.l) || 0; g.rho.set(k, r); } return r; }
  /* a same-game group's figures by the builder's own sums, exactly as parlayProb and slipDec work them (the legs in
     sgOrder: their slip keys sorted; two legs by joint2, more by the GHK sum) */
  function groupFig(X, T) {
    const L = T.map(x => x.l), key = T.map(x => x.sk).sort().join('~');
    let f = X.memo.get(key); if (f) return f;
    if (T.length === 2) {
      const [a, b] = T[0].sk < T[1].sk ? [T[0], T[1]] : [T[1], T[0]], g = X.games[a.gi], r = rho(X, g, a, b);
      const c = joint2(a.p, b.p, r), J = joint2(a.I, b.I, r), mult = a.d * b.d;
      f = { c, d: J > 0 && X.hold ? Math.min(mult, X.hold / J) : mult };
    } else {
      X.stats.ghk++;
      f = { c: parlayProb(L).corr, d: slipDec(L.map(l => Object.assign({}, l, { odds: l.price }))).dec };
    }
    X.memo.set(key, f); return f;
  }
  /* a game's groups, made where a level asks for them (groupsOn): its pairs by the copula's own sums (joint2: exact and
     cheap), every one that goes together; groups of three legs or more where a level needs them (tri) */
  function groupsOn(X, g, maxN, bar) {
    if (!X.hold) return;
    if (!g.pairs) {
      g.pairs = [];
      for (let i = 0; i < g.xs.length; i++) for (let j = i + 1; j < g.xs.length; j++) {
        const a = g.xs[i], b = g.xs[j]; if (!fits(a, b)) continue;
        const f = groupFig(X, [a, b]); X.stats.pairs++;
        g.pairs.push({ n: 2, c: f.c, d: f.d, r: f.c * f.d, legs: [a, b] });
      }
      g.units = g.singles.concat(g.pairs).sort((a, b) => b.c - a.c || (a.legs.map(x => x.sk).join() < b.legs.map(x => x.sk).join() ? -1 : 1));
    }
    if (maxN >= 3 && !g.tri) triOn(X, g);
  }
  /* triples: every three legs of a game that go together, screened by bounds of their own (their chance at most their
     likeliest pair's, their price at most their prices multiplied), then by the page's own integral (spOrth) of their
     chance and their implied chance, within ORTH_SLACK of the GHK sum, and only then worked by the builder's own sums;
     kept as units with an upper figure (cu, du) where not yet worked (the walk works a unit before it ranks it) */
  function triOn(X, g) {
    g.tri = [];
    const xs = g.xs, n = xs.length, P2 = new Map();
    for (const u of g.pairs) P2.set(u.legs[0].i * 4096 + u.legs[1].i, u);
    const pr = (a, b) => P2.get(a.i < b.i ? a.i * 4096 + b.i : b.i * 4096 + a.i);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const ab = pr(xs[i], xs[j]); if (!ab) continue;
      for (let k = j + 1; k < n; k++) { const ac = pr(xs[i], xs[k]), bc = pr(xs[j], xs[k]); if (!ac || !bc) continue;
        const a = xs[i], b = xs[j], c = xs[k];
        const cu = Math.min(ab.c, ac.c, bc.c), du = a.d * b.d * c.d;
        g.tri.push({ n: 3, c: cu, d: du, r: Math.min(X.hold * (1 + EPSG), cu * du), legs: [a, b, c], up: true }); } }
    X.stats.tri += g.tri.length;
    g.units = g.units.concat(g.tri).sort((a, b) => b.c - a.c);
  }
  /* a unit's exact figures, worked where the walk reaches it with an upper figure */
  function exactUnit(X, g, u) {
    if (!u.up) return u;
    /* the integral first: if even its figures with the slack cannot pass, the GHK sum is not needed */
    const T = u.legs, R = T.map((a, i) => T.map((b, k) => i === k ? 1 : rho(X, g, a, b)));
    X.stats.orth++;
    const oc = spOrth(T.map(x => normInv(1 - x.p)), R), oJ = spOrth(T.map(x => normInv(1 - x.I)), R);
    if (oc == null || oJ == null) { const f = groupFig(X, T); return { n: u.n, c: f.c, d: f.d, r: f.c * f.d, legs: T, up: false }; }
    const mult = T.reduce((t, x) => t * x.d, 1);
    u.oc = oc * (1 + ORTH_SLACK); u.od = Math.min(mult, X.hold / (oJ * (1 - ORTH_SLACK)));
    u.worked = () => { const f = groupFig(X, T); return { n: u.n, c: f.c, d: f.d, r: f.c * f.d, legs: T, up: false }; };
    return u;
  }
  const idsOf = units => units.flatMap(u => u.legs.map(x => x.sk)).sort().join(',');
  /* the walk: every minimal parlay of k legs (k 0: any size from 2) whose chance reaches theta, by the cuts above;
     sink(units, c, d, n) answers a new bar (best mode) or 'stop' (exceed mode) */
  function walk(X, Fe, theta, k, sink, budget) {
    const G = X.G;
    /* (c'): a unit that returns under theta x F cannot be in a parlay over theta (every other unit returns at most 1),
       so each game's units are cut to those that can, by chance (likeliest first) and by price */
    const rmin = theta * Fe * (1 - 1e-9), withG = X.groupsLive;
    const games = X.games.map(g => { const us = (withG ? g.units : g.singles.slice().sort((a, b) => b.c - a.c)).filter(u => u.r >= rmin);
      return { g, units: us, byD: us.slice().sort((a, b) => a.d - b.d), rmax: us.reduce((m, u) => Math.max(m, u.r), 0), dmax: us.reduce((m, u) => Math.max(m, u.d), 1) }; });
    /* (c), (d): the most any unit of a later game returns, and the most every later game's longest unit pays */
    const Rsuf = new Float64Array(G + 1), Dsuf = new Float64Array(G + 1); Rsuf[G] = 0; Dsuf[G] = 1;
    for (let j = G - 1; j >= 0; j--) { Rsuf[j] = Math.max(Rsuf[j + 1], games[j].rmax); Dsuf[j] = Dsuf[j + 1] * games[j].dmax; }
    let th = theta, nodes = 0, stop = false; const ch = [];
    const lb = (a, t) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].d >= t) hi = m; else lo = m + 1; } return lo; };
    const emit = (u, c2, d2, n2) => { X.stats.cands++; ch.push(u); const t = sink(ch, c2, d2, n2); ch.pop(); if (t === 'stop') { stop = true; return; } if (t > th) th = t; };
    const rec = (j, c, d, n, r) => {
      if (stop) return;
      if (++nodes > budget) { stop = 'budget'; return; }
      if (r * Rsuf[j] < th * Fe) return;
      if (d * Dsuf[j] < Fe) return;
      const t = Fe / d;
      for (let gi = j; gi < G && !stop; gi++) {
        const gw = games[gi], g = gw.g;
        /* the units that pay the floor with the branch (their price at least t): likeliest is not their order, so the
           loop runs by price from t up and ends where the most the game returns over the price cannot reach the bar */
        const bd = gw.byD;
        for (let i = lb(bd, t); i < bd.length; i++) {
          let u = bd[i];
          if (c * gw.rmax / u.d < th) break;
          if (k ? n + u.n > k : false) continue;
          if (c * u.c < th) continue;
          if (u.up) { u = exactUnit(X, g, u); if (u.up) { if (c * u.oc < th) continue; u = u.worked(); } }
          const c2 = c * u.c, d2 = d * u.d, n2 = n + u.n;
          if (c2 < th) continue;
          if (d2 >= Fe) { if (k ? n2 === k : n2 >= 2) emit(u, c2, d2, n2); if (stop) return; continue; }
          /* a group whose upper price reached t and whose own does not: grown like any other */
          if (k && n2 >= k) continue;
          if (d2 * Dsuf[gi + 1] < Fe) continue;
          ch.push(u); rec(gi + 1, c2, d2, n2, r * u.r); ch.pop(); if (stop) return;
        }
        /* the units that do not pay it: grown, likeliest first, while their chance can reach the bar */
        if (k && n + 1 >= k) continue;
        const us = gw.units;
        for (let ui = 0; ui < us.length; ui++) {
          let u = us[ui];
          if (c * u.c < th) break;
          if (u.d >= t) continue;
          if (k && n + u.n >= k) continue;
          if (u.up) { u = exactUnit(X, g, u); if (u.up) { if (c * u.oc < th) continue; u = u.worked(); } }
          const c2 = c * u.c, d2 = d * u.d, n2 = n + u.n;
          if (c2 < th) continue;
          if (d2 * Dsuf[gi + 1] < Fe) continue;
          ch.push(u); rec(gi + 1, c2, d2, n2, r * u.r); ch.pop(); if (stop) return;
        }
      }
    };
    rec(0, 1, 1, 0, 1);
    X.stats.nodes += nodes;
    return { nodes, stop, th };
  }
  /* the exact best parlay of k legs with chance at least theta: the highest q, then the least ids (none: null) */
  function best(X, Fe, k, theta, budget) {
    let bq = -1, bc = 0, bd = 0, bids = null, bu = null;
    const w = walk(X, Fe, theta, k, (ch, c, d, n) => {
      const q = qOf(c); if (q < bq) return 0;
      const ids = idsOf(ch);
      if (q > bq || ids < bids) { bq = q; bc = c; bd = d; bids = ids; bu = ch.slice(); }
      return c * (1 - 2e-12);
    }, budget);
    return { found: !!bu, c: bc, d: bd, q: bq, ids: bids, units: bu, n: bu ? bu.reduce((t, u) => t + u.n, 0) : 0, walk: w };
  }
  /* is there a parlay (any size from 2) with (1 - TAU) x C > bar? the first found, else none */
  function exceed(X, Fe, bar, budget) {
    let hit = null;
    const theta = bar / (1 - TAU);
    const w = walk(X, Fe, theta * (1 - 1e-12), 0, (ch, c, d, n) => { if ((1 - TAU) * qOf(c) > qOf(bar)) { hit = { c, d, n, ids: idsOf(ch), units: ch.slice() }; return 'stop'; } return 0; }, budget);
    return { hit, walk: w };
  }
  /* the level at a floor F: the rule's parlay, with the bound it was proven against. First on single legs alone (each
     game at most one leg): where its best parlay is over HOLD x (1 + EPSG) / F times 1 / (1 - TAU), no parlay holding a
     group can be within the tolerance of it, nor be the best (e), and it is the night's level; else the night's groups
     join and the walk runs again on every unit */
  function level(X, F, opt) {
    opt = opt || {};
    const t0 = performance.now(), hold = X.hold ? X.hold * (1 + EPSG) : 0;
    X.groupsLive = false;
    const a = kloop(X, F, 0, opt);
    a.phase = 'singles';
    if (!X.hold || a.why.startsWith('budget') || (1 - TAU) * a.L > hold / F) { a.ms = performance.now() - t0; a.stats = Object.assign({}, X.stats); return a; }
    X.groupsLive = true;
    for (const g of X.games) groupsOn(X, g, opt.tri === false ? 2 : 3, (1 - TAU) * a.L * (F - FE));
    const b = kloop(X, F, a.L, opt);
    b.phase = 'groups'; b.log = a.log.concat(['-- groups --'], b.log);
    b.ms = performance.now() - t0; b.stats = Object.assign({}, X.stats); return b;
  }
  function kloop(X, F, L0, opt) {
    const Fe = F - FE, budget = opt.budget || 5e6, log = [], hold = X.hold ? X.hold * (1 + EPSG) : 0;
    let L = L0, res = null, why = 'no parlay';
    /* U: a parlay lands at most its return over F; its return is at most the two best units' of two games, or a
       group's alone where groups are live */
    const best1 = g => (X.groupsLive ? g.units : g.singles).reduce((m, u) => u.n === 1 && u.r > m ? u.r : m, 0);
    let r1 = 0, r2 = 0; for (const g of X.games) { const m = best1(g); if (m > r1) { r2 = r1; r1 = m; } else if (m > r2) r2 = m; }
    const U = Math.max(r1 * r2, X.groupsLive ? hold : 0) / F;
    for (let k = 2; k <= KMAX; k++) {
      if (U < (1 - TAU) * L) { log.push('U under the bar'); break; }
      const b = best(X, Fe, k, (1 - TAU) * L, budget);
      if (b.walk.stop === 'budget') { why = 'budget at k=' + k; break; }
      log.push(k + ': best ' + (b.found ? (b.c * F).toFixed(6) + 'xF' : 'none') + ' (' + b.walk.nodes + ')');
      if (!b.found) continue;
      if (b.c > L) L = b.c;
      if (qOf(b.c) >= (1 - TAU) * qOf(U)) { res = b; why = 'U at k=' + k; break; }
      const e = exceed(X, Fe, b.c, budget);
      if (e.walk.stop === 'budget') { why = 'budget in exceed at k=' + k; break; }
      log.push(k + ': exceed ' + (e.hit ? (e.hit.c * F).toFixed(6) + 'xF ' + e.hit.n + ' legs' : 'none') + ' (' + e.walk.nodes + ')');
      if (!e.hit) { res = b; why = 'no parlay over the bar at k=' + k; break; }
      if (e.hit.c > L) L = e.hit.c;
    }
    return { res, why, log, L, U };
  }
  return { TAU, EPSG, prep, level, best, exceed, walk, groupFig, groupsOn, qOf, idsOf };
})();
`;
