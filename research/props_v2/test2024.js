/* The 2023-24 test (README, "Recommendation", step 2): candidate A, exactly as frozen at 18:41 UTC with its 2024 fold's
 * constants (fitted on 2023; 2022 warms up), scored once against DraftKings' provider-40 main lines of the 2023-24
 * regular season, by the bar the README wrote before any of those lines was fetched. This scorer was written, reviewed
 * and committed before it was ever run on them (README, "The 2023-24 test: the scorer").
 *
 *   node research/props_v2/test2024.js --check
 *       the reproduction. It reads no 2023-24 line and prints no 2023-24 score:
 *       (a) the scorer's own reader, selection, grading and scoring, run on the 2026 play-in and playoff archive
 *           (data/props_2026.csv written out in the fetch's columns to a temporary file outside cache/, and read back
 *           through the reader the test uses) with the 2026 fold, give results/cand_fix_score.json's archive block to
 *           the digit: lines, games, voids, both models' log loss and Brier with their intervals, each less
 *           DraftKings, A less tools/props.js, the flat bets and the units with their intervals;
 *       (b) A's 2024 fold, fitted again on 2023 as cand_fix.js --score fitted it, is results/cand_fix_score.json's
 *           folds["2024"] exactly, and tools/props.js's 2024 fold (results/fold_params.json) is research/props.json's;
 *       (c) B's yardstick, the share of a model's disagreement a blend keeps, gives results/cand_blend.json's on the
 *           archive (its pooled share and each stat's, with their intervals);
 *       (d) the functions copied here from cand_fix.js and cand_blend.js are theirs to the character, and the columns
 *           are fetch_dk40.js's and validity.js's;
 *       (e) the archive's six base stats, through the same path, are graded as validity.js graded them
 *           (results/validity_ref.json: its count of lines and games), the count --score holds the fetched lines to;
 *       (f) the 2023-24 rows themselves: tools/props.js's 2024 fold and A's, projected on every 2023-24 row and scored
 *           as cand_fix.js --score scored them, give results/cand_fix_score.json's walkForward["2024"] to the digit, so
 *           the box scores the lines are graded on, and the features the projections read, are the ones published;
 *       (g) FROZEN holds every module of the repository the scorer loads, those validity.js requires, and every data
 *           file the run reads; and the bar's figures before their rounding round to the figures the bar reads.
 *       Throws on any difference. Writes results/test2024_check.json. About 45 seconds.
 *   node research/props_v2/test2024.js --score
 *       the test, once. It refuses, writing nothing, unless results/test2024.json does not exist (decided once, never
 *       revisited; a file there that is not a whole result, or a part left by a run cut off while writing, refuses with
 *       its own words), the scorer and every file it stands on are committed and unchanged since the last commit, and
 *       cache/validity_2024.json is the check of props40_2024.csv on the registered thresholds, with the SHA-256 of the
 *       bytes it read. Then the reproduction above, in the same run, and only then does it read cache/props40_2024.csv
 *       and cache/props40_reads.json, once each: it refuses if they are not the bytes the validity check read, if a game
 *       of the window was never read or its read failed (provider 40 has not answered it: the fetch is run again, and a
 *       game that fails on every try is the owner's call, listed in test2024_accept.json), or if its lines are not the
 *       ones the validity check graded (the same count of graded lines on the same count of games).
 *       If the validity check is VOID (V0, V2 or V3 did not hold), that is the outcome: it writes results/test2024.json
 *       with the verdict VOID and the check's figures, scores nothing, and every later run refuses. Otherwise it grades
 *       the bar's lines, scores A and tools/props.js on the very same lines, applies the bar and writes
 *       results/test2024.json: aggregates only, never a line, a price, a player id or a row of the cache. The result is
 *       written into a part file of its own and then linked to its path, so a run cut off while writing never leaves a
 *       file that reads as decided, and of two runs only the first is kept. About two and a half minutes, most of it the
 *       reproduction and B's yardstick. Nothing is fitted, tuned or chosen in it.
 *
 * The lines: every row of the fetch's csv on a game of data/games.csv of type REG dated 24 October 2023 to 14 April 2024
 * (the play-in, from the 16th, is left out; games.csv carries no preseason), on the six base stats, with both prices.
 * The fetch writes one row a game, player and stat, so two such rows mean a broken cache, and the reader throws. They are
 * graded as cand_fix_lib.js archiveLines graded the archive (tools/props.js marketTest's rule): a player who did not play
 * is void, one who played with no game on record before has no call and is counted and left out, and a line equal to the
 * stat is a push and left out. DraftKings' fair chance is the hub's rule, the whole margin on the Over.
 *
 * The bar, decided once on every graded line, each test read on its figure as the study reports it (tools/props.js
 * bootCI's interval, 10,000 resamples of games, seed 0, to six decimals; units to the cent): PASS only if (1) log loss,
 * A less DraftKings' fair chance, has its 90% interval wholly below zero, (2) Brier the same, and (3) flat one-unit bets
 * at a 3-point edge over the price's implied chance (margin left in), both sides together, are up. Otherwise FAIL. An
 * interval that touches zero is not wholly below it, and units of exactly zero are not up. Reported beside it, deciding
 * nothing: tools/props.js's own score, A less tools/props.js, the stats one by one, how sure each model is, the units by
 * side, the share of A's disagreement a blend keeps, by stat (B's yardstick), the bar's three figures before their
 * rounding and what the tests would read on them, and every run of the validity check its log keeps. If V1 did not
 * show the lines pre-game, every report of the result says "pre-game inferred, not shown": shown only where 95% or more
 * of the graded lines are stamped before the start, counted here in whole lines, and where validity.js says so too.
 *
 * Seasons up to 2026 only (cand_fix_lib.js loadData, through cut2026.js). Nothing of 2026-27 is read. tools/props.js is
 * required, never changed. For test2024_test.js only, TEST2024_CACHE and TEST2024_OUT point the scorer at a folder of
 * made-up lines and a result file of their own; the real run sets neither, one without the other is refused, and both
 * must lie outside research/props_v2/, compared with links followed, so neither reaches the real cache or results/
 * (a fixture's own files may not be links out of its folder either). A copy of the cache is beyond any such test.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const PR = require('../../tools/props.js');
const F = require('../../tools/props_feed.js');
const REC = require('../../tools/props_record.js');
const C = require('./cand_fix_lib.js');
const V = require('./validity_lib.js');

const HERE = __dirname, ROOT = path.join(HERE, '..', '..'), OUTD = path.join(HERE, 'results');
const REAL_CACHE = path.join(HERE, 'cache'), REAL_OUT = path.join(OUTD, 'test2024.json'), CHECK_OUT = path.join(OUTD, 'test2024_check.json');
const ACCEPT = path.join(HERE, 'test2024_accept.json');
const WINDOW = { type: 'REG', from: '2023-10-24', to: '2024-04-14', stats: PR.STATS };
const COLS = ['game_id', 'player_id', 'stat', 'line', 'over', 'under', 'last_updated'];
/* V1's bar in whole percent: 95% or more of the graded lines stamped before the start (validity_lib.js TH, held by the
   check) */
const V1_PCT = 95;
/* what the run stands on, committed and unchanged before it reads a line: the code, the published results it
   reproduces, and the data (the schedule, the archive and the box scores of every season cut2026.js opens) */
