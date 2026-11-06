/* The test of test2024.js, on made-up lines. Nothing of the real cache is read: every file is in a temporary folder, and
 * the scorer is pointed at it by TEST2024_CACHE and TEST2024_OUT, which the real run never sets. The lines are made up,
 * hung on real 2023-24 games and players so that the box scores grade them; no price in them is DraftKings'.
 *   1. the reader: the fetch's columns or a throw; a row of the wrong shape throws; two rows for one game, player and
 *      stat throw (the fetch writes one, so a second means a broken cache); a price missing or not a price reads as none;
 *   2. the selection, on a made-up schedule: 24 October 2023 and 14 April 2024 kept; 23 October, 15 April, the play-in,
 *      a preseason game (one of them dated inside the window), a playoff game and a game off the schedule left out;
 *      turnovers and a combo left out; a row missing one price or both left out;
 *   3. the grading, on real games: a player who did not play and one the box does not list are void, a debut with no
 *      game on record has no call, a line equal to the stat is a push, every other line graded, the same by both models;
 *      the 2023-24 rows held to the published walk-forward, which a 2023-24 row changed (its points) or a raw box score
 *      changed (one steal, on a player with no later season) fails;
 *   4. the verdict on planted figures: an interval touching zero (0, -0, a hair above) is not wholly below it, units of
 *      exactly zero are not up, and PASS only with all three; the figures before their rounding, reported beside it;
 *   5. V1 counted in whole lines (80,746 of 85,000 is not 95%, though validity.js's four places read it so); the
 *      fetch's coverage (a game never read, a failed read, a read of no known status, a game whose rows are not its
 *      read's count, the owner's list); the validity check's count of lines; the fixture door (links to results/ or
 *      into the study folder, a fixture file linked out of its folder); FROZEN against everything the scorer loads;
 *   6. the validity check (VOID read as VOID, never refused; a verdict that is not its checks'; other thresholds; no
 *      SHA-256 of what it read; lines that are not the bytes it read), the result decided once (a whole result, one
 *      that is not whole, a part left by a run cut off), the result written once (a write that fails, two keeps, a
 *      part already there), and the two settings misused, each refusal in a run of its own where it comes before the
 *      reproduction;
 *   7. the run end to end on the made-up lines (its reproduction included): the counts, the coverage and the owner's
 *      list, the phrase "pre-game inferred, not shown", the verdict its own figures give, what is reported beside it,
 *      the hashes, a result of aggregates only; then a VOID check end to end, recorded as the outcome with no score,
 *      and every later run refused.
 *
 *   node research/props_v2/test2024_test.js            writes results/test2024_test.json (about two minutes)
 *   node research/props_v2/test2024_test.js --plants   the same, then each planted break: test2024.js with one rule
 *                                                      broken, copied beside it for the run and deleted after, must fail
 *                                                      the check here that holds that rule, and with one rule of its
 *                                                      reproduction broken, its own --check must stop (about forty
 *                                                      minutes)
 *   (--fast leaves out step 7; --script <file> tests another copy of the scorer: both are for --plants; --only <text>
 *   runs only the planted breaks whose name holds that text, and writes no result file)
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const crypto = require('crypto');
const { spawnSync } = require('child_process');
const PR = require('../../tools/props.js');
const C = require('./cand_fix_lib.js');
const V = require('./validity_lib.js');

const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const SCRIPT = path.resolve(arg('--script') || path.join(__dirname, 'test2024.js'));
const FAST = process.argv.includes('--fast'), PLANTS = process.argv.includes('--plants'), ONLY = arg('--only');
const T = require(SCRIPT);
const OUTD = path.join(__dirname, 'results');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v2-test2024-'));
const out = { checks: [] };
const check = (name, ok, detail) => { out.checks.push({ name, ok: !!ok }); if (!ok) throw new Error(`${name} [detail ${JSON.stringify(detail)}]`); console.log('ok  ', name); };
const throws = (f, re) => { try { f(); return false; } catch (e) { return re.test(e.message); } };
const refusal = f => { try { f(); return null; } catch (e) { return e instanceof T.Refusal ? e.message : `not a refusal: ${e.message}`; } };
const COLS = 'game_id,player_id,stat,line,over,under,last_updated';
const csvOf = rows => [COLS, ...rows.map(r => r.join(','))].join('\n') + '\n';
const sha = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');

function run() {
  /* 1. the reader */
  const f1 = path.join(tmp, 'r1.csv');
  fs.writeFileSync(f1, csvOf([['g1', 'p1', 'pts', 20.5, -115, -105, '2023-10-25T01:00Z'], ['g1', 'p1', 'reb', 6.5, '', 120, ''], ['g1', 'p2', 'pts', 9.5, 'OFF', 99, '']]));
  const r1 = T.readLines(f1);
  check('the reader reads the fetch\'s columns', r1.length === 3 && r1[0].line === 20.5 && r1[0].over === -115 && r1[0].under === -105 && r1[0].lu === '2023-10-25T01:00Z' && JSON.stringify(T.readLinesText(fs.readFileSync(f1, 'utf8'), 'r1.csv')) === JSON.stringify(r1), r1[0]);
  check('a price missing, OFF or under 100 reads as none', r1[1].over === null && r1[1].under === 120 && r1[2].over === null && r1[2].under === null, [r1[1], r1[2]]);
  fs.writeFileSync(f1, 'game_id,player_id,stat,line,over,under\ng1,p1,pts,20.5,-115,-105\n');
  check('another header throws', throws(() => T.readLines(f1), /columns/), null);
  fs.writeFileSync(f1, csvOf([['g1', 'p1', 'pts', 20.5, -115, -105]]));
  check('a row of the wrong shape throws', throws(() => T.readLines(f1), /fields/), null);
  fs.writeFileSync(f1, csvOf([['g1', 'p1', 'pts', 20.5, -115, -105, ''], ['g1', 'p1', 'reb', 6.5, -110, -110, ''], ['g1', 'p1', 'pts', 21.5, -110, -110, '']]));
  check('two rows for one game, player and stat throw', throws(() => T.readLines(f1), /repeats a game, player and stat/), null);

  /* 2. the selection, on a made-up schedule */
  const sch = [['2024_20231024_AAA_BBB', 'REG', '2023-10-24'], ['2024_20240414_CCC_DDD', 'REG', '2024-04-14'], ['2024_20231023_EEE_FFF', 'REG', '2023-10-23'],
    ['2024_20240415_GGG_HHH', 'REG', '2024-04-15'], ['2024_20240416_III_JJJ', 'REG', '2024-04-16'], ['2024_20231019_KKK_LLL', 'PRE', '2023-10-19'], ['2024_20240420_MMM_NNN', 'POST', '2024-04-20'], ['2024_20231201_QQQ_RRR', 'PRE', '2023-12-01']];
  const gameOf = new Map(sch.map(([game_id, type, date]) => [game_id, { game_id, type, date, season: 2024 }]));
  const L = (g, p, s, o = -110, u = -110) => ({ game_id: g, player_id: p, stat: s, line: 10.5, over: o, under: u, lu: null });
  const rows2 = [L(sch[0][0], 'a', 'pts'), L(sch[0][0], 'a', 'tpm'), L(sch[1][0], 'b', 'blk'), L(sch[1][0], 'b', 'stl'), L(sch[0][0], 'a', 'tov'), L(sch[0][0], 'a', 'pra'),
    L(sch[0][0], 'c', 'reb', null, -110), L(sch[1][0], 'c', 'ast', -110, null), L(sch[1][0], 'd', 'ast', null, null), L(sch[2][0], 'e', 'pts'), L(sch[3][0], 'e', 'pts'), L(sch[4][0], 'e', 'pts'),
    L(sch[5][0], 'e', 'pts'), L(sch[6][0], 'e', 'pts'), L(sch[7][0], 'e', 'pts'), L('2024_20231101_OOO_PPP', 'e', 'pts')];
  const s2 = T.selectLines(rows2, gameOf, T.WINDOW);
  check('the window\'s first and last days kept, on the six base stats with both prices', s2.lines.map(l => l.game_id + ':' + l.stat).join() === `${sch[0][0]}:pts,${sch[0][0]}:tpm,${sch[1][0]}:blk,${sch[1][0]}:stl`, s2.lines.map(l => l.game_id + ':' + l.stat));
  check('23 October, 15 April and the play-in left out', s2.dropped.outsideWindow === 3, s2.dropped);
  check('a preseason game (one dated inside the window too) and a playoff game left out', s2.dropped.notRegularSeason === 3, s2.dropped);
  check('a game off the schedule left out', s2.dropped.notOnSchedule === 1, s2.dropped);
  check('turnovers and a combo left out', s2.dropped.notBaseStat === 2, s2.dropped);
  check('a row missing a price, either or both, left out', s2.dropped.noPrice === 3, s2.dropped);
  check('the window is the bar\'s', T.WINDOW.type === 'REG' && T.WINDOW.from === '2023-10-24' && T.WINDOW.to === '2024-04-14' && JSON.stringify(T.WINDOW.stats) === JSON.stringify(V.BASE), T.WINDOW);

  /* 3. the grading, on real 2023-24 games with made-up lines */
  const W = T.loadWorld();
  const fx = fixture(W);
  const S = JSON.parse(fs.readFileSync(path.join(OUTD, 'cand_fix_score.json'), 'utf8')), foldP = JSON.parse(fs.readFileSync(path.join(OUTD, 'fold_params.json'), 'utf8'));
  const sel = T.selectLines(fx.lines.map(r => ({ game_id: r[0], player_id: r[1], stat: r[2], line: r[3], over: +r[4] || null, under: +r[5] || null, lu: null })), W.gameOf, T.WINDOW);
  const ab = T.gradeLines(sel.lines, W.rows, W.sides, foldP['2024'], {}, W.D.boxes), ac = T.gradeLines(sel.lines, W.rows, W.sides, S.folds['2024'].P, S.folds['2024'].X, W.D.boxes);
  check('a player who did not play, and one the box does not list, are void', ab.voids === 2 && ac.voids === 2, { voids: ab.voids });
  check('a debut with no game on record has no call', ab.noCall === 1 && ac.noCall === 1, { noCall: ab.noCall });
  check('a line equal to the stat is a push, left out', ab.pushes === 1 && ab.lines.every(x => x.result !== 'push'), { pushes: ab.pushes });
  check('every other line graded, by both models alike', ab.lines.length === fx.graded && ac.lines.length === fx.graded && ab.lines.every((x, i) => x.game === ac.lines[i].game && x.stat === ac.lines[i].stat && x.line === ac.lines[i].line), { graded: ab.lines.length, want: fx.graded });
  check('each graded line knows its row (V1 reads its stamp)', ab.src.length === ab.lines.length && ab.src.every((j, i) => sel.lines[j].game_id === ab.lines[i].game && sel.lines[j].stat === ab.lines[i].stat && sel.lines[j].line === ab.lines[i].line), { src: ab.src.length });
  check('the two models differ on the lines (A is not tools/props.js)', ab.lines.some((x, i) => x.pModel !== ac.lines[i].pModel), null);
  { const P24 = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'props.json'), 'utf8')).folds.find(f => f.season === 2024).params;
    const own = PR.project(W.rows, P24, r => r.season === 2024 && r.date <= '2024-04-14'), at = new Map([...own].map(([i, x]) => [W.rows[i].game + '|' + W.rows[i].id, { x, r: W.rows[i] }]));
    /* the graded lines in order: a projected player (so he played and has a game on record), not a push */
    const want = sel.lines.filter(l => { const a = at.get(l.game_id + '|' + l.player_id); return a && PR.yOf(a.r.y, l.stat) !== l.line; })
      .map(l => { const mu = at.get(l.game_id + '|' + l.player_id).x.mu[l.stat]; return { mu, p: PR.pOver(l.line, mu, PR.nbVar(mu, P24.var[l.stat])) }; });
    check('tools/props.js\'s chance is its own project()\'s on research/props.json\'s 2024 fold', want.length === ab.lines.length && ab.lines.every((x, i) => x.mu === want[i].mu && x.pModel === want[i].p), { want: want.length, graded: ab.lines.length }); }
  check('DraftKings\' fair chance is the whole margin on the Over', ab.lines.every(x => Math.abs(x.pMarket - (1 - (x.under > 0 ? 100 / (x.under + 100) : -x.under / (-x.under + 100)))) < 1e-12), null);
  /* the 2023-24 rows held to the published walk-forward: the rows as they are pass; one row's points moved, or one steal
     added to a raw box score of a player with no game after 2023-24 (so the 2026 archive cannot see it), fail. The raw
     box score is planted and replayed in a process of its own (two replays at once outgrow the default heap) */
  { const held = T.walkForward2024(W, S, foldP);
    const i = W.rows.findIndex(r => r.season === 2024 && r.played && r.game === '2024_20240119_PHI_ORL' && r.min > 20);
    const rowsA = W.rows.slice(); rowsA[i] = { ...W.rows[i], y: { ...W.rows[i].y, pts: W.rows[i].y.pts + 7 } };
    const raw = spawnSync(process.execPath, ['-e', RAW_PLANT, SCRIPT], { env: clean(process.env), encoding: 'utf8', timeout: 120000 });
    const said = (() => { try { return JSON.parse((raw.stdout || '').trim().split('\n').pop()); } catch (e) { return { said: (raw.stderr || '').slice(-300) }; } })();
    check('a 2023-24 row changed (its points, or one steal in a raw box score) fails the walk-forward', held.sameAsCandFixScore === true && i >= 0
      && throws(() => T.walkForward2024({ ...W, rows: rowsA }, S, foldP), /walk-forward/) && said.who && said.cleanPasses === true && said.plantFails === true, { i, said }); }

  /* 4. the verdict on planted figures */
  const fig = (ll, br, u) => ({ logloss: { ci90: ll }, brier: { ci90: br }, units: u });
  const ok = [-0.004, -0.001], okB = [-0.002, -0.0005];
  check('all three hold: PASS', T.barVerdict(fig(ok, okB, 12.3)).verdict === 'PASS', T.barVerdict(fig(ok, okB, 12.3)));
  check('a log-loss interval touching zero is not wholly below it', T.barVerdict(fig([-0.004, 0], okB, 12.3)).verdict === 'FAIL' && T.barVerdict(fig([-0.004, -0], okB, 12.3)).tests.logloss === false && T.barVerdict(fig([-0.004, 0.000001], okB, 12.3)).tests.logloss === false, null);
  check('a Brier interval touching zero is not wholly below it', T.barVerdict(fig(ok, [-0.002, 0], 12.3)).verdict === 'FAIL' && T.barVerdict(fig(ok, [-0.002, 0], 12.3)).tests.brier === false, null);
  check('units of exactly zero are not up', T.barVerdict(fig(ok, okB, 0)).verdict === 'FAIL' && T.barVerdict(fig(ok, okB, -0.01)).verdict === 'FAIL' && T.barVerdict(fig(ok, okB, 0.01)).verdict === 'PASS', null);
  check('an interval missing or the wrong way round is not below zero', T.barVerdict(fig(null, okB, 1)).tests.logloss === false && T.barVerdict(fig([-0.001, -0.004], okB, 1)).tests.logloss === false, null);
  check('both intervals below and units down: FAIL on test 3 alone', JSON.stringify(T.barVerdict(fig(ok, okB, -5)).tests) === '{"logloss":true,"brier":true,"units":false}', null);
  /* the figures before their rounding, reported beside the bar: bootCI's bounds unrounded, rounding to bootCI's own,
     and the units summed unrounded; a bound of -0.0000004 rounds to -0, which the bar reads as touching zero */
  { const g = [[0.31, 2], [-0.5, 3], [0.1234567, 1], [-0.7654321, 2], [0.0101, 1]], raw = T.bootCIRaw(g), r6 = x => Math.round(x * 1e6) / 1e6;
    const m = PR.marketScores(ac.lines), u = T.unroundedBar(ac.lines), f = { logloss: { ci90: m.logloss.diffCi90 }, brier: { ci90: m.brier.diffCi90 }, units: Math.round((m.flat.edge3.over.units + m.flat.edge3.under.units) * 100) / 100 };
    const hold = (a, b) => { try { T.holdUnrounded(a, b); return true; } catch (e) { return false; } };
    check('the bar\'s figures before rounding: bootCI\'s bounds unrounded, the units summed', raw.map(r6).join() === PR.bootCI(g).join() && raw.some(x => r6(x) !== x)
      && u.logloss.ci90.map(r6).join() === m.logloss.diffCi90.join() && u.brier.ci90.map(r6).join() === m.brier.diffCi90.join() && u.logloss.ci90.some(x => r6(x) !== x) && Math.abs(u.units - f.units) <= 0.01 + 1e-9
      && hold(u, f) && !hold({ ...u, logloss: { ci90: [u.logloss.ci90[0], u.logloss.ci90[1] + 1e-5] } }, f), { raw, u });
    check('a bound of -0.0000004 rounds to -0: the bar reads it as touching zero, the unrounded reading beside it as below', T.barVerdict(fig([-0.004, r6(-4e-7)], okB, 1)).tests.logloss === false && T.barVerdict(fig([-0.004, -4e-7], okB, 1)).tests.logloss === true, null); }

  /* 5. V1, the coverage, the validity check's count, the fixture door and FROZEN */
  const vS = { v1: { shareBeforeStart: 0.95, preGame: 'shown' } };
  check('V1 shown only at 95% or more stamped before the start, counted in whole lines', T.preGameOf(vS, { before: 80750, graded: 85000 }) === 'shown' && T.preGameOf({ v1: { shareBeforeStart: 0.97, preGame: 'shown' } }, { before: 97, graded: 100 }) === 'shown'
    && T.preGameOf({ v1: { shareBeforeStart: 0.94, preGame: 'not shown by the feed: inferred from V2 and V3' } }, { before: 94, graded: 100 }) === 'inferred, not shown' && T.preGameOf({}, { before: 100, graded: 100 }) === 'inferred, not shown'
    && T.preGameOf(vS, null) === 'inferred, not shown' && T.preGameOf({ v1: { shareBeforeStart: 0.99, preGame: 'not shown by the feed: inferred from V2 and V3' } }, { before: 99, graded: 100 }) === 'inferred, not shown', null);
  check('V1 counted in whole lines: 80,746 of 85,000 (94.995%) is not 95%, though validity.js reads its share as 0.95', T.preGameOf(vS, { before: 80746, graded: 85000 }) === 'inferred, not shown' && T.V1_PCT === 95, null);
  { const n = T.v1Count({ lines: [1, 2, 3, 4], src: [0, 1, 2, 3] }, [{ game_id: 'g', lu: '2024-01-01T00:00Z' }, { game_id: 'g', lu: '2024-01-02T00:00Z' }, { game_id: 'h', lu: '2024-01-01T00:00Z' }, { game_id: 'g', lu: null }], { g: { start: '2024-01-01T12:00Z' }, h: { start: null } });
    check('V1 counts a line stamped before its event\'s start, as validity.js does', n.graded === 4 && n.dated === 2 && n.before === 1, n); }
  const wg = [{ game_id: 'w1', espn_id: '1' }, { game_id: 'w2', espn_id: '2' }, { game_id: 'w3', espn_id: '' }, { game_id: 'w4', espn_id: '4' }, { game_id: 'w5', espn_id: '5' }];
  const reads = { w1: { status: 'ok', lines: 40 }, w2: { status: 'none', lines: 0 }, w4: { status: 'failed', lines: 0 }, w5: { status: 'ok', lines: 0 } }, readsOk = { ...reads, w4: { status: 'none', lines: 0 } };
  const cov = T.coverageOf(wg, reads, new Map([['w1', 40], ['x9', 3]])), covOk = T.coverageOf(wg, readsOk, new Map([['w1', 40]]));
  check('the coverage counts every read and the games with no ESPN id', cov.noEspnId === 1 && cov.read.ok === 1 && cov.read.none === 1 && cov.read.failed === 1 && cov.failed.join() === 'w4' && cov.read.okWithNoLine === 1 && cov.gamesWithLines === 1 && cov.rowsOutsideWindow === 1 && cov.notRead.length === 0, cov);
  check('a game of the window never read refuses', /never read/.test(refusal(() => T.requireRead(T.coverageOf(wg, { ...readsOk, w5: undefined }, new Map([['w1', 40]])))) || ''), null);
  check('a failed read refuses, as a game never read does: provider 40 has not answered it', /failed read/.test(refusal(() => T.requireRead(cov)) || '') && /failed read/.test(refusal(() => T.requireRead(cov, { games: ['w2'], decided: 'x' })) || ''), null);
  check('a failed read on the owner\'s list passes, counted', (() => { const r = refusal(() => T.requireRead(cov, { games: ['w4', 'w9'], decided: 'the owner, today' })); if (r) return false; const a = T.requireRead(cov, { games: ['w4', 'w9'], decided: 'the owner, today' }); return a.acceptedFailed.join() === 'w4' && a.listedNotFailed.join() === 'w9'; })(), null);
  check('a read of no known status refuses', /no known status/.test(refusal(() => T.requireRead(T.coverageOf(wg, { ...readsOk, w4: { status: 'partial', lines: 0 } }, new Map([['w1', 40]])))) || ''), null);
  check('a game read with lines and no row refuses', /no row/.test(refusal(() => T.requireRead(T.coverageOf(wg, readsOk, new Map()))) || ''), null);
  check('a game whose rows are not its read\'s count refuses', /other than their read/.test(refusal(() => T.requireRead(T.coverageOf(wg, readsOk, new Map([['w1', 39]])))) || '') && /other than their read/.test(refusal(() => T.requireRead(T.coverageOf(wg, readsOk, new Map([['w1', 40], ['w2', 2]])))) || ''), null);
  check('a complete coverage passes', refusal(() => T.requireRead(covOk)) === null, null);
  { const fa = path.join(tmp, 'accept.json'), put = x => { fs.writeFileSync(fa, typeof x === 'string' ? x : JSON.stringify(x)); return refusal(() => T.readAccept(fa)) || ''; };
    const okList = (() => { fs.writeFileSync(fa, JSON.stringify({ games: ['w4'], decided: 'the owner, 2026-11-07' })); return T.readAccept(fa); })();
    check('the owner\'s list: a list of games with who decided it, or refused; none where there is no file', okList.games.join() === 'w4' && /not JSON/.test(put('{')) && /owner's list/.test(put({ games: [], decided: 'x' })) && /owner's list/.test(put({ games: ['w4'] })) && /owner's list/.test(put({ games: [4], decided: 'x' }))
      && T.readAccept(path.join(tmp, 'no_such_list.json')) === null, null); }
  check('lines other than the validity check\'s refuse', /did not read the same lines/.test(refusal(() => T.agreesWithValidity({ graded: 36, games: 3 }, 35, 3)) || '') && /did not read the same lines/.test(refusal(() => T.agreesWithValidity({ graded: 36, games: 3 }, 36, 4)) || '') && refusal(() => T.agreesWithValidity({ graded: 36, games: 3 }, 36, 3)) === null, null);
  check('the settings go together and never at the real cache or into results/', /together/.test(refusal(() => T.paths({ TEST2024_CACHE: tmp })) || '') && /together/.test(refusal(() => T.paths({ TEST2024_OUT: path.join(tmp, 'o.json') })) || '')
    && /may not/.test(refusal(() => T.paths({ TEST2024_CACHE: OUTD, TEST2024_OUT: path.join(tmp, 'o.json') })) || '') && /may not/.test(refusal(() => T.paths({ TEST2024_CACHE: tmp, TEST2024_OUT: path.join(OUTD, 'x.json') })) || '')
    && /may not/.test(refusal(() => T.paths({ TEST2024_CACHE: __dirname, TEST2024_OUT: path.join(tmp, 'o.json') })) || '')
    && T.paths({}).fixture === false && T.paths({ TEST2024_CACHE: tmp, TEST2024_OUT: path.join(tmp, 'o.json') }).fixture === true, null);
  { const lk = (to, name) => { const l = path.join(tmp, name); fs.symlinkSync(to, l); return l; };
    const resLink = lk(OUTD, 'res_link'), studyLink = lk(__dirname, 'study_link');
    check('a link to results/ or into the study folder is refused as the path is', /may not/.test(refusal(() => T.paths({ TEST2024_CACHE: tmp, TEST2024_OUT: path.join(resLink, 'test2024.json') })) || '')
      && /may not/.test(refusal(() => T.paths({ TEST2024_CACHE: studyLink, TEST2024_OUT: path.join(tmp, 'o.json') })) || '') && /may not/.test(refusal(() => T.paths({ TEST2024_CACHE: path.join(studyLink, 'results'), TEST2024_OUT: path.join(tmp, 'o.json') })) || '')
      && /must exist/.test(refusal(() => T.paths({ TEST2024_CACHE: path.join(tmp, 'no_such_dir'), TEST2024_OUT: path.join(tmp, 'o.json') })) || ''), null);
    const fd = path.join(tmp, 'flink'); fs.mkdirSync(fd); fs.symlinkSync(path.join(OUTD, 'cand_fix_rule.json'), path.join(fd, 'props40_2024.csv')); fs.writeFileSync(path.join(fd, 'props40_reads.json'), '{}');
    const P = T.paths({ TEST2024_CACHE: fd, TEST2024_OUT: path.join(fd, 'o.json') });
    check('a fixture\'s file that is a link out of its folder is refused', /link out of its folder/.test(refusal(() => T.cacheFile(P, 'props40_2024.csv')) || '') && T.cacheFile(P, 'props40_reads.json') === path.join(P.cache, 'props40_reads.json') && T.cacheFile(T.paths({}), 'x') === path.join(__dirname, 'cache', 'x'), null); }
  check('a file the scorer stands on must be committed', /not committed/.test(refusal(() => T.gitClean(['research/props_v2/no_such_file.js'])) || '') && /^[0-9a-f]{40}$/.test(T.gitClean(['research/props_v2/cand_fix_lib.js'])), null);
  { const gaps = T.frozenGaps(Object.keys(require.cache).filter(f => f !== SCRIPT && f !== __filename));
    check('FROZEN holds every module the scorer loads and every data file it reads', gaps.length === 0 && ['tools/lib.js', 'research/props_v2/cand_select_lib.js', 'data/games.csv', 'data/props_2026.csv', 'data/box_2024.csv', 'data/teambox_2024.jsonl', 'data/box_2022.csv', 'data/box_2026.csv'].every(f => T.FROZEN.includes(f))
      && !T.FROZEN.some(f => /2027/.test(f)), gaps); }
  check('the frozen list carries the scorer and what it reproduces', ['research/props_v2/test2024.js', 'research/props_v2/cand_fix_lib.js', 'research/props_v2/results/cand_fix_score.json', 'research/props_v2/results/cand_fix_rule.json', 'research/props_v2/validity_lib.js', 'tools/props.js'].every(f => T.FROZEN.includes(f)), T.FROZEN);

  /* 6. the validity check, decided once and written once, and the settings, each refusal in a run of its own where it
     comes before the reproduction */
  const dir = name => { const d = path.join(tmp, name); fs.mkdirSync(d, { recursive: true }); return d; };
  const lay = (d, validity, opts = {}) => {
    fs.writeFileSync(path.join(d, 'props40_2024.csv'), csvOf(fx.lines));
    fs.writeFileSync(path.join(d, 'props40_reads.json'), JSON.stringify(fx.reads, null, 1) + '\n');
    if (opts.accept) fs.writeFileSync(path.join(d, 'test2024_accept.json'), JSON.stringify({ what: 'made up by test2024_test.js', games: fx.failed, decided: 'test2024_test.js, a fixture' }, null, 1) + '\n');
    if (validity) {
      const v = { ...fx.validity(d), files: { csv: sha(path.join(d, 'props40_2024.csv')), reads: sha(path.join(d, 'props40_reads.json')) }, ...validity };
      fs.writeFileSync(path.join(d, 'validity_2024.json'), JSON.stringify(v, null, 1) + '\n');
      if (opts.runs) fs.writeFileSync(path.join(d, 'validity_2024_runs.jsonl'), [...opts.runs, { generated: v.generated, files: v.files, graded: v.graded, games: v.games, verdict: v.verdict }].map(r => JSON.stringify(r)).join('\n') + '\n');
    }
    return d;
  };
  const score = (env, timeout) => spawnSync(process.execPath, [SCRIPT, '--score'], { env: { ...clean(process.env), ...env }, encoding: 'utf8', timeout });
  const refuses = (name, env, re) => {
    const r = score(env, 25000);
    check(name, r.status === 2 && re.test(r.stderr || ''), { status: r.status, signal: r.signal, said: (r.stderr || '').split('\n').filter(Boolean).slice(-2) });
  };
  const fxEnv = (d, o) => ({ TEST2024_CACHE: d, TEST2024_OUT: o || path.join(d, 'test2024.json') });
  const fxP = d => T.paths(fxEnv(d));
  refuses('no validity file: refused', fxEnv(lay(dir('noval'), null)), /no validity check/);
  for (const k of ['v0', 'v2', 'v3']) {
    const d = lay(dir('void' + k), { [k]: { holds: false }, verdict: 'VOID: the lines settle nothing' }), r = refusal(() => T.readValidity(fxP(d)));
    check(`a VOID check (${k.toUpperCase()} did not hold) is read as VOID, not refused`, r === null && T.readValidity(fxP(d)).voided.join() === k.toUpperCase(), { refused: r });
  }
  check('a check whose verdict is not what its checks say: refused', /not what its V0, V2 and V3 say/.test(refusal(() => T.readValidity(fxP(lay(dir('voidmix'), { v2: { holds: false } })))) || '')
    && /not what its V0, V2 and V3 say/.test(refusal(() => T.readValidity(fxP(lay(dir('voidmix2'), { verdict: 'VOID: the lines settle nothing' })))) || '')
    && /whether V0, V2 and V3 hold/.test(refusal(() => T.readValidity(fxP(lay(dir('voidmix3'), { v3: {} })))) || ''), null);
  refuses('a check on other thresholds: refused', fxEnv(lay(dir('thr'), { thresholds: { ...V.TH, v2Floor: -0.1 } })), /registered thresholds/);
  refuses('a check with no SHA-256 of what it read: refused', fxEnv(lay(dir('nosha'), { files: null })), /no SHA-256/);
  { const d = lay(dir('bytes'), {}), P = fxP(d), v = T.readValidity(P).v, got = T.readCache(P, v);
    /* the rewrite the review planted: the same rows and count, the Over's and the Under's prices swapped, its time set
       back so that no time test could see it */
    const old = Date.now() / 1000 - 3600;
    fs.writeFileSync(path.join(d, 'props40_2024.csv'), csvOf(fx.lines.map(r => [r[0], r[1], r[2], r[3], r[5], r[4], r[6]]))); fs.utimesSync(path.join(d, 'props40_2024.csv'), old, old);
    check('lines that are not the validity check\'s bytes refuse (same count, prices swapped)', got.rows.length === fx.lines.length && got.sha.csv === v.files.csv && /not the bytes the validity check read/.test(refusal(() => T.readCache(P, v)) || ''), null); }
  { const d = lay(dir('done'), {}); fs.writeFileSync(path.join(d, 'test2024.json'), JSON.stringify({ generated: 'x', what: 'x', verdict: 'FAIL (pre-game inferred, not shown)' }) + '\n'); refuses('a result already written: refused (decided once)', fxEnv(d), /decided once/); }
  { const d = lay(dir('notwhole'), {}); fs.writeFileSync(path.join(d, 'test2024.json'), '{}\n'); refuses('a result that is not whole refuses as cut off, not as decided ({} and truncated)', fxEnv(d), /holds no whole result/);
    const o = path.join(tmp, 'trunc.json'); fs.writeFileSync(o, '{\n "generated": "2026-11-07T00:00Z",\n "what": "research/props_v2/test2024.js --score: candid');
    const l = path.join(tmp, 'linked.json'); fs.symlinkSync(path.join(tmp, 'nowhere.json'), l);
    check('a truncated result, or a link at its path, is not decided but refused to be looked at', /holds no whole result/.test(refusal(() => T.decided(o)) || '') && /holds no whole result/.test(refusal(() => T.decided(l)) || '') && refusal(() => T.decided(path.join(tmp, 'none.json'))) === null, null); }
  { const d = lay(dir('part'), {}); fs.writeFileSync(path.join(d, 'test2024.json.part'), '{\n "generated": "2026'); refuses('a part left by a run cut off while writing: refused', fxEnv(d), /cut off while writing/); }
  { const kd = dir('keep'), o = path.join(kd, 'r.json'), body = JSON.stringify({ verdict: 'FAIL', n: 1 }) + '\n';
    const enospc = (fd, b) => { fs.writeSync(fd, b.slice(0, 10)); const e = new Error('ENOSPC: no space left on device, write'); e.code = 'ENOSPC'; throw e; };
    check('a write that fails leaves no result and no part', throws(() => T.keepResult(o, body, enospc), /ENOSPC/) && !fs.existsSync(o) && !fs.existsSync(o + '.part') && refusal(() => T.decided(o)) === null, null);
    T.keepResult(o, body);
    check('the result is kept whole, and no part is left', fs.readFileSync(o, 'utf8') === body && !fs.existsSync(o + '.part') && /decided once/.test(refusal(() => T.decided(o)) || ''), null);
    check('of two keeps only the first is kept', /written meanwhile/.test(refusal(() => T.keepResult(o, JSON.stringify({ verdict: 'PASS' }) + '\n')) || '') && fs.readFileSync(o, 'utf8') === body && !fs.existsSync(o + '.part'), null);
    const o2 = path.join(kd, 'r2.json'); fs.writeFileSync(o2 + '.part', 'x');
    check('a part already there refuses a keep, and is left as it was', /another run is writing/.test(refusal(() => T.keepResult(o2, body)) || '') && !fs.existsSync(o2) && fs.readFileSync(o2 + '.part', 'utf8') === 'x', null); }
  refuses('TEST2024_CACHE without TEST2024_OUT: refused', { TEST2024_CACHE: dir('noval') }, /together/);
  refuses('TEST2024_OUT into results/: refused', { TEST2024_CACHE: dir('noval'), TEST2024_OUT: path.join(OUTD, 'test2024_fixture.json') }, /may not/);
  check('no refused run wrote a result', !fs.existsSync(path.join(OUTD, 'test2024_fixture.json')) && !fs.existsSync(path.join(OUTD, 'test2024_fixture.json.part')) && ['noval', 'thr', 'nosha', 'part'].every(d => !fs.existsSync(path.join(tmp, d, 'test2024.json'))), null);
  if (FAST) return;

  /* 7. end to end, on the made-up lines: the bar applies, then a VOID check */
  const earlier = { generated: '2026-11-06T09:00Z', files: { csv: 'f'.repeat(64), reads: 'e'.repeat(64) }, graded: 20, games: 2, verdict: 'VOID: the lines settle nothing' };
  const d = lay(dir('e2e'), {}, { accept: true, runs: [earlier] }), o = path.join(d, 'test2024.json');
  const r = score(fxEnv(d, o), 900000);
  check('the run ends and writes its result', r.status === 0 && fs.existsSync(o) && !fs.existsSync(o + '.part'), { status: r.status, said: (r.stderr || r.stdout || '').split('\n').filter(Boolean).slice(-4) });
  const res = JSON.parse(fs.readFileSync(o, 'utf8')), txt = fs.readFileSync(o, 'utf8');
  check('its reproduction passed in the same run', res.check && res.check.passed && res.check.archiveSame && res.check.fold2024Same && res.check.walkForward2024Same && res.check.blendSame && res.check.copiesSame && res.check.validityCountSame && res.check.frozenCovered, res.check);
  check('the counts: graded, void, no call, pushes, and what was left out', res.lines.graded === fx.graded && res.lines.games === 3 && res.lines.voids === 2 && res.lines.noCall === 1 && res.lines.pushes === 1 && res.lines.rows === fx.lines.length
    && JSON.stringify(res.lines.dropped) === JSON.stringify({ notOnSchedule: 1, notRegularSeason: 1, outsideWindow: 1, notBaseStat: 2, noPrice: 1 }), res.lines);
  check('the coverage of the window, the two failed reads on the owner\'s list', res.coverage.windowGames === 1231 && res.coverage.noEspnId === 5 && res.coverage.read.ok === 3 && res.coverage.read.failed === 2 && res.coverage.read.none === 1221 && res.coverage.notRead.length === 0 && res.coverage.rowsOutsideWindow === 3
    && res.coverage.ownersList && res.coverage.ownersList.acceptedFailed.join() === fx.failed.join() && res.files.ownersList === sha(path.join(d, 'test2024_accept.json')), res.coverage);
  check('"pre-game inferred, not shown" in the result and its log', res.preGame === 'inferred, not shown' && / \(pre-game inferred, not shown\)$/.test(res.verdict) && /VERDICT: (PASS|FAIL) \(pre-game inferred, not shown\)/.test(r.stdout), { verdict: res.verdict });
  check('V1 counted on the graded lines, reported', JSON.stringify([res.validity.v1Counted.graded, res.validity.v1Counted.dated, res.validity.v1Counted.before]) === JSON.stringify([fx.graded, fx.datedBefore, fx.datedBefore]) && res.validity.v1Counted.shown === false, res.validity.v1Counted);
  check('the verdict is its own figures\' by the bar', JSON.stringify(T.barVerdict(res.bar.figures)) === JSON.stringify({ tests: res.bar.tests, verdict: res.verdict.split(' ')[0] }) && res.bar.figures.logloss.diff === res.beside.candidate.logloss.diff
    && res.bar.figures.units === Math.round((res.beside.candidate.flat.edge3.over.units + res.beside.candidate.flat.edge3.under.units) * 100) / 100, res.bar);
  check('reported beside it: tools/props.js, A less tools/props.js, the stats, sureness, units by side, the blend\'s share by stat and the figures before rounding', res.beside.toolsProps.logloss && res.beside.candidateMinusBaseline.ci90 && Object.keys(res.beside.byStat).join() === PR.STATS.join()
    && res.beside.toolsProps.sureness && res.beside.units.over.candidate.ci90 && res.beside.units.under.candidate.ci90 && Object.keys(res.beside.blendShare.byStat).join() === PR.STATS.join()
    && res.beside.unrounded.figures.logloss.ci90.map(x => Math.round(x * 1e6) / 1e6).join() === res.bar.figures.logloss.ci90.join() && res.beside.unrounded.sameTestsAsBar === (JSON.stringify(res.beside.unrounded.tests) === JSON.stringify(res.bar.tests)), Object.keys(res.beside));
  check('every run of the validity check reported, deciding nothing: an earlier VOID on other bytes, and this one', res.validityRuns.log === true && res.validityRuns.n === 2 && res.validityRuns.runs[0].sameBytes === false && res.validityRuns.runs[1].sameBytes === true && res.validityRuns.voidOnOtherBytes === 1, res.validityRuns);
  check('the hashes: the bytes scored, the validity check, and every file FROZEN holds', res.files.csv === sha(path.join(d, 'props40_2024.csv')) && res.files.reads === sha(path.join(d, 'props40_reads.json')) && res.files.validity === sha(path.join(d, 'validity_2024.json'))
    && Object.keys(res.files.frozen).join() === T.FROZEN.join() && Object.values(res.files.frozen).every(h => /^[0-9a-f]{64}$/.test(h)) && res.files.frozen['data/box_2024.csv'] === sha(path.join(__dirname, '..', '..', 'data', 'box_2024.csv')) && res.files.gamesTo2026 === T.gamesTo2026Sha(), res.files);
  const keys = new Set(), longest = { n: 0 };
  (function walk(x) { if (Array.isArray(x)) { longest.n = Math.max(longest.n, x.length); x.forEach(walk); } else if (x && typeof x === 'object') for (const [k, v] of Object.entries(x)) { keys.add(k); walk(v); } })(res);
  check('the result is aggregates only: no player id, no per-line row', !fx.players.some(p => txt.includes(p)) && longest.n < fx.graded && !['player_id', 'player', 'pModel', 'pMarket', 'mu', 'lu', 'last_updated', 'price'].some(k => keys.has(k)), { longest: longest.n });
  check('it names no file of the real cache and is marked a fixture', res.fixture === true && res.files.commit === null && !txt.includes(path.join(__dirname, 'cache')), res.files.commit);
  refuses('a second run on the same lines: refused (decided once)', fxEnv(d, o), /decided once/);
  /* a VOID check: the outcome, written once, with no score; every later run refuses */
  const dv = lay(dir('e2evoid'), { v2: { holds: false, diff: -0.21, exits: 61 }, verdict: 'VOID: the lines settle nothing' }, { accept: true }), ov = path.join(dv, 'test2024.json');
  const rv = score(fxEnv(dv, ov), 900000), resV = fs.existsSync(ov) ? JSON.parse(fs.readFileSync(ov, 'utf8')) : {}, txtV = fs.existsSync(ov) ? fs.readFileSync(ov, 'utf8') : '';
  check('a VOID check is recorded as the outcome: VOID, the check\'s figures, and no score', rv.status === 0 && /^VOID \(V2 did not hold\)/.test(resV.verdict || '') && !('bar' in resV) && !('beside' in resV) && resV.validity && resV.validity.v2.holds === false && resV.validity.v2.exits === 61
    && resV.lines.graded === fx.graded && resV.check.passed && resV.files.csv === sha(path.join(dv, 'props40_2024.csv')) && !/"(candidate|toolsProps|logloss|brier|units)"/.test(txtV) && /VERDICT: VOID \(V2 did not hold\)/.test(rv.stdout) && !/log loss, A less/.test(rv.stdout), { status: rv.status, verdict: resV.verdict, said: (rv.stderr || rv.stdout || '').split('\n').filter(Boolean).slice(-3) });
  refuses('after a VOID, a second run (the validity check run again until it holds) is refused: decided once', fxEnv(lay(dv, {}, { accept: true }), ov), /decided once/);
}
const clean = env => { const e = { ...env }; delete e.TEST2024_CACHE; delete e.TEST2024_OUT; return e; };
/* the raw box-score plant, in a process of its own: the replay as it is passes the walk-forward, and one steal added to
   the box score of a player of 2024_20240405_NYK_CHI with no game after 2023-24 (Bojan Bogdanovic, 20 minutes) fails it */
