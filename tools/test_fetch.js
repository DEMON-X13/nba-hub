/* Tests for the daily pull's bookkeeping (tools/fetch.js), on made-up games and a stubbed ESPN: no network.
 *
 *   node tools/test_fetch.js        must end "all good"
 *
 * merge(): a game's line and moneylines are frozen at tip-off (a read during the game keeps the pre-game ones), a
 * read before tip with no line keeps the last one, a game first seen after tip gets none, and a moved tip-off keeps
 * updating. main(): a day with a game still to finish is read again, today included once one of today's games is
 * final; an answer with no games for a day the table has games on, from yesterday on, keeps the rows and counts as
 * a failed read (three of them and nothing else stops the run); an empty answer for a day two days past is taken.
 */
'use strict';
process.env.NBA_FETCH_PAUSE_MS = '0';
const L = require('./lib');
const F = require('./fetch');

let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const row = (o) => ({ game_id: '', season: 2027, date: '', type: 'REG', away: 'BOS', home: 'NYK', away_score: '', home_score: '', neutral: 0, status: 'scheduled',
  home_line: '', total: '', source: 'espn', espn_id: '1', tip: '', home_ml: '', away_ml: '', ...o });
const id = (date, a, h) => L.gameId(2027, date, a, h);

/* a scoreboard payload for one day, as ESPN shapes it, from rows */
function board(rows) {
  return { events: rows.map(r => ({ id: r.espn_id, date: r.tip.replace('Z', ':00Z'), season: { year: 2027, type: 2 },
    competitions: [{ neutralSite: false, status: { type: { name: r.status === 'final' ? 'STATUS_FINAL' : r.status === 'live' ? 'STATUS_IN_PROGRESS' : 'STATUS_SCHEDULED', completed: r.status === 'final' } },
      odds: r.home_line !== '' ? [{ details: `${r.home} ${r.home_line}`, overUnder: +r.total, moneyline: { home: { close: { odds: r.home_ml } }, away: { close: { odds: r.away_ml } } } }] : [],
      competitors: [{ homeAway: 'home', team: { abbreviation: r.home }, score: String(r.home_score) }, { homeAway: 'away', team: { abbreviation: r.away }, score: String(r.away_score) }] }] })) };
}

/* run main() at a fake clock over a fake table, ESPN answering from `feed` (date -> payload, or an Error) */
async function run(now, table, feed, to) {
  const real = { readGames: L.readGames, writeGames: L.writeGames, getJSON: L.getJSON, log: L.log, argv: process.argv };
  let written = null; const logs = [], asked = [];
  /* the real table always holds an earlier final, from which the run starts: one from the history, the day before */
  const anchor = row({ game_id: id('2026-10-19', 'DAL', 'HOU'), date: '2026-10-19', away: 'DAL', home: 'HOU', status: 'final', away_score: 100, home_score: 101, source: 'hist', espn_id: '' });
  L.readGames = () => [anchor, ...table].map(r => ({ ...r }));
  L.writeGames = rows => { written = rows; return true; };
  L.log = m => logs.push(m);
  L.getJSON = async url => { const d = url.slice(-8), iso = `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}`; asked.push(iso);
    const f = feed[iso]; if (f instanceof Error) throw f; return f || { events: [] }; };
  process.argv = ['node', 'fetch.js', '--to', to || L.etDate(now)];         // the stub ends at today (or `to`): no thirty days ahead
  let error = null;
  try { await F.main(now); } catch (e) { error = e; }
  Object.assign(L, { readGames: real.readGames, writeGames: real.writeGames, getJSON: real.getJSON, log: real.log }); process.argv = real.argv;
  return { written, logs, asked, error };
}

