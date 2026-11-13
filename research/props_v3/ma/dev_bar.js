/* MA on the development bar, D1 to D5 (PLAN.md section 2, as revised on 13 November 2026). Research only.
 *
 *   node research/props_v3/ma/dev_bar.js   -> research/props_v3/results/ma_dev_bar.json and cache/ma/dev_oof.json
 *                                             (about 15 minutes)
 *
 * On DraftKings' 2023-24 lines (development data) with MA's own P23 projections (ma_rows.js), in PLAN.md's
 * forward-chained protocol (dev_lib.js), in the order PLAN.md fixes:
 *   1. the stat-mix nudge with a weight per stat; a stat whose out-of-fold T2 point estimate is above 0 gets weight 0
 *      (PLAN.md 1.1 step 6), and the protocol is run again without it;
 *   2. the secondaries, tried once each in PLAN.md 1.3's order (the level that is left, his minutes trend, teammates out,
 *      his return, early season), each with a weight per stat, admitted only if the nudge with it beats the nudge
 *      without it on log loss (the paired 90% interval wholly below 0, 10,000 resamples of games) and still meets D1
 *      and D2;
 *   3. D1 (T1's b by the 1,000-resample game bootstrap), D2, D3 (power, revised: lines and games, both T2 criteria at
 *      once), D4 (MA's chance against DraftKings' fair chance, tools/props.js's 2024 fold and props_v2's A on the same
 *      lines), D5 (revised: (a), (b), (b'), the claim and the reliability table), and the reports beside them.
 * Every number written is an aggregate: no line, price or player id.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('./dev_lib.js');
const { S, T, STATS, mean, ll, br, sigm, logit, B_MIN, M_LL, M_BR } = V;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const { L } = V.loadMA('2024');
const G = V.sample(L);
log(`2023-24: ${L.length} posted, ${G.length} graded in the sample on ${new Set(G.map(x => x.game)).size} games`);
const out = { what: "MA on PLAN.md's development bar, D1 to D5 (development data: DraftKings' 2023-24 lines; MA's own P23 projections)", sample: { posted: L.length, graded: G.length } };

const per = f => x => STATS.map(s => (x.stat === s ? f(x) : 0));
const featOf = (stats, extra) => x => { const c = stats.map(s => (x.stat === s ? V.dOf(x) : 0)); for (const e of extra) c.push(...per(e.f)(x)); return c; };
/* 1. the stat mix, a weight per stat */
let P1 = V.forward(G, featOf(STATS, []));
const oof = P1.oof, Rfam = oof.map(S.bigSparse), zcf = S.crossFitBig(oof);
out.oof = { lines: oof.length, games: new Set(oof.map(x => x.game)).size };
log(`out-of-fold: ${oof.length} lines on ${out.oof.games} games; F cross-fitted`);
const c1 = V.crit(oof, P1.n, zcf, Rfam);
out.step1 = { weights: P1.w.map(z => ({ month: z.month, w: z.w })), crit: c1 };
const zero = STATS.filter(s => c1.byStat[s].ll > 0);
log(`step 1, all six: T1 b ${c1.t1.b.toFixed(3)} [${c1.t1.lo.toFixed(3)}, ${c1.t1.hi.toFixed(3)}] | T2 ${c1.t2.ll.toExponential(3)} [${c1.t2.llCi.map(v => v.toExponential(2))}] | by stat ${STATS.map(s => `${s} ${(c1.byStat[s].ll * 1e4).toFixed(1)}`).join(' ')}; weight 0 for: ${zero.join(' ') || 'none'}`);
const kept = STATS.filter(s => !zero.includes(s));
let cur = { stats: kept, extra: [] };
let Pc = zero.length ? V.forward(G, featOf(kept, [])) : P1;
let cc = zero.length ? V.crit(oof, Pc.n, zcf, Rfam) : c1;
if (Pc.oof.length !== oof.length || Pc.oof.some((x, i) => x !== oof[i])) throw new Error('the out-of-fold lines are not the same lines in the same order');
out.zeroed = zero;
out.primary = { stats: kept, crit: cc, weights: Pc.w.map(z => ({ month: z.month, w: z.w })) };
log(`primary (${kept.join(' ')}): T1 b ${cc.t1.b.toFixed(3)} [${cc.t1.lo.toFixed(3)}, ${cc.t1.hi.toFixed(3)}] orth ${cc.t1.orth.toFixed(3)} | T2 ${cc.t2.ll.toExponential(3)} [${cc.t2.llCi.map(v => v.toExponential(2))}] br ${cc.t2.br.toExponential(3)} [${cc.t2.brCi.map(v => v.toExponential(2))}] D1 ${cc.D1} D2 ${cc.D2}`);
for (const k of ['n', 'e']) for (let i = 0; i < oof.length; i++) if (!Number.isFinite(Pc[k][i])) throw new Error(`a nudge or E not finite at ${i}`);

