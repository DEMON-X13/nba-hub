/* The Alpha Model: the NFL hub's main game model, refitted on NBA data.
 *
 *   node tools/alpha.js            replay the games with the fitted numbers in models/alpha.json and write each game's
 *                                      call there: every game of the season in play as the walk-forward calls a game
 *                                      before tip-off, on each club's previous game's rotation (`games`, the backtest
 *                                      replay), and the games to come on today's roster and injury report (`upcoming`)
 *   node tools/alpha.js fit        refit the margin and the chance on the seasons before the one in play (by hand,
 *                                      between seasons; the season in play is never in a fit)
 *   node tools/alpha.js research   the walk-forward (2024, 2025 and 2026, each fitted on the seasons before it and
 *                                      scored cold) and every design choice tried, into research/alpha.json; then the fit
 *
 * The NFL's Alpha is a least-squares margin over a rating state (a margin Elo and exponentially weighted efficiency for
 * and against), a rest gap, home field and a starting-quarterback term, turned into a win chance by one logistic slope.
 * Here the same recipe, its constants fitted on NBA games. The margin, in home points, is
 *
 *   m = c_home home + c_elo eloDiff + c_rest rest + c_b2b b2b + c_net net + c_rot rot
 *
 *   home     1 on the home club's court, 0 at a neutral site
 *   eloDiff  the two clubs' Elo before the game, updated after every final since 2004-05 by the NFL app's rule (a
 *            log-of-margin multiplier damped by the gap; FiveThirtyEight's NBA multiplier was tried), carried 70% into a
 *            new season
 *   rest     the two clubs' days since their last game, each capped at 4, the difference clipped at 3
 *   b2b      a back to back, home less away
 *   net      each club's net rating: an exponentially weighted average (3% a game) of its points per 100 possessions
 *            less its opponents', from the team box scores (2021-22 on), carried 60% into a new season
 *   rot      the rotation drop, the quarterback term's analogue: each club's usual rotation less tonight's, home less
 *            away (ROTATION below)
 *
 * and nothing hand-sized: every coefficient is least squares on the home margin over the fit seasons, and the home win
 * chance is 1 / (1 + e^(-k m)) with k fitted by log loss on the same games. The spread is the margin, written as the book
 * writes a home line (-m). Alpha makes no total. Fitted on 2022-2026 (models/alpha.json):
 *
 *   m = 1.965 home + 0.02357 eloDiff + 0.264 rest - 1.748 b2b + 0.514 net - 89.5 rot,  k = 0.1308
 *
 * so 100 Elo is 2.4 points, a back to back 1.7 and a point of net rating half a point; a star worth +0.10 a minute
 * over the man who takes his 34 minutes is a drop of 0.10 x 34/240 = 0.014, 1.3 points.
 *
 * Every input of a game's call is known before its tip-off: the state is what the finals before that day left, the
 * day's games are all read before any of them updates it, and tonight's rotation is what was known before the game
 * (ROTATION). The live numbers are never refitted by the job, and the season in play is never fitted or tuned on.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const MEAN = 1500;
const FIRST_BOX = 2022;                 // box scores start in 2021-22
const FOLDS = [2024, 2025, 2026];       // the walk-forward's seasons
const DESIGN_ON = [2024, 2025];         // the design is chosen on these alone; 2026 is scored once, as it comes
const ALT = new Set(['DEN', 'UTA']);
const TOP = 8;                          // a side's top eight by minutes; the rest of the floor sets the replacement level
const PROJ = 8;                         // projected minutes: the mean of a player's last eight appearances (players.js)
const KEEP = 15;                        // minutes kept per player
const DEBUT = [12, 26];                 // a player with no minutes on record yet: bench, starter (players.js)
const VERSION = 'alpha 1 · 2026-10-25';

/* The design: the state machine's constants and the fit's choices. The values here are where the search starts; the
   chosen design is research/alpha.json's and models/alpha.json's (README "The Alpha Model"). K, the home Elo and the carry
   are the team model's own, fitted by the hub on 2008-2022, so nothing in them has seen a season the walk-forward
   scores */
const DEFAULT = {
  elo: '538', K: 20, hfa: 60, carry: 0.7,
  alpha: 0.05, carryNet: 0.6,
  rest: 'gap', restCap: 4, restClip: 3, alt: 0,
  value: 'gs', n0: 500, decay: 0.6, window: 10, usual: 'all',
  rot: 1, fitMode: 'known', fitFrom: 2023,
};
/* the choices the research tries, one knob at a time from DEFAULT, each kept by the hub's rule on 2024 and 2025 (better,
   below). The window's grid was widened twice, to 40 and then to 82, when the search stopped at its top (2024 and 2025
   alone were read) */
