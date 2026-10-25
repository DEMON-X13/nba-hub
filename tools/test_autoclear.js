/* Test of tools/autoclear.js: X's finished parlays clear themselves two Eastern days after their last game.
 *
 *   node tools/test_autoclear.js        (no dependencies; prints "N checks, 0 failures", exit 1 otherwise)
 *
 * On a made-up games.csv (Saturday 24 October 2026: BKN at CLE and BOS at NYK final, DAL at DEN with no final; Sunday
 * 25 October: LAL at UTA final, by its status and its scores) and made-up parlays: saturday (two Saturday finals),
 * unfinished (a final and the game with none), sunday (Saturday and Sunday), postponed (a Saturday final and a Saturday
 * game games.csv no longer lists, as after ESPN drops a postponed one), old (cleared already, by hand), badindex (a leg
 * on no game), strindex (a game's place written as a string), oldseason (a game of a season long gone that no list has),
 * junkid (a game id not in the site's shape), nolegs, and a row that is not a parlay at all. Then the command itself on
 * a scratch copy, and the real liveparlays/parlays.json held to the file's own style and shape.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const A = require('./autoclear');
const ROOT = path.resolve(__dirname, '..');
let checks = 0; const fails = [];
const check = (ok, msg) => { checks++; if (!ok) fails.push(msg); };
const clone = x => JSON.parse(JSON.stringify(x));

const CSV = ['game_id,season,date,type,away,home,away_score,home_score,neutral,status,home_line,total,source,espn_id,tip,home_ml,away_ml',
  '2027_20261024_BKN_CLE,2027,2026-10-24,REG,BKN,CLE,121,125,0,final,-11.5,228.5,espn,401909854,2026-10-24T23:30Z,-500,380',
  '2027_20261024_BOS_NYK,2027,2026-10-24,REG,BOS,NYK,110,104,0,final,-2.5,224,espn,401909855,2026-10-25T00:00Z,-140,120',
  '2027_20261024_DAL_DEN,2027,2026-10-24,REG,DAL,DEN,,,0,scheduled,,,espn,401909856,2026-10-25T02:00Z,,',
  '2027_20261025_LAL_UTA,2027,2026-10-25,REG,LAL,UTA,108,99,0,final,,,espn,401909861,2026-10-25T21:00Z,,',
  '2026_20260301_BOS_MIA,2026,2026-03-01,REG,BOS,MIA,100,98,0,final,,,espn,401800001,2026-03-01T23:00Z,,'].join('\n') + '\n';
const leg = (game, stat = 'pts', line = 24.5) => ({ game, player: 'Some Player', team: 'CLE', stat, line, side: 'over', main: true });
const DOC = {
 how: 'X\'s placed parlays: a made-up file. Claude keeps it; a stat, a line; cleared parlays stay as history.',
 updated: '2026-10-24T18:00:00Z',
 games: ['2027_20261024_BKN_CLE', '2027_20261024_BOS_NYK', '2027_20261024_DAL_DEN', '2027_20261025_LAL_UTA', '2027_20261024_PHI_TOR', '2019_20190105_ATL_BOS', 'not-a-game'],
 parlays: [
  { id: 'saturday', date: '2026-10-24', stake: 10, price: 264, payout: 36.4, note: 'same night', legs: [leg(0), leg(1, 'ml', 0)] },
  { id: 'unfinished', stake: 5, price: 300, payout: 20, legs: [leg(0), leg(2, 'reb', 9.5)] },
  { id: 'sunday', stake: 5, price: 180, payout: 14, legs: [leg(1, 'total', 220.5), leg(3, 'pra', 40.5)] },
  { id: 'postponed', stake: 5, price: 150, payout: 12.5, legs: [leg(0), leg(4, 'ast', 6.5)] },
  { id: 'old', stake: 1, price: 100, payout: 2, legs: [leg(0)], cleared: true, cleared_on: '2026-10-20' },
  { id: 'badindex', stake: 1, price: 100, payout: 2, legs: [leg(0), leg(9)] },
  { id: 'strindex', stake: 1, price: 100, payout: 2, legs: [leg('0')] },
  { id: 'oldseason', stake: 1, price: 100, payout: 2, legs: [leg(5)] },
  { id: 'junkid', stake: 1, price: 100, payout: 2, legs: [leg(6)] },
  { id: 'nolegs', stake: 1, price: 100, payout: 2, legs: [] },
  'not a parlay'] };
const fin = A.finals(CSV);
check(fin.season === 2027 && fin.games.get('2027_20261024_BKN_CLE').done && !fin.games.get('2027_20261024_DAL_DEN').done && fin.games.get('2027_20261025_LAL_UTA').date === '2026-10-25',
  'games.csv is read as each game\'s Eastern date and whether it is final, and the latest season it holds');
check(A.finals(CSV.replace('108,99,0,final', ',,0,final')).games.get('2027_20261025_LAL_UTA').done && A.finals(CSV.replace('108,99,0,final', '108,99,0,live')).games.get('2027_20261025_LAL_UTA').done
  && !A.finals(CSV.replace('108,99,0,final', ',,0,live')).games.get('2027_20261025_LAL_UTA').done, 'a game is final by its status, or by both its scores, and not by neither');

/* the day of the games and the day after: nothing clears */
for (const today of ['2026-10-24', '2026-10-25']) {
  const ids = A.toClear(clone(DOC), fin, today);
  check(ids.length === 0, `on ${today} nothing should clear: ${ids.join(', ')}`);
}
/* Monday: the Saturday parlays clear, the postponed game's with them (void two days after its date) */
{
  const doc = clone(DOC), ids = A.toClear(doc, fin, '2026-10-26');
  check(ids.join() === 'saturday,postponed', 'on Monday the Saturday parlays (and the one on a game no list has, void now) should clear, in the file\'s order: ' + ids.join(', '));
  const now = '2026-10-26T15:04:05Z';
  A.apply(doc, ids, '2026-10-26', now);
  const sat = doc.parlays.find(p => p.id === 'saturday'), old = doc.parlays.find(p => p.id === 'old');
  check(sat.cleared === true && sat.cleared_on === '2026-10-26' && sat.cleared_by === 'auto', 'a cleared parlay carries cleared, cleared_on and cleared_by auto');
  check(old.cleared_on === '2026-10-20' && !('cleared_by' in old), 'a parlay cleared before is not marked again');
  check(doc.updated === now && doc.how === DOC.how && JSON.stringify(doc.games) === JSON.stringify(DOC.games), 'updated moves to now, and how and games are as they were');
  for (const p of DOC.parlays) {
    const q = doc.parlays[DOC.parlays.indexOf(p)];
    if (typeof p === 'object' && ids.includes(p.id)) { const { cleared, cleared_on, cleared_by, ...rest } = q; check(JSON.stringify(rest) === JSON.stringify(p), `${p.id} changed in more than the three fields`); }
    else check(JSON.stringify(q) === JSON.stringify(p), `${typeof p === 'object' ? p.id : 'the row that is not a parlay'} changed though it was not cleared`);
  }
  check(A.dumps(doc) === JSON.stringify(doc, null, 1) + '\n' && A.dumps(doc).startsWith('{\n "how"') && A.dumps(doc).endsWith('}\n'), 'the file is written in its own style: one-space indent, a newline at the end');
  /* Tuesday: Sunday's clears too; the rest never do, however long after */
  const ids2 = A.toClear(doc, fin, '2026-10-27');
  check(ids2.join() === 'sunday', 'on Tuesday Sunday\'s parlay should clear: ' + ids2.join(', '));
  A.apply(doc, ids2, '2026-10-27', '2026-10-27T15:00:00Z');
  const ids3 = A.toClear(doc, fin, '2027-06-30');
  check(ids3.length === 0, 'unfinished, badindex, strindex, oldseason, junkid and nolegs should never clear: ' + ids3.join(', '));
  /* a second run on a file already cleared changes nothing */
  check(A.toClear(doc, fin, '2026-10-27').length === 0, 'a second run cleared something again');
}
/* a game that is final, two days on, with a listed game still to come in the same parlay, waits for that game */
{
  const doc = { games: ['2027_20261024_BKN_CLE', '2027_20261024_DAL_DEN'], parlays: [{ id: 'mixed', legs: [leg(0), leg(1)] }] };
  check(A.toClear(doc, fin, '2026-11-30').length === 0, 'a parlay with a listed game that never went final was cleared');
  const fin2 = A.finals(CSV.replace('DAL,DEN,,,0,scheduled', 'DAL,DEN,101,111,0,final'));
  check(A.toClear(doc, fin2, '2026-10-25').length === 0 && A.toClear(doc, fin2, '2026-10-26').join() === 'mixed', 'once its last game is final it clears two days after it');
}
/* a file that is not a parlay file, or holds none, clears nothing */
for (const junk of [{}, { parlays: 'x' }, { games: 'x', parlays: [{ id: 'a', legs: [leg(0)] }] }, null])
  check(A.toClear(junk, fin, '2026-12-01').length === 0, 'a junk file cleared something: ' + JSON.stringify(junk));

