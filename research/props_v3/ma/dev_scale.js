/* T1's scale, and the rivals its scale-free part is sized against (the review of 13 November 2026, finding F2). Research
 * only, development data only.
 *
 *   node research/props_v3/ma/dev_scale.js   -> research/props_v3/results/ma_dev_scale.json (about 25 minutes)
 *
 * The finding: in logit P(Over) = F + b n, multiplying the nudge n by c divides b and its interval by c and leaves the
 * share of n's variance outside F where it was, so a rival whose lower bound on b is above 0 at its fitted scale clears
 * T1's 0.25 once it is shrunk enough, with no player information in it. T1 now also asks z = b / SE (SE the standard
 * error b's own 90% interval implies, (hi - lo) / 3.29) to be at least 4 (dev_lib.js Z_MIN), which no rescaling moves.
 * On the same out-of-fold lines as ma_dev_bar.json (December to April 2023-24, each month's fits on the months before),
 * F cross-fitted on them:
 *   1. two of D6's information-free rivals with a lower bound above 0 at their fitted scale, multiplied by c in
 *      {1, 0.6, 0.5, 0.4, 0.3}: U9 (DraftKings' own move of the line since his last game, fitted as dev_rivals.js fits
 *      it) and MA's d shuffled within matched cells (seed 13, dev_rivals.js's permutation): D1 as first written (b's
 *      lower bound above 0.25), D1 as strengthened (and z at least 4) and D2, by dev_lib.js crit;
 *   2. shrunk and regularised rivals, each fitted the candidate's way (jointly with F, a ridge of 5 on F) but with a
 *      ridge on its own columns too, as a careful rival might be built: U9 at ridges of 300, 1,000, 3,000 and 10,000;
 *      the review's rival (per stat a dummy for each line value by price band cell with 150 or more training lines,
 *      chosen on each month's training lines alone, plus U9 and U3, home by favourite) at 20, 100, 400, 1,500 and
 *      5,000; every held-out rival at once (U1 to U4, U5's line-size bands, U9, U11) at 100, 1,000 and 10,000; and the
 *      critique's three at once at 1,000 and 10,000; each held to D1 and D2 as D6 holds a rival (crit: the robust
 *      error, the bootstrap where crit takes it);
 *   3. U9 at 0.3 of its fitted size by the bar's own 1,000-resample bootstrap (seed 0), the reading D1 decides on.
 * The bar's numbers (0.25, 4) were not moved after any of these was seen; Z_MIN was set from D6's committed rivals
 * (PLAN.md section 9). Every number written is an aggregate.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('./dev_lib.js');
const { S, T, STATS, mean } = V;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const DB = JSON.parse(fs.readFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_bar.json'), 'utf8'));
const { L } = V.loadMA('2024');
/* dev_rivals.js's extra fields, on every posted line, verbatim */
{ const seq = new Map(); for (const x of [...L].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) { const k = x.player + '|' + x.stat, p = seq.get(k); x.dLine = p != null ? x.line - p : 0; x.noPrev = p == null ? 1 : 0; seq.set(k, x.line); } }
for (const x of L) x.dow = new Date(x.date + 'T12:00:00Z').getUTCDay();
{ const by = new Map(); for (const x of L) for (const k of ['n:' + x.date, 'g:' + x.game, 'p:' + x.game + '|' + x.player]) { if (!by.has(k)) by.set(k, []); by.get(k).push(x.M); }
  for (const x of L) { x.nM = mean(by.get('n:' + x.date)); x.gM = mean(by.get('g:' + x.game)); x.pM = mean(by.get('p:' + x.game + '|' + x.player)); } }
{ const pg = new Map(); for (const x of L) { const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, {}); pg.get(k)[x.stat] = x; }
  for (const x of L) { const o = pg.get(x.game + '|' + x.player); x.oth = {}; for (const t of STATS) { const y = o[t]; x.oth[t] = y && t !== x.stat ? { l: Math.log(y.line + 0.5), z: y.zq } : { l: 0, z: 0 }; } } }
const G = V.sample(L);
const P = V.forward(G, V.featFinal(DB.final));
const oof = P.oof, Rfam = oof.map(S.bigSparse), zcf = S.crossFitBig(oof);
if (oof.length !== DB.oof.lines) throw new Error('not the out-of-fold lines of ma_dev_bar.json');
const band = q => [0.35, 0.4, 0.45, 0.5, 0.55, 0.6].filter(b => q > b).length;
const brief = c => ({ b: c.t1.b, lo: c.t1boot ? c.t1boot.lo : c.t1.lo, hi: c.t1boot ? c.t1boot.hi : c.t1.hi, z: c.z, boot: !!c.t1boot, orth: c.t1.orth, collinear: c.t1.collinear,
  ll: c.t2.ll, llCi: c.t2.llCi, brCi: c.t2.brCi, D1asFirstWritten: c.D1b, D1: c.D1, D2: c.D2 });
