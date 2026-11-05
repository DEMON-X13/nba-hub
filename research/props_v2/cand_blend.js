/* Candidate B, anchor to the market: DraftKings' fair chance of the Over moved by a fitted share of the model's
 * disagreement, p = sigma(logit q + w (logit m - logit q)), w clamped to [0, 1]. The rule, the variants and what counts
 * are in cand_blend.md ("The rule, written down before it was scored"), which was written before this script scored
 * anything.
 *
 *   node research/props_v2/cand_blend.js --check   reproduce the published model and market numbers on the archive and
 *                                                  the walk-forward's 2025 and 2026 folds, and test the fitting on
 *                                                  made-up data; prints no candidate score
 *   node research/props_v2/cand_blend.js           the one scoring run: results/cand_blend.json and
 *                                                  results/cand_blend_tables.md (the tables cand_blend.md quotes)
 *
 * Seasons 2022-2026 only: data/games.csv is cut to season <= 2026 before anything is read, and the box scores and team
 * boxes to those games. The archive is data/props_2026.csv (the 2026 play-in and playoffs), graded as tools/props.js
 * marketTest grades it, with the 2026 fold's constants (research/props.json, fitted on 2023-2025). Nothing of 2026-27
 * is read. tools/props.js is required, never changed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const REC = require('../../tools/props_record.js');
const F = require('../../tools/props_feed.js');

const ROOT = path.join(__dirname, '..', '..');
const OUTD = path.join(__dirname, 'results');
const LAST = 2026;
const CHECK = process.argv.includes('--check');
const EDGE = 0.03, NBOOT = 10000, NBOOT_W = 2000;
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r3 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e3) / 1e3;
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const logit = p => { const c = clip(p); return Math.log(c / (1 - c)); };
const sig = z => 1 / (1 + Math.exp(-z));
const mean = a => a.reduce((s, x) => s + x, 0) / a.length;
const quant = (a, q) => { const s = Float64Array.from(a).sort(); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };
const clamp01 = w => Math.min(1, Math.max(0, w));

/* ---------- 1. the data, cut to 2022-2026 ---------- */
const games = PR.loadGames().filter(g => g.season <= LAST);
const gset = new Set(games.map(g => g.game_id));
const boxes = {}; for (const [k, v] of Object.entries(PR.loadBoxes())) if (gset.has(k)) boxes[k] = v;
const tbox = {}; for (const [k, v] of Object.entries(PR.loadTeamBoxes())) if (gset.has(k.split(':')[0])) tbox[k] = v;
if (Object.keys(boxes).some(k => +k.slice(0, 4) > LAST)) throw new Error('a box score after 2026 was read');
if (games.some(g => g.season > LAST)) throw new Error('a game after 2026 was read');

/* ---------- 2. the archive: its series and rounds (as data_describe.js reads them) ---------- */
const rec = REC.readRecord(2026);
const post = games.filter(g => g.season === 2026 && g.type === 'POST').sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : 0);
const playIn = games.filter(g => g.season === 2026 && g.type === 'REG' && g.date >= '2026-04-14');
const seriesOf = {}, roundOf = {}, seriesStart = {}, nth = {};
for (const g of post) {
  const key = [g.away, g.home].sort().join('-');
  if (!(key in seriesStart)) {
    seriesStart[key] = g.date;
    const ra = (nth[g.away] || 0) + 1, rh = (nth[g.home] || 0) + 1;
    if (ra !== rh) throw new Error(`series ${key}: the clubs disagree on the round`);
    nth[g.away] = ra; nth[g.home] = rh; seriesStart[key + ':round'] = ra;
  }
  seriesOf[g.game_id] = key; roundOf[g.game_id] = seriesStart[key + ':round'];
}
for (const g of playIn) { seriesOf[g.game_id] = 'play-in ' + [g.away, g.home].join('@'); roundOf[g.game_id] = 0; }
if (rec.some(l => !(l.game_id in roundOf))) throw new Error('a line on a game outside the play-in and playoffs');

