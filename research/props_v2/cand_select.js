/* Candidate C, a selection rule rather than a new chance: which lines, if any, the model's disagreement with DraftKings
 * is worth anything on. The rules, what counts and what the rule writer already knew are in cand_select.md ("The rules,
 * written down before any was scored"), written from results/cand_select_explore.md (cand_select_explore.js: box scores
 * of 2022-2026 only) before this script read an outcome on the archive.
 *
 *   node research/props_v2/cand_select.js --check   reproduce the published archive numbers (11,395 lines, log loss
 *                                                   0.6934 against 0.6788, the model's flat bets) and the walk-forward's
 *                                                   2025 and 2026 folds, and the explore step's cut points; prints how
 *                                                   many lines and bets each rule selects (no outcome), and no score
 *   node research/props_v2/cand_select.js           the one scoring run: results/cand_select.json and
 *                                                   results/cand_select_tables.md (the tables cand_select.md quotes)
 *
 * Seasons 2022-2026 only (cand_select_lib.js loads through cut2026.js: games.csv's rows after 2026 are dropped and only
 * the box files of seasons up to 2026 are opened). No box score or line of 2026-27 is read. tools/props.js is required, never changed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const F = require('../../tools/props_feed.js');
const C = require('./cand_select_lib.js');

const OUTD = path.join(__dirname, 'results');
const CHECK = process.argv.includes('--check');
const EDGE = 0.03, NBOOT = 10000, NRULES = 7;
const QB = [0.1 / NRULES / 2, 1 - 0.1 / NRULES / 2];          // the Bonferroni level, two-sided
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r3 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e3) / 1e3;
const r2 = x => x == null || !isFinite(x) ? null : Math.round(x * 100) / 100;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const clip = C.clip;
const logit = p => { const c = clip(p); return Math.log(c / (1 - c)); };
const sig = z => 1 / (1 + Math.exp(-z));
const llOf = (p, o) => o ? -Math.log(clip(p)) : -Math.log(1 - clip(p));
const brOf = (p, o) => (p - o) ** 2;

/* ---------- 1. data, the archive, the walk-forward rows ---------- */
const D = C.loadAll();
const research = JSON.parse(fs.readFileSync(path.join(C.ROOT, 'research', 'props.json'), 'utf8'));
const foldOf = S => research.folds.find(f => f.season === S);
const L = C.archiveLines(D, research), N = L.length;
const pub = foldOf(2026).market.all;
{
  const llM = L.reduce((s, x) => s + llOf(x.pm, x.o), 0) / N, llQ = L.reduce((s, x) => s + llOf(x.q, x.o), 0) / N;
  log(`archive: ${N} graded lines on ${new Set(L.map(x => x.game)).size} games; log loss model ${r4(llM)}, DraftKings ${r4(llQ)} (published ${pub.logloss.model}, ${pub.logloss.market}, ${pub.lines} lines)`);
  if (N !== pub.lines || r4(llM) !== pub.logloss.model || r4(llQ) !== pub.logloss.market) throw new Error('the archive does not grade as research/props.json says: stop');
  const fb = PR.flatBets(L.map(x => ({ pModel: x.pm, over: x.over, under: x.under, result: x.result })), EDGE);
  if (fb.over.units !== pub.flat.edge3.over.units || fb.under.units !== pub.flat.edge3.under.units || fb.over.bets !== pub.flat.edge3.over.bets) throw new Error('flat bets do not reproduce');
  log(`the model's flat bets: Overs ${fb.over.bets} ${fb.over.units}, Unders ${fb.under.bets} ${fb.under.units}: as published`);
}
const WF = {};
for (const S of [2025, 2026]) {
  const fold = foldOf(S), NV = PR.fitNaiveVar(D.rows, r => r.season >= PR.FIRST + 1 && r.season < S);
  const sc = PR.score(D.rows, fold.params, NV, r => r.season === S);
  const bad = PR.ALL.filter(k => sc.stats[k].mae !== fold.stats[k].mae || sc.stats[k].logScore !== fold.stats[k].logScore);
  if (bad.length || sc.players !== fold.players) throw new Error(`fold ${S} does not score as research/props.json says (${bad.join(', ')})`);
  WF[S] = { players: sc.players, stats: Object.fromEntries(PR.ALL.map(k => [k, { mae: sc.stats[k].mae, logScore: sc.stats[k].logScore }])) };
  log(`walk-forward ${S}: ${sc.players} player-games, points MAE ${sc.stats.pts.mae}, log score ${sc.stats.pts.logScore}: research/props.json's`);
}
const H = {}; for (const S of [2024, 2025, 2026]) H[S] = C.histRows(D, research, S);
/* the line-size cut points, as the explore step made them, and checked against its file */
const CUTS = {};
for (const k of PR.ALL) { const xs = H[2024].filter(x => x.stat === k && x.m >= 25).map(x => x.line).sort((a, b) => a - b); const q = p => xs[Math.floor(p * (xs.length - 1))]; CUTS[k] = [q(0.25), q(0.5), q(0.75)]; }
{ const ex = JSON.parse(fs.readFileSync(path.join(OUTD, 'cand_select_explore.json'), 'utf8')).cuts; if (JSON.stringify(ex) !== JSON.stringify(CUTS)) throw new Error('the cut points are not the explore step\'s'); }
delete H[2024];

