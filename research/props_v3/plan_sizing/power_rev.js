/* PLAN.md's revision of 13 November 2026 (critiques C1 and C2): the power of the test and of the forward shadow, sized by
 * lines a game as well as games (research only: SIZING, no candidate).
 *
 *   node research/props_v3/plan_sizing/power_rev.js   -> research/props_v3/results/plan_power_rev.json (about 2 minutes)
 *
 * The stand-in nudge (S_mix, tools/props.js's 2024 fold: a size, never a candidate) in the development bar's
 * forward-chained protocol, December to April 2023-24, as size2.js builds it: its paired per-line differences in log loss
 * and Brier against F cross-fitted on the out-of-fold lines. A sample of G games with m lines a game is drawn from them:
 * each game drawn whole, each of its lines kept with chance m / (its lines a game), 20 draws at each size, seeded; the
 * cluster-robust standard errors of the two means averaged over the draws, then scaled to other G by sqrt(G0 / G). The
 * chance both T2 criteria are met at once (log loss below -M_LL and Brier below -M_BR, each 90% interval wholly beyond)
 * is drawn from a bivariate normal with the game sums' own correlation, 200,000 draws, seeded. T1's chance scales its
 * standard error by the square root of the lines (the more conservative of games and lines, for a sample with fewer
 * lines a game than the development lines).
 *
 * The test (PLAN.md 3.1): 74 graded lines a game, the rate props_v2's committed results/espn_validate40.json gives on
 * the 31 regular-season games of 2022-23 it read (2,305 graded; left out of the test, already disclosed), at 1,100 and
 * 900 games; also with the effect reweighted to that file's price mix (each stat's share of lines with a fair chance of
 * 40 to 60%, the cells stat x even or not, each cell's mean difference from the development lines): critique C2. That
 * file's 2022-23 rows are read for those two figures alone (lines a game, and the shares by stat), as the plan's
 * revision says; nothing else of 2022-23 is read.
 * The shadow (PLAN.md section 5): 56 graded lines a game (the six base stats of the job's 2026-27 reads, as PLAN.md
 * says), at 40,000 to 70,000 graded lines: critique C1.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./lib.js');
const { STATS, mean, ll, br, sigm } = S;
const T = S.T;
const B_MIN = 0.25, M_LL = 1e-4, M_BR = 5e-5;
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const { L } = S.load('2024'); S.prepBig(L); const G = S.graded(L);
const months = ['2023-12', '2024-01', '2024-02', '2024-03', '2024-04'], featf = S.perStat(x => x.dMix), oof = [], nud = [];
for (const mo of months) { const tr = G.filter(x => x.month < mo), ev = G.filter(x => x.month === mo), fz = S.fitNudgeBig(tr, featf); for (const x of ev) { oof.push(x); nud.push(fz.nud(x)); } }
const zcf = S.crossFitBig(oof), nArr = Float64Array.from(nud);
const dLL = oof.map((x, i) => ll(sigm(zcf[i] + nArr[i]), x.o) - ll(sigm(zcf[i]), x.o));
const dBR = oof.map((x, i) => br(sigm(zcf[i] + nArr[i]), x.o) - br(sigm(zcf[i]), x.o));
const t1 = S.T1big(oof, nArr);
const byGame = T.groupBy(oof, x => x.game), G0 = byGame.length, N0 = oof.length, perGame0 = N0 / G0;
const seMean = (ix, d) => { const s = new Map(), c = new Map(); for (const i of ix) { const g = oof[i].game; s.set(g, (s.get(g) || 0) + d[i]); c.set(g, (c.get(g) || 0) + 1); }
  const N = ix.length; let mu = 0; for (const i of ix) mu += d[i]; mu /= N; let v = 0; for (const [g, a] of s) v += (a - mu * c.get(g)) ** 2; const n = s.size; return Math.sqrt(v * n / (n - 1)) / N; };
const corrSums = (() => { const a = byGame.map(g => g.reduce((s, i) => s + dLL[i], 0)), b = byGame.map(g => g.reduce((s, i) => s + dBR[i], 0)), ma = mean(a), mb = mean(b);
  let c = 0, va = 0, vb = 0; for (let k = 0; k < a.length; k++) { c += (a[k] - ma) * (b[k] - mb); va += (a[k] - ma) ** 2; vb += (b[k] - mb) ** 2; } return c / Math.sqrt(va * vb); })();
/* the standard errors of the two means at m lines a game, from 20 seeded draws of G0 games' lines kept at m / perGame */
function seAt(m) {
  const R = T.rng(1000 + Math.round(m)), out = [];
  for (let rep = 0; rep < 20; rep++) { const keep = []; for (const g of byGame) { const p = Math.min(1, m / g.length); for (const i of g) if (R() < p) keep.push(i); }
    out.push([seMean(keep, dLL), seMean(keep, dBR), keep.length]); }
  return { ll: mean(out.map(z => z[0])), br: mean(out.map(z => z[1])), lines: mean(out.map(z => z[2])), games: G0 };
}
const Phi = S.PM.normCdf;
function jointPower(muLL, muBR, seLL, seBR, rho, seed) {
  const R = T.rng(seed), gauss = () => { const u = R(), v = R(); return Math.sqrt(-2 * Math.log(u + 1e-300)) * Math.cos(2 * Math.PI * v); };
  let hit = 0; const n = 200000;
  for (let k = 0; k < n; k++) { const z1 = gauss(), z2 = rho * z1 + Math.sqrt(1 - rho * rho) * gauss(); if (muLL + seLL * z1 + 1.645 * seLL < -M_LL && muBR + seBR * z2 + 1.645 * seBR < -M_BR) hit++; }
  return hit / n;
}
const muLL = mean(dLL), muBR = mean(dBR);
function sized(m, G, f, effLL = muLL, effBR = muBR, seed = 7) {
  const s = seAt(m), k = Math.sqrt(s.games / G), seLL = s.ll * k, seBR = s.br * k, lines = m * G;
  const t1se = t1.se * Math.sqrt(N0 / lines) * Math.max(1, Math.sqrt((G0 / G) / (N0 / lines)));
  return { linesPerGame: m, games: G, lines: Math.round(lines), effectFraction: f, seLL, seBR,
    T2ll: Phi((-M_LL - f * effLL) / seLL - 1.645), T2br: Phi((-M_BR - f * effBR) / seBR - 1.645), T2joint: jointPower(f * effLL, f * effBR, seLL, seBR, corrSums, seed),
    T1: Phi((f * t1.b - B_MIN) / t1se - 1.645) };
}
/* C2: the 2022-23 price mix of props_v2's committed 31 games (already seen, disclosed), stat x (fair chance 40-60%) */
const V = JSON.parse(fs.readFileSync(path.join(S.ROOT, 'research', 'props_v2', 'results', 'espn_validate40.json'), 'utf8')).groups['2023 regular season'];
const perGame23 = V.graded / V.games;
const even = x => x.q >= 0.4 && x.q <= 0.6;
const cells = {}; for (const s of STATS) for (const e of [1, 0]) { const ix = oof.map((x, i) => (x.stat === s && (even(x) ? 1 : 0) === e ? i : -1)).filter(i => i >= 0); cells[s + e] = { n: ix.length, ll: mean(ix.map(i => dLL[i])), br: mean(ix.map(i => dBR[i])) }; }
let wl = 0, wb = 0, ws = 0; for (const s of STATS) { const n = V.byStatScores[s].n, sh = V.byStatScores[s].shareFair40to60; for (const [e, p] of [[1, sh], [0, 1 - sh]]) { const w = n * p; if (!cells[s + e].n) continue; wl += w * cells[s + e].ll; wb += w * cells[s + e].br; ws += w; } }
const rwLL = wl / ws, rwBR = wb / ws;
const out = { generated: 'PLAN.md revision of 13 November 2026, critiques C1 and C2 (development data; the stand-in is tools/props.js\'s 2024 fold, a size, never a candidate)',
  oof: { lines: N0, games: G0, linesPerGame: perGame0, ll: muLL, br: muBR, llSE: seMean(oof.map((_, i) => i), dLL), brSE: seMean(oof.map((_, i) => i), dBR), corrGameSums: corrSums, t1: { b: t1.b, se: t1.se } },
  cellsStatEven: cells, reweighted2023: { linesPerGame2023: perGame23, ll: rwLL, br: rwBR, fractionLL: rwLL / muLL, fractionBR: rwBR / muBR },
  test: [], testReweighted: [], shadow: [], shadowGamesOnlyAsPlanned: null };
