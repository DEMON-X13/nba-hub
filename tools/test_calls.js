/* The calls ledger (tools/calls.js) and its check (tools/calls_check.js) on made-up games and model files.
 *
 *   node tools/test_calls.js
 */
'use strict';
const { build } = require('./calls');
const { check } = require('./calls_check');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };

const G = (id, date, tip, status, type = 'REG', season = 2027) => { const [, , away, home] = id.split('_'); return { game_id: id, season: String(season), date, type, away, home, status, tip }; };
let games = [
  G('2027_20261020_BOS_DET', '2026-10-20', '2026-10-20T23:00Z', 'final'),
  G('2027_20261021_LAL_GSW', '2026-10-21', '2026-10-22T02:00Z', 'final'),
  G('2027_20261022_NYK_MIA', '2026-10-22', '2026-10-22T23:30Z', 'scheduled'),
  G('2027_20261023_OKC_SAS', '2026-10-23', '2026-10-24T00:30Z', 'scheduled'),
  G('2027_20261019_PHX_POR', '2026-10-19', '2026-10-20T02:00Z', 'final', 'PRE'),
];
const model = (games, upcoming, status) => ({ games, upcoming, status: status || { ok: true } });
const replay = { '2027_20261020_BOS_DET': { pHome: 0.62 }, '2027_20261021_LAL_GSW': { pHome: 0.41 }, '2027_20261019_PHX_POR': { pHome: 0.5 } };

console.log('first run: the played games get backtest calls, the games to come published ones');
const t1 = '2026-10-22T15:00Z';
const m1 = { alpha: model(replay, { '2027_20261022_NYK_MIA': { pHome: 0.555 }, '2027_20261023_OKC_SAS': { pHome: 0.48 } }) };
let d1 = build(null, games, m1, t1);
const a1 = d1.calls.alpha;
ok(d1.season === 2027, 'the season in play');
ok(a1['2027_20261020_BOS_DET'].src === 'backtest' && a1['2027_20261020_BOS_DET'].pick === 'DET' && a1['2027_20261021_LAL_GSW'].pick === 'LAL', 'the two finals: backtest calls from the replay, the pick the side the chance favours');
ok(!a1['2027_20261019_PHX_POR'], 'a preseason game gets no call');
ok(a1['2027_20261022_NYK_MIA'].src === 'published' && a1['2027_20261022_NYK_MIA'].at === t1 && a1['2027_20261023_OKC_SAS'].pick === 'OKC', 'the games to come: published calls stamped this run');
ok(Object.keys(d1.calls.joker).length === 0 && Object.keys(d1.calls.elo).length === 0, 'a model with no file calls nothing');
ok(check(d1, null, games, t1).length === 0, 'the check passes a first file');

console.log('a quiet run writes nothing new; a moved chance restamps; a tip freezes');
const t2 = '2026-10-22T18:00Z';
let d2 = build(d1, games, m1, t2);
ok(JSON.stringify(d2) === JSON.stringify(d1), 'the same numbers keep their stamps');
const m2 = { alpha: model(replay, { '2027_20261022_NYK_MIA': { pHome: 0.6 }, '2027_20261023_OKC_SAS': { pHome: 0.48 } }) };
d2 = build(d1, games, m2, t2);
ok(d2.calls.alpha['2027_20261022_NYK_MIA'].at === t2 && d2.calls.alpha['2027_20261022_NYK_MIA'].pHome === 0.6 && d2.calls.alpha['2027_20261023_OKC_SAS'].at === t1, 'a moved chance is restamped, an unchanged one is not');
const t3 = '2026-10-23T01:00Z';                                   // NYK at MIA has tipped (by its tip time, still 'scheduled')
const m3 = { alpha: model(replay, { '2027_20261022_NYK_MIA': { pHome: 0.3 }, '2027_20261023_OKC_SAS': { pHome: 0.52 } }) };
let d3 = build(d2, games, m3, t3);
ok(d3.calls.alpha['2027_20261022_NYK_MIA'].pHome === 0.6 && d3.calls.alpha['2027_20261022_NYK_MIA'].at === t2, 'a game past its tip keeps the call made before it, whatever the model says now');
ok(d3.calls.alpha['2027_20261023_OKC_SAS'].pick === 'SAS' && d3.calls.alpha['2027_20261023_OKC_SAS'].at === t3, 'a game still to tip takes the new call');
ok(check(d3, d2, games, t3).length === 0, 'the check passes the run against the last one');

