/* Planted in-game prices (PLAN.md D9, critique C7): does V4 react at the contamination V2 lets through? Research only,
 * on the 2023-24 development lines.
 *
 *   node research/props_v3/test/plant_ingame.js   -> research/props_v3/results/ma_plant_ingame.json (about 3 minutes)
 *
 * At a share (0, 10% and 20%) of the out-of-fold player-games, drawn with a seed, one of the player's posted stats is
 * repriced as a price read a quarter of the way into the game would be (props_v2's validity_calib.js rule: DraftKings'
 * own pre-game distribution, a negative binomial on the naive forecaster's spread curve, here fitted on 2021-22, its mean
 * solved so that its chance of the Over is DraftKings' fair chance; his stat so far a binomial share of his final stat, a
 * quarter of his minutes or all of them if his night ended before then, at minutes played over P23's projected minutes;
 * the rest of his game at the pre-game rate; a night that ended known done; the exact expectation over the draw), the
 * margin kept, his other lines left as they were. Then the player-game's level and mix are worked again (ma_lib.js
 * mixOf), F's per-line fields again over every posted line (dev_lib.js derive), and the frozen forward-chained nudge
 * applied. Reported at each share: V2's figure (DraftKings' fair chance on early exits less the rest, validity.js's
 * lines: projected 24+, played the previous game), V4's (the nudge's mean move of DraftKings' fair chance toward the
 * Under on early exits more than elsewhere), and a candidate check V4b (the nudge's mean gain in log loss on early exits
 * less its gain elsewhere, against F cross-fitted on the lines), and the nudge's T2. No 2022-23 line is read. Aggregates
 * only.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const V = require('../ma/dev_lib.js');
const M = require('../ma/ma_lib.js');
const { S, T, STATS, mean, ll, br, sigm, logit, PM } = V;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const P = JSON.parse(fs.readFileSync(path.join(M.ROOT, 'research', 'props_v3', 'results', 'ma_p23.json'), 'utf8')).P;
const OO = JSON.parse(fs.readFileSync(path.join(M.CACHE, 'ma', 'dev_oof.json'), 'utf8'));
const fin = OO.final, feat = V.featFinal(fin), W = new Map(fin.weights.map(z => [z.month, z]));
const nudOf = x => { const z = W.get(x.month), f = feat(x); let s = 0; for (let a = 0; a < f.length; a++) s += z.w[a] * f[a]; return s; };
const TAU = 0.25, clip99 = p => Math.min(0.99, Math.max(0.01, p));
/* P23's projected minutes on the box's list (V2's rule) and the naive spread on 2021-22 */
const D = M.loadData();
const Rr = PM.replay(D.games, D.boxes, D.tbox, { collect: true, from: 2022 });
const NV = PM.fitNaiveVar(Rr.rows, r => r.season === 2022);
const rows24 = Rr.rows.filter(r => r.season === 2024), mins = PM.backtestMinutes(rows24, PM.sidesOf(rows24), P.min, () => true);
const mproj = new Map(rows24.map((r, i) => [r.game + '|' + r.id, mins[i]]));
/* did he play his side's previous game of the season (validity_lib.js previousPlayed's rule) */
const prevOf = (() => { const out = new Map(), bySide = new Map();
  for (const g of D.games) if (g.status === 'final' && D.boxes[g.game_id] && g.season === 2024) for (const t of [g.home, g.away]) { const k = t; if (!bySide.has(k)) bySide.set(k, []); bySide.get(k).push(g); }
  for (const [t, list] of bySide) { list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); let prev = null; for (const g of list) { const now = new Set((D.boxes[g.game_id][t] || []).filter(r => r.min > 0 && !r.dnp).map(r => r.id)); for (const id of now) out.set(g.game_id + '|' + id, prev ? prev.has(id) : null); prev = now; } }
  return out; })();
