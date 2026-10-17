/* The same-game correlation table: how two legs of one game move together, for the Parlay Builder's same-game price
 * (README "Same-game parlays"). Measured on the hub's finished seasons only, never on the season in play.
 *
 *   node tools/corr.js         measure; writes data/corr.json (the table the builder reads) and research/corr.json
 *                              (the report: samples, raw and shrunk values, the threshold check, the held-out validation)
 *
 * What a leg is. A yes/no bet: a player's stat over (or under) a line, a milestone (k+, the over at k - 0.5), a double-
 * or triple-double, his team winning, covering the closing spread, the game's total going over the closing total. The
 * builder joins the legs of one game by a gaussian copula (the NFL hub's parlayProb): leg i hits when a standard normal
 * z_i passes the threshold its own chance sets, the z's correlated, so P(both hit) = P(z_a > t_a, z_b > t_b; rho). The
 * number each pair of leg kinds needs is that rho, the correlation of the two latent normals, and that is what is fitted.
 *
 * How. The box scores of 2022-23 to the last finished season (2021-22 only warms the props model up), every player who
 * played and was projected 12 minutes or more (the 5th percentile of the projected minutes of the players DraftKings
 * lined in the archived 2026 playoffs: about the players a book lines). Each of his legs is set where a book hangs a
 * main line: the half point at which the props model, as it stood before the game (tools/props.js, its own walk: the
 * minutes, rates, pace and opponent known that morning), gives the over the chance nearest 50%; his double- and
 * triple-double at the model's chance of one (rows with 2% and 0.5% or more). Each kind's chances are then moved by
 * one shift on the normal scale so they average what happened (the margins calibrated: rho is the dependence, not the
 * model's miss). A team's legs are the closing line's (data/odds_hist.csv, held to fetch_odds_hist.js's check): the
 * moneyline's chance with the margin taken out evenly, the spread and the total at even and shifted to what happened
 * (pushes left out). Then every pair of legs that shared a game is one observation of four outcomes (both hit, one, the
 * other, neither) at its own two thresholds, and rho is the maximum likelihood of all of them under the bivariate normal:
 * a tetrachoric correlation with each pair's own margins. Measured on the yes/no outcomes at the lines that matter,
 * not as a correlation of the stats, because that is what the copula consumes, and because steals, blocks and threes
 * are counts of 0, 1 and 2 whose normal scores would understate it; the props model's expectation is out of both legs
 * by construction (a leg is the stat against the line set from it).
 *
 * Pairs (a key is relation|kind|kind, the two kinds in sort order where the relation is symmetric):
 *   self   two stats of one player (self|pr|pts)
 *   mate   two teammates (mate|pts|pts, mate|ast|pts)
 *   opp    two opponents
 *   team   a player's stat with his own team's result: win, cover (the closing spread), over (the game's total), tpts
 *          and otpts (his team's and the other team's points over the closing line's implied team total: measured, no
 *          team-total leg is offered); the other team's win or cover is the same rho with its sign turned
 *   game   two of one game's own legs, the home side's: game|over|win, game|cover|over, game|cover|win
 * Kinds: pts reb ast tpm stl blk pra pr pa ar sb dd td (a milestone is its stat's kind) and win cover over.
 *
 * Thin pairs. Each rho carries a jackknife error (ten groups of games, so the players of one game move together), and
 * every rho is shrunk toward 0 by the empirical-Bayes factor tau^2 / (tau^2 + se^2), tau^2 its relation's spread of
 * true values (the mean squared rho less the mean squared error, over the relation's keys; a player with his club's
 * result and the game's own legs pooled); a pair with under 300 observations, under 5 expected in any of its four
 * outcomes, or whose likelihood peaks at the edge (|rho| 0.97 or more, which only nested pairs do: refused, below) is 0.
 * Two teammates' triple-doubles (4 of 10,228 pairs both) measure 0.04 with an error of 0.12, and are shrunk to 0.
 *
 * Refused pairs (REFUSED), never priced: one player's two legs that share a part (a stat and a combo holding it, two
 * combos with a part in common), a double- with a triple-double of one player (one is inside the other: its likelihood
 * peaks at the edge), a win with a cover of one game (one side bet a game). DraftKings publishes no list of what it takes
 * on one same-game ticket, so the builder is conservative; and a stat beside a sum holding it is not jointly gaussian at
 * these lines (steals with blocks measure 0.07, steals + blocks with steals 0.90 and with blocks 0.78, three values no
 * correlation matrix holds), so their rhos would not fit with the rest anyway.
 *
 * Positive definite in use. Pairwise rhos measured on different rows (a triple-double's on the few who can get one) need
 * not fit together, and as measured they do not (least eigenvalue -0.5). Every leg one game can carry is 13 players a
 * side (who dress), every kind each, and the win, the cover and the total: the table is moved to the nearest one that is
 * positive definite over all of them, each value held by its precision (1 / se^2; a refused pair free), and checked by a
 * Cholesky factor of that whole matrix, 341 legs; so every set of legs the builder can join is (a principal submatrix of
 * a positive definite matrix is one). Every move is in the report (finalTable, repair).
 *
 * Validated twice, on games the table never saw (a table measured on 2023-2025, against 2025-26): (1) the 2025-26
 * season's real pairs at model-set lines, every side of every pair the builder could join (a double- or triple-double
 * and a milestone are Yes only); (2) DraftKings' own closing main lines of the 2026 play-in and playoffs
 * (data/props_2026.csv), every pair of them in one game with DraftKings' fair chances (the whole margin on the Over)
 * as the margins, and the closing moneyline, spread and total: the joint hit rate the copula says, against what the
 * plain product (independence) says, against how often both legs hit. And the threshold check: rho measured at
 * milestone-like lines (the over at about 30%) beside rho at the main line, and the main-line table predicting pairs of
 * milestones. The shipped table is then measured on every finished season (2023-2026).
 *
 * The same-game hold (HOLD): no DraftKings same-game price is recorded anywhere this hub reads (ESPN carries none), so
 * the NFL hub's SGP_HOLD, 0.896, fitted to two real DraftKings tickets on Detroit at Buffalo (2026-09-17), is the
 * starting estimate, applied as the NFL hub applies it, untested on the NBA: a game's legs priced at
 * min(their decimal prices multiplied, HOLD / J), J the copula's joint chance of the legs' implied chances (each price's
 * own, margin left in); games multiplied with each other as before.
 *
 * Every number here is chosen on finished seasons; nothing reads the season in play (the season of any game not final),
 * and the script refuses to run if a season it would read is not finished.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const PM = require('./props');
const { check } = require('./fetch_odds_hist');

const OUT = process.env.NBA_CORR_OUT || path.join(L.ROOT, 'data', 'corr.json');
const REPORT = process.env.NBA_CORR_REPORT || path.join(L.ROOT, 'research', 'corr.json');
const PLAYER = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb', 'dd', 'td'];
const MAIN = PLAYER.slice(0, 11);                  // the kinds with a line (dd and td are Yes only)
const TEAM = ['win', 'cover', 'over', 'tpts', 'otpts'];
const OFFERED = ['win', 'cover', 'over'];          // the game legs the builder offers
const GAME_KEYS = ['game|over|win', 'game|cover|over', 'game|cover|win'];
const MIN_PROJ = 12, DD_MIN = 0.02, TD_MIN = 0.005;
const BIN = 0.04, G = 10, MIN_N = 300, MIN_CELL = 5, PSD_PLAYERS = 13;
const HOLD = 0.896;
const r2 = x => Math.round(x * 100) / 100, r3 = x => Math.round(x * 1000) / 1000, r4 = x => Math.round(x * 1e4) / 1e4;
const { normCdf, normInv } = PM;

/* ---------- the bivariate normal ---------- */
/* P(X > h, Y > k) for standard normals with correlation r: Alan Genz's BVND (Drezner and Wesolowsky's method with
   Gauss-Legendre points, the form scipy's mvn carries), to about 1e-15 with an exact normal cdf (props.js's normCdf is
   good to about 1e-7, which is the accuracy here) */
const GL = [
  [[0.1713244923791705, -0.9324695142031522], [0.3607615730481384, -0.6612093864662647], [0.4679139345726904, -0.2386191860831970]],
  [[0.04717533638651177, -0.9815606342467191], [0.1069393259953183, -0.9041172563704750], [0.1600783285433464, -0.7699026741943050],
   [0.2031674267230659, -0.5873179542866171], [0.2334925365383547, -0.3678314989981802], [0.2491470458134029, -0.1252334085114692]],
  [[0.01761400713915212, -0.9931285991850949], [0.04060142980038694, -0.9639719272779138], [0.06267204833410906, -0.9122344282513259],
   [0.08327674157670475, -0.8391169718222188], [0.1019301198172404, -0.7463319064601508], [0.1181945319615184, -0.6360536807265150],
   [0.1316886384491766, -0.5108670019508271], [0.1420961093183821, -0.3737060887154196], [0.1491729864726037, -0.2277858511416451],
   [0.1527533871307259, -0.07652652113349733]]];
