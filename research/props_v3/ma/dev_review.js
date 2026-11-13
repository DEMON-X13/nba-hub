/* The review of 13 November 2026: its statistical findings checked with this folder's own code, on development data and
 * the spent archive. Research only. Nothing here decides a criterion of the bar: every number is context for one the bar
 * already decided, or a reading the write-up must say more carefully.
 *
 *   node research/props_v3/ma/dev_review.js   -> research/props_v3/results/ma_dev_review.json (about 10 minutes)
 *
 *   S1  D8's T2 on the archive's 83 games, F cross-fitted on 40 other random game partitions into 5 folds (each game's
 *       fold drawn uniformly, seeded), on 10 folds (the bar's hash mod 10) and one game at a time (83 folds); the bar's
 *       own partition (the game id's FNV-1a hash mod 5) given back first, to the digit, as a check of the code; F's
 *       cross-fitted log loss on the archive against DraftKings' fair chance and MA's frozen chance; and the same
 *       partition spread of T2 on the 68,850 development lines (10 random partitions).
 *   S2  D2 by stat: the 90% intervals (10,000 game resamples) by seed 0, which must give back ma_dev_bar.json's, and by
 *       seed 1, and the intervals corrected for testing five stats (Bonferroni: 98%, the 1st and 99th percentiles) and
 *       six (98.33%).
 *   N1  D5's ten-band reliability tables per stat (ma_dev_bar.json): each stat's worst band with 100 lines or more, MA's
 *       mean chance less its Over rate and that gap over its binomial standard error.
 *   N2  E alone against DraftKings' fair chance, both scores' intervals (ma_dev_bar.json, as committed).
 *   F5  D7's minutes surprise (dev_leaks.js step 5's own construction, which must give back its 0.028): a game-clustered
 *       bootstrap interval of the correlation (2,000 resamples, seed 0), and the same for the level's.
 * Every number written is an aggregate.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('./dev_lib.js');
const M = require('./ma_lib.js');
const { S, T, STATS, mean, ll, sigm, PM } = V;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const RES = f => path.join(S.ROOT, 'research', 'props_v3', 'results', f);
const DB = JSON.parse(fs.readFileSync(RES('ma_dev_bar.json'), 'utf8'));
const LK = JSON.parse(fs.readFileSync(RES('ma_dev_leaks.json'), 'utf8'));
const AR = JSON.parse(fs.readFileSync(RES('ma_dev_archive.json'), 'utf8'));
const OO = JSON.parse(fs.readFileSync(path.join(M.CACHE, 'ma', 'dev_oof.json'), 'utf8'));
const out = { what: "the review of 13 November 2026's statistical findings, checked (development data and the spent archive; context, deciding nothing)" };

/* crossFitBig with the folds handed in (a game id's fold), its arithmetic otherwise plan_sizing/lib.js's own */
function crossFitWith(Lev, foldOfGame, K, lam = 5) {
  const z = new Float64Array(Lev.length), R = Lev.map(S.bigSparse);
  for (let k = 0; k < K; k++) {
    const tr = [], te = []; Lev.forEach((x, i) => (foldOfGame(x.game) === k ? te : tr).push(i));
    if (!te.length) continue;
    const f = S.sirls(tr.map(i => R[i]), S.NBIG, 0, Float64Array.from(tr, i => Lev[i].o), null, lam, 60, null, a => a % S.PER === 0 && a < STATS.length * S.PER);
    for (const i of te) { let s = 0; const r = R[i]; for (let q = 0; q < r.idx.length; q++) s += f.beta[r.idx[q]] * r.val[q]; z[i] = s; }
  }
  return z;
}
const t2Point = (Lev, n, z) => mean(Lev.map((x, i) => ll(sigm(z[i] + n[i]), x.o) - ll(sigm(z[i]), x.o)));
const randomFolds = (Lev, K, seed) => { const ids = [...new Set(Lev.map(x => x.game))].sort(), R = T.rng(seed), m = new Map(ids.map(g => [g, Math.floor(R() * K)])); return g => m.get(g); };
const spread = a => { const mu = mean(a); return { partitions: a.length, mean: mu, sd: Math.sqrt(a.reduce((s, v) => s + (v - mu) ** 2, 0) / (a.length - 1)), min: Math.min(...a), max: Math.max(...a), shareAbove0: a.filter(v => v > 0).length / a.length }; };

