/* The Joker: gradient-boosted trees on every number the job has before tip-off.
 *
 *   node tools/joker.js            score the season in play with the frozen trees in models/joker.json, write it
 *   node tools/joker.js research   the walk-forward (folds 2024, 2025, 2026) and the design choice -> research/joker.json
 *   node tools/joker.js fit        refit the live trees on 2022-23 to 2025-26, by hand only, then score as above
 *
 * The NFL hub's Joker is one boosted-tree classifier on every variable its job has before kickoff, fitted on finished
 * seasons and frozen for the season. This is the NBA's, in the same spirit and with the NFL's settings (tools/gbm.js:
 * binomial deviance, depth 4, 25 rounds, learning rate 0.1, at least 5 games a leaf, medians imputed, categories one-hot).
 * Its inputs, built by one function (build) for training and for the games to come:
 *
 *   the market     the moneylines' chance with the book's margin taken out (each side's implied chance over their sum),
 *                  the home line and the total where they pass fetch_odds_hist.js's check(); data/odds_hist.csv's
 *                  closing lines for 2022-23 to 2025-26, games.csv's (the job's last read before tip) from 2026-27 on
 *   Team Elo       its pre-game chance (tools/elo.js on model.json's parameters)
 *   player model   its pre-game chance, spread, total and pace with the previous game's lineup at projected minutes
 *                  (tools/players.js, "no report"): a fold's own parameters from research.json, players.json's live
 *   the setting    playoffs, day of the season, neutral site, altitude, each side's rest (capped at 10 days), back to
 *                  back, three in four nights, time zones crossed since a game two days or less before, same division
 *                  or conference, and in the playoffs the series game and the home side's series lead
 *   running form   each side's points per 100 possessions scored and allowed and its pace (possessions per 48), a
 *                  running average from the team box scores (0.1 a game, carried 0.7 toward the league at a season's turn)
 *   the teams      home and away as categories
 *
 * and, where a design tried in the walk-forward wants them, the four factors scored and allowed, the two coaches and
 * each side's top player by minutes in its previous game (research/joker.json says which design was chosen and why).
 *
 * Every input of a game is known before its tip. The state a row reads is the state when its Eastern day began: every
 * final of an earlier day and nothing of its own day, so a game's row built the morning it is played is the row it has
 * once it is final, which test_joker.js holds. The two models' numbers are read the same way: their replays are run on
 * the finals with a copy of each game, marked a game to come, set in front of its day's finals (shadow), so the model
 * prices it exactly as it would have that morning, a team's first game of a season included. The schedule terms read
 * the schedule, whatever has been played.
 *
 * A game with no moneyline posted gets no call: an imputed market would read as a typical favourite. The live trees are
 * fitted on 2022-23 to 2025-26 (the seasons with closing lines; 2021-22, the first with box scores, only warms the running
 * numbers up) and never refitted by the job; each call's input row is logged in models/joker.json (inputs) while its game
 * is still to tip, then frozen, so a later refit can train on what the job saw.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('./lib');
const E = require('./elo');
const PM = require('./players');
const G = require('./gbm');
const { check } = require('./fetch_odds_hist');

const ROOT = L.ROOT;
const OUT = path.join(ROOT, 'models', 'joker.json');
const RESEARCH = path.join(ROOT, 'research', 'joker.json');
const FIT_SEASONS = [2023, 2024, 2025, 2026];
const FOLDS = [2024, 2025, 2026], DEV = [2024, 2025];
const FIRST_ROW = 2023;
const HYPER = { loss: 'binomial', rounds: 25, lr: 0.1, depth: 4, minLeaf: 5, minHess: 1e-3 };
const VERSION = '1';
const NAME = 'The Joker';
const ABOUT = 'Gradient-boosted trees (binomial deviance, depth 4, 25 rounds, learning rate 0.1, at least 5 games a leaf) on every ' +
  'number the job has before tip-off: the market\'s moneyline chance, line and total, Team Elo, the player model on the previous ' +
  'game\'s lineup, rest, back to backs, travel, altitude, each side\'s running efficiency and pace, and the teams. Fitted on ' +
  '2022-23 to 2025-26 and never refitted in the job; a game with no moneyline posted gets no call.';

/* ---------- the pieces of a row ---------- */
const SHADOW = 'joker|';
const ALT = new Set(['DEN', 'UTA']);
const ALPHA = 0.1, CARRY = 0.7, LGW = 0.005;   // running form: weight of the newest game, the season's carry, the league mean's step
const CAP_REST = 10;
/* the divisions of the 30 clubs, unchanged since 2004-05 */
const DIV = { ATL: 'SE', CHA: 'SE', MIA: 'SE', ORL: 'SE', WAS: 'SE', BOS: 'AT', BKN: 'AT', NYK: 'AT', PHI: 'AT', TOR: 'AT',
  CHI: 'CE', CLE: 'CE', DET: 'CE', IND: 'CE', MIL: 'CE', DEN: 'NW', MIN: 'NW', OKC: 'NW', POR: 'NW', UTA: 'NW',
  GSW: 'PA', LAC: 'PA', LAL: 'PA', PHX: 'PA', SAC: 'PA', DAL: 'SW', HOU: 'SW', MEM: 'SW', NOP: 'SW', SAS: 'SW' };
const EAST = new Set(['SE', 'AT', 'CE']);
/* each club's home clock: players.js's TRAVEL table, which it does not export */
const TZ = { ATL: 'America/New_York', BOS: 'America/New_York', BKN: 'America/New_York', CHA: 'America/New_York', CHI: 'America/Chicago',
  CLE: 'America/New_York', DAL: 'America/Chicago', DEN: 'America/Denver', DET: 'America/Detroit', GSW: 'America/Los_Angeles',
  HOU: 'America/Chicago', IND: 'America/Indiana/Indianapolis', LAC: 'America/Los_Angeles', LAL: 'America/Los_Angeles', MEM: 'America/Chicago',
  MIA: 'America/New_York', MIL: 'America/Chicago', MIN: 'America/Chicago', NOP: 'America/Chicago', NYK: 'America/New_York',
  OKC: 'America/Chicago', ORL: 'America/New_York', PHI: 'America/New_York', PHX: 'America/Phoenix', POR: 'America/Los_Angeles',
  SAC: 'America/Los_Angeles', SAS: 'America/Chicago', TOR: 'America/Toronto', UTA: 'America/Denver', WAS: 'America/New_York' };
