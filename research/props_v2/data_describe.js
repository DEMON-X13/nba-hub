/* What a second props model could be built and tested on: data/props_2026.csv described, and how much a test inside it
 * can tell.
 *
 *   node research/props_v2/data_describe.js        writes results/data_describe.json and prints the tables data.md quotes
 *
 * Seasons 2022-2026 only, as diag_history.js reads them (cut2026.js: games.csv's rows after 2026 are dropped, only the
 * box files of seasons up to 2026 are opened, and the box scores and team boxes are cut to the games kept). Nothing is
 * fitted. The one model used is the walk-forward's 2026 fold (constants fitted on 2023-2025, read from
 * research/props.json, not refitted), the model the README's archive test scored, so the archive's lines are graded exactly as `node tools/props.js research` grades them and the totals are
 * checked against the published ones before anything else is printed.
 *
 * What it measures, and what it does not:
 *   - the archive itself: games read and not, rounds and series (from the box's team pairs: a POST game's series is its
 *     two clubs, its round the clubs' how-many-th series; play-in games are the REG games from 14 April 2026), lines per
 *     game, stat, player and player-game, the line values and whole-number lines, the prices' margins, voids, pushes,
 *     and how often each stat's Over landed
 *   - the dispersion of a score difference (log loss and Brier, a candidate minus DraftKings' fair chance) clustered by
 *     line, player-game, player, game, series and round, which is what sets how small a difference a 90% interval can
 *     tell from zero; for the walk-forward model and for blends that move a share w of the way from DraftKings' fair
 *     chance toward the model, in logit. ONLY THE SPREAD of each blend's difference is reported, never its mean: a blend
 *     is a candidate, and the archive must stay usable as a one-shot check of a candidate written down first
 *   - the flat bets' standard error, from the walk-forward model's 3-point-edge bets on the archive (the README's numbers)
 *   - the cross-validation folds the archive allows (leave one round out, leave one series out) and how much a player
 *     reaches across them
 * data/props_2027.csv (this season, the trial's) is counted only (rows, games, stats): no outcome or model is read from it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const REC = require('../../tools/props_record.js');
const F = require('../../tools/props_feed.js');

const ROOT = path.join(__dirname, '..', '..');
const OUTD = path.join(__dirname, 'results');
const LAST = 2026;
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r3 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e3) / 1e3;
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const r1 = x => x == null || !isFinite(x) ? null : Math.round(x * 10) / 10;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const countBy = (a, f) => { const m = {}; for (const x of a) { const k = f(x); m[k] = (m[k] || 0) + 1; } return m; };

/* ---------- 1. the data, cut to 2022-2026 ---------- */
/* cut2026.js: only the box files of seasons up to 2026 are opened; its guard sees their raw rows */
const { games, boxes, tbox } = require('./cut2026.js').loadTo2026();
const gameOf = Object.fromEntries(games.map(g => [g.game_id, g]));

/* ---------- 2. the archive: rounds and series ---------- */
const rec = REC.readRecord(2026);
const reads = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'props_reads.json'), 'utf8'));
const asked = Object.entries(reads).filter(([k]) => k.startsWith('2026_'));
const post = games.filter(g => g.season === 2026 && g.type === 'POST').sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const playIn = games.filter(g => g.season === 2026 && g.type === 'REG' && g.date >= '2026-04-14');
const lastReg = games.filter(g => g.season === 2026 && g.type === 'REG' && g.date < '2026-04-14').map(g => g.date).sort().pop();
const seriesOf = {}, roundOf = {}, seriesStart = {}, nth = {};
for (const g of post) {
  const key = [g.away, g.home].sort().join('-');
  if (!(key in seriesStart)) {
    seriesStart[key] = g.date;
    const ra = (nth[g.away] || 0) + 1, rh = (nth[g.home] || 0) + 1;
    if (ra !== rh) throw new Error(`series ${key}: the clubs disagree on the round (${ra}, ${rh})`);
    nth[g.away] = ra; nth[g.home] = rh;
    seriesStart[key + ':round'] = ra;
  }
  seriesOf[g.game_id] = key; roundOf[g.game_id] = seriesStart[key + ':round'];
}
for (const g of playIn) { seriesOf[g.game_id] = 'play-in ' + [g.away, g.home].join('@'); roundOf[g.game_id] = 0; }
const ROUND = ['play-in', 'first round', 'second round', 'conference finals', 'finals'];
for (const g of [...post, ...playIn]) if (!(g.game_id in reads)) throw new Error(`${g.game_id} was never asked for`);
if (rec.some(l => !(l.game_id in roundOf))) throw new Error('a line on a game outside the play-in and playoffs');

