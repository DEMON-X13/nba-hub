/* Why the props trial lost to DraftKings, checked with this study's own code (research only: DIAGNOSIS).
 *
 *   node research/props_v3/why_trial.js      writes research/props_v3/results/why_trial.json (about 30 s)
 *
 * What it reads: the trial's frozen calls and fit (data/props_shadow.json), its graded lines (data/props_shadow_lines.csv:
 * the model's chance, DraftKings' fair chance, the stat), DraftKings' closing lines and prices (data/props_2027.csv), the
 * 2026-27 box scores (data/box_2027.csv, for the minutes each player played), the schedule (data/games.csv) and the
 * injury log (data/injuries_log.csv). These are the season in play: the rules allow them for a diagnosis of where the
 * frozen model lost, never to fit, tune, choose or score a candidate. Every regression below is fitted on the lines it
 * describes and says so: each is a measurement of the frozen model, not a correction to it, and none is carried
 * anywhere. Nothing is written but results/why_trial.json.
 *
 * What it measures (each in its own block of the json):
 *   reproduce   the ledger's own figures from the raw inputs (each line's model chance recomputed from the frozen call and
 *               the fit, DraftKings' fair chance from its two prices, the gap and its interval by tools/props.js bootCI,
 *               which is the bar's own method, and again by this study's own bootstrap)
 *   sureness    how far from 50% each forecaster says, and the calibration slope of each (P(Over) = sigm(a + b logit p),
 *               fitted on the lines: b is 1 when a forecaster's departures from 50% are the right size, under 1 when it
 *               is too sure of itself), pooled and by stat, with intervals resampling games
 *   where       the share of the log-loss gap on lines where the two disagree by 10 points or more, and who was right there
 *   parts       the gap taken apart: the part a perfect in-sample recalibration of the model's own chance would remove (its
 *               lean alone, its over-sureness alone, both) and what is left, which is information DraftKings had and the
 *               model did not; by stat
 *   beyond      the share of the model's disagreement with DraftKings worth keeping (P(Over) = sigm(logit q + w (logit m -
 *               logit q)), w fitted on the lines): whether the model added anything to DraftKings' price
 *   minutes     where DraftKings' better information showed up. DraftKings' price is read as a mean on the model's own
 *               distribution (the mean at which the model's negative binomial gives DraftKings' fair chance); its
 *               disagreement with the model's mean, in the model's standard deviations, is set against what then
 *               happened, split exactly into the minutes the player played (the call's mean at the minutes played, less
 *               the call's mean) and what he did per minute (the stat less that). The slope of each part on the
 *               disagreement says how much of what DraftKings knew came true through the minutes and how much through the
 *               production per minute; then the same split on the lines with late news the call could not have had (a
 *               called teammate who did not play, a teammate who played 15+ minutes with no call, the player himself on
 *               the game day's injury report) and on those with none, and the call's age at tip-off
 *   lean        the early-season Over lean: its size, and how much of the gap a perfect removal of it would close
 *   byStat, baseStats, byWeek, roles
 *               the gap by stat, on the six base stats alone (what 2023-24's lines carry; sureness, parts, beyond and
 *               minutes carry the same cut, and the five combos), in the trial's first and second week, and by the
 *               kinds of line where minutes are least known (his first games of the season, a new club, the bench, the
 *               call's own minutes, a side with late news)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./why_lib.js');
const { PM, csv, mean, ll, br, logit, sigm } = T;
const DATA = path.join(T.ROOT, 'data');
const OUT = path.join(__dirname, 'results', 'why_trial.json');
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const LAYOUT = ['min'].concat(PM.ALL, ['dd', 'td']);
const NB = +process.env.WHY_BOOT || 1000;          // resamples for the regressions' intervals (the gap's own use 10,000)

/* ---------- the inputs ---------- */
const ledger = JSON.parse(fs.readFileSync(path.join(DATA, 'props_shadow.json'), 'utf8'));
const graded = csv(path.join(DATA, 'props_shadow_lines.csv'));
const rec = new Map(csv(path.join(DATA, 'props_2027.csv')).map(r => [r.game_id + '|' + r.player_id + '|' + r.stat, r]));
const games = new Map(csv(path.join(DATA, 'games.csv')).filter(g => +g.season === 2027).map(g => [g.game_id, g]));
const box = new Map(), boxRows = csv(path.join(DATA, 'box_2027.csv'));
for (const r of boxRows) box.set(r.game_id + '|' + r.player_id, r);
/* each player's appearances (2025-26 and 2026-27), to place a called player who is not on the box on his club */
const appear = {};
for (const s of [2026, 2027]) for (const r of csv(path.join(DATA, `box_${s}.csv`))) if ((+r.min || 0) > 0 && +r.dnp !== 1) (appear[r.player_id] = appear[r.player_id] || []).push({ date: r.date, team: r.team });
for (const a of Object.values(appear)) a.sort((x, y) => (x.date < y.date ? -1 : 1));
const teamBefore = (id, date) => { const a = (appear[id] || []).filter(x => x.date < date); return a.length ? a[a.length - 1].team : null; };
const inj = {};
for (const r of csv(path.join(DATA, 'injuries_log.csv'))) ((inj[r.date] = inj[r.date] || {})[r.player_id] = r.status);

