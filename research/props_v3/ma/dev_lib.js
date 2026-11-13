/* The development bar's shared code for MA (PLAN.md section 2). Research only.
 *
 * MA's rows (ma_rows.js) are given the fields the information-free family F reads (plan_sizing/lib.js bigSparse: the
 * same code the scorer will carry) and the nudge's features. Every aggregate F reads over a night, a game or a
 * player-game is built from EVERY posted line (graded, void, push, and lines out of the sample alike: lesson L4). F's
 * generic position mix carries his position's league rates (at the nominal 30 minutes) to DraftKings' level with MA's own
 * level weights. The game lines are data/odds_hist.csv's, of the set's own season alone (no other season's row is
 * parsed into a number). The scoring sample is every graded line of a player with a club on record in the game
 * (PLAN.md 1.5); a line there with no projection carries a nudge of 0.
 *
 * The protocol: a nudge's weights fitted the candidate's way (jointly with F, plan_sizing/lib.js fitNudgeBig) on the
 * months before each month from December to April, E with the frozen nudge as an offset; the out-of-fold lines scored
 * together; F cross-fitted on them (5 folds by game, a ridge of 5). T1's b by the game bootstrap (1,000 resamples, seed
 * 0, warm-started from the full fit), T2's mean differences by the game bootstrap (10,000, seed 0).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('../plan_sizing/lib.js');
const M = require('./ma_lib.js');
const { STATS, mean, ll, br, sigm, logit, PM } = S;
const T = S.T;
const B_MIN = 0.25, ORTH_MIN = 0.05, M_LL = 1e-4, M_BR = 5e-5;
const MONTHS = ['2023-12', '2024-01', '2024-02', '2024-03', '2024-04'];

function loadMA(set) {
  const J = JSON.parse(fs.readFileSync(path.join(M.CACHE, 'ma', `rows_${set}.json`), 'utf8'));
  const L = J.lines, season = set === '2024' ? 2024 : 2026;
  for (const x of L) { x.team = x.club; }
  const by = key => { const m = new Map(); for (const x of L) { const k = key(x); if (!m.has(k)) m.set(k, []); m.get(k).push(x); } return m; };
  const gameL = by(x => x.game), nightL = by(x => x.date), pgL = by(x => x.game + '|' + x.player);
  const nightGames = new Map(); for (const [d, a] of nightL) nightGames.set(d, new Set(a.map(x => x.game)).size);
  for (const [, a] of gameL) { const mz = mean(a.map(x => x.zq)); for (const x of a) { x.gN = a.length; x.gZ = mz; } }
  for (const [d, a] of nightL) { const mz = mean(a.map(x => x.zq)), sd = Math.sqrt(mean(a.map(x => (x.zq - mz) ** 2))) || 1; for (const x of a) { x.nN = nightGames.get(d); x.nZ = mz; x.nZs = (x.zq - mz) / sd; } }
  /* F's generic position mix: his position's rates at 30 minutes, at DraftKings' level by MA's own level weights */
  for (const [, a] of pgL) {
    const q = a.filter(x => x.posRate > 0 && x.muDK != null);
    if (!q.length) continue;
    let tw = 0, tr = 0; for (const x of q) { const m0 = x.posRate * M.NOMINAL_MIN, w = x.muDK * x.muDK / PM.nbVar(x.muDK, x.ab); tw += w; tr += w * (Math.log(x.muDK) - Math.log(m0)); }
    const kp = tr / tw; for (const x of q) { const m2 = x.posRate * M.NOMINAL_MIN * Math.exp(kp); x.dPos = logit(PM.pOver(x.line, m2, PM.nbVar(m2, x.ab))) - x.zq; }
  }
  /* the game lines, the set's own season only */
  const oh = new Map();
  { const t = fs.readFileSync(path.join(S.ROOT, 'data', 'odds_hist.csv'), 'utf8').split('\n').filter(Boolean), h = t.shift().split(','), ix = k => h.indexOf(k);
    for (const l of t) { const v = l.split(','); if (+v[ix('season')] !== season) continue; oh.set(v[ix('game_id')], { homeLine: v[ix('home_line')] === '' ? null : +v[ix('home_line')], total: v[ix('total')] === '' ? null : +v[ix('total')] }); } }
  for (const x of L) { const gl = oh.get(x.game); x.homeLine = gl ? gl.homeLine : null; x.total = gl ? gl.total : null; }
  const mt = mean(L.filter(x => x.total != null).map(x => x.total));
  for (const x of L) { x.spr = x.homeLine == null || x.home == null ? 0 : (x.home ? x.homeLine : -x.homeLine); x.totC = x.total == null ? 0 : x.total - mt; x.fav = x.q > 0.5 ? 1 : 0; if (x.d == null && x.club) x.d0 = true; }
  S.prepBig(L);
  return { J, L };
}
/* the scoring sample: graded lines of players with a club on record in the game */
const sample = L => L.filter(x => x.club && x.status === 'graded');
const dOf = x => (x.d == null ? 0 : x.d);

