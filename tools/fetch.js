/* Daily pull of NBA results, the coming slate and its lines from ESPN's public scoreboard feed.
 *
 *   node tools/fetch.js                      every day from the first with a game not final (three weeks back at
 *                                            most), else the day after the last final, to thirty days out
 *   node tools/fetch.js --from 2025-03-18 --to 2025-06-30
 *   node tools/fetch.js --offline data.json  print the parse of one saved scoreboard payload (by hand)
 *
 * One request per calendar day (Eastern). A day already complete in games.csv (every game final) is not
 * asked for again, and July to September are skipped, so a rerun costs a handful of requests. Games are
 * upserted by id: a day's ESPN rows are replaced by what the feed says now, so a postponed game leaves
 * its old date and appears on the new one. Rows from the history file are kept unless the feed has a
 * final for the same game. ESPN carries a line only before tip-off, so the line a final keeps is the last
 * one seen on it, the morning-of line from the day's earlier pull. A game's national networks (tv) are kept the same
 * way, frozen at tip-off with its lines (README "The lines feed"). Preseason games are kept, typed PRE:
 * the page shows them, but neither model learns from them, no box score is pulled and the record skips them.
 * The pull looks thirty days ahead so opening night is known from the schedule. Exit 1 if ESPN could not be read at all, so a
 * network block shows as a failed run and not as a quiet day with no games.
 */
'use strict';
const fs = require('fs');
const L = require('./lib');

const SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100&dates=';
const AHEAD = 30;                                  // far enough to see opening night from the preseason; the page shows ten days
const opt = k => { const args = process.argv.slice(2), i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };   // read at call time, so a test can set them
const sleep = ms => new Promise(r => setTimeout(r, ms));
const PAUSE = process.env.NBA_FETCH_PAUSE_MS != null ? +process.env.NBA_FETCH_PAUSE_MS : 300;   // between days; the tests set 0

/* the feed's odds line reads "BOS -6.5" or "EVEN"; the table keeps the home side's number */
function homeLine(odds, homeAb) {
  if (!odds || !odds.details) return '';
  const m = /^([A-Z]+)\s+([-+]?\d+(\.\d+)?)/.exec(odds.details.trim());
  if (!m) return /EVEN|PK/i.test(odds.details) ? '0' : '';
  const n = parseFloat(m[2]);
  return String(L.fromEspn(m[1]) === homeAb ? n : -n);
}

/* ESPN puts the moneylines in one of two places: homeTeamOdds.moneyLine (the older form, seen on a saved summary)
   or moneyline.home.close.odds / .open.odds (the newer form, DraftKings' price, confirmed live on 2026-10-13).
   Read whichever is filled. */
const asMl = v => { if (v == null || v === '') return ''; if (/^(EVEN|PK)$/i.test(String(v))) return '100';
  const n = parseInt(String(v).replace('+', ''), 10); return Number.isFinite(n) && Math.abs(n) >= 100 ? String(n) : ''; };
function moneyline(odds, side) {
  if (!odds) return '';
  const o = odds[side + 'TeamOdds'];
  if (o) { const v = asMl(o.moneyLine) || asMl(o.current && o.current.moneyLine && o.current.moneyLine.american); if (v) return v; }
  const n = odds.moneyline && odds.moneyline[side];
  if (n) {
    const close = n.close && n.close.odds;
    if (close != null && close !== '') return asMl(close);         // 'OFF' is the book holding no price, never the opening one
    const v = asMl(n.current && n.current.odds) || asMl(n.open && n.open.odds) || asMl(n.odds); if (v) return v;
  }
  return '';
}

/* the national networks a game is on, as the games table keeps them (tv, names joined by '|'): every name ESPN's
   broadcasts list in the national market, then any national TV listing its geoBroadcasts adds (market type National,
   type TV). A local listing (the home or away market: a regional sports network, League Pass, a team's app) is never
   one. A name is kept as ESPN writes it, with any comma, quote or bar taken out (the table is a plain CSV); none is
   '' */