/* the command itself, on a scratch copy: written only when something cleared, in the file's style, and saying what */
{
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autoclear-')), gf = path.join(dir, 'games.csv'), pf = path.join(dir, 'parlays.json');
  fs.writeFileSync(gf, CSV); const before = A.dumps(DOC); fs.writeFileSync(pf, before);
  const run = (...a) => spawnSync(process.execPath, [path.join(__dirname, 'autoclear.js'), '--games', gf, '--file', pf, ...a], { encoding: 'utf8' });
  let r = run('--today', '2026-10-25');
  check(r.status === 0 && r.stdout.trim() === 'autoclear: nothing to clear' && fs.readFileSync(pf, 'utf8') === before, 'on the day after the games the command wrote the file, or did not say nothing cleared: ' + r.stdout + r.stderr);
  r = run('--today', '2026-10-26');
  const after = fs.readFileSync(pf, 'utf8'), doc = JSON.parse(after);
  check(r.status === 0 && r.stdout.trim() === 'autoclear: cleared 2: saturday, postponed' && after === A.dumps(doc) && doc.parlays[0].cleared === true && /^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\dZ$/.test(doc.updated),
    'on Monday the command did not clear the two, say so, and write the file in its style with updated now: ' + r.stdout + r.stderr);
  r = run('--today', '2026-10-26');
  check(r.status === 0 && r.stdout.trim() === 'autoclear: nothing to clear' && fs.readFileSync(pf, 'utf8') === after, 'a second run on Monday changed the file');
  r = run('--today', '26 October');
  check(r.status === 2 && /YYYY-MM-DD/.test(r.stdout) && fs.readFileSync(pf, 'utf8') === after, 'a --today that is not a date was not refused');
  fs.writeFileSync(pf, '{ not json');
  r = run('--today', '2026-10-26');
  check(r.status !== 0 && fs.readFileSync(pf, 'utf8') === '{ not json', 'a file that is not JSON did not fail the command (the job puts the file back on a failure)');
  fs.rmSync(dir, { recursive: true, force: true });
}
/* the Eastern date: 03:30 UTC is still the evening before in New York */
check(A.etToday(new Date('2026-10-26T03:30:00Z')) === '2026-10-25' && A.etToday(new Date('2026-10-26T04:30:00Z')) === '2026-10-26', 'today is the Eastern date');

