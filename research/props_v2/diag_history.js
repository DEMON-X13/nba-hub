/* The props model on past seasons: what can be measured without lines.
 *
 *   node research/props_v2/diag_history.js            the diagnosis; writes results/diag_history.json and
 *                                                      results/diag_history_tables.md (the tables diag_history.md quotes)
 *   node research/props_v2/diag_history.js --refit    fit the three folds' constants again instead of reading the cache
 *
 * Seasons 2022-2026 only. data/games.csv is cut to season <= 2026 before anything is read, and the box scores and team
 * boxes to those games, so no row, rate, pace or opponent figure of 2026-27 (season 2027) enters. Nothing is fitted here
 * but tools/props.js's own walk-forward fit (fit(), exported, unchanged): each test season 2024, 2025 and 2026 is
 * projected by constants fitted on the seasons before it (2023 on; 2022 warms the ratings up), exactly as
 * `node tools/props.js research` does, and those fitted constants are checked against the ones research/props.json
 * stores. A second view, "live", applies the constants on trial (props.json params, fitted on 2023-2026) to 2023-2026:
 * in sample, so only its shape is read, never a score.
 *
 * Measured, per stat and per group (projected-minutes tier, month, the season's first games, role changes):
 *   bias      mean of projection - actual, and the projection's sum over the actual's (each on the rows that played, as
 *             the walk-forward scores them: a player with a game this season or last)
 *   pieces    the same bias with the pace factor off (gamma 0), the opponent factor off, and with the actual minutes put
 *             in for the projected ones (mu x actual / projected: the rate alone)
 *   minutes   projected - actual, by tier and role change
 *   P(over)   at a line where a book would hang it, the player's own average floored plus a half (the walk-forward's
 *             line), and at the model's own mean floored plus a half: the chance said against what happened, by decile
 *   spread    the randomized PIT (F(y-1) + U x P(y), U from a seeded generator): its histogram in tenths, its mean, and
 *             the coverage of the central 50% and 80% intervals ([0.25, 0.75] and [0.1, 0.9] of the PIT)
 * Role changes, from the box scores in order (a team's games of one season):
 *   tmOut     a teammate who played 20+ minutes in the team's previous game does not play this one (absent from the
 *             box's list: inactive; or listed and not playing: a coach's decision, which the backtest counts available)
 *   ret       the player returns after missing 3+ of his team's games this season
 *   tmRet     a teammate returns after 3+ missed games who averaged 20+ minutes in his last five before
 *   newTeam   the player's previous appearance was for another club (this season or last)
 *   po        the player played in last season's playoffs (his pace history is playoff-heavy at a season's start)
 *   newbie    minutes the side's players with no game on record (a rookie's first game, a first call-up) played: they
 *             have no projection, so their minutes are outside the side's scale
 *   carry     a season's first ten team games, by how the player's last 15 regular-season games of last season compare
 *             with his whole last regular season, per minute (pts + reb + ast) and in minutes a game: the rates are
 *             weighted across the season break, so a season opens on last season's closing stretch
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');

const OUTD = path.join(__dirname, 'results');
const LAST = 2026;                        // nothing after the 2025-26 season is read
const FOLDS = [2024, 2025, 2026];
const REFIT = process.argv.includes('--refit');
const quiet = () => {};
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r3 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e3) / 1e3;
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

/* ---------- 1. the data, cut to 2022-2026 ---------- */
const games = PR.loadGames().filter(g => g.season <= LAST);
const gset = new Set(games.map(g => g.game_id));
const boxes = {}; for (const [k, v] of Object.entries(PR.loadBoxes())) if (gset.has(k)) boxes[k] = v;
const tbox = {}; for (const [k, v] of Object.entries(PR.loadTeamBoxes())) if (gset.has(k.split(':')[0])) tbox[k] = v;
if (Object.keys(boxes).some(k => !k.startsWith('202') || +k.slice(0, 4) > LAST)) throw new Error('a box score after 2026 was read');
log(`games ${games.length} (seasons ${games[0].season}-${games[games.length - 1].season}), box scores ${Object.keys(boxes).length}`);
const R = PR.replay(games, boxes, tbox, { collect: true, from: PR.FIRST + 1 });
const rows = R.rows;
if (rows.some(r => r.season > LAST)) throw new Error('a row after 2026');
log(`replay: ${rows.length} rows`);

/* ---------- 2. role changes, from the box scores in order ---------- */
const flags = new Map();                  // game|team|id -> flags
{
  const byDate = {}; for (const g of games) (byDate[g.date] = byDate[g.date] || []).push(g);
  const team = {};                        // t -> { season, idx, regN, prev: Map id->min (last game), lastIdx: Map id->idx }
  const pl = {};                          // id -> { lastTeam, lastSeason, mins: [] (last appearances), po: Set of seasons with a playoff game }
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
      /* who returns: played for this team earlier this season, missed 3+ of its games since */
      const retIds = new Map();
      for (const id of playedNow.keys()) {
        const j = T.lastIdx.get(id);
        if (j != null && idx - j - 1 >= 3) { const p = pl[id]; const m5 = p ? p.mins.slice(-5) : []; retIds.set(id, { missed: idx - j - 1, pre: m5.length ? m5.reduce((a, b) => a + b, 0) / m5.length : 0 }); }
      }
      /* minutes played by players with no game on record before this one: no projection, so outside the side's scale */
      let newbie = 0; for (const [id, mn] of playedNow) if (!pl[id]) newbie += mn;
      for (const r of list) {
        const p = pl[r.id];
        const ret = retIds.get(r.id);
        const tmRet = [...retIds].some(([id, x]) => id !== r.id && x.pre >= 20);
        flags.set(g.game_id + '|' + t + '|' + r.id, {
          regN: g.type === 'REG' ? regN : null, post: g.type === 'POST',
          tmOutAbs: outAbs > 0, tmOutDnp: outDnp > 0 && !outIds.has(r.id),
          ret: !!ret, missed: ret ? ret.missed : 0, tmRet,
          newTeam: !!(p && p.lastTeam && p.lastTeam !== t && p.lastSeason >= g.season - 1),
          po: !!(p && p.po.has(g.season - 1)), newbie,
        });
      }
      updates.push({ g, t, T, idx, regN, playedNow });
    }
    for (const u of updates) {
      u.T.idx = u.idx; u.T.regN = u.regN; u.T.prev = u.playedNow;
      for (const [id, mn] of u.playedNow) {
        u.T.lastIdx.set(id, u.idx);
        const p = pl[id] = pl[id] || { lastTeam: '', lastSeason: 0, mins: [], po: new Set() };
        p.lastTeam = u.t; p.lastSeason = u.g.season; p.mins.push(mn); if (p.mins.length > 5) p.mins.shift();
        if (u.g.type === 'POST') p.po.add(u.g.season);
      }
    }
  }
}

