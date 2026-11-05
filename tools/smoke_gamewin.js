/* A game's three windows, a section of the viewer smoke test (README "The game's three windows"): run by tools/smoke.js,
 * alone with
 *
 *   SMOKE_ONLY=gw node tools/smoke.js
 *
 * The NFL hub's Matchup, Mismatches and Team Stats buttons under a game's head card (its props/build/part3.js
 * gameWinBtns), each opening one small window, on this hub's numbers (app/parts/gamewin.html; the buttons and the
 * MISMATCH tags in app/nba_hub.html's Player props view). The built page boots in jsdom twice over:
 *   - on made-up games tomorrow (so it holds at any hour, any day of the season and the off-season): a props block whose
 *     opponent table and means are this file's own, the job's team stats and the Teams tab's columns made up with ties
 *     and gaps of every kind, a club with no game counted, a game with no projection, one whose opponent table is not
 *     published, a ledger that has failed and one on trial;
 *   - on the real state, one of its projected games moved to three hours from now: its team stats as published, else as
 *     publish.js would write them from today's files, and its opponent table as published, else as props.js's oppTable
 *     gives it on a replay of today's boxes.
 * Every number a window states is worked out here on its own: the team stats from data/teambox_<season>.jsonl,
 * data/games.csv and data/box_<season>.csv (the made-up ones from the published arrays), the Teams tab's ranks as its
 * table sorts, each mismatch's lift, spread and order from the published multipliers and means; never by calling the
 * page's functions. Then the buttons, the window's keys and focus (Escape, Close, a click outside, Tab kept inside, the
 * focus back on its button, also after the view has drawn itself again, and the window gone with its game's tip-off),
 * the MISMATCH tags on the player rows, the words a failed model may not use, the window before the job's next run
 * (each field missing), and nothing fetched or stored.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = async function gameWindows({ check, pageFile, ROOT }) {
  console.log('gw. A game\'s three windows');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => JSON.parse(JSON.stringify(x));
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const SEASON = REAL.season;
  const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const ymd = d => d.replace(/-/g, ''), tipAt = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };

  /* ---------- this file's own readings ---------- */
  const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)] || 'th');
  const sg0 = v => { const s = Math.abs(v).toFixed(0); return (s === '0' ? '' : v > 0 ? '+' : '−') + s; };
  const seasonNm = y => `${+y - 1}-${String(y).slice(2)}`;
  const dayNm = d => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { weekday: 'short', timeZone: 'UTC' });
  const dayNo = d => new Date(d + 'T12:00:00Z').toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
  const r1 = x => Math.round(x * 10) / 10, r4 = x => Math.round(x * 1e4) / 1e4;
  /* a column of the Teams tab ranked as its table sorts it: high to low, the file's order on a tie */
  const tabOwn = (teams, key, t) => { if (!teams[t] || !Number.isFinite(teams[t][key])) return null;
    const s = Object.entries(teams).map(([c, v], i) => ({ c, v: v[key], i })).filter(x => Number.isFinite(x.v)).sort((a, b) => b.v - a.v || a.i - b.i);
    return { v: teams[t][key], rank: s.findIndex(x => x.c === t) + 1, n: s.length }; };
  /* the NFL's bar split, this file's copy */
  const splitOwn = (x, y, lo) => {
    if (x === null || y === null || (x === 0 && y === 0)) return [0, 0];
    let left;
    if (lo) { const a = 1 / Math.max(x, 0.01), b = 1 / Math.max(y, 0.01); left = 100 * a / (a + b); }
    else { const base = Math.min(x, y, 0); left = (x - base) + (y - base) === 0 ? 50 : 100 * (x - base) / ((x - base) + (y - base)); }
    left = Math.round(left * 10) / 10; return [left, Math.round((100 - left) * 10) / 10]; };
  /* Team Stats' rows: key, label, 1 more is better, -1 fewer, 0 neither, signed, a percentage */
  const TS = [['pd', 'Point differential', 1, true], ['ppg', 'Points', 1], ['pa', 'Points allowed', -1], ['ortg', 'Offensive rating', 1], ['drtg', 'Defensive rating', -1], ['pace', 'Pace', 0],
    ['fg', 'Field goal %', 1, false, true], ['tp', 'Three-point %', 1, false, true], ['tpm', 'Threes made', 1], ['reb', 'Rebounds', 1], ['ast', 'Assists', 1], ['tov', 'Turnovers', -1], ['stl', 'Steals', 1], ['blk', 'Blocks', 1]];
  const fmtOwn = (v, sign, pc) => v === null ? '–' : (v < 0 ? '−' + Math.abs(v).toFixed(1) : (sign && v > 0 ? '+' : '') + v.toFixed(1)) + (pc ? '%' : '');
  /* the team stats from the files, this file's own reading of publish.js THE TEAM STATS' rules */
  function teamStatsOwn(season) {
    const csvRows = f => { const p = path.join(ROOT, 'data', f); if (!fs.existsSync(p)) return []; const [h, ...ls] = fs.readFileSync(p, 'utf8').trim().split('\n'); const cols = h.split(',');
      return ls.filter(Boolean).map(l => Object.fromEntries(l.split(',').map((v, i) => [cols[i], v]))); };
    const games = csvRows('games.csv'), off = require('./publish').offFinals(games, season);
    const box = {}, tbf = path.join(ROOT, 'data', `teambox_${season}.jsonl`);
    if (fs.existsSync(tbf)) fs.readFileSync(tbf, 'utf8').split('\n').forEach(l => { try { const o = JSON.parse(l); if (o && o.stats) box[`${o.game_id}|${o.team}`] = o.stats; } catch (e) { /* a line that is not JSON is passed over */ } });
    const pmin = {}; for (const r of csvRows(`box_${season}.csv`)) pmin[`${r.game_id}|${r.team}`] = (pmin[`${r.game_id}|${r.team}`] || 0) + Number(r.min || 0);
    const two = s => { const m = /^(\d+)-(\d+)$/.exec(String(s || '').trim()); return m ? [Number(m[1]), Number(m[2])] : null; };
    const side = s => { if (!s) return null; const fg = two(s['fieldGoalsMade-fieldGoalsAttempted']), tp = two(s['threePointFieldGoalsMade-threePointFieldGoalsAttempted']), ft = two(s['freeThrowsMade-freeThrowsAttempted']);
      const n = k => s[k] === undefined || s[k] === '' || isNaN(Number(s[k])) ? null : Number(s[k]);
      const tov = n('totalTurnovers') !== null ? n('totalTurnovers') : n('turnovers');
      const o = { fgm: fg && fg[0], fga: fg && fg[1], tpm: tp && tp[0], tpa: tp && tp[1], fta: ft && ft[1], orb: n('offensiveRebounds'), tov, reb: n('totalRebounds'), ast: n('assists'), stl: n('steals'), blk: n('blocks') };
      return Object.values(o).some(v => v === null || v === undefined) ? null : o; };
    const sum = {}; let through = null, counted = 0;
    for (const g of games) {
      if (Number(g.season) !== season || g.type !== 'REG' || g.status !== 'final' || off[g.game_id] === 'playin' || g.home_score === '' || g.away_score === '') continue;
      const h = side(box[`${g.game_id}|${g.home}`]), a = side(box[`${g.game_id}|${g.away}`]); if (!h || !a) continue;
      const est = x => x.fga - x.orb + x.tov + 0.44 * x.fta, poss = (est(h) + est(a)) / 2;
      const pm = Math.max(pmin[`${g.game_id}|${g.home}`] || 0, pmin[`${g.game_id}|${g.away}`] || 0), ots = pm > 0 ? Math.max(0, Math.round((pm - 240) / 25)) : 0;
      [[g.home, h, Number(g.home_score), Number(g.away_score)], [g.away, a, Number(g.away_score), Number(g.home_score)]].forEach(([t, x, f, ag]) => {
        const z = sum[t] = sum[t] || { g: 0, last: '', f: 0, a: 0, p: 0, m: 0, fgm: 0, fga: 0, tpm: 0, tpa: 0, reb: 0, ast: 0, tov: 0, stl: 0, blk: 0 };
        z.g += 1; z.last = g.date > z.last ? g.date : z.last; z.f += f; z.a += ag; z.p += poss; z.m += 48 + 5 * ots;
        ['fgm', 'fga', 'tpm', 'tpa', 'reb', 'ast', 'tov', 'stl', 'blk'].forEach(k => { z[k] += x[k]; }); });
      counted++; if (!through || g.date > through) through = g.date;
    }
    const val = (z, k) => ({ pd: (z.f - z.a) / z.g, ppg: z.f / z.g, pa: z.a / z.g, ortg: z.p ? 100 * z.f / z.p : null, drtg: z.p ? 100 * z.a / z.p : null, pace: z.m ? 48 * z.p / z.m : null,
      fg: z.fga ? 100 * z.fgm / z.fga : null, tp: z.tpa ? 100 * z.tpm / z.tpa : null, tpm: z.tpm / z.g, reb: z.reb / z.g, ast: z.ast / z.g, tov: z.tov / z.g, stl: z.stl / z.g, blk: z.blk / z.g })[k];
    const clubs = {}; for (const t of Object.keys(sum).sort()) clubs[t] = { g: sum[t].g, last: sum[t].last };
    for (const [k, , dir] of TS) {
      const list = Object.keys(sum).map(t => ({ t, v: val(sum[t], k) })).filter(x => x.v !== null);
      list.sort((x, y) => (dir < 0 ? r4(x.v) - r4(y.v) : r4(y.v) - r4(x.v)) || x.t.localeCompare(y.t));
      list.forEach((x, i) => { clubs[x.t][k] = [r1(x.v), i + 1]; });
    }
    return { v: 1, season, through, games: counted, clubs };
  }
  /* the game's mismatches, this file's own reading: each player of the game projected 20 minutes or more and not on its
     out lists, at his stat (points, rebounds, assists, threes) with the largest lift over its spread, the lift his mean
     less his mean over the opponent's published multiplier, the spread the square root of A x mean^B; positive lifts
     only, the top five, ties by the lift then the player's id */
  const MM_DEF = { pts: 'scoring defence', reb: 'rebounding defence', ast: 'assist defence', tpm: 'three-point defence' };
  const MM_NOUN = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes' }, MM_UNIT = { pts: 'pts', reb: 'reb', ast: 'ast', tpm: 'threes' };
  const NOTE_FAIL = 'From the props model\'s opponent adjustment; the model lost to DraftKings in its trial, so read these as context, not picks.';
  const NOTE_TRIAL = 'From the props model\'s opponent adjustment; the model is on trial against DraftKings, so read these as context, not picks.';
  const moreOwn = (ratio, noun) => { const p = 100 * (ratio - 1), a = Math.abs(p); return a < 0.05 ? `about as many ${noun} a minute as average` : `${a >= 0.5 ? Math.round(a) : a.toFixed(1)}% ${p > 0 ? 'more' : 'fewer'} ${noun} a minute than average`; };
  function mmOwn(st, g, top = 5) {
    const P = st.props, pg = P.games[g.id], cols = P.oppCols, at = k => P.layout.indexOf(k), V = P.dist.var;
    const outs = new Set([g.model.away, g.model.home].flatMap(s => (s.out || []).map(o => o.id)));
    const fail = !!(P.ledger && P.ledger.decision && P.ledger.decision.verdict === 'FAIL'), note = fail ? NOTE_FAIL : NOTE_TRIAL;
    const rows = [];
    for (const pid of Object.keys(pg.players)) { const r = pg.players[pid], team = r[1];
      if (r[3] < 20 || outs.has(pid) || (team !== g.away && team !== g.home)) continue;
      const opp = team === g.home ? g.away : g.home, tab = pg.opp[opp];
      const cand = ['pts', 'reb', 'ast', 'tpm'].map(k => { const e = tab[k], mu = r[at(k)], mult = e[cols.indexOf('mult')], lift = mu - mu / mult, sd = Math.sqrt(V[k][0] * Math.pow(Math.max(mu, 1e-9), V[k][1]));
        return { k, mu, lift, sd, z: lift / sd, ratio: e[cols.indexOf('ratio')], rank: e[cols.indexOf('rank')] }; }).filter(c => c.mu > 0 && c.lift > 0);
      if (!cand.length) continue;
      cand.sort((a, b) => b.z - a.z || b.lift - a.lift);
      rows.push({ pid, name: r[0], pos: r[2], team, opp, home: team === g.home, ...cand[0] });
    }
    rows.sort((a, b) => b.z - a.z || b.lift - a.lift || (a.pid < b.pid ? -1 : 1));
    return rows.slice(0, top).map((v, i) => { const n = i + 1, sz = (v.z >= 0 ? '+' : '−') + Math.abs(v.z).toFixed(2), vs = `vs ${v.opp} ${MM_DEF[v.k]} #${v.rank}`, proj = `${v.mu.toFixed(1)} ${MM_UNIT[v.k]}`;
      const sub = `${vs} (allows ${moreOwn(v.ratio, MM_NOUN[v.k])}). ${proj} projected (+${v.lift.toFixed(1)} from the matchup).`;
      const say = `${v.name} ${v.pos} ${v.team} ${v.home ? 'vs' : 'at'} ${v.opp} · ${sub}`;
      return { ...v, n, sz, sub, title: `Mismatch #${n} in this game: ${say} Ranked by that lift over the spread of his ${MM_NOUN[v.k]} at his projection, ${sz} of a standard deviation (${v.sd.toFixed(1)}). ${note}`, note }; });
  }

  /* ---------- the harness ---------- */
  function load(st, o = {}) {
    const html = fs.readFileSync(pageFile('index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
    const errors = [], requests = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
      beforeParse(w) {
        w.fetch = async (url, opt) => { url = String(url); requests.push(url);
          if (/state\.json/.test(url)) return { ok: true, status: 200, json: async () => clone(st) };
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
        w.scrollTo = () => {};
        if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
        w.localStorage.setItem('nba_hub_2027:tab', 'slate');
        if (o.mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(o.mine));
        w.addEventListener('error', e => errors.push(e.message));
      } });
    return { w: dom.window, d: dom.window.document, errors, requests };
  }
  const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
  const stored = w => JSON.stringify([dump(w.localStorage), dump(w.sessionStorage)]);
  const key = (w, el, k, shift) => { const e = new w.KeyboardEvent('keydown', { key: k, shiftKey: !!shift, bubbles: true, cancelable: true }); el.dispatchEvent(e); return e; };
  /* the view of a game, opened from its card on Tonight (its day chosen on the strip first) */
  async function openView(w, g) {
    const d = w.document, day = d.querySelector(`#days .day[data-d="${g.date}"]`); if (day && !day.classList.contains('on')) { day.click(); await sleep(20); }
    const b = d.querySelector(`main [data-props="${g.id}"]`); if (!b) return false;
    b.click(); await sleep(80); return !d.getElementById('ppBack').hidden;
  }
  const gwOpen = w => !w.document.getElementById('gwBack').hidden;
  async function press(w, kind) { const b = w.document.querySelector(`#ppBody [data-gp-pop="${kind}"]`); if (!b) return null; b.click(); await sleep(10); return b; }

  /* ---------- each window's numbers against this file's own ---------- */
  function holdStats(d, g, T, tag) {
    const bad = [], a = g.away, h = g.home, A = T && T.clubs[a], Hm = T && T.clubs[h];
    const body = d.getElementById('gwBody');
    if (!A || !Hm) return bad.concat(['holdStats is for two clubs with games']);
    let na = 0, nh = 0;
    for (const [k, , dir, sign, pc] of TS) {
      const row = body.querySelector(`[data-gw-srow="${k}"]`); if (!row) { bad.push(`${k}: no row`); continue; }
      const x = A[k] ? A[k][0] : null, y = Hm[k] ? Hm[k][0] : null;
      const ba = dir !== 0 && x !== null && y !== null && x !== y && (dir < 0 ? x < y : x > y), bh = dir !== 0 && x !== null && y !== null && x !== y && !ba;
      if (ba) na++; if (bh) nh++;
      for (const [t, c, b] of [[a, A[k], ba], [h, Hm[k], bh]]) { const v = row.querySelector(`[data-gw-sval="${t}"]`);
        const want = fmtOwn(c ? c[0] : null, sign, pc), wr = c ? '#' + c[1] : '';
        if (!v) { bad.push(`${k} ${t}: no value`); continue; }
        if (txt(v.querySelector('b')) !== want) bad.push(`${k} ${t}: "${txt(v.querySelector('b'))}" where ${want}`);
        if (txt(v.querySelector('[data-gw-srk]')) !== wr) bad.push(`${k} ${t}: rank "${txt(v.querySelector('[data-gw-srk]'))}" where ${wr}`);
        if (v.classList.contains('gw-better') !== b) bad.push(`${k} ${t}: marked ${v.classList.contains('gw-better')} where ${b}`); }
      const [pa, ph] = splitOwn(x, y, dir < 0), bars = [...row.querySelectorAll('.gw-shalf i')].map(i => i.style.width);
      if (bars.join() !== `${pa}%,${ph}%`) bad.push(`${k}: bars ${bars.join()} where ${pa}%,${ph}%`);
    }
    const sum = `${a} better on ${na}, ${h} on ${nh}`;
    if (txt(body.querySelector('[data-gw-tsum]')) !== sum) bad.push(`summary "${txt(body.querySelector('[data-gw-tsum]'))}" where "${sum}"`);
    const foot = `${seasonNm(T.season)} season${T.through ? ' through ' + dayNo(T.through) : ''}: ${a} ${A.g} game${A.g === 1 ? '' : 's'}, ${h} ${Hm.g} game${Hm.g === 1 ? '' : 's'}.`;
    if (txt(body.querySelector('[data-gw-basis]')) !== foot) bad.push(`foot "${txt(body.querySelector('[data-gw-basis]'))}" where "${foot}"`);
    if (!/0\.44 of free-throw attempts/.test((body.querySelector('[data-gw-basis]') || { title: '' }).title)) bad.push('the foot\'s title does not say how possessions are estimated');
    if (body.querySelectorAll('[data-gw-srow]').length !== TS.length) bad.push(`${body.querySelectorAll('[data-gw-srow]').length} rows where ${TS.length}`);
    return bad.map(s => `${tag}: ${s}`);
  }
  function holdUnits(d, g, teams, tag) {
    const bad = [], body = d.getElementById('gwBody'), m = g.model;
    const poss = (o, O, dd, D) => {
      const el = body.querySelector(`[data-gw-poss="${o}-${dd}"]`); if (!el) return bad.push(`${o} with the ball: no possession`);
      const nick = { BOS: 'Celtics', DET: 'Pistons', LAL: 'Lakers', GSW: 'Warriors', MIA: 'Heat', ORL: 'Magic' }[o];
      if (nick && txt(el.querySelector('.gw-uhd')) !== `${nick} possession`) bad.push(`${o}: title "${txt(el.querySelector('.gw-uhd'))}"`);
      const tint = O.offence === D.defence ? null : O.offence > D.defence ? 'off' : 'def';
      for (const [what, t, v, col] of [['off', o, O.offence, 'offence'], ['def', dd, D.defence, 'defence']]) {
        const b = el.querySelector(`[data-gw-unit="${what}:${t}"]`); if (!b) { bad.push(`${t} ${col}: no box`); continue; }
        if (txt(b.querySelector('.gw-lab')) !== `${t} ${col}`) bad.push(`${t} ${col}: label "${txt(b.querySelector('.gw-lab'))}"`);
        if (txt(b.querySelector('[data-gw-uval]')) !== sg0(v)) bad.push(`${t} ${col}: "${txt(b.querySelector('[data-gw-uval]'))}" where ${sg0(v)}`);
        const r = tabOwn(teams, col, t), want = r ? `Teams tab ${sg0(r.v) !== sg0(v) ? sg0(r.v) + ', ' : ''}${ord(r.rank)} of ${r.n}` : 'not on the Teams tab';
        if (txt(b.querySelector('.gw-urk')) !== want) bad.push(`${t} ${col}: "${txt(b.querySelector('.gw-urk'))}" where "${want}"`);
        if (b.classList.contains('gw-better') !== (tint === what)) bad.push(`${t} ${col}: tinted ${b.classList.contains('gw-better')} where ${tint === what}`);
      } };
    poss(g.away, m.away, g.home, m.home); poss(g.home, m.home, g.away, m.away);
    const parts = b => b ? [b.querySelector('.gw-lab'), b.querySelector('b'), b.querySelector('small')].map(txt).join(' | ') : 'none';
    for (const t of [g.away, g.home]) { const b = body.querySelector(`[data-gw-pace="${t}"]`), r = tabOwn(teams, 'pace', t), want = r ? `${t} | ${r.v.toFixed(1)} | ${ord(r.rank)} fastest of ${r.n}` : `${t} | – | not on the Teams tab`;
      if (parts(b) !== want) bad.push(`pace ${t}: "${parts(b)}" where "${want}"`); }
    const gp = body.querySelector('[data-gw-pace="game"]'), wg = `This game | ${Number.isFinite(m.pace) ? m.pace.toFixed(1) : '–'} | expected`;
    if (parts(gp) !== wg) bad.push(`the game's pace "${parts(gp)}" where "${wg}"`);
    return bad.map(s => `${tag}: ${s}`);
  }
  function holdMism(d, own, tag) {
    const bad = [], body = d.getElementById('gwBody'), lis = [...body.querySelectorAll('ul.gw-mm > li')];
    if (txt(body.querySelector('[data-gw-mmnote]')) !== own[0].note) bad.push(`note "${txt(body.querySelector('[data-gw-mmnote]'))}" where "${own[0].note}"`);
    if (lis.length !== own.length) bad.push(`${lis.length} rows where ${own.length}`);
    own.forEach((v, i) => { const li = lis[i]; if (!li) return;
      if (li.dataset.gwMm !== v.pid) bad.push(`#${v.n}: ${li.dataset.gwMm} where ${v.pid} (${v.name})`);
      if (txt(li.querySelector('.gw-mmn')) !== `#${v.n}`) bad.push(`#${v.n}: numbered "${txt(li.querySelector('.gw-mmn'))}"`);
      const who = `${v.name} ${v.pos}${v.team}${v.home ? 'vs' : 'at'}${v.opp}`;
      if (txt(li.querySelector('.gw-mmwho')).replace(/\s/g, '') !== who.replace(/\s/g, '')) bad.push(`#${v.n}: "${txt(li.querySelector('.gw-mmwho'))}" where "${who}"`);
      if (txt(li.querySelector('[data-gw-mmsub]')) !== v.sub) bad.push(`#${v.n}: "${txt(li.querySelector('[data-gw-mmsub]'))}" where "${v.sub}"`);
      if (txt(li.querySelector('[data-gw-z]')) !== `${v.sz}SD`) bad.push(`#${v.n}: "${txt(li.querySelector('[data-gw-z]'))}" where "${v.sz}SD"`);
      if (txt(li.querySelector('.gw-mmtag')) !== 'Mismatch') bad.push(`#${v.n}: no Mismatch tag`);
      if (li.title !== v.title) bad.push(`#${v.n}: title "${li.title}" where "${v.title}"`); });
    return bad.map(s => `${tag}: ${s}`);
  }
  /* the MISMATCH tags on the view's player rows: exactly the game's top five, each titled with its row and numbered, and
     said in the row's name */
  function holdTags(d, own, tag) {
    const bad = [], want = new Map(own.map(v => [v.pid, v]));
    for (const plr of d.querySelectorAll('#ppBody .pp-plr[data-pp-player]')) {
      const pid = plr.dataset.ppPlayer, tg = plr.querySelectorAll('.pp-mmtag'), v = want.get(pid), btn = plr.querySelector('[data-pp-open]');
      if (!v) { if (tg.length) bad.push(`${pid}: a tag, not in the top five`); if (btn && /mismatch/i.test(btn.getAttribute('aria-label'))) bad.push(`${pid}: named a mismatch`); continue; }
      want.delete(pid);
      if (tg.length !== 1) { bad.push(`${v.name}: ${tg.length} tags`); continue; }
      if (tg[0].title !== v.title) bad.push(`${v.name}: tag titled "${tg[0].title}" where "${v.title}"`);
      if (tg[0].dataset.ppMm !== String(v.n) || txt(tg[0]) !== 'Mismatch') bad.push(`${v.name}: tag ${tg[0].dataset.ppMm} "${txt(tg[0])}"`);
      if (!btn || !btn.getAttribute('aria-label').includes(`, mismatch #${v.n} in this game`)) bad.push(`${v.name}: the row's name does not say mismatch #${v.n}`);
      const nm = plr.querySelector('.who .nm'); if (!nm || nm.nextElementSibling !== tg[0]) bad.push(`${v.name}: the tag is not beside his name`);
    }
    for (const v of want.values()) bad.push(`${v.name}: no row`);
    return bad.map(s => `${tag}: ${s}`);
  }
  const WORDS = /\bedges?\b|\bvalue\b|model says/i;
  const wordsIn = el => [txt(el), ...[...el.querySelectorAll('[title]')].map(x => x.title), el.title || ''].join(' | ');

  /* ---------- 1. made-up games tomorrow ---------- */
  const now = Date.now(), H = 3600e3;
  const D1 = addDay(etDate(now), 1), T1 = Date.parse(D1 + 'T23:00:00Z');
  check(etDate(T1) === D1 && D1 > etDate(now), `gw: the made-up games are tomorrow (${D1})`);
  const gid = (a, h) => `${SEASON}_${ymd(D1)}_${a}_${h}`;
  const side = (t, o, d, out) => ({ team: t, strength: 1500, offence: o, defence: d, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
  const game = (a, h, model) => ({ id: gid(a, h), date: D1, tip: tipAt(T1), type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '', tv: [], awayScore: null, homeScore: null, line: null, totalLine: null, ml: null,
    model: { pHome: 0.5, spread: 0, total: 225, pace: 99.4, ...model }, team: { pHome: 0.5 } });
  /* BOS at DET: tonight's lineups' ratings apart from the Teams tab's (so the tab's own figure is said), BOS with the ball
     tinted on its offence, DET with the ball on BOS's defence; DET's report has one projected player out */
  const G = game('BOS', 'DET', { pace: 100.6, away: side('BOS', 12.4, 9.6), home: side('DET', 5.2, 7.9, [{ id: '9300008', name: 'Det Out', status: 'Out', min: 30, costs: 20 }]) });
  /* LAL at GSW: level ratings (no tint), GSW with no game counted, its opponent table not published; MIA at ORL: no
     projection at all, neither club counted; PHX at SAC: no board numbers */
  const G2 = game('LAL', 'GSW', { pace: 98, away: side('LAL', 3, 3), home: side('GSW', 3, 3) });
  const G3 = game('MIA', 'ORL', { away: side('MIA', 1, 2), home: side('ORL', -4, 6) });
  const G4 = { ...game('PHX', 'SAC', {}), model: null };
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'];
  const VAR = { pts: [7.6017, 0.7213], reb: [1.6148, 0.9528], ast: [1.3344, 0.9826], tpm: [1.2473, 0.9867], stl: [1.1, 0.97], blk: [1.13, 1.01], pra: [10.65, 0.65], pr: [8.8, 0.7], pa: [8.7, 0.67], ar: [2.41, 0.83], sb: [1.19, 0.85] };
  const row = (name, team, pos, min, pts, reb, ast, tpm) => [name, team, pos, min, pts, reb, ast, tpm, 1, 0.5, 0.1, 0.01];
  /* BOS's players face DET's defence and DET's face BOS's: eight qualify for a lift, so the top five cut three; two of
     them alike to the digit (ranked by id); one at 19.9 minutes and one out, each with a lift that would put him in the
     top five were he counted; one whose every lift is below zero */
  const PLAYERS = {
    '9300001': row('Bos Star', 'BOS', 'F', 36, 27.4, 8.1, 4.6, 3.1), '9300002': row('Bos Guard', 'BOS', 'G', 33, 18.2, 3.9, 7.4, 2.6),
    '9300003': row('Bos Center', 'BOS', 'C', 29, 12.5, 10.6, 2.1, 0.2), '9300004': row('Bos Twin B', 'BOS', 'G', 24, 9.3, 2.8, 3.1, 2.9),
    '9300005': row('Bos Twin A', 'BOS', 'G', 24, 9.3, 2.8, 3.1, 2.9), '9300006': row('Bos Bench', 'BOS', 'F', 19.9, 8.8, 4.1, 1.2, 4.0),
    '9300007': row('Det Star', 'DET', 'G', 35, 24.9, 4.4, 8.6, 2.3), '9300008': row('Det Out', 'DET', 'F', 30, 15.5, 12, 2.5, 1.4),
    '9300009': row('Det Big', 'DET', 'C', 31, 14.1, 11.9, 2.8, 0.1), '9300010': row('Det Wing', 'DET', 'F', 27, 11.6, 4.8, 1.9, 2.4),
    '9300012': row('Det Shooter', 'DET', 'G', 22, 10.2, 0, 1.5, 2.2) };
  /* [ratio, mult, rank]: DET's defence (BOS's players) leaks points and threes; BOS's (DET's players) rebounds only */
  const tab = (pts, reb, ast, tpm) => Object.fromEntries([['pts', pts], ['reb', reb], ['ast', ast], ['tpm', tpm], ['stl', [1, 1, 15]], ['blk', [1, 1, 15]]]);
  const OPP = { DET: tab([1.0612, 1.0612, 27], [1.0187, 1.014, 21], [0.9721, 0.9721, 6], [1.1048, 1.0777, 30]), BOS: tab([0.9531, 0.9531, 2], [1.0702, 1.0522, 28], [0.9902, 0.9902, 11], [0.998, 0.9985, 14]) };
  const LEDGER_FAIL = { registered: '2026-10-15T11:35Z', bar: { lines: 30000 }, decision: { verdict: 'FAIL', decidedAt: '2026-11-05T19:16Z', lines: 12298, games: 121, scores: { logloss_diff: 0.018, brier_diff: 0.008 }, flat: { all: { bets: 900, units: -223 } }, early: { at: '2026-11-05T19:16Z', by: 'the owner', why: 'test' } },
    summary: { standing: '', gradedGames: 121, lines: 12298, voids: 0, scores: null, flat: null, toCome: 0 } };
  const props = (decision = true) => ({ onTrial: true, build: 'test', asOf: D1, fitSeasons: '2023-2026', horizonGameDays: 5, minShown: 8, stats: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'],
    combos: { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] }, layout: LAY, oppCols: ['ratio', 'mult', 'rank'], dist: { kind: 'negative binomial', var: VAR }, fair: require('./props').FAIR,
    ledger: decision ? clone(LEDGER_FAIL) : { ...clone(LEDGER_FAIL), decision: null }, research: null,
    games: { [G.id]: { tip: G.tip, away: 'BOS', home: 'DET', players: clone(PLAYERS), opp: clone(OPP) }, [G2.id]: { tip: G2.tip, away: 'LAL', home: 'GSW', players: { '9300011': row('Lal Guard', 'LAL', 'G', 34, 22, 4, 6, 2.5) } } } });
  /* the job's team stats: BOS and DET with level values (no mark), every kind of row; LAL alone of its game */
  const tsRow = vals => Object.fromEntries(TS.map(([k], i) => [k, vals[i]]));
  const TSTATS = { v: 1, season: SEASON, through: addDay(D1, -2), games: 120, clubs: {
    BOS: { g: 8, last: addDay(D1, -2), ...tsRow([[4.6, 7], [117.3, 6], [112.7, 12], [116.1, 4], [111.5, 10], [99.6, 15], [47.8, 5], [37.4, 6], [14.9, 3], [44.1, 13], [27.2, 5], [13.1, 8], [8.1, 14], [5.2, 9]]) },
    DET: { g: 7, last: addDay(D1, -3), ...tsRow([[-2.3, 19], [111.0, 21], [113.3, 15], [108.4, 22], [110.6, 8], [103.4, 3], [46.0, 16], [35.1, 22], [11.9, 25], [46.8, 4], [24.3, 20], [15.8, 25], [8.1, 13], [6.4, 2]]) },
    LAL: { g: 1, last: addDay(D1, -9), ...tsRow([[-12, 30], [101, 30], [113, 16], [99.1, 30], [110.8, 9], [101.5, 9], [41.2, 30], [28.6, 30], [9, 30], [39, 30], [19, 30], [18, 30], [5, 30], [2, 30]]) } } };
  /* the Teams tab's columns: the published ones, with BOS's offence level with the first club's in the file (so the file's
     order breaks the tie) and the four clubs' own figures planted */
  const TEAMS0 = clone(REAL.teams), first = Object.keys(TEAMS0).find(t => !['BOS', 'DET', 'LAL', 'GSW', 'MIA', 'ORL'].includes(t));
  Object.assign(TEAMS0.BOS, { offence: TEAMS0[first].offence, defence: 4.2, pace: 99.9 }); Object.assign(TEAMS0.DET, { offence: 5.2, defence: 8.1, pace: 103.2 });
  Object.assign(TEAMS0.LAL, { offence: -45.5, defence: -1, pace: 97.4 }); Object.assign(TEAMS0.GSW, { offence: 3.4, defence: 2.6, pace: 101.1 });
  const ST = (o = {}) => ({ ...clone(REAL), today: etDate(now), generated: new Date(now - 3 * H).toISOString().slice(0, 16) + 'Z', injuriesAsOf: etDate(now), slate: [G, G2, G3, G4].map(clone), props: props(true), teamStats: clone(TSTATS), teams: clone(TEAMS0), ...o });

  {
    const st = ST(), own = mmOwn(st, G);
    const qual = mmOwn(st, G, 99);
    check(own.length === 5 && own.some(v => v.pid === '9300004') && own.findIndex(v => v.pid === '9300004') + 1 === own.findIndex(v => v.pid === '9300005') && !own.some(v => ['9300006', '9300008', '9300012', '9300003', '9300010', '9300007'].includes(v.pid)) && qual.length === 8,
      `gw: the made-up game's top five of the ${qual.length} with a lift are worked here (${own.map(v => `${v.name} ${v.k} ${v.sz}`).join(', ')}): the twins in id order, three who have one cut, the bench player under 20 minutes, the player out and the one with no lift left out`);
    const { w, d, errors, requests } = load(st);
    await sleep(350);
    check(await openView(w, G), 'gw: the made-up game\'s Player props view opens from its card');
    await sleep(60);
    const before = stored(w), nReq = requests.length;
    /* the buttons */
    const head = d.querySelector('#ppBody [data-pp-head]'), grp = head && head.nextElementSibling, bs = grp ? [...grp.querySelectorAll('button')] : [];
    check(!!grp && grp.matches('div.gwin[role="group"][aria-label="More on this game"]') && bs.map(b => `${b.dataset.gpPop}:${txt(b)}`).join() === 'units:Matchup,mism:Mismatches,stats:Team Stats'
      && bs.every(b => b.matches('button.btn.quiet.gwin-btn[type="button"][aria-haspopup="dialog"]') && b.dataset.gpGame === G.id),
      `gw: under the game's head card, the NFL's three buttons, Matchup, Mismatches and Team Stats, each opening a dialog (${grp ? grp.outerHTML.slice(0, 160) : 'none'})`);
    const css = [...d.querySelectorAll('style')].map(s => s.textContent).join('\n');
    check(/\.gwin \.gwin-btn\{min-height:44px/.test(css) && /\.gw-close\{[^}]*min-height:44px/.test(css), 'gw: the three buttons and the window\'s Close are 44px tall');
    /* Team Stats */
    let b = await press(w, 'stats');
    const sheet = d.getElementById('gwSheet');
    check(gwOpen(w) && sheet.getAttribute('role') === 'dialog' && sheet.getAttribute('aria-modal') === 'true' && sheet.getAttribute('aria-labelledby') === 'gwSub gwTm'
      && txt(d.getElementById('gwSub')) === `Team Stats · ${dayNm(D1)}, ${dayNo(D1)}` && txt(d.getElementById('gwTm')) === 'BOSatDET' && d.activeElement === d.getElementById('gwClose'),
      `gw: Team Stats opens a dialog labelled "${txt(d.getElementById('gwSub'))}" and "${txt(d.getElementById('gwTm'))}", the focus on its Close`);
    let bad = holdStats(d, G, st.teamStats, 'made-up');
    check(!bad.length, `gw: Team Stats states every value, rank, mark, bar, the count and the foot as the job's stats give them${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
    check(['pace'].every(k => !d.querySelector(`[data-gw-srow="${k}"] .gw-better`)) && !d.querySelector('[data-gw-srow="stl"] .gw-better'), 'gw: pace marks neither side, nor does a level row (steals 8.1 and 8.1)');
    /* Escape: the window closes, the view stays, the focus back on its button */
    key(w, d.getElementById('gwClose'), 'Escape');
    check(!gwOpen(w) && !d.getElementById('ppBack').hidden && d.activeElement === b, `gw: Escape closes the window, not the view, and the focus is back on Team Stats (${d.activeElement && (d.activeElement.dataset.gpPop || d.activeElement.id)})`);
    /* Matchup */
    b = await press(w, 'units');
    bad = holdUnits(d, G, st.teams, 'made-up BOS at DET');
    check(!bad.length, `gw: Matchup states each side with the ball, its ratings, the Teams tab's ranks and figures, the tint and the pace as worked here${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
    check(txt(d.getElementById('gwSub')) === `Matchup · ${dayNm(D1)}, ${dayNo(D1)}`, 'gw: the Matchup window is so named');
    /* the keys: Tab and Shift+Tab kept inside (Close the only control), the sheet itself sending Tab to it */
    const tab1 = key(w, d.getElementById('gwClose'), 'Tab'), tab2 = key(w, d.getElementById('gwClose'), 'Tab', true);
    sheet.focus(); const tab3 = key(w, sheet, 'Tab');
    check(tab1.defaultPrevented && tab2.defaultPrevented && tab3.defaultPrevented && d.activeElement === d.getElementById('gwClose'), 'gw: Tab and Shift+Tab stay inside the window');
    /* a click inside keeps it open; one on the backdrop closes it, the focus back on Matchup */
    d.getElementById('gwBody').click(); await sleep(5);
    const stillOpen = gwOpen(w);
    d.getElementById('gwBack').dispatchEvent(new w.MouseEvent('click', { bubbles: true })); await sleep(5);
    check(stillOpen && !gwOpen(w) && !d.getElementById('ppBack').hidden && d.activeElement === b, 'gw: a click inside leaves the window open; a click outside closes it, the focus back on Matchup');
    /* Mismatches */
    b = await press(w, 'mism');
    bad = holdMism(d, own, 'made-up');
    check(!bad.length, `gw: Mismatches lists the game's top five as worked here, each row's numbers and words, the failed model's note${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
    check(!WORDS.test(wordsIn(sheet)), `gw: no word of edge, value or model says in the window, its titles included (${(wordsIn(sheet).match(WORDS) || [''])[0]})`);
    /* Close, the focus back */
    d.getElementById('gwClose').click(); await sleep(5);
    check(!gwOpen(w) && d.activeElement === b && d.getElementById('gwBody').innerHTML === '', 'gw: Close closes it, the focus back on Mismatches');
    /* the tags on the rows */
    bad = holdTags(d, own, 'made-up');
    check(!bad.length, `gw: the five, and only they, wear MISMATCH beside their names, titled with their rows${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
    const tagWords = [...d.querySelectorAll('.pp-mmtag')].map(t => t.title).join(' ');
    check(!WORDS.test(tagWords), 'gw: no tag\'s title says edge, value or model says');
    const t0 = d.querySelector('.pp-mmtag'); t0.click(); await sleep(30);
    const openRow = d.querySelector(`[data-pp-open="${own[0].pid}"]`);
    check(!!openRow && openRow.getAttribute('aria-expanded') === 'true', 'gw: a tap on a tag opens its player\'s row');
    /* the view draws itself again with the window open: closing puts the focus on the button as drawn now */
    b = await press(w, 'units');
    w.propsDraw(); await sleep(5);
    const nb = d.querySelector('#ppBody [data-gp-pop="units"]');
    check(gwOpen(w) && nb !== b && !d.contains(b), 'gw: a redraw of the view under an open window draws its buttons anew');
    key(w, d.getElementById('gwClose'), 'Escape');
    check(d.activeElement === nb, `gw: closed after the redraw, the focus is on Matchup as drawn now (${d.activeElement && (d.activeElement.dataset.gpPop || d.activeElement.id)})`);
    check(stored(w) === before && requests.length === nReq, 'gw: nothing stored and nothing fetched by the windows');
    /* the game tips off under an open window: it closes, the focus on the view's Close */
    await press(w, 'stats');
    w.eval(`S.slate.find(g => g.id === ${JSON.stringify(G.id)}).status = 'live'`); w.propsDraw(); await sleep(5);
    check(!gwOpen(w) && d.activeElement === d.getElementById('ppClose') && !d.querySelector('#ppBody .gwin'), 'gw: a window over a game that tips off closes with its buttons, the focus on the view\'s Close');
    check(errors.length === 0, 'gw: no script errors: ' + errors.join(' | '));
  }
  /* LAL at GSW: GSW with no game counted, no opponent table, level ratings; MIA at ORL: no projection, neither club
     counted; PHX at SAC: no board numbers */
  {
    const st = ST();
    const { w, d, errors } = load(st);
    await sleep(350);
    check(await openView(w, G2), 'gw: LAL at GSW\'s view opens');
    await press(w, 'stats');
    const body = () => d.getElementById('gwBody');
    const lal = TSTATS.clubs.LAL;
    check(txt(body().querySelector('[data-gw-none]')) === 'No game counted yet this season: GSW.' && txt(body().querySelector('[data-gw-tsum]')) === 'LAL better on 0, GSW on 0'
      && txt(body().querySelector('[data-gw-srow="pd"] [data-gw-sval="LAL"] b')) === fmtOwn(lal.pd[0], true) && txt(body().querySelector('[data-gw-srow="pd"] [data-gw-sval="GSW"] b')) === '–'
      && txt(body().querySelector('[data-gw-basis]')) === `${seasonNm(SEASON)} season through ${dayNo(TSTATS.through)}: LAL 1 game, GSW 0 games.`,
      `gw: a club with no game counted is said so, its side a dash, nothing marked (${txt(body().querySelector('[data-gw-none]'))})`);
    d.getElementById('gwClose').click();
    await press(w, 'mism');
    check(txt(body()) === 'The props model\'s opponent adjustment is not published for this game yet: the job adds it on its next run.', `gw: Mismatches before the job has published the game's opponent table says so (${txt(body())})`);
    d.getElementById('gwClose').click();
    await press(w, 'units');
    const bad = holdUnits(d, G2, st.teams, 'made-up LAL at GSW');
    check(!bad.length && !body().querySelector('.gw-better'), `gw: level ratings tint neither box; LAL's offence at −45.5 is drawn as the Teams tab rounds it${bad.length ? ': ' + bad.join('; ') : ''}`);
    d.getElementById('gwClose').click();
    w.propsClose(); await sleep(10);
    check(await openView(w, G3), 'gw: MIA at ORL\'s view opens');
    await press(w, 'stats');
    check(txt(body()) === 'Neither club has a game counted yet this season.', `gw: neither club counted: said so (${txt(body())})`);
    d.getElementById('gwClose').click();
    await press(w, 'mism');
    const ng = `No projection for this game yet: the model projects the regular season and the playoffs, the next ${st.props.horizonGameDays} game days.`;
    check(txt(body()) === ng, `gw: a game with no projection says why, as the view does (${txt(body())})`);
    d.getElementById('gwClose').click(); w.propsClose(); await sleep(10);
    check(await openView(w, G4), 'gw: PHX at SAC\'s view opens');
    await press(w, 'units');
    check(txt(body()) === 'The board model has no ratings for this game\'s lineups yet.', `gw: a game with no board numbers says so (${txt(body())})`);
    d.getElementById('gwClose').click();
    check(errors.length === 0, 'gw: no script errors: ' + errors.join(' | '));
  }
  /* before the job's next run: no teamStats, no oppCols or opp, and the model on trial (its note says so) */
  {
    const st = ST({ teamStats: undefined, props: { ...props(false) } });
    delete st.teamStats; delete st.props.games[G.id].opp; delete st.props.oppCols;
    const { w, d, errors } = load(st);
    await sleep(350);
    check(await openView(w, G), 'gw: the view opens on a state written before the windows\' fields');
    const body = () => d.getElementById('gwBody');
    await press(w, 'stats');
    check(txt(body()) === 'The team stats are not published yet: the job writes them on its next run.', `gw: Team Stats before the job's next run says so (${txt(body())})`);
    d.getElementById('gwClose').click();
    await press(w, 'mism');
    check(txt(body()) === 'The props model\'s opponent adjustment is not published for this game yet: the job adds it on its next run.' && !d.querySelector('#ppBody .pp-mmtag'), `gw: Mismatches before it says so, and no row wears a tag (${txt(body())})`);
    d.getElementById('gwClose').click();
    check(errors.length === 0, 'gw: no script errors: ' + errors.join(' | '));
    /* on trial, with the table: the note says the model is on trial */
    const st2 = ST({ props: props(false) }), own2 = mmOwn(st2, G);
    const L2 = load(st2); await sleep(350);
    check(await openView(L2.w, G), 'gw: the view opens with the model on trial');
    await press(L2.w, 'mism');
    const bad = holdMism(L2.d, own2, 'on trial');
    check(!bad.length && own2[0].note === NOTE_TRIAL, `gw: on trial, the same five and the trial's note${bad.length ? ': ' + bad.slice(0, 4).join('; ') : ''}`);
    check(L2.errors.length === 0, 'gw: no script errors: ' + L2.errors.join(' | '));
    /* another season's stats */
    const st3 = ST({ teamStats: { ...clone(TSTATS), season: SEASON - 1 } }), L3 = load(st3); await sleep(350);
    await openView(L3.w, G); await press(L3.w, 'stats');
    check(txt(L3.d.getElementById('gwBody')) === `The team stats are the ${seasonNm(SEASON - 1)} season's; this game is in the ${seasonNm(SEASON)} season.`, `gw: last season's stats are not shown as this game's (${txt(L3.d.getElementById('gwBody'))})`);
  }

  /* ---------- 2. the real state: one of its projected games, three hours from now ---------- */
  {
    const PJ = require('./props'), PUB = require('./publish'), L = require('./lib');
    const RP = REAL.props || {}, pgids = Object.keys(RP.games || {}).filter(id => REAL.slate.some(g => g.id === id && g.model && g.model.away && g.model.home));
    if (!pgids.length) check(true, 'gw: the real state projects no game (off-season): the made-up games above hold the windows');
    else {
      const id = pgids[0], g0 = REAL.slate.find(g => g.id === id), tip = now + 3 * H;
      const g = { ...clone(g0), date: etDate(tip), tip: tipAt(tip), status: 'scheduled', awayScore: null, homeScore: null };
      const st = { ...clone(REAL), slate: [g], props: clone(RP) };
      /* the team stats as published, else as publish.js writes them from today's files; held to this file's own reading of
         the files either way */
      const pubTS = !!REAL.teamStats;
      if (!pubTS) st.teamStats = PUB.teamStatsState(L.readGames(), REAL.season);
      const ownTS = teamStatsOwn(REAL.season);
      check(JSON.stringify(st.teamStats) === JSON.stringify(ownTS), `gw: the ${pubTS ? 'published' : 'job\'s'} team stats are this file's own reading of the team boxes, scores and box minutes (${Object.keys(ownTS.clubs).length} clubs, ${ownTS.games} finals through ${ownTS.through})`);
      /* the opponent table as published, else as props.js's oppTable gives it on a replay of today's boxes */
      const pubOpp = !!(RP.games[id].opp && RP.oppCols);
      if (!pubOpp) { const R = PJ.replay(PJ.loadGames(), PJ.loadBoxes(), PJ.loadTeamBoxes(), {}), P = JSON.parse(fs.readFileSync(path.join(ROOT, 'props.json'), 'utf8')).params, season = +id.slice(0, 4);
        const D = PJ.oppTable(t => { const a = R.allowed[t]; if (!a || a.season === season) return a; return { m: a.m * 0.5, y: Object.fromEntries(PJ.STATS.map(k => [k, a.y[k] * 0.5])) }; }, R.lgAll, P.opp);
        st.props.oppCols = ['ratio', 'mult', 'rank']; st.props.games[id].opp = Object.fromEntries([g.away, g.home].map(t => [t, Object.fromEntries(PJ.STATS.map(k => [k, [D[t][k].ratio, D[t][k].mult, D[t][k].rank]]))])); }
      const own = mmOwn(st, g);
      const { w, d, errors } = load(st);
      await sleep(400);
      check(await openView(w, g), `gw: the real game ${g.away} at ${g.home}'s view opens`);
      if (ownTS.clubs[g.away] && ownTS.clubs[g.home]) { await press(w, 'stats');
        const bad = holdStats(d, g, st.teamStats, `real ${g.away} at ${g.home}`);
        check(!bad.length, `gw: on the real files, Team Stats states every value and rank as worked here from the team boxes (${txt(d.querySelector('[data-gw-tsum]'))})${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
        d.getElementById('gwClose').click(); }
      else check(true, `gw: ${g.away} or ${g.home} has no game counted yet: the made-up stats above hold the window`);
      await press(w, 'units');
      let bad = holdUnits(d, g, st.teams, `real ${g.away} at ${g.home}`);
      check(!bad.length, `gw: on the real state, Matchup states the board's ratings, the Teams tab's ranks and the pace as worked here${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
      d.getElementById('gwClose').click();
      await press(w, 'mism');
      if (own.length) {
        bad = holdMism(d, own, `real ${g.away} at ${g.home}`).concat(holdTags(d, own, 'real tags'));
        check(!bad.length && !WORDS.test(wordsIn(d.getElementById('gwSheet'))), `gw: on the real projections and the ${pubOpp ? 'published' : 'job\'s'} opponent table, the top five as worked here (${own.map(v => `${v.name} ${v.k} ${v.sz}`).join(', ')}), their rows and tags${bad.length ? ': ' + bad.slice(0, 6).join('; ') : ''}`);
      } else check(/No player projected 20 minutes or more gets a lift/.test(txt(d.getElementById('gwBody'))), 'gw: on the real game no player gets a lift, and the window says so');
      d.getElementById('gwClose').click();
      check(errors.length === 0, 'gw: no script errors: ' + errors.join(' | '));
    }
  }
};