const TWOPI = 2 * Math.PI;
function bvnUpper(dh, dk, r) {
  if (r >= 1) return normCdf(-Math.max(dh, dk));
  if (r <= -1) return Math.max(0, normCdf(-dh) - normCdf(dk));
  const ar = Math.abs(r), gl = ar < 0.3 ? GL[0] : ar < 0.75 ? GL[1] : GL[2];
  let h = dh, k = dk, hk = h * k, bvn = 0;
  if (ar < 0.925) {
    const hs = (h * h + k * k) / 2, asr = Math.asin(r);
    for (const [w, x] of gl) {
      let sn = Math.sin(asr * (x + 1) / 2); bvn += w * Math.exp((sn * hk - hs) / (1 - sn * sn));
      sn = Math.sin(asr * (-x + 1) / 2); bvn += w * Math.exp((sn * hk - hs) / (1 - sn * sn));
    }
    return Math.min(1, Math.max(0, bvn * asr / (2 * TWOPI) + normCdf(-h) * normCdf(-k)));
  }
  if (r < 0) { k = -k; hk = -hk; }
  const as = (1 - r) * (1 + r); let a = Math.sqrt(as);
  const bs = (h - k) ** 2, c = (4 - hk) / 8, d = (12 - hk) / 16;
  bvn = a * Math.exp(-(bs / as + hk) / 2) * (1 - c * (bs - as) * (1 - d * bs / 5) / 3 + c * d * as * as / 5);
  if (hk > -160) { const b = Math.sqrt(bs); bvn -= Math.exp(-hk / 2) * Math.sqrt(TWOPI) * normCdf(-b / a) * b * (1 - c * bs * (1 - d * bs / 5) / 3); }
  a /= 2;
  for (const [w, x] of gl) {
    let xs = (a * (x + 1)) ** 2, rs = Math.sqrt(1 - xs);
    bvn += a * w * (Math.exp(-bs / (2 * xs) - hk / (1 + rs)) / rs - Math.exp(-(bs / xs + hk) / 2) * (1 + c * xs * (1 + d * xs)));
    xs = as * (-x + 1) ** 2 / 4; rs = Math.sqrt(1 - xs);
    bvn += a * w * Math.exp(-(bs / xs + hk) / 2) * (Math.exp(-hk * (1 - rs) / (2 * (1 + rs))) / rs - (1 + c * xs * (1 + d * xs)));
  }
  bvn = -bvn / TWOPI;
  if (r > 0) bvn += normCdf(-Math.max(h, k));
  else bvn = -bvn + Math.max(0, normCdf(-h) - normCdf(-k));
  return Math.min(1, Math.max(0, bvn));
}
const bvnDensity = (h, k, r) => Math.exp(-(h * h - 2 * r * h * k + k * k) / (2 * (1 - r * r))) / (TWOPI * Math.sqrt(1 - r * r));
/* two legs' joint chance from their own chances and the rho between their hits (the sign of each side already in it) */
function joint2(pa, pb, rho) {
  if (!(pa > 0) || !(pb > 0)) return 0;
  if (pa >= 1) return pb; if (pb >= 1) return pa;
  return bvnUpper(normInv(1 - pa), normInv(1 - pb), rho);
}

/* ---------- the lookup the builder copies: two legs -> the rho between their hits ---------- */
/* a leg: { game, kind, player (a player leg), team (the player's club, or the side a win or cover is on), side ('over'
   or 'under' for a player's main line or the total; 'yes' for a milestone, double- or triple-double; a win or cover
   is its team), home (the game's home club) }. The rho is the table's for the pair's relation, with its sign turned
   for each Under and for a win or cover on the other club than the table's (the player's own, or the home side for two
   game legs). Two legs of different games: 0. A pair the builder must refuse (one player's stat twice, two totals,
   both sides of one game) is null: it is never priced */
const sgn = l => l.side === 'under' ? -1 : 1;
const isGameKind = k => TEAM.includes(k);
function rhoFor(table, a, b) {
  if (!a || !b || a.game !== b.game) return 0;
  const T = table.rho || table, get = k => (T[k] == null ? 0 : T[k]);
  const ga = isGameKind(a.kind), gb = isGameKind(b.kind);
  if (!ga && !gb) {
    const [k1, k2] = [a.kind, b.kind].sort();
    if (a.player === b.player) return a.kind === b.kind ? null : sgn(a) * sgn(b) * get(`self|${k1}|${k2}`);
    return sgn(a) * sgn(b) * get(`${a.team === b.team ? 'mate' : 'opp'}|${k1}|${k2}`);
  }
  if (ga !== gb) {
    const p = ga ? b : a, g = ga ? a : b;
    const club = g.kind === 'over' ? 1 : g.team === p.team ? 1 : -1;
    return sgn(p) * sgn(g) * club * get(`team|${p.kind}|${g.kind}`);
  }
  if (a.kind === b.kind) return null;
  const side = l => l.kind === 'over' ? sgn(l) : l.team === l.home ? 1 : -1;
  const [k1, k2] = [a.kind, b.kind].sort();
  return side(a) * side(b) * get(`game|${k1}|${k2}`);
}

/* ---------- the rows: every leg of every player-game, at its line, its chance and whether it hit ---------- */
const hash = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) % G; };
const yOf = (y, k) => k === 'dd' ? +(PM.doubles(y) >= 2) : k === 'td' ? +(PM.doubles(y) >= 3) : PM.yOf(y, k);
/* the half-point line where the over's chance is nearest `q` (0.5: a main line; 0.3: a milestone above it), its chance */
function lineAt(mu, v, q) {
  const pm = PM.nbPmf(Math.max(40, Math.ceil(mu + 12 * Math.sqrt(v) + 10)), mu, v);
  let cum = 0, best = null;
  for (let j = 0; j < pm.length; j++) { cum += pm[j]; const over = 1 - cum; if (!best || Math.abs(over - q) < Math.abs(best.p - q)) best = { line: j + 0.5, p: over }; if (over < q - 0.3) break; }
  return best;
}
/* one season set's rows: per game, each side's legs (t the normal threshold before the shift, hit 0/1, -1 where the
   leg is not there), and the game's own legs from the closing line */
function legRows(R, P, sel, q, odds) {
  const pr = PM.project(R.rows, P, sel);
  const games = new Map();
  for (const [i, x] of pr) {
    const r = R.rows[i];
    if (x.m < MIN_PROJ) continue;
    const p = new Float64Array(PLAYER.length).fill(NaN), h = new Int8Array(PLAYER.length).fill(-1);
    MAIN.forEach((k, j) => { const mu = x.mu[k]; if (!(mu > 0)) return; const v = PM.nbVar(mu, P.var[k]); const l = lineAt(mu, v, q); if (!l || !(l.p > 0.01 && l.p < 0.99)) return; p[j] = l.p; h[j] = yOf(r.y, k) > l.line ? 1 : 0; });
    if (q === 0.5) {
      const d = PM.doublesProb(x.mu, P.var, P.rho);
      if (d.dd >= DD_MIN) { p[11] = d.dd; h[11] = yOf(r.y, 'dd'); }
      if (d.td >= TD_MIN) { p[12] = d.td; h[12] = yOf(r.y, 'td'); }
    }
    let g = games.get(r.game);
    if (!g) games.set(r.game, g = { game: r.game, season: r.season, type: r.type, group: hash(r.game), sides: {} });
    (g.sides[r.team] = g.sides[r.team] || []).push({ id: r.id, team: r.team, p, h });
  }
  for (const g of games.values()) g.legs = gameLegs(g.game, odds);
  return games;
}
const dec = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;
/* the game's own legs, the home side's: { win, cover, over, tpts (home), otpts (away) } -> { p, h }; the spread's,
   total's and team totals' chances start at even and take their kind's shift */
