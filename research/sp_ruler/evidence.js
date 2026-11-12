/* The evidence for one ruler on Suggested Parlays (README "Suggested Parlays", research/sp_ruler/README.md).
 *
 *   node research/sp_ruler/evidence.js --extract   reads lines.json's git history once and writes
 *                                                  research/sp_ruler/dk_game_lines_2027.csv (DraftKings' game lines as
 *                                                  the job read them, the last read before each tip)
 *   node research/sp_ruler/evidence.js             reads only committed files; writes research/sp_ruler/results/evidence.json
 *                                                  and prints the summary. Deterministic: the same files give the same
 *                                                  file, byte for byte (seeded bootstrap, no clock in the output).
 *
 * The question: a Suggested Parlays set's team legs are ranked today at the builder's own chance (legModel in
 * app/nba_hub.html, which spPool takes through pbPriced and pbTotals): a moneyline at the player model's win chance,
 * g.model.pHome, raw; a spread at Phi((m + h) / SIGMA), m the side's expected margin from the player model's spread, h
 * its line, SIGMA 14.5; a total at the market's own chance, its two prices in proportion. None of them is pulled toward
 * the market. Does that chance beat DraftKings' no-vig chance (legFair: a team line's two prices in proportion) on the
 * same games? Scored on the walk-forward folds (research/backtest_games.csv: each season called by parameters fitted
 * on the seasons before it alone, against the closing line, data/odds_hist.csv) and, reported apart and never fitted or
 * tuned on, the season in play (data/predictions.csv's pre-tip calls, frozen at tip, against the job's last read of
 * DraftKings' lines before tip, dk_game_lines_2027.csv, and against data/games.csv's line frozen at tip).
 * Then two checks of the ruler itself, read only: whether a power devig would score better than the proportional rule
 * (reported, never chosen on 2026-27), and how DraftKings' player main lines of 2026-27 (data/props_2027.csv, graded
 * from data/box_2027.csv; data/props_shadow_lines.csv's graded subset beside it) and of the 2026 play-in and playoffs
 * (data/props_2026.csv, box_2026.csv) did against legFair's fair chance (the whole margin on the Over).
 *
 * Nothing here is fitted or chosen. Every interval is a 90% bootstrap over games (a game's legs resampled together),
 * 10,000 resamples, seeded.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const HERE = __dirname;
const DK_CSV = path.join(HERE, 'dk_game_lines_2027.csv');
const OUT = path.join(HERE, 'results', 'evidence.json');
const SIGMA = 14.5;          // app/nba_hub.html SIGMA, the page's spread sigma
const SIGMA_TOTAL = 19.1;    // research/sigma.json sigmaTotal (an aside: the page puts no model chance on a total)
const B = 10000, SEED = 20261112;
const PB_PMIN = 0.45, PB_PMAX = 0.97, PB_FAR = 0.15, PB_EDGE = 0.03;   // the page's band, far-off guard and Value edge

/* ---------- reading ---------- */
function readCsv(f) {
  const t = fs.readFileSync(f, 'utf8').split(/\r?\n/).filter(Boolean), h = t[0].split(',');
  return t.slice(1).map(l => { const v = l.split(','), o = {}; h.forEach((k, i) => { o[k] = v[i] === undefined ? '' : v[i]; }); return o; });
}
const num = x => x === '' || x == null || !Number.isFinite(+x) ? null : +x;
const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100);           // propImplied
const dec = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;                  // amToDec
const prop = (a, b) => imp(a) / (imp(a) + imp(b));                    // legFair's team rule, side a
function power(a, b) {                                                // power devig, side a: ia^k + ib^k = 1
  const ia = imp(a), ib = imp(b); if (ia + ib <= 1) return ia / (ia + ib);
  let lo = 1, up = 8; for (let i = 0; i < 80; i++) { const k = (lo + up) / 2; if (ia ** k + ib ** k > 1) lo = k; else up = k; }
  return ia ** ((lo + up) / 2);
}
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));                     // the page's Phi, the same polynomial
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const ll = (p, y) => -Math.log(clip(y ? p : 1 - p));
const br = (p, y) => (p - y) ** 2;
const r4 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const r6 = x => x == null || !Number.isFinite(x) ? null : Math.round(x * 1e6) / 1e6;

