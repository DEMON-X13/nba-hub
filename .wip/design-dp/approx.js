// How close is a pairwise (Kirkwood) approximation to the page's GHK sum on groups of 3 and 4 of one game's legs?
const path = require('path'); const { boot } = require('./boot');
(async () => {
  const site = path.resolve(__dirname, '../../alt/site');
  const w = await boot({ site, now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js'));
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = dpPool(N, {});
    const res = { tri: [], quad: [] };
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    for (const gid of ['2027_20261110_MIL_NYK', '2027_20261110_BOS_PHI']) {
      const g = P.legs.filter(l => l.gid === gid);
      for (const size of [3, 4]) {
        let made = 0, tries = 0;
        while (made < (size === 3 ? 60 : 25) && tries < 10000) { tries++;
          const SS = []; while (SS.length < size) { const x = g[Math.floor(rnd() * g.length)]; if (SS.includes(x)) continue; SS.push(x); }
          const L = sgOrder(SS); let ok = true; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) if (slipWhy([pbSlipOf(L[i])], pbSlipOf(L[j]))) ok = false;
          // use the pool's fit rule: one leg a player, one side, one total
          const fits = L.every((a, i) => L.every((b, j) => i === j || !((a.pid && a.pid === b.pid) || ((a.kind==='ml'||a.kind==='spread') && (b.kind==='ml'||b.kind==='spread')) || (a.kind==='total'&&b.kind==='total'))));
          if (!fits) continue; made++;
          const ps = L.map(l => l.p), Is = L.map(l => propImplied(l.price)), LL = L.map(sgLeg);
          SG_CACHE.clear();
          const ghkP = sgJoint(ps, LL), ghkJ = sgJoint(Is, LL);
          const kirk = (v) => { let pr = v.reduce((t, x) => t * x, 1), lift = 1; for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const r = pbRho(L[i], L[j]) || 0; lift *= joint2(v[i], v[j], r) / (v[i] * v[j]); } return pr * lift; };
          const kP = kirk(ps), kJ = kirk(Is);
          const R = LL.map((a, i) => LL.map((b, j) => i === j ? 1 : (rhoFor(S_CORR(), a, b) || 0)));
          const t = ps.map(p => normInv(1 - p)), tI = Is.map(p => normInv(1 - p));
          const oP = size <= 5 ? spOrth(t, R) : null, oJ = size <= 5 ? spOrth(tI, R) : null;
          const maxr = Math.max(...R.flat().map(Math.abs).filter(v => v < 0.999));
          res[size === 3 ? 'tri' : 'quad'].push([+(kP / ghkP - 1).toExponential(2), +(kJ / ghkJ - 1).toExponential(2), oP ? +(oP / ghkP - 1).toExponential(2) : null, +maxr.toFixed(3), L.map(l=>l.kind[0]+(l.side||'')[0]).join('')]);
        }
      }
    }
    return res;
  })()`.replace('S_CORR()', 'S.corr.rho'));
  for (const k of ['tri', 'quad']) {
    const a = out[k]; const mx = i => Math.max(...a.map(r => Math.abs(r[i] || 0)));
    console.log(k, a.length, 'max |kirkP/ghk-1|', mx(0), 'max |kirkJ/ghk-1|', mx(1), 'max |orth/ghk-1|', mx(2));
    console.log(a.slice(0, 12).map(r => r.join(' ')).join('\n'));
  }
  process.exit(0);
})();
