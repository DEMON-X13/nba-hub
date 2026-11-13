/* The one-shot test's machinery, held to planted cases (PLAN.md D9; the review of 13 November 2026, findings F1, F3 and
 * F4). Research only: it reads no 2022-23 prop line (every line it feeds the scorer's pieces is made up here), and every
 * git operation runs in a sandbox repository of its own with a local bare repository as its origin, never this one's.
 *
 *   node research/props_v3/test/machinery_check.js   -> research/props_v3/results/ma_machinery_check.json (seconds)
 *
 *   A. The 31 left-out games (F1): test/score.js's leftOut gives back test/seen_2023.json's 31 from espn_validate40.json's
 *      games[].gid (as first written, Object.keys of that array, which gave 0, is shown beside); testLines, fed made-up
 *      rows (one for each of the 31, three for other regular-season games of the window, one for a play-in game and one
 *      for a game of 2023-24), keeps the three alone and counts the 31 left out.
 *   B. The fetch's gate and record (F3), the real wrapper, record tool and cleaner copied into the sandbox, with a
 *      stand-in for fetch_dk40.js that requests nothing and writes made-up rows: refused with no preregistration, with one
 *      not pushed, with an audit naming no hashes, and with a PREREG.md edited after its audit; run once with a sound one
 *      (the start on origin before the stand-in runs, the finished record after, with the clean lines' SHA-256);
 *      refused a second time, and again after the cache is wiped; a lost cache recovered with PROPS_V3_RECOVER=1 when the
 *      lines come out byte for byte, refused when they do not; an interrupted fetch resumed under the same
 *      preregistration; another preregistration refused; the cleaner refused with no record.
 *   C. V-hash (F4), test/score.js's vHash on the sandbox (a required() of its own over two files), against the rule it
 *      replaced (score.js as first written, its lines run beside): it passes the sound case, and refuses where the old
 *      rule passed: the frozen file edited with the working tree's PREREG_HASHES.json rewritten to match; the clean lines
 *      replaced with a sibling .sha256 written to match; a PREREG_HASHES.json naming nothing; and it refuses the fetched
 *      csv moved under clean lines left as they were, and a record not finished.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { execFileSync, spawnSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const SC = require('./score.js');
const M = require('../ma/ma_lib.js');
const sha256 = b => crypto.createHash('sha256').update(b).digest('hex');
const out = { what: "the one-shot test's machinery held to planted cases (made-up lines; sandbox repositories)", A: { cases: [] }, B: [], C: [] };
/* a case's words, its commit ids and times masked, so the result file is the same on every run */
const mask = t => (t == null ? t : String(t).replace(/\b[0-9a-f]{7,40}\b/g, '<commit>').replace(/\d{4}-\d\d-\d\dT[\d:.]+Z/g, '<time>'));
const expect = (arr, name, ok, detail) => { arr.push({ case: name, asExpected: !!ok, detail: mask(detail) }); console.log(`${ok ? 'ok  ' : 'FAIL'} ${name}${detail ? `: ${detail}` : ''}`); };

/* ---------- A. the left-out games ---------- */
{
  const games = M.gamesOf(path.join(ROOT, 'data', 'games.csv')), gamesById = new Map(games.map(g => [g.game_id, g]));
  const J = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v2', 'results', 'espn_validate40.json'), 'utf8'));
  const asFirstWritten = new Set(Object.keys(J.games).filter(k => /^2023_/.test(k)).filter(k => (gamesById.get(k) || {}).type === 'REG'));
  const seen = SC.leftOut(gamesById), listed = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v3', 'test', 'seen_2023.json'), 'utf8')).ids;
  out.A.asFirstWritten = asFirstWritten.size; out.A.leftOut = seen.size;
  expect(out.A.cases, 'A1 the left-out games read by gid are the committed 31 (as first written: Object.keys gave ' + asFirstWritten.size + ')', seen.size === 31 && listed.every(k => seen.has(k)) && asFirstWritten.size === 0);
  const others = games.filter(g => g.season === 2023 && g.type === 'REG' && g.date >= SC.WINDOW[0] && g.date <= SC.WINDOW[1] && !seen.has(g.game_id)).slice(0, 3).map(g => g.game_id);
  const playIn = games.find(g => g.season === 2023 && g.date > SC.WINDOW[1]), later = games.find(g => g.season === 2024 && g.type === 'REG');
  const row = gid => [gid, '9999999', 'pts', '10.5', '-110', '-110'];
  const raw = [...listed.map(row), ...others.map(row), row(playIn.game_id), row(later.game_id)];
  const tl = SC.testLines(raw, gamesById, seen);
  out.A.planted = { rows: raw.length, kept: tl.lines.length, leftOut: tl.leftOut };
  expect(out.A.cases, 'A2 testLines keeps the three other games\' made-up rows alone and counts the 31 left out', tl.lines.length === 3 && tl.lines.every(l => others.includes(l.game)) && tl.leftOut.games === 31 && tl.leftOut.gamesInFetch === 31 && tl.leftOut.lines === 31);
  const tlOld = SC.testLines(raw, gamesById, asFirstWritten);
  expect(out.A.cases, 'A3 with the set as first written the 31 games\' rows would have been scored', tlOld.lines.length === 34);
}

