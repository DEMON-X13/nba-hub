/* ---------- THE RULER SEARCH (dev copy; the proof ships in app/parts/suggested.html) ---------- */
const SPR_TAU = 0.005, SPR_ETA = 0.001, SPR_NEAR = 9e-4, SPR_SIG = 1e-3, SPR_REL = 1e-12, SPR_PURE = 1e-9, SPR_TH = 1e-3;
const SPR_CELLS = 512, SPR_KCAP = 16, SPR_WORK = 4e6;
/* the work each step is counted at (about its microseconds in jsdom) */
const SPR_COST = { prep: 2, cell: 0.004, node: 0.6, opt: 0.15, pair: 4, est3: 60, est4: 800, est5: 11000, ghk: 22000, cap: 15, cand: 1, gv: 5 };
const SPR_PREP = new WeakMap();
const sprCmp = (a, b) => a < b ? -1 : a > b ? 1 : 0;
function sprWork(C, what, n) { const W = C.W; n = n || 1; W.used += SPR_COST[what] * n; W[what] = (W[what] || 0) + n; if (W.used > W.budget) throw W; }
function sprIdsLess(a, b) { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i]; return a.length < b.length; }

/* ---------- the pool made ready (no level in it: kept for the pool's legs) ---------- */
function sprPrep(legs) {
  const ok2 = !!(S.corr && S.corr.rho && S.corr.hold), hold = ok2 ? +S.corr.hold : 0, by = new Map();
  let edge = false, n = 0;
  for (const l of legs || []) {
    const d = amToDec(l.price), I = propImplied(l.price), p = l.p;
    if (!(d > 1) || !(p > 0 && p < 1) || !(I > 0 && I < 1)) continue;
    const sk = slipKey(l), gid = l.gid || l.id;
    const x = { l, sk, gid, pid: l.kind === 'prop' ? String(l.pid) : null, side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', p, d, I, e: p * d };
    x.lp = Math.log(p); x.ld = Math.log(d); x.t = normInv(1 - p); x.tI = normInv(1 - I); x.pure = p >= I * (1 - SPR_REL);
    x.kind = x.pid ? 'p|' + l.stat : 't|' + SG_KIND[l.kind];
    if (p > I * (1 + SPR_PURE)) edge = true;
    if (!by.has(gid)) by.set(gid, []); by.get(gid).push(x); n++;
  }
  const X = { ok2, hold, edge, n, games: [], pair: new Map(), est: new Map(), ghk: new Map() };
  for (const gid of [...by.keys()].sort(sprCmp)) {
    const xs = by.get(gid).sort((a, b) => sprCmp(a.sk, b.sk)), gn = xs.length;
    xs.forEach((x, i) => { x.i = i; });
    const fr = xs.filter(y => !xs.some(x => x !== y && x.d >= y.d && x.p >= y.p && (x.d > y.d || x.p > y.p || x.sk < y.sk)))
      .sort((a, b) => (a.d - b.d) || (b.p - a.p) || sprCmp(a.sk, b.sk));
    const byP = [...xs].sort((a, b) => (b.p - a.p) || sprCmp(a.sk, b.sk));
    byP.forEach((x, q) => { x.q = q; });
    const pl = byP.filter(x => x.pid), tl = byP.filter(x => !x.pid);
    const pids = new Set(xs.filter(x => x.pid).map(x => x.pid)).size;
    const maxLegs = ok2 ? pids + (xs.some(x => x.side) ? 1 : 0) + (xs.some(x => x.tot) ? 1 : 0) : 1;
    const sm = Math.min(SPR_KCAP, maxLegs);
    const g = { gid, xs, n: gn, fr, byP, pl, tl, maxLegs, sm, R: new Float64Array(gn * gn).fill(NaN), pd: null, cap: null, H: null };
    const ds = xs.map(x => x.d).sort((a, b) => b - a); g.topD = [1]; for (let s = 1; s <= sm; s++) g.topD.push(s <= ds.length ? g.topD[s - 1] * ds[s - 1] : 0);
    /* sufD[q][r]: the r dearest prices of byP from q on multiplied (0 where fewer are left) */
    g.sufD = new Array(gn + 1); let top = []; g.sufD[gn] = [1];
    for (let q = gn - 1; q >= 0; q--) { top = [...top, byP[q].d].sort((a, b) => b - a).slice(0, sm); const pp = [1]; for (const v of top) pp.push(pp[pp.length - 1] * v); g.sufD[q] = pp; }
    g.Mpp = 0; g.Mpt = 0; g.Mtt = 0; for (const x of xs) { x.Mp = 0; x.Mt = 0; }
    if (ok2) {
      /* the largest |rho| two of its legs may have in one group: players (mates, opponents), a player and a team leg,
         the side and the total; and each leg's own with a player and with a team leg (R10) */
      const kinds = [...new Set(xs.map(x => x.kind))], pk = kinds.filter(k => k[0] === 'p').map(k => k.slice(2)), tk = kinds.filter(k => k[0] === 't').map(k => k.slice(2));
      const T = S.corr.rho, ab = (pre, a, b) => { const [k1, k2] = [a, b].sort(); return Math.abs(+T[`${pre}|${k1}|${k2}`] || 0); }, tm = (a, b) => Math.abs(+T[`team|${a}|${b}`] || 0);
      for (const a of pk) for (const b of pk) g.Mpp = Math.max(g.Mpp, ab('mate', a, b), ab('opp', a, b));
      for (const a of pk) for (const b of tk) g.Mpt = Math.max(g.Mpt, tm(a, b));
      const tt = (a, b) => a !== b && (a === 'over' || b === 'over');      // one side (win or cover) and one total a group
      for (const a of tk) for (const b of tk) if (tt(a, b)) g.Mtt = Math.max(g.Mtt, ab('game', a, b));
      for (const x of xs) {
        const st = x.pid ? x.l.stat : SG_KIND[x.l.kind];
        if (x.pid) { for (const k of pk) x.Mp = Math.max(x.Mp, ab('mate', st, k), ab('opp', st, k)); for (const k of tk) x.Mt = Math.max(x.Mt, tm(st, k)); }
        else { for (const k of pk) x.Mp = Math.max(x.Mp, tm(k, st)); for (const k of tk) if (tt(st, k)) x.Mt = Math.max(x.Mt, ab('game', st, k)); }
      }
    }
    X.games.push(g);
  }
  return X;
}
const sprRho = (g, a, b) => { const k = a.i * g.n + b.i; let r = g.R[k]; if (r !== r) { r = pbRho(a.l, b.l); g.R[k] = r; g.R[b.i * g.n + a.i] = r; } return r; };
const sprFits = (T, x) => !T.some(y => y === x || (x.pid && y.pid === x.pid) || (x.side && y.side) || (x.tot && y.tot));

/* ---------- a game's legs together, by the builder's own sums ---------- */
function sprPair(C, g, a, b) {
  if (a.i > b.i) { const z = a; a = b; b = z; }
  const k = g.gid + ':' + a.i + ',' + b.i; let u = C.X.pair.get(k);
  if (!C.sp.has(k)) { C.sp.add(k); sprWork(C, 'pair'); }
  if (u) return u;
  const r = sprRho(g, a, b), c = joint2(a.p, b.p, r), J = joint2(a.I, b.I, r), mult = a.d * b.d;
  u = { T: [a, b], n: 2, c, J, mult, d: J > 0 && isFinite(J) ? Math.min(mult, C.X.hold / J) : mult, exact: true, pure: a.pure && b.pure };
  C.X.pair.set(k, u); return u;
}
/* three to five legs by the page's own integral (spOrth, R7): { c, J }; null where the game's matrix is not positive
   definite (the builder shrinks it) or the integral fails */
function sprEst(C, g, W) {
  if (W.length < 3 || W.length > 5) return null;
  if (g.pd == null) g.pd = spPosDef(g.xs);
  if (!g.pd) return null;
  const key = g.gid + ':' + W.map(x => x.i).join(',');
  if (!C.se.has(key)) { C.se.add(key); sprWork(C, 'est' + W.length); }
  let u = C.X.est.get(key); if (u !== undefined) return u;
  const R = W.map((a, i) => W.map((b, j) => i === j ? 1 : sprRho(g, a, b)));
  const pure = W.every(x => x.pure), c = spOrth(W.map(x => x.t), R), J = pure ? c : spOrth(W.map(x => x.tI), R);
  u = c != null && J != null && c > 0 && J > 0 ? { c, J } : null;
  C.X.est.set(key, u); return u;
}
/* a group's own figures by the builder's own sums (parlayProb's and slipDec's sgJoint on the legs in sgOrder) */
function sprGhk(C, g, W) {
  const key = g.gid + ':' + W.map(x => x.i).join(',');
  if (!C.sg.has(key)) { C.sg.add(key); sprWork(C, 'ghk'); }
  let u = C.X.ghk.get(key); if (u) return u;
  const L = W.map(x => sgLeg(x.l)), c = sgJoint(W.map(x => x.p), L), J = sgJoint(W.map(x => x.I), L);
  let mult = 1; for (const x of W) mult *= x.d;
  u = { T: W, n: W.length, c, J, mult, d: J > 0 && isFinite(J) ? Math.min(mult, C.X.hold / J) : mult, exact: true, pure: W.every(x => x.pure) };
  C.X.ghk.set(key, u); return u;
}
/* (R9): phi_2(a, b; q) at most this for every |q| <= r */
const sprPhi2 = (a, b, r) => Math.exp(-(a * a + b * b) / (2 * (1 + r))) / (TWOPI * Math.sqrt(1 - r * r));
/* (R10): an impure leg x's factor on C / J in a group of s legs of its game that lands at least SPR_TH (see the proof) */
function sprGv(g, x, s) {
  if (x.pure) return 1;
  const ex = x.p / x.I; if (s < 2) return ex;
  /* the largest sum of squared correlations x can have with s - 1 others: at most two team legs (one for a team leg) */
  const o = s - 1, nt = Math.min(x.pid ? 2 : 1, o), r2 = x.pid ? nt * Math.max(x.Mt, x.Mp) ** 2 + (o - nt) * x.Mp * x.Mp : (o - nt) * x.Mp * x.Mp + nt * Math.max(x.Mp, x.Mt) ** 2;
  let e2 = 0; for (let t2 = 0; t2 <= Math.min(2, o); t2++) { const np = o - t2; e2 = Math.max(e2, np * (np - 1) * g.Mpp * g.Mpp + 2 * np * t2 * g.Mpt * g.Mpt + t2 * (t2 - 1) * g.Mtt * g.Mtt); }
  const lam = 1 - Math.sqrt(e2); if (!(lam > 0.05)) return 1;
  return sprGFor(x, Math.sqrt(r2 / lam));
}
/* (R10): the most a group of s legs of game g returns on $1 (a group landing at least SPR_TH) */
function sprHg(C, g, s) {
  if (!g.H) g.H = [];
  if (g.H[s] == null) {
    sprWork(C, 'gv', g.n);
    let gm = 0, pure = false; for (const x of g.xs) if (!x.pure) gm = Math.max(gm, sprGv(g, x, s)); else pure = true;
    g.H[s] = C.X.hold * Math.max(pure ? 1 + SPR_PURE : 0, (1 + SPR_SIG) * gm);
  }
  return g.H[s];
}
/* the same for one group W, over HOLD: each impure leg's factor at its own s_v, its regression on the group's others
   worked out (R10) */
function sprHW(g, W) {
  let f = 1, pure = true;
  for (const x of W) if (!x.pure) { pure = false; f *= sprGvAt(g, W, x); }
  return pure ? 1 + SPR_PURE : (1 + SPR_SIG) * f;
}
function sprGvAt(g, W, x) {
  const A = W.filter(y => y !== x), r = A.map(y => sprRho(g, x, y));
  const L = sgCholesky(A.map((a, i) => A.map((b, j) => i === j ? 1 : sprRho(g, a, b))));
  if (!L) return 1;
  const n = A.length, y = new Array(n);
  for (let i = 0; i < n; i++) { let v = r[i]; for (let k = 0; k < i; k++) v -= L[i][k] * y[k]; y[i] = v / L[i][i]; }
  const s2 = y.reduce((t, v) => t + v * v, 0);
  return sprGFor(x, Math.sqrt(s2 * (1 + 1e-9) + 1e-18));
}
function sprGFor(x, sv) {
  if (!(sv < 0.95)) return 1;
  if (sv < 1e-9) return Math.min(1, x.p / x.I * (1 + SPR_PURE));
  let best = 1;
  for (const z of [2, 2.5, 3, 3.5, 4, 4.5, 5, 5.5, 6, 7]) {
    const k = x.t - z * sv, g1 = normCdf(-k) / normCdf(-(k - (x.t - x.tI)));
    best = Math.min(best, g1 + (1 - g1) * normCdf(-z) / SPR_TH);
  }
  return Math.min(1, best);
}

/* (R8): each game's caps: the most s legs of it together can land (one-factor copula, Slepian) */
function sprCaps(C, g) {
  if (g.cap) return g.cap;
  sprWork(C, 'cap', g.n);
  const cols = g.xs.map(x => { const m = Math.min(0.81, Math.max(x.Mp, x.Mt)), sr = Math.sqrt(m), cr = Math.sqrt(1 - m); return SP_EQ.map(([w]) => spUp(x.t, sr, cr, w)); });
  const tops = SP_EQ.map((_, i) => { const v = cols.map(c => c[i]).sort((a, b) => b - a), pp = [1]; for (const y of v) pp.push(pp[pp.length - 1] * y); return pp; });
  g.cap = [1];
  for (let s = 1; s <= g.sm + 1; s++) { let v = 0; for (let i = 0; i < SP_EQ.length; i++) v += SP_EQ[i][1] * tops[i][Math.min(s, tops[i].length - 1)]; g.cap.push(Math.min(1, v * (1 + SPR_SIG))); }
  return g.cap;
}

/* ---------- the tables every cut stands on ---------- */
function sprTable(C, K) {
  const { X, NC, dl } = C, G = X.games, m = G.length, NEG = -Infinity;
  const B = []; for (let j = 0; j <= m; j++) { const row = []; for (let t = 0; t <= K; t++) row.push(null); B.push(row); }
  const z = new Float64Array(NC + 1).fill(NEG); z[0] = 0; B[m][0] = z;
  for (let t = 1; t <= K; t++) B[m][t] = new Float64Array(NC + 1).fill(NEG);
  const hTh = Math.log(SPR_TH);
  let reach = 0;
  for (let j = m - 1; j >= 0; j--) {
    const g = G[j], cc = g.fr.map(x => Math.ceil(x.ld / dl + 1e-9));
    reach += C.gr ? g.maxLegs : 1;
    for (let t = 0; t <= K; t++) {
      const out = Float64Array.from(B[j + 1][t]);
      if (t > reach) { B[j][t] = out; continue; }
      if (t >= 1 && B[j + 1][t - 1][0] > NEG) {
        const src = B[j + 1][t - 1];
        sprWork(C, 'cell', g.fr.length * (NC + 1));
        for (let f = 0; f < g.fr.length; f++) { const v = g.fr[f].lp, c0 = cc[f];
          for (let i = 0; i <= NC; i++) { const w = v + src[i > c0 ? i - c0 : 0]; if (w > out[i]) out[i] = w; } }
      }
      if (C.gr) for (let s = 2; s <= Math.min(t, g.sm); s++) {
        const src = B[j + 1][t - s]; if (src[0] === NEG) continue;
        const cap = sprCaps(C, g), L = Math.log(cap[Math.min(s, cap.length - 1)]), dTop = g.topD[s];
        if (!(dTop > 1) || L === NEG) continue;
        const ccmax = Math.ceil(Math.log(dTop) / dl + 1e-9);
        sprRelaxed(out, src, L, Math.log(sprHg(C, g, s)), dl, ccmax, NC);
        sprRelaxed(out, src, Math.min(L, hTh), Math.log(X.hold * (1 + SPR_SIG)), dl, ccmax, NC);
        sprWork(C, 'cell', 6 * (NC + 1));
      }
      B[j][t] = out;
    }
  }
  return B;
}
/* out[i] = max(out[i], max over cc in [1, ccmax] of min(L, h - (cc - 1) dl) + src[max(0, i - cc)]) */
function sprRelaxed(out, src, L, h, dl, ccmax, NC) {
  const cc0 = h >= L ? Math.min(ccmax, Math.floor((h - L) / dl) + 1) : 0;
  const dq = []; let head = 0;
  for (let i = 0; i <= NC; i++) {
    let best = -Infinity;
    if (cc0 >= 1) best = L + src[i > cc0 ? i - cc0 : 0];
    if (ccmax > cc0) {
      const lo = Math.max(cc0 + 1, i); if (lo <= ccmax) best = Math.max(best, h - (lo - 1) * dl + src[0]);
      const kHi = i - cc0 - 1;
      if (kHi >= 1) { const v = src[kHi] + kHi * dl; while (dq.length > head && dq[dq.length - 1][1] <= v) dq.pop(); dq.push([kHi, v]); }
      const kLo = Math.max(1, i - ccmax); while (dq.length > head && dq[head][0] < kLo) head++;
      if (dq.length > head && kHi >= kLo) best = Math.max(best, h - (i - 1) * dl + dq[head][1]);
    }
    if (best > out[i]) out[i] = best;
  }
}
/* R[j][t]: the most t legs of the games from j on can return on $1 */
function sprRet(C, K) {
  const { X } = C, G = X.games, m = G.length, R = [], Dm = [];
  for (let j = 0; j <= m; j++) { R.push(new Float64Array(K + 1)); Dm.push(new Float64Array(K + 1).fill(-Infinity)); }
  R[m][0] = 1; Dm[m][0] = 0;
  for (let j = m - 1; j >= 0; j--) {
    const g = G[j], e1 = g.xs.reduce((v, x) => Math.max(v, x.e), 0), d1 = Math.log(g.topD[1] || 1);
    for (let t = 0; t <= K; t++) {
      let v = R[j + 1][t], w = Dm[j + 1][t];
      if (t >= 1) { v = Math.max(v, e1 * R[j + 1][t - 1]); w = Math.max(w, d1 + Dm[j + 1][t - 1]); }
      if (C.gr) for (let s = 2; s <= Math.min(t, g.sm); s++) { v = Math.max(v, sprHg(C, g, s) * R[j + 1][t - s]); w = Math.max(w, Math.log(g.topD[s]) + Dm[j + 1][t - s]); }
      R[j][t] = v; Dm[j][t] = w;
    }
  }
  C.Dm = Dm;
  return R;
}

/* ---------- one size: every parlay of exactly k legs whose bound reaches the cut ---------- */
function sprQ(C, k, thr, near, any, hiK) {
  const { X, A, Fe, dl, NC, B, R } = C, G = X.games, m = G.length, NEG = -Infinity, STOP = {}, DONE = {};
  let best = null;
  const cutV = () => Math.max(thr, best ? best.c / (1 - near) : 0);
  /* nothing of k legs lands over hiK: a cut over it ends the search, all of it looked at */
  if (thr > hiK) return { best: null, done: true, hi: thr };
  const lnCut = () => { const v = cutV(); return v > 0 ? Math.log(v) : NEG; };
  const cellOf = need => { if (!(need > 0)) return 0; const q = Math.ceil(need / dl - 1e-9); return q < 0 ? 0 : q > NC ? NC : q; };
  const units = [];
  const found = (c, d) => {
    sprWork(C, 'cand');
    if (!(d >= Fe) || !(c >= thr)) return;
    const legs = units.flatMap(u => u.T), ids = legs.map(x => x.sk).sort(sprCmp);
    if (!best || c > best.c * (1 + SPR_REL) || (c >= best.c * (1 - SPR_REL) && sprIdsLess(ids, best.ids))) best = { c, d, n: legs.length, legs, ids };
    if (any) throw STOP;
    if (cutV() > hiK) throw DONE;
  };
  const rec = (j, t, c, d) => {
    sprWork(C, 'node');
    if (t === 0) { found(c, d); return; }
    if (j >= m) return;
    const lc = Math.log(c), need = A - Math.log(d);
    const bt = lc + B[j][t][cellOf(need)];
    if (!(bt > NEG) || bt < lnCut()) return;
    if (c * d * R[j][t] < cutV() * Fe) return;
    const g = G[j], opts = [];
    if (B[j + 1][t][cellOf(need)] > NEG) opts.push({ b: lc + B[j + 1][t][cellOf(need)], x: null });
    const nx = B[j + 1][t - 1];
    for (const x of g.fr) { const b = lc + x.lp + nx[cellOf(need - x.ld)]; if (b > NEG) opts.push({ b, x }); }
    sprWork(C, 'opt', g.fr.length + 1);
    opts.sort((a, b) => (b.b - a.b) || (a.x ? a.x.q : -1) - (b.x ? b.x.q : -1));
    for (const o of opts) {
      if (!(o.b > NEG) || o.b < lnCut()) break;
      if (!o.x) rec(j + 1, t, c, d);
      else { units.push({ T: [o.x], n: 1, c: o.x.p, d: o.x.d }); rec(j + 1, t - 1, c * o.x.p, d * o.x.d); units.pop(); }
    }
    if (C.gr) for (let s = 2; s <= Math.min(t, g.sm); s++) {
      if (c * d * sprHg(C, g, s) * R[j + 1][t - s] < cutV() * Fe) continue;
      sprGroupsAt(C, j, s, t, c, d, cutV, u => { units.push(u); rec(j + 1, t - s, c * u.c, d * u.d); units.pop(); });
    }
  };
  let done = true;
  try { rec(0, k, 1, 1); } catch (e) { if (e === STOP) done = false; else if (e !== DONE) throw e; }
  return { best, done, hi: done ? Math.min(hiK, Math.max(thr, best ? best.c / (1 - near) : 0)) : null };
}

/* the groups of exactly s legs of game j that may reach the cut with the branch: gathered on cheap bounds (R5, R9, R10),
   then each worked in the order of its pairwise estimate, held to the integral (R7) and worked by the builder's own sums
   where it may still reach the cut, and handed on. With no cut yet (a probe) they are worked a T at a time */
function sprGroupsAt(C, j, s, t, c, d, cutV, emit) {
  const { X, A, dl, NC, B, R, Fe } = C, g = X.games[j], rest = B[j + 1][t - s], NEG = -Infinity;
  if (rest[0] === NEG) return;
  const lc = Math.log(c), need = A - Math.log(d), slk = s >= 3 ? 1 + SPR_SIG : 1 + SPR_PURE, Rr = R[j + 1][t - s];
  const cellOf = v => { if (!(v > 0)) return 0; const q = Math.ceil(v / dl - 1e-9); return q < 0 ? 0 : q > NC ? NC : q; };
  const restAt = t === s ? dd => d * dd >= Fe * (1 - SPR_REL) ? 0 : NEG : dd => rest[cellOf(need - Math.log(dd))];
  const lnCut = () => { const v = cutV(); return v > 0 ? Math.log(v) : NEG; };
  const low = v => !(v > NEG) || v < lnCut();
  const bound = (cu, dd, H) => Math.min(lc + Math.log(cu) + restAt(dd), Math.log(c * d * H * Rr / Fe));
  const byP = g.byP, T = [], Hs = sprHg(C, g, s);
  let cands = [], later = [];
  /* the gathered groups in the order of their estimate; a probe (no cut yet) leaves those its estimate says do not pay
     for last, and works them only where none of the others does */
  const work = all => {
    const list = all ? later.concat(cands) : cands; cands = []; if (all) later = [];
    list.sort((a, b) => (b.sc - a.sc) || (b.b - a.b) || sprCmp(a.key, b.key));
    for (const k of list) {
      if (low(k.b)) continue;
      if (!all && !(cutV() > 0) && !(k.sc > NEG)) { later.push(k); continue; }
      let u = k.u;
      if (!u) {
        const e = sprEst(C, k.g, k.W);
        if (e) { const dHi = Math.min(k.mult, X.hold / (e.J * (1 - SPR_SIG))); if (low(bound(Math.min(k.cu, e.c) * (1 + SPR_SIG), dHi, k.H))) continue; }
        u = sprGhk(C, g, k.W);
      }
      if (!(u.c > 0) || low(lc + Math.log(u.c) + restAt(u.d))) continue;
      emit(u);
    }
  };
  /* (R9) T's own figures, for the last leg: its chance at most cT, its J at least JT */
  const own = () => { if (T.length === 1) return { cT: T[0].p, JT: T[0].I };
    if (T.length === 2) { const u = sprPair(C, g, T[0], T[1]); return { cT: u.c, JT: u.J }; }
    const e = sprEst(C, g, [...T].sort((a, b) => a.i - b.i)); return e ? { cT: e.c * (1 + SPR_SIG), JT: e.J * (1 - SPR_SIG) } : null; };
  const lnDmR = C.Dm[j + 1][t - s];
  /* the last leg among the players: none more likely than Imax can pay (its J would be over HOLD over the least price
     the group must have), and the loop ends where none can land enough (R9, every |rho| at most M) */
  const lastPl = (pos, cUb, mult) => {
    const o = own(), L = g.pl; if (!o || !(lnDmR > NEG)) return 0;
    let eP = 0, eM = 0; for (const y of T) { const M = y.pid ? y.Mp : y.Mp; eP += M * Math.exp(-y.t * y.t / (2 * (1 + M))) / (TWOPI * Math.sqrt(1 - M * M)); eM += M * Math.exp(-y.tI * y.tI / (2 * (1 + M))) / (TWOPI * Math.sqrt(1 - M * M)); }
    const ddMin = Math.exp(need - lnDmR), sgm = s >= 3 ? SPR_SIG : 0, Imax = (X.hold / (ddMin * (1 - sgm)) + eM) / o.JT;
    let lo = 0, hi = L.length; while (lo < hi) { const mid = (lo + hi) >> 1; if (L[mid].q >= pos && L[mid].p <= Imax) hi = mid; else if (L[mid].q < pos) lo = mid + 1; else lo = mid + 1; }
    return { start: lo, eP, cT: o.cT };
  };
  /* what a group holding T returns at most (R10): T's impure legs' worst factors at s legs, else the game's own */
  const hT = () => { let f = 1, imp = false; for (const y of T) if (!y.pure) { imp = true; f *= sprGv(g, y, s); } return imp ? X.hold * (1 + SPR_SIG) * f : Hs; };
  const grow = (pos, cUb, mult) => {
    const HT = hT();
    if (s - T.length - 1 === 0 && T.length >= 1) {
      if (low(Math.log(c * d * HT * Rr / Fe))) return;
      const st = lastPl(pos, cUb, mult);
      if (st) {
        const L = g.pl, dMx = mult * (g.sufD[pos][1] || 0);
        const rb = restAt(Math.max(dMx, 1)); if (!(rb > NEG)) return;
        for (let q = st.start; q < L.length; q++) {
          const x = L[q];
          if (x.q < pos) continue;
          sprWork(C, 'node');
          if (low(lc + Math.log(Math.min(cUb, st.cT * x.p + st.eP) * slk) + rb)) break;
          leaf(x, mult, cUb);
        }
        for (const x of g.tl) if (x.q >= pos) { sprWork(C, 'node'); leaf(x, mult, cUb); }
        return;
      }
    }
    for (let q = pos; q < byP.length; q++) {
      const x = byP[q], left = s - T.length - 1;
      sprWork(C, 'node');
      const dAll = mult * (g.sufD[q][left + 1] || 0);
      if (!(dAll > 0) || low(bound(Math.min(cUb, x.p) * slk, Math.max(dAll, 1), HT))) break;
      if (!sprFits(T, x)) continue;
      const dMax = mult * x.d * (left > 0 ? (g.sufD[q + 1][left] || 0) : 1);
      if (!(dMax > 0)) continue;
      if (left > 0) {
        let cu = Math.min(cUb, x.p); for (const y of T) cu = Math.min(cu, sprPair(C, g, y, x).c);
        if (low(bound(cu * slk, dMax, x.pure ? HT : Math.min(HT, X.hold * (1 + SPR_SIG) * sprGv(g, x, s) * (HT === Hs ? 1 : HT / (X.hold * (1 + SPR_SIG))))))) continue;
        T.push(x); grow(q + 1, cu, mult * x.d); T.pop();
        if (left === 1 && cands.length && !(cutV() > 0)) work(false);
        continue;
      }
      leaf(x, mult, cUb);
    }
  };
  const leaf = (x, mult, cUb) => {
    {
      if (!sprFits(T, x)) return;
      const dMax = mult * x.d;
      const W = [...T, x].sort((a, b) => a.i - b.i), mx = mult * x.d;
      const pre = sprPre(C, g, T, x, mx);
      if (pre && low(bound(pre.cHi * slk, pre.dHi, Hs))) return;
      let cu = Math.min(cUb, x.p); for (const y of T) cu = Math.min(cu, sprPair(C, g, y, x).c);
      if (pre) cu = Math.min(cu, pre.cHi);
      const dHi = pre ? pre.dHi : dMax;
      if (low(bound(cu * slk, dHi, Hs))) return;
      const H = X.hold * sprHW(g, W), b = bound(cu * slk, dHi, H);
      if (low(b)) return;
      if (s === 2) { const u = sprPair(C, g, W[0], W[1]), b2 = bound(u.c, u.d, H); if (!low(b2)) cands.push({ W, b: b2, u, sc: lc + Math.log(u.c) + restAt(u.d), key: '' }); return; }
      /* the pairwise estimate, for the order alone: each pair's lift over its legs' own multiplied */
      let c2 = 1, J2 = 1; for (const y of W) { c2 *= y.p; J2 *= y.I; }
      for (let a = 0; a < W.length; a++) for (let b3 = a + 1; b3 < W.length; b3++) { const u = sprPair(C, g, W[a], W[b3]); c2 *= u.c / (W[a].p * W[b3].p); J2 *= u.J / (W[a].I * W[b3].I); }
      const sc = lc + Math.log(c2) + restAt(Math.min(mx, X.hold / (J2 * (1 + 3e-4))));
      cands.push({ W, g, b, cu, mult: mx, H, sc, key: W.map(y => y.sk).join('~') });
    }
  };
  grow(0, 1, 1);
  if (cands.length || later.length) work(true);
}
/* (R9): T and one more leg x, first order in x's correlations with T (Plackett) */
function sprPre(C, g, T, x, mult) {
  let cT, JT;
  if (T.length === 1) { cT = T[0].p; JT = T[0].I; }
  else if (T.length === 2) { const u = sprPair(C, g, T[0], T[1]); cT = u.c; JT = u.J; }
  else { const e = sprEst(C, g, [...T].sort((a, b) => a.i - b.i)); if (!e) return null; cT = e.c * (1 + SPR_SIG); JT = e.J * (1 - SPR_SIG); }
  let cHi = cT * x.p, JLo = JT * x.I;
  for (const y of T) {
    const r = sprRho(g, x, y);
    if (r > 0) cHi += r * sprPhi2(x.t, y.t, r);
    else if (r < 0) JLo -= -r * sprPhi2(x.tI, y.tI, -r);
  }
  return { cHi: Math.min(cHi, 1), dHi: JLo > 0 ? Math.min(mult, C.X.hold / (JLo * (1 - (T.length >= 3 ? SPR_SIG : 0)))) : mult };
}

/* ---------- the level ---------- */
function sprSolve(C) {
  const { X } = C, G = X.games, log = C.log;
  const maxN = G.reduce((t, g) => t + g.maxLegs, 0);
  if (maxN < 2) return { none: true, why: 'legs' };
  const lo = []; let hi = [], hiS = [], tail = 0;
  const setup = gr => {
    C.gr = gr && X.ok2;
    C.K = Math.max(2, Math.min(SPR_KCAP, C.gr ? maxN : G.length, C.gr ? Math.max(G.length + 2, 6) : SPR_KCAP));
    C.B = sprTable(C, C.K); C.R = sprRet(C, C.K);
    const cell0 = Math.max(0, Math.min(C.NC, Math.ceil(C.A / C.dl - 1e-9)));
    let hG = 0; if (X.ok2 && !C.gr) for (const g of G) for (let s = 2; s <= g.sm; s++) hG = Math.max(hG, sprHg(C, g, s));
    hG = hG * (1 + SPR_PURE) / C.Fe;
    hi = []; hiS = [];
    for (let k = 0; k <= C.K; k++) { const v = k >= 2 ? Math.min(Math.exp(C.B[0][k][cell0]), C.R[0][k] / C.Fe) : 0; hiS.push(v); hi.push(k >= 2 && k <= maxN ? Math.max(v, hG) : v); if (lo.length <= k) lo.push(null); }
    const top = C.gr ? maxN : G.length;
    tail = top > C.K ? Math.min(sprTail(C, C.K + 1), (X.ok2 ? X.hold * (1 + SPR_SIG) : 1) * (1 + SPR_PURE) / C.Fe) : 0;
    if (!C.gr && X.ok2 && maxN > C.K) tail = Math.max(tail, hG);
    log.push(`${C.gr ? 'G' : 'S'}K${C.K}`);
  };
  setup(false);
  const bestAll = () => { let b = null; for (let k = 2; k < lo.length; k++) if (lo[k] && (!b || lo[k].c > b.c)) b = lo[k]; return b; };
  const toGroups = () => { if (C.gr || !X.ok2) return false; setup(true); for (let k = 2; k <= C.K; k++) if (lo[k]) hi[k] = Math.max(hi[k], lo[k].c); return true; };
  for (let it = 0; it < 600; it++) {
    const L0 = bestAll(), Lo = L0 ? L0.c : 0;
    let U = tail; for (let k = 2; k <= C.K; k++) U = Math.max(U, hi[k]);
    if (!(U > 0)) return { none: true, why: 'pays' };
    const out = (1 - SPR_TAU + SPR_ETA) * Lo;
    let ks = -1; for (let k = 2; k <= C.K; k++) if (hi[k] > 0 && hi[k] >= out) { ks = k; break; }
    if (ks < 0) { if (toGroups()) continue; return { unsettled: 'tail', b: L0, U }; }
    const b = lo[ks];
    if (b && b.c >= (1 - SPR_ETA) * hi[ks] && b.c >= (1 - SPR_TAU) * U) return { b, k: ks, U, hiK: hi[ks], Lo, exact: b.c >= hi[ks] * (1 - 1e-9) };
    if (!(b && b.c >= (1 - SPR_ETA) * hi[ks])) {
      if (hi[ks] > hiS[ks] * (1 + SPR_REL) && toGroups()) continue;
      /* a parlay of ks legs to start from: the first the search meets, best first (none: none pays) */
      if (!b && !(out > 0)) {
        const p = sprQ(C, ks, 0, 0, true, hi[ks]);
        log.push(`p${ks}:${p.best ? p.best.c.toPrecision(6) : '-'}`);
        if (p.best) lo[ks] = p.best; else if (p.done) hi[ks] = 0;
        continue;
      }
      const th = Math.max(out, b ? b.c : 0);
      const r = sprQ(C, ks, th, SPR_NEAR, false, hi[ks]);
      log.push(`q${ks}@${th.toPrecision(5)}:${r.best ? r.best.c.toPrecision(6) : '-'}`);
      if (r.best && (!lo[ks] || r.best.c > lo[ks].c)) lo[ks] = r.best;
      hi[ks] = Math.min(hi[ks], r.hi);
      continue;
    }
    const need = b.c / (1 - SPR_TAU);
    let j = -1; for (let k = 2; k <= C.K; k++) if (k !== ks && hi[k] > need * (1 + SPR_REL) && (j < 0 || hi[k] > hi[j])) j = k;
    if (j < 0 || tail > hi[j]) { if (toGroups()) continue; if (tail > need * (1 + SPR_REL)) return { unsettled: 'tail', b, k: ks, U }; }
    if (j < 0) return { unsettled: 'bound', b, k: ks, U };
    if (hi[j] > hiS[j] * (1 + SPR_REL) && toGroups()) continue;
    const r = sprQ(C, j, need, 0, true, hi[j]);
    log.push(`a${j}@${need.toPrecision(5)}:${r.best ? r.best.c.toPrecision(6) : '-'}`);
    if (r.best) { if (!lo[j] || r.best.c > lo[j].c) lo[j] = r.best; }
    else hi[j] = Math.min(hi[j], need);
  }
  return { unsettled: 'loop', b: bestAll() };
}
/* (R11): the most any t legs can land, no price asked */
function sprTail(C, t) {
  const G = C.X.games; let P = [1]; for (let i = 1; i <= t; i++) P.push(0);
  for (const g of G) {
    const Q = P.slice(), p1 = g.byP.length ? g.byP[0].p : 0, cap = C.X.ok2 ? sprCaps(C, g) : [1];
    for (let a = 0; a <= t; a++) { if (!(P[a] > 0)) continue;
      if (a + 1 <= t) Q[a + 1] = Math.max(Q[a + 1], P[a] * p1);
      if (C.X.ok2) for (let s = 2; s <= Math.min(g.maxLegs, t - a); s++) Q[a + s] = Math.max(Q[a + s], P[a] * cap[Math.min(s, cap.length - 1)]); }
    P = Q;
  }
  return P[t];
}

/* one level of a ruler pool: { legs, p, d, n, k, settled, gap, bound, boundK, why, work } */
function spRulerLevel(pool, F, o) {
  o = o || {};
  let X = SPR_PREP.get(pool.legs); if (!X) { X = sprPrep(pool.legs); SPR_PREP.set(pool.legs, X); }
  const Fe = F - SP_FLOOR_EPS, A = Math.log(Fe), NC = SPR_CELLS;
  const W = { used: 0, budget: o.work != null ? o.work : SPR_WORK };
  const C = { X, F, Fe, A, NC, dl: A / NC, K: 0, gr: false, W, log: [], sp: new Set(), se: new Set(), sg: new Set() };
  if (X.edge) return { legs: null, settled: false, why: 'edge', work: W };
  let r;
  try { sprWork(C, 'prep', X.n); r = sprSolve(C); }
  catch (e) { if (e === W) r = { unsettled: 'work', b: null }; else throw e; }
  const work = { ...W };
  if (r.none) return { legs: null, settled: true, why: r.why, work, log: C.log };
  const b = r.b, out = { legs: null, settled: !r.unsettled, why: r.unsettled || null, work, log: C.log, bound: r.U, boundK: r.hiK, k: r.k, exact: !!r.exact, groups: C.gr };
  if (b) {
    const x = pbExact(b.legs.map(y => y.l));
    Object.assign(out, { legs: x.legs, p: x.corr, d: x.dec, n: x.legs.length, found: { c: b.c, d: b.d } });
    if (r.U > 0) out.gap = Math.max(0, 1 - x.corr / r.U);
    if (!(x.dec >= Fe)) { out.settled = false; out.why = 'floor'; }
  }
  return out;
}