/* the closing stretch of each player's regular season against the whole of it: player|season -> ratios */
const carry = new Map();
{
  const seq = new Map();
  for (const g of games) { if (g.type !== 'REG' || g.status !== 'final' || !boxes[g.game_id]) continue;
    for (const side of Object.values(boxes[g.game_id])) for (const r of side) { if (r.min <= 0 || r.dnp) continue; const k = r.id + '|' + g.season; let a = seq.get(k); if (!a) seq.set(k, a = []); a.push([r.min, r.y.pts + r.y.reb + r.y.ast]); } }
  for (const [k, a] of seq) {
    if (a.length < 25) continue;
    const sum = (xs, j) => xs.reduce((s, x) => s + x[j], 0), late = a.slice(-15);
    carry.set(k, { rate: (sum(late, 1) / sum(late, 0)) / (sum(a, 1) / sum(a, 0)), min: (sum(late, 0) / late.length) / (sum(a, 0) / a.length) });
  }
}
const binR = x => x == null ? 'none' : x < 0.9 ? '<0.9' : x <= 1.1 ? '0.9-1.1' : '>1.1';

/* ---------- 3. the constants: the walk-forward folds (fit on the seasons before), and the ones on trial ---------- */
const CACHE = path.join(OUTD, 'fold_params.json');
let foldP = !REFIT && fs.existsSync(CACHE) ? JSON.parse(fs.readFileSync(CACHE, 'utf8')) : null;
if (!foldP || FOLDS.some(S => !foldP[S])) {
  foldP = {};
  for (const S of FOLDS) { log(`fitting fold ${S} on 2023-${S - 1}`); foldP[S] = PR.fit(rows, r => r.season >= PR.FIRST + 1 && r.season < S, quiet); }
  fs.mkdirSync(OUTD, { recursive: true });
  fs.writeFileSync(CACHE, JSON.stringify(foldP, null, 1) + '\n');
}
const stored = JSON.parse(fs.readFileSync(path.join(PR.RESEARCH), 'utf8'));
const sameAsStored = Object.fromEntries(FOLDS.map(S => { const f = stored.folds.find(x => x.season === S); return [S, !!f && JSON.stringify(f.params) === JSON.stringify(foldP[S])]; }));
log(`fold constants the same as research/props.json's: ${JSON.stringify(sameAsStored)}`);
const liveP = JSON.parse(fs.readFileSync(PR.OUT, 'utf8')).params;      // fitted on 2023-2026 (props.json fitSeasons)

/* ---------- 4. the measurements ---------- */
const naive = (f, k) => { if (k in PR.COMBOS) { const p = PR.COMBOS[k].map(c => f.naive[c]); return p.some(x => x == null) ? null : p.reduce((a, b) => a + b, 0); } return f.naive[k]; };
const tierOf = m => m < 8 ? '<8' : m < 15 ? '8-15' : m < 20 ? '15-20' : m < 25 ? '20-25' : m < 30 ? '25-30' : m < 35 ? '30-35' : '35+';
const TIERS = ['<8', '8-15', '15-20', '20-25', '25-30', '30-35', '35+'];
const MONTHS = { '10': 'Oct', '11': 'Nov', '12': 'Dec', '01': 'Jan', '02': 'Feb', '03': 'Mar', '04': 'Apr' };
const phaseOf = fl => fl.post ? 'POST' : fl.regN <= 5 ? 'g1-5' : fl.regN <= 10 ? 'g6-10' : fl.regN <= 20 ? 'g11-20' : fl.regN <= 41 ? 'g21-41' : 'g42+';
const PHASES = ['g1-5', 'g6-10', 'g11-20', 'g21-41', 'g42+', 'POST'];

function newAcc() { return { n: 0, err: 0, abs: 0, mu: 0, y: 0, eNoPace: 0, eNoOpp: 0, eActMin: 0, cN: 0, cP: 0, cO: 0, cLL: 0, mN: 0, mP: 0, mO: 0, pit: new Array(10).fill(0), u: 0, c50: 0, c80: 0, dec: Array.from({ length: 10 }, () => [0, 0, 0]) }; }
function newMin() { return { n: 0, err: 0, abs: 0, m: 0, a: 0 }; }
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);

/* first 121 regular-season games of each season by date: the trial's span (121 games, 21 October to 5 November) */
const first121 = new Set();
for (const S of [2023, 2024, 2025, 2026]) games.filter(g => g.season === S && g.type === 'REG' && g.status === 'final').slice(0, 121).forEach(g => first121.add(g.game_id));

