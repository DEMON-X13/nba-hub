/* The props model: each expected player's points, rebounds, assists, threes, steals, blocks and the five combos
 * (points + rebounds + assists, points + rebounds, points + assists, assists + rebounds, steals + blocks), a mean and
 * a full distribution per game, and his chance of a double-double and a triple-double from the same distributions.
 *
 *   node tools/props.js              the job's step: DraftKings' closing lines for new finals (props_record.js), the
 *                                    projections for the games to come with the constants in props.json, the shadow
 *                                    ledger (props_ledger.js); writes props.json
 *   node tools/props.js fit          choose the constants on every finished season first (a deliberate refit, between
 *                                    seasons only: never on the season in progress)
 *   node tools/props.js research     the walk-forward test and the market test: research/props.json, whose tables are
 *                                    in README.md "Player props"
 *
 * The model, per player per game, from the hub's own box scores (data/box_<season>.csv, 2021-22 on):
 *   minutes   its own rule, not the game model's (which takes a new season's minutes from the last five regular-season
 *             games and missed opening nights by 7.2 minutes): b = the player's minutes this season, exponentially
 *             weighted toward his last appearances (half-life min.h), blended with a prior worth min.w0 appearances,
 *             his whole previous regular season's average (when he played min.minN games of it; else his last 20
 *             regular-season appearances). Then the side's expected rotation is scaled toward a full game,
 *             m = b x (min.T / S)^min.alpha, S the sum of b over the side's available players projected min.floor
 *             minutes or more, so a side missing a starter hands his minutes to the rest; in the playoffs
 *             m + min.post x (m - 24) (starters play more, the bench less). At most 46.
 *   rate      each stat per minute, exponentially weighted over his appearances (half-life rate[k].h), shrunk toward
 *             his position's league rate (G, F or C) with rate[k].m pseudo-minutes.
 *   pace      x (the game's expected pace / the pace of the games he played lately)^gamma, a club's pace being the
 *             running possessions per 48 players.js keeps (its rule, recomputed here so a backtest sees it as it was).
 *   opponent  x (what the opponent's opponents made of the stat per minute over the league's, half-life 20 games, shrunk
 *             toward average by 2,400 minutes)^opp[k].
 *   playoffs  x post[k], the ratio of what happened to what this projected in the earlier seasons' playoffs.
 *   mean      minutes x rate x pace x opponent (x playoffs); a combo's mean is the sum of its parts' means.
 *   spread    negative binomial with variance A x mean^B (var[k]), fitted per stat by maximum likelihood; a combo's on
 *             the combo's own results, so how a player's points and rebounds move together is in its spread.
 *   ladders   P(stat >= k) from the same distribution (nbSf); P(over a line) = P(stat >= floor(line) + 1).
 *   doubles   P(at least two, or three, of points, rebounds, assists, steals and blocks reach 10), the five
 *             distributions joined by a one-factor Gaussian copula whose correlation rho is fitted on the earlier
 *             seasons' double- and triple-doubles.
 * Who plays: in a backtest the players who played, and as the side's available rotation those who played or were
 * listed as not playing with b under 15 (CUT; ESPN lists a side's active players, a coach's decision at the end of the
 * bench among them; a rotation player listed as not playing is read as out, which the injury report would have said).
 * Live: the club's roster as ESPN lists it today minus the injury report's absences, by players.js's rule
 * (availability() below), its 13 with the most minutes counted toward the scale. A player with no game on record has no
 * projection. Projections are published for the next five game days, for players projected 8 minutes or more.
 * Every constant is chosen on finished seasons only (fit), never on the season in progress.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const DATA = process.env.NBA_DATA_DIR || path.join(L.ROOT, 'data');
const OUT = process.env.NBA_PROPS_OUT || path.join(L.ROOT, 'props.json');
const RESEARCH = path.join(L.ROOT, 'research', 'props.json');
const FIRST = 2022;                 // box scores start in 2021-22, which only warms the ratings up
const STATS = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'];
const COMBOS = { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
const ALL = STATS.concat(Object.keys(COMBOS));
const H_SET = [8, 15, 25, 40, 70, 120];        // rate half-lives tried, in appearances
const GRID = {
  minH: [1, 1.5, 2, 3, 5], minW0: [0.1, 0.25, 0.5, 1, 2, 3], minN: [5, 10, 20],
  alpha: [0, 0.25, 0.5, 0.75, 1], T: [220, 230, 240, 250, 260, 270, 280], floor: [0, 2, 4, 8, 12, 16],
  post: [0, 0.1, 0.2, 0.3, 0.4, 0.5], rateM: [10, 25, 50, 100, 200, 400, 800, 1600], gamma: [0, 0.25, 0.5, 0.75, 1, 1.25],
  rho: [0, 0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6], opp: [0, 0.25, 0.5, 0.75, 1, 1.25],
};
const CUT = 15;                     // the backtest's reading of a listed player who did not play (see the header)
const MAX_MIN = 46;
const MIN_SHOWN = 8;                // projections published (and called in the ledger) for players projected this many minutes or more:
                                    // 98% of the players DraftKings lined in the archived playoffs were projected 8 or more
const HORIZON = 5;                  // the games of the next five days with a game to come (DraftKings posts a game's props one to six days
                                    // ahead; counted in game days, so opening night is covered from the preseason)
const LIVE_SIDE = 13;               // live, the side's available players counted toward its scale (liveProjections)
const PCOLS = ['game_id', 'date', 'team', 'opp', 'home', 'player_id', 'name', 'pos', 'starter', 'min', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pm', 'pts', 'dnp'];
/* the box writes a position as G, F or C, and for some players PG, SG, SF or PF */
const posOf = p => { const s = String(p || '').toUpperCase(); return s === 'C' ? 'C' : s === 'F' || s === 'SF' || s === 'PF' ? 'F' : s === 'G' || s === 'PG' || s === 'SG' ? 'G' : ''; };
const POS = ['G', 'F', 'C'];
const r4 = x => Math.round(x * 1e4) / 1e4, r2 = x => Math.round(x * 100) / 100, r1 = x => Math.round(x * 10) / 10;
const doubles = y => [y.pts, y.reb, y.ast, y.stl, y.blk].filter(v => v >= 10).length;

/* ---------- data ---------- */
function loadBoxes(dir = DATA) {
  const byGame = {};
  for (const f of fs.readdirSync(dir).filter(f => /^box_\d{4}\.csv$/.test(f)).sort()) {
    const lines = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n'); lines.shift();
    for (const l of lines) {
      const v = l.split(','); const r = {}; PCOLS.forEach((c, i) => { r[c] = v[i] === undefined ? '' : v[i]; });
      const n = k => r[k] === '' ? 0 : +r[k];
      if (!r.player_id) continue;
      const row = { id: r.player_id, name: r.name, pos: posOf(r.pos), team: r.team, min: +r.min || 0, dnp: +r.dnp === 1,
        fga: n('fga'), fta: n('fta'), orb: n('orb'), tov: n('tov'),
        y: { pts: n('pts'), reb: n('orb') + n('drb'), ast: n('ast'), tpm: n('tpm'), stl: n('stl'), blk: n('blk') } };
      const g = byGame[r.game_id] = byGame[r.game_id] || {};
      (g[r.team] = g[r.team] || []).push(row);
    }
  }
  return byGame;
}
function loadTeamBoxes(dir = DATA) {
  const m = {};
  for (const f of fs.readdirSync(dir).filter(f => /^teambox_\d{4}\.jsonl$/.test(f)))
    for (const l of fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n')) { if (!l) continue; const t = JSON.parse(l); m[t.game_id + ':' + t.team] = t.stats; }
  return m;
}
const pairN = v => { const m = /^\s*(\d+)\s*-\s*(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2]] : null; };
/* a side's possessions per 48 in one game: players.js sideTotals, the team totals where the feed gave them */
function gamePace(rows, stats) {
  let fga = 0, fta = 0, orb = 0, tov = 0, min = 0;
  for (const r of rows) { fga += r.fga; fta += r.fta; orb += r.orb; tov += r.tov; min += r.min; }
  if (stats) {
    const fg = pairN(stats['fieldGoalsMade-fieldGoalsAttempted']), ft = pairN(stats['freeThrowsMade-freeThrowsAttempted']);
    if (fg) fga = fg[1]; if (ft) fta = ft[1];
    if (stats.offensiveRebounds) orb = +stats.offensiveRebounds || orb;
    const t = +stats.totalTurnovers || +stats.turnovers; if (t) tov = t;
  }
  return Math.max(fga - orb + tov + 0.44 * fta, 60) * 240 / Math.max(min, 240);
}
function loadGames() {
  const games = L.readGames().filter(g => +g.season >= FIRST && g.type !== 'PRE' && ['final', 'scheduled', 'live'].includes(g.status));
  games.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  games.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : 1);
  return games;
}