const GRID = {
  alpha: [0.03, 0.05, 0.08, 0.12],
  carryNet: [0.4, 0.6, 0.8],
  elo: ['538', 'nfl'],
  K: [15, 20, 25],
  rest: ['gap', 'b2b', 'both'],
  alt: [0, 1],
  value: ['gs', 'pm'],
  n0: [250, 500, 1000],
  decay: [0.4, 0.6, 0.8],
  window: [5, 10, 20, 40, 60, 82],
  usual: ['all', 'current'],
  fitMode: ['known', 'pretip'],
  fitFrom: [2022, 2023],
};
/* the knobs a replay depends on; the rest only change which columns are fitted and on which rows */
const STATE_KEYS = ['elo', 'K', 'hfa', 'carry', 'alpha', 'carryNet', 'restCap', 'restClip', 'value', 'n0', 'decay', 'window', 'usual'];

const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;
const dayGap = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const prob = d => 1 / (1 + Math.pow(10, -d / 400));
const sig = x => 1 / (1 + Math.exp(-x));
const clip = (x, c) => Math.max(-c, Math.min(c, x));
const r4 = x => +x.toFixed(4), r6 = x => +x.toFixed(6);

/* ---------- data ---------- */
function readCsv(f) {
  if (!fs.existsSync(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n');
  const head = lines.shift().split(',');
  return lines.filter(Boolean).map(l => { const v = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = v[i] === undefined ? '' : v[i]; }); return o; });
}
const pairN = v => { const m = /^\s*(\d+)\s*-\s*(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2]] : null; };
/* Hollinger's Game Score */
const gameScore = r => r.pts + 0.4 * r.fgm - 0.7 * r.fga - 0.4 * (r.fta - r.ftm) + 0.7 * r.orb + 0.3 * r.drb + r.stl + 0.7 * r.ast + 0.7 * r.blk - 0.4 * r.pf - r.tov;

/* Everything the model reads, from a repo's data folder: the games (preseason left out: it teaches nothing and is never
   graded), each side's box rows and each side's possessions. Not the injury log: it keeps each day's last read, which on
   a late run lands after tip-off, so no call reads it (ROTATION) */
function load(root = L.ROOT) {
  const data = path.join(root, 'data');
  const games = readCsv(path.join(data, 'games.csv'))
    .filter(g => g.type !== 'PRE' && ['final', 'scheduled', 'live'].includes(g.status))
    .map(g => ({ id: g.game_id, season: +g.season, date: g.date, type: g.type, home: g.home, away: g.away, neutral: +g.neutral === 1,
      final: g.status === 'final', status: g.status, hs: g.home_score === '' ? null : +g.home_score, as: g.away_score === '' ? null : +g.away_score, tip: g.tip || '' }))
    .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const boxes = {};
  const num = v => v === '' || v === undefined ? 0 : +v;
  for (const f of fs.existsSync(data) ? fs.readdirSync(data).filter(f => /^box_\d{4}\.csv$/.test(f)).sort() : []) {
    for (const r of readCsv(path.join(data, f))) {
      const x = { pts: num(r.pts), fgm: num(r.fgm), fga: num(r.fga), fta: num(r.fta), ftm: num(r.ftm), orb: num(r.orb), drb: num(r.drb), stl: num(r.stl), ast: num(r.ast), blk: num(r.blk), pf: num(r.pf), tov: num(r.tov) };
      const row = { id: r.player_id, min: num(r.min), starter: +r.starter === 1 ? 1 : 0, gs: gameScore(x), pm: r.pm === '' ? null : +r.pm, fga: x.fga, fta: x.fta, orb: x.orb, tov: x.tov };
      ((boxes[r.game_id] = boxes[r.game_id] || {})[r.team] = boxes[r.game_id][r.team] || []).push(row);
    }
  }
  const stats = {};
  for (const f of fs.existsSync(data) ? fs.readdirSync(data).filter(f => /^teambox_\d{4}\.jsonl$/.test(f)).sort() : [])
    for (const l of fs.readFileSync(path.join(data, f), 'utf8').split('\n')) { if (!l.trim()) continue; const t = JSON.parse(l); stats[t.game_id + ':' + t.team] = t.stats; }
  /* a side's possessions in a game, players.js's sideTotals: the team totals where the feed gave them, else the
     players summed */
  const poss = {};
  for (const [gid, sides] of Object.entries(boxes)) for (const [t, rows] of Object.entries(sides)) {
    let fga = 0, fta = 0, orb = 0, tov = 0;
    for (const r of rows) { fga += r.fga; fta += r.fta; orb += r.orb; tov += r.tov; }
    const s = stats[gid + ':' + t];
    if (s) { const fg = pairN(s['fieldGoalsMade-fieldGoalsAttempted']), ft = pairN(s['freeThrowsMade-freeThrowsAttempted']);
      if (fg) fga = fg[1]; if (ft) fta = ft[1]; if (s.offensiveRebounds) orb = +s.offensiveRebounds || orb; const tv = +s.totalTurnovers || +s.turnovers; if (tv) tov = tv; }
    poss[gid + ':' + t] = Math.max(fga - orb + tov + 0.44 * fta, 60);
  }
  for (const sides of Object.values(boxes)) for (const rows of Object.values(sides)) for (const r of rows) { delete r.fga; delete r.fta; delete r.orb; delete r.tov; }
  return { games, boxes, poss };
}

