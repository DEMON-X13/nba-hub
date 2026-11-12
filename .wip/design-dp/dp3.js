/* THE TOLERANCE SEARCH (design angle B, version 3), a prototype evaluated into the booted page's realm, on the page's own
 * sums. See NOTES.md beside it for the rule, the proof and the timings.
 *
 * A parlay is at most one UNIT a game: a single leg, or a same-game group (two legs or more of one game that go together:
 * one leg a player, one side, one total). Units of different games are independent, so a parlay's chance C and price D
 * are the products of its units' own (the builder's own sums: a single at its chance and price; a group at sgJoint of
 * its legs' chances, and min(the prices multiplied, HOLD / J), J the copula's joint chance of their implied chances).
 *
 * THE RULE (enum.js checks it by brute force on small pools):
 *   V    = every parlay of 2 legs or more of the pool (one unit a game) whose price D >= F - 1e-9;
 *   q(P) = Math.round(C(P) x 1e12), C(P) the product of its units' chances in the order of their game ids;
 *   q*   = max over V of q;   E = { P in V : q(P) >= (1 - TAU) x q* };
 *   the level is the P in E with the fewest legs, then the highest q, then the least ids (its legs' slip keys sorted and
 *   joined by ","), compared as strings; none where V is empty.
 */
module.exports = String.raw`
var DP = (function () {
  const TAU = 0.005, QS = 1e12, KMAX = 12, FE = 1e-9, EPSG = 2e-3, K0 = 5e-6, K2 = 0.2, SMAX = 5, RHO = 1.002, LR = Math.log(RHO);
  const qOf = c => Math.round(c * QS);
  /* ---------- the pool, by game ---------- */
  function prep(legs) {
    const hold = S.corr && S.corr.rho && S.corr.hold ? S.corr.hold : null, byG = new Map();
    for (const l of legs) {
      const d = amToDec(l.price); if (!(d > 1) || !(l.p > 0 && l.p < 1)) continue;
      const x = { l, sk: l.sk, gid: l.gid, pid: l.kind === 'prop' ? String(l.pid) : null, side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', p: l.p, d, I: propImplied(l.price) };
      x.r = x.p * x.d;
      if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(x);
    }
    const games = [...byG.keys()].sort().map((gid, gi) => {
      /* a game's legs likeliest first (then by key): a group is its legs' places in this order, rising, so a group's
         legs to come are never likelier than its last */
      const xs = byG.get(gid).sort((a, b) => (b.p - a.p) || (a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0));
      xs.forEach((x, i) => { x.i = i; x.gi = gi; });
      const singles = xs.map(x => ({ n: 1, c: x.p, d: x.d, dl: x.d, r: x.r, legs: [x] }));
      return { gid, gi, xs, singles, pairs: null, pairAt: null, lv: {}, rho: new Map() };
    });
    return { games, hold, G: games.length, stats: { nodes: 0, cands: 0, pairs: 0, grp: 0, grpSeen: 0, ghk: 0 }, memo: new Map(), live: false, unres: false };
  }
  const fits = (a, b) => a.sk !== b.sk && !(a.pid && a.pid === b.pid) && !(a.side && b.side) && !(a.tot && b.tot);
  const pk = (i, j) => i < j ? i * 4096 + j : j * 4096 + i;
  function rho(g, a, b) { const k = pk(a.i, b.i); let r = g.rho.get(k); if (r === undefined) { r = pbRho(a.l, b.l) || 0; g.rho.set(k, r); } return r; }
  /* a group's own figures by the builder's sums, exactly as parlayProb and slipDec work them (the legs in sgOrder; two
     legs by joint2, more by the GHK sum, cached by the page) */
  function groupFig(X, T) {
    const key = T.map(x => x.sk).sort().join('~'); let f = X.memo.get(key); if (f) return f;
    const L = sgOrder(T.map(x => x.l));
    if (T.length > 2) X.stats.ghk++;
    f = { c: parlayProb(L).corr, d: slipDec(L.map(l => Object.assign({}, l, { odds: l.price }))).dec };
    X.memo.set(key, f); return f;
  }
  /* ---------- groups ----------
     pairs: every two legs of a game that go together, by joint2 at their chances and at their implied ones (the very
     two-leg sums of parlayProb and slipDec), with their lifts (joint over the product) */
  function pairsOf(X, g, theta, rmin) {
    /* (e') a pair's chance is within |rho| / (2 pi sqrt(1 - rho^2)) of its legs' chances multiplied (the copula's
       chance moves with rho at most the bivariate density's peak), above it only where rho > 0, and its implied joint
       chance the same: so a pair whose chance cannot reach theta, or whose return cannot reach rmin, is never worked */
    theta = theta || 0; rmin = rmin || 0;
    if (!g.pairAt) { g.pairAt = new Map(); g.pairs = []; g.pairTheta = Infinity; g.pairRmin = Infinity; }
    if (theta >= g.pairTheta && rmin >= g.pairRmin) return g.pairs;
    const xs = g.xs, H = X.hold;
    for (let i = 0; i < xs.length; i++) { const a = xs[i];
      if (a.p < theta) break;
      for (let j = i + 1; j < xs.length; j++) {
        const b = xs[j]; if (b.p < theta) break;
        const key = pk(i, j); if (g.pairAt.has(key) || !fits(a, b)) continue;
        const r = rho(g, a, b), dlt = Math.abs(r) / (2 * Math.PI * Math.sqrt(Math.max(1e-12, 1 - r * r)));
        const cu = Math.min(a.p, b.p, a.p * b.p + (r > 0 ? dlt : 0)); if (cu < theta) continue;
        const Jl = Math.max(1e-12, a.I * b.I - (r < 0 ? dlt : 0)), mult = a.d * b.d, du = H ? Math.min(mult, H / Jl) : mult;
        if (cu * du < rmin) continue;
        const [s, t] = a.sk < b.sk ? [a, b] : [b, a], c = joint2(s.p, t.p, r), J = joint2(s.I, t.I, r);
        const d = J > 0 && H ? Math.min(mult, H / J) : mult;
        const u = { n: 2, c, d, dl: d, r: c * d, legs: [a, b], idx: [i, j], J, lc: c / (a.p * b.p), lJ: J / (a.I * b.I), sr: Math.abs(r), ck: c, Jk: J, mult };
        g.pairs.push(u); g.pairAt.set(key, u); X.stats.pairs++;
      }
    }
    g.pairTheta = Math.min(g.pairTheta, theta); g.pairRmin = Math.min(g.pairRmin, rmin);
    return g.pairs;
  }
  /* one pair by its places, worked if not yet (null where its legs do not go together) */
  function pairOne(X, g, i, j) {
    if (!g.pairAt) { g.pairAt = new Map(); g.pairs = []; g.pairTheta = Infinity; g.pairRmin = Infinity; }
    const key = pk(i, j); let u = g.pairAt.get(key); if (u !== undefined) return u;
    const a = g.xs[i], b = g.xs[j]; if (!fits(a, b)) { g.pairAt.set(key, null); return null; }
    const r = rho(g, a, b), [s, t] = a.sk < b.sk ? [a, b] : [b, a], c = joint2(s.p, t.p, r), J = joint2(s.I, t.I, r), mult = a.d * b.d;
    const d = J > 0 && X.hold ? Math.min(mult, X.hold / J) : mult;
    u = { n: 2, c, d, dl: d, r: c * d, legs: [a, b], idx: i < j ? [i, j] : [j, i], J, lc: c / (a.p * b.p), lJ: J / (a.I * b.I), sr: Math.abs(r), ck: c, Jk: J, mult };
    g.pairAt.set(key, u); g.pairs.push(u); X.stats.pairs++; return u;
  }
  /* groups of s legs (s >= 3), grown leg by leg from groups of s - 1 that may still be short of the floor (price under
     F: a group paying it is minimal, and every group holding it less likely and longer); each with its chance and its
     implied joint chance by Kirkwood's product (its legs' chances times its pairs' lifts, exact on the pairs), within
     K(S) = K0 + K2 x (the sum of its pairs' |rho|)^2 of the GHK sum (the most the product missed by, on 600 groups of
     three and four of 10 November's legs drawn at random, was 0.083 x that square, and 6e-6 where it was 0), so its
     upper and lower chance and price (cu, cl; du, dl) bound the builder's own; worked by the GHK sum only on ask.
     Kept: those whose upper chance reaches the bar (theta); the rest of each size's groups that may grow are its
     frontier. lv[s] = { theta, units, front } */
  function grow(X, g, s, theta, Fe) {
    const have = g.lv[s];
    if (have && have.theta <= theta) return have;
    const P = pairsOf(X, g, theta, 0), xs = g.xs, n = xs.length, H = X.hold;
    const parents = s === 3 ? P.filter(u => u.c >= theta && u.dl < Fe) : grow(X, g, s - 1, theta, Fe).front;
    const units = [], front = [];
    let lmax = 1, rmx = 0; for (const u of P) { if (u.lc > lmax) lmax = u.lc; if (u.sr > rmx) rmx = u.sr; }
    for (const S of parents) {
      const m = S.idx[S.idx.length - 1], kb = 1 + K0 + K2 * Math.pow(S.sr + rmx * (s - 1), 2);
      for (let x = m + 1; x < n; x++) {
        const lx = xs[x];
        /* the legs to come are no likelier than this one: past the bar for this one, past it for all */
        if (S.ck * lx.p * Math.pow(lmax, s - 1) * kb < theta) break;
        let lc = 1, lJ = 1, sr = S.sr, ok = true;
        for (const y of S.idx) { const pu = pairOne(X, g, y, x); if (!pu) { ok = false; break; } lc *= pu.lc; lJ *= pu.lJ; sr += pu.sr; }
        if (!ok) continue;
        X.stats.grpSeen++;
        const ck = S.ck * lx.p * lc, Jk = S.Jk * lx.I * lJ, K = K0 + K2 * sr * sr, mult = S.mult * lx.d;
        const cu = Math.min(ck * (1 + K), S.cu != null ? S.cu : S.c);
        if (cu < theta) continue;
        const du = H ? Math.min(mult, H / (Jk * (1 - K))) : mult, dl = H ? Math.min(mult, H / (Jk * (1 + K))) : mult;
        const u = { n: s, c: cu, cu, d: du, dl, r: Math.min(H * (1 + EPSG), cu * du), legs: S.legs.concat([lx]), idx: S.idx.concat([x]), ck, Jk, sr, mult, up: true };
        units.push(u); if (dl < Fe) front.push(u);
      }
    }
    X.stats.grp += units.length;
    const out = { theta, units, front }; g.lv[s] = out; return out;
  }
  function exact(X, u) {
    if (!u.up) return u;
    if (!u.ex) { const f = groupFig(X, u.legs); u.ex = { n: u.n, c: f.c, d: f.d, dl: f.d, r: f.c * f.d, legs: u.legs }; }
    return u.ex;
  }
  const idsOf = units => units.flatMap(u => u.legs.map(x => x.sk)).sort().join(',');
  /* ---------- the walk ----------
     every minimal parlay of k legs (k 0: any size from 2) whose chance reaches theta; sink(units, c, d, n) answers a new
     bar (best) or 'stop' (exceed). smax: the largest group taken (groups beyond it are bounded, never taken: where one
     could still reach the bar the walk says so, unres) */
  function walk(X, Fe, theta, k, sink, budget, smax) {
    const G = X.G, rmin = theta * Fe * (1 - 1e-9), H = X.hold ? X.hold * (1 + EPSG) : 0;
    const T = Math.max(1, Math.ceil(Math.log(Fe) / LR) + 2), fidx = v => v <= 1 ? 0 : Math.max(0, Math.min(T, Math.floor(Math.log(v) / LR - 1e-9)));
    let unres = false;
    const games = X.games.map(g => {
      let us = g.singles.filter(u => u.c >= theta);
      let env = null;
      if (X.live && X.hold) {
        for (const u of pairsOf(X, g, theta, rmin)) if (u.c >= theta && u.r >= rmin) us.push(u);
        for (let s = 3; s <= smax; s++) { const lv = grow(X, g, s, theta, Fe); for (const u of lv.units) if (u.c >= theta && u.r >= rmin) us.push(u);
          /* the frontier past smax: a group of more legs could still reach the bar (its legs chance at most the
             frontier's likeliest, at a price d at most H / d): bounded by an envelope, never taken */
          if (s === smax && lv.front.length) { let cm = 0; for (const u of lv.front) if (u.cu > cm) cm = u.cu; env = { cm, from: smax + 1 }; } }
      }
      return { g, us, env };
    });
    /* (f) THE PRICE PROGRAMME: B[j][m][i], at least the most chance a set of units of games j.. with exactly m legs (m 0:
       any number, possibly none) can have at a price of RHO^i or more, from the last game back, each unit at its upper
       chance and price: a unit of price d sits in the grid's cell under it, so with the rest it pays RHO^i only where the
       rest pays over RHO^(i - i_u - 1), and the programme reads the rest there (a lower price: only more chance) */
    const M = k || 0;
    const table = withEnv => {
      const B = [];
      for (let j = 0; j <= G; j++) { const row = []; for (let m = 0; m <= M; m++) row.push(new Float64Array(T + 1)); B.push(row); }
      B[G][0][0] = 1;
      for (let j = G - 1; j >= 0; j--) {
        const cur = B[j], nxt = B[j + 1], gw = games[j];
        for (let m = 0; m <= M; m++) cur[m].set(nxt[m]);
        const cells = new Map(), put = (s, iu, cu) => { const key = (M ? s : 1) * 100000 + iu; const v = cells.get(key); if (v === undefined || cu > v) cells.set(key, cu); };
        for (const u of gw.us) put(u.n, fidx(u.d), u.c);
        /* a group past smax: its chance at most the frontier's likeliest, and at a price d at most H / d (a block of 8
           cells at the block's top price and its bottom's chance: only more) */
        if (withEnv && gw.env) for (let s = gw.env.from; s <= (M || gw.env.from); s++) for (let iu = 0; iu <= T; iu += 8) put(s, Math.min(T, iu + 7), Math.min(gw.env.cm, H / Math.pow(RHO, iu)));
        for (const [key, cu] of cells) {
          const s = Math.floor(key / 100000), iu = key % 100000;
          for (let m = M ? s : 0; m <= M; m++) {
            const src = nxt[M ? m - s : 0], dst = cur[m];
            for (let i = 0; i <= T; i++) { const v = cu * src[i - iu - 1 > 0 ? i - iu - 1 : 0]; if (v > dst[i]) dst[i] = v; }
          }
        }
        if (!M) cur[0][0] = 1;
      }
      return B;
    };
    const hasEnv = games.some(gw => gw.env), B = table(true);
    /* where the groups past smax could still reach the bar the walk cannot rule them out: unresolved (the programme
       with them over the bar at the root, and without them under it) */
    if (hasEnv && B[0][M][fidx(Fe)] >= theta && table(false)[0][M][fidx(Fe)] < theta) unres = true;
    else if (hasEnv && B[0][M][fidx(Fe)] >= theta) unres = 'maybe';
    for (const gw of games) {
      gw.byC = gw.us.slice().sort((a, b) => b.c - a.c); gw.byD = gw.us.slice().sort((a, b) => a.dl - b.dl);
      let rmax = 0, dmax = 1, ratio = 1; for (const u of gw.us) { if (u.r > rmax) rmax = u.r; if (u.d > dmax) dmax = u.d; if (u.dl / u.d < ratio) ratio = u.dl / u.d; }
      gw.rmax = rmax; gw.dmax = dmax; gw.ratio = ratio;
    }
    const Rsuf = new Float64Array(G + 1), Dsuf = new Float64Array(G + 1); Rsuf[G] = 0; Dsuf[G] = 1;
    for (let j = G - 1; j >= 0; j--) { Rsuf[j] = Math.max(Rsuf[j + 1], games[j].rmax); Dsuf[j] = Dsuf[j + 1] * games[j].dmax; }
    let th = theta, nodes = 0, stop = false; const ch = [];
    const lb = (a, t) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].dl >= t) hi = m; else lo = m + 1; } return lo; };
    /* can a unit (chance at most cu, price in [dl, du], return at most ru, un legs) join the branch and still reach the
       bar: as the parlay's last unit (it pays the floor: its chance at most ru over its price), or grown (the programme
       on the rest) */
    const reach = (c, d, n, gi, cu, dl, du, ru, un) => {
      if (c * cu < th) return false;
      if (d * du >= Fe && (!k || n + un === k) && n + un >= 2 && c * ru / Math.max(Fe / d, dl) >= th) return true;
      if (d * dl < Fe && (!k || n + un < k) && c * cu * B[gi + 1][M ? M - n - un : 0][fidx(Fe / (d * du))] >= th) return true;
      return false;
    };
    const take = (u, gi, c, d, n, r) => {
      const c2 = c * u.c, d2 = d * u.d, n2 = n + u.n;
      if (c2 < th) return;
      if (d2 >= Fe) {
        if (k ? n2 !== k : n2 < 2) return;
        X.stats.cands++; ch.push(u); const v = sink(ch, c2, d2, n2); ch.pop();
        if (v === 'stop') stop = true; else if (v > th) th = v; return;
      }
      if (k && n2 >= k) return;
      if (d2 * Dsuf[gi + 1] < Fe || c2 * B[gi + 1][M ? M - n2 : 0][fidx(Fe / d2)] < th) return;
      ch.push(u); rec(gi + 1, c2, d2, n2, r * u.r); ch.pop();
    };
    const tryUnit = (u, gi, c, d, n, r) => {
      if (u.up) { if (!reach(c, d, n, gi, u.c, u.dl, u.d, u.r, u.n)) return; u = exact(X, u); }
      take(u, gi, c, d, n, r);
    };
    const rec = (j, c, d, n, r) => {
      if (stop) return;
      if (++nodes > budget) { stop = 'budget'; return; }
      if (r * Rsuf[j] < th * Fe || d * Dsuf[j] < Fe || c * B[j][M ? M - n : 0][fidx(Fe / d)] < th) return;
      const t = Fe / d;
      for (let gi = j; gi < G && !stop; gi++) {
        const gw = games[gi], bd = gw.byD;
        /* the units that may pay the floor with the branch (upper price at least t), by their lower price from t x ratio
           up (every unit whose upper price reaches t has its lower one there or higher), ending where the most the game
           returns over the lower price cannot reach the bar */
        for (let i = lb(bd, t * gw.ratio); i < bd.length && !stop; i++) {
          const u = bd[i];
          if (c * gw.rmax / u.dl < th) break;
          if (u.d < t || (k && n + u.n > k) || c * u.c < th) continue;
          tryUnit(u, gi, c, d, n, r);
        }
        /* the units that cannot pay it (upper price under t): grown, likeliest first */
        if (stop || (k && n + 1 >= k)) continue;
        const bc = gw.byC;
        for (let ui = 0; ui < bc.length && !stop; ui++) {
          const u = bc[ui];
          if (c * u.c < th) break;
          if (u.d >= t || (k && n + u.n >= k) || d * u.d * Dsuf[gi + 1] < Fe) continue;
          tryUnit(u, gi, c, d, n, r);
        }
      }
    };
    rec(0, 1, 1, 0, 1);
    X.stats.nodes += nodes;
    return { nodes, stop, th, unres };
  }
  /* the exact best parlay of k legs with chance at least theta: the highest q, then the least ids */
  function best(X, Fe, k, theta, budget) {
    let bq = -1, bc = 0, bd = 0, bids = null, bu = null;
    const w = walk(X, Fe, theta, k, (ch, c, d, n) => {
      const q = qOf(c); if (q < bq) return 0;
      const ids = idsOf(ch);
      if (q > bq || ids < bids) { bq = q; bc = c; bd = d; bids = ids; bu = ch.slice(); }
      return (q - 0.5) / QS;
    }, budget, Math.min(k, SMAX));
    return { found: !!bu, c: bc, d: bd, q: bq, ids: bids, units: bu, n: bu ? bu.reduce((t, u) => t + u.n, 0) : 0, walk: w };
  }
  /* is there a parlay (any size from 2) whose (1 - TAU) x q is over q(bar)? the first found, else none (unres where a
     group past SMAX could still be) */
  function exceed(X, Fe, bar, budget) {
    let hit = null; const qb = qOf(bar);
    const w = walk(X, Fe, bar / (1 - TAU) * (1 - 1e-9), 0, (ch, c, d, n) => { if ((1 - TAU) * qOf(c) > qb) { hit = { c, d, n, ids: idsOf(ch) }; return 'stop'; } return 0; }, budget, SMAX);
    return { hit, walk: w };
  }
  /* U: every parlay lands at most its return over F; a parlay's return is at most the two best units' of two games
     (single legs; pairs where live, and any group's HOLD (1 + EPSG)), or one group's alone */
  function bound(X, F) {
    let r1 = 0, r2 = 0, rg = 0;
    for (const g of X.games) {
      let m = 0; for (const u of g.singles) if (u.r > m) m = u.r;
      if (X.live && X.hold && g.xs.length > 1) { const h = X.hold * (1 + EPSG); if (h > m) m = h; if (h > rg) rg = h; }
      if (m > r1) { r2 = r1; r1 = m; } else if (m > r2) r2 = m;
    }
    return Math.max(r1 * r2, rg) / F;
  }
  /* the level at a floor F: first on single legs alone (a night of two games or more); where its best is over HOLD (1 +
     EPSG) / F by more than the tolerance no parlay holding a group can be within the tolerance of it, or be the best, and
     it is the level; else the night's groups join and the walk runs again */
  function level(X, F, opt) {
    opt = opt || {};
    const t0 = performance.now(), hold = X.hold ? X.hold * (1 + EPSG) : 0;
    X.live = false;
    let a = X.G >= 2 ? kloop(X, F, 0, opt) : { res: null, why: 'one game', log: [], L: 0 };
    a.phase = 'singles';
    if (!X.hold || /^budget/.test(a.why) || (1 - TAU) * a.L > hold / F) { a.ms = performance.now() - t0; a.stats = Object.assign({}, X.stats); return a; }
    X.live = true;
    const b = kloop(X, F, a.L, opt);
    b.phase = 'groups'; b.log = a.log.concat(['-- groups --'], b.log);
    b.ms = performance.now() - t0; b.stats = Object.assign({}, X.stats); return b;
  }
  /* U_m, at least the most chance a parlay of exactly m legs can have (m 2 to KMAX): the price programme on a coarse grid
     (RHO 1.01), every unit at its upper figures, groups past SMAX by their envelope */
  function boundsByLegs(X, Fe, theta) {
    const out = new Float64Array(KMAX + 1);
    const w = walkTable(X, Fe, theta);
    for (let m = 2; m <= KMAX; m++) out[m] = w[m];
    return out;
  }
  function walkTable(X, Fe, theta) {
    const RC = 1.01, LC = Math.log(RC), T = Math.max(1, Math.ceil(Math.log(Fe) / LC) + 2), fidx = v => v <= 1 ? 0 : Math.max(0, Math.min(T, Math.floor(Math.log(v) / LC - 1e-9)));
    const H = X.hold ? X.hold * (1 + EPSG) : 0, rmin = theta * Fe * (1 - 1e-9), G = X.G, M = KMAX;
    let nxt = []; for (let m = 0; m <= M; m++) nxt.push(new Float64Array(T + 1)); nxt[0][0] = 1;
    for (let j = G - 1; j >= 0; j--) {
      const g = X.games[j], cur = nxt.map(a => Float64Array.from(a)), cells = new Map();
      const put = (s, iu, cu) => { const key = s * 100000 + iu; const v = cells.get(key); if (v === undefined || cu > v) cells.set(key, cu); };
      for (const u of g.singles) if (u.c >= theta) put(1, fidx(u.d), u.c);
      if (X.live && X.hold && g.xs.length > 1) {
        for (const u of pairsOf(X, g, theta, rmin)) if (u.c >= theta && u.r >= rmin) put(2, fidx(u.d), u.c);
        if (g.xs.length > 2) { let cm = 0; for (const u of pairsOf(X, g, theta, 0)) if (u.c > cm) cm = u.c;
          for (let s = 3; s <= Math.min(M, g.xs.length); s++) for (let iu = 0; iu <= T; iu++) put(s, iu, Math.min(cm, H / Math.pow(RC, iu))); }
      }
      for (const [key, cu] of cells) { const s = Math.floor(key / 100000), iu = key % 100000;
        for (let m = s; m <= M; m++) { const src = nxt[m - s], dst = cur[m]; for (let i = 0; i <= T; i++) { const v = cu * src[i - iu - 1 > 0 ? i - iu - 1 : 0]; if (v > dst[i]) dst[i] = v; } } }
      nxt = cur;
    }
    const i = fidx(Fe); return nxt.map(a => a[i]);
  }
  function kloop(X, F, L0, opt) {
    const Fe = F - FE, budget = opt.budget || 5e6, log = [];
    let L = L0, res = null, why = 'no parlay';
    const U = bound(X, F), Um = boundsByLegs(X, Fe, (1 - TAU) * L0);
    for (let k = 2; k <= KMAX; k++) {
      let more = 0; for (let m = k; m <= KMAX; m++) if (Um[m] > more) more = Um[m];
      if (more < (1 - TAU) * L || more === 0) { log.push('nothing from ' + k + ' legs'); break; }
      if (Um[k] < (1 - TAU) * L || Um[k] === 0) continue;
      const b = best(X, Fe, k, (1 - TAU) * L, budget);
      if (b.walk.stop === 'budget') { why = 'budget at k=' + k; break; }
      log.push(k + ': best ' + (b.found ? (b.c * F).toFixed(6) + 'xF' : 'none') + ' (' + b.walk.nodes + (b.walk.unres ? ' unres:' + b.walk.unres : '') + ')');
      if (!b.found) continue;
      if (b.c > L) L = b.c;
      if (qOf(b.c) >= (1 - TAU) * qOf(U)) { res = b; why = 'U at k=' + k; break; }
      const e = exceed(X, Fe, b.c, budget);
      if (e.walk.stop === 'budget') { why = 'budget in exceed at k=' + k; break; }
      log.push(k + ': exceed ' + (e.hit ? (e.hit.c * F).toFixed(6) + 'xF ' + e.hit.n + ' legs' : 'none') + ' (' + e.walk.nodes + (e.walk.unres ? ' unres:' + e.walk.unres : '') + ')');
      if (!e.hit) { res = b; why = 'no parlay over the bar at k=' + k + (e.walk.unres ? ' (UNRESOLVED past ' + SMAX + ' legs: ' + e.walk.unres + ')' : ''); break; }
      if (e.hit.c > L) L = e.hit.c;
    }
    return { res, why, log, L, U };
  }
  return { TAU, QS, SMAX, prep, level, best, exceed, walk, groupFig, pairsOf, grow, qOf, idsOf, bound };
})();
`;
