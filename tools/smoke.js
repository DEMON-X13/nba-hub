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
 * recorded in tools/fixtures/.
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
   answers with no games. `slow` delays every answer */
const espnStub = (answers, slow = () => 0) => async url => {
  const d = (/dates=(\d{8})/.exec(url) || [])[1]; if (slow()) await sleep(slow());
  const a = answers[d];
  if (a instanceof Error) throw a;
  if (typeof a === 'number') return { ok: false, status: a, json: async () => ({}) };
  if (a === 'junk') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token < in JSON'); } };
  return { ok: true, status: 200, json: async () => JSON.parse(JSON.stringify(a || { events: [] })) };
};
const ymd = date => date.replace(/-/g, '');
const espnReqs = r => r.filter(x => /espn\.com/.test(x.url));
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
  const reqs = espnReqs(requests);
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
  check(espnReqs(requests).length === reqs.length + days2, `a second press after the first read reads again (${days2} days: r8 has tipped since)`);
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

  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
