const { boot } = require('./boot.js');
(async () => {
  const w = await boot({ page: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng/index.html', site: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/alt/site', now: '2026-11-10T21:57:09Z', repo: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng' });
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const pool = spPool(N);
    const legs = pool.legs.map(l => ({ ...l, p: legFair(l).p }));
    const byG = new Map(); for (const l of legs) { if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(l); }
    const g = [...byG.values()][0];
    // random fitting groups of size n, deterministic LCG
    let seed = 12345; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
    const fits = (T, x) => !T.some(y => y.sk === x.sk || (x.kind==='prop' && y.kind==='prop' && y.pid === x.pid) || ((x.kind==='ml'||x.kind==='spread') && (y.kind==='ml'||y.kind==='spread')) || (x.kind==='total' && y.kind==='total'));
    const pick = (G, n) => { for (let tries = 0; tries < 200; tries++) { const T = []; for (let i = 0; i < 400 && T.length < n; i++) { const x = G[Math.floor(rnd() * G.length)]; if (fits(T, x)) T.push(x); } if (T.length === n) return T; } return null; };
    const res = {};
    const t0 = performance.now(); let s = 0;
    for (let i = 0; i < 20000; i++) s += joint2(0.5 + i * 1e-6, 0.6, 0.03);
    res.joint2_us = (performance.now() - t0) / 20000 * 1000;
    for (const n of [3, 4, 5, 6, 8]) {
      const groups = []; for (let i = 0; i < (n <= 4 ? 60 : 20); i++) { const T = pick(g, n); if (T) groups.push(T); }
      SG_CACHE.clear();
      let t1 = performance.now(); const vals = [];
      for (const T of groups) { const L = sgOrder(T); vals.push(sgJoint(L.map(l => l.p), L.map(sgLeg))); }
      const ghkMs = (performance.now() - t1) / groups.length;
      let orthMs = null, maxRel = 0, maxRelJ = 0;
      if (n <= 5) { t1 = performance.now(); const ov = [];
        for (const T of groups) { const L = sgOrder(T), R = L.map((a,i) => L.map((b,j) => i===j?1:(rhoFor(S.corr.rho, sgLeg(a), sgLeg(b))||0))); ov.push(spOrth(L.map(l => normInv(1 - l.p)), R)); }
        orthMs = (performance.now() - t1) / groups.length;
        for (let i = 0; i < groups.length; i++) if (ov[i] != null) maxRel = Math.max(maxRel, Math.abs(vals[i] - ov[i]) / ov[i]);
      }
      res['n' + n] = { groups: groups.length, ghkMs: +ghkMs.toFixed(3), orthMs: orthMs && +orthMs.toFixed(3), ghkVsOrthMaxRel: maxRel };
    }
    return res;
  })()`);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
