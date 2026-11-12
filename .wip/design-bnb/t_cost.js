// What the builder's own sums cost: joint2, sgJoint (GHK, 20000 Halton points) for 3, 4, 5 legs, and spOrth
const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL);
  const r = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = bnbPoolFair(N, {}); const out = { legs: P.legs.length, games: P.games.length };
    const byG = {}; for (const l of P.legs) (byG[l.gid] = byG[l.gid] || []).push(l);
    const g = Object.values(byG)[0]; out.g0 = g.length;
    const unders = g.filter(l => l.kind === 'prop' && l.side === 'under');
    // distinct players
    const seen = new Set(), U = []; for (const l of unders) if (!seen.has(l.pid)) { seen.add(l.pid); U.push(l); }
    const t = (f, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(i); return (performance.now() - t0) / n; };
    out.joint2 = t(i => joint2(0.5 + (i % 7) * 0.01, 0.6, 0.05), 20000) * 1000 + ' us';
    for (const k of [3, 4, 5, 6]) {
      let c = 0; out['ghk' + k] = t(i => { SG_CACHE.clear(); const L = U.slice(i % 5, i % 5 + k); parlayProb(L); }, 20) + ' ms';
      out['dec' + k] = t(i => { SG_CACHE.clear(); const L = U.slice(i % 5, i % 5 + k); parlayDec(L.map(l => ({ leg: l, ml: l.price }))); }, 20) + ' ms';
    }
    return out;
  })()`);
  console.log(r);
  process.exit(0);
})();