/* ---------- the replay ---------- */
/* ROTATION. A player's rating is his shrunk value a minute, (value + n0 r0) / (minutes + n0): his value his on-court
   plus-minus (`value` 'pm', which the search chose; Hollinger's Game Score, 'gs', was tried), each season's sums decayed
   by `decay` a season back, n0 minutes of the replacement level r0: the value a minute of the players outside each
   side's top eight by minutes, over every final before the day. A rotation's strength is its projected minutes (each player's mean over his last eight appearances)
   filled into the game's 240 in rotation order, as makeLiveLineup fills tonight's, each player weighted by his minutes
   over 240 (minutes the rotation cannot fill are replacement minutes, worth 0): the minutes-weighted rating above
   replacement.
     A club's usual strength is the mean of its last `window` games' rotations (who played in each, every one at his
   projected minutes and today's rating), so a player out for half of them counts half, and an absence the window has
   rolled past costs nothing, as the NFL's quarterback change fades once the club's ratings have taken it in. With
   `usual` 'current' a player since gone to another club leaves the old club's usual at once; with 'all' his leaving
   costs the old club until the window rolls past it, as his absence would.
     Tonight's strength is the rotation expected before tip-off, read three ways:
       known   who played, at projected minutes (what a perfect injury report would say: the fit's rows, and a
               hindsight comparison, never an honest call)
       pretip  the club's previous game's rotation, less anyone since gone to another club: the walk-forward's honest
               call, and every call in the model file's `games` (the backtest replay of the season in play, final, under
               way or to come), so a game's call there never reads today's roster or report, nor the injury log; a club's
               first game of a season has no previous game of the season and no drop, whoever last played for it
       live    the games to come (`upcoming`): the hub's own rule, players.js makeLiveLineup on today's roster and report
   and the drop is usual less tonight, so a club at full strength has none and a missing star costs his minutes'
   worth over the man who takes them. */