function gameLegs(gid, odds) {
  const o = odds.get(gid); if (!o || !o.final) return {};
  const c = check(o), out = {};
  const hs = o.hs, as = o.as;
  if (c.ml) { const ih = 1 / dec(+o.home_ml), ia = 1 / dec(+o.away_ml); out.win = { p: ih / (ih + ia), h: hs > as ? 1 : 0 }; }
  if (c.ml && c.line) { const m = hs - as + +o.home_line; if (m !== 0) out.cover = { p: 0.5, h: m > 0 ? 1 : 0 }; }
  if (c.total) { const t = hs + as - +o.total; if (t !== 0) out.over = { p: 0.5, h: t > 0 ? 1 : 0 }; }
  if (c.ml && c.line && c.total) {
    const ih = (+o.total - +o.home_line) / 2, ia = (+o.total + +o.home_line) / 2;
    if (hs !== ih) out.tpts = { p: 0.5, h: hs > ih ? 1 : 0 };
    if (as !== ia) out.otpts = { p: 0.5, h: as > ia ? 1 : 0 };
  }
  return out;
}
/* each kind's shift on the normal scale, so that its chances average what happened: t = normInv(1 - p) + shift */
function shiftFor(ps, hits) {
  if (!ps.length) return 0;
  const target = hits.reduce((a, b) => a + b, 0);
  const t0 = ps.map(p => normInv(1 - p));
  let lo = -1.5, hi = 1.5;
  for (let it = 0; it < 60; it++) { const m = (lo + hi) / 2; let s = 0; for (const t of t0) s += normCdf(-(t + m)); if (s > target) lo = m; else hi = m; }
  return (lo + hi) / 2;
}
function shifts(games) {
  const acc = {}; const add = (k, p, h) => { const a = acc[k] = acc[k] || { p: [], h: [] }; a.p.push(p); a.h.push(h); };
  for (const g of games.values()) {
    for (const rows of Object.values(g.sides)) for (const r of rows) PLAYER.forEach((k, j) => { if (r.h[j] >= 0) add(k, r.p[j], r.h[j]); });
    for (const k of ['cover', 'over']) if (g.legs[k]) add(k, g.legs[k].p, g.legs[k].h);
    if (g.legs.tpts) add('tpts', 0.5, g.legs.tpts.h); if (g.legs.otpts) add('tpts', 0.5, g.legs.otpts.h);
  }
  const out = {};
  for (const [k, a] of Object.entries(acc)) out[k] = { n: a.p.length, said: r4(a.p.reduce((x, y) => x + y, 0) / a.p.length), happened: r4(a.h.reduce((x, y) => x + y, 0) / a.h.length), shift: r4(shiftFor(a.p, a.h)) };
  out.win = { shift: 0, note: 'the closing moneyline\'s own chance, unshifted' };
  out.otpts = out.tpts;
  return out;
}
/* thresholds: t = normInv(1 - p) + the kind's shift; a game's legs from the home side, a player's team legs from his */
function thresholds(games, sh) {
  const tk = (k, p) => normInv(1 - p) + ((sh[k] && sh[k].shift) || 0);
  for (const g of games.values()) {
    for (const rows of Object.values(g.sides)) for (const r of rows) { r.t = new Float64Array(PLAYER.length).fill(NaN); PLAYER.forEach((k, j) => { if (r.h[j] >= 0) r.t[j] = tk(k, r.p[j]); }); }
    g.L = {};
    for (const k of TEAM) if (g.legs[k]) g.L[k] = { t: tk(k, g.legs[k].p), h: g.legs[k].h };
  }
}
/* a player's team legs seen from his club: the away side's win and cover are the home side's turned over (an NBA game
   has no tie, a push is left out), tpts and otpts his club's and the other's points */
function ownLegs(g, team, home) {
  const own = {}, L0 = g.L;
  const flip = x => x && { t: -x.t, h: 1 - x.h };
  if (team === home) { own.win = L0.win; own.cover = L0.cover; own.tpts = L0.tpts; own.otpts = L0.otpts; }
  else { own.win = flip(L0.win); own.cover = flip(L0.cover); own.tpts = L0.otpts; own.otpts = L0.tpts; }
  own.over = L0.over;
  return own;
}
const homeOf = gid => gid.split('_')[3];
/* every key has a number, so the pairs below are counted without building a string each */
const KEYS = (() => {
  const k = [];
  for (let i = 0; i < PLAYER.length; i++) for (let j = i + 1; j < PLAYER.length; j++) k.push(`self|${[PLAYER[i], PLAYER[j]].sort().join('|')}`);
  for (const rel of ['mate', 'opp']) for (let i = 0; i < PLAYER.length; i++) for (let j = i; j < PLAYER.length; j++) k.push(`${rel}|${[PLAYER[i], PLAYER[j]].sort().join('|')}`);
  for (const p of PLAYER) for (const t of TEAM) k.push(`team|${p}|${t}`);
  return k.concat(GAME_KEYS).sort();
})();
/* the table's keys: every relation the builder can join (a player's legs with his own club's points are measured for the
   report, no team-total leg is offered) */
const TABLE_KEYS = KEYS.filter(k => !/\|(tpts|otpts)$/.test(k));
/* a player's two legs that share a part: a stat and a combo holding it, two combos with a part in common, a double-
   and a triple-double (one is inside the other) */
