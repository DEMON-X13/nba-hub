const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH2 } = require('./search2');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2);
  const cut = process.argv[2] ? process.argv[2].split(',') : null, filt = process.argv[3] ? JSON.parse(process.argv[3]) : {};
  const r = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = bnbPoolFair(N, ${JSON.stringify(filt)}); const cut = ${JSON.stringify(cut)};
    const legs = cut ? P.legs.filter(l => cut.some(c => l.gid.endsWith(c))) : P.legs; const out = { legs: legs.length };
    for (const F of [2, 4, 8]) { SG_CACHE.clear(); const z = BNB2.level(legs, F, { cap: 3e6 });
      out[F] = { ms: z.ms, kind: z.kind, n0: z.n0, p: z.p && +z.p.toFixed(6), d: z.d && +z.d.toFixed(4), C: z.C && +z.C.toFixed(6), Ps: z.Ps && +z.Ps.toFixed(6), capped: z.capped, nodes: z.nodes, orth: z.orth, ghk: z.ghk, why: z.why, log: JSON.stringify(z.log), legs: z.legs && z.legs.map(l => l.name + ' ' + l.label + ' ' + l.price).join(' | ') }; }
    return out;
  })()`);
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
