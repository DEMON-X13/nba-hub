/* PLAN.md's sizing checks, step 4: the bar as PLAN.md writes it, on development data (research only: SIZING).
 *
 *   node research/props_v3/plan_sizing/rows.js      (first: the table)
 *   node research/props_v3/plan_sizing/size2.js     -> research/props_v3/results/plan_sizing2.json (about 20 minutes)
 *
 * Step 2 (size.js) found that with a small information-free family three rivals met T1 on the rival-friendly split
 * (the month by stat, the signed spread, and every rival's features at once). So PLAN.md's family F is the union of the
 * named rivals' features (lib.js bigSparse, 194 columns), and this step holds, on lines none of them was fitted on:
 *   - the stand-in nudges S_mix (the stat mix) and S_d (the raw disagreement), fitted the candidate's way (jointly with
 *     F on training lines);
 *   - every NAMED information-free rival, fitted on training lines on top of DraftKings' fair chance (as a rival would
 *     be built) and, where it is not in F's span, also the candidate's way;
 *   - HELD-OUT information-free rivals, features F does not hold (the price band by month, the day of the week, home
 *     by favourite, the posted margins, the line's size in bands, DraftKings' own move of the line since his last game,
 *     a club's schedule density and either club's long rest), each fitted the candidate's way: these size the margin against a rival
 *     nobody named;
 *   - the stat-mix nudge's values shuffled across players within stat and month, 20 times;
 * to PLAN.md's T1 (b's 90% interval above B_MIN) and T2 (the frozen nudge on F cross-fitted on the evaluation lines:
 * log loss's 90% interval below -M_LL, Brier's below -M_BR, no stat's log loss interval wholly above 0), in the three
 * splits of size.js, and in the forward-chained protocol of the development bar, with the per-stat calibration of the
 * stand-in candidate in the sense PLAN.md states. The archive (spent) is a sign check. Sizing only: the stand-in is
 * tools/props.js's 2024 fold, fitted on 2022-23 box scores, which no candidate may stand on.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./lib.js');
const { STATS, perStat, mean, ll, br, sigm, logit } = S;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const B_MIN = 0.25, ORTH_MIN = 0.05, M_LL = 1e-4, M_BR = 5e-5;   // PLAN.md section 4
const G_TEST = 1100, G_TEST_LO = 900;
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);

const { L } = S.load('2024');
S.prepBig(L);
/* DraftKings' own move: this line less his line on the same stat in his last game with one this season (every posted
   line, by date) */
{ const seq = new Map(); for (const x of [...L].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))) { const k = x.player + '|' + x.stat, p = seq.get(k); x.dLine = p != null ? x.line - p : 0; x.noPrev = p == null ? 1 : 0; seq.set(k, x.line); } }
for (const x of L) x.dow = new Date(x.date + 'T12:00:00Z').getUTCDay();
{ const by = new Map(); for (const x of L) { for (const k of ['n:' + x.date, 'g:' + x.game, 'p:' + x.game + '|' + x.player]) { if (!by.has(k)) by.set(k, []); by.get(k).push(x.M); } }
  for (const x of L) { x.nM = mean(by.get('n:' + x.date)); x.gM = mean(by.get('g:' + x.game)); x.pM = mean(by.get('p:' + x.game + '|' + x.player)); } }
const G = S.graded(L);
log(`2023-24: ${G.length} graded lines; family ${S.NBIG} columns`);