const PARTS = { pts: ['pts'], reb: ['reb'], ast: ['ast'], tpm: ['tpm'], stl: ['stl'], blk: ['blk'], pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
function overlaps() {
  const out = [];
  for (let i = 0; i < MAIN.length; i++) for (let j = i + 1; j < MAIN.length; j++) { const a = MAIN[i], b = MAIN[j]; if (PARTS[a].some(x => PARTS[b].includes(x))) out.push([a, b].sort().join('|')); }
  out.push('dd|td');
  return out.sort();
}
/* the pairs the builder refuses, never priced: one player's two legs that share a part (DraftKings may not take them on
   one ticket, and a stat beside a sum holding it is not jointly gaussian at these lines, so its measured rho does not fit
   with the rest), a double- with a triple-double of one player, a win with a cover of one game (one side bet a game) */
const REFUSED = new Set(overlaps().map(p => 'self|' + p).concat('game|cover|win'));
const KID = new Map(KEYS.map((k, i) => [k, i]));
const NK = PLAYER.length;
const REL_ID = {};
for (const rel of ['self', 'mate', 'opp']) { const a = REL_ID[rel] = new Int32Array(NK * NK).fill(-1); for (let i = 0; i < NK; i++) for (let j = 0; j < NK; j++) { const id = KID.get(`${rel}|${[PLAYER[i], PLAYER[j]].sort().join('|')}`); if (id !== undefined) a[i * NK + j] = id; } }
const TEAM_ID = new Int32Array(NK * TEAM.length); PLAYER.forEach((p, i) => TEAM.forEach((t, j) => { TEAM_ID[i * TEAM.length + j] = KID.get(`team|${p}|${t}`); }));
const GAME_ID = GAME_KEYS.map(k => KID.get(k));
const REL_OF = KEYS.map(k => k.split('|')[0]);
/* every pair of legs in one game: cb(keyId, t1, h1, t2, h2) with the first leg the key's first kind */
function eachPair(g, cb, opts = {}) {
  const home = homeOf(g.game), teams = Object.keys(g.sides);
  const kinds = opts.kinds || PLAYER.map((_, j) => j);
  const S = REL_ID.self;
  for (const team of teams) {
    const rows = g.sides[team];
    const own = ownLegs(g, team, home);
    for (const r of rows) {
      for (let x = 0; x < kinds.length; x++) { const a = kinds[x]; if (r.h[a] < 0) continue;
        for (let y = x + 1; y < kinds.length; y++) { const b = kinds[y]; if (r.h[b] < 0) continue;
          if (PLAYER[a] < PLAYER[b]) cb(S[a * NK + b], r.t[a], r.h[a], r.t[b], r.h[b]); else cb(S[a * NK + b], r.t[b], r.h[b], r.t[a], r.h[a]); }
        if (!opts.noTeam) for (let k = 0; k < TEAM.length; k++) { const l = own[TEAM[k]]; if (l) cb(TEAM_ID[a * TEAM.length + k], r.t[a], r.h[a], l.t, l.h); }
      }
    }
    for (let u = 0; u < rows.length; u++) for (let v = u + 1; v < rows.length; v++) pairRows(rows[u], rows[v], REL_ID.mate, kinds, cb);
  }
  if (teams.length === 2) for (const ra of g.sides[teams[0]]) for (const rb of g.sides[teams[1]]) pairRows(ra, rb, REL_ID.opp, kinds, cb);
  if (!opts.noTeam) GAME_KEYS.forEach((key, i) => { const [, k1, k2] = key.split('|'); if (g.L[k1] && g.L[k2]) cb(GAME_ID[i], g.L[k1].t, g.L[k1].h, g.L[k2].t, g.L[k2].h); });
}
function pairRows(ra, rb, ids, kinds, cb) {
  for (const a of kinds) { if (ra.h[a] < 0) continue;
    for (const b of kinds) { if (rb.h[b] < 0) continue;
      if (PLAYER[a] <= PLAYER[b]) cb(ids[a * NK + b], ra.t[a], ra.h[a], rb.t[b], rb.h[b]);
      else cb(ids[a * NK + b], rb.t[b], rb.h[b], ra.t[a], ra.h[a]); } }
}

/* ---------- the fit: rho by maximum likelihood, the thresholds binned ---------- */
function accumulate(games, opts) {
  const acc = KEYS.map(() => null);
  for (const g of games.values()) {
    const gi = g.group;
    eachPair(g, (id, t1, h1, t2, h2) => {
      let a = acc[id]; if (!a) acc[id] = a = new Map();
      const b1 = Math.max(-120, Math.min(120, Math.round(t1 / BIN))), b2 = Math.max(-120, Math.min(120, Math.round(t2 / BIN)));
      const bk = (b1 + 200) * 1000 + (b2 + 200);
      let c = a.get(bk); if (!c) a.set(bk, c = new Float64Array(G * 4));
      c[gi * 4 + h1 * 2 + h2]++;
    }, opts);
  }
  return acc;
}
/* the bins of one key as arrays, with each group's counts and the whole's */
function binsOf(m) {
  const out = [];
  for (const [bk, c] of m) {
    const a = (Math.floor(bk / 1000) - 200) * BIN, b = (bk % 1000 - 200) * BIN;
    const tot = new Float64Array(4); for (let g = 0; g < G; g++) for (let j = 0; j < 4; j++) tot[j] += c[g * 4 + j];
    out.push({ a, b, pa: normCdf(-a), pb: normCdf(-b), c, tot });
  }
  return out;
}
/* the score (d log-likelihood / d rho) without group `drop` (-1: none), and the likelihood's curvature for the error */
function score(bins, rho, drop) {
  let s = 0;
  for (const B of bins) {
    const t = B.tot, c = B.c, o = drop * 4;
    const n0 = drop < 0 ? t[0] : t[0] - c[o], n1 = drop < 0 ? t[1] : t[1] - c[o + 1], n2 = drop < 0 ? t[2] : t[2] - c[o + 2], n3 = drop < 0 ? t[3] : t[3] - c[o + 3];
    const p11 = Math.max(bvnUpper(B.a, B.b, rho), 1e-12), p10 = Math.max(B.pa - p11, 1e-12), p01 = Math.max(B.pb - p11, 1e-12), p00 = Math.max(1 - B.pa - B.pb + p11, 1e-12);
    s += bvnDensity(B.a, B.b, rho) * (n3 / p11 - n2 / p10 - n1 / p01 + n0 / p00);
  }
  return s;
}
function loglik(bins, rho, drop) {
  let l = 0;
  for (const B of bins) {
    const t = B.tot, c = B.c, o = drop * 4;
    const n0 = drop < 0 ? t[0] : t[0] - c[o], n1 = drop < 0 ? t[1] : t[1] - c[o + 1], n2 = drop < 0 ? t[2] : t[2] - c[o + 2], n3 = drop < 0 ? t[3] : t[3] - c[o + 3];
    const p11 = Math.max(bvnUpper(B.a, B.b, rho), 1e-300), p10 = Math.max(B.pa - p11, 1e-300), p01 = Math.max(B.pb - p11, 1e-300), p00 = Math.max(1 - B.pa - B.pb + p11, 1e-300);
    l += n3 * Math.log(p11) + n2 * Math.log(p10) + n1 * Math.log(p01) + n0 * Math.log(p00);
  }
  return l;
}
function golden(f, lo, hi, it = 32) {
  const g = (Math.sqrt(5) - 1) / 2; let x1 = hi - g * (hi - lo), x2 = lo + g * (hi - lo), f1 = f(x1), f2 = f(x2);
  for (let i = 0; i < it; i++) { if (f1 >= f2) { hi = x2; x2 = x1; f2 = f1; x1 = hi - g * (hi - lo); f1 = f(x1); } else { lo = x1; x1 = x2; f1 = f2; x2 = lo + g * (hi - lo); f2 = f(x2); } }
  return (lo + hi) / 2;
}
/* the maximum likelihood rho in [-0.98, 0.98]: from near a known value (a leave-one-out, from the whole's), the score's
   root in a narrow bracket; otherwise the log-likelihood on a grid and a golden section around its best point (the score
   alone vanishes far out in the tails, where two rare legs at rho near -1 have no density left) */
const EDGE = 0.97;
function solve(bins, drop = -1, near = null) {
  if (near != null) {
    let lo = Math.max(-0.98, near - 0.05), hi = Math.min(0.98, near + 0.05), slo = score(bins, lo, drop), shi = score(bins, hi, drop);
    if (slo > 0 && shi < 0) {
      let side = 0, x = near;
      for (let it = 0; it < 60; it++) {           // regula falsi, the Illinois variant
        x = (lo * shi - hi * slo) / (shi - slo);
        const sx = score(bins, x, drop);
        if (Math.abs(sx) < 1e-9 || hi - lo < 1e-7) break;
        if (sx > 0) { lo = x; slo = sx; if (side === 1) shi /= 2; side = 1; } else { hi = x; shi = sx; if (side === -1) slo /= 2; side = -1; }
      }
      return x;
    }
  }
  const grid = []; for (let i = -19; i <= 19; i++) grid.push(i * 0.05);
  let bi = 0, best = -Infinity; grid.forEach((x, i) => { const l = loglik(bins, x, drop); if (l > best) { best = l; bi = i; } });
  const lo = bi === 0 ? -0.98 : grid[bi - 1], hi = bi === grid.length - 1 ? 0.98 : grid[bi + 1];
  return golden(x => loglik(bins, x, drop), lo, hi);
}
function fitKey(m) {
  const bins = binsOf(m);
  const cells = [0, 0, 0, 0]; for (const B of bins) for (let j = 0; j < 4; j++) cells[j] += B.tot[j];
  const n = cells.reduce((a, b) => a + b, 0);
  const rho = solve(bins);
  /* the expected count of each outcome at rho = 0: a pair that rarely both hit (two triple-doubles) is thin */
  const exp = [0, 0, 0, 0]; for (const B of bins) { const m0 = B.tot[0] + B.tot[1] + B.tot[2] + B.tot[3]; exp[3] += m0 * B.pa * B.pb; exp[2] += m0 * B.pa * (1 - B.pb); exp[1] += m0 * (1 - B.pa) * B.pb; exp[0] += m0 * (1 - B.pa) * (1 - B.pb); }
  const loo = []; for (let g = 0; g < G; g++) loo.push(solve(bins, g, rho));
  const mean = loo.reduce((a, b) => a + b, 0) / G;
  const se = Math.sqrt((G - 1) / G * loo.reduce((s, x) => s + (x - mean) ** 2, 0));
  /* the iid error from the curvature, for the design effect the jackknife's grouping shows */
  const d = 1e-4, info = -(score(bins, rho + d, -1) - score(bins, rho - d, -1)) / (2 * d);
  return { n, cells, expMin: Math.min(...exp), rho, edge: Math.abs(rho) >= EDGE, se, seIid: info > 0 ? 1 / Math.sqrt(info) : null };
}
function fitTable(acc, log) {
  const fits = {};
  let done = 0;
  const ids = KEYS.map((_, i) => i).filter(i => acc[i]);
  for (const i of ids) { fits[KEYS[i]] = fitKey(acc[i]); if (++done % 50 === 0) log(`  ${done} of ${ids.length} pairs fitted`); }
  const keys = Object.keys(fits).sort();
  /* empirical Bayes: each relation's spread of true values (a player's legs with his team's result and the game's own
     legs pooled), and every rho shrunk toward 0 by tau^2 / (tau^2 + se^2); a refused pair keeps what was measured */
  const fam = k => { const r = k.split('|')[0]; return r === 'game' ? 'team' : r; };
  const tau2 = {};
  for (const rel of ['self', 'mate', 'opp', 'team']) {
    const fs_ = keys.filter(k => fam(k) === rel && fits[k].n >= MIN_N && !fits[k].edge && !REFUSED.has(k));
    if (!fs_.length) continue;
    const m2 = fs_.reduce((s, k) => s + fits[k].rho ** 2, 0) / fs_.length, e2 = fs_.reduce((s, k) => s + fits[k].se ** 2, 0) / fs_.length;
    tau2[rel] = Math.max(m2 - e2, 1e-4);
  }
  for (const k of keys) {
    const f = fits[k], t2 = tau2[fam(k)] || 1e-4;
    f.refused = REFUSED.has(k);
    f.shrink = t2 / (t2 + f.se ** 2);
    /* thin: too few, too rare, or peaking at the edge, where a gaussian copula cannot say */
    f.thin = !f.refused && (f.n < MIN_N || f.expMin < MIN_CELL || f.edge);
    f.used = f.refused ? f.rho : f.thin ? 0 : f.rho * f.shrink;
  }
  return { fits, tau2 };
}

/* ---------- positive definite in use: the nearest table that is, each value held by its precision ----------
   Pairwise rhos measured on different sets of rows (a triple-double's on the few who can get one) need not fit together,
   and a stat beside a sum that holds it is not jointly gaussian at these lines (steals, blocks and steals + blocks), so
   the measured table is not positive definite as it stands. Every leg one game can carry is PSD_PLAYERS (13) players a
   side, every kind each, and the game's win, cover and total; the players of a side are interchangeable in the table,
   so that matrix is positive definite exactly when two small ones are: S - M (a side's players against each other, 13 x
   13) and the side sums with the game legs (29 x 29: S + 12 M a side, 13 O across, sqrt(13) T to the game legs). The
   table is moved to the nearest that makes both positive definite (least eigenvalue `eps`), each value held to what was
   measured by 1 / se^2 (a refused pair, never priced, is free; a thin one held to 0 loosely), by alternating that
   weighted pull with the projection onto the positive definite blocks, the pull's weight on the projection raised until
   the two agree; then projected once more and scaled to a unit diagonal, which keeps it positive definite. Every value's
   move is in the report. */
const NG = OFFERED.length, SGN_AWAY = OFFERED.map(k => k === 'over' ? 1 : -1);
const sq = n => Array.from({ length: n }, () => new Float64Array(n));
function jacobiEig(A0) {
  const n = A0.length, A = A0.map(r => Float64Array.from(r)), V = sq(n); for (let i = 0; i < n; i++) V[i][i] = 1;
  for (let sw = 0; sw < 80; sw++) {
    let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
    if (off < 1e-24) break;
    for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
      if (Math.abs(A[p][q]) < 1e-300) continue;
      const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
      for (let k = 0; k < n; k++) { const x = A[k][p], y = A[k][q]; A[k][p] = c * x - s * y; A[k][q] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = A[p][k], y = A[q][k]; A[p][k] = c * x - s * y; A[q][k] = s * x + c * y; }
      for (let k = 0; k < n; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
    }
  }
  return { w: A.map((r, i) => r[i]), V };
}
function projPD(A, eps) {
  const { w, V } = jacobiEig(A), n = A.length, out = sq(n);
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { let s = 0; for (let k = 0; k < n; k++) s += V[i][k] * Math.max(w[k], eps) * V[j][k]; out[i][j] = s; }
  return { M: out, min: Math.min(...w) };
}
/* the table as its blocks: S (one player), M (teammates), O (opponents), T (a player with his club's win, cover and the
   total), Gm (the game's own legs, the home side's) */
const KI = PLAYER.map((_, i) => i);
const kSelf = (i, j) => `self|${[PLAYER[i], PLAYER[j]].sort().join('|')}`, kRel = (r, i, j) => `${r}|${[PLAYER[i], PLAYER[j]].sort().join('|')}`;
const kTeam = (i, g) => `team|${PLAYER[i]}|${OFFERED[g]}`, kGame = (a, b) => `game|${[OFFERED[a], OFFERED[b]].sort().join('|')}`;
function toBlocks(get) {
  const N = PLAYER.length, S = sq(N), M = sq(N), O = sq(N), T = KI.map(() => new Float64Array(NG)), Gm = sq(NG);
  for (const i of KI) for (const j of KI) { S[i][j] = i === j ? 1 : get(kSelf(i, j)); M[i][j] = get(kRel('mate', i, j)); O[i][j] = get(kRel('opp', i, j)); }
  for (const i of KI) for (let g = 0; g < NG; g++) T[i][g] = get(kTeam(i, g));
  for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) Gm[a][b] = a === b ? 1 : get(kGame(a, b));
  return { S, M, O, T, Gm };
}
function fromBlocks(X) {
  const out = {};
  for (const i of KI) for (const j of KI) { if (i < j) out[kSelf(i, j)] = X.S[i][j]; if (i <= j) { out[kRel('mate', i, j)] = X.M[i][j]; out[kRel('opp', i, j)] = X.O[i][j]; } }
  for (const i of KI) for (let g = 0; g < NG; g++) out[kTeam(i, g)] = X.T[i][g];
  for (let a = 0; a < NG; a++) for (let b = a + 1; b < NG; b++) out[kGame(a, b)] = X.Gm[a][b];
  return out;
}
/* the two blocks whose positive definiteness is the whole game's, at P players a side */
function modeBlocks(X, P = PSD_PLAYERS) {
  const N = PLAYER.length, A = sq(N), B = sq(2 * N + NG), r = Math.sqrt(P);
  for (const i of KI) for (const j of KI) { A[i][j] = X.S[i][j] - X.M[i][j]; const d = X.S[i][j] + (P - 1) * X.M[i][j]; B[i][j] = d; B[N + i][N + j] = d; B[i][N + j] = P * X.O[i][j]; B[N + j][i] = P * X.O[i][j]; }
  for (const i of KI) for (let g = 0; g < NG; g++) { const h = r * X.T[i][g], w = h * SGN_AWAY[g]; B[i][2 * N + g] = B[2 * N + g][i] = h; B[N + i][2 * N + g] = B[2 * N + g][N + i] = w; }
  for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) B[2 * N + a][2 * N + b] = X.Gm[a][b];
  return { A, B };
}
function projBlocks(X, eps, P = PSD_PLAYERS) {
  const N = PLAYER.length, { A, B } = modeBlocks(X, P), pa = projPD(A, eps), pb = projPD(B, eps), A2 = pa.M, B2 = pb.M, r = Math.sqrt(P);
  const Y = { S: sq(N), M: sq(N), O: sq(N), T: KI.map(() => new Float64Array(NG)), Gm: sq(NG) };
  for (const i of KI) for (const j of KI) {
    const D = (B2[i][j] + B2[j][i] + B2[N + i][N + j] + B2[N + j][N + i]) / 4, a = (A2[i][j] + A2[j][i]) / 2, m = (D - a) / P;
    Y.M[i][j] = m; Y.S[i][j] = a + m;
    Y.O[i][j] = (B2[i][N + j] + B2[N + j][i] + B2[j][N + i] + B2[N + i][j]) / (4 * P);
  }
  for (const i of KI) for (let g = 0; g < NG; g++) Y.T[i][g] = (B2[i][2 * N + g] + SGN_AWAY[g] * B2[N + i][2 * N + g]) / (2 * r);
  for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) Y.Gm[a][b] = (B2[2 * N + a][2 * N + b] + B2[2 * N + b][2 * N + a]) / 2;
  return { Y, min: Math.min(pa.min, pb.min) };
}
function repair(fits, eps) {
  const target = {}, weight = {};
  for (const k of TABLE_KEYS) {
    const f = fits[k];
    if (!f) { target[k] = 0; weight[k] = 1 / 0.05 ** 2; continue; }
    target[k] = Math.max(-0.95, Math.min(0.95, f.used));
    weight[k] = f.refused ? 0 : f.thin ? 1 / Math.max(f.se, 0.05) ** 2 : 1 / Math.max(f.se, 0.003) ** 2;
  }
  let X = toBlocks(k => target[k]);
  const before = Math.min(...Object.values(modeBlocks(X)).map(m => Math.min(...jacobiEig(m).w)));
  for (let e = 0; e <= 10; e++) {
    const mu = Math.pow(10, e);
    for (let it = 0; it < 30; it++) {
      const Z = fromBlocks(projBlocks(X, eps).Y), next = {};
      for (const k of TABLE_KEYS) next[k] = (weight[k] * target[k] + mu * Z[k]) / (weight[k] + mu);
      X = toBlocks(k => next[k]);
    }
  }
  /* once more onto the positive definite blocks, then a unit diagonal: d_k the variance each kind's leg came out with */
  const { Y } = projBlocks(X, eps);
  const d = KI.map(i => Y.S[i][i]), dg = OFFERED.map((_, g) => Y.Gm[g][g]);
  for (const i of KI) for (const j of KI) { const s = Math.sqrt(d[i] * d[j]); Y.S[i][j] /= s; Y.M[i][j] /= s; Y.O[i][j] /= s; }
  for (const i of KI) for (let g = 0; g < NG; g++) Y.T[i][g] /= Math.sqrt(d[i] * dg[g]);
  for (let a = 0; a < NG; a++) for (let b = 0; b < NG; b++) Y.Gm[a][b] /= Math.sqrt(dg[a] * dg[b]);
  return { table: fromBlocks(Y), before, target };
}
/* the shipped values, to three decimals, positive definite as written: the least eigenvalue of both blocks, and a
   Cholesky factor of the whole game's matrix (gameMatrix, built from the table by rhoFor) */
