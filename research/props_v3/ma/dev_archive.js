/* D8: the archive, a sign check (PLAN.md section 2). Research only.
 *
 *   node research/props_v3/ma/dev_archive.js   -> research/props_v3/results/ma_dev_archive.json (about a minute)
 *
 * MA frozen on all of 2023-24 (the final nudge of ma_dev_bar.json, its weights fitted jointly with F on every graded
 * development line, E with the frozen nudge as an offset) and applied to DraftKings' 2026 play-in and playoff archive
 * (data/props_2026.csv's six base stats: SPENT, a sign only). On the archive's graded lines in the sample, F fitted on
 * them: T1's b point estimate must be above 0 and T2's log-loss point estimate at or below 0 (F cross-fitted on them).
 * The intervals are reported, deciding nothing. Aggregates only.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('./dev_lib.js');
const { S, STATS } = V;
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const DB = JSON.parse(fs.readFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_bar.json'), 'utf8'));
const feat = V.featFinal(DB.final);
const G = V.sample(V.loadMA('2024').L), fz = S.fitNudgeBig(G, feat);
const A = V.sample(V.loadMA('archive').L);
const nArr = Float64Array.from(A, fz.nud), zcf = S.crossFitBig(A), t1 = S.T1big(A, nArr), t2 = S.T2(A, nArr, zcf);
const byStat = {}; for (const s of STATS) { const ix = A.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0); const z = S.T2(ix.map(i => A[i]), Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => zcf[i]), 2000); byStat[s] = { lines: ix.length, ll: z.ll, llCi: z.llCi }; }
const out = { what: 'D8: MA frozen on all of 2023-24, on the spent 2026 play-in and playoff archive (a sign check)', frozenOn: G.length, wFull2024: fz.w, eFull2024: fz.eb,
  archive: { lines: A.length, games: new Set(A.map(x => x.game)).size }, t1: { b: t1.b, lo: t1.lo, hi: t1.hi, orth: t1.orth }, t2: { ll: t2.ll, llCi: t2.llCi, br: t2.br, brCi: t2.brCi }, byStat };
out.met = t1.b > 0 && t2.ll <= 0;
fs.writeFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_archive.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
console.log(`D8 archive: ${A.length} lines on ${out.archive.games} games; T1 b ${t1.b.toFixed(3)} [${t1.lo.toFixed(3)}, ${t1.hi.toFixed(3)}] | T2 ${t2.ll.toExponential(3)} [${t2.llCi.map(v => v.toExponential(2))}]: ${out.met ? 'met' : 'NOT met'}`);