/* ---------- the replay: every finished game in order, each player's features read before the game ---------- */
const EARLY_PACE = 1.5;             // players.js: a club's pace starts a season at the league's plus the opening weeks' bump
const LG_DECAY = Math.pow(0.5, 1 / 25000);    // the league's per-position rates weigh about the last season
const zeros = () => Object.fromEntries(STATS.map(k => [k, 0]));
function newPlayer(row, season) {
  const acc = {}; for (const h of H_SET) acc[h] = { m: 0, y: zeros() };
  return { id: row.id, name: row.name, pos: row.pos || 'F', team: row.team, season, cur: [], reg: [], prevReg: [], acc, pace: 0, paceW: 0, n: 0, last: '',
    seasonY: zeros(), seasonN: 0, seasonDD: 0, seasonTD: 0, prevY: null, prevN: 0, prevDD: null, prevTD: null };
}
function rollSeason(p, season) {
  if (p.season === season) return;
  if (p.season === season - 1) {
    p.prevReg = p.reg.filter(x => x.season === p.season).map(x => x.min);
    p.prevY = p.seasonN ? Object.fromEntries(STATS.map(k => [k, p.seasonY[k] / p.seasonN])) : null; p.prevN = p.seasonN;
    p.prevDD = p.seasonN ? p.seasonDD / p.seasonN : null; p.prevTD = p.seasonN ? p.seasonTD / p.seasonN : null;
  } else { p.prevReg = []; p.prevY = null; p.prevN = 0; p.prevDD = null; p.prevTD = null; }
  p.cur = []; p.seasonY = zeros(); p.seasonN = 0; p.seasonDD = 0; p.seasonTD = 0; p.season = season;
}
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : null;
/* what is known about a player before a game: the inputs every rule below is built from */
function features(p, lgPos) {
  const f = { n: p.n, nCur: p.cur.length, cur: p.cur.slice(-30), prevMean: mean(p.prevReg), prevN: p.prevReg.length, last20: mean(p.reg.slice(-20).map(x => x.min)), n20: Math.min(20, p.reg.length),
    /* the game model's rule, for the comparison: the last eight appearances, a new season's from the last five regular-season games */
    hub: p.cur.length ? mean(p.cur.slice(-8)) : mean(p.reg.slice(-5).map(x => x.min)),
    acc: {}, posRate: {}, pace: p.paceW ? p.pace / p.paceW : null, pos: p.pos, naive: {},
    naiveDD: p.seasonN ? p.seasonDD / p.seasonN : p.prevDD, naiveTD: p.seasonN ? p.seasonTD / p.seasonN : p.prevTD };
  for (const h of H_SET) f.acc[h] = { m: p.acc[h].m, y: { ...p.acc[h].y } };
  const lp = lgPos[p.pos] || lgPos.F;
  for (const k of STATS) f.posRate[k] = lp.m ? lp.y[k] / lp.m : 0;
  for (const k of STATS) f.naive[k] = p.seasonN ? p.seasonY[k] / p.seasonN : p.prevY ? p.prevY[k] : null;
  return f;
}
function replay(games, boxes, teamStats, opts = {}) {
  const players = {}, pace = {}, seasonOfTeam = {};
  let lgPace = 99, lastFinal = '';
  const lgPos = Object.fromEntries(POS.map(p => [p, { m: 0, y: zeros() }]));
  /* what each club's opponents produced against it, per minute, weighted toward its last games (half-life OPP_H), and
     the league's own per-minute rates over the same span: a club's defence by stat */
  const allowed = {}, lgAll = { m: 0, y: zeros() };
  const rows = [];
  const byDate = {};
  for (const g of games) (byDate[g.date] = byDate[g.date] || []).push(g);
  const getP = (r, season) => { let p = players[r.id]; if (!p) p = players[r.id] = newPlayer(r, season); rollSeason(p, season); return p; };
  for (const date of Object.keys(byDate).sort()) {
    const day = byDate[date].filter(g => g.status === 'final' && boxes[g.game_id] && boxes[g.game_id][g.home] && boxes[g.game_id][g.away]);
    if (!day.length) continue;
    for (const g of day) for (const t of [g.home, g.away]) {
      if (pace[t] === undefined) pace[t] = 99;
      if (seasonOfTeam[t] !== g.season) { if (seasonOfTeam[t] !== undefined) pace[t] = lgPace + EARLY_PACE; seasonOfTeam[t] = g.season; }
    }
    /* the day's features first, then its results: nothing from the same day leaks into a projection */
    if (opts.collect) for (const g of day) {
      if (g.season < (opts.from || FIRST + 1)) continue;
      const expPace = (pace[g.home] + pace[g.away]) / 2;
      for (const [t, opp] of [[g.home, g.away], [g.away, g.home]]) {
        /* every player the box lists, those who played and those listed as not playing (ESPN lists a side's active
           players: a coach's decision is listed, an inactive player is not), so the side's available rotation can be
           read as the live roster minus the injury report reads it */
        for (const r of boxes[g.game_id][t]) {
          const p = players[r.id];
          if (!p || !p.n) continue;                 // no game on record: no projection
          rollSeason(p, g.season);
          rows.push({ game: g.game_id, season: g.season, type: g.type, date, team: t, opp, id: r.id, played: r.min > 0 && !r.dnp, f: features(p, lgPos), expPace, oppF: oppFactor(allowed[opp], lgAll), min: r.min, y: r.y, sideKey: g.game_id + ':' + t });
        }
      }
    }
    for (const g of day) {
      const pc = {};
      for (const t of [g.home, g.away]) pc[t] = gamePace(boxes[g.game_id][t], teamStats[g.game_id + ':' + t]);
      for (const t of [g.home, g.away]) {
        for (const r of boxes[g.game_id][t]) {
          const p = getP(r, g.season); p.team = t; p.name = r.name || p.name; if (r.pos) p.pos = r.pos;
          if (r.min <= 0 || r.dnp) continue;
          p.n++; p.last = date; p.cur.push(r.min); if (p.cur.length > 100) p.cur.shift();
          if (g.type === 'REG') { p.reg.push({ season: g.season, min: r.min }); if (p.reg.length > 100) p.reg.shift(); }
          for (const h of H_SET) { const d = Math.pow(0.5, 1 / h), a = p.acc[h]; a.m = a.m * d + r.min; for (const k of STATS) a.y[k] = a.y[k] * d + r.y[k]; }
          const dp = Math.pow(0.5, 1 / 25); p.pace = p.pace * dp + pc[t] * r.min; p.paceW = p.paceW * dp + r.min;
          for (const k of STATS) p.seasonY[k] += r.y[k]; p.seasonN++;
          const dd = doubles(r.y); if (dd >= 2) p.seasonDD++; if (dd >= 3) p.seasonTD++;
          const lp = lgPos[p.pos] || lgPos.F; lp.m = lp.m * LG_DECAY + r.min; for (const k of STATS) lp.y[k] = lp.y[k] * LG_DECAY + r.y[k];
        }
      }
      for (const [t, opp] of [[g.home, g.away], [g.away, g.home]]) {
        /* a new season carries half of what a club allowed last season */
        const a = allowed[opp] = allowed[opp] || { m: 0, y: zeros(), season: g.season };
        if (a.season !== g.season) { a.m *= 0.5; for (const k of STATS) a.y[k] *= 0.5; a.season = g.season; }
        const d = Math.pow(0.5, 1 / OPP_H); let m = 0; const y = zeros();
        for (const r of boxes[g.game_id][t]) { if (r.min <= 0 || r.dnp) continue; m += r.min; for (const k of STATS) y[k] += r.y[k]; }
        a.m = a.m * d + m; for (const k of STATS) a.y[k] = a.y[k] * d + y[k];
        const dl = Math.pow(0.5, 1 / (OPP_H * 15)); lgAll.m = lgAll.m * dl + m; for (const k of STATS) lgAll.y[k] = lgAll.y[k] * dl + y[k];
      }
      pace[g.home] += 0.1 * (pc[g.home] - pace[g.home]); pace[g.away] += 0.1 * (pc[g.away] - pace[g.away]);
      if (g.type !== 'POST') lgPace += 0.005 * ((pc[g.home] + pc[g.away]) / 2 - lgPace);
      lastFinal = date;
    }
  }
  return { rows, players, pace, lgPace, lgPos, seasonOfTeam, lastFinal, getP, allowed, lgAll };
}
/* a club's defence on each stat: what its opponents made per minute over the league's, shrunk toward 1 by OPP_SHRINK
   minutes of an average defence */