const RAW_PLANT = `
const T = require(process.argv[1]), C = require(${JSON.stringify(path.join(__dirname, 'cand_fix_lib.js'))}), PR = require(${JSON.stringify(path.join(__dirname, '..', '..', 'tools', 'props.js'))});
const fs = require('fs'), R = ${JSON.stringify(path.join(__dirname, 'results'))};
const S = JSON.parse(fs.readFileSync(R + '/cand_fix_score.json', 'utf8')), foldP = JSON.parse(fs.readFileSync(R + '/fold_params.json', 'utf8'));
const D = C.loadData(), g = D.games.find(x => x.game_id === '2024_20240405_NYK_CHI'), box = D.boxes[g.game_id];
const wf = boxes => { const rows = C.replayX(D.games, boxes, D.tbox, { collect: true, from: PR.FIRST + 1 }).rows; try { T.walkForward2024({ rows, sides: C.sidesOf(rows) }, S, foldP); return true; } catch (e) { if (!/walk-forward/.test(e.message)) throw e; return false; } };
const cleanPasses = wf(D.boxes);
const later = new Set(); for (const [k, v] of Object.entries(D.boxes)) if (+k.slice(0, 4) > 2024) for (const l of Object.values(v)) for (const r of l) later.add(r.id);
const who = [...box[g.home], ...box[g.away]].find(r => r.min >= 20 && !r.dnp && !later.has(r.id));
const plantFails = !!who && !wf({ ...D.boxes, [g.game_id]: Object.fromEntries(Object.entries(box).map(([t, l]) => [t, l.map(r => r === who ? { ...r, y: { ...r.y, stl: r.y.stl + 1 } } : r)])) });
console.log(JSON.stringify({ who: who && who.name, cleanPasses, plantFails }));
`;

