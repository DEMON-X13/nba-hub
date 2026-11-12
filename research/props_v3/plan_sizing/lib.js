/* PLAN.md's sizing checks: shared code (research only: SIZING, no candidate).
 *
 * The features each line carries, the information-free family the plan's test controls for, the stand-in nudges, and
 * the two criteria the plan's bar is built on, all computed on the development lines that rows.js tables:
 *   T1  logit P(Over) = F(x) + b n, fitted on the evaluation lines with F the information-free family: b's 90% interval
 *       (cluster-robust by game) wholly above 0
 *   T2  the nudge n at its frozen size, added to F cross-fitted on the evaluation lines (5 folds by game): the paired
 *       difference in log loss (and Brier) against F alone, its game-clustered 90% interval wholly below -m
 * Nothing here is the candidate: the stand-in forecaster is tools/props.js's 2024 fold (fitted on 2022-23 box scores),
 * which no candidate may stand on; the weights fitted here size the plan's margins and power, and choose nothing that the
 * candidate's own build does not choose again on its own projections.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const T = require(path.join(ROOT, 'research', 'props_v3', 'why_lib.js'));
const { PM, ll, br, logit, sigm, implied, mean, rng } = T;
const STATS = PM.STATS;                                   // pts reb ast tpm stl blk
const CACHE = path.join(ROOT, 'research', 'props_v3', 'cache', 'plan_sizing');

/* ---------- the lines, with every feature a candidate or a rival could have before tip-off ---------- */
function load(set) {
  const J = JSON.parse(fs.readFileSync(path.join(CACHE, `rows_${set}.json`), 'utf8'));
  const L = J.lines;
  for (const x of L) {
    x.Io = implied(x.over); x.Iu = implied(x.under); x.q = 1 - x.Iu; x.M = x.Io + x.Iu - 1;
    x.zq = logit(x.q); x.zo = logit(x.Io);
    if (x.mu != null) { x.pModel = PM.pOver(x.line, x.mu, x.v); x.d = logit(x.pModel) - x.zq; x.muDK = T.impliedMean(x.line, x.q, x.ab, 1); }
  }
  /* aggregates over EVERY posted line (graded, void, no call or push alike): a game's, a night's, a player-game's */
  const by = (key) => { const m = new Map(); for (const x of L) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
  const gameL = by(x => x.game), nightL = by(x => x.date), pgL = by(x => x.game + '|' + x.player);
  const nightGames = new Map(); for (const [d, a] of nightL) nightGames.set(d, new Set(a.map(x => x.game)).size);
  for (const [, a] of gameL) { const mz = mean(a.map(x => x.zq)); for (const x of a) { x.gN = a.length; x.gZ = mz; } }
  for (const [d, a] of nightL) {
    const mz = mean(a.map(x => x.zq)), sd = Math.sqrt(mean(a.map(x => (x.zq - mz) ** 2))) || 1;
    for (const x of a) { x.nN = nightGames.get(d); x.nZ = mz; x.nZs = (x.zq - mz) / sd; }
  }
  /* the stat mix: the player-game's common level read off DraftKings' own prices (the mean each line implies on the
     forecaster's negative binomial, against the forecaster's mean, in logs, weighted by each stat's precision mu^2/v),
     then the forecaster's mix carried to that level and priced at DraftKings' line. d = dLvl + dMix exactly */
  for (const [, a] of pgL) {
    const p = a.filter(x => x.mu != null);
    for (const x of a) x.nPl = a.length;
    if (!p.length) continue;
    let sw = 0, sr = 0; for (const x of p) { const w = x.mu * x.mu / x.v; sw += w; sr += w * (Math.log(x.muDK) - Math.log(x.mu)); }
    const kap = sr / sw;
    for (const x of p) {
      const mu2 = x.mu * Math.exp(kap); x.pMix = PM.pOver(x.line, mu2, PM.nbVar(mu2, x.ab)); x.dMix = logit(x.pMix) - x.zq; x.dLvl = x.d - x.dMix; x.kap = kap;
    }
    /* the generic rival: his POSITION's league rates in place of his own (minutes 30, the stat's own precision), carried
       to DraftKings' level the same way. It uses no read of the player but his position */
    let tw = 0, tr = 0; const q = p.filter(x => x.posRate > 0);
    for (const x of q) { const m0 = x.posRate * 30, w = m0 * m0 / PM.nbVar(m0, x.ab); tw += w; tr += w * (Math.log(x.muDK) - Math.log(m0)); }
    if (q.length) { const kp = tr / tw; for (const x of q) { const m2 = x.posRate * 30 * Math.exp(kp); x.dPos = logit(PM.pOver(x.line, m2, PM.nbVar(m2, x.ab))) - x.zq; } }
  }
  /* game lines: the club's own spread (minus when favoured), the total less the set's mean */
  const tots = L.filter(x => x.total != null).map(x => x.total), mt = mean(tots);
  for (const x of L) { x.spr = x.homeLine == null || x.home == null ? 0 : (x.home ? x.homeLine : -x.homeLine); x.totC = x.total == null ? 0 : x.total - mt; x.fav = x.q > 0.5 ? 1 : 0; }
  return { J, L };
}
const graded = L => L.filter(x => x.status === 'graded' && x.mu != null && x.dMix != null);

/* ---------- columns ---------- */
const K1 = logit(0.35), K2 = logit(0.45), K3 = logit(0.55);
const MONTHS = ['2023-11', '2023-12', '2024-01', '2024-02', '2024-03', '2024-04'];   // October the base
const hinge = (z, k) => Math.max(0, z - k);
/* the information-free family the plan's T1 and T2 control for: per stat an intercept, logit q and logit of the
   Over's implied chance (both prices: any devig rule's linear part), the game total and the spread's size, and the
   generic position mix; pooled, the price band's hinges, the favourite side, home or away, the month, a night's and a
   game's posted lines and their mean price, and how many lines the player has posted */
function famCols(x) {
  const c = [];
  for (const s of STATS) { const e = x.stat === s ? 1 : 0; c.push(e, e * x.zq, e * x.zo, e * x.totC / 10, e * Math.abs(x.spr) / 10, e * (x.dPos || 0)); }
  c.push(hinge(x.zq, K1), hinge(x.zq, K2), hinge(x.zq, K3), x.fav, x.home || 0);
  for (const m of MONTHS) c.push(x.month === m ? 1 : 0);
  c.push(Math.log(x.nN), x.nZ, Math.log(x.gN), x.gZ, x.nPl);
  return c;
}
/* the candidate's own information-free part (what a frozen candidate would carry): per stat an intercept, logit q and
   logit of the Over's implied chance, and the price band's hinges */
function eCols(x) {
  const c = [];
  for (const s of STATS) { const e = x.stat === s ? 1 : 0; c.push(e, e * x.zq, e * x.zo); }
  c.push(hinge(x.zq, K1), hinge(x.zq, K2), hinge(x.zq, K3));
  return c;
}
const perStat = f => x => STATS.map(s => (x.stat === s ? f(x) : 0));

/* ---------- logistic regression: Newton's method, an optional ridge, cluster-robust standard errors ---------- */
function design(idx, L, colf) {
  const k = colf(L[idx[0]]).length, X = Array.from({ length: k }, () => new Float64Array(idx.length));
  idx.forEach((i, t) => { const c = colf(L[i]); for (let a = 0; a < k; a++) X[a][t] = c[a]; });
  return X;
}
function irls(X, y, off, lam = 0, iters = 60) {
  const k = X.length, n = y.length, beta = new Float64Array(k);
  /* columns with no variation in these rows are dropped (their coefficient stays 0) */
  const live = []; for (let a = 0; a < k; a++) { let mn = Infinity, mx = -Infinity; for (let t = 0; t < n; t++) { const v = X[a][t]; if (v < mn) mn = v; if (v > mx) mx = v; } if (mx > mn || (mx !== 0)) live.push(a); }
  for (let it = 0; it < iters; it++) {
    const kk = live.length, H = Array.from({ length: kk }, () => new Float64Array(kk)), g = new Float64Array(kk);
    for (let t = 0; t < n; t++) {
      let z = off ? off[t] : 0; for (const a of live) z += beta[a] * X[a][t];
      const p = 1 / (1 + Math.exp(-z)), w = Math.max(p * (1 - p), 1e-12), r = y[t] - p;
      for (let u = 0; u < kk; u++) { const xa = X[live[u]][t]; if (xa === 0) continue; g[u] += xa * r; const wx = w * xa; const Hu = H[u]; for (let v = u; v < kk; v++) { const xb = X[live[v]][t]; if (xb !== 0) Hu[v] += wx * xb; } }
    }
    for (let u = 0; u < kk; u++) { for (let v = 0; v < u; v++) H[u][v] = H[v][u]; if (lam) { H[u][u] += lam; g[u] -= lam * beta[live[u]]; } }
    const step = T.solve(H.map(r => Array.from(r)), Array.from(g)); if (!step) return null;
    let mx = 0; live.forEach((a, u) => { beta[a] += step[u]; mx = Math.max(mx, Math.abs(step[u])); });
    if (mx < 1e-9) break;
  }
  return { beta, live };
}
const lin = (X, beta, t, off) => { let z = off ? off[t] : 0; for (let a = 0; a < X.length; a++) if (beta[a]) z += beta[a] * X[a][t]; return z; };
/* the cluster-robust (sandwich) variance of one coefficient a: u = H^-1 e_a, V_aa = G/(G-1) sum_g (u . s_g)^2 */
function robustSE(X, y, off, fit, a, groups) {
  const { beta, live } = fit, kk = live.length, n = y.length, H = Array.from({ length: kk }, () => new Array(kk).fill(0)), p = new Float64Array(n);
  for (let t = 0; t < n; t++) { p[t] = sigm(lin(X, beta, t, off)); const w = p[t] * (1 - p[t]); for (let u = 0; u < kk; u++) { const xa = X[live[u]][t]; if (!xa) continue; for (let v = u; v < kk; v++) H[u][v] += w * xa * X[live[v]][t]; } }
  for (let u = 0; u < kk; u++) for (let v = 0; v < u; v++) H[u][v] = H[v][u];
  const ua = live.indexOf(a); const e = new Array(kk).fill(0); e[ua] = 1; const uvec = T.solve(H, e);
  let s = 0; for (const g of groups) { let d = 0; for (const t of g) { const r = y[t] - p[t]; let xu = 0; for (let u = 0; u < kk; u++) xu += uvec[u] * X[live[u]][t]; d += xu * r; } s += d * d; }
  const G = groups.length; return Math.sqrt(s * G / (G - 1));
}
const groupsOf = (idx, L) => { const m = new Map(); idx.forEach((i, t) => { const g = L[i].game; if (!m.has(g)) m.set(g, []); m.get(g).push(t); }); return [...m.values()]; };
/* a stable fold of a game: its id hashed */
const foldOf = (gid, K) => { let h = 2166136261; for (let i = 0; i < gid.length; i++) { h ^= gid.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h % K; };

/* ---------- fitting a nudge and its frozen parts on training lines ---------- */
/* the nudge's weights fitted jointly with the information-free family as controls (so they carry only what the family
   does not); then the candidate's own information-free part fitted with the frozen nudge as an offset */
function fitNudge(Ltr, featf, lamFam = 1) {
  const idx = Ltr.map((_, i) => i), y = Float64Array.from(Ltr, x => x.o);
  const nf = featf(Ltr[0]).length;
  const X = design(idx, Ltr, x => [...famCols(x), ...featf(x)]);
  const fit = irls(X, y, null, lamFam); const nfam = X.length - nf;
  const w = Array.from(fit.beta.slice(nfam));
  const nud = x => { const f = featf(x); let s = 0; for (let a = 0; a < nf; a++) s += w[a] * f[a]; return s; };
  const off = Float64Array.from(Ltr, nud), XE = design(idx, Ltr, eCols), fe = irls(XE, y, off, lamFam);
  const eb = Array.from(fe.beta), eOf = x => { const c = eCols(x); let s = 0; for (let a = 0; a < c.length; a++) s += eb[a] * c[a]; return s; };
  return { w, nud, eOf };
}
/* the candidate's own information-free part alone, fitted on training lines (no nudge): its drift is the risk to its
   level and calibration, never to T1 or T2 */
function fitE(Ltr, lam = 1) {
  const idx = Ltr.map((_, i) => i), y = Float64Array.from(Ltr, x => x.o), XE = design(idx, Ltr, eCols), fe = irls(XE, y, null, lam), eb = Array.from(fe.beta);
  return x => { const c = eCols(x); let s = 0; for (let a = 0; a < c.length; a++) s += eb[a] * c[a]; return s; };
}

/* ---------- the two criteria on evaluation lines ---------- */
/* the family cross-fitted on the evaluation lines themselves, 5 folds by game: each line's logit from the folds that
   do not hold its game */
function crossFit(Lev, K = 5, lam = 1) {
  const z = new Float64Array(Lev.length);
  for (let k = 0; k < K; k++) {
    const tr = [], te = []; Lev.forEach((x, i) => (foldOf(x.game, K) === k ? te : tr).push(i));
    const X = design(tr, Lev, famCols), y = Float64Array.from(tr, i => Lev[i].o), f = irls(X, y, null, lam);
    for (const i of te) { const c = famCols(Lev[i]); let s = 0; for (let a = 0; a < c.length; a++) s += f.beta[a] * c[a]; z[i] = s; }
  }
  return z;
}
function T1(Lev, nArr, Xfam) {
  const idx = Lev.map((_, i) => i), y = Float64Array.from(Lev, x => x.o);
  const X = Xfam ? [...Xfam, nArr] : [...design(idx, Lev, famCols), nArr];
  const a = X.length - 1, orth = orthShare(X.slice(0, a), nArr);
  /* a nudge wholly inside the family's span (orth 0) has no b: its fit is singular, and T1 is not met */
  const fit = orth != null && orth < 1e-8 ? null : irls(X, y, null, 0);
  if (!fit) return { b: NaN, se: NaN, lo: NaN, hi: NaN, z: NaN, orth, collinear: true };
  const b = fit.beta[a]; const se = robustSE(X, y, null, fit, a, groupsOf(idx, Lev));
  return { b, se, lo: b - 1.645 * se, hi: b + 1.645 * se, z: b / se, orth };
}
/* how much of a nudge is not in the family's span: 1 less the R^2 of its least-squares fit on the family's columns. A
   nudge with nothing left has no b (T1 cannot be met by it) */
function orthShare(Xf, v) {
  const live = Xf.filter(c => { let mn = Infinity, mx = -Infinity; for (const z of c) { if (z < mn) mn = z; if (z > mx) mx = z; } return mx > mn || mx !== 0; });
  const k = live.length, n = v.length, A = Array.from({ length: k }, () => new Array(k).fill(0)), r = new Array(k).fill(0);
  for (let t = 0; t < n; t++) for (let a = 0; a < k; a++) { const xa = live[a][t]; if (!xa) continue; r[a] += xa * v[t]; for (let c = a; c < k; c++) A[a][c] += xa * live[c][t]; }
  for (let a = 0; a < k; a++) { for (let c = 0; c < a; c++) A[a][c] = A[c][a]; A[a][a] += 1e-9; }
  const beta = T.solve(A, r); if (!beta) return null;
  let ssr = 0, sst = 0; const mv = mean(Array.from(v));
  for (let t = 0; t < n; t++) { let f = 0; for (let a = 0; a < k; a++) f += beta[a] * live[a][t]; ssr += (v[t] - f) ** 2; sst += (v[t] - mv) ** 2; }
  return sst > 0 ? ssr / sst : 0;
}
function T2(Lev, nArr, zcf, nBoot = 10000, seed = 0) {
  const groups = T.groupBy(Lev, x => x.game);
  const dLL = Lev.map((x, i) => ll(sigm(zcf[i] + nArr[i]), x.o) - ll(sigm(zcf[i]), x.o));
  const dBR = Lev.map((x, i) => br(sigm(zcf[i] + nArr[i]), x.o) - br(sigm(zcf[i]), x.o));
  const seMean = d => { const gs = groups.map(g => { let s = 0; for (const i of g) s += d[i]; return [s, g.length]; }); const N = Lev.length, mu = mean(d); let v = 0; for (const [s, c] of gs) v += (s - mu * c) ** 2; return Math.sqrt(v * gs.length / (gs.length - 1)) / N; };
  return { ll: mean(dLL), llCi: T.clusterBootMean(groups, dLL, nBoot, seed), llSE: seMean(dLL), br: mean(dBR), brCi: T.clusterBootMean(groups, dBR, nBoot, seed), brSE: seMean(dBR), games: groups.length, lines: Lev.length };
}
/* calibration of a chance on lines: P(Over) = sigm(a + s logit p), cluster-robust interval for s; and the chance said
   less the Over rate */
function calibOf(Lc, zArr) {
  const idx = Lc.map((_, i) => i), y = Float64Array.from(Lc, x => x.o), X = [new Float64Array(Lc.length).fill(1), Float64Array.from(zArr)];
  const fit = irls(X, y, null, 0), se = robustSE(X, y, null, fit, 1, groupsOf(idx, Lc));
  return { a: fit.beta[0], s: fit.beta[1], sLo: fit.beta[1] - 1.645 * se, sHi: fit.beta[1] + 1.645 * se, said: mean(Array.from(zArr, sigm)), hit: mean(Lc.map(x => x.o)), n: Lc.length };
}
function shuffleWithin(Lev, vals, key, seed) {
  const R = rng(seed), out = new Float64Array(vals.length), m = new Map();
  Lev.forEach((x, i) => { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  for (const ix of m.values()) { const v = ix.map(i => vals[i]); for (let j = v.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [v[j], v[r]] = [v[r], v[j]]; } ix.forEach((i, j) => { out[i] = v[j]; }); }
  return out;
}
const normCdf = PM.normCdf;
/* the chance a criterion "the 90% interval wholly beyond the bar" is met on the test's sample, the effect as measured
   and its standard error scaled from the evaluation's games to the test's (an approximation for sizing) */
const powerT1 = (b, se, gEv, gTest, bar = 0) => normCdf((b - bar) / (se * Math.sqrt(gEv / gTest)) - 1.645);
const powerT2 = (d, se, gEv, gTest, m) => normCdf((-m - d) / (se * Math.sqrt(gEv / gTest)) - 1.645);

module.exports = { ROOT, T, PM, STATS, load, graded, famCols, eCols, perStat, design, irls, robustSE, groupsOf, foldOf, fitNudge, fitE, crossFit, T1, T2, calibOf, shuffleWithin, powerT1, powerT2, ll, br, logit, sigm, mean };

/* ---------- round 2: the union family, sparse ----------
 * F, the information-free family PLAN.md's bar controls for: the union of every named rival's features, so that each
 * named rival lies in its span. Per stat (each column zero off its stat): an intercept; logit q; logit of the Over's
 * implied chance; logit of the multiplicative devig less logit q; the margin; the price band as six steps (q above
 * 0.35, 0.40, 0.45, 0.50, 0.55, 0.60: the favourite side is the fourth); home; the season's month (November to April,
 * October the base); the game total less the set's mean, and its square; the club's spread (minus when favoured) and its
 * size; the generic position mix; guard and centre (forward the base); the line's size (log of line + 0.5); the player's
 * posted lines, whether all six are posted, and the player-game's mean logit q; rest with no player in it, his club's
 * and its opponent's second night of a back-to-back (a schedule effect is information-free: P1). Pooled: the price band's three hinges, a
 * night's and a game's posted lines (their count, log) and mean logit q, and the line's logit q within its night,
 * standardised */
const seasonMonth = d => { const m = +d.slice(5, 7); return m >= 10 ? m - 10 : Math.min(m + 2, 6); };   // Oct 0 .. Apr 6 (later months 6)
const STEPS = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60];
const zMultOf = x => logit(x.Io / (x.Io + x.Iu));
/* each club's schedule (games.csv, the lines' own seasons alone), for the rest columns */
function schedOf(L) {
  const seasons = new Set(L.map(x => +x.game.slice(0, 4))), sched = new Map();
  const t = fs.readFileSync(path.join(ROOT, 'data', 'games.csv'), 'utf8').split('\n').filter(Boolean), h = t.shift().split(','), ix = k => h.indexOf(k);
  for (const l of t) { const v = l.split(','); if (!seasons.has(+v[ix('season')])) continue; for (const c of [v[ix('away')], v[ix('home')]]) { if (!sched.has(c)) sched.set(c, []); sched.get(c).push(v[ix('date')]); } }
  for (const a of sched.values()) a.sort();
  return sched;
}
const dayGap = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
function prepBig(L) {
  const sched = schedOf(L);
  const restOf = (club, date) => { const a = sched.get(club) || [], i = a.indexOf(date); if (i < 0) return { b2b: 0, rest: 5, g3in4: 0 };
    const gap = i > 0 ? dayGap(a[i - 1], date) : 9; return { b2b: gap === 1 ? 1 : 0, rest: Math.min(gap, 5), g3in4: i >= 2 && dayGap(a[i - 2], date) <= 3 ? 1 : 0 }; };
  for (const x of L) { if (!x.team) { x.b2b = 0; x.oppB2b = 0; x.rest = 5; x.g3in4 = 0; continue; }
    const [, , aw, hm] = x.game.split('_'), me = restOf(x.team, x.date), op = restOf(x.team === hm ? aw : hm, x.date);
    x.b2b = me.b2b; x.oppB2b = op.b2b; x.rest = me.rest; x.g3in4 = me.g3in4; x.oppRest = op.rest; }
  const pg = new Map(); for (const x of L) { const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, []); pg.get(k).push(x); }
  for (const [, a] of pg) { const mz = mean(a.map(x => x.zq)); for (const x of a) x.pgZ = mz; }
  for (const x of L) { x.sm = seasonMonth(x.date); x.zmq = zMultOf(x) - x.zq; x.lsz = Math.log(x.line + 0.5); }
}
const PER = 31, POOL = 8, NBIG = STATS.length * PER + POOL;
function bigSparse(x) {
  const s = STATS.indexOf(x.stat), b = s * PER, idx = [], val = [];
  const put = (j, v) => { if (v !== 0 && Number.isFinite(v)) { idx.push(j); val.push(v); } };
  put(b, 1); put(b + 1, x.zq); put(b + 2, x.zo); put(b + 3, x.zmq); put(b + 4, x.M * 10);
  STEPS.forEach((t, k) => put(b + 5 + k, x.q > t ? 1 : 0));
  put(b + 11, x.home || 0);
  for (let m = 1; m <= 6; m++) put(b + 11 + m, x.sm === m ? 1 : 0);
  put(b + 18, x.totC / 10); put(b + 19, (x.totC / 10) ** 2); put(b + 20, x.spr / 10); put(b + 21, Math.abs(x.spr) / 10);
  put(b + 22, x.dPos || 0); put(b + 23, x.pos === 'G' ? 1 : 0); put(b + 24, x.pos === 'C' ? 1 : 0);
  put(b + 25, x.lsz); put(b + 26, x.nPl); put(b + 27, x.pgZ); put(b + 28, x.nPl >= 6 ? 1 : 0); put(b + 29, x.b2b || 0); put(b + 30, x.oppB2b || 0);
  const p = STATS.length * PER;
  put(p, hinge(x.zq, K1)); put(p + 1, hinge(x.zq, K2)); put(p + 2, hinge(x.zq, K3));
  put(p + 3, Math.log(x.nN)); put(p + 4, x.nZ); put(p + 5, Math.log(x.gN)); put(p + 6, x.gZ); put(p + 7, x.nZs);
  return { idx, val };
}
/* the candidate's own information-free part, sparse: per stat an intercept, logit q, logit of the Over's implied chance */
const NE = STATS.length * 3;
function eSparse(x) { const s = STATS.indexOf(x.stat) * 3; return { idx: [s, s + 1, s + 2], val: [1, x.zq, x.zo] }; }
/* rows: [{idx, val}] over k columns; extra dense columns appended (each an array over the rows) */
function sparseRows(L, f, extra = []) {
  return L.map((x, t) => { const r = f(x); const idx = r.idx.slice(), val = r.val.slice(); extra.forEach((e, j) => { const v = e[t]; if (v !== 0) { idx.push(-1 - j); val.push(v); } }); return { idx, val }; });
}
/* Newton on sparse rows: k base columns, then extra columns (index -1 - j maps to k + j). A ridge lam on every column
   but each stat's intercept and the extra columns, and only where asked */
function sirls(R, k, nExtra, y, off, lam = 0, iters = 60, beta0 = null, ridgeSkip = () => false) {
  const K = k + nExtra, beta = beta0 ? Float64Array.from(beta0) : new Float64Array(K);
  const col = j => (j < 0 ? k - 1 - j : j);
  const seen = new Uint8Array(K); for (const r of R) for (const j of r.idx) seen[col(j)] = 1;
  const live = []; for (let a = 0; a < K; a++) if (seen[a]) live.push(a);
  const pos = new Int32Array(K).fill(-1); live.forEach((a, u) => { pos[a] = u; });
  const RR = R.map(r => { const ii = new Int32Array(r.idx.length); r.idx.forEach((j, q) => { ii[q] = pos[col(j)]; }); return { ii, vv: Float64Array.from(r.val) }; });
  const kk = live.length;
  let fitted = null;
  for (let it = 0; it < iters; it++) {
    const H = new Float64Array(kk * kk), g = new Float64Array(kk);
    for (let t = 0; t < RR.length; t++) {
      const { ii, vv } = RR[t]; let z = off ? off[t] : 0;
      for (let q = 0; q < ii.length; q++) z += beta[live[ii[q]]] * vv[q];
      const p = 1 / (1 + Math.exp(-z)), w = Math.max(p * (1 - p), 1e-12), r = y[t] - p;
      for (let q = 0; q < ii.length; q++) { const u = ii[q], xu = vv[q]; g[u] += xu * r; const wx = w * xu, base = u * kk; for (let q2 = 0; q2 < ii.length; q2++) H[base + ii[q2]] += wx * vv[q2]; }
    }
    if (lam) for (let u = 0; u < kk; u++) { const a = live[u]; if (a < k && !ridgeSkip(a)) { H[u * kk + u] += lam; g[u] -= lam * beta[a]; } }
    const A = []; for (let u = 0; u < kk; u++) A.push(Array.from(H.subarray(u * kk, (u + 1) * kk)));
    const step = T.solve(A, Array.from(g)); if (!step) return null;
    let mx = 0; live.forEach((a, u) => { beta[a] += step[u]; mx = Math.max(mx, Math.abs(step[u])); });
    fitted = { beta, live, H: A, RR, pos, kk };
    if (mx < 1e-9) break;
  }
  return fitted;
}
const sLin = (fit, r, off) => { let z = off || 0; for (let q = 0; q < r.idx.length; q++) { const j = r.idx[q]; z += fit.beta[j < 0 ? fit.kBase - 1 - j : j] * r.val[q]; } return z; };
/* cluster-robust standard error of the coefficient at column a (in the fit's own numbering) */
function sRobustSE(fit, y, off, a, groups) {
  const { beta, live, RR, pos, kk } = fit, n = RR.length, p = new Float64Array(n);
  for (let t = 0; t < n; t++) { const { ii, vv } = RR[t]; let z = off ? off[t] : 0; for (let q = 0; q < ii.length; q++) z += beta[live[ii[q]]] * vv[q]; p[t] = 1 / (1 + Math.exp(-z)); }
  /* the fit's own information matrix (its last Newton step's, the ridge in it) */
  const e = new Array(kk).fill(0); e[pos[a]] = 1; const u = T.solve(fit.H.map(r => r.slice()), e); if (!u) return NaN;
  let s = 0; for (const g of groups) { let d = 0; for (const t of g) { const { ii, vv } = RR[t]; let xu = 0; for (let q = 0; q < ii.length; q++) xu += u[ii[q]] * vv[q]; d += xu * (y[t] - p[t]); } s += d * d; }
  const G = groups.length; return Math.sqrt(s * G / (G - 1));
}
/* the family cross-fitted on evaluation lines, 5 folds by game, ridge lam (the plan's: 5) */
function crossFitBig(Lev, K = 5, lam = 5) {
  const z = new Float64Array(Lev.length), R = Lev.map(bigSparse);
  for (let k = 0; k < K; k++) {
    const tr = [], te = []; Lev.forEach((x, i) => (foldOf(x.game, K) === k ? te : tr).push(i));
    const f = sirls(tr.map(i => R[i]), NBIG, 0, Float64Array.from(tr, i => Lev[i].o), null, lam, 60, null, a => a % PER === 0 && a < STATS.length * PER);
    for (const i of te) { let s = 0; const r = R[i]; for (let q = 0; q < r.idx.length; q++) s += f.beta[r.idx[q]] * r.val[q]; z[i] = s; }
  }
  return z;
}
/* T1 on the union family: logit P = F(x) + b n, unpenalised, cluster-robust; a nudge (nearly) inside the family's span
   (its residual on the family under 1e-6 of its variance) has no b */
/* the share of a nudge's variance its least-squares fit on the family leaves (a whisker of ridge for the family's exact
   collinearities, such as a month dummy set that covers every evaluation line) */
function sOrth(R, k, v) {
  const seen = new Uint8Array(k); for (const r of R) for (const j of r.idx) seen[j] = 1;
  const live = []; for (let a = 0; a < k; a++) if (seen[a]) live.push(a); const pos = new Int32Array(k).fill(-1); live.forEach((a, u) => { pos[a] = u; });
  const kk = live.length, A = Array.from({ length: kk }, () => new Array(kk).fill(0)), r = new Array(kk).fill(0);
  R.forEach((row, t) => { for (let q = 0; q < row.idx.length; q++) { const u = pos[row.idx[q]], xu = row.val[q]; r[u] += xu * v[t]; for (let q2 = 0; q2 < row.idx.length; q2++) A[u][pos[row.idx[q2]]] += xu * row.val[q2]; } });
  for (let u = 0; u < kk; u++) A[u][u] += 1e-6 * (A[u][u] || 1);
  const beta = T.solve(A, r); if (!beta) return null;
  let ssr = 0, sst = 0; const mv = mean(Array.from(v));
  R.forEach((row, t) => { let f = 0; for (let q = 0; q < row.idx.length; q++) f += beta[pos[row.idx[q]]] * row.val[q]; ssr += (v[t] - f) ** 2; sst += (v[t] - mv) ** 2; });
  return sst > 0 ? ssr / sst : 0;
}
function T1big(Lev, nArr, Rfam) {
  const R = Rfam || Lev.map(bigSparse), y = Float64Array.from(Lev, x => x.o), n = Lev.length;
  const orth = sOrth(R, NBIG, nArr);
  if (orth == null || orth < 1e-6) return { b: NaN, se: NaN, lo: NaN, hi: NaN, collinear: true, orth };
  const rows = R.map((r, t) => ({ idx: nArr[t] !== 0 ? [...r.idx, -1] : r.idx, val: nArr[t] !== 0 ? [...r.val, nArr[t]] : r.val }));
  /* a whisker of ridge (1e-3) on the family alone, never on b: it settles the family's exact collinearities */
  const f = sirls(rows, NBIG, 1, y, null, 1e-3, 60);
  if (!f) return { b: NaN, se: NaN, lo: NaN, hi: NaN, collinear: true };
  f.kBase = NBIG; const a = NBIG; const b = f.beta[a];
  if (f.pos[a] < 0) return { b: NaN, se: NaN, lo: NaN, hi: NaN, collinear: true };
  const se = sRobustSE(f, y, null, a, T.groupBy(Lev, x => x.game));
  const bad = !Number.isFinite(se);
  return { b, se, lo: b - 1.645 * se, hi: b + 1.645 * se, collinear: bad, orth };
}
/* a nudge's weights, fitted jointly with the union family on training lines (the candidate's way: they carry only what
   the family does not); then the candidate's own information-free part with the frozen nudge as an offset, its slopes
   shrunk toward the identity (a ridge on logit q's coefficient less 1 and on the others) */
function fitNudgeBig(Ltr, featf, lam = 5) {
  const nf = featf(Ltr[0]).length, y = Float64Array.from(Ltr, x => x.o);
  const R = Ltr.map(x => { const r = bigSparse(x), f = featf(x); const idx = r.idx.slice(), val = r.val.slice(); f.forEach((v, j) => { if (v !== 0) { idx.push(-1 - j); val.push(v); } }); return { idx, val }; });
  const fit = sirls(R, NBIG, nf, y, null, lam, 60, null, a => a % PER === 0 && a < STATS.length * PER);
  if (!fit) return null;
  const w = Array.from(fit.beta.slice(NBIG, NBIG + nf));
  const nud = x => { const f = featf(x); let s = 0; for (let a = 0; a < nf; a++) s += w[a] * f[a]; return s; };
  /* E: logit q as an offset too, so the ridge shrinks toward the identity */
  const off = Float64Array.from(Ltr, x => nud(x) + x.zq), RE = Ltr.map(eSparse), fe = sirls(RE, NE, 0, y, off, lam, 60, null, a => a % 3 === 0);
  const eb = Array.from(fe.beta), eOf = x => { const r = eSparse(x); let s = x.zq; for (let q = 0; q < 3; q++) s += eb[r.idx[q]] * r.val[q]; return s; };
  return { w, nud, eOf, eb };
}
function fitEBig(Ltr, lam = 5) {
  const y = Float64Array.from(Ltr, x => x.o), off = Float64Array.from(Ltr, x => x.zq), fe = sirls(Ltr.map(eSparse), NE, 0, y, off, lam, 60, null, a => a % 3 === 0), eb = Array.from(fe.beta);
  return x => { const r = eSparse(x); let s = x.zq; for (let q = 0; q < 3; q++) s += eb[r.idx[q]] * r.val[q]; return s; };
}
Object.assign(module.exports, { seasonMonth, prepBig, bigSparse, NBIG, PER, eSparse, sirls, sRobustSE, crossFitBig, T1big, fitNudgeBig, fitEBig, zMultOf });
