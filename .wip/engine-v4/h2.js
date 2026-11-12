const fs = require('fs');
const { boot } = require('./boot.js');
const CODE = fs.readFileSync(__dirname + '/ruler_pool.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/ruler_search.js', 'utf8') + '\nwindow.__R = { spRulerPool, spRulerLevel, spRulerClean, sprPrep, sprSingles, sprTabs };';
(async () => {
  const w = await boot({ page: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng/index.html', site: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/alt/site', now: '2026-11-10T21:57:09Z', repo: '/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng' });
  w.eval(CODE);
  console.log(w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); const pool = __R.spRulerPool(N, {});
    const X = __R.sprPrep(pool.legs), Gs = X.games.filter(g => g.fr.length);
    const P0 = __R.sprTabs(Gs, 5, 'pMax'), E0 = __R.sprTabs(Gs, 5, 'eMax'), D0 = __R.sprTabs(Gs, 5, 'dMax');
    return JSON.stringify({ games: X.games.map(g => [g.gid, g.n, g.fr.length, g.pMax, g.eMax, g.dMax, g.maxLegs]), P0: P0[0], E0: E0[0], D0: D0[0] }, null, 1);
  })()`));
  process.exit(0);
})();
