/* DraftKings' 2023-24 provider-40 lines without the column that tells the result. research/props_v2/fetch_dk40.js
 * writes each line's `last_updated` beside the record's six columns, and that stamp calls 95.5% of the graded lines
 * right on its own (research/props_v3/fetch_check.js, `clean.stamps.tellsTheResult`): it is when DraftKings last
 * touched the line, and a line whose Over landed was touched when it landed, during the game. So a candidate reads
 * this copy, never the fetch's csv: the record's own columns (data/props_2026.csv's), and nothing else.
 *
 *   node research/props_v3/lines_clean.js
 *
 * Writes research/props_v3/cache/dk40_2024_lines.csv (gitignored): game_id,player_id,stat,line,over,under, every row of
 * research/props_v2/cache/props40_2024.csv (the regular season, the play-in and the playoffs to 30 April 2024) in the
 * same order; and research/props_v3/cache/dk40_2024_starts.csv: game_id,start, each game's scheduled start as the
 * event gave it (props40_reads.json), which is known before tip-off. It prints the SHA-256 of both. It handles 2023-24
 * alone: the 2022-23 lines are the one-shot test's, and their Test step strips the stamp the same way.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const SRC = path.join(ROOT, 'research', 'props_v2', 'cache');
const DST = path.join(__dirname, 'cache');
const COLS = 'game_id,player_id,stat,line,over,under';
const t = fs.readFileSync(path.join(SRC, 'props40_2024.csv'), 'utf8').split('\n').filter(Boolean);
if (t.shift() !== COLS + ',last_updated') throw new Error('props40_2024.csv is not in fetch_dk40.js\'s columns');
const rows = t.map(l => { const v = l.split(','); if (v.length !== 7) throw new Error('a row of props40_2024.csv has other than seven fields'); if (!/^2024_/.test(v[0])) throw new Error(`a row of another season: ${v[0]}`); return v.slice(0, 6).join(','); });
const body = [COLS, ...rows].join('\n') + '\n';
const reads = JSON.parse(fs.readFileSync(path.join(SRC, 'props40_reads.json'), 'utf8'));
const starts = Object.keys(reads).filter(k => /^2024_/.test(k)).sort().map(k => `${k},${reads[k].start || ''}`);
const sbody = ['game_id,start', ...starts].join('\n') + '\n';
fs.mkdirSync(DST, { recursive: true });
for (const [f, b] of [['dk40_2024_lines.csv', body], ['dk40_2024_starts.csv', sbody]]) {
  const tmp = path.join(DST, f + '.tmp'); fs.writeFileSync(tmp, b); fs.renameSync(tmp, path.join(DST, f));
  console.log(`${path.relative(ROOT, path.join(DST, f))}: ${b.split('\n').length - 2} rows, SHA-256 ${crypto.createHash('sha256').update(b).digest('hex')}`);
}
