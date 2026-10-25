/* The ELO Model: the NFL hub's third game model (elo/build.py there), in its form on NBA box scores.
 *
 *   node tools/elo_model.js            replay the box scores and write each game's call into models/elo.json: the season
 *                                          in play's finals as the model called them before tip-off (a backtest replay)
 *                                          and the games to come on today's roster and injury report
 *   node tools/elo_model.js fit        refit the weights on the finished seasons (by hand, between seasons; the season in
 *                                          play is never in a fit)
 *   node tools/elo_model.js research   the walk-forward (2024, 2025 and 2026, each fitted on the seasons before it and
 *                                          scored cold) and every design choice tried, into research/elo.json; then the fit
 *
 * THE RATINGS. Every player who has played since 2021-22 carries an Elo rating, moved after each final by how his game
 * compared with a typical game, against the opposing club's unit. The NFL's update, its constants but where DESIGN
 * (research/elo.json, chosen on 2024 and 2025 alone) moved one:
 *
 *   z = clip((score - mu) / sd, -3, 3)       mu, sd: a regular's game (12 minutes or more) of the season before (the
 *                                            first season's own games before the day)
 *   S = 1 / (1 + e^(-1.5 z))                 an average game is 0.5
 *   E = 1 / (1 + 10^((U - R) / 400))         U the opposing club's unit
 *   R += K w (S - E)                         K 56 for a player's first 8 rated games, 32 after; w = min(1, minutes / 24)
 *   U -= kUnit x the mean of w (S - E) over the players it faced, after the game   (kUnit 60; the NFL's 120)
 *
 * The score is the box score's: on-court plus-minus plus Hollinger's Game Score (DESIGN's choice among the two and their
 * sum; Game Score alone, the NFL's production scoring, was the start). Positions (`groups`): one rotation (DESIGN's), or
 * ESPN's three, G, F and C (PG and SG guards, SF and PF forwards; a row with none takes the player's last). A player who
 * plays under 0.35 of his usual minutes (the median of his last five, a starter's 19 or more) left early: that game is
 * not rated, but a second short game in a row is (a smaller role, not an injury). Every rating and unit is carried 0.75
 * of the way into a new season; a player new to the files starts at 1450 from the second season on (DESIGN's; the NFL's
 * quarterbacks' start), 1500 in the first. A row with no minutes is not rated; a game with no box score moves nobody.
 *
 * THE GAME MODEL. A club's strength is the weighted mean of the ratings of the players expected to play: its rotation
 * filled into 240 minutes by projected minutes (a player's mean over his last eight appearances; a new season starts
 * from his last five regular-season games, as the player model's do), the eight with the most taken, sorted by rating
 * and weighted 1, 0.9, 0.8, 0.7, 0.6, 0.45, 0.3, 0.2, an empty slot at 1450 (the NFL's strength() and its replacement
 * level; by position, G 1, 0.7, 0.45, F the same, C 1, 0.5). The home win chance is a logistic with no intercept on
 *
 *   x = [home, (S_h - S_a) / 100, b2b]       home 1, or 0 at a neutral site; b2b a back to back, home less away
 *
 * fitted by Newton's method with a ridge of 0.5 on every weight but home's (the NFL's logistic_fit), on every decided
 * final of the seasons before the one called. The margin is the same logit times a slope fitted by least squares on the
 * same games, so the pick and the spread never disagree; the spread is the margin written as the book writes a home
 * line, and a spread leg's chance is Phi((margin + home line) / sigma) for the home side, sigma the walk-forward residual
 * (params.sigma, measured on the 2026 fold).
 *
 * WHO PLAYS, before tip-off. The walk-forward's honest call (pretip) takes each club's previous box-scored game's
 * players, less anyone since gone to another club; a club's first game of a season takes its last game of the season
 * before. The season in play's finals (log) take the club's players less those the injury log had Out or suspended that
 * day, as Alpha's do; a game to come (live) the hub's own rule, players.js makeLiveLineup on today's roster and report.
 * Who actually played (known) is a hindsight row the research shows beside the honest one, never a call.
 *
 * Every input of a game's call is known before its tip-off: the ratings are what the finals before that day left, every
 * game of a day is read before any of them moves a rating, and the typical game is the season before's. The
 * live weights are never refitted by the job, and the season in play is never fitted or tuned on.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const FIRST = 2022;                     // box scores start in 2021-22
const FOLDS = [2024, 2025, 2026];       // the walk-forward's seasons
const DESIGN_ON = [2024, 2025];         // the design is chosen on these alone; 2026 is scored once, as it comes
const PROJ = 8;                         // projected minutes: the mean of a player's last eight appearances (players.js)
const KEEP = 15;                        // minutes kept per player
const DEBUT = 12;                       // a player with no minutes on record yet (players.js DEBUT_MIN)
const LOG_DAYS = 3;                     // an injury log older than this before a game is no report
const VERSION = 'elo 1 · 2026-10-25';
const GMAP = { G: 'G', PG: 'G', SG: 'G', F: 'F', SF: 'F', PF: 'F', C: 'C' };
/* the depth weights by position (the NFL's DEPTH, three slots a wing position and two at centre), or one rotation of
   eight (`groups` 'one': the pilot's alternative) */