const STAND = { S_mix: perStat(x => x.dMix), S_d: perStat(x => x.d) };
const zPow = x => { let lo = 1, hi = 3; for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (x.Io ** k + x.Iu ** k > 1) lo = k; else hi = k; } return logit(x.Io ** ((lo + hi) / 2)); };
const zAdd = x => logit(Math.min(Math.max(x.Io - x.M / 2, 1e-4), 1 - 1e-4));
const MON = [0, 1, 2, 3, 4, 5, 6];
const bandOf = q => [0.35, 0.40, 0.45, 0.50, 0.55, 0.60].filter(b => q > b).length;
/* the named rivals, fitted on top of DraftKings' fair chance (or fixed by their rule) */
const NAMED = {
  R1_rescale: { cols: x => [1, x.zq] },
  R1s_rescale_by_stat: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.zq] : [0, 0])) },
  R2_mult: { fixed: x => S.zMultOf(x) - x.zq }, R2_power: { fixed: x => zPow(x) - x.zq }, R2_additive: { fixed: x => zAdd(x) - x.zq }, R2_marginOnUnder: { fixed: x => x.zo - x.zq },
  R2_devig_fitted: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.zq, x.zmq, x.M] : [0, 0, 0, 0])) },
  R3_stat: { cols: x => STATS.map(s => (x.stat === s ? 1 : 0)) },
  R3_band: { cols: x => STATS.flatMap(s => [0, 1, 2, 3, 4, 5, 6].map(k => (x.stat === s && bandOf(x.q) === k ? 1 : 0))) },
  R3_side: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.fav, x.home || 0] : [0, 0, 0])) },
  R4_month: { cols: x => STATS.flatMap(s => MON.map(m => (x.stat === s && x.sm === m ? 1 : 0))) },
  R5_night: { cols: x => [...STATS.map(s => (x.stat === s ? 1 : 0)), x.nZs, x.nZ, Math.log(x.nN), x.gZ, Math.log(x.gN)] },
  R7_game: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.spr / 10, x.totC / 10, (x.totC / 10) ** 2, Math.abs(x.spr) / 10] : [0, 0, 0, 0, 0])) },
  R8_position: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.pos === 'G' ? 1 : 0, x.pos === 'C' ? 1 : 0, x.dPos || 0] : [0, 0, 0, 0])) },
  R9_posting: { cols: x => STATS.flatMap(s => (x.stat === s ? [1, x.nPl, x.nPl >= 6 ? 1 : 0, x.pgZ, x.lsz] : [0, 0, 0, 0, 0])) },
};
NAMED.R_all = { cols: x => Object.keys(NAMED).filter(k => NAMED[k].cols && k !== 'R_all').flatMap(k => NAMED[k].cols(x)) };
/* the held-out rivals, features F does not hold, fitted the candidate's way */
const HELD = {
  U1_band_by_month: x => { const b = bandOf(x.q); const c = []; for (let k = 1; k <= 6; k++) for (let m = 1; m <= 6; m++) c.push(b >= k && x.sm === m ? 1 : 0); return c; },
  U2_weekday: x => [1, 2, 3, 4, 5, 6].map(d => (x.dow === d ? 1 : 0)),
  U3_home_by_favourite: x => STATS.map(s => (x.stat === s ? (x.home || 0) * x.fav : 0)),
  U4_posted_margins: x => [x.nM * 10, x.gM * 10, x.pM * 10],
  U5_line_size_bands: null,                                     // set per split (training quintiles)
  U9_line_move: x => STATS.flatMap(s => (x.stat === s ? [x.dLine, x.noPrev] : [0, 0])),
  U11_schedule_density: x => STATS.flatMap(s => (x.stat === s ? [x.g3in4, x.rest >= 3 ? 1 : 0, x.oppRest >= 3 ? 1 : 0] : [0, 0, 0])),
};
function fitNamed(Ltr, R) {
  if (R.fixed) return R.fixed;
  const idx = Ltr.map((_, i) => i), y = Float64Array.from(Ltr, x => x.o), off = Float64Array.from(Ltr, x => x.zq);
  const X = S.design(idx, Ltr, R.cols), f = S.irls(X, y, off, 1); const b = Array.from(f.beta);
  return x => { const c = R.cols(x); let s = 0; for (let a = 0; a < c.length; a++) s += b[a] * c[a]; return s; };
}

