/* Tests for the props model, DraftKings' closing-line record and the shadow ledger (tools/props_feed.js, props.js,
 * props_record.js, props_ledger.js, props_check.js), on stubbed ESPN answers, a recorded one (tools/fixtures/) and a
 * scratch data folder: no network, and the real ledger and record are never written.
 *
 *   node tools/test_props.js        must end "all good"
 *
 * 1. the parse: the first of a main line's two items is the Over, held on the recorded answer against its ladder;
 *    the rung cross-check drops a contradicted pair and keeps one it cannot judge; unpaired items, alternates, prices
 *    that are no price; every page read in order; a 404 is "none", a refusal or a junk body "failed"; players matched
 *    by ESPN id
 * 2. the record: only finals of the regular season and playoffs with an ESPN id, each read once; a 404 never asked for
 *    again; a failure asked again, given up after three; a game's rows never rewritten
 * 3. the model: every distribution sums to 1, every ladder falls, the over is a ladder rung, a double-double at least as
 *    likely as a triple, a combo's mean the sum of its parts, the published projections in shape, nobody the report
 *    has out projected
 * 4. the ledger: the bar on record before the first call; a call made, rewritten before tip-off, frozen at it and never
 *    moved after; graded against the closing lines and the box score as worked out here on their own; the check clean
 *    on each honest run and failing on each planted change
 * 5. the bar on made-up lines: no verdict one short; PASS; FAIL level, FAIL with no bets, FAIL with the bets down, FAIL
 *    when only one score's interval is below 0; the calls stopping after a FAIL
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const REAL = path.resolve(__dirname, '..', 'data');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-props-'));
process.env.NBA_DATA_DIR = tmp;
process.env.NBA_FETCH_PAUSE_MS = '0';
const L = require('./lib');
const F = require('./props_feed');
const PM = require('./props');
const REC = require('./props_record');
const PL = require('./props_ledger');
const PC = require('./props_check');

let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const quiet = () => {};
const athlete = id => ({ $ref: `http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/2027/athletes/${id}?lang=en&region=us` });
const item = (type, id, line, price) => ({ athlete: athlete(id), type: { id: String(type), name: 'x' }, odds: { american: { value: price } }, current: line == null ? {} : { target: { value: line } } });
const page = (items, pageIndex = 1, pageCount = 1) => ({ count: items.length, pageIndex, pageSize: 1000, pageCount, items });
/* the test's own negative binomial, by the gamma-Poisson closed form term by term (not props.js's recurrence) */
function sfOwn(k, mu, v) {
  if (v <= mu) { let c = 0; for (let j = 0; j < k; j++) { let lf = 0; for (let i = 2; i <= j; i++) lf += Math.log(i); c += Math.exp(j * Math.log(mu) - mu - lf); } return 1 - c; }
  const r = mu * mu / (v - mu), p = r / (r + mu); let c = 0;
  for (let j = 0; j < k; j++) c += Math.exp(PM.lgamma(j + r) - PM.lgamma(r) - PM.lgamma(j + 1) + r * Math.log(p) + j * Math.log(1 - p));
  return 1 - c;
}

