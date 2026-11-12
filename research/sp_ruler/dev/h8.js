const fs = require('fs');
const { boot } = require('./boot.js');
const CODE = fs.readFileSync(__dirname + '/ruler_pool.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/ruler_search.js', 'utf8') + '\nwindow.__R = { spRulerPool };';
(async () => {
  const w = await boot({ page: '../eng/index.html', site: '../../alt/site', now: '2026-11-10T21:57:09Z', repo: '../eng' });
    const filt = process.argv[2] || '{}', F = +(process.argv[3] || 8), k = +(process.argv[4] || 4), runs = JSON.parse(process.argv[5] || '[]');
  console.log(w.eval(CODE + `
;(() => { const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); const pool = __R.spRulerPool(N, ${filt});
    const X = sprPrep(pool.legs), Fe = ${F} - SP_FLOOR_EPS, A = Math.log(Fe), NC = SPR_CELLS, W = { used: 0, budget: 1e12 };
    const C = { X, F: ${F}, Fe, A, NC, dl: A / NC, K: 0, gr: true, W, log: [], TH: Math.max(SPR_THMIN, SPR_THK / ${F}), sp: new Set(), se: new Set(), sg: new Set(), cc: new Set(), gv: new Map(), hg: new Map(), qb: null };
    C.K = 8; C.B = sprTable(C, 8); C.R = sprRet(C, 8, false); C.R0 = sprRet(C, 8, true);
    const out = ['setup ' + Math.round(W.used)];
    for (const [th, near, any] of ${JSON.stringify(runs)}) { const u0 = W.used, t0 = performance.now(); const r = sprQ(C, ${k}, th, near, any, 1);
      out.push(th + (any ? ' any' : ' near') + ' -> ' + (r.best ? r.best.c.toPrecision(6) : '-') + ' w' + Math.round((W.used - u0) / 1e3) + 'k ' + Math.round(performance.now() - t0) + 'ms'); }
    return out.join('\\n'); })()`));
  process.exit(0);
})();
