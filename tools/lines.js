/* The lines feed: DraftKings' lines on the next nights' games, read by the job from ESPN's free feeds and published as
 * lines.json at the repo root (README "The lines feed"), so a page prices those games from the moment it loads, before
 * anyone presses Refresh odds.
 *
 *   node tools/lines.js        the job's step, after the props model; no credits, no key
 *
 * Which games: every game data/games.csv has still to come (status scheduled, tip-off not passed; never preseason,
 * which nothing on the page prices from a model and DraftKings posts only milestones for) on the next two Eastern
 * dates with such a game. For each of those dates one scoreboard request (the one tools/fetch.js makes) gives each
 * game's DraftKings game lines, read by tools/lines_feed.js exactly as the page reads them: the two moneylines, the
 * spread's number and its two prices, the total's number and its two prices, and each outcome's betslip id. For each
 * game one propBets request (another past a page) gives its player props, parsed by tools/props_feed.js: the main lines
 * with both prices, the "k+" rungs and the double- and triple-double Yes prices. Every request is a plain GET with no
 * headers of its own, past any cache (a cache-buster), dropped after 15 seconds and tried once more on a timeout, a
 * reset or a 5xx; six propBets reads at a time.
 *
 * lines.json:
 *   { v: 1, at,                                              when the run that last changed the file read
 *     games: { <gid>: {
 *       at, espn,                                            when the game lines below were read; ESPN's event id
 *       ml: { home, away } | null,                           DraftKings' American prices
 *       spread: { line, home, away } | null,                 line: the home side's number (the away side's is -line)
 *       total: { line, over, under } | null,
 *       ids: { event, ml: {home, away}, spread: {home, away}, total: {over, under} } | null,   betslip ids, each or null
 *       props: { at, mains: [{player, stat, line, over, under}], ladders: [{player, stat, k, price}],
 *                yes: [{player, market, price}] } | null } } }   null: never read yet; empty lists: none posted yet
 * Each half of a game (its game lines; its props) is its own read. A read that answers replaces that half, and a read
 * that finds exactly what the file holds keeps the file's `at`, so `at` is when the job first read what the half holds
 * and a run that finds nothing new writes nothing at all (the file is rewritten only when anything but its top-level
 * `at` changed). A read that fails (a refusal, a timeout, an answer that is not ESPN's shape, a game missing from its
 * day's answer) leaves that half as the last good read had it, with its own `at`; a half never read is null, and a game
 * with neither half ever read is left out. A 404 on the props ("No propBets found") is DraftKings having posted none:
 * empty lists. A game that has tipped (by games.csv, by the fresh scoreboard's status or tip, or during the read) or is
 * final leaves the file, and so does every game no longer among the games to come. When nothing answers at all the file
 * is left exactly as it was and the run exits 1.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const F = require('./fetch');
const PF = require('./props_feed');
const LF = require('./lines_feed');

const OUT = () => process.env.NBA_LINES_FILE || path.join(L.ROOT, 'lines.json');   // read at call time, so a test can set it
const SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100&dates=';
const DAYS = 2;                   // the next two Eastern dates with a game to come
const POOL = 6;                   // propBets reads at a time, as the page's press makes them
const TIMEOUT = 15000;
/* the header sets lib.getJSON tries, the named one first (the one ESPN has answered from GitHub's runners), each try one
   of them in turn */
const TRIES = L.HEADER_SETS.length;
const RETRY = [403, 408, 425, 429, 500, 502, 503, 504];
const PAUSE = process.env.NBA_FETCH_PAUSE_MS != null ? +process.env.NBA_FETCH_PAUSE_MS : 1000;
const sleep = ms => new Promise(r => setTimeout(r, ms));
const iso = d => new Date(d).toISOString().slice(0, 19) + 'Z';
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/;

/* one ESPN read: a GET past any cache, inside 15 seconds body and all, with lib's header sets in turn (the named
   User-Agent, none, a browser's), so a refusal one of them meets is tried with the next, as lib.getJSON does; a refusal
   throws "HTTP <code> <url>", so propRead reads a 404 as nothing posted */
async function getJSON(url) {
  let last;
  for (let i = 0; i < TRIES; i++) {
    if (i) await sleep(PAUSE);
    try {
      const h = L.HEADER_SETS[i], opt = { cache: 'no-store', signal: AbortSignal.timeout(TIMEOUT) };
      if (Object.keys(h).length) opt.headers = h;
      const r = await fetch(url + (url.includes('?') ? '&' : '?') + '_=' + Date.now(), opt);
      if (r.ok) return await r.json();
      last = new Error('HTTP ' + r.status + ' ' + url);
      if (!RETRY.includes(r.status)) break;
    } catch (e) { last = e; }
  }
  throw last;
}

