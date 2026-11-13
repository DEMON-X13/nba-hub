/* The one-shot test's scorer (PLAN.md sections 3 and 4). Research only.
 *
 *   node research/props_v3/test/score.js --dev-check
 *       on the 2023-24 development lines, through this scorer's own path (the clean six-column lines, ma_lib.js's
 *       rows, dev_lib.js's F fields, the sample), with the forward-chained nudge of ma_dev_bar.json: T1 and T2 must give
 *       back ma_dev_bar.json's D1 and D2 to the digit, or it throws; V4, V5 and V6 are run on the development lines.
 *       Writes research/props_v3/results/ma_score_devcheck.json.
 *   PROPS_V3_PREREG=<sha> node research/props_v3/test/score.js --test
 *       THE TEST STEP ONLY, after the preregistration is committed, pushed and audited sound, and the 2022-23 lines fetched
 *       and cleaned (test/fetch_dk40_2023_logged.sh, which finishes the fetch's record on origin): V-hash, the left-out
 *       games, V-fetch, V0 to V3 (test/validity_ma.js), V4, V5, V6 reported, each printed as it passes, no score printed
 *       until all have; then the bar of PLAN.md 4.2, once, and the reports of 4.5. Writes
 *       research/props_v3/results/ma_test_2023.json. NEVER RUN: D8 stopped the plan (dev_results.md).
 *
 * The bar (PLAN.md 4.2): n is the frozen nudge (frozen/ma_frozen.json) on each graded test line of the sample. T1: in
 * logit P(Over) = F + b n on all of them (a ridge of 0.001 on F alone), b's 90% interval by 1,000 resamples of games
 * (seed 0, warm-started) wholly above 0.25, z = b / SE (SE = the interval's width / 3.29) at least 4 (since the review of
 * 13 November 2026, finding F2: the 0.25 alone moves with the nudge's scale), and at least 5% of n's variance outside F's
 * span. T2: F cross-fitted (5 folds by game, a ridge of 5 but on the per-stat intercepts), the paired log-loss
 * difference's 90% interval (10,000 resamples of games, seed 0) wholly below -0.0001, Brier's below -0.00005, and on no
 * stat the log-loss interval wholly above 0. PASS if both; FAIL otherwise ("information shown" where T1 alone holds).
 *
 * Since the review of 13 November 2026 (findings F1 and F4): the 31 left-out games are read from espn_validate40.json's
 * games[].gid (they were read as Object.keys of that array, which gave none) and must be exactly test/seen_2023.json's 31,
 * or nothing is scored; V-hash reads PREREG_HASHES.json from the preregistration commit (git show), never the working
 * tree, refuses a list that does not name every input test/inputs.js requires (data among them) or any input whose
 * bytes moved, and holds the clean lines and starts to the SHA-256 the fetch's finished record on origin carries, and
 * the fetched csv, cut by the cleaner's own rule, to the clean lines byte for byte (until the review the lines were held
 * to a sibling file the cleaner wrote in the same gitignored cache).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const V = require('../ma/dev_lib.js');
const M = require('../ma/ma_lib.js');
const VM = require('./validity_ma.js');
const { S, T, STATS, mean, ll, br, sigm, logit, PM, B_MIN, ORTH_MIN, M_LL, M_BR, Z_MIN, zOf } = V;
const ROOT = M.ROOT;
const r6 = v => (typeof v === 'number' ? +v.toPrecision(6) : v);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const t0 = Date.now();
const say = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);

/* the bar, on graded sample lines with their nudge */
function bar(Lev, nArr) {
  const Rfam = Lev.map(S.bigSparse), zcf = S.crossFitBig(Lev);
  const tb = V.t1Boot(Lev, nArr, 1000, 0, Rfam), t1r = S.T1big(Lev, nArr, Rfam), t2 = S.T2(Lev, nArr, zcf, 10000, 0);
  const byStat = {}; for (const s of STATS) { const ix = Lev.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0); const z = S.T2(ix.map(i => Lev[i]), Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => zcf[i]), 10000, 0); byStat[s] = { lines: ix.length, ll: z.ll, llCi: z.llCi, br: z.br }; }
  const z = zOf(tb.b, tb.lo, tb.hi), T1met = !t1r.collinear && t1r.orth >= ORTH_MIN && tb.lo > B_MIN && z >= Z_MIN;
  const T2met = t2.llCi[1] < -M_LL && t2.brCi[1] < -M_BR && Math.max(...Object.values(byStat).map(v => v.llCi[0])) <= 0;
  return { T1: { b: tb.b, lo: tb.lo, hi: tb.hi, resamples: tb.resamples, z, orth: t1r.orth, robust: { lo: t1r.lo, hi: t1r.hi } }, T2: { ll: t2.ll, llCi: t2.llCi, br: t2.br, brCi: t2.brCi, games: t2.games, lines: t2.lines }, byStat, T1met, T2met, zcf };
}
/* V4 (and V4b, reported): the nudge on early exits, by validity.js's early-exit lines (P23's projected minutes on the
   box's list 24+, played his side's previous game, played under 12) */
