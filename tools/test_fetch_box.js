/* Tests for the injury report, rosters, coaches and box-score rows (tools/fetch_box.js), on a stubbed ESPN and a
 * scratch copy of the data folder: no network, and the real data is never written.
 *
 *   node tools/test_fetch_box.js        must end "all good"
 *
 * An injury answer with no list or under half the last report is refused and the last report stands; a club whose
 * roster answers short keeps its last good roster and coach; a team list short of 30 clubs writes nothing;
 * data/coaches.csv takes the season's coach on the first read and a dated row when ESPN names a new one; a box row
 * with no athlete id is left out and the game kept.
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-box-'));
const L = require('./lib');
for (const f of ['injuries.json', 'rosters_espn.json', 'coaches_espn.json', 'coaches.csv', 'injuries_log.csv']) fs.copyFileSync(path.join(L.ROOT, 'data', f), path.join(tmp, f));
process.env.NBA_DATA_DIR = tmp;
const B = require('./fetch_box');

let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const read = f => JSON.parse(fs.readFileSync(path.join(tmp, f), 'utf8'));
const ESPN_ID = { ATL: 1, BOS: 2, BKN: 17, CHA: 30, CHI: 4, CLE: 5, DAL: 6, DEN: 7, DET: 8, GSW: 9, HOU: 10, IND: 11, LAC: 12, LAL: 13, MEM: 29, MIA: 14, MIL: 15, MIN: 16, NOP: 3, NYK: 18, OKC: 25, ORL: 19, PHI: 20, PHX: 21, POR: 22, SAC: 23, SAS: 24, TOR: 28, UTA: 26, WAS: 27 };
const ESPN_AB = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
const teamList = n => ({ sports: [{ leagues: [{ teams: Object.entries(ESPN_ID).slice(0, n).map(([ab, id]) => ({ team: { id, abbreviation: ESPN_AB[ab] || ab, displayName: ab } })) }] }] });
const roster = (ab, n, coach) => ({ coach: coach ? [{ id: '9', firstName: coach.split(' ')[0], lastName: coach.split(' ').slice(1).join(' ') }] : [],
  athletes: Array.from({ length: n }, (_, i) => ({ id: `${ab}${i}`, displayName: `${ab} Player ${i}`, position: { abbreviation: 'G' } })) });
async function withFeed(feed, fn) {
  const real = { getJSON: L.getJSON, log: L.log, readGames: L.readGames }; const logs = [];
  L.getJSON = async url => { for (const [k, v] of Object.entries(feed)) if (url.includes(k)) { if (v instanceof Error) throw v; return typeof v === 'function' ? v(url) : v; } throw new Error('HTTP 404 ' + url); };
  L.log = m => logs.push(m);
  L.readGames = () => [{ game_id: '2027_20261021_BOS_NYK', season: '2027', date: '2026-10-21', type: 'REG', status: 'scheduled' }];
  B._reset();
  let error = null; try { await fn(); } catch (e) { error = e; }
  Object.assign(L, real); return { logs, error };
}

(async () => {
  console.log('1. the injury report');
  const before = read('injuries.json'); const had = Object.values(before.teams).reduce((n, l) => n + l.length, 0);
  let r = await withFeed({ 'teams?limit': teamList(30), 'injuries': { injuries: [] } }, () => B.injuries());
  check(r.error && /kept/.test(r.error.message) && JSON.stringify(read('injuries.json')) === JSON.stringify(before), `an empty answer is refused and the last report (${had} players) stands`);
  r = await withFeed({ 'teams?limit': teamList(30), 'injuries': {} }, () => B.injuries());
  check(r.error && JSON.stringify(read('injuries.json')) === JSON.stringify(before), 'so is an answer with no list');

  const save = (n, date) => fs.writeFileSync(path.join(tmp, 'injuries.json'), JSON.stringify({ date, teams: { BOS: Array.from({ length: n }, (_, i) => ({ id: 'b' + i, name: 'P' + i, status: 'Day-To-Day', returns: '' })) } }));
  const answer = n => ({ injuries: [{ id: 2, displayName: 'BOS', injuries: Array.from({ length: n }, (_, i) => ({ athlete: { displayName: 'Q' + i, links: [{ href: '/id/' + (900 + i) + '/' }] }, status: 'Out' })) }] });
  const today = L.etDate(new Date()), ago = n => new Date(Date.parse(today) - n * 86400000).toISOString().slice(0, 10);
  save(139, ago(1)); r = await withFeed({ 'teams?limit': teamList(30), 'injuries': answer(60) }, () => B.injuries());
  check(r.error && read('injuries.json').date === ago(1), 'a report under half of yesterday\'s is refused');
  save(139, ago(2)); r = await withFeed({ 'teams?limit': teamList(30), 'injuries': answer(60) }, () => B.injuries());
  check(!r.error && read('injuries.json').date === today && Object.values(read('injuries.json').teams).flat().length === 60, 'once the last report is two days old, the smaller one is taken: a hiccup costs a day, not a week');
  save(139, ago(5)); r = await withFeed({ 'teams?limit': teamList(30), 'injuries': answer(0) }, () => B.injuries());
  check(r.error && read('injuries.json').date === ago(5), 'a report with nobody on it is never taken');
  fs.writeFileSync(path.join(tmp, 'injuries.json'), JSON.stringify(before));

  console.log('2. rosters and coaches');
  const oldR = read('rosters_espn.json');
  r = await withFeed({ 'teams?limit': teamList(30), '/roster': url => { const id = +url.match(/teams\/(\d+)\/roster/)[1]; const ab = Object.keys(ESPN_ID).find(k => ESPN_ID[k] === id);
    return ab === 'BKN' ? roster(ab, 0, null) : roster(ab, 15, ab === 'NOP' ? 'New Coach' : (read('coaches_espn.json').teams[ab] || {}).name || 'Some Coach'); } }, () => B.coaches());
  const R = read('rosters_espn.json');
  check(JSON.stringify(R.teams.BKN) === JSON.stringify(oldR.teams.BKN) && R.asOf.BKN === ((oldR.asOf || {}).BKN || oldR.date) && r.logs.some(m => /BKN roster: .*kept/.test(m)), 'a club whose roster answers empty keeps its last good roster, dated by that read');
  check(R.teams.BOS.length === 15 && R.asOf.BOS === R.date, 'the others take the new read');
  const cs = fs.readFileSync(path.join(tmp, 'coaches.csv'), 'utf8').trim().split('\n');
  check(cs.filter(l => l.startsWith('2027,')).length === 30, 'coaches.csv gains the season in play, a row a club, on the first read');
  r = await withFeed({ 'teams?limit': teamList(30), '/roster': url => { const id = +url.match(/teams\/(\d+)\/roster/)[1]; const ab = Object.keys(ESPN_ID).find(k => ESPN_ID[k] === id);
    return roster(ab, 15, ab === 'NOP' ? 'Interim Coach' : (read('coaches_espn.json').teams[ab] || {}).name || 'Some Coach'); } }, () => B.coaches());
  const cs2 = fs.readFileSync(path.join(tmp, 'coaches.csv'), 'utf8').trim().split('\n');
  check(cs2.length === cs.length + 1 && /^2027,NOP,Interim Coach,\d{4}-\d\d-\d\d$/.test(cs2[cs2.length - 1]), 'a new coach gets a row dated today, and nothing else changes');
  const frozen = fs.readFileSync(path.join(tmp, 'rosters_espn.json'), 'utf8');
  r = await withFeed({ 'teams?limit': teamList(12) }, () => B.coaches());
  check(r.error && /12 clubs/.test(r.error.message) && fs.readFileSync(path.join(tmp, 'rosters_espn.json'), 'utf8') === frozen, 'a team list of 12 clubs writes nothing');

  console.log('3. a box row with no athlete id');
  const sample = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'data', 'sample_summary.json'), 'utf8'));
  const teams = sample.boxscore.players.map(t => L.fromEspn(t.team.abbreviation));
  const g = { game_id: 'x', date: '2026-01-01', away: teams[0], home: teams[1], away_score: '', home_score: '' };
  const n0 = B.parseSummary(sample, g).players.length;
  const bad = JSON.parse(JSON.stringify(sample)); bad.boxscore.players[0].statistics[0].athletes[0].athlete.id = undefined;
  let lg; r = await withFeed({}, async () => { lg = B.parseSummary(bad, g); });
  check(lg && lg.players.length === n0 - 1 && lg.players.every(p => p.player_id) && r.logs.some(m => /no athlete id/.test(m)), 'it is left out, logged, and the game kept');
  const side = JSON.parse(JSON.stringify(sample)); for (const a of side.boxscore.players[0].statistics[0].athletes) a.athlete.id = undefined;
  let threw = null; try { B.parseSummary(side, g); } catch (e) { threw = e; }
  check(threw && /under five box rows/.test(threw.message), "a box with one side's ids all missing is refused, so it is read again");

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
