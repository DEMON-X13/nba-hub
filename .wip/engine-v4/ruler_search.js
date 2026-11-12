/* ---------- THE RULER SEARCH: one level of a ruler pool, within a stated tolerance of the likeliest ----------
   (dev copy; the comment that ships is in app/parts/suggested.html) */
const SPR_TAU = 0.005, SPR_ETA = 0.001, SPR_EPS2 = 4e-4, SPR_EPSR = 5e-5, SPR_REL = 1e-12, SPR_EONE = 1 + 1e-12, SPR_OFS = 1e-3;
const SPR_K = 16, SPR_WORK = 4e6;
const SPR_COST = { node: 1, at: 2, j2: 3, o3: 40, o4: 250, o5: 2200, ghk: 9000, of: 2 };
const sprCmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
const sprIds = T => T.map(x => x.sk).sort(sprCmp);
function sprIdsLess(a, b) { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i]; return a.length < b.length; }
/* a candidate { units, c, d, n, ids }: a is better than b, the likelier by more than SPR_REL, then the first by ids */
function sprBetter(a, b) {
  if (!a) return false; if (!b) return true;
  if (a.c > b.c * (1 + SPR_REL)) return true; if (b.c > a.c * (1 + SPR_REL)) return false;
  return sprIdsLess(a.ids, b.ids);
}
const sprFits = (T, x) => !T.some(y => y === x || (x.pid && y.pid === x.pid) || (x.side && y.side) || (x.tot && y.tot));
function sprWork(W, what, n) { n = n || 1; W.used += SPR_COST[what] * n; W[what] = (W[what] || 0) + n; if (W.used > W.budget) throw W; }

