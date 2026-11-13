/* The development bar's reports beside its criteria (deciding nothing): MA's chance, DraftKings' fair chance,
 * tools/props.js's 2024 fold and props_v2's A on the same out-of-fold 2023-24 lines, by stat, by month and by side, the
 * calibration by band, and the blend's b by stat. Research only.
 *
 *   node research/props_v3/ma/dev_report.js   -> research/props_v3/results/ma_dev_report.json (about a minute)
 *
 * MA's chance is the forward-chained E + n of ma_dev_bar.json (cache/ma/dev_oof.json). "Side": the favoured side of
 * DraftKings' line (fair chance of the Over above one half) or not, and the player's club at home or away. Paired
 * differences against DraftKings' fair chance by the game bootstrap (2,000 resamples, seed 0). Aggregates only.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('./dev_lib.js');
const { S, T, STATS, mean, ll, br, sigm, logit } = V;
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const OO = JSON.parse(fs.readFileSync(path.join(V.M.CACHE, 'ma', 'dev_oof.json'), 'utf8'));
const refs = JSON.parse(fs.readFileSync(path.join(V.M.CACHE, 'ma', 'refs_2024.json'), 'utf8'));
const { L } = V.loadMA('2024');
const key = x => x.game + '|' + x.player + '|' + x.stat, byKey = new Map(L.map(x => [key(x), x]));
const oof = OO.keys.map(k => byKey.get(k));
const n = Float64Array.from(OO.n), e = Float64Array.from(OO.e), zcf = Float64Array.from(OO.zcf);
const Z = { MA: oof.map((x, i) => e[i] + n[i]), DraftKings: oof.map(x => x.zq), 'tools/props.js 2024 fold': oof.map(x => logit(refs[key(x)].tools)), "props_v2's A": oof.map(x => logit(refs[key(x)].A)) };
function block(sel) {
  const ix = oof.map((x, i) => (sel(x) ? i : -1)).filter(i => i >= 0); if (!ix.length) return null;
  const Ls = ix.map(i => oof[i]), o = { lines: ix.length, overRate: mean(Ls.map(x => x.o)) };
  for (const [k, z] of Object.entries(Z)) o[k] = { ll: mean(ix.map(i => ll(sigm(z[i]), oof[i].o))), br: mean(ix.map(i => br(sigm(z[i]), oof[i].o))), said: mean(ix.map(i => sigm(z[i]))) };
  const pr = V.paired(Ls, Float64Array.from(ix, i => Z.MA[i]), Float64Array.from(ix, i => Z.DraftKings[i]), 2000, 0); o.maLessDK = { ll: pr.ll, llCi: pr.llCi, br: pr.br, brCi: pr.brCi };
  const t2 = S.T2(Ls, Float64Array.from(ix, i => n[i]), Float64Array.from(ix, i => zcf[i]), 2000, 0); o.nudgeT2 = { ll: t2.ll, llCi: t2.llCi };
  return o;
}
const out = { what: "Reports beside the development bar (deciding nothing): MA, DraftKings' fair chance, tools/props.js's 2024 fold and props_v2's A on the same out-of-fold 2023-24 lines", all: block(() => true), byStat: {}, byMonth: {}, bySide: {}, calibrationBands: [], bByStat: {} };
for (const s of STATS) out.byStat[s] = block(x => x.stat === s);
for (const mo of V.MONTHS) out.byMonth[mo] = block(x => x.month === mo);
out.bySide.favoured = block(x => x.q > 0.5); out.bySide.notFavoured = block(x => x.q <= 0.5); out.bySide.home = block(x => x.home === 1); out.bySide.away = block(x => x.home === 0);
for (let k = 0; k < 10; k++) { const lo = k / 10, hi = (k + 1) / 10, b = { band: [lo, hi] };
  for (const [m, z] of Object.entries(Z)) { const ix = oof.map((x, i) => { const p = sigm(z[i]); return p >= lo && (p < hi || k === 9) ? i : -1; }).filter(i => i >= 0); b[m] = { n: ix.length, said: ix.length ? mean(ix.map(i => sigm(z[i]))) : null, hit: ix.length ? mean(ix.map(i => oof[i].o)) : null }; }
  out.calibrationBands.push(b); }
const Rfam = oof.map(S.bigSparse);
for (const s of STATS) { if (s === 'pts') { out.bByStat[s] = { weight: 0 }; continue; }
  /* the blend's b on one stat's lines: F + b n there, the robust interval */
  const ix = oof.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0), t1 = S.T1big(ix.map(i => oof[i]), Float64Array.from(ix, i => n[i]), ix.map(i => Rfam[i]));
  out.bByStat[s] = { b: t1.b, lo: t1.lo, hi: t1.hi, orth: t1.orth }; }
fs.writeFileSync(path.join(S.ROOT, 'research', 'props_v3', 'results', 'ma_dev_report.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
console.log(`all: MA ${out.all.MA.ll.toFixed(4)} DK ${out.all.DraftKings.ll.toFixed(4)} tools ${out.all['tools/props.js 2024 fold'].ll.toFixed(4)} A ${out.all["props_v2's A"].ll.toFixed(4)}; b by stat ${STATS.map(s => `${s} ${out.bByStat[s].b == null ? 0 : out.bByStat[s].b.toFixed(2)}`).join(' ')}`);
