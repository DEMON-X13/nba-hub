// the ruler search on 10 Nov's pre-lock night at each filter case: night, single games, pairs
const fs = require('fs');
const { boot } = require('./boot.js');
const CODE = fs.readFileSync(__dirname + '/ruler_pool.js', 'utf8') + '\n' + fs.readFileSync(__dirname + '/ruler_search.js', 'utf8') + '\nwindow.__R = { spRulerPool, spRulerLevel, spRulerClean };';
const FILTERS = { def: {}, players: { k: { ml: false, ats: false, total: false } }, teams: { k: { over: false, under: false } },
  overs: { k: { ml: false, ats: false, total: false, under: false } }, nounders: { k: { under: false } }, s300: { short: -300 }, s200: { short: -200 } };
(async () => {
  const w = await boot({ page: '../eng/index.html', site: '../../alt/site', now: '2026-11-10T21:57:09Z', repo: '../eng' });
  w.eval(CODE);
  const only = process.argv[2] ? process.argv[2].split(',') : Object.keys(FILTERS);
  const cutsArg = process.argv[3] || 'night';
  const work = process.argv[4] ? +process.argv[4] : undefined;
  const gids = JSON.parse(w.eval(`JSON.stringify(spTakes().find(n => n.id === '2027_20261110_NIGHT').games.map(g => g.id))`));
  const cuts = [];
  if (cutsArg === 'night' || cutsArg === 'all') cuts.push(['night', []]);
  if (cutsArg === 'one' || cutsArg === 'all') for (const g of gids) cuts.push([g.slice(14), gids.filter(x => x !== g)]);
  if (cutsArg === 'two' || cutsArg === 'all') for (let i = 0; i < gids.length; i++) for (let j = i + 1; j < gids.length; j++) cuts.push([gids[i].slice(14) + '+' + gids[j].slice(14), gids.filter(x => x !== gids[i] && x !== gids[j])]);
  const rows = [];
  for (const f of only) for (const [cname, off] of cuts) {
    const filt = { ...FILTERS[f], off };
    const r = JSON.parse(w.eval(`(() => { const N = spTakes().find(n => n.id === '2027_20261110_NIGHT'); const pool = __R.spRulerPool(N, ${JSON.stringify(filt)}); const out = { legs: pool.legs.length };
      for (const F of [2, 4, 8]) { const t1 = performance.now(); const r = __R.spRulerLevel(pool, F, ${work == null ? 'undefined' : `{ work: ${work} }`}); out['F' + F] = { ms: +(performance.now() - t1).toFixed(1), st: r.settled, why: r.why, n: r.n, p: r.p, d: r.d, w: Math.round(r.work.used), gap: r.gap, k: r.k, ex: r.exact, log: (r.log || []).join(' '), wk: JSON.stringify(r.work) }; }
      return JSON.stringify(out); })()`));
    rows.push([f, cname, r]);
    const fmt = x => `${x.st ? '' : 'U(' + x.why + (x.gap != null ? ' g' + (x.gap * 100).toFixed(2) + '%' : '') + ') '}${x.n || '-'}L ${x.p ? (x.p * 100).toFixed(2) : '-'}% @${x.d ? x.d.toFixed(3) : '-'} ${x.ms}ms w${x.w}`;
    console.log(`${f.padEnd(8)} ${cname.padEnd(16)} ${String(r.legs).padStart(4)} | ${fmt(r.F2)} | ${fmt(r.F4)} | ${fmt(r.F8)}`);
    if (process.env.V) for (const F of ['F2', 'F4', 'F8']) console.log('   ', F, r[F].log, r[F].wk);
  }
  fs.writeFileSync(__dirname + '/h1_out.json', JSON.stringify(rows));
  process.exit(0);
})();
