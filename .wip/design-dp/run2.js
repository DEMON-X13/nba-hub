const path = require('path'); const { boot } = require('./boot');
const CASES = { all: {}, players: { k: { ml: false, ats: false, total: false } }, teams: { k: { over: false, under: false } },
    oversOnly: { k: { ml: false, ats: false, total: false, under: false } }, noUnders: { k: { under: false } }, short300: { short: -300 }, short200: { short: -200 } };
(async () => {
  const site = path.resolve(__dirname, '../../alt/site');
  const w = await boot({ site, now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js')); w.eval(require('./dp.js'));
  const only = (process.env.ONLY || '').split(',').filter(Boolean), lv = (process.env.LV || '2,4,8').split(',').map(Number);
  for (const [name, u] of Object.entries(CASES)) {
    if (only.length && !only.includes(name)) continue;
    for (const F of lv) {
      const out = w.eval(`(() => {
        const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
        const P = dpPool(N, ${JSON.stringify(u)});
        const X = DP.prep(P.legs);
        const r = DP.level(X, ${F}, { tri: ${process.env.TRI === '0' ? 'false' : 'true'}, budget: ${process.env.BUDGET || 2e6} });
        return { n: P.legs.length, ms: +r.ms.toFixed(1), why: r.why, phase: r.phase, best: r.res ? { n: r.res.n, cF: +(r.res.c * ${F}).toFixed(6), d: +r.res.d.toFixed(4), ids: r.res.ids.split(',').map(s => s.split('|').slice(1, 5).join('|')).join(' + ') } : null, log: r.log.join('; '), stats: r.stats };
      })()`);
      console.log(name, 'F' + F, JSON.stringify(out));
    }
  }
  process.exit(0);
})();
