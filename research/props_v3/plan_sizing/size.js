/* PLAN.md's sizing checks, step 2: the bar's criteria on development data (research only: SIZING, no candidate).
 *
 *   node research/props_v3/plan_sizing/rows.js     (first: the table, about 10 s)
 *   node research/props_v3/plan_sizing/size.js     -> research/props_v3/results/plan_sizing.json (about 15 minutes)
 *
 * On DraftKings' 2023-24 lines (development data) and, as a sign check, the 2026 archive's six base stats (spent):
 *   - the stand-in nudges, a box-score forecaster's disagreement with DraftKings (S_d), its stat-mix part alone (S_mix:
 *     DraftKings' own level, the forecaster's mix) and both parts (S_mixlvl), each weight per stat fitted on training
 *     lines with the information-free family as controls;
 *   - every information-free rival PLAN.md names, fitted on the same training lines on top of DraftKings' fair chance;
 *   - the same S_mix nudge with its values shuffled across players (within stat and month), 20 times;
 * each then held to T1 and T2 (lib.js) on evaluation lines it was not fitted on, in three splits: chronological
 * (training to 31 January 2024, evaluation from 1 February), and nights taken alternately (training on one half,
 * evaluation on the other, both ways), the rival-friendly split where no season drift can hurt a rival. Then the
 * forward-chained protocol the development bar uses (each month from December on predicted by the months before it).
 * The stand-in forecaster is tools/props.js's 2024 fold, fitted on 2022-23 box scores: so nothing here is the
 * candidate, and every number is a size, not a result.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./lib.js');
const { STATS, perStat, mean, ll, br, sigm, logit } = S;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const G_TEST = 1100, G_TEST_LO = 900;           // the test's expected games with lines (PLAN.md section 3), and its floor

const { J, L } = S.load('2024');
const G = S.graded(L);
log(`2023-24: ${L.length} posted, ${G.length} graded with a projection and a stat mix (of ${J.counts.graded} graded)`);
const out = { generated: 'PLAN.md sizing (development data; the stand-in is tools/props.js\'s 2024 fold, fitted on 2022-23)', counts: { posted: L.length, graded: G.length, games: new Set(G.map(x => x.game)).size } };
/* sanity: the published gap comes back on these lines (why_it_failed.md section 1: +0.0098 on 89,032) */
out.reproduce = { llModel: mean(G.map(x => ll(x.pModel, x.o))), llDK: mean(G.map(x => ll(x.q, x.o))), overRate: mean(G.map(x => x.o)), dkSaid: mean(G.map(x => x.q)) };
log(`reproduce: model ${out.reproduce.llModel.toFixed(4)} DK ${out.reproduce.llDK.toFixed(4)}`);
out.mix = { playerGames: new Set(G.map(x => x.game + '|' + x.player)).size, linesOnPlayerGamesWith2Plus: mean(G.map(x => (x.nPl >= 2 ? 1 : 0))),
  sd: Object.fromEntries(STATS.map(s => { const z = G.filter(x => x.stat === s); const sd = a => Math.sqrt(mean(a.map(v => v * v)) - mean(a) ** 2); return [s, { d: sd(z.map(x => x.d)), dMix: sd(z.map(x => x.dMix)), dLvl: sd(z.map(x => x.dLvl)), dPos: sd(z.map(x => x.dPos || 0)) }]; })) };

/* ---------- the nudges ---------- */
const STAND = {
  S_d: perStat(x => x.d),
  S_mix: perStat(x => x.dMix),
  S_mixlvl: x => [...perStat(y => y.dMix)(x), ...perStat(y => y.dLvl)(x)],
};
/* each information-free rival, fitted on training lines on top of DraftKings' fair chance (logit q the offset), or
   with no fit where a rule fixes it (another devig) */
