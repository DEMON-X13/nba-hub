/* The props_v3 data inventory: every source on disk, what it holds, how complete and how clean it is, and what the
 * rules allow it for. Research only: it reads files and writes research/props_v3/results/data_inventory.json, nothing
 * else; it asks no server for anything. research/props_v3/data.md is its write-up.
 *
 *   node research/props_v3/data_inventory.js
 *
 * Seasons are named by the year they end (2024 is 2023-24), as data/ names them. Two seasons are read for their shape
 * alone, never for a value a game produced:
 *   - 2023 (2022-23) is the one-shot test's season. Its DraftKings lines are not on disk and are not fetched here; its box
 *     scores and team boxes (the test's outcomes) are read for their header, their row, game and player counts, their
 *     dates, which finals have a box, duplicate rows and starters per side. No minutes, stat, plus-minus or
 *     did-not-play count of it is computed. data/odds_hist.csv's and data/games.csv's 2022-23 rows are counted and their
 *     fields' fill measured; no line, price or score of them is read into any figure.
 *   - 2027 (2026-27) is the season in play: a forward shadow only. Its files are counted the same way (rows, games,
 *     dates), as research/props_v2/data_describe.js counted data/props_2027.csv.
 * For the development seasons (2022, 2024, 2025, 2026) the box scores are also checked for consistency: each side's
 * minutes summed, its points against the final, the plus-minus against the margin, did-not-play rows.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const ROOT = path.join(__dirname, '..', '..');
const DATA = path.join(ROOT, 'data');
const OUT = path.join(__dirname, 'results', 'data_inventory.json');
const TEST = 2023, IN_PLAY = 2027, SHAPE_ONLY = new Set([TEST, IN_PLAY]);
const BOX_SEASONS = [2022, 2023, 2024, 2025, 2026, 2027];

const rel = f => path.relative(ROOT, f);
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
const fileInfo = f => ({ file: rel(f), bytes: fs.statSync(f).size, sha256: sha(f) });
const readCsv = f => {
  const t = fs.readFileSync(f, 'utf8').split('\n').map(l => l.replace(/\r$/, '')).filter(l => l.length);   // raptor.csv ends its lines \r\n
  const h = t.shift().split(',');
  const rows = [], bad = [];
  t.forEach((l, i) => { const v = l.split(','); if (v.length === h.length) rows.push(v); else bad.push(i + 2); });
  return { h, rows, badLines: bad.length };
};
const col = (h, n) => { const i = h.indexOf(n); if (i < 0) throw new Error(`no column ${n}`); return i; };
const median = a => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)]; };
const quant = (a, q) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(q * s.length))]; };
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const share = (n, d) => d ? r4(n / d) : null;
const count = (xs, f) => { const m = {}; for (const x of xs) { const k = f(x); m[k] = (m[k] || 0) + 1; } return m; };
const range = xs => xs.length ? [xs.reduce((a, b) => a < b ? a : b), xs.reduce((a, b) => a > b ? a : b)] : null;
const exists = f => fs.existsSync(f);

/* the rules, in the words data.md uses */
const USE = {
  dev: 'development: may be read to fit, tune and choose a candidate',
  devHistory: 'development history: may be read to fit, tune and choose a candidate (seasons before the hub\'s box scores)',
  testSeason: 'the test season (2022-23): its DraftKings lines are the one-shot test, fetched and read only by the Test step after the preregistration is committed, pushed and audited; its box scores, team boxes and game lines are the history a frozen candidate reads before each test game and the outcomes the Test step grades, and nothing is fitted, re-scaled or chosen on them; they were read by earlier fits (tools/props.js\'s live constants, fitted on 2023-2026; its 2024 fold, fitted on 2023; props_v2 candidate A\'s folds; the game models), which the preregistration lists',
  testLines: 'the one-shot test: never fetched, read or printed before the preregistration is committed, pushed and audited sound; the Test step alone fetches them',
  devScored: 'development data for a new candidate: DraftKings\' 2023-24 lines were scored once, against props_v2 candidate A on 6 November 2026 (FAIL), so they are no test for anything',
  spent: 'spent: development only, never a test (scored against tools/props.js and props_v2\'s A, B and C)',
  forward: 'the season in play (2026-27): a forward shadow only, from a frozen candidate\'s freeze time on; never used to fit, tune, choose or score a candidate',
  forwardToday: 'today\'s state (2026-27): a forward shadow\'s live input only; never used to fit, tune, choose or score a candidate',
  none: 'not a props modelling source',
};
const seasonUse = s => s === TEST ? 'testSeason' : s === IN_PLAY ? 'forward' : 'dev';