function v4(Lev, nArr, zcf, mproj, prevOf) {
  const idx = new Map(Lev.map((x, i) => [x, i])), base = Lev.filter(x => mproj.get(x.game + '|' + x.player) >= 24 && prevOf.get(x.game + '|' + x.player) === true);
  const exit = base.filter(x => x.minPlayed < 12), rest = base.filter(x => x.minPlayed >= 12);
  const shift = x => sigm(x.zq + nArr[idx.get(x)]) - x.q, gain = x => { const i = idx.get(x); return ll(sigm(zcf[i] + nArr[i]), x.o) - ll(sigm(zcf[i]), x.o); };
  const r = { exits: new Set(exit.map(x => x.game + '|' + x.player)).size, exitLines: exit.length, shiftExit: mean(exit.map(shift)), shiftRest: mean(rest.map(shift)), gainExitLessRest: mean(exit.map(gain)) - mean(rest.map(gain)) };
  r.underwardMore = r.shiftRest - r.shiftExit;
  r.holds = r.exits >= 40 && r.underwardMore <= 0.005;
  return r;
}
const v5 = Lev => { const r = { share: mean(Lev.map(x => (x.nPl >= 2 ? 1 : 0))) }; r.holds = r.share >= 0.9; return r; };
const band = q => [0.35, 0.4, 0.45, 0.5, 0.55, 0.6].filter(b => q > b).length;
const mixOfBands = Lev => Object.fromEntries(STATS.map(s => { const a = Lev.filter(x => x.stat === s); return [s, [0, 1, 2, 3, 4, 5, 6].map(k => a.filter(x => band(x.q) === k).length / (a.length || 1))]; }));
/* P23's projected minutes on the box's list, and whether he played his side's previous game, for a season */
function minutesAndPrev(D, P, season) {
  const Rr = PM.replay(D.games, D.boxes, D.tbox, { collect: true, from: season }), rows = Rr.rows.filter(r => r.season === season), mins = PM.backtestMinutes(rows, PM.sidesOf(rows), P.min, () => true);
  const mproj = new Map(rows.map((r, i) => [r.game + '|' + r.id, mins[i]]));
  const prevOf = new Map(), bySide = new Map();
  for (const g of D.games) if (g.status === 'final' && D.boxes[g.game_id] && g.season === season) for (const t of [g.home, g.away]) { if (!bySide.has(t)) bySide.set(t, []); bySide.get(t).push(g); }
  for (const [t, list] of bySide) { list.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)); let prev = null; for (const g of list) { const now = new Set((D.boxes[g.game_id][t] || []).filter(r => r.min > 0 && !r.dnp).map(r => r.id)); for (const id of now) prevOf.set(g.game_id + '|' + id, prev ? prev.has(id) : null); prev = now; } }
  return { mproj, prevOf, rows };
}