const zMult = x => logit(x.Io / (x.Io + x.Iu));
const zAdd = x => logit(Math.min(Math.max(x.Io - x.M / 2, 1e-4), 1 - 1e-4));
const zPow = x => { let lo = 1, hi = 3; for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (x.Io ** k + x.Iu ** k > 1) lo = k; else hi = k; } return logit(x.Io ** ((lo + hi) / 2)); };
const BANDS = [0.35, 0.40, 0.45, 0.50, 0.55, 0.60];
const bandOf = q => BANDS.filter(b => q > b).length;           // 0..6
const MON = ['2023-10', '2023-11', '2023-12', '2024-01', '2024-02', '2024-03', '2024-04'];
const RIVALS = {
  R1_rescale: { cols: x => [1, x.zq] },
  R1s_rescale_by_stat: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.zq] : [0, 0])) },
  R2_mult: { fixed: x => zMult(x) - x.zq },
  R2_power: { fixed: x => zPow(x) - x.zq },
  R2_additive: { fixed: x => zAdd(x) - x.zq },
  R2_marginOnUnder: { fixed: x => x.zo - x.zq },
  R2_devig_fitted: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.zq, zMult(x) - x.zq, x.M] : [0, 0, 0, 0])) },
  R3_stat: { cols: x => STATS.map(s => (x.stat === s ? 1 : 0)) },
  R3_band: { cols: x => STATS.flatMap(s => { const b = bandOf(x.q); return [0, 1, 2, 3, 4, 5, 6].map(k => (x.stat === s && b === k ? 1 : 0)); }) },
  R3_side: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.fav, x.home || 0] : [0, 0, 0])) },
  R4_month: { cols: x => STATS.flatMap(s => MON.map(m => (x.stat === s && x.month === m ? 1 : 0))) },
  R5_night: { cols: x => [...STATS.map(s => (x.stat === s ? 1 : 0)), x.nZs, x.nZ, Math.log(x.nN), x.gZ, Math.log(x.gN)] },
  R7_game: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.spr / 10, x.totC / 10, (x.totC / 10) ** 2, Math.abs(x.spr) / 10] : [0, 0, 0, 0, 0])) },
  R8_position: { cols: x => STATS.flatMap(s => ['G', 'F', 'C'].map(p => (x.stat === s && (x.pos === p || (p === 'F' && !['G', 'C'].includes(x.pos))) ? 1 : 0)).concat(x.stat === s ? [x.dPos || 0] : [0])) },
  R9_posting: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.nPl, x.nPl >= 6 ? 1 : 0] : [0, 0, 0])) },
};
RIVALS.R_all = { cols: x => ['R1s_rescale_by_stat', 'R2_devig_fitted', 'R3_band', 'R3_side', 'R4_month', 'R5_night', 'R7_game', 'R8_position', 'R9_posting'].flatMap(k => RIVALS[k].cols(x)) };
function fitRival(Ltr, R) {
  if (R.fixed) return R.fixed;
  const idx = Ltr.map((_, i) => i), y = Float64Array.from(Ltr, x => x.o), off = Float64Array.from(Ltr, x => x.zq);
  const X = S.design(idx, Ltr, R.cols), f = S.irls(X, y, off, 1); const b = Array.from(f.beta);
  return x => { const c = R.cols(x); let s = 0; for (let a = 0; a < c.length; a++) s += b[a] * c[a]; return s; };
}

