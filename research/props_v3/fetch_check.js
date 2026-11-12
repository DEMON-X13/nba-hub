/* The 2023-24 provider-40 fetch, logged and checked: what was asked, what came back, and whether it is the very set of
 * lines research/props_v2's 2023-24 test scored on 6 November 2026; then what in it is clean. Research only: it reads the
 * gitignored cache and the request logs research/props_v3/fetch_dk40_logged.sh wrote, and writes
 * research/props_v3/results/fetch_check.json, aggregates only (no line, price or player id).
 *
 *   node research/props_v3/fetch_check.js                  the check, into results/fetch_check.json
 *   node research/props_v3/fetch_check.js --write-window   first: the window's rows alone into cache/props40_2024_window/
 *     (then: node research/props_v2/validity.js --lines research/props_v3/cache/props40_2024_window/props40_2024.csv --season 2024)
 *
 * Reads: research/props_v2/cache/props40_2024.csv and props40_reads.json (research/props_v2/fetch_dk40.js's cache);
 * research/props_v3/cache/fetch_dk40_<from>_<to>.requests.tsv and .stdout.log for every 2023-24 range fetched;
 * research/props_v3/cache/stray_2021-22/ (a 2021-22 fetch started by mistake and stopped: counted, nothing else);
 * data/games.csv and data/box_2024.csv (2023-24, development: who played, each stat, each side's minutes); and props_v2's
 * results: test2024.json (its coverage, its lines and the SHA-256 of the csv it scored), espn_coverage.tsv's and
 * espn_validate40.json's 2023-24 rows only, and the validity check's output on this fetch where it has been run
 * (research/props_v3/cache/props40_2024_window/validity_2024.json, the window's bytes, and
 * research/props_v2/cache/validity_2024.json, the whole file), held to test2024.json's validity block.
 *
 * The regular-season window is props_v2's test's: REG games dated 24 October 2023 to 14 April 2024 (the play-in, which
 * games.csv also types REG, is from 16 April). The check of timing (does `last_updated` carry the result?) grades the
 * window's lines on the box scores as tools/props.js grades them: a player who played (minutes above 0, not flagged as
 * did not play) is graded, the Over landing when the stat is above the line; every other line is void.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const F = require('../../tools/props_feed.js');

const ROOT = path.join(__dirname, '..', '..');
const C2 = path.join(ROOT, 'research', 'props_v2', 'cache'), C3 = path.join(__dirname, 'cache');
const R2 = path.join(ROOT, 'research', 'props_v2', 'results');
const OUT = path.join(__dirname, 'results', 'fetch_check.json');
const WIN = { type: 'REG', from: '2023-10-24', to: '2024-04-14' };
const BASE = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'];
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const q = (a, p) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); return s[Math.min(s.length - 1, Math.floor(p * s.length))]; };
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const add = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };
const readJSON = f => JSON.parse(fs.readFileSync(f, 'utf8'));

/* the schedule */
const GL = fs.readFileSync(path.join(ROOT, 'data', 'games.csv'), 'utf8').trim().split('\n'), gh = GL.shift().split(','), gc = n => gh.indexOf(n);
const games = GL.map(l => l.split(',')).map(v => ({ id: v[gc('game_id')], season: +v[gc('season')], date: v[gc('date')], type: v[gc('type')], status: v[gc('status')], espn: v[gc('espn_id')], away: v[gc('away')], home: v[gc('home')] }));
const gameOf = new Map(games.map(g => [g.id, g]));
const inWin = g => !!g && g.type === WIN.type && g.date >= WIN.from && g.date <= WIN.to;
const kindOf = g => !g ? 'not on the schedule' : inWin(g) ? 'regular season (the window)' : g.type === 'REG' ? (g.date > WIN.to ? 'play-in' : 'regular season outside the window') : g.type === 'POST' ? 'playoffs' : g.type;

