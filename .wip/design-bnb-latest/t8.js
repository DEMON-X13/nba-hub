const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH2 } = require('./search2');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2);
  const r = w.eval(`(() => { const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); const P = bnbPoolFair(N, {k:{under:false}});
    const X = BNB2.prep(P.legs); const T = BNB2.tables(X, 8, true);
    return { games: X.games.map(g => ({ gid: g.gid.slice(14), n: g.n, eMax: +g.eMax.toFixed(4), EG: Array.from(g.EG || []).map(v => +v.toFixed(3)),
       mP: [Math.max(...g.xs.filter(x=>x.pid).map(x=>x.mP||0)).toFixed(3)], mA: [Math.max(...g.xs.map(x=>x.mA||0)).toFixed(3)],
       eTop: g.xs.map(x=>x.e).sort((a,b)=>b-a).slice(0,6).map(v=>+v.toFixed(3)) })),
      EK: Array.from(T.EK[0]).map(v=>+v.toFixed(4)), PK: Array.from(T.PK[0]).map(v=>+v.toFixed(4)), DK: Array.from(T.DK[0]).map(v=>+v.toFixed(2)) };
  })()`);
  console.log(JSON.stringify(r, null, 0));
  process.exit(0);
})();
