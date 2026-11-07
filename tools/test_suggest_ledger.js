/* The test of tools/suggest_ledger.js and tools/suggest_check.js: the suggestions record's night sets taken, rewritten,
 * locked and graded on made-up days, the per-game sets of the rule before 7 November 2026 kept and graded, and the guard
 * that refuses a ledger whose locked entries moved or whose levels are not their rule's.
 *
 *   node tools/test_suggest_ledger.js      ends "N checks passed"; exit 1 otherwise (about a minute; needs jsdom)
 *
 * Each run is the script itself, as the job runs it, on the built page (index.html) with a state.json, lines.json and box
 * file of this test's own in a scratch folder (SUGGEST_ROOT), the clock set (SUGGEST_NOW), never the real ledger (G alone
 * runs it on a copy of it). The made-up days are in November of the season in play, every game's id, tip-off and line
 * made up, so the test holds in any phase of a season and at any hour. Which games make a night, the pool of legs, every
 * level (by this file's own enumeration of every parlay the night's legs make, at chances and prices it works out itself
 * from the made-up model, lines and same-game table: never the page's search) and every settlement are worked out here
 * on their own.
 *
 *   M  the migration: a ledger holding only per-game (featured) sets, as the file stood on 7 November 2026, one still
 *      to lock: the run drops that one, keeps the rest (but for their grades), adds the night map, and the guard passes
 *      it held to the file it started from. The planted per-game sets hold every rule of a book's settlement, each graded
 *      by its legs' own results worked out here (a moneyline, a spread pushing on a whole line, a total, a player's line
 *      from the state's box lines and one from the season's box file, a player with no box line void, a push and a void
 *      dropping out, the one leg left paid its own price, two legs of the game paid at the same-game price tools/corr.js
 *      gives, every leg a push or void a push; a box not read yet pending; a grade kept when the state can no longer
 *      settle it; last season's entry never regraded; a game's level under two tip-offs counted once; an entry taken
 *      before THREE_FROM with its four levels kept byte for byte); its summary worked out here.
 *   A  the morning of D1: a night set for D1 and for D2 (the lines feed's two dates), none for D3; keyed
 *      season|date|first tip|<season>_<date>_NIGHT, its games every game of its date but the preseason one, its first and
 *      last tip-off, locking 2 hours before the first; its pool exactly this file's own (the band, the far-off guard, team
 *      legs alone though the props model is on); each level the likeliest of this file's own enumeration by its rule;
 *      the same-game copula in the pool's pairs.
 *   B  prices moved: D1's set rewritten, D2's unchanged; B2 the same again writes nothing; B3 a second before D1's lock,
 *      moved back: rewritten.
 *   C  after D1's lock, prices moved again: the set to the byte. C2 after its first tip-off: every level pending.
 *   D  D1 played (one game still out): every level graded by its legs' own results, pending where a leg's game is out;
 *      D3's one-game night taken, Safe its pair and Medium and Aggressive empty saying why word for word; D' the last
 *      game final, every level settled; the night summary worked out here.
 *   E  no game to come: nothing taken, nothing written.
 *   F  the guard: on the script (a locked night edited on disk refused and the last commit's put back; one still to lock
 *      rewritten since the commit not refused; no state refused; a page whose levels are not the three refused; the
 *      command line; the job's one clock), check() on hand-made night ledgers failing every rule, and on hand-made
 *      per-game ledgers failing theirs.
 *   T  a night of exact ties (three games alike, a fourth priced lower on the same chance): each level the one the rule's
 *      tie-breaks give, the higher price then the legs' ids.
 *   G  the real ledger, copied, on the real state and lines.json at the real clock: nothing refused, every locked set as
 *      it was.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(__dirname, 'suggest_ledger.js'), CHECK = path.join(__dirname, 'suggest_check.js');
const SC = require('./suggest_check'), PJ = require('./props'), CJ = require('./corr');
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
const isoS = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
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
const D0 = `${Y}-11-16`, D1 = addDay(D0, 1), D2 = addDay(D0, 2), D3 = addDay(D0, 3), D4 = addDay(D0, 4), D5 = addDay(D0, 6), DW = addDay(D0, -9);
const ymd = d => d.replace(/-/g, '');
const T = (d, hm) => `${d}T${hm}Z`;
const side = (t, out) => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
const mk = (date, a, h, tip, tv, model, o) => ({ id: `${SEASON}_${ymd(date)}_${a}_${h}`, date, tip, type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '9' + ymd(date).slice(4) + a + h,
  tv, awayScore: null, homeScore: null, line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 224, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5 }, ...o });
/* D1 (a Tuesday-like night in November, Eastern standard time): gG (6:45 PM ET, local TV), gC (7 PM, local), gA (7:30 PM,
   NBC), gB (10 PM, Peacock), and gP a preseason game (never in a night); D2: gE (6 PM) and gD (9 PM); D3: gF alone */
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
/* gX: a featured game played three days before the change that took Extreme off (THREE_FROM), its set taken that morning
   with the four levels and graded: kept as it is, byte for byte */
const dX = etDate(Date.parse(SC.THREE_FROM) - 3 * 24 * H), sX = +dX.slice(0, 4) + (+dX.slice(5, 7) >= 8 ? 1 : 0), gXid = `${sX}_${ymd(dX)}_SAC_POR`;
const OLD = `${SEASON - 1}_${Y}0301_ATL_BOS`;

/* the props model's rows ([name, team, pos, min, pts, reb, ast, tpm, stl, blk, dd, td]): on, so the night set is shown to
   take no player leg though the props model prices some */
const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'];
const ROWS = {
  [gA.id]: { 9100001: ['Ace Guard', 'BOS', 'G', 34, 27.5, 5, 6, 3, 1.2, 0.4, 0.2, 0.02], 9100003: ['Cy Big', 'NYK', 'C', 30, 14, 11, 2.5, 0.5, 0.7, 1.6, 0.45, 0.01] },
};
const VAR = REAL.props.dist.var;
const mu = (row, k) => k in REAL.props.combos ? REAL.props.combos[k].reduce((t, s) => t + row[LAY.indexOf(s)], 0) : row[LAY.indexOf(k)];
function mainOf(pid, row, stat, line, sd) {
  const m = mu(row, stat), pOv = PJ.pOver(line, m, PJ.nbVar(m, VAR[stat])), p = sd === 'over' ? pOv : 1 - pOv;
  return sd === 'over' ? { player: String(pid), stat, line, over: am(p - 0.05), under: am(1 - p + 0.08) } : { player: String(pid), stat, line, over: am(1 - p + 0.08), under: am(p - 0.05) };
}
const PLAN = { [gA.id]: [[9100001, 'pts', 24.5, 'over'], [9100003, 'reb', 9.5, 'over']] };
const ids = g => ({ event: 'E' + g.espn, ml: { home: `0ML${g.espn}_1`, away: `0ML${g.espn}_3` }, spread: { home: `0HC${g.espn}_1`, away: `0HC${g.espn}_3` }, total: { over: `0OU${g.espn}_1`, under: `0OU${g.espn}_3` } });
const READ = T(D1, '14:00:00');
/* DraftKings' lines as tools/lines.js writes them: a moneyline with its margin, the spread at the model's number less a
   half point at -110 (o.sp: other prices), the total at the model's points; o.mlShift moves each moneyline */
function lineOf(g, o = {}) {
  const sp = Math.round(-g.model.spread) - 0.5 * Math.sign(g.model.spread || 1), sh = (o.mlShift || {})[g.id] || 0;
  return { at: o.at || READ, espn: g.espn, ml: { home: am(g.model.pHome - 0.06 + sh), away: am(1 - g.model.pHome + 0.08 - sh) },
    spread: { line: -Math.abs(sp) * Math.sign(-g.model.spread || 1), home: (o.sp || {})[g.id] ? o.sp[g.id][0] : -110, away: (o.sp || {})[g.id] ? o.sp[g.id][1] : -110 },
    total: { line: Math.floor(g.model.total) + 0.5, over: -110, under: -110 }, ids: ids(g),
    props: ROWS[g.id] ? { at: o.at || READ, mains: PLAN[g.id].map(([pid, st, ln, s]) => mainOf(pid, ROWS[g.id][pid], st, ln, s)), ladders: [], yes: [] } : null };
}
const linesOf = (games, o = {}) => ({ v: 1, at: o.at || READ, games: Object.fromEntries(games.map(g => [g.id, lineOf(g, o)])) });
/* the state as the job would publish it at a stage: the slate, the props block, the box lines, the finals, the report */
function stateOf(slate, o = {}) {
  const st = clone(REAL);
  st.slate = slate.map(clone); st.today = o.today || D1; st.generated = o.generated || T(D1, '13:00'); st.asOf = D0;
  st.props = { ...clone(REAL.props), games: Object.fromEntries(slate.filter(g => ROWS[g.id] && g.status === 'scheduled').map(g => [g.id, { tip: g.tip, away: g.away, home: g.home, players: clone(ROWS[g.id]) }])) };
  st.props.ledger = { ...st.props.ledger, decision: null };
  st.boxes = { from: addDay(D1, -7), days: 7, line: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'], games: o.boxes || BOX0 };
  st.finals = { ...REAL.finals, [gWid]: [101, 108], [gXid]: [110, 120], ...Object.fromEntries(slate.filter(g => g.status === 'final').map(g => [g.id, [g.awayScore, g.homeScore]])) };
  st.pending = [gZid];
  /* gZ, gW and gX are made up off the slate, in the season's own id space: a real game under any of them must never
     settle them in its place */
  delete st.finals[gZid]; st.record = (REAL.record || []).filter(g => g.id !== gZid && g.id !== gWid && g.id !== gXid);
  st.report = { date: st.today, players: o.report || {} };
  delete st.eloPicks;
  return st;
}
const BOX0 = {
  [gY1.id]: { 9200001: [24, 6, 3, 2, 1, 0], 9200002: [8, 3, 1, 0, 0, 0] },
  [gY2.id]: { 9200003: [12, 7, 2, 1, 0, 1], 9200004: [27, 4, 5, 3, 2, 0] },
  [gY3.id]: { 9200005: [15, 5, 5, 1, 1, 1] },
};
const CSV_HEAD = 'game_id,date,team,opp,home,player_id,name,pos,starter,min,fgm,fga,tpm,tpa,ftm,fta,orb,drb,ast,stl,blk,tov,pf,pm,pts,dnp';
const csvRow = (pid, nm, pts, reb, ast, tpm, stl, blk, dnp, g = [gWid, DW, 'IND', 'MIN']) => [...g, 0, pid, nm, 'G', 1, 30, 0, 0, tpm, 0, 0, 0, 1, reb - 1, ast, stl, blk, 0, 0, 0, pts, dnp ? 1 : 0].join(',');
const gXrow = (pid, nm, pts, reb, team) => csvRow(pid, nm, pts, reb, 3, 1, 0, 0, false, [gXid, dX, team, team === 'POR' ? 'SAC' : 'POR']);
fs.writeFileSync(path.join(DIR, 'data', `box_${SEASON}.csv`), [CSV_HEAD, csvRow(9200006, 'Mo Csv', 18, 4, 3, 2, 1, 0), csvRow(9200007, 'No Csv', 9, 2, 3, 1, 0, 0), csvRow(9200008, 'Oz Dnp', 0, 0, 0, 0, 0, 0, true),
  ...(sX === SEASON ? [gXrow(9200031, 'Qa One', 18, 4, 'POR'), gXrow(9200032, 'Qb Two', 12, 10, 'SAC')] : [])].join('\n') + '\n');

/* ---------- this file's own night: its games, pool, options and every level by its rule ---------- */
const nidOf = d => `${SEASON}_${ymd(d)}_NIGHT`;
const nightGames = (slate, d) => slate.filter(g => g.type !== 'PRE' && g.date === d).map((g, i) => [g, i]).sort((a, b) => Date.parse(a[0].tip) - Date.parse(b[0].tip) || a[1] - b[1]).map(x => x[0]);
const nightKey = (slate, d) => { const G = nightGames(slate, d); return `${SEASON}|${d}|${G[0].tip}|${nidOf(d)}`; };
const SIGMA = 14.5, erfOwn = x => { const s = Math.sign(x), a = Math.abs(x), t = 1 / (1 + 0.3275911 * a); return s * (1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a)); };
const PhiOwn = z => PJ.normCdf(z);
/* the night's pool: every team leg of its games still to tip with DraftKings' price, at the builder's chance (a moneyline
   the model's win chance, a spread Phi((margin + line) / 14.5), a total its two prices with the margin out), 45% to 97%,
   none 15 points or more over DraftKings' fair chance (its two prices with the margin out) */