const OPP_H = 20, OPP_SHRINK = 2400;
function oppFactor(a, lg) {
  const f = {};
  for (const k of STATS) { const lr = lg.m ? lg.y[k] / lg.m : 0; f[k] = a && lr > 0 ? ((a.y[k] + OPP_SHRINK * lr) / (a.m + OPP_SHRINK)) / lr : 1; }
  return f;
}

/* ---------- distributions (no dependencies: the page carries nbSf and nbVar line for line) ---------- */
/* the variance of a stat with mean mu: A x mu^B, the constants fitted per stat (var in props.json) */
const nbVar = (mu, ab) => ab[0] * Math.pow(Math.max(mu, 1e-9), ab[1]);
/* P(Y = 0..kmax) for a negative binomial with mean mu and variance v (Poisson where v is not above mu) */
function nbPmf(kmax, mu, v) {
  const out = new Array(kmax + 1).fill(0);
  if (!(mu > 0)) { out[0] = 1; return out; }
  if (v <= mu * 1.000001) {
    let p = Math.exp(-mu); out[0] = p;
    for (let j = 1; j <= kmax; j++) { p *= mu / j; out[j] = p; }
    return out;
  }
  const r = mu * mu / (v - mu), q = mu / (r + mu);            // q = 1 - p, p = r / (r + mu)
  let p = Math.exp(r * Math.log(1 - q)); out[0] = p;
  for (let j = 1; j <= kmax; j++) { p *= (j - 1 + r) / j * q; out[j] = p; }
  return out;
}
/* P(Y >= k) */
function nbSf(k, mu, v) {
  if (k <= 0) return 1;
  const pm = nbPmf(k - 1, mu, v);
  let c = 0; for (const x of pm) c += x;
  return Math.min(1, Math.max(0, 1 - c));
}
/* P(over a line): a half line's over is reaching floor(line) + 1; on a whole line that many is a push, so the over
   is reaching line + 1 and the chance shown is of the over among over and under */