/* ---------- 2. the rules, as cand_select.md writes them ---------- */
const tierOK = x => x.m >= 15 && x.m < 35;
const roleOK = x => !(x.fl && (x.fl.ret || x.fl.tmRet || x.fl.newTeam));
const sizeOK = x => x.line <= CUTS[x.stat][1];
const statOK = x => !C.POINTS.has(x.stat);
const sideByPhase = post => post ? 'under' : 'over';          // the archive is all post-season (play-in included): its playoff branch
const RULES = [
  { id: 'C-A', name: 'C-A (primary): 15-35 min, no return / teammate back / new club, line at or under the median', sel: x => tierOK(x) && roleOK(x) && sizeOK(x), side: null, seen: false },
  { id: 'C-B', name: 'C-B: C-A, side by phase (archive: Unders only)', sel: x => tierOK(x) && roleOK(x) && sizeOK(x), side: post => sideByPhase(post), seen: true },
  { id: 'C-side', name: 'C-side: every line, side by phase (archive: Unders only)', sel: () => true, side: post => sideByPhase(post), seen: true },
  { id: 'C-stat', name: 'C-stat: the non-points stats', sel: statOK, side: null, seen: true },
  { id: 'C-tier', name: 'C-tier: projected 15 to under 35 minutes', sel: tierOK, side: null, seen: false },
  { id: 'C-size', name: 'C-size: line at or under the stat\'s median', sel: sizeOK, side: null, seen: false },
  { id: 'C-role', name: 'C-role: no return after 3+ missed, no 20+ min teammate back, no new club', sel: roleOK, side: null, seen: false },
];
if (RULES.length !== NRULES) throw new Error('the family is seven rules');

