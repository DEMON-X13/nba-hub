/* The Parlay Builder, a section of the viewer smoke test (README "Parlay Builder"): run by tools/smoke.js, alone with
 *
 *   SMOKE_ONLY=pb node tools/smoke.js
 *
 * The tab (app/parts/parlay.html) is the NFL hub's Parlay Builder on the NBA's lines: its choices, the Top 50 lines they
 * make and the builder. Here the built page boots in jsdom on a made-up slate a day or two ahead (so every case holds at
 * any hour on any day, the off-season included), a made-up lines.json in the shape tools/lines.js writes, a props block
 * of its own and a stubbed ESPN, and every number it states is worked out here on this file's own copies of its rules,
 * never read from the page: which legs qualify (qualOwn: DraftKings' price, the model's chance from 45% to 97% at or above
 * the price's implied chance, 3 points above it a Value pick, 15 points above DraftKings' fair chance left out, a game leg
 * with no betslip id where its game's lines carry ids left out), each one's chance (the player model's win chance, the
 * cover chance on research/sigma.json's sigma, the market's own on a total, tools/props.js's distribution on a player)
 * and fair chance (tools/props_feed.js's rules), the order (pbTopOwn: the Value picks, then the thin-edge lines, then the
 * totals, each by what $1 is expected to make), each bet once (sameBetOwn: a milestone k+ is the main Over at k - 0.5),
 * the 50-line cut (PB_TOP_N_OWN) on sixty made-up games, the on-trial mark on every player leg and nowhere else, the
 * Value mark on every Value pick and nowhere else, the Bet amount, the builder's numbers by data/corr.json and
 * tools/corr.js (two legs of one game exactly), the same-game refusals with their reasons, Add, Added and Remove, a game
 * that tips while the page is open, nothing read before the tab opens and nothing stored by a press; then the real
 * state.json and lines.json, on what the day offers. Every request is recorded.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = async function parlayBuilder({ check, pageFile, ROOT }) {
  console.log('Parlay Builder');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => JSON.parse(JSON.stringify(x));
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const PJ = require('./props'), PF = require('./props_feed'), CJ = require('./corr'), PUB = require('./publish'), SG = require('./sigma');
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const CT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corr.json'), 'utf8')), HOLD = CT.hold.value;
  const SIG_FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'sigma.json'), 'utf8'));
  const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const ymd = d => d.replace(/-/g, '');
  const at = ms => new Date(ms).toISOString().slice(0, 19) + 'Z', tipAt = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
  const SEASON = REAL.season;

  /* ---------- this file's own copies of the rules ---------- */
  const PB_TOP_N_OWN = 50, EDGE_OWN = 0.03, PMIN_OWN = 0.45, PMAX_OWN = 0.97, FAR_OWN = 0.15, SIGMA_OWN = SIG_FILE.sigma;
  const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100), decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
  const keyOwn = l => l.kind === 'prop' ? [l.id, 'prop', l.pid, l.stat, l.mk, l.mk === 'main' ? l.line : l.mk === 'mile' ? l.k : '', l.side].join('|') : [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
  const cmpKey = (a, b) => { const x = keyOwn(a), y = keyOwn(b); return x < y ? -1 : x > y ? 1 : 0; };
  const COMBO = { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'];
  const muOwn = (row, k) => k in COMBO ? Math.round(COMBO[k].reduce((t, s) => t + row[LAY.indexOf(s)], 0) * 100) / 100 : row[LAY.indexOf(k)];
  /* the model's chance of a leg, on the state st: a moneyline the player model's; a spread Phi((m + h) / sigma), m the
     side's expected margin; a total the market's own, its two prices in proportion; a player's tools/props.js's
     distribution on the props block's mean */
  function modelOwn(l, st) {
    if (l.kind === 'total') return l.other == null ? 0.5 : imp(l.odds) / (imp(l.odds) + imp(l.other));
    const g = st.slate.find(x => x.id === l.id);
    if (l.kind === 'ml') return l.side === g.home ? g.model.pHome : 1 - g.model.pHome;
    if (l.kind === 'spread') { const m = l.side === g.home ? -g.model.spread : g.model.spread; return SG.Phi((m + l.line) / SIGMA_OWN); }
    const row = st.props.games[l.id].players[l.pid], V = st.props.dist.var;
    if (l.mk === 'yes') return row[LAY.indexOf(l.stat)];
    const mu = muOwn(row, l.stat), v = PJ.nbVar(mu, V[l.stat]);
    if (l.mk === 'mile') return PJ.nbSf(l.k, mu, v);
    const o = PJ.pOver(l.line, mu, v); return l.side === 'under' ? 1 - o : o;
  }
  /* DraftKings' fair chance: a main line's whole margin on the Over, a milestone's or a Yes price's by the rung rule (est.),
     a team line's two prices in proportion */
  function fairOwn(l, st) {
    if (l.kind === 'prop') {
      if (l.mk === 'main') return l.other == null ? null : { p: l.side === 'under' ? imp(l.odds) : 1 - imp(l.other), est: false };
      const F = st.props.fair, a = l.mk === 'mile' ? F.rung.a[l.stat] : F.yes.a[l.stat]; return { p: PF.propFairRung(l.odds, a), est: true };
    }
    return l.other == null ? null : { p: imp(l.odds) / (imp(l.odds) + imp(l.other)), est: false };
  }
  const BOX_OWN = { ml: 'ml', spread: 'ats', total: 'total' };
  const boxOwn = l => l.kind === 'prop' ? (l.side === 'under' ? 'under' : 'over') : BOX_OWN[l.kind];
  /* the games: the next two Eastern dates with a game still to tip that is not preseason, on the clock now */
  function gamesOwn(st) {
    const now = Date.now(), today = etDate(now), live = g => g.status === 'scheduled' && !(g.tip && Date.parse(g.tip) <= now);
    const ds = [...new Set(st.slate.filter(g => g.type !== 'PRE' && g.date >= today && live(g)).map(g => g.date))].sort().slice(0, 2);
    return st.slate.filter(g => ds.includes(g.date) && g.type !== 'PRE' && live(g));
  }
  /* every leg with DraftKings' price on the games, as this file reads the lines (the newer of lines.json and a press) */
  function candidatesOwn(st, L, press) {
    const out = [];
    for (const g of gamesOwn(st)) {
      const e = L && L.games && L.games[g.id], p = press && press[g.id];
      const gl = p && p.gl ? p.gl : e && e.at ? e : null, glAt = p && p.gl ? p.gl.at : e ? e.at : null;
      const ids = gl && gl.ids, on = !!(ids && (ids.event || ['ml', 'spread', 'total'].some(k => ids[k] && Object.values(ids[k]).some(Boolean))));
      const id = (k, s) => (ids && ids[k] && ids[k][s]) || null;
      const base = { id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip };
      if (gl && g.model) {
        if (gl.ml) for (const s of ['away', 'home']) out.push({ ...base, at: glAt, kind: 'ml', side: g[s], line: null, odds: gl.ml[s], other: gl.ml[s === 'home' ? 'away' : 'home'], dk: id('ml', s), on });
        if (gl.spread) for (const s of ['away', 'home']) out.push({ ...base, at: glAt, kind: 'spread', side: g[s], line: s === 'home' ? gl.spread.line : -gl.spread.line, odds: gl.spread[s], other: gl.spread[s === 'home' ? 'away' : 'home'], dk: id('spread', s), on });
        if (gl.total) for (const s of ['over', 'under']) out.push({ ...base, at: glAt, kind: 'total', side: s, line: gl.total.line, odds: gl.total[s], other: gl.total[s === 'over' ? 'under' : 'over'], dk: id('total', s), on });
      }
      const pr = p && p.props ? p.props : e ? e.props : null, pg = st.props && st.props.games && st.props.games[g.id];
      const failed = st.props && st.props.ledger && st.props.ledger.decision && st.props.ledger.decision.verdict === 'FAIL';
      if (!pr || !pg || failed) continue;
      const out0 = new Set(['away', 'home'].flatMap(s => ((g.model && g.model[s] && g.model[s].out) || []).map(x => x.id)));
      const who = pid => { const r = pg.players[pid]; return r && !out0.has(pid) && (r[1] === g.away || r[1] === g.home) ? r : null; };
      for (const m of pr.mains) { const r = who(m.player); if (!r) continue; const b = { ...base, kind: 'prop', pid: m.player, name: r[0], team: r[1], at: pr.at };
        out.push({ ...b, stat: m.stat, mk: 'main', line: m.line, side: 'over', odds: m.over, other: m.under }, { ...b, stat: m.stat, mk: 'main', line: m.line, side: 'under', odds: m.under, other: m.over }); }
      for (const m of pr.ladders) { const r = who(m.player); if (r) out.push({ ...base, kind: 'prop', pid: m.player, name: r[0], team: r[1], at: pr.at, stat: m.stat, mk: 'mile', k: m.k, side: 'yes', odds: m.price, other: null }); }
      for (const y of pr.yes) { const r = who(y.player); if (r) out.push({ ...base, kind: 'prop', pid: y.player, name: r[0], team: r[1], at: pr.at, stat: y.market, mk: 'yes', side: 'yes', odds: y.price, other: null }); }
    }
    return out.filter(l => Number.isFinite(l.odds) && l.odds !== 0).map(l => ({ ...l, p: modelOwn(l, st), fc: fairOwn(l, st) }));
  }
  /* the rule: 'value', 'thin', 'total', or why it is out ('band', 'edge', 'far', 'noId', 'box') */
  function qualOwn(l, ticks) {
    if (!ticks.k[boxOwn(l)] || ticks.off.includes(l.id)) return 'box';
    if (!(l.p >= PMIN_OWN && l.p < PMAX_OWN)) return 'band';
    if (l.kind === 'total') return l.on && !l.dk ? 'noId' : 'total';
    const edge = l.p - imp(l.odds);
    if (edge < 0) return 'edge';
    if (l.fc && l.p - l.fc.p >= FAR_OWN - 1e-9) return 'far';
    if (l.on && !l.dk) return 'noId';
    return edge >= EDGE_OWN ? 'value' : 'thin';
  }
  /* each bet once: a milestone k+ is the main Over at k - 0.5 on a half-point line, wherever that main Over qualifies */
  function sameBetOwn(list) {
    const mains = new Set(list.filter(l => l.kind === 'prop' && l.mk === 'main' && l.side === 'over' && Math.abs(l.line % 1) === 0.5).map(l => `${l.id}|${l.pid}|${l.stat}|${l.line + 0.5}`));
    return l => l.kind === 'prop' && l.mk === 'mile' && mains.has(`${l.id}|${l.pid}|${l.stat}|${l.k}`);
  }
  function pbTopOwn(cands, ticks) {
    const q = cands.map(l => ({ l, q: qualOwn(l, ticks) }));
    const part = k => q.filter(x => x.q === k).map(x => x.l), V = part('value'), T = part('thin'), M = part('total'), same = sameBetOwn([...V, ...T]);
    const rank = list => list.filter(l => !same(l)).map(l => ({ ...l, dec: decOf(l.odds), ev: l.p * decOf(l.odds) - 1 })).sort((a, b) => (b.ev - a.ev) || cmpKey(a, b));
    const all = [...rank(V).map(l => ({ ...l, part: 'value' })), ...rank(T).map(l => ({ ...l, part: 'other' })), ...rank(M).map(l => ({ ...l, part: 'other', total: true }))];
    return { rows: all.slice(0, PB_TOP_N_OWN), over: all.length, q, same: [...V, ...T, ...M].filter(same).length };
  }
  const pbIsOwn = l => !!l && l.thin === false && !l.market;
  const TICKS_ALL = { k: { ml: true, ats: true, total: true, over: true, under: true }, off: [] };
  const pct = v => (v * 100).toFixed(0) + '%', m1 = v => (v < -0.0005 ? '−' : '+') + '$' + Math.abs(v).toFixed(2);
  const am = a => (a > 0 ? '+' : '') + Math.round(a);
  /* a drawn row, read: its key, its part, its rank, what it shows */
  const rowRead = li => { const c = [...li.querySelectorAll('.pb-tc b')].map(b => b.textContent.trim());
    return { key: li.querySelector('[data-pb-leg]').dataset.pbLeg, part: li.dataset.pbGrp, rank: +li.dataset.pbRow, rk: li.querySelector('.pb-trk').textContent.trim(), price: c[0], model: c[1], fair: c[2], win: c[3], ev: c[4],
      value: !!li.querySelector('.pb-valmark'), trial: !!li.querySelector('.pb-trial'), label: li.querySelector('.nm small').childNodes[0].textContent }; };
  /* what the own list says each row shows */
  const rowWant = (l, i) => ({ key: keyOwn(l), part: l.part, rank: i + 1, rk: String(i + 1), price: am(l.odds), model: pct(l.p), fair: l.fc ? pct(l.fc.p) : '–', win: m1(l.dec - 1), ev: m1(l.ev), value: l.part === 'value', trial: l.kind === 'prop' });

  /* ---------- the harness ---------- */
  function load(st, o = {}) {
    const html = fs.readFileSync(pageFile('index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
    const errors = [], requests = [], timers = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
      beforeParse(w) {
        w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
          if (/espn\.com/.test(url)) return o.espn ? o.espn(url, opt) : { ok: false, status: 404, json: async () => ({}) };
          if (/lines\.json/.test(url)) { const L = typeof o.lines === 'function' ? o.lines() : o.lines; if (L === undefined || L === 404) return { ok: false, status: 404, json: async () => ({}) };
            if (L === 'junk') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
            return { ok: true, status: 200, json: async () => clone(L) }; }
          if (/state\.json/.test(url)) return { ok: true, status: 200, json: async () => clone(st) };
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
        w.scrollTo = () => {}; w.confirm = () => (o.confirm !== undefined ? o.confirm : true);
        if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
        if (o.mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(o.mine));
        if (o.tab) w.localStorage.setItem('nba_hub_2027:tab', o.tab);
        for (const k of ['setTimeout', 'setInterval']) { const real = w[k]; w[k] = function (fn, ms, ...a) { timers.push({ k, fn, ms }); return real.call(w, fn, ms, ...a); }; }
        w.addEventListener('error', e => errors.push(e.message));
      } });
    const w = dom.window;
    return { w, d: w.document, errors, requests, timers };
  }
  async function provoke(p) {
    for (let round = 0, seen = 0; round < 3 && seen < p.timers.length; round++) { const due = p.timers.slice(seen); seen = p.timers.length; for (const t of due) if (typeof t.fn === 'function') try { t.fn(); } catch (e) { p.errors.push(e.message); } }
    for (const [x, type] of [[p.w, 'focus'], [p.d, 'visibilitychange'], [p.w, 'pageshow'], [p.w, 'online'], [p.w, 'resize'], [p.w, 'scroll']]) x.dispatchEvent(new p.w.Event(type));
    await sleep(50);
  }
  const linesReqs = p => p.requests.filter(x => /lines\.json/.test(x.url));
  const espnReqs = p => p.requests.filter(x => /espn\.com/.test(x.url));
  const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
  const stored = w => JSON.stringify([dump(w.localStorage), dump(w.sessionStorage)]);
  const mine = w => JSON.parse(w.localStorage.getItem('nba_hub_2027') || '{}');
  const openTab = async p => { p.d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(60); };
  const rows = p => [...p.d.querySelectorAll('#pbPanel li.pb-trow')];
  const addBtn = (p, key) => p.d.querySelector(`#pbPanel [data-pb-leg="${key.replace(/"/g, '\\"')}"]`);

  /* ---------- the made-up slate, a day and two ahead ---------- */
  /* the dates are tomorrow and the two days after (Eastern), each game at 23:00 UTC or a few minutes on (7pm EDT, 6pm EST),
     so every game is on its own date at any hour the test runs, and at least eighteen hours off */
  const now = Date.now(), H = 3600e3;
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const D1 = addDay(etDate(now), 1), D2 = addDay(D1, 1), D3 = addDay(D2, 1), at23 = d => Date.parse(d + 'T23:00:00Z');
  const T1 = at23(D1), T2 = at23(D2), T3 = at23(D3);
  const gid = (ms, a, h) => `${SEASON}_${ymd(etDate(ms))}_${a}_${h}`;
  const side = (t, out) => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
  const game = (ms, a, h, model, o) => ({ id: gid(ms, a, h), date: etDate(ms), tip: tipAt(ms), type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '7' + String(ms).slice(-6), awayScore: null, homeScore: null,
    line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 228, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5 }, published: null, ...o });
  const A1 = game(T1, 'BOS', 'NYK', { pHome: 0.62, spread: -7, total: 229.4, home: side('NYK', [{ id: '8100007', name: 'Gus Out', status: 'Out', min: 30, costs: 40 }]) });
  const A2 = game(T1 + 30 * 60e3, 'LAL', 'GSW', { pHome: 0.45, spread: 2, total: 231.2 });
  const A3 = game(T2, 'MIA', 'ORL', { pHome: 0.70, spread: -6, total: 224 });
  const A4 = { ...game(T2 + 30 * 60e3, 'DEN', 'PHX', { pHome: 0.8, spread: -9 }), type: 'PRE' };
  const A5 = game(T3, 'CHI', 'DET', { pHome: 0.8, spread: -9 });
  const A6 = game(now - H, 'SAC', 'POR', { pHome: 0.8, spread: -9 });
  const SLATE = [A1, A2, A3, A4, A5, A6];
  const VAR = { pts: [7.2, 0.73], reb: [1.76, 0.88], ast: [1.3, 0.99], tpm: [1.23, 1.0], stl: [1.1, 0.98], blk: [1.25, 1.12], pra: [9.66, 0.67], pr: [8.17, 0.72], pa: [6.43, 0.78], ar: [2.7, 0.76], sb: [1.2, 0.97] };
  const P = (name, team, pos, pts, reb, ast, dd, extra) => [name, team, pos, 32, pts, reb, ast, 1.5, 1.0, (extra && extra.blk) || 0.5, dd || 0.05, 0.01];
  const props = { onTrial: true, build: 'test', asOf: D1, fitSeasons: '2023-2026', horizonGameDays: 5, minShown: 8, stats: PJ.ALL, combos: COMBO, layout: LAY, dist: { kind: 'negative binomial', var: VAR }, fair: PJ.FAIR,
    ledger: { registered: '2026-10-15T11:35Z', bar: { lines: 30000 }, decision: null, summary: { lines: 4321, gradedGames: 40 } }, research: null,
    games: {
      [A1.id]: { tip: A1.tip, away: 'BOS', home: 'NYK', players: {
        '8100001': P('Ace Guard', 'BOS', 'G', 27.5, 4, 3), '8100002': P('Bo Wing', 'NYK', 'F', 12, 8.0, 2), '8100003': [...P('Cy Center', 'NYK', 'C', 10, 10.3, 2.9)],
        '8100005': P('Eli Forward', 'NYK', 'F', 16.8, 5, 2), '8100006': P('Fay Blocker', 'BOS', 'C', 9, 7, 1, 0.1, { blk: 1.8 }), '8100007': P('Gus Out', 'NYK', 'G', 14, 3, 4), '8100004': P('Hal Board', 'NYK', 'C', 14, 11, 2, 0.62) } },
      [A2.id]: { tip: A2.tip, away: 'LAL', home: 'GSW', players: { '8100001': P('Ace Guard', 'LAL', 'G', 27.5, 4, 3) } } } };
  const ST = (o = {}) => ({ ...clone(REAL), today: etDate(now), generated: at(now - 2 * H), injuriesAsOf: etDate(now), slate: clone(SLATE), props: clone(props), corr: PUB.corrState(), ...o });
  const RD = at(now - 90 * 60e3);
  const ids = (n, sp, tl) => ({ event: '90' + n, ml: { home: `0ML90${n}_1`, away: `0ML90${n}_3` }, spread: sp != null ? { home: `0HC90${n}${sp < 0 ? 'N' : 'P'}${Math.round(Math.abs(sp) * 100)}_1`, away: `0HC90${n}${sp < 0 ? 'P' : 'N'}${Math.round(Math.abs(sp) * 100)}_3` } : null, total: tl != null ? { over: `0OU90${n}O${Math.round(tl * 100)}_1`, under: `0OU90${n}U${Math.round(tl * 100)}_3` } : null });
  const LINES = { v: 1, at: RD, games: {
    [A1.id]: { at: RD, espn: A1.espn, ml: { home: -150, away: 130 }, spread: { line: -3.5, home: -110, away: -110 }, total: { line: 226.5, over: -110, under: -110 }, ids: ids(1, -3.5, 226.5),
      props: { at: RD, mains: [
        { player: '8100001', stat: 'pts', line: 24.5, over: -110, under: -110 }, { player: '8100001', stat: 'pra', line: 36.5, over: 100, under: -120 },
        { player: '8100002', stat: 'reb', line: 7, over: -110, under: -110 }, { player: '8100003', stat: 'reb', line: 9.5, over: -150, under: 120 }, { player: '8100003', stat: 'ast', line: 3.5, over: 120, under: -150 },
        { player: '8100005', stat: 'pts', line: 15.5, over: -105, under: -115 }, { player: '8100006', stat: 'blk', line: 0.5, over: 200, under: -250 },
        { player: '8100007', stat: 'pts', line: 10.5, over: -110, under: -110 }, { player: '8100099', stat: 'pts', line: 8.5, over: -110, under: -110 }],
        ladders: [{ player: '8100001', stat: 'pts', k: 25, price: -115 }, { player: '8100001', stat: 'pts', k: 30, price: 250 }, { player: '8100002', stat: 'reb', k: 8, price: 105 },
          { player: '8100003', stat: 'reb', k: 10, price: 100 }, { player: '8100003', stat: 'ast', k: 3, price: -110 }, { player: '8100005', stat: 'pts', k: 16, price: 105 }, { player: '8100007', stat: 'pts', k: 12, price: 100 }],
        yes: [{ player: '8100004', market: 'dd', price: -150 }, { player: '8100004', market: 'td', price: 1500 }] } },
    [A2.id]: { at: RD, espn: A2.espn, ml: { home: 120, away: -140 }, spread: null, total: { line: 230.5, over: 120, under: null }, ids: null,
      props: { at: RD, mains: [], ladders: [{ player: '8100001', stat: 'pts', k: 25, price: -115 }], yes: [] } },
    [A3.id]: { at: RD, espn: A3.espn, ml: { home: -200, away: 170 }, spread: { line: -5.5, home: -110, away: -110 }, total: null, ids: { ...ids(3, -5.5, null), ml: { home: null, away: '0ML903_3' } }, props: null },
    [A4.id]: { at: RD, espn: A4.espn, ml: { home: -150, away: 130 }, spread: null, total: null, ids: null, props: null },
    [A5.id]: { at: RD, espn: A5.espn, ml: { home: -150, away: 130 }, spread: null, total: null, ids: null, props: null },
    [A6.id]: { at: RD, espn: A6.espn, ml: { home: -150, away: 130 }, spread: null, total: null, ids: null, props: null } } };
  check(D1 < D2 && D2 < D3 && etDate(now) < D1, `the made-up games fall on three dates after today (${D1}, ${D2}, ${D3}), so the horizon is the first two`);

  /* ---------- 1. nothing read before the tab opens; then lines.json once, no-store ---------- */
  let p = load(ST(), { lines: LINES });
  await sleep(300);
  await provoke(p);
  check(!linesReqs(p).length && !espnReqs(p).length, `nothing is read before the Parlay Builder opens: not lines.json, not ESPN, on load or on any timer or event (${p.timers.length} timers fired)`);
  await openTab(p);
  for (const t of ['slate', 'teams', 'parlay']) { p.d.querySelector(`#nav button[data-tab=${t}]`).click(); await sleep(20); }
  await provoke(p);
  const lr = linesReqs(p);
  check(lr.length === 1 && lr[0].opt && lr[0].opt.cache === 'no-store' && !lr[0].opt.headers && /^lines\.json$/.test(lr[0].url) && !espnReqs(p).length, `opening the tab reads lines.json once, no-store, and opening it again reads nothing (${lr.length} reads)`);
  const tab = p.d.getElementById('tab-parlay'), panel = p.d.getElementById('pbPanel'), body = p.d.getElementById('parlayBody');
  check(tab.firstElementChild === panel && panel.nextElementSibling === body && !body.nextElementSibling && tab.children.length === 2, 'the tab is the panel over the builder, and nothing else');
  check(p.d.getElementById('oddsBar').hidden && panel.querySelector('[data-espn-refresh="pb"]') && body.querySelector('[data-espn-refresh="builder"]'), "the board's odds bar is not over the tab: its own Refresh odds is in the controls and in the builder");
  for (const b of p.d.querySelectorAll('#tab-parlay [data-espn-refresh]')) { const st = p.d.getElementById(b.getAttribute('aria-describedby'));
    check(b.tagName === 'BUTTON' && p.w.getComputedStyle(b).minHeight === '44px' && st && st.getAttribute('role') === 'status' && st.getAttribute('aria-live') === 'polite' && /DraftKings' lines and player props as published/.test(st.textContent),
      `the ${b.dataset.espnRefresh === 'pb' ? "controls'" : "builder's"} Refresh odds is a 44px button with its own polite status line, saying when the lines were published ("${txt(st).slice(0, 70)}")`); }
  check(/^Top 50 lines/.test(txt(panel.querySelector('h2'))) && txt(panel.querySelector('.pb-hd .pb-pill')) === `${p.w.eval(`dayName(${JSON.stringify(D1)})`)} ${p.w.eval(`dayNum(${JSON.stringify(D1)})`)} & ${p.w.eval(`dayName(${JSON.stringify(D2)})`)} ${p.w.eval(`dayNum(${JSON.stringify(D2)})`)}`, `headed "Top 50 lines", with the two dates (${txt(panel.querySelector('.pb-hd'))})`);

  /* ---------- 2. the games: the two dates, by day, never preseason, never started ---------- */
  const gameIds = () => [...p.d.querySelectorAll('#pbPanel [data-pb-game]')].map(x => x.dataset.pbGame);
  check(JSON.stringify(gameIds()) === JSON.stringify([A1.id, A2.id, A3.id]), `the games are every game still to tip on the two dates, never preseason, not the third date's, not one that has tipped (${gameIds().join(', ')})`);
  const days = [...p.d.querySelectorAll('#pbPanel .pb-gday')].map(x => [txt(x.querySelector('h3')), [...x.querySelectorAll('[data-pb-game]')].map(c => c.dataset.pbGame)]);
  check(days.length === 2 && days[0][1].join() === [A1.id, A2.id].join() && days[1][1].join() === A3.id && /^\w{3} \w{3} \d{1,2}$/.test(days[0][0]), `listed under their day (${days.map(x => x[0]).join(' / ')})`);
  check([...p.d.querySelectorAll('#pbPanel [data-pb-game]')].every(c => c.checked) && p.d.querySelector('#pbPanel details.pb-games').open && /All 3/.test(txt(p.d.querySelector('#pbPanel .pb-games summary'))), 'all ticked to start, the list open on a wide screen');

  /* ---------- 3. the list: which legs, their part, order and numbers, each bet once ---------- */
  const st0 = ST(), cands = candidatesOwn(st0, LINES), own = pbTopOwn(cands, TICKS_ALL);
  const q = (pid, stat, mk, x) => own.q.find(e => e.l.pid === pid && e.l.stat === stat && e.l.mk === mk && (x == null || e.l.line === x || e.l.k === x || e.l.side === x));
  const want = (e, v) => e && e.q === v, inList = l => own.rows.some(r => keyOwn(r) === keyOwn(l));
  const ace25 = own.q.find(e => e.l.id === A1.id && e.l.pid === '8100001' && e.l.mk === 'mile' && e.l.k === 25), ace25b = own.q.find(e => e.l.id === A2.id && e.l.pid === '8100001' && e.l.k === 25);
  const aceO = own.q.find(e => e.l.pid === '8100001' && e.l.stat === 'pts' && e.l.mk === 'main' && e.l.side === 'over');
  const bo8 = own.q.find(e => e.l.pid === '8100002' && e.l.mk === 'mile'), boO = own.q.find(e => e.l.pid === '8100002' && e.l.mk === 'main' && e.l.side === 'over');
  const cyU = own.q.find(e => e.l.pid === '8100003' && e.l.stat === 'ast' && e.l.mk === 'main' && e.l.side === 'under'), cy3 = own.q.find(e => e.l.pid === '8100003' && e.l.stat === 'ast' && e.l.mk === 'mile');
  const cy10 = own.q.find(e => e.l.pid === '8100003' && e.l.stat === 'reb' && e.l.mk === 'mile'), cyRO = own.q.find(e => e.l.pid === '8100003' && e.l.stat === 'reb' && e.l.mk === 'main' && e.l.side === 'over');
  const eli16 = own.q.find(e => e.l.pid === '8100005' && e.l.mk === 'mile'), eliO = own.q.find(e => e.l.pid === '8100005' && e.l.mk === 'main' && e.l.side === 'over');
  /* the cases bite: each is what this file says it is before the page is held to it */
  check(want(aceO, 'value') && want(ace25, 'value') && !inList(ace25.l) && inList(aceO.l), "a milestone that is the same bet as a qualifying main Over (Ace Guard's 25+ points and Over 24.5) is left out, the main line kept");
  check(want(boO, 'value') && boO.l.line === 7 && want(bo8, 'value') && inList(bo8.l), "a whole-number main Over (Bo Wing's rebounds Over 7, a push at 7) leaves his 8+ in");
  check(want(cyU, 'value') && ['thin', 'value'].includes(cy3.q) && inList(cy3.l), "an Under main line (Cy Center's assists Under 3.5) leaves a milestone on the same stat in");
  check(cyRO.q === 'edge' && want(cy10, 'value') && inList(cy10.l), "a milestone whose main Over does not qualify (Cy Center's 10+ rebounds, Over 9.5 at -150) is kept");
  check(want(eliO, 'thin') && want(eli16, 'value') && !inList(eli16.l) && inList(eliO.l), "a Value-pick milestone is left out for its thin-edge main Over (Eli Forward's 16+ points, Over 15.5)");
  check(want(ace25b, 'value') && inList(ace25b.l), 'the same milestone in another game is kept');
  check(own.q.some(e => e.l.pid === '8100006' && e.q === 'far') && !own.q.some(e => e.l.pid === '8100007' || e.l.pid === '8100099'), "a line far off DraftKings' fair chance is left out (Fay Blocker), and a player the report has out or the model does not project is never a leg");
  const a3ml = own.q.find(e => e.l.id === A3.id && e.l.kind === 'ml' && e.l.side === 'ORL');
  check(a3ml && a3ml.q === 'noId', "a game leg with no betslip id at its line, where its game's lines carry ids, is left out (the Magic to win)");
  const got = rows(p).map(rowRead), wantRows = own.rows.map(rowWant);
  const bad = wantRows.map((x, i) => [x, got[i]]).filter(([x, g]) => !g || JSON.stringify({ ...x }) !== JSON.stringify({ key: g.key, part: g.part, rank: g.rank, rk: g.rk, price: g.price, model: g.model, fair: g.fair, win: g.win, ev: g.ev, value: g.value, trial: g.trial }));
  check(got.length === wantRows.length && !bad.length && wantRows.length > 10, `the list is exactly this file's: ${wantRows.length} lines, each its part, rank, price, model chance, fair chance, wins and expected on $1, Value and on-trial marks${bad.length ? ': ' + bad.slice(0, 2).map(([x, g]) => JSON.stringify(x) + ' got ' + JSON.stringify(g)).join(' | ') : ''}`);
  const parts = got.map(g => g.part), firstOther = parts.indexOf('other');
  check(firstOther > 0 && parts.slice(firstOther).every(x => x === 'other') && own.rows.slice(own.rows.findIndex(r => r.total)).every(r => r.total) && own.rows.some(r => r.total) && !own.rows.find(r => r.total).part.includes('value'),
    'the Value picks come first, then the other lines, the game totals last of all, never a Value pick');
  const tov = own.rows.find(r => r.id === A2.id && r.kind === 'total');
  check(tov && tov.side === 'over' && tov.p === 0.5 && Math.abs(tov.ev - 0.1) < 1e-12 && own.rows.filter(r => r.part === 'other' && !r.total).every(r => r.ev < tov.ev) && own.rows.findIndex(r => r === tov) > own.rows.findIndex(r => r.part === 'other' && !r.total),
    "the Lakers at the Warriors' total, priced on its Over alone at +120, is put at 50% and expected to make $0.10, more than any thin-edge line, and is still listed after every one of them");
  check(got.filter(g => g.trial).length === own.rows.filter(r => r.kind === 'prop').length && got.every((g, i) => g.trial === (own.rows[i].kind === 'prop')) && got.every((g, i) => g.value === (own.rows[i].part === 'value')),
    'every player line wears the on-trial mark and no other line does; every Value pick wears Value and no other line does');
  const trialMk = p.d.querySelector('#pbPanel .pb-trial');
  check(trialMk && /on trial/.test(trialMk.textContent) && /props model is on trial/.test(trialMk.title) && /4,321 of the 30,000/.test(trialMk.title), `the on-trial mark is titled with what it means ("${trialMk && trialMk.title.slice(0, 90)}")`);
  const secs = [...p.d.querySelectorAll('#pbPanel h3.pb-topsec')].map(h => [h.dataset.pbSec, txt(h)]), olO = p.d.querySelector('#pbPanel ol.pb-top[data-pb-sec="other"]');
  const nV = own.rows.filter(r => r.part === 'value').length;
  check(secs.length === 2 && secs[0][0] === 'value' && secs[0][1] === `Value picks ${nV}` && secs[1][1] === `Other lines ${own.rows.length - nV}` && olO && olO.getAttribute('start') === String(nV + 1), `two parts under their headings, each counted, the ranks running on (${secs.map(x => x[1]).join(' / ')}, start ${olO && olO.getAttribute('start')})`);
  const notes = [...p.d.querySelectorAll('#pbPanel .pb-note')].map(txt).join(' | ');
  check(/1 line is left out: the model rates it 15 points or more above DraftKings’ fair chance/.test(notes) && /1 line is left out: the list takes a game’s moneyline, spread or total only with DraftKings’ betslip id/.test(notes) && /Game totals are never Value picks/.test(notes), `the notes say what was left out and why, and that the totals come last (${notes.slice(0, 160)})`);
  check(/the props model’s, which is on trial/.test(txt(p.d.querySelector('#pbPanel .pb-lead'))) && (txt(panel).match(/on trial, not yet shown to beat DraftKings/g) || []).length === 1, 'the lead says once that a player\'s chance is the props model\'s, on trial');
  check(own.same === 2 && p.w.getPbTop().same === 2, `two milestones are left out as the same bet as their main line (${p.w.getPbTop().same})`);

  /* the engine the levels are built by (drawn nowhere on this tab: Suggested Parlays will draw them), on the same legs:
     each level's chance, price and fair chance the builder's own sums, and its card marking every player leg on trial
     and every Value pick Value, and nothing else */
  {
    const T = p.w.getPbTiers(), built = T.tiers.filter(t => t.legs);
    const sums = built.map(t => { const r = JSON.parse(p.w.eval(`(() => { const t = getPbTiers().tiers.find(x => x.id === ${JSON.stringify(t.id)}); const L = t.legs; return JSON.stringify({ p: parlayProb(L).corr, d: parlayDec(L.map(l => ({ leg: l, ml: l.price }))), f: parlayFair(L) }); })()`)); return { t, r }; });
    check(built.length === 4 && sums.every(({ t, r }) => Math.abs(t.corr - r.p) < 1e-12 && Math.abs(t.dec - r.d) < 1e-12 && Math.abs(t.fair.p - r.f.p) < 1e-12 && t.legs.length === t.n),
      `the four levels (${built.map(t => t.id + ' ' + t.legs.length).join(', ')}) are priced by the builder's own parlayProb, parlayDec and parlayFair`);
    check(built.every(t => t.legs.every(l => own.q.some(e => keyOwn(e.l) === l.sk && ['value', 'thin', 'total'].includes(e.q)) && (pbIsOwn(l) === (own.q.find(e => keyOwn(e.l) === l.sk).q === 'value')))),
      'every leg a level takes qualifies by this file\'s rule, and is a Value pick exactly where this file says');
    const box = p.d.createElement('div'); box.innerHTML = built.map(t => p.w.pbTierCard(t) + p.w.pbTierCard(t, { quiet: true })).join('');
    const lis = [...box.querySelectorAll('.pb-legs li')], legsOf = built.flatMap(t => [...t.legs, ...t.legs]);
    check(lis.length === legsOf.length && lis.every((li, i) => !!li.querySelector('.pb-trial') === (legsOf[i].kind === 'prop') && !!li.querySelector('.pb-valmark') === pbIsOwn(legsOf[i])),
      "a level's card marks each player leg on trial, each Value pick Value, and nothing else");
    check(built.some(t => t.thin) ? box.querySelectorAll('.pb-thin').length === built.filter(t => t.thin).length + built.filter(t => t.mkt).length : true, "the quiet card (o.quiet) leaves out the lines saying why a leg is not a Value pick, which the other draws");
    /* a level's Add to builder puts exactly its legs in the builder, which then prices them as the level did */
    const med = built.find(t => t.id === 'med'), host = p.d.createElement('div'); host.innerHTML = p.w.pbTierCard(med); p.d.getElementById('pbPanel').appendChild(host);
    host.querySelector('[data-pb-add="med"]').click(); await sleep(30);
    const inB = mine(p.w).slip.legs, payB = p.d.querySelector('#pbBuild [data-payout]');
    check(inB.length === med.legs.length && med.legs.every(l => inB.some(x => keyOwn(x) === l.sk)) && payB && Math.abs(+payB.dataset.payout - 20 * med.dec) < 1e-9,
      `a level's Add to builder puts exactly its ${med.legs.length} legs in the builder, which pays what the level said on the Bet amount`);
    p.d.getElementById('pClear').click(); await sleep(20);
    check(!mine(p.w).slip.legs.length, 'and Clear ALL empties it again');
  }

  /* ---------- 4. the controls: 44px, and every choice the reader's own ---------- */
  const h44 = el => el && p.w.getComputedStyle(el).minHeight === '44px';
  const ctl = [...p.d.querySelectorAll('#pbPanel [data-pb-mix], #pbPanel .pb-chip, #pbPanel .pb-games summary, #pbPanel [data-pb-games], #pbPanel [data-pb-leg], #pbPanel .pb-amt')];
  check(ctl.length > 10 && ctl.every(h44) && [...p.d.querySelectorAll('#pbPanel .pb-g')].every(x => p.w.getComputedStyle(x).minHeight === '48px'), `every control is 44px (${ctl.length}, and each game 48px)`);
  check(p.d.querySelector('#pbPanel [data-pb-mix="all"]').getAttribute('aria-pressed') === 'true' && p.d.querySelector('#pbPanel .pb-seg').getAttribute('role') === 'group', 'the mix All is lit to start');
  const mixTo = async k => { p.d.querySelector(`#pbPanel [data-pb-mix="${k}"]`).click(); await sleep(20); };
  await mixTo('teams');
  check(rows(p).every(li => !li.querySelector('.pb-trial')) && rows(p).length === pbTopOwn(cands, { k: { ml: true, ats: true, total: true, over: false, under: false }, off: [] }).rows.length && p.d.activeElement === p.d.querySelector('#pbPanel [data-pb-mix="teams"]'),
    'Teams only: no player line, the list this file makes on the team boxes, the focus kept on the button');
  check(JSON.stringify(mine(p.w).pb.k) === '{"ml":true,"ats":true,"total":true,"over":false,"under":false}', 'and the boxes are saved in the page\'s own key');
  await mixTo('players');
  check(rows(p).length && rows(p).every(li => li.querySelector('.pb-trial')), 'Players only: player lines alone');
  const kind = p.d.querySelector('#pbPanel [data-pb-kind="under"]'); kind.click(); await sleep(20);
  check(!p.d.querySelector('#pbPanel [data-pb-mix].on') && rows(p).length && rows(p).every(li => !/\|prop\|.*\|under$/.test(rowRead(li).key)) && p.d.activeElement === p.d.querySelector('#pbPanel [data-pb-kind="under"]'), 'Player unders unticked by hand lights no mix, and the list keeps no player Under');
  await mixTo('all');
  check(rows(p).some(li => rowRead(li).key.startsWith(A2.id)), 'the Lakers at the Warriors have lines on the list');
  p.d.querySelector(`#pbPanel [data-pb-game="${A2.id}"]`).click(); await sleep(20);
  check(!rows(p).some(li => rowRead(li).key.startsWith(A2.id)) && /2 of 3/.test(txt(p.d.querySelector('#pbPanel .pb-games summary'))) && JSON.stringify(mine(p.w).pb.off) === JSON.stringify([A2.id]) && p.d.activeElement === p.d.querySelector(`#pbPanel [data-pb-game="${A2.id}"]`), 'a game unticked leaves the list, the summary says 2 of 3, it is saved, the focus kept on its box');
  p.d.querySelector('#pbPanel [data-pb-games="none"]').click(); await sleep(20);
  check(/No games ticked/.test(txt(p.d.querySelector('#pbPanel .pb-top-none'))), 'None empties the list, and says why');
  p.d.querySelector('#pbPanel [data-pb-games="all"]').click(); await sleep(20);
  check(rows(p).length === own.rows.length && !mine(p.w).pb.off.length, 'All brings them back');
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 5. Add, Added, Remove, and the same-game refusals ---------- */
  const k = l => keyOwn(l), aceKey = k(aceO.l), mlH = own.q.find(e => e.l.id === A1.id && e.l.kind === 'ml' && e.l.side === 'NYK'), spH = own.q.find(e => e.l.id === A1.id && e.l.kind === 'spread' && e.l.side === 'NYK');
  const praU = own.q.find(e => e.l.pid === '8100001' && e.l.stat === 'pra' && e.l.side === 'under'), totO = own.q.find(e => e.l.id === A1.id && e.l.kind === 'total' && e.l.side === 'over');
  check(mlH.q === 'thin' && spH.q === 'value' && praU.q === 'value' && totO.q === 'total', "the cases: the Knicks to win (thin), to cover -3.5 (Value), Ace Guard's points + rebounds + assists Under (Value), the total Over");
  let b = addBtn(p, aceKey); b.focus(); b.click(); await sleep(20);
  b = addBtn(p, aceKey);
  const sl = () => mine(p.w).slip.legs;
  const aceLeg = { id: A1.id, away: 'BOS', home: 'NYK', date: A1.date, tip: A1.tip, kind: 'prop', pid: '8100001', name: 'Ace Guard', team: 'BOS', at: RD, stat: 'pts', mk: 'main', line: 24.5, side: 'over', odds: -110, other: -110 };
  check(sl().length === 1 && JSON.stringify(sl()[0]) === JSON.stringify(aceLeg), `Add puts the leg in the builder exactly as a game's Player props would, dated by its read (${JSON.stringify(sl()[0])})`);
  check(b.textContent === 'Added' && b.getAttribute('aria-pressed') === 'true' && p.d.activeElement === b && /^Remove Ace Guard, Over 24\.5 points, from the builder$/.test(b.getAttribute('aria-label')), 'its button reads Added, pressed, named for taking it out, the focus kept on it');
  check(p.d.getElementById('nLegs').textContent === '1' && !p.d.getElementById('nLegs').hidden, "the tab's badge counts the builder's legs");
  addBtn(p, k(praU.l)).click(); await sleep(20);
  const no = rows(p).find(li => rowRead(li).key === k(praU.l)).querySelector('.pb-no');
  check(sl().length === 1 && no && /^Not added: Ace Guard's points over 24\.5 and pts \+ reb \+ ast share a part/.test(no.textContent) && /share a part/.test(p.d.getElementById('pbSaid').textContent) && p.d.getElementById('pbSaid').getAttribute('aria-live') === 'polite',
    `a leg the NBA's same-game rules refuse is refused, and why is said at its row and in the builder's status line ("${no && no.textContent}")`);
  addBtn(p, k(mlH.l)).click(); await sleep(20); addBtn(p, k(spH.l)).click(); await sleep(20);
  check(sl().length === 2 && /^Not added: One side bet a game: your parlay already has Knicks to win/.test(txt(rows(p).find(li => rowRead(li).key === k(spH.l)).querySelector('.pb-no'))), 'the moneyline and the spread of one game are refused together, and said so');
  addBtn(p, k(totO.l)).click(); await sleep(20);
  const a3v = own.q.find(e => e.l.id === A2.id && e.l.mk === 'mile');
  addBtn(p, k(a3v.l)).click(); await sleep(20);
  check(sl().length === 4 && !p.d.querySelector('#pbPanel .pb-no'), 'the total and a leg of another game join, and the refusal line is gone once something else is done');
  addBtn(p, k(mlH.l)).click(); await sleep(20);
  check(sl().length === 3 && addBtn(p, k(mlH.l)).textContent === 'Add', 'a second press on an Added line takes it out');

  /* ---------- 6. the builder's numbers, worked out here ---------- */
  const Lb = sl(), desc = l => l.kind === 'prop' ? { game: l.id, kind: l.stat, player: l.pid, team: l.team, side: l.side, home: l.home } : { game: l.id, kind: { ml: 'win', spread: 'cover', total: 'over' }[l.kind], team: l.kind === 'total' ? '' : l.side, side: l.side, home: l.home };
  const rho = (a, b) => CJ.rhoFor(CT, desc(a), desc(b)) || 0;
  const groups = ls => { const m = new Map(); for (const l of ls) { if (!m.has(l.id)) m.set(l.id, []); m.get(l.id).push(l); } return [...m.values()]; };
  const joint = (ps, ls) => ps.length === 1 ? ps[0] : CJ.joint2(ps[0], ps[1], rho(ls[0], ls[1]));
  const ownPrice = ls => { let dec = 1, prod = 1, fair = 1, model = 1;
    for (const g of groups(ls)) { const mult = g.reduce((t, l) => t * decOf(l.odds), 1); prod *= mult; dec *= g.length > 1 ? Math.min(mult, HOLD / joint(g.map(l => imp(l.odds)), g)) : mult;
      fair *= joint(g.map(l => fairOwn(l, st0).p), g); model *= joint(g.map(l => modelOwn(l, st0)), g); }
    return { dec, prod, fair, model }; };
  const amOwn = v => v >= 0.5 ? -Math.round(100 * v / (1 - v)) : Math.round(100 * (1 - v) / v);
  const ob = ownPrice(Lb), pbPage = JSON.parse(p.w.eval(`(() => { const L = pbOrder(M.slip.legs).map(l => pbView(l)); return JSON.stringify({ p: parlayProb(L), f: parlayFair(L), d: parlayDec(L.map(l => ({ leg: l, ml: l.price }))) }); })()`));
  check(groups(Lb).some(g => g.length === 2) && Math.abs(pbPage.p.corr - ob.model) < 1e-9 && Math.abs(pbPage.f.p - ob.fair) < 1e-9 && Math.abs(pbPage.d - ob.dec) < 1e-9 && pbPage.f.est && ob.dec < ob.prod,
    `the page's parlayProb, parlayFair and parlayDec on the builder's legs (two of one game, one of another) are this file's: the copula of the model's chances (${ob.model.toFixed(5)}), of DraftKings' fair chances (${ob.fair.toFixed(5)}, est.), and min(the prices multiplied, ${HOLD} / J) (${ob.dec.toFixed(4)}, under the product ${ob.prod.toFixed(4)})`);
  const bd = p.d.getElementById('pbBuild'), hero = bd.querySelector('.pb-box.hero'), payout = bd.querySelector('[data-payout]'), conf = bd.querySelector('.pb-box.tier');
  const bandOwn = v => { const r = Math.round(v * 100) / 100; return r >= 0.75 ? 'HIGH' : r >= 0.6 ? 'MED' : r >= 0.55 ? 'LOW' : 'UNDER 55%'; };
  check(hero && hero.querySelector('[data-fair]').textContent === (ob.fair * 100).toFixed(1) + '%' && /^fair chance all 3 land, est\.$/.test(txt(hero.querySelector('span'))) && txt(hero.querySelector('[data-model]')) === `model says ${(ob.model * 100).toFixed(1)}%, on trial`,
    `the builder leads with DraftKings' fair chance, the model's beside it, on trial with a player leg in (${txt(hero)})`);
  check(payout && Math.abs(+payout.dataset.payout - 20 * ob.dec) < 1e-9 && payout.textContent === '$' + (20 * ob.dec).toFixed(2) && conf && txt(conf.querySelector('b')) === bandOwn(ob.fair) && txt(bd.querySelectorAll('.pb-box')[1].querySelector('b')) === am(amOwn(ob.model)),
    `what $20 pays at the same-game price, the confidence band on the fair chance (${txt(conf)}), the fair price for the model's chance`);
  const lr2 = [...bd.querySelectorAll('tr.legrow')], ordOwn = [...Lb].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || nameOwn(a).localeCompare(nameOwn(b)) || cmpKey(a, b));
  function nameOwn(l) { const nk = t => ({ BOS: 'Celtics', NYK: 'Knicks', LAL: 'Lakers', GSW: 'Warriors', MIA: 'Heat', ORL: 'Magic' })[t] || t; return l.kind === 'prop' ? l.name : l.kind === 'total' ? `${nk(l.away)} at ${nk(l.home)}` : nk(l.side); }
  check(lr2.length === 3 && lr2.every((tr, i) => tr.dataset.pbRow === keyOwn(ordOwn[i])) && lr2.every((tr, i) => !!tr.querySelector('.pb-trial') === (ordOwn[i].kind === 'prop')),
    `its rows are the legs in the builder's order, the day then the name (${ordOwn.map(nameOwn).join(', ')}), each player's chance marked on trial`);
  const rowAce = lr2.find(tr => tr.dataset.pbRow === aceKey);
  check(rowAce && txt(rowAce.querySelector('[data-pb-p]')) === pct(modelOwn(aceLeg, st0)) && txt(rowAce.querySelector('.legfair')) === `fair ${pct(1 - imp(-110))}` && /Not on DraftKings’ slip yet: no betslip id in ESPN’s feed/.test(txt(rowAce)) && /^-110 real/.test(txt(rowAce.querySelector('.pb-px'))),
    `a player's row: the model's chance, DraftKings' fair chance, the line that he goes on DraftKings' slip by hand, DraftKings' price (${txt(rowAce)})`);
  const rowTot = lr2.find(tr => tr.dataset.pbRow === k(totO.l));
  check(rowTot && !rowTot.querySelector('.dkslip') && txt(rowTot.querySelector('[data-pb-p]')) === '50%', "the total, with its betslip id, carries no slip line, its chance the market's own (50%)");
  check(bd.querySelector('[data-sl-why]') && /untested on the NBA/.test(txt(bd.querySelector('[data-sl-why]'))) && /\$\d/.test(txt(bd.querySelector('[data-sl-why]'))), 'the same-game note: what multiplying would say, and the hold said untested');
  check([...bd.querySelectorAll('[data-drop], #pFinish, #pClear, [data-stake-chip], #pStake, #pBook')].every(h44), 'every builder control is 44px');
  check(p.d.querySelector('.pb-move') && p.d.querySelectorAll('.pb-move tbody tr').length === 1, 'the legs that move together are listed');

  /* ---------- 7. the Bet amount: one number, $1 to $100,000, cents kept ---------- */
  const SR = [['25', 25], [' 40 ', 40], ['7.5', 7.5], ['12.346', 12.35], ['$1,250', 1250], ['0.4', 1], ['100001', 100000], ['1e3', 1000], [60, 60], ['', null], ['  ', null], ['abc', null], ['-5', null], ['0', null], ['NaN', null], ['Infinity', null], [NaN, null], [Infinity, null], [-3, null], [0, null], [null, null], [undefined, null], [true, null], [{}, null]];
  const srBad = SR.filter(([v, want]) => { const g = p.w.eval(`stakeRead(${v === undefined ? 'undefined' : typeof v === 'number' && !isFinite(v) ? String(v) : JSON.stringify(v)})`); return g !== want; });
  check(!srBad.length, `stakeRead: an amount in dollars, $ and commas allowed, to the cent, $1 to $100,000, and nothing else an amount (${SR.length} cases)${srBad.length ? ': ' + JSON.stringify(srBad) : ''}`);
  const pbS = p.d.getElementById('pbStake');
  check(pbS && pbS.value === '20' && pbS.min === '1' && pbS.max === '100000' && pbS.getAttribute('inputmode') === 'decimal' && p.d.getElementById(pbS.getAttribute('aria-describedby')), 'the Bet amount box starts at $20, $1 to $100,000, the decimal keypad, its hint beside it');
  pbS.value = '37.5'; pbS.dispatchEvent(new p.w.Event('input', { bubbles: true })); await sleep(320);
  check(mine(p.w).stake === 37.5 && +p.d.getElementById('pStake').value === 37.5 && Math.abs(+p.d.querySelector('[data-payout]').dataset.payout - 37.5 * ob.dec) < 1e-9, 'typing an amount sets it, saved, and the builder follows a moment later');
  pbS.value = ''; pbS.dispatchEvent(new p.w.Event('input', { bubbles: true })); pbS.dispatchEvent(new p.w.Event('change', { bubbles: true })); await sleep(20);
  check(mine(p.w).stake === 37.5 && +pbS.value === 37.5, 'a box left empty, no amount, leaves the amount as it was');
  p.d.querySelector('[data-stake-chip="50"]').click(); await sleep(20);
  check(mine(p.w).stake === 50 && p.d.getElementById('pbStake').value === '50' && p.d.querySelector('[data-stake-chip="50"]').getAttribute('aria-pressed') === 'true' && p.d.querySelector('[data-payout]').textContent === '$' + (50 * ob.dec).toFixed(2), "the builder's one-tap amounts set the same number");
  const ps = p.d.getElementById('pStake'); ps.value = '12.5'; ps.dispatchEvent(new p.w.Event('input', { bubbles: true })); await sleep(10);
  check(p.d.getElementById('pbStake').value === '12.50' || p.d.getElementById('pbStake').value === '12.5', "the builder's own stake box sets it too, the panel's box following as it is typed");
  ps.dispatchEvent(new p.w.Event('change', { bubbles: true })); await sleep(20);
  check(mine(p.w).stake === 12.5 && !/NaN|Infinity|undefined/.test(txt(p.d.getElementById('tab-parlay'))), 'nothing drawn from it is NaN');
  for (const [v, want] of [['abc', 20], [-4, 20], [0, 20], [null, 20], ['<b>', 20], [250000, 100000], [12.5, 12.5]]) {
    const q2 = load(ST(), { lines: LINES, mine: { picks: {}, build: [], slip: { legs: [], stake: 20 }, stake: v }, tab: 'parlay' }); await sleep(300);
    check(q2.d.getElementById('pbStake') && +q2.d.getElementById('pbStake').value === want && q2.errors.length === 0, `a saved amount of ${JSON.stringify(v)} reads as $${want}`); }
  { const q3 = load(ST(), { lines: LINES, mine: { picks: {}, build: [], slip: { legs: [], stake: 33 } }, tab: 'parlay' }); await sleep(300);
    check(q3.d.getElementById('pbStake').value === '33', "where no Bet amount was saved, the old builder's stake is read as it, once"); }

  /* ---------- 8. Finish, Clear ALL, a game that tips while the page is open ---------- */
  p.d.getElementById('pFinish').click(); await sleep(20);
  const card = p.w.NBA_SLIP.card();
  check(!p.d.getElementById('pcBack').hidden && card && card.n === 3 && card.html.includes(`pays on $12.50`) && [...p.d.querySelectorAll('#pcBody .pc-legs li')].length === 3, "Finish parlay opens the card on the builder's legs and its Bet amount");
  check([...p.d.querySelectorAll('#pcBody .pc-legs li b')].map(x => x.textContent).join('|') === ordOwn.map(l => l.kind === 'prop' ? l.name : `${l.away} at ${l.home}`).join('|') && txt(p.d.querySelector('#pcBody [data-pc-price] b')).startsWith(am(ob.dec >= 2 ? (ob.dec - 1) * 100 : -100 / (ob.dec - 1))),
    "the card lists them in the builder's order, at the builder's price");
  p.d.getElementById('pcClose').click(); await sleep(20);
  check(p.d.activeElement === p.d.getElementById('pFinish'), 'closing the card gives the focus back to Finish parlay');
  /* A1 tips a second and a half from now */
  p.w.eval(`S.slate.find(g => g.id === ${JSON.stringify(A1.id)}).tip = ${JSON.stringify(new Date(Date.now() + 1500).toISOString())}`);
  await sleep(1700);
  for (const t of p.timers.filter(t => t.k === 'setInterval' && t.ms === 30000)) t.fn();
  await sleep(30);
  check(!gameIds().includes(A1.id) && !rows(p).some(li => rowRead(li).key.startsWith(A1.id)) && sl().length === 1 && /BOS at NYK has tipped off: its 2 legs left your parlay\./.test(p.d.getElementById('slSaid').textContent),
    `a game that tips while the page is open leaves the games, the list and the builder at the half-minute look, said once ("${p.d.getElementById('slSaid').textContent}")`);
  p.w.confirm = () => false; p.d.getElementById('pClear').click(); await sleep(20);
  check(sl().length === 1, 'Clear ALL asks first, and a no keeps the legs');
  p.w.confirm = () => true; p.d.getElementById('pClear').click(); await sleep(20);
  check(!sl().length && p.d.getElementById('pbTitle') && p.d.activeElement === p.d.getElementById('pbTitle') && /Add a line from the Top 50 above/.test(txt(p.d.getElementById('pbBuild'))), 'and a yes empties the builder, which says how to fill it');
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 9. a press: newer reads over lines.json, in memory, nothing stored ---------- */
  {
    const ESPN_CODE = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
    const ev = (g, hml, aml) => ({ id: g.espn, date: g.tip, season: { year: SEASON, type: 2 }, competitions: [{ neutralSite: false, status: { type: { name: 'STATUS_SCHEDULED', completed: false } },
      odds: [{ provider: { id: '100', name: 'DraftKings' }, details: `${ESPN_CODE[g.home] || g.home} -1.5`, overUnder: 226.5, moneyline: { home: { close: { odds: hml } }, away: { close: { odds: aml } } } }],
      competitors: [{ homeAway: 'home', team: { abbreviation: ESPN_CODE[g.home] || g.home }, score: '0' }, { homeAway: 'away', team: { abbreviation: ESPN_CODE[g.away] || g.away }, score: '0' }] }] });
    const sb = { [ymd(A1.date)]: { events: [ev(A1, '-125', '+105'), ev(A2, '+120', '-140')] }, [ymd(A3.date)]: { events: [ev(A3, '-200', '+170')] } };
    const espn = async url => { const m = /dates=(\d{8})/.exec(url); if (/propBets/.test(url)) return { ok: false, status: 404, json: async () => ({ error: { code: 404 } }) };
      return { ok: true, status: 200, json: async () => clone(sb[m && m[1]] || { events: [] }) }; };
    const q = load(ST(), { lines: LINES, espn, tab: 'parlay' }); await sleep(300);
    const before = stored(q.w), mlKey = keyOwn({ id: A1.id, kind: 'ml', side: 'NYK', line: null });
    const rowOf = key => [...q.d.querySelectorAll('#pbPanel li.pb-trow')].find(li => rowRead(li).key === key);
    check(rowOf(mlKey) && rowRead(rowOf(mlKey)).price === '-150' && rowRead(rowOf(mlKey)).part === 'other', "before a press the Knicks' moneyline is lines.json's, -150, a thin edge");
    const bt = q.d.querySelector('#pbPanel [data-espn-refresh]'); bt.focus(); bt.click(); await sleep(30);
    for (let i = 0; i < 400 && q.d.getElementById('oddsBar').classList.contains('busy'); i++) await sleep(25);
    await sleep(60);
    const r1 = rowOf(mlKey);
    check(r1 && rowRead(r1).price === '-125' && rowRead(r1).part === 'value' && rowRead(r1).model === '62%', `after a press the Knicks' moneyline is DraftKings' newer -125 and now a Value pick (${r1 && JSON.stringify(rowRead(r1))})`);
    check(!q.d.querySelector(`#pbPanel [data-pb-leg^="${A1.id}|prop"]`), "and the press's props read (none posted, a 404) is newer than lines.json's, so the game has no player lines");
    check(stored(q.w) === before, 'nothing is stored by the press');
    check(q.d.activeElement && q.d.activeElement.dataset.espnRefresh === 'pb' && /DraftKings' lines from ESPN, read/.test(txt(q.d.getElementById('espnSt-pb'))), `the focus is back on the pressed button, its status line saying what was read ("${txt(q.d.getElementById('espnSt-pb')).slice(0, 80)}")`);
    const q2 = load(ST(), { lines: LINES, espn, tab: 'parlay' }); await sleep(300);
    const li2 = [...q2.d.querySelectorAll('#pbPanel li.pb-trow')].find(x => rowRead(x).key === mlKey);
    check(li2 && rowRead(li2).price === '-150' && !espnReqs(q2).length, 'a reload is the published lines again, and reads nothing from ESPN');
    check(q.errors.length === 0 && q2.errors.length === 0, 'no script errors: ' + q.errors.concat(q2.errors).join(' | '));
  }

  /* ---------- 10. the 50-line cut, on sixty made-up games ---------- */
  {
    const TM = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
    const G60 = [], L60 = { v: 1, at: RD, games: {} };
    for (let i = 0; i < 60; i++) {
      const ms = (i < 30 ? T1 : T2) + (i % 30) * 60e3, a = TM[i % 30], h = TM[(i % 30 + (i < 30 ? 1 : 2)) % 30];
      const pH = i < 40 ? 0.600 - 0.001 * i : 0.550 - 0.001 * (i - 40);
      const g = game(ms, a, h, { pHome: +pH.toFixed(3), spread: -3 }); G60.push(g);
      L60.games[g.id] = { at: RD, espn: g.espn, ml: { home: -110, away: -110 }, spread: null, total: null, ids: { event: '8' + i, ml: { home: `0ML8${i}_1`, away: `0ML8${i}_3` }, spread: null, total: null }, props: null };
    }
    const st60 = ST({ slate: G60, props: { ...clone(props), games: {} } });
    const q = load(st60, { lines: L60, tab: 'parlay', mine: { picks: {}, build: [], slip: { legs: [], stake: 20 }, pb: { k: { ml: true, ats: false, total: false, over: false, under: false }, off: [] } } }); await sleep(400);
    const r = [...q.d.querySelectorAll('#pbPanel li.pb-trow')].map(rowRead), byP = G60.map((g, i) => ({ g, i })).sort((x, y) => (y.g.model.pHome - x.g.model.pHome));
    const wantK = byP.slice(0, 50).map(x => keyOwn({ id: x.g.id, kind: 'ml', side: x.g.home, line: null }));
    const own60 = pbTopOwn(candidatesOwn(st60, L60), { k: { ml: true, ats: false, total: false, over: false, under: false }, off: [] });
    check(r.length === 50 && JSON.stringify(r.map(x => x.key)) === JSON.stringify(wantK) && JSON.stringify(own60.rows.map(keyOwn)) === JSON.stringify(wantK), 'sixty games, Moneyline only, home sides at -110: the list is the first 50 of their order, the forty Value picks from 60.0% down to 56.1% and then the ten best thin-edge lines, 55.0% to 54.1%');
    check(r.slice(0, 40).every(x => x.part === 'value' && x.value) && r.slice(40).every(x => x.part === 'other' && !x.value) && own60.over === 60 && q.w.getPbTop().over === 60, 'the parts count 40 and 10, and 60 qualified for the 50 the list holds');
    const sec = [...q.d.querySelectorAll('#pbPanel h3.pb-topsec')].map(txt);
    check(sec.join('|') === 'Value picks 40|Other lines 10' && q.d.querySelector('#pbPanel ol[data-pb-sec="other"]').getAttribute('start') === '41' && /^Top 50 lines/.test(txt(q.d.querySelector('#pbPanel h2'))) && r.every(x => !x.trial), 'under "Top 50 lines", the other lines ranked from 41, no on-trial mark on a team line');
    check(q.errors.length === 0, 'no script errors: ' + q.errors.join(' | '));
  }

  /* ---------- 11. lines.json that does not load, and the off-season ---------- */
  {
    const q = load(ST(), { lines: 'junk', tab: 'parlay' }); await sleep(300);
    check(/The published lines did not load/.test(txt(q.d.getElementById('espnSt-pb'))) && /did not load/.test(txt(q.d.querySelector('#pbPanel .pb-note'))) && !q.d.querySelectorAll('#pbPanel li.pb-trow').length && q.errors.length === 0, 'a lines.json that does not load lists nothing, says so, and throws nothing');
    const q2 = load(ST({ slate: [A4, A6].map(clone) }), { lines: LINES, tab: 'parlay' }); await sleep(300);
    check(/No game is left to build a parlay from/.test(txt(q2.d.getElementById('pbPanel'))) && !q2.d.getElementById('pbStake') && q2.errors.length === 0, 'with no game to come but a preseason one, the tab says there is nothing to build from, with no controls');
  }

  /* ---------- 12. the real state.json and lines.json, on what the day offers ---------- */
  {
    const LF = path.join(ROOT, 'lines.json'), realLines = fs.existsSync(LF) ? JSON.parse(fs.readFileSync(LF, 'utf8')) : undefined;
    const q = load(REAL, { lines: realLines, tab: 'parlay' }); await sleep(600);
    const st = { ...REAL, today: etDate(Date.now()) }, games = gamesOwn(st), soon = games.some(g => Math.abs(Date.parse(g.tip) - Date.now()) < 120e3);
    const r = [...q.d.querySelectorAll('#pbPanel li.pb-trow')].map(rowRead);
    if (!games.length) check(/No game is left/.test(txt(q.d.getElementById('pbPanel'))), 'on the real state with no game to come, the tab says there is nothing to build from');
    else if (soon) check(true, 'on the real state a game tips within two minutes: the list is not compared this run');
    else {
      const ownR = pbTopOwn(candidatesOwn(st, realLines), TICKS_ALL).rows.map(rowWant), badR = ownR.map((x, i) => [x, r[i]]).filter(([x, g]) => !g || JSON.stringify(x) !== JSON.stringify({ key: g.key, part: g.part, rank: g.rank, rk: g.rk, price: g.price, model: g.model, fair: g.fair, win: g.win, ev: g.ev, value: g.value, trial: g.trial }));
      check(r.length === ownR.length && !badR.length, `on the real state and lines.json, the list is this file's own, line for line (${r.length} lines over ${games.length} games)${badR.length ? ': ' + badR.slice(0, 2).map(([x, g]) => JSON.stringify(x) + ' got ' + JSON.stringify(g)).join(' | ') : ''}`);
    }
    check(!/\bNaN\b|\bundefined\b/.test(txt(q.d.getElementById('tab-parlay'))) && q.errors.length === 0, 'the real tab shows no NaN or undefined and throws nothing');
    check(SIGMA_OWN === +q.w.eval('SIGMA') && SIG_FILE.fold === 2026 && SIG_FILE.lineup === 'known', `the page prices a spread on research/sigma.json's sigma (${SIGMA_OWN}, the 2026 fold, lineup known)`);
  }
};