function pOver(line, mu, v) {
  if (line === Math.floor(line)) { const over = nbSf(line + 1, mu, v), push = nbSf(line, mu, v) - over; return push < 1 ? over / (1 - push) : 0.5; }
  return nbSf(Math.floor(line) + 1, mu, v);
}
/* log Gamma (Lanczos, g = 7) and the negative binomial's log pmf, for the fit */
const LG = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
function lgamma(x) {
  if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
  x -= 1; let a = LG[0]; const t = x + 7.5;
  for (let i = 1; i < 9; i++) a += LG[i] / (x + i);
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}
function nbLogPmf(y, mu, v) {
  mu = Math.max(mu, 1e-6);
  if (v <= mu * 1.000001) return y * Math.log(mu) - mu - lgamma(y + 1);
  const r = mu * mu / (v - mu);
  return lgamma(y + r) - lgamma(r) - lgamma(y + 1) + r * Math.log(r / (r + mu)) + y * Math.log(mu / (r + mu));
}
/* the standard normal: cdf (W. J. Cody's erfc, double precision) and its inverse (Acklam, refined by one Newton step) */
function normCdf(x) {
  const z = Math.abs(x) / Math.SQRT2, t = 1 / (1 + 0.5 * z);
  const e = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  return x >= 0 ? 1 - e / 2 : e / 2;
}
function normInv(p) {
  if (p <= 0) return -8; if (p >= 1) return 8;
  const a = [-39.69683028665376, 220.9460984245205, -275.9285104469687, 138.357751867269, -30.66479806614716, 2.506628277459239];
  const b = [-54.47609879822406, 161.5858368580409, -155.6989798598866, 66.80131188771972, -13.28068155288572];
  const c = [-0.007784894002430293, -0.3223964580411365, -2.400758277161838, -2.549732539343734, 4.374664141464968, 2.938163982698783];
  const d = [0.007784695709041462, 0.3224671290700398, 2.445134137142996, 3.754408661907416];
  let x;
  if (p < 0.02425) { const q = Math.sqrt(-2 * Math.log(p)); x = (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else if (p > 1 - 0.02425) { const q = Math.sqrt(-2 * Math.log(1 - p)); x = -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1); }
  else { const q = p - 0.5, r = q * q; x = (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1); }
  const e = normCdf(x) - p; x -= e * Math.sqrt(2 * Math.PI) * Math.exp(x * x / 2);
  return Math.max(-8, Math.min(8, x));
}
/* E[f(Z)] for Z standard normal, by the trapezoid rule on [-5, 5] in steps of 0.25: for a smooth integrand against the
   normal density it is exact to far below anything shown */
const QUAD = (() => { const nodes = [], weights = []; let s = 0;
  for (let i = 0; i <= 40; i++) { const z = -5 + 0.25 * i, w = Math.exp(-z * z / 2); nodes.push(z); weights.push(w); s += w; }
  return { nodes, weights: weights.map(w => w / s) }; })();
/* double-double and triple-double: P(at least 2, at least 3 of the five reach 10), the five negative binomials joined by
   a one-factor Gaussian copula (each stat reaches 10 when its normal score passes the threshold its own P(>= 10) sets) */
const DD_STATS = ['pts', 'reb', 'ast', 'stl', 'blk'];
function doublesProb(mu, V, rho) {
  const p10 = DD_STATS.map(k => nbSf(10, mu[k], nbVar(mu[k], V[k])));
  if (p10.every(p => p < 1e-9)) return { dd: 0, td: 0 };
  const thr = p10.map(p => normInv(1 - p)), s = Math.sqrt(rho), c = Math.sqrt(1 - rho);
  let dd = 0, td = 0;
  const { nodes, weights } = QUAD;
  for (let i = 0; i < nodes.length; i++) {
    const z = nodes[i];
    /* the count of stats past 10 given the shared factor: a Poisson-binomial over the five */
    let pr = [1, 0, 0, 0, 0, 0];
    for (let j = 0; j < 5; j++) {
      const q = rho ? 1 - normCdf((thr[j] - s * z) / c) : p10[j];
      const nx = [0, 0, 0, 0, 0, 0];
      for (let m = 0; m <= j; m++) { nx[m] += pr[m] * (1 - q); nx[m + 1] += pr[m] * q; }
      pr = nx;
    }
    const w = weights[i];
    dd += w * (1 - pr[0] - pr[1]); td += w * (1 - pr[0] - pr[1] - pr[2]);
  }
  return { dd: Math.min(1, Math.max(0, dd)), td: Math.min(1, Math.max(0, td)) };
}

/* ---------- the model's pieces ---------- */
const ewMean = (arr, h) => { if (!arr.length) return [0, 0]; const d = Math.pow(0.5, 1 / h); let w = 0, s = 0, ww = 1; for (let i = arr.length - 1; i >= 0; i--) { s += ww * arr[i]; w += ww; ww *= d; } return [s / w, w]; };
const priorMin = (f, minN) => f.prevN >= minN ? f.prevMean : f.last20 != null ? f.last20 : f.prevMean != null ? f.prevMean : 12;
function baseMin(f, M) { const p = priorMin(f, M.minN); const [m, w] = ewMean(f.cur, M.h); return (w * m + M.w0 * p) / (w + M.w0); }
/* one side's minutes: list of { b, avail } -> the scale every player's b is multiplied by */
function sideScale(list, M) {
  let S = 0; for (const x of list) if (x.avail && x.b >= M.floor) S += x.b;
  return S > 0 ? Math.pow(M.T / S, M.alpha) : 1;
}
function finalMin(b, scale, post, M) { let m = b * scale; if (post) m += M.post * (m - 24); return Math.max(0, Math.min(MAX_MIN, m)); }
const rateOf = (f, k, R) => (f.acc[R.h].y[k] + R.m * f.posRate[k]) / (f.acc[R.h].m + R.m);
const paceOf = (f, expPace, gamma) => f.pace && gamma ? Math.pow(expPace / f.pace, gamma) : 1;
/* every mean for one player in one game */
function means(f, m, expPace, post, P, oppF) {
  const pf = paceOf(f, expPace, P.gamma), mu = {};
  for (const k of STATS) mu[k] = m * rateOf(f, k, P.rate[k]) * pf * (post ? P.post[k] : 1) * (oppF && P.opp ? Math.pow(oppF[k], P.opp[k]) : 1);
  for (const [c, parts] of Object.entries(COMBOS)) mu[c] = parts.reduce((s, k) => s + mu[k], 0);
  return mu;
}

/* ---------- applying a set of constants to the backtest rows ---------- */
function sidesOf(rows) { const s = new Map(); rows.forEach((r, i) => { if (!s.has(r.sideKey)) s.set(r.sideKey, []); s.get(r.sideKey).push(i); }); return s; }
/* every row's projected minutes under M: b, the side's scale from its available rotation, the playoff stretch */
function backtestMinutes(rows, sides, M, sel) {
  const out = new Float64Array(rows.length).fill(NaN);
  for (const idx of sides.values()) {
    if (sel && !sel(rows[idx[0]])) continue;
    const list = idx.map(i => { const b = baseMin(rows[i].f, M); return { b, avail: rows[i].played || b < CUT }; });
    const sc = sideScale(list, M);
    idx.forEach((i, j) => { out[i] = finalMin(list[j].b, sc, rows[i].type === 'POST', M); });
  }
  return out;
}

/* ---------- the fit: every constant on the rows of the training seasons ---------- */
function fitVar(pairs) {
  /* pairs: [mu, y]. B from the slope of the binned log variance on the log mean, then A and B by maximum likelihood
     on a grid around it */
  const pts = pairs.filter(p => p[0] > 0.02).sort((a, b) => a[0] - b[0]);
  const nb = 20, xs = [], ys = [];
  for (let i = 0; i < nb; i++) {
    const ch = pts.slice(Math.floor(i * pts.length / nb), Math.floor((i + 1) * pts.length / nb)); if (!ch.length) continue;
    const m = ch.reduce((s, c) => s + c[0], 0) / ch.length, v = ch.reduce((s, c) => s + (c[1] - c[0]) ** 2, 0) / ch.length;
    if (m > 0 && v > 0) { xs.push(Math.log(m)); ys.push(Math.log(v)); }
  }
  const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
  const b0 = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0);
  const a0 = Math.exp(my - b0 * mx);
  const sub = pts.filter((_, i) => i % 2 === 0);
  const ll = (A, B) => { let s = 0; for (const [mu, y] of sub) s += nbLogPmf(y, mu, A * Math.pow(mu, B)); return s; };
  let best = { A: a0, B: b0, ll: -Infinity };
  for (let db = -0.3; db <= 0.3001; db += 0.1) {
    const B = b0 + db;
    let lo = Math.log(a0) - 1.5, hi = Math.log(a0) + 1.5;
    for (let it = 0; it < 30; it++) { const m1 = lo + (hi - lo) * 0.382, m2 = lo + (hi - lo) * 0.618; if (ll(Math.exp(m1), B) > ll(Math.exp(m2), B)) hi = m2; else lo = m1; }
    const A = Math.exp((lo + hi) / 2), v = ll(A, B);
    if (v > best.ll) best = { A, B, ll: v };
  }
  return [r4(best.A), r4(best.B)];
}
function fit(rows, trainSel, log = L.log) {
  const sides = sidesOf(rows);
  const tr = rows.map((r, i) => i).filter(i => trainSel(rows[i]));
  const trP = tr.filter(i => rows[i].played);
  /* 1. the minutes: b's half-life, prior weight and prior rule, on the played rows' absolute error */
  const ewc = {}; for (const h of GRID.minH) ewc[h] = new Map(trP.map(i => [i, ewMean(rows[i].f.cur, h)]));
  let M = null;
  for (const h of GRID.minH) for (const w0 of GRID.minW0) for (const minN of GRID.minN) {
    let s = 0;
    for (const i of trP) { const [m, w] = ewc[h].get(i); const b = (w * m + w0 * priorMin(rows[i].f, minN)) / (w + w0); s += Math.abs(b - rows[i].min); }
    if (!M || s < M.err) M = { h, w0, minN, err: s };
  }
  M = { h: M.h, w0: M.w0, minN: M.minN, alpha: 0, T: 240, floor: 8, post: 0 };
  /* 2. the side's scale toward a full game, on the regular season */
  const err = (MM, onlyPost) => { const mm = backtestMinutes(rows, sides, MM, r => trainSel(r) && (onlyPost ? r.type === 'POST' : true)); let s = 0, n = 0; for (const i of trP) { if (onlyPost && rows[i].type !== 'POST') continue; s += Math.abs(mm[i] - rows[i].min); n++; } return n ? s / n : 0; };
  let best = null;
  for (const alpha of GRID.alpha) for (const T of GRID.T) for (const floor of GRID.floor) { const e = err({ ...M, alpha, T, floor }); if (!best || e < best.e) best = { alpha, T, floor, e }; }
  Object.assign(M, { alpha: best.alpha, T: best.T, floor: best.floor });
  /* 3. the playoff stretch, on the playoffs */
  best = null; for (const post of GRID.post) { const e = err({ ...M, post }, true); if (!best || e < best.e) best = { post, e }; }
  M.post = best.post;
  const mins = backtestMinutes(rows, sides, M, trainSel);
  const minErr = err(M);
  log(`  minutes: half-life ${M.h}, prior worth ${M.w0} (whole last season from ${M.minN} games), scale (T ${M.T} / S over ${M.floor}+)^${M.alpha}, playoffs +${M.post}(m - 24): error ${minErr.toFixed(3)}`);
  /* 4. each stat's rate: half-life and shrinkage, squared error of the mean */
  const rate = {};
  for (const k of STATS) {
    let b2 = null;
    for (const h of H_SET) for (const m of GRID.rateM) {
      let s = 0; for (const i of trP) { const r = rows[i]; const mu = mins[i] * rateOf(r.f, k, { h, m }); s += (mu - r.y[k]) ** 2; }
      if (!b2 || s < b2.s) b2 = { h, m, s };
    }
    rate[k] = { h: b2.h, m: b2.m };
  }
  /* 5. the pace exponent: one for every stat, on the squared errors each scaled by its stat's variance */
  const vy = {}; for (const k of STATS) { const ys = trP.map(i => rows[i].y[k]); const mm = ys.reduce((a, b) => a + b, 0) / ys.length; vy[k] = ys.reduce((s, y) => s + (y - mm) ** 2, 0) / ys.length; }
  let gb = null;
  for (const gamma of GRID.gamma) {
    let s = 0; for (const i of trP) { const r = rows[i]; const pf = paceOf(r.f, r.expPace, gamma); for (const k of STATS) s += (mins[i] * rateOf(r.f, k, rate[k]) * pf - r.y[k]) ** 2 / vy[k]; }
    if (!gb || s < gb.s) gb = { gamma, s };
  }
  const gamma = gb.gamma;
  /* 6. the opponent's defence on each stat: an exponent per stat, on the squared error */
  const opp = {};
  for (const k of STATS) {
    let ob = null;
    for (const e of GRID.opp) { let s = 0; for (const i of trP) { const r = rows[i]; s += (mins[i] * rateOf(r.f, k, rate[k]) * paceOf(r.f, r.expPace, gamma) * Math.pow(r.oppF[k], e) - r.y[k]) ** 2; } if (!ob || s < ob.s) ob = { e, s }; }
    opp[k] = ob.e;
  }
  /* 7. the playoffs: what happened over what this projected, per stat */
  const post = {};
  for (const k of STATS) { let sy = 0, sm = 0; for (const i of trP) { const r = rows[i]; if (r.type !== 'POST') continue; sy += r.y[k]; sm += mins[i] * rateOf(r.f, k, rate[k]) * paceOf(r.f, r.expPace, gamma) * Math.pow(r.oppF[k], opp[k]); } post[k] = sm > 0 ? r4(sy / sm) : 1; }
  const P = { min: M, rate, gamma, opp, post, var: {}, rho: 0 };
  /* 8. the spreads, per stat and per combo on its own results */
  const mus = new Map(trP.map(i => [i, means(rows[i].f, mins[i], rows[i].expPace, rows[i].type === 'POST', P, rows[i].oppF)]));
  for (const k of ALL) P.var[k] = fitVar(trP.map(i => [mus.get(i)[k], k in COMBOS ? COMBOS[k].reduce((s, c) => s + rows[i].y[c], 0) : rows[i].y[k]]));
  /* 9. the copula's correlation, on the double- and triple-doubles (players with a real chance of one) */
  const dd = trP.filter(i => Math.max(mus.get(i).pts, mus.get(i).reb, mus.get(i).ast) >= 5);
  let rb = null;
  for (const rho of GRID.rho) {
    let s = 0;
    for (const i of dd) { const q = doublesProb(mus.get(i), P.var, rho), c = doubles(rows[i].y); const a = Math.min(Math.max(q.dd, 1e-6), 1 - 1e-6), b = Math.min(Math.max(q.td, 1e-6), 1 - 1e-6); s -= (c >= 2 ? Math.log(a) : Math.log(1 - a)) + (c >= 3 ? Math.log(b) : Math.log(1 - b)); }
    if (!rb || s < rb.s) rb = { rho, s };
  }
  P.rho = rb.rho;
  log(`  rates ${STATS.map(k => `${k} ${rate[k].h}/${rate[k].m}`).join(', ')}; pace^${gamma}; opponent ${STATS.map(k => `${k} ${opp[k]}`).join(', ')}; playoffs ${STATS.map(k => `${k} ${post[k]}`).join(', ')}; rho ${P.rho}`);
  return P;
}