const tzMemo = {};
function tzHours(zone, date) {
  const k = zone + date;
  if (tzMemo[k] === undefined) {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date(date + 'T17:00:00Z')).find(x => x.type === 'timeZoneName').value;
    const m = /GMT([+-]\d+)(?::(\d+))?/.exec(name);
    tzMemo[k] = m ? +m[1] + Math.sign(+m[1]) * (m[2] ? +m[2] / 60 : 0) : 0;
  }
  return tzMemo[k];
}
const dayGap = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const dec = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;
const pairN = v => { const m = /^\s*(\d+)\s*-\s*(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2]] : null; };
const byDateId = (a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : 0;

const NUM = ['mk_p', 'mk_line', 'mk_total', 'elo_p', 'pm_p', 'pm_spread', 'pm_total', 'pm_pace',
  'post', 'day', 'neutral', 'alt_home', 'rest_h', 'rest_a', 'rest_d', 'b2b_h', 'b2b_a', 'three4_h', 'three4_a', 'tz_h', 'tz_a',
  'div', 'conf', 'series_game', 'series_diff',
  'ortg_h', 'drtg_h', 'pace_h', 'n_h', 'ortg_a', 'drtg_a', 'pace_a', 'n_a', 'net',
  'efg_h', 'defg_h', 'tov_h', 'dtov_h', 'orb_h', 'dorb_h', 'ftr_h', 'dftr_h',
  'efg_a', 'defg_a', 'tov_a', 'dtov_a', 'orb_a', 'dorb_a', 'ftr_a', 'dftr_a'];
const CAT = ['home', 'away', 'coach_h', 'coach_a', 'star_h', 'star_a'];
const FACTORS = NUM.filter(c => /^(d?(efg|tov|orb|ftr))_[ha]$/.test(c));
const CORE = NUM.filter(c => !FACTORS.includes(c));
/* THE DESIGNS, set before any fold was scored: the task's inputs (base), then base with the people as categories, with
   the four factors, and without the teams. research picks the one with the lowest mean log loss on 2024 and 2025 */
const DESIGNS = [
  { id: 'base', about: 'the market, Team Elo, the player model on the previous lineup, the setting, running efficiency and pace, the teams', num: CORE, cat: ['home', 'away'] },
  { id: 'people', about: 'base, plus both coaches and each side\'s top player by minutes in its previous game, as categories', num: CORE, cat: CAT },
  { id: 'factors', about: 'base, plus the four factors (effective field goal rate, turnovers, offensive rebounds, free-throw rate) scored and allowed', num: NUM, cat: ['home', 'away'] },
  { id: 'noteams', about: 'base without the teams as categories', num: CORE, cat: [] },
];
/* a reference, never a candidate: the same trees on the market's three numbers alone, to show what the rest adds */
const MARKET_ONLY = { id: 'market only', about: 'the market\'s chance, line and total alone', num: ['mk_p', 'mk_line', 'mk_total'], cat: [] };

/* ---------- data ---------- */
function readOdds() {
  const f = path.join(ROOT, 'data', 'odds_hist.csv');
  if (!fs.existsSync(f)) return {};
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n'); const h = lines.shift().split(',');
  const out = {};
  for (const l of lines) { if (!l) continue; const v = l.split(','); const o = {}; h.forEach((k, i) => { o[k] = v[i] ?? ''; }); out[o.game_id] = o; }
  return out;
}
/* everything build reads, from the repo's files; the tests hand build a made-up one of the same shape */
function load() {
  const games = L.readGames().filter(g => g.type !== 'PRE');   // a preseason game is never a row and never moves a rating
  games.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const json = f => JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8'));
  return { games, boxes: PM.loadBoxes(), teamStats: PM.loadTeamBoxes(), coachOf: PM.loadCoaches(), raptor: PM.loadRaptor(), odds: readOdds(),
    situP: json('model.json').params, pmLive: json('players.json').params, research: json('research.json') };
}

/* the market on a game: games.csv's moneylines where the job kept them (2026-27 on), else the closing row in odds_hist.csv;
   no valid moneyline is no market, and a line or total check() refuses is missing */
function market(g, odds, open) {
  let src = g.home_ml !== '' && g.home_ml != null && g.away_ml !== '' && g.away_ml != null
    ? { provider: '', home_ml: g.home_ml, away_ml: g.away_ml, home_line: g.home_line, total: g.total } : odds[g.game_id];
  if (src && open) src = { provider: src.provider, home_ml: src.home_ml_open, away_ml: src.away_ml_open, home_line: src.home_line_open, total: src.total_open };
  if (!src) return { ok: false };
  const c = check(src);
  if (!c.ml) return { ok: false };
  const hi = 1 / dec(+src.home_ml), ai = 1 / dec(+src.away_ml);
  return { ok: true, p: hi / (hi + ai), line: c.line ? +src.home_line : null, total: c.total ? +src.total : null, ml: [+src.home_ml, +src.away_ml] };
}

/* one side's numbers in one final from the team box: possessions as players.js counts them, points from the score */
function sideBox(stats, oppStats, score, rows) {
  if (!stats || !oppStats) return null;
  const fg = pairN(stats['fieldGoalsMade-fieldGoalsAttempted']), tp = pairN(stats['threePointFieldGoalsMade-threePointFieldGoalsAttempted']), ft = pairN(stats['freeThrowsMade-freeThrowsAttempted']);
  if (!fg || !ft || !fg[1]) return null;
  const orb = +stats.offensiveRebounds || 0, tov = +stats.totalTurnovers || +stats.turnovers || 0, oppDrb = +oppStats.defensiveRebounds || 0;
  const poss = Math.max(fg[1] - orb + tov + 0.44 * ft[1], 60);
  let min = 0; for (const r of rows || []) min += r.min;
  min = Math.max(min, 240);
  const pts = +score;
  return { ortg: 100 * pts / poss, pace: poss * 240 / min, efg: (fg[0] + 0.5 * (tp ? tp[0] : 0)) / fg[1], tov: tov / poss,
    orb: orb + oppDrb ? orb / (orb + oppDrb) : 0, ftr: ft[1] / fg[1] };
}
const OWN = ['ortg', 'pace', 'efg', 'tov', 'orb', 'ftr'], ALLOWED = ['ortg', 'efg', 'tov', 'orb', 'ftr'];

/* the two models' replays with every game of a day priced as that day began (see the head of the file) */
function replays(D, pmParams, situP, from, eloCache) {
  const games = D.games.filter(g => g.type !== 'PRE').sort(byDateId);
  const elo = [], pm = [], prevBoxed = {}, lastBoxed = {};
  const shadow = g => ({ ...g, game_id: SHADOW + g.game_id, status: 'scheduled', type: 'PRE', home_score: '', away_score: '' });
  for (let i = 0; i < games.length;) {
    let j = i; while (j < games.length && games[j].date === games[i].date) j++;
    const day = games.slice(i, j);
    for (const g of day) if (g.season >= from) {
      const s = shadow(g); elo.push(s); if (g.season >= PM.FIRST) pm.push(s);
      prevBoxed[g.game_id] = { home: lastBoxed[g.home] || null, away: lastBoxed[g.away] || null };
    }
    for (const g of day) if (g.status === 'final') {
      elo.push(g);
      if (g.season < PM.FIRST) continue;
      pm.push(g);
      const b = D.boxes[g.game_id]; if (b && b[g.home] && b[g.away]) { lastBoxed[g.home] = g.game_id; lastBoxed[g.away] = g.game_id; }
    }
    i = j;
  }
  const TE = eloCache || E.replay(situP, elo, true);
  const teamDiff = {};
  for (const [k, u] of Object.entries(TE.upcoming)) if (k.startsWith(SHADOW)) { const p = Math.min(Math.max(u.pHome, 1e-4), 1 - 1e-4); teamDiff[k] = 400 * Math.log10(p / (1 - p)); }
  /* "no report": the previous game's players at their projected minutes, as players.js's naive lineup is, here for a
     game to come as well as a final */
  const liveLineup = (g, players, projected) => {
    const pb = prevBoxed[g.game_id.slice(SHADOW.length)] || {};
    const side = (t, gid) => ({ list: gid ? D.boxes[gid][t].filter(r => r.min > 0).map(r => { const p = players[r.player_id]; return [p, projected(p, r.starter)]; }) : [], out: [], coach: '' });
    return { home: side(g.home, pb.home), away: side(g.away, pb.away) };
  };
  const ctx = { games: pm, boxes: D.boxes, teamStats: D.teamStats, coachOf: D.coachOf, raptor: D.raptor, situP, teamDiff, liveLineup };
  const PR = PM.replay(pmParams, ctx, 'naive', true);
  return { TE, PR, prevBoxed };
}

/* ---------- the rows: one function for training and for the games to come ---------- */
function build(D, pmParams, situP, opts = {}) {
  const from = opts.from || FIRST_ROW;
  const { TE, PR, prevBoxed } = replays(D, pmParams, situP, from, opts.elo);
  const games = D.games.filter(g => g.type !== 'PRE').sort(byDateId);
  const sched = {}, firstReg = {};
  for (const g of games) {
    for (const t of [g.home, g.away]) (sched[t + '|' + g.season] = sched[t + '|' + g.season] || []).push(g);
    if (g.type === 'REG' && (!firstReg[g.season] || g.date < firstReg[g.season])) firstReg[g.season] = g.date;
  }
  const prevGames = (t, g) => { const list = sched[t + '|' + g.season]; const out = []; for (let k = list.length - 1; k >= 0 && out.length < 2; k--) if (list[k].date < g.date) out.push(list[k]); return out; };
  const state = {}, lm = {}, series = {};
  /* a club entering a new season: its running numbers carried toward the league's, its count of games restarted */
  const enter = (t, season) => {
    const s = state[t];
    if (!s || s.season === season) return s;
    for (const c of OWN) if (lm[c] !== undefined) s.own[c] = lm[c] + CARRY * (s.own[c] - lm[c]);
    for (const c of ALLOWED) if (lm[c] !== undefined) s.opp[c] = lm[c] + CARRY * (s.opp[c] - lm[c]);
    s.season = season; s.n = 0;
    return s;
  };
  const star = (gid, t) => {
    if (!gid) return '(none)';
    let best = null; for (const r of D.boxes[gid][t]) if (r.min > 0 && (!best || r.min > best.min)) best = r;
    return best ? best.name : '(none)';
  };
  const rows = [];
  const makeRow = g => {
    const sid = SHADOW + g.game_id, eu = TE.upcoming[sid], pu = PR.upcoming[sid], mk = market(g, D.odds);
    const neutral = g.neutral === 1 ? 1 : 0, vz = neutral ? null : TZ[g.home] || null;
    const num = {};
    num.mk_p = mk.ok ? mk.p : null; num.mk_line = mk.ok ? mk.line : null; num.mk_total = mk.ok ? mk.total : null;
    num.elo_p = eu ? eu.pHome : null;
    num.pm_p = pu ? pu.pHome : null; num.pm_spread = pu ? pu.spread : null; num.pm_total = pu ? pu.total : null; num.pm_pace = pu ? pu.pace : null;
    num.post = g.type === 'POST' ? 1 : 0;
    num.day = firstReg[g.season] ? dayGap(firstReg[g.season], g.date) : null;
    num.neutral = neutral; num.alt_home = !neutral && ALT.has(g.home) ? 1 : 0;
    for (const [t, k] of [[g.home, 'h'], [g.away, 'a']]) {
      const [p1, p2] = prevGames(t, g);
      const rest = p1 ? Math.min(dayGap(p1.date, g.date), CAP_REST) : CAP_REST;
      num['rest_' + k] = rest; num['b2b_' + k] = p1 && rest === 1 ? 1 : 0; num['three4_' + k] = p2 && dayGap(p2.date, g.date) <= 3 ? 1 : 0;
      const pz = p1 && !(p1.neutral === 1) ? TZ[p1.home] || null : null;
      num['tz_' + k] = p1 && vz && pz && dayGap(p1.date, g.date) <= 2 ? Math.abs(tzHours(vz, g.date) - tzHours(pz, g.date)) : 0;
    }
    num.rest_d = num.rest_h - num.rest_a;
    num.div = DIV[g.home] && DIV[g.home] === DIV[g.away] ? 1 : 0;
    num.conf = DIV[g.home] && DIV[g.away] && EAST.has(DIV[g.home]) === EAST.has(DIV[g.away]) ? 1 : 0;
    const sr = g.type === 'POST' ? series[g.season + '|' + [g.home, g.away].sort().join('|')] || [] : [];
    num.series_game = g.type === 'POST' ? sr.length + 1 : 0;
    num.series_diff = sr.reduce((s, w) => s + (w === g.home ? 1 : w === g.away ? -1 : 0), 0);
    for (const [t, k] of [[g.home, 'h'], [g.away, 'a']]) {
      const s = enter(t, g.season);
      num['ortg_' + k] = s ? s.own.ortg : null; num['drtg_' + k] = s ? s.opp.ortg : null; num['pace_' + k] = s ? s.own.pace : null; num['n_' + k] = s ? s.n : 0;
      for (const c of ['efg', 'tov', 'orb', 'ftr']) { num[c + '_' + k] = s ? s.own[c] : null; num['d' + c + '_' + k] = s ? s.opp[c] : null; }
    }
    num.net = num.ortg_h !== null && num.ortg_a !== null ? (num.ortg_h - num.drtg_h) - (num.ortg_a - num.drtg_a) : null;
    const pb = prevBoxed[g.game_id] || {};
    const cat = { home: g.home, away: g.away, coach_h: D.coachOf(g.season, g.home, g.date), coach_a: D.coachOf(g.season, g.away, g.date),
      star_h: star(pb.home, g.home), star_a: star(pb.away, g.away) };
    const final = g.status === 'final';
    rows.push({ id: g.game_id, season: g.season, date: g.date, type: g.type, home: g.home, away: g.away, status: g.status, tip: g.tip || '',
      final, y: final ? (+g.home_score > +g.away_score ? 1 : 0) : null, mov: final ? +g.home_score - +g.away_score : null, market: mk, num, cat });
  };
  const update = g => {
    const b = D.boxes[g.game_id] || {};
    const sh = sideBox(D.teamStats[g.game_id + ':' + g.home], D.teamStats[g.game_id + ':' + g.away], g.home_score, b[g.home]);
    const sa = sideBox(D.teamStats[g.game_id + ':' + g.away], D.teamStats[g.game_id + ':' + g.home], g.away_score, b[g.away]);
    if (g.type === 'POST') { const k = g.season + '|' + [g.home, g.away].sort().join('|'); (series[k] = series[k] || []).push(+g.home_score > +g.away_score ? g.home : g.away); }
    if (!sh || !sa) return;                                   // a side with no box score: nothing to learn from the game
    for (const [t, own, opp] of [[g.home, sh, sa], [g.away, sa, sh]]) {
      let s = enter(t, g.season);
      if (!s) { s = state[t] = { season: g.season, n: 0, own: {}, opp: {} }; for (const c of OWN) s.own[c] = own[c]; for (const c of ALLOWED) s.opp[c] = opp[c]; }
      else { for (const c of OWN) s.own[c] += ALPHA * (own[c] - s.own[c]); for (const c of ALLOWED) s.opp[c] += ALPHA * (opp[c] - s.opp[c]); }
      s.n++;
    }
    for (const x of [sh, sa]) for (const c of OWN) lm[c] = lm[c] === undefined ? x[c] : lm[c] + LGW * (x[c] - lm[c]);
  };
  for (let i = 0; i < games.length;) {
    let j = i; while (j < games.length && games[j].date === games[i].date) j++;
    const day = games.slice(i, j);
    for (const g of day) if (g.season >= from) makeRow(g);
    for (const g of day) if (g.status === 'final') update(g);
    i = j;
  }
  return { rows, TE, PR };
}

/* ---------- the trees ---------- */
const median = v => { const s = v.slice().sort((a, b) => a - b); const n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : 0; };
function encoder(train, design) {
  const medians = {}, levels = {};
  for (const c of design.num) medians[c] = median(train.map(r => r.num[c]).filter(v => v !== null && Number.isFinite(v)));
  for (const c of design.cat) levels[c] = [...new Set(train.map(r => r.cat[c]))].sort();
  return { num: design.num.slice(), cat: design.cat.slice(), medians, levels };
}
function encode(enc, r) {
  const x = enc.num.map(c => r.num[c] === null || !Number.isFinite(r.num[c]) ? enc.medians[c] : r.num[c]);
  for (const c of enc.cat) for (const v of enc.levels[c]) x.push(r.cat[c] === v ? 1 : 0);   // a category training never saw is all zeros
  return x;
}
const logit = p => { const q = Math.min(Math.max(p, 1e-6), 1 - 1e-6); return Math.log(q / (1 - q)); };
/* the Joker on a set of rows: the win trees, and its spread two ways (which one is published is the walk-forward's
   choice): 'scale', the home margin the chance implies at s points a unit of log-odds, s fitted by least squares on the
   training rows; 'trees', the same trees fitted to the home margin by squared error */
function fitJoker(train, design) {
  const enc = encoder(train, design);
  const X = train.map(r => encode(enc, r)), y = train.map(r => r.y), mov = train.map(r => r.mov);
  const win = G.fit(X, y, HYPER);
  const margin = G.fit(X, mov, { ...HYPER, loss: 'squared' });
  let sz = 0, zz = 0; X.forEach((x, i) => { const z = logit(G.predict(win, x)); sz += mov[i] * z; zz += z * z; });
  const sha = crypto.createHash('sha256').update(JSON.stringify([X, y, mov])).digest('hex');
  return { design: design.id, enc, win, margin, scale: zz ? sz / zz : 0, rows: train.length, sha };
}
function callOf(J, r, how) {
  const x = encode(J.enc, r), p = G.predict(J.win, x);
  return { p, spread: -(how === 'trees' ? G.predict(J.margin, x) : J.scale * logit(p)), spreadTrees: -G.predict(J.margin, x), spreadScale: -J.scale * logit(p) };
}

/* ---------- scoring ---------- */
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
function metrics(list) {
  /* list: [{p, y, mov, spread?}]; spread is the book's way round, so the home margin it says is -spread */
  let ll = 0, br = 0, hit = 0, ae = 0, na = 0;
  for (const r of list) {
    ll -= Math.log(clip(r.y ? r.p : 1 - r.p)); br += (r.p - r.y) ** 2; hit += (r.p >= 0.5) === (r.y === 1);
    if (r.spread !== null && r.spread !== undefined && Number.isFinite(r.spread)) { ae += Math.abs(r.mov + r.spread); na++; }
  }
  const n = list.length;
  return n ? { games: n, logloss: +(ll / n).toFixed(5), acc: +(hit / n).toFixed(4), brier: +(br / n).toFixed(5), ...(na ? { mae: +(ae / na).toFixed(2), maeGames: na } : {}) } : { games: 0 };
}
/* a 90% interval for a sum over days, by resampling the days: backtest.js's bootSum (seeded, 4,000 draws) */
function bootSum(perDay, n = 4000) {
  if (!perDay.length) return null;
  let seed = 12345; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const sums = [];
  for (let b = 0; b < n; b++) { let t = 0; for (let i = 0; i < perDay.length; i++) t += perDay[Math.floor(rnd() * perDay.length)]; sums.push(t); }
  sums.sort((a, b) => a - b);
  return [sums[Math.floor(n * 0.05)], sums[Math.floor(n * 0.95)]];
}

/* the comparison models on the finals, as their own replays publish them: Team Elo (elo.js, home edge learned game by
   game) and the player model with the previous lineup and with the lineup known, on a fold's parameters (backtest.js's
   modelNumbers, zipped back onto the games in the replay's own order) */
function comparisons(D, foldParams) {
  const finals = D.games.filter(g => g.status === 'final').sort(byDateId);
  const TE = E.replay(D.situP, finals, true);
  const team = {};
  for (const r of TE.recs) team[`${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`] = { p: r.pHome, spread: -r.d / D.situP.scale };
  const games = finals.filter(g => g.season >= PM.FIRST);
  const ctx = { games, boxes: D.boxes, teamStats: D.teamStats, coachOf: D.coachOf, raptor: D.raptor, situP: D.situP, teamDiff: {} };
  for (const r of TE.recs) ctx.teamDiff[`${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`] = r.d;
  const scored = games.filter(g => D.boxes[g.game_id] && D.boxes[g.game_id][g.home] && D.boxes[g.game_id][g.away] && g.season > PM.WARM_TO);
  const pm = {};
  for (const [Y, P] of Object.entries(foldParams)) for (const mode of ['naive', 'known']) {
    const R = PM.replay(P, ctx, mode, true);
    if (R.recs.length !== scored.length) throw new Error(`player model replay scored ${R.recs.length} games, expected ${scored.length}`);
    scored.forEach((g, i) => { if (g.season !== +Y) return; const r = R.recs[i];
      if (r.season !== g.season || r.mov !== +g.home_score - +g.away_score) throw new Error('player model replay order does not match the games at ' + g.game_id);
      (pm[g.game_id] = pm[g.game_id] || {})[mode] = { p: r.pHome, spread: r.spread }; });
  }
  return { team, pm };
}

function research(devOnly) {
  const t0 = Date.now();
  const D = load();
  const gameOf = Object.fromEntries(D.games.map(g => [g.game_id, g]));
  const fold = Y => { const f = D.research.folds.find(x => x.season === Y); if (!f) throw new Error('research.json has no fold for ' + Y); return f; };
  /* Team Elo's shadow replay does not depend on the player model's parameters: one for every fold */
  let eloCache = null;
  const rowsOf = {};
  for (const Y of FOLDS) { const B = build(D, fold(Y).params, D.situP, { elo: eloCache }); eloCache = B.TE; rowsOf[Y] = B.rows; }
  const C = comparisons(D, Object.fromEntries(FOLDS.map(Y => [Y, fold(Y).params])));
  L.log(`rows and comparisons built in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  /* a fold: train on the finals with a market of 2022-23 to the season before, score that season's finals with a market
     on the games every comparison model has a number on */
  const split = Y => {
    const rows = rowsOf[Y];
    const train = rows.filter(r => r.final && r.market.ok && r.season >= FIRST_ROW && r.season < Y);
    const test = rows.filter(r => r.final && r.market.ok && r.season === Y && C.team[r.id] && C.pm[r.id] && C.pm[r.id].naive && C.pm[r.id].known);
    const dropped = rows.filter(r => r.final && r.season === Y && !test.includes(r)).map(r => r.id);
    return { train, test, dropped };
  };
  const rate = (J, test, how, opts = {}) => metrics(test.map(r => { const rr = opts.open ? openRow(r) : r; const c = callOf(J, rr, how); return { p: c.p, y: r.y, mov: r.mov, spread: c.spread }; }));
  const openMk = r => market(gameOf[r.id], D.odds, true);
  const openRow = r => { const mk = openMk(r); return { ...r, num: { ...r.num, mk_p: mk.ok ? mk.p : null, mk_line: mk.ok ? mk.line : null, mk_total: mk.ok ? mk.total : null } }; };

  /* 1. the design, on 2024 and 2025 alone */
  const dev = {};
  for (const des of DESIGNS) {
    dev[des.id] = { about: des.about };
    for (const Y of DEV) {
      const { train, test } = split(Y);
      const J = fitJoker(train, des);
      const s = rate(J, test, 'scale'), t = rate(J, test, 'trees');
      dev[des.id][Y] = { train: train.length, games: s.games, logloss: s.logloss, acc: s.acc, brier: s.brier, maeScale: s.mae, maeTrees: t.mae };
    }
    const m = k => +(DEV.reduce((a, Y) => a + dev[des.id][Y][k], 0) / DEV.length).toFixed(5);
    dev[des.id].mean = { logloss: m('logloss'), acc: m('acc'), maeScale: m('maeScale'), maeTrees: m('maeTrees') };
    L.log(`design ${des.id}: 2024 ${dev[des.id][2024].logloss} / 2025 ${dev[des.id][2025].logloss} | mean ${dev[des.id].mean.logloss} | spread error scale ${dev[des.id].mean.maeScale} trees ${dev[des.id].mean.maeTrees}`);
  }
  const chosen = DESIGNS.slice().sort((a, b) => dev[a.id].mean.logloss - dev[b.id].mean.logloss || DESIGNS.indexOf(a) - DESIGNS.indexOf(b))[0];
  const spreadHow = dev[chosen.id].mean.maeTrees < dev[chosen.id].mean.maeScale ? 'trees' : 'scale';
  L.log(`chosen: ${chosen.id}, spread by ${spreadHow}`);
  if (devOnly) return { dev, chosen: { design: chosen.id, spread: spreadHow } };   // --dev: the choice alone, 2026 not scored, nothing written

  /* 2. the chosen design on every fold, 2026 scored here for the first time, beside the other models on the same games */
  const folds = {};
  for (const Y of FOLDS) {
    const { train, test, dropped } = split(Y);
    const J = fitJoker(train, chosen);
    const calls = test.map(r => ({ r, c: callOf(J, r, spreadHow) }));
    const rec = (f) => metrics(calls.map(({ r, c }) => ({ ...f(r, c), y: r.y, mov: r.mov })));
    const joker = rec((r, c) => ({ p: c.p, spread: c.spread }));
    const mkt = rec(r => ({ p: r.market.p, spread: r.market.line }));
    const team = rec(r => ({ p: C.team[r.id].p, spread: C.team[r.id].spread }));
    const naive = rec(r => ({ p: C.pm[r.id].naive.p, spread: C.pm[r.id].naive.spread }));
    const known = rec(r => ({ p: C.pm[r.id].known.p, spread: C.pm[r.id].known.spread }));
    /* how often it takes the market's favourite, and how it does when it does not */
    let agree = 0, sides = 0, against = 0, againstWon = 0; const perDay = {};
    for (const { r, c } of calls) {
      perDay[r.date] = (perDay[r.date] || 0) - Math.log(clip(r.y ? c.p : 1 - c.p)) + Math.log(clip(r.y ? r.market.p : 1 - r.market.p));
      if (r.market.p === 0.5) continue;
      sides++; const jh = c.p >= 0.5, mh = r.market.p > 0.5;
      if (jh === mh) agree++; else { against++; againstWon += jh === (r.y === 1); }
    }
    const b = bootSum(Object.values(perDay));
    /* the spread is its own trees when the walk-forward chose them, so it can name the other side from the pick */
    const crossed = calls.filter(({ c }) => c.spread !== 0 && (c.spread < 0) !== (c.p >= 0.5)).length;
    const opening = test.filter(r => openMk(r).ok);
    folds[Y] = {
      train: { seasons: `${FIRST_ROW}-${Y - 1}`, rows: train.length }, games: test.length,
      left: dropped.length ? `${dropped.length} finals of the season have no closing moneyline or no number from a comparison model (a side's box score is missing) and are not scored: ${dropped.join(' ')}` : undefined,
      joker, market: mkt, teamElo: team, playerNaive: naive, playerKnown: known, spreadAgainstPick: crossed,
      /* research.json's own fold, on its own games (every final with a box score), for reference */
      researchJson: { teamElo: fold(Y).teamElo, playerNaive: fold(Y).naive, playerKnown: fold(Y).known },
      vsMarket: { takesFavourite: +(agree / sides).toFixed(4), against: { n: against, won: againstWon }, loglossDiff: +((joker.logloss - mkt.logloss)).toFixed(5), loglossDiff90: b && [+(b[0] / test.length).toFixed(4), +(b[1] / test.length).toFixed(4)] },
      /* sensitivity, never chosen on: the same trees given the opening line in place of the closing one where odds_hist
         has it, which bounds what scoring on the job's pre-tip read (not the close) costs */
      openingLines: opening.length ? { games: opening.length, closing: rate(J, opening, spreadHow), opening: rate(J, opening, spreadHow, { open: true }),
        marketClosing: metrics(opening.map(r => ({ p: r.market.p, y: r.y, mov: r.mov }))),
        marketOpening: metrics(opening.map(r => ({ p: openMk(r).p, y: r.y, mov: r.mov }))) } : null,
      reference: { marketOnly: rate(fitJoker(train, MARKET_ONLY), test, spreadHow) },
    };
    if (!folds[Y].left) delete folds[Y].left;
    L.log(`fold ${Y}: ${test.length} games | joker ${joker.logloss} / ${(joker.acc * 100).toFixed(1)}% / ${joker.mae} | market ${mkt.logloss} / ${(mkt.acc * 100).toFixed(1)}% / ${mkt.mae} | team Elo ${team.logloss} / ${(team.acc * 100).toFixed(1)}% / ${team.mae} | player naive ${naive.logloss} / ${(naive.acc * 100).toFixed(1)}% / ${naive.mae} | known ${known.logloss} / ${(known.acc * 100).toFixed(1)}% / ${known.mae}`);
  }
  const out = {
    about: 'The Joker\'s walk-forward (node tools/joker.js research). Each fold Y fits the trees on the finals of 2022-23 to the season before Y that have a closing moneyline, and scores Y\'s finals cold. The player-model inputs of fold Y are replayed on research.json\'s fold-Y parameters (fitted on the seasons before Y), Team Elo on model.json\'s (fitted on 2007-08 to 2021-22). Every model is scored on the same games: the finals of Y with a closing moneyline and a number from every comparison model.',
    rule: 'Set before any fold was scored: the design with the lowest mean log loss on 2024 and 2025 (ties to the earlier in the list), then for it the spread with the lower mean spread error on the same folds. 2026 is scored once, on the chosen design only, and reported as it came out.',
    hyper: HYPER, running: { alpha: ALPHA, carry: CARRY, leagueStep: LGW, restCap: CAP_REST },
    designs: Object.fromEntries(DESIGNS.map(d => [d.id, { about: d.about, numeric: d.num.length, categorical: d.cat }])),
    dev, chosen: { design: chosen.id, spread: spreadHow },
    folds,
    lookedAt: [
      'The designs, the running-form constants (0.1 a game, 0.7 carry, the league mean at 0.005 a team-game) and the settings were set before any fold was scored; 2026 was scored once, after the choice.',
      'The player model\'s travel term, in every fold\'s parameters, was kept after the October 2026 refresh walked it forward on 2023-24 and 2024-25 and scored it on 2025-26 (README, the October 2026 refresh), so its inputs to every fold are not wholly untouched.',
      'Team Elo\'s parameters were fitted on 2007-08 to 2021-22; its learned home court was added after a look at 2023-24 to 2025-26 (README, the team model).',
      'The market inputs in training and in the folds are closing lines; live, the job calls on its last read before tip-off, which is earlier than the close. openingLines bounds the cost.',
    ],
  };
  const prev = fs.existsSync(RESEARCH) ? JSON.parse(fs.readFileSync(RESEARCH, 'utf8')) : null;
  writeIfChanged(RESEARCH, out, prev, p => JSON.stringify(p, null, 1));
  L.log(`research/joker.json ${prev && prev.generated === out.generated ? 'unchanged' : 'written'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  return out;
}

/* ---------- the live model ---------- */
/* fitted by hand (node tools/joker.js fit) on every final with a moneyline of 2022-23 to 2025-26, on the design the
   walk-forward chose, with players.json's and model.json's parameters as they stand; the job only scores with it */
function fitLive(D) {
  if (!fs.existsSync(RESEARCH)) throw new Refuse('research/joker.json is missing: run node tools/joker.js research before fitting');
  const R = JSON.parse(fs.readFileSync(RESEARCH, 'utf8'));
  const design = DESIGNS.find(d => d.id === R.chosen.design);
  if (!design) throw new Refuse(`research/joker.json chose a design this code does not have (${R.chosen.design})`);
  const { rows } = build(D, D.pmLive, D.situP);
  const train = rows.filter(r => r.final && r.market.ok && FIT_SEASONS.includes(r.season));
  const J = fitJoker(train, design);
  const ins = metrics(train.map(r => { const c = callOf(J, r, R.chosen.spread); return { p: c.p, y: r.y, mov: r.mov, spread: c.spread }; }));
  /* which inputs the win trees split on, and how often: for the README, never for a choice */
  const names = J.enc.num.concat(...J.enc.cat.map(c => J.enc.levels[c].map(v => `${c}=${v}`)));
  const used = {}; for (const t of J.win.trees) for (const nd of t) if (nd.f !== undefined) used[names[nd.f]] = (used[names[nd.f]] || 0) + 1;
  L.log(`fitted on ${train.length} finals of ${FIT_SEASONS[0]}-${FIT_SEASONS[FIT_SEASONS.length - 1]}: in sample log loss ${ins.logloss}, ${(ins.acc * 100).toFixed(1)}% straight up`);
  return { design: design.id, spread: R.chosen.spread, hyper: HYPER, fitSeasons: FIT_SEASONS, rows: J.rows, trainSha256: J.sha,
    inSample: { logloss: ins.logloss, acc: ins.acc, mae: ins.mae },
    splits: Object.fromEntries(Object.entries(used).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))),
    playerParams: D.pmLive, teamParams: D.situP,
    columns: { num: J.enc.num, cat: J.enc.cat, medians: J.enc.medians, levels: J.enc.levels },
    scale: J.scale, win: J.win, margin: J.margin };
}
class Refuse extends Error {}

/* the file one entry a line where it is long: each game's call, each logged row, each tree */
function pretty(v, p = [], ind = '') {
  const one = (p.length >= 2 && p[0] !== 'params' && p[0] !== 'inputs') || (p[0] === 'inputs' && (p.length >= 3 || p[1] === 'columns')) ||
    (p[0] === 'params' && (p.length >= 4 || (p.length === 3 && !['trees', 'levels'].includes(p[2])) || (p.length === 2 && !['win', 'margin', 'columns'].includes(p[1]))));
  if (v === null || typeof v !== 'object' || one) return JSON.stringify(v);
  const pad = ind + ' ';
  if (Array.isArray(v)) return v.length ? '[' + v.map((x, i) => '\n' + pad + pretty(x, p.concat(i), pad)).join(',') + '\n' + ind + ']' : '[]';
  const ks = Object.keys(v).filter(k => v[k] !== undefined);
  return ks.length ? '{' + ks.map(k => '\n' + pad + JSON.stringify(k) + ': ' + pretty(v[k], p.concat(k), pad)).join(',') + '\n' + ind + '}' : '{}';
}
/* an unchanged body keeps its stamp, so a quiet rerun writes nothing */
function writeIfChanged(file, out, prev, fmt) {
  const same = prev && JSON.stringify({ ...prev, generated: undefined }) === JSON.stringify(JSON.parse(JSON.stringify({ ...out, generated: undefined })));
  out.generated = same ? prev.generated : new Date().toISOString().slice(0, 16) + 'Z';
  const body = fmt(out) + '\n';
  fs.mkdirSync(path.dirname(file), { recursive: true });
  if (!fs.existsSync(file) || fs.readFileSync(file, 'utf8') !== body) { fs.writeFileSync(file, body); return true; }
  return false;
}
const r4 = v => v === null || v === undefined || !Number.isFinite(v) ? null : +v.toFixed(4);

/* one run: the calls of the season in play and the logged rows, from the frozen fit. Returns the model file's content;
   main writes it. opts.now (an ISO minute) holds the clock for the tests */
function score(D, params, prev, opts = {}) {
  const now = opts.now || new Date().toISOString().slice(0, 16) + 'Z';
  const seasons = D.games.map(g => g.season);
  if (!seasons.length) throw new Refuse('data/games.csv has no games');
  const S = Math.max(...seasons), last = Math.max(...params.fitSeasons);
  if (S - 1 > last) throw new Refuse(`the trees were fitted on seasons up to ${last}: refit them (node tools/joker.js fit) before they call ${S}`);
  const { rows } = build(D, params.playerParams, params.teamParams, { from: opts.from });
  const enc = { num: params.columns.num, cat: params.columns.cat, medians: params.columns.medians, levels: params.columns.levels };
  const J = { enc, win: params.win, margin: params.margin, scale: params.scale };
  const games = {}, upcoming = {};
  const mine = rows.filter(r => r.season === S);
  let noLine = 0;
  for (const r of mine) {
    if (!r.market.ok) { if (!r.final) noLine++; continue; }
    const c = callOf(J, r, params.spread);
    const call = { pHome: +c.p.toFixed(4), spread: +c.spread.toFixed(1) };
    games[r.id] = call;
    if (!r.final) upcoming[r.id] = call;
  }
  /* the input rows the job saw: rewritten while a game is still to tip, frozen once it has (its status has moved, or its
     tip time has passed), kept when its line goes before tip; a game gone from the table (postponed) is dropped */
  const inTable = new Set(D.games.map(g => g.game_id)), byId = Object.fromEntries(D.games.map(g => [g.game_id, g]));
  const was = (prev && prev.inputs && prev.inputs.rows) || {};
  const logged = {};
  const tipped = g => g.status !== 'scheduled' || (g.tip && g.tip <= now);
  for (const [id, row] of Object.entries(was)) if (inTable.has(id)) logged[id] = row;
  for (const r of mine) {
    if (!upcoming[r.id] || tipped(byId[r.id])) continue;
    const row = { num: NUM.map(c => r4(r.num[c])), cat: CAT.map(c => r.cat[c]), ml: r.market.ml, pHome: upcoming[r.id].pHome };
    const old = was[r.id];
    if (old && JSON.stringify({ ...old, at: undefined }) === JSON.stringify(row)) continue;
    logged[r.id] = { at: now, ...row };
  }
  const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  let walkForward = opts.walkForward || {};
  if (!opts.walkForward && fs.existsSync(RESEARCH)) {
    const R = JSON.parse(fs.readFileSync(RESEARCH, 'utf8'));
    for (const [Y, f] of Object.entries(R.folds || {})) walkForward[Y] = { games: f.joker.games, logloss: f.joker.logloss, acc: f.joker.acc, mae: f.joker.mae };
  }
  const out = { id: 'joker', name: NAME, version: VERSION, about: ABOUT, fitSeasons: params.fitSeasons, params, walkForward,
    games: sorted(games), upcoming: sorted(upcoming), inputs: { columns: { num: NUM, cat: CAT }, rows: sorted(logged) }, status: { ok: true } };
  return { out, season: S, noLine, rows: mine.length };
}

function main(argv = process.argv.slice(2)) {
  const t0 = Date.now();
  if (argv[0] === 'research') { research(argv[1] === '--dev'); return; }
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  try {
    const D = load();
    let params = prev && prev.params && prev.params.win ? prev.params : null;
    if (argv[0] === 'fit') params = fitLive(D);
    if (!params) throw new Refuse('models/joker.json has no fitted trees: run node tools/joker.js fit by hand');
    if (JSON.stringify(params.playerParams) !== JSON.stringify(D.pmLive)) L.log('players.json\'s parameters have changed since the trees were fitted: the Joker keeps the ones it was fitted with');
    const { out, season, noLine, rows } = score(D, params, prev);
    const wrote = writeIfChanged(OUT, out, prev, pretty);
    L.log(`joker: ${season} season, ${Object.keys(out.games).length} calls (${Object.keys(out.upcoming).length} to come), ${noLine} games to come with no moneyline yet and so no call, ${Object.keys(out.inputs.rows).length} input rows logged | models/joker.json ${wrote ? 'written' : 'unchanged'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    const why = e instanceof Refuse ? e.message : `${e.name}: ${e.message}`;
    console.log(`::warning title=joker did not run::${why}`);
    L.log(`joker: ${why}; its last good calls stay in models/joker.json`);
    const keep = prev || { id: 'joker', name: NAME, version: VERSION, about: ABOUT, fitSeasons: [], params: null, walkForward: {}, games: {}, upcoming: {}, inputs: { columns: { num: NUM, cat: CAT }, rows: {} } };
    writeIfChanged(OUT, { ...keep, status: { ok: false, why } }, prev, pretty);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { build, market, sideBox, fitJoker, callOf, encoder, encode, metrics, score, pretty, load, main, research,
  NUM, CAT, DESIGNS, HYPER, FIT_SEASONS, SHADOW, ALPHA, CARRY, LGW, OUT, RESEARCH, Refuse };
