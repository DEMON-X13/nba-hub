/* The test of tools/suggest_ledger.js and tools/suggest_check.js: the suggestions record taken, rewritten, locked,
 * replaced and graded on made-up days, and the guard that refuses a ledger whose locked entries moved.
 *
 *   node tools/test_suggest_ledger.js      ends "N checks passed"; exit 1 otherwise (about a minute; needs jsdom)
 *
 * Each run is the script itself, as the job runs it, on the built page (index.html) with a state.json, lines.json and box
 * file of this test's own in a scratch folder (SUGGEST_ROOT), the clock set (SUGGEST_NOW), never the real ledger (G alone
 * runs it on a copy of it). The made-up days are in November of the season in play, every game's id, tip-off and line
 * made up, so the test holds in any phase of a season and at any hour. Which games are featured (a game on national TV,
 * never a preseason one) and every settlement are worked out here on their own, from the made-up networks, scores and
 * box lines, never by the page or the script.
 *
 *   A  the morning of D1: a set taken for every featured game of the lines feed's two dates (D1 and D2), none for a game
 *      on local TV only, a preseason game on national TV, or a featured game on D3; keyed season|date|tip|game, locking 2
 *      hours before tip-off, its networks kept, every leg its own game's, every level its size.
 *   B  hours later, the first game's player props gone: its set rewritten; a game moved off national TV dropped; one moved
 *      onto it before its lock taken. B2: the same again writes nothing. B3: a second before the first game's lock, the
 *      props back: rewritten (live to its lock).
 *   C  an hour after that lock, the prices moved: the set stays as B3 left it, to the byte, though the page would now build
 *      another; a game moved onto national TV after its lock gets no entry.
 *   R  half an hour later, a player on one locked level listed on the injury report: that level alone built again,
 *      marked updated and recorded in updates, the other levels as locked. R2: the same again writes nothing. R3: after
 *      tip-off, another player listed: nothing changes but the grade.
 *   D  the night played out, with made-up locked entries planted beside the real ones to hold every rule of a book's
 *      settlement, each level graded by its legs' own results worked out here: a moneyline, a spread pushing on a whole
 *      line, a total, a player's line from the state's box lines and one from the season's box file (older than the
 *      state's week), a player with no box line void, a push and a void dropping out (the one leg left paid its own price,
 *      two legs of the game paid at the same-game price tools/corr.js gives), every leg a push or void a push; a box not
 *      read yet pending; a grade kept when the state can no longer settle it; last season's entry never regraded; a
 *      game's level under two tip-offs counted once, from the last; the summary worked out here; the next day's set.
 *   E  no featured game to come: nothing taken (E2: nothing written).
 *   F  the guard: a ledger on disk whose locked set was edited refused and the last commit's put back; an unlocked set
 *      rewritten since that commit, and a locked level an earlier run replaced, not refused; a state that is not there
 *      refused with the file untouched; and check() on hand-made ledgers failing every rule.
 *   G  the real ledger, copied, on the real state and lines.json at the real clock: nothing refused.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(__dirname, 'suggest_ledger.js'), CHECK = path.join(__dirname, 'suggest_check.js');
const SC = require('./suggest_check'), PJ = require('./props'), CJ = require('./corr'), PUB = require('./publish');
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest_ledger_'));
const LEDGER = path.join(DIR, 'ledger.json');
fs.mkdirSync(path.join(DIR, 'data'), { recursive: true });
fs.copyFileSync(path.join(ROOT, 'index.html'), path.join(DIR, 'index.html'));

let n = 0; const fails = [];
const chk = (ok, msg) => { n++; if (!ok) fails.push(msg); };
const clone = x => JSON.parse(JSON.stringify(x));
const H = 3600e3, LOCK = 2 * H;
const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100), dec = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
const am = q => q >= 0.5 ? -Math.round(100 * q / (1 - q)) : Math.round(100 * (1 - q) / q);
const r3 = v => Math.round(v * 1e3) / 1e3;
const minIso = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
/* featured, this test's own copy: on a national network, never a preseason game */
const featuredOwn = g => g.type !== 'PRE' && Array.isArray(g.tv) && g.tv.length > 0;
const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));

process.on('uncaughtException', e => { chk(false, 'the test stopped: ' + (e && e.stack || e)); end(); });
function end() {
  for (const f of fails) console.log('  FAIL: ' + f);
  console.log(fails.length ? `${n} checks, ${fails.length} failed` : `${n} checks passed`);
  try { fs.rmSync(DIR, { recursive: true, force: true }); } catch (e) {}
  process.exit(fails.length ? 1 : 0);
}

/* ---------- the made-up days ---------- */
const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
const SEASON = REAL.season, Y = SEASON - 1;
const addDay = (d, k) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + k); return x.toISOString().slice(0, 10); };
const D0 = `${Y}-11-16`, D1 = addDay(D0, 1), D2 = addDay(D0, 2), D3 = addDay(D0, 3), D4 = addDay(D0, 4), DW = addDay(D0, -9);
const ymd = d => d.replace(/-/g, '');
const T = (d, hm) => `${d}T${hm}Z`;
const side = (t, out) => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
const mk = (date, a, h, tip, tv, model, o) => ({ id: `${SEASON}_${ymd(date)}_${a}_${h}`, date, tip, type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '9' + ymd(date).slice(4) + a + h,
  tv, awayScore: null, homeScore: null, line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 224, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5 }, ...o });
/* D1 (a Tuesday-like night in November, Eastern standard time): the featured games gA (7:30 PM ET, NBC) and gB (10 PM,
   Peacock), gC on local TV only, gG (6:45 PM) on local TV, gP a preseason game on ESPN; D2: gD (9 PM, ESPN) and gE on local
   TV; D3: gF (7:30 PM, TNT), beyond the lines feed's two dates on D1 */
const gA = mk(D1, 'BOS', 'NYK', T(D2, '00:30'), ['NBC'], { pHome: 0.66, spread: -5, total: 226 });
const gB = mk(D1, 'LAL', 'GSW', T(D2, '03:00'), ['Peacock'], { pHome: 0.45, spread: 2, total: 231 });
const gC = mk(D1, 'MIA', 'ORL', T(D2, '00:00'), [], { pHome: 0.6, spread: -4, total: 220 });
const gG = mk(D1, 'ATL', 'CHA', T(D1, '23:45'), [], { pHome: 0.55, spread: -2, total: 230 });
const gP = { ...mk(D1, 'SAC', 'UTA', T(D2, '02:00'), ['ESPN'], { pHome: 0.5 }), type: 'PRE' };
const gD = mk(D2, 'DEN', 'PHX', T(D3, '02:00'), ['ESPN'], { pHome: 0.4, spread: 3, total: 233 });
const gE = mk(D2, 'CHI', 'DET', T(D2, '23:00'), [], { pHome: 0.7, spread: -7, total: 222 });
const gF = mk(D3, 'MIL', 'TOR', T(D4, '00:30'), ['TNT'], { pHome: 0.35, spread: 4, total: 228 });
/* D0, played: four featured finals (gY4's box score not read yet); gZ played and its final not read; gW ten days back,
   its final in the state's finals and its box lines in the season's box file only */
