/* The ruler search (app/parts/suggested.html, THE RULER SEARCH): each level held to its rule by a full enumeration, and
 * timed on every real night.
 *
 *   node tools/test_suggest_ruler.js     ends "N checks passed"; exit 1 otherwise (a few minutes; needs jsdom;
 *                                        RULER_PAGE=<file> runs it on another built page, RULER_ONLY=enum or time one
 *                                        part, RULER_OUT=<file> writes the timing table as JSON, SL_VERBOSE=1 prints every
 *                                        check)
 *
 * (i) The rule, exactly. On small pools every valid parlay is enumerated (one leg a player, one side and one total a game,
 * two legs or more), each game's legs priced together by the builder's own sums (sgJoint and joint2 on the legs in
 * sgOrder; HOLD / J), and the level is held to (1) D >= F, (2) C >= (1 - SPR_TAU) C*, (3) no paying parlay with fewer
 * legs at (1 - SPR_TAU + SPR_ETA) C* or more, (4) C >= (1 - SPR_ETA) C*_k; where its tie pass ran, to the likeliest parlay
 * of its size, ties to the lower sorted slip keys; its bound at C* or more; the same answer and the same work a second
 * time. The pools: made-up nights of 6 to 24 legs over 1 to 4 games cut from 10 November's real legs (a game's groups of
 * three legs and more; even-return Unders tying; parlays paying their floor exactly; Unders off; Overs only; a table
 * that is not positive definite; a filter that leaves no leg), and real nights' team legs on every two-game cut and a
 * spread of three-game cuts (small enough to enumerate).
 * (ii) The time. Every real night (tools/fixtures/sp_nights.json's 7 and 10 November, and 10 November at 21:57 UTC from
 * tools/fixtures/sp_ruler_nights.json), whole and cut to every game and every two games, at the filter cases default,
 * Players only, Teams only, Overs only, Player unders off, shortest -300 and shortest -200, every level: at the default
 * filters every level settled and a night's three levels within RULER_NIGHT_MS; any level within RULER_LEVEL_MS (both
 * runner-safe, several times the jsdom figures in research/sp_ruler/engine.md); a level that stops on its work shows a
 * parlay with its proven gap. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { JSDOM, VirtualConsole } = require('./node_modules/jsdom');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sp_nights.json'), 'utf8'));
const FR = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sp_ruler_nights.json'), 'utf8'));
const NIGHTS = { nov7: FX.nights.nov7, nov10: FX.nights.nov10, nov10b: FR.nights.nov10b };
const FILTERS = { default: {}, players: { k: { ml: false, ats: false, total: false } }, teams: { k: { over: false, under: false } },
  overs: { k: { ml: false, ats: false, total: false, under: false } }, nounders: { k: { under: false } }, s300: { short: -300 }, s200: { short: -200 } };
const LIMIT = { level: +(process.env.RULER_LEVEL_MS || 4000), night: +(process.env.RULER_NIGHT_MS || 1500) };
const ONLY = process.env.RULER_ONLY || '';

let n = 0; const fails = [], notes = [];
const chk = (ok, msg) => { n++; if (!ok) fails.push(msg); if (process.env.SL_VERBOSE) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
function end() {
  for (const x of notes) console.log('  ' + x);
  for (const f of fails.slice(0, 60)) console.log('  FAIL: ' + f);
  if (fails.length > 60) console.log(`  ... and ${fails.length - 60} more`);
  console.log(fails.length ? `${n} checks, ${fails.length} failed` : `${n} checks passed`);
  process.exit(fails.length ? 1 : 0);
}
process.on('uncaughtException', e => { chk(false, 'the test stopped: ' + (e && e.stack || e)); end(); });

async function boot(nowIso) {
  const now = Date.parse(nowIso), html = fs.readFileSync(process.env.RULER_PAGE || path.join(ROOT, 'index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://demon-x13.github.io/nba-hub/', virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; if (!w.CSS) w.CSS = { escape: v => String(v) };
      const D0 = w.Date; class D extends D0 { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } } w.Date = D;
      w.fetch = u => { const rel = new URL(String(u), 'https://demon-x13.github.io/nba-hub/').pathname.replace(/^\/nba-hub\//, ''), f = path.join(ROOT, rel);
        if (/suggest_ledger/.test(rel) || !/^[\w./-]+$/.test(rel) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' });
        const t = fs.readFileSync(f, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t }); };
    } });
  const w = dom.window;
  for (let i = 0; i < 400 && !w.eval("typeof S!=='undefined'&&!!S&&!!S.slate&&typeof spRulerLevel==='function'"); i++) await new Promise(r => setTimeout(r, 30));
  return w;
}

/* the fixture's rows back to the page's legs (tools/test_suggest_speed.js's reading) */
const skOf = l => l.kind === 'prop' ? [l.gid, 'prop', l.pid, l.stat, l.mk, l.line, l.side].join('|') : [l.gid, l.kind, l.side, l.line == null ? '' : l.line].join('|');
function legsOf(night) {
  return night.legs.map(a => { const [away, home, tip] = night.games[a[0]];
    if (a[1] === 'prop') { const [gid, kind, pid, team, opp, stat, mk, line, side, odds, other, p] = a; const l = { id: gid, away, home, tip, kind, pid, team, stat, mk, line, side, odds, other, gid, sk: '', p, price: odds, opp }; l.sk = skOf(l); return l; }
    const [gid, kind, side, line, odds, other, p, team, opp] = a; const l = { id: gid, away, home, tip, kind, side, line, odds, other, gid, sk: '', p, price: odds, team, opp }; l.sk = skOf(l); return l; });
}

