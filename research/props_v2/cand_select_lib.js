/* Candidate C's shared machinery: the data cut to 2022-2026, the role-change flags (diag_history.js's rule, copied),
 * the walk-forward's rows at the book-like line beside a naive forecaster, and the 2026 play-in and playoff archive's
 * graded lines with every feature a selection rule reads. Nothing here reads a game of 2026-27 (season 2027).
 * tools/props.js is required, never changed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const REC = require('../../tools/props_record.js');

const ROOT = path.join(__dirname, '..', '..');
const LAST = 2026;
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const naiveMean = (f, k) => { if (k in PR.COMBOS) { const p = PR.COMBOS[k].map(c => f.naive[c]); return p.some(x => x == null) ? null : p.reduce((a, b) => a + b, 0); } return f.naive[k]; };
const POINTS = new Set(['pts', 'pra', 'pr', 'pa']);          // points and the combos that hold it
const tierOf = m => m < 8 ? '<8' : m < 15 ? '8-15' : m < 20 ? '15-20' : m < 25 ? '20-25' : m < 30 ? '25-30' : m < 35 ? '30-35' : '35+';

/* ---------- the data, cut to 2022-2026 ---------- */
function loadAll() {
  /* cut2026.js: only the box files of seasons up to 2026 are opened; its guard sees their raw rows */
  const { games, boxes, tbox } = require('./cut2026.js').loadTo2026();
  const R = PR.replay(games, boxes, tbox, { collect: true, from: PR.FIRST + 1 });
  if (R.rows.some(r => r.season > LAST)) throw new Error('a row after 2026');
  return { games, boxes, tbox, rows: R.rows, flags: roleFlags(games, boxes) };
}

/* ---------- role changes from the box scores in order: diag_history.js's rule, line for line ----------
   tmOutAbs  a teammate who played 20+ minutes in the team's previous game is absent from this game's box (inactive)
   tmOutDnp  ... or listed and not playing (a coach's decision; not known before tip, so no rule reads it)
   ret       the player returns after missing 3+ of his team's games this season (missed: how many)
   tmRet     a teammate returns after 3+ missed games who averaged 20+ minutes in his last five before
   newTeam   the player's previous appearance was for another club (this season or last)
   regN      the club's regular-season game number (null in the playoffs) */
function roleFlags(games, boxes) {
  const flags = new Map();
  const byDate = {}; for (const g of games) (byDate[g.date] = byDate[g.date] || []).push(g);
  const team = {}, pl = {};
  for (const date of Object.keys(byDate).sort()) {
    const day = byDate[date].filter(g => g.status === 'final' && boxes[g.game_id] && boxes[g.game_id][g.home] && boxes[g.game_id][g.away]);
    const updates = [];
    for (const g of day) for (const t of [g.home, g.away]) {
      let T = team[t];
      if (!T || T.season !== g.season) T = team[t] = { season: g.season, idx: 0, regN: 0, prev: null, lastIdx: new Map() };
      const idx = T.idx + 1, regN = T.regN + (g.type === 'REG' ? 1 : 0);
      const list = boxes[g.game_id][t];
      const playedNow = new Map(list.filter(r => r.min > 0 && !r.dnp).map(r => [r.id, r.min]));
      const listed = new Set(list.map(r => r.id));
      let outAbs = 0, outDnp = 0; const outIds = new Set();
      if (T.prev) for (const [id, mn] of T.prev) if (mn >= 20 && !playedNow.has(id)) { outIds.add(id); if (listed.has(id)) outDnp++; else outAbs++; }
      const retIds = new Map();
      for (const id of playedNow.keys()) {
        const j = T.lastIdx.get(id);
        if (j != null && idx - j - 1 >= 3) { const p = pl[id]; const m5 = p ? p.mins.slice(-5) : []; retIds.set(id, { missed: idx - j - 1, pre: m5.length ? m5.reduce((a, b) => a + b, 0) / m5.length : 0 }); }
      }
      for (const r of list) {
        const p = pl[r.id], ret = retIds.get(r.id);
        flags.set(g.game_id + '|' + t + '|' + r.id, {
          regN: g.type === 'REG' ? regN : null, post: g.type === 'POST',
          tmOutAbs: outAbs > 0, tmOutDnp: outDnp > 0 && !outIds.has(r.id),
          ret: !!ret, missed: ret ? ret.missed : 0, tmRet: [...retIds].some(([id, x]) => id !== r.id && x.pre >= 20),
          newTeam: !!(p && p.lastTeam && p.lastTeam !== t && p.lastSeason >= g.season - 1),
        });
      }
      updates.push({ g, t, T, idx, regN, playedNow });
    }
    for (const u of updates) {
      u.T.idx = u.idx; u.T.regN = u.regN; u.T.prev = u.playedNow;
      for (const [id, mn] of u.playedNow) {
        u.T.lastIdx.set(id, u.idx);
        const p = pl[id] = pl[id] || { lastTeam: '', lastSeason: 0, mins: [] };
        p.lastTeam = u.t; p.lastSeason = u.g.season; p.mins.push(mn); if (p.mins.length > 5) p.mins.shift();
      }
    }
  }
  return flags;
}
/* a role change known before tip-off (tmOutDnp is a coach's decision, known only at tip or in the game: not read) */
const roleChange = fl => !!(fl && (fl.ret || fl.tmOutAbs || fl.tmRet || fl.newTeam || (fl.regN != null && fl.regN <= 10)));

