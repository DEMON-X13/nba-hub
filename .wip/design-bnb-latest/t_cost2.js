const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL);
  const r = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = bnbPoolFair(N, {}); const out = {};
    const byG = {}; for (const l of P.legs) (byG[l.gid] = byG[l.gid] || []).push(l);
    const g = Object.values(byG)[0];
    const unders = g.filter(l => l.kind === 'prop' && l.side === 'under');
    const seen = new Set(), U = []; for (const l of unders) if (!seen.has(l.pid)) { seen.add(l.pid); U.push(l); }
    const t = (f, n) => { const t0 = performance.now(); for (let i = 0; i < n; i++) f(i); return (performance.now() - t0) / n; };
    for (const k of [3, 4, 5]) {
      const groups = []; for (let i = 0; i < 12; i++) groups.push(U.slice(i, i + k));
      const R = L => L.map((a, i) => L.map((b, j) => i === j ? 1 : pbRho(a, b)));
      out['orth' + k] = t(i => { const L = groups[i % 12]; spOrth(L.map(l => normInv(1 - l.p)), R(L)); }, 200) * 1000 + ' us';
      // accuracy vs GHK
      let md = 0; for (const L of groups.slice(0, 6)) { SG_CACHE.clear(); const a = parlayProb(L).corr, b = spOrth(L.map(l => normInv(1 - l.p)), R(L)); md = Math.max(md, Math.abs(a - b) / a); }
      out['orthErr' + k] = md;
    }
    // cost breakdown of one GHK: 20000 * k normInv
    out.normInv = t(i => normInv(0.3 + (i % 100) / 300), 200000) * 1e6 + ' ns';
    out.normCdf = t(i => normCdf(-1 + (i % 100) / 50), 200000) * 1e6 + ' ns';
    return out;
  })()`);
  console.log(r);
  process.exit(0);
})();