function evaluate(name, Ltr, Lev, opts = {}) {
  log(`${name}: training ${Ltr.length}, evaluation ${Lev.length}`);
  const gEv = new Set(Lev.map(x => x.game)).size, Rfam = Lev.map(S.bigSparse), zcf = S.crossFitBig(Lev);
  log(`  family cross-fitted on the evaluation lines`);
  const res = { training: Ltr.length, evaluation: Lev.length, games: gEv, stand: {}, named: {}, namedAsCandidate: {}, held: {}, shuffled: [] };
  const crit = (nArr, nBoot = 10000) => {
    const t1 = S.T1big(Lev, nArr, Rfam), t2 = S.T2(Lev, nArr, zcf, nBoot);
    const byStat = {}; for (const s of STATS) { const ix = Lev.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0);
      const z = S.T2(ix.map(i => Lev[i]), Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => zcf[i]), 2000); byStat[s] = { ll: z.ll, llCi: z.llCi }; }
    const worstStatLo = Math.max(...Object.values(byStat).map(v => v.llCi[0]));
    const t1met = !t1.collinear && t1.orth >= ORTH_MIN && t1.lo > B_MIN, t2met = t2.llCi[1] < -M_LL && t2.brCi[1] < -M_BR && worstStatLo <= 0;
    return { t1, t2: { ll: t2.ll, llCi: t2.llCi, llSE: t2.llSE, br: t2.br, brCi: t2.brCi, brSE: t2.brSE }, byStat, met: { T1: t1met, T2: t2met },
      marginT1: t1.collinear ? null : B_MIN - t1.lo, marginT2: t2.llCi[1] + M_LL,
      power: t1.collinear ? null : { T1: S.powerT1(t1.b, t1.se, gEv, G_TEST, B_MIN), T1_G900: S.powerT1(t1.b, t1.se, gEv, G_TEST_LO, B_MIN), T1_halfEffect: S.powerT1(t1.b / 2, t1.se, gEv, G_TEST, B_MIN),
        T2ll: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST, M_LL), T2ll_G900: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST_LO, M_LL), T2ll_halfEffect: S.powerT2(t2.ll / 2, t2.llSE, gEv, G_TEST, M_LL),
        T2br: S.powerT2(t2.br, t2.brSE, gEv, G_TEST, M_BR), T2br_halfEffect: S.powerT2(t2.br / 2, t2.brSE, gEv, G_TEST, M_BR) } };
  };
  const say = (k, c) => log(`  ${k}: T1 ${c.t1.collinear ? `no b (in the family's span, orth ${c.t1.orth == null ? "-" : c.t1.orth.toExponential(1)})` : `b ${c.t1.b.toFixed(3)} [${c.t1.lo.toFixed(3)}, ${c.t1.hi.toFixed(3)}] orth ${c.t1.orth.toExponential(1)}`} ${c.met.T1 ? 'MET' : 'not met'} | T2 ll ${c.t2.ll.toExponential(2)} [${c.t2.llCi.map(v => v.toExponential(2)).join(', ')}] br ${c.t2.br.toExponential(2)} ${c.met.T2 ? 'MET' : 'not met'}`);
  /* the candidate's own information-free part alone (frozen on training): its level against q, its calibration */
  const eOnly = S.fitEBig(Ltr);
  res.eFrozenLessQ = S.T2(Lev, Float64Array.from(Lev, x => eOnly(x) - x.zq), Float64Array.from(Lev, x => x.zq));
  for (const [k, featf] of Object.entries(STAND)) {
    const fz = S.fitNudgeBig(Ltr, featf), nArr = Float64Array.from(Lev, fz.nud), c = crit(nArr);
    c.w = fz.w; const ma = Lev.map(x => fz.eOf(x) + fz.nud(x));
    c.maLessQ = S.T2(Lev, Float64Array.from(Lev, (x, i) => ma[i] - x.zq), Float64Array.from(Lev, x => x.zq));
    c.calib = {}; for (const s of STATS) { const ix = Lev.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0), Ls = ix.map(i => Lev[i]);
      c.calib[s] = { ma: S.calibOf(Ls, ix.map(i => ma[i])), q: S.calibOf(Ls, Ls.map(x => x.zq)) }; }
    res.stand[k] = c; say(k, c);
  }
  for (const [k, R] of Object.entries(NAMED)) { const f = fitNamed(Ltr, R), c = crit(Float64Array.from(Lev, f), 2000); res.named[k] = c; say(`named ${k} (on q)`, c); }
  /* the named rivals the candidate's way: those not in F's span only (R2's fixed rules are near it; R_all is in it) */
  for (const k of ['R2_mult', 'R2_power', 'R2_additive']) {
    const fz = S.fitNudgeBig(Ltr, x => STATS.map(s => (x.stat === s ? NAMED[k].fixed(x) : 0)));
    if (!fz) { res.namedAsCandidate[k] = { singular: true }; log(`  named ${k} (candidate's way): singular`); continue; }
    const c = crit(Float64Array.from(Lev, fz.nud), 2000); res.namedAsCandidate[k] = c; say(`named ${k} (candidate's way)`, c);
  }
  /* the held-out rivals */
  const qs = {}; for (const s of STATS) { const v = Ltr.filter(x => x.stat === s).map(x => x.line).sort((a, b) => a - b); qs[s] = [...new Set([0.2, 0.4, 0.6, 0.8].map(p => v[Math.floor(p * v.length)]))]; }
  const held = { ...HELD, U5_line_size_bands: x => STATS.flatMap(s => qs[s].map(c => (x.stat === s && x.line > c ? 1 : 0))) };
  for (const [k, featf] of Object.entries(held)) {
    const fz = S.fitNudgeBig(Ltr, featf);
    if (!fz) { res.held[k] = { singular: true }; log(`  held ${k}: singular`); continue; }
    const c = crit(Float64Array.from(Lev, fz.nud), 2000); c.w = fz.w; res.held[k] = c; say(`held ${k}`, c);
  }
  /* the stat-mix nudge, shuffled */
  const fz = S.fitNudgeBig(Ltr, STAND.S_mix), base = Float64Array.from(Lev, x => x.dMix);
  for (let sd = 1; sd <= (opts.shuffles || 20); sd++) {
    const perm = S.shuffleWithin(Lev, base, x => x.stat + '|' + x.month, sd), nArr = Float64Array.from(Lev, (x, i) => fz.w[STATS.indexOf(x.stat)] * perm[i]);
    const t1 = S.T1big(Lev, nArr, Rfam), t2 = S.T2(Lev, nArr, zcf, 2000);
    res.shuffled.push({ seed: sd, b: t1.b, lo: t1.lo, hi: t1.hi, ll: t2.ll, llHi: t2.llCi[1], br: t2.br, metT1: t1.lo > B_MIN, metT2: t2.llCi[1] < -M_LL });
  }
  const sh = res.shuffled;
  log(`  shuffled x${sh.length}: b ${Math.min(...sh.map(z => z.b)).toFixed(3)} to ${Math.max(...sh.map(z => z.b)).toFixed(3)} (lo at most ${Math.max(...sh.map(z => z.lo)).toFixed(3)}), T2 ${Math.min(...sh.map(z => z.ll)).toExponential(2)} to ${Math.max(...sh.map(z => z.ll)).toExponential(2)}; met T1 ${sh.filter(z => z.metT1).length}, T2 ${sh.filter(z => z.metT2).length}`);
  return res;
}