/* --write-window: the window's rows alone, in the fetch's own format, beside a copy of the reads, for validity.js to
   check the very bytes props_v2's test scored (validity.js writes its output beside the csv it is given) */
if (process.argv.includes('--write-window')) {
  const csv = fs.readFileSync(path.join(C2, 'props40_2024.csv'), 'utf8').split('\n'), head = csv[0];
  const win = csv.slice(1).filter(l => l && inWin(gameOf.get(l.slice(0, l.indexOf(',')))));
  const dir = path.join(C3, 'props40_2024_window'); fs.mkdirSync(dir, { recursive: true });
  const body = [head, ...win].join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'props40_2024.csv'), body);
  fs.copyFileSync(path.join(C2, 'props40_reads.json'), path.join(dir, 'props40_reads.json'));
  console.log(`wrote ${path.relative(ROOT, dir)}/props40_2024.csv: ${win.length} rows, SHA-256 ${sha(Buffer.from(body))}`);
  process.exit(0);
}

/* ---------- the fetch: request logs ---------- */
function requestLogs() {
  const files = fs.readdirSync(C3).filter(f => /^fetch_dk40_\d{4}-\d\d-\d\d_\d{4}-\d\d-\d\d\.requests\.tsv$/.test(f)).sort();
  return files.map(f => {
    const lines = fs.readFileSync(path.join(C3, f), 'utf8').split('\n').filter(Boolean);
    const runs = lines.filter(l => /^(started|finished)\t/.test(l)).map(l => l.split('\t'));
    const req = lines.filter(l => !/^(started|finished)\t/.test(l)).map(l => { const [at, rc, code, url] = l.split('\t'); return { at, rc, code, url, kind: /\/propBets\?/.test(url) ? 'propBets page' : 'event' }; });
    const byKind = {}, byStatus = {}, errors = [];
    for (const r of req) { add(byKind, r.kind); add(byStatus, `${r.kind}: curl ${r.rc}, HTTP ${r.code || 'none'}`); if (r.rc !== '0' || !['200', '404'].includes(r.code)) errors.push({ at: r.at, kind: r.kind, espn: (/events\/(\d+)/.exec(r.url) || [])[1], rc: r.rc, http: r.code || null }); }
    const pages = req.filter(r => r.kind === 'propBets page'), pageGames = new Map();
    for (const r of pages) { const e = (/events\/(\d+)/.exec(r.url) || [])[1]; pageGames.set(e, (pageGames.get(e) || 0) + 1); }
    const [from, to] = f.replace(/^fetch_dk40_|\.requests\.tsv$/g, '').split('_');
    const outLog = path.join(C3, f.replace('.requests.tsv', '.stdout.log'));
    const stdout = fs.existsSync(outLog) ? fs.readFileSync(outLog, 'utf8').split('\n').filter(l => /^\d{4}_\d{8}_/.test(l)) : [];
    return { log: path.relative(ROOT, path.join(C3, f)), from, to, started: (runs.find(r => r[0] === 'started') || [])[1] || null, finished: (runs.find(r => r[0] === 'finished') || [])[1] || null,
      requests: req.length, byKind, byStatus, errors, pagesPerGame: Object.fromEntries([...new Set(pageGames.values())].sort().map(n => [n, [...pageGames.values()].filter(x => x === n).length])),
      gamesLogged: stdout.length, readsLogged: stdout.reduce((m, l) => add(m, l.split(' ')[1]), {}) };
  });
}
function strayLog() {
  const d = path.join(C3, 'stray_2021-22');
  if (!fs.existsSync(d)) return null;
  const f = fs.readdirSync(d).find(x => x.endsWith('.requests.tsv'));
  const lines = fs.readFileSync(path.join(d, f), 'utf8').split('\n').filter(Boolean);
  const req = lines.filter(l => !/^(started|finished)\t/.test(l)).map(l => l.split('\t'));
  const reads = readJSON(path.join(d, 'props40_reads.json'));
  const csvRows = fs.readFileSync(path.join(d, 'props40_2022.csv'), 'utf8').split('\n').filter(Boolean).length - 1;
  const ids = req.map(r => (/events\/(\d+)/.exec(r[3]) || [])[1]);
  const espnGame = new Map(games.filter(g => g.espn).map(g => [g.espn, g]));
  const dates = ids.map(e => (espnGame.get(e) || {}).date).filter(Boolean).sort();
  return { what: 'a guard test of fetch_dk40_logged.sh on a 2021-22 range that was meant to be refused only for 2022-23 ran the real fetch; stopped by hand after 373 games. 2021-22 is development data, so no rule was broken, but it was not asked for',
    requests: req.length, byStatus: req.reduce((m, r) => add(m, `${/propBets/.test(r[3]) ? 'propBets page' : 'event'}: curl ${r[1]}, HTTP ${r[2]}`), {}),
    gamesAsked: new Set(ids).size, dates: dates.length ? [dates[0], dates[dates.length - 1]] : null, seasonsAsked: [...new Set(ids.map(e => (espnGame.get(e) || {}).season))],
    readsFlushed: Object.keys(reads).length, readsByStatus: Object.values(reads).reduce((m, r) => add(m, r.status), {}), csvRows,
    kept: 'moved out of research/props_v2/cache/ into research/props_v3/cache/stray_2021-22/ (gitignored) before the 2023-24 fetch, so that cache holds the 2023-24 fetch alone' };
}

