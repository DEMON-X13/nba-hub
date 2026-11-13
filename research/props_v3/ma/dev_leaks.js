/* D7: the leak checks of PLAN.md 1.5, on MA's own projections (development data). Research only.
 *
 *   node research/props_v3/ma/dev_leaks.js   -> research/props_v3/results/ma_dev_leaks.json (about 10 minutes)
 *
 *   1. the loader refuses a seventh column (and a wrong header, and a short row), on planted files;
 *   2. the blindfold check: for at least 200 development games (whole nights, drawn with a seed from December to April),
 *      every input of MA and of F's per-line features, and MA's chance, recomputed from a folder holding only the box
 *      scores of earlier dates, the night's six-column lines, games.csv's rows to that night with that night's scores
 *      taken out, and odds_hist.csv's rows of that night's games, must be the same to the bit as the development table's
 *      (F's centring of the game total on the set's own mean is the one set-level constant, and is said, not compared);
 *   3. the scrambled-outcome check: the same nights' inputs and chance with each night's own boxes scrambled (every
 *      side's minutes and stat lines dealt out again among its players, seeded) must not move;
 *   4. the early-exit shift: on early exits (projected 24+ minutes by P23's own minutes rule on the box's list, as V2
 *      projects them; played his club's previous game; played under 12), the nudge's mean move of DraftKings' fair
 *      chance, sigm(logit q + n) - q, against its mean move elsewhere (the same players, 12 minutes or more), within half
 *      a point toward the Under;
 *   5. the minutes surprise: per player-game, the mean nudge against the minutes played less P23's projection: the
 *      correlation under 0.05 in size;
 *   6. the level read without the points line: the nudge rebuilt with each player-game's level from his other lines
 *      alone, refitted in the protocol, keeps at least half of the as-built gain on the other stats.
 * The nudge is the frozen one of ma_dev_bar.json (cache/ma/dev_oof.json holds its exact weights). Aggregates only.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const V = require('./dev_lib.js');
const M = require('./ma_lib.js');
const { S, T, STATS, mean, ll, sigm, logit, PM } = V;
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const P = JSON.parse(fs.readFileSync(path.join(M.ROOT, 'research', 'props_v3', 'results', 'ma_p23.json'), 'utf8')).P;
const OO = JSON.parse(fs.readFileSync(path.join(M.CACHE, 'ma', 'dev_oof.json'), 'utf8'));
const fin = OO.final, feat = V.featFinal(fin), W = new Map(fin.weights.map(z => [z.month, z]));
/* MA's chance from its inputs, the frozen weights of the line's month, in fitNudgeBig's own arithmetic */
const nudOf = x => { const z = W.get(x.month), f = feat(x); let s = 0; for (let a = 0; a < f.length; a++) s += z.w[a] * f[a]; return s; };
const eOf = x => { const z = W.get(x.month), r = S.eSparse(x); let s = x.zq; for (let q = 0; q < 3; q++) s += z.eb[r.idx[q]] * r.val[q]; return s; };
const out = { what: "D7: the leak checks on MA's own projections (development data)" };

/* 1. the loader */
{ const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v3-l1-')), cases = { seventh: 'game_id,player_id,stat,line,over,under,last_updated\nG,1,pts,10.5,-110,-110,2024-01-01\n', header: 'game_id,player_id,stat,line,over,unders\nG,1,pts,10.5,-110,-110\n', short: 'game_id,player_id,stat,line,over,under\nG,1,pts,10.5,-110\n' };
  out.loader = {};
  for (const [k, body] of Object.entries(cases)) { const f = path.join(dir, k + '.csv'); fs.writeFileSync(f, body); let refused = false; try { M.readLines6(f); } catch (e) { refused = true; } out.loader[k] = refused; }
  { const f = path.join(dir, 'six.csv'); fs.writeFileSync(f, 'game_id,player_id,stat,line,over,under\nG,1,pts,10.5,-110,-110\n'); out.loader.sixAccepted = M.readLines6(f).length === 1; }
  fs.rmSync(dir, { recursive: true, force: true });
  out.loader.met = out.loader.seventh && out.loader.header && out.loader.short && out.loader.sixAccepted;
  log(`1. loader: ${JSON.stringify(out.loader)}`); }