const binom = (n, s) => { const out = new Array(n + 1).fill(0); if (s <= 0) { out[0] = 1; return out; } if (s >= 1) { out[n] = 1; return out; } let p = Math.pow(1 - s, n); out[0] = p; for (let j = 0; j < n; j++) { p *= (n - j) / (j + 1) * s / (1 - s); out[j + 1] = p; } return out; };
function mu0Of(x) { const k = Math.floor(x.line) + 1, v = NV[x.stat], f = mu => PM.nbSf(k, mu, PM.nbVar(mu, v)); let lo = 1e-4, hi = 300; if (f(hi) < x.q) return hi; if (f(lo) > x.q) return lo; for (let i = 0; i < 80; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) < x.q) lo = mid; else hi = mid; } return Math.sqrt(lo * hi); }
function planted(x) {
  const m = mproj.get(x.game + '|' + x.player), e = m > 0 ? Math.min(1, x.minPlayed / m) : 1, k = Math.floor(x.line) + 1, y = Math.round(x.y);
  if (e < 1 && TAU >= e) return clip99(x.y > x.line ? 1 : 0);
  const s = Math.min(1, TAU / e), muR = Math.max(mu0Of(x) * (1 - TAU), 1e-9), v = NV[x.stat], b = binom(y, s);
  let p = 0; for (let j = 0; j <= y; j++) if (b[j]) p += b[j] * clip99(PM.nbSf(k - j, muR, PM.nbVar(muR, v)));
  return p;
}
const out = { what: 'Planted in-game prices on the 2023-24 development lines (critique C7)', tau: TAU, shares: {} };
const key = x => x.game + '|' + x.player + '|' + x.stat;
for (const share of [0, 0.1, 0.2]) {
  const { L } = V.loadMA('2024');
  const oofKeys = new Set(OO.keys);
  const pgs = [...new Set(L.filter(x => oofKeys.has(key(x))).map(x => x.game + '|' + x.player))].sort();
  const R = T.rng(4242 + Math.round(share * 100)), chosen = new Set(pgs.filter(() => R() < share));
  const byPg = new Map(); for (const x of L) { const k = x.game + '|' + x.player; if (!byPg.has(k)) byPg.set(k, []); byPg.get(k).push(x); }
  let n = 0;
  for (const k of chosen) {
    const a = byPg.get(k).filter(x => x.status === 'graded' && x.mu != null); if (!a.length) continue;
    const x = a[Math.floor(R() * a.length)], p = planted(x);
    x.q = p; x.Iu = 1 - p; x.Io = Math.min(0.995, p + x.M); x.zq = logit(x.q); x.zo = logit(x.Io); x.muDK = M.impliedMean(x.line, x.q, x.ab); x.planted = 1; n++;
  }
  M.mixOf(L); V.derive(L, 2024);
  const G = V.sample(L), oof = G.filter(x => oofKeys.has(key(x)));
  const nArr = Float64Array.from(oof, nudOf), zcf = S.crossFitBig(oof);
  for (const x of oof) x.mproj = mproj.get(x.game + '|' + x.player);
  const v2L = oof.filter(x => x.mproj >= 24 && prevOf.get(x.game + '|' + x.player) === true), exit = v2L.filter(x => x.minPlayed < 12), rest = v2L.filter(x => x.minPlayed >= 12);
  const idx = new Map(oof.map((x, i) => [x, i]));
  const shift = x => sigm(x.zq + nArr[idx.get(x)]) - x.q, gain = x => { const i = idx.get(x); return ll(sigm(zcf[i] + nArr[i]), x.o) - ll(sigm(zcf[i]), x.o); };
  let wsum = 0, wd = 0; for (const s of STATS) { const e = exit.filter(x => x.stat === s), r = rest.filter(x => x.stat === s); if (!e.length || !r.length) continue; const d = mean(e.map(x => x.q)) - mean(r.map(x => x.q)); wsum += e.length; wd += e.length * d; }
  const t2 = S.T2(oof, nArr, zcf, 2000);
  const res = { plantedPlayerGames: n, plantedLines: oof.filter(x => x.planted).length, exits: new Set(exit.map(x => x.game + '|' + x.player)).size, exitLines: exit.length,
    v2: wd / wsum, v4UnderwardMore: mean(rest.map(shift)) - mean(exit.map(shift)), v4bGainExitLessRest: mean(exit.map(gain)) - mean(rest.map(gain)),
    t2: { ll: t2.ll, llCi: t2.llCi, br: t2.br } };
  res.v2Flags = res.v2 < -0.05; res.v4Flags = res.v4UnderwardMore > 0.005;
  out.shares[share] = res;
  log(`share ${share}: planted ${n} player-games (${res.plantedLines} lines); V2 ${res.v2.toFixed(4)} (flags ${res.v2Flags}); V4 underward-more ${(res.v4UnderwardMore * 100).toFixed(3)} pts (flags ${res.v4Flags}); V4b gain exit less rest ${res.v4bGainExitLessRest.toExponential(3)}; T2 ${t2.ll.toExponential(3)} [${t2.llCi.map(v => v.toExponential(2))}]`);
}
out.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(M.ROOT, 'research', 'props_v3', 'results', 'ma_plant_ingame.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
