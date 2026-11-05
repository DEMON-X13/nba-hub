/* How the validity check's thresholds were set (validity.js, README "The validity check"), on data already in hand: the
 * 2026 play-in and playoff archive (data/props_2026.csv, the 2026 fold) and the box scores of 2023-24 and 2025-26. No
 * provider-40 line is read (none has been fetched), no candidate is scored, and nothing of 2026-27 is opened (cut2026.js).
 *
 *   node research/props_v2/validity_calib.js     writes results/validity_calib.json and results/validity_calib.md;
 *                                                 exits 1 unless validity_lib.js's TH are the thresholds derived here
 *
 * 1. The references on the archive and their noise: each stat's V3 figure, its spread from a bootstrap of the 83 games
 *    (10,000 resamples, seed 0); V2's figure, its spread from a null (n of the archive's player-games drawn at random as
 *    the exits, 10,000 draws, seed 0), since its six exits are too few for a bootstrap.
 * 2. The regime. The archive is the playoffs and the test the regular season. On the box scores alone, the yardstick
 *    V3 uses (tools/props.js's walk-forward, at its own median line, against the naive forecaster: gP in
 *    validity_lib.js) is measured on the archive's lined players and on the regular seasons of 2023-24 and 2025-26,
 *    reweighted to the archive's mix of projected minutes. How far it moves is how far a pre-game price's gain over the
 *    naive can move between the two regimes with nothing in-game in it, which the first version of V3 (DraftKings' gain
 *    against the archive's plus 0.02) did not allow for; V3 now subtracts the yardstick in its own season. V2's regime:
 *    how many early exits a pre-game price could see coming (the player had missed his side's previous game: a return,
 *    often on a minutes limit), which V2 now leaves out, and how many of the rest were over by each share of the game.
 * 3. Planted in-game prices. Every archive line repriced as a price read at a share tau of the game would be: DraftKings'
 *    own pre-game distribution (a negative binomial with the naive's spread curve, its mean solved so that its chance of
 *    the Over is DraftKings' fair chance), the player's stat so far drawn as a binomial share of his final stat (a share
 *    tau of his minutes, or all of them if his night ended before tau, at minutes played over minutes projected), and the
 *    rest of his game at the pre-game rate; a player whose night had ended is known done. Prices are held within 1% and
 *    99%. Each figure is the exact expectation over the draw, so there is no seed. At tau = 0 the planted price is
 *    DraftKings' (checked). How far each check moves with every line planted, and so the share of games a test may hold
 *    at tau before each check flags it.
 * 4. The thresholds: a VOID on a genuine pre-game set at most 5% of the time across the seven checks (one-sided,
 *    z = 2.45 each), counting the archive's noise and a test of 500 games (the fetch expects about 1,000) or, for V2,
 *    of the fewest early exits it accepts (about half the 2023-24 regular season's expected count). V3 rounded up to
 *    0.005, V2's floor down to 0.01. This assumes DraftKings' gain over the naive moves between the regimes as the
 *    yardstick's does, which no data in hand can check.
 * 5. What they cannot see, against the bar: the contamination that moves DraftKings' log loss by the bar's resolution
 *    (about 0.002 on these lines) beside the contamination each check flags.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const REC = require('../../tools/props_record.js');
const SL = require('./cand_select_lib.js');
const V = require('./validity_lib.js');

const OUTD = path.join(__dirname, 'results');
const { BASE, TH, ll, sfAt } = V;
const TAUS = [0.05, 0.1, 0.25, 0.5, 0.75];
const ALPHA = 0.05, NCHECKS = BASE.length + 1, Z = PR.normInv(1 - ALPHA / NCHECKS);
const TEST_GAMES = 500, BAR_RES = 0.002, NBOOT = 10000;
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const clip99 = p => Math.min(0.99, Math.max(0.01, p));
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);
const sdOf = a => { const m = mean(a); return Math.sqrt(a.reduce((s, x) => s + (x - m) * (x - m), 0) / (a.length - 1)); };

const D = SL.loadAll();
const research = JSON.parse(fs.readFileSync(path.join(SL.ROOT, 'research', 'props.json'), 'utf8'));
const G = V.gradeLines(D, research, 2026, REC.readRecord(2026)), A = G.L, NV = G.NV;
log(`the archive: ${A.length} graded base-stat lines on ${G.games.size} games`);
const gameIds = [...new Set(A.map(x => x.game))].sort();

/* ---------- the statistics, as validity.js reads them ---------- */
const v3Of = x => (ll(x.pn, x.o) - ll(x.q, x.o)) - x.gP;              // DraftKings' gain over the naive, less the yardstick's
const gainOf = x => ll(x.pn, x.o) - ll(x.q, x.o);                     // the first version's figure
const v2Base = xs => xs.filter(x => x.m >= TH.v2MinProjected && (!TH.v2PlayedPrevious || x.prev === true));
function v2Diff(xs, qOf = x => x.q) {
  let w = 0, wd = 0;
  for (const k of BASE) {
    const b = xs.filter(x => x.stat === k), ex = b.filter(x => x.mAct < TH.v2ExitUnder), rest = b.filter(x => x.mAct >= TH.v2ExitUnder);
    if (!ex.length || !rest.length) continue;
    w += ex.length; wd += ex.length * (mean(ex.map(qOf)) - mean(rest.map(qOf)));
  }
  return w ? wd / w : null;
}
const exitsOf = xs => new Set(xs.filter(x => x.mAct < TH.v2ExitUnder).map(x => x.game + '|' + x.player)).size;
/* a bootstrap of games: the sd of a statistic over resamples */
function bootSd(xs, stat) {
  const by = new Map(); for (const x of xs) { if (!by.has(x.game)) by.set(x.game, []); by.get(x.game).push(x); }
  const ids = [...by.keys()], R = PR.rng(0), vals = [];
  for (let b = 0; b < NBOOT; b++) { const s = []; for (let j = 0; j < ids.length; j++) for (const x of by.get(ids[Math.floor(R() * ids.length)])) s.push(x); const v = stat(s); if (v != null) vals.push(v); }
  return sdOf(vals);
}

