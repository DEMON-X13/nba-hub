/* D6: the rivals, on MA's own projections, in the development bar's protocol (PLAN.md section 2, as revised). Research
 * only.
 *
 *   node research/props_v3/ma/dev_rivals.js   -> research/props_v3/results/ma_dev_rivals.json (about 10 minutes)
 *
 * On the same out-of-fold lines as ma_dev_bar.json (December to April 2023-24, each month's fits on the months before),
 * F cross-fitted on them, each rival is held to D1 and D2 as MA is (T1 by the cluster-robust standard error, taken again
 * by the 1,000-resample bootstrap where its lower bound comes within 0.05 of 0.25 or, since the review of 13 November,
 * its z within 0.5 of 4, the other part met or near; D1 asks both b's lower bound above 0.25 and z = b / SE at least 4,
 * and D1 as first written, the b bar alone, is reported beside: dev_lib.js crit):
 *   - MA's own nudge, its d values shuffled across players within stat and month (20 seeds), and within matched cells,
 *     stat x month x position x price band x line (20 seeds; critique C4), each month's frozen weights applied to them;
 *   - the named information-free rivals (plan_sizing/size2.js's, R1 to R9 and all at once), each fitted on the training
 *     months on top of DraftKings' fair chance, as a rival would be built;
 *   - the held-out rivals (size2.js's U1 to U11), fitted the candidate's way (jointly with F);
 *   - the critique's three, fitted the candidate's way: DraftKings' own other lines for the player (their sizes and
 *     prices), the same by position, and the pairwise products of F's continuous features within stat.
 * Every aggregate a rival reads is built from every posted line. Every number written is an aggregate.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('./dev_lib.js');
const { S, T, STATS, mean, logit } = V;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const DB = JSON.parse(fs.readFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_bar.json'), 'utf8'));
const { L } = V.loadMA('2024');
/* the held-out rivals' extra fields, every posted line (size2.js) */
{ const seq = new Map(); for (const x of [...L].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) { const k = x.player + '|' + x.stat, p = seq.get(k); x.dLine = p != null ? x.line - p : 0; x.noPrev = p == null ? 1 : 0; seq.set(k, x.line); } }
for (const x of L) x.dow = new Date(x.date + 'T12:00:00Z').getUTCDay();
{ const by = new Map(); for (const x of L) for (const k of ['n:' + x.date, 'g:' + x.game, 'p:' + x.game + '|' + x.player]) { if (!by.has(k)) by.set(k, []); by.get(k).push(x.M); }
  for (const x of L) { x.nM = mean(by.get('n:' + x.date)); x.gM = mean(by.get('g:' + x.game)); x.pM = mean(by.get('p:' + x.game + '|' + x.player)); } }
/* the critique's: his other posted lines in the game (every posted line) */
{ const pg = new Map(); for (const x of L) { const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, {}); pg.get(k)[x.stat] = x; }
  for (const x of L) { const o = pg.get(x.game + '|' + x.player); x.oth = {}; for (const t of STATS) { const y = o[t]; x.oth[t] = y && t !== x.stat ? { l: Math.log(y.line + 0.5), z: y.zq } : { l: 0, z: 0 }; } } }