/* ---------- scoring a season: the model against the naive own average ---------- */
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const yOf = (y, k) => k in COMBOS ? COMBOS[k].reduce((s, c) => s + y[c], 0) : y[k];
function naiveMean(f, k) { if (k in COMBOS) { const parts = COMBOS[k].map(c => f.naive[c]); return parts.some(x => x == null) ? null : parts.reduce((a, b) => a + b, 0); } return f.naive[k]; }
function project(rows, P, sel) {
  const sides = sidesOf(rows);
  const mins = backtestMinutes(rows, sides, P.min, sel);
  const out = new Map();
  rows.forEach((r, i) => { if (!r.played || !sel(r)) return; out.set(i, { m: mins[i], mu: means(r.f, mins[i], r.expPace, r.type === 'POST', P, r.oppF) }); });
  return out;
}
function score(rows, P, NV, sel) {
  const pr = project(rows, P, sel);
  const S = {}, N = { n: 0 };
  for (const k of ALL) S[k] = { n: 0, mae: 0, maeN: 0, bias: 0, ls: 0, lsN: 0, llLine: 0, llLineN: 0, brLine: 0, brLineN: 0, rn: 0, rmae: 0, rmaeN: 0 };
  let minE = 0, minHub = 0, minN = 0, ddLL = 0, ddLLN = 0, tdLL = 0, tdLLN = 0, ddN = 0, ddHit = 0, ddP = 0, tdHit = 0, tdP = 0;
  for (const [i, x] of pr) {
    const r = rows[i];
    if (naiveMean(r.f, 'pts') == null) continue;      // both scored on the same rows: a player with a game this season or last
    N.n++;
    minE += Math.abs(x.m - r.min); minHub += Math.abs((r.f.hub || 12) - r.min); minN++;
    for (const k of ALL) {
      const y = yOf(r.y, k), mu = x.mu[k], nv = naiveMean(r.f, k), s = S[k];
      const v = nbVar(mu, P.var[k]), vn = nbVar(nv, NV[k]);
      s.n++; s.mae += Math.abs(mu - y); s.maeN += Math.abs(nv - y); s.bias += mu - y;
      if (x.m >= 20) { s.rn++; s.rmae += Math.abs(mu - y); s.rmaeN += Math.abs(nv - y); }   // the rotation, where DraftKings hangs its lines
      s.ls -= nbLogPmf(y, mu, v); s.lsN -= nbLogPmf(y, Math.max(nv, 0.01), vn);
      /* a line where a book would hang it, the player's own average to the half point below it: the chance of the over */
      const line = Math.floor(nv) + 0.5, o = y > line ? 1 : 0;
      const pm = clip(nbSf(Math.floor(line) + 1, mu, v)), pn = clip(nbSf(Math.floor(line) + 1, Math.max(nv, 0.01), vn));
      s.llLine -= o ? Math.log(pm) : Math.log(1 - pm); s.llLineN -= o ? Math.log(pn) : Math.log(1 - pn);
      s.brLine += (pm - o) ** 2; s.brLineN += (pn - o) ** 2;
    }
    const q = doublesProb(x.mu, P.var, P.rho), c = doubles(r.y);
    const nd = clip(r.f.naiveDD == null ? 0.05 : r.f.naiveDD), nt = clip(r.f.naiveTD == null ? 0.005 : r.f.naiveTD);
    ddLL -= c >= 2 ? Math.log(clip(q.dd)) : Math.log(1 - clip(q.dd)); ddLLN -= c >= 2 ? Math.log(nd) : Math.log(1 - nd);
    tdLL -= c >= 3 ? Math.log(clip(q.td)) : Math.log(1 - clip(q.td)); tdLLN -= c >= 3 ? Math.log(nt) : Math.log(1 - nt);
    ddN++; ddHit += c >= 2; ddP += q.dd; tdHit += c >= 3; tdP += q.td;
  }
  const out = { players: N.n, minutes: { mae: r2(minE / minN), hubRule: r2(minHub / minN) }, stats: {},
    doubles: { dd: { logloss: r4(ddLL / ddN), naive: r4(ddLLN / ddN), rate: r4(ddHit / ddN), said: r4(ddP / ddN) }, td: { logloss: r4(tdLL / ddN), naive: r4(tdLLN / ddN), rate: r4(tdHit / ddN), said: r4(tdP / ddN) } } };
  for (const k of ALL) { const s = S[k]; out.stats[k] = { n: s.n, mae: r2(s.mae / s.n), naiveMae: r2(s.maeN / s.n), bias: r2(s.bias / s.n), logScore: r4(s.ls / s.n), naiveLogScore: r4(s.lsN / s.n), lineLogloss: r4(s.llLine / s.n), naiveLineLogloss: r4(s.llLineN / s.n), lineBrier: r4(s.brLine / s.n), naiveLineBrier: r4(s.brLineN / s.n), rotation: { n: s.rn, mae: r2(s.rmae / s.rn), naiveMae: r2(s.rmaeN / s.rn) } }; }
  return out;
}
/* the naive baseline's spreads: the same fit on its own means */
function fitNaiveVar(rows, trainSel) {
  const V = {};
  const tr = rows.filter(r => r.played && trainSel(r) && naiveMean(r.f, 'pts') != null);
  for (const k of ALL) V[k] = fitVar(tr.map(r => [Math.max(naiveMean(r.f, k), 0.01), yOf(r.y, k)]));
  return V;
}


