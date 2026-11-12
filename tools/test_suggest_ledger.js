/* The test of tools/suggest_ledger.js and tools/suggest_check.js: the suggestions record's night sets taken, rewritten,
 * locked and graded on made-up days, the per-game sets of the rule before 7 November 2026 kept and graded, and the guard
 * that refuses a ledger whose locked entries moved or whose levels are not their rule's.
 *
 *   node tools/test_suggest_ledger.js      ends "N checks passed"; exit 1 otherwise (about a minute; needs jsdom;
 *                                          SL_VERBOSE=1 prints every check)
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
 *   P  a night with player legs (the rule of every set the page with them takes from 23:00 UTC on 7 November 2026): DraftKings' main lines over and under at
 *      DraftKings' own fair chance beside the team legs at the model's, one leg a player, a player the report lists left
 *      out, a line priced on one side, a milestone and a Yes market taken nowhere; each level the likeliest of this file's
 *      own enumeration (every game's legs together by its own copula: two legs exactly, three by its own integral, four or
 *      more bounded by their three-leg subsets); the pool the record keeps compact and making every level again by the
 *      guard's own enumeration; after the lock, a player listed: the level holding him alone built again, marked and
 *      recorded, the rest to the byte, and nothing built again from the first tip-off; graded from the box lines, a player
 *      with no line void and a whole line pushing, each dropping out, the rest paid by this file's own sums; and the guard
 *      refusing a player's leg at the model's chance, two legs of one player, a milestone, a player listed before the
 *      lock and a pool that cannot make its level. Since the review of 7 November 2026: the guard's own reading of the
 *      run's state and lines.json passing the job's sets and failing a ledger whose winning player leg was cut from the
 *      pool with its levels the runner-up the cut pool makes (which the kept pool alone passes); a line priced with no
 *      margin in the pool refused; a replacement for a player the run's state does not list, and a level built again on a
 *      pool holding a player the state lists, refused; a win with a leg dropped paying more than the legs left's prices
 *      multiplied, or other than that where each game is left one leg, refused; and X, a night whose likeliest pair is a
 *      fair same-game pair that moves together (the Thunder to win at -500 with a Wizard's Under at -300), taken through
 *      the job, every level this file's own enumeration's.
 *   Y  the rule with a player (the owner's call of 10 November 2026): every level above is held to it (this file's own
 *      enumeration takes the night's player legs beside its team legs, and a level is the likeliest holding a player leg
 *      wherever a parlay holding one meets it, else the likeliest of all, saying why: levelsP); Y1 a night where the rule
 *      before takes team legs alone and the rule a parlay holding a player, its kept pool, and the guard's breaks; Y2 no
 *      player line posted (the why "lines") and Y2b lines posted and every player listed Out ("fit"), every level built;
 *      Y3 a one-game night, each level a group of its legs holding a player; Y4 the cutoff (PLAYER_FROM) on the real
 *      record's sets of the rule before; Y5 a level built again after the lock under each rule; Y6 a night of ten games
 *      with game lines and no player line, every level "lines", the job and suggest_check.js each within a time bound.
 *   R  one ruler (the owner's call of 11 November 2026): every set taken from the record's cutoff (suggest_check.js's
 *      RULER_FROM) on one ruler, every leg at DraftKings' fair chance, at the default filters; each level held by this
 *      file's own enumeration to the rule's four properties, the pool as kept, the cutoff both ways (and on the real
 *      record), the guard's breaks, ties among Unders at even prices, a level built again after the lock under each rule
 *      and a night of one game. Every section before it holds the rules before the ruler, on made-up days after any
 *      cutoff the finish step can set, so the test moves the cutoff far ahead for them (SUGGEST_RULER_FROM, which every
 *      run spawned here inherits, and the page copied with its own SP_RULER_FROM moved the same).
 *   G  the real ledger, copied, on the real state and lines.json at the real clock and the real cutoff: nothing refused,
 *      every locked set as it was.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const cp = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const SCRIPT = path.join(__dirname, 'suggest_ledger.js'), CHECK = path.join(__dirname, 'suggest_check.js');
/* the record's cutoff for the ruler as the guard carries it (its RULER_FROM_SET), and far ahead for every section but R
   and G (set before suggest_check.js is first read, and inherited by every run spawned here) */
const REAL_CUT = (/const RULER_FROM_SET = '([^']+)'/.exec(fs.readFileSync(path.join(__dirname, 'suggest_check.js'), 'utf8')) || [])[1];
const CUT_FAR = '2099-01-01T00:00:00Z';
process.env.SUGGEST_RULER_FROM = CUT_FAR;
const SC = require('./suggest_check'), PJ = require('./props'), CJ = require('./corr');
/* the guard at another cutoff: suggest_check.js read again with SUGGEST_RULER_FROM set to it */
const SC_AT = new Map();
const scAt = cut => { if (SC_AT.has(cut)) return SC_AT.get(cut); const k = require.resolve('./suggest_check'), keep = require.cache[k];
  delete require.cache[k]; process.env.SUGGEST_RULER_FROM = cut;
  try { const m = require('./suggest_check'); SC_AT.set(cut, m); return m; } finally { process.env.SUGGEST_RULER_FROM = CUT_FAR; require.cache[k] = keep; } };
/* the page with its cutoff for the ruler moved (exactly one SP_RULER_FROM in it) */
const PAGE = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const pageAt = cut => { const re = /const SP_RULER_FROM = '[^']*'/g, m = PAGE.match(re);
  if (!m || m.length !== 1) throw new Error(`the page carries ${m ? m.length : 0} cutoffs for the ruler (const SP_RULER_FROM), where the test moves exactly one`);
  return PAGE.replace(re, `const SP_RULER_FROM = '${cut}'`); };
const DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'suggest_ledger_'));
const LEDGER = path.join(DIR, 'ledger.json');
fs.mkdirSync(path.join(DIR, 'data'), { recursive: true });
fs.writeFileSync(path.join(DIR, 'index.html'), pageAt(CUT_FAR));

let n = 0; const fails = [];
const chk = (ok, msg) => { n++; if (!ok) fails.push(msg); if (process.env.SL_VERBOSE) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
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
const LV = [['safe', 2, Infinity, 2], ['med', 2, Infinity, 4], ['aggr', 2, Infinity, 8]];
/* ---------- THE RULE WITH A PLAYER (the owner's call of 10 November 2026) ----------
   this file's own player legs of a night (each main line over and under with both prices on a stat the page offers, at
   DraftKings' own fair chance, the Over 1 less the Under's implied chance and the Under that chance, 45% to 97%, priced
   with a margin, on a player the props model places on one of the game's clubs and the report does not list: a probable
   player plays), its own copula and each game's options (every set of its legs, one side, one total and one leg a
   player), and every parlay by brute force: a level is the likeliest holding a player leg wherever a parlay holding one
   meets it, else the likeliest without one, saying why */
const heldOwn = (st, g, pid) => { if ([g.model.home, g.model.away].some(x => (x.out || []).some(y => String(y.id) === String(pid)))) return true;
  const r = st.report && st.report.players ? st.report.players[pid] : null; return Array.isArray(r) && !/^probable/i.test(String(r[1] || '').trim()); };
const mainOk = m => !!m && SC.PL_STATS.includes(m.stat) && Number.isFinite(m.line) && Number.isFinite(m.over) && Number.isFinite(m.under) && !!m.over && !!m.under;
const toTip = (st, d, now) => nightGames(st.slate, d).filter(g => g.status === 'scheduled' && Date.parse(g.tip) > now);
function plLegsOwn(st, lines, now, d) {
  const legs = [];
  for (const g of toTip(st, d, now)) {
    const pr = lines.games[g.id] && lines.games[g.id].props, rows = st.props.games[g.id] && st.props.games[g.id].players; if (!pr || !rows) continue;
    for (const m of pr.mains) { const row = rows[m.player];
      if (!mainOk(m) || !row || (row[1] !== g.away && row[1] !== g.home) || heldOwn(st, g, m.player) || imp(m.over) + imp(m.under) < 1) continue;
      const fo = 1 - imp(m.under);
      for (const [sd, odds, other, pp] of [['over', m.over, m.under, fo], ['under', m.under, m.over, 1 - fo]]) if (pp >= 0.45 && pp < 0.97)
        legs.push({ sk: [g.id, 'prop', m.player, m.stat, 'main', m.line, sd].join('|'), gid: g.id, kind: 'prop', pid: String(m.player), stat: m.stat, side: sd, line: m.line, odds, other, p: pp, d: dec(odds), home: g.home, team: row[1] }); } }
  return legs;
}
/* why a level of the rule with a player holds none, by this file's own reading: no player main line read for the
   night's games still to tip ('lines'), else 'fit' */
const noplOwn = (st, lines, now, d) => toTip(st, d, now).some(g => { const pr = lines.games[g.id] && lines.games[g.id].props; return !!pr && Array.isArray(pr.mains) && pr.mains.some(mainOk); }) ? 'fit' : 'lines';
/* the copula of this file's own: two legs exactly (tools/corr.js joint2); three or more by conditioning on the first
   leg's normal, its density times the rest's own orthant given it integrated by Gauss-Legendre (six panels of 20
   points from its threshold to 9), the rest worked the same way down to two (tools/corr.js bvnUpper); never the
   page's GHK sum. Three legs
   also by Simpson's rule on the normal itself (4,000 steps), the two held to each other. A game's legs together pay
   the lower of their prices multiplied and the hold over their implied joint chance */
const phi = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI), ORTH = new Map();
const GLN = (() => { const n = 20, x = [], w = []; for (let i = 1; i <= n; i++) { let z = Math.cos(Math.PI * (i - 0.25) / (n + 0.5)), pp = 0;
  for (let it = 0; it < 100; it++) { let p0 = 1, p1 = z; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } pp = n * (z * p1 - p0) / (z * z - 1); const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-15) break; }
  x.push(z); w.push(2 / ((1 - z * z) * pp * pp)); } return { x, w }; })();
const orthOwn = (t, R) => { const n = t.length; if (n === 1) return 1 - PJ.normCdf(t[0]); if (n === 2) return CJ.bvnUpper(t[0], t[1], R[0][1]);
  const k = JSON.stringify([t, R]); if (ORTH.has(k)) return ORTH.get(k);
  const s = R[0].slice(1).map(r => Math.sqrt(1 - r * r)), Rc = [...Array(n - 1)].map((_, i) => [...Array(n - 1)].map((__, j) => i === j ? 1 : (R[i + 1][j + 1] - R[0][i + 1] * R[0][j + 1]) / (s[i] * s[j])));
  const lo = t[0], P6 = 6, wd = (9 - lo) / P6; let sum = 0;
  for (let pn = 0; pn < P6; pn++) for (let q = 0; q < GLN.x.length; q++) { const z = lo + wd * (pn + (GLN.x[q] + 1) / 2);
    sum += GLN.w[q] * wd / 2 * phi(z) * orthOwn(t.slice(1).map((ti, i) => (ti - R[0][i + 1] * z) / s[i]), Rc); }
  const v = sum; ORTH.set(k, v); return v; };
const triSimpson = (ps, R) => { const t = ps.map(q => PJ.normInv(1 - q)), r12 = R[0][1], r13 = R[0][2], r23 = R[1][2], s2 = Math.sqrt(1 - r12 * r12), s3 = Math.sqrt(1 - r13 * r13), rc = (r23 - r12 * r13) / (s2 * s3);
  const a = t[0], b = 9, N = 4000, h = (b - a) / N; let sum = 0;
  for (let i = 0; i <= N; i++) { const z = a + i * h, w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; sum += w * phi(z) * CJ.bvnUpper((t[1] - r12 * z) / s2, (t[2] - r13 * z) / s3, rc); }
  return sum * h / 3; };
const rhoM = L => L.map((a, i) => L.map((b, j) => i === j ? 1 : (CJ.rhoFor(CORR.rho, cl(a), cl(b)) || 0)));
const jointOwn = (ps, L) => { const R = rhoM(L); return ps.length === 1 ? ps[0] : ps.length === 2 ? CJ.joint2(ps[0], ps[1], R[0][1]) : orthOwn(ps.map(q => PJ.normInv(1 - q)), R); };
const figOwn = L => { if (L.length === 1) return { p: L[0].p, d: L[0].d }; const J = jointOwn(L.map(l => imp(l.odds)), L), prod = L.reduce((t, l) => t * l.d, 1); return { p: jointOwn(L.map(l => l.p), L), d: J > 0 ? Math.min(prod, HOLD / J) : prod }; };
const clsOwn = l => l.kind === 'ml' || l.kind === 'spread' ? 'side' : l.kind === 'total' ? 'total' : 'p' + l.pid;
const optsP = legs => { const by = new Map(); for (const l of legs) { if (!by.has(l.gid)) by.set(l.gid, []); by.get(l.gid).push(l); }
  return [...by.values()].map(L => { const groups = new Map(); for (const l of L) { const k = clsOwn(l); if (!groups.has(k)) groups.set(k, []); groups.get(k).push(l); }
    let o = [[]]; for (const ls of groups.values()) o = o.flatMap(c => [c, ...ls.map(l => [...c, l])]);
    return o.filter(c => c.length).map(c => ({ legs: c, ...figOwn(c) })); }); };
/* every parlay, by brute force, the best of each level by its rule. Since the rule with a player (the owner's call of 10
   November 2026) a level is the likeliest parlay holding a player leg wherever a parlay holding one meets it (pl), else
   the likeliest without one (raw: the rule before), which says why (nopl, the caller's own reading: 'lines' where no
   player main line was read for the night's games still to tip, else 'fit') */
