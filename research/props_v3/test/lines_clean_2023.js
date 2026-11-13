/* THE TEST STEP ONLY (PLAN.md 3.1, L1): DraftKings' 2022-23 lines without the column that tells the result, as
 * research/props_v3/lines_clean.js made 2023-24's. WRITTEN AND TESTED IN A SANDBOX (test/machinery_check.js), NEVER RUN
 * on the real lines before the preregistration.
 *
 *   PROPS_V3_PREREG=<sha> PROPS_V3_BRANCH=<branch> node research/props_v3/test/lines_clean_2023.js
 *
 * Reads research/props_v2/cache/props40_2023.csv (fetch_dk40.js's columns, the seventh last_updated) and
 * props40_reads.json; writes research/props_v3/cache/dk40_2023_lines.csv (game_id,player_id,stat,line,over,under, every
 * row of 2022-23 in the same order) and dk40_2023_starts.csv (game_id,start). It refuses to run unless origin holds the
 * fetch's record started under that preregistration (test/fetch_record.js; until the review of 13 November 2026 a
 * marker in the cache, which a lost container wipes), and refuses a row of another season. It writes no hash of its own:
 * the record's finish (fetch_record.js finish) hashes what it wrote and pushes the hashes, and the scorer reads them
 * from origin (until the review it wrote a sibling .sha256 in the same gitignored cache, which the scorer trusted).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const FR = require('./fetch_record.js');
const SRC = path.join(ROOT, 'research', 'props_v2', 'cache');
const DST = path.join(ROOT, 'research', 'props_v3', 'cache');
const COLS = 'game_id,player_id,stat,line,over,under';
/* the cleaner's rule, which the scorer applies again to the fetched csv to hold it to the clean lines */
function cleanBody(text) {
  const t = text.split('\n').filter(Boolean);
  if (t.shift() !== COLS + ',last_updated') throw new Error('props40_2023.csv is not in fetch_dk40.js\'s columns');
  const rows = t.map(l => { const v = l.split(','); if (v.length !== 7) throw new Error('a row of props40_2023.csv has other than seven fields'); if (!/^2023_/.test(v[0])) throw new Error(`a row of another season: ${v[0]}`); return v.slice(0, 6).join(','); });
  return [COLS, ...rows].join('\n') + '\n';
}
const startsBody = reads => ['game_id,start', ...Object.keys(reads).filter(k => /^2023_/.test(k)).sort().map(k => `${k},${reads[k].start || ''}`)].join('\n') + '\n';
module.exports = { cleanBody, startsBody, COLS };
if (require.main === module) {
  const vs = FR.recordVersions(ROOT), sha = process.env.PROPS_V3_PREREG || '';
  const full = (() => { try { return require('child_process').execFileSync('git', ['rev-parse', '--verify', `${sha}^{commit}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { return ''; } })();
  if (!full || !vs.length || vs.some(v => v.rec.prereg !== full)) throw new Error('refused: origin holds no record of the 2022-23 fetch started under this preregistration (test/fetch_dk40_2023_logged.sh)');
  fs.mkdirSync(DST, { recursive: true });
  const body = cleanBody(fs.readFileSync(path.join(SRC, 'props40_2023.csv'), 'utf8'));
  const sbody = startsBody(JSON.parse(fs.readFileSync(path.join(SRC, 'props40_reads.json'), 'utf8')));
  for (const [f, b] of [['dk40_2023_lines.csv', body], ['dk40_2023_starts.csv', sbody]]) { const tmp = path.join(DST, f + '.tmp'); fs.writeFileSync(tmp, b); fs.renameSync(tmp, path.join(DST, f)); }
  console.log(`clean lines: ${body.split('\n').filter(Boolean).length - 1} rows`);
}
