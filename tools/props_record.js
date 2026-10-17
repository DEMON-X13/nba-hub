/* The record: DraftKings' closing player-prop main lines, read once from ESPN after each final.
 *
 *   node tools/props_record.js                       the season's finals of the last three weeks not read yet (the job
 *                                                    runs this through tools/props.js; no credits, one request a game)
 *   node tools/props_record.js --backfill 2026-04-14 2026-06-30   finals in a date range, once (what ESPN still served
 *                                                    on 15 October 2026: the 2026 play-in and playoffs)
 *
 * ESPN keeps a game's propBets answer after the game: the lines and prices DraftKings had at tip (the last update lands
 * a few minutes after it), so a read the morning after a final is the closing line. It does not keep them for good:
 * on 15 October 2026 it served none of the 2025-26 regular season and 83 of the 91 play-in and playoff games. So the
 * hub keeps its own copy, from the first game of 2026-27 on, and a backfill of what was still there.
 *
 * data/props_<season>.csv, one row a main line (the parse is tools/props_feed.js: the first item the Over, the rung
 * cross-check, one line a player and stat):
 *   game_id, player_id (ESPN's athlete id, the hub's player id), stat (pts reb ast tpm stl blk pra pr pa ar sb), line,
 *   over, under (DraftKings' American prices)
 * data/props_reads.json: every final asked for, { game_id: { at, status, lines, tries } } (at: when it was read, by the
 * reader's clock, UTC; ESPN's own lastUpdated runs three hours ahead and is not used) with status ok (rows
 * written), none (ESPN answered 404 "No propBets found": nothing to keep), failed (refused, timed out or junk: asked
 * again on the next run, three tries in all) or gave_up (three failures). A game read ok or none is never asked for
 * again, and its rows are never rewritten: this is source the job writes, never edited by hand (tools/props_check.js
 * holds the rows to the last commit's).
 * Preseason games are not read (DraftKings posts milestones only for them, and nothing models them).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const F = require('./props_feed');

const DATA = process.env.NBA_DATA_DIR || path.join(L.ROOT, 'data');
const COLS = ['game_id', 'player_id', 'stat', 'line', 'over', 'under'];
const READS = () => path.join(DATA, 'props_reads.json');
const recordFile = season => path.join(DATA, `props_${season}.csv`);
const FIRST_SEASON = 2026;          // the backfill's season; nothing earlier is served
const WINDOW_DAYS = 21;             // the daily read looks back this far for a final not read yet
const TRIES = 3;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAUSE = process.env.NBA_FETCH_PAUSE_MS != null ? +process.env.NBA_FETCH_PAUSE_MS : 250;

function readRecord(season) {
  const f = recordFile(season);
  if (!fs.existsSync(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  const head = lines.shift();
  if (head !== COLS.join(',')) throw new Error(`${path.basename(f)}: unexpected header ${head}`);
  return lines.filter(Boolean).map(l => { const v = l.split(','); return { game_id: v[0], player_id: v[1], stat: v[2], line: +v[3], over: +v[4], under: +v[5] }; });
}
const statOrder = s => F.PROP_STATS.indexOf(s);
function sortRecord(rows, dateOf) {
  return rows.sort((a, b) => {
    const da = dateOf(a.game_id), db = dateOf(b.game_id);
    return da < db ? -1 : da > db ? 1 : a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : statOrder(a.stat) - statOrder(b.stat);
  });
}
function writeRecord(season, rows) {
  const dateOf = id => id.split('_')[1];
  sortRecord(rows, dateOf);
  const body = [COLS.join(',')].concat(rows.map(r => COLS.map(c => r[c]).join(','))).join('\n') + '\n';
  const f = recordFile(season), before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (body !== before) fs.writeFileSync(f, body);
  return body !== before;
}
function readReads() { try { return JSON.parse(fs.readFileSync(READS(), 'utf8')); } catch (e) { return {}; } }
function writeReads(r) {
  const sorted = Object.fromEntries(Object.entries(r).sort((a, b) => a[0].split('_')[1] < b[0].split('_')[1] ? -1 : a[0].split('_')[1] > b[0].split('_')[1] ? 1 : a[0] < b[0] ? -1 : 1));
  const body = '{\n' + Object.entries(sorted).map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`).join(',\n') + '\n}\n';
  const before = fs.existsSync(READS()) ? fs.readFileSync(READS(), 'utf8') : '';
  if (body !== before) fs.writeFileSync(READS(), body);
}

/* one game's parsed answer -> its record rows */
function rowsOf(g, parsed) {
  return parsed.mains.map(m => ({ game_id: g.game_id, player_id: m.player, stat: m.stat, line: m.line, over: m.over, under: m.under }));
}

