/* Suggested Parlays, a section of the viewer smoke test (README "Suggested Parlays"): run by tools/smoke.js, alone with
 *
 *   SMOKE_ONLY=sp node tools/smoke.js
 *
 * The tab (app/parts/suggested.html) boots in jsdom on a made-up November slate of its own, a made-up lines.json in the
 * shape tools/lines.js writes and made-up records, the page's clock moved to each moment a case needs (so every case holds
 * at any hour on any day, the off-season included), and every rule it states is worked out here on its own, never read
 * from the page: which night is set out (nightOwn: the first Eastern date with a game to tip, never preseason, up from 6:00
 * AM New York time that morning, through the time zone database, a DST turn of each kind among them), the wait line's
 * words and instant, the lock lines word for word, the night's pool (poolOwn: every team leg at DraftKings' price and the
 * builder's chance, 45% to 97%, none far off, no player leg though the props model prices some), each level against this
 * file's own enumeration of every parlay the pool makes (each one's chance and price the builder's own parlayProb and
 * parlayDec on its legs, never the page's search) by its rule (Safe the likeliest pair; Medium the likeliest of 2 to 5
 * legs paying $4 or more on $1; Aggressive $8; ties to the dearer, then the fewer legs, then the ids), a one-game night's
 * empty levels word for word, a 15-game night inside 2 seconds and held to the guard's own enumeration, the cards' words,
 * Add, Add to builder and Finish, the browser's own lock across a reload (a per-game lock from before taken out) and given
 * way to the record's, the night under way, the record's pills (the night map's alone, each titled with the per-game
 * record before 7 November 2026), nothing stored but nba_sp_lock_v1 and nothing read but the record and lines.json, each
 * once and no-store; then the real files, on what the day offers. Every request is recorded.
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
  const PJ = require('./props'), SC = require('./suggest_check');
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const SEASON = REAL.season, Y = SEASON - 1, H = 3600e3;
  const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100), decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
  const am = q => q >= 0.5 ? -Math.round(100 * q / (1 - q)) : Math.round(100 * (1 - q) / q);
  const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
  const ymd = d => d.replace(/-/g, ''), T = (d, hm) => `${d}T${hm}Z`;

  /* ---------- this file's own copies of the rules ---------- */
  const NY = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const nyParts = ms => Object.fromEntries(NY.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  const sixAm = d => { for (let h = 0; h < 24; h++) { const t = Date.parse(`${d}T${String(h).padStart(2, '0')}:00:00Z`), p = nyParts(t); if (`${p.year}-${p.month}-${p.day}` === d && p.hour === '06' && p.minute === '00') return t; } return null; };
  const toCome = (g, now) => g.type !== 'PRE' && g.status === 'scheduled' && Date.parse(g.tip) > now;
  /* the night: the first Eastern date with a game to tip, never preseason, every game of it but preseason ones, up from
     6:00 AM New York time that morning */
  function nightOwn(st, now) {
    const G = st.slate.filter(g => toCome(g, now)).sort((a, b) => Date.parse(a.tip) - Date.parse(b.tip));
    if (!G.length) return null;
    const D = G[0].date, games = st.slate.map((g, i) => [g, i]).filter(([g]) => g.type !== 'PRE' && g.date === D).sort((a, b) => Date.parse(a[0].tip) - Date.parse(b[0].tip) || a[1] - b[1]).map(x => x[0]);
    const open = sixAm(D);
    return { id: `${SEASON}_${ymd(D)}_NIGHT`, date: D, games, tip: games[0].tip, last: games.reduce((m, g) => Date.parse(g.tip) > Date.parse(m.tip) ? g : m).tip, open, up: now >= open };
  }
  const etWd = ms => new Date(ms).toLocaleString('en-US', { timeZone: 'America/New_York', weekday: 'short', hour: 'numeric', minute: '2-digit' }) + ' ET';
  const etT = ms => new Date(ms).toLocaleTimeString('en-US', { timeZone: 'America/New_York', hour: 'numeric', minute: '2-digit' }) + ' ET';
  const wdLong = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const waitOwn = (st, now) => { const N = nightOwn(st, now); if (!N || N.up) return null; const n = N.games.length;
    return { at: new Date(N.open).toISOString().slice(0, 19) + 'Z', next: N.games.map(g => g.id).join(' '), text: `Next up: ${wdLong(N.date)}’s ${n} game${n === 1 ? '' : 's'}. The set goes up ${etWd(N.open)}.` }; };
  const LV = [['safe', 'Safe', 2, 2, 0], ['med', 'Medium', 2, 5, 4], ['aggr', 'Aggressive', 2, 5, 8]], LVID = LV.map(l => l[0]);
  const RULE = { safe: 'likeliest pair', med: 'likeliest paying $4+', aggr: 'likeliest paying $8+' };
  const NICK = { BOS: 'Celtics', NYK: 'Knicks', LAL: 'Lakers', GSW: 'Warriors', MIA: 'Heat', ORL: 'Magic', DEN: 'Nuggets', PHX: 'Suns', CHI: 'Bulls', DET: 'Pistons', MIL: 'Bucks', TOR: 'Raptors', CLE: 'Cavaliers', ATL: 'Hawks', CHA: 'Hornets' };

  /* ---------- the made-up November ---------- */
  const D0 = `${Y}-11-16`, D1 = addDay(D0, 1), D2 = addDay(D0, 2), D3 = addDay(D0, 3), D4 = addDay(D0, 4);
  const side = (t, out) => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
  const mk = (date, a, h, tip, tv, model, o) => ({ id: `${SEASON}_${ymd(date)}_${a}_${h}`, date, tip, type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '8' + ymd(date).slice(4) + a + h,
    tv, awayScore: null, homeScore: null, line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 224, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5 }, ...o });
  const gY = { ...mk(D0, 'MIL', 'CLE', T(D1, '00:00'), ['ESPN'], { pHome: 0.6 }), status: 'final', awayScore: 104, homeScore: 112 };
  /* D1's night: gG 6:45 PM ET, gC 7 PM, gA 7:30 PM, gB 10 PM, and gP, a preseason game, never in it; D2: gE and gD; D3: gF */
  const gG = mk(D1, 'ATL', 'CHA', T(D1, '23:45'), [], { pHome: 0.55, spread: -2, total: 230 });
  const gC = mk(D1, 'MIA', 'ORL', T(D2, '00:00'), [], { pHome: 0.6, spread: -4, total: 220 });
  const gA = mk(D1, 'BOS', 'NYK', T(D2, '00:30'), ['NBC'], { pHome: 0.66, spread: -5, total: 226 });
  const gB = mk(D1, 'LAL', 'GSW', T(D2, '03:00'), ['ESPN', 'ESPN2'], { pHome: 0.45, spread: 2, total: 231 });
  const gP = { ...mk(D1, 'SAC', 'DEN', T(D2, '02:00'), ['ESPN'], { pHome: 0.5 }), type: 'PRE' };
  const gE = mk(D2, 'CHI', 'DET', T(D2, '23:00'), [], { pHome: 0.7, spread: -7, total: 222 });
  const gD = mk(D2, 'DEN', 'PHX', T(D3, '02:00'), ['ESPN'], { pHome: 0.4, spread: 3, total: 233 });
  const gF = mk(D3, 'MIL', 'TOR', T(D4, '00:30'), ['TNT'], { pHome: 0.35, spread: 4, total: 228 });
  const SLATE = [gY, gG, gC, gA, gB, gP, gE, gD, gF];
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'];
  /* the props model prices two of gA's players: the night set takes no player leg all the same */
  const ROWS = { [gA.id]: { 9300001: ['Ace Guard', 'BOS', 'G', 34, 27.5, 5, 6, 3, 1.2, 0.4, 0.2, 0.02], 9300003: ['Cy Big', 'NYK', 'C', 30, 14, 11, 2.5, 0.5, 0.7, 1.6, 0.45, 0.01] } };
  const VAR = REAL.props.dist.var, COMBOS = REAL.props.combos;
  const muOf = (row, k) => k in COMBOS ? COMBOS[k].reduce((t, s) => t + row[LAY.indexOf(s)], 0) : row[LAY.indexOf(k)];
  const mainOf = (pid, row, stat, line) => { const m = muOf(row, stat), p = PJ.pOver(line, m, PJ.nbVar(m, VAR[stat])); return { player: String(pid), stat, line, over: am(p - 0.05), under: am(1 - p + 0.08) }; };
  const idsOf = g => ({ event: 'E' + g.espn, ml: { home: `0ML${g.espn}_1`, away: `0ML${g.espn}_3` }, spread: { home: `0HC${g.espn}_1`, away: `0HC${g.espn}_3` }, total: { over: `0OU${g.espn}_1`, under: `0OU${g.espn}_3` } });
  const READ = T(D1, '14:00:00');
  function lineOf(g, o = {}) {
    const sp = Math.round(-g.model.spread) - 0.5 * Math.sign(g.model.spread || 1), sh = o.shift || 0;
    return { at: o.at || READ, espn: g.espn, ml: { home: am(g.model.pHome - 0.06 + sh), away: am(1 - g.model.pHome + 0.08 - sh) }, spread: { line: -Math.abs(sp) * Math.sign(-g.model.spread || 1), home: -110, away: -110 },
      total: { line: Math.floor(g.model.total) + 0.5, over: -110, under: -110 }, ids: idsOf(g),
      props: ROWS[g.id] ? { at: o.at || READ, mains: [mainOf(9300001, ROWS[g.id][9300001], 'pts', 24.5), mainOf(9300003, ROWS[g.id][9300003], 'reb', 9.5)], ladders: [], yes: [] } : null };
  }
  const linesOf = (games, o = {}) => ({ v: 1, at: o.at || READ, games: Object.fromEntries(games.map(g => [g.id, lineOf(g, o)])) });
  function stateOf(slate, o = {}) {
    const st = clone(REAL);
    st.slate = slate.map(clone); st.today = o.today || D1; st.generated = o.generated || T(D1, '13:00'); st.asOf = D0;
    st.props = { ...clone(REAL.props), games: Object.fromEntries(slate.filter(g => ROWS[g.id] && g.status === 'scheduled').map(g => [g.id, { tip: g.tip, away: g.away, home: g.home, players: clone(ROWS[g.id]) }])) };
    st.props.ledger = { ...st.props.ledger, decision: null };
    st.report = { date: st.today, players: o.report || {} };
    delete st.eloPicks;
    return st;
  }
  /* the night's pool by this file's own rules: every team leg of its games still to tip at DraftKings' price, at the
     builder's chance (a moneyline the model's, a spread Phi((margin + line) / 14.5), a total its prices with the margin
     out), 45% to 97%, none 15 points or more over DraftKings' fair chance; no player leg */
  function poolOwn(st, lines, now, N) {
    const out = [];
    for (const g of N.games.filter(g => toCome(g, now))) { const x = lines.games[g.id]; if (!x) continue;
      const add = (kind, s, line, odds, other, p) => { const fair = imp(odds) / (imp(odds) + imp(other)); if (p >= 0.45 && p < 0.97 && p - fair < 0.15 - 1e-9) out.push({ sk: [g.id, kind, s, line == null ? '' : line].join('|'), p, odds }); };
      if (x.ml) { add('ml', g.home, null, x.ml.home, x.ml.away, g.model.pHome); add('ml', g.away, null, x.ml.away, x.ml.home, 1 - g.model.pHome); }
      if (x.spread) { const m = -g.model.spread; add('spread', g.home, x.spread.line, x.spread.home, x.spread.away, PJ.normCdf((m + x.spread.line) / 14.5)); add('spread', g.away, -x.spread.line, x.spread.away, x.spread.home, PJ.normCdf((-m - x.spread.line) / 14.5)); }
      if (x.total) { const po = imp(x.total.over) / (imp(x.total.over) + imp(x.total.under)); add('total', 'over', x.total.line, x.total.over, x.total.under, po); add('total', 'under', x.total.line, x.total.under, x.total.over, 1 - po); } }
    return out.sort((a, b) => a.sk < b.sk ? -1 : 1);
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
  const LINES1 = linesOf([gG, gC, gA, gB, gE, gD, gF]);
  const N1id = `${SEASON}_${ymd(D1)}_NIGHT`, N2id = `${SEASON}_${ymd(D2)}_NIGHT`;

  /* ---------- 1. nothing read before the tab opens; then the record and lines.json, once each, no-store ---------- */
  NOW = Date.parse(T(D1, '15:00:00'));
  let p = load(stateOf(SLATE), { lines: LINES1, record: null });
  await settle(p);
  check(p.requests.length === 1 && /state\.json/.test(p.requests[0].url), `nothing but state.json is read before the tab opens (${p.requests.map(x => x.url).join(', ')})`);
  const btn = p.d.querySelector('#nav button[data-tab=suggest]'), navOrder = [...p.d.querySelectorAll('#nav button')].filter(b => !b.hidden).map(b => b.dataset.tab).join();
  check(btn && txt(btn) === 'Suggested Parlays' && navOrder === 'slate,suggest,parlay,xparlays,teams,players,coaches,pickem,record', `the tab is Suggested Parlays, after Tonight (${navOrder})`);
  await openTab(p);
  check(reqOf(p, /suggest_ledger\.json/).length === 1 && reqOf(p, /lines\.json/).length === 1 && reqOf(p, /suggest_ledger\.json|lines\.json/).every(x => x.opt && x.opt.cache === 'no-store') && p.requests.length === 3,
    `opening it reads the record and lines.json once each, no-store, and nothing else (${p.requests.map(x => x.url).join(', ')})`);
  check(p.w.location.hash === '#suggest', 'its address is #suggest');
  p.d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20); await openTab(p);
  check(p.requests.length === 3, 'opening it again reads nothing');
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 2. which night ---------- */
  const st1 = stateOf(SLATE), N1 = nightOwn(st1, NOW);
  check(JSON.stringify(sets(p)) === JSON.stringify([N1id]) && N1.id === N1id && N1.games.length === 4, `the morning of D1 the tab sets out one set, D1's night (${sets(p).join(', ')})`);
  { const nightJ = JSON.parse(p.w.eval('JSON.stringify(spNight())'));
    check(JSON.stringify(nightJ.games.map(g => g.id)) === JSON.stringify(N1.games.map(g => g.id)) && nightJ.tip === N1.tip && nightJ.last === N1.last && !nightJ.games.some(g => g.id === gP.id),
      `the night is every game of its Eastern date but the preseason one, in tip-off order, local TV and national alike (${nightJ.games.map(g => g.id.slice(-7)).join(', ')})`); }
  { const hd = p.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-hd`), night = `${new Date(D1 + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })} ${new Date(D1 + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    check(txt(hd.querySelector('h3')) === `${wdLong(D1)}’s games` && txt(hd.querySelector('[data-sp-count]')) === '4 games' && txt(hd.querySelector('small')) === `First tip-off ${etT(Date.parse(gG.tip))}`
      && txt(p.d.querySelector('#spHead [data-sp-night]')) === night, `the set's head: "${txt(hd)}", the tab's the night's date (${night})`); }
  check(!p.d.querySelector('#spPanel .pb-foot') && !p.d.querySelector('#spHead .pb-lead') && !p.d.querySelector('#spSets .pb-lead'), 'no lead paragraph, no foot');
  /* the night's turn: after D1's last tip-off the wait line names D2's night, until 6:00 AM New York on D2 */
  NOW = Date.parse(gB.tip) + 30 * 60e3; p.w.spWatchTick(); await sleep(30);
  let W = waitOwn(st1, NOW), wl = p.d.querySelector('#spSets .sp-wait');
  check(W && wl && wl.dataset.spWait === W.at && wl.dataset.spNext === W.next && txt(wl) === W.text && !sets(p).length, `after D1's last tip-off the half-minute look draws the wait line, its instant, games and words this file's own ("${txt(wl)}")`);
  const turn = Date.parse(W.at);
  NOW = turn - 1000; p.w.spWatchTick(); await sleep(20);
  check(p.d.querySelector('#spSets .sp-wait') && !sets(p).length, 'a second before 6:00 AM the line stands');
  const stTurn = p.w.spState();
  NOW = turn; p.w.spWatchTick(); await sleep(30);
  check(JSON.stringify(sets(p)) === JSON.stringify([N2id]) && !p.d.querySelector('#spSets .sp-wait') && p.w.spState() !== stTurn, "at 6:00 AM on D2 the half-minute look sets out D2's night");
  /* the clocks' turns: a night on the Sunday they go back and one on the Sunday they go forward goes up at 6:00 AM New York */
  for (const [label, sun] of [['back', (() => { for (let d = 1; d <= 7; d++) { const x = `${Y}-11-0${d}`; if (new Date(x + 'T12:00:00Z').getUTCDay() === 0) return x; } })()], ['forward', (() => { let c = 0; for (let d = 1; d <= 14; d++) { const x = `${SEASON}-03-${String(d).padStart(2, '0')}`; if (new Date(x + 'T12:00:00Z').getUTCDay() === 0 && ++c === 2) return x; } })()]]) {
    const b = mk(sun, 'BOS', 'NYK', T(addDay(sun, 1), '00:00'), ['NBC']);
    const stX = stateOf([b], { today: sun }), open = sixAm(sun);
    NOW = Date.parse(T(sun, '04:00:00'));
    const q = load(stX, { lines: linesOf([b]), record: null, tab: 'suggest' }); await settle(q); await openTab(q);
    const wl2 = q.d.querySelector('#spSets .sp-wait');
    NOW = open - 1000; q.w.spWatchTick(); await sleep(20); const still = !!q.d.querySelector('#spSets .sp-wait');
    NOW = open; q.w.spWatchTick(); await sleep(30);
    check(wl2 && wl2.dataset.spWait === new Date(open).toISOString().slice(0, 19) + 'Z' && still && JSON.stringify(sets(q)) === JSON.stringify([`${SEASON}_${ymd(sun)}_NIGHT`]),
      `the Sunday the clocks go ${label}: the set goes up at 6:00 AM New York time (${new Date(open).toISOString().slice(11, 16)} UTC), as this file's own reading says`);
  }
  /* no game to come (the off-season), and a preseason game alone */
  { NOW = Date.parse(T(D1, '15:00:00'));
    const q = load(stateOf([gY]), { lines: { v: 1, at: READ, games: {} }, record: null, tab: 'suggest' }); await settle(q); await openTab(q);
    check(txt(q.d.querySelector('#spSets [data-sp-none]')) === 'No regular-season game is still to tip on the schedule: a set comes each night there is one.' && !sets(q).length && q.errors.length === 0, 'with no game to come the tab says so, draws no set and throws nothing');
    const q2 = load(stateOf([gY, gP]), { lines: { v: 1, at: READ, games: {} }, record: null, tab: 'suggest' }); await settle(q2); await openTab(q2);
    check(!sets(q2).length && q2.d.querySelector('#spSets [data-sp-none]'), 'a preseason game alone makes no night'); }

  /* ---------- 3. the night's levels: the pool, this file's own enumeration, the builder's sums, the cards ---------- */
  NOW = Date.parse(T(D1, '15:00:00'));
  p = load(stateOf(SLATE), { lines: LINES1, record: null, tab: 'suggest' }); await settle(p); await openTab(p);
  const card = id => p.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="${id}"]`);
  const tiers1 = LVID.map(id => p.w.spTier(`${N1id}:${id}`));
  check(tiers1.every(Boolean), `D1's three levels are built (${tiers1.map(t => t ? t.legs.length + ' legs' : 'empty').join(', ')})`);
  const pagePool = JSON.parse(p.w.eval(`JSON.stringify(spPool(spById(${JSON.stringify(N1id)})).legs.map(l => ({ sk: l.sk, p: l.p, odds: l.price, kind: l.kind, gid: l.gid })))`));
  const own1 = poolOwn(stateOf(SLATE), LINES1, NOW, N1);
  check(JSON.stringify(pagePool.map(l => l.sk)) === JSON.stringify(own1.map(l => l.sk)) && pagePool.every((l, i) => l.odds === own1[i].odds && Math.abs(l.p - own1[i].p) < 1e-6) && pagePool.every(l => l.kind !== 'prop'),
    `the pool is this file's own: every team leg of the night at DraftKings' price and the builder's chance, 45% to 97%, none far off, no player leg though the props model prices two (${pagePool.length} legs)`);
  /* every parlay the pool makes (a game: nothing, a leg, or its side and total together; 5 legs at most), each one's chance
     and price by the builder's own parlayProb and parlayDec on its legs, the best of each level by its rule */
  const enumOwn = (q, nid) => JSON.parse(q.w.eval(`(() => {
    const pool = spPool(spById(${JSON.stringify(nid)})).legs, by = new Map(); for (const l of pool) { if (!by.has(l.gid)) by.set(l.gid, []); by.get(l.gid).push(l); }
    const G = [...by.values()].map(L => { const o = L.map(l => [l]); for (const a of L.filter(l => l.kind !== 'total')) for (const b of L.filter(l => l.kind === 'total')) o.push([a, b]); return o; });
    const LV = ${JSON.stringify(LV)}, best = {}, pick = []; let count = 0;
    const better = (c, b) => !b || c.p > b.p + 1e-12 || (Math.abs(c.p - b.p) <= 1e-12 && (c.d > b.d + 1e-12 || (Math.abs(c.d - b.d) <= 1e-12 && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
    (function go(i, nL) {
      if (i === G.length) { if (nL < 2) return; count++; const legs = pbOrder(pick.flat()), pr = parlayProb(legs).corr, d = parlayDec(legs.map(l => ({ leg: l, ml: l.price }))), ids = legs.map(l => l.sk).sort().join(',');
        for (const [id, , lo, hi, F] of LV) if (nL >= lo && nL <= hi && d >= F - 1e-9) { const c = { p: pr, d, n: nL, ids }; if (better(c, best[id])) best[id] = c; } return; }
      go(i + 1, nL);
      for (const o of G[i]) if (nL + o.length <= 5) { pick.push(o); go(i + 1, nL + o.length); pick.pop(); }
    })(0, 0);
    return JSON.stringify({ best, count });
  })()`));
  { const E = enumOwn(p, N1id);
    check(LVID.every((id, i) => { const t = tiers1[i], b = E.best[id]; return t && b && t.legs.map(l => l.sk).sort().join(',') === b.ids && Math.abs(t.corr - b.p) < 1e-12 && Math.abs(t.dec - b.d) < 1e-12; }),
      `each level is the best of this file's own enumeration of all ${E.count} parlays by its rule, its chance and price the builder's sums (${LVID.map((id, i) => `${id} ${tiers1[i] ? (tiers1[i].corr * 100).toFixed(2) + '% at ' + tiers1[i].dec.toFixed(2) : '-'}`).join(', ')})`); }
  check(tiers1[0].legs.length === 2 && tiers1[1].dec >= 4 && tiers1[2].dec >= 8 && tiers1.every(t => t.legs.length >= 2 && t.legs.length <= 5), "Safe is a pair, Medium pays $4 or more on $1 and Aggressive $8 or more, each 2 to 5 legs");
  check(tiers1.every(t => { const by = {}; for (const l of t.legs) { const k = l.gid + (l.kind === 'total' ? 't' : 's'); by[k] = (by[k] || 0) + 1; } return Object.values(by).every(v => v === 1) && t.legs.every(l => N1.games.some(g => g.id === l.gid)); }), 'every level: one side and one total a game at most, every leg a game of the night');
  { const sums = tiers1.map(t => JSON.parse(p.w.eval(`(() => { const L = spTier(${JSON.stringify(N1id + ':' + t.id)}).legs; const f = parlayFair(L); return JSON.stringify({ f: f.p }); })()`)));
    check(tiers1.every((t, i) => Math.abs(t.fair.p - sums[i].f) < 1e-12), "each level's fair chance is the builder's own parlayFair on its legs"); }
  /* the cards */
  check(tiers1.every(t => { const c = card(t.id); return txt(c.querySelector('.pb-rule')) === RULE[t.id] && txt(c.querySelector('.pb-pill')) === `${t.legs.length} legs` && txt(c.querySelector('.pb-model')) === `model says ${(t.corr * 100).toFixed(0)}%` && txt(c.querySelector('[data-pb-fair]')) === (t.fair.p * 100).toFixed(0) + '%'; }),
    `each card says its rule (${LVID.map(id => `"${txt(card(id).querySelector('.pb-rule'))}"`).join(', ')}), its legs, the fair chance and the model's`);
  check(tiers1.every(t => { const c = card(t.id), pay = c.querySelector('[data-pb-pay]'); return Math.abs(+pay.dataset.pbPay - t.dec) < 1e-12 && txt(pay.querySelector('b')) === '$' + (20 * t.dec).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }), 'each card pays the Bet amount times its price');
  { const lis = tiers1.flatMap(t => [...card(t.id).querySelectorAll('.pb-legs li')].map((li, i) => [li, t.legs[i]]));
    check(lis.every(([li, l]) => { const sm = txt(li.querySelector('small')).replace(/\s*Value$/, ''); return l.kind === 'total' ? sm === l.label && txt(li.querySelector('.glance-name, .nm')).startsWith(`${NICK[l.away]} at ${NICK[l.home]}`) : sm === `${l.label} · ${l.away} at ${l.home}`; }),
      'each leg says its game ("To win · BOS at NYK"; a total named by its game)');
    check(lis.every(([li, l]) => !!li.querySelector('.pb-valmark') === (l.thin === false && !l.market)) && !p.d.querySelector('#spSets .pb-trial'), 'a leg 3 points over its price is marked Value and nothing else is; no on-trial mark (no player leg)'); }
  check(![...p.d.querySelectorAll('#spSets .pb-thin')].some(x => /not a Value pick|book’s own chance/.test(txt(x))), 'the cards are quiet');
  const lockN1 = Date.parse(N1.tip) - 2 * H, line1 = p.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`);
  check(line1.dataset.spPhase === 'live' && txt(line1) === `Locks ${etWd(lockN1)}, 2 hours before the first tip-off.`, `a live set's line, word for word ("${txt(line1)}")`);
  const h44 = el => el && p.w.getComputedStyle(el).minHeight === '44px';
  const ctls = [...p.d.querySelectorAll('#spPanel [data-pb-leg], #spPanel [data-sp-add], #spPanel [data-pc-finish], #spPanel [data-espn-refresh]')];
  check(ctls.length >= 10 && ctls.every(h44), `every control on the tab is 44px (${ctls.length})`);
  p.w.eval('M.stake = 37.5; pbPays()');
  check(tiers1.every(t => /\$37\.50 pays/.test(txt(card(t.id).querySelector('[data-pb-pay]')))), 'the payouts follow the Bet amount as it is typed ($37.50)');
  p.w.eval('M.stake = 20; pbPays()');
  /* the props model off (a FAIL) changes nothing: the set never took a player leg */
  { const stF = stateOf(SLATE); stF.props.ledger = { ...stF.props.ledger, decision: { verdict: 'FAIL', decidedAt: '2026-11-05T18:00Z', lines: 12298, games: 121, scores: {}, flat: {}, early: { at: '2026-11-05T18:00Z' } } };
    const pf = load(stF, { lines: LINES1, record: null, tab: 'suggest' }); await settle(pf); await openTab(pf);
    check(LVID.every((id, i) => { const t = pf.w.spTier(`${N1id}:${id}`); return t && t.legs.map(l => l.sk).join() === tiers1[i].legs.map(l => l.sk).join(); }) && !pf.errors.length, 'after the props model\'s FAIL the same set: it takes team legs alone either way'); }

  /* ---------- 4. a one-game night, ties, and a night of 15 games ---------- */
  { const stO = stateOf([gF], { today: D3 }); NOW = Date.parse(T(D3, '15:00:00'));
    const q = load(stO, { lines: linesOf([gF]), record: null, tab: 'suggest' }); await settle(q); await openTab(q);
    const nid = `${SEASON}_${ymd(D3)}_NIGHT`, s = q.w.spTier(`${nid}:safe`), whys = [...q.d.querySelectorAll(`#spSets [data-sp-game="${nid}"] .pb-why`)].map(txt);
    check(s && s.legs.length === 2 && s.legs.some(l => l.kind === 'total') && JSON.stringify(whys) === JSON.stringify(['No parlay of the night’s legs pays $4 or more on $1: one game makes 2 legs at most.', 'No parlay of the night’s legs pays $8 or more on $1: one game makes 2 legs at most.'])
      && [...q.d.querySelectorAll(`#spSets [data-sp-game="${nid}"] .pb-tier.none .pb-pill`)].every(x => txt(x) === '2–5 legs'),
      `a one-game night: Safe its side and total, Medium and Aggressive empty saying why word for word ("${whys[1]}")`);
    const E = enumOwn(q, nid);
    check(!E.best.med && !E.best.aggr && E.best.safe && E.best.safe.ids === s.legs.map(l => l.sk).sort().join(','), "and this file's own enumeration agrees"); }
  /* ties, on the page's search itself (spSearch) over options made up here: the dearer of two parlays level on their
     chance, and of two level on both the first by the legs' ids */
  { const o = (sk, pp, d) => ({ legs: [{ sk, gid: sk.split('|')[0] }], p: pp, d });
    const G = [{ gid: 'g1', opts: [o('g1|a', 0.6, 1.8)], top: 1.8 }, { gid: 'g2', opts: [o('g2|a', 0.6, 1.9)], top: 1.9 }, { gid: 'g3', opts: [o('g3|a', 0.6, 1.9)], top: 1.9 }, { gid: 'g4', opts: [o('g4|a', 0.5, 2.0)], top: 2.0 }];
    const safe = p.w.spSearch(G, ['safe', 'Safe', 2, 2, 0]), med = p.w.spSearch(G, ['med', 'Medium', 2, 5, 4]);
    check(safe && safe.ids === 'g2|a,g3|a', `the likeliest pair, of three level on their chance, is the dearer, then the first by ids (${safe && safe.ids})`);
    check(med && med.ids === 'g1|a,g2|a,g3|a' && Math.abs(med.d - 1.8 * 1.9 * 1.9) < 1e-12, `Medium: no pair pays $4, so the likeliest triple (${med && med.ids}, ${med && med.d.toFixed(3)})`); }
  { const big = [], L = { v: 1, at: READ, games: {} }, teams = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
    for (let i = 0; i < 15; i++) { const g = mk(D1, teams[2 * i], teams[2 * i + 1], T(D2, String(i % 4).padStart(2, '0') + ':' + ['00', '30'][i % 2]), [], { pHome: 0.4 + (i % 7) * 0.05, spread: -3 + (i % 5) * 1.5, total: 220 + i }); big.push(g); L.games[g.id] = lineOf(g); }
    NOW = Date.parse(T(D1, '15:00:00'));
    const q = load(stateOf(big), { lines: L, record: null }); await settle(q); await q.w.eval('pbLinesLoad()');
    const t0 = Date.now(); q.w.eval(`spSet(${JSON.stringify(N1id)})`); const ms = Date.now() - t0;
    const e = JSON.parse(q.w.eval(`JSON.stringify(spEntry(${JSON.stringify(N1id)}))`)), pool = SC.nightPool(e);
    const okAll = e.tiers.every((t, i) => { const b = SC.nightBest(pool, SC.NIGHT_LEVELS[i]); return t.legs && b && b.ids === t.legs.map(l => [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|')).sort().join(','); });
    check(ms < 2000 && okAll, `a night of 15 games (${e.pool.legs.length} legs) builds its set in ${ms} ms in jsdom, each level the guard's own enumeration's (${e.tiers.map(t => t.legs ? t.legs.length + ' legs at ' + t.dec : 'empty').join(', ')})`); }

  /* ---------- 5. Add, Add to builder, Finish ---------- */
  NOW = Date.parse(T(D1, '15:00:00'));
  const mine = () => JSON.parse(p.w.localStorage.getItem('nba_hub_2027') || '{}');
  const leg0 = card('med').querySelector('[data-pb-leg]'), k0 = leg0.dataset.pbLeg;
  leg0.focus(); leg0.click(); await sleep(30);
  const leg0b = card('med').querySelector(`[data-pb-leg="${k0.replace(/"/g, '\\"')}"]`);
  check(mine().slip.legs.length === 1 && leg0b.getAttribute('aria-pressed') === 'true' && txt(leg0b) === 'Added' && p.d.activeElement === leg0b && /^In the builder: /.test(txt(p.d.getElementById('spSaid'))), "a leg's Add puts it in the builder, reads Added, says so, and keeps the focus");
  leg0b.click(); await sleep(30);
  check(mine().slip.legs.length === 0, 'a second press takes it out');
  card('med').querySelector('[data-sp-add]').click(); await sleep(40);
  const inB = mine().slip.legs, med = tiers1[1];
  check(inB.length === med.legs.length && med.legs.every(l => inB.some(x => p.w.eval('slipKey')(x) === l.sk)) && txt(card('med').querySelector('[data-sp-add]')) === 'In the builder', "Add to builder puts exactly the level's legs in the builder");
  p.d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(60);
  const payB = p.d.querySelector('#pbBuild [data-payout]');
  check(payB && Math.abs(+payB.dataset.payout - 20 * med.dec) < 1e-9, 'which then pays what the level said on the Bet amount');
  await openTab(p);
  const fin = card('med').querySelector('[data-pc-finish]');
  check(fin && fin.dataset.pcFinish === `sp|${N1id}:med` && txt(fin) === 'Finish', 'each level has its Finish, named sp|<night>:<level>');
  fin.click(); await sleep(30);
  { const m = p.w.PARLAY_CARD && p.w.PARLAY_CARD.current(), day = `${new Date(D1 + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })} ${new Date(D1 + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`;
    check(!p.d.getElementById('pcBack').hidden && m && m.kicker === `Medium parlay · ${day}` && m.legs.length === med.legs.length && m.stake === 20 && m.chance === (med.corr * 100).toFixed(1) + '%',
      `Finish opens the parlay card on the level's legs at the Bet amount, its own chance (${m && m.kicker}, ${m && m.chance})`); }
  p.d.getElementById('pcClose').click(); await sleep(20);
  check(p.d.activeElement === card('med').querySelector('[data-pc-finish]') || p.d.activeElement === fin, 'closing it gives the focus back');
  p.w.localStorage.setItem('nba_hub_2027', JSON.stringify({ ...mine(), slip: { legs: [], stake: 20 } }));

  /* ---------- 6. the lock: this browser's own, a reload, the record's, under way ---------- */
  const st6 = stateOf(SLATE);
  NOW = lockN1 + 10 * 60e3;
  /* a per-game lock of the rule before (v 1) in the browser: taken out on the first read, nothing of it shown */
  const V1 = JSON.stringify({ v: 1, season: SEASON, games: { [gA.id]: { tip: gA.tip, own: true, at: T(D1, '22:00:00'), tiers: [], rep: {} } } });
  let q = load(st6, { lines: LINES1, record: null, tab: 'suggest', storage: { nba_sp_lock_v1: V1 } }); await settle(q); await openTab(q);
  const lnN = () => q.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`);
  check(lnN().dataset.spPhase === 'own' && txt(lnN()) === `Locked since ${etWd(lockN1)}. This browser’s own set: the site’s was not published in time, so the record does not grade it.`, `with no record, this browser's own set at the lock, its line word for word ("${txt(lnN())}")`);
  const kept = JSON.parse(q.w.localStorage.getItem('nba_sp_lock_v1') || 'null'), ownT = LVID.map(id => q.w.spTier(`${N1id}:${id}`));
  check(kept && kept.v === 2 && kept.season === SEASON && !kept.games && kept.nights[N1id] && kept.nights[N1id].own === true && kept.nights[N1id].tip === N1.tip && JSON.stringify(kept.nights[N1id].tiers.map(t => t.id)) === JSON.stringify(LVID) && Object.keys(kept.nights).length === 1,
    "it is kept in nba_sp_lock_v1 ({v: 2, season, nights: {<night>: {tip, own, at, tiers}}}), the per-game value of the rule before taken out");
  check(ownT.every((t, i) => t && t.legs.map(l => l.sk).join() === tiers1[i].legs.map(l => l.sk).join()), 'built from the same lines, the same set as the live one');
  check(Object.keys(dump(q.w.localStorage)).every(k => ['nba_sp_lock_v1', 'nba_hub_2027', 'nba_hub_2027:tab'].includes(k)) && !Object.keys(dump(q.w.sessionStorage)).length, 'nothing else is stored');
  { const q2 = load(st6, { lines: null, record: null, tab: 'suggest' }); await settle(q2); await openTab(q2); await sleep(40);
    check(q2.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`).dataset.spPhase === 'own' && !q2.w.localStorage.getItem('nba_sp_lock_v1') && q2.errors.length === 0, 'with lines.json not there, the set it shows is never kept, so a reload tries again'); }
  /* a reload, the prices moved: the same set */
  const store = dump(q.w.localStorage);
  NOW = lockN1 + 20 * 60e3;
  q = load(st6, { lines: linesOf([gG, gC, gA, gB, gE, gD, gF], { shift: 0.05, at: T(D1, '22:40:00') }), record: null, tab: 'suggest', storage: store }); await settle(q); await openTab(q);
  const again = LVID.map(id => q.w.spTier(`${N1id}:${id}`));
  check(again.every((t, i) => t && JSON.stringify(t.legs.map(l => [l.sk, l.price])) === JSON.stringify(ownT[i].legs.map(l => [l.sk, l.price]))), 'a reload shows the same set, at its locked prices, though the prices have moved');
  { const b = q.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="safe"] [data-pb-leg]`), lk = again[0].legs.find(l => l.sk === b.dataset.pbLeg); b.click(); await sleep(30);
    const m = JSON.parse(q.w.localStorage.getItem('nba_hub_2027')).slip.legs[0];
    check(m && m.odds === lk.price && q.w.eval('slipKey')(m) === lk.sk, "a locked leg's Add puts it in at its locked price");
    q.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="safe"] [data-pb-leg]`).click(); await sleep(20); }
  /* the record's set: it takes this browser's place */
  const recTiers = ownT.map(t => q.w.spTierOut(t));
  const recEntry = { season: SEASON, date: D1, nid: N1id, games: N1.games.map(g => ({ gid: g.id, away: g.away, home: g.home, tip: g.tip, type: g.type })), tip: N1.tip, last: N1.last, lock: new Date(lockN1).toISOString().slice(0, 16) + 'Z', generated: T(D1, '13:00'), pool: {}, tiers: recTiers, taken_at: T(D1, '16:00:00') };
  const REC = { how: 'x', since: D0, updated: T(D1, '16:00:00'), featured_summary: null, featured: {}, night: { [`${SEASON}|${D1}|${N1.tip}|${N1id}`]: recEntry } };
  { let release; const waitRec = new Promise(r => { release = r; });
    q = load(st6, { lines: LINES1, record: () => waitRec.then(() => REC), tab: 'suggest', storage: dump(q.w.localStorage) }); await settle(q);
    q.d.querySelector('#nav button[data-tab=suggest]').click(); await sleep(60);
    check(lnN() && lnN().dataset.spPhase === 'loading' && txt(lnN()) === `Locked since ${etWd(lockN1)}. Loading the site’s set…`, `while the record is read, the locked night waits for it ("${lnN() && txt(lnN())}")`);
    release(); await sleep(80);
    check(lnN().dataset.spPhase === 'locked' && txt(lnN()) === `Locked since ${etWd(lockN1)}.` && !q.w.localStorage.getItem('nba_sp_lock_v1'), `the record's set takes its place, its line word for word, the browser's own dropped ("${txt(lnN())}")`); }
  /* a level the record took empty says so as of the take */
  { const R2 = clone(REC), e = Object.values(R2.night)[0]; e.tiers[2] = { id: 'aggr', label: 'Aggressive', min: 2, max: 5, price: 8, why: 'No parlay of the night’s legs pays $8 or more on $1.' };
    const q3 = load(st6, { lines: LINES1, record: R2, tab: 'suggest' }); await settle(q3); await openTab(q3);
    check(txt(q3.d.querySelector(`#spSets [data-sp-game="${N1id}"] .pb-tier.none.aggr .pb-why`)) === 'Empty when the set locked: No parlay of the night’s legs pays $8 or more on $1.', 'a level the record took empty says so, as of the take'); }
  /* the record's set taken before DraftKings had posted any line of the night (its pool no leg, none left out): no set.
     After the lock the page builds its own on the lines it has, fills every level and keeps it, as with no record */
  { const R0 = clone(REC), e = Object.values(R0.night)[0];
    e.pool = { legs: [], pairs: [], band: 0, far: 0, noId: 0 }; e.taken_at = T(D1, '03:00:00');
    e.tiers = LV.map(([id, label, lo, hi, F]) => ({ id, label, min: lo, max: hi, price: F, why: 'No legs yet: DraftKings had posted no game lines for the night’s games as of Mon 10:12 PM ET.' }));
    const q7 = load(st6, { lines: LINES1, record: R0, tab: 'suggest' }); await settle(q7); await openTab(q7);
    const l7 = q7.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`), T7 = LVID.map(id => q7.w.spTier(`${N1id}:${id}`)), k7 = JSON.parse(q7.w.localStorage.getItem('nba_sp_lock_v1') || 'null');
    check(l7 && l7.dataset.spPhase === 'own' && T7.every((t, i) => t && t.legs.map(l => l.sk).join() === tiers1[i].legs.map(l => l.sk).join()) && k7 && k7.nights[N1id] && k7.nights[N1id].tiers.every(t => t.legs)
      && !q7.d.querySelector(`#spSets [data-sp-game="${N1id}"] .pb-why`),
      `a record's set taken before any line was posted is no set: from the lock this browser builds its own on the lines, every level filled and kept (${l7 && l7.dataset.spPhase}; ${T7.map(t => t ? t.legs.length + ' legs' : 'empty').join(', ')})`);
    /* the page's own at the lock with no line posted yet: shown, never kept, so it is built again once the lines are */
    const unp = { v: 1, at: T(D1, '21:00:00'), games: Object.fromEntries([gG, gC, gA, gB, gE, gD, gF].map(g => [g.id, { at: T(D1, '21:00:00'), espn: g.espn, ml: null, spread: null, total: null, ids: null, props: null }])) };
    const q8 = load(st6, { lines: unp, record: null, tab: 'suggest' }); await settle(q8); await openTab(q8);
    const w8 = [...q8.d.querySelectorAll(`#spSets [data-sp-game="${N1id}"] .pb-why`)].map(txt);
    check(q8.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`).dataset.spPhase === 'own' && w8.length === 3 && w8.every(x => /^No legs yet: DraftKings had posted no game lines for the night’s games as of /.test(x)) && !q8.w.localStorage.getItem('nba_sp_lock_v1'),
      `this browser's own set at the lock with no line posted: shown, its levels saying why, and never kept (${w8[0]})`);
    const q9 = load(st6, { lines: LINES1, record: null, tab: 'suggest', storage: dump(q8.w.localStorage) }); await settle(q9); await openTab(q9);
    check(LVID.every(id => q9.w.spTier(`${N1id}:${id}`)) && JSON.parse(q9.w.localStorage.getItem('nba_sp_lock_v1') || '{"nights":{}}').nights[N1id], 'a reload once the lines are posted builds every level and keeps them'); }
  /* a night once locked stays locked: the night's first tip-off moved later after the lock (gG from 6:45 to 7:15 PM ET,
     so the night's first is gC at 7 PM, its own lock still to come): the record's set, and this browser's own kept at the
     old tip-off, still shown locked, never the set built live again on later lines */
  { const stM = stateOf(SLATE.map(g => g.id === gG.id ? { ...g, tip: T(D2, '00:15') } : g)); NOW = lockN1 + 5 * 60e3;
    const qa = load(stM, { lines: linesOf([gG, gC, gA, gB, gE, gD, gF], { shift: 0.05, at: T(D1, '21:40:00') }), record: REC, tab: 'suggest' }); await settle(qa); await openTab(qa);
    const la = qa.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`), Ta = LVID.map(id => qa.w.spTier(`${N1id}:${id}`));
    check(la && la.dataset.spPhase === 'locked' && txt(la) === `Locked since ${etWd(lockN1)}.` && Ta.every((t, i) => t && t.legs.map(l => l.sk).join() === ownT[i].legs.map(l => l.sk).join()),
      `the first tip-off moved later after the lock: the record's set, still locked since ${etWd(lockN1)} ("${la && txt(la)}")`);
    const qb = load(stM, { lines: linesOf([gG, gC, gA, gB, gE, gD, gF], { shift: 0.05, at: T(D1, '21:40:00') }), record: null, tab: 'suggest', storage: { nba_sp_lock_v1: JSON.stringify(kept) } }); await settle(qb); await openTab(qb);
    const lb = qb.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`), Tb = LVID.map(id => qb.w.spTier(`${N1id}:${id}`));
    check(lb && lb.dataset.spPhase === 'own' && Tb.every((t, i) => t && JSON.stringify(t.legs.map(l => [l.sk, l.price])) === JSON.stringify(ownT[i].legs.map(l => [l.sk, l.price]))) && JSON.parse(qb.w.localStorage.getItem('nba_sp_lock_v1') || '{"nights":{}}').nights[N1id],
      `and this browser's own set, kept at the old tip-off, still shown and kept (${lb && lb.dataset.spPhase})`); }
  /* under way: from the first tip-off the locked set; a level whose games are all still to tip keeps its Add, Add to
     builder and Finish, and loses them once one tips; one holding a game that has tipped has none. Planted on the record:
     Safe on gA's and gB's sides (both still to tip), Medium on gG's side and gA's total (gG tipped) */
  { NOW = lockN1 + 20 * 60e3;
    const legOut = (gid, total) => q.w.eval(`JSON.stringify(spLegOut(spPool(spById(${JSON.stringify(N1id)})).legs.find(l => l.gid === ${JSON.stringify(gid)} && (l.kind === 'total') === ${total})))`);
    const RU = clone(REC), eu = Object.values(RU.night)[0], lAB = [gA.id, gB.id].map(id => JSON.parse(legOut(id, false))), lGA = [JSON.parse(legOut(gG.id, false)), JSON.parse(legOut(gA.id, true))];
    eu.tiers[0] = { id: 'safe', label: 'Safe', min: 2, max: 2, price: 0, legs: lAB, p: 0.3, fair: 0.28, fair_est: false, dec: 3.5 };
    eu.tiers[1] = { id: 'med', label: 'Medium', min: 2, max: 5, price: 4, legs: lGA, p: 0.3, fair: 0.28, fair_est: false, dec: 4.1 };
    NOW = Date.parse(N1.tip) + 20 * 60e3;
    const q4 = load(st6, { lines: LINES1, record: RU, tab: 'suggest' }); await settle(q4); await openTab(q4);
    const l4 = q4.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`), cardU = id => q4.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="${id}"]`);
    /* this file's own reading: a level is open while every leg's game tips after the clock */
    const openOwn = t => t.legs.every(l => Date.parse(SLATE.find(g => g.id === l.id).tip) > NOW);
    const acts = id => { const c = cardU(id); return c ? [c.querySelectorAll('[data-pb-leg]').length, c.querySelectorAll('[data-sp-add]').length, c.querySelectorAll('[data-pc-finish]').length] : null; };
    const heldAll = () => eu.tiers.every(t => { const a = acts(t.id), open = openOwn(t), tt = q4.w.spTier(`${N1id}:${t.id}`);
      return a && (open ? a[0] === t.legs.length && a[1] === 1 && a[2] === 1 && tt && tt.legs.length === t.legs.length : a[0] === 0 && a[1] === 0 && a[2] === 0 && tt === null); });
    check(l4 && l4.dataset.spPhase === 'under' && txt(l4) === `Locked since ${etWd(lockN1)}. Under way since ${etWd(Date.parse(N1.tip))}.` && q4.d.querySelectorAll(`#spSets [data-sp-game="${N1id}"] .pb-tier[data-pb-tier]`).length === 3
      && openOwn(eu.tiers[0]) && !openOwn(eu.tiers[1]) && heldAll(), `under way: the record's set, a level whose games are all still to tip keeping its Add, Add to builder and Finish and one holding a tipped game none (${eu.tiers.map(t => `${t.id} ${JSON.stringify(acts(t.id))}`).join(', ')}; "${l4 && txt(l4)}")`);
    { const addU = cardU('safe') && cardU('safe').querySelector('[data-sp-add]'); if (addU) addU.click(); await sleep(40); }
    const inU = JSON.parse(q4.w.localStorage.getItem('nba_hub_2027') || '{}').slip;
    check(inU && inU.legs.length === 2 && lAB.every(l => inU.legs.some(x => q4.w.eval('slipKey')(x) === [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|'))), "under way, an open level's Add to builder puts its legs in");
    NOW = Date.parse(gA.tip) + 60e3; q4.w.spWatchTick(); await sleep(40);
    check(!openOwn(eu.tiers[0]) && heldAll(), `once gA tips the half-minute look draws the tab again, and Safe loses its Add, Add to builder and Finish (${JSON.stringify(acts('safe'))})`);
    q4.w.localStorage.setItem('nba_hub_2027', JSON.stringify({ ...JSON.parse(q4.w.localStorage.getItem('nba_hub_2027') || '{}'), slip: { legs: [], stake: 20 } }));
    NOW = Date.parse(N1.tip) + 20 * 60e3;
    const q5 = load(st6, { lines: LINES1, record: null, tab: 'suggest' }); await settle(q5); await openTab(q5);
    const l5 = q5.d.querySelector(`#spSets [data-sp-game="${N1id}"] .sp-lock`);
    check(l5 && l5.dataset.spPhase === 'late' && txt(l5) === `Locked since ${etWd(lockN1)}. Under way since ${etWd(Date.parse(N1.tip))}. The site’s set was not published in time.` && !q5.d.querySelector('#spSets .pb-tier') && !q5.w.localStorage.getItem('nba_sp_lock_v1'),
      `under way with no set, none is built of the games left ("${l5 && txt(l5)}")`);
    NOW = Date.parse(N1.last) + 60e3;
    const q6 = load(st6, { lines: LINES1, record: null, tab: 'suggest', storage: { nba_sp_lock_v1: JSON.stringify(kept) } }); await settle(q6); await openTab(q6);
    check(!sets(q6).includes(N1id) && q6.d.querySelector('#spSets .sp-wait') && !q6.w.localStorage.getItem('nba_sp_lock_v1'), "after the night's last tip-off it leaves the tab and the key, the next night's wait line in its place"); }

  /* ---------- 7. the record's pills ---------- */
  NOW = Date.parse(T(D1, '15:00:00'));
  const lvR = (id, n, p0, fair) => ({ id, legs: Array.from({ length: n }, () => ({})), p: p0, fair, dec: 5 });
  const eN = (nid, tip, grade, season = SEASON) => ({ season, nid, tip, tiers: [lvR('safe', 2, 0.6, 0.55), lvR('med', 3, 0.3, 0.22), lvR('aggr', 4, 0.15, null)], grade });
  const eF = (gid, grade) => ({ season: SEASON, gid, tip: '1', tiers: [lvR('safe', 2, 0.4, 0.3), lvR('med', 3, 0.25, 0.2), lvR('aggr', 4, 0.12, 0.08), lvR('xtrm', 5, 0.06, 0.04)], grade });
  const RECX = { featured: { f1: eF('g1', { safe: { result: 'won', payout: 2.5 }, med: { result: 'lost', payout: 0 }, aggr: { result: 'lost', payout: 0 }, xtrm: { result: 'won', payout: 31 } }), f2: eF('g2', { safe: { result: 'lost', payout: 0 }, med: { result: 'won', payout: 4 }, aggr: { result: 'lost', payout: 0 } }) },
    night: { n1: eN('n1', 'a', { safe: { result: 'won', payout: 1.6 }, med: { result: 'lost', payout: 0 }, aggr: { result: 'push', payout: 1 } }), n2: eN('n2', 'a', { safe: { result: 'lost', payout: 0 }, med: { result: 'pending' }, aggr: { result: 'won', payout: 9 } }),
      n2b: eN('n2', 'b', { safe: { result: 'won', payout: 1.5 }, med: { result: 'won', payout: 4.2 }, aggr: { result: 'lost', payout: 0 } }), n3: eN('n3', 'a', { safe: { result: 'won', payout: 2 } }, SEASON - 1) } };
  /* this file's own count: each season's night (or game) and level once, from the last key that holds it */
  const sumOwn = (M, key) => { const out = Object.fromEntries(LVID.map(id => [id, { g: 0, w: 0, l: 0, push: 0, u: 0, m: 0, f: 0, fn: 0 }])), last = new Map(); let pending = 0;
    for (const k of Object.keys(M || {}).sort()) { const e = M[k]; for (const t of e.tiers) { const g = e.grade && e.grade[t.id]; if (g && LVID.includes(t.id)) last.set(`${e.season}|${e[key]}|${t.id}`, [t, g]); } }
    for (const [t, g] of last.values()) { const s = out[t.id]; if (g.result === 'pending') { pending++; continue; } if (g.result === 'push') { s.push++; continue; } s.g++; if (g.result === 'won') s.w++; else s.l++; s.m += t.p; if (t.fair != null) { s.f += t.fair; s.fn++; } s.u += (g.result === 'won' ? g.payout : 0) - 1; }
    return { out, pending }; };
  const un = v => (v > 0.0005 ? '+' : v < -0.0005 ? '−' : '') + Math.abs(v).toFixed(2);
  for (const [name, R] of [['a made-up record', RECX], ['the real record', fs.existsSync(path.join(ROOT, 'data', 'suggest_ledger.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'suggest_ledger.json'), 'utf8')) : null], ['one with no night map (the file before 7 November 2026)', { featured: RECX.featured }]]) {
    if (!R) continue;
    q = load(stateOf(SLATE), { lines: LINES1, record: R, tab: 'suggest' }); await settle(q); await openTab(q);
    const Nn = sumOwn(R.night, 'nid'), Ff = sumOwn(R.featured, 'gid'), got = [...q.d.querySelectorAll('#spRec .rec')];
    const ok = got.length === 3 + (Nn.pending ? 1 : 0) && LV.every(([id, label], i) => { const s = Nn.out[id], o = Ff.out[id];
      const title = `${label}: ${s.g} graded, ${s.w} won${s.g ? `; wins expected ${s.fn ? s.f.toFixed(1) + ' by DraftKings’ fair chance' + (s.fn < s.g ? ` (on the ${s.fn} with one)` : '') + ', ' : ''}${s.m.toFixed(1)} by the model` : ''}${s.push ? `; ${s.push} push${s.push === 1 ? '' : 'es'}, the stake back` : ''}; before 7 Nov, one game’s legs: ${o.w}–${o.l}${o.g || o.push ? `, ${un(o.u)} units` : ''}`;
      return got[i].dataset.spRec === id && txt(got[i]) === `${label} ${s.w}–${s.l}${s.g || s.push ? ' ' + un(s.u) + ' units' : ''}` && got[i].title === title; })
      && (!Nn.pending || txt(got[got.length - 1]) === `Pending ${Nn.pending}`);
    check(ok, `${name}: the pills count the night map alone, each number and title this file's own, the per-game record before in each title (${got.map(x => txt(x)).join(' | ')}; "${got[0] && got[0].title}")`);
  }
  q = load(stateOf(SLATE), { lines: LINES1, record: 'junk', tab: 'suggest' }); await settle(q); await openTab(q);
  check(q.d.getElementById('spRec') && q.d.getElementById('spRec').hidden && q.errors.length === 0, 'a record that is not JSON draws nothing and throws nothing');

  /* ---------- 8. the real files, on what the day offers ---------- */
  { NOW = Date.now();
    const realLines = fs.existsSync(path.join(ROOT, 'lines.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'lines.json'), 'utf8')) : null;
    const realRec = fs.existsSync(path.join(ROOT, 'data', 'suggest_ledger.json')) ? JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'suggest_ledger.json'), 'utf8')) : null;
    const r = load(REAL, { lines: realLines, record: realRec, tab: 'suggest' }); await settle(r); await openTab(r); await sleep(200);
    const N = nightOwn(REAL, NOW), shown = sets(r), body = txt(r.d.getElementById('spPanel'));
    check(N && N.up ? JSON.stringify(shown) === JSON.stringify([N.id]) : !shown.length, `on the real state the tab sets out this file's own night (${N ? (N.up ? N.id : 'waiting for ' + N.id) : 'none'})`);
    check(!/\bNaN\b|\bundefined\b|\bnull\b/.test(body) && r.errors.length === 0, 'the real tab shows no NaN or undefined and throws nothing: ' + r.errors.join(' | '));
    if (N && N.up && realLines && Date.now() < Date.parse(N.tip) - 2 * H) {
      const E = enumOwn(r, N.id), T3 = LVID.map(id => r.w.spTier(`${N.id}:${id}`));
      check(LVID.every((id, i) => (!T3[i] && !E.best[id]) || (T3[i] && E.best[id] && T3[i].legs.map(l => l.sk).sort().join(',') === E.best[id].ids)), `the real night's live levels are this file's own enumeration's (${E.count} parlays)`);
    }
    const lockLines = [...r.d.querySelectorAll('#spSets .sp-lock')];
    check(lockLines.every(x => /^(Locks \w{3} \d{1,2}:\d{2} [AP]M ET, 2 hours before the first tip-off\.|Locked since \w{3} \d{1,2}:\d{2} [AP]M ET\..*|Locked since \w{3} \d{1,2}:\d{2} [AP]M ET\. Under way since .*)$/.test(txt(x))), `each real set's lock line is one of the tab's (${lockLines.length})`); }
};
