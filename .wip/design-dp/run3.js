// every filter case on 10 Nov's pre-lock night, whole and cut to one and two games: each level's time and answer
const path = require('path'); const { boot } = require('./boot');
const FILT = { all: {}, players: { k: { ml: false, ats: false, total: false } }, teams: { k: { over: false, under: false } },
  oversOnly: { k: { ml: false, ats: false, total: false, under: false } }, noUnders: { k: { under: false } }, short300: { short: -300 }, short200: { short: -200 } };
(async () => {
  const site = path.resolve(__dirname, '../../alt/site');
  const w = await boot({ site, now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js')); w.eval(require(process.env.DPF || './dp3.js'));
  const games = w.eval(`spTakes().find(n => n.id === '2027_20261110_NIGHT').games.filter(spToTip).map(g => g.id)`);
  const cuts = { night: null };
  const only1 = process.env.ONE ? process.env.ONE.split(',') : games;
  for (const g of only1) cuts['1:' + g.slice(-7)] = [g];
  for (const pair of (process.env.TWO || 'MIL_NYK+BOS_PHI,OKC_POR+ORL_SAC,LAC_PHX+MIA_UTA').split(',')) cuts['2:' + pair] = pair.split('+').map(s => games.find(g => g.endsWith(s)));
  const fsel = (process.env.F || Object.keys(FILT).join(',')).split(','), csel = process.env.CUTS ? process.env.CUTS.split(',') : Object.keys(cuts);
  const rows = [];
  for (const cut of csel) for (const fname of fsel) {
    const u = Object.assign({}, FILT[fname]); if (cuts[cut]) u.off = games.filter(g => !cuts[cut].includes(g));
    const out = w.eval(`(() => {
      const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
      const P = dpPool(N, ${JSON.stringify(u)});
      const X = DP.prep(P.legs), res = { n: P.legs.length, lv: [] }; let tot = 0;
      for (const F of [2, 4, 8]) { SG_CACHE.clear();
        const r = DP.level(X, F, { budget: ${process.env.BUDGET || 3e6} }); tot += r.ms;
        res.lv.push({ F, ms: +r.ms.toFixed(1), why: r.why, ph: r.phase, n: r.res ? r.res.n : 0, cF: r.res ? +(r.res.c * F).toFixed(5) : null, d: r.res ? +r.res.d.toFixed(3) : null, log: r.log.join('; ') });
      }
      res.tot = +tot.toFixed(1); res.stats = X.stats; return res;
    })()`);
    const line = `${cut.padEnd(12)} ${fname.padEnd(10)} legs ${String(out.n).padStart(4)}  total ${String(out.tot).padStart(8)} ms  ` + out.lv.map(l => `F${l.F}: ${l.ms}ms ${l.n ? l.n + 'L ' + l.cF + '/F' : 'none'} [${l.why}${l.ph === 'groups' ? ', groups' : ''}]`).join('  ') + `  {pairs ${out.stats.pairs} grp ${out.stats.grp}/${out.stats.grpSeen} ghk ${out.stats.ghk} nodes ${out.stats.nodes}}`;
    console.log(line);
    if (process.env.LOG) for (const l of out.lv) console.log('    F' + l.F + ': ' + l.log);
  }
  process.exit(0);
})();
