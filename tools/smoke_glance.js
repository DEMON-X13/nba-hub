/* The matchup bubble, a section of the viewer smoke test (README "The matchup bubble"): run by tools/smoke.js, alone with
 *
 *   SMOKE_ONLY=glance node tools/smoke.js
 *
 * The bubble (app/parts/glance.html) is the NFL hub's (its nflbets/build/glance.js, held there by nflbets/build/smoke.js's
 * THE MATCHUP BUBBLE) on this page: every name on a leg the Parlay Builder draws is a button that opens a small window
 * with that leg's matchup. Here the built page boots in jsdom on made-up games tomorrow (so every case holds at any hour,
 * the off-season included), a made-up lines.json, a props block, rated players and a pickem.json of their own (in the
 * shape tools/publish.js writes it: its games to today, tomorrow's calls in its next, the NBA Cup final and the play-in
 * marked off), the Celtics' offence planted at an exact half below zero (rounded as the Teams tab rounds it), and a
 * builder seeded with legs of every kind: a player's points, a steals line (made at the other end, so he faces the
 * other club's offence), a player the ladder does not rank, one the injury report has out, one the props model does
 * not project, a moneyline, a spread and a game total. Every name is held to its leg (its button, kind and id, the leg
 * it keeps, its words, its 44px target); every number a bubble states is worked out here on its own from the same files
 * (the Players tab's rating and the rank at his position, the Teams tab's columns ranked as its table sorts, read off
 * the Teams tab itself too, the props model's projection, the leg's model and fair chance, both records from the Pick'em
 * Record's games, the line the leg stands on, Vegas with the margin out and every model's call, the moneyline-only tick);
 * then the window's keys and focus, where it is placed (below, above, a sheet), the redraws it follows (the builder drawn
 * again, a price moved, the leg taken out, the Top 50 redrawn, a level card), the reader's scroll, a file that has not
 * loaded, a press newer than lines.json, Open game on Tonight, the observer connected only while open, and nothing
 * written or fetched but the Pick'em Record's own file, once.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = async function matchupBubble({ check, pageFile, ROOT }) {
  console.log('The matchup bubble');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => JSON.parse(JSON.stringify(x));
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const PJ = require('./props'), PUB = require('./publish'), SG = require('./sigma');
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const SIGMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'sigma.json'), 'utf8')).sigma;
  const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const ymd = d => d.replace(/-/g, ''), at = ms => new Date(ms).toISOString().slice(0, 19) + 'Z', tipAt = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
  const SEASON = REAL.season;

  /* ---------- this file's own readings ---------- */
  const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100), pc0 = p => (p * 100).toFixed(0) + '%';
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th');
  const amTxt = v => (v > 0 ? '+' : '−') + Math.abs(Math.round(v)), sg0 = v => { const s = Math.abs(v).toFixed(0); return (s === '0' ? '' : v > 0 ? '+' : '−') + s; };   // the Teams tab's rounding (toFixed), a true minus
  const kickOwn = g => { const x = new Date(g.date + 'T12:00:00Z'); return x.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) + ' ' + x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
    + ' · ' + new Date(g.tip).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET'; };
  const TIERS = [['HOF', 1750], ['Elite', 1700], ['Master', 1650], ['Diamond', 1600], ['Platinum', 1550], ['Gold', 1500], ['Silver', 1450], ['Bronze', 1400], ['Iron', 1350]];
  const tierOwn = e => (TIERS.find(([, lo]) => e >= lo) || ['Wood'])[0];
  /* a column of the Teams tab ranked as its table sorts it: high to low, the file's order on a tie */
  const rankOwn = (teams, key, t) => { const rows = Object.entries(teams), s = rows.map((r, i) => [r, i]).sort((a, b) => b[0][1][key] - a[0][1][key] || a[1] - b[1]).map(x => x[0][0]); return { v: teams[t][key], rank: s.indexOf(t) + 1, n: s.length }; };
  const NICK = { BOS: 'Celtics', DET: 'Pistons', LAL: 'Lakers', GSW: 'Warriors' };

  /* ---------- the harness ---------- */
  function load(st, o = {}) {
    const html = fs.readFileSync(pageFile('index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
    const errors = [], requests = [], mo = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
      beforeParse(w) {
        w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
          if (/espn\.com/.test(url)) return { ok: false, status: 404, json: async () => ({}) };
          if (/lines\.json/.test(url)) return o.lines ? { ok: true, status: 200, json: async () => clone(o.lines) } : { ok: false, status: 404, json: async () => ({}) };
          if (/pickem\.json/.test(url)) { if (o.pkWait) await o.pkWait; return o.pickem ? { ok: true, status: 200, json: async () => clone(o.pickem) } : { ok: false, status: 404, json: async () => ({}) }; }
          if (/state\.json/.test(url)) return { ok: true, status: 200, json: async () => clone(st) };
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
        w.scrollTo = () => {}; w.confirm = () => true;
        if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
        if (o.mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(o.mine));
        w.localStorage.setItem('nba_hub_2027:tab', 'parlay');
        /* the observer the bubble follows redraws with, its connections recorded */
        const MO = w.MutationObserver;
        w.MutationObserver = class extends MO { observe(...a) { mo.push('observe'); return super.observe(...a); } disconnect() { mo.push('disconnect'); return super.disconnect(); } };
        w.addEventListener('error', e => errors.push(e.message));
      } });
    const w = dom.window;
    return { w, d: w.document, errors, requests, mo };
  }
  const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
  const stored = w => JSON.stringify([dump(w.localStorage), dump(w.sessionStorage)]);

  /* ---------- the made-up games, players and files ---------- */
  const now = Date.now(), H = 3600e3, MIN = 60e3;
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const D1 = addDay(etDate(now), 1), T1 = Date.parse(D1 + 'T23:00:00Z');
  const gid = (ms, a, h) => `${SEASON}_${ymd(etDate(ms))}_${a}_${h}`;
  const side = (t, out) => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
  const game = (ms, a, h, model, team) => ({ id: gid(ms, a, h), date: etDate(ms), tip: tipAt(ms), type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '5' + String(ms).slice(-6), awayScore: null, homeScore: null,
    line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 225, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5, ...team }, published: null });
  const G1 = game(T1, 'BOS', 'DET', { pHome: 0.62, spread: -3, total: 226, home: side('DET', [{ id: '9100007', name: 'Gus Out', status: 'Out', min: 28, costs: 30 }]) }, { pHome: 0.58 });
  const G2 = game(T1 + 2 * H, 'LAL', 'GSW', { pHome: 0.4, spread: 2, total: 231 }, { pHome: 0.45 });
  check(etDate(T1 + 2 * H) === D1 && D1 > etDate(now), `the made-up games are both tomorrow (${D1})`);
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'], COMBO = { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
  const VAR = { pts: [7.2, 0.73], reb: [1.76, 0.88], ast: [1.3, 0.99], tpm: [1.23, 1.0], stl: [1.1, 0.98], blk: [1.25, 1.12], pra: [9.66, 0.67], pr: [8.17, 0.72], pa: [6.43, 0.78], ar: [2.7, 0.76], sb: [1.2, 0.97] };
  const row = (name, team, pos, min, pts, reb, ast, stl) => [name, team, pos, min, pts, reb, ast, 1.6, stl, 0.6, 0.07, 0.01];
  const props = { onTrial: true, build: 'test', asOf: D1, fitSeasons: '2023-2026', horizonGameDays: 5, minShown: 8, stats: PJ.ALL, combos: COMBO, layout: LAY, dist: { kind: 'negative binomial', var: VAR }, fair: PJ.FAIR,
    ledger: { registered: '2026-10-15T11:35Z', bar: { lines: 30000 }, decision: null, summary: { lines: 4321, gradedGames: 40 } }, research: null,
    games: { [G1.id]: { tip: G1.tip, away: 'BOS', home: 'DET', players: { '9100001': row('Ace Guard', 'BOS', 'G', 34, 26.2, 4.1, 5.2, 1.1), '9100002': row('Bo Wing', 'DET', 'F', 31, 13.8, 7.9, 2.2, 1.6), '9100005': row('Eli Rookie', 'DET', 'G', 22, 9.1, 3.2, 2.4, 0.7) } },
      [G2.id]: { tip: G2.tip, away: 'LAL', home: 'GSW', players: { '9100003': row('Cy Center', 'GSW', 'C', 30, 15.1, 11.2, 2.1, 0.8) } } } };
  const rated = [{ id: '9100001', name: 'Ace Guard', pos: 'G', team: 'BOS', o: 30, d: 5, min: 34, games: 300, prior: 'raptor', rating: 1612, ranked: true, d7: 3 },
    { id: '9100002', name: 'Bo Wing', pos: 'F', team: 'DET', o: 4, d: 12, min: 31, games: 210, prior: 'raptor', rating: 1476, ranked: true, d7: 0 },
    { id: '9100005', name: 'Eli Rookie', pos: 'G', team: 'DET', o: -6, d: -4, min: 22, games: 12, prior: 'rookie', rating: 1440, d7: 0 },
    { id: '9100007', name: 'Gus Out', pos: 'G', team: 'DET', o: 8, d: 2, min: 28, games: 260, prior: 'raptor', rating: 1531, ranked: true, d7: -1 },
    { id: '9100003', name: 'Cy Center', pos: 'C', team: 'GSW', o: 10, d: 25, min: 30, games: 280, prior: 'raptor', rating: 1688, ranked: true, d7: 2 }];
  /* the Celtics' offence planted at an exact half below zero, where Math.round (−45) and the Teams tab's toFixed (−46) part ways */
  const TEAMS_P = { ...clone(REAL.teams), BOS: { ...clone(REAL.teams.BOS), offence: -45.5 } };
  const ST = (o = {}) => ({ ...clone(REAL), today: etDate(now), generated: at(now - 3 * H), injuriesAsOf: etDate(now), slate: [G1, G2].map(clone), props: clone(props), corr: PUB.corrState(), players: [...clone(REAL.players), ...clone(rated)], teams: clone(TEAMS_P), ...o });
  const RD = at(now - 90 * MIN);
  const LINES = { v: 1, at: RD, games: {
    [G1.id]: { at: RD, espn: G1.espn, ml: { home: -130, away: 110 }, spread: { line: -2.5, home: -110, away: -110 }, total: { line: 226.5, over: -110, under: -110 },
      ids: { event: '7001', ml: { home: '0ML7001_1', away: '0ML7001_3' }, spread: { home: '0HC7001N250_1', away: '0HC7001P250_3' }, total: { over: '0OU7001O22650_1', under: '0OU7001U22650_3' } },
      props: { at: RD, mains: [{ player: '9100001', stat: 'pts', line: 24.5, over: -115, under: -105 }, { player: '9100002', stat: 'stl', line: 1.5, over: 130, under: -160 }, { player: '9100005', stat: 'reb', line: 3.5, over: -110, under: -110 }], ladders: [], yes: [] } },
    [G2.id]: { at: RD, espn: G2.espn, ml: { home: 120, away: -140 }, spread: { line: 2.5, home: -110, away: -110 }, total: { line: 230.5, over: -110, under: -110 },
      ids: { event: '7002', ml: { home: '0ML7002_1', away: '0ML7002_3' }, spread: { home: '0HC7002P250_1', away: '0HC7002N250_3' }, total: { over: '0OU7002O23050_1', under: '0OU7002U23050_3' } },
      props: { at: RD, mains: [{ player: '9100003', stat: 'reb', line: 10.5, over: -120, under: 100 }], ladders: [], yes: [] } } } };
  /* the Pick'em Record's file, in the shape tools/publish.js writes it: its games run to today, so tomorrow's two are
     not among them and their calls are in next. Three finals of each club that count (two regular-season wins for
     BOS, one loss; DET one win, two losses), a preseason final, a BOS NBA Cup final win and a DET play-in loss (off:
     the standings leave both out) that count for nobody */
  const fin = (d, a, h, as, hs, type = 'REG') => ({ id: `${SEASON}_${ymd(d)}_${a}_${h}`, date: d, tip: d + 'T23:00Z', type, w: 0, away: a, home: h, score: [as, hs], ml: [-110, -110], line: -1.5, c: { player: 0.5, team: 0.5 } });
  const NEXT = { [G1.id]: { alpha: 0.44, joker: 0.53, elo: 0.66 }, [G2.id]: { alpha: 0.71 } };
  const PICKEM = { v: 1, season: SEASON, today: etDate(now), models: PUB.PK_MODELS.map(([id, name, color]) => ({ id, name, color })), status: {}, weeks: [{ key: '1', label: 'Week 1', short: 'Wk 1', from: addDay(D1, -7), to: D1 }],
    games: [fin(addDay(D1, -6), 'BOS', 'MIA', 110, 101), fin(addDay(D1, -5), 'NYK', 'BOS', 99, 104), fin(addDay(D1, -4), 'BOS', 'DET', 98, 112), fin(addDay(D1, -3), 'DET', 'CHI', 95, 120), fin(addDay(D1, -2), 'ATL', 'DET', 101, 100),
      fin(addDay(D1, -9), 'BOS', 'DET', 80, 120, 'PRE'), { ...fin(addDay(D1, -8), 'BOS', 'SAS', 120, 100), off: 'cup' }, { ...fin(addDay(D1, -7), 'DET', 'ORL', 90, 99), off: 'playin' }],
    next: clone(NEXT) };
  /* the same file on game day (its today tomorrow's date): the two games among its games, their calls on them */
  const PICKEM_DAY = { ...clone(PICKEM), today: D1, next: {}, games: [...clone(PICKEM.games),
    { id: G1.id, date: G1.date, tip: G1.tip, type: 'REG', w: 0, away: 'BOS', home: 'DET', score: null, ml: null, line: null, c: { player: 0.61, team: 0.57, ...NEXT[G1.id] } },
    { id: G2.id, date: G2.date, tip: G2.tip, type: 'REG', w: 0, away: 'LAL', home: 'GSW', score: null, ml: null, line: null, c: { player: 0.4, ...NEXT[G2.id] } }] };
  const base = g => ({ id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip });
  const pl = (pid, name, team, stat, line, odds, other) => ({ ...base(G1), kind: 'prop', pid, name, team, at: RD, stat, mk: 'main', line, side: 'over', odds, other });
  const L_ACE = pl('9100001', 'Ace Guard', 'BOS', 'pts', 24.5, -115, -105), L_STL = pl('9100002', 'Bo Wing', 'DET', 'stl', 1.5, 130, -160), L_ELI = pl('9100005', 'Eli Rookie', 'DET', 'reb', 3.5, -110, -110);
  const L_OUT = pl('9100007', 'Gus Out', 'DET', 'pts', 12.5, -110, -110), L_NP = pl('9100008', 'Hal Bench', 'DET', 'pts', 6.5, -110, -110);
  const L_ML = { ...base(G1), at: RD, kind: 'ml', side: 'DET', line: null, odds: -130, other: 110, dk: '0ML7001_1' };
  const L_SP = { ...base(G2), at: RD, kind: 'spread', side: 'GSW', line: 2.5, odds: -110, other: -110, dk: '0HC7002P250_1' };
  const L_TO = { ...base(G1), at: RD, kind: 'total', side: 'over', line: 226.5, odds: -110, other: -110, dk: '0OU7001O22650_1' };
  const ALL = [L_ACE, L_STL, L_ELI, L_OUT, L_NP, L_ML, L_SP, L_TO];
  const MINE = legs => ({ picks: {}, build: [], slip: { legs: clone(legs), stake: 20 }, stake: 20 });
  const keyOwn = l => l.kind === 'prop' ? [l.id, 'prop', l.pid, l.stat, l.mk, l.line, l.side].join('|') : [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
  const nameOwn = l => l.kind === 'prop' ? l.name : l.kind === 'total' ? `${NICK[l.away]} at ${NICK[l.home]}` : NICK[l.side];
  const kindOwn = l => l.kind === 'prop' ? ['p', l.pid] : l.kind === 'total' ? ['g', l.id] : ['t', l.side];
  const WHAT = { p: 'his matchup', t: 'the team’s matchup', g: 'the game’s matchup' };
  const modelOwn = l => { const g = [G1, G2].find(x => x.id === l.id);
    if (l.kind === 'ml') return l.side === g.home ? g.model.pHome : 1 - g.model.pHome;
    if (l.kind === 'spread') return SG.Phi(((l.side === g.home ? -g.model.spread : g.model.spread) + l.line) / SIGMA);
    if (l.kind === 'total') return imp(l.odds) / (imp(l.odds) + imp(l.other));
    const r = props.games[l.id].players[l.pid]; if (!r) return null; const mu = r[LAY.indexOf(l.stat)], o = PJ.pOver(l.line, mu, PJ.nbVar(mu, VAR[l.stat])); return l.side === 'under' ? 1 - o : o; };
  const fairOwn = l => l.kind === 'prop' ? 1 - imp(l.other) : imp(l.odds) / (imp(l.odds) + imp(l.other));

  /* ---------- 1. every name is its leg's button ---------- */
  let p = load(ST(), { lines: LINES, mine: MINE(ALL), pickem: PICKEM });
  await sleep(450);
  let { w, d } = p;
  const box = () => d.getElementById('glanceBox'), open = () => !!box() && !box().hidden, nOf = k => { const e = box() && box().querySelector(`[data-glance-n="${k}"]`); return e ? txt(e) : null; };
  const before = stored(w), reqs0 = p.requests.length;
  check(p.mo.length === 0, 'nothing is observed before a bubble opens');
  const tapOk = b => { const cs = w.getComputedStyle(b); return cs.minHeight === '44px' && cs.boxSizing === 'border-box' && cs.paddingTop === '14px' && cs.paddingBottom === '14px' && cs.marginTop === '-14px' && cs.marginBottom === '-14px' && cs.display === 'inline-block' && cs.position === 'relative'; };
  /* a name, held to its row's leg: one button, its kind and id, its game, the leg it keeps, its words, its target */
  const nameBad = (row, leg, wantPrice) => {
    const bs = [...row.querySelectorAll('[data-glance]')], b = bs[0], [kind, id] = kindOwn(leg), nm = nameOwn(leg);
    if (bs.length !== 1 || b.tagName !== 'BUTTON' || b.getAttribute('type') !== 'button' || !b.classList.contains('glance-name')) return `${keyOwn(leg)}: ${bs.length} name buttons`;
    if (b.dataset.glance !== `${kind}:${id}` || b.dataset.glanceGame !== leg.id) return `${keyOwn(leg)}: data-glance ${b.dataset.glance} in ${b.dataset.glanceGame}`;
    const K = w.glanceLeg(b.dataset.glanceLeg); if (!K || K.leg.sk !== keyOwn(leg) || K.price !== wantPrice || K.src !== 'real') return `${keyOwn(leg)}: keeps ${K ? K.leg.sk + ' at ' + K.price : 'nothing'}`;
    if (b.getAttribute('aria-haspopup') !== 'dialog' || b.getAttribute('aria-label') !== `${nm}: ${WHAT[kind]}` || txt(b) !== nm) return `${keyOwn(leg)}: named "${b.getAttribute('aria-label')}", reads "${txt(b)}"`;
    if (!tapOk(b)) return `${keyOwn(leg)}: its tap target is not 44px taken back out of the line`;
    return ''; };
  const bRows = [...d.querySelectorAll('#parlayBody tr.legrow')];
  const bBad = bRows.map(tr => { const l = ALL.find(x => keyOwn(x) === tr.dataset.pbRow); return l ? nameBad(tr, l, l.odds) : 'a row of no leg'; }).filter(Boolean);
  check(bRows.length === ALL.length && !bBad.length, `every builder row's name is the bubble's button for its leg: p:<ESPN id>, t:<club>, g:<game>, the leg kept at the price the row shows, named "Ace Guard: his matchup", 44px (${bRows.length} rows)${bBad.length ? ': ' + bBad.join(' | ') : ''}`);
  const tRows = [...d.querySelectorAll('#pbPanel li.pb-trow')];
  const tBad = tRows.map(li => { const k = li.querySelector('[data-pb-leg]').dataset.pbLeg, bs = li.querySelectorAll('[data-glance]'), K = bs.length === 1 && w.glanceLeg(bs[0].dataset.glanceLeg);
    return bs.length === 1 && K && K.leg.sk === k && tapOk(bs[0]) && bs[0].getAttribute('aria-haspopup') === 'dialog' && /: (his|the team’s|the game’s) matchup$/.test(bs[0].getAttribute('aria-label')) ? '' : k; }).filter(Boolean);
  check(tRows.length > 4 && !tBad.length, `every Top 50 row's name is its leg's button too (${tRows.length} rows)${tBad.length ? ': ' + tBad.join(' | ') : ''}`);
  const once = sel => { const ids = [...d.querySelectorAll(sel + ' [data-glance]')].map(b => b.dataset.glance + '|' + b.dataset.glanceLeg.split('|').slice(0, -3).join('|')); return ids.length === new Set(ids).size; };
  check(once('#parlayBody') && once('#pbPanel'), 'within the builder and within the Top 50 each leg is drawn once, so a bubble knows its copy');
  const nameFor = (sel, leg) => [...d.querySelectorAll(sel + ' [data-glance]')].find(b => w.glanceLeg(b.dataset.glanceLeg).leg.sk === keyOwn(leg));

  /* ---------- 2. a player's bubble ---------- */
  let TAB_BOS_OFF = null;
  const S0 = ST(), teams = S0.teams;
  const aceB = nameFor('#parlayBody', L_ACE); aceB.click(); await sleep(30);
  const B = box();
  check(open() && B.getAttribute('role') === 'dialog' && B.getAttribute('aria-modal') === 'false' && B.getAttribute('aria-labelledby') === 'glanceTitle' && txt(d.getElementById('glanceTitle')) === 'Ace Guard' && d.activeElement === B && aceB.getAttribute('aria-expanded') === 'true',
    'a name opens its bubble: a dialog, not modal, labelled by its heading (his name), the focus in it, the name marked expanded');
  check(p.mo[p.mo.length - 1] === 'observe', 'the bubble watches the page for redraws while it is open');
  check(+w.getComputedStyle(B).zIndex < 20 && +w.getComputedStyle(B).zIndex > 1, "it sits under the page's windows (z-index under the sheets' 20)");
  const aceR = rated[0], gPool = [...S0.players.filter(x => x.ranked && x.pos === 'G')].map((x, i) => [x, i]).sort((a, b) => b[0].rating - a[0].rating || a[1] - b[1]).map(x => x[0]);
  const rankA = gPool.findIndex(x => x.id === '9100001') + 1, dDef = rankOwn(teams, 'defence', 'DET');
  const want = { pos: 'G', team: 'BOS', elo: String(aceR.rating), tier: tierOwn(aceR.rating), rank: '#' + rankA, of: String(gPool.length), posof: 'guards', ha: 'at', opp: 'DET', kick: kickOwn(G1),
    uclub: 'DET', unit: 'Defence', uval: sg0(dDef.v), urank: ord(dDef.rank), uof: String(dDef.n), 'proj:min': '34', 'proj:pts': '26.2', 'proj:reb': '4.1', 'proj:ast': '5.2', 'proj:tpm': '1.6',
    label: 'Over 24.5 points', price: '−115', model: pc0(modelOwn(L_ACE)), fair: pc0(fairOwn(L_ACE)) };
  const gotA = Object.fromEntries(Object.keys(want).map(k => [k, nOf(k)])), badA = Object.keys(want).filter(k => gotA[k] !== want[k]);
  check(!badA.length, `his bubble, every number this file's own: ${Object.entries(want).map(([k, v]) => `${k} ${v}`).join(', ')}${badA.length ? ' -- got ' + badA.map(k => `${k} ${gotA[k]}`).join(', ') : ''}`);
  check(B.querySelector(`svg.tierbadge.tier-${tierOwn(aceR.rating).toLowerCase()}`) && B.querySelector('tr[data-glance-stat="pts"]').classList.contains('glance-on') && B.querySelectorAll('tr.glance-on').length === 1 && B.querySelectorAll('.glance-trial').length === 2 && !B.querySelector('[data-glance-n="inj"]'),
    "his tier's shield, the leg's own stat lit in his projection, the props model marked on trial (on the projection and the model's chance), no status chip for a player on no report");
  check(B.querySelector('[data-glance-faces="defence"]') && /The Teams tab's Defence column/.test(B.querySelector('[data-glance-faces] dd').title) && B.querySelector('[data-glance-tonight]') && w.getComputedStyle(B.querySelector('[data-glance-tonight]')).minHeight === '44px' && w.getComputedStyle(B.querySelector('[data-glance-close]')).minHeight === '44px',
    'what he faces is titled with the Teams tab column it is; Close and Open game on Tonight are 44px');
  /* the Teams tab's own table, sorted on its Defence column, ranks the Pistons where the bubble says */
  { const p2 = load(ST(), { lines: LINES, mine: MINE([]), pickem: PICKEM }); await sleep(400);
    p2.d.querySelector('#nav button[data-tab=teams]').click(); await sleep(30);
    p2.d.querySelector('#teamsT th[data-k="defence"]').click(); await sleep(10);
    const order = [...p2.d.querySelectorAll('#teamsT tbody tr')].map(tr => tr.querySelector('[data-hx]').dataset.hx.slice(2));
    check(order.indexOf('DET') + 1 === dDef.rank && order.length === dDef.n, `the Teams tab's table, sorted on Defence, puts the Pistons ${ord(order.indexOf('DET') + 1)} of ${order.length}, as the bubble does`);
    const oCol = [...p2.d.querySelectorAll('#teamsT thead th')].findIndex(th => th.dataset.k === 'offence'), bosTr = [...p2.d.querySelectorAll('#teamsT tbody tr')].find(tr => tr.querySelector('[data-hx="t:BOS"]'));
    TAB_BOS_OFF = bosTr && oCol >= 0 ? txt(bosTr.children[oCol]).replace(/^-/, '−') : null;
    check(TAB_BOS_OFF === sg0(-45.5) && sg0(-45.5) === '−46', `the Teams tab draws the Celtics' planted offence of −45.5 as ${TAB_BOS_OFF}, this file's own rounding`); }
  /* a steals line is made at the other end: Bo Wing faces the Celtics' offence */
  nameFor('#parlayBody', L_STL).click(); await sleep(30);
  const bOff = rankOwn(teams, 'offence', 'BOS');
  check(open() && txt(d.getElementById('glanceTitle')) === 'Bo Wing' && nOf('unit') === 'Offence' && nOf('uclub') === 'BOS' && nOf('urank') === ord(bOff.rank) && nOf('uval') === sg0(bOff.v) && nOf('ha') === 'vs' && box().querySelector('tr[data-glance-stat="stl"].glance-on') && nOf('proj:stl') === '1.6' && !aceB.hasAttribute('aria-expanded'),
    `another name closes the first bubble and opens its own; a steals line faces the other club's offence (${nOf('uclub')} ${nOf('unit')} ${nOf('uval')} ${nOf('urank')}), his projection showing the steals he is down for`);
  check(nOf('uval') === TAB_BOS_OFF, `the figure he faces is the Teams tab's own cell for it, rounded as the tab rounds it (${nOf('uval')} against the tab's ${TAB_BOS_OFF})`);
  /* a player the ladder does not rank, one the report has out, one the props model does not project */
  nameFor('#parlayBody', L_ELI).click(); await sleep(30);
  check(nOf('norank') === "not ranked: 12 games, under the ladder's twenty" && nOf('elo') === '1440' && nOf('tier') === tierOwn(1440), `a player the ladder does not rank says why (${nOf('norank')})`);
  nameFor('#parlayBody', L_OUT).click(); await sleep(30);
  check(nOf('inj') === 'OUT' && /On the injury report: Out/.test(box().querySelector('[data-glance-n="inj"]').title) && /^No projection: he is on the injury report\.$/.test(nOf('noproj')), 'a player the injury report has out wears OUT, and has no projection, said why');
  nameFor('#parlayBody', L_NP).click(); await sleep(30);
  check(nOf('inj') === 'NOT PROJECTED' && nOf('noelo') === 'no rating: he is not among the players the model rates' && nOf('noproj') === 'No projection: the props model does not project him for this game.' && nOf('model') === 'none',
    'a player the props model does not project and the ratings do not know: NOT PROJECTED, no rating, no projection, no model chance');

  /* a player today's report lists Day-To-Day: the Top 50 and every suggestion hold him out (pbHeldWhy), so a leg on him
     added by hand opens a bubble that says so, as his builder row does */
  { const p3 = load(ST({ report: { date: etDate(now), players: { '9100005': ['DET', 'Day-To-Day', 'Ankle Sprain', ''] } } }), { lines: LINES, mine: MINE([L_ELI]), pickem: PICKEM }); await sleep(400);
    const nb = p3.d.querySelector('#parlayBody [data-glance]'); if (nb) { nb.click(); await sleep(30); }
    const bx = p3.d.getElementById('glanceBox'), c = bx && !bx.hidden ? bx.querySelector('[data-glance-n="inj"]') : null;
    check(c && txt(c) === 'DAY-TO-DAY' && c.title === "On today's injury report: listed day-to-day (ankle sprain), so held out of the Top 50 lines and every suggested parlay" && p3.errors.length === 0,
      `a Day-To-Day player's bubble wears DAY-TO-DAY, titled with why the list and the sets hold him out (${c ? txt(c) + ': ' + c.title : 'no chip'})`); }

  /* ---------- 3. a team's bubble and a game's ---------- */
  const recOwn = t => { let wn = 0, ls = 0; for (const x of PICKEM.games) { if (!x.score || x.type !== 'REG' || x.off || (x.away !== t && x.home !== t)) continue; const m = x.home === t ? x.score[1] - x.score[0] : x.score[0] - x.score[1]; if (m > 0) wn++; else if (m < 0) ls++; } return wn + '-' + ls; };
  const vh = imp(-130) / (imp(-130) + imp(110)), clock = w.eval(`oddsClock(${JSON.stringify(RD)})`);
  const pickOf = (g, ph) => ph >= 0.5 ? g.home : g.away, chOf = ph => pc0(Math.max(ph, 1 - ph));
  const pkG1 = PICKEM.next[G1.id];
  const picksWant = g => [['vegas', 'DET', pc0(vh)], ['player', pickOf(g, g.model.pHome), chOf(g.model.pHome)], ['team', pickOf(g, g.team.pHome), chOf(g.team.pHome)], ['alpha', pickOf(g, pkG1.alpha), chOf(pkG1.alpha)], ['joker', pickOf(g, pkG1.joker), chOf(pkG1.joker)], ['elo', pickOf(g, pkG1.elo), chOf(pkG1.elo)]];
  const picksGot = () => [...box().querySelectorAll('[data-glance-model]')].map(li => [li.dataset.glanceModel, li.dataset.pick || null, nOf('p:' + li.dataset.glanceModel), !!li.querySelector('.glance-chk')]);
  const mlB = nameFor('#parlayBody', L_ML); mlB.click(); await sleep(30);
  for (let i = 0; i < 40 && nOf('pkwait'); i++) await sleep(20);
  const sA = rankOwn(teams, 'strength', 'BOS'), sD = rankOwn(teams, 'strength', 'DET');
  const tw = { kick: kickOwn(G1), 'rec:BOS': recOwn('BOS'), 'rec:DET': recOwn('DET'), 'str:BOS': String(Math.round(sA.v)), 'srk:BOS': '#' + sA.rank, 'str:DET': String(Math.round(sD.v)), 'srk:DET': '#' + sD.rank,
    spread: 'DET −2.5', total: '226.5', ml: 'BOS +110 / DET −130', lsrc: 'DraftKings, read ' + clock, label: 'To win', price: '−130', model: pc0(modelOwn(L_ML)), fair: pc0(fairOwn(L_ML)) };
  const gotT = Object.fromEntries(Object.keys(tw).map(k => [k, nOf(k)])), badT = Object.keys(tw).filter(k => gotT[k] !== tw[k]);
  check(txt(d.getElementById('glanceTitle')) === 'Celtics at Pistons' && /^Regular season · /.test(txt(box().querySelector('.glance-sub'))) && !badT.length && !box().querySelector('.glance-trial'),
    `a team's bubble: the game, both records as the standings count them (the Pick'em Record's regular-season finals, its preseason game, NBA Cup final and play-in left out), each club's strength and rank on the Teams tab, the line the leg stands on, DraftKings' and dated, and the leg, nothing marked on trial (${Object.entries(tw).map(([k, v]) => `${k} ${v}`).join(', ')})${badT.length ? ' -- got ' + badT.map(k => `${k} ${gotT[k]}`).join(', ') : ''}`);
  check(nOf('rec:BOS') === '2-1' && nOf('rec:DET') === '1-2', `the NBA Cup final and the play-in (pickem.json's off) count in no club's record, as the standings leave them out (BOS ${nOf('rec:BOS')}, DET ${nOf('rec:DET')})`);
  const me = box().querySelector('th.glance-me');
  check(me && me.dataset.glanceTeam === 'DET' && /this leg/.test(txt(me)) && box().querySelectorAll('th.glance-me').length === 1, "the leg's club is marked \"this leg\"");
  const oBD = [rankOwn(teams, 'offence', 'BOS'), rankOwn(teams, 'defence', 'DET'), rankOwn(teams, 'offence', 'DET'), rankOwn(teams, 'defence', 'BOS')], poss = [...box().querySelectorAll('[data-glance-poss]')].map(txt);
  check(JSON.stringify(poss) === JSON.stringify([`BOS offence ${sg0(oBD[0].v)} ${ord(oBD[0].rank)} vs DET defence ${sg0(oBD[1].v)} ${ord(oBD[1].rank)}`, `DET offence ${sg0(oBD[2].v)} ${ord(oBD[2].rank)} vs BOS defence ${sg0(oBD[3].v)} ${ord(oBD[3].rank)}`]),
    `offence against defence each way, as the Teams tab's columns rate and rank them (${poss.join(' / ')})`);
  const pw = picksWant(G1).map(([id, pick, ch]) => [id, pick, ch, pick === 'DET']), pg = picksGot();
  check(JSON.stringify(pg) === JSON.stringify(pw), `every model's pick and chance: Vegas on the line shown with the margin out, the Player Model's and Team Elo's numbers, the Alpha Model's, the Joker's and the ELO Model's calls (on a game after the file's today, from its next); on a moneyline each picking the Pistons ticked (${JSON.stringify(pg)})`);
  check([...box().querySelectorAll('.glance-chk')].every(x => x.getAttribute('role') === 'img' && x.getAttribute('aria-label') === 'picks this leg to win'), 'each tick is named for what it says');
  /* Vegas in the bubble is the Pick'em Record's Vegas: a moneyline favourite; level prices or none, the spread's favourite;
     neither, none (the record's own rule, NBA_PICKEM.vegas, on the same numbers) */
  { const VB = p.w.hubGlance.vegasOf, VR = p.w.NBA_PICKEM && p.w.NBA_PICKEM.vegas, gg = { away: 'BOS', home: 'NYK' };
    const cases = [[-110, -110, 1.5], [-110, -110, 0], [-110, -110, -2], [120, -140, 3], [-100, 100, 0], [null, null, -4.5], [-150, 130, null]];
    const same = cases.every(([mla, mlh, hl]) => { const b = VB(gg, { mla, mlh, hl }), r = VR({ ...gg, ml: mla != null ? [mla, mlh] : null, line: hl });
      return (b ? b.pick : null) === (r ? r.pick : null); });
    check(!!VB && !!VR && same && VB(gg, { mla: -110, mlh: -110, hl: 1.5 }).pick === 'BOS' && VB(gg, { mla: -110, mlh: -110, hl: 0 }) === null,
      "the bubble's Vegas is the Pick'em Record's: level moneylines fall to the spread's favourite, none with no spread"); }
  const pkReads = p.requests.filter(x => /pickem\.json/.test(x.url));
  check(pkReads.length === 1 && pkReads[0].opt && pkReads[0].opt.cache === 'no-store', `the Pick'em Record's file is read once, no-store, by the first team's bubble (${pkReads.length})`);
  /* a spread: the same game's numbers, no tick (a pick to win says nothing of a cover); a game total: no club marked */
  nameFor('#parlayBody', L_SP).click(); await sleep(30);
  const pg2 = picksGot();
  check(txt(d.getElementById('glanceTitle')) === 'Lakers at Warriors' && box().querySelector('th.glance-me').dataset.glanceTeam === 'GSW' && !box().querySelector('.glance-chk') && nOf('spread') === 'LAL −2.5'
    && JSON.stringify(pg2.filter(x => ['joker', 'elo'].includes(x[0]))) === JSON.stringify([['joker', null, null, false], ['elo', null, null, false]]) && nOf('p:alpha') === pc0(0.71) && !box().querySelector('.glance-trial'),
    "a spread: its club marked, no model ticked, a model with no call on the game says so, nothing marked on trial");
  nameFor('#parlayBody', L_TO).click(); await sleep(30);
  check(txt(d.getElementById('glanceTitle')) === 'Celtics at Pistons' && !box().querySelector('th.glance-me') && !box().querySelector('.glance-chk') && nOf('label') === 'Over 226.5 points' && nOf('model') === '50%' && !box().querySelector('.glance-trial'),
    "a game total: the game's bubble, no club marked, no tick, the total's chance the market's own, not marked on trial");
  check(p.requests.filter(x => /pickem\.json/.test(x.url)).length === 1 && p.requests.length === reqs0 + 1, 'no other bubble reads anything: the one request is the Pick\'em Record\'s file');
  /* the same calls on game day, when the file's today is the game's and the game is among its games: the same picks */
  { const q = load(ST(), { lines: LINES, mine: MINE([L_ML]), pickem: PICKEM_DAY }); await sleep(450);
    q.d.querySelector('#parlayBody [data-glance]').click(); await sleep(20);
    for (let i = 0; i < 40 && q.d.querySelector('#glanceBox [data-glance-n="pkwait"]'); i++) await sleep(20);
    const qn = k => { const e = q.d.querySelector(`#glanceBox [data-glance-n="${k}"]`); return e ? txt(e) : null; };
    const qg = [...q.d.querySelectorAll('#glanceBox [data-glance-model]')].map(li => [li.dataset.glanceModel, li.dataset.pick || null, qn('p:' + li.dataset.glanceModel), !!li.querySelector('.glance-chk')]);
    check(JSON.stringify(qg) === JSON.stringify(pw) && qn('rec:BOS') === '2-1', `on game day the calls are read from the file's games, the same picks and chances (${JSON.stringify(qg)})`);
    check(q.errors.length === 0, 'no script errors: ' + q.errors.join(' | ')); }

  /* ---------- 4. keys and focus ---------- */
  const key = (k, sh, at) => { const e = new w.KeyboardEvent('keydown', { key: k, shiftKey: !!sh, bubbles: true, cancelable: true }); (at || d.activeElement || d.body).dispatchEvent(e); return e; };
  let nb = nameFor('#parlayBody', L_ACE); nb.click(); await sleep(20);
  let ev = key('Escape');
  check(!open() && ev.defaultPrevented && d.activeElement === nb && !nb.hasAttribute('aria-expanded') && p.mo[p.mo.length - 1] === 'disconnect', 'Escape closes it, the focus back on the name, the name no longer expanded, the observer disconnected');
  nb.click(); await sleep(20);
  box().querySelector('[data-glance-close]').click(); await sleep(10);
  check(!open() && d.activeElement === nb, 'Close closes it, the focus back on the name');
  nb.click(); await sleep(20);
  d.querySelector('#parlayBody .pb-lead').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(10);
  check(!open() && d.activeElement === nb, 'a click outside it closes it, the focus back on the name');
  nb.click(); await sleep(20); nb.click(); await sleep(20);
  check(!open(), 'a click on its own name closes it');
  nb.click(); await sleep(20);
  const fx = [...box().querySelectorAll('button,a[href],input,select,textarea,[tabindex]:not([tabindex="-1"])')];
  fx[fx.length - 1].focus(); ev = key('Tab');
  check(ev.defaultPrevented && d.activeElement === fx[0], 'Tab from its last control goes round to its first');
  ev = key('Tab', true);
  check(ev.defaultPrevented && d.activeElement === fx[fx.length - 1], 'Shift-Tab from its first goes round to its last');
  /* a window over the page takes Escape for itself: the bubble under it stays */
  d.getElementById('hxBack').hidden = false; key('Escape', false, d.body);
  check(open(), "with one of the page's windows open, Escape is that window's, and the bubble stays");
  d.getElementById('hxBack').hidden = true; key('Escape');
  check(!open(), 'and closes it once that window is gone');

  /* ---------- 5. where it is placed: below, above, a sheet; the reader's scroll kept ---------- */
  nb = nameFor('#parlayBody', L_ACE);
  const blk = nb.closest('td.plr'), rect = r => { blk.getBoundingClientRect = () => ({ top: r[0], bottom: r[1], left: 40, right: 240, width: 200, height: r[1] - r[0] }); };
  Object.defineProperty(w, 'innerHeight', { value: 800, configurable: true });
  nb.click(); await sleep(20);
  Object.defineProperty(box(), 'offsetHeight', { get: () => 300, configurable: true }); Object.defineProperty(box(), 'offsetWidth', { get: () => 360, configurable: true });
  rect([100, 140]); w.dispatchEvent(new w.Event('resize'));
  check(box().dataset.glanceAt === 'below' && box().style.top === '146px' && box().style.left === '40px' && !box().classList.contains('glance-sheet'), `with room below the name it sits under it, 6px down (${box().style.top})`);
  rect([600, 640]); w.dispatchEvent(new w.Event('resize'));
  check(box().dataset.glanceAt === 'above' && box().style.top === '294px', `with no room below and more above, it sits over it (${box().style.top})`);
  Object.defineProperty(w, 'innerHeight', { value: 320, configurable: true }); rect([130, 170]); w.dispatchEvent(new w.Event('resize'));
  check(box().dataset.glanceAt === 'sheet' && box().classList.contains('glance-sheet') && !box().style.top, 'where neither side has 160px for it (a landscape phone), it is a sheet across the foot of the screen');
  Object.defineProperty(w, 'innerHeight', { value: 800, configurable: true }); rect([100, 140]);
  const mm = w.matchMedia; w.matchMedia = q => ({ matches: /max-width:\s*640px/.test(q), addListener() {}, removeListener() {} });
  w.dispatchEvent(new w.Event('resize'));
  check(box().classList.contains('glance-sheet') && box().dataset.glanceAt === 'sheet', 'at 640px and under it is always a sheet');
  w.matchMedia = mm; w.dispatchEvent(new w.Event('resize'));
  /* a browser takes a box's scroll back to its top when its height is measured with its max-height cleared: the
     measure here does the same, so only a bubble that puts the reader's scroll back keeps it */
  let sTop = 0; Object.defineProperty(box(), 'scrollTop', { get: () => sTop, set: v => { sTop = v; }, configurable: true });
  Object.defineProperty(box(), 'offsetHeight', { get: () => { sTop = 0; return 300; }, configurable: true });
  sTop = 40; w.renderParlay(); await sleep(30);
  check(open() && sTop === 40, 'placed again after a redraw, it keeps where the reader had scrolled it');
  key('Escape');

  /* ---------- 6. the redraws it follows ---------- */
  nb = nameFor('#parlayBody', L_ACE); nb.click(); await sleep(20);
  w.renderParlay(); await sleep(30);
  const nb2 = nameFor('#parlayBody', L_ACE);
  check(open() && nb2 !== nb && !nb.isConnected && nb2.getAttribute('aria-expanded') === 'true' && w.hubGlanceState().of === 'p:9100001', 'the builder drawn again: the bubble stays, bound to the new copy of its name, marked expanded');
  w.eval(`M.slip.legs.find(l => l.pid === '9100001').odds = -140; renderParlay();`); await sleep(30);
  check(open() && nOf('price') === '−140' && nOf('fair') === pc0(1 - imp(-105)), `a price moved under it: the bubble draws the leg at its new price (${nOf('price')})`);
  w.eval(`M.slip.legs = M.slip.legs.filter(l => l.pid !== '9100001'); renderParlay();`); await sleep(30);
  const names = [...d.querySelectorAll('#parlayBody [data-glance]')];
  check(!open() && d.activeElement === names[0] && p.mo[p.mo.length - 1] === 'disconnect', `the leg taken out of the builder: the bubble closes, the focus on its neighbour there (${txt(d.activeElement)})`);
  /* a Top 50 row's bubble across a redraw of the list */
  const tb = d.querySelector('#pbPanel li.pb-trow [data-glance]'), tsig = tb.dataset.glanceLeg; tb.click(); await sleep(20);
  w.renderPb(); await sleep(30);
  const tb2 = [...d.querySelectorAll('#pbPanel [data-glance]')].find(b => b.dataset.glanceLeg === tsig);
  check(open() && tb2 && tb2 !== tb && tb2.getAttribute('aria-expanded') === 'true' && w.hubGlanceState().place === '[id="pbPanel"]', 'a Top 50 name\'s bubble stays bound to its copy when the list is drawn again');
  key('Escape');
  /* a level card's names, which Suggested Parlays draws with pbTierCard: buttons too, each bubble kept to its card */
  const tier = w.getPbTiers().tiers.find(t => t.legs);
  if (tier) { const host = d.createElement('div'); host.innerHTML = w.pbTierCard(tier); d.getElementById('pbPanel').appendChild(host);
    const cb = host.querySelector('.pb-tier [data-glance]'); cb.click(); await sleep(20);
    check(open() && cb.getAttribute('aria-haspopup') === 'dialog' && w.hubGlanceState().place === `[id="pbPanel"] .pb-tier[data-pb-tier="${tier.id}"]`, `a level card's names are the bubble's buttons, each bubble kept to its card (${w.hubGlanceState().place})`);
    key('Escape'); host.remove(); }
  else check(false, 'the made-up games make a level to draw');

  check(stored(w) === before, 'nothing any of these bubbles did wrote to any store');

  /* ---------- 7. Open game on Tonight ---------- */
  nameFor('#parlayBody', L_ML).click(); await sleep(20);
  box().querySelector('[data-glance-tonight]').click(); await sleep(40);
  const card = d.querySelector(`#slate article[data-id="${G1.id}"]`);
  check(!open() && !d.getElementById('tab-slate').hidden && d.getElementById('tab-parlay').hidden && d.querySelector('#days .day.on').dataset.d === G1.date && card && d.activeElement === card,
    "Open game on Tonight closes the bubble, opens the board on the game's day and gives its card the focus");
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 8. nothing written by any bubble ---------- */
  {
    const q = load(ST(), { lines: LINES, mine: MINE(ALL), pickem: PICKEM }); await sleep(450);
    const s0 = stored(q.w), r0 = q.requests.length;
    for (const sel of ['#parlayBody [data-glance]', '#pbPanel [data-glance]']) for (const b of [...q.d.querySelectorAll(sel)].slice(0, 6)) { b.click(); await sleep(15); }
    for (let i = 0; i < 40 && q.d.querySelector('[data-glance-n="pkwait"]'); i++) await sleep(20);
    q.d.dispatchEvent(new q.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    check(stored(q.w) === s0 && q.requests.slice(r0).every(x => /pickem\.json/.test(x.url)) && q.requests.length - r0 <= 1, 'opening a dozen bubbles writes nothing to any store and reads nothing but the Pick\'em Record\'s file, at most once');
    check(q.errors.length === 0, 'no script errors: ' + q.errors.join(' | '));
  }

  /* ---------- 9. a file that has not loaded, or is still loading; a press newer than lines.json ---------- */
  {
    let release; const wait = new Promise(r => { release = r; });
    const q = load(ST(), { lines: LINES, mine: MINE([L_ML]), pickem: PICKEM, pkWait: wait }); await sleep(450);
    const nB = q.d.querySelector('#parlayBody [data-glance]'); nB.click(); await sleep(20);
    const nq = k => { const e = q.d.querySelector(`#glanceBox [data-glance-n="${k}"]`); return e ? txt(e) : null; };
    check(/^Loading the Pick'em Record's records and calls…$/.test(nq('pkwait')) && !q.d.querySelector('#glanceBox [data-glance-row="rec"]') && !q.d.querySelector('#glanceBox [data-glance-model="alpha"]') && nq('p:player') && nq('spread') === 'DET −2.5',
      "while the Pick'em Record's file is read, the bubble says so in its own line and draws the rest");
    release(); await sleep(60);
    check(!nq('pkwait') && nq('rec:DET') === recOwn('DET') && nq('p:alpha') === pc0(1 - pkG1.alpha), 'and draws the records and the calls once it answers');
    q.w.eval(`SG_LINES[${JSON.stringify(G1.id)}] = { at: ${JSON.stringify(at(now - 5 * MIN))}, event: '7001', ml: { home: { odds: -150, id: '0ML7001_1' }, away: { odds: 125, id: '0ML7001_3' } }, spread: { home: { line: -3.5, odds: -110, id: '0HC7001N350_1' }, away: { line: 3.5, odds: -110, id: '0HC7001P350_3' } } }; renderParlay();`);
    await sleep(30);
    const v2 = imp(-150) / (imp(-150) + imp(125));
    check(nq('spread') === 'DET −3.5' && nq('ml') === 'BOS +125 / DET −150' && nq('total') === null && nq('lsrc') === 'DraftKings, read ' + q.w.eval(`oddsClock(${JSON.stringify(at(now - 5 * MIN))})`) && nq('p:vegas') === pc0(v2),
      `a Refresh odds press newer than lines.json: the line is the press's, and Vegas with it (${nq('spread')}, ${nq('ml')}, ${nq('p:vegas')})`);
    q.d.dispatchEvent(new q.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    const q2 = load(ST(), { lines: null, mine: MINE([L_ML]), pickem: null }); await sleep(450);
    q2.d.querySelector('#parlayBody [data-glance]').click(); await sleep(60);
    const n2 = k => { const e = q2.d.querySelector(`#glanceBox [data-glance-n="${k}"]`); return e ? txt(e) : null; };
    check(n2('pkerr') === "The Pick'em Record's file did not load: no records, and no Alpha Model, Joker or ELO Model call." && n2('noline') === 'no line: DraftKings’ published lines did not load' && n2('p:player') && !q2.d.querySelector('#glanceBox [data-glance-model="alpha"]') && n2('price') === '−130',
      'with neither lines.json nor the Pick\'em Record\'s file, each says so in its own line, and the rest draws');
    q2.d.dispatchEvent(new q2.w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    q2.d.querySelector('#parlayBody [data-glance]').click(); await sleep(60);
    check(q2.requests.filter(x => /pickem\.json/.test(x.url)).length === 2, 'a read that failed is made again by the next team bubble, once');
    check(q.errors.length === 0 && q2.errors.length === 0, 'no script errors: ' + q.errors.concat(q2.errors).join(' | '));
  }
};