/* ---------- 1. the references and their noise ---------- */
const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v2/validity_calib.js: the validity check\'s thresholds, set on the 2026 archive and the box scores of 2023-24 and 2025-26 (no provider-40 line, no candidate, nothing of 2026-27)',
  z: r4(Z), alpha: ALPHA, checks: NCHECKS, testGames: TEST_GAMES, games: gameIds.length, graded: A.length, ref: { v3: {}, v2: {} } };
for (const k of BASE) {
  const xs = A.filter(x => x.stat === k && x.pn != null);
  out.ref.v3[k] = { n: xs.length, v3: r4(mean(xs.map(v3Of))), sd: r4(bootSd(xs, s => mean(s.map(v3Of)))), gain: r4(mean(xs.map(gainOf))), yardstick: r4(mean(xs.map(x => x.gP))) };
}
/* V2's noise: its six early exits are too few for a bootstrap of games to say much, so its spread is read from a null
   instead: n of the archive's player-games (projected 24+, his side's previous game played) drawn at random as the
   "exits", the rest as the rest, 10,000 draws (seed 0). That is the figure's spread when the exits are nothing but
   chance, at n = the archive's own count and at the fewest a test accepts. */
function nullSd(b, n) {
  const by = new Map(); for (const x of b) { const k = x.game + '|' + x.player; if (!by.has(k)) by.set(k, []); by.get(k).push(x); }
  const pgs = [...by.values()], tot = {}; for (const k of BASE) tot[k] = [0, 0];
  for (const x of b) { tot[x.stat][0] += x.q; tot[x.stat][1]++; }
  const R = PR.rng(0), idx = pgs.map((_, i) => i), vals = [];
  for (let d = 0; d < NBOOT; d++) {
    for (let j = 0; j < n; j++) { const r = j + Math.floor(R() * (idx.length - j)); [idx[j], idx[r]] = [idx[r], idx[j]]; }
    const ex = {}; for (const k of BASE) ex[k] = [0, 0];
    for (let j = 0; j < n; j++) for (const x of pgs[idx[j]]) { ex[x.stat][0] += x.q; ex[x.stat][1]++; }
    let w = 0, wd = 0;
    for (const k of BASE) { const e = ex[k], t = tot[k]; if (!e[1] || e[1] === t[1]) continue; w += e[1]; wd += e[1] * (e[0] / e[1] - (t[0] - e[0]) / (t[1] - e[1])); }
    if (w) vals.push(wd / w);
  }
  return sdOf(vals);
}
const V2B = v2Base(A);
{
  const b = V2B;
  out.ref.v2 = { lines: b.length, playerGames: new Set(b.map(x => x.game + '|' + x.player)).size, exitLines: b.filter(x => x.mAct < TH.v2ExitUnder).length, exits: exitsOf(b), diff: r4(v2Diff(b)),
    sdNull: r4(nullSd(b, exitsOf(b))), sdBoot: r4(bootSd(b, v2Diff)),
    allPlayers: { exits: exitsOf(A.filter(x => x.m >= TH.v2MinProjected)), diff: r4(v2Diff(A.filter(x => x.m >= TH.v2MinProjected))) } };
}
log('references', JSON.stringify(out.ref));