(async () => {
  console.log('1. the parse');
  {
    const P = F.propParse([item(1, '11', 20.5, '-130'), item(1, '11', 20.5, '+105'), item(3, '11', 6.5, 'EVEN'), item(3, '11', 6.5, '-120')]);
    check(P.mains.length === 2 && P.mains[0].stat === 'pts' && P.mains[0].over === -130 && P.mains[0].under === 105 && P.mains[1].over === 100, 'a main line is two adjacent items, the first the Over; EVEN reads 100');
    /* the rung at line + 0.5 is the same bet as the Over */
    const near = r => F.propParse([item(1, '12', 20.5, '-150'), item(1, '12', 20.5, '+120'), item(218, '12', 21, r)]);
    check(near('-145').mains.length === 1, 'a pair the rung agrees with is kept');
    const c = near('+118');
    check(c.mains.length === 0 && c.dropped.contradicted === 1, 'a pair the rung contradicts (nearer the second item, sides 3+ points apart) is dropped');
    check(near('+600').mains.length === 1, 'a rung far from both sides (an archived junk rung) is no evidence: kept');
    const even = F.propParse([item(1, '13', 20.5, '-112'), item(1, '13', 20.5, '-110'), item(218, '13', 21, '-109')]);
    check(even.mains.length === 1, 'a pair whose sides are under 3 points apart is kept: a rung cannot tell them apart');
    const un = F.propParse([item(1, '14', 9.5, '-110'), item(2, '14', 3.5, '-110'), item(1, '14', 9.5, '-110'), item(4, '15', 1.5, '-110'), item(4, '15', 1.5, '-110'), item(4, '15', 1.5, '-110')]);
    check(un.mains.length === 0 && un.dropped.unpaired === 6, 'two items that are not adjacent, or three on one line, are no pair');
    const alt = F.propParse([item(90, '16', 18.5, '-160'), item(90, '16', 18.5, '+125'), item(90, '16', 17.5, '-112'), item(90, '16', 17.5, '-108')]);
    check(alt.mains.length === 1 && alt.mains[0].line === 17.5 && alt.dropped.alternate === 1, 'two lines on one stat: the one nearest even is the main line, the other an alternate');
    const np = F.propParse([item(1, '17', 9.5, 'OFF'), item(1, '17', 9.5, '-110'), item(92, '17', null, '+40'), item(218, '17', 10, '')]);
    check(np.mains.length === 0 && np.yes.length === 0 && np.ladders.length === 0, 'a price that is not a number of 100 or more (OFF, +40, blank) is no price');
    const team = F.propParse([{ team: { $ref: '.../teams/13' }, type: { id: '98' }, odds: { american: { value: '-115' } }, current: { target: { value: 115.5 } } }, item(72, '18', 110.5, '-110')]);
    check(!team.mains.length && !team.ladders.length && !team.yes.length, 'team markets, halves and quarters are left out');
    check(F.propFairOver(-110, -110) === 1 - 110 / 210 && Math.abs(F.propFairOver(-130, 105) - (1 - 100 / 205)) < 1e-12, 'the fair Over carries the whole margin: 1 - the Under\'s implied chance');
    const a = 0.068, rungs = [-1800, -400, -150, -110, 120, 250, 900].map(pr => F.propFairRung(pr, a));
    check(rungs.every((x, i) => x > 0 && x < 1 && (!i || x < rungs[i - 1])) && Math.abs(F.propFairRung(-110, a) - (110 / 210 - a)) < 1e-12 && Math.abs(F.propFairRung(900, a) - 0.1 * (1 - a / 0.3)) < 1e-12,
      'a rung\'s fair chance: its implied chance less the measured margin between 30% and 70%, scaled beyond, always between 0 and 1 and falling with the price');
    check(Math.abs(F.propFairYes(940, 2) - (100 / 1040) / 2) < 1e-12 && F.propFairYes(-500, 1.41) <= 1, 'a Yes price\'s fair chance: its implied chance over the measured factor');
    /* the recorded answer: opening night, Celtics at Pistons (Cunningham and Tatum), read 15 October 2026 */
    const rec = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'propbets_401909088.json'), 'utf8'));
    const R = F.propParse(F.propItems([rec]));
    const rung = new Map(R.ladders.map(x => [x.player + '|' + x.stat + '|' + x.k, x.price]));
    let held = 0, against = 0;
    for (const m of R.mains) { const r = rung.get(m.player + '|' + m.stat + '|' + (m.line + 0.5)); if (r == null) continue; const io = F.propImplied(m.over), iu = F.propImplied(m.under), ir = F.propImplied(r); if (Math.abs(io - iu) < 0.03) continue; if (Math.abs(ir - io) < Math.abs(ir - iu)) held++; else against++; }
    check(R.mains.length === 16 && held >= 8 && against === 0, `the recorded answer: 16 main lines, the first item the Over on every one whose sides its ladder can tell apart (${held} held, ${against} against)`);
    const cade = R.mains.find(m => m.player === '4432166' && m.stat === 'pts');
    check(cade && cade.line === 24.5 && cade.over === -104 && cade.under === -123, 'Cunningham\'s points: 24.5, Over -104, Under -123');
    check(R.yes.length === 4 && R.yes.every(y => ['dd', 'td'].includes(y.market)), 'double- and triple-double prices read as Yes markets');
    const ladderOk = [...new Set(R.ladders.map(x => x.player + '|' + x.stat))].every(k => { const ks = R.ladders.filter(x => x.player + '|' + x.stat === k).map(x => x.k); return ks.every((v, i) => !i || v > ks[i - 1]); });
    check(ladderOk, 'each ladder is listed by k ascending');
    const roster = JSON.parse(fs.readFileSync(path.join(REAL, 'rosters_espn.json'), 'utf8'));
    const ids = new Set(Object.values(roster.teams).flat().map(a => a.id));
    check([...new Set(R.mains.map(m => m.player))].every(id => ids.has(id)), 'every athlete is matched to the hub by ESPN id, which is the hub\'s player id');
    /* reading: pages, 404, refusals, junk */
    const two = [page([item(1, '21', 10.5, '-110')], 1, 2), page([item(1, '21', 10.5, '-110')], 2, 2)];
    const asked = [];
    let r = await F.propRead('999', async url => { asked.push(url); return two[+/page=(\d+)/.exec(url)[1] - 1]; });
    check(r.status === 'ok' && r.items.length === 2 && asked.length === 2 && F.propParse(r.items).mains.length === 1, 'every page is read, in order (a pair split across two pages is still a pair)');
    r = await F.propRead('999', async () => { throw new Error('HTTP 404 https://x'); });
    check(r.status === 'none', 'a 404 ("No propBets found") is none: nothing posted');
    r = await F.propRead('999', async () => { throw new Error('HTTP 503 https://x'); });
    check(r.status === 'failed', 'a refusal is a failed read');
    r = await F.propRead('999', async () => ({ hello: 'world' }));
    check(r.status === 'failed', 'a body that is not a propBets page is a failed read');
    r = await F.propRead('999', async () => '<html>');
    check(r.status === 'failed', 'so is an HTML body');
    r = await F.propRead('999', async () => ({ error: { message: 'No propBets found for eventId 999 and provider 100', code: 404 } }));
    check(r.status === 'none', 'a 404 body read as JSON is none too');
  }

  console.log('2. the record');
  {
    fs.writeFileSync(path.join(tmp, 'games.csv'), '');
    const g = (id, status, type, espn, date) => ({ game_id: id, season: id.slice(0, 4), date, type, status, espn_id: espn, home: id.split('_')[3], away: id.split('_')[2] });
    const games = [g('2027_20261020_BOS_DET', 'final', 'REG', '401', '2026-10-20'), g('2027_20261020_OKC_SAS', 'final', 'REG', '402', '2026-10-20'), g('2027_20261020_PHI_NYK', 'live', 'REG', '403', '2026-10-20'),
      g('2027_20261021_GSW_LAL', 'scheduled', 'REG', '404', '2026-10-21'), g('2027_20261016_MIA_ORL', 'final', 'PRE', '405', '2026-10-16'), g('2027_20261020_CHA_BKN', 'final', 'REG', '', '2026-10-20'), g('2027_20261020_ATL_ORL', 'final', 'REG', '406', '2026-10-20')];
    const answers = { '401': page([item(1, '11', 20.5, '-115'), item(1, '11', 20.5, '-105'), item(3, '11', 6.5, '+110'), item(3, '11', 6.5, '-140')]), '402': 'HTTP 404', '406': 'HTTP 500' };
    const asked = [];
    const stub = async url => { const e = /events\/(\d+)\//.exec(url)[1]; asked.push(e); const a = answers[e]; if (typeof a === 'string') throw new Error(a + ' ' + url); return a; };
    const now = () => new Date('2026-10-21T15:00:00Z');
    await REC.recordClosing({ games, getJSON: stub, now, log: quiet });
    check(JSON.stringify([...asked].sort()) === JSON.stringify(['401', '402', '406']), 'only finals of the regular season and playoffs with an ESPN id are asked for (not a live, scheduled or preseason game)');
    const rows = REC.readRecord(2027), reads = REC.readReads();
    check(rows.length === 2 && rows[0].stat === 'pts' && rows[0].over === -115 && rows[1].stat === 'reb' && rows[1].under === -140, 'a read game\'s main lines are written, the first item the Over');
    check(reads['2027_20261020_BOS_DET'].status === 'ok' && reads['2027_20261020_OKC_SAS'].status === 'none' && reads['2027_20261020_ATL_ORL'].status === 'failed', 'each read is logged: ok, none (a 404), failed');
    asked.length = 0;
    await REC.recordClosing({ games, getJSON: stub, now, log: quiet });
    check(JSON.stringify(asked) === JSON.stringify(['406']), 'a game read ok or none is never asked for again; a failed one is');
    await REC.recordClosing({ games, getJSON: stub, now, log: quiet });
    check(REC.readReads()['2027_20261020_ATL_ORL'].status === 'gave_up', 'given up after three failures');
    asked.length = 0;
    await REC.recordClosing({ games, getJSON: stub, now, log: quiet });
    check(!asked.length, 'and then never asked for again');
    const before = fs.readFileSync(REC.recordFile(2027), 'utf8');
    answers['401'] = page([item(1, '11', 30.5, '-115'), item(1, '11', 30.5, '-105')]);
    const r2 = { ...REC.readReads() }; r2['2027_20261020_BOS_DET'] = { ...r2['2027_20261020_BOS_DET'], status: 'failed' }; REC.writeReads(r2);
    await REC.recordClosing({ games, getJSON: stub, now, log: quiet });
    check(fs.readFileSync(REC.recordFile(2027), 'utf8') === before, 'a game\'s rows, once written, are never rewritten');
    for (const f of fs.readdirSync(tmp)) fs.rmSync(path.join(tmp, f), { recursive: true, force: true });
  }

  console.log('3. the model');
  {
    let sums = true, mono = true;
    for (const [mu, v] of [[0.3, 0.4], [1.2, 1.1], [4, 7], [24.3, 70], [38, 160], [55, 30]]) {
      const pm = PM.nbPmf(400, mu, v); const s = pm.reduce((a, b) => a + b, 0); if (Math.abs(s - 1) > 1e-9) sums = false;
      let prev = 1; for (let k = 0; k <= 80; k++) { const q = PM.nbSf(k, mu, v); if (q > prev + 1e-12) mono = false; prev = q; }
      if (Math.abs(PM.nbSf(Math.floor(mu) + 1, mu, v) - sfOwn(Math.floor(mu) + 1, mu, v)) > 1e-9) sums = false;
    }
    check(sums, 'every distribution sums to 1, and its tail is the closed form\'s');
    check(mono, 'every ladder falls: P(stat >= k) never rises with k');
    check(PM.pOver(24.5, 22, 60) === PM.nbSf(25, 22, 60), 'the over on a half line is the rung above it');
    const V = { pts: [7.5, 0.72], reb: [1.6, 0.98], ast: [1.3, 1], stl: [1.07, 0.92], blk: [1.15, 1] };
    const mu = { pts: 26, reb: 9.5, ast: 7, stl: 1.2, blk: 0.6 };
    const p10 = ['pts', 'reb', 'ast', 'stl', 'blk'].map(k => PM.nbSf(10, mu[k], PM.nbVar(mu[k], V[k])));
    let pr = [1, 0, 0, 0, 0, 0]; for (const q of p10) { const nx = [0, 0, 0, 0, 0, 0]; for (let m = 0; m < 5; m++) { nx[m] += pr[m] * (1 - q); nx[m + 1] += pr[m] * q; } pr = nx; }
    const d0 = PM.doublesProb(mu, V, 0), d4 = PM.doublesProb(mu, V, 0.4);
    check(Math.abs(d0.dd - (1 - pr[0] - pr[1])) < 1e-6 && Math.abs(d0.td - (1 - pr[0] - pr[1] - pr[2])) < 1e-6, 'with no correlation the double-double is the five stats taken apart');
    check(d4.td > d0.td && d4.dd >= d4.td, 'with it, a triple-double is likelier, and never likelier than a double-double');
    const pj = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'props.json'), 'utf8'));
    const all = Object.values(pj.upcoming).flatMap(g => Object.values(g.players).flat());
    /* in the off-season there is no game to come: the shape checks below then hold on nothing, and say so */
    if (!all.length) console.log('  --   no game to come in props.json: the published projections\' checks hold on nothing');
    check(!all.length || (all.length > 50 && Object.values(pj.upcoming).every(g => g.type !== 'PRE')), `the published projections: ${all.length} players on ${Object.keys(pj.upcoming).length} games to come, no preseason game`);
    check(all.every(p => typeof p.id === 'string' && p.min >= PM.MIN_SHOWN && p.min <= 46 && PM.ALL.every(k => Number.isFinite(p.mu[k]) && p.mu[k] >= 0) && p.dd >= p.td && p.td >= 0 && p.dd <= 1), 'each has minutes, the eleven means, a double-double at least as likely as a triple');
    check(all.every(p => Object.entries(PM.COMBOS).every(([c, parts]) => Math.abs(p.mu[c] - parts.reduce((s, k) => s + p.mu[k], 0)) < 0.03)), 'a combo\'s mean is the sum of its parts\'');
    check(PM.ALL.every(k => Array.isArray(pj.params.var[k]) && pj.params.var[k].length === 2 && pj.params.var[k].every(Number.isFinite)), 'every stat\'s spread is published (A, B)');
    let ladders = true;
    for (const p of all.slice(0, 200)) for (const k of PM.ALL) { let prev = 1; for (let j = 0; j < 60; j++) { const q = PM.nbSf(j, p.mu[k], PM.nbVar(p.mu[k], pj.params.var[k])); if (q > prev + 1e-12) ladders = false; prev = q; } }
    check(ladders, 'every published player\'s every ladder falls');
    /* the report read here on its own: listed out before his return date, or Out with none, or suspended */
    const inj = JSON.parse(fs.readFileSync(path.join(REAL, 'injuries.json'), 'utf8'));
    let outShown = 0, outCount = 0;
    for (const g of Object.values(pj.upcoming)) for (const t of [g.home, g.away]) {
      const ids = new Set(g.players[t].map(p => p.id));
      for (const x of inj.teams[t] || []) {
        const out = /^suspen/i.test(x.status || '') || (x.returns ? g.date < x.returns : /^out/i.test(x.status || ''));
        if (!out) continue;
        outCount++; if (ids.has(x.id)) outShown++;
      }
    }
    check(outShown === 0, `nobody the injury report has out of a game is projected for it (${outCount} absences checked; report of ${inj.date})`);
    /* what state.json carries for the page (publish.js propsState) */
    const PUB = require('./publish');
    const st = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'state.json'), 'utf8'));
    const nowIso = new Date().toISOString().slice(0, 16) + 'Z';
    const firstProps = Object.keys(JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'props.json'), 'utf8')).upcoming)[0];
    const slate = st.slate.map(g => g.id === firstProps ? { ...g, status: 'live' } : g);      // one game has tipped since the job's run
    const ps = PUB.propsState(slate, nowIso);
    const onSlate = new Map(slate.map(g => [g.id, g]));
    check(ps && ps.onTrial === true && ps.layout.join() === 'name,team,pos,min,pts,reb,ast,tpm,stl,blk,dd,td' && PM.ALL.every(k => ps.dist.var[k]), 'state.props: on trial, the players\' layout, every stat\'s spread');
    check(Object.entries(ps.games).every(([gid, g]) => onSlate.has(gid) && onSlate.get(gid).status === 'scheduled' && !(g.tip && g.tip <= nowIso) && Object.values(g.players).every(a => a.length === ps.layout.length && [g.away, g.home].includes(a[1]))),
      'only the slate\'s games not yet started, each player on one of its two sides');
    check(!firstProps || (!ps.games[firstProps] && (Object.keys(pj.upcoming).length === 1 || Object.keys(ps.games).length > 0)), 'a game that has tipped since the job\'s run is left out');
    check(ps.ledger && ps.ledger.bar.lines === PL.BAR.lines && !(ps.ledger.decision) && !/pass/i.test(ps.ledger.summary.standing), 'the ledger\'s running numbers, no verdict and no word of passing before the bar is judged');
    check(ps.fair && ps.fair.rung && PM.STATS.filter(k => k !== 'stl' && k !== 'blk').every(k => ps.fair.rung.a[k] > 0) && ps.fair.yes.c.dd > 1, 'the measured fair-chance constants for rungs and Yes markets');
    /* the availability rule on a made-up report */
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-avail-'));
    fs.writeFileSync(path.join(dir, 'injuries.json'), JSON.stringify({ date: '2026-10-19', teams: { DET: [{ id: 'a', status: 'Out', returns: '' }, { id: 'b', status: 'Day-To-Day', returns: '2026-10-21' }, { id: 'c', status: 'Day-To-Day', returns: '2026-10-19' }, { id: 'd', status: 'Suspension', returns: '' }] } }));
    fs.writeFileSync(path.join(dir, 'rosters_espn.json'), JSON.stringify({ date: '2026-10-19', teams: { DET: 'abcdefghijkl'.split('').map(id => ({ id })), BOS: [{ id: 'f' }] }, asOf: { DET: '2026-10-18', BOS: '2026-10-19' } }));
    const av = PM.availability(dir)({ date: '2026-10-20' }, 'DET', {});
    check(JSON.stringify(av.out.map(x => x.id)) === '["a","b","d"]' && !av.ids.includes('f') && av.ids.includes('c'), 'out: Out, before the return date, suspended; back on his return date; a player on a later roster read belongs to that club');
  }

  console.log('4. the ledger');
  {
    const T = s => new Date(s);
    const G1 = '2027_20261020_BOS_DET', G2 = '2027_20261021_GSW_LAL';
    const params = { var: Object.fromEntries(PM.ALL.map(k => [k, k === 'pts' ? [7.5, 0.72] : [1.4, 0.95]])), rho: 0.35 };
    const mus = (pts, reb) => ({ pts, reb, ast: 4, tpm: 2, stl: 1, blk: 0.5, pra: pts + reb + 4, pr: pts + reb, pa: pts + 4, ar: reb + 4, sb: 1.5 });
    const P = (id, min, pts, reb) => ({ id, name: id, pos: 'G', min, mu: mus(pts, reb), dd: 0.1, td: 0.01 });
    const up = (v = 0) => ({ [G1]: { date: '2026-10-20', tip: '2026-10-20T23:30Z', type: 'REG', away: 'BOS', home: 'DET', players: { BOS: [P('101', 34, 22 + v, 6), P('102', 20, 9, 3)], DET: [P('104', 26, 11, 4), P('105', 10, 3, 2)] } },
      [G2]: { date: '2026-10-21', tip: '2026-10-22T02:00Z', type: 'REG', away: 'GSW', home: 'LAL', players: { GSW: [P('201', 33, 25, 5)], LAL: [P('202', 35, 27, 8)] } } });
    let games = [{ game_id: G1, season: 2027, date: '2026-10-20', type: 'REG', status: 'scheduled', tip: '2026-10-20T23:30Z', home: 'DET', away: 'BOS', espn_id: '501' },
      { game_id: G2, season: 2027, date: '2026-10-21', type: 'REG', status: 'scheduled', tip: '2026-10-22T02:00Z', home: 'LAL', away: 'GSW', espn_id: '502' }];
    const y = (pts, reb) => ({ pts, reb, ast: 3, tpm: 2, stl: 1, blk: 0 });
    const boxes = { [G1]: { BOS: [{ id: '101', min: 35, dnp: false, y: y(25, 5) }, { id: '102', min: 18, dnp: false, y: y(8, 4) }, { id: '103', min: 12, dnp: false, y: y(6, 1) }], DET: [{ id: '104', min: 0, dnp: true, y: y(0, 0) }, { id: '105', min: 14, dnp: false, y: y(4, 3) }] } };
    const snap = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-prev-')); for (const f of fs.readdirSync(tmp)) if (/^props_/.test(f)) fs.copyFileSync(path.join(tmp, f), path.join(d, f)); return d; };
    const prevOf = d => { const get = n => fs.existsSync(path.join(d, n)) ? fs.readFileSync(path.join(d, n), 'utf8') : null; const rec = {}; for (const f of fs.readdirSync(d)) if (/^props_\d{4}\.csv$/.test(f)) rec[f] = get(f);
      return get('props_shadow.json') ? { ledger: JSON.parse(get('props_shadow.json')), lines: get('props_shadow_lines.csv') || '', reads: JSON.parse(get('props_reads.json') || '{}'), record: rec } : null; };
    const lineText = () => fs.existsSync(PL.LINES()) ? fs.readFileSync(PL.LINES(), 'utf8') : '';
    const runAt = (t, u) => PL.run({ upcoming: u, params, games, now: T(t), boxes, log: quiet });
    const checkAt = (t, prev) => PC.check({ Lg: PL.readLedger(), lineText: lineText(), prev, games, boxes, now: T(t) });

    /* the bar on record first */
    const Lg0 = PL.newLedger(T('2026-10-15T09:00:00Z')); Lg0.summary = PL.summarize(Lg0, [], { by: new Map(), reads: {} }); fs.writeFileSync(PL.LEDGER(), PL.stringify(Lg0));
    let s0 = snap();
    runAt('2026-10-19T12:00:00Z', up());
    let Lg = PL.readLedger();
    check(Lg.bar_registered === '2026-10-15T09:00Z' && Object.values(Lg.calls).every(c => c.called_at > Lg.bar_registered) && JSON.stringify(Lg.bar) === JSON.stringify(PL.BAR), 'the bar is on record before the first call');
    check(Object.keys(Lg.calls).length === 2 && Lg.calls[G1].players['101'].length === PL.CALL_LAYOUT.length && Lg.calls[G1].players['101'][1] === 22, 'a call for each game to come: every player\'s minutes, eleven means and double chances');
    let bad = checkAt('2026-10-19T12:00:00Z', prevOf(s0));
    check(!bad.length, 'the check is clean on the first run' + (bad.length ? ': ' + bad.join('; ') : ''));
    let s1 = snap();
    runAt('2026-10-20T12:00:00Z', up(2));
    Lg = PL.readLedger();
    check(Lg.calls[G1].players['101'][1] === 24 && Lg.calls[G1].called_at === '2026-10-20T12:00Z', 'a call is rewritten by a run before tip-off when its numbers change');
    bad = checkAt('2026-10-20T12:00:00Z', prevOf(s1)); check(!bad.length, 'and the check allows it' + (bad.length ? ': ' + bad.join('; ') : ''));
    let s2 = snap();
    runAt('2026-10-20T23:45:00Z', up(5));
    Lg = PL.readLedger();
    check(Lg.calls[G1].frozen && Lg.calls[G1].frozen_at === '2026-10-20T23:45Z' && Lg.calls[G1].players['101'][1] === 24, 'the first run after tip-off freezes the call, whatever the projections say now');
    check(Lg.calls[G2].players['201'][1] === 25 && !Lg.calls[G2].frozen, 'a later game\'s call stays open');
    bad = checkAt('2026-10-20T23:45:00Z', prevOf(s2)); check(!bad.length, 'the check is clean' + (bad.length ? ': ' + bad.join('; ') : ''));
    /* the likeliest way a frozen call moves: the last commit held it open before tip-off, and the run that froze it
       froze other numbers (the time it was made unchanged, or stamped as this run's after the tip) */
    { const frozenText = fs.readFileSync(PL.LEDGER(), 'utf8');
      const plant = (what, fn) => { const Lx = JSON.parse(frozenText); fn(Lx.calls[G1], Lx); fs.writeFileSync(PL.LEDGER(), PL.stringify(Lx));
        const b = checkAt('2026-10-20T23:45:00Z', prevOf(s2)); check(b.some(x => /changed after tip-off/.test(x)), `${what} fails the check${b.length ? '' : ' (it passed)'}`); };
      plant('a call open in the last commit frozen with a player\'s mean moved (called_at unchanged)', c => { c.players['101'][1] += 3; });
      plant('a call open in the last commit frozen with a new call stamped after its tip-off', (c, Lx) => { c.players['101'][1] += 3; c.called_at = Lx.run_at; });
      fs.writeFileSync(PL.LEDGER(), frozenText); }
    /* the final, its box score and its closing lines */
    games = games.map(g => g.game_id === G1 ? { ...g, status: 'final' } : g);
    let s3 = snap();
    runAt('2026-10-21T09:00:00Z', up());
    check(!PL.readLedger().calls[G1].graded, 'a final is not graded before its closing lines are read');
    const closing = page([item(1, '101', 23.5, '-118'), item(1, '101', 23.5, '-104'), item(3, '101', 5.5, '+115'), item(3, '101', 5.5, '-145'), item(1, '102', 8.5, '-110'), item(1, '102', 8.5, '-110'),
      item(1, '103', 5.5, '-110'), item(1, '103', 5.5, '-110'), item(1, '104', 10.5, '-110'), item(1, '104', 10.5, '-110')]);
    await REC.recordClosing({ games, getJSON: async () => closing, now: () => T('2026-10-21T14:00:00Z'), log: quiet });
    bad = checkAt('2026-10-21T14:00:00Z', prevOf(s3));
    check(bad.some(b => /left ungraded/.test(b)), 'a frozen call that can be graded and is not fails the check');
    runAt('2026-10-21T15:00:00Z', up());
    Lg = PL.readLedger();
    const lines = PL.readLines();
    const fit = params.var;
    const want = [['101', 'pts', 24, 23.5, -118, -104, 25], ['101', 'reb', 6, 5.5, 115, -145, 5], ['102', 'pts', 9, 8.5, -110, -110, 8]].map(([p, st, m, line, o, u, yy]) => ({ p, st, pm: +sfOwn(Math.floor(line) + 1, m, fit[st][0] * Math.pow(m, fit[st][1])).toFixed(4), pq: +(1 - F.propImplied(u)).toFixed(4), yy }));
    check(lines.length === 3 && want.every((w, i) => lines[i].player_id === w.p && lines[i].stat === w.st && lines[i].p_model === w.pm && lines[i].p_market === w.pq && lines[i].y === w.yy), 'graded: the model\'s chance from the frozen call and the fit, DraftKings\' fair chance, the stat from the box score (worked out here on their own)');
    check(Lg.calls[G1].graded && Lg.calls[G1].graded.voids === 1 && Lg.calls[G1].graded.noCall === 1, 'a player who did not play is void; a line on a player with no call is counted, not graded');
    check(Lg.summary.compared === 3 && Lg.summary.graded_games === 1 && /3 of 30000 graded lines toward the verdict/.test(Lg.summary.standing) && !Lg.decision, 'the summary gives the running numbers and no verdict');
    bad = checkAt('2026-10-21T15:00:00Z', prevOf(s3)); check(!bad.length, 'the check is clean on the graded run' + (bad.length ? ': ' + bad.join('; ') : ''));
    const s4 = snap();
    runAt('2026-10-21T18:00:00Z', up());
    bad = checkAt('2026-10-21T18:00:00Z', prevOf(s4)); check(!bad.length && PL.readLines().length === 3, 'a later run grades nothing twice' + (bad.length ? ': ' + bad.join('; ') : ''));

    /* every planted change fails the check */
    const good = { ledger: fs.readFileSync(PL.LEDGER(), 'utf8'), lines: lineText(), rec: fs.readFileSync(REC.recordFile(2027), 'utf8'), reads: fs.readFileSync(path.join(tmp, 'props_reads.json'), 'utf8') };
    const restore = () => { fs.writeFileSync(PL.LEDGER(), good.ledger); fs.writeFileSync(PL.LINES(), good.lines); fs.writeFileSync(REC.recordFile(2027), good.rec); fs.writeFileSync(path.join(tmp, 'props_reads.json'), good.reads); };
    const tamper = (what, fn, re) => { restore(); const Lx = JSON.parse(good.ledger); fn(Lx); fs.writeFileSync(PL.LEDGER(), PL.stringify(Lx)); const b = checkAt('2026-10-21T18:00:00Z', prevOf(s4)); check(b.some(x => re.test(x)), `${what} fails the check${b.length ? '' : ' (it passed)'}`); };
    tamper('a frozen call moved (a player\'s points mean)', x => { x.calls[G1].players['101'][1] = 23; }, /changed after tip-off \(players\)/);
    tamper('a frozen call deleted', x => { delete x.calls[G1]; }, /is gone/);
    tamper('a frozen call opened again', x => { x.calls[G1].frozen = false; }, /open again/);
    tamper('a call stamped at its tip-off', x => { x.calls[G2].called_at = '2026-10-22T02:00Z'; x.run_at = x.calls[G2].called_at; }, /at or after its tip-off/);
    tamper('the bar edited', x => { x.bar.lines = 3; }, /bar/);
    tamper('the bar\'s edge edited', x => { x.bar.edge = 0.01; }, /bar's numbers are not the registered ones/);
    tamper('the bar\'s interval edited to 80%', x => { x.bar.ci = [0.1, 0.9]; }, /bar's numbers are not the registered ones/);
    tamper('the bar\'s registration moved after the first call', x => { x.bar_registered = '2026-10-20T00:00Z'; }, /before the bar was registered|registration/);
    tamper('the summary edited', x => { x.summary.scores.model.logloss = 0.5; }, /summary/);
    tamper('a grade\'s counts edited', x => { x.calls[G1].graded.voids = 0; }, /counts|grade changed/);
    tamper('a verdict written early', x => { x.decision = { verdict: 'PASS', decided_at: '2026-10-21T18:00Z', lines: 30000 }; }, /verdict/);
    tamper('a fit edited', x => { x.fits[Object.keys(x.fits)[0]].var.pts = [9, 0.7]; }, /fit .* changed/);
    const tamperFile = (what, file, fn, re, prevSnap = s4) => { restore(); fs.writeFileSync(file, fn(fs.readFileSync(file, 'utf8'))); const b = checkAt('2026-10-21T18:00:00Z', prevOf(prevSnap)); check(b.some(x => re.test(x)), `${what} fails the check${b.length ? '' : ' (it passed)'}`); };
    /* a wrong grade written by the run that graded (the last commit before it had no lines), and one edited later */
    tamperFile('a graded chance written wrong', PL.LINES(), t => t.replace(/,101,pts,0\.\d{4}/, ',101,pts,0.9999'), /not what the frozen call/, s3);
    tamperFile('a graded stat written wrong', PL.LINES(), t => t.replace(/,102,pts,(0\.\d{4}),(0\.\d{4}),8/, ',102,pts,$1,$2,9'), /not what the frozen call/, s3);
    tamperFile('a graded line left out', PL.LINES(), t => t.split('\n').filter(l => !/,101,reb,/.test(l)).join('\n'), /not what the frozen call|counts/, s3);
    tamperFile('a graded chance edited after the commit that graded it', PL.LINES(), t => t.replace(/,101,pts,0\.\d{4}/, ',101,pts,0.9999'), /start of the file/);
    tamperFile('a graded line removed after it', PL.LINES(), t => t.split('\n').filter(l => !/,101,reb,/.test(l)).join('\n'), /start of the file/);
    tamperFile('a closing line re-taken', REC.recordFile(2027), t => t.replace(',101,pts,23.5,-118,-104', ',101,pts,24.5,-118,-104'), /closing lines changed/);
    tamperFile('a closing read rewritten', path.join(tmp, 'props_reads.json'), t => { const r = JSON.parse(t); r[G1].lines = 1; return JSON.stringify(r); }, /read changed|closing lines in the record/);
    restore();
    check(!checkAt('2026-10-21T18:00:00Z', prevOf(s4)).length, 'and the honest files pass again');
  }

  console.log('5. the bar');
  {
    const at = new Date('2026-12-01T12:00:00Z');
    const R = n => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };
    const make = (n, f) => { const r = R(); const rows = []; for (let i = 0; i < n; i++) rows.push(f(i, r, 'g' + Math.floor(i / 120))); return rows; };
    const sharp = (i, r, g) => { const p = i % 2 ? 0.3 : 0.7; return { game: g, stat: 'pts', pModel: p, pMarket: 0.5, over: -110, under: -110, result: r() < p ? 'over' : 'under' }; };
    check(PL.decide(make(PL.BAR.lines - 1, sharp), at) === null, 'no verdict one line short of the sample');
    const pass = PL.decide(make(PL.BAR.lines, sharp), at);
    check(pass && pass.verdict === 'PASS' && pass.lines === PL.BAR.lines && pass.scores.logloss_diff_ci90[1] < 0 && pass.flat.all.units > 0, 'PASS: both intervals below 0 and the bets up');
    const more = PL.decide(make(PL.BAR.lines + 5000, (i, r, g) => i < PL.BAR.lines ? sharp(i, r, g) : { ...sharp(i, r, g), pModel: 0.01, result: 'over' }), at);
    check(more && more.verdict === 'PASS', 'judged on the first 30,000 alone: lines after them change nothing');
    const level = PL.decide(make(PL.BAR.lines, (i, r, g) => ({ game: g, stat: 'pts', pModel: 0.5, pMarket: 0.5, over: -110, under: -110, result: r() < 0.5 ? 'over' : 'under' })), at);
    check(level && level.verdict === 'FAIL', 'FAIL level with the market');
    const nobets = PL.decide(make(PL.BAR.lines, (i, r, g) => ({ ...sharp(i, r, g), over: -400, under: -400 })), at);
    check(nobets && nobets.verdict === 'FAIL' && nobets.flat.all.bets === 0 && nobets.scores.logloss_diff_ci90[1] < 0, 'FAIL with both scores better and no bet at the bar: no bets is not up');
    /* nine lines in ten the model is sharp and no price tempts it; one in ten it leans 60% on a coin flip priced -110 a side */
    const downRows = make(PL.BAR.lines, (i, r, g) => i % 10 ? { ...sharp(i, r, g), over: -1000, under: -1000 } : { game: g, stat: 'pts', pModel: 0.6, pMarket: 0.5, over: -110, under: -110, result: r() < 0.5 ? 'over' : 'under' });
    const down = PL.decide(downRows, at);
    check(down && down.verdict === 'FAIL' && down.flat.all.units < 0 && down.flat.all.bets > 0 && down.scores.logloss_diff_ci90[1] < 0 && down.scores.brier_diff_ci90[1] < 0, `FAIL when the bets at the bar are down (${down && down.flat.all.units} units), both scores better`);
    /* both scores better on Brier, log loss sunk by a few sure calls that missed */
    const lossOnly = PL.decide(make(PL.BAR.lines, (i, r, g) => { const x = sharp(i, r, g); return i % 120 < 2 ? { ...x, pModel: 0.000001, result: 'over' } : x; }), at);
    check(lossOnly && lossOnly.verdict === 'FAIL' && lossOnly.scores.brier_diff_ci90[1] < 0 && lossOnly.scores.logloss_diff_ci90[1] >= 0, 'FAIL when only Brier\'s interval is below 0');
    /* a hair sharper than the market (55/45 on lines that go 52.8/47.2): both intervals straddle 0; the bets, on other lines, up */
    const straddle = PL.decide(make(PL.BAR.lines, (i, r, g) => { const u = r();
      if (i % 4 === 3) return { game: g, stat: 'pts', pModel: 0.6, pMarket: 0.6, over: 120, under: -150, result: u < 0.6 ? 'over' : 'under' };
      const up = i % 2 === 0; return { game: g, stat: 'pts', pModel: up ? 0.55 : 0.45, pMarket: 0.5, over: -1000, under: -1000, result: u < (up ? 0.528 : 0.472) ? 'over' : 'under' }; }), at);
    check(straddle && straddle.verdict === 'FAIL' && straddle.scores.logloss_diff_ci90[0] < 0 && straddle.scores.logloss_diff_ci90[1] > 0 && straddle.scores.brier_diff_ci90[0] < 0 && straddle.scores.brier_diff_ci90[1] > 0 && straddle.flat.all.units > 0,
      `FAIL when both intervals straddle 0, the bets up (log loss [${straddle && straddle.scores.logloss_diff_ci90}], Brier [${straddle && straddle.scores.brier_diff_ci90}]): the bar is read off the interval's upper end`);
    /* log loss better and Brier worse: sure things called surer than the market, coin-ish ones called worse, and bets up */
    const llOnly = PL.decide(make(PL.BAR.lines, (i, r, g) => {
      const u = r();
      if (i % 4 === 0) return { game: g, stat: 'pts', pModel: 0.5, pMarket: 0.75, over: -1000, under: -1000, result: u < 0.75 ? 'over' : 'under' };
      if (i % 4 === 3) return { game: g, stat: 'pts', pModel: 0.6, pMarket: 0.6, over: 120, under: -150, result: u < 0.6 ? 'over' : 'under' };
      return { game: g, stat: 'pts', pModel: 0.999, pMarket: 0.9, over: -1000, under: -1000, result: u < 0.999 ? 'over' : 'under' }; }), at);
    check(llOnly && llOnly.verdict === 'FAIL' && llOnly.scores.logloss_diff_ci90[1] < 0 && llOnly.scores.brier_diff_ci90[0] > 0 && llOnly.flat.all.units > 0, 'FAIL when only log loss\'s interval is below 0, the bets up');
    /* the bar's own bootstrap, worked here on its own from its written spec: mulberry32 seeded with bar.seed, bar.boot
       resamples of the games (each draw floor(u x n)), the sorted means at floor(q x boot) for q in bar.ci */
    const mulberry = seed => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
    const ownMeans = (groups, bar) => { const R = mulberry(bar.seed), n = groups.length, m = []; for (let b = 0; b < bar.boot; b++) { let s = 0, c = 0; for (let j = 0; j < n; j++) { const g = groups[Math.floor(R() * n)]; s += g[0]; c += g[1]; } m.push(s / c); } return m.sort((a, b) => a - b); };
    const pct = (m, q, bar) => Math.round(m[Math.floor(q * bar.boot)] * 1e6) / 1e6;
    check(PL.BAR.lines === 30000 && PL.BAR.edge === 0.03 && JSON.stringify(PL.BAR.ci) === '[0.05,0.95]' && PL.BAR.boot === 10000 && PL.BAR.seed === 0, 'the bar\'s numbers are written into it: 30,000 lines, a 3-point edge, the 5th to 95th percentile, 10,000 resamples, seed 0');
    { const gr = []; const r = R(); for (let i = 0; i < 180; i++) gr.push([(r() - 0.55) * 3, 120]);
      const m = ownMeans(gr, PL.BAR), ci = PL.barCI(gr, PL.BAR);
      check(ci[0] === pct(m, 0.05, PL.BAR) && ci[1] === pct(m, 0.95, PL.BAR), `the bar's interval is its own bootstrap's 5th and 95th percentiles, as worked out here ([${ci}])`); }
    /* a case whose log-loss interval ends between the 90th and the 95th percentile: the 90% interval reaches past 0, so it
       FAILs (an 80% interval would wrongly pass it); Brier wholly below 0 and the bets up, so the log loss alone decides */
    { const G = 250, per = 120;
      const build = c => { const r = R(); const rows = [];
        for (let gi = 0; gi < G; gi++) { const miss = 1 + Math.floor(r() * 5);
          for (let j = 0; j < per; j++) { const g = 'g' + gi, u = r();
            if (j < miss) rows.push({ game: g, stat: 'pts', pModel: 0.02, pMarket: 0.5, over: -10000, under: -10000, result: 'over' });           // a confident miss: costly on log loss, less on Brier
            else if (j < miss + 10) rows.push({ game: g, stat: 'pts', pModel: 0.5 * Math.exp(-c), pMarket: 0.5, over: -10000, under: -10000, result: 'over' });   // the shift: c on log loss each
            else if (j % 12 === 0) rows.push({ game: g, stat: 'pts', pModel: 0.51119, pMarket: 0.51119, over: 110, under: -10000, result: u < 0.6 ? 'over' : 'under' });   // a bet at a 3.5-point edge, neutral to the scores
            else { const p = j % 2 ? 0.3 : 0.7; rows.push({ game: g, stat: 'pts', pModel: p, pMarket: 0.5, over: -10000, under: -10000, result: u < p ? 'over' : 'under' }); } } }
        return rows; };
      const llGroups = rows => { const m = new Map(); for (const x of rows) { const o = x.result === 'over', q = Math.min(Math.max(x.pModel, 1e-6), 1 - 1e-6), w = Math.min(Math.max(x.pMarket, 1e-6), 1 - 1e-6); const d = (o ? -Math.log(q) : -Math.log(1 - q)) - (o ? -Math.log(w) : -Math.log(1 - w)); const v = m.get(x.game) || [0, 0]; v[0] += d; v[1]++; m.set(x.game, v); } return [...m.values()]; };
      const m0 = ownMeans(llGroups(build(0)), PL.BAR), p90 = m0[Math.floor(0.90 * PL.BAR.boot)], p95 = m0[Math.floor(0.95 * PL.BAR.boot)];
      /* every resampled mean moves by exactly 10c / 120 with the shift, so 0 lands midway between the two percentiles */
      const c = -((p90 + p95) / 2) * per / 10, rows = build(c);
      const d = PL.decide(rows, at), m1 = ownMeans(llGroups(rows), PL.BAR);
      const between = m1[Math.floor(0.90 * PL.BAR.boot)] < 0 && m1[Math.floor(0.95 * PL.BAR.boot)] > 0;
      check(between && d && d.verdict === 'FAIL' && d.scores.logloss_diff_ci90[1] > 0 && d.scores.brier_diff_ci90[1] < 0 && d.flat.all.units > 0,
        `FAIL when the log-loss interval's upper end is past 0 at the 95th percentile though below it at the 90th (Brier [${d && d.scores.brier_diff_ci90}], bets ${d && d.flat.all.units} units)`);
      const d80 = PL.decide(rows, at, { ...PL.BAR, ci: [0.1, 0.9] });
      check(d80 && d80.verdict === 'PASS', 'and the same lines judged on an 80% interval would pass: the case sits between the two'); }
    /* the edge: a bet at a 2-point edge never counts, one at 3.5 points does */
    { const rows = make(PL.BAR.lines, (i, r, g) => { const u = r();
        if (i % 30 === 0) return { game: g, stat: 'pts', pModel: 0.51119, pMarket: 0.51119, over: 110, under: -10000, result: (i / 30) % 5 < 3 ? 'over' : 'under' };   // 3.5 points: 600 won, 400 lost
        if (i % 30 === 1) return { game: g, stat: 'pts', pModel: 0.49619, pMarket: 0.49619, over: 110, under: -10000, result: 'under' };                            // 2 points: every one lost
        const p = i % 2 ? 0.3 : 0.7; return { game: g, stat: 'pts', pModel: p, pMarket: 0.5, over: -10000, under: -10000, result: u < p ? 'over' : 'under' }; });
      const f = PL.flat(rows);
      check(f.all.bets === 1000 && f.over.won === 600 && Math.abs(f.all.units - 260) < 1e-9, `flat bets: the 1,000 at a 3.5-point edge count (+260 units), the 1,000 at a 2-point edge do not (${f.all.bets} bets, ${f.all.units} units)`);
      const d = PL.decide(rows, at);
      check(d && d.verdict === 'PASS' && d.flat.all.bets === 1000, 'and the verdict is PASS on them (counting the 2-point bets would sink it, a 4-point bar would leave none)'); }
    /* the calls stop after a FAIL */
    const Lx = PL.readLedger(); Lx.decision = { verdict: 'FAIL', decided_at: '2026-10-21T18:00Z', lines: 30000 }; fs.writeFileSync(PL.LEDGER(), PL.stringify(Lx));
    const r = PL.run({ upcoming: { '2027_20261023_NYK_BOS': { tip: '2026-10-24T00:00Z', players: { NYK: [{ id: 'z', min: 30, mu: Object.fromEntries(PM.ALL.map(k => [k, 5])), dd: 0, td: 0 }] } } }, params: { var: Object.fromEntries(PM.ALL.map(k => [k, [1.4, 0.95]])), rho: 0.3 },
      games: [{ game_id: '2027_20261023_NYK_BOS', status: 'scheduled', tip: '2026-10-24T00:00Z' }], now: new Date('2026-10-22T12:00:00Z'), boxes: {}, log: quiet, write: false });
    check(!r.ledger.calls['2027_20261023_NYK_BOS'] && !Object.values(r.ledger.calls).some(c => !c.frozen), 'after a FAIL no new call is made and the open ones are dropped');
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `${fails} failed` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
