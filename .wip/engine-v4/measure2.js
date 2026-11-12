// GHK (sgJoint, the builder's own sum) against the page's own exact integral (spOrth), at fair and implied thresholds,
// on random fitting groups of 3 to 5 legs from every game of 10 Nov, and the ratio C/J error
const { boot } = require('./boot.js');
(async () => {
  const w = await boot({ page: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng/index.html', site: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/alt/site', now: '2026-11-10T21:57:09Z', repo: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng' });
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const pool = spPool(N);
    const legs = pool.legs.map(l => ({ ...l, p: legFair(l).p }));
    const byG = new Map(); for (const l of legs) { if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(l); }
    let seed = 777; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const fits = (T, x) => !T.some(y => y.sk === x.sk || (x.kind==='prop' && y.kind==='prop' && y.pid === x.pid) || ((x.kind==='ml'||x.kind==='spread') && (y.kind==='ml'||y.kind==='spread')) || (x.kind==='total' && y.kind==='total'));
    const pick = (G, n, mixed) => { for (let tries = 0; tries < 400; tries++) { const T = []; for (let i = 0; i < 600 && T.length < n; i++) { const x = G[Math.floor(rnd() * G.length)]; if (!mixed && !(x.kind === 'prop' && x.side === 'under')) continue; if (fits(T, x)) T.push(x); } if (T.length === n) return T; } return null; };
    const R = { };
    for (const n of [3, 4, 5]) for (const mixed of [false, true]) {
      let maxC = 0, maxJ = 0, maxRatio = 0, cnt = 0, t0 = performance.now();
      const per = n === 3 ? 40 : n === 4 ? 12 : 4;
      for (const G of byG.values()) for (let i = 0; i < per; i++) {
        const T = pick(G, n, mixed); if (!T) continue;
        const L = sgOrder(T), Lg = L.map(sgLeg), Rm = L.map((a,i) => L.map((b,j) => i===j?1:(rhoFor(S.corr.rho, Lg[i], Lg[j])||0)));
        const cG = sgJoint(L.map(l => l.p), Lg), jG = sgJoint(L.map(l => propImplied(l.price)), Lg);
        const cO = spOrth(L.map(l => normInv(1 - l.p)), Rm), jO = spOrth(L.map(l => normInv(1 - propImplied(l.price))), Rm);
        if (cO == null || jO == null) continue;
        cnt++; maxC = Math.max(maxC, Math.abs(cG/cO - 1)); maxJ = Math.max(maxJ, Math.abs(jG/jO - 1)); maxRatio = Math.max(maxRatio, Math.abs((cG/jG)/(cO/jO) - 1));
      }
      R['n' + n + (mixed ? 'mixed' : 'under')] = { cnt, maxRelC: maxC, maxRelJ: maxJ, maxRelRatio: maxRatio, sec: +((performance.now()-t0)/1000).toFixed(1) };
    }
    return R;
  })()`);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
