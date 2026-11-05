/* DraftKings' older closing main lines from ESPN's feed (provider 40: the 2022 conference finals to April 2024), in the
 * record's own columns. NOT RUN BY ANY JOB, and its output is never committed: it writes only to research/props_v2/cache/
 * (gitignored here), for a study to read. Whether to backfill these, and whether into data/ as data/props_2026.csv was,
 * is the owner's call (data.md, "ESPN's feed"). This version has never been run on the real feed. Its first version,
 * whose --dry still downloaded (it only skipped the write), was tried once with --dry on one day, which downloaded that
 * day's answers and wrote nothing.
 *
 *   node research/props_v2/fetch_dk40.js <from YYYY-MM-DD> <to YYYY-MM-DD> [--dry]
 *     e.g. 2022-10-18 2023-06-12 (2022-23), 2023-10-24 2024-04-30 (2023-24)
 *
 * --dry lists the games in the range and the requests a run would make, and stops: it requests nothing and writes
 * nothing.
 *
 * Otherwise, one game at a time, through curl, the games and their ESPN ids from data/games.csv: the event (its
 * scheduled start, ESPN's `date`, which games.csv does not carry for these seasons), then every propBets page (limit=1000
 * is honoured, so one or two requests). Each answer is read by tools/props_feed.js propParse, as the record reads
 * provider 100's: a main line is a pair of adjacent items, the first the Over (research/props_v2/espn_validate40.js: on
 * 6,527 graded lines of a sample of 85 games, the first read as the Over scores 0.639-0.659 log loss, read as the Under
 * 0.770-0.815). Provider 40 carries the six base stats only (points, rebounds, assists, threes, steals, blocks) and
 * turnovers, which propParse leaves out; no combos, no ladders, no double-doubles.
 *
 * Written to cache/props40_<season>.csv as game_id,player_id,stat,line,over,under (the record's columns), then
 * last_updated (the later of the pair's two items' lastUpdated, as the feed gives it: the README's validity check reads
 * it), one row a game, player and stat; and each game's read to cache/props40_reads.json (when, ok with its count and
 * the event's start, none for a 404, failed). The cache is kept a game at a time, never appended to, and each file is
 * rewritten whole, in game order, through a temporary file, so running a range again, or two ranges that overlap, never
 * repeats a line:
 *   - a read that finds main lines replaces whatever an earlier run wrote for that game;
 *   - a read that finds none (a 404, a failure, or an answer with no main line in it) keeps an earlier run's read that
 *     found lines, its rows and its record; with no such read, the game is recorded as this read found it, with no rows;
 *   - the event's start is the event's, not the read's: a run whose request for the event fails keeps the start an
 *     earlier read recorded (validity.js's V1 counts a line with no start as not shown before it), and a run that learns
 *     a start an earlier kept read lacked adds it.
 * research/props_v2/fetch_dk40_test.js holds each rule on a local fake of the feed.
 *
 * For that test only, three settings can point elsewhere: DK40_BASE (the feed's events address), DK40_CACHE (the
 * cache folder) and DK40_GAMES (the schedule).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const F = require('../../tools/props_feed.js');
const ROOT = path.join(__dirname, '..', '..');
const B = process.env.DK40_BASE || 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events';
const CACHE = process.env.DK40_CACHE || path.join(__dirname, 'cache');
const GAMES = process.env.DK40_GAMES || path.join(ROOT, 'data', 'games.csv');
const COLS = ['game_id', 'player_id', 'stat', 'line', 'over', 'under', 'last_updated'];
const [from, to] = process.argv.slice(2).filter(a => /^\d{4}-\d{2}-\d{2}$/.test(a));
const DRY = process.argv.includes('--dry');
if (!from || !to) { console.error('usage: node research/props_v2/fetch_dk40.js <from YYYY-MM-DD> <to YYYY-MM-DD> [--dry]'); process.exit(1); }

const L = fs.readFileSync(GAMES, 'utf8').trim().split('\n'); const h = L.shift().split(',');
const c = n => h.indexOf(n);
const games = L.map(l => l.split(',')).filter(v => v[c('date')] >= from && v[c('date')] <= to && v[c('type')] !== 'PRE' && v[c('status')] === 'final' && v[c('espn_id')])
  .map(v => ({ id: v[c('game_id')], season: v[c('season')], espn: v[c('espn_id')] }));
const eventUrl = e => `${B}/${e}?lang=en&region=us`;
const pageUrl = (e, page) => `${B}/${e}/competitions/${e}/odds/40/propBets?lang=en&region=us&limit=1000&page=${page}`;

if (DRY) {
  /* nothing is requested: the games, and the requests a run would make */
  const seasons = {}; for (const g of games) seasons[g.season] = (seasons[g.season] || 0) + 1;
  console.log(`${games.length} games from ${from} to ${to} (by season ${JSON.stringify(seasons)}); a run would ask, for each, for the event and then the propBets pages, e.g.`);
  for (const g of games.slice(0, 3)) console.log(' ', g.id, eventUrl(g.espn), pageUrl(g.espn, 1));
  console.log('--dry: nothing was requested and nothing written');
  process.exit(0);
}