function replay(D, ctx, opt = {}) {
  const clubs = {}, players = {};
  const R0_START = D.value === 'pm' ? -0.05 : 0.2;          // only before the first box score
  let r0n = 0, r0d = 0, r0 = R0_START, lg = 110;
  const club = t => clubs[t] || (clubs[t] = { elo: MEAN, o: null, d: null, season: null, dates: [], ahead: [], win: [], boxSeason: null });
  /* proj: the mean of the last PROJ minutes, kept as they change (the window reads it some forty times a game) */
  const player = (id, season) => players[id] || (players[id] = { num: 0, den: 0, s: season, mins: [], proj: 0, team: '', last: '' });
  const rating = (p, season) => { if (p.s < season) { const f = Math.pow(D.decay, season - p.s); p.num *= f; p.den *= f; p.s = season; } return (p.num + D.n0 * r0) / (p.den + D.n0); };
  const projected = (p, starter) => p.mins.length ? p.proj : DEBUT[starter ? 1 : 0];
  /* a rotation's strength: its players by projected minutes, longest first (ties in the order given), filled to 240, a
     player left under 4 dropped. PS and MS are one buffer for every rotation, sorted in place: the window reads forty
     rotations a club a game, and building arrays for each was most of a replay's time */
  const PS = [], MS = [];
  const filled = (n, season) => {
    for (let i = 1; i < n; i++) { const p = PS[i], m = MS[i]; let j = i - 1; while (j >= 0 && MS[j] < m) { PS[j + 1] = PS[j]; MS[j + 1] = MS[j]; j--; } PS[j + 1] = p; MS[j + 1] = m; }
    let left = 240, s = 0;
    for (let i = 0; i < n && left > 0; i++) { const give = Math.min(MS[i], left); if (give >= 4) s += give * (rating(PS[i], season) - r0); left -= give; }
    return s / 240;
  };
  const strength = (list, season) => { for (let i = 0; i < list.length; i++) { PS[i] = list[i][0]; MS[i] = list[i][1]; } return filled(list.length, season); };
  const rotation = (entry, t, season, current) => {
    let n = 0;
    for (const [id, st] of entry) { const p = players[id]; if (current && p.team !== t) continue; PS[n] = p; MS[n] = projected(p, st); n++; }
    return filled(n, season);
  };
  const usualOf = (c, t, season) => { if (!c.win.length) return null; let s = 0; for (const e of c.win) s += rotation(e, t, season, D.usual === 'current'); return s / c.win.length; };
  const rows = [], byDate = [];
  for (const g of ctx.games) { if (!byDate.length || byDate[byDate.length - 1][0].date !== g.date) byDate.push([g]); else byDate[byDate.length - 1].push(g); }
  for (const day of byDate) {
    /* 1. every game of the day read from the state as the day began */
    for (const g of day) {
      const H = club(g.home), A = club(g.away);
      for (const c of [H, A]) if (c.season !== g.season) {
        if (c.season !== null) { c.elo = MEAN + D.carry * (c.elo - MEAN); if (c.o !== null) { c.o = lg + D.carryNet * (c.o - lg); c.d = lg + D.carryNet * (c.d - lg); } }
        c.season = g.season; c.dates = []; c.ahead = [];
      }
      const restOf = c => {
        let last = c.dates.length ? c.dates[c.dates.length - 1] : '';
        if (!g.final) for (const a of c.ahead) if (a < g.date && a > last) last = a;   // a game two days out sees tomorrow's (elo.js)
        return last ? Math.min(dayGap(last, g.date), D.restCap) : D.restCap;
      };
      const rh = restOf(H), ra = restOf(A);
      const net = c => c.o === null ? 0 : c.o - c.d;
      const box = ctx.boxes[g.id] || {};
      const side = (c, t) => {
        const usual = usualOf(c, t, g.season);
        const drop = {};
        if (usual === null) return { known: 0, pretip: 0, live: 0, usual: null };
        if (box[t]) drop.known = usual - strength(box[t].filter(r => r.min > 0).map(r => [player(r.id, g.season), projected(player(r.id, g.season), r.starter)]), g.season);
        drop.pretip = c.boxSeason !== g.season ? 0 : usual - rotation(c.win[c.win.length - 1], t, g.season, true);
        if (!g.final && opt.live) { const lv = opt.live(g, t, players, projected, (r, season) => { const p = player(r.player_id, season); if (!p.team) p.team = r.team; return p; });
          if (lv) drop.live = usual - strength(lv, g.season); }
        drop.usual = usual;
        return drop;
      };
      const dh = side(H, g.home), da = side(A, g.away);
      rows.push({ id: g.id, season: g.season, date: g.date, type: g.type, home: g.home, away: g.away, final: g.final, box: !!(box[g.home] && box[g.away]),
        mov: g.final ? g.hs - g.as : null,
        x: { home: g.neutral ? 0 : 1, elo: H.elo - A.elo, rest: clip(rh - ra, D.restClip), b2b: (rh === 1 ? 1 : 0) - (ra === 1 ? 1 : 0), net: net(H) - net(A),
          alt: !g.neutral && ALT.has(g.home) ? 1 : 0 },
        drop: { home: dh, away: da } });
    }
    for (const g of day) if (!g.final) { club(g.home).ahead.push(g.date); club(g.away).ahead.push(g.date); }
    /* 2. then the day's finals update it */
    for (const g of day) {
      if (!g.final) continue;
      const H = club(g.home), A = club(g.away), mov = g.hs - g.as;
      const d = H.elo - A.elo + (g.neutral ? 0 : D.hfa), p = prob(d), S = mov > 0 ? 1 : mov < 0 ? 0 : 0.5;
      const mult = D.elo === 'nfl' ? Math.log(Math.abs(mov) + 1) * 2.2 / (Math.abs(d) * 0.001 + 2.2)
        : Math.pow(Math.abs(mov) + 3, 0.8) / (7.5 + 0.006 * (mov >= 0 ? d : -d));
      /* the NFL rule's multiplier is about 2.3 times FiveThirtyEight's at a ten-point margin, so under it K is read
         as K / 2.3: the same pace of update, and one K grid for both */
      const delta = (D.elo === 'nfl' ? D.K / 2.3 : D.K) * mult * (S - p);
      H.elo += delta; A.elo -= delta;
      for (const c of [H, A]) { c.dates.push(g.date); if (c.dates.length > 4) c.dates.shift(); }
      const box = ctx.boxes[g.id];
      if (!box) continue;                                    // no box score: the Elo alone learns from it
      const pH = ctx.poss[g.id + ':' + g.home], pA = ctx.poss[g.id + ':' + g.away];
      if (box[g.home] && box[g.away] && pH && pA) {
        const oh = 100 * g.hs / pH, oa = 100 * g.as / pA;
        for (const [c, mine, theirs] of [[H, oh, oa], [A, oa, oh]]) {
          if (c.o === null) { c.o = lg; c.d = lg; }
          c.o += D.alpha * (mine - c.o); c.d += D.alpha * (theirs - c.d);
        }
        lg += 0.005 * ((oh + oa) / 2 - lg);
      }
      for (const [t, c] of [[g.home, H], [g.away, A]]) {
        const rs = box[t]; if (!rs) continue;
        const top = new Set(rs.filter(r => r.min > 0).sort((a, b) => b.min - a.min).slice(0, TOP).map(r => r.id));
        const entry = [];
        for (const r of rs) {
          const pl = player(r.id, g.season); rating(pl, g.season);
          pl.team = t; pl.last = g.date;
          if (r.min <= 0) continue;
          const v = D.value === 'pm' ? r.pm : r.gs;
          if (v !== null) { pl.num += v; pl.den += r.min; if (!top.has(r.id)) { r0n += v; r0d += r.min; } }
          pl.mins.push(r.min); if (pl.mins.length > KEEP) pl.mins.shift(); pl.proj = mean(pl.mins.slice(-PROJ));
          entry.push([r.id, r.starter]);
        }
        c.win.push(entry); if (c.win.length > D.window) c.win.shift();
        c.boxSeason = g.season;
      }
    }
    if (r0d) r0 = r0n / r0d;
  }
  return { rows, clubs, players, r0, lg };
}

