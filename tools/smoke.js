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
 * the backup import, a day-old injury report and a suggested tier short of its aim.
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