/* ---------- 3. who played, from the box scores; the 2026 fold's projections ---------- */
const box = {};       // game|player -> { min, y, team, starter, dnp }
for (const gid of new Set(rec.map(l => l.game_id))) for (const [team, rows] of Object.entries(boxes[gid] || {})) for (const r of rows) box[gid + '|' + r.id] = { ...r, team };
/* the starter flag, which loadBoxes does not keep: from box_2026.csv itself */
{ const lines = fs.readFileSync(path.join(ROOT, 'data', 'box_2026.csv'), 'utf8').trim().split('\n'); const h = lines.shift().split(',');
  const gi = h.indexOf('game_id'), pi = h.indexOf('player_id'), si = h.indexOf('starter');
  for (const l of lines) { const v = l.split(','); const b = box[v[gi] + '|' + v[pi]]; if (b) b.starter = +v[si] === 1; } }
const research = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props.json'), 'utf8'));
const fold = research.folds.find(f => f.season === 2026);
const P = fold.params;
log(`replaying 2022-${LAST}: ${games.length} games`);
const R = PR.replay(games, boxes, tbox, { collect: true, from: PR.FIRST + 1 });
const recGames = new Set(rec.map(l => l.game_id));
const pr = PR.project(R.rows, P, r => recGames.has(r.game));
const at = new Map(); for (const [i, x] of pr) at.set(R.rows[i].game + '|' + R.rows[i].id, { x, r: R.rows[i] });

const all = [];       // every archived line with what became of it
for (const l of rec) {
  const k = l.game_id + '|' + l.player_id, b = box[k];
  const played = !!(b && b.min > 0 && !b.dnp);
  const a = at.get(k);
  const o = { game: l.game_id, series: seriesOf[l.game_id], round: roundOf[l.game_id], player: l.player_id, pg: k, stat: l.stat, line: l.line, over: l.over, under: l.under,
    status: !b ? 'not on the box' : !played ? 'listed, did not play' : !a ? 'played, no projection' : 'graded', min: b ? b.min : null, starter: b ? +b.starter : null, team: b ? b.team : null };
  if (o.status === 'graded') {
    const y = PR.yOf(a.r.y, l.stat), g = PR.gradeLine(l.line, l.over, l.under, a.x.mu[l.stat], P.var[l.stat], y);
    Object.assign(o, { y, mu: a.x.mu[l.stat], mProj: a.x.m, ...g });
    if (o.result === 'push') o.status = 'push';
  }
  all.push(o);
}
const graded = all.filter(x => x.status === 'graded');
const ll = (p, x) => x.result === 'over' ? -Math.log(clip(p)) : -Math.log(1 - clip(p));
const br = (p, x) => (p - (x.result === 'over' ? 1 : 0)) ** 2;
const llM = mean(graded.map(x => ll(x.pModel, x))), llQ = mean(graded.map(x => ll(x.pMarket, x)));
const pub = fold.market.all;
log(`graded ${graded.length} lines on ${new Set(graded.map(x => x.game)).size} games: log loss ${r4(llM)} / ${r4(llQ)} (published ${pub.logloss.model} / ${pub.logloss.market}, ${pub.lines} lines)`);
if (graded.length !== pub.lines || r4(llM) !== pub.logloss.model || r4(llQ) !== pub.logloss.market) throw new Error('the archive does not grade as research/props.json says: stop');

/* ---------- 4. description ---------- */
const D = {};
D.reads = { askedFor: asked.length, ok: asked.filter(([, v]) => v.status === 'ok').length, none: asked.filter(([, v]) => v.status === 'none').map(([k]) => ({ game: k, round: ROUND[roundOf[k]] })),
  readAt: [...new Set(asked.map(([, v]) => v.at))], lastRegularSeasonDate: lastReg };
const gamesIn = [...new Set(rec.map(l => l.game_id))];
D.games = { total: gamesIn.length, dates: [gamesIn.map(g => gameOf[g].date).sort()[0], gamesIn.map(g => gameOf[g].date).sort().pop()],
  byRound: ROUND.map((n, i) => { const gs = gamesIn.filter(g => roundOf[g] === i), sched = [...post, ...playIn].filter(g => roundOf[g.game_id] === i);
    const ds = gs.map(g => gameOf[g].date).sort();
    return { round: n, scheduled: sched.length, read: gs.length, series: new Set(sched.map(g => seriesOf[g.game_id])).size, lines: rec.filter(l => roundOf[l.game_id] === i).length, from: ds[0], to: ds[ds.length - 1] }; }),
  teams: [...new Set(gamesIn.flatMap(g => [gameOf[g].away, gameOf[g].home]))].length };
