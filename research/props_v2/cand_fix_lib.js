/* Candidate A's machinery: tools/props.js's replay, fit and projection with the parts the diagnosis pointed at made
 * changeable, every change off by default and, off, the same to the bit as tools/props.js (checked by cand_fix.js
 * --verify before anything is scored).
 *
 * Nothing here reads a game of 2026-27 (season 2027): loadData() cuts games.csv to season <= 2026 before the box scores
 * and team boxes are read, and throws if a row of a later season appears. tools/props.js is required, never changed.
 *
 * What a row carries beyond tools/props.js's (row.x, all known before the game, all computable live the same way):
 *   teamN    the club's games this season before this one
 *   wE       (0.9^nHome + 0.9^nAway) / 2: how much of the season-start pace (lgPace + EARLY_PACE) is still in the
 *            game's expected pace (a club's pace moves 10% toward each game's, so a change of EARLY_PACE by d moves the
 *            expected pace by exactly d x wE)
 *   missed   the club's games since his last appearance for it this season (null: none this season)
 *   newTeam  his previous appearance on record was for another club, and he has this many appearances for this one
 *            since (null: not a new club)
 *   carry    per rate half-life h, the part of his rate accumulator carried in from before this season (its minutes
 *            and stats, decayed as the accumulator is); prevRate his whole previous regular season per minute (null
 *            under 100 minutes)
 *   newbies  (on the side) players the box lists with no game on record: no projection, so outside the side's scale
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const F = require('../../tools/props_feed.js');

const LAST = 2026;
const { STATS, COMBOS, ALL, H_SET } = PR;
const EARLY_PACE = 1.5, LG_DECAY = Math.pow(0.5, 1 / 25000), OPP_H = 20, MAX_MIN = 46, ROT = PR.ROT;
const zeros = () => Object.fromEntries(STATS.map(k => [k, 0]));
const POS = ['G', 'F', 'C'];

function loadData() {
  const games = PR.loadGames().filter(g => g.season <= LAST);
  const gset = new Set(games.map(g => g.game_id));
  const boxes = {}; for (const [k, v] of Object.entries(PR.loadBoxes())) if (gset.has(k)) boxes[k] = v;
  const tbox = {}; for (const [k, v] of Object.entries(PR.loadTeamBoxes())) if (gset.has(k.split(':')[0])) tbox[k] = v;
  if (Object.keys(boxes).some(k => +k.slice(0, 4) > LAST)) throw new Error('a box score after 2026 was read');
  return { games, boxes, tbox };
}

/* tools/props.js newPlayer, verbatim (not exported) */
function newPlayer(row, season) {
  const acc = {}; for (const h of H_SET) acc[h] = { m: 0, y: zeros() };
  return { id: row.id, name: row.name, pos: row.pos || 'F', team: row.team, season, cur: [], reg: [], prevReg: [], acc, pace: 0, paceW: 0, n: 0, last: '',
    seasonY: zeros(), seasonN: 0, seasonDD: 0, seasonTD: 0, prevY: null, prevN: 0, prevDD: null, prevTD: null };
}