/* ---------- S1: the archive ---------- */
{
  const feat = V.featFinal(DB.final), G = V.sample(V.loadMA('2024').L), fz = S.fitNudgeBig(G, feat);
  const A = V.sample(V.loadMA('archive').L), nArr = Float64Array.from(A, fz.nud);
  const zBar = S.crossFitBig(A), zMine = crossFitWith(A, g => S.foldOf(g, 5), 5);
  if (zBar.some((v, i) => v !== zMine[i])) throw new Error('crossFitWith does not give back crossFitBig on the bar\'s own partition');
  const t2bar = t2Point(A, nArr, zBar);
  if (r6(t2bar) !== AR.t2.ll) throw new Error(`the bar's own partition: ${t2bar}, ma_dev_archive.json's ${AR.t2.ll}`);
  log(`S1 archive: ${A.length} lines on ${new Set(A.map(x => x.game)).size} games; the bar's partition gives back T2 ${t2bar.toExponential(4)}`);
  const rnd = []; for (let p = 0; p < 40; p++) rnd.push(t2Point(A, nArr, crossFitWith(A, randomFolds(A, 5, 1000 + p), 5)));
  const ids = [...new Set(A.map(x => x.game))].sort(), pos = new Map(ids.map((g, i) => [g, i]));
  const t2K10 = t2Point(A, nArr, crossFitWith(A, g => S.foldOf(g, 10), 10)), t2LOGO = t2Point(A, nArr, crossFitWith(A, g => pos.get(g), ids.length));
  const eMA = Float64Array.from(A, (x, i) => fz.eOf(x) + nArr[i]);
  const llOf = z => mean(A.map((x, i) => ll(sigm(z[i]), x.o)));
  out.S1 = { archive: { lines: A.length, games: ids.length, barPartition: { K: 5, rule: "the game id's FNV-1a hash mod 5", t2: t2bar },
    random5: spread(rnd), K10: { rule: 'the hash mod 10', t2: t2K10 }, leaveOneGameOut: { K: ids.length, t2: t2LOGO },
    logLoss: { crossFittedF: llOf(zBar), draftKingsFair: llOf(Float64Array.from(A, x => x.zq)), maFrozen: llOf(eMA), fLessDraftKings: llOf(zBar) - llOf(Float64Array.from(A, x => x.zq)) } } };
  log(`S1 archive: 40 random 5-fold partitions: T2 mean ${out.S1.archive.random5.mean.toExponential(3)} sd ${out.S1.archive.random5.sd.toExponential(3)}, range ${out.S1.archive.random5.min.toExponential(2)} to ${out.S1.archive.random5.max.toExponential(2)}, above 0 on ${(out.S1.archive.random5.shareAbove0 * 100).toFixed(1)}%; K=10 ${t2K10.toExponential(3)}; one game at a time ${t2LOGO.toExponential(3)}`);
  log(`S1 archive log loss: F cross-fitted ${out.S1.archive.logLoss.crossFittedF.toFixed(4)}, DraftKings' fair chance ${out.S1.archive.logLoss.draftKingsFair.toFixed(4)}, MA frozen ${out.S1.archive.logLoss.maFrozen.toFixed(4)}`);
}
/* the development lines, in dev_oof.json's order */
const { L } = V.loadMA('2024');
const byKey = new Map(L.map(x => [x.game + '|' + x.player + '|' + x.stat, x]));
const oof = OO.keys.map(k => byKey.get(k));
if (oof.some(x => !x || x.status !== 'graded')) throw new Error('dev_oof.json\'s keys are not graded development lines');
const nOof = Float64Array.from(OO.n), zOof = Float64Array.from(OO.zcf);
{
  const zMine = crossFitWith(oof, g => S.foldOf(g, 5), 5);
  if (zMine.some((v, i) => Math.abs(v - zOof[i]) > 1e-12)) throw new Error('crossFitWith does not give back dev_oof.json\'s cross-fitted F');
  const rnd = []; for (let p = 0; p < 10; p++) rnd.push(t2Point(oof, nOof, crossFitWith(oof, randomFolds(oof, 5, 2000 + p), 5)));
  out.S1.development = { lines: oof.length, games: new Set(oof.map(x => x.game)).size, barPartition: { t2: t2Point(oof, nOof, zOof) }, random5: spread(rnd) };
  log(`S1 development: the bar's partition T2 ${out.S1.development.barPartition.t2.toExponential(4)}; 10 random partitions sd ${out.S1.development.random5.sd.toExponential(3)}, range ${out.S1.development.random5.min.toExponential(3)} to ${out.S1.development.random5.max.toExponential(3)}`);
}