/* the made-up lines, on three real games of the window (its first day, its last and one between): two players a game who
   played, every base stat at half a point from what he made, at made-up prices; then a void (a player who did not play,
   and an id the box does not list), a debut with no game on record (no call), a push, and the rows the selection leaves
   out (a play-in game, a playoff game, a game off the schedule, turnovers, a combo, a missing price) */
function fixture(W) {
  const rowAt = new Map(W.rows.map(r => [r.game + '|' + r.id, r]));
  const win = W.D.games.filter(g => g.type === 'REG' && g.date >= '2023-10-24' && g.date <= '2024-04-14');
  const G = [win[0], win.find(g => g.date >= '2024-01-15'), win[win.length - 1]];
  const box = g => [...W.D.boxes[g.game_id][g.home], ...W.D.boxes[g.game_id][g.away]];
  const playedWithRow = g => box(g).filter(r => r.min > 0 && !r.dnp && rowAt.has(g.game_id + '|' + r.id)).sort((a, b) => b.min - a.min || (a.id < b.id ? -1 : 1));
  const prices = [[-128, 104], [-110, -110], [115, -139], [-150, 122], [-105, -115], [130, -160]];
  const lines = [], players = [];
  let n = 0;
  for (const g of G) for (const r of playedWithRow(g).slice(0, 2)) {
    players.push(r.id);
    PR.STATS.forEach((k, j) => { const y = r.y[k], line = j % 2 === 0 || y < 1 ? y + 0.5 : y - 0.5, [o, u] = prices[n++ % prices.length]; lines.push([g.game_id, r.id, k, line, o, u, '2023-01-01T00:00Z']); });
  }
  const graded = lines.length;
  const g0 = G[0], b0 = box(g0);
  const dnp = b0.find(r => !(r.min > 0 && !r.dnp)), debut = b0.find(r => r.min > 0 && !r.dnp && !rowAt.has(g0.game_id + '|' + r.id));
  const pushP = playedWithRow(G[2])[2];
  if (!dnp || !debut || !pushP) throw new Error('the fixture games have no scratch, debut or third player');
  players.push(dnp.id, debut.id, pushP.id, '9999999901');
  lines.push([g0.game_id, dnp.id, 'pts', 10.5, -110, -110, ''], [g0.game_id, '9999999901', 'pts', 10.5, -110, -110, ''], [g0.game_id, debut.id, 'pts', 5.5, -110, -110, ''],
    [G[2].game_id, pushP.id, 'pts', pushP.y.pts, -110, -110, '']);
  const pi = W.D.games.find(g => g.season === 2024 && g.type === 'REG' && g.date > '2024-04-14'), po = W.D.games.find(g => g.season === 2024 && g.type === 'POST');
  const p1 = playedWithRow(G[1])[0];
  lines.push([pi.game_id, box(pi)[0].id, 'pts', 10.5, -110, -110, ''], [po.game_id, box(po)[0].id, 'pts', 10.5, -110, -110, ''], ['2024_20231020_AAA_BBB', '9999999902', 'pts', 10.5, -110, -110, ''],
    [G[1].game_id, p1.id, 'tov', 2.5, -110, -110, ''], [G[1].game_id, p1.id, 'pra', 30.5, -110, -110, ''], [G[1].game_id, '9999999903', 'reb', 4.5, '', -110, '']);
  players.push(box(pi)[0].id, box(po)[0].id);
  /* every game of the window read: the three with lines ok (the first with its event's start, after its lines' stamps),
     two failed (the end-to-end run lists them on an owner's list of its own), the rest none; the play-in and playoff
     games too */
  const reads = {}, failed = [];
  for (const g of win) if (g.espn_id) reads[g.game_id] = G.includes(g) ? { at: '2026-11-06T00:00Z', status: 'ok', lines: lines.filter(l => l[0] === g.game_id).length, start: g === G[0] ? '2023-10-24T23:30Z' : null }
    : failed.length < 2 ? (failed.push(g.game_id), { at: '2026-11-06T00:00Z', status: 'failed', lines: 0, start: null }) : { at: '2026-11-06T00:00Z', status: 'none', lines: 0, start: null };
  for (const g of [pi, po]) reads[g.game_id] = { at: '2026-11-06T00:00Z', status: 'ok', lines: 1, start: null };
  const datedBefore = lines.filter(l => l[0] === G[0].game_id && l[6]).length;
  const validity = d => ({ generated: '2026-11-06T00:00Z', what: 'made up by test2024_test.js', lines: path.join(d, 'props40_2024.csv'), fold: 2024, thresholds: V.TH, graded, games: 3,
    v0: { holds: true }, v1: { dated: graded, undated: 0, shareBeforeStart: 0.1, hoursAfterStartMedian: 5.4, preGame: 'not shown by the feed: inferred from V2 and V3' },
    v2: { holds: true, diff: -0.01, exits: 50 }, v3: { holds: true }, verdict: 'the bar applies (pre-game not shown by the feed: inferred from V2 and V3)' });
  return { lines, graded, players: [...new Set(players)], reads, failed, datedBefore, validity };
}