/* ---------- the sandbox ---------- */
const BRANCH = 'wip/test';
const STUB = `'use strict';
/* a stand-in for fetch_dk40.js: requests nothing; writes made-up rows by STUB_MODE; logs that it ran and whether origin
   already held the fetch's start */
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..', '..'), C = path.join(ROOT, 'research', 'props_v2', 'cache'); fs.mkdirSync(C, { recursive: true });
execFileSync('git', ['fetch', '--quiet', 'origin'], { cwd: ROOT });
const onOrigin = execFileSync('git', ['log', '--remotes=origin', '--format=%H', '--', 'research/props_v3/test/fetch_2023.json'], { cwd: ROOT, encoding: 'utf8' }).trim().split('\\n').filter(Boolean).length;
fs.appendFileSync(path.join(ROOT, 'stub_runs.log'), JSON.stringify({ mode: process.env.STUB_MODE || 'ok', recordsOnOrigin: onOrigin }) + '\\n');
const price = process.env.STUB_MODE === 'other' ? '-115' : '-110';
const rows = ['game_id,player_id,stat,line,over,under,last_updated', '2023_20221018_PHI_BOS,1,pts,20.5,' + price + ',-110,2022-10-18T22:00:00Z', '2023_20221018_LAL_GSW,2,reb,7.5,-110,-110,2022-10-18T23:00:00Z'];
if (process.env.STUB_MODE === 'fail') { fs.writeFileSync(path.join(C, 'props40_2023.csv'), rows.slice(0, 2).join('\\n') + '\\n'); process.exit(1); }
fs.writeFileSync(path.join(C, 'props40_2023.csv'), rows.join('\\n') + '\\n');
fs.writeFileSync(path.join(C, 'props40_reads.json'), JSON.stringify({ '2023_20221018_PHI_BOS': { start: '2022-10-18T23:30Z' }, '2023_20221018_LAL_GSW': { start: '2022-10-19T02:00Z' } }));
console.log('stand-in: 2 rows');
`;
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v3-machinery-'));
function sandbox(name) {
  const base = path.join(TMP, name), origin = path.join(base, 'origin.git'), work = path.join(base, 'work');
  fs.mkdirSync(base, { recursive: true });
  const g = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
  g(base, 'init', '--quiet', '--bare', origin); fs.mkdirSync(work); g(work, 'init', '--quiet'); g(work, 'config', 'user.name', 'sandbox'); g(work, 'config', 'user.email', 'sandbox@example.invalid');
  g(work, 'remote', 'add', 'origin', origin);
  for (const f of ['research/props_v3/test/fetch_dk40_2023_logged.sh', 'research/props_v3/test/fetch_record.js', 'research/props_v3/test/lines_clean_2023.js']) { fs.mkdirSync(path.join(work, path.dirname(f)), { recursive: true }); fs.copyFileSync(path.join(ROOT, f), path.join(work, f)); }
  fs.mkdirSync(path.join(work, 'research', 'props_v2'), { recursive: true }); fs.writeFileSync(path.join(work, 'research', 'props_v2', 'fetch_dk40.js'), STUB);
  fs.writeFileSync(path.join(work, '.gitignore'), 'research/props_v3/cache/\nresearch/props_v2/cache/\nstub_runs.log\n');
  fs.mkdirSync(path.join(work, 'research', 'props_v3', 'frozen'), { recursive: true }); fs.writeFileSync(path.join(work, 'research', 'props_v3', 'frozen', 'ma_frozen.json'), '{"w":[1,2,3]}\n');
  fs.mkdirSync(path.join(work, 'research', 'props_v3', 'ma'), { recursive: true }); fs.writeFileSync(path.join(work, 'research', 'props_v3', 'ma', 'code.js'), '// the code\n');
  g(work, 'add', '-A'); g(work, 'commit', '--quiet', '-m', 'init'); g(work, 'push', '--quiet', 'origin', `HEAD:refs/heads/${BRANCH}`);
  return { work, g: (...a) => g(work, ...a) };
}
const reqOf = work => () => Object.fromEntries(['research/props_v3/frozen/ma_frozen.json', 'research/props_v3/ma/code.js'].map(f => [f, sha256(fs.readFileSync(path.join(work, f)))]));
/* a preregistration commit: PREREG.md, PREREG_HASHES.json and an audit; hashes: name the audited files' SHA-256 */
function prereg(sb, text, { hashes = true, files = null, push = true } = {}) {
  const d = path.join(sb.work, 'research', 'props_v3');
  fs.writeFileSync(path.join(d, 'PREREG.md'), text);
  fs.writeFileSync(path.join(d, 'PREREG_HASHES.json'), JSON.stringify({ files: files || reqOf(sb.work)() }, null, 1) + '\n');
  const audit = ['# audit', 'verdict: sound'];
  if (hashes) audit.push(`audited PREREG.md sha256 ${sha256(fs.readFileSync(path.join(d, 'PREREG.md')))}`, `audited PREREG_HASHES.json sha256 ${sha256(fs.readFileSync(path.join(d, 'PREREG_HASHES.json')))}`);
  fs.writeFileSync(path.join(d, 'PREREG_AUDIT.md'), audit.join('\n') + '\n');
  sb.g('add', '-A'); sb.g('commit', '--quiet', '-m', 'prereg');
  if (push) sb.g('push', '--quiet', 'origin', `HEAD:refs/heads/${BRANCH}`);
  return sb.g('rev-parse', 'HEAD').trim();
}
function wrapper(sb, sha, extra = {}) {
  const env = { ...process.env, PROPS_V3_PREREG: sha || '', PROPS_V3_BRANCH: BRANCH, STUB_MODE: 'ok', ...extra };
  if (!sha) delete env.PROPS_V3_PREREG;
  const r = spawnSync('bash', [path.join(sb.work, 'research', 'props_v3', 'test', 'fetch_dk40_2023_logged.sh')], { cwd: sb.work, env, encoding: 'utf8' });
  return { code: r.status, err: (r.stderr || '').trim().split('\n').filter(Boolean).pop() || '', outText: r.stdout || '' };
}
const runs = sb => { const f = path.join(sb.work, 'stub_runs.log'); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map(l => JSON.parse(l)) : []; };
const versions = sb => require(path.join(sb.work, 'research', 'props_v3', 'test', 'fetch_record.js')).recordVersions(sb.work);
const wipe = sb => { for (const d of ['research/props_v3/cache', 'research/props_v2/cache']) fs.rmSync(path.join(sb.work, d), { recursive: true, force: true }); };

