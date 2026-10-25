/* The Joker: gradient-boosted trees on every number the job has before tip-off.
 *
 *   node tools/joker.js            score the season in play with the frozen trees in models/joker.json, write it
 *   node tools/joker.js research   the walk-forward (folds 2024, 2025, 2026) and the design choice -> research/joker.json
 *   node tools/joker.js fit        refit the live trees on 2022-23 to 2025-26, by hand only, then score as above;
 *                                  refused while a season is under way whose games its inputs include (--force overrides)
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
 * final of an earlier day and nothing of its own day, and each club's coach as coaches.csv had him the day before (the
 * job dates a change by the day it read it, which on a late run is after that day's tip-off), so a game's row built the
 * morning it is played is the row it has once it is final, which test_joker.js holds. The two models' numbers are read
 * the same way: their replays are run on the finals with a copy of each game, marked a game to come, set in front of its
 * day's finals (shadow), so the model prices it exactly as it would have that morning, a team's first game of a season
 * included. The market is games.csv's, which fetch.js freezes at tip-off (the last read before it), and the schedule
 * terms read the schedule, whatever has been played. Nothing reads the injury report or the rosters (ESPN's coach list
 * stands in only for a club coaches.csv has no row for that season, which the job writes before the season's first game),
 * so the call on a game under way or played today is the call it had that morning: the replay the Pick'em Record takes
 * for a game played before the Joker's first published call is pre-tip by construction.
 *
 * A game with no moneyline posted gets no call: an imputed market would read as a typical favourite. Its spread is the
 * home margin its chance implies (the scale), so it never names the other side from the pick. The live trees are fitted
 * on 2022-23 to 2025-26 (the seasons with closing lines; 2021-22, the first with box scores, only warms the running
 * numbers up) and never refitted by the job; each call's input row of the season in play is logged in models/joker.json
 * (inputs) while its game is still to tip, then frozen, so a later refit can train on what the job saw.
 *
 * A refusal (Refuse: a season the trees were not fitted for, no games) writes status {ok: false, why}, keeps the last good
 * calls less any game no longer to come, and exits 0, so the job publishes it and the Pick'em Record says why; anything
 * else that goes wrong writes the same and exits 1, and the job puts the last commit's file back.
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
const VERSION = '2';
const NAME = 'The Joker';
/* the design the walk-forward chose on 2024 and 2025 (research/joker.json's rule, 25 October 2026), kept whatever a
   later re-scoring of those folds says: research reports whether the rule would still pick it, and never re-chooses */
const CHOSEN = 'people';

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
   the four factors, and without the teams. The rule (research) picks the one with the lowest mean log loss on 2024 and
   2025; it picked people, which CHOSEN keeps */
const DESIGNS = [
  { id: 'base', about: 'the market, Team Elo, the player model on the previous lineup, the setting, running efficiency and pace, the teams', num: CORE, cat: ['home', 'away'] },
  { id: 'people', about: 'base, plus both coaches and each side\'s top player by minutes in its previous game, as categories', num: CORE, cat: CAT },
  { id: 'factors', about: 'base, plus the four factors (effective field goal rate, turnovers, offensive rebounds, free-throw rate) scored and allowed', num: NUM, cat: ['home', 'away'] },
  { id: 'noteams', about: 'base without the teams as categories', num: CORE, cat: [] },
];
/* a reference, never a candidate: the same trees on the market's three numbers alone, to show what the rest adds */
const MARKET_ONLY = { id: 'market only', about: 'the market\'s chance, line and total alone', num: ['mk_p', 'mk_line', 'mk_total'], cat: [] };

/* THE INPUTS IN WORDS: every column of a row in one group, so the published about lists exactly what the fitted design
   reads (aboutOf takes the groups its columns touch); a column in no group, or in two, stops the module loading */