const levelsP = (G, nopl) => { const raw = {}, pl = {}, pick = []; let count = 0;
  const better = (c, b) => !b || c.p > b.p + 1e-12 || (Math.abs(c.p - b.p) <= 1e-12 && (c.d > b.d + 1e-12 || (Math.abs(c.d - b.d) <= 1e-12 && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
  (function go(i, pp, dd, nL, hp) {
    if (i === G.length) { if (nL < 2) return; count++; const ids = pick.flatMap(o => o.legs.map(l => l.sk)).sort().join(',');
      for (const [id, lo, hi, F] of LV) if (nL >= lo && nL <= hi && dd >= F - 1e-9) { const c = { p: pp, d: dd, n: nL, ids, hp }; if (better(c, raw[id])) raw[id] = c; if (hp && better(c, pl[id])) pl[id] = c; } return; }
    go(i + 1, pp, dd, nL, hp);
    for (const o of G[i]) { pick.push(o); go(i + 1, pp * o.p, dd * o.d, nL + o.legs.length, hp || o.legs.some(l => l.kind === 'prop')); pick.pop(); }
  })(0, 1, 1, 0, false);
  const best = {}; for (const [id] of LV) { if (pl[id]) best[id] = { ...pl[id], nopl: null }; else if (raw[id]) best[id] = { ...raw[id], nopl: nopl || 'fit' }; }
  return { best, raw, pl, count }; };
/* every parlay of the night's options, by brute force (each game: nothing or one option; 5 legs at most), and the best of
   each level by its rule: likelier, then dearer, then fewer legs, then the legs' ids */
function levelsOwn(G) {
  const best = {}; const pick = [];
  const better = (c, b) => !b || c.p > b.p + 1e-12 || (Math.abs(c.p - b.p) <= 1e-12 && (c.d > b.d + 1e-12 || (Math.abs(c.d - b.d) <= 1e-12 && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
  (function go(i, p, d, nL) {
    if (i === G.length) { if (nL < 2) return; const ids = pick.flatMap(o => o.legs.map(l => l.sk)).sort().join(',');
      for (const [id, lo, hi, F] of LV) if (nL >= lo && nL <= hi && d >= F - 1e-9) { const c = { p, d, n: nL, ids }; if (better(c, best[id])) best[id] = c; } return; }
    go(i + 1, p, d, nL);
    for (const o of G[i]) { pick.push(o); go(i + 1, p * o.p, d * o.d, nL + o.legs.length); pick.pop(); }
  })(0, 1, 1, 0);
  return best;
}
const legKey = l => SC.legKey(l);
/* an entry's every level against this file's own: the same legs, its chance and price the own sums', by the rule with a
   player (its night's team legs and, on the state the run read, its player legs: st, else the slate's own state) */
function levelsMatch(tag, e, slate, lines, now, st) {
  st = st || stateOf(slate);
  const legs = [...poolOwn(slate, lines, now, e.date), ...plLegsOwn(st, lines, now, e.date)].sort((a, b) => a.sk < b.sk ? -1 : 1), G = optsP(legs), R = levelsP(G, noplOwn(st, lines, now, e.date)), B = R.best;
  for (const t of e.tiers) {
    const b = B[t.id];
    if (!t.legs) { chk(!b, `${tag} ${t.id}: empty ("${t.why}"), and this file's own enumeration finds none (${b ? b.ids : ''})`); continue; }
    const mine = t.legs.map(legKey).sort().join(',');
    chk(b && b.ids === mine && Math.abs(b.p - t.p) < 6e-5 && Math.abs(b.d - t.dec) < 6e-4,
      `${tag} ${t.id}: the likeliest its rule takes by this file's own enumeration, with a player wherever a parlay holding one meets it (${b ? `${b.ids} ${(b.p * 100).toFixed(3)}% ${b.d.toFixed(3)}` : 'none'}; the entry ${mine} ${t.p} ${t.dec})`);
    chk(!!b && (t.nopl || null) === b.nopl && t.need === 'player', `${tag} ${t.id}: its head says the rule with a player, and ${b && b.nopl ? `it holds none and says why, "${b.nopl}"` : 'it holds one and says no why'} (the entry: need ${t.need}, nopl ${t.nopl || 'none'})`);
  }
  return { legs, G, B, R };
}
/* every rule an entry keeps, worked out here */
function nightOk(e, slate, d, at) {
  const G = nightGames(slate, d), lock = Date.parse(G[0].tip) - LOCK, last = G.reduce((m, g) => Date.parse(g.tip) > Date.parse(m.tip) ? g : m, G[0]);
  return !!e && e.season === SEASON && e.date === d && e.nid === nidOf(d) && e.tip === G[0].tip && e.last === last.tip && e.lock === minIso(lock) && (!at || e.taken_at === at) && Date.parse(e.taken_at) < lock
    && JSON.stringify(e.games.map(g => g.gid)) === JSON.stringify(G.map(g => g.id)) && e.games.every(g => g.type !== 'PRE')
    && e.tiers.map(t => `${t.id}:${t.label}:${t.min}:${t.max}:${t.price}:${t.need}`).join() === 'safe:Safe:2:null:2:player,med:Medium:2:null:4:player,aggr:Aggressive:2:null:8:player'
    && e.tiers.every(t => t.legs ? t.legs.length >= t.min && t.dec >= t.price && t.legs.every(l => (['ml', 'spread', 'total'].includes(l.kind) || (l.kind === 'prop' && l.mk === 'main')) && G.some(g => g.id === l.id))
      && new Set(t.legs.filter(l => l.kind === 'prop').map(l => l.pid)).size === t.legs.filter(l => l.kind === 'prop').length
      && [...new Set(t.legs.map(l => l.id))].every(id => t.legs.filter(l => l.id === id && l.kind !== 'total' && l.kind !== 'prop').length <= 1 && t.legs.filter(l => l.id === id && l.kind === 'total').length <= 1) : typeof t.why === 'string' && t.why.length > 0);
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
  chk(nightOk(L.night[kD1], day1, D1, tA) && nightOk(L.night[kD2], day1, D2, tA), 'A: each keyed season|date|first tip|night, its games every game of its date but the preseason one in tip-off order, its first and last tip-off, locking 2 hours before the first, its levels Safe, Medium and Aggressive (2 legs or more, no leg limit, $2+, $4+, $8+, with a player), team legs and players\' main lines, one side and one total a game and one leg a player');
  const eD1 = L.night[kD1];
  { const own = poolOwn(day1, L1, Date.parse(tA), D1), stA = stateOf(day1), plA = plLegsOwn(stA, L1, Date.parse(tA), D1), kept = eD1.pool.legs, keptT = kept.filter(x => x.length === 3), keptP = kept.filter(x => x.length === 4);
    chk(JSON.stringify(keptT.map(x => x[0])) === JSON.stringify(own.map(l => l.sk)) && keptT.every((x, i) => x[1] === own[i].odds && Math.abs(x[2] - own[i].p) < 2e-6),
      `A: D1's pool's team legs are this file's own (every team leg at DraftKings' price, 45% to 97%, none far off): ${keptT.length} legs`);
    chk(plA.length > 0 && keptP.length > 0 && keptP.every(x => { const o = plA.find(l => l.sk === x[0]); return o && o.odds === x[1] && Math.abs(o.p - x[2]) < 1e-12 && o.other === x[3]; }),
      `A: its player legs kept (${keptP.length}) are this file's own, at DraftKings' own fair chance, of the ${plA.length} its own reading holds (the props model prices two players and DraftKings has their main lines)`);
    chk(eD1.tiers.every(t => t.legs && t.legs.filter(l => l.kind === 'prop').length >= 1 && !t.nopl), `A: every level of D1 holds a player leg (the rule with a player): ${eD1.tiers.map(t => `${t.id} ${t.legs ? t.legs.map(l => l.kind === 'prop' ? 'p' : 't').join('') : 'none'}`).join(', ')}`);
    const G = optsOwn(own), pairsOwn = G.flatMap(o => o.filter(x => x.legs.length === 2)), keyAt = i => kept[i][0], tOnly = x => kept[x[0]].length === 3 && kept[x[1]].length === 3;
    const pairsT = eD1.pool.pairs.filter(tOnly);
    chk(pairsT.length === pairsOwn.length && pairsT.every(x => { const a = keyAt(x[0]), b = keyAt(x[1]), o = pairsOwn.find(y => [a, b].sort().join() === y.legs.map(l => l.sk).sort().join()); return o && Math.abs(o.p - x[2]) < 2e-6 && Math.abs(o.d - x[3]) < 2e-6; }),
      `A: each game's side and total together at the copula's joint chance and the same-game price (${pairsT.length} pairs)`);
    { const all = [...own, ...plA], plPairs = eD1.pool.pairs.filter(x => !tOnly(x));
      chk(plPairs.every(x => { const L2 = [keyAt(x[0]), keyAt(x[1])].map(k => all.find(l => l.sk === k)); if (L2.some(l => !l)) return false; const f = figOwn(L2); return Math.abs(f.p - x[2]) < 2e-6 && Math.abs(f.d - x[3]) < 2e-6; }),
        `A: each pair kept with a player leg at this file's own copula and the same-game price (${plPairs.length} pairs)`); }
    /* the rule with a player moved D1's levels: by this file's own enumeration the likeliest parlay without the word (the
       rule before) is of team legs alone on at least one level, and the entry's is the likeliest holding a player */
    { const R = levelsP(optsP([...own, ...plA].sort((x, y) => x.sk < y.sk ? -1 : 1)), 'fit'), moved = LV.filter(([id]) => R.raw[id] && !R.raw[id].hp);
      chk(moved.length > 0 && moved.every(([id]) => R.pl[id] && R.pl[id].ids !== R.raw[id].ids && eD1.tiers.find(t => t.id === id).legs.map(legKey).sort().join(',') === R.pl[id].ids),
        `A: the rule with a player moves a level of team legs alone to one holding a player (${moved.map(([id]) => `${id}: ${(R.raw[id].p * 100).toFixed(2)}% team legs alone, ${R.pl[id] ? (R.pl[id].p * 100).toFixed(2) + '% with a player' : 'none'}`).join('; ') || 'no level of team legs alone'})`); }
    chk(pairsOwn.some(o => Math.abs(o.p - o.legs[0].p * o.legs[1].p) > 1e-4), 'A: the same-game table moves a pair\'s chance off the product of its legs (the copula is met)'); }
  levelsMatch('A D1', eD1, day1, L1, Date.parse(tA));
  levelsMatch('A D2', L.night[kD2], day1, L1, Date.parse(tA));
  chk(eD1.tiers.every(t => t.legs) && eD1.tiers[1].dec >= 4 && eD1.tiers[2].dec >= 8, `A: D1's three levels all built, Medium paying ${eD1.tiers[1].dec} and Aggressive ${eD1.tiers[2].dec} on $1`);
  chk(eD1.tiers.every(t => !t.legs || t.legs.every(l => { const x = L1.games[l.id]; if (l.kind === 'prop') { const m = x.props.mains.find(y => String(y.player) === String(l.pid) && y.stat === l.stat && y.line === l.line); return !!m && l.odds === m[l.side] && l.other === m[l.side === 'over' ? 'under' : 'over']; }
    return l.kind === 'ml' ? l.odds === x.ml[l.side === l.home ? 'home' : 'away'] : l.kind === 'spread' ? l.odds === x.spread[l.side === l.home ? 'home' : 'away'] : l.odds === x.total[l.side]; })), "A: every leg at DraftKings' price in lines.json");

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
  const BOXA = { ...BOX0, [gA.id]: { 9100001: [28, 5, 6, 3, 1, 0], 9100003: [12, 10, 2, 0, 1, 2] } };
  /* gA's box lines not read yet at D (its player legs pending, so a level with a team leg lost is lost at once though a
     player leg is still out), read with gB's final at D' */
  const stD = stateOf(day2, { today: D2, generated: T(D2, '11:00') });
  r = run(stD, L3, tD); L = read();
  chk(r.code === 0, 'D: the run grades and writes: ' + r.last);
  const scoreN = (st, id) => { const g = st.slate.find(x => x.id === id && x.status === 'final'); return g ? [g.awayScore, g.homeScore] : null; };
  const settleN = (st, l) => { const sc = scoreN(st, l.id); if (!sc) return null; const [as, hs] = sc;
    if (l.kind === 'ml') return hs === as ? 'push' : (hs > as) === (l.side === l.home) ? 'win' : 'loss';
    if (l.kind === 'spread') { const m = (l.side === l.home ? hs - as : as - hs) + l.line; return m === 0 ? 'push' : m > 0 ? 'win' : 'loss'; }
    if (l.kind === 'prop') { const bx = st.boxes && st.boxes.games ? st.boxes.games[l.id] : null; if (!bx) return null; const row = bx[l.pid]; if (!row) return 'void';
      const at = s0 => row[st.boxes.line.indexOf(s0)], v = l.stat in REAL.props.combos ? REAL.props.combos[l.stat].reduce((t2, s0) => t2 + at(s0), 0) : at(l.stat);
      return v === l.line ? 'push' : (v > l.line) === (l.side === 'over') ? 'win' : 'loss'; }
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
    chk(t3[0].legs && t3[0].legs.length === 2 && t3[0].legs.every(l => l.id === gF.id) && t3[0].legs.some(l => l.kind === 'total') && t3[0].dec >= 2, "D: the one-game night's Safe is its side and total together, paying $2 or more");
    chk(t3[1].why === 'No parlay of the night’s legs pays $4 or more on $1: one game makes 2 legs at most.' && t3[2].why === 'No parlay of the night’s legs pays $8 or more on $1: one game makes 2 legs at most.',
      `D: its Medium and Aggressive empty, saying why word for word ("${t3[1].why}" / "${t3[2].why}")`); }
  chk(SC.check(L, null, Date.parse(tD), null, SEASON).length === 0, 'D: the graded ledger passes the guard: ' + SC.check(L, null, Date.parse(tD), null, SEASON).slice(0, 2).join(' | '));
  /* D': the last game final */
  const day2b = day2.map(g => g.id === gB.id ? fin(g, 110, 111) : g), stD2 = stateOf(day2b, { today: D2, generated: T(D2, '13:00'), boxes: BOXA }), tD2 = T(D2, '13:30:00');
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
  { const page = path.join(DIR, 'index.html'), was = fs.readFileSync(page, 'utf8'), from = "['med', 'Medium', 2, null, 4, 'player']";
    if (was.split(from).length === 2) {
      fs.writeFileSync(page, was.replace(from, "['med', 'Medium', 2, null, 3, 'player']"));
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
  fails1(L => { N3(L).tiers[1].price = 3; }, /not the level's own label, range, floor and rule/, 'a floor not the level\'s own');
  /* on D2's night (several games, every level built) */
  const N2 = L => L.night[kD2];
  const base2 = N2(base);
  chk(base2.tiers.every(t => t.legs), `F: D2's night builds all three levels to plant on (${base2.tiers.map(t => t.legs ? t.legs.length : 0).join(', ')})`);
  fails1(L => { const t = N2(L).tiers[1]; t.legs = [t.legs[0]]; }, /1 legs, outside its 2 or more/, 'a level of 1 leg');
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
    (function go(i, picked, p, d, k) { if (alt.length) return; if (i === pool.games.length) { if (k >= 2 && d >= lv[4] && picked.map(l => l.sk).sort().join() !== e.tiers[1].legs.map(legKey).sort().join()) alt.push({ picked, p, d }); return; }
      go(i + 1, picked, p, d, k); for (const o of pool.games[i]) go(i + 1, [...picked, ...o.legs], p * o.p, d * o.d, k + o.legs.length); })(0, [], 1, 1, 0);
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
    /* three home moneylines, likeliest 0.72, then 0.6400004 and 0.6399996 at a dearer price: the likeliest pair is the
       first two (0.46080029 against 0.46079971), which a pool rounded to 6 places would read as level, ranking the dearer
       first */
    const q1 = mk(DQ, 'WAS', 'OKC', T(DQ1, '00:00'), [], { pHome: 0.72, spread: -12, total: 224 }), q2 = mk(DQ, 'BKN', 'ATL', T(DQ1, '00:30'), [], { pHome: 0.6400004, spread: -8, total: 224 }), q3 = mk(DQ, 'IND', 'DEN', T(DQ1, '01:00'), [], { pHome: 0.6399996, spread: -7, total: 224 });
    const at = T(DQ, '13:00:00'), ml = (g, h, a) => ({ at, espn: g.espn, ml: { home: h, away: a }, spread: null, total: null, ids: ids(g), props: null });
    /* since the $2 floor (8 November 2026) the moneylines are dearer, so a pair pays $2: OKC -200, ATL -170, DEN -160; the
       likeliest pair paying $2 is OKC and ATL (0.72 x 0.6400004 against 0.72 x 0.6399996, apart by 6e-7), and the three
       together pay under $4 */
    const slQ = [q1, q2, q3], LQ = { v: 1, at, games: { [q1.id]: ml(q1, -200, 170), [q2.id]: ml(q2, -170, 145), [q3.id]: ml(q3, -160, 135) } };
    const rQ = runU(U, stateOf(slQ, { today: DQ, generated: T(DQ, '12:00') }), LQ, T(DQ, '15:00:00'));
    const eQ = rQ.code === 0 ? readU(U).night[nightKey(slQ, DQ)] : null;
    chk(rQ.code === 0 && eQ, `Q: the run takes the night, its guard passing the page's pick: ${rQ.last}`);
    if (eQ) { levelsMatch('Q', eQ, slQ, LQ, Date.parse(T(DQ, '15:00:00')));
      chk(eQ.tiers[0].legs && eQ.tiers[0].legs.map(legKey).sort().join(',') === [`${q1.id}|ml|OKC|`, `${q2.id}|ml|ATL|`].sort().join(',') && eQ.pool.legs.some(x => x[2] === 0.6400004) && eQ.pool.legs.some(x => x[2] === 0.6399996),
        `Q: Safe the likelier pair (OKC and ATL), the pool keeping each chance whole (${eQ.tiers[0].legs ? eQ.tiers[0].legs.map(l => l.side).join('+') : 'empty'})`); } }

  console.log('U. no leg limit (the owner\'s call of 8 November 2026)');
  { /* fourteen games of heavy favourites, home moneylines at -900 (the model's 92%) and -700 (90%), the last two with a
       total at -110 beside them: Safe ($2 on $1) needs seven of the moneylines, Medium ($4) every moneyline or a total and
       seven, Aggressive ($8) the two totals and more; each level the likeliest of this file's own enumeration of every
       parlay, with no leg limit, one side and one total a game */
    const U = uni('nocap'), DU = addDay(D0, 22), DU1 = addDay(DU, 1);
    const CL = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR'];
    const at = T(DU, '13:00:00'), slU = [], gl = {};
    for (let i = 0; i < 14; i++) {
      const g = mk(DU, CL[2 * i], CL[2 * i + 1], T(DU1, String(i % 4).padStart(2, '0') + ':' + (i < 4 ? '00' : i < 8 ? '15' : i < 12 ? '30' : '45')), [], { pHome: i % 2 ? 0.9 : 0.92, spread: -15, total: 220 });
      slU.push(g); gl[g.id] = { at, espn: g.espn, ml: { home: i % 2 ? -700 : -900, away: i % 2 ? 450 : 550 }, spread: null, total: i >= 12 ? { line: 219.5, over: -110, under: -110 } : null, ids: ids(g), props: null };
    }
    const LU = { v: 1, at, games: gl }, tU = T(DU, '15:00:00');
    const rU = runU(U, stateOf(slU, { today: DU, generated: T(DU, '12:00') }), LU, tU), eU = rU.code === 0 ? readU(U).night[nightKey(slU, DU)] : null;
    chk(rU.code === 0 && eU, `U: the run takes the night of fourteen favourites, its guard passing the page's levels: ${rU.last}`);
    if (eU) {
      const M = levelsMatch('U', eU, slU, LU, Date.parse(tU)), T0 = eU.tiers;
      chk(T0[0].legs && T0[0].legs.length >= 6 && T0[0].dec >= 2 && T0[1].legs && T0[1].legs.length >= 6 && T0[1].dec >= 4,
        `U: Safe takes ${T0[0].legs ? T0[0].legs.length : 0} legs to pay $2 (${T0[0].dec}) and Medium ${T0[1].legs ? T0[1].legs.length : 0} to pay $4 (${T0[1].dec}), past the old 2 and 5`);
      chk(T0.every(t => !t.legs || [...new Set(t.legs.map(l => l.id))].every(id => t.legs.filter(l => l.id === id && l.kind !== 'total' && l.kind !== 'prop').length <= 1 && t.legs.filter(l => l.id === id && l.kind === 'total').length <= 1)),
        'U: at any depth one side and one total a game');
      chk(T0.every(t => t.min === 2 && t.max === null) && T0.map(t => t.price).join() === '2,4,8', `U: every level 2 legs or more with no most, its floor $2, $4 and $8 (${T0.map(t => `${t.min}-${t.max}:${t.price}`).join(', ')})`);
      /* the old rule would have taken none of them so: a leg limit of 5 (and Safe a pair) finds another parlay on the same pool */
      const capped = (() => { const best = {}, pick = [], G = M.G, OLDLV = [['safe', 2, 2, 0], ['med', 2, 5, 4], ['aggr', 2, 5, 8]];
        const better = (c, b) => !b || c.p > b.p + 1e-12 || (Math.abs(c.p - b.p) <= 1e-12 && (c.d > b.d + 1e-12 || (Math.abs(c.d - b.d) <= 1e-12 && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
        (function go(i, pp, dd, nL) { if (nL > 5) return; if (i === G.length) { if (nL < 2) return; const idz = pick.flatMap(o => o.legs.map(l => l.sk)).sort().join(',');
          for (const [id, lo, hi, F] of OLDLV) if (nL >= lo && nL <= hi && dd >= F - 1e-9) { const c = { p: pp, d: dd, n: nL, ids: idz }; if (better(c, best[id])) best[id] = c; } return; }
          go(i + 1, pp, dd, nL); for (const o of G[i]) { pick.push(o); go(i + 1, pp * o.p, dd * o.d, nL + o.legs.length); pick.pop(); } })(0, 1, 1, 0); return best; })();
      chk(capped.safe && capped.safe.n === 2 && capped.safe.d < 2 && (!capped.med || capped.med.ids !== (T0[1].legs || []).map(legKey).sort().join(',')),
        `U: a cap of 5 put back (and Safe a pair) would take other parlays (Safe ${capped.safe ? capped.safe.n + ' legs at ' + capped.safe.d.toFixed(3) : '-'}, Medium ${capped.med ? capped.med.n + ' legs' : 'none'})`);
    }
    /* the floors at their very edge: -500 with -150 pays exactly $2.00 (1.2 x 1.6667), +100 with +100 exactly $4.00, and
       three at +100 exactly $8.00: each is taken where it is the likeliest at its floor; -500 with -155 (1.974) is not $2 */
    const DE = addDay(D0, 23), DE1 = addDay(DE, 1), atE = T(DE, '13:00:00');
    const e1 = mk(DE, 'ATL', 'BOS', T(DE1, '00:00'), [], { pHome: 0.85, spread: -15, total: 220 }), e2 = mk(DE, 'BKN', 'CHA', T(DE1, '00:30'), [], { pHome: 0.62, spread: -15, total: 220 }),
      e3 = mk(DE, 'CHI', 'CLE', T(DE1, '01:00'), [], { pHome: 0.62, spread: -15, total: 220 }), e4 = mk(DE, 'DAL', 'DEN', T(DE1, '01:30'), [], { pHome: 0.5, spread: -15, total: 220 }),
      e5 = mk(DE, 'DET', 'GSW', T(DE1, '02:00'), [], { pHome: 0.5, spread: -15, total: 220 }), e6 = mk(DE, 'HOU', 'IND', T(DE1, '02:30'), [], { pHome: 0.5, spread: -15, total: 220 });
    const mlE = (g, h, a) => ({ at: atE, espn: g.espn, ml: { home: h, away: a }, spread: null, total: null, ids: ids(g), props: null });
    const slE = [e1, e2, e3, e4, e5, e6], LE = { v: 1, at: atE, games: { [e1.id]: mlE(e1, -500, 380), [e2.id]: mlE(e2, -150, 130), [e3.id]: mlE(e3, -155, 135), [e4.id]: mlE(e4, 100, -120), [e5.id]: mlE(e5, 100, -120), [e6.id]: mlE(e6, 100, -120) } };
    const UE = uni('edge'), tE = T(DE, '15:00:00'), rE = runU(UE, stateOf(slE, { today: DE, generated: T(DE, '12:00') }), LE, tE), eE = rE.code === 0 ? readU(UE).night[nightKey(slE, DE)] : null;
    chk(rE.code === 0 && eE, `U: the run takes the night of the floors' edges: ${rE.last}`);
    if (eE) { const ME = levelsMatch('U edge', eE, slE, LE, Date.parse(tE)), sf = eE.tiers[0];
      const want = [`${e1.id}|ml|BOS|`, `${e2.id}|ml|CHA|`].sort().join(',');
      chk(sf.legs && sf.legs.map(legKey).sort().join(',') === want && Math.abs(sf.dec - 2) < 1e-9,
        `U: Safe at exactly $2.00 on $1 is taken (${sf.legs ? sf.legs.map(legKey).join(' + ') + ' at ' + sf.dec : sf.why}), never -500 with -155 at 1.974, as likely and under the floor`);
      chk(eE.tiers.every(t => !t.legs || t.dec >= t.price - 1e-9), `U: no level pays under its floor (${eE.tiers.map(t => t.legs ? t.dec : '-').join(', ')})`);
      void ME; }
  }

  /* the sets taken before NOCAP_FROM keep the rule they were taken under (Safe the likeliest pair, Medium and
     Aggressive 2 to 5 legs), held so by their levels' heads; a set of the old heads taken from NOCAP_FROM is refused
     unless the file it is held to holds it so, taken at the same time; the old rule's checks still bite on such a set */
  { const RL = fs.existsSync(path.join(ROOT, SC.LEDGER_REL)) ? JSON.parse(fs.readFileSync(path.join(ROOT, SC.LEDGER_REL), 'utf8')) : null;
    const olds = RL && RL.night ? Object.entries(RL.night).filter(([, e]) => SC.nightRule(e) === 'old') : [];
    /* held as the guard holds them (the review of 8 November 2026): a set of the old heads taken before NOCAP_FROM, or
       after it by a run of the page before the change that the file it is held to holds so, taken at the same time (the
       job's runs before the change landed); never refused for its time alone, which would jam the record for good */
    const heldOld = ([k, e]) => SC.oldOk(e, e) && SC.nightEntryBad(k, e, e.grade ? Date.parse(e.last) + 86400e3 : Date.parse(e.taken_at) + 60e3, e, null, null).length === 0;
    chk(olds.length > 0 && olds.every(heldOld),
      `U: every set of the old heads in the real record is held as the guard holds it and passes the old rule's checks (${olds.map(([k, e]) => `${k.split('|')[1]} taken ${e.taken_at}`).join(', ')})`);
    { const [k0, e0] = olds.find(([, e]) => !e.grade && Date.parse(e.tip) - LOCK > Date.parse(SC.NOCAP_FROM) + 120e3) || olds[olds.length - 1] || [], late = e0 && { ...clone(e0), taken_at: new Date(Math.min(Date.parse(SC.NOCAP_FROM) + 60e3, Date.parse(e0.tip) - LOCK - 60e3)).toISOString().replace(/\.\d{3}Z$/, 'Z') };
      chk(!!late && Date.parse(late.taken_at) >= Date.parse(SC.NOCAP_FROM) ? heldOld([k0, late]) : true,
        `U: a set of the old heads a run of the page before the change took after ${SC.NOCAP_FROM}, as the record holds it, is held so here too (${late ? late.taken_at : 'none'}): such a set in the real record never jams it`); }
    const toLock = olds.find(([, e]) => Date.parse(e.tip) - LOCK > Date.parse(SC.NOCAP_FROM) + 60e3);
    if (toLock) { const [k, e0] = toLock, late = new Date(Date.parse(SC.NOCAP_FROM) + 60e3).toISOString().replace(/\.\d{3}Z$/, 'Z'), e = { ...clone(e0), taken_at: late }, now = Date.parse(late) + 1000;
      const b1 = SC.nightEntryBad(k, e, now, null, null, null), b2 = SC.nightEntryBad(k, e, now, clone(e), null, null);
      chk(b1.some(x => /with a leg limit .* a rule the record has not taken since/.test(x)) && !b2.some(x => /with a leg limit/.test(x)),
        `U: a set of the old heads taken after ${SC.NOCAP_FROM} is refused (${b1.find(x => /leg limit/.test(x)) || 'not refused'}), and kept where the file it is held to holds it so, taken at the same time`);
      const e3 = clone(e0), t3 = e3.tiers.find(t => t.id === 'med' && t.legs);
      if (t3) { t3.legs = [...t3.legs, ...t3.legs, ...t3.legs].slice(0, 6);
        chk(SC.nightEntryBad(k, e3, Date.parse(e0.taken_at) + 60e3, null, null, null).some(x => /6 legs, outside its 2 to 5/.test(x)), 'U: the old rule still bites on a set taken under it: its Medium of 6 legs is refused (outside its 2 to 5)'); }
      const e4 = clone(e0); e4.tiers.forEach((t, i) => { t.max = SC.NIGHT_LEVELS[i][3]; t.price = SC.NIGHT_LEVELS[i][4]; });
      chk(SC.nightEntryBad(k, e4, Date.parse(e0.taken_at) + 60e3, null, null, null).some(x => /pays [\d.]+ on \$1, under its floor 2/.test(x)),
        "U: the same set's levels under the new heads are held to the new rule: its Safe, a pair paying under $2, is refused"); }
  }

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

  console.log('P. a night with player legs');
  { const U = uni('players'), DP = addDay(D0, 16), DP1 = addDay(DP, 1);
    const p1 = mk(DP, 'ORL', 'MIA', T(DP1, '00:00'), [], { pHome: 0.62, spread: -4, total: 221 }), p2 = mk(DP, 'PHI', 'TOR', T(DP1, '00:30'), [], { pHome: 0.4, spread: 3, total: 226 });
    const slP = [p1, p2], kP = nightKey(slP, DP), lockP = Date.parse(p1.tip) - LOCK;
    /* the props model's rows, and DraftKings' main lines priced so the side each names is likely: Pa's points and his
       rebounds (one leg a player), Pb's rebounds under, Pc's assists (Pc listed Questionable: held out), Pd's rebounds on a
       whole line (a push to come) and his points priced on the Over alone, Pe's points (no box line to come: void); a
       milestone and a Yes market beside them. Pa's two lines are the likeliest of the night, so a page that took two legs
       of one player would pair them */
    const rowsP = { [p1.id]: { 9500001: ['Pa Guard', 'ORL', 'G', 34, 25, 6, 5, 2, 1, 0.3, 0.1, 0.01], 9500002: ['Pb Wing', 'MIA', 'F', 30, 14, 8, 2, 1, 1, 0.5, 0.1, 0.01], 9500003: ['Pc Held', 'ORL', 'G', 31, 16, 4, 7, 2, 1, 0.2, 0.1, 0.01] },
      [p2.id]: { 9500004: ['Pd Big', 'TOR', 'C', 32, 18, 11, 2, 0.5, 0.6, 1.5, 0.4, 0.01], 9500005: ['Pe Dnp', 'PHI', 'G', 28, 18, 4, 4, 2, 1, 0.3, 0.1, 0.01] } };
    const mainsP = { [p1.id]: [['9500001', 'pts', 17.5, -1200, 700], ['9500001', 'reb', 3.5, -1000, 650], ['9500002', 'reb', 12.5, 250, -350], ['9500003', 'ast', 4.5, -600, 400]],
      [p2.id]: [['9500004', 'reb', 8, -450, 310], ['9500004', 'pts', 12.5, -300, null], ['9500005', 'pts', 10.5, -700, 450]] };
    const lineP = (g, at) => ({ ...lineOf(g, { at }), props: { at, mains: mainsP[g.id].map(([player, stat, line, over, under]) => ({ player, stat, line, over, under })),
      ladders: [{ player: g.id === p1.id ? '9500001' : '9500005', stat: 'pts', k: 10, price: -2000 }], yes: [{ player: g.id === p1.id ? '9500002' : '9500004', market: 'dd', price: -900 }] } });
    const LP = at => ({ v: 1, at, games: { [p1.id]: lineP(p1, at), [p2.id]: lineP(p2, at) } });
    const QREP = { 9500003: ['Pc Held', 'Questionable', 'knee'] };
    const stP = (o = {}, sl = slP) => { const st = stateOf(sl, { today: DP, generated: T(DP, '12:00'), report: QREP, ...o });
      st.props.games = Object.fromEntries(slP.filter(g => g.status === 'scheduled').map(g => [g.id, { tip: g.tip, away: g.away, home: g.home, players: clone(rowsP[g.id]) }])); return st; };
    /* this file's own pool: the team legs as above, and each main line over and under with both prices at DraftKings' own
       fair chance (the Over 1 less the Under's implied chance, the Under that chance), 45% to 97%, on a player the props
       model places on one of the game's clubs and the report does not list (a probable player plays) */
    const heldP = (st, g, pid) => { if ([g.model.home, g.model.away].some(x => (x.out || []).some(y => String(y.id) === String(pid)))) return true;
      const r = st.report.players[pid]; return Array.isArray(r) && !/^probable/i.test(String(r[1] || '').trim()); };
    const poolP = (st, lines, now) => { const legs = poolOwn(slP.map(g => st.slate.find(x => x.id === g.id)), lines, now, DP);
      for (const g of nightGames(st.slate, DP).filter(g => g.status === 'scheduled' && Date.parse(g.tip) > now)) {
        const pr = lines.games[g.id] && lines.games[g.id].props, rows = st.props.games[g.id] && st.props.games[g.id].players; if (!pr || !rows) continue;
        for (const m of pr.mains) { const row = rows[m.player];
          if (!row || (row[1] !== g.away && row[1] !== g.home) || heldP(st, g, m.player) || !Number.isFinite(m.over) || !Number.isFinite(m.under)) continue;
          const fo = 1 - imp(m.under);
          for (const [sd, odds, other, pp] of [['over', m.over, m.under, fo], ['under', m.under, m.over, 1 - fo]]) if (pp >= 0.45 && pp < 0.97)
            legs.push({ sk: [g.id, 'prop', m.player, m.stat, 'main', m.line, sd].join('|'), gid: g.id, kind: 'prop', pid: String(m.player), stat: m.stat, side: sd, line: m.line, odds, other, p: pp, d: dec(odds), home: g.home, team: row[1] }); } }
      return legs.sort((a, b) => a.sk < b.sk ? -1 : 1); };
    const kOf = l => SC.legKey(l);
    const matchP = (tag, e, st, lines, now, x0) => { const legs = poolP(st, lines, now), { best, count } = levelsP(optsP(legs)); let all = true;
      for (const t of (x0 ? [x0] : e.tiers)) { const b = best[t.id];
        if (!t.legs) { chk(!b, `${tag} ${t.id}: empty ("${t.why}"), and this file's own enumeration finds none (${b ? b.ids : ''})`); continue; }
        const mine = t.legs.map(kOf).sort().join(','), ok = b && b.ids === mine && Math.abs(b.p - t.p) < 1e-4 && Math.abs(b.d - t.dec) < 1e-3; all = all && ok;
        chk(!!b && (t.nopl || null) === b.nopl && t.need === 'player', `${tag} ${t.id}: the rule with a player in its head, and ${b && b.nopl ? `none held, saying why "${b.nopl}"` : 'a player held, no why'} (the entry: ${t.need}, ${t.nopl || 'none'})`);
        chk(ok, `${tag} ${t.id}: the likeliest its rule takes (with a player wherever a parlay holding one meets it) by this file's own enumeration of ${count} parlays (${b ? `${b.ids} ${(b.p * 100).toFixed(3)}% ${b.d.toFixed(3)}` : 'none'}; the entry ${mine} ${t.p} ${t.dec})`); }
      return { legs, best, all }; };

    /* P1: the morning of DP, Pc listed Questionable */
    { const L3 = [{ gid: 'x', kind: 'prop', stat: 'pts', pid: '1', team: 'ORL', side: 'over', home: 'MIA' }, { gid: 'x', kind: 'prop', stat: 'reb', pid: '2', team: 'MIA', side: 'under', home: 'MIA' }, { gid: 'x', kind: 'total', side: 'over', home: 'MIA' }];
      const R3 = rhoM(L3), ps = [0.77, 0.74, 0.52], a = orthOwn(ps.map(q => PJ.normInv(1 - q)), R3), b = triSimpson(ps, R3);
      chk(Math.abs(a - b) < 1e-8 && R3[0][1] !== 0, `P: this file's own copula, its two readings of three legs one number (${a.toFixed(10)} and ${b.toFixed(10)}, rho ${R3[0][1]}, ${R3[0][2]}, ${R3[1][2]})`); }
    const tP1 = T(DP, '15:00:00'), L1P = LP(T(DP, '14:30:00')), st1 = stP();
    let rP = runU(U, st1, L1P, tP1);
    const eP = rP.code === 0 ? (readU(U).night || {})[kP] : null;
    chk(rP.code === 0 && eP && eP.pool.pl, `P: the night is taken on the player-leg rule (its pool's pl ${eP ? JSON.stringify(eP.pool.pl) : 'none'}): ${rP.last}`);
    if (!eP) { chk(false, 'P: no entry to go on with'); }
    else {
      const own1 = poolP(st1, L1P, Date.parse(tP1)), plOwn = own1.filter(l => l.kind === 'prop');
      const m1 = matchP('P1', eP, st1, L1P, Date.parse(tP1));
      const lvls = eP.tiers.filter(t => t.legs), props = lvls.flatMap(t => t.legs.filter(l => l.kind === 'prop'));
      chk(plOwn.length === 5 && plOwn.every(l => l.pid !== '9500003') && !plOwn.some(l => l.sk.includes('|pts|main|12.5|')), `P: this file's own pool holds five player legs, none of Pc (listed Questionable), none on the line priced on one side (${plOwn.map(l => l.sk.split('|').slice(2).join(' ')).join('; ')})`);
      chk(props.length > 0 && lvls.some(t => t.legs.some(l => l.kind === 'prop') && t.legs.some(l => l.kind !== 'prop')), `P: the levels take player legs, a level mixing them with team legs (${lvls.map(t => `${t.id} ${t.legs.map(l => l.kind === 'prop' ? 'p' : 't').join('')}`).join(', ')})`);
      chk(props.every(l => l.mk === 'main' && Number.isFinite(l.other) && l.pid !== '9500003' && Math.abs(l.p - (l.side === 'under' ? imp(l.odds) : 1 - imp(l.other))) < 6e-5 && l.fair === l.p && !l.fair_est) && lvls.every(t => { const ps = t.legs.filter(l => l.kind === 'prop').map(l => l.pid); return new Set(ps).size === ps.length; }),
        "P: each player leg a main line with both prices at DraftKings' own fair chance (its chance and its fair chance one number), none of a listed player, one leg a player in every level");
      chk(lvls.some(t => { const by = {}; for (const l of t.legs) by[l.id] = (by[l.id] || 0) + 1; return Object.values(by).some(v => v >= 2) && t.legs.some(l => l.kind === 'prop'); }), "P: a level holds a game's legs together, a player's among them, at the copula's joint chance");
      /* the pool the record keeps: compact, and the guard's own enumeration on it gives every level again */
      const kp = SC.nightPool(eP), plKept = eP.pool.legs.filter(x => x.length === 4).length, bytesP = JSON.stringify(eP).length;
      chk(kp && SC.NIGHT_LEVELS.every((lv, i) => { const t = eP.tiers[i], b = SC.nightBest(kp, lv, null, !!t.legs && t.legs.some(l => l.kind === 'prop')); return t.legs ? b && b.ids === t.legs.map(kOf).sort().join(',') : !b; }) && plKept <= plOwn.length && eP.pool.pl.lines === 2 * 5 && eP.pool.pl.held === 2 && eP.pool.pl.cut === plOwn.length - plKept,
        `P: the pool kept (${eP.pool.legs.length} legs, ${plKept} of them players', ${eP.pool.pairs.length} pairs, ${(eP.pool.sets || []).length} sets of three or more; ${bytesP} bytes the entry) makes every level again by the guard's own enumeration; its counts ${JSON.stringify(eP.pool.pl)}`);
      chk(SC.check(readU(U), null, Date.parse(tP1), null, SEASON, st1).length === 0, 'P: the ledger passes the guard, the state beside it: ' + SC.check(readU(U), null, Date.parse(tP1), null, SEASON, st1).slice(0, 2).join(' | '));
      /* the guard refuses each break, planted on the entry */
      const failsP = (mut, re, what) => { const L1x = clone(readU(U)), e1 = L1x.night[kP]; mut(e1, L1x); L1x.night_summary = SC.summarizeNight(L1x.night);
        const b = SC.check(L1x, null, Date.parse(tP1), null, SEASON, st1); chk(b.some(x => re.test(x)), `P: the guard fails ${what} (${b.slice(0, 2).join(' | ') || 'no failure'})`); };
      const lvP = eP.tiers.find(t => t.legs && t.legs.some(l => l.kind === 'prop')), iP = eP.tiers.indexOf(lvP), lP = lvP.legs.findIndex(l => l.kind === 'prop');
      failsP(e => { const l = e.tiers[iP].legs[lP], row = rowsP[l.id][l.pid]; e.tiers[iP].legs[lP] = { ...l, p: 0.9 }; const x = e.pool.legs.find(y => y[0] === kOf(l)); if (x) x[2] = 0.9; void row; },
        /its pool is not a pool|not in its pool|not its legs'/, "a player's leg at a chance other than DraftKings' fair chance (the model's), in the level and its pool");
      failsP(e => { const t = e.tiers[iP], l = t.legs[lP]; t.legs.push({ ...l, stat: l.stat === 'pts' ? 'reb' : 'pts', line: 3.5 }); }, /two legs of one player/, 'two legs of one player in a level');
      failsP(e => { const t = e.tiers[iP], l = t.legs[lP]; t.legs[lP] = { ...l, mk: 'mile', k: 10, line: undefined, side: 'yes', other: null }; }, /not a main line/, 'a milestone (a ladder) in a level');
      failsP(e => { const x = e.pool.legs.find(y => y.length === 4 && y[0].startsWith(p1.id + '|')); x[0] = x[0].replace(/\|prop\|\d+\|/, '|prop|9500003|'); }, /a player listed questionable/, 'a player listed Questionable in the pool before the lock');
      failsP(e => { const need = lvP.legs.filter(l => l.kind === 'prop').map(kOf), ix = e.pool.legs.findIndex(y => y[0] === need[0]);
        e.pool.legs.splice(ix, 1); e.pool.pairs = e.pool.pairs.filter(x => !x.slice(0, -2).includes(ix)).map(x => [...x.slice(0, -2).map(i => i > ix ? i - 1 : i), ...x.slice(-2)]);
        e.pool.sets = (e.pool.sets || []).filter(x => !x.slice(0, -2).includes(ix)).map(x => [...x.slice(0, -2).map(i => i > ix ? i - 1 : i), ...x.slice(-2)]); }, /not in its pool/, 'a pool compacted past a leg its level needs');
      /* THE GUARD'S OWN READING (the review of 7 November 2026): on the run's own state and lines.json the ledger passes,
         its pool's counts and kept player legs this reading's; and a ledger whose winning player leg was cut from the pool
         with each level holding it swapped for the runner-up the cut pool makes (the counts kept true: one more cut), which
         the kept pool alone cannot tell, fails it */
      chk(SC.check(readU(U), null, Date.parse(tP1), null, SEASON, st1, L1P).length === 0, "P: the ledger passes the guard's own reading of the run's state and lines.json: " + SC.check(readU(U), null, Date.parse(tP1), null, SEASON, st1, L1P).slice(0, 2).join(' | '));
      { const L1x = clone(readU(U)), e1 = L1x.night[kP], k = kOf(lvP.legs[lP]), ix = e1.pool.legs.findIndex(y => y[0] === k);
        e1.pool.legs.splice(ix, 1); const drop = xs => xs.filter(x => !x.slice(0, -2).includes(ix)).map(x => [...x.slice(0, -2).map(i => i > ix ? i - 1 : i), ...x.slice(-2)]);
        e1.pool.pairs = drop(e1.pool.pairs); e1.pool.sets = drop(e1.pool.sets || []); e1.pool.pl.cut++;
        const kp = SC.nightPool(e1), legOfKey = key => { const f = key.split('|'), x = e1.pool.legs.find(y => y[0] === key);
          return f[1] === 'prop' ? { id: f[0], kind: 'prop', pid: f[2], stat: f[3], mk: 'main', line: +f[5], side: f[6], odds: x[1], other: x[3], p: x[2] } : { id: f[0], kind: f[1], side: f[2], line: f[3] === '' ? null : +f[3], odds: x[1], p: x[2] }; };
        e1.tiers.forEach((t, i) => { if (!t.legs || !t.legs.some(l => kOf(l) === k)) return; const b = SC.nightBest(kp, SC.NIGHT_LEVELS[i], null, true);
          e1.tiers[i] = b ? { ...t, legs: b.ids.split(',').map(legOfKey), p: Math.round(b.p * 1e4) / 1e4, dec: r3(b.d) } : { id: t.id, label: t.label, min: t.min, max: t.max, price: t.price, why: 'none' }; });
        L1x.night_summary = SC.summarizeNight(L1x.night);
        const b0 = SC.check(L1x, null, Date.parse(tP1), null, SEASON, st1), b1 = SC.check(L1x, null, Date.parse(tP1), null, SEASON, st1, L1P);
        chk(!b0.length && b1.some(x => /not the likeliest/.test(x)), `P: the winning player leg cut from the pool and its levels the runner-up: the kept pool alone passes (${b0.length} failures), the guard's own reading of the run's files fails it (${b1.slice(0, 1).join('') || 'no failure'})`); }
      /* a player's main line priced with no margin (+105 both ways) in the pool: refused (the page leaves such a line out) */
      failsP(e => { const pp = SC.plFair('over', 105, 105); e.pool.legs.push([`${p2.id}|prop|9500004|blk|main|0.5|over`, 105, pp, 105]); }, /its pool is not a pool/, 'a player\'s line priced with no margin in the pool');
      const LP1 = clone(readU(U));

      /* P2: after the lock, a player in a level (not Pe, whose box line is to be missing) listed Day-To-Day: the level
         holding him alone built again on the lines at hand, this file's own enumeration without him; the others to the byte */
      const victim = props.find(l => l.pid !== '9500005'), lineP0 = lineIn(fs.readFileSync(path.join(U, 'ledger.json'), 'utf8'), kP);
      chk(!!victim, `P: a player to list after the lock (${victim ? victim.name : 'none but Pe'})`);
      if (victim) {
        const rep2 = { ...QREP, [victim.pid]: [victim.name, 'Day-To-Day', 'ankle'] }, st2 = stP({ report: rep2, generated: T(DP, '22:20') }), tP2 = T(DP, '22:30:00');
        rP = runU(U, st2, L1P, tP2);
        const e2 = rP.code === 0 ? readU(U).night[kP] : null, hit = eP.tiers.filter(t => t.legs && t.legs.some(l => String(l.pid) === victim.pid)).map(t => t.id);
        const whyV = 'listed day-to-day (ankle), so held out';
        chk(rP.code === 0 && e2 && hit.length > 0 && e2.tiers.every((t, i) => hit.includes(t.id) ? t.updated && t.updated.pid === victim.pid && t.updated.reason === whyV && t.updated.at === tP2 && t.pool && t.pool.pl && !(t.legs || []).some(l => String(l.pid) === victim.pid)
            : JSON.stringify(t) === JSON.stringify(eP.tiers[i])) && Array.isArray(e2.updates) && e2.updates.length === hit.length && e2.updates.every(u => u.pid === victim.pid && hit.includes(u.tier) && u.at === tP2)
          && JSON.stringify({ ...e2, tiers: null, updates: null, grade: null }) === JSON.stringify({ ...eP, tiers: null, updates: null, grade: null }),
          `P2: ${victim.name} listed day-to-day after the lock: ${hit.join(', ')} built again without him, marked ${JSON.stringify(e2 && e2.tiers.find(t => t.updated) ? e2.tiers.find(t => t.updated).updated : null)}, recorded in its updates; every other level to the byte: ${rP.last}`);
        if (e2) for (const id of hit) { const x = e2.tiers.find(t => t.id === id); matchP('P2', e2, st2, L1P, Date.parse(tP2), x); }
        chk(SC.check(readU(U), null, Date.parse(tP2), null, SEASON, st2).length === 0 && /replaced/.test(rP.out), 'P2: the ledger with its replacement passes the guard: ' + SC.check(readU(U), null, Date.parse(tP2), null, SEASON, st2).slice(0, 2).join(' | '));
        const lineP2 = lineIn(fs.readFileSync(path.join(U, 'ledger.json'), 'utf8'), kP);
        rP = runU(U, stP({ report: rep2, generated: T(DP, '22:50') }), L1P, T(DP, '23:00:00'));
        chk(rP.code === 0 && lineIn(fs.readFileSync(path.join(U, 'ledger.json'), 'utf8'), kP) === lineP2, `P2: a later run before the tip-off with him still listed builds nothing again: ${rP.last}`);
        /* the guard fails a replacement the rule does not allow */
        { const L1x = clone(readU(U)), e1 = L1x.night[kP], x = e1.tiers.find(t => t.updated); if (x) x.legs = clone(eP.tiers.find(t => t.id === x.id).legs); L1x.night_summary = SC.summarizeNight(L1x.night);
          const b = SC.check(L1x, readU(U), Date.parse(T(DP, '23:00:00')), null, SEASON, st2); chk(b.some(y => /still holds him|not the likeliest|not in its pool/.test(y)), `P2: the guard fails a replaced level that still holds the player (${b.slice(0, 1).join('')})`); }
        /* the replacement held to the state of the run that made it (the review of 7 November 2026): against the ledger
           before it, on the run's own state and lines.json it passes, the level built again on this file's own reading;
           on a state that does not list him, and on one listing a player its own pool holds, it fails */
        { const L2 = readU(U), now2 = Date.parse(tP2);
          const ok2 = SC.check(L2, LP1, now2, null, SEASON, st2, L1P);
          chk(!ok2.length, "P2: the replacement passes the guard against the ledger before it, on the run's state and the guard's own reading of its lines.json: " + ok2.slice(0, 2).join(' | '));
          const bU = SC.check(L2, LP1, now2, null, SEASON, stP({ report: QREP, generated: T(DP, '22:20') }));
          chk(bU.some(y => /whom the run's state\.json does not list/.test(y)), `P2: the guard fails a replacement for a player the run's state does not list (${bU.slice(0, 1).join('') || 'no failure'})`);
          const x2 = L2.night[kP].tiers.find(t => t.updated), o2 = x2 ? (SC.nightPool(L2.night[kP], x2.pool) || { legs: [] }).legs.find(l => l.pid && l.pid !== victim.pid) : null;
          const bO = o2 ? SC.check(L2, LP1, now2, null, SEASON, stP({ report: { ...rep2, [o2.pid]: ['x', 'Out', 'knee'] }, generated: T(DP, '22:20') })) : [];
          chk(!!o2 && bO.some(y => /built again on a pool holding .*, a player listed out/.test(y)), `P2: the guard fails a level built again on a pool holding a player the run's state lists (${o2 ? o2.sk : 'no other player in its pool'}: ${bO.slice(0, 1).join('') || 'no failure'})`); }
        /* from the first tip-off nothing is built again, though another player of a level is listed then */
        const other = e2 ? e2.tiers.flatMap(t => (t.legs || []).filter(l => l.kind === 'prop' && l.pid !== victim.pid))[0] : null;
        const rep3 = other ? { ...rep2, [other.pid]: [other.name, 'Out', 'rest'] } : rep2;
        rP = runU(U, stP({ report: rep3, generated: T(DP1, '00:05') }), L1P, T(DP1, '00:10:00'));
        chk(rP.code === 0 && !!lineP2 && JSON.stringify(SC.callOf(readU(U).night[kP])) === JSON.stringify(SC.callOf(entryOfLine(lineP2, kP))), `P2: from the first tip-off nothing is built again${other ? ` (${other.name} listed out then)` : ''}: ${rP.last}`);
        void lineP0;
      }
      /* P3: played. Box lines: every player leg wins but Pd's rebounds on a whole line (8: a push) and Pe, who has none
         (void); each game's final making its team legs in the levels win. Graded as a book settles it */
      const e3 = readU(U).night[kP], gameLegs = gid => e3.tiers.flatMap(t => (t.legs || []).filter(l => l.id === gid && l.kind !== 'prop'));
      const settleT = (l, as, hs) => { if (l.kind === 'ml') return (l.side === l.home ? hs > as : as > hs) ? 'win' : 'loss'; if (l.kind === 'spread') { const m = (l.side === l.home ? hs - as : as - hs) + l.line; return m === 0 ? 'push' : m > 0 ? 'win' : 'loss'; } const t = as + hs; return t === l.line ? 'push' : (t > l.line) === (l.side === 'over') ? 'win' : 'loss'; };
      const scoreP = g => { const L = gameLegs(g.id); for (let as = 90; as <= 135; as++) for (let hs = 90; hs <= 135; hs++) if (as !== hs && L.every(l => settleT(l, as, hs) === 'win')) return [as, hs]; return null; };
      const sc1 = scoreP(p1), sc2 = scoreP(p2);
      const BX = { [p1.id]: { 9500001: [25, 6, 5, 2, 1, 0], 9500002: [12, 5, 2, 1, 1, 0], 9500003: [14, 3, 8, 1, 0, 0] }, [p2.id]: { 9500004: [19, 8, 2, 0, 1, 2] } };
      const played = slP.map(g => fin(g, ...(g.id === p1.id ? sc1 : sc2)));
      rP = runU(U, stP({ today: DP1, generated: T(DP1, '11:00'), boxes: BX, report: {} }, played), L1P, T(DP1, '12:00:00'));
      const e4 = rP.code === 0 ? readU(U).night[kP] : null;
      /* this file's own settlement */
      const boxV = (l, k) => { const b = BX[l.id] && BX[l.id][l.pid]; return b ? b[['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'].indexOf(k)] : null; };
      const resOf = l => { if (l.kind !== 'prop') { const g = played.find(x => x.id === l.id); return settleT(l, g.awayScore, g.homeScore); } const v = boxV(l, l.stat); if (v == null) return 'void'; return v === l.line ? 'push' : (v > l.line) === (l.side === 'over') ? 'win' : 'loss'; };
      const gradeOwn = t => { const res = t.legs.map(resOf); if (res.includes('loss')) return { result: 'lost', legs: res, payout: 0 };
        const left = t.legs.filter((l, i) => res[i] === 'win'); if (!left.length) return { result: 'push', legs: res, payout: 1 };
        if (left.length === t.legs.length) return { result: 'won', legs: res, payout: t.dec };
        const by = new Map(); for (const l of left) { if (!by.has(l.id)) by.set(l.id, []); by.get(l.id).push({ ...l, gid: l.id, d: dec(l.odds), team: l.kind === 'prop' ? l.team : l.side }); }
        let pay = 1; for (const L of by.values()) pay *= figOwn(L).d; return { result: 'won', legs: res, payout: r3(pay) }; };
      const st4 = stP({ today: DP1, boxes: BX, report: {} }); void st4;
      chk(sc1 && sc2 && e4 && e4.grade && e4.tiers.every(t => { if (!t.legs) return true; const g = e4.grade[t.id], o = gradeOwn(t); return g && g.result === o.result && JSON.stringify(g.legs) === JSON.stringify(o.legs) && Math.abs((g.payout || 0) - o.payout) < 0.0011; })
        && e4.tiers.some(t => t.legs && e4.grade[t.id].legs.includes('void')),
        `P3: played: every level graded from the box lines as a book settles it, Pe (no box line) void and Pd's whole line a push dropping out, the rest paid by this file's own sums (${e4 ? e4.tiers.map(t => t.legs ? `${t.id} ${e4.grade[t.id].result} ${JSON.stringify(e4.grade[t.id].legs)} ${e4.grade[t.id].payout}` : t.id + ' empty').join('; ') : 'no entry'}): ${rP.last}`);
      chk(rP.code === 0 && SC.check(readU(U), null, Date.parse(T(DP1, '12:00:00')), null, SEASON).length === 0, 'P3: the graded ledger passes the guard');
      /* a win with legs dropped pays the price of the legs left (the review of 7 November 2026: any payout over 1 passed):
         at most their prices multiplied, exactly that where each game is left one leg */
      { const gt = (legs, dd, res, payout) => SC.gradeBad('k', { tiers: [{ id: 'med', legs, dec: dd }], grade: { med: { result: 'won', legs: res, payout } } });
        const Lg = [{ id: 'g1', odds: -110 }, { id: 'g2', odds: 150 }, { id: 'g3', odds: -200 }], left = r3(dec(150) * dec(-200)), whole = r3(dec(-110) * dec(150) * dec(-200));
        const Ls = [{ id: 'g1', odds: -110 }, { id: 'g2', odds: 150 }, { id: 'g2', odds: -200 }];
        const cases = [[Lg, ['void', 'win', 'win'], left, true, 'the legs left priced alone'], [Lg, ['void', 'win', 'win'], whole, false, 'its whole price'], [Lg, ['void', 'win', 'win'], 9.99, false, 'over the whole price'],
          [Lg, ['push', 'win', 'win'], 1.0001, false, 'barely over 1'], [Ls, ['void', 'win', 'win'], r3(dec(150) * dec(-200)) - 0.4, true, "a game's two legs left at a same-game price under their product"],
          [Ls, ['void', 'win', 'win'], 3.9, false, "a game's two legs left over their prices multiplied"]];
        const out = cases.map(([L0, res, pay, good]) => (gt(L0, whole, res, pay).length === 0) === good);
        chk(out.every(Boolean), `P3: a win with a leg dropped pays the legs left's price: ${cases.map((c, i) => `${c[4]} (${c[2]}) ${c[3] ? 'passes' : 'fails'}${out[i] ? '' : ' NOT AS IT SHOULD'}`).join('; ')}`); }

      /* X: a fair pair of one game that moves together is the likeliest pair of the night (the review of 7 November 2026;
         since the $2 floor of 8 November 2026 at prices that pay it): the Thunder to win at -150 (the model's 58%, under
         its price) with a Wizard's Under 18.5 points at -150 (DraftKings' fair 60%), and the Hawks to win at -133 (60.5%) in
         the other game. The Under with the Hawks multiply to 36.3%; the same-game pair, its chances multiplied 34.8%, lands
         about 36.7% together by the copula, and pays $2.36 at the same-game hold. The job's Safe is the pair, every level
         this file's own enumeration's, and the guard's own reading passes it */
      { const UX = uni('fairpair'), DX = addDay(D0, 20), DX1 = addDay(DX, 1);
        const x1 = mk(DX, 'WAS', 'OKC', T(DX1, '00:00'), [], { pHome: 0.58, spread: -8, total: 228 }), x2 = mk(DX, 'BKN', 'ATL', T(DX1, '00:30'), [], { pHome: 0.605, spread: -6, total: 230 }), slX = [x1, x2];
        const rowX = ['Xa Wiz', 'WAS', 'G', 32, 20, 4, 3, 2, 1, 0.3, 0.05, 0.01];
        const LXat = T(DX, '14:00:00'), LX = { v: 1, at: LXat, games: { [x1.id]: { ...lineOf(x1, { at: LXat }), ml: { home: -150, away: 130 }, props: { at: LXat, mains: [{ player: '9700001', stat: 'pts', line: 18.5, over: 125, under: -150 }], ladders: [], yes: [] } },
          [x2.id]: { ...lineOf(x2, { at: LXat }), ml: { home: -133, away: 115 }, props: null } } };
        const stX = stateOf(slX, { today: DX, generated: T(DX, '12:00') }); stX.props.games = { [x1.id]: { tip: x1.tip, away: x1.away, home: x1.home, players: { 9700001: rowX } } };
        const tX = T(DX, '15:00:00'), rX = runU(UX, stX, LX, tX), eX = rX.code === 0 ? (readU(UX).night || {})[nightKey(slX, DX)] : null;
        const und = { sk: [x1.id, 'prop', '9700001', 'pts', 'main', 18.5, 'under'].join('|'), gid: x1.id, kind: 'prop', pid: '9700001', stat: 'pts', side: 'under', line: 18.5, odds: -150, other: 125, p: imp(-150), d: dec(-150), home: x1.home, team: 'WAS' };
        const legsX = [...poolOwn(slX, LX, Date.parse(tX), DX), und].sort((a, b) => a.sk < b.sk ? -1 : 1), { best } = levelsP(optsP(legsX));
        const okcMl = [x1.id, 'ml', 'OKC', ''].join('|'), sfX = eX && eX.tiers[0].legs ? eX.tiers[0].legs.map(kOf).sort().join(',') : null;
        chk(!!eX && best.safe && best.safe.ids === [okcMl, und.sk].sort().join(',') && sfX === best.safe.ids && best.safe.p > 0.6 * 0.605 && eX.tiers[0].dec >= 2,
          `X: the job's Safe is the same-game pair (${sfX}, ${eX ? eX.tiers[0].p : '-'}), this file's own enumeration's (${best.safe ? (best.safe.p * 100).toFixed(3) : '-'}%, over the Under and the Hawks' 36.300%, paying ${eX ? eX.tiers[0].dec : '-'}): ${rX.last}`);
        if (eX) for (const t of eX.tiers) { const b = best[t.id], mine = t.legs ? t.legs.map(kOf).sort().join(',') : null;
          chk(t.legs ? b && b.ids === mine && Math.abs(b.p - t.p) < 1e-4 && Math.abs(b.d - t.dec) < 1e-3 : !b, `X ${t.id}: this file's own enumeration's (${b ? `${b.ids} ${(b.p * 100).toFixed(3)}% ${b.d.toFixed(3)}` : 'none'}; the entry ${mine || t.why})`); }
        chk(!!eX && SC.check(readU(UX), null, Date.parse(tX), null, SEASON, stX, LX).length === 0, "X: the guard's own reading of the run's files passes it"); }

      /* W: the review of 8 November 2026 (no leg limit). A page variant of this file's own is written over a run's copy of
         the built page (pageW), so the guard meets the page it must refuse */
      console.log('W. the review of 8 November 2026');
      const pageW = (U, from, to) => { const f = path.join(U, 'index.html'), h = fs.readFileSync(f, 'utf8'); if (h.split(from).length !== 2) return false; fs.writeFileSync(f, h.replace(from, to)); return true; };
      const rowOf = (name, team) => [name, team, 'G', 32, 20, 6, 5, 2, 1, 0.5, 0.05, 0.01];
      /* this file's own pool of a night's legs: its team legs (poolOwn) and every player main line in the band */
      const poolW = (slate, st, lines, now, d) => { const legs = poolOwn(slate, lines, now, d);
        for (const g of slate) { const pr = lines.games[g.id] && lines.games[g.id].props, rows = st.props.games[g.id] && st.props.games[g.id].players; if (!pr || !rows) continue;
          for (const m of pr.mains) { const row = rows[m.player]; if (!row) continue; const fo = 1 - imp(m.under);
            for (const [sd, odds, other, pp] of [['over', m.over, m.under, fo], ['under', m.under, m.over, 1 - fo]]) if (pp >= 0.45 && pp < 0.97)
              legs.push({ sk: [g.id, 'prop', m.player, m.stat, 'main', m.line, sd].join('|'), gid: g.id, kind: 'prop', pid: String(m.player), stat: m.stat, side: sd, line: m.line, odds, other, p: pp, d: dec(odds), home: g.home, team: row[1] }); } }
        return legs.sort((a, b) => a.sk < b.sk ? -1 : 1); };
      /* W1, W2: four games of heavy player Unders (-865 to -915) and no game line: Safe is 9 legs, a group of four legs of
         one game, one of three and two of the others' (the review's night). The job's levels are this file's own
         enumeration of every parlay; the page with a leg limit of 5 put back leaves every level empty, and the guard, by
         its own groups of a game's legs (suggest_check.js, THE GUARD'S OWN GROUPS), refuses the run, where it passed it
         ranking only the pool the page kept; and the page that keeps the record's pool without its single player legs is
         refused at the take, as it would be on every run from the lock (the guard holds a set the run took to the pool it
         keeps too) */
      { const DW = addDay(D0, 24), DW1 = addDay(DW, 1), atW = T(DW, '13:00:00');
        const w1 = mk(DW, 'WAS', 'OKC', T(DW1, '00:00'), [], { pHome: 0.6 }), w2 = mk(DW, 'BKN', 'ATL', T(DW1, '00:30'), [], { pHome: 0.6 }),
          w3 = mk(DW, 'IND', 'DEN', T(DW1, '01:00'), [], { pHome: 0.6 }), w4 = mk(DW, 'SAC', 'UTA', T(DW1, '02:00'), [], { pHome: 0.6 }), slW = [w1, w2, w3, w4];
        const PLW = { [w1.id]: [['9800001', 'OKC', 'pts', 24.5, -900], ['9800002', 'OKC', 'reb', 7.5, -880], ['9800003', 'WAS', 'ast', 6.5, -915], ['9800004', 'WAS', 'pts', 21.5, -865]],
          [w2.id]: [['9800011', 'ATL', 'reb', 9.5, -905], ['9800012', 'BKN', 'pts', 19.5, -870], ['9800013', 'BKN', 'ast', 5.5, -890]],
          [w3.id]: [['9800021', 'DEN', 'pts', 27.5, -895], ['9800022', 'IND', 'reb', 8.5, -875]], [w4.id]: [['9800031', 'UTA', 'ast', 7.5, -910], ['9800032', 'SAC', 'reb', 10.5, -885]] };
        /* each game's moneylines are posted, far off the model (-5000 against its 60%), so the night has lines and the
           record takes its set, and no side is in the pool */
        const LW = { v: 1, at: atW, games: Object.fromEntries(slW.map(g => [g.id, { at: atW, espn: g.espn, ml: { home: -5000, away: 2000 }, spread: null, total: null, ids: ids(g),
          props: { at: atW, mains: PLW[g.id].map(([pid, , stat, line, under]) => ({ player: pid, stat, line, over: 550, under })), ladders: [], yes: [] } }])) };
        const stW = stateOf(slW, { today: DW, generated: T(DW, '12:00') });
        stW.props.games = Object.fromEntries(slW.map(g => [g.id, { tip: g.tip, away: g.away, home: g.home, players: Object.fromEntries(PLW[g.id].map(([pid, team]) => [pid, rowOf('W' + pid, team)])) }]));
        const tW = T(DW, '15:00:00'), kW = nightKey(slW, DW), legsW = poolW(slW, stW, LW, Date.parse(tW), DW), { best: bW, count: cW } = levelsP(optsP(legsW));
        const UW = uni('deep'), rW = runU(UW, stW, LW, tW), eW = rW.code === 0 ? (readU(UW).night || {})[kW] : null;
        const mineW = t => t && t.legs ? t.legs.map(kOf).sort().join(',') : null;
        chk(!!eW && eW.tiers.every(t => { const b = bW[t.id]; return t.legs ? b && b.ids === mineW(t) && Math.abs(b.p - t.p) < 1e-4 && Math.abs(b.d - t.dec) < 1e-3 : !b; }),
          `W1: the job takes the night of heavy Unders, each level this file's own enumeration's of ${cW} parlays (${eW ? eW.tiers.map(t => `${t.id} ${t.legs ? t.legs.length + ' legs at ' + t.dec : 'none'}`).join(', ') : 'no entry'}): ${rW.last}`);
        const sfW = eW && eW.tiers[0], byG = sfW && sfW.legs ? [...new Set(sfW.legs.map(l => l.id))].map(id => sfW.legs.filter(l => l.id === id).length).sort((a, b) => b - a) : [];
        chk(!!sfW && !!sfW.legs && sfW.legs.length >= 9 && byG[0] >= 4 && byG[1] >= 3, `W1: its Safe is ${sfW && sfW.legs ? sfW.legs.length : 0} legs, a group of ${byG[0] || 0} legs of one game and one of ${byG[1] || 0} among them`);
        /* the leg limit put back where the search takes a parlay: the walk's, and the greedy start's */
        const UW5 = uni('deep_cap5'), cap5 = pageW(UW5, 'hi = hi0 == null ? Infinity : hi0', 'hi = hi0 == null ? 5 : hi0')
          && pageW(UW5, '{ const g = spGreedyAll(X, lv); if (g && spBetter(g, best)) best = g; }', '{ const g = spGreedyAll(X, lv); if (g && g.n <= 5 && spBetter(g, best)) best = g; }'), rW5 = runU(UW5, stW, LW, tW);
        chk(cap5 && rW5.code !== 0 && /empty, and the pool \(this file's own reading of the run's files\) makes a parlay its rule takes/.test(rW5.out) && !fs.existsSync(path.join(UW5, 'ledger.json')),
          `W1: the page with a leg limit of 5 put back leaves its levels empty, and the guard's own groups refuse the run, the ledger not written (${(rW5.out.match(/empty, and the pool[^\n]*/) || [rW5.last])[0].slice(0, 200)})`);
        const UWk = uni('deep_keep'), keepCut = pageW(UWk, 'const opts = [...keep].filter(q => q.T.length > 1 || q.T[0].pid);', 'const opts = [...keep].filter(q => q.T.length > 1);'), rWk = runU(UWk, stW, LW, tW);
        chk(keepCut && rWk.code !== 0 && /\(its pool as kept\)/.test(rWk.out) && !fs.existsSync(path.join(UWk, 'ledger.json')),
          `W2: the page that keeps the record's pool without its single player legs is refused at the take, not first at the lock (${(rWk.out.match(/[^\n]*\(its pool as kept\)[^\n]*/) || [rWk.last])[0].slice(0, 200)})`); }

      /* W3: a set taken under the old rule (its heads Safe 2 to 2 legs with no floor, Medium and Aggressive 2 to 5), holding a
         player listed Out between its lock and its first tip-off: his level is built again under the rule the set was
         taken under, its heads kept, and the guard passes it. The night is X's, whose levels are the old rule's too (Safe
         its likeliest pair, every level of 5 legs or fewer), so the set the page takes now, its heads put back and its time
         taken moved before NOCAP_FROM, stands for one the page took before the change */
      { const UO = uni('oldrebuild'), DX = addDay(D0, 20), DX1 = addDay(DX, 1);
        const x1 = mk(DX, 'WAS', 'OKC', T(DX1, '00:00'), [], { pHome: 0.58, spread: -8, total: 228 }), x2 = mk(DX, 'BKN', 'ATL', T(DX1, '00:30'), [], { pHome: 0.605, spread: -6, total: 230 }), slX = [x1, x2];
        const LXat = T(DX, '14:00:00'), LX = { v: 1, at: LXat, games: { [x1.id]: { ...lineOf(x1, { at: LXat }), ml: { home: -150, away: 130 }, props: { at: LXat, mains: [{ player: '9700001', stat: 'pts', line: 18.5, over: 125, under: -150 }], ladders: [], yes: [] } },
          [x2.id]: { ...lineOf(x2, { at: LXat }), ml: { home: -133, away: 115 }, props: null } } };
        const stO = o => { const st = stateOf(slX, { today: DX, generated: T(DX, '12:00'), ...o }); st.props.games = { [x1.id]: { tip: x1.tip, away: x1.away, home: x1.home, players: { 9700001: rowOf('Xa Wiz', 'WAS') } } }; return st; };
        const kX = nightKey(slX, DX), r0 = runU(UO, stO(), LX, T(DX, '15:00:00')), L0 = r0.code === 0 ? readU(UO) : null, e0 = L0 && L0.night[kX];
        const holds = !!e0 && e0.tiers.some(t => t.legs && t.legs.some(l => l.pid === '9700001'));
        if (e0) { e0.taken_at = '2026-11-08T17:00:00Z'; e0.tiers.forEach((t, i) => { t.max = SC.NIGHT_LEVELS_OLD[i][3]; t.price = SC.NIGHT_LEVELS_OLD[i][4]; delete t.need; delete t.nopl; }); fs.writeFileSync(path.join(UO, 'ledger.json'), JSON.stringify(L0)); }
        const b0 = e0 ? SC.nightEntryBad(kX, e0, Date.parse(T(DX, '21:00:00')), e0, null, null) : ['no set'];
        chk(holds && SC.nightRule(e0) === 'old' && b0.length === 0, `W3: a set of the old heads holding the player (taken 2026-11-08T17:00:00Z) stands under the old rule (${b0.slice(0, 2).join(' | ') || 'no failure'}): ${r0.last}`);
        const rep = { 9700001: ['Xa Wiz', 'Out', 'ankle'] }, r1 = e0 ? runU(UO, stO({ report: rep, generated: T(DX, '22:20') }), LX, T(DX, '22:30:00')) : { code: 1, out: '', last: 'no set' };
        const e1 = r1.code === 0 ? readU(UO).night[kX] : null, hit = e1 ? e1.tiers.filter(t => t.updated) : [];
        chk(!!e1 && /replaced /.test(r1.out) && hit.length > 0 && SC.nightRule(e1) === 'old' && hit.every(t => { const lv = SC.NIGHT_LEVELS_OLD.find(l => l[0] === t.id); return t.max === lv[3] && t.price === lv[4] && (!t.legs || (t.legs.every(l => l.pid !== '9700001') && t.legs.length <= lv[3])); }),
          `W3: listed Out after the lock, his levels are built again under the old rule, their heads kept (${hit.map(t => `${t.id} ${t.min}-${t.max} $${t.price}: ${t.legs ? t.legs.length + ' legs' : t.why}`).join('; ') || 'none'}), and the guard passes the run: ${r1.last}`); }

      /* W4: a same-game table that is not positive definite (the review's planted table: a player's points with his mate's
         rebounds 0.6, an opponent's assists with his points 0.6 and with the mate's rebounds -0.6), where the builder
         shrinks a group's correlations toward 0 and three legs of one game land oftener than two of them at the table's
         own correlation. Medium is the three Unders with the other game's moneyline (an enumeration of every parlay on
         the builder's own sums gives it: tools/test_suggest_speed.js holds the page's search to that), and the guard passes
         the kept group of three, its cap two of its legs at max(rho, 0) on such a game, where the table's own -0.6 would
         refuse it */
      { const DS = addDay(D0, 25), DS1 = addDay(DS, 1), atS = T(DS, '13:00:00');
        const s1 = mk(DS, 'GSW', 'LAL', T(DS1, '03:00'), [], { pHome: 0.5 }), s2 = mk(DS, 'SAS', 'MEM', T(DS1, '01:00'), [], { pHome: 0.56 }), slS = [s1, s2];
        const LS = { v: 1, at: atS, games: { [s1.id]: { at: atS, espn: s1.espn, ml: null, spread: null, total: null, ids: ids(s1),
          props: { at: atS, mains: [{ player: '9900001', stat: 'pts', line: 20.5, over: 1400, under: -1900 }, { player: '9900002', stat: 'reb', line: 6.5, over: 125, under: -150 }, { player: '9900003', stat: 'ast', line: 5.5, over: 125, under: -150 }], ladders: [], yes: [] } },
          [s2.id]: { at: atS, espn: s2.espn, ml: { home: -108, away: -112 }, spread: null, total: null, ids: ids(s2), props: null } } };
        const stS = stateOf(slS, { today: DS, generated: T(DS, '12:00') });
        stS.corr = { ...stS.corr, rho: { ...stS.corr.rho, 'mate|pts|reb': 0.6, 'opp|ast|pts': 0.6, 'opp|ast|reb': -0.6 } };
        stS.props.games = { [s1.id]: { tip: s1.tip, away: s1.away, home: s1.home, players: { 9900001: rowOf('Sa One', 'LAL'), 9900002: rowOf('Sb Two', 'LAL'), 9900003: rowOf('Sc Three', 'GSW') } } };
        const tS = T(DS, '15:00:00'), kS = nightKey(slS, DS), US = uni('shrink'), rS = runU(US, stS, LS, tS), eS = rS.code === 0 ? (readU(US).night || {})[kS] : null;
        const want = ['9900001', '9900002', '9900003'], md = eS && eS.tiers[1];
        chk(!!md && !!md.legs && want.every(pid => md.legs.some(l => l.pid === pid)) && md.legs.some(l => l.id === s2.id && l.kind === 'ml'),
          `W4: on a game whose table is not positive definite Medium is its three Unders with the Grizzlies to win (${md ? (md.legs ? md.legs.map(l => l.pid || l.kind).join(' + ') + ' at ' + md.p + ', ' + md.dec : md.why) : 'no entry'}), and the guard passes it: ${rS.last}`);
        const set3 = eS && eS.pool.sets.find(x => x.length === 5 && x.slice(0, 3).every(i => /\|prop\|99000/.test(eS.pool.legs[i][0])));
        chk(!!set3 && set3[3] > CJ.joint2(imp(-150), imp(-150), -0.6) + 1e-3, `W4: the record keeps the group of three at ${set3 ? set3[3] : '-'}, oftener than two of its legs at the table's own -0.6 (${CJ.joint2(imp(-150), imp(-150), -0.6).toFixed(5)})`); }
    } }

  console.log('Y. the rule with a player (the owner\'s call of 10 November 2026)');
  /* Each level holds at least one player leg wherever the night's legs make such a parlay; where they make none, the
     likeliest without one, saying why (nopl). Held here on made-up nights of this file's own, every level against this
     file's own enumeration with the rule's word (levelsP: every parlay by brute force, the likeliest holding a player
     where any meets the level, else the likeliest of all), never the page's search:
       Y1 three games, two heavy home favourites and a third with the night's player lines, Unders at -160 and -150: the
          rule before (the likeliest of all) is team legs alone on a level, and the rule's holds a player; the kept pool
          makes every level again by the guard's own enumeration with the rule's word, and the guard refuses a level whose
          player leg is taken off (holding none where the pool makes a parlay holding one), a why on a level holding a
          player, and a why that is not its pool's; Y1b a page with the rule's word dropped refused by the guard;
       Y2 the same night with no player line posted: every level the likeliest of all (never empty for want of a player),
          saying "lines"; Y2b the player lines posted and both players listed Out: "fit";
       Y3 a one-game night with player lines: every level a group of that game's legs holding a player;
       Y4 the cutoff: the real record's sets of the rule before (no player leg asked of a level) held as the guard holds
          them, one the page before the change took after PLAYER_FROM (the job's runs from 18:47 UTC on 10 November 2026)
          refused with no file to hold it to and kept where the file holds it so; one taken before it re-dated after
          PLAYER_FROM refused, and kept where the file it is held to holds it so, taken at the same time;
       Y5 after the lock, the player every level holds listed Out (W3's night, where the rule before's levels are the rule's):
          on a set of the rule with a player its levels built again under it (their heads kept, the why where none is
          left), and on the same set of the rule before (heads without need, taken before PLAYER_FROM) under the rule
          before; the guard passes each, and each level built again is this file's own enumeration's;
       Y6 a night of ten games with game lines and no player line: every level "lines", the job and the guard each within
          a time bound (below). */
  { const rowY = (name, team) => [name, team, 'G', 33, 21, 6, 5, 2, 1, 0.5, 0.1, 0.01];
    const DY = addDay(D0, 26), DY1 = addDay(DY, 1), atY = T(DY, '14:00:00'), tY = T(DY, '15:00:00');
    const y1 = mk(DY, 'CHA', 'BOS', T(DY1, '00:00'), [], { pHome: 0.86, spread: -11, total: 224 }), y2 = mk(DY, 'WAS', 'MIL', T(DY1, '00:30'), [], { pHome: 0.84, spread: -10, total: 228 });
    const y3 = mk(DY, 'UTA', 'DEN', T(DY1, '02:00'), [], { pHome: 0.62, spread: -4, total: 232 }), slY = [y1, y2, y3], kY = nightKey(slY, DY);
    const rowsY = { 9800001: rowY('Ya Guard', 'DEN'), 9800002: rowY('Yb Wing', 'UTA') };
    const mainsY = [{ player: '9800001', stat: 'pts', line: 20.5, over: 130, under: -160 }, { player: '9800002', stat: 'reb', line: 7.5, over: 120, under: -150 }];
    const stY = (o = {}, sl = slY, g3 = y3, rows = rowsY) => { const st = stateOf(sl, { today: DY, generated: T(DY, '12:00'), ...o }); st.props.games = { [g3.id]: { tip: g3.tip, away: g3.away, home: g3.home, players: clone(rows) } }; return st; };
    const linesY = (mains, sl = slY, g3 = y3) => ({ v: 1, at: atY, games: Object.fromEntries(sl.map(g => [g.id, { ...lineOf(g, { at: atY }), props: g.id === g3.id && mains ? { at: atY, mains: clone(mains), ladders: [], yes: [] } : null }])) });
    const hasPl = t => !!t.legs && t.legs.some(l => l.kind === 'prop');

    /* Y1 */
    const UY = uni('player1'), LY = linesY(mainsY), r1 = runU(UY, stY(), LY, tY), e1 = r1.code === 0 ? (readU(UY).night || {})[kY] : null;
    chk(!!e1 && e1.tiers.every(t => t.need === 'player'), `Y1: the night is taken on the rule with a player, every level's head saying so: ${r1.last}`);
    if (e1) {
      const M = levelsMatch('Y1', e1, slY, LY, Date.parse(tY), stY());
      chk(e1.tiers.every(hasPl), `Y1: every level holds a player leg (${e1.tiers.map(t => `${t.id} ${t.legs ? t.legs.map(l => l.kind === 'prop' ? 'p' : 't').join('') : 'none'}`).join(', ')})`);
      const moved = LV.filter(([id]) => M.R.raw[id] && !M.R.raw[id].hp);
      chk(moved.length > 0 && moved.every(([id]) => M.R.pl[id] && M.R.pl[id].p < M.R.raw[id].p),
        `Y1: by this file's own enumeration the rule before takes team legs alone on a level, the rule with a player a less likely parlay holding one (${moved.map(([id]) => `${id} ${(M.R.raw[id].p * 100).toFixed(2)}% to ${(M.R.pl[id].p * 100).toFixed(2)}%`).join('; ') || 'none moved'})`);
      const kp = SC.nightPool(e1);
      chk(!!kp && SC.NIGHT_LEVELS.every((lv, i) => { const t = e1.tiers[i], b = SC.nightBest(kp, lv, null, true); return t.legs && b && b.ids === t.legs.map(legKey).sort().join(','); }),
        "Y1: the pool the record keeps makes every level again by the guard's own enumeration with the rule's word");
      const now = Date.parse(tY) + 60e3, st = stY(), bad0 = SC.nightEntryBad(kY, e1, now, null, st, LY);
      chk(bad0.length === 0, `Y1: the guard, on its own reading of the run's files, passes the set (${bad0.slice(0, 2).join(' | ') || 'no failure'})`);
      /* the guard's breaks: a level with its player leg taken off (and saying why), a why on a level holding a player, a
         why that is not its pool's */
      const i0 = e1.tiers.findIndex(t => t.legs && t.legs.length >= 3) >= 0 ? e1.tiers.findIndex(t => t.legs && t.legs.length >= 3) : 1;
      { const e = clone(e1), t = e.tiers[i0]; t.legs = t.legs.filter(l => l.kind !== 'prop'); t.nopl = 'fit';
        const b = SC.nightEntryBad(kY, e, now, null, null, null);
        chk(b.some(x => /holds no player leg, and the pool makes a parlay holding one that its rule takes/.test(x)), `Y1: the guard refuses a level with its player leg taken off, where the pool makes a parlay holding one (${b.find(x => /holds no player/.test(x)) || b.slice(0, 2).join(' | ')})`); }
      { const e = clone(e1); e.tiers[0].nopl = 'lines'; const b = SC.nightEntryBad(kY, e, now, null, null, null);
        chk(b.some(x => /says why it holds no player leg/.test(x)), `Y1: the guard refuses a why on a level holding a player (${b[0] || 'not refused'})`); }
      { const e = clone(e1); e.tiers.forEach(t => { delete t.need; }); const b = SC.nightEntryBad(kY, e, now, null, null, null);
        chk(b.some(x => /with no player leg asked of a level, a rule the record has not taken since/.test(x)) && SC.nightRule(e) === 'nocap', `Y1: the same set under the heads of the rule before, taken after ${SC.PLAYER_FROM}, is refused (${b.find(x => /no player leg asked/.test(x)) || b[0] || 'not refused'})`); }
    }

    /* Y1b: a page with the rule's word dropped, every level the best of all and saying "no player leg fits" where it
       holds none: the job refuses it, the guard finding on its own reading of the run's files a parlay holding one */
    { const UB = uni('player1b'), page = path.join(UB, 'index.html'), was = fs.readFileSync(page, 'utf8');
      const from = "  if (lv[5] !== 'player' || !r0 || r0.legs.some(l => l.kind === 'prop')) return { r: r0, nopl: null };";
      if (was.split(from).length === 2) {
        fs.writeFileSync(page, was.replace(from, "  if (true) return { r: r0, nopl: r0 && !r0.legs.some(l => l.kind === 'prop') ? 'fit' : null };"));
        const rb = runU(UB, stY(), LY, tY);
        chk(rb.code === 1 && /holds no player leg, and the pool[^\n]* makes a parlay holding one that its rule takes/.test(rb.out) && !readU(UB),
          `Y1b: a page with the rule's word dropped (every level the best of all, "no player leg fits" where it holds none) is refused by the guard's own reading, nothing written: ${(rb.out.match(/[^\n]*holds no player leg, and the pool[^\n]*/) || [rb.last])[0].slice(0, 220)}`);
      } else chk(false, "Y1b: the built page's spRule sets its word exactly once"); }

    /* Y2: no player line posted; Y2b: posted, both players listed Out */
    for (const [tag, mains, rep, want] of [['Y2', null, {}, 'lines'], ['Y2b', mainsY, { 9800001: ['Ya Guard', 'Out', 'knee'], 9800002: ['Yb Wing', 'Out', 'ankle'] }, 'fit']]) {
      const U2 = uni('player' + tag), L2 = linesY(mains), st2 = stY({ report: rep }), r2 = runU(U2, st2, L2, tY), e2 = r2.code === 0 ? (readU(U2).night || {})[kY] : null;
      chk(!!e2 && e2.tiers.every(t => t.legs && !hasPl(t) && t.nopl === want && t.need === 'player'),
        `${tag}: ${want === 'lines' ? 'no player line posted' : 'both players listed Out'}: every level the likeliest without one, never empty for want of a player, saying why ("${want}"): ${e2 ? e2.tiers.map(t => `${t.id} ${t.legs ? t.legs.length + ' legs ' + (t.nopl || '') : t.why}`).join(', ') : r2.last}`);
      if (e2) { levelsMatch(tag, e2, slY, L2, Date.parse(tY), st2);
        const b = SC.nightEntryBad(kY, e2, Date.parse(tY) + 60e3, null, st2, L2);
        chk(b.length === 0, `${tag}: the guard passes it on its own reading (${b.slice(0, 2).join(' | ') || 'no failure'})`);
        const e = clone(e2); e.tiers[0].nopl = want === 'lines' ? 'fit' : 'lines'; const b2 = SC.nightEntryBad(kY, e, Date.parse(tY) + 60e3, null, null, null);
        chk(b2.some(x => /where its pool's counts say/.test(x)), `${tag}: the guard refuses a why that is not its pool's (${b2[0] || 'not refused'})`); }
    }

    /* Y3: a one-game night with player lines: each level a group of its legs holding a player */
    { const DZ = addDay(D0, 28), DZ1 = addDay(DZ, 1), z1 = mk(DZ, 'UTA', 'DEN', T(DZ1, '02:00'), [], { pHome: 0.62, spread: -4, total: 232 }), slZ = [z1], kZ = nightKey(slZ, DZ);
      const atZ = T(DZ, '14:00:00'), tZ = T(DZ, '15:00:00'), LZ = { v: 1, at: atZ, games: { [z1.id]: { ...lineOf(z1, { at: atZ }), props: { at: atZ, mains: clone(mainsY), ladders: [], yes: [] } } } };
      const stZ = (() => { const st = stateOf(slZ, { today: DZ, generated: T(DZ, '12:00') }); st.props.games = { [z1.id]: { tip: z1.tip, away: z1.away, home: z1.home, players: clone(rowsY) } }; return st; })();
      const UZ = uni('player3'), rZ = runU(UZ, stZ, LZ, tZ), eZ = rZ.code === 0 ? (readU(UZ).night || {})[kZ] : null;
      chk(!!eZ && eZ.tiers.filter(t => t.legs).length >= 1 && eZ.tiers.every(t => !t.legs || (hasPl(t) && t.legs.length >= 2 && t.legs.every(l => l.id === z1.id))),
        `Y3: a one-game night: every level built is a group of that game's legs holding a player (${eZ ? eZ.tiers.map(t => `${t.id} ${t.legs ? t.legs.map(l => l.kind === 'prop' ? 'p' : l.kind).join('+') : t.why}`).join(', ') : rZ.last})`);
      if (eZ) { levelsMatch('Y3', eZ, slZ, LZ, Date.parse(tZ), stZ); const b = SC.nightEntryBad(kZ, eZ, Date.parse(tZ) + 60e3, null, stZ, LZ);
        chk(b.length === 0, `Y3: the guard passes it on its own reading (${b.slice(0, 2).join(' | ') || 'no failure'})`); } }

    /* Y4: the cutoff, on the real record's sets of the rule before (no player leg asked) */
    { const RL = fs.existsSync(path.join(ROOT, SC.LEDGER_REL)) ? JSON.parse(fs.readFileSync(path.join(ROOT, SC.LEDGER_REL), 'utf8')) : null;
      const nocap = RL && RL.night ? Object.entries(RL.night).filter(([, e]) => SC.nightRule(e) === 'nocap') : [];
      const held = ([k, e], pe) => SC.nightEntryBad(k, e, e.grade ? Date.parse(e.last) + 86400e3 : Date.parse(e.taken_at) + 60e3, pe, null, null);
      chk(nocap.every(([k, e]) => Date.parse(e.taken_at) < Date.parse(SC.PLAYER_FROM) || SC.nocapOk(e, e)) && nocap.every(x => held(x, x[1]).length === 0),
        `Y4: every set of the rule before in the real record is held as the guard holds it and passes that rule's checks (${nocap.map(([k, e]) => `${k.split('|')[1]} taken ${e.taken_at}`).join(', ') || 'none'})`);
      /* a set of the rule before the record took after PLAYER_FROM (the page before the change, run by the job before it
         merged: tonight's of 10 November 2026, taken so from 18:47 UTC) is refused with no file to hold it to; it stands only
         as the file it is held to holds it, which the check above held */
      const lateR = nocap.filter(([, e]) => Date.parse(e.taken_at) >= Date.parse(SC.PLAYER_FROM));
      chk(lateR.every(([k, e]) => SC.nightEntryBad(k, e, Date.parse(e.taken_at) + 60e3, null, null, null).some(x => /no player leg asked of a level, a rule the record has not taken since/.test(x))),
        `Y4: every set of the rule before the real record took after ${SC.PLAYER_FROM} is refused with no file to hold it to (${lateR.map(([k, e]) => `${k.split('|')[1]} taken ${e.taken_at}`).join(', ') || 'none'})`);
      const before = nocap.filter(([, e]) => Date.parse(e.taken_at) < Date.parse(SC.PLAYER_FROM));
      const x0 = before.find(([, e]) => !e.grade) || before[before.length - 1];
      if (x0) { const [k, e0] = x0, late = new Date(Date.parse(SC.PLAYER_FROM) + 60e3).toISOString().replace(/\.\d{3}Z$/, 'Z'), e = { ...clone(e0), taken_at: late };
        const now = Math.min(Date.parse(late) + 1000, Date.parse(e.tip) - LOCK - 1000), b1 = SC.nightEntryBad(k, e, now, null, null, null), b2 = SC.nightEntryBad(k, e, now, clone(e), null, null);
        const b0 = SC.nightEntryBad(k, e0, Date.parse(e0.taken_at) + 60e3, null, null, null);
        chk(Date.parse(e0.taken_at) < Date.parse(SC.PLAYER_FROM) && !b0.some(x => /no player leg asked/.test(x)), `Y4: the same set as it was taken (${e0.taken_at}, before ${SC.PLAYER_FROM}) stands under the rule before with no file to hold it to (${b0.find(x => /no player leg asked/.test(x)) || 'not refused'})`);
        chk(b1.some(x => /with no player leg asked of a level, a rule the record has not taken since/.test(x)) && !b2.some(x => /no player leg asked/.test(x)),
          `Y4: a set of the rule before taken after ${SC.PLAYER_FROM} is refused (${b1.find(x => /no player leg asked/.test(x)) || 'not refused'}), and kept where the file it is held to holds it so, taken at the same time`);
        const e3 = clone(e0); e3.tiers.forEach(t => { t.need = 'player'; });
        chk(SC.nightRule(e3) === 'player' && SC.nightEntryBad(k, e3, Date.parse(e0.taken_at) + 60e3, null, null, null).some(x => /holds no player leg and says no why|holds no player leg, and the pool/.test(x)),
          'Y4: the same set under the heads of the rule with a player is held to it: a level of team legs alone saying no why is refused');
      } else chk(false, 'Y4: (no set of the rule before in the real record)');
    }

    /* Y5: after the lock, a player of the levels listed Out, under each rule */
    { const DV = addDay(D0, 30), DV1 = addDay(DV, 1), v3 = mk(DV, 'WAS', 'OKC', T(DV1, '00:00'), [], { pHome: 0.58, spread: -8, total: 228 }), v1 = mk(DV, 'BKN', 'ATL', T(DV1, '00:30'), [], { pHome: 0.605, spread: -6, total: 230 }), slV = [v3, v1], kV = nightKey(slV, DV);
      const atV = T(DV, '14:00:00'), tV = T(DV, '15:00:00'), mainsV = [{ player: '9800001', stat: 'pts', line: 18.5, over: 125, under: -150 }, { player: '9800002', stat: 'reb', line: 7.5, over: 130, under: -160 }];
      const LV5 = { v: 1, at: atV, games: { [v3.id]: { ...lineOf(v3, { at: atV }), ml: { home: -150, away: 130 }, props: { at: atV, mains: clone(mainsV), ladders: [], yes: [] } }, [v1.id]: { ...lineOf(v1, { at: atV }), ml: { home: -133, away: 115 }, props: null } } };
      const rowsV = { 9800001: rowY('Ya Guard', 'OKC'), 9800002: rowY('Yb Wing', 'WAS') };
      const stV = (o = {}) => { const st = stateOf(slV, { today: DV, generated: T(DV, '12:00'), ...o }); st.props.games = { [v3.id]: { tip: v3.tip, away: v3.away, home: v3.home, players: clone(rowsV) } }; return st; };
      const UA = uni('player5a'), rA = runU(UA, stV(), LV5, tV), LA = rA.code === 0 ? readU(UA) : null, eA = LA && LA.night[kV];
      const holdsYb = t => !!t.legs && t.legs.some(l => String(l.pid) === '9800002');
      const M5 = eA ? levelsMatch('Y5', eA, slV, LV5, Date.parse(tV), stV()) : null;
      chk(!!eA && eA.tiers.every(holdsYb) && LV.every(([id]) => M5.R.raw[id] && M5.R.raw[id].ids === M5.R.best[id].ids), `Y5: every level holds Yb Wing's Under, and every level is the same by the rule with a player and by the rule before (W3's night, a second player beside him): ${eA ? eA.tiers.map(t => t.id + ' ' + (t.legs || []).map(l => l.kind === 'prop' ? l.pid : 't').join('+')).join(', ') : ''} ${rA.last}`);
      if (eA) {
        /* the same set of the rule before (heads without need, taken before PLAYER_FROM), in a universe of its own */
        const UB = uni('player5b'), LB = clone(LA), eB = LB.night[kV]; eB.taken_at = new Date(Date.parse(SC.PLAYER_FROM) - 3600e3).toISOString().replace(/\.\d{3}Z$/, 'Z');
        eB.tiers.forEach(t => { delete t.need; delete t.nopl; }); fs.writeFileSync(path.join(UB, 'ledger.json'), JSON.stringify(LB)); fs.writeFileSync(path.join(UB, 'lines.json'), JSON.stringify(LV5));
        const bB = SC.nightEntryBad(kV, eB, Date.parse(tV) + 60e3, eB, null, null);
        chk(SC.nightRule(eB) === 'nocap' && bB.length === 0, `Y5: the same set of the rule before, taken before ${SC.PLAYER_FROM}, stands under it (${bB.slice(0, 2).join(' | ') || 'no failure'})`);
        const rep = { 9800002: ['Yb Wing', 'Out', 'ankle'] }, tR = isoS(Date.parse(v1.tip) - LOCK + 30 * 60e3), stR = stV({ report: rep, generated: T(DV, '22:20') });
        for (const [tag, U, rule] of [['Y5a', UA, 'player'], ['Y5b', UB, 'nocap']]) {
          const rr = runU(U, stR, LV5, tR), e = rr.code === 0 ? readU(U).night[kV] : null, hit = e ? e.tiers.filter(t => t.updated) : [];
          chk(!!e && /replaced /.test(rr.out) && hit.length === 3 && SC.nightRule(e) === rule && hit.every(t => !holdsYb(t) && (rule === 'player' ? t.need === 'player' : t.need === undefined && t.nopl === undefined)),
            `${tag}: listed Out after the lock, every level holding him is built again under the rule its set was taken under (${rule}), its heads kept (${hit.map(t => `${t.id} ${t.legs ? t.legs.map(l => l.kind === 'prop' ? 'p' : 't').join('') + (t.nopl ? ' ' + t.nopl : '') : t.why}`).join('; ') || 'none'}): ${rr.last}`);
          /* each level built again, against this file's own enumeration on the lines at hand with him held out: with a
             player wherever one makes the level (Yb Wing's Under) on the rule with a player, the likeliest of all on the
             rule before */
          if (e) { const legs = [...poolOwn(slV, LV5, Date.parse(tR), DV), ...plLegsOwn(stR, LV5, Date.parse(tR), DV)].sort((a, b) => a.sk < b.sk ? -1 : 1), R = levelsP(optsP(legs), noplOwn(stR, LV5, Date.parse(tR), DV));
            for (const t of hit) { const b = rule === 'player' ? R.best[t.id] : R.raw[t.id], mine = t.legs ? t.legs.map(legKey).sort().join(',') : null;
              chk(!!b && b.ids === mine && (rule !== 'player' || (t.nopl || null) === b.nopl), `${tag} ${t.id}: built again as this file's own enumeration under its rule (${b ? b.ids + ' ' + (b.p * 100).toFixed(2) + '%' : 'none'}; the level ${mine})`); } }
        }
      }
    }

    /* Y6 (the review of 10 November 2026): a night of ten games with DraftKings' game lines and no player line, as the
       read a day ahead has them. Every level is the "lines" fallback, and the job and the guard each finish within their
       time: the guard's walk for a parlay holding a player, with no best yet and no player option on the night, listed
       every parlay of the night (about 1e10 on ten games, hours) before it let a branch go where no later game has one.
       Held through the job (whose own check runs the guard) and suggest_check.js, each under a time bound, and in this
       process each of the guard's calls on the kept pool timed */
    { const DQ = addDay(D0, 32), DQ1 = addDay(DQ, 1), atQ = T(DQ, '14:00:00'), tQ = T(DQ, '15:00:00');
      const TQ = [['BOS', 'NYK', 0.66, -5, 226], ['LAL', 'GSW', 0.45, 2, 231], ['MIA', 'ORL', 0.6, -4, 220], ['ATL', 'CHA', 0.55, -2, 230], ['DEN', 'PHX', 0.4, 3, 233],
        ['CHI', 'DET', 0.7, -7, 222], ['MIL', 'TOR', 0.35, 4, 228], ['SAC', 'UTA', 0.8, -9, 229], ['DAL', 'SAS', 0.52, -1, 225], ['NOP', 'MEM', 0.62, -4, 224]];
      const TIPQ = [T(DQ, '23:30'), T(DQ, '23:30'), T(DQ1, '00:00'), T(DQ1, '00:00'), T(DQ1, '00:30'), T(DQ1, '01:00'), T(DQ1, '01:00'), T(DQ1, '02:00'), T(DQ1, '02:30'), T(DQ1, '03:00')];
      const slQ = TQ.map(([a, h, pH, sp, tot], i) => mk(DQ, a, h, TIPQ[i], [], { pHome: pH, spread: sp, total: tot })), kQ = nightKey(slQ, DQ);
      const LQ = { v: 1, at: atQ, games: Object.fromEntries(slQ.map(g => [g.id, lineOf(g, { at: atQ })])) }, stQ = stateOf(slQ, { today: DQ, generated: T(DQ, '12:00') });
      const UQ = uni('player6'), BOUND = 120e3; fs.writeFileSync(path.join(UQ, 'state.json'), JSON.stringify(stQ)); fs.writeFileSync(path.join(UQ, 'lines.json'), JSON.stringify(LQ));
      const t0 = Date.now(), rq = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', timeout: BOUND, killSignal: 'SIGKILL', env: { ...process.env, SUGGEST_NOW: tQ, SUGGEST_ROOT: UQ, SUGGEST_LEDGER: path.join(UQ, 'ledger.json'), SUGGEST_PREV: 'none' } });
      const sq = Date.now() - t0, outQ = (rq.stdout || '') + (rq.stderr || ''), eQ = rq.status === 0 && readU(UQ) ? (readU(UQ).night || {})[kQ] : null;
      chk(rq.status === 0 && sq < BOUND, `Y6: a night of ten games with game lines and no player line: the job (its own check of the guard included) finishes within ${BOUND / 1e3} s (${(sq / 1e3).toFixed(1)} s, ${rq.status === null ? 'killed at the bound' : 'exit ' + rq.status}): ${outQ.trim().split('\n').pop() || ''}`);
      chk(!!eQ && eQ.games.length === 10 && eQ.tiers.every(t => t.legs && t.legs.length >= 2 && !t.legs.some(l => l.kind === 'prop') && t.need === 'player' && t.nopl === 'lines'),
        `Y6: every level the likeliest without a player, never empty, saying "lines" (${eQ ? eQ.tiers.map(t => `${t.id} ${t.legs ? t.legs.length + ' legs ' + (t.nopl || '') : t.why}`).join(', ') : 'no entry'})`);
      if (eQ) {
        const t1 = Date.now(), cq = cp.spawnSync('node', [CHECK, '--no-prev', '--now', tQ], { encoding: 'utf8', timeout: 60e3, killSignal: 'SIGKILL', env: { ...process.env, SUGGEST_LEDGER: path.join(UQ, 'ledger.json'), SUGGEST_STATE: path.join(UQ, 'state.json'), SUGGEST_LINES: path.join(UQ, 'lines.json') } });
        const cqLast = ((cq.stdout || '') + (cq.stderr || '')).trim().split('\n').pop();
        chk(cq.status === 0 && /^suggest check: 0 failures/.test(cqLast), `Y6: suggest_check.js on it passes within 60 s (${((Date.now() - t1) / 1e3).toFixed(1)} s): ${cqLast}`);
        const kp = SC.nightPool(eQ), opts = kp ? kp.games.map(os => os.length) : [], times = [];
        const fine = !!kp && kp.games.length === 10 && kp.games.every(os => os.every(o => !o.legs.some(l => l.pid))) && SC.NIGHT_LEVELS.every((lv, i) => {
          const s = Date.now(), bp = SC.nightBest(kp, lv, null, true); times.push(Date.now() - s); const b = SC.nightBest(kp, lv), t = eQ.tiers[i];
          return bp === null && !!b && b.ids === t.legs.map(legKey).sort().join(','); });
        chk(fine && times.every(x => x < 5e3), `Y6: on the kept pool (${opts.join(',')} options a game, no player leg), the guard's walk for a parlay holding a player finds none in ${times.join(', ')} ms a level, and each level is the guard's likeliest of all`);
        const bQ = SC.nightEntryBad(kQ, eQ, Date.parse(tQ) + 60e3, null, stQ, LQ);
        chk(bQ.length === 0, `Y6: the guard passes it on its own reading of the run's files (${bQ.slice(0, 2).join(' | ') || 'no failure'})`);
      }
    }
  }

  console.log('R. one ruler (the owner\'s call of 11 November 2026)');
  /* R  the ruler (every set taken from suggest_check.js's RULER_FROM): the cutoff moved before the made-up days (RCUT, the
        page copied with its own moved the same), the job takes each night's set at the default filters with every leg at
        DraftKings' fair chance, and this file holds it on its own: its pool (every team leg at its two prices' fair chance,
        in the band, priced with a margin; the player legs as P reads them), and every level by this file's own enumeration
        of every parlay the night's legs make (each game's legs together by its own copula: optsP), against the rule's four
        properties: (1) it pays its floor; (2) it lands within SPR_TAU (0.5%) of the likeliest parlay that does; (3) no
        parlay of fewer legs paying the floor lands within SPR_TAU - SPR_ETA of that; (4) it lands within SPR_ETA (0.1%) of
        the likeliest of its own size. R1 D1's night of four games and D2's of two; R2 prices moved and again unchanged; R3
        the cutoff both ways (a run before it the rule with a player, after it the ruler; an older rule's set taken after it
        and a ruler's taken before it each refused, unless the file it is held to holds it so; the real record's sets at a
        cutoff after and before its last take); R4 the guard's breaks (a level under its bound by more than TAU_G, a team
        leg at the model's chance, a level not settled, a team leg left out of the pool, the heads of another rule, a leg not
        in the pool, ties among Unders at even prices passing as any of the tied); R5 a level built again after the lock
        under each rule; R6 the pool as kept, holding every level from the lock; R7 a night of one game; R8 a level not settled within the search's work, never taken; R9 the fewest legs, the pair
        of Unders where three land likelier */
  { const RCUT = T(D0, '12:00:00'), TAU = 0.005, ETA = 0.001, SCR = scAt(RCUT), slR = [gG, gC, gA, gB, gP, gE, gD, gF];
    const isMap = x => !!x && typeof x === 'object' && !Array.isArray(x);
    const uniR = (name, cut) => { const U = uni(name); fs.writeFileSync(path.join(U, 'index.html'), pageAt(cut || RCUT)); return U; };
    const runR = (U, st, lines, at, cut, o = {}) => runU(U, st, lines, at, { SUGGEST_RULER_FROM: cut || RCUT, ...o });
    /* gA's players' lines: two short Unders beside P's lines, so the levels can take a player's Under (its chance on the ruler one over its price) */
    const mainsR = [{ player: '9100001', stat: 'stl', line: 1.5, over: 170, under: -230 }, { player: '9100003', stat: 'blk', line: 1.5, over: 180, under: -240 },
      mainOf(9100001, ROWS[gA.id][9100001], 'pts', 24.5, 'over'), mainOf(9100003, ROWS[gA.id][9100003], 'reb', 9.5, 'over')];
    const linesR = (o = {}) => { const L = linesOf(slR.filter(g => g.type !== 'PRE'), o); L.games[gA.id].props = { at: o.at || READ, mains: clone(o.mains || mainsR), ladders: [], yes: [] }; return L; };
    /* this file's own ruler pool: every team leg of the night's games still to tip at its two prices' fair chance (a side of
       a game the model rates, a total of any), priced with a margin, 45% to 97%, with DraftKings' id (every made-up line
       carries ids); the player legs as P reads them (plLegsOwn: the whole margin on the Over) */
    const teamR = (st, lines, now, d) => { const out = [];
      for (const g of toTip(st, d, now)) { const x = lines.games[g.id]; if (!x) continue;
        const add = (kind, s, line, odds, other) => { if (!odds || !other || imp(odds) + imp(other) < 1) return; const p = imp(odds) / (imp(odds) + imp(other)); if (!(p >= 0.45 && p < 0.97)) return;
          out.push({ sk: [g.id, kind, s, line == null ? '' : line].join('|'), gid: g.id, kind, side: s, line, odds, other, p, d: dec(odds), home: g.home, team: kind === 'total' ? '' : s }); };
        if (g.model && x.ml) { add('ml', g.home, null, x.ml.home, x.ml.away); add('ml', g.away, null, x.ml.away, x.ml.home); }
        if (g.model && x.spread) { add('spread', g.home, x.spread.line, x.spread.home, x.spread.away); add('spread', g.away, -x.spread.line, x.spread.away, x.spread.home); }
        if (x.total) { add('total', 'over', x.total.line, x.total.over, x.total.under); add('total', 'under', x.total.line, x.total.under, x.total.over); } }
      return out; };
    const legsR = (st, lines, now, d) => [...teamR(st, lines, now, d), ...plLegsOwn(st, lines, now, d)].sort((a, b) => a.sk < b.sk ? -1 : 1);
    /* every parlay of the night's options (each game nothing or one of its options), the likeliest paying each floor, of
       all and of each size */
    const enumR = G => { const out = { 2: { star: 0, k: {} }, 4: { star: 0, k: {} }, 8: { star: 0, k: {} } }; let count = 0;
      (function go(i, c, d, n) { if (i === G.length) { if (n < 2) return; count++;
          for (const F of [2, 4, 8]) if (d >= F - 1e-9) { const o = out[F]; if (c > o.star) o.star = c; if (!(o.k[n] >= c)) o.k[n] = c; } return; }
        go(i + 1, c, d, n); for (const o of G[i]) go(i + 1, c * o.p, d * o.d, n + o.legs.length); })(0, 1, 1, 0);
      return { out, count }; };
    /* a level's own figures: each game's legs as one of its options */
    const figR = (G, L) => { const by = new Map(); for (const l of L) { const k = legKey(l); const gid = k.split('|')[0]; if (!by.has(gid)) by.set(gid, []); by.get(gid).push(k); }
      let c = 1, d = 1; for (const ks of by.values()) { const o = G.flat().find(x => x.legs.length === ks.length && x.legs.every(l => ks.includes(l.sk))); if (!o) return null; c *= o.p; d *= o.d; } return { c, d }; };
    function rulerMatch(tag, e, st, lines, now) {
      const legs = legsR(st, lines, now, e.date), G = optsP(legs), E = enumR(G), F0 = { safe: 2, med: 4, aggr: 8 };
      chk(e.tiers.every(t => t.chance === 'fair' && t.need === undefined && t.nopl === undefined && t.gap === undefined) && SCR.nightRule(e) === 'fair',
        `${tag}: the ruler's heads (chance fair, no player asked, no why, no gap): ${e.tiers.map(t => `${t.id} ${t.chance} ${t.need}`).join(', ')}`);
      const P = SCR.nightPoolRuler(e.pool), tm = teamR(st, lines, now, e.date), kTm = P ? P.legs.filter(l => !l.pid) : [];
      chk(!!P && kTm.length === tm.length && tm.every(l => kTm.some(k => k.sk === l.sk && k.odds === l.odds && k.other === l.other && Math.abs(k.p - l.p) < 1e-9)),
        `${tag}: its pool keeps every team leg at its two prices' fair chance, this file's own (${kTm.length} kept, ${tm.length} own)`);
      for (const t of e.tiers) { const F = F0[t.id], o = E.out[F];
        if (!t.legs) { chk(!(o.star > 0), `${tag} ${t.id}: empty ("${t.why}"), and this file's own enumeration finds no parlay paying $${F} (${o.star})`); continue; }
        const f = figR(G, t.legs), n = t.legs.length, kStar = o.k[n] || 0;
        chk(!!f && t.legs.every(l => { const q = legs.find(x => x.sk === legKey(l)); return q && Math.abs(q.p - l.p) < 6e-5 && Math.abs(q.p - l.fair) < 6e-5; }),
          `${tag} ${t.id}: every leg at DraftKings' fair chance, this file's own (${t.legs.map(l => `${l.name} ${l.p}`).join(', ')})`);
        if (!f) continue;
        const fewer = Object.keys(o.k).map(Number).filter(k => k < n && o.k[k] >= (1 - TAU + ETA) * o.star * (1 + 2e-4));
        chk(f.d >= F - 1e-6 && f.c >= (1 - TAU) * o.star * (1 - 2e-4) && !fewer.length && f.c >= (1 - ETA) * kStar * (1 - 2e-4) && Math.abs(f.c - t.p) < 2e-4 && Math.abs(f.d - t.dec) < 2e-3,
          `${tag} ${t.id}: by this file's own enumeration of ${E.count} parlays, (1) it pays $${F} (${f.d.toFixed(4)}), (2) within 0.5% of the likeliest (${(f.c * 100).toFixed(3)}% of ${(o.star * 100).toFixed(3)}%), (3) no fewer legs within 0.4% (${fewer.map(k => k + ' legs at ' + (o.k[k] * 100).toFixed(3) + '%').join(', ') || 'none'}), (4) within 0.1% of the likeliest of its ${n} legs (${(kStar * 100).toFixed(3)}%); the entry ${t.p} at ${t.dec}`);
      }
      return { legs, G, E };
    };
    const keyR = d => nightKey(slR, d), stR = (o = {}) => stateOf(slR, o);
    const tR = T(D1, '15:00:00'), LR = linesR();

    /* R1 */
    const UR = uniR('ruler1'), r1 = runR(UR, stR(), LR, tR), L1 = r1.code === 0 ? readU(UR) : null, e1 = L1 && L1.night[keyR(D1)], e2 = L1 && L1.night[keyR(D2)];
    chk(!!e1 && !!e2 && /took /.test(r1.out), `R1: the job takes D1's and D2's sets under the ruler, and the guard passes them: ${r1.last}`);
    if (e1) { rulerMatch('R1 D1', e1, stR(), LR, Date.parse(tR));
      chk(e1.tiers.some(t => t.legs && t.legs.some(l => l.kind === 'prop' && l.side === 'under')), `R1: a level takes a player's Under at its fair chance (${e1.tiers.map(t => t.id + ' ' + (t.legs || []).map(l => l.kind === 'prop' ? l.side : l.kind).join('+')).join(', ')})`);
      const P = SCR.nightPoolRuler(e1.pool), inL = new Set(e1.tiers.flatMap(t => (t.legs || []).map(legKey)));
      chk(!!P && P.legs.filter(l => l.pid).every(l => inL.has(l.sk)) && e1.tiers.every(t => !t.legs || t.legs.every(l => P.legs.some(q => q.sk === legKey(l)))) && e1.pool.pl.cut === plLegsOwn(stR(), LR, Date.parse(tR), D1).length - P.legs.filter(l => l.pid).length,
        `R1: the pool keeps every leg its levels hold, its player legs those alone, the rest counted as cut (${P ? P.legs.length : 0} kept, cut ${e1.pool.pl.cut})`); }
    if (e2) rulerMatch('R1 D2 (two games)', e2, stR(), LR, Date.parse(tR));

    /* R2: prices moved before the lock: rewritten under the ruler; the same again: unchanged */
    if (e1) { const t2 = T(D1, '16:00:00'), L2 = linesR({ mlShift: { [gC.id]: 0.04 } }), r2 = runR(UR, stR(), L2, t2), n2 = readU(UR).night[keyR(D1)];
      chk(r2.code === 0 && n2.taken_at === t2 && SCR.nightRule(n2) === 'fair', `R2: prices moved, D1's set rewritten under the ruler: ${r2.last}`);
      if (r2.code === 0) rulerMatch('R2', n2, stR(), L2, Date.parse(t2));
      const before = fs.readFileSync(path.join(UR, 'ledger.json'), 'utf8'), r3 = runR(UR, stR(), L2, T(D1, '16:30:00'));
      chk(r3.code === 0 && /unchanged/.test(r3.last) && fs.readFileSync(path.join(UR, 'ledger.json'), 'utf8') === before, `R2: the same lines again write nothing: ${r3.last}`); }

    /* R3: the cutoff, both ways */
    { const CL = T(D1, '18:00:00'), U3 = uniR('ruler3', CL), a = runR(U3, stR(), LR, tR, CL), eA = a.code === 0 ? readU(U3).night[keyR(D1)] : null;
      chk(!!eA && SCR.nightRule(eA) === 'player', `R3: a run before the cutoff (${CL}) takes the rule with a player: ${eA ? SCR.nightRule(eA) : a.last}`);
      const tB = T(D1, '19:00:00'), b = runR(U3, stR(), LR, tB, CL), eB = b.code === 0 ? readU(U3).night[keyR(D1)] : null;
      chk(!!eB && SCR.nightRule(eB) === 'fair' && eB.taken_at === tB, `R3: a run after it rewrites the set still to lock under the ruler: ${eB ? SCR.nightRule(eB) + ' ' + eB.taken_at : b.last}`);
      if (eA && eB) {
        const SC1 = scAt(T(D1, '14:00:00')), k = keyR(D1), now = Date.parse(tR) + 60e3;
        const late = SC1.nightEntryBad(k, eA, now, null, null, null), held = SC1.nightEntryBad(k, eA, now, clone(eA), null, null);
        chk(late.some(x => /under a rule before the ruler/.test(x)) && !held.some(x => /under a rule before the ruler/.test(x)),
          `R3: a set of the rule with a player taken after the cutoff is refused (${late.find(x => /ruler/.test(x)) || 'not refused'}), and kept where the file it is held to holds it so, taken at the same time`);
        const SC2 = scAt(T(D1, '20:00:00')), early = SC2.nightEntryBad(k, eB, Date.parse(tB) + 60e3, null, null, null), held2 = SC2.nightEntryBad(k, eB, Date.parse(tB) + 60e3, clone(eB), null, null);
        chk(early.some(x => /under the ruler, before its cutoff/.test(x)) && !held2.some(x => /before its cutoff/.test(x)), `R3: a ruler's set taken before the cutoff is refused (${early.find(x => /cutoff/.test(x)) || 'not refused'}), and kept where the file it is held to holds it so`);
        const old = SCR.nightEntryBad(k, eA, now, null, null, null);
        chk(SCR.nightRule(eA) === 'player' && old.some(x => /under a rule before the ruler/.test(x)), 'R3: under the ruler\'s own cutoff, before it, the same set taken after is refused');
      }
      /* the real record: every set as the file holds it at the real cutoff, and its latest set refused with no file to hold it
         to at a cutoff a minute before it was taken (the job keeps retaking sets under the old page until this lands) */
      const RL = fs.existsSync(path.join(ROOT, SC.LEDGER_REL)) ? JSON.parse(fs.readFileSync(path.join(ROOT, SC.LEDGER_REL), 'utf8')) : null;
      if (RL && RL.night && Object.keys(RL.night).length) {
        const SCreal = scAt(REAL_CUT), tNow = Date.now(), a1 = SCreal.check(RL, RL, tNow, null, REAL.season);
        chk(!a1.length, `R3: the real record at the real cutoff (${REAL_CUT}), held to itself, passes (${a1.slice(0, 2).join(' | ') || 'no failure'})`);
        const [kL, eL] = Object.entries(RL.night).sort((x, y) => Date.parse(x[1].taken_at) - Date.parse(y[1].taken_at)).pop(), cut = isoS(Date.parse(eL.taken_at) - 60e3), SCc = scAt(cut);
        const nowL = Math.min(Date.parse(eL.taken_at) + 60e3, Date.parse(eL.tip) - LOCK - 1000);
        const r1b = SCc.nightEntryBad(kL, eL, nowL, null, null, null), r2b = SCc.nightEntryBad(kL, eL, nowL, clone(eL), null, null);
        const rule = SCc.nightRule(eL);
        chk(rule === 'fair' ? r1b.every(x => !/before its cutoff/.test(x)) : r1b.some(x => /under a rule before the ruler/.test(x)) && !r2b.some(x => /under a rule before the ruler/.test(x)),
          `R3: the real record's latest set (${kL.split('|')[1]}, ${rule}, taken ${eL.taken_at}) at a cutoff a minute before it: ${rule === 'fair' ? 'the ruler\'s, standing' : 'refused with no file to hold it to, kept as the file holds it'}`);
      } else chk(true, 'R3: no night set in the real record (skipped)');
    }

    /* R4: the guard's breaks, on R1's set at its take (this file's reading of the run's files) */
    if (e1) { const k = keyR(D1), now = Date.parse(e1.taken_at) + 60e3, st = stR(), base = SCR.nightEntryBad(k, e1, now, null, st, LR);
      chk(!base.length, `R4: the set as taken passes (${base.slice(0, 2).join(' | ') || 'no failure'})`);
      const bad = (what, f, re) => { const x = clone(e1); f(x); const b = SCR.nightEntryBad(k, x, now, null, st, LR); chk(b.some(y => re.test(y)), `R4: ${what} refused (${b.find(y => re.test(y)) || b[0] || 'not refused'})`); };
      /* a worse valid parlay paying $2 of the kept team legs: two sides of two games, its chance well under the bound */
      const P = SCR.nightPoolRuler(e1.pool), tl = P.legs.filter(l => !l.pid && l.kind === 'ml');
      let worse = null; for (const a of tl) for (const b of tl) if (!worse && a.gid < b.gid && a.d * b.d >= 2 && a.p * b.p < 0.95 * e1.tiers[0].p) worse = [a, b];
      if (worse) bad('a Safe under its bound by more than TAU_G (two moneylines at ' + (worse[0].p * worse[1].p * 100).toFixed(2) + '%)', x => { const t = x.tiers[0];
        t.legs = worse.map(q => { const g = slR.find(y => y.id === q.gid); return { id: q.gid, away: g.away, home: g.home, date: g.date, tip: g.tip, at: READ, kind: 'ml', side: q.s, line: null, odds: q.odds, other: q.other, dk: 'x', name: q.s, label: 'To win', p: +q.p.toFixed(6), fair: +q.p.toFixed(6), fair_est: false, thin: true, market: false }; });
        t.p = +(worse[0].p * worse[1].p).toFixed(4); t.fair = t.p; t.dec = +(worse[0].d * worse[1].d).toFixed(3); }, /under 99% of this file's own bound/);
      else chk(false, 'R4: (no worse pair of moneylines to plant)');
      /* TAU_G itself: the level held to a bound 1.06% over its chance is refused, and to one 0.96% over it passes (the guard
         takes a level within 1% of its own bound) */
      { const x = e1.tiers[0], ids = new Set(e1.games.map(g => g.gid)), lv = SCR.NIGHT_LEVELS_RULER[0], pool = SCR.nightPoolRuler(e1.pool);
        const over = SCR.rulerLevelBad(k, x, lv, pool, ids, x.p * 1.0106, null, null, null, null), under = SCR.rulerLevelBad(k, x, lv, pool, ids, x.p * 1.0096, null, null, null, null);
        chk(SCR.TAU_G === 0.01 && over.some(y => /under 99% of this file's own bound/.test(y)) && !under.length, `R4: the guard takes a level within 1% of its bound (TAU_G ${SCR.TAU_G}): refused at a bound 1.06% over its chance, passed at 0.96% (${over[0] || 'not refused'})`); }
      bad('a team leg kept at the model\'s chance', x => { const i = x.pool.legs.findIndex(l => /\|ml\|/.test(l[0])); x.pool.legs[i][2] = +(x.pool.legs[i][2] + 0.03).toFixed(6); }, /its pool is not the ruler's/);
      bad('a level the search did not settle (a gap)', x => { x.tiers[2].gap = 0.02; }, /did not settle/);
      bad('a team leg left out of the pool', x => { const used = new Set(x.tiers.flatMap(t => (t.legs || []).map(legKey))); const i = x.pool.legs.findIndex(l => !/\|prop\|/.test(l[0]) && !used.has(l[0]));
        x.pool.legs.splice(i, 1); x.pool.sets = x.pool.sets.map(s => s.map((v, j) => j < s.length - 2 && v > i ? v - 1 : v)); }, /leaves out/);
      bad('the heads of the rule with a player', x => { x.tiers.forEach(t => { delete t.chance; t.need = 'player'; }); }, /under a rule before the ruler|not a pool of|neither/);
      bad('a level\'s leg not in its pool', x => { const t = x.tiers.find(y => y.legs); t.legs[0] = { ...t.legs[0], odds: t.legs[0].odds - 7 }; }, /not in its pool/);
      /* ties: two players' Unders at +100, each 50% at its fair chance (a pure leg, returning $1): Medium and Aggressive each
         a tie between them (Medium one with a home moneyline at +104, 24.01% paying $4.08); the page takes either by its
         slip keys, and the guard passes the level with the other in its place */
      const mainsT = [{ player: '9100001', stat: 'reb', line: 3.5, over: -120, under: 100 }, { player: '9100003', stat: 'ast', line: 2.5, over: -120, under: 100 }];
      const LT = linesR({ mains: mainsT }), tT = T(D1, '15:30:00'), UT = uniR('ruler4t'), rT = runR(UT, stR(), LT, tT), eT = rT.code === 0 ? readU(UT).night[keyR(D1)] : null;
      if (eT) { rulerMatch('R4 ties', eT, stR(), LT, Date.parse(tT)); let tied = 0;
        for (const i of [1, 2]) { const t = eT.tiers[i], u = t.legs && t.legs.find(l => l.kind === 'prop' && l.side === 'under' && l.odds === 100); if (!u) continue;
          const m = mainsT.find(q => q.player !== String(u.pid)), row = ROWS[gA.id][m.player], x = clone(eT), tx = x.tiers[i], j = tx.legs.findIndex(l => l.kind === 'prop' && String(l.pid) === String(u.pid));
          tx.legs[j] = { ...u, pid: m.player, name: row[0], team: row[1], stat: m.stat, line: m.line, other: m.over, label: `Under ${m.line}` };
          const sk = legKey(tx.legs[j]); if (!x.pool.legs.some(l => l[0] === sk)) { x.pool.legs.push([sk, 100, 0.5, m.over]); x.pool.pl.cut -= 1; }
          const b = SCR.nightEntryBad(keyR(D1), x, Date.parse(tT) + 60e3, null, stR(), LT); tied++;
          chk(!b.length, `R4: ${t.id} holds ${u.name}'s Under at +100, tied with ${row[0]}'s: the guard passes the level with his in its place (${b.slice(0, 2).join(' | ') || 'no failure'})`); }
        chk(tied === 2, `R4: Medium and Aggressive each hold an Under at +100 tied with the other player's (${eT.tiers.map(t => t.id + ' ' + (t.legs || []).map(l => l.kind === 'prop' ? l.side + ' ' + l.odds : l.kind).join('+')).join(', ')})`); }
      else chk(false, 'R4: the ties night was not taken: ' + rT.last);
    }

    /* R5: a level built again after the lock, under each rule */
    if (e1) { const eNow = readU(UR).night[keyR(D1)], holds = eNow.tiers.find(t => t.legs && t.legs.some(l => l.kind === 'prop')), pl = holds && holds.legs.find(l => l.kind === 'prop');
      if (pl) { const rep = { [pl.pid]: [pl.name, 'Out', 'knee'] }, tL = isoS(Date.parse(gG.tip) - LOCK + 20 * 60e3), U5 = uniR('ruler5');
        fs.writeFileSync(path.join(U5, 'ledger.json'), fs.readFileSync(path.join(UR, 'ledger.json'), 'utf8'));
        const r5 = runR(U5, stR({ report: rep, generated: T(D1, '22:00') }), LR, tL), e5 = r5.code === 0 ? readU(U5).night[keyR(D1)] : null, hit = e5 ? e5.tiers.filter(t => t.updated) : [];
        chk(!!e5 && hit.length >= 1 && hit.every(t => t.chance === 'fair' && t.need === undefined && isMap(t.pool) && t.pool.rule === 'fair' && !(t.legs || []).some(l => String(l.pid) === String(pl.pid))) && e5.updates.length === hit.length,
          `R5: ${pl.name} listed after the lock: each level holding him built again under the ruler, on a ruler's pool of its own, recorded (${hit.map(t => t.id).join(', ')}): ${r5.last}`); }
      else chk(false, 'R5: (no level of R1 holds a player)');
      /* the rule with a player's set, taken before a cutoff that passes before its lock: built again under its own rule */
      const CL = T(D1, '18:00:00'), U6 = uniR('ruler5b', CL), a = runR(U6, stR(), LR, tR, CL), eA = a.code === 0 ? readU(U6).night[keyR(D1)] : null;
      const hp = eA && eA.tiers.find(t => t.legs && t.legs.some(l => l.kind === 'prop')), p2 = hp && hp.legs.find(l => l.kind === 'prop');
      if (p2) { const tL = isoS(Date.parse(gG.tip) - LOCK + 20 * 60e3), r6 = runR(U6, stR({ report: { [p2.pid]: [p2.name, 'Out', 'knee'] }, generated: T(D1, '22:00') }), LR, tL, CL), e6 = r6.code === 0 ? readU(U6).night[keyR(D1)] : null, hit = e6 ? e6.tiers.filter(t => t.updated) : [];
        chk(!!e6 && hit.length >= 1 && SCR.nightRule(e6) === 'player' && hit.every(t => t.need === 'player' && t.chance === undefined && !(t.legs || []).some(l => String(l.pid) === String(p2.pid))),
          `R5: a set of the rule with a player locked after the cutoff passed: the level holding ${p2.name} built again under its own rule (${hit.map(t => t.id + ' ' + t.need).join(', ')}): ${r6.last}`); }
      else chk(false, 'R5: (no level of the rule with a player holds a player: ' + a.last + ')');
    }

    /* R6: the pool as kept, from the lock: every level made again on it, and one whose leg left the pool refused */
    if (e1) { const k = keyR(D1), now = Date.parse(gG.tip) - LOCK + 60e3, L = clone(L1), st = stR(), ok1 = SCR.nightEntryBad(k, L.night[k], now, clone(L.night[k]), st, LR);
      chk(!ok1.length, `R6: after the lock, every level held to its pool as kept (${ok1.slice(0, 2).join(' | ') || 'no failure'})`);
      const x = clone(L.night[k]), t = x.tiers.find(y => y.legs && y.legs.some(l => l.kind === 'prop'));
      if (t) { const sk = legKey(t.legs.find(l => l.kind === 'prop')), i = x.pool.legs.findIndex(l => l[0] === sk); x.pool.legs.splice(i, 1);
        x.pool.sets = x.pool.sets.filter(s => !s.slice(0, -2).includes(i)).map(s => s.map((v, j) => j < s.length - 2 && v > i ? v - 1 : v));
        const b = SCR.nightEntryBad(k, x, now, null, st, LR); chk(b.some(y => /not in its pool/.test(y)), `R6: a level whose player leg left the pool as kept refused (${b.find(y => /pool/.test(y)) || 'not refused'})`); }
    }

    /* R7: a night of one game (D3, gF), under the ruler */
    { const t7 = T(D3, '15:00:00'), st7 = stR({ today: D3, generated: T(D3, '13:00') }), L7 = linesR({ at: T(D3, '14:00:00') }), U7 = uniR('ruler7'), r7 = runR(U7, st7, L7, t7), e7 = r7.code === 0 ? readU(U7).night[keyR(D3)] : null;
      chk(!!e7, `R7: a night of one game taken under the ruler: ${r7.last}`);
      if (e7) rulerMatch('R7 (one game)', e7, st7, L7, Date.parse(t7)); }

    /* R8: a level the search does not settle within its work (cut to nothing here: SUGGEST_RULER_WORK, read by the job for
       this test alone) is never taken: the night gets no set this run, said, and a set an earlier run took stays as it was */
    { const U8 = uniR('ruler8'), r8 = runR(U8, stR(), LR, tR, null, { SUGGEST_RULER_WORK: '1' }), L8 = readU(U8);
      chk(r8.code === 0 && /no set of \S+_NIGHT \([^)]*\) this run: a level not settled within the search's work/.test(r8.out) && (!L8 || !L8.night || !L8.night[keyR(D1)]),
        `R8: with the search's work cut to nothing, no set of the night is taken, said so: ${r8.code === 0 ? r8.last : r8.out.trim().split("\n").slice(-7).join(" | ")}`);
      fs.writeFileSync(path.join(U8, 'ledger.json'), fs.readFileSync(path.join(UR, 'ledger.json'), 'utf8'));
      const was = readU(U8).night[keyR(D2)], r9 = runR(U8, stR(), LR, T(D1, '17:00:00'), null, { SUGGEST_RULER_WORK: '1' }), now9 = readU(U8).night[keyR(D2)];
      chk(r9.code === 0 && !!was && JSON.stringify(now9) === JSON.stringify(was), `R8: and a set an earlier run took stays as it was: ${r9.last}`); }

    /* R9: the fewest legs. D1's night with five players' Unders in three of its games: two at -241 (ATL's and MIA's) land
       49.948% together paying $2.0021, three at -385, -384 and -384 (CHA's, ORL's and LAL's) 49.968% paying $2.0013, so the
       triple is the likeliest parlay paying $2 and the pair is within the rule's half a percent with fewer legs: Safe is
       the pair, by this file's own enumeration (condition 3) */
    { const rowR = (nm, tm) => [nm, tm, 'G', 32, 20, 6, 5, 2, 1, 0.5, 0.1, 0.01];
      const R9 = { [gG.id]: { 9100011: rowR('Al Hawk', 'ATL'), 9100013: rowR('Bo Hornet', 'CHA') }, [gC.id]: { 9100012: rowR('Al Heat', 'MIA'), 9100014: rowR('Bo Magic', 'ORL') }, [gB.id]: { 9100015: rowR('Bo Laker', 'LAL') } };
      const M9 = { [gG.id]: [{ player: '9100011', stat: 'pts', line: 20.5, over: 150, under: -241 }, { player: '9100013', stat: 'reb', line: 9.5, over: 200, under: -385 }],
        [gC.id]: [{ player: '9100012', stat: 'pts', line: 22.5, over: 150, under: -241 }, { player: '9100014', stat: 'reb', line: 7.5, over: 200, under: -384 }], [gB.id]: [{ player: '9100015', stat: 'reb', line: 6.5, over: 200, under: -384 }] };
      const st9 = stR(); st9.props.games = Object.fromEntries([gG, gC, gB].map(g => [g.id, { tip: g.tip, away: g.away, home: g.home, players: clone(R9[g.id]) }]));
      const L9 = linesR(); for (const g of [gG, gC, gA, gB]) L9.games[g.id].props = M9[g.id] ? { at: READ, mains: clone(M9[g.id]), ladders: [], yes: [] } : null;
      const U9 = uniR('ruler9'), r9b = runR(U9, st9, L9, tR), e9 = r9b.code === 0 ? readU(U9).night[keyR(D1)] : null;
      chk(!!e9, `R9: the night of five Unders taken: ${r9b.last}`);
      if (e9) { const M = rulerMatch('R9', e9, st9, L9, Date.parse(tR)), s9 = e9.tiers[0];
        chk(!!s9.legs && s9.legs.length === 2 && s9.legs.every(l => l.kind === 'prop' && l.side === 'under' && l.odds === -241) && M.E.out[2].k[3] > M.E.out[2].k[2],
          `R9: Safe is the two Unders at -241 (${s9.legs ? s9.legs.map(l => l.name).join(' + ') + ', ' + s9.p : s9.why}), the fewest legs, where the triple lands likelier (${(M.E.out[2].k[3] * 100).toFixed(3)}% against ${(M.E.out[2].k[2] * 100).toFixed(3)}%)`); } }
  }

  console.log('G. the real ledger, copied, on the real state, at the real cutoff');
  const realLedger = path.join(ROOT, SC.LEDGER_REL), realLines = path.join(ROOT, 'lines.json');
  if (fs.existsSync(realLines)) {
    const G = path.join(DIR, 'real'); fs.mkdirSync(path.join(G, 'data'), { recursive: true });
    for (const f of ['index.html', 'state.json', 'lines.json']) fs.copyFileSync(path.join(ROOT, f), path.join(G, f));
    for (const f of fs.readdirSync(path.join(ROOT, 'data')).filter(f => /^box_\d{4}\.csv$/.test(f))) fs.copyFileSync(path.join(ROOT, 'data', f), path.join(G, 'data', f));
    const gl = path.join(G, 'ledger.json'); if (fs.existsSync(realLedger)) fs.copyFileSync(realLedger, gl);
    const tG = Date.now(), before = fs.existsSync(gl) ? fs.readFileSync(gl, 'utf8') : null;
    if (before) { const RL = JSON.parse(before), b2 = scAt(REAL_CUT).check(RL, RL, tG, null, REAL.season); chk(!b2.length, `G: the ledger as it stands passes the guard at the real cutoff, ${REAL_CUT} (${b2.slice(0, 2).join(' | ') || 'no failure'})`); }
    const rg = cp.spawnSync('node', [SCRIPT], { encoding: 'utf8', env: { ...process.env, SUGGEST_NOW: new Date(tG).toISOString(), SUGGEST_ROOT: G, SUGGEST_LEDGER: gl, SUGGEST_PREV: fs.existsSync(realLedger) ? realLedger : 'none', SUGGEST_RULER_FROM: REAL_CUT } });
    const last = ((rg.stdout || '') + (rg.stderr || '')).trim().split('\n').pop();
    chk(rg.status === 0 && /^suggest ledger: (written|unchanged)/.test(last), 'G: the state and lines at the real clock: nothing refused: ' + last);
    if (before && rg.status === 0) { const was = JSON.parse(before), now1 = JSON.parse(fs.readFileSync(gl, 'utf8')), lockedAt = e => Date.parse(e.tip) - LOCK <= tG;
      chk(['featured', 'night'].every(m => Object.entries(was[m] || {}).filter(([, e]) => lockedAt(e)).every(([k, e]) => now1[m][k] && JSON.stringify(SC.callOf(now1[m][k])) === JSON.stringify(SC.callOf(e)))), 'G: every locked set of the ledger as it was, but for its grade');
      chk(Object.values(now1.featured).every(e => lockedAt(e)) && Object.values(now1.night || {}).every(e => e.tiers.map(t => t.id).join() === 'safe,med,aggr'), 'G: no per-game set still to lock, and every night set the three levels'); }
  } else chk(true, 'G: no lines.json in this checkout: the real run is skipped');
  end();
})();