function devCheck() {
  const P = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v3', 'results', 'ma_p23.json'), 'utf8')).P;
  const DB = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v3', 'results', 'ma_dev_bar.json'), 'utf8'));
  const OO = JSON.parse(fs.readFileSync(path.join(M.CACHE, 'ma', 'dev_oof.json'), 'utf8'));
  const D = M.loadData(), gamesById = new Map(D.games.map(g => [g.game_id, g]));
  const L = M.buildRows(M.lines2024(gamesById), D, P); M.attachOutcomes(L, D.boxes); V.derive(L, 2024);
  const W = new Map(OO.final.weights.map(z => [z.month, z])), feat = V.featFinal(OO.final);
  const oofKeys = new Set(OO.keys), Lev = V.sample(L).filter(x => x.month >= '2023-12');
  if (Lev.length !== OO.keys.length) throw new Error(`the scorer's development lines: ${Lev.length}, ma_dev_bar.json's ${OO.keys.length}`);
  /* the development bar's out-of-fold order (month by month), so that every resample is the same */
  const pos = new Map(OO.keys.map((k, i) => [k, i])); Lev.sort((a, b) => pos.get(a.game + '|' + a.player + '|' + a.stat) - pos.get(b.game + '|' + b.player + '|' + b.stat));
  if (Lev.some((x, i) => !oofKeys.has(x.game + '|' + x.player + '|' + x.stat) || OO.keys[i] !== x.game + '|' + x.player + '|' + x.stat)) throw new Error('not the development bar\'s lines');
  const nArr = Float64Array.from(Lev, x => { const z = W.get(x.month), f = feat(x); let s = 0; for (let a = 0; a < f.length; a++) s += z.w[a] * f[a]; return s; });
  const b = bar(Lev, nArr);
  const want = { b: DB.D1.b, lo: DB.D1.lo, hi: DB.D1.hi, ll: DB.D2.ll, llCi: DB.D2.llCi, br: DB.D2.br, brCi: DB.D2.brCi };
  const got = { b: r6(b.T1.b), lo: r6(b.T1.lo), hi: r6(b.T1.hi), ll: r6(b.T2.ll), llCi: b.T2.llCi.map(r6), br: r6(b.T2.br), brCi: b.T2.brCi.map(r6) };
  if (JSON.stringify(got) !== JSON.stringify(want)) throw new Error(`the scorer does not give back D1 and D2: ${JSON.stringify(got)} against ${JSON.stringify(want)}`);
  say(`dev-check: T1 b ${got.b} [${got.lo}, ${got.hi}], T2 ${got.ll} [${got.llCi}] br ${got.br}: ma_dev_bar.json's D1 and D2 to the digit`);
  const { mproj, prevOf } = minutesAndPrev(D, P, 2024);
  const out = { what: "the scorer's development check: D1 and D2 given back to the digit through the scorer's own path; V4, V5 and V6 on the development lines", D1D2: { got, want, same: true }, T1met: b.T1met, T2met: b.T2met, v4: v4(Lev, nArr, b.zcf, mproj, prevOf), v5: v5(Lev), v6: { bandsByStat: mixOfBands(Lev) } };
  say(`dev V4: ${JSON.stringify(out.v4)}; V5 ${JSON.stringify(out.v5)}`);
  fs.writeFileSync(path.join(ROOT, 'research', 'props_v3', 'results', 'ma_score_devcheck.json'), JSON.stringify(out, (k, v) => r6(v), 1) + '\n');
}