const DEPTHS = { gfc: { G: [1, 0.7, 0.45], F: [1, 0.7, 0.45], C: [1, 0.5] }, one: { R: [1, 0.9, 0.8, 0.7, 0.6, 0.45, 0.3, 0.2] } };
/* the per-game score: Hollinger's Game Score (a box line, as the NFL scores its backs and receivers on production),
   on-court plus-minus, or the two summed */
const gameScore = r => r.pts + 0.4 * r.fgm - 0.7 * r.fga - 0.4 * (r.fta - r.ftm) + 0.7 * r.orb + 0.3 * r.drb + r.stl + 0.7 * r.ast + 0.7 * r.blk - 0.4 * r.pf - r.tov;
const SCORE = { gs: r => r.gs, pm: r => r.pm, mix: r => r.gs + r.pm };
/* the typical game before any has been seen (the first day of 2021-22 only: from its second day the season's own rows
   stand in), roughly what a regular's game is */
const NORM0 = { gs: [9, 7], pm: [0, 10], mix: [9, 13] };

/* The design: the NFL's constants, and the choices the research tries. DEFAULT is where the search starts (the NFL's
   own form wherever it has one: a box-line score, three positions, no rest column, fitted on the honest pre-game
   lineup from the first season); the chosen design is research/elo.json's and models/elo.json's */
const DEFAULT = { score: 'gs', groups: 'gfc', k: [56, 32], settled: 8, kUnit: 120, carry: 0.75, newR: 1500, repl: 1450, volume: 24, left: 0.35,
  b2b: 0, fitMode: 'pretip', fitFrom: 2022, ridge: 0.5 };
/* one knob at a time from DEFAULT, in this order, each kept by the hub's rule on 2024 and 2025 (better, below); each
   knob's grid holds its starting value too, so a later pass may move it back */