/* ---------- B. the gate and the record ---------- */
const B = out.B;
const s1 = sandbox('s1');
{ const r = wrapper(s1, null); expect(B, 'B1 no preregistration commit: refused', r.code !== 0 && /no preregistration/.test(r.err) && runs(s1).length === 0, r.err); }
{ const sha = prereg(s1, 'v0\n', { push: false }); const r = wrapper(s1, sha); expect(B, 'B2 a preregistration not pushed: refused', r.code !== 0 && /not on origin/.test(r.err) && runs(s1).length === 0, r.err); }
{ const sha = prereg(s1, 'v1\n', { hashes: false }); const r = wrapper(s1, sha); expect(B, 'B3 an audit naming no hashes: refused', r.code !== 0 && /does not name the SHA-256/.test(r.err) && runs(s1).length === 0, r.err); }
let good;
{ prereg(s1, 'v2\n'); fs.writeFileSync(path.join(s1.work, 'research', 'props_v3', 'PREREG.md'), 'v2, edited after the audit\n'); s1.g('add', '-A'); s1.g('commit', '--quiet', '-m', 'prereg edited after its audit'); s1.g('push', '--quiet', 'origin', `HEAD:refs/heads/${BRANCH}`);
  const sha = s1.g('rev-parse', 'HEAD').trim(), r = wrapper(s1, sha);
  expect(B, 'B4 PREREG.md edited after its audit (the review\'s case): refused', r.code !== 0 && /edited after the audit/.test(r.err) && runs(s1).length === 0, r.err); }
{ good = prereg(s1, 'v3: the sound one\n'); const r = wrapper(s1, good), v = versions(s1), ru = runs(s1);
  const fin = v.length && v[v.length - 1].rec.finished, lines = path.join(s1.work, 'research', 'props_v3', 'cache', 'dk40_2023_lines.csv');
  expect(B, 'B5 a sound preregistration: the start pushed before the stand-in ran, then the record finished on origin with the clean lines\' SHA-256',
    r.code === 0 && ru.length === 1 && ru[0].recordsOnOrigin === 1 && v.length === 2 && !!fin && v[1].rec.sha256['research/props_v3/cache/dk40_2023_lines.csv'] === sha256(fs.readFileSync(lines)), `exit ${r.code}; runs ${ru.length}, records on origin when the stand-in ran ${ru[0] && ru[0].recordsOnOrigin}; versions ${v.length}`); }
{ const r = wrapper(s1, good); expect(B, 'B6 a second run (the review\'s case): refused by origin\'s record', r.code !== 0 && /has run already/.test(r.err) && runs(s1).length === 1, r.err); }
{ wipe(s1); const r = wrapper(s1, good); expect(B, 'B7 the cache wiped, then run again (the review\'s case): still refused', r.code !== 0 && /has run already/.test(r.err) && runs(s1).length === 1, r.err); }
/* C (V-hash) on the sound run, before the recovery cases change its cache */
const C = out.C;
{ const r = wrapper(s1, good, { PROPS_V3_RECOVER: '1' }), v = versions(s1);
  expect(B, 'B8 the lost cache recovered with PROPS_V3_RECOVER=1, its clean lines byte for byte: the recovery appended to the record', r.code === 0 && runs(s1).length === 2 && v.length === 3 && (v[2].rec.recovered || []).length === 1, `exit ${r.code}`); }