function run(P, sel, label) {
  const pr = PR.project(rows, P, sel);
  const Pnp = { ...P, gamma: 0 }, Pno = { ...P, opp: null };
  const rand = PR.rng(12345);
  const A = new Map(), M = new Map(), G = new Map();       // group|stat -> acc; group -> minutes acc; per-game clusters for key bootstraps
  const acc = (g, k) => { const key = g + '|' + k; let a = A.get(key); if (!a) A.set(key, a = newAcc()); return a; };
  const macc = g => { let a = M.get(g); if (!a) M.set(g, a = newMin()); return a; };
  const gacc = (g, game) => { let m = G.get(g); if (!m) G.set(g, m = new Map()); let v = m.get(game); if (!v) m.set(game, v = { e: 0, n: 0, p: 0, o: 0, c: 0 }); return v; };
  let paceSum = {}, paceN = {};
  const RC = { shown: [], first121: [], octnov: [], decapr: [], post: [] };
  for (const [i, x] of pr) {
    const r = rows[i];
    if (naive(r.f, 'pts') == null) continue;               // as the walk-forward scores: a player with a game this season or last
    const fl = flags.get(r.game + '|' + r.team + '|' + r.id) || {};
    const month = r.type === 'POST' ? 'POST' : MONTHS[r.date.slice(5, 7)] || 'other';
    const tier = tierOf(x.m), phase = phaseOf(fl);
    const shown = x.m >= PR.MIN_SHOWN;
    const groups = ['all', 'tier:' + tier];
    if (shown) {
      groups.push('shown', 'month:' + month, 'phase:' + phase, 'season:' + r.season, 'season:' + r.season + ':' + (['Oct', 'Nov'].includes(month) ? 'OctNov' : r.type === 'POST' ? 'POST' : 'DecApr'));
      groups.push(['Oct', 'Nov'].includes(month) ? 'octnov' : r.type === 'POST' ? 'post' : 'decapr');
      if (first121.has(r.game)) groups.push('first121', 'first121:' + r.season);
      if (r.type === 'REG') groups.push('tierXearly:' + tier + ':' + (fl.regN <= 10 ? 'g1-10' : 'g11+'));
      if (fl.ret) groups.push('ret', 'ret:' + (fl.missed >= 10 ? '10+' : '3-9'));
      if (fl.tmOutAbs) groups.push('tmOutAbs', 'tmOutAbs:' + tier);
      if (fl.tmOutDnp) groups.push('tmOutDnp');
      if (fl.tmRet) groups.push('tmRet');
      if (fl.newTeam) groups.push('newTeam', 'newTeam:' + (r.f.nCur < 10 ? 'g1-10' : 'g11+'));
      if (r.type === 'REG') groups.push('po:' + (fl.po ? 'yes' : 'no') + ':' + (fl.regN <= 10 ? 'g1-10' : fl.regN <= 20 ? 'g11-20' : 'g21+'));
      if (r.type === 'REG') groups.push('newbie:' + (fl.newbie === 0 ? '0' : fl.newbie < 25 ? '1-24' : '25+') + ':' + (fl.regN <= 10 ? 'g1-10' : 'g11+'));
      if (r.type === 'REG' && fl.regN <= 20) { const c = carry.get(r.id + '|' + (r.season - 1)), ph = fl.regN <= 10 ? 'g1-10' : 'g11-20';
        groups.push('carryRate:' + binR(c && c.rate) + ':' + ph, 'carryMin:' + binR(c && c.min) + ':' + ph, 'carryRatePo:' + binR(c && c.rate) + ':' + (fl.po ? 'yes' : 'no') + ':' + ph); }
      if (r.type === 'REG') groups.push('nCur:' + (r.f.nCur < 5 ? '0-4' : r.f.nCur < 10 ? '5-9' : r.f.nCur < 20 ? '10-19' : '20+'));
      if (!fl.ret && !fl.tmOutAbs && !fl.tmOutDnp && !fl.tmRet && !fl.newTeam) groups.push('stable', 'stable:' + (r.type === 'POST' ? 'POST' : fl.regN <= 10 ? 'g1-10' : 'g11+'));
      const pf = r.f.pace && P.gamma ? Math.pow(r.expPace / r.f.pace, P.gamma) : 1;
      for (const g of ['month:' + month, 'phase:' + phase, 'po:' + (fl.po ? 'yes' : 'no') + ':' + phase]) { paceSum[g] = (paceSum[g] || 0) + pf; paceN[g] = (paceN[g] || 0) + 1; }
    }
    for (const g of groups) { const a = macc(g); a.n++; a.err += x.m - r.min; a.abs += Math.abs(x.m - r.min); a.m += x.m; a.a += r.min; }
    const post = r.type === 'POST';
    const muNp = PR.means(r.f, x.m, r.expPace, post, Pnp, r.oppF), muNo = PR.means(r.f, x.m, r.expPace, post, Pno, r.oppF);
    const am = x.m > 0 ? r.min / x.m : 0;
    for (const k of PR.ALL) {
      const mu = x.mu[k], y = PR.yOf(r.y, k), v = PR.nbVar(mu, P.var[k]);
      const nv = naive(r.f, k);
      const line = Math.floor(nv) + 0.5, o = y > line ? 1 : 0;
      const p = clip(PR.nbSf(Math.floor(line) + 1, mu, v));
      const lm = Math.floor(mu) + 0.5, om = y > lm ? 1 : 0, pm = PR.nbSf(Math.floor(lm) + 1, mu, v);
      const pmf = PR.nbPmf(y, mu, v); let F = 0; for (let j = 0; j < y; j++) F += pmf[j];
      const u = Math.min(1, Math.max(0, F + rand() * pmf[y]));
      for (const g of groups) {
        const a = acc(g, k);
        a.n++; a.err += mu - y; a.abs += Math.abs(mu - y); a.mu += mu; a.y += y;
        a.eNoPace += muNp[k] - y; a.eNoOpp += muNo[k] - y; a.eActMin += mu * am - y;
        a.cN++; a.cP += p; a.cO += o; a.cLL -= o ? Math.log(p) : Math.log(1 - p);
        const d = Math.min(9, Math.floor(p * 10)); a.dec[d][0]++; a.dec[d][1] += p; a.dec[d][2] += o;
        a.mN++; a.mP += pm; a.mO += om;
        if (RC[g] && k !== 'none') RC[g].push(Math.log(p / (1 - p)), o);
        a.pit[Math.min(9, Math.floor(u * 10))]++; a.u += u; if (u >= 0.25 && u <= 0.75) a.c50++; if (u >= 0.1 && u <= 0.9) a.c80++;
      }
      if (shown && (k === 'pts' || k === 'pra' || k === 'reb' || k === 'ast')) for (const g of ['octnov', 'decapr', 'first121', 'post']) if (groups.includes(g)) { const c = gacc(g + '|' + k, r.game); c.e += mu - y; c.n++; c.p += p; c.o += o; }
      if (shown) for (const g of ['octnov', 'decapr', 'first121', 'post']) if (groups.includes(g)) { const c = gacc(g + '|any', r.game); c.n++; c.p += p; c.o += o; c.e += mu - y; }
    }
  }
  /* the summaries */
  const out = { label, stats: {}, minutes: {}, pace: {}, boot: {}, recal: {} };
  out._rc = RC;
  for (const [g, xs] of Object.entries(RC)) if (xs.length) out.recal[g] = recal(xs);
  for (const [key, a] of A) {
    const [g, k] = [key.slice(0, key.lastIndexOf('|')), key.slice(key.lastIndexOf('|') + 1)];
    (out.stats[g] = out.stats[g] || {})[k] = { n: a.n, bias: r3(a.err / a.n), mae: r3(a.abs / a.n), ratio: r4(a.mu / a.y), meanMu: r3(a.mu / a.n), meanY: r3(a.y / a.n),
      biasNoPace: r3(a.eNoPace / a.n), biasNoOpp: r3(a.eNoOpp / a.n), biasActMin: r3(a.eActMin / a.n),
      over: { said: r4(a.cP / a.cN), happened: r4(a.cO / a.cN), logloss: r4(a.cLL / a.cN), deciles: a.dec.map(([n, p, o]) => n ? [n, r4(p / n), r4(o / n)] : [0, null, null]) },
      overAtMean: { said: r4(a.mP / a.mN), happened: r4(a.mO / a.mN) },
      pit: { hist: a.pit.map(c => r4(c / a.n)), mean: r4(a.u / a.n), cov50: r4(a.c50 / a.n), cov80: r4(a.c80 / a.n) } };
  }
  for (const [g, a] of M) out.minutes[g] = { n: a.n, bias: r3(a.err / a.n), mae: r3(a.abs / a.n), meanProj: r2(a.m / a.n), meanActual: r2(a.a / a.n) };
  for (const g of Object.keys(paceSum)) out.pace[g] = { n: paceN[g], meanFactor: r4(paceSum[g] / paceN[g]) };
  for (const [g, m] of G) {
    const grp = [...m.values()];
    out.boot[g] = { games: grp.length,
      bias: { est: r4(grp.reduce((s, v) => s + v.e, 0) / grp.reduce((s, v) => s + v.n, 0)), ci90: PR.bootCI(grp.map(v => [v.e, v.n]), 2000, 1) },
      saidMinusHappened: { est: r4(grp.reduce((s, v) => s + v.p - v.o, 0) / grp.reduce((s, v) => s + v.n, 0)), ci90: PR.bootCI(grp.map(v => [v.p - v.o, v.n]), 2000, 2) } };
  }
  return out;
}