/* the forward-chained protocol for one nudge: featf (per line, an array of features), its weights refitted each month */
function forward(G, featf, opts = {}) {
  const oof = [], n = [], e = [], w = [];
  for (const mo of (opts.months || MONTHS)) {
    const tr = G.filter(x => x.month < mo), ev = G.filter(x => x.month === mo);
    const fz = S.fitNudgeBig(tr, featf);
    if (!fz) throw new Error(`the nudge's fit for ${mo} is singular`);
    for (const x of ev) { oof.push(x); n.push(fz.nud(x)); e.push(fz.eOf(x)); }
    w.push({ month: mo, w: fz.w, eb: fz.eb, training: tr.length });
  }
  return { oof, n: Float64Array.from(n), e: Float64Array.from(e), w };
}
/* T1's b by the game bootstrap, warm-started from the full fit */
function t1Boot(Lev, nArr, nBoot = 1000, seed = 0, Rfam) {
  const R = Rfam || Lev.map(S.bigSparse), y = Float64Array.from(Lev, x => x.o);
  const rowsAll = R.map((r, t) => ({ idx: nArr[t] !== 0 ? [...r.idx, -1] : r.idx, val: nArr[t] !== 0 ? [...r.val, nArr[t]] : r.val }));
  const full = S.sirls(rowsAll, S.NBIG, 1, y, null, 1e-3, 60);
  const groups = T.groupBy(Lev, x => x.game), rand = T.rng(seed), bs = [];
  for (let b = 0; b < nBoot; b++) {
    const idx = []; for (let j = 0; j < groups.length; j++) for (const i of groups[Math.floor(rand() * groups.length)]) idx.push(i);
    const f = S.sirls(idx.map(i => rowsAll[i]), S.NBIG, 1, Float64Array.from(idx, i => y[i]), null, 1e-3, 30, full.beta);
    if (f && f.pos[S.NBIG] >= 0) bs.push(f.beta[S.NBIG]);
  }
  bs.sort((a, b) => a - b);
  return { b: full.beta[S.NBIG], lo: bs[Math.floor(0.05 * bs.length)], hi: bs[Math.floor(0.95 * bs.length)], resamples: bs.length };
}
/* D1 and D2 together (T1 by the robust standard error unless asked for the bootstrap) */
function crit(Lev, nArr, zcf, Rfam, opts = {}) {
  const t1 = S.T1big(Lev, nArr, Rfam), t2 = S.T2(Lev, nArr, zcf, opts.nBoot || 10000);
  const byStat = {};
  for (const s of STATS) { const ix = Lev.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0);
    const z = S.T2(ix.map(i => Lev[i]), Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => zcf[i]), opts.nBootStat || 2000); byStat[s] = { lines: ix.length, ll: z.ll, llCi: z.llCi, br: z.br }; }
  let boot = null;
  if (opts.boot || (!t1.collinear && Math.abs(t1.lo - B_MIN) < 0.05)) boot = t1Boot(Lev, nArr, 1000, 0, Rfam);
  const lo = boot ? boot.lo : t1.lo;
  const worstStatLo = Math.max(...Object.values(byStat).map(v => v.llCi[0]));
  const D1 = !t1.collinear && t1.orth >= ORTH_MIN && lo > B_MIN, D2 = t2.llCi[1] < -M_LL && t2.brCi[1] < -M_BR && worstStatLo <= 0;
  return { t1: { b: t1.b, se: t1.se, lo: t1.lo, hi: t1.hi, orth: t1.orth, collinear: !!t1.collinear }, t1boot: boot, t2: { ll: t2.ll, llCi: t2.llCi, llSE: t2.llSE, br: t2.br, brCi: t2.brCi, brSE: t2.brSE, games: t2.games, lines: t2.lines }, byStat, D1, D2, marginT1: (boot ? boot.lo : t1.lo) - B_MIN, marginT2: -M_LL - t2.llCi[1] };
}
/* a paired difference of two chances' scores on the same lines (a less b: negative, a better), game bootstrap */
function paired(Lc, za, zb, nBoot = 10000, seed = 0) {
  const groups = T.groupBy(Lc, x => x.game);
  const dl = Lc.map((x, i) => ll(sigm(za[i]), x.o) - ll(sigm(zb[i]), x.o)), db = Lc.map((x, i) => br(sigm(za[i]), x.o) - br(sigm(zb[i]), x.o));
  return { lines: Lc.length, games: groups.length, ll: mean(dl), llCi: T.clusterBootMean(groups, dl, nBoot, seed), br: mean(db), brCi: T.clusterBootMean(groups, db, nBoot, seed) };
}
/* the recalibration slope of a chance on lines: P(Over) = sigm(a + s logit p), Newton */
function slopeOf(idx, z, y) {
  let a = 0, s = 1;
  for (let it = 0; it < 30; it++) {
    let g0 = 0, g1 = 0, h00 = 0, h01 = 0, h11 = 0;
    for (const i of idx) { const p = sigm(a + s * z[i]), w = p * (1 - p), r = y[i] - p; g0 += r; g1 += r * z[i]; h00 += w; h01 += w * z[i]; h11 += w * z[i] * z[i]; }
    const det = h00 * h11 - h01 * h01; if (!(det > 0)) return null;
    const da = (h11 * g0 - h01 * g1) / det, ds = (h00 * g1 - h01 * g0) / det; a += da; s += ds;
    if (Math.abs(da) + Math.abs(ds) < 1e-10) break;
  }
  return { a, s };
}
/* D5 on one stat's lines: (a) the mean chance against the Over rate; (b) the slope's interval (robust); (b') |ln s| of
   MA less DraftKings', 1,000 resamples of games, both refitted in each; the claim; (c) the reliability table */