/* ---------- 3. the scoring machinery ---------- */
const GAMES = [...new Set(L.map(x => x.game))];
const gIdx = new Map(GAMES.map((g, j) => [g, j]));
function betOf(x, pv, allowed) {
  const eo = pv - F.propImplied(x.over), eu = (1 - pv) - F.propImplied(x.under);
  let side = eo >= EDGE && eo >= eu ? 'over' : eu >= EDGE ? 'under' : null;
  if (side && allowed && side !== allowed) side = null;          // a side the rule does not allow is not bet (as flatBets picks one side a line)
  if (!side) return null;
  const price = side === 'over' ? x.over : x.under, edge = side === 'over' ? eo : eu;
  return { side, edge, won: x.result === side, units: x.result === side ? (price > 0 ? price / 100 : 100 / -price) : -1 };
}
/* resample the archive's 83 games: the mean of ratio groups [sum, count] (bootCI's method), or the sum of per-game totals */
function bootRatio(groups, qs, seed = 0) {
  const R = PR.rng(seed), n = groups.length, out = new Float64Array(NBOOT);
  for (let b = 0; b < NBOOT; b++) { let s = 0, c = 0; for (let j = 0; j < n; j++) { const g = groups[Math.floor(R() * n)]; s += g[0]; c += g[1]; } out[b] = c ? s / c : 0; }
  out.sort(); return qs.map(q => Math.round(out[Math.floor(q * NBOOT)] * 1e6) / 1e6);
}
function bootTotal(vals, qs, seed = 0) {
  const R = PR.rng(seed), n = vals.length, out = new Float64Array(NBOOT);
  for (let b = 0; b < NBOOT; b++) { let s = 0; for (let j = 0; j < n; j++) s += vals[Math.floor(R() * n)]; out[b] = s; }
  out.sort(); return qs.map(q => r2(out[Math.floor(q * NBOOT)]));
}
function scoreRule(rule) {
  const sel = L.map(x => rule.sel(x));
  const ll = GAMES.map(() => [0, 0]), br = GAMES.map(() => [0, 0]), llAll = GAMES.map(() => [0, 0]), brAll = GAMES.map(() => [0, 0]);
  const units = { over: new Float64Array(GAMES.length), under: new Float64Array(GAMES.length) };
  const flat = { over: { bets: 0, won: 0, units: 0, said: 0 }, under: { bets: 0, won: 0, units: 0, said: 0 } };
  const bands = {}; for (const s of ['over', 'under']) for (const b of ['3-5', '5-8', '8+']) bands[s + ' ' + b] = { bets: 0, won: 0, units: 0 };
  let n = 0, said = 0, hit = 0, qsaid = 0, gap = 0, dll = 0, dbr = 0, stats = {};
  L.forEach((x, i) => {
    const j = gIdx.get(x.game);
    llAll[j][1]++; brAll[j][1]++;
    if (!sel[i]) return;
    const a = llOf(x.pm, x.o) - llOf(x.q, x.o), c = brOf(x.pm, x.o) - brOf(x.q, x.o);
    n++; said += x.pm; hit += x.o; qsaid += x.q; gap += Math.abs(x.pm - x.q); dll += a; dbr += c;
    stats[x.stat] = (stats[x.stat] || 0) + 1;
    ll[j][0] += a; ll[j][1]++; br[j][0] += c; br[j][1]++; llAll[j][0] += a; brAll[j][0] += c;
    const bt = betOf(x, x.pm, rule.side ? rule.side(true) : null);
    if (bt) {
      const f = flat[bt.side]; f.bets++; f.won += bt.won; f.units += bt.units; f.said += bt.side === 'over' ? x.pm : 1 - x.pm; units[bt.side][j] += bt.units;
      const band = bands[bt.side + ' ' + (bt.edge < 0.05 ? '3-5' : bt.edge < 0.08 ? '5-8' : '8+')]; band.bets++; band.won += bt.won; band.units += bt.units;
    }
  });
  for (const s of ['over', 'under']) { const f = flat[s]; f.units = r2(f.units); f.roi = f.bets ? r4(f.units / f.bets) : null; f.said = f.bets ? r4(f.said / f.bets) : null; f.winRate = f.bets ? r4(f.won / f.bets) : null;
    f.ci90 = f.bets ? bootTotal([...units[s]], [0.05, 0.95]) : null; f.ciBonf = f.bets ? bootTotal([...units[s]], QB) : null; }
  for (const b of Object.values(bands)) { b.units = r2(b.units); b.roi = b.bets ? r4(b.units / b.bets) : null; }
  return { id: rule.id, name: rule.name, seen: rule.seen, sides: rule.side ? rule.side(true) : 'both', lines: n, share: r4(n / N), games: ll.filter(g => g[1]).length, stats,
    said: r4(said / n), hit: r4(hit / n), marketSaid: r4(qsaid / n), meanGap: r4(gap / n),
    selected: { logloss: { diff: r4(dll / n), ci90: bootRatio(ll, [0.05, 0.95]), ciBonf: bootRatio(ll, QB) }, brier: { diff: r4(dbr / n), ci90: bootRatio(br, [0.05, 0.95]), ciBonf: bootRatio(br, QB) } },
    allLines: { logloss: { diff: r4(dll / N), ci90: bootRatio(llAll, [0.05, 0.95]) }, brier: { diff: r4(dbr / N), ci90: bootRatio(brAll, [0.05, 0.95]) } },
    flat, bands };
}

