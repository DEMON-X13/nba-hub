const { boot } = require('./boot.js');
(async () => {
  const w = await boot({ page: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng/index.html', site: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/alt/site', now: '2026-11-10T21:57:09Z', repo: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng' });
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); if (!N) return {err: 'no night', takes: spTakes().map(n=>n.id)};
    const pool = spPool(N);
    const byKind = {}; for (const l of pool.legs) { const k = l.kind === 'prop' ? 'prop-' + l.side : l.kind; byKind[k] = (byKind[k]||0)+1; }
    const games = [...new Set(pool.legs.map(l => l.gid))];
    const rhoKeys = Object.keys(S.corr.rho); const rv = rhoKeys.map(k => S.corr.rho[k]).sort((a,b)=>b-a);
    // fair chances for every leg
    const fairs = pool.legs.map(l => { const f = legFair(l); return { k: l.kind, s: l.side, price: l.price, odds: l.odds, other: l.other, p: l.p, f: f && f.p, e: f ? f.p * amToDec(l.price) : null, I: propImplied(l.price), d: amToDec(l.price) }; });
    const eU = fairs.filter(x => x.k === 'prop' && x.s === 'under').map(x => x.e);
    const eO = fairs.filter(x => x.k === 'prop' && x.s === 'over').map(x => x.e);
    const eT = fairs.filter(x => x.k !== 'prop').map(x => x.e);
    const st = a => a.length ? { n: a.length, min: Math.min(...a), max: Math.max(...a), mean: a.reduce((s,v)=>s+v,0)/a.length } : null;
    const exact = fairs.filter(x => x.k === 'prop' && x.s === 'under').filter(x => x.f !== x.I).length;
    return { N: { id: N.id, games: N.games.map(g=>g.id+' '+g.tip), tip: N.tip }, legs: pool.legs.length, byKind, games, hold: S.corr.hold, nRho: rhoKeys.length, rhoTop: rv.slice(0,8), rhoBot: rv.slice(-8), eU: st(eU), eO: st(eO), eT: st(eT), underFairNeImplied: exact, eUmax: Math.max(...eU), sampleU: fairs.filter(x=>x.k==='prop'&&x.s==='under').slice(0,3) };
  })()`);
  console.log(JSON.stringify(out, null, 1));
  console.log('errs', w.__errs.slice(0, 3));
  process.exit(0);
})();
