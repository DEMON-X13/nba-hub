/* Tests for the same-game correlation table (tools/corr.js, data/corr.json, research/corr.json): the bivariate normal,
 * the lookup's sign rules, and the committed table held to its own rules. No network, nothing written, a few seconds.
 *
 *   node tools/test_corr.js        must end "all good"
 *
 * 1. the bivariate normal: P(X > h, Y > k) against its closed form at the origin, the product at rho 0, its limits at
 *    rho +-1, and a numerical integral across the thresholds and rhos the builder meets (both of Genz's branches)
 * 2. the maximum likelihood: rho recovered from simulated pairs at their own thresholds, near 0, negative, strong, and
 *    two rare legs (where the score alone vanishes in the tails)
 * 3. the lookup (rhoFor): the key's rho for two legs of one game, its sign turned for each Under and for a win or cover
 *    on the other club; 0 across games; never one player's one kind twice
 * 4. the committed table: every key the builder can ask for, each a number in (-1, 1), keys in sort order (symmetric),
 *    the refused pairs the rule's, the hold the NFL's and marked untested, measured on finished seasons only, positive
 *    definite over every leg one game can carry (and a planted break caught), the report's shipped values the table's,
 *    each moved by the repair no more than 0.1 from what was measured and shrunk
 */
'use strict';
const fs = require('fs'), path = require('path');
const C = require('./corr');
const PM = require('./props');
const L = require('./lib');

let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const near = (a, b, e) => Math.abs(a - b) <= e;

console.log('1. the bivariate normal');
{
  let worst = 0;
  for (const r of [-0.99, -0.95, -0.93, -0.8, -0.5, -0.2, 0, 0.2, 0.5, 0.8, 0.93, 0.95, 0.99]) worst = Math.max(worst, Math.abs(C.bvnUpper(0, 0, r) - (0.25 + Math.asin(r) / (2 * Math.PI))));
  check(worst < 1e-7, `at the origin, 1/4 + asin(rho)/2pi: worst ${worst.toExponential(1)}`);
  let w0 = 0; for (const h of [-2, -0.5, 0.3, 1.7]) for (const k of [-1, 0.4, 2.2]) w0 = Math.max(w0, Math.abs(C.bvnUpper(h, k, 0) - PM.normCdf(-h) * PM.normCdf(-k)));
  check(w0 < 1e-7, `at rho 0 the product: worst ${w0.toExponential(1)}`);
  check(near(C.bvnUpper(0.3, -0.4, 1), PM.normCdf(-0.4 > 0.3 ? -0.4 : -0.3), 1e-7) && near(C.bvnUpper(0.3, -0.4, -1), Math.max(0, PM.normCdf(-0.3) - PM.normCdf(-0.4)), 1e-7), 'the limits at rho +1 and -1');
  const num = (h, k, r) => { let s = 0; const dx = 0.001; for (let x = h; x < h + 10; x += dx) { const m = x + dx / 2; s += Math.exp(-m * m / 2) / Math.sqrt(2 * Math.PI) * PM.normCdf((r * m - k) / Math.sqrt(1 - r * r)) * dx; } return s; };
  let wi = 0; for (const h of [-1.2, 0, 0.8, 2.3]) for (const k of [-0.6, 0.2, 1.9]) for (const r of [-0.96, -0.4, 0.15, 0.6, 0.94, 0.97]) wi = Math.max(wi, Math.abs(C.bvnUpper(h, k, r) - num(h, k, r)));
  check(wi < 2e-6, `against a numerical integral (both branches, |rho| under and over 0.925): worst ${wi.toExponential(1)}`);
  check(near(C.joint2(0.3, 0.6, 0), 0.18, 1e-7) && C.joint2(0.3, 0.6, 0.5) > 0.18 && C.joint2(0.3, 0.6, -0.5) < 0.18 && near(C.joint2(0.3, 0.6, 0.4), C.joint2(0.6, 0.3, 0.4), 1e-12), 'joint2: the product at 0, rising with rho, symmetric');
}

