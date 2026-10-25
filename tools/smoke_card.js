/* The parlay card, a section of the viewer smoke test (README "The parlay card"): run by tools/smoke.js, alone with
 *
 *   SMOKE_ONLY=card node tools/smoke.js
 *
 * The card (app/parts/card.html) is the NFL hub's (its nflbets/build/card.html, held there by nflbets/build/smoke_live.js
 * section J) on this page: Finish parlay opens it on the builder's legs. Here the built page boots in jsdom on made-up
 * games tomorrow and the day after (so every case holds at any hour on any day, the off-season included), a made-up
 * lines.json with made-up betslip ids (one with a '#', which the link must write %23), a props block of its own and a
 * builder seeded with four legs of three games: a player's points, a moneyline whose own id is newer than the game's
 * lines, a spread DraftKings has moved since its read, a total DraftKings has at another number. Every number the card
 * states is worked out here on its own (the price, DraftKings' fair chance and the model's by tools/corr.js's bivariate
 * normal and data/corr.json; the betslip link, the note and the text Share link sends, word for word, on this file's own
 * copy of the rules) and held to the builder's too. Then each DraftKings rule on its own case (an own id against a newer
 * or older read, a moved spread and total, a press newer and older than lines.json, a tipped game, a game with no lines,
 * no ids, no id for its market, a player's line), the image through a recorder canvas (every figure whole, the type
 * stepping down for a big stake, the file's name), the share sheet for the image, Share link's fallbacks (no share sheet,
 * one that cannot share it or fails, a cancel, no clipboard, a copy that fails), Escape, a click on the backdrop, the Tab
 * order, Start over, a level's Finish through a registered resolver, a parlay with no leg on the slip, a typed book
 * price, a one-sided leg's missing fair chance, every control 44px, and nothing written or fetched by any of it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = async function parlayCard({ check, pageFile, ROOT }) {
  console.log('The parlay card');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => JSON.parse(JSON.stringify(x));
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const PJ = require('./props'), CJ = require('./corr'), PUB = require('./publish'), SG = require('./sigma');
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const CT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corr.json'), 'utf8')), HOLD = CT.hold.value;
  const SIGMA = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'sigma.json'), 'utf8')).sigma;
  const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const ymd = d => d.replace(/-/g, ''), at = ms => new Date(ms).toISOString().slice(0, 19) + 'Z', tipAt = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
  const SEASON = REAL.season;

  /* ---------- this file's own copies of what the card says ---------- */
  const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100), decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
  const amOf = d => d >= 2 ? Math.round((d - 1) * 100) : Math.round(-100 / (d - 1));
  const mlOwn = x => x > 0 ? '+' + x : '−' + Math.abs(x), mlTxt = x => (x > 0 ? '+' : '') + x;
  const moneyOwn = v => '$' + v.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pctOwn = p => p > 0 && p < 0.0005 ? '<0.1%' : (p * 100).toFixed(1) + '%';
  const dayOwn = d => { const x = new Date(d + 'T12:00:00Z'); return x.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' }) + ' ' + x.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }); };
  const whenOwn = iso => new Date(iso).toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  const readOwn = iso => new Date(iso).toLocaleString('en-US', { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) + ' ET';
  const DKU = ids => 'https://sportsbook.draftkings.com/?outcomes=' + ids.map(encodeURIComponent).join('+');
  /* nothing may promise that every leg lands: an id is DraftKings' outcome at one number, dropped once its line moves */
  const promises = t => /\bputs all\b|\bOpens all\b|\ball \d+ legs on\b|\(all \d+ legs\b|\bevery leg (lands|will)\b|\bat DraftKings’ own prices\b/i.test(t);

  /* ---------- the harness ---------- */
  function load(st, o = {}) {
    const html = fs.readFileSync(pageFile('index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
    const errors = [], requests = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
      beforeParse(w) {
        w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
          if (/espn\.com/.test(url)) return { ok: false, status: 404, json: async () => ({}) };
          if (/lines\.json/.test(url)) return o.lines ? { ok: true, status: 200, json: async () => clone(o.lines) } : { ok: false, status: 404, json: async () => ({}) };
          if (/state\.json/.test(url)) return { ok: true, status: 200, json: async () => clone(st) };
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
        w.scrollTo = () => {}; w.confirm = () => true;
        if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
        if (o.mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(o.mine));
        w.localStorage.setItem('nba_hub_2027:tab', 'parlay');
        w.addEventListener('error', e => errors.push(e.message));
      } });
    const w = dom.window;
    return { w, d: w.document, errors, requests };
  }
  const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
  const stored = w => JSON.stringify([dump(w.localStorage), dump(w.sessionStorage)]);
  const mine = w => JSON.parse(w.localStorage.getItem('nba_hub_2027') || '{}');
  /* the image: a canvas that records what is drawn on it (jsdom draws nothing), a blob for toBlob, and the download
     anchor's click (the NFL hub's stubDraw) */
  function stubDraw(w) {
    const rec = { texts: [], draws: [], canvases: [], blobs: [], clicks: [], urls: [] };
    const em = (x, font) => [...String(x)].reduce((a, ch) => a + (/[\d$+,.−-]/.test(ch) ? 0.68 : 0.55), 0) * (parseFloat((String(font).match(/([\d.]+)px/) || [])[1]) || 10);
    w.HTMLCanvasElement.prototype.getContext = function (kind) {
      if (kind !== '2d') return null;
      rec.canvases.push(this);
      const st = { font: '10px sans-serif' };
      return new Proxy(st, {
        get(t, k) {
          if (k in t) return t[k];
          if (k === 'measureText') return x => ({ width: em(x, t.font) });
          if (k === 'fillText') return x => { rec.texts.push(String(x)); rec.draws.push({ t: String(x), font: String(t.font), color: String(t.fillStyle) }); };
          if (k === 'createLinearGradient') return () => ({ addColorStop() {} });
          return () => {};
        },
        set(t, k, v) { t[k] = v; return true; } });
    };
    w.HTMLCanvasElement.prototype.toBlob = function (cb, type) { const b = new w.Blob(['\x89PNG'], { type: type || 'image/png' }); rec.blobs.push(b); setTimeout(() => cb(b), 0); };
    w.URL.createObjectURL = b => { rec.urls.push(b); return 'blob:http://localhost/card'; };
    w.URL.revokeObjectURL = () => {};
    w.HTMLAnchorElement.prototype.click = function () { rec.clicks.push({ href: this.href, download: this.download, attached: this.isConnected }); };
    return rec;
  }

  /* ---------- the made-up games, tomorrow and the day after ---------- */
  const now = Date.now(), H = 3600e3, MIN = 60e3;
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const D1 = addDay(etDate(now), 1), D2 = addDay(D1, 1), at23 = d => Date.parse(d + 'T23:00:00Z'), T1 = at23(D1), T2 = at23(D2);
  const gid = (ms, a, h) => `${SEASON}_${ymd(etDate(ms))}_${a}_${h}`;
  const side = t => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: [] });
  const game = (ms, a, h, model) => ({ id: gid(ms, a, h), date: etDate(ms), tip: tipAt(ms), type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '6' + String(ms).slice(-6), awayScore: null, homeScore: null,
    line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 225, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5 }, published: null });
  const G1 = game(T1, 'BOS', 'DET', { pHome: 0.56, spread: -2, total: 226 });
  const G2 = game(T1 + 2 * H, 'LAL', 'GSW', { pHome: 0.62, spread: -4, total: 231 });
  const G3 = game(T1 + 30 * MIN, 'MIA', 'ORL', { pHome: 0.55, spread: -1.5 });
  const G4 = game(T2, 'CHI', 'TOR', { pHome: 0.6, spread: -3, total: 222 });
  const G5 = game(T2 + H, 'SAC', 'POR', { pHome: 0.52, spread: -1 });
  const G6 = game(now - H, 'PHX', 'DEN', { pHome: 0.7, spread: -6 });
  check(etDate(T1) === D1 && etDate(T1 + 2 * H) === D1 && etDate(T2 + H) === D2 && D1 > etDate(now), `the made-up games fall on two dates after today (${D1}, ${D2})`);
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'], COMBO = { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
  const VAR = { pts: [7.2, 0.73], reb: [1.76, 0.88], ast: [1.3, 0.99], tpm: [1.23, 1.0], stl: [1.1, 0.98], blk: [1.25, 1.12], pra: [9.66, 0.67], pr: [8.17, 0.72], pa: [6.43, 0.78], ar: [2.7, 0.76], sb: [1.2, 0.97] };
  const P = (name, team, pos, pts, reb, ast) => [name, team, pos, 33, pts, reb, ast, 1.8, 1.0, 0.5, 0.08, 0.01];
  const props = { onTrial: true, build: 'test', asOf: D1, fitSeasons: '2023-2026', horizonGameDays: 5, minShown: 8, stats: PJ.ALL, combos: COMBO, layout: LAY, dist: { kind: 'negative binomial', var: VAR }, fair: PJ.FAIR,
    ledger: { registered: '2026-10-15T11:35Z', bar: { lines: 30000 }, decision: null, summary: { lines: 4321, gradedGames: 40 } }, research: null,
    games: { [G1.id]: { tip: G1.tip, away: 'BOS', home: 'DET', players: { '9100001': P('Ace Guard', 'BOS', 'G', 26.2, 4, 5), '9100002': P('Bo Wing', 'DET', 'F', 14, 8.1, 2) } },
      [G2.id]: { tip: G2.tip, away: 'LAL', home: 'GSW', players: { '9100003': P('Cy Center', 'GSW', 'C', 15, 11, 2) } },
      [G4.id]: { tip: G4.tip, away: 'CHI', home: 'TOR', players: { '9100004': P('Dee Forward', 'CHI', 'F', 18, 6, 3) } } } };
  const ST = (o = {}) => ({ ...clone(REAL), today: etDate(now), generated: at(now - 3 * H), injuriesAsOf: etDate(now), slate: [G1, G2, G3, G4, G5, G6].map(clone), props: clone(props), corr: PUB.corrState(), ...o });
  /* the reads: lines.json's games read 90, 30 and 60 minutes ago; the moneyline added 20 minutes ago (a press since the
     file), the spread from an older read, the total two hours ago */
  const RD = at(now - 90 * MIN), RD2 = at(now - 30 * MIN), RD3 = at(now - 60 * MIN), RD4 = at(now - 20 * MIN), RD5 = at(now - 2 * H);
  const LINES = { v: 1, at: RD2, games: {
    [G1.id]: { at: RD, espn: G1.espn, ml: { home: -130, away: 110 }, spread: { line: -2.5, home: -110, away: -110 }, total: { line: 226.5, over: -110, under: -110 },
      ids: { event: '7001', ml: { home: '0ML7001_1', away: '0ML7001_3' }, spread: { home: '0HC7001N250_1', away: '0HC7001P250_3' }, total: { over: '0OU7001O22650_1', under: '0OU7001U22650_3' } },
      props: { at: RD, mains: [{ player: '9100001', stat: 'pts', line: 24.5, over: -115, under: -105 }, { player: '9100002', stat: 'reb', line: 7.5, over: -110, under: -110 }], ladders: [], yes: [] } },
    [G2.id]: { at: RD2, espn: G2.espn, ml: { home: -180, away: 150 }, spread: { line: -4.5, home: -110, away: -110 }, total: { line: 230.5, over: -110, under: -110 },
      ids: { event: '7002', ml: { home: '0ML7002_1', away: '0ML7002_3' }, spread: { home: '0HC7002N450_1', away: '0HC7002P450_3' }, total: { over: '0OU7002O23050_1', under: '0OU7002U23050_3' } },
      props: { at: RD2, mains: [{ player: '9100003', stat: 'reb', line: 10.5, over: -120, under: 100 }], ladders: [], yes: [] } },
    [G3.id]: { at: RD, espn: G3.espn, ml: { home: -120, away: 100 }, spread: { line: -1.5, home: -110, away: -110 }, total: null, ids: null, props: null },
    [G4.id]: { at: RD3, espn: G4.espn, ml: { home: -150, away: 130 }, spread: { line: -3.5, home: -110, away: -110 }, total: { line: 221.5, over: -108, under: -112 },
      ids: { event: '7004', ml: { home: null, away: null }, spread: { home: '0HC7004N350_1', away: '0HC7004P350_3' }, total: { over: '0OU7004O22150_1', under: '0OU7004U22150_3' } },
      props: { at: RD3, mains: [{ player: '9100004', stat: 'pts', line: 17.5, over: -110, under: -110 }], ladders: [], yes: [] } } } };
  const base = g => ({ id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip });
  /* the builder's four legs, as a game's Player props or the Top 50 would store them */
  const L_ML = { ...base(G1), at: RD4, kind: 'ml', side: 'DET', line: null, odds: -125, other: 105, dk: 'SMOKE#ML_DET' };
  const L_PL = { ...base(G1), kind: 'prop', pid: '9100001', name: 'Ace Guard', team: 'BOS', at: RD, stat: 'pts', mk: 'main', line: 24.5, side: 'over', odds: -115, other: -105 };
  const L_SP = { ...base(G2), at: RD, kind: 'spread', side: 'GSW', line: -3.5, odds: -110, other: -110, dk: '0HC7002N350_1' };
  const L_TO = { ...base(G4), at: RD5, kind: 'total', side: 'over', line: 220.5, odds: -110, other: -110 };
  const MINE = (legs, o = {}) => ({ picks: {}, build: [], slip: { legs: clone(legs), stake: 20 }, stake: 20, ...o });
  check(G1.date === D1 && G2.date === D1 && G4.date === D2, 'the legs: three of tomorrow (two of one game), one of the day after');

  /* the builder's order (the day, then the name) and each leg's numbers, worked out here */
  const nameOwn = l => l.kind === 'prop' ? l.name : l.kind === 'total' ? `${{ CHI: 'Bulls', BOS: 'Celtics' }[l.away] || l.away} at ${{ TOR: 'Raptors', DET: 'Pistons' }[l.home] || l.home}` : ({ DET: 'Pistons', GSW: 'Warriors', LAL: 'Lakers', BOS: 'Celtics', SAC: 'Kings', MIA: 'Heat', TOR: 'Raptors' })[l.side] || l.side;
  const labelOwn = l => l.kind === 'prop' ? `${l.side === 'under' ? 'Under' : 'Over'} ${l.line} ${{ pts: 'points', reb: 'rebounds' }[l.stat]}` : l.kind === 'ml' ? 'To win' : l.kind === 'spread' ? `To cover ${l.line > 0 ? '+' : ''}${l.line}` : `${l.side === 'under' ? 'Under' : 'Over'} ${l.line} points`;
  const keyOwn = l => l.kind === 'prop' ? [l.id, 'prop', l.pid, l.stat, l.mk, l.line, l.side].join('|') : [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
  const ordOwn = ls => [...ls].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || nameOwn(a).localeCompare(nameOwn(b)) || (keyOwn(a) < keyOwn(b) ? -1 : 1));
  const modelOwn = l => { const g = [G1, G2, G3, G4, G5].find(x => x.id === l.id);
    if (l.kind === 'ml') return l.side === g.home ? g.model.pHome : 1 - g.model.pHome;
    if (l.kind === 'spread') return SG.Phi(((l.side === g.home ? -g.model.spread : g.model.spread) + l.line) / SIGMA);
    if (l.kind === 'total') return l.other == null ? 0.5 : imp(l.odds) / (imp(l.odds) + imp(l.other));
    const row = props.games[l.id].players[l.pid], mu = row[LAY.indexOf(l.stat)], o = PJ.pOver(l.line, mu, PJ.nbVar(mu, VAR[l.stat])); return l.side === 'under' ? 1 - o : o; };
  const fairOwn = l => l.other == null ? null : l.kind === 'prop' ? (l.side === 'under' ? imp(l.odds) : 1 - imp(l.other)) : imp(l.odds) / (imp(l.odds) + imp(l.other));
  const desc = l => l.kind === 'prop' ? { game: l.id, kind: l.stat, player: l.pid, team: l.team, side: l.side, home: l.home } : { game: l.id, kind: { ml: 'win', spread: 'cover', total: 'over' }[l.kind], team: l.kind === 'total' ? '' : l.side, side: l.side, home: l.home };
  const groups = ls => { const m = new Map(); for (const l of ls) { if (!m.has(l.id)) m.set(l.id, []); m.get(l.id).push(l); } return [...m.values()]; };
  const joint = (ps, ls) => ps.length === 1 ? ps[0] : CJ.joint2(ps[0], ps[1], CJ.rhoFor(CT, desc(ls[0]), desc(ls[1])) || 0);
  const priceOwn = ls => { let dec = 1, fair = 1, model = 1, sg = false;
    for (const g of groups(ls)) { const mult = g.reduce((t, l) => t * decOf(l.odds), 1); if (g.length > 1) sg = true;
      dec *= g.length > 1 ? Math.min(mult, HOLD / joint(g.map(l => imp(l.odds)), g)) : mult;
      fair = fair == null || g.some(l => fairOwn(l) == null) ? null : fair * joint(g.map(fairOwn), g); model *= joint(g.map(modelOwn), g); }
    return { dec, fair, model, sg }; };

  /* ---------- 1. Finish: the window and the card, on the builder's four legs ---------- */
  const STAKE = 1250;
  let p = load(ST(), { lines: LINES, mine: MINE([L_ML, L_PL, L_SP, L_TO], { stake: STAKE }) });
  await sleep(400);
  const { w, d } = p;
  const rec = stubDraw(w);
  check(d.querySelectorAll('#parlayBody tr.legrow').length === 4 && !!d.getElementById('pFinish'), 'the builder has the four legs and its Finish parlay');
  const own = ordOwn([L_ML, L_PL, L_SP, L_TO]), O = priceOwn(own), q = w.pbQuote();
  check(JSON.stringify(q.legs.map(l => l.sk)) === JSON.stringify(own.map(keyOwn)) && Math.abs(q.useDec - O.dec) < 1e-9 && Math.abs(q.fair.p - O.fair) < 1e-9 && Math.abs(q.pr.corr - O.model) < 1e-9 && O.sg,
    `the builder's own numbers (pbQuote) are this file's: its order (${own.map(nameOwn).join(', ')}), its same-game price ${O.dec.toFixed(4)}, DraftKings' fair chance ${O.fair.toFixed(5)} and the model's ${O.model.toFixed(5)}, two legs of one game joined exactly`);
  const before = stored(w), reqs0 = p.requests.length;
  const fin = d.getElementById('pFinish'); fin.focus(); fin.click(); await sleep(30);
  const back = d.getElementById('pcBack'), sheet = d.getElementById('pcSheet'), view = d.getElementById('pcView'), m = w.PARLAY_CARD.current();
  check(!back.hidden && sheet.getAttribute('role') === 'dialog' && sheet.getAttribute('aria-modal') === 'true' && sheet.getAttribute('aria-labelledby') === 'pcTitle' && txt(d.getElementById('pcTitle')) === 'Your parlay card' && d.body.classList.contains('pp-lock'),
    'Finish parlay opens the card in a window over the page, a modal dialog labelled "Your parlay card"');
  check(d.activeElement === d.getElementById('pcDownload') && d.getElementById('pcShare').hidden && /\bhot\b/.test(d.getElementById('pcDownload').className), 'the focus is on Download image, which leads where the browser cannot share a file');
  const am = amOf(q.useDec), legsDrawn = [...view.querySelectorAll('.pc-legs li')];
  check(txt(view.querySelector('.pc-mark span')) === 'NBA Hub' && txt(view.querySelector('.pc-kick')) === 'Your parlay' && txt(view.querySelector('.pc-title')) === '4-leg parlay' && txt(view.querySelector('.pc-price')) === mlOwn(am) && view.querySelector('.pc-price').title === 'estimated same-game price',
    `the card's head: the site's mark, the kicker, the title and the builder's price (${txt(view.querySelector('.pc-head'))})`);
  check([...view.querySelectorAll('.pc-sub span')].map(txt).join(' | ') === `${dayOwn(D1)} – ${dayOwn(D2)} | ${q.useDec.toFixed(2)} decimal · ${(100 / q.useDec).toFixed(1)}% implied · estimated same-game price`,
    `the days and their dates, the decimal price, its implied chance and that it is an estimated same-game price (${txt(view.querySelector('.pc-sub'))})`);
  const legWant = own.map(l => ({ who: nameOwn(l), what: labelOwn(l), meta: [l.kind === 'prop' ? 'G' : '', `${l.kind === 'prop' ? l.team : l.kind === 'total' ? l.away : l.side} v ${l.kind === 'prop' ? (l.team === l.home ? l.away : l.home) : l.kind === 'total' ? l.home : (l.side === l.home ? l.away : l.home)}`, whenOwn(l.tip)].filter(Boolean).join(' · '), price: mlOwn(l.odds), tag: 'book' }));
  const legGot = legsDrawn.map(li => ({ who: txt(li.querySelector('.pc-who')), what: txt(li.querySelector('.pc-what')), meta: txt(li.querySelector('.pc-meta')), price: li.querySelector('.pc-lp').firstChild.textContent, tag: txt(li.querySelector('.pc-lp small')) }));
  check(JSON.stringify(legGot) === JSON.stringify(legWant), `every leg in the builder's order with its bet, its game and tip-off in Eastern time and DraftKings' price: ${JSON.stringify(legGot)}`);
  const tiles = [...view.querySelectorAll('.pc-money div')].map(x => [txt(x.querySelector('span')), txt(x.querySelector('b'))]);
  check(JSON.stringify(tiles) === JSON.stringify([['Stake', '$1,250.00'], ['Pays', moneyOwn(STAKE * q.useDec)], ['Profit', '+' + moneyOwn(STAKE * q.useDec - STAKE)]]) && moneyOwn(STAKE * q.useDec).includes(','),
    `the Bet amount ($1,250) and what it pays at the builder's price, every figure whole with its thousands marked (${tiles.map(x => x.join(' ')).join(' / ')})`);
  check([...view.querySelectorAll('.pc-money div')].every(x => /flex:1 1 0|flex: 1 1 0/.test(w.getComputedStyle(x).flex || '') || w.getComputedStyle(x).flexGrow === '1') && w.getComputedStyle(view.querySelector('.pc-money')).flexWrap === 'wrap' && [...view.querySelectorAll('.pc-money b')].every(b => w.getComputedStyle(b).whiteSpace === 'nowrap'),
    'the money tiles share the row and wrap onto another rather than cut a figure');
  const chance = [...view.querySelectorAll('.pc-chance > div')].map(txt), small = [...view.querySelectorAll('.pc-chance small')].map(txt);
  const C1 = `Fair chance all 4 land ${pctOwn(O.fair)} (est.)`, C2 = `model (on trial) says ${pctOwn(O.model)} · the price says ${pctOwn(1 / q.useDec)}`;
  check(chance.length === 2 && chance[0] === C1 && chance[1] === C2, `DraftKings' fair chance first, then the model's, on trial with a player leg in, and the price's (${chance.join(' / ')})`);
  check(small.includes('Est.: legs share a game, so their fair chances are joined by how they move together, measured on the hub’s box scores.') && small.includes("DraftKings prices same-game parlays its own way: this is an estimate from the legs' prices and how they move together."),
    `the window says why the fair chance and the price are estimates (${small.join(' / ')})`);
  check(txt(view.querySelector('.pc-foot b')) === 'demon-x13.github.io/nba-hub' && /^Made \w{3} \d{1,2}, \d{4}$/.test(txt(view.querySelector('.pc-foot span'))) && m.file === `parlay-${D1}-4legs.png`, `the site's address and the day it was made (${txt(view.querySelector('.pc-foot'))}), the file named ${m.file}`);

  /* ---------- 2. Open in DraftKings: the ids, the conversions, the note ---------- */
  const dkA = d.getElementById('pcDk'), note = d.getElementById('pcDkNote');
  const n = l => own.indexOf(l) + 1, iML = n(L_ML), iPL = n(L_PL), iSP = n(L_SP), iTO = n(L_TO);
  const wantIds = own.map(l => l === L_ML ? 'SMOKE#ML_DET' : l === L_SP ? '0HC7002N450_1' : l === L_TO ? '0OU7004O22150_1' : null).filter(Boolean);
  const URL4 = DKU(wantIds), oldest = [RD4, RD2, RD3].sort()[0];
  check(dkA.tagName === 'A' && !dkA.hidden && dkA.getAttribute('href') === URL4 && URL4.includes('SMOKE%23ML_DET') && dkA.getAttribute('target') === '_blank' && /\bnoopener\b/.test(dkA.getAttribute('rel')) && txt(dkA) === 'Open 3 of 4 legs in DraftKings',
    `Open in DraftKings is a link to DraftKings' betslip in a new tab, the three game legs' ids in the card's order, '#' written %23, the button saying it opens 3 of the 4 (${dkA.getAttribute('href')})`);
  check(dkA.title === `Opens 3 of the 4 legs on DraftKings’ betslip, in a new tab, as DraftKings’ lines were read ${readOwn(oldest)}: a line moved or pulled since will not be on it, so check each leg is there` && !promises(dkA.title),
    `its title dates the read by the oldest of the legs it opens, ${readOwn(oldest)}, and promises nothing ("${dkA.title}")`);
  const ps = [...note.querySelectorAll('p')].map(txt), legLinks = [...note.querySelectorAll('a[data-pc-dkleg]')];
  check(ps[0] === `DraftKings’ lines as read ${readOwn(oldest)}: Open in DraftKings opens 3 of the 4 legs as DraftKings had them then; a leg whose line DraftKings has moved or pulled since will not be on the slip, so check it before you bet.`
    && ps[1] === `One leg at a time: ${[iML, iSP, iTO].sort().map(x => 'Leg ' + x).join('')}` && ps[2] === 'Add by hand:' && !promises(txt(note)),
    `the note says what it opens, as DraftKings had them at the oldest read, never that every leg lands ("${ps[0]}")`);
  check(legLinks.length === 3 && legLinks.map(a => a.getAttribute('href')).join(' ') === wantIds.map(x => DKU([x])).join(' ') && legLinks.every(a => a.getAttribute('target') === '_blank' && /noopener/.test(a.getAttribute('rel')) && /^Open leg \d, .+, in DraftKings$/.test(a.getAttribute('aria-label'))),
    'each leg it opens has its own link too, named for its leg');
  check(JSON.stringify([...note.querySelectorAll('li[data-pc-dkmiss]')].map(txt)) === JSON.stringify([`${iPL}. Ace Guard, Over 24.5 points: DraftKings’ player lines carry no betslip id in ESPN’s feed`]),
    'the player\'s leg is to be added by hand, with why');
  check(JSON.stringify([...note.querySelectorAll('li[data-pc-dkswap]')].map(txt)) === JSON.stringify([[iSP, `${iSP}. Warriors, To cover -3.5: goes on as Warriors -4.5`], [iTO, `${iTO}. Bulls at Raptors, Over 220.5 points: goes on as Over 221.5 points`]].sort((a, b) => a[0] - b[0]).map(x => x[1]))
    && ps.includes('On DraftKings’ slip at its own line:') && ps.includes('DraftKings prices changed legs at its own lines, so its slip’s payout can differ from this card’s.'),
    `a spread DraftKings has moved since its read and a total DraftKings has at another number go on at DraftKings' number, said so, with that DraftKings prices them there (${[...note.querySelectorAll('li[data-pc-dkswap]')].map(txt).join(' | ')})`);
  /* the builder says it first, under each leg that will not go on as built, from the card's own plan */
  const slipRows = [...d.querySelectorAll('#parlayBody tr.legrow')].map(tr => [tr.dataset.pbRow, txt(tr.querySelector('.dkslip'))]);
  check(JSON.stringify(slipRows) === JSON.stringify(own.map(l => [keyOwn(l), l === L_PL ? 'Not on DraftKings’ slip yet: no betslip id in ESPN’s feed' : l === L_SP ? 'On DraftKings as Warriors -4.5' : l === L_TO ? 'On DraftKings as Over 221.5 points' : ''])),
    `the builder's line under each leg is the card's plan: the player's leg by hand, the two converted legs at DraftKings' number, nothing under the moneyline (${slipRows.map(x => x[1] || '–').join(' | ')})`);

  /* ---------- 3. Share link: one text, the link in it, never a url field ---------- */
  const TITLE = `4-leg parlay ${mlTxt(am)} (estimated same-game price)`;
  const TEXT = [...own.map((l, i) => `${i + 1}. ${nameOwn(l)}: ${labelOwn(l)} (${mlTxt(l.odds)})`), `Stake $1,250.00 · Pays ${moneyOwn(STAKE * q.useDec)}`, `${C1} · ${C2}`,
    `DraftKings betslip (opens 3 of the 4 legs as DraftKings had them; add leg ${iPL} by hand):`, URL4,
    `DraftKings lines as read ${readOwn(oldest)}: a leg whose line DraftKings has moved or pulled since will not be on the slip, so check it before you bet`,
    `On DraftKings’ slip at its own line: ${[[iSP, `leg ${iSP} as Warriors -4.5`], [iTO, `leg ${iTO} as Over 221.5 points`]].sort((a, b) => a[0] - b[0]).map(x => x[1]).join('; ')} (DraftKings prices them at its own line, so its payout can differ)`,
    'Add by hand at DraftKings:', `${iPL}. Ace Guard Over 24.5 points (no betslip id in ESPN’s feed)`, 'demon-x13.github.io/nba-hub'].join('\n');
  const nav = w.navigator, def = (k, v) => Object.defineProperty(nav, k, { value: v, configurable: true, writable: true });
  let shared = [], asked = [], copied = [];
  const msg = () => txt(d.getElementById('pcMsg'));
  def('share', async x => { shared.push(x); }); def('canShare', x => { asked.push(x); return !(x && x.files); });
  def('clipboard', { writeText: async t => { copied.push(t); } });
  const link = async () => { d.getElementById('pcLink').click(); await sleep(30); };
  await link();
  check(shared.length === 1 && Object.keys(shared[0]).sort().join() === 'text,title' && shared[0].title === TITLE && shared[0].text === TEXT && !copied.length,
    `Share link hands the share sheet a title and a text, no url field, the text word for word this file's: every leg with its price, the stake and what it pays, the chances, what the link opens and the link alone on its line, the read, the converted legs, the leg to add by hand with why, the site last${shared[0] && shared[0].text !== TEXT ? ': got ' + JSON.stringify(shared[0].text) : ''}`);
  check(asked.some(x => x && x.title === TITLE && x.text === TEXT && !('url' in x)) && !promises(TEXT) && !/\nall \d|every leg/i.test(TEXT), 'canShare is asked about the same title and text, and nothing in it promises every leg');
  shared = []; copied = [];
  def('share', async () => { const e = new Error('cancel'); e.name = 'AbortError'; throw e; });
  await link();
  check(!copied.length && msg() === '', 'a share sheet cancelled does nothing: no copy, no word');
  def('share', async () => { throw new Error('denied'); });
  await link();
  check(copied.length === 1 && copied[0] === TEXT && msg() === 'Link copied', 'a share sheet that fails: the same text copied, "Link copied"');
  copied = []; def('share', async x => { shared.push(x); }); def('canShare', () => false);
  await link();
  check(copied.length === 1 && copied[0] === TEXT && !shared.length, 'a share sheet that cannot share it: copied');
  copied = []; def('canShare', () => { throw new Error('no'); });
  await link();
  check(copied.length === 1 && copied[0] === TEXT && !shared.length, 'a canShare that throws counts as cannot: copied');
  copied = []; def('share', undefined); def('canShare', undefined); def('clipboard', undefined);
  d.getElementById('pcLink').focus();
  let boxed = null, sel = 0; w.document.execCommand = c => { const ta = d.querySelector('#pcSheet textarea'); boxed = ta && { v: ta.value, ro: ta.hasAttribute('readonly'), hid: ta.getAttribute('aria-hidden'), tab: ta.tabIndex }; sel++; return c === 'copy'; };
  await link();
  check(boxed && boxed.v === TEXT && boxed.ro && boxed.hid === 'true' && boxed.tab === -1 && !d.querySelector('#pcSheet textarea') && msg() === 'Link copied' && d.activeElement === d.getElementById('pcLink'),
    'with no share sheet and no clipboard call, the same text goes through a hidden, read-only box inside the window, gone after, the focus back on Share link');
  w.document.execCommand = () => false;
  await link();
  check(msg() === 'The link could not be copied.', 'and a copy that fails says so');
  check(!rec.canvases.length && !rec.clicks.length, 'neither Share link path draws or downloads the image');

  /* ---------- 4. the image: a canvas at twice the card's size, every figure whole ---------- */
  const dl = d.getElementById('pcDownload'); dl.click();
  for (let i = 0; i < 40 && !/^Saved as /.test(msg()); i++) await sleep(25);
  const cv = rec.canvases[0], drawn = rec.texts;
  check(cv && cv.width === 1080 && cv.height > 2 * 400 && rec.clicks.length === 1 && rec.clicks[0].download === `parlay-${D1}-4legs.png` && rec.clicks[0].attached && msg() === `Saved as parlay-${D1}-4legs.png.`,
    `Download image draws the card on a canvas twice its size (${cv && cv.width}×${cv && cv.height}) and saves it as parlay-${D1}-4legs.png, saying so`);
  const wantTexts = ['NBA HUB', 'YOUR PARLAY', '4-leg parlay', mlOwn(am), `${q.useDec.toFixed(2)} decimal · ${(100 / q.useDec).toFixed(1)}% implied`, `${dayOwn(D1)} – ${dayOwn(D2)}`, 'estimated same-game price',
    ...legWant.flatMap(l => [l.who, l.what, l.price, 'BOOK']), 'STAKE', 'PAYS', 'PROFIT', '$1,250.00', moneyOwn(STAKE * q.useDec), '+' + moneyOwn(STAKE * q.useDec - STAKE), 'demon-x13.github.io/nba-hub'];
  const missing = wantTexts.filter(t => !drawn.includes(t));
  check(!missing.length && drawn.some(t => /^Made /.test(t)) && chance.every(c => c.replace(/\s/g, '') === '' || drawn.join('').includes(c)), `the image carries the mark, the kicker, the title and price, every leg, the money, the chances and the site${missing.length ? ': missing ' + JSON.stringify(missing) : ''}`);
  const moneyDraws = rec.draws.filter(x => /^\+?\$/.test(x.t));
  check(moneyDraws.length === 3 && moneyDraws.every(x => !/…/.test(x.t) && +/(\d+(\.\d+)?)px/.exec(x.font)[1] >= 14), `no dollar figure is cut, and none is drawn under 14px (${moneyDraws.map(x => x.t + ' at ' + /[\d.]+px/.exec(x.font)[0]).join(', ')})`);
  check(rec.draws.find(x => x.t === mlOwn(am)).color === '#FF8C4A' && rec.draws.find(x => x.t === 'YOUR PARLAY').color === '#FFB27A', "the price and the kicker are drawn in the NBA's accent, its lighter steps for text");
  /* bigger figures: the type steps down from 19px to fit three across, and past that the tiles take a second row (the
     canvas taller by a row of tiles), every figure whole */
  const redraw = async (stake, dec) => { const mm = w.PARLAY_CARD.current(); mm.stake = stake; mm.payout = stake * dec; mm.profit = mm.payout - stake;
    rec.canvases.length = 0; rec.draws.length = 0; rec.clicks.length = 0; dl.click();
    for (let i = 0; i < 40 && rec.clicks.length < 1; i++) await sleep(25);
    const md = rec.draws.filter(x => /^\+?\$/.test(x.t)); return { t: md.map(x => x.t).join(' '), px: md.map(x => +/([\d.]+)px/.exec(x.font)[1]), h: rec.canvases[0].height }; };
  { const a1 = await redraw(1000, 412.5), a2 = await redraw(100000, 412.5);
    check(a1.t === '$1,000.00 $412,500.00 +$411,500.00' && a1.px.every(v => v >= 14 && v < 19) && a1.h === cv.height,
      `$1,000 paying $412,500: every figure whole, three across, the type stepped down to ${a1.px[0]}px`);
    check(a2.t === '$100,000.00 $41,250,000.00 +$41,150,000.00' && a2.px.every(v => v >= 14) && a2.h === cv.height + 2 * (58 + 8),
      `$100,000 paying $41,250,000: every figure whole, at ${a2.px[0]}px, the tiles taking a second row (the image ${a2.h} tall against ${cv.height})`); }

  /* ---------- 5. the window's keys, its controls and what it leaves behind ---------- */
  const ctl = ['pcClose', 'pcDk', 'pcLink', 'pcDownload', 'pcAgain'].map(id => d.getElementById(id));
  check(ctl.every(b => w.getComputedStyle(b).minHeight === '44px') && legLinks.every(a => w.getComputedStyle(a).minHeight === '44px' && w.getComputedStyle(a).minWidth === '44px'), 'every control in the window is 44px, each leg\'s own link too');
  const order = [...sheet.querySelectorAll('button,a[href],input,select,[tabindex]:not([tabindex="-1"])')].filter(x => !x.disabled && !x.hidden && !x.closest('[hidden]'));
  check(JSON.stringify(order.map(x => x.id || 'leg ' + x.dataset.pcDkleg)) === JSON.stringify(['pcClose', 'pcDk', 'pcLink', 'pcDownload', 'pcAgain', ...legLinks.map(a => 'leg ' + a.dataset.pcDkleg)]),
    `the Tab order: Close, Open in DraftKings, Share link, Download, Start over, each leg's link (${order.map(x => x.id || 'leg ' + x.dataset.pcDkleg).join(', ')})`);
  const key = (k, sh) => { const e = new w.KeyboardEvent('keydown', { key: k, shiftKey: !!sh, bubbles: true, cancelable: true }); (d.activeElement || d.body).dispatchEvent(e); return e; };
  order[order.length - 1].focus(); let ev = key('Tab');
  check(ev.defaultPrevented && d.activeElement === order[0], 'Tab from the last control goes round to Close');
  ev = key('Tab', true);
  check(ev.defaultPrevented && d.activeElement === order[order.length - 1], 'Shift-Tab from Close goes round to the last');
  check(stored(w) === before && p.requests.length === reqs0, 'nothing is written to any store and nothing is fetched by finishing, the image, or Share link');
  ev = key('Escape');
  check(back.hidden && ev.defaultPrevented && d.activeElement === d.getElementById('pFinish') && !d.body.classList.contains('pp-lock'), 'Escape closes it, the focus back on Finish parlay');
  d.getElementById('pFinish').click(); await sleep(20);
  back.dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check(back.hidden && d.activeElement === d.getElementById('pFinish'), 'a click on the backdrop closes it');
  d.getElementById('pFinish').click(); await sleep(20);
  view.querySelector('.pc-card').dispatchEvent(new w.MouseEvent('click', { bubbles: true }));
  check(!back.hidden, 'a click on the card itself does not');
  d.getElementById('pcClose').click();
  check(back.hidden && d.activeElement === d.getElementById('pFinish'), 'Close closes it');
  /* Start over: the builder emptied, in this browser, the focus on the tab's first control */
  d.getElementById('pFinish').click(); await sleep(20);
  check(!d.getElementById('pcAgain').hidden, 'a card from the builder offers Start over');
  d.getElementById('pcAgain').click(); await sleep(30);
  check(back.hidden && !mine(w).slip.legs.length && mine(w).bookPrice === null && !d.querySelectorAll('#parlayBody tr.legrow').length && d.activeElement === d.querySelector('#tab-parlay [data-pb-mix]'),
    'Start over empties the builder, closes the card and puts the focus on the tab\'s first control');
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 6. each DraftKings rule on its own case ---------- */
  {
    const q2 = load(ST(), { lines: LINES, mine: MINE([]) }); await sleep(400);
    const D = l => JSON.parse(q2.w.eval(`JSON.stringify(PARLAY_CARD.dkLeg(${JSON.stringify(l)}))`));
    const cases = [
      ['a moneyline with its own id and no lines read for its game', { ...base(G5), kind: 'ml', side: 'POR', line: null, odds: -110, other: -110, dk: 'OWN_ML', at: RD }, { id: 'OWN_ML', at: new Date(RD).toISOString() }],
      ['a moneyline whose own id is older than its game\'s lines: the newer id', { ...base(G1), kind: 'ml', side: 'DET', line: null, odds: -130, other: 110, dk: 'OLD_ML', at: at(now - 3 * H) }, { id: '0ML7001_1', at: new Date(RD).toISOString() }],
      ['a moneyline whose own id is newer: its own', L_ML, { id: 'SMOKE#ML_DET', at: new Date(RD4).toISOString() }],
      ['a spread DraftKings has moved since its read: at DraftKings\' number', L_SP, { id: '0HC7002N450_1', at: new Date(RD2).toISOString(), swap: 'Warriors -4.5', now: -4.5 }],
      ['a spread read after its game\'s lines, at another number: its own', { ...L_SP, dk: 'OWN_SP', at: at(now - 10 * MIN) }, { id: 'OWN_SP', at: new Date(now - 10 * MIN).toISOString().slice(0, 19) + '.000Z' }],
      ['a spread with no id of its own, at the lines\' number: theirs', { ...base(G1), kind: 'spread', side: 'DET', line: -2.5, odds: -110, other: -110, at: RD }, { id: '0HC7001N250_1', at: new Date(RD).toISOString() }],
      ['the other side of that spread: its own outcome', { ...base(G1), kind: 'spread', side: 'BOS', line: 2.5, odds: -110, other: -110, at: RD }, { id: '0HC7001P250_3', at: new Date(RD).toISOString() }],
      ['a total at another number: the same side at DraftKings\' number', L_TO, { id: '0OU7004O22150_1', at: new Date(RD3).toISOString(), swap: 'Over 221.5 points', now: 221.5 }],
      ['an Under at another number: the Under', { ...L_TO, side: 'under' }, { id: '0OU7004U22150_3', at: new Date(RD3).toISOString(), swap: 'Under 221.5 points', now: 221.5 }],
      ['a player\'s line', L_PL, { why: 'DraftKings’ player lines carry no betslip id in ESPN’s feed', brief: 'no betslip id in ESPN’s feed' }],
      ['a game that has tipped off', { ...base(G6), kind: 'ml', side: 'DEN', line: null, odds: -200, other: 170, dk: 'X', at: RD }, { why: 'its game has tipped off', brief: 'its game has tipped off' }],
      ['a game whose lines have not been read', { ...base(G5), kind: 'spread', side: 'POR', line: -1.5, odds: -110, other: -110, at: RD }, { why: 'its game’s DraftKings lines have not been read yet: the job reads them through the day, and Refresh odds reads them now', brief: 'its game’s lines are not read yet' }],
      ['a game whose lines carry no ids', { ...base(G3), kind: 'ml', side: 'ORL', line: null, odds: -120, other: 100, at: RD }, { why: 'no DraftKings betslip id was read for its game', brief: 'no betslip id read for its game' }],
      ['a market of a game with ids that has none', { ...base(G4), kind: 'ml', side: 'TOR', line: null, odds: -150, other: 130, at: RD3 }, { why: `DraftKings’ moneyline for it carried no betslip id when its lines were read (${readOwn(RD3)})`, brief: 'no moneyline id read' }]];
    const bad = cases.filter(([, l, want]) => JSON.stringify(D(l)) !== JSON.stringify(want)).map(([name, l, want]) => `${name}: ${JSON.stringify(D(l))}, not ${JSON.stringify(want)}`);
    check(!bad.length, `each DraftKings rule on its own case, ${cases.length} of them: ${cases.map(c => c[0]).join('; ')}${bad.length ? ' -- ' + bad.join(' | ') : ''}`);
    /* a Refresh odds press newer than lines.json moves the number the total goes on at; one older leaves lines.json's */
    q2.w.eval(`SG_LINES[${JSON.stringify(G4.id)}] = { at: ${JSON.stringify(at(now - 5 * MIN))}, event: '7004', total: { line: 222.5, over: { odds: -110, id: '0OU7004O22250_1' }, under: { odds: -110, id: '0OU7004U22250_3' } } };
      SG_LINES[${JSON.stringify(G2.id)}] = { at: ${JSON.stringify(at(Date.parse(RD2) - H))}, event: '7002', spread: { home: { line: -5.5, odds: -110, id: '0HC7002N550_1' }, away: { line: 5.5, odds: -110, id: '0HC7002P550_3' } } };`);
    const t1 = D(L_TO), s1 = D(L_SP);
    check(t1.id === '0OU7004O22250_1' && t1.swap === 'Over 222.5 points' && s1.id === '0HC7002N450_1' && s1.swap === 'Warriors -4.5',
      `a press read after lines.json has the total at 222.5, and the leg goes on there; a press read before lines.json leaves the spread on lines.json's -4.5 (${t1.swap}, ${s1.swap})`);
    /* a plan with every leg in one game, none on the slip: the game's own page; across two games: DraftKings' NBA page */
    const plan = ls => JSON.parse(q2.w.eval(`JSON.stringify(PARLAY_CARD.dkPlan(${JSON.stringify(ls)}))`));
    const one = plan([L_PL, { ...L_PL, pid: '9100002', name: 'Bo Wing', team: 'DET', stat: 'reb', line: 7.5, odds: -110, other: -110 }]), two = plan([L_PL, { ...base(G4), kind: 'prop', pid: '9100004', name: 'Dee Forward', team: 'CHI', at: RD3, stat: 'pts', mk: 'main', line: 17.5, side: 'over', odds: -110, other: -110 }]);
    check(one.url === null && one.event === 'https://sportsbook.draftkings.com/event/7001' && one.home === one.event && two.url === null && two.event === null && two.home === 'https://sportsbook.draftkings.com/leagues/basketball/nba' && one.read === null,
      "a plan with no leg on the slip opens the game's page where every leg is in one game, else DraftKings' NBA page");
    check(q2.errors.length === 0, 'no script errors: ' + q2.errors.join(' | '));
  }

  /* ---------- 7. no leg on the slip, a typed book price, one leg, a missing fair chance ---------- */
  {
    const L2 = { ...L_PL, pid: '9100002', name: 'Bo Wing', team: 'DET', stat: 'reb', line: 7.5, odds: -110, other: -110 };
    const q3 = load(ST(), { lines: LINES, mine: MINE([L_PL, L2]) }); await sleep(400);
    q3.d.getElementById('pFinish').click(); await sleep(20);
    let sh = null; Object.defineProperty(q3.w.navigator, 'share', { value: async x => { sh = x; }, configurable: true });
    q3.d.getElementById('pcLink').click(); await sleep(20);
    const a3 = q3.d.getElementById('pcDk'), t3 = sh && sh.text.split('\n');
    check(txt(a3) === 'Open game in DraftKings' && a3.getAttribute('href') === 'https://sportsbook.draftkings.com/event/7001' && /^Opens the game’s page in DraftKings, in a new tab, to add the legs by hand$/.test(a3.title)
      && txt(q3.d.querySelector('#pcDkNote p')) === 'None of these legs can go on DraftKings’ betslip from here, so Open game in DraftKings opens the game’s page: add them there by hand.',
      "two player legs of one game: Open game in DraftKings, the game's page, and the note says to add them there by hand");
    check(t3 && t3.includes('DraftKings, the game’s page (add the legs by hand):') && t3.includes('https://sportsbook.draftkings.com/event/7001') && t3.includes('Add by hand on the game’s DraftKings page:') && t3.filter(x => / \(no betslip id in ESPN’s feed\)$/.test(x)).length === 2 && !t3.some(x => /^DraftKings betslip/.test(x)),
      "and Share link's text sends the game's page with each leg to add by hand");
    q3.d.getElementById('pcClose').click();
    q3.w.eval(`M.slip.legs = ${JSON.stringify([L_PL, { ...base(G4), kind: 'prop', pid: '9100004', name: 'Dee Forward', team: 'CHI', at: RD3, stat: 'pts', mk: 'main', line: 17.5, side: 'over', odds: -110, other: -110 }])}; renderParlay();`);
    q3.d.getElementById('pFinish').click(); await sleep(20); sh = null;
    q3.d.getElementById('pcLink').click(); await sleep(20);
    check(txt(q3.d.getElementById('pcDk')) === 'Open DraftKings' && q3.d.getElementById('pcDk').getAttribute('href') === 'https://sportsbook.draftkings.com/leagues/basketball/nba' && /DraftKings’ NBA page \(add the legs by hand\):\nhttps:\/\/sportsbook\.draftkings\.com\/leagues\/basketball\/nba\n/.test(sh.text)
      && /Open DraftKings opens its NBA page: add them there by hand\.$/.test(txt(q3.d.querySelector('#pcDkNote p'))), "two player legs of two games: Open DraftKings, DraftKings' NBA page");
    q3.d.getElementById('pcClose').click();
    /* a parlay price typed into the builder: the card pays on it and calls it the visitor's book's */
    q3.w.eval(`M.slip.legs = ${JSON.stringify([L_SP, L_TO])}; M.bookPrice = 500; M.stake = 20; renderParlay();`);
    q3.d.getElementById('pFinish').click(); await sleep(20);
    const v3 = q3.d.getElementById('pcView');
    check(txt(v3.querySelector('.pc-price')) === '+500' && v3.querySelector('.pc-price').title === 'your book’s price' && txt(v3.querySelectorAll('.pc-money b')[1]) === '$120.00' && ![...v3.querySelectorAll('.pc-chance small')].some(x => /same-game/.test(x.textContent)) && txt(q3.d.getElementById('pcDk')) === 'Open in DraftKings',
      "a typed book price: the card pays $120 on $20 at +500, called your book's price, with no same-game note, both legs on the slip");
    sh = null; q3.d.getElementById('pcLink').click(); await sleep(20);
    const n3 = txt(q3.d.querySelector('#pcDkNote p')), rd3 = [RD2, RD3].sort()[0];
    check(n3 === `DraftKings’ lines as read ${readOwn(rd3)}: Open in DraftKings opens the 2 legs as DraftKings had them then; a leg whose line DraftKings has moved or pulled since will not be on the slip, so check it before you bet.`
      && sh && sh.text.split('\n').includes('DraftKings betslip (opens the 2 legs as DraftKings had them):') && !promises(n3 + ' ' + sh.text + ' ' + q3.d.getElementById('pcDk').title) && !q3.d.querySelector('#pcDkNote li[data-pc-dkmiss]'),
      `with every leg on the slip, the note and Share link open "the 2 legs" as DraftKings had them, never all of them for sure ("${n3}")`);
    q3.d.getElementById('pcClose').click();
    /* one leg, and a leg priced on one side only: no fair chance, and why */
    q3.w.eval(`M.slip.legs = ${JSON.stringify([{ ...L_TO, other: null }])}; M.bookPrice = null; renderParlay();`);
    q3.d.getElementById('pFinish').click(); await sleep(20);
    const c3 = [...v3.querySelectorAll('.pc-chance > div')].map(txt), mm3 = q3.w.PARLAY_CARD.current();
    check(txt(v3.querySelector('.pc-title')) === '1-leg parlay' && c3[0] === `Model’s chance it lands 50.0% · the price says ${pctOwn(1 / decOf(-110))}` && c3[1] === 'No fair chance: a leg has only one of DraftKings’ two prices' && mm3.file === `parlay-${D2}-1leg.png`,
      `one leg priced on one side only: "1-leg parlay", the model's chance and the price's, and why there is no fair chance (${c3.join(' / ')}), the file ${mm3.file}`);
    q3.d.getElementById('pcClose').click();
    check(q3.errors.length === 0, 'no script errors: ' + q3.errors.join(' | '));
  }

  /* ---------- 8. a level's Finish, through a resolver its tab registers ---------- */
  {
    const q4 = load(ST(), { lines: LINES, mine: MINE([]) }); await sleep(400);
    const W4 = q4.w, D4 = q4.d;
    check(typeof W4.PARLAY_CARD.from === 'function' && W4.PARLAY_CARD.from('smoke', () => null) === true && W4.PARLAY_CARD.from('bad prefix', () => null) === false && W4.PARLAY_CARD.from('x', 'not a function') === false,
      'PARLAY_CARD.from registers a resolver for a prefix, and refuses a prefix with a space or a resolver that is no function');
    W4.eval(`PARLAY_CARD.from('smoke', id => id === ${JSON.stringify(G1.id + ':med')} ? { legs: [${JSON.stringify(L_ML)}, ${JSON.stringify(L_PL)}], kicker: 'Medium parlay · BOS at DET' } : id === 'none' ? { legs: [], kicker: 'x' } : null)`);
    const host = D4.createElement('div'); host.innerHTML = `<button type="button" id="spFin" data-pc-finish="smoke|${G1.id}:med">Finish</button><button type="button" id="spNone" data-pc-finish="smoke|none">Finish</button><button type="button" id="spWho" data-pc-finish="nobody|x">Finish</button>`;
    D4.getElementById('pbPanel').appendChild(host);
    D4.getElementById('spNone').click(); D4.getElementById('spWho').click(); await sleep(20);
    check(D4.getElementById('pcBack').hidden, 'a level with no legs, or a prefix nobody registered, opens nothing');
    const b4 = D4.getElementById('spFin'); b4.focus(); b4.click(); await sleep(20);
    const m4 = W4.PARLAY_CARD.current(), L4 = ordOwn([L_ML, L_PL]), O4 = priceOwn(L4), v4 = D4.getElementById('pcView');
    check(!D4.getElementById('pcBack').hidden && txt(v4.querySelector('.pc-kick')) === 'Medium parlay · BOS at DET' && D4.getElementById('pcAgain').hidden && txt(v4.querySelector('.pc-price')) === mlOwn(amOf(O4.dec))
      && [...v4.querySelectorAll('.pc-who')].map(txt).join('|') === L4.map(nameOwn).join('|') && txt(v4.querySelectorAll('.pc-money b')[1]) === moneyOwn(20 * O4.dec),
      `a level's Finish (data-pc-finish="smoke|<game>:med") opens the card on its legs in the builder's order, priced by the builder's own sums (${txt(v4.querySelector('.pc-price'))}), on the Bet amount, its kicker the level's, with no Start over`);
    D4.dispatchEvent(new W4.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    check(D4.getElementById('pcBack').hidden && D4.activeElement === b4, 'closing it gives the focus back to the level\'s Finish');
    /* the Parlay Builder's own levels (pbTierCard's default "pb|<level>") finish the same way */
    const tiers = W4.getPbTiers().tiers.filter(t => t.legs);
    if (tiers.length) { const t = tiers[0], h2 = D4.createElement('div'); h2.innerHTML = W4.pbTierCard(t); D4.getElementById('pbPanel').appendChild(h2);
      h2.querySelector(`[data-pc-finish="pb|${t.id}"]`).click(); await sleep(20);
      check(!D4.getElementById('pcBack').hidden && txt(D4.querySelector('#pcView .pc-kick')) === `${t.label} parlay` && Math.abs(W4.PARLAY_CARD.current().legs.length - t.legs.length) === 0 && txt(D4.querySelector('#pcView .pc-price')) === mlOwn(amOf(t.dec)),
        `a level card's Finish (pb|${t.id}) opens the card on that level at its own price`);
      W4.PARLAY_CARD.close(); }
    else check(false, 'the made-up games make a level to finish');
    /* with no resolver registered, the NFL hub's names: Suggested Parlays' window.spTier and the Elo picks' window.eloPicks */
    W4.eval(`window.spTier = id => id === 'g1:safe' ? { label: 'Safe', game: 'BOS at DET', legs: [${JSON.stringify(L_ML)}, ${JSON.stringify(L_PL)}] } : null;
      window.eloPicks = () => ({ tiers: [{ id: 'elo-med', label: 'Medium', p: 0.3125, legs: [${JSON.stringify(L_SP)}, ${JSON.stringify(L_TO)}] }] });`);
    const h3 = D4.createElement('div'); h3.innerHTML = '<button type="button" id="spT" data-pc-finish="sp|g1:safe">Finish</button><button type="button" id="eloT" data-pc-finish="elo|elo-med">Finish</button>'; D4.getElementById('pbPanel').appendChild(h3);
    D4.getElementById('spT').click(); await sleep(20);
    check(!D4.getElementById('pcBack').hidden && txt(D4.querySelector('#pcView .pc-kick')) === 'Safe parlay · BOS at DET' && txt(D4.querySelector('#pcView .pc-price')) === mlOwn(amOf(O4.dec)),
      "with no resolver registered, a Suggested Parlays level's Finish (sp|<game>:<level>) is read through window.spTier, as on the NFL hub");
    W4.PARLAY_CARD.close();
    D4.getElementById('eloT').click(); await sleep(20);
    const e4 = [...D4.querySelectorAll('#pcView .pc-chance > div')].map(txt);
    check(!D4.getElementById('pcBack').hidden && txt(D4.querySelector('#pcView .pc-kick')) === 'Medium Elo pick' && e4.some(t => t.startsWith('Elo says 31.3%')),
      `and an Elo pick's (elo|<level>) through window.eloPicks, its chance the Elo's (${e4.join(' / ')})`);
    W4.PARLAY_CARD.close();
    /* a page drawn before a game tipped off is redrawn, not finished */
    W4.eval('window.__stale = window.pbStale; window.pbStale = () => true;'); b4.click(); await sleep(20);
    check(D4.getElementById('pcBack').hidden, 'on a page drawn before a tip-off, a Finish redraws rather than opening a parlay nobody saw');
    W4.eval('window.pbStale = window.__stale;');
    check(q4.errors.length === 0, 'no script errors: ' + q4.errors.join(' | '));
  }

  /* ---------- 9. on a phone that can share a file: the share sheet leads, and takes the image ---------- */
  {
    const q5 = load(ST(), { lines: LINES, mine: MINE([L_ML, L_SP]) }); await sleep(400);
    const r5 = stubDraw(q5.w); let got = null;
    Object.defineProperty(q5.w.navigator, 'canShare', { value: x => !!x, configurable: true });
    Object.defineProperty(q5.w.navigator, 'share', { value: async x => { got = x; }, configurable: true });
    q5.d.getElementById('pFinish').click(); await sleep(20);
    const sh5 = q5.d.getElementById('pcShare');
    check(!sh5.hidden && /\bhot\b/.test(sh5.className) && !/\bhot\b/.test(q5.d.getElementById('pcDownload').className) && q5.d.activeElement === sh5 && q5.w.getComputedStyle(sh5).minHeight === '44px',
      'where the browser can share a file, Share or save to Photos shows and leads, and takes the focus');
    sh5.click(); for (let i = 0; i < 40 && !got; i++) await sleep(25);
    check(got && Array.isArray(got.files) && got.files.length === 1 && got.files[0].name === `parlay-${D1}-2legs.png` && got.files[0].type === 'image/png' && got.title === 'NBA Hub: 2-leg parlay' && !r5.clicks.length,
      'it hands the share sheet the image as a PNG file, titled for the parlay, and downloads nothing');
    check(q5.errors.length === 0, 'no script errors: ' + q5.errors.join(' | '));
  }
};