/* the real file: in its own style, of the page's shape, its how saying how it is kept */
{
  const f = path.join(ROOT, 'liveparlays', 'parlays.json'), text = fs.readFileSync(f, 'utf8'), doc = JSON.parse(text);
  check(text === A.dumps(doc), 'liveparlays/parlays.json is not in the file\'s own style (JSON.stringify with a one-space indent and a newline at the end)');
  check(typeof doc.how === 'string' && /\bstat\b/.test(doc.how) && /cleared/.test(doc.how) && /Claude/.test(doc.how) && /pid/.test(doc.how) && /autoclear\.js/.test(doc.how), 'the real file\'s how does not say how it is kept (stat, pid, cleared, Claude, autoclear.js)');
  check(Array.isArray(doc.games) && Array.isArray(doc.parlays) && (doc.updated === null || typeof doc.updated === 'string'), 'the real file is not { how, updated, games, parlays }');
  check(doc.games.every(g => /^\d{4}_\d{8}_[A-Z]{2,3}_[A-Z]{2,3}$/.test(g)) && new Set(doc.games).size === doc.games.length, 'a game in the real file is not a site game id, or is listed twice');
  check(doc.parlays.every(p => p && typeof p.id === 'string' && Array.isArray(p.legs) && p.legs.every(l => Number.isInteger(l.game) && l.game >= 0 && l.game < doc.games.length)), 'a parlay in the real file has no id, or a leg on no game');
  /* every leg one the page draws (its STATS list, read from the part itself, a finite line, a side), so no parlay is drawn
     short or dropped; this is the strict half of the smoke's real-file check, which only gates on what would break the page */
  const part = fs.readFileSync(path.join(ROOT, 'app', 'parts', 'xparlays.html'), 'utf8');
  const STATS = JSON.parse((/const STATS = (\[[^\]]*\]);/.exec(part) || [, '[]'])[1].replace(/'/g, '"'));
  const SIDES = ['over', 'under'];
  const badLegs = [];
  doc.parlays.forEach(p => (p && Array.isArray(p.legs) ? p.legs : []).forEach((l, i) => {
    /* as the page reads it (readLeg): the stat lower-cased, ats as spread, a line that is a number; the side and team are
       held stricter than the page, which reads any side but under as over */
    let stat = String(l && l.stat || '').toLowerCase(); if (stat === 'ats') stat = 'spread';
    if (!STATS.includes(stat) || l.line == null || l.line === '' || !Number.isFinite(+l.line) || !SIDES.includes(l.side) || typeof l.team !== 'string') badLegs.push(`${p.id} leg ${i + 1}`);
  }));
  check(STATS.length > 10 && !badLegs.length, `a leg in the real file the page would drop (a stat not in its list, no line, no side or no team): ${badLegs.join(', ') || 'none'}`);
  check(new Set(doc.parlays.map(p => p && p.id)).size === doc.parlays.length, 'two parlays in the real file share an id');
}

console.log(`${checks} checks, ${fails.length} failures`);
fails.forEach(f => console.log('  FAIL:', f));
process.exit(fails.length ? 1 : 0);