/* ---------- 2. the regime, on box scores alone ---------- */
const tierOf = SL.tierOf;
const mix = {}; for (const k of BASE) { mix[k] = {}; const xs = A.filter(x => x.stat === k && x.gP != null); for (const x of xs) mix[k][tierOf(x.m)] = (mix[k][tierOf(x.m)] || 0) + 1 / xs.length; }
const prevOf = V.previousPlayed(D);
function seasonYardstick(S, to) {
  const P = research.folds.find(f => f.season === S).params;
  const NVs = PR.fitNaiveVar(D.rows, r => r.season >= PR.FIRST + 1 && r.season < S);
  const pr = PR.project(D.rows, P, r => r.season === S && r.type === 'REG' && r.date <= to);
  const acc = {}; for (const k of BASE) acc[k] = {};
  let p24 = 0, ex = 0, exMissed = 0, missed = 0; const eOf = [];
  for (const [i, x] of pr) {
    const r = D.rows[i]; if (!r.played || !(r.min > 0) || x.m < PR.MIN_SHOWN) continue;
    for (const k of BASE) {
      const nv = SL.naiveMean(r.f, k); if (nv == null) continue;
      const nn = Math.max(nv, 0.01), mu = x.mu[k], Lm = Math.floor(mu) + 0.5, y = PR.yOf(r.y, k), om = y > Lm ? 1 : 0;
      const g = ll(sfAt(Lm, nn, NVs[k]), om) - ll(sfAt(Lm, Math.max(mu, 0.01), P.var[k]), om), t = tierOf(x.m);
      const a = acc[k][t] = acc[k][t] || [0, 0]; a[0] += g; a[1]++;
    }
    if (x.m >= TH.v2MinProjected) { const pv = prevOf.get(r.game + '|' + r.id); p24++; if (pv === false) missed++;
      if (r.min < TH.v2ExitUnder) { ex++; if (pv === false) exMissed++; else if (pv === true) eOf.push(r.min / x.m); } }
  }
  const ys = {};
  for (const k of BASE) { let s = 0, w = 0; for (const [t, sh] of Object.entries(mix[k])) { const a = acc[k][t]; if (a && a[1]) { s += sh * a[0] / a[1]; w += sh; } } ys[k] = r4(s / w); }
  /* of the early exits V2 reads (his side's previous game played), the share whose night was over by tau: minutes played
     under a share tau of minutes projected, the planted prices' rule for a night known to be done */
  const doneBy = Object.fromEntries(TAUS.map(t => [t, r4(eOf.filter(e => e <= t).length / eOf.length)]));
  return { season: S, to, yardstick: ys, v2: { projected24: p24, exits: ex, exitRate: r4(ex / p24), missedPrevious: missed, exitsMissedPrevious: exMissed, exitRateMissed: r4(exMissed / missed), exitRateOthers: r4((ex - exMissed) / (p24 - missed)), exitsRead: eOf.length, doneBy } };
}
out.regime = { archive: {}, seasons: [] };
for (const k of BASE) out.regime.archive[k] = out.ref.v3[k].yardstick;
{ const b = A.filter(x => x.m >= TH.v2MinProjected), byPg = new Map(); for (const x of b) byPg.set(x.game + '|' + x.player, x);
  const pg = [...byPg.values()], ex = pg.filter(x => x.mAct < TH.v2ExitUnder), read = ex.filter(x => x.prev === true);
  out.regime.archiveV2 = { projected24: pg.length, exits: ex.length, missedPrevious: pg.filter(x => x.prev === false).length, exitsMissedPrevious: ex.filter(x => x.prev === false).length,
    exitsRead: read.length, doneBy: Object.fromEntries(TAUS.map(t => [t, r4(read.filter(x => x.mAct / x.m <= t).length / read.length)])) }; }