const DATA_FROZEN = ['data/games.csv', 'data/props_2026.csv', ...[2022, 2023, 2024, 2025, 2026].flatMap(s => [`data/box_${s}.csv`, `data/teambox_${s}.jsonl`])];
const FROZEN = ['research/props_v2/test2024.js', 'research/props_v2/cand_fix_lib.js', 'research/props_v2/cand_fix.js', 'research/props_v2/cand_blend.js',
  'research/props_v2/cut2026.js', 'research/props_v2/validity.js', 'research/props_v2/validity_lib.js', 'research/props_v2/fetch_dk40.js',
  'research/props_v2/cand_select_lib.js', 'tools/lib.js',
  'research/props_v2/results/cand_fix_rule.json', 'research/props_v2/results/cand_fix_score.json', 'research/props_v2/results/fold_params.json',
  'research/props_v2/results/cand_blend.json', 'research/props_v2/results/validity_ref.json', 'research/props.json',
  'tools/props.js', 'tools/props_feed.js', 'tools/props_record.js', ...DATA_FROZEN];
const RULE_FROZEN = '2026-11-05T18:41Z';
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r5 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e5) / 1e5;
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const r6 = x => Math.round(x * 1e6) / 1e6;
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));
const sha256 = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const lstatOr = f => { try { return fs.lstatSync(f); } catch (e) { if (e.code === 'ENOENT') return null; throw e; } };
const inside = (p, d) => p === d || p.startsWith(d + path.sep);

/* a refusal: nothing is decided, nothing written; the run can be made again once its cause is put right. A VOID
   validity check is not a refusal: it is the test's outcome, written once (mainScore) */
class Refusal extends Error {}

/* the cache folder and the result file: the real ones, or a fixture's (both, and wholly outside research/props_v2/) */
function paths(env = process.env) {
  const c = env.TEST2024_CACHE, o = env.TEST2024_OUT;
  if (!c && !o) return { cache: REAL_CACHE, out: REAL_OUT, accept: ACCEPT, fixture: false };
  if (!c || !o) throw new Refusal('TEST2024_CACHE and TEST2024_OUT are set together, by test2024_test.js only; the real run sets neither');
  /* compared as the folders really are, links followed: a link to cache/ or results/ is refused as the path is */
  const real = p => fs.realpathSync(p);
  let rc, ro;
  try { rc = real(c); ro = path.join(real(path.dirname(path.resolve(o))), path.basename(o)); }
  catch (e) { throw new Refusal(`a fixture's cache folder and its result's folder must exist (${e.code || e.message})`); }
  const study = real(HERE);
  if (inside(rc, study) || inside(ro, study)) throw new Refusal('a fixture may not read the real cache or write into results/: its folders lie outside research/props_v2/, links followed');
  return { cache: rc, out: ro, accept: path.join(rc, 'test2024_accept.json'), fixture: true };
}
/* a file of the cache folder; a fixture's may not be a link out of its own folder */
function cacheFile(P, name) {
  const f = path.join(P.cache, name);
  if (P.fixture && lstatOr(f)) {
    let r; try { r = fs.realpathSync(f); } catch (e) { throw new Refusal(`a fixture's ${name} is a broken link`); }
    if (path.dirname(r) !== P.cache) throw new Refusal(`a fixture's ${name} is a link out of its folder: a fixture reads only its own files`);
  }
  return f;
}

/* ---------- the lines ---------- */
/* fetch_dk40.js's csv: its columns or nothing; one row a game, player and stat (two mean a broken cache: throw); a
   price that is not DraftKings' American price (tools/props_feed.js propAmerican: a number of 100 or more either way,
   or EVEN) reads as none, and the selection leaves that row out. readLinesText reads the text of bytes already read
   (the run reads each file once, and parses the bytes it hashed); readLines reads a file */
function readLinesText(text, name) {
  const t = text.split('\n');
  if (t.length && t[t.length - 1] === '') t.pop();
  const head = t.shift();
  if (head !== COLS.join(',')) throw new Error(`${name}: not fetch_dk40.js's columns`);
  const seen = new Set(), rows = [];
  t.forEach((l, j) => {
    const v = l.split(',');
    if (v.length !== COLS.length) throw new Error(`${name}: row ${j + 2} has ${v.length} fields, not ${COLS.length}`);
    const line = v[3] === '' ? NaN : +v[3];
    if (!v[0] || !v[1] || !v[2] || !Number.isFinite(line)) throw new Error(`${name}: row ${j + 2} has no game, player, stat or line`);
    const k = v[0] + '|' + v[1] + '|' + v[2];
    if (seen.has(k)) throw new Error(`${name}: row ${j + 2} repeats a game, player and stat; the fetch writes one row each, so the cache is broken`);
    seen.add(k);
    rows.push({ game_id: v[0], player_id: v[1], stat: v[2], line, over: F.propAmerican(v[4]), under: F.propAmerican(v[5]), lu: v[6] || null });
  });
  return rows;
}
const readLines = file => readLinesText(fs.readFileSync(file, 'utf8'), path.basename(file));
/* the bar's lines: a game of the schedule, of sel.type, dated sel.from to sel.to, on sel.stats, with both prices (each
   left out only where it is given; the archive's reproduction gives only the stats) */
function selectLines(rows, gameOf, sel) {
  const lines = [], dropped = { notOnSchedule: 0, notRegularSeason: 0, outsideWindow: 0, notBaseStat: 0, noPrice: 0 };
  for (const l of rows) {
    const g = gameOf.get(l.game_id);
    if (!g) { dropped.notOnSchedule++; continue; }
    if (sel.type && g.type !== sel.type) { dropped.notRegularSeason++; continue; }
    if ((sel.from && g.date < sel.from) || (sel.to && g.date > sel.to)) { dropped.outsideWindow++; continue; }
    if (!sel.stats.includes(l.stat)) { dropped.notBaseStat++; continue; }
    if (l.over == null || l.under == null) { dropped.noPrice++; continue; }
    lines.push(l);
  }
  return { lines, dropped };
}
/* cand_fix_lib.js archiveLines, with its lines passed in (there they are always data/props_2026.csv) and the pushes
   counted: tools/props.js marketTest's grading. src gives each graded line's place in rec (V1 reads its stamp) */