const fin = (g, as, hs) => ({ ...g, status: 'final', awayScore: as, homeScore: hs });
const gY1 = fin(mk(D0, 'MIL', 'CLE', T(D1, '00:00'), ['ESPN'], { pHome: 0.6 }), 104, 112);
const gY2 = fin(mk(D0, 'DAL', 'SAS', T(D1, '01:30'), ['NBC'], { pHome: 0.55 }), 101, 110);
const gY3 = fin(mk(D0, 'PHX', 'POR', T(D1, '03:00'), ['Prime Video'], { pHome: 0.5 }), 106, 110);
const gY4 = fin(mk(D0, 'NOP', 'MEM', T(D1, '01:00'), ['NBA TV'], { pHome: 0.5 }), 99, 103);
const gZid = `${SEASON}_${ymd(D0)}_WAS_BKN`, gWid = `${SEASON}_${ymd(DW)}_IND_MIN`;
const OLD = `${SEASON - 1}_${Y}0301_ATL_BOS`;

/* the props model's rows ([name, team, pos, min, pts, reb, ast, tpm, stl, blk, dd, td]) */
const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'];
const ROWS = {
  [gA.id]: { 9100001: ['Ace Guard', 'BOS', 'G', 34, 27.5, 5, 6, 3, 1.2, 0.4, 0.2, 0.02], 9100002: ['Bo Wing', 'BOS', 'F', 32, 18, 7.5, 3, 2, 1, 0.6, 0.15, 0.01],
    9100003: ['Cy Big', 'NYK', 'C', 30, 14, 11, 2.5, 0.5, 0.7, 1.6, 0.45, 0.01], 9100004: ['Di Point', 'NYK', 'G', 35, 22, 4, 8, 2.5, 1.4, 0.3, 0.3, 0.03],
    9100005: ['Ed Forward', 'NYK', 'F', 29, 16, 6, 2, 1.5, 0.8, 0.5, 0.08, 0.005], 9100006: ['Fi Sixth', 'BOS', 'G', 24, 11, 3, 2, 1.8, 0.6, 0.2, 0.01, 0] },
  [gC.id]: { 9100011: ['Gu Wing', 'MIA', 'F', 33, 21, 6, 4, 2.2, 1, 0.5, 0.12, 0.01], 9100012: ['Ha Guard', 'ORL', 'G', 34, 24, 4, 6, 2.6, 1.1, 0.3, 0.15, 0.01] },
  [gD.id]: { 9100021: ['Io Center', 'DEN', 'C', 35, 26, 12, 9, 1, 1.3, 0.8, 0.7, 0.25], 9100022: ['Ju Guard', 'DEN', 'G', 33, 20, 4, 5, 2.4, 1, 0.3, 0.06, 0.01],
    9100023: ['Ka Wing', 'PHX', 'F', 34, 25, 6, 4, 2.8, 1, 0.5, 0.12, 0.01], 9100024: ['Lu Point', 'PHX', 'G', 32, 18, 3.5, 7, 2, 1.2, 0.2, 0.1, 0.01] },
};
const VAR = REAL.props.dist.var;
const mu = (row, k) => k in REAL.props.combos ? REAL.props.combos[k].reduce((t, s) => t + row[LAY.indexOf(s)], 0) : row[LAY.indexOf(k)];
/* a main line priced so that its chosen side is a Value pick 5 points over its price and 8 points over DraftKings' fair
   chance (the whole margin on the Over), well inside the far-off guard */
function mainOf(pid, row, stat, line, side, shift = 0) {
  const m = mu(row, stat), pOv = PJ.pOver(line, m, PJ.nbVar(m, VAR[stat])), p = side === 'over' ? pOv : 1 - pOv;
  const chosen = p - 0.05 + shift, other = side === 'over' ? 1 - p + 0.08 : 1 - p + 0.03;
  return side === 'over' ? { player: String(pid), stat, line, over: am(chosen), under: am(other) } : { player: String(pid), stat, line, over: am(other), under: am(chosen) };
}
const PLAN = { [gA.id]: [[9100001, 'pts', 24.5, 'over'], [9100002, 'reb', 9.5, 'under'], [9100003, 'reb', 9.5, 'over'], [9100004, 'ast', 6.5, 'over'], [9100005, 'pts', 17.5, 'under'], [9100006, 'tpm', 1.5, 'over']],
  [gC.id]: [[9100011, 'pts', 19.5, 'over'], [9100012, 'pts', 21.5, 'over']],
  [gD.id]: [[9100021, 'reb', 10.5, 'over'], [9100022, 'pts', 18.5, 'over'], [9100023, 'pts', 26.5, 'under'], [9100024, 'ast', 5.5, 'over']] };