/* ---------- the cache ---------- */
const csvBuf = fs.readFileSync(path.join(C2, 'props40_2024.csv')), readsBuf = fs.readFileSync(path.join(C2, 'props40_reads.json'));
const csvText = csvBuf.toString('utf8').split('\n'), HEAD = csvText[0], rowLines = csvText.slice(1).filter(Boolean);
const reads = JSON.parse(readsBuf.toString('utf8'));
const rows = rowLines.map(l => { const v = l.split(','); return { l, game: v[0], player: v[1], stat: v[2], line: +v[3], over: v[4], under: v[5], lu: v[6] }; });

function cacheFacts() {
  const seen = new Set(); let dup = 0, noPrice = 0, badPrice = 0, half = 0, noStamp = 0;
  const byKind = {}, byStat = {}, perGame = new Map();
  for (const r of rows) {
    const k = r.game + '|' + r.player + '|' + r.stat; if (seen.has(k)) dup++; seen.add(k);
    if (r.over === '' || r.under === '') noPrice++;
    const o = F.propAmerican(r.over), u = F.propAmerican(r.under);
    if (o == null || u == null) badPrice++;
    if (Math.abs(r.line * 2 - Math.round(r.line * 2)) < 1e-9 && Math.round(r.line * 2) % 2 === 1) half++;
    if (!r.lu) noStamp++;
    add(byKind, kindOf(gameOf.get(r.game))); add(byStat, r.stat);
    perGame.set(r.game, (perGame.get(r.game) || 0) + 1);
  }
  const pg = [...perGame.values()];
  return { header: HEAD, headerIsTheRecipes: HEAD === 'game_id,player_id,stat,line,over,under,last_updated', rows: rows.length, games: perGame.size, rowsByKind: byKind,
    gamesByKind: [...perGame.keys()].reduce((m, g) => add(m, kindOf(gameOf.get(g))), {}), byStat, rowsPerGame: { min: q(pg, 0), median: q(pg, 0.5), max: q(pg, 1) },
    duplicateGamePlayerStat: dup, missingPrice: noPrice, priceNotAmerican: badPrice, halfPointLines: half, notHalfPoint: rows.length - half, noStamp,
    sha256: { csv: sha(csvBuf), reads: sha(readsBuf) }, playersDistinct: new Set(rows.map(r => r.player)).size };
}
function readsFacts() {
  const out = { games: Object.keys(reads).length, byKindStatus: {}, failed: [], noLineDates: {} };
  for (const [id, r] of Object.entries(reads)) {
    const g = gameOf.get(id), k = kindOf(g);
    add(out.byKindStatus[k] = out.byKindStatus[k] || {}, r.status === 'ok' && !r.lines ? 'ok, no line' : r.status);
    if (r.status === 'failed') out.failed.push(id);
  }
  /* games of the range fetched (2023-10-24 to 2024-04-30, every final that is not preseason and has an ESPN id), each read? */
  const range = games.filter(g => g.date >= '2023-10-24' && g.date <= '2024-04-30' && g.type !== 'PRE' && g.status === 'final');
  out.range = { from: '2023-10-24', to: '2024-04-30', finals: range.length, withEspnId: range.filter(g => g.espn).length, read: range.filter(g => reads[g.id]).length,
    noEspnId: range.filter(g => !g.espn).map(g => g.id) };
  /* the window's none games, as runs of dates */
  const none = range.filter(g => inWin(g) && reads[g.id] && reads[g.id].status === 'none').map(g => g.date);
  const byDate = none.reduce((m, d) => add(m, d), {});
  const ds = Object.keys(byDate).sort(), spans = [];
  for (const d of ds) { const last = spans[spans.length - 1]; if (last && (Date.parse(d) - Date.parse(last.to)) <= 86400000) { last.to = d; last.games += byDate[d]; } else spans.push({ from: d, to: d, games: byDate[d] }); }
  out.windowNone = { games: none.length, dates: ds.length, spans };
  /* games of each date in the window, and how many answered: a date where some games answered and some did not */
  const winGames = range.filter(g => inWin(g) && g.espn);
  const mixed = {};
  for (const g of winGames) { const m = mixed[g.date] = mixed[g.date] || { games: 0, none: 0 }; m.games++; if (reads[g.id] && reads[g.id].status === 'none') m.none++; }
  out.windowDatesPartlyAnswered = Object.entries(mixed).filter(([, m]) => m.none > 0 && m.none < m.games).map(([d, m]) => ({ date: d, ...m }));
  out.startKnown = Object.values(reads).filter(r => r.start).length;
  /* the dates each kind of game answered with lines, and the last date any did */
  const okDates = {};
  for (const g of range) { const r = reads[g.id]; if (!r || r.status !== 'ok' || !r.lines) continue; const k = kindOf(g); const d = okDates[k] = okDates[k] || { from: g.date, to: g.date, games: 0 }; d.games++; if (g.date < d.from) d.from = g.date; if (g.date > d.to) d.to = g.date; }
  out.answeredDates = okDates;
  out.playoffsAfterLastAnswer = range.filter(g => g.type === 'POST' && okDates.playoffs && g.date > okDates.playoffs.to).length;
  return out;
}