function poolOwn(slate, lines, now, d) {
  const legs = [];
  for (const g of nightGames(slate, d).filter(g => g.status === 'scheduled' && Date.parse(g.tip) > now)) {
    const x = lines.games[g.id]; if (!x) continue;
    const add = (kind, s, line, odds, other, p) => { const fair = imp(odds) / (imp(odds) + imp(other));
      if (!(p >= 0.45 && p < 0.97) || p - fair >= 0.15 - 1e-9) return;
      legs.push({ sk: [g.id, kind, s, line == null ? '' : line].join('|'), gid: g.id, kind, side: s, line, odds, other, p, d: dec(odds), home: g.home, team: kind === 'total' ? '' : s }); };
    if (x.ml) { add('ml', g.home, null, x.ml.home, x.ml.away, g.model.pHome); add('ml', g.away, null, x.ml.away, x.ml.home, 1 - g.model.pHome); }
    if (x.spread) { const mH = -g.model.spread; add('spread', g.home, x.spread.line, x.spread.home, x.spread.away, PhiOwn((mH + x.spread.line) / SIGMA)); add('spread', g.away, -x.spread.line, x.spread.away, x.spread.home, PhiOwn((-mH - x.spread.line) / SIGMA)); }
    if (x.total) { const po = imp(x.total.over) / (imp(x.total.over) + imp(x.total.under)); add('total', 'over', x.total.line, x.total.over, x.total.under, po); add('total', 'under', x.total.line, x.total.under, x.total.over, 1 - po); }
  }
  return legs.sort((a, b) => a.sk < b.sk ? -1 : 1);
}
const cl = l => l.kind === 'prop' ? { game: l.gid || l.id, kind: l.stat, player: l.pid, team: l.team, side: l.side, home: l.home } : { game: l.gid || l.id, kind: { ml: 'win', spread: 'cover', total: 'over' }[l.kind], team: l.kind === 'total' ? '' : l.side, side: l.side, home: l.home };
const CORR = REAL.corr, HOLD = REAL.corr.hold;
/* each game's options: a leg alone, or its side and its total together at their joint chance (the copula at the
   same-game table's rho) and their price (the product, or the hold over their implied joint chance, the lower) */
function optsOwn(legs) {
  const by = new Map(); for (const l of legs) { if (!by.has(l.gid)) by.set(l.gid, []); by.get(l.gid).push(l); }
  return [...by.values()].map(L => { const o = L.map(l => ({ legs: [l], p: l.p, d: l.d }));
    for (const a of L.filter(l => l.kind !== 'total')) for (const b of L.filter(l => l.kind === 'total')) {
      const rho = CJ.rhoFor(CORR.rho, cl(a), cl(b)); if (rho == null) continue;
      const J = CJ.joint2(imp(a.odds), imp(b.odds), rho || 0);
      o.push({ legs: [a, b], p: CJ.joint2(a.p, b.p, rho || 0), d: J > 0 ? Math.min(a.d * b.d, HOLD / J) : a.d * b.d, rho }); }
    return o; });
}
const LV = [['safe', 2, 2, 0], ['med', 2, 5, 4], ['aggr', 2, 5, 8]];
/* every parlay of the night's options, by brute force (each game: nothing or one option; 5 legs at most), and the best of
   each level by its rule: likelier, then dearer, then fewer legs, then the legs' ids */
