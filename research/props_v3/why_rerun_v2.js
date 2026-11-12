/* The check that props_v2's own diagnosis scripts still give their committed results (research only).
 *
 *   node research/props_v3/why_rerun_v2.js      writes research/props_v3/results/why_rerun_v2.json (about a minute)
 *
 * It runs research/props_v2/diag_trial.js (the trial's diagnosis, which reads the trial's graded lines to diagnose
 * only) and research/props_v2/diag_history.js (past seasons, on its cached fold constants), each unchanged, compares
 * the json each writes with the version committed at HEAD (its "generated" stamp left out), and then puts every file
 * the two scripts write back exactly as committed, so nothing in research/props_v2/ is left changed. It reads and prints
 * no score of its own: the numbers this study re-derives are its own scripts' (why_trial.js, why_lines.js).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..');
const OUT = path.join(__dirname, 'results', 'why_rerun_v2.json');
const git = args => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 256 << 20 });
const RUNS = [
  { script: 'research/props_v2/diag_trial.js', json: 'research/props_v2/results/diag_trial.json', writes: ['research/props_v2/diag_trial.md', 'research/props_v2/results/diag_trial.json'] },
  { script: 'research/props_v2/diag_history.js', json: 'research/props_v2/results/diag_history.json', writes: ['research/props_v2/results/diag_history.json', 'research/props_v2/results/diag_history_tables.md'] },
];
const strip = o => { const c = JSON.parse(JSON.stringify(o)); delete c.generated; return c; };
const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v3/why_rerun_v2.js: props_v2\'s diagnosis scripts run again, unchanged, against their committed results', head: git(['rev-parse', 'HEAD']).trim(), runs: [] };
for (const r of RUNS) {
  const committed = {}; for (const f of r.writes) committed[f] = git(['show', `HEAD:${f}`]);
  const t0 = Date.now();
  let ok = true, err = null;
  try { execFileSync('node', [r.script], { cwd: ROOT, stdio: ['ignore', 'ignore', 'pipe'], maxBuffer: 64 << 20 }); } catch (e) { ok = false; err = String(e.stderr || e.message).slice(0, 400); }
  const fresh = ok ? JSON.parse(fs.readFileSync(path.join(ROOT, r.json), 'utf8')) : null;
  for (const f of r.writes) fs.writeFileSync(path.join(ROOT, f), committed[f]);                   // put back as committed
  const same = ok && JSON.stringify(strip(fresh)) === JSON.stringify(strip(JSON.parse(committed[r.json])));
  const left = git(['status', '--porcelain', '--', ...r.writes]).trim();
  out.runs.push({ script: r.script, ran: ok, error: err, seconds: Math.round((Date.now() - t0) / 1000), sameAsCommittedButForTheStamp: same, filesPutBack: left === '' });
  console.log(`${r.script}: ${ok ? (same ? 'the same as committed, but for the stamp' : 'DIFFERS from the committed result') : 'failed: ' + err}; files put back ${left === '' ? 'clean' : 'NOT clean: ' + left}`);
}
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