/* ---------- data/games.csv ---------- */
const G = readCsv(path.join(DATA, 'games.csv'));
const gi = n => col(G.h, n);
const games = G.rows.map(v => ({ id: v[gi('game_id')], season: +v[gi('season')], date: v[gi('date')], type: v[gi('type')], away: v[gi('away')], home: v[gi('home')],
  as: v[gi('away_score')], hs: v[gi('home_score')], neutral: v[gi('neutral')], status: v[gi('status')], line: v[gi('home_line')], total: v[gi('total')],
  source: v[gi('source')], espn: v[gi('espn_id')], tip: v[gi('tip')], hml: v[gi('home_ml')], aml: v[gi('away_ml')], tv: v[gi('tv')] }));
const gameOf = new Map(games.map(g => [g.id, g]));
const bySeason = {};
for (const g of games) (bySeason[g.season] = bySeason[g.season] || []).push(g);
const gamesInv = { ...fileInfo(path.join(DATA, 'games.csv')), columns: G.h, rows: G.rows.length, badLines: G.badLines, seasons: {} };
for (const s of Object.keys(bySeason).map(Number).sort((a, b) => a - b)) {
  const xs = bySeason[s];
  const reg = xs.filter(g => g.type === 'REG'), post = xs.filter(g => g.type === 'POST');
  gamesInv.seasons[s] = { use: seasonUse(s), games: xs.length, byType: count(xs, g => g.type), byStatus: count(xs, g => g.status), bySource: count(xs, g => g.source),
    regDates: range(reg.map(g => g.date)), postDates: range(post.map(g => g.date)), neutral: xs.filter(g => g.neutral === '1').length,
    withEspnId: xs.filter(g => g.espn).length, withTip: xs.filter(g => g.tip).length, withLine: xs.filter(g => g.line).length,
    withTotal: xs.filter(g => g.total).length, withMoneylines: xs.filter(g => g.hml && g.aml).length, withTv: xs.filter(g => g.tv).length };
}
gamesInv.note = 'Every game since 2004-05 (2005 to 2021 from Neil Paine\'s continuation of FiveThirtyEight\'s game file, ESPN\'s scoreboard since). ESPN ids from 2021-22 on only, so a fetch of an older season\'s box scores finds each game\'s id on ESPN\'s scoreboard for its date (tools/fetch_box.js does). Game lines, totals, moneylines and tip times are the job\'s, from 2026-27 on only; for 2022-23 to 2025-26 the game lines are data/odds_hist.csv\'s, and the scheduled start of a 2023-24 game is the provider-40 fetch\'s (props40_reads.json `start`). games.csv lists the play-in (from 14 to 19 April) as REG, and the in-season tournament final as REG.';