const getJSON = url => { const out = execFileSync('curl', ['-sS', '-m', '30', '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const k = out.lastIndexOf('\n'), code = out.slice(k + 1); if (code !== '200') throw new Error(`HTTP ${code}`); return JSON.parse(out.slice(0, k)); };

/* the cache as it stands: per season, game id -> its rows (each a line of the file, without the newline) */
const fileOf = s => path.join(CACHE, `props40_${s}.csv`), readsFile = path.join(CACHE, 'props40_reads.json');
const cached = {};
function seasonRows(s) {
  if (cached[s]) return cached[s];
  const m = cached[s] = new Map();
  if (!fs.existsSync(fileOf(s))) return m;
  const t = fs.readFileSync(fileOf(s), 'utf8').split('\n').filter(Boolean);
  if (t.shift() !== COLS.join(',')) throw new Error(`${fileOf(s)} is not in this recipe's columns: move it aside`);
  for (const l of t) { const g = l.slice(0, l.indexOf(',')); if (!m.has(g)) m.set(g, []); m.get(g).push(l); }
  return m;
}
const reads = fs.existsSync(readsFile) ? JSON.parse(fs.readFileSync(readsFile, 'utf8')) : {};
const writeWhole = (f, body) => { const tmp = f + '.tmp'; fs.writeFileSync(tmp, body); fs.renameSync(tmp, f); };
function flush() {
  fs.mkdirSync(CACHE, { recursive: true });
  for (const [s, m] of Object.entries(cached)) {
    const ids = [...m.keys()].sort();
    writeWhole(fileOf(s), [COLS.join(','), ...ids.flatMap(g => m.get(g))].join('\n') + '\n');
  }
  const keys = Object.keys(reads).sort();
  writeWhole(readsFile, JSON.stringify(Object.fromEntries(keys.map(k => [k, reads[k]])), null, 1) + '\n');
}

const found = r => !!(r && r.status === 'ok' && r.lines > 0);       // a read that found main lines
let n = 0;
for (const g of games) {
  const prev = reads[g.id] || null;
  const pages = []; let status = 'ok', start = null;
  try { start = getJSON(eventUrl(g.espn)).date || null; } catch (e) { start = null; }
  if (!start && prev && prev.start) start = prev.start;                // the event's start, kept from an earlier read
  try {
    for (let page = 1; page <= 20; page++) { const j = getJSON(pageUrl(g.espn, page)); pages.push(j); if (page >= (+j.pageCount || 1)) break; }
  } catch (e) { status = /HTTP 404/.test(e.message) ? 'none' : 'failed'; }
  const items = status === 'ok' ? F.propItems(pages) : null;
  if (status === 'ok' && !items) status = 'failed';
  const mains = status === 'ok' ? F.propParse(items).mains : [];
  /* each main line's stamp: the later lastUpdated of its two items */
  const stamp = new Map();
  for (const it of items || []) {
    const stat = F.PROP_MAIN[F.propTypeId(it)]; if (!stat) continue;
    const k = stat + '|' + F.propAthlete(it) + '|' + F.propLine(it), t = String(it.lastUpdated || '');
    if (!stamp.has(k) || t > stamp.get(k)) stamp.set(k, t);
  }
  const read = { at: new Date().toISOString().slice(0, 16) + 'Z', status, lines: mains.length, start };
  const m = seasonRows(g.season);
  if (status === 'ok' && mains.length) {
    m.set(g.id, mains.map(x => [g.id, x.player, x.stat, x.line, x.over, x.under, stamp.get(x.stat + '|' + x.player + '|' + x.line) || ''].join(',')));
    reads[g.id] = read;
    console.log(g.id, status, mains.length);
  } else if (found(prev)) {
    if (!prev.start && start) prev.start = start;
    console.log(g.id, status, mains.length, `(kept the earlier read of ${prev.at}, ${prev.lines} lines)`);
  } else {
    m.delete(g.id); reads[g.id] = read;
    console.log(g.id, status, 0);
  }
  if (++n % 25 === 0) flush();
}
flush();
console.log(`${games.length} games read; cache in ${CACHE}`);
