/* P23, MA's projection layer (PLAN.md 1.1 step 2 and 1.4): tools/props.js's own fit, its structure and grids unchanged,
 * on 2021-22 alone, 2020-21 warming it up. Research only.
 *
 *   node research/props_v3/ma/p23_fit.js   -> research/props_v3/results/ma_p23.json (about 3 minutes)
 *
 * The replay is given the games of 2020-21 and 2021-22 alone (data/games.csv's finals, the 2020-21 boxes from
 * cache/box2021/, the 2021-22 boxes from data/), so nothing of 2022-23 or later is in memory while the constants are
 * chosen. The training rows are tools/props.js's own: every player the 2021-22 boxes list with a game on record, read
 * before the game (the box's list of who dressed is the fit's, as tools/props.js fits: hindsight inside the training
 * season, never an input of a projection). tools/props.js fit() then chooses every constant (minutes, rates, pace,
 * opponent, playoffs, spreads, the doubles' correlation) on them. ma_lib.js's copy of the replay is checked against
 * tools/props.js's own on the same games first, row for row.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const M = require('./ma_lib.js');
const { PM, ROOT } = M;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(path.join(ROOT, f))).digest('hex');

const D = M.loadData();
log(`loaded ${D.games.length} games of 2020-21 to 2025-26, ${Object.keys(D.boxes).length} boxes; dropped (no minutes) ${D.dropped.join(' ')}`);
const keep = g => g.season <= 2022;
const Dfit = { games: D.games.filter(keep), boxes: Object.fromEntries(Object.entries(D.boxes).filter(([k]) => +k.slice(0, 4) <= 2022)), tbox: Object.fromEntries(Object.entries(D.tbox).filter(([k]) => +k.slice(0, 4) <= 2022)) };
if (Dfit.games.some(g => g.season > 2022) || Object.keys(Dfit.boxes).some(k => +k.slice(0, 4) > 2022)) throw new Error('a game after 2021-22 in the fit');
const nCheck = M.verifyReplay(Dfit, 2022);
log(`ma_lib.js's replay is tools/props.js's, row for row, on ${nCheck} rows of 2021-22`);
const R = PM.replay(Dfit.games, Dfit.boxes, Dfit.tbox, { collect: true, from: 2022 });
const rows = R.rows.filter(r => r.season === 2022);
log(`training rows: ${rows.length} (2021-22: ${rows.filter(r => r.played).length} played, ${rows.filter(r => r.type === 'POST').length} playoff)`);
const P = PM.fit(rows, r => r.season === 2022, m => log(m.trim()));
const out = { what: "P23: tools/props.js's fit (its structure and grids unchanged) on 2021-22 alone, 2020-21 warming up (PLAN.md 1.4)",
  P, trainingRows: rows.length, gamesInReplay: Dfit.games.length, boxesInReplay: Object.keys(Dfit.boxes).length, droppedNoMinutes: D.dropped,
  files: Object.fromEntries(D.files.filter(f => /_(2021|2022)\./.test(f)).map(f => [f, sha(f)])), toolsPropsSha256: sha('tools/props.js') };
const file = path.join(ROOT, 'research', 'props_v3', 'results', 'ma_p23.json');
fs.writeFileSync(file, JSON.stringify(out, null, 1) + '\n');
log(`wrote ${path.relative(ROOT, file)}: ${JSON.stringify(P.rate)} gamma ${P.gamma} opp ${JSON.stringify(P.opp)}`);