const GROUPS = [
  ['the market\'s moneyline chance, line and total', ['mk_p', 'mk_line', 'mk_total']],
  ['Team Elo', ['elo_p']],
  ['the player model on the previous game\'s lineup', ['pm_p', 'pm_spread', 'pm_total', 'pm_pace']],
  ['the play-offs and the day of the season', ['post', 'day']],
  ['rest, back to backs, three in four nights, travel, altitude and a neutral site', ['neutral', 'alt_home', 'rest_h', 'rest_a', 'rest_d', 'b2b_h', 'b2b_a', 'three4_h', 'three4_a', 'tz_h', 'tz_a']],
  ['same division or conference', ['div', 'conf']],
  ['the play-off series', ['series_game', 'series_diff']],
  ['each side\'s running efficiency and pace', ['ortg_h', 'drtg_h', 'pace_h', 'n_h', 'ortg_a', 'drtg_a', 'pace_a', 'n_a', 'net']],
  ['each side\'s four factors scored and allowed', FACTORS],
  ['the teams', ['home', 'away']],
  ['both coaches', ['coach_h', 'coach_a']],
  ['each side\'s top player by minutes in its previous game', ['star_h', 'star_a']],
];
{
  const seen = GROUPS.flatMap(g => g[1]), all = NUM.concat(CAT);
  const bad = all.filter(c => seen.filter(x => x === c).length !== 1).concat(seen.filter(c => !all.includes(c)));
  if (bad.length) throw new Error('joker: input columns not in exactly one group of GROUPS: ' + [...new Set(bad)].join(' '));
}
const seasonName = S => `${S - 1}-${String(S).slice(2)}`;
const listed = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a.join('');
/* the file's about, from the design the trees were fitted on, their settings and their seasons */
function aboutOf(designId, hyper = HYPER, fitSeasons = FIT_SEASONS) {
  const d = DESIGNS.find(x => x.id === designId);
  const cols = d ? d.num.concat(d.cat) : [];
  const inputs = GROUPS.filter(g => g[1].some(c => cols.includes(c))).map(g => g[0]);
  const fitted = fitSeasons.length ? `Fitted on ${seasonName(Math.min(...fitSeasons))} to ${seasonName(Math.max(...fitSeasons))} and never refitted in the job` : 'Not fitted yet';
  return `Gradient-boosted trees (binomial deviance, depth ${hyper.depth}, ${hyper.rounds} rounds, learning rate ${hyper.lr}, at least ${hyper.minLeaf} games a leaf) on ` +
    (inputs.length ? `every number the job has before tip-off: ${listed(inputs)}. ` : 'the numbers the job has before tip-off. ') +
    'Every call, a final\'s too, is worked out on what was known before its tip: the lines as the job last read them before tip-off, ' +
    'and every final of an earlier day and each club\'s coach as the game\'s Eastern day began; it reads no injury report. ' +
    `The spread is the home margin the chance implies. ${fitted}; a game with no moneyline posted gets no call.`;
}

