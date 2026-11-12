const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH2 } = require('./search2');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2);
  const filt = process.argv[2] || '{"k":{"under":false}}', cut = process.argv[3] || '', Fs = (process.argv[4] || '2,4,8').split(',').map(Number), cap = +(process.argv[5] || 3e5);
  const r = w.eval(`(() => { const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); const P = bnbPoolFair(N, ${filt});
    const cut = ${JSON.stringify(cut)} ? ${JSON.stringify(cut.split(','))} : null; const legs = cut ? P.legs.filter(l => cut.some(x => l.gid.endsWith(x))) : P.legs; const out = { legs: legs.length };
    for (const F of ${JSON.stringify(Fs)}) { SG_CACHE.clear(); const z = BNB2.level(legs, F, { cap: ${cap} });
      out[F] = { ms: z.ms, kind: z.kind, n0: z.n0, p: z.p, C: z.C, Ps: z.Ps, capped: z.capped, nodes: z.nodes, orth: z.orth, ghk: z.ghk, why: z.why, log: JSON.stringify(z.log), legs: z.legs && z.legs.map(l => l.name + ' ' + l.label + ' ' + l.price).join(' | ') }; }
    return out; })()`);
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