/* the development table, as dev_bar.js read it */
const { L } = V.loadMA('2024');
const G = V.sample(L);
const key = x => x.game + '|' + x.player + '|' + x.stat;
const oofN = new Map(OO.keys.map((k, i) => [k, OO.n[i]])), oofE = new Map(OO.keys.map((k, i) => [k, OO.e[i]]));
/* 2 and 3. the blindfold and the scramble, on whole nights */
const MA_FIELDS = ['club', 'opp', 'home', 'pos', 'nCur', 'posRate', 'mu', 'muDK', 'kap', 'nProj', 'pMix', 'd', 'trend', 'outShare', 'ret', 'early', 'ownMin', 'muOwn', 'pOwn', 'dLvl', 'nPl', 'q', 'zq', 'zo', 'M'];
const F_FIELDS = ['gN', 'gZ', 'nN', 'nZ', 'nZs', 'pgZ', 'dPos', 'spr', 'b2b', 'oppB2b', 'rest', 'g3in4', 'oppRest', 'sm', 'zmq', 'lsz', 'fav'];
const D = M.loadData(), gamesById = new Map(D.games.map(g => [g.game_id, g]));
const lines = M.lines2024(gamesById), RAW6 = M.readLines6(path.join(M.CACHE, 'dk40_2024_lines.csv'));
const nightsAll = [...new Set(G.filter(x => x.month >= '2023-12').map(x => x.date))].sort();
const R = T.rng(2024), pick = [], gamesPicked = new Set();
const pool = nightsAll.slice();
while (gamesPicked.size < 200 && pool.length) { const i = Math.floor(R() * pool.length), d = pool.splice(i, 1)[0]; pick.push(d); for (const l of lines) if (gamesById.get(l.game).date === d) gamesPicked.add(l.game); }
pick.sort();
log(`2. nights drawn: ${pick.length}, games ${gamesPicked.size}`);
/* the rest columns read from a schedule file of the folder's own (prepBig's rule) */
function restFrom(gamesFile, rows) {
  const sched = new Map(); for (const g of M.readGamesCsv(gamesFile)) { if (+g.season !== 2024) continue; for (const c of [g.away, g.home]) { if (!sched.has(c)) sched.set(c, []); sched.get(c).push(g.date); } }
  for (const a of sched.values()) a.sort();
  const gap = (a, b) => (Date.parse(b) - Date.parse(a)) / 864e5;
  const restOf = (club, date) => { const a = sched.get(club) || [], i = a.indexOf(date); if (i < 0) return { b2b: 0, rest: 5, g3in4: 0 }; const g = i > 0 ? gap(a[i - 1], date) : 9; return { b2b: g === 1 ? 1 : 0, rest: Math.min(g, 5), g3in4: i >= 2 && gap(a[i - 2], date) <= 3 ? 1 : 0 }; };
  for (const x of rows) { if (!x.club) { x.b2b = 0; x.oppB2b = 0; x.rest = 5; x.g3in4 = 0; continue; } const [, , aw, hm] = x.game.split('_'), me = restOf(x.club, x.date), op = restOf(x.club === hm ? aw : hm, x.date); x.b2b = me.b2b; x.oppB2b = op.b2b; x.rest = me.rest; x.g3in4 = me.g3in4; x.oppRest = op.rest; }
}
/* F's per-line features of a night's rows, from that night's lines alone and the folder's game lines */
function deriveNight(rows, oddsFile) {
  const by = k => { const m = new Map(); for (const x of rows) { const kk = k(x); if (!m.has(kk)) m.set(kk, []); m.get(kk).push(x); } return m; };
  const nightGames = new Set(rows.map(x => x.game)).size;
  { const mz = mean(rows.map(x => x.zq)), sd = Math.sqrt(mean(rows.map(x => (x.zq - mz) ** 2))) || 1; for (const x of rows) { x.nN = nightGames; x.nZ = mz; x.nZs = (x.zq - mz) / sd; } }
  for (const [, a] of by(x => x.game)) { const mz = mean(a.map(x => x.zq)); for (const x of a) { x.gN = a.length; x.gZ = mz; } }
  for (const [, a] of by(x => x.game + '|' + x.player)) {
    const mz = mean(a.map(x => x.zq)); for (const x of a) x.pgZ = mz;
    const q = a.filter(x => x.posRate > 0 && x.muDK != null); if (!q.length) continue;
    let tw = 0, tr = 0; for (const x of q) { const m0 = x.posRate * M.NOMINAL_MIN, w = x.muDK * x.muDK / PM.nbVar(x.muDK, x.ab); tw += w; tr += w * (Math.log(x.muDK) - Math.log(m0)); }
    const kp = tr / tw; for (const x of q) { const m2 = x.posRate * M.NOMINAL_MIN * Math.exp(kp); x.dPos = logit(PM.pOver(x.line, m2, PM.nbVar(m2, x.ab))) - x.zq; }
  }
  const oh = new Map(); for (const g of M.readGamesCsv(oddsFile)) oh.set(g.game_id, { homeLine: g.home_line === '' ? null : +g.home_line });
  for (const x of rows) { const gl = oh.get(x.game), hl = gl ? gl.homeLine : null; x.spr = hl == null || x.home == null ? 0 : (x.home ? hl : -hl); x.fav = x.q > 0.5 ? 1 : 0;
    const m = +x.date.slice(5, 7); x.sm = m >= 10 ? m - 10 : Math.min(m + 2, 6); x.zmq = S.zMultOf(x) - x.zq; x.lsz = Math.log(x.line + 0.5); }
}
const fullByKey = new Map(L.map(x => [key(x), x]));
const same = (a, b) => (a === b) || (a == null && b == null) || (typeof a === 'number' && typeof b === 'number' && Object.is(a, b));
function compare(rows, label, acc) {
  for (const x of rows) {
    const f = fullByKey.get(key(x)); acc.lines++;
    if (!f) { acc.missing++; continue; }
    for (const k of MA_FIELDS) if (!same(x[k], f[k])) { acc.diff++; if (acc.examples.length < 5) acc.examples.push(`${label} ${k}`); }
    if (acc.withF) for (const k of F_FIELDS) if (!same(x[k], f[k])) { acc.diff++; if (acc.examples.length < 5) acc.examples.push(`${label} F ${k}`); }
    if (x.club && x.status === 'graded' && oofN.has(key(x))) {
      acc.chances++;
      const n = nudOf(x), e = eOf(x);
      if (!Object.is(n, oofN.get(key(x))) || !Object.is(e, oofE.get(key(x)))) { acc.diff++; if (acc.examples.length < 5) acc.examples.push(`${label} chance`); }
      if (!Object.is(nudOf(f), n) || !Object.is(eOf(f), e)) { acc.diff++; if (acc.examples.length < 5) acc.examples.push(`${label} chance from the table`); }
    }
  }
}
const blind = { lines: 0, missing: 0, diff: 0, chances: 0, examples: [], withF: true }, scr = { lines: 0, missing: 0, diff: 0, chances: 0, examples: [], withF: false };
const csvBy = (file, keepRow) => { const t = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean), h = t.shift(); return [h, ...t.filter(l => keepRow(l, h))].join('\n') + '\n'; };
const SRC = { box: s => (s === 2021 ? path.join(M.CACHE, 'box2021', 'box_2021.csv') : path.join(M.ROOT, 'data', `box_${s}.csv`)), team: s => (s === 2021 ? path.join(M.CACHE, 'box2021', 'teambox_2021.jsonl') : path.join(M.ROOT, 'data', `teambox_${s}.jsonl`)) };
for (const night of pick) {
  const nightLines = lines.filter(l => gamesById.get(l.game).date === night);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v3-blind-'));
  try {
    for (const s of [2021, 2022, 2023, 2024]) {
      fs.writeFileSync(path.join(dir, `box_${s}.csv`), csvBy(SRC.box(s), l => l.split(',')[1] < night));
      fs.writeFileSync(path.join(dir, `teambox_${s}.jsonl`), fs.readFileSync(SRC.team(s), 'utf8').split('\n').filter(Boolean).filter(l => JSON.parse(l).date < night).join('\n') + '\n');
    }
    const gh = fs.readFileSync(path.join(M.ROOT, 'data', 'games.csv'), 'utf8').split('\n')[0].split(','), gi = k => gh.indexOf(k);
    fs.writeFileSync(path.join(dir, 'games.csv'), csvBy(path.join(M.ROOT, 'data', 'games.csv'), l => l.split(',')[gi('date')] <= night).split('\n').map((l, j) => { if (!j || !l) return l; const v = l.split(','); if (v[gi('date')] === night) { v[gi('away_score')] = ''; v[gi('home_score')] = ''; v[gi('status')] = 'scheduled'; } return v.join(','); }).join('\n'));
    const oh = fs.readFileSync(path.join(M.ROOT, 'data', 'odds_hist.csv'), 'utf8').split('\n'), ohh = oh[0].split(','), oi = k => ohh.indexOf(k), nightGames = new Set(nightLines.map(l => l.game));
    fs.writeFileSync(path.join(dir, 'odds_hist.csv'), [oh[0], ...oh.slice(1).filter(l => l && nightGames.has(l.split(',')[oi('game_id')]))].join('\n') + '\n');
    /* the night's raw six-column lines, as the cache holds them, parsed by the development loader's own rule */
    fs.writeFileSync(path.join(dir, 'lines.csv'), 'game_id,player_id,stat,line,over,under\n' + RAW6.filter(v => nightGames.has(v[0])).map(v => v.join(',')).join('\n') + '\n');
    const Db = M.loadData({ dir, games: path.join(dir, 'games.csv') });
    if (Object.keys(Db.boxes).some(g => (gamesById.get(g) || {}).date >= night)) throw new Error('the blind folder holds a box of the night or later');
    const lb = M.lines2024(new Map(Db.games.map(g => [g.game_id, g])), path.join(dir, 'lines.csv'));
    if (lb.length !== nightLines.length) throw new Error(`the blind folder's lines: ${lb.length}, the table's ${nightLines.length}`);
    const rb = M.buildRows(lb, Db, P);
    for (const x of rb) { const f = fullByKey.get(key(x)); if (f) { x.status = f.status; } }
    deriveNight(rb, path.join(dir, 'odds_hist.csv')); restFrom(path.join(dir, 'games.csv'), rb);
    compare(rb, 'blind', blind);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
  /* the scramble: the full data to the night, each of the night's sides dealt out again */
  const Rs = T.rng(night.split('-').join('') | 0), boxes = { ...D.boxes };
  for (const gid of new Set(nightLines.map(l => l.game))) { if (!boxes[gid]) continue; const sides = {};
    for (const [t, rs] of Object.entries(boxes[gid])) { const v = rs.map(r => ({ min: r.min, dnp: r.dnp, y: r.y, fga: r.fga, fta: r.fta, orb: r.orb, tov: r.tov })); for (let j = v.length - 1; j > 0; j--) { const k = Math.floor(Rs() * (j + 1)); [v[j], v[k]] = [v[k], v[j]]; } sides[t] = rs.map((r, j) => ({ ...r, ...v[j], y: { pts: v[j].y.pts + 7, reb: v[j].y.reb, ast: v[j].y.ast + 1, tpm: v[j].y.tpm, stl: v[j].y.stl, blk: v[j].y.blk } })); }
    boxes[gid] = sides; }
  const Ds = { games: D.games.filter(g => g.date <= night), boxes, tbox: D.tbox };
  const rs = M.buildRows(nightLines, Ds, P); for (const x of rs) { const f = fullByKey.get(key(x)); if (f) x.status = f.status; }
  compare(rs, 'scrambled', scr);
}
delete blind.withF; delete scr.withF;
out.blindfold = { nights: pick.length, games: gamesPicked.size, ...blind, met: blind.missing === 0 && blind.diff === 0 && gamesPicked.size >= 200, totalCentring: "F's game total is centred on the set's own mean: a constant of the set, not compared" };
out.scrambled = { ...scr, met: scr.missing === 0 && scr.diff === 0 };
log(`2. blindfold: ${JSON.stringify(out.blindfold)}`);
log(`3. scrambled: ${JSON.stringify(out.scrambled)}`);

/* 4 and 5: P23's projected minutes on the box's list (V2's rule: the early exits' and the surprise's only use) */
const Rr = PM.replay(D.games, D.boxes, D.tbox, { collect: true, from: 2024 }), rows24 = Rr.rows.filter(r => r.season === 2024), sides = PM.sidesOf(rows24);
const mins = PM.backtestMinutes(rows24, sides, P.min, () => true), mproj = new Map(rows24.map((r, i) => [r.game + '|' + r.id, mins[i]]));
const oof = G.filter(x => oofN.has(key(x)));
if (oof.length !== OO.keys.length) throw new Error('the out-of-fold lines differ from dev_oof.json');
for (const x of oof) { x.n = oofN.get(key(x)); x.mproj = mproj.get(x.game + '|' + x.player); }
const playedPrev = x => x.nCur > 0 && x.ret === 0;
const shift = x => sigm(x.zq + x.n) - x.q;
const exitL = x => x.mproj >= 24 && playedPrev(x) && x.minPlayed < 12, regL = x => x.mproj >= 24 && playedPrev(x) && x.minPlayed >= 12;
const ex = oof.filter(exitL), rg = oof.filter(regL);
out.earlyExits = { lines: ex.length, playerGames: new Set(ex.map(x => x.game + '|' + x.player)).size, shiftExit: mean(ex.map(shift)), shiftRest: mean(rg.map(shift)), dkExit: mean(ex.map(x => x.q)), dkRest: mean(rg.map(x => x.q)) };
out.earlyExits.underwardMore = out.earlyExits.shiftRest - out.earlyExits.shiftExit;
out.earlyExits.met = out.earlyExits.playerGames >= 40 && out.earlyExits.underwardMore <= 0.005;
log(`4. early exits: ${JSON.stringify(out.earlyExits)}`);
{ const pg = new Map(); for (const x of oof) { if (x.mproj == null) continue; const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, { n: [], s: x.minPlayed - x.mproj, k: x.kap }); pg.get(k).n.push(x.n); }
  const a = [...pg.values()].map(v => [mean(v.n), v.s, v.k]);
  const corr = (u, v) => { const mu = mean(u), mv = mean(v); let c = 0, su = 0, sv = 0; for (let i = 0; i < u.length; i++) { c += (u[i] - mu) * (v[i] - mv); su += (u[i] - mu) ** 2; sv += (v[i] - mv) ** 2; } return c / Math.sqrt(su * sv); };
  out.minutesSurprise = { playerGames: a.length, corrNudge: corr(a.map(z => z[0]), a.map(z => z[1])), corrLevel: corr(a.map(z => z[2]), a.map(z => z[1])) };
  out.minutesSurprise.met = Math.abs(out.minutesSurprise.corrNudge) < 0.05;
  log(`5. minutes surprise: ${JSON.stringify(out.minutesSurprise)}`); }