/* ---------- S2: D2 by stat, seeds and multiplicity ---------- */
/* plan_sizing's clusterBootMean, its draws verbatim, returning every resample's mean (sorted) */
function bootVals(groups, d, nBoot, seed) {
  const gs = groups.map(g => { let s = 0; for (const i of g) s += d[i]; return [s, g.length]; });
  const R = T.rng(seed), n = gs.length, vals = new Float64Array(nBoot);
  for (let b = 0; b < nBoot; b++) { let s = 0, c = 0; for (let j = 0; j < n; j++) { const g = gs[Math.floor(R() * n)]; s += g[0]; c += g[1]; } vals[b] = s / c; }
  return vals.sort();
}
const qOf = (v, p) => v[Math.floor(p * v.length)];
out.S2 = { what: "D2 by stat, the nudge's paired log-loss difference a line: 90% intervals by seed 0 (ma_dev_bar.json's) and seed 1; Bonferroni intervals for five stats (98%) and six (98.33%)", byStat: {} };
for (const s of STATS) {
  const ix = oof.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0), Ls = ix.map(i => oof[i]);
  const d = ix.map(i => ll(sigm(zOof[i] + nOof[i]), oof[i].o) - ll(sigm(zOof[i]), oof[i].o)), groups = T.groupBy(Ls, x => x.game);
  const v0 = bootVals(groups, d, 10000, 0), v1 = bootVals(groups, d, 10000, 1);
  const ci90s0 = [qOf(v0, 0.05), qOf(v0, 0.95)];
  const want = DB.D2.byStat[s].llCi;
  if (r6(ci90s0[0]) !== want[0] || r6(ci90s0[1]) !== want[1]) throw new Error(`D2 by stat ${s}: [${ci90s0}] against ma_dev_bar.json's [${want}]`);
  out.S2.byStat[s] = { lines: Ls.length, ll: mean(d), ci90seed0: ci90s0, ci90seed1: [qOf(v1, 0.05), qOf(v1, 0.95)], ci98seed0: [qOf(v0, 0.01), qOf(v0, 0.99)], ci9833seed0: [qOf(v0, 0.1 / 12), qOf(v0, 1 - 0.1 / 12)], ci98seed1: [qOf(v1, 0.01), qOf(v1, 0.99)] };
  const z = out.S2.byStat[s];
  log(`S2 ${s}: ${(z.ll * 1e4).toFixed(1)} x1e-4; 90% seed 0 [${z.ci90seed0.map(v => (v * 1e4).toFixed(1))}], seed 1 [${z.ci90seed1.map(v => (v * 1e4).toFixed(1))}]; 98% [${z.ci98seed0.map(v => (v * 1e4).toFixed(1))}] (seed 1 [${z.ci98seed1.map(v => (v * 1e4).toFixed(1))}]); 98.33% [${z.ci9833seed0.map(v => (v * 1e4).toFixed(1))}]`);
}
out.S2.clearAfterCorrection = STATS.filter(s => out.S2.byStat[s].ll !== 0 && out.S2.byStat[s].ci98seed0[1] < 0 && out.S2.byStat[s].ci98seed1[1] < 0 && out.S2.byStat[s].ci9833seed0[1] < 0);