/* ---------- data ---------- */
function readOdds() {
  const f = path.join(ROOT, 'data', 'odds_hist.csv');
  if (!fs.existsSync(f)) { L.log('joker: data/odds_hist.csv is missing, so no season before 2026-27 has a market: the fit and the walk-forward have nothing to train on'); return {}; }
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
  const team = json('model.json'), pm = json('players.json');
  return { games, boxes: PM.loadBoxes(), teamStats: PM.loadTeamBoxes(), coachOf: PM.loadCoaches(), raptor: PM.loadRaptor(), odds: readOdds(),
    situP: team.params, situFit: team.fitSeasons, pmLive: pm.params, pmFit: pm.fitSeasons, research: json('research.json') };
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

/* a club's coach as its game's Eastern day began: coachOf (players.js's reader of coaches.csv, a dated change honoured)
   on the day before. The job dates a change by the day it read it, so a change dated on a game's own day may have been
   read after its tip; it is the club's from the next day, in the rows and in the player model's replay alike */
const coachAt = D => (season, team, date) => D.coachOf(season, team, L.addDays(date, -1));

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
  const ctx = { games: pm, boxes: D.boxes, teamStats: D.teamStats, coachOf: coachAt(D), raptor: D.raptor, situP, teamDiff, liveLineup };
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
  const state = {}, lm = {}, series = {}, coach = coachAt(D);
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
    const cat = { home: g.home, away: g.away, coach_h: coach(g.season, g.home, g.date), coach_a: coach(g.season, g.away, g.date),
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
/* the training rows as the trees read them, and their hash, which fitJoker records and test_joker.js reads again on
   today's data to see whether a back-filled box score has moved them */
function trainingSet(train, design) {
  const enc = encoder(train, design);
  const X = train.map(r => encode(enc, r)), y = train.map(r => r.y), mov = train.map(r => r.mov);
  return { enc, X, y, mov, sha: crypto.createHash('sha256').update(JSON.stringify([X, y, mov])).digest('hex') };
}
/* the Joker on a set of rows: the win trees and the spread its chance implies, the home margin at s points a unit of
   log-odds (s fitted by least squares on the training rows), which agrees with the pick by construction. With
   opts.margin, a second set of trees fitted to the home margin by squared error, which the walk-forward scores as a
   comparison and nothing publishes: it named the other side from the pick in 147, 108 and 56 games of the folds */
function fitJoker(train, design, opts = {}) {
  const { enc, X, y, mov, sha } = trainingSet(train, design);
  const win = G.fit(X, y, HYPER);
  const margin = opts.margin ? G.fit(X, mov, { ...HYPER, loss: 'squared' }) : null;
  let sz = 0, zz = 0; X.forEach((x, i) => { const z = logit(G.predict(win, x)); sz += mov[i] * z; zz += z * z; });
  return { design: design.id, enc, win, margin, scale: zz ? sz / zz : 0, rows: train.length, sha };
}
/* a call: the chance the home side wins and its spread (the book's way round: minus the home margin), and with margin
   trees fitted, their spread beside it */
function callOf(J, r) {
  const x = encode(J.enc, r), p = G.predict(J.win, x);
  const c = { p, spread: -J.scale * logit(p) };
  if (J.margin) c.spreadTrees = -G.predict(J.margin, x);
  return c;
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
  /* a fold: train on the finals with a market of 2022-23 to the season before; score that season's box-scored finals
     (every decided final with both box scores, which every comparison model has a number on: the set each model of the
     Pick'em Record is scored on), and the priced ones among them (a closing moneyline), beside the market. On 2024 and
     2025 the two are the same games; 2026 has four play-off finals with no moneyline anywhere, which the trees call with
     the market missing, imputed as any missing input is (the live job calls no such game) */
  const split = Y => {
    const rows = rowsOf[Y];
    const train = rows.filter(r => r.final && r.market.ok && r.season >= FIRST_ROW && r.season < Y);
    const boxed = rows.filter(r => r.final && r.season === Y && C.team[r.id] && C.pm[r.id] && C.pm[r.id].naive && C.pm[r.id].known);
    const inBox = new Set(boxed.map(r => r.id));
    const test = boxed.filter(r => r.market.ok);
    const noBox = rows.filter(r => r.final && r.season === Y && !inBox.has(r.id)).map(r => r.id);
    const noMarket = boxed.filter(r => !r.market.ok).map(r => r.id);
    return { train, boxed, test, noBox, noMarket };
  };
  const rate = (J, test, opts = {}) => metrics(test.map(r => { const c = callOf(J, opts.open ? openRow(r) : r); return { p: c.p, y: r.y, mov: r.mov, spread: opts.trees ? c.spreadTrees : c.spread }; }));
  const openMk = r => market(gameOf[r.id], D.odds, true);
  const openRow = r => { const mk = openMk(r); return { ...r, num: { ...r.num, mk_p: mk.ok ? mk.p : null, mk_line: mk.ok ? mk.line : null, mk_total: mk.ok ? mk.total : null } }; };

  /* 1. the design, on 2024 and 2025 alone */
  const dev = {};
  for (const des of DESIGNS) {
    dev[des.id] = { about: des.about };
    for (const Y of DEV) {
      const { train, test } = split(Y);
      const J = fitJoker(train, des, { margin: true });
      const s = rate(J, test), t = rate(J, test, { trees: true });
      dev[des.id][Y] = { train: train.length, games: s.games, logloss: s.logloss, acc: s.acc, brier: s.brier, maeScale: s.mae, maeTrees: t.mae };
    }
    const m = k => +(DEV.reduce((a, Y) => a + dev[des.id][Y][k], 0) / DEV.length).toFixed(5);
    dev[des.id].mean = { logloss: m('logloss'), acc: m('acc'), maeScale: m('maeScale'), maeTrees: m('maeTrees') };
    L.log(`design ${des.id}: 2024 ${dev[des.id][2024].logloss} / 2025 ${dev[des.id][2025].logloss} | mean ${dev[des.id].mean.logloss} | spread error scale ${dev[des.id].mean.maeScale} trees ${dev[des.id].mean.maeTrees}`);
  }
  /* the rule, as it was run on 25 October 2026; its pick then is CHOSEN, which a re-scoring never changes */
  const rulePick = DESIGNS.slice().sort((a, b) => dev[a.id].mean.logloss - dev[b.id].mean.logloss || DESIGNS.indexOf(a) - DESIGNS.indexOf(b))[0];
  const chosen = DESIGNS.find(d => d.id === CHOSEN);
  L.log(`chosen: ${chosen.id} (the rule on these numbers picks ${rulePick.id}${rulePick.id === chosen.id ? '' : ': the design stays as chosen, and the file says so'}), spread by the chance (scale)`);
  if (devOnly) return { dev, chosen: { design: chosen.id, spread: 'scale' }, rulePick: rulePick.id };   // --dev: the choice alone, 2026 not scored, nothing written

  /* 2. the chosen design on every fold, beside the other models on the same games */
  const folds = {};
  for (const Y of FOLDS) {
    const { train, boxed, test, noBox, noMarket } = split(Y);
    const J = fitJoker(train, chosen, { margin: true });
    const callAll = new Map(boxed.map(r => [r.id, callOf(J, r)]));
    const on = (set, f) => metrics(set.map(r => ({ ...f(r, callAll.get(r.id)), y: r.y, mov: r.mov })));
    const four = set => ({ joker: on(set, (r, c) => ({ p: c.p, spread: c.spread })), teamElo: on(set, r => ({ p: C.team[r.id].p, spread: C.team[r.id].spread })),
      playerNaive: on(set, r => ({ p: C.pm[r.id].naive.p, spread: C.pm[r.id].naive.spread })), playerKnown: on(set, r => ({ p: C.pm[r.id].known.p, spread: C.pm[r.id].known.spread })) });
    const box = four(boxed), pr = four(test);
    const mkt = on(test, r => ({ p: r.market.p, spread: r.market.line }));
    const trees = on(test, (r, c) => ({ p: c.p, spread: c.spreadTrees }));
    /* how often it takes the market's favourite, and how it does when it does not */
    let agree = 0, sides = 0, against = 0, againstWon = 0; const perDay = {};
    for (const r of test) {
      const c = callAll.get(r.id);
      perDay[r.date] = (perDay[r.date] || 0) - Math.log(clip(r.y ? c.p : 1 - c.p)) + Math.log(clip(r.y ? r.market.p : 1 - r.market.p));
      if (r.market.p === 0.5) continue;
      sides++; const jh = c.p >= 0.5, mh = r.market.p > 0.5;
      if (jh === mh) agree++; else { against++; againstWon += jh === (r.y === 1); }
    }
    const b = bootSum(Object.values(perDay));
    /* a spread naming the other side from the pick: the published one (the chance's, to the tenth it is published at)
       never, the margin trees' (unrounded) often */
    const crossed = (k, tenth) => test.filter(r => { const c = callAll.get(r.id), v = tenth ? +c[k].toFixed(1) : c[k]; return v !== 0 && (v < 0) !== (c.p >= 0.5); }).length;
    const opening = test.filter(r => openMk(r).ok);
    folds[Y] = {
      train: { seasons: `${FIRST_ROW}-${Y - 1}`, rows: train.length },
      /* the walk-forward models/joker.json publishes: every decided final with both box scores */
      boxScored: { games: boxed.length, ...box,
        noMarket: noMarket.length ? { games: noMarket.length, how: 'no closing moneyline anywhere: called by the trees with the market missing, imputed as any missing input is; the live job calls no such game', ids: noMarket } : undefined },
      /* the finals among them with a closing moneyline, so the market can stand beside them */
      priced: { games: test.length, ...pr, market: mkt,
        marginTrees: { mae: trees.mae, maeGames: trees.maeGames, about: 'the spread of a second set of trees fitted to the home margin, scored as a comparison and never published' },
        spreadAgainstPick: { published: crossed('spread', true), marginTrees: crossed('spreadTrees') },
        vsMarket: { takesFavourite: +(agree / sides).toFixed(4), against: { n: against, won: againstWon }, loglossDiff: +((pr.joker.logloss - mkt.logloss)).toFixed(5), loglossDiff90: b && [+(b[0] / test.length).toFixed(4), +(b[1] / test.length).toFixed(4)] },
        /* sensitivity, never chosen on: the same trees given the opening line in place of the closing one where odds_hist
           has it, which bounds what scoring on the job's pre-tip read (not the close) costs */
        openingLines: opening.length ? { games: opening.length, closing: rate(J, opening), opening: rate(J, opening, { open: true }),
          marketClosing: metrics(opening.map(r => ({ p: r.market.p, y: r.y, mov: r.mov }))),
          marketOpening: metrics(opening.map(r => ({ p: openMk(r).p, y: r.y, mov: r.mov }))) } : null,
        reference: { marketOnly: rate(fitJoker(train, MARKET_ONLY), test) } },
      notScored: noBox.length ? `${noBox.length} finals of the season have no box score for a side, so no comparison model has a number on them, and are not scored: ${noBox.join(' ')}` : undefined,
      /* research.json's own fold, on its own games (every final with a box score), for reference */
      researchJson: { teamElo: fold(Y).teamElo, playerNaive: fold(Y).naive, playerKnown: fold(Y).known },
    };
    const line = (name, m) => `${name} ${m.logloss} / ${(m.acc * 100).toFixed(1)}% / ${m.mae}`;
    L.log(`fold ${Y}: ${boxed.length} box-scored | ${line('joker', box.joker)} | ${line('team Elo', box.teamElo)} | ${line('player naive', box.playerNaive)} | ${line('known', box.playerKnown)}`);
    L.log(`fold ${Y}: ${test.length} priced | ${line('joker', pr.joker)} | ${line('market', mkt)} | margin trees' spread ${trees.mae} | spread against the pick: published ${folds[Y].priced.spreadAgainstPick.published}, margin trees ${folds[Y].priced.spreadAgainstPick.marginTrees}`);
  }
  const out = {
    about: 'The Joker\'s walk-forward (node tools/joker.js research). Each fold Y fits the trees on the finals of 2022-23 to the season before Y that have a closing moneyline, and scores Y\'s finals cold. The player-model inputs of fold Y are replayed on research.json\'s fold-Y parameters (fitted on the seasons before Y), Team Elo on model.json\'s (fitted on 2007-08 to 2021-22). Every model is scored on the same games: boxScored, every decided final of Y with both box scores (the set each model on the Pick\'em Record is scored on, and the walk-forward models/joker.json publishes), and priced, those of them with a closing moneyline, beside the market.',
    rule: 'Set before any fold was scored: the design with the lowest mean log loss on 2024 and 2025 (ties to the earlier in the list), then for it the spread with the lower mean spread error on the same folds. The rule picked people and the margin trees on 25 October 2026. The design is kept as chosen whatever a re-scoring of those folds says (rulePick says what the rule picks on the numbers in this file). The spread was then set to the chance\'s (scale) by the review\'s decision of 25 October 2026, so that it never names the other side from the pick; the margin trees\' error is kept beside it.',
    hyper: HYPER, running: { alpha: ALPHA, carry: CARRY, leagueStep: LGW, restCap: CAP_REST },
    designs: Object.fromEntries(DESIGNS.map(d => [d.id, { about: d.about, numeric: d.num.length, categorical: d.cat }])),
    dev, chosen: { design: chosen.id, spread: 'scale' }, rulePick: rulePick.id,
    folds,
    lookedAt: [
      'The designs, the running-form constants (0.1 a game, 0.7 carry, the league mean at 0.005 a team-game) and the settings were set before any fold was scored, and the design was chosen on 2024 and 2025 alone.',
      '2026 was first scored after the choice, on the chosen design only, and has been scored more than once since: several times on 25 October 2026 while the code and the data were finished (the job\'s data moved between runs), and again in the review\'s fixes of the same day (each club\'s coach read as the game\'s day began, the spread set to the chance\'s, every box-scored final counted). Each time it was reported as it came out, and nothing was chosen or tuned on it; the spread was switched knowing every fold\'s numbers, for agreement with the pick and not for its error, which is a little worse.',
      'The 2026 numbers of the market, Team Elo and the player model (README, research.json, research/backtest.json) were published before the Joker\'s designs were set, so how its inputs fared on 2025-26 was known when they were picked.',
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
/* the season under way, if any: the latest with a regular-season or play-off game on or before ten days from today (as
   calls.js and publish.js pick the season in play), while a game of it is still to be played or before 1 July of its
   year (the Finals end in June; between play-off rounds every listed game can be final) */
function seasonUnderWay(games, today) {
  const to = L.addDays(today, 10);
  const ours = games.filter(g => g.type !== 'PRE' && g.date <= to);
  if (!ours.length) return null;
  const S = Math.max(...ours.map(g => +g.season));
  const left = games.some(g => +g.season === S && g.type !== 'PRE' && g.status !== 'final');
  return left || today < `${S}-07-01` ? S : null;
}
/* the seasons a fit reads: the rows it trains on, and the seasons players.json's and model.json's parameters were
   fitted on ("2023-2025") */
const lastOf = v => { const m = /(\d{4})\s*$/.exec(String(v || '')); return m ? +m[1] : null; };
/* fitted by hand (node tools/joker.js fit) on every final with a moneyline of 2022-23 to 2025-26, on the design the
   walk-forward chose, with players.json's and model.json's parameters as they stand; the job only scores with it. While
   a season is under way a fit whose inputs include it is refused (force overrides): its trees would then call games
   whose results they, or the parameters they stand on, were fitted on, as a players.js refit taking in the season in
   play would do */
function fitLive(D, force = false, today = L.etDate(new Date())) {
  if (!fs.existsSync(RESEARCH)) throw new Refuse('research/joker.json is missing: run node tools/joker.js research before fitting');
  const R = JSON.parse(fs.readFileSync(RESEARCH, 'utf8'));
  const design = DESIGNS.find(d => d.id === CHOSEN);
  if (!R.chosen || R.chosen.design !== CHOSEN) throw new Refuse(`research/joker.json's design (${R.chosen && R.chosen.design}) is not the one chosen (${CHOSEN}): run node tools/joker.js research before fitting`);
  const S = seasonUnderWay(D.games, today);
  if (S !== null) {
    const reads = [[`the trees' own seasons (${seasonName(Math.min(...FIT_SEASONS))} to ${seasonName(Math.max(...FIT_SEASONS))})`, Math.max(...FIT_SEASONS)], [`players.json's parameters (fitted on ${D.pmFit || 'seasons it does not name'})`, lastOf(D.pmFit)],
      [`model.json's parameters (fitted on ${D.situFit || 'seasons it does not name'})`, lastOf(D.situFit)]];
    const hit = reads.filter(([, last]) => last === null || last >= S).map(([what]) => what);
    if (hit.length && !force) throw new Refuse(`the ${seasonName(S)} season is under way and this fit would read it through ${listed(hit)}: the trees would call games they were fitted on. Fit before the season or once it is over, or pass --force to fit anyway`);
    if (hit.length) L.log(`fit forced while the ${seasonName(S)} season is under way: it reads that season through ${listed(hit)}`);
  }
  const { rows } = build(D, D.pmLive, D.situP);
  const train = rows.filter(r => r.final && r.market.ok && FIT_SEASONS.includes(r.season));
  const J = fitJoker(train, design);
  const ins = metrics(train.map(r => { const c = callOf(J, r); return { p: c.p, y: r.y, mov: r.mov, spread: c.spread }; }));
  /* which inputs the win trees split on, and how often: for the README, never for a choice */
  const names = J.enc.num.concat(...J.enc.cat.map(c => J.enc.levels[c].map(v => `${c}=${v}`)));
  const used = {}; for (const t of J.win.trees) for (const nd of t) if (nd.f !== undefined) used[names[nd.f]] = (used[names[nd.f]] || 0) + 1;
  L.log(`fitted on ${train.length} finals of ${FIT_SEASONS[0]}-${FIT_SEASONS[FIT_SEASONS.length - 1]}: in sample log loss ${ins.logloss}, ${(ins.acc * 100).toFixed(1)}% straight up`);
  return { design: design.id, spread: 'scale', hyper: HYPER, fitSeasons: FIT_SEASONS, rows: J.rows, trainSha256: J.sha,
    inSample: { logloss: ins.logloss, acc: ins.acc, mae: ins.mae },
    splits: Object.fromEntries(Object.entries(used).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))),
    playerParams: D.pmLive, teamParams: D.situP,
    columns: { num: J.enc.num, cat: J.enc.cat, medians: J.enc.medians, levels: J.enc.levels },
    scale: J.scale, win: J.win };
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
   main writes it. opts.now (an ISO minute) holds the clock for the tests, and opts.rows hands it rows build has made
   on the same data and the fit's own parameters (test_joker.js, which builds them once) */
const tippedAt = (g, now) => g.status !== 'scheduled' || (!!g.tip && g.tip <= now);
function score(D, params, prev, opts = {}) {
  const now = opts.now || new Date().toISOString().slice(0, 16) + 'Z';
  const seasons = D.games.map(g => g.season);
  if (!seasons.length) throw new Refuse('data/games.csv has no games');
  const S = Math.max(...seasons), last = Math.max(...params.fitSeasons);
  if (S - 1 > last) throw new Refuse(`the trees were fitted on seasons up to ${last}: refit them (node tools/joker.js fit) before they call ${S}`);
  const rows = opts.rows || build(D, params.playerParams, params.teamParams, { from: opts.from }).rows;
  const enc = { num: params.columns.num, cat: params.columns.cat, medians: params.columns.medians, levels: params.columns.levels };
  const J = { enc, win: params.win, scale: params.scale };
  const games = {}, upcoming = {};
  const mine = rows.filter(r => r.season === S);
  let noLine = 0;
  for (const r of mine) {
    if (!r.market.ok) { if (!r.final) noLine++; continue; }
    const c = callOf(J, r);
    const call = { pHome: +c.p.toFixed(4), spread: +c.spread.toFixed(1) || 0 };   // || 0: a pick'em's -0 is 0, as the file reads back
    games[r.id] = call;
    if (!r.final) upcoming[r.id] = call;
  }
  /* the input rows the job saw, the season in play's alone: rewritten while a game is still to tip, frozen once it has
     (its status has moved, or its tip time has passed), kept when its line goes before tip; a game gone from the table
     (postponed) is dropped, and so is every row of an earlier season */
  const byId = Object.fromEntries(D.games.map(g => [g.game_id, g]));
  const was = (prev && prev.inputs && prev.inputs.rows) || {};
  const logged = {};
  for (const [id, row] of Object.entries(was)) if (byId[id] && byId[id].season === S) logged[id] = row;
  for (const r of mine) {
    if (!upcoming[r.id] || tippedAt(byId[r.id], now)) continue;
    const row = { num: NUM.map(c => r4(r.num[c])), cat: CAT.map(c => r.cat[c]), ml: r.market.ml, pHome: upcoming[r.id].pHome };
    const old = was[r.id];
    if (old && JSON.stringify({ ...old, at: undefined }) === JSON.stringify(row)) continue;
    logged[r.id] = { at: now, ...row };
  }
  const sorted = o => Object.fromEntries(Object.keys(o).sort().map(k => [k, o[k]]));
  const out = { id: 'joker', name: NAME, version: VERSION, about: aboutOf(params.design, params.hyper, params.fitSeasons), fitSeasons: params.fitSeasons, params,
    walkForward: opts.walkForward || walkForwardOf(), games: sorted(games), upcoming: sorted(upcoming), inputs: { columns: { num: NUM, cat: CAT }, rows: sorted(logged) }, status: { ok: true } };
  return { out, season: S, noLine, rows: mine.length };
}
/* the walk-forward the file publishes, from research/joker.json: every box-scored final (the set each model on the
   Pick'em Record is scored on), with the priced ones beside it */
function walkForwardOf() {
  if (!fs.existsSync(RESEARCH)) return {};
  const R = JSON.parse(fs.readFileSync(RESEARCH, 'utf8')), wf = {};
  const four = m => ({ games: m.games, logloss: m.logloss, acc: m.acc, mae: m.mae });
  for (const [Y, f] of Object.entries(R.folds || {})) {
    if (!f.boxScored) continue;
    wf[Y] = { ...four(f.boxScored.joker), ...(f.boxScored.noMarket ? { noMarket: f.boxScored.noMarket.games } : {}), priced: four(f.priced.joker) };
  }
  return wf;
}

/* a refusal's file: the last good one, saying why, less any game no longer to come (from tip-off a game's call is the
   ledger's, and a file must never list a tipped game as one to come); with the schedule unreadable, none */
function refusal(prev, why, now, games) {
  const keep = prev || { id: 'joker', name: NAME, version: VERSION, about: aboutOf(null, HYPER, []), fitSeasons: [], params: null, walkForward: {}, games: {}, upcoming: {}, inputs: { columns: { num: NUM, cat: CAT }, rows: {} } };
  let upcoming = {};
  try {
    const byId = Object.fromEntries((games || L.readGames()).map(g => [g.game_id, g]));
    upcoming = Object.fromEntries(Object.entries(keep.upcoming || {}).filter(([id]) => byId[id] && !tippedAt(byId[id], now)));
  } catch (e) { L.log(`joker: the schedule does not read (${e.message}), so no game is kept as one to come`); }
  return { ...keep, upcoming, status: { ok: false, why } };
}

function main(argv = process.argv.slice(2)) {
  const t0 = Date.now();
  if (argv[0] === 'research') { research(argv[1] === '--dev'); return; }
  const now = new Date().toISOString().slice(0, 16) + 'Z';
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  let D = null, params = prev && prev.params && prev.params.win ? prev.params : null;
  if (argv[0] === 'fit') {
    /* by hand only: a refused fit leaves the file as it was */
    try { D = load(); params = fitLive(D, argv.includes('--force')); }
    catch (e) { L.log(`joker fit: ${e instanceof Refuse ? e.message : e.stack}; models/joker.json is left as it was`); process.exitCode = 1; return; }
  }
  try {
    D = D || load();
    if (!params) throw new Refuse('models/joker.json has no fitted trees: run node tools/joker.js fit by hand');
    if (JSON.stringify(params.playerParams) !== JSON.stringify(D.pmLive)) L.log('players.json\'s parameters have changed since the trees were fitted: the Joker keeps the ones it was fitted with');
    const { out, season, noLine } = score(D, params, prev, { now });
    const wrote = writeIfChanged(OUT, out, prev, pretty);
    L.log(`joker: ${season} season, ${Object.keys(out.games).length} calls (${Object.keys(out.upcoming).length} to come), ${noLine} games to come with no moneyline yet and so no call, ${Object.keys(out.inputs.rows).length} input rows logged | models/joker.json ${wrote ? 'written' : 'unchanged'} in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    /* a refusal is the model saying why: the file says so, and the job publishes it. Anything else is a fault: the file
       says so too, and the run fails, so the job puts the last commit's file back */
    const refused = e instanceof Refuse, why = refused ? e.message : `${e.name}: ${e.message}`;
    console.log(`::warning title=joker did not run::${why}`);
    L.log(`joker: ${refused ? why : e.stack}; its last good calls stay in models/joker.json, less any game no longer to come`);
    writeIfChanged(OUT, refusal(prev, why, now), prev, pretty);
    if (!refused) process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { build, market, sideBox, fitJoker, trainingSet, callOf, encoder, encode, metrics, score, refusal, pretty, load, main, research,
  fitLive, seasonUnderWay, aboutOf, coachAt, tippedAt, NUM, CAT, GROUPS, DESIGNS, CHOSEN, HYPER, FIT_SEASONS, SHADOW, ALPHA, CARRY, LGW, OUT, RESEARCH, Refuse };