const GRID = {
  score: ['gs', 'pm', 'mix'],
  groups: ['gfc', 'one'],
  b2b: [0, 1],                            // back to backs, home less away, as a column beside home court
  fitMode: ['pretip', 'known'],           // the weights fitted on the honest pre-game rotation, or on who played
  fitFrom: [2022, 2023],                  // 2021-22 is rated from cold starts
  newR: [1500, 1450],                     // a new player's first rating (the NFL's quarterbacks start at 1450)
  k: [[56, 32], [28, 16], [84, 48]],      // a player's K, his first eight rated games and after
  kUnit: [120, 60, 240],
  carry: [0.75, 0.6, 0.9],
  volume: [24, 36],                       // the minutes at which a game counts in full
};
/* the knobs a replay depends on (the rest only change the fit), for the research's cache */
const STATE_KEYS = ['score', 'groups', 'k', 'settled', 'kUnit', 'carry', 'newR', 'repl', 'volume', 'left'];

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const median = a => { const s = [...a].sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const clip = (v, c) => Math.max(-c, Math.min(c, v));
const sig = z => 1 / (1 + Math.exp(-z));
const r4 = v => +v.toFixed(4), r6 = v => +v.toFixed(6);
const dayGap = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const groupOf = (pos, last) => GMAP[pos] || last || 'F';

function readCsv(f) {
  if (!fs.existsSync(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  const head = lines.shift().split(',');
  return lines.filter(Boolean).map(l => { const v = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = v[i] === undefined ? '' : v[i]; }); return o; });
}

/* Everything the model reads, from a repo's data folder: the games of the box-score era (preseason left out: never
   rated, called or graded; a game called off, whatever its status says, left out), each side's box rows sorted by
   player id (so a file's row order changes nothing), and the injury log by day */
function load(root = L.ROOT) {
  const data = path.join(root, 'data');
  const games = readCsv(path.join(data, 'games.csv'))
    .filter(g => +g.season >= FIRST && g.type !== 'PRE' && ['final', 'scheduled', 'live'].includes(g.status))
    .map(g => ({ id: g.game_id, season: +g.season, date: g.date, type: g.type, home: g.home, away: g.away, neutral: +g.neutral === 1,
      final: g.status === 'final', status: g.status, hs: g.home_score === '' ? null : +g.home_score, as: g.away_score === '' ? null : +g.away_score, tip: g.tip || '' }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const boxes = {};
  const num = v => v === '' || v === undefined ? 0 : +v;
  for (const f of fs.existsSync(data) ? fs.readdirSync(data).filter(f => /^box_\d{4}\.csv$/.test(f)).sort() : []) {
    for (const r of readCsv(path.join(data, f))) {
      const x = { pts: num(r.pts), fgm: num(r.fgm), fga: num(r.fga), fta: num(r.fta), ftm: num(r.ftm), orb: num(r.orb), drb: num(r.drb), stl: num(r.stl), ast: num(r.ast), blk: num(r.blk), pf: num(r.pf), tov: num(r.tov) };
      const row = { id: r.player_id, name: r.name, pos: r.pos, min: num(r.min), dnp: +r.dnp === 1 ? 1 : 0, gs: gameScore(x), pm: num(r.pm) };
      ((boxes[r.game_id] = boxes[r.game_id] || {})[r.team] = boxes[r.game_id][r.team] || []).push(row);
    }
  }
  for (const sides of Object.values(boxes)) for (const rows of Object.values(sides)) rows.sort((a, b) => a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const injLog = {};
  for (const r of readCsv(path.join(data, 'injuries_log.csv'))) ((injLog[r.date] = injLog[r.date] || {})[r.team] = injLog[r.date][r.team] || []).push({ id: r.player_id, status: r.status });
  return { games, boxes, injLog, logDates: Object.keys(injLog).sort() };
}

/* a list of [player, projected minutes] filled into a game's 240 minutes in rotation order, as makeLiveLineup fills
   tonight's: the longest first (level minutes by player id, never by a file's order), each given his minutes until they
   run out, a player left under 4 dropped */
function fill240(list) {
  const top = []; let left = 240;
  for (const [p, m] of [...list].sort((a, b) => b[1] - a[1] || (a[0].id < b[0].id ? -1 : a[0].id > b[0].id ? 1 : 0))) { if (left <= 0) break; const give = Math.min(m, left); if (give >= 4) top.push([p, give]); left -= give; }
  return top;
}
/* a side's strength at each position from its expected rotation: the most minutes picked, sorted by rating, weighted,
   empty slots at the replacement level */
function strength(list, D) {
  const one = D.groups === 'one', DEPTH = DEPTHS[D.groups], f = fill240(list), out = {};
  for (const gg of Object.keys(DEPTH)) {
    const w = DEPTH[gg], rs = [];
    for (const [p] of f) if ((one ? 'R' : p.group) === gg && rs.length < w.length) rs.push(p.R);
    rs.sort((a, b) => b - a);
    while (rs.length < w.length) rs.push(D.repl);
    let s = 0, sw = 0; for (let i = 0; i < w.length; i++) { s += rs[i] * w[i]; sw += w[i]; }
    out[gg] = s / sw;
  }
  return out;
}

/* ---------- the replay ---------- */
/* One pass over the games in date order. Each day: first every game of the day is read from the ratings as the day
   began (its inputs under each way of reading who plays), then the day's finals move the ratings, game by game. A row a
   game gets the morning it is played is its row once final (tools/test_elo_model.js holds that) */
function replay(D, ctx, opt = {}) {
  const one = D.groups === 'one', groups = Object.keys(DEPTHS[D.groups]), sc = SCORE[D.score], [kNew, kSet] = D.k;
  const players = {}, units = {}, clubs = {}, normAcc = {};
  const grp = p => one ? 'R' : p.group;
  const club = t => clubs[t] || (clubs[t] = { prev: null, dates: [], ahead: [], boxSeason: null });
  const newPlayer = (id, name, pos, team, season) => ({ id, name: name || '', group: groupOf(pos), R: season > FIRST ? D.newR : 1500, n: 0, recent: [], short: false,
    mins: [], reg: [], team: team || '', last: '', ts: null });
  /* players.js's getP: a player met for the first time (a box row, or a roster player with no game on record) */
  const getP = (r, season) => players[r.player_id] || (players[r.player_id] = newPlayer(r.player_id, r.name, r.pos, r.team, season));
  const projected = p => p.mins.length ? mean(p.mins.slice(-PROJ)) : DEBUT;
  const stat = a => { const m = a.s / a.n; return [m, Math.sqrt(Math.max(a.ss - a.n * m * m, 0) / (a.n - 1)) || 1]; };
  const normOf = (season, gg) => {
    const prev = normAcc[(season - 1) + '|' + gg], own = normAcc[season + '|' + gg];
    if (season > FIRST && prev && prev.n >= 30) return stat(prev);
    if (season === FIRST && own && own.n >= 30) return stat(own);
    return NORM0[D.score];
  };
  /* the injury log on the game's day, or its last day before (LOG_DAYS at most): Out or suspended is out, and every
     player it lists is on the club it lists him under; null where no log covers the day */
  const logMemo = {};
  const outOn = (date, team) => {
    const ds = ctx.logDates || []; let i = ds.length - 1; while (i >= 0 && ds[i] > date) i--;
    if (i < 0 || dayGap(ds[i], date) > LOG_DAYS) return null;
    const d = ds[i];
    if (!logMemo[d]) { logMemo[d] = {}; for (const [t, list] of Object.entries(ctx.injLog[d])) for (const x of list) logMemo[d][x.id] = t; }
    const out = new Set(); for (const x of (ctx.injLog[d][team] || [])) if (/^(out|suspended|suspension)/i.test(x.status || '')) out.add(x.id);
    return { out, club: logMemo[d] };
  };
  const lineups = (g, t, rows) => {
    const c = club(t), out = {};
    /* pretip: the club's previous box-scored game's players, less anyone since gone to another club */
    out.pretip = (c.prev || []).map(id => players[id]).filter(p => p.team === t).map(p => [p, projected(p)]);
    /* known: who played, at projected minutes (hindsight); a debutant read at the start rating, not kept */
    if (rows) out.known = rows.filter(r => !r.dnp && r.min > 0).map(r => { const p = players[r.id] || newPlayer(r.id, r.name, r.pos, t, g.season); return [p, projected(p)]; });
    /* log: the club's players less the injury log's Out: those who have played for it this season, or before its first
       game those who played for it last season, and not since for anyone else (a player the log lists under another club
       that day is that club's) */
    const day = outOn(g.date, t);
    if (day) {
      const ts = c.boxSeason === g.season ? g.season : g.season - 1;
      out.log = Object.values(players).filter(p => p.team === t && p.ts === ts && p.mins.length && !day.out.has(p.id) && !(day.club[p.id] && day.club[p.id] !== t)).map(p => [p, projected(p)]);
    }
    /* live: today's roster and report by the hub's rule */
    if (!g.final && opt.live) { const lv = opt.live(g, t, players, projected, getP); if (lv) out.live = lv; }
    return out;
  };
  const rows = [], byDate = [];
  for (const g of ctx.games) { if (!byDate.length || byDate[byDate.length - 1][0].date !== g.date) byDate.push([g]); else byDate[byDate.length - 1].push(g); }
  let season = null;
  for (const day of byDate) {
    /* a new season: every rating and unit carried toward 1500, every player's minutes started from his last five
       regular-season games */
    if (season !== null && day[0].season !== season) {
      for (const p of Object.values(players)) { p.R = 1500 + D.carry * (p.R - 1500); p.mins = (p.reg.length ? p.reg : p.mins).slice(-5); }
      for (const k of Object.keys(units)) units[k] = 1500 + D.carry * (units[k] - 1500);
      for (const c of Object.values(clubs)) { c.dates = []; c.ahead = []; }
    }
    season = day[0].season;
    /* 1. every game of the day read from the ratings as the day began */
    for (const g of day) {
      const box = ctx.boxes[g.id] || {};
      const gap = t => {
        const c = club(t); let last = c.dates.length ? c.dates[c.dates.length - 1] : '';
        if (!g.final) for (const a of c.ahead) if (a < g.date && a > last) last = a;   // a game two days out sees tomorrow's
        return last ? dayGap(last, g.date) : 99;
      };
      const H = lineups(g, g.home, box[g.home]), A = lineups(g, g.away, box[g.away]), x = {};
      for (const m of ['pretip', 'known', 'log', 'live']) if (H[m] && A[m]) {
        const sh = strength(H[m], D), sa = strength(A[m], D);
        x[m] = [g.neutral ? 0 : 1, ...groups.map(gg => (sh[gg] - sa[gg]) / 100)];
      }
      rows.push({ id: g.id, season: g.season, date: g.date, type: g.type, home: g.home, away: g.away, final: g.final, neutral: g.neutral,
        box: !!(box[g.home] && box[g.away]), mov: g.final ? g.hs - g.as : null, b2b: (gap(g.home) === 1 ? 1 : 0) - (gap(g.away) === 1 ? 1 : 0), x });
    }
    for (const g of day) if (!g.final) { club(g.home).ahead.push(g.date); club(g.away).ahead.push(g.date); }
    /* 2. then the day's finals move the ratings */
    const pend = [];
    for (const g of day) {
      if (!g.final) continue;
      for (const t of [g.home, g.away]) { const c = club(t); c.dates.push(g.date); if (c.dates.length > 4) c.dates.shift(); }
      const box = ctx.boxes[g.id];
      if (!box) continue;                                  // no box score: nothing to learn, nobody moves
      const both = !!(box[g.home] && box[g.away]), delta = {};
      for (const [t, o] of [[g.home, g.away], [g.away, g.home]]) {
        const rs = box[t]; if (!rs) continue;
        const played = [];
        for (const r of rs) {
          if (r.dnp || !(r.min > 0)) continue;             // did not play: not rated
          const p = getP({ player_id: r.id, name: r.name, pos: r.pos, team: t }, g.season);
          p.group = groupOf(r.pos, p.group); p.team = t; p.last = g.date; p.ts = g.season; if (r.name) p.name = r.name;
          played.push(p.id);
          const rv = p.recent, early = rv.length >= 3 && median(rv) >= 0.8 * D.volume && r.min < D.left * median(rv) && !p.short;
          rv.push(r.min); if (rv.length > 5) rv.shift();
          p.short = early;
          p.mins.push(r.min); if (p.mins.length > KEEP) p.mins.shift();
          if (g.type !== 'POST') { p.reg.push(r.min); if (p.reg.length > KEEP) p.reg.shift(); }
          if (!both) continue;
          const gg = grp(p), v = sc(r), w = Math.min(1, r.min / D.volume);
          if (w >= 0.5) pend.push([g.season + '|' + gg, v]);
          if (early) continue;                             // left early: this game is not rated
          const [mu, sd] = normOf(g.season, gg);
          const z = clip((v - mu) / sd, 3), S = 1 / (1 + Math.exp(-1.5 * z));
          const uk = o + '|' + gg, U = units[uk] === undefined ? 1500 : units[uk];
          const E = 1 / (1 + Math.pow(10, (U - p.R) / 400));
          p.R += (p.n < D.settled ? kNew : kSet) * w * (S - E); p.n++;
          (delta[uk] = delta[uk] || []).push(w * (S - E));
        }
        const c = club(t); c.prev = played; c.boxSeason = g.season;
      }
      for (const [k, ds] of Object.entries(delta)) units[k] = (units[k] === undefined ? 1500 : units[k]) - D.kUnit * mean(ds);
    }
    /* the first season's typical game, from its own rows, as the day ended */
    for (const [k, v] of pend) { const a = normAcc[k] || (normAcc[k] = { n: 0, s: 0, ss: 0 }); a.n++; a.s += v; a.ss += v * v; }
  }
  return { rows, players, units, groups };
}

/* ---------- the fit ---------- */
const featNames = D => ['home', ...Object.keys(DEPTHS[D.groups]), ...(D.b2b ? ['b2b'] : [])];
const vec = (r, D, mode) => D.b2b ? [...r.x[mode], r.b2b] : r.x[mode];
/* a linear system by Gauss-Jordan with partial pivoting */
function solve(A, b) {
  const n = b.length, M = A.map((r, i) => [...r, b[i]]);
  for (let c = 0; c < n; c++) {
    let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
    [M[c], M[p]] = [M[p], M[c]];
    for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
  }
  return M.map((r, i) => r[n] / r[i]);
}
/* the NFL's logistic_fit: Newton's method, at most 60 steps, stopping when the largest step is under 1e-8; a ridge on
   every weight but the first (home) and no intercept, so two equal clubs at a neutral site are an even chance */
function logistic(X, y, ridge) {
  const d = X[0].length; let w = Array(d).fill(0);
  for (let it = 0; it < 60; it++) {
    const g = Array(d).fill(0), H = Array.from({ length: d }, () => Array(d).fill(0));
    for (let n = 0; n < X.length; n++) {
      const x = X[n]; let z = 0; for (let i = 0; i < d; i++) z += x[i] * w[i];
      const p = sig(z), q = p * (1 - p);
      for (let i = 0; i < d; i++) { g[i] += x[i] * (p - y[n]); for (let j = 0; j < d; j++) H[i][j] += x[i] * x[j] * q; }
    }
    for (let i = 1; i < d; i++) { g[i] += ridge * w[i]; H[i][i] += ridge; }
    const st = solve(H, g); w = w.map((v, i) => v - st[i]);
    if (Math.max(...st.map(Math.abs)) < 1e-8) break;
  }
  return w;
}
const fitRows = (rows, D, from, to) => rows.filter(r => r.final && r.mov !== 0 && r.season >= from && r.season <= to && r.x[D.fitMode]);
/* the weights on the decided finals of seasons from..to, read as the design's fitMode says; the margin's slope on the
   logit by least squares on the same games */
function fit(rows, D, from, to) {
  const tr = fitRows(rows, D, from, to);
  const X = tr.map(r => vec(r, D, D.fitMode)), w = logistic(X, tr.map(r => r.mov > 0 ? 1 : 0), D.ridge);
  let zz = 0, zm = 0;
  for (let i = 0; i < tr.length; i++) { const z = X[i].reduce((s, v, j) => s + v * w[j], 0); zz += z * z; zm += z * tr[i].mov; }
  const F = featNames(D);
  return { feats: F, coef: Object.fromEntries(F.map((f, i) => [f, w[i]])), slope: zz ? zm / zz : 0, games: tr.length, seasons: `${from}-${to}` };
}
const logit = (r, M, D, mode) => vec(r, D, mode).reduce((s, v, i) => s + v * M.coef[M.feats[i]], 0);
function score(list, pOf, mOf) {
  let ll = 0, right = 0, ae = 0, se = 0, n = 0, na = 0;
  for (const r of list) {
    const p = Math.min(Math.max(pOf(r), 1e-6), 1 - 1e-6), y = r.mov > 0 ? 1 : 0;
    ll -= y * Math.log(p) + (1 - y) * Math.log(1 - p); n++;
    if ((p >= 0.5) === (y === 1)) right++;
    if (mOf) { const m = mOf(r); if (m !== null && m !== undefined) { ae += Math.abs(r.mov - m); se += (r.mov - m) ** 2; na++; } }
  }
  const o = { games: n, logloss: n ? r6(ll / n) : null, acc: n ? r4(right / n) : null };
  if (mOf) { o.mae = na ? +(ae / na).toFixed(3) : null; o.sigma = na ? +Math.sqrt(se / na).toFixed(3) : null; }
  return o;
}
const scoreElo = (list, M, D, mode) => score(list, r => sig(logit(r, M, D, mode)), r => M.slope * logit(r, M, D, mode));

/* ---------- the walk-forward ---------- */
/* a season is scored on every decided regular-season and playoff final it has, each called on its honest pre-game
   rotation (a game with no box score of its own is still called: its inputs are the games before it) */
const testRows = (rows, S) => rows.filter(r => r.final && r.mov !== 0 && r.season === S);
/* the hub's rule for a change (README, "The October 2026 refresh"): lower log loss in both design seasons, by 0.0005
   between them, and the spread error no worse */
const better = (a, b) => DESIGN_ON.every(S => a.per[S].logloss < b.per[S].logloss) && DESIGN_ON.reduce((s, S) => s + b.per[S].logloss - a.per[S].logloss, 0) >= 0.0005
  && mean(DESIGN_ON.map(S => a.per[S].mae)) <= mean(DESIGN_ON.map(S => b.per[S].mae)) + 1e-9;
function research(ctx, ref) {
  const cache = new Map();
  const rowsFor = D => { const key = JSON.stringify(STATE_KEYS.map(k => D[k])); if (!cache.has(key)) cache.set(key, replay(D, ctx).rows.filter(r => r.final)); return cache.get(key); };
  /* the design seasons alone: fitted on the seasons before each, scored on the call made before tip-off (pretip) */
  const design = D => { const rows = rowsFor(D), per = {}; for (const S of DESIGN_ON) per[S] = scoreElo(testRows(rows, S), fit(rows, D, D.fitFrom, S - 1), D, 'pretip'); return { per }; };
  const show = r => Object.fromEntries(DESIGN_ON.map(S => [S, { logloss: r.per[S].logloss, acc: r.per[S].acc, mae: r.per[S].mae }]));
  let D = { ...DEFAULT }, best = design(D);
  const trials = [{ change: 'start (the NFL form)', design: { ...D }, ...show(best), kept: true }];
  L.log(`design start: ${JSON.stringify(show(best))}`);
  for (let pass = 1, moved = true; moved && pass <= 3; pass++) {
    moved = false;
    for (const [k, vals] of Object.entries(GRID)) for (const v of vals) {
      if (JSON.stringify(v) === JSON.stringify(D[k])) continue;
      const q = { ...D, [k]: v }, res = design(q), ok = better(res, best);
      trials.push({ pass, change: `${k} ${JSON.stringify(D[k])} -> ${JSON.stringify(v)}`, ...show(res), kept: ok });
      L.log(`pass ${pass} ${k}=${JSON.stringify(v)}: ${DESIGN_ON.map(S => res.per[S].logloss).join(' / ')} ${ok ? 'KEPT' : ''}`);
      if (ok) { D = q; best = res; moved = true; }
    }
  }
  /* the folds, with the chosen design: 2024 and 2025 were read to choose it; 2026 is scored here for the first time */
  const rows = rowsFor(D), folds = [];
  for (const S of FOLDS) {
    const M = fit(rows, D, D.fitFrom, S - 1), te = testRows(rows, S), ids = new Set(te.map(r => r.id));
    const fold = { season: S, fitted: M.seasons, fitGames: M.games, coef: Object.fromEntries(Object.entries(M.coef).map(([f, v]) => [f, r6(v)])), slope: r6(M.slope) };
    fold.elo = scoreElo(te, M, D, 'pretip');
    /* the same model told who played (hindsight, the player model's "known" rows): never a call */
    fold.eloKnown = scoreElo(te.filter(r => r.x.known), M, D, 'known');
    /* on the player model's own games, the finals with both box scores, for a like-for-like with research.json */
    fold.eloBoxGames = scoreElo(te.filter(r => r.box), M, D, 'pretip'); delete fold.eloBoxGames.sigma;
    const tel = ref.teamElo.filter(r => ids.has(r.id));
    fold.teamElo = score(tel, r => r.pHome, r => r.margin); delete fold.teamElo.sigma;
    const pm = (ref.research.folds || []).find(f => f.season === S);
    fold.playerModel = pm ? { naive: pick4(pm.naive), known: pick4(pm.known), note: 'research.json, on its own games (finals with a box score)' } : null;
    const withOdds = te.filter(r => ref.odds[r.id]), telById = Object.fromEntries(tel.map(r => [r.id, r]));
    fold.market = {
      games: withOdds.length,
      market: score(withOdds, r => ref.odds[r.id].pHome, r => ref.odds[r.id].margin),
      elo: scoreElo(withOdds, M, D, 'pretip'),
      teamElo: score(withOdds.filter(r => telById[r.id]).map(r => telById[r.id]), r => r.pHome, r => r.margin),
    };
    delete fold.market.market.sigma; delete fold.market.teamElo.sigma;
    /* how often its pick is Team Elo's and the market's favourite: a third model is worth having only if it is not a
       copy of one already on the record */
    const pickOf = p => p >= 0.5 ? 1 : 0, eloP = r => sig(logit(r, M, D, 'pretip'));
    fold.agree = { teamElo: r4(mean(te.filter(r => telById[r.id]).map(r => +(pickOf(eloP(r)) === pickOf(telById[r.id].pHome))))),
      market: r4(mean(withOdds.map(r => +(pickOf(eloP(r)) === pickOf(ref.odds[r.id].pHome))))) };
    folds.push(fold);
    L.log(`fold ${S} (${fold.elo.games} games): ELO ${fold.elo.logloss} / ${(fold.elo.acc * 100).toFixed(1)}% / ${fold.elo.mae} | known ${fold.eloKnown.logloss} | team Elo ${fold.teamElo.logloss} | market ${fold.market.market.logloss} on ${fold.market.games} (ELO ${fold.market.elo.logloss})`);
  }
  return { design: D, trials, folds, notes: NOTES };
}
const pick4 = m => m ? { games: m.games, logloss: m.logloss, acc: m.acc, mae: m.mae } : null;
const NOTES = [
  'Every call is made before tip-off: the ratings are what the finals before the game\'s day left, the typical game they are scored against is the season before\'s, and tonight\'s rotation is the club\'s previous box-scored game\'s (elo, the honest number). eloKnown is the same model told who played, at projected minutes (hindsight, as the player model\'s "known" rows): never a call, only the bound a perfect injury report would reach.',
  'The design was chosen on 2024 and 2025 alone (trials, one knob at a time from the NFL\'s form, each kept only by the hub\'s rule: lower log loss in both seasons, by 0.0005 between them, and the spread error no worse); 2026 was scored once, with that design. Two runs printed 2026 numbers before the search: the planning pilot (not in the repo) on plus-minus and Game Score, and a timing run of this code on the starting design under each of the three scores. No choice reads them: the search took every decision on 2024 and 2025 by the rule, and the score it kept is the one those 2026 numbers also favoured.',
  'Each fold is fitted on the seasons before it (fitted) and scored on every decided regular-season and playoff final of its season. 2026-27, the season in play, is never fitted, tuned or scored.',
  'teamElo is the hub\'s team model with model.json\'s parameters (fitted on 2008-2022, the home edge learned as the finals come), on the same games. playerModel is research.json\'s walk-forward, on its own games (finals with a box score, a few fewer). market is odds_hist.csv\'s consensus closing moneyline with the margin taken out, and its closing spread, on the games that have one (fetch_odds_hist.js check()), with the ELO Model and Team Elo on the same games beside it.',
  'sigma is the root mean square of the margin\'s miss on the fold: the spread leg\'s chance is Phi((margin + home line) / sigma) for the home side.',
];

/* the comparisons' own numbers, each game by id: the team model's pre-game call (elo.js with model.json's parameters,
   as the hub runs it) and the market's no-vig closing moneyline with its closing spread (odds_hist.csv) */
function references(root = L.ROOT) {
  const E = require('./elo');
  const { check } = require('./fetch_odds_hist');
  const model = JSON.parse(fs.readFileSync(path.join(root, 'model.json'), 'utf8'));
  const all = readCsv(path.join(root, 'data', 'games.csv')).filter(g => (g.status === 'final' && g.type !== 'PRE') || g.status === 'scheduled' || g.status === 'live');
  all.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const TE = E.replay(model.params, all, true);
  const teamElo = TE.recs.map(r => ({ id: `${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`, season: r.season, pHome: r.pHome, margin: r.d / model.params.scale, mov: r.mov }));
  const imp = ml => ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
  const odds = {};
  for (const r of readCsv(path.join(root, 'data', 'odds_hist.csv'))) {
    const ok = check(r);
    if (!ok.ml) continue;
    const h = imp(+r.home_ml), a = imp(+r.away_ml);
    odds[r.game_id] = { pHome: h / (h + a), margin: ok.line ? -r.home_line : null };
  }
  const rj = path.join(root, 'research.json');
  return { teamElo, odds, research: fs.existsSync(rj) ? JSON.parse(fs.readFileSync(rj, 'utf8')) : {} };
}

/* ---------- the live run ---------- */
/* tonight's rotation for a game to come: players.js makeLiveLineup, the hub's one availability rule (today's roster
   less the injury report's absences by their return dates, filled to 240 by projected minutes), run on the ELO Model's
   own players (`make` stands in for it in the tests, the same function loaded on another folder's files) */
function liveProvider(make) {
  if (!make) { try { make = require('./players').makeLiveLineup({ coachOf: () => '' }); } catch (e) { return null; } }
  const memo = {};
  return (g, t, players, projected, getP) => {
    if (!memo[g.id]) memo[g.id] = make({ season: g.season, date: g.date, home: g.home, away: g.away }, players, p => projected(p), getP);
    return memo[g.id][t === g.home ? 'home' : 'away'].list;
  };
}
/* the call each game gets: a game to come on tonight's rotation by the hub's rule; a final of the season in play on the
   injury log of its day; any other on its previous game's rotation */
const modeOf = r => !r.final && r.x.live ? 'live' : r.x.log ? 'log' : 'pretip';
const callOf = (r, M, D) => { const z = logit(r, M, D, modeOf(r)); return { pHome: r4(sig(z)), spread: +(-M.slope * z).toFixed(1) }; };

/* the season in play: the latest with a game still to play, else the latest with a final; the last finished season is
   the latest before it while a game is to play */
function seasons(ctx) {
  const toPlay = ctx.games.filter(g => !g.final).map(g => g.season), finals = ctx.games.filter(g => g.final).map(g => g.season);
  const inPlay = toPlay.length ? Math.max(...toPlay) : finals.length ? Math.max(...finals) : null;
  const finished = finals.filter(s => s < inPlay || !toPlay.length);
  return { inPlay, lastFinished: finished.length ? Math.max(...finished) : null };
}
/* the live fit: the design's first fit season to the last finished one (or `to`) */
function fitLive(ctx, D, res, to) {
  const last = to || seasons(ctx).lastFinished;
  const rows = replay(D, ctx).rows;
  const M = fit(rows, D, D.fitFrom, last);
  const f2026 = res && res.folds ? res.folds.find(f => f.season === Math.max(...res.folds.map(x => x.season))) : null;
  const self = scoreElo(fitRows(rows, D, D.fitFrom, last), M, D, D.fitMode);
  return { design: D, feats: M.feats, coef: Object.fromEntries(Object.entries(M.coef).map(([f, v]) => [f, r6(v)])), slope: r6(M.slope),
    /* the spread leg's sigma: the walk-forward's residual on its last fold, else the fit's own */
    sigma: f2026 ? f2026.elo.sigma : self.sigma, sigmaFrom: f2026 ? `walk-forward ${f2026.season}, before tip-off` : `the fit ${M.seasons}`,
    fitSeasons: M.seasons, fit: { games: self.games, logloss: self.logloss, acc: self.acc, mae: self.mae } };
}
const ABOUT = D => 'The NFL hub\'s ELO Model on NBA box scores: every player an Elo rating moved after each final by his ' +
  ({ gs: 'Game Score', pm: 'on-court plus-minus', mix: 'Game Score plus on-court plus-minus' })[D.score] + (D.groups === 'one' ? ' against a regular\'s typical game' : ' against the position\'s typical game') + ' and the opposing club\'s unit, ' +
  (D.groups === 'one' ? 'each club\'s expected rotation of eight weighted by rating' : 'each club\'s expected guards, forwards and centres weighted by rating') +
  ', and the home win chance a logistic on the home-minus-away strengths and home court' + (D.b2b ? ' and back to backs' : '') +
  ', with no intercept. The spread is the same logit times a fitted slope. Who plays: the previous game\'s rotation for history, the injury log for the season in play\'s finals, the hub\'s injury rule for games to come. Fitted on finished seasons only, never refitted by the job.';

/* the model file: every final and game to come of the season in play as the model calls it before tip-off, the games
   to come apart, with the fitted numbers and the walk-forward */
function build(ctx, P, walkForward, live) {
  const D = P.design, R = replay(D, ctx, { live });
  const { inPlay } = seasons(ctx);
  const M = { feats: P.feats, coef: P.coef, slope: P.slope };
  const games = {}, upcoming = {};
  for (const r of R.rows) {
    const c = callOf(r, M, D);
    if (!r.final) upcoming[r.id] = c;
    if (r.season === inPlay) games[r.id] = c;
  }
  return { id: 'elo', name: 'ELO Model', version: VERSION, about: ABOUT(D), fitSeasons: P.fitSeasons, params: P, walkForward, games, upcoming, status: { ok: true } };
}
/* written only when its content moved: an unchanged file keeps its stamp, so a quiet day commits nothing */
function write(file, obj, prev) {
  const same = prev && JSON.stringify({ ...prev, generated: undefined }) === JSON.stringify({ ...obj, generated: undefined });
  obj.generated = same ? prev.generated : new Date().toISOString().slice(0, 16) + 'Z';
  const body = JSON.stringify(obj, null, 1) + '\n';
  const before = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
  if (body === before) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, body);
  return true;
}
const readJson = f => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { return null; } };

function main() {
  const t0 = Date.now();
  const OUT = path.join(L.ROOT, 'models', 'elo.json'), RES = path.join(L.ROOT, 'research', 'elo.json');
  const prev = readJson(OUT), cmd = process.argv[2] || '';
  try {
    const ctx = load();
    if (!ctx.games.some(g => g.final)) throw new Error('no finals in data/games.csv');
    let res = readJson(RES);
    if (cmd === 'research') {
      const R = research(ctx, references());
      res = { name: 'ELO Model: walk-forward and design', version: VERSION, generatedBy: 'node tools/elo_model.js research', ...R };
      L.log(`research/elo.json ${write(RES, res, readJson(RES)) ? 'written' : 'unchanged'}`);
    }
    let P = prev && prev.params && prev.params.coef && cmd !== 'fit' && cmd !== 'research' ? prev.params : null;
    if (!P) {
      const D = res && res.design ? res.design : { ...DEFAULT };
      P = fitLive(ctx, D, res);
      L.log(`fitted on ${P.fitSeasons}: ${JSON.stringify(P.coef)} slope ${P.slope} sigma ${P.sigma}`);
    }
    const { lastFinished } = seasons(ctx);
    if (lastFinished && +P.fitSeasons.split('-')[1] < lastFinished) L.log(`note: the weights are fitted on ${P.fitSeasons}; ${lastFinished} has finished since (node tools/elo_model.js fit, by hand)`);
    const wf = res && res.folds ? Object.fromEntries(res.folds.map(f => [f.season, { games: f.elo.games, logloss: f.elo.logloss, acc: f.elo.acc, mae: f.elo.mae }])) : (prev && prev.walkForward) || {};
    const model = build(ctx, P, wf, liveProvider());
    const wrote = write(OUT, model, prev);
    L.log(`elo: ${Object.keys(model.games).length} calls of the season in play, ${Object.keys(model.upcoming).length} to come | models/elo.json ${wrote ? 'written' : 'unchanged'} | ${((Date.now() - t0) / 1000).toFixed(1)}s`);
  } catch (e) {
    /* a failed run keeps the last good calls and says why, for the record to show */
    L.log('elo model failed: ' + (e && e.stack || e));
    if (prev) write(OUT, { ...prev, status: { ok: false, why: String(e && e.message || e) } }, prev);
    process.exitCode = 1;
  }
}

if (require.main === module) main();
module.exports = { load, replay, strength, fill240, groupOf, gameScore, logistic, fit, score, scoreElo, logit, build, write, callOf, modeOf, seasons, fitLive,
  research, references, liveProvider, better, DEFAULT, GRID, DEPTHS, FOLDS, DESIGN_ON, STATE_KEYS, FIRST, VERSION };
