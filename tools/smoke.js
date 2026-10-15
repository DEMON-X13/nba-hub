/* Smoke test for the built viewer.
 *
 *   node tools/smoke.js        (needs jsdom: npm install in tools/)
 *
 * Loads index.html in jsdom with fetch stubbed to serve state.json plus one fabricated
 * game for tonight, and checks: the update stamp shows, every tab renders without a script error, a
 * visitor's pick is kept in their own storage and shows on My Picks, a parlay leg reaches the ticket
 * and a saved ticket grades once the game is final, the Data tab is only on the admin page, a preseason
 * game shows with its tag and the not-graded note, and a game that has tipped off (by its tip time, though the
 * published file still calls it scheduled) can no longer be picked, planned, suggested or locked in, including
 * from a page drawn before the tip. Section 0 renders the real published state as it is and holds it to
 * data/games.csv; section 6 covers a postponed game (void), a graded game's model pick once it has left the slate,
 * the backup import, a day-old injury report and a suggested tier short of its aim. Section 7 is Refresh odds on a
 * stubbed ESPN: nothing read on load, on any timer the page sets (each fired at once) or on focus and visibility, a
 * press taking fresh lines into everything priced from them, a started game (by its tip, ESPN's status or ESPN's own
 * tip), a failed day and a game with no line left as they were and the status line saying what stands (published, an
 * earlier press's read, or no line yet), nothing stored, and the page's parse held to fetch.js's on the answers
 * recorded in tools/fixtures/. Section 8 is the player props view (README "Player props"): the props read on the same
 * press (by ESPN's ids, only games still to come, two pages, a 404, junk, a refusal, a game that tips during its read),
 * every line, rung and Yes price the sheet shows worked out here on its own, the model on trial and suggesting nothing,
 * nothing read before a press, nothing stored, a reload, the shadow ledger's running numbers, and the page's copies of
 * tools/props_feed.js and tools/props.js held to their text and results.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
/* NBA_HTML tries another page in place of index.html (a deliberately broken copy, to show a check fails on it);
   SMOKE_ONLY=base,7,8,9 runs those sections alone (base is 0 to 6) */
const pageFile = page => page === 'index.html' && process.env.NBA_HTML ? path.resolve(process.env.NBA_HTML) : path.join(ROOT, page);
const ONLY = (process.env.SMOKE_ONLY || '').split(',').filter(Boolean), run = k => !ONLY.length || ONLY.includes(k);
/* files the page may read beside state.json (data/box_<season>.csv, for a leg older than the state's box window):
   url pattern -> text, set by a test; every other request fails as before */
let FILES = [];

const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
/* the page labels days against the viewer's Eastern date, so the fixtures use that date too */
state.today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const side = t => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [{ id: '1', name: 'Some Guard', pos: 'G', min: 34, o: 20, d: 10, adds: 21 }], out: [{ id: '2', name: 'Some Star', status: 'Out', min: 33, costs: 60 }] });
/* a game to come tips three hours from now, whatever the hour the test runs */
const tipIn = ms => new Date(Date.now() + ms).toISOString();
const fake = (id, date, fin) => ({ id, date, tip: fin ? date + 'T23:30:00Z' : tipIn(3 * 3600e3), type: 'REG', away: 'BOS', home: 'NYK', neutral: false, status: fin ? 'final' : 'scheduled', awayScore: fin ? 98 : null, homeScore: fin ? 105 : null,
  line: -2.5, totalLine: 220, ml: { home: -140, away: 120 }, model: { pHome: 0.61, spread: -3.5, total: 224.5, pace: 99, home: side('NYK'), away: side('BOS') }, team: { pHome: 0.55, spread: -1.5 }, published: null });
