/* D4's references on the 2023-24 development lines (research only): each line's chance by tools/props.js's 2024 fold
 * and by props_v2's candidate A's 2024 fold, as both were scored on 6 November 2026.
 *
 *   node research/props_v3/ma/refs.js   -> research/props_v3/cache/ma/refs_2024.json (gitignored; about 2 minutes)
 *
 * Both are projected exactly as why_lines.js projects them (research/props_v2/cand_fix_lib.js's replay and projection,
 * the folds' constants from research/props_v2/results/fold_params.json and cand_fix_score.json, on the box score's list
 * of who dressed, as the earlier tests scored them: hindsight those references carry, never MA). Each line's chance is
 * P(Over) on the fold's negative binomial. Nothing is fitted here. The 2023-24 lines come through ma_lib.js's six-column
 * loader; no 2022-23 line exists here.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const M = require('./ma_lib.js');
const { PM, ROOT } = M;
const C = require(path.join(ROOT, 'research', 'props_v2', 'cand_fix_lib.js'));
const V2R = path.join(ROOT, 'research', 'props_v2', 'results');
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const foldP = JSON.parse(fs.readFileSync(path.join(V2R, 'fold_params.json'), 'utf8')), AS = JSON.parse(fs.readFileSync(path.join(V2R, 'cand_fix_score.json'), 'utf8'));
const Dd = C.loadData();
const R = C.replayX(Dd.games, Dd.boxes, Dd.tbox, { collect: true, from: 2024 });
const rows = R.rows.filter(r => r.season === 2024), sides = C.sidesOf(rows);
const gamesById = new Map(Dd.games.map(g => [g.game_id, g]));
const lines = M.lines2024(gamesById), games = new Set(lines.map(l => l.game));
const out = {};
for (const [name, P, X] of [['tools', foldP['2024'], {}], ['A', AS.folds['2024'].P, AS.folds['2024'].X]]) {
  const pr = C.projectX(rows, sides, P, X, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(rows[i].game + '|' + rows[i].id, x);
  let n = 0;
  for (const l of lines) { const x = at.get(l.game + '|' + l.player); if (!x) continue; const k = l.game + '|' + l.player + '|' + l.stat; (out[k] = out[k] || {})[name] = PM.pOver(l.line, x.mu[l.stat], x.v[l.stat]); (out[k].mProj = out[k].mProj || {})[name] = x.m; n++; }
  log(`${name}: ${n} lines with a chance`);
}
fs.writeFileSync(path.join(M.CACHE, 'ma', 'refs_2024.json'), JSON.stringify(out));
log('wrote cache/ma/refs_2024.json');