/* ---------- each graded line, rebuilt ---------- */
const lines = []; let pModelOff = 0, pMarketOff = 0, maxModelOff = 0;
for (const g of graded) {
  const call = ledger.calls[g.game_id], c = call.players[g.player_id], fit = ledger.fits[call.fit];
  const r = rec.get(g.game_id + '|' + g.player_id + '|' + g.stat);
  const line = +r.line, over = T.F.propAmerican(r.over), under = T.F.propAmerican(r.under);
  const mu = c[LAYOUT.indexOf(g.stat)], m = c[0], ab = fit.var[g.stat], v = PM.nbVar(mu, ab);
  const p = PM.pOver(line, mu, v), q = T.fairOver(over, under);
  const off = Math.abs(p - +g.p_model); maxModelOff = Math.max(maxModelOff, off); if (off > 1e-4) pModelOff++;
  if (Math.abs(q - +g.p_market) > 1e-4) pMarketOff++;
  const b = box.get(g.game_id + '|' + g.player_id), gm = games.get(g.game_id);
  const y = +g.y;
  lines.push({ game: g.game_id, id: g.player_id, stat: g.stat, line, over, under, pModel: +g.p_model, pMarket: +g.p_market, y, o: y > line ? 1 : 0, push: y === line,
    mu, m, ab, sd: Math.sqrt(v), a: +b.min, starter: +b.starter === 1, team: b.team, date: gm.date, tip: call.tip, calledAt: call.called_at });
}
if (lines.some(x => x.push)) throw new Error('a graded line is a push: the ledger drops pushes');
log(`${lines.length} graded lines on ${new Set(lines.map(x => x.game)).size} games rebuilt`);

/* ---------- reproduce the ledger ---------- */
const byGame = (f, g) => { const mm = new Map(); for (const x of lines) { const v = mm.get(x.game) || [0, 0]; v[0] += f(x) - g(x); v[1]++; mm.set(x.game, v); } return [...mm.values()]; };
const S = T.scoreLines(lines);
const reproduce = {
  lines: lines.length, games: S.games,
  modelChanceRecomputed: { linesDifferingOver1e4: pModelOff, maxAbsDiff: maxModelOff },
  marketChanceRecomputed: { linesDifferingOver1e4: pMarketOff },
  ledger: ledger.summary.scores,
  here: { llModel: S.llModel, llMarket: S.llMarket, llDiff: S.llDiff, brModel: S.brModel, brMarket: S.brMarket, brDiff: S.brDiff, overRate: S.overRate, modelSaid: S.modelSaid, marketSaid: S.marketSaid },
  llDiffCi_toolsPropsBootCI: PM.bootCI(byGame(x => ll(x.pModel, x.o), x => ll(x.pMarket, x.o))),
  brDiffCi_toolsPropsBootCI: PM.bootCI(byGame(x => br(x.pModel, x.o), x => br(x.pMarket, x.o))),
  llDiffCi_ownBootstrap: S.llDiffCi, brDiffCi_ownBootstrap: S.brDiffCi,
};
reproduce.sameAsLedger = Math.abs(S.llDiff - ledger.summary.scores.logloss_diff) < 5e-7 && Math.abs(S.brDiff - ledger.summary.scores.brier_diff) < 5e-7
  && reproduce.llDiffCi_toolsPropsBootCI[0] === ledger.summary.scores.logloss_diff_ci90[0] && reproduce.llDiffCi_toolsPropsBootCI[1] === ledger.summary.scores.logloss_diff_ci90[1];