/* 2. the secondaries, in PLAN.md 1.3's order */
const SEC = [
  { name: 'level that is left (d_lvl)', f: x => (x.dLvl == null ? 0 : x.dLvl) },
  { name: 'minutes trend', f: x => (x.trend == null ? 0 : x.trend) },
  { name: 'teammates out', f: x => (x.outShare == null ? 0 : x.outShare) },
  { name: 'his return', f: x => (x.ret == null ? 0 : x.ret) },
  { name: 'early season (d x under 10 appearances)', f: x => V.dOf(x) * (x.early ? 1 : 0) },
];
out.secondaries = [];
for (const sec of SEC) {
  const extra = [...cur.extra, sec], Pw = V.forward(G, featOf(cur.stats, extra));
  if (Pw.oof.length !== oof.length || Pw.oof.some((x, i) => x !== oof[i])) throw new Error('the out-of-fold lines are not the same lines in the same order');
  const dl = oof.map((x, i) => ll(sigm(zcf[i] + Pw.n[i]), x.o) - ll(sigm(zcf[i] + Pc.n[i]), x.o));
  const groups = T.groupBy(oof, x => x.game), ci = T.clusterBootMean(groups, dl, 10000, 0);
  const cw = V.crit(oof, Pw.n, zcf, Rfam);
  const admitted = ci[1] < 0 && cw.D1 && cw.D2;
  out.secondaries.push({ name: sec.name, llWithLessWithout: mean(dl), llCi: ci, critWith: { t1: cw.t1, t2: { ll: cw.t2.ll, llCi: cw.t2.llCi, br: cw.t2.br, brCi: cw.t2.brCi }, D1: cw.D1, D2: cw.D2 }, admitted });
  log(`secondary "${sec.name}": with less without ${mean(dl).toExponential(3)} [${ci.map(v => v.toExponential(2))}] D1 ${cw.D1} D2 ${cw.D2}: ${admitted ? 'ADMITTED' : 'not admitted'}`);
  if (admitted) { cur = { stats: cur.stats, extra }; Pc = Pw; cc = cw; }
}
out.final = { stats: cur.stats, secondaries: cur.extra.map(e => e.name), weights: Pc.w.map(z => ({ month: z.month, w: z.w, eb: z.eb, training: z.training })) };

/* 3. D1 by the bootstrap, D2, D3, D4, D5 */
const fin = V.crit(oof, Pc.n, zcf, Rfam, { boot: true, nBootStat: 10000 });
out.D1 = { b: fin.t1boot.b, lo: fin.t1boot.lo, hi: fin.t1boot.hi, resamples: fin.t1boot.resamples, robust: fin.t1, orth: fin.t1.orth, met: fin.D1 };
out.D2 = { ll: fin.t2.ll, llCi: fin.t2.llCi, br: fin.t2.br, brCi: fin.t2.brCi, byStat: fin.byStat, met: fin.D2 };
log(`D1: b ${fin.t1boot.b.toFixed(3)} [${fin.t1boot.lo.toFixed(3)}, ${fin.t1boot.hi.toFixed(3)}] (bootstrap, ${fin.t1boot.resamples}); orth ${fin.t1.orth.toFixed(3)}: ${fin.D1 ? 'met' : 'NOT met'}`);
log(`D2: ll ${fin.t2.ll.toExponential(3)} [${fin.t2.llCi.map(v => v.toExponential(2))}] br ${fin.t2.br.toExponential(3)} [${fin.t2.brCi.map(v => v.toExponential(2))}]; by stat ${STATS.map(s => `${s} ${(fin.byStat[s].ll * 1e4).toFixed(1)} [${fin.byStat[s].llCi.map(v => (v * 1e4).toFixed(1))}]`).join(', ')}: ${fin.D2 ? 'met' : 'NOT met'}`);
const t1i = { b: fin.t1boot.b, lo: fin.t1boot.lo, hi: fin.t1boot.hi };
out.D3 = { at1100: V.power(oof, Pc.n, zcf, t1i, 0.5, 1100, 74.4), at1100full: V.power(oof, Pc.n, zcf, t1i, 1, 1100, 74.4), at900: V.power(oof, Pc.n, zcf, t1i, 0.5, 900, 74.4) };
/* reported beside: the effect reweighted to the price mix of 2022-23's 31 seen games (stat x fair 40-60%) */
{ const Vj = JSON.parse(fs.readFileSync(path.join(S.ROOT, 'research', 'props_v2', 'results', 'espn_validate40.json'), 'utf8')).groups['2023 regular season'];
  const dLL = oof.map((x, i) => ll(sigm(zcf[i] + Pc.n[i]), x.o) - ll(sigm(zcf[i]), x.o)), dBR = oof.map((x, i) => br(sigm(zcf[i] + Pc.n[i]), x.o) - br(sigm(zcf[i]), x.o));
  const even = x => x.q >= 0.4 && x.q <= 0.6; let wl = 0, wb = 0, ws = 0;
  for (const s of STATS) for (const [e, p] of [[1, Vj.byStatScores[s].shareFair40to60], [0, 1 - Vj.byStatScores[s].shareFair40to60]]) {
    const ix = oof.map((x, i) => (x.stat === s && (even(x) ? 1 : 0) === e ? i : -1)).filter(i => i >= 0); if (!ix.length) continue;
    const w = Vj.byStatScores[s].n * p; wl += w * mean(ix.map(i => dLL[i])); wb += w * mean(ix.map(i => dBR[i])); ws += w; }
  out.D3.reweighted2023 = { ll: wl / ws, br: wb / ws, fractionLL: wl / ws / mean(dLL), at1100: V.power(oof, Pc.n, zcf, t1i, 0.5, 1100, 74.4, wl / ws, wb / ws), at900: V.power(oof, Pc.n, zcf, t1i, 0.5, 900, 74.4, wl / ws, wb / ws) }; }