/* ---------- the window against props_v2's test ---------- */
function windowFacts() {
  const t = readJSON(path.join(R2, 'test2024.json'));
  const win = rows.filter(r => inWin(gameOf.get(r.game)));
  const body = Buffer.from([HEAD, ...win.map(r => r.l)].join('\n') + '\n');
  const wg = games.filter(g => inWin(g));
  const st = { ok: 0, okNoLine: 0, none: 0, failed: 0, notRead: 0 };
  for (const g of wg) { if (!g.espn) continue; const r = reads[g.id]; if (!r) st.notRead++; else if (r.status === 'ok' && r.lines > 0) st.ok++; else if (r.status === 'ok') st.okNoLine++; else if (r.status === 'none') st.none++; else st.failed++; }
  const rowsPer = new Map(); for (const r of win) rowsPer.set(r.game, (rowsPer.get(r.game) || 0) + 1);
  const rowsMatchReads = [...rowsPer].every(([g, n]) => reads[g] && reads[g].lines === n);
  const now = { windowGames: wg.length, noEspnId: wg.filter(g => !g.espn).length, withEspnId: wg.filter(g => g.espn).length, read: st, gamesWithLines: rowsPer.size, rows: win.length, rowsMatchReads, sha256: sha(body) };
  const then = { windowGames: t.coverage.windowGames, noEspnId: t.coverage.noEspnId, withEspnId: t.coverage.withEspnId, read: t.coverage.read, gamesWithLines: t.coverage.gamesWithLines,
    rows: t.lines.rows, sha256: t.files.csv, graded: t.lines.graded, voids: t.lines.voids, noCall: t.lines.noCall, generated: t.generated };
  return { now, test2024: then,
    same: { sha256: now.sha256 === then.sha256, rows: now.rows === then.rows, gamesWithLines: now.gamesWithLines === then.gamesWithLines, none: now.read.none === then.read.none, ok: now.read.ok === then.read.ok, failed: now.read.failed === then.read.failed && now.read.failed === 0 },
    note: 'the window\'s rows, written as fetch_dk40.js writes its csv (its header, the rows of the window\'s games in game order, a closing newline), hashed: equal to test2024.json\'s files.csv means the very bytes props_v2\'s test scored (the whole file adds the play-in and playoff games of the range, so it hashes otherwise)' };
}

