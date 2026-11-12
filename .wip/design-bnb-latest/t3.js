const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH } = require('./search');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH);
  const r = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = bnbPoolFair(N, {}); const X = BNB.prep(P.legs); const T = BNB.tables(X, 8, false);
    return { PK: Array.from(T.PK[0]), EK: Array.from(T.EK[0]), DK: Array.from(T.DK[0]), games: X.games.map(g => [g.gid, g.n, g.eMax, g.pS[1]]) };
  })()`);
  console.log(JSON.stringify(r));
  process.exit(0);
})();