/* ---------- box scores and team boxes ---------- */
function boxSeason(s) {
  const f = path.join(DATA, `box_${s}.csv`);
  const B = readCsv(f), h = B.h, ix = n => col(h, n);
  const shapeOnly = SHAPE_ONLY.has(s);
  const finals = (bySeason[s] || []).filter(g => g.status === 'final' && g.type !== 'PRE');
  const byGame = new Map();
  let empty = 0;
  const seen = new Set(); let dup = 0;
  for (const v of B.rows) {
    const g = v[ix('game_id')], t = v[ix('team')], p = v[ix('player_id')];
    if (!p) empty++;
    const k = g + '|' + p; if (seen.has(k)) dup++; seen.add(k);
    if (!byGame.has(g)) byGame.set(g, new Map());
    const m = byGame.get(g); if (!m.has(t)) m.set(t, []); m.get(t).push(v);
  }
  const withBox = finals.filter(g => byGame.has(g.id));
  const missing = finals.filter(g => !byGame.has(g.id)).map(g => g.id);
  const notInGames = [...byGame.keys()].filter(id => !gameOf.has(id));
  const sides = [], five = [], perSide = [];
  for (const [gid, m] of byGame) for (const [t, rs] of m) {
    sides.push(gid + '|' + t);
    perSide.push(rs.length);
    if (rs.filter(v => v[ix('starter')] === '1').length === 5) five.push(1);
  }
  const twoSides = [...byGame.values()].filter(m => m.size === 2).length;
  const out = { use: seasonUse(s), ...fileInfo(f), columns: h, rows: B.rows.length, badLines: B.badLines, games: byGame.size,
    players: new Set(B.rows.map(v => v[ix('player_id')])).size, dates: range(B.rows.map(v => v[ix('date')])),
    byType: count([...byGame.keys()].map(id => gameOf.get(id)), g => g ? g.type : 'not in games.csv'),
    finals: finals.length, finalsWithBox: withBox.length, finalsWithoutBox: missing.length, finalsWithoutBoxIds: missing.slice(0, 20),
    boxNotInGames: notInGames.length, gamesWithTwoSides: twoSides, sides: sides.length, sidesWithFiveStarters: five.length,
    rowsPerSideMedian: median(perSide), rowsPerSideRange: range(perSide), duplicateRows: dup, emptyPlayerId: empty,
    shapeOnly };
  if (shapeOnly) { out.note = s === TEST ? 'the test season: shape only (no minutes, stat, plus-minus or did-not-play figure is computed)' : 'the season in play: shape only'; return out; }
  /* development seasons: consistency */
  let dnpRows = 0, dnpWithMin = 0, playedZeroMin = 0, playedRows = 0, pmEmpty = 0, minFrac = 0;
  const sideMin = [], ot = [], ptsOk = [], pmOk = [];
  for (const [gid, m] of byGame) {
    const g = gameOf.get(gid);
    const pts = {}, pm = {}, mins = {};
    for (const [t, rs] of m) {
      let sm = 0, sp = 0, spm = 0, anyPm = false;
      for (const v of rs) {
        const dnp = v[ix('dnp')] === '1', mn = v[ix('min')] === '' ? 0 : +v[ix('min')];
        if (dnp) { dnpRows++; if (mn > 0) dnpWithMin++; continue; }
        playedRows++;
        if (!(mn > 0)) playedZeroMin++;
        if (!Number.isInteger(mn)) minFrac++;
        sm += mn; sp += +v[ix('pts')] || 0;
        if (v[ix('pm')] === '') pmEmpty++; else { spm += +v[ix('pm')]; anyPm = true; }
      }
      mins[t] = sm; pts[t] = sp; pm[t] = anyPm ? spm : null;
      sideMin.push(sm);
    }
    if (g && m.size === 2) {
      const sides2 = [g.away, g.home];
      ot.push(Math.max(...sides2.map(t => mins[t] || 0)) >= 255 ? 1 : 0);
      const fin = { [g.away]: +g.as, [g.home]: +g.hs };
      ptsOk.push(sides2.every(t => pts[t] === fin[t]) ? 1 : 0);
      if (sides2.every(t => pm[t] != null)) pmOk.push(sides2.every(t => pm[t] === 5 * (fin[t] - fin[t === g.home ? g.away : g.home])) ? 1 : 0);
    }
  }
  out.dev = { playedRows, dnpRows, dnpWithMinutes: dnpWithMin, playedWithNoMinutes: playedZeroMin, minutesNotWhole: minFrac,
    sideMinutes: { median: median(sideMin), p01: quant(sideMin, 0.01), p99: quant(sideMin, 0.99) },
    gamesPastRegulation: ot.reduce((a, b) => a + b, 0), gamesChecked: ot.length,
    pointsEqualFinal: share(ptsOk.reduce((a, b) => a + b, 0), ptsOk.length), pointsNotEqualFinal: ptsOk.length - ptsOk.reduce((a, b) => a + b, 0),
    plusMinusEmptyOnPlayedRows: pmEmpty, plusMinusBalances: share(pmOk.reduce((a, b) => a + b, 0), pmOk.length), plusMinusChecked: pmOk.length };
  return out;
}
function teamboxSeason(s) {
  const f = path.join(DATA, `teambox_${s}.jsonl`);
  const lines = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
  const keys = {}; for (const t of lines) for (const k of Object.keys(t.stats || {})) keys[k] = (keys[k] || 0) + 1;
  const gamesIn = new Set(lines.map(t => t.game_id));
  const finals = (bySeason[s] || []).filter(g => g.status === 'final' && g.type !== 'PRE');
  return { use: seasonUse(s), ...fileInfo(f), lines: lines.length, games: gamesIn.size, dates: range(lines.map(t => t.date)),
    finalsWithTeambox: finals.filter(g => gamesIn.has(g.id)).length, finals: finals.length,
    keys: Object.keys(keys).sort(), keysInEveryLine: Object.keys(keys).filter(k => keys[k] === lines.length).length, shapeOnly: SHAPE_ONLY.has(s) };
}