(async () => {
  console.log('1. merge: the market is frozen at tip-off');
  const D = '2026-10-21', g = id(D, 'BOS', 'NYK');
  const before = row({ game_id: g, date: D, tip: '2026-10-21T23:30Z', home_line: '-2.5', total: '220', home_ml: '-140', away_ml: '120' });
  const during = row({ game_id: g, date: D, tip: '2026-10-21T23:30Z', status: 'live', home_line: '-12.5', total: '231', home_ml: '-2000', away_ml: '1100' });
  let m = F.merge([before], D, [during], new Date('2026-10-22T00:30:00Z')).find(r => r.game_id === g);
  check(m.home_line === '-2.5' && m.total === '220' && m.home_ml === '-140' && m.away_ml === '120' && m.status === 'live', 'a read during the game keeps the pre-game line, total and moneylines');
  const tipped = { ...during, status: 'scheduled' };                        // ESPN still says scheduled, but the tip has passed
  m = F.merge([before], D, [tipped], new Date('2026-10-22T00:30:00Z')).find(r => r.game_id === g);
  check(m.home_line === '-2.5' && m.home_ml === '-140', 'so does a read past the tip time that ESPN still calls scheduled');
  const noLine = row({ game_id: g, date: D, tip: '2026-10-21T23:30Z' });
  m = F.merge([before], D, [noLine], new Date('2026-10-21T15:00:00Z')).find(r => r.game_id === g);
  check(m.home_line === '-2.5' && m.home_ml === '-140', 'a read before tip with no line keeps the last one');
  const moved = { ...before, tip: '2026-10-22T02:00Z', home_line: '-3.5', home_ml: '-150', away_ml: '130' };
  m = F.merge([before], D, [moved], new Date('2026-10-22T00:30:00Z')).find(r => r.game_id === g);
  check(m.home_line === '-3.5' && m.home_ml === '-150', 'a tip moved later keeps taking the new line');
  m = F.merge([], D, [during], new Date('2026-10-22T00:30:00Z')).find(r => r.game_id === g);
  check(m.home_line === '' && m.total === '' && m.home_ml === '' && m.away_ml === '', 'a game first seen after tip gets no line');

  console.log('2. main: today is read again after an afternoon final');
  const T = '2026-10-25', a = id(T, 'LAL', 'GSW'), b = id(T, 'BOS', 'NYK');
  const day = [row({ game_id: a, date: T, away: 'LAL', home: 'GSW', espn_id: '11', tip: '2026-10-25T19:00Z', status: 'final', away_score: 100, home_score: 110 }),
               row({ game_id: b, date: T, espn_id: '12', tip: '2026-10-25T23:30Z', home_line: '-2.5', total: '220', home_ml: '-140', away_ml: '120' })];
  const fresh = [day[0], { ...day[1], home_line: '-4.5', home_ml: '-180', away_ml: '155' }];
  let r = await run(new Date('2026-10-25T21:00:00Z'), day, { [T]: board(fresh) });
  check(r.asked.includes(T), 'the run asks for today although one of today\'s games is final');
  check(r.written && r.written.find(x => x.game_id === b).home_line === '-4.5', "tonight's game takes the new line");

  console.log('3. main: an empty answer for today keeps the slate');
  const tonight = [row({ game_id: b, date: T, espn_id: '12', tip: '2026-10-25T23:30Z', home_line: '-2.5', total: '220', home_ml: '-140', away_ml: '120' })];
  r = await run(new Date('2026-10-25T15:00:00Z'), tonight, { [T]: { events: [] } });
  check(!r.error, 'one empty day does not stop the run');
  check(r.written && r.written.some(x => x.game_id === b && x.home_line === '-2.5'), 'the game stays, with its line');
  check(r.logs.some(x => /answered with no games/.test(x)), 'and the log says the feed answered empty');
  const three = ['2026-10-23', '2026-10-24', T].map((d, i) => row({ game_id: id(d, 'BOS', 'NYK'), date: d, espn_id: String(20 + i), tip: d + 'T23:30Z' }));
  r = await run(new Date('2026-10-25T15:00:00Z'), three.slice(1), {});
  check(r.error === null || /no games/.test(String(r.error && r.error.message)), 'empty answers for yesterday and today alone do not throw on a short run');
  /* ESPN answering empty for everything: every day of the coming fortnight has games in the table */
  const ahead = Array.from({ length: 14 }, (_, i) => L.addDays('2026-10-26', i)).map((d, i) => row({ game_id: id(d, 'BOS', 'NYK'), date: d, espn_id: String(50 + i), tip: d + 'T23:30Z' }));
  r = await run(new Date('2026-10-26T15:00:00Z'), ahead, {}, '2026-11-08');
  check(r.error && /too many failed days/.test(r.error.message) && r.written === null, 'a feed answering empty across a fortnight of games stops the run before anything is written');

  console.log('4. main: an empty answer for a day long past is taken');
  const P = '2026-10-20', gone = row({ game_id: id(P, 'MIA', 'ORL'), date: P, away: 'MIA', home: 'ORL', espn_id: '40', tip: P + 'T23:00Z' });
  const live = row({ game_id: id('2026-10-23', 'BOS', 'NYK'), date: '2026-10-23', espn_id: '41', tip: '2026-10-23T23:30Z' });
  r = await run(new Date('2026-10-23T15:00:00Z'), [gone, live], { '2026-10-23': board([live]) });
  check(r.asked.includes(P), 'the past day with a game not final is read again');
  check(r.written && !r.written.some(x => x.game_id === gone.game_id), 'three days on, an empty answer drops it: the game was not played that day');

  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