/* ---------- the fit ---------- */
const feats = D => ['home', 'elo', ...(D.rest === 'gap' ? ['rest'] : D.rest === 'b2b' ? ['b2b'] : ['rest', 'b2b']), 'net', ...(D.alt ? ['alt'] : []), ...(D.rot ? ['rot'] : [])];
const vec = (r, F, mode) => F.map(f => f === 'rot' ? (r.drop.home[mode] === undefined ? 0 : r.drop.home[mode]) - (r.drop.away[mode] === undefined ? 0 : r.drop.away[mode]) : r.x[f]);
/* least squares by the normal equations, solved with partial pivoting */
function lsq(X, y) {
  const k = X[0].length, A = Array.from({ length: k }, () => Array(k).fill(0)), b = Array(k).fill(0);
  for (let i = 0; i < X.length; i++) for (let p = 0; p < k; p++) { b[p] += X[i][p] * y[i]; for (let q = 0; q < k; q++) A[p][q] += X[i][p] * X[i][q]; }
  for (let p = 0; p < k; p++) {
    let m = p; for (let r = p + 1; r < k; r++) if (Math.abs(A[r][p]) > Math.abs(A[m][p])) m = r;
    [A[p], A[m]] = [A[m], A[p]]; [b[p], b[m]] = [b[m], b[p]];
    for (let r = 0; r < k; r++) if (r !== p) { const f = A[r][p] / A[p][p]; for (let q = p; q < k; q++) A[r][q] -= f * A[p][q]; b[r] -= f * b[p]; }
  }
  return b.map((v, p) => v / A[p][p]);
}
/* the logistic slope on the margin by Newton's method on the log loss */
function slope(m, y) {
  let k = 0.1;
  for (let it = 0; it < 50; it++) { let gr = 0, h = 0; for (let i = 0; i < m.length; i++) { const p = sig(k * m[i]); gr += (p - y[i]) * m[i]; h += p * (1 - p) * m[i] * m[i]; } const step = gr / h; k -= step; if (Math.abs(step) < 1e-12) break; }
  return k;
}
const fitRows = (rows, from, to) => rows.filter(r => r.final && r.box && r.season >= from && r.season <= to);
function fit(rows, D, from, to) {
  const F = feats(D), tr = fitRows(rows, from, to);
  const X = tr.map(r => vec(r, F, D.fitMode)), y = tr.map(r => r.mov);
  const b = lsq(X, y);
  const m = X.map(x => x.reduce((s, v, i) => s + v * b[i], 0));
  const k = slope(m, tr.map(r => r.mov > 0 ? 1 : 0));
  return { feats: F, coef: Object.fromEntries(F.map((f, i) => [f, b[i]])), k, games: tr.length, seasons: `${from}-${to}` };
}
const margin = (r, M, mode) => vec(r, M.feats, mode).reduce((s, v, i) => s + v * M.coef[M.feats[i]], 0);
function score(list, pOf, mOf) {
  let ll = 0, right = 0, ae = 0, n = 0, na = 0;
  for (const r of list) {
    const p = Math.min(Math.max(pOf(r), 1e-6), 1 - 1e-6), y = r.mov > 0 ? 1 : 0;
    ll -= y * Math.log(p) + (1 - y) * Math.log(1 - p); n++;
    if ((p >= 0.5) === (y === 1)) right++;
    if (mOf) { const m = mOf(r); if (m !== null && m !== undefined) { ae += Math.abs(r.mov - m); na++; } }
  }
  const o = { games: n, logloss: n ? r6(ll / n) : null, acc: n ? r4(right / n) : null };
  if (mOf) o.mae = na ? +(ae / na).toFixed(3) : null;
  return o;
}
const scoreAlpha = (list, M, mode) => score(list, r => sig(M.k * margin(r, M, mode)), r => margin(r, M, mode));


/* ---------- the walk-forward ---------- */
/* the games a season is scored on: its regular-season and playoff finals with both box scores, the player model's own
   set (research.json's folds), so the two are scored on the same games */
const testRows = (rows, S) => rows.filter(r => r.final && r.box && r.season === S);
/* the hub's rule for a change (README, "The October 2026 refresh"): lower log loss in both design seasons, by 0.0005
   between them, and the spread error no worse */
const better = (a, b) => DESIGN_ON.every(S => a.per[S].logloss < b.per[S].logloss) && DESIGN_ON.reduce((s, S) => s + b.per[S].logloss - a.per[S].logloss, 0) >= 0.0005
  && mean(DESIGN_ON.map(S => a.per[S].mae)) <= mean(DESIGN_ON.map(S => b.per[S].mae)) + 1e-9;