/* tools/props.js replay, line for line, with the extras above kept beside it (E, per player; T, per club) */
function replayX(games, boxes, teamStats, opts = {}) {
  const players = {}, pace = {}, seasonOfTeam = {};
  let lgPace = 99, lastFinal = '';
  const lgPos = Object.fromEntries(POS.map(p => [p, { m: 0, y: zeros() }]));
  const allowed = {}, lgAll = { m: 0, y: zeros() };
  const rows = [];
  const byDate = {};
  for (const g of games) (byDate[g.date] = byDate[g.date] || []).push(g);
  const E = {}, T = {};
  const ex = id => E[id] || (E[id] = { reg: {}, carry: null, prevRate: null, lastTeam: '', lastSeason: 0, apps: 0, other: false, lastIdx: {} });
  const DEC = Object.fromEntries(H_SET.map(h => [h, Math.pow(0.5, 1 / h)]));
  /* the roll, with the carried part of each rate accumulator snapshotted where the season changes */
  const roll = (p, season) => {
    if (p.season !== season) {
      const e = ex(p.id);
      e.carry = {}; for (const h of H_SET) e.carry[h] = { m: p.acc[h].m, y: { ...p.acc[h].y } };
      const pr = p.season === season - 1 ? e.reg[p.season] : null;
      e.prevRate = pr && pr.m >= 100 ? Object.fromEntries(STATS.map(k => [k, pr.y[k] / pr.m])) : null;
    }
    PR.rollSeason(p, season);
  };
  const getP = (r, season) => { let p = players[r.id]; if (!p) { p = players[r.id] = newPlayer(r, season); ex(r.id).carry = null; } roll(p, season); return p; };
  for (const date of Object.keys(byDate).sort()) {
    const day = byDate[date].filter(g => g.status === 'final' && boxes[g.game_id] && boxes[g.game_id][g.home] && boxes[g.game_id][g.away]);
    if (!day.length) continue;
    for (const g of day) for (const t of [g.home, g.away]) {
      if (pace[t] === undefined) pace[t] = 99;
      if (seasonOfTeam[t] !== g.season) { if (seasonOfTeam[t] !== undefined) pace[t] = lgPace + EARLY_PACE; seasonOfTeam[t] = g.season; }
      if (!T[t] || T[t].season !== g.season) T[t] = { season: g.season, n: 0 };
    }
    if (opts.collect) for (const g of day) {
      if (g.season < (opts.from || PR.FIRST + 1)) continue;
      const expPace = (pace[g.home] + pace[g.away]) / 2;
      const wE = (Math.pow(0.9, T[g.home].n) + Math.pow(0.9, T[g.away].n)) / 2;
      for (const [t, opp] of [[g.home, g.away], [g.away, g.home]]) {
        let newbies = 0; const sideRows = [];
        for (const r of boxes[g.game_id][t]) {
          const p = players[r.id];
          if (!p || !p.n) { newbies++; continue; }
          roll(p, g.season);
          const e = ex(r.id);
          const li = e.lastIdx[t];
          const x = { teamN: T[t].n, wE, missed: li && li.season === g.season ? T[t].n - li.n - 1 : null,
            newTeam: e.other && e.lastTeam === t ? e.apps : e.lastTeam && e.lastTeam !== t && e.lastSeason >= g.season - 1 ? 0 : null,
            carry: e.carry ? Object.fromEntries(H_SET.map(h => [h, { m: e.carry[h].m, y: { ...e.carry[h].y } }])) : null, prevRate: e.prevRate };
          const row = { game: g.game_id, season: g.season, type: g.type, date, team: t, opp, id: r.id, played: r.min > 0 && !r.dnp, f: PR.features(p, lgPos), expPace, oppF: PR.oppFactor(allowed[opp], lgAll), min: r.min, y: r.y, sideKey: g.game_id + ':' + t, x };
          rows.push(row); sideRows.push(row);
        }
        for (const row of sideRows) row.x.newbies = newbies;
      }
    }
    for (const g of day) {
      const pc = {};
      for (const t of [g.home, g.away]) pc[t] = PR.gamePace(boxes[g.game_id][t], teamStats[g.game_id + ':' + t]);
      for (const t of [g.home, g.away]) {
        for (const r of boxes[g.game_id][t]) {
          const p = getP(r, g.season); p.team = t; p.name = r.name || p.name; if (r.pos) p.pos = r.pos;
          if (r.min <= 0 || r.dnp) continue;
          p.n++; p.last = date; p.cur.push(r.min); if (p.cur.length > 100) p.cur.shift();
          if (g.type === 'REG') { p.reg.push({ season: g.season, min: r.min }); if (p.reg.length > 100) p.reg.shift(); }
          for (const h of H_SET) { const d = Math.pow(0.5, 1 / h), a = p.acc[h]; a.m = a.m * d + r.min; for (const k of STATS) a.y[k] = a.y[k] * d + r.y[k]; }
          const dp = Math.pow(0.5, 1 / 25); p.pace = p.pace * dp + pc[t] * r.min; p.paceW = p.paceW * dp + r.min;
          for (const k of STATS) p.seasonY[k] += r.y[k]; p.seasonN++;
          const dd = PR.doubles(r.y); if (dd >= 2) p.seasonDD++; if (dd >= 3) p.seasonTD++;
          const lp = lgPos[p.pos] || lgPos.F; lp.m = lp.m * LG_DECAY + r.min; for (const k of STATS) lp.y[k] = lp.y[k] * LG_DECAY + r.y[k];
          /* the extras */
          const e = ex(r.id);
          if (e.carry) for (const h of H_SET) { const c = e.carry[h], d = DEC[h]; c.m *= d; for (const k of STATS) c.y[k] *= d; }
          if (g.type === 'REG') { const s = e.reg[g.season] = e.reg[g.season] || { m: 0, y: zeros() }; s.m += r.min; for (const k of STATS) s.y[k] += r.y[k]; }
          if (e.lastTeam && e.lastTeam !== t) { e.other = true; e.apps = 0; }
          e.apps++; e.lastTeam = t; e.lastSeason = g.season; e.lastIdx[t] = { season: g.season, n: T[t].n };
        }
      }
      for (const [t, opp] of [[g.home, g.away], [g.away, g.home]]) {
        const a = allowed[opp] = allowed[opp] || { m: 0, y: zeros(), season: g.season };
        if (a.season !== g.season) { a.m *= 0.5; for (const k of STATS) a.y[k] *= 0.5; a.season = g.season; }
        const d = Math.pow(0.5, 1 / OPP_H); let m = 0; const y = zeros();
        for (const r of boxes[g.game_id][t]) { if (r.min <= 0 || r.dnp) continue; m += r.min; for (const k of STATS) y[k] += r.y[k]; }
        a.m = a.m * d + m; for (const k of STATS) a.y[k] = a.y[k] * d + y[k];
        const dl = Math.pow(0.5, 1 / (OPP_H * 15)); lgAll.m = lgAll.m * dl + m; for (const k of STATS) lgAll.y[k] = lgAll.y[k] * dl + y[k];
      }
      pace[g.home] += 0.1 * (pc[g.home] - pace[g.home]); pace[g.away] += 0.1 * (pc[g.away] - pace[g.away]);
      if (g.type !== 'POST') lgPace += 0.005 * ((pc[g.home] + pc[g.away]) / 2 - lgPace);
      T[g.home].n++; T[g.away].n++;
      lastFinal = date;
    }
  }
  return { rows, players, pace, lgPace, lgPos, seasonOfTeam, lastFinal, allowed, lgAll };
}

