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
 * builder's chance, none far off, and on the page with player legs (from 23:00 UTC on 7 November 2026) every player's main line on DraftKings, over
 * and under, at DraftKings' own fair chance (the whole margin on the Over), on a player the props model places on one of
 * the game's clubs and no report lists, each 45% to 97%), each level against this file's own enumeration of every parlay
 * the pool makes (one side, one total and one leg a player a game; each one's chance and price the builder's own
 * parlayProb and parlayDec on its legs, never the page's search) by its rule (since 8 November 2026 no leg limit: Safe the
 * likeliest of 2 legs or more paying $2 or more on $1; Medium $4; Aggressive $8; ties to the dearer, then the fewer legs,
 * then the ids), a player
 * the report lists left out and the levels the enumeration's without him, a one-game night's empty levels word for word,
 * a fair same-game pair that moves together beating the pairs across games and 36 random nights of made-up legs, each
 * level against this file's own enumeration (bruteOwn), a line priced with no margin left out of the pool and counted,
 * a 15-game night of 1,200 player lines held to the guard's own enumeration and its own reading of the files (its time
 * said, and held only far above a runner's noise), the parlay card's chance words for each mix, the cards' words (a
 * player leg's line, price and "fair N%", no Value mark, the chance line saying what it is made of),
 * Add, Add to builder and Finish, after the lock a level the page built again standing under way, one holding a listed
 * player closed, nothing built from no lines and no empty replacement kept, the browser's own lock across a reload (a
 * per-game lock from before taken out) and given
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
  /* the levels since the owner's call of 8 November 2026: no leg limit, Safe $2 on $1 (until then Safe was the likeliest
     pair and Medium and Aggressive took 2 to 5 legs) */
  const LV = [['safe', 'Safe', 2, null, 2, 'player'], ['med', 'Medium', 2, null, 4, 'player'], ['aggr', 'Aggressive', 2, null, 8, 'player']], LVID = LV.map(l => l[0]);
  const RULE = { safe: 'likeliest paying $2+', med: 'likeliest paying $4+', aggr: 'likeliest paying $8+' };
  /* the rule with a player (the owner's call of 10 November 2026): a level holding a player leg says so, one that holds
     none (the night's legs make no parlay holding one that meets it) says why: no player line read for the night's games
     still to tip, else none that fits; this file's own words and its own reading of which */
  const NOPL_OWN = { lines: 'no player lines yet', fit: 'no player leg fits' };
  const ruleOwn = (t, nopl) => t.legs && t.legs.some(l => l.kind === 'prop') ? `${RULE[t.id]} with a player` : t.legs ? `${RULE[t.id]} · ${NOPL_OWN[nopl]}` : `${RULE[t.id]} with a player`;
  /* the rule's title on a level's card (the only place the page states the rule whole), this file's own words: the rule
     with a player (need) and the rule before (no leg limit, no player asked), each on the level's floor F; a level of the
     rule before 8 November 2026 (a leg limit) has none */
  const LEAN_OWN = 'More legs on favourites stack the model’s overconfidence on team legs: on the record its expected wins ran about twice DraftKings’.';
  const titleOwn = (F, need, capped) => capped ? '' : need
    ? `No leg limit: the likeliest parlay of the night’s legs (team legs at the model’s chance, player legs at DraftKings’ fair chance) that pays $${F} or more on $1 and holds at least one player leg, wherever the night’s legs make one; where they make none, the likeliest without one. ${LEAN_OWN}`
    : `No leg limit: the likeliest parlay of the night’s legs that pays $${F} or more on $1. ${LEAN_OWN}`;
  const noplOwn = (lines, gids) => gids.some(id => { const pr = lines && lines.games && lines.games[id] && lines.games[id].props; return !!pr && Array.isArray(pr.mains) && pr.mains.some(m => m && Number.isFinite(m.line) && Number.isFinite(m.over) && Number.isFinite(m.under) && m.over && m.under); }) ? 'fit' : 'lines';
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
  /* the props model prices two of gA's players, and DraftKings' main lines on them join the night's pool at DraftKings'
     own fair chance (the owner's call of 7 November 2026: no model claim on a player leg): Ace Guard's points over 19.5
     and his rebounds over 2.5, likelier than any team leg, so the levels take a player leg, and a page taking two legs of
     one player would pair them (one leg a player); two
     milestones and a Yes market beside them, likely too, which no set takes */
  const ROWS = { [gA.id]: { 9300001: ['Ace Guard', 'BOS', 'G', 34, 27.5, 5, 6, 3, 1.2, 0.4, 0.2, 0.02], 9300003: ['Cy Big', 'NYK', 'C', 30, 14, 11, 2.5, 0.5, 0.7, 1.6, 0.45, 0.01] } };
  const VAR = REAL.props.dist.var, COMBOS = REAL.props.combos;
  const muOf = (row, k) => k in COMBOS ? COMBOS[k].reduce((t, s) => t + row[LAY.indexOf(s)], 0) : row[LAY.indexOf(k)];
  const mainOf = (pid, row, stat, line) => { const m = muOf(row, stat), p = PJ.pOver(line, m, PJ.nbVar(m, VAR[stat])); return { player: String(pid), stat, line, over: am(p - 0.05), under: am(1 - p + 0.08) }; };
  const idsOf = g => ({ event: 'E' + g.espn, ml: { home: `0ML${g.espn}_1`, away: `0ML${g.espn}_3` }, spread: { home: `0HC${g.espn}_1`, away: `0HC${g.espn}_3` }, total: { over: `0OU${g.espn}_1`, under: `0OU${g.espn}_3` } });
  const READ = T(D1, '14:00:00'), BIG_STATS = ['pts', 'reb', 'ast', 'tpm', 'pra'];
  function lineOf(g, o = {}) {
    const sp = Math.round(-g.model.spread) - 0.5 * Math.sign(g.model.spread || 1), sh = o.shift || 0;
    return { at: o.at || READ, espn: g.espn, ml: { home: am(g.model.pHome - 0.06 + sh), away: am(1 - g.model.pHome + 0.08 - sh) }, spread: { line: -Math.abs(sp) * Math.sign(-g.model.spread || 1), home: -110, away: -110 },
      total: { line: Math.floor(g.model.total) + 0.5, over: -110, under: -110 }, ids: idsOf(g),
      props: ROWS[g.id] ? { at: o.at || READ, mains: g.id === gA.id ? [mainOf(9300001, ROWS[g.id][9300001], 'pts', 19.5), mainOf(9300001, ROWS[g.id][9300001], 'reb', 2.5), mainOf(9300003, ROWS[g.id][9300003], 'reb', 9.5)]
        : Object.entries(ROWS[g.id]).flatMap(([pid, row]) => BIG_STATS.map(k => mainOf(pid, row, k, Math.floor(muOf(row, k)) + 0.5))),
        ladders: g.id === gA.id ? [{ player: '9300001', stat: 'pts', k: 20, price: -400 }, { player: '9300003', stat: 'reb', k: 8, price: -350 }] : [], yes: g.id === gA.id ? [{ player: '9300003', market: 'dd', price: -150 }] : [] } : null };
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
     out), 45% to 97%, none 15 points or more over DraftKings' fair chance; and every player's main line, over and under
     with both prices on file, on a stat the page offers, at DraftKings' own fair chance (the Over 1 less the Under's
     implied chance, the Under that implied chance), 45% to 97%, on a player the props model places on one of the game's
     clubs whom neither the game's out lists nor the report list (a probable player plays) */
  const PL_STATS_OWN = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'];
  const heldOwn = (st, g, pid) => { const sides = [g.model && g.model.home, g.model && g.model.away].filter(Boolean);
    if (sides.some(x => (x.out || []).some(y => String(y.id) === String(pid)))) return true;
    const r = st.report && st.report.players && st.report.players[pid]; return Array.isArray(r) && !/^probable/i.test(String(r[1] || '').trim()); };
  function poolOwn(st, lines, now, N) {
    const out = [];
    for (const g of N.games.filter(g => toCome(g, now))) { const x = lines.games[g.id], pr = x && x.props, rows = st.props.games[g.id] && st.props.games[g.id].players;
      if (!pr || !Array.isArray(pr.mains) || !rows) continue;
      for (const m of pr.mains) { const row = rows[m.player];
        if (!PL_STATS_OWN.includes(m.stat) || !row || (row[1] !== g.away && row[1] !== g.home) || heldOwn(st, g, m.player) || !Number.isFinite(m.over) || !Number.isFinite(m.under)) continue;
        /* a line priced with no margin (its two implied chances under 1) is left out: its fair Over would read over its price */
        if (imp(m.over) + imp(m.under) < 1) continue;
        const fo = 1 - imp(m.under);
        for (const [sd, odds, pp] of [['over', m.over, fo], ['under', m.under, 1 - fo]]) if (pp >= 0.45 && pp < 0.97) out.push({ sk: [g.id, 'prop', m.player, m.stat, 'main', m.line, sd].join('|'), p: pp, odds, kind: 'prop', pid: String(m.player) }); } }
    for (const g of N.games.filter(g => toCome(g, now))) { const x = lines.games[g.id]; if (!x) continue;
      const add = (kind, s, line, odds, other, p) => { const fair = imp(odds) / (imp(odds) + imp(other)); if (p >= 0.45 && p < 0.97 && p - fair < 0.15 - 1e-9) out.push({ sk: [g.id, kind, s, line == null ? '' : line].join('|'), p, odds }); };
      if (x.ml) { add('ml', g.home, null, x.ml.home, x.ml.away, g.model.pHome); add('ml', g.away, null, x.ml.away, x.ml.home, 1 - g.model.pHome); }
      if (x.spread) { const m = -g.model.spread; add('spread', g.home, x.spread.line, x.spread.home, x.spread.away, PJ.normCdf((m + x.spread.line) / 14.5)); add('spread', g.away, -x.spread.line, x.spread.away, x.spread.home, PJ.normCdf((-m - x.spread.line) / 14.5)); }
      if (x.total && imp(x.total.over) + imp(x.total.under) >= 1) { const po = imp(x.total.over) / (imp(x.total.over) + imp(x.total.under)); add('total', 'over', x.total.line, x.total.over, x.total.under, po); add('total', 'under', x.total.line, x.total.under, x.total.over, 1 - po); } }
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
  const own1 = poolOwn(stateOf(SLATE), LINES1, NOW, N1), plOwn1 = own1.filter(l => l.kind === 'prop');
  check(JSON.stringify(pagePool.map(l => l.sk)) === JSON.stringify(own1.map(l => l.sk)) && pagePool.every((l, i) => l.odds === own1[i].odds && Math.abs(l.p - own1[i].p) < (l.kind === 'prop' ? 1e-12 : 1e-6)) && plOwn1.length >= 2,
    `the pool is this file's own: every team leg of the night at DraftKings' price and the builder's chance, none far off, and every player main line at DraftKings' own fair chance, each 45% to 97% (${pagePool.length} legs, ${plOwn1.length} of them player legs: ${plOwn1.map(l => l.sk.split('|').slice(2).join(' ')).join('; ')})`);
  /* every parlay the pool makes (a game: nothing, or any of its legs together with one side, one total and one leg a
     player at most; no leg limit since 8 November 2026), each game's options' chances and prices by the builder's own
     parlayProb and parlayDec on their legs (a parlay's are their products across games, as the builder's own sums are),
     the best of each level by its rule; the walk leaves a branch only where its chance is under the best a level has
     (a parlay's chance never rises as a leg joins it), so every parlay that could rank first is ranked */
  const ENUM_OWN = `(legs, LV, nopl) => {
    const by = new Map(); for (const l of legs) { if (!by.has(l.gid)) by.set(l.gid, []); by.get(l.gid).push(l); }
    const grpOf = l => l.kind === 'ml' || l.kind === 'spread' ? 'side' : l.kind === 'total' ? 'total' : 'p' + l.pid;
    const G = [...by.values()].map(L => { const groups = new Map(); for (const l of L) { const k = grpOf(l); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
      let o = [[]]; for (const ls of groups.values()) o = o.flatMap(c => [c, ...ls.map(l => [...c, l])]);
      return o.filter(c => c.length).map(c => { const L2 = pbOrder(c); return { c, p: parlayProb(L2).corr, d: parlayDec(L2.map(l => ({ leg: l, ml: l.price }))) }; }).sort((a, b) => b.p - a.p); });
    /* the best of each level by the rule before (raw) and among the parlays holding a player leg (pl): a level is pl's
       where there is one, else raw's, saying why (nopl) on the rule with a player; a branch is left only where its chance
       is under every level's best it could still change (pl's on a night with a player leg, else raw's) */
    const raw = {}, pl = {}, pick = [], anyPl = legs.some(l => l.kind === 'prop'); let count = 0, low = -Infinity;
    const better = (c, b) => !b || c.p > b.p + 1e-12 || (Math.abs(c.p - b.p) <= 1e-12 && (c.d > b.d + 1e-12 || (Math.abs(c.d - b.d) <= 1e-12 && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
    (function go(i, pp, dd, nL, hp) {
      if (pp < low) return;
      if (nL >= 2) { count++; let ids = null, moved = false;
        for (const [id, , lo, hi, F] of LV) for (const [M, ok] of [[raw, true], [pl, hp]]) { const b = M[id];
          if (ok && nL >= lo && (hi == null || nL <= hi) && dd >= F - 1e-9 && (!b || pp >= b.p - 1e-12)) { ids = ids || pick.flatMap(o => o.c.map(l => l.sk)).sort().join(','); const c = { p: pp, d: dd, n: nL, ids, hp }; if (better(c, b)) { M[id] = c; moved = true; } } }
        if (moved) low = Math.min(...LV.map(([id]) => { const b = anyPl && LV.find(l => l[0] === id)[5] ? pl[id] : raw[id]; return b ? b.p - 1e-12 : -Infinity; })); }
      for (let j = i; j < G.length; j++) for (const o of G[j]) { if (pp * o.p < low) break; pick.push(o); go(j + 1, pp * o.p, dd * o.d, nL + o.c.length, hp || o.c.some(l => l.kind === 'prop')); pick.pop(); }
    })(0, 1, 1, 0, false);
    const best = {}; for (const [id, , , , , need] of LV) { if (need && pl[id]) best[id] = { ...pl[id], nopl: null }; else if (raw[id]) best[id] = { ...raw[id], nopl: need ? (nopl || 'fit') : null }; }
    return { best, raw, pl, count };
  }`;
  const enumOwn = (q, nid, nopl) => JSON.parse(q.w.eval(`(() => { const pool = spPool(spById(${JSON.stringify(nid)})).legs; return JSON.stringify((${ENUM_OWN})(pool, ${JSON.stringify(LV)}, ${JSON.stringify(nopl || 'fit')})); })()`));
  { const E = enumOwn(p, N1id);
    check(LVID.every((id, i) => { const t = tiers1[i], b = E.best[id]; return t && b && t.legs.map(l => l.sk).sort().join(',') === b.ids && Math.abs(t.corr - b.p) < 1e-12 && Math.abs(t.dec - b.d) < 1e-12; }),
      `each level is the best of this file's own enumeration of all ${E.count} parlays by its rule, its chance and price the builder's sums (${LVID.map((id, i) => `${id} ${tiers1[i] ? (tiers1[i].corr * 100).toFixed(2) + '% at ' + tiers1[i].dec.toFixed(2) : '-'}`).join(', ')})`); }
  check(tiers1[0].dec >= 2 && tiers1[1].dec >= 4 && tiers1[2].dec >= 8 && tiers1.every(t => t.legs.length >= 2 && t.min === 2 && t.max === null && t.need === 'player'), "Safe pays $2 or more on $1, Medium $4 or more and Aggressive $8 or more, each 2 legs or more with no leg limit, on the rule with a player");
  /* the rule with a player moved this night: by this file's own enumeration the rule before takes team legs alone on a
     level, and every level holds a player leg */
  { const E = enumOwn(p, N1id), moved = LVID.filter(id => E.raw[id] && !E.raw[id].hp);
    check(moved.length > 0 && tiers1.every(t => t.legs.some(l => l.kind === 'prop')) && moved.every(id => E.pl[id] && E.pl[id].p < E.raw[id].p),
      `every level holds a player leg, where the rule before takes team legs alone (${moved.map(id => `${id}: ${(E.raw[id].p * 100).toFixed(2)}% team legs alone, ${(E.pl[id].p * 100).toFixed(2)}% with a player`).join('; ') || 'no level moved'})`); }
  check(tiers1.every(t => { const by = {}; for (const l of t.legs) { const k = l.gid + (l.kind === 'total' ? 't' : l.kind === 'prop' ? 'p' + l.pid : 's'); by[k] = (by[k] || 0) + 1; } return Object.values(by).every(v => v === 1) && t.legs.every(l => N1.games.some(g => g.id === l.gid)); }), 'every level: one side, one total and one leg a player a game at most, every leg a game of the night');
  { const sums = tiers1.map(t => JSON.parse(p.w.eval(`(() => { const L = spTier(${JSON.stringify(N1id + ':' + t.id)}).legs; const f = parlayFair(L); return JSON.stringify({ f: f.p }); })()`)));
    check(tiers1.every((t, i) => Math.abs(t.fair.p - sums[i].f) < 1e-12), "each level's fair chance is the builder's own parlayFair on its legs"); }
  /* the cards */
  /* the chance line by this file's own reading: a level of team legs alone "model says N%"; one mixing team and player
     legs "model + DraftKings N%", titled with what it is made of; of player legs alone "every leg at DraftKings' chance" */
  const mixOwn = t => { const np = t.legs.filter(l => l.kind === 'prop').length; return np === t.legs.length ? 'player' : np ? 'mixed' : null; };
  const chanceOwn = t => { const m = mixOwn(t), pc = (t.corr * 100).toFixed(0) + '%'; return m === 'player' ? 'every leg at DraftKings’ chance' : m ? `model + DraftKings ${pc}` : `model says ${pc}`; };
  check(tiers1.every(t => { const c = card(t.id), mo = c.querySelector('.pb-model'), m = mixOwn(t); return txt(c.querySelector('.pb-rule')) === ruleOwn(t, noplOwn(LINES1, N1.games.map(g => g.id))) && txt(c.querySelector('.pb-pill')) === `${t.legs.length} legs` && txt(mo) === chanceOwn(t) && txt(c.querySelector('[data-pb-fair]')) === (t.fair.p * 100).toFixed(0) + '%'
      && (m ? mo.dataset.pbMix === m && /DraftKings’ fair chance/.test(mo.title) && /no model claim|carries no model claim/.test(mo.title) && /a player Under breaks even and an Over gives up about 12%/.test(mo.title) : !mo.dataset.pbMix); }),
    `each card says its rule (${LVID.map(id => `"${txt(card(id).querySelector('.pb-rule'))}"`).join(', ')}), its legs, the fair chance and the chance it is ranked on, said for what it is (${LVID.map(id => `"${txt(card(id).querySelector('.pb-model'))}"`).join(', ')})`);
  /* the rule's title, word for word: the only place the page states the rule whole (the review of 10 November 2026) */
  check(tiers1.every(t => { const r = card(t.id).querySelector('.pb-rule'); return r && r.title === titleOwn(t.price, 'player'); }),
    `each card's rule is titled with the rule with a player whole, word for word ("${(card('safe').querySelector('.pb-rule') || {}).title || ''}")`);
  /* a level as the record keeps it, drawn back with its own rule's words: a set of the rule before 10 November 2026 (no
     need in its head) says no player word; one of the rule with a player holding one says so; one holding none says why
     as kept (its nopl), and "no player leg fits" where it keeps none */
  { const W = JSON.parse(p.w.eval(`(() => { const N = spById(${JSON.stringify(N1id)}), t = ['aggr', 'med', 'safe'].map(id => spTier(${JSON.stringify(N1id)} + ':' + id)).find(x => x && x.legs.filter(l => l.kind !== 'prop').length >= 2) || spTier(${JSON.stringify(N1id + ':med')}), o = spTierOut(t), team = o.legs.filter(l => l.kind !== 'prop'), F = o.price;
      const nc = { ...o }; delete nc.need; const tm = { ...o, legs: team, nopl: 'lines' }, tf = { ...o, legs: team }; delete tf.nopl;
      const r = x => { const y = spTierIn(x, N); return y ? y.rule : null; }, rt = x => { const y = spTierIn(x, N); return y ? y.ruleTitle : null; };
      return JSON.stringify({ nc: r(nc), pl: r(o), tm: team.length >= 2 ? r(tm) : 'skip', tf: team.length >= 2 ? r(tf) : 'skip', n: team.length, F,
        tt: { nc: rt(nc), pl: rt(o), tm: team.length >= 2 ? rt(tm) : 'skip', tf: team.length >= 2 ? rt(tf) : 'skip' } }); })()`));
    check(W.n >= 2 && W.nc === `likeliest paying $${W.F}+` && W.pl === `likeliest paying $${W.F}+ with a player` && W.tm === `likeliest paying $${W.F}+ · no player lines yet` && W.tf === `likeliest paying $${W.F}+ · no player leg fits`,
      `a kept level drawn back in its own rule's words (the rule before: "${W.nc}"; with a player: "${W.pl}"; holding none: "${W.tm}", "${W.tf}")`);
    check(W.tt.nc === titleOwn(W.F, null) && ['pl', 'tm', 'tf'].every(k => W.tt[k] === titleOwn(W.F, 'player')),
      `and titled with its own rule whole, word for word (the rule before: "${W.tt.nc}"; with a player, holding one or none: "${W.tt.pl}")`); }
  check(tiers1.every(t => { const c = card(t.id), pay = c.querySelector('[data-pb-pay]'); return Math.abs(+pay.dataset.pbPay - t.dec) < 1e-12 && txt(pay.querySelector('b')) === '$' + (20 * t.dec).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }); }), 'each card pays the Bet amount times its price');
  { const lis = tiers1.flatMap(t => [...card(t.id).querySelectorAll('.pb-legs li')].map((li, i) => [li, t.legs[i]]));
    check(lis.every(([li, l]) => { const sm = txt(li.querySelector('small')).replace(/\s*Value$/, ''); return l.kind === 'total' ? sm === l.label && txt(li.querySelector('.glance-name, .nm')).startsWith(`${NICK[l.away]} at ${NICK[l.home]}`) : sm === `${l.label} · ${l.away} at ${l.home}`; }),
      'each leg says its game ("To win · BOS at NYK"; a total named by its game)');
    check(lis.every(([li, l]) => !!li.querySelector('.pb-valmark') === (l.kind !== 'prop' && l.thin === false && !l.market)) && !p.d.querySelector('#spSets .pb-trial'), 'a team leg 3 points over its price is marked Value and nothing else is; no player leg marked; no on-trial mark');
    /* a player leg: his name, its line and game, DraftKings' price and "fair N%" at its own fair chance; no Value mark,
       no model figure, no far-off flag */
    const plLis = lis.filter(([, l]) => l.kind === 'prop'), own = new Map(own1.map(l => [l.sk, l]));
    check(plLis.length > 0 && plLis.every(([li, l]) => { const em = li.querySelector('.pr em'), o = own.get(l.sk);
      return o && txt(li.querySelector('.glance-name, .nm')).startsWith(l.name) && em && em.hasAttribute('data-pb-plfair') && txt(em) === 'fair ' + (o.p * 100).toFixed(0) + '%' && txt(li.querySelector('.pr')).startsWith((l.price > 0 ? '+' : '') + Math.round(l.price))
        && !li.querySelector('.pb-valmark, .faroff, .pb-trial') && !/model/i.test(txt(li)); }),
      `each player leg on a card shows his name, its line and game, DraftKings' price and "fair N%", no Value mark or model figure (${plLis.length}: ${plLis.map(([li]) => txt(li)).join(' | ')})`);
    check(lis.filter(([, l]) => l.kind !== 'prop').every(([li, l]) => { const em = li.querySelector('.pr em'); return em && !em.hasAttribute('data-pb-plfair') && txt(em).startsWith((l.p * 100).toFixed(0) + '%'); }), "a team leg keeps the model's chance beside its price"); }
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
    check(LVID.every((id, i) => { const t = pf.w.spTier(`${N1id}:${id}`); return t && t.legs.map(l => l.sk).join() === tiers1[i].legs.map(l => l.sk).join(); }) && !pf.errors.length, 'after the props model\'s FAIL the same set: a player leg stands on DraftKings\' chance, never the model\'s, either way'); }
  /* a player the report lists (Questionable, Day-To-Day: anything but Probable) is left out of the pool, his legs and
     every parlay holding one, and the levels are this file's enumeration's without him; a probable one plays */
  { const pid0 = plOwn1[0].pid, nm = ROWS[gA.id][pid0][0];
    for (const [status, out] of [['Day-To-Day', true], ['Questionable', true], ['Probable', false]]) {
      const stQ = stateOf(SLATE, { report: { [pid0]: [nm, status, 'ankle'] } }), q = load(stQ, { lines: LINES1, record: null, tab: 'suggest' }); await settle(q); await openTab(q);
      const pp = JSON.parse(q.w.eval(`JSON.stringify(spPool(spById(${JSON.stringify(N1id)})).legs.map(l => l.sk))`)), ownQ = poolOwn(stQ, LINES1, NOW, N1).map(l => l.sk);
      const E = enumOwn(q, N1id), TQ = LVID.map(id => q.w.spTier(`${N1id}:${id}`));
      check(JSON.stringify(pp) === JSON.stringify(ownQ) && pp.some(k => k.split('|')[2] === pid0) === !out && (!out || TQ.every(t => !t || !t.legs.some(l => String(l.pid) === pid0)))
        && LVID.every((id, i) => TQ[i] && E.best[id] && TQ[i].legs.map(l => l.sk).sort().join(',') === E.best[id].ids),
        `${nm} listed ${status}: ${out ? 'left out of the pool and every level' : 'he plays, his legs in the pool'}, the levels this file's own enumeration's (${TQ.map(t => t ? t.legs.length + ' legs' : '-').join(', ')})`); } }
  /* DraftKings' player lines posted and every player on them listed Out (the review of 10 November 2026: no live card
     had said "no player leg fits"): each level the likeliest without one, drawn live, saying so word for word by this
     file's own reading of why, titled with the rule whole, the levels this file's own enumeration's */
  { const outs = [...new Set(Object.values(LINES1.games).flatMap(g => g.props && Array.isArray(g.props.mains) ? g.props.mains.map(m => String(m.player)) : []))];
    const nmOf = pid => { for (const g of Object.values(ROWS)) if (g[pid]) return g[pid][0]; return 'Player ' + pid; };
    const stO = stateOf(SLATE, { report: Object.fromEntries(outs.map(pid => [pid, [nmOf(pid), 'Out', 'ankle']])) }), q = load(stO, { lines: LINES1, record: null, tab: 'suggest' }); await settle(q); await openTab(q);
    const why = noplOwn(LINES1, N1.games.map(g => g.id)), E = enumOwn(q, N1id, why), TO = LVID.map(id => q.w.spTier(`${N1id}:${id}`));
    const cardO = id => q.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="${id}"] .pb-rule`);
    check(outs.length >= 2 && why === 'fit' && poolOwn(stO, LINES1, NOW, N1).every(l => l.kind !== 'prop')
      && LVID.every((id, i) => { const t = TO[i], r = cardO(id); return t && t.legs.length >= 2 && !t.legs.some(l => l.kind === 'prop') && t.nopl === 'fit' && E.best[id] && E.best[id].nopl === 'fit' && t.legs.map(l => l.sk).sort().join(',') === E.best[id].ids
        && r && txt(r) === ruleOwn(t, why) && txt(r) === `${RULE[id]} · no player leg fits` && r.title === titleOwn(t.price, 'player'); }) && !q.errors.length,
      `player lines posted and every player on them (${outs.length}) listed Out: each level the likeliest without one, drawn live saying so (${LVID.map(id => `"${txt(cardO(id))}"`).join(', ')}), this file's own enumeration's`); }
  /* a line priced with no margin (the review of 7 November 2026: its two implied chances under 1, so its fair Over, and
     a total's fair chance, would read over its own price, an edge leg the search's proof is not built for): Cy Big's
     assists at +105 both ways and LAL at GSW's total at +105 both ways, each left out of the pool and counted (two legs
     each), the levels this file's own enumeration's without them */
  { const LV0 = clone(LINES1); LV0.games[gA.id].props.mains.push({ player: '9300003', stat: 'ast', line: 2.5, over: 105, under: 105 }); LV0.games[gB.id].total = { ...LV0.games[gB.id].total, over: 105, under: 105 };
    const qv = load(stateOf(SLATE), { lines: LV0, record: null, tab: 'suggest' }); await settle(qv); await openTab(qv);
    const pv = JSON.parse(qv.w.eval(`(() => { const P = spPool(spById(${JSON.stringify(N1id)})); return JSON.stringify({ sk: P.legs.map(l => l.sk), vig: P.vig, plv: P.pl.vig }); })()`));
    const ownV = poolOwn(stateOf(SLATE), LV0, NOW, N1).map(l => l.sk), EV = enumOwn(qv, N1id), TV = LVID.map(id => qv.w.spTier(`${N1id}:${id}`));
    check(JSON.stringify(pv.sk) === JSON.stringify(ownV) && pv.vig === 2 && pv.plv === 2 && !pv.sk.some(k => k.includes('|prop|9300003|ast|') || k.startsWith(gB.id + '|total|'))
      && LVID.every((id, i) => TV[i] && EV.best[id] && TV[i].legs.map(l => l.sk).sort().join(',') === EV.best[id].ids),
      `a main line and a total priced with no margin (+105 both ways) are left out of the pool and counted (vig ${pv.vig} and ${pv.plv}), the pool this file's own, the levels its enumeration's (${pv.sk.length} legs)`); }

  /* ---------- 4. a one-game night, ties, and a night of 15 games ---------- */
  { const stO = stateOf([gF], { today: D3 }); NOW = Date.parse(T(D3, '15:00:00'));
    const q = load(stO, { lines: linesOf([gF]), record: null, tab: 'suggest' }); await settle(q); await openTab(q);
    const nid = `${SEASON}_${ymd(D3)}_NIGHT`, s = q.w.spTier(`${nid}:safe`), whys = [...q.d.querySelectorAll(`#spSets [data-sp-game="${nid}"] .pb-why`)].map(txt);
    check(s && s.legs.length === 2 && s.legs.some(l => l.kind === 'total') && JSON.stringify(whys) === JSON.stringify(['No parlay of the night’s legs pays $4 or more on $1: one game makes 2 legs at most.', 'No parlay of the night’s legs pays $8 or more on $1: one game makes 2 legs at most.'])
      && [...q.d.querySelectorAll(`#spSets [data-sp-game="${nid}"] .pb-tier.none .pb-pill`)].every(x => txt(x) === '2+ legs'),
      `a one-game night: Safe its side and total, Medium and Aggressive empty saying why word for word ("${whys[1]}")`);
    const E = enumOwn(q, nid, 'lines'), rw = txt(q.d.querySelector(`#spSets [data-sp-game="${nid}"] [data-pb-tier="safe"] .pb-rule`));
    check(!E.best.med && !E.best.aggr && E.best.safe && E.best.safe.ids === s.legs.map(l => l.sk).sort().join(','), "and this file's own enumeration agrees");
    check(rw === ruleOwn(s, noplOwn(linesOf([gF]), [gF.id])) && rw === 'likeliest paying $2+ · no player lines yet', `with no player line posted, Safe is the likeliest without one and says why in its words ("${rw}")`);
    const rt = (q.d.querySelector(`#spSets [data-sp-game="${nid}"] [data-pb-tier="safe"] .pb-rule`) || {}).title;
    check(rt === titleOwn(2, 'player'), `and is titled with the rule with a player whole, its fallback said ("${rt}")`); }
  /* ties, on the page's search itself (spSearch on spPrep) over legs made up here, one a game: the dearer of two parlays
     level on their chance, and of two level on both the first by the legs' ids */
  { const amOf = d => d >= 2 ? 100 * (d - 1) : -100 / (d - 1), o = (gid, pp, d) => ({ sk: gid + '|a', gid, id: gid, kind: 'ml', side: 'a', p: pp, price: amOf(d) });
    const X = () => p.w.spPrep({ legs: [o('g1', 0.6, 1.8), o('g2', 0.6, 1.9), o('g3', 0.6, 1.9), o('g4', 0.5, 2.0)] });
    const safe = p.w.spSearch(X(), LV[0]), med = p.w.spSearch(X(), LV[1]);
    check(safe && safe.ids === 'g2|a,g3|a', `the likeliest pair paying $2, of three level on their chance, is the dearer, then the first by ids (${safe && safe.ids})`);
    check(med && med.ids === 'g1|a,g2|a,g3|a' && Math.abs(med.d - 1.8 * 1.9 * 1.9) < 1e-9, `Medium: no pair pays $4, so the likeliest triple (${med && med.ids}, ${med && med.d.toFixed(3)})`); }
  /* the page's search against this file's own enumeration of every parlay made-up legs make (each game's options, its
     legs alone or together with one side, one total and one leg a player, by the builder's own parlayProb and parlayDec;
     a parlay's figures their products across games, as the builder's own sums are), the best of each level by the rule:
     the search run as spBuild runs it, from the team legs' own best */
  const skOf = l => l.kind === 'prop' ? [l.id, 'prop', l.pid, l.stat, 'main', l.line, l.side].join('|') : [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
  const legOf = (gid, o) => { const [, , a, h] = gid.split('_'), l = { id: gid, gid, away: a, home: h, date: D1, tip: T(D2, '00:30'), at: READ, line: null, ...o, mk: o.kind === 'prop' ? 'main' : undefined };
    if (l.mk === undefined) delete l.mk; l.price = l.odds; l.sk = skOf(l); if (l.kind === 'prop') { l.name = 'Player ' + l.pid; l.label = `${l.side === 'under' ? 'Under' : 'Over'} ${l.line} ${l.stat}`; } return l; };
  const bruteOwn = (q, legs) => JSON.parse(q.w.eval(`(() => {
    const legs = ${JSON.stringify(legs)}, LV = ${JSON.stringify(LV)}, { best } = (${ENUM_OWN})(legs, LV);
    const X = spPrep({ legs }), Xt = spPrep({ legs: legs.filter(l => l.kind !== 'prop') }), page = {};
    for (const lv of LV) { const r = spRule(X, lv, Xt.games.length ? spSearch(Xt, lv) : null, { pl: { lines: legs.filter(l => l.kind === 'prop').length, held: 0, none: 0, vig: 0 } }).r; page[lv[0]] = r ? { p: r.p, d: r.d, ids: r.ids, n: r.n } : null; }
    return JSON.stringify({ best, page });
  })()`));
  const agree = R => LVID.every(id => { const b = R.best[id], g = R.page[id]; return (!b && !g) || (b && g && b.ids === g.ids && Math.abs(b.p - g.p) <= 1e-12 * Math.max(1, b.p)); });
  /* a fair pair of one game that moves together beats every pair across games (the review of 7 November 2026; since the
     $2 floor of 8 November 2026 at prices that pay it): the Thunder to win at -150 (the model's 58%, under its price)
     with a Wizard's Under 18.5 points at -150 (DraftKings' fair 60%, the correlation the table's team|pts|win, +0.128),
     paying $2.36 at the same-game hold, against the Hawks to win at -133 (60.5%) in another game: Safe is the same-game
     pair, likelier than the Under with the Hawks (36.3%), though its two chances multiplied (34.8%) are not */
  { const gW = `${SEASON}_${ymd(D1)}_WAS_OKC`, gK = `${SEASON}_${ymd(D1)}_BKN_ATL`;
    const L1 = [legOf(gW, { kind: 'ml', side: 'OKC', odds: -150, other: 130, p: 0.58 }), legOf(gW, { kind: 'prop', pid: '9610001', team: 'WAS', stat: 'pts', line: 18.5, side: 'under', odds: -150, other: 125, p: 0.6 }),
      legOf(gK, { kind: 'ml', side: 'ATL', odds: -133, other: 115, p: 0.605 })];
    const R = bruteOwn(p, L1), sf = R.best.safe;
    check(agree(R) && sf && sf.ids === [L1[0].sk, L1[1].sk].sort().join(',') && sf.p > 0.6 * 0.605 && sf.d >= 2 && 0.58 * 0.6 < 0.6 * 0.605,
      `a fair same-game pair that moves together (${sf ? (sf.p * 100).toFixed(2) : '-'}%, paying ${sf ? sf.d.toFixed(3) : '-'}) beats the Under with the Hawks across games (${(0.6 * 60.5).toFixed(2)}%), though its chances multiplied (34.80%) do not: the page's Safe ${R.page.safe ? R.page.safe.ids : 'none'} (${R.page.safe ? (R.page.safe.p * 100).toFixed(2) : '-'}%), this file's ${sf ? sf.ids : 'none'}`); }
  /* no leg limit (the owner's call of 8 November 2026): eight games of heavy favourites, each home side to win at -900 (the
     model's 92%), and in the first game two Unders of one player at -900 (DraftKings' fair 90%): Safe needs seven legs to
     pay $2 on $1, and takes one leg of that player at most, whatever the depth */
  { const CL8 = [['ATL', 'BOS'], ['BKN', 'CHA'], ['CHI', 'CLE'], ['DAL', 'DEN'], ['DET', 'GSW'], ['HOU', 'IND'], ['LAC', 'LAL'], ['MEM', 'MIA']], L8 = [];
    CL8.forEach(([a, h], i) => { const gid = `${SEASON}_${ymd(D1)}_${a}_${h}`; L8.push(legOf(gid, { kind: 'ml', side: h, odds: -900, other: 600, p: 0.92 }));
      if (!i) for (const [st, ln] of [['pts', 30.5], ['reb', 12.5]]) L8.push(legOf(gid, { kind: 'prop', pid: '9620001', team: h, stat: st, line: ln, side: 'under', odds: -900, other: 600, p: imp(-900) })); });
    const R = bruteOwn(p, L8), sf = R.best.safe, pg = R.page.safe, ids = sf ? sf.ids.split(',') : [];
    check(agree(R) && sf && pg && pg.n >= 6 && sf.d >= 2 && ids.filter(k => k.includes('|prop|9620001|')).length <= 1,
      `a night of heavy favourites: Safe takes ${pg ? pg.n : 0} legs to pay $2 (${sf ? sf.d.toFixed(3) : '-'}), one leg a player at that depth, this file's own enumeration's with no leg limit`); }
  /* and on random nights of made-up legs: each game a home moneyline and an away spread (one side a parlay), a total
     and three players' main lines, at prices of -670 to +130, each player leg and total at a chance no higher than its
     price implies (DraftKings' fair chance, the whole margin on the Over) and each side on either side of its price,
     45% to 97%: every level the page's search finds is this file's own enumeration's */
  { let seed = 20261107; const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
    const amOf = d => d >= 2 ? Math.round((d - 1) * 100) : -Math.round(100 / (d - 1)), STF = ['pts', 'reb', 'ast', 'tpm', 'pra', 'pr'], CL = [['WAS', 'OKC'], ['BKN', 'ATL'], ['DEN', 'IND']];
    let bad = 0, n = 0; const miss = [];
    for (let it = 0; it < 36; it++) {
      const legs = [], nG = it % 4 === 3 ? 3 : 2;
      for (let gi = 0; gi < nG; gi++) { const [a, h] = CL[gi], gid = `${SEASON}_${ymd(D1)}_${a}_${h}`;
        const px = () => { const d = 1.15 + rnd() * 1.15, o = amOf(d); return { o, I: imp(o) }; };
        const put = (o, fair) => { const x = px(); const pp = fair ? x.I - rnd() * 0.05 : x.I + (rnd() - 0.5) * 0.16; if (pp >= 0.45 && pp < 0.97) legs.push(legOf(gid, { ...o, odds: x.o, other: -x.o || 100, p: pp })); };
        put({ kind: 'ml', side: h }, false); put({ kind: 'spread', side: a, line: 4.5 }, false); put({ kind: 'total', side: rnd() < 0.5 ? 'over' : 'under', line: 224.5 }, true);
        for (let k = 0; k < 3; k++) put({ kind: 'prop', pid: `96${it}${gi}${k}`, team: rnd() < 0.5 ? a : h, stat: STF[Math.floor(rnd() * STF.length)], line: 10.5 + k, side: rnd() < 0.5 ? 'over' : 'under' }, true); }
      const R = bruteOwn(p, legs); n++; if (!agree(R)) { bad++; if (miss.length < 3) miss.push(`#${it}: ${LVID.filter(id => { const b = R.best[id], g = R.page[id]; return !((!b && !g) || (b && g && b.ids === g.ids)); }).map(id => `${id} page ${R.page[id] ? (R.page[id].p * 100).toFixed(3) : '-'}% this file ${R.best[id] ? (R.best[id].p * 100).toFixed(3) : '-'}%`).join(', ')}`); } }
    check(!bad, `on ${n} random nights of made-up legs every level the page's search finds is this file's own enumeration's${bad ? `: ${bad} differ (${miss.join('; ')})` : ''}`); }
  { const big = [], L = { v: 1, at: READ, games: {} }, teams = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
    /* each game eight players the props model projects, four a club, and DraftKings' main line on five stats of each:
       1,200 player lines over the night, as many as a real night's */
    for (let i = 0; i < 15; i++) { const g = mk(D1, teams[2 * i], teams[2 * i + 1], T(D2, String(i % 4).padStart(2, '0') + ':' + ['00', '30'][i % 2]), [], { pHome: 0.4 + (i % 7) * 0.05, spread: -3 + (i % 5) * 1.5, total: 220 + i }); big.push(g);
      ROWS[g.id] = Object.fromEntries(Array.from({ length: 8 }, (_, j) => { const t = j < 4 ? g.away : g.home, k = (i * 8 + j) % 11;
        return [String(9400000 + i * 10 + j), [`Player ${i}-${j}`, t, ['G', 'F', 'C'][j % 3], 24 + k, 9 + 2.1 * k, 3 + (k % 5) * 1.7, 1.5 + (k % 4) * 1.3, 0.6 + (k % 6) * 0.45, 0.9, 0.5, 0.1, 0.01]]; }));
      L.games[g.id] = lineOf(g); }
    NOW = Date.parse(T(D1, '15:00:00'));
    const stB = stateOf(big), q = load(stB, { lines: L, record: null }); await settle(q); await q.w.eval('pbLinesLoad()');
    const nLines = Object.values(L.games).reduce((t, x) => t + 2 * x.props.mains.length, 0);
    const t0 = Date.now(); q.w.eval(`spSet(${JSON.stringify(N1id)})`); const ms = Date.now() - t0;
    const e = JSON.parse(q.w.eval(`JSON.stringify(spEntry(${JSON.stringify(N1id)}))`)), pool = SC.nightPool(e);
    const okAll = !!pool && e.tiers.every((t, i) => { const b = SC.nightBest(pool, SC.NIGHT_LEVELS[i], null, !!t.legs && t.legs.some(l => l.kind === 'prop')); return t.legs && t.legs.some(l => l.kind === 'prop') && b && b.ids === t.legs.map(SC.legKey).sort().join(','); });
    const nPl = poolOwn(stB, L, NOW, nightOwn(stB, NOW)).filter(l => l.kind === 'prop').length, bytes = JSON.stringify(e.pool).length;
    /* the guard's own reading of the same state and lines.json (every player line again by its own rules, every two legs
       of a game by its own copula, each level ranked over them): the set as the record would take it passes, and how
       long that takes */
    const eT = { ...e, taken_at: new Date(NOW).toISOString().slice(0, 19) + 'Z' }, t1 = Date.now(), gb = SC.nightEntryBad(SC.nightKeyOf(eT), eT, NOW, null, stB, L), msG = Date.now() - t1;
    /* the time is said, and held only far above a runner's noise (the review of 7 November 2026: a 2-second bar, at 80%
       of it here, would hold back the publish on a slower runner); the search's exactness is held above */
    check(ms < 15000 && okAll && !gb.length && nPl > 300 && e.pool.pl && e.pool.pl.lines === nLines - e.pool.pl.none - e.pool.pl.held - e.pool.pl.vig,
      `a night of 15 games with ${nLines} player lines (${nPl} of them in the band) builds its set in ${ms} ms in jsdom, each level the guard's own enumeration's on the pool the record keeps (${e.pool.legs.length} legs, ${bytes} bytes; ${e.tiers.map(t => t.legs ? t.legs.length + ' legs at ' + t.dec + (t.legs.some(l => l.kind === 'prop') ? ' with ' + t.legs.filter(l => l.kind === 'prop').length + ' player' : '') : 'empty').join(', ')}), and on the guard's own reading of the files in ${msG} ms${gb.length ? ': ' + gb.slice(0, 2).join(' | ') : ''}`);
    for (const g of big) delete ROWS[g.id]; }
  /* the heavy-favourite nights the review of 8 November 2026 found slow with no leg limit (8 games at -900, and 7
     November's player lines with every home side -600 to -1000 or three of its games at -400 to -300): each level
     searched within its limit and the exact search's answer, by tools/test_suggest_speed.js on this page (which holds
     those and 7 November's games alone and together in the record's step of the job) */
  { const r = require('child_process').spawnSync(process.execPath, [path.join(__dirname, 'test_suggest_speed.js')], { encoding: 'utf8', env: { ...process.env, SPEED_PAGE: pageFile('index.html'), SPEED_ONLY: 'rootB,rootH,rootM' }, timeout: 180000 });
    const out = ((r.stdout || '') + (r.stderr || '')).trim().split('\n');
    check(r.status === 0, `the heavy-favourite nights are searched in time, every level the exact search's (${out.filter(l => /FAIL/.test(l)).slice(0, 2).join(' | ') || out.pop()})`); }

  /* ---------- 5. Add, Add to builder, Finish ---------- */
  /* the clock back on D1's morning; section 4 moved it, and the page's half-minute look may have drawn another night */
  NOW = Date.parse(T(D1, '15:00:00')); p.w.spWatchTick(); await sleep(40);
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
  /* the parlay card's chance, in the window, its image's lines and Share link's text, says whose it is (the review of 7
     November 2026: "model + DraftKings says 31.0%" under DraftKings' own fair chance read as DraftKings saying it): a
     level of team legs alone "model says", one mixing them with player legs "ranked at N% (model on team legs,
     DraftKings on player legs)" with one line of small print under it, never "DraftKings says" */
  { const PL_SMALL = 'Team legs at the model’s chance, player legs at DraftKings’ fair chance: no model claim on a player leg, and at it a player Under breaks even and an Over gives up about 12%.';
    const said = [];
    for (const t of tiers1) {
      card(t.id).querySelector('[data-pc-finish]').click(); await sleep(30);
      const m = p.w.PARLAY_CARD.current(), ln = m ? p.w.PARLAY_CARD.chanceLines(m).map(l => l.map(x => x[0]).join('')) : [], small = [...p.d.querySelectorAll('#pcView .pc-chance small')].map(txt), share = m ? String(p.w.PARLAY_CARD.linkText(m).text || '') : '';
      const mx = mixOwn(t), want = !m ? null : mx === 'mixed' ? `ranked at ${m.chance} (model on team legs, DraftKings on player legs) · the price says ${m.implied}` : mx === 'player' ? `the price says ${m.implied}` : `model says ${m.chance} · the price says ${m.implied}`;
      said.push({ id: t.id, mx, ok: !!m && ln[1] === want && share.includes(want) && small.includes(PL_SMALL) === (mx === 'mixed') && !/DraftKings says|model \+ DraftKings says/.test(ln.join(' ') + small.join(' ') + share), line: ln[1] });
      p.d.getElementById('pcClose').click(); await sleep(20); }
    check(said.every(x => x.ok) && said.some(x => x.mx === 'mixed'), `the card's chance says whose it is, in the window, the image's lines and Share link's text (${said.map(x => `${x.id} ${x.mx || 'team'}: "${x.line}"`).join('; ')})`); }
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

  /* ---------- 6b. a player listed after the lock: that level alone built again, said so ---------- */
  { const pidA = '9300001', nmA = ROWS[gA.id][pidA][0], rep = { [pidA]: [nmA, 'Day-To-Day', 'ankle'] }, whyA = 'listed day-to-day (ankle), so held out';
    const holdsA = t => !!t && Array.isArray(t.legs) && t.legs.some(l => l.kind === 'prop' && String(l.pid) === pidA);
    NOW = lockN1 + 10 * 60e3;
    const q0 = load(stateOf(SLATE), { lines: LINES1, record: null, tab: 'suggest' }); await settle(q0); await openTab(q0);
    const ownL = LVID.map(id => q0.w.spTier(`${N1id}:${id}`)), keptL = dump(q0.w.localStorage), hit = LVID.filter((id, i) => holdsA(ownL[i]));
    check(hit.length > 0, `the set locked in this browser holds ${nmA} in ${hit.join(', ') || 'no level'}`);
    /* he is listed after the lock: each level holding him built again from the lines at hand, this file's own enumeration
       without him; every other level as it locked; one line under the level; the page's own kept beside its set */
    NOW = lockN1 + 30 * 60e3;
    const stR = stateOf(SLATE, { report: rep }), q1 = load(stR, { lines: LINES1, record: null, tab: 'suggest', storage: keptL }); await settle(q1); await openTab(q1);
    const E1 = enumOwn(q1, N1id), T1 = LVID.map(id => q1.w.spTier(`${N1id}:${id}`)), at1 = NOW;
    const upd = id => q1.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="${id}"] [data-sp-upd]`);
    const k1 = JSON.parse(q1.w.localStorage.getItem('nba_sp_lock_v1') || 'null'), rep1 = k1 && k1.nights[N1id] && k1.nights[N1id].rep;
    check(LVID.every((id, i) => hit.includes(id) ? T1[i] && !holdsA(T1[i]) && E1.best[id] && T1[i].legs.map(l => l.sk).sort().join(',') === E1.best[id].ids
        && upd(id) && upd(id).dataset.spUpd === pidA && txt(upd(id)) === `Updated in this browser: ${nmA} ${whyA} (${etWd(at1)}); this level was built again.` && rep1 && rep1[id] && rep1[id].pid === pidA
      : T1[i] && T1[i].legs.map(l => l.sk).join() === ownL[i].legs.map(l => l.sk).join() && !upd(id) && !(rep1 && rep1[id])),
      `${nmA} listed day-to-day after the lock: ${hit.join(', ')} built again without him, this file's own enumeration's, said in one line ("${upd(hit[0]) ? txt(upd(hit[0])) : ''}"), kept beside the set; the other levels as they locked`);
    /* a reload: the same replacement, as of when it was made, no level built twice */
    NOW = lockN1 + 50 * 60e3;
    const q2 = load(stR, { lines: LINES1, record: null, tab: 'suggest', storage: dump(q1.w.localStorage) }); await settle(q2); await openTab(q2);
    const T2 = LVID.map(id => q2.w.spTier(`${N1id}:${id}`)), u2 = q2.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="${hit[0]}"] [data-sp-upd]`);
    check(LVID.every((id, i) => T2[i] && T2[i].legs.map(l => l.sk).join() === T1[i].legs.map(l => l.sk).join()) && u2 && txt(u2).includes(`(${etWd(at1)})`), `a reload shows the same replacement, as of when it was made (${u2 ? txt(u2) : ''})`);
    /* the record's set takes the browser's place; where the job built the level again for him the record's is shown,
       its line without "in this browser", and the browser keeps nothing */
    const recT = ownL.map(t => q0.w.spTierOut(t)), RR = { how: 'x', since: D0, updated: T(D1, '16:00:00'), featured: {}, night: {} };
    const jobT = recT.map((t, i) => hit.includes(t.id) ? { ...q1.w.spTierOut(T1[i]), updated: { pid: pidA, name: nmA, reason: whyA, at: T(D1, '22:05:00') } } : t);
    RR.night[`${SEASON}|${D1}|${N1.tip}|${N1id}`] = { season: SEASON, date: D1, nid: N1id, games: N1.games.map(g => ({ gid: g.id, away: g.away, home: g.home, tip: g.tip, type: g.type })), tip: N1.tip, last: N1.last,
      lock: new Date(lockN1).toISOString().slice(0, 16) + 'Z', generated: T(D1, '13:00'), pool: {}, tiers: jobT, taken_at: T(D1, '16:00:00'), updates: hit.map(id => ({ level: id, pid: pidA, name: nmA, reason: whyA, at: T(D1, '22:05:00') })) };
    const q3 = load(stR, { lines: LINES1, record: RR, tab: 'suggest', storage: dump(q2.w.localStorage) }); await settle(q3); await openTab(q3);
    const T3 = LVID.map(id => q3.w.spTier(`${N1id}:${id}`)), u3 = q3.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="${hit[0]}"] [data-sp-upd]`);
    check(LVID.every((id, i) => T3[i] && T3[i].legs.map(SC.legKey).join() === jobT[i].legs.map(SC.legKey).join()) && u3 && txt(u3) === `Updated: ${nmA} ${whyA} (${etWd(Date.parse(T(D1, '22:05:00')))}); this level was built again.`
      && !q3.w.localStorage.getItem('nba_sp_lock_v1'), `the record's replacement is shown, its line word for word ("${u3 ? txt(u3) : ''}"), and the browser keeps nothing`);
    /* the record's set, locked with him and not built again by the job: this page builds the level again on its own and
       says so; from the first tip-off nothing is built again, the level as it locked */
    const RL = clone(RR), eL = Object.values(RL.night)[0]; eL.tiers = recT; delete eL.updates;
    const q4 = load(stR, { lines: LINES1, record: RL, tab: 'suggest' }); await settle(q4); await openTab(q4);
    const T4 = LVID.map(id => q4.w.spTier(`${N1id}:${id}`));
    check(hit.every(id => { const i = LVID.indexOf(id); return T4[i] && !holdsA(T4[i]); }) && /^Updated in this browser: /.test(txt(q4.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-sp-upd]`))), 'over the record\'s set, with no replacement of the job\'s, this page builds the level again and says it is its own');
    NOW = Date.parse(N1.tip) + 5 * 60e3;
    const q5 = load(stR, { lines: LINES1, record: RL, tab: 'suggest' }); await settle(q5); await openTab(q5);
    const T5 = LVID.map(id => q5.w.spTier(`${N1id}:${id}`)), c5 = q5.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="${hit[0]}"]`);
    check(c5 && c5.textContent.includes(nmA) && !q5.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-sp-upd]`), `under way, nothing is built again: ${hit[0]} as it locked, ${nmA} in it`);
    /* the review of 7 November 2026, on a record's Safe planted on two games still to tip after the first tip-off (Ace
       Guard's line and LAL at GSW's side): (a) a level this page built again before the first tip-off stands under way,
       never the locked level with him in it; (b) with none built, under way, the level holding a listed player is closed
       (no Add, Add to builder or Finish, no level for Finish) and says why in one line; (c) with lines.json not there at
       the lock, nothing is built again from no lines and nothing kept, the level closed; once the lines load it is built
       again; (d) a kept replacement with no legs is never applied */
    { const lA = JSON.parse(q0.w.eval(`JSON.stringify(spLegOut(spPool(spById(${JSON.stringify(N1id)})).legs.find(l => l.kind === 'prop' && String(l.pid) === ${JSON.stringify(pidA)})))`));
      const lB = JSON.parse(q0.w.eval(`JSON.stringify(spLegOut(spPool(spById(${JSON.stringify(N1id)})).legs.find(l => l.gid === ${JSON.stringify(gB.id)} && l.kind === 'ml')))`));
      const RS = clone(RL), eS = Object.values(RS.night)[0]; eS.tiers[0] = { id: 'safe', label: 'Safe', min: 2, max: 2, price: 0, legs: [lA, lB], p: 0.35, fair: 0.3, fair_est: false, dec: 3.1 };
      const sCard = q => q.d.querySelector(`#spSets [data-sp-game="${N1id}"] [data-pb-tier="safe"]`);
      const shut = q => { const c = sCard(q); return !!c && !c.querySelector('[data-pb-leg], [data-sp-add], [data-pc-finish]') && q.w.spTier(`${N1id}:safe`) === null; };
      const heldSay = `${nmA} ${whyA}: this level is closed.`, holdsS = q => { const t = q.w.eval(`JSON.stringify((spShown(spById(${JSON.stringify(N1id)})).tiers || [])[0])`); return holdsA(JSON.parse(t)); };
      /* (a) */
      NOW = lockN1 + 30 * 60e3;
      const qa = load(stR, { lines: LINES1, record: RS, tab: 'suggest' }); await settle(qa); await openTab(qa);
      const ua = sCard(qa) && sCard(qa).querySelector('[data-sp-upd]'), keptA = dump(qa.w.localStorage);
      NOW = Date.parse(N1.tip) + 5 * 60e3;
      const qb = load(stR, { lines: LINES1, record: RS, tab: 'suggest', storage: keptA }); await settle(qb); await openTab(qb);
      const ub = sCard(qb) && sCard(qb).querySelector('[data-sp-upd]');
      check(ua && !holdsS(qa) && ub && txt(ub) === txt(ua) && /^Updated in this browser: /.test(txt(ub)) && !holdsS(qb),
        `(a) under way, the level this page built again before the first tip-off stands, never the locked one with ${nmA} in it ("${ub ? txt(ub) : 'no Updated line'}")`);
      /* (b) */
      const qc = load(stR, { lines: LINES1, record: RS, tab: 'suggest' }); await settle(qc); await openTab(qc);
      const hc = sCard(qc) && sCard(qc).querySelector('[data-sp-held]');
      check(holdsS(qc) && shut(qc) && hc && hc.dataset.spHeld === pidA && txt(hc) === heldSay && !sCard(qc).querySelector('[data-sp-upd]'),
        `(b) under way with no level built again, the level holding ${nmA} is closed while its games are still to tip ("${hc ? txt(hc) : 'no line'}")`);
      /* (c) */
      NOW = lockN1 + 30 * 60e3;
      const qd = load(stR, { lines: null, record: RS, tab: 'suggest' }); await settle(qd); await openTab(qd); await sleep(40);
      const hd = sCard(qd) && sCard(qd).querySelector('[data-sp-held]'), keptD = dump(qd.w.localStorage);
      check(holdsS(qd) && shut(qd) && hd && txt(hd) === heldSay && !sCard(qd).querySelector('[data-sp-upd], .pb-why') && !keptD.nba_sp_lock_v1,
        `(c) with lines.json not there at the lock, nothing is built again from no lines and nothing kept: the level as it locked, closed ("${hd ? txt(hd) : 'no line'}")`);
      const qe = load(stR, { lines: LINES1, record: RS, tab: 'suggest', storage: keptD }); await settle(qe); await openTab(qe);
      check(!holdsS(qe) && sCard(qe) && /^Updated in this browser: /.test(txt(sCard(qe).querySelector('[data-sp-upd]'))), '(c) once the lines load, the level is built again without him');
      /* (d) */
      const empty = { v: 2, season: SEASON, nights: { [N1id]: { tip: N1.tip, rep: { safe: { pid: pidA, name: nmA, reason: whyA, at: T(D1, '22:10:00'), tier: { id: 'safe', label: 'Safe', min: 2, max: 2, price: 0, why: 'No legs yet: no DraftKings line has been read for the night’s games.' } } } } } };
      const qf = load(stR, { lines: LINES1, record: RS, tab: 'suggest', storage: { nba_sp_lock_v1: JSON.stringify(empty) } }); await settle(qf); await openTab(qf);
      const kf = JSON.parse(qf.w.localStorage.getItem('nba_sp_lock_v1') || 'null'), rf = kf && kf.nights[N1id] && kf.nights[N1id].rep && kf.nights[N1id].rep.safe;
      check(!holdsS(qf) && sCard(qf) && !sCard(qf).querySelector('.pb-why') && rf && Array.isArray(rf.tier.legs) && rf.tier.legs.length === 2,
        `(d) a kept replacement with no legs is never applied: the level is built again on the lines and that kept in its place`); }
    NOW = Date.parse(T(D1, '15:00:00')); }

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
      const title = `${label}: ${s.g} graded, ${s.w} won${s.g ? `; wins expected ${s.fn ? s.f.toFixed(1) + ' by DraftKings’ fair chance' + (s.fn < s.g ? ` (on the ${s.fn} with one)` : '') + ', ' : ''}${s.m.toFixed(1)} by the set’s own chance (the model’s on team legs, DraftKings’ on player legs)` : ''}${s.push ? `; ${s.push} push${s.push === 1 ? '' : 'es'}, the stake back` : ''}; before 7 Nov, one game’s legs: ${o.w}–${o.l}${o.g || o.push ? `, ${un(o.u)} units` : ''}`;
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
    /* the real night's live levels against the record's guard's own reading of the real files (every player line read
       again, every two legs of a game by its own copula, the kept groups of three legs or more), ranked by its own
       enumeration with no leg limit: on a night of a thousand player legs every parlay is far too many to list here, which
       a brute force over them tried until 8 November 2026 and ran the job's runner out of memory on the first night
       DraftKings posted player lines for (14:20 UTC that day) */
    if (N && N.up && realLines && Date.now() < Date.parse(N.tip) - 2 * H) {
      const T3 = LVID.map(id => r.w.spTier(`${N.id}:${id}`)), e = JSON.parse(r.w.eval(`JSON.stringify(spEntry(${JSON.stringify(N.id)}))`)), kept = SC.nightPool(e);
      const F = kept ? SC.nightFull('real', e.pool, kept, REAL, realLines, e.games, NOW, null) : { bad: ['no pool'], pool: null }, t0 = Date.now();
      const B = F.pool ? SC.NIGHT_LEVELS.map(lv => SC.nightBest(F.pool, lv, null, true) || SC.nightBest(F.pool, lv)) : [];
      check(!F.bad.length && F.pool && LVID.every((id, i) => (!T3[i] && !B[i]) || (T3[i] && B[i] && T3[i].legs.map(l => l.sk).sort().join(',') === B[i].ids)),
        `the real night's live levels are the guard's own reading's, with no leg limit and with a player wherever the night's legs make one (${F.pool ? F.pool.legs.length : 0} legs read; ${LVID.map((id, i) => `${id} ${T3[i] ? T3[i].legs.length + ' legs at ' + T3[i].dec.toFixed(3) : '-'}`).join(', ')}; ${Date.now() - t0} ms)${F.bad.length ? ': ' + F.bad.slice(0, 2).join(' | ') : ''}`);
    }
    const lockLines = [...r.d.querySelectorAll('#spSets .sp-lock')];
    check(lockLines.every(x => /^(Locks \w{3} \d{1,2}:\d{2} [AP]M ET, 2 hours before the first tip-off\.|Locked since \w{3} \d{1,2}:\d{2} [AP]M ET\..*|Locked since \w{3} \d{1,2}:\d{2} [AP]M ET\. Under way since .*)$/.test(txt(x))), `each real set's lock line is one of the tab's (${lockLines.length})`); }
};