/* ---------- the market test: DraftKings' archived closing lines (data/props_<season>.csv) ---------- */
const F = require('./props_feed');
/* a seeded generator, so a bootstrap gives the same interval every run (mulberry32) */
function rng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/* paired bootstrap over games: groups = [[sum of differences, count]] one a game; the 5th and 95th percentiles of the
   resampled mean difference (sum over sum), to six decimals */
function bootCI(groups, nBoot = 10000, seed = 0) {
  if (!groups.length) return null;
  const R = rng(seed), means = new Float64Array(nBoot), n = groups.length;
  for (let b = 0; b < nBoot; b++) { let s = 0, c = 0; for (let j = 0; j < n; j++) { const g = groups[Math.floor(R() * n)]; s += g[0]; c += g[1]; } means[b] = c ? s / c : 0; }
  means.sort();
  const r6 = x => Math.round(x * 1e6) / 1e6;
  return [r6(means[Math.floor(0.05 * nBoot)]), r6(means[Math.floor(0.95 * nBoot)])];
}
/* one graded line: the model's chance, the market's fair chance, the result; shared with the ledger */
function gradeLine(line, over, under, mu, ab, y) {
  return { pModel: pOver(line, mu, nbVar(mu, ab)), pMarket: F.propFairOver(over, under), result: y > line ? 'over' : y < line ? 'under' : 'push' };
}
/* flat one-unit bets where the model's chance of a side beats the chance its price implies by `edge` (the margin left
   in), at the closing price; overs and unders apart */