/* ---------- the planted breaks: each one rule of test2024.js broken, and the check that must catch it ---------- */
const PLANTS_LIST = [
  ['the window ends a day late', "to: '2024-04-14'", "to: '2024-04-15'", 'the window\'s first and last days kept, on the six base stats with both prices', true],
  ['the window starts a day late', "from: '2023-10-24'", "from: '2023-10-25'", 'the window\'s first and last days kept, on the six base stats with both prices', true],
  ['no regular-season filter', 'if (sel.type && g.type !== sel.type)', 'if (false && sel.type && g.type !== sel.type)', 'the window\'s first and last days kept, on the six base stats with both prices', true],
  ['every stat kept', 'if (!sel.stats.includes(l.stat))', 'if (false && !sel.stats.includes(l.stat))', 'the window\'s first and last days kept, on the six base stats with both prices', true],
  ['a row kept with one price', 'if (l.over == null || l.under == null)', 'if (l.over == null && l.under == null)', 'the window\'s first and last days kept, on the six base stats with both prices', true],
  ['a duplicate row read', 'if (seen.has(k)) throw', 'if (false && seen.has(k)) throw', 'two rows for one game, player and stat throw', true],
  ['a void counted as no call', 'if (!played.has(k)) { voids++; continue; }', 'if (!played.has(k)) { noCall++; continue; }', 'a player who did not play, and one the box does not list, are void', true],
  ['pushes kept', "return { lines: lines.filter(x => x.result !== 'push')", "return { lines: lines.filter(x => true)", 'a line equal to the stat is a push, left out', true],
  ['the graded lines\' rows not kept in step', "src: src.filter((s, i) => lines[i].result !== 'push')", 'src', 'each graded line knows its row (V1 reads its stamp)', true],
  ['the 2023-24 walk-forward not held (the old behaviour)', 'if (!same(b, wf.baseline) || !same(c, wf.candidate)) throw', 'if (false) throw', 'a 2023-24 row changed (its points, or one steal in a raw box score) fails the walk-forward', true],
  ['an interval touching zero read as below it', 'ci[0] <= ci[1] && ci[1] < 0', 'ci[0] <= ci[1] && ci[1] <= 0', 'a log-loss interval touching zero is not wholly below it', true],
  ['units of zero read as up', 'f.units > 0 };', 'f.units >= 0 };', 'units of exactly zero are not up', true],
  ['the figures before rounding rounded', '  return [means[Math.floor(0.05 * nBoot)], means[Math.floor(0.95 * nBoot)]];', '  return [r6(means[Math.floor(0.05 * nBoot)]), r6(means[Math.floor(0.95 * nBoot)])];', 'the bar\'s figures before rounding: bootCI\'s bounds unrounded, the units summed', true],
  ['V1 always shown', "  return own && v && v.v1 && v.v1.preGame === 'shown' ? 'shown' : 'inferred, not shown';", "  return 'shown';", 'V1 shown only at 95% or more stamped before the start, counted in whole lines', true],
  ['V1 read on validity.js\'s four-place share (the old behaviour)', '100 * n.before >= V1_PCT * n.graded', '(v && v.v1 && v.v1.shareBeforeStart >= V.TH.v1ShareBeforeStart)', 'V1 counted in whole lines: 80,746 of 85,000 (94.995%) is not 95%, though validity.js reads its share as 0.95', true],
  ['a game never read let through', 'if (cov.notRead.length) throw', 'if (false && cov.notRead.length) throw', 'a game of the window never read refuses', true],
  ['a failed read let through (the old behaviour)', 'if (open.length) throw new Refusal(', 'if (false) throw new Refusal(', 'a failed read refuses, as a game never read does: provider 40 has not answered it', true],
  ['the owner\'s list not read', 'const listed = new Set(accept ? accept.games : [])', 'const listed = new Set([])', 'a failed read on the owner\'s list passes, counted', true],
  ['a read of no known status let through', 'if (cov.other.length) throw', 'if (false) throw', 'a read of no known status refuses', true],
  ['rows other than the read\'s count let through', 'if (cov.rowsNotTheRead) throw', 'if (false) throw', 'a game whose rows are not its read\'s count refuses', true],
  ['the validity check\'s count not held', 'if (v.graded !== graded || v.games !== games)', 'if (false)', 'lines other than the validity check\'s refuse', true],
  ['the settings allowed apart', "if (!c || !o) throw new Refusal('TEST2024_CACHE", "if (false) throw new Refusal('TEST2024_CACHE", 'the settings go together and never at the real cache or into results/', true],
  ['a fixture allowed into results/', 'if (inside(rc, study) || inside(ro, study))', 'if (inside(rc, study))', 'the settings go together and never at the real cache or into results/', true],
  ['links not followed (the old behaviour)', 'const real = p => fs.realpathSync(p);', 'const real = p => path.resolve(p);', 'a link to results/ or into the study folder is refused as the path is', true],
  ['a fixture\'s file linked out of its folder let through', 'if (path.dirname(r) !== P.cache) throw', 'if (false) throw', 'a fixture\'s file that is a link out of its folder is refused', true],
  ['FROZEN without tools/lib.js and cand_select_lib.js (the old list)', "  'research/props_v2/cand_select_lib.js', 'tools/lib.js',\n", '', 'FROZEN holds every module the scorer loads and every data file it reads', true],
  ['FROZEN without the data (the old list)', "'tools/props_record.js', ...DATA_FROZEN];", "'tools/props_record.js'];", 'FROZEN holds every module the scorer loads and every data file it reads', true],
  ['no refusal without a validity file', "  if (!fs.existsSync(f)) throw new Refusal('no validity check", "  if (false) throw new Refusal('no validity check", 'no validity file: refused', true],
  ['a VOID check read as holding', "const failed = ['v0', 'v2', 'v3']", 'const failed = []', 'a VOID check (V0 did not hold) is read as VOID, not refused', true],
  ['a VOID check refused, writing nothing (the old behaviour)', '  return { file: f, v, sha: got.sha256, voided: failed };', "  if (failed.length) throw new Refusal('the validity check is VOID'); return { file: f, v, sha: got.sha256, voided: failed };", 'a VOID check (V0 did not hold) is read as VOID, not refused', true],
  ['a verdict not held to its checks', "!v.verdict.startsWith(failed.length ? 'VOID' : 'the bar applies')", 'false', 'a check whose verdict is not what its checks say: refused', true],
  ['other thresholds let through', 'if (JSON.stringify(v.thresholds) !== JSON.stringify(V.TH))', 'if (false)', 'a check on other thresholds: refused', true],
  ['a check with no SHA-256 let through', "if (!v.files || !/^[0-9a-f]{64}$/.test(v.files.csv || '') || !/^[0-9a-f]{64}$/.test(v.files.reads || ''))", 'if (false)', 'a check with no SHA-256 of what it read: refused', true],
  ['the lines not held to the bytes the validity check read (the old behaviour)', 'if (csv.sha256 !== v.files.csv || rd.sha256 !== v.files.reads)', 'if (false)', 'lines that are not the validity check\'s bytes refuse (same count, prices swapped)', true],
  ['a second run let through', '  if (st) {', '  if (false) {', 'a result already written: refused (decided once)', true],
  ['a result that is not whole read as decided (the old behaviour)', "if (r && typeof r.verdict === 'string' && /^(PASS|FAIL|VOID)\\b/.test(r.verdict)) throw", 'if (true) throw', 'a result that is not whole refuses as cut off, not as decided ({} and truncated)', true],
  ['a part left by a cut-off run let through', "  if (lstatOr(out + '.part')) throw", '  if (false) throw', 'a part left by a run cut off while writing: refused', true],
  ['the result written straight onto its path (the old behaviour)', "fd = fs.openSync(part, 'wx');", "fd = fs.openSync(out, 'w');", 'a write that fails leaves no result and no part', true],
  ['a second keep written over the first', 'try { fs.linkSync(part, out); }', 'try { fs.copyFileSync(part, out); }', 'of two keeps only the first is kept', true],
  ['a per-line row written into the result', 'seconds: Math.round((Date.now() - t0) / 1000),\n  };', 'seconds: Math.round((Date.now() - t0) / 1000),\n    perLine: ac.lines.map(x => ({ stat: x.stat, line: x.line })),\n  };', 'the result is aggregates only: no player id, no per-line row', false],
  ['the phrase left out of the verdict', "`${bar.verdict} (pre-game inferred, not shown)`", 'bar.verdict', '"pre-game inferred, not shown" in the result and its log', false],
  ['a VOID scored as if it held', 'if (val.voided.length) {', 'if (false) {', 'a VOID check is recorded as the outcome: VOID, the check\'s figures, and no score', false],
];
/* and each one rule of the reproduction broken: test2024.js --check must stop (its outcome file put in a temporary
   folder for the run, so a check that did not stop could not write over results/test2024_check.json) */