const res = { generated: new Date().toISOString().slice(0, 16) + 'Z', seasons: '2022-2026 (2022 warms up; folds 2024-2026 walk-forward)', sameAsStored, foldParams: foldP, folds: {}, live: null };
for (const S of FOLDS) { log(`measuring fold ${S}`); res.folds[S] = run(foldP[S], r => r.season === S, `fold ${S} (fit 2023-${S - 1})`); }
log('measuring the walk-forward folds pooled');
/* pooled: each season's rows projected by its own fold's constants, merged by running each fold and summing is awkward,
   so the pooled view runs the three folds' rows through one pass each and adds the accumulators' raw sums */
res.pooled = pool(FOLDS.map(S => res.folds[S]));
res.pooled.recal = Object.fromEntries(Object.keys(res.folds[FOLDS[0]]._rc).map(g => [g, recal([].concat(...FOLDS.map(S => res.folds[S]._rc[g])))]));
for (const S of FOLDS) delete res.folds[S]._rc;
log('measuring the constants on trial, 2023-2026 (in sample)');
res.live = run(liveP, r => r.season >= 2023 && r.season <= LAST, 'constants on trial (fit 2023-2026), in sample');
delete res.live._rc;

/* the most a recalibration of P(over) could gain on these rows, measured in sample (a size, not a candidate): log loss
   as said, with the best shift of the logit (calibration in the large), and with the best shift and slope */
function recal(xs) {
  const n = xs.length / 2;
  const ll = (a, b) => { let s = 0; for (let i = 0; i < xs.length; i += 2) { const z = a + b * xs[i], q = 1 / (1 + Math.exp(-z)), qq = Math.min(Math.max(q, 1e-6), 1 - 1e-6); s -= xs[i + 1] ? Math.log(qq) : Math.log(1 - qq); } return s / n; };
  /* Newton on (a, b) for the logistic recalibration; b held at 1 for the shift alone */
  const fitAB = freeB => { let a = 0, b = 1;
    for (let it = 0; it < 30; it++) { let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
      for (let i = 0; i < xs.length; i += 2) { const x = xs[i], q = 1 / (1 + Math.exp(-(a + b * x))), r = q - xs[i + 1], w = q * (1 - q); ga += r; gb += r * x; haa += w; hab += w * x; hbb += w * x * x; }
      if (!freeB) { a -= ga / haa; continue; }
      const det = haa * hbb - hab * hab; a -= (hbb * ga - hab * gb) / det; b -= (haa * gb - hab * ga) / det; }
    return { a, b }; };
  const s1 = fitAB(false), s2 = fitAB(true);
  return { n, logloss: r4(ll(0, 1)), shift: { a: r3(s1.a), logloss: r4(ll(s1.a, 1)) }, shiftSlope: { a: r3(s2.a), b: r3(s2.b), logloss: r4(ll(s2.a, s2.b)) } };
}