/* ---------- props_v2's samples ---------- */
function samplesFacts() {
  const t = fs.readFileSync(path.join(R2, 'espn_coverage.tsv'), 'utf8').trim().split('\n'), h = t.shift().split('\t'), c = n => h.indexOf(n);
  const cov = t.map(l => l.split('\t')).filter(v => v[c('season')] === '2024' && v[c('provider')] === '40');
  const agree = {}, disagree = [];
  for (const v of cov) {
    const r = reads[v[c('game_id')]], now = !r ? 'not read' : r.status === 'ok' && r.lines > 0 ? 'ok' : r.status;
    const then = v[c('http')] === '200' && +v[c('items')] > 0 ? 'ok' : v[c('http')] === '404' ? 'none' : `HTTP ${v[c('http')]}`;
    add(agree, `${then} then, ${now} now`); if (then !== now) disagree.push({ game: v[c('game_id')], then, now });
  }
  const val = readJSON(path.join(R2, 'espn_validate40.json')).games.filter(g => String(g.gid).startsWith('2024_'));
  const rowsPer = new Map(); for (const r of rows) rowsPer.set(r.game, (rowsPer.get(r.game) || 0) + 1);
  const vm = val.map(g => { const r = reads[g.gid] || {}; return { game: g.gid, mainsThen: g.mains, rowsNow: rowsPer.get(g.gid) || 0, startThen: g.start, startNow: r.start ? String(r.start).replace(/:00Z$/, 'Z').slice(0, 17) : null }; });
  const norm = s => s ? String(s).replace(/(:\d\d)?Z$/, '').slice(0, 16) : null;
  return { coverage: { what: 'research/props_v2/results/espn_coverage.tsv: one 2023-24 game in four asked of provider 40 on 5 November 2026 (HTTP status and item count)', games: cov.length, agree, disagree },
    validate40: { what: 'research/props_v2/results/espn_validate40.json: every tenth answering 2023-24 regular-season game and every answering 2024 playoff game, read whole on 5 November 2026', games: vm.length,
      mainsEqualRows: vm.filter(x => x.mainsThen === x.rowsNow).length, startEqual: vm.filter(x => norm(x.startThen) === norm(x.startNow)).length,
      differ: vm.filter(x => x.mainsThen !== x.rowsNow || norm(x.startThen) !== norm(x.startNow)) } };
}

