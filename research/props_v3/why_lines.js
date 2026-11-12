/* Why the props model loses to DraftKings, on the two sets of DraftKings' lines this study may read for development
 * (research only: DIAGNOSIS).
 *
 *   node research/props_v3/why_lines.js [archive] [2024]
 *     archive  DraftKings' closing lines of the 2026 play-in and playoffs (data/props_2026.csv, 11 stats): SPENT, read
 *              here for development only, never a test
 *     2024     DraftKings' provider-40 lines of the 2023-24 regular season (research/props_v2/cache/props40_2024.csv,
 *              the six base stats, fetched by research/props_v2/fetch_dk40.js into the gitignored cache): scored once
 *              against candidate A on 6 November 2026 (FAIL), and so DEVELOPMENT data for any new candidate
 *   writes research/props_v3/results/why_lines_<set>.json (about two minutes a set)
 *
 * The forecasters are the ones those lines were scored with, never refitted here: tools/props.js's walk-forward fold
 * (research/props_v2/results/fold_params.json: the 2024 fold fitted on 2022-23, the 2026 fold on 2023-2025; the same
 * constants research/props.json stores) and candidate A's fold (research/props_v2/results/cand_fix_score.json), each
 * projected through research/props_v2/cand_fix_lib.js (whose projection with none of A's changes is tools/props.js's
 * exactly, which props_v2 checked), on the box score's list of who dressed (as both tests were scored: a perfect
 * inactive list, which the live model never has). The data are cut to seasons up to 2026 by props_v2's cut2026.js
 * loader: no box score of 2026-27 is opened. The lines are graded as tools/props.js marketTest grades them (a player
 * who did not play is void, one with no game on record has no call, a push drops out); the 2023-24 set takes, as the
 * test did, the regular season from 24 October 2023 to 14 April 2024, the six base stats, both prices present. Its
 * last_updated column is never read.
 *
 * Every regression is fitted on the lines it describes and says so: a measurement of where these frozen models lose,
 * not a correction, a choice or a candidate. The blocks are those of why_trial.js (reproduce, sureness, where, parts,
 * beyond, minutes), with the season's months for the lean (byMonth, lean) and the roles where minutes are least known
 * (roles). That the 2023-24 prices are pre-game is inferred, not shown (research/props_v2/README.md, "The 2023-24 test:
 * the result"): a small share read early in their games could only flatter DraftKings.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const T = require('./why_lib.js');
const { PM, F, csv, mean, ll, logit } = T;
const C = require(path.join(T.ROOT, 'research', 'props_v2', 'cand_fix_lib.js'));
const V2R = path.join(T.ROOT, 'research', 'props_v2', 'results');
const CACHE24 = path.join(T.ROOT, 'research', 'props_v2', 'cache', 'props40_2024.csv');
const NB = +process.env.WHY_BOOT || 1000;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const want = process.argv.slice(2).filter(a => !a.startsWith('-'));
const SETS = want.length ? want : ['archive', '2024'];

/* ---------- the world: seasons up to 2026, the replay with props_v2's extras (who missed games, new clubs) ---------- */
const Dd = C.loadData();
const R = C.replayX(Dd.games, Dd.boxes, Dd.tbox, { collect: true, from: PM.FIRST + 1 });
if (R.rows.some(r => r.season > C.LAST)) throw new Error('a row after 2026');
const rows = R.rows, sides = C.sidesOf(rows);
const gameOf = new Map(Dd.games.map(g => [g.game_id, g]));
const foldP = readJSON(path.join(V2R, 'fold_params.json')), AS = readJSON(path.join(V2R, 'cand_fix_score.json'));
log(`replay: ${rows.length} rows`);
/* the starter flag, from the box files themselves (the loader drops it) */
const starter = new Map();
for (const s of [2024, 2026]) for (const r of csv(path.join(T.ROOT, 'data', `box_${s}.csv`))) starter.set(r.game_id + '|' + r.player_id, +r.starter === 1);