function gradeLines(rec, rows, sides, P, X, boxes) {
  const games = new Set(rec.map(r => r.game_id));
  const pr = C.projectX(rows, sides, P, X, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(rows[i].game + '|' + rows[i].id, { x, r: rows[i] });
  const played = new Set();
  for (const gid of games) for (const side of Object.values(boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
  const lines = [], src = []; let voids = 0, noCall = 0;
  for (let j = 0; j < rec.length; j++) {
    const l = rec[j], k = l.game_id + '|' + l.player_id;
    if (!played.has(k)) { voids++; continue; }
    const a = at.get(k);
    if (!a) { noCall++; continue; }
    const mu = a.x.mu[l.stat], v = a.x.v[l.stat], y = PR.yOf(a.r.y, l.stat);
    lines.push({ game: l.game_id, stat: l.stat, line: l.line, over: l.over, under: l.under, mu, y, m: a.x.m, min: a.r.min,
      pModel: PR.pOver(l.line, mu, v), pMarket: F.propFairOver(l.over, l.under), result: y > l.line ? 'over' : y < l.line ? 'under' : 'push' });
    src.push(j);
  }
  return { lines: lines.filter(x => x.result !== 'push'), voids, noCall, pushes: lines.filter(x => x.result === 'push').length, src: src.filter((s, i) => lines[i].result !== 'push') };
}

/* ---------- the scores: cand_fix.js's own, copied (the check holds the copies to its text) ---------- */
const clipP = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const llOf = (p, o) => o ? -Math.log(clipP(p)) : -Math.log(1 - clipP(p));
/* how sure: the mean distance of a chance from 50%, and the lines where the model and DraftKings differ by 10 points */
function sureness(lines) {
  const o = x => x.result === 'over' ? 1 : 0;
  const far = lines.filter(x => Math.abs(x.pModel - x.pMarket) >= 0.10), near = lines.filter(x => Math.abs(x.pModel - x.pMarket) < 0.05);
  const def = xs => xs.reduce((s, x) => s + llOf(x.pModel, o(x)) - llOf(x.pMarket, o(x)), 0);
  const tot = def(lines);
  return { modelFrom50: r4(lines.reduce((s, x) => s + Math.abs(x.pModel - 0.5), 0) / lines.length), marketFrom50: r4(lines.reduce((s, x) => s + Math.abs(x.pMarket - 0.5), 0) / lines.length),
    far10: { share: r4(far.length / lines.length), deficitShare: r4(def(far) / tot), perLine: r4(def(far) / far.length) }, near5: { share: r4(near.length / lines.length), perLine: r4(def(near) / near.length) } };
}
const UNITS_BOOT = 10000;
function betUnits(x, edge = 0.03) {
  const eo = x.pModel - F.propImplied(x.over), eu = (1 - x.pModel) - F.propImplied(x.under);
  const side = eo >= edge && eo >= eu ? 'over' : eu >= edge ? 'under' : null;
  if (!side) return null;
  const price = side === 'over' ? x.over : x.under;
  return { side, units: x.result === side ? (price > 0 ? price / 100 : 100 / -price) : -1 };
}
function unitsByGame(lines, gk) {
  const u = { over: new Map(gk.map(g => [g, 0])), under: new Map(gk.map(g => [g, 0])) }, n = { over: 0, under: 0 };
  for (const x of lines) { const b = betUnits(x); if (!b) continue; n[b.side]++; u[b.side].set(x.game, u[b.side].get(x.game) + b.units); }
  return { bets: n, over: gk.map(g => u.over.get(g)), under: gk.map(g => u.under.get(g)) };
}
function bootSum(vals, seed = 0) {
  const Rg = PR.rng(seed), n = vals.length, out = new Float64Array(UNITS_BOOT);
  for (let b = 0; b < UNITS_BOOT; b++) { let s = 0; for (let j = 0; j < n; j++) s += vals[Math.floor(Rg() * n)]; out[b] = s; }
  out.sort(); return [r2(out[Math.floor(0.05 * UNITS_BOOT)]), r2(out[Math.floor(0.95 * UNITS_BOOT)])];
}
/* cand_fix.js unitsCompare, without its last step, which holds the baseline's intervals to the ones published for the
   archive (the check does that, on the archive) */
function unitsOf(ab, ac, mb, mc) {
  const gk = [...new Set(ab.map(x => x.game))];
  const ub = unitsByGame(ab, gk), uc = unitsByGame(ac, gk), out = { edge: 0.03, resamples: UNITS_BOOT, seed: 0, games: gk.length };
  for (const s of ['over', 'under']) {
    const tb = r2(ub[s].reduce((a, v) => a + v, 0)), tc = r2(uc[s].reduce((a, v) => a + v, 0));
    if (ub.bets[s] !== mb.flat.edge3[s].bets || tb !== mb.flat.edge3[s].units || uc.bets[s] !== mc.flat.edge3[s].bets || tc !== mc.flat.edge3[s].units) throw new Error('the units by game do not add up to flatBets');
    out[s] = { baseline: { bets: ub.bets[s], units: tb, ci90: bootSum(ub[s]) }, candidate: { bets: uc.bets[s], units: tc, ci90: bootSum(uc[s]) },
      candidateMinusBaseline: { units: r2(tc - tb), ci90: bootSum(uc[s].map((v, j) => v - ub[s][j])) } };
  }
  const both = side => side.over.map((v, j) => v + side.under[j]);
  out.bothSides = { baseline: { units: r2(out.over.baseline.units + out.under.baseline.units), ci90: bootSum(both(ub)) }, candidate: { units: r2(out.over.candidate.units + out.under.candidate.units), ci90: bootSum(both(uc)) } };
  return out;
}
/* cand_fix.js archiveCompare, on graded lines passed in: tools/props.js (b) and A (c) on the very same lines */
function compareLines(ab, ac) {
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
    candidateMinusBaseline: { logloss: r4(mc.logloss.model - mb.logloss.model), ci90: PR.bootCI([...g.values()]), brier: r4(mc.brier.model - mb.brier.model), brierCi90: PR.bootCI([...gB.values()], 10000, 3) }, byStat,
    units: unitsOf(ab.lines, ac.lines, mb, mc) };
}

/* cand_fix.js's brief(), copied (the check holds it, and r4 and r5, to its text): a walk-forward score as published */
const brief = sc => ({ n: sc.n, meanLogScore: r5(sc.meanLogScore), meanLineLogloss: r5(sc.meanLineLogloss), meanMae: r4(sc.meanMae), minutesMae: r4(sc.minutes.mae), minutesBias: r4(sc.minutes.bias),
  stats: Object.fromEntries(Object.entries(sc.stats).map(([k, s]) => [k, { mae: r4(s.mae), bias: r4(s.bias), logScore: r5(s.logScore), lineLogloss: r5(s.lineLogloss) }])) });
/* the 2023-24 rows themselves: tools/props.js's 2024 fold and A's, projected on every 2023-24 row and scored as
   cand_fix.js --score scored them (compareWF), are results/cand_fix_score.json's walkForward["2024"] to the digit. So
   the box scores every line is graded on, and the features every projection reads, are the ones published */
function walkForward2024(W, S, foldP) {
  const sel = r => r.season === 2024, wf = S.walkForward['2024'];
  const b = brief(C.scoreX(W.rows, C.projectX(W.rows, W.sides, foldP['2024'], {}, sel)));
  const c = brief(C.scoreX(W.rows, C.projectX(W.rows, W.sides, S.folds['2024'].P, S.folds['2024'].X, sel)));
  if (!same(b, wf.baseline) || !same(c, wf.candidate)) throw new Error('the 2023-24 walk-forward does not give results/cand_fix_score.json\'s walkForward["2024"]: the 2023-24 rows are not the ones published');
  return { rows: c.n, baseline: b.meanLogScore, candidate: c.meanLogScore, sameAsCandFixScore: true };
}

/* ---------- the bar's figures before their rounding: reported beside the bar, deciding nothing ---------- */
/* tools/props.js bootCI without its last step (each bound to six places); the check holds its bounds, so rounded, to
   bootCI's own */
function bootCIRaw(groups, nBoot = 10000, seed = 0) {
  if (!groups.length) return null;
  const R = PR.rng(seed), means = new Float64Array(nBoot), n = groups.length;
  for (let b = 0; b < nBoot; b++) { let s = 0, c = 0; for (let j = 0; j < n; j++) { const g = groups[Math.floor(R() * n)]; s += g[0]; c += g[1]; } means[b] = c ? s / c : 0; }
  means.sort();
  return [means[Math.floor(0.05 * nBoot)], means[Math.floor(0.95 * nBoot)]];
}
/* A's log loss and Brier less DraftKings' by game, as tools/props.js marketScores groups them, and the flat bets' units
   summed unrounded */
function unroundedBar(lines) {
  const o = x => x.result === 'over' ? 1 : 0, gl = new Map(), gb = new Map();
  let units = 0;
  for (const x of lines) {
    const a = gl.get(x.game) || [0, 0]; a[0] += llOf(x.pModel, o(x)) - llOf(x.pMarket, o(x)); a[1]++; gl.set(x.game, a);
    const b = gb.get(x.game) || [0, 0]; b[0] += (x.pModel - o(x)) ** 2 - (x.pMarket - o(x)) ** 2; b[1]++; gb.set(x.game, b);
    const u = betUnits(x); if (u) units += u.units;
  }
  return { logloss: { ci90: bootCIRaw([...gl.values()]) }, brier: { ci90: bootCIRaw([...gb.values()]) }, units };
}
/* the unrounded figures must round to the ones the bar reads, or the scorer is wrong and stops */
function holdUnrounded(raw, fig) {
  const rnd = ci => ci && ci.map(r6);
  if (!same(rnd(raw.logloss.ci90), fig.logloss.ci90) || !same(rnd(raw.brier.ci90), fig.brier.ci90) || !(Math.abs(raw.units - fig.units) <= 0.01 + 1e-9))
    throw new Error('the bar\'s figures before rounding do not round to the ones it reads');
}

/* ---------- B's yardstick: cand_blend.js's own, copied (the check holds fitShare to its text) ---------- */
const NBOOT_W = 2000;
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const logit = p => { const c = clip(p); return Math.log(c / (1 - c)); };
const sig = z => 1 / (1 + Math.exp(-z));
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
/* cand_blend.js wStar, with its lines passed in (there they are the script's own L, A, D, O and N): the share w* of the
   model's disagreement, logit p = logit q + w (logit m - logit q), by maximum likelihood, and its 90% interval refitted
   on 2,000 resamples of games (seed 0) */
function wStar(L, A, D, O, idx) {
  const N = L.length;
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
/* the share a blend keeps, pooled and by stat, of one model's graded lines */
function blendShare(lines) {
  const A = Float64Array.from(lines.map(x => logit(x.pMarket))), D = Float64Array.from(lines.map(x => logit(x.pModel) - logit(x.pMarket)));
  const O = Uint8Array.from(lines.map(x => x.result === 'over' ? 1 : 0)), all = lines.map((x, i) => i);
  const stats = PR.ALL.filter(k => lines.some(x => x.stat === k));
  return { pooled: wStar(lines, A, D, O, all), byStat: Object.fromEntries(stats.map(k => [k, wStar(lines, A, D, O, all.filter(i => lines[i].stat === k))])) };
}

/* ---------- the bar ---------- */
/* each test on its figure as the study reports it: an interval that touches zero is not wholly below it (a bound
   rounded to -0 is not below zero), and units of exactly zero are not up */
const below = ci => Array.isArray(ci) && ci.length === 2 && Number.isFinite(ci[0]) && Number.isFinite(ci[1]) && ci[0] <= ci[1] && ci[1] < 0;
function barVerdict(f) {
  const t = { logloss: below(f.logloss.ci90), brier: below(f.brier.ci90), units: Number.isFinite(f.units) && f.units > 0 };
  return { tests: t, verdict: t.logloss && t.brier && t.units ? 'PASS' : 'FAIL' };
}
/* the bar's three figures for A, from compareLines */
const barFigures = cmp => ({ logloss: { diff: cmp.candidate.logloss.diff, ci90: cmp.candidate.logloss.diffCi90 }, brier: { diff: cmp.candidate.brier.diff, ci90: cmp.candidate.brier.diffCi90 },
  units: cmp.units.bothSides.candidate.units, over: cmp.units.over.candidate, under: cmp.units.under.candidate });
/* V1 counted on the scorer's own graded lines as validity.js counts it (a line's last_updated before its event's start,
   read as given), in whole lines */
function v1Count(graded, rec, reads) {
  let dated = 0, before = 0;
  for (const j of graded.src) {
    const l = rec[j], st = reads[l.game_id] && reads[l.game_id].start;
    if (!l.lu || !st) continue;
    dated++; if (Date.parse(l.lu) < Date.parse(st)) before++;
  }
  return { graded: graded.lines.length, dated, before };
}
/* V1: shown only where 95% or more of the graded lines are stamped before the start, by the whole-line count above
   (validity.js reports the share to four places, which reads 80,746 of 85,000, 94.995%, as 0.95), and where the validity
   check says shown too */
function preGameOf(v, n) {
  const own = !!n && Number.isInteger(n.before) && Number.isInteger(n.graded) && n.graded > 0 && 100 * n.before >= V1_PCT * n.graded;
  return own && v && v.v1 && v.v1.preGame === 'shown' ? 'shown' : 'inferred, not shown';
}

/* ---------- decided once, and written once ---------- */
/* a whole result at the result's path refuses every later run; anything else there, or a part left by a run cut off
   while writing, refuses too, with its own words, and is looked at by hand */
function decided(out, name = out) {
  const st = lstatOr(out);
  if (st) {
    let r = null;
    if (st.isFile()) try { r = readJSON(out); } catch (e) { r = null; }
    if (r && typeof r.verdict === 'string' && /^(PASS|FAIL|VOID)\b/.test(r.verdict)) throw new Refusal(`${name} exists: the test is decided once and never revisited`);
    throw new Refusal(`${name} exists but holds no whole result (not a plain file, not JSON, or no verdict): a run was cut off while writing it, or it was put there by hand; look at it by hand`);
  }
  if (lstatOr(out + '.part')) throw new Refusal(`${name}.part exists: a run was cut off while writing its result, or one is writing it now; look at it by hand`);
}
/* the result, written once: into a part file of its own ('wx', never over another), synced, then linked to its path
   (a link fails where the path exists, so of two runs only the first is kept) and the part removed. A write that fails
   leaves nothing behind; a run killed while writing leaves the part, which every later run refuses on */
function keepResult(out, body, write = (fd, b) => fs.writeFileSync(fd, b)) {
  const part = out + '.part';
  let fd;
  try { fd = fs.openSync(part, 'wx'); }
  catch (e) { if (e.code === 'EEXIST') throw new Refusal(`${part} exists: another run is writing its result`); throw e; }
  try {
    write(fd, body); fs.fsyncSync(fd); fs.closeSync(fd); fd = null;
    try { fs.linkSync(part, out); }
    catch (e) { if (e.code === 'EEXIST') throw new Refusal(`${out} was written meanwhile, by another run: this run's result is not kept`); throw e; }
  } finally {
    if (fd != null) try { fs.closeSync(fd); } catch (e) { /* the write's own error is the one thrown */ }
    fs.rmSync(part, { force: true });
  }
}

/* ---------- the refusals ---------- */
/* the validity check: the check of props40_2024.csv on the 2024 fold and the registered thresholds, saying whether V0,
   V2 and V3 hold and with a verdict that says the same, its counts, and the SHA-256 of the two files it read. A check
   that does not hold is returned VOID, never refused: that is the test's outcome */
function readValidity(P) {
  const f = cacheFile(P, 'validity_2024.json');
  if (!fs.existsSync(f)) throw new Refusal('no validity check: run validity.js --lines research/props_v2/cache/props40_2024.csv --season 2024 first, once the fetch is complete (README, "The validity check, applied before the bar")');
  const got = V.readFetched(f);
  let v; try { v = JSON.parse(got.text); } catch (e) { throw new Refusal('cache/validity_2024.json is not JSON: run the validity check again'); }
  if (v.fold !== 2024 || !v.lines || path.basename(String(v.lines)) !== 'props40_2024.csv') throw new Refusal('cache/validity_2024.json is not the check of props40_2024.csv on the 2024 fold');
  if (JSON.stringify(v.thresholds) !== JSON.stringify(V.TH)) throw new Refusal('cache/validity_2024.json was not run on the registered thresholds (validity_lib.js TH)');
  const holds = Object.fromEntries(['v0', 'v2', 'v3'].map(k => [k, v[k] && v[k].holds]));
  if (Object.values(holds).some(h => typeof h !== 'boolean')) throw new Refusal('cache/validity_2024.json does not say whether V0, V2 and V3 hold');
  const failed = ['v0', 'v2', 'v3'].filter(k => holds[k] === false).map(k => k.toUpperCase());
  if (typeof v.verdict !== 'string' || !v.verdict.startsWith(failed.length ? 'VOID' : 'the bar applies')) throw new Refusal('cache/validity_2024.json\'s verdict is not what its V0, V2 and V3 say: the file is broken');
  if (!Number.isInteger(v.graded) || !Number.isInteger(v.games)) throw new Refusal('cache/validity_2024.json carries no count of its graded lines and games');
  if (!v.files || !/^[0-9a-f]{64}$/.test(v.files.csv || '') || !/^[0-9a-f]{64}$/.test(v.files.reads || '')) throw new Refusal('cache/validity_2024.json carries no SHA-256 of the files it read: run validity.js on these lines again (it records them)');
  return { file: f, v, sha: got.sha256, voided: failed };
}
/* the lines and the reads, read once each: the bytes hashed are the bytes parsed, and they must be the bytes the
   validity check read */
function readCache(P, v) {
  const csv = V.readFetched(cacheFile(P, 'props40_2024.csv')), rd = V.readFetched(cacheFile(P, 'props40_reads.json'));
  if (csv.sha256 !== v.files.csv || rd.sha256 !== v.files.reads) throw new Refusal('props40_2024.csv or props40_reads.json is not the bytes the validity check read (their SHA-256 differ from the ones it recorded): the lines changed after it; run validity.js on them again once the fetch is complete');
  let reads; try { reads = JSON.parse(rd.text); } catch (e) { throw new Error('props40_reads.json is not JSON: the cache is broken'); }
  return { rows: readLinesText(csv.text, 'props40_2024.csv'), reads, sha: { csv: csv.sha256, reads: rd.sha256 } };
}
/* every run of validity.js on fetched lines, as its log keeps them: reported beside the result, deciding nothing, so a
   check run more than once, or on other bytes, shows (the log is in the gitignored cache: it says what this folder's
   runs were, not that nothing else ran) */
function validityRuns(P, sha) {
  const f = cacheFile(P, 'validity_2024_runs.jsonl');
  if (!fs.existsSync(f)) return { log: false, n: 0, runs: [] };
  const runs = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => {
    let r; try { r = JSON.parse(l); } catch (e) { return { unreadable: true }; }
    return { generated: r.generated, verdict: r.verdict, graded: r.graded, games: r.games, sameBytes: !!r.files && r.files.csv === sha.csv && r.files.reads === sha.reads };
  });
  return { log: true, n: runs.length, runs, voidOnOtherBytes: runs.filter(r => !r.sameBytes && /^VOID/.test(r.verdict || '')).length };
}
/* the validity check's figures, as it wrote them (aggregates: means, counts, intervals) */
const validityFigures = v => ({ generated: v.generated, verdict: v.verdict, graded: v.graded, games: v.games, v0: v.v0, v1: v.v1, v2: v.v2, v3: v.v3 });
/* the scorer and every file it stands on, committed and unchanged since the last commit; returns the commit */
function gitClean(files, cwd = ROOT) {
  for (const f of files) {
    try { execFileSync('git', ['ls-files', '--error-unmatch', f], { cwd, stdio: 'pipe' }); }
    catch (e) { throw new Refusal(`${f} is not committed: the scorer and what it stands on are committed before it is run`); }
  }
  try { execFileSync('git', ['diff', '--quiet', 'HEAD', '--', ...files], { cwd, stdio: 'pipe' }); }
  catch (e) { throw new Refusal('a file the scorer stands on differs from the last commit: commit it, or put it back, before the run'); }
  return execFileSync('git', ['rev-parse', 'HEAD'], { cwd, encoding: 'utf8' }).trim();
}
/* what the run stands on that FROZEN leaves out: every module of the repository loaded (passed in: require.cache's), the
   modules validity.js requires, and every data file the run reads (the box files cut2026.js opens, the schedule, the
   archive, research/props.json) */
function frozenGaps(loaded) {
  const rel = f => path.relative(ROOT, f).split(path.sep).join('/');
  const want = new Set(loaded.filter(f => inside(f, ROOT) && !inside(f, path.join(ROOT, 'node_modules'))).map(rel));
  for (const m of fs.readFileSync(path.join(HERE, 'validity.js'), 'utf8').matchAll(/require\('(\.[^']+)'\)/g)) want.add(rel(require.resolve(path.resolve(HERE, m[1]))));
  for (const f of fs.readdirSync(PR.DATA)) { const m = /^(?:box_(\d{4})\.csv|teambox_(\d{4})\.jsonl)$/.exec(f); if (m && +(m[1] || m[2]) <= C.LAST) want.add(rel(path.join(PR.DATA, f))); }
  for (const f of ['data/games.csv', 'data/props_2026.csv', 'research/props.json']) want.add(f);
  return [...want].filter(f => !FROZEN.includes(f)).sort();
}
/* the schedule's rows of seasons up to 2026, the part the run reads (the job rewrites the rest) */
function gamesTo2026Sha() {
  const t = fs.readFileSync(path.join(ROOT, 'data', 'games.csv'), 'utf8').split('\n'), s = t[0].split(',').indexOf('season');
  if (s < 0) throw new Error('data/games.csv has no season column');
  const keep = [t[0], ...t.slice(1).filter(l => l && +l.split(',')[s] <= C.LAST)];
  return crypto.createHash('sha256').update(keep.join('\n') + '\n').digest('hex');
}
/* the owner's list of window games whose read failed on every try, to be left out as unanswered: never the scorer's
   choice. Read only where it exists; committed with the scorer */
function readAccept(f) {
  if (!fs.existsSync(f)) return null;
  let a; try { a = readJSON(f); } catch (e) { throw new Refusal(`${path.basename(f)} is not JSON`); }
  if (!a || !Array.isArray(a.games) || !a.games.length || !a.games.every(g => typeof g === 'string' && g) || typeof a.decided !== 'string' || !a.decided)
    throw new Refusal(`${path.basename(f)} is not the owner's list of games ({ "games": [game ids], "decided": "who and when" })`);
  return a;
}
/* the fetch's coverage of the window: every game with an ESPN id read, and what each read found; lineCount is the csv's
   rows a game, which the fetch writes equal to its read's count of lines */
function coverageOf(windowGames, reads, lineCount) {
  const out = { windowGames: windowGames.length, noEspnId: 0, withEspnId: 0, read: { ok: 0, okWithNoLine: 0, none: 0, failed: 0, other: 0 }, notRead: [], failed: [], other: [], gamesWithLines: 0, okButNoRow: 0, rowsNotTheRead: 0 };
  const inWin = new Set(windowGames.map(g => g.game_id));
  for (const g of windowGames) {
    if (!g.espn_id) { out.noEspnId++; continue; }
    out.withEspnId++;
    const r = reads[g.game_id];
    if (!r) { out.notRead.push(g.game_id); continue; }
    if (r.status === 'ok' && r.lines > 0) out.read.ok++;
    else if (r.status === 'ok') out.read.okWithNoLine++;
    else if (r.status === 'none') out.read.none++;
    else if (r.status === 'failed') { out.read.failed++; out.failed.push(g.game_id); }
    else { out.read.other++; out.other.push(g.game_id); }
    if (r.status === 'ok' && r.lines > 0 && !lineCount.has(g.game_id)) out.okButNoRow++;
    else if (lineCount.has(g.game_id) && lineCount.get(g.game_id) !== (r.status === 'ok' ? r.lines : 0)) out.rowsNotTheRead++;
    if (lineCount.has(g.game_id)) out.gamesWithLines++;
  }
  out.rowsOutsideWindow = [...lineCount.keys()].filter(id => !inWin.has(id)).length;
  return out;
}
/* every game of the window answered: never read, or a failed read (a timeout, an error, a body that is not a propBets
   page: provider 40 has not answered it yet), refuses alike, unless the owner's list leaves that game out */
function requireRead(cov, accept = null) {
  if (cov.notRead.length) throw new Refusal(`${cov.notRead.length} game(s) of the window were never read (the fetch did not finish): run fetch_dk40.js over the window, then the validity check, again`);
  const listed = new Set(accept ? accept.games : []), open = cov.failed.filter(g => !listed.has(g));
  if (open.length) throw new Refusal(`${open.length} game(s) of the window have a failed read, so provider 40 has not answered them yet: run fetch_dk40.js over the window again (it asks them again), then the validity check; a game that fails on every try is the owner's call, listed in research/props_v2/test2024_accept.json and committed`);
  if (cov.other.length) throw new Refusal(`${cov.other.length} game(s) have a read of no known status (ok, none or failed): the cache is broken`);
  if (cov.okButNoRow) throw new Refusal(`${cov.okButNoRow} game(s) read with lines have no row in the csv: the cache is broken`);
  if (cov.rowsNotTheRead) throw new Refusal(`${cov.rowsNotTheRead} game(s) have rows in the csv other than their read's count of lines: the cache is broken`);
  return { listed: [...listed].length, acceptedFailed: cov.failed.filter(g => listed.has(g)), listedNotFailed: [...listed].filter(g => !cov.failed.includes(g)) };
}
/* the lines must be the ones the validity check graded */
function agreesWithValidity(v, graded, games) {
  if (v.graded !== graded || v.games !== games) throw new Refusal(`the validity check graded ${v.graded} lines on ${v.games} games and the scorer ${graded} on ${games}: they did not read the same lines; run validity.js on these lines again`);
}

/* ---------- the data, the folds and the reproduction ---------- */
function loadWorld() {
  const D = C.loadData();
  const R = C.replayX(D.games, D.boxes, D.tbox, { collect: true, from: PR.FIRST + 1 });
  if (R.rows.some(r => r.season > C.LAST)) throw new Error('a row after 2026');
  return { D, rows: R.rows, sides: C.sidesOf(R.rows), gameOf: new Map(D.games.map(g => [g.game_id, g])) };
}
/* a function's text in a file: from "function name(" to its closing brace at the line's start */
function sourceOf(file, name) {
  const t = fs.readFileSync(file, 'utf8'), i = t.indexOf(`function ${name}(`);
  if (i < 0) throw new Error(`${path.basename(file)} has no function ${name}`);
  return t.slice(i, t.indexOf('\n}', i) + 2);
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
function check(W) {
  const t0 = Date.now(), out = {};
  const S = readJSON(path.join(OUTD, 'cand_fix_score.json')), foldP = readJSON(path.join(OUTD, 'fold_params.json'));
  const rule = readJSON(path.join(OUTD, 'cand_fix_rule.json')), blend = readJSON(path.join(OUTD, 'cand_blend.json'));
  const research = readJSON(path.join(ROOT, 'research', 'props.json'));
  if (rule.frozen !== RULE_FROZEN) throw new Error(`the rule file says frozen ${rule.frozen}, not ${RULE_FROZEN}`);
  if (!same(S.rule, rule.kept)) throw new Error('results/cand_fix_score.json was not scored on the frozen rule');
  /* (d) the copies, the columns and the stats */
  const fix = path.join(HERE, 'cand_fix.js'), bl = path.join(HERE, 'cand_blend.js');
  const copies = { [fix]: [sureness, betUnits, unitsByGame, bootSum], [bl]: [fitShare] };
  for (const [file, fns] of Object.entries(copies)) for (const fn of fns) if (fn.toString() !== sourceOf(file, fn.name)) throw new Error(`${fn.name} is not ${path.basename(file)}'s to the character`);
  if (!/const UNITS_BOOT = 10000;/.test(fs.readFileSync(fix, 'utf8')) || !/NBOOT_W = 2000/.test(fs.readFileSync(bl, 'utf8'))) throw new Error('the resample counts are not the copied scripts\'');
  const fetchCols = /const COLS = \[([^\]]*)\]/.exec(fs.readFileSync(path.join(HERE, 'fetch_dk40.js'), 'utf8'));
  if (!fetchCols || fetchCols[1].replace(/['\s]/g, '') !== COLS.join(',')) throw new Error('the columns are not fetch_dk40.js\'s');
  if (!fs.readFileSync(path.join(HERE, 'validity.js'), 'utf8').includes(`'${COLS.join(',')}'`)) throw new Error('the columns are not the ones validity.js reads');
  if (!same(WINDOW.stats, V.BASE)) throw new Error('the base stats are not validity_lib.js\'s');
  const fixSrc = fs.readFileSync(fix, 'utf8');
  for (const [k, f] of [['r4', r4], ['r5', r5], ['brief', brief]]) if (!fixSrc.includes(`const ${k} = ${f.toString()};`)) throw new Error(`${k} is not cand_fix.js's to the character`);
  if (V1_PCT / 100 !== V.TH.v1ShareBeforeStart) throw new Error('V1\'s bar is not validity_lib.js\'s');
  out.copies = { 'cand_fix.js': ['sureness', 'betUnits', 'unitsByGame', 'bootSum', 'brief', 'r4', 'r5'], 'cand_blend.js': ['fitShare'], same: true, columns: COLS.join(','), v1Pct: V1_PCT };
  /* (g) FROZEN: every module of the repository loaded (this script aside: it is FROZEN's first entry), those
     validity.js requires, and every data file the run reads, all in it */
  if (path.resolve(PR.DATA) !== path.join(ROOT, 'data')) throw new Error('tools/props.js reads data from elsewhere than data/ (NBA_DATA_DIR)');
  const gaps = frozenGaps(Object.keys(require.cache).filter(f => f !== __filename));
  if (gaps.length) throw new Error(`FROZEN leaves out what the run stands on: ${gaps.join(', ')}`);
  out.frozen = { files: FROZEN.length, coversEverythingLoaded: true };
  /* (b) the folds */
  const S24 = S.folds['2024'];
  if (S24.fitOn !== '2023-2023') throw new Error('the stored 2024 fold was not fitted on 2023');
  if (!same(foldP['2024'], research.folds.find(f => f.season === 2024).params)) throw new Error('tools/props.js\'s 2024 fold is not research/props.json\'s');
  if (!same(foldP['2026'], research.folds.find(f => f.season === 2026).params)) throw new Error('tools/props.js\'s 2026 fold is not research/props.json\'s');
  log('A\'s 2024 fold: fitting it again on 2023, as cand_fix.js --score did');
  const refit = C.fitAllX(W.rows, W.sides, r => r.season >= PR.FIRST + 1 && r.season < 2024, rule.X, rule.grids, { rho: foldP['2024'].rho });
  if (!same(refit.P, S24.P) || !same(refit.X, S24.X)) throw new Error('A\'s 2024 fold does not refit to results/cand_fix_score.json\'s');
  out.fold2024 = { fitOn: S24.fitOn, refitSame: true, baselineIsResearchJson: true, rule: rule.kept, frozen: rule.frozen };
  log('A\'s 2024 fold refits to results/cand_fix_score.json\'s exactly; tools/props.js\'s 2024 fold is research/props.json\'s');
  /* (f) the 2023-24 rows: the walk-forward on them is the published one */
  out.walkForward2024 = walkForward2024(W, S, foldP);
  log(`the 2023-24 rows: both models' walk-forward on ${out.walkForward2024.rows} of them is results/cand_fix_score.json's walkForward["2024"] to the digit`);
  /* (a) the archive, through the test's own reader, selection, grading and scoring */
  const rec = REC.readRecord(2026);
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v2-test2024-'));
  let read;
  try {
    const f = path.join(tmp, 'props40_2026.csv');
    fs.writeFileSync(f, [COLS.join(','), ...rec.map(l => [l.game_id, l.player_id, l.stat, l.line, l.over, l.under, ''].join(','))].join('\n') + '\n');
    read = readLines(f);
  } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  if (!same(read.map(({ lu, ...l }) => l), rec)) throw new Error('the archive does not read back through the test\'s reader as tools/props_record.js reads it');
  const sel = selectLines(read, W.gameOf, { stats: PR.ALL });
  if (sel.lines.length !== rec.length || Object.values(sel.dropped).some(n => n)) throw new Error(`the selection dropped archive rows: ${JSON.stringify(sel.dropped)}`);
  const P26 = S.folds['2026'];
  const ab = gradeLines(sel.lines, W.rows, W.sides, foldP['2026'], {}, W.D.boxes), ac = gradeLines(sel.lines, W.rows, W.sides, P26.P, P26.X, W.D.boxes);
  const ab0 = C.archiveLines(W.rows, W.sides, foldP['2026'], {}, W.D.boxes), ac0 = C.archiveLines(W.rows, W.sides, P26.P, P26.X, W.D.boxes);
  for (const [a, b] of [[ab, ab0], [ac, ac0]]) if (!same(a.lines, b.lines) || a.voids !== b.voids || a.noCall !== b.noCall) throw new Error('the test\'s grading is not cand_fix_lib.js archiveLines\' on the archive');
  const cmp = compareLines(ab, ac);
  if (!same(cmp, S.archive)) {
    const diff = Object.keys(S.archive).filter(k => !same(cmp[k], S.archive[k]));
    throw new Error(`the archive does not score as results/cand_fix_score.json says: ${diff.join(', ')}`);
  }
  const pub = blend.model.flat;
  if (!same(cmp.units.over.baseline.ci90, pub.over.unitsCi90) || !same(cmp.units.under.baseline.ci90, pub.under.unitsCi90)) throw new Error('the baseline\'s units intervals are not the published ones');
  out.archive = { lines: cmp.candidate.lines, games: cmp.candidate.games, voids: cmp.voids, noCall: cmp.noCall, pushes: ab.pushes,
    toolsProps: { logloss: cmp.baseline.logloss, brier: cmp.baseline.brier, flat3: cmp.baseline.flat.edge3 },
    candidate: { logloss: cmp.candidate.logloss, brier: cmp.candidate.brier, flat3: cmp.candidate.flat.edge3 },
    candidateMinusBaseline: cmp.candidateMinusBaseline, units: cmp.units, sameAsCandFixScore: true };
  out.barOnArchive = { note: 'the bar\'s rule read on the archive\'s published figures, to show it reads them; the archive is not the test', ...barVerdict(barFigures(cmp)), figures: barFigures(cmp) };
  /* (g) the bar's figures before their rounding, on the archive: they round to the ones the bar reads */
  const raw = unroundedBar(ac.lines);
  holdUnrounded(raw, barFigures(cmp));
  out.unroundedOnArchive = { roundsToBar: true, figures: raw };
  log(`the archive through the test's path: ${cmp.candidate.lines} lines on ${cmp.candidate.games} games, ${cmp.voids} void; A ${cmp.candidate.logloss.model} against DraftKings ${cmp.candidate.logloss.market} (diff ${cmp.candidate.logloss.diff} ${JSON.stringify(cmp.candidate.logloss.diffCi90)}): results/cand_fix_score.json's archive block, every number`);
  /* (c) B's yardstick, on tools/props.js's archive lines, as cand_blend.js published it */
  const bs = blendShare(ab.lines);
  if (!same(bs.pooled, blend.inSample.pooled) || !same(bs.byStat, blend.inSample.byStat)) throw new Error('B\'s yardstick does not give results/cand_blend.json\'s on the archive');
  out.blend = { pooled: bs.pooled, byStat: bs.byStat, sameAsCandBlend: true };
  log(`B's yardstick on the archive: pooled ${bs.pooled.w} ${JSON.stringify(bs.pooled.ci90)}, every stat results/cand_blend.json's`);
  /* (e) the six base stats, counted as validity.js counts them */
  const ref = readJSON(path.join(OUTD, 'validity_ref.json')), selB = selectLines(read, W.gameOf, { stats: WINDOW.stats });
  const gB = gradeLines(selB.lines, W.rows, W.sides, foldP['2026'], {}, W.D.boxes), gamesB = new Set(selB.lines.map(l => l.game_id)).size;
  if (ref.fold !== 2026 || gB.lines.length !== ref.graded || gamesB !== ref.games) throw new Error(`the archive's base stats grade ${gB.lines.length} lines on ${gamesB} games, validity.js ${ref.graded} on ${ref.games}`);
  out.validityCount = { graded: ref.graded, games: ref.games, same: true };
  log(`the archive's six base stats: ${ref.graded} lines on ${ref.games} games, as validity.js graded them`);
  out.passed = true; out.seconds = Math.round((Date.now() - t0) / 1000);
  return out;
}
/* the SHA-256 of every file FROZEN holds, and of the schedule's rows up to 2026 */
function frozenShas(extra = []) {
  return { frozen: Object.fromEntries([...FROZEN, ...extra].map(f => [f, sha256(path.join(ROOT, f))])), gamesTo2026: gamesTo2026Sha() };
}

/* ---------- the modes ---------- */
function mainCheck() {
  const W = loadWorld();
  log(`games ${W.D.games.length}, replay ${W.rows.length} rows`);
  const out = check(W);
  fs.writeFileSync(CHECK_OUT, JSON.stringify({ generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v2/test2024.js --check: the scorer\'s own path on the 2026 archive, A\'s 2024 fold refitted and B\'s yardstick, against the published results; no 2023-24 line is read', ...out }, null, 1) + '\n');
  log(`check passed in ${out.seconds} s: results/test2024_check.json written; no 2023-24 line was read`);
}

function mainScore() {
  const t0 = Date.now();
  const P = paths();
  const nameOf = f => P.fixture ? f : path.relative(HERE, f);
  decided(P.out, nameOf(P.out));
  const acceptFile = P.fixture ? cacheFile(P, 'test2024_accept.json') : P.accept, accept = readAccept(acceptFile);
  const extra = accept && !P.fixture ? [path.relative(ROOT, P.accept)] : [];
  const commit = P.fixture ? null : gitClean([...FROZEN, ...extra]);
  const val = readValidity(P), v = val.v;
  for (const n of ['props40_2024.csv', 'props40_reads.json']) if (!fs.existsSync(cacheFile(P, n))) throw new Refusal(`no ${n} beside the validity check`);
  log(val.voided.length ? `the validity check is VOID (${val.voided.join(', ')} did not hold): it is recorded once the lines are shown to be the ones it read; nothing is scored` : 'the validity check holds (V0, V2, V3)');
  /* the reproduction, before any 2023-24 line is read */
  const W = loadWorld();
  const chk = check(W);
  log('the reproduction passed; reading the 2023-24 lines');
  /* the lines: the bytes the validity check read, each file read once */
  const L = readCache(P, v), all = L.rows;
  const S = readJSON(path.join(OUTD, 'cand_fix_score.json')), foldP = readJSON(path.join(OUTD, 'fold_params.json'));
  const windowGames = W.D.games.filter(g => g.type === WINDOW.type && g.date >= WINDOW.from && g.date <= WINDOW.to);
  const count = new Map(); for (const l of all) count.set(l.game_id, (count.get(l.game_id) || 0) + 1);
  const cov = coverageOf(windowGames, L.reads, count);
  const acc = requireRead(cov, accept);
  const sel = selectLines(all, W.gameOf, WINDOW);
  const selGames = new Set(sel.lines.map(l => l.game_id)).size;
  const ab = gradeLines(sel.lines, W.rows, W.sides, foldP['2024'], {}, W.D.boxes);
  agreesWithValidity(v, ab.lines.length, selGames);
  const n1 = v1Count(ab, sel.lines, L.reads), pre = preGameOf(v, n1);
  log(`coverage: ${cov.windowGames} games in the window, ${cov.noEspnId} with no ESPN id; read ok ${cov.read.ok}, ok with no line ${cov.read.okWithNoLine}, none ${cov.read.none}, failed ${cov.read.failed} (on the owner's list ${acc.acceptedFailed.length})`);
  log(`graded ${ab.lines.length} lines on ${new Set(ab.lines.map(x => x.game)).size} games (void ${ab.voids}, no call ${ab.noCall}, pushes ${ab.pushes}): the validity check's lines; V1 ${n1.before} of ${n1.graded} stamped before the start, pre-game ${pre}`);
  const common = {
    preGame: pre,
    validity: { ...validityFigures(v), v1Counted: { ...n1, shown: pre === 'shown', rule: 'shown only where 100 x before >= 95 x graded, in whole lines, and where the validity check says shown' }, sameLines: true },
    validityRuns: { note: 'every run of validity.js on fetched lines, as its log keeps them (cache/validity_2024_runs.jsonl, gitignored); reported, deciding nothing', ...validityRuns(P, L.sha) },
    lines: { graded: ab.lines.length, games: selGames, voids: ab.voids, noCall: ab.noCall, pushes: ab.pushes, rows: all.length, selected: sel.lines.length, dropped: sel.dropped },
    coverage: { ...cov, ownersList: accept ? { decided: accept.decided, ...acc } : null },
    check: { passed: chk.passed, archiveSame: chk.archive.sameAsCandFixScore, fold2024Same: chk.fold2024.refitSame, walkForward2024Same: chk.walkForward2024.sameAsCandFixScore, blendSame: chk.blend.sameAsCandBlend, copiesSame: chk.copies.same, validityCountSame: chk.validityCount.same, frozenCovered: chk.frozen.coversEverythingLoaded },
    files: { commit, scorer: sha256(__filename), csv: L.sha.csv, reads: L.sha.reads, validity: val.sha, ownersList: accept ? sha256(acceptFile) : null, ...frozenShas(extra) },
  };
  const what = 'research/props_v2/test2024.js --score: candidate A (frozen 2026-11-05T18:41Z, its 2024 fold fitted on 2023) against DraftKings\' provider-40 main lines of the 2023-24 regular season, by the bar the README wrote before the lines were fetched; decided once';
  if (val.voided.length) {
    /* VOID: the outcome, decided once. The bar is not applied and nothing is scored */
    const res = { generated: new Date().toISOString().slice(0, 16) + 'Z', what, fixture: P.fixture || undefined,
      verdict: `VOID (${val.voided.join(', ')} did not hold): the bar is not applied, and the lines settle nothing`,
      ...common, seconds: Math.round((Date.now() - t0) / 1000) };
    keepResult(P.out, JSON.stringify(res, null, 1) + '\n');
    log(`VERDICT: ${res.verdict}`);
    log(`${nameOf(P.out)} written in ${res.seconds} s`);
    return;
  }
  const A24 = S.folds['2024'];
  const ac = gradeLines(sel.lines, W.rows, W.sides, A24.P, A24.X, W.D.boxes);
  /* the scores */
  const cmp = compareLines(ab, ac);
  const fig = barFigures(cmp), bar = barVerdict(fig);
  const raw = unroundedBar(ac.lines);
  holdUnrounded(raw, fig);
  const rawTests = barVerdict(raw);
  log('the share of A\'s disagreement a blend keeps (2,000 resamples a stat)');
  const blend = blendShare(ac.lines);
  const res = {
    generated: new Date().toISOString().slice(0, 16) + 'Z', what, fixture: P.fixture || undefined,
    verdict: pre === 'shown' ? bar.verdict : `${bar.verdict} (pre-game inferred, not shown)`,
    preGame: pre,
    bar: { tests: bar.tests, figures: fig, rule: 'PASS only if (1) log loss, A less DraftKings\' fair chance, has its 90% interval (10,000 resamples of games, seed 0) wholly below zero, (2) Brier the same, (3) flat one-unit bets at a 3-point edge over the price\'s implied chance, both sides together, are up' },
    beside: { note: 'reported beside the bar, deciding nothing', toolsProps: cmp.baseline, candidate: cmp.candidate, candidateMinusBaseline: cmp.candidateMinusBaseline, byStat: cmp.byStat, units: cmp.units,
      blendShare: { what: 'the share w* of A\'s disagreement a blend keeps, logit p = logit q + w (logit A - logit q), by maximum likelihood, with a 90% interval refitted on 2,000 resamples of games (seed 0): cand_blend.js\'s yardstick', ...blend },
      unrounded: { what: 'the bar\'s three figures before their rounding (bootCI\'s bounds to six places, the units to the cent), and the tests read on them: deciding nothing', figures: raw, tests: rawTests.tests, sameTestsAsBar: same(rawTests.tests, bar.tests) } },
    ...common,
    fold: { candidate: { fitOn: A24.fitOn, rule: S.rule }, toolsProps: 'results/fold_params.json 2024 (research/props.json\'s), with none of A\'s changes' },
    seconds: Math.round((Date.now() - t0) / 1000),
  };
  keepResult(P.out, JSON.stringify(res, null, 1) + '\n');
  log(`(1) log loss, A less DraftKings: ${fig.logloss.diff} ${JSON.stringify(fig.logloss.ci90)} -> ${bar.tests.logloss ? 'holds' : 'does not hold'}`);
  log(`(2) Brier, A less DraftKings: ${fig.brier.diff} ${JSON.stringify(fig.brier.ci90)} -> ${bar.tests.brier ? 'holds' : 'does not hold'}`);
  log(`(3) flat bets at a 3-point edge, both sides: ${fig.units} units (Overs ${fig.over.bets} bets ${fig.over.units}, Unders ${fig.under.bets} bets ${fig.under.units}) -> ${bar.tests.units ? 'holds' : 'does not hold'}`);
  log(`beside it: tools/props.js less DraftKings ${cmp.baseline.logloss.diff} ${JSON.stringify(cmp.baseline.logloss.diffCi90)}; A less tools/props.js ${cmp.candidateMinusBaseline.logloss} ${JSON.stringify(cmp.candidateMinusBaseline.ci90)}; before rounding the tests read ${JSON.stringify(rawTests.tests)}`);
  log(`VERDICT: ${res.verdict}`);
  log(`${nameOf(P.out)} written in ${res.seconds} s`);
}

if (require.main === module) {
  const mode = process.argv[2];
  try {
    if (mode === '--check') mainCheck();
    else if (mode === '--score') mainScore();
    else { console.error('usage: node research/props_v2/test2024.js --check | --score'); process.exit(1); }
  } catch (e) {
    if (e instanceof Refusal) { console.error(`REFUSED: ${e.message}`); process.exit(2); }
    throw e;
  }
}

module.exports = { WINDOW, COLS, FROZEN, DATA_FROZEN, V1_PCT, Refusal, paths, cacheFile, readLines, readLinesText, selectLines, gradeLines, compareLines, blendShare,
  barVerdict, barFigures, preGameOf, v1Count, bootCIRaw, unroundedBar, holdUnrounded, walkForward2024, decided, keepResult, readValidity, readCache,
  validityRuns, readAccept, gitClean, frozenGaps, gamesTo2026Sha, coverageOf, requireRead, agreesWithValidity, loadWorld, check };
