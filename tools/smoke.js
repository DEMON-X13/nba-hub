/* Smoke test for the built viewer.
 *
 *   node nba-hub/tools/smoke.js        (needs jsdom: npm install in nba-hub/tools)
 *
 * Loads nba-hub/index.html in jsdom with fetch stubbed to serve nba-hub/state.json plus one fabricated
 * game for tonight, and checks: the update stamp shows, every tab renders without a script error, a
 * visitor's pick is kept in their own storage and shows on My Picks, a parlay leg reaches the ticket
 * and a saved ticket grades once the game is final, and the Data tab is only on the admin page.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');
const ROOT = path.resolve(__dirname, '..', '..');
const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };

const state = JSON.parse(fs.readFileSync(path.join(ROOT, 'nba-hub', 'state.json'), 'utf8'));
const side = t => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [{ id: '1', name: 'Some Guard', pos: 'G', min: 34, o: 20, d: 10, adds: 21 }], out: [{ id: '2', name: 'Some Star', status: 'Out', min: 33, costs: 60 }] });
const fake = (id, date, fin) => ({ id, date, tip: date + 'T23:30:00Z', type: 'REG', away: 'BOS', home: 'NYK', neutral: false, status: fin ? 'final' : 'scheduled', awayScore: fin ? 98 : null, homeScore: fin ? 105 : null,
  line: -2.5, totalLine: 220, model: { pHome: 0.61, spread: -3.5, total: 224.5, pace: 99, home: side('NYK'), away: side('BOS') }, team: { pHome: 0.55, spread: -1.5 }, published: null });
const withGames = (fin) => ({ ...state, slate: [fake('t1', state.today, fin), fake('t0', state.today.slice(0, 8) + '01', true)] });

function load(page, st, mine) {
  const html = fs.readFileSync(path.join(ROOT, 'nba-hub', page), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const errors = [];
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/nba-hub/',
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

  console.log('2. a pick and a leg');
  d.querySelector('#nav button[data-tab=slate]').click(); await sleep(30);
  d.querySelector('.card .team.away .badge').click(); await sleep(30);
  let mine = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(mine.picks.t1 === 'BOS', 'pick stored in the browser');
  check(d.querySelector('.card .team.away .badge').classList.contains('mine'), 'pick marked on the card');
  d.querySelector('.card [data-act=leg][data-kind=spread]').click(); await sleep(30);
  mine = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(mine.legs.length === 1 && mine.legs[0].kind === 'spread' && mine.legs[0].side === 'NYK', 'spread leg on the ticket');
  d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
  check(d.querySelectorAll('#tab-parlay .legs li').length === 1, 'ticket shows the leg');
  d.getElementById('saveT').click(); await sleep(30);
  mine = JSON.parse(w.localStorage.getItem('nba_hub_2027'));
  check(mine.tickets.length === 1 && mine.legs.length === 0, 'ticket saved, legs cleared');
  d.querySelector('#nav button[data-tab=mine]').click(); await sleep(30);
  check(/BOS/.test(d.getElementById('tab-mine').textContent) && /open/.test(d.getElementById('tab-mine').textContent), 'My Picks lists the open pick');

  console.log('3. the next morning: the game is final');
  ({ w, errors } = load('index.html', withGames(true), mine));
  await sleep(250);
  const d2 = w.document;
  d2.querySelector('#nav button[data-tab=mine]').click(); await sleep(30);
  check(/lost/.test(d2.getElementById('tab-mine').textContent) && /0-1/.test(d2.getElementById('tab-mine').textContent), 'the pick graded as a loss (BOS lost 98-105)');
  d2.querySelector('#nav button[data-tab=parlay]').click(); await sleep(30);
  check(/won/.test(d2.querySelector('#tab-parlay .saved').textContent), 'the ticket graded: NYK -3.5 covered by 7');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log('4. admin page');
  ({ w, errors } = load('admin.html', withGames(false)));
  await sleep(250);
  check(w.document.getElementById('dataTabBtn').hidden === false, 'Data tab on admin');
  w.document.querySelector('#nav button[data-tab=data]').click(); await sleep(30);
  check(/generated/.test(w.document.getElementById('tab-data').textContent), 'Data tab renders');
  check(errors.length === 0, 'no script errors: ' + errors.join(' | '));

  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})();