function research(ctx, ref, opts = {}) {
  const cache = new Map();
  const rowsFor = D => { const key = JSON.stringify(STATE_KEYS.map(k => D[k])); if (!cache.has(key)) cache.set(key, replay(D, ctx).rows.filter(r => r.final && r.box && r.season >= FIRST_BOX)); return cache.get(key); };
  /* the design seasons alone: fitted on the seasons before each, scored on the call made before tip-off (pretip) */
  const design = D => { const rows = rowsFor(D), per = {}; for (const S of DESIGN_ON) per[S] = scoreAlpha(testRows(rows, S), fit(rows, D, D.fitFrom, S - 1), 'pretip'); return { per, mean: r6(mean(DESIGN_ON.map(S => per[S].logloss))) }; };
  const show = r => Object.fromEntries(DESIGN_ON.map(S => [S, { logloss: r.per[S].logloss, acc: r.per[S].acc, mae: r.per[S].mae }]));
  let D = { ...DEFAULT }, best = design(D);
  const trials = [{ change: 'start', design: { ...D }, ...show(best), kept: true }];
  for (let pass = 1, moved = true; moved && pass <= 3; pass++) {
    moved = false;
    for (const [k, vals] of Object.entries(GRID)) {
      let pick = null;
      for (const v of vals) {
        if (v === D[k]) continue;
        const q = { ...D, [k]: v }, res = design(q);
        const ok = better(res, best);
        trials.push({ change: `${k} ${v}`, pass, ...show(res), kept: false, passes: ok });
        if (ok && (!pick || res.mean < pick.res.mean)) pick = { v, res, at: trials.length - 1 };
      }
      if (pick) { D = { ...D, [k]: pick.v }; best = pick.res; trials[pick.at].kept = true; moved = true; }
    }
    L.log(`design pass ${pass}: ${JSON.stringify(D)} | 2024 ${best.per[2024].logloss} 2025 ${best.per[2025].logloss}`);
  }
  /* the rotation term, held to the same rule on the chosen design: if it does not survive, Alpha is fitted without it */
  const withRot = design({ ...D, rot: 1 }), noRot = design({ ...D, rot: 0 });
  const rotSurvives = better(withRot, noRot);
  const rotation = { with: show(withRot), without: show(noRot), survives: rotSurvives,
    rule: 'lower log loss in 2024 and in 2025, by 0.0005 between them, and the spread error no worse, the call made on the previous game\'s rotation' };
  if (!rotSurvives) D.rot = 0;
  if (opts.designOnly) return { design: D, trials, rotation };
  /* the folds, 2026 scored here for the first time with the design 2024 and 2025 chose */
  const rows = rowsFor(D);
  const folds = [];
  for (const S of FOLDS) {
    const M = fit(rows, D, D.fitFrom, S - 1), te = testRows(rows, S), ids = new Set(te.map(r => r.id));
    const fold = { season: S, fit: M.seasons, fitGames: M.games, coef: Object.fromEntries(Object.entries(M.coef).map(([f, v]) => [f, r6(v)])), k: r6(M.k),
      alpha: scoreAlpha(te, M, 'pretip'), alphaKnown: scoreAlpha(te, M, 'known') };
    /* the same design without the rotation term, for what the term is worth (decided on 2024 and 2025 above) */
    if (D.rot) fold.alphaNoRotation = scoreAlpha(te, fit(rows, { ...D, rot: 0 }, D.fitFrom, S - 1), 'pretip');
    const tel = ref.teamElo.filter(r => ids.has(r.id));
    fold.teamElo = score(tel, r => r.pHome, r => r.margin);
    const pm = (ref.research.folds || []).find(f => f.season === S);
    fold.playerModel = pm ? { naive: pick4(pm.naive), known: pick4(pm.known), note: 'research.json, on its own games' } : null;
    const withOdds = te.filter(r => ref.odds[r.id]);
    const telById = Object.fromEntries(tel.map(r => [r.id, r]));
    fold.market = {
      games: withOdds.length,
      market: score(withOdds, r => ref.odds[r.id].pHome, r => ref.odds[r.id].margin),
      alpha: scoreAlpha(withOdds, M, 'pretip'),
      teamElo: score(withOdds.filter(r => telById[r.id]).map(r => telById[r.id]), r => r.pHome, r => r.margin),
    };
    folds.push(fold);
    L.log(`fold ${S} (${fold.alpha.games} games): Alpha ${fold.alpha.logloss} / ${(fold.alpha.acc * 100).toFixed(1)}% / ${fold.alpha.mae} | known lineup ${fold.alphaKnown.logloss} | team Elo ${fold.teamElo.logloss} | market ${fold.market.market.logloss} on ${fold.market.games}`);
  }
  return { design: D, trials, rotation, folds, notes: NOTES };
}
const NOTES = [
  'Every call is made before tip-off: the state is what the finals before the game\'s day left, and tonight\'s rotation is the club\'s previous game\'s (alpha, the honest number). alphaKnown is the same model told who played (hindsight, as the player model\'s "known" rows): never a call, only the bound a perfect injury report would reach.',
  'The design was chosen on 2024 and 2025 alone (trials); 2026 was scored once, with that design. Before the search was written, one development run on the starting design (DEFAULT) printed 2026\'s log loss, straight-up rate and spread error for three variants, each scored on the previous game\'s rotation and told who played: no rotation term (0.6005), the term fitted on who played (0.5992 on the previous game\'s rotation, 0.5917 told who played) and fitted on the previous game\'s rotation (0.5988, 0.5939). No other 2026 number was printed before the design was fixed. No choice reads them: the search kept the rotation term on 2024 and 2025 (those 2026 numbers had it too), and chose to fit it on who played where they had favoured the previous game\'s rotation.',
  'Each fold is fitted on the seasons before it (fit) and scored on its own regular-season and playoff finals with both box scores, the player model\'s own games. 2026-27, the season in play, is never fitted, tuned or scored.',
  'teamElo is the hub\'s team model with model.json\'s parameters (fitted on 2008-2022, the home edge learned as the finals come), on the same games. playerModel is research.json\'s walk-forward, on its own games (the same count). market is odds_hist.csv\'s consensus closing moneyline with the margin taken out, and its closing spread, on the games that have one.',
];
const pick4 = m => m ? { games: m.games, logloss: m.logloss, acc: m.acc, mae: m.mae } : null;