function evaluate(name, Ltr, Lev, opts = {}) {
  log(`${name}: training ${Ltr.length} lines, evaluation ${Lev.length} on ${new Set(Lev.map(x => x.game)).size} games`);
  const idx = Lev.map((_, i) => i), Xfam = S.design(idx, Lev, S.famCols), zcf = S.crossFit(Lev);
  const gEv = new Set(Lev.map(x => x.game)).size;
  const res = { training: Ltr.length, evaluation: Lev.length, games: gEv, stand: {}, rivals: {}, shuffled: [] };
  const crit = nArr => {
    const t1 = S.T1(Lev, nArr, Xfam), t2 = S.T2(Lev, nArr, zcf);
    return { t1, t2, sdNudge: Math.sqrt(mean(Array.from(nArr, v => v * v)) - mean(Array.from(nArr)) ** 2),
      power: { T1at0: S.powerT1(t1.b, t1.se, gEv, G_TEST), T1at025: S.powerT1(t1.b, t1.se, gEv, G_TEST, 0.25), T2at0: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST, 0), T2at5e5: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST, 5e-5), T2at1e4: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST, 1e-4),
        T2br0: S.powerT2(t2.br, t2.brSE, gEv, G_TEST, 0), T2br2e5: S.powerT2(t2.br, t2.brSE, gEv, G_TEST, 2e-5), T2_G900_1e4: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST_LO, 1e-4), T2_halfEffect_1e4: S.powerT2(t2.ll / 2, t2.llSE, gEv, G_TEST, 1e-4) } };
  };
  /* the frozen candidate's own parts, for its level and calibration: q, the information-free part alone, and that part
     with the nudge */
  const eOnly = S.fitE(Ltr);
  res.level = { q: { ll: mean(Lev.map(x => ll(x.q, x.o))), br: mean(Lev.map(x => br(x.q, x.o))) }, eFrozen: { ll: mean(Lev.map(x => ll(sigm(eOnly(x)), x.o))) }, eCross: { ll: mean(Lev.map((x, i) => ll(sigm(zcf[i]), x.o))) }, toolsProps: { ll: mean(Lev.map(x => ll(x.pModel, x.o))) } };
  res.level.eFrozenLessQ = S.T2(Lev, Float64Array.from(Lev, x => eOnly(x) - x.zq), Float64Array.from(Lev, x => x.zq));
  res.calib = { q: {}, eFrozen: {} };
  for (const s of STATS) { const ix = Lev.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0), Ls = ix.map(i => Lev[i]);
    res.calib.q[s] = S.calibOf(Ls, Ls.map(x => x.zq)); res.calib.eFrozen[s] = S.calibOf(Ls, Ls.map(x => eOnly(x))); }
  for (const [k, featf] of Object.entries(STAND)) {
    const fz = S.fitNudge(Ltr, featf), nArr = Float64Array.from(Lev, fz.nud);
    const c = crit(nArr);
    c.w = fz.w; c.byStat = {};
    for (const s of STATS) { const ix = Lev.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0); const Ls = ix.map(i => Lev[i]);
      c.byStat[s] = { t2: S.T2(Ls, Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => zcf[i]), 2000), calib: S.calibOf(Ls, Ls.map(x => fz.eOf(x) + fz.nud(x))) }; }
    c.maFrozen = { ll: mean(Lev.map(x => ll(sigm(fz.eOf(x) + fz.nud(x)), x.o))), lessQ: S.T2(Lev, Float64Array.from(Lev, x => fz.eOf(x) + fz.nud(x) - x.zq), Float64Array.from(Lev, x => x.zq)) };
    res.stand[k] = c;
    log(`  ${k}: w ${fz.w.slice(0, 6).map(v => v.toFixed(2)).join(' ')} | T1 b ${c.t1.b.toFixed(3)} [${c.t1.lo.toFixed(3)}, ${c.t1.hi.toFixed(3)}] | T2 ${c.t2.ll.toExponential(2)} [${c.t2.llCi.map(v => v.toExponential(2)).join(', ')}] br ${c.t2.br.toExponential(2)} | power T1 ${c.power.T1at025.toFixed(2)} T2(1e-4) ${c.power.T2at1e4.toFixed(2)}`);
  }
  for (const [k, R] of Object.entries(RIVALS)) {
    const f = fitRival(Ltr, R), nArr = Float64Array.from(Lev, f);
    const c = crit(nArr); res.rivals[k] = c;
    log(`  ${k}: T1 ${c.t1.collinear ? 'collinear with the family (no b)' : `b ${c.t1.b.toFixed(3)} [${c.t1.lo.toFixed(3)}, ${c.t1.hi.toFixed(3)}]`} orth ${c.t1.orth == null ? '-' : c.t1.orth.toExponential(2)} | T2 ${c.t2.ll.toExponential(2)} [${c.t2.llCi.map(v => v.toExponential(2)).join(', ')}] | alone vs q ${S.T2(Lev, nArr, Float64Array.from(Lev, x => x.zq), 2000).ll.toExponential(2)}`);
    c.aloneLessQ = S.T2(Lev, nArr, Float64Array.from(Lev, x => x.zq), 2000);
  }
  /* the stat-mix nudge with its values shuffled across players, within stat and month */
  const fz = S.fitNudge(Ltr, STAND.S_mix), base = Float64Array.from(Lev, x => x.dMix);
  for (let sd = 1; sd <= (opts.shuffles || 20); sd++) {
    const perm = S.shuffleWithin(Lev, base, x => x.stat + '|' + x.month, sd);
    const nArr = Float64Array.from(Lev, (x, i) => fz.w[STATS.indexOf(x.stat)] * perm[i]);
    const t1 = S.T1(Lev, nArr, Xfam), t2 = S.T2(Lev, nArr, zcf, 2000);
    res.shuffled.push({ seed: sd, b: t1.b, lo: t1.lo, hi: t1.hi, ll: t2.ll, llHi: t2.llCi[1], br: t2.br });
  }
  const sh = res.shuffled;
  log(`  shuffled S_mix x${sh.length}: b ${Math.min(...sh.map(z => z.b)).toFixed(3)} to ${Math.max(...sh.map(z => z.b)).toFixed(3)}, met T1 ${sh.filter(z => z.lo > 0).length}, T2 ${Math.min(...sh.map(z => z.ll)).toExponential(2)} to ${Math.max(...sh.map(z => z.ll)).toExponential(2)}, met T2 ${sh.filter(z => z.llHi < 0).length}`);
  return res;
}

/* ---------- the splits ---------- */
const nights = [...new Set(G.map(x => x.date))].sort(), half = new Map(nights.map((d, i) => [d, i % 2]));
out.splits = {};
out.splits.chrono = evaluate('chronological (to 31 Jan | from 1 Feb)', G.filter(x => x.date < '2024-02-01'), G.filter(x => x.date >= '2024-02-01'));
out.splits.alternate0 = evaluate('alternate nights (A | B)', G.filter(x => half.get(x.date) === 0), G.filter(x => half.get(x.date) === 1), { shuffles: 10 });
out.splits.alternate1 = evaluate('alternate nights (B | A)', G.filter(x => half.get(x.date) === 1), G.filter(x => half.get(x.date) === 0), { shuffles: 10 });

