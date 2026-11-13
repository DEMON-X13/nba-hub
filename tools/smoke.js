/* Smoke test for the built viewer.
 *
 *   node tools/smoke.js        (needs jsdom: npm install in tools/)
 *
 * Loads index.html in jsdom with fetch stubbed to serve state.json plus one fabricated
 * game for tonight, and checks: the update stamp shows, every tab renders without a script error, the team
 * badges show the model's pick and take none, a game's Parlay Builder button opens the tab on that game alone, a bet
 * is graded as a book settles it, the Data tab is only on the admin page, a preseason game shows with its tag and the
 * not-graded note, and a game that has tipped off (by its tip time, though the published file still calls it
 * scheduled) leaves the Parlay Builder, including a page drawn before the tip. Section 0 renders the real published
 * state as it is and holds it to data/games.csv; section 6 covers a postponed game (void), a game played whose final is
 * not read yet and a graded game off the slate, the backup import and a day-old injury report. Section 7 is Refresh odds on a
 * stubbed ESPN: nothing read on load, on any timer the page sets (each fired at once) or on focus and visibility, a
 * press taking fresh lines into everything priced from them, a started game (by its tip, ESPN's status or ESPN's own
 * tip), a failed day and a game with no line left as they were and the status line saying what stands (published, an
 * earlier press's read, or no line yet), nothing stored, and the page's parse held to fetch.js's on the answers
 * recorded in tools/fixtures/. Section 8 is the player props view (README "Player props"), laid out as the NFL hub's
 * game page: its window, bar, switches (Include backups, Milestones), Find a player, Refresh odds and what it stands on,
 * the head card's numbers, Game bets (its chances the Parlay Builder's for the same legs), the team headers and a row a
 * player (by projected minutes, the Players tab's rank and shield, Show stats from the published box scores, one open at
 * a time), the props read on the same press (by ESPN's ids, only games still to come, two pages, a 404, junk, a refusal,
 * a game that tips during its read) and the job's published lines.json shown before any press, every line, rung and Yes
 * price the view shows worked out here on its own, the model on trial (its lines reaching the Parlay Builder's Top 50
 * lines marked so),
 * nothing read before a press, nothing stored, a reload, the shadow ledger's running numbers (and the early stop's FAIL,
 * said from made-up decisions' own numbers), the view on a FAIL (every player line at DraftKings' fair chance, the props
 * model's small beside it, its tags and note the FAIL's and never "on trial", Game bets and the box's leg as before; on
 * made-up decisions, the real ledger's and the real state with its lines.json), and the page's copies of
 * tools/props_feed.js and tools/props.js held to their text and results. Section 10 is the rating over time (publish.js
 * THE HISTORY): history.json worked out here on its own from players.json and the published ladders (every point, the
 * changes over 7 and 30 days and this season, today's point the table's rating), the 7d columns, the window a name opens
 * (read once and only then, never stored, its numbers, the line's points, the games, Escape, the focus kept inside and
 * given back) and a history that does not load or is junk. Section 12 is the Pick'em Record (publish.js THE PICK'EM
 * RECORD, app/parts/pickem.html): pickem.json read only when the tab opens, then every number the tab states worked out
 * here on its own, on a made-up season (two weeks and the playoffs, a game with no Vegas side, a model that could not
 * run) and on the real file. Section lines is the lines feed (README "The lines feed"): the page's reading of DraftKings'
 * game lines held to tools/lines_feed.js's, which tools/lines.js publishes from, the text and the results on every
 * recorded scoreboard and its variants, and the page's parse keeping each game's national networks as tools/fetch.js
 * does. Section pb is the Parlay Builder (README "Parlay Builder", tools/smoke_parlay.js): the choices, the Top 50 lines
 * and the builder on made-up games a day and more ahead, every number worked out there on its own, then the real files.
 * Section card is the parlay card (README "The parlay card", tools/smoke_card.js): the window, its image, Open in
 * DraftKings with its conversions and Share link, on made-up games and ids, every word and figure worked out there; and
 * section glance the matchup bubble (README "The matchup bubble", tools/smoke_glance.js): every name its leg's button and
 * every number in each bubble on that file's own reading, its keys, placing and redraws; and section gw a game's three
 * windows in the Player props view (README "The game's three windows", tools/smoke_gamewin.js): Matchup, Mismatches and
 * Team Stats, every number worked out there on its own (the team stats from the team boxes), on made-up games and the
 * real state, their keys and focus, and the MISMATCH tags on the player rows.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
/* NBA_HTML tries another page in place of index.html (a deliberately broken copy, to show a check fails on it);
   SMOKE_ONLY=base,7,8,9,10,12,lines,conf,record,xparlays,pb,card,glance,sp,gw runs those sections alone (base is 0 to 6; conf the
   confidence pill on Tonight's cards and the key over them; record the Record tab on a made-up season; xparlays is X
   Parlays, tools/smoke_xparlays.js; pb the Parlay Builder, tools/smoke_parlay.js; card the parlay card,
   tools/smoke_card.js; glance the matchup bubble, tools/smoke_glance.js; sp Suggested Parlays, tools/smoke_suggested.js) */
const pageFile = page => page === 'index.html' && process.env.NBA_HTML ? path.resolve(process.env.NBA_HTML) : path.join(ROOT, page);
const ONLY = (process.env.SMOKE_ONLY || '').split(',').filter(Boolean), run = k => !ONLY.length || ONLY.includes(k);
/* files the page may read beside state.json (data/box_<season>.csv, for a leg older than the state's box window):
   url pattern -> text, set by a test; every other request fails as before */
let FILES = [];
/* JSON files the page may read (history.json): url pattern -> the object, or a function (url, options) -> a response */
let JSONS = [];

const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
/* the page labels days against the viewer's Eastern date, so the fixtures use that date too */
state.today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const side = t => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [{ id: '1', name: 'Some Guard', pos: 'G', min: 34, o: 20, d: 10, adds: 21 }], out: [{ id: '2', name: 'Some Star', status: 'Out', min: 33, costs: 60 }] });
/* a game to come tips three hours from now, whatever the hour the test runs */
const tipIn = ms => new Date(Date.now() + ms).toISOString();
const fake = (id, date, fin) => ({ id, date, tip: fin ? date + 'T23:30:00Z' : tipIn(3 * 3600e3), type: 'REG', away: 'BOS', home: 'NYK', neutral: false, status: fin ? 'final' : 'scheduled', awayScore: fin ? 98 : null, homeScore: fin ? 105 : null,
  line: -2.5, totalLine: 220, ml: { home: -140, away: 120 }, model: { pHome: 0.61, spread: -3.5, total: 224.5, pace: 99, home: side('NYK'), away: side('BOS') }, team: { pHome: 0.55, spread: -1.5 }, published: null });
/* the Parlay Builder's five bet types, this file's own copy (README "Parlay Builder") */
const PB_KINDS_OWN = ['ml', 'ats', 'total', 'over', 'under'];
/* the second game is yesterday's final: always a different day from today, including on the 1st of a month */
const yesterday = (() => { const d = new Date(state.today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
const withGames = (fin) => ({ ...state, slate: [fake('t1', state.today, fin), fake('t0', yesterday, true)] });

/* every request the page makes is recorded; ESPN's scoreboard answers from `espn` (url, options) when a test gives
   one, and fails otherwise. Every timer the page sets is recorded too (and still runs), so provoke() below can fire it */
function load(page, st, mine, espn, tab) {
  const html = fs.readFileSync(pageFile(page), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const errors = [], requests = [], scrolls = [], timers = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
        if (/espn\.com/.test(url)) return espn ? espn(url, opt) : { ok: false, status: 404, json: async () => ({}) };
        const file = FILES.find(f => f[0].test(url)); if (file) return { ok: true, status: 200, text: async () => file[1], json: async () => { throw new SyntaxError('not JSON'); } };
        const js = JSONS.find(f => f[0].test(url)); if (js) return typeof js[1] === 'function' ? js[1](url, opt) : { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(js[1])) };
        return { ok: /state\.json/.test(url), status: 200, json: async () => JSON.parse(JSON.stringify(st)) }; };   // a fresh copy, as a browser parses one
      w.scrollTo = (x, y) => scrolls.push(y); w.URL.createObjectURL = () => 'blob:x';
      if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };            // jsdom has no CSS.escape; the lineups button uses it
      if (mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(mine));
      if (tab) w.localStorage.setItem('nba_hub_2027:tab', tab);
      for (const k of ['setTimeout', 'setInterval', 'requestAnimationFrame']) { const real = w[k]; if (typeof real === 'function') w[k] = function (fn, ms, ...a) { timers.push({ k, fn, ms }); return real.call(w, fn, ms, ...a); }; }
      w.addEventListener('error', e => errors.push(e.message));
    } });
  return { w: dom.window, errors, requests, scrolls, timers };
}
/* what a page does by itself, at once: every timer it has set fires now (a timeout however long, an interval's first
   tick, and any timer those set, three rounds deep), and every event a page might start work on is sent. A read the
   page would make seconds after load, or minutes later on a timer, or when the tab comes back, is made here */
async function provoke(w, timers, errors) {
  for (let round = 0, seen = 0; round < 3 && seen < timers.length; round++) {
    const due = timers.slice(seen); seen = timers.length;
    for (const t of due) if (typeof t.fn === 'function') try { t.fn(); } catch (e) { errors.push(`${t.k}(${t.ms}): ${e.message}`); }
  }
  const d = w.document;
  for (const [at, type] of [[w, 'focus'], [d, 'focus'], [w, 'pageshow'], [w, 'online'], [d, 'visibilitychange'], [w, 'visibilitychange'], [w, 'resize'], [w, 'scroll'], [w, 'hashchange'], [w, 'popstate'], [w, 'load'], [d, 'readystatechange']]) at.dispatchEvent(new w.Event(type));
  await sleep(50);
}

/* ---------- 7. Refresh odds ----------
   The button reads ESPN's scoreboard for the days with a game still to come and takes DraftKings' lines as the job
   does. Here ESPN is a stub: each game's answer is built as ESPN shapes it (DraftKings' odds object), a day can fail,
   answer junk or come late, and the page's parse is held to the job's own (tools/fetch.js) on recorded answers. */
const F = require('./fetch');
const L = require('./lib');
const etDateOf = iso => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(iso));
const ESPN_CODE = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
/* a game to come, its id and date as the job writes them from its tip (Eastern) */
function og(away, home, tipMs, o) {
  const tip = tipIn(tipMs), date = etDateOf(tip), base = fake('', date, false);
  return { ...base, id: `2027_${date.replace(/-/g, '')}_${away}_${home}`, date, tip, away, home, ...o, model: { ...base.model, home: side(home), away: side(away), ...(o && o.model) } };
}
/* ESPN's event for a game: odds {details, total, hml, aml} or none, with its status */
const espnEvent = (g, odds, status = 'STATUS_SCHEDULED', tip = g.tip) => ({ id: '40' + g.id.replace(/\D/g, '').slice(-6), date: tip.slice(0, 16) + 'Z', season: { year: 2027, type: 2 },
  competitions: [{ neutralSite: false, status: { type: { name: status, completed: false } },
    odds: odds ? [{ provider: { id: '100', name: 'Draft Kings' }, details: odds.details, overUnder: odds.total, moneyline: { displayName: 'Moneyline', home: { close: { odds: odds.hml } }, away: { close: { odds: odds.aml } } } }] : [],
    competitors: [{ homeAway: 'home', team: { abbreviation: ESPN_CODE[g.home] || g.home }, score: '0' }, { homeAway: 'away', team: { abbreviation: ESPN_CODE[g.away] || g.away }, score: '0' }] }] });
/* ESPN for the tests: answers[YYYYMMDD] is a payload, 'junk', an HTTP status number or an Error; a day not listed
   answers with no games. `slow` delays every answer. A propBets URL (section 8) is answered from props[eventId]: a
   page, a list of pages, 'junk', an HTTP status number or an Error; an event not listed answers ESPN's 404 "No
   propBets found". `slowProps(eventId)` delays a props answer */
const PROPS_RE = /\/events\/(\d+)\/competitions\/\1\/odds\/100\/propBets\?lang=en&region=us&limit=1000&page=(\d+)/;
const espnStub = (answers, slow = () => 0, props = {}, slowProps = () => 0) => async url => {
  const pm = PROPS_RE.exec(url);
  if (pm) {
    const [, eid, page] = pm, wait = slowProps(eid); if (wait) await sleep(wait);
    let a = props[eid]; if (Array.isArray(a)) a = a[+page - 1];
    if (a instanceof Error) throw a;
    if (typeof a === 'number') return { ok: false, status: a, json: async () => ({}) };
    if (a === 'junk') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } };
    if (!a) return { ok: false, status: 404, json: async () => ({ error: { message: `No propBets found for eventId ${eid} and provider 100`, code: 404 } }) };
    return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(a)) };
  }
  const d = (/dates=(\d{8})/.exec(url) || [])[1]; if (slow()) await sleep(slow());
  const a = answers[d];
  if (a instanceof Error) throw a;
  if (typeof a === 'number') return { ok: false, status: a, json: async () => ({}) };
  if (a === 'junk') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } };
  return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(a || { events: [] })) };
};
const ymd = date => date.replace(/-/g, '');
const espnReqs = r => r.filter(x => /espn\.com/.test(x.url));
const sbReqs = r => r.filter(x => /espn\.com/.test(x.url) && /\/scoreboard\?/.test(x.url));     // the lines' reads (the props' are section 8's)
const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
const stored = w => JSON.stringify([dump(w.localStorage), dump(w.sessionStorage)]);
/* a game's chip on the board, its day chosen on the strip first (a game three hours off can be tomorrow's, Eastern) */
const chipOf = (d, g, label) => { const on = d.querySelector('#days .day.on'); if (!on || on.dataset.d !== g.date) { const b = d.querySelector(`#days .day[data-d="${g.date}"]`); if (b) b.click(); }
  return [...d.querySelectorAll(`.card[data-id="${g.id}"] .chip`)].find(c => c.textContent.trim().startsWith(label)); };
const mktP = (h, a) => { const x = 1 / amToDecT(h), y = 1 / amToDecT(a); return x / (x + y); };
const amToDecT = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
async function refreshOdds() {
  console.log('7. Refresh odds');
  /* r1-r3 take fresh lines; r4 has tipped; r5 has no line at ESPN; r6's day fails; r7's day answers junk; r8 tips
     while the (slow) read is out, though ESPN has it later; r9 is under way at ESPN though its published tip is to come;
     r10 was moved earlier after the job ran: ESPN has it tipping a minute before the press, still scheduled, with
     fresh odds, while its published tip is hours off (its day is ESPN's, as the job would write it) */
  const r1 = og('BOS', 'NYK', 3 * 3600e3, { line: -2.5, totalLine: 220, ml: { home: -140, away: 120 } });
  const r2 = og('LAL', 'GSW', 3 * 3600e3, { line: -5.5, totalLine: 230, ml: { home: -220, away: 180 }, model: { pHome: 0.70, spread: -6, total: 228 } });
  const r3 = og('MIA', 'ORL', 3 * 3600e3, { line: null, totalLine: null, ml: null, model: { pHome: 0.65, spread: -4, total: 226 } });
  const r4 = og('DEN', 'UTA', -3600e3, { line: -1.5, totalLine: 229, ml: { home: -120, away: 100 } });
  const r5 = og('PHI', 'CHA', 3 * 3600e3, { line: 3.5, totalLine: 224, ml: { home: 140, away: -165 }, model: { pHome: 0.42, spread: 2, total: 225 } });
  const r6 = og('MIL', 'IND', 27 * 3600e3, { line: -1.5, totalLine: 231, ml: { home: -125, away: 105 } });
  const r7 = og('SAC', 'SAS', 51 * 3600e3, { line: -4.5, totalLine: 233, ml: { home: -180, away: 150 } });
  const r8 = og('POR', 'HOU', 8000, { line: -7.5, totalLine: 227, ml: { home: -300, away: 240 }, model: { pHome: 0.52, spread: -0.5, total: 227 } });
  const r9 = og('ATL', 'BKN', 3 * 3600e3, { line: -2.5, totalLine: 225, ml: { home: -140, away: 120 } });
  const r10Espn = new Date(Date.now() - 60e3).toISOString();
  const r10 = { ...og('TOR', 'CLE', 3 * 3600e3, { line: -2.5, totalLine: 225, ml: { home: -140, away: 120 } }), date: etDateOf(r10Espn), id: `2027_${ymd(etDateOf(r10Espn))}_TOR_CLE` };
  const games = [r1, r2, r3, r4, r5, r6, r7, r8, r9, r10];
  let r1Fresh = { details: 'NY -6.5', total: 226.5, hml: '-250', aml: '+205' };
  const fresh = g => g === r1 ? r1Fresh : g === r2 ? { details: 'LAL -3.5', total: 231.5, hml: '+150', aml: '-180' } : g === r3 ? { details: 'ORL -4.5', total: 228.5, hml: '-175', aml: '+150' }
    : g === r4 ? { details: 'UTAH -9.5', total: 240.5, hml: '-400', aml: '+300' } : g === r5 ? null : g === r8 ? { details: 'HOU -9.5', total: 221.5, hml: '-450', aml: '+340' } : { details: 'EVEN', total: 200, hml: '-110', aml: '-110' };
  const answers = {};
  for (const g of games) (answers[ymd(g.date)] = answers[ymd(g.date)] || { events: [] }).events.push(g === r8 ? espnEvent(g, fresh(g), 'STATUS_SCHEDULED', new Date(Date.parse(g.tip) + 3600e3).toISOString())
    : g === r9 ? espnEvent(g, { details: 'BKN -8.5', total: 219.5, hml: '-380', aml: '+290' }, 'STATUS_IN_PROGRESS')
    : g === r10 ? espnEvent(g, { details: 'CLE -8.5', total: 219.5, hml: '-380', aml: '+290' }, 'STATUS_SCHEDULED', r10Espn) : espnEvent(g, fresh(g)));
  answers[ymd(r6.date)] = 500; answers[ymd(r7.date)] = 'junk';
  const st7 = { ...state, generated: tipIn(-3600e3), injuriesAsOf: state.today, slate: games.map(g => JSON.parse(JSON.stringify(g))) };
  const comingDays = [...new Set([r1, r2, r3, r5, r6, r7, r8, r9, r10].map(g => ymd(g.date)))].sort();
  let w, errors, requests, scrolls, timers;
  let hold = true;                                            // the first read is held until r8 has tipped, however slow the machine
  ({ w, errors, requests, scrolls, timers } = load('index.html', st7, { picks: {}, build: [], bank: { day: r1.date } }, espnStub(answers, () => hold ? Math.max(0, Date.parse(r8.tip) + 300 - Date.now()) : 0)));
  await sleep(300);
  let d = w.document;
  const btn = d.getElementById('oddsBtn'), bar = d.getElementById('oddsBar'), stl = d.getElementById('oddsSt');
  /* a read is over when the bar is no longer busy (a minute at most) */
  const idle = async (win = w) => { await sleep(30); for (let i = 0; i < 1200 && win.document.getElementById('oddsBar').classList.contains('busy'); i++) await sleep(50); await sleep(50); };
  check(btn && btn.tagName === 'BUTTON' && btn.type === 'button' && !btn.disabled && btn.tabIndex === 0 && /Refresh odds/.test(btn.textContent), 'a Refresh odds button, a plain button the keyboard reaches');
  check(btn && w.getComputedStyle(btn).minHeight === '44px', 'it is 44px tall (min-height)');
  check(bar && !bar.hidden && d.getElementById('tab-slate').compareDocumentPosition(bar) & 2, 'it is shown over the board');
  check(stl && stl.getAttribute('aria-live') === 'polite' && stl.getAttribute('role') === 'status', 'one aria-live status line beside it');
  const pubTime = new Date(st7.generated).toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  check(stl && stl.textContent.includes(`Lines as published ${pubTime}`), `before any press it says when the lines were published ("${stl && stl.textContent}")`);
  for (const tab of ['teams', 'players', 'coaches', 'record', 'parlay', 'slate']) { d.querySelector(`#nav button[data-tab=${tab}]`).click(); await sleep(20);
    if (tab === 'teams') check(bar.hidden, 'the bar is not on the Teams tab');
    if (tab === 'parlay') check(bar.hidden && d.querySelector('#pbPanel [data-espn-refresh]') && d.querySelector('#parlayBody [data-espn-refresh]'), "it is not over the Parlay Builder, which has its own Refresh odds in its controls and its builder"); }
  await sleep(400);
  check(espnReqs(requests).length === 0, `nothing is asked of ESPN on load, nor on opening every tab (${espnReqs(requests).length} requests)`);
  const nTimers = timers.length;
  await provoke(w, timers, errors);
  check(nTimers > 0 && espnReqs(requests).length === 0 && !bar.classList.contains('busy') && /Lines as published/.test(stl.textContent),
    `nor on any timer the page has set (${nTimers} fired at once, its once-a-minute watch among them), nor on focus, pageshow, visibilitychange or online (${espnReqs(requests).length} requests)`);
  check(/NYK -2\.5/.test(chipOf(d, r1, 'Market').textContent) && !/model/.test(chipOf(d, r1, 'Market').textContent) && /over by 4\.5/.test(chipOf(d, r1, 'Over/under').textContent), 'before the press r1 shows its published line (NYK -2.5, the model within a point and a half; over by 4.5)');

  /* the press, from the board, with r1's lineups open, the button focused and the page scrolled */
  chipOf(d, r1, 'Market');
  d.querySelector(`.card[data-id="${r1.id}"] [data-act=drawer]`).click();
  Object.defineProperty(w, 'scrollY', { value: 345, configurable: true });
  btn.focus();
  const before = stored(w);
  const pressedBefore = Date.now() < Date.parse(r8.tip);
  btn.click(); btn.click(); await sleep(50);
  check(/Reading DraftKings' lines from ESPN/.test(stl.textContent) && bar.classList.contains('busy'), 'while reading the status line says so');
  btn.click(); await sleep(20);
  await idle();
  hold = false;
  check(pressedBefore, 'the press landed before r8 tipped (else the machine is too slow for this case)');
  const drawer = d.getElementById('dr-' + r1.id);
  check(drawer && !drawer.hidden && d.activeElement === btn && scrolls[scrolls.length - 1] === 345 && d.querySelector('#days .day.on').dataset.d === r1.date, 'the board is redrawn where it was: on its day, the lineups left open, the focus on the button, the scroll kept');
  const reqs = sbReqs(requests);
  check(reqs.length === comingDays.length, `three presses while the read is out make one read: ${reqs.length} requests for ${comingDays.length} days`);
  check(JSON.stringify(reqs.map(x => (/dates=(\d{8})/.exec(x.url) || [])[1]).sort()) === JSON.stringify(comingDays), "it asks for exactly the days with a game still to come (the tipped game's day only if another game is on it)");
  check(reqs.every(x => /^https:\/\/site\.api\.espn\.com\/apis\/site\/v2\/sports\/basketball\/nba\/scoreboard\?limit=100&dates=\d{8}&_=\d+$/.test(x.url) && x.opt && x.opt.cache === 'no-store' && !x.opt.headers),
    "each is a plain GET of ESPN's scoreboard with a cache-buster, no-store and no headers of its own (no preflight)");
  const tAt = stl.textContent;
  check(/^DraftKings' lines from ESPN, read \d{1,2}:\d{2}/.test(tAt) && /: 3 games, 3 moved\./.test(tAt), `after the read it says when, and how many games took fresh lines ("${tAt}")`);
  check(/\. 1 had no line at ESPN, 2 could not be read and 3 tipped off during the read: they keep their published lines\.$/.test(tAt), 'and how many had no line, could not be read or tipped during the read, which keep their published lines');
  check(stored(w) === before, 'nothing is written to localStorage or sessionStorage');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  const m1 = chipOf(d, r1, 'Market'), o1 = chipOf(d, r1, 'Over/under');
  check(m1 && /NYK -6\.5/.test(m1.textContent) && m1.classList.contains('edge') && /model BOS \+3\.0/.test(m1.textContent) && m1.querySelector('sup.mv'), 'r1 takes the fresh line (ESPN NY -6.5 is NYK -6.5): the edge chip now says the model is 3 points toward BOS, marked moved');
  check(o1 && /226\.5/.test(o1.textContent) && /under by 2\.0/.test(o1.textContent) && !o1.classList.contains('edge'), "and the fresh total (226.5): the model is now 2 under, no longer an edge");
  check(/read \d{1,2}:\d{2}/.test(m1.title) && /published NYK -2\.5/.test(m1.title), 'the chip says when it was read and what was published');
  check(/GSW \+3\.5/.test(chipOf(d, r2, 'Market').textContent) && /model GSW \+9\.5/.test(chipOf(d, r2, 'Market').textContent), "r2's line flips (LAL -3.5 at ESPN: GSW +3.5), and the edge follows it");
  check(/ORL -4\.5/.test(chipOf(d, r3, 'Market').textContent) && /new/.test(chipOf(d, r3, 'Market').querySelector('sup.mv').textContent), "r3, with no published line, takes ESPN's, marked new");
  check(/UTA -1\.5/.test(chipOf(d, r4, 'Market').textContent) && !chipOf(d, r4, 'Market').querySelector('sup.mv'), 'r4, tipped off before the press, keeps its published line');
  check(/CHA \+3\.5/.test(chipOf(d, r5, 'Market').textContent), 'r5, with no line at ESPN, keeps its published one');
  check(/HOU -7\.5/.test(chipOf(d, r8, 'Market').textContent), 'r8, which tipped while the read was out (ESPN still had it to come, later), keeps its published line');
  check(/BKN -2\.5/.test(chipOf(d, r9, 'Market').textContent), 'r9, under way at ESPN before its published tip, keeps its published line');
  check(/CLE -2\.5/.test(chipOf(d, r10, 'Market').textContent) && !chipOf(d, r10, 'Market').querySelector('sup.mv'), "r10, past ESPN's own tip though ESPN still calls it scheduled and its published tip is hours off, keeps its published line (counted as tipped)");

  /* the Parlay Builder's Top 50 lines work from the fresh prices: no lines.json is served here, so the press's read is
     all they stand on */
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const topKey = (g, kind, s) => [g.id, kind, s, ''].join('|');
  const topBtn = key => d.querySelector(`#pbPanel li.pb-trow [data-pb-leg="${key}"]`), topRow = key => { const b = topBtn(key); return b && b.closest('li.pb-trow'); };
  let orl = topRow(topKey(r3, 'ml', 'ORL'));
  const fairOf7 = row => row && +row.querySelector('[data-pb-fair]').dataset.pbFair;
  check(orl && orl.dataset.pbGrp === 'game' && orl.querySelector('.pb-tc b').textContent === '-175' && !orl.querySelector('[data-pb-model], .pb-valmark') && Math.abs(fairOf7(orl) - mktP(-175, 150)) < 1e-12
    && /The model’s chance: 65% \(not what the list is ranked on\)/.test(orl.querySelector('[data-pb-fair]').title),
    "the Top 50 lines list the Magic to win at DraftKings' fresh -175 as a game bet at DraftKings' fair chance (its two prices with the margin out), the model's 65% in its title alone, with no model column or Value mark");
  const rows7 = [...d.querySelectorAll('#pbPanel li.pb-trow [data-pb-leg]')].map(b => b.dataset.pbLeg);
  check(JSON.stringify(rows7) === JSON.stringify([topKey(r3, 'ml', 'ORL'), topKey(r1, 'ml', 'NYK'), topKey(r2, 'ml', 'LAL')]) && !/15 points or more|far off/.test(d.getElementById('pbPanel').textContent),
    `the game bets are the three moneylines the read priced both ways, each the likelier side, the tightest market first (the Magic at -175/+150, the Knicks at -250/+205, the Lakers at -180/+150); the Warriors, 38% fair, are under the band, nothing is left out as far off, and the 76ers, with no line read, are not listed (${rows7.map(k => k.split('|')[2]).join(', ')})`);
  topBtn(topKey(r3, 'ml', 'ORL')).click(); await sleep(30);
  const legs7 = () => JSON.parse(w.localStorage.getItem('nba_hub_2027')).slip.legs;
  check(legs7().length === 1 && legs7()[0].side === 'ORL' && legs7()[0].odds === -175 && legs7()[0].other === 150 && d.activeElement === topBtn(topKey(r3, 'ml', 'ORL')) && topBtn(topKey(r3, 'ml', 'ORL')).textContent === 'Added',
    "its Add puts it in the builder at DraftKings' fresh price, and reads Added");

  /* a second press reads again, here from the Parlay Builder, which is redrawn in place, the builder's leg repriced */
  r1Fresh = { details: 'NY -7', total: 227, hml: '-270', aml: '+220' };
  answers[ymd(r1.date)].events[0] = espnEvent(r1, r1Fresh);
  answers[ymd(r3.date)].events[answers[ymd(r3.date)].events.findIndex(e => e.competitions[0].competitors[0].team.abbreviation === 'ORL')] = espnEvent(r3, { details: 'ORL -4', total: 228.5, hml: '-160', aml: '+135' });
  const days2 = new Set([r1, r2, r3, r5, r6, r7, r9, r10].map(g => ymd(g.date))).size;
  const pbBtn = d.querySelector('#pbPanel [data-espn-refresh]'); pbBtn.focus(); pbBtn.click(); await idle();
  check(sbReqs(requests).length === reqs.length + days2, `a second press after the first read reads again (${days2} days: r8 has tipped since)`);
  orl = topRow(topKey(r3, 'ml', 'ORL'));
  check(orl && orl.querySelector('.pb-tc b').textContent === '-160' && JSON.parse(w.localStorage.getItem('nba_hub_2027')).slip.legs[0].odds === -160 && /MIA at ORL, Magic to win: now -160, was -175\./.test(d.getElementById('slSaid').textContent),
    'the Top 50 lines in view are redrawn with the newer price (-160), and the leg in the builder is repriced, said once');
  check(d.activeElement && d.activeElement.dataset.espnRefresh === 'pb' && /DraftKings' lines from ESPN, read/.test(d.getElementById('espnSt-pb').textContent), "the focus is back on the panel's Refresh odds, its status line saying what the bar's says");
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(30);
  const day6 = d.querySelector(`#days .day[data-d="${r6.date}"]`); day6.click(); await sleep(30);
  btn.click(); await idle();
  check(d.querySelector('#days .day.on') && d.querySelector('#days .day.on').dataset.d === r6.date, 'a press on another day of the strip leaves the board on that day');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* a reload is the published state again */
  ({ w, errors, requests, timers } = load('index.html', st7, null, espnStub(answers)));
  await sleep(300);
  await provoke(w, timers, errors);
  d = w.document;
  check(/NYK -2\.5/.test(chipOf(d, r1, 'Market').textContent) && /Lines as published/.test(d.getElementById('oddsSt').textContent) && !espnReqs(requests).length, 'a reload shows the published lines again, and reads nothing, its timers and events fired');

  /* a read older than the published one, and ESPN failing altogether */
  const two = { ...st7, slate: [r1, r2].map(g => JSON.parse(JSON.stringify(g))), generated: tipIn(3600e3) };
  ({ w, errors } = load('index.html', two, null, espnStub(answers)));
  await sleep(300);
  w.document.getElementById('oddsBtn').click(); await idle(w);
  check(/NYK -2\.5/.test(chipOf(w.document, r1, 'Market').textContent) && /2 were published after this read: they keep their published lines\.$/.test(w.document.getElementById('oddsSt').textContent), 'a state published after the read keeps its lines, and says so');
  const down = { [ymd(r1.date)]: new TypeError('Failed to fetch') };
  ({ w, errors } = load('index.html', { ...two, generated: tipIn(-3600e3) }, null, espnStub(down)));
  await sleep(300);
  w.document.getElementById('oddsBtn').click(); await idle(w);
  check(/NYK -2\.5/.test(chipOf(w.document, r1, 'Market').textContent) && /^ESPN could not be read at \d{1,2}:\d{2}.*: all 2 games keep their published lines\.$/.test(w.document.getElementById('oddsSt').textContent), `a read that fails keeps every published line and says so ("${w.document.getElementById('oddsSt').textContent}")`);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* what stands after a later press is what the visitor sees: an earlier press's read, or no line at all, never a
     "published" line the page no longer shows. q1 is published with lines that the first press moves; q2 has no line
     anywhere, published or at ESPN */
  const q1 = JSON.parse(JSON.stringify(r1)), q2 = og('DAL', 'MEM', 3 * 3600e3, { line: null, totalLine: null, ml: null });
  const qa = { [ymd(q1.date)]: { events: [espnEvent(q1, { details: 'NY -6.5', total: 226.5, hml: '-250', aml: '+205' }), espnEvent(q2, null)] } };
  if (ymd(q2.date) !== ymd(q1.date)) qa[ymd(q2.date)] = { events: [espnEvent(q2, null)] };
  ({ w, errors } = load('index.html', { ...st7, slate: [q1, q2].map(g => JSON.parse(JSON.stringify(g))) }, null, espnStub(qa)));
  await sleep(300);
  const qd = w.document, qs = () => qd.getElementById('oddsSt').textContent;
  qd.getElementById('oddsBtn').click(); await idle(w);
  check(/: 1 game, 1 moved\. 1 has no line yet\.$/.test(qs()) && /NYK -6\.5/.test(chipOf(qd, q1, 'Market').textContent), `a game with no line anywhere is said to have none yet, with no "published" line standing ("${qs()}")`);
  /* the first press is made out to have been an hour ago, so its time cannot be mistaken for the next read's */
  const q1Iso = w.eval("(() => { const g = S.slate.find(x => x.oddsAt); g.oddsAt = new Date(Date.parse(g.oddsAt) - 3600e3).toISOString(); return g.oddsAt; })()");
  const q1At = new Date(q1Iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  for (const k of Object.keys(qa)) qa[k] = new TypeError('Failed to fetch');
  qd.getElementById('oddsBtn').click(); await idle(w);
  check(qs().endsWith(`: 1 keeps its lines read at ${q1At}, 1 has no line yet.`) && /^ESPN could not be read at /.test(qs()) && /NYK -6\.5/.test(chipOf(qd, q1, 'Market').textContent), `a second press that fails says the first press's read stands, not the published line ("${qs()}")`);
  for (const k of Object.keys(qa)) qa[k] = { events: [q1, q2].filter(g => ymd(g.date) === k).map(g => espnEvent(g, null)) };
  qd.getElementById('oddsBtn').click(); await idle(w);
  check(qs().endsWith(`: no game updated. 1 has no line yet. 1 had no line at ESPN: it keeps its lines read at ${q1At}.`) && /NYK -6\.5/.test(chipOf(qd, q1, 'Market').textContent), `and one that answers with no line says the same ("${qs()}")`);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* the page's parse is the job's: on recorded scoreboard answers, as they are and varied through every branch */
  const P = w.NBA_ODDS;
  const FIX = path.join(ROOT, 'tools', 'fixtures');
  const recorded = fs.readdirSync(FIX).filter(f => /^scoreboard_\d{8}\.json$/.test(f)).map(f => [f, JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'))]);
  const same = j => { const run = fn => { try { return JSON.stringify(fn(JSON.parse(JSON.stringify(j)))); } catch (e) { return 'threw ' + e.name; } }; const a = run(F.parseDay), b = run(x => P.parseDay(x)); return { ok: a === b, a, b }; };
  /* the variants start from every recorded event, each with a recorded DraftKings odds object where it had none */
  const dk = recorded.flatMap(([, j]) => j.events).map(e => (e.competitions[0].odds || [])[0]).find(Boolean);
  const base = { events: recorded.flatMap(([, j]) => JSON.parse(JSON.stringify(j.events))).map(e => { const c = e.competitions[0]; if (!(c.odds || []).length) c.odds = [JSON.parse(JSON.stringify(dk))]; return e; }) };
  const vary = (fn) => { const j = JSON.parse(JSON.stringify(base)); j.events.forEach((e, i) => fn(e, e.competitions[0], (e.competitions[0].odds || [])[0], i)); return j; };
  const variants = {
    'the older moneyline form': vary((e, c, o) => { if (o) { delete o.moneyline; o.homeTeamOdds.moneyLine = -150; o.awayTeamOdds.moneyLine = '+130'; } }),
    "a current.moneyLine.american price": vary((e, c, o) => { if (o) { delete o.moneyline; o.homeTeamOdds.current = { moneyLine: { american: '-125' } }; o.awayTeamOdds.current = { moneyLine: { american: '+105' } }; } }),
    'a closing price OFF beside an opening one': vary((e, c, o) => { if (o && o.moneyline) { o.moneyline.home.close.odds = 'OFF'; o.moneyline.away.close = {}; } }),
    'EVEN, PK and junk details': vary((e, c, o, i) => { if (o) o.details = ['EVEN', 'PK', 'XYZ', ''][i % 4]; }),
    'EVEN and small moneylines': vary((e, c, o, i) => { if (o && o.moneyline) { o.moneyline.home.close.odds = ['EVEN', '+99', '-100', '150'][i % 4]; } }),
    'no odds, empty odds, no total': vary((e, c, o, i) => { if (i % 3 === 0) delete c.odds; else if (i % 3 === 1) c.odds = []; else if (o) o.overUnder = null; }),
    'live, final, postponed and canceled': vary((e, c, o, i) => { c.status.type = [{ name: 'STATUS_IN_PROGRESS', completed: false }, { name: 'STATUS_FINAL', completed: true }, { name: 'STATUS_POSTPONED', completed: false }, { name: 'STATUS_CANCELED', completed: false }, { name: 'STATUS_HALFTIME', completed: false }][i % 5]; c.competitors.forEach((t, k) => { t.score = String(100 + k + i); }); }),
    'season types 1, 3 and 5, and none': vary((e, c, o, i) => { if (i % 4 === 3) delete e.season; else e.season.type = [1, 3, 5][i % 4]; }),
    "ESPN's own codes and a non-NBA side": vary((e, c, o, i) => { c.competitors[0].team.abbreviation = ['GS', 'NY', 'SA', 'UTAH', 'WSH', 'NO', 'MAC'][i % 7]; if (o && o.details) o.details = o.details.replace(/^[A-Z]+/, ['GS', 'NY', 'SA'][i % 3]); }),
    'a neutral site and a missing competitor': vary((e, c, o, i) => { c.neutralSite = true; if (i === 1) c.competitors = c.competitors.slice(0, 1); if (i === 2) e.competitions = []; }),
  };
  const cases = recorded.concat([['every recorded event with odds', base]], Object.entries(variants));
  for (const [name, j] of cases) { const r = same(j); check(r.ok && r.a !== '[]', `the page's parse equals tools/fetch.js's on ${name}${r.ok ? '' : `: job ${r.a.slice(0, 160)} page ${r.b.slice(0, 160)}`}`); }
  check(recorded.length >= 3 && recorded.some(([, j]) => F.parseDay(j).some(r => r.status === 'final')) && recorded.some(([, j]) => F.parseDay(j).some(r => r.home_ml && r.type === 'REG')) && recorded.some(([, j]) => F.parseDay(j).some(r => r.home_ml && r.type === 'PRE')),
    'the recorded answers hold finals, regular-season lines and preseason lines');
  const libSrc = fs.readFileSync(path.join(ROOT, 'tools', 'lib.js'), 'utf8');
  const libAb = Function('return ' + /const ESPN_AB = (\{[^}]*\})/.exec(libSrc)[1])();
  check(JSON.stringify([...P.teams].sort()) === JSON.stringify([...L.TEAMS].sort()) && JSON.stringify(P.espnAb) === JSON.stringify(libAb), "its team codes and ESPN's are lib.js's");
  /* what a fresh row does to a published game is the job's merge(), then publish.js's shape */
  const tipF = tipIn(3 * 3600e3), dF = etDateOf(tipF), idF = `2027_${ymd(dF)}_BOS_NYK`;
  const pub = (o) => ({ game_id: idF, season: 2027, date: dF, type: 'REG', away: 'BOS', home: 'NYK', away_score: '', home_score: '', neutral: 0, status: 'scheduled', source: 'espn', espn_id: '1', tip: tipF.slice(0, 16) + 'Z', home_line: '-2.5', total: '220', home_ml: '-140', away_ml: '120', ...o });
  const asPage = r => ({ id: r.game_id, line: r.home_line === '' ? null : +r.home_line, totalLine: r.total === '' ? null : +r.total, ml: r.home_ml || r.away_ml ? { home: r.home_ml === '' ? null : +r.home_ml, away: r.away_ml === '' ? null : +r.away_ml } : null });
  const mergeCases = { 'a full read': { home_line: '-6.5', total: '226.5', home_ml: '-250', away_ml: '205' }, 'a read with no line': { home_line: '', total: '', home_ml: '', away_ml: '' },
    'one moneyline only': { home_line: '-3', total: '221', home_ml: '-160', away_ml: '' }, 'a total only': { home_line: '', total: '219.5', home_ml: '', away_ml: '' }, 'EVEN': { home_line: '0', total: '', home_ml: '100', away_ml: '-120' } };
  const pubCases = { 'published with lines': {}, 'published with none': { home_line: '', total: '', home_ml: '', away_ml: '' } };
  for (const [pn, po] of Object.entries(pubCases)) for (const [mn, mo] of Object.entries(mergeCases)) {
    const old = pub(po), fresh = pub(mo);
    const job = asPage(F.merge([old], dF, [{ ...fresh }], new Date()).find(r => r.game_id === idF));
    const page = { id: idF, ...P.take(asPage(old), { ...fresh }) };
    check(JSON.stringify(job) === JSON.stringify(page), `what the page takes is the job's merge, ${pn}, on ${mn}${JSON.stringify(job) === JSON.stringify(page) ? '' : `: job ${JSON.stringify(job)} page ${JSON.stringify(page)}`}`);
  }
}

/* ---------- 8. Player props ----------
   DraftKings' player props on the Refresh odds press or the job's published lines.json, and the props model on trial
   beside them, in the NFL hub's game page's layout (README "Player props"). ESPN is the stub above: the scoreboard answers each game as scheduled with its published lines (so nothing
   priced from the lines moves), and each game's propBets answer is the recorded opening-night one
   (tools/fixtures/propbets_401909088.json, Tatum and Cunningham) with made-up items added, two pages, a 404, junk, a
   500, a game ESPN has under way and one that tips while its props are being read. Every number the view shows is
   worked out here on its own, from tools/props_feed.js and tools/props.js and the state's props block; the page's
   copies of those two files' functions are held to theirs, text and results. */
const PF = require('./props_feed');
const PJ = require('./props');
const ppItem = (type, pid, line, price) => ({ athlete: { $ref: `http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/athletes/${pid}?lang=en&region=us` },
  type: { id: String(type), name: 'made up' }, odds: { american: { value: price == null ? null : String(price) } }, current: { target: { value: line } } });
const ppPct = p => p == null || !Number.isFinite(p) ? '–' : p < 0.005 ? '<1%' : p > 0.995 ? '>99%' : Math.round(p * 100) + '%';
const ppAm = a => (a > 0 ? '+' : '') + Math.round(a);
/* the source text of a top-level function or const in a file: `function name(` to its closing brace, or `const name =`
   to the end of its statement */
function srcOf(text, name) {
  const lines = text.split('\n');
  const i = lines.findIndex(l => l.startsWith(`function ${name}(`) || l.startsWith(`async function ${name}(`) || l.startsWith(`const ${name} =`));
  if (i < 0) return null;
  let depth = 0, out = [];
  for (let j = i; j < lines.length; j++) {
    out.push(lines[j]);
    for (const c of lines[j].replace(/'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|\/\*.*?\*\/|\/\/.*$/g, '')) { if ('{(['.includes(c)) depth++; else if ('})]'.includes(c)) depth--; }
    if (depth <= 0 && /[;}]\s*$/.test(lines[j])) break;
  }
  return out.join('\n');
}
async function playerProps() {
  console.log('8. Player props');
  const FIX = path.join(ROOT, 'tools', 'fixtures');
  const rec = JSON.parse(fs.readFileSync(path.join(FIX, 'propbets_401909088.json'), 'utf8'));
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  check(real.props && real.props.games && real.props.layout && real.props.dist && real.props.dist.var && real.props.fair && real.props.ledger, "the published state carries the props model's block (games, layout, distribution, fair-chance rules, ledger)");
  /* the tests' own props block: the published distribution and ledger where there are, made-up projections for the two
     games (so the section holds on any morning's state, whichever games it projects), the fair-chance rules props.js
     writes. Its ledger has no verdict whatever the published one says (the trial was stopped early as a FAIL on 5
     November 2026, which takes every prop off the Top 50): the section holds the model on trial, and the ledger's own
     cases below set each verdict themselves */
  const RP = real.props || {};
  const VAR0 = { pts: [7.2, 0.73], reb: [1.76, 0.88], ast: [1.3, 0.99], tpm: [1.23, 1.0], stl: [1.1, 0.98], blk: [1.25, 1.12], pra: [9.66, 0.67], pr: [8.17, 0.72], pa: [6.43, 0.78], ar: [2.7, 0.76], sb: [1.2, 0.97] };
  const LEDGER0 = { registered: '2026-10-15T11:35Z', bar: { lines: 30000 }, decision: null, summary: { standing: '', gradedGames: 0, lines: 0, voids: 0, scores: null, flat: null, toCome: 0 } };
  const bosDet = { players: {
    '4065648': ['Jayson Tatum', 'BOS', 'F', 30.4, 21.04, 8.66, 5.07, 2.76, 1.1, 0.42, 0.3838, 0.0384], '4432166': ['Cade Cunningham', 'DET', 'G', 31.5, 20.8, 4.48, 7.47, 2.08, 0.98, 0.58, 0.2551, 0.023],
    '3001': ['Bos Guard', 'BOS', 'G', 31.0, 12.8, 3.7, 4.0, 2.4, 1.0, 1.2, 0.03, 0], '3002': ['Bos Center', 'BOS', 'C', 23.0, 9.9, 8.1, 1.5, 0.1, 0.7, 1.4, 0.2, 0], '3003': ['Bos Bench', 'BOS', 'G', 12.1, 4.4, 1.6, 2.6, 1.1, 0.7, 0.2, 0.004, 0],
    '3004': ['Det Center', 'DET', 'C', 26.2, 13.8, 8.4, 2.0, 0, 0.6, 0.8, 0.3, 0.001], '3005': ['Det Wing', 'DET', 'F', 25.4, 11.4, 2.5, 2.1, 2.8, 0.6, 0.2, 0.01, 0], '3006': ['Det Bench', 'DET', 'G', 9.2, 4.0, 2.7, 0.8, 0.1, 0.2, 0.2, 0.004, 0] } };
  /* the games: p1 Celtics at Pistons (the recorded answer, plus a line on an absentee, id 2, Some Star on the Pistons'
     report); p2 two pages, its ESPN id only from the scoreboard, with a player no file knows; p3 nothing posted (404);
     p4 junk; p5 tipped an hour ago; p6 under way at ESPN; p7 a 500; p8 tips while its props read is out; p10 still
     scheduled at ESPN with ESPN's own tip a minute before the press, its published tip later (a game ESPN moved earlier) */
  const p1 = og('BOS', 'DET', 3 * 3600e3, { espn: '401909088' });
  const p2 = og('LAL', 'GSW', 3 * 3600e3, { espn: '' });         // p1's tip, so on p1's day in the plan at any hour (at five hours it fell on the next Eastern day from 7 to 9pm)
  const p3 = og('MIA', 'ORL', 3 * 3600e3, { espn: '401900003' });
  const p4 = og('PHI', 'CHA', 3 * 3600e3, { espn: '401900004' });
  const p5 = og('DEN', 'UTA', -3600e3, { espn: '401900005' });
  const p6 = og('ATL', 'BKN', 3 * 3600e3, { espn: '401900006' });
  const p7 = og('TOR', 'CLE', 3 * 3600e3, { espn: '401900007' });
  const p8 = og('POR', 'HOU', 3600e3, { espn: '401900008' });          // its tip is moved to just after the press, below
  /* p10's day and id are ESPN's tip's, Eastern, as the job would write them (section 7's r10), so ESPN's event and the
     published game are on one day at any hour: on the published tip's day, half an hour on, they fell on two days from
     23:30 to just after midnight Eastern and the page never matched them. ESPN's tip goes on its event at the press */
  const p10Espn = new Date(Date.now() - 60e3).toISOString();
  const p10 = { ...og('SAC', 'PHX', 30 * 60e3, { espn: '401900010' }), date: etDateOf(p10Espn), id: `2027_${ymd(etDateOf(p10Espn))}_SAC_PHX` };
  const games = [p1, p2, p3, p4, p5, p6, p7, p8, p10];
  const eid = { [p1.id]: '401909088', [p2.id]: '401900002', [p3.id]: '401900003', [p4.id]: '401900004', [p5.id]: '401900005', [p6.id]: '401900006', [p7.id]: '401900007', [p8.id]: '401900008', [p10.id]: '401900010' };
  const lal = { '9000001': ['Lal Guard', 'LAL', 'G', 34.2, 25.3, 5.1, 6.2, 2.8, 1.1, 0.4, 0.21, 0.02], '9000002': ['Gsw Center', 'GSW', 'C', 30.0, 15.5, 11.8, 2.1, 0.2, 0.7, 1.9, 0.55, 0.01], '9000003': ['Gsw Wing', 'GSW', 'F', 22.0, 9.0, 4.0, 1.5, 1.4, 0.6, 0.3, 0.02, 0] };
  const props8 = { onTrial: true, build: RP.build || '2026-10-15T09:09Z', asOf: RP.asOf || '2026-06-13', fitSeasons: RP.fitSeasons || '2023-2026', horizonGameDays: 5, minShown: 8,
    stats: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'], combos: { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] },
    layout: ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'], dist: { kind: 'negative binomial', var: RP.dist && RP.dist.var ? RP.dist.var : VAR0 },
    fair: PJ.FAIR, ledger: RP.ledger ? { ...RP.ledger, decision: null } : LEDGER0, research: RP.research || null };
  props8.games = { [p1.id]: { tip: p1.tip, away: 'BOS', home: 'DET', players: JSON.parse(JSON.stringify(bosDet.players)) }, [p2.id]: { tip: p2.tip, away: 'LAL', home: 'GSW', players: lal } };
  /* the rated players: the published ones, and two of the tests' own, Bos Guard ranked and Bos Center not, so the view's
     rank and shield are held on both whatever the morning's file; the box scores: Bos Guard's two games this past week
     alone, for Show stats */
  const agoD = n => { const x = new Date(state.today + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
  const planted8 = [{ id: '3001', name: 'Bos Guard', pos: 'G', team: 'BOS', o: 5, d: 2, min: 31, games: 200, prior: 'raptor', rating: 1580, ranked: true, d7: 0 },
    { id: '3002', name: 'Bos Center', pos: 'C', team: 'BOS', o: 1, d: 9, min: 23, games: 9, prior: 'raptor', rating: 1620, d7: 0 }];
  const BOX8 = { from: agoD(6), days: 7, line: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'], games: { [`${state.season}_${ymd(agoD(1))}_BOS_NYK`]: { '3001': [20, 5, 4, 2, 1, 0], '9000001': [1, 1, 1, 1, 1, 1] }, [`${state.season}_${ymd(agoD(3))}_MIA_BOS`]: { '3001': [10, 3, 6, 1, 0, 1] } } };
  const st8 = { ...state, generated: tipIn(-3600e3), injuriesAsOf: state.today, props: props8, slate: games.map(g => JSON.parse(JSON.stringify(g))),
    players: (state.players || []).filter(p => !['3001', '3002'].includes(p.id)).concat(planted8), boxes: BOX8 };
  /* the scoreboard: every game scheduled with the lines it was published with, p6 under way; its ids are ESPN's */
  const sameOdds = g => ({ details: `${ESPN_CODE[g.home] || g.home} ${g.line}`, total: g.totalLine, hml: String(g.ml.home), aml: (g.ml.away > 0 ? '+' : '') + g.ml.away });
  const sb = {};
  for (const g of games) { const e = espnEvent(g, sameOdds(g), g === p6 ? 'STATUS_IN_PROGRESS' : 'STATUS_SCHEDULED'); e.id = eid[g.id]; (sb[ymd(g.date)] = sb[ymd(g.date)] || { events: [] }).events.push(e); }
  /* the props answers */
  const p1Items = rec.items.concat([ppItem(1, '2', 18.5, -120), ppItem(1, '2', 18.5, '-110')]);
  const p2Items = [ppItem(1, '9000001', 24.5, -115), ppItem(1, '9000001', 24.5, -105), ppItem(3, '9000001', 5.5, 120), ppItem(3, '9000001', 5.5, -150),
    ppItem(218, '9000001', 25, '+105'), ppItem(218, '9000001', 30, '+260'), ppItem(218, '9000001', 20, '-250'), ppItem(92, '9000001', null, '+400'),
    ppItem(3, '9000002', 11.5, -110), ppItem(3, '9000002', 11.5, -110), ppItem(220, '9000002', 12, '+110'), ppItem(220, '9000002', 15, '+300'), ppItem(220, '9000002', 10, '-200'),
    ppItem(90, '9000002', 29.5, -105), ppItem(90, '9000002', 29.5, -125), ppItem(92, '9000002', null, '-180'), ppItem(93, '9000002', null, '+2500'),
    ppItem(1, '99999999', 7.5, '+100'), ppItem(1, '99999999', 7.5, -130)];
  const page = (items, i, n) => ({ count: items.length, pageIndex: i, pageSize: Math.ceil(items.length / n), pageCount: n, items });
  const half = 9;                                              // splits 9000002's rebounds pair across the two pages
  let propsAns = { '401909088': page(p1Items, 1, 1), '401900002': [page(p2Items.slice(0, half), 1, 2), page(p2Items.slice(half), 2, 2)], '401900004': 'junk', '401900007': 503,
    '401900006': page(rec.items, 1, 1), '401900008': page(rec.items, 1, 1), '401900005': page(rec.items, 1, 1), '401900010': page(rec.items, 1, 1) };
  const slowProps = e => e === '401900008' ? Math.max(0, Date.parse(p8.tip) + 400 - Date.now()) : 0;
  let { w, errors, requests, timers } = load('index.html', st8, { picks: {}, build: [], bank: { day: p1.date } }, espnStub(sb, () => 0, propsAns, slowProps));
  await sleep(300);
  let d = w.document;
  const idle = async (win = w) => { await sleep(30); for (let i = 0; i < 1200 && win.document.getElementById('oddsBar').classList.contains('busy'); i++) await sleep(50); await sleep(50); };
  const propsReqs = r => r.filter(x => PROPS_RE.test(x.url));
  const sheet = () => d.getElementById('ppBack'), body = () => d.getElementById('ppBody');
  const toDay = g => { const b = d.querySelector(`#days .day[data-d="${g.date}"]`); if (b && !b.classList.contains('on')) b.click(); };
  const cardBtn = g => { d.querySelector('#nav button[data-tab=slate]').click(); toDay(g); return d.querySelector(`.card[data-id="${g.id}"] [data-props]`); };
  const banned = t => /\bedge\b|model says|\bvalue\b/i.test(t);
  const L8 = props8.layout, at8 = (r, k) => r[L8.indexOf(k)];
  const muOf = (r, k) => k in props8.combos ? Math.round(props8.combos[k].reduce((t, s) => t + at8(r, s), 0) * 100) / 100 : at8(r, k);   // a combo: its parts' sum, to two decimals, as the ledger's call holds it
  const num1 = v => Number.isFinite(v) ? v.toFixed(1) : '–';
  /* this file's own copies of the view's rules (README "Player props"): the NFL hub's confTier on the whole percent the
     row prints (a chance printed 45% is Med, 44% Low, 70% High, 69% Med), the stat blocks' order */
  const confOwn = p => { const r = Math.round(p * 100); return r >= 70 ? 'high' : r >= 45 ? 'med' : 'low'; };
  const ORDER_OWN = ['pts', 'reb', 'ast', 'tpm', 'pra', 'pr', 'pa', 'ar', 'stl', 'blk', 'sb'];
  const NAMES_OWN = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', tpm: 'Threes', stl: 'Steals', blk: 'Blocks', pra: 'Pts + reb + ast', pr: 'Pts + reb', pa: 'Pts + ast', ar: 'Ast + reb', sb: 'Stl + blk', dd: 'Double-double', td: 'Triple-double' };
  const openRow = pid => { const b = body().querySelector(`[data-pp-open="${pid}"]`); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); return b; };
  const blockRows = (pid, stat) => [...body().querySelectorAll(`[data-pp-body="${pid}"] [data-pp-stat="${stat}"] tr[data-pp-leg]`)];
  /* one row as drawn, and what it must be: the bet, the model's chance (its bar, percentage and band), DraftKings' fair
     chance ("book N%", est. where it is) and DraftKings' price */
  const rowSays = tr => { const pc = tr.querySelector('.pct'), cf = tr.querySelector('.pp-conf'), fl = tr.querySelector('.pp-fill'), bx = tr.querySelector('input[type=checkbox]');
    return { thr: tr.querySelector('.thr').textContent.trim(), p: pc.dataset.ppP === undefined ? null : +pc.dataset.ppP, pct: pc.textContent.trim(), conf: cf ? cf.className.replace('pp-conf ', '') : null,
      bar: fl ? fl.style.width : null, fair: (tr.querySelector('.fair') || { textContent: '(no book cell)' }).textContent.trim(), price: tr.querySelector('.price').textContent.trim(), box: !!bx && bx.closest('label.pp-pick') !== null }; };
  const rowWant = (thr, p, fair, est, price) => ({ thr, p, pct: p == null ? '–' : ppPct(p), conf: p == null ? null : confOwn(p), bar: p == null ? null : Math.max(2, p * 100).toFixed(0) + '%',
    fair: fair == null ? '' : `book ${ppPct(fair)}${est ? 'est.' : ''}`, price: ppAm(price), box: true });
  const rowDiff = (tr, want) => { const got = rowSays(tr); return JSON.stringify(got) === JSON.stringify(want) ? null : `${JSON.stringify(got)} want ${JSON.stringify(want)}`; };
  /* every rule of the page's styles inside @media(max-width:<px>px) blocks, joined (jsdom lays nothing out, so a layout
     rule is held by its text here and its effect in a real browser) */
  const mediaRules = (css, px) => { let out = '', i = 0; const tag = `@media(max-width:${px}px){`;
    while ((i = css.indexOf(tag, i)) >= 0) { let dpt = 0, j = i + tag.length - 1; for (; j < css.length; j++) { if (css[j] === '{') dpt++; else if (css[j] === '}' && --dpt === 0) break; } out += css.slice(i + tag.length, j) + '\n'; i = j; }
    return out; };
  const ruleOf = (css, sel) => { const m = new RegExp('(?:^|[}\\s])' + sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}').exec(css); return m ? m[1] : null; };

  /* before any press, with no lines.json served: the projections, laid out as the NFL hub's game page, and nothing read */
  check(!sheet() || sheet().hidden, 'the props sheet is closed on load');
  for (const g of [p1, p2, p3, p4, p6, p7, p8, p10]) { const b = cardBtn(g); check(b && b.tagName === 'BUTTON' && /^Player props$/.test(b.textContent.trim()) && b.getAttribute('aria-haspopup') === 'dialog', `${g.away} at ${g.home}'s card has a Player props button, a real button, before any press`); }
  check(!cardBtn(p5), 'a game that has tipped off has none');
  check(w.getComputedStyle(cardBtn(p1)).minHeight === '44px', 'it is 44px tall');
  const storedNoTab = win => { const o = JSON.parse(stored(win)); delete o[0]['nba_hub_2027:tab']; return JSON.stringify(o); };
  const before = storedNoTab(w);
  let opener = cardBtn(p1); opener.focus(); opener.click(); await sleep(60);
  const sh = d.getElementById('ppSheet'), css8 = [...d.querySelectorAll('style')].map(x => x.textContent).join('\n');
  check(!sheet().hidden && sh.getAttribute('role') === 'dialog' && sh.getAttribute('aria-modal') === 'true' && sh.getAttribute('aria-labelledby') === 'ppTitle' && d.getElementById('ppTitle').textContent === 'Player props: BOS at DET',
    `a tap opens a dialog over the page (role dialog, aria-modal, titled "${d.getElementById('ppTitle').textContent}")`);
  /* the band on the chance as shown (the review of 5 November 2026: 0.4488 printed "45%" and banded Low, so a milestone
     sat "45% est. LOW" under its main line's "45% MED" at the same price): the page's own ppConf beside its ppPct, at
     each boundary and either side of it */
  { const B = JSON.parse(w.eval('JSON.stringify([0.4488, 0.4451, 0.445, 0.4449, 0.44, 0.6951, 0.695, 0.6949, 0.69, 0.70, 0.004, 0.996].map(p => [p, ppPct(p), ppConf(p)[0], ppConf(p)[1]]))'));
    const want = { '45%': 'med', '44%': 'low', '70%': 'high', '69%': 'med', '<1%': 'low', '>99%': 'high' };
    check(B.every(([p, t, c, l]) => want[t] === c && confOwn(p) === c && l === c[0].toUpperCase() + c.slice(1)) && B.map(x => x[1]).join() === '45%,45%,45%,44%,44%,70%,70%,69%,69%,70%,<1%,>99%',
      `the band is worked on the chance as printed: ${B.map(([p, t, c]) => `${p} "${t}" ${c}`).join(', ')}`); }
  check(/#ppSheet\{max-width:1100px;/.test(css8), "it is the NFL hub's game window, 1100px wide at most (its .modal-panel), the whole screen on a phone");
  const close = d.getElementById('ppClose');
  check(d.activeElement === close && close.textContent.trim() === '✕ Close' && w.getComputedStyle(close).minHeight === '44px' && /Close/.test(close.getAttribute('aria-label')) && close.closest('.pp-bar') && close.closest('.pp-bar').firstElementChild === close,
    "the focus moves to its 44px ✕ Close, at the bar's left as the NFL's");
  const swB = d.getElementById('ppBackups'), swR = d.getElementById('ppRungs');
  check(swB && swR && swB.type === 'checkbox' && swR.type === 'checkbox' && !swB.checked && !swR.checked && /Include backups/.test(swB.closest('label').textContent) && /^\s*Milestones$/.test(swR.closest('label').textContent)
    && w.getComputedStyle(swB.closest('label')).minHeight === '44px' && w.getComputedStyle(swR.closest('label')).minHeight === '44px' && !/Book's cut/.test(sh.textContent),
    "at its right, the NFL's quiet switches: Include backups and Milestones (the NFL's Threshold ladders), both off, each in a 44px label; no Book's cut");
  const find = d.getElementById('ppFind');
  check(find && find.type === 'search' && find.placeholder === 'Find a player' && /Find a player/.test(find.getAttribute('aria-label')) && w.getComputedStyle(find).minHeight === '44px', 'then a 44px Find a player box');
  const rf = d.getElementById('ppRefresh'), rst = d.getElementById('ppOddsSt');
  check(rf && rf.matches('[data-pp-refresh]') && rf.textContent.trim() === 'Refresh odds' && !rf.querySelector('svg') && rf.getAttribute('aria-describedby') === 'ppOddsSt' && rst && rst.getAttribute('role') === 'status' && rst.getAttribute('aria-live') === 'polite' && w.getComputedStyle(rf).minHeight === '44px'
    && rst.textContent === 'Published lines did not load · Refresh odds reads them from ESPN',
    `then Refresh odds, plain as the NFL's (no icon), with its status line beside it, short as the NFL's, saying what the view stands on: here no lines.json answers ("${rst && rst.textContent}")`);
  check(!body().contains(find) && !body().contains(rf) && !body().contains(rst) && rf.compareDocumentPosition(body()) & w.Node.DOCUMENT_POSITION_FOLLOWING && find.compareDocumentPosition(rf) & w.Node.DOCUMENT_POSITION_FOLLOWING,
    "the search and Refresh odds with its status are the sheet's own, drawn once above the redrawn body, so its status is a live region that stays and is heard");
  { w.eval('propsDraw()'); check(d.getElementById('ppOddsSt') === rst && d.getElementById('ppFind') === find && d.getElementById('ppRefresh') === rf, 'a redraw keeps the very same status line, search and button (a region made anew is not announced)'); }
  /* the look the NFL's game page has, rule by rule (its props/build/part1.html under nflbets/build/theme.css) */
  { const m760 = mediaRules(css8, 760), m900 = mediaRules(css8, 900), m620 = mediaRules(css8, 620), m340 = mediaRules(css8, 340), m400 = mediaRules(css8, 400);
    const thr = ruleOf(css8, '.pp-rungs .thr') || '', fair = ruleOf(css8, '.pp-rungs .fair') || '', pct = ruleOf(css8, '.pp-rungs .pct') || '', arrow = ruleOf(css8, '.pp-plr .arrow') || '';
    check(/#ppBack,#ppSheet\{color-scheme:dark\}/.test(css8), "its native controls (the boxes, the search's clear button) are drawn dark, as the NFL's theme.css has them (color-scheme:dark)");
    check(/white-space:nowrap/.test(thr) && /\.pp-rungs \.thr\{[^}]*white-space:normal/.test(m760) && /white-space:nowrap/.test(fair),
      'Over 23.5 and its book chance keep their line on a wide screen (914 among them), as the NFL\'s; on a phone the bet may wrap, as the NFL\'s does');
    check(!/\.pp-rungs \.fair\{[^}]*white-space:normal/.test(m760) && /\.pp-rungs \.fair em\{display:block/.test(m760) && /\.pp-stat h4\{flex-wrap:nowrap\}/.test(m760) && /\.pp-stat h4 em\.mline\{margin-left:8px\}/.test(m760) && !/td\.pick\{[^}]*width|\.pp-pick\{[^}]*min-width/.test(m760),
      '"book 29%" keeps its line on a phone (its est. on a small line under it), and "DraftKings line" follows "projected" in the heading, as the NFL\'s (its h4 does not wrap); the box cell keeps its 44px on a phone, the tap rule over the NFL\'s narrower 34px column');
    check(/font-size:15px/.test(pct) && /\.pp-rungs td\{font-size:13px\}/.test(m900) && /\.pp-rungs \.pct\{[^}]*font-size:14px/.test(m760), "the NFL's type in the rows: the percentage 15px (14px on a phone) and the cells 13px from 900px down");
    check(arrow && !/line-height/.test(arrow), "the chevron's line box is the NFL's (inherited, not 1), so a closed row is its 52px");
    check(/#ppSheet\{[^}]*scroll-padding-bottom:96px/.test(css8) && /#ppSheet\{scroll-padding-top:76px\}/.test(m620), 'a control the focus moves to is kept clear of the sticky foot bar (and on a phone of the sticky top bar)');
    check(/\.pp-search input\{[^}]*font-size:16px/.test(css8) && w.getComputedStyle(find).fontSize === '16px', 'Find a player is 16px, so a phone does not zoom in on it');
    check(/#ppSheet \.pp-top\{position:sticky;top:0;z-index:3;[^}]*background:var\(--panel-2\)/.test(m620), "on a phone (the whole screen, no backdrop to tap) the bar with ✕ Close stays at the top as the sheet scrolls");
    check(/white-space:nowrap/.test(ruleOf(css8, '.pp-gh .tot b,.pp-gh .totpts b,.pp-gh .none') || '') && /font-size:16px/.test(m400) && /\.pp-rungs \.fair\{white-space:normal\}/.test(m340),
      'the expected score keeps its line (16px under 400px), and at 320 the rows give back room so nothing runs past the card'); }
  /* the head card, every number worked out here */
  { const hd = body().querySelector('[data-pp-head]'), m = p1.model, P = bosDet.players;
    const lead = k => Object.entries(P).reduce((b, [pid, r]) => !b || at8(r, k) > at8(b[1], k) ? [pid, r] : b, null);
    const leadOk = ['pts', 'reb', 'ast'].every(k => { const el = hd.querySelector(`[data-pp-lead="${k}"]`), [pid, r] = lead(k), nm = r[0].split(' ');
      return el && el.dataset.ppPid === pid && el.querySelector('.nm').textContent === `${nm[0][0]}. ${nm.slice(1).join(' ')}` && el.querySelector('.v').textContent === `${num1(at8(r, k))}${k}`; });
    const labs = [...hd.querySelectorAll('.pp-ghl')].map(x => x.firstChild.textContent.trim());
    const fav = p1.line < 0 ? p1.home : p1.away;
    check(hd && hd.classList.contains('pp-card') && JSON.stringify(labs) === JSON.stringify(['Tip-off', 'Matchup', 'Biggest projections', 'Expected score', 'Total pt', 'Vegas pick']),
      `the head card, the NFL's with its stripe: ${labs.join(', ')} (Tip-off in the NFL's Kickoff place)`);
    check(hd.querySelector('.when b').textContent === `${new Date(p1.date + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' })}, ${new Date(p1.date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' })}`
      && hd.querySelector('.when').textContent.endsWith(new Date(p1.tip).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET')
      && [...hd.querySelectorAll('.pp-mt .pill')].map(x => x.textContent).join(' at ') === 'BOS at DET', `its tip-off (the day, the date and the tip in ET) and the matchup ("${hd.querySelector('.when').textContent}")`);
    check(leadOk, "its biggest projections are the props model's top projected player in the game for points, rebounds and assists, short name and value");
    check(/Model on trial/.test(hd.querySelector('.lead-c .pp-ghl').textContent) && hd.querySelector('.pp-trialtag'), 'and it keeps the Model on trial tag');
    check(hd.querySelector('[data-pp-score] b').textContent === `${Math.round((m.total + m.spread) / 2)} – ${Math.round((m.total - m.spread) / 2)}` && hd.querySelector('[data-pp-score] small').textContent === 'BOS / DET'
      && hd.querySelector('[data-pp-totpts] b').textContent === String(Math.round(m.total)) && hd.querySelector('[data-pp-totpts] small').textContent === 'points' && hd.querySelector('[data-pp-vegas] .pill').textContent === fav && hd.querySelector('[data-pp-vegas] small').textContent === `by ${Math.abs(p1.line)}`,
      `the expected score is the board model's, its total split by its spread (${hd.querySelector('[data-pp-score] b').textContent}), its total (${hd.querySelector('[data-pp-totpts] b').textContent}, "points" under it, the NFL's word), and Vegas's pick the line's favourite by its number`);
    check(hd.querySelector('[data-pp-vegas] [data-pp-vegas-src="board"]') && hd.querySelector('[data-pp-vegas] [data-pp-vegas-src="board"]').textContent === "the board's line",
      "with no DraftKings line read, Vegas's pick is the board's line and says so, so it never reads as the DraftKings line Game bets lacks"); }
  let bt = body().textContent;
  check(/Model on trial/.test(bt) && /on trial: not yet shown to beat DraftKings, its chances are marked on trial wherever they show/.test(bt) && /The Parlay Builder's Top 50 lines take a player's line where this model's chance clears their bar, marked on trial there and in the builder/.test(bt)
    && body().querySelector('[data-pp-head] + .gwin + details[data-pp-trial]') && !body().querySelector('details[data-pp-trial]').open,
    "the model is labelled on trial, its note (folded, after the head card and the game's three buttons) saying it is not yet shown to beat DraftKings, its chances marked so wherever they show, the Top 50 lines taking its lines as the owner asked");
  { const tn = body().querySelector('[data-pp-trial]').textContent;
    check(/Double- and triple-doubles take out the same margin, never measured on those markets/.test(tn) && /so their DraftKings figure is a high estimate/.test(tn) && /Milestone \(k\+\) fair chances are estimates \(est\.\)/.test(tn),
      "and the note says the milestones' fair chances are estimates, and that the double- and triple-doubles' margin was never measured on those markets, so their figure is a high estimate"); }
  { const sm = body().querySelector('details[data-pp-trial] summary'); sm.focus(); w.eval('propsDraw()');
    const sm2 = body().querySelector('details[data-pp-trial] summary');
    check(sm2 && d.activeElement === sm2 && sm2.getAttribute('data-pp-key') === 'trial', `a redraw with the note's summary focused keeps the focus on it (${d.activeElement.tagName}), never dropping it to the page, where Escape no longer reaches the sheet`);
    close.focus(); }
  check(body().querySelector('[data-pp-gbets] h3').textContent === 'Game bets' && body().querySelector('[data-pp-gbets] [data-pp-noline]').textContent === `No DraftKings prices yet: the board's line is ${p1.line < 0 ? p1.home : p1.away} ${(-Math.abs(p1.line)).toFixed(1).replace('.0', '')}.` && !body().querySelector('[data-pp-gbets] input'),
    `Game bets, with no DraftKings line read and the board's line there, says it has no prices and what the board has ("${(body().querySelector('[data-pp-gbets] [data-pp-noline]') || {}).textContent}"), and offers nothing`);
  /* the teams: away first, each its header and a row a projected player, by projected minutes */
  const secs = [...body().querySelectorAll('section.pp-team')];
  check(secs.length === 2 && secs[0].dataset.ppTeam === 'BOS' && secs[1].dataset.ppTeam === 'DET' && secs.every(s => s.querySelector('h3.pp-teamhdr .pill') && s.querySelector('.pp-teamhdr .pp-pill').textContent === `playing ${s.dataset.ppTeam === 'BOS' ? 'DET' : 'BOS'}`),
    "each team in turn, away then home, under the NFL's team header (its pill, name and \"playing\" the other)");
  const rowsNow = () => [...body().querySelectorAll('[data-pp-player]')];
  check(rowsNow().length === Object.keys(bosDet.players).length && rowsNow().every(r => bosDet.players[r.dataset.ppPlayer]), `a row for every projected player (${rowsNow().length} of ${Object.keys(bosDet.players).length}), nobody else`);
  check(!body().querySelector('[data-pp-bench]'), 'with Include backups off, no backup is shown');
  { const ord = secs.map(s => [...s.querySelectorAll('[data-pp-player]')].map(r => bosDet.players[r.dataset.ppPlayer]));
    check(ord.every((l, i) => l.every(r => r[1] === ['BOS', 'DET'][i]) && l.every((r, j) => !j || l[j - 1][3] >= r[3])), 'each team\'s rows are its players, by projected minutes'); }
  const sumBad = rowsNow().filter(r => { const P = bosDet.players[r.dataset.ppPlayer], s = r.querySelector('.sum').textContent.replace(/\s+/g, ' ').trim();
    return s !== `${num1(muOf(P, 'pts'))} pts · ${num1(muOf(P, 'reb'))} reb · ${num1(muOf(P, 'ast'))} ast` || r.querySelector('.who .nm').textContent !== P[0] || r.querySelector('.who .pos').textContent !== `${P[2]} · ${P[3].toFixed(0)} min`; });
  check(!sumBad.length, `each row is the NFL's: his name and his position line (with his projected minutes, "G · 31 min", in the NFL's depth label's place), and at the right his projected points, rebounds and assists (${sumBad.map(r => r.dataset.ppPlayer).join(', ')})`);
  const btn0 = rowsNow()[0].querySelector('.pp-plrbtn');
  check(rowsNow().every(r => { const b = r.querySelector(':scope > button.pp-plrbtn'); return b && b.type === 'button' && b.getAttribute('aria-expanded') === 'false' && !b.hasAttribute('aria-controls') && b.getAttribute('aria-label').startsWith(bosDet.players[r.dataset.ppPlayer][0]); })
    && !body().querySelector('.pp-plrbody') && /\.pp-plrbtn\{position:absolute;inset:0;/.test(css8) && r0Css(css8),
    "each row is a full-width button (it covers the row) with aria-expanded, closed (naming no body it controls until one is drawn), named for the player and his projection");
  function r0Css(c) { return /@media\(max-width:760px\)\{[^@]*?\.pp-plr\{grid-template-columns:minmax\(0,1fr\) 26px;grid-template-rows:auto auto;/.test(c) && /\.pp-plr \.sum\{grid-column:1;grid-row:2;text-align:left\}/.test(c) && /\.pp-rungs \.barcell\{display:none\}/.test(c); }
  check(r0Css(css8), "on a phone (760px and under) a row stacks as the NFL's: the name line, the projection under it, the chevron at the right; the rows drop their bar (jsdom lays nothing out: the rules are held here, the fit in a real browser)");
  btn0.focus(); btn0.click(); await sleep(20);
  { const r0 = rowsNow()[0], pid = r0.dataset.ppPlayer, P = bosDet.players[pid], b = r0.querySelector('.pp-plrbtn'), pb = body().querySelector(`[data-pp-body="${pid}"]`);
    const heads = [...pb.querySelectorAll('[data-pp-stat]')].map(x => x.dataset.ppStat);
    const muBad = ORDER_OWN.filter(k => { const h = pb.querySelector(`[data-pp-stat="${k}"] h4`); return !h || h.firstChild.textContent.trim() !== NAMES_OWN[k] || +h.querySelector('[data-pp-mu]').dataset.ppMu !== muOf(P, k) || h.querySelector('[data-pp-mu]').textContent !== `projected ${num1(muOf(P, k))}`; });
    const ynBad = ['dd', 'td'].filter(k => { const h = pb.querySelector(`[data-pp-stat="${k}"] h4`); return !h || (h.querySelector('[data-pp-mu]') || {}).textContent !== `projected ${ppPct(at8(P, k))}`; });
    check(b.getAttribute('aria-expanded') === 'true' && b.getAttribute('aria-controls') === `ppPb-${pid}` && r0.classList.contains('open') && pb && pb.id === `ppPb-${pid}` && d.activeElement === d.querySelector(`[data-pp-open="${pid}"]`),
      'a tap opens the row: aria-expanded, its body under it (the one it controls), the focus kept on it');
    check(JSON.stringify(heads) === JSON.stringify(ORDER_OWN.concat(['dd', 'td'])) && !muBad.length && !ynBad.length,
      `his body is a stat block a stat he is projected on, in the sheet's order, each headed "Points  projected 14.3", then his double- and triple-double ("projected 23%")${muBad.concat(ynBad).length ? ': ' + muBad.concat(ynBad).join(', ') : ''}`);
    check([...pb.querySelectorAll('[data-pp-stat]')].every(x => x.querySelector('[data-pp-noline]') && x.querySelector('[data-pp-noline]').textContent === 'No DraftKings line yet.' && !x.querySelector('tr')),
      'with no line read, each block says "No DraftKings line yet." and offers nothing');
    { const tl = pb.querySelectorAll('[data-pp-trialln]'), mk = pb.querySelectorAll('.pb-trial');
      check(tl.length === 1 && pb.firstElementChild === tl[0] && mk.length === 1 && tl[0].contains(mk[0]) && mk[0].matches('i.pb-trial[data-pp-trialmark]') && mk[0].textContent === 'on trial' && mk[0].title === w.eval('pbTrialTitle()') && ![...pb.querySelectorAll('h4')].some(h => h.querySelector('.pb-trial')),
        "his double- and triple-double chances are the props model's, drawn with no line, so his body opens on the one quiet on-trial line that covers every chance in it, titled as the Parlay Builder's; no heading carries a mark of its own (the NFL's headings)"); }
    const other = rowsNow()[1]; other.querySelector('.pp-plrbtn').click(); await sleep(20);
    check(!body().querySelector(`[data-pp-body="${pid}"]`) && body().querySelectorAll('.pp-plrbody').length === 1 && rowsNow()[0].querySelector('.pp-plrbtn').getAttribute('aria-expanded') === 'false', "one player open at a time, as the NFL's: opening another closes him");
    rowsNow()[1].querySelector('.pp-plrbtn').click(); await sleep(20);
    check(!body().querySelector('.pp-plrbody'), 'and a second tap closes it'); }
  check(!banned(body().textContent), 'the view says neither "edge", "model says" nor "value"');
  /* the rank and shield: the Players tab's own, read off that tab */
  { const ranks = rowsNow().map(r => [r.dataset.ppPlayer, r.querySelector('[data-pp-rank]'), (r.querySelector('.pp-badge svg') || { getAttribute: () => null }).getAttribute('class')]);
    const names = new Map(rowsNow().map(r => [r.dataset.ppPlayer, r.querySelector('.pp-plrbtn').getAttribute('aria-label')]));
    d.getElementById('ppClose').click(); await sleep(20);
    d.querySelector('#nav button[data-tab=players]').click(); await sleep(30);
    const all = d.getElementById('pall'); all.checked = true; all.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(30);
    const tab = new Map([...d.querySelectorAll('#playersT tbody tr')].map(tr => { const b = tr.querySelector('[data-hx^="p:"]'); return [b.dataset.hx.slice(2), { rk: tr.querySelector('.rk').textContent, sh: tr.querySelector('.tierbadge').getAttribute('class') }]; }));
    const rated = new Map(st8.players.map(p => [p.id, p]));
    const bad = ranks.filter(([pid, el, cls]) => { const p = rated.get(pid), t = tab.get(pid); if (!p || !p.ranked) return !!el; return !el || !t || el.dataset.ppRank !== t.rk || [...el.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent).join('') !== '#' + t.rk || cls !== t.sh; });
    check(!bad.length && ranks.some(([pid, el]) => el && pid === '3001') && ranks.some(([pid, el]) => !el && pid === '3002'),
      `each player's rank and shield are the Players tab's (its # column and its shield, read off the tab), none for one the ladder does not rank (3002) or the tab does not have${bad.length ? ': ' + bad.map(x => x[0]).join(', ') : ''}`);
    const nameBad = [...names].filter(([pid, nm]) => { const P = bosDet.players[pid], p = rated.get(pid), t = tab.get(pid);
      return nm !== `${P[0]}, ${P[2]}${p && p.ranked && t ? `, #${t.rk} by overall Elo` : ''}: projected ${P[3].toFixed(0)} minutes, ${num1(muOf(P, 'pts'))} points, ${num1(muOf(P, 'reb'))} rebounds, ${num1(muOf(P, 'ast'))} assists`; });
    check(!nameBad.length, `each row's button is named in full, the only way a screen reader has his numbers: name, position, rank, projected minutes, points, rebounds and assists${nameBad.length ? ': ' + nameBad.map(x => x[1]).slice(0, 2).join(' / ') : ''}`);
    d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20);
    opener = cardBtn(p1); opener.click(); await sleep(30); }
  /* Show stats: only for a player with games in the published box scores, his week as they have it */
  { const withSt = rowsNow().filter(r => r.querySelector('[data-pp-stats]')).map(r => r.dataset.ppPlayer);
    check(JSON.stringify(withSt) === JSON.stringify(['3001']), `Show stats is offered only where the page has his recent games (the published box scores): ${withSt.join(', ') || 'none'}`);
    const sb1 = body().querySelector('[data-pp-stats="3001"]');
    check(sb1.tagName === 'BUTTON' && sb1.textContent === 'Show stats' && w.getComputedStyle(sb1).minHeight === '44px' && !sb1.closest('.pp-plrbtn') && sb1.closest('[data-pp-player="3001"]'),
      "it is the NFL's chip after his name, a button of its own beside the row's (never inside it), 44px tall by its padding");
    check(sb1.getAttribute('aria-label') === "Show stats: Bos Guard's games this past week" && !sb1.hasAttribute('aria-pressed') && !sb1.hasAttribute('aria-expanded') && !sb1.hasAttribute('aria-controls')
      && ![...body().querySelectorAll('[aria-controls]')].some(b => !d.getElementById(b.getAttribute('aria-controls'))),
      `it is named by its own words and whose ("${sb1.getAttribute('aria-label')}"), which say its state (no aria-pressed beside them), and nothing in the view names a table or body that is not drawn`);
    sb1.focus(); sb1.click(); await sleep(20);
    const tb = body().querySelector('[data-pp-recent="3001"]'), trs = tb ? [...tb.querySelectorAll('tbody tr')].map(tr => [...tr.children].map(c => c.textContent)) : [];
    const games = Object.entries(BOX8.games).filter(([, gm]) => gm['3001']).map(([gid, gm]) => ({ gid, ...(([, dd, a, h]) => ({ date: `${dd.slice(0, 4)}-${dd.slice(4, 6)}-${dd.slice(6, 8)}`, a, h }))(gid.split('_')), line: gm['3001'] })).sort((x, y) => x.date < y.date ? -1 : 1);
    const want = games.map(gm => [new Date(gm.date + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' }), gm.a === 'BOS' ? `@ ${gm.h}` : `vs ${gm.a}`, ...gm.line.map(String)]);
    const avg = [0, 1, 2, 3, 4, 5].map(i => (games.reduce((t, gm) => t + gm.line[i], 0) / games.length).toFixed(1));
    check(tb && JSON.stringify(trs) === JSON.stringify(want) && JSON.stringify([...tb.querySelectorAll('tfoot td')].map(c => c.textContent)) === JSON.stringify([`Per game (${games.length})`, ...avg])
      && d.activeElement === body().querySelector('[data-pp-stats="3001"]') && body().querySelector('[data-pp-stats="3001"]').textContent === 'Hide stats'
      && body().querySelector('[data-pp-stats="3001"]').getAttribute('aria-label') === "Hide stats: Bos Guard's games this past week" && body().querySelector('[data-pp-stats="3001"]').getAttribute('aria-controls') === 'ppSt-3001' && tb.id === 'ppSt-3001',
      `a tap shows his games as the box scores have them, a line a game and the average a game (${trs.map(x => x.join(' ')).join(' / ')}), the chip now Hide stats (named so) and naming the table it shows, the focus kept on it`);
    check([...tb.querySelectorAll('tbody tr')].every(tr => { const c = tr.children[1], pl = c.querySelector('.pill'); return pl && /^(vs|@) [A-Z]{3}$/.test(c.textContent) && c.textContent.endsWith(pl.textContent) && /--tc:/.test(pl.getAttribute('style')); })
      && /text-transform:uppercase/.test(ruleOf(css8, '.pp-wkstats th') || ''),
      "the table is the NFL's: uppercase headers, each opponent the hub's team pill (the NFL's team tag)");
    body().querySelector('[data-pp-stats="3001"]').click(); await sleep(20);
    check(!body().querySelector('[data-pp-recent]'), 'and a second tap hides them'); }
  /* who the report has out, Include backups and the search */
  check(body().querySelectorAll('[data-pp-outs]').length === 2 && [...body().querySelectorAll('[data-pp-outs]')].every(p => p.textContent === 'Not projected, on the injury report: Some Star (Out).'), "who the injury report has out is said under each club, not projected (the NFL's \"Not shown\")");
  swB.focus(); swB.click(); await sleep(20);
  { const bench = [...body().querySelectorAll('[data-pp-bench]')].map(r => r.dataset.ppPlayer).sort();
    const shownIds = new Set(Object.keys(bosDet.players).concat(['2']));
    const want = [...new Set(['1'].concat(st8.players.filter(p => (p.team === 'BOS' || p.team === 'DET') && !shownIds.has(p.id)).map(p => p.id)))].sort();
    check(swB.checked && JSON.stringify(bench) === JSON.stringify(want) && [...body().querySelectorAll('[data-pp-bench]')].every(r => !r.querySelector('.pp-plrbtn') && !r.querySelector('input') && /No projection: /.test(r.querySelector('.sum').textContent)),
      `Include backups adds the rest of each club's expected rotation and its rated players (${bench.length}), each in his place with nothing to bet, not a button: no projection and why`);
    const bk = [...body().querySelectorAll('[data-pp-bench]')];
    check(bk.every(r => /(^| · )backup$/.test(r.querySelector('.pos').textContent) && /backup: no projection/.test(r.querySelector('.sr').textContent)) && rowsNow().filter(r => !r.matches('[data-pp-bench]')).every(r => !/backup/.test(r.querySelector('.pos').textContent)),
      `each one Include backups adds is marked so, "G · backup", as the NFL marks a backup ("${bk[0] && bk[0].querySelector('.pos').textContent}"), and no projected player is`);
    check(d.activeElement === swB, 'the focus stays on the switch'); }
  swB.click(); await sleep(20);
  check(!body().querySelector('[data-pp-bench]'), 'and off again takes them away');
  { const f0 = d.getElementById('ppFind'); f0.focus(); f0.value = 'cUN'; f0.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(20); }
  { const vis = rowsNow().filter(r => !r.closest('[hidden]')).map(r => r.dataset.ppPlayer), secs2 = [...body().querySelectorAll('section.pp-team')];
    check(JSON.stringify(vis) === '["4432166"]' && secs2.find(s => s.dataset.ppTeam === 'BOS').hidden && !secs2.find(s => s.dataset.ppTeam === 'DET').hidden && body().querySelector('section[data-pp-team="DET"] [data-pp-outs]').hidden && d.activeElement === d.getElementById('ppFind'),
      `Find a player shows the rows whose name holds what is typed, whatever its case (${vis.join(', ')}), a club's heading only while it has one, the focus kept in the box`); }
  { const nm = d.getElementById('ppNoMatch');
    check(nm && nm.getAttribute('role') === 'status' && !nm.textContent && !body().contains(nm), 'a search that matches says nothing more');
    const f0 = d.getElementById('ppFind'); f0.value = 'zzzz'; f0.dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(20);
    check(rowsNow().every(r => r.closest('[hidden]')) && d.getElementById('ppNoMatch') === nm && nm.textContent === 'No player in this game matches "zzzz".' && !nm.closest('[hidden]'),
      `a search no player matches says so ("${nm.textContent}") in a status line of its own that stays on the page, so it is heard, where the rows would be`); }
  d.getElementById('ppFind').value = ''; d.getElementById('ppFind').dispatchEvent(new w.Event('input', { bubbles: true })); await sleep(20);
  check(rowsNow().every(r => !r.closest('[hidden]')) && !d.getElementById('ppNoMatch').textContent, 'emptied, every row is back and the line goes');
  /* the Tab trap: the window's first and last controls, the boxes and the search among them */
  { const f = [...sh.querySelectorAll('button, summary, a[href], input')].filter(el => !el.disabled && !el.closest('[hidden]') && !(el.tagName !== 'SUMMARY' && el.closest('details:not([open])')));
    const tab = (shift) => { const ev = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: shift, bubbles: true, cancelable: true }); d.activeElement.dispatchEvent(ev); return ev.defaultPrevented; };
    f[f.length - 1].focus(); const p1t = tab(false), wentFirst = d.activeElement === f[0];
    f[0].focus(); const p2t = tab(true), wentLast = d.activeElement === f[f.length - 1];
    check(f[0] === close && f.includes(swB) && f.includes(swR) && f.includes(d.getElementById('ppFind')) && p1t && wentFirst && p2t && wentLast, `Tab stays inside: from the last control (${f[f.length - 1].id || f[f.length - 1].textContent.trim().slice(0, 20)}) to ✕ Close, and back`); }
  sheet().dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20);
  check(sheet().hidden && d.activeElement === opener, 'Escape closes it and the focus goes back to the button that opened it');
  w.eval(`S.slate.find(g => g.id === ${JSON.stringify(p3.id)}).line = null`);
  cardBtn(p3).click(); await sleep(20);
  { const vg = body().querySelector('[data-pp-vegas]');
    check(body().querySelector('[data-pp-gbets] [data-pp-noline]').textContent === 'No DraftKings line yet.' && vg.querySelector('.none') && vg.querySelector('.none').textContent === '–' && !vg.querySelector('.pill') && !vg.querySelector('[data-pp-vegas-src]'),
      'a game with neither a DraftKings line nor a board line: Game bets says "No DraftKings line yet." as the NFL\'s, and Vegas\'s pick is "–"'); }
  swB.click(); await sleep(20);
  { const pos = [...body().querySelectorAll('[data-pp-player] .pos')].map(x => x.textContent);
    check(swB.checked && pos.length > 0 && !pos.some(t => /backup/.test(t)), `a game the props model has not projected: Include backups shows its lineups and rated players, and marks none a backup, the starters among them (${pos.length})`); }
  swB.click(); await sleep(20);
  w.eval(`S.slate.find(g => g.id === ${JSON.stringify(p3.id)}).line = ${JSON.stringify(p3.line)}`);
  /* a press that begins on the sheet and is let go on the backdrop (a selection dragged past its edge, which the browser
     ends in a click on the backdrop) is no click outside: the view stays open */
  d.getElementById('ppTitle').dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true })); sheet().click(); await sleep(20);
  check(!sheet().hidden, 'a press on the sheet let go on the backdrop does not close the view');
  sheet().dispatchEvent(new w.MouseEvent('pointerdown', { bubbles: true })); sheet().click(); await sleep(20);
  check(sheet().hidden, 'a click outside the sheet closes it');
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
  check(d.getElementById('pbPanel') && !d.querySelector('#pbPanel .pb-trial') && !/Tatum|Cunningham|Lal Guard/.test(d.getElementById('pbPanel').textContent), "before a press (no lines.json is served here) the Parlay Builder's Top 50 lines have no player line");
  cardBtn(p2).click(); await sleep(20);
  check(!sheet().hidden && d.getElementById('ppTitle').textContent === 'Player props: LAL at GSW' && rowsNow().length === 3 && !d.getElementById('ppFind').value, "another game's button opens that game's own view, with its projections and an empty search");
  d.getElementById('ppClose').click(); await sleep(20);
  const nT = timers.length;
  await provoke(w, timers, errors);
  check(espnReqs(requests).length === 0, `nothing is read before a press: not on load, opening a sheet, its rows, switches or search, closing it, nor on any timer or event (${nT} timers fired; ${espnReqs(requests).length} requests)`);
  check(requests.filter(x => /lines\.json/.test(x.url)).length === 1 && requests.filter(x => /lines\.json/.test(x.url)).every(x => x.opt && x.opt.cache === 'no-store'), "the published lines (lines.json) are asked for once a load, no-store, however many views open");
  check(storedNoTab(w) === before, 'and nothing is stored (the tab in view, which the page has always remembered, aside)');

  /* the press, from the board */
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20);
  /* p8 now tips 2.5 seconds after the press (ESPN still has it an hour later, as a game moved earlier after the job ran), and its props answer
     is held until it has */
  p8.tip = new Date(Date.now() + 2500).toISOString();
  w.eval(`S.slate.find(g => g.id === ${JSON.stringify(p8.id)}).tip = ${JSON.stringify(p8.tip)}`);
  sb[ymd(p8.date)].events.find(e => e.id === eid[p8.id]).date = new Date(Date.parse(p8.tip) + 3600e3).toISOString().slice(0, 16) + 'Z';
  /* p10: ESPN still calls it scheduled, its own tip a minute before the load (so before the press); the published tip is still to come */
  sb[ymd(p10.date)].events.find(e => e.id === eid[p10.id]).date = p10Espn.slice(0, 16) + 'Z';
  const pressedAt = Date.now();
  d.getElementById('oddsBtn').click(); await idle();
  check(Date.now() > Date.parse(p8.tip) && pressedAt < Date.parse(p8.tip) - 1500, 'the press landed well before p8 tipped and ended after it (else the machine is too slow for this case)');
  check(etDateOf(p10Espn) === p10.date && Date.parse(p10Espn) <= pressedAt && Date.parse(p10.tip) > Date.now(), `p10's ESPN tip (${p10Espn}) is on its day, ${p10.date}, before the press, and its published tip still to come after it (else this case tests nothing)`);
  const pr = propsReqs(requests), sbr = sbReqs(requests);
  const asked = pr.map(x => PROPS_RE.exec(x.url)[1] + ':' + PROPS_RE.exec(x.url)[2]).sort();
  const want = ['401909088:1', '401900002:1', '401900002:2', '401900003:1', '401900004:1', '401900007:1', '401900008:1'].sort();
  check(JSON.stringify(asked) === JSON.stringify(want), `one press asks for the props of exactly the games still to come, by ESPN's ids, the second page where there is one: not the game tipped before the press, the one ESPN has under way, nor the one whose tip ESPN has passed while still calling it scheduled (${asked.join(', ')})`);
  check(pr.every(x => x.url === PF.PROP_URL(PROPS_RE.exec(x.url)[1], +PROPS_RE.exec(x.url)[2]) + x.url.slice(x.url.indexOf('&_=')) && /&_=\d+$/.test(x.url) && x.opt && x.opt.cache === 'no-store' && !x.opt.headers),
    "each is a plain GET of tools/props_feed.js's address with a cache-buster, no-store and no headers of its own");
  check(requests.findIndex(x => PROPS_RE.test(x.url)) > requests.findIndex(x => /\/scoreboard\?/.test(x.url)) && sbr.length >= 1, 'after the scoreboard, whose answer gives p2 its ESPN id');
  const ps = d.getElementById('propsSt'), pst = ps.textContent;
  const nMain1 = PF.propParse(p1Items).mains.length, nMain2 = PF.propParse(PF.propItems([page(p2Items.slice(0, half), 1, 2), page(p2Items.slice(half), 2, 2)])).mains.length;
  check(!ps.hidden && ps.getAttribute('aria-live') === 'polite' && new RegExp(`^DraftKings' player props, read \\d{1,2}:\\d{2}[^:]*: 2 games, ${nMain1 + nMain2} main lines, under Player props on each game\\. 1 has none posted yet, 2 could not be read and 3 tipped off\\.$`).test(pst),
    `the props status line says when, how many games and main lines, and what was not posted, not read or tipped ("${pst}")`);
  check(/^DraftKings' lines from ESPN, read \d{1,2}:\d{2}[^:]*: \d+ games?, none moved\./.test(d.getElementById('oddsSt').textContent), `the lines' own status line is as before ("${d.getElementById('oddsSt').textContent}")`);
  check(storedNoTab(w) === before, 'nothing is written to localStorage or sessionStorage by the press');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  check(cardBtn(p1) && cardBtn(p1).textContent.trim() === `Player props · ${nMain1} lines` && cardBtn(p1).classList.contains('has'), `p1's card button counts its main lines (${cardBtn(p1) && cardBtn(p1).textContent.trim()})`);
  check(cardBtn(p3) && cardBtn(p3).textContent.trim() === 'Player props', 'a game with none posted shows no count');
  check(!cardBtn(p8) && !w.NBA_PROPS.live()[p8.id] && !w.NBA_PROPS.live()[p6.id] && !w.NBA_PROPS.live()[p5.id] && !w.NBA_PROPS.live()[p10.id], 'the game that tipped while its props were read has no button and nothing taken; nor have the three ESPN or the clock had started (p10 by ESPN\'s own tip alone)');

  /* the view after the press: every line, every rung and every Yes price worked out here, one player opened at a time */
  cardBtn(p1).click(); await sleep(30);
  const e1at = w.NBA_PROPS.live()[p1.id].at, et = iso => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  const parsed1 = PF.propParse(p1Items), rows1 = props8.games[p1.id].players;
  check(d.getElementById('ppOddsSt').textContent === `DraftKings via ESPN, ${et(e1at)} · ${parsed1.mains.length} main lines · this visit only`
    && d.getElementById('ppOddsSt').title === `DraftKings: ${parsed1.mains.length} main lines, ${parsed1.ladders.length} milestone prices and ${parsed1.yes.length} double- and triple-double prices. Read by Refresh odds for this visit only: a reload shows the published lines again.`,
    `the status line beside Refresh odds, short as the NFL's, says the view stands on the press, when, how many main lines, and that it is this visit's alone; every kind's count in its title ("${d.getElementById('ppOddsSt').textContent}")`);
  const fair8 = props8.fair, lined = [...new Set(parsed1.mains.concat(parsed1.ladders, parsed1.yes).map(m => m.player))];
  check(lined.every(pid => body().querySelector(`[data-pp-player="${pid}"]`)) && rowsNow().length === new Set(lined.concat(Object.keys(rows1))).size, `every player DraftKings lines has a row, beside every projected player (${rowsNow().length})`);
  let lineBad = [], nLines = 0, rungBad = [], nRungs = 0, mono = true, yesBad = [], trialBad = [];
  swR.click(); await sleep(20);
  for (const pid of lined) {
    openRow(pid); await sleep(5);
    const r = rows1[pid];
    for (const m of parsed1.mains.filter(x => x.player === pid)) {
      const trs = blockRows(pid, m.stat).filter(tr => tr.classList.contains('mainline')), h4 = body().querySelector(`[data-pp-body="${pid}"] [data-pp-stat="${m.stat}"] h4`); nLines++;
      const fo = PF.propFairOver(m.over, m.under), pO = r ? PJ.pOver(m.line, muOf(r, m.stat), PJ.nbVar(muOf(r, m.stat), props8.dist.var[m.stat])) : null;
      const bad = trs.length !== 2 ? `${trs.length} rows` : rowDiff(trs[0], rowWant(`Over ${m.line}`, pO, fo, false, m.over)) || rowDiff(trs[1], rowWant(`Under ${m.line}`, pO == null ? null : 1 - pO, 1 - fo, false, m.under));
      if (bad || h4.querySelector('.mline').textContent !== `DraftKings line ${m.line}`) lineBad.push(`${pid} ${m.stat}: ${bad || h4.textContent}`);
      if (h4.querySelector('.pb-trial')) trialBad.push(`${pid} ${m.stat}: a heading's own mark`);
    }
    { const pb = body().querySelector(`[data-pp-body="${pid}"]`), mk = pb.querySelectorAll('.pb-trial');
      if (r ? !(mk.length === 1 && pb.firstElementChild.matches('[data-pp-trialln]') && pb.firstElementChild.contains(mk[0]) && mk[0].title === w.eval('pbTrialTitle()')) : mk.length) trialBad.push(`${pid}: ${mk.length} marks`); }
    for (const s of PF.PROP_STATS) {
      const want8 = parsed1.ladders.filter(l => l.player === pid && l.stat === s); if (!want8.length) continue;
      const trs = blockRows(pid, s).filter(tr => tr.classList.contains('rung'));
      if (trs.length !== want8.length) rungBad.push(`${pid} ${s}: ${trs.length} rows for ${want8.length}`);
      let last = 2;
      trs.forEach((tr, i) => { const l = want8[i]; nRungs++;
        const pm = r ? PJ.nbSf(l.k, muOf(r, s), PJ.nbVar(muOf(r, s), props8.dist.var[s])) : null;
        const bad = rowDiff(tr, rowWant(`${l.k}+`, pm, PF.propFairRung(l.price, fair8.rung.a[s]), true, l.price)); if (bad) rungBad.push(`${pid} ${s} ${l.k}+: ${bad}`);
        if (pm != null) { if (pm > last + 1e-12) mono = false; last = pm; } });
    }
    for (const y of parsed1.yes.filter(x => x.player === pid)) {
      const trs = blockRows(pid, y.market), fy = PF.propFairRung(y.price, fair8.yes.a[y.market]);
      const bad = trs.length !== 1 ? `${trs.length} rows` : rowDiff(trs[0], rowWant('Gets one', r ? at8(r, y.market) : null, fy, true, y.price));
      if (bad || !/never measured on this market itself/.test((trs[0].querySelector('.fair') || {}).title) || !/read it as high/.test((trs[0].querySelector('.fair') || {}).title)) yesBad.push(`${pid} ${y.market}: ${bad || 'title'}`);
    }
  }
  check(nLines === nMain1 && !lineBad.length, `each of the ${nLines} main lines is its stat block's two rows, Over and Under: the box, the bet, the model's chance (tools/props.js's distribution on the published projection) as its bar, percentage and the NFL's band, "book N%" DraftKings' fair chance (the whole margin on the Over), and DraftKings' price; the heading "DraftKings line N", the NFL's words${lineBad.length ? ': ' + lineBad.slice(0, 3).join('; ') : ''}`);
  check(!trialBad.length, `each projected player's body, its lines' chances and his double- and triple-double's, opens on one quiet "on trial" line titled as the Parlay Builder's, and no heading carries one; a player with no projection none${trialBad.length ? ': ' + trialBad.slice(0, 3).join('; ') : ''}`);
  check(nRungs === parsed1.ladders.length && !rungBad.length, `with Milestones on, each of the ${nRungs} milestone prices is a row under its stat: k+, the model's chance of reaching it, DraftKings' fair chance est. (the rung rule on the measured margin) and its price${rungBad.length ? ': ' + rungBad.slice(0, 3).join('; ') : ''}`);
  check(mono && nRungs > 0, "the model's chance of each ladder falls as the rung rises");
  check(parsed1.yes.length && !yesBad.length, `the double- and triple-double prices are the NFL's touchdown block: the model's chance, DraftKings' fair chance est. by the rung rule on the rungs' margin, its title saying that margin was never measured there and may run high${yesBad.length ? ': ' + yesBad.join('; ') : ''}`);
  openRow('4065648'); await sleep(5);
  { const rung = blockRows('4065648', 'pts').find(tr => tr.classList.contains('rung')), key = rung && rung.querySelector('input').getAttribute('data-pp-key');
    const keep = [dump(w.localStorage), dump(w.sessionStorage)];     // the leg this case ticks and unticks writes your parlay's own key; put back after
    rung.querySelector('input').click(); await sleep(10);
    swR.click(); await sleep(20);
    const kept = body().querySelector(`[data-pp-key="${key}"]`);
    check(swR.checked === false && kept && kept.checked && blockRows('4065648', 'pts').filter(tr => tr.classList.contains('rung')).length === 1, 'a rung in your parlay stays under its player with Milestones off, ticked');
    kept.focus(); kept.click(); await sleep(20);
    const a = d.activeElement;
    check(!body().querySelector(`[data-pp-key="${key}"]`) && a && a.matches('input[data-sg-add]') && a.closest('[data-pp-body="4065648"] [data-pp-stat="pts"]') && a !== d.getElementById('ppClose'),
      `taken out, it leaves the view and the focus goes to the next box in its own stat block (${a && (a.getAttribute('aria-label') || a.id)}), never to ✕ Close far above it`);
    for (const [st, o] of [[w.localStorage, keep[0]], [w.sessionStorage, keep[1]]]) { st.clear(); for (const [k, v] of Object.entries(o)) st.setItem(k, v); }
    d.getElementById('ppSlipSt').textContent = ''; }
  check(swR.checked === false && !body().querySelector('[data-pp-body="4065648"] tr.rung') && blockRows('4065648', 'pts').length === 2, 'with Milestones off again, only the main lines are rows (the NFL hides its ladders the same way)');
  openRow('2'); await sleep(5);
  { const sr = blockRows('2', 'pts'), star = body().querySelector('[data-pp-player="2"]');
    const tx = el => el ? el.textContent : null;
    check(star && star.closest('section').dataset.ppTeam === 'BOS' && tx(body().querySelector('[data-pp-player="2"] [data-pp-inj]')) === 'Out' && /^No projection: Out on the injury report\./.test(tx(body().querySelector('[data-pp-body="2"] [data-pp-noproj]')))
      && sr.length === 2 && !rowDiff(sr[0], rowWant('Over 18.5', null, PF.propFairOver(-120, -110), false, -120)),
      "a player DraftKings lines whom the report has out is named from the game's absentees, wears his Out chip, has no projection and his lines show DraftKings' fair chance alone"); }
  openRow('3006'); await sleep(5);
  check([...body().querySelectorAll('[data-pp-body="3006"] [data-pp-stat]')].every(x => x.querySelector('[data-pp-noline]')) && !body().querySelector('[data-pp-body="3006"] input'), 'a projected player DraftKings does not line keeps his row, each block "No DraftKings line yet."');
  check(!body().querySelector('[data-pp-outs]') || ![...body().querySelectorAll('[data-pp-outs]')].some(p => /Some Star/.test(p.textContent)), "a player out whom DraftKings lines is drawn, so the out line no longer names him");
  bt = body().textContent;
  check(!banned(bt), 'the view says neither "edge", "model says" nor "value" on a prop');
  check(storedNoTab(w) === before, 'nothing stored by opening the sheet');
  d.getElementById('ppClose').click(); await sleep(20);
  cardBtn(p2).click(); await sleep(20);
  openRow('9000001'); await sleep(5);
  const pts2 = blockRows('9000001', 'pts'); openRow('9000002'); await sleep(5); const reb2 = blockRows('9000002', 'reb');
  check(pts2.length === 2 && reb2.length === 2 && body().querySelector('[data-pp-body="9000002"] [data-pp-stat="pra"] [data-pp-mu]').textContent === `projected ${(15.5 + 11.8 + 2.1).toFixed(1)}`,
    "p2 read on both pages, its ESPN id from the scoreboard: a pair split across the pages is still a line, and a combo's projection is the sum of its parts'");
  check(body().querySelector('section[data-pp-team="other"] [data-pp-player="99999999"]') && /ESPN athlete 99999999/.test(body().querySelector('section[data-pp-team="other"]').textContent) && /Other DraftKings lines/.test(body().querySelector('section[data-pp-team="other"] h3').textContent),
    'an athlete no file knows is shown by his ESPN id, last, under Other DraftKings lines');
  d.getElementById('ppClose').click(); await sleep(20);
  cardBtn(p3).click(); await sleep(20);
  check(/^DraftKings via ESPN, .* · no player props posted yet · this visit only$/.test(d.getElementById('ppOddsSt').textContent) && /No projection for this game yet/.test(body().textContent) && /No projections for this game yet/.test(body().querySelector('[data-pp-head]').textContent),
    'a 404 is "none posted yet", and a game the model has not projected says so, its head card too');
  d.getElementById('ppClose').click(); await sleep(20);
  cardBtn(p4).click(); await sleep(20);
  check(/could not be read at/.test(d.getElementById('ppOddsSt').textContent), `a junk answer is "could not be read" ("${d.getElementById('ppOddsSt').textContent}")`);
  d.getElementById('ppClose').click(); await sleep(20);

  /* the press's props reach the Parlay Builder's Top 50 lines (README "Parlay Builder"): every player line there is
     marked on trial, and with the read taken away again no player line is left */
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const plRows = () => [...d.querySelectorAll('#pbPanel li.pb-trow')].filter(li => /\|prop\|/.test(li.querySelector('[data-pb-leg]').dataset.pbLeg));
  const nPl = w.getPbTop().rows.filter(l => l.kind === 'prop').length;
  check(nPl > 0 && plRows().length === nPl && plRows().every(li => li.querySelector('.pb-trial')) && [...d.querySelectorAll('#pbPanel li.pb-trow')].every(li => !!li.querySelector('.pb-trial') === /\|prop\|/.test(li.querySelector('[data-pb-leg]').dataset.pbLeg)),
    `the props the press read reach the Top 50 lines (${nPl} player lines), each marked on trial, and no team line is`);
  check(!plRows().some(li => /Some Star/.test(li.textContent)), 'never a player the injury report has out');
  w.eval('window.__pp = PP_LIVE; PP_LIVE = {}; PB_TOP_CACHE.clear(); render.parlay();');
  check(!plRows().length && !d.querySelector('#pbPanel .pb-trial'), 'with the read taken away, no player line is on the list');
  w.eval('PP_LIVE = window.__pp; delete window.__pp; PB_TOP_CACHE.clear(); render.parlay();');
  check(storedNoTab(w) === before && !/Tatum|4432166/.test(w.localStorage.getItem('nba_hub_2027') || ''), 'and nothing of the read is stored');

  /* a second press: p1's read fails, and p2's page 1 answers but its page 2 is a 404, so the earlier props of both stand,
     with their read time (a 404 after page 1 is a failed read, never "none posted") */
  const firstAt = w.NBA_PROPS.live()[p1.id].at, firstAt2 = w.NBA_PROPS.live()[p2.id].at, lines2 = w.NBA_PROPS.live()[p2.id].mains.length;
  propsAns['401909088'] = 500;
  propsAns['401900002'] = [page(p2Items.slice(0, half), 1, 2), 404];
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20);
  cardBtn(p1).click(); await sleep(20);
  const own = d.getElementById('ppRefresh'), stNode = d.getElementById('ppOddsSt'); own.focus(); own.click();
  check(d.getElementById('ppOddsSt').textContent === "Reading DraftKings' lines from ESPN…" && own.getAttribute('aria-busy') === 'true' && d.activeElement === own && d.getElementById('ppRefresh') === own,
    "the view's own Refresh odds is the same press: at once its status line says it is reading, the button busy, the focus kept on it");
  await idle();
  check(d.getElementById('ppOddsSt') === stNode && d.contains(stNode) && !own.hasAttribute('aria-busy') && d.activeElement === own,
    "through the press, its busy line and its answer, the status line is the very same node, its words changed in place (heard), and the focus stays on the button");
  openRow('4065648'); await sleep(5);
  check(/4 could not be read \(2 keep their props read earlier\)/.test(d.getElementById('propsSt').textContent) && w.NBA_PROPS.live()[p1.id].at === firstAt && blockRows('4065648', 'pts').length === 2
    && d.getElementById('ppOddsSt').textContent === `DraftKings via ESPN, ${et(firstAt)} · ${PF.propParse(p1Items).mains.length} main lines · this visit only`,
    `a failed read keeps the earlier press's props for its game, and the view says when they were read ("${d.getElementById('ppOddsSt').textContent.slice(0, 60)}")`);
  check(w.NBA_PROPS.live()[p2.id].status === 'ok' && w.NBA_PROPS.live()[p2.id].at === firstAt2 && w.NBA_PROPS.live()[p2.id].mains.length === lines2 && lines2 > 0,
    "a game whose page 2 is a 404 after page 1 answered keeps its earlier props whole, never page 1's alone nor \"none posted\"");
  check(d.getElementById('ppTitle').textContent.includes('BOS') && !sheet().hidden, 'the open sheet is redrawn in place after the press');
  d.getElementById('ppClose').click(); await sleep(20);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* a reload is the published page again */
  ({ w, errors, requests, timers } = load('index.html', st8, null, espnStub(sb, () => 0, propsAns)));
  await sleep(300); d = w.document;
  await provoke(w, timers, errors);
  cardBtn(p1).click(); await sleep(30);
  check(/^Published lines did not load/.test(d.getElementById('ppOddsSt').textContent) && !body().querySelector('[data-sg-add]') && d.getElementById('propsSt').hidden && !Object.keys(w.NBA_PROPS.live()).length && !espnReqs(requests).length
    && body().querySelectorAll('[data-pp-player]').length === Object.keys(bosDet.players).length,
    'a reload shows the projections again with no DraftKings line, reads nothing from ESPN, and holds nothing from before');
  d.getElementById('ppClose').click();

  /* a sheet left open while its game tips says so, at the page's once-a-minute look */
  const p9 = og('NOP', 'MEM', 1500, { espn: '401900009' });
  ({ w, errors, requests, timers } = load('index.html', { ...st8, slate: [p9, p1].map(g => JSON.parse(JSON.stringify(g))) }, null, espnStub(sb, () => 0, propsAns)));
  await sleep(300); d = w.document;
  cardBtn(p9).click(); await sleep(20);
  check(!d.getElementById('ppFixed').hidden && body().querySelector('[data-pp-head]'), 'p9 opens before its tip');
  d.getElementById('ppFind').focus();
  await sleep(1700);
  for (const t of timers.filter(t => t.k === 'setInterval')) t.fn();
  await sleep(20);
  check(/This game has tipped off/.test(body().textContent) && d.getElementById('ppFixed').hidden && ![...d.querySelectorAll('#ppSheet input, #ppSheet [data-pp-refresh]')].some(el => !el.closest('[hidden]')) && d.getElementById('ppSwitches').hidden, 'once it tips, the open sheet says so and offers nothing');
  check(d.activeElement === d.getElementById('ppClose'), "the focus, on the search when it went, moves to ✕ Close, never to the page");
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* the published lines (lines.json, README "The lines feed"), read as the Parlay Builder reads them: shown with no
     press, every leg dated by the job's read; a press's newer read takes its place, and its legs carry the press's time */
  { const T0 = new Date(Date.now() - 2 * 3600e3).toISOString(), P0 = PF.propParse(rec.items);
    const pubLines = { v: 1, at: T0, games: { [p1.id]: { at: T0, espn: '401909088', ml: { home: -150, away: 130 }, spread: { line: -3.5, home: -108, away: -112 }, total: { line: 219.5, over: -110, under: -110 },
      ids: { event: '34510070', ml: { home: '0ML1_1', away: '0ML1_3' }, spread: { home: '0HC1N350_1', away: '0HC1P350_3' }, total: { over: '0OU1O21950_1', under: '0OU1U21950_3' } }, props: { at: T0, mains: P0.mains, ladders: P0.ladders, yes: P0.yes } } } };
    /* lines.json answers half a second after it is asked: until then the view says it is loading, never that there is no line */
    let linesAsked = 0;
    JSONS = [[/lines\.json/, () => { linesAsked++; return new Promise(res => setTimeout(() => res({ ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(pubLines)) }), 500)); }]];
    const ansPub = { ...propsAns, '401909088': page(p1Items, 1, 1) };
    ({ w, errors, requests, timers } = load('index.html', st8, null, espnStub(sb, () => 0, ansPub)));
    await sleep(300); d = w.document;
    check(cardBtn(p1).textContent.trim() === 'Player props' && !linesAsked, "before any view opens, lines.json is not read and the card's button counts nothing");
    cardBtn(p1).click(); await sleep(60);
    openRow('4065648'); await sleep(5);
    { const gbl = body().querySelector('[data-pp-gbets] [data-pp-noline]'), bl = body().querySelector('[data-pp-body="4065648"] [data-pp-stat="pts"] [data-pp-noline]');
      check(linesAsked === 1 && d.getElementById('ppOddsSt').textContent === "Loading DraftKings' published lines…" && gbl && gbl.textContent === "Loading DraftKings' lines…" && bl && bl.textContent === "Loading DraftKings' lines…"
        && !/No DraftKings (line|prices) yet/.test(body().textContent),
        `while lines.json is still being read, Game bets and each stat block say so ("${gbl && gbl.textContent}"), never that there is no line`); }
    await sleep(600);
    check(d.getElementById('ppOddsSt').textContent === `DraftKings as published, ${et(T0)} · ${P0.mains.length} main lines` && d.getElementById('ppOddsSt').title === `DraftKings: ${P0.mains.length} main lines, ${P0.ladders.length} milestone prices and ${P0.yes.length} double- and triple-double prices.` && !espnReqs(requests).length,
      `when it answers, the view stands on the job's published lines, as the Parlay Builder does ("${d.getElementById('ppOddsSt').textContent}"), and nothing is read from ESPN`);
    { const cb = d.querySelector(`main [data-props="${p1.id}"]`);
      check(cb && cb.textContent.trim() === `Player props · ${P0.mains.length} lines` && cb.classList.contains('has'), `and the card's button under it counts the main lines its view now shows, put right in place ("${cb && cb.textContent.trim()}")`); }
    { const hd = body().querySelector('[data-pp-head] [data-pp-vegas]'), hl = pubLines.games[p1.id].spread.line;
      check(hl !== p1.line && hd.querySelector('.pill').textContent === (hl < 0 ? p1.home : p1.away) && hd.querySelector('small').textContent === `by ${Math.abs(hl)}` && !hd.querySelector('[data-pp-vegas-src]'),
        `Vegas's pick is DraftKings' spread as Game bets has it (by ${Math.abs(hl)}), not the board's older line (${p1.line}), so the two cards agree`); }
    openRow('4065648'); await sleep(5);
    const tp = blockRows('4065648', 'pts'), m0 = P0.mains.find(m => m.player === '4065648' && m.stat === 'pts');
    check(tp.length === 2 && rowSays(tp[0]).price === ppAm(m0.over) && JSON.parse(w.eval(`JSON.stringify(PP_OFFER[${tp[0].querySelector('input').dataset.sgAdd}])`)).at === T0,
      "its lines show with no press, each box's leg dated by the job's read");
    const gb = [...d.querySelectorAll('[data-pp-gbets] tr[data-pp-leg]')];
    const glsrc = (d.querySelector('[data-pp-glsrc]') || {}).textContent;
    check(glsrc === `Lines: DraftKings', as published ${et(T0)}.` && gb.length === 6, `Game bets reads the published game lines too ("${glsrc}")`);
    /* the Game bets card's chances are the Parlay Builder's own for the same legs (pbPriced, pbTotals: legModel and legFair) */
    const pbl = JSON.parse(w.eval(`JSON.stringify(pbPriced([S.slate.find(g => g.id === ${JSON.stringify(p1.id)})]).concat(pbTotals(S.slate.find(g => g.id === ${JSON.stringify(p1.id)}))).filter(l => l.kind !== 'prop').map(l => [l.sk, l.p, legFair(l)]))`));
    const byKey = new Map(pbl.map(x => [x[0], x])), gbBad = gb.filter(tr => { const x = byKey.get(tr.dataset.ppLeg), s = rowSays(tr); return !x || s.p !== x[1] || s.fair !== `book ${ppPct(x[2].p)}`; });
    check(pbl.length === 6 && !gbBad.length, `each of the six Game bets rows draws the very chance and fair chance the Parlay Builder gives the same leg${gbBad.length ? ': ' + gbBad.map(tr => tr.dataset.ppLeg).join(', ') : ''}`);
    /* a press's newer read takes the published one's place: Tatum's points line moved to 27.5 */
    const moved = JSON.parse(JSON.stringify(p1Items)); for (const it of moved) if (/athletes\/4065648/.test(it.athlete.$ref) && String(it.type.id) === '1') it.current.target.value = 27.5;
    ansPub['401909088'] = page(moved, 1, 1);
    openRow('4065648'); await sleep(5);
    const ovr = blockRows('4065648', 'pts')[0].querySelector('input'); ovr.focus();
    d.getElementById('ppRefresh').click(); await idle();
    { const a = d.activeElement;
      check(a && a.matches('input[data-sg-add]') && a.closest('[data-pp-body="4065648"] [data-pp-stat="pts"]') && a.closest('tr').querySelector('.thr').textContent === 'Over 27.5',
        `a box whose line the press moved is drawn anew; the focus goes to the first box of the same stat block (${a && a.getAttribute('aria-label')}), never to ✕ Close`); }
    openRow('4065648'); await sleep(5);
    const pAt = w.NBA_PROPS.live()[p1.id].at, tp2 = blockRows('4065648', 'pts');
    check(Date.parse(pAt) > Date.parse(T0) && d.getElementById('ppOddsSt').textContent.startsWith(`DraftKings via ESPN, ${et(pAt)} · `) && rowSays(tp2[0]).thr === 'Over 27.5'
      && JSON.parse(w.eval(`JSON.stringify(PP_OFFER[${tp2[0].querySelector('input').dataset.sgAdd}])`)).at === pAt,
      "a press's newer read takes the published one's place: the moved line shows, its leg dated by the press");
    check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
    JSONS = []; }

  /* the page's copies are tools/props_feed.js's and tools/props.js's: the text, then the results */
  const pageSrc = fs.readFileSync(pageFile('index.html'), 'utf8');
  const feedSrc = fs.readFileSync(path.join(ROOT, 'tools', 'props_feed.js'), 'utf8'), nbSrc = fs.readFileSync(path.join(ROOT, 'tools', 'props.js'), 'utf8');
  const copied = [['props_feed.js', feedSrc, ['PROP_URL', 'PROP_MAIN', 'PROP_MILE', 'PROP_YES', 'PROP_STATS', 'propAmerican', 'propImplied', 'propAthlete', 'propLine', 'propTypeId', 'propPrice', 'propItems', 'propParse', 'propFairOver', 'propFairRung', 'propRead']],
    ['props.js', nbSrc, ['nbVar', 'nbPmf', 'nbSf', 'pOver']]];
  for (const [file, src, names] of copied) { const diff = names.filter(n => { const a = srcOf(src, n), b = srcOf(pageSrc, n); return !a || a !== b; });
    check(!diff.length, `the page's ${names.join(', ')} are tools/${file}'s, line for line${diff.length ? `: differ: ${diff.join(', ')}` : ''}`); }
  const P = w.NBA_PROPS;
  const sameP = (items) => { const run = fn => { try { return JSON.stringify(fn(JSON.parse(JSON.stringify(items)))); } catch (e) { return 'threw ' + e.name; } }; return run(PF.propParse) === run(x => P.propParse(x)); };
  const base8 = rec.items;
  const swap = (a, i) => { const b = a.slice(); [b[i], b[i + 1]] = [b[i + 1], b[i]]; return b; };
  const variants8 = {
    'the recorded answer': base8, 'with made-up lines and two pages': p1Items.concat(p2Items),
    'every pair swapped (Over second)': base8.reduce((a, it, i) => i % 2 ? a : a.concat(base8[i + 1] ? [base8[i + 1], it] : [it]), []),
    'a pair broken by an item between': (() => { const a = base8.slice(); a.splice(1, 0, ppItem(5, '1', 1.5, -110)); return a; })(),
    'one side of a pair missing': base8.slice(1),
    'a rung contradicting its pair': [ppItem(1, '7', 20.5, -150), ppItem(1, '7', 20.5, 120), ppItem(218, '7', 21, 118)].concat(base8),
    'two lines on one stat': [ppItem(90, '8', 18.5, -160), ppItem(90, '8', 18.5, 125), ppItem(90, '8', 17.5, -112), ppItem(90, '8', 17.5, -108)].concat(base8),
    'prices OFF, EVEN, blank and small': base8.map((it, i) => { const c = JSON.parse(JSON.stringify(it)); c.odds.american.value = ['OFF', 'EVEN', '', '+99', '-100', null, 'EV', '+117'][i % 8]; return c; }),
    'lines that are not numbers': base8.map((it, i) => { const c = JSON.parse(JSON.stringify(it)); if (i % 3 === 0 && c.current && c.current.target) c.current.target.value = ['x', '', null][(i / 3) % 3]; return c; }),
    'team markets, unknown types and no athlete': [{ team: { $ref: '.../teams/8' }, type: { id: '98' }, odds: { american: { value: '-115' } }, current: { target: { value: 115.5 } } }, { type: { id: '1' } }, ppItem(72, '3', 1.5, -110), null, 7].concat(base8),
    'a rung listed twice and a fractional rung': [ppItem(218, '4', 20, -200), ppItem(218, '4', 20, -150), ppItem(218, '4', 20.5, -110), ppItem(92, '4', null, 300), ppItem(92, '4', null, 200)].concat(base8),
  };
  for (const [name, items] of Object.entries(variants8)) check(sameP(items), `the page's parse equals tools/props_feed.js's on ${name}`);
  check(PF.propParse(swap(base8, 0)).mains.length < PF.propParse(base8).mains.length || JSON.stringify(PF.propParse(swap(base8, 0)).mains) !== JSON.stringify(PF.propParse(base8).mains), 'the swapped-pair variant really changes what the parse reads (the cases bite)');
  const scen = { 'one page': () => async () => page(base8, 1, 1), 'two pages': () => { const pg = [page(base8.slice(0, 7), 1, 2), page(base8.slice(7), 2, 2)]; return async url => pg[+/page=(\d+)/.exec(url)[1] - 1]; },
    'a 404': () => async () => { throw new Error('HTTP 404'); }, 'a 404 on page 2': () => async url => { if (/page=2/.test(url)) throw new Error('HTTP 404'); return page(base8, 1, 2); },
    'a 503': () => async () => { throw new Error('HTTP 503'); }, 'junk': () => async () => '<html>', 'an object that is not a page': () => async () => ({ hello: 1 }),
    "ESPN's 404 body": () => async () => ({ error: { message: 'No propBets found for eventId 1 and provider 100', code: 404 } }), 'a network error': () => async () => { throw new TypeError('Failed to fetch'); } };
  const wantSt = { 'one page': 'ok', 'two pages': 'ok', 'a 404': 'none', 'a 404 on page 2': 'failed', 'a 503': 'failed', 'junk': 'failed', 'an object that is not a page': 'failed', "ESPN's 404 body": 'none', 'a network error': 'failed' };
  for (const [name, mk] of Object.entries(scen)) { const a = JSON.stringify(await PF.propRead('401909088', mk())), b = JSON.stringify(await P.propRead('401909088', mk()));
    check(a === b && JSON.parse(b).status === wantSt[name], `the page's read equals tools/props_feed.js's on ${name}, and is ${wantSt[name]} (${JSON.parse(b).status})`); }
  let nbBad = 0;
  for (const k of ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb']) for (const mu of [0, 0.3, 1.7, 4.4, 9.9, 21.6, 38.2]) { const ab = props8.dist.var[k], v = PJ.nbVar(mu, ab);
    if (v !== P.nbVar(mu, ab)) nbBad++;
    for (const line of [0.5, 1.5, 4, 9.5, 22.5, 40.5]) if (PJ.pOver(line, mu, v) !== P.pOver(line, mu, v) || PJ.nbSf(Math.ceil(line), mu, v) !== P.nbSf(Math.ceil(line), mu, v)) nbBad++; }
  check(nbBad === 0, "the page's distribution equals tools/props.js's: variance, P(over a line) and P(at least k), every stat, means 0 to 38");
  let fairBad = 0;
  for (const a of [-1000, -250, -130, -110, 100, 105, 150, 400, 2500]) for (const b of [-400, -115, 100, 120, 300]) if (PF.propFairOver(a, b) !== P.propFairOver(a, b)) fairBad++;
  for (const a of [-3000, -400, -150, 100, 140, 300, 900, 5000]) { for (const s of Object.keys(fair8.rung.a)) if (PF.propFairRung(a, fair8.rung.a[s]) !== P.propFairRung(a, fair8.rung.a[s])) fairBad++; for (const m of ['dd', 'td']) if (PF.propFairRung(a, fair8.yes.a[m]) !== P.propFairRung(a, fair8.yes.a[m])) fairBad++; }
  check(fairBad === 0, "and its fair chances are tools/props_feed.js's: the main line's, a rung's and a Yes price's");

  /* the shadow ledger, quietly, on made-up summaries: running numbers with no verdict before the bar; then a FAIL and a PASS */
  const lgOf = (summary, decision) => ({ ...st8, props: { ...props8, ledger: { ...props8.ledger, summary: { ...props8.ledger.summary, ...summary }, decision } } });
  const scores = { lines: 12345, model: { logloss: 0.69, brier: 0.249 }, market: { logloss: 0.68, brier: 0.244 } };
  /* the ledger's numbers are in each game's props sheet (the Record tab, laid out as the NHL hub's since 31 October 2026,
     no longer draws them) */
  const ledgerText = async st => { ({ w, errors } = load('index.html', st)); await sleep(300); d = w.document;
    cardBtn(p1).click(); await sleep(20); const tr = d.querySelector('[data-pp-trial]'), t = tr ? tr.textContent : ''; return [t, t]; };
  let [lt, tt] = await ledgerText(lgOf({ lines: 12345, gradedGames: 101, scores }, null));
  check(/12,345 of the 30,000 graded lines its bar is judged on are in, from 101 games; no verdict before 30,000\. So far on 12,345 lines, log loss model 0\.6900 · DraftKings 0\.6800, Brier model 0\.2490 · DraftKings 0\.2440/.test(lt) && tt.includes('12,345 of the 30,000'),
    `before the bar, the props sheet gives the running numbers, model against DraftKings ("${lt.slice(-190)}")`);
  check(!/PASS|FAIL|pass|fail/.test(lt + tt), 'and no verdict, nor a word of one');
  [lt] = await ledgerText(lgOf({ lines: 30000, gradedGames: 260, scores }, { verdict: 'FAIL', decidedAt: '2026-11-25T12:00Z', lines: 30000 }));
  check(/decided on Nov 25 at 30,000 lines: FAIL\. Its chances are no longer used in the Parlay Builder's Top 50 lines or Suggested Parlays, and its calls have stopped; the projections stay for reference\./.test(lt) && !/on trial/i.test(lt), `a FAIL is said, and the model is no longer called on trial ("${lt.slice(-140)}")`);
  [lt] = await ledgerText(lgOf({ lines: 30000, gradedGames: 260, scores }, { verdict: 'PASS', decidedAt: '2026-11-25T12:00Z', lines: 30000 }));
  check(/PASS, which makes it a candidate to be shown as more than on trial, by a change of its own; until then it stays on trial/.test(lt), 'a PASS moves nothing by itself: the model stays on trial');
  /* the early stop (tools/props_ledger.js EARLY_STOP, the owner's call of 5 November 2026), on made-up decisions in the
     shape publish.js writes: said plainly from the decision's own numbers, a FAIL that takes the model's chances out of
     the Parlay Builder and Suggested Parlays */
  const PLx = require('./props_ledger'), early = { at: PLx.EARLY_STOP.at, by: PLx.EARLY_STOP.by, why: PLx.EARLY_STOP.why };
  const earlyOf = (lines, ll, br, units, bets) => ({ verdict: 'FAIL', decidedAt: '2026-11-05T18:30Z', lines, games: Math.round(lines / 100),
    scores: { lines, logloss_diff: ll, brier_diff: br }, flat: { edge: 0.03, all: { bets, won: Math.round(bets / 2), units } }, early });
  [lt] = await ledgerText(lgOf({ lines: 12298, gradedGames: 121, scores: { ...scores, lines: 12298 } }, earlyOf(12298, 0.018439, 0.008278, -222.81, 6027)));
  check(lt.includes("Stopped early on 5 November 2026, the owner's call, at 12,298 graded lines: behind DraftKings on both scores and its flat bets down 223 units. FAIL: its chances are no longer used in the Parlay Builder's Top 50 lines or Suggested Parlays, and its calls have stopped; the projections stay for reference. So far on 12,298 lines,") && !/decided on|stays on trial and suggests nothing|PASS|\bpass/.test(lt),
    `an early stop is said plainly, from its decision ("${lt.slice(lt.indexOf('Stopped'), lt.indexOf('Stopped') + 240)}")`);
  [lt] = await ledgerText(lgOf({ lines: 4567, gradedGames: 45, scores: { ...scores, lines: 4567 } }, earlyOf(4567, 0.0042, -0.0011, 12.4, 300)));
  check(lt.includes("Stopped early on 5 November 2026, the owner's call, at 4,567 graded lines: behind DraftKings on log loss and its flat bets up 12 units. FAIL:"), `and its words follow the decision's numbers, not the real ones ("${lt.slice(lt.indexOf('Stopped'), lt.indexOf('Stopped') + 130)}")`);
  [lt] = await ledgerText(lgOf({ lines: 4567, gradedGames: 45, scores: { ...scores, lines: 4567 } }, earlyOf(4567, -0.0042, 0.0011, 0, 0)));
  check(lt.includes('at 4,567 graded lines: behind DraftKings on Brier and no flat bets at its edge. FAIL:'), 'one score behind and no bet at the edge are said so');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* the props model's FAIL (README "Player props", "What a FAIL changes"): once the ledger's decision is a FAIL
     (pbPropsOn false: the early stop of 5 November 2026, or the bar's own), every player line in the view is drawn at
     DraftKings' fair chance (its bar, percentage and band; est. where one-sided; none where there is no fair chance), the
     props model's chance small and muted beside it ("props model 61%"), titled with why it is not used; the tags and the
     folded note say it failed, never "on trial", and nothing says a list or set takes a player's line; Game bets and the
     box's leg are as before. Before a FAIL the same code draws the trial's view. Held here on made-up decisions (none, a
     PASS, an early FAIL with one stat's milestone margin taken away, a full-bar FAIL) and the real ledger's own, each
     number worked out on its own from tools/props_feed.js's fair-chance rule and tools/props.js's distribution, on the
     job's published lines (lines.json) for this file's own game, so it holds at any hour and in the off-season */
  /* the builder's edges, planted on p1's own players beside the recorded answer (README "Parlay Builder", "After the
     FAIL"): Cade Cunningham's 3+ points at -50000 (the props model's chance and, with the points milestones' margin,
     DraftKings' fair chance both over 99.5%: ">99%"; with that margin taken away, no fair chance at all), Det Center's 15+
     assists at +50000 (both under 0.5%: "<1%"), Bos Guard's 1+ rebounds at +100 (the model about 95%, DraftKings' fair
     chance about 43%: far off the market) and Det Wing's points Over 9.5 at -300 / +257 (DraftKings' fair chance 72%: High
     on the view's scale, MED on the builder's own) */
  const EDGE8 = [ppItem(218, '4432166', 3, '-50000'), ppItem(219, '3004', 15, '+50000'), ppItem(220, '3001', 1, '+100'), ppItem(1, '3005', 9.5, '-300'), ppItem(1, '3005', 9.5, '+257')];
  { const T0 = new Date(Date.now() - 2 * 3600e3).toISOString(), PA = PF.propParse(p1Items.concat(EDGE8)), rowsP = props8.games[p1.id].players;
    const pubF = { v: 1, at: T0, games: { [p1.id]: { at: T0, espn: '401909088', ml: { home: -150, away: 130 }, spread: { line: -3.5, home: -108, away: -112 }, total: { line: 219.5, over: -110, under: -110 },
      props: { at: T0, mains: PA.mains, ladders: PA.ladders, yes: PA.yes } } } };
    JSONS = [[/lines\.json/, pubF]];
    const MONTHS_OWN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const dayOwn = iso => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(iso || '')); return m && +m[2] >= 1 && +m[2] <= 12 ? `${+m[3]} ${MONTHS_OWN[+m[2] - 1]} ${m[1]}` : ''; };
    const fmtN = v => Number(v || 0).toLocaleString('en-US');
    /* this file's own words for the FAIL, from the decision: why the model's chances are not used, the tags' and the
       muted chance's titles, and the note (the early stop's sentence from its own numbers, or the bar's) */
    const offOwn = dec => dec.early ? `the props model’s trial was stopped early as a FAIL${dayOwn(dec.early.at) ? ' on ' + dayOwn(dec.early.at) : ''}` : 'the props model failed its shadow ledger’s bar';
    const cap = t => t[0].toUpperCase() + t.slice(1);
    const tagTitleOwn = dec => `${cap(offOwn(dec))}${dec.early ? ', the owner’s call' : ''}: it was not shown to beat DraftKings’ closing lines, so the chances in this view are DraftKings’ fair chances, and its projections and its own chances are shown for reference only`;
    const mdlTitleOwn = dec => `${cap(offOwn(dec))}${dec.early ? ', the owner’s call: it was not shown to beat DraftKings’ closing lines' : ' against DraftKings’ closing lines'}, so this chance is the model’s, for reference only, and no list or set takes it`;
    const noteOwn = (dec, sm) => {
      const tail = "its chances are no longer used in the Parlay Builder's Top 50 lines or Suggested Parlays, and its calls have stopped; the projections stay for reference.";
      let s;
      if (dec.early) { const sc = dec.scores || {}, fl = dec.flat && dec.flat.all, bh = [sc.logloss_diff > 0 && 'log loss', sc.brier_diff > 0 && 'Brier'].filter(Boolean), u = fl ? Math.round(Math.abs(fl.units)) : 0;
        const bets = !fl || !fl.bets ? 'no flat bets at its edge' : fl.units === 0 ? 'its flat bets level' : `its flat bets ${fl.units < 0 ? 'down' : 'up'} ${fmtN(u)} unit${u === 1 ? '' : 's'}`;
        s = `Stopped early on ${dayOwn(dec.early.at || dec.decidedAt)}, ${dec.early.by || 'the owner'}'s call, at ${fmtN(dec.lines)} graded lines: ${bh.length === 2 ? 'behind DraftKings on both scores' : bh.length ? 'behind DraftKings on ' + bh[0] : 'not ahead of DraftKings on both scores'} and ${bets}. FAIL: ${tail}`; }
      else s = `Its bar was decided on ${new Date(String(dec.decidedAt).slice(0, 10) + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })} at ${fmtN(dec.lines)} lines: FAIL. ${tail[0].toUpperCase() + tail.slice(1)}`;
      const sc = sm && sm.scores; if (sc && sc.model && sc.market) s += ` So far on ${fmtN(sc.lines)} lines, log loss model ${sc.model.logloss.toFixed(4)} · DraftKings ${sc.market.logloss.toFixed(4)}, Brier model ${sc.model.brier.toFixed(4)} · DraftKings ${sc.market.brier.toFixed(4)} (lower is better).`;
      return s; };
    const FAIL_TAG = 'Props model: failed trial', FAIL_SUM = "The props model failed its trial against DraftKings: the chances here are DraftKings' own, its projections for reference";
    const FAIL_LINE = "His chances here are DraftKings' fair chances; the props model's own, small beside them, are for reference.";
    const FAIL_HOW = "Under each player, each DraftKings line's bar, percentage and band are DraftKings' fair chance of it, its prices with the book's margin taken out (all of it on the Over, the way that scored best on DraftKings' archived closing lines), est. where DraftKings gives one price. Each stat's heading keeps the props model's projection, and its own chance of each line is shown small beside DraftKings', for reference only. Ticking a line's box here puts that leg in your own parlay in the Parlay Builder, at DraftKings' price.";
    /* one FAIL row as drawn, and what it must be: the bet, DraftKings' fair chance (bar, percentage, band; its est.; the
       hidden words that name it; "no DraftKings chance" where there is none), the props model's muted chance and its
       title, no "book" cell and no model percentage of its own, DraftKings' price */
    const failSays = tr => { const pc = tr.querySelector('.pct'), cf = tr.querySelector('.pp-conf'), fl = tr.querySelector('.pp-fill'), md = tr.querySelector('td.mdl');
      return { thr: tr.querySelector('.thr').textContent.trim(), dk: pc.dataset.ppDk ? +pc.dataset.ppDk : null, pct: [...pc.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim(),
        est: !!pc.querySelector('em') && pc.querySelector('em').textContent === 'est.', sr: (pc.querySelector('.sr') || {}).textContent || '', conf: cf ? cf.className.replace('pp-conf ', '') : null,
        nodk: (tr.querySelector('[data-pp-nodk]') || {}).textContent || '', bar: fl ? fl.style.width : null, mdl: md ? md.textContent.replace(/\s+/g, ' ').trim() : null,
        mp: md && md.dataset.ppMdl !== undefined ? +md.dataset.ppMdl : null, mt: md ? md.title : null, fair: !!tr.querySelector('.fair'), p: pc.dataset.ppP === undefined ? null : +pc.dataset.ppP, price: tr.querySelector('.price').textContent.trim() }; };
    const failWant = (thr, f, est, p, price, mt) => ({ thr, dk: f == null ? null : f, pct: f == null ? '–' : ppPct(f), est: f != null && est, sr: f == null ? '' : `DraftKings' fair chance${est ? ', est.' : ''}: `,
      conf: f == null ? null : confOwn(f), nodk: f == null ? 'no DraftKings chance' : '', bar: f == null ? null : Math.max(2, f * 100).toFixed(0) + '%', mdl: p == null ? '' : `props model ${ppPct(p)}`,
      mp: p == null ? null : p, mt: p == null ? '' : mt, fair: false, p: null, price: ppAm(price) });
    const failDiff = (tr, want) => { const got = failSays(tr); return JSON.stringify(got) === JSON.stringify(want) ? null : `${JSON.stringify(got)} want ${JSON.stringify(want)}`; };
    /* every text a reader or a screen reader meets in the sheet: its words, every title and every name */
    const sheetWords = () => { const sh = d.getElementById('ppSheet'); return [sh.textContent].concat([...sh.querySelectorAll('[title],[aria-label]')].map(el => `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`)).join(' \n '); };
    const TAKES = /Top 50 lines take|\btakes? (a|its|their) player|\btake its lines/i;
    /* a state of this file's own with the ledger's decision set, the milestones' margin of one stat taken away where asked */
    const stOf = (decision, summary, dropRung) => { const fair = JSON.parse(JSON.stringify(props8.fair)); if (dropRung) delete fair.rung.a[dropRung];
      return { ...st8, props: { ...props8, fair, ledger: { ...props8.ledger, summary: { ...props8.ledger.summary, ...(summary || {}) }, decision } } }; };
    const openAll = async () => { ({ w, errors } = load('index.html', st)); await sleep(300); d = w.document;
      cardBtn(p1).click(); await sleep(60); for (let i = 0; i < 40 && !w.eval('!!LINES'); i++) await sleep(20);
      const sw = d.getElementById('ppRungs'); if (!sw.checked) { sw.click(); await sleep(20); } };
    let st = null;
    /* the FAIL view, held whole: every player DraftKings lines, every row and heading, the tags, the note, the words */
    const holdFail = async (name, dec, sm, dropRung) => {
      const mt = mdlTitleOwn(dec), fair = JSON.parse(JSON.stringify(props8.fair)); if (dropRung) delete fair.rung.a[dropRung];
      check(w.eval('pbPropsOn()') === false && w.eval('ppFail()') === true, `${name}: the page's own rule reads the decision as a FAIL (pbPropsOn false), and the view draws the FAIL's`);
      const hd = body().querySelector('[data-pp-head]'), tg = hd && hd.querySelector('[data-pp-failtag]');
      check(tg && tg.textContent === FAIL_TAG && tg.title === tagTitleOwn(dec) && !/on trial/i.test(hd.querySelector('.lead-c .pp-ghl').textContent),
        `${name}: the head card's tag reads "${FAIL_TAG}", titled with why ("${tg && tg.title.slice(0, 90)}…")`);
      const tr = body().querySelector('[data-pp-head] + .gwin + details[data-pp-trial][data-pp-fail]'), ps = tr ? [...tr.querySelectorAll('p')].map(p => p.textContent) : [];
      check(tr && !tr.open && tr.querySelector('summary').textContent === FAIL_SUM && tr.querySelector('summary').getAttribute('data-pp-key') === 'trial' && ps[0] === noteOwn(dec, sm) && tr.querySelector('p[data-pp-failnote]') === tr.querySelector('p') && ps[1] === FAIL_HOW,
        `${name}: the folded note after the head card and the game's three buttons is the FAIL's, word for word: its summary, then the decision's own sentence ("${(ps[0] || '').slice(0, 150)}…"), then what the view shows${ps[0] !== noteOwn(dec, sm) ? ` | want "${noteOwn(dec, sm).slice(0, 200)}"` : ''}`);
      const lined = [...new Set(PA.mains.concat(PA.ladders, PA.yes).map(m => m.player).concat(Object.keys(rowsP)))];
      let bad = [], nRow = 0, nNo = 0, nEst = 0, nMd = 0, nNoMd = 0, hBad = [], lnBad = [];
      for (const pid of lined) {
        openRow(pid); await sleep(5);
        const r = rowsP[pid], pb = body().querySelector(`[data-pp-body="${pid}"]`); if (!pb) { bad.push(`${pid}: no body`); continue; }
        { const fl = pb.querySelector('[data-pp-failln]'), mk = pb.querySelectorAll('.pb-trial');
          if (r ? !(fl && pb.firstElementChild === fl && mk.length === 1 && fl.contains(mk[0]) && mk[0].textContent === FAIL_TAG && mk[0].title === tagTitleOwn(dec) && fl.querySelector('span').textContent === FAIL_LINE) : (mk.length || fl))
            lnBad.push(`${pid}: ${fl ? fl.textContent : 'no line'}`); }
        for (const m of PA.mains.filter(x => x.player === pid)) {
          const trs = blockRows(pid, m.stat).filter(t => t.classList.contains('mainline')), h4 = body().querySelector(`[data-pp-body="${pid}"] [data-pp-stat="${m.stat}"] h4`);
          const fo = PF.propFairOver(m.over, m.under), pO = r ? PJ.pOver(m.line, muOf(r, m.stat), PJ.nbVar(muOf(r, m.stat), props8.dist.var[m.stat])) : null;
          const b = trs.length !== 2 ? `${trs.length} rows` : failDiff(trs[0], failWant(`Over ${m.line}`, fo, false, pO, m.over, mt)) || failDiff(trs[1], failWant(`Under ${m.line}`, 1 - fo, false, pO == null ? null : 1 - pO, m.under, mt));
          nRow += 2; if (b) bad.push(`${pid} ${m.stat}: ${b}`);
          const mu = h4 && h4.querySelector('[data-pp-mu]');
          if (!h4 || h4.querySelector('.mline').textContent !== `DraftKings line ${m.line}` || (r ? !(mu && +mu.dataset.ppMu === muOf(r, m.stat) && mu.textContent === `projected ${num1(muOf(r, m.stat))}`) : mu) || h4.querySelector('.pp-mdl, .pb-trial'))
            hBad.push(`${pid} ${m.stat}: ${h4 && h4.textContent}`);
        }
        if (r) for (const s of ORDER_OWN) { if (PA.mains.some(x => x.player === pid && x.stat === s)) continue;
          const h4 = body().querySelector(`[data-pp-body="${pid}"] [data-pp-stat="${s}"] h4`), mu = h4 && h4.querySelector('[data-pp-mu]');
          if (!mu || +mu.dataset.ppMu !== muOf(r, s) || mu.textContent !== `projected ${num1(muOf(r, s))}` || h4.querySelector('.mline, .pp-mdl, .pb-trial')) hBad.push(`${pid} ${s}: ${h4 && h4.textContent}`); }
        for (const s of PF.PROP_STATS) {
          const want = PA.ladders.filter(l => l.player === pid && l.stat === s); if (!want.length) continue;
          const trs = blockRows(pid, s).filter(t => t.classList.contains('rung'));
          if (trs.length !== want.length) { bad.push(`${pid} ${s}: ${trs.length} rungs for ${want.length}`); continue; }
          trs.forEach((t, i) => { const l = want[i], f = PF.propFairRung(l.price, fair.rung.a[s]), pm = r ? PJ.nbSf(l.k, muOf(r, s), PJ.nbVar(muOf(r, s), props8.dist.var[s])) : null; nRow++;
            if (f == null) nNo++; else nEst++;
            const b = failDiff(t, failWant(`${l.k}+`, f, true, pm, l.price, mt)); if (b) bad.push(`${pid} ${s} ${l.k}+: ${b}`); });
        }
        for (const k of ['dd', 'td']) {
          const y = PA.yes.find(v => v.player === pid && v.market === k), h4 = body().querySelector(`[data-pp-body="${pid}"] [data-pp-stat="${k}"] h4`), trs = blockRows(pid, k);
          if (!h4) { if (r || y) hBad.push(`${pid} ${k}: no block`); continue; }
          const pk = r ? at8(r, k) : null, em = h4.querySelector('.pp-mdl');
          if (y) { const f = PF.propFairRung(y.price, fair.yes.a[k]); nRow++; nEst++; const b = trs.length !== 1 ? `${trs.length} rows` : failDiff(trs[0], failWant('Gets one', f, true, pk, y.price, mt)); if (b) bad.push(`${pid} ${k}: ${b}`);
            if (em || h4.querySelector('[data-pp-mu]')) hBad.push(`${pid} ${k}: the heading carries a chance beside the row's (${h4.textContent})`); }
          else if (r) { nNoMd++; if (!(em && em.textContent === `props model ${ppPct(pk)}` && +em.dataset.ppMdl === pk && em.title === mt && !h4.querySelector('[data-pp-mu]')) || trs.length || !body().querySelector(`[data-pp-body="${pid}"] [data-pp-stat="${k}"] [data-pp-noline]`)) hBad.push(`${pid} ${k}: ${h4.textContent}`); }
          else if (em) hBad.push(`${pid} ${k}: a muted chance with no projection`);
        }
        nMd += [...pb.querySelectorAll('td.mdl[data-pp-mdl]')].length;
      }
      check(nRow > 20 && !bad.length, `${name}: each of the ${nRow} player rows is drawn at DraftKings' fair chance (the whole margin on the Over; a milestone's and a Yes price's est., said so), its bar, percentage and the NFL's band, with the props model's chance beside it small and muted ("props model 61%"), titled with why it is not used, and DraftKings' price; no "book" cell and no model percentage of its own${bad.length ? ': ' + bad.slice(0, 2).join('; ') : ''}`);
      check(nMd > 0 && nEst > 0 && !lnBad.length, `${name}: each projected player's body opens on one line that his chances here are DraftKings', the props model's own small beside them, under the "${FAIL_TAG}" mark titled with why (${nMd} muted chances, ${nEst} est.)${lnBad.length ? ': ' + lnBad.slice(0, 2).join('; ') : ''}`);
      check(!hBad.length && nNoMd > 0, `${name}: each heading keeps the projection ("projected 21.0", the props model's mean) and "DraftKings line 21.5", the NFL's words; a double- or triple-double DraftKings has not priced carries the model's chance in its heading, small and muted, with "No DraftKings line yet." (${nNoMd}), and one it has priced carries none there${hBad.length ? ': ' + hBad.slice(0, 2).join('; ') : ''}`);
      if (dropRung) check(nNo > 0, `${name}: a milestone with no fair chance (this state's ${dropRung} margin taken away) shows no chance, a dash and "no DraftKings chance", its bar empty, the props model's beside it still (${nNo})`);
      const words = sheetWords();
      check(!/on trial/i.test(words) && !TAKES.test(words), `${name}: no word, title or name in the view says "on trial", nor that a list or set takes a player's line${/on trial/i.test(words) ? ` ("${words.slice(Math.max(0, words.search(/on trial/i) - 80), words.search(/on trial/i) + 20)}")` : TAKES.test(words) ? ` ("${(TAKES.exec(words) || [''])[0]}")` : ''}`);
      /* Game bets: the board model's and DraftKings' as before, the Parlay Builder's own chances for the same legs */
      const gb = [...body().querySelectorAll('[data-pp-gbets] tr[data-pp-leg]')];
      const pbl = JSON.parse(w.eval(`JSON.stringify(pbPriced([S.slate.find(g => g.id === ${JSON.stringify(p1.id)})]).concat(pbTotals(S.slate.find(g => g.id === ${JSON.stringify(p1.id)}))).filter(l => l.kind !== 'prop').map(l => [l.sk, l.p, legFair(l)]))`));
      const byKey = new Map(pbl.map(x => [x[0], x])), gbBad = gb.filter(t => { const x = byKey.get(t.dataset.ppLeg), s = rowSays(t); return !x || s.p !== x[1] || s.fair !== `book ${ppPct(x[2].p)}` || t.querySelector('td.mdl'); });
      check(gb.length === 6 && pbl.length === 6 && !gbBad.length, `${name}: Game bets are as before, the board model's chances and "book N%" beside them, the Parlay Builder's own for the same legs${gbBad.length ? ': ' + gbBad.map(t => t.dataset.ppLeg).join(', ') : ''}`);
      check(!banned(body().textContent.replace('no flat bets at its edge', '')), `${name}: the view says neither "edge", "model says" nor "value" on a prop`);
      check(errors.length === 0, `${name}: nothing thrown${errors.length ? ': ' + errors.join(' | ') : ''}`);
    };
    /* the box's leg: exactly the trial's, whichever view draws it (the Parlay Builder prices a hand-added leg) */
    const tick = async key => { const b = body().querySelector(`[data-pp-leg="${CSS_ESC(key)}"] input[data-sg-add]`); const leg = w.eval(`JSON.stringify(PP_OFFER[${b.dataset.sgAdd}])`);
      b.click(); await sleep(20); return { leg, slip: w.eval('JSON.stringify(M.slip.legs)'), said: d.getElementById('ppSlipSt').textContent, on: body().querySelector(`[data-pp-leg="${CSS_ESC(key)}"] input[data-sg-add]`).checked }; };
    const CSS_ESC = v => String(v).replace(/["\\]/g, '\\$&');
    const tat = PA.mains.find(m => m.player === '4065648' && m.stat === 'pts'), tatKey = [p1.id, 'prop', '4065648', 'pts', 'main', tat.line, 'over'].join('|');
    const rung1 = PA.ladders.find(l => l.player === '4065648' && l.stat !== 'pts'), rungKey = [p1.id, 'prop', '4065648', rung1.stat, 'mile', rung1.k, 'yes'].join('|');
    /* the Parlay Builder after the FAIL (README "Parlay Builder", "After the FAIL"): the legs a visitor ticked in the view
       go to the builder, and there a player's leg is drawn as his row in the view drew it, DraftKings' fair chance first
       at the view's percentage and band, est. where it is one, "failed trial" where the trial's builder said "on trial",
       titled with why, and the props model's chance small and muted ("props model 50%"); the summary's model line says
       the player legs are the failed model's, the fair price is DraftKings' fair chance's, a team leg and every price,
       payout and the fair chance are as the trial's; the card and the matchup bubble the same; and on a FAIL no text,
       title or name anywhere on the page says "on trial". The trial's (no decision) the builder as before */
    const homeKey = g => [g.id, 'ml', g.home, ''].join('|');
    const viewSays = key => { const tr = body().querySelector(`[data-pp-leg="${CSS_ESC(key)}"]`); if (!tr) return null; const pc = tr.querySelector('.pct'), cf = tr.querySelector('.pp-conf');
      return { pct: [...pc.childNodes].filter(x => x.nodeType === 3).map(x => x.textContent).join('').trim(), conf: cf ? cf.className.replace('pp-conf ', '') : null, est: !!pc.querySelector('em') }; };
    const bandOwn = p => { const r = Math.round(p * 100) / 100; return r >= 0.75 ? ['high', 'HIGH'] : r >= 0.60 ? ['med', 'MED'] : r >= 0.55 ? ['low', 'LOW'] : ['coin', 'UNDER 55%']; };
    const amOwn = p => { const a = p >= 0.5 ? -Math.round(100 * p / (1 - p)) : Math.round(100 * (1 - p) / p); return (a > 0 ? '+' : '') + a; };
    /* the failed model's words, counted: "its player leg" for one, "its player legs" for more */
    const FAILED_SAY = n => `its player leg${n === 1 ? '' : 's'} the props model’s, which failed its trial`;
    /* what a screen reader hears of an element: its text less what it hides, the spaces collapsed */
    const heardOf = el => { if (!el) return ''; const c = el.cloneNode(true); c.querySelectorAll('[aria-hidden="true"]').forEach(x => x.remove()); return c.textContent.replace(/\s+/g, ' ').trim(); };
    /* the view's band, this file's own (ppConf: High from 70, Med from 45, on the whole percentage) */
    const confWord = p => ({ high: 'High', med: 'Med', low: 'Low' })[confOwn(p)];
    const failLegTitleOwn = dec => `${cap(offOwn(dec))}${dec.early ? ', the owner’s call' : ''}: it was not shown to beat DraftKings’ closing lines, so this leg’s chance is DraftKings’ fair chance, and the props model’s own, beside it, is for reference only`;
    /* every word a reader or a screen reader meets anywhere on the page: its text (no script or style), every title, name */
    const pageWords = () => { const b = d.body.cloneNode(true); b.querySelectorAll('script, style, template').forEach(x => x.remove());
      return [b.textContent].concat([...d.querySelectorAll('[title],[aria-label]')].map(el => `${el.getAttribute('title') || ''} ${el.getAttribute('aria-label') || ''}`)).join(' \n '); };
    /* the builder as drawn, read: each row's Chance cell and its whole row, the summary's boxes, the card's chance lines
       and the player leg's matchup bubble */
    const builderRead = async (pkey = tatKey, more = []) => {
      w.eval('propsClose()'); d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(60);
      const bd = d.getElementById('pbBuild'), rows = {};
      for (const tr of bd.querySelectorAll('tr.legrow')) { const c = tr.querySelector('td[data-h="Chance"]'), mk = c.querySelector('.pb-trial'), md = c.querySelector('.pb-mdl'), fp = c.querySelector('[data-pb-fp]'), cf = c.querySelector('.pb-conf'), pp = c.querySelectorAll('[data-pb-p]');
        /* the row's words outside the muted model line: none may name the model's chance there (a far-off flag, a bare figure) */
        const out = tr.cloneNode(true); out.querySelectorAll('.pb-mdl').forEach(x => x.remove()); const far = tr.querySelector('[data-far], .faroff');
        rows[tr.dataset.pbRow] = { html: tr.outerHTML, fp: fp ? +fp.dataset.pbFp : null, fpct: fp ? fp.textContent : null, est: !!c.querySelector('.pb-fest'), conf: cf ? [cf.className.replace('pb-conf ', ''), cf.textContent] : null,
          mark: mk ? [mk.textContent, mk.title] : null, markIn: !!(mk && md && md.contains(mk)), mdl: md ? [(md.querySelector('[data-pb-mv]') || md).textContent, +md.dataset.pbP, md.title] : null, nP: pp.length, p: pp[0] ? +pp[0].dataset.pbP : null, pct: pp[0] && !md ? pp[0].textContent : null,
          legfair: (c.querySelector('.legfair') || {}).textContent || null, nodk: !!c.querySelector('[data-pb-nodk]'), fairLbl: (c.querySelector('.pb-fairlbl') || {}).textContent || null, heard: heardOf(c),
          far: far ? far.textContent : null, bare: /\bmodel (\d+|<1|>99)%/.test(out.textContent) }; }
      const hero = bd.querySelector('.pb-box.hero'), fa = bd.querySelector('[data-pb-fairam]'), tierB = bd.querySelector('.pb-box.tier'), hm = hero && hero.querySelector('[data-model]');
      const sum = { fair: hero && hero.querySelector('[data-fair]') ? +hero.querySelector('[data-fair]').dataset.fair : null, heroTxt: hero ? hero.textContent.replace(/\s+/g, ' ').trim() : '', model: hm ? +hm.dataset.model : null, modelTxt: hm ? hm.textContent : '',
        fairAm: fa ? [fa.querySelector('b').textContent, fa.querySelector('span').textContent] : null, tier: tierB ? tierB.textContent.replace(/\s+/g, ' ').trim() : null, pay: +bd.querySelector('[data-payout]').dataset.payout,
        note: (bd.querySelector('.pb-fair-note') || {}).textContent || null };
      d.getElementById('pFinish').click(); await sleep(20);
      const card = [...d.querySelectorAll('#pcView .pc-chance > div')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
      d.getElementById('pcBack').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20);
      /* the matchup bubble of each leg asked for, opened from its builder row */
      const bubs = {};
      for (const k of [pkey, ...more]) { const nm = bd.querySelector(`tr.legrow[data-pb-row="${CSS_ESC(k)}"] button.glance-name`); if (!nm) { bubs[k] = null; continue; }
        nm.click(); await sleep(30); const B = d.getElementById('glanceBox'), mEl = B && B.querySelector('.glance-nums [data-glance-n="model"]'), th = B && B.querySelector('table.glance-t thead th');
        bubs[k] = B && !B.hidden ? { dts: [...B.querySelectorAll('.glance-nums dt')].map(x => x.textContent), model: (mEl || {}).textContent, modelDd: mEl ? mEl.parentNode.textContent : '',
          fair: (B.querySelector('.glance-nums [data-glance-n="fair"]') || {}).textContent, projTh: th ? th.textContent : null,
          quiet: !!B.querySelector('.glance-nums dd.glance-q [data-glance-n="model"]'), marks: [...B.querySelectorAll('.glance-trial')].map(x => [x.textContent, x.title]), tableName: (B.querySelector('table.glance-t') || { getAttribute: () => '' }).getAttribute('aria-label') } : null;
        B.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20); }
      return { rows, sum, card, bub: bubs[pkey], bubs, words: pageWords() };
    };
    /* the builder emptied (as Clear ALL does) and p1's view opened again, its milestones shown, for a parlay of other legs */
    const builderAfresh = async () => { w.eval('M.slip.legs = []; M.bookPrice = null; saveMine(); renderParlay()');
      w.eval(`propsOpen(${JSON.stringify(p1.id)})`); await sleep(20); const sw = d.getElementById('ppRungs'); if (sw && !sw.checked) { sw.click(); await sleep(20); } };
    const EK = { hi: [p1.id, 'prop', '4432166', 'pts', 'mile', 3, 'yes'].join('|'), lo: [p1.id, 'prop', '3004', 'ast', 'mile', 15, 'yes'].join('|'), far: [p1.id, 'prop', '3001', 'reb', 'mile', 1, 'yes'].join('|'),
      band: [p1.id, 'prop', '3005', 'pts', 'main', 9.5, 'over'].join('|') };
    const edgeP = { hi: () => PJ.nbSf(3, muOf(rowsP['4432166'], 'pts'), PJ.nbVar(muOf(rowsP['4432166'], 'pts'), props8.dist.var.pts)), lo: () => PJ.nbSf(15, muOf(rowsP['3004'], 'ast'), PJ.nbVar(muOf(rowsP['3004'], 'ast'), props8.dist.var.ast)),
      far: () => PJ.nbSf(1, muOf(rowsP['3001'], 'reb'), PJ.nbVar(muOf(rowsP['3001'], 'reb'), props8.dist.var.reb)), band: () => PJ.pOver(9.5, muOf(rowsP['3005'], 'pts'), PJ.nbVar(muOf(rowsP['3005'], 'pts'), props8.dist.var.pts)) };
    const edgeF = { hi: () => PF.propFairRung(-50000, props8.fair.rung.a.pts), lo: () => PF.propFairRung(50000, props8.fair.rung.a.ast), far: () => PF.propFairRung(100, props8.fair.rung.a.reb), band: () => PF.propFairOver(-300, 257) };

    /* the builder on a FAIL, against the trial's (BT, read on the same legs above) and the view's rows as ticked */
    let BT = null;
    const holdBuilderFail = async (name, dec, vT, vR) => {
      const B = await builderRead(), r = B.rows[tatKey], q = B.rows[rungKey], tm = B.rows[homeKey(p1)], rM = rowsP['4065648'];
      const pO = PJ.pOver(tat.line, muOf(rM, 'pts'), PJ.nbVar(muOf(rM, 'pts'), props8.dist.var.pts)), fo = PF.propFairOver(tat.over, tat.under);
      const pR = PJ.nbSf(rung1.k, muOf(rM, rung1.stat), PJ.nbVar(muOf(rM, rung1.stat), props8.dist.var[rung1.stat])), fR = PF.propFairRung(rung1.price, props8.fair.rung.a[rung1.stat]);
      const failRow = (x, v, p, f, est) => x && v && x.fp === f && x.fpct === ppPct(f) && x.fpct === v.pct && x.est === est && x.est === v.est && x.conf && x.conf[0] === confOwn(f) && x.conf[0] === v.conf && x.conf[1] === confOwn(f).toUpperCase()
        && x.mark && x.mark[0] === 'failed trial' && x.mark[1] === failLegTitleOwn(dec) && x.mdl && x.mdl[0] === `props model ${ppPct(p)}` && x.mdl[1] === p && x.mdl[2] === mdlTitleOwn(dec) && x.nP === 1 && !x.legfair && !x.nodk;
      check(failRow(r, vT, pO, fo, false) && failRow(q, vR, pR, fR, true),
        `${name}: in the builder a player's leg leads with DraftKings' fair chance and its band, as his row in the view showed them (${r && r.fpct} ${r && r.conf && r.conf[1]}; the rung ${q && q.fpct} est. ${q && q.conf && q.conf[1]}), "failed trial" titled with why, and the props model's own small and muted ("${r && r.mdl && r.mdl[0]}")`);
      /* whose figure the lead is, seen and heard (the review of 6 November 2026: nothing on a phone or to a screen reader
         said the 40% was DraftKings', and "failed trial" sat right after it): labelled "fair" as a team row's fair chance
         is, said "DraftKings' fair chance" to a screen reader as the view says it, and the mark on the model's line, after
         the figure it is about */
      const failWords = (x, p, f, est) => x && x.fairLbl === 'fair' && x.markIn && x.heard === `DraftKings' fair chance${est ? ', est.' : ''}: ${ppPct(f)} ${confOwn(f).toUpperCase()} props model ${ppPct(p)} failed trial`;
      check(failWords(r, pO, fo, false) && failWords(q, pR, fR, true),
        `${name}: the lead figure is labelled "fair" and heard as DraftKings' fair chance, the "failed trial" mark on the muted model line after its figure ("${r && r.heard}" / "${q && q.heard}")`);
      /* no far-off-the-market flag on a player's leg after the FAIL, and no figure of the model's outside its muted line:
         its chance is DraftKings' own, which cannot be far off itself */
      const farBad = Object.entries(B.rows).filter(([k, x]) => /\|prop\|/.test(k) && (x.far || x.bare)).map(([k, x]) => `${k}: ${x.far || 'a bare model figure'}`);
      check(!farBad.length, `${name}: no player row in the builder wears "far off the market" or names the model's chance outside its muted line${farBad.length ? ': ' + farBad.join('; ') : ''}`);
      check(BT && tm && BT.rows[homeKey(p1)] && tm.html === BT.rows[homeKey(p1)].html, `${name}: the team leg's row is the trial's to the character`);
      const s0 = BT.sum, s1 = B.sum;
      /* the confidence box on the fair chance after the FAIL: the view's band (ppConf), the one each player row uses */
      const tierWant = s1.fair == null ? null : `${confOwn(s1.fair).toUpperCase()}confidence all 3 land, on the fair chance`;
      check(s1.fair === s0.fair && s1.model === s0.model && s1.pay === s0.pay && s1.tier === tierWant && s1.modelTxt === `model says ${(s1.model * 100).toFixed(1)}%, ${FAILED_SAY(2)}` && s1.fairAm && s1.fairAm[0] === amOwn(s1.fair) && s1.fairAm[1] === 'fair price for DraftKings’ fair chance',
        `${name}: the summary's fair chance, model chance and payout are the trial's, its confidence the view's band on the fair chance ("${s1.tier}"), its model line saying the player legs are the failed props model's ("${s1.modelTxt}"), and the fair price DraftKings' fair chance's (${s1.fairAm && s1.fairAm[0]})`);
      check(B.card[0] === BT.card[0] && B.card[1] === BT.card[1].replace('model (on trial) says', 'model says').replace(' · the price says', `, ${FAILED_SAY(2)} · the price says`),
        `${name}: the card's chance lines are the trial's, the model's line saying the same ("${B.card[1]}")`);
      check(B.bub && B.bub.dts.join() === 'Price,Fair,Model' && B.bub.quiet && B.bub.modelDd === `props model ${ppPct(pO)} failed trial` && B.bub.fair === ppPct(fo) && B.bub.projTh === 'Projected failed trial' && B.bub.marks.length === 2 && B.bub.marks.every(m => m[0] === 'failed trial' && /not shown to beat DraftKings’ closing lines, so its (chance is|projections are) for reference only$/.test(m[1])) && /failed its trial/.test(B.bub.tableName),
        `${name}: the player's matchup bubble leads with DraftKings' fair chance (${B.bub && B.bub.fair}), the props model's after it muted at the view's figure ("${B.bub && B.bub.modelDd}"), its marks "failed trial", each a word apart from what it marks ("${B.bub && B.bub.projTh}")`);
      const ot = B.words.search(/on trial/i);
      check(ot < 0, `${name}: no text, title or name anywhere on the page says "on trial"${ot >= 0 ? ` ("${B.words.slice(Math.max(0, ot - 100), ot + 30)}")` : ''}`);
      return B;
    };
    /* the builder's edges on a FAIL whose points milestones have their margin (the planted EDGE8): a leg at each clamp, its
       fair chance and the model's both ">99%" or both "<1%" in the builder row and its bubble, as the view's row prints
       them; a leg the model rates far above DraftKings' fair chance wearing no far-off flag; and a parlay of one leg whose
       fair chance is 72%, its row and its confidence box on one band (High), its words counted ("its player leg") */
    const holdEdges = async (name, dec) => {
      await builderAfresh(); const vw = {};
      for (const [k, pid] of [['hi', '4432166'], ['lo', '3004'], ['far', '3001']]) { openRow(pid); await sleep(5); vw[k] = viewSays(EK[k]); await tick(EK[k]); }
      const B = await builderRead(EK.hi, [EK.lo]);
      const bad = [];
      for (const k of ['hi', 'lo', 'far']) { const x = B.rows[EK[k]], p = edgeP[k](), f = edgeF[k](), v = vw[k];
        if (!x) { bad.push(`${k}: no row`); continue; }
        if (!(x.fp === f && x.fpct === ppPct(f) && v && x.fpct === v.pct && x.est && x.conf && x.conf[0] === confOwn(f) && x.mdl && x.mdl[0] === `props model ${ppPct(p)}` && x.mdl[1] === p && x.markIn && x.fairLbl === 'fair'))
          bad.push(`${k}: ${x.fpct} ${x.conf && x.conf[1]} "${x.mdl && x.mdl[0]}" where ${ppPct(f)} and "props model ${ppPct(p)}"`); }
      const hx = B.rows[EK.hi], lx = B.rows[EK.lo];
      check(!bad.length && edgeP.hi() > 0.995 && edgeF.hi() > 0.995 && edgeP.lo() < 0.005 && edgeF.lo() < 0.005 && hx && hx.fpct === '>99%' && hx.mdl[0] === 'props model >99%' && lx && lx.fpct === '<1%' && lx.mdl[0] === 'props model <1%',
        `${name}: at the clamps the builder prints each figure as the view does, DraftKings' fair chance and the props model's: ${hx && hx.fpct} and "${hx && hx.mdl && hx.mdl[0]}", ${lx && lx.fpct} and "${lx && lx.mdl && lx.mdl[0]}"${bad.length ? ': ' + bad.join('; ') : ''}`);
      const bh = B.bubs[EK.hi], bl = B.bubs[EK.lo];
      check(bh && bh.dts.join() === 'Price,Fair,Model' && bh.fair === '>99% est.' && bh.modelDd === 'props model >99% failed trial' && bl && bl.fair === '<1% est.' && bl.modelDd === 'props model <1% failed trial',
        `${name}: the matchup bubble prints them as the view and the builder do ("${bh && bh.fair}", "${bh && bh.modelDd}"; "${bl && bl.fair}", "${bl && bl.modelDd}"), never "100%" or "0%"`);
      const fx = B.rows[EK.far];
      check(fx && edgeP.far() - edgeF.far() >= 0.15 && !fx.far && !fx.bare,
        `${name}: a leg the props model rates ${Math.round(edgeP.far() * 100)}% against DraftKings' fair ${Math.round(edgeF.far() * 100)}% wears no "far off the market" flag in the builder, and names the model nowhere but its muted line${fx && fx.far ? ` ("${fx.far}")` : ''}`);
      /* one leg, fair 72%: High on the view's scale, MED on the builder's own */
      await builderAfresh(); openRow('3005'); await sleep(5); const vb = viewSays(EK.band); await tick(EK.band);
      const B1 = await builderRead(EK.band), x1 = B1.rows[EK.band], f1 = edgeF.band(), p1m = edgeP.band();
      check(x1 && vb && x1.fpct === '72%' && x1.fpct === vb.pct && x1.conf && x1.conf[1] === 'HIGH' && vb.conf === 'high' && B1.sum.fair === f1 && B1.sum.tier === 'HIGHconfidence all 1 land, on the fair chance' && bandOwn(f1)[1] === 'MED',
        `${name}: a parlay of one leg at DraftKings' fair chance 72% bands it once: its row "${x1 && x1.fpct} ${x1 && x1.conf && x1.conf[1]}", its confidence box "${B1.sum.tier}" (the builder's own scale would say ${bandOwn(f1)[1]})`);
      check(B1.sum.modelTxt === `model says ${(p1m * 100).toFixed(1)}%, ${FAILED_SAY(1)}` && B1.card[1] === `model says ${(p1m * 100).toFixed(1)}%, ${FAILED_SAY(1)} · the price says ${(100 / (1 + 100 / 300)).toFixed(1)}%`,
        `${name}: with one player leg the summary and the card say "its player leg", not "legs" ("${B1.sum.modelTxt}" / "${B1.card[1]}")`);
      return B;
    };
    /* a FAIL parlay with a player leg DraftKings gives no fair chance (a milestone on a stat whose margin is taken away)
       and a team leg: the leg's cell "no DraftKings chance", the model's muted with its mark; the summary "–", no fair
       chance and why, the model's line under it, no fair price and no confidence box, the note that there is none to
       show; the card the same, why first */
    const holdNoFair = async (name, dec, stat) => {
      const ml = PA.ladders.find(l => l.player === '4065648' && l.stat === stat), mk = [p1.id, 'prop', '4065648', stat, 'mile', ml.k, 'yes'].join('|'), rM = rowsP['4065648'];
      const pM = PJ.nbSf(ml.k, muOf(rM, stat), PJ.nbVar(muOf(rM, stat), props8.dist.var[stat]));
      await builderAfresh(); openRow('4065648'); await sleep(5); await tick(mk); await tick(homeKey(p1));
      const B = await builderRead(mk), x = B.rows[mk], m = B.sum.model;
      check(x && x.nodk && x.fp === null && x.mark && x.mark[0] === 'failed trial' && x.mark[1] === failLegTitleOwn(dec) && x.markIn && x.mdl && x.mdl[0] === `props model ${ppPct(pM)}` && x.mdl[1] === pM && x.mdl[2] === mdlTitleOwn(dec) && x.nP === 1 && !x.legfair && !x.bare
        && x.heard === `no DraftKings chance props model ${ppPct(pM)} failed trial`,
        `${name}: a player's leg with no DraftKings fair chance reads "${x && x.heard}" in the builder: no figure leads, the props model's muted with its mark`);
      check(B.sum.fair === null && Number.isFinite(m) && m > 0 && m < 1 && B.sum.heroTxt === `–no DraftKings fair chance: a leg has one price onlymodel says ${(m * 100).toFixed(1)}%, ${FAILED_SAY(1)}`
        && B.sum.modelTxt === `model says ${(m * 100).toFixed(1)}%, ${FAILED_SAY(1)}` && B.sum.fairAm && B.sum.fairAm[0] === '–' && B.sum.fairAm[1] === 'fair price for DraftKings’ fair chance' && B.sum.tier === null
        && B.sum.note === 'The fair chance needs both of DraftKings’ prices on every leg; one leg has one only, so there is none to show. The model’s chance under it is for reference only.',
        `${name}: its summary leads with no chance ("${B.sum.heroTxt}"), no fair price and no confidence box, and says there is none to show ("${B.sum.note}")`);
      check(B.card.length === 2 && B.card[0] === 'No fair chance: a leg has only one of DraftKings’ two prices' && new RegExp(`^model says ${(m * 100).toFixed(1).replace('.', '\\.')}%, ${FAILED_SAY(1)} · the price says [\\d.]+%$`).test(B.card[1]),
        `${name}: the card says why there is no fair chance first, the model's after it ("${B.card.join(' / ')}")`);
    };
    /* no decision: the trial's view, drawn by the same code (pbPropsOn true) */
    st = stOf(null); await openAll();
    check(w.eval('pbPropsOn()') === true && w.eval('ppFail()') === false && body().querySelector('.pp-trialtag') && /Model on trial/.test(body().querySelector('.lead-c .pp-ghl').textContent) && !body().querySelector('[data-pp-failtag], [data-pp-fail], td.mdl, .pp-mdl')
      && body().querySelector('details[data-pp-trial] summary').textContent === 'The props model is on trial: not yet shown to beat DraftKings, its chances are marked on trial wherever they show',
      'with no decision (the trial running) the view is the trial\'s: Model on trial, its on-trial note, no muted chance and no FAIL mark');
    openRow('4065648'); await sleep(5);
    const trialRows = [...body().querySelectorAll('[data-pp-body="4065648"] tr[data-pp-leg]')].map(t => t.dataset.ppLeg);
    { const trs = blockRows('4065648', 'pts').filter(t => t.classList.contains('mainline')), r = rowsP['4065648'];
      const fo = PF.propFairOver(tat.over, tat.under), pO = PJ.pOver(tat.line, muOf(r, 'pts'), PJ.nbVar(muOf(r, 'pts'), props8.dist.var.pts));
      check(trs.length === 2 && !rowDiff(trs[0], rowWant(`Over ${tat.line}`, pO, fo, false, tat.over)) && !rowDiff(trs[1], rowWant(`Under ${tat.line}`, 1 - pO, 1 - fo, false, tat.under))
        && body().querySelector('[data-pp-body="4065648"] [data-pp-trialln] .pb-trial').textContent === 'on trial' && body().querySelector('[data-pp-body="4065648"] [data-pp-stat="pts"] .mline').textContent === `DraftKings line ${tat.line}`,
        `and its rows are the trial's: the props model's chance as bar, percentage and band, "book N%" beside it, on the published lines; the heading "DraftKings line ${tat.line}", the NFL's words`); }
    const tickTrial = await tick(tatKey); const tickTrialR = await tick(rungKey);
    await tick(homeKey(p1));
    BT = await builderRead();
    { const r = BT.rows[tatKey], q = BT.rows[rungKey], tm = BT.rows[homeKey(p1)], rM = rowsP['4065648'];
      const pO = PJ.pOver(tat.line, muOf(rM, 'pts'), PJ.nbVar(muOf(rM, 'pts'), props8.dist.var.pts)), fo = PF.propFairOver(tat.over, tat.under);
      const pR = PJ.nbSf(rung1.k, muOf(rM, rung1.stat), PJ.nbVar(muOf(rM, rung1.stat), props8.dist.var[rung1.stat])), fR = PF.propFairRung(rung1.price, props8.fair.rung.a[rung1.stat]);
      const trialRow = (x, p, f, est) => x && x.p === p && x.pct === (p * 100).toFixed(0) + '%' && JSON.stringify(x.conf) === JSON.stringify(bandOwn(p)) && x.mark && x.mark[0] === 'on trial' && /^The props model is on trial/.test(x.mark[1])
        && x.legfair === `fair ${(f * 100).toFixed(0)}%${est ? ' est.' : ''}` && !x.mdl && x.fp === null && x.nP === 1;
      check(trialRow(r, pO, fo, false) && trialRow(q, pR, fR, true) && tm && !tm.mark && !tm.mdl && tm.nP === 1,
        `on trial, the builder draws a player's legs as before: the props model's chance and the builder's band, "on trial", "fair N%" under it (${r && r.pct} ${r && r.conf && r.conf[1]} on trial, ${r && r.legfair}; the rung ${q && q.pct}, ${q && q.legfair})`);
      check(BT.sum.modelTxt === `model says ${(BT.sum.model * 100).toFixed(1)}%, on trial` && BT.sum.fairAm && BT.sum.fairAm[0] === amOwn(BT.sum.model) && BT.sum.fairAm[1] === "fair price for the model's chance" && /^[A-Z0-9 %]+confidence all 3 land, on the fair chance$/.test(BT.sum.tier || ''),
        `and its summary as before: "${BT.sum.modelTxt}", the fair price for the model's chance (${BT.sum.fairAm && BT.sum.fairAm[0]}), the confidence on the fair chance`);
      check(BT.card.length === 2 && /^model \(on trial\) says [\d.]+% · the price says [\d.]+%$/.test(BT.card[1]) && BT.bub && BT.bub.dts.join() === 'Price,Model,Fair' && BT.bub.marks.length === 2 && BT.bub.marks.every(m => m[0] === 'on trial') && !BT.bub.quiet,
        `its card says the model's chance on trial ("${BT.card[1]}"), and the player's bubble gives Price, Model and Fair, the model marked on trial (${BT.bub && BT.bub.dts.join(', ')})`); }
    /* on the trial the far-off flag is as it was: a leg the model rates 15 points or more above DraftKings' fair chance
       wears it in the builder, the model's figure first, as before the FAIL */
    { await builderAfresh(); openRow('3001'); await sleep(5); await tick(EK.far);
      const B = await builderRead(EK.far), x = B.rows[EK.far], p = edgeP.far(), f = edgeF.far();
      check(x && x.far === `model ${Math.round(p * 100)}% · DraftKings ${Math.round(f * 100)}% est.: far off the market`,
        `on the trial a leg the model rates far above DraftKings' fair chance still wears its flag in the builder ("${x && x.far}")`); }
    check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
    /* a PASS moves nothing by itself: still the trial's view */
    st = stOf({ verdict: 'PASS', decidedAt: '2026-11-25T12:00Z', lines: 30000 }); await openAll();
    check(w.eval('pbPropsOn()') === true && body().querySelector('.pp-trialtag') && !body().querySelector('[data-pp-failtag], [data-pp-fail]'), 'a PASS draws the trial\'s view, Model on trial, no FAIL mark');
    /* an early FAIL, its words from made-up numbers, with the points milestones' margin taken away */
    const PLy = require('./props_ledger'), earlyMk = { at: PLy.EARLY_STOP.at, by: PLy.EARLY_STOP.by, why: PLy.EARLY_STOP.why };
    const decE = { verdict: 'FAIL', decidedAt: '2026-11-05T18:30Z', lines: 4567, games: 45, scores: { lines: 4567, logloss_diff: 0.0042, brier_diff: -0.0011 }, flat: { edge: 0.03, all: { bets: 300, won: 150, units: 12.4 } }, early: earlyMk };
    const smE = { lines: 4567, gradedGames: 45, scores: { lines: 4567, model: { logloss: 0.6901, brier: 0.2481 }, market: { logloss: 0.6859, brier: 0.2465 } } };
    st = stOf(decE, smE, 'pts'); await openAll();
    await holdFail('an early FAIL', decE, { ...props8.ledger.summary, ...smE }, 'pts');
    { openRow('4065648'); await sleep(5); const keys = [...body().querySelectorAll('[data-pp-body="4065648"] tr[data-pp-leg]')].map(t => t.dataset.ppLeg);
      check(trialRows.length > 2 && JSON.stringify(keys) === JSON.stringify(trialRows), `the FAIL's view offers Tatum the very lines the trial's does, in its order (${keys.length})`); }
    { const a = await tick(tatKey), b = await tick(rungKey);
      check(a.leg === tickTrial.leg && a.slip === tickTrial.slip && a.said === tickTrial.said && a.on && tickTrial.on && b.leg === tickTrialR.leg && b.slip === tickTrialR.slip && b.said === tickTrialR.said && b.on === tickTrialR.on,
        `ticking a FAIL row's box puts in your parlay exactly the leg the trial's view put in, at DraftKings' price and the read's time, and says so the same ("${a.said}" / "${b.said}")`); }
    { openRow('4065648'); await sleep(5); const vT = viewSays(tatKey), vR = viewSays(rungKey);
      await tick(homeKey(p1)); await holdBuilderFail('an early FAIL', decE, vT, vR); await holdNoFair('an early FAIL', decE, 'pts'); }
    /* a full-bar FAIL (no early stop): the bar's own words */
    const decB = { verdict: 'FAIL', decidedAt: '2026-11-25T12:00Z', lines: 30000 };
    const smB = { lines: 30000, gradedGames: 260, scores: { lines: 30000, model: { logloss: 0.69, brier: 0.249 }, market: { logloss: 0.68, brier: 0.244 } } };
    st = stOf(decB, smB); await openAll();
    await holdFail('a full-bar FAIL', decB, { ...props8.ledger.summary, ...smB });
    { openRow('4065648'); await sleep(5); const vT = viewSays(tatKey), vR = viewSays(rungKey);
      await tick(tatKey); await tick(rungKey); await tick(homeKey(p1)); await holdBuilderFail('a full-bar FAIL', decB, vT, vR); await holdEdges('a full-bar FAIL', decB); }
    /* the real ledger, its own decision and numbers, on this file's game */
    const RL = RP.ledger || LEDGER0;
    st = { ...st8, props: { ...props8, ledger: RL } }; await openAll();
    if (RL.decision && RL.decision.verdict === 'FAIL') { await holdFail('the real ledger', RL.decision, RL.summary);
      openRow('4065648'); await sleep(5); const vT = viewSays(tatKey), vR = viewSays(rungKey);
      await tick(tatKey); await tick(rungKey); await tick(homeKey(p1)); await holdBuilderFail('the real ledger', RL.decision, vT, vR); await holdEdges('the real ledger', RL.decision); }
    else check(w.eval('pbPropsOn()') === true && body().querySelector('.pp-trialtag') && !body().querySelector('[data-pp-fail]'), "the real ledger has no FAIL: the trial's view");
    /* the real state and the job's real lines.json: with the real ledger's FAIL (the early stop of 5 November 2026) every
       game the props model projects that is still to come opens on the FAIL's view, and every player line DraftKings has
       posted for it is drawn at its fair chance with the props model's beside it, worked out here from the real
       projections, prices and fair-chance rules (a stat whose milestones have no measured margin: no chance, said so).
       With no game to come (late at night, the off-season) there is nothing to hold */
    { const RD = RL.decision, realFail = !!(RD && RD.verdict === 'FAIL');
      let LJ = null; try { LJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'lines.json'), 'utf8')); } catch (e) { LJ = null; }
      JSONS = LJ ? [[/lines\.json/, LJ]] : [];
      ({ w, errors } = load('index.html', real)); await sleep(300); d = w.document;
      w.eval('pbLinesLoad()'); for (let i = 0; i < 60 && !w.eval('!!LINES || LINES_ERR'); i++) await sleep(20);
      const lay = RP.layout || [], comb = RP.combos || {}, atR = (r, k) => r[lay.indexOf(k)], muR = (r, k) => k in comb ? Math.round(comb[k].reduce((t, x) => t + atR(r, x), 0) * 100) / 100 : atR(r, k);
      const va = k => RP.dist && RP.dist.var && RP.dist.var[k], mtR = realFail ? mdlTitleOwn(RD) : '';
      const toCome = real.slate.filter(g => RP.games && RP.games[g.id] && g.status === 'scheduled' && Date.parse(g.tip) > Date.now() + 120e3);
      let nG = 0, nR = 0, nNo = 0; const bad = [];
      for (const g of toCome) {
        if (!(Date.parse(g.tip) > Date.now() + 60e3)) continue;
        w.eval(`propsOpen(${JSON.stringify(g.id)})`); await sleep(5);
        const pr = LJ && LJ.games && LJ.games[g.id] && LJ.games[g.id].props, words = sheetWords();
        if (realFail && (!body().querySelector('[data-pp-failtag]') || body().querySelector('[data-pp-failtag]').textContent !== FAIL_TAG || /on trial/i.test(words) || TAKES.test(words) || !body().querySelector('details[data-pp-fail]')))
          bad.push(`${g.id}: the FAIL's marks or words`);
        if (realFail && pr && (pr.mains.length || pr.ladders.length || pr.yes.length)) { nG++;
          const sw = d.getElementById('ppRungs'); if (!sw.checked) { sw.click(); await sleep(10); }
          const rg = RP.games[g.id].players;
          for (const pid of [...new Set(pr.mains.concat(pr.ladders, pr.yes).map(m => m.player))]) {
            openRow(pid); await sleep(3); const r = rg[pid];
            for (const m of pr.mains.filter(x => x.player === pid)) { if (!ORDER_OWN.includes(m.stat)) continue;
              const trs = blockRows(pid, m.stat).filter(t => t.classList.contains('mainline')), fo = PF.propFairOver(m.over, m.under), pO = r && va(m.stat) ? PJ.pOver(m.line, muR(r, m.stat), PJ.nbVar(muR(r, m.stat), va(m.stat))) : null;
              nR += 2; const b = trs.length !== 2 ? `${trs.length} rows` : failDiff(trs[0], failWant(`Over ${m.line}`, fo, false, pO, m.over, mtR)) || failDiff(trs[1], failWant(`Under ${m.line}`, 1 - fo, false, pO == null ? null : 1 - pO, m.under, mtR));
              if (b) bad.push(`${g.id} ${pid} ${m.stat}: ${b}`); }
            for (const st0 of ORDER_OWN) { const want = pr.ladders.filter(l => l.player === pid && l.stat === st0); if (!want.length) continue;
              const trs = blockRows(pid, st0).filter(t => t.classList.contains('rung'));
              if (trs.length !== want.length) { bad.push(`${g.id} ${pid} ${st0}: ${trs.length} rungs for ${want.length}`); continue; }
              trs.forEach((t, i) => { const l = want[i], f = PF.propFairRung(l.price, RP.fair.rung.a[st0]), pm = r && va(st0) ? PJ.nbSf(l.k, muR(r, st0), PJ.nbVar(muR(r, st0), va(st0))) : null; nR++; if (f == null) nNo++;
                const b = failDiff(t, failWant(`${l.k}+`, f, true, pm, l.price, mtR)); if (b) bad.push(`${g.id} ${pid} ${st0} ${l.k}+: ${b}`); }); }
            for (const y of pr.yes.filter(x => x.player === pid)) { const trs = blockRows(pid, y.market), f = PF.propFairRung(y.price, RP.fair.yes.a[y.market]), pk = r ? atR(r, y.market) : null; nR++;
              const b = trs.length !== 1 ? `${trs.length} rows` : failDiff(trs[0], failWant('Gets one', f, true, Number.isFinite(pk) ? pk : null, y.price, mtR)); if (b) bad.push(`${g.id} ${pid} ${y.market}: ${b}`); }
          }
        }
        w.eval('propsClose()');
      }
      check(!realFail || !bad.length, `on the real state${realFail ? ', whose ledger has the FAIL,' : ' (no FAIL in its ledger: nothing of the FAIL to hold)'} every game to come opens on the FAIL's view, and on the job's real lines.json each of its ${nR} player rows (${nG} games with lines; ${nNo} milestones with no measured margin, so no chance) is DraftKings' fair chance with the props model's small beside it, worked out here${bad.length ? ': ' + bad.slice(0, 2).join('; ') : ''}`);
      /* the builder on the real state: the first game to come with a player's main line priced both ways and its
         moneylines, its Over and the home side to win ticked by the view's own boxes, then held as above, on the real
         projections, prices and fair-chance rule */
      const gB = realFail ? toCome.find(g => { const e = LJ && LJ.games && LJ.games[g.id]; return Date.parse(g.tip) > Date.now() + 120e3 && e && e.ml && e.props && e.props.mains.some(m => RP.games[g.id].players[m.player] && ORDER_OWN.includes(m.stat) && va(m.stat) && Number.isFinite(m.over) && Number.isFinite(m.under)); }) : null;
      if (!gB) check(true, realFail ? 'the real state has no game to come with a priced main line and moneylines: the made-up FAILs above hold the builder' : 'the real ledger has no FAIL: the trial\'s builder is held above');
      else {
        const m = LJ.games[gB.id].props.mains.find(x => RP.games[gB.id].players[x.player] && ORDER_OWN.includes(x.stat) && va(x.stat) && Number.isFinite(x.over) && Number.isFinite(x.under)), r = RP.games[gB.id].players[m.player];
        const key = [gB.id, 'prop', m.player, m.stat, 'main', m.line, 'over'].join('|'), mk = [gB.id, 'ml', gB.home, ''].join('|');
        w.eval(`propsOpen(${JSON.stringify(gB.id)})`); await sleep(10); openRow(m.player); await sleep(5);
        const v = viewSays(key), fo = PF.propFairOver(m.over, m.under), pO = PJ.pOver(m.line, muR(r, m.stat), PJ.nbVar(muR(r, m.stat), va(m.stat)));
        await tick(key); await tick(mk);
        const B = await builderRead(key), x = B.rows[key], t = B.rows[mk];
        check(x && v && x.fp === fo && x.fpct === ppPct(fo) && x.fpct === v.pct && x.conf && x.conf[0] === confOwn(fo) && x.conf[0] === v.conf && x.mark && x.mark[0] === 'failed trial' && x.mark[1] === failLegTitleOwn(RD)
          && x.mdl && x.mdl[0] === `props model ${ppPct(pO)}` && x.mdl[1] === pO && !x.legfair && t && !t.mark && !t.mdl && t.nP === 1
          && x.fairLbl === 'fair' && x.markIn && x.heard === `DraftKings' fair chance: ${ppPct(fo)} ${confOwn(fo).toUpperCase()} props model ${ppPct(pO)} failed trial` && !x.far && !x.bare,
          `on the real state, ${r[0]}'s ${m.stat} Over ${m.line} in the builder: DraftKings' fair chance ${x && x.fpct} ${x && x.conf && x.conf[1]}, as his row in the view showed it, labelled and heard as DraftKings' ("${x && x.heard}"), "${x && x.mdl && x.mdl[0]}" muted with its mark, no far-off flag (the model ${Math.round(pO * 100)}% against ${Math.round(fo * 100)}%); the ${gB.home} to win as before`);
        check(B.sum.modelTxt === `model says ${(B.sum.model * 100).toFixed(1)}%, ${FAILED_SAY(1)}` && B.sum.fairAm && B.sum.fairAm[1] === 'fair price for DraftKings’ fair chance' && B.sum.fairAm[0] === amOwn(B.sum.fair)
          && B.sum.tier === `${confOwn(B.sum.fair).toUpperCase()}confidence all 2 land, on the fair chance`
          && new RegExp(`^model says [\\d.]+%, ${FAILED_SAY(1)} · the price says [\\d.]+%$`).test(B.card[1]) && B.bub && B.bub.dts.join() === 'Price,Fair,Model' && B.bub.modelDd === `props model ${ppPct(pO)} failed trial` && B.bub.fair === ppPct(fo) && B.words.search(/on trial/i) < 0,
          `and its summary, card and bubble the FAIL's ("${B.sum.modelTxt}" / "${B.card[1]}"), no "on trial" anywhere on the page${B.words.search(/on trial/i) >= 0 ? ` ("${B.words.slice(Math.max(0, B.words.search(/on trial/i) - 100), B.words.search(/on trial/i) + 30)}")` : ''}`);
      }
      check(errors.length === 0, 'the real state: nothing thrown' + (errors.length ? ': ' + errors.join(' | ') : '')); }
    /* the FAIL's phone rules: the muted chance wraps under its words, the est. on a line of its own */
    check(/\.pp-rungs \.mdl\{width:auto;white-space:normal;/.test(mediaRules(css8, 760)) && /\.pp-rungs \.mdl \.v\{display:block\}/.test(mediaRules(css8, 760)) && /\.pp-rungs \.pct em\{display:block;/.test(css8) && /white-space:nowrap/.test(ruleOf(css8, '.pp-rungs .mdl') || ''),
      'on a phone the muted chance wraps under its words ("props model" over "61%") and the est. sits under the percentage, so a row keeps to the card at 360');
    JSONS = []; }

  /* the real published state: every game's sheet draws */
  ({ w, errors } = load('index.html', real));
  await sleep(300); d = w.document;
  const withProj = real.slate.filter(g => RP.games && RP.games[g.id] && !(g.tip && Date.parse(g.tip) <= Date.now()) && g.status === 'scheduled');
  let realBad = [];
  for (const g of withProj) { w.eval(`propsOpen(${JSON.stringify(g.id)})`); await sleep(5);
    const ids = [...body().querySelectorAll('[data-pp-player]')].map(r => r.dataset.ppPlayer), t = body().textContent;
    if (!Object.keys(RP.games[g.id].players).every(pid => ids.includes(pid)) || /\bNaN\b|\bundefined\b/.test(t) || banned(t)) realBad.push(`${g.id}: ${ids.length} rows`);
    w.eval('propsClose()'); }
  check(!realBad.length, `on the real published state, every game the model projects opens with all its projections, no NaN or undefined (${withProj.length} games)${realBad.length ? ': ' + realBad.slice(0, 3).join('; ') : ''}`);
  /* the means the page prices a line on, its own ppMean, are the shadow ledger's open call to the digit, combos included */
  { const lg = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'props_shadow.json'), 'utf8')), lay = ['min'].concat(PJ.ALL, ['dd', 'td']), diff = [];
    let n = 0;
    for (const [gid, g] of Object.entries(RP.games || {})) { const c = lg.calls[gid]; if (!c || c.frozen) continue;
      for (const pid of Object.keys(g.players)) { const call = c.players[pid]; if (!call) continue; n++;
        const page = JSON.parse(w.eval(`JSON.stringify(${JSON.stringify(PJ.ALL)}.map(k => ppMean(ppRow(${JSON.stringify(gid)}, ${JSON.stringify(pid)}), k)))`));
        PJ.ALL.forEach((k, i) => { if (page[i] !== call[lay.indexOf(k)]) diff.push(`${gid} ${pid} ${k}: page ${page[i]}, call ${call[lay.indexOf(k)]}`); }); } }
    const calling = !(lg.decision && lg.decision.verdict === 'FAIL');       // once the bar has failed no call is made
    check(!Object.keys(RP.games || {}).length || !calling || (n > 0 && !diff.length), `the page's own means, combos included, are the shadow ledger's open calls to the digit (${n} players${calling ? '' : '; the bar failed, so no call is open'})${diff.length ? ': ' + diff.slice(0, 3).join('; ') : ''}`); }
  d.querySelector('#nav button[data-tab=record]').click(); await sleep(30);
  check(!d.getElementById('ppRecord') && !/shadow ledger|on trial/i.test(d.getElementById('tab-record').textContent), "the Record tab, the NHL hub's layout, carries no props ledger: its numbers are in the props sheet");
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
}

/* ---------- 9. Your parlay: player props and same-game legs (README "Same-game parlays") ----------
   The legs a visitor adds from a game's Player props after a press, the builder's same-game rule, the price and the
   chances worked out here on their own from data/corr.json and tools/corr.js (two legs of one game exactly, three by
   this file's own integration), the grading from the box scores by this file's own sums, the card and its share text,
   what is stored, a reload, a later press, a tip, and no Lock in, Bet Build, plan or suggestions on the tab. */
const CJ = require('./corr');
const PUB = require('./publish');
const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100);
const decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
const amOfDec = d => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
const fmtA = a => (a > 0 ? '+' : '') + a;
const pct1 = p => (p * 100).toFixed(p < 0.01 ? 2 : 1) + '%';
const cents = v => '$' + (Math.round(v * 100) / 100).toFixed(2);
/* P(z1 > t1, z2 > t2, z3 > t3) for standard normals with correlations R: z1 integrated out by Simpson's rule, the other
   two in closed form given z1 (tools/corr.js's bivariate normal) */
function tri(ps, R) {
  const t = ps.map(p => PJ.normInv(1 - p)), r12 = R[0][1], r13 = R[0][2], r23 = R[1][2];
  const s2 = Math.sqrt(1 - r12 * r12), s3 = Math.sqrt(1 - r13 * r13), rc = (r23 - r12 * r13) / (s2 * s3);
  const f = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * CJ.bvnUpper((t[1] - r12 * x) / s2, (t[2] - r13 * x) / s3, rc);
  const a = t[0], b = t[0] + 12, N = 6000, h = (b - a) / N; let sum = f(a) + f(b);
  for (let i = 1; i < N; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return sum * h / 3;
}
/* the same for four legs: z1 integrated out by Simpson's rule, the other three given z1 by tri's own reduction (their
   thresholds and correlations conditioned on z1), so a four-leg price has a reference of this file's own */
function quad4(ps, R, N = 400) {
  const t = ps.map(p => PJ.normInv(1 - p)), r = R[0], s = r.map(v => Math.sqrt(1 - v * v));
  const Rc = [1, 2, 3].map(j => [1, 2, 3].map(k => j === k ? 1 : (R[j][k] - r[j] * r[k]) / (s[j] * s[k])));
  const r12 = Rc[0][1], r13 = Rc[0][2], r23 = Rc[1][2], s2 = Math.sqrt(1 - r12 * r12), s3 = Math.sqrt(1 - r13 * r13), rc = (r23 - r12 * r13) / (s2 * s3);
  const inner = u => { const a = u[0], b = u[0] + 12, h = (b - a) / N;
    const f = y => Math.exp(-y * y / 2) / Math.sqrt(2 * Math.PI) * CJ.bvnUpper((u[1] - r12 * y) / s2, (u[2] - r13 * y) / s3, rc);
    let sum = f(a) + f(b); for (let i = 1; i < N; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2); return sum * h / 3; };
  const f = x => Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI) * inner([1, 2, 3].map(j => (t[j] - r[j] * x) / s[j]));
  const a = t[0], b = t[0] + 12, h = (b - a) / N; let sum = f(a) + f(b);
  for (let i = 1; i < N; i++) sum += f(a + i * h) * (i % 2 ? 4 : 2);
  return sum * h / 3;
}
let S9 = null;
async function builder() {
  console.log('9. Your parlay: player props and same-game legs');
  const FIX = path.join(ROOT, 'tools', 'fixtures');
  const rec = JSON.parse(fs.readFileSync(path.join(FIX, 'propbets_401909088.json'), 'utf8'));
  const sb20 = JSON.parse(fs.readFileSync(path.join(FIX, 'scoreboard_20261020.json'), 'utf8'));
  const CT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corr.json'), 'utf8')), HOLD = CT.hold.value, TOL3 = 2e-4;
  const CORR = PUB.corrState();
  check(CORR && CORR.hold === HOLD && JSON.stringify(CORR.rho) === JSON.stringify(CT.rho) && JSON.stringify(CORR.refused) === JSON.stringify(CT.refused.pairs), "publish.js carries data/corr.json's rho, refused pairs and hold into the state");
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8')), RP = real.props || {};
  const VAR0 = { pts: [7.2, 0.73], reb: [1.76, 0.88], ast: [1.3, 0.99], tpm: [1.23, 1.0], stl: [1.1, 0.98], blk: [1.25, 1.12], pra: [9.66, 0.67], pr: [8.17, 0.72], pa: [6.43, 0.78], ar: [2.7, 0.76], sb: [1.2, 0.97] };
  const players1 = { '4065648': ['Jayson Tatum', 'BOS', 'F', 30.4, 21.04, 8.66, 5.07, 2.76, 1.1, 0.42, 0.3838, 0.0384], '4432166': ['Cade Cunningham', 'DET', 'G', 31.5, 20.8, 4.48, 7.47, 2.08, 0.98, 0.58, 0.2551, 0.023],
    '3001': ['Bos Guard', 'BOS', 'G', 31.0, 12.8, 3.7, 4.0, 2.4, 1.0, 1.2, 0.03, 0] };
  const players2 = { '9000001': ['Lal Guard', 'LAL', 'G', 34.2, 25.3, 5.1, 6.2, 2.8, 1.1, 0.4, 0.21, 0.02], '9000002': ['Gsw Center', 'GSW', 'C', 30.0, 15.5, 11.8, 2.1, 0.2, 0.7, 1.9, 0.55, 0.01] };
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'], COMBO = { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
  const VAR = RP.dist && RP.dist.var ? RP.dist.var : VAR0;
  const q1 = og('BOS', 'DET', 3 * 3600e3, { espn: '401909088', line: -1.5, totalLine: 221.5, ml: { home: -115, away: -105 } });
  const q2 = og('LAL', 'GSW', 5 * 3600e3, { espn: '401900002', line: -2.5, totalLine: 230.5, ml: { home: -140, away: 120 } });
  const q3 = { ...og('PHI', 'CHA', 4 * 3600e3, { espn: '401900003' }), type: 'PRE' };
  /* the trial's ledger (no decision), whatever the published one says: this section holds the builder, the card and the
     same-game sums as they are on trial; section 8 holds them after the FAIL (holdBuilderFail) */
  const props9 = { onTrial: true, build: RP.build || '2026-10-15T09:09Z', asOf: RP.asOf || '2026-06-13', fitSeasons: '2023-2026', horizonGameDays: 5, minShown: 8, stats: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'],
    combos: COMBO, layout: LAY, dist: { kind: 'negative binomial', var: VAR }, fair: PJ.FAIR, ledger: RP.ledger ? { ...RP.ledger, decision: null } : null, research: RP.research || null,
    games: { [q1.id]: { tip: q1.tip, away: 'BOS', home: 'DET', players: players1 }, [q2.id]: { tip: q2.tip, away: 'LAL', home: 'GSW', players: players2 } } };
  /* Moved Wing: a rated player the hub's tables put on MIA, whom DraftKings prices in LAL at GSW (a trade the tables have
     not caught up with); 9000099: an athlete no table names */
  const movedWing = { id: '9000088', name: 'Moved Wing', pos: 'F', team: 'MIA', o: 0, d: 0, elo: 0, min: 20, games: 50, last: '2026-04-01', prior: 'raptor' };
  const st9 = S9 = { ...state, generated: tipIn(-3600e3), injuriesAsOf: state.today, props: props9, corr: CORR, boxes: { from: state.today, days: 7, line: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'], games: {} }, slate: [q1, q2, q3].map(g => JSON.parse(JSON.stringify(g))),
    players: [...(state.players || []), movedWing] };
  /* the scoreboard: q1 is the recorded opening-night answer (DraftKings' moneylines, spread and total with their
     betslip links) moved to its tip; q2 and q3 made in the same shape */
  const gw = (ev, oc) => `https://sportsbook.draftkings.com/gateway?s=__s__&wpsrc=413&wpcrn=BetSlipDeepLink&preurl=${encodeURIComponent(`https://sportsbook.draftkings.com/event/${ev}${oc ? `?outcomes=${oc}` : ''}`)}`;
  const nP = v => (v < 0 ? 'N' : 'P') + Math.round(Math.abs(v) * 100), sgnS = v => (v > 0 ? '+' : '') + v;
  const dkOdds = o => ({ provider: { id: '100', name: 'DraftKings' }, details: o.details, overUnder: o.total, spread: o.hl,
    moneyline: { home: { close: { odds: o.hml, link: { href: gw(o.ev, `0ML${o.mid}_1`) } } }, away: { close: { odds: o.aml, link: { href: gw(o.ev, `0ML${o.mid}_3`) } } } },
    pointSpread: { home: { close: { line: sgnS(o.hl), odds: o.hsp, link: { href: gw(o.ev, `0HC${o.mid}${nP(o.hl)}_1`) } } }, away: { close: { line: sgnS(-o.hl), odds: o.asp, link: { href: gw(o.ev, `0HC${o.mid}${nP(-o.hl)}_3`) } } } },
    total: { over: { close: { line: 'o' + o.total, odds: o.ov, link: { href: gw(o.ev, `0OU${o.mid}O${Math.round(o.total * 100)}_1`) } } }, under: { close: { line: 'u' + o.total, odds: o.un, link: { href: gw(o.ev, `0OU${o.mid}U${Math.round(o.total * 100)}_3`) } } } },
    link: { href: gw(o.ev) } });
  const ev1 = JSON.parse(JSON.stringify(sb20.events.find(e => String(e.id) === '401909088'))); ev1.date = q1.tip.slice(0, 16) + 'Z';
  const ev2 = espnEvent(q2, null); ev2.id = '401900002'; ev2.competitions[0].odds = [dkOdds({ ev: '34510099', mid: '85841599', details: 'GS -2.5', total: 230.5, hl: -2.5, hml: '-140', aml: '+120', hsp: '-110', asp: '-110', ov: '-112', un: '-108' })];
  const ev3 = espnEvent(q3, null); ev3.id = '401900003'; ev3.season.type = 1; ev3.competitions[0].odds = [dkOdds({ ev: '34510098', mid: '85841598', details: 'CHA -1.5', total: 225.5, hl: -1.5, hml: '-120', aml: '+100', hsp: '-110', asp: '-110', ov: '-110', un: '-110' })];
  const sb = {}; for (const [g, e] of [[q1, ev1], [q2, ev2], [q3, ev3]]) (sb[ymd(g.date)] = sb[ymd(g.date)] || { events: [] }).events.push(e);
  const page9 = (items, i = 1, n = 1) => ({ count: items.length, pageIndex: i, pageSize: items.length, pageCount: n, items });
  const q2Items = [ppItem(1, '9000001', 24.5, -115), ppItem(1, '9000001', 24.5, -105), ppItem(3, '9000002', 11.5, -110), ppItem(3, '9000002', 11.5, -110),
    ppItem(1, '9000099', 18.5, -110), ppItem(1, '9000099', 18.5, -110), ppItem(1, '9000088', 12.5, -105), ppItem(1, '9000088', 12.5, -115)];
  const q3Items = [ppItem(1, '7000001', 14.5, -110), ppItem(1, '7000001', 14.5, -110)];
  const propsAns = { '401909088': page9(rec.items), '401900002': page9(q2Items), '401900003': page9(q3Items) };
  let { w, errors, requests } = load('index.html', st9, { picks: {}, build: [], bank: { day: q1.date } }, espnStub(sb, () => 0, propsAns));
  await sleep(300);
  let d = w.document;
  const idle = async () => { await sleep(30); for (let i = 0; i < 1200 && d.getElementById('oddsBar').classList.contains('busy'); i++) await sleep(50); await sleep(50); };
  const body = () => d.getElementById('ppBody'), sheet = () => d.getElementById('ppBack');
  const open = g => { w.eval(`propsOpen(${JSON.stringify(g.id)})`); };
  const shut = () => w.eval('propsClose()');
  const slip = () => (JSON.parse(w.localStorage.getItem('nba_hub_2027') || '{}').slip || {}).legs || [];
  const say = () => d.getElementById('ppSlipSt').textContent;
  /* a line's box in the view (README "Player props"): his row opened first (one player open at a time), a milestone with
     Milestones on; a game line's in Game bets, the away side first */
  const openPl = pid => { const b = body().querySelector(`[data-pp-open="${pid}"]`); if (b && b.getAttribute('aria-expanded') !== 'true') b.click(); };
  const boxIn = (pid, stat, f) => { openPl(pid); return [...body().querySelectorAll(`[data-pp-body="${pid}"] [data-pp-stat="${stat}"] tr[data-pp-leg]`)].filter(f || (() => true)).map(tr => tr.querySelector('input[type=checkbox]')); };
  const main = (pid, stat, i) => boxIn(pid, stat, tr => tr.classList.contains('mainline'))[i];
  const rung = (pid, stat, k) => { const sw = d.getElementById('ppRungs'); if (!sw.checked) sw.click(); openPl(pid);
    const tr = [...body().querySelectorAll(`[data-pp-body="${pid}"] [data-pp-stat="${stat}"] tr.rung`)].find(r => r.querySelector('.thr').textContent.trim() === k + '+'); return tr && tr.querySelector('input'); };
  const yesB = (pid, m) => boxIn(pid, m)[0];
  const glB = (label, i) => { const g = S9.slate.find(x => x.id === ppOpenId()), team = i ? g.home : g.away;
    const trs = label === 'Total' ? [...body().querySelectorAll('[data-pp-total] tr[data-pp-leg]')] : [...body().querySelectorAll(`[data-pp-side="${team}"] tr[data-pp-leg]`)].filter(tr => tr.querySelector('.thr').textContent.startsWith(label === 'Moneyline' ? 'To win' : 'To cover'));
    const tr = label === 'Total' ? trs[i] : trs[0]; return tr && tr.querySelector('input'); };
  const ppOpenId = () => w.eval('ppOpen');
  const banned = t => /\bedge\b|model says/i.test(t);
  const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('\n');

  /* before a press: nothing to add */
  open(q1); await sleep(20);
  check(!body().querySelector('[data-sg-add]') && d.getElementById('ppSlipBar').hidden, 'before a press the sheet offers nothing to add, and its parlay bar is hidden');
  shut();
  d.getElementById('oddsBtn').click(); await idle();
  open(q1); await sleep(20);
  const P1 = PF.propParse(rec.items), e1 = w.NBA_PROPS.live()[q1.id], gl1 = w.NBA_SLIP.lines()[q1.id];
  /* every line DraftKings has is a box: each player's, his row opened in turn and Milestones on, and the game's six */
  d.getElementById('ppRungs').click(); await sleep(10);
  /* each box is named for its own row's leg in full (who, the bet, its line and side) at the very price its row shows:
     the leg the box adds (PP_OFFER, as drawn) held to its row's key, bet words and price cell */
  const nameBad = [];
  const namesHold = bx => bx.forEach(b => { const l = JSON.parse(w.eval(`JSON.stringify(PP_OFFER[${+b.dataset.sgAdd}])`)), tr = b.closest('tr'), price = tr.querySelector('.price').textContent.trim();
    const want = `Add to your parlay: ${w.eval(`slipWho(PP_OFFER[${+b.dataset.sgAdd}])`)}, ${w.eval(`slipWhat(PP_OFFER[${+b.dataset.sgAdd}])`)} at ${ppAm(l.odds)}`;
    const thr = tr.querySelector('.thr').textContent.trim(), bet = thr === 'Gets one' ? (l.stat === 'dd' ? 'Double-double' : 'Triple-double') : /^To win$/.test(thr) ? 'to win' : thr.replace(/^To cover /, '');
    if (b.getAttribute('aria-label') !== want || ppAm(l.odds) !== price || tr.dataset.ppLeg !== w.eval(`slipKey(PP_OFFER[${+b.dataset.sgAdd}])`) || !b.getAttribute('aria-label').includes(bet)) nameBad.push(`${b.getAttribute('aria-label')} (row ${thr} ${price})`); });
  const adds = [...body().querySelectorAll('[data-pp-gbets] [data-sg-add]')], perPl = [];
  namesHold(adds);
  for (const pid of [...new Set(P1.mains.concat(P1.ladders, P1.yes).map(m => m.player))]) { openPl(pid); await sleep(2);
    const bx = [...body().querySelectorAll(`[data-pp-body="${pid}"] [data-sg-add]`)], want = 2 * P1.mains.filter(m => m.player === pid).length + P1.ladders.filter(m => m.player === pid).length + P1.yes.filter(m => m.player === pid).length;
    if (bx.length !== want) perPl.push(`${pid}: ${bx.length} for ${want}`); namesHold(bx); adds.push(...bx); }
  d.getElementById('ppRungs').click(); await sleep(10);
  check(adds.length === 2 * P1.mains.length + P1.ladders.length + P1.yes.length + 6 && !perPl.length, `after a press every DraftKings line in the view is a box that adds it: each main line's Over and Under, each milestone (Milestones on), each double- and triple-double under its player, and the game's six lines in Game bets (${adds.length})${perPl.length ? ': ' + perPl.join('; ') : ''}`);
  check(adds.every(b => b.tagName === 'INPUT' && b.type === 'checkbox' && !b.disabled && b.getAttribute('tabindex') !== '-1' && /^Add to your parlay: /.test(b.getAttribute('aria-label')) && !b.checked),
    'each is a real checkbox, in the tab order, named for what it adds, not ticked');
  check(!nameBad.length && new Set(adds.map(b => b.getAttribute('aria-label'))).size === adds.length,
    `each box's name is its own row's leg in full, who, the bet, its line and side, at the price its row shows ("${adds[0] && adds[0].getAttribute('aria-label')}"), no two alike${nameBad.length ? ': ' + nameBad.slice(0, 2).join('; ') : ''}`);
  check(/\.pp-pick\{display:flex;align-items:center;justify-content:center;min-width:44px;min-height:44px/.test(css) && adds.every(b => b.closest('label.pp-pick') && w.getComputedStyle(b.closest('label.pp-pick')).minHeight === '44px' && w.getComputedStyle(b.closest('label.pp-pick')).minWidth === '44px') && /\.pp-rungs td\.pick\{width:44px/.test(css) && !(css.match(/td\.pick\{[^}]*width:(\d+)px|\.pp-pick\{[^}]*min-width:(\d+)px/g) || []).some(r => +r.match(/(\d+)px/)[1] < 44),
    "each sits in a 44px by 44px label, the NFL's box in its 44px cell, and no rule at any width narrows the cell or the label (jsdom lays nothing out: the rules and the computed style)");
  check(gl1 && gl1.ml && gl1.spread && gl1.total && gl1.ml.home.odds === -115 && gl1.ml.away.odds === -105 && gl1.spread.home.line === -1.5 && gl1.spread.home.odds === -108 && gl1.spread.away.odds === -112 && gl1.total.line === 221.5 && gl1.total.over.odds === -115 && gl1.total.under.odds === -105
    && gl1.ml.home.id === '0ML85841510_1' && gl1.ml.away.id === '0ML85841510_3' && gl1.spread.home.id === '0HC85841510N150_1' && gl1.spread.away.id === '0HC85841510P150_3' && gl1.total.over.id === '0OU85841510O22150_1' && gl1.total.under.id === '0OU85841510U22150_3' && gl1.event === '34510070',
    "the recorded answer's game lines read as ESPN has them: moneylines, spread and total with their two prices, each outcome's DraftKings id and the event");
  const glTxt = [...body().querySelectorAll('[data-pp-gbets] tr[data-pp-leg]')].map(tr => `${tr.closest('[data-pp-side]') ? tr.closest('[data-pp-side]').dataset.ppSide + ' ' : ''}${tr.querySelector('.thr').textContent.trim()} ${tr.querySelector('.price').textContent.trim()}`);
  check(JSON.stringify(glTxt) === JSON.stringify(['BOS To win -105', 'BOS To cover +1.5 -112', 'DET To win -115', 'DET To cover -1.5 -108', 'Over 221.5 -115', 'Under 221.5 -105'])
    && [...body().querySelectorAll('[data-pp-side] h4 .mline')].map(x => x.textContent).join('|') === 'book line +1.5|book line -1.5' && body().querySelector('[data-pp-total] h4 .mline').textContent === 'book line 221.5'
    && body().querySelector('[data-pp-glsrc]').textContent === `Lines: DraftKings', read from ESPN ${new Date(gl1.at).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' })} ET.`,
    `Game bets, the NFL's card: each team to win and to cover, then the total, at the press's prices, each heading's book line, and whose lines they are (${glTxt.join(' / ')})`);
  /* the Game bets card's chances: the Parlay Builder's (legModel, legFair), worked out here on their own: a moneyline the
     player model's win chance, a spread Phi((m + h) / sigma), a total the market's own, the band the NFL's */
  { const SIGg = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'sigma.json'), 'utf8')).sigma, SGg = require('./sigma'), m = q1.model, confOwn = p => { const r = Math.round(p * 100); return r >= 70 ? 'high' : r >= 45 ? 'med' : 'low'; };
    const want = [['BOS', 1 - m.pHome, -105, -115], ['BOS', SGg.Phi((m.spread + 1.5) / SIGg), -112, -108], ['DET', m.pHome, -115, -105], ['DET', SGg.Phi((-m.spread - 1.5) / SIGg), -108, -112], [null, imp(-115) / (imp(-115) + imp(-105)), -115, -105], [null, imp(-105) / (imp(-105) + imp(-115)), -105, -115]];
    const rows = [...body().querySelectorAll('[data-pp-gbets] tr[data-pp-leg]')], bad = rows.filter((tr, i) => { const [, p, o, x] = want[i], pc = tr.querySelector('.pct');
      return Math.abs(+pc.dataset.ppP - p) > 1e-12 || pc.textContent !== ppPct(p) || !tr.querySelector(`.pp-conf.${confOwn(p)}`) || (tr.querySelector('.fair') || {}).textContent !== `book ${ppPct(imp(o) / (imp(o) + imp(x)))}` || tr.querySelector('.pp-fill').style.width !== Math.max(2, p * 100).toFixed(0) + '%'; });
    const mg = [...body().querySelectorAll('[data-pp-side] [data-pp-margin]')].map(x => x.textContent);
    check(rows.length === 6 && !bad.length && JSON.stringify(mg) === JSON.stringify([`our margin ${m.spread > 0 ? '+' : ''}${m.spread.toFixed(1)}`, `our margin ${-m.spread > 0 ? '+' : ''}${(-m.spread).toFixed(1)}`]) && body().querySelector('[data-pp-total] .mpts').textContent === `model's points ${m.total.toFixed(1)}`,
      `each Game bets row's chance is the Parlay Builder's for that leg, worked out here (the moneyline the player model's, the spread at sigma ${SIGg}, the total the market's own), with the NFL's band and DraftKings' fair chance; each team's "our margin" and the total's "model's points" the board model's${bad.length ? ': rows ' + bad.map(tr => tr.dataset.ppLeg).join(', ') : ''}`); }
  /* the junk an answer can carry: a provider not DraftKings, a spread on another number than the line shown, links that
     are not DraftKings' or carry an id in another shape */
  { const r0 = { home_ml: '-115', away_ml: '-105', home_line: '-1.5', total: '221.5' }, x = JSON.parse(JSON.stringify(ev1));
    const G = (e, r = r0) => JSON.parse(JSON.stringify(w.NBA_SLIP.oddsGameLines(e, r)));
    x.competitions[0].odds[0].provider = { id: '58', name: 'ESPN BET' };
    const y = JSON.parse(JSON.stringify(ev1)); y.competitions[0].odds[0].pointSpread.home.close.line = '-2.5'; y.competitions[0].odds[0].pointSpread.away.close.line = '+2.5'; y.competitions[0].odds[0].total.over.close.link.href = 'https://example.com/?outcomes=0OU85841510O22150_1';
    y.competitions[0].odds[0].moneyline.home.close.link.href = gw('34510070', '0ML85841510_3');
    const gy = G(y);
    check(G(x) === null && !gy.spread && gy.total && gy.total.over.id === null && gy.total.under.id === '0OU85841510U22150_3' && gy.ml.home.id === null && gy.ml.away.id === '0ML85841510_3',
      "another book's odds give no game lines; a spread on another number than the line shown is not offered; a link off DraftKings or an id in the other side's shape gives no id");
    /* a total on another number than the line shown (both sides), or its Over and Under on two numbers */
    const z = JSON.parse(JSON.stringify(ev1)); z.competitions[0].odds[0].total.over.close.line = 'o222.5'; z.competitions[0].odds[0].total.under.close.line = 'u222.5';
    const z2 = JSON.parse(JSON.stringify(ev1)); z2.competitions[0].odds[0].total.under.close.line = 'u222.5';
    const gz = G(z), gz2 = G(z2);
    check(gz && !gz.total && gz.ml && gz.spread && gz.spread.home.line === -1.5 && gz2 && !gz2.total && gz2.ml && gz2.spread,
      "a total on another number than the line shown, or with its Over and Under on two numbers, is not offered; the game's moneylines and spread still are"); }

  /* adding: Tatum's points Over, then his rebounds Over (two stats of one player) */
  const tatPts = main('4065648', 'pts', 0); tatPts.focus(); tatPts.click(); await sleep(20);
  const tatNow = () => main('4065648', 'pts', 0);
  let legs = slip();
  const A = legs[0];
  check(legs.length === 1 && A.id === q1.id && A.kind === 'prop' && A.pid === '4065648' && A.name === 'Jayson Tatum' && A.team === 'BOS' && A.stat === 'pts' && A.mk === 'main' && A.line === 26.5 && A.side === 'over' && A.odds === -111 && A.other === -114 && A.at === e1.at && A.away === 'BOS' && A.home === 'DET',
    "a tap on Tatum's points Over puts that leg in your parlay, stored in the page's own key: the game, the player, his club, the stat, the line, the side, DraftKings' price as read (-111, the Under's -114 beside it) and the read's time");
  check(say() === 'Added: Jayson Tatum, Points Over 26.5 at -111.' && d.activeElement && d.activeElement.dataset.ppKey === tatPts.dataset.ppKey && d.activeElement.checked && d.activeElement.closest('tr').classList.contains('on'), `the sheet says so ("${say()}"), and the box, redrawn ticked (its row marked), keeps the focus`);
  const foot = () => d.getElementById('ppSlipSum').textContent;
  check(!d.getElementById('ppSlipBar').hidden && foot() === 'Your parlay: 1 leg, -111', `the sheet's foot shows your parlay, a single leg at DraftKings' price with no est. ("${foot()}")`);
  main('4065648', 'reb', 0).click(); await sleep(20);
  check(slip().length === 2 && slip()[1].stat === 'reb' && slip()[1].odds === -143, "his rebounds Over joins it: two stats of one player are allowed");
  /* the foot's same-game price, by this file's own sums: min(the prices multiplied, the hold over the copula's joint
     chance of the implied chances), marked est. */
  { const pl = (stat, side) => ({ game: q1.id, kind: stat, player: '4065648', team: 'BOS', side, home: 'DET' });
    const dec2 = Math.min(decOf(-111) * decOf(-143), HOLD / CJ.joint2(imp(-111), imp(-143), CJ.rhoFor(CT, pl('pts', 'over'), pl('reb', 'over'))));
    check(foot() === `Your parlay: 2 legs, ${fmtA(amOfDec(dec2))} est.`, `with two legs of one game the foot's price is the same-game estimate, marked est. ("${foot()}")`); }
  const refuse = async (btn, re, what) => { const n0 = slip().length, key = btn.dataset.ppKey; btn.click(); await sleep(20); const now = body().querySelector(`[data-pp-key="${key}"]`);
    check(slip().length === n0 && re.test(say()) && now && !now.checked, `${what} is refused with a plain reason, its box left unticked ("${say()}")`); };
  await refuse(main('4065648', 'pra', 0), /^Not added: Jayson Tatum's points over 26\.5 and pts \+ reb \+ ast share a part: DraftKings publishes no list of what it takes on one same-game ticket, so the builder takes one of them\.$/, "his points + rebounds + assists (it holds his points)");
  await refuse(rung('4065648', 'pts', 25), /^Not added: One leg per player per stat: Jayson Tatum already has Points Over 26\.5\.$/, 'his points 25+ milestone (one leg per player per stat)');
  await refuse(main('4065648', 'pts', 1), /^Not added: One leg per player per stat/, 'his points Under beside the Over');
  yesB('4432166', 'dd').click(); await sleep(20);
  check(slip().some(l => l.pid === '4432166' && l.stat === 'dd' && l.mk === 'yes' && l.side === 'yes' && l.odds === -108), "Cunningham's double-double joins (a Yes price)");
  await refuse(yesB('4432166', 'td'), /are one inside the other \(a triple-double is a double-double\)/, 'his triple-double beside his double-double');
  yesB('4432166', 'dd').click(); await sleep(20);
  check(!slip().some(l => l.pid === '4432166') && /^Taken out: Cade Cunningham, Double-double\.$/.test(say()), 'a second tap takes a leg out, and says so');
  glB('Total', 0).click(); await sleep(20);
  check(slip().length === 3 && slip()[2].kind === 'total' && slip()[2].side === 'over' && slip()[2].line === 221.5 && slip()[2].odds === -115 && slip()[2].other === -105 && slip()[2].dk === '0OU85841510O22150_1' && slip()[2].at === gl1.at, "the game's total Over joins, with its DraftKings id and the read's time");
  await refuse(glB('Total', 1), /^Not added: One total a game: your parlay already has Total Over 221\.5\.$/, 'the Under beside it');
  glB('Moneyline', 1).click(); await sleep(20);
  check(slip().length === 4 && slip()[3].kind === 'ml' && slip()[3].side === 'DET', "the Pistons' moneyline joins");
  await refuse(glB('Spread', 1), /^Not added: One side bet a game: your parlay already has Pistons to win\. The builder takes the moneyline or the spread of a game, on one team, not both\.$/, 'their spread beside it');
  await refuse(glB('Moneyline', 0), /^Not added: One side bet a game/, "the Celtics' moneyline beside it");
  glB('Moneyline', 1).click(); await sleep(20);
  check(slip().length === 3, 'and it comes out again');
  /* a milestone in your parlay stays in sight with Milestones off, as the NFL keeps a rung on its parlay shown */
  { const k = P1.ladders.find(l => l.player === '4432166' && l.stat === 'pts').k;
    rung('4432166', 'pts', k).click(); await sleep(20);
    d.getElementById('ppRungs').click(); await sleep(20); openPl('4432166');
    const rows = [...body().querySelectorAll('[data-pp-body="4432166"] tr.rung')];
    check(slip().length === 4 && !d.getElementById('ppRungs').checked && rows.length === 1 && rows[0].querySelector('.thr').textContent === `${k}+` && rows[0].querySelector('input').checked && body().querySelector('.pp-lnote') && /shown under its player even with Milestones off/.test(body().querySelector('.pp-lnote').textContent),
      `with Milestones off, the milestone in your parlay (Cunningham's ${k}+) is still shown under his points, ticked, and the view says why; no other rung is`);
    rows[0].querySelector('input').click(); await sleep(20);
    check(slip().length === 3 && !body().querySelector('[data-pp-body="4432166"] tr.rung') && !body().querySelector('.pp-lnote'), 'taken out, it goes from sight with the rest'); }
  check(!banned(body().textContent + d.getElementById('ppSlipBar').textContent), 'the sheet says neither "edge" nor "model says"');
  shut(); open(q3); await sleep(20);
  await refuse(main('7000001', 'pts', 0), /^Not added: Preseason games get no box score here, so a player leg on one could never be graded\.$/, 'a player leg on a preseason game');
  shut(); open(q2); await sleep(20);
  /* a player the hub places on neither club of the game goes alone in it: no table names 9000099, and the tables put Moved
     Wing on MIA. Each is taken on his own; another leg of the game beside him is refused, whichever comes first */
  for (const [pid, name, team] of [['9000099', 'ESPN athlete 9000099', ''], ['9000088', 'Moved Wing', 'MIA']]) {
    main(pid, 'pts', 0).click(); await sleep(20);
    const l = slip()[slip().length - 1];
    check(slip().length === 4 && l.id === q2.id && l.pid === pid && l.name === name && l.team === team && say() === `Added: ${name}, Points Over ${pid === '9000099' ? 18.5 : 12.5} at ${pid === '9000099' ? -110 : -105}.`,
      `${name}${team ? `, whom the tables put on ${team},` : ', whom no table names,'} is taken alone in LAL at GSW ("${say()}")`);
    await refuse(main('9000001', 'pts', 0), new RegExp(`^Not added: The hub cannot place ${name} on LAL or GSW, so his leg cannot be priced beside another of this game\\.$`), `Lal Guard's points beside ${name}`);
    main(pid, 'pts', 0).click(); await sleep(20);
  }
  main('9000001', 'pts', 0).click(); await sleep(20);
  legs = slip();
  check(legs.length === 4 && legs[3].id === q2.id && legs[3].odds === -115, "a leg of another game joins: Lal Guard's points Over");
  for (const [pid, name] of [['9000099', 'ESPN athlete 9000099'], ['9000088', 'Moved Wing']])
    await refuse(main(pid, 'pts', 0), new RegExp(`^Not added: The hub cannot place ${name} on LAL or GSW, so his leg cannot be priced beside another of this game\\.$`), `${name}'s points beside Lal Guard's`);
  shut();

  /* the price and the chances, worked out here */
  const desc = l => l.kind === 'prop' ? { game: l.id, kind: l.stat, player: l.pid, team: l.team, side: l.side, home: l.home } : { game: l.id, kind: { ml: 'win', spread: 'cover', total: 'over' }[l.kind], team: l.kind === 'total' ? '' : l.side, side: l.side, home: l.home };
  const rho = (a, b) => CJ.rhoFor(CT, desc(a), desc(b));
  const fairOf = l => l.kind === 'prop' ? (l.mk === 'main' ? (l.side === 'under' ? imp(l.odds) : 1 - imp(l.other)) : PF.propFairRung(l.odds, (l.mk === 'mile' ? PJ.FAIR.rung : PJ.FAIR.yes).a[l.stat])) : imp(l.odds) / (imp(l.odds) + imp(l.other));
  const muOf = (pl, k) => k in COMBO ? Math.round(COMBO[k].reduce((t, s) => t + pl[LAY.indexOf(s)], 0) * 100) / 100 : pl[LAY.indexOf(k)];
  /* the model's chance (README "Parlay Builder"): a moneyline the player model's win chance; a spread Phi((m + h) / sigma),
     m the side's expected margin and sigma research/sigma.json's; a total the market's own, its two prices in proportion */
  const SIG9 = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'sigma.json'), 'utf8')).sigma, SGM = require('./sigma');
  const modelOf = l => { const g = [q1, q2].find(x => x.id === l.id);
    if (l.kind === 'ml') return l.side === g.home ? g.model.pHome : 1 - g.model.pHome;
    if (l.kind === 'spread') return SGM.Phi(((l.side === g.home ? -g.model.spread : g.model.spread) + l.line) / SIG9);
    if (l.kind === 'total') return l.other == null ? 0.5 : imp(l.odds) / (imp(l.odds) + imp(l.other));
    if (l.kind !== 'prop') return null;
    const pl = (props9.games[l.id].players)[l.pid], mu = muOf(pl, l.stat); if (l.mk === 'yes') return pl[LAY.indexOf(l.stat)];
    if (l.mk === 'mile') return PJ.nbSf(l.k, mu, PJ.nbVar(mu, VAR[l.stat])); const o = PJ.pOver(l.line, mu, PJ.nbVar(mu, VAR[l.stat])); return l.side === 'under' ? 1 - o : o; };
  const joint = (ps, ls) => ps.length === 1 ? ps[0] : ps.length === 2 ? CJ.joint2(ps[0], ps[1], rho(ls[0], ls[1])) : (ps.length === 3 ? tri : quad4)(ps, ls.map(a => ls.map(b => a === b ? 1 : rho(a, b))));
  const groups = ls => { const m = new Map(); for (const l of ls) { if (!m.has(l.id)) m.set(l.id, []); m.get(l.id).push(l); } return [...m.values()]; };
  const mine = ls => { let dec = 1, prod = 1, fair = 1, model = 1;
    for (const g of groups(ls)) { const mult = g.reduce((t, l) => t * decOf(l.odds), 1); prod *= mult;
      const J = joint(g.map(l => imp(l.odds)), g); dec *= g.length > 1 ? Math.min(mult, HOLD / J) : mult;
      const F = joint(g.map(fairOf), g); fair *= F; const ms = g.map(modelOf); model = model == null || ms.some(m => m == null) ? null : model * joint(ms, g); }
    return { dec, prod, fair, model }; };
  const pagePrice = ls => JSON.parse(w.eval(`JSON.stringify(NBA_SLIP.slipPrice(${JSON.stringify(ls)}))`));
  /* two legs of one game, exactly: every kind of pair, Overs and Unders, a team's own side and the other's */
  const L = (stat, side, odds, other, x) => ({ id: q1.id, away: 'BOS', home: 'DET', date: q1.date, tip: q1.tip, kind: 'prop', pid: '4065648', name: 'Jayson Tatum', team: 'BOS', stat, mk: 'main', line: 9.5, side, odds, other, at: e1.at, ...x });
  const T = (kind, side, odds, other, line) => ({ id: q1.id, away: 'BOS', home: 'DET', date: q1.date, tip: q1.tip, kind, side, line, odds, other, at: e1.at });
  const cases = { 'his points Over and his rebounds Over': [L('pts', 'over', -111, -114, { line: 26.5 }), L('reb', 'over', -143, 109, { line: 8.5 })],
    'his points Over and his rebounds Under': [L('pts', 'over', -111, -114, { line: 26.5 }), L('reb', 'under', 109, -143, { line: 8.5 })],
    'his assists Under and his club to win': [L('ast', 'under', 113, -149, { line: 5.5 }), T('ml', 'BOS', -105, -115, null)],
    'his points Over and the other club to win': [L('pts', 'over', -111, -114, { line: 26.5 }), T('ml', 'DET', -115, -105, null)],
    'his threes Over and the total Under': [L('tpm', 'over', -160, 121, { line: 2.5 }), T('total', 'under', -105, -115, 221.5)],
    'his points 30+ and his double-double': [L('pts', 'yes', 146, null, { mk: 'mile', k: 30, line: undefined }), L('dd', 'yes', -114, null, { mk: 'yes', line: undefined })],
    'an opponent\'s points Over and his points Over': [L('pts', 'over', -111, -114, { line: 26.5 }), { ...L('pts', 'over', -104, -123, { line: 24.5 }), pid: '4432166', name: 'Cade Cunningham', team: 'DET' }],
    'the spread and the total': [T('spread', 'DET', -108, -112, -1.5), T('total', 'over', -115, -105, 221.5)] };
  let bad = [];
  for (const [name, ls] of Object.entries(cases)) { const p = pagePrice(ls), m = mine(ls);
    if (Math.abs(p.dec - m.dec) > 1e-9 || Math.abs(p.prod - m.prod) > 1e-9 || Math.abs(p.fair - m.fair) > 1e-9 || p.dec > p.prod + 1e-12 || !p.sg || !p.fairEst || (m.model == null ? p.model !== null : Math.abs(p.model - m.model) > 1e-9)) bad.push(`${name}: page ${p.dec.toFixed(4)}/${p.fair && p.fair.toFixed(4)}/${p.model}, here ${m.dec.toFixed(4)}/${m.fair.toFixed(4)}/${m.model}`); }
  check(!bad.length, `two legs of one game, ${Object.keys(cases).length} pairs (Overs and Unders, a player with his club and the other, the total, a milestone and a double-double, opponents, the spread and the total): the price is min(the prices multiplied, ${HOLD} / J) with J the copula of the implied chances at data/corr.json's rho, the fair chance the copula of DraftKings' fair chances, the model's the copula of its chances where every leg has one, to 1e-9, never above the product${bad.length ? ': ' + bad.slice(0, 3).join('; ') : ''}`);
  { const ls = cases['his points Over and his rebounds Over'], p = pagePrice(ls), m = mine(ls);
    console.log(`        (Tatum's points Over 26.5 -111 and rebounds Over 8.5 -143: legs multiplied ${fmtA(amOfDec(m.prod))}, same-game price ${fmtA(amOfDec(p.dec))} est., fair chance ${pct1(p.fair)} against ${pct1(fairOf(ls[0]) * fairOf(ls[1]))} multiplied)`); }
  /* the builder as it stands: three legs of one game (this file's integration) and one of another */
  legs = slip();
  const pb = pagePrice(legs), mb = mine(legs);
  check(Math.abs(pb.dec / mb.dec - 1) < TOL3 && Math.abs(pb.fair / mb.fair - 1) < TOL3 && pb.model != null && mb.model != null && Math.abs(pb.model / mb.model - 1) < TOL3 && pb.dec <= pb.prod && Math.abs(pb.prod - mb.prod) < 1e-9,
    `three legs of one game and one of another: the page's price ${pb.dec.toFixed(4)}, fair chance ${pb.fair.toFixed(5)} and model chance ${pb.model && pb.model.toFixed(5)} are this file's ${mb.dec.toFixed(4)}, ${mb.fair.toFixed(5)} and ${mb.model && mb.model.toFixed(5)} (its own integration, within ${TOL3 * 100}% of each other), under the product ${mb.prod.toFixed(4)}; the total's chance the market's own`);
  /* more sets of three and four legs of one game, priced one after another in the same page session, each against this
     file's own integration (tri, quad4): one player's three Overs at -110 each, then three legs at the very same implied
     chances but other relations (his points with his club's win and the Over; his points and threes with the Over; his
     points Over, rebounds Under and assists Over, held at the product; two opponents' points and the Under), four at
     -110 (his three Overs and the Over), four of every kind at their own prices, and four with a model chance each. A
     price kept from another set (a cache keyed by the chances alone), one leg's relation read for another's, or a fourth
     leg dropped, shows */
  { const cade = (stat, side, odds, other, x) => ({ ...L(stat, side, odds, other, x), pid: '4432166', name: 'Cade Cunningham', team: 'DET' });
    const TOL4 = 1e-3;
    const sets = {
      "his points, rebounds and assists Overs, -110 each": [L('pts', 'over', -110, -110, { line: 26.5 }), L('reb', 'over', -110, -110, { line: 8.5 }), L('ast', 'over', -110, -110, { line: 5.5 })],
      'his points Over, the Celtics to win and the total Over, -110 each': [L('pts', 'over', -110, -110, { line: 26.5 }), T('ml', 'BOS', -110, -110, null), T('total', 'over', -110, -110, 221.5)],
      'his points and threes Overs and the total Over, -110 each': [L('pts', 'over', -110, -110, { line: 26.5 }), L('tpm', 'over', -110, -110, { line: 2.5 }), T('total', 'over', -110, -110, 221.5)],
      "his points Over, rebounds Under and assists Over, -110 each (held at the product)": [L('pts', 'over', -110, -110, { line: 26.5 }), L('reb', 'under', -110, -110, { line: 8.5 }), L('ast', 'over', -110, -110, { line: 5.5 })],
      "two opponents' points Overs and the total Under, -110 each": [L('pts', 'over', -110, -110, { line: 26.5 }), cade('pts', 'over', -110, -110, { line: 24.5 }), T('total', 'under', -110, -110, 221.5)],
      'his three Overs and the total Over, -110 each': [L('pts', 'over', -110, -110, { line: 26.5 }), L('reb', 'over', -110, -110, { line: 8.5 }), L('ast', 'over', -110, -110, { line: 5.5 }), T('total', 'over', -110, -110, 221.5)],
      "his points Over, an opponent's rebounds Under, the Pistons to win and the total Over": [L('pts', 'over', -111, -114, { line: 26.5 }), cade('reb', 'under', 120, -150, { line: 4.5 }), T('ml', 'DET', -115, -105, null), T('total', 'over', -115, -105, 221.5)],
      "his points and assists Overs, an opponent's points Over and the Celtics to win": [L('pts', 'over', -111, -114, { line: 26.5 }), L('ast', 'over', 113, -149, { line: 5.5 }), cade('pts', 'over', -104, -123, { line: 24.5 }), T('ml', 'BOS', -105, -115, null)] };
    const bad3 = [], gaps = [];
    for (const [name, ls] of Object.entries(sets)) { const p = pagePrice(ls), m = mine(ls), tol = ls.length > 3 ? TOL4 : TOL3;
      const e = [Math.abs(p.dec / m.dec - 1), Math.abs(p.fair / m.fair - 1), m.model == null ? (p.model === null ? 0 : 1) : Math.abs(p.model / m.model - 1)]; gaps.push(Math.max(...e));
      if (e.some(x => !(x < tol)) || p.dec > p.prod + 1e-12 || Math.abs(p.prod - m.prod) > 1e-9 || !p.sg || !p.fairEst) bad3.push(`${name}: page ${p.dec.toFixed(4)}/${p.fair.toFixed(5)}/${p.model}, here ${m.dec.toFixed(4)}/${m.fair.toFixed(5)}/${m.model}`); }
    const d3 = Object.values(sets).slice(0, 3).map(ls => pagePrice(ls).dec);
    check(!bad3.length && d3[0] !== d3[1] && d3[1] !== d3[2] && d3[0] !== d3[2], `${Object.keys(sets).length} more sets of three and four legs of one game in one session (${Object.keys(sets).join('; ')}): each one's price, fair chance and model chance this file's own integration's (three legs within ${TOL3 * 100}%, four within ${TOL4 * 100}%; the largest gap ${(Math.max(...gaps) * 100).toFixed(4)}%), under the product, and the first three, at one set of implied chances, priced apart (${d3.map(x => fmtA(amOfDec(x))).join(', ')})${bad3.length ? ': ' + bad3.join('; ') : ''}`); }
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  /* the builder (README "Parlay Builder"), held to the same sums: DraftKings' fair chance first, the model's beside it,
     what the Bet amount returns at the same-game price, and each leg in the builder's order with its own numbers */
  const nick = t => w.eval(`TEAMS[${JSON.stringify(t)}][1]`);
  const keyOwn9 = l => l.kind === 'prop' ? [l.id, 'prop', l.pid, l.stat, l.mk, l.mk === 'main' ? l.line : l.mk === 'mile' ? l.k : '', l.side].join('|') : [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
  const nameOwn9 = l => l.kind === 'prop' ? l.name : l.kind === 'total' ? `${nick(l.away)} at ${nick(l.home)}` : nick(l.side);
  const ordOwn9 = ls => [...ls].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || nameOwn9(a).localeCompare(nameOwn9(b)) || (keyOwn9(a) < keyOwn9(b) ? -1 : keyOwn9(a) > keyOwn9(b) ? 1 : 0));
  const pct0 = v => (v * 100).toFixed(0) + '%', bd = () => d.getElementById('pbBuild');
  const hero = bd().querySelector('.pb-box.hero'), hm = hero && hero.querySelector('[data-model]');
  check(hero && hero.querySelector('[data-fair]').textContent === (pb.fair * 100).toFixed(1) + '%' && hero.querySelector('span').textContent === 'fair chance all 4 land, est.' && hm && Math.abs(+hm.dataset.model / mb.model - 1) < TOL3 && hm.textContent === `model says ${(pb.model * 100).toFixed(1)}%, on trial`,
    `the builder leads with DraftKings' fair chance of the whole parlay, est., the model's beside it, on trial ("${hero && hero.textContent.replace(/\s+/g, ' ').trim()}")`);
  const pay = bd().querySelector('[data-payout]');
  check(pay && Math.abs(+pay.dataset.payout - 20 * pb.dec) < 1e-9 && pay.textContent === cents(20 * pb.dec) && /est\.$/.test(pay.nextElementSibling.textContent),
    `what $20 returns at the same-game price, est. ("${pay && pay.parentNode.textContent}")`);
  const whyB = bd().querySelector('[data-sl-why]');
  check(whyB && whyB.textContent.startsWith(`Legs here share a game, so they are priced together rather than multiplied: multiplying them would say ${cents(20 * mb.prod)}`) && whyB.textContent.includes("DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together") && /untested on the NBA/.test(whyB.textContent),
    'with the why: what multiplying them would say, and the hold said untested');
  const ord9 = ordOwn9(legs), rowsB = [...bd().querySelectorAll('tr.legrow')];
  check(rowsB.length === 4 && rowsB.every((tr, i) => tr.dataset.pbRow === keyOwn9(ord9[i])), `its rows are the legs in the builder's order, the day and then the name (${ord9.map(nameOwn9).join(', ')})`);
  const tatRow = rowsB.find(tr => tr.dataset.pbRow === keyOwn9(legs[0]));
  check(tatRow && tatRow.querySelector('.pb-px').textContent.trim() === `-111 real · read ${w.eval(`oddsClock(${JSON.stringify(e1.at)})`)}` && tatRow.querySelector('[data-pb-p]').textContent === pct0(modelOf(legs[0])) && tatRow.querySelector('.legfair').textContent === `fair ${pct0(fairOf(legs[0]))}`
    && tatRow.querySelector('.pb-trial') && /Not on DraftKings’ slip yet: no betslip id in ESPN’s feed/.test(tatRow.textContent),
    `each row: DraftKings' price and its read time, the model's chance marked on trial, DraftKings' fair chance, and for a player's leg that it goes on DraftKings' slip by hand ("${tatRow && tatRow.textContent.replace(/\s+/g, ' ').trim()}")`);
  const totRow = rowsB.find(tr => /\|total\|/.test(tr.dataset.pbRow));
  check(totRow && !totRow.querySelector('.pb-trial') && !totRow.querySelector('.dkslip') && totRow.querySelector('[data-pb-p]').textContent === pct0(modelOf(legs.find(l => l.kind === 'total'))), "the total's row: the market's own chance, not on trial, and no slip line (it has DraftKings' betslip id)");
  /* the Top 50 lines are not moved by what is in the builder, and an Add there reads Added for a leg in it */
  const topKeys = () => JSON.stringify(w.getPbTop().rows.map(l => l.sk));
  const withL = topKeys(); w.eval('window.__s = M.slip.legs; M.slip.legs = []; render.parlay();'); const withoutL = topKeys(); w.eval('M.slip.legs = window.__s; delete window.__s; render.parlay();');
  const totAdd = d.querySelector(`#pbPanel [data-pb-leg="${keyOwn9(legs.find(l => l.kind === 'total'))}"]`);
  check(withL === withoutL && JSON.parse(withL).length > 0 && totAdd && totAdd.textContent === 'Added' && totAdd.getAttribute('aria-pressed') === 'true', 'the Top 50 lines are the same with legs in the builder and without, and the total in it reads Added there');
  /* the card on that parlay (app/parts/card.html, README "The parlay card"): the model's chance as the builder gives it,
     labelled on trial, and what the stake pays */
  const tx9 = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  d.getElementById('pFinish').click(); await sleep(20);
  { const pc2 = d.getElementById('pcBack'), ch = tx9(d.querySelector('#pcView .pc-chance')), mo = [...d.querySelectorAll('#pcView .pc-money b')].map(x => x.textContent);
    check(!pc2.hidden && ch.includes(`model (on trial) says ${pct1(pb.model)}`) && mo[1] === cents(20 * pb.dec),
      `its card shows the model's chance, ${pct1(pb.model)}, labelled on trial, and pays ${cents(20 * pb.dec)} on $20 to the cent (${ch} | ${mo.join(' / ')})`);
    pc2.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20); }
  { const lone = { id: q2.id, away: 'LAL', home: 'GSW', date: q2.date, tip: q2.tip, kind: 'prop', pid: '9000099', name: 'ESPN athlete 9000099', team: '', at: e1.at, stat: 'pts', mk: 'main', line: 18.5, side: 'over', odds: -110, other: -110 };
    w.eval(`PARLAY_CARD.from('smoke9', () => ({ legs: ${JSON.stringify([lone])}, kicker: 'A lone leg' })); PARLAY_CARD.open(PARLAY_CARD.fromTier('smoke9', 'x'))`); await sleep(20);
    const lines9 = [...d.querySelectorAll('#pcView .pc-chance > div')].map(tx9), small9 = [...d.querySelectorAll('#pcView .pc-chance small')].map(tx9);
    check(w.PARLAY_CARD.current().chance === null && !lines9.some(t => /model/i.test(t)) && small9.includes('No model chance: the props model does not project a player in it.'),
      `a leg on a player the props model does not project leaves a card no model chance, and it says why (${lines9.join(' / ')} | ${small9.join(' / ')})`);
    w.PARLAY_CARD.close(); }
  /* a stake typed into the builder, not the $20 every store in this section starts on, so a figure fixed at $20 cannot
     pass for the visitor's: the builder, the card, its Share text all follow it, and the panel's Bet amount with them */
  const STAKE = 37.5;
  { const inp = d.getElementById('pStake'); inp.value = '37.5'; inp.dispatchEvent(new w.Event('input', { bubbles: true })); inp.dispatchEvent(new w.Event('change', { bubbles: true })); await sleep(20);
    const pay2 = d.querySelector('#pbBuild [data-payout]');
    check(pay2 && Math.abs(+pay2.dataset.payout - STAKE * pb.dec) < 1e-9 && pay2.textContent === cents(STAKE * pb.dec) && +d.getElementById('pStake').value === STAKE && +d.getElementById('pbStake').value === STAKE,
      `a stake typed into the builder ($37.50) is the Bet amount: the builder returns ${cents(STAKE * pb.dec)} on it, the same-game price to the cent, and the panel's box says $37.50 too (${pay2 && pay2.textContent})`); }
  /* nothing from the read is stored but the legs added */
  const store = JSON.parse(w.localStorage.getItem('nba_hub_2027')), sj = JSON.stringify(store);
  check(store.stake === STAKE && store.slip.legs.length === 4 && !/4432166|Cunningham|mains|ladders|"yes"\s*:\s*\[|9000002|7000001|9000099|9000088|Moved Wing/.test(sj) && Object.keys(w.localStorage).filter(k => !/^nba_hub_2027(:tab)?$/.test(k)).length === 0 && dump(w.sessionStorage) && !Object.keys(dump(w.sessionStorage)).length,
    'storage holds the four legs added and the Bet amount typed, and nothing else from the read (no other line, player or price), in the one key');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* Finish: the card (app/parts/card.html), its legs in the builder's order */
  d.getElementById('pFinish').focus(); d.getElementById('pFinish').click(); await sleep(20);
  const pc = d.getElementById('pcBack'), pcs = d.getElementById('pcSheet'), card = w.NBA_SLIP.card();
  check(!pc.hidden && pcs.getAttribute('role') === 'dialog' && pcs.getAttribute('aria-modal') === 'true' && d.activeElement === d.getElementById('pcDownload'), 'Finish parlay opens the card, a dialog, the focus on Download image');
  const li = [...pc.querySelectorAll('#pcView .pc-legs li')], etT = iso => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  const whenT = iso => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET', mi = s => String(s).replace(/-/g, '−');
  const at9 = l => ord9.findIndex(x => keyOwn9(x) === keyOwn9(l)), iT = at9(legs[0]), iR = at9(legs[1]), iTot = at9(legs[2]), iL = at9(legs[3]);
  const hand9 = ord9.map((l, i) => l.kind === 'prop' ? i + 1 : null).filter(Boolean), handTxt = hand9.length === 1 ? `leg ${hand9[0]}` : `legs ${hand9.slice(0, -1).join(', ')} and ${hand9[hand9.length - 1]}`;
  check(legs[2].kind === 'total' && li.length === 4 && li.every((x, i) => x.querySelector('.pc-who').textContent === nameOwn9(ord9[i]))
    && li[iT].querySelector('.pc-lp').firstChild.textContent === '−111' && li[iT].querySelector('.pc-what').textContent === 'Over 26.5 points' && li[iT].querySelector('.pc-meta').textContent === `F · BOS v DET · ${whenT(q1.tip)}`
    && li[iTot].querySelector('.pc-what').textContent === 'Over 221.5 points' && li.every(x => x.querySelector('.pc-lp small').textContent === 'book'),
    `it lists each leg in the builder's order with its bet, its price (DraftKings', book) and its game and tip-off in Eastern (${li.map(tx9).join(' | ')})`);
  const miss9 = [...d.querySelectorAll('#pcDkNote li[data-pc-dkmiss]')];
  check(JSON.stringify(miss9.map(x => +x.dataset.pcDkmiss)) === JSON.stringify(hand9) && miss9.every(x => /: DraftKings’ player lines carry no betslip id in ESPN’s feed$/.test(x.textContent)),
    `each player leg is one to add by hand, with the reason, and the total is not (${miss9.map(tx9).join(' | ')})`);
  const dk = d.getElementById('pcDk');
  check(dk.getAttribute('href') === 'https://sportsbook.draftkings.com/?outcomes=0OU85841510O22150_1' && dk.getAttribute('target') === '_blank' && /noopener/.test(dk.getAttribute('rel')) && dk.textContent === 'Open 1 of 4 legs in DraftKings',
    `the betslip link opens the leg that has an id, the total, and the button says how many of the legs it opens (${dk.getAttribute('href')}, "${dk.textContent}")`);
  const note9 = tx9(d.querySelector('#pcDkNote p'));
  check(note9 === `DraftKings’ lines as read ${etT(gl1.at)}: Open in DraftKings opens 1 of the 4 legs as DraftKings had it then; a leg whose line DraftKings has moved or pulled since will not be on the slip, so check it before you bet.` && tx9(d.querySelectorAll('#pcDkNote p')[1]) === 'Add by hand:',
    `and says what it opens, dated by the read, and what to add by hand, never every leg ("${note9}")`);
  const ch9 = [...pc.querySelectorAll('#pcView .pc-chance > div')].map(tx9), sm9 = [...pc.querySelectorAll('#pcView .pc-chance small')].map(tx9);
  check(ch9[0] === `Fair chance all 4 land ${pct1(pb.fair)} (est.)` && ch9[1] === `model (on trial) says ${pct1(pb.model)} · the price says ${(100 / pb.dec).toFixed(1)}%`,
    `the card leads with DraftKings' fair chance, est., then the model's on trial and the price's (${ch9.join(' / ')})`);
  check(tx9(pc.querySelector('.pc-price')) === mi(fmtA(amOfDec(pb.dec))) && tx9(pc.querySelector('.pc-sub')).endsWith('estimated same-game price') && sm9.includes("DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together."),
    `its price is the builder's same-game price, said to be an estimate, with the why (${tx9(pc.querySelector('.pc-price'))}, ${tx9(pc.querySelector('.pc-sub'))})`);
  const mo9 = [...pc.querySelectorAll('#pcView .pc-money b')].map(x => x.textContent);
  check(JSON.stringify(mo9) === JSON.stringify(['$37.50', cents(STAKE * pb.dec), '+' + cents(STAKE * pb.dec - STAKE)]),
    `what the stake pays on the card is the Bet amount typed, $37.50, times the same-game price (held to this file's integration above), to the cent (${mo9.join(' / ')}; the legs multiplied would pay ${cents(STAKE * mb.prod)})`);
  let shared = null; w.navigator.share = async x => { shared = x; }; w.navigator.canShare = () => true;
  d.getElementById('pcLink').click(); await sleep(20);
  const tl = shared && shared.text.split('\n');
  check(shared && Object.keys(shared).sort().join() === 'text,title' && shared.title === `4-leg parlay ${fmtA(amOfDec(pb.dec))} (estimated same-game price)` && tl.includes('https://sportsbook.draftkings.com/?outcomes=0OU85841510O22150_1')
    && tl.includes(`${iT + 1}. Jayson Tatum: Over 26.5 points (-111)`) && tl.includes(`DraftKings betslip (opens 1 of the 4 legs as DraftKings had it; add ${handTxt} by hand):`) && tl.includes('Add by hand at DraftKings:')
    && tl.includes(`${iT + 1}. Jayson Tatum Over 26.5 points (no betslip id in ESPN’s feed)`) && tl.includes(`${iL + 1}. Lal Guard Over 24.5 points (no betslip id in ESPN’s feed)`) && !tl.some(x => new RegExp(`^${iTot + 1}\\. .*\\(no betslip`).test(x))
    && tl.includes(`Stake $37.50 · Pays ${cents(STAKE * pb.dec)}`) && tl[tl.length - 1] === 'demon-x13.github.io/nba-hub' && !/every leg|all 4 legs/.test(shared.text),
    'Share link sends a title and a text, no url field: each leg with its price, the betslip link alone on its line under what it opens, the player legs to add by hand with why, what the Bet amount typed ($37.50) pays to the cent, the site last');
  delete w.navigator.share; let copied = null; w.navigator.clipboard = { writeText: async t => { copied = t; } };
  d.getElementById('pcLink').click(); await sleep(20);
  check(copied === shared.text && /Link copied/.test(d.getElementById('pcMsg').textContent), 'with no share sheet the same text is copied, and the card says so');
  pc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20);
  check(pc.hidden && d.activeElement === d.getElementById('pFinish'), 'Escape closes it, the focus back on Finish parlay');
  check(card && w.PARLAY_CARD.linkText(card).title === shared.title, 'the card the page holds is the one shared');
  /* the betslip note is dated by the oldest read of the legs it opens: a parlay kept from two presses, as a reload finds
     it (the total read at this press, the other game's moneyline at one two hours before, put second so that neither
     the first leg's read nor the newest stands in for it) */
  { const tOld = new Date(Date.parse(gl1.at) - 2 * 3600e3).toISOString();
    const keepL = [{ id: q1.id, away: 'BOS', home: 'DET', date: q1.date, tip: q1.tip, kind: 'total', side: 'over', line: 221.5, odds: -115, other: -105, dk: '0OU85841510O22150_1', at: gl1.at },
      { id: q2.id, away: 'LAL', home: 'GSW', date: q2.date, tip: q2.tip, kind: 'ml', side: 'GSW', line: null, odds: -140, other: 120, dk: '0ML85841599_1', at: tOld }];
    const x = load('index.html', st9, { picks: {}, build: [], bank: { day: q1.date }, slip: { legs: keepL, stake: 20 } }, espnStub(sb, () => 0, propsAns));
    await sleep(300); const xd = x.w.document;
    xd.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
    xd.getElementById('pFinish').click(); await sleep(20);
    let sh = null; x.w.navigator.share = async v => { sh = v; }; x.w.navigator.canShare = () => true;
    xd.getElementById('pcLink').click(); await sleep(20);
    const note = tx9(xd.querySelector('#pcDkNote p'));
    check(etT(tOld) !== etT(gl1.at) && xd.getElementById('pcDk').getAttribute('href') === 'https://sportsbook.draftkings.com/?outcomes=0OU85841510O22150_1+0ML85841599_1' && xd.getElementById('pcDk').textContent === 'Open in DraftKings'
      && note.startsWith(`DraftKings’ lines as read ${etT(tOld)}: Open in DraftKings opens the 2 legs as DraftKings had them then;`) && sh && sh.text.split('\n').includes('DraftKings betslip (opens the 2 legs as DraftKings had them):')
      && sh.text.split('\n').includes(`DraftKings lines as read ${etT(tOld)}: a leg whose line DraftKings has moved or pulled since will not be on the slip, so check it before you bet`) && !espnReqs(x.requests).length,
      `two legs read at different presses: the card's note and the Share text date what the link opens by the older read, ${etT(tOld)}, not ${etT(gl1.at)} ("${note}")`);
    check(x.errors.length === 0, 'no script errors: ' + x.errors.join(' | ')); }

  /* there is no Lock in and no Bet Build any more: a parlay is finished as a card, saved nowhere */
  check(!d.getElementById('slLock') && !d.getElementById('bkBuild') && !d.getElementById('bkSlip') && !d.getElementById('bkPlan') && !d.getElementById('bkSuggest'), 'the builder has no Lock in, and the tab no Bet Build, plan or suggestions');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* a reload: the legs at their read prices, dated, and nothing read */
  const kept = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  ({ w, errors, requests } = load('index.html', st9, kept, espnStub(sb, () => 0, propsAns)));
  await sleep(300); d = w.document;
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const rr = [...d.querySelectorAll('#pbBuild tr.legrow')], rT = rr.find(tr => tr.dataset.pbRow === keyOwn9(kept.slip.legs[0]));
  check(rr.length === 4 && rT && rT.querySelector('.pb-px').textContent.trim() === `-111 real · read ${w.eval(`oddsClock(${JSON.stringify(e1.at)})`)}` && !espnReqs(requests).length && !Object.keys(w.NBA_PROPS.live()).length,
    'a reload keeps the legs at the prices they were added at, dated by their read, and reads nothing');
  open(q1); await sleep(20);
  check(!body().querySelector('[data-sg-add]') && !d.getElementById('ppSlipBar').hidden && /^Your parlay: 4 legs \(3 in this game\), [+-]\d+ est\.$/.test(foot()), `the sheet offers nothing to add before a press, and its foot shows your parlay, its same-game price est. ("${foot()}")`);
  shut();

  /* a later press: Tatum's points line has moved, his rebounds line is gone, the total's price has moved; the other
     game's props cannot be read */
  const moved = JSON.parse(JSON.stringify(rec.items));
  for (const it of moved) { const pid = /athletes\/(\d+)/.exec(it.athlete && it.athlete.$ref || '') ; if (!pid || pid[1] !== '4065648') continue;
    if (String(it.type && it.type.id) === '1' && it.current && it.current.target && it.current.target.value === 26.5) it.current.target.value = 27.5; }
  const pulled = moved.filter(it => !(String(it.type && it.type.id) === '3' && /athletes\/4065648/.test(it.athlete && it.athlete.$ref || '')));
  propsAns['401909088'] = page9(pulled); propsAns['401900002'] = 503;
  ev1.competitions[0].odds[0].total.over.close.odds = '-120'; ev1.competitions[0].odds[0].total.under.close.odds = '+100';
  const atLal = slip()[3].at;
  await sleep(1100);
  d.getElementById('oddsBtn').click(); await idle();
  const after = slip(), said = d.getElementById('slSaid') ? d.getElementById('slSaid').textContent : '';
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const said2 = d.getElementById('slSaid').textContent;
  check(after.length === 2 && after[0].kind === 'total' && after[0].odds === -120 && after[0].other === 100 && after[0].at === w.NBA_SLIP.lines()[q1.id].at && after[0].at > kept.slip.legs[2].at && after[1].pid === '9000001' && after[1].at === atLal && after[1].odds === -115,
    "the read takes the total's new price with its new time, takes out the two lines DraftKings moved or dropped, and keeps the leg whose game could not be read as it was");
  check(said2 === "Jayson Tatum, Points Over 26.5: moved to 27.5, so it left your parlay. Jayson Tatum, Rebounds Over 8.5: is not in DraftKings' lines at this read, so it left your parlay. BOS at DET, Total Over 221.5: now -120, was -115.",
    `and says so, once ("${said2}")`);
  check(/ Your parlay: 2 legs left it and 1 took a new price \(see the Parlay Builder\)\.$/.test(d.getElementById('propsSt').textContent), `the press's own status line says it in a word, on whatever tab ("${d.getElementById('propsSt').textContent}")`);
  open(q1); await sleep(20);
  { const dec = decOf(after[0].odds) * decOf(after[1].odds);
    check(foot() === `Your parlay: 2 legs (1 in this game), ${fmtA(amOfDec(dec))}`, `a leg in each of two games: the foot's price is their prices multiplied, with no est. ("${foot()}")`); }
  shut();
  d.querySelector('#pbBuild [data-drop]').click(); await sleep(20);
  check(d.getElementById('slSaid').textContent === '' && slip().length === 1, 'the next change clears what was said');
  /* a third press: DraftKings has taken down every player prop of the other game (ESPN's 404) */
  propsAns['401900002'] = 404;
  await sleep(1100);
  d.getElementById('oddsBtn').click(); await idle();
  check(!slip().length && d.getElementById('slSaid').textContent === 'Lal Guard, Points Over 24.5: is no longer posted (DraftKings lists no player props for the game at this read), so it left your parlay.',
    `a game whose props are no longer posted takes its legs out ("${d.getElementById('slSaid').textContent}")`);
  /* a tip: a leg leaves at its game's start */
  open(q1); await sleep(20);
  main('4432166', 'pts', 0).click(); await sleep(20);
  shut();
  check(slip().length === 1 && slip()[0].pid === '4432166', "Cunningham's points Over goes in");
  w.eval(`S.slate.find(g => g.id === ${JSON.stringify(q1.id)}).tip = ${JSON.stringify(new Date(Date.now() + 1200).toISOString())}`);
  await sleep(1500); w.eval('watch()'); await sleep(20);
  check(!slip().length && d.getElementById('slSaid').textContent === 'BOS at DET has tipped off: its leg left your parlay.', `a leg leaves your parlay at its game's tip, said once ("${d.getElementById('slSaid').textContent}")`);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* grading, by this file's own sums: yesterday's final, Celtics 110 Pistons 105 (a total of 215), its box score read;
     the day before's final, its box not read yet; and a final from three weeks back, past the state's box window, read
     from its season's box file */
  const ago = n => { const x = new Date(state.today + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
  const gidOf = (n, a, h) => `${state.season}_${ymd(ago(n))}_${a}_${h}`;
  const f1 = gidOf(1, 'BOS', 'DET'), f2 = gidOf(2, 'LAL', 'GSW'), f3 = gidOf(20, 'MIA', 'ORL');
  const tat = [30, 10, 5, 3, 1, 0];
  /* Bos Rim's double-double is his rebounds and blocks, Bos Thief's triple-double his points, rebounds and steals: on
     points, rebounds and assists alone neither gets there */
  const rim = [8, 12, 1, 0, 2, 10], thief = [20, 11, 3, 2, 10, 1];
  /* a game called off: in the slate as void (postponed), and one off every list two days past its date */
  const fv = gidOf(1, 'NYK', 'BKN'), fo = gidOf(3, 'CHI', 'MIL');
  const voidG = { ...fake(fv, ago(1), false), away: 'NYK', home: 'BKN', tip: ago(1) + 'T23:30:00Z', status: 'void' };
  const st10 = { ...state, slate: [voidG], record: [], finals: { [f1]: [110, 105], [f2]: [101, 99], [f3]: [100, 96] }, pending: [], corr: CORR, props: null,
    boxes: { from: ago(7), days: 7, line: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'], games: { [f1]: { '4065648': tat, '3001': [10, 2, 2, 1, 0, 0], '3002': rim, '3003': thief } } } };
  const P = (id, away, home, x) => ({ id, away, home, date: ago(id === f1 ? 1 : id === f2 ? 2 : 20), tip: ago(1) + 'T23:00:00Z', kind: 'prop', pid: '4065648', name: 'Jayson Tatum', team: away, mk: 'main', side: 'over', at: ago(1) + 'T15:00:00Z', ...x });
  const Tg = (id, kind, side, odds, other, line) => ({ id, away: 'BOS', home: 'DET', date: ago(1), tip: ago(1) + 'T23:00:00Z', kind, side, line, odds, other, at: ago(1) + 'T15:00:00Z' });
  const ptsO = P(f1, 'BOS', 'DET', { stat: 'pts', line: 26.5, odds: -111, other: -114 }), cadeA = P(f1, 'BOS', 'DET', { pid: '4432166', name: 'Cade Cunningham', team: 'DET', stat: 'ast', line: 9.5, odds: 109, other: -144 });
  const bosMl = Tg(f1, 'ml', 'BOS', -105, -115, null), tot = Tg(f1, 'total', 'over', -115, -105, 221.5);
  const reb10 = P(f1, 'BOS', 'DET', { stat: 'reb', line: 10, odds: -110, other: -110 }), rebU = P(f1, 'BOS', 'DET', { stat: 'reb', line: 10.5, side: 'under', odds: 120, other: -150 });
  const pts30 = P(f1, 'BOS', 'DET', { stat: 'pts', mk: 'mile', k: 30, side: 'yes', odds: 146, other: null, line: undefined }), dd = P(f1, 'BOS', 'DET', { stat: 'dd', mk: 'yes', side: 'yes', odds: -114, other: null, line: undefined });
  const td = P(f1, 'BOS', 'DET', { stat: 'td', mk: 'yes', side: 'yes', odds: 940, other: null, line: undefined });
  const lal = P(f2, 'LAL', 'GSW', { pid: '9000001', name: 'Lal Guard', team: 'LAL', stat: 'pts', line: 24.5, odds: -115, other: -105 });
  const old = P(f3, 'MIA', 'ORL', { pid: '777', name: 'Old Hand', team: 'MIA', stat: 'pts', line: 30.5, odds: 100, other: -120 });
  const old2 = P(f3, 'MIA', 'ORL', { pid: '778', name: 'Old Bench', team: 'MIA', stat: 'pts', line: 4.5, odds: -110, other: -110 });
  const bet = (id, legs, x) => ({ id, day: ago(1), type: legs.length > 1 ? 'parlay' : 'single', stake: 10, legs, ...x });
  /* one straight bet on every other stat the sheet offers, each worked out here from Tatum's box line by this file's own
     sums of the parts (a combo the sum of its stats): an Over, an Under, a push and a loss among them */
  const PARTS = { pts: [0], reb: [1], ast: [2], tpm: [3], stl: [4], blk: [5], pra: [0, 1, 2], pr: [0, 1], pa: [0, 2], ar: [2, 1], sb: [4, 5] };
  const kinds = [['pra', 'over', 44.5], ['pr', 'under', 40.5], ['pa', 'over', 35], ['ar', 'over', 15.5], ['sb', 'under', 1.5], ['tpm', 'over', 2.5], ['stl', 'over', 0.5], ['blk', 'over', 0.5]];
  const kindBets = kinds.map(([stat, side, line], i) => bet('k' + i, [P(f1, 'BOS', 'DET', { stat, side, line, odds: -110, other: -110 })]));
  const kindWant = Object.fromEntries(kinds.map(([stat, side, line], i) => { const v = PARTS[stat].reduce((t, j) => t + tat[j], 0);
    const r = v === line ? 'push' : (v > line) === (side === 'over') ? 'won' : 'lost'; return ['k' + i, [r, r === 'won' ? '$' + (10 * decOf(-110)).toFixed(2) : r === 'push' ? '$10.00' : '$0.00']]; }));
  /* the season's box file for the final three weeks back: every stat column a different number from every other on a row
     (Old Hand 31 points, 3 + 7 boards, 6 assists, 4 threes, 2 steals, 1 block; Old Big a triple-double; Old Rim a
     double-double of his rebounds and blocks, Old Thief a triple-double of his points, rebounds and steals), so a column
     read from the wrong place grades wrong; Old Bench did not play */
  const boxCsv = 'game_id,date,team,opp,home,player_id,name,pos,starter,min,fgm,fga,tpm,tpa,ftm,fta,orb,drb,ast,stl,blk,tov,pf,pm,pts,dnp\n'
    + `${f3},${ago(20)},MIA,ORL,0,777,Old Hand,G,1,36,11,20,4,9,5,8,3,7,6,2,1,0,5,4,31,0\n${f3},${ago(20)},MIA,ORL,0,779,Old Big,C,1,33,7,14,1,5,3,6,4,9,11,3,2,8,0,-2,18,0\n`
    + `${f3},${ago(20)},MIA,ORL,0,780,Old Rim,C,1,30,4,13,0,2,1,8,5,7,6,3,11,9,4,-15,9,0\n${f3},${ago(20)},MIA,ORL,0,781,Old Thief,G,1,35,5,15,3,7,8,13,2,9,4,10,1,0,6,12,21,0\n`
    + `${f3},${ago(20)},MIA,ORL,0,778,Old Bench,G,0,0,,,,,,,,,,,,,,,,1\n`;
  FILES = [[new RegExp(`data/box_${state.season}\\.csv$`), boxCsv]];
  /* the file's lines by this file's own reading of it (rebounds the offensive and defensive boards), and on each of Old
     Hand and Old Big a straight bet on every stat at a whole line at its own sum, so only the exact value pushes, and
     his double- and triple-double */
  const csvLine = (() => { const ls = boxCsv.trim().split('\n'), h = ls.shift().split(','), o = {};
    for (const ln of ls) { const v = ln.split(','), at = k => +v[h.indexOf(k)]; if (at('dnp') === 1) continue;
      o[v[h.indexOf('player_id')]] = { pts: at('pts'), reb: at('orb') + at('drb'), ast: at('ast'), tpm: at('tpm'), stl: at('stl'), blk: at('blk') }; }
    return o; })();
  const fileBets = [], fileWant = {};
  for (const [pid, name] of [['777', 'Old Hand'], ['779', 'Old Big'], ['780', 'Old Rim'], ['781', 'Old Thief']]) { const bx = csvLine[pid];
    for (const k of ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb']) { const v = (COMBO[k] || [k]).reduce((t, x) => t + bx[x], 0), id = `f${pid}${k}`;
      fileBets.push(bet(id, [P(f3, 'MIA', 'ORL', { pid, name, team: 'MIA', stat: k, line: v, odds: -110, other: -110 })])); fileWant[id] = ['push', '$10.00']; }
    for (const [k, need, odds] of [['dd', 2, 150], ['td', 3, 900]]) { const won = ['pts', 'reb', 'ast', 'stl', 'blk'].filter(x => bx[x] >= 10).length >= need, id = `f${pid}${k}`;
      fileBets.push(bet(id, [P(f3, 'MIA', 'ORL', { pid, name, team: 'MIA', stat: k, mk: 'yes', side: 'yes', odds, other: null, line: undefined })])); fileWant[id] = won ? ['won', '$' + (10 * decOf(odds)).toFixed(2)] : ['lost', '$0.00']; } }
  /* a double- and a triple-double reached through blocks and steals; a same-game parlay with a player's leg on a whole
     line that pushes, and one with the total pushing (215 on 215); a player's leg on the game postponed in the slate, one
     on the game off every list, and a parlay with the latter beside a winner of another game */
  const rimDd = P(f1, 'BOS', 'DET', { pid: '3002', name: 'Bos Rim', stat: 'dd', mk: 'yes', side: 'yes', odds: 250, other: null, line: undefined });
  const thiefTd = P(f1, 'BOS', 'DET', { pid: '3003', name: 'Bos Thief', stat: 'td', mk: 'yes', side: 'yes', odds: 900, other: null, line: undefined });
  const pts30w = P(f1, 'BOS', 'DET', { stat: 'pts', line: 30, odds: -110, other: -110 }), reb85 = P(f1, 'BOS', 'DET', { stat: 'reb', line: 8.5, odds: -143, other: 109 }), tot215 = Tg(f1, 'total', 'over', -110, -110, 215);
  const vLeg = P(fv, 'NYK', 'BKN', { pid: '5001', name: 'Nyk Wing', team: 'NYK', stat: 'pts', line: 18.5, odds: -110, other: -110, date: ago(1) });
  const oLeg = P(fo, 'CHI', 'MIL', { pid: '5002', name: 'Chi Wing', team: 'CHI', stat: 'reb', line: 6.5, odds: -120, other: 100, date: ago(3) });
  const mine10 = { picks: {}, slip: { legs: [], stake: 20 }, build: [
    bet('g1', [ptsO, cadeA, bosMl], { sg: true, dec: 9.99 }), bet('g2', [ptsO, reb10, tot], { sg: true, dec: 9.99 }), bet('g3', [pts30, dd], { sg: true, dec: 3.21 }),
    bet('g4', [td]), bet('g5', [reb10]), bet('g6', [rebU]), bet('g7', [lal]), bet('g8', [old]), bet('g9', [ptsO, old]), bet('g10', [old2]),
    bet('g11', [rimDd]), bet('g12', [thiefTd]), bet('g13', [pts30w, reb85, bosMl], { sg: true, dec: 9.99 }), bet('g14', [tot215, ptsO], { sg: true, dec: 9.99 }),
    bet('g15', [vLeg]), bet('g16', [oLeg]), bet('g17', [oLeg, ptsO]), ...kindBets, ...fileBets ] };
  ({ w, errors, requests } = load('index.html', st10, mine10));
  await sleep(300); d = w.document;
  /* the Bet Build is drawn no more (README "Parlay Builder"): its bets stay in the visitor's storage, and each is graded
     by the page's own settlement, NBA_GRADE.gradeBet, the one X Parlays grades by. The first look asks for the season's
     box file, for the legs older than the state's window */
  const gradeAll = () => Object.fromEntries(JSON.parse(w.eval('JSON.stringify(M.build.map(b => [b.id, NBA_GRADE.gradeBet(b)]))')));
  gradeAll(); await sleep(150);
  const G9 = gradeAll(), st = id => G9[id] ? (G9[id].st === 'pending' ? 'open' : G9[id].st) : '?', ret = id => G9[id] ? (G9[id].ret == null ? '–' : cents(G9[id].ret)) : '?';
  const m2 = (a, b) => Math.min(decOf(a.odds) * decOf(b.odds), HOLD / CJ.joint2(imp(a.odds), imp(b.odds), rho(a, b)));
  const want0 = { g1: ['won', '$' + (10 * m2(ptsO, bosMl)).toFixed(2)], g2: ['lost', '$0.00'], g3: ['won', '$32.10'], g4: ['lost', '$0.00'], g5: ['push', '$10.00'], g6: ['won', '$' + (10 * decOf(120)).toFixed(2)],
    g7: ['open', '–'], g8: ['won', '$20.00'], g9: ['won', '$' + (10 * decOf(-111) * 2).toFixed(2)], g10: ['void', '$10.00'], ...kindWant };
  const cats = l => [0, 1, 2, 4, 5].filter(i => l[i] >= 10).length;            // points, rebounds, assists, steals, blocks at 10 or more
  const wantX = { g11: cats(rim) >= 2 ? ['won', cents(10 * decOf(250))] : ['lost', '$0.00'], g12: cats(thief) >= 3 ? ['won', cents(10 * decOf(900))] : ['lost', '$0.00'],
    g13: ['won', cents(10 * m2(reb85, bosMl))], g14: ['won', cents(10 * decOf(-111))], g15: ['void', '$10.00'], g16: ['void', '$10.00'], g17: ['won', cents(10 * decOf(-111))] };
  const want = { ...want0, ...fileWant, ...wantX };
  const got = Object.fromEntries(Object.keys(want).map(k => [k, [st(k), ret(k)]]));
  bad = Object.keys(want0).filter(k => JSON.stringify(want[k]) !== JSON.stringify(got[k]));
  check(!bad.length, `each bet graded from the box scores by this file's sums: a void leg (Cunningham, not in the box) dropped and the same-game parlay priced again on the two left (${want.g1[1]}), a lost total, a push on a whole line, a milestone and a double-double at the price locked, a triple-double short, an Under, a final whose box is not read waiting, one from three weeks back read from its season's box file, and a straight bet on every other stat (${kinds.map(([k, s, l], i) => `${k} ${s} ${l} ${got['k' + i][0]}`).join(', ')})${bad.length ? ': ' + bad.map(k => `${k} ${got[k]} want ${want[k]}`).join('; ') : ''}`);
  const badX = Object.keys(wantX).filter(k => JSON.stringify(want[k]) !== JSON.stringify(got[k]));
  check(!badX.length && cats(rim) === 2 && cats(thief) === 3, `by this file's sums: a double-double of rebounds and blocks (${got.g11.join(' ')}) and a triple-double of points, rebounds and steals (${got.g12.join(' ')}); a same-game parlay with a player's whole line pushing paid at the same-game price of the two legs left (${got.g13.join(' ')}, want ${wantX.g13[1]}) and one with the total pushing at the leg left's own price (${got.g14.join(' ')}); a player's leg on a game postponed in the slate and on one off every list two days past its date void with the stake back (${got.g15.join(' ')}, ${got.g16.join(' ')}), and dropped from a parlay (${got.g17.join(' ')})${badX.length ? ': ' + badX.map(k => `${k} ${got[k]} want ${want[k]}`).join('; ') : ''}`);
  const badF = Object.keys(fileWant).filter(k => JSON.stringify(want[k]) !== JSON.stringify(got[k]));
  check(!badF.length, `from the season's box file, by this file's own reading of it: Old Hand's, Old Big's, Old Rim's and Old Thief's points, rebounds (both boards), assists, threes, steals, blocks and the five combos each push at their own sum, so each column is read from its own place, and their double- and triple-doubles (${Object.keys(fileWant).filter(k => /(dd|td)$/.test(k)).map(k => `${k.slice(1, 4)} ${k.slice(4)} ${got[k][0]}`).join(', ')})${badF.length ? ': ' + badF.map(k => `${k} ${got[k]} want ${want[k]}`).join('; ') : ''}`);
  const csvReq = requests.filter(x => /data\/box_\d{4}\.csv/.test(x.url));
  check(csvReq.length === 1 && csvReq[0].opt && csvReq[0].opt.cache === 'no-store', `the season's box file is read once, no-store, for the legs older than the state's window (${csvReq.length})`);
  check(!d.getElementById('bkBuild') && JSON.parse(w.localStorage.getItem('nba_hub_2027')).build.length === mine10.build.length, "the Bet Build this browser kept is not drawn, and stays in its storage as it was");
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  FILES = [];
  /* the page's copies of tools/corr.js and tools/props.js */
  const pageSrc = fs.readFileSync(pageFile('index.html'), 'utf8'), corrSrc = fs.readFileSync(path.join(ROOT, 'tools', 'corr.js'), 'utf8'), pjSrc = fs.readFileSync(path.join(ROOT, 'tools', 'props.js'), 'utf8');
  for (const [file, src, names] of [['corr.js', corrSrc, ['TEAM', 'GL', 'TWOPI', 'bvnUpper', 'joint2', 'sgn', 'isGameKind', 'rhoFor']], ['props.js', pjSrc, ['normCdf', 'normInv']]]) {
    const diff = names.filter(n => { const a = srcOf(src, n), b = srcOf(pageSrc, n); return !a || a !== b; });
    check(!diff.length, `the page's ${names.join(', ')} are tools/${file}'s, line for line${diff.length ? `: differ: ${diff.join(', ')}` : ''}`); }
}

/* ---------- 10. the rating over time ---------- */
async function ratingHistory() {
  console.log('10. the rating over time (history.json, the 7d columns and the window)');
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const HJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'history.json'), 'utf8'));
  const PJ = JSON.parse(fs.readFileSync(path.join(ROOT, 'players.json'), 'utf8'));
  const RAW = PJ.history;
  check(HJ.v === 1 && RAW && Array.isArray(RAW.games), 'history.json and players.json history are there');
  check(JSON.stringify(HJ.games) === JSON.stringify(RAW.games), 'history.json carries players.json\'s games list');

  /* the ladders worked out here: today's from the ranked rows and the model's raw ratings, a finished season's from
     players.json's curves */
  const curveOf = vals => { const n = vals.length, m = vals.reduce((a, x) => a + x, 0) / n, sd = Math.sqrt(vals.reduce((a, x) => a + (x - m) ** 2, 0) / n); return v => sd > 0 ? Math.round(1500 + 100 * (v - m) / sd) : 1500; };
  const pToday = curveOf(real.players.filter(p => p.ranked).map(p => PJ.players[p.id].elo));
  const cToday = curveOf(real.coaches.filter(c => c.ranked).map(c => c.elo));
  check(real.players.every(p => pToday(PJ.players[p.id].elo) === p.rating), 'today\'s player ladder, worked out here, gives every table rating');
  check(real.coaches.filter(c => PJ.coaches[c.name]).every(c => cToday(c.elo) === c.rating), 'today\'s coach ladder gives every table rating');
  const past = (s0, kind, v) => { const c = RAW.curves[s0] && RAW.curves[s0][kind]; return c && c.sd > 0 ? Math.round(1500 + 100 * (v - c.mean) / c.sd) : 1500; };
  const season = RAW.season, today = HJ.asOf;
  const seasonOfRef = ref => +RAW.games[ref >> 1].split('_')[0];
  const firstCur = RAW.games.find(id => +id.split('_')[0] === season);
  /* the season's start is its first final; with none yet (the preseason) it is today, as publish.js has it */
  const start = firstCur ? `${firstCur.slice(5, 9)}-${firstCur.slice(9, 11)}-${firstCur.slice(11, 13)}` : today;
  const dayOf = d => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(RAW.from + 'T12:00:00Z')) / 864e5);
  const minus = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
  check(HJ.start === start && HJ.startDay === dayOf(start) && HJ.today === dayOf(today) && HJ.season === season, `the season began ${start}, day ${HJ.startDay}; today is day ${HJ.today}`);
  check(RAW.season >= PJ.season && Object.keys(RAW.curves).every(s0 => +s0 === season - 1), `the history's season is the one the ratings are carried into (${season}), last season's ladder beside it`);
  const decode = p => { const out = []; let d = 0, r = 0, f = 0; for (let i = 0; i < p.length; i += 3) { d += p[i]; r += p[i + 1]; f += p[i + 2]; out.push([d, r, f]); } return out; };
  /* one series, as its window and its table must show it */
  const own = (list, startRaw, nowV, show) => {
    const pts = []; for (const [d, v, ref] of list || []) if (seasonOfRef(ref) < season) pts.push([d, show(seasonOfRef(ref), v), ref]);
    for (const [d, v, ref] of list || []) if (seasonOfRef(ref) === season) pts.push([d, show(season, v), ref]);
    const s0 = startRaw === undefined ? null : show(season, startRaw);
    const at = t => { if (s0 === null) return null; if (t < start) return s0; let v = s0; for (const [d, r, ref] of pts) if (seasonOfRef(ref) === season && d <= dayOf(t)) v = r; return v; };
    const ch = t => nowV === null || at(t) === null ? null : nowV - at(t);
    return { pts, s: s0, n: nowV, d7: ch(minus(today, 7)), d30: ch(minus(today, 30)), dS: s0 === null || nowV === null ? null : nowV - s0 };
  };
  const same = (got, want) => got && JSON.stringify(decode(got.p)) === JSON.stringify(want.pts) && got.s === want.s && got.n === want.n && got.d7 === want.d7 && got.d30 === want.d30 && got.dS === want.dS;
  let bad = [];
  for (const p of real.players) { const want = own(RAW.players[p.id], RAW.start.players[p.id], p.rating, (s0, v) => s0 < season ? past(s0, 'p', v) : pToday(v));
    if (!HJ.players[p.id] ? RAW.players[p.id] || RAW.start.players[p.id] !== undefined : !same(HJ.players[p.id], want) || p.d7 !== want.d7) bad.push(p.name); }
  check(!bad.length, `every player's series, worked out here (${real.players.length}): each point on its season's ladder, start, today, 7 and 30 days and this season ${bad.slice(0, 4).join(', ')}`);
  check(real.players.every(p => RAW.start.players[p.id] !== undefined && HJ.players[p.id] && HJ.players[p.id].s !== null && p.d7 !== null), 'every listed player has a start this season and a 7-day change');
  bad = [];
  for (const c of real.coaches) { const want = own(RAW.coaches[c.name], RAW.start.coaches[c.name], c.rating, (s0, v) => s0 < season ? past(s0, 'c', v) : cToday(v));
    if (HJ.coaches[c.name] ? !same(HJ.coaches[c.name], want) || c.d7 !== want.d7 : (RAW.coaches[c.name] || RAW.start.coaches[c.name] !== undefined)) bad.push(c.name); }
  check(!bad.length, `every coach's series (${real.coaches.length}) ${bad.slice(0, 4).join(', ')}`);
  bad = [];
  for (const [t, x] of Object.entries(real.teams)) { const nowR = RAW.now.teams[t]; const want = own(RAW.teams[t], RAW.start.teams[t], nowR === undefined ? null : Math.round(nowR), (s0, v) => Math.round(v));
    if (!same(HJ.teams[t], want) || x.d7 !== want.d7) bad.push(t); }
  check(!bad.length, `every club's series (30), on its rotation's strength ${bad.join(', ')}`);
  check(Object.keys(real.teams).every(t => HJ.teams[t] && HJ.teams[t].n !== null && HJ.teams[t].s !== null && real.teams[t].d7 !== null), 'every club has a start, today\'s point and a 7-day change, played this season or not');
  /* the recorder held to the ratings themselves, not to its own sums: each player's last game this season, put back on
     today's centring, is his rating now; each coach's is his */
  const shiftAt = Object.fromEntries((RAW.shifts || []).map(([d, v]) => [d, v]));
  bad = [];
  for (const [id, p] of Object.entries(PJ.players)) { const L = (RAW.players[id] || []).filter(([, , ref]) => seasonOfRef(ref) === season); if (!L.length) continue;
    const [d, v] = L[L.length - 1]; if (shiftAt[d] === undefined || Math.abs(v + shiftAt[d] - RAW.shift - p.elo) > 0.15) bad.push(p.name); }
  for (const [n, c] of Object.entries(PJ.coaches)) { const L = (RAW.coaches[n] || []).filter(([, , ref]) => seasonOfRef(ref) === season); if (L.length && Math.abs(L[L.length - 1][1] - c.elo) > 0.051) bad.push(n); }
  check(!bad.length, `each player's and coach's last game this season is his rating now, recentred (${bad.slice(0, 4).join(', ')})`);
  const lastDay = (RAW.shifts || []).length ? RAW.shifts[RAW.shifts.length - 1] : null;
  check(!firstCur || (lastDay && lastDay[0] === dayOf(PJ.asOf) && Math.abs(lastDay[1] - RAW.shift) < 0.0015), 'the last day\'s centring is today\'s, the one the tables are on');
  const anyPast = Object.values(HJ.players).some(x => decode(x.p).some(([, , ref]) => seasonOfRef(ref) < season));
  check(anyPast && Object.keys(RAW.curves).map(Number).includes(season - 1), `last season's games are there, on ${season - 1}'s own ladder`);
  check(Object.values(HJ.players).every(x => decode(x.p).every(([d, , ref], i, a) => d >= 0 && d <= HJ.today && ref >= 0 && ref >> 1 < RAW.games.length && (!i || d >= a[i - 1][0]))), 'every point is in range, in order, on a game of the list');

  /* the page: nothing read until a window opens; the columns; the window */
  let hxReads = 0, serve = HJ;
  JSONS = [[/history\.json/, (url, opt) => { hxReads++; check(opt && opt.cache === 'no-store', 'history.json is read no-store'); return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(serve)) }; }]];
  let { w, errors, timers } = load('index.html', real, null, null, 'players');
  await sleep(300); await provoke(w, timers, errors); await sleep(50);
  /* the page keeps which tab is open (its own key); the windows keep nothing */
  const kept = () => JSON.stringify(Object.keys(w.localStorage).filter(k => !/:tab$/.test(k)).sort().map(k => [k, w.localStorage.getItem(k)]));
  const d = w.document, stored0 = kept();
  check(hxReads === 0, 'nothing reads history.json on load, on a timer or an event');
  const ths = [...d.querySelectorAll('#playersT th')], c7 = ths.findIndex(th => th.dataset.k === 'd7');
  check(c7 > 0 && ths[c7].textContent === '7dChange over 7 days' && ths[c7].querySelector('[aria-hidden="true"]').textContent === '7d', 'the Players table has a 7d column, with words for a screen reader');
  const rows = [...d.querySelectorAll('#playersT tbody tr')];
  const shown = real.players.slice(0, rows.length);
  const fmt7 = v => v === null || v === undefined ? '–' : v === 0 ? '0' : (v > 0 ? '▲up ' : '▼down ') + Math.abs(v);
  check(rows.length > 10 && rows.every((tr, i) => tr.children[c7].textContent.trim() === fmt7(shown[i].d7)), `each player's 7d is his change, arrow and word (${rows.length} rows)`);
  /* the player opened is one with games this season and last, so every part of the window is drawn */
  const pick = real.players.find(p => { const x = HJ.players[p.id]; if (!x) return false; const q = decode(x.p); return q.some(([, , r]) => seasonOfRef(r) < season) && q.some(([, , r]) => seasonOfRef(r) === season); }) || real.players[0];
  d.getElementById('pq').value = pick.name; d.getElementById('pq').dispatchEvent(new w.Event('input')); await sleep(30);
  const btn = d.querySelector(`#playersT [data-hx="p:${pick.id}"]`), pid = pick.id, pl = pick;
  check(!!btn && btn.tagName === 'BUTTON' && btn.getAttribute('aria-haspopup') === 'dialog' && /rating over time/.test(btn.textContent), 'a player\'s name is a button that says what it opens');
  /* the numbers in the boxes: served as planted, so a box that shows another number than its own fails */
  serve = JSON.parse(JSON.stringify(HJ)); Object.assign(serve.players[pid], { d7: 3, d30: -7, dS: 12 });
  btn.click(); await sleep(60);
  const back = d.getElementById('hxBack');
  check(!back.hidden && d.activeElement === d.getElementById('hxClose'), 'a name opens the window, the focus on Close');
  check(hxReads === 1, 'history.json is read once, when the window first opens');
  check(d.getElementById('hxTitle').textContent === pl.name, 'the window is headed with his name');
  const boxes = [...d.querySelectorAll('.hx-nums > div > b')].map(b => b.textContent.trim());
  check(boxes[0].endsWith(String(pl.rating)) && boxes[1] === '▲up 3' && boxes[2] === '▼down 7' && boxes[3] === '▲up 12', `now, 7 days, 30 days and this season, each its own: ${boxes.join(' | ')}`);
  const H1 = HJ.players[pid], pts = decode(H1.p);
  const circles = [...d.querySelectorAll('.hx-chart circle')];
  check(circles.length === pts.length + (H1.s !== null ? 1 : 0) + 1, `the line has every game, the start and today (${circles.length} points)`);
  check(circles[circles.length - 1].textContent === `Today: ${pl.rating}`, 'its last point is today\'s, the table\'s rating');
  const cx = circles.map(c => +c.getAttribute('cx'));
  check(cx.every((v, i) => !i || v >= cx[i - 1]) && cx[cx.length - 1] > cx[0], 'the points run left to right');
  const nPast = pts.filter(([, , r]) => seasonOfRef(r) < season).length, nCur = pts.length - nPast + (H1.s !== null ? 1 : 0) + 1;
  check(d.querySelectorAll('.hx-chart path.ln').length === (nPast > 1 ? 1 : 0) + (nCur > 1 ? 1 : 0) && d.querySelectorAll('.hx-chart path.gap').length === (nPast && nCur ? 1 : 0), 'last season\'s line, this season\'s, and the summer between them dotted');
  const svgW = +d.querySelector('.hx-chart').getAttribute('width');
  const startC = circles.find(c => /began/.test(c.textContent));
  check(!nPast || !startC || HJ.today === HJ.startDay || +startC.getAttribute('cx') <= svgW * 0.62, 'this season has its share of the width, not the last few pixels of a year');
  const cur = pts.filter(([, , ref]) => seasonOfRef(ref) === season);
  const li = [...d.querySelectorAll('.hx-games li')];
  check(li.length === Math.min(10, cur.length || Math.min(5, pts.length)), `the games listed: ${li.length}`);
  if (cur.length) { const [, r, ref] = cur[cur.length - 1], gid = RAW.games[ref >> 1], home = (ref & 1) === 1, opp = gid.split('_')[home ? 2 : 3];
    const sc = real.finals[gid], own0 = sc[home ? 1 : 0], their = sc[home ? 0 : 1], res = `${own0 > their ? 'W' : own0 < their ? 'L' : 'T'} ${own0}-${their}`;
    check(li[0].textContent.includes(opp) && li[0].children[2].textContent === res && li[0].children[3].textContent === String(r), `the newest game first, its result from the finals: ${li[0].textContent.replace(/\s+/g, ' ').trim()}`); }
  check(d.querySelector('.hx-chart').getAttribute('role') === 'img' && /Rating over time/.test(d.querySelector('.hx-chart').getAttribute('aria-label')), 'the chart says what it shows to a screen reader');
  /* Tab and Shift+Tab stay inside, Escape closes and gives the focus back */
  for (const shiftKey of [false, true]) { d.getElementById('hxClose').focus();
    const ev = new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey, bubbles: true, cancelable: true }); d.activeElement.dispatchEvent(ev);
    check(ev.defaultPrevented && back.contains(d.activeElement), `${shiftKey ? 'Shift+Tab' : 'Tab'} stays in the window`); }
  back.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20);
  check(back.hidden && d.activeElement && d.activeElement.dataset.hx === 'p:' + pid, 'Escape closes it and the focus goes back to the name');
  /* a coach and a club */
  d.querySelector('#nav button[data-tab=coaches]').click(); await sleep(40);
  const cb = d.querySelector('#coachT [data-hx^="c:"]'), cname = cb.dataset.hx.slice(2), co = real.coaches.find(c => c.name === cname);
  cb.click(); await sleep(40);
  check(!back.hidden && d.getElementById('hxTitle').textContent === cname && d.querySelector('.hx-nums > div').textContent.includes(String(co.rating)) && /half|50%/.test(d.querySelector('.hx-note').textContent), `a coach's window: ${cname}, ${co.rating}, and a coach's carry in its own words`);
  check(hxReads === 1, 'a second window reads nothing more');
  d.getElementById('hxClose').click(); await sleep(20);
  check(back.hidden && !!d.activeElement && d.activeElement.dataset.hx === cb.dataset.hx, 'Close gives the focus back');
  d.querySelector('#nav button[data-tab=teams]').click(); await sleep(40);
  const tk = Object.keys(real.teams).find(t => HJ.teams[t] && HJ.teams[t].n !== null);
  d.querySelector(`#teamsT [data-hx="t:${tk}"]`).click(); await sleep(40);
  const tnote = d.querySelector('.hx-note').textContent;
  check(d.querySelector('.hx-nums > div').textContent.includes(String(HJ.teams[tk].n)) && tnote.includes(String(Math.round(real.teams[tk].strength))) && /either way/.test(tnote), `a club's window (${tk}): its rotation now, and the Teams tab's strength named as another lineup`);
  const tth = [...d.querySelectorAll('#teamsT th')].find(th => th.dataset.k === 'd7');
  check(!!tth && /rotation/.test(tth.querySelector('[title]').getAttribute('title')), 'the Teams table has a 7d column, titled as the rotation\'s change');
  d.getElementById('hxClose').click(); await sleep(20);
  check(kept() === stored0, 'opening and closing the windows stores nothing');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* a history that does not load, and one that is junk: the window says so, the tables stand; the next window reads again */
  for (const [label, resp] of [['a 404', () => ({ ok: false, status: 404, json: async () => ({}) })], ['not JSON', () => ({ ok: true, status: 200, json: async () => { throw new SyntaxError('bad'); } })], ['the wrong shape', () => ({ ok: true, status: 200, json: async () => ({ v: 2 }) })]]) {
    let n = 0; JSONS = [[/history\.json/, (u, o) => (++n === 1 ? resp() : { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(HJ)) })]];
    ({ w, errors } = load('index.html', real, null, null, 'players')); await sleep(250);
    const b1 = w.document.querySelector('#playersT [data-hx^="p:"]'); b1.click(); await sleep(60);
    const failed = /did not load/.test(w.document.getElementById('hxBody').textContent);
    w.document.getElementById('hxClose').click(); await sleep(20); b1.click(); await sleep(60);
    check(failed && n === 2 && w.document.querySelectorAll('.hx-chart circle').length > 0 && errors.length === 0, `history.json ${label}: the window says it did not load, nothing thrown, and the next window reads it again`);
  }
  JSONS = [];
}
/* ---------- 12. the Pick'em Record ---------- */
async function pickemRecord() {
  console.log('12. the Pick\'em Record (pickem.json, the tiles, the chart, the grids)');
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const PKR = JSON.parse(fs.readFileSync(path.join(ROOT, 'pickem.json'), 'utf8'));
  /* the record worked out here: Vegas the moneyline favourite with the margin out, else the spread's, else none */
  const im = x => x < 0 ? -x / (-x + 100) : 100 / (x + 100);
  /* Vegas, on the smoke's own reading: the moneyline favourite (margin out); level prices or none, the spread's favourite; neither, none */
  const vOwn = g => { if (g.ml && g.ml[0] && g.ml[1]) { const ph = im(g.ml[1]) / (im(g.ml[1]) + im(g.ml[0])); if (ph !== 0.5) return ph > 0.5 ? g.home : g.away; } return g.line ? (g.line < 0 ? g.home : g.away) : null; };
  const won = g => g.score ? (g.score[1] > g.score[0] ? g.home : g.away) : null;
  const own = pk => {
    const rows = pk.games.filter(g => g.score && g.score[0] !== g.score[1]);
    const res = {};
    for (const m of pk.models) {
      let w = 0, l = 0, net = 0;
      for (const g of rows) { if (!(g.c && isFinite(g.c[m.id]))) continue; const p = g.c[m.id] >= 0.5 ? g.home : g.away, ok = p === won(g); ok ? w++ : l++;
        const v = vOwn(g); if (v) net += (ok ? 1 : 0) - (v === won(g) ? 1 : 0); }
      if (w + l) res[m.id] = { w, l, net };
    }
    let vw = 0, vl = 0; for (const g of rows) { const v = vOwn(g); if (v) v === won(g) ? vw++ : vl++; }
    return { rows, res, vegas: { w: vw, l: vl } };
  };
  const sign = n => n > 0 ? '+' + n : n < 0 ? '−' + Math.abs(n) : '0';
  /* a made-up season: week 1 of three games, week 2 of two (one with no Vegas side), a playoff week; the joker could not run */
  const G = (id, date, w, type, score, ml, line, c) => { const [, , away, home] = id.split('_'); return { id, date, tip: date + 'T23:30Z', type, w, away, home, score, ml, line, c }; };
  const fake = { v: 1, season: 2027, today: '2026-11-03', models: PKR.models,
    status: { joker: { since: '2026-11-01T12:00Z', why: 'the box scores did not load' } },
    weeks: [{ key: '1', label: 'Week 1', short: 'Wk 1', from: '2026-10-19', to: '2026-10-25' }, { key: '2', label: 'Week 2', short: 'Wk 2', from: '2026-10-26', to: '2026-11-01' }, { key: 'P1', label: 'Playoffs 1', short: 'P1', from: '2026-11-02', to: '2026-11-08' }],
    games: [
      G('2027_20261020_BOS_DET', '2026-10-20', 0, 'REG', [100, 110], [150, -170], -4.5, { alpha: 0.6, joker: 0.4, player: 0.55, team: 0.7 }),          // DET won; Vegas DET
      G('2027_20261021_LAL_GSW', '2026-10-21', 0, 'REG', [120, 101], [-130, 110], 2.5, { alpha: 0.45, joker: 0.6, player: 0.52, team: 0.4, elo: 0.3 }),  // LAL won; Vegas LAL
      G('2027_20261022_NYK_MIA', '2026-10-22', 0, 'REG', [99, 104], [-200, 170], 6, { alpha: 0.3, player: 0.4, team: 0.5, elo: 0.6 }),                // MIA won; Vegas NYK
      G('2027_20261027_OKC_SAS', '2026-10-27', 1, 'REG', [110, 108], null, 0, { alpha: 0.4, player: 0.6, team: 0.45, elo: 0.45 }),                   // OKC won; no Vegas side
      G('2027_20261028_DEN_PHX', '2026-10-28', 1, 'REG', [95, 105], null, -3, { alpha: 0.7, player: 0.35, team: 0.62, elo: 0.4 }),                     // PHX won; Vegas PHX (spread)
      G('2027_20261103_BOS_NYK', '2026-11-03', 2, 'POST', [101, 99], [120, -140], -2.5, { alpha: 0.4, player: 0.6, team: 0.48, elo: 0.55 }),          // BOS won; Vegas NYK
      G('2027_20261103_DAL_HOU', '2026-11-03', 2, 'POST', null, [110, -130], -2, { alpha: 0.5, player: 0.45 }),                                       // to play
    ] };
  const want = own(fake);
  let reads = 0, serve = fake;
  JSONS = [[/pickem\.json/, (url, opt) => { reads++; check(opt && opt.cache === 'no-store', 'pickem.json is read no-store'); return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(serve)) }; }]];
  let { w, errors, timers } = load('index.html', real, null, null, 'slate');
  await sleep(300); await provoke(w, timers, errors); await sleep(50);
  const d = w.document;
  check(reads === 0, 'nothing reads pickem.json on load, on a timer or an event');
  const btn = [...d.querySelectorAll('#nav button')].find(b => b.dataset.tab === 'pickem');
  check(!!btn && btn.textContent === "Pick'em Record", 'a Pick\'em Record tab');
  btn.click(); await sleep(80);
  check(reads === 1, 'opening it reads pickem.json once');
  const tiles = [...d.querySelectorAll('#pkTiles .stat')].map(x => `${x.querySelector('b').textContent} ${x.querySelector('span').textContent}`);
  /* Vegas's tiles on the six graded games, five with a side: DET right, LAL right, NYK wrong, PHX right, NYK wrong; the
     spread's miss |margin + line| over the five graded games with a non-zero... every graded game with a line */
  check(tiles[0] === '60.0% Vegas straight-up, 3 of 5', `Vegas straight-up: ${tiles[0]}`);
  const misses = fake.games.filter(g => g.score && g.line !== null && vOwn(g)).map(g => Math.abs(g.score[1] - g.score[0] + g.line));
  /* the confidence bands count only a Vegas side with a chance: the spread-only PHX side is straight up and in no band */
  const bandN = tiles.slice(1, 5).map(t => +/(\d+)\/(\d+)$/.exec(t)[2]).reduce((x, y) => x + y, 0);
  check(bandN === 4, `the four confidence tiles count the four Vegas sides read from a moneyline, not the spread-only one (${bandN})`);
  /* level moneylines have no favourite: the spread's favourite stands in, and with no spread there is no Vegas side */
  const VG = w.NBA_PICKEM.vegas, lv = (ml, line) => VG({ away: 'BOS', home: 'NYK', ml, line });
  check(lv([-110, -110], 1.5).pick === 'BOS' && lv([-110, -110], 1.5).conf === null && lv([-110, -110], 0) === null && lv([-110, -110], -2).pick === 'NYK'
    && lv([120, -140], 3).pick === 'NYK' && lv([-100, 100], 0) === null,
    'level moneylines fall to the spread\'s favourite (none with no spread); a moneyline favourite stands whatever the spread');
  check(tiles[5] === `${(misses.reduce((a, x) => a + x, 0) / misses.length).toFixed(1)} spread's avg miss, pts`, `the spread's average miss, |margin + line| over the graded games Vegas called: ${tiles[5]}`);
  const lg = [...d.querySelectorAll('#pkChart .lgd')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
  const legWant = fake.models.filter(m => want.res[m.id]).map(m => `${m.name} ${want.res[m.id].w}–${want.res[m.id].l} ${sign(want.res[m.id].net)} vs Vegas`).concat([`Vegas ${want.vegas.w}–${want.vegas.l} the zero line`]);
  check(JSON.stringify(lg) === JSON.stringify(legWant), `the legend, worked out here: ${lg.join(' | ')}`);
  check(/The Joker<\/b> could not be rescored since/.test(d.querySelector('#pkChart .rv-notes').innerHTML) && /the box scores did not load/.test(d.querySelector('#pkChart .rv-notes').textContent), 'a model that could not run is named, with why');
  const lines = [...d.querySelectorAll('#pkChart polyline')];
  check(lines.length === Object.keys(want.res).length && lines.every(l => l.getAttribute('points').split(' ').length === 4), 'one line a model, a point a week and the start');
  const xl = [...d.querySelectorAll('#pkChart svg text')].map(t => t.textContent);
  check(['Start', 'Wk 1', 'Wk 2', 'P1'].every(t => xl.includes(t)), 'the weeks along the bottom, the playoffs as P1');
  check(d.querySelectorAll('#pkChart .rv-hit').length === 3, 'a hover target a week');
  d.querySelector('#pkChart .rv-hit[data-i="1"]').dispatchEvent(new w.Event('click')); await sleep(10);
  const tipText = d.querySelector('#pkChart .rv-tip').textContent;
  check(!d.querySelector('#pkChart .rv-tip').hidden && /^Week 2/.test(tipText) && /Vegas 1–0/.test(tipText), `the week's tooltip: ${tipText.slice(0, 80)}`);
  const gridRows = [...d.querySelectorAll('#pkGrid tbody tr')].map(tr => [...tr.children].map(c => c.querySelector('b') ? `${c.querySelector('b').textContent} ${c.querySelector('small').textContent}` : c.textContent.trim()));
  /* Alpha by hand: DET right, LAL right, NYK wrong; OKC right, PHX right; BOS right */
  const alphaRow = gridRows.find(r => /Alpha Model/.test(r[0]));
  check(alphaRow && alphaRow[1] === '2–1 67%' && alphaRow[2] === '2–0 100%' && alphaRow[3] === '1–0 100%' && alphaRow[4] === '5–1 83%', `Alpha's week by week, worked out by hand: ${alphaRow && alphaRow.join(' | ')}`);
  const eloRow = gridRows.find(r => /ELO Model/.test(r[0]));
  /* ELO by hand (no call on the first game): LAL right, MIA right; OKC right, DEN wrong; NYK wrong */
  check(eloRow && eloRow[1] === '2–0 100%' && eloRow[2] === '1–1 50%' && eloRow[3] === '0–1 0%' && eloRow[4] === '3–2 60%', `ELO's week by week (no call on the first game): ${eloRow && eloRow.join(' | ')}`);
  const vRow = gridRows.find(r => /^Vegas/.test(r[0]));
  check(vRow && vRow[1] === '2–1 67%' && vRow[2] === '1–0 100%' && vRow[3] === '0–1 0%' && vRow[4] === '3–2 60%', `Vegas's week by week: ${vRow && vRow.join(' | ')}`);
  const cells = [...d.querySelectorAll('#pkGrid td.rv-c')];
  check(cells.some(c => /rgba\(27, ?122, ?78/.test(c.getAttribute('style') || '')) && cells.some(c => /rgba\(192, ?57, ?43/.test(c.getAttribute('style') || '')) && cells.some(c => !c.getAttribute('style') && /50%/.test(c.textContent)), 'green above .500, red under, clear at .500');
  /* every pick, a day at a time */
  const tog = d.getElementById('pkPicks');
  check(tog.getAttribute('aria-expanded') === 'false' && d.getElementById('pkPickBox').hidden, 'the picks start hidden');
  tog.click(); await sleep(20);
  const sel = d.getElementById('pkDay');
  check(!!sel && d.activeElement && d.activeElement.id === 'pkPicks' && d.getElementById('pkPicks').getAttribute('aria-expanded') === 'true', 'Show every pick opens them, the focus kept');
  check([...sel.options].map(o => o.value).join(',') === '2026-11-03,2026-10-28,2026-10-27,2026-10-22,2026-10-21,2026-10-20', 'the days newest first');
  const heads = [...d.querySelectorAll('.pickgrid th')].map(t => t.textContent);
  check(heads[0] === 'Game' && heads[heads.length - 1] === 'Vegas', `the columns: ${heads.join(', ')}`);
  sel.value = '2026-10-20'; sel.dispatchEvent(new w.Event('change')); await sleep(20);
  const r0 = [...d.querySelectorAll('.pickgrid tbody tr')][0];
  const heads2 = [...d.querySelectorAll('.pickgrid th')].map(t => t.textContent), colOf = n => heads2.indexOf(n);
  check(/BOS at DET/.test(r0.children[0].textContent) && /DET won 110–100/.test(r0.children[0].textContent), 'a game, its time and who won');
  check(/BOS/.test(r0.children[colOf('The Joker')].textContent) && /✗/.test(r0.children[colOf('The Joker')].textContent) && /DET/.test(r0.children[colOf('Alpha Model')].textContent) && /✓/.test(r0.children[colOf('Alpha Model')].textContent), 'each model\'s pick, right or wrong');
  check(colOf('ELO Model') < 0 || r0.children[colOf('ELO Model')].textContent.trim() === '–', 'no call: a dash');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* the real file: the legend is the record worked out here, and the Player Model's calls are the Record tab's */
  serve = PKR;
  ({ w, errors } = load('index.html', real, null, null, 'pickem')); await sleep(350);
  const want2 = own(PKR);
  const lg2 = [...w.document.querySelectorAll('#pkChart .lgd')].map(x => x.textContent.replace(/\s+/g, ' ').trim());
  const legWant2 = PKR.models.filter(m => want2.res[m.id]).map(m => `${m.name} ${want2.res[m.id].w}–${want2.res[m.id].l} ${sign(want2.res[m.id].net)} vs Vegas`).concat([`Vegas ${want2.vegas.w}–${want2.vegas.l} the zero line`]);
  check(!want2.rows.length || JSON.stringify(lg2) === JSON.stringify(legWant2), `the real record: ${lg2.join(' | ')}`);
  const byId = Object.fromEntries(PKR.games.map(g => [g.id, g]));
  check(real.record.filter(r => byId[r.id]).every(r => byId[r.id].c.player === r.pHome && byId[r.id].score && byId[r.id].score[1] === r.homeScore), 'the Player Model\'s calls are the ones the Record tab grades');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  { const ys = l => l.getAttribute('points').split(' ').map(q => +q.split(',')[1]), pl = [...w.document.querySelectorAll('#pkChart polyline')].map(l => l.getAttribute('points'));
    check(new Set(pl).size === pl.length, `on the real file no model's line lies on another's (${pl.length} lines)`); }
  /* two models with the same record against Vegas every week: their lines are drawn 3px apart, never one on the other */
  { const twin = JSON.parse(JSON.stringify(fake));
    for (const g of twin.games) { if (g.c && isFinite(g.c.alpha)) g.c.team = g.c.alpha; else if (g.c) delete g.c.team; }
    serve = twin; ({ w, errors } = load('index.html', real, null, null, 'pickem')); await sleep(300);
    const col = id => (twin.models.find(m => m.id === id) || {}).color, line = id => [...w.document.querySelectorAll('#pkChart polyline')].find(l => l.getAttribute('stroke') === col(id));
    const pa = line('alpha'), pt = line('team'), yy = l => l.getAttribute('points').split(' ').map(q => +q.split(',')[1]), xx = l => l.getAttribute('points').split(' ').map(q => +q.split(',')[0]);
    check(pa && pt && JSON.stringify(xx(pa)) === JSON.stringify(xx(pt)) && yy(pa).every((y, i) => Math.abs(Math.abs(y - yy(pt)[i]) - 3) < 0.11) && errors.length === 0,
      `two models with the same record week by week are drawn 3px apart, not one on the other (${pa && pa.getAttribute('points')} / ${pt && pt.getAttribute('points')})`); }
  /* a file that does not load: said, and read again the next time the tab opens */
  let n = 0; JSONS = [[/pickem\.json/, () => (++n === 1 ? { ok: false, status: 404, json: async () => ({}) } : { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(fake)) })]];
  ({ w, errors } = load('index.html', real, null, null, 'pickem')); await sleep(250);
  const failed = /did not load/.test(w.document.getElementById('tab-pickem').textContent);
  w.document.querySelector('#nav button[data-tab="slate"]').click(); await sleep(20); w.document.querySelector('#nav button[data-tab="pickem"]').click(); await sleep(80);
  check(failed && n === 2 && !!w.document.getElementById('pkTiles') && errors.length === 0, 'a record that does not load says so, and the next opening reads it again');
  JSONS = [];
}

/* ---------- lines. the lines feed's readings, held to the page's (README "The lines feed") ----------
   tools/lines.js publishes DraftKings' game lines from tools/lines_feed.js, whose oddsDkHref, oddsIdOk and oddsGameLines
   are the page's own (Refresh odds, your parlay) line for line; and tools/fetch.js keeps each game's national networks
   (tv), which the page's copy of its parse must keep the same way. Both held here: the text, then the results on the
   recorded answers and on every way an answer can vary */
async function linesFeed() {
  console.log("lines. the lines feed's reading of DraftKings' game lines is the page's, and the page's parse keeps the national networks as the job's does");
  const LF = require('./lines_feed');
  const { w, errors } = load('index.html', withGames(false));
  await sleep(250);
  const pageSrc = fs.readFileSync(pageFile('index.html'), 'utf8'), lfSrc = fs.readFileSync(path.join(ROOT, 'tools', 'lines_feed.js'), 'utf8');
  const names = ['oddsDkHref', 'oddsIdOk', 'oddsGameLines'];
  const diff = names.filter(n => { const a = srcOf(lfSrc, n), b = srcOf(pageSrc, n); return !a || a !== b; });
  check(!diff.length, `the page's ${names.join(', ')} are tools/lines_feed.js's, line for line${diff.length ? `: differ: ${diff.join(', ')}` : ''}`);
  const FIX = path.join(ROOT, 'tools', 'fixtures');
  const recorded = fs.readdirSync(FIX).filter(f => /^scoreboard_\d{8}\.json$/.test(f)).map(f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8')));
  const withDk = recorded.flatMap(j => j.events).filter(e => e.competitions && e.competitions[0] && (e.competitions[0].odds || []).some(o => String(o.provider && o.provider.id) === '100'));
  const clone = x => JSON.parse(JSON.stringify(x));
  const rowOf = (e, base) => F.parseDay({ events: [e] })[0] || F.parseDay({ events: [base] })[0];
  const links = o => [o.moneyline && o.moneyline.home, o.moneyline && o.moneyline.away, o.pointSpread && o.pointSpread.home, o.pointSpread && o.pointSpread.away, o.total && o.total.over, o.total && o.total.under].filter(Boolean).map(x => x.close || x.current).filter(x => x && x.link);
  const variantsGl = {
    'as recorded': () => {},
    "another book's odds": o => { o.provider = { id: '58', name: 'ESPN BET' }; },
    'DraftKings named, with no provider id': o => { o.provider = { name: 'DraftKings' }; },
    'a spread on another number than the line shown': o => { o.pointSpread.home.close.line = '-9.5'; o.pointSpread.away.close.line = '+9.5'; },
    'a total with its Over and Under on two numbers': o => { o.total.under.close.line = 'u250.5'; },
    'a total written without its o/u': o => { o.total.over.close.line = o.total.over.close.line.slice(1); o.total.under.close.line = o.total.under.close.line.slice(1); },
    'links off DraftKings': o => { for (const k of links(o)) k.link.href = 'https://example.com/?outcomes=' + encodeURIComponent(new URL(new URL(k.link.href).searchParams.get('preurl')).searchParams.get('outcomes')); },
    "each side's link on the other side": o => { for (const [a, b] of [['moneyline', 'home', 'away'], ['pointSpread', 'home', 'away'], ['total', 'over', 'under']].map(([k, x, y]) => [o[k][x].close, o[k][y].close])) [a.link, b.link] = [b.link, a.link]; },
    'a DraftKings link with no gateway': o => { for (const k of links(o)) k.link.href = new URL(k.link.href).searchParams.get('preurl'); },
    'links that are not URLs, and none': (o, i) => { links(o).forEach((k, j) => { if ((i + j) % 2) k.link.href = 'not a url'; else delete k.link; }); delete o.link; },
    'an id naming an older number': o => { const k = o.pointSpread.home.close; k.link.href = k.link.href.replace(/([NP])(\d+)_1/, (m, s, n) => s + (+n + 100) + '_1'); const t = o.total.over.close; t.link.href = t.link.href.replace(/O(\d+)_1/, (m, n) => 'O' + (+n + 100) + '_1'); },
    'OFF, EVEN and junk prices': (o, i) => { o.pointSpread.home.close.odds = ['OFF', 'EVEN', '', '+99'][i % 4]; o.total.under.close.odds = ['EVEN', 'OFF', null, '-100'][i % 4]; },
    'current prices in place of close': o => { for (const s of ['home', 'away']) { o.pointSpread[s].current = o.pointSpread[s].close; delete o.pointSpread[s].close; } for (const s of ['over', 'under']) { o.total[s].current = o.total[s].close; delete o.total[s].close; } },
    'no spread, no total, no moneyline': (o, i) => { delete o[['pointSpread', 'total', 'moneyline'][i % 3]]; },
    'no odds at all': (o, i, e) => { e.competitions[0].odds = i % 2 ? [] : undefined; },
  };
  let same = 0, all = 0, nonNull = 0, withIds = 0;
  for (const [name, fn] of Object.entries(variantsGl)) {
    const bad = [];
    withDk.forEach((base, i) => {
      const e = clone(base), o = e.competitions[0].odds[0];
      fn(o, i, e);
      const r = rowOf(e, base);
      const run = f => { try { return JSON.stringify(f(clone(e), { ...r })); } catch (x) { return 'threw ' + x.name; } };
      const a = run(LF.oddsGameLines), b = run((x, y) => w.NBA_SLIP.oddsGameLines(x, y));
      all++; if (a === b) same++; else bad.push(`${base.id}: job ${a.slice(0, 120)} page ${b.slice(0, 120)}`);
      if (a !== 'null' && !a.startsWith('threw')) nonNull++;
      if (/"id":"0/.test(a)) withIds++;
    });
    check(!bad.length, `on ${name}, the lines feed reads every recorded event's DraftKings lines as the page does (${withDk.length} events)${bad.length ? `: ${bad.slice(0, 2).join(' | ')}` : ''}`);
  }
  check(withDk.length >= 9 && nonNull > all / 2 && withIds > all / 3, `and the cases are not empty: ${all} readings, ${nonNull} with lines, ${withIds} with a betslip id`);
  /* the lines feed's own shape loses nothing: back to the page's shape is the page's reading */
  const round = withDk.map(e => { const r = rowOf(e, e), gl = LF.oddsGameLines(e, r); return JSON.stringify(LF.linesGl(LF.linesOf(gl))) === JSON.stringify(w.NBA_SLIP.oddsGameLines(clone(e), { ...r })); });
  check(round.every(Boolean), "lines.json's shape and back (linesOf, linesGl) is the page's reading, on every recorded event");

  /* the national networks: the page's parse keeps tv as fetch.js does */
  const P = w.NBA_ODDS, base = { events: recorded.flatMap(j => clone(j.events)) };
  const vary = fn => { const j = clone(base); j.events.forEach((e, i) => fn(e.competitions[0], i)); return j; };
  const tvMade = (names, market = 'national') => ({ market, names });
  const geo = (name, type = 'TV', market = 'National') => ({ type: { id: '1', shortName: type }, market: { id: '1', type: market }, media: { shortName: name }, lang: 'en', region: 'us' });
  const variantsTv = {
    'the recorded answers': () => {},
    'geoBroadcasts alone': c => { delete c.broadcasts; },
    'broadcasts alone': c => { delete c.geoBroadcasts; },
    'streaming and local listings only': (c, i) => { c.broadcasts = [tvMade(['MSG'], i % 2 ? 'home' : 'away')]; c.geoBroadcasts = [geo('Peacock', 'Streaming'), geo('MSG', 'TV', 'Home')]; },
    'both lists, a name twice, markets in capitals and as objects': (c, i) => { c.broadcasts = [tvMade(['ESPN', 'ABC'], i % 2 ? 'NATIONAL' : { type: 'National' })]; c.geoBroadcasts = [geo('ESPN'), geo('ESPN2'), geo('ESPN+', 'Streaming')]; },
    'names with commas, bars, quotes and line breaks, and no names': (c, i) => { c.broadcasts = [tvMade([['Prime, Video', 'NBA|TV', 'A "B"', 'x\ny', null, 7, '  '][i % 7]])]; c.geoBroadcasts = [geo(i % 2 ? 'TNT,' : null)]; },
    'lists that are not lists, and empty entries': (c, i) => { c.broadcasts = [null, 'NBC', {}, [], { market: 'national' }][i % 5]; c.geoBroadcasts = [{}, null, [null], 'TV', [{ type: null, market: null }]][i % 5]; },
  };
  const tvSeen = new Set();
  for (const [name, fn] of Object.entries(variantsTv)) {
    const j = vary(fn);
    const run = f => { try { return JSON.stringify(f(clone(j))); } catch (x) { return 'threw ' + x.name; } };
    const a = run(F.parseDay), b = run(x => P.parseDay(x));
    if (a.startsWith('[')) JSON.parse(a).forEach(r => tvSeen.add(r.tv));
    check(a === b && a.startsWith('[{') && /"tv":/.test(a), `the page's parse keeps the national networks as tools/fetch.js does, on ${name}${a === b ? '' : `: job ${a.slice(0, 120)} page ${b.slice(0, 120)}`}`);
  }
  check(['', 'NBC', 'NBA TV', 'Peacock|NBC', 'ESPN|ABC|ESPN2'].every(v => tvSeen.has(v)), `and the cases meet every kind of listing: ${[...tvSeen].slice(0, 12).map(v => JSON.stringify(v)).join(', ')}`);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
}
/* ---------- conf. the confidence on Tonight's cards (README "The site") ----------
   The page's one confidence scale, this file's own copy of it, never the page's band(): High from 75%, Med from 60%, Low
   from 55%, else 50/50, on a chance rounded to a whole percent (the percentage a card shows). A card's pill is held to the
   percentage the card shows, read off the card; the key over the cards to the state's record, worked out here (each graded
   game's number published before tip-off, on its pick's chance, a tie left out); the Record tab's By confidence rows
   (recordChecks below) to the same bands */
const CONF_OWN = [['high', 'High', '75%+', 75], ['med', 'Med', '60-74%', 60], ['low', 'Low', '55-59%', 55], ['coin', '50/50', 'under 55%', -Infinity]];
const confOwnOf = pct => CONF_OWN.find(b => pct >= b[3]);
const confPctOwn = c => Math.floor(c * 100 + 0.5);                 // a chance as a whole percent, half up
function confRecOwn(R) {
  const t = Object.fromEntries(CONF_OWN.map(b => [b[0], [0, 0]]));
  for (const g of R || []) { if (g.su !== true && g.su !== false) continue; t[confOwnOf(confPctOwn(Math.max(g.pHome, 1 - g.pHome)))[0]][g.su ? 0 : 1]++; }
  return t;
}
const confWlOwn = x => x[0] + x[1] ? `${x[0]}-${x[1]}` : '';
const confSayOwn = (b, rec) => `Confidence: ${b[1]}, the model gives its pick ${b[2]}.${confWlOwn(rec[b[0]]) ? ` Its ${b[1]} picks this season: ${confWlOwn(rec[b[0]])}.` : ''}`;
const sq = t => String(t || '').replace(/\s+/g, ' ').trim();
/* every card of the day shown: a pill under the percentage exactly where the card has a number, its band the shown
   percentage's by this file's rule, its word, title and accessible text; then the key over the cards */
function confHold(w, st, what) {
  const d = w.document, rec = confRecOwn(st.record), on = d.querySelector('#days .day.on'), day = on && on.dataset.d;
  const cards = [...d.querySelectorAll('#slate .card')], bad = [], seen = {};
  let n = 0;
  for (const el of cards) {
    const g = st.slate.find(x => x.id === el.dataset.id), vs = el.querySelector('.vs'), pill = vs && vs.querySelector('.conf');
    if (!g) { bad.push(`${el.dataset.id}: no game`); continue; }
    if (!g.model) { if (pill || !/no number/.test(vs.textContent)) bad.push(`${g.id}: a pill with no number`); continue; }
    n++;
    const shown = vs.querySelector('b') && vs.querySelector('b').textContent, m = /^(\d+)%$/.exec(shown || '');
    const own = confPctOwn(Math.max(g.model.pHome, 1 - g.model.pHome));
    if (!m || +m[1] !== own) { bad.push(`${g.id}: shows ${shown}, its chance is ${own}%`); continue; }
    const b = confOwnOf(+m[1]), say = confSayOwn(b, rec), word = pill && pill.querySelector('[aria-hidden="true"]'), sr = pill && pill.querySelector('.sr');
    seen[b[0]] = (seen[b[0]] || 0) + 1;
    if (!pill || pill.className !== 'conf ' + b[0] || pill.dataset.conf !== b[0] || !word || word.textContent !== b[1] || pill.title !== say || !sr || sr.textContent !== say || vs.lastElementChild !== pill
      || w.getComputedStyle(pill).textTransform !== 'uppercase')
      bad.push(`${g.id} at ${shown}: want ${b[1]} ("${say}"), got ${pill ? `${pill.className} "${word && word.textContent}" "${pill.title}"` : 'no pill'}`);
  }
  check(!bad.length && n === st.slate.filter(g => g.date === day && g.model).length, `${what}: every card with a number (${n}) wears its confidence pill under its percentage, the band that percentage falls in by this file's own rule (${CONF_OWN.map(b => `${b[1]} ${seen[b[0]] || 0}`).join(', ')}), titled and read aloud with its range and this season's record${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`);
  const key = d.querySelector('#slate [data-confkey]'), any = CONF_OWN.some(b => confWlOwn(rec[b[0]]));
  if (!n) return check(!key, `${what}: no card with a number, so no confidence key`);
  const want = `Confidence${any ? ' · W-L this season' : ''} ` + CONF_OWN.map(b => `${b[1]} ${b[2]}${confWlOwn(rec[b[0]]) ? ' ' + confWlOwn(rec[b[0]]) : ''}`).join(' ');
  const items = key ? [...key.querySelectorAll('[data-ck]')].map(i => [i.dataset.ck, i.querySelector('.conf') && i.querySelector('.conf').className, sq(i.textContent), i.title]) : [];
  const wantItems = CONF_OWN.map(b => [b[0], 'conf ' + b[0], sq(`${b[1]} ${b[2]} ${confWlOwn(rec[b[0]])}`), confSayOwn(b, rec)]);
  check(key && sq(key.textContent) === want && JSON.stringify(items) === JSON.stringify(wantItems) && key.nextElementSibling && key.nextElementSibling.classList.contains('grid') && d.querySelectorAll('#slate [data-confkey]').length === 1,
    `${what}: one key line over the cards, the four bands with their ranges and this season's record in each from the state's record, worked out here: "${key ? sq(key.textContent) : 'none'}"${key && sq(key.textContent) !== want ? ` (want "${want}")` : ''}`);
}
/* the pill's colours, as the Parlay Builder's .pb-conf bands are coloured (High lime, Med hot, Low ice, 50/50 neutral):
   held on the stylesheet's own rule text, since jsdom resolves no var(): each band's rule this file's colour and the
   builder's twin rule's colour and border, the bare .conf the builder's neutral, and no other rule on a .conf (50/50
   among them) giving it a colour, a border or a background */
const CONF_INK_OWN = { '': 'var(--ink-2)', high: 'var(--lime)', med: 'var(--hot-2)', low: 'var(--ice)' };
function confCssHold(w, what) {
  const rules = [], walk = rs => { for (const r of rs) { if (r.cssRules && !r.selectorText) walk(r.cssRules); else if (r.selectorText) rules.push(r); } };
  for (const sh of w.document.styleSheets) walk(sh.cssRules);
  const decl = sel => { const r = rules.filter(x => x.selectorText.split(',').map(t => t.trim()).includes(sel));
    return r.length ? ['color', 'background', 'border', 'border-color'].map(k => r.map(x => x.style.getPropertyValue(k)).filter(Boolean).pop() || '') : null; };
  const bad = [];
  for (const [k, ink] of Object.entries(CONF_INK_OWN)) {
    const a = decl('.conf' + (k ? '.' + k : '')), b = decl('.pb-conf' + (k ? '.' + k : ''));
    if (!a || !b || a[0] !== ink || b[0] !== ink || JSON.stringify(a) !== JSON.stringify(b)) bad.push(`.conf${k ? '.' + k : ''} ${JSON.stringify(a)} against .pb-conf${k ? '.' + k : ''} ${JSON.stringify(b)}, want ${ink}`);
  }
  const mine = new Set(Object.keys(CONF_INK_OWN).map(k => '.conf' + (k ? '.' + k : '')));
  for (const r of rules) for (const sel of r.selectorText.split(',').map(t => t.trim())) {
    if (mine.has(sel) || !/\.conf(?![\w-])/.test(sel.split(/[\s>+~]+/).pop())) continue;
    const set = ['color', 'background', 'background-color', 'border', 'border-color'].filter(k => r.style.getPropertyValue(k));
    if (set.length) bad.push(`${sel} sets ${set.join(', ')}`);
  }
  check(!bad.length, `${what}: the pill is coloured as the builder's bands (High ${CONF_INK_OWN.high}, Med ${CONF_INK_OWN.med}, Low ${CONF_INK_OWN.low}, 50/50 the neutral ${CONF_INK_OWN['']}), each rule's colour and border the .pb-conf twin's, no other rule colouring a pill${bad.length ? ': ' + bad.slice(0, 3).join(' | ') : ''}`);
}
async function confChecks() {
  console.log('conf. the confidence on Tonight\'s cards');
  /* the scale's edges, home and away: each a chance whose rounding a pill on the unrounded number would read the other
     way (74.5% shows 75%, 74.49% 74%, 1 - 0.455 is 54.49999...%), and one game with no number */
  const P = [0.745, 0.7449, 0.7499, 0.75, 0.595, 0.5949, 0.5999, 0.6, 0.545, 0.5449, 0.5499, 0.55, 0.5, 0.255, 0.405, 0.455, 0.4501, 0.2505, 0.2551, 0.91];
  const edge = P.map((p, i) => ({ ...fake('cf' + String(i).padStart(2, '0'), state.today, false), model: { ...fake('x', state.today, false).model, pHome: p } }));
  edge.push({ ...fake('cfnone', state.today, false), model: null });
  /* a made-up record: every band, its edges, a tie left out; a game of the last band but a tie only */
  const R = (pHome, su) => ({ id: 'r' + pHome + su, date: '2026-10-25', type: 'REG', pHome, su });
  const rec1 = [R(0.7495, true), R(0.2505, false), R(0.745, true), R(0.8, null), R(0.7449, true), R(0.595, false), R(0.4, true), R(0.5949, true), R(0.545, true), R(0.43, false), R(0.455, false), R(0.5449, true), R(0.5, true)];
  const want1 = confRecOwn(rec1);
  check(JSON.stringify(want1) === '{"high":[2,1],"med":[2,1],"low":[2,1],"coin":[2,1]}', `the made-up record, by this file's rule: ${JSON.stringify(want1)} (74.95% High, 74.49% Med, 40% by the away side Med, 59.49% Low, 1 - 0.455 50/50, the tie left out)`);
  const variants = [['the scale\'s edges, a made-up record in every band', { ...state, slate: edge, record: rec1 }],
    ['the same with a band of ties only and an empty one (no record shown for them)', { ...state, slate: edge, record: [R(0.8, true), R(0.62, false), R(0.56, null)] }],
    ['the same before any game is graded (no record at all)', { ...state, slate: edge, record: [] }],
    ['a day of games with no number', { ...state, slate: edge.map(g => ({ ...g, model: null })), record: rec1 }]];
  for (const [what, st] of variants) {
    const r = load('index.html', st); await sleep(250);
    confHold(r.w, st, what);
    if (st.record === rec1 && st.slate === edge) confCssHold(r.w, what);
    check(r.errors.length === 0, 'no script errors: ' + r.errors.join(' | '));
  }
  /* the real state, every day of its strip */
  const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const r = load('index.html', real); await sleep(300);
  const days = [...r.w.document.querySelectorAll('#days .day')].map(b => b.dataset.d);
  for (const dd of days) { const b = r.w.document.querySelector(`#days .day[data-d="${dd}"]`); b.click(); await sleep(15); confHold(r.w, real, `the real state, ${dd}`); }
  if (!days.length) check(!r.w.document.querySelector('[data-confkey]'), 'the real state has no game on the board, and no key');
  check(r.errors.length === 0, 'no script errors: ' + r.errors.join(' | '));
}

/* ---------- the Record tab, laid out as the NHL hub's (README "The site") ----------
   Worked out here on its own from the state's record: each game's picks from the numbers published before tip-off and
   the lines (this file's own normal cdf, a Taylor series of erf, not the page's or publish.js's; the rule's edge, -110 on
   a spread or a total), then the tiles, the months and the bands, against what the tab draws */
const recErf = x => { if (x > 4.5) return 1; if (x < -4.5) return -1; let sum = 0, term = x; for (let n = 0; n < 120; n++) { sum += term / (2 * n + 1); term *= -x * x / (n + 1); } return 2 / Math.sqrt(Math.PI) * sum; };
const recPhi = z => 0.5 * (1 + recErf(z / Math.SQRT2));
const recImp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100);
function recOwnPicks(g, U) {
  const mov = g.homeScore - g.awayScore, tot = g.homeScore + g.awayScore, out = {}, near = [];
  const take = sides => { for (const [side, p, price] of sides) { const e = p - recImp(price); if (Math.abs(e - U.edge) < 1e-6) near.push(side); if (e >= U.edge) return { side, p }; } return null; };
  if (g.ml && g.ml[0] && g.ml[1]) { const k = take([['home', g.pHome, g.ml[1]], ['away', 1 - g.pHome, g.ml[0]]]); if (k) out.ml = { side: k.side, res: mov === 0 ? 'push' : (mov > 0) === (k.side === 'home') ? 'win' : 'loss' }; }
  if (g.line !== null) { const pc = recPhi((-g.spread + g.line) / U.sigma), k = take([['home', pc, U.price], ['away', 1 - pc, U.price]]), c = mov + g.line; if (k) out.sp = { side: k.side, res: c === 0 ? 'push' : (c > 0) === (k.side === 'home') ? 'win' : 'loss' }; }
  if (g.totalLine !== null) { const po = recPhi((g.total - g.totalLine) / U.sigmaTotal), k = take([['over', po, U.price], ['under', 1 - po, U.price]]); if (k) out.ou = { side: k.side, res: tot === g.totalLine ? 'push' : (tot > g.totalLine) === (k.side === 'over') ? 'win' : 'loss' }; }
  return { out, near: near.length > 0 };
}
function recOwnTally(R) {
  const f = () => ({ su: [0, 0], ml: [0, 0, 0], sp: [0, 0, 0], ou: [0, 0, 0] }), all = f(), months = {}, bands = {};
  const bandOf = p => confOwnOf(confPctOwn(Math.max(p, 1 - p)))[0];
  for (const g of R) { const add = t => { if (g.su === true) t.su[0]++; if (g.su === false) t.su[1]++; for (const k of ['ml', 'sp', 'ou']) { const x = g.pk && g.pk[k]; if (x) t[k][x.res === 'win' ? 0 : x.res === 'loss' ? 1 : 2]++; } };
    add(all); add(months[g.type === 'POST' ? 'playoffs' : g.date.slice(0, 7)] = months[g.type === 'POST' ? 'playoffs' : g.date.slice(0, 7)] || f()); add(bands[bandOf(g.pHome)] = bands[bandOf(g.pHome)] || f()); }
  return { all, months, bands };
}
const recWl = t => `${t[0]}-${t[1]}${t[2] ? '-' + t[2] : ''}`, recRate = t => t[0] + t[1] ? (100 * t[0] / (t[0] + t[1])).toFixed(1) + '%' : '—';
async function recordChecks(d, st, what) {
  d.querySelector('#nav button[data-tab=record]').click(); await sleep(30);
  const tab = d.getElementById('tab-record'), R = st.record || [], U = st.recordRule;
  check(tab.querySelector('h2') && tab.querySelector('h2').textContent === "The model's record" && !d.getElementById('ppRecord') && ![...tab.querySelectorAll('h2')].some(h => /earlier rules|Latest|Backtest/.test(h.textContent)),
    `${what}: the Record tab is the NHL hub's: "The model's record", no props ledger, no earlier rules' table, no latest games, no backtest table`);
  if (U) { let bad = 0, n = 0; const why = [];
    for (const g of R) { const o = recOwnPicks(g, U); if (o.near) continue; n++;
      for (const k of ['ml', 'sp', 'ou']) { const a = o.out[k], b = g.pk && g.pk[k]; if (JSON.stringify(a ? [a.side, a.res] : null) !== JSON.stringify(b ? [b.side, b.res] : null)) { bad++; why.push(`${g.id} ${k}: own ${a ? a.side + ' ' + a.res : 'none'}, published ${b ? b.side + ' ' + b.res : 'none'}`); } } }
    check(!bad, `${what}: every game's picks are the rule's, worked out here from its published numbers and lines (${n} games; ${U.edge * 100}-point edge, sigmas ${U.sigma} and ${U.sigmaTotal})${why.length ? ': ' + why.slice(0, 3).join('; ') : ''}`); }
  const T = recOwnTally(R), tiles = [...tab.querySelectorAll('#recordTotals .stat')].map(x => [x.querySelector('b').textContent, x.querySelector('span').textContent, x.querySelector('b').className]);
  const cl = t => t[0] > t[1] ? 'lime' : t[0] < t[1] ? 'rose' : '';
  const want = [[recWl(T.all.su), 'Straight up', ''], [recRate(T.all.su), 'SU rate', '']].concat(U ? [[recWl(T.all.ml), 'Moneyline picks', cl(T.all.ml)], [recWl(T.all.sp), 'Spread picks', cl(T.all.sp)], [recWl(T.all.ou), 'Totals picks', cl(T.all.ou)]]
    : [['—', 'Moneyline picks', ''], ['—', 'Spread picks', ''], ['—', 'Totals picks', '']]);
  check(JSON.stringify(tiles) === JSON.stringify(want), `${what}: the five tiles, worked out here (${tiles.map(t => t[0] + ' ' + t[1]).join(' | ')})`);
  if (R.length) {
    const rowsOf = id => [...tab.querySelectorAll(`#${id} tbody tr`)].map(tr => [...tr.children].map((c, i) => i === 0 ? ((c.querySelector('.t-wide') || c).textContent) : c.textContent));
    const mName = m => m === 'playoffs' ? 'Playoffs' : new Date(m + '-15T12:00:00Z').toLocaleDateString('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' });
    const cells = t => [recWl(t.su), recRate(t.su), U ? recWl(t.ml) : '—', U ? recWl(t.sp) : '—', U ? recWl(t.ou) : '—'];
    const mw = Object.keys(T.months).sort((a, b) => (a === 'playoffs') - (b === 'playoffs') || (a < b ? -1 : 1)).map(m => [mName(m)].concat(cells(T.months[m])));
    const bw = CONF_OWN.filter(b => T.bands[b[0]]).map(b => [`${b[1]} ${b[2]}`].concat(cells(T.bands[b[0]])));
    check(JSON.stringify(rowsOf('recMonth')) === JSON.stringify(mw), `${what}: By month, a row a month in order, the playoffs last: ${JSON.stringify(rowsOf('recMonth')).slice(0, 160)}`);
    check(JSON.stringify(rowsOf('recBand')) === JSON.stringify(bw), `${what}: By confidence, on the page's one scale (High 75%+, Med 60-74%, Low 55-59%, 50/50 under 55%, this file's own copy) on the model's straight-up chance rounded to a whole percent: ${JSON.stringify(rowsOf('recBand')).slice(0, 160)}`);
    const pills = [...tab.querySelectorAll('#recBand tbody tr')].map(tr => { const c = tr.querySelector('td:first-child .conf'); return c ? [c.className, c.textContent] : null; });
    check(JSON.stringify(pills) === JSON.stringify(CONF_OWN.filter(b => T.bands[b[0]]).map(b => ['conf ' + b[0], b[1]])), `${what}: each band's row leads with its pill, coloured as the cards' (${pills.map(x => x && x.join(' ')).join(', ')})`);
    /* window.NBA_RECORD, the Record tab's scale as the page exports it: its four bands' names and ranges this file's own,
       each game's band and each band's straight-up record the same as worked out here */
    const NR = d.defaultView.NBA_RECORD, nb = NR && typeof NR.bands === 'function' ? NR.bands() : null, nt = NR && typeof NR.tally === 'function' ? NR.tally(R) : null;
    const pOwn = [...R.map(g => g.pHome), 0.745, 0.7449, 0.255, 0.595, 0.5949, 0.405, 0.545, 0.455, 0.5];
    check(JSON.stringify(nb) === JSON.stringify(CONF_OWN.map(b => [b[0], b[1], b[2]])) && pOwn.every(p => NR.band(p) === confOwnOf(confPctOwn(Math.max(p, 1 - p)))[0])
      && nt && JSON.stringify(Object.keys(nt.bands).sort()) === JSON.stringify(Object.keys(T.bands).sort()) && Object.keys(T.bands).every(k => nt.bands[k].su.w === T.bands[k].su[0] && nt.bands[k].su.l === T.bands[k].su[1]),
      `${what}: window.NBA_RECORD gives this file's bands (${nb ? nb.map(b => b.slice(1).join(' ')).join(', ') : 'none'}), each chance's band, the edges among them, and each band's straight-up record`);
    const th = n => [...tab.querySelectorAll('#recMonth thead th, #recBand thead th')].map(t => t.querySelector(n) ? t.querySelector(n).textContent : t.textContent).join('|');
    check(th('.t-wide') === 'When|SU|Rate|ML|Spread|Totals|Model chance|SU|Rate|ML|Spread|Totals' && th('.t-narrow') === 'When|SU|Rate|ML|ATS|O/U|Chance|SU|Rate|ML|ATS|O/U',
      `${what}: both tables headed When (Model chance), SU, Rate, ML, Spread, Totals, written short on a phone (Chance, ATS, O/U)`);
  }
  const note = (d.getElementById('recordNote') || {}).textContent || '';
  check(/^Every game the model called, straight up; and every side it took on the moneyline, the spread or the total, where its chance beat DraftKings' implied by 5 points or more, each graded on the number published before tip-off\./.test(note)
    && (!U || note.includes(`at ${U.price} a side`) && note.includes(`(${U.sigma} and ${U.sigmaTotal} points)`)), `${what}: the note says the rule (${note.slice(0, 80)}…)`);
  const k = st.backtest && st.backtest.player && st.backtest.player.known, fit = (d.getElementById('fitNote') || {}).textContent || '';
  check(!k || (fit.includes(`${(100 * k.fit.acc).toFixed(1)}% of winners called`) && fit.includes(`${(100 * k.holdout.acc).toFixed(1)}% of winners, the margin off by ${k.holdout.mae.toFixed(1)} points`) && fit.includes(k.fit.games.toLocaleString('en-US') + ' games')),
    `${what}: How it was fitted gives the fit and the holdout as published (${fit.slice(-120)})`);
}
/* a made-up season the tab is held to at any hour: picks, pushes, two months and the playoffs, every band */
async function recordMadeUp(real) {
  const U = { edge: 0.05, price: -110, sigma: 14.5, sigmaTotal: 19.1 };
  const G = (id, date, type, as, hs, pHome, spread, total, line, tl, ml) => { const [, , away, home] = id.split('_'); const g = { id, date, type, away, home, awayScore: as, homeScore: hs, pHome, spread, total, line, totalLine: tl, ml, pick: pHome >= 0.5 ? home : away };
    g.su = hs === as ? null : (pHome >= 0.5) === (hs > as); g.pk = recOwnPicks(g, U).out; return g; };
  const record = [
    G('2027_20261021_BOS_NYK', '2026-10-21', 'REG', 100, 110, 0.74, -9, 220, -2.5, 210.5, [180, -220]),      // NYK by 10: SU hit, a cover on NYK, the over
    G('2027_20261023_LAL_GSW', '2026-10-23', 'REG', 115, 101, 0.35, 4, 225, 6.5, 230.5, [-260, 210]),       // LAL by 14
    G('2027_20261028_MIA_ORL', '2026-10-28', 'REG', 99, 103, 0.62, -12, 205, -4, 214, [150, -170]),         // ORL by 4: the model on ORL -4, a push
    G('2027_20261102_DEN_PHX', '2026-11-02', 'REG', 120, 112, 0.55, -1, 236, 2.5, 228.5, [-130, 110]),      // DEN by 8
    G('2027_20261104_CHI_MIL', '2026-11-04', 'REG', 98, 120, 0.66, -5, 240, -7.5, 218, [230, -280]),        // MIL by 22, the model's over landing on the number
    G('2027_20270420_OKC_DAL', '2027-04-20', 'POST', 108, 104, 0.52, -0.5, 211, 1.5, 219.5, [-125, 105]),   // OKC by 4, a playoff game
    /* the scale's edges, on the chance rounded to a whole percent: 74.95% shows 75% and is High; 54.49999...% (1 - 0.455)
       shows 54% and is 50/50; 74.49% shows 74% and is Med */
    G('2027_20261025_SAC_POR', '2026-10-25', 'REG', 101, 99, 0.2505, 7, 230, 5.5, 231, [-240, 200]),     // SAC by 2: High
    G('2027_20261030_ATL_BKN', '2026-10-30', 'REG', 110, 108, 0.455, 1, 226, 1.5, 224, [-115, -105]),   // ATL by 2: 50/50
    G('2027_20261106_PHI_CHA', '2026-11-06', 'REG', 104, 112, 0.7449, -6, 221, -4.5, 225, [190, -230]),  // CHA by 8: Med
  ];
  const st = { ...JSON.parse(JSON.stringify(real)), record, recordRule: U };
  check(CONF_OWN.every(b => recOwnTally(record).bands[b[0]]) && recOwnTally(record).bands.high.su[0] === 1 && JSON.stringify(recOwnTally(record).bands.coin.su) === '[1,1]',
    'the made-up season has a game in every band of the scale, its edges among them (74.95% High, 54.5% 50/50 by the away side)');
  check(record.every(g => g.pk) && Object.values(record).some(g => g.pk.sp && g.pk.sp.res === 'push') && record.some(g => g.pk.ml) && record.some(g => g.pk.ou) && record.some(g => g.pk.ou && g.pk.ou.res === 'push'),
    'the made-up season has moneyline, spread and total picks, a spread pushed and a total on the number');
  let { w, errors } = load('index.html', st); await sleep(300);
  await recordChecks(w.document, st, 'a made-up season');
  const months = [...w.document.querySelectorAll('#recMonth tbody tr td:first-child')].map(c => c.querySelector('.t-narrow') ? c.querySelector('.t-narrow').textContent : c.textContent);
  check(JSON.stringify(months) === '["Oct 2026","Nov 2026","Playoffs"]', `the months, short for a phone: ${months.join(', ')}`);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  /* a state from before the picks (no recordRule): the straight-up record alone, the picks' tiles a dash, nothing thrown */
  const old = { ...st, recordRule: undefined, record: record.map(g => { const x = { ...g }; delete x.pk; return x; }) };
  ({ w, errors } = load('index.html', old)); await sleep(300);
  await recordChecks(w.document, old, 'a state from before the picks');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  /* no game graded yet: the tiles at nothing and the empty line, no tables */
  const none = { ...st, record: [] };
  ({ w, errors } = load('index.html', none)); await sleep(300);
  w.document.querySelector('#nav button[data-tab=record]').click(); await sleep(30);
  check(/Nothing graded yet/.test(w.document.getElementById('tab-record').textContent) && !w.document.getElementById('recMonth') && w.document.querySelector('#recordTotals .stat b').textContent === '0-0' && errors.length === 0, 'with nothing graded: the tiles at 0-0 and the empty line, no tables');
}

(async () => {
  let w, errors;
  if (run('base')) {
  console.log('0. the published state, as it is');
  {
    const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
    const csvRows = fs.readFileSync(path.join(ROOT, 'data', 'games.csv'), 'utf8').trim().split('\n'); const head = csvRows.shift().split(',');
    const rows = csvRows.map(l => { const v = l.split(','); const o = {}; head.forEach((k, i) => { o[k] = v[i] ?? ''; }); return o; });
    const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
    const want = rows.filter(g => g.date >= addD(real.today, -1) && g.date <= addD(real.today, 10)).map(g => g.game_id).sort();
    const have = real.slate.map(g => g.id).sort();
    check(JSON.stringify(want) === JSON.stringify(have), `the slate is every game in games.csv from yesterday to ten days out (${have.length} of ${want.length})`);
    const soon = real.slate.filter(g => g.status === 'scheduled' && g.type !== 'PRE' && g.tip && Date.parse(g.tip) > Date.now() && Date.parse(g.tip) - Date.now() < 24 * 3600e3);
    check(soon.every(g => g.model && [g.model.pHome, g.model.spread, g.model.total].every(Number.isFinite)), `every regular-season game tipping in the next 24 hours has the model's numbers (${soon.length})`);
    const nums = JSON.stringify(real).match(/:NaN|:null,"spread":null/g);
    check(!nums, 'no NaN in the published state');
    check(real.slate.every(g => g.away && g.home && g.away !== g.home), 'every game on the slate has both its teams');
    check(real.season >= Math.max(...rows.filter(g => g.status === 'final').map(g => +g.season)), "the published season is no older than the latest final's");
    /* what a player's leg is graded from: the box score of every regular-season and playoff final of the last seven
       days, worked out here from games.csv and data/box_<season>.csv (one line a player who played: points, rebounds
       from the offensive and defensive boards, assists, threes, steals, blocks; a player who did not play is not there,
       a final not boxed yet not at all) */
    {
      const wantBoxes = today => { const from = addD(today, -7), want = {}, files = {};
        for (const g of rows.filter(g => g.status === 'final' && g.type !== 'PRE' && g.date >= from && g.date <= today)) {
          const f = path.join(ROOT, 'data', `box_${g.season}.csv`); if (!fs.existsSync(f)) continue;
          if (!files[f]) { const lines = fs.readFileSync(f, 'utf8').trim().split('\n'), h = lines.shift().split(','); files[f] = { h, rows: lines.map(l => l.split(',')) }; }
          const { h, rows: br } = files[f], ix = k => h.indexOf(k);
          for (const v of br) { if (v[ix('game_id')] !== g.game_id) continue; want[g.game_id] = want[g.game_id] || {};
            if (v[ix('dnp')] !== '1') want[g.game_id][v[ix('player_id')]] = ['pts', 'orb', 'ast', 'tpm', 'stl', 'blk'].map((k, i) => i === 1 ? +v[ix('orb')] + +v[ix('drb')] : +v[ix(k)]); }
        }
        return { from, want }; };
      const sortK = o => JSON.stringify(Object.keys(o).sort().map(k => [k, Object.keys(o[k]).sort().map(p => [p, o[k][p]])]));
      const rb = real.boxes, { from, want } = wantBoxes(real.today);
      check(rb && rb.from === from && rb.days === 7 && JSON.stringify(rb.line) === '["pts","reb","ast","tpm","stl","blk"]' && sortK(rb.games) === sortK(want),
        `the published box lines are every final of the last seven days with its box read, worked out from games.csv and the box files (${Object.keys(want).length} games)`);
      /* and the same rule mid-season, on a day of last season, where the window is full: publish.js's own boxesState */
      const mid = '2026-03-10', pb = require('./publish').boxesState(require('./lib').readGames(), mid), mw = wantBoxes(mid);
      const nPl = Object.values(mw.want).reduce((t, g) => t + Object.keys(g).length, 0);
      check(pb.from === mw.from && sortK(pb.games) === sortK(mw.want) && Object.keys(mw.want).length > 40 && nPl > 800,
        `on ${mid}, mid-season, publish.js gives the same: ${Object.keys(mw.want).length} finals, ${nPl} player lines, every player who played and no other, rebounds from both boards`);
      const ct = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corr.json'), 'utf8'));
      check(real.corr && real.corr.hold === ct.hold.value && real.corr.holdTested === false && real.corr.measured === ct.measured && JSON.stringify(real.corr.rho) === JSON.stringify(ct.rho) && JSON.stringify(real.corr.refused) === JSON.stringify(ct.refused.pairs),
        "the published same-game table is data/corr.json's: every rho, the refused pairs and the hold, said untested");
    }
    ({ w, errors } = load('index.html', real));
    await sleep(300);
    const d0 = w.document;
    const shown = d0.querySelector('#days .day.on');
    check(!real.slate.length || (shown && d0.querySelectorAll('#slate .card').length === real.slate.filter(g => g.date === shown.dataset.d).length), 'the board draws a card for every game of the day shown');
    for (const tab of ['slate', 'teams', 'players', 'coaches', 'record', 'parlay']) {
      d0.querySelector(`#nav button[data-tab=${tab}]`).click(); await sleep(30);
      const txt = d0.getElementById('tab-' + tab).textContent;
      check(!/\bNaN\b|\bundefined\b/.test(txt), `the real ${tab} tab shows no NaN or undefined`);
    }
    /* the ladder: each overall Elo is the published rating, worn with the tier its number falls in, and the tier
       counts above each table add up to the ranked */
    const TIER_AT = [['HOF', 1750], ['Elite', 1700], ['Master', 1650], ['Diamond', 1600], ['Platinum', 1550], ['Gold', 1500], ['Silver', 1450], ['Bronze', 1400], ['Iron', 1350], ['Wood', -Infinity]];
    const tierOf = v => TIER_AT.find(t => v >= t[1])[0];
    for (const [tab, list, what] of [['players', real.players, 'player'], ['coaches', real.coaches, 'coach']]) {
      d0.querySelector(`#nav button[data-tab=${tab}]`).click(); await sleep(30);
      const tp = d0.getElementById('tab-' + tab), rows = [...tp.querySelectorAll('.tbl tbody tr')];
      const best = [...list].sort((a, b) => b.rating - a.rating)[0], cell = rows[0] && rows[0].querySelector('.elocell');
      check(cell && cell.querySelector('b').textContent === String(best.rating) && cell.querySelector(`.tierbadge.tier-${tierOf(best.rating).toLowerCase()}`) && rows[0].textContent.includes(best.name),
        `the ${tab} table leads with the top ${what}'s overall Elo (${best.name}, ${best.rating}) in his tier (${tierOf(best.rating)})`);
      check(rows.every(r => { const c = r.querySelector('.elocell'); if (!c) return false; const v = +c.querySelector('b').textContent; return c.querySelector(`.tierbadge.tier-${tierOf(v).toLowerCase()}`); }), `every ${what} row wears the shield its number falls in`);
      const ladderN = [...tp.querySelectorAll('.tierladder .t .muted')].reduce((a, x) => a + +x.textContent.split('·')[1], 0);
      check(ladderN === list.filter(x => x.ranked).length && ladderN > 0, `the ${tab} ladder counts the ${list.filter(x => x.ranked).length} ranked`);
    }
    check(d0.getElementById('tierDefs') && d0.getElementById('tierDefs').closest('section') === null && d0.querySelector('#tierDefs #tg-gold') && [...d0.querySelectorAll('.tier-hof')].every(b => { const f = b.querySelector('path[fill^="url"]'), id = f && f.getAttribute('fill').slice(5, -1); return id && b.querySelector('#' + id + ' animateTransform'); }), "the shields' gradients are in the page once, outside every hidden tab, and each HOF gem carries its own turning gradient");
    d0.querySelector('#nav button[data-tab=teams]').click(); await sleep(30);
    check(d0.querySelectorAll('#tab-teams .tbl tbody tr .elocell .tierbadge').length === 30, "every team's strength wears its shield");
    await recordChecks(d0, real, 'the real state');
    if (real.slate.length) for (const b of [...d0.querySelectorAll('#days .day')]) { b.click(); await sleep(15); }
    check(errors.length === 0, 'every day of the real slate draws without a script error: ' + errors.join(' | '));
  }

  console.log('1. fresh visitor, tonight');
  ({ w, errors } = load('index.html', withGames(false)));
  await sleep(250);
  const d = w.document;
  check(/Updated/.test(d.getElementById('stamp').textContent), 'update stamp shown');
  check(d.querySelectorAll('.card').length === 1, 'one game card for today');
  check(d.querySelector('.card .badge.pick').textContent === 'NYK', 'the model pick is highlighted');
  check(/Some Star/.test(d.querySelector('.card .out').textContent), 'the absentee is listed');
  check(d.getElementById('dataTabBtn').hidden === true, 'no Data tab on the viewer');
  for (const tab of ['teams', 'players', 'coaches', 'record', 'parlay']) {
    d.querySelector(`#nav button[data-tab=${tab}]`).click(); await sleep(30);
    check(!d.getElementById('tab-' + tab).hidden && d.getElementById('tab-' + tab).innerHTML.length > 200, `tab ${tab} renders`);
  }
  check(!d.querySelector('#nav button[data-tab=mine]') && !d.querySelector('#nav button[data-tab=about]') && !d.getElementById('tab-mine') && !d.getElementById('tab-about'), 'My Picks and How it works are gone');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  for (const gone of ['mine', 'about']) {
    const r = load('index.html', withGames(false), null, null, gone); await sleep(250);
    check(!r.w.document.getElementById('tab-slate').hidden && r.w.document.querySelector('#nav button[data-tab=slate]').getAttribute('aria-selected') === 'true' && !r.errors.length,
      `a browser that last had ${gone === 'mine' ? 'My Picks' : 'How it works'} open opens on Tonight`);
  }

  console.log('2. the Parlay Builder from a game on the board');
  /* two games tonight (ids of three characters or more: the choices keep only ids of a game's shape), and a Bet Build an
     earlier page kept in this browser */
  const two = { ...state, slate: [fake('tq1', state.today, false), { ...fake('tq2', state.today, false), away: 'LAL', home: 'GSW' }, fake('tq0', yesterday, true)] };
  const kept2 = { picks: {}, build: [{ id: 'b1', day: state.today, type: 'single', stake: 20, legs: [{ id: 'tq1', kind: 'ml', side: 'NYK', odds: -140 }] }], bank: { amt: 35, suggStake: 10 }, slip: { legs: [], stake: 20 } };
  ({ w, errors } = load('index.html', two, kept2));
  await sleep(250);
  { const d2 = w.document;
    d2.querySelector('.card[data-id="tq1"] .team.away .badge').click(); await sleep(30);
    let mine = JSON.parse(w.localStorage.getItem('nba_hub_2027') || '{}');
    check(!d2.querySelector('.card [data-act=pick]') && !Object.keys(mine.picks || {}).length && !d2.querySelector('.card .badge.mine'), "the team badges show the model's pick and take none");
    check(d2.querySelectorAll('.card [data-act=plan]').length === 2 && !d2.querySelector('.card[data-id="tq0"] [data-act=plan]'), 'each game to come on the lines feed\'s dates has a Parlay Builder button, a final none');
    d2.querySelector('.card[data-id="tq1"] [data-act=plan]').click(); await sleep(80);
    mine = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
    const gl2 = [...d2.querySelectorAll('#pbPanel [data-pb-game]')];
    check(!d2.getElementById('tab-parlay').hidden && gl2.length === 2 && gl2.find(x => x.dataset.pbGame === 'tq1').checked && !gl2.find(x => x.dataset.pbGame === 'tq2').checked,
      "the card's Parlay Builder button opens the builder with that game alone ticked, so its Top 50 lines are that game's");
    check(mine.pb && JSON.stringify(mine.pb.off) === '["tq2"]' && PB_KINDS_OWN.every(k => mine.pb.k[k] === true), "the choice is the visitor's own, in the page's key: the other game unticked, every bet type as it was");
    check(!d2.getElementById('bkBuild') && !d2.getElementById('bkPlan') && !d2.getElementById('bkSuggest') && mine.build.length === 1 && mine.build[0].id === 'b1' && mine.bank.amt === 35,
      "the earlier plan, suggestions and Bet Build are gone from the tab, and what this browser kept for them stays in its storage, undrawn");
    check(errors.length === 0, 'no script errors: ' + errors.join(' | ')); }

  console.log('3. a bet graded as a book settles it (the settlement X Parlays and the suggestions record grade by)');
  ({ w, errors } = load('index.html', withGames(true)));
  await sleep(250);
  { const gq = b => JSON.parse(w.eval(`JSON.stringify(NBA_GRADE.gradeBet(${JSON.stringify(b)}))`));
    const g1 = gq({ type: 'single', stake: 20, legs: [{ id: 't1', kind: 'ml', side: 'NYK', odds: -140 }] });
    check(g1.st === 'won' && Math.abs(g1.ret - 20 * (1 + 100 / 140)) < 1e-9, `a straight bet on NYK at -140 the morning after its final, 105-98: won, $20 returns $34.29 (${g1.st}, ${g1.ret.toFixed(2)})`);
    check(errors.length === 0, 'no script errors: ' + errors.join(' | ')); }
  console.log('3b. weeks later: the game has left the slate');
  const realId = '2027_' + state.today.replace(/-/g, '') + '_BOS_NYK';
  const gone = { ...state, slate: [], record: [], finals: { [realId]: [98, 105] } };
  ({ w, errors } = load('index.html', gone));
  await sleep(250);
  { const g3 = JSON.parse(w.eval(`JSON.stringify(NBA_GRADE.gradeBet(${JSON.stringify({ type: 'single', stake: 10, legs: [{ id: realId, kind: 'ml', side: 'NYK', odds: -140 }] })}))`));
    check(g3.st === 'won', 'a bet still grades from the published finals');
    check(errors.length === 0, 'no script errors: ' + errors.join(' | ')); }

  console.log('3e. games that have tipped off');
  const tipped = () => ({ ...state, slate: [
    { ...fake('xq1', state.today, false), tip: tipIn(-3600e3) },
    { ...fake('xq2', state.today, false), away: 'LAL', home: 'GSW', ml: { home: -220, away: 180 }, model: { ...fake('xq2', state.today, false).model, pHome: 0.70 }, tip: tipIn(1500) },
    { ...fake('xq3', state.today, false), away: 'MIA', home: 'ORL', ml: { home: -175, away: 150 }, model: { ...fake('xq3', state.today, false).model, pHome: 0.65 } } ] });
  { const r6 = load('index.html', tipped());
    await sleep(250);
    const d6 = r6.w.document, c1 = d6.querySelector('.card[data-id="xq1"]');
    check(c1 && /Tipped off/.test(c1.querySelector('.tags').textContent), 'a game past its tip time is tagged Tipped off');
    check(c1 && !c1.querySelector('[data-act=plan]'), 'it has no Parlay Builder button');
    d6.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
    const ids = () => [...d6.querySelectorAll('#pbPanel [data-pb-game]')].map(x => x.dataset.pbGame).join();
    check(ids() === 'xq2,xq3', `the builder's games leave it out and keep the two games to come (${ids()})`);
    await sleep(1600);                                                         // xq2 tips while the page is open
    for (const t of r6.timers.filter(t => t.k === 'setInterval' && t.ms === 30000)) t.fn();
    await sleep(30);
    check(ids() === 'xq3', `at the builder's half-minute look, the game that tipped leaves the list (${ids()})`);
    check(r6.errors.length === 0, 'no script errors: ' + r6.errors.join(' | ')); }

  console.log('6. a postponed game, a graded game off the slate, the import, a stale injury report');
  {
    const ago = n => { const x = new Date(state.today + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
    const gid = (n, a, h) => `${state.season}_${ago(n).replace(/-/g, '')}_${a}_${h}`;
    const pp = gid(3, 'BOS', 'NYK'), fresh = gid(1, 'MIA', 'ORL'), done = gid(4, 'LAL', 'GSW'), graded = gid(5, 'DEN', 'UTA'), waiting = gid(6, 'PHI', 'CHA');
    const ancient = `${state.season - 2}_20241105_LAL_GSW`;
    const st6 = { ...state, slate: [], finals: { [done]: [100, 110] }, pending: [waiting],
      record: [{ id: graded, date: ago(5), away: 'DEN', home: 'UTA', awayScore: 120, homeScore: 101, pHome: 0.22, spread: 9.1, total: 231, line: 8.5, totalLine: 230, pick: 'DEN', su: true, ats: true, ou: false, teamPick: 'DEN' }] };
    const mine6 = { picks: { [pp]: 'NYK' }, build: [
      { id: 'v4', day: ago(6), type: 'single', stake: 10, legs: [{ id: waiting, kind: 'ml', side: 'PHI', odds: 110 }] },
      { id: 'v5', day: ago(5), type: 'single', stake: 10, legs: [{ id: graded, kind: 'ml', side: 'DEN', odds: 200 }] },
      { id: 'v1', day: ago(3), type: 'single', stake: 10, legs: [{ id: pp, kind: 'ml', side: 'NYK', odds: -140 }] },
      { id: 'v2', day: ago(4), type: 'parlay', stake: 10, legs: [{ id: pp, kind: 'ml', side: 'NYK', odds: -140 }, { id: done, kind: 'ml', side: 'GSW', odds: 150 }] },
      { id: 'v3', day: ago(1), type: 'single', stake: 10, legs: [{ id: fresh, kind: 'ml', side: 'ORL', odds: -120, est: 'model' }] }] };
    ({ w, errors } = load('index.html', st6, mine6));
    await sleep(250);
    const d7 = w.document;
    d7.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
    const gq = b => JSON.parse(w.eval(`JSON.stringify(NBA_GRADE.gradeBet(${JSON.stringify(b)}))`)), G = Object.fromEntries(mine6.build.map(b => [b.id, gq(b)]));
    check(G.v1.st === 'void' && G.v1.ret === 10, 'a straight bet on it is void, the stake back');
    check(G.v2.st === 'won' && Math.abs(G.v2.ret - 25) < 1e-9, 'a parlay drops the void leg and pays on the rest: GSW +150 returns $25 on $10');
    check(G.v3.st === 'pending', 'a game from yesterday is still open: a day is not enough to call it off');
    check(G.v4.st === 'pending', 'a bet on a game played whose final is not read yet is open, not void');
    check(G.v5.st === 'won' && Math.abs(G.v5.ret - 30) < 1e-9, 'a bet on a graded game off the slate grades from the record: DEN +200 returns $30 on $10');
    check(!d7.getElementById('bkBuild') && JSON.parse(w.localStorage.getItem('nba_hub_2027')).build.length === 5, "and the Bet Build this browser kept is not drawn, and stays in its storage as it was");
    check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

    const stale = { ...withGames(false), injuriesAsOf: ago(1) };
    ({ w, errors } = load('index.html', stale));
    await sleep(250);
    check(/Injury report as of/.test(w.document.getElementById('slate').textContent), "a day-old injury report is said on the board");
    ({ w, errors } = load('index.html', { ...withGames(false), injuriesAsOf: state.today }));
    await sleep(250);
    check(!/Injury report as of/.test(w.document.getElementById('slate').textContent), "today's is not");
    ({ w, errors } = load('index.html', { ...withGames(false), today: ago(1), injuriesAsOf: ago(1) }));
    await sleep(250);
    check(!/Injury report as of/.test(w.document.getElementById('slate').textContent), "nor last night's file before the morning run: the read did not fail");

    ({ w, errors } = load('admin.html', withGames(false), { picks: { t1: 'BOS' }, build: [] }));
    await sleep(250);
    w.document.querySelector('#nav button[data-tab=data]').click(); await sleep(30);
    const imp = txt => w.document.getElementById('imp').onchange({ target: { files: [{ text: async () => txt }] } });
    for (const junk of ['{"season":2027,"slate":[]}', '[]', 'null', '{"picks":[1,2]}', 'not json']) { imp(junk); await sleep(20); }
    let kept = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
    check(kept.picks.t1 === 'BOS' && /Not a backup file/.test(w.document.getElementById('toast').textContent), 'an import that is not a backup is refused and the picks stay');
    imp(JSON.stringify({ picks: { t1: 'NYK' }, bank: {}, build: [] })); await sleep(20);
    kept = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
    check(kept.picks.t1 === 'NYK', 'a real backup is restored');
    check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  }
  console.log('4. admin page');
  ({ w, errors } = load('admin.html', withGames(false)));
  await sleep(250);
  check(w.document.getElementById('dataTabBtn').hidden === false, 'Data tab on admin');
  w.document.querySelector('#nav button[data-tab=data]').click(); await sleep(30);
  check(/generated/.test(w.document.getElementById('tab-data').textContent), 'Data tab renders');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('5. a preseason night');
  /* with today's injury report: a published file a day old puts its stale-report note first (section 6 covers it) */
  const preDay = { ...state, opening: '2099-01-01', injuriesAsOf: state.today, slate: [{ ...fake('p1', state.today, false), type: 'PRE' }] };
  ({ w, errors } = load('index.html', preDay));
  await sleep(250);
  const d5 = w.document;
  check(d5.querySelectorAll('.card').length === 1, 'the preseason game has a card');
  check(/Preseason/.test(d5.querySelector('.card .tags').textContent), 'it is tagged Preseason');
  check(/Preseason\./.test(d5.querySelector('#slate .note').textContent) && /never graded/.test(d5.querySelector('#slate .note').textContent), 'the preseason note explains it is not graded');
  check(/Opening night/.test(d5.querySelector('#slate .note').textContent), 'the note gives opening night');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  }
  /* a section that throws (a check reading what a broken page never drew) is a failure, never a quiet stop */
  const guard = async (k, fn) => { if (!run(k)) return; try { await fn(); } catch (e) { check(false, `section ${k} threw: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`); } };
  await guard('7', refreshOdds);
  await guard('8', playerProps);
  await guard('9', builder);
  await guard('10', ratingHistory);
  await guard('12', pickemRecord);
  await guard('lines', linesFeed);
  /* the confidence pill on Tonight's cards and the key over them (README "The site"), on made-up edges and the real state */
  await guard('conf', confChecks);
  /* the Record tab, the NHL hub's layout, on a made-up season at any hour */
  await guard('record', async () => { console.log('record. the Record tab, laid out as the NHL hub\'s'); await recordMadeUp(JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'))); });
  /* X Parlays (README "X Parlays"): its own file, tools/smoke_xparlays.js, on this harness's checks */
  await guard('xparlays', () => require('./smoke_xparlays')({ check, pageFile, ROOT }));
  /* the Parlay Builder (README "Parlay Builder"): its own file, tools/smoke_parlay.js, on this harness's checks */
  await guard('pb', () => require('./smoke_parlay')({ check, pageFile, ROOT }));
  /* the parlay card (README "The parlay card"): its own file, tools/smoke_card.js */
  await guard('card', () => require('./smoke_card')({ check, pageFile, ROOT }));
  /* the matchup bubble (README "The matchup bubble"): its own file, tools/smoke_glance.js */
  await guard('glance', () => require('./smoke_glance')({ check, pageFile, ROOT }));
  /* Suggested Parlays (README "Suggested Parlays"): its own file, tools/smoke_suggested.js, on this harness's checks */
  await guard('sp', () => require('./smoke_suggested')({ check, pageFile, ROOT }));
  /* a game's three windows (README "The game's three windows"): its own file, tools/smoke_gamewin.js */
  await guard('gw', () => require('./smoke_gamewin')({ check, pageFile, ROOT }));

  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