function finalTable(fits, log) {
  for (const eps of [0.01, 0.02, 0.04, 0.08]) {
    const { table, before, target } = repair(fits, eps);
    const T = {}; for (const k of TABLE_KEYS) T[k] = r3(table[k]) + 0;
    const X = toBlocks(k => T[k]), mb = modeBlocks(X), least = Math.min(...[mb.A, mb.B].map(m => Math.min(...jacobiEig(m).w)));
    const ok = least > 0 && !!cholesky(gameMatrix(T));
    log(`  positive definite: least eigenvalue ${before.toFixed(3)} as measured, ${least.toFixed(4)} after the repair (eps ${eps})${ok ? '' : ': not yet'}`);
    if (ok) return { T, before, least, eps, target };
  }
  throw new Error('no positive definite table: nothing written');
}

/* ---------- positive semidefinite in use ---------- */
/* the correlation matrix of every leg one game can carry: PSD_PLAYERS a side, every player kind each, and the home
   side's win and cover and the total; a Cholesky factor exists exactly when it is positive definite */
function gameMatrix(T, n = PSD_PLAYERS, game = OFFERED) {
  const legs = [];
  for (const team of ['H', 'A']) for (let i = 0; i < n; i++) for (const kind of PLAYER) legs.push({ game: 'x', kind, player: team + i, team, side: kind === 'dd' || kind === 'td' ? 'yes' : 'over', home: 'H' });
  for (const kind of game) legs.push({ game: 'x', kind, team: 'H', side: 'over', home: 'H' });
  return legs.map((a, i) => legs.map((b, j) => i === j ? 1 : rhoFor(T, a, b)));
}
function cholesky(A) {
  const n = A.length, Lm = A.map(() => new Float64Array(n));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
    let s = A[i][j]; for (let k = 0; k < j; k++) s -= Lm[i][k] * Lm[j][k];
    if (i === j) { if (s <= 1e-10) return null; Lm[i][i] = Math.sqrt(s); } else Lm[i][j] = s / Lm[j][j];
  }
  return Lm;
}

