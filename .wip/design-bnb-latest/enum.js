// A full enumeration of the rule, for small pools: every parlay the legs make (any size from 2, one option a game:
// nothing, a leg, or a group of the game's legs that go together), each option's figures by the builder's own sums
// (parlayProb, parlayDec: the GHK sum on three legs or more), then the rule applied by brute force. Its own ranks,
// ceiling, band and order: it shares nothing with search2.js but the page's sums. Page code.
'use strict';
const PAGE_ENUM = String.raw`
window.ENUMR = (() => {
  const cmpSk = (a, b) => a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0;
  function level(legs, F, tol) {
    tol = tol == null ? 0.005 : tol;
    const hold = S.corr.hold, by = new Map();
    for (const l of legs) { const d = amToDec(l.price); if (!(d > 1) || !(l.p > 0 && l.p < 1)) continue;
      const x = { l, sk: l.sk || slipKey(l), gid: l.gid || l.id, p: l.p, d, e: l.p * d, side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', pid: l.kind === 'prop' ? String(l.pid) : null };
      if (!by.has(x.gid)) by.set(x.gid, []); by.get(x.gid).push(x); }
    const games = [...by].sort((a, b) => a[0] < b[0] ? -1 : 1).map(([gid, xs]) => ({ gid, xs: xs.sort((a, b) => (b.p - a.p) || cmpSk(a, b)) }));
    let rk = 0; for (const g of games) for (const x of g.xs) x.rk = rk++;
    const ok = (T, x) => !T.some(y => (x.pid && y.pid === x.pid) || (x.side && y.side) || (x.tot && y.tot));
    /* each game's options: nothing, every leg, every group that goes together, with the builder's own figures */
    const opts = games.map(g => {
      const out = [{ T: [], p: 1, d: 1 }];
      const rec = (i0, T) => { for (let i = i0; i < g.xs.length; i++) { const x = g.xs[i]; if (!ok(T, x)) continue; const T2 = [...T, x];
        let p, d; if (T2.length === 1) { p = x.p; d = x.d; } else { const L = T2.map(y => y.l); p = parlayProb(L).corr; d = parlayDec(L.map(l => ({ leg: l, ml: l.price }))); }
        out.push({ T: T2, p, d }); rec(i + 1, T2); } };
      rec(0, []); return out;
    });
    /* the ceiling, on its own: one leg a game over every set of 2 games or more whose dearest legs reach F (their best
       returns over F, or their likeliest legs, the less), and a game's legs together (HOLD over F, or its second-likeliest
       leg, the less) where its legs that go together with the other games' dearest reach F */
    const eM = games.map(g => g.xs.reduce((m, x) => Math.max(m, x.e), 0)), dM = games.map(g => g.xs.reduce((m, x) => Math.max(m, x.d), 0)), pM = games.map(g => g.xs[0].p);
    let C = 0; const m = games.length;
    for (let s = 0; s < (1 << m); s++) { let k = 0, D = 1, E = 1, P = 1; for (let i = 0; i < m; i++) if (s >> i & 1) { k++; D *= dM[i]; E *= eM[i]; P *= pM[i]; }
      if (k >= 2 && D >= F - 1e-9) C = Math.max(C, Math.min(E / F, P)); }
    games.forEach((g, i) => { if (!g.xs.some((a, ia) => g.xs.some((b, ib) => ib > ia && ok([a], b)))) return;
      const best = new Map(); for (const x of g.xs) { const k = x.pid ? 'p' + x.pid : x.side ? 'side' : x.tot ? 'tot' : x.sk; best.set(k, Math.max(best.get(k) || 0, x.d)); }
      let D = [...best.values()].reduce((t, v) => t * v, 1); games.forEach((h, j) => { if (j !== i) D *= dM[j]; });
      if (D >= F - 1e-9) C = Math.max(C, Math.min(hold / F, g.xs[1].p)); });
    /* every parlay */
    const all = []; const pick = [];
    const go = (j, P, D, n) => { if (j === games.length) { if (n >= 2 && D >= F - 1e-9) { const legs = pick.flatMap(o => o.T); all.push({ p: P, d: D, n, legs, ranks: legs.map(x => x.rk).sort((a, b) => a - b) }); } return; }
      for (const o of opts[j]) { pick.push(o); go(j + 1, P * o.p, D * o.d, n + o.T.length); pick.pop(); } };
    go(0, 1, 1, 0);
    if (!all.length) return { why: 'none', count: 0, C };
    const Ps = Math.max(...all.map(q => q.p)), nearC = all.some(q => q.p >= (1 - tol) * C);
    const T = nearC ? (1 - tol) * C : (1 - tol) * Ps, band = all.filter(q => q.p >= T);
    const lex = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] - b[i]; return a.length - b.length; };
    band.sort((a, b) => (a.n - b.n) || lex(a.ranks, b.ranks));
    return { kind: nearC ? 'ceiling' : 'best', C, Ps, level: band[0], count: all.length, band: band.length };
  }
  return { level };
})();
`;
module.exports = { PAGE_ENUM };
