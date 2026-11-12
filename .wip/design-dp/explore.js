const path = require('path'); const { boot } = require('./boot');
(async () => {
  const site = path.resolve(__dirname, '../../alt/site');
  const w = await boot({ site, now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js'));
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = dpPool(N, {});
    const legs = P.legs.map(l => { const d = amToDec(l.price); return { gid: l.gid.slice(-7), kind: l.kind, side: l.side, price: l.price, p: l.p, d, r: l.p * d }; });
    const by = {}; for (const l of legs) { const k = l.gid; (by[k] = by[k] || { n: 0, under: 0, over: 0, team: 0, rmax: 0 }); by[k].n++; if (l.kind === 'prop') by[k][l.side]++; else by[k].team++; }
    const unders = legs.filter(l => l.kind === 'prop' && l.side === 'under');
    const rs = legs.map(l => l.r).sort((a,b)=>b-a);
    const hist = (arr, f) => { const h = {}; for (const x of arr) { const k = f(x); h[k] = (h[k]||0)+1; } return h; };
    return { cnt: P.cnt, n: legs.length, by, unders: unders.length,
      underR: hist(unders, l => (l.r - 1).toExponential(0)),
      teamR: legs.filter(l => l.kind !== 'prop').map(l => l.kind + ' ' + l.price + ' r=' + l.r.toFixed(4)),
      overR: hist(legs.filter(l => l.kind==='prop'&&l.side==='over'), l => l.r.toFixed(2)),
      underPrice: hist(unders, l => l.price < -400 ? '<-400' : l.price < -300 ? '-400..-301' : l.price < -200 ? '-300..-201' : l.price < -150 ? '-200..-151' : l.price < -110 ? '-150..-111' : l.price < 0 ? '-110..-100' : '+100..'),
      dRange: [Math.min(...legs.map(l=>l.d)), Math.max(...legs.map(l=>l.d))] };
  })()`);
  console.log(JSON.stringify(out, null, 1));
  console.log(w.__errs.slice(0,3));
  process.exit(0);
})();