/* ---------- 3. the replay and the 2026 fold's projections; every graded line ---------- */
const research = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props.json'), 'utf8'));
const foldOf = s => research.folds.find(f => f.season === s);
const P = foldOf(2026).params;
log(`replaying 2022-${LAST}: ${games.length} games`);
const R = PR.replay(games, boxes, tbox, { collect: true, from: PR.FIRST + 1 });
if (R.rows.some(r => r.season > LAST)) throw new Error('a row after 2026');
const recGames = new Set(rec.map(l => l.game_id));
const pr = PR.project(R.rows, P, r => recGames.has(r.game));
const at = new Map(); for (const [i, x] of pr) at.set(R.rows[i].game + '|' + R.rows[i].id, { x, r: R.rows[i] });
const played = new Set();
for (const gid of recGames) for (const side of Object.values(boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
const L = [];
for (const l of rec) {
  const k = l.game_id + '|' + l.player_id;
  if (!played.has(k)) continue;
  const a = at.get(k); if (!a) continue;
  const mu = a.x.mu[l.stat], y = PR.yOf(a.r.y, l.stat), g = PR.gradeLine(l.line, l.over, l.under, mu, P.var[l.stat], y);
  if (g.result === 'push') continue;
  L.push({ game: l.game_id, series: seriesOf[l.game_id], round: roundOf[l.game_id], stat: l.stat, line: l.line, over: l.over, under: l.under, mu, y, ab: P.var[l.stat],
    m: g.pModel, q: g.pMarket, result: g.result, o: g.result === 'over' ? 1 : 0 });
}
const N = L.length;
const llOf = (p, o) => o ? -Math.log(clip(p)) : -Math.log(1 - clip(p));
const brOf = (p, o) => (p - o) ** 2;
const pub = foldOf(2026).market.all;
const llM = mean(L.map(x => llOf(x.m, x.o))), llQ = mean(L.map(x => llOf(x.q, x.o)));
log(`archive: ${N} graded lines on ${new Set(L.map(x => x.game)).size} games; log loss model ${r4(llM)}, DraftKings ${r4(llQ)} (published ${pub.logloss.model}, ${pub.logloss.market}, ${pub.lines} lines)`);
if (N !== pub.lines || r4(llM) !== pub.logloss.model || r4(llQ) !== pub.logloss.market) throw new Error('the archive does not grade as research/props.json says: stop');

/* ---------- 4. the box-score walk-forward, 2025 and 2026 folds: tools/props.js as it stands ---------- */
const WF = {};
for (const S of [2025, 2026]) {
  const fold = foldOf(S), train = r => r.season >= PR.FIRST + 1 && r.season < S;
  const NV = PR.fitNaiveVar(R.rows, train);
  const sc = PR.score(R.rows, fold.params, NV, r => r.season === S);
  const bad = PR.ALL.filter(k => sc.stats[k].mae !== fold.stats[k].mae || sc.stats[k].logScore !== fold.stats[k].logScore);
  if (bad.length || sc.players !== fold.players) throw new Error(`fold ${S} does not score as research/props.json says (${bad.join(', ')}; players ${sc.players} vs ${fold.players})`);
  WF[S] = { players: sc.players, minutesMae: sc.minutes.mae, stats: Object.fromEntries(PR.ALL.map(k => [k, { mae: sc.stats[k].mae, logScore: sc.stats[k].logScore }])) };
  log(`walk-forward ${S}: ${sc.players} player-games, points MAE ${sc.stats.pts.mae}, log score ${sc.stats.pts.logScore}: research/props.json's, to the digit`);
}

/* ---------- 5. the fitting: a share of a disagreement, by maximum likelihood ---------- */
/* minimise sum wt_i * logloss(sigma(a_i + w d_i), o_i) over w: convex, Newton with step halving */
function fitShare(a, d, o, idx, wt) {
  const loss = w => { let s = 0; for (const i of idx) { const z = a[i] + w * d[i], c = wt ? wt[i] : 1; if (!c) continue; s += c * (o[i] ? Math.log1p(Math.exp(-z)) : Math.log1p(Math.exp(z))); } return s; };
  let w = 0, f = loss(0);
  for (let it = 0; it < 60; it++) {
    let g = 0, h = 0;
    for (const i of idx) { const c = wt ? wt[i] : 1; if (!c) continue; const s = sig(a[i] + w * d[i]); g += c * (s - o[i]) * d[i]; h += c * s * (1 - s) * d[i] * d[i]; }
    if (!(h > 0)) break;
    let step = g / h, w2 = w - step, f2 = loss(w2), k = 0;
    while (f2 > f + 1e-12 && k++ < 40) { step /= 2; w2 = w - step; f2 = loss(w2); }
    const done = Math.abs(w2 - w) < 1e-9; w = w2; f = f2; if (done) break;
  }
  return w;
}

/* ---------- 6. --check: the fitting and the inversion on made-up data ---------- */
/* the candidate's distribution at a line: props.js's negative binomial with its mean moved until its chance of the Over
   is p (pOver rises with the mean); the spread rule unchanged */
function muFor(line, p, ab, mu0) {
  let lo = Math.log(1e-3), hi = Math.log(Math.max(mu0, line, 1) * 8 + 30);
  for (let it = 0; it < 70; it++) { const mid = (lo + hi) / 2, mm = Math.exp(mid); if (PR.pOver(line, mm, PR.nbVar(mm, ab)) < p) lo = mid; else hi = mid; }
  return Math.exp((lo + hi) / 2);
}
if (CHECK) {
  const Rg = PR.rng(7), n = 50000, a = new Float64Array(n), d = new Float64Array(n), o = new Uint8Array(n);
  const gauss = () => { let u = 0, v = 0; while (!u) u = Rg(); v = Rg(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  for (const wTrue of [0, 0.3, 0.8]) {
    for (let i = 0; i < n; i++) { a[i] = logit(0.3 + 0.4 * Rg()); d[i] = 0.6 * gauss(); o[i] = Rg() < sig(a[i] + wTrue * d[i]) ? 1 : 0; }
    const idx = Array.from({ length: n }, (_, i) => i), w = fitShare(a, d, o, idx);
    let g = 0; for (const i of idx) g += (sig(a[i] + w * d[i]) - o[i]) * d[i];
    log(`check fitShare: true w ${wTrue}, fitted ${r4(w)}, gradient at the fit ${g.toExponential(1)}`);
    if (Math.abs(w - wTrue) > 0.06 || Math.abs(g) > 1e-4) throw new Error('fitShare is wrong');
  }
  /* doubled weights must give the same w as the doubled data */
  { const idx = Array.from({ length: 2000 }, (_, i) => i), wt = new Float64Array(n).fill(0); idx.forEach(i => { wt[i] = 2; });
    const w1 = fitShare(a, d, o, idx), w2 = fitShare(a, d, o, idx, wt); if (Math.abs(w1 - w2) > 1e-7) throw new Error('weights'); log(`check weights: ${r4(w1)} = ${r4(w2)}`); }
  let worst = 0;
  for (let i = 0; i < 3000; i++) {
    const x = L[Math.floor(Rg() * N)], mu = x.mu * (0.4 + 1.2 * Rg()), p = PR.pOver(x.line, mu, PR.nbVar(mu, x.ab));
    if (p < 1e-4 || p > 1 - 1e-4) continue;
    const back = muFor(x.line, p, x.ab, x.mu); worst = Math.max(worst, Math.abs(PR.pOver(x.line, back, PR.nbVar(back, x.ab)) - p));
  }
  log(`check muFor: the worst chance off its target on 3,000 made-up lines ${worst.toExponential(1)}`);
  if (worst > 1e-6) throw new Error('muFor is wrong');
  /* the flat-bet tally used below against tools/props.js flatBets, on the model's own chances (published) */
  const fb = PR.flatBets(L.map(x => ({ pModel: x.m, over: x.over, under: x.under, result: x.result })), EDGE);
  log(`check flatBets on the model: Overs ${fb.over.bets} bets ${fb.over.units}, Unders ${fb.under.bets} bets ${fb.under.units} (published ${pub.flat.edge3.over.bets} ${pub.flat.edge3.over.units}, ${pub.flat.edge3.under.bets} ${pub.flat.edge3.under.units})`);
  if (fb.over.units !== pub.flat.edge3.over.units || fb.under.units !== pub.flat.edge3.under.units) throw new Error('flat bets do not reproduce');
  log('check passed: no candidate was scored');
  process.exit(0);
}

/* ---------- 7. the scoring run ---------- */
const A = new Float64Array(N), D = new Float64Array(N), O = new Uint8Array(N), DM = new Float64Array(N), Z0 = new Float64Array(N);
L.forEach((x, i) => { A[i] = logit(x.q); D[i] = logit(x.m) - logit(x.q); O[i] = x.o; DM[i] = logit(x.m); });
const ALLIDX = Array.from({ length: N }, (_, i) => i);
const groupsBy = key => { const m = new Map(); L.forEach((x, i) => { const k = x[key]; if (!m.has(k)) m.set(k, []); m.get(k).push(i); }); return m; };
const GAMES = groupsBy('game'), SERIES = groupsBy('series'), ROUNDS = groupsBy('round'), STATS_IN = PR.ALL.filter(k => L.some(x => x.stat === k));
const gameKeys = [...GAMES.keys()];

/* leave one group out: each group's lines at the share fitted on the rest; perStat fits each stat apart */
function cv(a, d, groups, perStat) {
  const p = new Float64Array(N), wOf = [];
  for (const [gk, idxG] of groups) {
    const inG = new Set(idxG);
    const cells = perStat ? STATS_IN.map(k => [k, idxG.filter(i => L[i].stat === k)]) : [['all', idxG]];
    for (const [k, test] of cells) {
      if (!test.length) continue;
      const train = ALLIDX.filter(i => !inG.has(i) && (k === 'all' || L[i].stat === k));
      const raw = fitShare(a, d, O, train), w = clamp01(raw);
      for (const i of test) p[i] = sig(a[i] + w * d[i]);
      wOf.push({ group: gk, stat: k, raw, w });
    }
  }
  return { p, w: wOf };
}
/* one set of chances against DraftKings' fair chance */
function betOf(x, pv) {
  const eo = pv - F.propImplied(x.over), eu = (1 - pv) - F.propImplied(x.under);
  const side = eo >= EDGE && eo >= eu ? 'over' : eu >= EDGE ? 'under' : null;
  if (!side) return null;
  const price = side === 'over' ? x.over : x.under;
  return { side, won: x.result === side, units: x.result === side ? (price > 0 ? price / 100 : 100 / -price) : -1 };
}
function bootSum(groups, nBoot = NBOOT, seed = 0) {
  const Rg = PR.rng(seed), n = groups.length, out = new Float64Array(nBoot);
  for (let b = 0; b < nBoot; b++) { let s = 0; for (let j = 0; j < n; j++) s += groups[Math.floor(Rg() * n)]; out[b] = s; }
  out.sort(); return [r2(out[Math.floor(0.05 * nBoot)]), r2(out[Math.floor(0.95 * nBoot)])];
}
function scoreSet(p, idx = ALLIDX) {
  const byG = new Map(), byGb = new Map(), units = { over: new Map(), under: new Map() };
  const flat = { over: { bets: 0, won: 0, units: 0 }, under: { bets: 0, won: 0, units: 0 } };
  let lp = 0, lq = 0, bp = 0, bq = 0, said = 0, hit = 0, gap = 0;
  for (const i of idx) {
    const x = L[i], a = llOf(p[i], x.o), b = llOf(x.q, x.o), c = brOf(p[i], x.o), e = brOf(x.q, x.o);
    lp += a; lq += b; bp += c; bq += e; said += p[i]; hit += x.o; gap += Math.abs(p[i] - x.q);
    const g = byG.get(x.game) || [0, 0]; g[0] += a - b; g[1]++; byG.set(x.game, g);
    const h = byGb.get(x.game) || [0, 0]; h[0] += c - e; h[1]++; byGb.set(x.game, h);
    const bt = betOf(x, p[i]);
    if (bt) { const f = flat[bt.side]; f.bets++; f.won += bt.won; f.units += bt.units; units[bt.side].set(x.game, (units[bt.side].get(x.game) || 0) + bt.units); }
  }
  const n = idx.length, gIn = [...new Set(idx.map(i => L[i].game))];
  for (const s of ['over', 'under']) {
    const f = flat[s]; f.units = r2(f.units); f.roi = f.bets ? r4(f.units / f.bets) : null;
    f.unitsCi90 = f.bets ? bootSum(gIn.map(gk => units[s].get(gk) || 0)) : null;
  }
  return { lines: n, overHit: r4(hit / n), said: r4(said / n), marketSaid: r4(idx.reduce((s, i) => s + L[i].q, 0) / n), meanGapFromMarket: r4(gap / n),
    logloss: { cand: r4(lp / n), market: r4(lq / n), diff: r4((lp - lq) / n), diffCi90: PR.bootCI([...byG.values()]) },
    brier: { cand: r4(bp / n), market: r4(bq / n), diff: r4((bp - bq) / n), diffCi90: PR.bootCI([...byGb.values()]) }, flat };
}
const byStat = (p, sel = () => true) => Object.fromEntries(STATS_IN.map(k => { const idx = ALLIDX.filter(i => L[i].stat === k && sel(i)); const s = scoreSet(p, idx); return [k, { lines: s.lines, logloss: s.logloss, brier: s.brier, flat: s.flat }]; }));
const wSummary = ws => { const raw = ws.map(x => x.raw), w = ws.map(x => x.w); return { folds: ws.length, raw: { min: r4(Math.min(...raw)), median: r4(quant(raw, 0.5)), max: r4(Math.max(...raw)) }, clampedAtZero: w.filter(v => v === 0).length, clampedAtOne: w.filter(v => v === 1).length }; };

const OUT = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'Candidate B, anchor to the market (research/props_v2/cand_blend.js; the rule in cand_blend.md was written before this run)', lines: N, games: GAMES.size, walkForward: WF };

/* the yardsticks: the model alone and DraftKings alone */
const pModel = Float64Array.from(L.map(x => x.m)), pMkt = Float64Array.from(L.map(x => x.q));
OUT.model = scoreSet(pModel); OUT.marketAlone = scoreSet(pMkt);
log(`model alone: log loss ${OUT.model.logloss.diff} ${JSON.stringify(OUT.model.logloss.diffCi90)} against DraftKings`);

/* B1, B2 and the control, out of sample */
OUT.cv = {};
for (const [name, groups] of [['game', GAMES], ['series', SERIES], ['round', ROUNDS]]) {
  const b1 = cv(A, D, groups, false), b2 = cv(A, D, groups, true), c = cv(Z0, DM, groups, false);
  OUT.cv[name] = { groups: groups.size,
    B1: { ...scoreSet(b1.p), weights: wSummary(b1.w), byStat: name === 'game' ? byStat(b1.p) : undefined },
    B2: { ...scoreSet(b2.p), weights: Object.fromEntries(STATS_IN.map(k => [k, wSummary(b2.w.filter(x => x.stat === k))])), byStat: name === 'game' ? byStat(b2.p) : undefined },
    C: { ...scoreSet(c.p), weights: wSummary(c.w) } };
  if (name === 'game') {
    OUT._pB1 = b1.p; OUT._pB2 = b2.p;
  }
  log(`leave one ${name} out: B1 ${OUT.cv[name].B1.logloss.diff} ${JSON.stringify(OUT.cv[name].B1.logloss.diffCi90)}, B2 ${OUT.cv[name].B2.logloss.diff} ${JSON.stringify(OUT.cv[name].B2.logloss.diffCi90)}, C ${OUT.cv[name].C.logloss.diff} ${JSON.stringify(OUT.cv[name].C.logloss.diffCi90)}`);
}

/* described, not tested: the archive's own optimum and its interval, pooled and per stat */
function wStar(idx) {
  const w = fitShare(A, D, O, idx);
  const Rg = PR.rng(0), gk = [...new Set(idx.map(i => L[i].game))], gIdx = new Map(gk.map(g => [g, idx.filter(i => L[i].game === g)]));
  const wt = new Float64Array(N), bs = new Float64Array(NBOOT_W);
  for (let b = 0; b < NBOOT_W; b++) {
    wt.fill(0); for (let j = 0; j < gk.length; j++) for (const i of gIdx.get(gk[Math.floor(Rg() * gk.length)])) wt[i]++;
    bs[b] = fitShare(A, D, O, idx, wt);
  }
  bs.sort();
  return { w: r4(w), ci90: [r4(bs[Math.floor(0.05 * NBOOT_W)]), r4(bs[Math.floor(0.95 * NBOOT_W)])] };
}
OUT.inSample = { pooled: wStar(ALLIDX), byStat: Object.fromEntries(STATS_IN.map(k => [k, wStar(ALLIDX.filter(i => L[i].stat === k))])) };
{ const w = clamp01(OUT.inSample.pooled.w), p = Float64Array.from(ALLIDX.map(i => sig(A[i] + w * D[i]))); OUT.inSample.pooledScore = scoreSet(p); }
{ const p = Float64Array.from(ALLIDX.map(i => { const k = L[i].stat; return sig(A[i] + clamp01(OUT.inSample.byStat[k].w) * D[i]); })); OUT.inSample.byStatScore = scoreSet(p); }
log(`in sample: w* ${OUT.inSample.pooled.w} ${JSON.stringify(OUT.inSample.pooled.ci90)}; its log loss ${OUT.inSample.pooledScore.logloss.diff} ${JSON.stringify(OUT.inSample.pooledScore.logloss.diffCi90)}`);
OUT.curve = [];
for (let k = 0; k <= 20; k++) {
  const w = k / 20, p = Float64Array.from(ALLIDX.map(i => sig(A[i] + w * D[i]))), s = scoreSet(p);
  OUT.curve.push({ w, logloss: s.logloss.diff, ci90: s.logloss.diffCi90, brier: s.brier.diff, brierCi90: s.brier.diffCi90, said: s.said, over: s.flat.over, under: s.flat.under });
}

/* the candidate's distribution at a posted line, against props.js's own: the mean moved to the candidate's chance */
function distScore(p) {
  let mae = 0, ls = 0, miss = 0;
  for (let i = 0; i < N; i++) {
    const x = L[i], mu = muFor(x.line, p[i], x.ab, x.mu);
    if (Math.abs(PR.pOver(x.line, mu, PR.nbVar(mu, x.ab)) - p[i]) > 1e-4) miss++;
    mae += Math.abs(mu - x.y); ls -= PR.nbLogPmf(x.y, mu, PR.nbVar(mu, x.ab));
  }
  return { mae: r3(mae / N), logScore: r4(ls / N), unreached: miss };
}
OUT.dist = { model: { mae: r3(mean(L.map(x => Math.abs(x.mu - x.y)))), logScore: r4(mean(L.map(x => -PR.nbLogPmf(x.y, x.mu, PR.nbVar(x.mu, x.ab))))) },
  modelReinverted: distScore(pModel), B1: distScore(OUT._pB1), B2: distScore(OUT._pB2), marketShape: distScore(pMkt), line: { mae: r3(mean(L.map(x => Math.abs(x.line - x.y)))) } };
log(`distribution at the line: MAE model ${OUT.dist.model.mae}, B1 ${OUT.dist.B1.mae}, market ${OUT.dist.marketShape.mae}, the line ${OUT.dist.line.mae}; log score ${OUT.dist.model.logScore}, ${OUT.dist.B1.logScore}, ${OUT.dist.marketShape.logScore}`);
delete OUT._pB1; delete OUT._pB2;

fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, 'cand_blend.json'), JSON.stringify(OUT, null, 1) + '\n');

/* ---------- 8. the tables ---------- */
const sg = (x, d = 4) => x == null ? '' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const ci = (c, d = 4) => c ? `[${sg(c[0], d)}, ${sg(c[1], d)}]` : '';
const pc = x => (100 * x).toFixed(1) + '%';
const fl = f => `${f.bets}, ${f.won}, ${sg(f.units, 1)}${f.bets ? ` (${sg(100 * f.roi, 1)}%)` : ''}${f.unitsCi90 ? ` ${ci(f.unitsCi90, 1)}` : ''}`;
const T = [];
T.push('## A. Out of sample on the archive (11,395 lines, 83 games), against DraftKings\' fair chance', '',
  '| Chance | Held out by | Log loss diff [90%] | Brier diff [90%] | Over said (hit ' + pc(OUT.model.overHit) + ') | Mean gap from DraftKings |', '|---|---|---|---|---|---|');
T.push(`| The model alone | (fitted 2023-2025) | ${sg(OUT.model.logloss.diff)} ${ci(OUT.model.logloss.diffCi90)} | ${sg(OUT.model.brier.diff)} ${ci(OUT.model.brier.diffCi90)} | ${pc(OUT.model.said)} | ${(100 * OUT.model.meanGapFromMarket).toFixed(1)} pts |`);
for (const name of ['game', 'series', 'round']) for (const v of ['B1', 'B2', 'C']) {
  const s = OUT.cv[name][v];
  T.push(`| ${v === 'B1' ? 'B1 pooled' : v === 'B2' ? 'B2 per stat' : 'C control (model tempered, no market)'} | one ${name} (${OUT.cv[name].groups}) | ${sg(s.logloss.diff)} ${ci(s.logloss.diffCi90)} | ${sg(s.brier.diff)} ${ci(s.brier.diffCi90)} | ${pc(s.said)} | ${(100 * s.meanGapFromMarket).toFixed(1)} pts |`);
}
T.push('', '## B. The weights the folds fitted (raw, before the clamp)', '', '| Variant | Held out by | Folds | Min | Median | Max | Clamped at 0 |', '|---|---|---|---|---|---|---|');
for (const name of ['game', 'series', 'round']) {
  for (const v of ['B1', 'C']) { const w = OUT.cv[name][v].weights; T.push(`| ${v} | ${name} | ${w.folds} | ${w.raw.min} | ${w.raw.median} | ${w.raw.max} | ${w.clampedAtZero} |`); }
}
T.push('', '| B2, leave one game out | Folds | Min | Median | Max | Clamped at 0 |', '|---|---|---|---|---|---|');
for (const k of STATS_IN) { const w = OUT.cv.game.B2.weights[k]; T.push(`| ${k} | ${w.folds} | ${w.raw.min} | ${w.raw.median} | ${w.raw.max} | ${w.clampedAtZero} |`); }
T.push('', '## C. Flat one-unit bets at a 3-point edge, at the closing price (bets, won, units (return) [90% on units, resampling games])', '',
  '| Chance | Overs | Unders |', '|---|---|---|',
  `| The model alone | ${fl(OUT.model.flat.over)} | ${fl(OUT.model.flat.under)} |`,
  `| DraftKings alone | ${fl(OUT.marketAlone.flat.over)} | ${fl(OUT.marketAlone.flat.under)} |`);
for (const name of ['game', 'series', 'round']) for (const v of ['B1', 'B2', 'C']) { const s = OUT.cv[name][v]; T.push(`| ${v}, leave one ${name} out | ${fl(s.flat.over)} | ${fl(s.flat.under)} |`); }
T.push('', '## D. By stat, leave one game out: log-loss difference against DraftKings [90%]', '', '| Stat | Lines | The model | B1 pooled | B2 per stat | B2 weight (median raw) | w* in sample [90%] |', '|---|---|---|---|---|---|---|');
const mBy = byStat(pModel);
for (const k of STATS_IN) { const b1 = OUT.cv.game.B1.byStat[k], b2 = OUT.cv.game.B2.byStat[k], m = mBy[k], ws = OUT.inSample.byStat[k];
  T.push(`| ${k} | ${b1.lines} | ${sg(m.logloss.diff)} ${ci(m.logloss.diffCi90)} | ${sg(b1.logloss.diff)} ${ci(b1.logloss.diffCi90)} | ${sg(b2.logloss.diff)} ${ci(b2.logloss.diffCi90)} | ${OUT.cv.game.B2.weights[k].raw.median} | ${ws.w} ${ci(ws.ci90)} |`); }
OUT.modelByStat = mBy;
T.push('', '## E. In sample (described, not a test): the archive\'s own optimum', '',
  `Pooled w* = ${OUT.inSample.pooled.w}, 90% ${ci(OUT.inSample.pooled.ci90)} (refitted on ${NBOOT_W} resamples of games). At w*: log loss ${sg(OUT.inSample.pooledScore.logloss.diff)} ${ci(OUT.inSample.pooledScore.logloss.diffCi90)}, Brier ${sg(OUT.inSample.pooledScore.brier.diff)} ${ci(OUT.inSample.pooledScore.brier.diffCi90)}. Per stat at each w*: log loss ${sg(OUT.inSample.byStatScore.logloss.diff)} ${ci(OUT.inSample.byStatScore.logloss.diffCi90)}.`,
  '', '| w (fixed) | Log loss diff [90%] | Brier diff [90%] | Over said | Overs: bets, won, units | Unders: bets, won, units |', '|---|---|---|---|---|---|');
for (const c of OUT.curve) T.push(`| ${c.w.toFixed(2)} | ${sg(c.logloss)} ${ci(c.ci90)} | ${sg(c.brier)} ${ci(c.brierCi90)} | ${pc(c.said)} | ${fl(c.over)} | ${fl(c.under)} |`);
T.push('', '## F. The candidate\'s distribution at a posted line (the model\'s negative binomial, its mean moved to the chance), leave one game out', '',
  '| | Mean absolute error of the mean | Log score of the stat |', '|---|---|---|',
  `| tools/props.js (the model's own mean) | ${OUT.dist.model.mae} | ${OUT.dist.model.logScore} |`,
  `| The same, re-inverted from its own chance (a check) | ${OUT.dist.modelReinverted.mae} | ${OUT.dist.modelReinverted.logScore} |`,
  `| B1 pooled | ${OUT.dist.B1.mae} | ${OUT.dist.B1.logScore} |`, `| B2 per stat | ${OUT.dist.B2.mae} | ${OUT.dist.B2.logScore} |`,
  `| DraftKings' fair chance, on the model's shape | ${OUT.dist.marketShape.mae} | ${OUT.dist.marketShape.logScore} |`, `| The line itself | ${OUT.dist.line.mae} | |`);
T.push('', '## G. The box-score walk-forward (tools/props.js as it stands; the candidate is the same, having no price to anchor to)', '',
  '| Stat | 2025 MAE | 2025 log score | 2026 MAE | 2026 log score |', '|---|---|---|---|---|');
for (const k of PR.ALL) T.push(`| ${k} | ${WF[2025].stats[k].mae} | ${WF[2025].stats[k].logScore} | ${WF[2026].stats[k].mae} | ${WF[2026].stats[k].logScore} |`);
T.push('', `Player-games: 2025 ${WF[2025].players}, 2026 ${WF[2026].players}; minutes MAE ${WF[2025].minutesMae} and ${WF[2026].minutesMae}. Each is research/props.json's to the digit.`);
fs.writeFileSync(path.join(OUTD, 'cand_blend.json'), JSON.stringify(OUT, null, 1) + '\n');
fs.writeFileSync(path.join(OUTD, 'cand_blend_tables.md'), T.join('\n') + '\n');
log('results/cand_blend.json and results/cand_blend_tables.md written');
