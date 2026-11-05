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
 *    on each honest run and failing on each planted change, the run's own stamps among them (a time new since the last
 *    commit not the run's, one after the run, the run after the check's clock, back from the last commit's, or a ledger
 *    the run changed on another clock than the check's)
 * 5. the bar on made-up lines: no verdict one short; PASS; FAIL level, FAIL with no bets, FAIL with the bets down, FAIL
 *    when only one score's interval is below 0; the calls stopping after a FAIL
 * 6. the early stop (props_ledger.EARLY_STOP, the owner's call of 5 November 2026), on made-up games either side of its
 *    time: no decision before it; the first run at it a FAIL on every line graded by then, its numbers worked out here
 *    on their own and the bar's functions' on exactly those lines; the calls stopping, a frozen call graded after it,
 *    the decision never revisited; never a PASS, nothing once a decision is made or the bar's sample is in; the check
 *    clean on each honest run and refusing a tampered early decision (its early, a PASS, its numbers, its time, more or
 *    fewer lines than were graded, none written, a grade of its own stamped out of it, a run dated back past what it
 *    graded or before the stop to keep calling, a call left open, no line at all); the job handing props.js and its check
 *    one clock, and a tip-off between two clocks judged on it; with no earlier ledger, the stop read off the ledger's run
 *    time and a decision of an earlier run passing; the stop ending this trial alone (a new trial's ledger calling on
 *    through it, an early decision planted on it refused) and never on no line
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const REAL = path.resolve(__dirname, '..', 'data');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-props-'));
process.env.NBA_DATA_DIR = tmp;
process.env.NBA_FETCH_PAUSE_MS = '0';
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
    check(Math.abs(F.propFairRung(940, PM.FAIR.yes.a.td) - (100 / 1040) * (1 - 0.068 / 0.3)) < 1e-12 && Math.abs(F.propFairRung(-114, PM.FAIR.yes.a.dd) - (114 / 214 - 0.068)) < 1e-12 && PM.FAIR.yes.a.dd === PM.FAIR.yes.a.td,
      'a double- or triple-double\'s fair chance is the rung rule on its one price, with the rungs\' measured margin (6.8 points): no result-fitted factor');
    check(!('propFairYes' in F) && !('c' in PM.FAIR.yes) && /may run high/.test(PM.FAIR.yes.playoffs), 'the playoff calibration is said beside it, not passed off as DraftKings\' margin');
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
    r = await F.propRead('999', async url => { if (/page=2/.test(url)) throw new Error('HTTP 404 https://x'); return page([item(1, '21', 10.5, '-110')], 1, 2); });
    check(r.status === 'failed', 'a 404 on page 2 after page 1 answered is a failed read, asked again: never "none posted", which would keep page 1 alone for good');
    r = await F.propRead('999', async url => /page=2/.test(url) ? { error: { message: 'No propBets found for eventId 999 and provider 100', code: 404 } } : page([item(1, '21', 10.5, '-110')], 1, 2));
    check(r.status === 'failed', 'and so is ESPN\'s 404 body on page 2');
  }

  console.log('2. the record');
  {
    fs.writeFileSync(path.join(tmp, 'games.csv'), '');
    const g = (id, status, type, espn, date) => ({ game_id: id, season: id.slice(0, 4), date, type, status, espn_id: espn, home: id.split('_')[3], away: id.split('_')[2] });
    const games = [g('2027_20261020_BOS_DET', 'final', 'REG', '401', '2026-10-20'), g('2027_20261020_OKC_SAS', 'final', 'REG', '402', '2026-10-20'), g('2027_20261020_PHI_NYK', 'live', 'REG', '403', '2026-10-20'),
      g('2027_20261021_GSW_LAL', 'scheduled', 'REG', '404', '2026-10-21'), g('2027_20261016_MIA_ORL', 'final', 'PRE', '405', '2026-10-16'), g('2027_20261020_CHA_BKN', 'final', 'REG', '', '2026-10-20'), g('2027_20261020_ATL_ORL', 'final', 'REG', '406', '2026-10-20'),
      g('2027_20261020_MIL_IND', 'final', 'REG', '407', '2026-10-20')];
    /* 407 answers page 1 of 2, and page 2 with a 404 on the first run only */
    let p2fail = true;
    const g407 = url => /page=2/.test(url) ? (p2fail ? 'HTTP 404' : page([item(3, '31', 4.5, '-110'), item(3, '31', 4.5, '-110')], 2, 2)) : page([item(1, '31', 12.5, '-110'), item(1, '31', 12.5, '-110')], 1, 2);
    const answers = { '401': page([item(1, '11', 20.5, '-115'), item(1, '11', 20.5, '-105'), item(3, '11', 6.5, '+110'), item(3, '11', 6.5, '-140')]), '402': 'HTTP 404', '406': 'HTTP 500', '407': g407 };
    const asked = [];
    const stub = async url => { const e = /events\/(\d+)\//.exec(url)[1]; if (/page=1$/.test(url)) asked.push(e); let a = answers[e]; if (typeof a === 'function') a = a(url); if (typeof a === 'string') throw new Error(a + ' ' + url); return a; };
    const now = () => new Date('2026-10-21T15:00:00Z');
    await REC.recordClosing({ games, getJSON: stub, now, log: quiet });
    check(JSON.stringify([...asked].sort()) === JSON.stringify(['401', '402', '406', '407']), 'only finals of the regular season and playoffs with an ESPN id are asked for (not a live, scheduled or preseason game)');
    const rows = REC.readRecord(2027), reads = REC.readReads();
    check(rows.length === 2 && rows[0].stat === 'pts' && rows[0].over === -115 && rows[1].stat === 'reb' && rows[1].under === -140, 'a read game\'s main lines are written, the first item the Over');
    check(reads['2027_20261020_BOS_DET'].status === 'ok' && reads['2027_20261020_OKC_SAS'].status === 'none' && reads['2027_20261020_ATL_ORL'].status === 'failed', 'each read is logged: ok, none (a 404), failed');
    check(reads['2027_20261020_MIL_IND'].status === 'failed' && !rows.some(r => r.game_id === '2027_20261020_MIL_IND'), 'a game whose page 2 answers 404 after page 1 is failed, and none of its lines is written');
    asked.length = 0; p2fail = false;
    await REC.recordClosing({ games, getJSON: stub, now, log: quiet });
    check(JSON.stringify([...asked].sort()) === JSON.stringify(['406', '407']), 'a game read ok or none is never asked for again; a failed one is');
    check(REC.readReads()['2027_20261020_MIL_IND'].status === 'ok' && REC.readRecord(2027).filter(r => r.game_id === '2027_20261020_MIL_IND').length === 2, 'and the game whose page 2 failed is read whole the next time, both pages');
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
    const r2t = x => Math.round(x * 100) / 100;
    check(all.every(p => Object.entries(PM.COMBOS).every(([c, parts]) => p.mu[c] === r2t(parts.reduce((s, k) => s + p.mu[k], 0)))), 'a combo\'s mean is exactly the sum of its published parts, to two decimals (as the page works it)');
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
    /* before the bar is judged no verdict; the one verdict that can come before it is the early stop's FAIL (the owner's call
       of 5 November 2026), carried with its early, its lines and its numbers as the ledger wrote them */
    { const dec = ps.ledger && ps.ledger.decision, lgR = JSON.parse(fs.readFileSync(path.join(REAL, 'props_shadow.json'), 'utf8')), D = lgR.decision;
      const carried = !dec ? !D : !!D && dec.verdict === 'FAIL' && JSON.stringify(dec.early) === JSON.stringify({ at: PL.EARLY_STOP.at, by: PL.EARLY_STOP.by, why: PL.EARLY_STOP.why }) && JSON.stringify(dec.early) === JSON.stringify(D.early)
        && dec.decidedAt === D.decided_at && dec.lines === D.lines && dec.lines < PL.BAR.lines && dec.games === D.games && JSON.stringify(dec.scores) === JSON.stringify(D.scores) && JSON.stringify(dec.flat) === JSON.stringify(D.flat);
      check(ps.ledger && ps.ledger.bar.lines === PL.BAR.lines && !/pass/i.test(ps.ledger.summary.standing) && carried,
        dec ? `the ledger's verdict is the early stop's FAIL, at ${dec.lines} lines on ${dec.decidedAt}, carried with its early and its numbers, and no word of passing` : "the ledger's running numbers, no verdict and no word of passing before the bar is judged"); }
    check(ps.fair && ps.fair.rung && PM.STATS.filter(k => k !== 'stl' && k !== 'blk').every(k => ps.fair.rung.a[k] > 0) && ps.fair.yes.a.dd > 0 && ps.fair.yes.a.td > 0, 'the measured fair-chance constants for rungs and Yes markets');
    /* the page prices a line on state.props; the ledger freezes its own copy: every number the page reads, the combos
       worked the page's way, is the open call's, to the digit */
    { const lg = JSON.parse(fs.readFileSync(path.join(REAL, 'props_shadow.json'), 'utf8')), lay = ps.layout, diff = [];
      let n = 0;
      for (const [gid, g] of Object.entries(ps.games)) { const c = lg.calls[gid]; if (!c || c.frozen) continue;
        for (const [pid, a] of Object.entries(g.players)) { const call = c.players[pid]; if (!call) { diff.push(`${gid} ${pid}: no call`); continue; } n++;
          const at = k => a[lay.indexOf(k)], page = k => k in ps.combos ? r2t(ps.combos[k].reduce((t, q) => t + at(q), 0)) : at(k);
          for (const k of PL.CALL_LAYOUT) { const v = k === 'min' ? at('min') : page(k); if (v !== call[PL.CALL_LAYOUT.indexOf(k)]) diff.push(`${gid} ${pid} ${k}: page ${v}, call ${call[PL.CALL_LAYOUT.indexOf(k)]}`); } }
        if (Object.keys(c.players).length !== Object.keys(g.players).length) diff.push(`${gid}: ${Object.keys(c.players).length} called, ${Object.keys(g.players).length} published`); }
      /* once the bar has failed the ledger makes no call, and there is nothing to hold the page's numbers to */
      const calling = !(lg.decision && lg.decision.verdict === 'FAIL');
      check(!Object.keys(ps.games).length || !calling || (n > 0 && !diff.length), `every number the page prices a prop on is the shadow ledger's open call, combos included (${n} players${calling ? '' : '; the bar failed, so no call is open'})${diff.length ? ': ' + diff.slice(0, 3).join('; ') : ''}`); }
    /* the availability rule on a made-up report */
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-avail-'));
    fs.writeFileSync(path.join(dir, 'injuries.json'), JSON.stringify({ date: '2026-10-19', teams: { DET: [{ id: 'a', status: 'Out', returns: '' }, { id: 'b', status: 'Day-To-Day', returns: '2026-10-21' }, { id: 'c', status: 'Day-To-Day', returns: '2026-10-19' }, { id: 'd', status: 'Suspension', returns: '' }] } }));
    fs.writeFileSync(path.join(dir, 'rosters_espn.json'), JSON.stringify({ date: '2026-10-19', teams: { DET: 'abcdefghijkl'.split('').map(id => ({ id })), BOS: [{ id: 'f' }] }, asOf: { DET: '2026-10-18', BOS: '2026-10-19' } }));
    const av = PM.availability(dir)({ date: '2026-10-20' }, 'DET', {});
    check(JSON.stringify(av.out.map(x => x.id)) === '["a","b","d"]' && !av.ids.includes('f') && av.ids.includes('c'), 'out: Out, before the return date, suspended; back on his return date; a player on a later roster read belongs to that club');
  }

  console.log('3b. the live minutes: the backtest\'s rule, on the rosters and report of 15 October 2026');
  {
    /* the live projections, run on the history before 15 October 2026 and on that morning's rosters and injury report
       (tools/fixtures/props_live_20261015.json), against the backtest's own sides (every player a box lists) under the
       same constants, so a live rule that drifts from the backtested one (the first version scaled the roster's 13 with
       the most minutes, which shaved a contender's starters by a tenth on opening night) fails here */
    const pj = JSON.parse(fs.readFileSync(path.resolve(__dirname, '..', 'props.json'), 'utf8')), P = pj.params;
    const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'props_live_20261015.json'), 'utf8'));
    const ldir = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-live-'));
    fs.writeFileSync(path.join(ldir, 'rosters_espn.json'), JSON.stringify(FX.rosters)); fs.writeFileSync(path.join(ldir, 'injuries.json'), JSON.stringify(FX.injuries));
    const all = PM.loadGames(), past = all.filter(g => g.date < '2026-10-15');
    const gamesL = past.concat(all.filter(g => g.date >= '2026-10-15').map(g => ({ ...g, status: 'scheduled', home_score: '', away_score: '' })));
    const boxes = PM.loadBoxes(REAL), tb = PM.loadTeamBoxes(REAL);
    const live = PM.liveProjections(PM.replay(past, boxes, tb, {}), P, gamesL, new Date('2026-10-15T12:00:00Z'), ldir);
    const Rb = PM.replay(past, boxes, tb, { collect: true, from: 2024 });
    /* every regular-season side of 2024-2026, and each club's first game of a season (an opener, as the fixture's week is):
       its scale and its rotation's projected minutes */
    const bt = [], btSum = [], btOpen = [], btOpenSum = [], seen = new Set();
    for (const idx of PM.sidesOf(Rb.rows).values()) { const r0 = Rb.rows[idx[0]]; if (r0.type !== 'REG') continue;
      const list = idx.map(i => ({ b: PM.baseMin(Rb.rows[i].f, P.min) })), sc = PM.sideScale(list, P.min);
      const rot = list.map(x => PM.finalMin(x.b, sc, false, P.min)).sort((a, b) => b - a).slice(0, PM.ROT).reduce((a, m) => a + m, 0);
      bt.push(sc); btSum.push(rot); if (seen.has(r0.season + r0.team)) continue; seen.add(r0.season + r0.team); btOpen.push(sc); btOpenSum.push(rot); }
    const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.floor(p * (b.length - 1))]; };
    /* a side's rotation: its ROT with the most projected minutes (the players shown are the 13 who dress, each with his
       minutes if he plays, where a box's list ends in players who seldom do, so the whole list's sums are not alike) */
    const ls = Object.values(live).flatMap(g => [g.away, g.home].map(t => ({ date: g.date, t, sc: g.scale[t], n: g.players[t].length, sum: g.players[t].slice(0, PM.ROT).reduce((a, p) => a + p.min, 0) })));
    const first = ls.map(x => x.date).sort()[0], night = ls.filter(x => x.date === first);
    const f3 = x => x.toFixed(3);
    check(ls.length >= 40 && ls.every(x => Number.isFinite(x.sc) && x.n <= PM.LIVE_SIDE), `the opening week projected (${ls.length} sides), its scale published, none showing more than the ${PM.LIVE_SIDE} who dress`);
    const r2l = x => Math.round(x * 100) / 100, lp = Object.values(live).flatMap(g => Object.values(g.players).flat());
    check(lp.length > 500 && lp.every(p => Object.entries(PM.COMBOS).every(([c, parts]) => p.mu[c] === r2l(parts.reduce((a, k) => a + p.mu[k], 0)))),
      `each of the ${lp.length} live projections publishes a combo as the sum of its published parts, to two decimals: the number the page works and the ledger freezes`);
    /* each side within the range the backtest's sides had; the week's median within its openers' 10th to 90th percentile
       (the first version: opening night's median 0.91, under every opener's 10th percentile but one) */
    const [o0, o1] = [Math.min(...bt), Math.max(...bt)], med = q(ls.map(x => x.sc), 0.5);
    check(night.length >= 4 && ls.every(x => x.sc >= o0 && x.sc <= o1) && med >= q(btOpen, 0.1) && med <= q(btOpen, 0.9),
      `every side's scale lies in the range the backtest's sides had (${f3(o0)} to ${f3(o1)}), the week's median (${f3(med)}) within its openers' 10th to 90th percentile (${f3(q(btOpen, 0.1))} to ${f3(q(btOpen, 0.9))}); opening night ${night.map(x => x.t + ' ' + f3(x.sc)).join(', ')}`);
    const [s0, s1] = [Math.min(...btSum), Math.max(...btSum)], sm = q(ls.map(x => x.sum), 0.5);
    check(ls.every(x => x.sum >= s0 && x.sum <= s1) && sm >= q(btOpenSum, 0.1) && sm <= q(btOpenSum, 0.9),
      `each side's rotation (its ${PM.ROT} with the most minutes) is projected minutes in the backtest's range (${s0.toFixed(0)} to ${s1.toFixed(0)}), the week's median ${sm.toFixed(1)} within its openers' 10th to 90th percentile (${q(btOpenSum, 0.1).toFixed(1)} to ${q(btOpenSum, 0.9).toFixed(1)})`);
    /* the rule itself on made-up sides: the bodies past the top ROT never move the scale, a missing starter raises it */
    const M = { ...P.min, floor: 0 }, side = [36, 34, 33, 30, 28, 24, 22, 20, 18, 15].map(b => ({ b }));
    const camp = side.concat([14, 12, 9, 6, 4, 3].map(b => ({ b })));
    check(PM.sideScale(camp, M) === PM.sideScale(side, M) && PM.sideScale(side.slice(1), M) > PM.sideScale(side, M), `a side's scale is its top ${PM.ROT}'s: a camp roster's extra bodies leave it as it is, a missing starter hands his minutes on`);
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
    const clean4 = (b, m) => check(!b.length, m + (b.length ? ': ' + b.join('; ') : ''));

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
      /* the call open in the last commit, its tip passed, rewritten by this run as a delay would: a later tip, new numbers */
      plant('a call open in the last commit and past its tip-off, rewritten by the run with a later tip and new numbers', (c, Lx) => { c.frozen = false; c.frozen_at = null; c.tip = '2026-10-21T01:00Z'; c.called_at = Lx.run_at; c.players['101'][1] += 3; });
      fs.writeFileSync(PL.LEDGER(), frozenText);
      /* the run's own time: every stamp new since the last commit is the run's, the run at or before the check's clock,
         never back from the last commit's (the job hands props.js and its check one clock) */
      const stamp = (what, fn, re) => { const Lx = JSON.parse(frozenText); fn(Lx); fs.writeFileSync(PL.LEDGER(), PL.stringify(Lx));
        const b = checkAt('2026-10-20T23:45:00Z', prevOf(s2)); check(b.some(x => re.test(x)), `${what} fails the check${b.length ? ` ("${b.find(x => re.test(x)) || b[0]}")` : ' (it passed)'}`); };
      stamp('a call frozen by this run stamped with another time (after its tip-off, before the run)', x => { x.calls[G1].frozen_at = '2026-10-20T23:40Z'; }, /frozen at 2026-10-20T23:40Z since the last commit, not at the time of the run that wrote the ledger \(2026-10-20T23:45Z\)/);
      stamp('a call still to tip re-stamped with a time that is not the run\'s', x => { x.calls[G2].called_at = '2026-10-20T23:00Z'; }, /made at 2026-10-20T23:00Z since the last commit, not at the time of the run/);
      stamp('a call stamped after the run that wrote the ledger', x => { x.calls[G1].frozen_at = '2026-10-20T23:50Z'; }, /frozen at 2026-10-20T23:50Z, after the run that wrote the ledger/);
      stamp('a fit new since the last commit registered at another time than the run\'s', x => { x.fits.f0f0f0f0f0f0 = { var: params.var, rho: 0.3, registered: '2026-10-20T23:00Z' }; }, /fit f0f0f0f0f0f0: new since the last commit, registered at 2026-10-20T23:00Z, not at the time of the run/);
      stamp('a fit registered after the run that wrote the ledger', x => { x.fits.f0f0f0f0f0f0 = { var: params.var, rho: 0.3, registered: '2026-10-20T23:50Z' }; }, /fit f0f0f0f0f0f0: registered at 2026-10-20T23:50Z, after the run that wrote the ledger/);
      stamp('the ledger dated after the check\'s clock', x => { x.run_at = '2026-10-20T23:50Z'; }, /written at 2026-10-20T23:50Z, after this check's clock/);
      stamp('the ledger dated back past the last commit\'s run', x => { x.run_at = '2026-10-20T11:00Z'; x.calls[G1].frozen_at = x.run_at; }, /run time went back, to 2026-10-20T11:00Z from the last commit's 2026-10-20T12:00Z/);
      stamp('a ledger this run changed, dated a minute before the check\'s clock', x => { x.run_at = '2026-10-20T23:44Z'; x.calls[G1].frozen_at = x.run_at; }, /changed by a run at 2026-10-20T23:44Z, not at this check's clock \(2026-10-20T23:45Z\)/);
      fs.writeFileSync(PL.LEDGER(), frozenText);
      clean4(checkAt('2026-10-20T23:45:00Z', prevOf(s2)), 'and the honest freeze passes again'); }
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

    /* a re-registration of the bar: allowed while the old one has nothing on record against it, refused once it has */
    {
      const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-rereg-')), keep = [process.env.NBA_PROPS_LEDGER, process.env.NBA_PROPS_LINES];
      process.env.NBA_PROPS_LEDGER = path.join(dir, 'props_shadow.json'); process.env.NBA_PROPS_LINES = path.join(dir, 'props_shadow_lines.csv');
      const G3 = '2027_20261024_NYK_BOS', fid = PL.fitId(params);
      const gamesR = [{ game_id: G3, season: 2027, date: '2026-10-24', type: 'REG', status: 'scheduled', tip: '2026-10-24T23:30Z', home: 'BOS', away: 'NYK', espn_id: '503' }];
      const upR = { [G3]: { date: '2026-10-24', tip: '2026-10-24T23:30Z', type: 'REG', away: 'NYK', home: 'BOS', players: { NYK: [P('301', 35, 27, 4)], BOS: [P('302', 34, 24, 8)] } } };
      /* the old ledger: the bar as first registered, before its numbers were written into it, and a call made after it */
      const old = PL.newLedger(T('2026-10-15T09:08:00Z'));
      old.bar = Object.fromEntries(Object.entries(PL.BAR).filter(([k]) => !['edge', 'ci', 'boot', 'seed'].includes(k)));
      old.fits[fid] = { var: params.var, rho: params.rho, registered: '2026-10-15T09:09Z' };
      old.calls[G3] = PL.callOf(upR[G3], fid, T('2026-10-15T09:09:00Z')); old.run_at = '2026-10-15T09:09Z';
      old.summary = PL.summarize(old, [], { by: new Map(), reads: {} });
      const prevR = Lx => ({ ledger: Lx, lines: '', reads: {}, record: {} });
      /* the new one: BAR registered later (props_ledger.js init), then a run's calls */
      const fresh = PL.newLedger(T('2026-10-15T11:30:00Z')); fresh.summary = PL.summarize(fresh, [], { by: new Map(), reads: {} }); fs.writeFileSync(PL.LEDGER(), PL.stringify(fresh));
      PL.run({ upcoming: upR, params, games: gamesR, now: T('2026-10-15T11:31:00Z'), boxes: {}, log: quiet });
      const ck = (prev, Lx = PL.readLedger()) => PC.check({ Lg: Lx, lineText: '', prev, games: gamesR, boxes: {}, now: T('2026-10-15T11:31:00Z') });
      const refused = b => b.some(x => /bar or its registration time differs from the last commit/.test(x));
      let b = ck(prevR(old));
      check(!b.length && b.notes.some(n => /re-registered at 2026-10-15T11:30Z/.test(n)), 'the bar re-registered (with its numbers) before anything is on record against the old one passes, and the check says so' + (b.length ? ': ' + b.join('; ') : ''));
      const edit = fn => { const x = JSON.parse(JSON.stringify(old)); fn(x); return prevR(x); };
      check(refused(ck(edit(x => { x.calls[G3].frozen = true; x.calls[G3].frozen_at = '2026-10-15T10:00Z'; }))), 'refused once a call under the old bar was frozen');
      check(refused(ck(edit(x => { x.calls[G3].tip = '2026-10-15T10:00Z'; }))), 'refused once a call under the old bar is past its tip-off');
      check(refused(ck({ ...prevR(old), lines: PL.LINE_COLS.join(',') + '\n2027_20261020_BOS_DET,101,pts,0.5000,0.5000,25\n' })), 'refused once a line was graded under it');
      check(refused(ck(edit(x => { x.decision = { verdict: 'FAIL', decided_at: '2026-10-15T10:00Z', lines: 30000 }; }))), 'refused once it has a verdict');
      check(refused(ck(edit(x => { x.bar_registered = '2026-10-15T12:00Z'; }))), 'refused when the new registration is not later than the old');
      const early = PL.readLedger(); early.calls[G3].called_at = '2026-10-15T11:00Z';
      check(ck(prevR(old), early).some(x => /before the bar was registered/.test(x)), 'and a call made before the new registration fails it');
      const other = PL.readLedger(); other.bar = { ...other.bar, edge: 0.02 };
      check(ck(prevR(old), other).some(x => /not the one registered|numbers are not the registered ones/.test(x)), 'a re-registration to any bar but BAR fails');
      if (keep[0] === undefined) delete process.env.NBA_PROPS_LEDGER; else process.env.NBA_PROPS_LEDGER = keep[0];
      if (keep[1] === undefined) delete process.env.NBA_PROPS_LINES; else process.env.NBA_PROPS_LINES = keep[1];
    }

    /* the ledger the job keeps: its bar is BAR, numbers and all, and every call was made after it was registered */
    { const real = JSON.parse(fs.readFileSync(path.join(REAL, 'props_shadow.json'), 'utf8'));
      check(JSON.stringify(real.bar) === JSON.stringify(PL.BAR) && Object.values(real.calls).every(c => c.called_at >= real.bar_registered),
        `data/props_shadow.json: its bar is BAR, every number written into it, and its ${Object.keys(real.calls).length} calls were all made at or after its registration (${real.bar_registered})`); }
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

  console.log('6. the early stop');
  {
    const T = s => new Date(s), E = PL.EARLY_STOP, ES = { at: E.at, by: E.by, why: E.why };
    check(E.at === '2026-11-05T18:00:00Z' && E.by === 'the owner' && /FAIL/.test(E.why) && /behind DraftKings on both scores/.test(E.why) && !/\d/.test(E.why.replace('90%', '').replace('30,000', '')) && Date.parse(E.at) % 60000 === 0,
      `the early stop is registered in the code: ${E.at}, ${E.by}, and why ("${E.why}", naming no count of lines: the decision's lines are the count), on a whole minute as the ledger writes its times`);
    { const realReg = JSON.parse(fs.readFileSync(path.join(REAL, 'props_shadow.json'), 'utf8')).bar_registered;
      check(E.bar_registered === '2026-10-15T11:35Z' && E.bar_registered === realReg && PL.stopsLedger({ bar_registered: realReg }) && !PL.stopsLedger({ bar_registered: '2026-11-20T12:00Z' }) && !PL.stopsLedger(null),
        `it ends the one trial whose bar was registered at ${E.bar_registered}, the ledger the job keeps (registered ${realReg}), and no other`); }
    /* the job hands props.js and its check one clock, as the calls and suggestions steps hand theirs */
    { const wf = fs.readFileSync(path.resolve(__dirname, '..', '.github', 'workflows', 'update.yml'), 'utf8');
      check(/\n\s*now=\$\(date -u \+%Y-%m-%dT%H:%M:%SZ\)\n\s*if ! NBA_NOW=\$now node tools\/props\.js;[^\n]*\n\s*if ! NBA_NOW=\$now node tools\/props_check\.js;/.test(wf) && (wf.match(/node tools\/props(_check)?\.js/g) || []).length === 2,
        'the job runs props.js and its check on one clock (NBA_NOW, to the second), and nowhere else'); }
    check(!PL.stopDue(T('2026-11-05T17:59:59.999Z')) && PL.stopDue(T(E.at)) && PL.stopDue(T('2026-11-20T00:00:00Z')), 'it is due from its time on, not a millisecond before');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-early-')), keep = [process.env.NBA_PROPS_LEDGER, process.env.NBA_PROPS_LINES];
    process.env.NBA_PROPS_LEDGER = path.join(dir, 'props_shadow.json'); process.env.NBA_PROPS_LINES = path.join(dir, 'props_shadow_lines.csv');
    const params = { var: Object.fromEntries(PM.ALL.map(k => [k, k === 'pts' ? [7.5, 0.72] : [1.4, 0.95]])), rho: 0.35 };
    const mus = (pts, reb) => ({ pts, reb, ast: 4, tpm: 2, stl: 1, blk: 0.5, pra: pts + reb + 4, pr: pts + reb, pa: pts + 4, ar: reb + 4, sb: 1.5 });
    const P = (id, min, pts, reb) => ({ id, name: id, pos: 'G', min, mu: mus(pts, reb), dd: 0.1, td: 0.01 });
    const G5 = '2027_20261104_BOS_DET', G6 = '2027_20261105_NYK_MIA', G6b = '2027_20261105_CHI_ATL', G7 = '2027_20261106_GSW_LAL', G8 = '2027_20261107_DEN_PHX';
    const gm = (id, date, tip, away, home, espn) => ({ game_id: id, season: 2027, date, type: 'REG', status: 'scheduled', tip, home, away, espn_id: espn });
    let games = [gm(G5, '2026-11-04', '2026-11-04T23:30Z', 'BOS', 'DET', '601'), gm(G6, '2026-11-05', '2026-11-05T17:30Z', 'NYK', 'MIA', '602'), gm(G6b, '2026-11-05', '2026-11-05T17:45Z', 'CHI', 'ATL', '603'),
      gm(G7, '2026-11-06', '2026-11-07T00:00Z', 'GSW', 'LAL', '604'), gm(G8, '2026-11-07', '2026-11-08T02:00Z', 'DEN', 'PHX', '605')];
    const final = (...ids) => { games = games.map(g => ids.includes(g.game_id) ? { ...g, status: 'final' } : g); };
    const upOf = g => ({ date: g.date, tip: g.tip, type: 'REG', away: g.away, home: g.home });
    const UP = { [G5]: { BOS: [P('501', 34, 22, 6), P('502', 20, 9, 3)], DET: [P('503', 30, 16, 9), P('504', 12, 4, 2)] }, [G6]: { NYK: [P('601', 35, 29, 4), P('602', 18, 7, 2)], MIA: [P('603', 31, 13, 11)] },
      [G6b]: { CHI: [P('701', 33, 18, 5)], ATL: [P('702', 34, 21, 6)] }, [G7]: { GSW: [P('801', 33, 25, 5)], LAL: [P('802', 35, 27, 8)] }, [G8]: { DEN: [P('901', 36, 28, 12)], PHX: [P('902', 34, 24, 4)] } };
    const up = ids => Object.fromEntries(ids.map(id => [id, { ...upOf(games.find(g => g.game_id === id)), players: UP[id] }]));
    const y = (pts, reb) => ({ pts, reb, ast: 3, tpm: 2, stl: 1, blk: 0 });
    const boxes = { [G5]: { BOS: [{ id: '501', min: 35, dnp: false, y: y(25, 5) }, { id: '502', min: 18, dnp: false, y: y(8, 4) }], DET: [{ id: '503', min: 30, dnp: false, y: y(15, 9) }, { id: '504', min: 0, dnp: true, y: y(0, 0) }] },
      [G6]: { NYK: [{ id: '601', min: 36, dnp: false, y: y(30, 3) }, { id: '602', min: 16, dnp: false, y: y(5, 2) }], MIA: [{ id: '603', min: 32, dnp: false, y: y(12, 12) }] },
      [G6b]: { CHI: [{ id: '701', min: 33, dnp: false, y: y(18, 4) }], ATL: [{ id: '702', min: 34, dnp: false, y: y(20, 6) }] } };
    const pages = { 601: page([item(1, '501', 23.5, '-118'), item(1, '501', 23.5, '-104'), item(3, '501', 5.5, '+115'), item(3, '501', 5.5, '-145'), item(1, '502', 8.5, '-110'), item(1, '502', 8.5, '-110'),
        item(1, '503', 14.5, '-110'), item(1, '503', 14.5, '-110'), item(1, '504', 10.5, '-110'), item(1, '504', 10.5, '-110')]),
      602: page([item(1, '601', 27.5, '-110'), item(1, '601', 27.5, '-110'), item(3, '603', 10.5, '+105'), item(3, '603', 10.5, '-125'), item(1, '602', 6.5, '-110'), item(1, '602', 6.5, '-110')]),
      603: page([item(1, '701', 17.5, '-110'), item(1, '701', 17.5, '-110'), item(1, '702', 19.5, '-120'), item(1, '702', 19.5, '+100')]) };
    const readClosing = (ids, t) => REC.recordClosing({ games: games.filter(g => ids.includes(g.game_id)), getJSON: async url => pages[url.match(/events\/(\d+)\//)[1]], now: () => T(t), log: quiet });
    const recFiles = () => fs.readdirSync(tmp).filter(f => /^props_\d{4}\.csv$|^props_reads\.json$/.test(f));
    const snapE = () => { const d = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-early-prev-'));
      for (const f of ['props_shadow.json', 'props_shadow_lines.csv']) if (fs.existsSync(path.join(dir, f))) fs.copyFileSync(path.join(dir, f), path.join(d, f));
      for (const f of recFiles()) fs.copyFileSync(path.join(tmp, f), path.join(d, f)); return d; };
    const prevOf = d => { const get = n => fs.existsSync(path.join(d, n)) ? fs.readFileSync(path.join(d, n), 'utf8') : null; const rec = {}; for (const f of fs.readdirSync(d)) if (/^props_\d{4}\.csv$/.test(f)) rec[f] = get(f);
      return get('props_shadow.json') ? { ledger: JSON.parse(get('props_shadow.json')), lines: get('props_shadow_lines.csv') || '', reads: JSON.parse(get('props_reads.json') || '{}'), record: rec } : null; };
    const lineText = () => fs.existsSync(PL.LINES()) ? fs.readFileSync(PL.LINES(), 'utf8') : '';
    const runAt = (t, ids) => PL.run({ upcoming: up(ids), params, games, now: T(t), boxes, log: quiet });
    const checkAt = (t, prev, Lx = PL.readLedger(), lt = lineText()) => PC.check({ Lg: Lx, lineText: lt, prev, games, boxes, now: T(t) });
    const clean = (b, m) => check(!b.length, m + (b.length ? ': ' + b.join('; ') : ''));

    const Lg0 = PL.newLedger(T('2026-10-15T11:35:00Z')); Lg0.summary = PL.summarize(Lg0, [], { by: new Map(), reads: {} }); fs.writeFileSync(PL.LEDGER(), PL.stringify(Lg0));
    let s = snapE();
    runAt('2026-11-04T12:00:00Z', [G5, G6, G6b, G7]);
    clean(checkAt('2026-11-04T12:00:00Z', prevOf(s)), 'the calls made the day before: the check is clean');
    /* G5 final and read; graded before the stop */
    final(G5); await readClosing([G5], '2026-11-05T09:00:00Z'); s = snapE();
    runAt('2026-11-05T10:00:00Z', [G6, G6b, G7]);
    let Lg = PL.readLedger();
    check(Lg.calls[G5].graded && Lg.calls[G5].graded.lines === 4 && !Lg.decision && /^4 of 30000 graded lines toward the verdict/.test(Lg.summary.standing), 'a game graded before the stop: running numbers, no decision');
    clean(checkAt('2026-11-05T10:00:00Z', prevOf(s)), 'and the check is clean');
    /* the last run before the stop freezes the two early games: still no decision */
    s = snapE();
    runAt('2026-11-05T17:59:00Z', [G7]);
    Lg = PL.readLedger();
    check(Lg.calls[G6].frozen && Lg.calls[G6b].frozen && !Lg.decision && !Lg.calls[G7].frozen && Lg.run_at === '2026-11-05T17:59Z', 'a run a minute before the stop writes no decision (the games that tipped frozen, the next one still called)');
    clean(checkAt('2026-11-05T17:59:00Z', prevOf(s)), 'and the check is clean');
    /* the stop is read off the ledger's own run time: with no earlier ledger to hold it to, the run a minute before it
       passes a check just after it; held to the last commit's, a check on another clock than the run's refuses it for that
       alone (the job hands the two one clock), never for the stop */
    clean(checkAt('2026-11-05T18:00:30Z', null), 'with no earlier ledger, the run at 17:59 passes a check at 18:00:30 (the stop read off the ledger\'s run time, not the check\'s clock)');
    { const b = checkAt('2026-11-05T18:00:30Z', prevOf(s));
      check(b.length === 1 && /changed by a run at 2026-11-05T17:59Z, not at this check's clock \(2026-11-05T18:00Z\)/.test(b[0]), `held to the last commit's, a check at 18:00:30 refuses the 17:59 run for its clock alone, not for the stop (${b.join('; ')})`); }
    /* a tip-off between the run and its check: the run's clock 23:59:55 on 6 November, ${G7} tipping at 00:00 on the 7th;
       the run writes the early FAIL (on the 4 lines graded) and drops ${G7}, still to tip by its clock. On the run's one
       clock the check passes; on a clock ten seconds later it would take ${G7} as tipped and gone, which is why the job
       hands the two one clock */
    { const keepL = fs.readFileSync(PL.LEDGER(), 'utf8'), keepLn = lineText(), sT = snapE();
      runAt('2026-11-06T23:59:55Z', [G7, G8]);
      const Lt = PL.readLedger();
      check(Lt.decision && Lt.decision.lines === 4 && Lt.decision.decided_at === '2026-11-06T23:59Z' && !Lt.calls[G7] && !Lt.calls[G8] && Lt.run_at === '2026-11-06T23:59Z',
        `a run at 23:59:55 writes the early FAIL (${Lt.decision && Lt.decision.lines} lines) and drops ${G7}, which tips at 00:00`);
      clean(checkAt('2026-11-06T23:59:55Z', prevOf(sT)), 'on the run\'s one clock the check passes');
      const late = checkAt('2026-11-07T00:00:05Z', prevOf(sT));
      check(late.some(x => new RegExp(`${G7}: a call frozen at tip-off \\(2026-11-07T00:00Z\\) is gone`).test(x)) && late.some(x => /not at this check's clock \(2026-11-07T00:00Z\)/.test(x)), `on a clock ten seconds later it refuses it (${late.join('; ')})`);
      fs.writeFileSync(PL.LEDGER(), keepL); fs.writeFileSync(PL.LINES(), keepLn); }
    /* the first run at the stop: G6 final and read in it, G6b final with its closing lines not read yet */
    final(G6, G6b); await readClosing([G6], '2026-11-05T17:59:30Z');
    const sPre = snapE();
    runAt('2026-11-05T18:00:00Z', [G7, G8]);
    Lg = PL.readLedger();
    const D = Lg.decision, lines = PL.readLines();
    /* the compared lines worked out here on their own: each graded line joined to its closing line in the record */
    const recRows = new Map(REC.readRecord(2027).map(r => [r.game_id + '|' + r.player_id + '|' + r.stat, r]));
    const own = lines.map(l => { const r = recRows.get(l.game_id + '|' + l.player_id + '|' + l.stat); return { game: l.game_id, stat: l.stat, pModel: l.p_model, pMarket: l.p_market, over: r.over, under: r.under, result: l.y > r.line ? 'over' : 'under' }; });
    const impl = a => a < 0 ? -a / (-a + 100) : 100 / (a + 100), cl = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6), avg = f => own.reduce((t, x) => t + f(x), 0) / own.length;
    const ll = p => x => x.result === 'over' ? -Math.log(cl(p(x))) : -Math.log(1 - cl(p(x))), br = p => x => (p(x) - (x.result === 'over' ? 1 : 0)) ** 2;
    const fl = { bets: 0, won: 0, units: 0 };
    for (const x of own) { const eo = x.pModel - impl(x.over), eu = (1 - x.pModel) - impl(x.under), side = eo >= 0.03 && eo >= eu ? 'over' : eu >= 0.03 ? 'under' : null; if (!side) continue;
      const pr = side === 'over' ? x.over : x.under; fl.bets++; if (x.result === side) { fl.won++; fl.units += pr > 0 ? pr / 100 : 100 / -pr; } else fl.units -= 1; }
    const near = (a, b) => Math.abs(a - b) < 1.5e-6;
    check(own.length === 7 && D && D.verdict === 'FAIL' && D.lines === 7 && D.decided_at === '2026-11-05T18:00Z' && D.games === 2 && D.last_game === G6 && JSON.stringify(D.early) === JSON.stringify(ES),
      `the first run at the stop writes the decision: FAIL on all ${own.length} lines graded by then (this run's own game among them), ${D && D.games} games, the last ${D && D.last_game}, and early copied from EARLY_STOP`);
    check(D && near(D.scores.model.logloss, avg(ll(x => x.pModel))) && near(D.scores.market.logloss, avg(ll(x => x.pMarket))) && near(D.scores.model.brier, avg(br(x => x.pModel))) && near(D.scores.market.brier, avg(br(x => x.pMarket)))
      && near(D.scores.logloss_diff, avg(ll(x => x.pModel)) - avg(ll(x => x.pMarket))) && D.flat.all.bets === fl.bets && D.flat.all.won === fl.won && Math.abs(D.flat.all.units - Math.round(fl.units * 100) / 100) < 1e-9 && fl.bets > 0,
      `its numbers are those lines', worked out here on their own (log loss ${D && D.scores.model.logloss} against ${D && D.scores.market.logloss}, Brier ${D && D.scores.model.brier} against ${D && D.scores.market.brier}, ${fl.bets} flat bets, ${D && D.flat.all.units} units)`);
    check(D && JSON.stringify(D.scores) === JSON.stringify(PL.scores(own, PL.BAR)) && JSON.stringify(D.flat) === JSON.stringify(PL.flat(own, PL.BAR)) && Array.isArray(D.scores.logloss_diff_ci90),
      "and exactly the bar's own functions' (scores, its bootstrap interval among them, and flat) on exactly those lines");
    check(!Object.values(Lg.calls).some(c => !c.frozen) && !Lg.calls[G7] && !Lg.calls[G8] && Lg.calls[G6b].frozen && !Lg.calls[G6b].graded, 'the calls stop: the open call dropped, no new call made, the frozen call awaiting its closing lines kept');
    check(/^decided at 7 lines on 2026-11-05T18:00Z: FAIL, stopped early by the owner before the 30000 the bar is judged at$/.test(Lg.summary.standing) && !/pass/i.test(Lg.summary.standing), `the summary's standing says so ("${Lg.summary.standing}")`);
    clean(checkAt('2026-11-05T18:00:00Z', prevOf(sPre)), 'and the check is clean on the run that wrote it');
    { const st = require('./publish').decisionState(D);
      check(st.verdict === 'FAIL' && st.decidedAt === D.decided_at && st.lines === 7 && st.games === 2 && JSON.stringify(st.early) === JSON.stringify(ES) && JSON.stringify(st.scores) === JSON.stringify(D.scores) && JSON.stringify(st.flat) === JSON.stringify(D.flat),
        "what state.json carries for the page (publish.js): the verdict, its time, lines and games, its scores and flat bets, and early as the code registered it"); }
    /* every tamper with the early decision fails the check (the summary re-worked each time, so the decision alone is wrong) */
    const good = { ledger: fs.readFileSync(PL.LEDGER(), 'utf8'), lines: lineText() };
    const tamper = (what, fn, re, t = '2026-11-05T18:00:00Z') => { const Lx = JSON.parse(good.ledger); fn(Lx); Lx.summary = PL.summarize(Lx, PL.readLines(), PL.recordIndex([2027]));
      const b = checkAt(t, prevOf(sPre), Lx, good.lines); check(b.some(x => re.test(x)), `${what} fails the check${b.length ? ` ("${b.find(x => re.test(x)) || b[0]}")` : ' (it passed)'}`); };
    tamper('an early decision whose why is not the code\'s', x => { x.decision.early.why = 'the model was behind'; }, /not the early stop's/);
    tamper('an early decision by someone else', x => { x.decision.early.by = 'the job'; }, /not the early stop's/);
    tamper('an early decision at another time', x => { x.decision.early.at = '2026-11-04T18:00:00Z'; }, /not the early stop's/);
    tamper('a decision short of the bar\'s sample with no early', x => { delete x.decision.early; }, /not the early stop's/);
    tamper('an early PASS', x => { x.decision.verdict = 'PASS'; }, /can only be FAIL/);
    tamper('its log loss edited', x => { x.decision.scores.logloss_diff = +(x.decision.scores.logloss_diff - 0.01).toFixed(6); }, /does not follow from the first 7/);
    tamper('its interval edited', x => { x.decision.scores.brier_diff_ci90 = [-0.01, -0.001]; }, /does not follow from the first 7/);
    tamper('its flat bets edited', x => { x.decision.flat.all.units = 5; }, /does not follow from the first 7/);
    tamper('its game count edited', x => { x.decision.games = 1; }, /does not follow from the first 7/);
    tamper('its last game edited', x => { x.decision.last_game = G5; }, /does not follow from the first 7/);
    tamper('decided before the stop', x => { x.decision.decided_at = '2026-11-05T17:59Z'; }, /before its time/);
    tamper('decided after the check\'s clock', x => { x.decision.decided_at = '2026-11-05T18:05Z'; }, /after this check's clock/);
    tamper('on more lines than were graded', x => { x.decision.lines = 8; }, /more than the 7 graded and compared by/);
    /* backdated: a run at 18:01 writing a decision dated 18:00 could leave out what it graded itself */
    tamper('dated before the run that wrote it', x => { x.run_at = '2026-11-05T18:01Z'; }, /not the time of the run that wrote it \(2026-11-05T18:01Z\)/, '2026-11-05T18:01:00Z');
    /* a cherry-picked earlier stop: the lines before this run's game, its numbers re-worked on them, still refused */
    tamper('on fewer lines than were graded by then (the numbers re-worked on them)', x => { const r = PL.stopEarly(own.slice(0, 4), T('2026-11-05T18:00:00Z')); x.decision = r; }, /fewer than the 7 graded and compared by/);
    tamper('no decision on a ledger written at the stop', x => { x.decision = null; }, /at or after the early stop .* no verdict was written/);
    /* the run stamps its own work with its own time, and that time is the check's clock: a run cannot leave a grade of its
       own out of the lines it decides on, date itself back past what it graded, or back before the stop to keep calling */
    const shortOf = () => PL.stopEarly(own.slice(0, 4), T('2026-11-05T18:00:00Z'));
    tamper('its own new grade stamped after the check\'s clock, the decision on the 4 lines before it', x => { x.calls[G6].graded.at = '2026-11-05T18:01Z'; x.decision = shortOf(); }, /graded at 2026-11-05T18:01Z, after the run that wrote the ledger/);
    tamper('a run at 20:00 dated 18:00, its own grade left at 20:00, deciding on the 4 lines before it', x => { x.calls[G6].graded.at = '2026-11-05T20:00Z'; x.decision = shortOf(); }, /changed by a run at 2026-11-05T18:00Z, not at this check's clock \(2026-11-05T20:00Z\)/, '2026-11-05T20:00:00Z');
    const keepCalling = (at, graded) => x => { const P0 = prevOf(sPre).ledger; x.decision = null; x.run_at = at; x.calls[G6].graded.at = graded;
      for (const k of Object.keys(P0.calls)) if (!P0.calls[k].frozen) x.calls[k] = P0.calls[k]; };
    tamper('a run at 18:05 dated 17:59 with no decision, its open calls kept', keepCalling('2026-11-05T17:59Z', '2026-11-05T17:59Z'), /changed by a run at 2026-11-05T17:59Z, not at this check's clock \(2026-11-05T18:05Z\)/, '2026-11-05T18:05:00Z');
    tamper('a run on 6 November left at the last commit\'s run time with no decision', keepCalling('2026-11-05T17:59Z', '2026-11-05T17:59Z'), /not at this check's clock \(2026-11-06T10:00Z\)/, '2026-11-06T10:00:00Z');
    tamper('the FAIL with a call still open', x => { const fid = Object.keys(x.fits)[0]; x.calls[G8] = PL.callOf(up([G8])[G8], fid, T('2026-11-05T18:00:00Z')); }, /a FAIL with 1 call not frozen .*the calls stop/);
    { const Lx = JSON.parse(good.ledger); Lx.decision = PL.stopEarly(own, T('2026-11-05T18:03:00Z')); Lx.summary = PL.summarize(Lx, PL.readLines(), PL.recordIndex([2027]));
      const b = checkAt('2026-11-05T18:05:00Z', null, Lx, good.lines);
      check(b.some(x => /the early stop decided at 2026-11-05T18:03Z, after the run that wrote the ledger \(2026-11-05T18:00Z\)/.test(x)), `with no earlier ledger, a decision dated after the run that wrote the ledger (though before the check's clock) fails the check (${b.join('; ') || 'it passed'})`); }
    tamper('an early decision on no graded line', x => { x.decision = { ...x.decision, lines: 0 }; }, /the early stop on 0 graded lines: it is never on none/);
    { const Lx = JSON.parse(good.ledger); Lx.decision = PL.stopEarly(own.slice(0, 4), T('2026-11-05T18:00:00Z')); Lx.summary = PL.summarize(Lx, PL.readLines(), PL.recordIndex([2027]));
      check(Lx.decision && Lx.decision.lines === 4 && JSON.stringify(Lx.decision.early) === JSON.stringify(ES) && Lx.decision.verdict === 'FAIL', '(the fewer-lines tamper is a well-formed early stop on its own 4 lines, so the line count alone refuses it)'); }
    clean(checkAt('2026-11-05T18:00:00Z', prevOf(sPre)), 'and the honest files pass again');
    /* a frozen call graded after the stop; the decision never revisited, the summary counting on */
    await readClosing([G6b], '2026-11-06T09:00:00Z');
    const sDec = snapE();
    runAt('2026-11-06T10:00:00Z', [G7, G8]);
    Lg = PL.readLedger();
    check(Lg.calls[G6b].graded && Lg.calls[G6b].graded.lines === 2 && JSON.stringify(Lg.decision) === JSON.stringify(D) && Lg.summary.compared === 9 && Lg.summary.graded_games === 3 && !Lg.calls[G7] && !Lg.calls[G8],
      `a call frozen before the stop is graded after it (${Lg.calls[G6b].graded && Lg.calls[G6b].graded.lines} lines), the decision as it was, the summary counting on (${Lg.summary.compared} lines), and still no call`);
    clean(checkAt('2026-11-06T10:00:00Z', prevOf(sDec)), 'and the check is clean on the later run');
    clean(checkAt('2026-11-06T10:00:00Z', null), 'and with no earlier ledger to hold it to (--no-prev), the decision made by an earlier run passes');
    { const Lx = PL.readLedger(); Lx.decision = { ...Lx.decision, early: { ...Lx.decision.early, why: 'x' } }; Lx.summary = PL.summarize(Lx, PL.readLines(), PL.recordIndex([2027]));
      check(checkAt('2026-11-06T10:00:00Z', prevOf(sDec), Lx).some(x => /differs from the last commit/.test(x)), 'the early decision changed after the commit that wrote it fails the check'); }
    /* never a PASS; nothing once a decision is made or the bar's sample is in */
    const R = () => { let a = 7; return () => { a = (a * 16807) % 2147483647; return a / 2147483647; }; };
    const make = (n, f) => { const r = R(); const rows = []; for (let i = 0; i < n; i++) rows.push(f(i, r, 'g' + Math.floor(i / 120))); return rows; };
    const sharp = (i, r, g) => { const p = i % 2 ? 0.3 : 0.7; return { game: g, stat: 'pts', pModel: p, pMarket: 0.5, over: -110, under: -110, result: r() < p ? 'over' : 'under' }; };
    const after = T('2026-11-20T12:00:00Z'), sh = make(1200, sharp), es = PL.stopEarly(sh, after);
    check(es && es.verdict === 'FAIL' && es.scores.logloss_diff_ci90[1] < 0 && es.scores.brier_diff_ci90[1] < 0 && es.flat.all.units > 0 && es.lines === 1200,
      'never a PASS: on lines where the model beats the market on both scores and the bets are up, the early stop is still a FAIL');
    check(PL.stopEarly(sh, T('2026-11-05T17:59:59Z')) === null, 'and before its time it writes nothing');
    const full = make(PL.BAR.lines, sharp), dFull = PL.decide(full, after);
    check(PL.stopEarly(full, after) === null && dFull.verdict === 'PASS' && !dFull.early && PL.stopEarly(make(PL.BAR.lines + 10, sharp), after) === null,
      "with the bar's 30,000 in, the early stop does nothing: the bar's own decision stands (here a PASS)");
    { const Lx = PL.readLedger(), made = { verdict: 'PASS', decided_at: '2026-10-30T18:00Z', lines: 30000 }; Lx.decision = made; fs.writeFileSync(PL.LEDGER(), PL.stringify(Lx));
      const r = PL.run({ upcoming: up([G7, G8]), params, games, now: after, boxes, log: quiet, write: false });
      check(JSON.stringify(r.ledger.decision) === JSON.stringify(made), 'a decision already made is kept by a run after the stop: the early stop writes nothing over it'); }
    /* the stop ends this trial alone: a new trial's ledger, its bar registered since (a second props model's, say), calls
       on through the stop, grades with no verdict, and the check is clean; an early decision planted on it is refused */
    { const dir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-early-new-'));
      process.env.NBA_PROPS_LEDGER = path.join(dir2, 'props_shadow.json'); process.env.NBA_PROPS_LINES = path.join(dir2, 'props_shadow_lines.csv');
      const gl = st => games.map(g => ({ ...g, status: st.includes(g.game_id) ? 'final' : 'scheduled' }));
      const prevNow = () => ({ ledger: PL.readLedger(), lines: lineText(), reads: JSON.parse(fs.readFileSync(path.join(tmp, 'props_reads.json'), 'utf8')),
        record: Object.fromEntries(fs.readdirSync(tmp).filter(f => /^props_\d{4}\.csv$/.test(f)).map(f => [f, fs.readFileSync(path.join(tmp, f), 'utf8')])) });
      const run2 = (t, ids, g2) => PL.run({ upcoming: up(ids), params, games: g2, now: T(t), boxes, log: quiet });
      const ck2 = (t, prev, g2, Lx = PL.readLedger()) => PC.check({ Lg: Lx, lineText: lineText(), prev, games: g2, boxes, now: T(t) });
      const N0 = PL.newLedger(T('2026-11-04T11:00:00Z')); N0.summary = PL.summarize(N0, [], { by: new Map(), reads: {} }); fs.writeFileSync(PL.LEDGER(), PL.stringify(N0));
      let pv = prevNow();
      run2('2026-11-04T12:00:00Z', [G5, G6, G6b, G7], gl([]));
      clean(ck2('2026-11-04T12:00:00Z', pv, gl([])), 'a new trial\'s ledger (its bar registered 2026-11-04T11:00Z) makes its calls');
      pv = prevNow();
      run2('2026-11-05T19:00:00Z', [G7, G8], gl([G5]));
      const N1 = PL.readLedger();
      check(!PL.stopsLedger(N1) && !N1.decision && N1.calls[G5].graded && N1.calls[G5].graded.lines === 4 && N1.calls[G7] && !N1.calls[G7].frozen && N1.calls[G8] && N1.summary.compared === 4,
        `after the stop's time it grades (${N1.calls[G5].graded && N1.calls[G5].graded.lines} lines), writes no verdict and calls on (${Object.values(N1.calls).filter(c => !c.frozen).length} calls open): the stop is not its own`);
      clean(ck2('2026-11-05T19:00:00Z', pv, gl([G5])), 'and the check is clean, a line graded after the stop with no verdict');
      { const Lx = PL.readLedger(), cmpN = PL.compared(PL.readLines(), PL.recordIndex([2027]));
        Lx.decision = PL.stopEarly(cmpN, T('2026-11-05T19:00:00Z')); for (const k of Object.keys(Lx.calls)) if (!Lx.calls[k].frozen) delete Lx.calls[k];
        Lx.summary = PL.summarize(Lx, PL.readLines(), PL.recordIndex([2027]));
        const b = ck2('2026-11-05T19:00:00Z', pv, gl([G5]), Lx);
        check(Lx.decision && Lx.decision.lines === 4 && b.some(x => /on a ledger the early stop does not end \(its bar registered at 2026-11-04T11:00Z; the stop ends the one registered at 2026-10-15T11:35Z\)/.test(x)),
          `the early stop's FAIL planted on it is refused (${b.find(x => /does not end/.test(x)) || b.join('; ')})`); }
      /* this trial's ledger with no line graded: the stop writes nothing on none, and the check asks for no verdict */
      const Z0 = PL.newLedger(T('2026-10-15T11:35:00Z')); Z0.summary = PL.summarize(Z0, [], { by: new Map(), reads: {} }); fs.writeFileSync(PL.LEDGER(), PL.stringify(Z0)); fs.rmSync(PL.LINES(), { force: true });
      pv = prevNow();
      run2('2026-11-05T19:00:00Z', [G7, G8], gl([]));
      const Z1 = PL.readLedger();
      check(PL.stopsLedger(Z1) && !Z1.decision && Z1.calls[G7] && PL.stopEarly([], T('2026-11-20T12:00:00Z')) === null, 'on this trial\'s ledger with no line graded, the stop writes nothing (it is never on none) and the calls go on');
      clean(ck2('2026-11-05T19:00:00Z', pv, gl([])), 'and the check asks for no verdict on none');
      process.env.NBA_PROPS_LEDGER = path.join(dir, 'props_shadow.json'); process.env.NBA_PROPS_LINES = path.join(dir, 'props_shadow_lines.csv');
      fs.rmSync(dir2, { recursive: true, force: true }); }
    if (keep[0] === undefined) delete process.env.NBA_PROPS_LEDGER; else process.env.NBA_PROPS_LEDGER = keep[0];
    if (keep[1] === undefined) delete process.env.NBA_PROPS_LINES; else process.env.NBA_PROPS_LINES = keep[1];
    fs.rmSync(dir, { recursive: true, force: true });
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `${fails} failed` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e.stack || e); process.exit(1); });