/* ---------- the seeded bootstrap over games ---------- */
function rng(seed) { return () => { seed |= 0; seed = seed + 0x6D2B79F5 | 0; let t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
/* rows: [{ g: game id, d: the value }]; the mean over rows, and its 90% interval with games resampled whole */
function boot(rows, seed) {
  const by = new Map(); for (const r of rows) { const a = by.get(r.g) || [0, 0]; a[0] += r.d; a[1]++; by.set(r.g, a); }
  const G = [...by.values()], n = G.length; if (!n) return null;
  const tot = G.reduce((t, a) => t + a[0], 0), cnt = G.reduce((t, a) => t + a[1], 0), R = rng(seed), m = new Float64Array(B);
  for (let b = 0; b < B; b++) { let s = 0, c = 0; for (let i = 0; i < n; i++) { const a = G[(R() * n) | 0]; s += a[0]; c += a[1]; } m[b] = s / c; }
  m.sort();
  return { mean: r6(tot / cnt), ci90: [r6(m[Math.floor(0.05 * B)]), r6(m[Math.ceil(0.95 * B) - 1])], n: cnt, games: n };
}
let SEEDN = 0; const nextSeed = () => SEED + (++SEEDN) * 7919;

/* ---------- scoring two chances on the same rows ----------
   rows: [{ g, y, a: the chance under test (the model's), b: the market's }] -> each one's log loss and Brier, the
   paired differences a - b with their intervals, and a's and b's mean chance and the outcomes' rate */
function score(rows, la = 'model', lb = 'market') {
  if (!rows.length) return { n: 0 };
  const n = rows.length, mean = f => rows.reduce((t, r) => t + f(r), 0) / n;
  const dLL = boot(rows.map(r => ({ g: r.g, d: ll(r.a, r.y) - ll(r.b, r.y) })), nextSeed());
  const dBr = boot(rows.map(r => ({ g: r.g, d: br(r.a, r.y) - br(r.b, r.y) })), nextSeed());
  return { n, games: new Set(rows.map(r => r.g)).size, rate: r4(mean(r => r.y)), [`mean_${la}`]: r4(mean(r => r.a)), [`mean_${lb}`]: r4(mean(r => r.b)),
    logloss: { [la]: r4(mean(r => ll(r.a, r.y))), [lb]: r4(mean(r => ll(r.b, r.y))), diff: dLL.mean, ci90: dLL.ci90 },
    brier: { [la]: r4(mean(r => br(r.a, r.y))), [lb]: r4(mean(r => br(r.b, r.y))), diff: dBr.mean, ci90: dBr.ci90 } };
}
/* calibration: the rows in bands of the model's chance, each band's mean model, mean market and the rate */
const BANDS = [0, 0.2, 0.35, 0.5, 0.65, 0.8, 1.0001];
function calib(rows) {
  const out = [];
  for (let i = 0; i + 1 < BANDS.length; i++) { const lo = BANDS[i], hi = BANDS[i + 1], s = rows.filter(r => r.a >= lo && r.a < hi); if (!s.length) continue;
    const m = f => r4(s.reduce((t, r) => t + f(r), 0) / s.length);
    out.push({ band: `${Math.round(lo * 100)}-${Math.min(100, Math.round(hi * 100))}%`, n: s.length, model: m(r => r.a), market: m(r => r.b), won: m(r => r.y) }); }
  return out;
}
/* where the model sits from the market: each game's side the model rates higher than the market, by how far, with the
   mean model and market chance on that side and how often it won */
const GAPS = [0, 0.03, 0.07, 0.15, 1.0001];
function gaps(rows) {
  const sides = rows.map(r => r.a >= r.b ? { gap: r.a - r.b, a: r.a, b: r.b, y: r.y } : { gap: r.b - r.a, a: 1 - r.a, b: 1 - r.b, y: 1 - r.y });
  const out = [];
  for (let i = 0; i + 1 < GAPS.length; i++) { const lo = GAPS[i], hi = GAPS[i + 1], s = sides.filter(x => x.gap >= lo && x.gap < hi); if (!s.length) continue;
    const m = f => r4(s.reduce((t, x) => t + f(x), 0) / s.length);
    out.push({ gap: `${Math.round(lo * 100)}-${hi > 1 ? '' : Math.round(hi * 100)}${hi > 1 ? '+' : ''} pts`, n: s.length, model: m(x => x.a), market: m(x => x.b), won: m(x => x.y) }); }
  return out;
}

/* ---------- the extract: DraftKings' game lines as the job read them (lines.json's history) ---------- */
function extract() {
  const games = Object.fromEntries(readCsv(path.join(ROOT, 'data', 'games.csv')).filter(g => g.season === '2027').map(g => [g.game_id, g]));
  const shas = cp.execFileSync('git', ['log', '--format=%H', '--', 'lines.json'], { cwd: ROOT, encoding: 'utf8' }).split('\n').filter(Boolean);
  const best = {};   // game -> market -> { at, row, sha }
  for (const sha of shas) {
    let L; try { L = JSON.parse(cp.execFileSync('git', ['show', `${sha}:lines.json`], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 })); } catch (e) { continue; }
    if (!L || !L.games) continue;
    for (const [id, x] of Object.entries(L.games)) {
      const g = games[id]; if (!g || !g.tip || !x || !x.at) continue;
      const at = Date.parse(x.at), tip = Date.parse(g.tip.length === 17 ? g.tip.replace('Z', ':00Z') : g.tip);
      if (!(at < tip)) continue;
      const b = best[id] = best[id] || {};
      const take = (k, ok) => { if (ok && (!b[k] || at > b[k].t)) b[k] = { t: at, at: x.at, v: x[k], sha: sha.slice(0, 7) }; };
      take('ml', x.ml && Number.isFinite(x.ml.home) && Number.isFinite(x.ml.away));
      take('spread', x.spread && Number.isFinite(x.spread.line) && Number.isFinite(x.spread.home) && Number.isFinite(x.spread.away));
      take('total', x.total && Number.isFinite(x.total.line) && Number.isFinite(x.total.over) && Number.isFinite(x.total.under));
    }
  }
  const head = 'game_id,tip,ml_at,home_ml,away_ml,spread_at,home_line,home_spread,away_spread,total_at,total,over,under,commits';
  const rows = Object.keys(best).sort().map(id => { const b = best[id], g = games[id];
    return [id, g.tip, b.ml ? b.ml.at : '', b.ml ? b.ml.v.home : '', b.ml ? b.ml.v.away : '', b.spread ? b.spread.at : '', b.spread ? b.spread.v.line : '', b.spread ? b.spread.v.home : '', b.spread ? b.spread.v.away : '',
      b.total ? b.total.at : '', b.total ? b.total.v.line : '', b.total ? b.total.v.over : '', b.total ? b.total.v.under : '', [...new Set(['ml', 'spread', 'total'].filter(k => b[k]).map(k => b[k].sha))].join(' ')].join(','); });
  fs.writeFileSync(DK_CSV, head + '\n' + rows.join('\n') + '\n');
  console.log(`wrote ${path.relative(ROOT, DK_CSV)}: ${rows.length} games from ${shas.length} commits of lines.json`);
}

/* ---------- the team legs ---------- */
/* one game's three team rows from the model's numbers and a market: { ml, spread, total }, each a row for score() on the
   home side (the over for the total) or null. ml: the model's pHome against the market's two prices in proportion (and
   the power devig beside it); spread: Phi((m + h) / SIGMA) for the home side at the market's line h, m = -spread, against
   the market's two spread prices in proportion (50% where none is kept: the closing spread's price is not, -110 a side);
   total: the page's chance is the market's own, so the model's own total, Phi((T - line) / SIGMA_TOTAL), is an aside */
function teamRows(id, mdl, mk, score) {
  const out = { ml: null, spread: null, total: null, sides: [] }, hs = score[1], as = score[0];
  if (mk.hml != null && mk.aml != null) {
    const y = hs > as ? 1 : 0, b = prop(mk.hml, mk.aml);
    out.ml = { g: id, y, a: mdl.pHome, b, pw: power(mk.hml, mk.aml) };
    /* each side as spPool keeps it: the model's chance in the band, not far off the fair chance; Value at 3 points over the price */
    for (const [s, p, f, am, yy] of [['home', mdl.pHome, b, mk.hml, y], ['away', 1 - mdl.pHome, 1 - b, mk.aml, 1 - y]]) {
      if (p >= PB_PMIN && p < PB_PMAX && !(p - f >= PB_FAR - 1e-9)) out.sides.push({ g: id, kind: 'ml', y: yy, a: p, b: f, value: p - imp(am) >= PB_EDGE, dec: dec(am) });
    }
  }
  if (mk.line != null && Number.isFinite(mdl.spread)) {
    const cover = hs - as + mk.line;
    if (cover !== 0) { const y = cover > 0 ? 1 : 0, a = Phi((-mdl.spread + mk.line) / SIGMA), b = mk.hsp != null ? prop(mk.hsp, mk.asp) : 0.5;
      out.spread = { g: id, y, a, b, pw: mk.hsp != null ? power(mk.hsp, mk.asp) : 0.5 };
      for (const [s, p, f, am, yy] of [['home', a, b, mk.hsp, y], ['away', 1 - a, 1 - b, mk.asp, 1 - y]]) {
        const amx = am != null ? am : -110;
        if (p >= PB_PMIN && p < PB_PMAX && !(p - f >= PB_FAR - 1e-9)) out.sides.push({ g: id, kind: 'spread', y: yy, a: p, b: f, value: p - imp(amx) >= PB_EDGE, dec: dec(amx) });
      } }
  }
  if (mk.total != null && Number.isFinite(mdl.total)) {
    const t = hs + as;
    if (t !== mk.total) { const y = t > mk.total ? 1 : 0, b = mk.over != null ? prop(mk.over, mk.under) : 0.5;
      out.total = { g: id, y, a: Phi((mdl.total - mk.total) / SIGMA_TOTAL), b, pw: mk.over != null ? power(mk.over, mk.under) : 0.5 }; }
  }
  return out;
}
/* the sides spPool would keep, the model's chance against the fair chance on each, and the Value sides apart: how often
   they won, and what $1 returned at the price */
function sideReport(sides) {
  const o = {};
  for (const k of ['ml', 'spread']) { const s = sides.filter(x => x.kind === k); if (!s.length) continue;
    const v = s.filter(x => x.value), ret = a => a.length ? boot(a.map(x => ({ g: x.g, d: x.y ? x.dec - 1 : -1 })), nextSeed()) : null;
    o[k] = { pool: score(s), value: v.length ? { n: v.length, model: r4(v.reduce((t, x) => t + x.a, 0) / v.length), fair: r4(v.reduce((t, x) => t + x.b, 0) / v.length), won: r4(v.reduce((t, x) => t + x.y, 0) / v.length), returnPer1: ret(v) } : null }; }
  return o;
}
function marketReport(rowsByKind, label) {
  const o = {};
  for (const [k, rows] of Object.entries(rowsByKind)) { if (!rows.length) { o[k] = { n: 0 }; continue; }
    o[k] = score(rows); o[k].calibration = calib(rows); o[k].fromMarket = gaps(rows); }
  return o;
}

function main() {
  SEEDN = 0;
  const games = readCsv(path.join(ROOT, 'data', 'games.csv')), byId = Object.fromEntries(games.map(g => [g.game_id, g]));
  const res = { about: 'research/sp_ruler/evidence.js: the chance a Suggested Parlays set\'s team legs are ranked at today (legModel: the player model, raw) against DraftKings\' no-vig chance (legFair), and two checks of that ruler. Read only: nothing fitted, tuned or chosen. Intervals are 90% bootstraps over games, 10,000 resamples, seeded.',
    page: { ml: 'g.model.pHome, the player model\'s win chance, raw (legModel); never pulled to the market', spread: `Phi((m + h) / ${SIGMA}), m the side's expected margin from the player model's spread, h its line (legModel)`, total: 'the market\'s own: its two prices with the margin out in proportion (legModel), the same number as legFair', pool: `spPool keeps a team side with that chance in [${PB_PMIN}, ${PB_PMAX}) and less than ${PB_FAR} over legFair; ${PB_EDGE} over the implied price marks it Value` },
    sigma: SIGMA, sigmaTotal: SIGMA_TOTAL };

  /* ---- 1. the walk-forward folds against the closing line ---- */
  const bt = readCsv(path.join(ROOT, 'research', 'backtest_games.csv'));
  res.walkForward = {};
  for (const lineup of ['known', 'naive']) {
    const per = {}, pool = { ml: [], spread: [], total: [] }, sidesAll = [];
    for (const season of ['2024', '2025', '2026']) {
      const R = { ml: [], spread: [], total: [] }, sides = [];
      for (const r of bt.filter(x => x.lineup === lineup && x.season === season)) {
        if (r.ml_used !== '1') continue;   // a closing pair the backtest's check takes
        const mk = { hml: num(r.home_ml), aml: num(r.away_ml), line: r.line_used === '1' ? num(r.home_line) : null, total: r.total_used === '1' ? num(r.total) : null };
        const t = teamRows(r.game_id, { pHome: +r.model_p_home, spread: +r.model_home_spread, total: +r.model_total }, mk, [+r.away_score, +r.home_score]);
        for (const k of ['ml', 'spread', 'total']) if (t[k]) R[k].push(t[k]);
        sides.push(...t.sides);
      }
      const lab = `${+season - 1}-${season.slice(2)}`;
      per[lab] = marketReport(R); per[lab].sides = sideReport(sides);
      for (const k of ['ml', 'spread', 'total']) pool[k].push(...R[k]); sidesAll.push(...sides);
    }
    res.walkForward[lineup] = { seasons: per, pooled: Object.assign(marketReport(pool), { sides: sideReport(sidesAll) }) };
  }
  res.walkForward.note = 'research/backtest_games.csv: each season on the player model\'s parameters fitted on the seasons before it alone; "known" the players who did play (a perfect injury report, the model\'s best case), "naive" the previous game\'s lineup. Market: the closing line (data/odds_hist.csv: DraftKings in 2023-24 and 2025-26 mostly, ESPN BET in 2024-25), the moneylines\' two prices in proportion. No closing spread or total price is kept, so a spread\'s and a total\'s market chance is 50% (-110 a side). SIGMA 14.5 was measured on the 2025-26 fold (research/sigma.json), so that season\'s spread is not wholly out of sample. A total\'s model row is an aside: the page ranks a total at the market\'s chance.';

  /* ---- 2. the season in play, read only ---- */
  const preds = Object.fromEntries(readCsv(path.join(ROOT, 'data', 'predictions.csv')).map(p => [p.game_id, p]));
  const fin = id => { const g = byId[id]; return g && g.status === 'final' && g.type !== 'PRE' && g.away_score !== '' ? [+g.away_score, +g.home_score] : null; };
  const inPlay = {};
  const dk = fs.existsSync(DK_CSV) ? readCsv(DK_CSV) : [];
  { const R = { ml: [], spread: [], total: [] }, sides = [], team = [];
    for (const d of dk) { const p = preds[d.game_id], sc = fin(d.game_id); if (!p || !sc) continue;
      const mk = { hml: num(d.home_ml), aml: num(d.away_ml), line: num(d.home_line), hsp: num(d.home_spread), asp: num(d.away_spread), total: num(d.total), over: num(d.over), under: num(d.under) };
      const t = teamRows(d.game_id, { pHome: +p.pHome, spread: +p.spread, total: +p.total }, mk, sc);
      for (const k of ['ml', 'spread', 'total']) if (t[k]) R[k].push(t[k]); sides.push(...t.sides);
      if (t.ml && p.team_pHome !== '') team.push({ g: d.game_id, y: t.ml.y, a: +p.team_pHome, b: t.ml.b }); }
    inPlay.draftkings = marketReport(R); inPlay.draftkings.teamLegReturn = teamReturn(dk, fin); inPlay.draftkings.sides = sideReport(sides); inPlay.draftkings.teamEloMl = score(team);
    inPlay.draftkings.note = 'research/sp_ruler/dk_game_lines_2027.csv: the job\'s last read of DraftKings\' game lines before each tip (lines.json\'s history, from 26 October 2026), every price DraftKings\' own, so a spread\'s and a total\'s market chance is its two prices in proportion. Model: data/predictions.csv, the player model\'s pre-tip call frozen at tip. teamEloMl: the Team Elo column of the same file, an aside (the page never ranks a leg on it).'; }
  { const R = { ml: [], spread: [], total: [] };
    for (const g of games.filter(x => x.season === '2027')) { const p = preds[g.game_id], sc = fin(g.game_id); if (!p || !sc) continue;
      const mk = { hml: num(g.home_ml), aml: num(g.away_ml), line: num(g.home_line), total: num(g.total) };
      if (mk.hml == null || mk.aml == null) continue;
      const t = teamRows(g.game_id, { pHome: +p.pHome, spread: +p.spread, total: +p.total }, mk, sc);
      for (const k of ['ml', 'spread', 'total']) if (t[k]) R[k].push(t[k]); }
    inPlay.atTip = marketReport(R);
    inPlay.atTip.note = 'data/games.csv: the line ESPN\'s scoreboard carried, frozen at tip (from 20 October 2026); no spread or total price, so those are at 50%.'; }
  res.inPlay = inPlay;

  /* ---- 3. the devig rule: power against proportional, on the market's own chance ---- */
  const dv = {};
  const oh = readCsv(path.join(ROOT, 'data', 'odds_hist.csv'));
  const okMl = r => r.home_ml && r.away_ml && !/live/i.test(r.provider || '');
  for (const season of ['2023', '2024', '2025', '2026']) {
    const rows = [];
    for (const r of oh.filter(x => x.season === season && okMl(x))) { const sc = fin(r.game_id); if (!sc) continue; const h = +r.home_ml, a = +r.away_ml; if (!h || !a) continue;
      rows.push({ g: r.game_id, y: sc[1] > sc[0] ? 1 : 0, a: power(h, a), b: prop(h, a) }); }
    dv[`${+season - 1}-${season.slice(2)} moneylines (closing)`] = score(rows, 'power', 'proportional');
    dv[`${+season - 1}-${season.slice(2)} moneylines (closing)`].favourites = favBand(rows);
  }
  { const R = { ml: [], spread: [], total: [] };
    for (const d of dk) { const sc = fin(d.game_id); if (!sc) continue; const mk = { hml: num(d.home_ml), aml: num(d.away_ml), line: num(d.home_line), hsp: num(d.home_spread), asp: num(d.away_spread), total: num(d.total), over: num(d.over), under: num(d.under) };
      const t = teamRows(d.game_id, { pHome: 0.5, spread: 0, total: 0 }, mk, sc);
      if (t.ml) R.ml.push({ g: t.ml.g, y: t.ml.y, a: t.ml.pw, b: t.ml.b });
      if (t.spread && mk.hsp != null) R.spread.push({ g: t.spread.g, y: t.spread.y, a: t.spread.pw, b: t.spread.b });
      if (t.total && mk.over != null) R.total.push({ g: t.total.g, y: t.total.y, a: t.total.pw, b: t.total.b }); }
    for (const k of ['ml', 'spread', 'total']) dv[`2026-27 ${k} (DraftKings, the job's read; the season in play, never chosen on)`] = score(R[k], 'power', 'proportional');
    dv['2026-27 ml (DraftKings, the job\'s read; the season in play, never chosen on)'].favourites = favBand(R.ml); }
  res.devig = dv;

  /* ---- 4. the ruler on player legs: DraftKings' main lines against legFair's fair chance ---- */
  res.players = { '2026-27 regular season': playerLines('2027'), '2026 play-in and playoffs': playerLines('2026') };
  res.players.shadow = shadowCheck();

  /* ---- the verdict ---- */
  const oos = [];
  for (const k of ['ml', 'spread']) {
    const w = res.walkForward.known.pooled[k], n = res.walkForward.naive.pooled[k], p = res.inPlay.draftkings[k];
    oos.push({ market: k, walkForwardKnown: w.logloss, walkForwardNaive: n.logloss, inPlay: p.logloss });
  }
  const beats = x => x && x.ci90 && x.ci90[1] < 0;
  res.verdict = { modelBeatsMarket: oos.some(o => beats(o.walkForwardKnown) && beats(o.walkForwardNaive)), rule: 'true only where the model\'s log loss less the market\'s has its 90% interval wholly below 0 out of sample (both walk-forward lineups)', byMarket: oos };
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(res, null, 1) + '\n');
  summary(res);
}
/* every team side DraftKings priced in the job's last read before tip (each moneyline, spread and total side), at its
   own price: what it was expected to return at legFair's fair chance and what $1 on it returned (a push left out) */