log(`gap ${S.llDiff.toFixed(6)} (ledger ${ledger.summary.scores.logloss_diff}); bootCI ${reproduce.llDiffCi_toolsPropsBootCI} (ledger ${ledger.summary.scores.logloss_diff_ci90}); same ${reproduce.sameAsLedger}`);

/* ---------- sureness and calibration ---------- */
const STATS = PM.ALL;
const by = k => lines.filter(x => x.stat === k);
const calRow = sub => ({ lines: sub.length, modelFrom50: mean(sub.map(x => Math.abs(x.pModel - 0.5))), marketFrom50: mean(sub.map(x => Math.abs(x.pMarket - 0.5))),
  model: T.calib(sub, 'pModel', NB), market: T.calib(sub, 'pMarket', NB) });
const BASE = new Set(PM.STATS), base = lines.filter(x => BASE.has(x.stat));   // the six base stats: what 2023-24's lines carry
const sureness = { pooled: calRow(lines), baseStats: calRow(base), combos: calRow(lines.filter(x => !BASE.has(x.stat))), byStat: {} };
for (const k of STATS) sureness.byStat[k] = calRow(by(k));
/* the calibration table: the chance said in bands, against how often the Over went in */
const bands = [[0, 0.3], [0.3, 0.4], [0.4, 0.45], [0.45, 0.5], [0.5, 0.55], [0.55, 0.6], [0.6, 0.7], [0.7, 1.01]];
sureness.table = bands.map(([lo, hi]) => {
  const fm = lines.filter(x => x.pModel >= lo && x.pModel < hi), fq = lines.filter(x => x.pMarket >= lo && x.pMarket < hi);
  return { band: `${Math.round(lo * 100)}-${Math.round(Math.min(hi, 1) * 100)}%`, model: { lines: fm.length, said: mean(fm.map(x => x.pModel)), hit: mean(fm.map(x => x.o)) }, market: { lines: fq.length, said: mean(fq.map(x => x.pMarket)), hit: mean(fq.map(x => x.o)) } };
});
log(`calibration slope: model ${sureness.pooled.model.slope.toFixed(3)} ${sureness.pooled.model.slopeCi.map(v => v.toFixed(3))}, DraftKings ${sureness.pooled.market.slope.toFixed(3)} ${sureness.pooled.market.slopeCi.map(v => v.toFixed(3))}`);

/* ---------- where the gap sits ---------- */
const dLL = x => ll(x.pModel, x.o) - ll(x.pMarket, x.o);
const totalGap = T.sum(lines.map(dLL));
const gapRow = (label, sub) => ({ label, lines: sub.length, share: sub.length / lines.length, gapShare: T.sum(sub.map(dLL)) / totalGap, llDiff: mean(sub.map(dLL)),
  overHit: mean(sub.map(x => x.o)), modelSaid: mean(sub.map(x => x.pModel)), marketSaid: mean(sub.map(x => x.pMarket)) });