/* ---------- the pool made ready ---------- */
function sprPrep(legs) {
  const ok2 = !!(S.corr && S.corr.rho && S.corr.hold), hold = ok2 ? +S.corr.hold : 0, by = new Map();
  for (const l of legs) {
    const d = amToDec(l.price), p = l.p; if (!(d > 1) || !(p > 0 && p < 1)) continue;
    const I = propImplied(l.price), sk = l.sk || slipKey(l), gid = l.gid || l.id;
    const x = { l, sk, gid, pid: l.kind === 'prop' ? String(l.pid) : null, side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', p, d, I, e: p * d, pure: p >= I * (1 - 1e-12) };
    x.t = normInv(1 - p); x.tI = normInv(1 - I);
    if (!by.has(gid)) by.set(gid, []); by.get(gid).push(x);
  }
  const X = { ok2, hold, games: [], ghk: new Map() };
  for (const gid of [...by.keys()].sort(sprCmp)) {
    const xs = by.get(gid).sort((a, b) => sprCmp(a.sk, b.sk)), gi = X.games.length, n = xs.length;
    xs.forEach((x, i) => { x.gi = gi; x.i = i; });
    const fr = xs.filter(y => !xs.some(x => x !== y && x.d >= y.d && x.p >= y.p && (x.p > y.p || x.sk < y.sk)))
      .sort((a, b) => (a.d - b.d) || (b.p - a.p) || sprCmp(a.sk, b.sk));
    const g = { gid, gi, xs, n, fr, frD: Float64Array.from(fr.map(x => x.d)),
      eMax: fr.reduce((m, x) => Math.max(m, x.e), 0), dMax: fr.reduce((m, x) => Math.max(m, x.d), 0), pMax: fr.reduce((m, x) => Math.max(m, x.p), 0),
      R: new Float64Array(n * n).fill(NaN), pairs: null, pairAt: null, est: new Map() };
    g.byP = [...xs].sort((a, b) => (b.p - a.p) || sprCmp(a.sk, b.sk));
    g.byP.forEach((x, i) => { x.bp = i; });
    /* the most legs a parlay can hold of this game: one a player, one side and one total */
    g.maxLegs = new Set(xs.filter(x => x.pid).map(x => x.pid)).size + (xs.some(x => x.side) ? 1 : 0) + (xs.some(x => x.tot) ? 1 : 0);
    const ds = xs.map(x => x.d).sort((a, b) => b - a); g.topD = [1]; for (const v of ds) g.topD.push(g.topD[g.topD.length - 1] * v);
    g.two = ok2 && g.maxLegs >= 2;
    g.pd = null;
    X.games.push(g);
  }
  return X;
}
const sprRho = (g, a, b) => { const k = a.i * g.n + b.i; let r = g.R[k]; if (r !== r) { r = pbRho(a.l, b.l); g.R[k] = r; g.R[b.i * g.n + a.i] = r; } return r; };
/* a game's likeliest frontier leg with a price of lo or more (its frontier's first there), or null */
function sprAt(g, lo) {
  const a = g.frD; let i = 0, j = a.length;
  while (i < j) { const m = (i + j) >> 1; if (a[m] >= lo) j = m; else i = m + 1; }
  return i < a.length ? g.fr[i] : null;
}
/* the one-factor bound of (R6) on a game, worked once: each leg's chance factor at each node of SP_EQ at its loading (a
   player's aP, a side's or total's aT: aP aP, aP aT and aT aT at or over the game's largest correlation of two players, a
   player with a team leg, and the side with the total, so the one-factor matrix is at or over every group's entry by
   entry), and that times its price; and node by node the products of the game's k largest of each */
function sprOf(X, g) {
  if (g.of) return g.of;
  let rPP = 0, rPT = 0, rTT = 0;
  for (let i = 0; i < g.n; i++) for (let j = i + 1; j < g.n; j++) { const a = g.xs[i], b = g.xs[j]; if (!sprFits([a], b)) continue;
    const r = Math.max(0, sprRho(g, a, b)); if (a.pid && b.pid) rPP = Math.max(rPP, r); else if (a.pid || b.pid) rPT = Math.max(rPT, r); else rTT = Math.max(rTT, r); }
  let aP = Math.max(Math.sqrt(rPP), rPT, 1e-6), aT = Math.max(Math.sqrt(rTT), rPT / aP);
  if (aT > 0.9) { aT = 0.9; aP = Math.max(aP, rPT / 0.9); }
  const ok = aP <= 0.9 && aT <= 0.9;
  const col = (t, a) => { const sr = a, cr = Math.sqrt(1 - a * a); return SP_EQ.map(([w]) => spUp(t, sr, cr, w)); };
  for (const x of g.xs) { x.cf = ok ? col(x.t, x.pid ? aP : aT) : SP_EQ.map(() => 1); x.fd = x.cf.map(v => v * x.d); }
  const tops = key => SP_EQ.map((_, i) => { const v = g.xs.map(x => x[key][i]).sort((a, b) => b - a), pp = [1]; for (const y of v) pp.push(pp[pp.length - 1] * y); return pp; });
  g.of = { aP, aT, ok, fdTop: tops('fd') };
  return g.of;
}
/* (R6): the most a group holding the legs T and m more of its game can return */
function sprOfR(X, g, T, m, W) {
  const of = sprOf(X, g); if (!of.ok) return Infinity;
  sprWork(W, 'of', T.length + 1);
  let s = 0; for (let i = 0; i < SP_EQ.length; i++) { let f = SP_EQ[i][1]; for (const x of T) f *= x.fd[i]; const tp = of.fdTop[i]; f *= tp[Math.min(m, tp.length - 1)]; s += f; }
  return s * (1 + SPR_OFS);
}

/* ---------- a game's legs together ---------- */
/* every pair of a game that goes together, by the builder's own two-leg sums (joint2 on the legs in sgOrder, at their
   chances and at their implied ones; the price min(their prices multiplied, HOLD / J)): exact */
function sprPairs(X, g, W) {
  if (g.pairs) return g.pairs;
  g.pairs = []; g.pairAt = new Map();
  for (let i = 0; i < g.n; i++) for (let j = i + 1; j < g.n; j++) {
    const a = g.xs[i], b = g.xs[j]; if (!sprFits([a], b)) continue;
    sprWork(W, 'j2', 2);
    const r = sprRho(g, a, b), c = joint2(a.p, b.p, r), J = joint2(a.I, b.I, r), mult = a.d * b.d;
    const d = J > 0 && isFinite(J) && X.hold ? Math.min(mult, X.hold / J) : mult;
    const u = { T: [a, b], n: 2, c, J, d, cLo: c, cHi: c, dLo: d, dHi: d, exact: true, pure: a.pure && b.pure };
    g.pairs.push(u); g.pairAt.set(a.i * g.n + b.i, u);
  }
  return g.pairs;
}
const sprPair = (g, a, b) => g.pairAt.get(Math.min(a.i, b.i) * g.n + Math.max(a.i, b.i)) || null;
/* a group of three to five legs by the page's own integral (spOrth on the legs in sgOrder, at their chances and at their
   implied ones): the builder's GHK sum is within SPR_EPS2 of it (R7), so its chance lies in [cLo, cHi] and its price in
   [dLo, dHi]; a group of fair legs alone has its chance equal to its J. null where the game's matrix is not positive
   definite (the builder shrinks it) or the integral fails */
function sprEst(X, g, T, W) {
  const n = T.length; if (n < 3 || n > 5) return null;
  if (g.pd == null) g.pd = spPosDef(g.xs.map(x => ({ l: x.l })));
  if (!g.pd) return null;
  const key = T.map(x => x.i).sort((a, b) => a - b).join(','); if (g.est.has(key)) return g.est.get(key);
  const L = [...T].sort((a, b) => sprCmp(a.sk, b.sk)), R = L.map((a, i) => L.map((b, j) => i === j ? 1 : sprRho(g, a, b) || 0));
  sprWork(W, n === 3 ? 'o3' : n === 4 ? 'o4' : 'o5');
  const C = spOrth(L.map(x => x.t), R), J = L.every(x => x.pure) ? C : spOrth(L.map(x => x.tI), R);
  let u = null;
  if (C != null && J != null && C > 0 && J > 0) {
    const mult = L.reduce((t, x) => t * x.d, 1), dL = Math.min(mult, X.hold / (J * (1 + SPR_EPS2))), dH = Math.min(mult, X.hold / (J * (1 - SPR_EPS2)));
    u = { T: L, n, cm: C, Jm: J, cLo: C * (1 - SPR_EPS2), cHi: Math.min(C * (1 + SPR_EPS2), J * (1 + SPR_EPS2) * (1 + SPR_EPSR)), dLo: dL, dHi: dH, exact: false, pure: L.every(x => x.pure) };
  }
  g.est.set(key, u); return u;
}
/* a group's own figures by the builder's own sums (parlayProb and parlayDec: the GHK sum on three legs or more) */
function sprGhk(X, g, T, W) {
  const key = T.map(x => x.sk).sort(sprCmp).join('~'); if (X.ghk.has(key)) return X.ghk.get(key);
  if (T.length > 2) sprWork(W, 'ghk');
  const L = T.map(x => x.l), c = parlayProb(L).corr, d = parlayDec(L.map(l => ({ leg: l, ml: l.price })));
  const u = { T: [...T].sort((a, b) => sprCmp(a.sk, b.sk)), n: T.length, c, d, cLo: c, cHi: c, dLo: d, dHi: d, exact: true, pure: T.every(x => x.pure) };
  X.ghk.set(key, u); return u;
}

/* ---------- the singles ----------
   The likeliest parlay of exactly k legs, one a game, from the games G, its price times base Fe or more, its chance times
   c0 at least T; null where none reaches T. Exact for chances of T or more (each cut a bound on the branch, R2, R3) */
function sprTabs(G, k, key) {
  const m = G.length, t = [];
  for (let j = 0; j <= m; j++) { const v = G.slice(j).map(g => g[key]).sort((a, b) => b - a), row = [1];
    for (let r = 1; r <= k; r++) row.push(r <= v.length ? row[r - 1] * v[r - 1] : 0); t.push(row); }
  return t;
}
function sprSingles(X, G0, Fe, k, T, W, o) {
  o = o || {};
  const G = G0.filter(g => g.fr.length), m = G.length; if (k === 0) return null; if (m < k) return null;
  const Pt = sprTabs(G, k, 'pMax'), Et = sprTabs(G, k, 'eMax'), Dt = sprTabs(G, k, 'dMax'), d0 = o.d0 || 1, c0 = o.c0 || 1, r0 = o.r0 || 1;
  let best = null; const pick = [], any = o.mode === 'any', STOP = {};
  const thr = () => Math.max(T, best ? best.c * (1 - 2 * SPR_REL) : 0);
  const dfs = (j, mm, c, d, r) => {
    sprWork(W, 'node');
    const need = k - mm;
    if (need === 1) {
      for (let h = j; h < m; h++) { sprWork(W, 'at'); const x = sprAt(G[h], Fe / d); if (!x) continue;
        const C = c * x.p; if (C < thr()) continue;
        pick.push(x); const cand = { T: pick.slice(), c: C, d: d * x.d, ids: sprIds(pick) }; pick.pop();
        if (sprBetter(cand, best)) best = cand; if (any) throw STOP; }
      return;
    }
    for (let h = j; h <= m - need; h++) {
      const g = G[h], dn = Dt[h + 1][need - 1], pn = Pt[h + 1][need - 1], en = Et[h + 1][need - 1];
      if (d * g.dMax * dn < Fe || c * g.pMax * pn < thr() || r * g.eMax * en * SPR_EONE < thr() * Fe) continue;
      for (const x of g.fr) {
        const c2 = c * x.p; if (c2 * pn < thr()) break;
        if (d * x.d * dn < Fe || r * x.e * en * SPR_EONE < thr() * Fe) continue;
        pick.push(x); dfs(h + 1, mm + 1, c2, d * x.d, r * x.e); pick.pop();
      }
    }
  };
  try { dfs(0, 0, c0, d0, r0); } catch (e) { if (e !== STOP) throw e; }
  if (o.out) o.out.stop = any && !!best;
  return best;
}

/* ---------- parlays holding a group, of exactly k legs ----------
   One group of a game A (s legs, 2 <= s <= k) and k - s singles of the other games (one a game), its chance T or more.
   A parlay of two groups or more returns at most HOLD^2 (1 + SPR_EPSR)^2 (R2, R4), so over the floor it lands at most
   that over F (R3): where that is under T there is none to search, else the search says so (two) and its bound keeps
   them. Each game's groups grown leg by leg, its legs likeliest first (byP), and left where, for every group of s legs
   holding the legs so far:
     its chance, at most the least of theirs and their pairs' (R5, a pair's exact by joint2, a longer group's within
     SPR_EPS2 of its copula's, R7), times the likeliest k - s singles of the other games, is under max(T, the best found)
     (R2) (and so for every later leg of the game, no likelier than this one: the loop ends);
     its price, at most its legs' multiplied with the game's dearest legs to come (R5), times the dearest singles, is
     under the floor (R2);
     its return, at most HOLD (1 + SPR_EPSR) (R4) and the one-factor bound (R6), times the most returning singles, over
     the floor, is under max(T, the best found) (R2, R3).
   A whole group is worked by the builder's own sums where it is a pair (exact), else by the page's own integral (three to
   five legs, R7) and, where that leaves it in reach, the builder's GHK sum; its singles by sprSingles (exact). mode 'any'
   stops at the first parlay of T or more (it then bounds nothing); else every parlay of T or more is looked at, and the
   bound is the best found's chance, or T where none */
function sprGroupK(X, Fe, k, T, W, mode) {
  const res = { best: null, hi: 0, two: false, done: false, stop: false };
  if (!X.ok2) { res.done = true; return res; }
  const hG = X.hold * (1 + SPR_EPSR), twoG = X.games.filter(g => g.two);
  if (!twoG.length) { res.done = true; return res; }
  if (k >= 4 && twoG.length >= 2 && hG * hG * SPR_EONE >= T * Fe) res.two = true;
  const thr = () => Math.max(T, res.best ? res.best.c * (1 - 2 * SPR_REL) : 0);
  const STOP = {};
  const consider = cand => { if (cand.c < thr() || cand.d < Fe) return; if (sprBetter(cand, res.best)) res.best = cand; if (mode === 'any') throw STOP; };
  try {
    for (const A of twoG) {
      const others = X.games.filter(g => g !== A && g.fr.length);
      const Pt = sprTabs(others, k, 'pMax'), Et = sprTabs(others, k, 'eMax'), Dt = sprTabs(others, k, 'dMax');
      sprPairs(X, A, W);
      for (let s = 2; s <= Math.min(k, A.maxLegs); s++) {
        const r = k - s; if (r > others.length) continue;
        const po = Pt[0][r], eo = Et[0][r], dob = Dt[0][r];
        if (A.topD[s] * dob < Fe || hG * eo * SPR_EONE < thr() * Fe) continue;
        const finish = u => {
          /* a whole group: its singles, or itself alone */
          if (r === 0) { if (u.dLo >= Fe && u.cLo >= thr()) consider({ units: [u], c: u.c, d: u.d, n: k, ids: sprIds(u.T) }); return; }
          const comp = sprSingles(X, others, Fe, r, thr(), W, { d0: u.d, c0: u.c, r0: u.c * u.d });
          if (comp) consider({ units: [u, ...comp.T.map(x => ({ T: [x], n: 1, c: x.p, d: x.d, exact: true }))], c: comp.c, d: comp.d, n: k, ids: sprIds([...u.T, ...comp.T]) });
        };
        const grow = (T0, from, cB, dP) => {
          const t = T0.length + 1;
          for (let ix = from; ix < A.byP.length; ix++) {
            const x = A.byP[ix];
            sprWork(W, 'node');
            /* the chance: no likelier than this leg, and later legs are no likelier (the loop ends) */
            if (Math.min(cB, x.p) * po < thr()) break;
            if (!sprFits(T0, x)) continue;
            let c1 = Math.min(cB, x.p);
            for (const y of T0) { const q = sprPair(A, y, x); c1 = Math.min(c1, s === 2 ? q.c : q.c * (1 + SPR_EPS2)); }
            if (c1 * po < thr()) continue;
            const dP2 = dP * x.d, T2 = [...T0, x];
            if (t < s) {
              if (dP2 * A.topD[s - t] * dob < Fe) continue;
              if (hG * eo * SPR_EONE >= thr() * Fe && t >= 1) { const rb = Math.min(hG, sprOfR(X, A, T2, s - t, W)); if (rb * eo * SPR_EONE < thr() * Fe) continue; }
              grow(T2, ix + 1, c1, dP2);
              continue;
            }
            /* a whole group of s legs */
            if (dP2 * dob < Fe) continue;
            let u = s === 2 ? sprPair(A, T2[0], T2[1]) : sprEst(X, A, T2, W);
            if (u) {
              if (u.cHi * po < thr() || u.dHi * dob < Fe || Math.min(u.cHi * u.dHi, hG) * eo * SPR_EONE < thr() * Fe) continue;
              if (r === 0 && (u.dHi < Fe || u.cHi < thr())) continue;
              if (!u.exact && r > 0 && !sprSingles(X, others, Fe, r, thr(), W, { d0: u.dHi, c0: u.cHi, r0: Math.min(u.cHi * u.dHi, hG) })) continue;
            } else {
              const ob = Math.min(hG, sprOfR(X, A, T2, 0, W));
              if (ob * eo * SPR_EONE < thr() * Fe) continue;
            }
            if (!u || !u.exact) u = sprGhk(X, A, T2, W);
            finish(u);
          }
        };
        grow([], 0, 1, 1);
      }
    }
    res.done = true;
  } catch (e) { if (e === STOP) res.stop = true; else throw e; }
  if (res.done) res.hi = Math.max(res.best ? res.best.c : T, res.two ? hG * hG * SPR_EONE / Fe : 0);
  return res;
}

/* ---------- the level ---------- */
function sprSolve(X, F, W) {
  const Fe = F - SP_FLOOR_EPS, G = X.games, hG = X.hold * (1 + SPR_EPSR);
  const maxN = G.reduce((t, g) => t + g.maxLegs, 0), K = Math.min(SPR_K, maxN), Gs = G.filter(g => g.fr.length), ms = Gs.length;
  const log = [];
  if (maxN < 2) return { none: true, why: 'legs', log };
  const P0 = sprTabs(Gs, K + 1, 'pMax'), E0 = sprTabs(Gs, K + 1, 'eMax'), D0 = sprTabs(Gs, K + 1, 'dMax');
  const twoG = X.ok2 ? G.filter(g => g.two) : [];
  /* the coarse bounds, by size: singles (R2, R3), and parlays holding a group, which return at most HOLD (1 + SPR_EPSR)
     times their singles' (R4) and cost at most their legs' prices multiplied (R5) */
  /* the dearest a parlay of exactly k legs holding a group can be: a game's s legs at most its s dearest multiplied (one
     side, one total and one leg a player: at most maxLegs), a single at most its game's dearest frontier leg; a DP over
     the games, with or without a group so far */
  const GD = (() => { const NO = 0; let a = [new Float64Array(maxN + 1), new Float64Array(maxN + 1)]; a[0][0] = 1;
    for (const g of G) { const b = [Float64Array.from(a[0]), Float64Array.from(a[1])];
      for (let n = 0; n <= maxN; n++) for (const h of [0, 1]) { const v = a[h][n]; if (!(v > NO)) continue;
        if (g.fr.length && n + 1 <= maxN) b[h][n + 1] = Math.max(b[h][n + 1], v * g.dMax);
        if (g.two) for (let s2 = 2; s2 <= g.maxLegs && n + s2 <= maxN; s2++) b[1][n + s2] = Math.max(b[1][n + s2], v * g.topD[s2]); }
      a = b; }
    return a[1]; })();
  const gFeas = k => X.ok2 && k <= maxN && GD[k] >= Fe;
  const Z = [];
  for (let k = 0; k <= K; k++) {
    const sH = k >= 2 && k <= ms && D0[0][k] >= Fe ? Math.min(P0[0][k], E0[0][k] * SPR_EONE / Fe) : 0;
    const gH = k >= 2 && gFeas(k) ? hG * SPR_EONE / Fe : 0;
    Z.push({ k, s: { hi: sH, lo: null, T: Infinity, any: Infinity }, g: { hi: gH, lo: null, T: Infinity, any: Infinity, two: false } });
  }
  /* sizes past K: their singles' and groups' coarse bounds (none where no parlay is longer) */
  const tail = maxN > K ? Math.max(K + 1 <= ms && D0[0][K + 1] >= Fe ? E0[0][K + 1] * SPR_EONE / Fe : 0, twoG.length ? hG * SPR_EONE / Fe : 0) : 0;
  let Lo = 0, Lb = null;
  const bestOf = z => sprBetter(z.s.lo, z.g.lo) ? z.s.lo : z.g.lo;
  const took = (z, cand) => { if (cand && cand.c > Lo) { Lo = cand.c; Lb = cand; } };
  const singles = (k, T, mode) => { const z = Z[k], st = {}, b = sprSingles(X, Gs, Fe, k, T, W, { mode, out: st });
    if (b && sprBetter(b, z.s.lo && { c: z.s.lo.c, ids: z.s.lo.ids })) { z.s.lo = { units: b.T.map(x => ({ T: [x], n: 1, c: x.p, d: x.d, exact: true })), c: b.c, d: b.d, n: k, ids: b.ids }; took(z, z.s.lo); }
    if (!st.stop) { z.s.T = Math.min(z.s.T, T); z.s.hi = Math.min(z.s.hi, b ? b.c : T); }
    else z.s.any = Math.min(z.s.any, T);
    log.push(`s${k}${st.stop ? '?' : ''}@${T.toPrecision(6)}:${b ? b.c.toPrecision(6) : '-'}`); };
  const groups = (k, T, mode) => { const z = Z[k], r = sprGroupK(X, Fe, k, T, W, mode);
    if (r.best && sprBetter(r.best, z.g.lo)) { z.g.lo = r.best; took(z, r.best); }
    if (mode === 'any') z.g.any = Math.min(z.g.any, T);
    if (r.done) { z.g.T = Math.min(z.g.T, T); z.g.hi = Math.min(z.g.hi, r.hi); z.g.two = r.two; }
    log.push(`g${k}${mode === 'any' ? '?' : ''}@${T.toPrecision(6)}:${r.best ? r.best.c.toPrecision(6) : '-'}${r.two ? '(two)' : ''}`); };
  /* the singles' own best pair, exact; then each size's singles, smallest first, at the top of their bound (any parlay
     there: it is within ETA of every parlay of its size), until one is within ETA of every parlay (U0) */
  const U0 = () => { let u = tail; for (let k = 2; k <= K; k++) u = Math.max(u, Z[k].s.hi, Z[k].g.hi); return u; };
  if (Z.length > 2 && Z[2].s.hi > 0) singles(2, 0, 'best');
  for (let k = 3; k <= Math.min(K, ms); k++) { if (Lo >= (1 - SPR_ETA) * U0()) break; if (Z[k].s.hi > 0) singles(k, (1 - SPR_ETA) * Z[k].s.hi, 'any'); }
  for (let it = 0; it < 400; it++) {
    const th = (1 - SPR_TAU + SPR_ETA) * Lo;
    let U = tail; for (let k = 2; k <= K; k++) U = Math.max(U, Z[k].s.hi, Z[k].g.hi);
    if (!(U > 0)) return { none: true, why: 'pays', log };
    let acted = false;
    for (let k = 2; k <= K && !acted; k++) {
      const z = Z[k], hi = Math.max(z.s.hi, z.g.hi);
      /* (3): no parlay of k legs reaches th */
      if (hi < th) continue;
      const b = bestOf(z);
      if (b && b.c >= (1 - SPR_ETA) * hi * (1 + SPR_REL) && b.c >= (1 - SPR_TAU) * U * (1 + SPR_REL))
        return { b, k, U, hi, Lo, th, exact: b.c >= hi * (1 - SPR_REL), log };
      /* (4) not yet: the part over b's reach searched, first at its top, then down to th */
      const need = b ? b.c / (1 - SPR_ETA) : 0;
      for (const part of ['s', 'g']) {
        if (acted) break;
        const q = z[part]; if (q.hi <= need * (1 - SPR_REL) || q.hi < th) continue;
        const run = part === 's' ? singles : groups;
        if (q.any === Infinity && q.T === Infinity) { run(k, (1 - SPR_ETA) * q.hi, 'any'); acted = true; }
        else if (q.T > th * (1 + SPR_REL)) { run(k, th, 'best'); acted = true; }
      }
      if (acted) break;
      if (!(b && b.c >= (1 - SPR_ETA) * hi * (1 + SPR_REL))) return { unsettled: q2why(z), b, k, U, hi, Lo, th, log };
      /* (2) not yet: the sizes whose bound is over b's chance over (1 - TAU) searched at that */
      const T2 = b.c / ((1 - SPR_TAU) * (1 + 4 * SPR_REL));
      for (let j = 2; j <= K && !acted; j++) {
        if (j === k) continue;
        const y = Z[j];
        if (y.s.hi > T2 * (1 + SPR_REL) && y.s.T > T2) { singles(j, T2, 'any'); acted = true; }
        else if (y.g.hi > T2 * (1 + SPR_REL) && y.g.any > T2 && y.g.T > T2) { groups(j, T2, 'any'); acted = true; }
        else if (y.g.hi > T2 * (1 + SPR_REL) && y.g.T > T2) { groups(j, T2, 'best'); acted = true; }
      }
      if (!acted) return { unsettled: tail > T2 ? 'tail' : 'bound', b, k, U, hi, Lo, th, log };
    }
    if (!acted) return { none: true, why: 'pays', log };
  }
  return { unsettled: 'loop', log };
  function q2why(z) { return z.g.two ? 'two' : 'bound'; }
}
/* one level of a ruler pool: { legs, p, d, n, settled, bound, boundK, exact, why, work }. The level's legs and figures
   are the builder's own (pbExact, the legs in the builder's order); settled false where the work ran out or a bound
   could not be brought down, with the best it found */
function spRulerLevel(pool, F, o) {
  o = o || {};
  const W = { used: 0, budget: o.work != null ? o.work : SPR_WORK };
  const X = sprPrep(pool.legs || []);
  let r;
  try { r = sprSolve(X, F, W); } catch (e) { if (e === W) r = { unsettled: 'work' }; else throw e; }
  const work = { ...W };
  if (r.none) return { legs: null, settled: true, why: r.why, work, log: r.log };
  const b = r.b;
  const out = { legs: null, settled: !r.unsettled, why: r.unsettled || null, work, log: r.log, bound: r.U, boundK: r.hi, exact: !!r.exact, k: r.k };
  if (b) {
    const legs = b.units.flatMap(u => u.T.map(x => x.l)), x = pbExact(legs);
    Object.assign(out, { legs: x.legs, p: x.corr, d: x.dec, n: x.legs.length, found: { c: b.c, d: b.d } });
    if (!(x.dec >= F - SP_FLOOR_EPS)) { out.settled = false; out.why = 'floor'; }
  }
  return out;
}
