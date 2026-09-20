/* The NBA game model: Elo with margin of victory, home court, rest and altitude.
 *
 *   node nba-hub/tools/elo.js          replay nba-hub/data/games.csv with the params in nba-hub/model.json,
 *                                  write ratings, the holdout report and the upcoming slate's numbers
 *   node nba-hub/tools/elo.js fit      search the params on the fit seasons, then do the same
 *
 * Every team starts a season carried part way back to the mean. Before a game each side's rating is
 * adjusted for home court (none at a neutral site), altitude (Denver, Utah at home), a back to back
 * (played yesterday), three games in four nights, and three or more days off. The chance the home side
 * wins is the logistic of the adjusted difference; the spread is that difference over a fitted scale.
 * After a final the winner takes K times a margin multiplier (FiveThirtyEight's form) times the surprise.
 *
 * Fit seasons 2008-2022, holdout 2023-2025 (the first three seasons only warm the ratings up). The fit
 * is a coordinate search on log loss, one parameter at a time until nothing moves. It is deterministic:
 * the same games and the same grid give the same numbers, so a rerun on unchanged data is a no-op.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const MODEL = path.join(L.ROOT, 'nba-hub', 'model.json');
const MEAN = 1500;
const WARM_TO = 2007, FIT_TO = 2022;               // seasons <= WARM_TO warm up; WARM_TO < s <= FIT_TO fit; later = holdout
const ALT = new Set(['DEN', 'UTA']);
const DEFAULT = { K: 20, hfa: 90, carry: 0.75, b2b: 25, three4: 10, rest3: 10, alt: 20, scale: 28 };
const GRID = {
  K: [12, 14, 16, 18, 20, 22, 24, 26, 28, 30],
  hfa: [50, 60, 70, 80, 90, 100, 110, 120],
  carry: [0.5, 0.55, 0.6, 0.65, 0.7, 0.75, 0.8, 0.85, 0.9],
  b2b: [0, 10, 20, 30, 40, 50, 60],
  three4: [0, 5, 10, 15, 20, 30],
  rest3: [0, 5, 10, 15, 20, 30],
  alt: [0, 10, 20, 30, 40, 60, 80, 100, 120],
};

const daysBetween = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
const prob = d => 1 / (1 + Math.pow(10, -d / 400));

/* Situational adjustment for one side, from its recent dates (most recent last). */
function situ(P, dates, date, isHome, team, neutral) {
  let adj = 0;
  if (isHome && !neutral) { adj += P.hfa; if (ALT.has(team)) adj += P.alt; }
  const n = dates.length;
  if (n) {
    const rest = daysBetween(dates[n - 1], date);
    if (rest === 1) adj -= P.b2b;
    else if (rest >= 3 && rest <= 10) adj += P.rest3;    // a break longer than that is the All-Star week or the season start: no edge either way
    if (n >= 2 && daysBetween(dates[n - 2], date) <= 3) adj -= P.three4;
  }
  return adj;
}

/* Replay the table in date order. Returns ratings after the last final and, when collect is set, one
   record per final game with the pre-game numbers, plus the model's numbers for games not yet final. */
function replay(P, games, collect) {
  const elo = {}, dates = {}, seasonOf = {}, played = {}, lastDate = {};
  const recs = [], upcoming = {};
  for (const g of games) {
    for (const t of [g.home, g.away]) {
      if (elo[t] === undefined) { elo[t] = MEAN; dates[t] = []; played[t] = 0; }
      if (seasonOf[t] !== g.season) { seasonOf[t] = g.season; elo[t] = P.carry * elo[t] + (1 - P.carry) * MEAN; dates[t] = []; played[t] = 0; }
    }
    const neutral = g.neutral === 1 || g.neutral === '1';
    const rh = elo[g.home] + situ(P, dates[g.home], g.date, true, g.home, neutral);
    const ra = elo[g.away] + situ(P, dates[g.away], g.date, false, g.away, neutral);
    const d = rh - ra, pHome = prob(d);
    if (g.status !== 'final') { upcoming[g.game_id] = { pHome: +pHome.toFixed(4), spread: +(-d / P.scale).toFixed(1), eloHome: +elo[g.home].toFixed(1), eloAway: +elo[g.away].toFixed(1) }; continue; }
    const hs = +g.home_score, as = +g.away_score, mov = hs - as;
    if (collect) recs.push({ season: g.season, d, pHome, mov, home: g.home, away: g.away, date: g.date });
    const S = mov > 0 ? 1 : 0;
    const winDiff = mov > 0 ? d : -d;
    const mult = Math.pow(Math.abs(mov) + 3, 0.8) / (7.5 + 0.006 * winDiff);
    const delta = P.K * mult * (S - pHome);
    elo[g.home] += delta; elo[g.away] -= delta;
    for (const t of [g.home, g.away]) { dates[t].push(g.date); if (dates[t].length > 4) dates[t].shift(); played[t] += 1; lastDate[t] = g.date; }
  }
  return { elo, played, lastDate, recs, upcoming };
}

