// the variant 'then the likeliest' against OMEGA-first, on one- and two-game cuts of 10 November
const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH2 } = require('./search2');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2);
  const cuts = (process.argv[2] || 'BOS_PHI;LAC_PHX;MIL_NYK;OKC_POR;BOS_PHI,LAC_PHX;MIL_NYK,OKC_POR;ALL').split(';');
  for (const c of cuts) {
    const r = w.eval(`(() => { const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); const P = bnbPoolFair(N, ${process.argv[3] || '{}'});
      const cut = ${JSON.stringify(c)} === 'ALL' ? null : ${JSON.stringify(c.split(','))}; const legs = cut ? P.legs.filter(l => cut.some(x => l.gid.endsWith(x))) : P.legs; const out = [];
      for (const F of [2, 4, 8]) { SG_CACHE.clear(); const a = BNB2.level(legs, F, {}); SG_CACHE.clear(); const b = BNB2.level(legs, F, { pick: 'likeliest' });
        out.push(F + ': omega ' + a.ms + 'ms ' + (a.p * 100).toFixed(3) + '% n' + a.n0 + ' | likeliest ' + b.ms + 'ms ' + (b.p * 100).toFixed(3) + '% n' + b.n0 + ' ghk ' + b.ghk + ' orth ' + b.orth); }
      return out; })()`);
    console.log(c.padEnd(18), r.join('  ||  '));
  }
  process.exit(0);
})();