for (const [S, to] of [[2024, '2024-04-14'], [2026, '2026-04-12']]) { log(`the ${S} regular season's yardstick`); out.regime.seasons.push(seasonYardstick(S, to)); }
out.regime.shift = {};
for (const k of BASE) out.regime.shift[k] = out.regime.seasons.map(s => r4(s.yardstick[k] - out.regime.archive[k]));
/* the first version of V3 on a genuine regular-season set: its gain moved as the yardstick does, against the archive's
   gain plus 0.02. Its room: 0.02 less the shift (below zero, the set's expected figure is over the limit) */
out.regime.firstVersionRoom = Object.fromEntries(BASE.map(k => [k, r4(0.02 - out.regime.shift[k][0])]));
log('regime', JSON.stringify(out.regime.shift));

/* ---------- 3. planted in-game prices ---------- */
function mu0Of(x) {                                   // the mean at which the naive's spread curve gives DraftKings' fair chance
  const k = Math.floor(x.line) + 1, v = NV[x.stat], f = mu => PR.nbSf(k, mu, PR.nbVar(mu, v));
  let lo = 1e-4, hi = 300; if (f(hi) < x.q) return hi; if (f(lo) > x.q) return lo;
  for (let i = 0; i < 80; i++) { const mid = Math.sqrt(lo * hi); if (f(mid) < x.q) lo = mid; else hi = mid; }
  return Math.sqrt(lo * hi);
}
function binom(n, s) {                                // P(X = 0..n), X ~ Binomial(n, s)
  const out = new Array(n + 1).fill(0);
  if (s <= 0) { out[0] = 1; return out; } if (s >= 1) { out[n] = 1; return out; }
  let p = Math.pow(1 - s, n); out[0] = p;
  for (let j = 0; j < n; j++) { p *= (n - j) / (j + 1) * s / (1 - s); out[j + 1] = p; }
  return out;
}
for (const x of A) x.mu0 = mu0Of(x);
function planted(x, tau) {                            // the expected price and log loss of a price read at tau
  const e = x.m > 0 ? Math.min(1, x.mAct / x.m) : 1, k = Math.floor(x.line) + 1, y = Math.round(x.y);
  if (e < 1 && tau >= e) { const p = clip99(x.y > x.line ? 1 : 0); return { p, l: ll(p, x.o) }; }
  const s = Math.min(1, tau / e), muR = Math.max(x.mu0 * (1 - tau), 1e-9), v = NV[x.stat], b = binom(y, s);
  let p = 0, l = 0;
  for (let j = 0; j <= y; j++) { if (!b[j]) continue; const pj = clip99(PR.nbSf(k - j, muR, PR.nbVar(muR, v))); p += b[j] * pj; l += b[j] * ll(pj, x.o); }
  return { p, l };
}
{ let worst = 0; for (const x of A) worst = Math.max(worst, Math.abs(planted(x, 0).p - clip99(x.q))); out.plantCheck = { tau0MaxAbsDiff: worst };
  if (worst > 1e-6) throw new Error(`a price planted at tau = 0 is not DraftKings' (off by ${worst})`); }
out.planted = {};
for (const tau of TAUS) {
  const P = A.map(x => planted(x, tau)), byStat = {};
  for (const k of BASE) { const ix = A.map((x, i) => i).filter(i => A[i].stat === k && A[i].pn != null);
    byStat[k] = { gainMove: r4(mean(ix.map(i => ll(A[i].q, A[i].o) - P[i].l))) }; }
  const ix = A.map((x, i) => i), pIdx = new Map(A.map((x, i) => [x, i]));
  const b = v2Base(A), d = v2Diff(b, x => P[pIdx.get(x)].p);
  out.planted[tau] = { byStat, v2Diff: r4(d), v2Move: r4(d - out.ref.v2.diff), logLossMove: r4(mean(ix.map(i => P[i].l - ll(A[i].q, A[i].o)))) };
  log(`planted at tau ${tau}`, JSON.stringify(out.planted[tau]));
}