const perGame = gamesIn.map(g => rec.filter(l => l.game_id === g).length);
D.lines = { rows: rec.length, perGame: { min: Math.min(...perGame), median: quant(perGame, 0.5), max: Math.max(...perGame), mean: r1(mean(perGame)) },
  duplicates: rec.length - new Set(rec.map(l => l.game_id + '|' + l.player_id + '|' + l.stat)).size,
  wholeNumberLines: rec.filter(l => l.line % 1 === 0).length, status: countBy(all, x => x.status) };
const pgs = new Map(); for (const l of rec) { const k = l.game_id + '|' + l.player_id; pgs.set(k, (pgs.get(k) || 0) + 1); }
const players = new Set(rec.map(l => l.player_id));
const perPlayer = [...players].map(p => rec.filter(l => l.player_id === p).length);
const gamesPerPlayer = [...players].map(p => new Set(rec.filter(l => l.player_id === p).map(l => l.game_id)).size);
const lpg = [...pgs.values()];
D.players = { distinct: players.size, playerGames: pgs.size, playersPerGame: r1(pgs.size / gamesIn.length),
  linesPerPlayerGame: { min: Math.min(...lpg), median: quant(lpg, 0.5), max: Math.max(...lpg), mean: r2(mean(lpg)) },
  linesPerPlayer: { min: Math.min(...perPlayer), median: quant(perPlayer, 0.5), max: Math.max(...perPlayer) },
  gamesPerPlayer: { median: quant(gamesPerPlayer, 0.5), max: Math.max(...gamesPerPlayer), withOneGame: gamesPerPlayer.filter(n => n === 1).length },
  top10ShareOfLines: r3([...perPlayer].sort((a, b) => b - a).slice(0, 10).reduce((a, b) => a + b, 0) / rec.length),
  minutesOfGraded: { p10: quant(graded.map(x => x.min), 0.1), median: quant(graded.map(x => x.min), 0.5), p90: quant(graded.map(x => x.min), 0.9) },
  startersShareOfGraded: r3(mean(graded.map(x => x.starter))) };
D.byStat = PR.ALL.map(k => {
  const L = rec.filter(l => l.stat === k), G = graded.filter(x => x.stat === k);
  const marg = L.map(l => F.propImplied(l.over) + F.propImplied(l.under) - 1);
  return { stat: k, lines: L.length, players: new Set(L.map(l => l.player_id)).size, lineMin: Math.min(...L.map(l => l.line)), lineMedian: quant(L.map(l => l.line), 0.5), lineMax: Math.max(...L.map(l => l.line)),
    wholeNumber: L.filter(l => l.line % 1 === 0).length, marginMedian: r4(quant(marg, 0.5)), graded: G.length, overRate: r4(mean(G.map(x => x.result === 'over' ? 1 : 0))), dkFairOver: r4(mean(G.map(x => x.pMarket))),
    pushes: all.filter(x => x.stat === k && x.status === 'push').length };
});
const marg = rec.map(l => F.propImplied(l.over) + F.propImplied(l.under) - 1);
D.prices = { marginP10: r4(quant(marg, 0.1)), marginMedian: r4(quant(marg, 0.5)), marginP90: r4(quant(marg, 0.9)), overFavouredShare: r3(mean(rec.map(l => F.propImplied(l.over) > F.propImplied(l.under) ? 1 : 0))),
  priceRange: [Math.min(...rec.flatMap(l => [l.over, l.under])), Math.max(...rec.flatMap(l => [l.over, l.under]))] };
D.overall = { graded: graded.length, overRate: r4(mean(graded.map(x => x.result === 'over' ? 1 : 0))), dkFairOver: r4(mean(graded.map(x => x.pMarket))) };