const say = (k, c) => log(`  ${k}: ${c.collinear ? 'no b' : `b ${c.b.toFixed(3)} [${c.lo.toFixed(3)}, ${c.hi.toFixed(3)}] z ${c.z.toFixed(2)} orth ${c.orth.toFixed(3)}`} | D1 as first written ${c.D1asFirstWritten}, D1 ${c.D1} | T2 ${c.ll.toExponential(2)} [${c.llCi.map(v => v.toExponential(2))}] D2 ${c.D2}`);
const rms = n => Math.sqrt(mean(Array.from(n, v => v * v)));
const out = { what: "T1's scale and the scale-free z (the review of 13 November 2026, F2): scaled and regularised information-free rivals on MA's development lines", zMin: V.Z_MIN, bMin: V.B_MIN,
  ma: { bootstrap: { b: DB.D1.b, lo: DB.D1.lo, hi: DB.D1.hi, z: V.zOf(DB.D1.b, DB.D1.lo, DB.D1.hi) } }, scaled: {}, ridge: {}, bootstrap: {} };

/* the rivals' features */
const U9 = x => STATS.flatMap(s => (x.stat === s ? [x.dLine, x.noPrev] : [0, 0]));
const U3 = x => STATS.map(s => (x.stat === s ? (x.home || 0) * x.fav : 0));
const HELD = [
  x => { const b = band(x.q); const c = []; for (let k = 1; k <= 6; k++) for (let m = 1; m <= 6; m++) c.push(b >= k && x.sm === m ? 1 : 0); return c; },
  x => [1, 2, 3, 4, 5, 6].map(d => (x.dow === d ? 1 : 0)),
  U3,
  x => [x.nM * 10, x.gM * 10, x.pM * 10],
  U9,
  x => STATS.flatMap(s => (x.stat === s ? [x.g3in4, x.rest >= 3 ? 1 : 0, x.oppRest >= 3 ? 1 : 0] : [0, 0, 0])),
];
const U5 = tr => { const qs = {}; for (const s of STATS) { const v = tr.filter(x => x.stat === s).map(x => x.line).sort((a, b) => a - b); qs[s] = [...new Set([0.2, 0.4, 0.6, 0.8].map(p => v[Math.floor(p * v.length)]))]; } const w = Math.max(...STATS.map(s => qs[s].length)); return x => STATS.flatMap(s => { const a = qs[s].map(c => (x.stat === s && x.line > c ? 1 : 0)); while (a.length < w) a.push(0); return a; }); };
const CRIT = [
  x => { const c = []; for (const s of STATS) for (const t of STATS) { if (t === s) continue; const o = x.oth[t], e = x.stat === s ? 1 : 0; c.push(e * o.l, e * o.z); } return c; },
  x => { const c = []; for (const s of STATS) for (const t of STATS) { if (t === s) continue; const o = x.oth[t]; for (const p of ['G', 'F', 'C']) c.push((x.stat === s && (x.pos || 'F') === p ? 1 : 0) * o.l); } return c; },
  x => { const f = [x.zq, x.zo, x.lsz, x.dPos || 0, x.pgZ, x.nPl, x.totC / 10, x.spr / 10]; const c = []; for (const s of STATS) { const e = x.stat === s ? 1 : 0; for (let a = 0; a < f.length; a++) for (let b = a; b < f.length; b++) c.push(e * f[a] * f[b]); } return c; },
];
const cat = fs_ => x => fs_.flatMap(f => f(x));
/* the review's cell rival: the cells chosen on the month's training lines alone */
const cellsOf = tr => { const cnt = new Map(); for (const x of tr) { const k = x.stat + '|' + x.line + '|' + band(x.q); cnt.set(k, (cnt.get(k) || 0) + 1); }
  const cells = [...cnt].filter(([, c]) => c >= 150).map(([k]) => k).sort(), ix = new Map(cells.map((k, i) => [k, i])), nc = cells.length;
  return x => { const c = new Array(nc).fill(0); const j = ix.get(x.stat + '|' + x.line + '|' + band(x.q)); if (j != null) c[j] = 1; return [...c, ...U9(x), ...U3(x)]; }; };

/* a nudge fitted the candidate's way (fitNudgeBig: jointly with F, a ridge of 5 on F but each stat's intercept), with a
   ridge lam on its own columns too: sirls ridges base columns only, so the rival's columns are appended as base columns
   scaled by k = sqrt(5 / lam) (a ridge of 5 on a column scaled by k is a ridge of 5 / k^2 = lam on the column) */
