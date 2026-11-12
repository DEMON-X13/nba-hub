/* PLAN.md's sizing checks, step 3: is the stat-mix nudge's strength an artefact? (research only: SIZING)
 *
 *   node research/props_v3/plan_sizing/leakcheck.js  -> research/props_v3/results/plan_leakcheck.json (about a minute)
 *
 * The stat-mix nudge reads DraftKings' level off a player's OTHER lines in the same game. If a share of those prices had
 * been moved during the game (the feed cannot show they were not: V1), the level would carry the game's own news and the
 * nudge would "know" it on his other lines. Four checks on the 2023-24 lines (development data), each with the nudge's
 * weights fitted on the other half of the nights (alternate nights, so no line is scored by weights fitted on it):
 *   1. V2 for the nudge: on early exits (projected 24+ minutes, played his club's previous game, played under 12), does
 *      the nudge lean to the Under more than elsewhere? A pre-game nudge cannot know the exit
 *   2. the level read without points: the nudge rebuilt with the level taken from every stat but points, its gain on
 *      the other stats; and with the level taken from points alone
 *   3. the nudge against the minutes the player went on to play, against his projection (the surprise): a pre-game
 *      mix, hedged across his stats by construction, should not move with it
 *   4. the gain where his points line is posted and where it is not
 * Outcomes (the stat, the minutes played) are read only to score; nothing here is fitted on them but the nudge's six
 * weights, on the other half.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const S = require('./lib.js');
const { STATS, perStat, mean, ll, sigm, logit, PM } = S;
const { L } = S.load('2024');
const G = S.graded(L);
const nights = [...new Set(G.map(x => x.date))].sort(), half = new Map(nights.map((d, i) => [d, i % 2]));
/* alternate the halves: each line's nudge from the weights fitted on the other half */
const w = [0, 1].map(h => S.fitNudge(G.filter(x => half.get(x.date) !== h), perStat(x => x.dMix)).w);
const nud = x => w[half.get(x.date)][STATS.indexOf(x.stat)] * x.dMix;
const zcf = S.crossFit(G);
const out = { lines: G.length, weights: w };
/* 1. early exits */
const exitL = x => x.mproj >= 24 && x.missed === 0 && x.minPlayed < 12, regL = x => x.mproj >= 24 && x.missed === 0 && x.minPlayed >= 12;
const shiftPts = x => sigm(zcf[x._i] + nud(x)) - sigm(zcf[x._i]);
G.forEach((x, i) => { x._i = i; });
out.earlyExits = { lines: G.filter(exitL).length, playerGames: new Set(G.filter(exitL).map(x => x.game + '|' + x.player)).size,
  nudgeShiftExit: mean(G.filter(exitL).map(shiftPts)), nudgeShiftRest: mean(G.filter(regL).map(shiftPts)),
  dkExit: mean(G.filter(exitL).map(x => x.q)), dkRest: mean(G.filter(regL).map(x => x.q)),
  byStat: Object.fromEntries(STATS.map(s => [s, { exit: mean(G.filter(x => exitL(x) && x.stat === s).map(shiftPts)), rest: mean(G.filter(x => regL(x) && x.stat === s).map(shiftPts)), n: G.filter(x => exitL(x) && x.stat === s).length }])) };
