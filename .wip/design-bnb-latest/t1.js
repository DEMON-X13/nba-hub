const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH } = require('./search');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH);
  const r = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = bnbPoolFair(N, {}); const out = { legs: P.legs.length };
    for (const F of [2, 4, 8]) for (const n of [2, 3, 4]) {
      const X = BNB.prep(P.legs); const t0 = performance.now();
      const r = BNB.size(X, n, F, 0, false, 5e6);
      out[F + ':' + n] = { ms: +(performance.now() - t0).toFixed(1), nodes: r.nodes, done: r.done, p: r.best && +r.best.p.toFixed(6), d: r.best && +r.best.d.toFixed(4), legs: r.best && r.best.legs.map(x => x.l.name + ' ' + x.l.label + ' ' + x.l.price).join(' | ') };
    }
    return out;
  })()`);
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