/* ---------- the validity check's output, against test2024.json's ---------- */
function validityFacts() {
  const t = readJSON(path.join(R2, 'test2024.json')).validity;
  const pick = v => ({ graded: v.graded, games: v.games, v0: v.v0, v1: { dated: v.v1.dated, undated: v.v1.undated, shareBeforeStart: v.v1.shareBeforeStart, hoursAfterStartMedian: v.v1.hoursAfterStartMedian },
    v2: { exitLines: v.v2.exitLines, exits: v.v2.exits, leftOut: v.v2.leftOut, diff: v.v2.diff, holds: v.v2.holds, byStat: v.v2.byStat },
    v3: Object.fromEntries(BASE.map(k => [k, v.v3[k]])), v3holds: v.v3.holds, verdict: v.verdict });
  const want = pick(t);
  const runs = {};
  for (const [name, f] of [['window', path.join(C3, 'props40_2024_window', 'validity_2024.json')], ['wholeFile', path.join(C2, 'validity_2024.json')]]) {
    if (!fs.existsSync(f)) { runs[name] = { file: path.relative(ROOT, f), run: false }; continue; }
    const v = readJSON(f), got = pick(v);
    const diffs = [];
    const walk = (a, b, p) => { if (a && typeof a === 'object' && b && typeof b === 'object') { for (const k of new Set([...Object.keys(a), ...Object.keys(b)])) walk(a[k], b[k], p ? p + '.' + k : k); } else if (JSON.stringify(a) !== JSON.stringify(b)) diffs.push({ at: p, now: a, test2024: b }); };
    walk(got, want, '');
    runs[name] = { file: path.relative(ROOT, f), run: true, generated: v.generated, files: v.files, verdict: v.verdict, sameAsTest2024: diffs.length === 0, diffs: diffs.slice(0, 20) };
  }
  return { test2024: { generated: t.generated, verdict: t.verdict, graded: t.graded, games: t.games }, runs };
}

