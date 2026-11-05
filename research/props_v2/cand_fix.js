/* Candidate A: tools/props.js with its own parts fixed where the diagnosis pointed, each change kept only if the
 * walk-forward says so.
 *
 *   node research/props_v2/cand_fix.js --verify   the machinery with every change off against tools/props.js: the
 *                                                 replay's rows, the fit's constants, the walk-forward's scores and the
 *                                                 archive's, to the digit (writes results/cand_fix_verify.json)
 *   node research/props_v2/cand_fix.js --select   the changes in order, each fitted on the seasons before each fold and
 *                                                 kept only if the walk-forward's mean log score improves on BOTH the
 *                                                 2025 fold (fit 2023-2024) and the 2026 regular season (fit 2023-2025,
 *                                                 games to 12 April: the play-in and playoffs, which the archive covers,
 *                                                 are never looked at); writes results/cand_fix_select.json and the rule,
 *                                                 results/cand_fix_rule.json, before anything is scored on the archive
 *   node research/props_v2/cand_fix.js --score    the frozen rule, once: the walk-forward (2024, 2025, 2026 regular
 *                                                 season and 2026 playoffs) and DraftKings' 2026 play-in and playoff
 *                                                 closing lines, against tools/props.js as it stands; and the constants
 *                                                 a new shadow trial would freeze (fit 2023-2026); writes
 *                                                 results/cand_fix_score.json
 *
 * Seasons 2022-2026 only (cand_fix_lib.js loadData). Nothing of 2026-27 is read.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const C = require('./cand_fix_lib.js');

const OUTD = path.join(__dirname, 'results');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const quiet = () => {};
const mode = process.argv[2] || '--verify';
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r5 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e5) / 1e5;
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;

const D = C.loadData();
log(`games ${D.games.length}, box scores ${Object.keys(D.boxes).length}`);
const R = C.replayX(D.games, D.boxes, D.tbox, { collect: true, from: PR.FIRST + 1 });
const rows = R.rows;
if (rows.some(r => r.season > C.LAST)) throw new Error('a row after 2026');
const sides = C.sidesOf(rows);
log(`replay: ${rows.length} rows`);

const train = S => r => r.season >= PR.FIRST + 1 && r.season < S;
const REG_END = '2026-04-12';                       // the 2026 regular season's last day; the play-in began on the 14th
const TESTS = {
  2025: r => r.season === 2025,
  '2026R': r => r.season === 2026 && r.type === 'REG' && r.date <= REG_END,
};
const foldOf = t => t === '2026R' || t === '2026P' ? 2026 : +t;

function evalX(X, G, tests = ['2025', '2026R'], opts = {}) {
  const out = {};
  const fits = {};
  for (const t of tests) {
    const S = foldOf(t);
    if (!fits[S]) fits[S] = C.fitAllX(rows, sides, train(S), X, G, opts);
    const { P, X: XX } = fits[S];
    const sel = TESTS[t] || (t === '2026P' ? (r => r.season === 2026 && (r.type === 'POST' || r.date > REG_END)) : (r => r.season === +t));
    const sc = C.scoreX(rows, C.projectX(rows, sides, P, XX, sel));
    out[t] = { P, X: XX, score: sc };
  }
  return out;
}
const brief = sc => ({ n: sc.n, meanLogScore: r5(sc.meanLogScore), meanLineLogloss: r5(sc.meanLineLogloss), meanMae: r4(sc.meanMae), minutesMae: r4(sc.minutes.mae), minutesBias: r4(sc.minutes.bias),
  stats: Object.fromEntries(Object.entries(sc.stats).map(([k, s]) => [k, { mae: r4(s.mae), bias: r4(s.bias), logScore: r5(s.logScore), lineLogloss: r5(s.lineLogloss) }])) });

if (mode === '--verify') {
  /* 1. the rows: replayX against tools/props.js replay */
  const R0 = PR.replay(D.games, D.boxes, D.tbox, { collect: true, from: PR.FIRST + 1 });
  let diff = 0;
  if (R0.rows.length !== rows.length) diff = -1;
  else for (let i = 0; i < rows.length; i++) { const a = rows[i], b = R0.rows[i]; const { x, ...a2 } = a; if (JSON.stringify(a2) !== JSON.stringify(b)) { diff++; if (diff < 3) console.log('row differs', i); } }
  log(`rows: ${rows.length} against ${R0.rows.length}, ${diff} differ`);
  /* 2. the fit with every change off against tools/props.js fit (the cached folds, which equal research/props.json's) */
  const foldP = JSON.parse(fs.readFileSync(path.join(OUTD, 'fold_params.json'), 'utf8'));
  const res = { rowsDiffer: diff, folds: {} };
  const stored = JSON.parse(fs.readFileSync(PR.RESEARCH, 'utf8'));
  for (const S of [2025, 2026]) {
    const f = C.fitAllX(rows, sides, train(S), {}, {}, { rho: foldP[S].rho });
    const same = JSON.stringify(f.P) === JSON.stringify(foldP[S]);
    const sc = C.scoreX(rows, C.projectX(rows, sides, f.P, f.X, r => r.season === S));
    const st = stored.folds.find(x => x.season === S);
    const agree = Object.keys(st.stats).every(k => Math.abs(r4(sc.stats[k].logScore) - st.stats[k].logScore) < 1e-9 && Math.abs(r4(sc.stats[k].lineLogloss) - st.stats[k].lineLogloss) < 1e-9 && Math.abs(r2(sc.stats[k].mae) - st.stats[k].mae) < 1e-9);
    log(`fold ${S}: constants the same as tools/props.js fit's: ${same}; scores the same as research/props.json's: ${agree}`);
    res.folds[S] = { constantsSame: same, scoresSame: agree };
    if (!same) console.log(JSON.stringify(f.P), '\n', JSON.stringify(foldP[S]));
  }
  /* 3. the archive with every change off against the README's market test */
  const a = C.archiveLines(rows, sides, foldP[2026], {}, D.boxes);
  const m = PR.marketScores(a.lines);
  log(`archive: ${m.lines} lines, ${a.voids} void; log loss ${m.logloss.model} vs ${m.logloss.market} (diff ${m.logloss.diff} ${JSON.stringify(m.logloss.diffCi90)}); Brier ${m.brier.model} vs ${m.brier.market}`);
  res.archive = { lines: m.lines, voids: a.voids, logloss: m.logloss, brier: m.brier, flat3: m.flat.edge3 };
  res.archiveSame = m.lines === stored.folds.find(x => x.season === 2026).market.all.lines && JSON.stringify(m.logloss) === JSON.stringify(stored.folds.find(x => x.season === 2026).market.all.logloss);
  log(`archive the same as research/props.json's: ${res.archiveSame}`);
  fs.writeFileSync(path.join(OUTD, 'cand_fix_verify.json'), JSON.stringify(res, null, 1) + '\n');
}