/* ---------- 4. the thresholds ---------- */
const up5 = x => Math.ceil(x * 200 - 1e-9) / 200, down1 = x => Math.floor(x * 100 + 1e-9) / 100;
const scaleTest = TEST_GAMES / gameIds.length;
out.derived = { v3Slack: {}, v3Raw: {} };
for (const k of BASE) { const sd = out.ref.v3[k].sd, raw = Z * Math.sqrt(sd * sd + sd * sd / scaleTest); out.derived.v3Raw[k] = r4(raw); out.derived.v3Slack[k] = up5(raw); }
/* V2: the fewest early exits a test may decide on is about half what 2023-24 should give (its regular season's exits of
   players who played their side's previous game, at provider 40's 91% of games), and the floor holds at that count */
const s24 = out.regime.seasons[0].v2, expectExits = Math.round((s24.exits - s24.exitsMissedPrevious) * 0.91);
out.derived.v2ExpectedExits = expectExits;
out.derived.v2MinExits = Math.floor(expectExits / 2 / 10) * 10;
{ const sdRef = out.ref.v2.sdNull, sdTest = nullSd(V2B, out.derived.v2MinExits), raw = out.ref.v2.diff - Z * Math.sqrt(sdRef * sdRef + sdTest * sdTest);
  out.derived.v2SdAtMin = r4(sdTest); out.derived.v2FloorRaw = r4(raw); out.derived.v2Floor = down1(raw); }

/* ---------- 5. what the checks see, and what they cannot ---------- */
out.sees = {};
for (const tau of TAUS) {
  const p = out.planted[tau], v3 = Math.min(...BASE.map(k => p.byStat[k].gainMove > 0 ? out.derived.v3Slack[k] / p.byStat[k].gainMove : Infinity));
  const v2 = p.v2Move < 0 ? (out.ref.v2.diff - out.derived.v2Floor) / -p.v2Move : Infinity, bar = p.logLossMove < 0 ? BAR_RES / -p.logLossMove : Infinity;
  out.sees[tau] = { v3FlagsShare: v3 <= 1 ? r4(v3) : null, v2FlagsShare: v2 <= 1 ? r4(v2) : null, barShare: bar <= 1 ? r4(bar) : null };
}
log('sees', JSON.stringify(out.sees));

/* ---------- the tables ---------- */
const f4 = x => x == null ? '' : (x > 0 ? '+' : x < 0 ? '−' : '') + Math.abs(x).toFixed(4).replace(/^0/, '0');
const f3 = x => x == null ? '' : (x < 0 ? '−' : '') + Math.abs(x).toFixed(3);
const pc = x => x == null ? 'not even at 100%' : Math.round(x * 1000) / 10 + '%';
const NAME = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', tpm: 'Threes', stl: 'Steals', blk: 'Blocks' };
const md = [`# The validity check's thresholds (validity_calib.js)`, '', `Generated ${out.generated} by \`node research/props_v2/validity_calib.js\`, from \`results/validity_calib.json\`. The 2026 play-in and playoff archive (${out.graded} graded base-stat lines, ${out.games} games) and the box scores of 2023-24 and 2025-26; no provider-40 line, no candidate, nothing of 2026-27. z = ${out.z} (a VOID on a genuine set at most ${out.alpha * 100}% of the time across ${out.checks} one-sided checks); a test of ${TEST_GAMES} games.`, '',
  '## V3: DraftKings\' gain over the naive, less the yardstick\'s', '',
  '| Stat | Archive: DraftKings\' gain | Yardstick | Figure | Its sd (games) | Slack, worked | Slack, registered | Yardstick, 2023-24 regular season less the archive | 2025-26 | First version\'s room (0.02 less the 2023-24 shift) |', '|---|---|---|---|---|---|---|---|---|---|'];