function teamReturn(dk, fin) {
  const rows = [];
  for (const d of dk) { const sc = fin(d.game_id); if (!sc) continue; const [as, hs] = sc;
    const two = (k, a, b, ya, yb) => { a = num(a); b = num(b); if (a == null || b == null || ya == null) return;
      rows.push({ g: d.game_id, k, y: ya, f: prop(a, b), dec: dec(a) }, { g: d.game_id, k, y: yb, f: prop(b, a), dec: dec(b) }); };
    two('ml', d.home_ml, d.away_ml, hs > as ? 1 : 0, hs > as ? 0 : 1);
    const ln = num(d.home_line); if (ln != null && hs - as + ln !== 0) two('spread', d.home_spread, d.away_spread, hs - as + ln > 0 ? 1 : 0, hs - as + ln > 0 ? 0 : 1);
    const t = num(d.total); if (t != null && hs + as !== t) two('total', d.over, d.under, hs + as > t ? 1 : 0, hs + as > t ? 0 : 1); }
  const rep = s => s.length ? { n: s.length, games: new Set(s.map(x => x.g)).size, fair: r4(s.reduce((t, x) => t + x.f, 0) / s.length), hit: r4(s.reduce((t, x) => t + x.y, 0) / s.length),
    expectedAtFair: r4(s.reduce((t, x) => t + x.f * x.dec - 1, 0) / s.length), returnPer1: boot(s.map(x => ({ g: x.g, d: x.y ? x.dec - 1 : -1 })), nextSeed()) } : null;
  return { all: rep(rows), ml: rep(rows.filter(x => x.k === 'ml')), spread: rep(rows.filter(x => x.k === 'spread')), total: rep(rows.filter(x => x.k === 'total')) };
}
/* the favourites: games by the proportional rule's favourite chance, each band's power and proportional chance and rate */
function favBand(rows) {
  const out = [], bands = [[0.5, 0.65], [0.65, 0.8], [0.8, 0.9], [0.9, 1.0001]];
  for (const [lo, hi] of bands) { const s = rows.map(r => r.b >= 0.5 ? r : { ...r, a: 1 - r.a, b: 1 - r.b, y: 1 - r.y }).filter(r => r.b >= lo && r.b < hi); if (!s.length) continue;
    const m = f => r4(s.reduce((t, r) => t + f(r), 0) / s.length);
    out.push({ favourite: `${Math.round(lo * 100)}-${Math.min(100, Math.round(hi * 100))}%`, n: s.length, proportional: m(r => r.b), power: m(r => r.a), won: m(r => r.y) }); }
  return out;
}
const STAT_PARTS = { pts: ['pts'], reb: ['reb'], ast: ['ast'], tpm: ['tpm'], stl: ['stl'], blk: ['blk'], pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
function playerLines(season) {
  const pf = path.join(ROOT, 'data', `props_${season}.csv`), bf = path.join(ROOT, 'data', `box_${season}.csv`);
  if (!fs.existsSync(pf) || !fs.existsSync(bf)) return null;
  const box = new Map();
  for (const b of readCsv(bf)) { if (b.dnp === '1' || !(+b.min > 0)) continue; box.set(`${b.game_id}|${b.player_id}`, { pts: +b.pts, reb: +b.orb + +b.drb, ast: +b.ast, tpm: +b.tpm, stl: +b.stl, blk: +b.blk }); }
  const sides = { over: [], under: [] }; let voided = 0, pushes = 0, noVig = 0, total = 0;
  for (const r of readCsv(pf)) {
    const o = num(r.over), u = num(r.under), line = num(r.line), parts = STAT_PARTS[r.stat]; if (o == null || u == null || line == null || !parts || !o || !u) continue;
    total++;
    if (imp(o) + imp(u) < 1) { noVig++; continue; }   // spPool leaves a line with no margin out
    const s = box.get(`${r.game_id}|${r.player_id}`); if (!s) { voided++; continue; }
    const v = parts.reduce((t, k) => t + s[k], 0); if (v === line) { pushes++; continue; }
    const over = v > line ? 1 : 0, fo = 1 - imp(u);     // legFair: the whole margin on the Over
    sides.over.push({ g: r.game_id, y: over, f: fo, dec: dec(o), stat: r.stat });
    sides.under.push({ g: r.game_id, y: 1 - over, f: 1 - fo, dec: dec(u), stat: r.stat });
  }
  const rep = s => { if (!s.length) return null; const m = f => r4(s.reduce((t, x) => t + f(x), 0) / s.length);
    return { n: s.length, games: new Set(s.map(x => x.g)).size, fair: m(x => x.f), hit: m(x => x.y), hitLessFair: boot(s.map(x => ({ g: x.g, d: x.y - x.f })), nextSeed()),
      returnPer1: boot(s.map(x => ({ g: x.g, d: x.y ? x.dec - 1 : -1 })), nextSeed()), expectedAtFair: m(x => x.f * x.dec - 1) }; };
  const inBand = s => s.filter(x => x.f >= PB_PMIN && x.f < PB_PMAX);
  const byFair = s => { const out = []; for (const [lo, hi] of [[0, 0.45], [0.45, 0.55], [0.55, 0.65], [0.65, 0.75], [0.75, 1.0001]]) { const t = s.filter(x => x.f >= lo && x.f < hi); if (t.length) out.push({ fair: `${Math.round(lo * 100)}-${Math.min(100, Math.round(hi * 100))}%`, ...rep(t) }); } return out; };
  return { lines: total, graded: sides.over.length, voided, pushes, noVig, over: rep(sides.over), under: rep(sides.under), overInPool: rep(inBand(sides.over)), underInPool: rep(inBand(sides.under)), underByFair: byFair(sides.under), overByFair: byFair(sides.over) };
}
/* data/props_shadow_lines.csv's own graded subset: its p_market is legFair's fair Over; how the Overs did against it */
function shadowCheck() {
  const f = path.join(ROOT, 'data', 'props_shadow_lines.csv'); if (!fs.existsSync(f)) return null;
  const pl = new Map(readCsv(path.join(ROOT, 'data', 'props_2027.csv')).map(r => [`${r.game_id}|${r.player_id}|${r.stat}`, r]));
  const rows = []; let noLine = 0, push = 0;
  for (const r of readCsv(f)) { const p = pl.get(`${r.game_id}|${r.player_id}|${r.stat}`); if (!p) { noLine++; continue; } const y = +r.y, line = +p.line; if (y === line) { push++; continue; }
    rows.push({ g: r.game_id, y: y > line ? 1 : 0, f: +r.p_market, m: +r.p_model }); }
  const mean = fn => r4(rows.reduce((t, x) => t + fn(x), 0) / rows.length);
  return { n: rows.length, noLine, pushes: push, fairOver: mean(x => x.f), overHit: mean(x => x.y), note: 'data/props_shadow_lines.csv, the props ledger\'s graded lines (its p_market is the fair Over by the page\'s rule), joined to data/props_2027.csv for the line: a cross-check of the box-score grading above' };
}

/* ---------- the printed summary ---------- */
const pct = x => x == null ? '-' : (x * 100).toFixed(1) + '%';
const sg = x => x == null ? '-' : (x >= 0 ? '+' : '') + x.toFixed(4);
const ci = c => c ? `[${sg(c[0])}, ${sg(c[1])}]` : '';
function summary(res) {
  const line = (lab, s) => s && s.n ? console.log(`  ${lab.padEnd(34)} n ${String(s.n).padStart(5)}  log loss model ${s.logloss.model.toFixed(4)} market ${s.logloss.market.toFixed(4)} diff ${sg(s.logloss.diff)} ${ci(s.logloss.ci90)}  Brier diff ${sg(s.brier.diff)} ${ci(s.brier.ci90)}`) : console.log(`  ${lab}: none`);
  for (const lu of ['known', 'naive']) { console.log(`walk-forward, lineup ${lu}`);
    for (const [s, r] of Object.entries(res.walkForward[lu].seasons)) for (const k of ['ml', 'spread', 'total']) line(`${s} ${k}`, r[k]);
    for (const k of ['ml', 'spread', 'total']) line(`pooled ${k}`, res.walkForward[lu].pooled[k]); }
  console.log('2026-27, DraftKings as the job read it'); for (const k of ['ml', 'spread', 'total']) line(k, res.inPlay.draftkings[k]); line('Team Elo ml (aside)', res.inPlay.draftkings.teamEloMl);
  { const t = res.inPlay.draftkings.teamLegReturn; for (const k of ['all', 'ml', 'spread', 'total']) if (t[k]) console.log(`  team sides ${k.padEnd(7)} n ${String(t[k].n).padStart(4)} expected at fair ${sg(t[k].expectedAtFair)} returned/$1 ${sg(t[k].returnPer1.mean)} ${ci(t[k].returnPer1.ci90)}`); }
  console.log('2026-27, the line frozen at tip'); for (const k of ['ml', 'spread', 'total']) line(k, res.inPlay.atTip[k]);
  console.log('devig: power less proportional');
  for (const [k, s] of Object.entries(res.devig)) if (s.n) console.log(`  ${k.padEnd(78)} n ${String(s.n).padStart(5)} log loss ${sg(s.logloss.diff)} ${ci(s.logloss.ci90)}`);
  console.log('player main lines at legFair');
  for (const [k, p] of Object.entries(res.players)) if (p && p.over) for (const side of ['under', 'over', 'underInPool', 'overInPool']) { const s = p[side]; if (s) console.log(`  ${k.padEnd(26)} ${side.padEnd(12)} n ${String(s.n).padStart(5)} fair ${pct(s.fair)} hit ${pct(s.hit)} return/$1 ${sg(s.returnPer1.mean)} ${ci(s.returnPer1.ci90)}`); }
  console.log(`modelBeatsMarket: ${res.verdict.modelBeatsMarket}`);
}

if (require.main === module) { if (process.argv.includes('--extract')) extract(); else main(); }
module.exports = { prop, power, Phi, teamRows };