/* ---------- 5. power: the dispersion of a difference in score, clustered ---------- */
/* a ratio estimator's standard error, sum(d)/n with clusters: sqrt(G/(G-1) x sum_g (S_g - n_g dbar)^2) / n */
function clusterSE(xs, d, key) {
  const m = new Map(); let S = 0, n = 0;
  xs.forEach((x, i) => { const k = key(x, i); const v = m.get(k) || [0, 0]; v[0] += d[i]; v[1]++; m.set(k, v); S += d[i]; n++; });
  const db = S / n, G = m.size; let ss = 0;
  for (const [s, c] of m.values()) ss += (s - c * db) ** 2;
  return { se: Math.sqrt(G / (G - 1) * ss) / n, clusters: G };
}
const logit = p => Math.log(clip(p) / (1 - clip(p))), sig = z => 1 / (1 + Math.exp(-z));
const KEYS = { line: (x, i) => i, 'player-game': x => x.pg, player: x => x.player, game: x => x.game, series: x => x.series, round: x => x.round };
const Z90 = 1.6449, Z80 = 0.8416;
function power(name, dLL, dBR, withMean) {
  const o = { candidate: name, logloss: {}, brier: {} };
  for (const [k, f] of Object.entries(KEYS)) { const a = clusterSE(graded, dLL, f), b = clusterSE(graded, dBR, f); o.logloss[k] = { se: r4(a.se), clusters: a.clusters }; o.brier[k] = { se: r4(b.se), clusters: b.clusters }; }
  /* the paired bootstrap the bar uses (tools/props.js bootCI: games resampled, seed 0): its half-width */
  const byG = new Map(), byGb = new Map(); graded.forEach((x, i) => { const v = byG.get(x.game) || [0, 0]; v[0] += dLL[i]; v[1]++; byG.set(x.game, v); const w = byGb.get(x.game) || [0, 0]; w[0] += dBR[i]; w[1]++; byGb.set(x.game, w); });
  const ci = PR.bootCI([...byG.values()]), cib = PR.bootCI([...byGb.values()]);
  o.logloss.bootHalfWidth = r4((ci[1] - ci[0]) / 2); o.brier.bootHalfWidth = r4((cib[1] - cib[0]) / 2);
  if (withMean) { o.logloss.diff = r4(mean(dLL)); o.logloss.ci90 = ci; o.brier.diff = r4(mean(dBR)); o.brier.ci90 = cib; }
  /* the smallest true difference whose 90% interval lands wholly on one side of 0 half the time, and 80% of the time */
  o.logloss.mde50 = r4(Z90 * o.logloss.game.se); o.logloss.mde80 = r4((Z90 + Z80) * o.logloss.game.se);
  o.brier.mde50 = r4(Z90 * o.brier.game.se); o.brier.mde80 = r4((Z90 + Z80) * o.brier.game.se);
  return o;
}
const dQ = graded.map(x => ll(x.pMarket, x)), bQ = graded.map(x => br(x.pMarket, x));
const POW = [];
POW.push(power('the walk-forward model (2026 fold) against DraftKings\' fair chance', graded.map((x, i) => ll(x.pModel, x) - dQ[i]), graded.map((x, i) => br(x.pModel, x) - bQ[i]), true));
for (const w of [0.5, 0.25, 0.1]) {
  const p = graded.map(x => sig(w * logit(x.pModel) + (1 - w) * logit(x.pMarket)));
  POW.push(power(`a blend w = ${w} of the way from DraftKings' fair chance to the model, in logit (spread only)`, graded.map((x, i) => ll(p[i], x) - dQ[i]), graded.map((x, i) => br(p[i], x) - bQ[i]), false));
}
/* the spread of the difference between two models that are both far from the market: the walk-forward model against a
   copy of itself with its means moved 3% (a stand-in for a second box-score model; spread only) */
{
  const p2 = graded.map(x => PR.pOver(x.line, x.mu * 1.03, PR.nbVar(x.mu * 1.03, P.var[x.stat])));
  POW.push(power('two box-score models a little apart (the model against itself with every mean x 1.03; spread only)', graded.map((x, i) => ll(p2[i], x) - ll(x.pModel, x)), graded.map((x, i) => br(p2[i], x) - br(x.pModel, x)), false));
}
/* the same model on the six base stats alone (what DraftKings' older answers on ESPN carry: data.md): the spread only.
   Its per-game standard error, and the per-line spread it implies, scale the power to a base-stats set of other sizes */
{
  const base = new Set(PR.STATS), idx = graded.map((x, i) => base.has(x.stat) ? i : -1).filter(i => i >= 0);
  const sub = idx.map(i => graded[i]);
  const dl = idx.map(i => ll(graded[i].pModel, graded[i]) - dQ[i]), db = idx.map(i => br(graded[i].pModel, graded[i]) - bQ[i]);
  const a = clusterSE(sub, dl, x => x.game), b = clusterSE(sub, db, x => x.game), l = clusterSE(sub, dl, (x, i) => i);
  D.baseStatsOnly = { lines: sub.length, games: a.clusters, llSeGame: r4(a.se), llSeLine: r4(l.se), brSeGame: r4(b.se), perLineSigmaEff: r3(a.se * Math.sqrt(sub.length)),
    llMde80At: [[1000, 80000], [2340, 184000]].map(([g, n]) => ({ games: g, lines: n, byGames: r4((Z90 + Z80) * a.se * Math.sqrt(a.clusters / g)), byLines: r4((Z90 + Z80) * a.se * Math.sqrt(sub.length / n)) })) };
}
/* how it scales: the standard error by games, from the archive's own per-game spread, and from the trial's published
   interval (the brief: 121 games, 12,298 lines, log loss difference +0.0184 [+0.0136, +0.0233]; Brier [+0.0060, +0.0105]) */
