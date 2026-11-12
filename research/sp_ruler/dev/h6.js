const fs = require('fs');
const { boot } = require('./boot.js');
const CODE = fs.readFileSync(__dirname + '/ruler_pool.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/ruler_search.js', 'utf8') + '\nwindow.__R = { spRulerPool, spRulerLevel, spRulerClean, sprPrep, sprGv, sprHg, sprHW, sprGvAt };';
(async () => {
  const w = await boot({ page: '../eng/index.html', site: '../../alt/site', now: '2026-11-10T21:57:09Z', repo: '../eng' });
  w.eval(CODE);
  const filt = process.argv[2] || '{}', F = +(process.argv[3] || 8), work = +(process.argv[4] || 4e6), keep = process.argv[5] || '';
  console.log(w.eval(`(() => { const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); const f0 = ${filt}; if (${JSON.stringify(keep)}) f0.off = N.games.map(g => g.id).filter(id => !${JSON.stringify(keep)}.split('+').some(k => id.endsWith(k))); const pool = __R.spRulerPool(N, f0);
    const t0 = performance.now(); const r = __R.spRulerLevel(pool, ${F}, { work: ${work}, dbg: 1 }); r.work.dbg = r.dbg; const ms = performance.now() - t0;
    return JSON.stringify({ ms: Math.round(ms), why: r.why, st: r.settled, n: r.n, p: r.p, d: r.d, k: r.k, gap: r.gap, log: r.log.join(' '), w: r.work, legs: r.legs && r.legs.map(l => (l.name || l.side) + ' ' + l.kind + ' ' + (l.side||'') + ' ' + (l.stat||'') + ' ' + l.price) }); })()`));
  process.exit(0);
})();
