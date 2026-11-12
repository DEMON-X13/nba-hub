/* THE TOLERANCE SEARCH (design angle B), a prototype evaluated into the booted page's realm, on the page's own sums.
 *
 * A parlay is at most one UNIT a game: a single leg, or a same-game group (two legs or more of one game that go together:
 * one leg a player, one side, one total). Units of different games are independent, so a parlay's chance C and price D
 * are the products of its units' own (the builder's own sums: a single at its chance and price; a group at sgJoint of its
 * legs' chances, and min(the prices multiplied, HOLD / J), J the copula's joint chance of their implied chances). Every
 * unit's return r = c x d is at most 1 on one ruler (an Under's is 1 by legFair, an Over's and a team leg's under 1, a
 * group's at most HOLD): so any parlay paying F lands at most R / F <= 1 / F of the time.
 *
 * THE RULE (enum.js checks it by brute force on small pools):
 *   V    = every parlay of 2 legs or more of the pool (one unit a game) whose price D >= F - 1e-9;
 *   q(P) = Math.round(C(P) x 1e12), C(P) the product of its units' chances in the order of their game ids;
 *   q*   = max over V of q;
 *   E    = { P in V : q(P) >= (1 - TAU) x q* };
 *   the level is the P in E with the fewest legs, then the highest q, then the least ids (its legs' slip keys sorted and
 *   joined by ","), compared as strings; none where V is empty.
 *
 * THE SEARCH, by the fewest legs first (DP.level):
 *   for k = 2, 3, ...: B_k = the exact best k-leg parlay (best(): the walk, a branch and bound that never cuts a parlay
 *   that could rank first among k-leg ones); it is the level when q(B_k) >= (1 - TAU) x q(U) (U an upper bound on every
 *   parlay's chance, below), or when no parlay of any size has (1 - TAU) x q > q(B_k) (exceed(): the same walk, stopped
 *   at the first parlay over the bar). Every k before the one returned failed (no k-leg parlay reached (1 - TAU) x L, L
 *   a parlay's chance, or its best was beaten by more than the tolerance), so it is the rule's fewest legs, and B_k its
 *   highest q.
 *
 * The walk's cuts (each a proof that no parlay of the branch can reach the bar theta):
 *   (a) chance: a parlay's chance only falls as a unit joins it (a unit's chance is at most 1), so a branch under theta
 *       ends; a game's units are tried likeliest first (by an upper bound where a group is not worked yet), so the first
 *       under theta ends the game's loop;
 *   (b) minimal: a branch that pays the floor is a candidate and is never grown: every parlay holding it is less likely
 *       and has more legs, so it never ranks above it;
 *   (c) return: an incomplete branch of return r still needs a unit of a later game, and the parlay pays F or more, so it
 *       lands at most r x Rsuf / F (Rsuf the most a unit of a later game returns); and a unit that returns under theta x
 *       F is in no parlay over theta (every other unit returns at most 1);
 *   (d) price: an incomplete branch can pay F only if its price times the most every later game's longest unit pays
 *       reaches F; and a unit that pays the floor with the branch lands at most rmax / d, so a game's units taken by
 *       price (a lower bound on it) from the branch's need up end where rmax / d is under the bar;
 *   (e) groups: a group returns at most HOLD (its chance at fair chances is at most J, the copula at its legs' implied
 *       chances, and it is priced at most HOLD / J), so where the best parlay of single legs is over HOLD (1 + EPSG) / F
 *       by more than the tolerance no group is ever worked; pairs are worked exactly (joint2, cheap); a group of three
 *       legs carries bounds from its pairs (the product of its legs' chances and its pairs' lifts, within K of the GHK
 *       sum: K_PL on player legs, K_TEAM with a team leg) and is worked by the page's own integral (spOrth, within
 *       ORTH_SLACK) and then by the GHK sum only where those bounds can still reach the bar.
 */