/* ---------- the validation: real pairs on held-out games ---------- */
const BUCKETS = [0, 0.7, 0.9, 0.98, 1.02, 1.1, 1.3, 1.6, Infinity];
const RELS = ['self', 'mate', 'opp', 'team', 'game'];
const blank = () => ({ n: 0, cop: 0, ind: 0, hit: 0, llCop: 0, llInd: 0, up: { n: 0, cop: 0, ind: 0, hit: 0 }, down: { n: 0, cop: 0, ind: 0, hit: 0 } });
function newVal() { return { fam: Object.fromEntries(RELS.map(r => [r, blank()])), buckets: BUCKETS.slice(0, -1).map((lo, i) => ({ lift: [lo, BUCKETS[i + 1]], n: 0, cop: 0, ind: 0, hit: 0 })), games: [], n: 0 }; }
/* one game's sums of the log-loss difference, per relation and in all, for the bootstrap over games */
const gameAcc = () => Object.fromEntries(RELS.concat('all').map(r => [r, [0, 0]]));
function addCombo(V, G0, fam, pc, pi, y) {
  const F = V.fam[fam];
  const lc = -(y ? Math.log(Math.max(pc, 1e-9)) : Math.log(Math.max(1 - pc, 1e-9))), li = -(y ? Math.log(Math.max(pi, 1e-9)) : Math.log(Math.max(1 - pi, 1e-9)));
  F.n++; F.cop += pc; F.ind += pi; F.hit += y; F.llCop += lc; F.llInd += li;
  const lift = pi > 0 ? pc / pi : 1;
  const side = lift > 1.02 ? F.up : lift < 0.98 ? F.down : null;
  if (side) { side.n++; side.cop += pc; side.ind += pi; side.hit += y; }
  let bi = 0; while (lift >= BUCKETS[bi + 1]) bi++;
  const B = V.buckets[bi]; B.n++; B.cop += pc; B.ind += pi; B.hit += y;
  G0[fam][0] += lc - li; G0[fam][1]++; G0.all[0] += lc - li; G0.all[1]++;
  V.n++;
}
/* every side of one pair the builder could join (a Yes-only market has no No side); the copula's four outcomes from
   one bivariate value and the two margins */
function addPair(V, G0, fam, ta, ha, tb, hb, rho, yesA, yesB) {
  const pa = normCdf(-ta), pb = normCdf(-tb);
  const p11 = bvnUpper(ta, tb, rho);
  addCombo(V, G0, fam, p11, pa * pb, +(ha === 1 && hb === 1));
  if (!yesB) addCombo(V, G0, fam, pa - p11, pa * (1 - pb), +(ha === 1 && hb === 0));
  if (!yesA) addCombo(V, G0, fam, pb - p11, (1 - pa) * pb, +(ha === 0 && hb === 1));
  if (!yesA && !yesB) addCombo(V, G0, fam, 1 - pa - pb + p11, (1 - pa) * (1 - pb), +(ha === 0 && hb === 0));
}
function summarizeVal(V) {
  const r = x => r4(x);
  const side = s => s.n ? { combos: s.n, happened: r(s.hit / s.n), copula: r(s.cop / s.n), independence: r(s.ind / s.n) } : null;
  const fam = {};
  for (const [k, F] of Object.entries(V.fam)) {
    if (!F.n) continue;
    fam[k] = { combos: F.n, happened: r(F.hit / F.n), copula: r(F.cop / F.n), independence: r(F.ind / F.n),
      logloss: { copula: r(F.llCop / F.n), independence: r(F.llInd / F.n), diff: r((F.llCop - F.llInd) / F.n), diffCi90: PM.bootCI(V.games.map(g => g[k]).filter(v => v[1])) },
      copulaSaysMore: side(F.up), copulaSaysLess: side(F.down) };
  }
  const sum = (f) => Object.values(V.fam).reduce((a, F) => { const s = f(F); return { n: a.n + s.n, cop: a.cop + s.cop, ind: a.ind + s.ind, hit: a.hit + s.hit }; }, { n: 0, cop: 0, ind: 0, hit: 0 });
  const tot = Object.values(V.fam).reduce((a, F) => ({ n: a.n + F.n, llc: a.llc + F.llCop, lli: a.lli + F.llInd }), { n: 0, llc: 0, lli: 0 });
  return { combos: V.n, games: V.games.length,
    logloss: { copula: r(tot.llc / tot.n), independence: r(tot.lli / tot.n), diff: r((tot.llc - tot.lli) / tot.n), diffCi90: PM.bootCI(V.games.map(g => g.all).filter(v => v[1])) },
    copulaSaysMore: side(sum(F => F.up)), copulaSaysLess: side(sum(F => F.down)),
    byLift: V.buckets.filter(b => b.n).map(b => ({ lift: [b.lift[0], b.lift[1] === Infinity ? null : b.lift[1]], combos: b.n, happened: r(b.hit / b.n), copula: r(b.cop / b.n), independence: r(b.ind / b.n), liftSaid: r(b.cop / b.ind), liftHappened: r(b.hit / b.ind) })),
    byRelation: fam };
}
/* (1) model-set lines on the held-out season: every pair the builder could join, at the development table's rho */
function validateModel(games, T, opts = {}) {
  const V = newVal();
  const rhoById = KEYS.map(k => T[k] || 0), skip = KEYS.map(k => REFUSED.has(k) || !TABLE_KEYS.includes(k));
  const yes = KEYS.map(k => { const [, k1, k2] = k.split('|'); return [opts.yesOnly || k1 === 'dd' || k1 === 'td', opts.yesOnly || k2 === 'dd' || k2 === 'td']; });
  for (const g of games.values()) {
    const G0 = gameAcc();
    eachPair(g, (id, t1, h1, t2, h2) => { if (skip[id]) return; addPair(V, G0, REL_OF[id], t1, h1, t2, h2, rhoById[id], yes[id][0], yes[id][1]); }, opts);
    V.games.push(G0);
  }
  return summarizeVal(V);
}
/* (2) DraftKings' closing main lines of the held-out playoffs, at their fair chances (the whole margin on the Over), and
   the closing game lines: the moneyline's own chance, the spread and the total at even (their prices are not kept) */
function validateDK(boxes, odds, T, season) {
  const F = require('./props_feed');
  const rec = require('./props_record').readRecord(season);
  const V = newVal();
  const byGame = new Map(), played = new Map();
  for (const [gid, sides] of Object.entries(boxes)) for (const [team, rows] of Object.entries(sides)) for (const r of rows) if (r.min > 0 && !r.dnp) played.set(gid + '|' + r.id, { team, y: r.y });
  let voids = 0, pushes = 0;
  for (const l of rec) {
    const pl = played.get(l.game_id + '|' + l.player_id); if (!pl) { voids++; continue; }      // void, as DraftKings voids it
    const y = PM.yOf(pl.y, l.stat); if (y === l.line) { pushes++; continue; }
    const pf = F.propFairOver(l.over, l.under); if (!(pf > 0 && pf < 1)) continue;
    const g = byGame.get(l.game_id) || []; g.push({ player: l.player_id, team: pl.team, kind: l.stat, t: normInv(1 - pf), h: y > l.line ? 1 : 0 }); byGame.set(l.game_id, g);
  }
  let lines = 0;
  for (const [gid, legs] of byGame) {
    lines += legs.length;
    const home = homeOf(gid), G0 = gameAcc();
    for (let i = 0; i < legs.length; i++) for (let j = i + 1; j < legs.length; j++) {
      const [x, z] = legs[i].kind <= legs[j].kind ? [legs[i], legs[j]] : [legs[j], legs[i]];
      const rel = x.player === z.player ? 'self' : x.team === z.team ? 'mate' : 'opp';
      if (rel === 'self' && (x.kind === z.kind || REFUSED.has(`self|${x.kind}|${z.kind}`))) continue;
      addPair(V, G0, rel, x.t, x.h, z.t, z.h, T[`${rel}|${x.kind}|${z.kind}`] || 0, false, false);
    }
    const GL0 = gameLegs(gid, odds), gl = {};
    if (GL0.win) gl.win = { t: normInv(1 - GL0.win.p), h: GL0.win.h };
    if (GL0.cover) gl.cover = { t: 0, h: GL0.cover.h };
    if (GL0.over) gl.over = { t: 0, h: GL0.over.h };
    for (const a of legs) for (const k of OFFERED) {
      let l = gl[k]; if (!l) continue;
      if (k !== 'over' && a.team !== home) l = { t: -l.t, h: 1 - l.h };
      addPair(V, G0, 'team', a.t, a.h, l.t, l.h, T[`team|${a.kind}|${k}`] || 0, false, false);
    }
    for (const key of GAME_KEYS) { if (REFUSED.has(key)) continue; const [, k1, k2] = key.split('|'); if (gl[k1] && gl[k2]) addPair(V, G0, 'game', gl[k1].t, gl[k1].h, gl[k2].t, gl[k2].h, T[key] || 0, false, false); }
    V.games.push(G0);
  }
  return { lines, voids, pushes, ...summarizeVal(V) };
}