const out = { generated: 'PLAN.md sizing, round 2 (development data; the stand-in is tools/props.js\'s 2024 fold, fitted on 2022-23)', bar: { B_MIN, ORTH_MIN, M_LL, M_BR, G_TEST, G_TEST_LO }, family: S.NBIG, splits: {} };
const nights = [...new Set(G.map(x => x.date))].sort(), half = new Map(nights.map((d, i) => [d, i % 2]));
out.splits.chrono = evaluate('chronological (to 31 Jan | from 1 Feb)', G.filter(x => x.date < '2024-02-01'), G.filter(x => x.date >= '2024-02-01'));
out.splits.alternate0 = evaluate('alternate nights (A | B)', G.filter(x => half.get(x.date) === 0), G.filter(x => half.get(x.date) === 1), { shuffles: 10 });
out.splits.alternate1 = evaluate('alternate nights (B | A)', G.filter(x => half.get(x.date) === 1), G.filter(x => half.get(x.date) === 0), { shuffles: 10 });

/* the development bar's forward-chained protocol, on the union family */
{
  const months = ['2023-12', '2024-01', '2024-02', '2024-03', '2024-04'], oof = [], nud = { S_mix: [], S_d: [] }, eA = { S_mix: [], S_d: [] };
  for (const mo of months) {
    const tr = G.filter(x => x.month < mo), ev = G.filter(x => x.month === mo);
    const fzs = { S_mix: S.fitNudgeBig(tr, STAND.S_mix), S_d: S.fitNudgeBig(tr, STAND.S_d) };
    for (const x of ev) { oof.push(x); for (const k of ['S_mix', 'S_d']) { nud[k].push(fzs[k].nud(x)); eA[k].push(fzs[k].eOf(x)); } }
    log(`forward-chained: ${mo} from ${tr.length} earlier lines (S_mix w ${fzs.S_mix.w.map(v => v.toFixed(2)).join(' ')})`);
  }
  const Rfam = oof.map(S.bigSparse), zcf = S.crossFitBig(oof), gEv = new Set(oof.map(x => x.game)).size;
  out.forwardChained = { lines: oof.length, games: gEv };
  for (const k of ['S_mix', 'S_d']) {
    const nArr = Float64Array.from(nud[k]), t1 = S.T1big(oof, nArr, Rfam), t2 = S.T2(oof, nArr, zcf), ma = Float64Array.from(oof, (x, i) => eA[k][i] + nArr[i]);
    const calib = {}, byStat = {};
    for (const s of STATS) { const ix = oof.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0), Ls = ix.map(i => oof[i]);
      calib[s] = { ma: S.calibOf(Ls, ix.map(i => ma[i])), q: S.calibOf(Ls, Ls.map(x => x.zq)) };
      const z = S.T2(Ls, Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => zcf[i]), 2000); byStat[s] = { ll: z.ll, llCi: z.llCi }; }
    out.forwardChained[k] = { t1, t2, byStat, calib, maLessQ: S.T2(oof, Float64Array.from(oof, (x, i) => ma[i] - x.zq), Float64Array.from(oof, x => x.zq)),
      maLessToolsProps: S.T2(oof, Float64Array.from(oof, (x, i) => ma[i] - logit(x.pModel)), Float64Array.from(oof, x => logit(x.pModel)), 2000),
      power: { T1: S.powerT1(t1.b, t1.se, gEv, G_TEST, B_MIN), T1_halfEffect: S.powerT1(t1.b / 2, t1.se, gEv, G_TEST, B_MIN), T2ll: S.powerT2(t2.ll, t2.llSE, gEv, G_TEST, M_LL), T2ll_halfEffect: S.powerT2(t2.ll / 2, t2.llSE, gEv, G_TEST, M_LL), T2ll_G900_halfEffect: S.powerT2(t2.ll / 2, t2.llSE, gEv, G_TEST_LO, M_LL), T2br: S.powerT2(t2.br, t2.brSE, gEv, G_TEST, M_BR), T2br_halfEffect: S.powerT2(t2.br / 2, t2.brSE, gEv, G_TEST, M_BR) } };
    log(`  ${k} OOF: T1 b ${t1.b.toFixed(3)} [${t1.lo.toFixed(3)}, ${t1.hi.toFixed(3)}] | T2 ${t2.ll.toExponential(2)} [${t2.llCi.map(v => v.toExponential(2)).join(', ')}] br ${t2.br.toExponential(2)} [${t2.brCi.map(v => v.toExponential(2)).join(', ')}] | MA less q ${out.forwardChained[k].maLessQ.ll.toExponential(2)}`);
  }
}
/* the archive (spent): S_mix frozen on all of 2023-24 */
{
  const LA = S.load('archive').L; S.prepBig(LA);
  const A = S.graded(LA), zcf = S.crossFitBig(A), fz = S.fitNudgeBig(G, STAND.S_mix), nArr = Float64Array.from(A, fz.nud);
  out.archive = { lines: A.length, games: new Set(A.map(x => x.game)).size, wFull2024: fz.w, eFull2024: fz.eb, t1: S.T1big(A, nArr), t2: S.T2(A, nArr, zcf) };
  log(`archive S_mix (frozen on all of 2023-24, w ${fz.w.map(v => v.toFixed(2)).join(' ')}): T1 b ${out.archive.t1.b.toFixed(3)} [${out.archive.t1.lo.toFixed(3)}, ${out.archive.t1.hi.toFixed(3)}] | T2 ${out.archive.t2.ll.toExponential(2)} [${out.archive.t2.llCi.map(v => v.toExponential(2)).join(', ')}]`);
}
out.seconds = Math.round((Date.now() - t0) / 1000);
const file = path.join(S.ROOT, 'research', 'props_v3', 'results', 'plan_sizing2.json');
fs.writeFileSync(file, JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
log(`wrote ${path.relative(S.ROOT, file)}`);