/* pooling the summaries: weighted by n (biases, rates, coverages, deciles are all means over rows) */
function pool(list) {
  const out = { label: 'folds 2024-2026 pooled (each season by its own fold)', stats: {}, minutes: {}, pace: {} };
  const wavg = (xs, f) => { let s = 0, n = 0; for (const x of xs) { if (!x) continue; const v = f(x); if (v == null) continue; s += v * x.n; n += x.n; } return n ? s / n : null; };
  const groups = new Set(list.flatMap(o => Object.keys(o.stats)));
  for (const g of groups) {
    out.stats[g] = {};
    for (const k of PR.ALL) {
      const xs = list.map(o => o.stats[g] && o.stats[g][k]).filter(Boolean); if (!xs.length) continue;
      const n = xs.reduce((s, x) => s + x.n, 0);
      out.stats[g][k] = { n, bias: r3(wavg(xs, x => x.bias)), mae: r3(wavg(xs, x => x.mae)), ratio: r4(wavg(xs, x => x.meanMu) / wavg(xs, x => x.meanY)),
        meanMu: r3(wavg(xs, x => x.meanMu)), meanY: r3(wavg(xs, x => x.meanY)),
        biasNoPace: r3(wavg(xs, x => x.biasNoPace)), biasNoOpp: r3(wavg(xs, x => x.biasNoOpp)), biasActMin: r3(wavg(xs, x => x.biasActMin)),
        over: { said: r4(wavg(xs, x => x.over.said)), happened: r4(wavg(xs, x => x.over.happened)), logloss: r4(wavg(xs, x => x.over.logloss)),
          deciles: Array.from({ length: 10 }, (_, d) => { let nn = 0, sp = 0, so = 0; for (const x of xs) { const c = x.over.deciles[d]; if (c[0]) { nn += c[0]; sp += c[1] * c[0]; so += c[2] * c[0]; } } return nn ? [nn, r4(sp / nn), r4(so / nn)] : [0, null, null]; }) },
        overAtMean: { said: r4(wavg(xs, x => x.overAtMean.said)), happened: r4(wavg(xs, x => x.overAtMean.happened)) },
        pit: { hist: Array.from({ length: 10 }, (_, d) => r4(wavg(xs, x => x.pit.hist[d]))), mean: r4(wavg(xs, x => x.pit.mean)), cov50: r4(wavg(xs, x => x.pit.cov50)), cov80: r4(wavg(xs, x => x.pit.cov80)) } };
    }
  }
  for (const g of new Set(list.flatMap(o => Object.keys(o.minutes)))) {
    const xs = list.map(o => o.minutes[g]).filter(Boolean); const n = xs.reduce((s, x) => s + x.n, 0);
    out.minutes[g] = { n, bias: r3(wavg(xs, x => x.bias)), mae: r3(wavg(xs, x => x.mae)), meanProj: r2(wavg(xs, x => x.meanProj)), meanActual: r2(wavg(xs, x => x.meanActual)) };
  }
  for (const g of new Set(list.flatMap(o => Object.keys(o.pace)))) {
    const xs = list.map(o => o.pace[g]).filter(Boolean); const n = xs.reduce((s, x) => s + x.n, 0);
    out.pace[g] = { n, meanFactor: r4(xs.reduce((s, x) => s + x.meanFactor * x.n, 0) / n) };
  }
  return out;
}

/* the file keeps the deciles and the PIT's tenths for the main spans only, to stay small */
const KEEP_DETAIL = new Set(['all', 'shown', 'octnov', 'decapr', 'post', 'first121', ...TIERS.map(t => 'tier:' + t), ...PHASES.map(x => 'phase:' + x)]);
const slim = o => { for (const [g, st] of Object.entries(o.stats)) if (!KEEP_DETAIL.has(g)) for (const k of Object.keys(st)) { delete st[k].over.deciles; delete st[k].pit.hist; } };
fs.mkdirSync(OUTD, { recursive: true });
const resOut = JSON.parse(JSON.stringify(res)); [...Object.values(resOut.folds), resOut.pooled, resOut.live].forEach(slim);
/* a fold keeps its main spans and its season splits; every group is in the pooled view */
for (const o of Object.values(resOut.folds)) for (const part of ['stats', 'minutes']) for (const g of Object.keys(o[part])) if (!KEEP_DETAIL.has(g) && !g.startsWith('season:') && !g.startsWith('first121:') && !g.startsWith('month:')) delete o[part][g];
fs.writeFileSync(path.join(OUTD, 'diag_history.json'), JSON.stringify(resOut) + '\n');
log('results/diag_history.json written');

/* ---------- 5. the tables ---------- */
const T = [];
const pct = x => x == null ? '' : (100 * x).toFixed(1) + '%';
const sg = (x, d = 2) => x == null ? '' : (x >= 0 ? '+' : '') + x.toFixed(d);
const PO = res.pooled, LV = res.live;
const NAMES = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', tpm: 'Threes', stl: 'Steals', blk: 'Blocks', pra: 'Pts+reb+ast', pr: 'Pts+reb', pa: 'Pts+ast', ar: 'Ast+reb', sb: 'Stl+blk' };