/* ---------- 4. the walk-forward: tools/props.js's own numbers on the rows a rule selects ---------- */
function wfRule(rule, S) {
  const P = foldOf(S).params, rows = H[S];
  const pick = x => rule.side ? (rule.sel(x) && (rule.side(x.post) === 'under' ? x.pm <= x.pn : x.pm > x.pn)) : rule.sel(x);
  const acc = () => ({ n: 0, mae: {}, ls: {}, cnt: {}, llM: 0, llN: 0, rows: [] });
  const A = { sel: acc(), rest: acc() };
  for (const x of rows) {
    const a = pick(x) ? A.sel : A.rest;
    a.n++; a.cnt[x.stat] = (a.cnt[x.stat] || 0) + 1;
    a.mae[x.stat] = (a.mae[x.stat] || 0) + Math.abs(x.mu - x.y);
    a.ls[x.stat] = (a.ls[x.stat] || 0) - PR.nbLogPmf(x.y, x.mu, PR.nbVar(x.mu, P.var[x.stat]));
    a.llM += llOf(x.pm, x.o); a.llN += llOf(x.pn, x.o);
    if (a === A.sel) a.rows.push(x);
  }
  const fitShare = rs => { let w = 1; for (let it = 0; it < 50; it++) { let g = 0, h = 0; for (const x of rs) { const a = logit(x.pn), d = logit(x.pm) - a, s = sig(a + w * d); g += (s - x.o) * d; h += s * (1 - s) * d * d; } if (!(h > 0)) break; const st = g / h; w -= st; if (Math.abs(st) < 1e-7) break; } return w; };
  const fitSlope = rs => { let a = 0, b = 1; for (let it = 0; it < 40; it++) { let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0; for (const x of rs) { const z = logit(x.pm), q = sig(a + b * z), r = q - x.o, w = q * (1 - q); ga += r; gb += r * z; haa += w; hab += w * z; hbb += w * z * z; } const det = haa * hbb - hab * hab; if (!(det > 0)) break; const da = (hbb * ga - hab * gb) / det, db = (haa * gb - hab * ga) / det; a -= da; b -= db; if (Math.abs(da) + Math.abs(db) < 1e-8) break; } return b; };
  const out = {};
  for (const [k, a] of Object.entries(A)) {
    const per = s => a.cnt[s] ? { mae: r3(a.mae[s] / a.cnt[s]), logScore: r4(a.ls[s] / a.cnt[s]) } : null;
    const ks = PR.ALL.filter(s => a.cnt[s]);
    out[k] = { statRows: a.n, pts: per('pts'), pra: per('pra'), meanOf11: ks.length === 11 ? { mae: r3(ks.reduce((s, z) => s + a.mae[z] / a.cnt[z], 0) / 11), logScore: r4(ks.reduce((s, z) => s + a.ls[z] / a.cnt[z], 0) / 11) } : null,
      line: { llModel: r4(a.llM / a.n), llNaive: r4(a.llN / a.n) } };
    if (k === 'sel' && a.rows.length >= 50) { out[k].line.share = r3(fitShare(a.rows)); out[k].line.slope = r3(fitSlope(a.rows)); }
  }
  out.shareOfRows = r4(A.sel.n / rows.length);
  return out;
}

/* ---------- 5. --check: the reproductions done above, and each rule's size (no outcome is read) ---------- */
if (CHECK) {
  for (const rule of RULES) {
    let n = 0, bo = 0, bu = 0;
    for (const x of L) { if (!rule.sel(x)) continue; n++; const eo = x.pm - F.propImplied(x.over), eu = (1 - x.pm) - F.propImplied(x.under); let side = eo >= EDGE && eo >= eu ? 'over' : eu >= EDGE ? 'under' : null; if (side && rule.side && side !== rule.side(true)) side = null; if (side === 'over') bo++; if (side === 'under') bu++; }
    log(`${rule.id}: ${n} lines selected (${(100 * n / N).toFixed(1)}%), Over bets ${bo}, Under bets ${bu}`);
  }
  const R0 = PR.rng(3), g = Array.from({ length: 200 }, () => [R0() - 0.5, 1]);
  const a = bootRatio(g, [0.05, 0.95], 0), b = PR.bootCI(g, NBOOT, 0);
  log(`bootRatio at 5/95 against tools/props.js bootCI: [${a}] vs [${b}]`);
  if (a[0] !== b[0] || a[1] !== b[1]) throw new Error('bootRatio is not bootCI\'s method');
  log('check passed: no rule was scored');
  process.exit(0);
}

