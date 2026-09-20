/* One-time import of the game history the model is fitted on.
 *
 *   node nba-hub/tools/history.js [--file path/to/nba_elo.csv]
 *
 * Source: Neil Paine's continuation of the FiveThirtyEight NBA Elo file (every game since 1946,
 * one row per team per game), https://github.com/Neil-Paine-1/NBA-elo. Seasons from 2005 on are
 * kept, one row per game, with team codes mapped onto this site's and defunct franchises folded
 * into their current team (Sonics to OKC, Nets to BKN, Hornets to NOP and CHA). Rows the ESPN
 * fetch already wrote (source espn) are left alone; the history only fills what it lacks.
 */
'use strict';
const fs = require('fs');
const L = require('./lib');

const URL = 'https://raw.githubusercontent.com/Neil-Paine-1/NBA-elo/master/nba_elo.csv';
const FROM = 2005;
const args = process.argv.slice(2);
const fileArg = args.indexOf('--file') >= 0 ? args[args.indexOf('--file') + 1] : null;

async function main() {
  const txt = fileArg ? fs.readFileSync(fileArg, 'utf8') : await L.getText(URL);
  const lines = txt.trim().split('\n');
  const head = lines.shift().split(',');
  const ix = Object.fromEntries(head.map((h, i) => [h, i]));
  const seen = new Set();
  const out = [];
  for (const line of lines) {
    const v = line.split(',');
    const season = +v[ix.season];
    if (season < FROM) continue;
    const date = v[ix.date];
    const t1 = L.fromHist(v[ix.team1]), t2 = L.fromHist(v[ix.team2]);
    const key = date + ':' + [t1, t2].sort().join('-');
    if (seen.has(key)) continue;                 // the pair's second row is the same game from the other side
    seen.add(key);
    const neutral = v[ix.neutral] === '1';
    /* the file lists each game twice; the home team's row has is_home=1. Neutral games have is_home=0 on
       both rows and the first row listed is the designated home side, which is what we get here. */
    const isHome = v[ix.is_home] === '1' || neutral;
    const home = isHome ? t1 : t2, away = isHome ? t2 : t1;
    const hs = isHome ? +v[ix.score1] : +v[ix.score2], as = isHome ? +v[ix.score2] : +v[ix.score1];
    out.push({ game_id: L.gameId(season, date, away, home), season, date, type: v[ix.playoff] === 'TRUE' ? 'POST' : 'REG',
      away, home, away_score: as, home_score: hs, neutral: neutral ? 1 : 0, status: 'final', home_line: '', total: '', source: 'paine' });
  }
  const have = L.readGames();
  const espn = new Set(have.filter(r => r.source === 'espn').map(r => r.game_id));
  const keep = have.filter(r => r.source === 'espn');
  const fromHist = out.filter(r => !espn.has(r.game_id));
  const changed = L.writeGames(keep.concat(fromHist));
  const last = fromHist.reduce((m, r) => r.date > m ? r.date : m, '');
  L.log(`history: ${fromHist.length} games ${FROM}-${last} from the Paine file, ${keep.length} ESPN rows kept, games.csv ${changed ? 'written' : 'unchanged'}`);
}
main().catch(e => { console.error(e); process.exit(1); });