function flatBets(lines, edge) {
  const out = { over: { bets: 0, won: 0, units: 0 }, under: { bets: 0, won: 0, units: 0 } };
  for (const x of lines) {
    if (x.result === 'push') continue;
    const eo = x.pModel - F.propImplied(x.over), eu = (1 - x.pModel) - F.propImplied(x.under);
    const side = eo >= edge && eo >= eu ? 'over' : eu >= edge ? 'under' : null;
    if (!side) continue;
    const price = side === 'over' ? x.over : x.under, b = out[side];
    b.bets++;
    if (x.result === side) { b.won++; b.units += price > 0 ? price / 100 : 100 / -price; } else b.units -= 1;
  }
  for (const b of Object.values(out)) { b.units = r2(b.units); b.roi = b.bets ? r4(b.units / b.bets) : null; }
  return out;
}
function marketScores(lines) {
  const o = x => x.result === 'over' ? 1 : 0;
  const ll = p => (x) => { const q = clip(p(x)); return o(x) ? -Math.log(q) : -Math.log(1 - q); };
  const br = p => (x) => (p(x) - o(x)) ** 2;
  const mult = x => F.propImplied(x.over) / (F.propImplied(x.over) + F.propImplied(x.under));
  const avg = f => lines.reduce((s, x) => s + f(x), 0) / lines.length;
  const byGame = (f, g) => { const m = new Map(); for (const x of lines) { const v = m.get(x.game) || [0, 0]; v[0] += f(x) - g(x); v[1]++; m.set(x.game, v); } return [...m.values()]; };
  const pm = x => x.pModel, pq = x => x.pMarket;
  return {
    lines: lines.length, games: new Set(lines.map(x => x.game)).size, overRate: r4(avg(o)), modelSaid: r4(avg(pm)), marketSaid: r4(avg(pq)),
    logloss: { model: r4(avg(ll(pm))), market: r4(avg(ll(pq))), marketMultiplicative: r4(avg(ll(mult))), diff: r4(avg(ll(pm)) - avg(ll(pq))), diffCi90: bootCI(byGame(ll(pm), ll(pq))) },
    brier: { model: r4(avg(br(pm))), market: r4(avg(br(pq))), diff: r4(avg(br(pm)) - avg(br(pq))), diffCi90: bootCI(byGame(br(pm), br(pq))) },
    guess: { lineMae: r2(avg(x => Math.abs(x.line - x.y))), modelMae: r2(avg(x => Math.abs(x.mu - x.y))), modelMinusLine: r2(avg(x => x.mu - x.line)) },
    flat: Object.fromEntries([0.03, 0.05, 0.08].map(e => [`edge${Math.round(e * 100)}`, flatBets(lines, e)])),
  };
}
function marketTest(rows, P, season, log = L.log, boxes = loadBoxes()) {
  const R = require('./props_record');
  const rec = R.readRecord(season);
  if (!rec.length) return null;
  const games = new Set(rec.map(r => r.game_id));
  const pr = project(rows, P, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(rows[i].game + '|' + rows[i].id, { x, r: rows[i] });
  /* who played, from the box scores themselves: a line on a player the box does not list (inactive) or lists as not
     playing is void, as DraftKings voids it; one on a player who played and has no projection (no game on record
     before) is counted apart */
  const played = new Set();
  for (const gid of games) for (const side of Object.values(boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
  const lines = []; let voids = 0, noCall = 0;
  for (const l of rec) {
    const k = l.game_id + '|' + l.player_id;
    if (!played.has(k)) { voids++; continue; }
    const a = at.get(k);
    if (!a) { noCall++; continue; }
    const mu = a.x.mu[l.stat], y = yOf(a.r.y, l.stat);
    const g = gradeLine(l.line, l.over, l.under, mu, P.var[l.stat], y);
    lines.push({ game: l.game_id, stat: l.stat, line: l.line, over: l.over, under: l.under, mu, y, ...g });
  }
  const graded = lines.filter(x => x.result !== 'push');
  const out = { season, voids, noProjection: noCall, all: marketScores(graded), byStat: {} };
  for (const k of ALL) { const sub = graded.filter(x => x.stat === k); if (sub.length) { const m = marketScores(sub); out.byStat[k] = { lines: m.lines, overRate: m.overRate, modelSaid: m.modelSaid, marketSaid: m.marketSaid, logloss: m.logloss, brier: m.brier, guess: m.guess }; } }
  log(`market test ${season}: ${graded.length} lines on ${out.all.games} games; log loss model ${out.all.logloss.model} DraftKings ${out.all.logloss.market}; Brier ${out.all.brier.model} vs ${out.all.brier.market}`);
  return out;
}

/* which way to take the margin out of a main line's two prices: eight methods scored on the record's graded lines */
function fairMethods(season, boxes = loadBoxes()) {
  const R = require('./props_record');
  const imp = F.propImplied;
  const power = (io, iu) => { let lo = 0.5, hi = 3; for (let i = 0; i < 60; i++) { const k = (lo + hi) / 2; if (io ** k + iu ** k > 1) lo = k; else hi = k; } return io ** ((lo + hi) / 2); };
  const shin = (io, iu) => { const S = io + iu, f = z => [io, iu].reduce((a, p) => a + (Math.sqrt(z * z + 4 * (1 - z) * p * p / S) - z) / (2 * (1 - z)), 0) - 1; let lo = 0, hi = 0.5; for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (f(m) > 0) lo = m; else hi = m; } const z = (lo + hi) / 2; return (Math.sqrt(z * z + 4 * (1 - z) * io * io / S) - z) / (2 * (1 - z)); };
  const M = { 'whole margin on the Over': (io, iu) => 1 - iu, power, additive: (io, iu) => io - (io + iu - 1) / 2, shin, multiplicative: (io, iu) => io / (io + iu),
    'whole margin on the longshot': (io, iu) => io < iu ? 1 - iu : io, 'whole margin on the favourite': (io, iu) => io >= iu ? 1 - iu : io, 'whole margin on the Under': (io) => io };
  const played = {}; for (const [gid, sides] of Object.entries(boxes)) for (const rows of Object.values(sides)) for (const r of rows) if (r.min > 0 && !r.dnp) played[gid + '|' + r.id] = r.y;
  const lines = [];
  for (const l of R.readRecord(season)) { const y = played[l.game_id + '|' + l.player_id]; if (!y) continue; const v = yOf(y, l.stat); if (v === l.line) continue; lines.push({ io: imp(l.over), iu: imp(l.under), o: v > l.line ? 1 : 0 }); }
  if (!lines.length) return null;
  const out = { season, lines: lines.length, overRate: r4(lines.reduce((s, x) => s + x.o, 0) / lines.length), methods: {} };
  for (const [k, f] of Object.entries(M)) { let ll = 0, br = 0, mp = 0; for (const x of lines) { const p = clip(f(x.io, x.iu)); ll -= x.o ? Math.log(p) : Math.log(1 - p); br += (p - x.o) ** 2; mp += p; } out.methods[k] = { logloss: r4(ll / lines.length), brier: r4(br / lines.length), meanFairOver: r4(mp / lines.length) }; }
  return out;
}

/* ---------- the walk-forward research ---------- */
function research(log = L.log) {
  const games = loadGames(), boxes = loadBoxes();
  const R = replay(games, boxes, loadTeamBoxes(), { collect: true, from: FIRST + 1 });
  const seasons = [...new Set(R.rows.map(r => r.season))].sort();
  const folds = [];
  let last = null;
  for (const S of seasons) {
    if (S < FIRST + 2) continue;                   // 2023 is the first season with a season before it to fit on
    log(`fold ${S}: fitting on ${FIRST + 1}-${S - 1}`);
    const train = r => r.season >= FIRST + 1 && r.season < S;
    const P = fit(R.rows, train, log);
    const NV = fitNaiveVar(R.rows, train);
    const sc = score(R.rows, P, NV, r => r.season === S);
    const fold = { season: S, role: S === FIRST + 2 ? 'development: the structure was chosen on this fold' : 'test', fitOn: `${FIRST + 1}-${S - 1}`, params: P, ...sc };
    const mk = marketTest(R.rows, P, S, log, boxes);
    if (mk) fold.market = mk;
    folds.push(fold); last = fold;
    log(`fold ${S}: minutes ${sc.minutes.mae} (game model's rule ${sc.minutes.hubRule}); points MAE ${sc.stats.pts.mae} (own average ${sc.stats.pts.naiveMae}), log score ${sc.stats.pts.logScore} (${sc.stats.pts.naiveLogScore})`);
  }
  const fair = [...new Set(folds.filter(f => f.market).map(f => f.season))].map(sn => fairMethods(sn, boxes)).filter(Boolean);
  const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'tools/props.js research: each season scored cold by constants fitted only on the seasons before it (2022 warms up), against the naive own average; and against DraftKings\' archived closing lines where the hub has them, with the eight ways of taking the margin out of their prices', folds, fair };
  fs.mkdirSync(path.dirname(RESEARCH), { recursive: true });
  fs.writeFileSync(RESEARCH, JSON.stringify(out, null, 1) + '\n');
  log(`${path.relative(L.ROOT, RESEARCH)} written`);
  return out;
}

/* ---------- live: who is available, and every projection for the games to come ---------- */
/* players.js makeLiveLineup's rule: a listed player is out of every game before his return date, an Out player out of
   the report's own day whatever it says, a suspension out; a player on two clubs' rosters belongs to the later read;
   a club whose roster answers under ten players falls back on whoever played for it last, within the last 400 days */
function availability(dir = DATA) {
  const read = f => { try { return JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')); } catch (e) { return null; } };
  const inj = read('injuries.json') || { teams: {} }, ros = read('rosters_espn.json');
  const OUTRE = /^out/i, SUSP = /^(suspended|suspension)/i;
  const owner = {};
  if (ros) { const at = t => (ros.asOf && ros.asOf[t]) || ros.date || '';
    for (const [t, list] of Object.entries(ros.teams || {})) for (const a of list || []) { if (!a.id) continue; if (owner[a.id] === undefined || at(t) > at(owner[a.id])) owner[a.id] = t; } }
  return (g, team, players) => {
    const isOut = x => { const st = x.status || ''; if (SUSP.test(st)) return true; return x.returns ? g.date < x.returns || (OUTRE.test(st) && g.date <= (inj.date || '')) : OUTRE.test(st); };
    const out = {}; for (const x of (inj.teams[team] || [])) if (isOut(x)) out[x.id] = x.status;
    let ids;
    if (ros && ros.teams && ros.teams[team] && ros.teams[team].length >= 10) ids = ros.teams[team].map(a => a.id).filter(id => owner[id] === team);
    else ids = Object.keys(players).filter(id => players[id].team === team && players[id].last >= L.addDays(g.date, -400));
    return { ids: ids.filter(id => !out[id]), out: ids.filter(id => out[id]).map(id => ({ id, status: out[id] })) };
  };
}
function liveProjections(R, P, games, now = new Date(), dir = DATA, horizon = HORIZON) {
  const today = L.etDate(now), nowIso = now.toISOString().slice(0, 16) + 'Z';
  const avail = availability(dir);
  const ahead = games.filter(g => g.status === 'scheduled' && g.type !== 'PRE' && g.date >= today && !(g.tip && g.tip <= nowIso));
  const days = [...new Set(ahead.map(g => g.date))].sort().slice(0, horizon);
  const up = ahead.filter(g => days.includes(g.date));
  const out = {};
  for (const g of up) {
    const post = g.type === 'POST';
    const paceOfTeam = t => R.seasonOfTeam[t] === g.season ? R.pace[t] : R.lgPace + EARLY_PACE;
    const expPace = (paceOfTeam(g.home) + paceOfTeam(g.away)) / 2;
    const oppAllowed = t => { const a = R.allowed[t]; if (!a || a.season === g.season) return a; return { m: a.m * 0.5, y: Object.fromEntries(STATS.map(k => [k, a.y[k] * 0.5])) }; };
    const sides = {};
    for (const [t, opp] of [[g.home, g.away], [g.away, g.home]]) {
      const av = avail(g, t, R.players);
      const list = [];
      for (const id of av.ids) {
        const p = R.players[id];
        if (!p || !p.n) continue;                  // no game on record: no projection
        rollSeason(p, g.season);
        const f = features(p, R.lgPos);
        list.push({ p, f, b: baseMin(f, P.min), avail: true });
      }
      /* a side dresses about 13: the backtest's sides had 13 available at the median (11 to 15 nearly always), so the
         live roster (training camp carries 20, a season roster 15 and its two-way players) counts its 13 with the most
         projected minutes toward the scale, as a box score's list does */
      list.sort((a, b) => b.b - a.b);
      const sc = sideScale(list.slice(0, LIVE_SIDE), P.min), oppF = oppFactor(oppAllowed(opp), R.lgAll);
      sides[t] = list.map(x => { const m = finalMin(x.b, sc, post, P.min); const mu = means(x.f, m, expPace, post, P, oppF); const d = doublesProb(mu, P.var, P.rho);
        return { id: x.p.id, name: x.p.name, pos: x.p.pos, min: r1(m), mu: Object.fromEntries(ALL.map(k => [k, r2(mu[k])])), dd: r4(d.dd), td: r4(d.td) }; })
        .filter(x => x.min >= MIN_SHOWN).sort((a, b) => b.min - a.min);
      sides[t + ':out'] = av.out;
    }
    out[g.game_id] = { date: g.date, tip: g.tip || '', type: g.type, away: g.away, home: g.home, pace: r1(expPace),
      players: { [g.away]: sides[g.away], [g.home]: sides[g.home] } };
  }
  return out;
}

/* ---------- the job's step ---------- */
function fitAll(rows, log = L.log) {
  const done = [...new Set(rows.filter(r => r.played).map(r => r.season))].sort();
  /* only finished seasons: the season in play (a season with a game still to come, or the calendar's) is never fitted on */
  const games = loadGames(), inPlay = Math.max(...games.filter(g => g.status !== 'final').map(g => g.season), 0);
  const fitSeasons = done.filter(s => s < inPlay || !inPlay);
  const from = FIRST + 1, to = fitSeasons[fitSeasons.length - 1];
  log(`fitting the props model on ${from}-${to}`);
  return { P: fit(rows, r => r.season >= from && r.season <= to, log), fitSeasons: `${from}-${to}` };
}
async function main() {
  const mode = process.argv[2] || '';
  if (mode === 'research') { research(); return; }
  /* 1. DraftKings' closing lines for the finals not read yet: the record (a failure here is logged, never fatal) */
  if (mode !== 'fit' && !process.env.NBA_PROPS_OFFLINE) {
    try { await require('./props_record').recordClosing({}); } catch (e) { L.log(`closing props: ${e.message}`); }
  }
  const games = loadGames();
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  let P = prev && prev.params, fitSeasons = prev && prev.fitSeasons;
  let R;
  const boxes = loadBoxes();
  if (mode === 'fit' || !P) {
    R = replay(games, boxes, loadTeamBoxes(), { collect: true, from: FIRST + 1 });
    ({ P, fitSeasons } = fitAll(R.rows));
  } else R = replay(games, boxes, loadTeamBoxes(), {});
  /* 2. the games to come */
  const now = process.env.NBA_NOW ? new Date(process.env.NBA_NOW) : new Date();
  const upcoming = liveProjections(R, P, games, now);
  /* 3. the shadow ledger: freeze what has started, grade what is final, call what is to come */
  /* the projections the page shows are the ledger's calls: when the ledger fails, props.json is left as it was (and the
     job puts every props file back), so the page never publishes projections the ledger did not take */
  try { require('./props_ledger').run({ upcoming, params: P, games, now, boxes }); }
  catch (e) { L.log(`ledger: ${e.message}; props.json is left as it was`); process.exitCode = 1; return; }
  const rs = fs.existsSync(RESEARCH) ? JSON.parse(fs.readFileSync(RESEARCH, 'utf8')) : null;
  const out = { name: 'NBA props model', onTrial: true, params: P, fitSeasons, asOf: R.lastFinal,
    distribution: 'negative binomial, variance A x mean^B (params.var); P(over a line) = P(stat >= floor(line) + 1); double- and triple-double by a one-factor Gaussian copula (params.rho)',
    fair: FAIR, research: rs ? summarizeResearch(rs) : null, upcoming };
  const same = prev && JSON.stringify({ ...prev, generated: undefined }) === JSON.stringify({ ...out, generated: undefined });
  out.generated = same ? prev.generated : now.toISOString().slice(0, 16) + 'Z';
  const body = JSON.stringify(out) + '\n';
  if (!prev || body !== fs.readFileSync(OUT, 'utf8')) fs.writeFileSync(OUT, body);
  L.log(`props.json: ${Object.keys(upcoming).length} games to come, ${Object.values(upcoming).reduce((n, g) => n + Object.values(g.players).reduce((a, l) => a + l.length, 0), 0)} player projections, fitted on ${fitSeasons}${same ? ', unchanged' : ''}`);
}
/* DraftKings' fair chances, as measured (README "Player props"): the page reads these */
const FAIR = {
  main: 'whole margin on the Over: fair Over = 1 - implied(Under), fair Under = implied(Under)',
  mainWhy: 'scored best of eight methods on the 11,395 archived closing lines graded (log loss 0.6788, multiplicative 0.6807; Overs hit 45.9% where an even split said 49.0%)',
  rung: { form: 'fair = implied - a between 30% and 70%, scaled toward 0 below 30% (implied x (1 - a/0.3)) and toward 1 above 70% (1 - (1 - implied) x (1 + a/0.3))',
    a: { pts: 0.061, reb: 0.068, ast: 0.068, tpm: 0.067, stl: 0.069, blk: 0.068, pra: 0.069, pr: 0.069, pa: 0.069 },
    measured: 'the "k+" rung at line + 0.5 against the main line\'s fair Over: 8,055 archived rungs, a median gap of 6.8 points (6.1 on points) in every price band from 30% to 70%; 6.8 again on opening night\'s 146' },
  yes: { form: 'fair = implied / c', c: { dd: 1.41, td: 2.0 },
    measured: 'calibrated on the archived playoff prices\' results: 1,027 double-double prices (11.9% happened where their prices said 16.8%) and 328 triple-double prices (5 happened: very thin)' },
  estimated: 'every fair chance but the main line\'s is an estimate from these measurements: mark it est.',
};
function summarizeResearch(rs) {
  return { generated: rs.generated, folds: rs.folds.map(f => ({ season: f.season, role: f.role, fitOn: f.fitOn, players: f.players, minutes: f.minutes,
    stats: Object.fromEntries(Object.entries(f.stats).map(([k, v]) => [k, { mae: v.mae, naiveMae: v.naiveMae, bias: v.bias, logScore: v.logScore, naiveLogScore: v.naiveLogScore }])),
    market: f.market ? { lines: f.market.all.lines, games: f.market.all.games, logloss: f.market.all.logloss, brier: f.market.all.brier, flat: f.market.all.flat } : null })) };
}
module.exports = { fairMethods, HORIZON, LIVE_SIDE, availability, liveProjections, research, marketTest, marketScores, flatBets, gradeLine, bootCI, rng, oppFactor, FAIR, rollSeason, STATS, COMBOS, ALL, H_SET, GRID, CUT, MIN_SHOWN, posOf, loadBoxes, loadTeamBoxes, gamePace, loadGames, replay, features, nbVar, nbPmf, nbSf, pOver, nbLogPmf, lgamma, normCdf, normInv, doublesProb, baseMin, sideScale, finalMin, means, backtestMinutes, sidesOf, fit, fitVar, score, fitNaiveVar, project, yOf, doubles, FIRST, DATA, OUT, RESEARCH };

if (require.main === module) main().catch(e => { console.error(e.stack || e.message || e); process.exit(1); });