module.exports = String.raw`
var DP = (function () {
  const TAU = 0.005, EPSG = 2e-3, QS = 1e12, KMAX = 12, FE = 1e-9, ORTH_SLACK = 3e-4, K_PL = 2e-3, K_TEAM = 4e-2;
  const qOf = c => Math.round(c * QS);
  function prep(legs) {
    const hold = S.corr && S.corr.rho && S.corr.hold ? S.corr.hold : null, byG = new Map();
    for (const l of legs) {
      const d = amToDec(l.price); if (!(d > 1) || !(l.p > 0 && l.p < 1)) continue;
      const x = { l, sk: l.sk, gid: l.gid, pid: l.kind === 'prop' ? String(l.pid) : null, side: l.kind === 'ml' || l.kind === 'spread', tot: l.kind === 'total', team: l.kind !== 'prop', p: l.p, d, I: propImplied(l.price) };
      x.r = x.p * x.d;
      if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(x);
    }
    const games = [...byG.keys()].sort().map((gid, gi) => {
      const xs = byG.get(gid).sort((a, b) => a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0);
      xs.forEach((x, i) => { x.i = i; x.gi = gi; });
      const singles = xs.map(x => ({ n: 1, c: x.p, d: x.d, dl: x.d, r: x.r, legs: [x] }));
      return { gid, gi, xs, singles, pairs: null, tri: null, rho: new Map(), pairAt: new Map() };
    });
    return { games, hold, G: games.length, stats: { nodes: 0, cands: 0, pairs: 0, triSeen: 0, tri: 0, orth: 0, ghk: 0 }, memo: new Map(), maxN: 1 };
  }
  const fits = (a, b) => a.sk !== b.sk && !(a.pid && a.pid === b.pid) && !(a.side && b.side) && !(a.tot && b.tot);
  const pk = (a, b) => a.i < b.i ? a.i * 4096 + b.i : b.i * 4096 + a.i;
  function rho(g, a, b) { const k = pk(a, b); let r = g.rho.get(k); if (r === undefined) { r = pbRho(a.l, b.l) || 0; g.rho.set(k, r); } return r; }
  /* a group's figures by the builder's own sums, exactly as parlayProb and slipDec work them (the legs in sgOrder, their
     slip keys sorted; two legs by joint2, more by the GHK sum, cached by the page) */
  function groupFig(X, T) {
    const key = T.map(x => x.sk).sort().join('~'); let f = X.memo.get(key); if (f) return f;
    const L = sgOrder(T.map(x => x.l));
    if (T.length > 2) X.stats.ghk++;
    const c = parlayProb(L).corr, d = slipDec(L.map(l => Object.assign({}, l, { odds: l.price }))).dec;
    f = { c, d }; X.memo.set(key, f); return f;
  }
  /* a game's pairs, every two legs that go together, by joint2 at their chances and at their implied ones: the very
     sums parlayProb and slipDec work for two legs (the legs in sgOrder) */
  function pairsOf(X, g) {
    if (g.pairs) return g.pairs;
    g.pairs = [];
    const xs = g.xs;
    for (let i = 0; i < xs.length; i++) for (let j = i + 1; j < xs.length; j++) {
      const a = xs[i], b = xs[j]; if (!fits(a, b)) continue;
      const r = rho(g, a, b), c = joint2(a.p, b.p, r), J = joint2(a.I, b.I, r), mult = a.d * b.d, d = J > 0 && X.hold ? Math.min(mult, X.hold / J) : mult;
      const u = { n: 2, c, d, dl: d, r: c * d, legs: [a, b], J, lc: c / (a.p * b.p), lJ: J / (a.I * b.I) };
      g.pairs.push(u); g.pairAt.set(pk(a, b), u);
    }
    X.stats.pairs += g.pairs.length;
    return g.pairs;
  }
  /* a game's triples whose upper chance reaches cmin, each with bounds from its pairs: its chance near the product of
     its legs' chances and its three pairs' lifts (Kirkwood's), its implied joint chance the same, within K (K_PL on
     player legs, K_TEAM with a team leg), and at most its least pair's */
  function triOf(X, g, cmin, useful) {
    if (g.tri && g.triMin <= cmin && !useful) return g.tri;
    const P = pairsOf(X, g), xs = g.xs, n = xs.length, out = [];
    const adj = xs.map(() => []);
    for (const u of P) { if (u.c < cmin) continue; const [a, b] = u.legs; adj[a.i].push(b.i); adj[b.i].push(a.i); }
    for (const a of adj) a.sort((x, y) => x - y);
    for (let i = 0; i < n; i++) { const A = adj[i];
      for (let jj = 0; jj < A.length; jj++) { const j = A[jj]; if (j <= i) continue; const ab = g.pairAt.get(pk(xs[i], xs[j]));
        for (let kk = jj + 1; kk < A.length; kk++) { const k = A[kk];
          const ac = g.pairAt.get(pk(xs[i], xs[k])), bc = g.pairAt.get(pk(xs[j], xs[k])); if (!ac || !bc || bc.c < cmin) continue;
          X.stats.triSeen++;
          const a = xs[i], b = xs[j], c = xs[k], K = a.team || b.team || c.team ? K_TEAM : K_PL;
          const ck = a.p * b.p * c.p * ab.lc * ac.lc * bc.lc, Jk = a.I * b.I * c.I * ab.lJ * ac.lJ * bc.lJ, mult = a.d * b.d * c.d;
          const cu = Math.min(ck * (1 + K), ab.c, ac.c, bc.c); if (cu < cmin) continue;
          const du = Math.min(mult, X.hold / (Jk * (1 - K))), dl = Math.min(mult, X.hold / (Jk * (1 + K)));
          if (useful && !useful(cu, du)) continue;
          out.push({ n: 3, c: cu, d: du, dl, r: Math.min(X.hold * (1 + EPSG), cu * du), legs: [a, b, c], up: true }); } } }
    X.stats.tri += out.length;
    if (!useful) { g.tri = out; g.triMin = cmin; } return out;
  }
  /* a group with bounds, refined by the page's own integral (spOrth: its chance and its implied chance, each within
     ORTH_SLACK of the GHK sum) into tighter bounds (oc, odl, od); its exact figures (the GHK sum) only on ask (exact) */
  function orth(X, g, u) {
    if (!u.up || u.oc != null) return u;
    const T = u.legs, R = T.map((a, i) => T.map((b, k) => i === k ? 1 : rho(g, a, b)));
    X.stats.orth++;
    const oc = spOrth(T.map(x => normInv(1 - x.p)), R), oJ = spOrth(T.map(x => normInv(1 - x.I)), R), mult = T.reduce((s, x) => s * x.d, 1);
    if (oc == null || oJ == null) { u.oc = u.c; u.od = u.d; u.odl = u.dl; }
    else { u.oc = Math.min(u.c, oc * (1 + ORTH_SLACK)); u.od = Math.min(u.d, mult, X.hold / (oJ * (1 - ORTH_SLACK))); u.odl = Math.max(u.dl, Math.min(mult, X.hold / (oJ * (1 + ORTH_SLACK)))); }
    return u;
  }
  function exact(X, u) {
    if (!u.up) return u;
    if (!u.ex) { const f = groupFig(X, u.legs); u.ex = { n: u.n, c: f.c, d: f.d, dl: f.d, r: f.c * f.d, legs: u.legs }; }
    return u.ex;
  }
  const idsOf = units => units.flatMap(u => u.legs.map(x => x.sk)).sort().join(',');
  /* the units the walk may take in a game: its singles, and where groups are live its pairs and (maxN 3) its triples
     reaching the walk's least bar */
  function unitsOf(X, g, theta) {
    const out = g.singles.slice();
    if (X.groupsLive && X.hold) for (const u of pairsOf(X, g)) out.push(u);
    return out;
  }
  /* the walk: every minimal parlay of k legs (k 0: any size from 2) whose chance reaches theta, by the cuts above;
     sink(units, c, d, n) answers a new bar (best mode) or 'stop' (exceed mode) */
  function walk(X, Fe, theta, k, sink, budget) {
    const G = X.G, rmin = theta * Fe * (1 - 1e-9), H = X.hold ? X.hold * (1 + EPSG) : 0, tri = X.groupsLive && X.maxN >= 3 && X.hold;
    const games = X.games.map(g => {
      const us = unitsOf(X, g, theta).filter(u => u.r >= rmin && u.c >= theta);
      /* the triples' envelope (e): a triple of this game prices at most its three longest legs multiplied and lands at
         most its likeliest pair's chance, and at a price d at most H / d */
      let c3 = 0, d3 = 1;
      if (tri) { const ds = g.xs.map(x => x.d).sort((a, b) => b - a); d3 = ds.length >= 3 ? ds[0] * ds[1] * ds[2] : 1; for (const u of pairsOf(X, g)) if (u.c > c3) c3 = u.c; if (g.xs.length < 3) c3 = 0; }
      return { g, us, c3, d3 };
    });
    const RHO = 1.002, LR = Math.log(RHO), T = Math.max(1, Math.ceil(Math.log(Fe) / LR) + 2);
    const fidx = v => v <= 1 ? 0 : Math.max(0, Math.min(T, Math.floor(Math.log(v) / LR - 1e-9)));
    /* (f) THE PRICE PROGRAMME: B[j][m][i], at least the most chance a set of units of games j.. with exactly m legs
       (m 0: any number, the set possibly empty) can have at a price of RHO^i or more, from the last game back, each unit
       at its upper chance and price, a game's triples by their envelope: a unit of price d sits in the grid's cell
       under it (RHO^i_u <= d), so with the rest it pays RHO^i only where the rest pays over RHO^(i - i_u - 1), and the
       programme reads the rest there (a lower price: only more chance). A branch of chance c and price d with m legs to
       go lands at most c x B[j][m][index(F / d)], the index rounded down */
    const build = M => {
      const B = [];
      for (let j = 0; j <= G; j++) { const row = []; for (let m = 0; m <= M; m++) row.push(new Float64Array(T + 1)); B.push(row); }
      B[G][0][0] = 1;
      for (let j = G - 1; j >= 0; j--) {
        const cur = B[j], nxt = B[j + 1], gw = games[j];
        for (let m = 0; m <= M; m++) cur[m].set(nxt[m]);
        const cells = new Map(), put = (s, iu, cu) => { const key = (M ? s : 1) * 100000 + iu; const v = cells.get(key); if (v === undefined || cu > v) cells.set(key, cu); };
        for (const u of gw.us) put(u.n, fidx(u.d), u.c);
        if (gw.c3 > 0) { const top = fidx(gw.d3); for (let iu = 0; iu <= top; iu++) put(3, iu, Math.min(gw.c3, H / Math.pow(RHO, iu))); }
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
    const M = k || 0, B = build(M), Ball = M ? build(0)[0][0] : B[0][0];
    /* each game's triples, the ones that can be in a parlay over the bar: their upper chance at it, and either paying F
       alone or, with the most any set of units of every game can land at the price they lack (Ball), still over it */
    for (const gw of games) if (gw.c3 > 0) {
      for (const u of triOf(X, gw.g, theta, (cu, du) => cu >= theta && (du >= Fe || cu * Ball[fidx(Fe / du)] >= theta))) if (u.r >= rmin) gw.us.push(u);
    }
    for (const gw of games) {
      gw.byC = gw.us.slice().sort((a, b) => b.c - a.c); gw.byD = gw.us.slice().sort((a, b) => a.dl - b.dl);
      let rmax = 0, dmax = 1, ratio = 1; for (const u of gw.us) { if (u.r > rmax) rmax = u.r; if (u.d > dmax) dmax = u.d; if (u.dl / u.d < ratio) ratio = u.dl / u.d; }
      gw.rmax = rmax; gw.dmax = dmax; gw.ratio = ratio;
    }
    const Rsuf = new Float64Array(G + 1), Dsuf = new Float64Array(G + 1); Rsuf[G] = 0; Dsuf[G] = 1;
    for (let j = G - 1; j >= 0; j--) { Rsuf[j] = Math.max(Rsuf[j + 1], games[j].rmax); Dsuf[j] = Dsuf[j + 1] * games[j].dmax; }
    let th = theta, nodes = 0, stop = false; const ch = [];
    const lb = (a, t) => { let lo = 0, hi = a.length; while (lo < hi) { const m = (lo + hi) >> 1; if (a[m].dl >= t) hi = m; else lo = m + 1; } return lo; };
    /* can a unit of chance cu and price in [dl, du] join the branch (c, d, n) at game gi and still reach the bar: as the
       parlay's last unit (paying the floor, its chance at most r / its price), or grown (the programme on the rest) */
    const reach = (c, d, n, gi, cu, dl, du, ru, un) => {
      if (c * cu < th) return false;
      if (d * du >= Fe && (!k || n + un === k) && n + un >= 2 && c * ru / Math.max(Fe / d, dl) >= th) return true;
      if (d * dl < Fe && (!k || n + un < k) && c * cu * B[gi + 1][M ? M - n - un : 0][fidx(Fe / (d * du))] >= th) return true;
      return false;
    };
    const take = (u, c2, d2, n2, gi, r) => {
      if (d2 >= Fe) {
        if (k ? n2 !== k : n2 < 2) return;
        X.stats.cands++; ch.push(u); const v = sink(ch, c2, d2, n2); ch.pop();
        if (v === 'stop') stop = true; else if (v > th) th = v; return;
      }
      if (k && n2 >= k) return;
      if (d2 * Dsuf[gi + 1] < Fe) return;
      if (c2 * B[gi + 1][M ? M - n2 : 0][fidx(Fe / d2)] < th) return;
      ch.push(u); rec(gi + 1, c2, d2, n2, r * u.r); ch.pop();
    };
    /* a unit at a branch: its bounds, then the integral's, then its own figures, each only where the one before can
       still reach the bar */
    const tryUnit = (u, gi, c, d, n, r) => {
      if (u.up) {
        if (!reach(c, d, n, gi, u.c, u.dl, u.d, u.r, u.n)) return;
        orth(X, games[gi].g, u);
        if (!reach(c, d, n, gi, u.oc, u.odl, u.od, u.oc * u.od, u.n)) return;
        u = exact(X, u);
      }
      if (c * u.c < th) return;
      take(u, c * u.c, d * u.d, n + u.n, gi, r);
    };
    const rec = (j, c, d, n, r) => {
      if (stop) return;
      if (++nodes > budget) { stop = 'budget'; return; }
      if (r * Rsuf[j] < th * Fe || d * Dsuf[j] < Fe) return;
      if (c * B[j][M ? M - n : 0][fidx(Fe / d)] < th) return;
      const t = Fe / d;
      for (let gi = j; gi < G && !stop; gi++) {
        const gw = games[gi], bd = gw.byD;
        /* the units that may pay the floor with the branch (their upper price at least t), by their lower price from
           t x ratio up (every unit whose upper price reaches t has its lower one there or higher), ending where the most
           the game returns over the lower price cannot reach the bar */
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
    return { nodes, stop, th };
  }
  /* the exact best parlay of k legs with chance at least theta: the highest q, then the least ids (none: null) */
  function best(X, Fe, k, theta, budget) {
    let bq = -1, bc = 0, bd = 0, bids = null, bu = null;
    const w = walk(X, Fe, theta, k, (ch, c, d, n) => {
      const q = qOf(c); if (q < bq) return 0;
      const ids = idsOf(ch);
      if (q > bq || ids < bids) { bq = q; bc = c; bd = d; bids = ids; bu = ch.slice(); }
      return (q - 0.5) / QS;
    }, budget);
    return { found: !!bu, c: bc, d: bd, q: bq, ids: bids, units: bu, n: bu ? bu.reduce((t, u) => t + u.n, 0) : 0, walk: w };
  }
  /* is there a parlay (any size from 2) whose (1 - TAU) x q is over q(bar)? the first found, else none */
  function exceed(X, Fe, bar, budget) {
    let hit = null; const qb = qOf(bar);
    const w = walk(X, Fe, bar / (1 - TAU) * (1 - 1e-9), 0, (ch, c, d, n) => { if ((1 - TAU) * qOf(c) > qb) { hit = { c, d, n, ids: idsOf(ch), units: ch.slice() }; return 'stop'; } return 0; }, budget);
    return { hit, walk: w };
  }
  /* U: every parlay lands at most its return over F, and a parlay's return is at most the two best units' of two games
     (single legs; groups where live), or one group's alone */
  function bound(X, F) {
    let r1 = 0, r2 = 0, rg = 0;
    for (const g of X.games) {
      let m = 0; for (const u of g.singles) if (u.r > m) m = u.r;
      if (X.groupsLive && X.hold) { for (const u of pairsOf(X, g)) { if (u.r > m) m = u.r; if (u.r > rg) rg = u.r; }
        if (X.maxN >= 3) { const h = X.hold * (1 + EPSG); if (h > m) m = h; if (h > rg) rg = h; } }
      if (m > r1) { r2 = r1; r1 = m; } else if (m > r2) r2 = m;
    }
    return Math.max(r1 * r2, rg) / F;
  }
  /* the level at a floor F: the rule's parlay, and how it was proven. First on single legs alone; where its best is
     over HOLD (1 + EPSG) / F by more than the tolerance no parlay holding a group can be within the tolerance of it, or
     be the best (e), and it is the level; else the night's pairs and triples join and the walk runs again */
  function level(X, F, opt) {
    opt = opt || {};
    const t0 = performance.now(), hold = X.hold ? X.hold * (1 + EPSG) : 0;
    X.groupsLive = false; X.maxN = 1;
    const a = kloop(X, F, 0, opt);
    a.phase = 'singles';
    if (!X.hold || /^budget/.test(a.why) || (1 - TAU) * a.L > hold / F) { a.ms = performance.now() - t0; a.stats = Object.assign({}, X.stats); return a; }
    X.groupsLive = true; X.maxN = opt.tri === false ? 2 : 3;
    const b = kloop(X, F, a.L, opt);
    b.phase = 'groups'; b.log = a.log.concat(['-- groups --'], b.log);
    b.ms = performance.now() - t0; b.stats = Object.assign({}, X.stats); return b;
  }
  function kloop(X, F, L0, opt) {
    const Fe = F - FE, budget = opt.budget || 5e6, log = [];
    let L = L0, res = null, why = 'no parlay';
    const U = bound(X, F);
    for (let k = 2; k <= KMAX; k++) {
      if (U < (1 - TAU) * L) { log.push('U under the bar'); break; }
      const b = best(X, Fe, k, (1 - TAU) * L, budget);
      if (b.walk.stop === 'budget') { why = 'budget at k=' + k; break; }
      log.push(k + ': best ' + (b.found ? (b.c * F).toFixed(6) + 'xF' : 'none') + ' (' + b.walk.nodes + ')');
      if (!b.found) continue;
      if (b.c > L) L = b.c;
      if (qOf(b.c) >= (1 - TAU) * qOf(U)) { res = b; why = 'U at k=' + k; break; }
      const e = exceed(X, Fe, b.c, budget);
      if (e.walk.stop === 'budget') { why = 'budget in exceed at k=' + k; break; }
      log.push(k + ': exceed ' + (e.hit ? (e.hit.c * F).toFixed(6) + 'xF ' + e.hit.n + ' legs' : 'none') + ' (' + e.walk.nodes + ')');
      if (!e.hit) { res = b; why = 'no parlay over the bar at k=' + k; break; }
      if (e.hit.c > L) L = e.hit.c;
    }
    return { res, why, log, L, U };
  }
  return { TAU, EPSG, QS, prep, level, best, exceed, walk, groupFig, pairsOf, triOf, qOf, idsOf, bound };
})();
`;
