/* props_v3 why_lib.js: the small, independent toolkit the "why it failed" diagnosis scripts share (why_trial.js,
 * why_lines.js). Research only: nothing here is used by the job or the page, and nothing here fits, chooses or scores a
 * candidate.
 *
 * Written fresh for this study (11-12 November 2026), not copied from research/props_v2: the scores, the game-clustered
 * bootstrap, the logistic regressions and the market's implied mean are this file's own code, so that where they agree
 * with props_v2's published numbers that is a re-derivation, not a repetition. tools/props.js is required only for the
 * model's own distribution (its negative binomial pOver and nbVar), its bootCI (to reproduce the ledger's published
 * interval to the digit, as a check of the inputs) and its constants; it is never changed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PM = require(path.join(ROOT, 'tools', 'props.js'));
const F = require(path.join(ROOT, 'tools', 'props_feed.js'));

const EPS = 1e-6;
const clip = p => Math.min(Math.max(p, EPS), 1 - EPS);
const ll = (p, o) => (o ? -Math.log(clip(p)) : -Math.log(1 - clip(p)));
const br = (p, o) => (p - o) * (p - o);
const logit = p => { const q = clip(p); return Math.log(q / (1 - q)); };
const sigm = z => 1 / (1 + Math.exp(-z));
const sum = a => { let s = 0; for (const x of a) s += x; return s; };
const mean = a => (a.length ? sum(a) / a.length : NaN);
const implied = a => (a > 0 ? 100 / (a + 100) : -a / (-a + 100));
/* DraftKings' fair chance of the Over: the hub's rule, the whole margin on the Over (1 minus the Under's implied) */
const fairOver = (over, under) => 1 - implied(under);

/* a plain csv reader (the repo's csv files carry no quoted commas) */
function csv(file) {
  const t = fs.readFileSync(file, 'utf8').split('\n').filter(l => l.length);
  const h = t.shift().split(',');
  return t.map(l => { const v = l.split(','); const o = {}; for (let i = 0; i < h.length; i++) o[h[i]] = v[i]; return o; });
}

/* a seeded generator of its own (splitmix32), so every interval here comes back the same on every run */
function rng(seed) {
  let s = (seed >>> 0) ^ 0x9e3779b9;
  return () => {
    s = (s + 0x9e3779b9) >>> 0;
    let z = s;
    z = Math.imul(z ^ (z >>> 16), 0x85ebca6b) >>> 0;
    z = Math.imul(z ^ (z >>> 13), 0xc2b2ae35) >>> 0;
    z = (z ^ (z >>> 16)) >>> 0;
    return z / 4294967296;
  };
}

/* group row indices by a key (the game: the unit of independence, as the bar resamples) */
function groupBy(rows, key) {
  const m = new Map();
  rows.forEach((r, i) => { const k = key(r); if (!m.has(k)) m.set(k, []); m.get(k).push(i); });
  return [...m.values()];
}

/* the game-clustered bootstrap of any statistic: resample the games with replacement nBoot times, compute stat on the
   rows drawn (indices, a game drawn twice counted twice), and return the 5th and 95th percentiles */
function clusterBoot(groups, stat, nBoot = 2000, seed = 0) {
  const R = rng(seed), n = groups.length, vals = [];
  for (let b = 0; b < nBoot; b++) {
    const idx = [];
    for (let j = 0; j < n; j++) { const g = groups[Math.floor(R() * n)]; for (const i of g) idx.push(i); }
    const v = stat(idx);
    if (Number.isFinite(v)) vals.push(v);
  }
  vals.sort((a, b) => a - b);
  const q = p => vals[Math.min(vals.length - 1, Math.max(0, Math.floor(p * vals.length)))];
  return [q(0.05), q(0.95)];
}
/* the same for a difference of means, fast: per game the sum of the per-line difference and the count */
function clusterBootMean(groups, d, nBoot = 10000, seed = 0) {
  const gs = groups.map(g => { let s = 0; for (const i of g) s += d[i]; return [s, g.length]; });
  const R = rng(seed), n = gs.length, vals = new Float64Array(nBoot);
  for (let b = 0; b < nBoot; b++) { let s = 0, c = 0; for (let j = 0; j < n; j++) { const g = gs[Math.floor(R() * n)]; s += g[0]; c += g[1]; } vals[b] = s / c; }
  vals.sort();
  return [vals[Math.floor(0.05 * nBoot)], vals[Math.floor(0.95 * nBoot)]];
}

/* solve A x = b (small, dense; Gaussian elimination with partial pivoting) */
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    if (Math.abs(M[c][c]) < 1e-14) return null;
    for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  const x = new Array(n).fill(0);
  for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
  return x;
}