const dis = x => x.pModel - x.pMarket;
const where = [
  gapRow('DraftKings 10+ points above the model', lines.filter(x => dis(x) <= -0.10)),
  gapRow('DraftKings 5 to 10 above', lines.filter(x => dis(x) > -0.10 && dis(x) <= -0.05)),
  gapRow('within 5', lines.filter(x => Math.abs(dis(x)) < 0.05)),
  gapRow('model 5 to 10 above', lines.filter(x => dis(x) >= 0.05 && dis(x) < 0.10)),
  gapRow('model 10+ above', lines.filter(x => dis(x) >= 0.10)),
  gapRow('apart by 10 points or more, either way', lines.filter(x => Math.abs(dis(x)) >= 0.10)),
];

/* ---------- the gap taken apart: calibration (lean, over-sureness) against information ---------- */
function parts(sub) {
  const rm = T.recal(sub, 'pModel'), rq = T.recal(sub, 'pMarket');
  const gap = rm.raw - rq.raw;
  /* the lean's and the over-sureness's shares, averaged over the two orders they can be taken in */
  const lean = ((rm.raw - rm.shiftOnly) + (rm.slopeOnly - rm.both)) / 2, sure = ((rm.raw - rm.slopeOnly) + (rm.shiftOnly - rm.both)) / 2;
  return { lines: sub.length, gap, model: rm, market: rq, leanPart: lean, overSurePart: sure, calibrationPart: rm.raw - rm.both,
    informationPart: rm.both - rq.both, marketOwnRecal: rq.raw - rq.both,
    shares: { lean: lean / gap, overSure: sure / gap, information: (rm.both - rq.raw) / gap } };
}
const gapParts = { pooled: parts(lines), baseStats: parts(base), combos: parts(lines.filter(x => !BASE.has(x.stat))), byStat: {} };
for (const k of STATS) gapParts.byStat[k] = parts(by(k));
log(`gap ${gapParts.pooled.gap.toFixed(4)}: lean ${gapParts.pooled.leanPart.toFixed(4)}, over-sure ${gapParts.pooled.overSurePart.toFixed(4)}, recalibrated still behind ${(gapParts.pooled.model.both - gapParts.pooled.market.raw).toFixed(4)}`);

/* ---------- does the model add anything beyond DraftKings' price ---------- */
const beyond = { pooled: T.infoBeyond(lines, 'pModel', NB), baseStats: T.infoBeyond(base, 'pModel', NB), byStat: {} };
for (const k of STATS) beyond.byStat[k] = T.infoBeyond(by(k), 'pModel', NB);
log(`w (share of the model's disagreement worth keeping): ${beyond.pooled.w.toFixed(3)} ${beyond.pooled.wCi.map(v => v.toFixed(3))}`);

/* ---------- where DraftKings' better information showed up: minutes or production per minute ---------- */
for (const x of lines) {
  x.muDK = T.impliedMean(x.line, x.pMarket, x.ab);
  x.delta = (x.muDK - x.mu) / x.sd;                              // DraftKings' disagreement, in the model's sd
  x.eTot = (x.y - x.mu) / x.sd;                                   // what happened, against the model's mean
  x.eMin = x.m > 0 ? x.mu * (x.a / x.m - 1) / x.sd : 0;           // the minutes part: the call at the minutes he played
  x.eRate = x.eTot - x.eMin;                                      // the production per minute
}
/* the late news a call could not have had, on each player's side */
const called = {};                                                // game -> team -> [{id, m}]
for (const [gid, call] of Object.entries(ledger.calls)) {
  const gm = games.get(gid); if (!gm) continue;
  for (const [id, c] of Object.entries(call.players)) {
    const b = box.get(gid + '|' + id), team = b ? b.team : teamBefore(id, gm.date);
    if (!team) continue;
    ((called[gid] = called[gid] || {})[team] = called[gid][team] || []).push({ id, m: c[0], played: !!b && +b.min > 0 && +b.dnp !== 1 });
  }
}
const playedBy = {};                                              // game -> team -> [{id, min}]
for (const r of boxRows) if (+r.min > 0 && +r.dnp !== 1) ((playedBy[r.game_id] = playedBy[r.game_id] || {})[r.team] = playedBy[r.game_id][r.team] || []).push({ id: r.player_id, min: +r.min });
for (const x of lines) {
  const side = ((called[x.game] || {})[x.team]) || [], pl = ((playedBy[x.game] || {})[x.team]) || [];
  const callIds = new Set(Object.keys(ledger.calls[x.game].players));
  x.lateScratch = side.some(c => c.id !== x.id && !c.played && c.m >= 20);
  x.uncalled = pl.some(p => p.id !== x.id && !callIds.has(p.id) && p.min >= 15);
  const st = (inj[x.date] || {})[x.id];
  x.ownReport = !!st && !/^out/i.test(st);
  x.ageH = (Date.parse(x.tip.replace('Z', ':00Z')) - Date.parse(x.calledAt.replace('Z', ':00Z'))) / 3.6e6;
}
const idxOf = f => lines.map((x, i) => (f(x) ? i : -1)).filter(i => i >= 0);
const arr = k => lines.map(x => x[k]);
const D = arr('delta'), ET = arr('eTot'), EM = arr('eMin'), ER = arr('eRate');
/* the slopes of what happened (and of its two parts) on DraftKings' disagreement: centred, so the season's common lean
   is left to its own block; tot = min + rate exactly */