/* ---------- N1: per-stat reliability bands ---------- */
out.N1 = { what: "D5's ten-band tables: each stat's worst band of 100 lines or more, MA's mean chance less its Over rate (points), and that over the band's binomial standard error", byStat: {} };
for (const s of STATS) {
  const bands = DB.D5.byStat[s].bands.filter(b => b.ma.n >= 100).map(b => ({ band: b.band, lines: b.ma.n, saidLessHit: 100 * (b.ma.said - b.ma.hit), seUnits: (b.ma.said - b.ma.hit) / Math.sqrt(b.ma.said * (1 - b.ma.said) / b.ma.n) }));
  bands.sort((a, b) => Math.abs(b.saidLessHit) - Math.abs(a.saidLessHit));
  out.N1.byStat[s] = bands[0];
}
log(`N1: ${STATS.map(s => `${s} ${out.N1.byStat[s].band.join('-')} (${out.N1.byStat[s].lines}) ${out.N1.byStat[s].saidLessHit.toFixed(2)} pts, ${out.N1.byStat[s].seUnits.toFixed(1)} SE`).join('; ')}`);

/* ---------- N2: E alone ---------- */
out.N2 = { eAloneLessDraftKings: DB.reportEaloneLessDK };

/* ---------- F5: the minutes surprise's interval ---------- */
{
  const P = JSON.parse(fs.readFileSync(RES('ma_p23.json'), 'utf8')).P, D = M.loadData();
  const Rr = PM.replay(D.games, D.boxes, D.tbox, { collect: true, from: 2024 }), rows24 = Rr.rows.filter(r => r.season === 2024);
  const mins = PM.backtestMinutes(rows24, PM.sidesOf(rows24), P.min, () => true), mproj = new Map(rows24.map((r, i) => [r.game + '|' + r.id, mins[i]]));
  /* dev_leaks.js step 5, its construction verbatim: per player-game the mean nudge, the minutes played less P23's
     projection, and the level */
  const G = V.sample(L), key = x => x.game + '|' + x.player + '|' + x.stat, oofN = new Map(OO.keys.map((k, i) => [k, OO.n[i]]));
  const sel = G.filter(x => oofN.has(key(x)));
  const pg = new Map(); for (const x of sel) { const mp = mproj.get(x.game + '|' + x.player); if (mp == null) continue; const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, { game: x.game, n: [], s: x.minPlayed - mp, k: x.kap }); pg.get(k).n.push(oofN.get(key(x))); }
  const a = [...pg.values()].map(v => ({ game: v.game, u: mean(v.n), s: v.s, k: v.k }));
  const corr = (ix, f) => { const u = ix.map(i => f(a[i])), v = ix.map(i => a[i].s), mu = mean(u), mv = mean(v); let c = 0, su = 0, sv = 0; for (let i = 0; i < u.length; i++) { c += (u[i] - mu) * (v[i] - mv); su += (u[i] - mu) ** 2; sv += (v[i] - mv) ** 2; } return c / Math.sqrt(su * sv); };
  const all = a.map((_, i) => i), rN = corr(all, z => z.u), rK = corr(all, z => z.k);
  if (r6(rN) !== LK.minutesSurprise.corrNudge || a.length !== LK.minutesSurprise.playerGames) throw new Error(`the minutes surprise: ${rN} on ${a.length}, ma_dev_leaks.json's ${LK.minutesSurprise.corrNudge} on ${LK.minutesSurprise.playerGames}`);
  const groups = T.groupBy(a, z => z.game), R = T.rng(0), bN = [], bK = [];
  for (let b = 0; b < 2000; b++) { const ix = []; for (let j = 0; j < groups.length; j++) for (const i of groups[Math.floor(R() * groups.length)]) ix.push(i); bN.push(corr(ix, z => z.u)); bK.push(corr(ix, z => z.k)); }
  bN.sort((x, y) => x - y); bK.sort((x, y) => x - y);
  out.F5 = { playerGames: a.length, games: groups.length, corrNudge: rN, corrNudgeCi90: [bN[100], bN[1900]], corrLevel: rK, corrLevelCi90: [bK[100], bK[1900]], resamples: 2000 };
  log(`F5 minutes surprise: ${a.length} player-games on ${groups.length} games; nudge ${rN.toFixed(4)} [${bN[100].toFixed(4)}, ${bN[1900].toFixed(4)}]; level ${rK.toFixed(4)} [${bK[100].toFixed(4)}, ${bK[1900].toFixed(4)}]`);
}
out.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(RES('ma_dev_review.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
log('wrote results/ma_dev_review.json');