const csvF = sb => path.join(sb.work, 'research', 'props_v2', 'cache', 'props40_2023.csv'), linesF = sb => path.join(sb.work, 'research', 'props_v3', 'cache', 'dk40_2023_lines.csv');
const vh = (sb, sha) => { try { return { ok: true, r: SC.vHash({ root: sb.work, prereg: sha, required: reqOf(sb.work), cache: path.join(sb.work, 'research', 'props_v3', 'cache'), csv: csvF(sb) }) }; } catch (e) { return { ok: false, err: e.message }; } };
/* score.js's V-hash as first written (its lines 93-102), on the sandbox: the working tree's PREREG_HASHES.json, the lines
   against a sibling .sha256 in the cache */
const vhOld = sb => { const H = JSON.parse(fs.readFileSync(path.join(sb.work, 'research', 'props_v3', 'PREREG_HASHES.json'), 'utf8')), bad = Object.entries(H.files).filter(([f, h]) => sha256(fs.readFileSync(path.join(sb.work, f))) !== h).map(([f]) => f);
  const cs = path.join(sb.work, 'research', 'props_v3', 'cache', 'dk40_2023_lines.sha256'); if (!fs.existsSync(cs)) return false; const CS = JSON.parse(fs.readFileSync(cs, 'utf8'));
  if (sha256(fs.readFileSync(linesF(sb))) !== CS['dk40_2023_lines.csv']) bad.push('lines'); return bad.length === 0; };