const seA = POW[0].logloss.game.se, seAb = POW[0].brier.game.se, nA = new Set(graded.map(x => x.game)).size;
const seT = (0.0233 - 0.0136) / 2 / Z90, seTb = (0.0105 - 0.0060) / 2 / Z90, nT = 121;
D.scale = [83, 121, 250, 300, 600, 1230].map(N => ({ games: N,
  llMde80Archive: r4((Z90 + Z80) * seA * Math.sqrt(nA / N)), llMde80Trial: r4((Z90 + Z80) * seT * Math.sqrt(nT / N)),
  brMde80Archive: r4((Z90 + Z80) * seAb * Math.sqrt(nA / N)), brMde80Trial: r4((Z90 + Z80) * seTb * Math.sqrt(nT / N)) }));
D.scaleNote = { archiveSeLL: r4(seA), archiveGames: nA, trialSeLL: r4(seT), trialGames: nT, trialSeBrier: r4(seTb) };

/* the flat bets at a 3-point edge (the bar's third test): their per-bet spread and the standard error of the return */
{
  const bets = [];
  for (const x of graded) {
    const eo = x.pModel - F.propImplied(x.over), eu = (1 - x.pModel) - F.propImplied(x.under);
    const side = eo >= 0.03 && eo >= eu ? 'over' : eu >= 0.03 ? 'under' : null;
    if (!side) continue;
    const price = side === 'over' ? x.over : x.under;
    bets.push({ game: x.game, side, u: x.result === side ? (price > 0 ? price / 100 : 100 / -price) : -1, fair: side === 'over' ? x.pMarket : 1 - x.pMarket, dec: price > 0 ? 1 + price / 100 : 1 + 100 / -price });
  }
  const u = bets.map(b => b.u), sdBet = Math.sqrt(mean(u.map(v => (v - mean(u)) ** 2)));
  const se = clusterSE(bets, u, b => b.game), seIid = sdBet / Math.sqrt(bets.length);
  /* what a bet with no edge over DraftKings' fair chance returns at its price: fair x decimal - 1 */
  const zeroEdge = mean(bets.map(b => b.fair * b.dec - 1));
  D.flat = { bets: bets.length, overs: bets.filter(b => b.side === 'over').length, units: r2(u.reduce((a, b) => a + b, 0)), roi: r4(mean(u)), sdPerBet: r3(sdBet),
    roiSeByGame: r4(se.se), roiSeIid: r4(seIid), designEffect: r2((se.se / seIid) ** 2),
    returnAtFairChance: r4(zeroEdge),
    pUpIfTrueRoi: [-0.04, -0.02, 0, 0.02].map(t => ({ trueRoi: t, at6000Bets: r3(normCdf(t / (se.se * Math.sqrt(bets.length / 6000)))) })) };
}
function normCdf(z) { return PR.normCdf(z); }

/* ---------- 6. cross-validation inside the archive ---------- */
const ser = [...new Set(graded.map(x => x.series))];
D.cv = {
  leaveOneRoundOut: ROUND.map((n, i) => ({ round: n, graded: graded.filter(x => x.round === i).length, games: new Set(graded.filter(x => x.round === i).map(x => x.game)).size })),
  leaveOneSeriesOut: ser.map(s => ({ series: s, round: ROUND[graded.find(x => x.series === s).round], graded: graded.filter(x => x.series === s).length, games: new Set(graded.filter(x => x.series === s).map(x => x.game)).size }))
    .sort((a, b) => ROUND.indexOf(a.round) - ROUND.indexOf(b.round) || a.series.localeCompare(b.series)),
};
/* how far a player reaches across folds: of a round's graded lines, the share on players with graded lines in another round */
D.cv.playerReach = ROUND.map((n, i) => { const inR = graded.filter(x => x.round === i); const other = new Set(graded.filter(x => x.round !== i).map(x => x.player));
  return { round: n, shareOnPlayersSeenElsewhere: inR.length ? r3(mean(inR.map(x => other.has(x.player) ? 1 : 0))) : null }; });