/* in the page: a ruler pool of given legs on filters (spRulerPool's reading of each leg), the enumeration, the checks */
const PAGE_CODE = String.raw`
window.__rPool = function (legs, filt) {
  const u = spRulerClean(filt), out = [];
  for (const v of legs) { const r = spRulerLeg(v, v.kind === 'prop', u); if (r && typeof r === 'object') out.push(r); }
  out.sort(pbOrd);
  return { legs: out, u, rule: 'fair' };
};
/* every valid parlay of the legs, each game's legs priced together by the builder's own sums: the most C of each size
   paying F, ties (to 1e-12) to the lower sorted slip keys */
window.__rEnum = function (legs, F, cap) {
  const hold = S.corr && S.corr.rho && S.corr.hold ? +S.corr.hold : 0, Fe = F - SP_FLOOR_EPS, by = new Map();
  for (const l of legs) { const g = l.gid || l.id; if (!by.has(g)) by.set(g, []); by.get(g).push(l); }
  const games = [...by.keys()].sort();
  const unitOf = cur => {
    const G = sgOrder(cur), mult = G.reduce((t, l) => t * amToDec(l.price), 1);
    if (G.length === 1) return { keys: [slipKey(G[0])], n: 1, c: G[0].p, d: mult };
    const sl = G.map(sgLeg), c = sgJoint(G.map(l => l.p), sl), J = sgJoint(G.map(l => propImplied(l.price)), sl);
    return { keys: G.map(slipKey), n: G.length, c, d: J > 0 && isFinite(J) ? Math.min(mult, hold / J) : mult };
  };
  const units = games.map(g => {
    const L = by.get(g).slice().sort((a, b) => slipKey(a) < slipKey(b) ? -1 : 1), out = [], cur = [];
    const rec = i => {
      if (i === L.length) { if (cur.length) out.push(unitOf(cur)); return; }
      rec(i + 1);
      const x = L[i], pid = x.kind === 'prop' ? String(x.pid) : null, side = x.kind === 'ml' || x.kind === 'spread', tot = x.kind === 'total';
      if (cur.length && !hold) return;
      if (cur.some(y => (pid && y.kind === 'prop' && String(y.pid) === pid) || (side && (y.kind === 'ml' || y.kind === 'spread')) || (tot && y.kind === 'total'))) return;
      cur.push(x); rec(i + 1); cur.pop();
    };
    rec(0);
    return out;
  });
  const combos = units.reduce((t, u) => t * (u.length + 1), 1);
  if (combos > cap) return { tooBig: combos };
  const less = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return a[i] < b[i]; return a.length < b.length; };
  const best = {}, chosen = []; let count = 0;
  const go = (j, c, d, k) => {
    if (j === games.length) {
      if (k >= 2 && d >= Fe) { count++; const ks = chosen.flatMap(u => u.keys).sort(), b = best[k];
        if (!b || c > b.c * (1 + 1e-12)) best[k] = { c, d, ids: ks, ties: 1 };
        else if (c >= b.c * (1 - 1e-12)) { b.ties++; if (less(ks, b.ids)) Object.assign(b, { c, d, ids: ks }); } }
      return;
    }
    go(j + 1, c, d, k);
    for (const u of units[j]) { chosen.push(u); go(j + 1, c * u.c, d * u.d, k + u.n); chosen.pop(); }
  };
  go(0, 1, 1, 0);
  let star = 0; for (const k in best) star = Math.max(star, best[k].c);
  return { count, combos, units: units.reduce((t, u) => t + u.length, 0), best, star };
};
window.__rCheck = function (pool, F, E) {
  const out = [], ok = (c, m) => out.push([!!c, m]);
  const L = spRulerLevel(pool, F), L2 = spRulerLevel({ ...pool, legs: pool.legs.slice() }, F);
  const ids = L.legs ? L.legs.map(slipKey).sort() : null, ids2 = L2.legs ? L2.legs.map(slipKey).sort() : null;
  ok(JSON.stringify(ids) === JSON.stringify(ids2) && L.p === L2.p && L.d === L2.d && L.work.used === L2.work.used, 'the same level and the same work a second time (' + (ids ? ids.length + ' legs' : 'none') + ', work ' + Math.round(L.work.used) + ' and ' + Math.round(L2.work.used) + ')');
  if (!(E.star > 0)) { ok(!L.legs && L.settled && (L.why === 'pays' || L.why === 'legs'), 'no parlay pays $' + F + ', and the level says so (' + (L.legs ? L.legs.length + ' legs' : L.why) + ')'); return { out, L }; }
  ok(!!L.legs && L.settled, 'a level, settled (' + (L.legs ? L.n + ' legs' : 'none') + (L.why ? ', ' + L.why : '') + ')');
  if (!L.legs) return { out, L };
  const k = L.n, TAU = SPR_TAU, ETA = SPR_ETA, bk = E.best[k];
  ok(L.d >= F - SP_FLOOR_EPS, '(1) it pays $' + F + ' (' + L.d + ')');
  ok(L.p >= (1 - TAU) * E.star * (1 - 1e-12), '(2) its chance ' + L.p + ' is within SPR_TAU of the best, ' + E.star);
  let fewer = null; for (let j = 2; j < k; j++) if (E.best[j] && E.best[j].c >= (1 - TAU + ETA) * E.star * (1 + 1e-12)) fewer = j;
  ok(fewer == null, '(3) no parlay of fewer legs than its ' + k + ' reaches (1 - SPR_TAU + SPR_ETA) of the best' + (fewer ? ': ' + fewer + ' legs at ' + E.best[fewer].c : ''));
  ok(!!bk && L.p >= (1 - ETA) * bk.c * (1 - 1e-12), '(4) its chance is within SPR_ETA of the best of ' + k + ' legs, ' + (bk && bk.c));
  if (L.tie) ok(!!bk && JSON.stringify(ids) === JSON.stringify(bk.ids) && Math.abs(L.p - bk.c) <= 1e-12 * bk.c, 'the tie pass: the likeliest of ' + k + ' legs, ties to the lower slip keys (' + ids.join(', ') + (bk ? ' against ' + bk.ids.join(', ') : '') + ')');
  ok(L.bound >= E.star * (1 - 1e-9), 'its bound ' + L.bound + ' is the best, ' + E.star + ', or more');
  return { out, L };
};
`;

