/* Candidate C, step 1: the past seasons' diagnostics a selection rule is written from. Box scores only, no price: this
 * script never reads data/props_2026.csv (the archive) or anything of 2026-27.
 *
 *   node research/props_v2/cand_select_explore.js     writes results/cand_select_explore.md and .json
 *
 * The walk-forward folds, each projected by the constants fitted on the seasons before it (research/props.json): 2024
 * is where a rule is read from ("derive"); 2025 and 2026 together ("check") say whether what 2024 shows holds. At the
 * walk-forward's book-like line (the player's own average floored plus a half) the model's chance of the Over (pm) is set
 * against the walk-forward's naive forecaster's (pn: the same negative binomial on his own average). The naive forecaster
 * stands in for a market only in this sense: the model's disagreement with it is the model's own information (minutes,
 * pace, opponent, rates), and history can say where that disagreement holds up and where it is over-sized. History cannot
 * say where DraftKings knows more than the model: no price exists before the archive.
 *
 * Per group: rows; the chance said and what happened; log loss of the model and of the naive forecaster; the share of the
 * model's disagreement that is kept by maximum likelihood (o ~ sigma(logit pn + w (logit pm - logit pn)): 1 means its
 * disagreement is right-sized, under 1 over-sized); the model's own recalibration slope (o ~ sigma(a + b logit pm)); and
 * flat bets against a made-up market priced on the naive chance with DraftKings' kind of margin (all 7 points on the Over,
 * the hub's reading of DraftKings): Over at implied pn + 0.07, Under at 1 - pn, a bet where the model clears its side's
 * implied chance by 3 points. That last is a shape, never a profit: the naive forecaster is far weaker than a book.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const C = require('./cand_select_lib.js');

const OUTD = path.join(__dirname, 'results');
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r3 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e3) / 1e3;
const logit = p => Math.log(p / (1 - p));
const sig = z => 1 / (1 + Math.exp(-z));
const MARGIN = 0.07, EDGE = 0.03;

const D = C.loadAll();
const research = JSON.parse(fs.readFileSync(path.join(C.ROOT, 'research', 'props.json'), 'utf8'));
const H = {};
for (const S of [2024, 2025, 2026]) { H[S] = C.histRows(D, research, S); log(`fold ${S}: ${H[S].length} stat-rows`); }

/* line-size quarters: each stat's quartiles of the book-like line on 2024's rows projected 25+ (the players a book lines most) */
const CUTS = {};
for (const k of PR.ALL) {
  const xs = H[2024].filter(x => x.stat === k && x.m >= 25).map(x => x.line).sort((a, b) => a - b);
  const q = p => xs[Math.floor(p * (xs.length - 1))];
  CUTS[k] = [q(0.25), q(0.5), q(0.75)];
}
const sizeOf = x => { const c = CUTS[x.stat]; return x.line <= c[0] ? 'Q1' : x.line <= c[1] ? 'Q2' : x.line <= c[2] ? 'Q3' : 'Q4'; };