function split(ix, seed = 0) {
  const bt = T.olsSlope(ix, D, ET), bm = T.olsSlope(ix, D, EM), brr = T.olsSlope(ix, D, ER);
  const groups = T.groupBy(ix.map(i => lines[i]), x => x.game).map(g => g.map(j => ix[j]));
  const ci = T.clusterBoot(groups, iz => T.olsSlope(iz, D, EM) / T.olsSlope(iz, D, ET), NB, seed);
  const ciT = T.clusterBoot(groups, iz => T.olsSlope(iz, D, ET), NB, seed + 7);
  return { lines: ix.length, slopeTotal: bt, slopeTotalCi: ciT, slopeMinutes: bm, slopeRate: brr, minutesShare: bm / bt, minutesShareCi: ci,
    sdDelta: Math.sqrt(mean(ix.map(i => D[i] * D[i])) - mean(ix.map(i => D[i])) ** 2) };
}
const all = lines.map((_, i) => i);
const news = x => x.lateScratch || x.uncalled;
const minutes = { pooled: split(all), baseStats: split(idxOf(x => BASE.has(x.stat))), byStat: {}, noLateNews: split(idxOf(x => !news(x) && !x.ownReport)), lateNews: split(idxOf(x => news(x))),
  ownReport: split(idxOf(x => x.ownReport)), starters: split(idxOf(x => x.starter)), bench: split(idxOf(x => !x.starter)) };
for (const k of STATS) minutes.byStat[k] = split(idxOf(x => x.stat === k));
/* how much of the minutes covariance, and of the whole, the lines with late news carry: contributions to the pooled,
   centred covariance */
{
  const md = mean(D), mm = mean(EM), mt = mean(ET);
  const covShare = f => { let cm = 0, ct = 0, cmAll = 0, ctAll = 0; lines.forEach((x, i) => { const a = (D[i] - md) * (EM[i] - mm), b = (D[i] - md) * (ET[i] - mt); cmAll += a; ctAll += b; if (f(x)) { cm += a; ct += b; } }); return { ofMinutesCov: cm / cmAll, ofTotalCov: ct / ctAll, ofLines: lines.filter(f).length / lines.length }; };
  minutes.contributions = { lateNews: covShare(news), ownReport: covShare(x => x.ownReport && !news(x)), neither: covShare(x => !news(x) && !x.ownReport) };
}
/* the share of the minutes part the late news explains: the late-news lines' contribution to the centred minutes
   covariance beyond what the same number of lines carries where there was no late news (a line's average there) */