for (const k of BASE) { const r = out.ref.v3[k]; md.push(`| ${NAME[k]} | ${f4(r.gain)} | ${f4(r.yardstick)} | ${f4(r.v3)} | ${r.sd.toFixed(4)} | ${out.derived.v3Raw[k].toFixed(4)} | ${out.derived.v3Slack[k].toFixed(3)} | ${f4(out.regime.shift[k][0])} | ${f4(out.regime.shift[k][1])} | ${f4(out.regime.firstVersionRoom[k])} |`); }
{ const r = out.ref.v2, a = out.regime.archiveV2, s4 = out.regime.seasons[0].v2, s6 = out.regime.seasons[1].v2;
  md.push('', '## V2: early exits', '',
    `- The archive, players projected ${TH.v2MinProjected}+ who played their side's previous game: ${r.exits} early exits (${r.exitLines} lines), figure ${f4(r.diff)}; with every player projected ${TH.v2MinProjected}+, ${r.allPlayers.exits} exits, ${f4(r.allPlayers.diff)}. Its spread when the exits are chance alone: sd ${r.sdNull.toFixed(4)} at ${r.exits} exits, ${out.derived.v2SdAtMin.toFixed(4)} at ${out.derived.v2MinExits} (a bootstrap of games gives ${r.sdBoot.toFixed(4)} at ${r.exits}, too few to trust).`,
    `- Expected in 2023-24: ${out.derived.v2ExpectedExits} early exits read (the regular season's ${s4.exits - s4.exitsMissedPrevious} of players who played their side's previous game, at provider 40's 91% of games); the fewest a test decides on, about half: ${out.derived.v2MinExits}. Floor, worked ${f4(out.derived.v2FloorRaw)}, registered −${Math.abs(out.derived.v2Floor).toFixed(2)}.`,
    `- Who leaves early: in the 2023-24 regular season ${s4.exits} of ${s4.projected24} player-games projected ${TH.v2MinProjected}+ (${(s4.exitRate * 100).toFixed(1)}%); among those who missed their side's previous game ${s4.exitsMissedPrevious} of ${s4.missedPrevious} (${(s4.exitRateMissed * 100).toFixed(1)}%), the rest ${(s4.exitRateOthers * 100).toFixed(1)}%. 2025-26: ${s6.exits} of ${s6.projected24}, ${(s6.exitRateMissed * 100).toFixed(1)}% and ${(s6.exitRateOthers * 100).toFixed(1)}%. The archive: ${a.exits} of ${a.projected24}, ${a.exitsMissedPrevious} of its ${a.missedPrevious} who had missed.`,
    `- The exits V2 reads whose night was over by a share of the game (minutes played under that share of minutes projected): ${TAUS.map(t => `${t}: 2023-24 ${pc(s4.doneBy[t])}, the archive ${pc(a.doneBy[t])}`).join('; ')}.`);
}
md.push('', '## Planted in-game prices: every archive line read at a share tau of its game', '',
  '| tau | DraftKings\' gain moves (by stat: points, rebounds, assists, threes, steals, blocks) | V2 moves | DraftKings\' log loss moves (six stats) | Share of games at tau V3 flags | V2 flags | that moves DraftKings by the bar\'s 0.002 |', '|---|---|---|---|---|---|---|');
for (const t of TAUS) { const p = out.planted[t], q = out.sees[t];
  md.push(`| ${t} | ${BASE.map(k => f3(p.byStat[k].gainMove)).join(', ')} | ${f3(p.v2Move)} | ${f3(p.logLossMove)} | ${pc(q.v3FlagsShare)} | ${pc(q.v2FlagsShare)} | ${pc(q.barShare)} |`); }
md.push('', `At tau = 0 every planted price is DraftKings' own (largest difference ${out.plantCheck.tau0MaxAbsDiff.toExponential(1)}). A share is where the expected figure crosses its limit, the reference taken as the test's expectation. V2's moves rest on the archive's ${out.ref.v2.exits} early exits: from tau = 0.25 on they are like a regular season's (the share of exits already over above), but at 0.05 and 0.1 one of the six was over and moves them, where a regular season's exits are over by then ${pc(out.regime.seasons[0].v2.doneBy[0.05])} and ${pc(out.regime.seasons[0].v2.doneBy[0.1])} of the time, so V2 sees almost nothing that early. The planted prices are a model: a points total thinned point by point is more telling early than baskets of two and three, so the moves at small tau are if anything high for points.`);
fs.writeFileSync(path.join(OUTD, 'validity_calib.md'), md.join('\n') + '\n');

const want = { v2MinExits: out.derived.v2MinExits, v2Floor: out.derived.v2Floor, v3Slack: out.derived.v3Slack };
const have = { v2MinExits: TH.v2MinExits, v2Floor: TH.v2Floor, v3Slack: TH.v3Slack };
out.carried = JSON.stringify(want) === JSON.stringify(have);
fs.writeFileSync(path.join(OUTD, 'validity_calib.json'), JSON.stringify(out, null, 1) + '\n');
console.log(out.carried ? 'validity_lib.js carries these thresholds' : `validity_lib.js does not carry these thresholds: derived ${JSON.stringify(want)}, carried ${JSON.stringify(have)}`);
if (!out.carried) process.exitCode = 1;
