/* Every input the one-shot test's scorer stands on, each with its SHA-256 (PLAN.md 3.4's V-hash, as revised after the
 * review of 13 November 2026, finding F4). Research only.
 *
 *   node research/props_v3/test/inputs.js            prints required() as JSON
 *   node research/props_v3/test/inputs.js --write    writes it to research/props_v3/PREREG_HASHES.json (THE TEST STEP
 *                                                      ONLY: the preregistration commit carries it)
 *
 * required() is, as the files stand on disk:
 *   - the frozen candidate, research/props_v3/frozen/ma_frozen.json;
 *   - the code: every module of this repository the scorer loads, read off Node's own module cache after loading
 *     test/score.js (never a hand list), and the fetch's machinery, which the scorer does not load (the wrapper, the
 *     record's tool, the cleaner, research/props_v2/fetch_dk40.js);
 *   - the data the scorer's replay and F read: the 2020-21 boxes (research/props_v3/cache/box2021/, gitignored: a
 *     re-fetch must give back these very bytes, or nothing is scored), data/box_2022..2026.csv and
 *     data/teambox_2022..2026.jsonl whole; the header and rows of data/games.csv of the seasons the replay reads (2020-21
 *     to 2025-26; the job adds rows of the season in play to that file, which are not pinned); the header and rows of
 *     data/odds_hist.csv of 2022-23 (F's game lines at the test); and from props_v2, espn_validate40.json (the source of
 *     the 31 left-out games), validity_ref.json (V0 to V3's thresholds) and this folder's list of the 31
 *     (test/seen_2023.json).
 * The test's own lines are not in it: their SHA-256 are the fetch record's (test/fetch_record.js), committed and pushed
 * once the fetch has run, and the scorer reads them from origin.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const FETCH = ['research/props_v3/test/fetch_dk40_2023_logged.sh', 'research/props_v3/test/fetch_record.js', 'research/props_v3/test/lines_clean_2023.js', 'research/props_v2/fetch_dk40.js'];
const DATA = [
  'research/props_v3/cache/box2021/box_2021.csv', 'research/props_v3/cache/box2021/teambox_2021.jsonl',
  ...[2022, 2023, 2024, 2025, 2026].flatMap(s => [`data/box_${s}.csv`, `data/teambox_${s}.jsonl`]),
  'research/props_v2/results/espn_validate40.json', 'research/props_v2/results/validity_ref.json', 'research/props_v3/test/seen_2023.json',
];
/* a file's header and the rows whose `season` column passes keep, in the file's order */
function rowsHash(file, keep) {
  const t = fs.readFileSync(path.join(ROOT, file), 'utf8').split('\n').filter(Boolean), h = t[0], si = h.split(',').indexOf('season');
  if (si < 0) throw new Error(`${file} has no season column`);
  return sha256([h, ...t.slice(1).filter(l => keep(+l.split(',')[si]))].join('\n') + '\n');
}
function codeFiles() {
  require('./score.js');
  return Object.keys(require.cache).filter(f => f.startsWith(ROOT + path.sep) && !f.split(path.sep).includes('node_modules')).map(f => path.relative(ROOT, f));
}
function required() {
  const files = {};
  for (const f of [...new Set(['research/props_v3/frozen/ma_frozen.json', ...codeFiles(), ...FETCH, ...DATA])].sort()) {
    const p = path.join(ROOT, f);
    if (!fs.existsSync(p)) throw new Error(`a required input is not there: ${f}`);
    files[f] = sha256(fs.readFileSync(p));
  }
  files['data/games.csv#seasons 2021 to 2026'] = rowsHash('data/games.csv', s => s >= 2021 && s <= 2026);
  files['data/odds_hist.csv#season 2023'] = rowsHash('data/odds_hist.csv', s => s === 2023);
  return files;
}
module.exports = { required, rowsHash, codeFiles, sha256 };
if (require.main === module) {
  const r = { what: "every input of the one-shot test's scorer, with its SHA-256 (research/props_v3/test/inputs.js)", files: required() };
  if (process.argv.includes('--write')) { fs.writeFileSync(path.join(ROOT, 'research', 'props_v3', 'PREREG_HASHES.json'), JSON.stringify(r, null, 1) + '\n'); console.log(`wrote research/props_v3/PREREG_HASHES.json: ${Object.keys(r.files).length} inputs`); }
  else console.log(JSON.stringify(r, null, 1));
}
