/* The data every script here reads, cut to seasons up to 2026, so that no box score of 2026-27 is ever parsed.
 *
 * games.csv is one file for every season: tools/props.js loadGames reads it whole, and its rows of 2026-27 (the
 * schedule and the finals so far) are dropped here before anything else sees them. The box scores and team boxes come a
 * file a season (data/box_<season>.csv, data/teambox_<season>.jsonl): only the files of seasons up to 2026 are opened,
 * and they are parsed by tools/props.js's own loadBoxes and loadTeamBoxes (given a folder that links those files
 * alone), so a row is read exactly as before.
 *
 * The guard sees the raw rows, before any filter: a row of a game after 2026 inside one of those files throws. The rows
 * are then kept only for the games loadGames keeps (as every script did before, when it parsed every file and filtered
 * after: that read box_2027.csv and teambox_2027.jsonl whole and dropped them, and its guard, run after the filter, could
 * never fire). `node research/props_v2/cut2026_check.js` shows this returns what the old way returned, to the byte, and
 * that the guard fires on a planted row.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const PR = require('../../tools/props.js');

const LAST = 2026;
const seasonOf = id => +String(id).slice(0, 4);

/* tools/props.js's loader on the files of seasons up to LAST alone: a temporary folder of links to them */
function readSeasons(dir, re, load) {
  const files = fs.readdirSync(dir).filter(f => re.test(f) && +re.exec(f)[1] <= LAST).sort();
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v2-cut-'));
  try {
    for (const f of files) fs.symlinkSync(path.resolve(dir, f), path.join(tmp, f));
    return { files, data: load(tmp) };
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
}

function loadTo2026(dir = PR.DATA) {
  const games = PR.loadGames().filter(g => g.season <= LAST);
  const gset = new Set(games.map(g => g.game_id));
  const B = readSeasons(dir, /^box_(\d{4})\.csv$/, d => PR.loadBoxes(d));
  const T = readSeasons(dir, /^teambox_(\d{4})\.jsonl$/, d => PR.loadTeamBoxes(d));
  /* the guard, on the raw rows of the files read */
  const lateBox = Object.keys(B.data).filter(k => !(seasonOf(k) <= LAST));
  const lateTeam = Object.keys(T.data).filter(k => !(seasonOf(k) <= LAST));
  if (lateBox.length || lateTeam.length) throw new Error(`a box score after ${LAST} was read: ${[...lateBox, ...lateTeam].slice(0, 3).join(', ')}`);
  const boxes = {}; for (const [k, v] of Object.entries(B.data)) if (gset.has(k)) boxes[k] = v;
  const tbox = {}; for (const [k, v] of Object.entries(T.data)) if (gset.has(k.split(':')[0])) tbox[k] = v;
  return { games, boxes, tbox, files: [...B.files, ...T.files] };
}

module.exports = { LAST, loadTo2026 };
