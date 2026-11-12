// quick look: per filter case, the best cross-game 2- and 3-leg singles parlays at each level, against 1/F and R_max/F
const path = require('path'); const { boot } = require('./boot');
(async () => {
  const site = path.resolve(__dirname, '../../alt/site');
  const w = await boot({ site, now: '2026-11-10T21:57:09Z' });
  w.eval(require('./pool.js'));
  const cases = { all: {}, players: { k: { ml: false, ats: false, total: false } }, teams: { k: { over: false, under: false } },
    oversOnly: { k: { ml: false, ats: false, total: false, under: false } }, noUnders: { k: { under: false } }, short300: { short: -300 }, short200: { short: -200 } };
  for (const [name, u] of Object.entries(cases)) {
    const out = w.eval(`(() => {
      const N = spTakes().find(n => n.id === '2027_20261110_NIGHT');
      const P = dpPool(N, ${JSON.stringify(u)});
      const L = P.legs.map(l => ({ g: l.gid, p: l.p, d: amToDec(l.price), k: l.kind + (l.side==='under'?'U':l.side==='over'&&l.kind==='prop'?'O':'') }));
      const res = { n: L.length };
      for (const F of [2, 4, 8]) {
        let b2 = 0, b3 = 0, b2x = null, b3x = null;
        for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const x = L[i], y = L[j]; if (x.g === y.g) continue;
          const d = x.d * y.d, c = x.p * y.p; if (d >= F - 1e-9 && c > b2) { b2 = c; b2x = [x.k, y.k, d.toFixed(4)]; } }
        // triples: for each pair, best third by brute force over a sorted list (prototype: O(n^2 * n) capped)
        if (L.length <= 400 || F === 8) {
          const srt = [...L].sort((a, b) => a.d - b.d);
          for (let i = 0; i < L.length; i++) for (let j = i + 1; j < L.length; j++) { const x = L[i], y = L[j]; if (x.g === y.g) continue;
            const cp = x.p * y.p; if (cp <= b3) continue; const t = F / (x.d * y.d);
            // first index with d >= t
            let lo = 0, hi = srt.length; while (lo < hi) { const m = (lo + hi) >> 1; if (srt[m].d >= t - 1e-12) hi = m; else lo = m + 1; }
            for (let q = lo; q < srt.length; q++) { const z = srt[q]; if (z.g === x.g || z.g === y.g) continue; const c = cp * z.p; if (z.d * x.d * y.d < F - 1e-9) continue; if (c > b3) { b3 = c; b3x = [x.k, y.k, z.k, (z.d*x.d*y.d).toFixed(4)]; } if (cp * (1 / z.d) < b3) break; }
          }
        }
        res['F' + F] = { b2: +(b2 * F).toFixed(5), b2x, b3: +(b3 * F).toFixed(5), b3x };
      }
      res.rmax = Math.max(...L.map(x => x.p * x.d));
      return res;
    })()`);
    console.log(name, JSON.stringify(out));
  }
  process.exit(0);
})();