out.D3.met = out.D3.at1100.T1 >= 0.8 && out.D3.at1100.T2joint >= 0.8;
log(`D3 (half the effect, 1,100 x 74.4): T1 ${out.D3.at1100.T1.toFixed(3)} T2 both ${out.D3.at1100.T2joint.toFixed(3)} (ll ${out.D3.at1100.T2ll.toFixed(3)}, br ${out.D3.at1100.T2br.toFixed(3)}); 900: ${out.D3.at900.T2joint.toFixed(3)}; reweighted to 2022-23: ${out.D3.reweighted2023.at1100.T2joint.toFixed(3)}: ${out.D3.met ? 'met' : 'NOT met'}`);
/* D4: MA's chance (E + n, forward-chained) against the three references, on the lines each has */
const refs = JSON.parse(fs.readFileSync(path.join(V.M.CACHE, 'ma', 'refs_2024.json'), 'utf8'));
const zMA = Float64Array.from(oof, (x, i) => Pc.e[i] + Pc.n[i]);
const key = x => x.game + '|' + x.player + '|' + x.stat;
out.D4 = {};
for (const [name, zf] of [['DraftKings', x => x.zq], ['tools/props.js 2024 fold', x => (refs[key(x)] && refs[key(x)].tools != null ? logit(refs[key(x)].tools) : null)], ["props_v2's A", x => (refs[key(x)] && refs[key(x)].A != null ? logit(refs[key(x)].A) : null)]]) {
  const ix = oof.map((x, i) => (zf(x) != null ? i : -1)).filter(i => i >= 0);
  const pr = V.paired(ix.map(i => oof[i]), Float64Array.from(ix, i => zMA[i]), Float64Array.from(ix, i => zf(oof[i])));
  pr.met = pr.llCi[1] < 0 && pr.brCi[1] < 0; out.D4[name] = pr;
  log(`D4 MA less ${name}: ll ${pr.ll.toExponential(3)} [${pr.llCi.map(v => v.toExponential(2))}] br ${pr.br.toExponential(3)} [${pr.brCi.map(v => v.toExponential(2))}] on ${pr.lines} lines: ${pr.met ? 'met' : 'NOT met'}`);
}
out.D4.met = Object.values(out.D4).every(v => v.met);
/* D5, per stat */
out.D5 = { byStat: {} };
for (const s of STATS) {
  const ix = oof.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0), Ls = ix.map(i => oof[i]);
  const c = V.calibStat(Ls, Float64Array.from(ix, i => zMA[i]), Float64Array.from(Ls, x => x.zq));
  out.D5.byStat[s] = c;
  log(`D5 ${s}: MA slope ${c.ma.s.toFixed(2)} [${c.ma.sLo.toFixed(2)}, ${c.ma.sHi.toFixed(2)}], DK ${c.dk.s.toFixed(2)} [${c.dk.sLo.toFixed(2)}, ${c.dk.sHi.toFixed(2)}]; |ln s| MA less DK [${c.absLnSlopeDiff.lo.toFixed(3)}, ${c.absLnSlopeDiff.hi.toFixed(3)}]; said less hit ${(c.saidLessHit * 100).toFixed(2)} (DK ${(c.dkSaidLessHit * 100).toFixed(2)}); (a) ${c.a} (b) ${c.b} (b') ${c.bPrime}: ${c.met ? 'met' : 'NOT met'}, ${c.claim}`);
}
out.D5.met = STATS.every(s => out.D5.byStat[s].met);
/* reported beside: E alone against DraftKings' fair chance, forward-chained (an information-free correction) */
{ const Pe = []; for (const mo of V.MONTHS) { const tr = G.filter(x => x.month < mo), eF = S.fitEBig(tr); for (const x of G.filter(x => x.month === mo)) Pe.push(eF(x)); }
  out.reportEaloneLessDK = V.paired(oof, Float64Array.from(Pe), Float64Array.from(oof, x => x.zq)); }
log(`E alone less DraftKings: ${out.reportEaloneLessDK.ll.toExponential(3)} [${out.reportEaloneLessDK.llCi.map(v => v.toExponential(2))}]`);
out.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_bar.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
fs.writeFileSync(path.join(V.M.CACHE, 'ma', 'dev_oof.json'), JSON.stringify({ keys: oof.map(key), n: Array.from(Pc.n), e: Array.from(Pc.e), zcf: Array.from(zcf), final: out.final }));
log(`wrote results/ma_dev_bar.json: D1 ${out.D1.met} D2 ${out.D2.met} D3 ${out.D3.met} D4 ${out.D4.met} D5 ${out.D5.met}`);
