/* THE TEST STEP ONLY (PLAN.md 3.1, L1): DraftKings' 2022-23 lines without the column that tells the result, as
 * research/props_v3/lines_clean.js made 2023-24's. WRITTEN AND REVIEWED, NOT RUN before the preregistration.
 *
 *   node research/props_v3/test/lines_clean_2023.js
 *
 * Reads research/props_v2/cache/props40_2023.csv (fetch_dk40.js's columns, the seventh last_updated) and
 * props40_reads.json; writes research/props_v3/cache/dk40_2023_lines.csv (game_id,player_id,stat,line,over,under, every
 * row of 2022-23 in the same order), dk40_2023_starts.csv (game_id,start) and dk40_2023_lines.sha256 (both files'
 * SHA-256, which the scorer's V-hash checks the bytes it reads against). It refuses to run before the fetch's marker
 * (cache/fetch_dk40_2023.ran) exists, and refuses a row of another season.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SRC = path.join(ROOT, 'research', 'props_v2', 'cache');
const DST = path.join(ROOT, 'research', 'props_v3', 'cache');
if (!fs.existsSync(path.join(DST, 'fetch_dk40_2023.ran'))) throw new Error('refused: the 2022-23 fetch (test/fetch_dk40_2023_logged.sh) has not run');
const COLS = 'game_id,player_id,stat,line,over,under';
const t = fs.readFileSync(path.join(SRC, 'props40_2023.csv'), 'utf8').split('\n').filter(Boolean);
if (t.shift() !== COLS + ',last_updated') throw new Error('props40_2023.csv is not in fetch_dk40.js\'s columns');
const rows = t.map(l => { const v = l.split(','); if (v.length !== 7) throw new Error('a row of props40_2023.csv has other than seven fields'); if (!/^2023_/.test(v[0])) throw new Error(`a row of another season: ${v[0]}`); return v.slice(0, 6).join(','); });
const body = [COLS, ...rows].join('\n') + '\n';
const reads = JSON.parse(fs.readFileSync(path.join(SRC, 'props40_reads.json'), 'utf8'));
const sbody = ['game_id,start', ...Object.keys(reads).filter(k => /^2023_/.test(k)).sort().map(k => `${k},${reads[k].start || ''}`)].join('\n') + '\n';
const sums = {};
for (const [f, b] of [['dk40_2023_lines.csv', body], ['dk40_2023_starts.csv', sbody]]) {
  const tmp = path.join(DST, f + '.tmp'); fs.writeFileSync(tmp, b); fs.renameSync(tmp, path.join(DST, f));
  sums[f] = crypto.createHash('sha256').update(b).digest('hex');
}
fs.writeFileSync(path.join(DST, 'dk40_2023_lines.sha256'), JSON.stringify(sums, null, 1) + '\n');
console.log(JSON.stringify(sums));
