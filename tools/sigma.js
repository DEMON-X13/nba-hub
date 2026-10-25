/* The spread of a game's margin about the player model's own number, which the Parlay Builder prices a spread from
 * (README "Parlay Builder"), and what the model's team picks with the Value rule's edge have been worth.
 *
 *   node tools/sigma.js        reads research/backtest_games.csv; writes research/sigma.json (only when it changes)
 *
 * research/backtest_games.csv is tools/backtest.js's walk-forward: every final of the 2024, 2025 and 2026 folds called by
 * the parameters research.json fitted on the seasons before each alone, with the lineup known (who played, on their
 * projected minutes) and with the previous game's lineup, beside the closing lines of data/odds_hist.csv.
 *
 * SIGMA. On the 2026 fold (the last finished season), lineup known, every final the fold scores (regular season, play-in
 * and playoffs): the root mean square of the home margin less the model's expected home margin (minus its published
 * spread, which is the home side's handicap, negative where the home side is favoured). The model's number is the centre
 * the page draws the margin about, so the spread about that centre, bias in, is the root mean square, not the standard
 * deviation about the residuals' own mean (the two differ by under 0.01 point here). The page's cover chance for the
 * home side at its own line h is then Phi((m + h) / sigma), m the expected home margin; the away side's is 1 less that.
 *
 * THE TEAM PICKS. On each fold, lineup known: every side the Value rule would list (the model's chance from 45% to 97%,
 * 3 points or more above the chance its closing price implies, the margin left in), counted, with the chance the model
 * said on average, how often it won and the profit on $1 at the closing price. A moneyline's chance is the model's own
 * win chance; a cover's is Phi((m + h) / sigma) on the closing line, priced at -110 a side (data/odds_hist.csv keeps no
 * spread prices; -110 is what DraftKings hangs on most of them), a push left out. Each again with the far-off guard as the
 * page applies it (a side the model rates 15 points or more above the book's fair chance, its two prices with the margin
 * taken out in proportion, is not listed). The sigma is the 2026 fold's, so the 2026 cover rows use a number measured on
 * those same games. Shown for the owner to read: nothing on the page is chosen from these numbers.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const IN = path.join(ROOT, 'research', 'backtest_games.csv');
const OUT = path.join(ROOT, 'research', 'sigma.json');
const FOLDS = ['2024', '2025', '2026'], SIGMA_FOLD = '2026';
const PMIN = 0.45, PMAX = 0.97, EDGE = 0.03, FAR = 0.15, SPREAD_PRICE = -110;

/* the page's own normal cdf (app/nba_hub.html Phi, by Abramowitz and Stegun's erf) */
const erf = x => { const t = 1 / (1 + 0.3275911 * Math.abs(x)); const y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; };
const Phi = z => 0.5 * (1 + erf(z / Math.SQRT2));
const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100);
const dec = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
const r4 = v => Math.round(v * 1e4) / 1e4;

function rows() {
  const t = fs.readFileSync(IN, 'utf8').trim().split('\n'), h = t.shift().split(',');
  return t.map(l => { const v = l.split(','), o = {}; h.forEach((k, i) => { o[k] = v[i]; }); return o; });
}
/* a list of picks: { p, won (true, false, or null for a push), price, fair } -> the summary */
function sum(list) {
  const graded = list.filter(x => x.won !== null), n = graded.length, w = graded.filter(x => x.won).length;
  const units = graded.reduce((t, x) => t + (x.won ? dec(x.price) - 1 : -1), 0);
  return { n, said: n ? r4(graded.reduce((t, x) => t + x.p, 0) / n) : null, won: w, rate: n ? r4(w / n) : null, units: +units.toFixed(2), pushes: list.length - n };
}
function main() {
  const all = rows().filter(r => r.lineup === 'known');
  const resid = s => all.filter(r => r.season === s).map(r => (+r.home_score - +r.away_score) - (-+r.model_home_spread));
  const spreadOf = s => { const x = resid(s), n = x.length, mean = x.reduce((a, b) => a + b, 0) / n;
    return { games: n, mean: r4(mean), rms: r4(Math.sqrt(x.reduce((a, b) => a + b * b, 0) / n)), sd: r4(Math.sqrt(x.reduce((a, b) => a + (b - mean) ** 2, 0) / n)) }; };
  const folds = Object.fromEntries(FOLDS.map(s => [s, spreadOf(s)]));
  const sigma = Math.round(folds[SIGMA_FOLD].rms * 10) / 10;
  const picks = {};
  for (const s of FOLDS) {
    const ml = [], cover = [];
    for (const r of all.filter(x => x.season === s)) {
      const mov = +r.home_score - +r.away_score, pH = +r.model_p_home, m = -+r.model_home_spread;
      if (r.ml_used === '1') {
        const hi = imp(+r.home_ml), ai = imp(+r.away_ml);
        for (const [p, price, won, fair] of [[pH, +r.home_ml, mov > 0, hi / (hi + ai)], [1 - pH, +r.away_ml, mov < 0, ai / (hi + ai)]])
          if (p >= PMIN && p < PMAX && p - imp(price) >= EDGE) ml.push({ p, price, won: mov === 0 ? null : won, fair });
      }
      if (r.line_used === '1') {
        const h = +r.home_line, c = mov + h, pc = Phi((m + h) / sigma);
        for (const [p, won] of [[pc, c > 0], [1 - pc, c < 0]])
          if (p >= PMIN && p < PMAX && p - imp(SPREAD_PRICE) >= EDGE) cover.push({ p, price: SPREAD_PRICE, won: c === 0 ? null : won, fair: 0.5 });
      }
    }
    const near = list => list.filter(x => !(x.p - x.fair >= FAR - 1e-9));
    picks[s] = { ml: sum(ml), mlNear: sum(near(ml)), cover: sum(cover), coverNear: sum(near(cover)) };
  }
  const out = { about: 'tools/sigma.js: the spread of the home margin about the player model\'s own (walk-forward, lineup known, research/backtest_games.csv), and the Value rule\'s team picks on the folds', source: 'research/backtest_games.csv',
    fold: +SIGMA_FOLD, lineup: 'known', sigma, folds, rule: { pmin: PMIN, pmax: PMAX, edge: EDGE, far: FAR, spreadPrice: SPREAD_PRICE }, picks };
  const body = JSON.stringify(out, null, 1) + '\n', before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (body !== before) fs.writeFileSync(OUT, body);
  console.log(`sigma ${sigma} (2026 fold, lineup known: ${folds[SIGMA_FOLD].games} games, rms ${folds[SIGMA_FOLD].rms}, sd ${folds[SIGMA_FOLD].sd}, mean ${folds[SIGMA_FOLD].mean}) | research/sigma.json ${body !== before ? 'written' : 'unchanged'}`);
  for (const s of FOLDS) { const p = picks[s], f = x => `${x.n} picks, said ${(x.said * 100).toFixed(1)}%, won ${(x.rate * 100).toFixed(1)}%, ${x.units >= 0 ? '+' : ''}${x.units}u`;
    console.log(`  ${s}: moneyline ${f(p.ml)} (far-off guard: ${f(p.mlNear)}) | cover ${f(p.cover)} (far-off guard: ${f(p.coverNear)})`); }
}
if (require.main === module) main();
module.exports = { Phi, imp };