/* made-up nights cut from 10 November's real legs (its six games), at prices of their own */
function pick(legs, gid, f) { return legs.filter(l => l.gid.endsWith(gid) && f(l)); }
function priced(l, odds, other) { return { ...l, odds, price: odds, other, sk: l.sk }; }
function madeUp() {
  const L = legsOf(FX.nights.nov10), P = [];
  const pl = (gid, nPl, stat) => { const by = new Map(); for (const l of pick(L, gid, x => x.kind === 'prop' && x.stat === stat)) { if (!by.has(l.pid)) by.set(l.pid, []); by.get(l.pid).push(l); }
    return [...by.values()].filter(v => v.length === 2).slice(0, nPl).flat(); };
  const team = (gid, kinds) => pick(L, gid, x => kinds.includes(x.kind));
  P.push(['one game, groups of three legs and more (4 players over and under, moneylines)', [...pl('BOS_PHI', 4, 'pts'), ...team('BOS_PHI', ['ml'])], {}]);
  P.push(['two games, groups and singles (2 players, a side and the total a game)', [...pl('LAC_PHX', 2, 'reb'), ...team('LAC_PHX', ['ml', 'total']), ...pl('MIA_UTA', 2, 'ast'), ...team('MIA_UTA', ['spread', 'total'])], {}]);
  /* even-return Unders: every Under at -120 against an Over at -105, so each Under's fair chance is its implied chance,
     and four games of them tie */
  const ev = [];
  for (const gid of ['BOS_PHI', 'LAC_PHX', 'MIA_UTA', 'OKC_POR']) for (const l of pl(gid, 3, 'pts')) ev.push(l.side === 'under' ? priced(l, -120, -105) : priced(l, 150, -190));
  P.push(['four games of even-return Unders tying (every Under -120 over -105)', ev, {}, { ties: true }]);
  /* the floor met exactly: Unders at +100, -200 and -300 (2 x 2 = 4, 2 x 2 x 2 = 8, 1.5 x 4/3 = 2) */
  const fl = [], pr = [[100, -125], [-200, 150], [-300, 200], [100, -125], [-200, 150], [-300, 200]];
  let i = 0; for (const gid of ['BOS_PHI', 'LAC_PHX', 'MIA_UTA']) for (const l of pl(gid, 2, 'pts').filter(x => x.side === 'under')) { const [o, t] = pr[i++ % pr.length]; fl.push(priced(l, o, t)); }
  P.push(['three games whose parlays meet the floor exactly (Unders at +100, -200 and -300)', fl, {}]);
  const mix = [...pl('BOS_PHI', 3, 'pts'), ...team('BOS_PHI', ['ml', 'total']), ...pl('ORL_SAC', 3, 'reb'), ...team('ORL_SAC', ['spread'])];
  P.push(['two games, Unders off', mix, { k: { under: false } }]);
  P.push(['two games, Overs only', mix, { k: { ml: false, ats: false, total: false, under: false } }]);
  P.push(['two games, shortest -200', mix, { short: -200 }]);
  P.push(['a filter that leaves no leg', mix, { k: { ml: false, ats: false, total: false, over: false, under: false } }]);
  /* thirty legs: three games of both sides at their moneylines and spreads, the total and three players' lines */
  const one = (gid, st) => { const seen = new Set(), out = []; for (const l of pick(L, gid, x => x.kind === 'prop' && x.stat === st)) if (!seen.has(l.pid) && out.length < 3) { seen.add(l.pid); out.push(l); } return out; };
  const big = [];
  for (const [gid, st] of [['BOS_PHI', 'pts'], ['LAC_PHX', 'reb'], ['OKC_POR', 'ast']]) big.push(...team(gid, ['ml', 'spread', 'total']), ...one(gid, st));
  P.push([`three games of ${big.length} legs (both sides at the moneyline and the spread, the total, three players a game)`, big, {}]);
  return P;
}