/* logistic regression by Newton's method (IRLS) on the rows idx: P(y = 1) = sigm(offset + X beta). X(i) gives row i's
   features (an array), y(i) its 0/1 outcome, off(i) its offset (0 where none). Returns beta, or null if it does not
   converge */
function logreg(idx, X, y, off = () => 0, iters = 50) {
  const k = X(idx[0]).length; let beta = new Array(k).fill(0);
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (const i of idx) {
      const x = X(i); let z = off(i); for (let a = 0; a < k; a++) z += beta[a] * x[a];
      const p = sigm(z), w = Math.max(p * (1 - p), 1e-12), r = y(i) - p;
      for (let a = 0; a < k; a++) { g[a] += x[a] * r; for (let c = a; c < k; c++) H[a][c] += w * x[a] * x[c]; }
    }
    for (let a = 0; a < k; a++) for (let c = 0; c < a; c++) H[a][c] = H[c][a];
    const step = solve(H, g); if (!step) return null;
    beta = beta.map((v, a) => v + step[a]);
    if (Math.max(...step.map(Math.abs)) < 1e-10) return beta;
  }
  return beta;
}
/* the mean log loss of a fitted logistic model on rows idx */
function logregLL(idx, beta, X, y, off = () => 0) {
  let s = 0;
  for (const i of idx) { const x = X(i); let z = off(i); for (let a = 0; a < x.length; a++) z += beta[a] * x[a]; s += ll(sigm(z), y(i)); }
  return s / idx.length;
}

/* ordinary least squares slope (with intercept) of v on u over idx: cov(u, v) / var(u) */
function olsSlope(idx, u, v) {
  let su = 0, sv = 0; for (const i of idx) { su += u[i]; sv += v[i]; }
  const mu = su / idx.length, mv = sv / idx.length; let c = 0, d = 0;
  for (const i of idx) { c += (u[i] - mu) * (v[i] - mv); d += (u[i] - mu) * (u[i] - mu); }
  return c / d;
}

/* the mean a line's two prices imply, read on the model's own distribution: the mean mu at which tools/props.js's
   negative binomial (variance A x mu^B, the fit's, times the row's own multiplier where a forecaster widens it, as
   candidate A does for the bench) gives the Over the chance q. pOver rises with mu, so bisection; a q the distribution
   cannot reach is held at the end it reaches */
function impliedMean(line, q, ab, mult = 1) {
  let lo = 1e-4, hi = Math.max(4 * line + 20, 10);
  const f = mu => PM.pOver(line, mu, PM.nbVar(mu, ab) * mult);
  if (q <= f(lo)) return lo;
  while (f(hi) < q && hi < 1e4) hi *= 2;
  for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (f(mid) < q) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}

/* the scores of a set of lines, each {pModel, pMarket, o, game}: log loss and Brier for both, the differences
   (model less DraftKings: positive means DraftKings is better) with game-clustered 90% intervals */
function scoreLines(lines, nBoot = 10000, seed = 0) {
  if (!lines.length) return null;
  const groups = groupBy(lines, x => x.game);
  const dLL = lines.map(x => ll(x.pModel, x.o) - ll(x.pMarket, x.o));
  const dBR = lines.map(x => br(x.pModel, x.o) - br(x.pMarket, x.o));
  return {
    lines: lines.length, games: groups.length,
    overRate: mean(lines.map(x => x.o)), modelSaid: mean(lines.map(x => x.pModel)), marketSaid: mean(lines.map(x => x.pMarket)),
    llModel: mean(lines.map(x => ll(x.pModel, x.o))), llMarket: mean(lines.map(x => ll(x.pMarket, x.o))),
    llDiff: mean(dLL), llDiffCi: clusterBootMean(groups, dLL, nBoot, seed),
    brModel: mean(lines.map(x => br(x.pModel, x.o))), brMarket: mean(lines.map(x => br(x.pMarket, x.o))),
    brDiff: mean(dBR), brDiffCi: clusterBootMean(groups, dBR, nBoot, seed),
    modelFrom50: mean(lines.map(x => Math.abs(x.pModel - 0.5))), marketFrom50: mean(lines.map(x => Math.abs(x.pMarket - 0.5))),
  };
}

/* calibration: P(Over) = sigm(a + b logit p), fitted on the lines themselves (a description, in sample). b, the slope,
   is 1 for a forecaster whose departures from 50% are exactly right in size, under 1 for one too sure of itself. The
   interval resamples games */
function calib(lines, key, nBoot = 1000, seed = 0) {
  const n = lines.length, idx = lines.map((_, i) => i);
  const one = new Float64Array(n).fill(1), z = Float64Array.from(lines, x => logit(x[key])), y = Float64Array.from(lines, x => x.o);
  const beta = logregF(idx, [one, z], y, null);
  const groups = groupBy(lines, x => x.game);
  const ci = clusterBoot(groups, ix => { const b = logregF(ix, [one, z], y, null, beta); return b ? b[1] : NaN; }, nBoot, seed);
  return { intercept: beta[0], slope: beta[1], slopeCi: ci, n };
}