for (const Gt of [1100, 900]) for (const f of [1, 0.5]) { out.test.push(sized(perGame23, Gt, f)); out.testReweighted.push(sized(perGame23, Gt, f, rwLL, rwBR)); }
for (const lines of [40000, 50000, 60000, 65000, 70000]) for (const f of [1, 0.5]) out.shadow.push(sized(56, Math.round(lines / 56), f));
/* the plan as written scaled the full-sample standard error by games alone (863 to 714) */
{ const k = Math.sqrt(G0 / 714), seLL = seMean(oof.map((_, i) => i), dLL) * k, seBR = seMean(oof.map((_, i) => i), dBR) * k;
  out.shadowGamesOnlyAsPlanned = { games: 714, T2ll: Phi((-M_LL - muLL / 2) / seLL - 1.645), T2br: Phi((-M_BR - muBR / 2) / seBR - 1.645) }; }
const file = path.join(S.ROOT, 'research', 'props_v3', 'results', 'plan_power_rev.json');
fs.writeFileSync(file, JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
const f3 = v => v.toFixed(3);
console.log(`oof ${N0} lines on ${G0} games (${perGame0.toFixed(1)} a game); ll ${muLL.toExponential(3)} br ${muBR.toExponential(3)}; corr ${f3(corrSums)}`);
console.log(`reweighted to 2022-23's mix (${perGame23.toFixed(1)} graded a game): ll ${rwLL.toExponential(3)} (${f3(rwLL / muLL)}) br ${rwBR.toExponential(3)} (${f3(rwBR / muBR)})`);
for (const [k, a] of [['test', out.test], ['test reweighted', out.testReweighted], ['shadow', out.shadow]]) for (const z of a) console.log(`${k}: ${z.games} games x ${z.linesPerGame.toFixed(1)} = ${z.lines} lines, effect x${z.effectFraction}: T1 ${f3(z.T1)} T2 ll ${f3(z.T2ll)} br ${f3(z.T2br)} joint ${f3(z.T2joint)}`);
console.log('as planned (games only, 714):', JSON.stringify(out.shadowGamesOnlyAsPlanned));