/* ---------- the changeable parts ----------
 * X, the extensions (every one off by default):
 *   minutes   X.sq        fit every minutes constant on squared error (the mean) instead of absolute error (the median)
 *             X.open      the season-opening prior (his last regular season's minutes) x open
 *             X.ret       { a, b }: b x a on his first game back after 3-9 of the club's games missed, x b after 10+
 *             X.nt        [r0, r1, r2]: b x r0 on his first game for a new club, x r1 on his 2nd-5th, x r2 on his 6th-10th
 *             X.debut     each listed player with no game on record claims this many minutes in the side's S
 *             X.kappa     the side's change of minutes (sum of m - b) handed out in proportion to b^kappa instead of b
 *             X.cal       [c0, c1]: m + c0 + c1 x (m - 24), after the scale and the playoff stretch
 *   rates     X.lam       per stat: the carried-in part of the rate takes this share of his whole last regular season's
 *                         rate in place of its own (0: as now; 1: the closing stretch replaced by the whole season)
 *             X.dE        EARLY_PACE + dE
 *   mean      X.shrink    per stat beta: mu' = naive + beta x (mu - naive), naive his own average a game (this season, else
 *                         last)
 *             X.phase     per stat, multipliers on the regular season's mean by the club's games played [0-9, 10-29, 30-59, 60+]
 *   spread    X.vm        per stat C: variance x (max(m, 6) / 24)^C
 *             X.vEarly    per stat: variance x vEarly while he has under 5 appearances this season (regular season)
 */