/* the same Newton's method on columns laid out once (Float64Arrays), for the bootstrap's many refits: P(y = 1) =
   sigm(off + sum_a beta_a cols_a), warm-started at beta0 where given */
function logregF(idx, cols, y, off, beta0 = null, iters = 50) {
  const k = cols.length, beta = beta0 ? Float64Array.from(beta0) : new Float64Array(k);
  for (let it = 0; it < iters; it++) {
    const H = Array.from({ length: k }, () => new Array(k).fill(0)), g = new Array(k).fill(0);
    for (let t = 0; t < idx.length; t++) {
      const i = idx[t]; let zz = off ? off[i] : 0;
      for (let a = 0; a < k; a++) zz += beta[a] * cols[a][i];
      const p = 1 / (1 + Math.exp(-zz)), w = Math.max(p * (1 - p), 1e-12), r = y[i] - p;
      for (let a = 0; a < k; a++) { const xa = cols[a][i]; g[a] += xa * r; for (let c = a; c < k; c++) H[a][c] += w * xa * cols[c][i]; }
    }
    for (let a = 0; a < k; a++) for (let c = 0; c < a; c++) H[a][c] = H[c][a];
    const step = solve(H, g); if (!step) return null;
    let mx = 0; for (let a = 0; a < k; a++) { beta[a] += step[a]; mx = Math.max(mx, Math.abs(step[a])); }
    if (mx < 1e-10) break;
  }
  return Array.from(beta);
}

/* how much a forecaster adds beyond DraftKings' price: P(Over) = sigm(logit q + w (logit m - logit q)), w fitted on the
   lines (in sample, a description). w = 0: the model adds nothing to DraftKings; w = 1: the model alone. The interval
   resamples games. "wFree" adds a free intercept and a free weight on logit q, so that w is not forced to carry
   DraftKings' own miscalibration */
function infoBeyond(lines, mKey = 'pModel', nBoot = 1000, seed = 0) {
  const n = lines.length, idx = lines.map((_, i) => i);
  const y = Float64Array.from(lines, x => x.o), off = Float64Array.from(lines, x => logit(x.pMarket));
  const d = Float64Array.from(lines, x => logit(x[mKey]) - logit(x.pMarket)), one = new Float64Array(n).fill(1);
  const b1 = logregF(idx, [d], y, off);
  const groups = groupBy(lines, x => x.game);
  const ci1 = clusterBoot(groups, ix => { const b = logregF(ix, [d], y, off, b1); return b ? b[0] : NaN; }, nBoot, seed);
  const b3 = logregF(idx, [one, off, d], y, null);
  const ci3 = clusterBoot(groups, ix => { const b = logregF(ix, [one, off, d], y, null, b3); return b ? b[2] : NaN; }, nBoot, seed + 1);
  const llAt = w => mean(lines.map(x => ll(sigm(logit(x.pMarket) + w * (logit(x[mKey]) - logit(x.pMarket))), x.o)));
  return { w: b1[0], wCi: ci1, llGainInSample: llAt(0) - llAt(b1[0]), wFree: b3[2], wFreeCi: ci3, freeIntercept: b3[0], freeSlopeOnDK: b3[1] };
}

/* the log loss a forecaster's chance would score if recalibrated in sample, three ways: a shift alone (the lean), a
   shift and a slope (the lean and the over-sureness), and the slope alone. In sample: what a perfect correction of
   that kind could at most recover on these very lines, not a candidate */
function recal(lines, key) {
  const idx = lines.map((_, i) => i), y = i => lines[i].o, z = i => logit(lines[i][key]);
  const raw = mean(lines.map(x => ll(x[key], x.o)));
  const bShift = logreg(idx, () => [1], y, z);
  const shift = logregLL(idx, bShift, () => [1], y, z);
  const bSlope = logreg(idx, i => [z(i)], y);
  const slope = logregLL(idx, bSlope, i => [z(i)], y);
  const bBoth = logreg(idx, i => [1, z(i)], y);
  const both = logregLL(idx, bBoth, i => [1, z(i)], y);
  return { raw, shiftOnly: shift, shift: bShift[0], slopeOnly: slope, slope: bSlope[0], both, bothCoef: bBoth };
}

module.exports = { ROOT, PM, F, EPS, clip, ll, br, logit, sigm, sum, mean, implied, fairOver, csv, rng, groupBy, clusterBoot, clusterBootMean,
  solve, logreg, logregF, logregLL, olsSlope, impliedMean, scoreLines, calib, infoBeyond, recal };