/* ---------- what is clean: grading, margins, the stamps ---------- */
function cleanFacts() {
  const B = fs.readFileSync(path.join(ROOT, 'data', 'box_2024.csv'), 'utf8').trim().split('\n'), bh = B.shift().split(','), bc = n => bh.indexOf(n);
  const box = new Map(), sideMin = new Map();
  for (const l of B) {
    const v = l.split(','), g = v[bc('game_id')], p = v[bc('player_id')];
    const dnp = v[bc('dnp')] === '1', min = v[bc('min')] === '' ? 0 : +v[bc('min')];
    const n = k => v[bc(k)] === '' ? null : +v[bc(k)];
    box.set(g + '|' + p, { dnp, min, team: v[bc('team')], y: { pts: n('pts'), reb: n('orb') == null ? null : n('orb') + n('drb'), ast: n('ast'), tpm: n('tpm'), stl: n('stl'), blk: n('blk') } });
    if (!dnp) sideMin.set(g + '|' + v[bc('team')], (sideMin.get(g + '|' + v[bc('team')]) || 0) + min);
  }
  const ot = new Map();
  for (const [k, m] of sideMin) { const g = k.split('|')[0]; ot.set(g, Math.max(ot.get(g) || 0, m) >= 255); }
  const win = rows.filter(r => inWin(gameOf.get(r.game)));
  const status = {}, graded = [];
  for (const r of win) {
    const b = box.get(r.game + '|' + r.player);
    const s = !b ? 'not on the box (void)' : b.dnp ? 'listed, did not play (void)' : !(b.min > 0) ? 'played under half a minute, box minutes 0 (void by the hub\'s rule)' : 'played (graded)';
    add(status, s);
    if (s !== 'played (graded)') continue;
    const y = b.y[r.stat]; if (y == null || y === r.line) continue;
    const start = (reads[r.game] || {}).start;
    graded.push({ game: r.game, stat: r.stat, o: y > r.line ? 1 : 0, qf: F.propFairOver(F.propAmerican(r.over), F.propAmerican(r.under)),
      margin: F.propImplied(F.propAmerican(r.over)) + F.propImplied(F.propAmerican(r.under)) - 1,
      hours: r.lu && start ? (Date.parse(r.lu) - Date.parse(start)) / 3.6e6 : null, ot: ot.get(r.game) === true });
  }
  /* margins, by stat */
  const margins = Object.fromEntries(BASE.map(k => { const m = graded.filter(x => x.stat === k).map(x => x.margin); return [k, { lines: m.length, p10: r4(q(m, 0.1)), median: r4(q(m, 0.5)), p90: r4(q(m, 0.9)) }]; }));
  /* the stamps: each game's latest stamp after its scheduled start, by whether it went past regulation */
  const gameHours = new Map();
  for (const r of win) { const s = (reads[r.game] || {}).start; if (!r.lu || !s) continue; const h = (Date.parse(r.lu) - Date.parse(s)) / 3.6e6; gameHours.set(r.game, Math.max(gameHours.get(r.game) ?? -1e9, h)); }
  const regH = [...gameHours].filter(([g]) => ot.get(g) === false).map(([, h]) => h), otH = [...gameHours].filter(([g]) => ot.get(g) === true).map(([, h]) => h);
  const regMed = q(regH, 0.5);
  /* lines' stamps, voids against graded lines, within the same games */
  const lineH = (pred) => win.filter(pred).map(r => { const s = (reads[r.game] || {}).start; return r.lu && s ? (Date.parse(r.lu) - Date.parse(s)) / 3.6e6 : null; }).filter(x => x != null);
  const voidH = lineH(r => { const b = box.get(r.game + '|' + r.player); return !b || b.dnp || !(b.min > 0); });
  const playH = lineH(r => { const b = box.get(r.game + '|' + r.player); return b && !b.dnp && b.min > 0; });
  /* the graded lines' result less DraftKings' fair chance, by the line's stamp after the start: if the stamp carried the
     result, this would move across the quartiles */
  const hs = graded.filter(x => x.hours != null).map(x => x.hours), cuts = [q(hs, 0.25), q(hs, 0.5), q(hs, 0.75)];
  const quart = [0, 1, 2, 3].map(i => { const xs = graded.filter(x => x.hours != null && (i === 0 || x.hours >= cuts[i - 1]) && (i === 3 || x.hours < cuts[i])); return { lines: xs.length, hoursFrom: r4(i ? cuts[i - 1] : q(hs, 0)), overRate: r4(mean(xs.map(x => x.o))), fairOver: r4(mean(xs.map(x => x.qf))), overLessFair: r4(mean(xs.map(x => x.o - x.qf))) }; });
  const byOt = [false, true].map(v => { const xs = graded.filter(x => x.ot === v); return { pastRegulation: v, games: new Set(xs.map(x => x.game)).size, lines: xs.length, overRate: r4(mean(xs.map(x => x.o))), fairOver: r4(mean(xs.map(x => x.qf))), overLessFair: r4(mean(xs.map(x => x.o - x.qf))) }; });
  /* how well the stamp alone tells the result: the AUC of the stamp for an Over (0.5 is no information, 1 a perfect
     tell), pooled and within games; and a rule with no price in it, "Over where the line's stamp is more than five
     minutes after its game's earliest", scored as a call of each line */
  const auc = xs => { const s = xs.filter(x => x.hours != null).sort((a, b) => a.hours - b.hours); let rank = 0, sumPos = 0, nPos = 0; for (let i = 0; i < s.length;) { let j = i; while (j < s.length && s[j].hours === s[i].hours) j++; const avg = (i + 1 + j) / 2; for (let k = i; k < j; k++) if (s[k].o) { sumPos += avg; nPos++; } i = j; rank = j; } const nNeg = s.length - nPos; return nPos && nNeg ? (sumPos - nPos * (nPos + 1) / 2) / (nPos * nNeg) : null; };
  const byGame = new Map(); for (const x of graded) { if (!byGame.has(x.game)) byGame.set(x.game, []); byGame.get(x.game).push(x); }
  const within = [...byGame.values()].map(auc).filter(v => v != null);
  let hit = 0, n = 0;
  for (const xs of byGame.values()) { const first = Math.min(...xs.filter(x => x.hours != null).map(x => x.hours)); for (const x of xs) { if (x.hours == null) continue; n++; if ((x.hours > first + 5 / 60 ? 1 : 0) === x.o) hit++; } }
  /* the prices on the lines that went Over, by when their stamp says they were decided: a price set before tip-off does
     not know when in the game the Over will land, so its fair chance should not climb with the stamp */
  const overs = graded.filter(x => x.o && x.hours != null);
  const oc = [q(overs.map(x => x.hours), 0.2), q(overs.map(x => x.hours), 0.4), q(overs.map(x => x.hours), 0.6), q(overs.map(x => x.hours), 0.8)];
  const oversByStamp = [0, 1, 2, 3, 4].map(i => { const xs = overs.filter(x => (i === 0 || x.hours >= oc[i - 1]) && (i === 4 || x.hours < oc[i])); return { lines: xs.length, hoursFrom: r4(i ? oc[i - 1] : q(overs.map(x => x.hours), 0)), fairOver: r4(mean(xs.map(x => x.qf))) }; });
  return {
    lineStatus: status, graded: graded.length, gradedGames: new Set(graded.map(x => x.game)).size, pushesLeftOut: win.filter(r => { const b = box.get(r.game + '|' + r.player); return b && !b.dnp && b.min > 0 && b.y[r.stat] === r.line; }).length,
    overRate: r4(mean(graded.map(x => x.o))), fairOver: r4(mean(graded.map(x => x.qf))), margins,
    stamps: {
      what: 'last_updated, the later of a main line\'s two items\' lastUpdated as the feed gives it, against the event\'s scheduled start (props40_reads.json `start`)',
      linesBeforeStart: graded.filter(x => x.hours != null && x.hours < 0).length, linesDated: hs.length, hoursAfterStart: { p01: r4(q(hs, 0.01)), p10: r4(q(hs, 0.1)), median: r4(q(hs, 0.5)), p90: r4(q(hs, 0.9)), p99: r4(q(hs, 0.99)) },
      gameLatest: { regulation: { games: regH.length, median: r4(regMed), p10: r4(q(regH, 0.1)), p90: r4(q(regH, 0.9)) }, pastRegulation: { games: otH.length, median: r4(q(otH, 0.5)), p10: r4(q(otH, 0.1)), p90: r4(q(otH, 0.9)), shareAboveRegulationMedian: r4(otH.filter(h => h > regMed).length / (otH.length || 1)) } },
      voidLines: { lines: voidH.length, medianHours: r4(q(voidH, 0.5)) }, gradedLines: { lines: playH.length, medianHours: r4(q(playH, 0.5)) },
      resultByStampQuartile: quart, resultByOvertime: byOt,
      tellsTheResult: { aucPooled: r4(auc(graded)), aucWithinGamesMedian: r4(q(within, 0.5)), gamesWithAuc: within.length,
        ruleFiveMinutesAfterFirst: { lines: n, correct: hit, accuracy: r4(hit / (n || 1)) }, draftKingsFairChanceAccuracy: r4(mean(graded.map(x => (x.qf > 0.5 ? 1 : 0) === x.o ? 1 : 0))) },
      oversByStamp,
    },
  };
}

const out = {
  generated: new Date().toISOString().slice(0, 16) + 'Z',
  what: 'research/props_v3/fetch_check.js: the 2023-24 provider-40 fetch logged and checked against props_v2\'s test and samples, and what in it is clean; aggregates only',
  window: WIN,
  fetch: { runs: requestLogs(), stray: strayLog() },
  cache: cacheFacts(),
  reads: readsFacts(),
  againstTest2024: windowFacts(),
  againstSamples: samplesFacts(),
  validity: validityFacts(),
  clean: cleanFacts(),
};
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)}`);
console.log(JSON.stringify({ sameAsTest2024: out.againstTest2024.same, validity: Object.fromEntries(Object.entries(out.validity.runs).map(([k, v]) => [k, v.run ? v.sameAsTest2024 : 'not run'])) }));
