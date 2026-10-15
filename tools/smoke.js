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
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const errors = [], requests = [], scrolls = [], timers = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
        if (/espn\.com/.test(url)) return espn ? espn(url, opt) : { ok: false, status: 404, json: async () => ({}) };
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
  const LEDGER0 = { registered: '2026-10-15T09:08Z', bar: { lines: 30000 }, decision: null, summary: { standing: '', gradedGames: 0, lines: 0, voids: 0, scores: null, flat: null, toCome: 0 } };
  const bosDet = { players: {
    '4065648': ['Jayson Tatum', 'BOS', 'F', 30.4, 21.04, 8.66, 5.07, 2.76, 1.1, 0.42, 0.3838, 0.0384], '4432166': ['Cade Cunningham', 'DET', 'G', 31.5, 20.8, 4.48, 7.47, 2.08, 0.98, 0.58, 0.2551, 0.023],
    '3001': ['Bos Guard', 'BOS', 'G', 31.0, 12.8, 3.7, 4.0, 2.4, 1.0, 1.2, 0.03, 0], '3002': ['Bos Center', 'BOS', 'C', 23.0, 9.9, 8.1, 1.5, 0.1, 0.7, 1.4, 0.2, 0], '3003': ['Bos Bench', 'BOS', 'G', 12.1, 4.4, 1.6, 2.6, 1.1, 0.7, 0.2, 0.004, 0],
    '3004': ['Det Center', 'DET', 'C', 26.2, 13.8, 8.4, 2.0, 0, 0.6, 0.8, 0.3, 0.001], '3005': ['Det Wing', 'DET', 'F', 25.4, 11.4, 2.5, 2.1, 2.8, 0.6, 0.2, 0.01, 0], '3006': ['Det Bench', 'DET', 'G', 9.2, 4.0, 2.7, 0.8, 0.1, 0.2, 0.2, 0.004, 0] } };
  /* the games: p1 Celtics at Pistons (the recorded answer, plus a line on an absentee, id 2, Some Star on the Pistons'
     report); p2 two pages, its ESPN id only from the scoreboard, with a player no file knows; p3 nothing posted (404);
     p4 junk; p5 tipped an hour ago; p6 under way at ESPN; p7 a 500; p8 tips while its props read is out */
  const p1 = og('BOS', 'DET', 3 * 3600e3, { espn: '401909088' });
  const p2 = og('LAL', 'GSW', 5 * 3600e3, { espn: '' });
  const p3 = og('MIA', 'ORL', 3 * 3600e3, { espn: '401900003' });
  const p4 = og('PHI', 'CHA', 3 * 3600e3, { espn: '401900004' });
  const p5 = og('DEN', 'UTA', -3600e3, { espn: '401900005' });
  const p6 = og('ATL', 'BKN', 3 * 3600e3, { espn: '401900006' });
  const p7 = og('TOR', 'CLE', 3 * 3600e3, { espn: '401900007' });
  const p8 = og('POR', 'HOU', 3600e3, { espn: '401900008' });          // its tip is moved to just after the press, below
  const games = [p1, p2, p3, p4, p5, p6, p7, p8];
  const eid = { [p1.id]: '401909088', [p2.id]: '401900002', [p3.id]: '401900003', [p4.id]: '401900004', [p5.id]: '401900005', [p6.id]: '401900006', [p7.id]: '401900007', [p8.id]: '401900008' };
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
    '401900006': page(rec.items, 1, 1), '401900008': page(rec.items, 1, 1), '401900005': page(rec.items, 1, 1) };
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
  for (const g of [p1, p2, p3, p4, p6, p7, p8]) { const b = cardBtn(g); check(b && b.tagName === 'BUTTON' && /^Player props$/.test(b.textContent.trim()) && b.getAttribute('aria-haspopup') === 'dialog', `${g.away} at ${g.home}'s card has a Player props button, a real button, before any press`); }
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
  const pressedAt = Date.now();
  d.getElementById('oddsBtn').click(); await idle();
  check(Date.now() > Date.parse(p8.tip) && pressedAt < Date.parse(p8.tip) - 1500, 'the press landed well before p8 tipped and ended after it (else the machine is too slow for this case)');
  const pr = propsReqs(requests), sbr = sbReqs(requests);
  const asked = pr.map(x => PROPS_RE.exec(x.url)[1] + ':' + PROPS_RE.exec(x.url)[2]).sort();
  const want = ['401909088:1', '401900002:1', '401900002:2', '401900003:1', '401900004:1', '401900007:1', '401900008:1'].sort();
  check(JSON.stringify(asked) === JSON.stringify(want), `one press asks for the props of exactly the games still to come, by ESPN's ids, the second page where there is one: not the game tipped before the press nor the one ESPN has under way (${asked.join(', ')})`);
  check(pr.every(x => x.url === PF.PROP_URL(PROPS_RE.exec(x.url)[1], +PROPS_RE.exec(x.url)[2]) + x.url.slice(x.url.indexOf('&_=')) && /&_=\d+$/.test(x.url) && x.opt && x.opt.cache === 'no-store' && !x.opt.headers),
    "each is a plain GET of tools/props_feed.js's address with a cache-buster, no-store and no headers of its own");
  check(requests.findIndex(x => PROPS_RE.test(x.url)) > requests.findIndex(x => /\/scoreboard\?/.test(x.url)) && sbr.length >= 1, 'after the scoreboard, whose answer gives p2 its ESPN id');
  const ps = d.getElementById('propsSt'), pst = ps.textContent;
  const nMain1 = PF.propParse(p1Items).mains.length, nMain2 = PF.propParse(PF.propItems([page(p2Items.slice(0, half), 1, 2), page(p2Items.slice(half), 2, 2)])).mains.length;
  check(!ps.hidden && ps.getAttribute('aria-live') === 'polite' && new RegExp(`^DraftKings' player props, read \\d{1,2}:\\d{2}[^:]*: 2 games, ${nMain1 + nMain2} main lines, under Player props on each game\\. 1 has none posted yet, 2 could not be read and 2 tipped off\\.$`).test(pst),
    `the props status line says when, how many games and main lines, and what was not posted, not read or tipped ("${pst}")`);
  check(/^DraftKings' lines from ESPN, read \d{1,2}:\d{2}[^:]*: \d+ games?, none moved\./.test(d.getElementById('oddsSt').textContent), `the lines' own status line is as before ("${d.getElementById('oddsSt').textContent}")`);
  check(storedNoTab(w) === before, 'nothing is written to localStorage or sessionStorage by the press');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
  check(cardBtn(p1) && cardBtn(p1).textContent.trim() === `Player props · ${nMain1} lines` && cardBtn(p1).classList.contains('has'), `p1's card button counts its main lines (${cardBtn(p1) && cardBtn(p1).textContent.trim()})`);
  check(cardBtn(p3) && cardBtn(p3).textContent.trim() === 'Player props', 'a game with none posted shows no count');
  check(!cardBtn(p8) && !w.NBA_PROPS.live()[p8.id] && !w.NBA_PROPS.live()[p6.id] && !w.NBA_PROPS.live()[p5.id], 'the game that tipped while its props were read has no button and nothing taken; nor have the two ESPN or the clock had started');

  /* the sheet after the press: every line, every rung and every Yes price worked out here */
  cardBtn(p1).click(); await sleep(30);
  bt = body().textContent;
  check(/DraftKings' props from ESPN, read \d{1,2}:\d{2}/.test(bt) && /For this visit only: a reload shows the published page again/.test(bt), 'the sheet says when DraftKings\' props were read, for this visit only');
  const parsed1 = PF.propParse(p1Items), rows1 = props8.games[p1.id].players;
  const muOf = (r, k) => k in props8.combos ? props8.combos[k].reduce((t, s) => t + at8(r, s), 0) : at8(r, k);
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
    const want8 = `${y.market === 'dd' ? 'Double-double' : 'Triple-double'} ${ppAm(y.price)} · ${r ? `model ${ppPct(at8(r, y.market))} · ` : ''}DraftKings ${ppPct(PF.propFairYes(y.price, fair8.yes.c[y.market]))} est.`;
    if (!el || el.textContent.trim() !== want8) yesBad.push(`${el && el.textContent.trim()} (want ${want8})`); }
  check(parsed1.yes.length && !yesBad.length, `the double- and triple-double prices show the model's chance and DraftKings' fair chance, est.${yesBad.length ? ': ' + yesBad.join('; ') : ''}`);
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

  /* a second press: p1's read fails, so its earlier props stand, with their read time */
  const firstAt = w.NBA_PROPS.live()[p1.id].at;
  propsAns['401909088'] = 500;
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(20);
  cardBtn(p1).click(); await sleep(20);
  d.querySelector('#ppBody [data-pp-refresh]').click();
  check(/Reading DraftKings' lines and player props from ESPN/.test(body().textContent), "the sheet's own Refresh odds button is the same press, and the sheet says it is reading");
  await idle();
  check(/3 could not be read \(1 keeps its props read earlier\)/.test(d.getElementById('propsSt').textContent) && w.NBA_PROPS.live()[p1.id].at === firstAt && body().querySelector('[data-pp-line="pts"]'),
    `a failed read keeps the earlier press's props for its game ("${d.getElementById('propsSt').textContent}")`);
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
  const pageSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const feedSrc = fs.readFileSync(path.join(ROOT, 'tools', 'props_feed.js'), 'utf8'), nbSrc = fs.readFileSync(path.join(ROOT, 'tools', 'props.js'), 'utf8');
  const copied = [['props_feed.js', feedSrc, ['PROP_URL', 'PROP_MAIN', 'PROP_MILE', 'PROP_YES', 'PROP_STATS', 'propAmerican', 'propImplied', 'propAthlete', 'propLine', 'propTypeId', 'propPrice', 'propItems', 'propParse', 'propFairOver', 'propFairRung', 'propFairYes', 'propRead']],
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
  for (const [name, mk] of Object.entries(scen)) { const a = JSON.stringify(await PF.propRead('401909088', mk())), b = JSON.stringify(await P.propRead('401909088', mk()));
    check(a === b, `the page's read equals tools/props_feed.js's on ${name} (${JSON.parse(a).status})`); }
  let nbBad = 0;
  for (const k of ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb']) for (const mu of [0, 0.3, 1.7, 4.4, 9.9, 21.6, 38.2]) { const ab = props8.dist.var[k], v = PJ.nbVar(mu, ab);
    if (v !== P.nbVar(mu, ab)) nbBad++;
    for (const line of [0.5, 1.5, 4, 9.5, 22.5, 40.5]) if (PJ.pOver(line, mu, v) !== P.pOver(line, mu, v) || PJ.nbSf(Math.ceil(line), mu, v) !== P.nbSf(Math.ceil(line), mu, v)) nbBad++; }
  check(nbBad === 0, "the page's distribution equals tools/props.js's: variance, P(over a line) and P(at least k), every stat, means 0 to 38");
  let fairBad = 0;
  for (const a of [-1000, -250, -130, -110, 100, 105, 150, 400, 2500]) for (const b of [-400, -115, 100, 120, 300]) if (PF.propFairOver(a, b) !== P.propFairOver(a, b)) fairBad++;
  for (const a of [-3000, -400, -150, 100, 140, 300, 900, 5000]) { for (const s of Object.keys(fair8.rung.a)) if (PF.propFairRung(a, fair8.rung.a[s]) !== P.propFairRung(a, fair8.rung.a[s])) fairBad++; for (const m of ['dd', 'td']) if (PF.propFairYes(a, fair8.yes.c[m]) !== P.propFairYes(a, fair8.yes.c[m])) fairBad++; }
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
  d.querySelector('#nav button[data-tab=record]').click(); await sleep(30);
  const recP = d.getElementById('ppRecord');
  check(recP && /on trial/.test(recP.textContent) && /graded lines its bar is judged on are in|Its bar was decided/.test(recP.nextElementSibling.textContent) && !/passing/i.test(recP.nextElementSibling.textContent), "the Record tab gives the shadow ledger's running numbers quietly, with no verdict before its bar is decided");
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));
}

(async () => {
  let w, errors;
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

  await refreshOdds();
  await playerProps();

  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