/* ---------- the run ---------- */
function loadOdds(games) {
  const lines = fs.readFileSync(path.join(L.ROOT, 'data', 'odds_hist.csv'), 'utf8').trim().split('\n');
  const head = lines.shift().split(',');
  const byId = new Map(games.map(g => [g.game_id, g]));
  const out = new Map();
  for (const l of lines) { const v = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = v[i] === undefined ? '' : v[i]; });
    const g = byId.get(o.game_id); if (!g) continue;
    o.final = g.status === 'final'; o.hs = +g.home_score; o.as = +g.away_score; out.set(o.game_id, o); }
  return out;
}
function measure(R, P, seasons, odds, log) {
  const sel = r => seasons.includes(r.season);
  const games = legRows(R, P, sel, 0.5, odds);
  const sh = shifts(games); thresholds(games, sh);
  log(`  ${games.size} games, ${[...games.values()].reduce((n, g) => n + Object.values(g.sides).reduce((a, s) => a + s.length, 0), 0)} player-games projected ${MIN_PROJ}+ minutes`);
  const acc = accumulate(games);
  const { fits, tau2 } = fitTable(acc, log);
  return { games, shifts: sh, fits, tau2 };
}
/* worked same-game prices at the shipped table's rho, for the builder's tests: two legs of one game at their DraftKings
   prices, the fair joint (each leg's fair chance: the whole margin on the Over), the implied joint, the plain product of
   the prices and the hold's price */