function lateExcess(ix) {
  const md = mean(ix.map(i => D[i])), mm = mean(ix.map(i => EM[i]));
  let late = 0, nLate = 0, none = 0, nNone = 0, tot = 0;
  for (const i of ix) { const c = (D[i] - md) * (EM[i] - mm); tot += c; if (news(lines[i])) { late += c; nLate++; } else if (!lines[i].ownReport) { none += c; nNone++; } }
  return (late - nLate * none / nNone) / tot;
}
minutes.lateNewsExcess = { share: lateExcess(all), ci: T.clusterBoot(T.groupBy(lines, x => x.game), lateExcess, NB, 3),
  rule: 'of the minutes part of DraftKings\' information (the centred covariance of its disagreement with the minutes part of what happened), the share the late-news lines carry beyond the no-news lines\' rate per line' };
/* the two groups where the two disagree most, in their own units: what the call said, what DraftKings' price implied,
   and what happened, with the minutes said and played */
const grp = f => { const s = lines.filter(f); const pts = s.filter(x => x.stat === 'pts');
  return { lines: s.length, minutesSaid: mean(s.map(x => x.m)), minutesPlayed: mean(s.map(x => x.a)), meanSaidSd: mean(s.map(x => (x.mu - x.line) / x.sd)), dkImpliedSd: mean(s.map(x => (x.muDK - x.line) / x.sd)), happenedSd: mean(s.map(x => (x.y - x.line) / x.sd)),
    points: { lines: pts.length, modelMean: mean(pts.map(x => x.mu)), dkImpliedMean: mean(pts.map(x => x.muDK)), line: mean(pts.map(x => x.line)), scored: mean(pts.map(x => x.y)), minutesSaid: mean(pts.map(x => x.m)), minutesPlayed: mean(pts.map(x => x.a)) } }; };
minutes.disagreementGroups = { modelHigher10: grp(x => x.pModel - x.pMarket >= 0.10), dkHigher10: grp(x => x.pMarket - x.pModel >= 0.10), within5: grp(x => Math.abs(x.pModel - x.pMarket) < 0.05) };
const ages = lines.map(x => x.ageH).sort((a, b) => a - b);
minutes.callAgeHours = { median: ages[Math.floor(ages.length / 2)], p10: ages[Math.floor(ages.length * 0.1)], p90: ages[Math.floor(ages.length * 0.9)], over3h: ages.filter(a => a > 3).length / ages.length };
minutes.byCallAge = { under2h: split(idxOf(x => x.ageH < 2)), from2to4h: split(idxOf(x => x.ageH >= 2 && x.ageH < 4)), over4h: split(idxOf(x => x.ageH >= 4)) };
minutes.lineCounts = { lateScratch: lines.filter(x => x.lateScratch).length, uncalled: lines.filter(x => x.uncalled).length, eitherLateNews: lines.filter(news).length, ownReport: lines.filter(x => x.ownReport).length };
minutes.minutesSaidPlayed = { said: mean(lines.map(x => x.m)), played: mean(lines.map(x => x.a)), mae: mean(lines.map(x => Math.abs(x.a - x.m))) };
log(`minutes share of DraftKings' information: ${(100 * minutes.pooled.minutesShare).toFixed(1)}% ${minutes.pooled.minutesShareCi.map(v => (100 * v).toFixed(1))}; no late news ${(100 * minutes.noLateNews.minutesShare).toFixed(1)}%; late-news lines carry ${(100 * minutes.contributions.lateNews.ofMinutesCov).toFixed(1)}% of the minutes covariance on ${(100 * minutes.contributions.lateNews.ofLines).toFixed(1)}% of lines`);