const sibling = sb => fs.writeFileSync(path.join(sb.work, 'research', 'props_v3', 'cache', 'dk40_2023_lines.sha256'), JSON.stringify({ 'dk40_2023_lines.csv': sha256(fs.readFileSync(linesF(sb))) }));
{ sibling(s1); const a = vh(s1, good); expect(C, 'C1 the sound case: V-hash passes (and so did the rule as first written)', a.ok && vhOld(s1), a.err || `${a.r.inputs} inputs, record ${a.r.record.slice(0, 8)}`); }
{ const fz = path.join(s1.work, 'research', 'props_v3', 'frozen', 'ma_frozen.json'), hz = path.join(s1.work, 'research', 'props_v3', 'PREREG_HASHES.json'), keepF = fs.readFileSync(fz), keepH = fs.readFileSync(hz);
  fs.writeFileSync(fz, '{"w":[9,9,9]}\n'); fs.writeFileSync(hz, JSON.stringify({ files: reqOf(s1.work)() }, null, 1) + '\n');
  const a = vh(s1, good), old = vhOld(s1);
  expect(C, 'C2 the frozen file edited, the working tree\'s PREREG_HASHES.json rewritten to match (the review\'s case): refused; the old rule passed it', !a.ok && /not as the preregistration recorded/.test(a.err) && old, a.err);
  fs.writeFileSync(fz, keepF); fs.writeFileSync(hz, keepH); }
{ const lf = linesF(s1), keep = fs.readFileSync(lf); fs.writeFileSync(lf, keep.toString().replace('20.5', '21.5')); sibling(s1);
  const a = vh(s1, good), old = vhOld(s1);
  expect(C, 'C3 the clean lines replaced, a sibling .sha256 written to match (the review\'s case): refused; the old rule passed it', !a.ok && /clean lines are not the ones/.test(a.err) && old, a.err);
  fs.writeFileSync(lf, keep); sibling(s1); }
{ const d = path.join(s1.work, 'research', 'props_v3'), keepH = fs.readFileSync(path.join(d, 'PREREG_HASHES.json')); fs.writeFileSync(path.join(d, 'PREREG_HASHES.json'), '{"files":{}}\n'); s1.g('add', '-A'); s1.g('commit', '--quiet', '-m', 'empty hashes');
  const emptySha = s1.g('rev-parse', 'HEAD').trim(), a = vh(s1, emptySha), old = vhOld(s1);
  expect(C, 'C4 a PREREG_HASHES.json naming nothing (the review\'s case): refused; the old rule passed it', !a.ok && /does not name 2 required/.test(a.err) && old, a.err);
  fs.writeFileSync(path.join(d, 'PREREG_HASHES.json'), keepH); s1.g('add', '-A'); s1.g('commit', '--quiet', '-m', 'hashes back'); }
{ const cf = csvF(s1), keep = fs.readFileSync(cf); fs.writeFileSync(cf, keep.toString().replace('-110,2022-10-18T23', '-105,2022-10-18T23'));
  const a = vh(s1, good); expect(C, 'C5 the fetched csv moved under clean lines left as they were: refused', !a.ok && /cut to its six columns/.test(a.err), a.err); fs.writeFileSync(cf, keep); }
{ const r = wrapper(s1, good, { PROPS_V3_RECOVER: '1', STUB_MODE: 'other' }), v = versions(s1);
  expect(B, 'B9 a recovery whose lines differ from the record\'s: refused at the finish, the record unchanged', r.code !== 0 && /not the one the fetch recorded/.test(r.err) && v.length === 3, r.err); }
{ const other = prereg(s1, 'v4: another preregistration\n'); const r = wrapper(s1, other); expect(B, 'B10 another preregistration, origin holding this one\'s record: refused', r.code !== 0 && /another preregistration/.test(r.err), r.err); }
const s2 = sandbox('s2');
{ const sha = prereg(s2, 'v1: sound\n'); fs.mkdirSync(path.join(s2.work, 'research', 'props_v2', 'cache'), { recursive: true });
  const cl = spawnSync('node', [path.join(s2.work, 'research', 'props_v3', 'test', 'lines_clean_2023.js')], { cwd: s2.work, env: { ...process.env, PROPS_V3_PREREG: sha, PROPS_V3_BRANCH: BRANCH }, encoding: 'utf8' });
  expect(B, 'B11 the cleaner with no record on origin: refused', cl.status !== 0 && /no record of the 2022-23 fetch/.test(cl.stderr), (cl.stderr || '').split('\n').find(l => /^Error: refused/.test(l)));
  const r1 = wrapper(s2, sha, { STUB_MODE: 'fail' }), v1 = versions(s2);
  expect(B, 'B12 a fetch interrupted after its start: the start on origin, not finished', r1.code !== 0 && v1.length === 1 && !v1[0].rec.finished, `exit ${r1.code}`);
  const a = vh(s2, sha); expect(C, 'C6 V-hash with the record not finished: refused', !a.ok && /not finished/.test(a.err), a.err);
  const r2 = wrapper(s2, sha), v2 = versions(s2);
  expect(B, 'B13 run again under the same preregistration: resumed, then finished', r2.code === 0 && /resuming/.test(r2.outText) && runs(s2).length === 2 && v2.length === 2 && !!v2[1].rec.finished, `exit ${r2.code}`); }
fs.rmSync(TMP, { recursive: true, force: true });
out.met = [...out.A.cases, ...out.B, ...out.C].every(c => c.asExpected);
fs.writeFileSync(path.join(ROOT, 'research', 'props_v3', 'results', 'ma_machinery_check.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`machinery: ${[...out.A.cases, ...out.B, ...out.C].filter(c => c.asExpected).length} of ${[...out.A.cases, ...out.B, ...out.C].length} cases as expected: ${out.met ? 'met' : 'NOT met'}`);