/* ---------- the selection ---------- */
const GRIDS = {
  open: [0.8, 0.85, 0.9, 0.95, 1],
  ret: [].concat(...[0.8, 0.85, 0.9, 0.95, 1].map(a => [0.75, 0.8, 0.85, 0.9, 0.95, 1].map(b => ({ a, b })))),
  nt: [].concat(...[0.7, 0.75, 0.8, 0.85, 0.9, 0.95, 1].map(r0 => [0.95, 1, 1.05].map(r1 => [r0, r1, 1]))),
  debut: [0, 2, 4, 6, 8, 10, 12],
  kappa: [0, 0.25, 0.5, 0.75, 1],
  lam: [0, 0.25, 0.5, 0.75, 1],
  dE: [-1.5, -0.75, 0, 0.75, 1.5],
  vm: [-0.6, -0.45, -0.3, -0.15, 0, 0.15],
  vEarly: [1, 1.1, 1.2, 1.35, 1.5],
};
const ones = () => Object.fromEntries(PR.STATS.map(k => [k, 1]));
const STAGES = [
  { key: 'sq', what: 'every minutes constant fitted on squared error (aimed at the mean) instead of absolute error (the median)', X: { sq: true } },
  { key: 'cal', what: 'a straight-line calibration of the projected minutes, m + c0 + c1 (m - 24), by least squares', X: { cal: [0, 0] } },
  { key: 'open', what: 'the season-opening prior (his whole last regular season\'s minutes) times a factor', X: { open: 1 } },
  { key: 'ret', what: 'his first game back after missing 3-9 (10+) of the club\'s games: b times a (b)', X: { ret: { a: 1, b: 1 } } },
  { key: 'nt', what: 'a new club: b times r0 on his first game for it, r1 on his 2nd-5th', X: { nt: [1, 1, 1] } },
  { key: 'debut', what: 'each listed player with no game on record claims d minutes in the side\'s scale', X: { debut: 0 } },
  { key: 'kappa', what: 'the side\'s change of minutes handed out in proportion to b^kappa (kappa 1: as now)', X: { kappa: 1 } },
  { key: 'lam', what: 'at a new season, the carried-in part of each rate takes share lambda (per stat) of his whole last regular season\'s rate in place of its closing stretch', X: { lam: {} } },
  { key: 'dE', what: 'the season-start pace bump EARLY_PACE (1.5) moved by dE, fitted with the pace exponent', X: { dE: 0 } },
  { key: 'shrink', what: 'each stat\'s mean pulled toward his own average a game: naive + beta (mu - naive), beta per stat by least squares', X: { shrink: {} } },
  { key: 'phase', what: 'per stat, the regular season\'s mean times what happened over what was projected, by the club\'s games played (0-9, 10-29, 30-59, 60+)', X: { phase: {} } },
  { key: 'vm', what: 'each spread times (projected minutes / 24)^C, C per stat by maximum likelihood', X: { vm: {} } },
  { key: 'vEarly', what: 'each spread times E (per stat, maximum likelihood) while he has under 5 appearances this season', X: { vEarly: {} } },
];