/* the comparisons' own numbers, each game by id: the team model's pre-game call (elo.js with model.json's parameters,
   as the hub runs it) and the market's no-vig closing moneyline with its closing spread (odds_hist.csv) */
function references(root = L.ROOT) {
  const E = require('./elo');
  const model = JSON.parse(fs.readFileSync(path.join(root, 'model.json'), 'utf8'));
  const all = readCsv(path.join(root, 'data', 'games.csv')).filter(g => (g.status === 'final' && g.type !== 'PRE') || g.status === 'scheduled' || g.status === 'live');
  all.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const TE = E.replay(model.params, all, true);
  const teamElo = TE.recs.map(r => ({ id: `${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`, season: r.season, pHome: r.pHome, margin: r.d / model.params.scale, mov: r.mov }));
  const imp = ml => ml < 0 ? -ml / (-ml + 100) : 100 / (ml + 100);
  const odds = {};
  for (const r of readCsv(path.join(root, 'data', 'odds_hist.csv'))) {
    if (r.home_ml === '' || r.away_ml === '') continue;
    const h = imp(+r.home_ml), a = imp(+r.away_ml);
    odds[r.game_id] = { pHome: h / (h + a), margin: r.home_line === '' ? null : -r.home_line };
  }
  const rj = path.join(root, 'research.json');
  return { teamElo, odds, research: fs.existsSync(rj) ? JSON.parse(fs.readFileSync(rj, 'utf8')) : {} };
}

/* ---------- the live run ---------- */
/* tonight's rotation for a game to come: players.js makeLiveLineup, the hub's one availability rule (today's roster
   less the injury report's absences by their return dates, filled to 240 by projected minutes), run on Alpha's own
   players. `make` is that function, or the players.js to load it from (the tests load another folder's). When it
   cannot be had (today's report or roster does not read), the games to come are called as every other game is, on
   each club's previous game's rotation, and the provider carries why, for the file's status to say */
function liveProvider(make = './players') {
  if (typeof make === 'string') {
    try { make = require(make).makeLiveLineup({ coachOf: () => '' }); }
    catch (e) {
      const why = `today's roster and injury report did not read (${String(e && e.message || e).split('\n')[0]})`;
      L.log(`alpha: ${why}; the games to come are called on each club's previous game's rotation`);
      const none = () => null; none.why = why;
      return none;
    }
  }
  const memo = {};
  return (g, t, players, projected, getP) => {
    if (!memo[g.id]) memo[g.id] = make({ season: g.season, date: g.date, home: g.home, away: g.away }, players, projected, getP);
    return memo[g.id][t === g.home ? 'home' : 'away'].list;
  };
}
/* the reading a call is made on: in `upcoming`, a game to come on tonight's rotation by the hub's rule, else (no report
   read) on its previous game's rotation; every call in `games` on the previous game's rotation (callOf's mode
   'pretip'), what the walk-forward scores */
const modeOf = r => !r.final && r.drop.home.live !== undefined && r.drop.away.live !== undefined ? 'live' : 'pretip';
const callOf = (r, M, mode = modeOf(r)) => { const m = margin(r, M, mode); return { pHome: r4(sig(M.k * m)), spread: +(-m).toFixed(1) }; };

/* the season in play: the latest with a game still to play, else (the summer) the latest with a final; the last
   finished season, the last a fit may take, is the latest before it, so the season whose games the file calls is never
   in its fit, whatever the phase */
function seasons(ctx) {
  const toPlay = ctx.games.filter(g => !g.final).map(g => g.season), finals = ctx.games.filter(g => g.final).map(g => g.season);
  const inPlay = toPlay.length ? Math.max(...toPlay) : finals.length ? Math.max(...finals) : null;
  const finished = finals.filter(s => s < inPlay);
  return { inPlay, lastFinished: finished.length ? Math.max(...finished) : null };
}
/* the live fit: the design's first fit season to the last finished one (or `to`, the seasons a committed fit names) */
function fitLive(ctx, D, to) {
  const last = to || seasons(ctx).lastFinished;
  const rows = replay(D, ctx).rows;
  const M = fit(rows, D, D.fitFrom, last);
  return { feats: M.feats, coef: Object.fromEntries(Object.entries(M.coef).map(([f, v]) => [f, r6(v)])), k: r6(M.k), fitSeasons: M.seasons,
    fit: scoreAlpha(testRowsRange(rows, D.fitFrom, last), { ...M }, D.fitMode) };
}
const testRowsRange = (rows, a, b) => rows.filter(r => r.final && r.box && r.season >= a && r.season <= b);
const ABOUT = D => 'The NFL hub\'s Alpha Model refitted on NBA games: a least-squares home margin on home court, the two clubs\' Elo, ' +
  'rest and back to backs, net rating (points per 100 possessions for less against, exponentially weighted)' + (D.rot ? ' and the rotation drop (each club\'s ' +
  'usual rotation less tonight\'s, each player rated by his shrunk ' + (D.value === 'pm' ? 'on-court plus-minus' : 'Game Score') + ' a minute; tonight\'s is, in games, ' +
  'the club\'s previous game\'s rotation, none at its first game of a season, as the walk-forward calls a game before tip-off, and in upcoming the hub\'s ' +
  'availability rule on today\'s roster and injury report)' : '') +
  ', and the win chance the logistic of that margin. The spread is the margin; no total. Fitted on seasons before the one in play only, never refitted by the job.';

