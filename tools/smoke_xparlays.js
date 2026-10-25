/* X Parlays, a section of the viewer smoke test (README "X Parlays"): run by tools/smoke.js, alone with
 *
 *   SMOKE_ONLY=xparlays node tools/smoke.js
 *
 * The tab (app/parts/xparlays.html) reads liveparlays/parlays.json and ESPN's scoreboard and box scores when it is first
 * shown in a page load and on Refresh now, and draws X's placed parlays, each followed live. Here the built page boots in
 * jsdom on the published state.json (made-up games laid over it where a case needs them) and a stubbed file and ESPN:
 * made-up parlays on made-up games tonight, tomorrow and yesterday (so every case holds whatever the day the test runs),
 * ESPN's answers built in the shapes recorded in tools/fixtures/ and data/sample_summary.json. Every request is recorded:
 * one that is not a plain GET with cache no-store, or one before the tab is first shown, fails it.
 *
 * The cases port the NFL hub's (nflbets/build/smoke_live.js sections A to O) to the NBA's: the file is the page (every
 * leg's target, status, bar and stat line), the order a night runs in, nothing a browser holds drawn or touched, two
 * parlays alike but for a side, a player who did not take the floor (void once the game is final, "not in yet" while it
 * is on), a game postponed or on no list two days after its date (void), a combo summed, a double- and a triple-double
 * settling mid-game, a push on a whole line, "landed" only when every leg is graded, a parlay running into the next day,
 * a published final graded by the page's own settlement and read from nobody, the chips and totals, nought before tip,
 * an empty, missing or junk file, ESPN down, no read on a timer, focus or visibility, a final box score never read twice,
 * box scores only where a player's leg needs one, the file's shape, a cleared parlay never drawn or followed, the real
 * file and the real state, and the X on every card with its Clear this parlay? window (section O whole: Cancel, Escape,
 * a click outside, Tab kept inside, Clear, Show them again, the double tap, leaving the tab, two tabs, the prune, a
 * reload, a fresh browser), on the NBA's own key, with the NFL hub's key on the same origin never read, written or
 * removed.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = async function xParlays({ check, pageFile, ROOT }) {
  console.log('X Parlays');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => JSON.parse(JSON.stringify(x));
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const SEASON = REAL.season;
  const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const addD = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const ymd = d => d.replace(/-/g, '');
  const T = etDate(Date.now()), T1 = addD(T, 1), Y = addD(T, -1), OLD = addD(T, -3);
  const gid = (d, a, h) => `${SEASON}_${ymd(d)}_${a}_${h}`;
  const dayLong = d => new Date(d + 'T12:00:00Z').toLocaleDateString('en-US', { weekday: 'long', timeZone: 'UTC' });
  const dayShort = d => { const x = new Date(d + 'T12:00:00Z'), o = { timeZone: 'UTC' }; return `${x.toLocaleDateString('en-US', { ...o, weekday: 'short' })} ${x.toLocaleDateString('en-US', { ...o, month: 'short' })} ${x.getUTCDate()}`; };
  const HK = 'nba_lp_cleared_v1', NFL_HK = 'lp_cleared_here_v1';
  const ESPN_CODE = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };

  /* ---- the made-up games ----
     G1 Boston at New York tonight at 7 PM Eastern (6 PM in winter); G2 the Lakers at Golden State tonight at 10:30 PM
     Eastern, which is tomorrow in UTC; G3 Denver at Phoenix tomorrow night; G4 Chicago at Detroit tonight, postponed; G0
     yesterday's final, published with its box lines, between a real player's club and another; GOLD three days ago, on no
     published list */
  const P0 = REAL.players.find(p => p.ranked && p.team && p.team !== 'ORL') || REAL.players[0];
  const OPP0 = P0.team === 'MIA' ? 'ATL' : 'MIA';
  const G = {
    g1: { id: gid(T, 'BOS', 'NYK'), a: 'BOS', h: 'NYK', eid: '5501', tip: `${T}T23:00Z` },
    g2: { id: gid(T, 'LAL', 'GSW'), a: 'LAL', h: 'GSW', eid: '5502', tip: `${T1}T02:30Z` },
    g3: { id: gid(T1, 'DEN', 'PHX'), a: 'DEN', h: 'PHX', eid: '5503', tip: `${T1}T23:00Z` },
    g4: { id: gid(T, 'CHI', 'DET'), a: 'CHI', h: 'DET', eid: '5504', tip: `${T}T23:30Z` },
    g0: { id: gid(Y, OPP0, P0.team), a: OPP0, h: P0.team, eid: '5500', tip: `${Y}T23:30Z` },
    gold: { id: gid(OLD, 'SAC', 'POR'), a: 'SAC', h: 'POR' } };
  const IDS = new Set(Object.values(G).map(g => g.id));
  /* the published state, as it is, with the made-up games off it, yesterday's final laid in with its box lines, and today
     the viewer's Eastern date */
  const BOX0 = { [P0.id]: [25, 6, 4, 3, 1, 0], '9302': [10, 10, 2, 0, 0, 1] };
  function ST(o = {}) {
    const s = clone(REAL);
    s.today = T;
    s.slate = s.slate.filter(g => !IDS.has(g.id)); s.record = (s.record || []).filter(g => !IDS.has(g.id));
    for (const id of IDS) { if (s.finals) delete s.finals[id]; if (s.boxes && s.boxes.games) delete s.boxes.games[id]; }
    s.pending = (s.pending || []).filter(id => !IDS.has(id));
    s.slate.push({ id: G.g0.id, date: Y, tip: G.g0.tip, type: 'REG', away: G.g0.a, home: G.g0.h, neutral: false, status: 'final', espn: G.g0.eid, awayScore: 100, homeScore: 104, line: -4, totalLine: 204, ml: { home: -180, away: 150 }, model: { pHome: 0.6, spread: -3, total: 210 }, team: { pHome: 0.58 } });
    s.boxes = s.boxes || { from: addD(T, -7), days: 7, line: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'], games: {} };
    s.boxes.games[G.g0.id] = clone(BOX0);
    return Object.assign(s, o);
  }

  /* ---- ESPN, in its shapes ---- */
  const TYPE = { pre: { id: '1', name: 'STATUS_SCHEDULED', state: 'pre', completed: false, detail: 'Scheduled', shortDetail: '10/25 - 7:00 PM EDT' },
    in: { id: '2', name: 'STATUS_IN_PROGRESS', state: 'in', completed: false, detail: '7:12 - 3rd Quarter', shortDetail: '7:12 - 3rd' },
    post: { id: '3', name: 'STATUS_FINAL', state: 'post', completed: true, detail: 'Final', shortDetail: 'Final' },
    ppd: { id: '6', name: 'STATUS_POSTPONED', state: 'post', completed: false, detail: 'Postponed', shortDetail: 'Postponed' } };
  const ev = (g, st, as, hs, date = g.tip) => ({ id: g.eid, date, season: { year: SEASON, type: 2, slug: 'regular-season' },
    competitions: [{ neutralSite: false, status: { clock: 0, displayClock: '0.0', period: 0, type: TYPE[st] },
      competitors: [{ homeAway: 'home', team: { abbreviation: ESPN_CODE[g.h] || g.h }, score: String(st === 'pre' ? 0 : hs) }, { homeAway: 'away', team: { abbreviation: ESPN_CODE[g.a] || g.a }, score: String(st === 'pre' ? 0 : as) }] }] });
  const SCORE = { in: { g1: [88, 92], g2: [101, 116], g3: [70, 64] }, post: { g1: [106, 110], g2: [108, 124], g3: [104, 111] }, pre: { g1: [0, 0], g2: [0, 0], g3: [0, 0] } };
  /* tonight's answer carries, first, tomorrow's Boston at New York (the two play again), at other scores, and tomorrow's
     Denver at Phoenix: a game ESPN lists for another Eastern day is not the one asked for */
  const days = (st = 'in', o = {}) => ({
    [ymd(T)]: { events: [ev({ ...G.g1, eid: '5599' }, 'in', 1, 2, `${T1}T23:30Z`), ev(G.g1, st, ...SCORE[st].g1), ev(G.g2, st, ...SCORE[st].g2), ev(G.g4, 'ppd', 0, 0), ev(G.g3, 'in', 3, 99)] },
    [ymd(T1)]: { events: [ev(G.g3, st, ...SCORE[st].g3)] }, ...o });
  const KEYS = ['minutes', 'points', 'fieldGoalsMade-fieldGoalsAttempted', 'threePointFieldGoalsMade-threePointFieldGoalsAttempted', 'freeThrowsMade-freeThrowsAttempted', 'rebounds', 'assists', 'turnovers', 'steals', 'blocks', 'offensiveRebounds', 'defensiveRebounds', 'fouls', 'plusMinus'];
  const LABELS = ['MIN', 'PTS', 'FG', '3PT', 'FT', 'REB', 'AST', 'TO', 'STL', 'BLK', 'OREB', 'DREB', 'PF', '+/-'];
  /* a player's box line: [min, pts, reb, ast, tpm, stl, blk] (offensive boards a fifth of his rebounds), or none */
  const ath = (id, name, s, o = {}) => ({ active: true, athlete: { id, displayName: name, shortName: name.replace(/^(\w)\w*/, '$1.') }, starter: true, didNotPlay: false, reason: '', ejected: false,
    stats: s ? [String(s[0]), String(s[1]), `${Math.round(s[1] / 2.5)}-${Math.round(s[1] / 1.2)}`, `${s[4]}-${s[4] + 3}`, '2-2', String(s[2]), String(s[3]), '1', String(s[5]), String(s[6]), String(Math.floor(s[2] / 5)), String(s[2] - Math.floor(s[2] / 5)), '2', '+3'] : [], ...o });
  const sumOf = (sides, labelsOnly) => ({ boxscore: { players: sides.map(([team, list]) => ({ team: { abbreviation: ESPN_CODE[team] || team }, statistics: [labelsOnly ? { names: LABELS, labels: LABELS, athletes: list } : { names: LABELS, keys: KEYS, labels: LABELS, athletes: list }] })) } });
  const BOX = {
    in: { lane: [28, 24, 3, 6, 3, 1, 0], hale: [25, 18, 10, 2, 0, 0, 2], pike: [30, 26, 8, 7, 4, 2, 1], stroud: [20, 9, 3, 2, 1, 1, 1] },
    post: { lane: [36, 28, 4, 7, 4, 1, 0], hale: [33, 22, 12, 3, 0, 0, 2], pike: [38, 30, 9, 8, 5, 2, 1], stroud: [30, 12, 4, 3, 2, 1, 1] } };
  /* before tip ESPN's summary has no players at all (as recorded on 25 October 2026) */
  const sum1 = (st = 'in', o = {}) => st === 'pre' ? { boxscore: { teams: [] } } : sumOf([
    ['NYK', [ath('9001', 'Avery Lane', BOX[st].lane), ath('9002', 'Marcus Hale', BOX[st].hale), ath('9003', 'Theo Ruiz', null, { didNotPlay: true, reason: "COACH'S DECISION", active: false })]],
    ['BOS', [ath('9101', 'Jonah Pike', BOX[st].pike), ath('9102', 'Eli Stroud', BOX[st].stroud), ath('9103', 'Dante Cole', null, st === 'post' ? { didNotPlay: true, reason: '' } : {})]]], o.labelsOnly);
  const sums = (st = 'in', o = {}) => ({ [G.g1.eid]: sum1(st, o), [G.g2.eid]: st === 'pre' ? { boxscore: { teams: [] } } : sumOf([['GSW', [ath('9201', 'Cam Ford', [30, 21, 5, 4, 3, 0, 1])]], ['LAL', []]]),
    [G.g3.eid]: sumOf([['PHX', [ath('9301', 'Ray Dunn', [31, 17, 6, 5, 2, 1, 0])]], ['DEN', []]]), ...o.extra });
  const espnStub = (dd, ss) => async url => {
    if (/\/scoreboard\?/.test(url)) { const d = (/[?&]dates=(\d{8})/.exec(url) || [])[1], a = dd[d];
      if (a instanceof Error) throw a; if (typeof a === 'number') return { ok: false, status: a, json: async () => ({}) };
      if (a === 'junk') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
      return { ok: true, status: 200, json: async () => clone(a || { events: [] }) }; }
    if (/\/summary\?event=/.test(url)) { const id = (/event=([^&]+)/.exec(url) || [])[1], a = ss[id];
      if (a instanceof Error) throw a; if (typeof a === 'number') return { ok: false, status: a, json: async () => ({}) };
      return a ? { ok: true, status: 200, json: async () => clone(a) } : { ok: false, status: 404, json: async () => ({}) }; }
    return { ok: false, status: 404, json: async () => ({}) };
  };

  /* ---- the file ---- */
  const legF = (game, player, team, stat, line, side, main, pid) => Object.assign({ game, player, team, stat, line, side, main }, pid ? { pid } : {});
  const GAMES = [G.g1.id, G.g2.id, G.g3.id, G.g4.id, G.g0.id, G.gold.id];
  const FILE = { how: 'made up', updated: `${T}T17:30:00Z`, games: GAMES, parlays: [
    { id: 'night', stake: 10, price: 200, payout: 30, legs: [legF(1, 'Warriors', 'GSW', 'ml', 0, 'over', false)] },
    { id: 'early', stake: 20, price: 580, payout: 136, note: 'same game', legs: [
      legF(0, 'Avery Lane', 'NYK', 'pts', 22.5, 'over', true, '9001'),
      legF(0, 'Jonah Pike', 'BOS', 'ast', 9.5, 'under', true),
      legF(0, 'Eli Stroud', 'BOS', 'tpm', 3, 'over', false),
      legF(0, 'Jonah Pike', 'BOS', 'pra', 45.5, 'over', true)] }] };

  /* ---- the harness: the built page in jsdom; every request recorded ---- */
  const html = fs.readFileSync(pageFile('index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const open = [];
  async function run({ file = FILE, st = ST(), dd = days('in'), ss = sums('in'), seed, tab = 'xparlays', data = 'ok' } = {}) {
    const requests = [], errors = [], timers = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
      beforeParse(w) {
        const espn = espnStub(dd, ss);
        w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt: opt || {} });
          if (/espn\.com/.test(url)) return espn(url);
          if (/^liveparlays\/parlays\.json\?t=\d+$/.test(url)) {
            if (data === 'ok') return { ok: true, status: 200, json: async () => clone(file) };
            if (data === 'junk') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
            return { ok: false, status: data, json: async () => ({}) }; }
          if (/^state\.json$/.test(url)) return { ok: true, status: 200, json: async () => clone(st) };
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
        w.scrollTo = () => {}; if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
        if (tab) w.localStorage.setItem('nba_hub_2027:tab', tab);
        if (seed) seed(w);
        for (const k of ['setTimeout', 'setInterval']) { const real = w[k]; w[k] = function (fn, ms, ...a) { timers.push({ k, fn, ms }); return real.call(w, fn, ms, ...a); }; }
        w.addEventListener('error', e => errors.push(e.message));
      } });
    const w = dom.window, d = w.document; open.push(w);
    for (let i = 0; i < 400 && !/Updated/.test(txt(d.getElementById('stamp'))); i++) await sleep(10);
    const r = { w, d, requests, errors, timers };
    if (tab === 'xparlays') await settle(r);
    return r;
  }
  /* until the read the tab started is done */
  async function settle(r) { for (let i = 0; i < 500; i++) { const s = r.w.NBA_LP && r.w.NBA_LP.state(); if (s && s.loaded && !s.busy) { await sleep(15); if (!r.w.NBA_LP.state().busy) return; } await sleep(10); } }
  const show = async (r, tab = 'xparlays') => { r.d.querySelector(`#nav button[data-tab=${tab}]`).click(); if (tab === 'xparlays') await settle(r); else await sleep(20); };
  const cards = r => [...r.d.querySelectorAll('#lpCard .lp-p')];
  const cardOf = (r, id) => cards(r).find(c => c.getAttribute('data-lp-id') === id);
  const shownIds = r => cards(r).map(c => c.getAttribute('data-lp-id')).join();
  const rows = c => c ? [...c.querySelectorAll('.lp-leg')] : [];
  const rowOf = (c, who) => rows(c).find(x => txt(x.querySelector('.lp-who')) === who);
  const knob = x => txt(x && x.querySelector('.lp-knob')), lineAt = x => txt(x && x.querySelector('.lp-line')), status = x => txt(x && x.querySelector('.lp-status'));
  const tgt = x => txt(x && x.querySelector('.lp-tgt')), statl = x => txt(x && x.querySelector('.lp-stat')), mark = x => txt(x && x.querySelector('.lp-res'));
  const head = c => txt(c && c.querySelector('.lp-head'));
  /* the header's pills, each its own word (the header's text runs them together) */
  const pills = c => c ? [...c.querySelectorAll('.lp-head .lp-pill')].map(txt) : [];
  const tag = c => pills(c).filter(x => /^(landed|gone|void|push|\d+ void)$/.test(x)).join(',');
  const espnReq = r => r.requests.filter(x => /espn\.com/.test(x.url));
  const sbReq = r => r.requests.filter(x => /\/scoreboard\?/.test(x.url)), sumReq = r => r.requests.filter(x => /\/summary\?/.test(x.url));
  const fileReq = r => r.requests.filter(x => /liveparlays\/parlays\.json/.test(x.url));
  const plain = r => r.requests.every(x => (!x.opt.method || x.opt.method === 'GET') && !x.opt.headers && !x.opt.body);
  const noStore = r => r.requests.filter(x => /espn\.com|parlays\.json/.test(x.url)).every(x => x.opt.cache === 'no-store');
  const one = (gameIx, legs, o = {}) => ({ how: 'made up', updated: null, games: GAMES, parlays: [{ id: o.id || 'p', stake: 5, price: 150, payout: 12.5, legs: legs.map(l => Object.assign({ game: gameIx }, l)), ...o }] });
  const pl = (player, team, stat, line, side, main, pid) => { const o = legF(0, player, team, stat, line, side, main, pid); delete o.game; return o; };
  const finIx = r => { const app = r.d.getElementById('lpApp'), h = app.querySelector('.lp-done'), kids = [...app.children], at = h ? kids.indexOf(h) : Infinity;
    return cards(r).map(c => ({ id: c.getAttribute('data-lp-id'), fin: kids.indexOf(c) > at })); };

  try {
    /* ---- nothing before the tab is first shown: the page opens on Tonight, and no timer, focus or visibility reads ---- */
    {
      const r = await run({ tab: 'slate' });
      await sleep(30);
      for (const t of r.timers.slice()) if (typeof t.fn === 'function') try { t.fn(); } catch (e) {}
      for (const [at, type] of [[r.w, 'focus'], [r.d, 'visibilitychange'], [r.w, 'pageshow'], [r.w, 'online'], [r.w, 'hashchange'], [r.w, 'storage']]) at.dispatchEvent(new r.w.Event(type));
      await sleep(40);
      check(fileReq(r).length === 0 && espnReq(r).length === 0, 'X Parlays reads nothing (its file or ESPN) before its tab is shown, on any timer the page sets, on focus or on visibility');
      check(r.d.getElementById('tab-xparlays').hidden === true && r.d.querySelector('#nav button[data-tab=xparlays]') && txt(r.d.querySelector('#nav button[data-tab=xparlays]')) === 'X Parlays'
        && r.d.querySelector('#nav button[data-tab=parlay]').nextElementSibling === r.d.querySelector('#nav button[data-tab=xparlays]'), 'the tab bar has X Parlays, after the Parlay Builder, its section hidden');
      await show(r);
      check(fileReq(r).length === 1 && sbReq(r).length === 1 && sumReq(r).length === 1 && !r.d.getElementById('tab-xparlays').hidden && r.d.querySelector('#nav button[data-tab=xparlays]').getAttribute('aria-selected') === 'true',
        `the first show of the tab reads the file once, tonight's scoreboard and the one box score a player's leg needs (${fileReq(r).length} file, ${sbReq(r).length} scoreboards, ${sumReq(r).length} box scores)`);
      check(noStore(r) && plain(r) && fileReq(r).every(x => /^liveparlays\/parlays\.json\?t=\d+$/.test(x.url)) && espnReq(r).every(x => /&_=\d+$/.test(x.url)),
        'every read is a plain GET, no-store, past any cache (the file named from the root)');
      const n = r.requests.length;
      await show(r, 'slate'); await show(r);
      for (const t of r.timers.slice()) if (typeof t.fn === 'function' && t.k === 'setInterval') try { t.fn(); } catch (e) {}
      r.d.dispatchEvent(new r.w.Event('visibilitychange')); await sleep(40);
      check(r.requests.length === n && cards(r).length === 2, 'showing the tab again, the page\'s minute watch and coming back to the browser tab read nothing more, and draw the same');
      r.d.getElementById('lpNow').click(); await settle(r);
      check(fileReq(r).length === 2 && sbReq(r).length === 2 && sumReq(r).length === 2 && plain(r), 'Refresh now reads the file, the scoreboard and the live box score again');
      check(r.errors.length === 0, 'no script errors: ' + r.errors.join(' | '));
      const s = await run({ tab: 'xparlays' });
      check(fileReq(s).length === 1 && cards(s).length === 2, 'a page that opens on X Parlays (the saved tab) reads it on load');
    }

    /* ---- A. the file is the page: every leg, mid-game ---- */
    const A = await run();
    {
      const cs = cards(A);
      check(cs.length === 2 && rows(cs[0]).length === 4, `two cards from the file, the first of four legs (${cs.length})`);
      const early = cardOf(A, 'early'), [lane, pikeA, stroud, pra] = rows(early);
      check(tgt(lane) === 'Over 22.5' && knob(lane) === '24' && lineAt(lane) === '22.5' && status(lane) === 'hit' && mark(lane) === '✓' && txt(lane.querySelector('.lp-who')) === 'Avery Lane Points',
        'an Over main line passed mid-game reads Over 22.5, 24 on the bar at 22.5, hit: ' + txt(lane));
      check(statl(lane) === '24 pts, 3 reb, 6 ast, 3 3PM, 1 stl, 0 blk · 28 min', 'the stat line is his box line and his minutes: ' + statl(lane));
      /* the game is tonight's Boston at New York, not tomorrow's listed first in the same answer */
      check(sumReq(A).every(x => !x.url.includes('event=5599')), 'a game ESPN lists for another Eastern day is not taken for tonight\'s');
      check(/width:85\.33%/.test(lane.querySelector('.lp-fill').getAttribute('style')) && /left:80\.00%/.test(lane.querySelector('.lp-tick').getAttribute('style')), 'the bar runs to 125% of the line, its tick at 80%');
      check(tgt(pikeA) === 'Under 9.5' && knob(pikeA) === '7' && status(pikeA) === '2.5 to spare' && mark(pikeA) === '○', 'an Under under its line mid-game is 2.5 to spare: ' + txt(pikeA));
      check(tgt(stroud) === '3+' && knob(stroud) === '1' && lineAt(stroud) === '3' && status(stroud) === '2 to go', 'a milestone short mid-game reads 3+, 1, 2 to go: ' + txt(stroud));
      check(knob(pra) === '41' && status(pra) === '4.5 to go' && txt(pra.querySelector('.lp-who')) === 'Jonah Pike Pts + reb + ast', 'a combo is the sum of its parts (26 + 8 + 7 = 41): ' + txt(pra));
      check(txt(early.querySelector('.lp-games')) === 'BOS 88–92 NYK7:12 - 3rd' && /\btie\b/.test(early.querySelector('.lp-gm').className), 'the game\'s score and clock sit above a parlay of player legs, gold while undecided: ' + txt(early.querySelector('.lp-games')));
      check(/\$20\.00/.test(txt(early.querySelector('.lp-money'))) && /\+580/.test(txt(early)) && /\$136\.00/.test(txt(early)) && /same game/.test(head(early)) && head(early).includes(dayShort(T)) && /placed/.test(head(early)),
        'the money (staked, price, pays), the note, the date and "placed" are drawn: ' + head(early));
      /* B: the night runs in order: the 7 PM game's parlay before the 10:30 PM one's, under tonight's heading */
      check(cs[0] === early && cs[1] === cardOf(A, 'night'), 'the earlier tip first');
      const win = A.d.querySelector('#lpApp .lp-win');
      check(txt(win.querySelector('b')) === `${dayLong(T)} games` && txt(win.querySelector('span')).startsWith(`${new Date(T + 'T12:00:00Z').toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' })} ${+T.slice(8)} · first tip `),
        'a night is headed by its Eastern day, with its date and first tip: ' + txt(win));
      const nite = rows(cardOf(A, 'night'))[0];
      check(tgt(nite) === 'Win' && txt(nite.querySelector('.lp-who')) === 'Warriors To Win' && status(nite) === '7:12 - 3rd' && txt(nite.querySelector('.lp-gm')) === 'LAL 101–116 GSW' && /\bgood\b/.test(nite.querySelector('.lp-gm').className)
        && knob(nite) === '+15' && lineAt(nite) === 'line' && /\bwin\b/.test(nite.querySelector('.lp-res').className) && !cardOf(A, 'night').querySelector('.lp-games'),
        'a team leg is built like a player leg: its target, who, the score in its row (the clock only in the status), its margin on a bar marked line, no strip above: ' + txt(nite));
      check(A.errors.length === 0, 'no script errors: ' + A.errors.join(' | '));
    }

    /* ---- a player found by his ESPN id where the file spells him otherwise, and by his name only where one player answers ---- */
    {
      const file = one(0, [pl('Avery Lane-Smith', 'NYK', 'pts', 22.5, 'over', true, '9001'), pl('M. Hale', 'NYK', 'reb', 8.5, 'over', true), pl('Lane', 'NYK', 'ast', 1.5, 'over', true)]);
      const r = await run({ file }), [byId, byKey, none] = rows(cards(r)[0]);
      check(status(byId) === 'hit' && knob(byId) === '24', 'the file\'s pid finds him in the box whatever the name: ' + txt(byId));
      check(status(byKey) === 'hit' && knob(byKey) === '10', 'a name the box spells another way is found by last name and initial: ' + txt(byKey));
      check(statl(none) === 'not on the box score', 'a name no one player answers to is not guessed at: ' + txt(none));
    }

    /* ---- C. nothing a browser holds is drawn here, and nothing of it is touched ---- */
    {
      const mine = { picks: {}, bank: { filter: 'all' }, build: [{ id: 'b1', day: T, type: 'parlay', stake: 25, legs: [{ id: G.g1.id, kind: 'ml', side: 'NYK', line: 0, odds: -150 }] }],
        slip: { legs: [{ id: G.g1.id, kind: 'prop', pid: '9001', name: 'Avery Lane', team: 'NYK', stat: 'reb', mk: 'main', line: 7.5, side: 'over', odds: -110, at: `${T}T15:00:00Z`, away: 'BOS', home: 'NYK' }], stake: 20 } };
      const blob = JSON.stringify(mine);
      const r = await run({ seed: w => w.localStorage.setItem('nba_hub_2027', blob) }), q = await run({ tab: 'slate', seed: w => w.localStorage.setItem('nba_hub_2027', blob) });
      check(cards(r).length === 2 && !/Rebounds/.test(txt(r.d.getElementById('lpCard'))) && !/\$25\.00/.test(txt(r.d.getElementById('lpCard'))), 'the browser\'s own Bet Build and parlay are not drawn as X\'s');
      /* what the page keeps of its own is what it keeps without X Parlays ever shown: the tab writes nothing of it */
      const keys = w => { const o = {}; for (let i = 0; i < w.localStorage.length; i++) { const k = w.localStorage.key(i); if (k !== 'nba_hub_2027:tab') o[k] = w.localStorage.getItem(k); } return JSON.stringify(o); };
      check(keys(r.w) === keys(q.w) && JSON.parse(r.w.localStorage.getItem('nba_hub_2027')).build.length === 1, 'showing X Parlays changes nothing the browser keeps: its storage is what a load that never shows the tab leaves');
    }

    /* ---- C4. two parlays alike but for the side or the player are two parlays ---- */
    {
      const ml = (team, name) => legF(0, name, team, 'ml', 0, 'over', false), tot = legF(0, 'Total', 'NYK', 'total', 200.5, 'over', true);
      const file = { how: 'x', updated: null, games: GAMES, parlays: [
        { id: 'nyk-over', stake: 5, legs: [ml('NYK', 'Knicks'), tot] }, { id: 'bos-over', stake: 5, legs: [ml('BOS', 'Celtics'), tot] },
        { id: 'lane-4', stake: 5, legs: [legF(0, 'Avery Lane', 'NYK', 'ast', 4.5, 'over', true)] }, { id: 'hale-4', stake: 5, legs: [legF(0, 'Marcus Hale', 'NYK', 'ast', 4.5, 'over', true)] }] };
      const r = await run({ file }), t = cards(r).map(txt);
      check(t.length === 4 && t.some(c => /Knicks To Win/.test(c)) && t.some(c => /Celtics To Win/.test(c)) && t.some(c => /Avery Lane Assists/.test(c)) && t.some(c => /Marcus Hale Assists/.test(c)),
        'parlays alike but for the side or the player are separate cards: ' + t.length);
    }

    /* ---- C5. a player who did not take the floor; a postponed game; a game on no list two days after its date ---- */
    {
      const file = { how: 'x', updated: null, games: GAMES, parlays: [
        { id: 'dnp-over', stake: 10, legs: [legF(0, 'Theo Ruiz', 'NYK', 'pts', 8.5, 'over', true), legF(0, 'Avery Lane', 'NYK', 'pts', 22.5, 'over', true)] },
        { id: 'dnp-under', stake: 10, legs: [legF(0, 'Theo Ruiz', 'NYK', 'reb', 3.5, 'under', true)] },
        { id: 'ghost', stake: 10, legs: [legF(0, 'Ghost Player', 'NYK', 'pts', 5.5, 'over', true)] },
        { id: 'cole', stake: 10, legs: [legF(0, 'Dante Cole', 'BOS', 'pts', 10.5, 'over', true)] },
        { id: 'ppd', stake: 10, legs: [legF(3, 'Pistons', 'DET', 'spread', -2.5, 'over', false), legF(3, 'Some Piston', 'DET', 'pts', 15.5, 'over', true)] },
        { id: 'ppd-won', stake: 10, legs: [legF(3, 'Bulls', 'CHI', 'ml', 0, 'over', false), legF(0, 'Avery Lane', 'NYK', 'pts', 22.5, 'over', true)] },
        { id: 'gone-date', stake: 10, legs: [legF(5, 'Kings', 'SAC', 'ml', 0, 'over', false), legF(5, 'Old Player', 'POR', 'reb', 7.5, 'under', true)] }] };
      const v = await run({ file, dd: days('post'), ss: sums('post') });
      const over = cardOf(v, 'dnp-over'), ruiz = rowOf(over, 'Theo Ruiz Points');
      check(!!ruiz && status(ruiz) === 'void' && mark(ruiz) === 'V' && statl(ruiz) === "did not play (coach's decision): a book voids this leg",
        'a player the final box lists as not playing is void, with the box score\'s reason: ' + txt(ruiz));
      check(tag(over) === 'landed,1 void', 'his parlay with the rest won is "landed, 1 void": ' + pills(over));
      const under = cardOf(v, 'dnp-under');
      check(status(rows(under)[0]) === 'void' && tag(under) === 'void', 'an Under on him is void too, and the parlay is void, neither landed nor gone: ' + pills(under));
      const ghost = rows(cardOf(v, 'ghost'))[0];
      check(status(ghost) === 'void' && statl(ghost) === 'did not play (not on the box score): a book voids this leg', 'a player not on the final box score at all is void: ' + txt(ghost));
      const cole = rows(cardOf(v, 'cole'))[0];
      check(status(cole) === 'void' && statl(cole) === 'did not play: a book voids this leg', 'a player with no line on the final box is void: ' + txt(cole));
      const ppd = cardOf(v, 'ppd');
      check(rows(ppd).every(x => status(x) === 'void' && mark(x) === 'V') && rows(ppd).every(x => statl(x) === 'not played on its date: a book voids this leg') && tag(ppd) === 'void',
        'every leg on a game ESPN calls postponed is void, the team\'s and the player\'s, and the parlay is void: ' + txt(ppd));
      check(tag(cardOf(v, 'ppd-won')) === 'landed,1 void', 'a parlay with a postponed leg and the rest won is landed, 1 void: ' + pills(cardOf(v, 'ppd-won')));
      const gd = cardOf(v, 'gone-date');
      check(rows(gd).every(x => status(x) === 'void') && tag(gd) === 'void' && !sbReq(v).some(x => x.url.includes(`dates=${ymd(OLD)}`)),
        'a game of this season on no published list two days after its date is void, as the page grades it (offList), and its date is not read from ESPN: ' + txt(gd));
      check(finIx(v).every(x => x.fin), 'with every game over (or not played) every parlay is under Finished');
      /* while the game is on: no line yet is "not in yet", graded on nothing, never void yet */
      const live = await run({ file, dd: days('in'), ss: sums('in') });
      const ruizL = rowOf(cardOf(live, 'dnp-over'), 'Theo Ruiz Points'), coleL = rows(cardOf(live, 'cole'))[0], ghostL = rows(cardOf(live, 'ghost'))[0];
      check(status(ruizL) === '8.5 to go' && knob(ruizL) === '0' && statl(ruizL) === 'not in yet' && status(coleL) === '10.5 to go' && statl(coleL) === 'not in yet',
        'mid-game a player with no line yet is graded on nothing and said not in yet: ' + txt(ruizL) + ' / ' + txt(coleL));
      check(status(ghostL) === '5.5 to go' && statl(ghostL) === 'not on the box score', 'mid-game a player not on the box is graded on nothing and said so: ' + txt(ghostL));
      check(status(rows(cardOf(live, 'dnp-under'))[0]) === '3.5 to spare', 'mid-game an Under on a player not in yet is to spare, not void');
      check(finIx(live).every(x => x.fin === ['ppd', 'gone-date'].includes(x.id)), 'mid-game only the void parlays are under Finished: ' + JSON.stringify(finIx(live)));
    }

    /* ---- the NBA's own: a double- and a triple-double, a combo, a push on a whole line, "landed" only when every leg is
       graded, a parlay into the next day, a published final read from nobody ---- */
    {
      const file = { how: 'x', updated: null, games: GAMES, parlays: [
        { id: 'dd', stake: 5, legs: [legF(0, 'Marcus Hale', 'NYK', 'dd', 1, 'over', false), legF(0, 'Jonah Pike', 'BOS', 'td', 1, 'over', false), legF(0, 'Eli Stroud', 'BOS', 'sb', 1.5, 'over', true)] },
        { id: 'push', stake: 5, legs: [legF(0, 'Avery Lane', 'NYK', 'pts', 28, 'over', true), legF(0, 'Knicks', 'NYK', 'spread', -4, 'over', false), legF(0, 'Total', 'NYK', 'total', 216, 'under', true)] },
        { id: 'span', stake: 5, legs: [legF(0, 'Avery Lane', 'NYK', 'pts', 20.5, 'over', true), legF(2, 'Suns', 'PHX', 'ml', 0, 'over', false)] }] };
      const r = await run({ file });
      const dd = cardOf(r, 'dd'), hale = rowOf(dd, 'Marcus Hale Double-double'), pikeTd = rowOf(dd, 'Jonah Pike Triple-double'), sb = rowOf(dd, 'Eli Stroud Stl + blk');
      check(tgt(hale) === 'Yes' && status(hale) === 'hit' && mark(hale) === '✓' && knob(hale) === '2' && lineAt(hale) === '2 at 10+', 'a double-double is hit the moment two of points, rebounds, assists, steals and blocks reach 10, mid-game: ' + txt(hale));
      check(status(pikeTd) === '2 more at 10+' && knob(pikeTd) === '1' && lineAt(pikeTd) === '3 at 10+', 'a triple-double one category in reads 2 more at 10+: ' + txt(pikeTd));
      check(status(sb) === 'hit' && knob(sb) === '2', 'steals + blocks is the two summed (1 + 1), over 1.5 hit mid-game: ' + txt(sb));
      const span = cardOf(r, 'span');
      check(head(span).includes(`runs into ${dayLong(T1)} games`) && rows(span)[1] && txt(rows(span)[1].querySelector('.lp-gm')) === 'DEN 70–64 PHX',
        'a parlay into the next day says it runs into that night, and that game is read from its own day\'s scoreboard, not from another day\'s listing: ' + head(span) + ' / ' + txt(rows(span)[1]));
      check(sbReq(r).map(x => (/dates=(\d{8})/.exec(x.url) || [])[1]).sort().join() === [ymd(T), ymd(T1)].sort().join(), 'one scoreboard a date, by its Eastern date: ' + sbReq(r).map(x => x.url).join(' '));
      /* at the final: a push on a whole line is P (a player's points, a spread, a total), and the parlay of pushes is a push */
      const f = await run({ file, dd: days('post'), ss: sums('post') });
      const push = cardOf(f, 'push');
      check(rows(push).every(x => status(x) === 'push' || status(x) === 'level') && rows(push).every(x => mark(x) === 'P') && tag(push) === 'push',
        'a whole line landed exactly is a push (28 points over 28, the Knicks by 4 at -4, 216 under 216), and a parlay of pushes is a push: ' + txt(push));
      check(status(rowOf(cardOf(f, 'dd'), 'Jonah Pike Triple-double')) === 'missed' && tag(cardOf(f, 'dd')) === 'gone', 'a triple-double short at the final is missed, the parlay gone');
      check(tag(cardOf(f, 'span')) === 'landed' && !pills(cardOf(f, 'span')).some(x => /runs into/.test(x)), 'a parlay over two days lands once both games are final and won, and no longer says it runs on');
      /* "landed" asks for every leg graded: the final's box score does not answer, so the player's leg waits, and the
         parlay is not landed or finished until it does */
      const ss = sums('post'); ss[G.g1.eid] = 500;
      const w8 = await run({ file: { how: 'x', updated: null, games: GAMES, parlays: [{ id: 'wait', stake: 5, legs: [legF(0, 'Avery Lane', 'NYK', 'pts', 20.5, 'over', true), legF(0, 'Knicks', 'NYK', 'ml', 0, 'over', false)] }] }, dd: days('post'), ss });
      const wc = cardOf(w8, 'wait');
      check(status(rows(wc)[0]) === 'waiting' && status(rows(wc)[1]) === 'won' && tag(wc) === '' && !finIx(w8)[0].fin, 'a final whose box score has not answered: the player\'s leg waits and the parlay is neither landed nor finished: ' + txt(wc));
      const n0 = sumReq(w8).length;
      /* the box answers on Refresh now: landed, and a final box score is never read again */
      ss[G.g1.eid] = sum1('post');
      await w8.w.lpRefresh();
      check(tag(cardOf(w8, 'wait')) === 'landed' && finIx(w8)[0].fin, 'once the box answers, the parlay lands: ' + pills(cardOf(w8, 'wait')));
      const n1 = sumReq(w8).length; await w8.w.lpRefresh();
      check(n1 === n0 + 1 && sumReq(w8).length === n1, `a final's box score is read until it answers, and never again (${n0}, ${n1}, ${sumReq(w8).length})`);
    }

    /* ---- a published final: graded by the page's own settlement, on the published box lines, read from nobody ---- */
    {
      const file = { how: 'x', updated: null, games: GAMES, parlays: [{ id: 'pub', stake: 5, price: 400, payout: 25, legs: [
        legF(4, P0.name, P0.team, 'pts', 24.5, 'over', true), legF(4, 'Nico Vale', OPP0, 'dd', 1, 'over', false, '9302'), legF(4, 'Home', P0.team, 'spread', -4, 'over', false), legF(4, 'Total', P0.team, 'total', 203.5, 'over', true)] }] };
      const r = await run({ file });
      const c = cardOf(r, 'pub'), [p, nv, sp, tt] = rows(c);
      check(status(p) === 'hit' && knob(p) === '25' && statl(p) === '25 pts, 6 reb, 4 ast, 3 3PM, 1 stl, 0 blk', `a published final grades a leg on a player the published state names (${P0.name}, found by his name and club) from the published box line: ` + txt(p));
      check(status(nv) === 'hit' && knob(nv) === '2', 'and a double-double on the published line (10 points, 10 rebounds): ' + txt(nv));
      check(status(sp) === 'level' && mark(sp) === 'P' && status(tt) === 'won' && txt(sp.querySelector('.lp-gm')) === `${OPP0} 100–104 ${P0.team}` && tag(c) === 'landed',
        'a spread landed exactly is a push and the total won, by legResult on the published score: ' + txt(c));
      check(!sbReq(r).some(x => x.url.includes(`dates=${ymd(Y)}`)) && sumReq(r).length === 0 && fileReq(r).length === 1, 'a game the published state grades is read from nobody: ' + espnReq(r).map(x => x.url).join(' '));
      /* the same leg with the published box not in yet: read from ESPN's box instead */
      const st = ST(); delete st.boxes.games[G.g0.id];
      const ss = sums('in', { extra: { [G.g0.eid]: sumOf([[P0.team, [ath(P0.id, P0.name, [35, 27, 5, 4, 3, 1, 0])]], [OPP0, []]]) } });
      const dd = days('in', { [ymd(Y)]: { events: [ev(G.g0, 'post', 100, 104)] } });
      const r2 = await run({ file: { ...file, parlays: [{ ...file.parlays[0], legs: [file.parlays[0].legs[0]] }] }, st, dd, ss });
      const p2 = rows(cardOf(r2, 'pub'))[0];
      check(status(p2) === 'hit' && knob(p2) === '27' && /· 35 min$/.test(statl(p2)) && sbReq(r2).some(x => x.url.includes(`dates=${ymd(Y)}`)) && sumReq(r2).some(x => x.url.includes(`event=${G.g0.eid}`)),
        'a published final whose box line is not published yet is graded from ESPN\'s box: ' + txt(p2));
    }

    /* ---- D3. the chips carry the result; totals settle the moment they pass ---- */
    {
      const chipOf = async (legs, st, gi = 0) => { const r = await run({ file: one(gi, legs), dd: days(st), ss: sums(st) }); return { r, row: rows(cards(r)[0])[0], gm: cards(r)[0].querySelector('.lp-gm') }; };
      check(/\bgood\b/.test((await chipOf([pl('Knicks', 'NYK', 'ml', 0, 'over', false)], 'in')).gm.className), 'a game being won is green');
      check(/\bbad\b/.test((await chipOf([pl('Celtics', 'BOS', 'ml', 0, 'over', false)], 'in')).gm.className), 'a game being lost is red');
      const short = await chipOf([pl('Avery Lane', 'NYK', 'pts', 40.5, 'over', true)], 'in');
      check(/\btie\b/.test(short.gm.className) && !!short.gm.closest('.lp-games'), 'a player\'s leg short with the game on is gold, on the strip above');
      const ov = await chipOf([pl('Total', 'GSW', 'total', 216.5, 'over', true)], 'in', 1);
      check(tgt(ov.row) === 'Over 216.5' && knob(ov.row) === '+0.5' && mark(ov.row) === '✓' && /\bgood\b/.test(ov.gm.className) && /Total Points/.test(txt(ov.row)) && sumReq(ov.r).length === 0,
        'a total past its line mid-game (217 points) is won at once, +0.5, green, and reads no box score: ' + txt(ov.row));
      check(mark((await chipOf([pl('Total', 'GSW', 'total', 216.5, 'under', true)], 'in', 1)).row) === '✗', 'an under the total has passed mid-game is lost at once');
      check(!/[✓✗]/.test(mark((await chipOf([pl('Total', 'GSW', 'total', 230.5, 'over', true)], 'in', 1)).row)), 'an over still short mid-game is not settled');
      const fo = await chipOf([pl('Total', 'GSW', 'total', 236.5, 'over', true)], 'post', 1);
      check(/\bloss\b/.test(fo.row.querySelector('.lp-res').className) && knob(fo.row) === '-4.5' && status(fo.row) === 'lost', 'a total that finished under an over bet is lost, -4.5: ' + txt(fo.row));
      const fu = await chipOf([pl('Total', 'GSW', 'total', 236.5, 'under', true)], 'post', 1);
      check(/\bwin\b/.test(fu.row.querySelector('.lp-res').className) && tgt(fu.row) === 'Under 236.5' && status(fu.row) === 'won', 'an under that finished under is won');
      const pre = await chipOf([pl('Knicks', 'NYK', 'ml', 0, 'over', false)], 'pre');
      check(!/good|bad|tie/.test(pre.gm.className) && status(pre.row) === '10/25 - 7:00 PM EDT', 'a game not started is not coloured, its status ESPN\'s tip line');
    }

    /* ---- E. nought before tip ---- */
    {
      const b4 = await run({ dd: days('pre'), ss: sums('pre') });
      const early = cardOf(b4, 'early'), first = rows(early)[0];
      check(txt(early.querySelector('.lp-gm')) === 'BOS 0–0 NYK10/25 - 7:00 PM EDT' && knob(first) === '0' && statl(first) === '0 pts' && statl(rows(early)[3]) === '0 pts, 0 reb, 0 ast' && status(first) === '10/25 - 7:00 PM EDT',
        'before tip the strip reads 0–0, a leg 0, its stat line the leg\'s own parts at nought: ' + txt(early).slice(0, 160));
      check(sumReq(b4).length === 0, 'no box score is read before tip');
    }

    /* ---- F, G. an empty file, a missing one, junk; ESPN down ---- */
    {
      const e1 = await run({ file: { how: 'x', updated: null, games: [], parlays: [] } });
      check(txt(e1.d.getElementById('lpApp')) === 'Nothing to watch yet' && espnReq(e1).length === 0, 'an empty file says only "Nothing to watch yet", and reads nothing from ESPN');
      for (const data of [404, 'junk']) {
        const e2 = await run({ data });
        check(/could not be read/.test(txt(e2.d.querySelector('#lpApp .lp-note'))) && txt(e2.d.getElementById('lpStamp')) === 'not updating' && e2.errors.length === 0, `a file that ${data === 404 ? 'is missing' : 'is not JSON'} is said, and nothing throws`);
      }
      const e3 = await run({ file: { how: 'x', parlays: 'no' } });
      check(/could not be read/.test(txt(e3.d.querySelector('#lpApp .lp-note'))), 'a file that is not a parlay file is said');
      const g1 = await run({ dd: { [ymd(T)]: 403, [ymd(T1)]: 403 } });
      check(cards(g1).length === 2 && /not loading/.test(txt(g1.d.querySelector('#lpApp .lp-note'))) && txt(g1.d.getElementById('lpStamp')) === 'not updating' && status(rows(cardOf(g1, 'early'))[0]) === 'waiting',
        'ESPN down: the parlays are still listed, the note says the scores are not loading, each leg waits');
      /* two nights, tomorrow's answering junk: a failed read, all or nothing, so tonight's leg waits too */
      const g2 = await run({ file: one(0, [pl('Avery Lane', 'NYK', 'pts', 20.5, 'over', true), { ...pl('Suns', 'PHX', 'ml', 0, 'over', false), game: 2 }]), dd: { ...days('in'), [ymd(T1)]: 'junk' } });
      check(/not loading/.test(txt(g2.d.querySelector('#lpApp .lp-note'))) && rows(cards(g2)[0]).every(x => status(x) === 'waiting'), 'a scoreboard that answers junk is a failed read, all or nothing: ' + txt(cards(g2)[0]).slice(0, 120));
      const g2b = await run({ file: one(0, [pl('Avery Lane', 'NYK', 'pts', 20.5, 'over', true), { ...pl('Suns', 'PHX', 'ml', 0, 'over', false), game: 2 }]), dd: { ...days('in'), [ymd(T1)]: { error: 'no' } } });
      check(/not loading/.test(txt(g2b.d.querySelector('#lpApp .lp-note'))) && rows(cards(g2b)[0]).every(x => status(x) === 'waiting'), 'a scoreboard that answers JSON with no events is a failed read too');
      /* a box score that fails is the one game's: the rest of the read stands */
      const g3 = await run({ ss: { ...sums('in'), [G.g1.eid]: new Error('reset') } });
      check(!g3.d.querySelector('#lpApp .lp-note') && status(rows(cardOf(g3, 'early'))[0]) === 'waiting' && status(rows(cardOf(g3, 'night'))[0]) === '7:12 - 3rd', 'a box score that fails leaves its legs waiting and nothing else');
    }

    /* ---- H2. a box score only where a player's leg needs one ---- */
    {
      const ml = one(0, [pl('Knicks', 'NYK', 'ml', 0, 'over', false)]); ml.parlays[0].legs.push({ game: 1, player: 'Warriors', team: 'GSW', stat: 'spread', line: -9.5, side: 'over', main: false });
      const m = await run({ file: ml });
      const r0 = rows(cards(m)[0]);
      check(sumReq(m).length === 0 && txt(r0[1].querySelector('.lp-who')) === 'Warriors To Cover' && tgt(r0[1]) === '-9.5' && knob(r0[1]) === '+5.5', 'a parlay of team legs reads no box score; a spread reads from its side (Warriors -9.5 up 15: +5.5)');
      check((txt(r0[0]).match(/7:12 - 3rd/g) || []).length === 1, 'the clock is in a team row once');
      const mixed = clone(ml); mixed.parlays.push({ id: 'pp', stake: 1, legs: [{ game: 0, player: 'Avery Lane', team: 'NYK', stat: 'pts', line: 22.5, side: 'over', main: true }] });
      const m2 = await run({ file: mixed });
      check(sumReq(m2).length === 1 && sumReq(m2)[0].url.includes(`event=${G.g1.eid}`), 'one player\'s leg reads exactly its game\'s box score');
      /* "ats" is read as spread, a stat the page does not know drops its leg, a leg on no game too */
      const odd = { how: 'x', updated: null, games: [G.g1.id], parlays: [{ id: 'odd', stake: 1, legs: [{ game: 0, player: 'Knicks', team: 'NYK', stat: 'ats', line: -3.5, side: 'over', main: false },
        { game: 0, player: 'Avery Lane', team: 'NYK', stat: 'passing_yards', line: 200.5, side: 'over', main: true }, { game: 4, player: 'X', team: 'NYK', stat: 'pts', line: 1.5, side: 'over', main: true },
        { game: '0', player: 'X', team: 'NYK', stat: 'pts', line: 1.5, side: 'over', main: true }] }, { id: 'none', stake: 1, legs: [{ game: 0, player: 'Y', team: 'NYK', stat: 'pts', side: 'over', main: true }] }] };
      const o = await run({ file: odd });
      check(cards(o).length === 1 && rows(cards(o)[0]).length === 1 && txt(rows(cards(o)[0])[0].querySelector('.lp-who')) === 'Knicks To Cover' && tgt(rows(cards(o)[0])[0]) === '-3.5',
        'ats is read as a spread; a leg on an unknown stat, on no game or with no line is dropped, and a parlay with none left');
    }

    /* ---- K. a cleared parlay stays in the file and is not drawn, nor its games read ---- */
    {
      const file = clone(FILE); file.parlays[1].cleared = true; file.updated = '2026-10-10T17:28:45Z';
      const c = await run({ file });
      check(shownIds(c) === 'night' && sumReq(c).length === 0, 'a cleared parlay is not drawn, and its box score is not read: ' + shownIds(c));
      const up = txt(c.d.getElementById('lpUpdated')), want = new Date('2026-10-10T17:28:45Z').toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
      check(!!c.d.querySelector('#lpCard h2 + #lpUpdated') && up === 'X’s placed parlays, followed live through their games · updated ' + want, 'under the heading, when the file last changed: ' + up);
      const all = await run({ file: { ...file, parlays: file.parlays.map(p => ({ ...p, cleared: true })) } });
      check(txt(all.d.getElementById('lpApp')) === 'Nothing to watch yet' && espnReq(all).length === 0, 'every parlay cleared: nothing to watch, nothing read from ESPN');
      const no = await run({ file: { ...FILE, parlays: [{ ...FILE.parlays[0], cleared: false }, { ...FILE.parlays[1], cleared: 'yes' }] } });
      check(cards(no).length === 2, 'cleared means true and nothing else');
    }

    /* ---- L. the real file, and the real state with a parlay on its own finals ---- */
    {
      const real = JSON.parse(fs.readFileSync(path.join(ROOT, 'liveparlays', 'parlays.json'), 'utf8'));
      check(typeof real.how === 'string' && /\bstat\b/.test(real.how) && /cleared/.test(real.how) && /Claude/.test(real.how), 'the real file\'s how says how it is kept');
      const rf = await run({ file: real, st: REAL });
      const live = real.parlays.filter(p => p && p.cleared !== true);
      /* the real file is hand-kept, and this smoke gates state.json: so here only what would break the page (an error
         thrown, NaN or undefined drawn) holds the publish back; a parlay the page drops for a bad leg is said, and held
         strictly by tools/test_autoclear.js, which turns the run red without holding back the day's scores */
      const rtxt = txt(rf.d.getElementById('tab-xparlays'));
      check(rf.errors.length === 0 && !/\bNaN\b|\bundefined\b/.test(rtxt), `the real file draws with no error, NaN or undefined (${cards(rf).length} of its ${live.length} parlays not cleared drawn)`);
      if (cards(rf).length !== live.length) console.log(`  note: the real file has ${live.length} parlays not cleared and the page draws ${cards(rf).length}: tools/test_autoclear.js holds which leg it drops`);
      /* a parlay on the published state's own last finals, as it stands: graded by its box lines, NaN and undefined nowhere */
      const fin = REAL.slate.filter(g => g.status === 'final' && g.type !== 'PRE' && REAL.boxes && REAL.boxes.games[g.id] && Object.keys(REAL.boxes.games[g.id]).length).slice(0, 2);
      if (fin.length) {
        const legs = [];
        fin.forEach((g, i) => { const box = REAL.boxes.games[g.id], pid = Object.keys(box).sort((a, b) => box[b][0] - box[a][0])[0], p = REAL.players.find(x => x.id === pid);
          legs.push({ game: i, player: p ? p.name : 'Top Scorer', pid, team: p ? p.team : g.home, stat: 'pts', line: box[pid][0] - 0.5, side: 'over', main: true });
          legs.push({ game: i, player: 'Winner', team: g.homeScore > g.awayScore ? g.home : g.away, stat: 'ml', line: 0, side: 'over', main: false }); });
        const file = { how: 'x', updated: null, games: fin.map(g => g.id), parlays: [{ id: 'real', stake: 5, price: 500, payout: 30, legs }] };
        const rr = await run({ file, st: REAL });
        const c = cardOf(rr, 'real'), t = txt(rr.d.getElementById('tab-xparlays'));
        check(!!c && rows(c).every(x => ['hit', 'won'].includes(status(x))) && tag(c) === 'landed' && espnReq(rr).length === 0 && !/\bNaN\b|\bundefined\b/.test(t),
          `the published state's own finals (${fin.map(g => g.id).join(', ')}) grade a parlay of their top scorers and winners, read from nobody, NaN and undefined nowhere: ` + (c ? head(c) : 'no card'));
      }
    }

    /* ---- the page's reading against the job's: the recorded summary through tools/fetch_box.js's own parse ---- */
    {
      const FB = require('./fetch_box'), sample = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'sample_summary.json'), 'utf8'));
      const comp = sample.header.competitions[0].competitors, home = comp.find(c => c.homeAway === 'home').team.abbreviation, away = comp.find(c => c.homeAway === 'away').team.abbreviation;
      const job = FB.parseSummary(sample, { game_id: 'x', date: '2022-01-01', home, away }).players;
      let same = job.length > 0;
      for (const team of [home, away]) for (const a of A.w.NBA_LP.boxSide(sample, team) || []) {
        const j = job.find(x => x.player_id === a.id); if (!j) { same = false; continue; }
        const want = j.dnp ? null : [j.pts, j.orb + j.drb, j.ast, j.tpm, j.stl, j.blk];
        if (JSON.stringify(a.line) !== JSON.stringify(want) || a.dnp !== !!j.dnp || (!j.dnp && a.min !== j.min)) same = false;
      }
      check(same && (A.w.NBA_LP.boxSide(sample, home) || []).length + (A.w.NBA_LP.boxSide(sample, away) || []).length === job.length,
        'the page reads the recorded box score (data/sample_summary.json) exactly as the job does: every player, his line, minutes and did-not-play');
      const lab = A.w.NBA_LP.boxSide(sumOf([['NYK', [ath('1', 'A B', [30, 20, 11, 3, 2, 1, 0])]]], true), 'NYK');
      check(JSON.stringify(lab[0].line) === '[20,11,3,2,1,0]' && lab[0].min === 30, 'a box with labels and no keys is read by its labels');
      /* a leg whose player has an id is found by it or not at all: never on a teammate of the same last name and initial
         (Jalen and Jaylin Williams, OKC); a leg with no id falls back to the name, where one player answers */
      /* made-up names, so the published players give the no-id leg no id of their own */
      const twin = sumOf([['OKC', [ath('9001', 'Jaxlin Wilmerding', [24, 8, 9, 2, 1, 0, 0])]]]), og = { home: 'OKC', away: 'SAS' };
      const bp = A.w.NBA_LP.boxPlayer, idOf = r => r && r.a ? r.a.id : null;
      check(idOf(bp(twin, { name: 'Jalen Wilmerding', pid: '9002', team: 'OKC' }, og)) === null && idOf(bp(twin, { name: 'Jaxlin Wilmerding', pid: '9001', team: 'OKC' }, og)) === '9001'
        && idOf(bp(twin, { name: 'Jaxlin Wilmerding', team: 'OKC' }, og)) === '9001' && idOf(bp(twin, { name: 'J. Wilmerding', team: 'OKC' }, og)) === '9001',
        'a player missing from the box is not graded on a teammate who shares his last name and initial; a leg with no id is found by name');
      const L = require('./lib');
      check(Object.entries({ GS: 'GSW', NO: 'NOP', NY: 'NYK', SA: 'SAS', UTAH: 'UTA', WSH: 'WAS', BOS: 'BOS' }).every(([e, o]) => L.fromEspn(e) === o), 'ESPN\'s team codes are the job\'s (tools/lib.js)');
    }

    /* ---- the part's own code: the only storage it touches is its key, it sends nothing, and names the NFL hub's key only
       to say it never uses it ---- */
    {
      const part = fs.readFileSync(path.join(ROOT, 'app', 'parts', 'xparlays.html'), 'utf8'), js = (part.match(/<script>([\s\S]*?)<\/script>/) || [])[1] || '';
      const code = js.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
      const uses = [...code.matchAll(/localStorage\.(\w+)\(([^)]*)\)/g)].map(m => m[1] + '(' + m[2].split(',')[0] + ')');
      check(uses.length > 0 && uses.every(u => /^(getItem|setItem|removeItem)\(HERE_KEY\)$/.test(u)) && /const HERE_KEY = 'nba_lp_cleared_v1';/.test(code),
        'the section\'s only storage is getItem, setItem and removeItem on its own key, nba_lp_cleared_v1: ' + uses.join(' '));
      check(!/lp_cleared_here_v1/.test(code) && !/sessionStorage|indexedDB|sendBeacon|XMLHttpRequest|keepalive|method\s*:|\bM\.(build|slip|bank)\b|saveMine/.test(code), 'the section never names the NFL hub\'s key in code, writes no other store, sends nothing, and never touches the Bet Build or your parlay');
      const page = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
      check(page.includes('<section id="tab-xparlays" hidden>') && !page.includes('<!--part:xparlays-->'), 'the built page carries the section, set in at its marker');
    }

    /* ---- O. the X on every card: Clear this parlay?, cleared on this device alone, under the NBA's own key ---- */
    {
      const at = '2026-10-12T20:00:00.000Z';
      const key = r => r.w.localStorage.getItem(HK);
      const ids = r => { try { return (JSON.parse(key(r)) || []).map(x => x.id).join(); } catch (e) { return 'junk'; } };
      const xOf = (r, id) => [...r.d.querySelectorAll('#lpCard [data-lp-clear]')].find(b => b.getAttribute('data-lp-clear') === id);
      const dlg = r => r.d.getElementById('lpAsk');
      const key0 = (r, k, el) => (el || r.d.activeElement || r.d.body).dispatchEvent(new r.w.KeyboardEvent('keydown', Object.assign({ bubbles: true, cancelable: true }, k)));
      const NFL_VAL = JSON.stringify([{ id: 'early', at }, { id: 'night', at }]);
      const nflSeed = w => w.localStorage.setItem(NFL_HK, NFL_VAL);
      const seedHere = list => w => { nflSeed(w); w.localStorage.setItem(HK, JSON.stringify(list)); };
      const nflKept = r => r.w.localStorage.getItem(NFL_HK) === NFL_VAL;
      for (const st of ['in', 'post']) {
        const r = await run({ dd: days(st), ss: sums(st), seed: nflSeed });
        const cs = cards(r);
        check(cs.length === 2 && cs.every(c => { const b = c.firstElementChild;
          return c.querySelectorAll('.lp-x').length === 1 && b && b.matches('button.lp-x[type="button"][data-lp-clear]') && b.getAttribute('aria-label') === 'Clear this parlay'
            && b.getAttribute('data-lp-clear') === c.getAttribute('data-lp-id') && !!b.querySelector('svg[aria-hidden="true"]') && !txt(b); }),
          `every ${st === 'post' ? 'settled' : 'live'} card has its X first, a button named "Clear this parlay", an icon and no text, though the NFL hub's list on this origin names both`);
        check(dlg(r).hidden && key(r) === null && nflKept(r), 'the window is shut on load, the page wrote no key of its own, and the NFL hub\'s key is as it was');
      }
      { const rule = sel => { const m = html.match(new RegExp(sel.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\{([^}]*)\\}')); return m ? m[1] : ''; };
        const px = (s, p) => +((s.match(new RegExp('(?:^|;)' + p + ':(-?[\\d.]+)px')) || [])[1]);
        const x = rule('#lpCard .lp-x'), hd = rule('#lpCard .lp-head'), card = rule('#lpCard .lp-p'), padR = +((card.match(/padding:[\d.]+px ([\d.]+)px/) || [])[1]);
        check(/position:absolute/.test(x) && px(x, 'width') >= 44 && px(x, 'height') >= 44 && /position:relative/.test(card) && padR + px(hd, 'padding-right') >= px(x, 'right') + px(x, 'width') && /var\(--muted\)/.test(x)
          && /#lpCard \.lp-x:focus-visible\{[^}]*outline:2px solid var\(--hot\)/.test(html), 'the X is a 44px target at the card\'s top right, clear of the header, with a focus ring: ' + x + ' / ' + hd + ' / ' + card);
        check(/#lpCard \.lp-dlg\{[^}]*position:fixed[^}]*align-items:flex-start[^}]*overflow-y:auto/.test(html) && /#lpCard \.lp-dlg-panel\{[^}]*background:var\(--panel\);color:var\(--ink\)[^}]*margin:auto/.test(html)
          && /#lpCard \.lp-dlg-btns \.btn\{min-height:44px/.test(html) && /#lpCard \.lp-here \.btn\{min-height:44px/.test(html) && /#lpCard \.btn\{min-height:44px/.test(html),
          'the window is over the page and scrolls, its panel on the hub\'s tokens, centred by auto margins; Refresh now, Cancel, Clear and Show them again are 44px'); }
      const R = await run({ seed: nflSeed });
      const { w, d } = R, n0 = R.requests.length;
      check(shownIds(R) === 'early,night', 'the cards are the file\'s: ' + shownIds(R));
      for (const how of ['Cancel', 'Escape', 'a click outside']) {
        const x = xOf(R, 'early'); x.focus(); x.click();
        const D = dlg(R), panel = D.querySelector('[role="alertdialog"]');
        check(!D.hidden && panel.getAttribute('aria-modal') === 'true' && txt(d.getElementById(panel.getAttribute('aria-labelledby'))) === 'Clear this parlay?'
          && txt(d.getElementById('lpAskWhat')) === `4-leg parlay · ${dayShort(T)} · +580 · same game`
          && /on this device only/.test(txt(panel)) && /nothing is sent anywhere/.test(txt(panel)) && /clear themselves for everyone the day after their last game/.test(txt(panel))
          && d.activeElement === d.getElementById('lpAskNo') && txt(d.getElementById('lpAskNo')) === 'Cancel' && txt(d.getElementById('lpAskYes')) === 'Clear' && d.body.classList.contains('pp-lock'),
          `the X opens "Clear this parlay?" naming the parlay (legs, date, price, note), saying it is this device only and that X's parlays clear themselves, the focus on Cancel, the page held still (${how}): ` + txt(panel));
        if (how === 'Cancel') {
          d.getElementById('lpAskYes').focus(); key0(R, { key: 'Tab' }); const fwd = d.activeElement === d.getElementById('lpAskNo');
          key0(R, { key: 'Tab', shiftKey: true });
          check(fwd && d.activeElement === d.getElementById('lpAskYes'), 'Tab and Shift+Tab stay inside the window');
          d.getElementById('lpAskNo').click();
        } else if (how === 'Escape') key0(R, { key: 'Escape' });
        else { d.getElementById('lpAskText').click(); check(!D.hidden, 'a click inside the window does not close it'); D.click(); }
        check(D.hidden && shownIds(R) === 'early,night' && key(R) === null && !d.body.classList.contains('pp-lock') && d.activeElement === xOf(R, 'early'),
          `${how} clears nothing, writes no key, lets the page scroll again and gives the focus back to the X`);
      }
      const before = Date.now();
      xOf(R, 'early').click(); d.getElementById('lpAskYes').click();
      let st = null; try { st = JSON.parse(key(R)); } catch (e) {}
      check(dlg(R).hidden && shownIds(R) === 'night' && Array.isArray(st) && st.length === 1 && st[0].id === 'early' && Date.parse(st[0].at) >= before - 1000 && Date.parse(st[0].at) <= Date.now() + 1000,
        'Clear takes exactly that parlay off, kept under ' + HK + ' with when: ' + key(R));
      check(d.activeElement === xOf(R, 'night') && R.requests.length === n0 && plain(R) && nflKept(R), 'after a Clear the focus is on the X in its place, nothing was sent, and the NFL hub\'s key is untouched');
      check(/^You cleared 1 parlay on this device ?Show it again$/.test(txt(d.querySelector('#lpApp .lp-here'))), 'one cleared: a quiet line at the foot with Show it again: ' + txt(d.querySelector('#lpApp .lp-here')));
      xOf(R, 'night').click(); d.getElementById('lpAskYes').click();
      check(shownIds(R) === '' && ids(R) === 'early,night' && /^You cleared 2 parlays on this device ?Show them again$/.test(txt(d.getElementById('lpApp'))) && d.activeElement === d.getElementById('lpShowAll') && !d.querySelector('#lpApp .lp-empty'),
        'every parlay cleared here: the card says so with Show them again, the focus on it, never "Nothing to watch yet"');
      const n1 = R.requests.length;
      d.getElementById('lpShowAll').click();
      check(dlg(R).hidden && shownIds(R) === 'early,night' && key(R) === null && d.activeElement === xOf(R, 'early') && nflKept(R), 'Show them again brings every parlay back at once, the key removed, the focus on the first X');
      await settle(R);
      check(R.requests.slice(n1).some(x => /parlays\.json/.test(x.url)) && R.requests.slice(n1).some(x => /\/summary\?event=5501/.test(x.url)) && plain(R), 'and reads their games again, by GET alone');
      /* Escape closes this window alone */
      { const r = await run(); xOf(r, 'night').click(); let other = 0; r.d.addEventListener('keydown', e => { if (e.key === 'Escape') other++; }); key0(r, { key: 'Escape' });
        check(dlg(r).hidden && other === 0 && r.d.activeElement === xOf(r, 'night'), 'Escape on the window reaches nothing beneath it'); }
      /* a double tap: the second tap, a moment after the window opened, neither clears nor closes */
      { const r = await run(), tap = el => el.dispatchEvent(new r.w.MouseEvent('click', { bubbles: true, cancelable: true, detail: 1 }));
        xOf(r, 'early').click(); tap(r.d.getElementById('lpAskYes'));
        check(!dlg(r).hidden && key(r) === null, 'a second tap on Clear just after the window opened clears nothing');
        tap(dlg(r)); check(!dlg(r).hidden, 'a second tap on the backdrop just after it opened does not close it');
        await sleep(450); tap(r.d.getElementById('lpAskYes'));
        check(dlg(r).hidden && shownIds(r) === 'night' && ids(r) === 'early', 'a tap on Clear once the window has been open a moment clears'); }
      /* leaving the tab closes the window, clearing nothing; nothing hidden takes Tab or Escape; a window left open on a
         tab hidden by other means closes at the next key */
      { const r = await run();
        xOf(r, 'early').click(); await show(r, 'parlay');
        check(dlg(r).hidden && !r.d.body.classList.contains('pp-lock') && key(r) === null, 'moving to another tab closes the window, lets the page scroll and clears nothing');
        const b = r.d.querySelector('#nav button[data-tab=parlay]'); b.focus(); key0(r, { key: 'Tab' });
        check(r.d.activeElement === b, 'Tab on another tab never lands on the hidden window\'s buttons');
        let esc = 0; r.d.addEventListener('keydown', e => { if (e.key === 'Escape') esc++; }); key0(r, { key: 'Escape' }, b);
        check(esc === 1, 'Escape on another tab reaches the page');
        await show(r); xOf(r, 'night').click(); r.d.getElementById('tab-xparlays').hidden = true;
        let esc2 = 0; r.d.addEventListener('keydown', e => { if (e.key === 'Escape') esc2++; }); key0(r, { key: 'Escape' }, r.d.body);
        check(dlg(r).hidden && esc2 === 1 && key(r) === null, 'a window left open on a hidden tab closes at the next key, which goes on to the page'); }
      /* two tabs of the site share the browser's storage (jsdom keeps one a window: B's is set to what A wrote) */
      { const A2 = await run({ seed: nflSeed }), B2 = await run({ seed: nflSeed });
        const share = () => { const v = A2.w.localStorage.getItem(HK); if (v === null) B2.w.localStorage.removeItem(HK); else B2.w.localStorage.setItem(HK, v); };
        xOf(A2, 'early').click(); A2.d.getElementById('lpAskYes').click(); share();
        B2.d.getElementById('lpNow').click(); await settle(B2);
        check(ids(B2) === 'early', 'Refresh now in a second tab keeps the first tab\'s clear: ' + key(B2));
        xOf(B2, 'night').click(); B2.d.getElementById('lpAskYes').click();
        check(ids(B2) === 'early,night', 'a clear in a second tab keeps the first tab\'s: ' + key(B2));
        B2.w.localStorage.setItem(HK, JSON.stringify([{ id: 'early', at }]));
        B2.w.dispatchEvent(new B2.w.StorageEvent('storage', { key: HK }));
        check(shownIds(B2) === 'night', 'a tab follows another tab\'s change to the list: ' + shownIds(B2));
        B2.w.localStorage.setItem(NFL_HK, JSON.stringify([{ id: 'night', at }]));
        B2.w.dispatchEvent(new B2.w.StorageEvent('storage', { key: NFL_HK }));
        check(shownIds(B2) === 'night' && B2.w.localStorage.getItem(NFL_HK) === JSON.stringify([{ id: 'night', at }]), 'a change to the NFL hub\'s list on the same origin moves nothing here, and is left as it is');
        B2.w.localStorage.setItem(HK, JSON.stringify([{ id: 'early', at }, { id: 'night', at }]));
        B2.d.getElementById('lpShowAll').click();
        check(ids(B2) === 'night' && shownIds(B2) === 'early', 'Show them again brings back only what this tab showed as cleared: ' + key(B2));
        await settle(B2); }
      /* said of the parlays drawn */
      { const file = clone(FILE); file.parlays.push({ id: 'dead', stake: 5, price: 150, payout: 12.5, legs: [legF(1, 'Total', 'GSW', 'total', 216.5, 'under', true)] });
        const r = await run({ file, seed: seedHere([{ id: 'early', at }, { id: 'night', at }]) });
        check(shownIds(r) === 'dead' && /None of the parlays shown here is still live/.test(txt(r.d.getElementById('lpApp'))) && !/None of X’s parlays/.test(txt(r.d.getElementById('lpApp'))),
          'with X\'s live parlays cleared here and the one shown lost, the line speaks only for the parlays shown');
        const r2 = await run({ file });
        check(shownIds(r2) === 'early,night,dead' && !/still live/.test(txt(r2.d.getElementById('lpApp'))), 'with two live, no "still live" line');
        const done = await run({ dd: days('post'), ss: sums('post') });
        const app = done.d.getElementById('lpApp'), h = app.querySelector('.lp-done');
        check(!!h && txt(h) === 'Finished2 · each clears itself the day after its last game' && /None of X’s parlays is still live/.test(txt(app)) && [...app.children].indexOf(h) < [...app.children].indexOf(app.querySelector('.lp-p')),
          'finished parlays are shown in full under Finished, with their count and when they clear: ' + txt(app).slice(0, 120)); }
      /* a reload keeps the clear, and does not follow its games; a fresh browser sees everything */
      { const r = await run({ seed: seedHere([{ id: 'early', at }]) });
        check(shownIds(r) === 'night' && ids(r) === 'early' && sumReq(r).length === 0 && !sbReq(r).some(x => x.url.includes(`dates=${ymd(T1)}`)) && nflKept(r), 'after a reload the parlay cleared here stays cleared, and its game\'s box score is not read');
        const f = await run(); check(shownIds(f) === 'early,night' && key(f) === null, 'a fresh browser sees every parlay'); }
      /* the prune: ids the file lacks or has cleared leave the list; a file that does not answer prunes nothing; junk goes */
      { const file = clone(FILE); file.parlays[0].cleared = true;
        const r = await run({ file, seed: seedHere([{ id: 'early', at }, { id: 'long-gone', at }, { id: 'night', at }]) });
        check(ids(r) === 'early' && JSON.parse(key(r))[0].at === at && shownIds(r) === '' && nflKept(r), 'the list is pruned to the ids the file has and has not cleared, each kept with its time; the NFL hub\'s list untouched: ' + key(r));
        const r2 = await run({ file, seed: seedHere([{ id: 'long-gone', at }, { id: 'night', at }]) });
        check(key(r2) === null && shownIds(r2) === 'early' && nflKept(r2), 'a list the file no longer shows anything of is removed');
        const r3 = await run({ data: 404, seed: seedHere([{ id: 'early', at }, { id: 'long-gone', at }]) });
        check(ids(r3) === 'early,long-gone', 'a file that does not answer prunes nothing');
        const r4 = await run({ seed: w => { nflSeed(w); w.localStorage.setItem(HK, '{not json'); } });
        check(shownIds(r4) === 'early,night' && key(r4) === null && nflKept(r4), 'junk under the key: every parlay drawn, and the junk goes'); }
      /* a browser that refuses storage: the list lives in memory for the visit, and the page still draws and clears */
      { const r = await run({ tab: null, seed: w => Object.defineProperty(w, 'localStorage', { configurable: true, get() { throw new w.DOMException('denied', 'SecurityError'); } }) });
        await show(r);
        const ok = cards(r).length === 2; if (ok) { xOf(r, 'early').click(); r.d.getElementById('lpAskYes').click(); }
        check(ok && shownIds(r) === 'night' && r.errors.length === 0, 'with storage refused the tab still draws, and a clear holds for the visit'); }
    }
  } finally { for (const w of open) try { w.close(); } catch (e) {} }
};