function fitShare(rows) {
  let w = 1;
  for (let it = 0; it < 50; it++) { let g = 0, h = 0;
    for (const x of rows) { const a = logit(x.pn), d = logit(x.pm) - a, s = sig(a + w * d); g += (s - x.o) * d; h += s * (1 - s) * d * d; }
    if (!(h > 0)) break; const st = g / h; w -= st; if (Math.abs(st) < 1e-7) break; }
  return w;
}
function fitSlope(rows) {
  let a = 0, b = 1;
  for (let it = 0; it < 40; it++) { let ga = 0, gb = 0, haa = 0, hab = 0, hbb = 0;
    for (const x of rows) { const z = logit(x.pm), q = sig(a + b * z), r = q - x.o, w = q * (1 - q); ga += r; gb += r * z; haa += w; hab += w * z; hbb += w * z * z; }
    const det = haa * hbb - hab * hab; if (!(det > 0)) break; const da = (hbb * ga - hab * gb) / det, db = (haa * gb - hab * ga) / det; a -= da; b -= db; if (Math.abs(da) + Math.abs(db) < 1e-8) break; }
  return { a, b };
}
function summ(rows) {
  if (rows.length < 50) return { n: rows.length };
  let said = 0, hit = 0, sn = 0, llM = 0, llN = 0;
  const bets = { over: { n: 0, u: 0, said: 0, won: 0 }, under: { n: 0, u: 0, said: 0, won: 0 } };
  for (const x of rows) {
    said += x.pm; hit += x.o; sn += x.pn;
    llM -= x.o ? Math.log(x.pm) : Math.log(1 - x.pm); llN -= x.o ? Math.log(x.pn) : Math.log(1 - x.pn);
    const io = Math.min(x.pn + MARGIN, 0.995), iu = 1 - x.pn;
    const eo = x.pm - io, eu = (1 - x.pm) - iu;
    const side = eo >= EDGE && eo >= eu ? 'over' : eu >= EDGE ? 'under' : null;
    if (side) { const b = bets[side], imp = side === 'over' ? io : iu, won = side === 'over' ? x.o : 1 - x.o; b.n++; b.said += side === 'over' ? x.pm : 1 - x.pm; b.won += won; b.u += won ? 1 / imp - 1 : -1; }
  }
  const n = rows.length, sl = fitSlope(rows);
  const bb = b => b.n ? { bets: b.n, said: r4(b.said / b.n), won: r4(b.won / b.n), roi: r4(b.u / b.n) } : { bets: 0 };
  return { n, said: r4(said / n), hit: r4(hit / n), naiveSaid: r4(sn / n), llModel: r4(llM / n), llNaive: r4(llN / n), skill: r4((llN - llM) / n),
    share: r3(fitShare(rows)), slope: r3(sl.b), shift: r3(sl.a), meanGap: r4(rows.reduce((s, x) => s + Math.abs(x.pm - x.pn), 0) / n), over: bb(bets.over), under: bb(bets.under) };
}

const derive = H[2024], check = H[2025].concat(H[2026]);
const GROUPS = [];
const add = (name, pred) => GROUPS.push([name, pred]);
add('all', () => true);
for (const k of PR.ALL) add('stat:' + k, x => x.stat === k);
add('family:points (pts, pra, pr, pa)', x => C.POINTS.has(x.stat));
add('family:the rest', x => !C.POINTS.has(x.stat));
for (const t of ['8-15', '15-20', '20-25', '25-30', '30-35', '35+']) add('tier:' + t, x => C.tierOf(x.m) === t);
add('tier:25-35', x => x.m >= 25 && x.m < 35);
add('tier:25+', x => x.m >= 25);
add('role:none known before tip', x => !x.role);
add('role:any', x => x.role);
add('role:ret (back after 3+ missed)', x => x.fl && x.fl.ret);
add('role:tmOutAbs (20+ min teammate inactive)', x => x.fl && x.fl.tmOutAbs);
add('role:tmRet (20+ min teammate back)', x => x.fl && x.fl.tmRet);
add('role:newTeam', x => x.fl && x.fl.newTeam);
add('role:club games 1-10', x => x.fl && x.fl.regN != null && x.fl.regN <= 10);
add('phase:regular season', x => !x.post);
add('phase:playoffs', x => x.post);
for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) add('size:' + q, x => sizeOf(x) === q);
const GAP = [[0, 0.03], [0.03, 0.05], [0.05, 0.08], [0.08, 0.12], [0.12, 1]];
for (const [lo, hi] of GAP) { add(`gap:${100 * lo}-${hi < 1 ? 100 * hi : ''} pts, model above`, x => x.pm - x.pn >= lo && x.pm - x.pn < hi && x.pm > x.pn); add(`gap:${100 * lo}-${hi < 1 ? 100 * hi : ''} pts, model below`, x => x.pn - x.pm >= lo && x.pn - x.pm < hi && x.pm <= x.pn); }
add('lean:model above the naive', x => x.pm > x.pn);
add('lean:model below the naive', x => x.pm <= x.pn);
for (const t of ['8-15', '15-20', '20-25', '25-30', '30-35', '35+']) { add(`tier ${t}, model above`, x => C.tierOf(x.m) === t && x.pm > x.pn); add(`tier ${t}, model below`, x => C.tierOf(x.m) === t && x.pm <= x.pn); }
for (const q of ['Q1', 'Q2', 'Q3', 'Q4']) { add(`size ${q}, model above`, x => sizeOf(x) === q && x.pm > x.pn); add(`size ${q}, model below`, x => sizeOf(x) === q && x.pm <= x.pn); }
add('points family, model above', x => C.POINTS.has(x.stat) && x.pm > x.pn); add('points family, model below', x => C.POINTS.has(x.stat) && x.pm <= x.pn);
add('the rest, model above', x => !C.POINTS.has(x.stat) && x.pm > x.pn); add('the rest, model below', x => !C.POINTS.has(x.stat) && x.pm <= x.pn);
add('playoffs, model above', x => x.post && x.pm > x.pn); add('playoffs, model below', x => x.post && x.pm <= x.pn);
add('playoffs, 25+ min, no role change', x => x.post && x.m >= 25 && !x.role);
add('regular season, 25-35 min, no role change', x => !x.post && x.m >= 25 && x.m < 35 && !x.role);
add('25-35 min, no role change', x => x.m >= 25 && x.m < 35 && !x.role);
add('25-35 min, no role change, model above', x => x.m >= 25 && x.m < 35 && !x.role && x.pm > x.pn);
add('25-35 min, no role change, model below', x => x.m >= 25 && x.m < 35 && !x.role && x.pm <= x.pn);