/* ---------- 6. the scoring run ---------- */
const OUT = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'Candidate C, selection rules (research/props_v2/cand_select.js; the rules in cand_select.md were written before this run)',
  lines: N, games: GAMES.length, bonferroni: QB, cuts: CUTS, walkForwardPublished: WF, model: scoreRule({ id: 'model', name: 'the model on every line', sel: () => true, side: null, seen: true }), rules: {}, walkForward: {} };
for (const rule of RULES) {
  const s = OUT.rules[rule.id] = scoreRule(rule);
  log(`${rule.id}: ${s.lines} lines, log loss on them ${s.selected.logloss.diff} [${s.selected.logloss.ci90}], Overs ${s.flat.over.bets} ${s.flat.over.units} [${s.flat.over.ci90}], Unders ${s.flat.under.bets} ${s.flat.under.units} [${s.flat.under.ci90}]`);
  OUT.walkForward[rule.id] = { 2025: wfRule(rule, 2025), 2026: wfRule(rule, 2026) };
}
OUT.walkForward.all = { 2025: wfRule({ sel: () => true }, 2025), 2026: wfRule({ sel: () => true }, 2026) };
/* the verdict, by the rule cand_select.md wrote */
const below = c => c && c[1] < 0, above = c => c && c[0] > 0;
for (const r of Object.values(OUT.rules)) {
  const ll90 = below(r.selected.logloss.ci90), llB = below(r.selected.logloss.ciBonf);
  const u90 = ['over', 'under'].filter(s => above(r.flat[s].ci90)), uB = ['over', 'under'].filter(s => above(r.flat[s].ciBonf));
  r.verdict = { logloss90: ll90, loglossBonf: llB, units90: u90, unitsBonf: uB,
    word: (ll90 || u90.length) ? ((llB || uB.length) ? (r.seen ? 'clears, but seen' : 'survives') : (r.seen ? 'clears at 90% only, and seen' : 'clears at 90% only, not at the family\'s level')) : 'does not clear' };
}
fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, 'cand_select.json'), JSON.stringify(OUT, null, 1) + '\n');

/* ---------- 7. the tables ---------- */
const sg = (x, d = 4) => x == null ? '' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(d);
const ci = (c, d = 4) => c ? `[${sg(c[0], d)}, ${sg(c[1], d)}]` : '';
const pc = x => x == null ? '' : (100 * x).toFixed(1) + '%';
const fl = f => f.bets ? `${f.bets}, ${f.won} (${pc(f.winRate)}; said ${pc(f.said)}), ${sg(f.units, 1)} (${sg(100 * f.roi, 1)}%) ${ci(f.ci90, 1)}` : 'none';
const T = [];
const all = [OUT.model, ...RULES.map(r => OUT.rules[r.id])];
T.push('## A. On the lines each rule selects: the model against DraftKings\' fair chance (90% from resampling the 83 games; Bonferroni level for seven rules beside it)', '',
  '| Rule | Seen? | Lines (share) | Over said / hit / DraftKings | Gap from DraftKings | Log loss diff [90%] [Bonferroni] | Brier diff [90%] [Bonferroni] |', '|---|---|---|---|---|---|---|');
for (const r of all) T.push(`| ${r.name} | ${r.seen ? 'seen' : 'prices unseen'} | ${r.lines} (${pc(r.share)}) | ${pc(r.said)} / ${pc(r.hit)} / ${pc(r.marketSaid)} | ${(100 * r.meanGap).toFixed(1)} pts | ${sg(r.selected.logloss.diff)} ${ci(r.selected.logloss.ci90)} ${ci(r.selected.logloss.ciBonf)} | ${sg(r.selected.brier.diff)} ${ci(r.selected.brier.ci90)} ${ci(r.selected.brier.ciBonf)} |`);
T.push('', '## B. The candidate\'s chance over all 11,395 lines (the model\'s on the selected lines, DraftKings\' elsewhere), against DraftKings alone', '',
  '| Rule | Log loss diff [90%] | Brier diff [90%] |', '|---|---|---|');