function score(recs, from, to) {
  let ll = 0, n = 0, right = 0, ae = 0, sd = 0, sm = 0;
  for (const r of recs) {
    if (r.season <= from || r.season > to) continue;
    const p = Math.min(Math.max(r.pHome, 1e-6), 1 - 1e-6), y = r.mov > 0 ? 1 : 0;
    ll -= y * Math.log(p) + (1 - y) * Math.log(1 - p); n++;
    if ((r.pHome >= 0.5) === (y === 1)) right++;
    sd += r.d * r.d; sm += r.d * r.mov;
  }
  const scale = sd ? sd / sm : DEFAULT.scale;                // least squares: mov = d / scale
  for (const r of recs) { if (r.season <= from || r.season > to) continue; ae += Math.abs(r.mov - r.d / scale); }
  return { n, logloss: ll / n, acc: right / n, mae: ae / n, scale };
}

function fit(games) {
  let P = { ...DEFAULT };
  const lossOf = p => score(replay(p, games, true).recs, WARM_TO, FIT_TO).logloss;
  let best = lossOf(P), moved = true, pass = 0;
  while (moved && pass < 6) {
    moved = false; pass++;
    for (const k of Object.keys(GRID)) {
      for (const v of GRID[k]) {
        if (v === P[k]) continue;
        const q = { ...P, [k]: v }, l = lossOf(q);
        if (l < best - 1e-7) { best = l; P = q; moved = true; }
      }
    }
    L.log(`fit pass ${pass}: logloss ${best.toFixed(5)} ${JSON.stringify(P)}`);
  }
  return P;
}

function main() {
  const games = L.readGames().filter(g => g.status === 'final' || g.status === 'scheduled' || g.status === 'live');
  games.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const prev = fs.existsSync(MODEL) ? JSON.parse(fs.readFileSync(MODEL, 'utf8')) : null;
  let P = prev ? { ...DEFAULT, ...prev.params } : { ...DEFAULT };
  if (process.argv[2] === 'fit') P = fit(games);
  const R = replay(P, games, true);
  const fitS = score(R.recs, WARM_TO, FIT_TO);
  P.scale = +fitS.scale.toFixed(2);                        // points per Elo point, from the fit seasons only
  const hold = score(R.recs, FIT_TO, 9999);
  const final = games.filter(g => g.status === 'final');
  const asOf = final.length ? final[final.length - 1].date : '';
  const seasonNow = final.length ? final[final.length - 1].season : null;
  const teams = {};
  for (const t of L.TEAMS) teams[t] = { elo: +(R.elo[t] || MEAN).toFixed(1), n: R.played[t] || 0, last: R.lastDate[t] || '' };
  const model = {
    name: 'NBA Elo',
    formula: 'Elo, K x margin multiplier ((|mov|+3)^0.8 / (7.5 + 0.006 x winner diff)), season carry toward 1500, home court, altitude, back to back, three in four, three days off',
    fitSeasons: `${WARM_TO + 1}-${FIT_TO}`, holdoutSeasons: `${FIT_TO + 1}-${Math.max(...final.map(g => g.season))}`,
    params: P,
    fit: { games: fitS.n, logloss: +fitS.logloss.toFixed(5), acc: +fitS.acc.toFixed(4), mae: +fitS.mae.toFixed(2) },
    holdout: { games: hold.n, logloss: +hold.logloss.toFixed(5), acc: +hold.acc.toFixed(4), mae: +hold.mae.toFixed(2) },
    asOf, season: seasonNow, games: final.length,
    teams,
    upcoming: R.upcoming,
  };
  /* an unchanged model keeps its timestamp, so a rerun on the same data commits nothing */
  const same = prev && JSON.stringify({ ...prev, generated: undefined }) === JSON.stringify({ ...model, generated: undefined });
  model.generated = same ? prev.generated : new Date().toISOString().slice(0, 16) + 'Z';
  const body = JSON.stringify(model, null, 1) + '\n';
  const before = prev ? fs.readFileSync(MODEL, 'utf8') : '';
  if (body !== before) fs.writeFileSync(MODEL, body);
  L.log(`model: ${final.length} finals through ${asOf} | fit ${fitS.n} games logloss ${fitS.logloss.toFixed(4)} acc ${(fitS.acc * 100).toFixed(1)}% mae ${fitS.mae.toFixed(2)} | holdout ${hold.n} games logloss ${hold.logloss.toFixed(4)} acc ${(hold.acc * 100).toFixed(1)}% mae ${hold.mae.toFixed(2)} | ${Object.keys(R.upcoming).length} upcoming | model.json ${body !== before ? 'written' : 'unchanged'}`);
  const top = Object.entries(teams).sort((a, b) => b[1].elo - a[1].elo).slice(0, 5).map(([t, v]) => `${t} ${v.elo}`).join(', ');
  L.log('top five: ' + top);
}
if (require.main === module) main();
module.exports = { replay, score, situ, prob, DEFAULT, WARM_TO, FIT_TO, MEAN };
