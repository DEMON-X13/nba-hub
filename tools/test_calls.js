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

/* what the calls feed besides the record: pickem.json (tools/publish.js pickemState), whose games run to today and
   whose next carries the three models' calls on the games after it for the matchup bubble; and off on the finals a
   club's record leaves out, as the standings do (offFinals) */
const PUB = require('./publish');
console.log("the Pick'em Record's file: the calls on the games after today, in next");
{ const P = (id, date, status, type = 'REG', season = 2027) => ({ ...G(id, date, date + 'T23:30Z', status, type, season), home_score: status === 'final' ? '101' : '', away_score: status === 'final' ? '99' : '', neutral: 0, home_ml: '', away_ml: '', home_line: '' });
  const gs = [P('2027_20261024_BOS_DET', '2026-10-24', 'final'), P('2027_20261025_LAL_GSW', '2026-10-25', 'scheduled'), P('2027_20261026_NYK_MIA', '2026-10-26', 'scheduled'),
    P('2027_20261030_OKC_SAS', '2026-10-30', 'scheduled'), P('2027_20261104_PHX_POR', '2026-11-04', 'scheduled'), P('2027_20261105_CHI_TOR', '2026-11-05', 'scheduled'),
    P('2027_20261026_ATL_ORL', '2026-10-26', 'scheduled', 'PRE')];
  const c = (pHome) => ({ pick: pHome >= 0.5 ? 'H' : 'A', pHome, at: '2026-10-25T12:00Z', src: 'published' });
  const calls = { alpha: { '2027_20261024_BOS_DET': c(0.6), '2027_20261025_LAL_GSW': c(0.4), '2027_20261026_NYK_MIA': c(0.55), '2027_20261104_PHX_POR': c(0.7), '2027_20261105_CHI_TOR': c(0.3), '2027_20261026_ATL_ORL': c(0.5) },
    joker: { '2027_20261026_NYK_MIA': c(0.45) }, elo: { '2027_20261026_NYK_MIA': c(0.62), '2027_20261104_PHX_POR': c(0.66) } };
  const pk = PUB.pickemState(gs, {}, 2027, '2026-10-25', calls);
  ok(JSON.stringify(pk.games.map(g => g.id)) === JSON.stringify(['2027_20261024_BOS_DET', '2027_20261025_LAL_GSW']) && pk.games[1].c.alpha === 0.4, 'its games run to today, today\'s with its call, as before');
  ok(JSON.stringify(pk.next) === JSON.stringify({ '2027_20261026_NYK_MIA': { alpha: 0.55, joker: 0.45, elo: 0.62 }, '2027_20261104_PHX_POR': { alpha: 0.7, elo: 0.66 } }),
    `next: each model's call on the games after today to ten days out, the slate's horizon; none for a game no model called, one past the horizon or a preseason game (${JSON.stringify(pk.next)})`);
  ok(!pk.games.some(g => g.off), 'no final of an ordinary week is left out of a record'); }

console.log("the finals a club's record leaves out: the NBA Cup final and the play-in");
{ /* four clubs, 82 rounds at home sites a day apart from 21 October, each club once a round; round 53 (13 December) the
     Cup's semifinals at a neutral site, A-D and B-C; rounds 45 and 48 (5 and 8 December) a two-game series abroad, A-B
     and C-D twice; then the Cup final, D-C on 16 December, and in April the play-in, A-C and then B-C, and one not
     played yet */
  const day = n => { const x = new Date('2025-10-21T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const pairs = [[['A', 'B'], ['C', 'D']], [['A', 'C'], ['B', 'D']], [['A', 'D'], ['B', 'C']]];
  const F = (a, h, date, neutral = 0, status = 'final') => ({ game_id: `2026_${date.replace(/-/g, '')}_${a}_${h}`, season: '2026', date, tip: date + 'T23:00Z', type: 'REG', away: a, home: h, status,
    away_score: status === 'final' ? '100' : '', home_score: status === 'final' ? '104' : '', neutral, home_ml: '', away_ml: '', home_line: '' });
  const gs = [];
  for (let r = 0; r < 82; r++) for (const [a, h] of pairs[r % 3]) gs.push(F(a, h, day(r), r === 53 || r === 45 || r === 48 ? 1 : 0));
  ok(day(53) === '2025-12-13' && day(45) === '2025-12-05' && day(48) === '2025-12-08' && pairs[53 % 3][0].join() === 'A,D' && pairs[45 % 3][0].join() === 'A,B' && pairs[48 % 3][0].join() === 'A,B', 'the made-up season falls as meant');
  const cupF = F('D', 'C', '2025-12-16', 1), pi1 = F('A', 'C', '2026-04-15'), pi2 = F('B', 'C', '2026-04-17'), pi3 = F('A', 'D', '2026-04-19', 0, 'scheduled');
  gs.push(cupF, pi1, pi2, pi3);
  const off = PUB.offFinals(gs, 2026);
  ok(JSON.stringify(off) === JSON.stringify({ [cupF.game_id]: 'cup', [pi1.game_id]: 'playin', [pi2.game_id]: 'playin' }),
    `the Cup final and the two play-in games, nothing else: not the semifinals, not the series abroad, not a club's last regular-season game, not a game still to play (${JSON.stringify(off)})`);
  const n = {}; for (const g of gs) if (g.status === 'final' && !off[g.game_id]) for (const t of [g.away, g.home]) n[t] = (n[t] || 0) + 1;
  ok(Object.values(n).every(v => v === 82) && Object.keys(n).length === 4, `every club's record is its 82 games (${JSON.stringify(n)})`);
  const lone = [...gs.filter(g => g !== cupF), F('D', 'C', '2025-12-19', 1)];
  ok(!PUB.offFinals(lone, 2026)[`2026_20251219_D_C`], 'a neutral-site December game whose clubs played their last neutral game more than four days before is not the Cup final');
  const pk = PUB.pickemState(gs, {}, 2026, '2026-04-18', {});
  const byId = Object.fromEntries(pk.games.map(g => [g.id, g]));
  ok(byId[cupF.game_id].off === 'cup' && byId[pi1.game_id].off === 'playin' && byId[pi2.game_id].off === 'playin' && pk.games.filter(g => g.off).length === 3 && !byId[pi3.game_id],
    "pickem.json marks them off on its games, and the record's games are otherwise as before"); }

console.log(fails ? `${fails} FAILED` : 'all good');
process.exit(fails ? 1 : 0);
