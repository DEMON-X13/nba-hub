/* MA's table of every line DraftKings posted, on the development sets (research only).
 *
 *   node research/props_v3/ma/ma_rows.js   -> research/props_v3/cache/ma/rows_<set>.json (gitignored; about a minute)
 *
 *   2024     DraftKings' 2023-24 regular-season lines on provider 40 (cache/dk40_2024_lines.csv, the six clean columns:
 *            ma_lib.js refuses a seventh), the window props_v2's test scored: DEVELOPMENT data
 *   archive  DraftKings' 2026 play-in and playoff closing lines, the six base stats (data/props_2026.csv): SPENT, a sign
 *            check only (D8)
 *
 * Every posted line is kept. Its pre-game fields come from ma_lib.js's replay (P23 at results/ma_p23.json, a player's
 * club from earlier boxes, the stat mix over every posted line of his with a projection); its outcome fields (`status`,
 * `o`, `y`, `minPlayed`) are attached afterwards from the game's own box, for the scorer alone. A line whose player has
 * no club on record in the game (`club` null) is out of the sample (PLAN.md 1.5). The replay walks the 2020-21 to 2025-26
 * boxes, 2022-23's as history (PLAN.md 1.4); no 2022-23 line exists here, and none is read.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('./ma_lib.js');
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const P = JSON.parse(fs.readFileSync(path.join(M.ROOT, 'research', 'props_v3', 'results', 'ma_p23.json'), 'utf8')).P;
const D = M.loadData();
const gamesById = new Map(D.games.map(g => [g.game_id, g]));
const OUT = path.join(M.CACHE, 'ma'); fs.mkdirSync(OUT, { recursive: true });
for (const set of (process.argv[2] ? [process.argv[2]] : ['2024', 'archive'])) {
  const lines = set === '2024' ? M.lines2024(gamesById) : M.linesArchive();
  if (lines.some(l => { const g = gamesById.get(l.game); return g && g.season === 2023; })) throw new Error('a 2022-23 line');
  const rows = M.buildRows(lines, D, P);
  const n = M.attachOutcomes(rows, D.boxes);
  const why = {}; for (const x of rows) if (!x.club) why[x.why] = (why[x.why] || 0) + 1;
  const inS = rows.filter(x => x.club), g = inS.filter(x => x.status === 'graded');
  const file = path.join(OUT, `rows_${set}.json`);
  fs.writeFileSync(file, JSON.stringify({ set, p23: 'results/ma_p23.json', counts: { posted: rows.length, ...n, outOfSampleWhy: why, gradedNoProjection: g.filter(x => x.mu == null).length }, lines: rows }));
  log(`${set}: ${rows.length} posted on ${new Set(rows.map(x => x.game)).size} games; in the sample ${inS.length} (graded ${n.graded}, void ${n.void}, push ${n.push}), out ${n.out} ${JSON.stringify(why)}; graded with no projection ${g.filter(x => x.mu == null).length}`);
}
