/* Checks cut2026.js, the loader every script here uses (writes results/cut2026_check.json):
 *   1. it returns what the old way returned (every box file parsed whole, then cut to the games of seasons up to 2026),
 *      to the byte, so no number in any result moves, and it never opens box_2027.csv or teambox_2027.jsonl;
 *   2. its guard fires on a row of a later game planted in a season-2026 file (box and team box), where the old guard,
 *      run after the cut, did not;
 *   3. a box_2027.csv beside the 2026 file is not read at all.
 * The planted files are a few made-up rows in a temporary folder; nothing in data/ is touched.
 *
 *   node research/props_v2/cut2026_check.js
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const PR = require('../../tools/props.js');
const { LAST, loadTo2026 } = require('./cut2026.js');

const out = {};
/* 1. the same as the old way, to the byte */
const games = PR.loadGames().filter(g => g.season <= LAST), gset = new Set(games.map(g => g.game_id));
const oldBoxes = {}; for (const [k, v] of Object.entries(PR.loadBoxes())) if (gset.has(k)) oldBoxes[k] = v;
const oldTbox = {}; for (const [k, v] of Object.entries(PR.loadTeamBoxes())) if (gset.has(k.split(':')[0])) oldTbox[k] = v;
const D = loadTo2026();
out.same = {
  games: JSON.stringify(D.games) === JSON.stringify(games),
  boxes: JSON.stringify(D.boxes) === JSON.stringify(oldBoxes),
  teamBoxes: JSON.stringify(D.tbox) === JSON.stringify(oldTbox),
  boxGames: Object.keys(D.boxes).length, teamBoxes_: Object.keys(D.tbox).length,
};
out.filesOpened = D.files;
out.no2027FileOpened = !D.files.some(f => /2027/.test(f));
if (!out.same.games || !out.same.boxes || !out.same.teamBoxes || !out.no2027FileOpened) throw new Error('cut2026.js does not return what the old way returned');

/* 2 and 3: planted rows in a temporary folder */
const real = fs.readFileSync(path.join(PR.DATA, 'box_2026.csv'), 'utf8').split('\n');
const head = real[0], row26 = real[1], row27 = row26.replace(/^2026_\d{8}_/, '2027_20261021_');
const team26 = fs.readFileSync(path.join(PR.DATA, 'teambox_2026.jsonl'), 'utf8').split('\n')[0];
const team27 = team26.replace(/"game_id":"2026_\d{8}_/, '"game_id":"2027_20261021_');
if (row27 === row26 || team27 === team26) throw new Error('could not make the planted rows');
function inDir(files, f) {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v2-plant-'));
  try { for (const [n, t] of Object.entries(files)) fs.writeFileSync(path.join(d, n), t); return f(d); }
  finally { fs.rmSync(d, { recursive: true, force: true }); }
}
const tryLoad = d => { try { const r = loadTo2026(d); return { threw: false, boxGames: Object.keys(r.boxes), files: r.files }; } catch (e) { return { threw: true, message: e.message }; } };
/* the old way's guard: parse every file, cut to the games kept, then look for a later game */
const oldGuard = d => { const b = {}; for (const [k, v] of Object.entries(PR.loadBoxes(d))) if (gset.has(k)) b[k] = v;
  const t = {}; for (const [k, v] of Object.entries(PR.loadTeamBoxes(d))) if (gset.has(k.split(':')[0])) t[k] = v;
  return Object.keys(b).some(k => +k.slice(0, 4) > LAST) || Object.keys(t).some(k => +k.slice(0, 4) > LAST); };
out.planted = {
  boxRowIn2026File: inDir({ 'box_2026.csv': [head, row26, row27].join('\n') + '\n', 'teambox_2026.jsonl': team26 + '\n' }, d => ({ cut2026: tryLoad(d), oldGuardFired: oldGuard(d) })),
  teamRowIn2026File: inDir({ 'box_2026.csv': [head, row26].join('\n') + '\n', 'teambox_2026.jsonl': [team26, team27].join('\n') + '\n' }, d => ({ cut2026: tryLoad(d), oldGuardFired: oldGuard(d) })),
  box2027FileBeside: inDir({ 'box_2026.csv': [head, row26].join('\n') + '\n', 'box_2027.csv': [head, row27].join('\n') + '\n', 'teambox_2026.jsonl': team26 + '\n', 'teambox_2027.jsonl': team27 + '\n' }, d => ({ cut2026: tryLoad(d) })),
};
const P = out.planted;
if (!P.boxRowIn2026File.cut2026.threw || !P.teamRowIn2026File.cut2026.threw) throw new Error('the guard did not fire on a planted row');
if (P.boxRowIn2026File.oldGuardFired || P.teamRowIn2026File.oldGuardFired) throw new Error('the old guard fired: the check is wrong');
if (P.box2027FileBeside.cut2026.threw || P.box2027FileBeside.cut2026.files.some(f => /2027/.test(f))) throw new Error('a 2027 file was read');
fs.writeFileSync(path.join(__dirname, 'results', 'cut2026_check.json'), JSON.stringify(out, null, 1) + '\n');
console.log(JSON.stringify(out, null, 1));
console.log('cut2026.js: the same data as the old way, to the byte; no 2027 file opened; the guard fires on a planted row (the old one did not)');