const CHECK_PLANTS = [
  ['the Brier difference resampled on another seed', 'PR.bootCI([...gB.values()], 10000, 3)', 'PR.bootCI([...gB.values()], 10000, 4)', /does not score as results\/cand_fix_score\.json says: candidateMinusBaseline/],
  ['both sides\' units summed wrong', 'units: r2(out.over.candidate.units + out.under.candidate.units)', 'units: r2(out.over.candidate.units - out.under.candidate.units)', /does not score as results\/cand_fix_score\.json says: units/],
  ['a void graded as a no call', 'if (!played.has(k)) { voids++; continue; }', 'if (!played.has(k)) { noCall++; continue; }', /is not cand_fix_lib\.js archiveLines/],
  ['DraftKings\' margin split between the two sides', 'pMarket: F.propFairOver(l.over, l.under)', 'pMarket: F.propImplied(l.over) / (F.propImplied(l.over) + F.propImplied(l.under))', /is not cand_fix_lib\.js archiveLines/],
  ['A refitted without the rule\'s grids', 'rule.X, rule.grids, { rho:', 'rule.X, {}, { rho:', /does not refit/],
  ['B\'s yardstick on 1,999 resamples', 'const NBOOT_W = 2000;', 'const NBOOT_W = 1999;', /B's yardstick does not give/],
  ['the 2023-24 walk-forward on tools/props.js\'s 2025 fold', "C.projectX(W.rows, W.sides, foldP['2024'], {}, sel)", "C.projectX(W.rows, W.sides, foldP['2025'], {}, sel)", /2023-24 walk-forward does not give/],
  ['brief() copied wrong', 'meanMae: r4(sc.meanMae)', 'meanMae: r5(sc.meanMae)', /brief is not cand_fix\.js's/],
  ['FROZEN without tools/lib.js', "  'research/props_v2/cand_select_lib.js', 'tools/lib.js',\n", "  'research/props_v2/cand_select_lib.js',\n", /FROZEN leaves out what the run stands on: tools\/lib\.js/],
  ['the unrounded units summed on one side', 'const u = betUnits(x); if (u) units += u.units;', "const u = betUnits(x); if (u && u.side === 'over') units += u.units;", /figures before rounding do not round/],
  ['V1\'s bar at 94%', 'const V1_PCT = 95;', 'const V1_PCT = 94;', /V1's bar is not validity_lib\.js's/],
];
function plants() {
  const src = fs.readFileSync(path.join(__dirname, 'test2024.js'), 'utf8'), copy = path.join(__dirname, 'test2024.plant.tmp.js');
  const res = [];
  const once = (what, from) => { const n = src.split(from).length - 1; if (n !== 1) throw new Error(`plant "${what}": its text is in test2024.js ${n} times, not once`); };
  const away = ["CHECK_OUT = path.join(OUTD, 'test2024_check.json')", `CHECK_OUT = ${JSON.stringify(path.join(tmp, 'test2024_check.plant.json'))}`];
  once('the check\'s outcome file', away[0]);
  for (const [what, from, to, want] of CHECK_PLANTS) {
    once(what, from);
    if (ONLY && !what.includes(ONLY)) continue;
    try {
      fs.writeFileSync(copy, src.replace(away[0], () => away[1]).replace(from, () => to));
      const r = spawnSync(process.execPath, [copy, '--check'], { env: clean(process.env), encoding: 'utf8', timeout: 600000 });
      const caught = r.status !== 0 && want.test(r.stderr || '') && !fs.existsSync(path.join(tmp, 'test2024_check.plant.json'));
      const said = ((r.stderr || '').split('\n').find(l => /^Error: /.test(l)) || '').slice(0, 160);
      res.push({ planted: `--check: ${what}`, mustFail: String(want), failed: said || null, caught });
      console.log(caught ? 'ok  ' : 'MISS', `planted (--check): ${what} -> ${said || 'nothing failed'}`);
    } finally { fs.rmSync(copy, { force: true }); }
  }
  for (const [what, from, to, want, fast] of PLANTS_LIST) {
    const n = src.split(from).length - 1;
    if (n !== 1) throw new Error(`plant "${what}": its text is in test2024.js ${n} times, not once`);
    if (ONLY && !what.includes(ONLY)) continue;
    try {
      fs.writeFileSync(copy, src.replace(from, () => to));
      const r = spawnSync(process.execPath, [__filename, '--script', copy, ...(fast ? ['--fast'] : [])], { env: clean(process.env), encoding: 'utf8', timeout: 1200000 });
      const failed = /FAILED (.*?) \[detail /.exec(r.stderr || ''), caught = r.status === 1 && !!failed && failed[1] === want;
      res.push({ planted: what, mustFail: want, failed: failed ? failed[1] : null, caught });
      console.log(caught ? 'ok  ' : 'MISS', `planted: ${what} -> ${failed ? 'failed: ' + failed[1] : 'nothing failed'}`);
    } finally { fs.rmSync(copy, { force: true }); }
  }
  return res;
}

try {
  const t0 = Date.now();
  run();
  out.seconds = Math.round((Date.now() - t0) / 1000);
  if (PLANTS) { out.plants = plants(); if (out.plants.some(p => !p.caught)) throw new Error('a planted break was not caught'); }
  if (SCRIPT === path.join(__dirname, 'test2024.js') && !FAST && !ONLY) {
    fs.writeFileSync(path.join(OUTD, 'test2024_test.json'), JSON.stringify({ what: 'research/props_v2/test2024_test.js: test2024.js on made-up lines in a temporary folder (no real line read)', ...out }, null, 1) + '\n');
    console.log(`all ${out.checks.length} checks passed${out.plants ? `; all ${out.plants.length} planted breaks caught` : ''}: results/test2024_test.json written`);
  } else console.log(`all ${out.checks.length} checks passed`);
} catch (e) { console.error('FAILED', e.message); process.exitCode = 1; }
finally { fs.rmSync(tmp, { recursive: true, force: true }); }