function ridgeWay(featOfTrain, lam) {
  const n = [];
  for (const mo of V.MONTHS) {
    const tr = G.filter(x => x.month < mo), featf = featOfTrain(tr), nf = featf(tr[0]).length, y = Float64Array.from(tr, x => x.o), k = Math.sqrt(5 / lam);
    const R = tr.map(x => { const r = S.bigSparse(x), f = featf(x); const idx = r.idx.slice(), val = r.val.slice(); f.forEach((v, j) => { if (v !== 0) { idx.push(S.NBIG + j); val.push(v * k); } }); return { idx, val }; });
    const fit = S.sirls(R, S.NBIG + nf, 0, y, null, 5, 60, null, a => a % S.PER === 0 && a < STATS.length * S.PER);
    if (!fit) throw new Error(`singular at ${mo}`);
    const w = Array.from(fit.beta.slice(S.NBIG, S.NBIG + nf)).map(v => v * k);
    for (const x of G.filter(x => x.month === mo)) { const f = featf(x); let s = 0; for (let a = 0; a < nf; a++) s += w[a] * f[a]; n.push(s); }
  }
  return Float64Array.from(n);
}
/* fitted the candidate's way with no ridge on its own columns (dev_rivals.js candidateWay) */
function candidateWay(featf) { const n = []; for (const mo of V.MONTHS) { const tr = G.filter(x => x.month < mo), fz = S.fitNudgeBig(tr, featf); if (!fz) throw new Error(`singular at ${mo}`); for (const x of G.filter(x => x.month === mo)) n.push(fz.nud(x)); } return Float64Array.from(n); }
const run = (nArr, extra = {}) => ({ ...brief(V.crit(oof, nArr, zcf, Rfam, { nBoot: 2000, nBootStat: 2000 })), rms: rms(nArr), ...extra });

/* 1. scaled */
const n9 = candidateWay(U9);
const feat = V.featFinal(DB.final), wOf = new Map(P.w.map(z => [z.month, z.w])), featVals = oof.map(feat), nf = featVals[0].length;
const nS13 = (() => { const key = x => [x.stat, x.month, x.pos, band(x.q), x.line].join('|'), R = T.rng(13 * 7919 + 1), cells = new Map(); oof.forEach((x, i) => { const k = key(x); if (!cells.has(k)) cells.set(k, []); cells.get(k).push(i); });
  const perm = new Int32Array(oof.length); for (const ix of cells.values()) { const v = ix.slice(); for (let j = v.length - 1; j > 0; j--) { const r = Math.floor(R() * (j + 1)); [v[j], v[r]] = [v[r], v[j]]; } ix.forEach((i, j) => { perm[i] = v[j]; }); }
  return Float64Array.from(oof, (x, i) => { const w = wOf.get(x.month), f = featVals[perm[i]]; let s = 0; for (let a = 0; a < nf; a++) s += w[a] * f[a]; return s; }); })();
for (const [name, base] of [['U9_line_move', n9], ['matched_shuffle_seed13', nS13]]) {
  out.scaled[name] = [];
  for (const c of [1, 0.6, 0.5, 0.4, 0.3]) { const r = run(Float64Array.from(base, v => c * v), { c }); out.scaled[name].push(r); say(`${name} x ${c}`, r); }
}
/* 2. regularised */
const SETS = {
  U9_ridge: { f: () => U9, lams: [300, 1000, 3000, 10000] },
  cells_U9_U3_ridge: { f: cellsOf, lams: [20, 100, 400, 1500, 5000] },
  held_all_ridge: { f: tr => cat([...HELD, U5(tr)]), lams: [100, 1000, 10000] },
  critique_all_ridge: { f: () => cat(CRIT), lams: [1000, 10000] },
};
for (const [name, set] of Object.entries(SETS)) {
  out.ridge[name] = [];
  for (const lam of set.lams) { const r = run(ridgeWay(set.f, lam), { lam }); out.ridge[name].push(r); say(`${name} ${lam}`, r); }
}
/* 3. the bootstrap reading of U9 at 0.3 */
{ const n = Float64Array.from(n9, v => 0.3 * v), tb = V.t1Boot(oof, n, 1000, 0, Rfam), t1 = S.T1big(oof, n, Rfam), z = V.zOf(tb.b, tb.lo, tb.hi);
  out.bootstrap.U9_line_move_x03 = { b: tb.b, lo: tb.lo, hi: tb.hi, resamples: tb.resamples, z, orth: t1.orth, D1asFirstWritten: t1.orth >= V.ORTH_MIN && tb.lo > V.B_MIN, D1: t1.orth >= V.ORTH_MIN && tb.lo > V.B_MIN && z >= V.Z_MIN };
  log(`U9 x 0.3, bootstrap: b ${tb.b.toFixed(3)} [${tb.lo.toFixed(3)}, ${tb.hi.toFixed(3)}] z ${z.toFixed(2)}: D1 as first written ${out.bootstrap.U9_line_move_x03.D1asFirstWritten}, D1 ${out.bootstrap.U9_line_move_x03.D1}`); }
const every = [...Object.values(out.scaled).flat(), ...Object.values(out.ridge).flat()].filter(c => !c.collinear);
out.summary = { rivals: every.length, meetD1asFirstWritten: every.filter(c => c.D1asFirstWritten).length, meetD1: every.filter(c => c.D1).length, meetD2: every.filter(c => c.D2).length, highestZ: Math.max(...every.map(c => c.z)), maZ: out.ma.bootstrap.z };
out.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_scale.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
log(`F2: ${out.summary.rivals} scaled or regularised rivals: ${out.summary.meetD1asFirstWritten} meet D1 as first written, ${out.summary.meetD1} meet D1 as strengthened, ${out.summary.meetD2} meet D2; highest z ${out.summary.highestZ.toFixed(2)} (bar ${V.Z_MIN}; MA ${out.summary.maZ.toFixed(2)})`);