const baseMinX = (f, M, X) => {
  const p0 = f.prevN >= M.minN ? f.prevMean : f.last20 != null ? f.last20 : f.prevMean != null ? f.prevMean : 12;
  const p = X.open != null && f.prevN >= M.minN ? p0 * X.open : p0;
  const d = Math.pow(0.5, 1 / M.h); let w = 0, s = 0, ww = 1; const arr = f.cur;
  for (let i = arr.length - 1; i >= 0; i--) { s += ww * arr[i]; w += ww; ww *= d; }
  const m = arr.length ? s / w : 0; if (!arr.length) w = 0;
  return (w * m + M.w0 * p) / (w + M.w0);
};
function minutesX(rows, sides, M, X, sel) {
  const out = new Float64Array(rows.length).fill(NaN);
  for (const idx of sides.values()) {
    const r0 = rows[idx[0]];
    if (sel && !sel(r0)) continue;
    const b = idx.map(i => {
      const r = rows[i]; let v = baseMinX(r.f, M, X);
      if (X.ret && r.x.missed != null && r.x.missed >= 3) v *= r.x.missed >= 10 ? X.ret.b : X.ret.a;
      if (X.nt && r.x.newTeam != null && r.x.newTeam < 10) v *= X.nt[r.x.newTeam === 0 ? 0 : r.x.newTeam < 5 ? 1 : 2];
      return v;
    });
    const top = b.slice().sort((a, c) => c - a).slice(0, ROT);
    let S = 0; for (const v of top) if (v >= M.floor) S += v;
    if (X.debut) S += r0.x.newbies * X.debut;
    const sc = S > 0 ? Math.pow(M.T / S, M.alpha) : 1;
    let mm;
    if (X.kappa != null && X.kappa !== 1) {
      let sb = 0, sw = 0; const w = b.map(v => Math.pow(Math.max(v, 0), X.kappa));
      for (let j = 0; j < b.length; j++) { sb += b[j]; sw += w[j]; }
      const D = sb * (sc - 1);
      mm = b.map((v, j) => sw > 0 ? v + D * w[j] / sw : v * sc);
    } else mm = b.map(v => v * sc);
    idx.forEach((i, j) => {
      let m = mm[j]; if (rows[i].type === 'POST') m += M.post * (m - 24);
      m = Math.max(0, Math.min(MAX_MIN, m));
      if (X.cal) m = Math.max(0, Math.min(MAX_MIN, m + X.cal[0] + X.cal[1] * (m - 24)));
      out[i] = m;
    });
  }
  return out;
}
const rateX = (r, k, R, lam) => {
  const a = r.f.acc[R.h];
  let y = a.y[k];
  if (lam && r.x.prevRate && r.x.carry) { const c = r.x.carry[R.h]; y += lam * (c.m * r.x.prevRate[k] - c.y[k]); }
  return (y + R.m * r.f.posRate[k]) / (a.m + R.m);
};
const paceX = (r, gamma, dE) => r.f.pace && gamma ? Math.pow((dE ? r.expPace + dE * r.x.wE : r.expPace) / r.f.pace, gamma) : 1;
const naiveOf = (f, k) => { if (k in COMBOS) { const p = COMBOS[k].map(c => f.naive[c]); return p.some(v => v == null) ? null : p.reduce((a, b) => a + b, 0); } return f.naive[k]; };
const PHASE_CUTS = [10, 30, 60];
const phaseIdx = n => n < 10 ? 0 : n < 30 ? 1 : n < 60 ? 2 : 3;
/* the raw means (before the mean stage): tools/props.js means() with the rate and pace changes */
function rawMeans(r, m, P, X) {
  const post = r.type === 'POST', pf = paceX(r, P.gamma, X.dE || 0), mu = {};
  for (const k of STATS) mu[k] = m * rateX(r, k, P.rate[k], X.lam ? X.lam[k] : 0) * pf * (post ? P.post[k] : 1) * (r.oppF && P.opp ? Math.pow(r.oppF[k], P.opp[k]) : 1);
  return mu;
}
function meansX(r, m, P, X) {
  const mu = rawMeans(r, m, P, X);
  if (X.shrink) for (const k of STATS) { const n = r.f.naive[k]; if (n != null) mu[k] = Math.max(0, n + X.shrink[k] * (mu[k] - n)); }
  if (X.phase && r.type === 'REG') { const j = phaseIdx(r.x.teamN); for (const k of STATS) mu[k] *= X.phase[k][j]; }
  for (const [c, parts] of Object.entries(COMBOS)) mu[c] = parts.reduce((s, k) => s + mu[k], 0);
  return mu;
}
function varX(k, mu, m, r, P, X) {
  let v = PR.nbVar(mu, P.var[k]);
  if (X.vm) v *= Math.pow(Math.max(m, 6) / 24, X.vm[k]);
  if (X.vEarly && r.type === 'REG' && r.f.nCur < 5) v *= X.vEarly[k];
  return v;
}

/* ---------- the fit ---------- */
const sidesOf = PR.sidesOf;
/* the minutes: tools/props.js steps 1-3 on absolute error, or the same on squared error (X.sq); then each extension's
   constants, by coordinate search on the same error with the scale refitted after each (two passes) */
