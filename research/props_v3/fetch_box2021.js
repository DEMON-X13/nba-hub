/* The 2020-21 box scores, fetched from ESPN for MA's projection layer to warm up on (PLAN.md section 1.4). Research only:
 * nothing here is fitted, and nothing of 2022-23 or later is asked for.
 *
 *   node research/props_v3/fetch_box2021.js
 *   writes research/props_v3/cache/box2021/ (gitignored): box_2021.csv and teambox_2021.jsonl in data/'s own columns,
 *   parsed.jsonl (one line a game, so a run stopped part way resumes where it was), requests.tsv (every request: when,
 *   the address, the HTTP status, the bytes) and fetch.log
 *
 * The games are data/games.csv's 2020-21 finals (season 2021: 1,086 typed REG, the play-in among them, and 85 POST), which
 * carry no ESPN id; each date's ids come off that day's scoreboard (one request a date, the game matched by its away and
 * home clubs), then each game's summary is read into the hub's columns by tools/fetch_box.js's own parseSummary (required,
 * never run: its main() writes the hub's data folder and is not called). About 191 + 1,171 requests, a quarter of a second
 * apart, through curl (the session's proxy), curl's own User-Agent and no header of the hub's. A request is tried three
 * times. The season is held to 2021: a game of any other season refuses the run.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const L = require(path.join(ROOT, 'tools', 'lib.js'));
const FB = require(path.join(ROOT, 'tools', 'fetch_box.js'));
const OUT = path.join(__dirname, 'cache', 'box2021');
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
const SEASON = 2021;
fs.mkdirSync(OUT, { recursive: true });
const PCOLS = ['game_id', 'date', 'team', 'opp', 'home', 'player_id', 'name', 'pos', 'starter', 'min', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pm', 'pts', 'dnp'];
const logf = path.join(OUT, 'fetch.log'), reqf = path.join(OUT, 'requests.tsv');
const log = m => { const s = `${new Date().toISOString()} ${m}`; console.log(s); fs.appendFileSync(logf, s + '\n'); };
if (!fs.existsSync(reqf)) fs.writeFileSync(reqf, 'at\turl\tstatus\tbytes\n');
const sleep = ms => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
function getJSON(url) {
  for (let i = 0; i < 3; i++) {
    let code = '000', body = '';
    try {
      const o = execFileSync('curl', ['-sS', '-m', '30', '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 256 << 20 });
      const k = o.lastIndexOf('\n'); code = o.slice(k + 1); body = o.slice(0, k);
    } catch (e) { code = 'ERR'; }
    fs.appendFileSync(reqf, `${new Date().toISOString()}\t${url}\t${code}\t${body.length}\n`);
    if (code === '200') { try { return JSON.parse(body); } catch (e) { /* a broken body: try again */ } }
    sleep(1500 * (i + 1));
  }
  return null;
}

const games = L.readGames().filter(g => +g.season === SEASON && g.status === 'final' && (g.type === 'REG' || g.type === 'POST'));
for (const g of games) if (+g.season !== SEASON || g.date < '2020-12-01' || g.date > '2021-07-31') throw new Error(`${g.game_id}: not a 2020-21 game`);
const parsedF = path.join(OUT, 'parsed.jsonl');
const done = new Map();
if (fs.existsSync(parsedF)) for (const l of fs.readFileSync(parsedF, 'utf8').split('\n').filter(Boolean)) { const r = JSON.parse(l); done.set(r.game_id, r); }
log(`2020-21: ${games.length} finals in data/games.csv, ${done.size} already parsed`);
const byDate = new Map(); for (const g of games) { if (!byDate.has(g.date)) byDate.set(g.date, []); byDate.get(g.date).push(g); }
let read = 0, failed = 0;
for (const [date, day] of [...byDate.entries()].sort()) {
  const todo = day.filter(g => !done.has(g.game_id));
  if (!todo.length) continue;
  const sb = getJSON(SITE + 'scoreboard?limit=100&dates=' + date.replace(/-/g, '')); sleep(250);
  const ids = {};
  for (const e of (sb && sb.events) || []) {
    const c = e.competitions && e.competitions[0]; if (!c) continue;
    const h = c.competitors.find(x => x.homeAway === 'home'), a = c.competitors.find(x => x.homeAway === 'away');
    if (h && a) ids[L.fromEspn(a.team.abbreviation) + '@' + L.fromEspn(h.team.abbreviation)] = String(e.id);
  }
  for (const g of todo) {
    const id = ids[g.away + '@' + g.home];
    if (!id) { failed++; log(`${g.game_id}: no ESPN id on ${date}'s scoreboard`); continue; }
    const j = getJSON(SITE + 'summary?event=' + id); sleep(250);
    if (!j) { failed++; log(`${g.game_id} (${id}): no answer`); continue; }
    let out;
    try { out = FB.parseSummary(j, g); } catch (e) { failed++; log(`${g.game_id} (${id}): ${e.message}`); continue; }
    const rec = { game_id: g.game_id, espn_id: id, players: out.players, teams: out.teams };
    fs.appendFileSync(parsedF, JSON.stringify(rec) + '\n'); done.set(g.game_id, rec); read++;
    if (read % 100 === 0) log(`${read} read (${date})`);
  }
}
/* the two files, in data/'s own columns and order */
const rows = [], teams = [];
for (const r of done.values()) { rows.push(...r.players); teams.push(...r.teams); }
rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : a.team < b.team ? -1 : a.team > b.team ? 1 : b.min - a.min);
fs.writeFileSync(path.join(OUT, 'box_2021.csv'), [PCOLS.join(',')].concat(rows.map(r => PCOLS.map(c => r[c] === undefined ? '' : r[c]).join(','))).join('\n') + '\n');
teams.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.game_id + a.team) < (b.game_id + b.team) ? -1 : 1);
fs.writeFileSync(path.join(OUT, 'teambox_2021.jsonl'), teams.map(t => JSON.stringify(t)).join('\n') + '\n');
log(`done: ${read} read this run, ${failed} failed, ${done.size} of ${games.length} games parsed; ${rows.length} player rows, ${teams.length} team rows`);
