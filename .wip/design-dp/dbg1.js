const path = require('path'); const { boot } = require('./boot');
(async () => {
  const w = await boot({ site: path.resolve(__dirname, '../../alt/site'), now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js')); w.eval(require('./dp.js'));
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = dpPool(N, { k: { ml: false, ats: false, total: false, under: false } });
    const X = DP.prep(P.legs); X.groupsLive = true; X.maxN = 3;
    const F = 8, Fe = F - 1e-9, th = 0.995 * 0.645992 / 8;
    const res = {};
    for (const g of X.games) { const t = DP.triOf(X, g, th); const best = t.filter(u => u.d >= Fe).sort((a, b) => b.c - a.c).slice(0, 3);
      res[g.gid.slice(-7)] = { tri: t.length, payF: t.filter(u => u.d >= Fe).length, top: best.map(u => [+u.c.toFixed(4), +u.d.toFixed(3), +u.dl.toFixed(3), +u.r.toFixed(3), u.legs.map(x => x.l.price).join('/')]) }; }
    const b = DP.best(X, Fe, 3, th, 1e6);
    res.best3 = b.found ? [b.c * F, b.d, b.ids] : 'none'; res.nodes = b.walk.nodes; res.stats = X.stats;
    return res;
  })()`);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
