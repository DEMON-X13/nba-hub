const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH } = require('./search');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH);
  const r = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = bnbPoolFair(N, {}); const out = { legs: P.legs.length };
    for (const F of [2, 4, 8]) { const z = BNB.level(P.legs, F, {});
      out[F] = { ms: z.ms, n0: z.n0, p: z.best && +z.best.p.toFixed(6), d: z.best && +z.best.d.toFixed(4), L: z.L, U: z.U, gOn: z.gOn, nodes: z.nodes, log: JSON.stringify(z.log), legs: z.best && z.best.legs.map(x => x.l.name + ' ' + x.l.label + ' ' + x.l.price).join(' | ') }; }
    return out;
  })()`);
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