function fitMinutes(rows, sides, trainSel, X, G = {}) {
  const tr = []; for (let i = 0; i < rows.length; i++) if (trainSel(rows[i]) && rows[i].played) tr.push(i);
  const L = X.sq ? (d => d * d) : Math.abs;
  const trSides = new Map(); for (const [k, idx] of sides) if (trainSel(rows[idx[0]])) trSides.set(k, idx);
  const err = (M, XX, onlyPost) => {
    const mm = minutesX(rows, trSides, M, XX, onlyPost ? (r => r.type === 'POST') : null);
    let s = 0, n = 0; for (const i of tr) { if (onlyPost && rows[i].type !== 'POST') continue; s += L(mm[i] - rows[i].min); n++; } return n ? s / n : 0;
  };
  const GR = PR.GRID;
  /* step 1: b's half-life, prior weight and prior rule */
  let M = null;
  for (const h of GR.minH) for (const w0 of GR.minW0) for (const minN of GR.minN) {
    let s = 0; const MM = { h, w0, minN };
    for (const i of tr) s += L(baseMinX(rows[i].f, MM, X.open != null ? { open: X.open } : {}) - rows[i].min);
    if (!M || s < M.err) M = { h, w0, minN, err: s };
  }
  M = { h: M.h, w0: M.w0, minN: M.minN, alpha: 0, T: 240, floor: 8, post: 0 };
  const near = (arr, v) => { const j = arr.indexOf(v); return arr.slice(Math.max(0, j - 1), j + 2); };
  const fitScale = (XX, local) => {
    let best = null;
    const As = local ? near(GR.alpha, M.alpha) : GR.alpha, Ts = local ? near(GR.T, M.T) : GR.T, Fs = local ? near(GR.floor, M.floor) : GR.floor;
    for (const alpha of As) for (const T of Ts) for (const floor of Fs) { const e = err({ ...M, alpha, T, floor }, XX); if (!best || e < best.e) best = { alpha, T, floor, e }; }
    Object.assign(M, { alpha: best.alpha, T: best.T, floor: best.floor });
  };
  const fitPost = XX => { let best = null; for (const post of GR.post) { const e = err({ ...M, post }, XX, true); if (!best || e < best.e) best = { post, e }; } M.post = best.post; };
  const XX = { ...X };
  delete XX.cal;
  fitScale(XX);
  /* the extensions' own constants (their grids in G), the scale again after each */
  const keys = ['open', 'ret', 'nt', 'debut', 'kappa'].filter(k => X[k] !== undefined && G[k]);
  for (let pass = 0; pass < (keys.length ? 2 : 0); pass++) {
    for (const key of keys) {
      let best = null;
      for (const v of G[key]) { const e = err(M, { ...XX, [key]: v }); if (!best || e < best.e) best = { v, e }; }
      XX[key] = best.v;
      fitScale(XX, true);
    }
  }
  if (keys.length) fitScale(XX);
  fitPost(XX);
  /* the calibration: least squares of the actual minutes on the projected, played training rows */
  if (X.cal !== undefined) {
    const mm = minutesX(rows, trSides, M, XX, null);
    let n = 0, sx = 0, sy = 0, sxx = 0, sxy = 0;
    for (const i of tr) { const x = mm[i] - 24, y = rows[i].min - mm[i]; n++; sx += x; sy += y; sxx += x * x; sxy += x * y; }
    const c1 = (n * sxy - sx * sy) / (n * sxx - sx * sx), c0 = (sy - c1 * sx) / n;
    XX.cal = [Math.round(c0 * 1e4) / 1e4, Math.round(c1 * 1e4) / 1e4];
  }
  return { M, X: XX, err: err(M, XX) };
}
/* tools/props.js steps 4-8 (rates, pace, opponent, playoffs, spreads) and 9 (the copula) on given minutes; X.lam and
   X.dE are fitted here with the rates and the pace, X.shrink, X.phase, X.vm and X.vEarly after them */