if (mode === '--evalone') {
  /* one fold of one configuration, for the selection's parallel runs */
  const t = process.argv[3], X = JSON.parse(process.argv[4]);
  const r = evalX(X, GRIDS, [t]);
  process.stdout.write('@@' + JSON.stringify({ t, P: r[t].P, X: r[t].X, score: brief(r[t].score) }) + '\n');
}

async function runFolds(X, tests) {
  const { execFile } = require('child_process');
  const one = t => new Promise((res, rej) => execFile(process.execPath, [__filename, '--evalone', t, JSON.stringify(X)], { maxBuffer: 1 << 26 }, (e, so) => {
    if (e) return rej(e); const l = so.split('\n').find(x => x.startsWith('@@')); res(JSON.parse(l.slice(2))); }));
  const out = {}; for (const r of await Promise.all(tests.map(one))) out[r.t] = r; return out;
}

if (mode === '--select') (async () => {
  const tests = ['2025', '2026R'];
  let kept = {};
  log('baseline');
  let cur = await runFolds(kept, tests);
  const steps = [{ key: 'baseline', what: 'tools/props.js as it stands', kept: true, folds: cur }];
  log(`baseline: ${tests.map(t => `${t} ${cur[t].score.meanLogScore}`).join(', ')}`);
  for (const st of STAGES) {
    const X = { ...kept, ...st.X };
    log(`stage ${st.key}`);
    const res = await runFolds(X, tests);
    const d = Object.fromEntries(tests.map(t => [t, r5(res[t].score.meanLogScore - cur[t].score.meanLogScore)]));
    const keep = tests.every(t => d[t] < 0);
    log(`  ${st.key}: mean log score change ${JSON.stringify(d)} -> ${keep ? 'kept' : 'dropped'}; fitted ${JSON.stringify(Object.fromEntries(tests.map(t => [t, res[t].X[st.key]])))}`);
    steps.push({ key: st.key, what: st.what, kept: keep, change: d,
      changeLine: Object.fromEntries(tests.map(t => [t, r5(res[t].score.meanLineLogloss - cur[t].score.meanLineLogloss)])),
      changeMae: Object.fromEntries(tests.map(t => [t, r4(res[t].score.meanMae - cur[t].score.meanMae)])), folds: res });
    if (keep) { kept = X; cur = res; }
    fs.writeFileSync(path.join(OUTD, 'cand_fix_select.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 16) + 'Z', rule: 'kept if the mean log score over the 11 stats falls on both the 2025 fold (fit 2023-2024) and the 2026 regular season (fit 2023-2025, to 12 April)', grids: GRIDS, steps, kept }, null, 1) + '\n');
  }
  /* the rule, frozen before the archive is scored */
  const rule = { frozen: new Date().toISOString().slice(0, 16) + 'Z', kept: Object.keys(kept), X: kept, grids: GRIDS,
    stages: STAGES.filter(s => s.key in kept).map(s => ({ key: s.key, what: s.what })),
    fit: 'for a fold S: cand_fix_lib.js fitAllX on the rows of seasons 2023 to S-1 (2022 warms up), with these X (initial values) and grids; the archive is scored once with the 2026 fold (fit 2023-2025); a new shadow trial would freeze the fit on 2023-2026' };
  fs.writeFileSync(path.join(OUTD, 'cand_fix_rule.json'), JSON.stringify(rule, null, 1) + '\n');
  log(`kept: ${Object.keys(kept).join(', ') || 'nothing'}; the rule is written`);
})().catch(e => { console.error(e); process.exit(1); });

/* ---------- the one scoring of the frozen rule ---------- */
const clipP = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const llOf = (p, o) => o ? -Math.log(clipP(p)) : -Math.log(1 - clipP(p));
/* the walk-forward, the candidate against tools/props.js on the same rows: per stat, and the mean log score's
   difference with a 90% interval resampling games */
function compareWF(Pb, Pc, Xc, sel) {
  const pb = C.projectX(rows, sides, Pb, {}, sel), pc = C.projectX(rows, sides, Pc, Xc, sel);
  const sb = C.scoreX(rows, pb), sc = C.scoreX(rows, pc);
  const g = new Map(), gl = new Map();
  /* per row, the 11 stats' mean log score and mean book-like line log loss, candidate less baseline */
  for (const [i, xb] of pb) {
    const r = rows[i]; if (C.naiveOf(r.f, 'pts') == null) continue;
    const xc = pc.get(i); let d = 0, dl = 0;
    for (const k of PR.ALL) {
      const y = PR.yOf(r.y, k);
      d += (-PR.nbLogPmf(y, xc.mu[k], xc.v[k])) - (-PR.nbLogPmf(y, xb.mu[k], xb.v[k]));
      const nv = C.naiveOf(r.f, k), line = Math.floor(nv) + 0.5, o = y > line ? 1 : 0, j = Math.floor(line) + 1;
      dl += llOf(PR.nbSf(j, xc.mu[k], xc.v[k]), o) - llOf(PR.nbSf(j, xb.mu[k], xb.v[k]), o);
    }
    const a = g.get(r.game) || [0, 0]; a[0] += d / PR.ALL.length; a[1]++; g.set(r.game, a);
    const b = gl.get(r.game) || [0, 0]; b[0] += dl / PR.ALL.length; b[1]++; gl.set(r.game, b);
  }
  return { baseline: brief(sb), candidate: brief(sc), diff: { meanLogScore: r5(sc.meanLogScore - sb.meanLogScore), ci90: PR.bootCI([...g.values()], 4000, 7),
    meanLineLogloss: r5(sc.meanLineLogloss - sb.meanLineLogloss), lineCi90: PR.bootCI([...gl.values()], 4000, 8), meanMae: r4(sc.meanMae - sb.meanMae), minutesMae: r4(sc.minutes.mae - sb.minutes.mae) } };
}
/* the early season (each season's first 121 regular-season games, the trial's span): points' bias and the chance of the
   Over at the book-like line, said against happened */
function earlyLean(P, X, S) {
  const first = new Set(D.games.filter(g => g.season === S && g.type === 'REG' && g.status === 'final').slice(0, 121).map(g => g.game_id));
  const pr = C.projectX(rows, sides, P, X, r => first.has(r.game));
  let n = 0, e = 0, said = 0, hap = 0, N = 0;
  for (const [i, x] of pr) { const r = rows[i]; if (x.m < 8 || C.naiveOf(r.f, 'pts') == null) continue; n++; e += x.mu.pts - r.y.pts;
    for (const k of PR.ALL) { const nv = C.naiveOf(r.f, k), line = Math.floor(nv) + 0.5, y = PR.yOf(r.y, k); said += PR.nbSf(Math.floor(line) + 1, x.mu[k], x.v[k]); hap += y > line ? 1 : 0; N++; } }
  return { players: n, ptsBias: r4(e / n), overSaid: r4(said / N), overHappened: r4(hap / N) };
}
/* how sure: the mean distance of a chance from 50%, and the lines where the model and DraftKings differ by 10 points */
function sureness(lines) {
  const o = x => x.result === 'over' ? 1 : 0;
  const far = lines.filter(x => Math.abs(x.pModel - x.pMarket) >= 0.10), near = lines.filter(x => Math.abs(x.pModel - x.pMarket) < 0.05);
  const def = xs => xs.reduce((s, x) => s + llOf(x.pModel, o(x)) - llOf(x.pMarket, o(x)), 0);
  const tot = def(lines);
  return { modelFrom50: r4(lines.reduce((s, x) => s + Math.abs(x.pModel - 0.5), 0) / lines.length), marketFrom50: r4(lines.reduce((s, x) => s + Math.abs(x.pMarket - 0.5), 0) / lines.length),
    far10: { share: r4(far.length / lines.length), deficitShare: r4(def(far) / tot), perLine: r4(def(far) / far.length) }, near5: { share: r4(near.length / lines.length), perLine: r4(def(near) / near.length) } };
}
function archiveCompare(Pb, Pc, Xc) {
  const ab = C.archiveLines(rows, sides, Pb, {}, D.boxes), ac = C.archiveLines(rows, sides, Pc, Xc, D.boxes);
  if (ab.lines.length !== ac.lines.length || ab.lines.some((x, i) => x.game !== ac.lines[i].game || x.stat !== ac.lines[i].stat || x.line !== ac.lines[i].line)) throw new Error('the two models graded different lines');
  const mb = PR.marketScores(ab.lines), mc = PR.marketScores(ac.lines);
  const o = x => x.result === 'over' ? 1 : 0;
  const g = new Map(), gB = new Map();
  ab.lines.forEach((x, i) => { const y = ac.lines[i]; const a = g.get(x.game) || [0, 0]; a[0] += llOf(y.pModel, o(y)) - llOf(x.pModel, o(x)); a[1]++; g.set(x.game, a);
    const b = gB.get(x.game) || [0, 0]; b[0] += (y.pModel - o(y)) ** 2 - (x.pModel - o(x)) ** 2; b[1]++; gB.set(x.game, b); });
  const byStat = {};
  for (const k of PR.ALL) { const ib = ab.lines.map((x, i) => i).filter(i => ab.lines[i].stat === k); if (!ib.length) continue;
    const sb = PR.marketScores(ib.map(i => ab.lines[i])), sc = PR.marketScores(ib.map(i => ac.lines[i]));
    byStat[k] = { lines: ib.length, overRate: sb.overRate, said: { baseline: sb.modelSaid, candidate: sc.modelSaid, market: sb.marketSaid }, logloss: { baseline: sb.logloss.model, candidate: sc.logloss.model, market: sb.logloss.market } }; }
  const strip = m => ({ lines: m.lines, games: m.games, overRate: m.overRate, modelSaid: m.modelSaid, marketSaid: m.marketSaid, logloss: m.logloss, brier: m.brier, guess: m.guess, flat: m.flat });
  return { voids: ab.voids, noCall: ab.noCall, baseline: { ...strip(mb), sureness: sureness(ab.lines) }, candidate: { ...strip(mc), sureness: sureness(ac.lines) },
    candidateMinusBaseline: { logloss: r4(mc.logloss.model - mb.logloss.model), ci90: PR.bootCI([...g.values()]), brier: r4(mc.brier.model - mb.brier.model), brierCi90: PR.bootCI([...gB.values()], 10000, 3) }, byStat };
}
if (mode === '--score') {
  const rule = JSON.parse(fs.readFileSync(path.join(OUTD, 'cand_fix_rule.json'), 'utf8'));
  const foldP = JSON.parse(fs.readFileSync(path.join(OUTD, 'fold_params.json'), 'utf8'));
  log(`the frozen rule (${rule.frozen}): ${rule.kept.join(', ')}`);
  const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', rule: rule.kept, folds: {}, walkForward: {}, early: {}, archive: null, frozen: null };
  const cand = {};
  for (const S of [2024, 2025, 2026]) {
    log(`fold ${S}: fitting the candidate on 2023-${S - 1}`);
    cand[S] = C.fitAllX(rows, sides, train(S), rule.X, rule.grids, { rho: foldP[S].rho });
    out.folds[S] = { fitOn: `2023-${S - 1}`, P: cand[S].P, X: cand[S].X };
  }
  const tests = { 2024: r => r.season === 2024, 2025: r => r.season === 2025, '2026R': TESTS['2026R'], '2026P': r => r.season === 2026 && (r.type === 'POST' || r.date > REG_END) };
  for (const [t, sel] of Object.entries(tests)) { const S = foldOf(t); out.walkForward[t] = compareWF(foldP[S], cand[S].P, cand[S].X, sel); log(`walk-forward ${t}: mean log score ${JSON.stringify(out.walkForward[t].diff)}`); }
  for (const S of [2024, 2025, 2026]) out.early[S] = { baseline: earlyLean(foldP[S], {}, S), candidate: earlyLean(cand[S].P, cand[S].X, S) };
  log('the archive, once');
  out.archive = archiveCompare(foldP[2026], cand[2026].P, cand[2026].X);
  log(`archive: log loss baseline ${out.archive.baseline.logloss.model}, candidate ${out.archive.candidate.logloss.model}, DraftKings ${out.archive.baseline.logloss.market}; candidate - DraftKings ${out.archive.candidate.logloss.diff} ${JSON.stringify(out.archive.candidate.logloss.diffCi90)}`);
  log('the constants a new shadow trial would freeze: fit on 2023-2026');
  const fr = C.fitAllX(rows, sides, r => r.season >= 2023 && r.season <= 2026, rule.X, rule.grids, { fitRho: true });
  out.frozen = { fitOn: '2023-2026', P: fr.P, X: fr.X };
  fs.writeFileSync(path.join(OUTD, 'cand_fix_score.json'), JSON.stringify(out, null, 1) + '\n');
  log('results/cand_fix_score.json written');
}

module.exports = { evalX, brief, rows, sides, train, TESTS, R, D, GRIDS, STAGES };