/* 2. the level from other stats only: rebuilt for each anchor set */
function mixWith(anchor) {
  const pg = new Map(); for (const x of G) { const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, []); pg.get(k).push(x); }
  const v = new Map();
  for (const [, a] of pg) { const an = a.filter(x => anchor(x)); if (!an.length) continue;
    let sw = 0, sr = 0; for (const x of an) { const ww = x.mu * x.mu / x.v; sw += ww; sr += ww * (Math.log(x.muDK) - Math.log(x.mu)); }
    const kap = sr / sw; for (const x of a) { const mu2 = x.mu * Math.exp(kap); v.set(x, logit(PM.pOver(x.line, mu2, PM.nbVar(mu2, x.ab))) - x.zq); } }
  return v;
}
function gainOn(sel, dOf) {
  const ix = G.map((x, i) => (sel(x) && dOf(x) != null ? i : -1)).filter(i => i >= 0), Ls = ix.map(i => G[i]);
  const nArr = Float64Array.from(Ls, x => w[half.get(x.date)][STATS.indexOf(x.stat)] * dOf(x));
  const t2 = S.T2(Ls, nArr, Float64Array.from(ix, i => zcf[i]), 2000);
  return { lines: Ls.length, ll: t2.ll, llCi: t2.llCi };
}
const noPts = mixWith(x => x.stat !== 'pts'), onlyPts = mixWith(x => x.stat === 'pts');
const nonPts = x => x.stat !== 'pts';
out.anchors = { asBuilt_nonPoints: gainOn(nonPts, x => x.dMix), levelWithoutPoints_nonPoints: gainOn(x => nonPts(x) && noPts.has(x), x => noPts.get(x)),
  levelFromPointsAlone_nonPoints: gainOn(x => nonPts(x) && onlyPts.has(x), x => onlyPts.get(x)), asBuilt_points: gainOn(x => x.stat === 'pts', x => x.dMix) };
/* 3. against the minutes surprise, per player-game: the mean nudge (in logit) and the surprise */
{ const pg = new Map(); for (const x of G) { const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, { n: [], s: x.minPlayed - x.mproj }); pg.get(k).n.push(nud(x)); }
  const a = [...pg.values()].map(v => [mean(v.n), v.s]); const mx = mean(a.map(v => v[0])), my = mean(a.map(v => v[1]));
  let c = 0, sx = 0, sy = 0; for (const [u, v] of a) { c += (u - mx) * (v - my); sx += (u - mx) ** 2; sy += (v - my) ** 2; }
  out.minutesSurprise = { playerGames: a.length, corrMeanNudgeWithSurprise: c / Math.sqrt(sx * sy), meanNudge: mx };
  /* and the raw disagreement's, for scale: DraftKings' level does know minutes the model does not */
  const b = new Map(); for (const x of G) { const k = x.game + '|' + x.player; if (!b.has(k)) b.set(k, { n: [], s: x.minPlayed - x.mproj }); b.get(k).n.push(x.d); }
  const a2 = [...b.values()].map(v => [mean(v.n), v.s]); const m2 = mean(a2.map(v => v[0])), n2 = mean(a2.map(v => v[1]));
  let c2 = 0, s2 = 0, t2 = 0; for (const [u, v] of a2) { c2 += (u - m2) * (v - n2); s2 += (u - m2) ** 2; t2 += (v - n2) ** 2; }
  out.minutesSurprise.corrRawDisagreementWithSurprise = c2 / Math.sqrt(s2 * t2);
  const kk = new Map(); for (const x of G) kk.set(x.game + '|' + x.player, { k: x.kap, s: x.minPlayed - x.mproj });
  const a3 = [...kk.values()]; const m3 = mean(a3.map(v => v.k)), n3 = mean(a3.map(v => v.s)); let c3 = 0, s3 = 0, t3 = 0;
  for (const v of a3) { c3 += (v.k - m3) * (v.s - n3); s3 += (v.k - m3) ** 2; t3 += (v.s - n3) ** 2; }
  out.minutesSurprise.corrDKLevelWithSurprise = c3 / Math.sqrt(s3 * t3);
}
/* 4. with and without a points line posted for him */
const hasPts = new Set(G.filter(x => x.stat === 'pts').map(x => x.game + '|' + x.player));
out.pointsPosted = { with: gainOn(x => nonPts(x) && hasPts.has(x.game + '|' + x.player), x => x.dMix), without: gainOn(x => nonPts(x) && !hasPts.has(x.game + '|' + x.player), x => x.dMix) };
/* the whole, both halves out of sample */
out.whole = gainOn(() => true, x => x.dMix);
const file = path.join(S.ROOT, 'research', 'props_v3', 'results', 'plan_leakcheck.json');
fs.writeFileSync(file, JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toPrecision(6) : v), 1) + '\n');
console.log(JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toPrecision(4) : v), 1));