T.push('## A. Bias (projection - actual) by stat and projected-minutes tier, folds 2024-2026 pooled', '');
T.push('| Stat | ' + TIERS.join(' | ') + ' | all 8+ |', '|---|' + TIERS.map(() => '---|').join('') + '---|');
for (const k of PR.ALL) T.push(`| ${NAMES[k]} | ` + TIERS.map(t => { const s = PO.stats['tier:' + t] && PO.stats['tier:' + t][k]; return s ? `${sg(s.bias)} (${s.ratio.toFixed(3)})` : ''; }).join(' | ') + ` | ${sg(PO.stats.shown[k].bias)} (${PO.stats.shown[k].ratio.toFixed(3)}) |`);
T.push('', 'Rows per tier: ' + TIERS.map(t => `${t} ${PO.stats['tier:' + t].pts.n}`).join(', ') + '. Each cell: mean bias (sum projected / sum actual).', '');

T.push('## B. Minutes: projected - actual, by tier and role change (pooled; rows projected 8+ unless the tier is under 8)', '');
T.push('| Group | rows | mean projected | mean actual | bias | MAE |', '|---|---|---|---|---|---|');
const MG = [...TIERS.map(t => 'tier:' + t), 'shown', 'phase:g1-5', 'phase:g6-10', 'phase:g11-20', 'phase:g21-41', 'phase:g42+', 'phase:POST', 'first121', 'nCur:0-4', 'nCur:5-9', 'nCur:10-19', 'nCur:20+', 'ret', 'ret:3-9', 'ret:10+', 'tmOutAbs', ...TIERS.slice(1).map(t => 'tmOutAbs:' + t), 'tmOutDnp', 'tmRet', 'newTeam', 'newTeam:g1-10', 'newTeam:g11+', 'stable', 'stable:g1-10', 'stable:g11+', 'stable:POST'];
for (const g of MG) { const m = PO.minutes[g]; if (m) T.push(`| ${g} | ${m.n} | ${m.meanProj} | ${m.meanActual} | ${sg(m.bias)} | ${m.mae.toFixed(2)} |`); }
T.push('');

const KEY = ['pts', 'reb', 'ast', 'tpm', 'pra'];
T.push('## C. Bias by month and season phase (rows projected 8+), pooled', '');
T.push('| Group | rows | minutes bias | ' + KEY.map(k => NAMES[k] + ' bias (ratio)').join(' | ') + ' | P(over) said | happened |', '|---|---|---|' + KEY.map(() => '---|').join('') + '---|---|');
const CG = ['month:Oct', 'month:Nov', 'month:Dec', 'month:Jan', 'month:Feb', 'month:Mar', 'month:Apr', 'month:POST', 'phase:g1-5', 'phase:g6-10', 'phase:g11-20', 'phase:g21-41', 'phase:g42+', 'first121', 'octnov', 'decapr'];
const overAll = (o, g) => { let n = 0, p = 0, h = 0; for (const k of PR.ALL) { const s = o.stats[g] && o.stats[g][k]; if (!s) continue; n += s.n; p += s.over.said * s.n; h += s.over.happened * s.n; } return n ? [p / n, h / n] : [null, null]; };
for (const g of CG) { const s = PO.stats[g]; if (!s) continue; const [p, h] = overAll(PO, g); T.push(`| ${g} | ${s.pts.n} | ${sg(PO.minutes[g].bias)} | ` + KEY.map(k => `${sg(s[k].bias)} (${s[k].ratio.toFixed(3)})`).join(' | ') + ` | ${pct(p)} | ${pct(h)} |`); }
T.push('', 'P(over) is at the walk-forward\'s book-like line (own average floored plus a half), every stat pooled.', '');

T.push('## D. Season by season: Oct-Nov against Dec-Apr against the playoffs (rows projected 8+)', '');
T.push('| Season | span | rows | minutes bias | points bias (ratio) | PRA bias | P(over) said | happened | said - happened |', '|---|---|---|---|---|---|---|---|---|');
for (const S of FOLDS) for (const sp of ['OctNov', 'DecApr', 'POST']) { const o = res.folds[S], g = 'season:' + S + ':' + sp, s = o.stats[g]; if (!s) continue; const [p, h] = overAll(o, g); T.push(`| ${S} | ${sp} | ${s.pts.n} | ${sg(o.minutes[g].bias)} | ${sg(s.pts.bias)} (${s.pts.ratio.toFixed(3)}) | ${sg(s.pra.bias)} | ${pct(p)} | ${pct(h)} | ${sg(100 * (p - h), 1)} pts |`); }
for (const S of FOLDS) { const o = res.folds[S], g = 'first121:' + S, s = o.stats[g]; if (!s) continue; const [p, h] = overAll(o, g); T.push(`| ${S} | first 121 games | ${s.pts.n} | ${sg(o.minutes[g].bias)} | ${sg(s.pts.bias)} (${s.pts.ratio.toFixed(3)}) | ${sg(s.pra.bias)} | ${pct(p)} | ${pct(h)} | ${sg(100 * (p - h), 1)} pts |`); }
T.push('');
T.push('Cluster bootstrap over games (2,000 resamples), folds pooled by running each fold: see results/diag_history.json `boot`; the constants on trial in sample:', '');
T.push('| View | span | points bias [90%] | P(over) said - happened, every stat [90%] |', '|---|---|---|---|');
for (const S of FOLDS) for (const sp of ['first121', 'octnov', 'decapr', 'post']) { const b = res.folds[S].boot; const bp = b[sp + '|pts'], ba = b[sp + '|any']; if (!ba) continue; T.push(`| fold ${S} | ${sp} | ${bp ? `${sg(bp.bias.est)} [${sg(bp.bias.ci90[0])}, ${sg(bp.bias.ci90[1])}]` : ''} | ${sg(100 * ba.saidMinusHappened.est, 2)} [${sg(100 * ba.saidMinusHappened.ci90[0], 2)}, ${sg(100 * ba.saidMinusHappened.ci90[1], 2)}] pts |`); }
for (const sp of ['first121', 'octnov', 'decapr', 'post']) { const b = LV.boot; const bp = b[sp + '|pts'], ba = b[sp + '|any']; if (!ba) continue; T.push(`| on trial, 2023-2026 | ${sp} | ${bp ? `${sg(bp.bias.est)} [${sg(bp.bias.ci90[0])}, ${sg(bp.bias.ci90[1])}]` : ''} | ${sg(100 * ba.saidMinusHappened.est, 2)} [${sg(100 * ba.saidMinusHappened.ci90[0], 2)}, ${sg(100 * ba.saidMinusHappened.ci90[1], 2)}] pts |`); }
T.push('');