/* ---------- game lines: data/odds_hist.csv ---------- */
function oddsHist() {
  const f = path.join(DATA, 'odds_hist.csv'), O = readCsv(f), h = O.h, ix = n => col(h, n);
  const out = { ...fileInfo(f), columns: h, rows: O.rows.length, badLines: O.badLines, seasons: {} };
  const by = {}; for (const v of O.rows) (by[v[ix('season')]] = by[v[ix('season')]] || []).push(v);
  for (const s of Object.keys(by).sort()) {
    const xs = by[s], finals = (bySeason[s] || []).filter(g => g.status === 'final' && g.type !== 'PRE');
    const ids = new Set(xs.map(v => v[ix('game_id')]));
    const fill = {}; for (const k of ['home_ml', 'away_ml', 'home_line', 'total', 'home_ml_open', 'away_ml_open', 'home_line_open', 'total_open']) fill[k] = xs.filter(v => v[ix(k)] !== '').length;
    out.seasons[s] = { use: seasonUse(+s), rows: xs.length, byType: count(xs, v => v[ix('type')]), byProvider: count(xs, v => v[ix('provider')]),
      finals: finals.length, finalsCovered: finals.filter(g => ids.has(g.id)).length, filled: fill, nProviders: count(xs, v => v[ix('n_providers')]) };
  }
  out.note = 'Closing game lines (moneylines, the home line, the total, and from 2023-24 the openers) on the 2022-23 to 2025-26 finals, from ESPN\'s game summaries (tools/fetch_odds_hist.js, a finished backfill). The provider is whatever the summary\'s pickcenter named first: "consensus" for every 2022-23 game, DraftKings for most of 2023-24 and 2025-26, ESPN BET for 2024-25. From 2026-27 on the job keeps each game\'s lines in games.csv itself.';
  return out;
}

/* ---------- player-prop lines on disk ---------- */
function propsRecord(s) {
  const f = path.join(DATA, `props_${s}.csv`), P = readCsv(f), h = P.h, ix = n => col(h, n);
  const ids = new Set(P.rows.map(v => v[ix('game_id')]));
  const out = { use: s === 2026 ? 'spent' : 'forward', ...fileInfo(f), columns: h, rows: P.rows.length, badLines: P.badLines, games: ids.size,
    dates: range([...ids].map(id => (gameOf.get(id) || {}).date).filter(Boolean)), byType: count([...ids].map(id => gameOf.get(id)), g => g ? g.type : 'not in games.csv') };
  if (s === 2026) { out.byStat = count(P.rows, v => v[ix('stat')]); out.players = new Set(P.rows.map(v => v[ix('player_id')])).size; }
  return out;
}
function propsReads() {
  const f = path.join(DATA, 'props_reads.json'), j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const by = {}; for (const [k, v] of Object.entries(j)) { const s = k.slice(0, 4); by[s] = by[s] || {}; const st = v && v.status || String(v); by[s][st] = (by[s][st] || 0) + 1; }
  return { ...fileInfo(f), games: Object.keys(j).length, bySeasonStatus: by };
}
function shadow() {
  const f = path.join(DATA, 'props_shadow.json'), j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const lf = path.join(DATA, 'props_shadow_lines.csv'), L = readCsv(lf);
  const d = j.decision || {};
  return { use: 'forward', ledger: { ...fileInfo(f), barRegistered: j.bar_registered, runAt: j.run_at, verdict: d.verdict || null, decidedAt: d.decided_at || null,
    decisionLines: d.lines || null, decisionGames: d.games || null, early: !!d.early, calls: j.calls ? Object.keys(j.calls).length : null },
    lines: { ...fileInfo(lf), columns: L.h, rows: L.rows.length, games: new Set(L.rows.map(v => v[0])).size } };
}

