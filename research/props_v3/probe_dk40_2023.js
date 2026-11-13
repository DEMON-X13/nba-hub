/* ONE availability probe of DraftKings' 2022-23 provider-40 props on ESPN's feed: is the one-shot test's feed still
 * served? It makes exactly one request and reads no price and no outcome: curl writes the answer's body to /dev/null and
 * prints only the HTTP status, which is all this records. It is run once: it refuses if its result file exists.
 *
 *   node research/props_v3/probe_dk40_2023.js
 *
 * The game is chosen from research/props_v2/results/espn_coverage.tsv, which records only HTTP statuses and item counts
 * (props_v2 asked provider 40 for one 2022-23 game in four on 5 November 2026): the first regular-season game dated
 * 15 January 2023 or later that answered 200 for provider 40 then. Only the tsv's game, season, type, date, ESPN id,
 * provider and status columns are read. Writes research/props_v3/results/probe_dk40_2023.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const OUT = path.join(__dirname, 'results', 'probe_dk40_2023.json');
if (fs.existsSync(OUT)) { console.error(`refused: ${path.relative(process.cwd(), OUT)} exists; the probe is made once`); process.exit(1); }
const TSV = path.join(__dirname, '..', 'props_v2', 'results', 'espn_coverage.tsv');
const t = fs.readFileSync(TSV, 'utf8').trim().split('\n'), h = t.shift().split('\t'), c = n => h.indexOf(n);
const pick = t.map(l => l.split('\t'))
  .filter(v => v[c('season')] === '2023' && v[c('type')] === 'REG' && v[c('provider')] === '40' && v[c('http')] === '200' && v[c('date')] >= '2023-01-15')
  .sort((a, b) => a[c('date')] < b[c('date')] ? -1 : a[c('date')] > b[c('date')] ? 1 : a[c('game_id')] < b[c('game_id')] ? -1 : 1)[0];
if (!pick) throw new Error('no 2022-23 game in espn_coverage.tsv answered 200 for provider 40 from 15 January 2023');
const E = pick[c('espn_id')];
const url = `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${E}/competitions/${E}/odds/40/propBets?lang=en&region=us&limit=1&page=1`;
const asked = new Date().toISOString().slice(0, 19) + 'Z';
let http = null, error = null;
try { http = execFileSync('curl', ['-sS', '-m', '30', '-o', '/dev/null', '-w', '%{http_code}', url], { encoding: 'utf8' }).trim(); }
catch (e) { error = String(e.message).split('\n')[0]; }
const out = { what: 'research/props_v3/probe_dk40_2023.js: one request to the 2022-23 provider-40 propBets feed, body discarded unread (curl -o /dev/null), the HTTP status kept; no price or outcome is read',
  asked, game_id: pick[c('game_id')], espn_id: E, url, http, error,
  then: { source: 'research/props_v2/results/espn_coverage.tsv (props_v2, 5 November 2026)', http: pick[c('http')] },
  reading: http === '200' ? 'served: the feed answers 200 for this game, as on 5 November 2026' : http === '404' ? 'not served: the feed answers 404 (No propBets found) for a game that answered 200 on 5 November 2026' : 'unclear: no HTTP 200 or 404' };
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
