/* PLAN.md's sizing checks, step 5: the cluster-robust interval on T1's b against the game-clustered bootstrap the test
 * will use (research only: SIZING). The stat-mix stand-in, chronological split, 400 resamples of the evaluation's games.
 *   node research/props_v3/plan_sizing/boot_check.js  -> research/props_v3/results/plan_bootcheck.json (a few minutes)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./lib.js');
const { L } = S.load('2024'); S.prepBig(L); const G = S.graded(L);
const tr = G.filter(x => x.date < '2024-02-01'), ev = G.filter(x => x.date >= '2024-02-01');
const fz = S.fitNudgeBig(tr, S.perStat(x => x.dMix)), nArr = Float64Array.from(ev, fz.nud);
const t1 = S.T1big(ev, nArr);
const R = ev.map(S.bigSparse), groups = S.T.groupBy(ev, x => x.game), rand = S.T.rng(17), bs = [];
for (let b = 0; b < 400; b++) {
  const idx = []; for (let j = 0; j < groups.length; j++) for (const i of groups[Math.floor(rand() * groups.length)]) idx.push(i);
  const rows = idx.map(i => ({ idx: [...R[i].idx, -1], val: [...R[i].val, nArr[i]] })), y = Float64Array.from(idx, i => ev[i].o);
  const f = S.sirls(rows, S.NBIG, 1, y, null, 1e-3, 30); if (f) bs.push(f.beta[S.NBIG]);
}
bs.sort((a, b) => a - b);
const out = { robust: { b: t1.b, lo: t1.lo, hi: t1.hi, se: t1.se }, bootstrap: { resamples: bs.length, lo: bs[Math.floor(0.05 * bs.length)], hi: bs[Math.floor(0.95 * bs.length)], sd: Math.sqrt(bs.reduce((s, v) => s + v * v, 0) / bs.length - (bs.reduce((s, v) => s + v, 0) / bs.length) ** 2) } };
fs.writeFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'plan_bootcheck.json'), JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toPrecision(6) : v), 1) + '\n');
console.log(JSON.stringify(out));