/* the games to read: still to come by games.csv (as props.js picks its horizon), on the next two dates with one */
function toCome(games, now, days = DAYS) {
  const today = L.etDate(now), nowIso = new Date(now).toISOString().slice(0, 16) + 'Z';
  const ahead = games.filter(g => g.status === 'scheduled' && g.type !== 'PRE' && g.date >= today && !(g.tip && g.tip <= nowIso));
  const dates = [...new Set(ahead.map(g => g.date))].sort().slice(0, days);
  return ahead.filter(g => dates.includes(g.date));
}

/* ---- the file's rules, which a kept entry must meet to be carried and the committed file is held to ---- */
const am = v => Number.isInteger(v) && Math.abs(v) >= 100;
const half = v => typeof v === 'number' && Number.isFinite(v) && Math.abs(v * 2 - Math.round(v * 2)) < 1e-9;
const STATS = new Set(PF.PROP_STATS), MILES = new Set(Object.values(PF.PROP_MILE)), YES = new Set(Object.values(PF.PROP_YES));
const GID = /^\d{4}_\d{8}_[A-Z]{3}_[A-Z]{3}$/;
/* why a game's entry breaks the file's shape, or null */
function entryBad(gid, x) {
  if (!GID.test(gid)) return 'not a game id';
  if (!x || typeof x !== 'object') return 'not an entry';
  if (JSON.stringify(Object.keys(x)) !== '["at","espn","ml","spread","total","ids","props"]') return 'its fields are not at, espn, ml, spread, total, ids, props';
  if (!(x.at === null || ISO.test(x.at))) return 'its at is not a time';
  if (!/^\d+$/.test(String(x.espn))) return 'no ESPN event id';
  if (x.at === null && (x.ml || x.spread || x.total || x.ids)) return 'game lines with no read time';
  if (x.ml !== null && !(x.ml && am(x.ml.home) && am(x.ml.away) && Object.keys(x.ml).length === 2)) return 'a moneyline that is not two prices';
  if (x.spread !== null && !(x.spread && half(x.spread.line) && am(x.spread.home) && am(x.spread.away) && Object.keys(x.spread).length === 3)) return 'a spread that is not a number and two prices';
  if (x.total !== null && !(x.total && half(x.total.line) && x.total.line > 0 && am(x.total.over) && am(x.total.under) && Object.keys(x.total).length === 3)) return 'a total that is not a number and two prices';
  if (x.ids !== null) {
    const i = x.ids;
    if (!i || typeof i !== 'object' || JSON.stringify(Object.keys(i)) !== '["event","ml","spread","total"]') return 'ids not in their shape';
    if (!(i.event === null || /^\d+$/.test(i.event))) return 'an event id that is not a number';
    for (const [k, sides, line] of [['ml', ['home', 'away']], ['spread', ['home', 'away'], x.spread && x.spread.line], ['total', ['over', 'under'], x.total && x.total.line]]) {
      if (i[k] === null) continue;
      if (!x[k]) return `${k} ids with no ${k}`;
      if (JSON.stringify(Object.keys(i[k])) !== JSON.stringify(sides)) return `${k} ids not in their shape`;
      for (const s of sides) if (i[k][s] !== null && !LF.oddsIdOk(k, s, i[k][s], k === 'spread' && s === 'away' ? -line : line)) return `a ${k} id that does not name its own outcome and number (${i[k][s]})`;
    }
  }
  if (x.props !== null) {
    const p = x.props;
    if (!p || typeof p !== 'object' || JSON.stringify(Object.keys(p)) !== '["at","mains","ladders","yes"]' || !ISO.test(p.at) || ![p.mains, p.ladders, p.yes].every(Array.isArray)) return 'props not in their shape';
    if (!p.mains.every(m => /^\d+$/.test(m.player) && STATS.has(m.stat) && half(m.line) && am(m.over) && am(m.under))) return 'a main line not of the parse\'s shape';
    if (new Set(p.mains.map(m => m.player + '|' + m.stat)).size !== p.mains.length) return 'two main lines on one player and stat';
    if (!p.ladders.every(m => /^\d+$/.test(m.player) && MILES.has(m.stat) && Number.isInteger(m.k) && m.k >= 1 && am(m.price))) return 'a rung not of the parse\'s shape';
    if (!p.yes.every(m => /^\d+$/.test(m.player) && YES.has(m.market) && am(m.price))) return 'a Yes price not of the parse\'s shape';
  }
  if (x.at === null && x.props === null) return 'neither half ever read';
  return null;
}