const ids = g => ({ event: 'E' + g.espn, ml: { home: `0ML${g.espn}_1`, away: `0ML${g.espn}_3` }, spread: { home: `0HC${g.espn}_1`, away: `0HC${g.espn}_3` }, total: { over: `0OU${g.espn}_1`, under: `0OU${g.espn}_3` } });
const READ = T(D1, '14:00:00'), READ2 = T(D1, '22:40:00');
function linesOf(games, o = {}) {
  const out = { v: 1, at: o.at || READ, games: {} };
  for (const g of games) {
    const sp = Math.round(-g.model.spread) - 0.5 * Math.sign(g.model.spread || 1);
    const e = { at: o.at || READ, espn: g.espn, ml: { home: am(g.model.pHome - 0.06), away: am(1 - g.model.pHome + 0.08) }, spread: { line: -Math.abs(sp) * Math.sign(-g.model.spread || 1), home: -110, away: -110 },
      total: { line: Math.floor(g.model.total) + 0.5, over: -110, under: -110 }, ids: ids(g), props: null };
    if (ROWS[g.id] && !(o.noProps || []).includes(g.id)) e.props = { at: o.at || READ, mains: PLAN[g.id].map(([pid, st, ln, s]) => mainOf(pid, ROWS[g.id][pid], st, ln, s, o.shift || 0)), ladders: [], yes: [] };
    else if (ROWS[g.id]) e.props = { at: o.at || READ, mains: [], ladders: [], yes: [] };
    out.games[g.id] = e;
  }
  return out;
}
/* the state as the job would publish it at a stage: the slate, the props block, the box lines, the finals, the report */
function stateOf(slate, o = {}) {
  const st = clone(REAL);
  st.slate = slate.map(clone); st.today = o.today || D1; st.generated = o.generated || T(D1, '13:00'); st.asOf = D0;
  st.props = { ...clone(REAL.props), games: Object.fromEntries(slate.filter(g => ROWS[g.id] && g.status === 'scheduled').map(g => [g.id, { tip: g.tip, away: g.away, home: g.home, players: clone(ROWS[g.id]) }])) };
  st.props.ledger = { ...st.props.ledger, decision: null };
  st.boxes = { from: addDay(D1, -7), days: 7, line: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'], games: o.boxes || BOX0 };
  st.finals = { ...REAL.finals, [gWid]: [101, 108], ...Object.fromEntries(slate.filter(g => g.status === 'final').map(g => [g.id, [g.awayScore, g.homeScore]])) };
  st.pending = [gZid];
  st.report = { date: st.today, players: o.report || {} };
  st.eloPicks = null;
  return st;
}
/* the box lines ([pts, reb, ast, tpm, stl, blk]) of D0's finals; gY4's not read yet */
const BOX0 = {
  [gY1.id]: { 9200001: [24, 6, 3, 2, 1, 0], 9200002: [8, 3, 1, 0, 0, 0] },
  [gY2.id]: { 9200003: [12, 7, 2, 1, 0, 1], 9200004: [27, 4, 5, 3, 2, 0] },
  [gY3.id]: { 9200005: [15, 5, 5, 1, 1, 1] },
};
/* the season's box file: gW's lines (a row with dnp 1 is no line) */
const CSV_HEAD = 'game_id,date,team,opp,home,player_id,name,pos,starter,min,fgm,fga,tpm,tpa,ftm,fta,orb,drb,ast,stl,blk,tov,pf,pm,pts,dnp';
const csvRow = (pid, nm, pts, reb, ast, tpm, stl, blk, dnp) => [gWid, DW, 'IND', 'MIN', 0, pid, nm, 'G', 1, 30, 0, 0, tpm, 0, 0, 0, 1, reb - 1, ast, stl, blk, 0, 0, 0, pts, dnp ? 1 : 0].join(',');
fs.writeFileSync(path.join(DIR, 'data', `box_${SEASON}.csv`), [CSV_HEAD, csvRow(9200006, 'Mo Csv', 18, 4, 3, 2, 1, 0), csvRow(9200007, 'No Csv', 9, 2, 3, 1, 0, 0), csvRow(9200008, 'Oz Dnp', 0, 0, 0, 0, 0, 0, true)].join('\n') + '\n');

/* ---------- one run ---------- */
let seq = 0;
function run(st, lines, now, extra = {}) {
  if (st) fs.writeFileSync(path.join(DIR, 'state.json'), JSON.stringify(st)); else { try { fs.unlinkSync(path.join(DIR, 'state.json')); } catch (e) {} }
  if (lines) fs.writeFileSync(path.join(DIR, 'lines.json'), JSON.stringify(lines));
  seq++;
  const r = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, SUGGEST_NOW: now, SUGGEST_ROOT: DIR, SUGGEST_LEDGER: LEDGER, SUGGEST_PREV: 'none', ...extra } });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status, out, last: out.trim().split('\n').pop() };
}
const read = () => JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
const bytes = () => fs.readFileSync(LEDGER, 'utf8');
const plant = L => { L.featured = Object.fromEntries(Object.keys(L.featured).sort().map(k => [k, L.featured[k]])); L.featured_summary = SC.summarize(L.featured); fs.writeFileSync(LEDGER, SC.dumps(L) + '\n'); };
const keyOf = g => `${SEASON}|${g.date}|${g.tip}|${g.id}`;
const entry = g => read().featured[keyOf(g)];
const entryLine = (text, g) => text.split('\n').find(l => l.startsWith(`  ${JSON.stringify(keyOf(g))}:`)) || null;
/* every rule an entry keeps, worked out here */
function entryOk(e, g, at) {
  const lock = Date.parse(g.tip) - LOCK;
  return e && e.season === SEASON && e.gid === g.id && e.date === g.date && e.date === etDate(Date.parse(g.tip)) && e.tip === g.tip && e.lock === minIso(lock) && JSON.stringify(e.tv) === JSON.stringify(g.tv)
    && e.type === g.type && (!at || e.taken_at === at) && Date.parse(e.taken_at) < lock && e.tiers.map(t => t.id).join() === 'safe,med,aggr,xtrm'
    && e.tiers.every(t => t.n === { safe: 2, med: 3, aggr: 4, xtrm: 5 }[t.id] && (t.legs ? t.legs.length === t.n && t.legs.every(l => l.id === g.id) && new Set(t.legs.filter(l => l.kind === 'prop').map(l => l.pid)).size === t.legs.filter(l => l.kind === 'prop').length : typeof t.why === 'string' && t.why.length > 0));
}