function national(c) {
  const out = [], add = n => { const t = String(n == null ? '' : n).replace(/[,|"\r\n]+/g, ' ').replace(/\s+/g, ' ').trim(); if (t && !out.includes(t)) out.push(t); };
  const mk = m => String(m && typeof m === 'object' ? m.type : m == null ? '' : m);
  for (const b of Array.isArray(c.broadcasts) ? c.broadcasts : []) if (b && /^national$/i.test(mk(b.market))) for (const n of Array.isArray(b.names) ? b.names : []) add(n);
  for (const b of Array.isArray(c.geoBroadcasts) ? c.geoBroadcasts : []) if (b && /^national$/i.test(mk(b.market)) && b.type && /^tv$/i.test(String(b.type.shortName || ''))) add(b.media && b.media.shortName);
  return out.join('|');
}

/* one scoreboard payload -> rows for the games table */
function parseDay(j) {
  const rows = [];
  for (const e of j.events || []) {
    const c = e.competitions && e.competitions[0];
    if (!c) continue;
    const type = e.season && e.season.type;
    const home = c.competitors.find(x => x.homeAway === 'home'), away = c.competitors.find(x => x.homeAway === 'away');
    if (!home || !away) continue;
    const H = L.fromEspn(home.team.abbreviation), A = L.fromEspn(away.team.abbreviation);
    if (!L.TEAMS.includes(H) || !L.TEAMS.includes(A)) continue;   // an exhibition against a non-NBA side
    const st = (c.status && c.status.type && c.status.type.name) || '';
    if (/POSTPONED|CANCELED/.test(st)) continue;
    const done = !!(c.status && c.status.type && c.status.type.completed);
    const date = L.etDate(e.date);
    const season = (e.season && e.season.year) || L.seasonOf(date);
    const odds = (c.odds || [])[0];
    rows.push({ game_id: L.gameId(season, date, A, H), season, date, type: type === 1 ? 'PRE' : type === 3 ? 'POST' : 'REG', /* the play-in (5) is REG, as in the history */ away: A, home: H,
      away_score: done ? parseInt(away.score, 10) : '', home_score: done ? parseInt(home.score, 10) : '',
      neutral: c.neutralSite ? 1 : 0, status: done ? 'final' : /IN_PROGRESS|HALFTIME|END_PERIOD/.test(st) ? 'live' : 'scheduled',
      home_line: homeLine(odds, H), total: odds && odds.overUnder != null ? String(odds.overUnder) : '', source: 'espn', espn_id: String(e.id || ''), home_ml: moneyline(odds, 'home'), away_ml: moneyline(odds, 'away'), tip: e.date ? new Date(e.date).toISOString().slice(0, 16) + 'Z' : '', tv: national(c) });
  }
  return rows;
}

/* The market a game keeps is the last one read before tip-off. Once a game has started (ESPN says live or final,
   or its tip time has passed) a fresh read's lines are not taken: a run that lands during the game (scheduled runs
   start hours late) would otherwise store an in-game line, and the record would grade against it. The national networks
   (tv) are kept by the same rules: what ESPN listed before tip-off is what a game was on (Suggested Parlays' featured
   games), and a read with none keeps the last. */
const MARKET = ['home_line', 'total', 'home_ml', 'away_ml'];
const KEPT = MARKET.concat('tv');
function merge(have, date, fresh, now = new Date()) {
  const prev = new Map(have.map(r => [r.game_id, r]));
  const keep = have.filter(r => !(r.date === date && r.source === 'espn'));
  const byId = new Map(keep.map(r => [r.game_id, r]));
  const nowIso = now.toISOString();
  for (const r of fresh) {
    const old = prev.get(r.game_id);
    if (old && old.source !== 'espn' && old.status === 'final') continue;   // history already has this final
    if (old) {
      if (!r.tip && old.tip) r.tip = old.tip;
      if (!r.home_ml !== !r.away_ml) { r.home_ml = ''; r.away_ml = ''; }   // a read with one side only is no price: a pair is never two reads
      const started = r.status !== 'scheduled' || (r.tip && r.tip <= nowIso);
      if (started) for (const k of KEPT) r[k] = old[k] || '';                   // frozen at tip: the last pre-game read
      else for (const k of KEPT) if (!r[k] && old[k]) r[k] = old[k];            // a read with no line keeps the last one
      if (!r.home_ml !== !r.away_ml) { r.home_ml = old.home_ml || ''; r.away_ml = old.away_ml || ''; }   // both sides or neither
    } else if (r.status !== 'scheduled' || (r.tip && r.tip <= nowIso)) for (const k of KEPT) r[k] = '';     // first seen after tip: no pre-game line
    byId.set(r.game_id, r);
  }
  return [...byId.values()];
}

async function main(now = new Date()) {
  const offline = opt('--offline');
  if (offline) {
    const rows = parseDay(JSON.parse(fs.readFileSync(offline, 'utf8')));
    console.log(JSON.stringify(rows, null, 1)); return;
  }
  let have = L.readGames();
  const today = L.etDate(now);
  const lastFinal = have.filter(r => r.status === 'final').reduce((m, r) => r.date > m ? r.date : m, '');
  /* start from the day after the last final, or earlier where a day up to today still has a game not final: a run
     that lands mid-slate finishes some of a night's games and not others, and those others must be read again (an
     afternoon final today would otherwise move the start to tomorrow and leave tonight's games unread) */
  const stale = have.filter(r => r.status !== 'final' && r.date <= today && r.date >= L.addDays(today, -21)).map(r => r.date).sort()[0];
  const from = opt('--from') || [stale, lastFinal ? L.addDays(lastFinal, 1) : '2025-03-18'].filter(Boolean).sort()[0];
  if (stale) L.log(`re-reading from ${stale}: a past day still has a game not final`);
  const to = opt('--to') || L.addDays(today, AHEAD);
  const complete = new Set();
  const byDate = {};
  for (const r of have) (byDate[r.date] = byDate[r.date] || []).push(r);
  for (const [d, rs] of Object.entries(byDate)) if (d < today && rs.every(r => r.status === 'final')) complete.add(d);

  let asked = 0, ok = 0, fails = 0, games = 0, withMl = 0, withLine = 0, empty = 0;
  for (let d = from; d <= to; d = L.addDays(d, 1)) {
    const m = +d.slice(5, 7);
    if (m >= 7 && m <= 9) continue;                               // no NBA games in July, August, September
    if (complete.has(d)) continue;
    asked++;
    let j;
    try { j = await L.getJSON(SB + d.replace(/-/g, '')); }
    catch (e) {
      fails++; L.log(`${d}: ${e.message}`);
      if (ok === 0 && fails >= 3) throw new Error('ESPN scoreboard unreachable from this network: three days in a row failed and none succeeded');
      if (fails >= 10) throw new Error('too many failed days, stopping so a partial pull is not published');
      continue;
    }
    const rows = parseDay(j).filter(r => r.date === d);           // a late West Coast game lands on the day it tipped off, Eastern
    /* an answer with no events at all for a day the table has games on, from yesterday to the board's ten days out,
       is a feed hiccup and not a cleared day: taking it would drop the day's games from the slate and, read again after
       tip, lose their lines for good. It is a failed read and the rows stay. An answer with events is a read, even if
       none of them is kept (a postponed game comes back as an event, so a lone postponed game leaves the table at
       once). Two days past, or beyond the board, an empty day is taken */
    const had = have.filter(r => r.date === d && r.source === 'espn').length;
    const noEvents = !(j.events || []).length;
    if (noEvents && had && d >= L.addDays(today, -1) && d <= L.addDays(today, 10)) {
      empty++; fails++; L.log(`${d}: the feed answered with no games where the table has ${had}; kept as they were`);
      if (ok === 0 && fails >= 3) throw new Error('ESPN scoreboard answered with no games three days in a row and nothing else: not publishing a cleared slate');
      if (fails >= 10) throw new Error('too many failed days, stopping so a partial pull is not published');
      continue;
    }
    ok++;
    if (ok === 1) L.log(`first day read: ${(j.events || []).length} events, season types ${[...new Set((j.events || []).map(e => e.season && e.season.type))].join('/') || 'none'}`);
    games += rows.length; withMl += rows.filter(r => r.status !== 'final' && r.home_ml).length; withLine += rows.filter(r => r.status !== 'final' && r.home_line).length;
    /* an empty answer for a day further back, read again for a game still to finish, keeps the day's finals: only the
       unfinished games go (not played that day) */
    if (noEvents && had && d < L.addDays(today, -1)) rows.push(...have.filter(r => r.date === d && r.source === 'espn' && r.status === 'final').map(r => ({ ...r })));
    have = merge(have, d, rows, now);
    if (rows.length) L.log(`${d}: ${rows.length} games, ${rows.filter(r => r.status === 'final').length} final`);
    await sleep(PAUSE);
  }
  const changed = L.writeGames(have);
  L.log(`fetch ${from} to ${to}: ${asked} days asked, ${ok} read, ${fails} failed${empty ? ` (${empty} answered empty)` : ''}, ${games} games seen (${withLine} upcoming with a spread, ${withMl} with moneylines), games.csv ${changed ? 'written' : 'unchanged'}`);
  if (asked && !ok) process.exit(1);
}

module.exports = { parseDay, merge, homeLine, moneyline, national, MARKET, KEPT, main };
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