function calibStat(Ls, zMA, zDK, nBoot = 1000, seed = 0) {
  const n = Ls.length, idx = [...Array(n).keys()], y = Float64Array.from(Ls, x => x.o);
  const cMA = S.calibOf(Ls, zMA), cDK = S.calibOf(Ls, zDK);
  const groups = T.groupBy(Ls, x => x.game), rand = T.rng(seed), diffs = [];
  for (let b = 0; b < nBoot; b++) {
    const ii = []; for (let j = 0; j < groups.length; j++) for (const i of groups[Math.floor(rand() * groups.length)]) ii.push(i);
    const a = slopeOf(ii, zMA, y), d = slopeOf(ii, zDK, y);
    if (a && d && a.s > 0 && d.s > 0) diffs.push(Math.abs(Math.log(a.s)) - Math.abs(Math.log(d.s)));
  }
  diffs.sort((u, v) => u - v);
  const dLo = diffs[Math.floor(0.05 * diffs.length)], dHi = diffs[Math.floor(0.95 * diffs.length)];
  const said = mean(Array.from(zMA, sigm)), hit = mean(Ls.map(x => x.o));
  const a = Math.abs(said - hit) <= 0.015, bb = cMA.sHi >= 0.8 && cMA.sLo <= 1.25, bp = !(dLo > Math.log(1.05));
  const claim = cMA.s >= 0.8 && cMA.s <= 1.25 && cMA.sLo >= 0.67 && cMA.sHi <= 1.5 ? 'calibrated' : 'poorly measured';
  const bands = []; for (let k = 0; k < 10; k++) { const lo = k / 10, hi = (k + 1) / 10, sel = i => { const p = sigm(zMA[i]); return p >= lo && (p < hi || (k === 9 && p <= 1)); }, selD = i => { const p = sigm(zDK[i]); return p >= lo && (p < hi || (k === 9 && p <= 1)); };
    const ia = idx.filter(sel), id = idx.filter(selD);
    bands.push({ band: [lo, hi], ma: { n: ia.length, said: ia.length ? mean(ia.map(i => sigm(zMA[i]))) : null, hit: ia.length ? mean(ia.map(i => y[i])) : null }, dk: { n: id.length, said: id.length ? mean(id.map(i => sigm(zDK[i]))) : null, hit: id.length ? mean(id.map(i => y[i])) : null } }); }
  return { lines: n, ma: cMA, dk: cDK, saidLessHit: said - hit, dkSaidLessHit: mean(Array.from(zDK, sigm)) - hit, absLnSlopeDiff: { lo: dLo, hi: dHi, resamples: diffs.length }, a, b: bb, bPrime: bp, met: a && bb && bp, claim, bands };
}
/* power (PLAN.md D3, revised): standard errors scaled to G games of m lines a game by the larger of the games' and the
   lines' scalings; T2 both criteria at once, drawn with the game sums' correlation (200,000 draws, seeded) */