/* the 31 left-out games (PLAN.md 3.1): espn_validate40.json's games[].gid of 2022-23's regular season in the window */
const WINDOW = ['2022-10-18', '2023-04-09'];
function seenFromValidate(gamesById, file = path.join(ROOT, 'research', 'props_v2', 'results', 'espn_validate40.json')) {
  const J = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!Array.isArray(J.games) || J.games.some(g => !g || typeof g.gid !== 'string')) throw new Error(`${path.relative(ROOT, file)}: games is not a list of games with a gid`);
  return new Set(J.games.map(g => g.gid).filter(k => { const g = gamesById.get(k); return g && g.season === 2023 && g.type === 'REG' && g.date >= WINDOW[0] && g.date <= WINDOW[1]; }));
}
const SEEN_FILE = path.join(ROOT, 'research', 'props_v3', 'test', 'seen_2023.json');
function leftOut(gamesById) {
  const built = seenFromValidate(gamesById), listed = JSON.parse(fs.readFileSync(SEEN_FILE, 'utf8')).ids;
  if (listed.length !== 31 || new Set(listed).size !== 31) throw new Error(`refused: test/seen_2023.json does not list 31 games (${listed.length})`);
  if (built.size !== 31 || listed.some(k => !built.has(k))) throw new Error(`refused: the left-out games read from espn_validate40.json (${built.size}) are not test/seen_2023.json's 31`);
  return built;
}
/* the test's lines of the sample's window, the 31 left out, both prices present (PLAN.md 3.1) */
function testLines(raw, gamesById, seen) {
  const PF = require(path.join(ROOT, 'tools', 'props_feed.js')), lines = []; let droppedSeen = 0; const seenIn = new Set();
  for (const v of raw) { const g = gamesById.get(v[0]); if (!g || g.season !== 2023 || g.type !== 'REG' || g.date < WINDOW[0] || g.date > WINDOW[1] || !STATS.includes(v[2])) continue;
    if (seen.has(v[0])) { droppedSeen++; seenIn.add(v[0]); continue; }
    const over = PF.propAmerican(v[4]), under = PF.propAmerican(v[5]);
    if (over == null || under == null || !Number.isFinite(+v[3])) continue; lines.push({ game: v[0], player: v[1], stat: v[2], line: +v[3], over, under, start: null }); }
  return { lines, leftOut: { games: seen.size, gamesInFetch: seenIn.size, lines: droppedSeen } };
}
/* V-hash (PLAN.md 3.4, revised): every input test/inputs.js requires, held to the preregistration commit's
   PREREG_HASHES.json; the clean lines and starts to the fetch's finished record on origin; the fetched csv, cut by the
   cleaner's rule, to the clean lines */
