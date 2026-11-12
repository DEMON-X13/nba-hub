// THE SEARCH, prototype (design angle A): a branch and bound on one ruler, tolerance-aware, sizes in order.
// Page code (evaluated in the booted window): it calls the builder's own sums (parlayProb, parlayDec, joint2,
// spOrth, pbRho, amToDec, normInv) and nothing of the page's old search.
'use strict';
const PAGE_SEARCH = String.raw`
window.BNB = (() => {
  const TIE = 1e-12, FEPS = 1e-9;
  /* a bound that stands on the page's own integral (spOrth) rather than the builder's GHK sum is taken this much wider
     (the two agree within a few parts in 100,000: measured below) */
  const SLACK = 1e-3;
  const HOLD = () => (S.corr && S.corr.hold) || 1;
  const ok2 = () => !!(S.corr && S.corr.rho && S.corr.hold);
  const cmpSk = (a, b) => a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0;

  /* ---------- the pool made ready ---------- */
  function prep(legs) {
    const by = new Map();
    for (const l of legs) {
      const d = amToDec(l.price); if (!(d > 1) || !(l.p > 0 && l.p < 1)) continue;
      const x = { l, sk: l.sk || slipKey(l), gid: l.gid || l.id, p: l.p, d, I: 1 / d, e: l.p * d,
        side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', pid: l.kind === 'prop' ? String(l.pid) : null };
      x.t = normInv(1 - x.p); x.tI = normInv(1 - x.I);
      if (!by.has(x.gid)) by.set(x.gid, []); by.get(x.gid).push(x);
    }
    const games = [];
    for (const [gid, xs] of [...by].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      xs.sort((a, b) => (b.p - a.p) || cmpSk(a, b));
      xs.forEach((x, i) => { x.i = i; });
      /* by price, with the likeliest leg of every suffix (ties to the lower key): the last leg's lookup */
      const byD = [...xs].sort((a, b) => (a.d - b.d) || (b.p - a.p) || cmpSk(a, b)), suf = new Array(byD.length + 1).fill(null);
      for (let i = byD.length - 1; i >= 0; i--) { const y = byD[i], z = suf[i + 1]; suf[i] = !z || y.p > z.p || (y.p === z.p && y.sk < z.sk) ? y : z; }
      const g = { gid, xs, n: xs.length, byD, dArr: Float64Array.from(byD.map(x => x.d)), suf, pair: new Map(), grp: new Map(),
        eMax: xs.reduce((m, x) => Math.max(m, x.e), 0) };
      /* (B) the s-th likeliest leg bounds any option of s legs (a group lands no oftener than its least likely leg);
         the s dearest legs multiplied bound its price; a group of 2 or more returns at most HOLD (x SLACK) */
      g.pS = [1, ...xs.map(x => x.p)];
      const ds = xs.map(x => x.d).sort((a, b) => b - a); g.dS = [1]; for (const v of ds) g.dS.push(g.dS[g.dS.length - 1] * v);
      games.push(g);
    }
    return { games, m: games.length, nodes: 0, figs: 0, ghk: 0, orth: 0 };
  }
  /* the suffix tables of (B), for completions of r legs from games j on, groups allowed (gOn) or not */
  function tables(X, nMax, gOn) {
    const m = X.m, G = X.games, hold = HOLD() * (1 + SLACK);
    const mk = () => Array.from({ length: m + 1 }, () => new Float64Array(nMax + 1));
    const PK = mk(), DK = mk(), EK = mk();
    PK[m][0] = 1; DK[m][0] = 1; EK[m][0] = 1;
    for (let j = m - 1; j >= 0; j--) {
      const g = G[j];
      for (let r = 0; r <= nMax; r++) {
        let p = PK[j + 1][r], d = DK[j + 1][r], e = EK[j + 1][r];
        const sMax = Math.min(r, g.n, gOn ? r : 1);
        for (let s = 1; s <= sMax; s++) {
          p = Math.max(p, g.pS[s] * PK[j + 1][r - s]);
          d = Math.max(d, g.dS[s] * DK[j + 1][r - s]);
          e = Math.max(e, (s === 1 ? g.eMax : hold) * EK[j + 1][r - s]);
        }
        PK[j][r] = p; DK[j][r] = d; EK[j][r] = e;
      }
    }
    return { PK, DK, EK };
  }
  /* ---------- a game's legs together ---------- */
  const fits = (T, x) => !T.some(y => y === x || (x.pid && y.pid === x.pid) || (x.side && y.side) || (x.tot && y.tot));
  /* two legs by the copula itself: the builder's own two-leg sums (joint2, and the price min(prices multiplied, HOLD / J)) */
  function pair(X, g, a, b) {
    if (a.i > b.i) { const z = a; a = b; b = z; } const k = a.i * 4096 + b.i; let f = g.pair.get(k);
    if (!f) { const r = pbRho(a.l, b.l), J = joint2(a.I, b.I, r); f = { p: joint2(a.p, b.p, r), d: J > 0 ? Math.min(a.d * b.d, HOLD() / J) : a.d * b.d, J }; g.pair.set(k, f); }
    return f;
  }
  /* three or more legs: the page's own integral (spOrth) as the search's reading, {p, J, d}, null where not a valid
     copula; the builder's GHK sum (fig) only for a finalist */
  function sur(X, g, T) {
    if (T.length === 2) return pair(X, g, T[0], T[1]);
    const key = T.map(x => x.i).sort((a, b) => a - b).join(','); let f = g.grp.get(key);
    if (f !== undefined) return f;
    const R = T.map((a, i) => T.map((b, k) => i === k ? 1 : pbRho(a.l, b.l)));
    X.orth++;
    const p = T.length <= 5 ? spOrth(T.map(x => x.t), R) : null, J = p == null ? null : spOrth(T.map(x => x.tI), R);
    f = p == null || J == null ? null : { p, J, d: J > 0 ? Math.min(T.reduce((t, x) => t * x.d, 1), HOLD() / J) : T.reduce((t, x) => t * x.d, 1) };
    g.grp.set(key, f); return f;
  }
  /* the builder's own figures of a parlay: parlayProb and parlayDec on its legs in the builder's order (the numbers the
     card states) */
  function fig(legs) { X_FIG.n++; const L = pbOrder(legs.map(l => ({ ...l }))); return { p: parlayProb(L).corr, d: parlayDec(L.map(l => ({ leg: l, ml: l.price }))) }; }
  const X_FIG = { n: 0 };

  /* ---------- the best parlay of exactly n legs ----------
     Every parlay of n legs (2 or more; one option a game: a leg, or a group of the game's legs that go together, one
     leg a player, one side, one total) that pays F, with chance at least floor: the likeliest, ties (within TIE) to
     the lower ids. Minimal paying sets only: a branch that pays F with fewer than n legs is left (every parlay holding
     it is less likely and has a smaller paying part, which the sizes before rank: the caller searches sizes in order).
     With gOn false no group is formed (the caller has proved none can rank). Returns {best, done}: done false where the
     safety net stopped it. Groups of three legs or more are read by the page's integral; a finalist within its reach
     of the best (SLACK) is worked by the builder's own sums before it is ranked (exact: see refine) */
  function size(X, n, F, floor, gOn, cap) {
    const G = X.games, m = X.m, fl = F - FEPS, hold = HOLD();
    const T = tables(X, n, gOn), PK = T.PK, DK = T.DK, EK = T.EK;
    let best = null, nodes = 0, stop = false; const near = [];
    const thr = () => best ? Math.max(floor, best.p - TIE) : floor;
    const better = (c, b) => !b || c.p > b.p + TIE || (c.p >= b.p - TIE && c.ids < b.ids);
    const pick = [];
    /* a parlay reached: its legs as options; its chance and price as the search reads them (surrogate for groups of
       3+); kept as a near candidate where a group's reading stands on the integral */
    const leaf = (P, D, approx) => {
      const legs = pick.flatMap(o => o.T), ids = legs.map(x => x.sk).sort().join(',');
      const c = { p: P, d: D, n: legs.length, ids, legs, approx };
      if (approx) { near.push(c); if (!best || P * (1 + SLACK) >= best.p) {} }
      if (better(c, best)) best = c;
    };
    const rec = (j0, k, P, D, E) => {
      if (stop) return; if (++nodes > cap) { stop = true; return; }
      const r = n - k;
      for (let j = j0; j < m; j++) {
        if (P * PK[j][r] < thr() || P * E * 0 > 1) break;
        if (D * DK[j][r] < fl) break;
        if (E * EK[j][r] / F < thr() - TIE) break;
        const g = G[j];
        if (r === 1) {
          /* the last leg: the likeliest of the game's legs whose price takes the parlay to F (by price, then the
             likeliest of that suffix) */
          const need = fl / D; let lo = 0, hi = g.n; const A = g.dArr; while (lo < hi) { const mid = (lo + hi) >> 1; if (A[mid] < need) lo = mid + 1; else hi = mid; }
          const x = g.suf[lo]; if (!x) continue;
          const P2 = P * x.p; if (P2 < thr()) continue;
          pick.push({ T: [x] }); leaf(P2, D * x.d, false); pick.pop();
          continue;
        }
        /* a single leg of game j, then games after it */
        for (const x of g.xs) {
          const P2 = P * x.p; if (P2 * PK[j + 1][r - 1] < thr()) break;
          const D2 = D * x.d; if (D2 >= fl) continue;
          if (D2 * DK[j + 1][r - 1] < fl) continue;
          const E2 = E * x.e; if (E2 * EK[j + 1][r - 1] / F < thr() - TIE) continue;
          pick.push({ T: [x] }); rec(j + 1, k + 1, P2, D2, E2); pick.pop(); if (stop) return;
        }
        /* a group of s legs of game j (2 <= s <= r), then games after it */
        if (gOn && ok2() && g.n >= 2) for (let s = 2; s <= r; s++) groups(g, j, s, P, D, E, k);
        if (stop) return;
      }
    };
    /* the groups of s legs of game g after a branch (P, D, E, k legs): its legs in the game's order (likeliest first),
       each set that goes together; a set's chance at most its pairs' and its prefix's (it falls as a leg joins), its
       price at most its legs' prices multiplied, its return at most HOLD */
    const groups = (g, j, s, P, D, E, k) => {
      const r = n - k, rest = r - s, Tg = [];
      const grow = (i0, pub, pd) => {
        if (stop) return;
        for (let i = i0; i < g.n; i++) {
          const x = g.xs[i]; if (!fits(Tg, x)) continue;
          let ub = Math.min(pub, x.p);
          if (P * ub * PK[j + 1][rest] < thr()) break;            // later legs are less likely still
          for (const y of Tg) { ub = Math.min(ub, pair(X, g, y, x).p * (1 + 1e-9)); if (P * ub * PK[j + 1][rest] < thr()) break; }
          if (P * ub * PK[j + 1][rest] < thr()) continue;
          const pd2 = pd * x.d, left = s - Tg.length - 1;
          /* the price can still reach F: this set's legs' prices with the game's dearest left, and the later games' */
          if (D * pd2 * (left ? g.dS[left] : 1) * DK[j + 1][rest] < fl) continue;
          Tg.push(x);
          if (Tg.length === s) {
            nodes++;
            const f = sur(X, g, Tg);
            if (f) {
              const P2 = P * f.p, D2 = D * f.d, sl = s >= 3 ? 1 + SLACK : 1;
              if (rest === 0) { if (D2 * sl >= fl && P2 * sl >= thr()) { pick.push({ T: [...Tg], f }); leaf(P2, D2, s >= 3); pick.pop(); } }
              else if (D2 < fl * sl && P2 * sl * PK[j + 1][rest] >= thr() && D2 * sl * DK[j + 1][rest] >= fl) {
                pick.push({ T: [...Tg], f }); rec(j + 1, k + s, P2, D2, E * Math.min(f.p * f.d, hold * (1 + SLACK))); pick.pop(); }
            }
          } else grow(i + 1, ub, pd2);
          Tg.pop(); if (stop) return;
        }
      };
      grow(0, 1, 1);
    };
    rec(0, 0, 1, 1, 1);
    return { best, near, done: !stop, nodes };
  }
  /* the near candidates a group's reading put within its slack of the best, worked by the builder's own sums (the GHK
     sum), so the level is the rule's on the card's own numbers */
  function refine(res, F) {
    if (!res.best) return res.best;
    const cand = [res.best, ...res.near.filter(c => c !== res.best && c.p * (1 + SLACK) >= res.best.p * (1 - SLACK))];
    let best = null;
    for (const c of cand) {
      const f = fig(c.legs.map(x => x.l)); if (!(f.d >= F - FEPS)) continue;
      const cc = { ...c, p: f.p, d: f.d, approx: false };
      if (!best || cc.p > best.p + TIE || (cc.p >= best.p - TIE && cc.ids < best.ids)) best = cc;
    }
    return best;
  }

  /* ---------- THE RULE: within TOL of the likeliest, then the fewest legs, then the likeliest, then ids ----------
     Sizes in order, each the exact best of that many legs at or over the floor (1 - tol) x L (L the best found so far,
     any size), so a size under it is proved out of the band; P* (the likeliest of all) lies in [L, U], U the largest
     of L and what every size not yet searched can reach (the tables' bound, under the universal one: every leg returns
     at most $1 on $1 at its fair chance, a group at most HOLD, and a parlay paying F lands at most its return over F).
     A size is in the band once its best reaches (1 - tol) x U, out once under (1 - tol) x L; the first size in, with
     every size before it out, is the level's. Groups are searched only where a parlay holding one could reach the band
     (HOLD over F at or over (1 - tol) x L) */
  function level(legs, F, o) {
    o = o || {}; const tol = o.tol == null ? 0.005 : o.tol, cap = o.cap || 3e6, nMax = o.nMax || 16;
    const X = prep(legs), t0 = performance.now(); X_FIG.n = 0;
    if (!X.m) return { why: 'no legs', ms: 0 };
    const hold = HOLD() * (1 + SLACK), log = [];
    let gOn = false, L = 0, B = new Map(), total = 0, capped = false;
    for (let pass = 0; pass < 2; pass++) {
      const T = tables(X, nMax, gOn);
      /* the most a parlay of n legs or more can reach */
      const tail = new Float64Array(nMax + 2);
      for (let n = nMax; n >= 2; n--) tail[n] = Math.max(tail[n + 1], T.DK[0][n] >= F - FEPS ? Math.min(T.PK[0][n], T.EK[0][n] / F) : 0);
      let ans = null;
      for (let n = 2; n <= nMax; n++) {
        if (tail[n] < (1 - tol) * L && n > 2) {
          /* no size from n on can reach the band (nor P* beyond L) */
          break;
        }
        const r = size(X, n, F, Math.max(0, (1 - tol) * L - TIE), gOn, cap);
        total += r.nodes; if (!r.done) capped = true;
        const b = gOn ? refine(r, F) : r.best;
        B.set(n, b); log.push([n, gOn ? 'g' : 's', b ? +b.p.toFixed(6) : null, r.nodes]);
        if (b && b.p > L) L = b.p;
        const U = Math.max(L, tail[n + 1]);
        /* decided? the first size with a best, every one before it out (under (1 - tol) x L) */
        let dec = null;
        for (let k = 2; k <= n; k++) { const bk = B.get(k); if (!bk) continue;
          if (bk.p >= (1 - tol) * U - TIE) { dec = k; break; }
          if (bk.p >= (1 - tol) * L - TIE) { dec = -1; break; } }
        if (dec > 0) { ans = { n0: dec, best: B.get(dec), L, U }; break; }
      }
      if (!ans) {
        /* every size searched up to the tail's cut: P* = L exactly, the band decided */
        let k0 = null; for (const [k, b] of [...B].sort((a, b) => a[0] - b[0])) if (b && b.p >= (1 - tol) * L - TIE) { k0 = k; break; }
        if (k0) ans = { n0: k0, best: B.get(k0), L, U: L };
      }
      if (!gOn && hold / F >= (1 - tol) * L) { gOn = true; B = new Map(); log.push(['groups on']); continue; }
      return { ...(ans || { why: 'none' }), gOn, log, nodes: total, capped, ms: +(performance.now() - t0).toFixed(1), figs: X_FIG.n, orth: X.orth };
    }
  }
  return { prep, size, level, fig, tables };
})();
`;
module.exports = { PAGE_SEARCH };
