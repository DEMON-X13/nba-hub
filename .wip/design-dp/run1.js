const path = require('path'); const { boot } = require('./boot');
(async () => {
  const site = path.resolve(__dirname, '../../alt/site');
  const w = await boot({ site, now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js')); w.eval(require('./dp.js'));
  const cases = { all: {}, players: { k: { ml: false, ats: false, total: false } }, teams: { k: { over: false, under: false } },
    oversOnly: { k: { ml: false, ats: false, total: false, under: false } }, noUnders: { k: { under: false } }, short300: { short: -300 }, short200: { short: -200 } };
  for (const [name, u] of Object.entries(cases)) {
    const out = w.eval(`(() => {
      const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
      const P = dpPool(N, ${JSON.stringify(u)});
      const res = { n: P.legs.length };
      let tot = 0;
      const X = DP.prep(P.legs);
      for (const F of [2, 4, 8]) {
        const t0 = performance.now(); const r = DP.level(X, F); const ms = performance.now() - t0; tot += ms;
        res['F' + F] = { ms: +ms.toFixed(1), why: r.why, best: r.res ? { n: r.res.n, cF: +(r.res.c * F).toFixed(6), d: +r.res.d.toFixed(4), ids: r.res.ids.split(',').map(s => s.split('|').slice(1).join('|')).join(' + ') } : null, log: r.log.join('; ') };
      }
      res.stats = X.stats; res.totMs = +tot.toFixed(1);
      return res;
    })()`);
    console.log('==', name, JSON.stringify(out, null, 1));
  }
  process.exit(0);
})();