/* ---------- the early-season Over lean ---------- */
const lean = {
  overSaid: S.modelSaid, overHit: S.overRate, overDK: S.marketSaid, meanMinusStat: mean(lines.map(x => x.mu - x.y)),
  meanMinusStatByStat: Object.fromEntries(STATS.map(k => [k, mean(by(k).map(x => x.mu - x.y))])),
  /* a perfect in-sample removal of the lean: each stat's mean moved by its own average error on these lines, the spread
     rule unchanged, and the lines priced again */
  meanShift: (() => {
    const sh = Object.fromEntries(STATS.map(k => [k, mean(by(k).map(x => x.mu - x.y))]));
    const p2 = lines.map(x => { const mu = Math.max(0.01, x.mu - sh[x.stat]); return PM.pOver(x.line, mu, PM.nbVar(mu, x.ab)); });
    const llNew = mean(lines.map((x, i) => ll(p2[i], x.o)));
    return { llBefore: S.llModel, llAfter: llNew, gain: S.llModel - llNew, shareOfGap: (S.llModel - llNew) / S.llDiff };
  })(),
  shiftInLogit: { gain: gapParts.pooled.model.raw - gapParts.pooled.model.shiftOnly, shareOfGap: (gapParts.pooled.model.raw - gapParts.pooled.model.shiftOnly) / gapParts.pooled.gap },
  sharedOrderShare: gapParts.pooled.shares.lean,
};
log(`lean: said ${(100 * lean.overSaid).toFixed(1)}% hit ${(100 * lean.overHit).toFixed(1)}%; removing it gains ${lean.shiftInLogit.gain.toFixed(5)} (${(100 * lean.shiftInLogit.shareOfGap).toFixed(1)}% of the gap), mean shift ${(100 * lean.meanShift.shareOfGap).toFixed(1)}%`);

/* ---------- by week, and by stat on one table ---------- */
const baseScore = T.scoreLines(base, 10000, 0);
const byWeek = {
  first: T.scoreLines(lines.filter(x => x.date <= '2026-10-27'), 10000, 0),
  second: T.scoreLines(lines.filter(x => x.date > '2026-10-27'), 10000, 0),
};
const byStat = {};
for (const k of STATS) { const s = T.scoreLines(by(k), 10000, 0); byStat[k] = s; }
/* where minutes are least known: his appearances this season before the game (box_2027), a new club (his last
   appearance of 2025-26 was for another), the box's starter flag, the call's own minutes */
const seasonStart = '2026-10-01';
for (const x of lines) {
  const a = (appear[x.id] || []).filter(z => z.date < x.date);
  x.nCur = a.filter(z => z.date >= seasonStart).length;
  const prev = a.filter(z => z.date < seasonStart);
  x.newClub = prev.length ? prev[prev.length - 1].team !== x.team : null;
}
const roleRow = (label, f) => { const s = lines.filter(f); if (s.length < 50) return { label, lines: s.length }; const S2 = T.scoreLines(s, 2000, 0);
  return { label, lines: s.length, llDiff: S2.llDiff, llDiffCi: S2.llDiffCi, modelSaid: S2.modelSaid, overHit: S2.overRate, marketSaid: S2.marketSaid, minutesSaid: mean(s.map(x => x.m)), minutesPlayed: mean(s.map(x => x.a)) }; };
const roles = [roleRow('his first game of the season', x => x.nCur === 0), roleRow('his 2nd to 6th game', x => x.nCur >= 1 && x.nCur <= 5),
  roleRow('a new club (another club last season)', x => x.newClub === true), roleRow('no game last season', x => x.newClub === null),
  roleRow('started', x => x.starter), roleRow('off the bench', x => !x.starter),
  roleRow('projected under 20 minutes', x => x.m < 20), roleRow('projected 20 to 30', x => x.m >= 20 && x.m < 30), roleRow('projected 30 to 34', x => x.m >= 30 && x.m < 34), roleRow('projected 34+', x => x.m >= 34),
  roleRow('a late scratch or an uncalled teammate on his side', x => x.lateScratch || x.uncalled), roleRow('neither', x => !x.lateScratch && !x.uncalled)];

const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v3/why_trial.js: why the props trial lost to DraftKings, on its own graded lines (diagnosis only; nothing fitted here is a candidate or carried anywhere)',
  boot: { gap: 10000, regressions: NB, seed: 0 }, reproduce, baseStats: baseScore, byStat, byWeek, roles, sureness, where, gapParts, beyond, minutes, lean, seconds: Math.round((Date.now() - t0) / 1000) };
fs.writeFileSync(OUT, JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toPrecision(7) : v), 1) + '\n');
log(`wrote ${path.relative(T.ROOT, OUT)}`);
