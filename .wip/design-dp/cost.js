const path = require('path'); const { boot } = require('./boot');
(async () => {
  const site = path.resolve(__dirname, '../../alt/site');
  const w = await boot({ site, now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js'));
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = dpPool(N, {});
    const g = P.legs.filter(l => l.gid.endsWith('MIL_NYK'));
    const un = g.filter(l => l.kind === 'prop' && l.side === 'under');
    const res = {};
    // joint2 cost
    let t0 = performance.now(), s = 0, cnt = 0;
    for (let i = 0; i < un.length; i++) for (let j = i + 1; j < un.length; j++) { if (un[i].pid === un[j].pid) continue; const L = [un[i], un[j]]; s += parlayProb(L).corr; cnt++; }
    res.pairs = { cnt, ms: performance.now() - t0 };
    t0 = performance.now(); cnt = 0;
    for (let i = 0; i < 30; i++) for (let j = i + 1; j < 30; j++) for (let k = j + 1; k < 30; k++) { const L = [un[i], un[j], un[k]]; if (new Set(L.map(x=>x.pid)).size < 3) continue; SG_CACHE.clear(); s += sgJoint(L.map(x=>x.p), L.map(sgLeg)); cnt++; if (cnt >= 200) break; }
    res.tri = { cnt, ms: performance.now() - t0 };
    t0 = performance.now(); cnt = 0;
    outer: for (let i = 0; i < 30; i++) for (let j = i + 1; j < 30; j++) for (let k = j + 1; k < 30; k++) for (let m = k + 1; m < 30; m++) { const L = [un[i], un[j], un[k], un[m]]; if (new Set(L.map(x=>x.pid)).size < 4) continue; SG_CACHE.clear(); s += sgJoint(L.map(x=>x.p), L.map(sgLeg)); cnt++; if (cnt >= 100) break outer; }
    res.quad = { cnt, ms: performance.now() - t0 };
    // rho magnitudes among this game's legs
    let mx = 0, hist = {};
    for (let i = 0; i < g.length; i++) for (let j = i + 1; j < g.length; j++) { if (g[i].pid && g[i].pid === g[j].pid) continue; const r = pbRho(g[i], g[j]); if (r == null) continue; const k = Math.abs(r) < 0.01 ? '<.01' : Math.abs(r) < 0.03 ? '<.03' : Math.abs(r) < 0.1 ? '<.1' : '>=.1'; hist[k] = (hist[k]||0)+1; mx = Math.max(mx, Math.abs(r)); }
    res.rho = { mx, hist };
    res.n = { legs: g.length, unders: un.length };
    return res;
  })()`);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