/* the last file, its entries that meet the rules (a junk or missing file is no last read: every game starts afresh) */
function readLines(file = OUT()) {
  let j;
  try { j = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { return null; }
  if (!j || j.v !== 1 || !j.games || typeof j.games !== 'object') return null;
  return { v: 1, at: j.at, games: Object.fromEntries(Object.entries(j.games).filter(([k, x]) => !entryBad(k, x))) };
}

/* the file as text: one line a game, by game id (season, date, clubs), so a change is a line's diff */
function stringify(o) {
  const ids = Object.keys(o.games).sort();
  return '{"v":' + o.v + ',"at":' + JSON.stringify(o.at) + ',"games":{' + (ids.length ? '\n' + ids.map(k => JSON.stringify(k) + ':' + JSON.stringify(o.games[k])).join(',\n') + '\n' : '') + '}}\n';
}

/* one game's entry from its last one and this run's reads: `gl` the game lines read ({at, lines}) or null (not read),
   `pr` the props read ({at, mains, ladders, yes}) or null; each half that read the same as the last keeps its time */
function entryOf(old, espn, gl, pr) {
  const o = old && old.espn === espn ? old : null;          // a read under another event id is another game's
  const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
  let lines;
  if (gl) lines = o && o.at && same([o.ml, o.spread, o.total, o.ids], [gl.lines.ml, gl.lines.spread, gl.lines.total, gl.lines.ids]) ? { at: o.at, ...gl.lines } : { at: gl.at, ...gl.lines };
  else lines = o ? { at: o.at, ml: o.ml, spread: o.spread, total: o.total, ids: o.ids } : { at: null, ml: null, spread: null, total: null, ids: null };
  let props;
  if (pr) props = o && o.props && same([o.props.mains, o.props.ladders, o.props.yes], [pr.mains, pr.ladders, pr.yes]) ? o.props : { at: pr.at, mains: pr.mains, ladders: pr.ladders, yes: pr.yes };
  else props = o ? o.props : null;
  if (lines.at === null && !props) return null;
  return { at: lines.at, espn, ml: lines.ml, spread: lines.spread, total: lines.total, ids: lines.ids, props };
}

/* the run: reads, then the file. `get` reads one URL's JSON (getJSON above; the tests hand in their own) and `clock`
   gives the time of each answer. Returns what it did; `failed` when nothing answered (the file is left as it was) */
async function run({ games = L.readGames(), prev, get = getJSON, clock = () => new Date(), log = L.log, file = OUT(), write = true } = {}) {
  if (prev === undefined) prev = readLines(file);
  const now = clock(), todo = toCome(games, now);
  const days = [...new Set(todo.map(g => g.date))].sort();
  const n = { games: todo.length, days, lines: 0, noLines: 0, linesFailed: 0, props: 0, mains: 0, noProps: 0, propsFailed: 0, noId: 0, tipped: 0 };

  /* each date's scoreboard: its rows as fetch.js parses them, and its events by id */
  const boards = await Promise.all(days.map(async d => {
    try {
      const j = await get(SB + d.replace(/-/g, ''));
      if (!j || typeof j !== 'object' || !Array.isArray(j.events)) throw new Error('not a scoreboard answer');
      return { ok: true, at: iso(clock()), rows: F.parseDay(j).filter(r => r.date === d), events: new Map(j.events.map(e => [String((e && e.id) || ''), e])) };
    } catch (e) { log(`${d}: the scoreboard could not be read (${String(e && e.message || e).slice(0, 160)})`); return { ok: false }; }
  }));

  /* each game: its game lines from its day's answer, then whom to ask for props by ESPN's id */
  const reads = [];
  for (const g of todo) {
    const b = boards[days.indexOf(g.date)];
    const row = b.ok ? b.rows.find(r => r.game_id === g.game_id) : null;
    if (row && (row.status !== 'scheduled' || (row.tip && Date.parse(row.tip) <= now.getTime()))) { n.tipped++; continue; }
    let gl = null;
    if (row) { try { gl = { at: b.at, lines: LF.linesOf(LF.oddsGameLines(b.events.get(row.espn_id), row)) }; } catch (e) { gl = null; } }
    const espn = String((row && row.espn_id) || g.espn_id || '');
    reads.push({ g, row, gl, espn, pr: null, prStatus: /^\d+$/.test(espn) ? 'todo' : 'noId' });
  }
  const jobs = reads.filter(r => r.prStatus === 'todo');
  let next = 0;
  await Promise.all(Array.from({ length: Math.min(POOL, jobs.length) }, async () => {
    while (next < jobs.length) {
      const r = jobs[next++];
      let a; try { a = await PF.propRead(r.espn, get); } catch (e) { a = { status: 'failed', error: String(e && e.message || e) }; }
      const at = iso(clock());
      r.prStatus = a.status;
      if (a.status === 'ok') { const p = PF.propParse(a.items); r.pr = { at, mains: p.mains, ladders: p.ladders, yes: p.yes }; }
      else if (a.status === 'none') r.pr = { at, mains: [], ladders: [], yes: [] };
      else log(`${r.g.game_id}: its props could not be read (${String(a.error || '').slice(0, 160)})`);
    }
  }));

  const answered = boards.some(b => b.ok) || reads.some(r => r.prStatus === 'ok' || r.prStatus === 'none');
  if (todo.length && !answered) {
    log(`lines: nothing answered for the ${todo.length} games of ${days.join(' and ')}: ${path.basename(file)} is left as it was`);
    return { failed: true, n, written: false };
  }

  /* the file: every game still to come once the reads are back (one that tipped during them is not taken) */
  const end = clock(), games2 = {};
  for (const r of reads) {
    const tip = (r.row && r.row.tip) || r.g.tip;
    if (tip && Date.parse(tip) <= end.getTime()) { n.tipped++; continue; }
    const old = prev && prev.games ? prev.games[r.g.game_id] : null;
    const e = entryOf(old, r.espn, r.gl, r.pr);
    if (r.gl) (r.gl.lines.ml || r.gl.lines.spread || r.gl.lines.total ? n.lines++ : n.noLines++); else n.linesFailed++;
    if (r.prStatus === 'ok' && r.pr.mains.length + r.pr.ladders.length + r.pr.yes.length) { n.props++; n.mains += r.pr.mains.length; }
    else if (r.prStatus === 'ok' || r.prStatus === 'none') n.noProps++;
    else if (r.prStatus === 'noId') n.noId++; else n.propsFailed++;
    if (e) games2[r.g.game_id] = e;
  }
  /* written only when anything but the top-level `at` differs from the file as it stands, so a run that read nothing
     new leaves it (and its `at`) alone */
  const out = { v: 1, at: iso(end), games: games2 }, text = stringify(out);
  let before = null; try { before = fs.readFileSync(file, 'utf8'); } catch (e) { before = null; }
  const bare = t => t.replace(/^\{"v":1,"at":"[^"]*"/, '{"v":1,"at":""');
  const written = before === null || bare(before) !== bare(text);
  if (written && write) fs.writeFileSync(file, text);
  const kept = n.linesFailed + n.propsFailed + n.noId;
  /* a whole half failed for every game (every scoreboard refused, or every props read): the file keeps what it has, and
     the run is red so it is seen, not a feed quietly gone stale */
  const tried = reads.filter(r => r.prStatus !== 'noId');
  const halfDown = boards.length && boards.every(b => !b.ok) ? 'game lines' : tried.length && tried.every(r => r.prStatus !== 'ok' && r.prStatus !== 'none') ? 'player props' : null;
  if (halfDown) log(`lines: every ${halfDown} read failed this run: the last good reads are kept, and the step is red`);
  log(`lines: ${todo.length} games to come on ${days.join(' and ') || 'no date'}: ${n.lines} with DraftKings' game lines${n.noLines ? `, ${n.noLines} with none yet` : ''}; ${n.props} with player props (${n.mains} main lines)${n.noProps ? `, ${n.noProps} with none posted yet` : ''}`
    + `${kept ? `; ${[n.linesFailed && `${n.linesFailed} game lines`, n.propsFailed && `${n.propsFailed} props`, n.noId && `${n.noId} props with no ESPN id`].filter(Boolean).join(', ')} not read, the last good read kept` : ''}${n.tipped ? `; ${n.tipped} tipped off and left` : ''}; ${path.basename(file)} ${written ? `written (${(text.length / 1024).toFixed(0)} KB)` : 'unchanged'}`);
  return { failed: false, partial: halfDown, n, written, text, out };
}

module.exports = { SB, DAYS, POOL, getJSON, toCome, entryBad, readLines, stringify, entryOf, run };
if (require.main === module) run().then(r => { if (r.failed || r.partial) process.exit(1); }).catch(e => { console.error(e && e.stack || e); process.exit(1); });