/* ---------- the forward-chained protocol the development bar uses: each month from December on predicted by the
   months before it, the out-of-fold lines then held to T1 and T2 together ---------- */
{
  const months = ['2023-12', '2024-01', '2024-02', '2024-03', '2024-04'];
  const oof = [], nud = {}, eA = {};
  for (const k of ['S_d', 'S_mix']) { nud[k] = []; eA[k] = []; }
  for (const mo of months) {
    const tr = G.filter(x => x.month < mo), ev = G.filter(x => x.month === mo);
    const fzs = Object.fromEntries(['S_d', 'S_mix'].map(k => [k, S.fitNudge(tr, STAND[k])]));
    for (const x of ev) { oof.push(x); for (const k of ['S_d', 'S_mix']) { nud[k].push(fzs[k].nud(x)); eA[k].push(fzs[k].eOf(x)); } }
    log(`forward-chained: ${mo} from ${tr.length} earlier lines`);
  }
  const idx = oof.map((_, i) => i), Xfam = S.design(idx, oof, S.famCols), zcf = S.crossFit(oof), gEv = new Set(oof.map(x => x.game)).size;
  out.forwardChained = { lines: oof.length, games: gEv };
  for (const k of ['S_d', 'S_mix']) {
    const nArr = Float64Array.from(nud[k]), t1 = S.T1(oof, nArr, Xfam), t2 = S.T2(oof, nArr, zcf);
    const ma = Float64Array.from(oof, (x, i) => eA[k][i] + nArr[i]);
    const cal = {}; for (const s of STATS) { const ix = idx.filter(i => oof[i].stat === s); cal[s] = { ma: S.calibOf(ix.map(i => oof[i]), ix.map(i => ma[i])), q: S.calibOf(ix.map(i => oof[i]), ix.map(i => oof[i].zq)),
      t2: S.T2(ix.map(i => oof[i]), Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => zcf[i]), 2000) }; }
    out.forwardChained[k] = { t1, t2, power: { T1at025: S.powerT1(t1.b, t1.se, gEv, G_TEST, 0.25), T2at1e4: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST, 1e-4), T2at5e5: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST, 5e-5), T2br2e5: S.powerT2(t2.br, t2.brSE, gEv, G_TEST, 2e-5), T2halfEffect1e4: S.powerT2(t2.ll / 2, t2.llSE, gEv, G_TEST, 1e-4) },
      maLessQ: S.T2(oof, Float64Array.from(oof, (x, i) => ma[i] - x.zq), Float64Array.from(oof, x => x.zq)), maLessToolsProps: mean(oof.map((x, i) => ll(sigm(ma[i]), x.o) - ll(x.pModel, x.o))), calib: cal };
    log(`  ${k} OOF: T1 b ${t1.b.toFixed(3)} [${t1.lo.toFixed(3)}, ${t1.hi.toFixed(3)}] | T2 ${t2.ll.toExponential(2)} [${t2.llCi.map(v => v.toExponential(2)).join(', ')}] | MA less q ${out.forwardChained[k].maLessQ.ll.toExponential(2)}`);
  }
}

/* ---------- the archive (spent, playoffs, provider 100): the nudge frozen on all of 2023-24, a sign check ---------- */
{
  const A = S.graded(S.load('archive').L);
  const zcf = S.crossFit(A, 5, 5), idx = A.map((_, i) => i), Xfam = S.design(idx, A, S.famCols);
  out.archive = { lines: A.length, games: new Set(A.map(x => x.game)).size };
  for (const k of ['S_d', 'S_mix']) { const fz = S.fitNudge(G, STAND[k]), nArr = Float64Array.from(A, fz.nud);
    out.archive[k] = { w: fz.w, t1: S.T1(A, nArr, Xfam), t2: S.T2(A, nArr, zcf) };
    log(`archive ${k}: T1 b ${out.archive[k].t1.b.toFixed(3)} [${out.archive[k].t1.lo.toFixed(3)}, ${out.archive[k].t1.hi.toFixed(3)}] | T2 ${out.archive[k].t2.ll.toExponential(2)} [${out.archive[k].t2.llCi.map(v => v.toExponential(2)).join(', ')}]`); }
  out.archive.q = { ll: mean(A.map(x => ll(x.q, x.o))), overRate: mean(A.map(x => x.o)), said: mean(A.map(x => x.q)) };
}
out.seconds = Math.round((Date.now() - t0) / 1000);
const file = path.join(S.ROOT, 'research', 'props_v3', 'results', 'plan_sizing.json');
fs.writeFileSync(file, JSON.stringify(out, (k, v) => (typeof v === 'number' ? r6(v) : v instanceof Float64Array ? Array.from(v) : v), 1) + '\n');
log(`wrote ${path.relative(S.ROOT, file)}`);