T.push('## E. What drives the early bias: points, with each piece taken out (rows projected 8+, pooled)', '');
T.push('| Group | bias | pace off | opponent off | actual minutes in (rate only) | mean pace factor |', '|---|---|---|---|---|---|');
for (const g of ['phase:g1-5', 'phase:g6-10', 'phase:g11-20', 'phase:g21-41', 'phase:g42+', 'phase:POST', 'month:Oct', 'month:Nov', 'month:Dec']) { const s = PO.stats[g] && PO.stats[g].pts; if (!s) continue; const pc = PO.pace[g]; T.push(`| ${g} | ${sg(s.bias)} | ${sg(s.biasNoPace)} | ${sg(s.biasNoOpp)} | ${sg(s.biasActMin)} | ${pc ? pc.meanFactor.toFixed(4) : ''} |`); }
T.push('', 'By whether the player played in last season\'s playoffs (his pace history then leans on slower playoff games):', '');
T.push('| Group | rows | points bias | pace off | rate only | mean pace factor |', '|---|---|---|---|---|---|');
for (const po of ['yes', 'no']) for (const ph of ['g1-10', 'g11-20', 'g21+']) { const g = `po:${po}:${ph}`, s = PO.stats[g] && PO.stats[g].pts; if (!s) continue; const pk = Object.keys(PO.pace).filter(x => x.startsWith(`po:${po}:`) && (ph === 'g1-10' ? /g1-5|g6-10/.test(x) : ph === 'g11-20' ? /g11-20/.test(x) : /g21-41|g42\+/.test(x))); let n = 0, f = 0; for (const x of pk) { n += PO.pace[x].n; f += PO.pace[x].meanFactor * PO.pace[x].n; } T.push(`| last season's playoffs ${po}, ${ph} | ${s.n} | ${sg(s.bias)} | ${sg(s.biasNoPace)} | ${sg(s.biasActMin)} | ${n ? (f / n).toFixed(4) : ''} |`); }
T.push('');

T.push('## F. Role changes: bias by stat (rows projected 8+, pooled)', '');
T.push('| Group | rows | minutes bias | ' + KEY.map(k => NAMES[k]).join(' | ') + ' |', '|---|---|---|' + KEY.map(() => '---|').join(''));
for (const g of ['stable:g1-10', 'stable:g11+', 'stable:POST', 'ret:3-9', 'ret:10+', 'tmOutAbs', 'tmOutDnp', 'tmRet', 'newTeam:g1-10', 'newTeam:g11+']) { const s = PO.stats[g]; if (!s) continue; T.push(`| ${g} | ${s.pts.n} | ${sg(PO.minutes[g].bias)} | ` + KEY.map(k => `${sg(s[k].bias)} (${s[k].ratio.toFixed(3)})`).join(' | ') + ' |'); }
T.push('');

T.push('## G. P(over) at the book-like line: said against happened, by stat (rows projected 8+, pooled)', '');
T.push('| Stat | all: said / happened / log loss | Oct-Nov | Dec-Apr | playoffs | at the model\'s own mean: said / happened |', '|---|---|---|---|---|---|');
for (const k of PR.ALL) { const f = g => { const s = PO.stats[g][k]; return `${pct(s.over.said)} / ${pct(s.over.happened)}`; }; const s = PO.stats.shown[k]; T.push(`| ${NAMES[k]} | ${pct(s.over.said)} / ${pct(s.over.happened)} / ${s.over.logloss.toFixed(4)} | ${f('octnov')} | ${f('decapr')} | ${f('post')} | ${pct(s.overAtMean.said)} / ${pct(s.overAtMean.happened)} |`); }
T.push('', 'Deciles of the chance said (every stat pooled, rows projected 8+): n, mean said, happened', '');
T.push('| Decile | all | Oct-Nov | Dec-Apr | playoffs |', '|---|---|---|---|---|');
const decAll = (o, g) => Array.from({ length: 10 }, (_, d) => { let n = 0, p = 0, h = 0; for (const k of PR.ALL) { const c = o.stats[g][k].over.deciles[d]; if (c[0]) { n += c[0]; p += c[1] * c[0]; h += c[2] * c[0]; } } return n ? `${n}: ${pct(p / n)} / ${pct(h / n)}` : ''; });
const D = ['shown', 'octnov', 'decapr', 'post'].map(g => decAll(PO, g));
for (let d = 0; d < 10; d++) T.push(`| ${d * 10}-${d * 10 + 10}% | ${D.map(x => x[d]).join(' | ')} |`);
T.push('');