function holdExamples(T) {
  const imp = am => am > 0 ? 100 / (am + 100) : -am / (-am + 100), decOf = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;
  const cases = [
    { name: 'one player\'s points Over and rebounds Over, both -110 / -110', key: 'self|pts|reb', sign: 1, a: [-110, -110], b: [-110, -110] },
    { name: 'one player\'s points Over -110 / -110 and his club\'s win at -150 / +130', key: 'team|pts|win', sign: 1, a: [-110, -110], b: [-150, 130] },
    { name: 'two teammates\' points Overs, both -110 / -110', key: 'mate|pts|pts', sign: 1, a: [-110, -110], b: [-110, -110] },
    { name: 'one player\'s points Over and rebounds Under, both -110 / -110', key: 'self|pts|reb', sign: -1, a: [-110, -110], b: [-110, -110] },
  ];
  return cases.map(c => {
    const rho = c.sign * T[c.key];
    const fa = 1 - imp(c.a[1]), fb = c.key.endsWith('win') ? imp(c.b[0]) / (imp(c.b[0]) + imp(c.b[1])) : c.sign > 0 ? 1 - imp(c.b[1]) : imp(c.b[1]);
    const ia = imp(c.a[0]), ib = c.sign > 0 || c.key.endsWith('win') ? imp(c.b[0]) : imp(c.b[1]);
    const mult = decOf(c.a[0]) * decOf(c.sign > 0 || c.key.endsWith('win') ? c.b[0] : c.b[1]);
    const fair = joint2(fa, fb, rho), J = joint2(ia, ib, rho);
    return { case: c.name, rho: r3(rho), fairJoint: r4(fair), fairProduct: r4(fa * fb), impliedJoint: r4(J), productPrice: r4(mult), holdPrice: r4(Math.min(mult, HOLD / J)) };
  });
}
function main() {
  const log = L.log;
  const t0 = Date.now();
  const games = PM.loadGames(), boxes = PM.loadBoxes();
  /* the season in play: the latest season with a game not final; nothing of it, or after it, is read */
  const all = L.readGames().filter(g => g.type !== 'PRE');
  const inPlay = Math.max(0, ...all.filter(g => g.status !== 'final').map(g => +g.season));
  const done = [...new Set(games.filter(g => g.status === 'final').map(g => g.season))].filter(s => !inPlay || s < inPlay).sort();
  const seasons = done.filter(s => s >= PM.FIRST + 1);
  if (seasons.length < 2) throw new Error('need two finished seasons after the warm-up');
  const test = seasons[seasons.length - 1], dev = seasons.slice(0, -1);
  /* the props model's own constants, each fitted on finished seasons only: research/props.json's fold for the held-out
     season (fitted on the seasons before it) for the development table and its validation, props.json's for the
     shipped table */
  const rs = JSON.parse(fs.readFileSync(PM.RESEARCH, 'utf8'));
  const fold = rs.folds.find(f => f.season === test);
  if (!fold || !fold.params) throw new Error(`research/props.json has no fold for ${test}`);
  const live = JSON.parse(fs.readFileSync(PM.OUT, 'utf8'));
  const liveTo = +String(live.fitSeasons || '').split('-').pop();
  if (!live.params || !(liveTo < inPlay || !inPlay)) throw new Error(`props.json's constants (${live.fitSeasons}) are not fitted on finished seasons only`);
  if (+String(fold.fitOn).split('-').pop() >= test) throw new Error(`the ${test} fold is fitted on ${fold.fitOn}`);
  /* only finished games: the replay never sees the season in play */
  const finished = games.filter(g => g.status === 'final' && (!inPlay || g.season < inPlay));
  const R = PM.replay(finished, boxes, PM.loadTeamBoxes(), { collect: true, from: PM.FIRST + 1 });
  if (R.rows.some(r => inPlay && r.season >= inPlay)) throw new Error('a row of the season in play');
  const odds = loadOdds(games);
  log(`season in play ${inPlay || 'none'}; finished ${seasons.join(', ')}; replay ${R.rows.length} rows in ${((Date.now() - t0) / 1000).toFixed(1)}s`);

  log(`development table: ${dev.join('-')} (constants ${fold.fitOn})`);
  const D = measure(R, fold.params, dev, odds, log);
  const Fdev = finalTable(D.fits, log), Tdev = Fdev.T;
  /* the threshold check: rho at milestone-like lines (the over at about 30%), the main kinds, on the same seasons */
  log('threshold check: rho at lines where the over is about 30%');
  const D3games = legRows(R, fold.params, r => dev.includes(r.season), 0.3, odds);
  const sh3 = shifts(D3games); thresholds(D3games, sh3);
  const acc3 = accumulate(D3games, { kinds: MAIN.map(k => PLAYER.indexOf(k)), noTeam: true });
  const thr = {};
  acc3.forEach((m, id) => { if (!m) return; const k = KEYS[id], f = fitKey(m); if (D.fits[k] && !REFUSED.has(k) && f.n >= MIN_N) thr[k] = { main: r3(D.fits[k].rho), at30: r3(f.rho), n30: f.n }; });
  const thrSum = {};
  for (const rel of ['self', 'mate', 'opp']) { const ks = Object.keys(thr).filter(k => k.startsWith(rel + '|')); if (ks.length) thrSum[rel] = { pairs: ks.length, meanAbsDiff: r3(ks.reduce((s, k) => s + Math.abs(thr[k].at30 - thr[k].main), 0) / ks.length), maxAbsDiff: r3(Math.max(...ks.map(k => Math.abs(thr[k].at30 - thr[k].main)))), largest: ks.sort((a, b) => Math.abs(thr[b].at30 - thr[b].main) - Math.abs(thr[a].at30 - thr[a].main)).slice(0, 3) }; }

  log(`validation on ${test}, held out: model-set lines`);
  const Vg = legRows(R, fold.params, r => r.season === test, 0.5, odds);
  thresholds(Vg, D.shifts);                         // the development seasons' shifts: nothing of the test season
  const valModel = { season: test, regular: validateModel(new Map([...Vg].filter(([, g]) => g.type === 'REG')), Tdev), playoffs: validateModel(new Map([...Vg].filter(([, g]) => g.type === 'POST')), Tdev) };
  const Vg3 = legRows(R, fold.params, r => r.season === test, 0.3, odds); thresholds(Vg3, sh3);
  valModel.milestones = validateModel(Vg3, Tdev, { kinds: MAIN.map(k => PLAYER.indexOf(k)), noTeam: true, yesOnly: true });
  log(`validation on ${test}: DraftKings' closing lines`);
  const valDK = validateDK(boxes, odds, Tdev, test);

  log(`shipped table: ${seasons.join('-')} (constants ${live.fitSeasons})`);
  const S = measure(R, live.params, seasons, odds, log);
  const F = finalTable(S.fits, log), T = F.T;
  const M = gameMatrix(T);
  const devDiff = TABLE_KEYS.filter(k => !REFUSED.has(k)).map(k => Math.abs(T[k] - Tdev[k]));
  /* how far the repair moved each value from what was measured and shrunk, in its own error */
  const moves = TABLE_KEYS.filter(k => !REFUSED.has(k) && S.fits[k]).map(k => ({ k, d: T[k] - S.fits[k].used, z: (T[k] - S.fits[k].used) / Math.max(S.fits[k].se, 0.003) }));
  const moveBy = {};
  for (const rel of ['self', 'mate', 'opp', 'team', 'game']) { const ms = moves.filter(m => m.k.startsWith(rel + '|')); if (ms.length) moveBy[rel] = { pairs: ms.length, meanAbs: r3(ms.reduce((s, m) => s + Math.abs(m.d), 0) / ms.length), maxAbs: r3(Math.max(...ms.map(m => Math.abs(m.d)))), largest: ms.sort((a, b) => Math.abs(b.d) - Math.abs(a.d)).slice(0, 4).map(m => `${m.k} ${r3(S.fits[m.k].used)} -> ${T[m.k]} (${r2(m.z)} se)`) }; }

  const meta = { measured: `${seasons[0]}-${seasons[seasons.length - 1]}`, seasonInPlay: inPlay || null, playerGames: [...S.games.values()].reduce((n, g) => n + Object.values(g.sides).reduce((a, s) => a + s.length, 0), 0), games: S.games.size, propsConstants: live.fitSeasons };
  const table = {
    what: 'The same-game correlation table: the gaussian copula\'s rho between the hits of two legs of one game, measured on the hub\'s finished seasons\' box scores by tools/corr.js (README "Same-game parlays"). Written by the script, never by hand.',
    ...meta,
    method: 'each leg a yes/no outcome at the line a book would hang (the half point where the props model gives the over the chance nearest 50%; the closing moneyline, spread and total), its chances calibrated per kind; rho by maximum likelihood of the four outcomes of every pair of legs that shared a game, each pair at its own two thresholds; shrunk toward 0 by its jackknife error (empirical Bayes per relation), 0 where thin; then moved, each value by its precision, to the nearest table that is positive definite over every leg one game can carry',
    kinds: { player: PLAYER, game: OFFERED, milestone: 'a "k+" milestone is its stat\'s kind (the over at k - 0.5); a double- or triple-double is a Yes' },
    lookup: 'key relation|kind|kind: self (one player), mate (teammates), opp (opponents), each with its two kinds in sort order; team|<player kind>|<win, cover or over> (a player with his own club\'s win or cover, or the game\'s total); game|<kind>|<kind> (the home side\'s win and cover, the total). The rho between two legs\' hits is the key\'s, times -1 for each Under, times -1 for a win or cover on the other club than the key\'s (the player\'s own; the home side between two game legs). Legs of different games: 0; one player\'s one kind twice, or one game\'s one kind twice: never joined. tools/corr.js rhoFor is the rule.',
    rho: T,
    refused: { pairs: [...REFUSED].sort(), why: 'never priced, never joined: one player\'s two legs that share a part (a stat and a combo holding it, two combos with a part in common), because DraftKings may not take them on one ticket (it publishes no list, so the builder is conservative) and because a stat beside a sum holding it is not jointly gaussian at these lines (their measured rhos, in research/corr.json, do not fit with the rest); a double- with a triple-double of one player (one is inside the other); a win with a cover of one game (one side bet a game). Their values here are only what keeps the table positive definite' },
    psd: { legs: M.length, playersASide: PSD_PLAYERS, leastEigenvalue: r4(F.least), asMeasured: r4(F.before), note: 'every leg one game can carry (13 players a side, every kind each, the win, the cover and the total): positive definite as written, so every set of legs the builder can join is (a principal submatrix of a positive definite matrix is one)' },
    hold: { value: HOLD, tested: false, appliesTo: 'implied',
      formula: 'a game\'s legs pay min(their decimal prices multiplied, HOLD / J), J the copula\'s joint chance of the legs\' implied chances (each price\'s own 1 / decimal, margin left in) at this table\'s rho; legs of different games multiplied as before',
      basis: 'the NFL hub\'s SGP_HOLD (props/build/part3.js), fitted to two real DraftKings same-game tickets on Detroit at Buffalo, 2026-09-17: the correlated leg prices gave 7.33 and 5.36 where DraftKings offered 6.25 and 5.05, cuts of 0.852 and 0.942, 0.896 their geometric mean',
      untested: 'no DraftKings same-game price is recorded anywhere this hub reads (ESPN\'s feed carries none), so the hold is the NFL\'s, untested on the NBA: the price it gives is an estimate and is shown as one' },
  };
  const keyRow = f => ({ n: f.n, cells: f.cells.map(x => Math.round(x)), rho: r3(f.rho), se: r3(f.se), seIid: f.seIid == null ? null : r3(f.seIid), shrink: r3(f.shrink), thin: f.thin || undefined, refused: f.refused || undefined, edge: f.edge || undefined, shrunk: r3(f.used) + 0 });
  const report = {
    what: 'tools/corr.js: the same-game correlation table\'s measurement (every key\'s observations, its four outcomes [neither, second only, first only, both], rho by maximum likelihood, its jackknife and iid errors, the shrink and the shrunk value, and the value shipped after the positive definite repair), the threshold check and the validation on a season the development table never saw',
    ...meta,
    rules: { minProjectedMinutes: MIN_PROJ, ddFrom: DD_MIN, tdFrom: TD_MIN, bin: BIN, jackknifeGroups: G, thinBelow: { observations: MIN_N, expectedInAnyOutcome: MIN_CELL, edge: EDGE }, psdPlayersASide: PSD_PLAYERS, psdEps: F.eps },
    shipped: { tau: Object.fromEntries(Object.entries(S.tau2).map(([k, v]) => [k, r3(Math.sqrt(v))])), shifts: S.shifts,
      repair: { leastEigenvalueAsMeasured: r4(F.before), after: r4(F.least), moved: moveBy },
      keys: Object.fromEntries(Object.keys(S.fits).sort().map(k => [k, { ...keyRow(S.fits[k]), shipped: T[k] }])) },
    development: { seasons: `${dev[0]}-${dev[dev.length - 1]}`, propsConstants: fold.fitOn, tau: Object.fromEntries(Object.entries(D.tau2).map(([k, v]) => [k, r3(Math.sqrt(v))])), shifts: D.shifts, table: Tdev,
      againstShipped: { meanAbsDiff: r3(devDiff.reduce((a, b) => a + b, 0) / devDiff.length), maxAbsDiff: r3(Math.max(...devDiff)) } },
    thresholdCheck: { what: 'rho at lines where the over is about 30% (a milestone above the main line) beside rho at the main line, development seasons, the main kinds (refused pairs left out)', byRelation: thrSum, keys: thr },
    validation: { what: `the development table (${dev[0]}-${dev[dev.length - 1]}, repaired as shipped) on ${test}, which it never saw: the joint hit rate of every two-leg combination the builder could join (refused pairs left out; a double-, triple-double or milestone is Yes only), as the copula says, as the plain product (independence) says, and as happened; log loss of the combination hitting (lower is better), copula minus independence, its paired 90% interval resampling games; byLift groups the combinations by the copula's joint over the product`,
      modelLines: valModel, draftKings: valDK },
    psd: table.psd, hold: { ...table.hold, examples: holdExamples(T) },
  };
  fs.mkdirSync(path.dirname(OUT), { recursive: true }); fs.mkdirSync(path.dirname(REPORT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(table, null, 1) + '\n');
  fs.writeFileSync(REPORT, JSON.stringify(report, null, 1) + '\n');
  log(`${path.relative(L.ROOT, OUT)} and ${path.relative(L.ROOT, REPORT)} written in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}

module.exports = { PLAYER, MAIN, TEAM, OFFERED, GAME_KEYS, KEYS, TABLE_KEYS, REFUSED, HOLD, PSD_PLAYERS, finalTable, bvnUpper, bvnDensity, joint2, rhoFor, overlaps, gameMatrix, cholesky, toBlocks, modeBlocks, jacobiEig, lineAt, shiftFor, solve, binsOf, loglik };
if (require.main === module) main();
