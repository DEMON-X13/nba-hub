/* MA's freeze (PLAN.md D9): the candidate as the test would score it, fitted once on all of the 2023-24 development
 * lines, every file it stands on hashed. Research only.
 *
 *   node research/props_v3/ma/freeze.js   -> research/props_v3/frozen/ma_frozen.json
 *
 * The frozen candidate is: P23's constants (results/ma_p23.json: tools/props.js's fit on 2021-22); the nudge of
 * ma_dev_bar.json's final form (its kept stats and admitted secondaries), its weights fitted jointly with F on every
 * graded line of the 2023-24 sample (plan_sizing/lib.js fitNudgeBig, as each month's were); and E, fitted with that
 * frozen nudge as an offset. Its chance on a line is logit P = E + n. The rules it applies (the club rule, the nominal
 * 30 minutes, a nudge of 0 where there is no projection) are ma_lib.js's and dev_lib.js's code, hashed here with every
 * file they require. Nothing here reads a 2022-23 line or fits anything on 2022-23 or 2026-27.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const V = require('./dev_lib.js');
const { S } = V;
const ROOT = S.ROOT;
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');
const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v3', 'results', 'ma_dev_bar.json'), 'utf8'));
const P23 = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v3', 'results', 'ma_p23.json'), 'utf8'));
const G = V.sample(V.loadMA('2024').L), fz = S.fitNudgeBig(G, V.featFinal(DB.final));
const CODE = ['research/props_v3/ma/ma_lib.js', 'research/props_v3/ma/dev_lib.js', 'research/props_v3/plan_sizing/lib.js', 'research/props_v3/why_lib.js', 'tools/props.js', 'tools/props_feed.js', 'tools/lib.js'];
const out = { what: "MA, frozen: P23's constants, the nudge's weights and E fitted on all of the 2023-24 development lines (PLAN.md D9)",
  form: { stats: DB.final.stats, secondaries: DB.final.secondaries, nominalMinutes: V.M.NOMINAL_MIN, chance: 'logit P = E + n; n = sum over the kept stats of w_s x d (a line with no projection: n = 0)' },
  P23: P23.P, nudge: { w: fz.w }, E: { eb: fz.eb }, fittedOn: { lines: G.length, games: new Set(G.map(x => x.game)).size, set: 'DraftKings 2023-24 provider 40, the regular-season window, the six base stats' },
  files: Object.fromEntries([...CODE, 'research/props_v3/results/ma_p23.json'].map(f => [f, sha(f)])) };
fs.mkdirSync(path.join(ROOT, 'research', 'props_v3', 'frozen'), { recursive: true });
const file = path.join(ROOT, 'research', 'props_v3', 'frozen', 'ma_frozen.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
console.log(`frozen: w ${fz.w.map(v => v.toFixed(4)).join(' ')}; ${path.relative(ROOT, file)} SHA-256 ${sha(path.relative(ROOT, file))}`);