function fitRest(rows, trainSel, mins, M, X, G = {}, opts = {}) {
  const trP = []; for (let i = 0; i < rows.length; i++) if (trainSel(rows[i]) && rows[i].played) trP.push(i);
  const XX = { ...X };
  /* 4. rates (and the carried-in share) */
  const rate = {}; const lam = {};
  const lamGrid = X.lam !== undefined && G.lam ? G.lam : [0];
  for (const k of STATS) {
    let b2 = null;
    for (const l of lamGrid) for (const h of H_SET) for (const m of PR.GRID.rateM) {
      let s = 0; for (const i of trP) { const r = rows[i]; const mu = mins[i] * rateX(r, k, { h, m }, l); s += (mu - r.y[k]) ** 2; }
      if (!b2 || s < b2.s) b2 = { h, m, l, s };
    }
    rate[k] = { h: b2.h, m: b2.m }; lam[k] = b2.l;
  }
  if (X.lam !== undefined) XX.lam = lam; else delete XX.lam;
  const lamOf = k => XX.lam ? XX.lam[k] : 0;
  /* 5. pace (and the season-start pace) */
  const vy = {}; for (const k of STATS) { const ys = trP.map(i => rows[i].y[k]); const mm = ys.reduce((a, b) => a + b, 0) / ys.length; vy[k] = ys.reduce((s, y) => s + (y - mm) ** 2, 0) / ys.length; }
  const rt = {}; for (const k of STATS) { const a = new Float64Array(rows.length); for (const i of trP) a[i] = rateX(rows[i], k, rate[k], lamOf(k)); rt[k] = a; }
  let gb = null;
  const dEGrid = X.dE !== undefined && G.dE ? G.dE : [0];
  for (const dE of dEGrid) for (const gamma of PR.GRID.gamma) {
    let s = 0; for (const i of trP) { const r = rows[i]; const pf = paceX(r, gamma, dE); for (const k of STATS) s += (mins[i] * rt[k][i] * pf - r.y[k]) ** 2 / vy[k]; }
    if (!gb || s < gb.s) gb = { gamma, dE, s };
  }
  const gamma = gb.gamma; if (X.dE !== undefined) XX.dE = gb.dE; else delete XX.dE;
  const pfA = new Float64Array(rows.length); for (const i of trP) pfA[i] = paceX(rows[i], gamma, XX.dE || 0);
  /* 6. the opponent */
  const opp = {};
  for (const k of STATS) {
    let ob = null;
    for (const e of PR.GRID.opp) { let s = 0; for (const i of trP) { const r = rows[i]; s += (mins[i] * rt[k][i] * pfA[i] * Math.pow(r.oppF[k], e) - r.y[k]) ** 2; } if (!ob || s < ob.s) ob = { e, s }; }
    opp[k] = ob.e;
  }
  /* 7. the playoffs */
  const post = {};
  for (const k of STATS) { let sy = 0, sm = 0; for (const i of trP) { const r = rows[i]; if (r.type !== 'POST') continue; sy += r.y[k]; sm += mins[i] * rt[k][i] * pfA[i] * Math.pow(r.oppF[k], opp[k]); } post[k] = sm > 0 ? Math.round(sy / sm * 1e4) / 1e4 : 1; }
  const P = { min: M, rate, gamma, opp, post, var: {}, rho: 0 };
  /* the mean stage: the shrink toward his own average, then the season-phase multipliers (regular season) */
  const raw = new Map(trP.map(i => [i, rawMeans(rows[i], mins[i], P, XX)]));
  if (X.shrink !== undefined) {
    XX.shrink = {};
    for (const k of STATS) {
      let sxy = 0, sxx = 0;
      for (const i of trP) { const n = rows[i].f.naive[k]; if (n == null) continue; const d = raw.get(i)[k] - n; sxy += d * (rows[i].y[k] - n); sxx += d * d; }
      XX.shrink[k] = Math.round(Math.min(1.2, Math.max(0, sxy / sxx)) * 1e4) / 1e4;
    }
  } else delete XX.shrink;
  if (X.phase !== undefined) {
    XX.phase = {};
    const tmp = { ...XX, phase: undefined };
    const sm = {}, sy = {}; for (const k of STATS) { sm[k] = [0, 0, 0, 0]; sy[k] = [0, 0, 0, 0]; }
    for (const i of trP) { const r = rows[i]; if (r.type !== 'REG') continue; const mu = meansX(r, mins[i], P, tmp), j = phaseIdx(r.x.teamN); for (const k of STATS) { sm[k][j] += mu[k]; sy[k][j] += r.y[k]; } }
    for (const k of STATS) XX.phase[k] = sm[k].map((s, j) => s > 0 ? Math.round(sy[k][j] / s * 1e4) / 1e4 : 1);
  } else delete XX.phase;
  /* 8. the spreads, per stat and per combo on its own results */
  const mus = new Map(trP.map(i => [i, meansX(rows[i], mins[i], P, XX)]));
  const XV = { ...XX }; delete XV.vm; delete XV.vEarly;
  for (const k of ALL) P.var[k] = PR.fitVar(trP.map(i => [mus.get(i)[k], PR.yOf(rows[i].y, k)]));
  if (X.vm !== undefined || X.vEarly !== undefined) {
    if (X.vm !== undefined) XX.vm = {}; else delete XX.vm;
    if (X.vEarly !== undefined) XX.vEarly = {}; else delete XX.vEarly;
    for (const k of ALL) {
      const pairs = trP.filter(i => mus.get(i)[k] > 0.02).map(i => ({ mu: mus.get(i)[k], y: PR.yOf(rows[i].y, k), m: mins[i], r: rows[i] }));
      const fitted = fitVarX(pairs, P.var[k], X.vm !== undefined ? (G.vm || [0]) : [0], X.vEarly !== undefined ? (G.vEarly || [1]) : [1]);
      P.var[k] = fitted.ab; if (XX.vm) XX.vm[k] = fitted.C; if (XX.vEarly) XX.vEarly[k] = fitted.E;
    }
  }
  /* 9. the copula's correlation (only for the frozen candidate: no score below reads the doubles) */
  P.rho = opts.rho != null ? opts.rho : 0;
  if (opts.fitRho) {
    const dd = trP.filter(i => Math.max(mus.get(i).pts, mus.get(i).reb, mus.get(i).ast) >= 5);
    let rb = null;
    for (const rho of PR.GRID.rho) {
      let s = 0;
      for (const i of dd) { const q = PR.doublesProb(mus.get(i), P.var, rho), c = PR.doubles(rows[i].y); const a = Math.min(Math.max(q.dd, 1e-6), 1 - 1e-6), b = Math.min(Math.max(q.td, 1e-6), 1 - 1e-6); s -= (c >= 2 ? Math.log(a) : Math.log(1 - a)) + (c >= 3 ? Math.log(b) : Math.log(1 - b)); }
      if (!rb || s < rb.s) rb = { rho, s };
    }
    P.rho = rb.rho;
  }
  return { P, X: XX };
}
/* the spread with its minutes exponent C and its early multiplier E: B held at tools/props.js fitVar's own (then moved
   0.1 either way at the end), A by golden section, C on its grid with E at 1, then E on its grid at that C; on every
   fourth row (by the mean's order, as fitVar halves them), the best log likelihood */
