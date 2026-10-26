/* Suggested Parlays, a section of the viewer smoke test (README "Suggested Parlays"): run by tools/smoke.js, alone with
 *
 *   SMOKE_ONLY=sp node tools/smoke.js
 *
 * The tab (app/parts/suggested.html) boots in jsdom on a made-up November slate of its own, a made-up lines.json in the
 * shape tools/lines.js writes, a props block of its own and made-up records, the page's clock moved to each moment a
 * case needs (so every case holds at any hour on any day, the off-season included), and every rule it states is worked
 * out here on its own, never read from the page: which games are featured and which night is set out (nightOwn, through
 * the time zone database, America/New_York, a DST turn of each kind among them), the wait line's words and instant, the
 * lock lines word for word, each level's numbers against the builder's own sums and the Safe pair against every pair of
 * its pool, the record's pills from made-up ledgers (spRecOwn), the Elo picks against a full enumeration of their own
 * candidates (eloOwn, on the ELO Model's own chance at its own margin's miss, pick.sigmaModel), the on-trial mark on every player leg and
 * nowhere else, Add, Add to builder and Finish, the browser's own lock across a reload and given way to the record's, a
 * ruled-out level built again alone, nothing stored but nba_sp_lock_v1 and nothing read but the record and lines.json,
 * each once and no-store; then the real files, on what the day offers. Every request is recorded.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = async function suggested({ check, pageFile, ROOT }) {
  console.log('Suggested Parlays');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => JSON.parse(JSON.stringify(x));
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const PJ = require('./props');
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const SEASON = REAL.season, Y = SEASON - 1, H = 3600e3;
  const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100), decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
  const am = q => q >= 0.5 ? -Math.round(100 * q / (1 - q)) : Math.round(100 * (1 - q) / q);
  const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
  const ymd = d => d.replace(/-/g, ''), T = (d, hm) => `${d}T${hm}Z`;

  /* ---------- this file's own copies of the rules ---------- */
  const NY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const nyParts = ms => Object.fromEntries(NY.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  /* the instant of 6:00 in New York on a date: the UTC hour whose New York reading is that date at 06:00 */
  const sixAm = d => { for (let h = 0; h < 24; h++) { const t = Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00Z`), p = nyParts(t); if (`${p.year}-${p.month}-${p.day}` === d && p.hour === '06' && p.minute === '00') return t; } return null; };
  const featOwn = g => g.type !== 'PRE' && Array.isArray(g.tv) && g.tv.length > 0;
  const toCome = (g, now) => g.status === 'scheduled' && Date.parse(g.tip) > now;
  /* one night at a time: the first Eastern date with a featured game to come, all of them, from 6:00 AM New York time
     the day after the latest featured date before it */
  function nightOwn(st, now) {
    const G = st.slate.filter(g => featOwn(g) && toCome(g, now)).sort((a, b) => Date.parse(a.tip) - Date.parse(b.tip));
    if (!G.length) return { games: [], open: null, up: false };
    const D = G[0].date, games = G.filter(g => g.date === D);
    const prev = st.slate.filter(g => featOwn(g) && g.date < D).map(g => g.date).sort().pop() || null;
    const open = prev ? sixAm(addDay(prev, 1)) : null;
    return { games, open, prev, up: open == null || now >= open };
  }
  const etWd = ms => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' ET';
  const wdLong = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const NICK = { BOS: 'Celtics', NYK: 'Knicks', LAL: 'Lakers', GSW: 'Warriors', MIA: 'Heat', ORL: 'Magic', DEN: 'Nuggets', PHX: 'Suns', CHI: 'Bulls', DET: 'Pistons', MIL: 'Bucks', TOR: 'Raptors', CLE: 'Cavaliers' };
  const andOwn = a => a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0] || '';
  function waitOwn(st, now) {
    const N = nightOwn(st, now); if (!N.games.length || N.up) return null;
    const nets = N.games.map(g => andOwn(g.tv)), same = nets.every(x => x === nets[0]), nm = g => `${NICK[g.away]} at ${NICK[g.home]}`;
    const what = same ? `${wdLong(N.games[0].date)} on ${nets[0]}, ${andOwn(N.games.map(nm))}` : `${wdLong(N.games[0].date)}, ${andOwn(N.games.map((g, i) => `${nm(g)} on ${nets[i]}`))}`;
    const pg = st.slate.filter(g => featOwn(g) && g.date === N.prev).length;
    return { at: new Date(N.open).toISOString().slice(0, 19) + 'Z', next: N.games.map(g => g.id).join(' '),
      text: `Next up: ${what}. ${N.games.length > 1 ? 'Their sets go' : 'Its set goes'} up ${etWd(N.open)}, the morning after ${wdLong(N.prev)}’s featured ${pg > 1 ? 'games' : 'game'}.` };
  }
  const lockOwn = g => Date.parse(g.tip) - 2 * H;
  /* the record a level: each season's game and level once, from the last key that holds it */
  function spRecOwn(L) {
    const out = {}, last = new Map(); let pending = 0;
    for (const id of ['safe', 'med', 'aggr', 'xtrm']) out[id] = { g: 0, w: 0, l: 0, push: 0, f: 0, fn: 0, m: 0, u: 0 };
    for (const k of Object.keys(L.featured || {}).sort()) { const e = L.featured[k]; for (const t of e.tiers || []) { const g = e.grade && e.grade[t.id]; if (g && t.legs) last.set(`${e.season}|${e.gid}|${t.id}`, [t, g]); } }
    for (const [t, g] of last.values()) { const s = out[t.id]; if (g.result === 'pending') { pending++; continue; } if (g.result === 'push') { s.push++; continue; }
      s.g++; if (g.result === 'won') s.w++; else s.l++; s.m += t.p; if (t.fair != null) { s.f += t.fair; s.fn++; } s.u += (g.result === 'won' ? g.payout : 0) - 1; }
    return { out, pending };
  }
  const LBL = { safe: 'Safe', med: 'Medium', aggr: 'Aggressive', xtrm: 'Extreme' };
  const pillsOwn = L => { const { out, pending } = spRecOwn(L), any = Object.values(out).some(s => s.g || s.push);
    const un = v => (v > 0.0005 ? '+' : v < -0.0005 ? '−' : '') + Math.abs(v).toFixed(2);
    if (!any) return { pills: [['none', 'No featured set graded yet', null]], pending };
    return { pills: Object.entries(out).map(([id, s]) => [id, `${LBL[id]} ${s.w}–${s.l} ${s.g || s.push ? un(s.u) + ' units' : ''}`.trim(),
      `${LBL[id]}: ${s.g} graded, ${s.w} won${s.g ? `; wins expected ${s.fn ? s.f.toFixed(1) + ' by DraftKings’ fair chance' + (s.fn < s.g ? ` (on the ${s.fn} with one)` : '') + ', ' : ''}${s.m.toFixed(1)} by the model` : ''}${s.push ? `; ${s.push} push${s.push === 1 ? '' : 'es'}, the stake back` : ''}`]), pending }; };

  /* ---------- the made-up November ---------- */
  const D0 = `${Y}-11-16`, D1 = addDay(D0, 1), D2 = addDay(D0, 2), D3 = addDay(D0, 3), D4 = addDay(D0, 4);
  const side = (t, out) => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
  const mk = (date, a, h, tip, tv, model, o) => ({ id: `${SEASON}_${ymd(date)}_${a}_${h}`, date, tip, type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '8' + ymd(date).slice(4) + a + h,
    tv, awayScore: null, homeScore: null, line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 224, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5 }, ...o });
  const gY = { ...mk(D0, 'MIL', 'CLE', T(D1, '00:00'), ['ESPN'], { pHome: 0.6 }), status: 'final', awayScore: 104, homeScore: 112 };
  const gA = mk(D1, 'BOS', 'NYK', T(D2, '00:30'), ['NBC'], { pHome: 0.66, spread: -5, total: 226 });
  const gB = mk(D1, 'LAL', 'GSW', T(D2, '03:00'), ['ESPN', 'ESPN2'], { pHome: 0.45, spread: 2, total: 231 });
  const gC = mk(D1, 'MIA', 'ORL', T(D2, '00:00'), [], { pHome: 0.6, spread: -4, total: 220 });
  const gD = mk(D2, 'DEN', 'PHX', T(D3, '02:00'), ['ESPN'], { pHome: 0.4, spread: 3, total: 233 });
  const gE = mk(D2, 'CHI', 'DET', T(D2, '23:00'), [], { pHome: 0.7, spread: -7, total: 222 });
  const gF = mk(D3, 'MIL', 'TOR', T(D4, '00:30'), ['TNT'], { pHome: 0.35, spread: 4, total: 228 });
  const SLATE = [gY, gA, gB, gC, gD, gE, gF];
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'];
  const ROWS = {
    [gA.id]: { 9300001: ['Ace Guard', 'BOS', 'G', 34, 27.5, 5, 6, 3, 1.2, 0.4, 0.2, 0.02], 9300002: ['Bo Wing', 'BOS', 'F', 32, 18, 7.5, 3, 2, 1, 0.6, 0.15, 0.01],
      9300003: ['Cy Big', 'NYK', 'C', 30, 14, 11, 2.5, 0.5, 0.7, 1.6, 0.45, 0.01], 9300004: ['Di Point', 'NYK', 'G', 35, 22, 4, 8, 2.5, 1.4, 0.3, 0.3, 0.03],
      9300005: ['Ed Forward', 'NYK', 'F', 29, 16, 6, 2, 1.5, 0.8, 0.5, 0.08, 0.005], 9300006: ['Fi Sixth', 'BOS', 'G', 24, 11, 3, 2, 1.8, 0.6, 0.2, 0.01, 0],
      9300007: ['Gi Listed', 'BOS', 'F', 26, 15, 6, 2, 1.4, 0.7, 0.4, 0.05, 0] },
    [gD.id]: { 9300021: ['Io Center', 'DEN', 'C', 35, 26, 12, 9, 1, 1.3, 0.8, 0.7, 0.25], 9300022: ['Ju Guard', 'DEN', 'G', 33, 20, 4, 5, 2.4, 1, 0.3, 0.06, 0.01],
      9300023: ['Ka Wing', 'PHX', 'F', 34, 25, 6, 4, 2.8, 1, 0.5, 0.12, 0.01], 9300024: ['Lu Point', 'PHX', 'G', 32, 18, 3.5, 7, 2, 1.2, 0.2, 0.1, 0.01] } };
  const VAR = REAL.props.dist.var, COMBOS = REAL.props.combos;
  const muOf = (row, k) => k in COMBOS ? COMBOS[k].reduce((t, s) => t + row[LAY.indexOf(s)], 0) : row[LAY.indexOf(k)];
  function mainOf(pid, row, stat, line, sd, shift = 0) {
    const m = muOf(row, stat), pOv = PJ.pOver(line, m, PJ.nbVar(m, VAR[stat])), p = sd === 'over' ? pOv : 1 - pOv;
    const chosen = p - 0.05 + shift, other = sd === 'over' ? 1 - p + 0.08 : 1 - p + 0.03;
    return sd === 'over' ? { player: String(pid), stat, line, over: am(chosen), under: am(other) } : { player: String(pid), stat, line, over: am(other), under: am(chosen) };
  }
  const PLAN = { [gA.id]: [[9300001, 'pts', 24.5, 'over'], [9300002, 'reb', 9.5, 'under'], [9300003, 'reb', 9.5, 'over'], [9300004, 'ast', 6.5, 'over'], [9300005, 'pts', 17.5, 'under'], [9300006, 'tpm', 1.5, 'over'], [9300007, 'pts', 12.5, 'over']],
    [gD.id]: [[9300021, 'reb', 10.5, 'over'], [9300022, 'pts', 18.5, 'over'], [9300023, 'pts', 26.5, 'under'], [9300024, 'ast', 5.5, 'over']] };
  const idsOf = g => ({ event: 'E' + g.espn, ml: { home: `0ML${g.espn}_1`, away: `0ML${g.espn}_3` }, spread: { home: `0HC${g.espn}_1`, away: `0HC${g.espn}_3` }, total: { over: `0OU${g.espn}_1`, under: `0OU${g.espn}_3` } });
  const READ = T(D1, '14:00:00');
  function linesOf(games, o = {}) {
    const out = { v: 1, at: o.at || READ, games: {} };
    for (const g of games) {
      const sp = Math.round(-g.model.spread) - 0.5 * Math.sign(g.model.spread || 1);
      out.games[g.id] = { at: o.at || READ, espn: g.espn, ml: { home: am(g.model.pHome - 0.06), away: am(1 - g.model.pHome + 0.08) }, spread: { line: -Math.abs(sp) * Math.sign(-g.model.spread || 1), home: -110, away: -110 },
        total: { line: Math.floor(g.model.total) + 0.5, over: -110, under: -110 }, ids: idsOf(g),
        props: ROWS[g.id] ? { at: o.at || READ, mains: PLAN[g.id].map(([pid, st, ln, sd]) => mainOf(pid, ROWS[g.id][pid], st, ln, sd, o.shift || 0)), ladders: [], yes: [] } : null };
    }
    return out;
  }
  const RECORD = { 2024: { ml: { picks: 334, said: 0.5907, won: 0.515, units: 9.12 }, spread: { picks: 626, said: 0.6043, won: 0.4936 } }, 2025: { ml: { picks: 393, said: 0.613, won: 0.5064, units: 7.04 }, spread: { picks: 753, said: 0.6143, won: 0.5219 } },
    2026: { ml: { picks: 376, said: 0.5958, won: 0.4574, units: -17.85 }, spread: { picks: 784, said: 0.6158, won: 0.4936 } } };
  const ELO_G = { [gA.id]: { pHome: 0.68, spread: -7.5 }, [gB.id]: { pHome: 0.52, spread: -0.6 }, [gC.id]: { pHome: 0.7, spread: -6.5 }, [gD.id]: { pHome: 0.33, spread: 6 }, [gE.id]: { pHome: 0.78, spread: -10.5 } };
  function stateOf(slate, o = {}) {
    const st = clone(REAL);
    st.slate = slate.map(clone); st.today = o.today || D1; st.generated = o.generated || T(D1, '13:00'); st.asOf = D0;
    st.props = { ...clone(REAL.props), games: Object.fromEntries(slate.filter(g => ROWS[g.id] && g.status === 'scheduled').map(g => [g.id, { tip: g.tip, away: g.away, home: g.home, players: clone(ROWS[g.id]) }])) };
    st.props.ledger = { ...st.props.ledger, decision: null };
    st.report = { date: st.today, players: o.report || { 9300007: ['BOS', 'Day-To-Day', 'Ankle', ''] } };
    st.eloPicks = o.elo === null ? null : { version: 'test', generated: T(D1, '12:00'), status: { ok: true }, sigma: 14.6, pick: { wSpread: 0, wMl: 0, sigma: 13.722, sigmaModel: 14.133, chosenOn: '2024 and 2025' }, record: { chosenOn: '2024 and 2025', folds: RECORD }, games: clone(o.eloGames || ELO_G) };
    return st;
  }

  /* ---------- the harness: the page on a clock of the case's own ---------- */
  let NOW = Date.parse(T(D1, '15:00:00'));
  function load(st, o = {}) {
    const html = fs.readFileSync(pageFile('index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
    const errors = [], requests = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' + (o.hash || ''),
      beforeParse(w) {
        const D0x = w.Date; class D extends D0x { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } w.Date = D;
        w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
          if (/state\.json/.test(url)) return { ok: true, status: 200, json: async () => clone(st) };
          if (/lines\.json/.test(url)) { const L = typeof o.lines === 'function' ? await o.lines() : o.lines; if (!L) return { ok: false, status: 404, json: async () => ({}) }; return { ok: true, status: 200, json: async () => clone(L) }; }
          if (/suggest_ledger\.json/.test(url)) { const R = typeof o.record === 'function' ? await o.record() : o.record; if (!R) return { ok: false, status: 404, json: async () => ({}) };
            return { ok: true, status: 200, json: async () => { if (R === 'junk') throw new SyntaxError('junk'); return clone(R); } }; }
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
        w.scrollTo = () => {}; w.confirm = () => true;
        if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
        if (o.storage) for (const [k, v] of Object.entries(o.storage)) w.localStorage.setItem(k, v);
        if (o.tab) w.localStorage.setItem('nba_hub_2027:tab', o.tab);
        w.addEventListener('error', e => errors.push(e.message));
      } });
    const w = dom.window;
    return { w, d: w.document, errors, requests };
  }
  const settle = async p => { for (let i = 0; i < 200 && !(p.w.eval("typeof S!=='undefined'&&!!S")); i++) await sleep(20); await sleep(80); };
  const openTab = async p => { p.d.querySelector('#nav button[data-tab=suggest]').click(); for (let i = 0; i < 100 && /Loading/.test(txt(p.d.getElementById('spSets'))); i++) await sleep(30); await sleep(40); };
  const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
  const reqOf = (p, re) => p.requests.filter(x => re.test(x.url));
  const sets = p => [...p.d.querySelectorAll('#spSets [data-sp-game]')].map(x => x.dataset.spGame);
  const LINES1 = linesOf([gA, gB, gC, gD, gE]);

  /* ---------- 1. nothing read before the tab opens; then the record and lines.json, once each, no-store ---------- */
  NOW = Date.parse(T(D1, '15:00:00'));
  let p = load(stateOf(SLATE), { lines: LINES1, record: null });
  await settle(p);
  check(p.requests.length === 1 && /state\.json/.test(p.requests[0].url), `nothing but state.json is read before the tab opens (${p.requests.map(x => x.url).join(', ')})`);
  const btn = p.d.querySelector('#nav button[data-tab=suggest]'), navOrder = [...p.d.querySelectorAll('#nav button')].filter(b => !b.hidden).map(b => b.dataset.tab).join();
  check(btn && txt(btn) === 'Suggested Parlays' && navOrder === 'slate,suggest,parlay,xparlays,teams,players,coaches,pickem,record', `the tab is Suggested Parlays, after Tonight (${navOrder})`);
  const before = JSON.stringify([dump(p.w.localStorage), dump(p.w.sessionStorage)]);
  await openTab(p);
  check(reqOf(p, /suggest_ledger\.json/).length === 1 && reqOf(p, /lines\.json/).length === 1 && reqOf(p, /suggest_ledger\.json|lines\.json/).every(x => x.opt && x.opt.cache === 'no-store') && p.requests.length === 3,
    `opening it reads the record and lines.json once each, no-store, and nothing else (${p.requests.map(x => x.url).join(', ')})`);
  check(p.w.location.hash === '#suggest', 'its address is #suggest');
  p.d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20); await openTab(p);
  check(p.requests.length === 3, 'opening it again reads nothing');
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 2. which games: featured, one night at a time ---------- */
  const st1 = stateOf(SLATE), N1 = nightOwn(st1, NOW);
  check(JSON.stringify(sets(p)) === JSON.stringify(N1.games.map(g => g.id)) && N1.games.length === 2, `the morning of D1 the tab sets out D1's two featured games, in tip-off order, and nothing of gC (local TV), D2 or D3 (${sets(p).map(x => x.slice(-7)).join(', ')})`);
  check([...p.d.querySelectorAll('#spSets [data-sp-tv]')].map(txt).join('|') === 'NBC|ESPN · ESPN2' && [...p.d.querySelectorAll('#spSets .sp-hd h3')].map(txt).join('|') === 'Celtics at Knicks|Lakers at Warriors', 'each set names its networks and its clubs');
  { const hd = p.d.querySelector('#spHead .pb-hd'), night = `${new Date(D1 + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })} ${new Date(D1 + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    check(txt(hd.querySelector('h2')) === 'Suggested Parlays' && txt(hd.querySelector('[data-sp-night]')) === night && hd.children.length === 2, `the head is the heading and the night's date (${night})`); }
  check(!p.d.querySelector('#spPanel .pb-foot') && !p.d.querySelector('#spHead .pb-lead') && !p.d.querySelector('#spSets .pb-lead'), 'no lead paragraph, no foot');
  /* the night's turn: after D1's last featured tip the wait line names D2's, until 6:00 AM New York the next morning */
  NOW = Date.parse(gB.tip) + 30 * 60e3; p.w.spWatchTick(); await sleep(30);
  let W = waitOwn(st1, NOW), wl = p.d.querySelector('#spSets .sp-wait');
  check(W && wl && wl.dataset.spWait === W.at && wl.dataset.spNext === W.next && txt(wl) === W.text && !sets(p).length, `after D1's last tip-off the half-minute look draws the wait line, its instant, games and words this file's own ("${txt(wl)}")`);
  check(W && W.text === `Next up: Wednesday on ESPN, Nuggets at Suns. Its set goes up Wed 6:00 AM ET, the morning after Tuesday’s featured games.` || Y !== 2026, 'the wait line reads as the owner was promised (2026\'s calendar)');
  const turn = Date.parse(W.at);
  NOW = turn - 1000; p.w.spWatchTick(); await sleep(20);
  check(p.d.querySelector('#spSets .sp-wait') && !sets(p).length, 'a second before 6:00 AM the line stands');
  const stTurn = p.w.spState();
  NOW = turn; p.w.spWatchTick(); await sleep(30);
  check(JSON.stringify(sets(p)) === JSON.stringify([gD.id]) && !p.d.querySelector('#spSets .sp-wait') && p.w.spState() !== stTurn && /on=[^,]*DEN_PHX/.test(p.w.spState()), "at 6:00 AM the half-minute look sets out D2's game (spState's on= moved)");
  /* the clocks' turns: a night after the Sunday they go back and one after the Sunday they go forward */
  for (const [label, sun] of [['back', (() => { for (let d = 1; d <= 7; d++) { const x = `${Y}-11-0${d}`; if (new Date(x + 'T12:00:00Z').getUTCDay() === 0) return x; } })()], ['forward', (() => { let c = 0; for (let d = 1; d <= 14; d++) { const x = `${SEASON}-03-${String(d).padStart(2, '0')}`; if (new Date(x + 'T12:00:00Z').getUTCDay() === 0 && ++c === 2) return x; } })()]]) {
    const sat = addDay(sun, -1);
    const a = { ...mk(sat, 'LAL', 'GSW', T(sun, '03:00'), ['ABC']), status: 'final', awayScore: 100, homeScore: 99 };
    const b = mk(sun, 'BOS', 'NYK', T(addDay(sun, 1), '00:00'), ['NBC']);
    const stX = stateOf([a, b], { today: sun, eloGames: {} }), N = nightOwn(stX, Date.parse(T(sun, '05:00:00')));
    const q = load(stX, { lines: linesOf([b]), record: null, tab: 'suggest' });
    NOW = Date.parse(T(sun, '05:00:00')); await settle(q); await openTab(q);
    const wl2 = q.d.querySelector('#spSets .sp-wait'), open = sixAm(sun);
    NOW = open - 1000; q.w.spWatchTick(); await sleep(20); const still = !!q.d.querySelector('#spSets .sp-wait');
    NOW = open; q.w.spWatchTick(); await sleep(30);
    check(wl2 && wl2.dataset.spWait === new Date(N.open).toISOString().slice(0, 19) + 'Z' && N.open === open && still && JSON.stringify(sets(q)) === JSON.stringify([b.id]),
      `the Sunday the clocks go ${label}: the set goes up at 6:00 AM New York time (${new Date(open).toISOString().slice(11, 16)} UTC), as this file's own reading says`);
  }
  /* no featured game to come, and no game at all (the off-season) */
  { const q = load(stateOf([gY, gC, gE].map(g => g.id === gY.id ? g : g)), { lines: linesOf([gC, gE]), record: null, tab: 'suggest' }); NOW = Date.parse(T(D1, '15:00:00')); await settle(q); await openTab(q);
    check(txt(q.d.querySelector('#spSets [data-sp-none]')) === 'No game on national TV is still to tip in the schedule’s next ten days: a set comes for each one, never for a preseason game.' && !sets(q).length && q.errors.length === 0, 'with no featured game to come the tab says so, and draws no set');
    const q2 = load(stateOf([gY], { eloGames: {} }), { lines: { v: 1, at: READ, games: {} }, record: null, tab: 'suggest' }); await settle(q2); await openTab(q2);
    check(txt(q2.d.querySelector('#spSets [data-sp-none]')) === 'No game is still to tip on the schedule: a set comes for each game on national TV once there is one.' && q2.errors.length === 0, 'with no game at all (the off-season) it says so, and throws nothing');
    const q3 = load(stateOf(SLATE.map(g => g.id === gD.id ? { ...g, type: 'PRE' } : g)), { lines: LINES1, record: null, tab: 'suggest' }); NOW = turn; await settle(q3); await openTab(q3);
    check(!sets(q3).includes(gD.id), 'a preseason game on national TV is never featured'); }

  /* ---------- 3. a set's levels: the builder's own sums, every rule, the marks, the lines ---------- */
  NOW = Date.parse(T(D1, '15:00:00'));
  p = load(stateOf(SLATE), { lines: LINES1, record: null, tab: 'suggest' }); await settle(p); await openTab(p);
  const card = (gid, id) => p.d.querySelector(`#spSets [data-sp-game="${gid}"] [data-pb-tier="${id}"]`);
  const tiersA = ['safe', 'med', 'aggr', 'xtrm'].map(id => p.w.spTier(`${gA.id}:${id}`));
  check(tiersA.every((t, i) => t && t.legs.length === [2, 3, 4, 5][i]), "the first game's four levels are 2, 3, 4 and 5 legs");
  const sums = tiersA.map(t => JSON.parse(p.w.eval(`(() => { const L = spTier(${JSON.stringify(gA.id + ':' + t.id)}).legs; return JSON.stringify({ p: parlayProb(L).corr, d: parlayDec(L.map(l => ({ leg: l, ml: l.price }))), f: parlayFair(L) }); })()`)));
  check(tiersA.every((t, i) => Math.abs(t.corr - sums[i].p) < 1e-12 && Math.abs(t.dec - sums[i].d) < 1e-12 && Math.abs(t.fair.p - sums[i].f.p) < 1e-12), "each level's chance, price and fair chance are the builder's own parlayProb, parlayDec and parlayFair on its legs");
  check(tiersA.every(t => { const pl = t.legs.filter(l => l.kind === 'prop').map(l => l.pid); return new Set(pl).size === pl.length && t.legs.filter(l => l.kind === 'ml' || l.kind === 'spread').length <= 1 && t.legs.filter(l => l.kind === 'total').length <= 1 && t.legs.every(l => l.gid === gA.id); }), 'every level: one leg a player, one side bet and one total at most, every leg its own game');
  check(tiersA.every(t => t.legs.every(l => l.p >= 0.45 && l.p < 0.97 && l.p >= imp(l.price) - 1e-12 && (l.thin === false) === (l.p - imp(l.price) >= 0.03 - 1e-12))), 'every leg in the band, at or above its price, a Value pick exactly where 3 points above it');
  check(tiersA.every(t => t.legs.every(l => l.pid !== '9300007')), 'a player the report lists Day-To-Day is in no level');
  check(tiersA.every(t => t.legs.every(l => { const f = p.w.legFair(l); return !f || l.p - f.p < 0.15; })), 'no leg 15 points or more over DraftKings’ fair chance');
  /* the Safe pair: the likeliest pair of the pool's Value picks the builder takes, worked out over every pair */
  const best = JSON.parse(p.w.eval(`(() => { const pool = spPool(S.slate.find(g => g.id === ${JSON.stringify(gA.id)})), P = pool.pref; let b = null;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) { if (!pbFits([P[i]], P[j])) continue; const L = pbOrder([P[i], P[j]]), pr = parlayProb(L).corr; if (!b || pr > b.pr + 1e-12) b = { pr, ids: L.map(l => l.sk).sort().join() }; }
    return JSON.stringify(b); })()`));
  check(best && tiersA[0].legs.map(l => l.sk).sort().join() === best.ids && Math.abs(tiersA[0].corr - best.pr) < 1e-12, `Safe is the likeliest pair of every pair of the game's Value picks (${(best.pr * 100).toFixed(1)}%)`);
  /* the cards */
  const cA = card(gA.id, 'med'), lisA = [...p.d.querySelectorAll(`#spSets [data-sp-game="${gA.id}"] .pb-legs li`)], legsA = tiersA.flatMap(t => t.legs);
  check(lisA.length === legsA.length && lisA.every((li, i) => !!li.querySelector('.pb-trial') === (legsA[i].kind === 'prop') && !!li.querySelector('.pb-valmark') === (legsA[i].thin === false && !legsA[i].market)), 'every player leg is marked on trial and nothing else is; every Value pick marked Value and nothing else');
  check(tiersA.every(t => { const c = card(gA.id, t.id), trial = t.legs.some(l => l.kind === 'prop'); return txt(c.querySelector('.pb-model')) === (trial ? `model (on trial) ${(t.corr * 100).toFixed(0)}%` : `model says ${(t.corr * 100).toFixed(0)}%`) && txt(c.querySelector('[data-pb-fair]')) === (t.fair.p * 100).toFixed(0) + '%'; }),
    'each card leads with the fair chance, the model\'s beside it said "model (on trial)" where a leg is a player\'s');
  check(tiersA.every(t => { const c = card(gA.id, t.id), pay = c.querySelector('[data-pb-pay]'); return Math.abs(+pay.dataset.pbPay - t.dec) < 1e-12 && txt(pay.querySelector('b')) === '$' + (20 * t.dec).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }), 'each card pays the Bet amount times its price');
  check(![...p.d.querySelectorAll('#spSets .pb-thin')].some(x => /not a Value pick|book’s own chance/.test(txt(x))), 'the cards are quiet: no line saying why a leg is not a Value pick or why a total is there');
  const lineA = p.d.querySelector(`#spSets [data-sp-game="${gA.id}"] .sp-lock`);
  check(lineA.dataset.spPhase === 'live' && txt(lineA) === `Locks ${etWd(lockOwn(gA))}, 2 hours before tip-off.`, `a live set's line, word for word ("${txt(lineA)}")`);
  const ctlB = p.d.querySelector('#spHead [data-espn-refresh]');
  check(ctlB && /Refresh odds/.test(txt(ctlB)) && p.d.querySelector('#spHead [data-espn-status][role=status][aria-live=polite]'), 'Refresh odds and its status line are at the head');
  const h44 = el => el && p.w.getComputedStyle(el).minHeight === '44px';
  const ctls = [...p.d.querySelectorAll('#spPanel [data-pb-leg], #spPanel [data-sp-add], #spPanel [data-pc-finish], #spPanel [data-pb-elo-add], #spPanel [data-espn-refresh]')];
  check(ctls.length > 20 && ctls.every(h44), `every control on the tab is 44px (${ctls.length}; ${ctls.filter(b => !h44(b)).map(b => b.outerHTML.slice(0, 60)).join(' | ')})`);
  /* the Bet amount: every level's payout follows it in place (pbPays), and its Finish pays on it */
  p.w.eval('M.stake = 37.5; pbPays()');
  check(tiersA.every(t => txt(card(gA.id, t.id).querySelector('[data-pb-pay] b')) === '$' + (37.5 * t.dec).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) && /\$37\.50 pays/.test(txt(card(gA.id, t.id).querySelector('[data-pb-pay]')))), 'the payouts follow the Bet amount as it is typed ($37.50)');
  p.w.eval('M.stake = 20; pbPays()');
  /* gB: game lines only, so its larger levels say why */
  const whyB = [...p.d.querySelectorAll(`#spSets [data-sp-game="${gB.id}"] .pb-why`)].map(txt);
  check(whyB.length === 3 && whyB.every(x => /^Only 2 legs in this game, and no player lines the props model prices: it has no projections for this game yet\.$/.test(x)), `a game with no player legs says why its larger levels are empty ("${whyB[0]}")`);
  /* nothing posted when the job read the game: the time is when the feed first held what it holds (tools/lines.js keeps a
     half's time while a read finds the same), so the words say "as of" it and that no read since found any */
  { const why = o => JSON.parse(p.w.eval(`(() => { const id = ${JSON.stringify(gD.id)}, was = LINES.games[id]; LINES.games[id] = ${JSON.stringify(o)};
      try { return JSON.stringify(spBuild(S.slate.find(g => g.id === id)).tiers.map(t => t.why || '')); } finally { LINES.games[id] = was; } })()`));
    const at = T(D1, '09:00:00'), when = etWd(Date.parse(at)), base = linesOf([gD]).games[gD.id];
    const w1 = why({ at: null, espn: gD.espn, ml: null, spread: null, total: null, ids: null, props: { at, mains: [], ladders: [], yes: [] } });
    const w2 = why({ ...base, props: { at, mains: [], ladders: [], yes: [] } });
    check(w1.every(x => x === `No legs in this game yet: DraftKings had posted neither its game lines nor its player props as of ${when}, and no read since has found any. The job reads them through the day, and Refresh odds reads the current ones.`),
      `a game DraftKings had posted nothing for says so as of the read that first found it so ("${w1[0]}")`);
    check(w2.slice(1).every(x => x.endsWith(`no player prices yet: DraftKings had posted no player props for it as of ${when}, and no read since has found any; it posts them a day or so before tip-off, and Refresh odds reads the current ones.`)),
      `and one with no player props posted, likewise ("${w2[1]}")`); }

  /* ---------- 4. Add, Add to builder, Finish ---------- */
  const mine = () => JSON.parse(p.w.localStorage.getItem('nba_hub_2027') || '{}');
  const leg0 = card(gA.id, 'med').querySelector('[data-pb-leg]'), k0 = leg0.dataset.pbLeg;
  leg0.focus(); leg0.click(); await sleep(30);
  const leg0b = card(gA.id, 'med').querySelector(`[data-pb-leg="${k0.replace(/"/g, '\\"')}"]`);
  check(mine().slip.legs.length === 1 && leg0b.getAttribute('aria-pressed') === 'true' && txt(leg0b) === 'Added' && p.d.activeElement === leg0b && /^In the builder: /.test(txt(p.d.getElementById('spSaid'))), "a leg's Add puts it in the builder, reads Added, says so, and keeps the focus");
  leg0b.click(); await sleep(30);
  check(mine().slip.legs.length === 0, 'a second press takes it out');
  const addM = card(gA.id, 'med').querySelector('[data-sp-add]');
  addM.click(); await sleep(40);
  const inB = mine().slip.legs, med = tiersA[1];
  check(inB.length === 3 && med.legs.every(l => inB.some(x => p.w.eval('slipKey')(x) === l.sk)) && txt(card(gA.id, 'med').querySelector('[data-sp-add]')) === 'In the builder', 'Add to builder puts exactly the level\'s legs in the builder, and says In the builder');
  p.d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(60);
  const payB = p.d.querySelector('#pbBuild [data-payout]');
  check(payB && Math.abs(+payB.dataset.payout - 20 * med.dec) < 1e-9, 'which then pays what the level said on the Bet amount');
  await openTab(p);
  const fin = card(gA.id, 'med').querySelector('[data-pc-finish]');
  check(fin && fin.dataset.pcFinish === `sp|${gA.id}:med` && txt(fin) === 'Finish', 'each level has its Finish, named sp|<game>:<level>');
  fin.click(); await sleep(30);
  /* the parlay card's part (app/parts/card.html, README "The parlay card") answers it through the resolver the tab
     registers (PARLAY_CARD.from('sp')): the level's legs, its kicker, the Bet amount, and the level's own chance, the
     model's (on trial with a player leg), as its card states it; the card's own percent, a tenth of a point */
  const cpct = x => (x * 100).toFixed(1) + '%';
  { const C = p.w.PARLAY_CARD, m = C && C.current(), trial = med.legs.some(l => l.kind === 'prop');
    check(!p.d.getElementById('pcBack').hidden && m && m.kicker === 'Medium parlay · BOS at NYK' && m.legs.length === 3 && p.d.querySelectorAll('#pcView [data-pc-leg]').length === 3 && m.stake === 20,
      `Finish opens the parlay card on the level's legs at the Bet amount (${m && m.kicker}, ${m && m.legs.length} legs, $${m && m.stake})`);
    check(m && m.source === 'sp' && m.chance === cpct(med.corr) && m.chanceBy === 'Model' && m.trial === trial && p.d.getElementById('pcAgain').hidden,
      `the card states the level's own chance (${m && m.chance}, the level's ${cpct(med.corr)}), the model's${trial ? ', on trial' : ''}, and offers no Start over (the builder's alone)`); }
  p.d.getElementById('pcClose').click(); await sleep(20);
  check(p.d.activeElement === card(gA.id, 'med').querySelector('[data-pc-finish]') || p.d.activeElement === fin, 'closing it gives the focus back');
  /* the tab redrawn while the card is open (a tip-off anywhere, a lock, a read answering) replaces the Finish: closing
     the card puts the focus on the same Finish as drawn now; with none drawn, on the tab's own button, never the body */
  card(gA.id, 'med').querySelector('[data-pc-finish]').click(); await sleep(20);
  p.w.renderSp(); await sleep(10);
  const fin2 = card(gA.id, 'med').querySelector('[data-pc-finish]');
  p.d.getElementById('pcClose').click(); await sleep(20);
  check(fin2 && fin2 !== fin && p.d.activeElement === fin2, 'a redraw while the card is open: closing it puts the focus on the same Finish, as drawn since');
  card(gA.id, 'aggr').querySelector('[data-pc-finish]').click(); await sleep(20);
  p.d.getElementById('spSets').innerHTML = '';
  p.d.getElementById('pcClose').click(); await sleep(20);
  check(p.d.activeElement === p.d.querySelector('#nav button[data-tab=suggest]'), `with that Finish no longer drawn, on the tab's own button (${p.d.activeElement && p.d.activeElement.outerHTML.slice(0, 60)})`);
  p.w.renderSp(); await sleep(10);
  /* a one-game card with no leg carrying a betslip id (player legs alone) opens the game's page from the lines feed's
     event id, no press made */
  { const c = JSON.parse(p.w.eval(`(() => { const L = spPool(S.slate.find(g => g.id === ${JSON.stringify(gA.id)})).pref.filter(l => l.kind === 'prop'), a = L[0], b = L.find(l => l.pid !== a.pid);
      PARLAY_CARD.from('spsmoke', () => ({ legs: [a, b], kicker: 'smoke' })); PARLAY_CARD.open(PARLAY_CARD.fromTier('spsmoke', 'x'));
      const k = document.getElementById('pcDk'), r = { url: k.getAttribute('href'), btn: k.textContent.trim(), shown: !k.hidden, press: !!SG_LINES[${JSON.stringify(gA.id)}] };
      PARLAY_CARD.close(); return JSON.stringify(r); })()`));
    check(!c.press && c.shown && c.url === 'https://sportsbook.draftkings.com/event/' + idsOf(gA).event && c.btn === 'Open game in DraftKings', `a one-game card of player legs opens the game's page from lines.json's event id (${c.btn}, ${c.url})`); }
  p.w.localStorage.setItem('nba_hub_2027', JSON.stringify({ ...mine(), slip: { legs: [], stake: 20 } }));

  /* ---------- 5. the Elo picks: every parlay of their own candidates ---------- */
  const st5 = stateOf(SLATE), LN = LINES1;
  /* the candidates, this file's own: each game's moneyline and spread, the ELO Model's own chance (pHome; a cover
     normCdf((m + h) / pick.sigmaModel), m minus its spread, h the home line: the model's own margin at its own miss, never
     params.pick's sigma, the closing line's), beating the no-vig chance with a positive
     return, -200 to +300, 30% or more, under 15 points over the fair chance, one a game (its best by value) */
  function eloOwn(st, L, ticks) {
    const out = [], sig = st.eloPicks.pick.sigmaModel;
    for (const g of st.slate.filter(x => x.status === 'scheduled' && x.type !== 'PRE' && [D1, D2].includes(x.date) && Date.parse(x.tip) > NOW && !ticks.off.includes(x.id))) {
      const e = L.games[g.id], c = st.eloPicks.games[g.id]; if (!e || !c) continue;
      const cand = [];
      if (ticks.ml) for (const s of ['home', 'away']) cand.push({ kind: 'ml', team: g[s], price: e.ml[s], other: e.ml[s === 'home' ? 'away' : 'home'], pe: s === 'home' ? c.pHome : 1 - c.pHome });
      if (ticks.ats) for (const s of ['home', 'away']) { const h = e.spread.line, pH = PJ.normCdf((-c.spread + h) / sig); cand.push({ kind: 'spread', team: g[s], line: s === 'home' ? h : -h, price: e.spread[s], other: e.spread[s === 'home' ? 'away' : 'home'], pe: s === 'home' ? pH : 1 - pH }); }
      for (const x of cand) { const f = imp(x.price) / (imp(x.price) + imp(x.other)), ev = x.pe * decOf(x.price) - 1;
        if (x.price < -200 || x.price > 300 || !(x.pe > f) || !(ev > 0) || x.pe < 0.3 || x.pe - f >= 0.15) continue; out.push({ ...x, gid: g.id, ev, dec: decOf(x.price) }); }
    }
    out.sort((a, b) => b.ev - a.ev || (a.kind === 'ml' ? -1 : 1));
    const one = []; for (const c of out) if (!one.some(x => x.gid === c.gid)) one.push(c);
    return one;
  }
  function eloBest(C, n, floor) {
    let best = null, likely = null;
    const walk = (s, idx) => { if (idx.length === n) { const L = idx.map(i => C[i]), pr = L.reduce((t, c) => t * c.pe, 1), d = L.reduce((t, c) => t * c.dec, 1);
      if (!likely || pr > likely.pr + 1e-15) likely = { pr, d, L }; if (floor && pr >= floor && (!best || pr * d > best.pr * best.d + 1e-15)) best = { pr, d, L }; return; }
      for (let i = s; i <= C.length - (n - idx.length); i++) walk(i + 1, [...idx, i]); };
    walk(0, []);
    return floor ? (best ? { ...best, likeliest: false } : likely ? { ...likely, likeliest: true } : null) : likely;
  }
  const C5 = eloOwn(st5, LN, { ml: true, ats: true, off: [] });
  const elo = () => ['elo-safe', 'elo-med', 'elo-aggr', 'elo-xtrm'].map(id => p.w.epTier(id));
  const keyOwn = c => `${c.gid}|${c.kind}|${c.team}|${c.kind === 'spread' ? c.line : ''}`, keyPg = l => `${l.gid}|${l.kind}|${l.side}|${l.kind === 'spread' ? l.line : ''}`;
  const E5 = elo();
  check(C5.length >= 4 && JSON.stringify(p.w.epGet().all.map(keyPg).sort()) === JSON.stringify(C5.map(keyOwn).sort()), `the candidates are this file's own: ${C5.map(c => c.kind + ' ' + c.team).join(', ')}`);
  check(p.w.epGet().all.every(l => Math.abs(l.pe - C5.find(c => keyOwn(c) === keyPg(l)).pe) < 1e-12) && p.w.epGet().all.some(l => l.kind === 'spread'), "each candidate's Elo chance is the ELO Model's own, a spread's at its own margin's miss, pick.sigmaModel (ELO_PICK_BLEND off)");
  { const pub = require('./publish').eloPickState([]), rs = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'elo.json'), 'utf8')).pick.spread;
    check(pub && pub.pick && pub.pick.sigmaModel === rs.sigmaModel && rs.sigmaModel > pub.pick.sigma, `publish.js hands the page research/elo.json's sigma of the model alone (pick.sigmaModel ${pub && pub.pick && pub.pick.sigmaModel}) beside params.pick's (${pub && pub.pick && pub.pick.sigma}, the closing line's)`); }
  const wantE = [[2, 0], [3, 0.25], [4, 0.12], [5, 0.05]].map(([n, f]) => eloBest(C5, n, f));
  check(E5.every((t, i) => wantE[i] ? t && JSON.stringify(t.legs.map(keyPg).sort()) === JSON.stringify(wantE[i].L.map(keyOwn).sort()) && Math.abs(t.corr - wantE[i].pr) < 1e-9 && Math.abs(t.dec - wantE[i].d) < 1e-9 && !!t.likeliest === !!(i && wantE[i].likeliest) : !t),
    `the four Elo levels are every parlay's best of their candidates (${E5.map(t => t ? t.legs.length + (t.likeliest ? ' likeliest' : '') : '–').join(', ')})`);
  const eloBox = p.d.getElementById('pbElo'), lead = eloBox.querySelector('[data-pb-elo-lead]');
  check(txt(lead) === 'Moneylines and spreads where the ELO Model’s chance beats DraftKings’ price, on the games and bet types ticked on the Parlay Builder tab.' && eloBox.querySelectorAll('.pb-lead').length === 1, 'the Elo picks lead with one sentence, word for word');
  check(lead.title === "The ELO Model's own chance is no promise. On the walk-forward folds (2024, 2025 and 2026, each called by the model fitted on the seasons before it), its moneylines 3 points or more above the price said 59.1%, 61.3% and 59.6% and won 51.5%, 50.6% and 45.7% (334, 393 and 376 picks), and its spreads 3 points or more above -110 won 49.4%, 52.2% and 49.4% (626, 753 and 784), at the closing lines.",
    'its title gives the measured record of such picks, fold by fold');
  check(![...eloBox.querySelectorAll('.pb-legs li')].some(li => li.querySelector('.pb-valmark') || li.querySelector('.pb-trial')) && [...eloBox.querySelectorAll('.pb-model')].every(x => /^Elo says \d+%$/.test(txt(x))), 'its legs wear no Value or on-trial mark, its cards say "Elo says"');
  check([...eloBox.querySelectorAll('[data-pb-tier]')].every(c => c.querySelector('[data-pb-elo-add]') && c.querySelector('[data-pc-finish^="elo|elo-"]') && c.querySelectorAll('[data-pb-leg]').length === c.querySelectorAll('.pb-legs li').length), 'each Elo level has Add on every leg, Add to builder and Finish');
  { const ea = eloBox.querySelector('[data-pb-elo-add="elo-med"]'), tm = p.w.epTier('elo-med'); ea.click(); await sleep(30);
    check(mine().slip.legs.length === tm.legs.length && tm.legs.every(l => mine().slip.legs.some(x => p.w.eval('slipKey')(x) === l.sk)), "an Elo level's Add to builder puts exactly its legs in the builder");
    const ef = p.d.querySelector('#pbElo [data-pc-finish="elo|elo-med"]'); ef.click(); await sleep(30);
    { const m = p.w.PARLAY_CARD.current(), ch = [...p.d.querySelectorAll('#pcView .pc-chance div')].map(txt).join(' | ');
      check(m && m.kicker === 'Medium Elo pick' && m.source === 'elo' && m.legs.length === tm.legs.length, `and its Finish opens the card, the kicker "Medium Elo pick" (${m && m.kicker})`);
      check(m && m.chance === cpct(tm.corr) && m.chanceBy === 'Elo' && /Elo/.test(ch),
        `the card states the Elo chance the level was built on (${m && m.chance}, the level's ${cpct(tm.corr)}), said to be the Elo's, not the hub's model's: ${ch}`); }
    p.d.getElementById('pcClose').click(); await sleep(10);
    p.d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
    const pf = p.d.getElementById('pFinish'); if (pf) { pf.click(); await sleep(20); }
    { const m = p.w.PARLAY_CARD.current();
      check(!!pf && m && m.source === 'builder' && m.chanceBy === 'Model' && !p.d.getElementById('pcAgain').hidden, "the builder's own Finish parlay is the builder's card again: the model's chance, with Start over"); }
    if (pf) { p.d.getElementById('pcClose').click(); await sleep(10); }
    await openTab(p);
    p.w.localStorage.setItem('nba_hub_2027', JSON.stringify({ ...mine(), slip: { legs: [], stake: 20 } })); }
  /* the Parlay Builder's ticks: Spread unticked, the moneylines alone; no team box ticked, the reason */
  { const m0 = mine(); p.w.localStorage.setItem('nba_hub_2027', JSON.stringify(m0));
    p.w.eval("M.pb = pbClean({ k: { ml: true, ats: false, total: true, over: true, under: true }, off: [] }); saveMine();"); p.w.eval('EP_CACHE.clear(); renderSp()'); await sleep(20);
    const C6 = eloOwn(st5, LN, { ml: true, ats: false, off: [] });
    check(JSON.stringify(p.w.epGet().all.map(keyPg).sort()) === JSON.stringify(C6.map(keyOwn).sort()) && p.w.epGet().all.every(l => l.kind === 'ml'), 'with Spread unticked on the Parlay Builder tab the Elo picks take moneylines alone');
    p.w.eval("M.pb = pbClean({ k: { ml: false, ats: false, total: true, over: true, under: true }, off: [] }); saveMine(); renderSp()"); await sleep(20);
    check(txt(p.d.querySelector('#pbElo [data-pb-elo-none]')) === 'Tick Moneyline or Spread on the Parlay Builder tab for the Elo picks: every leg is a team’s moneyline or spread.', 'with neither ticked it says why there are none');
    p.w.eval("M.pb = pbClean(null); saveMine(); renderSp()"); await sleep(20); }
  /* no price to beat: the lines feed with no moneyline or spread posted, and lines.json not there, each said so, never
     that no line beats DraftKings' price */
  { const noGl = clone(LINES1); for (const e of Object.values(noGl.games)) { e.ml = null; e.spread = null; }
    NOW = Date.parse(T(D1, '15:00:00'));
    const q1 = load(stateOf(SLATE), { lines: noGl, record: null, tab: 'suggest' }); await settle(q1); await openTab(q1);
    const n1 = txt(q1.d.querySelector('#pbElo [data-pb-elo-none]'));
    check(n1 === 'No Elo picks yet: DraftKings had posted no moneyline or spread on the games and bet types ticked when its lines were read. The job reads them through the day, and Refresh odds reads the current ones.', `with no moneyline or spread posted, the Elo picks say there is none to beat ("${n1}")`);
    const q2 = load(stateOf(SLATE), { lines: null, record: null, tab: 'suggest' }); await settle(q2); await openTab(q2);
    const n2 = txt(q2.d.querySelector('#pbElo [data-pb-elo-none]'));
    check(n2 === 'No Elo picks yet: DraftKings’ published lines did not load, so there is no price to beat. Refresh odds reads the current ones.' && q1.errors.length + q2.errors.length === 0, `with lines.json not there, that they did not load ("${n2}")`); }

  /* ---------- 6. the lock: this browser's own, a reload, the record's, a press, a ruled-out level ---------- */
  const st6 = stateOf(SLATE), lockA = lockOwn(gA);
  NOW = lockA + 10 * 60e3;
  let q = load(st6, { lines: LINES1, record: null, tab: 'suggest' }); await settle(q); await openTab(q);
  const lnA = () => q.d.querySelector(`#spSets [data-sp-game="${gA.id}"] .sp-lock`);
  check(lnA().dataset.spPhase === 'own' && txt(lnA()) === `Locked since ${etWd(lockA)}. This browser’s own set: the site’s was not published in time, so the record does not grade it.`, `with no record, this browser's own set at the lock, its line word for word ("${txt(lnA())}")`);
  const kept = JSON.parse(q.w.localStorage.getItem('nba_sp_lock_v1') || 'null'), ownT = ['safe', 'med', 'aggr', 'xtrm'].map(id => q.w.spTier(`${gA.id}:${id}`));
  check(kept && kept.v === 1 && kept.season === SEASON && kept.games[gA.id] && kept.games[gA.id].own === true && kept.games[gA.id].tip === gA.tip && kept.games[gA.id].tiers.length === 4 && Object.keys(kept.games).length === 1, 'it is kept in nba_sp_lock_v1 ({v, season, games: {<game>: {tip, own, at, tiers, rep}}})');
  check(Object.keys(dump(q.w.localStorage)).every(k => ['nba_sp_lock_v1', 'nba_hub_2027', 'nba_hub_2027:tab'].includes(k)) && !Object.keys(dump(q.w.sessionStorage)).length && !/lines|mains|featured/.test(q.w.localStorage.getItem('nba_hub_2027') || ''), 'nothing else is stored: the page key holds only the visitor\'s own');
  /* lines.json slow: the locked game waits for it, keeping nothing; lines.json not there: its set shown, never kept */
  { let release; const slow = new Promise(r => { release = r; });
    const q1 = load(st6, { lines: () => slow, record: null, tab: 'suggest' }); await settle(q1); await openTab(q1); await sleep(40);
    const l1 = q1.d.querySelector(`#spSets [data-sp-game="${gA.id}"] .sp-lock`);
    check(l1 && l1.dataset.spPhase === 'loading' && txt(l1) === `Locked since ${etWd(lockA)}. Loading DraftKings’ lines…` && !q1.w.localStorage.getItem('nba_sp_lock_v1'), `a locked game waits for DraftKings' lines before building a set of its own, keeping nothing ("${l1 && txt(l1)}")`);
    release(LINES1); await sleep(120);
    const l2 = q1.d.querySelector(`#spSets [data-sp-game="${gA.id}"] .sp-lock`), k1 = JSON.parse(q1.w.localStorage.getItem('nba_sp_lock_v1') || 'null');
    check(l2.dataset.spPhase === 'own' && k1 && k1.games[gA.id].tiers.every(t => t.legs && t.legs.length === t.n), 'and once they answer builds it, with its legs, and keeps it');
    const q2 = load(st6, { lines: null, record: null, tab: 'suggest' }); await settle(q2); await openTab(q2); await sleep(40);
    check(q2.d.querySelector(`#spSets [data-sp-game="${gA.id}"] .sp-lock`).dataset.spPhase === 'own' && !q2.w.localStorage.getItem('nba_sp_lock_v1') && q2.errors.length === 0, 'with lines.json not there, the set it shows is never kept, so a reload tries again'); }
  /* a reload, the prices moved: the same set */
  const store = dump(q.w.localStorage);
  NOW = lockA + 20 * 60e3;
  q = load(st6, { lines: linesOf([gA, gB, gC, gD, gE], { shift: -0.02, at: T(D1, '22:40:00') }), record: null, tab: 'suggest', storage: store }); await settle(q); await openTab(q);
  const again = ['safe', 'med', 'aggr', 'xtrm'].map(id => q.w.spTier(`${gA.id}:${id}`));
  check(again.every((t, i) => t && JSON.stringify(t.legs.map(l => [l.sk, l.price])) === JSON.stringify(ownT[i].legs.map(l => [l.sk, l.price])) && Math.abs(t.dec - ownT[i].dec) < 1e-12) && lnA().dataset.spPhase === 'own', 'a reload shows the same set, at its locked prices, though the prices have moved');
  /* a leg's Add on a locked set: the leg as locked */
  { const b = q.d.querySelector(`#spSets [data-sp-game="${gA.id}"] [data-pb-tier="safe"] [data-pb-leg]`), lk = again[0].legs.find(l => l.sk === b.dataset.pbLeg); b.click(); await sleep(30);
    const m = JSON.parse(q.w.localStorage.getItem('nba_hub_2027')).slip.legs[0];
    check(m && m.odds === lk.price && q.w.eval('slipKey')(m) === lk.sk, "a locked leg's Add puts it in at its locked price");
    q.d.querySelector(`#spSets [data-sp-game="${gA.id}"] [data-pb-tier="safe"] [data-pb-leg]`).click(); await sleep(20); }
  /* a press's read after the lock (memory only) changes nothing of the locked set; a live set it re-picks */
  { const liveB0 = q.w.spTier(`${gB.id}:safe`);
    q.w.eval(`SG_LINES[${JSON.stringify(gA.id)}] = Object.assign({ at: ${JSON.stringify(new Date(NOW).toISOString())} }, linesGl(${JSON.stringify(linesOf([gA], { shift: -0.04 }).games[gA.id])}));
      SG_LINES[${JSON.stringify(gB.id)}] = Object.assign({ at: ${JSON.stringify(new Date(NOW).toISOString())} }, linesGl(${JSON.stringify({ ...linesOf([gB]).games[gB.id], ml: { home: -105, away: -115 } })})); renderSp();`); await sleep(20);
    const after = ['safe', 'med', 'aggr', 'xtrm'].map(id => q.w.spTier(`${gA.id}:${id}`)), liveB1 = q.w.spTier(`${gB.id}:safe`);
    check(after.every((t, i) => JSON.stringify(t.legs.map(l => [l.sk, l.price])) === JSON.stringify(ownT[i].legs.map(l => [l.sk, l.price]))) && JSON.stringify(liveB1.legs.map(l => [l.sk, l.price])) !== JSON.stringify(liveB0.legs.map(l => [l.sk, l.price])),
      "a press's newer read moves nothing of a locked set, and re-picks a live one"); }
  /* a ruled-out player: that level alone built again, said in one line, kept */
  { const T0 = ['safe', 'med', 'aggr', 'xtrm'].map(id => q.w.spTier(`${gA.id}:${id}`)), pl = T0.flatMap(t => t.legs.filter(l => l.kind === 'prop').map(l => [l.pid, l.name]));
    const byPid = pl.map(([pid, nm]) => [pid, nm, T0.filter(t => t.legs.some(l => l.pid === pid)).map(t => t.id)]).sort((a, b) => a[2].length - b[2].length)[0];
    q.w.eval(`S.report.players[${JSON.stringify(byPid[0])}] = ['BOS', 'Out', 'Knee', '']; SP_CACHE.clear(); renderSp();`); await sleep(30);
    const T1 = ['safe', 'med', 'aggr', 'xtrm'].map(id => q.w.spTier(`${gA.id}:${id}`)), upd = [...q.d.querySelectorAll(`#spSets [data-sp-game="${gA.id}"] .sp-upd`)];
    const kept2 = JSON.parse(q.w.localStorage.getItem('nba_sp_lock_v1')).games[gA.id];
    check(T1.every((t, i) => byPid[2].includes(t.id) ? !t.legs.some(l => l.pid === byPid[0]) && t.updated && t.updated.by === 'page' : JSON.stringify(t.legs.map(l => l.sk)) === JSON.stringify(T0[i].legs.map(l => l.sk))) && byPid[2].every(id => kept2.rep[id] && kept2.rep[id].pid === byPid[0]),
      `a player listed Out after the lock: the level${byPid[2].length > 1 ? 's' : ''} holding him (${byPid[2].join(', ')}) built again without him, the rest as locked, kept in the browser`);
    check(upd.length === byPid[2].length && upd.every(x => txt(x) === `Updated in this browser: ${byPid[1]} listed out (knee), so held out (${etWd(NOW)}); this level was built again.`), `and said in one line ("${upd[0] && txt(upd[0])}")`); }
  /* the record's set: it takes this browser's place, and its own replacement wins */
  const recEntry = (g, tiers, o = {}) => ({ season: SEASON, date: g.date, gid: g.id, away: g.away, home: g.home, type: 'REG', tip: g.tip, lock: new Date(lockOwn(g)).toISOString().slice(0, 16) + 'Z', tv: g.tv, generated: T(D1, '13:00'),
    pool: {}, tiers, taken_at: T(D1, '16:00:00'), ...o });
  const recTiers = ownT.map(t => q.w.spTierOut(t));
  const REC = { how: 'x', since: D0, updated: T(D1, '16:00:00'), featured_summary: null, featured: { [`${SEASON}|${gA.date}|${gA.tip}|${gA.id}`]: recEntry(gA, clone(recTiers).map(t => ({ ...t, legs: t.legs && t.legs.map(l => ({ ...l, odds: l.odds })) }))) } };
  { NOW = lockA + 30 * 60e3;
    let release; const waitRec = new Promise(r => { release = r; });
    const st6b = stateOf(SLATE);
    q = load(st6b, { lines: LINES1, record: () => waitRec.then(() => REC), tab: 'suggest', storage: dump(q.w.localStorage) }); await settle(q);
    q.d.querySelector('#nav button[data-tab=suggest]').click(); await sleep(60);
    check(lnA() && lnA().dataset.spPhase === 'loading' && txt(lnA()) === `Locked since ${etWd(lockA)}. Loading the site’s set…`, `while the record is read, the locked game waits for it ("${lnA() && txt(lnA())}")`);
    release(); await sleep(80);
    const kp = JSON.parse(q.w.localStorage.getItem('nba_sp_lock_v1') || '{"games":{}}').games[gA.id];
    check(lnA().dataset.spPhase === 'locked' && txt(lnA()) === `Locked since ${etWd(lockA)}.` && (!kp || !kp.own), `the record's set takes its place, its line word for word, the browser's own set dropped ("${txt(lnA())}")`); }
  { const rec2 = clone(REC), e = rec2.featured[Object.keys(rec2.featured)[0]], t = e.tiers.find(x => x.legs && x.legs.some(l => l.kind === 'prop')), out = t.legs.find(l => l.kind === 'prop');
    const nt = clone(e.tiers.find(x => x.id !== t.id && x.legs && x.legs.length >= t.n && !x.legs.some(l => l.pid === out.pid)) || t);
    const repl = { ...t, legs: nt.legs.slice(0, t.n), updated: { pid: out.pid, name: out.name, reason: 'listed out, so held out', at: new Date(lockA + 15 * 60e3).toISOString().slice(0, 19) + 'Z' } };
    if (!repl.legs.some(l => l.pid === out.pid) && repl.legs.length === t.n) {
      e.tiers = e.tiers.map(x => x.id === t.id ? repl : x); e.updates = [{ tier: t.id, ...repl.updated }];
      q = load(stateOf(SLATE), { lines: LINES1, record: rec2, tab: 'suggest' }); await settle(q); await openTab(q);
      const u = q.d.querySelector(`#spSets [data-sp-game="${gA.id}"] [data-pb-tier="${t.id}"] .sp-upd`);
      check(u && txt(u) === `Updated: ${out.name} listed out, so held out (${etWd(lockA + 15 * 60e3)}); this level was built again.`, `the record's own replacement is said in its one line ("${u && txt(u)}")`);
    } else check(true, '(no second level to plant the record\'s replacement from)'); }
  /* at tip-off the game leaves the tab and the key */
  { q = load(stateOf(SLATE), { lines: LINES1, record: null, tab: 'suggest', storage: { nba_sp_lock_v1: JSON.stringify(kept) } }); NOW = Date.parse(gA.tip) + 60e3; await settle(q); await openTab(q);
    const k2 = JSON.parse(q.w.localStorage.getItem('nba_sp_lock_v1') || 'null');
    check(!sets(q).includes(gA.id) && (!k2 || !k2.games[gA.id]), 'at tip-off the game leaves the tab and the key'); }

  /* ---------- 7. the record's pills ---------- */
  const lvR = (id, n, p0, fair) => ({ id, label: LBL[id], n, floor: 0, legs: Array.from({ length: n }, () => ({})), p: p0, fair, dec: 3 });
  const eR = (gid, tip, grade, season = SEASON) => ({ season, gid, tip, tiers: [lvR('safe', 2, 0.4, 0.3), lvR('med', 3, 0.25, null), lvR('aggr', 4, 0.12, 0.08), { id: 'xtrm', label: 'Extreme', n: 5, why: 'x' }], grade });
  const RECX = { featured: {
    'a1': eR('g1', '1', { safe: { result: 'won', payout: 2.5 }, med: { result: 'lost', payout: 0 }, aggr: { result: 'push', payout: 1 } }),
    'a2': eR('g2', '1', { safe: { result: 'lost', payout: 0 }, med: { result: 'pending' }, aggr: { result: 'won', payout: 9.1 } }),
    'a3': eR('g2', '2', { safe: { result: 'won', payout: 1.8 }, med: { result: 'won', payout: 4 }, aggr: { result: 'lost', payout: 0 } }),
    'a4': eR('g3', '1', { safe: { result: 'won', payout: 2 } }, SEASON - 1), 'a5': eR('g4', '9', null) } };
  for (const [name, R] of [['a made-up record', RECX], ['the real record', fs.existsSync(path.join(ROOT, 'data', 'suggest_ledger.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'suggest_ledger.json'), 'utf8')) : null], ['an empty one', { featured: {} }]]) {
    if (!R) continue;
    q = load(stateOf(SLATE), { lines: LINES1, record: R, tab: 'suggest' }); NOW = Date.parse(T(D1, '15:00:00')); await settle(q); await openTab(q);
    const W2 = pillsOwn(R), got = [...q.d.querySelectorAll('#spRec .rec')];
    const ok = got.length === W2.pills.length + (W2.pending ? 1 : 0) && W2.pills.every(([id, text, title], i) => got[i].dataset.spRec === id && txt(got[i]) === text && (title == null || got[i].title === title)) && (!W2.pending || txt(got[got.length - 1]) === `Pending ${W2.pending}`);
    check(ok, `${name}: the pills, each number and title this file's own (${got.map(txt).join(' | ')})`);
  }
  q = load(stateOf(SLATE), { lines: LINES1, record: 'junk', tab: 'suggest' }); await settle(q); await openTab(q);
  check(q.d.getElementById('spRec') && q.d.getElementById('spRec').hidden && q.errors.length === 0, 'a record that is not JSON draws nothing and throws nothing');

  /* ---------- 8. the real files, on what the day offers ---------- */
  { NOW = Date.now();
    const realLines = fs.existsSync(path.join(ROOT, 'lines.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'lines.json'), 'utf8')) : null;
    const realRec = fs.existsSync(path.join(ROOT, 'data', 'suggest_ledger.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'suggest_ledger.json'), 'utf8')) : null;
    const r = load(REAL, { lines: realLines, record: realRec, tab: 'suggest' }); await settle(r); await openTab(r); await sleep(200);
    const N = nightOwn(REAL, NOW), shown = sets(r), body = txt(r.d.getElementById('spPanel'));
    check(N.up ? JSON.stringify(shown) === JSON.stringify(N.games.map(g => g.id)) : !shown.length, `on the real state the tab sets out this file's own night (${N.up ? N.games.map(g => g.id).join(', ') || 'none' : 'waiting'})`);
    check(!/\bNaN\b|\bundefined\b|\bnull\b/.test(body) && r.errors.length === 0, 'the real tab shows no NaN or undefined and throws nothing: ' + r.errors.join(' | '));
    const lockLines = [...r.d.querySelectorAll('#spSets .sp-lock')];
    check(lockLines.every(x => /^(Locks \w{3} \d{1,2}:\d{2} [AP]M ET, 2 hours before tip-off\.|Locked since \w{3} \d{1,2}:\d{2} [AP]M ET\..*|Built when this tab is open\.)$/.test(txt(x))), `each real set's lock line is one of the tab's (${lockLines.length})`); }
};