/* 6. the level read without the points line, refitted in the protocol */
{ const pg = new Map(); for (const x of L) { if (x.mu == null) continue; const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, []); pg.get(k).push(x); }
  for (const [, a] of pg) { const an = a.filter(x => x.stat !== 'pts'); if (!an.length) continue; let sw = 0, sr = 0; for (const x of an) { const w = x.muDK * x.muDK / PM.nbVar(x.muDK, x.ab); sw += w; sr += w * (Math.log(x.muDK) - Math.log(x.mu)); } const kap = sr / sw;
    for (const x of a) { const mu2 = x.mu * Math.exp(kap); x.dNoPts = logit(PM.pOver(x.line, mu2, PM.nbVar(mu2, x.ab))) - x.zq; } }
  const fNo = x => fin.stats.map(s => (x.stat === s ? (x.dNoPts == null ? 0 : x.dNoPts) : 0));
  const Pn = V.forward(G, fNo), zcf = Float64Array.from(OO.zcf);
  if (Pn.oof.some((x, i) => key(x) !== OO.keys[i])) throw new Error('not the same out-of-fold lines');
  const nonPts = Pn.oof.map((x, i) => (x.stat !== 'pts' ? i : -1)).filter(i => i >= 0), Ls = nonPts.map(i => Pn.oof[i]), z = Float64Array.from(nonPts, i => zcf[i]);
  const asBuilt = S.T2(Ls, Float64Array.from(nonPts, i => OO.n[i]), z, 10000), without = S.T2(Ls, Float64Array.from(nonPts, i => Pn.n[i]), z, 10000);
  out.withoutPoints = { lines: Ls.length, asBuilt: { ll: asBuilt.ll, llCi: asBuilt.llCi }, levelWithoutPoints: { ll: without.ll, llCi: without.llCi }, ratio: without.ll / asBuilt.ll };
  out.withoutPoints.met = without.ll <= 0.5 * asBuilt.ll;
  log(`6. without points: ${JSON.stringify(out.withoutPoints)}`); }
out.met = out.loader.met && out.blindfold.met && out.scrambled.met && out.earlyExits.met && out.minutesSurprise.met && out.withoutPoints.met;
out.seconds = Math.round((Date.now() - t0) / 1000);
fs.writeFileSync(path.join(M.ROOT, 'research', 'props_v3', 'results', 'ma_dev_leaks.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
log(`D7: ${out.met ? 'met' : 'NOT met'}`);
