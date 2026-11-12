// The search against a full enumeration of the rule on small pools drawn from 10 November's real legs
const { boot } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH2 } = require('./search2');
const { PAGE_ENUM } = require('./enum');
(async () => {
  const w = await boot({ data: require('path').resolve(__dirname, '..', '..', 'alt', 'site'), now: '2026-11-10T21:57:09Z' });
  w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2); w.eval(PAGE_ENUM);
  const trials = +(process.argv[2] || 40), seed0 = +(process.argv[3] || 1);
  const r = w.eval(`(() => {
    const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
    const P = bnbPoolFair(N, {}); const byG = {}; for (const l of P.legs) (byG[l.gid] = byG[l.gid] || []).push(l);
    const gids = Object.keys(byG).sort();
    let s = ${seed0}; const rnd = () => { s = (s * 1103515245 + 12345) % 2147483648; return s / 2147483648; };
    const out = { agree: 0, differ: [], trials: 0, msS: 0, msE: 0, kinds: {} };
    for (let t = 0; t < ${trials}; t++) {
      const ng = 1 + Math.floor(rnd() * 3), per = ng === 1 ? 6 + Math.floor(rnd() * 4) : ng === 2 ? 4 + Math.floor(rnd() * 3) : 3 + Math.floor(rnd() * 2);
      const gs = [...gids].sort(() => rnd() - 0.5).slice(0, ng), legs = [];
      for (const g of gs) { const L = [...byG[g]].sort(() => rnd() - 0.5).slice(0, per); legs.push(...L); }
      const F = [2, 3, 4, 6, 8][Math.floor(rnd() * 5)], tol = rnd() < 0.5 ? 0.005 : 0.03;
      SG_CACHE.clear();
      const t0 = performance.now(), a = BNB2.level(legs, F, { tol }), t1 = performance.now(), b = ENUMR.level(legs, F, tol), t2 = performance.now();
      out.msS += t1 - t0; out.msE += t2 - t1; out.trials++;
      const ka = a.legs ? a.legs.map(l => l.sk).sort().join(',') : 'none', kb = b.level ? b.level.legs.map(x => x.sk).sort().join(',') : 'none';
      out.kinds[(b.kind || 'none') + ':' + (a.kind || 'none')] = (out.kinds[(b.kind || 'none') + ':' + (a.kind || 'none')] || 0) + 1;
      if (ka === kb) out.agree++; else out.differ.push({ t, ng, per, F, tol, search: { kind: a.kind, n: a.n0, p: a.p, d: a.d, ranks: a.ranks, why: a.why }, enumr: { kind: b.kind, n: b.level && b.level.n, p: b.level && b.level.p, d: b.level && b.level.d, ranks: b.level && b.level.ranks, C: b.C, Ps: b.Ps, count: b.count, band: b.band } });
    }
    return out;
  })()`);
  console.log(JSON.stringify(r, null, 1));
  process.exit(0);
})();