for (const r of all) T.push(`| ${r.id || 'model'} | ${sg(r.allLines.logloss.diff)} ${ci(r.allLines.logloss.ci90)} | ${sg(r.allLines.brier.diff)} ${ci(r.allLines.brier.ci90)} |`);
T.push('', '## C. Flat one-unit bets at a 3-point edge over the price\'s implied chance, at the closing price (bets, won (rate; the model said), units (return) [90%, resampling games])', '',
  '| Rule | Sides | Overs | Unders | Units [Bonferroni], Overs; Unders |', '|---|---|---|---|---|');
for (const r of all) T.push(`| ${r.id || 'model'} | ${r.sides} | ${fl(r.flat.over)} | ${fl(r.flat.under)} | ${ci(r.flat.over.ciBonf, 1) || 'none'}; ${ci(r.flat.under.ciBonf, 1) || 'none'} |`);
T.push('', '## D. The bets by edge, described, not tested (bets, won, units)', '', '| Rule | Overs 3-5 | Overs 5-8 | Overs 8+ | Unders 3-5 | Unders 5-8 | Unders 8+ |', '|---|---|---|---|---|---|---|');
const bd = b => b.bets ? `${b.bets}, ${b.won}, ${sg(b.units, 1)}` : '';
for (const r of all) T.push(`| ${r.id || 'model'} | ${bd(r.bands['over 3-5'])} | ${bd(r.bands['over 5-8'])} | ${bd(r.bands['over 8+'])} | ${bd(r.bands['under 3-5'])} | ${bd(r.bands['under 5-8'])} | ${bd(r.bands['under 8+'])} |`);
T.push('', '## E. The verdict, by the rule written before the run', '', '| Rule | Seen? | Log loss interval below 0: 90% / Bonferroni | Units interval above 0: 90% / Bonferroni | Verdict |', '|---|---|---|---|---|');
for (const r of RULES.map(x => OUT.rules[x.id])) T.push(`| ${r.id} | ${r.seen ? 'seen' : 'prices unseen'} | ${r.verdict.logloss90 ? 'yes' : 'no'} / ${r.verdict.loglossBonf ? 'yes' : 'no'} | ${r.verdict.units90.join(', ') || 'no'} / ${r.verdict.unitsBonf.join(', ') || 'no'} | ${r.verdict.word} |`);
T.push('', '## F. The box-score walk-forward: tools/props.js on the rows each rule selects, and on the rest (rows projected 8+)', '',
  'The candidate is tools/props.js on its rows (no mean moves), so its difference from tools/props.js is zero by construction; what a rule can do is pick rows. "Line" is the book-like line: the model\'s log loss of the Over, the naive forecaster\'s, and the share and slope on the selected rows.', '',
  '| Rule | Fold | Share of rows | Points MAE / log score: selected; rest | PRA MAE / log score: selected; rest | Mean of 11 stats MAE / log score: selected; rest | Line: model / naive log loss; share; slope |', '|---|---|---|---|---|---|---|');
const ms = v => v ? `${v.mae} / ${v.logScore}` : '';
for (const id of ['all', ...RULES.map(r => r.id)]) for (const S of [2025, 2026]) {
  const w = OUT.walkForward[id][S];
  T.push(`| ${id} | ${S} | ${pc(w.shareOfRows)} | ${ms(w.sel.pts)}; ${ms(w.rest.pts)} | ${ms(w.sel.pra)}; ${ms(w.rest.pra)} | ${ms(w.sel.meanOf11)}; ${ms(w.rest.meanOf11)} | ${w.sel.line.llModel} / ${w.sel.line.llNaive}; ${w.sel.line.share ?? ''}; ${w.sel.line.slope ?? ''} |`);
}
T.push('', `tools/props.js as published (research/props.json, every row the walk-forward scores, any minutes): points MAE ${WF[2025].stats.pts.mae} and ${WF[2026].stats.pts.mae}, log score ${WF[2025].stats.pts.logScore} and ${WF[2026].stats.pts.logScore}; reproduced to the digit by this run.`);
fs.writeFileSync(path.join(OUTD, 'cand_select_tables.md'), T.join('\n') + '\n');
log('results/cand_select.json and results/cand_select_tables.md written');