/* ---------- availability, rosters, coaches, priors, predictions ---------- */
function injuries() {
  const lf = path.join(DATA, 'injuries_log.csv'), L = readCsv(lf), h = L.h, ix = n => col(h, n);
  const dates = [...new Set(L.rows.map(v => v[ix('date')]))].sort();
  const jf = path.join(DATA, 'injuries.json'), j = JSON.parse(fs.readFileSync(jf, 'utf8'));
  return { use: 'forwardToday',
    log: { ...fileInfo(lf), columns: h, rows: L.rows.length, firstDate: dates[0], lastDate: dates[dates.length - 1], dates: dates.length,
      teams: new Set(L.rows.map(v => v[ix('team')])).size, players: new Set(L.rows.map(v => v[ix('player_id')])).size, byStatus: count(L.rows, v => v[ix('status')]) },
    today: { ...fileInfo(jf), date: j.date, teams: Object.keys(j.teams || {}).length, players: Object.values(j.teams || {}).reduce((n, a) => n + a.length, 0),
      fields: [...new Set(Object.values(j.teams || {}).flatMap(a => a.flatMap(x => Object.keys(x))))].sort() },
    note: 'The only pre-game availability on disk is the job\'s daily log of ESPN\'s injury report, from 2026-09-20 (the 2026-27 preseason) on. No past season has a pre-game injury report: for 2021-22 to 2025-26 who was out is known only from the box score after the game (who is listed, who did not play). ESPN\'s game summary carries an injuries block, but it is the list as of the read, not as of the game (data/sample_summary.json, a 2021-22 game read in 2026, lists entries dated June 2026), so it is no historical report and must never be read as one.' };
}
function rosters() {
  const f = path.join(DATA, 'rosters_espn.json'), j = JSON.parse(fs.readFileSync(f, 'utf8'));
  const cf = path.join(DATA, 'coaches.csv'), C = readCsv(cf), h = C.h, ix = n => col(h, n);
  const ef = path.join(DATA, 'coaches_espn.json'), e = JSON.parse(fs.readFileSync(ef, 'utf8'));
  const seasons = {}; for (const v of C.rows) { const s = v[ix('season')]; seasons[s] = seasons[s] || { rows: 0, changes: 0 }; seasons[s].rows++; if (v[ix('from')]) seasons[s].changes++; }
  return {
    rosters: { use: 'forwardToday', ...fileInfo(f), date: j.date, asOf: j.asOf, teams: Object.keys(j.teams || {}).length, players: Object.values(j.teams || {}).reduce((n, a) => n + a.length, 0),
      fields: [...new Set(Object.values(j.teams || {}).flatMap(a => a.flatMap(x => Object.keys(x))))].sort(),
      note: 'Each team\'s roster as ESPN lists it on the day the job ran: no past season\'s roster is kept (who was on a team then is read from its box scores).' },
    coaches: { use: 'dev for 2021-22 and 2023-24 to 2025-26; testSeason for 2022-23; forward for 2026-27', ...fileInfo(cf), columns: h, rows: C.rows.length, seasons, note: 'Head coach by team and season, hand-kept, a mid-season change dated in `from`.' },
    coachesToday: { use: 'forwardToday', ...fileInfo(ef), date: e.date, teams: Object.keys(e.teams || {}).length },
  };
}
function raptor() {
  const f = path.join(DATA, 'raptor.csv'), R = readCsv(f), h = R.h, ix = n => col(h, n);
  return { use: 'dev', ...fileInfo(f), columns: h, rows: R.rows.length, bySeason: count(R.rows, v => v[ix('season')]),
    note: 'FiveThirtyEight\'s RAPTOR, offence and defence a player, for 2019-20 to 2021-22: the player model\'s priors.' };
}
function predictions() {
  const f = path.join(DATA, 'predictions.csv'), P = readCsv(f), h = P.h, ix = n => col(h, n);
  return { use: 'forward', ...fileInfo(f), columns: h, rows: P.rows.length, dates: range(P.rows.map(v => v[ix('date')])),
    note: 'The game numbers the site published before each 2026-27 game: the season in play.' };
}