console.log('2. the maximum likelihood');
{
  const rnd = PM.rng(7), gauss = () => { const u = rnd() || 1e-12, v = rnd(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
  const sim = (rho, n, ta0, tb0, spread) => {
    const m = new Map();
    for (let i = 0; i < n; i++) {
      const ta = ta0 + (rnd() - 0.5) * spread, tb = tb0 + (rnd() - 0.5) * spread;
      const z1 = gauss(), z2 = rho * z1 + Math.sqrt(1 - rho * rho) * gauss();
      const bk = (Math.round(ta / 0.04) + 200) * 1000 + (Math.round(tb / 0.04) + 200);
      let c = m.get(bk); if (!c) m.set(bk, c = new Float64Array(40)); c[(i % 10) * 4 + (z1 > ta ? 2 : 0) + (z2 > tb ? 1 : 0)]++;
    }
    return C.solve(C.binsOf(m));
  };
  for (const [rho, n, ta, tb, sp, tol] of [[0, 100000, 0, 0, 1, 0.02], [-0.3, 100000, 0.1, -0.2, 1, 0.02], [0.75, 100000, 0, 0.3, 1, 0.02], [-0.1, 200000, 2.2, 2.2, 0.6, 0.15]]) {
    const got = sim(rho, n, ta, tb, sp);
    check(near(got, rho, tol), `rho ${rho} at thresholds about ${ta} and ${tb}: ${got.toFixed(3)}`);
  }
}

console.log('3. the lookup');
{
  const T = { 'self|pts|reb': 0.33, 'mate|ast|pts': 0.04, 'opp|pts|pts': 0.01, 'team|pts|win': 0.13, 'team|pts|cover': 0.12, 'team|pts|over': 0.14, 'game|over|win': 0.05, 'game|cover|over': 0.04 };
  const leg = (o) => ({ game: 'g', home: 'BOS', ...o });
  const pts = (player, team, side = 'over') => leg({ kind: 'pts', player, team, side });
  check(C.rhoFor(T, pts('a', 'BOS'), leg({ kind: 'reb', player: 'a', team: 'BOS', side: 'over' })) === 0.33, 'one player\'s two stats: the self key');
  check(C.rhoFor(T, pts('a', 'BOS', 'under'), leg({ kind: 'reb', player: 'a', team: 'BOS', side: 'over' })) === -0.33, 'an Under turns the sign');
  check(C.rhoFor(T, pts('a', 'BOS', 'under'), leg({ kind: 'reb', player: 'a', team: 'BOS', side: 'under' })) === 0.33, 'two Unders keep it');
  check(C.rhoFor(T, leg({ kind: 'ast', player: 'b', team: 'BOS', side: 'over' }), pts('a', 'BOS')) === 0.04, 'teammates: the mate key, kinds in sort order');
  check(C.rhoFor(T, pts('a', 'BOS'), pts('c', 'DET')) === 0.01, 'opponents: the opp key');
  check(C.rhoFor(T, pts('a', 'BOS'), leg({ kind: 'win', team: 'BOS' })) === 0.13 && C.rhoFor(T, pts('c', 'DET'), leg({ kind: 'win', team: 'BOS' })) === -0.13, 'a player with his club\'s win, and with the other club\'s');
  check(C.rhoFor(T, pts('c', 'DET', 'under'), leg({ kind: 'cover', team: 'BOS' })) === 0.12, 'an Under with the other club\'s cover: two turns');
  check(C.rhoFor(T, pts('c', 'DET'), leg({ kind: 'over', side: 'over' })) === 0.14 && C.rhoFor(T, pts('c', 'DET'), leg({ kind: 'over', side: 'under' })) === -0.14, 'the total: either club the same, its Under turned');
  check(C.rhoFor(T, leg({ kind: 'win', team: 'DET' }), leg({ kind: 'over', side: 'over' })) === -0.05 && C.rhoFor(T, leg({ kind: 'cover', team: 'BOS' }), leg({ kind: 'over', side: 'under' })) === -0.04, 'two game legs: the home side\'s key, turned for the away side and an Under');
  check(C.rhoFor(T, pts('a', 'BOS'), { ...pts('c', 'DET'), game: 'other' }) === 0, 'legs of different games: 0');
  check(C.rhoFor(T, pts('a', 'BOS'), pts('a', 'BOS', 'under')) === null && C.rhoFor(T, leg({ kind: 'over', side: 'over' }), leg({ kind: 'over', side: 'under' })) === null, 'one player\'s one kind twice, or two totals: never joined (null)');
}

console.log('4. the committed table');
{
  const table = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'data', 'corr.json'), 'utf8'));
  const report = JSON.parse(fs.readFileSync(path.join(L.ROOT, 'research', 'corr.json'), 'utf8'));
  const keys = Object.keys(table.rho);
  check(C.TABLE_KEYS.every(k => k in table.rho) && keys.length === C.TABLE_KEYS.length, `every key the builder can ask for (${C.TABLE_KEYS.length}) and no other`);
  check(keys.every(k => Number.isFinite(table.rho[k]) && table.rho[k] > -1 && table.rho[k] < 1), 'each a number in (-1, 1)');
  check(keys.every(k => { const [rel, a, b] = k.split('|'); return rel === 'team' || a <= b; }), 'kinds in sort order: one key a pair, so the table is symmetric');
  check(JSON.stringify(table.refused.pairs) === JSON.stringify([...C.REFUSED].sort()), `the refused pairs the rule's (${C.REFUSED.size})`);
  check(['self|pra|pts', 'self|sb|stl', 'self|dd|td', 'game|cover|win'].every(k => C.REFUSED.has(k)) && !C.REFUSED.has('self|pts|reb') && !C.REFUSED.has('self|pts|tpm'), 'a stat with a combo holding it, a double- with a triple-double, a win with a cover refused; points with rebounds or threes not');
  check(table.hold && table.hold.value === 0.896 && table.hold.tested === false && table.hold.appliesTo === 'implied' && /untested/.test(table.hold.untested), 'the hold: the NFL\'s 0.896, on the implied chances, untested and said so');
  const games = L.readGames();
  const inPlay = Math.max(0, ...games.filter(g => g.status !== 'final' && g.type !== 'PRE').map(g => +g.season));
  const [from, to] = String(table.measured).split('-').map(Number);
  check(from > 2022 && to >= from && (!inPlay || to < inPlay), `measured on finished seasons only (${table.measured}; the season in play ${inPlay || 'none'})`);
  const X = C.toBlocks(k => table.rho[k]), mb = C.modeBlocks(X), least = Math.min(...[mb.A, mb.B].map(m => Math.min(...C.jacobiEig(m).w)));
  check(least > 0 && !!C.cholesky(C.gameMatrix(table.rho)), `positive definite over every leg one game can carry (${C.gameMatrix(table.rho).length} legs; least eigenvalue ${least.toFixed(4)})`);
  check(near(least, table.psd.leastEigenvalue, 1e-3), 'the table\'s own psd note says so');
  const bad = { ...table.rho, 'mate|pts|pts': 0.5 };
  check(!C.cholesky(C.gameMatrix(bad)), 'a planted break (teammates\' points at 0.5) is caught');
  const sh = report.shipped.keys;
  check(keys.every(k => sh[k] && sh[k].shipped === table.rho[k]), 'the report\'s shipped values the table\'s');
  const moved = keys.filter(k => !C.REFUSED.has(k)).map(k => Math.abs(table.rho[k] - sh[k].shrunk));
  check(Math.max(...moved) <= 0.1, `the repair moved no priced value more than 0.1 from what was measured and shrunk (largest ${Math.max(...moved).toFixed(3)})`);
  const v = report.validation;
  check(v && v.draftKings && v.draftKings.logloss.diffCi90[1] < 0 && v.modelLines.regular.logloss.diffCi90[1] < 0, 'the validation on the held-out season is in the report, the copula ahead of independence on both');
}

console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