(async () => {
  console.log('the ruler search, held to its rule and timed');
  const w = await boot(FX.nights.nov10.at);
  chk(w.eval("typeof spRulerLevel==='function'&&typeof spRulerPool==='function'&&typeof spRulerLeg==='function'"), 'the page boots with the ruler search');
  w.eval(`S.corr = ${JSON.stringify(FX.corr)}`);
  w.eval(PAGE_CODE);
  chk(w.eval('SPR_TAU === 0.005 && SPR_ETA === 0.001'), "the rule's SPR_TAU 0.005 and SPR_ETA 0.001");
  const run = (legs, filt, F, cap) => {
    w.__legs = legs;
    const r = JSON.parse(w.eval(`(() => { const pool = __rPool(__legs, ${JSON.stringify(filt)}); const E = __rEnum(pool.legs, ${F}, ${cap});
      if (E.tooBig) return JSON.stringify({ tooBig: E.tooBig, legs: pool.legs.length });
      const c = __rCheck(pool, ${F}, E); return JSON.stringify({ legs: pool.legs.length, count: E.count, units: E.units, out: c.out, n: c.L.n, p: c.L.p, tie: c.L.tie, ties: c.L.n && E.best[c.L.n] ? E.best[c.L.n].ties : 0 }); })()`));
    return r;
  };
  if (!ONLY || ONLY === 'enum') {
    const t0 = Date.now(); let pools = 0, parlays = 0;
    const hold = (what, legs, filt, o) => {
      for (const F of [2, 4, 8]) {
        const r = run(legs, filt, F, 3e6);
        if (r.tooBig) { chk(false, `${what}: $${F}: too many parlays to enumerate (${r.tooBig})`); continue; }
        pools++; parlays += r.count;
        if (o && o.ties) chk(r.ties >= 2 && r.tie, `${what}, $${F}: the case stands on ties: ${r.ties} parlays of the level's ${r.n} legs tie at its chance, and its tie pass ran`);
        for (const [ok, m] of r.out) chk(ok, `${what}, $${F} (${r.legs} legs, ${r.count} paying parlays): ${m}`);
      }
    };
    for (const [what, legs, filt, o] of madeUp()) hold(what, legs, filt, o);
    /* a table that is not positive definite: 10 November's BOS at PHI with mate pts-reb 0.9, opposite ast-pts 0.9 and
       ast-reb -0.9 (the builder shrinks a group holding all three) */
    const keep = w.eval('JSON.stringify(S.corr)');
    try {
      w.eval("S.corr = JSON.parse(JSON.stringify(S.corr)); S.corr.rho['mate|pts|reb'] = 0.9; S.corr.rho['opp|ast|pts'] = 0.9; S.corr.rho['opp|ast|reb'] = -0.9;");
      const L = legsOf(FX.nights.nov10), g = 'BOS_PHI', by = st => { const m = new Map(); for (const l of L.filter(x => x.gid.endsWith(g) && x.kind === 'prop' && x.stat === st)) { if (!m.has(l.pid)) m.set(l.pid, []); m.get(l.pid).push(l); } return [...m.values()].filter(v => v.length === 2); };
      const pts = by('pts'), reb = by('reb'), ast = by('ast');
      const home = FX.nights.nov10.games[L.find(x => x.gid.endsWith(g)).gid][1];
      const A = pts.find(v => v[0].team === home), B = reb.find(v => v[0].team === home && v[0].pid !== (A && A[0].pid)), Cc = ast.find(v => v[0].team !== home);
      const legs = [...(A || []), ...(B || []), ...(Cc || [])];
      chk(legs.length === 6 && !w.eval(`(() => { const p = __rPool(${JSON.stringify(legs)}, {}); return spPosDef(p.legs.map(l => ({ l }))); })()`), "the made-up table makes BOS at PHI's legs not positive definite (" + legs.length + ' legs)');
      hold('a table that is not positive definite (the builder shrinks)', legs, {});
    } finally { w.eval(`S.corr = ${keep}`); }
    /* real nights' team legs, every two and three games */
    for (const [nm, N] of [['7 November', FX.nights.nov7], ['10 November', FX.nights.nov10]]) {
      const L = legsOf(N).filter(l => l.kind !== 'prop'), gs = Object.keys(N.games).sort();
      for (let a = 0; a < gs.length; a++) for (let b = a + 1; b < gs.length; b++) hold(`${nm}'s team legs, ${gs[a].slice(14)} and ${gs[b].slice(14)}`, L.filter(l => l.gid === gs[a] || l.gid === gs[b]), {});
      for (let a = 0; a < gs.length; a += 2) for (let b = a + 1; b < gs.length; b += 2) for (let c = b + 1; c < gs.length; c += 3) hold(`${nm}'s team legs, ${[gs[a], gs[b], gs[c]].map(x => x.slice(14)).join(', ')}`, L.filter(l => [gs[a], gs[b], gs[c]].includes(l.gid)), {});
    }
    notes.push(`the rule: ${pools} levels enumerated (${parlays} paying parlays) in ${Math.round((Date.now() - t0) / 1000)} s`);
  }
  if (!ONLY || ONLY === 'time') {
    const t0 = Date.now(), rows = [];
    for (const [nm, N] of Object.entries(NIGHTS)) {
      const all = legsOf(N), gs = Object.keys(N.games).sort(), cuts = [['night', gs]];
      for (const g of gs) cuts.push([g.slice(14), [g]]);
      for (let a = 0; a < gs.length; a++) for (let b = a + 1; b < gs.length; b++) cuts.push([gs[a].slice(14) + '+' + gs[b].slice(14), [gs[a], gs[b]]]);
      for (const [fn, filt] of Object.entries(FILTERS)) for (const [cn, keepG] of cuts) {
        w.__legs = all.filter(l => keepG.includes(l.gid));
        const r = JSON.parse(w.eval(`(() => { const pool = __rPool(__legs, ${JSON.stringify(filt)}), out = { legs: pool.legs.length, L: [] };
          for (const F of [2, 4, 8]) { const t = performance.now(), L = spRulerLevel(pool, F), ms = performance.now() - t;
            out.L.push({ F, ms: +ms.toFixed(1), settled: L.settled, why: L.why, n: L.n || 0, p: L.p || null, d: L.d || null, gap: L.gap == null ? null : L.gap, work: Math.round(L.work.used), tie: !!L.tie,
              legs: L.legs ? L.legs.map(l => l.kind === 'prop' ? (l.name || l.pid) + ' ' + l.side + ' ' + l.line + ' ' + l.stat + ' ' + l.price : l.kind + ' ' + l.side + (l.line != null ? ' ' + l.line : '') + ' ' + l.price) : null }); }
          return JSON.stringify(out); })()`));
        rows.push({ night: nm, filter: fn, cut: cn, ...r });
        const tot = r.L.reduce((t, x) => t + x.ms, 0);
        for (const x of r.L) {
          chk(x.ms <= LIMIT.level, `${nm} ${cn} at ${fn}: $${x.F} in ${x.ms} ms, within ${LIMIT.level} ms`);
          if (fn === 'default') chk(x.settled, `${nm} ${cn} at the default filters: $${x.F} settled (${x.why || 'ok'}, ${x.n} legs, work ${x.work})`);
          if (!x.settled && x.why === 'work') chk(x.n >= 2 && x.gap != null && x.gap >= 0, `${nm} ${cn} at ${fn}: $${x.F} stopped on its work shows a parlay with its proven gap (${x.n} legs, gap ${x.gap})`);
        }
        if (fn === 'default' && cn === 'night') chk(tot <= LIMIT.night, `${nm}'s night at the default filters: three levels in ${tot.toFixed(1)} ms, within ${LIMIT.night} ms`);
      }
    }
    if (process.env.RULER_OUT) fs.writeFileSync(process.env.RULER_OUT, JSON.stringify(rows));
    const L = rows.flatMap(r => r.L.map(x => ({ ...x, r })));
    const unset = L.filter(x => !x.settled);
    notes.push(`the time: ${L.length} levels in ${Math.round((Date.now() - t0) / 1000)} s; slowest ${Math.max(...L.map(x => x.ms))} ms; ${unset.length} not settled (${[...new Set(unset.map(x => x.r.filter))].join(', ') || 'none'}), worst gap ${unset.length ? (Math.max(...unset.map(x => x.gap || 0)) * 100).toFixed(1) + '%' : '-'}`);
    for (const r of rows.filter(r => r.cut === 'night' && r.filter === 'default')) notes.push(`${r.night}'s night at the default filters: ${r.L.map(x => `$${x.F} ${x.n} legs ${(x.p * 100).toFixed(2)}% at ${x.d && x.d.toFixed(3)} in ${x.ms} ms`).join('; ')}`);
  }
  end();
})();