(async () => {
  console.log('A. the morning of D1');
  const day1 = [gY1, gY2, gY3, gY4, gA, gB, gC, gG, gP, gD, gE, gF];
  const tA = T(D1, '15:00:00');
  let r = run(stateOf(day1), linesOf([gA, gB, gC, gG, gD, gE]), tA);
  chk(r.code === 0 && /^suggest ledger: written/.test(r.last), 'A: the run writes: ' + r.last);
  let L = read();
  const want = day1.filter(g => featuredOwn(g) && g.status === 'scheduled' && [D1, D2].includes(g.date));
  chk(JSON.stringify(Object.keys(L.featured).sort()) === JSON.stringify(want.map(keyOf).sort()), `A: one set for each featured game of D1 and D2 (${want.map(g => g.id.slice(-7)).join(', ')}), none for gC or gG (local TV), gP (preseason) or gF (D3): ${Object.keys(L.featured).map(k => k.slice(-7)).join(', ')}`);
  chk(want.every(g => entryOk(entry(g), g, tA)), 'A: each keyed season|date|tip|game, locking 2 hours before tip-off, its networks and type kept, taken now, the four levels of their sizes, every leg its own game, one leg a player');
  const eA = entry(gA);
  chk(eA.tiers.every(t => t.legs) && eA.tiers.some(t => t.legs.some(l => l.kind === 'prop')), 'A: the first game makes all four levels, with player legs');
  chk(eA.tiers.every(t => t.legs.every(l => { const ln = linesOf([gA]).games[gA.id]; if (l.kind === 'prop') { const m = ln.props.mains.find(x => x.player === l.pid && x.stat === l.stat); return m && m.line === l.line && l.odds === (l.side === 'over' ? m.over : m.under); }
    return l.kind === 'ml' ? l.odds === ln.ml[l.side === gA.home ? 'home' : 'away'] : l.kind === 'spread' ? l.odds === ln.spread[l.side === gA.home ? 'home' : 'away'] : l.odds === ln.total[l.side]; })), "A: every leg at DraftKings' price in lines.json");
  chk(SC.check(L, null, Date.parse(tA), tA, SEASON).length === 0 && L.featured_summary.entries === want.length, 'A: the ledger passes the guard, its summary counting the sets');
  chk(eA.tiers.some(t => t.legs.some(l => l.kind === 'prop' && l.p > 0 && l.p < 1 && l.fair != null)) && eA.tiers.every(t => t.dec > 1 && t.p > 0 && t.p <= 1), 'A: each leg keeps its chance and fair chance, each level its chance and price');

  console.log('B. hours later');
  const tB = T(D1, '19:00:00');
  const gB0 = { ...gB, tv: [] }, gC1 = { ...gC, tv: ['ESPN'] };
  const day1B = [gY1, gY2, gY3, gY4, gA, gB0, gC1, gG, gP, gD, gE, gF];
  r = run(stateOf(day1B, { generated: T(D1, '18:00') }), linesOf([gA, gB, gC, gG, gD, gE], { noProps: [gA.id] }), tB);
  L = read();
  chk(r.code === 0 && entry(gA) && entry(gA).taken_at === tB && JSON.stringify(entry(gA).tiers) !== JSON.stringify(eA.tiers) && entry(gA).tiers.every(t => !t.legs || t.legs.every(l => l.kind !== 'prop')), 'B: the first game\'s player props gone, its set is rewritten without them');
  chk(!entry(gB) && /dropped .*LAL_GSW, no longer a featured game to come/.test(r.out), 'B: a game moved off national TV before its lock is dropped');
  chk(entryOk(entry(gC1), gC1, tB), 'B: a game moved onto national TV before its lock is taken');
  const b1 = bytes();
  r = run(stateOf(day1B, { generated: T(D1, '18:00') }), null, T(D1, '19:10:00'));
  chk(r.code === 0 && /^suggest ledger: unchanged/.test(r.last) && bytes() === b1, 'B2: the same again writes nothing: ' + r.last);
  const lockA = Date.parse(gA.tip) - LOCK, tB3 = new Date(lockA - 1000).toISOString().replace(/\.000Z$/, 'Z');
  r = run(stateOf(day1B, { generated: T(D1, '22:00') }), linesOf([gA, gB, gC, gG, gD, gE]), tB3);
  const eB3 = entry(gA);
  chk(r.code === 0 && eB3.taken_at === tB3 && JSON.stringify(eB3.tiers) === JSON.stringify(eA.tiers), 'B3: a second before its lock, the props back, the set is rewritten (to what the morning had)');

  console.log('C. an hour after the first lock');
  const tC = T(D1, '23:30:00'), gG1 = { ...gG, tv: ['NBA TV'] };
  const day1C = [gY1, gY2, gY3, gY4, gA, gB0, gC1, gG1, gP, gD, gE, gF];
  const lineB3 = entryLine(bytes(), gA);
  r = run(stateOf(day1C, { generated: T(D1, '23:00') }), linesOf([gA, gB, gC, gG, gD, gE], { shift: -0.02, at: READ2 }), tC);
  chk(r.code === 0 && entryLine(bytes(), gA) === lineB3, 'C: locked, the set stays as the last run before the lock left it, to the byte, though its prices moved');
  chk(!entry(gG1), 'C: a game moved onto national TV after its lock gets no entry');
  chk(entry(gC1) && entry(gC1).taken_at === tB, "C: gC (locked since 22:00Z) keeps the set B took");

  console.log('R. a player listed after the lock');
  const tR = T(D2, '00:00:00');
  const legsOf = (e, pid) => e.tiers.filter(t => t.legs && t.legs.some(l => l.kind === 'prop' && l.pid === pid)).map(t => t.id);
  const pids = [...new Set(eB3.tiers.flatMap(t => (t.legs || []).filter(l => l.kind === 'prop').map(l => l.pid)))];
  const X = pids.map(p => [p, legsOf(eB3, p)]).sort((a, b) => a[1].length - b[1].length)[0];
  chk(X && X[1].length >= 1, `R: a player of the locked set to list (${X && X[0]}, on ${X && X[1].join(', ')})`);
  const rep1 = { [X[0]]: ['BOS', 'Out', 'Knee', ''] };
  r = run(stateOf(day1C, { generated: T(D1, '23:50'), report: rep1 }), linesOf([gA, gC, gD, gE], { shift: -0.02, at: READ2 }), tR);
  const eR = entry(gA);
  chk(r.code === 0 && /replaced .*BOS_NYK/.test(r.out), 'R: the run replaces: ' + r.last);
  chk(eR.tiers.every((t, i) => X[1].includes(t.id) ? JSON.stringify(t) !== JSON.stringify(eB3.tiers[i]) && !legsOf({ tiers: [t] }, X[0]).length && t.updated && t.updated.pid === X[0] && t.updated.at === tR && /listed out \(knee\), so held out/.test(t.updated.reason)
    : JSON.stringify(t) === JSON.stringify(eB3.tiers[i])), `R: the level${X[1].length > 1 ? 's' : ''} holding him (${X[1].join(', ')}) built again without him and marked updated; the others as locked`);
  chk(Array.isArray(eR.updates) && eR.updates.length === X[1].length && eR.updates.every(u => u.pid === X[0] && u.at === tR && X[1].includes(u.tier)) && eR.taken_at === eB3.taken_at, 'R: each replacement recorded in updates, the time taken left as it was');
  const bR = bytes();
  r = run(stateOf(day1C, { generated: T(D1, '23:50'), report: rep1 }), null, T(D2, '00:05:00'));
  chk(r.code === 0 && bytes() === bR, 'R2: the same again writes nothing: ' + r.last);
  const Y2 = pids.find(p => p !== X[0] && legsOf(eR, p).length);
  r = run(stateOf(day1C, { generated: T(D2, '00:50'), report: { ...rep1, [Y2]: ['NYK', 'Day-To-Day', 'Ankle', ''] } }), null, T(D2, '01:00:00'));
  const eR3 = entry(gA);
  chk(r.code === 0 && JSON.stringify(SC.callOf(eR3)) === JSON.stringify(SC.callOf(eR)) && eR3.grade && Object.values(eR3.grade).every(g => g.result === 'pending'), 'R3: after tip-off another player listed: nothing changes but the grade (pending, the game not final)');

  console.log('D. the night played out');
  /* the made-up locked entries, each its own game, to hold every rule of a book's settlement */
  const at0 = T(D0, '15:00:00');
  const legT = (g, kind, s, line, odds, other, x = {}) => ({ id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip, at: at0, kind, side: s, line, odds, other, dk: null, name: kind === 'total' ? `${g.away} at ${g.home}` : s, label: kind, p: 0.6, fair: 0.55, fair_est: false, thin: false, market: kind === 'total', ...x });
  const legP = (g, pid, nm, team, stat, mk1, line, s, odds, x = {}) => ({ id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip, kind: 'prop', pid: String(pid), name: nm, team, at: at0, stat, mk: mk1, line: mk1 === 'main' ? line : undefined, k: mk1 === 'mile' ? line : undefined, side: s, odds, other: mk1 === 'main' ? 110 : null, label: stat, p: 0.6, fair: 0.55, fair_est: false, thin: false, market: false, ...x });
  const lvl = (id, legs, o = {}) => ({ id, label: SC.LABELS[id], n: SC.LEGS[id], floor: { safe: 0, med: 0.25, aggr: 0.12, xtrm: 0.05 }[id], legs, p: 0.31, fair: 0.25, fair_est: true, dec: r3(legs.reduce((d, l) => d * dec(l.odds), 1)), likeliest: false, thin: 0, mkt: legs.filter(l => l.market).length, ...o });
  const why = id => ({ id, label: SC.LABELS[id], n: SC.LEGS[id], floor: { safe: 0, med: 0.25, aggr: 0.12, xtrm: 0.05 }[id], why: 'No legs in this game.' });
  const ent = (g, tiers, o = {}) => ({ season: +g.id.slice(0, 4), date: g.date, gid: g.id, away: g.away, home: g.home, type: 'REG', tip: g.tip, lock: minIso(Date.parse(g.tip) - LOCK), tv: g.tv || ['ESPN'], generated: T(g.date, '12:00'),
    pool: { pref: 3, thin: 0, mkt: 1, far: 0, held: 0 }, tiers: ['safe', 'med', 'aggr', 'xtrm'].map(id => tiers[id] || why(id)), taken_at: T(g.date, '15:00:00'), ...o });
  const gZ = { id: gZid, date: D0, tip: T(D1, '00:30'), away: 'WAS', home: 'BKN', tv: ['ESPN'] };
  const gW = { id: gWid, date: DW, tip: T(addDay(DW, 1), '00:00'), away: 'IND', home: 'MIN', tv: ['NBA TV'] };
  const gO = { id: OLD, date: `${Y}-03-01`, tip: `${Y}-03-02T00:30Z`, away: 'ATL', home: 'BOS', tv: ['ESPN'] };
  const gY2old = { ...gY2, tip: T(D1, '00:30') };
  const P = {
    E1: ent(gY1, { safe: lvl('safe', [legT(gY1, 'ml', 'CLE', null, -150, 130), legT(gY1, 'total', 'under', 216, -110, -110)]),
      med: lvl('med', [legT(gY1, 'ml', 'CLE', null, -150, 130), legP(gY1, 9200001, 'Pa One', 'MIL', 'pts', 'main', 20.5, 'over', -115), legP(gY1, 9200099, 'Pb Dnp', 'CLE', 'reb', 'main', 4.5, 'over', 105)]) }),
    E2: ent(gY2, { safe: lvl('safe', [legP(gY2, 9200003, 'Pc Three', 'DAL', 'reb', 'main', 9.5, 'over', -120), legT(gY2, 'ml', 'SAS', null, -140, 120)]) }),
    E2old: ent(gY2old, { safe: lvl('safe', [legT(gY2old, 'ml', 'SAS', null, -140, 120), legP(gY2old, 9200004, 'Pd Four', 'SAS', 'pts', 'main', 22.5, 'over', -110)]) }),
    E3: ent(gY3, { safe: lvl('safe', [legT(gY3, 'spread', 'POR', -4, -110, -110), legP(gY3, 9200098, 'Pe Dnp', 'PHX', 'ast', 'main', 3.5, 'under', -105)]) }),
    E4: ent(gZ, { safe: lvl('safe', [legT(gZ, 'ml', 'BKN', null, -130, 110), legT(gZ, 'total', 'over', 221.5, -110, -110)]) }),
    E5: ent(gO, { safe: lvl('safe', [legT(gO, 'ml', 'BOS', null, -200, 170), legT(gO, 'total', 'over', 219.5, -110, -110)]) }),
    E6: ent(gW, { safe: lvl('safe', [legP(gW, 9200006, 'Mo Csv', 'IND', 'pts', 'main', 15.5, 'over', -110), legP(gW, 9200007, 'No Csv', 'IND', 'ast', 'main', 5.5, 'under', -125)]),
      med: lvl('med', [legP(gW, 9200006, 'Mo Csv', 'IND', 'reb', 'main', 4.5, 'under', -110), legP(gW, 9200007, 'No Csv', 'IND', 'pts', 'mile', 10, 'yes', 120), legP(gW, 9200008, 'Oz Dnp', 'IND', 'pts', 'main', 6.5, 'over', -110)]) }),
    E7: ent(gY4, { safe: lvl('safe', [legT(gY4, 'ml', 'MEM', null, -125, 105), legP(gY4, 9200009, 'Pf Wait', 'MEM', 'pts', 'main', 12.5, 'over', -110)]) }),
  };
  /* grades planted: E4's complete grade, which a state that cannot settle it must keep; E5's, last season's, never redone */
  P.E4.grade = { safe: { result: 'won', legs: ['win', 'win'], payout: P.E4.tiers[0].dec } };
  P.E5.grade = { safe: { result: 'lost', legs: ['loss', 'win'], payout: 0 } };
  L = read();
  for (const e of Object.values(P)) L.featured[SC.keyOf(e)] = e;
  plant(L);
  chk(SC.check(read(), null, Date.parse(T(D2, '12:00:00')), null, SEASON).length === 0, 'D: the planted ledger passes the guard: ' + SC.check(read(), null, Date.parse(T(D2, '12:00:00')), null, SEASON).slice(0, 2).join('; '));
  /* D1's finals and box lines: each player of gA's levels given a line, his legs landing or not by the plant */
  const eD0 = entry(gA), boxA = {};
  for (const t of eD0.tiers) for (const l of t.legs || []) if (l.kind === 'prop') { const row = boxA[l.pid] = boxA[l.pid] || [10, 5, 4, 1, 1, 0];
    const ix = { pts: 0, reb: 1, ast: 2, tpm: 3, stl: 4, blk: 5 }[l.stat]; if (ix != null) row[ix] = l.side === 'over' ? Math.ceil(l.line) + 1 : Math.max(0, Math.floor(l.line) - 1); }
  const day2 = [gY1, gY2, gY3, gY4, fin(gA, 101, 113), fin(gB0, 120, 117), fin(gC1, 99, 98), fin(gG1, 110, 108), fin(gP, 90, 95), gD, gE, gF];
  const BOXD = { ...BOX0, [gA.id]: boxA, [gC1.id]: {}, [gB0.id]: {} };
  const tD = T(D2, '12:00:00');
  const stD = stateOf(day2, { today: D2, generated: T(D2, '11:00'), boxes: BOXD });
  r = run(stD, linesOf([gD, gE, gF]), tD);
  L = read();
  chk(r.code === 0, 'D: the run grades and writes: ' + r.last);
  /* the settlement, worked out here from the raw scores and box lines */
  const csvBox = { 9200006: [18, 4, 3, 2, 1, 0], 9200007: [9, 2, 3, 1, 0, 0] };
  const scoreOf = id => { const g = stD.slate.find(x => x.id === id && x.status === 'final'); return g ? [g.awayScore, g.homeScore] : stD.finals[id] && id !== gZid ? stD.finals[id] : null; };
  function settle(l) {
    const sc = scoreOf(l.id); if (!sc) return null;
    const [as, hs] = sc;
    if (l.kind === 'ml') return hs === as ? 'push' : (hs > as) === (l.side === l.home) ? 'win' : 'loss';
    if (l.kind === 'spread') { const m = (l.side === l.home ? hs - as : as - hs) + l.line; return m === 0 ? 'push' : m > 0 ? 'win' : 'loss'; }
    if (l.kind === 'total') { const t = as + hs; return t === l.line ? 'push' : (t > l.line) === (l.side === 'over') ? 'win' : 'loss'; }
    const box = l.id === gWid ? csvBox : BOXD[l.id]; if (!box) return null;
    const row = box[l.pid]; if (!row) return 'void';
    const parts = { pts: [0], reb: [1], ast: [2], tpm: [3], stl: [4], blk: [5], pra: [0, 1, 2], pr: [0, 1], pa: [0, 2], ar: [2, 1], sb: [4, 5] }[l.stat], v = parts.reduce((s, i) => s + row[i], 0);
    if (l.mk === 'main') return v === l.line ? 'push' : (v > l.line) === (l.side === 'over') ? 'win' : 'loss';
    if (l.mk === 'mile') return v >= l.k ? 'win' : 'loss';
    return null;
  }
  const corrRho = REAL.corr.rho, HOLD = REAL.corr.hold;
  const cl = l => l.kind === 'prop' ? { game: l.id, kind: l.stat, player: l.pid, team: l.team, side: l.side, home: l.home } : { game: l.id, kind: { ml: 'win', spread: 'cover', total: 'over' }[l.kind], team: l.kind === 'total' ? '' : l.side, side: l.side, home: l.home };
  function payOwn(t, res) {
    if (res.some(x => x == null)) return { result: 'pending' };
    if (res.includes('loss')) return { result: 'lost', payout: 0 };
    const left = t.legs.filter((l, i) => res[i] === 'win');
    if (!left.length) return { result: 'push', payout: 1 };
    if (left.length === t.legs.length) return { result: 'won', payout: t.dec };
    if (left.length === 1) return { result: 'won', payout: r3(dec(left[0].odds)) };
    if (left.length === 2) { const [a, b] = left, rho = CJ.rhoFor(corrRho, cl(a), cl(b)) || 0, J = CJ.joint2(imp(a.odds), imp(b.odds), rho);
      return { result: 'won', payout: r3(Math.min(dec(a.odds) * dec(b.odds), HOLD / J)) }; }
    return { result: 'won', payout: undefined };
  }
  let graded = 0;
  for (const [k, e] of Object.entries(L.featured)) {
    if (!(Date.parse(e.tip) <= Date.parse(tD)) || e.season !== SEASON) continue;
    for (const t of e.tiers) { if (!t.legs) continue;
      const res = t.legs.map(settle), want = e.gid === gZid ? { result: 'won', payout: t.dec } : payOwn(t, res), g = e.grade && e.grade[t.id];
      const ok = g && g.result === want.result && (want.payout === undefined || g.payout === want.payout) && (e.gid === gZid || JSON.stringify(g.legs) === JSON.stringify(res));
      chk(ok, `D: ${k} ${t.id} graded ${g && g.result} ${g && g.payout} on ${JSON.stringify(g && g.legs)}, worked out here ${want.result} ${want.payout} on ${JSON.stringify(res)}`); graded++; }
  }
  const gr = k => L.featured[SC.keyOf(P[k])].grade.safe;
  chk(gr('E1').result === 'won' && gr('E1').payout === r3(dec(-150)) && L.featured[SC.keyOf(P.E1)].grade.med.result === 'won', 'D: a moneyline won beside a total pushing on its whole line pays the moneyline\'s own price; a player with no box line is void and the two legs left pay the same-game price');
  chk(gr('E2').result === 'lost' && gr('E2').payout === 0 && gr('E2old').result === 'won', 'D: a player\'s line lost loses the parlay; the same game under an older tip-off graded on its own');
  chk(gr('E3').result === 'push' && gr('E3').payout === 1, 'D: a spread pushing on its whole line and a void leg: a push, the stake back');
  chk(gr('E4').result === 'won' && JSON.stringify(gr('E4').legs) === '["win","win"]', 'D: a complete grade is kept when the state can no longer settle the game (played, its final not read)');
  chk(JSON.stringify(L.featured[SC.keyOf(P.E5)].grade) === JSON.stringify(P.E5.grade), "D: last season's entry is never graded again");
  chk(gr('E6').result === 'won' && gr('E6').payout === P.E6.tiers[0].dec && L.featured[SC.keyOf(P.E6)].grade.med.result === 'lost' && JSON.stringify(L.featured[SC.keyOf(P.E6)].grade.med.legs) === '["win","loss","void"]',
    "D: a game older than the state's week is graded from the season's box file (a milestone missed, a row marked did-not-play void)");
  chk(gr('E7').result === 'pending', 'D: a final whose box score is not read yet is pending');
  chk(graded >= 14, `D: every level of this season's played entries checked (${graded})`);
  /* the summary, worked out here: each season's game and level once, from the last key that holds it */
  const sum = { safe: { g: 0, w: 0, push: 0, u: 0, m: 0, f: 0, fn: 0 }, med: { g: 0, w: 0, push: 0, u: 0, m: 0, f: 0, fn: 0 }, aggr: { g: 0, w: 0, push: 0, u: 0, m: 0, f: 0, fn: 0 }, xtrm: { g: 0, w: 0, push: 0, u: 0, m: 0, f: 0, fn: 0 } }, lastOf = new Map(); let pend = 0;
  for (const k of Object.keys(L.featured).sort()) { const e = L.featured[k]; if (!e.grade) continue; for (const t of e.tiers) if (t.legs && e.grade[t.id]) lastOf.set(`${e.season}|${e.gid}|${t.id}`, [t, e.grade[t.id]]); }
  for (const [t, g] of lastOf.values()) { const s = sum[t.id]; if (g.result === 'pending') { pend++; continue; } if (g.result === 'push') { s.push++; continue; }
    s.g++; if (g.result === 'won') s.w++; s.m += t.p; if (t.fair != null) { s.f += t.fair; s.fn++; } s.u += g.payout - 1; }
  const q = L.featured_summary;
  chk(['safe', 'med', 'aggr', 'xtrm'].every(id => q.tiers[id].graded === sum[id].g && q.tiers[id].won === sum[id].w && q.tiers[id].push === sum[id].push && Math.abs(q.tiers[id].units - sum[id].u) < 0.0015 && Math.abs(q.tiers[id].exp_model - sum[id].m) < 0.0001 && q.tiers[id].fair_n === sum[id].fn) && q.pending === pend,
    `D: the summary is the grades', each game's level once from its last key (${['safe', 'med', 'aggr', 'xtrm'].map(id => `${id} ${q.tiers[id].won}/${q.tiers[id].graded}`).join(', ')}; ${q.pending} pending)`);
  chk(q.tiers.safe.graded === sum.safe.g && !lastOf.has(`${SEASON}|${gY2old.id}|med`) && [...lastOf.keys()].filter(k => k.startsWith(`${SEASON}|${gY2.id}|`)).length === 1, "D: gY2's Safe under two tip-offs is counted once, the later key's");
  chk(entryOk(entry(gF), gF, tD) && entry(gD).taken_at === tD, "D: the next day's featured set (D3's, now one of the lines feed's dates) is taken; D2's, its prices moved back since C and its lock to come, rewritten");
  chk(SC.check(L, null, Date.parse(tD), null, SEASON).length === 0, 'D: the graded ledger passes the guard');
  const good = bytes(), goodFile = path.join(DIR, 'good.json'); fs.writeFileSync(goodFile, good);

  console.log('E. no featured game to come');
  const tE = T(D3, '12:00:00'), day3 = day2.map(g => g.id === gD.id || g.id === gE.id ? fin(g, 100, 102) : g.id === gF.id ? { ...g, tv: [] } : g);
  r = run(stateOf(day3, { today: D3, generated: T(D3, '11:00'), boxes: BOXD }), linesOf([gF]), tE);
  const eE = bytes();
  chk(r.code === 0 && /no featured game on the lines feed's dates/.test(r.last) && !Object.keys(read().featured).some(k => !(k in JSON.parse(good).featured)), 'E: nothing new is taken: ' + r.last);
  r = run(stateOf(day3, { today: D3, generated: T(D3, '11:00'), boxes: BOXD }), null, T(D3, '12:10:00'));
  chk(r.code === 0 && /unchanged/.test(r.last) && bytes() === eE, 'E2: and nothing is written: ' + r.last);

  console.log('F. the guard');
  /* a ledger on disk whose locked set was edited: refused, and the last commit's put back */
  const ed = JSON.parse(good); ed.featured[keyOf(gA)].tiers[0].legs[0].odds += 10; plant(ed);
  r = run(stD, linesOf([gD, gE, gF]), tD, { SUGGEST_PREV: goodFile });
  chk(r.code === 1 && /refused/.test(r.last) && bytes() === good, "F: a locked set edited on disk is refused, and the last commit's file put back: " + r.last);
  /* a set still to lock rewritten since the commit: not refused */
  const ed2 = JSON.parse(good), kF = keyOf(gF); ed2.featured[kF] = { ...ed2.featured[kF], taken_at: T(D2, '10:00:00') }; plant(ed2);
  r = run(stD, linesOf([gD, gE, gF]), tD, { SUGGEST_PREV: goodFile });
  chk(r.code === 0, 'F: a set still to lock that an earlier run rewrote since the commit is not refused: ' + r.last);
  /* a locked level an earlier run replaced, not committed yet: not refused (gD between its lock and tip-off) */
  fs.writeFileSync(LEDGER, good);
  const tF = T(D3, '01:00:00'), stF = stateOf(day2, { today: D2, generated: T(D3, '00:30'), boxes: BOXD });
  const ed3 = JSON.parse(good), eD = ed3.featured[keyOf(gD)], si = eD.tiers.findIndex(t => t.legs && t.legs.some(l => l.kind === 'prop'));
  if (si >= 0) {
    const t0 = eD.tiers[si], gone = t0.legs.find(l => l.kind === 'prop'), pool = eD.tiers.flatMap(t => t.legs || []).filter(l => l.pid !== gone.pid);
    const pick = []; for (const l of pool) { if (pick.length === t0.n) break; if (pick.some(x => (x.kind === 'prop' && x.pid === l.pid) || (x.kind !== 'prop' && l.kind !== 'prop' && (x.kind === 'total') === (l.kind === 'total')) || JSON.stringify(x) === JSON.stringify(l))) continue; pick.push(l); }
    if (pick.length === t0.n) {
      const upd = { pid: gone.pid, name: gone.name, reason: 'listed out, so held out', at: T(D3, '00:30:00') };
      eD.tiers[si] = { ...t0, legs: pick, updated: upd }; eD.updates = [{ tier: t0.id, ...upd }];
      plant(ed3);
      r = run(stF, linesOf([gD, gF]), tF, { SUGGEST_PREV: goodFile });
      chk(r.code === 0, 'F: a locked level an earlier run replaced (not committed yet) is not refused: ' + r.last);
    } else chk(true, 'F: (no second leg set to plant an earlier replacement on)');
  }
  /* no state: refused, the file untouched */
  fs.writeFileSync(LEDGER, good);
  r = run(null, null, tD);
  chk(r.code === 1 && /refused/.test(r.last) && bytes() === good, 'F: a state that is not there is refused, the file untouched: ' + r.last);
  /* and the command line: the file against the last commit's (--prev) */
  const cl1 = cp.spawnSync('node', [CHECK, '--prev', goodFile, '--now', tD], { encoding: 'utf8', env: { ...process.env, SUGGEST_LEDGER: LEDGER, SUGGEST_STATE: path.join(DIR, 'state.json') } });
  chk(cl1.status === 0 && /suggest check: 0 failures/.test(cl1.stdout), 'F: the command line passes the good file: ' + cl1.stdout.trim());
  plant(ed);
  const cl2 = cp.spawnSync('node', [CHECK, '--prev', goodFile, '--now', tD], { encoding: 'utf8', env: { ...process.env, SUGGEST_LEDGER: LEDGER, SUGGEST_STATE: path.join(DIR, 'state.json') } });
  chk(cl2.status === 1 && /locked at .* and changed with no player listed/.test(cl2.stdout), 'F: and fails a locked set edited: ' + cl2.stdout.trim().split('\n').pop());
  fs.writeFileSync(LEDGER, good);

  /* check() on hand-made ledgers: every rule */
  const base = JSON.parse(good), now = Date.parse(tD), kA = keyOf(gA), kD = keyOf(gD);
  const fails1 = (mut, re, what, prev = base, runAt = null, season = SEASON) => { const L1 = clone(base); mut(L1); if (!('featured_summary' in L1) || L1.__keep !== true) L1.featured_summary = SC.summarize(L1.featured); delete L1.__keep;
    const b = SC.check(L1, prev, now, runAt, season); chk(b.some(x => re.test(x)), `check fails ${what}: ${b.slice(0, 2).join(' | ') || 'nothing'}`); };
  chk(SC.check(base, base, now, null, SEASON).length === 0, 'check passes the good ledger against itself');
  fails1(L => { L.featured['x|' + kA] = L.featured[kA]; }, /not keyed on its own/, 'an entry keyed on another key');
  fails1(L => { L.featured[kA].away = 'MIA'; }, /game id is not of its season/, 'a game id not of its clubs');
  fails1(L => { const e = L.featured[kD]; delete L.featured[kD]; e.date = D3; e.gid = `${SEASON}_${ymd(D3)}_DEN_PHX`; L.featured[SC.keyOf(e)] = e; }, /which is .* in New York, not/, 'a date not its tip-off\'s Eastern date');
  fails1(L => { L.featured[kD].tv = []; }, /not a featured game by its own networks/, 'an entry on no national network');
  fails1(L => { L.featured[kD].type = 'PRE'; }, /not a featured game/, 'a preseason entry');
  fails1(L => { L.featured[kD].lock = minIso(Date.parse(gD.tip) - 3 * H); }, /not 2 hours before its tip-off/, 'a lock not 2 hours before tip-off');
  fails1(L => { L.featured[kD].taken_at = minIso(Date.parse(gD.tip) - H).replace('Z', ':00Z'); }, /at or after its lock/, 'a set taken after its lock');
  fails1(L => { L.featured[kD].tiers.reverse(); }, /its levels are not the four/, 'levels out of order');
  fails1(L => { const t = L.featured[kA].tiers[1]; t.legs = t.legs.slice(0, 2); }, /2 legs on a level of 3/, 'a level short of its legs');
  fails1(L => { L.featured[kA].tiers[0].legs[0].id = gC.id; }, /a leg on another game/, 'a leg on another game');
  fails1(L => { const t = L.featured[kA].tiers.find(x => x.legs && x.legs.filter(l => l.kind === 'prop').length >= 2); const ps = t.legs.filter(l => l.kind === 'prop'); ps[1].pid = ps[0].pid; }, /a player twice/, 'a player twice in a level');
  fails1(L => { L.featured[kA].updates = [{ tier: 'med', pid: '', at: '' }]; }, /names no level, player or time/, 'a replacement naming nobody');
  fails1(L => { L.featured[kA].updates.push({ tier: 'safe', pid: 'x', name: 'x', reason: 'r', at: T(D1, '12:00:00') }); }, /not between its lock and its tip-off/, 'a replacement before the lock');
  fails1(L => { const t = L.featured[kA].tiers.find(x => x.updated); t.updated = { ...t.updated, reason: 'other' }; }, /not the last one recorded/, "a level's mark not its last replacement");
  fails1(L => { const t = L.featured[kA].tiers.find(x => x.updated); t.legs[t.legs.findIndex(l => l.kind === 'prop')].pid = t.updated.pid; }, /and still holds him/, 'a replaced level still holding the player');
  fails1(L => { L.featured[kD].grade = { safe: { result: 'pending', legs: [null, null] } }; }, /graded before its tip-off/, 'a grade before tip-off');
  fails1(L => { const g = L.featured[SC.keyOf(P.E2)].grade.safe; g.result = 'won'; g.payout = 2; }, /graded won on legs/, 'a grade not following its legs');
  fails1(L => { L.featured[SC.keyOf(P.E3)].grade.safe.payout = 0; }, /a push paying 0/, 'a push paying 0');
  fails1(L => { L.featured[SC.keyOf(P.E2)].grade.safe.payout = 1; }, /a loss paying 1/, 'a loss paying 1');
  fails1(L => { L.featured[SC.keyOf(P.E4)].grade.safe.payout = 1.5; }, /every leg won and it pays/, 'every leg won, not paying its price');
  fails1(L => { delete L.featured[kA]; }, /a set locked at .* is gone/, 'a locked set gone');
  fails1(L => { L.featured[kA].generated = 'x'; }, /locked at .*, and changed \(generated\)/, 'a locked set changed in a field');
  fails1(L => { L.featured[kA].updates = []; L.featured[kA].tiers.forEach(t => delete t.updated); }, /record of replacements rewritten/, 'its replacements rewritten');
  fails1(L => { L.featured[kA].tiers[3].id = 'xx'; }, /its levels changed/, 'its levels changed');
  fails1(L => { const t = L.featured[kA].tiers.find(x => !x.updated && x.legs); t.dec = t.dec + 1; }, /changed with no player listed/, 'a locked level changed with no replacement');
  /* against a last commit holding gA as it was locked (B3's levels, before the replacement) */
  const asLocked = () => { const p = clone(base), e = p.featured[kA]; delete e.updates; delete e.grade; e.tiers = clone(eB3.tiers); return p; };
  fails1(L => {}, /replacement recorded that is not this run's/, "a replacement that is not this run's", asLocked(), tD);
  { const p = asLocked(), t = p.featured[kA].tiers.find(x => x.id === base.featured[kA].updates[0].tier); t.legs.forEach(l => { if (l.pid === X[0]) l.pid = 'nobody'; });
    fails1(L => {}, /who was not on the level as it was locked/, 'a level replaced for a player it did not hold', p); }
  { const p = clone(base); delete p.featured[kA].updates;
    fails1(L => { delete L.featured[kA].updates; L.featured[kA].tiers.forEach(t => delete t.updated); L.featured[kA].updates = []; }, /record of replacements rewritten|changed with no player listed/, 'a replaced level with its record taken away', base); }
  fails1(L => { const u = L.featured[kA].updates[0], free = L.featured[kA].tiers.find(t => !t.updated && t.legs); L.featured[kA].updates.push({ ...u, tier: free.id, at: T(D2, '00:10:00') }); },
    /a replacement recorded for a level that did not change/, 'a replacement recorded for a level that did not change', base, null);
  fails1(L => { const u = L.featured[kA].updates[0]; L.featured[kA].updates.push({ ...u, at: T(D2, '00:10:00') }); const t = L.featured[kA].tiers.find(x => x.id === u.tier); t.updated = { pid: u.pid, name: u.name, reason: u.reason, at: T(D2, '00:10:00') }; },
    /replaced more than once by one run/, 'a level replaced twice by one run', asLocked(), T(D2, '00:10:00'));
  fails1(L => { L.featured[kF] = { ...L.featured[kF], taken_at: T(D2, '11:00:00') }; }, /new or changed, and not taken by this run before its lock/, 'an entry changed and not this run\'s', base, tD);
  fails1(L => { L.featured[SC.keyOf(P.E5)].grade.safe = { result: 'won', legs: ['win', 'win'], payout: L.featured[SC.keyOf(P.E5)].tiers[0].dec }; }, /graded anew/, "last season's entry graded anew");
  fails1(L => { L.featured_summary.tiers.safe.won += 1; L.__keep = true; }, /the summary does not follow/, 'a summary that does not follow');

  console.log('G. the real ledger, copied, on the real state');
  const realLedger = path.join(ROOT, SC.LEDGER_REL), realLines = path.join(ROOT, 'lines.json');
  if (fs.existsSync(realLines)) {
    const G = path.join(DIR, 'real'); fs.mkdirSync(path.join(G, 'data'), { recursive: true });
    for (const f of ['index.html', 'state.json', 'lines.json']) fs.copyFileSync(path.join(ROOT, f), path.join(G, f));
    for (const f of fs.readdirSync(path.join(ROOT, 'data')).filter(f => /^box_\d{4}\.csv$/.test(f))) fs.copyFileSync(path.join(ROOT, 'data', f), path.join(G, 'data', f));
    const gl = path.join(G, 'ledger.json'); if (fs.existsSync(realLedger)) fs.copyFileSync(realLedger, gl);
    const before = fs.existsSync(gl) ? fs.readFileSync(gl, 'utf8') : null;
    const rg = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, SUGGEST_ROOT: G, SUGGEST_LEDGER: gl, SUGGEST_PREV: realLedger && fs.existsSync(realLedger) ? realLedger : 'none' } });
    const last = ((rg.stdout || '') + (rg.stderr || '')).trim().split('\n').pop();
    chk(rg.status === 0 && /^suggest ledger: (written|unchanged)/.test(last), 'G: the real state and lines at the real clock: nothing refused: ' + last);
    if (before && rg.status === 0) { const was = JSON.parse(before), now1 = JSON.parse(fs.readFileSync(gl, 'utf8'));
      chk(Object.entries(was.featured || {}).filter(([, e]) => Date.parse(e.tip) - LOCK <= Date.now()).every(([k, e]) => now1.featured[k] && JSON.stringify(SC.callOf(now1.featured[k])) === JSON.stringify(SC.callOf(e)) || (now1.featured[k] && (now1.featured[k].updates || []).length > (e.updates || []).length)),
        'G: every locked set of the real ledger as it was, but for its grade'); }
  } else chk(true, 'G: no lines.json in this checkout: the real run is skipped');
  end();
})();
