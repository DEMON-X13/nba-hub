// Kirkwood (product of pair lifts) and spOrth against the page's GHK sum, split by whether a team leg is in the group
const path = require('path'); const { boot } = require('./boot');
(async () => {
  const w = await boot({ site: path.resolve(__dirname, '../../alt/site'), now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js'));
  const N = +(process.env.N || 150);
  const out = w.eval(`(() => {
    const NN = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = dpPool(NN, {});
    let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const fit = L => L.every((a, i) => L.every((b, j) => i === j || !((a.pid && a.pid === b.pid) || ((a.kind==='ml'||a.kind==='spread') && (b.kind==='ml'||b.kind==='spread')) || (a.kind==='total'&&b.kind==='total'))));
    const res = { pl3: [], tm3: [], pl4: [], tm4: [] };
    const gids = [...new Set(P.legs.map(l => l.gid))];
    for (const size of [3, 4]) for (const team of [false, true]) {
      let made = 0, tries = 0; const key = (team ? 'tm' : 'pl') + size;
      while (made < (size === 3 ? ${N} : ${Math.round(N/3)}) && tries < 1e5) { tries++;
        const g = P.legs.filter(l => l.gid === gids[Math.floor(rnd() * gids.length)]);
        const pl = g.filter(l => l.kind === 'prop'), tm = g.filter(l => l.kind !== 'prop');
        const SS = [];
        if (team && !tm.length) continue; if (team) SS.push(tm[Math.floor(rnd() * tm.length)]);
        while (SS.length < size) { const x = pl[Math.floor(rnd() * pl.length)]; if (!SS.includes(x)) SS.push(x); }
        const L = sgOrder(SS); if (!fit(L)) continue; made++;
        const LL = L.map(sgLeg), ps = L.map(l => l.p), Is = L.map(l => propImplied(l.price));
        SG_CACHE.clear(); const gP = sgJoint(ps, LL), gJ = sgJoint(Is, LL);
        const kirk = v => { let pr = v.reduce((t, x) => t * x, 1); for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const r = pbRho(L[i], L[j]) || 0; pr *= joint2(v[i], v[j], r) / (v[i] * v[j]); } return pr; };
        const R = LL.map((a, i) => LL.map((b, j) => i === j ? 1 : (rhoFor(S.corr.rho, a, b) || 0)));
        const oP = spOrth(ps.map(p => normInv(1 - p)), R), oJ = spOrth(Is.map(p => normInv(1 - p)), R);
        res[key].push([kirk(ps) / gP - 1, kirk(Is) / gJ - 1, oP / gP - 1, oJ / gJ - 1]);
      }
    }
    return res;
  })()`);
  for (const [k, a] of Object.entries(out)) {
    const q = i => { const v = a.map(r => Math.abs(r[i])).sort((x, y) => x - y); return [v[Math.floor(v.length * 0.5)], v[Math.floor(v.length * 0.99)], v[v.length - 1]].map(x => x.toExponential(1)).join('/'); };
    console.log(k, a.length, 'kirkP med/p99/max', q(0), ' kirkJ', q(1), ' orthP', q(2), ' orthJ', q(3));
  }
  process.exit(0);
})();