function fitVarX(pairs, ab0, Cs, Es) {
  pairs = pairs.slice().sort((a, b) => a.mu - b.mu).filter((_, j) => j % 2 === 0);
  const early = pairs.map(p => p.r.type === 'REG' && p.r.f.nCur < 5);
  const lm = pairs.map(p => Math.log(Math.max(p.m, 6) / 24));
  const fitA = (B, C, E) => {
    const fac = pairs.map((p, j) => Math.exp(C * lm[j]) * (early[j] ? E : 1));
    const ll = A => { let s = 0; for (let j = 0; j < pairs.length; j++) { const p = pairs[j]; s += PR.nbLogPmf(p.y, p.mu, A * Math.pow(p.mu, B) * fac[j]); } return s; };
    let lo = Math.log(ab0[0]) - 1.2, hi = Math.log(ab0[0]) + 1.2;
    for (let it = 0; it < 22; it++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (ll(Math.exp(m1)) > ll(Math.exp(m2))) hi = m2; else lo = m1; }
    const A = Math.exp((lo + hi) / 2); return { A, B, C, E, ll: ll(A) };
  };
  let best = null;
  for (const C of Cs) { const f = fitA(ab0[1], C, 1); if (!best || f.ll > best.ll) best = f; }
  for (const E of Es) { if (E === 1) continue; const f = fitA(ab0[1], best.C, E); if (f.ll > best.ll) best = f; }
  for (const dB of [-0.1, 0.1]) { const f = fitA(ab0[1] + dB, best.C, best.E); if (f.ll > best.ll) best = f; }
  return { ab: [Math.round(best.A * 1e4) / 1e4, Math.round(best.B * 1e4) / 1e4], C: best.C, E: best.E, ll: best.ll };
}
/* the whole fit for one fold: minutes, then the rest on those minutes */
function fitAllX(rows, sides, trainSel, X, G, opts = {}) {
  const fm = fitMinutes(rows, sides, trainSel, X, G);
  const mins = minutesX(rows, sides, fm.M, fm.X, trainSel);
  const fr = fitRest(rows, trainSel, mins, fm.M, fm.X, G, opts);
  return { P: fr.P, X: fr.X, minErr: fm.err };
}