function levelsOwn(G) {
  const best = {}; const pick = [];
  const better = (c, b) => !b || c.p > b.p + 1e-12 || (Math.abs(c.p - b.p) <= 1e-12 && (c.d > b.d + 1e-12 || (Math.abs(c.d - b.d) <= 1e-12 && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
  (function go(i, p, d, nL) {
    if (i === G.length) { if (nL < 2) return; const ids = pick.flatMap(o => o.legs.map(l => l.sk)).sort().join(',');
      for (const [id, lo, hi, F] of LV) if (nL >= lo && nL <= hi && d >= F - 1e-9) { const c = { p, d, n: nL, ids }; if (better(c, best[id])) best[id] = c; } return; }
    go(i + 1, p, d, nL);
    for (const o of G[i]) if (nL + o.legs.length <= 5) { pick.push(o); go(i + 1, p * o.p, d * o.d, nL + o.legs.length); pick.pop(); }
  })(0, 1, 1, 0);
  return best;
}
const legKey = l => [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
/* an entry's every level against this file's own: the same legs, its chance and price the own sums' */
function levelsMatch(tag, e, slate, lines, now) {
  const legs = poolOwn(slate, lines, now, e.date), G = optsOwn(legs), B = levelsOwn(G);
  for (const t of e.tiers) {
    const b = B[t.id];
    if (!t.legs) { chk(!b, `${tag} ${t.id}: empty ("${t.why}"), and this file's own enumeration finds none (${b ? b.ids : ''})`); continue; }
    const mine = t.legs.map(legKey).sort().join(',');
    chk(b && b.ids === mine && Math.abs(b.p - t.p) < 6e-5 && Math.abs(b.d - t.dec) < 6e-4,
      `${tag} ${t.id}: the likeliest its rule takes by this file's own enumeration (${b ? `${b.ids} ${(b.p * 100).toFixed(3)}% ${b.d.toFixed(3)}` : 'none'}; the entry ${mine} ${t.p} ${t.dec})`);
  }
  return { legs, G, B };
}
/* every rule an entry keeps, worked out here */
function nightOk(e, slate, d, at) {
  const G = nightGames(slate, d), lock = Date.parse(G[0].tip) - LOCK, last = G.reduce((m, g) => Date.parse(g.tip) > Date.parse(m.tip) ? g : m, G[0]);
  return !!e && e.season === SEASON && e.date === d && e.nid === nidOf(d) && e.tip === G[0].tip && e.last === last.tip && e.lock === minIso(lock) && (!at || e.taken_at === at) && Date.parse(e.taken_at) < lock
    && JSON.stringify(e.games.map(g => g.gid)) === JSON.stringify(G.map(g => g.id)) && e.games.every(g => g.type !== 'PRE')
    && e.tiers.map(t => `${t.id}:${t.label}:${t.min}:${t.max}:${t.price}`).join() === 'safe:Safe:2:2:0,med:Medium:2:5:4,aggr:Aggressive:2:5:8'
    && e.tiers.every(t => t.legs ? t.legs.length >= t.min && t.legs.length <= t.max && t.dec >= t.price && t.legs.every(l => ['ml', 'spread', 'total'].includes(l.kind) && G.some(g => g.id === l.id))
      && [...new Set(t.legs.map(l => l.id))].every(id => t.legs.filter(l => l.id === id && l.kind !== 'total').length <= 1 && t.legs.filter(l => l.id === id && l.kind === 'total').length <= 1) : typeof t.why === 'string' && t.why.length > 0);
}

/* ---------- one run ---------- */
function run(st, lines, now, extra = {}) {
  if (st) fs.writeFileSync(path.join(DIR, 'state.json'), JSON.stringify(st)); else { try { fs.unlinkSync(path.join(DIR, 'state.json')); } catch (e) {} }
  if (lines) fs.writeFileSync(path.join(DIR, 'lines.json'), JSON.stringify(lines));
  const r = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, SUGGEST_NOW: now, SUGGEST_ROOT: extra.root || DIR, SUGGEST_LEDGER: extra.ledger || LEDGER, SUGGEST_PREV: 'none', ...extra.env } });
  const out = (r.stdout || '') + (r.stderr || '');
  return { code: r.status, out, last: out.trim().split('\n').pop() };
}
const read = () => JSON.parse(fs.readFileSync(LEDGER, 'utf8'));
const bytes = () => fs.readFileSync(LEDGER, 'utf8');
const plant = L => { L.featured = Object.fromEntries(Object.keys(L.featured || {}).sort().map(k => [k, L.featured[k]])); L.featured_summary = SC.summarize(L.featured);
  if ('night' in L) { L.night = Object.fromEntries(Object.keys(L.night).sort().map(k => [k, L.night[k]])); L.night_summary = SC.summarizeNight(L.night); }
  fs.writeFileSync(LEDGER, SC.dumps(L) + '\n'); };
const lineIn = (text, key) => text.split('\n').find(l => l.startsWith(`  ${JSON.stringify(key)}:`)) || null;
const entryOfLine = (line, key) => JSON.parse(line.slice(`  ${JSON.stringify(key)}: `.length).replace(/,$/, ''));

(async () => {
  /* ---------- the per-game entries of the rule before (featured), planted as the file stood ---------- */
  const at0 = T(D0, '15:00:00');
  const legT = (g, kind, s, line, odds, other, x = {}) => ({ id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip, at: at0, kind, side: s, line, odds, other, dk: null, name: kind === 'total' ? `${g.away} at ${g.home}` : s, label: kind, p: 0.6, fair: 0.55, fair_est: false, thin: false, market: kind === 'total', ...x });
  const legP = (g, pid, nm, team, stat, mk1, line, s, odds, x = {}) => ({ id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip, kind: 'prop', pid: String(pid), name: nm, team, at: at0, stat, mk: mk1, line: mk1 === 'main' ? line : undefined, k: mk1 === 'mile' ? line : undefined, side: s, odds, other: mk1 === 'main' ? 110 : null, label: stat, p: 0.6, fair: 0.55, fair_est: false, thin: false, market: false, ...x });
  const lvl = (id, legs, o = {}) => ({ id, label: SC.LABELS[id], n: SC.LEGS[id], floor: { safe: 0, med: 0.25, aggr: 0.12, xtrm: 0.05 }[id], legs, p: 0.31, fair: 0.25, fair_est: true, dec: r3(legs.reduce((d, l) => d * dec(l.odds), 1)), likeliest: false, thin: 0, mkt: legs.filter(l => l.market).length, ...o });
  const why = id => ({ id, label: SC.LABELS[id], n: SC.LEGS[id], floor: { safe: 0, med: 0.25, aggr: 0.12, xtrm: 0.05 }[id], why: 'No legs in this game.' });
  const ent = (g, tiers, { four, ...o } = {}) => ({ season: +g.id.slice(0, 4), date: g.date, gid: g.id, away: g.away, home: g.home, type: 'REG', tip: g.tip, lock: minIso(Date.parse(g.tip) - LOCK), tv: g.tv || ['ESPN'], generated: T(g.date, '12:00'),
    pool: { pref: 3, thin: 0, mkt: 1, far: 0, held: 0 }, tiers: (four ? SC.OLD_TIERS : SC.TIERS).map(id => tiers[id] || why(id)), taken_at: T(g.date, '15:00:00'), ...o });
  const gZ = { id: gZid, date: D0, tip: T(D1, '00:30'), away: 'WAS', home: 'BKN', tv: ['ESPN'] };
  const gW = { id: gWid, date: DW, tip: T(addDay(DW, 1), '00:00'), away: 'IND', home: 'MIN', tv: ['NBA TV'] };
  const gO = { id: OLD, date: `${Y}-03-01`, tip: `${Y}-03-02T00:30Z`, away: 'ATL', home: 'BOS', tv: ['ESPN'] };
  const gY2old = { ...gY2, tip: T(D1, '00:30') };
  const gX = { id: gXid, date: dX, tip: T(addDay(dX, 1), '02:00'), away: 'SAC', home: 'POR', tv: ['NBA TV'] };
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
    E8: ent(gX, { safe: lvl('safe', [legT(gX, 'ml', 'POR', null, -150, 130), legT(gX, 'total', 'over', 228.5, -110, -110)]),
      xtrm: lvl('xtrm', [legT(gX, 'ml', 'POR', null, -150, 130), legT(gX, 'total', 'over', 228.5, -110, -110), legP(gX, 9200031, 'Qa One', 'POR', 'pts', 'main', 20.5, 'over', -115),
        legP(gX, 9200032, 'Qb Two', 'SAC', 'reb', 'main', 8.5, 'over', -110), legP(gX, 9200033, 'Qc Three', 'SAC', 'ast', 'main', 5.5, 'under', -120)]) }, { four: true }),
    /* a per-game set still to lock on the morning of D1 (gA's, taken by a run of the rule before): no longer offered */
    EA: ent(gA, { safe: lvl('safe', [legT(gA, 'ml', 'NYK', null, -150, 130, { at: T(D1, '09:00:00') }), legT(gA, 'total', 'over', 226.5, -110, -110, { at: T(D1, '09:00:00') })]) }, { generated: T(D1, '09:00'), taken_at: T(D1, '09:10:00') }),
  };
  P.E4.grade = { safe: { result: 'won', legs: ['win', 'win'], payout: P.E4.tiers[0].dec } };
  P.E5.grade = { safe: { result: 'lost', legs: ['loss', 'win'], payout: 0 } };
  P.E8.grade = { safe: { result: 'won', legs: ['win', 'win'], payout: P.E8.tiers[0].dec }, xtrm: { result: 'lost', legs: ['win', 'win', 'loss', 'win', 'void'], payout: 0 } };

  console.log('M. the migration: a ledger of per-game sets alone');
  const M0 = { how: 'the file as it stood', since: '2026-10-25', updated: T(D1, '09:10:00'), featured: Object.fromEntries(Object.values(P).map(e => [SC.keyOf(e), e])) };
  plant(M0);
  const m0 = bytes(), mFile = path.join(DIR, 'm0.json'); fs.writeFileSync(mFile, m0);
  chk(!('night' in JSON.parse(m0)) && SC.check(JSON.parse(m0), null, Date.parse(T(D1, '09:30:00')), null, SEASON).length === 0, 'M: the planted per-game ledger, with no night map, passes the guard: ' + SC.check(JSON.parse(m0), null, Date.parse(T(D1, '09:30:00')), null, SEASON).slice(0, 2).join(' | '));
  const day1 = [gY1, gY2, gY3, gY4, gG, gC, gA, gB, gP, gD, gE, gF];
  const tA = T(D1, '15:00:00'), L1 = linesOf([gG, gC, gA, gB, gD, gE]);
  let r = run(stateOf(day1), L1, tA);
  chk(r.code === 0 && /^suggest ledger: written/.test(r.last), 'M/A: the run writes: ' + r.last);
  let L = read();
  const kEA = SC.keyOf(P.EA);
  chk(!L.featured[kEA] && /dropped .*BOS_NYK, a per-game set no longer offered/.test(r.out), 'M: the per-game set still to lock is dropped, no longer offered');
  chk(Object.keys(P).filter(k => k !== 'EA').every(k => { const key = SC.keyOf(P[k]), e = L.featured[key]; return e && JSON.stringify(SC.callOf(e)) === JSON.stringify(SC.callOf(P[k])); }), 'M: every other per-game set stands as it was taken, but for its grade');
  chk(['E4', 'E5', 'E8'].every(k => lineIn(bytes(), SC.keyOf(P[k])) === lineIn(m0, SC.keyOf(P[k]))), 'M: those already graded (a grade the state cannot settle, last season\'s, one taken before THREE_FROM with four levels) byte for byte');
  chk('night' in L && 'night_summary' in L && SC.check(L, JSON.parse(m0), Date.parse(tA), tA, SEASON).length === 0, 'M: the night map added, and the guard passes it held to the file it started from: ' + SC.check(L, JSON.parse(m0), Date.parse(tA), tA, SEASON).slice(0, 2).join(' | '));
  /* the per-game settlement, worked out here from the raw scores and box lines */
  { const csvBox = { 9200006: [18, 4, 3, 2, 1, 0], 9200007: [9, 2, 3, 1, 0, 0] }, stM = stateOf(day1);
    const scoreOf = id => { const g = stM.slate.find(x => x.id === id && x.status === 'final'); return g ? [g.awayScore, g.homeScore] : stM.finals[id] && id !== gZid ? stM.finals[id] : null; };
    const settleP = l => { const sc = scoreOf(l.id); if (!sc) return null; const [as, hs] = sc;
      if (l.kind === 'ml') return hs === as ? 'push' : (hs > as) === (l.side === l.home) ? 'win' : 'loss';
      if (l.kind === 'spread') { const m = (l.side === l.home ? hs - as : as - hs) + l.line; return m === 0 ? 'push' : m > 0 ? 'win' : 'loss'; }
      if (l.kind === 'total') { const t = as + hs; return t === l.line ? 'push' : (t > l.line) === (l.side === 'over') ? 'win' : 'loss'; }
      const box = l.id === gWid ? csvBox : BOX0[l.id]; if (!box) return null; const row = box[l.pid]; if (!row) return 'void';
      const v = { pts: [0], reb: [1], ast: [2] }[l.stat].reduce((s, i) => s + row[i], 0);
      if (l.mk === 'main') return v === l.line ? 'push' : (v > l.line) === (l.side === 'over') ? 'win' : 'loss';
      return v >= l.k ? 'win' : 'loss'; };
    const payOwn = (t, res) => { if (res.includes('loss')) return { result: 'lost', payout: 0 }; if (res.some(x => x == null)) return { result: 'pending' };
      const left = t.legs.filter((l, i) => res[i] === 'win'); if (!left.length) return { result: 'push', payout: 1 };
      if (left.length === t.legs.length) return { result: 'won', payout: t.dec }; if (left.length === 1) return { result: 'won', payout: r3(dec(left[0].odds)) };
      const [a, b] = left, rho = CJ.rhoFor(CORR.rho, cl(a), cl(b)) || 0, J = CJ.joint2(imp(a.odds), imp(b.odds), rho); return { result: 'won', payout: r3(Math.min(dec(a.odds) * dec(b.odds), HOLD / J)) }; };
    let graded = 0;
    for (const [k, e] of Object.entries(L.featured)) {
      if (e.season !== SEASON || e.gid === gXid) continue;
      for (const t of e.tiers) { if (!t.legs) continue; const res = t.legs.map(settleP), want = e.gid === gZid ? { result: 'won', payout: t.dec } : payOwn(t, res), g = e.grade && e.grade[t.id];
        chk(g && g.result === want.result && (want.payout === undefined || g.payout === want.payout) && (e.gid === gZid || JSON.stringify(g.legs) === JSON.stringify(res)), `M: ${k} ${t.id} graded ${g && g.result} ${g && g.payout}, worked out here ${want.result} ${want.payout} on ${JSON.stringify(res)}`); graded++; } }
    const gr = k => L.featured[SC.keyOf(P[k])].grade.safe;
    chk(gr('E1').result === 'won' && gr('E1').payout === r3(dec(-150)) && L.featured[SC.keyOf(P.E1)].grade.med.result === 'won', 'M: a moneyline won beside a total pushing on its whole line pays the moneyline\'s own price; a player with no box line is void and the two legs left pay the same-game price');
    chk(gr('E3').result === 'push' && gr('E3').payout === 1 && gr('E7').result === 'pending' && JSON.stringify(L.featured[SC.keyOf(P.E5)].grade) === JSON.stringify(P.E5.grade), 'M: a push and a void a push; a box not read pending; last season\'s grade never redone');
    chk(L.featured[SC.keyOf(P.E6)].grade.med.result === 'lost' && JSON.stringify(L.featured[SC.keyOf(P.E6)].grade.med.legs) === '["win","loss","void"]', "M: an older game graded from the season's box file (a milestone missed, a row marked did-not-play void)");
    chk(graded >= 9 && L.featured_summary.tiers.xtrm.graded === 1 && L.featured_summary.tiers.xtrm.won === 0 && L.featured_summary.tiers.safe.graded === [...new Set(Object.values(L.featured).filter(e => e.grade && e.grade.safe && e.grade.safe.result !== 'pending' && e.grade.safe.result !== 'push').map(e => e.season + e.gid))].length,
      `M: every level of the played per-game sets checked (${graded}); the summary keeps Extreme's record and counts each game's level once (gY2's Safe under two tip-offs once)`); }

  console.log('A. the morning of D1');
  const kD1 = nightKey(day1, D1), kD2 = nightKey(day1, D2);
  chk(JSON.stringify(Object.keys(L.night).sort()) === JSON.stringify([kD1, kD2].sort()), `A: a night set for D1 and D2, the lines feed's two dates, none for D3: ${Object.keys(L.night).join(', ')}`);
  chk(nightOk(L.night[kD1], day1, D1, tA) && nightOk(L.night[kD2], day1, D2, tA), 'A: each keyed season|date|first tip|night, its games every game of its date but the preseason one in tip-off order, its first and last tip-off, locking 2 hours before the first, its levels Safe (2), Medium (2 to 5, $4+) and Aggressive (2 to 5, $8+), team legs alone, one side and one total a game');
  const eD1 = L.night[kD1];
  { const own = poolOwn(day1, L1, Date.parse(tA), D1), kept = eD1.pool.legs;
    chk(JSON.stringify(kept.map(x => x[0])) === JSON.stringify(own.map(l => l.sk)) && kept.every((x, i) => x[1] === own[i].odds && Math.abs(x[2] - own[i].p) < 2e-6),
      `A: D1's pool is this file's own (every team leg at DraftKings' price, 45% to 97%, none far off, no player leg though the props model prices two): ${kept.length} legs`);
    chk(eD1.pool.legs.every(x => !/\|prop\|/.test(x[0])) && eD1.tiers.every(t => !t.legs || t.legs.every(l => l.kind !== 'prop')), 'A: no player leg in the pool or a level');
    const G = optsOwn(own), pairsOwn = G.flatMap(o => o.filter(x => x.legs.length === 2));
    chk(eD1.pool.pairs.length === pairsOwn.length && eD1.pool.pairs.every(x => { const a = kept[x[0]][0], b = kept[x[1]][0], o = pairsOwn.find(y => [a, b].sort().join() === y.legs.map(l => l.sk).sort().join()); return o && Math.abs(o.p - x[2]) < 2e-6 && Math.abs(o.d - x[3]) < 2e-6; }),
      `A: each game's side and total together at the copula's joint chance and the same-game price (${eD1.pool.pairs.length} pairs)`);
    chk(pairsOwn.some(o => Math.abs(o.p - o.legs[0].p * o.legs[1].p) > 1e-4), 'A: the same-game table moves a pair\'s chance off the product of its legs (the copula is met)'); }
  levelsMatch('A D1', eD1, day1, L1, Date.parse(tA));
  levelsMatch('A D2', L.night[kD2], day1, L1, Date.parse(tA));
  chk(eD1.tiers.every(t => t.legs) && eD1.tiers[1].dec >= 4 && eD1.tiers[2].dec >= 8, `A: D1's three levels all built, Medium paying ${eD1.tiers[1].dec} and Aggressive ${eD1.tiers[2].dec} on $1`);
  chk(eD1.tiers.every(t => !t.legs || t.legs.every(l => { const x = L1.games[l.id]; return l.kind === 'ml' ? l.odds === x.ml[l.side === l.home ? 'home' : 'away'] : l.kind === 'spread' ? l.odds === x.spread[l.side === l.home ? 'home' : 'away'] : l.odds === x.total[l.side]; })), "A: every leg at DraftKings' price in lines.json");

  console.log('B. prices moved');
  const tB = T(D1, '19:00:00'), L2 = { ...L1, games: { ...L1.games, ...linesOf([gG, gC, gA, gB], { mlShift: { [gA.id]: 0.04, [gG.id]: -0.03 }, sp: { [gC.id]: [-105, -115] }, at: T(D1, '18:30:00') }).games } };
  r = run(stateOf(day1, { generated: T(D1, '18:40') }), L2, tB); L = read();
  chk(r.code === 0 && L.night[kD1].taken_at === tB && JSON.stringify(L.night[kD1].pool) !== JSON.stringify(eD1.pool), 'B: D1\'s prices moved, its set rewritten: ' + r.last);
  chk(L.night[kD2].taken_at === tA && new RegExp(`${kD2.replace(/[|]/g, '\\|')} unchanged`).test(r.out), "B: D2's, its lines as they were, unchanged");
  levelsMatch('B D1', L.night[kD1], day1, L2, Date.parse(tB));
  const b1 = bytes();
  r = run(stateOf(day1, { generated: T(D1, '18:40') }), null, T(D1, '19:10:00'));
  chk(r.code === 0 && /^suggest ledger: unchanged/.test(r.last) && bytes() === b1, 'B2: the same again writes nothing: ' + r.last);
  const lockD1 = Date.parse(gG.tip) - LOCK, tB3 = isoS(lockD1 - 1000);
  r = run(stateOf(day1, { generated: T(D1, '21:00') }), L1, tB3); L = read();
  chk(r.code === 0 && L.night[kD1].taken_at === tB3 && JSON.stringify(L.night[kD1].tiers) === JSON.stringify(eD1.tiers), 'B3: a second before its lock, the prices back, the set is rewritten (to what the morning had)');
  const lineB3 = lineIn(bytes(), kD1);

  console.log('C. after the lock');
  /* C0: the night's first tip-off moved later after the lock (gG from 6:45 to 7:15 PM ET, so the night's first is gC at
     7 PM and its own lock, 5 PM, still to come): the night is held as it locked, and no new set is taken on later lines */
  { const moved = day1.map(g => g.id === gG.id ? { ...g, tip: T(D2, '00:15') } : g), tC0 = isoS(lockD1 + 5 * 60e3);
    r = run(stateOf(moved, { generated: T(D1, '21:40') }), L2, tC0);
    const keysD1 = Object.keys(read().night).filter(k => k.endsWith('|' + nidOf(D1)));
    chk(r.code === 0 && keysD1.length === 1 && keysD1[0] === kD1 && lineIn(bytes(), kD1) === lineB3 && new RegExp(`${nidOf(D1)} \\(locked at ${minIso(lockD1)}\\) held: its first tip-off moved after the lock`).test(r.out),
      `C0: the night's first tip-off moved later after its lock: held as it locked, no second set taken on the later lines (${keysD1.join(', ')}): ${r.last}`); }
  const tC = isoS(lockD1 + 30 * 60e3);
  r = run(stateOf(day1, { generated: T(D1, '22:00') }), L2, tC);
  chk(r.code === 0 && lineIn(bytes(), kD1) === lineB3 && /1 night set locked/.test(r.out), 'C: locked, the set stays as the last run before the lock left it, to the byte, though its prices moved: ' + r.last);
  /* a game of the night moved off its date after the lock (gB postponed a day) changes nothing of the locked set */
  r = run(stateOf(day1.map(g => g.id === gB.id ? { ...g, tip: T(D3, '03:00') } : g), { generated: T(D1, '22:10') }), L2, isoS(lockD1 + 40 * 60e3));
  chk(r.code === 0 && lineIn(bytes(), kD1) === lineB3, 'C: a game of the night moved after the lock changes nothing of its locked set');
  const tC2 = isoS(Date.parse(gG.tip) + 15 * 60e3);
  r = run(stateOf(day1, { generated: T(D1, '23:50') }), L2, tC2); L = read();
  chk(r.code === 0 && JSON.stringify(SC.callOf(L.night[kD1])) === JSON.stringify(SC.callOf(entryOfLine(lineB3, kD1))) && L.night[kD1].grade && Object.values(L.night[kD1].grade).every(g => g.result === 'pending'),
    'C2: after its first tip-off nothing changes but the grade, every level pending (no game final)');

  console.log('D. D1 played');
  /* finals: gG ATL 99 at CHA 104, gC MIA 101 at ORL 98, gA BOS 120 at NYK 112; gB still out */
  const day2 = day1.map(g => g.id === gG.id ? fin(g, 99, 104) : g.id === gC.id ? fin(g, 101, 98) : g.id === gA.id ? fin(g, 120, 112) : g);
  const tD = T(D2, '12:00:00'), L3 = linesOf([gD, gE, gF], { at: T(D2, '11:00:00') });
  const stD = stateOf(day2, { today: D2, generated: T(D2, '11:00') });
  r = run(stD, L3, tD); L = read();
  chk(r.code === 0, 'D: the run grades and writes: ' + r.last);
  const scoreN = (st, id) => { const g = st.slate.find(x => x.id === id && x.status === 'final'); return g ? [g.awayScore, g.homeScore] : null; };
  const settleN = (st, l) => { const sc = scoreN(st, l.id); if (!sc) return null; const [as, hs] = sc;
    if (l.kind === 'ml') return hs === as ? 'push' : (hs > as) === (l.side === l.home) ? 'win' : 'loss';
    if (l.kind === 'spread') { const m = (l.side === l.home ? hs - as : as - hs) + l.line; return m === 0 ? 'push' : m > 0 ? 'win' : 'loss'; }
    const t = as + hs; return t === l.line ? 'push' : (t > l.line) === (l.side === 'over') ? 'win' : 'loss'; };
  const gradeOwn = (st, t) => { const res = t.legs.map(l => settleN(st, l)); if (res.includes('loss')) return { result: 'lost', payout: 0, res }; if (res.some(x => x == null)) return { result: 'pending', res };
    return { result: 'won', payout: t.dec, res }; };
  { const e = L.night[kD1];
    for (const t of e.tiers) { if (!t.legs) continue; const w = gradeOwn(stD, t), g = e.grade[t.id];
      chk(g && g.result === w.result && (w.payout === undefined || g.payout === w.payout) && JSON.stringify(g.legs) === JSON.stringify(w.res), `D: D1 ${t.id} graded ${g && g.result} on ${JSON.stringify(g && g.legs)}, worked out here ${w.result} on ${JSON.stringify(w.res)}`); } }
  chk(Object.values(L.night[kD1].grade).some(g => g.result === 'lost' && g.legs.includes(null) && g.payout === 0),
    `D: a level with a leg lost is lost at once, though another leg's game is still out, as a book settles it (${Object.entries(L.night[kD1].grade).map(([k, g]) => `${k} ${g.result} ${JSON.stringify(g.legs)}`).join('; ')})`);
  const kD3 = nightKey(day2, D3);
  chk(nightOk(L.night[kD3], day2, D3, tD) && L.night[kD2].taken_at === tD, "D: D3's one-game night taken (now one of the lines feed's dates); D2's rewritten on its new read");
  levelsMatch('D D2', L.night[kD2], day2, L3, Date.parse(tD));
  levelsMatch('D D3', L.night[kD3], day2, L3, Date.parse(tD));
  { const t3 = L.night[kD3].tiers;
    chk(t3[0].legs && t3[0].legs.length === 2 && t3[0].legs.every(l => l.id === gF.id) && t3[0].legs.some(l => l.kind === 'total'), "D: the one-game night's Safe is its side and total together");
    chk(t3[1].why === 'No parlay of the night’s legs pays $4 or more on $1: one game makes 2 legs at most.' && t3[2].why === 'No parlay of the night’s legs pays $8 or more on $1: one game makes 2 legs at most.',
      `D: its Medium and Aggressive empty, saying why word for word ("${t3[1].why}" / "${t3[2].why}")`); }
  chk(SC.check(L, null, Date.parse(tD), null, SEASON).length === 0, 'D: the graded ledger passes the guard: ' + SC.check(L, null, Date.parse(tD), null, SEASON).slice(0, 2).join(' | '));
  /* D': the last game final */
  const day2b = day2.map(g => g.id === gB.id ? fin(g, 110, 111) : g), stD2 = stateOf(day2b, { today: D2, generated: T(D2, '13:00') }), tD2 = T(D2, '13:30:00');
  r = run(stD2, L3, tD2); L = read();
  { const e = L.night[kD1];
    chk(r.code === 0 && e.tiers.every(t => !t.legs || (() => { const w = gradeOwn(stD2, t), g = e.grade[t.id]; return g.result === w.result && g.result !== 'pending' && JSON.stringify(g.legs) === JSON.stringify(w.res) && (w.result !== 'won' || g.payout === t.dec); })()),
      `D': the last game final, every level of D1 settled as worked out here (${e.tiers.map(t => `${t.id} ${e.grade[t.id] && e.grade[t.id].result}`).join(', ')})`); }
  { const q = L.night_summary, own = { safe: [0, 0, 0], med: [0, 0, 0], aggr: [0, 0, 0] };
    for (const e of Object.values(L.night)) for (const t of e.tiers) { const g = e.grade && e.grade[t.id]; if (!g || !t.legs || g.result === 'pending') continue; const s = own[t.id]; s[0]++; if (g.result === 'won') s[1]++; s[2] += g.payout - 1; }
    chk(['safe', 'med', 'aggr'].every(id => q.tiers[id].graded === own[id][0] && q.tiers[id].won === own[id][1] && Math.abs(q.tiers[id].units - own[id][2]) < 0.0015) && q.entries === Object.keys(L.night).length,
      `D': the night summary is the grades' (${['safe', 'med', 'aggr'].map(id => `${id} ${q.tiers[id].won}/${q.tiers[id].graded}`).join(', ')})`); }
  const good = bytes(), goodFile = path.join(DIR, 'good.json'); fs.writeFileSync(goodFile, good);

  console.log('E. no game to come');
  const tE = T(D5, '12:00:00'), day9 = day2b.map(g => g.status === 'scheduled' ? fin(g, 100, 102) : g);
  r = run(stateOf(day9, { today: D5, generated: T(D5, '11:00') }), { v: 1, at: tE, games: {} }, tE);
  const eE = bytes();
  chk(r.code === 0 && /no night on the lines feed's dates/.test(r.last) && Object.keys(read().night).every(k => k in JSON.parse(good).night), 'E: nothing new is taken: ' + r.last);
  r = run(stateOf(day9, { today: D5, generated: T(D5, '11:00') }), null, T(D5, '12:10:00'));
  chk(r.code === 0 && /unchanged/.test(r.last) && bytes() === eE, 'E2: and nothing is written: ' + r.last);

  console.log('F. the guard');
  fs.writeFileSync(LEDGER, good);
  /* a ledger on disk whose locked night was edited: refused, and the last commit's put back */
  const ed = JSON.parse(good); ed.night[kD1].tiers[0].legs[0].odds += 10; plant(ed);
  r = run(stD2, L3, tD2, { env: { SUGGEST_PREV: goodFile } });
  chk(r.code === 1 && /refused/.test(r.last) && bytes() === good, "F: a locked night edited on disk is refused, and the last commit's file put back: " + r.last);
  /* a night still to lock rewritten since the commit: not refused */
  const ed2 = JSON.parse(good); ed2.night[kD3] = { ...ed2.night[kD3], taken_at: T(D2, '13:00:00') }; plant(ed2);
  r = run(stD2, L3, tD2, { env: { SUGGEST_PREV: goodFile } });
  chk(r.code === 0, 'F: a night still to lock that an earlier run rewrote since the commit is not refused: ' + r.last);
  fs.writeFileSync(LEDGER, good);
  r = run(null, null, tD2);
  chk(r.code === 1 && /refused/.test(r.last) && bytes() === good, 'F: a state that is not there is refused, the file untouched: ' + r.last);
  /* a page whose levels are not the three (Medium's floor at $3): refused, the file untouched */
  { const page = path.join(DIR, 'index.html'), was = fs.readFileSync(page, 'utf8'), from = "['med', 'Medium', 2, 5, 4]";
    if (was.split(from).length === 2) {
      fs.writeFileSync(page, was.replace(from, "['med', 'Medium', 2, 5, 3]"));
      try { r = run(stD2, L3, tD2); } finally { fs.writeFileSync(page, was); }
      chk(r.code === 1 && /the page's levels are not the three this record keeps/.test(r.last) && bytes() === good, 'F: a page whose levels are not the three is refused, the file untouched: ' + r.last);
    } else chk(false, "F: the built page sets SP_LEVELS' Medium exactly once"); }
  const cl1 = cp.spawnSync('node', [CHECK, '--prev', goodFile, '--now', tD2], { encoding: 'utf8', env: { ...process.env, SUGGEST_LEDGER: LEDGER, SUGGEST_STATE: path.join(DIR, 'state.json') } });
  chk(cl1.status === 0 && /suggest check: 0 failures/.test(cl1.stdout), 'F: the command line passes the good file: ' + cl1.stdout.trim());
  plant(ed);
  const cl2 = cp.spawnSync('node', [CHECK, '--prev', goodFile, '--now', tD2], { encoding: 'utf8', env: { ...process.env, SUGGEST_LEDGER: LEDGER, SUGGEST_STATE: path.join(DIR, 'state.json') } });
  chk(cl2.status === 1 && /a night set locked at .*, and changed/.test(cl2.stdout), 'F: and fails a locked night edited: ' + cl2.stdout.trim().split('\n').pop());
  fs.writeFileSync(LEDGER, good);

  /* check() on hand-made night ledgers: every rule */
  const base = JSON.parse(good), now = Date.parse(tD2);
  const fails1 = (mut, re, what, prev = base, runAt = null, season = SEASON) => { const L1x = clone(base); mut(L1x); if (L1x.__keep !== true) { L1x.featured_summary = SC.summarize(L1x.featured); L1x.night_summary = SC.summarizeNight(L1x.night); } delete L1x.__keep;
    const b = SC.check(L1x, prev, now, runAt, season); chk(b.some(x => re.test(x)), `check fails ${what}: ${b.slice(0, 2).join(' | ') || 'nothing'}`); return b; };
  chk(SC.check(base, base, now, null, SEASON).length === 0, 'check passes the good ledger against itself');
  const N3 = L => L.night[kD3], N1 = L => L.night[kD1];
  fails1(L => { L.night['x|' + kD3] = N3(L); }, /not keyed on its own/, 'a night keyed on another key');
  fails1(L => { N3(L).nid = `${SEASON}_${ymd(D2)}_NIGHT`; }, /night id .* is not of its season and date|not keyed/, 'a night id not of its date');
  fails1(L => { N3(L).games[0].gid = `${SEASON}_${ymd(D2)}_MIL_TOR`; }, /not of its season, date and clubs/, 'a game of another date');
  fails1(L => { N3(L).games[0].type = 'PRE'; }, /a preseason game/, 'a preseason game in a night');
  fails1(L => { N3(L).games[0].tip = T(D3, '15:00'); }, /tips off .*, not on .* in New York|is not its games' first/, "a game tipping on another Eastern date");
  fails1(L => { N3(L).last = T(D4, '01:30'); }, /last tip-off .* is not its games' last/, 'a last tip-off not the games\' last');
  fails1(L => { N3(L).lock = minIso(Date.parse(N3(L).tip) - 3 * H); }, /not 2 hours before its first tip-off/, 'a lock not 2 hours before the first tip-off');
  fails1(L => { N3(L).taken_at = isoS(Date.parse(N3(L).tip) - H); }, /at or after its lock/, 'a set taken after its lock');
  fails1(L => { N3(L).tiers.reverse(); }, /its levels are not the three/, 'levels out of order');
  fails1(L => { N3(L).tiers.pop(); }, /its levels are not the three/, 'a level missing');
  fails1(L => { N3(L).tiers[1].price = 3; }, /not the level's own label, range and floor/, 'a floor not the level\'s own');
  /* on D2's night (several games, every level built) */
  const N2 = L => L.night[kD2];
  const base2 = N2(base);
  chk(base2.tiers.every(t => t.legs), `F: D2's night builds all three levels to plant on (${base2.tiers.map(t => t.legs ? t.legs.length : 0).join(', ')})`);
  fails1(L => { const t = N2(L).tiers[1]; t.legs = [t.legs[0]]; }, /1 legs, outside its 2 to 5/, 'a level of 1 leg');
  fails1(L => { const t = N2(L).tiers[1]; t.legs[0] = { ...t.legs[0], id: gF.id }; }, /a leg on no game of the night/, 'a leg of another night');
  fails1(L => { const t = N2(L).tiers[0]; t.legs[0] = { ...t.legs[0], kind: 'prop', pid: '1', stat: 'pts' }; }, /a player's leg/, 'a player\'s leg');
  fails1(L => { const t = N2(L).tiers[2]; t.legs.push(clone(t.legs[0])); }, /a leg twice/, 'a leg twice');
  /* one side and one total a game: the level's game's other side added (its pool has it), the rule refused */
  { const e = N2(base), t = e.tiers.find(x => x.legs.some(l => l.kind !== 'total') && x.legs.length < 5), l0 = t.legs.find(l => l.kind !== 'total');
    const other = e.pool.legs.map(x => x[0]).find(sk => sk.startsWith(l0.id + '|') && !/\|total\|/.test(sk) && sk !== legKey(l0));
    if (other) { const [gid, kind, s, line] = other.split('|');
      fails1(L => { const tt = N2(L).tiers.find(x => x.id === t.id); tt.legs.push({ ...clone(l0), kind, side: s, line: line === '' ? null : +line }); }, /two side bets or two totals of one game/, 'two side bets of one game');
    } else chk(false, 'F: (no other side in the pool to plant two side bets of one game)'); }
  fails1(L => { N2(L).tiers[1].dec = 3.9; }, /under its floor 4/, 'a Medium paying under $4');
  fails1(L => { N2(L).tiers[2].dec = 7.99; }, /under its floor 8/, 'an Aggressive paying under $8');
  fails1(L => { N2(L).tiers[0].legs[0].odds += 5; }, /not in its pool at its own price and chance/, 'a leg off its pool\'s price');
  fails1(L => { N2(L).tiers[0].p += 0.01; }, /are not its legs' as its pool has them/, 'a chance not its legs\'');
  /* the likeliest rule: a level swapped for another parlay its rule takes, of a lower chance */
  { const e = N2(base), lv = SC.NIGHT_LEVELS[1], pool = SC.nightPool(e), alt = [];
    (function go(i, picked, p, d, k) { if (alt.length) return; if (i === pool.games.length) { if (k >= 2 && k <= 5 && d >= lv[4] && picked.map(l => l.sk).sort().join() !== e.tiers[1].legs.map(legKey).sort().join()) alt.push({ picked, p, d }); return; }
      go(i + 1, picked, p, d, k); for (const o of pool.games[i]) if (k + o.legs.length <= 5) go(i + 1, [...picked, ...o.legs], p * o.p, d * o.d, k + o.legs.length); })(0, [], 1, 1, 0);
    if (alt.length) { const a = alt[0], legs = a.picked.map(pl => { const [gid, kind, s, line] = pl.sk.split('|'), g = day2b.find(x => x.id === gid);
        return { id: gid, away: g.away, home: g.home, date: g.date, tip: g.tip, at: T(D2, '11:00:00'), kind, side: s, line: line === '' ? null : +line, odds: pl.odds, other: -110, dk: null, name: s, label: kind, p: pl.p, fair: 0.5, fair_est: false, thin: true, market: kind === 'total' }; });
      fails1(L => { const t = N2(L).tiers[1]; t.legs = legs; t.p = Math.round(a.p * 1e4) / 1e4; t.dec = Math.round(a.d * 1e3) / 1e3; }, /not the likeliest its rule takes/, `a Medium not the likeliest (${(a.p * 100).toFixed(2)}% where the rule's is ${(e.tiers[1].p * 100).toFixed(2)}%)`);
    } else chk(false, 'F: (no other Medium to plant)'); }
  fails1(L => { const t = N2(L).tiers[2]; N2(L).tiers[2] = { id: t.id, label: t.label, min: t.min, max: t.max, price: t.price, why: 'No parlay.' }; }, /empty, and the pool makes a parlay its rule takes/, 'a level empty where its rule takes a parlay');
  fails1(L => { N2(L).grade = { safe: { result: 'pending', legs: [null, null] } }; }, /graded before its first tip-off/, 'a grade before the first tip-off');
  fails1(L => { const g = N1(L).grade.safe; g.result = g.result === 'won' ? 'lost' : 'won'; g.payout = g.result === 'won' ? 2 : 0; }, /graded (won|lost) on legs/, 'a grade not following its legs');
  fails1(L => { delete L.night[kD1]; }, /a night set locked at .* is gone/, 'a locked night gone');
  fails1(L => { N1(L).generated = 'x'; }, /a night set locked at .*, and changed \(generated\)/, 'a locked night changed in a field');
  fails1(L => { N1(L).tiers[2].legs[0].p = 0.99; }, /a night set locked at .*, and changed \(tiers\)/, 'a locked night\'s level changed');
  fails1(L => { N3(L).taken_at = T(D2, '13:00:00'); }, /new or changed, and not taken by this run before its lock/, 'a night changed and not this run\'s', base, tD2);
  fails1(L => { L.night_summary.tiers.safe.won += 1; L.__keep = true; }, /the night summary does not follow/, 'a night summary that does not follow');
  fails1(L => { N3(L).pool.pairs[0][2] = 0.99; }, /its pool is not a pool of team legs/, 'a pool pair\'s chance over a leg\'s own');
  /* a night set taken before DraftKings had posted a line of it: no leg in its pool and none left out (the job takes none) */
  fails1(L => { const e = N3(L); e.pool = { legs: [], pairs: [], band: 0, far: 0, noId: 0 }; e.tiers = e.tiers.map(t => ({ id: t.id, label: t.label, min: t.min, max: t.max, price: t.price, why: 'No legs yet.' })); delete e.grade; },
    /taken with no DraftKings line posted for any game of the night/, 'a night set taken with no line posted');
  /* a second set of a night taken after the night locked (its first tip-off moved later after the lock): refused */
  fails1(L => { const e = clone(N1(L)); e.games = e.games.map(g => g.gid === gG.id ? { ...g, tip: T(D2, '00:15') } : g); e.tip = T(D2, '00:00'); e.lock = minIso(Date.parse(e.tip) - LOCK); e.taken_at = isoS(lockD1 + 5 * 60e3); delete e.grade;
    L.night[SC.nightKeyOf(e)] = e; }, /a second set of .*_NIGHT, taken at .*, at or after its night locked at/, 'a second set of a night taken after it locked');
  /* the night map dropped whole, its summary with it, where the file it is held to has one: refused, on check() and on
     the command line, as the job's step runs it */
  { const L1x = clone(base); delete L1x.night; delete L1x.night_summary;
    const b = SC.check(L1x, base, now, null, SEASON), f = path.join(DIR, 'nonight.json'); fs.writeFileSync(f, SC.dumps(L1x) + '\n');
    const c = cp.spawnSync('node', [CHECK, '--prev', goodFile, '--now', tD2], { encoding: 'utf8', env: { ...process.env, SUGGEST_LEDGER: f, SUGGEST_STATE: path.join(DIR, 'state.json') } });
    chk(b.some(x => /night map is gone, where the file it is held to has one/.test(x)) && c.status === 1 && /night map is gone/.test(c.stdout),
      `check fails a ledger whose night map and its summary are gone, the file it is held to holding locked nights (${b.slice(0, 1).join('')} | ${c.stdout.trim().split('\n').pop()})`); }
  /* the per-game rules on their own entries, as before 7 November 2026 */
  const kE1 = SC.keyOf(P.E1), kE2 = SC.keyOf(P.E2), kE8 = SC.keyOf(P.E8);
  fails1(L => { L.featured['x|' + kE1] = L.featured[kE1]; }, /not keyed on its own/, 'a per-game set keyed on another key');
  fails1(L => { L.featured[kE1].away = 'MIA'; }, /game id is not of its season/, 'a per-game set\'s game id not of its clubs');
  fails1(L => { L.featured[kE1].tv = []; }, /not a featured game/, 'a per-game set on no national network');
  fails1(L => { L.featured[kE1].tiers.reverse(); }, /its levels are not the three/, 'a per-game set\'s levels out of order');
  fails1(L => { const t = L.featured[kE1].tiers[1]; t.legs = t.legs.slice(0, 2); }, /2 legs on a level of 3/, 'a per-game level short of its legs');
  fails1(L => { const t = L.featured[kE1].tiers[1]; t.legs[2].pid = t.legs[1].pid; }, /a player twice/, 'a player twice in a per-game level');
  fails1(L => { L.featured[kE1].updates = [{ tier: 'med', pid: '', at: '' }]; }, /names no level of its set, player or time/, 'a per-game replacement naming nobody');
  fails1(L => { L.featured[kE1].tiers.push({ id: 'xtrm', label: 'Extreme', n: 5, floor: 0.05, why: 'x' }); }, /with Extreme/, 'a per-game set taken since THREE_FROM holding Extreme');
  chk(SC.entryBad(kE8, base.featured[kE8], now).length === 0, 'F: a per-game set taken before THREE_FROM with Extreme passes');
  fails1(L => { const g = L.featured[kE2].grade.safe; g.result = 'won'; g.payout = 2; }, /graded won on legs/, 'a per-game grade not following its legs');
  fails1(L => { delete L.featured[kE1]; }, /a set locked at .* is gone/, 'a locked per-game set gone');
  fails1(L => { L.featured[kE1].generated = 'x'; }, /locked at .*, and changed \(generated\)/, 'a locked per-game set changed');
  fails1(L => { const k = SC.keyOf(P.E5); L.featured[k].grade.safe = { result: 'won', legs: ['win', 'win'], payout: L.featured[k].tiers[0].dec }; }, /graded anew/, "last season's per-game set graded anew");
  fails1(L => { L.featured_summary.tiers.safe.won += 1; L.__keep = true; L.night_summary = SC.summarizeNight(L.night); }, /the summary does not follow/, 'a per-game summary that does not follow');
  /* the job's step hands the script and its check one clock: a night rewritten a second before its lock, checked a few
     seconds later on the wall clock, would read as a locked night moved */
  { const wf = fs.readFileSync(path.join(ROOT, '.github', 'workflows', 'update.yml'), 'utf8').split('\n').find(l => /node tools\/suggest_ledger\.js/.test(l) && /node tools\/suggest_check\.js/.test(l)) || '';
    chk(/now=\$\(date -u \+[^)]*\) && SUGGEST_NOW=\$now node tools\/suggest_ledger\.js && SUGGEST_NOW=\$now node tools\/suggest_check\.js/.test(wf) && wf.indexOf('test_suggest_ledger.js') < wf.indexOf('now=$('), "F: the job's step reads one clock after the test and hands it to both the script and its check");
    fs.writeFileSync(LEDGER, good);
    const lockD2 = Date.parse(gE.tip) - LOCK, tJ = isoS(lockD2 - 1000), tLate = isoS(lockD2 + 5000);
    r = run(stateOf(day2b, { today: D2, generated: T(D2, '20:00') }), linesOf([gD, gE, gF], { mlShift: { [gE.id]: 0.03 }, at: T(D2, '20:30:00') }), tJ);
    const ck = at => cp.spawnSync('node', [CHECK, '--prev', goodFile], { encoding: 'utf8', env: { ...process.env, SUGGEST_NOW: at, SUGGEST_LEDGER: LEDGER, SUGGEST_STATE: path.join(DIR, 'state.json') } });
    const c1 = ck(tJ), c2 = ck(tLate);
    chk(r.code === 0 && read().night[kD2].taken_at === tJ && c1.status === 0 && c2.status === 1 && /night set locked at .*, and changed/.test(c2.stdout),
      `F: a night rewritten a second before its lock passes its check on the run's own clock, and would fail on one read seconds later (${c1.stdout.trim().split('\n').pop()} | ${c2.stdout.trim().split('\n').pop()})`);
    fs.writeFileSync(LEDGER, good); }

  console.log('T. a night of exact ties');
  { const TD = path.join(DIR, 'ties'); fs.mkdirSync(path.join(TD, 'data'), { recursive: true }); fs.copyFileSync(path.join(DIR, 'index.html'), path.join(TD, 'index.html'));
    /* four games alike (the home side favoured by 2 on a line of 1.5, a pick'em moneyline, the total at -110): each home
       spread lands 51.4%, the likeliest leg; T1, T4 and T5 price it -105, T2 -115 */
    const tg = (a, h) => mk(D5, a, h, T(addDay(D5, 1), '00:00'), [], { pHome: 0.5, spread: -2, total: 224 });
    const T1 = tg('ATL', 'BOS'), T2 = tg('BKN', 'CHA'), T4 = tg('CHI', 'CLE'), T5 = tg('DAL', 'DEN');
    const tl = (g, hp) => ({ at: T(D5, '13:00:00'), espn: g.espn, ml: { home: -110, away: -110 }, spread: { line: -1.5, home: hp, away: hp === -105 ? -115 : -105 }, total: { line: 224.5, over: -110, under: -110 }, ids: ids(g), props: null });
    const TL = { v: 1, at: T(D5, '13:00:00'), games: { [T1.id]: tl(T1, -105), [T2.id]: tl(T2, -115), [T4.id]: tl(T4, -105), [T5.id]: tl(T5, -105) } };
    const slT = [T1, T2, T4, T5], stT = stateOf(slT, { today: D5, generated: T(D5, '13:00') }), tT = T(D5, '15:00:00'), lT = path.join(TD, 'ledger.json');
    fs.writeFileSync(path.join(TD, 'state.json'), JSON.stringify(stT)); fs.writeFileSync(path.join(TD, 'lines.json'), JSON.stringify(TL));
    const rT = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, SUGGEST_NOW: tT, SUGGEST_ROOT: TD, SUGGEST_LEDGER: lT, SUGGEST_PREV: 'none' } });
    chk(rT.status === 0, 'T: the run writes: ' + (rT.stdout || '').trim().split('\n').pop());
    const e = JSON.parse(fs.readFileSync(lT, 'utf8')).night[nightKey(slT, D5)], hs = g => `${g.id}|spread|${g.home}|-1.5`;
    levelsMatch('T', e, slT, TL, Date.parse(tT));
    const got = id => e.tiers.find(t => t.id === id).legs.map(legKey).sort().join(',');
    chk(got('safe') === [hs(T1), hs(T4)].sort().join(','), `T: Safe, of six pairs of home spreads level on their chance, takes the dearer (-105 over -115) and of those three the first by the legs' ids (${got('safe')})`);
    chk(got('med') === [hs(T1), hs(T4), hs(T5)].sort().join(','), `T: Medium, of four triples level on their chance, the one of the three dearest (${got('med')})`);
    chk(got('aggr') === [hs(T1), hs(T2), hs(T4), hs(T5)].sort().join(','), `T: Aggressive, no triple paying $8, the four home spreads (${got('aggr')})`); }

  /* a universe of its own: a scratch root with the page, a state and lines of the case's own, a ledger of its own */
  const uni = name => { const U = path.join(DIR, name); fs.mkdirSync(path.join(U, 'data'), { recursive: true }); fs.copyFileSync(path.join(DIR, 'index.html'), path.join(U, 'index.html')); return U; };
  const runU = (U, st, lines, at, o = {}) => { fs.writeFileSync(path.join(U, 'state.json'), JSON.stringify(st)); if (lines) fs.writeFileSync(path.join(U, 'lines.json'), JSON.stringify(lines));
    const rr = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, SUGGEST_NOW: at, SUGGEST_ROOT: U, SUGGEST_LEDGER: path.join(U, 'ledger.json'), SUGGEST_PREV: 'none', ...o } });
    const out = (rr.stdout || '') + (rr.stderr || ''); return { code: rr.status, out, last: out.trim().split('\n').pop() }; };
  const readU = U => fs.existsSync(path.join(U, 'ledger.json')) ? JSON.parse(fs.readFileSync(path.join(U, 'ledger.json'), 'utf8')) : null;
  /* DraftKings' line for a game not posted yet, as tools/lines.js writes it (the feed's second date, mostly) */
  const unposted = (g, at) => ({ at, espn: g.espn, ml: null, spread: null, total: null, ids: null, props: null });

  console.log('N. a night DraftKings has posted no line for yet');
  { const U = uni('nolines'), DN = addDay(D0, 10), DN1 = addDay(DN, 1);
    const n1 = mk(DN, 'HOU', 'SAS', T(DN1, '01:00'), [], { pHome: 0.6, spread: -4, total: 225 }), n2 = mk(DN, 'UTA', 'POR', T(DN1, '03:00'), [], { pHome: 0.45, spread: 2, total: 228 });
    const slN = [n1, n2], nidN = nidOf(DN), stN = o => stateOf(slN, { today: DN, generated: T(DN, '12:00'), ...o });
    const none = at => ({ v: 1, at, games: { [n1.id]: unposted(n1, at), [n2.id]: unposted(n2, at) } });
    let rN = runU(U, stN(), none(T(DN, '12:30:00')), T(DN, '13:00:00'));
    const keysN = () => Object.keys((readU(U) || {}).night || {}).filter(k => k.endsWith('|' + nidN));
    chk(rN.code === 0 && !keysN().length && new RegExp(`no set of ${nidN}: DraftKings has posted no line for its games yet`).test(rN.out),
      `N: no line posted for the night's games: no set is taken, and the run says so (${keysN().join(', ') || 'none'}): ${rN.last}`);
    const posted = linesOf(slN, { at: T(DN, '14:30:00') });
    rN = runU(U, stN({ generated: T(DN, '14:40') }), posted, T(DN, '15:00:00'));
    const kN = nightKey(slN, DN), eN = (readU(U).night || {})[kN];
    chk(rN.code === 0 && eN && eN.taken_at === T(DN, '15:00:00') && eN.pool.legs.length > 0 && eN.tiers[0].legs, `N: the lines posted, the night's set is taken (${eN ? eN.pool.legs.length + ' legs' : 'none'}): ${rN.last}`);
    levelsMatch('N', eN, slN, posted, Date.parse(T(DN, '15:00:00')));
    const lnN = lineIn(fs.readFileSync(path.join(U, 'ledger.json'), 'utf8'), kN);
    rN = runU(U, stN({ generated: T(DN, '15:40') }), none(T(DN, '15:30:00')), T(DN, '16:00:00'));
    chk(rN.code === 0 && lineIn(fs.readFileSync(path.join(U, 'ledger.json'), 'utf8'), kN) === lnN, `N: a later run that reads no line keeps the set an earlier run took as it was, never dropped: ${rN.last}`);
    /* the night's first tip-off moved earlier, past its new lock, while the set's own lock is still to come (n1 from 8 PM
       to 7:30 PM ET, read at 5:40 PM): the night has locked, and the set taken is kept as it was, never dropped */
    rN = runU(U, stateOf(slN.map(g => g.id === n1.id ? { ...g, tip: T(DN1, '00:30') } : g), { today: DN, generated: T(DN, '22:30') }), posted, T(DN, '22:40:00'));
    chk(rN.code === 0 && lineIn(fs.readFileSync(path.join(U, 'ledger.json'), 'utf8'), kN) === lnN && /1 night set locked/.test(rN.out),
      `N: the night's first tip-off moved earlier past its new lock, the set's own lock still to come: kept as it was, not dropped: ${rN.last}`); }

  console.log('Q. a near tie the pool must keep whole');
  { const U = uni('neartie'), DQ = addDay(D0, 12), DQ1 = addDay(DQ, 1);
    /* three home moneylines, likeliest 0.9, then 0.8000004 and 0.7999996 at a dearer price: the likeliest pair is the first
       two (0.72000036 against 0.71999964), which a pool rounded to 6 places would read as level, ranking the dearer first */
    const q1 = mk(DQ, 'WAS', 'OKC', T(DQ1, '00:00'), [], { pHome: 0.9, spread: -12, total: 224 }), q2 = mk(DQ, 'BKN', 'ATL', T(DQ1, '00:30'), [], { pHome: 0.8000004, spread: -8, total: 224 }), q3 = mk(DQ, 'IND', 'DEN', T(DQ1, '01:00'), [], { pHome: 0.7999996, spread: -7, total: 224 });
    const at = T(DQ, '13:00:00'), ml = (g, h, a) => ({ at, espn: g.espn, ml: { home: h, away: a }, spread: null, total: null, ids: ids(g), props: null });
    const slQ = [q1, q2, q3], LQ = { v: 1, at, games: { [q1.id]: ml(q1, -900, 600), [q2.id]: ml(q2, -400, 300), [q3.id]: ml(q3, -300, 240) } };
    const rQ = runU(U, stateOf(slQ, { today: DQ, generated: T(DQ, '12:00') }), LQ, T(DQ, '15:00:00'));
    const eQ = rQ.code === 0 ? readU(U).night[nightKey(slQ, DQ)] : null;
    chk(rQ.code === 0 && eQ, `Q: the run takes the night, its guard passing the page's pick: ${rQ.last}`);
    if (eQ) { levelsMatch('Q', eQ, slQ, LQ, Date.parse(T(DQ, '15:00:00')));
      chk(eQ.tiers[0].legs && eQ.tiers[0].legs.map(legKey).sort().join(',') === [`${q1.id}|ml|OKC|`, `${q2.id}|ml|ATL|`].sort().join(',') && eQ.pool.legs.some(x => x[2] === 0.8000004) && eQ.pool.legs.some(x => x[2] === 0.7999996),
        `Q: Safe the likelier pair (OKC and ATL), the pool keeping each chance whole (${eQ.tiers[0].legs ? eQ.tiers[0].legs.map(l => l.side).join('+') : 'empty'})`); } }

  console.log('V. a night level with a push and a void');
  { const U = uni('pushvoid'), DV = addDay(D0, 14), DV1 = addDay(DV, 1);
    /* four games on whole lines (a spread of 3 or 4, a total of 220), no moneyline posted: every leg a spread or a total */
    const vg = [['ATL', 'BOS', -4, '00:00'], ['CHA', 'CHI', -5, '00:30'], ['DAL', 'DEN', 3, '01:00'], ['GSW', 'HOU', -2, '02:00']].map(([a, h, sp, hm]) => mk(DV, a, h, T(DV1, hm), [], { pHome: 0.5, spread: sp, total: 221 }));
    const at = T(DV, '13:00:00'), whole = g => ({ at, espn: g.espn, ml: null, spread: { line: g.model.spread + 1, home: -110, away: -110 }, total: { line: 220, over: -110, under: -110 }, ids: ids(g), props: null });
    const LV1 = { v: 1, at, games: Object.fromEntries(vg.map(g => [g.id, whole(g)])) };
    let rV = runU(U, stateOf(vg, { today: DV, generated: T(DV, '12:00') }), LV1, T(DV, '15:00:00'));
    const kV = nightKey(vg, DV), eV = rV.code === 0 ? readU(U).night[kV] : null;
    chk(rV.code === 0 && eV, 'V: the night is taken: ' + rV.last);
    /* the level over the most games; its first game with a whole-line leg pushes it, its next is not played, the rest win */
    const lvV = eV && eV.tiers.filter(t => t.legs).sort((a, b) => new Set(b.legs.map(l => l.id)).size - new Set(a.legs.map(l => l.id)).size)[0];
    const gamesV = lvV ? [...new Set(lvV.legs.map(l => l.id))] : [];
    if (lvV && gamesV.length >= 2) {
      const settle = (l, as, hs) => { if (l.kind === 'spread') { const m = (l.side === l.home ? hs - as : as - hs) + l.line; return m === 0 ? 'push' : m > 0 ? 'win' : 'loss'; } const t = as + hs; return t === l.line ? 'push' : (t > l.line) === (l.side === 'over') ? 'win' : 'loss'; };
      const scoreFor = (legs, want) => { for (let as = 95; as <= 130; as++) for (let hs = 95; hs <= 130; hs++) if (as !== hs && legs.every((l, i) => settle(l, as, hs) === want[i])) return [as, hs]; return null; };
      const [gPush, gVoid, ...gWin] = gamesV, finals = {};
      { const L0 = lvV.legs.filter(l => l.id === gPush); finals[gPush] = scoreFor(L0, L0.map((l, i) => i === 0 ? 'push' : 'win')); }
      for (const gid of gWin) { const L0 = lvV.legs.filter(l => l.id === gid); finals[gid] = scoreFor(L0, L0.map(() => 'win')); }
      const played = vg.map(g => g.id === gVoid ? { ...g, status: 'void' } : finals[g.id] ? fin(g, ...finals[g.id]) : fin(g, 100, 104));
      rV = runU(U, stateOf(played, { today: DV1, generated: T(DV1, '11:00') }), LV1, T(DV1, '12:00:00'));
      const gV = rV.code === 0 ? readU(U).night[kV].grade[lvV.id] : null;
      /* this file's own settlement: the push and the void drop out, the rest priced by tools/corr.js game by game (a leg
         alone its own price; a game's two legs the lower of their product and the hold over their implied joint chance) */
      const res = lvV.legs.map(l => l.id === gVoid ? 'void' : settle(l, ...(finals[l.id] || [100, 104])));
      const left = lvV.legs.filter((l, i) => res[i] === 'win'), byG = new Map(); for (const l of left) { if (!byG.has(l.id)) byG.set(l.id, []); byG.get(l.id).push(l); }
      let pay = 1; for (const L0 of byG.values()) { if (L0.length === 1) { pay *= dec(L0[0].odds); continue; } const [a, b] = L0, rho = CJ.rhoFor(CORR.rho, cl(a), cl(b)) || 0, J = CJ.joint2(imp(a.odds), imp(b.odds), rho); pay *= Math.min(dec(a.odds) * dec(b.odds), HOLD / J); }
      chk(Object.values(finals).every(Boolean) && res.includes('push') && res.includes('void') && left.length > 0 && gV && gV.result === 'won' && JSON.stringify(gV.legs) === JSON.stringify(res) && Math.abs(gV.payout - r3(pay)) < 0.0011 && gV.payout < lvV.dec,
        `V: ${lvV.id} (${lvV.legs.length} legs over ${gamesV.length} games) graded on a push and a void as a book settles it, the ${left.length} leg${left.length === 1 ? '' : 's'} left paid ${gV && gV.payout} (this file's own ${r3(pay)}, where every leg won pays ${lvV.dec}) on ${JSON.stringify(res)}: ${rV.last}`);
      chk(rV.code === 0 && SC.check(readU(U), null, Date.parse(T(DV1, '12:00:00')), null, SEASON).length === 0, 'V: the graded ledger passes the guard');
    } else chk(false, `V: (no level over two games or more to plant a push and a void on: ${eV ? eV.tiers.map(t => t.legs ? t.legs.length : 0).join(',') : 'no entry'})`); }

  console.log('G. the real ledger, copied, on the real state');
  const realLedger = path.join(ROOT, SC.LEDGER_REL), realLines = path.join(ROOT, 'lines.json');
  if (fs.existsSync(realLines)) {
    const G = path.join(DIR, 'real'); fs.mkdirSync(path.join(G, 'data'), { recursive: true });
    for (const f of ['index.html', 'state.json', 'lines.json']) fs.copyFileSync(path.join(ROOT, f), path.join(G, f));
    for (const f of fs.readdirSync(path.join(ROOT, 'data')).filter(f => /^box_\d{4}\.csv$/.test(f))) fs.copyFileSync(path.join(ROOT, 'data', f), path.join(G, 'data', f));
    const gl = path.join(G, 'ledger.json'); if (fs.existsSync(realLedger)) fs.copyFileSync(realLedger, gl);
    const tG = Date.now(), before = fs.existsSync(gl) ? fs.readFileSync(gl, 'utf8') : null;
    if (before) { const RL = JSON.parse(before), b2 = SC.check(RL, RL, tG, null, REAL.season); chk(!b2.length, `G: the ledger as it stands passes the guard (${b2.slice(0, 2).join(' | ') || 'no failure'})`); }
    const rg = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, SUGGEST_NOW: new Date(tG).toISOString(), SUGGEST_ROOT: G, SUGGEST_LEDGER: gl, SUGGEST_PREV: fs.existsSync(realLedger) ? realLedger : 'none' } });
    const last = ((rg.stdout || '') + (rg.stderr || '')).trim().split('\n').pop();
    chk(rg.status === 0 && /^suggest ledger: (written|unchanged)/.test(last), 'G: the state and lines at the real clock: nothing refused: ' + last);
    if (before && rg.status === 0) { const was = JSON.parse(before), now1 = JSON.parse(fs.readFileSync(gl, 'utf8')), lockedAt = e => Date.parse(e.tip) - LOCK <= tG;
      chk(['featured', 'night'].every(m => Object.entries(was[m] || {}).filter(([, e]) => lockedAt(e)).every(([k, e]) => now1[m][k] && JSON.stringify(SC.callOf(now1[m][k])) === JSON.stringify(SC.callOf(e)))), 'G: every locked set of the ledger as it was, but for its grade');
      chk(Object.values(now1.featured).every(e => lockedAt(e)) && Object.values(now1.night || {}).every(e => e.tiers.map(t => t.id).join() === 'safe,med,aggr'), 'G: no per-game set still to lock, and every night set the three levels'); }
  } else chk(true, 'G: no lines.json in this checkout: the real run is skipped');
  end();
})();