/* the finals to ask for: REG and POST games with an ESPN id, final, from `from` to `to` (dates), not read ok or none,
   and not given up on */
function due(games, reads, from, to) {
  return games.filter(g => g.status === 'final' && g.type !== 'PRE' && g.espn_id && g.date >= from && g.date <= to && +g.season >= FIRST_SEASON)
    .filter(g => { const r = reads[g.game_id]; return !r || r.status === 'failed'; })
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : 1);
}

/* read every due final once; returns a count. getJSON is lib's (a test passes a stub) */
async function recordClosing({ games, from, to, getJSON = L.getJSON, now = () => new Date(), log = L.log } = {}) {
  games = games || L.readGames();
  const today = L.etDate(now());
  from = from || L.addDays(today, -WINDOW_DAYS); to = to || today;
  const reads = readReads();
  const todo = due(games, reads, from, to);
  const n = { ok: 0, none: 0, failed: 0, gave_up: 0, lines: 0 };
  const bySeason = {};
  for (const g of todo) {
    const r = await F.propRead(g.espn_id, getJSON);
    const at = now().toISOString().slice(0, 16) + 'Z';
    const prev = reads[g.game_id] || { tries: 0 };
    if (r.status === 'ok') {
      const parsed = F.propParse(r.items);
      const rows = rowsOf(g, parsed);
      (bySeason[g.season] = bySeason[g.season] || []).push(...rows);
      reads[g.game_id] = { at, status: 'ok', lines: rows.length, tries: prev.tries + 1 };
      n.ok++; n.lines += rows.length;
      if (parsed.dropped.contradicted || parsed.dropped.unpaired) log(`${g.game_id}: ${rows.length} main lines; left out ${parsed.dropped.contradicted} the ladder contradicts, ${parsed.dropped.unpaired} unpaired item(s)`);
    } else if (r.status === 'none') {
      reads[g.game_id] = { at, status: 'none', lines: 0, tries: prev.tries + 1 };
      n.none++;
    } else {
      const tries = prev.tries + 1;
      reads[g.game_id] = { at, status: tries >= TRIES ? 'gave_up' : 'failed', lines: 0, tries, error: String(r.error || '').slice(0, 120) };
      n[tries >= TRIES ? 'gave_up' : 'failed']++;
      log(`${g.game_id} (${g.espn_id}): ${r.error}${tries >= TRIES ? `; given up after ${tries} tries` : ''}`);
    }
    if (PAUSE) await sleep(PAUSE);
  }
  for (const [season, rows] of Object.entries(bySeason)) {
    const have = readRecord(season);
    const done = new Set(have.map(r => r.game_id));
    writeRecord(season, have.concat(rows.filter(r => !done.has(r.game_id))));     // a game's rows are written once
  }
  if (todo.length) writeReads(reads);
  log(`closing props: ${todo.length} final(s) asked for: ${n.ok} read (${n.lines} main lines), ${n.none} with none posted, ${n.failed} failed (asked again next run), ${n.gave_up} given up`);
  return n;
}

async function main() {
  const args = process.argv.slice(2), i = args.indexOf('--backfill');
  if (i >= 0) await recordClosing({ from: args[i + 1], to: args[i + 2] });
  else await recordClosing({});
}

module.exports = { COLS, readRecord, writeRecord, readReads, writeReads, recordFile, rowsOf, due, recordClosing, FIRST_SEASON, TRIES, WINDOW_DAYS };
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