console.log('a model that cannot run keeps what it had; a new model backfills only the games before its first call');
const d4 = build(d3, games, { alpha: model({}, {}, { ok: false, why: 'no box scores' }), joker: model(replay, { '2027_20261023_OKC_SAS': { pHome: 0.44 } }) }, t3);
ok(JSON.stringify(d4.calls.alpha) === JSON.stringify(d3.calls.alpha), 'alpha, failing, keeps every call it had');
ok(d4.calls.joker['2027_20261020_BOS_DET'].src === 'backtest' && d4.calls.joker['2027_20261023_OKC_SAS'].src === 'published', 'the joker, new, gets backtest calls on the finals and a published one on the game to come');
ok(!d4.calls.joker['2027_20261022_NYK_MIA'], 'no replay row for a game: no call');
games = games.map(g => g.game_id === '2027_20261023_OKC_SAS' ? { ...g, status: 'final' } : g);
games.push(G('2027_20261024_BOS_NYK', '2026-10-24', '2026-10-24T23:30Z', 'final'));
const replay2 = { ...replay, '2027_20261024_BOS_NYK': { pHome: 0.7 } };
const d5 = build(d4, games, { alpha: model(replay2, {}), joker: model(replay2, {}) }, '2026-10-25T12:00Z');
ok(!d5.calls.alpha['2027_20261024_BOS_NYK'] && !d5.calls.joker['2027_20261024_BOS_NYK'], 'a game played after the model began publishing, with no call made before it, gets none afterwards');
ok(d5.calls.alpha['2027_20261023_OKC_SAS'].at === t3, 'the final keeps its frozen call');

console.log('the check refuses a moved, dropped, late or misplaced call');
const bad = JSON.parse(JSON.stringify(d5));
bad.calls.alpha['2027_20261023_OKC_SAS'].pHome = 0.4; bad.calls.alpha['2027_20261023_OKC_SAS'].pick = 'OKC';
ok(check(bad, d5, games, '2026-10-25T12:00Z').some(m => /moved/.test(m)), 'a frozen call that moved');
const bad2 = JSON.parse(JSON.stringify(d5)); delete bad2.calls.alpha['2027_20261020_BOS_DET'];
ok(check(bad2, d5, games, '2026-10-25T12:00Z').some(m => /dropped/.test(m)), 'a frozen call dropped');
const bad3 = JSON.parse(JSON.stringify(d5)); bad3.calls.elo['2027_20261024_BOS_NYK'] = { pick: 'NYK', pHome: 0.7, at: '2026-10-25T00:00Z', src: 'published' };
ok(check(bad3, d5, games, '2026-10-25T12:00Z').some(m => /at or after its tip/.test(m)), 'a published call logged after its tip');
const bad4 = JSON.parse(JSON.stringify(d5)); bad4.calls.joker['2027_20261024_BOS_NYK'] = { pick: 'NYK', pHome: 0.7, at: '2026-10-25T12:00Z', src: 'backtest' };
ok(check(bad4, d5, games, '2026-10-25T12:00Z').some(m => /after joker's first published/.test(m)), 'a backtest call on a game played after the model began publishing');
const bad5 = JSON.parse(JSON.stringify(d5)); bad5.calls.alpha['2027_20261020_BOS_DET'].pick = 'BOS';
ok(check(bad5, d5, games, '2026-10-25T12:00Z').some(m => /favours/.test(m)), 'a pick that is not the side its chance favours');
const bad6 = JSON.parse(JSON.stringify(d5)); bad6.calls.alpha['2027_20261019_PHX_POR'] = { pick: 'POR', pHome: 0.5, at: 'x', src: 'backtest' };
ok(check(bad6, d5, games, '2026-10-25T12:00Z').some(m => /not a REG or POST/.test(m)), 'a call on a preseason game');
ok(check(d5, d4, games, '2026-10-25T12:00Z').length === 0, 'the real run passes');

console.log('a new season starts a new ledger');
const g7 = [...games, G('2028_20271019_BOS_DET', '2027-10-19', '2027-10-19T23:00Z', 'scheduled', 'REG', 2028)];
const d7 = build(d5, g7, { alpha: model({}, { '2028_20271019_BOS_DET': { pHome: 0.5 } }) }, '2027-10-12T12:00Z');
ok(d7.season === 2028 && Object.keys(d7.calls.alpha).length === 1, 'last season\'s calls are not carried into the new one');

console.log(fails ? `${fails} FAILED` : 'all good');
process.exit(fails ? 1 : 0);