const OUT = { generated: new Date().toISOString().slice(0, 16) + 'Z', cuts: CUTS, margin: MARGIN, edge: EDGE, groups: {} };
const T = ['# Candidate C, step 1: the past seasons\' diagnostics (box scores only, no archive read)', '',
  `Generated ${OUT.generated} by research/props_v2/cand_select_explore.js. Rows projected 8+ minutes at the book-like line; derive = the 2024 fold, check = the 2025 and 2026 folds (each by its own constants).`,
  'share: the part of the model\'s disagreement with the naive forecaster kept by maximum likelihood (1 right-sized, under 1 over-sized); slope: the model\'s own recalibration slope; skill: naive log loss minus the model\'s; bets: against a made-up market priced on the naive chance with 7 points of margin on the Over, at a 3-point edge (roi a unit bet; a shape, not a profit).', '',
  'Line-size quarters (each stat\'s quartiles of the book-like line, 2024, rows projected 25+): ' + PR.ALL.map(k => `${k} ${CUTS[k].join('/')}`).join(', '), '',
  '| Group | span | rows | said | hit | gap | skill | share | slope | Over bets: n, said, won, roi | Under bets: n, said, won, roi |', '|---|---|---|---|---|---|---|---|---|---|---|'];
const pc = x => x == null ? '' : (100 * x).toFixed(1);
for (const [name, pred] of GROUPS) {
  const a = summ(derive.filter(pred)), b = summ(check.filter(pred));
  OUT.groups[name] = { derive: a, check: b };
  for (const [span, s] of [['2024', a], ['2025-26', b]]) {
    if (!s.said) { T.push(`| ${name} | ${span} | ${s.n} | | | | | | | | |`); continue; }
    const bt = v => v.bets ? `${v.bets}, ${pc(v.said)}, ${pc(v.won)}, ${(v.roi >= 0 ? '+' : '') + (100 * v.roi).toFixed(1)}%` : '0';
    T.push(`| ${name} | ${span} | ${s.n} | ${pc(s.said)} | ${pc(s.hit)} | ${pc(s.meanGap)} | ${s.skill.toFixed(4)} | ${s.share} | ${s.slope} | ${bt(s.over)} | ${bt(s.under)} |`);
  }
}
fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, 'cand_select_explore.json'), JSON.stringify(OUT, null, 1) + '\n');
fs.writeFileSync(path.join(OUTD, 'cand_select_explore.md'), T.join('\n') + '\n');
log('results/cand_select_explore.md and .json written');
