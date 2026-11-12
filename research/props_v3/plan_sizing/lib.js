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
