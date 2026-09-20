/* Shared pieces for the NBA tools: the games table, team codes, dates, ESPN access. No dependencies. */
'use strict';
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..', '..');
const GAMES = path.join(ROOT, 'nba-hub', 'data', 'games.csv');
const COLS = ['game_id', 'season', 'date', 'type', 'away', 'home', 'away_score', 'home_score', 'neutral', 'status', 'home_line', 'total', 'source', 'espn_id', 'tip'];

/* The 30 codes this site uses. Both sources are mapped onto them. */
const TEAMS = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
/* history file codes (Basketball Reference style) and defunct franchises folded into their current team */
const HIST_AB = { BRK: 'BKN', NJN: 'BKN', CHO: 'CHA', PHO: 'PHX', SEA: 'OKC', NOK: 'NOP', NOH: 'NOP' };
/* ESPN codes that differ */
const ESPN_AB = { GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS' };
const fromHist = c => HIST_AB[c] || c;
const fromEspn = c => ESPN_AB[c] || c;

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* season = the year it ends: 2026 is 2025-26. A date from July on belongs to the next season. */
const seasonOf = iso => { const y = +iso.slice(0, 4), m = +iso.slice(5, 7); return m >= 7 ? y + 1 : y; };
const etDate = d => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(d));
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const gameId = (season, date, away, home) => `${season}_${date.replace(/-/g, '')}_${away}_${home}`;

/* tiny CSV: no field here ever holds a comma or a quote */
function readGames() {
  if (!fs.existsSync(GAMES)) return [];
  const lines = fs.readFileSync(GAMES, 'utf8').trim().split('\n');
  const head = lines.shift().split(',');
  return lines.map(l => { const v = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = v[i] === undefined ? '' : v[i]; }); return o; });
}
function writeGames(rows) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : 0);
  const body = [COLS.join(',')].concat(rows.map(r => COLS.map(c => r[c] === undefined || r[c] === null ? '' : String(r[c])).join(','))).join('\n') + '\n';
  const before = fs.existsSync(GAMES) ? fs.readFileSync(GAMES, 'utf8') : '';
  if (before !== body) fs.writeFileSync(GAMES, body);
  return before !== body;
}

/* ESPN refuses some header sets from some networks; try a few. Plain UA works from GitHub's runners (news tracker, checked 2026-09-15). */
const HEADER_SETS = [{ 'User-Agent': 'nfl-hub-nba/1.0 (+https://github.com/DEMON-X13/nfl-hub)', 'Accept': 'application/json' }, {}, { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36', 'Accept': 'application/json' }];
async function fetchRetry(url) {
  let last;
  for (let i = 0; i < HEADER_SETS.length; i++) {
    try {
      const r = await fetch(url, { headers: HEADER_SETS[i], redirect: 'follow' });
      if (r.ok) return r;
      last = new Error('HTTP ' + r.status + ' ' + url);
      if (![403, 408, 429, 500, 502, 503, 504].includes(r.status)) break;
    } catch (e) { last = e; }
    await new Promise(res => setTimeout(res, 1500));
  }
  throw last;
}
const getJSON = async url => (await fetchRetry(url)).json();
const getText = async url => (await fetchRetry(url)).text();

module.exports = { ROOT, GAMES, COLS, TEAMS, fromHist, fromEspn, log, seasonOf, etDate, addDays, gameId, readGames, writeGames, getJSON, getText };