T.push('## H. The spread: randomized PIT (rows projected 8+, pooled). Calibrated: mean 0.5, each tenth 10%, coverage 50% and 80%', '');
T.push('| Stat | PIT mean | 50% interval | 80% interval | lowest tenth | highest tenth | tenths |', '|---|---|---|---|---|---|---|');
for (const k of PR.ALL) { const p = PO.stats.shown[k].pit; T.push(`| ${NAMES[k]} | ${p.mean.toFixed(3)} | ${pct(p.cov50)} | ${pct(p.cov80)} | ${pct(p.hist[0])} | ${pct(p.hist[9])} | ${p.hist.map(x => (100 * x).toFixed(1)).join(' ')} |`); }
T.push('', 'By projected-minutes tier, points and PRA (PIT mean, 50% and 80% coverage):', '');
T.push('| Tier | Points | PRA | Rebounds | Assists |', '|---|---|---|---|---|');
for (const t of TIERS) { const s = PO.stats['tier:' + t]; if (!s) continue; T.push(`| ${t} | ` + ['pts', 'pra', 'reb', 'ast'].map(k => { const p = s[k].pit; return `${p.mean.toFixed(3)}, ${pct(p.cov50)}, ${pct(p.cov80)}`; }).join(' | ') + ' |'); }
T.push('', 'By season phase, points and PRA:', '');
T.push('| Phase | Points | PRA |', '|---|---|---|');
for (const g of PHASES.map(x => 'phase:' + x)) { const s = PO.stats[g]; if (!s) continue; T.push(`| ${g} | ` + ['pts', 'pra'].map(k => { const p = s[k].pit; return `${p.mean.toFixed(3)}, ${pct(p.cov50)}, ${pct(p.cov80)}`; }).join(' | ') + ' |'); }
T.push('');

T.push('## I. The constants on trial (fit 2023-2026), in sample on 2023-2026: the same early-season reading', '');
T.push('| Group | rows | minutes bias | points bias (ratio) | PRA bias | P(over) said | happened |', '|---|---|---|---|---|---|---|');
for (const g of ['phase:g1-5', 'phase:g6-10', 'phase:g11-20', 'phase:g21-41', 'phase:g42+', 'phase:POST', 'first121', 'octnov', 'decapr']) { const s = LV.stats[g]; if (!s) continue; const [p, h] = overAll(LV, g); T.push(`| ${g} | ${s.pts.n} | ${sg(LV.minutes[g].bias)} | ${sg(s.pts.bias)} (${s.pts.ratio.toFixed(3)}) | ${sg(s.pra.bias)} | ${pct(p)} | ${pct(h)} |`); }
T.push('');
T.push('## J. A season\'s first games, by last season\'s closing stretch (rows projected 8+, pooled)', '');
T.push('Closing stretch: his last 15 regular-season games of last season against his whole last regular season (25+ games), per minute (pts+reb+ast) or in minutes a game. Rate only: the bias with his actual minutes put in.', '');
T.push('| Group | rows | minutes bias | points bias (ratio) | points, rate only | PRA bias (ratio) | PRA, rate only |', '|---|---|---|---|---|---|---|');
for (const kind of ['carryRate', 'carryMin']) for (const ph of ['g1-10', 'g11-20']) for (const b of ['<0.9', '0.9-1.1', '>1.1', 'none']) { const g = `${kind}:${b}:${ph}`, s = PO.stats[g]; if (!s) continue; T.push(`| ${kind === 'carryRate' ? 'per-minute ratio' : 'minutes ratio'} ${b}, ${ph} | ${s.pts.n} | ${sg(PO.minutes[g].bias)} | ${sg(s.pts.bias)} (${s.pts.ratio.toFixed(3)}) | ${sg(s.pts.biasActMin)} | ${sg(s.pra.bias)} (${s.pra.ratio.toFixed(3)}) | ${sg(s.pra.biasActMin)} |`); }
for (const po of ['yes', 'no']) for (const b of ['<0.9', '0.9-1.1', '>1.1']) { const g = `carryRatePo:${b}:${po}:g1-10`, s = PO.stats[g]; if (!s) continue; T.push(`| per-minute ratio ${b}, last season's playoffs ${po}, g1-10 | ${s.pts.n} | ${sg(PO.minutes[g].bias)} | ${sg(s.pts.bias)} (${s.pts.ratio.toFixed(3)}) | ${sg(s.pts.biasActMin)} | ${sg(s.pra.bias)} (${s.pra.ratio.toFixed(3)}) | ${sg(s.pra.biasActMin)} |`); }
T.push('');
T.push('## K. How much a recalibration of P(over) at the book-like line could gain, in sample (every stat, rows projected 8+)', '');
T.push('A size, not a candidate: the best logit shift (and shift and slope) fitted on the very rows it is scored on.', '');
T.push('| View | span | rows | log loss as said | best shift: a, log loss | best shift and slope: a, b, log loss |', '|---|---|---|---|---|---|');
for (const [lab, rc] of [['folds pooled', PO.recal], ...FOLDS.map(S => ['fold ' + S, res.folds[S].recal]), ['on trial, 2023-2026', LV.recal]]) for (const g of ['shown', 'first121', 'octnov', 'decapr', 'post']) { const x = rc[g]; if (!x) continue; T.push(`| ${lab} | ${g} | ${x.n} | ${x.logloss.toFixed(4)} | ${sg(x.shift.a, 3)}, ${x.shift.logloss.toFixed(4)} | ${sg(x.shiftSlope.a, 3)}, ${x.shiftSlope.b.toFixed(3)}, ${x.shiftSlope.logloss.toFixed(4)} |`); }
T.push('');
T.push('## L. Sides where players with no game on record played (a debut: no projection, outside the side\'s scale)', '');
T.push('| Group | rows | minutes bias | points bias (ratio) | points, rate only |', '|---|---|---|---|---|');
for (const ph of ['g1-10', 'g11+']) for (const b of ['0', '1-24', '25+']) { const g = `newbie:${b}:${ph}`, s = PO.stats[g]; if (!s) continue; T.push(`| debut minutes ${b}, ${ph} | ${s.pts.n} | ${sg(PO.minutes[g].bias)} | ${sg(s.pts.bias)} (${s.pts.ratio.toFixed(3)}) | ${sg(s.pts.biasActMin)} |`); }
T.push('');

fs.writeFileSync(path.join(OUTD, 'diag_history_tables.md'), T.join('\n') + '\n');
log('results/diag_history_tables.md written');