function vHash({ root = ROOT, prereg, required, cache = M.CACHE, csv = path.join(ROOT, 'research', 'props_v2', 'cache', 'props40_2023.csv') }) {
  const { execFileSync } = require('child_process'), FR = require('./fetch_record.js'), C = require('./lines_clean_2023.js');
  const full = (() => { try { return execFileSync('git', ['rev-parse', '--verify', `${prereg}^{commit}`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim(); } catch (e) { return ''; } })();
  if (!full) throw new Error('refused: no preregistration commit (PROPS_V3_PREREG)');
  let H; try { H = JSON.parse(execFileSync('git', ['show', `${full}:research/props_v3/PREREG_HASHES.json`], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 26 })); } catch (e) { throw new Error(`refused: the preregistration commit ${full.slice(0, 12)} holds no readable research/props_v3/PREREG_HASHES.json`); }
  const want = required(), named = H && H.files && typeof H.files === 'object' ? H.files : {};
  const missing = Object.keys(want).filter(k => !(k in named));
  if (missing.length) throw new Error(`V-hash: stop, nothing is scored: the preregistration's PREREG_HASHES.json does not name ${missing.length} required input(s): ${missing.slice(0, 6).join(', ')}`);
  const moved = Object.keys(want).filter(k => named[k] !== want[k]);
  if (moved.length) throw new Error(`V-hash: stop, nothing is scored: ${moved.length} input(s) are not as the preregistration recorded them: ${moved.slice(0, 6).join(', ')}`);
  const R = FR.finishedRecord(root, full), lf = path.join(cache, 'dk40_2023_lines.csv'), sf = path.join(cache, 'dk40_2023_starts.csv');
  const recLines = R.rec.sha256 && R.rec.sha256['research/props_v3/cache/dk40_2023_lines.csv'], recStarts = R.rec.sha256 && R.rec.sha256['research/props_v3/cache/dk40_2023_starts.csv'];
  if (!fs.existsSync(lf) || FR.sha256(fs.readFileSync(lf)) !== recLines) throw new Error('V-hash: stop, nothing is scored: the clean lines are not the ones the fetch\'s record on origin holds');
  if (!fs.existsSync(sf) || FR.sha256(fs.readFileSync(sf)) !== recStarts) throw new Error('V-hash: stop, nothing is scored: the clean starts are not the ones the fetch\'s record on origin holds');
  if (!fs.existsSync(csv) || C.cleanBody(fs.readFileSync(csv, 'utf8')) !== fs.readFileSync(lf, 'utf8')) throw new Error('V-hash: stop, nothing is scored: the fetched csv, cut to its six columns, is not the clean lines');
  return { prereg: full, inputs: Object.keys(want).length, record: R.commit, recovered: (R.rec.recovered || []).length };
}

function test() {
  const prereg = process.env.PROPS_V3_PREREG || '';
  /* V-hash */
  const vh = vHash({ prereg, required: require('./inputs.js').required });
  say(`V-hash: ${vh.inputs} inputs as the preregistration ${vh.prereg.slice(0, 12)} recorded them; the clean lines as the fetch's record ${vh.record.slice(0, 12)} on origin holds them`);
  const linesF = path.join(M.CACHE, 'dk40_2023_lines.csv');
  const FZ = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v3', 'frozen', 'ma_frozen.json'), 'utf8')), P = FZ.P23;
  const D = M.loadData(), gamesById = new Map(D.games.map(g => [g.game_id, g]));
  /* the left-out games, printed first */
  const seen = leftOut(gamesById);
  const tl = testLines(M.readLines6(linesF), gamesById, seen), lines = tl.lines;
  say(`the left-out games: ${tl.leftOut.games} (test/seen_2023.json), ${tl.leftOut.gamesInFetch} of them in the fetch, ${tl.leftOut.lines} of their lines dropped`);
  const L = M.buildRows(lines, D, P); M.attachOutcomes(L, D.boxes); V.derive(L, 2023);
  const Lev = V.sample(L);
  /* V-fetch */
  const vf = { games: new Set(Lev.map(x => x.game)).size, graded: Lev.length, leftOut: tl.leftOut }; vf.holds = vf.games >= 900 && vf.graded >= 60000;
  if (!vf.holds) { say(`V-fetch: ${JSON.stringify(vf)}: VOID`); return finish({ verdict: 'VOID (V-fetch)', vf }); }
  say(`V-fetch: ${vf.games} games, ${vf.graded} graded lines: holds`);
  /* V0 to V3: validity_ma.js on the fetched lines with P23, the naive spread on 2021-22 and MA's data */
  const Rr = PM.replay(D.games, D.boxes, D.tbox, { collect: true, from: 2022 });
  const NV = PM.fitNaiveVar(Rr.rows, r => r.season === 2022);
  const fr = VM.readFetchedLines(path.join(ROOT, 'research', 'props_v2', 'cache', 'props40_2023.csv'), gamesById, 2023, '2022-10-18', '2023-04-09', seen);
  const vc = VM.checks(VM.gradeLinesWith({ games: D.games, boxes: D.boxes, rows: Rr.rows }, P, NV, fr.rec), fr.startOf, VM.REF());
  if (!vc.holds) { say(`V0 to V3: ${JSON.stringify({ v0: vc.v0.holds, v2: vc.v2, v3: vc.v3.holds })}: VOID`); return finish({ verdict: 'VOID (V0 to V3)', vf, validity: vc }); }
  say(`V0 to V3 hold (pre-game ${vc.v1 ? vc.v1.preGame : 'no stamps'})`);
  /* the frozen nudge */
  const feat = V.featFinal({ stats: FZ.form.stats, secondaries: FZ.form.secondaries }), w = FZ.nudge.w;
  const nArr = Float64Array.from(Lev, x => { const f = feat(x); let s = 0; for (let a = 0; a < f.length; a++) s += w[a] * f[a]; return s; });
  const { mproj, prevOf } = minutesAndPrev(D, P, 2023);
  const zcf0 = S.crossFitBig(Lev);
  const c4 = v4(Lev, nArr, zcf0, mproj, prevOf), c5 = v5(Lev);
  if (!c4.holds) { say(`V4: ${JSON.stringify(c4)}: VOID`); return finish({ verdict: 'VOID (V4)', vf, validity: vc, v4: c4 }); }
  say(`V4 holds`);
  if (!c5.holds) { say(`V5: ${JSON.stringify(c5)}: VOID`); return finish({ verdict: 'VOID (V5)', vf, validity: vc, v4: c4, v5: c5 }); }
  say(`V5 holds`);
  const v6 = { bandsByStat: mixOfBands(Lev) };
  /* the bar, once */
  const b = bar(Lev, nArr);
  const verdict = b.T1met && b.T2met ? 'PASS' : b.T1met ? 'FAIL (information shown, but the frozen nudge does not help at its size)' : 'FAIL';
  say(`T1 b ${b.T1.b.toFixed(3)} [${b.T1.lo.toFixed(3)}, ${b.T1.hi.toFixed(3)}] z ${b.T1.z.toFixed(2)}: ${b.T1met ? 'met' : 'not met'}; T2 ${b.T2.ll.toExponential(3)} [${b.T2.llCi.map(v => v.toExponential(2))}]: ${b.T2met ? 'met' : 'not met'}`);
  /* reported beside, deciding nothing */
  const eOf = x => { const r = S.eSparse(x); let s = x.zq; for (let q = 0; q < 3; q++) s += FZ.E.eb[r.idx[q]] * r.val[q]; return s; };
  const zMA = Float64Array.from(Lev, (x, i) => eOf(x) + nArr[i]), zE = Float64Array.from(Lev, eOf), zq = Float64Array.from(Lev, x => x.zq);
  const reports = { maLessDK: V.paired(Lev, zMA, zq), eAloneLessDK: V.paired(Lev, zE, zq), calib: {}, byMonth: {} };
  for (const s of STATS) { const ix = Lev.map((x, i) => (x.stat === s ? i : -1)).filter(i => i >= 0), Ls = ix.map(i => Lev[i]); reports.calib[s] = V.calibStat(Ls, Float64Array.from(ix, i => zMA[i]), Float64Array.from(Ls, x => x.zq)); }
  for (const mo of [...new Set(Lev.map(x => x.month))].sort()) { const ix = Lev.map((x, i) => (x.month === mo ? i : -1)).filter(i => i >= 0); reports.byMonth[mo] = S.T2(ix.map(i => Lev[i]), Float64Array.from(ix, i => nArr[i]), Float64Array.from(ix, i => b.zcf[i]), 2000, 0); }
  return finish({ verdict, vf, validity: { v0: vc.v0, v1: vc.v1, v2: vc.v2, v3: vc.v3 }, v4: c4, v5: c5, v6, bar: { T1: b.T1, T2: b.T2, byStat: b.byStat, T1met: b.T1met, T2met: b.T2met }, reports });
}
function finish(o) {
  const file = path.join(ROOT, 'research', 'props_v3', 'results', 'ma_test_2023.json');
  fs.writeFileSync(file, JSON.stringify({ what: "the one-shot test's result (PLAN.md sections 3 and 4)", ...o }, (k, v) => r6(v), 1) + '\n');
  say(`verdict: ${o.verdict}`);
}
module.exports = { bar, v4, v5, mixOfBands, minutesAndPrev, seenFromValidate, leftOut, testLines, vHash, WINDOW };
if (require.main === module) {
  if (process.argv.includes('--dev-check')) devCheck();
  else if (process.argv.includes('--test')) test();
  else { console.error('usage: --dev-check | --test'); process.exit(1); }
}
