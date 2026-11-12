const fs = require('fs');
const { boot } = require('./boot.js');
const CODE = fs.readFileSync(__dirname + '/ruler_pool.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/ruler_search.js', 'utf8') + '\nwindow.__R = { spRulerPool, spRulerLevel, spRulerClean, sprPrep, sprSingles };';
(async () => {
  const w = await boot({ page: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng/index.html', site: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/alt/site', now: '2026-11-10T21:57:09Z', repo: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng' });
  w.eval(CODE);
  const filt = process.argv[2] ? JSON.parse(process.argv[2]) : {};
  const out = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const t0 = performance.now(); const pool = __R.spRulerPool(N, ${JSON.stringify(filt)}); const tp = performance.now() - t0;
    const res = { legs: pool.legs.length, tp: +tp.toFixed(1), counts: { band: pool.band, vig: pool.vig, noId: pool.noId, filt: pool.filt, pl: pool.pl } };
    for (const F of [2, 4, 8]) { SG_CACHE.clear(); const t1 = performance.now(); const r = __R.spRulerLevel(pool, F); const ms = performance.now() - t1;
      res['F' + F] = { ms: +ms.toFixed(1), settled: r.settled, why: r.why, n: r.n, p: r.p, d: r.d, bound: r.bound, boundK: r.boundK, exact: r.exact, legs: r.legs && r.legs.map(l => l.name + ' ' + l.label + ' ' + l.price), work: r.work, log: (r.log || []).slice(0, 30).join(' ') }; }
    return res; })()`);
  console.log(JSON.stringify(out, null, 1));
  process.exit(0);
})();
