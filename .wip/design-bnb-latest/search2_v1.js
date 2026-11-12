// THE SEARCH, prototype 2 (design angle A, after measuring the costs): one ruler, a tolerance, the fewest legs.
// Page code, evaluated in the booted window: it calls the builder's own sums (parlayProb, parlayDec, joint2, pbRho,
// amToDec, normInv, spOrth) and nothing of the page's old search.
//
// THE RULE (a definition an enumeration can check):
//   every leg at DraftKings' fair chance (legFair); a parlay: 2 legs or more, one leg a player, one side and one total a
//   game, its chance and price the builder's own sums; it pays F when its price is F or more (within 1e-9).
//   C, the night's CEILING for F: the largest of (a) e_g x e_h over two different games g, h, e_g the best return
//   (chance x decimal price) of a leg of g, and (b) HOLD where a game has two legs that go together; over F. No paying
//   parlay lands oftener: each leg returns at most $1 on $1 at its fair chance, a game's legs together at most HOLD,
//   and a parlay paying F lands at most what it returns over F.
//   The BAND: if some paying parlay lands at (1 - TOL) x C or more, every paying parlay landing at (1 - TOL) x C or
//   more; else every paying parlay landing at (1 - TOL) x P* or more, P* the likeliest paying parlay's chance.
//   The LEVEL: the band's parlay with the fewest legs; of those, the first in the order OMEGA: legs ranked game by game
//   (games by id, a game's legs likeliest first, then by key), a parlay's legs in rank order, parlays compared
//   leg by leg (the first leg's rank, then the second's, ...).
'use strict';
const PAGE_SEARCH2 = String.raw`
window.BNB2 = (() => {
  const TIE = 1e-12, FEPS = 1e-9, SLACK = 1e-3;
  const HOLD = () => (S.corr && S.corr.hold) || 1;
  const ok2 = () => !!(S.corr && S.corr.rho && S.corr.hold);
  const cmpSk = (a, b) => a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0;
  const ST = { orth: 0, ghk: 0, nodes: 0 };

  function prep(legs) {
    const by = new Map();
    for (const l of legs) {
      const d = amToDec(l.price); if (!(d > 1) || !(l.p > 0 && l.p < 1)) continue;
      const x = { l, sk: l.sk || slipKey(l), gid: l.gid || l.id, p: l.p, d, I: 1 / d, e: l.p * d,
        side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', pid: l.kind === 'prop' ? String(l.pid) : null };
      x.t = normInv(1 - x.p); x.tI = normInv(1 - x.I);
      if (!by.has(x.gid)) by.set(x.gid, []); by.get(x.gid).push(x);
    }
    const games = []; let rk = 0;
    for (const [gid, xs] of [...by].sort((a, b) => a[0] < b[0] ? -1 : 1)) {
      xs.sort((a, b) => (b.p - a.p) || cmpSk(a, b));
      xs.forEach((x, i) => { x.i = i; x.rk = rk++; });
      /* by price, ascending, with the lowest-ranked (likeliest) leg of each suffix: the last leg's lookup */
      const byD = [...xs].sort((a, b) => (a.d - b.d) || (a.i - b.i)), suf = new Array(byD.length + 1).fill(null);
      for (let i = byD.length - 1; i >= 0; i--) { const y = byD[i], z = suf[i + 1]; suf[i] = !z || y.i < z.i ? y : z; }
      const g = { gid, xs, n: xs.length, byD, dArr: Float64Array.from(byD.map(x => x.d)), suf, pair: new Map(), grp: new Map(),
        eMax: xs.reduce((m, x) => Math.max(m, x.e), 0) };
      g.pS = [1, ...xs.map(x => x.p)];
      const ds = xs.map(x => x.d).sort((a, b) => b - a); g.dS = [1]; for (const v of ds) g.dS.push(g.dS[g.dS.length - 1] * v);
      g.two = xs.some((a, i) => xs.some((b, k) => k > i && fits([a], b)));
      { const best = new Map(); for (const x of xs) { const k = x.pid ? 'p' + x.pid : x.side ? 'side' : x.tot ? 'tot' : x.sk; if (!best.has(k) || best.get(k) < x.d) best.set(k, x.d); } g.dGo = [...best.values()].reduce((t, v) => t * v, 1); }
      games.push(g);
    }
    return { games, m: games.length };
  }
  const fits = (T, x) => !T.some(y => y === x || (x.pid && y.pid === x.pid) || (x.side && y.side) || (x.tot && y.tot));
  /* (S) Slepian's one-factor bound on a group of a game's legs (the review of 8 November 2026's (5)): each leg x's
     loading is the square root of m_x, its largest correlation (at least 0) with a leg of its game it may go with, so
     the one-factor matrix sqrt(m_i m_j) is at or above the group's own, entry by entry, and the group lands no oftener
     than that one-factor copula: OF = sum over the common factor's nodes of the legs' factors multiplied. Its price is at
     most its legs' prices multiplied, so it returns at most that times OF (and at most HOLD); a leg more multiplies the
     price by d and the factor by cf, at most max(1, d cf) at each node (the game's a largest such, Mk[a]). At implied
     thresholds (cfI) it bounds J, so the price is at least min(prices multiplied, HOLD / OF_I) */
  const EQ = (() => { const n = 48, out = []; for (let i = 1; i <= n; i++) { let x = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), w = 0;
      for (let it = 0; it < 100; it++) { let p0 = 1, p1 = x; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; }
        const dp = n * (x * p1 - p0) / (x * x - 1), dx = p1 / dp; x -= dx; w = 2 / ((1 - x * x) * dp * dp); if (Math.abs(dx) < 1e-15) break; }
      out.push([8 * x, 8 * w * Math.exp(-32 * x * x) / Math.sqrt(2 * Math.PI)]); } return out; })();
  const NQ = EQ.length, EQW = Float64Array.from(EQ.map(q => q[1]));
  function slep(g, nMax) {
    if (g.sl) return; g.sl = true;
    const xs = g.xs, n = xs.length;
    for (const x of xs) { let m = 0; for (const y of xs) if (y !== x && fits([x], y)) { const r = pbRho(x.l, y.l); if (r > m) m = r; }
      m = Math.min(m, 0.81); const sr = Math.sqrt(m), cr = Math.sqrt(1 - m);
      x.cf = new Float64Array(NQ); x.cfI = new Float64Array(NQ); x.dcf = new Float64Array(NQ);
      for (let k = 0; k < NQ; k++) { const z = EQ[k][0]; x.cf[k] = 1 - normCdf((x.t - sr * z) / cr); x.cfI[k] = 1 - normCdf((x.tI - sr * z) / cr); x.dcf[k] = Math.max(1, x.d * x.cf[k]); } }
    const A = Math.min(n, nMax + 1); g.Mk = [];
    for (let a = 0; a <= A; a++) g.Mk.push(new Float64Array(NQ));
    for (let k = 0; k < NQ; k++) { const v = xs.map(x => x.dcf[k]).sort((a, b) => b - a); let pr = 1; g.Mk[0][k] = 1; for (let a = 1; a <= A; a++) { pr *= v[a - 1]; g.Mk[a][k] = pr; } }
  }
  const ofSum = (col, M) => { let s = 0; if (M) for (let k = 0; k < NQ; k++) s += EQW[k] * col[k] * M[k]; else for (let k = 0; k < NQ; k++) s += EQW[k] * col[k]; return s; };
  /* (B) suffix tables: the most r more legs from games j on can land (each option no likelier than its s-th likeliest
     leg), cost (its s dearest legs multiplied) and return (a leg its own, a group HOLD) */
  function tables(X, nMax, gOn) {
    const m = X.m, G = X.games, hold = HOLD() * (1 + SLACK);
    const mk = () => Array.from({ length: m + 1 }, () => new Float64Array(nMax + 1));
    const PK = mk(), DK = mk(), EK = mk(); PK[m][0] = 1; DK[m][0] = 1; EK[m][0] = 1;
    for (let j = m - 1; j >= 0; j--) { const g = G[j];
      for (let r = 0; r <= nMax; r++) { let p = PK[j + 1][r], d = DK[j + 1][r], e = EK[j + 1][r];
        const sMax = Math.min(r, g.n, gOn ? r : 1);
        for (let s = 1; s <= sMax; s++) { p = Math.max(p, g.pS[s] * PK[j + 1][r - s]); d = Math.max(d, g.dS[s] * DK[j + 1][r - s]); e = Math.max(e, (s === 1 ? g.eMax : hold) * EK[j + 1][r - s]); }
        PK[j][r] = p; DK[j][r] = d; EK[j][r] = e; } }
    return { PK, DK, EK };
  }
  /* the night's ceiling for F (the rule's C): the most a paying parlay can land, by the universal bound on what it
     returns, over two kinds that can pay F:
     - one leg a game (no group): for each set S of 2 games or more whose dearest legs multiplied reach F, the least of
       its games' best returns multiplied over F and its games' likeliest legs multiplied;
     - holding a game's legs together (a group: 2 or more legs of one game that go together), which returns at most
       HOLD: the least of HOLD over F and the game's second-likeliest leg's chance (a group lands no oftener than its
       legs), where that game's legs that go together with the other games' dearest can reach F */
  function ceiling(X, F) {
    const G = X.games, m = G.length, fl = F - FEPS; let cs = 0, cg = 0;
    const dMax = G.map(g => g.dS[1]), eMax = G.map(g => g.eMax), pMax = G.map(g => g.pS[1]);
    for (let s = 0; s < (1 << m); s++) { let k = 0, D = 1, E = 1, P = 1;
      for (let i = 0; i < m; i++) if (s >> i & 1) { k++; D *= dMax[i]; E *= eMax[i]; P *= pMax[i]; }
      if (k >= 2 && D >= fl) cs = Math.max(cs, Math.min(E / F, P)); }
    if (ok2()) for (let i = 0; i < m; i++) { const g = G[i]; if (!g.two) continue;
      let D = g.dGo; for (let h = 0; h < m; h++) if (h !== i) D *= dMax[h];
      if (D >= fl) cg = Math.max(cg, Math.min(HOLD() / F, g.pS[2])); }
    return Math.max(cs, cg);
  }
  /* a game's legs together: two by the builder's own two-leg sums (exact); three to five by the page's own integral
     (spOrth, a reading within a few parts in 100,000 of the builder's GHK sum); six or more by the builder's sum */
  function pair(g, a, b) {
    if (a.i > b.i) { const z = a; a = b; b = z; } const k = a.i * 4096 + b.i; let f = g.pair.get(k);
    if (!f) { const r = pbRho(a.l, b.l), J = joint2(a.I, b.I, r); f = { p: joint2(a.p, b.p, r), d: J > 0 ? Math.min(a.d * b.d, HOLD() / J) : a.d * b.d, ex: true }; g.pair.set(k, f); }
    return f;
  }
  function grp(g, T) {
    if (T.length === 2) return pair(g, T[0], T[1]);
    const key = T.map(x => x.i).join(','); let f = g.grp.get(key); if (f !== undefined) return f;
    const pd = T.reduce((t, x) => t * x.d, 1);
    if (T.length <= 5) { const R = T.map((a, i) => T.map((b, k) => i === k ? 1 : pbRho(a.l, b.l))); ST.orth++;
      const p = spOrth(T.map(x => x.t), R), J = p == null ? null : spOrth(T.map(x => x.tI), R);
      f = p == null || J == null ? exact(T) : { p, d: J > 0 ? Math.min(pd, HOLD() / J) : pd, ex: false };
    } else f = exact(T);
    g.grp.set(key, f); return f;
  }
  /* the builder's own figures of one game's legs together (the GHK sum): exact, by definition */
  function exact(T) { ST.ghk++; const L = T.map(x => x.l), p = parlayProb(L).corr, d = parlayDec(L.map(l => ({ leg: l, ml: l.price }))); return { p, d, ex: true }; }
  /* a parlay's figures by the builder's own sums, legs in the builder's order: the numbers the card states */
  function card(legs) { const L = pbOrder(legs.map(l => ({ ...l }))), pr = parlayProb(L); return { legs: L, p: pr.corr, d: parlayDec(L.map(l => ({ leg: l, ml: l.price }))) }; }

  /* ---------- the walk over parlays of exactly n legs, in the order OMEGA ----------
     mode 'scan': the first parlay (in OMEGA) paying F and landing at T or more; mode 'max': the largest chance of a
     paying parlay (over T). Only minimal paying sets: a branch paying F with fewer than n legs is left (each parlay
     through it is less likely and holds a smaller paying parlay, which the sizes before decide). Bounds: (1) a
     parlay's chance falls as a leg joins it and its price rises; the tables (B); the universal bound E / F.
     A group of three legs or more is read by the page's integral (within RS of the builder's GHK sum); a leaf the
     reading cannot place on one side of the bar (or of F) by RS is worked by the builder's own sums */
  const RS = 2e-4;
  const lexLt = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i]; return a.length < b.length; };
  function walk(X, n, F, T0, mode, gOn, cap) {
    const G = X.games, m = X.m, fl = F - FEPS;
    const Tb = tables(X, n, gOn), PK = Tb.PK, DK = Tb.DK, EK = Tb.EK;
    let T = T0, found = null, nodes = 0, stop = false; const pick = [], near = []; let sTop = 0;
    /* the bar a branch must be able to reach: in 'scan' T; in 'max' just over the best so far, the best exact one's or
       a reading's (RS under it, so a group the reading puts a hair low is not lost) */
    const thr = () => mode === 'scan' ? T : Math.max(T, found ? found.p * (1 + TIE) : 0, sTop / (1 + RS));
    const take = (P, D, ex) => {
      const legs = pick.flatMap(o => o.T);
      if (!ex) {
        /* the reading: plainly over the bar and F, plainly under, or the builder's own sums decide */
        if (P * (1 + RS) < thr() || D * (1 + RS) < fl) return false;
        if (mode === 'max') { near.push({ legs, p: P, d: D }); if (P > sTop) sTop = P; return true; }
        if (!(P * (1 - RS) >= T && D * (1 - RS) >= fl)) { const c = card(legs.map(x => x.l)); ST.ghk++; if (!(c.d >= fl) || !(c.p >= T)) return false; P = c.p; D = c.d; }
      } else if (!(P >= thr()) || !(D >= fl)) return false;
      found = { p: P, d: D, n: legs.length, legs, ranks: legs.map(x => x.rk) };
      if (mode === 'scan') stop = true;
      return true;
    };
    const rec = (j0, k, P, D, E, ex) => {
      if (stop) return; if (++nodes > cap) { stop = 'cap'; return; }
      const r = n - k;
      for (let j = j0; j < m; j++) {
        const t = thr();
        if (P * PK[j][r] < t || D * DK[j][r] < fl || E * EK[j][r] / F < t) break;
        const g = G[j];
        if (r === 1) {
          /* the last leg: of game j's legs whose price takes the parlay to F, the likeliest (its lowest rank) */
          const need = fl / D, A = g.dArr; let lo = 0, hi = g.n; while (lo < hi) { const mid = (lo + hi) >> 1; if (A[mid] < need) lo = mid + 1; else hi = mid; }
          const x = g.suf[lo]; if (!x || P * x.p < thr() / (ex ? 1 : 1 + RS)) continue;
          pick.push({ T: [x] }); take(P * x.p, D * x.d, ex); pick.pop(); if (stop) return;
          continue;
        }
        /* in OMEGA the groups of game j through leg x come before x alone with later games (a group's next leg ranks
           under any later game's), so each leg starts the game's groups first, then goes alone */
        for (const x of g.xs) {
          const P1 = P * x.p;
          if (P1 < thr()) break;
          if (gOn && ok2() && g.n >= 2) { slep(g, n); grow(g, j, [x], x.i + 1, P, D, E, k, ex, x.p, x.d, x.cf, x.cfI); if (stop) return; }
          if (P1 * PK[j + 1][r - 1] < thr()) continue;
          const D1 = D * x.d; if (D1 >= fl || D1 * DK[j + 1][r - 1] < fl) continue;
          const E1 = E * x.e; if (E1 * EK[j + 1][r - 1] / F < thr()) continue;
          pick.push({ T: [x] }); rec(j + 1, k + 1, P1, D1, E1, ex); pick.pop(); if (stop) return;
        }
      }
    };
    /* a game's groups through Tg (its legs in rank order): each next leg x after its last; in OMEGA a group grown more
       comes before it ended here with later games, and both before the next x */
    const hold = HOLD() * (1 + SLACK);
    const grow = (g, j, Tg, i0, P, D, E, k, ex, pub, pd, col, colI) => {
      const s0 = Tg.length;
      for (let i = i0; i < g.n; i++) {
        if (stop) return;
        const x = g.xs[i]; if (!fits(Tg, x)) continue;
        const s = s0 + 1, rest = n - k - s; if (rest < 0) return;
        let ub = Math.min(pub, x.p);
        if (P * ub < thr()) break;                                     // later legs are less likely still
        for (const y of Tg) ub = Math.min(ub, pair(g, y, x).p * (1 + 1e-9));
        if (P * ub < thr()) continue;
        /* (S): the group's own bound */
        const col2 = new Float64Array(NQ), colI2 = new Float64Array(NQ);
        for (let q = 0; q < NQ; q++) { col2[q] = col[q] * x.cf[q]; colI2[q] = colI[q] * x.cfI[q]; }
        const OF = ofSum(col2) * (1 + 1e-9); ub = Math.min(ub, OF);
        if (P * ub < thr()) continue;
        const pd2 = pd * x.d;
        /* the price can still reach F: this group's legs' prices multiplied with the game's dearest for any more of
           its legs, or the later games' */
        let dm = 0; for (let a2 = 0; a2 <= rest; a2++) dm = Math.max(dm, g.dS[Math.min(a2, g.n)] * DK[j + 1][rest - a2]);
        if (D * pd2 * dm < fl) continue;
        /* what the group returns, now and grown by a more of its game's legs, with the later games' (S, and the tables):
           a branch that cannot reach the bar so is left */
        const eb0 = Math.min(hold, pd2 * OF);
        let ebm = eb0 * EK[j + 1][rest];
        for (let a2 = 1; a2 <= rest && a2 < g.Mk.length; a2++) ebm = Math.max(ebm, Math.min(hold, pd2 * ofSum(col2, g.Mk[a2]) * (1 + 1e-9)) * EK[j + 1][rest - a2]);
        if (E * ebm / F < thr()) continue;
        if (++nodes > cap) { stop = 'cap'; return; }
        const T2 = [...Tg, x];
        /* it pays F already, surely (its price at least min(prices multiplied, HOLD over the bound on J)): no minimal paying
           set of n legs grows from it */
        const surePays = Math.min(pd2, HOLD() / (ofSum(colI2) * (1 + 1e-9))) >= fl;
        /* closed here (a leaf, or later games after it): only where its own return bound reaches the bar is it worked */
        const closeOk = E * eb0 * EK[j + 1][rest] / F >= thr() && D * pd2 * DK[j + 1][rest] >= fl;
        let f = null;
        if (closeOk || (rest > 0 && !surePays)) {
          if (closeOk) f = grp(g, T2);
        }
        if (rest === 0) {
          if (f) { const sl = f.ex ? 1 : 1 + RS, P2 = P * f.p, D2 = D * f.d; if (D2 * sl >= fl && P2 * sl >= thr()) { pick.push({ T: T2 }); take(P2, D2, ex && f.ex); pick.pop(); } }
          continue;
        }
        const sl = f ? (f.ex ? 1 : 1 + RS) : 1;
        /* it pays F already (by its figures): every parlay through it is no minimal paying set of n legs */
        if (surePays || (f && D * f.d >= fl * sl)) continue;
        /* grown more first, then ended here with later games */
        grow(g, j, T2, i + 1, P, D, E, k, ex, f ? Math.min(ub, f.p * sl) : ub, pd2, col2, colI2); if (stop) return;
        if (f) { const P2 = P * f.p, D2 = D * f.d, E2 = E * Math.min(f.p * f.d * sl, hold);
          if (P2 * sl * PK[j + 1][rest] >= thr() && D2 * sl * DK[j + 1][rest] >= fl && E2 * EK[j + 1][rest] / F >= thr()) {
            pick.push({ T: T2 }); rec(j + 1, k + s, P2, D2, E2, ex && f.ex); pick.pop(); } }
      }
    };
    rec(0, 0, 1, 1, 1, true);
    /* 'max' with readings near the top: the builder's own sums on every one within 2 RS of the best */
    if (mode === 'max' && near.length) {
      const top = Math.max(found ? found.p : 0, sTop);
      for (const c of near) if (c.p * (1 + 2 * RS) >= top) { const cc = card(c.legs.map(x => x.l)); ST.ghk++; const rk = c.legs.map(x => x.rk);
        if (cc.d >= fl && cc.p >= T && (!found || cc.p > found.p + TIE || (Math.abs(cc.p - found.p) <= TIE && lexLt(rk, found.ranks)))) found = { p: cc.p, d: cc.d, n: c.legs.length, legs: c.legs, ranks: rk }; }
    }
    return { found, nodes, stop };
  }

  /* ---------- the rule ---------- */
  function level(legs, F, o) {
    o = o || {}; const tol = o.tol == null ? 0.005 : o.tol, cap = o.cap || 4e6, nMax = o.nMax || 16, t0 = performance.now();
    ST.orth = 0; ST.ghk = 0;
    const X = prep(legs); if (X.m === 0) return { why: 'no legs' };
    const C = ceiling(X, F), hold = HOLD() * (1 + SLACK), log = []; let nodes = 0, capped = false;
    const tail = (gOn, T) => { const Tb = tables(X, nMax, gOn), t = new Float64Array(nMax + 2);
      for (let n = nMax; n >= 2; n--) t[n] = Math.max(t[n + 1], Tb.DK[0][n] >= F - FEPS ? Math.min(Tb.PK[0][n], Tb.EK[0][n] / F) : 0); return t; };
    /* sizes in order, each walked for the first parlay of the band in OMEGA */
    const scan = (Tb, gOn, tl) => { for (let n = 2; n <= nMax; n++) { if (tl[n] < Tb) break;
        const tw = performance.now(), o0 = ST.orth; const w = walk(X, n, F, Tb, 'scan', gOn, cap); nodes += w.nodes; if (w.stop === 'cap') capped = true;
        log.push(['scan', n, gOn ? 'g' : 's', w.nodes, w.found ? +w.found.p.toFixed(6) : null, Math.round(performance.now() - tw), ST.orth - o0, w.stop || '']);
        if (w.found) return { n0: n, ...w.found }; } return null; };
    /* 1. near the ceiling: a parlay of the band (1 - tol) x C; groups only where one can reach it */
    const TC = (1 - tol) * C, gC = ok2() && hold / F >= TC;
    let r = scan(TC, gC, tail(gC));
    if (r) return out(o.pick === 'likeliest' ? likeliest(r, TC, gC) : r, 'ceiling', C, null);
    /* 2. below the ceiling: P* exact (the largest chance of a paying parlay, sizes in order), then the band (1 - tol) x P* */
    let Ps = 0, gOn = false;
    for (let pass = 0; pass < 2; pass++) {
      const tl = tail(gOn);
      for (let n = 2; n <= nMax; n++) { if (tl[n] <= Ps) break;
        const tw = performance.now(), o0 = ST.orth; const w = walk(X, n, F, Ps, 'max', gOn, cap); nodes += w.nodes; if (w.stop === 'cap') capped = true;
        log.push(['max', n, gOn ? 'g' : 's', w.nodes, w.found ? +w.found.p.toFixed(6) : null, Math.round(performance.now() - tw), ST.orth - o0, w.stop || '']);
        if (w.found && w.found.p > Ps) Ps = w.found.p; }
      if (!gOn && ok2() && hold / F > Ps) { gOn = true; continue; }
      break;
    }
    if (!(Ps > 0)) return { why: 'no paying parlay', log, nodes, ms: performance.now() - t0 };
    const TP = (1 - tol) * Ps, gP = ok2() && hold / F >= TP;
    r = scan(TP, gP, tail(gP));
    return out(r && o.pick === 'likeliest' ? likeliest(r, TP, gP) : r, 'best', C, Ps);
    /* the variant 'then the likeliest': of the band's parlays of n0 legs, the likeliest (ties to the first in OMEGA) */
    function likeliest(r, T, g) { const w = walk(X, r.n0, F, T, 'max', g, cap); nodes += w.nodes; if (w.stop === 'cap') capped = true;
      log.push(['likeliest', r.n0, g ? 'g' : 's', w.nodes, w.found ? +w.found.p.toFixed(6) : null]);
      return w.found && (w.found.p > r.p + TIE || (Math.abs(w.found.p - r.p) <= TIE && lexLt(w.found.ranks, r.ranks))) ? { n0: r.n0, ...w.found } : r; }
    function out(r, kind, C, Ps) {
      if (!r) return { why: 'none', kind, C, Ps, log, nodes, ms: performance.now() - t0 };
      const c = card(r.legs.map(x => x.l));
      return { kind, C, Ps, n0: r.n0, p: c.p, d: c.d, legs: c.legs, ranks: r.ranks, log, nodes, capped, orth: ST.orth, ghk: ST.ghk, ms: +(performance.now() - t0).toFixed(1) };
    }
  }
  return { prep, tables, ceiling, walk, level, card, ST };
})();
`;
module.exports = { PAGE_SEARCH2 };
