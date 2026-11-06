/* What validity.js and validity_calib.js share: the registered thresholds, and the graded base-stat lines with every
 * quantity a check reads. Nothing here scores a candidate. tools/props.js is required, never changed.
 *
 * gradeLines(D, research, S, rec) grades DraftKings' lines `rec` (the record's columns: game_id, player_id, stat, line,
 * over, under, and lu where the fetch kept a stamp) on the box scores, as validity.js always has: a player who did not
 * play is void, a line equal to the stat a push, a player the walk-forward does not project left out. Each graded line
 * carries:
 *   q, qSwap      DraftKings' fair chance of the Over (the whole margin on the Over), and the chance read the other way
 *   pn            the naive forecaster's chance of the Over at DraftKings' line: the player's own average before the game,
 *                 on the spread tools/props.js fitNaiveVar fits on the seasons before the fold
 *   gP            the yardstick V3 sets DraftKings against in its own season: what a fixed pre-game forecaster
 *                 (tools/props.js's walk-forward, the fold's constants) gains over the naive in log loss at its own
 *                 median line, floor(mean) + 0.5, on the same player, game and stat. It reads the box scores and the
 *                 projection only: no price, and not DraftKings' line
 *   m, mAct       the projected minutes (the walk-forward's, before tip) and the minutes played
 *   prev          whether he played his side's previous game of the season (false: he missed it; null: the side's first)
 * The fold's constants are research/props.json's for S (the 2026 fold for the archive; the 2024 fold, fitted on 2023,
 * for 2023-24).
 *
 * readFetched(file) reads a fetched file once: its bytes, their text and their SHA-256. validity.js records the hashes of
 * the csv and the reads it checked; test2024.js scores only the bytes those hashes name, read the same way.
 */
'use strict';
const fs = require('fs');
const crypto = require('crypto');
const PR = require('../../tools/props.js');
const F = require('../../tools/props_feed.js');
const SL = require('./cand_select_lib.js');

const BASE = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'];
/* The thresholds, as validity_calib.js derives them (it fails unless they are these): written before any provider-40
   line is fetched. V3's slack is per stat; V2's minimum counts player-games, not lines (a player's six lines share one
   exit). */
const TH = {
  v1ShareBeforeStart: 0.95,
  v2MinProjected: 24, v2ExitUnder: 12, v2PlayedPrevious: true, v2MinExits: 40, v2Floor: -0.05,
  v3Slack: { pts: 0.025, reb: 0.015, ast: 0.02, tpm: 0.015, stl: 0.015, blk: 0.015 },
};
const ll = (p, o) => o ? -Math.log(SL.clip(p)) : -Math.log(1 - SL.clip(p));
const readFetched = file => { const buf = fs.readFileSync(file); return { buf, text: buf.toString('utf8'), sha256: crypto.createHash('sha256').update(buf).digest('hex') }; };
const sfAt = (line, mu, ab) => PR.nbSf(Math.floor(line) + 1, mu, PR.nbVar(mu, ab));

/* game|player -> did he play his side's previous game of the season (null on the side's first game) */
function previousPlayed(D) {
  const out = new Map(), bySide = new Map();
  for (const g of D.games) if (g.status === 'final' && D.boxes[g.game_id]) for (const t of [g.home, g.away]) {
    const k = g.season + '|' + t; if (!bySide.has(k)) bySide.set(k, []); bySide.get(k).push({ g, t });
  }
  for (const list of bySide.values()) {
    list.sort((a, b) => a.g.date < b.g.date ? -1 : a.g.date > b.g.date ? 1 : 0);
    let prev = null;
    for (const { g, t } of list) {
      const now = new Set(((D.boxes[g.game_id] || {})[t] || []).filter(r => r.min > 0 && !r.dnp).map(r => r.id));
      for (const id of now) out.set(g.game_id + '|' + id, prev ? prev.has(id) : null);
      prev = now;
    }
  }
  return out;
}

function gradeLines(D, research, S, rec) {
  const P = research.folds.find(f => f.season === S).params;
  const NV = PR.fitNaiveVar(D.rows, r => r.season >= PR.FIRST + 1 && r.season < S);
  rec = rec.filter(l => BASE.includes(l.stat));
  const games = new Set(rec.map(l => l.game_id));
  const pr = PR.project(D.rows, P, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(D.rows[i].game + '|' + D.rows[i].id, { x, r: D.rows[i] });
  const played = new Set();
  for (const gid of games) for (const side of Object.values(D.boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
  const prevOf = previousPlayed(D);
  const L = []; let voids = 0, noProjection = 0, pushes = 0;
  for (const l of rec) {
    const k = l.game_id + '|' + l.player_id;
    if (!played.has(k)) { voids++; continue; }
    const a = at.get(k); if (!a) { noProjection++; continue; }
    const y = PR.yOf(a.r.y, l.stat); if (y === l.line) { pushes++; continue; }
    const nv = SL.naiveMean(a.r.f, l.stat), nn = nv == null ? null : Math.max(nv, 0.01);
    const mu = a.x.mu[l.stat], mm = Math.max(mu, 0.01), Lm = Math.floor(mu) + 0.5, om = y > Lm ? 1 : 0;
    L.push({ game: l.game_id, player: l.player_id, stat: l.stat, line: l.line, y, o: y > l.line ? 1 : 0,
      q: F.propFairOver(l.over, l.under), qSwap: 1 - F.propImplied(l.over),
      pn: nn == null ? null : sfAt(l.line, nn, NV[l.stat]),
      gP: nn == null ? null : ll(sfAt(Lm, nn, NV[l.stat]), om) - ll(sfAt(Lm, mm, P.var[l.stat]), om),
      m: a.x.m, mAct: a.r.min, prev: prevOf.has(k) ? prevOf.get(k) : null, lu: l.lu || null });
  }
  return { L, voids, noProjection, pushes, games, P, NV };
}

module.exports = { BASE, TH, ll, sfAt, previousPlayed, gradeLines, readFetched };
