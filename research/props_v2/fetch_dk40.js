/* DraftKings' older closing main lines from ESPN's feed (provider 40: the 2022 conference finals to April 2024), in the
 * record's own columns. NOT RUN BY ANY JOB, and its output is never committed: it writes only to research/props_v2/cache/
 * (gitignored here), for a study to read. Whether to backfill these, and whether into data/ as data/props_2026.csv was,
 * is the owner's call (data.md, "ESPN's feed").
 *
 *   node research/props_v2/fetch_dk40.js <from YYYY-MM-DD> <to YYYY-MM-DD> [--dry]
 *     e.g. 2022-10-18 2023-06-12 (2022-23), 2023-10-24 2024-04-30 (2023-24)
 *
 * One game at a time (one or two requests: limit=1000 is honoured), through curl, the games and their ESPN ids from
 * data/games.csv. Each answer is read by tools/props_feed.js propParse, as the record reads provider 100's: a main line
 * is a pair of adjacent items, the first the Over (research/props_v2/espn_validate40.js: on 6,527 graded lines of a
 * sample of 85 games, the first read as the Over scores 0.639-0.659 log loss, read as the Under 0.770-0.815). Written
 * to cache/props40_<season>.csv as game_id,player_id,stat,line,over,under (the record's columns), and a game's read to
 * cache/props40_reads.json (ok with its count, none for a 404, failed). --dry prints the counts and writes nothing.
 * Provider 40 carries the six base stats only (points, rebounds, assists, threes, steals, blocks) and turnovers, which
 * propParse leaves out; no combos, no ladders, no double-doubles.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const F = require('../../tools/props_feed.js');
const ROOT = path.join(__dirname, '..', '..');
const CACHE = path.join(__dirname, 'cache');
const B = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events';
const [from, to] = process.argv.slice(2).filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const DRY = process.argv.includes('--dry');
if (!from || !to) { console.error('usage: node research/props_v2/fetch_dk40.js <from YYYY-MM-DD> <to YYYY-MM-DD> [--dry]'); process.exit(1); }

const L = fs.readFileSync(path.join(ROOT, 'data', 'games.csv'), 'utf8').trim().split('\n'); const h = L.shift().split(',');
const c = n => h.indexOf(n);
const games = L.map(l => l.split(',')).filter(v => v[c('date')] >= from && v[c('date')] <= to && v[c('type')] !== 'PRE' && v[c('status')] === 'final' && v[c('espn_id')])
  .map(v => ({ id: v[c('game_id')], season: v[c('season')], espn: v[c('espn_id')] }));
const getJSON = url => { const out = execFileSync('curl', ['-sS', '-m', '30', '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const k = out.lastIndexOf('\n'), code = out.slice(k + 1); if (code !== '200') throw new Error(`HTTP ${code}`); return JSON.parse(out.slice(0, k)); };
const reads = {}, rows = {};
for (const g of games) {
  const pages = []; let status = 'ok';
  try {
    for (let page = 1; page <= 20; page++) { const j = getJSON(`${B}/${g.espn}/competitions/${g.espn}/odds/40/propBets?lang=en&region=us&limit=1000&page=${page}`); pages.push(j); if (page >= (+j.pageCount || 1)) break; }
  } catch (e) { status = /HTTP 404/.test(e.message) ? 'none' : 'failed'; }
  const mains = status === 'ok' ? F.propParse(F.propItems(pages)).mains : [];
  reads[g.id] = { at: new Date().toISOString().slice(0, 16) + 'Z', status, lines: mains.length };
  for (const m of mains) (rows[g.season] = rows[g.season] || []).push([g.id, m.player, m.stat, m.line, m.over, m.under].join(','));
  console.log(g.id, status, mains.length);
}
if (DRY) process.exit(0);
fs.mkdirSync(CACHE, { recursive: true });
for (const [s, r] of Object.entries(rows)) { const f = path.join(CACHE, `props40_${s}.csv`); const head = !fs.existsSync(f); fs.appendFileSync(f, (head ? 'game_id,player_id,stat,line,over,under\n' : '') + r.join('\n') + '\n'); }
const rf = path.join(CACHE, 'props40_reads.json'); const old = fs.existsSync(rf) ? JSON.parse(fs.readFileSync(rf, 'utf8')) : {};
fs.writeFileSync(rf, JSON.stringify({ ...old, ...reads }, null, 1) + '\n');