/* ---------- the rest of data/ and the job's root files: listed, not modelling sources ---------- */
function others() {
  const named = new Set(['games.csv', 'odds_hist.csv', 'props_2026.csv', 'props_2027.csv', 'props_reads.json', 'props_shadow.json', 'props_shadow_lines.csv',
    'injuries.json', 'injuries_log.csv', 'rosters_espn.json', 'coaches.csv', 'coaches_espn.json', 'raptor.csv', 'predictions.csv',
    ...BOX_SEASONS.flatMap(s => [`box_${s}.csv`, `teambox_${s}.jsonl`])]);
  const notes = {
    'calls.json': 'the calls ledger: each game model\'s call on 2026-27 games (Pick\'em Record); the season in play',
    'corr.json': 'the same-game correlation table, measured on the 2022-23 to 2025-26 box scores (tools/corr.js): it carries the test season\'s outcomes, so a candidate tested on 2022-23 may not stand on it as it stands',
    'suggest_ledger.json': 'the Suggested Parlays record (2026-27); the season in play',
    'sample_summary.json': 'one ESPN game summary payload as tools/fetch_box.js first read it (a 2021-22 game): kept for its shape',
  };
  const data = fs.readdirSync(DATA).filter(f => !named.has(f)).sort().map(f => ({ ...fileInfo(path.join(DATA, f)), use: 'none', what: notes[f] || 'not described' }));
  const root = ['state.json', 'lines.json', 'props.json', 'players.json', 'model.json', 'history.json', 'pickem.json', 'research.json'].filter(f => exists(path.join(ROOT, f))).map(f => {
    let stamp = null; try { const j = JSON.parse(fs.readFileSync(path.join(ROOT, f), 'utf8')); stamp = j.generated || j.asOf || j.at || j.updated || j.date || (j.props && j.props.asOf) || null; } catch (e) { stamp = 'not JSON'; }
    return f === 'research.json' ? { ...fileInfo(path.join(ROOT, f)), stamp, use: 'none', what: 'the player model\'s walk-forward (tools/players.js research, run by hand)' }
      : { ...fileInfo(path.join(ROOT, f)), stamp, use: 'forwardToday' };
  });
  return { data, root, note: 'The job\'s root files are today\'s state of the site (2026-27), written by the job and never edited: lines.json carries DraftKings\' game lines and every player prop for the next two dates with a game, props.json the props model\'s projections. A forward shadow can read them as the job writes them; nothing in them is history.' };
}

/* ---------- research files the plan may read ---------- */
function researchFiles() {
  const rp = path.join(ROOT, 'research', 'props.json');
  const j = JSON.parse(fs.readFileSync(rp, 'utf8'));
  return { propsJson: { ...fileInfo(rp), folds: (j.folds || []).map(f => f.season), generated: j.generated || null,
    note: 'tools/props.js\'s walk-forward: each fold\'s constants fitted on the seasons before it (2024 on 2023; 2025 on 2023-2024; 2026 on 2023-2025), and its market test on the 2026 archive' },
    propsV2Results: fs.readdirSync(path.join(ROOT, 'research', 'props_v2', 'results')).sort() };
}

const out = {
  generated: new Date().toISOString().slice(0, 16) + 'Z',
  what: 'research/props_v3/data_inventory.js: every source on disk, its shape, its completeness and consistency, and what the rules allow it for; files only, no network',
  rules: USE,
  shapeOnly: { test: TEST, inPlay: IN_PLAY, rule: 'read for header, counts, dates and completeness only; no value a game produced enters a figure' },
  games: gamesInv,
  box: Object.fromEntries(BOX_SEASONS.map(s => [s, boxSeason(s)])),
  teambox: Object.fromEntries(BOX_SEASONS.map(s => [s, teamboxSeason(s)])),
  oddsHist: oddsHist(),
  props: { archive2026: propsRecord(2026), season2027: propsRecord(2027), reads: propsReads(), shadow: shadow() },
  injuries: injuries(),
  ...rosters(),
  raptor: raptor(),
  predictions: predictions(),
  research: researchFiles(),
  others: others(),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${rel(OUT)}`);