/* ---------- the walk-forward's rows at the book-like line (own average floored plus a half) ----------
   for each fold S: tools/props.js's projection with the constants fitted on 2023..S-1, beside the walk-forward's naive
   forecaster (the player's own average, its spread fitted the same way on the same seasons: fitNaiveVar). Rows
   projected 8+ minutes and with a game this season or last, as the walk-forward scores them. */
function histRows(D, research, S) {
  const fold = research.folds.find(f => f.season === S), P = fold.params;
  const NV = PR.fitNaiveVar(D.rows, r => r.season >= PR.FIRST + 1 && r.season < S);
  const pr = PR.project(D.rows, P, r => r.season === S);
  const out = [];
  for (const [i, x] of pr) {
    const r = D.rows[i];
    if (naiveMean(r.f, 'pts') == null || x.m < PR.MIN_SHOWN) continue;
    const fl = D.flags.get(r.game + '|' + r.team + '|' + r.id) || null;
    for (const k of PR.ALL) {
      const nv = naiveMean(r.f, k); if (nv == null) continue;
      const line = Math.floor(nv) + 0.5, mu = x.mu[k], y = PR.yOf(r.y, k), nn = Math.max(nv, 0.01);
      const pm = clip(PR.nbSf(Math.floor(line) + 1, mu, PR.nbVar(mu, P.var[k])));
      const pn = clip(PR.nbSf(Math.floor(line) + 1, nn, PR.nbVar(nn, NV[k])));
      out.push({ S, game: r.game, post: r.type === 'POST', stat: k, line, mu, y, pm, pn, o: y > line ? 1 : 0, m: x.m, mAct: r.min, fl, role: roleChange(fl) });
    }
  }
  return out;
}

/* ---------- the archive: every graded line, with its projection and its features (cand_blend.js's grading) ---------- */
function archiveLines(D, research) {
  const rec = REC.readRecord(2026);
  const games = D.games, boxes = D.boxes;
  const post = games.filter(g => g.season === 2026 && g.type === 'POST').sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
  const playIn = games.filter(g => g.season === 2026 && g.type === 'REG' && g.date >= '2026-04-14');
  const seriesOf = {}, roundOf = {}, start = {}, nth = {};
  for (const g of post) {
    const key = [g.away, g.home].sort().join('-');
    if (!(key in start)) { start[key] = g.date; const ra = (nth[g.away] || 0) + 1, rh = (nth[g.home] || 0) + 1; if (ra !== rh) throw new Error(`series ${key}: the clubs disagree on the round`); nth[g.away] = ra; nth[g.home] = rh; start[key + ':round'] = ra; }
    seriesOf[g.game_id] = key; roundOf[g.game_id] = start[key + ':round'];
  }
  for (const g of playIn) { seriesOf[g.game_id] = 'play-in ' + [g.away, g.home].join('@'); roundOf[g.game_id] = 0; }
  if (rec.some(l => !(l.game_id in roundOf))) throw new Error('a line on a game outside the play-in and playoffs');
  const P = research.folds.find(f => f.season === 2026).params;
  const recGames = new Set(rec.map(l => l.game_id));
  const pr = PR.project(D.rows, P, r => recGames.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(D.rows[i].game + '|' + D.rows[i].id, { x, r: D.rows[i] });
  const played = new Set();
  for (const gid of recGames) for (const side of Object.values(boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
  const L = [];
  for (const l of rec) {
    const k = l.game_id + '|' + l.player_id;
    if (!played.has(k)) continue;
    const a = at.get(k); if (!a) continue;
    const mu = a.x.mu[l.stat], y = PR.yOf(a.r.y, l.stat), g = PR.gradeLine(l.line, l.over, l.under, mu, P.var[l.stat], y);
    if (g.result === 'push') continue;
    const fl = D.flags.get(a.r.game + '|' + a.r.team + '|' + a.r.id) || null;
    L.push({ game: l.game_id, series: seriesOf[l.game_id], round: roundOf[l.game_id], stat: l.stat, line: l.line, over: l.over, under: l.under,
      mu, y, m: a.x.m, mAct: a.r.min, pm: g.pModel, q: g.pMarket, result: g.result, o: g.result === 'over' ? 1 : 0, fl, role: roleChange(fl) });
  }
  return L;
}

module.exports = { ROOT, LAST, clip, naiveMean, POINTS, tierOf, loadAll, roleFlags, roleChange, histRows, archiveLines };