function power(oofLev, nArr, zcf, t1, frac, G, m, effLL, effBR) {
  const N0 = oofLev.length, groups = T.groupBy(oofLev, x => x.game), G0 = groups.length;
  const dLL = oofLev.map((x, i) => ll(sigm(zcf[i] + nArr[i]), x.o) - ll(sigm(zcf[i]), x.o)), dBR = oofLev.map((x, i) => br(sigm(zcf[i] + nArr[i]), x.o) - br(sigm(zcf[i]), x.o));
  const muLL = effLL != null ? effLL : mean(dLL), muBR = effBR != null ? effBR : mean(dBR);
  /* the standard errors at m lines a game, from 20 seeded draws of each game's lines kept at m / its lines */
  const seM = (ix, d) => { const s = new Map(), c = new Map(); for (const i of ix) { const g = oofLev[i].game; s.set(g, (s.get(g) || 0) + d[i]); c.set(g, (c.get(g) || 0) + 1); } const N = ix.length; let mu = 0; for (const i of ix) mu += d[i]; mu /= N; let v = 0; for (const [g, a] of s) v += (a - mu * c.get(g)) ** 2; const n = s.size; return Math.sqrt(v * n / (n - 1)) / N; };
  const R = T.rng(1000 + Math.round(m)); let sl = 0, sb = 0;
  for (let rep = 0; rep < 20; rep++) { const keep = []; for (const g of groups) { const p = Math.min(1, m / g.length); for (const i of g) if (R() < p) keep.push(i); } sl += seM(keep, dLL); sb += seM(keep, dBR); }
  const k = Math.sqrt(G0 / G), seLL = sl / 20 * k, seBR = sb / 20 * k, lines = m * G;
  const a = groups.map(g => g.reduce((s, i) => s + dLL[i], 0)), b = groups.map(g => g.reduce((s, i) => s + dBR[i], 0)), ma = mean(a), mb = mean(b);
  let c = 0, va = 0, vb = 0; for (let j = 0; j < a.length; j++) { c += (a[j] - ma) * (b[j] - mb); va += (a[j] - ma) ** 2; vb += (b[j] - mb) ** 2; }
  const rho = c / Math.sqrt(va * vb), Rn = T.rng(7), gauss = () => { const u = Rn(), v = Rn(); return Math.sqrt(-2 * Math.log(u + 1e-300)) * Math.cos(2 * Math.PI * v); };
  let hit = 0; const nd = 200000;
  for (let j = 0; j < nd; j++) { const z1 = gauss(), z2 = rho * z1 + Math.sqrt(1 - rho * rho) * gauss(); if (frac * muLL + seLL * z1 + 1.645 * seLL < -M_LL && frac * muBR + seBR * z2 + 1.645 * seBR < -M_BR) hit++; }
  const t1se = (t1.hi - t1.lo) / (2 * 1.645) * Math.max(Math.sqrt(N0 / lines), Math.sqrt(G0 / G));
  return { games: G, linesPerGame: m, frac, T1: PM.normCdf((frac * t1.b - B_MIN) / t1se - 1.645), T2ll: PM.normCdf((-M_LL - frac * muLL) / seLL - 1.645), T2br: PM.normCdf((-M_BR - frac * muBR) / seBR - 1.645), T2joint: hit / nd, rho };
}
/* the nudge's features: d on each kept stat, then each secondary admitted, a weight per stat (PLAN.md 1.3's order) */
const per = f => x => STATS.map(s => (x.stat === s ? f(x) : 0));
const SEC = [
  { name: 'level that is left (d_lvl)', f: x => (x.dLvl == null ? 0 : x.dLvl) },
  { name: 'minutes trend', f: x => (x.trend == null ? 0 : x.trend) },
  { name: 'teammates out', f: x => (x.outShare == null ? 0 : x.outShare) },
  { name: 'his return', f: x => (x.ret == null ? 0 : x.ret) },
  { name: 'early season (d x under 10 appearances)', f: x => dOf(x) * (x.early ? 1 : 0) },
];
const featOf = (stats, extra) => x => { const c = stats.map(s => (x.stat === s ? dOf(x) : 0)); for (const e of extra) c.push(...per(e.f)(x)); return c; };
const featFinal = fin => featOf(fin.stats, fin.secondaries.map(n => { const e = SEC.find(z => z.name === n); if (!e) throw new Error(`no secondary ${n}`); return e; }));
module.exports = { per, SEC, featOf, featFinal, S, M, T, STATS, B_MIN, ORTH_MIN, M_LL, M_BR, MONTHS, loadMA, sample, dOf, forward, t1Boot, crit, paired, slopeOf, calibStat, power, mean, ll, br, sigm, logit, PM };
