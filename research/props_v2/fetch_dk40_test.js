/* The test of fetch_dk40.js, on a local fake of ESPN's feed (no network: a server on 127.0.0.1 and a made-up schedule in
 * a temporary folder; nothing is fetched from anywhere, nothing in data/ or cache/ is touched):
 *   1. --dry makes no request and writes nothing;
 *   2. a run writes each game's lines once, in the record's columns plus last_updated;
 *   3. a second run over an overlapping range, and the same range again, repeat no line (the earlier recipe appended
 *      and so wrote a game's lines once per run that read it), and the file is the same to the byte;
 *   4. a game read again replaces its lines; one whose new read fails keeps its earlier lines and read.
 *
 *   node research/props_v2/fetch_dk40_test.js      writes results/fetch_dk40_test.json
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const http = require('http');
const { execFile } = require('child_process');

const SCRIPT = path.join(__dirname, 'fetch_dk40.js');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v2-dk40-'));
const cache = path.join(tmp, 'cache');
/* the schedule: four games with ESPN ids, one without, one preseason */
const head = 'game_id,season,date,type,away,home,away_score,home_score,neutral,status,home_line,total,source,espn_id,tip,home_ml,away_ml,tv';
const G = [['2024_20231024_AAA_BBB', '2023-10-24', 'REG', '901'], ['2024_20231025_CCC_DDD', '2023-10-25', 'REG', '902'], ['2024_20231026_EEE_FFF', '2023-10-26', 'REG', '903'],
  ['2024_20231027_GGG_HHH', '2023-10-27', 'REG', '904'], ['2024_20231026_III_JJJ', '2023-10-26', 'REG', ''], ['2024_20231020_KKK_LLL', '2023-10-20', 'PRE', '905']];
fs.writeFileSync(path.join(tmp, 'games.csv'), [head, ...G.map(([id, d, t, e]) => [id, 2024, d, t, 'A', 'B', 100, 101, 0, 'final', '', '', 'x', e, '', '', '', ''].join(','))].join('\n') + '\n');

/* the fake feed: each event two players, points and rebounds, as adjacent Over/Under pairs, plus a turnovers pair */
const state = { requests: [], fail: new Set(), shift: 0 };
const item = (type, ath, line, price, lu) => ({ type: { id: String(type), name: 't' }, athlete: { $ref: `http://x/athletes/${ath}?lang=en` }, current: { target: { value: line } }, odds: { american: { value: price } }, lastUpdated: lu });
function answer(e) {
  const b = +e, s = state.shift, lu = `2023-10-25T0${b - 900}:00Z`, later = `2023-10-25T0${b - 900}:30Z`;
  const items = [];
  for (const [ath, pts, reb] of [[String(b * 10 + 1), 20.5 + s, 6.5], [String(b * 10 + 2), 11.5, 3.5 + s]]) {
    items.push(item(1, ath, pts, '-115', lu), item(1, ath, pts, '-105', later));
    items.push(item(3, ath, reb, '+102', lu), item(3, ath, reb, '-124', lu));
    items.push(item(301, ath, 2.5, '-110', lu), item(301, ath, 2.5, '-110', lu));
  }
  return { count: items.length, pageIndex: 1, pageSize: 1000, pageCount: 1, items };
}
const server = http.createServer((req, res) => {
  state.requests.push(req.url);
  const m = /^\/events\/(\d+)(\/competitions\/\d+\/odds\/40\/propBets)?\?/.exec(req.url);
  const send = (code, body) => { res.writeHead(code, { 'content-type': 'application/json' }); res.end(JSON.stringify(body)); };
  if (!m) return send(404, { error: 'no' });
  if (!m[2]) return send(200, { id: m[1], date: '2023-10-25T23:00Z' });
  if (state.fail.has(m[1])) return send(500, { error: 'down' });
  return send(200, answer(m[1]));
});
const env = () => { const e = { ...process.env, DK40_BASE: `http://127.0.0.1:${server.address().port}/events`, DK40_CACHE: cache, DK40_GAMES: path.join(tmp, 'games.csv'), NO_PROXY: '127.0.0.1,localhost', no_proxy: '127.0.0.1,localhost' };
  for (const k of ['http_proxy', 'HTTP_PROXY']) delete e[k]; return e; };
const run = (...args) => new Promise((res, rej) => execFile(process.execPath, [SCRIPT, ...args], { env: env() }, (err, so, se) => err ? rej(new Error(se || err.message)) : res(so)));
const csvOf = () => fs.readFileSync(path.join(cache, 'props40_2024.csv'), 'utf8');
const rowsOf = t => t.trim().split('\n').slice(1).map(l => l.split(','));
const out = { checks: [] };
const noAt = r => { const { at, ...rest } = r || {}; return rest; };       // a read's clock time, left out of the record
const check = (name, ok, detail) => { out.checks.push({ name, ok: !!ok, detail }); if (!ok) throw new Error(`${name}: ${JSON.stringify(detail)}`); console.log('ok  ', name); };