/* the lines of each set, as their tests selected them */
function linesOf(set) {
  if (set === 'archive') {
    return csv(path.join(T.ROOT, 'data', 'props_2026.csv')).map(r => ({ game_id: r.game_id, player_id: r.player_id, stat: r.stat, line: +r.line, over: +r.over, under: +r.under }));
  }
  if (set === '2024') {
    if (!fs.existsSync(CACHE24)) throw new Error(`${path.relative(T.ROOT, CACHE24)} is not there: fetch it first (research/props_v2/fetch_dk40.js 2023-10-24 2024-04-30)`);
    const t = fs.readFileSync(CACHE24, 'utf8').split('\n').filter(Boolean);
    if (t.shift() !== 'game_id,player_id,stat,line,over,under,last_updated') throw new Error('props40_2024.csv: not fetch_dk40.js\'s columns');
    const seen = new Set(), out = [];
    for (const l of t) {
      const v = l.split(','), k = v[0] + '|' + v[1] + '|' + v[2];
      if (seen.has(k)) throw new Error('props40_2024.csv repeats a game, player and stat'); seen.add(k);
      const g = gameOf.get(v[0]);
      if (!g || g.type !== 'REG' || g.date < '2023-10-24' || g.date > '2024-04-14' || !PM.STATS.includes(v[2])) continue;
      const over = F.propAmerican(v[4]), under = F.propAmerican(v[5]);
      if (over == null || under == null || !Number.isFinite(+v[3])) continue;
      out.push({ game_id: v[0], player_id: v[1], stat: v[2], line: +v[3], over, under });   // v[6], last_updated, is never read
    }
    return out;
  }
  throw new Error(`unknown set ${set}`);
}
/* graded as tools/props.js marketTest grades them; P and X a fold's constants (X {} is tools/props.js) */
function grade(rec, P, X) {
  const games = new Set(rec.map(r => r.game_id));
  const pr = C.projectX(rows, sides, P, X, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(rows[i].game + '|' + rows[i].id, { x, r: rows[i] });
  const played = new Set();
  for (const gid of games) for (const side of Object.values(Dd.boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
  const out = []; let voids = 0, noCall = 0, pushes = 0;
  for (const l of rec) {
    const k = l.game_id + '|' + l.player_id;
    if (!played.has(k)) { voids++; continue; }
    const a = at.get(k); if (!a) { noCall++; continue; }
    const mu = a.x.mu[l.stat], v = a.x.v[l.stat], y = PM.yOf(a.r.y, l.stat);
    if (y === l.line) { pushes++; continue; }
    const g = gameOf.get(l.game_id);
    out.push({ game: l.game_id, id: l.player_id, stat: l.stat, line: l.line, over: l.over, under: l.under, mu, v, sd: Math.sqrt(v), m: a.x.m, a: a.r.min, y,
      o: y > l.line ? 1 : 0, pModel: PM.pOver(l.line, mu, v), pMarket: F.propFairOver(l.over, l.under), date: g.date, month: g.date.slice(0, 7), type: g.type,
      ab: P.var[l.stat], mult: v / PM.nbVar(mu, P.var[l.stat]), nCur: a.r.f.nCur, missed: a.r.x ? a.r.x.missed : null, newTeam: a.r.x ? a.r.x.newTeam : null,
      teamN: a.r.x ? a.r.x.teamN : null, starter: starter.get(k) });
  }
  return { lines: out, voids, noCall, pushes };
}

/* ---------- the blocks ---------- */
const byGameSums = (L, f, g) => { const mm = new Map(); for (const x of L) { const v = mm.get(x.game) || [0, 0]; v[0] += f(x) - g(x); v[1]++; mm.set(x.game, v); } return [...mm.values()]; };
function reproduce(L) {
  const S = T.scoreLines(L);
  return { ...S, llDiffCi_toolsPropsBootCI: PM.bootCI(byGameSums(L, x => ll(x.pModel, x.o), x => ll(x.pMarket, x.o))),
    brDiffCi_toolsPropsBootCI: PM.bootCI(byGameSums(L, x => T.br(x.pModel, x.o), x => T.br(x.pMarket, x.o))) };
}
function sureness(L, stats) {
  const row = sub => ({ lines: sub.length, modelFrom50: mean(sub.map(x => Math.abs(x.pModel - 0.5))), marketFrom50: mean(sub.map(x => Math.abs(x.pMarket - 0.5))),
    model: T.calib(sub, 'pModel', NB), market: T.calib(sub, 'pMarket', NB) });
  const out = { pooled: row(L), byStat: {} };
  for (const k of stats) { const s = L.filter(x => x.stat === k); if (s.length) out.byStat[k] = row(s); }
  return out;
}
function where(L) {
  const d = x => ll(x.pModel, x.o) - ll(x.pMarket, x.o), tot = T.sum(L.map(d)), dis = x => x.pModel - x.pMarket;
  const g = (label, f) => { const s = L.filter(f); return { label, lines: s.length, share: s.length / L.length, gapShare: T.sum(s.map(d)) / tot, llDiff: mean(s.map(d)), overHit: mean(s.map(x => x.o)), modelSaid: mean(s.map(x => x.pModel)), marketSaid: mean(s.map(x => x.pMarket)) }; };
  return [g('DraftKings 10+ points above the model', x => dis(x) <= -0.10), g('DraftKings 5 to 10 above', x => dis(x) > -0.10 && dis(x) <= -0.05), g('within 5', x => Math.abs(dis(x)) < 0.05),
    g('model 5 to 10 above', x => dis(x) >= 0.05 && dis(x) < 0.10), g('model 10+ above', x => dis(x) >= 0.10), g('apart by 10 points or more, either way', x => Math.abs(dis(x)) >= 0.10)];
}
function parts(sub) {
  const rm = T.recal(sub, 'pModel'), rq = T.recal(sub, 'pMarket'), gap = rm.raw - rq.raw;
  const lean = ((rm.raw - rm.shiftOnly) + (rm.slopeOnly - rm.both)) / 2, sure = ((rm.raw - rm.slopeOnly) + (rm.shiftOnly - rm.both)) / 2;
  return { lines: sub.length, gap, leanPart: lean, overSurePart: sure, informationPart: rm.both - rq.raw, recalibratedSlope: rm.bothCoef[1], marketOwnRecal: rq.raw - rq.both,
    shares: { lean: lean / gap, overSure: sure / gap, information: (rm.both - rq.raw) / gap } };
}
function partsAll(L, stats) { const out = { pooled: parts(L), byStat: {} }; for (const k of stats) { const s = L.filter(x => x.stat === k); if (s.length) out.byStat[k] = parts(s); } return out; }
function beyond(L, stats) { const out = { pooled: T.infoBeyond(L, 'pModel', NB), byStat: {} }; for (const k of stats) { const s = L.filter(x => x.stat === k); if (s.length) out.byStat[k] = T.infoBeyond(s, 'pModel', NB); } return out; }
/* minutes against production per minute, as why_trial.js: DraftKings' price read as a mean on the forecaster's own
   distribution, its disagreement with the forecaster's mean against what happened, split exactly into minutes and rate */
function minutes(L, stats) {
  for (const x of L) {
    x.muDK = T.impliedMean(x.line, x.pMarket, x.ab, x.mult);
    x.delta = (x.muDK - x.mu) / x.sd; x.eTot = (x.y - x.mu) / x.sd;
    x.eMin = x.m > 0 ? x.mu * (x.a / x.m - 1) / x.sd : 0; x.eRate = x.eTot - x.eMin;
  }
  const D = L.map(x => x.delta), ET = L.map(x => x.eTot), EM = L.map(x => x.eMin), ER = L.map(x => x.eRate);
  const split = (f, seed = 0) => {
    const ix = L.map((x, i) => (f(x) ? i : -1)).filter(i => i >= 0); if (ix.length < 50) return null;
    const groups = T.groupBy(ix.map(i => L[i]), x => x.game).map(g => g.map(j => ix[j]));
    const bt = T.olsSlope(ix, D, ET), bm = T.olsSlope(ix, D, EM);
    return { lines: ix.length, slopeTotal: bt, slopeTotalCi: T.clusterBoot(groups, iz => T.olsSlope(iz, D, ET), NB, seed + 7), slopeMinutes: bm, slopeRate: T.olsSlope(ix, D, ER), minutesShare: bm / bt,
      minutesShareCi: T.clusterBoot(groups, iz => T.olsSlope(iz, D, EM) / T.olsSlope(iz, D, ET), NB, seed) };
  };
  const out = { pooled: split(() => true), byStat: {}, starters: split(x => x.starter === true), bench: split(x => x.starter === false),
    firstGameOfSeason: split(x => x.nCur === 0), backFrom3PlusMissed: split(x => x.missed != null && x.missed >= 3), newClubFirst10: split(x => x.newTeam != null && x.newTeam < 10),
    regular: split(x => x.nCur > 0 && !(x.missed >= 3) && !(x.newTeam != null && x.newTeam < 10)) };
  for (const k of stats) out.byStat[k] = split(x => x.stat === k);
  const grp = f => { const s = L.filter(f); return { lines: s.length, minutesSaid: mean(s.map(x => x.m)), minutesPlayed: mean(s.map(x => x.a)) }; };
  out.disagreementGroups = { modelHigher10: grp(x => x.pModel - x.pMarket >= 0.10), dkHigher10: grp(x => x.pMarket - x.pModel >= 0.10), within5: grp(x => Math.abs(x.pModel - x.pMarket) < 0.05) };
  out.minutesSaidPlayed = { said: mean(L.map(x => x.m)), played: mean(L.map(x => x.a)), mae: mean(L.map(x => Math.abs(x.a - x.m))) };
  /* hindsight, for scale only: the same lines priced on the minutes he went on to play (an upper bound no pre-game
     forecast reaches: the minutes carry the game's own blowouts, fouls and injuries) */
  const pH = L.map(x => { if (!(x.m > 0)) return x.pModel; const mu = x.mu * x.a / x.m; return PM.pOver(x.line, Math.max(mu, 1e-3), PM.nbVar(Math.max(mu, 1e-3), x.ab) * x.mult); });
  out.hindsightMinutes = { llDiff: mean(L.map((x, i) => ll(pH[i], x.o) - ll(x.pMarket, x.o))) };
  return out;
}
/* the lean, month by month: what the forecaster said, what happened, DraftKings, the gap, and what a perfect in-sample
   removal of each month's own lean (a shift in logit) would gain */
function byMonth(L, stats) {
  const months = [...new Set(L.map(x => x.month))].sort();
  const tot = T.sum(L.map(x => ll(x.pModel, x.o) - ll(x.pMarket, x.o)));
  const out = {};
  for (const mo of months) {
    const s = L.filter(x => x.month === mo), S = T.scoreLines(s, 2000, 0), rm = T.recal(s, 'pModel');
    out[mo] = { lines: s.length, games: S.games, overHit: S.overRate, modelSaid: S.modelSaid, marketSaid: S.marketSaid, llDiff: S.llDiff, llDiffCi: S.llDiffCi, brDiff: S.brDiff,
      meanMinusStat: mean(s.map(x => x.mu - x.y)), leanGain: rm.raw - rm.shiftOnly, leanGainShareOfSeasonGap: (rm.raw - rm.shiftOnly) * s.length / tot,
      calibSlope: rm.bothCoef[1], byStat: Object.fromEntries(stats.map(k => { const z = s.filter(x => x.stat === k); return [k, z.length ? { lines: z.length, llDiff: mean(z.map(x => ll(x.pModel, x.o) - ll(x.pMarket, x.o))) } : null]; })) };
  }
  return out;
}
function lean(L) {
  const months = [...new Set(L.map(x => x.month))].sort();
  const tot = T.sum(L.map(x => ll(x.pModel, x.o) - ll(x.pMarket, x.o)));
  /* one shift for the whole set, then a shift fitted month by month: each, at best, against the set's whole gap */
  const r1 = T.recal(L, 'pModel');
  let gainMonths = 0; for (const mo of months) { const s = L.filter(x => x.month === mo); const r = T.recal(s, 'pModel'); gainMonths += (r.raw - r.shiftOnly) * s.length; }
  /* the season's first two months, where a set starts in October (the regular season); none for the playoff archive */
  const first = months[0], early = first.endsWith('-10') ? L.filter(x => x.month === first || x.month === first.slice(0, 5) + '11') : [];
  const re = early.length ? T.recal(early, 'pModel') : null;
  return { overSaid: mean(L.map(x => x.pModel)), overHit: mean(L.map(x => x.o)), overDK: mean(L.map(x => x.pMarket)), meanMinusStat: mean(L.map(x => x.mu - x.y)),
    oneShift: { gain: r1.raw - r1.shiftOnly, shareOfGap: (r1.raw - r1.shiftOnly) * L.length / tot },
    shiftEachMonth: { gain: gainMonths / L.length, shareOfGap: gainMonths / tot },
    octNov: re ? { lines: early.length, overSaid: mean(early.map(x => x.pModel)), overHit: mean(early.map(x => x.o)), gain: re.raw - re.shiftOnly, shareOfSeasonGap: (re.raw - re.shiftOnly) * early.length / tot } : null };
}
function roles(L) {
  const g = (label, f) => { const s = L.filter(f); if (s.length < 50) return { label, lines: s.length }; const S = T.scoreLines(s, 2000, 0); return { label, lines: s.length, llDiff: S.llDiff, llDiffCi: S.llDiffCi, modelSaid: S.modelSaid, overHit: S.overRate, marketSaid: S.marketSaid, minutesSaid: mean(s.map(x => x.m)), minutesPlayed: mean(s.map(x => x.a)) }; };
  return [g('his first game of the season', x => x.nCur === 0), g('back after missing 3+ of his club\'s games', x => x.missed != null && x.missed >= 3), g('his first 10 games for a new club', x => x.newTeam != null && x.newTeam < 10),
    g('started', x => x.starter === true), g('off the bench', x => x.starter === false), g('projected under 20 minutes', x => x.m < 20), g('projected 20 to 30', x => x.m >= 20 && x.m < 30), g('projected 30 to 34', x => x.m >= 30 && x.m < 34), g('projected 34+', x => x.m >= 34)];
}

/* ---------- each set ---------- */
for (const set of SETS) {
  const rec = linesOf(set);
  const P = set === 'archive' ? { props: foldP['2026'], A: AS.folds['2026'] } : { props: foldP['2024'], A: AS.folds['2024'] };
  const stats = set === 'archive' ? PM.ALL : PM.STATS;
  const gp = grade(rec, P.props, {}), ga = grade(rec, P.A.P, P.A.X);
  const L = gp.lines, LA = ga.lines;
  log(`${set}: ${rec.length} rows, ${L.length} graded lines on ${new Set(L.map(x => x.game)).size} games (void ${gp.voids}, no call ${gp.noCall}, pushes ${gp.pushes}); A ${LA.length}`);
  const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', set,
    what: `research/props_v3/why_lines.js ${set}: where tools/props.js (and candidate A) lose to DraftKings on ${set === 'archive' ? 'the 2026 play-in and playoff archive (spent: development only)' : 'DraftKings\' 2023-24 regular-season lines (development data: scored once against A on 6 November 2026)'}; diagnosis only, nothing fitted here is a candidate`,
    folds: set === 'archive' ? 'tools/props.js 2026 fold (fitted on 2023-2025); A 2026 fold' : 'tools/props.js 2024 fold (fitted on 2022-23); A 2024 fold (fitted on 2023)',
    boot: { gap: 10000, regressions: NB, seed: 0 }, counts: { rows: rec.length, graded: L.length, voids: gp.voids, noCall: gp.noCall, pushes: gp.pushes, gradedA: LA.length },
    toolsProps: { reproduce: reproduce(L) }, A: { reproduce: reproduce(LA) } };
  log(`  tools/props.js ${out.toolsProps.reproduce.llDiff.toFixed(4)} ${out.toolsProps.reproduce.llDiffCi_toolsPropsBootCI}; A ${out.A.reproduce.llDiff.toFixed(4)} ${out.A.reproduce.llDiffCi_toolsPropsBootCI}`);
  out.toolsProps.byStat = Object.fromEntries(stats.map(k => [k, T.scoreLines(L.filter(x => x.stat === k), 10000, 0)]));
  out.A.byStat = Object.fromEntries(stats.map(k => { const s = T.scoreLines(LA.filter(x => x.stat === k), 10000, 0); return [k, s && { lines: s.lines, llDiff: s.llDiff, llDiffCi: s.llDiffCi, brDiff: s.brDiff }]; }));
  out.toolsProps.sureness = sureness(L, stats); log(`  calibration slope ${out.toolsProps.sureness.pooled.model.slope.toFixed(3)} (DK ${out.toolsProps.sureness.pooled.market.slope.toFixed(3)})`);
  out.A.sureness = { pooled: { modelFrom50: mean(LA.map(x => Math.abs(x.pModel - 0.5))), model: T.calib(LA, 'pModel', NB) } };
  out.toolsProps.where = where(L); out.A.where = where(LA);
  out.toolsProps.parts = partsAll(L, stats); out.A.parts = { pooled: parts(LA) };
  log(`  parts: lean ${out.toolsProps.parts.pooled.leanPart.toFixed(4)}, over-sure ${out.toolsProps.parts.pooled.overSurePart.toFixed(4)}, information ${out.toolsProps.parts.pooled.informationPart.toFixed(4)}`);
  out.toolsProps.beyond = beyond(L, stats); out.A.beyond = { pooled: T.infoBeyond(LA, 'pModel', NB) };
  log(`  w ${out.toolsProps.beyond.pooled.w.toFixed(3)} ${out.toolsProps.beyond.pooled.wCi.map(v => v.toFixed(3))}; A ${out.A.beyond.pooled.w.toFixed(3)}`);
  out.toolsProps.minutes = minutes(L, stats);
  log(`  minutes share ${(100 * out.toolsProps.minutes.pooled.minutesShare).toFixed(1)}% ${out.toolsProps.minutes.pooled.minutesShareCi.map(v => (100 * v).toFixed(1))} (slope ${out.toolsProps.minutes.pooled.slopeTotal.toFixed(3)})`);
  out.toolsProps.byMonth = byMonth(L, stats); out.toolsProps.lean = lean(L); out.toolsProps.roles = roles(L);
  out.A.byMonth = Object.fromEntries(Object.entries(byMonth(LA, stats)).map(([k, v]) => [k, { lines: v.lines, llDiff: v.llDiff, llDiffCi: v.llDiffCi }]));
  log(`  lean: one shift ${(100 * out.toolsProps.lean.oneShift.shareOfGap).toFixed(1)}% of the gap, each month ${(100 * out.toolsProps.lean.shiftEachMonth.shareOfGap).toFixed(1)}%`);
  out.seconds = Math.round((Date.now() - t0) / 1000);
  const file = path.join(__dirname, 'results', `why_lines_${set}.json`);
  fs.writeFileSync(file, JSON.stringify(out, (k, v) => (typeof v === 'number' ? +v.toPrecision(7) : v), 1) + '\n');
  log(`wrote ${path.relative(T.ROOT, file)}`);
}