/* the second game is yesterday's final: always a different day from today, including on the 1st of a month */
const yesterday = (() => { const d = new Date(state.today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
const withGames = (fin) => ({ ...state, slate: [fake('t1', state.today, fin), fake('t0', yesterday, true)] });

/* every request the page makes is recorded; ESPN's scoreboard answers from `espn` (url, options) when a test gives
   one, and fails otherwise. Every timer the page sets is recorded too (and still runs), so provoke() below can fire it */
function load(page, st, mine, espn) {
  const html = fs.readFileSync(pageFile(page), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const errors = [], requests = [], scrolls = [], timers = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
        if (/espn\.com/.test(url)) return espn ? espn(url, opt) : { ok: false, status: 404, json: async () => ({}) };
        const file = FILES.find(f => f[0].test(url)); if (file) return { ok: true, status: 200, text: async () => file[1], json: async () => { throw new SyntaxError('not JSON'); } };
        return { ok: /state\.json/.test(url), status: 200, json: async () => JSON.parse(JSON.stringify(st)) }; };   // a fresh copy, as a browser parses one
      w.scrollTo = (x, y) => scrolls.push(y); w.URL.createObjectURL = () => 'blob:x';
      if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };            // jsdom has no CSS.escape; the lineups button uses it
      if (mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(mine));
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
  for (const tab of ['teams', 'players', 'coaches', 'record', 'mine', 'about', 'parlay', 'slate']) { d.querySelector(`#nav button[data-tab=${tab}]`).click(); await sleep(20);
    if (tab === 'teams') check(bar.hidden, 'the bar is not on the Teams tab');
    if (tab === 'parlay') check(!bar.hidden, 'it is on the Parlay Builder'); }
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

  /* the Parlay Builder works from the fresh prices */
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const row = id => d.querySelector(`#bkPlan tr[data-gid="${id}"]`);
  check(row(r1.id) && /-250/.test(row(r1.id).textContent) && !row(r1.id).querySelector('sup'), "the plan prices NYK at DraftKings' fresh -250");
  check(row(r2.id) && row(r2.id).querySelector('.vg.differs') && /\+150/.test(row(r2.id).textContent), 'GSW is now the underdog at +150: the Vegas pick is LAL, outlined where it differs from the model');
  check(row(r3.id) && /-175/.test(row(r3.id).textContent) && !row(r3.id).querySelector('sup'), "ORL's estimated price gives way to the book's -175 (no est mark)");
  check(row(r5.id) && /-165/.test(row(r5.id).textContent), 'PHI keeps its published -165');
  const safe = d.querySelector('#bkSuggest .sugg-tier.safe');
  const pS = mktP(-250, 205) * mktP(-175, 150), decS = amToDecT(-250) * amToDecT(-175);
  const amS = decS >= 2 ? Math.round((decS - 1) * 100) : Math.round(-100 / (decS - 1));
  check(safe && /NYK/.test(safe.textContent) && /ORL/.test(safe.textContent) && !/GSW/.test(safe.textContent), 'Safe is now NYK + ORL: GSW left it when the market turned against it');
  check(safe && safe.textContent.includes(`${Math.round(pS * 100)}%`) && safe.textContent.includes(`+${amS}`), `and its chance and odds are the fresh prices' (${Math.round(pS * 100)}%, +${amS})`);

  /* a second press reads again, here from the Parlay Builder, which is redrawn in place */
  r1Fresh = { details: 'NY -7', total: 227, hml: '-270', aml: '+220' };
  answers[ymd(r1.date)].events[0] = espnEvent(r1, r1Fresh);
  const days2 = new Set([r1, r2, r3, r5, r6, r7, r9, r10].map(g => ymd(g.date))).size;
  btn.click(); await idle();
  check(sbReqs(requests).length === reqs.length + days2, `a second press after the first read reads again (${days2} days: r8 has tipped since)`);
  check(row(r1.id) && /-270/.test(row(r1.id).textContent), 'the Parlay Builder in view is redrawn with the newer price (-270)');
  d.querySelector('#bkSuggest [data-sugg-lock="safe"]').click(); await sleep(30);
  const b7 = JSON.parse(w.localStorage.getItem('nba_hub_2027')).build;
  check(b7.length === 1 && b7[0].legs.some(l => l.side === 'NYK' && l.odds === -270) && b7[0].legs.some(l => l.side === 'ORL' && l.odds === -175), 'Lock in records the fresh prices');
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
   DraftKings' player props on the Refresh odds press, and the props model on trial beside them (README "Player
   props"). ESPN is the stub above: the scoreboard answers each game as scheduled with its published lines (so nothing
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
     writes */
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
  const p2 = og('LAL', 'GSW', 5 * 3600e3, { espn: '' });
  const p3 = og('MIA', 'ORL', 3 * 3600e3, { espn: '401900003' });
  const p4 = og('PHI', 'CHA', 3 * 3600e3, { espn: '401900004' });
  const p5 = og('DEN', 'UTA', -3600e3, { espn: '401900005' });
  const p6 = og('ATL', 'BKN', 3 * 3600e3, { espn: '401900006' });
  const p7 = og('TOR', 'CLE', 3 * 3600e3, { espn: '401900007' });
  const p8 = og('POR', 'HOU', 3600e3, { espn: '401900008' });          // its tip is moved to just after the press, below
  const p10 = og('SAC', 'PHX', 30 * 60e3, { espn: '401900010' });      // ESPN's tip is set a minute before the press, below
  const games = [p1, p2, p3, p4, p5, p6, p7, p8, p10];
  const eid = { [p1.id]: '401909088', [p2.id]: '401900002', [p3.id]: '401900003', [p4.id]: '401900004', [p5.id]: '401900005', [p6.id]: '401900006', [p7.id]: '401900007', [p8.id]: '401900008', [p10.id]: '401900010' };
  const lal = { '9000001': ['Lal Guard', 'LAL', 'G', 34.2, 25.3, 5.1, 6.2, 2.8, 1.1, 0.4, 0.21, 0.02], '9000002': ['Gsw Center', 'GSW', 'C', 30.0, 15.5, 11.8, 2.1, 0.2, 0.7, 1.9, 0.55, 0.01], '9000003': ['Gsw Wing', 'GSW', 'F', 22.0, 9.0, 4.0, 1.5, 1.4, 0.6, 0.3, 0.02, 0] };
  const props8 = { onTrial: true, build: RP.build || '2026-10-15T09:09Z', asOf: RP.asOf || '2026-06-13', fitSeasons: RP.fitSeasons || '2023-2026', horizonGameDays: 5, minShown: 8,
    stats: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'], combos: { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] },
    layout: ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'], dist: { kind: 'negative binomial', var: RP.dist && RP.dist.var ? RP.dist.var : VAR0 },
    fair: PJ.FAIR, ledger: RP.ledger || LEDGER0, research: RP.research || null };
  props8.games = { [p1.id]: { tip: p1.tip, away: 'BOS', home: 'DET', players: JSON.parse(JSON.stringify(bosDet.players)) }, [p2.id]: { tip: p2.tip, away: 'LAL', home: 'GSW', players: lal } };
  const st8 = { ...state, generated: tipIn(-3600e3), injuriesAsOf: state.today, props: props8, slate: games.map(g => JSON.parse(JSON.stringify(g))) };
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
  const banned = t => /\bedge\b|model says/i.test(t);

  /* before any press: the model's projections, and nothing read */
  check(!sheet() || sheet().hidden, 'the props sheet is closed on load');
  for (const g of [p1, p2, p3, p4, p6, p7, p8, p10]) { const b = cardBtn(g); check(b && b.tagName === 'BUTTON' && /^Player props$/.test(b.textContent.trim()) && b.getAttribute('aria-haspopup') === 'dialog', `${g.away} at ${g.home}'s card has a Player props button, a real button, before any press`); }
  check(!cardBtn(p5), 'a game that has tipped off has none');
  check(w.getComputedStyle(cardBtn(p1)).minHeight === '44px', 'it is 44px tall');
  const storedNoTab = win => { const o = JSON.parse(stored(win)); delete o[0]['nba_hub_2027:tab']; return JSON.stringify(o); };
  const before = storedNoTab(w);
  const opener = cardBtn(p1); opener.focus(); opener.click(); await sleep(30);
  check(!sheet().hidden && d.getElementById('ppSheet').getAttribute('role') === 'dialog' && d.getElementById('ppSheet').getAttribute('aria-modal') === 'true' && d.getElementById('ppSheet').getAttribute('aria-labelledby') === 'ppTitle', 'a tap opens a dialog over the page (role dialog, aria-modal, titled)');
  check(d.activeElement === d.getElementById('ppClose') && w.getComputedStyle(d.getElementById('ppClose')).height === '44px' && /Close/.test(d.getElementById('ppClose').getAttribute('aria-label')), 'the focus moves to its 44px Close button');
  let bt = body().textContent;
  check(/Press Refresh odds for DraftKings' props/.test(bt) && body().querySelector('[data-pp-refresh]'), `before any press it says to press Refresh odds for DraftKings' props, with the button there ("${bt.slice(0, 90)}")`);
  check(/Model on trial/.test(d.getElementById('ppSub').textContent) && /on trial: not yet shown to beat DraftKings, it suggests nothing/.test(bt), 'the model is labelled on trial, not yet shown to beat DraftKings, suggesting nothing');
  const projRows = [...body().querySelectorAll('[data-pp-proj]')];
  check(projRows.length === Object.keys(bosDet.players).length, `and shows the model's projections for every expected player (${projRows.length} of ${Object.keys(bosDet.players).length})`);
  const L8 = props8.layout, at8 = (r, k) => r[L8.indexOf(k)];
  const projOk = projRows.every(tr => { const r = bosDet.players[tr.dataset.ppProj], td = [...tr.querySelectorAll('td')].map(x => x.textContent.trim());
    return r && td[0].startsWith(r[0]) && td[1] === r[3].toFixed(1) && td[2] === at8(r, 'pts').toFixed(1) && td[3] === at8(r, 'reb').toFixed(1) && td[4] === at8(r, 'ast').toFixed(1) && td[5] === at8(r, 'tpm').toFixed(1)
      && td[8] === (at8(r, 'pts') + at8(r, 'reb') + at8(r, 'ast')).toFixed(1) && td[9] === ppPct(at8(r, 'dd')); });
  check(projOk, "each row is the published projection: minutes, points, rebounds, assists, threes, PRA the sum, the double-double chance");
  const order = projRows.map(tr => bosDet.players[tr.dataset.ppProj]);
  check([...body().querySelectorAll('.pp-proj tr')].every(tr => w.getComputedStyle(tr).display === 'table-row') && body().querySelector('.pp-proj tr.pp-team td[colspan="10"]'), "every row of the table is laid out as a table row, each team's heading across it (no card style reaches it)");
  /* on a phone the table drops steals and blocks (jsdom lays nothing out: the rule and the classes are held here, the fit
     in a real browser at 390) so points + rebounds + assists and the double-double chance are on the screen */
  { const ths = [...body().querySelectorAll('.pp-proj thead th')].map(th => [th.textContent.trim(), th.classList.contains('pp-opt')]), css = [...d.querySelectorAll('style')].map(x => x.textContent).join('\n');
    const tr = body().querySelector('.pp-proj tr[data-pp-proj]'), opt = [...tr.children].map(td => td.classList.contains('pp-opt'));
    check(JSON.stringify(ths.filter(x => x[1]).map(x => x[0])) === '["Stl","Blk"]' && JSON.stringify(opt) === '[false,false,false,false,false,false,true,true,false,false]'
      && /@media\(max-width:520px\)\{[^@]*?\.pp-proj \.pp-opt\{display:none\}/.test(css) && body().querySelector('.pp-optnote'),
      'on a phone (520px and under) the projections table drops Stl and Blk, and says so, keeping PRA and DD'); }
  check(order.slice(0, order.findIndex(r => r[1] === 'DET')).every(r => r[1] === 'BOS') && order.every((r, i) => i === 0 || r[1] !== order[i - 1][1] || r[3] <= order[i - 1][3]), 'away team first, each team by projected minutes');
  check(!banned(bt), 'the view says neither "edge" nor "model says"');
  const teamBtn = d.querySelector('[data-pp-team="home"]'); teamBtn.focus(); teamBtn.click(); await sleep(20);
  check([...body().querySelectorAll('[data-pp-proj]')].every(tr => bosDet.players[tr.dataset.ppProj][1] === 'DET') && d.activeElement && d.activeElement.dataset.ppTeam === 'home', 'the team switch shows the Pistons alone, the focus kept on it');
  check(/Not projected, on the injury report: Some Star/.test(body().textContent), "who the injury report has out is said, not projected");
  sheet().dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20);
  check(sheet().hidden && d.activeElement === opener, 'Escape closes it and the focus goes back to the button that opened it');
  cardBtn(p3).click(); await sleep(20);
  sheet().click(); await sleep(20);
  check(sheet().hidden, 'a click outside the sheet closes it');
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
  const mini = d.querySelector(`#bkPlan tr[data-gid="${p2.id}"] [data-props]`);
  check(mini && /Player props/.test(mini.textContent), "each game in the Parlay Builder's plan has one too");
  mini.click(); await sleep(20);
  check(!sheet().hidden && /LAL/.test(d.getElementById('ppSub').textContent) && body().querySelectorAll('[data-pp-proj]').length === 3, "it opens that game's sheet, with its projections");
  d.getElementById('ppClose').click(); await sleep(20);
  const nT = timers.length;
  await provoke(w, timers, errors);
  check(espnReqs(requests).length === 0, `nothing is read before a press: not on load, opening a sheet, switching its team, closing it, nor on any timer or event (${nT} timers fired; ${espnReqs(requests).length} requests)`);
  check(storedNoTab(w) === before, 'and nothing is stored (the tab in view, which the page has always remembered, aside)');
  const planText = () => [...d.querySelectorAll('#bkPlan tbody tr')].map(r => { const c = r.cloneNode(true); c.querySelectorAll('[data-props]').forEach(b => b.remove()); return c.innerHTML; }).join('|');

  /* the press, from the board */
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20);
  /* p8 now tips 2.5 seconds after the press (ESPN still has it an hour later, as a game moved earlier after the job ran), and its props answer
     is held until it has */
  p8.tip = new Date(Date.now() + 2500).toISOString();
  w.eval(`S.slate.find(g => g.id === ${JSON.stringify(p8.id)}).tip = ${JSON.stringify(p8.tip)}`);
  sb[ymd(p8.date)].events.find(e => e.id === eid[p8.id]).date = new Date(Date.parse(p8.tip) + 3600e3).toISOString().slice(0, 16) + 'Z';
  /* p10: ESPN still calls it scheduled, its own tip a minute ago; the published tip is still to come */
  sb[ymd(p10.date)].events.find(e => e.id === eid[p10.id]).date = new Date(Date.now() - 60e3).toISOString().slice(0, 16) + 'Z';
  const pressedAt = Date.now();
  d.getElementById('oddsBtn').click(); await idle();
  check(Date.now() > Date.parse(p8.tip) && pressedAt < Date.parse(p8.tip) - 1500, 'the press landed well before p8 tipped and ended after it (else the machine is too slow for this case)');
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

  /* the sheet after the press: every line, every rung and every Yes price worked out here */
  cardBtn(p1).click(); await sleep(30);
  bt = body().textContent;
  check(/DraftKings' props from ESPN, read \d{1,2}:\d{2}/.test(bt) && /For this visit only: a reload shows the published page again/.test(bt), 'the sheet says when DraftKings\' props were read, for this visit only');
  const parsed1 = PF.propParse(p1Items), rows1 = props8.games[p1.id].players;
  const muOf = (r, k) => k in props8.combos ? Math.round(props8.combos[k].reduce((t, s) => t + at8(r, s), 0) * 100) / 100 : at8(r, k);   // a combo: its parts' sum, to two decimals, as the ledger's call holds it
  let lineBad = [], nLines = 0;
  for (const m of parsed1.mains) {
    const el = body().querySelector(`[data-pp-player="${m.player}"] [data-pp-line="${m.stat}"]`); nLines++;
    if (!el) { lineBad.push(`${m.player} ${m.stat} missing`); continue; }
    const r = rows1[m.player], fair = PF.propFairOver(m.over, m.under);
    const md = r ? `projection ${muOf(r, m.stat).toFixed(1)} · model ${ppPct(PJ.pOver(m.line, muOf(r, m.stat), PJ.nbVar(muOf(r, m.stat), props8.dist.var[m.stat])))} · DraftKings ${ppPct(fair)}` : `DraftKings ${ppPct(fair)}`;
    const t = [...el.children].map(c => c.textContent.trim());
    if (t[1] !== String(m.line) || t[2] !== 'O' + ppAm(m.over) || t[3] !== 'U' + ppAm(m.under) || t[4] !== md) lineBad.push(`${m.player} ${m.stat}: ${t.join(' | ')} (want ${md})`);
  }
  check(nLines === nMain1 && !lineBad.length, `each of the ${nLines} main lines shows its line, DraftKings' Over and Under, and "projection · model · DraftKings" worked out from the published projection, tools/props.js's distribution and the whole margin on the Over${lineBad.length ? ': ' + lineBad.slice(0, 3).join('; ') : ''}`);
  const cade = body().querySelector('[data-pp-player="4432166"] [data-pp-line="pts"] .md');
  check(cade && /^projection 20\.8 · model \d+% · DraftKings \d+%$/.test(cade.textContent.trim()), `Cunningham's points: "${cade && cade.textContent.trim()}"`);
  const fair8 = props8.fair;
  let rungBad = [], nRungs = 0, mono = true;
  for (const tb of body().querySelectorAll('[data-pp-player] [data-pp-ladder]')) {
    const pid = tb.closest('[data-pp-player]').dataset.ppPlayer, s = tb.dataset.ppLadder, r = rows1[pid];
    const want8 = parsed1.ladders.filter(l => l.player === pid && l.stat === s);
    const trs = [...tb.querySelectorAll('tbody tr')];
    if (trs.length !== want8.length) rungBad.push(`${pid} ${s}: ${trs.length} rows for ${want8.length}`);
    let last = 2;
    trs.forEach((tr, i) => { const l = want8[i], t = [...tr.children].map(c => c.textContent.trim()); nRungs++;
      const pm = r ? PJ.nbSf(l.k, muOf(r, s), PJ.nbVar(muOf(r, s), props8.dist.var[s])) : null;
      if (t[0] !== l.k + '+' || t[1] !== ppAm(l.price) || t[2] !== ppPct(PF.propFairRung(l.price, fair8.rung.a[s])) || (r && t[3] !== ppPct(pm))) rungBad.push(`${pid} ${s} ${l.k}+: ${t.join(' | ')}`);
      if (pm != null) { if (pm > last + 1e-12) mono = false; last = pm; } });
  }
  check(nRungs === parsed1.ladders.length && !rungBad.length, `each of the ${nRungs} milestone prices shows k+, DraftKings' price, its fair chance est. (tools/props_feed.js's rung rule on the measured margin) and the model's chance of reaching it${rungBad.length ? ': ' + rungBad.slice(0, 3).join('; ') : ''}`);
  check(mono && nRungs > 0, "the model's chance of each ladder falls as the rung rises");
  check([...body().querySelectorAll('[data-pp-ladder] th')].some(th => /DraftKings, est\./.test(th.textContent)), 'the ladder columns are headed DraftKings, est.');
  let yesBad = [];
  for (const y of parsed1.yes) { const el = body().querySelector(`[data-pp-player="${y.player}"] [data-pp-yes="${y.market}"]`), r = rows1[y.player];
    const want8 = `${y.market === 'dd' ? 'Double-double' : 'Triple-double'} ${ppAm(y.price)} · ${r ? `model ${ppPct(at8(r, y.market))} · ` : ''}DraftKings ${ppPct(PF.propFairRung(y.price, fair8.yes.a[y.market]))} est.`;
    if (!el || el.textContent.trim() !== want8) yesBad.push(`${el && el.textContent.trim()} (want ${want8})`); }
  check(parsed1.yes.length && !yesBad.length, `the double- and triple-double prices show the model's chance and DraftKings' fair chance, est., by the rung rule on the rungs' margin${yesBad.length ? ': ' + yesBad.join('; ') : ''}`);
  const yesEst = body().querySelector('[data-pp-yes] .muted');
  check(yesEst && /never measured on this market itself/.test(yesEst.title) && /read it as high/.test(yesEst.title) && /never measured on those markets/.test(body().querySelector('[data-pp-trial]').textContent),
    "their est. says the margin was never measured on those markets and the figure may run high, and so does the on-trial note");
  const star = body().querySelector('[data-pp-player="2"]');
  check(star && /Some Star/.test(star.textContent) && star.querySelector('.tag.rose') && /No projection: Out on the injury report/.test(star.textContent) && star.querySelector('[data-pp-line="pts"] .md').textContent.trim() === `DraftKings ${ppPct(PF.propFairOver(-120, -110))}`,
    "a player DraftKings lines whom the report has out is named from the game's absentees, marked Out, with no projection and DraftKings' fair chance alone");
  check(body().querySelector('[data-pp-player="4065648"] .pp-pl-h').textContent.includes(`${rows1['4065648'][3].toFixed(1)} min projected`), "a player's projected minutes are beside his name");
  check(body().querySelector('details[data-pp-more]') && body().querySelectorAll('details[data-pp-more] [data-pp-proj]').length === Object.keys(rows1).length - 2, "the projected players with no DraftKings line are listed apart, folded");
  bt = body().textContent;
  check(!banned(bt), 'the view says neither "edge" nor "model says" on a prop');
  check(storedNoTab(w) === before, 'nothing stored by opening the sheet');
  d.getElementById('ppClose').click(); await sleep(20);
  cardBtn(p2).click(); await sleep(20);
  const pts2 = body().querySelector('[data-pp-player="9000001"] [data-pp-line="pts"]'), reb2 = body().querySelector('[data-pp-player="9000002"] [data-pp-line="reb"]');
  check(pts2 && reb2 && /^projection 25\.3 · model \d+% · DraftKings \d+%$/.test(pts2.querySelector('.md').textContent.trim()), 'p2 read on both pages, its ESPN id from the scoreboard: a pair split across the pages is still a line');
  check(/ESPN athlete 99999999/.test(body().textContent), 'an athlete no file knows is shown by his ESPN id');
  const pra2 = body().querySelector('[data-pp-player="9000002"] [data-pp-line="pra"] .md');
  check(pra2 && pra2.textContent.trim().startsWith(`projection ${(15.5 + 11.8 + 2.1).toFixed(1)} `), "a combo's projection is the sum of its parts'");
  d.getElementById('ppClose').click(); await sleep(20);
  cardBtn(p3).click(); await sleep(20);
  check(/DraftKings has posted no player props for this game yet/.test(body().textContent) && /No projection for this game yet/.test(body().textContent), 'a 404 is "none posted yet", and a game the model has not projected says so');
  d.getElementById('ppClose').click(); await sleep(20);
  cardBtn(p4).click(); await sleep(20);
  check(/could not be read at/.test(body().textContent), 'a junk answer is "could not be read"');
  d.getElementById('ppClose').click(); await sleep(20);

  /* nothing suggested: the Parlay Builder drawn with the props read is the one drawn without them, and names no player */
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const sugWith = d.getElementById('bkSuggest').innerHTML, planWith = planText();
  w.eval('window.__pp = PP_LIVE; PP_LIVE = {}; render.parlay();');
  const sugWithout = d.getElementById('bkSuggest').innerHTML, planWithout = planText();
  w.eval('PP_LIVE = window.__pp; delete window.__pp; render.parlay();');
  check(/sugg-tier safe/.test(sugWith) && sugWith === sugWithout && planWith === planWithout, 'the suggested parlays, the Value card and the plan drawn with the props read are exactly those drawn without them: no prop is suggested');
  check(!/Tatum|Cunningham|Some Star|Lal Guard/.test(d.getElementById('tab-parlay').textContent), 'no player is named anywhere in the Parlay Builder');
  check(!w.localStorage.getItem('nba_hub_2027') || !/props|Tatum|4432166/.test(w.localStorage.getItem('nba_hub_2027')), 'and none is in the Bet Build');

  /* a second press: p1's read fails, and p2's page 1 answers but its page 2 is a 404, so the earlier props of both stand,
     with their read time (a 404 after page 1 is a failed read, never "none posted") */
  const firstAt = w.NBA_PROPS.live()[p1.id].at, firstAt2 = w.NBA_PROPS.live()[p2.id].at, lines2 = w.NBA_PROPS.live()[p2.id].mains.length;
  propsAns['401909088'] = 500;
  propsAns['401900002'] = [page(p2Items.slice(0, half), 1, 2), 404];
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20);
  cardBtn(p1).click(); await sleep(20);
  d.querySelector('#ppBody [data-pp-refresh]').click();
  check(/Reading DraftKings' lines and player props from ESPN/.test(body().textContent), "the sheet's own Refresh odds button is the same press, and the sheet says it is reading");
  await idle();
  check(/4 could not be read \(2 keep their props read earlier\)/.test(d.getElementById('propsSt').textContent) && w.NBA_PROPS.live()[p1.id].at === firstAt && body().querySelector('[data-pp-line="pts"]'),
    `a failed read keeps the earlier press's props for its game ("${d.getElementById('propsSt').textContent}")`);
  check(w.NBA_PROPS.live()[p2.id].status === 'ok' && w.NBA_PROPS.live()[p2.id].at === firstAt2 && w.NBA_PROPS.live()[p2.id].mains.length === lines2 && lines2 > 0,
    "a game whose page 2 is a 404 after page 1 answered keeps its earlier props whole, never page 1's alone nor \"none posted\"");
  check(d.getElementById('ppSub').textContent.includes('BOS') && !sheet().hidden, 'the open sheet is redrawn in place after the press');
  d.getElementById('ppClose').click(); await sleep(20);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* a reload is the published page again */
  ({ w, errors, requests, timers } = load('index.html', st8, null, espnStub(sb, () => 0, propsAns)));
  await sleep(300); d = w.document;
  await provoke(w, timers, errors);
  cardBtn(p1).click(); await sleep(20);
  check(/Press Refresh odds for DraftKings' props/.test(body().textContent) && !body().querySelector('[data-pp-line]') && d.getElementById('propsSt').hidden && !Object.keys(w.NBA_PROPS.live()).length && !espnReqs(requests).length,
    'a reload shows the projections again with no DraftKings line, reads nothing, and holds nothing from before');
  d.getElementById('ppClose').click();

  /* a sheet left open while its game tips says so, at the page's once-a-minute look */
  const p9 = og('NOP', 'MEM', 1500, { espn: '401900009' });
  ({ w, errors, requests, timers } = load('index.html', { ...st8, slate: [p9, p1].map(g => JSON.parse(JSON.stringify(g))) }, null, espnStub(sb, () => 0, propsAns)));
  await sleep(300); d = w.document;
  cardBtn(p9).click(); await sleep(20);
  check(/Press Refresh odds/.test(body().textContent), 'p9 opens before its tip');
  await sleep(1700);
  for (const t of timers.filter(t => t.k === 'setInterval')) t.fn();
  await sleep(20);
  check(/This game has tipped off/.test(body().textContent) && !body().querySelector('[data-pp-refresh]'), 'once it tips, the open sheet says so and offers nothing');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

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
  const ledgerText = async st => { ({ w, errors } = load('index.html', st)); await sleep(300); d = w.document; d.querySelector('#nav button[data-tab=record]').click(); await sleep(30);
    const rp = d.getElementById('ppRecord'); const t = rp ? rp.nextElementSibling.textContent : ''; cardBtn(p1).click(); await sleep(20); const tr = d.querySelector('[data-pp-trial]'); return [t, tr ? tr.textContent : '']; };
  let [lt, tt] = await ledgerText(lgOf({ lines: 12345, gradedGames: 101, scores }, null));
  check(/12,345 of the 30,000 graded lines its bar is judged on are in, from 101 games; no verdict before 30,000\. So far on 12,345 lines, log loss model 0\.6900 · DraftKings 0\.6800, Brier model 0\.2490 · DraftKings 0\.2440/.test(lt) && tt.includes('12,345 of the 30,000'),
    `before the bar, the Record tab and the sheet give the running numbers, model against DraftKings ("${lt.slice(-190)}")`);
  check(!/PASS|FAIL|pass|fail/.test(lt + tt), 'and no verdict, nor a word of one');
  [lt] = await ledgerText(lgOf({ lines: 30000, gradedGames: 260, scores }, { verdict: 'FAIL', decidedAt: '2026-11-25T12:00Z', lines: 30000 }));
  check(/decided on Nov 25 at 30,000 lines: FAIL\. It stays on trial and suggests nothing/.test(lt), `a FAIL is said, and the model stays on trial ("${lt.slice(-140)}")`);
  [lt] = await ledgerText(lgOf({ lines: 30000, gradedGames: 260, scores }, { verdict: 'PASS', decidedAt: '2026-11-25T12:00Z', lines: 30000 }));
  check(/PASS, which makes it a candidate to be shown as more than on trial, by a change of its own; until then it stays on trial/.test(lt), 'a PASS moves nothing by itself: the model stays on trial');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* the real published state: every game's sheet draws */
  ({ w, errors } = load('index.html', real));
  await sleep(300); d = w.document;
  const withProj = real.slate.filter(g => RP.games && RP.games[g.id] && !(g.tip && Date.parse(g.tip) <= Date.now()) && g.status === 'scheduled');
  let realBad = [];
  for (const g of withProj) { w.eval(`propsOpen(${JSON.stringify(g.id)})`); await sleep(5);
    const n = body().querySelectorAll('[data-pp-proj]').length, t = body().textContent;
    if (n !== Object.keys(RP.games[g.id].players).length || /\bNaN\b|\bundefined\b/.test(t) || banned(t)) realBad.push(`${g.id}: ${n} rows`);
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
  const recP = d.getElementById('ppRecord');
  check(recP && /on trial/.test(recP.textContent) && /graded lines its bar is judged on are in|Its bar was decided/.test(recP.nextElementSibling.textContent) && !/passing/i.test(recP.nextElementSibling.textContent), "the Record tab gives the shadow ledger's running numbers quietly, with no verdict before its bar is decided");
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
}

/* ---------- 9. Your parlay: player props and same-game legs (README "Same-game parlays") ----------
   The legs a visitor adds from a game's Player props after a press, the builder's same-game rule, the price and the
   chances worked out here on their own from data/corr.json and tools/corr.js (two legs of one game exactly, three by
   this file's own integration), the grading from the box scores by this file's own sums, the card and its share text,
   what is stored, a reload, a later press, a tip, and the suggested parlays and the plan unchanged by any of it. */
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
  const props9 = { onTrial: true, build: RP.build || '2026-10-15T09:09Z', asOf: RP.asOf || '2026-06-13', fitSeasons: '2023-2026', horizonGameDays: 5, minShown: 8, stats: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'],
    combos: COMBO, layout: LAY, dist: { kind: 'negative binomial', var: VAR }, fair: PJ.FAIR, ledger: RP.ledger || null, research: RP.research || null,
    games: { [q1.id]: { tip: q1.tip, away: 'BOS', home: 'DET', players: players1 }, [q2.id]: { tip: q2.tip, away: 'LAL', home: 'GSW', players: players2 } } };
  /* Moved Wing: a rated player the hub's tables put on MIA, whom DraftKings prices in LAL at GSW (a trade the tables have
     not caught up with); 9000099: an athlete no table names */
  const movedWing = { id: '9000088', name: 'Moved Wing', pos: 'F', team: 'MIA', o: 0, d: 0, elo: 0, min: 20, games: 50, last: '2026-04-01', prior: 'raptor' };
  const st9 = { ...state, generated: tipIn(-3600e3), injuriesAsOf: state.today, props: props9, corr: CORR, boxes: { from: state.today, days: 7, line: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'], games: {} }, slate: [q1, q2, q3].map(g => JSON.parse(JSON.stringify(g))),
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
  const main = (pid, stat, i) => body().querySelectorAll(`[data-pp-player="${pid}"] [data-pp-line="${stat}"] .pp-add`)[i];
  const rung = (pid, stat, k) => { const tr = [...body().querySelectorAll(`[data-pp-player="${pid}"] [data-pp-ladder="${stat}"] tbody tr`)].find(r => r.firstElementChild.textContent.trim() === k + '+'); return tr && tr.querySelector('.pp-add'); };
  const yesB = (pid, m) => body().querySelector(`[data-pp-player="${pid}"] [data-pp-yes="${m}"] .pp-add`);
  const glB = (label, i) => { const r = [...body().querySelectorAll('[data-pp-gl] .pp-glr')].find(x => x.querySelector('.st').textContent.trim().startsWith(label)); return r && r.querySelectorAll('.pp-add')[i]; };
  const banned = t => /\bedge\b|model says/i.test(t);
  const css = [...d.querySelectorAll('style')].map(x => x.textContent).join('\n');

  /* before a press: nothing to add */
  open(q1); await sleep(20);
  check(!body().querySelector('[data-sg-add]') && d.getElementById('ppSlipBar').hidden, 'before a press the sheet offers nothing to add, and its parlay bar is hidden');
  shut();
  d.getElementById('oddsBtn').click(); await idle();
  open(q1); await sleep(20);
  const P1 = PF.propParse(rec.items), e1 = w.NBA_PROPS.live()[q1.id], gl1 = w.NBA_SLIP.lines()[q1.id];
  const adds = [...body().querySelectorAll('[data-sg-add]')];
  check(adds.length === 2 * P1.mains.length + P1.ladders.length + P1.yes.length + 6, `after a press every DraftKings price in the sheet is an add control: each main line's Over and Under, each milestone, each double- and triple-double, and the game's six lines (${adds.length})`);
  check(adds.every(b => b.tagName === 'BUTTON' && b.type === 'button' && !b.disabled && b.getAttribute('tabindex') !== '-1' && /^Add to your parlay: /.test(b.getAttribute('aria-label')) && b.getAttribute('aria-pressed') === 'false'),
    'each is a real button, in the tab order, named for what it adds, not pressed');
  check(/\.pp-add\{min-height:44px;min-width:44px/.test(css) && adds.every(b => w.getComputedStyle(b).minHeight === '44px'), 'each is at least 44px tall (jsdom lays nothing out: the rule and the computed style)');
  check(gl1 && gl1.ml && gl1.spread && gl1.total && gl1.ml.home.odds === -115 && gl1.ml.away.odds === -105 && gl1.spread.home.line === -1.5 && gl1.spread.home.odds === -108 && gl1.spread.away.odds === -112 && gl1.total.line === 221.5 && gl1.total.over.odds === -115 && gl1.total.under.odds === -105
    && gl1.ml.home.id === '0ML85841510_1' && gl1.ml.away.id === '0ML85841510_3' && gl1.spread.home.id === '0HC85841510N150_1' && gl1.spread.away.id === '0HC85841510P150_3' && gl1.total.over.id === '0OU85841510O22150_1' && gl1.total.under.id === '0OU85841510U22150_3' && gl1.event === '34510070',
    "the recorded answer's game lines read as ESPN has them: moneylines, spread and total with their two prices, each outcome's DraftKings id and the event");
  const glTxt = [...body().querySelectorAll('[data-pp-gl] .pp-glr')].map(r => [...r.children].map(c => c.textContent.trim()).join(' '));
  check(JSON.stringify(glTxt) === JSON.stringify(['Moneyline BOS -105 DET -115', 'Spread BOS +1.5 -112 DET -1.5 -108', 'Total 221.5 Over -115 Under -105']), `the sheet's game lines: ${glTxt.join(' / ')}`);
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
  let legs = slip();
  const A = legs[0];
  check(legs.length === 1 && A.id === q1.id && A.kind === 'prop' && A.pid === '4065648' && A.name === 'Jayson Tatum' && A.team === 'BOS' && A.stat === 'pts' && A.mk === 'main' && A.line === 26.5 && A.side === 'over' && A.odds === -111 && A.other === -114 && A.at === e1.at && A.away === 'BOS' && A.home === 'DET',
    "a tap on Tatum's points Over puts that leg in your parlay, stored in the page's own key: the game, the player, his club, the stat, the line, the side, DraftKings' price as read (-111, the Under's -114 beside it) and the read's time");
  check(say() === 'Added: Jayson Tatum, Points Over 26.5 at -111.' && d.activeElement && d.activeElement.dataset.ppKey === tatPts.dataset.ppKey && d.activeElement.getAttribute('aria-pressed') === 'true', `the sheet says so ("${say()}"), and the control, redrawn pressed, keeps the focus`);
  const foot = () => d.getElementById('ppSlipSum').textContent;
  check(!d.getElementById('ppSlipBar').hidden && foot() === 'Your parlay: 1 leg, -111', `the sheet's foot shows your parlay, a single leg at DraftKings' price with no est. ("${foot()}")`);
  main('4065648', 'reb', 0).click(); await sleep(20);
  check(slip().length === 2 && slip()[1].stat === 'reb' && slip()[1].odds === -143, "his rebounds Over joins it: two stats of one player are allowed");
  /* the foot's same-game price, by this file's own sums: min(the prices multiplied, the hold over the copula's joint
     chance of the implied chances), marked est. */
  { const pl = (stat, side) => ({ game: q1.id, kind: stat, player: '4065648', team: 'BOS', side, home: 'DET' });
    const dec2 = Math.min(decOf(-111) * decOf(-143), HOLD / CJ.joint2(imp(-111), imp(-143), CJ.rhoFor(CT, pl('pts', 'over'), pl('reb', 'over'))));
    check(foot() === `Your parlay: 2 legs, ${fmtA(amOfDec(dec2))} est.`, `with two legs of one game the foot's price is the same-game estimate, marked est. ("${foot()}")`); }
  const refuse = async (btn, re, what) => { const n0 = slip().length; btn.click(); await sleep(20); check(slip().length === n0 && re.test(say()), `${what} is refused with a plain reason ("${say()}")`); };
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
  check(!banned(body().textContent + d.getElementById('ppSlipBar').textContent), 'the sheet says neither "edge" nor "model says"');
  shut(); open(q3); await sleep(20);
  await refuse(body().querySelector('[data-pp-player="7000001"] [data-pp-line="pts"] .pp-add'), /^Not added: Preseason games get no box score here, so a player leg on one could never be graded\.$/, 'a player leg on a preseason game');
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
  const modelOf = l => { if (l.kind === 'ml') { const g = [q1, q2].find(x => x.id === l.id); return l.side === g.home ? g.model.pHome : 1 - g.model.pHome; } if (l.kind !== 'prop') return null;
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
  check(Math.abs(pb.dec / mb.dec - 1) < TOL3 && Math.abs(pb.fair / mb.fair - 1) < TOL3 && pb.model === null && mb.model === null && pb.dec <= pb.prod && Math.abs(pb.prod - mb.prod) < 1e-9,
    `three legs of one game and one of another: the page's price ${pb.dec.toFixed(4)} and fair chance ${pb.fair.toFixed(5)} are this file's ${mb.dec.toFixed(4)} and ${mb.fair.toFixed(5)} (its own integration, within ${TOL3 * 100}% of each other), under the product ${mb.prod.toFixed(4)}; no model chance, a total having none`);
  /* more sets of three and four legs of one game, priced one after another in the same page session, each against this
     file's own integration (tri, quad4): one player's three Overs at -110 each, then three legs at the very same implied
     chances but other relations (two opponents' points and the total Under; his points Over, rebounds Under and assists
     Over), four at -110 (his three Overs and the total), four of every kind at their own prices, and four with a model
     chance each. A price kept from another set (a cache keyed by the chances alone), one leg's relation read for
     another's, or a fourth leg's dropped, shows */
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
  const sl = d.getElementById('bkSlip'), tiles = [...sl.querySelectorAll('.sl-sum .stat')];
  check(tiles[0] && tiles[0].hasAttribute('data-sl-fair') && tiles[0].querySelector('b').textContent === pct1(pb.fair) && tiles[0].querySelector('span').textContent === "DraftKings' fair chance all 4 land, est.",
    `the summary leads with DraftKings' fair chance of the whole parlay, est. ("${tiles[0] && tiles[0].textContent}")`);
  check(tiles[1] && tiles[1].querySelector('b').textContent === fmtA(amOfDec(pb.dec)) + 'est.' && tiles[1].querySelector('span').textContent === `price, est. · legs multiplied ${fmtA(amOfDec(mb.prod))}`,
    `then the price, marked est., beside the legs multiplied ("${tiles[1] && tiles[1].textContent}")`);
  check(tiles[2] && tiles[2].querySelector('b').textContent === '$' + (20 * pb.dec).toFixed(2) && !sl.querySelector('[data-sl-model]') && /No model chance/.test(sl.querySelector('[data-sl-nomodel]').textContent), "what $20 pays; and no model chance, with the reason");
  check(sl.querySelector('[data-sl-why]') && sl.querySelector('[data-sl-why]').textContent.startsWith("DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together.") && /untested on the NBA/.test(sl.querySelector('[data-sl-why]').textContent),
    'with the one-line why, and the hold said untested');
  const rowsS = [...sl.querySelectorAll('.sl-leg')];
  check(rowsS.length === 4 && sl.querySelectorAll('.sl-game').length === 2 && /Same game · 3 legs/.test(sl.querySelector(`.sl-game[data-sl-game="${q1.id}"]`).textContent)
    && rowsS[0].querySelector('.sl-px').textContent === '-111' && rowsS[0].querySelector('.sl-meta').textContent === `as read ${w.eval(`oddsClock(${JSON.stringify(e1.at)})`)} · DraftKings ${ppPct(fairOf(legs[0]))} · model ${ppPct(modelOf(legs[0]))}, on trial`,
    `each leg in its game, its price, its read time, DraftKings' fair chance and the model's on trial ("${rowsS[0] && rowsS[0].querySelector('.sl-meta').textContent}")`);
  check(!banned(d.getElementById('bkSlip').textContent + d.getElementById('bkBuild').textContent) && /model/.test(d.getElementById('bkSlip').textContent), 'your parlay and the Bet Build say neither "edge" nor "model says" (the model is named, on trial)');
  /* the levels and the plan: exactly as drawn with no leg in your parlay */
  const lv = () => d.getElementById('bkSuggest').innerHTML + '|' + d.getElementById('bkPlan').innerHTML;
  const withLegs = lv(); w.eval('window.__s = M.slip.legs; M.slip.legs = []; render.parlay();'); const without = lv(); w.eval('M.slip.legs = window.__s; delete window.__s; render.parlay();');
  check(withLegs === without && !/Tatum|Lal Guard/.test(withLegs), 'the suggested parlays and the plan are byte for byte the same with legs in your parlay and without: team bets only, no prop, no same-game leg');
  /* the model's chance where every leg has one: drop the total */
  w.eval(`M.slip.legs = M.slip.legs.filter(l => l.kind !== 'total'); render.parlay();`);
  legs = w.eval('JSON.stringify(M.slip.legs)'); legs = JSON.parse(legs);
  const pm = pagePrice(legs), mm = mine(legs);
  const mt = d.querySelector('#bkSlip [data-sl-model]');
  check(mt && Math.abs(pm.model - mm.model) < 1e-9 && mt.querySelector('b').textContent === pct1(mm.model) && mt.querySelector('span').textContent === "the hub's model, on trial" && Math.abs(pm.dec - mm.dec) < 1e-9,
    `with every leg modelled, the model's chance stands beside it, labelled on trial (${mt && mt.textContent}), the copula of its chances`);
  /* the card on that parlay: the model's chance as the builder gives it, labelled on trial, and what the stake pays */
  d.getElementById('slFinish').click(); await sleep(20);
  { const pc2 = d.getElementById('pcBack'), cm = pc2.querySelector('[data-pc-model]'), cp = pc2.querySelector('[data-pc-pays] b');
    check(!pc2.hidden && cm && cm.querySelector('b').textContent === pct1(mm.model) && cm.querySelector('span').textContent === "the hub's model, on trial" && !pc2.querySelector('[data-pc-nomodel]')
      && cp && cp.textContent === cents(20 * mm.dec) && !banned(d.getElementById('pcBody').textContent),
      `its card shows the model's chance, ${pct1(mm.model)}, labelled on trial, with no "edge" or "model says", and pays ${cents(20 * mm.dec)} on $20 to the cent (${cm && cm.textContent} | ${cp && cp.textContent})`);
    pc2.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20); }
  w.eval(`M.slip.legs.splice(2, 0, ${JSON.stringify({ ...legs[0], kind: 'total', side: 'over', line: 221.5, odds: -115, other: -105, dk: '0OU85841510O22150_1', at: gl1.at, pid: undefined, name: undefined, team: undefined, stat: undefined, mk: undefined })}); saveMine(); render.parlay();`);
  /* nothing from the read is stored but the legs added */
  const store = JSON.parse(w.localStorage.getItem('nba_hub_2027')), sj = JSON.stringify(store);
  check(store.slip.legs.length === 4 && !/4432166|Cunningham|mains|ladders|"yes"\s*:\s*\[|9000002|7000001|9000099|9000088|Moved Wing/.test(sj) && Object.keys(w.localStorage).filter(k => !/^nba_hub_2027(:tab)?$/.test(k)).length === 0 && dump(w.sessionStorage) && !Object.keys(dump(w.sessionStorage)).length,
    'storage holds the four legs added and nothing else from the read (no other line, player or price), in the one key');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* Finish: the card */
  d.getElementById('slFinish').focus(); d.getElementById('slFinish').click(); await sleep(20);
  const pc = d.getElementById('pcBack'), pcs = d.getElementById('pcSheet'), card = w.NBA_SLIP.card();
  check(!pc.hidden && pcs.getAttribute('role') === 'dialog' && pcs.getAttribute('aria-modal') === 'true' && d.activeElement === d.getElementById('pcClose'), 'Finish opens the card, a dialog, the focus on its Close');
  const li = [...pc.querySelectorAll('.pc-legs li')], etT = iso => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  check(li.length === 4 && li[0].querySelector('.pc-px').textContent === '-111' && li[0].querySelector('.pc-meta').textContent === `BOS at DET · read ${etT(e1.at)}` && (li[0].querySelector('[data-pc-hand]') || {}).textContent === "DraftKings' player lines carry no betslip id in ESPN's feed: add this leg by hand"
    && li[1].querySelector('[data-pc-hand]') && !li[2].querySelector('[data-pc-hand]') && li[3].querySelector('[data-pc-hand]'),
    'it lists each leg with its price and read time (Eastern), each player leg to add by hand with the reason, the total not');
  const dk = d.getElementById('pcDk');
  check(dk.getAttribute('href') === 'https://sportsbook.draftkings.com/?outcomes=0OU85841510O22150_1' && dk.getAttribute('target') === '_blank' && /noopener/.test(dk.getAttribute('rel')) && dk.textContent === 'Open in DraftKings',
    `the betslip link opens the leg that has an id, the total (${dk.getAttribute('href')})`);
  check(d.getElementById('pcDkNote').textContent === `Open in DraftKings opens 1 of the 4 legs as DraftKings had them at ${etT(gl1.at)}; add legs 1, 2 and 4 by hand. A line DraftKings has moved or pulled since will not be on the slip, so check each leg before you bet.`,
    `and says what it opens and what to add by hand, never every leg ("${d.getElementById('pcDkNote').textContent}")`);
  check(pc.querySelector('.pc-nums > div').hasAttribute('data-pc-fair') && pc.querySelector('[data-pc-fair] b').textContent === pct1(pb.fair) && /fair chance, est\.$/.test(pc.querySelector('[data-pc-fair] span').textContent), 'the card leads with DraftKings\' fair chance, est., too');
  check(pc.querySelector('[data-pc-price] b').textContent === fmtA(amOfDec(pb.dec)) + ' est.' && pc.querySelector('[data-pc-why]').textContent === "DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together.", 'its price is marked est., with the why');
  const NOMODEL = "No model chance: the hub's models give none on a spread, a total or a player the props model does not project.";
  check(pc.querySelector('[data-pc-pays] b') && pc.querySelector('[data-pc-pays] b').textContent === cents(20 * pb.dec) && pc.querySelector('[data-pc-pays] span').textContent === 'pays on $20.00',
    `what the stake pays on the card is $20 times the same-game price (held to this file's integration above), to the cent (${cents(20 * pb.dec)}; the legs multiplied would pay ${cents(20 * mb.prod)})`);
  check(!pc.querySelector('[data-pc-model]') && pc.querySelector('[data-pc-nomodel]') && pc.querySelector('[data-pc-nomodel]').textContent === NOMODEL && !banned(d.getElementById('pcBody').textContent),
    'with a total in it the card shows no model chance and says why, and says neither "edge" nor "model says"');
  let shared = null; w.navigator.share = async x => { shared = x; }; w.navigator.canShare = () => true;
  d.getElementById('pcShare').click(); await sleep(20);
  const tl = shared && shared.text.split('\n');
  check(shared && Object.keys(shared).sort().join() === 'text,title' && shared.title === `4-leg parlay ${fmtA(amOfDec(pb.dec))} (estimated same-game price)` && tl.includes('https://sportsbook.draftkings.com/?outcomes=0OU85841510O22150_1')
    && tl.includes(`1. Jayson Tatum (BOS): Points Over 26.5 -111, BOS at DET, read ${etT(e1.at)}`) && tl.includes("Add by hand, leg 1: Jayson Tatum, Points Over 26.5 (DraftKings' player lines carry no betslip id in ESPN's feed)")
    && tl.includes("Add by hand, leg 4: Lal Guard, Points Over 24.5 (DraftKings' player lines carry no betslip id in ESPN's feed)") && !tl.some(x => /^Add by hand, leg 3/.test(x)) && tl.includes(`$20.00 pays ${cents(20 * pb.dec)} at ${fmtA(amOfDec(pb.dec))}, an estimated same-game price (DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together; the legs multiplied ${fmtA(amOfDec(mb.prod))})`) && !/every leg|all 4 legs/.test(shared.text),
    'Share link sends a title and a text, no url field: each leg with its price and read time, the betslip link alone on its line, the player legs to add by hand with why, what $20 pays to the cent at the estimated same-game price, the legs multiplied beside it');
  delete w.navigator.share; let copied = null; w.navigator.clipboard = { writeText: async t => { copied = t; } };
  d.getElementById('pcShare').click(); await sleep(20);
  check(copied === shared.text && /Copied/.test(d.getElementById('pcMsg').textContent), 'with no share sheet the same text is copied, and the card says so');
  pc.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true })); await sleep(20);
  check(pc.hidden && d.activeElement === d.getElementById('slFinish'), 'Escape closes it, the focus back on Finish');
  check(card && card.title === shared.title, 'the card the page holds is the one shared');
  /* the betslip note is dated by the oldest read of the legs it opens: a parlay kept from two presses, as a reload finds
     it (the total read at this press, the other game's moneyline at one two hours before, put second so that neither
     the first leg's read nor the newest stands in for it) */
  { const tOld = new Date(Date.parse(gl1.at) - 2 * 3600e3).toISOString();
    const keepL = [{ id: q1.id, away: 'BOS', home: 'DET', date: q1.date, tip: q1.tip, kind: 'total', side: 'over', line: 221.5, odds: -115, other: -105, dk: '0OU85841510O22150_1', at: gl1.at },
      { id: q2.id, away: 'LAL', home: 'GSW', date: q2.date, tip: q2.tip, kind: 'ml', side: 'GSW', line: null, odds: -140, other: 120, dk: '0ML85841599_1', at: tOld }];
    const x = load('index.html', st9, { picks: {}, build: [], bank: { day: q1.date }, slip: { legs: keepL, stake: 20 } }, espnStub(sb, () => 0, propsAns));
    await sleep(300); const xd = x.w.document;
    xd.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
    xd.getElementById('slFinish').click(); await sleep(20);
    let sh = null; x.w.navigator.share = async v => { sh = v; }; x.w.navigator.canShare = () => true;
    xd.getElementById('pcShare').click(); await sleep(20);
    const note = xd.getElementById('pcDkNote').textContent, opens = `opens the 2 legs as DraftKings had them at ${etT(tOld)}`;
    check(etT(tOld) !== etT(gl1.at) && xd.getElementById('pcDk').getAttribute('href') === 'https://sportsbook.draftkings.com/?outcomes=0OU85841510O22150_1+0ML85841599_1'
      && note === `Open in DraftKings ${opens}. A line DraftKings has moved or pulled since will not be on the slip, so check each leg before you bet.` && sh && sh.text.split('\n').includes(`DraftKings betslip (${opens}):`) && !espnReqs(x.requests).length,
      `two legs read at different presses: the card's note and the Share text date what the link opens by the older read, ${etT(tOld)}, not ${etT(gl1.at)} ("${note}")`);
    check(x.errors.length === 0, 'no script errors: ' + x.errors.join(' | ')); }

  /* Lock in */
  d.getElementById('slLock').click(); await sleep(30);
  const b0 = JSON.parse(w.localStorage.getItem('nba_hub_2027')).build;
  check(b0.length === 1 && b0[0].type === 'parlay' && b0[0].legs.length === 4 && Math.abs(b0[0].dec - pb.dec) < 1e-12 && b0[0].sg === true && b0[0].stake === 20, 'Lock in puts it in the Bet Build at its same-game price, marked same-game');
  const brow = d.querySelector('#bkBuild tbody tr');
  check(brow && /Parlay · 4/.test(brow.textContent) && brow.querySelector('sup') && /est/.test(brow.querySelector('sup').textContent) && brow.textContent.includes(fmtA(amOfDec(pb.dec))) && /Jayson Tatum/.test(brow.textContent) && /open/.test(brow.textContent),
    'the Bet Build lists it, its price est., its player legs named, open');
  check(d.getElementById('slLock').disabled && /In the Bet Build/.test(d.getElementById('slLock').textContent), 'and the builder says it is in the Bet Build');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  /* a reload: the legs at their read prices, dated, and nothing read */
  const kept = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  ({ w, errors, requests } = load('index.html', st9, kept, espnStub(sb, () => 0, propsAns)));
  await sleep(300); d = w.document;
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const rr = [...d.querySelectorAll('#bkSlip .sl-leg')];
  check(rr.length === 4 && rr[0].querySelector('.sl-px').textContent === '-111' && rr[0].querySelector('.sl-meta').textContent.startsWith(`as read ${w.eval(`oddsClock(${JSON.stringify(e1.at)})`)}`) && !espnReqs(requests).length && !Object.keys(w.NBA_PROPS.live()).length,
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
  d.querySelector('#bkSlip [data-sl-del]').click(); await sleep(20);
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
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(150);
  const row = id => [...d.querySelectorAll('#bkBuild tbody tr')].find(r => r.querySelector(`[data-del="${id}"]`));
  const st = id => { const r = row(id); return r ? r.children[6].textContent.trim() : '?'; }, ret = id => { const r = row(id); return r ? r.children[7].textContent.trim() : '?'; };
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
  check(!badF.length, `from the season's box file, by this file's own reading of it: Old Hand's and Old Big's points, rebounds (both boards), assists, threes, steals, blocks and the five combos each push at their own sum, so each column is read from its own place, and their double- and triple-doubles (${Object.keys(fileWant).filter(k => /(dd|td)$/.test(k)).map(k => `${k.slice(1, 4)} ${k.slice(4)} ${got[k][0]}`).join(', ')})${badF.length ? ': ' + badF.map(k => `${k} ${got[k]} want ${want[k]}`).join('; ') : ''}`);
  const csvReq = requests.filter(x => /data\/box_\d{4}\.csv/.test(x.url));
  check(csvReq.length === 1 && csvReq[0].opt && csvReq[0].opt.cache === 'no-store', `the season's box file is read once, no-store, for the legs older than the state's window (${csvReq.length})`);
  const lalTitle = row('g7').querySelector('[title]');
  check(lalTitle && lalTitle.getAttribute('title') === 'final: waiting for its box score', 'the leg whose final has no box score yet says it waits for it');
  const saved = JSON.parse(w.localStorage.getItem('nba_hub_2027')).build, res = id => saved.find(b => b.id === id).legs.map(l => l.res ? l.res.r + ':' + l.res.v : '-').join(',');
  const why = id => saved.find(b => b.id === id).legs[0].res, ddN = cats(rim), tdN = cats(thief);
  check(res('g1') === 'won:30,void:null,-' && res('g3') === 'won:30,won:2' && res('g5') === 'push:10' && res('g7') === '-' && res('g8') === 'won:31' && res('g10') === 'void:null'
    && res('g11') === `won:${ddN}` && res('g12') === `won:${tdN}` && res('g13') === 'push:30,won:10,-' && res('g15') === 'void:null' && res('g16') === 'void:null' && why('g15').why === 'not played on its date' && why('g16').why === 'not played on its date',
    `each player leg's grade is written into the visitor's own Bet Build once made, the value with it (${res('g1')} | ${res('g3')} | ${res('g8')} | ${res('g11')} | ${res('g13')}), a leg on a game called off void "not played on its date" (${res('g15')} | ${res('g16')}), none for the leg still waiting`);
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  FILES = [];
  ({ w, errors, requests } = load('index.html', { ...st10, boxes: { ...st10.boxes, games: {} } }, JSON.parse(JSON.stringify({ ...mine10, build: saved }))));
  await sleep(300); d = w.document;
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(80);
  const got2 = Object.fromEntries(Object.keys(want).map(k => [k, [st(k), ret(k)]]));
  check(Object.keys(want).every(k => JSON.stringify(want[k]) === JSON.stringify(got2[k])) && !requests.some(x => /box_\d{4}\.csv/.test(x.url)), 'once written, the grades hold with the box scores gone from the state, and no box file is read');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  /* the page's copies of tools/corr.js and tools/props.js */
  const pageSrc = fs.readFileSync(pageFile('index.html'), 'utf8'), corrSrc = fs.readFileSync(path.join(ROOT, 'tools', 'corr.js'), 'utf8'), pjSrc = fs.readFileSync(path.join(ROOT, 'tools', 'props.js'), 'utf8');
  for (const [file, src, names] of [['corr.js', corrSrc, ['TEAM', 'GL', 'TWOPI', 'bvnUpper', 'joint2', 'sgn', 'isGameKind', 'rhoFor']], ['props.js', pjSrc, ['normCdf', 'normInv']]]) {
    const diff = names.filter(n => { const a = srcOf(src, n), b = srcOf(pageSrc, n); return !a || a !== b; });
    check(!diff.length, `the page's ${names.join(', ')} are tools/${file}'s, line for line${diff.length ? `: differ: ${diff.join(', ')}` : ''}`); }
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
    for (const tab of ['slate', 'teams', 'players', 'coaches', 'record', 'mine', 'parlay', 'about']) {
      d0.querySelector(`#nav button[data-tab=${tab}]`).click(); await sleep(30);
      const txt = d0.getElementById('tab-' + tab).textContent;
      check(!/\bNaN\b|\bundefined\b/.test(txt), `the real ${tab} tab shows no NaN or undefined`);
    }
    if (real.vsMarket && real.vsMarket.seasons.length) {
      d0.querySelector('#nav button[data-tab=record]').click(); await sleep(30);
      const rt = d0.getElementById('tab-record');
      const tbl = [...rt.querySelectorAll('h2')].find(h => /Against the market/.test(h.textContent));
      const rowsT = tbl ? [...tbl.nextElementSibling.nextElementSibling.querySelectorAll('tbody tr')] : [];
      const safe = rowsT.find(r => /^Safe/.test(r.textContent.trim()));
      const sum = k => real.vsMarket.seasons.reduce((a, x) => a + (x.tiers.safe ? x.tiers.safe[k] : 0), 0);
      check(tbl && rowsT.length === 7, 'the Record tab shows the suggested parlays against the market, four tiers, the baseline, the picks against the market and log loss');
      check(safe && safe.lastElementChild.textContent.includes(`${sum('won')}/${sum('parlays')}`) && safe.lastElementChild.textContent.includes(`(${Math.round(sum('exp'))})`), "Safe's pooled cell is the seasons' sum, with the market's expectation");
    }
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
  for (const tab of ['teams', 'players', 'coaches', 'record', 'mine', 'parlay', 'about']) {
    d.querySelector(`#nav button[data-tab=${tab}]`).click(); await sleep(30);
    check(!d.getElementById('tab-' + tab).hidden && d.getElementById('tab-' + tab).innerHTML.length > 200, `tab ${tab} renders`);
  }
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('2. a pick, then a straight bet from the Parlay Builder');
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(30);
  d.querySelector('.card .team.away .badge').click(); await sleep(30);
  let mine = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(mine.picks.t1 === 'BOS', 'pick stored in the browser');
  check(d.querySelector('.card .team.away .badge').classList.contains('mine'), 'pick marked on the card');
  d.querySelector('.card [data-act=plan]').click(); await sleep(80);
  check(!d.getElementById('tab-parlay').hidden && d.querySelector('#bkPlan tr[data-gid="t1"]'), 'the card button opens the builder on that game');
  check(/NYK/.test(d.querySelector('#bkPlan tr[data-gid="t1"]').textContent) && /MED 61%/.test(d.querySelector('#bkPlan tr[data-gid="t1"]').textContent), 'the plan row shows the model pick and its band');
  check(/-140/.test(d.querySelector('#bkPlan tr[data-gid="t1"]').textContent), "the row carries the book's moneyline");
  check(/\$20\.00/.test(d.getElementById('bkLock').textContent), 'the default stake of $20 goes on the one game');
  d.getElementById('bkLock').click(); await sleep(30);
  mine = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(mine.build.length === 1 && mine.build[0].type === 'single' && mine.build[0].legs[0].side === 'NYK' && mine.build[0].legs[0].odds === -140, 'straight bet locked into the Bet Build');
  check(/open/.test(d.getElementById('bkBuild').textContent), 'the Bet Build lists it as open');
  d.querySelector('#nav button[data-tab=mine]').click(); await sleep(30);
  check(/BOS/.test(d.getElementById('tab-mine').textContent) && /open/.test(d.getElementById('tab-mine').textContent), 'My Picks lists the open pick');

  console.log('3. the next morning: the game is final');
  ({ w, errors } = load('index.html', withGames(true), mine));
  await sleep(250);
  const d2 = w.document;
  d2.querySelector('#nav button[data-tab=mine]').click(); await sleep(30);
  check(/lost/.test(d2.getElementById('tab-mine').textContent) && /0-1/.test(d2.getElementById('tab-mine').textContent), 'the pick graded as a loss (BOS lost 98-105)');
  d2.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
  check(/won/.test(d2.getElementById('bkBuild').textContent) && /\$34\.29/.test(d2.getElementById('bkBuild').textContent), 'the straight bet graded: NYK at -140 returns $34.29 on $20');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('3b. weeks later: the game has left the slate');
  const realId = '2027_' + state.today.replace(/-/g, '') + '_BOS_NYK';
  const gone = { ...state, slate: [], record: [], finals: { [realId]: [98, 105] } };
  const old = { picks: { [realId]: 'NYK' }, build: [{ id: 'bx', day: state.today, type: 'single', stake: 10, legs: [{ id: realId, kind: 'ml', side: 'NYK', odds: -140 }] }] };
  ({ w, errors } = load('index.html', gone, old));
  await sleep(250);
  w.document.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
  check(/won/.test(w.document.getElementById('bkBuild').textContent), 'a bet still grades from the published finals');
  w.document.querySelector('#nav button[data-tab=mine]').click(); await sleep(30);
  check(/won/.test(w.document.getElementById('tab-mine').textContent), 'and so does an old pick');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('3c. three games: suggestions and a parlay');
  const three = (fin) => ({ ...state, slate: [
    { ...fake('a1', state.today, fin) },
    { ...fake('a2', state.today, fin), away: 'LAL', home: 'GSW', ml: { home: -220, away: 180 }, model: { ...fake('a2', state.today, false).model, pHome: 0.70 }, awayScore: fin ? 100 : null, homeScore: fin ? 110 : null },
    { ...fake('a3', state.today, fin), away: 'MIA', home: 'ORL', ml: { home: -175, away: 150 }, model: { ...fake('a3', state.today, false).model, pHome: 0.35 }, awayScore: fin ? 99 : null, homeScore: fin ? 101 : null } ] });
  ({ w, errors } = load('index.html', three(false)));
  await sleep(250);
  const d3 = w.document;
  d3.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  check(/Safe/.test(d3.getElementById('bkSuggest').textContent), 'a Safe parlay is suggested');
  const safeTxt = d3.querySelector('#bkSuggest .sugg-tier.safe').textContent;
  check(/NYK/.test(safeTxt) && /GSW/.test(safeTxt) && !/MIA/.test(safeTxt), 'Safe takes the two picks the market agrees with and leaves out MIA, where it does not');
  check(!d3.querySelector('#bkSuggest .sugg-tier.med'), 'no Medium: the only leg left is one the market disagrees with');
  check(!d3.querySelector('#bkSuggest .sugg-tier.value'), 'no Value card with a single qualifying leg');
  check(d3.querySelector('#bkPlan tr[data-gid="a3"] .vg.differs'), 'the Vegas pick is outlined where the market disagrees (MIA vs ORL)');
  d3.querySelector('#bkSuggest [data-sugg-lock="safe"]').click(); await sleep(30);
  let m3 = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(m3.build.length === 1 && m3.build[0].type === 'parlay' && m3.build[0].legs.length >= 2, 'Lock in puts the Safe parlay in the Bet Build');
  d3.querySelector('#bkSuggest [data-sugg-lock="safe"]').click(); await sleep(30);
  m3 = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(m3.build.length === 1 && /already/.test(d3.getElementById('bkPlan').textContent), 'the same parlay twice is refused');
  d3.querySelector('#bkPlan [data-bkmode="parlay"]').click(); await sleep(30);
  check(/3 of 3 legs in/.test(d3.getElementById('bkPlan').textContent) && /parlay odds/.test(d3.getElementById('bkPlan').textContent), 'parlay mode shows three legs and the parlay odds');
  d3.querySelector('#bkPlan input[data-bkg="a3"]').click(); await sleep(30);
  check(/2 of 3 legs in/.test(d3.getElementById('bkPlan').textContent), 'unticking a game drops it from the parlay');
  d3.getElementById('bkLock').click(); await sleep(30);
  check(/already/.test(d3.getElementById('bkPlan').textContent), 'NYK + GSW is the Safe parlay already in the build, so it is refused');
  d3.querySelector('#bkPlan input[data-bkg="a3"]').click(); await sleep(30);
  d3.getElementById('bkLock').click(); await sleep(30);
  m3 = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(m3.build.length === 2 && m3.build.some(b => b.legs.length === 3), 'the three-leg parlay is locked in');
  ({ w, errors } = load('index.html', three(true), m3));
  await sleep(250);
  w.document.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
  const bt = w.document.getElementById('bkBuild').textContent;
  const st = JSON.parse(w.localStorage.getItem('nba_hub_2027')).build;
  check(/won/.test(bt) && /lost/.test(bt), 'NYK + GSW won; the three-leg parlay lost on MIA (ORL won 101-99)');
  check(/1-1/.test(bt), 'the Bet Build tallies 1-1');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('3d. a value parlay');
  const val = three(false); val.slate[0] = { ...val.slate[0], model: { ...val.slate[0].model, pHome: 0.72 } };   // NYK 72% against the market's 56%
  ({ w, errors } = load('index.html', val));
  await sleep(250);
  const d4 = w.document;
  d4.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const vc = d4.querySelector('#bkSuggest .sugg-tier.value');
  check(vc && /MIA/.test(vc.textContent) && /NYK/.test(vc.textContent) && !/GSW/.test(vc.textContent), 'the Value card holds the two picks the model rates 5+ points above the market');
  check(vc && vc.querySelector('.sugg-legs li').textContent.includes('MIA'), 'biggest edge first (MIA 65 vs 39)');
  check(vc && (!state.vsMarket || /backtested on .* Value parlays won \d+ of \d+/.test(vc.textContent)) && !/NFL/.test(vc.textContent), "the Value card quotes this site's own backtest, not the NFL side's");
  vc.querySelector('[data-sugg-lock="value"]').click(); await sleep(30);
  const m4 = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(m4.build.length === 1 && m4.build[0].legs.length === 2, 'Lock in anyway puts it in the Bet Build');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('3e. games that have tipped off');
  const tipped = () => ({ ...state, slate: [
    { ...fake('x1', state.today, false), tip: tipIn(-3600e3) },
    { ...fake('x2', state.today, false), away: 'LAL', home: 'GSW', ml: { home: -220, away: 180 }, model: { ...fake('x2', state.today, false).model, pHome: 0.70 }, tip: tipIn(1500) },
    { ...fake('x3', state.today, false), away: 'MIA', home: 'ORL', ml: { home: -175, away: 150 }, model: { ...fake('x3', state.today, false).model, pHome: 0.65 } } ] });
  ({ w, errors } = load('index.html', tipped()));
  await sleep(250);
  let d6 = w.document;
  const c1 = d6.querySelector('.card[data-id="x1"]');
  check(c1 && /Tipped off/.test(c1.querySelector('.tags').textContent), 'a game past its tip time is tagged Tipped off');
  check(c1 && !c1.querySelector('[data-act=plan]'), 'it has no Parlay Builder button');
  c1.querySelector('.team.away .badge').click(); await sleep(30);
  check(!(JSON.parse(w.localStorage.getItem('nba_hub_2027') || '{}').picks || {}).x1, 'it cannot be picked');
  ({ w, errors } = load('index.html', tipped(), { picks: { x1: 'NYK', x3: 'ORL' }, build: [] }));
  await sleep(250);
  w.document.querySelector('#nav button[data-tab=mine]').click(); await sleep(30);
  check(!w.document.querySelector('#tab-mine [data-un="x1"]') && w.document.querySelector('#tab-mine [data-un="x3"]'), 'a pick cannot be removed once its game has tipped, and can before');
  d6 = w.document;
  d6.querySelector('#nav button[data-tab=slate]').click(); await sleep(30);
  d6.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  check(!d6.querySelector('#bkPlan tr[data-gid="x1"]') && d6.querySelector('#bkPlan tr[data-gid="x2"]') && d6.querySelector('#bkPlan tr[data-gid="x3"]'), 'the builder leaves it out and keeps the two games to come');
  check(!/BOS/.test(d6.getElementById('bkSuggest').textContent), 'the suggestions leave it out');
  await sleep(1600);                                                           // x2 tips while the page is open
  d6.getElementById('bkLock').click(); await sleep(30);
  let m6 = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(m6.build.length === 1 && m6.build[0].legs[0].id === 'x3', 'a straight lock drawn before the tip adds only the game still to come');
  check(/1 game has tipped off and was left out/.test(d6.getElementById('bkPlan').textContent), 'and says the other has tipped off');
  check(!d6.querySelector('#bkPlan tr[data-gid="x2"]'), 'the redrawn plan no longer offers it');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  ({ w, errors } = load('index.html', tipped()));
  await sleep(250);
  d6 = w.document;
  d6.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  const safe6 = d6.querySelector('#bkSuggest .sugg-tier.safe');
  check(safe6 && /GSW/.test(safe6.textContent) && /ORL/.test(safe6.textContent), 'Safe is GSW + ORL before the tip');
  await sleep(1600);
  safe6.querySelector('[data-sugg-lock="safe"]').click(); await sleep(30);
  m6 = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(!m6.build.length && /has tipped off, so it was not added/.test(d6.getElementById('bkPlan').textContent), 'a suggested parlay with a leg that has tipped is refused, and says why');
  check(!d6.querySelector('#bkSuggest .sugg-tier.safe'), 'the suggestions are redrawn without it');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  ({ w, errors } = load('index.html', tipped(), { picks: {}, build: [], bank: { mode: 'parlay' } }));
  await sleep(250);
  d6 = w.document;
  d6.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
  check(/2 of 2 legs in/.test(d6.getElementById('bkPlan').textContent), 'parlay mode offers the two games to come');
  await sleep(1600);
  d6.getElementById('bkLock').click(); await sleep(30);
  m6 = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(!m6.build.length && /has tipped off, so it was not added/.test(d6.getElementById('bkPlan').textContent), 'a parlay from the plan with a leg that has tipped is refused, and says so');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('6. a postponed game, a graded game off the slate, the import, a stale injury report');
  {
    const ago = n => { const x = new Date(state.today + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() - n); return x.toISOString().slice(0, 10); };
    const gid = (n, a, h) => `${state.season}_${ago(n).replace(/-/g, '')}_${a}_${h}`;
    const pp = gid(3, 'BOS', 'NYK'), fresh = gid(1, 'MIA', 'ORL'), done = gid(4, 'LAL', 'GSW'), graded = gid(5, 'DEN', 'UTA'), waiting = gid(6, 'PHI', 'CHA');
    const ancient = `${state.season - 2}_20241105_LAL_GSW`;
    const st6 = { ...state, slate: [], finals: { [done]: [100, 110] }, pending: [waiting],
      record: [{ id: graded, date: ago(5), away: 'DEN', home: 'UTA', awayScore: 120, homeScore: 101, pHome: 0.22, spread: 9.1, total: 231, line: 8.5, totalLine: 230, pick: 'DEN', su: true, ats: true, ou: false, teamPick: 'DEN' }] };
    const mine6 = { picks: { [pp]: 'NYK', [fresh]: 'ORL', [graded]: 'DEN', [waiting]: 'PHI', [ancient]: 'GSW' }, build: [
      { id: 'v1', day: ago(3), type: 'single', stake: 10, legs: [{ id: pp, kind: 'ml', side: 'NYK', odds: -140 }] },
      { id: 'v2', day: ago(4), type: 'parlay', stake: 10, legs: [{ id: pp, kind: 'ml', side: 'NYK', odds: -140 }, { id: done, kind: 'ml', side: 'GSW', odds: 150 }] },
      { id: 'v3', day: ago(1), type: 'single', stake: 10, legs: [{ id: fresh, kind: 'ml', side: 'ORL', odds: -120, est: 'model' }] }] };
    ({ w, errors } = load('index.html', st6, mine6));
    await sleep(250);
    const d7 = w.document;
    d7.querySelector('#nav button[data-tab=mine]').click(); await sleep(30);
    const mt = d7.getElementById('tab-mine');
    const rowOf = id => [...mt.querySelectorAll('tbody tr')].find(r => r.querySelector(`[data-un="${id}"]`) || r.textContent.includes(id.split('_')[2]));
    check(/void/.test(mt.textContent), 'a pick on a game missing three days on reads void');
    check(/>2<\/b><span>Open/.test(mt.innerHTML), "open: yesterday's game (a day is not enough to call it off) and one played whose final is not read yet");
    check(/PHI/.test(mt.textContent) && (mt.textContent.match(/void/g) || []).length === 1, 'the game awaiting its final is not void');
    check(mt.querySelectorAll('tbody tr').length === 4 && ![...mt.querySelectorAll('tbody tr')].some(r => /LAL/.test(r.textContent) && /GSW/.test(r.textContent)), 'a pick from three seasons back is not shown (four of the five picks are)');
    check(/1\/4<\/b><span>With the model/.test(mt.innerHTML) && /DEN/.test(mt.textContent) && /78%/.test(mt.textContent), "a graded game off the slate keeps the model's pick (DEN 78%)");
    d7.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
    const bb = d7.getElementById('bkBuild');
    const rowB = id => [...bb.querySelectorAll('tbody tr')].find(r => r.querySelector(`[data-del="${id}"]`));
    check(/void/.test(rowB('v1').textContent) && /\$10\.00/.test(rowB('v1').lastElementChild.previousElementSibling.textContent), 'a straight bet on it is void, the stake back');
    check(/won/.test(rowB('v2').textContent) && /\$25\.00/.test(rowB('v2').textContent), 'a parlay drops the void leg and pays on the rest: GSW +150 returns $25 on $10');
    check(/open/.test(rowB('v3').textContent) && rowB('v3').querySelector('sup') && /est/.test(rowB('v3').querySelector('sup').textContent), 'an estimated price is marked est in the Bet Build');
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
  {
    const three6 = { ...state, slate: [fake('s1', state.today, false), { ...fake('s2', state.today, false), away: 'LAL', home: 'GSW', ml: { home: -220, away: 180 }, model: { ...fake('s2', state.today, false).model, pHome: 0.70 } }] };
    ({ w, errors } = load('index.html', three6));
    await sleep(250);
    w.document.querySelector('#nav button[data-tab=parlay]').click(); await sleep(40);
    const sf = w.document.querySelector('#bkSuggest .sugg-tier.safe');
    check(sf && /Under Safe's 50% aim/.test(sf.textContent), 'a Safe parlay under its 50% aim says so (NYK + GSW land about 37% together)');
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

  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