server.listen(0, '127.0.0.1', async () => {
  try {
    /* 1. --dry */
    const dry = await run('2023-10-24', '2023-10-27', '--dry');
    check('--dry makes no request', state.requests.length === 0, { requests: state.requests.length });
    check('--dry writes nothing', !fs.existsSync(cache), { cache: fs.existsSync(cache) });
    check('--dry lists the four games with ESPN ids', /^4 games/.test(dry), dry.split('\n')[0]);
    /* 2. a first run */
    await run('2023-10-24', '2023-10-25');
    const t1 = csvOf(), r1 = rowsOf(t1);
    check('a run writes the record\'s columns and last_updated', t1.split('\n')[0] === 'game_id,player_id,stat,line,over,under,last_updated', t1.split('\n')[0]);
    check('two games, four main lines each, turnovers left out', r1.length === 8 && new Set(r1.map(r => r[0])).size === 2 && r1.every(r => r[2] === 'pts' || r[2] === 'reb'), r1.length);
    check('the first item is the Over', r1.filter(r => r[2] === 'pts').every(r => r[4] === '-115' && r[5] === '-105'), r1.slice(0, 2));
    check('last_updated is the later of the pair', r1.filter(r => r[0] === G[0][0] && r[2] === 'pts').every(r => r[6] === '2023-10-25T01:30Z') && r1.filter(r => r[0] === G[0][0] && r[2] === 'reb').every(r => r[6] === '2023-10-25T01:00Z'), r1.filter(r => r[0] === G[0][0]));
    const reads1 = JSON.parse(fs.readFileSync(path.join(cache, 'props40_reads.json'), 'utf8'));
    check('each read keeps the event\'s start', reads1[G[0][0]].start === '2023-10-25T23:00Z' && reads1[G[0][0]].status === 'ok' && reads1[G[0][0]].lines === 4, noAt(reads1[G[0][0]]));
    /* 3. an overlapping range, then the same range again */
    await run('2023-10-25', '2023-10-27');
    const t2 = csvOf(), r2 = rowsOf(t2), keys = r2.map(r => r.slice(0, 3).join('|'));
    check('an overlapping range repeats no line', keys.length === new Set(keys).size, { rows: keys.length, unique: new Set(keys).size });
    check('four games, sixteen lines, in game order', r2.length === 16 && new Set(r2.map(r => r[0])).size === 4 && r2.map(r => r[0]).join() === [...r2.map(r => r[0])].sort().join(), r2.length);
    await run('2023-10-24', '2023-10-27');
    check('the same range again leaves the file the same to the byte', csvOf() === t2, { before: t2.length, after: csvOf().length });
    /* 4. a game read again replaces its lines; a read that fails keeps the earlier one */
    state.shift = 1; state.fail.add('903');
    await run('2023-10-25', '2023-10-26');
    const r3 = rowsOf(csvOf()), reads3 = JSON.parse(fs.readFileSync(path.join(cache, 'props40_reads.json'), 'utf8'));
    const g2 = r3.filter(r => r[0] === G[1][0]), g3 = r3.filter(r => r[0] === G[2][0]);
    check('a game read again replaces its lines', g2.length === 4 && g2.some(r => r[2] === 'pts' && r[3] === '21.5'), g2);
    check('a game whose new read fails keeps its earlier lines and read', g3.length === 4 && g3.some(r => r[2] === 'pts' && r[3] === '20.5') && reads3[G[2][0]].status === 'ok', { rows: g3.length, read: noAt(reads3[G[2][0]]) });
    check('still no line repeated', r3.length === 16 && new Set(r3.map(r => r.slice(0, 3).join('|'))).size === 16, r3.length);
    check('no temporary file left behind', !fs.readdirSync(cache).some(f => f.endsWith('.tmp')), fs.readdirSync(cache));
    check('every request went to the local fake', state.requests.every(u => u.startsWith('/events/')), state.requests.length);
    out.requests = state.requests.length;
    fs.writeFileSync(path.join(__dirname, 'results', 'fetch_dk40_test.json'), JSON.stringify({ what: 'research/props_v2/fetch_dk40_test.js: fetch_dk40.js on a local fake of the feed (no network)', ...out }, null, 1) + '\n');
    console.log(`all ${out.checks.length} checks passed (${out.requests} requests, all to the local fake)`);
  } catch (e) { console.error('FAILED', e.message); process.exitCode = 1; }
  finally { server.close(); fs.rmSync(tmp, { recursive: true, force: true }); }
});