/* lines of one player-game move together: the mean correlation of (outcome - DraftKings' fair chance) between two lines of one
   player-game, and between the points line and each combo with points in it */
{
  const byPG = new Map(); for (const x of graded) { const a = byPG.get(x.pg) || []; a.push(x); byPG.set(x.pg, a); }
  const res = x => (x.result === 'over' ? 1 : 0) - x.pMarket;
  const v = mean(graded.map(x => res(x) ** 2));
  const pairCorr = (fa, fb) => { let s = 0, n = 0; for (const a of byPG.values()) for (const x of a) for (const y of a) if (x !== y && fa(x) && fb(y)) { s += res(x) * res(y); n++; } return n ? r3(s / n / v) : null; };
  D.cv.withinPlayerGame = { anyTwoLines: pairCorr(() => true, () => true), pointsAndPra: pairCorr(x => x.stat === 'pts', y => y.stat === 'pra'), pointsAndRebounds: pairCorr(x => x.stat === 'pts', y => y.stat === 'reb'),
    stealsAndBlocks: pairCorr(x => x.stat === 'stl', y => y.stat === 'blk') };
  /* the same player across games of one series, the points line: a run in a series is a cluster */
  const bySerPl = new Map(); for (const x of graded) if (x.stat === 'pts') { const k = x.series + '|' + x.player; const a = bySerPl.get(k) || []; a.push(x); bySerPl.set(k, a); }
  let s = 0, n = 0; for (const a of bySerPl.values()) for (const x of a) for (const y of a) if (x !== y) { s += res(x) * res(y); n++; }
  const vp = mean(graded.filter(x => x.stat === 'pts').map(x => res(x) ** 2));
  D.cv.samePlayerSeriesPoints = r3(s / n / vp);
}

/* ---------- 7. this season's record, counted only ---------- */
{
  const rec27 = REC.readRecord(2027);
  const g27 = new Set(rec27.map(l => l.game_id));
  D.season2027Counts = { rows: rec27.length, games: g27.size, rowsPerGame: r1(rec27.length / g27.size), byStatShare: Object.fromEntries(PR.ALL.map(k => [k, r3(rec27.filter(l => l.stat === k).length / rec27.length)])),
    archiveByStatShare: Object.fromEntries(PR.ALL.map(k => [k, r3(rec.filter(l => l.stat === k).length / rec.length)])),
    playersPerGame: r1(new Set(rec27.map(l => l.game_id + '|' + l.player_id)).size / g27.size) };
}

const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'data/props_2026.csv described, and how much a test inside it can tell (research/props_v2/data_describe.js)', describe: D, power: POW };
fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, 'data_describe.json'), JSON.stringify(out, null, 1) + '\n');
log('results/data_describe.json written');
console.log(JSON.stringify({ reads: D.reads, games: D.games, lines: D.lines, players: D.players, prices: D.prices, overall: D.overall }, null, 1));
console.table(D.byStat);
for (const p of POW) { console.log(p.candidate); console.table(Object.fromEntries(Object.entries(p.logloss).filter(([, v]) => v && v.se != null))); console.log(JSON.stringify({ ll: { boot: p.logloss.bootHalfWidth, mde50: p.logloss.mde50, mde80: p.logloss.mde80, diff: p.logloss.diff, ci: p.logloss.ci90 }, br: { gameSe: p.brier.game.se, boot: p.brier.bootHalfWidth, mde80: p.brier.mde80, diff: p.brier.diff, ci: p.brier.ci90 } })); }
console.table(D.scale); console.log(D.scaleNote);
console.log(JSON.stringify(D.flat, null, 1));
console.table(D.cv.leaveOneRoundOut); console.table(D.cv.leaveOneSeriesOut); console.table(D.cv.playerReach);
console.log(D.cv.withinPlayerGame, D.cv.samePlayerSeriesPoints);
console.log(JSON.stringify(D.season2027Counts, null, 1));
console.log(JSON.stringify(D.baseStatsOnly, null, 1));
