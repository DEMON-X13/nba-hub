// the Kirkwood error against GHK, as a function of the group's correlations (sum of |rho| over its pairs), every triple
// of one game's player legs drawn at random, and some with a team leg
const path = require('path'); const { boot } = require('./boot');
(async () => {
  const w = await boot({ site: path.resolve(__dirname, '../../alt/site'), now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js'));
  const t0 = Date.now();
  const out = w.eval(`(() => {
    const NN = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = dpPool(NN, {});
    let seed = 4242; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const fit = L => L.every((a, i) => L.every((b, j) => i === j || !((a.pid && a.pid === b.pid) || ((a.kind==='ml'||a.kind==='spread') && (b.kind==='ml'||b.kind==='spread')) || (a.kind==='total'&&b.kind==='total'))));
    const rows = []; const gids = [...new Set(P.legs.map(l => l.gid))];
    let tries = 0;
    while (rows.length < ${process.env.N || 400} && tries < 1e6) { tries++;
      const g = P.legs.filter(l => l.gid === gids[Math.floor(rnd() * gids.length)]);
      const size = rnd() < 0.7 ? 3 : 4, SS = [];
      while (SS.length < size) { const x = g[Math.floor(rnd() * g.length)]; if (!SS.includes(x)) SS.push(x); }
      const L = sgOrder(SS); if (!fit(L)) continue;
      const LL = L.map(sgLeg), ps = L.map(l => l.p), Is = L.map(l => propImplied(l.price));
      let sr = 0, mx = 0; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const r = Math.abs(pbRho(L[i], L[j]) || 0); sr += r; mx = Math.max(mx, r); }
      SG_CACHE.clear(); const gP = sgJoint(ps, LL);
      let kp = ps.reduce((t, x) => t * x, 1); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const r = pbRho(L[i], L[j]) || 0; kp *= joint2(ps[i], ps[j], r) / (ps[i] * ps[j]); }
      rows.push([size, L.some(l => l.kind !== 'prop') ? 1 : 0, sr, mx, Math.abs(kp / gP - 1)]);
    }
    return rows;
  })()`);
  console.log('rows', out.length, 'in', Date.now() - t0, 'ms');
  // error over (sum |rho|)^2, by group kind
  for (const team of [0, 1]) for (const size of [3, 4]) {
    const a = out.filter(r => r[0] === size && r[1] === team); if (!a.length) continue;
    const ratio = a.map(r => r[4] / Math.max(1e-12, r[2] * r[2])).sort((x, y) => x - y);
    const err = a.map(r => r[4]).sort((x, y) => x - y);
    const big = a.filter(r => r[4] > 1e-5).map(r => `${r[2].toFixed(3)}/${r[3].toFixed(3)}:${r[4].toExponential(1)}`).slice(0, 8).join(' ');
    console.log(`size ${size} team ${team}: n ${a.length}  err med ${err[a.length >> 1].toExponential(1)} max ${err[a.length - 1].toExponential(1)}  err/(sum|rho|)^2 max ${ratio[ratio.length - 1].toExponential(2)} p99 ${ratio[Math.floor(ratio.length * 0.99)].toExponential(2)}   >1e-5: ${big}`);
  }
  process.exit(0);
})();