/* ---------- projecting and scoring ---------- */
function projectX(rows, sides, P, X, sel) {
  const mins = minutesX(rows, sides, P.min, X, sel);
  const out = new Map();
  rows.forEach((r, i) => { if (!r.played || !sel(r)) return; const m = mins[i]; const mu = meansX(r, m, P, X); const v = {}; for (const k of ALL) v[k] = varX(k, mu[k], m, r, P, X); out.set(i, { m, mu, v }); });
  return out;
}
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
/* tools/props.js score()'s per-stat numbers (the same rows: played, with a game this season or last): mean absolute
   error, bias, the negative binomial's log score, and the log loss at a line where a book would hang it (his own average
   to the half point below) */
function scoreX(rows, proj) {
  const S = {}; for (const k of ALL) S[k] = { n: 0, mae: 0, bias: 0, ls: 0, ll: 0 };
  let mn = 0, me = 0, mb = 0;
  for (const [i, x] of proj) {
    const r = rows[i];
    if (naiveOf(r.f, 'pts') == null) continue;
    mn++; me += Math.abs(x.m - r.min); mb += x.m - r.min;
    for (const k of ALL) {
      const y = PR.yOf(r.y, k), mu = x.mu[k], v = x.v[k], s = S[k], nv = naiveOf(r.f, k);
      s.n++; s.mae += Math.abs(mu - y); s.bias += mu - y; s.ls -= PR.nbLogPmf(y, mu, v);
      const line = Math.floor(nv) + 0.5, o = y > line ? 1 : 0, p = clip(PR.nbSf(Math.floor(line) + 1, mu, v));
      s.ll -= o ? Math.log(p) : Math.log(1 - p);
    }
  }
  const out = { n: mn, minutes: { mae: mn ? me / mn : null, bias: mn ? mb / mn : null }, stats: {} };
  let ls = 0, ll = 0, mae = 0;
  for (const k of ALL) { const s = S[k]; out.stats[k] = { n: s.n, mae: s.mae / s.n, bias: s.bias / s.n, logScore: s.ls / s.n, lineLogloss: s.ll / s.n }; ls += s.ls / s.n; ll += s.ll / s.n; mae += s.mae / s.n; }
  out.meanLogScore = ls / ALL.length; out.meanLineLogloss = ll / ALL.length; out.meanMae = mae / ALL.length;
  return out;
}
/* the market test on DraftKings' 2026 play-in and playoff closing lines, as tools/props.js marketTest grades them */
function archiveLines(rows, sides, P, X, boxes) {
  const REC = require('../../tools/props_record.js');
  const rec = REC.readRecord(2026);
  const games = new Set(rec.map(r => r.game_id));
  const pr = projectX(rows, sides, P, X, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(rows[i].game + '|' + rows[i].id, { x, r: rows[i] });
  const played = new Set();
  for (const gid of games) for (const side of Object.values(boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
  const lines = []; let voids = 0, noCall = 0;
  for (const l of rec) {
    const k = l.game_id + '|' + l.player_id;
    if (!played.has(k)) { voids++; continue; }
    const a = at.get(k);
    if (!a) { noCall++; continue; }
    const mu = a.x.mu[l.stat], v = a.x.v[l.stat], y = PR.yOf(a.r.y, l.stat);
    lines.push({ game: l.game_id, stat: l.stat, line: l.line, over: l.over, under: l.under, mu, y, m: a.x.m, min: a.r.min,
      pModel: PR.pOver(l.line, mu, v), pMarket: F.propFairOver(l.over, l.under), result: y > l.line ? 'over' : y < l.line ? 'under' : 'push' });
  }
  return { lines: lines.filter(x => x.result !== 'push'), voids, noCall };
}

module.exports = { LAST, loadData, replayX, minutesX, meansX, rawMeans, varX, fitMinutes, fitRest, fitAllX, fitVarX, projectX, scoreX, archiveLines, naiveOf, baseMinX, rateX, paceX, sidesOf, PHASE_CUTS, phaseIdx };
