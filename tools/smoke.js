/* Smoke test for the built viewer.
 *
 *   node tools/smoke.js        (needs jsdom: npm install in tools/)
 *
 * Loads index.html in jsdom with fetch stubbed to serve state.json plus one fabricated
 * game for tonight, and checks: the update stamp shows, every tab renders without a script error, a
 * visitor's pick is kept in their own storage and shows on My Picks, a parlay leg reaches the ticket
 * and a saved ticket grades once the game is final, the Data tab is only on the admin page, and a preseason
 * game shows with its tag and the not-graded note.
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
const fake = (id, date, fin) => ({ id, date, tip: date + 'T23:30:00Z', type: 'REG', away: 'BOS', home: 'NYK', neutral: false, status: fin ? 'final' : 'scheduled', awayScore: fin ? 98 : null, homeScore: fin ? 105 : null,
  line: -2.5, totalLine: 220, ml: { home: -140, away: 120 }, model: { pHome: 0.61, spread: -3.5, total: 224.5, pace: 99, home: side('NYK'), away: side('BOS') }, team: { pHome: 0.55, spread: -1.5 }, published: null });
/* the second game is yesterday's final: always a different day from today, including on the 1st of a month */
const yesterday = (() => { const d = new Date(state.today + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() - 1); return d.toISOString().slice(0, 10); })();
const withGames = (fin) => ({ ...state, slate: [fake('t1', state.today, fin), fake('t0', yesterday, true)] });

function load(page, st, mine) {
  const html = fs.readFileSync(path.join(ROOT, page), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const errors = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
    beforeParse(w) {
      w.fetch = async url => ({ ok: /state\.json/.test(String(url)), status: 200, json: async () => st });
      w.scrollTo = () => {}; w.URL.createObjectURL = () => 'blob:x';
      if (mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(mine));
      w.addEventListener('error', e => errors.push(e.message));
    } });
  return { w: dom.window, errors };
}

(async () => {
  console.log('1. fresh visitor, tonight');
  let { w, errors } = load('index.html', withGames(false));
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

  console.log('4. admin page');
  ({ w, errors } = load('admin.html', withGames(false)));
  await sleep(250);
  check(w.document.getElementById('dataTabBtn').hidden === false, 'Data tab on admin');
  w.document.querySelector('#nav button[data-tab=data]').click(); await sleep(30);
  check(/generated/.test(w.document.getElementById('tab-data').textContent), 'Data tab renders');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('5. a preseason night');
  const preDay = { ...state, opening: '2099-01-01', slate: [{ ...fake('p1', state.today, false), type: 'PRE' }] };
  ({ w, errors } = load('index.html', preDay));
  await sleep(250);
  const d5 = w.document;
  check(d5.querySelectorAll('.card').length === 1, 'the preseason game has a card');
  check(/Preseason/.test(d5.querySelector('.card .tags').textContent), 'it is tagged Preseason');
  check(/Preseason\./.test(d5.querySelector('#slate .note').textContent) && /never graded/.test(d5.querySelector('#slate .note').textContent), 'the preseason note explains it is not graded');
  check(/Opening night/.test(d5.querySelector('#slate .note').textContent), 'the note gives opening night');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