const G = V.sample(L);
const P = V.forward(G, V.featFinal(DB.final));
const oof = P.oof, Rfam = oof.map(S.bigSparse), zcf = S.crossFitBig(oof);
if (oof.length !== DB.oof.lines) throw new Error('not the out-of-fold lines of ma_dev_bar.json');
const ma = V.crit(oof, P.n, zcf, Rfam);
log(`MA (as ma_dev_bar.json): T1 b ${ma.t1.b.toFixed(3)} [${ma.t1.lo.toFixed(3)}, ${ma.t1.hi.toFixed(3)}], T2 ${ma.t2.ll.toExponential(3)}`);
const out = { what: "D6: rivals on MA's own projections, forward-chained (development data)", ma: { t1: ma.t1, t2: { ll: ma.t2.ll, llCi: ma.t2.llCi } }, shuffles: { coarse: [], matched: [] }, named: {}, held: {}, critique: {} };
const brief = c => ({ b: c.t1.b, lo: c.t1boot ? c.t1boot.lo : c.t1.lo, hi: c.t1boot ? c.t1boot.hi : c.t1.hi, z: c.z, boot: !!c.t1boot, orth: c.t1.orth, collinear: c.t1.collinear, ll: c.t2.ll, llCi: c.t2.llCi, brCi: c.t2.brCi, worstStatLo: Math.max(...Object.values(c.byStat).map(v => v.llCi[0])), D1: c.D1, D1asFirstWritten: c.D1b, D2: c.D2, marginT1: c.marginT1, marginZ: c.marginZ, marginT2: c.marginT2 });
const say = (k, c) => log(`  ${k}: T1 ${c.collinear ? `no b (orth ${c.orth == null ? '-' : c.orth.toExponential(1)})` : `b ${c.b.toFixed(3)} [${c.lo.toFixed(3)}, ${c.hi.toFixed(3)}] z ${c.z.toFixed(2)} orth ${c.orth.toFixed(3)}`} D1 ${c.D1} | T2 ${c.ll.toExponential(2)} [${c.llCi.map(v => v.toExponential(2))}] D2 ${c.D2}`);
/* 1. the shuffles: each line's own month's frozen weights, applied to a d (and secondaries) shuffled within the cell */
const feat = V.featFinal(DB.final), wOf = new Map(P.w.map(z => [z.month, z.w]));
const band = q => [0.35, 0.4, 0.45, 0.5, 0.55, 0.6].filter(b => q > b).length;
const keys = { coarse: x => x.stat + '|' + x.month, matched: x => [x.stat, x.month, x.pos, band(x.q), x.line].join('|') };
const featVals = oof.map(feat), nf = featVals[0].length;
for (const [kind, key] of Object.entries(keys)) for (let sd = 1; sd <= 20; sd++) {
  /* every feature column shuffled together, by the same permutation, within the cell: the same sizes, no link to the player */
  const R = T.rng(sd * 7919 + (kind === 'matched' ? 1 : 0)), cells = new Map(); oof.forEach((x, i) => { const k = key(x); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); });
  const perm = new Int32Array(oof.length); for (const ix of cells.values()) { const v = ix.slice(); for (let j = v.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [v[j], v[r]] = [v[r], v[j]]; } ix.forEach((i, j) => { perm[i] = v[j]; }); }
  const nArr = Float64Array.from(oof, (x, i) => { const w = wOf.get(x.month), f = featVals[perm[i]]; let s = 0; for (let a = 0; a < nf; a++) s += w[a] * f[a]; return s; });
  const c = brief(V.crit(oof, nArr, zcf, Rfam, { nBoot: 2000, nBootStat: 2000 }));
  out.shuffles[kind].push({ seed: sd, ...c });
}
for (const kind of ['coarse', 'matched']) { const a = out.shuffles[kind]; log(`shuffles ${kind}: b ${Math.min(...a.map(z => z.b)).toFixed(3)} to ${Math.max(...a.map(z => z.b)).toFixed(3)}, lower bounds at most ${Math.max(...a.map(z => z.lo)).toFixed(3)}; T2 ${Math.min(...a.map(z => z.ll)).toExponential(2)} to ${Math.max(...a.map(z => z.ll)).toExponential(2)}; D1 met ${a.filter(z => z.D1).length}, D2 met ${a.filter(z => z.D2).length}`); }
/* 2. the named rivals, on top of DraftKings' fair chance, forward-chained */
const zPow = x => { let lo = 1, hi = 3; for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (x.Io ** k + x.Iu ** k > 1) lo = k; else hi = k; } return logit(x.Io ** ((lo + hi) / 2)); };
const zAdd = x => logit(Math.min(Math.max(x.Io - x.M / 2, 1e-4), 1 - 1e-4));
const MON = [0, 1, 2, 3, 4, 5, 6];
const NAMED = {
  R1_rescale: { cols: x => [1, x.zq] },
  R1s_rescale_by_stat: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.zq] : [0, 0])) },
  R2_mult: { fixed: x => S.zMultOf(x) - x.zq }, R2_power: { fixed: x => zPow(x) - x.zq }, R2_additive: { fixed: x => zAdd(x) - x.zq }, R2_marginOnUnder: { fixed: x => x.zo - x.zq },
  R2_devig_fitted: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.zq, x.zmq, x.M] : [0, 0, 0, 0])) },
  R3_stat: { cols: x => STATS.map(s => (x.stat === s ? 1 : 0)) },
  R3_band: { cols: x => STATS.flatMap(s => MON.map(k => (x.stat === s && band(x.q) === k ? 1 : 0))) },
  R3_side: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.fav, x.home || 0] : [0, 0, 0])) },
  R4_month: { cols: x => STATS.flatMap(s => MON.map(m => (x.stat === s && x.sm === m ? 1 : 0))) },
  R5_night: { cols: x => [...STATS.map(s => (x.stat === s ? 1 : 0)), x.nZs, x.nZ, Math.log(x.nN), x.gZ, Math.log(x.gN)] },
  R7_game: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.spr / 10, x.totC / 10, (x.totC / 10) ** 2, Math.abs(x.spr) / 10] : [0, 0, 0, 0, 0])) },
  R8_position: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.pos === 'G' ? 1 : 0, x.pos === 'C' ? 1 : 0, x.dPos || 0] : [0, 0, 0, 0])) },
  R9_posting: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.nPl, x.nPl >= 6 ? 1 : 0, x.pgZ, x.lsz] : [0, 0, 0, 0, 0])) },
};
NAMED.R_all = { cols: x => Object.keys(NAMED).filter(k => NAMED[k].cols && k !== 'R_all').flatMap(k => NAMED[k].cols(x)) };
function fitNamed(Ltr, R) {
  if (R.fixed) return R.fixed;
  const idx = Ltr.map((_, i) => i), y = Float64Array.from(Ltr, x => x.o), off = Float64Array.from(Ltr, x => x.zq);
  const X = S.design(idx, Ltr, R.cols), f = S.irls(X, y, off, 1); const b = Array.from(f.beta);
  return x => { const c = R.cols(x); let s = 0; for (let a = 0; a < c.length; a++) s += b[a] * c[a]; return s; };
}
for (const [k, R] of Object.entries(NAMED)) {
  const n = []; for (const mo of V.MONTHS) { const f = fitNamed(G.filter(x => x.month < mo), R); for (const x of G.filter(x => x.month === mo)) n.push(f(x)); }
  const c = brief(V.crit(oof, Float64Array.from(n), zcf, Rfam, { nBoot: 2000, nBootStat: 2000 })); out.named[k] = c; say(`named ${k}`, c);
}
/* 3. the held-out rivals and 4. the critique's, the candidate's way, forward-chained */
const HELD = {
  U1_band_by_month: x => { const b = band(x.q); const c = []; for (let k = 1; k <= 6; k++) for (let m = 1; m <= 6; m++) c.push(b >= k && x.sm === m ? 1 : 0); return c; },
  U2_weekday: x => [1, 2, 3, 4, 5, 6].map(d => (x.dow === d ? 1 : 0)),
  U3_home_by_favourite: x => STATS.map(s => (x.stat === s ? (x.home || 0) * x.fav : 0)),
  U4_posted_margins: x => [x.nM * 10, x.gM * 10, x.pM * 10],
  U9_line_move: x => STATS.flatMap(s => (x.stat === s ? [x.dLine, x.noPrev] : [0, 0])),
  U11_schedule_density: x => STATS.flatMap(s => (x.stat === s ? [x.g3in4, x.rest >= 3 ? 1 : 0, x.oppRest >= 3 ? 1 : 0] : [0, 0, 0])),
};
const CRIT = {
  C4_DKX_other_lines: x => { const c = []; for (const s of STATS) for (const t of STATS) { if (t === s) continue; const o = x.oth[t], e = x.stat === s ? 1 : 0; c.push(e * o.l, e * o.z); } return c; },
  C4_DKXP_other_lines_by_position: x => { const c = []; for (const s of STATS) for (const t of STATS) { if (t === s) continue; const o = x.oth[t]; for (const p of ['G', 'F', 'C']) c.push((x.stat === s && (x.pos || 'F') === p ? 1 : 0) * o.l); } return c; },
  C4_PAIR_products: x => { const f = [x.zq, x.zo, x.lsz, x.dPos || 0, x.pgZ, x.nPl, x.totC / 10, x.spr / 10]; const c = []; for (const s of STATS) { const e = x.stat === s ? 1 : 0; for (let a = 0; a < f.length; a++) for (let b = a; b < f.length; b++) c.push(e * f[a] * f[b]); } return c; },
};
function candidateWay(featf, perMonth) {
  const n = [];
  for (const mo of V.MONTHS) { const tr = G.filter(x => x.month < mo), ff = perMonth ? perMonth(tr) : featf, fz = S.fitNudgeBig(tr, ff); if (!fz) return null; for (const x of G.filter(x => x.month === mo)) n.push(fz.nud(x)); }
  return Float64Array.from(n);
}
const U5 = tr => { const qs = {}; for (const s of STATS) { const v = tr.filter(x => x.stat === s).map(x => x.line).sort((a, b) => a - b); qs[s] = [...new Set([0.2, 0.4, 0.6, 0.8].map(p => v[Math.floor(p * v.length)]))]; } const w = Math.max(...STATS.map(s => qs[s].length)); return x => STATS.flatMap(s => { const a = qs[s].map(c => (x.stat === s && x.line > c ? 1 : 0)); while (a.length < w) a.push(0); return a; }); };
for (const [grp, set] of [['held', { ...HELD, U5_line_size_bands: null }], ['critique', CRIT]]) for (const [k, f] of Object.entries(set)) {
  const n = k === 'U5_line_size_bands' ? candidateWay(null, U5) : candidateWay(f);
  if (!n) { out[grp][k] = { singular: true }; log(`  ${grp} ${k}: singular`); continue; }
  const c = brief(V.crit(oof, n, zcf, Rfam, { nBoot: 2000, nBootStat: 2000 })); out[grp][k] = c; say(`${grp} ${k}`, c);
}
const all = [...out.shuffles.coarse, ...out.shuffles.matched, ...Object.values(out.named), ...Object.values(out.held), ...Object.values(out.critique)].filter(c => !c.singular);
out.anyMeetsD1 = all.some(c => c.D1); out.anyMeetsD1asFirstWritten = all.some(c => c.D1asFirstWritten); out.anyMeetsD2 = all.some(c => c.D2);
out.closestT1 = Math.max(...all.filter(c => !c.collinear && c.orth >= V.ORTH_MIN).map(c => c.lo));
out.closestZ = Math.max(...all.filter(c => !c.collinear && c.orth >= V.ORTH_MIN).map(c => c.z));
out.positiveLowerBounds = all.filter(c => !c.collinear && c.orth >= V.ORTH_MIN && c.lo > 0).length;
out.closestT2 = Math.min(...all.map(c => c.llCi[1]));
out.met = !out.anyMeetsD1 && !out.anyMeetsD2;
out.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_rivals.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
log(`D6: ${all.length} rivals; any meets D1 ${out.anyMeetsD1} (as first written ${out.anyMeetsD1asFirstWritten}), D2 ${out.anyMeetsD2}; closest T1 lower bound ${out.closestT1.toFixed(3)} (bar 0.25), highest z ${out.closestZ.toFixed(2)} (bar 4), ${out.positiveLowerBounds} with a lower bound above 0; closest T2 upper bound ${out.closestT2.toExponential(2)} (bar -1e-4): ${out.met ? 'met' : 'NOT met'}`);
