/* Daily pull of NBA results, the coming slate and its lines from ESPN's public scoreboard feed.
 *
 *   node nba-hub/tools/fetch.js                      every day from the last final in games.csv to ten days out
 *   node nba-hub/tools/fetch.js --from 2025-03-18 --to 2025-06-30
 *   node nba-hub/tools/fetch.js --offline data.json  parse one saved scoreboard payload (for tests)
 *
 * One request per calendar day (Eastern). A day already complete in games.csv (every game final) is not
 * asked for again, and July to September are skipped, so a rerun costs a handful of requests. Games are
 * upserted by id: a day's ESPN rows are replaced by what the feed says now, so a postponed game leaves
 * its old date and appears on the new one. Rows from the history file are kept unless the feed has a
 * final for the same game. ESPN carries a line only before tip-off, so the line a final keeps is the last
 * one seen on it, the morning-of line from the day's earlier pull. Preseason games are ignored. Exit 1 if ESPN could not be read at all, so a
 * network block shows as a failed run and not as a quiet day with no games.
 */
'use strict';
const fs = require('fs');
const L = require('./lib');

const SB = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?limit=100&dates=';
const AHEAD = 10;
const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const sleep = ms => new Promise(r => setTimeout(r, ms));

/* the feed's odds line reads "BOS -6.5" or "EVEN"; the table keeps the home side's number */
function homeLine(odds, homeAb) {
  if (!odds || !odds.details) return '';
  const m = /^([A-Z]+)\s+([-+]?\d+(\.\d+)?)/.exec(odds.details.trim());
  if (!m) return /EVEN|PK/i.test(odds.details) ? '0' : '';
  const n = parseFloat(m[2]);
  return String(L.fromEspn(m[1]) === homeAb ? n : -n);
}

/* one scoreboard payload -> rows for the games table */
function parseDay(j) {
  const rows = [];
  for (const e of j.events || []) {
    const c = e.competitions && e.competitions[0];
    if (!c) continue;
    const type = e.season && e.season.type;
    if (type === 1) continue;                                      // preseason
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
    rows.push({ game_id: L.gameId(season, date, A, H), season, date, type: type === 2 ? 'REG' : 'POST', away: A, home: H,
      away_score: done ? parseInt(away.score, 10) : '', home_score: done ? parseInt(home.score, 10) : '',
      neutral: c.neutralSite ? 1 : 0, status: done ? 'final' : /IN_PROGRESS|HALFTIME|END_PERIOD/.test(st) ? 'live' : 'scheduled',
      home_line: homeLine(odds, H), total: odds && odds.overUnder != null ? String(odds.overUnder) : '', source: 'espn', espn_id: String(e.id || ''), tip: e.date ? new Date(e.date).toISOString().slice(0, 16) + 'Z' : '' });
  }
  return rows;
}

function merge(have, date, fresh) {
  const prev = new Map(have.map(r => [r.game_id, r]));
  const keep = have.filter(r => !(r.date === date && r.source === 'espn'));
  const byId = new Map(keep.map(r => [r.game_id, r]));
  for (const r of fresh) {
    const old = prev.get(r.game_id);
    if (old && old.source !== 'espn' && old.status === 'final') continue;   // history already has this final
    /* ESPN carries odds only before tip-off, so a final arrives without them: keep the last line seen,
       the morning-of line from the day's earlier pull */
    if (old) { if (!r.home_line && old.home_line) r.home_line = old.home_line; if (!r.total && old.total) r.total = old.total; if (!r.tip && old.tip) r.tip = old.tip; }
    byId.set(r.game_id, r);
  }
  return [...byId.values()];
}

async function main() {
  const offline = opt('--offline');
  if (offline) {
    const rows = parseDay(JSON.parse(fs.readFileSync(offline, 'utf8')));
    console.log(JSON.stringify(rows, null, 1)); return;
  }
  let have = L.readGames();
  const today = L.etDate(new Date());
  const lastFinal = have.filter(r => r.status === 'final').reduce((m, r) => r.date > m ? r.date : m, '');
  const from = opt('--from') || (lastFinal ? L.addDays(lastFinal, 1) : '2025-03-18');
  const to = opt('--to') || L.addDays(today, AHEAD);
  const complete = new Set();
  const byDate = {};
  for (const r of have) (byDate[r.date] = byDate[r.date] || []).push(r);
  for (const [d, rs] of Object.entries(byDate)) if (d < today && rs.every(r => r.status === 'final')) complete.add(d);

  let asked = 0, ok = 0, fails = 0, games = 0;
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
    ok++;
    if (ok === 1) L.log(`first day read: ${(j.events || []).length} events, season types ${[...new Set((j.events || []).map(e => e.season && e.season.type))].join('/') || 'none'}`);
    const rows = parseDay(j).filter(r => r.date === d);           // a late West Coast game lands on the day it tipped off, Eastern
    games += rows.length;
    have = merge(have, d, rows);
    if (rows.length) L.log(`${d}: ${rows.length} games, ${rows.filter(r => r.status === 'final').length} final`);
    await sleep(300);
  }
  const changed = L.writeGames(have);
  L.log(`fetch ${from} to ${to}: ${asked} days asked, ${ok} read, ${fails} failed, ${games} games seen, games.csv ${changed ? 'written' : 'unchanged'}`);
  if (asked && !ok) process.exit(1);
}

module.exports = { parseDay, merge, homeLine };
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