/* the model file: every game of the season in play, final, under way or to come, as the walk-forward calls a game
   before tip-off (`games`, which the Pick'em Record takes for a game played before Alpha's first published call), the
   games to come apart on today's report (`upcoming`), with the fitted numbers and the walk-forward. A game to come
   that could not be read on today's report is called on its previous game's rotation, and the status says so */
function build(ctx, P, walkForward, live) {
  const R = replay(P.design, ctx, { live });
  const { inPlay } = seasons(ctx);
  const M = { feats: P.feats, coef: P.coef, k: P.k };
  const games = {}, upcoming = {};
  let unread = 0;
  for (const r of R.rows) {
    if (!r.final) { const mode = modeOf(r); if (mode !== 'live') unread++; upcoming[r.id] = callOf(r, M, mode); }
    if (r.season === inPlay) games[r.id] = callOf(r, M, 'pretip');
  }
  const status = { ok: true };
  if (unread) status.note = `${live && live.why ? live.why : 'today\'s roster and injury report were not read'}: ${unread} game${unread === 1 ? '' : 's'} to come called on each club's previous game's rotation`;
  return { id: 'alpha', name: 'Alpha Model', version: VERSION, about: ABOUT(P.design), fitSeasons: P.fitSeasons, params: P, walkForward, games, upcoming, status };
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
/* a file not there is null (a first run); one there that does not read is an error, never a quiet fresh start: a model
   file read as missing would be refitted by the job */
const readJson = f => {
  if (!fs.existsSync(f)) return null;
  try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { throw new Error(`${path.basename(path.dirname(f))}/${path.basename(f)} does not read: ${e.message}`); }
};

/* one run on a repo folder (the tests run it on a scratch one); its exit code. A failed run keeps the last good calls
   and says why, for the record to show; a model file that does not read is left as it is, for the job to put back */
function run(root = L.ROOT, cmd = '', live) {
  const t0 = Date.now();
  const OUT = path.join(root, 'models', 'alpha.json'), RES = path.join(root, 'research', 'alpha.json');
  let prev;
  try { prev = readJson(OUT); } catch (e) { L.log('alpha failed: ' + e.message); return 1; }
  try {
    const ctx = load(root);
    if (!ctx.games.some(g => g.final)) throw new Error('no finals in data/games.csv');
    let res = readJson(RES);
    if (cmd === 'research') {
      const R = research(ctx, references(root));
      res = { name: 'Alpha Model: walk-forward and design', version: VERSION, generatedBy: 'node tools/alpha.js research', ...R };
      L.log(`research/alpha.json ${write(RES, res, readJson(RES)) ? 'written' : 'unchanged'}`);
    }
    let P = prev && prev.params && prev.params.coef && cmd !== 'fit' && cmd !== 'research' ? prev.params : null;
    if (!P) {
      const D = res && res.design ? res.design : { ...DEFAULT };
      P = { design: D, ...fitLive(ctx, D) };
      L.log(`fitted on ${P.fitSeasons}: ${JSON.stringify(P.coef)} k ${P.k}`);
    }
    const wf = res && res.folds ? Object.fromEntries(res.folds.map(f => [f.season, { games: f.alpha.games, logloss: f.alpha.logloss, acc: f.alpha.acc, mae: f.alpha.mae }])) : (prev && prev.walkForward) || {};
    const model = build(ctx, P, wf, live || liveProvider());
    if (model.status.note) L.log('alpha: ' + model.status.note);
    const wrote = write(OUT, model, prev);
    L.log(`alpha: ${Object.keys(model.games).length} calls of the season in play, ${Object.keys(model.upcoming).length} to come | models/alpha.json ${wrote ? 'written' : 'unchanged'} | ${((Date.now() - t0) / 1000).toFixed(1)}s`);
    return 0;
  } catch (e) {
    L.log('alpha failed: ' + (e && e.stack || e));
    if (prev) write(OUT, { ...prev, status: { ok: false, why: String(e && e.message || e) } }, prev);
    return 1;
  }
}

if (require.main === module) process.exitCode = run(L.ROOT, process.argv[2] || '');
module.exports = { load, replay, fit, lsq, slope, margin, score, scoreAlpha, feats, vec, gameScore, build, write, readJson, run, callOf, modeOf, seasons, fitLive, research, references, liveProvider,
  DEFAULT, GRID, FOLDS, DESIGN_ON, STATE_KEYS, VERSION };
