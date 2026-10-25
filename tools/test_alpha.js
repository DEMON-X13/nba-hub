/* Tests for the Alpha Model (tools/alpha.js, models/alpha.json, research/alpha.json). No network; nothing written in
 * the repo (a scratch folder under the system's temp for the files a test writes); about ten seconds.
 *
 *   node tools/test_alpha.js       must end "all good"
 *
 * 1. no leakage: on the real data, the day's games read as games to come (the day and everything after it not yet
 *    played) and read again once final give the same inputs, and the same call, to the last digit: home, Elo, rest,
 *    back to back, net rating, the usual rotation, the previous game's and the injury log's rotation
 * 2. the state by hand, on a made-up league: the Elo update (home and neutral), the net rating's first step, a club's
 *    first game of a season (the carry, no rest edge, no previous game), a neutral site (no home court, no altitude,
 *    the call turned exactly over when the clubs swap sides), a postponed game (no final moves, no rating moves, a call
 *    of its own), a club with no box score (the Elo learns, nothing else; no NaN), every player out (a floor)
 * 3. tonight's rotation on made-up reports, through the hub's own makeLiveLineup: Out, Day-To-Day returning after the
 *    game and on it, Out on the report's own day, suspended, a debutant (no cost), a player traded in and out
 * 4. the fit: least squares and the slope on planted data; the call is the formula; a margin of 0 is an even chance
 * 5. determinism and a quiet day: the same data gives the same file, and a second write writes nothing
 * 6. the committed files: the contract's shape, every game of the season in play called, the fitted numbers the fit
 *    of the finished seasons, the walk-forward research/alpha.json's, no fold fitted on its own season
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const A = require('./alpha');
const L = require('./lib');

let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const MODEL = path.join(L.ROOT, 'models', 'alpha.json'), RESEARCH = path.join(L.ROOT, 'research', 'alpha.json');
const committed = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
const D = committed.params.design;
const inputs = r => JSON.stringify([r.x, ['usual', 'pretip', 'log'].map(k => [r.drop.home[k], r.drop.away[k]])]);

console.log('1. no leakage: a game read before its tip-off and once final');
const ctx = A.load();
{
  const full = A.replay(D, ctx).rows, byId = Object.fromEntries(full.map(r => [r.id, r]));
  const { inPlay } = A.seasons(ctx);
  const lastDay = ctx.games.filter(g => g.final && g.season === inPlay).map(g => g.date).sort().pop();
  const M = committed.params;
  for (const cut of [lastDay, '2026-01-15']) {
    /* the data as it stood that morning: the day's games and every later one unplayed, their box scores not in */
    const before = { ...ctx, boxes: { ...ctx.boxes }, games: ctx.games.map(g => g.date >= cut ? { ...g, final: false, status: 'scheduled', hs: null, as: null } : g) };
    for (const g of ctx.games) if (g.date >= cut) delete before.boxes[g.id];
    const rows = A.replay(D, before).rows.filter(r => r.date === cut);
    const same = rows.filter(r => inputs(r) === inputs(byId[r.id]));
    check(rows.length > 0 && same.length === rows.length, `${cut}: all ${rows.length} games' inputs the same before and after (${rows.length - same.length} differ)`);
    if (cut === lastDay) {
      const calls = rows.filter(r => JSON.stringify(A.callOf(r, M)) === JSON.stringify(A.callOf(byId[r.id], M)));
      check(calls.length === rows.length && rows.every(r => A.modeOf(byId[r.id]) === 'log'), `${cut}: the call once final is the one made before tip-off on that day's injury log`);
    }
  }
  /* the fit's rows are read the same way: no row of a season is moved by a later season's games */
  const cut = '2025-10-01', before = { ...ctx, games: ctx.games.filter(g => g.date < cut) };
  const early = A.replay(D, before).rows, diff = early.filter(r => inputs(r) !== inputs(byId[r.id]) || JSON.stringify(r.drop.home.known) !== JSON.stringify(byId[r.id].drop.home.known));
  check(early.length > 20000 && diff.length === 0, `every row through 2024-25 (${early.length}) the same with and without the seasons after it`);
}

console.log('2. the state by hand, on a made-up league');
/* four clubs (DEN among them, for the altitude flag), two seasons of twenty days, two games a day, each club's ten
   players at fixed minutes, scores and plus-minus from a fixed seed */
function league(edit) {
  const T = ['AAA', 'BBB', 'CCC', 'DEN'], MIN = [36, 34, 32, 30, 28, 24, 20, 16, 12, 8];
  let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const games = [], boxes = {}, poss = {};
  const pairs = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[2, 0], [3, 1]], [[3, 0], [2, 1]]];
  for (const season of [2023, 2024]) for (let d = 0; d < 20; d++) {
    const day = L.addDays(`${season - 1}-11-01`, d * 2);
    for (const [j, [h, a]] of pairs[d % 6].entries()) {
      /* the second game of every fourth day is played the day after (never a day another game of theirs is on), so the
         clubs' rest differs and some play back to backs */
      const date = j && d % 4 === 1 ? L.addDays(day, 1) : day;
      const home = T[h], away = T[a], hs = 100 + Math.floor(rnd() * 25), as = 98 + Math.floor(rnd() * 25);
      const id = `${season}_${date.replace(/-/g, '')}_${away}_${home}`;
      games.push({ id, season, date, type: 'REG', home, away, neutral: false, final: true, status: 'final', hs, as, tip: date + 'T23:00Z' });
      boxes[id] = {};
      for (const [t, s] of [[home, hs - as], [away, as - hs]]) {
        boxes[id][t] = MIN.map((m, i) => ({ id: t + i, min: m, starter: i < 5 ? 1 : 0, gs: m * (0.3 - i * 0.02) + rnd(), pm: Math.round(s * m / 240 + (rnd() - 0.5) * 6 + (4 - i)) }));
        poss[id + ':' + t] = 98 + Math.floor(rnd() * 6);
      }
    }
  }
  /* sorted as load() sorts, before an edit (which reads the games by their place in that order) and after it */
  const order = c => c.games.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
  const c = { games, boxes, poss, injLog: {}, logDates: [] };
  order(c); if (edit) { edit(c); order(c); }
  return c;
}
const LG = league();
{
  const R = A.replay(D, LG), first = LG.games[0], row = R.rows[0];
  /* the first final by hand: both clubs at 1500, the home court in the Elo's expectation only, the NFL app's rule */
  const one = A.replay(D, { ...LG, games: [first] });
  const mov = first.hs - first.as, d = D.hfa, p = 1 / (1 + Math.pow(10, -d / 400));
  const delta = (D.elo === 'nfl' ? D.K / 2.3 : D.K) * Math.log(Math.abs(mov) + 1) * 2.2 / (Math.abs(d) * 0.001 + 2.2) * ((mov > 0 ? 1 : 0) - p);
  check(near(one.clubs[first.home].elo, 1500 + delta) && near(one.clubs[first.away].elo, 1500 - delta), `the Elo update by hand (home ${first.home} by ${mov}: ${delta.toFixed(3)} Elo)`);
  const oh = 100 * first.hs / LG.poss[first.id + ':' + first.home], oa = 100 * first.as / LG.poss[first.id + ':' + first.away];
  check(near(one.clubs[first.home].o, 110 + D.alpha * (oh - 110)) && near(one.clubs[first.home].d, 110 + D.alpha * (oa - 110)), 'the net rating\'s first step: from the league\'s level, a share alpha of the game\'s points per 100 possessions');
  check(row.x.elo === 0 && row.x.net === 0 && row.x.rest === 0 && row.drop.home.usual === null && row.drop.home.pretip === 0, 'a club\'s first game ever: even on Elo and net, no rest edge, no usual rotation and no drop');

  /* a club's first game of a new season: Elo carried 70%, net carried, no rest edge, no previous game */
  const end = A.replay(D, { ...LG, games: LG.games.filter(g => g.season === 2023) });
  const g24 = R.rows.find(r => r.season === 2024), h = end.clubs[g24.home], a = end.clubs[g24.away];
  check(near(g24.x.elo, D.carry * (h.elo - a.elo), 1e-9), `a new season: the Elo gap carried ${D.carry} (${g24.x.elo.toFixed(2)})`);
  check(near(g24.x.net, D.carryNet * ((h.o - h.d) - (a.o - a.d)), 1e-9), `a new season: the net rating carried ${D.carryNet}`);
  check(g24.x.rest === 0 && g24.x.b2b === 0 && g24.drop.home.pretip === 0 && g24.drop.away.pretip === 0 && g24.drop.home.usual !== null, 'a new season: no rest edge, no previous game\'s drop, the usual rotation carried from the last season\'s games');
  const later = R.rows.filter(r => r.season === 2023 && r.date > LG.games[8].date);
  check(later.some(r => r.x.b2b !== 0) && later.some(r => r.x.rest !== 0) && later.every(r => Math.abs(r.x.rest) <= D.restClip), 'within a season the rest and back-to-back terms move, the rest gap clipped');

  /* a neutral site: no home court and no altitude, and the same game with the clubs swapped is the same call turned over */
  const k = LG.games.findIndex(g => g.season === 2024 && g.home === 'DEN' && g.date > L.addDays('2023-11-01', 10));
  const neutral = league(c => { c.games[k] = { ...c.games[k], neutral: true }; });
  const swapped = league(c => { const g = c.games[k], id = `${g.season}_${g.date.replace(/-/g, '')}_${g.home}_${g.away}`;
    c.games[k] = { ...g, id, home: g.away, away: g.home, hs: g.as, as: g.hs, neutral: true }; c.boxes[id] = c.boxes[g.id]; delete c.boxes[g.id];
    for (const t of [g.home, g.away]) c.poss[id + ':' + t] = c.poss[g.id + ':' + t]; });
  const rn = A.replay(D, neutral).rows, rs = A.replay(D, swapped).rows, ri = LG.games[k].id;
  const n1 = rn.find(r => r.id === ri), s1 = rs.find(r => r.home === n1.away && r.date === n1.date && r.away === n1.home), home = R.rows.find(r => r.id === ri);
  check(home.x.home === 1 && home.x.alt === 1 && n1.x.home === 0 && n1.x.alt === 0, 'a neutral site: no home court and no altitude (Denver\'s game, played away from Denver)');
  const M = committed.params;
  check(near(A.margin(n1, M, 'pretip'), -A.margin(s1, M, 'pretip'), 1e-9) && near(A.callOf(n1, M).pHome + A.callOf(s1, M).pHome, 1, 1e-4), 'a neutral site: the clubs swapped, the margin and the chance turned exactly over');
  const nAfter = A.replay(D, neutral).clubs, sAfter = A.replay(D, swapped).clubs;
  check(Object.keys(nAfter).every(t => near(nAfter[t].elo, sAfter[t].elo, 1e-9)), 'a neutral site: the Elo update the same whichever club is listed at home');

  /* a postponed game: one left in the table as scheduled on a past day changes no final's inputs and no rating, and
     gets a call of its own; one the table dropped leaves no trace */
  const pg = LG.games[30];
  const stuck = league(c => { c.games.push({ ...pg, id: pg.id + 'X', date: L.addDays(pg.date, -1), final: false, status: 'scheduled', hs: null, as: null }); });
  const Rs = A.replay(D, stuck), finals = id => Object.fromEntries(Rs.rows.filter(r => r.final).map(r => [r.id, inputs(r)]));
  const fs1 = finals(), base = Object.fromEntries(R.rows.map(r => [r.id, inputs(r)]));
  check(Object.keys(base).every(id => fs1[id] === base[id]) && Object.keys(R.clubs).every(t => R.clubs[t].elo === Rs.clubs[t].elo && R.clubs[t].o === Rs.clubs[t].o), 'a postponed game left as scheduled: no final\'s inputs and no rating moved');
  const ps = Rs.rows.find(r => r.id === pg.id + 'X');
  check(ps && !ps.final && Number.isFinite(A.callOf(ps, M).pHome), 'a postponed game left as scheduled: a call of its own, among the games to come');
  const dropped = league(c => { c.games.splice(30, 1); delete c.boxes[pg.id]; });
  check(A.replay(D, dropped).rows.every(r => r.id !== pg.id), 'a postponed game the table dropped: no row');

  /* a club with no box score: a final with none moves the Elo and nothing else; a club with no box at all is even on net
     and has no drop, and every number is finite */
  const nb = LG.games[25];
  const noBox = league(c => { delete c.boxes[nb.id]; delete c.poss[nb.id + ':' + nb.home]; delete c.poss[nb.id + ':' + nb.away]; });
  const one1 = A.replay(D, { ...noBox, games: noBox.games.filter(g => g.date <= nb.date) }), one0 = A.replay(D, { ...noBox, games: noBox.games.filter(g => g.date < nb.date) });
  const ch = one1.clubs[nb.home], c0 = one0.clubs[nb.home];
  check(ch.elo !== c0.elo && ch.o === c0.o && ch.d === c0.d && ch.win.length === c0.win.length, 'a final with no box score: the Elo learns from it, the net rating and the rotation window do not');
  check(A.replay(D, noBox).rows.find(r => r.id === nb.id).box === false, 'a final with no box score is neither fitted nor scored');
  const lone = league(c => { for (let i = 0; i < 6; i++) { const g = c.games[60 + i]; c.games.push({ ...g, id: g.id.replace(g.away, 'EEE'), away: 'EEE' }); } });
  const le = A.replay(D, lone).rows.filter(r => r.away === 'EEE');
  check(le.length === 6 && le.every(r => r.drop.away.usual === null && r.drop.away.pretip === 0 && Number.isFinite(A.callOf(r, M).pHome) && Number.isFinite(A.callOf(r, M).spread)), 'a club that never had a box score: no usual rotation, no drop, a finite call');

  /* every player out: tonight is all replacement minutes, the drop the usual rotation's whole worth, never NaN */
  const late = league(c => { const g = c.games[c.games.length - 1]; c.games[c.games.length - 1] = { ...g, final: false, status: 'scheduled', hs: null, as: null }; delete c.boxes[g.id]; });
  const allOut = A.replay(D, late, { live: (g, t) => t === g.home ? [] : null }).rows.pop();
  check(allOut.drop.home.live === allOut.drop.home.usual && Number.isFinite(allOut.drop.home.live) && allOut.drop.away.live === undefined, `every player out: the drop is the usual rotation's worth (${allOut.drop.home.usual.toFixed(4)}), finite`);
}

console.log('3. tonight\'s rotation through makeLiveLineup, on made-up reports');
{
  /* players.js read on a scratch folder's report and rosters: the hub's own rule, run on made-up files */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-test-'));
  fs.mkdirSync(path.join(dir, 'tools')); fs.mkdirSync(path.join(dir, 'data'));
  for (const f of ['lib.js', 'elo.js', 'players.js']) fs.copyFileSync(path.join(__dirname, f), path.join(dir, 'tools', f));
  const date = '2024-03-10';
  const report = { date, teams: { AAA: [
    { id: 'AAA0', status: 'Out', returns: '' },                       // Out, no return date: out
    { id: 'AAA1', status: 'Day-To-Day', returns: '2024-03-12' },      // returns after the game: out
    { id: 'AAA2', status: 'Day-To-Day', returns: '2024-03-10' },      // returns on the game's day: plays
    { id: 'AAA3', status: 'Suspension', returns: '' },                // suspended: out
    { id: 'AAA4', status: 'Out', returns: '2024-03-09' },             // Out on the report's own day, whatever the date says
  ] } };
  const roster = (t, extra = [], less = []) => Array.from({ length: 10 }, (_, i) => t + i).filter(id => !less.includes(id)).concat(extra).map(id => ({ id, name: id }));
  fs.writeFileSync(path.join(dir, 'data', 'injuries.json'), JSON.stringify(report));
  fs.writeFileSync(path.join(dir, 'data', 'rosters_espn.json'), JSON.stringify({ date, teams: { AAA: roster('AAA', ['NEW1', 'BBB5']), BBB: roster('BBB', ['NEW2'], ['BBB5']) } }));
  const make = require(path.join(dir, 'tools', 'players.js')).makeLiveLineup({ coachOf: () => '' });
  const game = { id: `2024_${date.replace(/-/g, '')}_BBB_AAA`, season: 2024, date, type: 'REG', home: 'AAA', away: 'BBB', neutral: false, final: false, status: 'scheduled', hs: null, as: null, tip: '' };
  const withGame = league(c => c.games.push(game));
  let lists = {};
  const live = A.liveProvider(make), spy = (g, t, ...rest) => { const l = live(g, t, ...rest); lists[t] = l; return l; };
  const row = A.replay(D, withGame, { live: spy }).rows.find(r => r.id === game.id);
  const ids = t => new Set(lists[t].map(([p]) => p.id));            // makeLiveLineup names each player it lists
  const aaa = ids('AAA'), bbb = ids('BBB');
  check(!aaa.has('AAA0') && !aaa.has('AAA1') && !aaa.has('AAA3') && !aaa.has('AAA4'), 'Out, Day-To-Day returning after the game, suspended, and Out on the report\'s own day: none plays');
  check(aaa.has('AAA2') && aaa.has('AAA5'), 'Day-To-Day returning on the game\'s day plays, as does everyone not listed');
  check(aaa.has('BBB5') && !bbb.has('BBB5'), 'a player traded: on his new club\'s rotation, off his old one\'s');
  const debut = lists.AAA.find(([p]) => p.id === 'NEW1');
  check(debut && debut[1] === 12, 'a debutant plays twelve minutes, last in the rotation order');
  /* the debutant costs nothing: with him off the roster, tonight's strength (and so the drop) is the same */
  fs.writeFileSync(path.join(dir, 'data', 'rosters_espn.json'), JSON.stringify({ date, teams: { AAA: roster('AAA', ['BBB5']), BBB: roster('BBB', ['NEW2'], ['BBB5']) } }));
  const make2 = require(path.join(dir, 'tools', 'players.js')).makeLiveLineup({ coachOf: () => '' });
  const row2 = A.replay(D, withGame, { live: A.liveProvider(make2) }).rows.find(r => r.id === game.id);
  check(near(row.drop.home.live, row2.drop.home.live, 1e-12), `a debutant at the replacement level: no cost (drop ${row.drop.home.live.toFixed(4)} either way)`);
  check(row.drop.home.live > row.drop.away.live && A.modeOf(row) === 'live', `four of AAA's rotation out: AAA's drop (${row.drop.home.live.toFixed(4)}) over BBB's (${row.drop.away.live.toFixed(4)}), and the game is called on tonight's report`);
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('4. the fit and the call');
{
  /* least squares recovers planted coefficients exactly with no noise; the slope recovers a planted logistic */
  const X = [], y = [];
  for (let i = 0; i < 200; i++) { const x = [1, Math.sin(i), Math.cos(i * 1.7), (i % 7) - 3]; X.push(x); y.push(2 * x[0] - 0.5 * x[1] + 3 * x[2] + 0.25 * x[3]); }
  const b = A.lsq(X, y);
  check([2, -0.5, 3, 0.25].every((v, i) => near(b[i], v, 1e-9)), 'least squares: planted coefficients recovered');
  let seed = 3; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const m = [], yy = []; for (let i = 0; i < 20000; i++) { const v = (rnd() - 0.5) * 30; m.push(v); yy.push(rnd() < 1 / (1 + Math.exp(-0.13 * v)) ? 1 : 0); }
  const k = A.slope(m, yy);
  check(Math.abs(k - 0.13) < 0.01, `the slope by log loss: planted 0.13, fitted ${k.toFixed(4)}`);
  const M = committed.params, r = A.replay(D, LG).rows[50];
  const mm = M.feats.reduce((s, f) => s + M.coef[f] * (f === 'rot' ? r.drop.home.pretip - r.drop.away.pretip : r.x[f]), 0);
  const call = A.callOf(r, M);
  check(call.pHome === +(1 / (1 + Math.exp(-M.k * mm))).toFixed(4) && call.spread === +(-mm).toFixed(1), 'the call is the formula: the logistic of the margin, the spread the margin as a home line');
  const zero = { ...r, x: Object.fromEntries(Object.keys(r.x).map(f => [f, 0])), drop: { home: { pretip: 0 }, away: { pretip: 0 } } };
  check(A.callOf(zero, M).pHome === 0.5, 'a margin of 0 is an even chance (the ledger\'s pick, pHome >= 0.5, takes the home side)');
}

console.log('5. determinism and a quiet day');
{
  const one = A.replay(D, LG).rows, two = A.replay(D, LG).rows;
  check(JSON.stringify(one) === JSON.stringify(two), 'the same data, the same rows');
  const b1 = A.build(ctx, committed.params, committed.walkForward, A.liveProvider()), b2 = A.build(ctx, committed.params, committed.walkForward, A.liveProvider());
  check(JSON.stringify(b1) === JSON.stringify(b2), 'the same data, the same model file');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-write-')), f = path.join(dir, 'models', 'alpha.json');
  const first = A.write(f, { ...b1 }, null), stamp = JSON.parse(fs.readFileSync(f, 'utf8')).generated;
  const again = A.write(f, { ...b2 }, JSON.parse(fs.readFileSync(f, 'utf8')));
  check(first && !again && JSON.parse(fs.readFileSync(f, 'utf8')).generated === stamp, 'a second run on the same data writes nothing and keeps the stamp');
  fs.rmSync(dir, { recursive: true, force: true });

  console.log('6. the committed files');
  const keys = ['id', 'name', 'version', 'about', 'fitSeasons', 'params', 'walkForward', 'games', 'upcoming', 'status', 'generated'];
  const shape = m => JSON.stringify(Object.keys(m)) === JSON.stringify(keys) && m.id === 'alpha' && m.name === 'Alpha Model' && m.status && m.status.ok === true
    && Object.values(m.games).concat(Object.values(m.upcoming)).every(c => JSON.stringify(Object.keys(c)) === '["pHome","spread"]' && c.pHome > 0 && c.pHome < 1 && Number.isFinite(c.spread));
  check(shape(committed) && shape({ ...b1, generated: 'x' }), 'the contract\'s shape: its keys in order, {pHome, spread} for every call, every chance inside (0, 1)');
  const { inPlay } = A.seasons(ctx), all = L.readGames();
  const want = all.filter(g => +g.season === inPlay && g.type !== 'PRE' && ['final', 'scheduled', 'live'].includes(g.status)).map(g => g.game_id).sort();
  const toCome = all.filter(g => g.type !== 'PRE' && ['scheduled', 'live'].includes(g.status)).map(g => g.game_id).sort();
  check(JSON.stringify(Object.keys(b1.games).sort()) === JSON.stringify(want) && JSON.stringify(Object.keys(b1.upcoming).sort()) === JSON.stringify(toCome), `every regular-season and playoff game of ${inPlay - 1}-${String(inPlay).slice(2)} called (${want.length}), the ${toCome.length} to come apart, no preseason game`);
  check(['2024', '2025', '2026'].every(s => committed.walkForward[s] && committed.walkForward[s].games > 1000 && committed.walkForward[s].logloss > 0.5), 'the walk-forward: 2024, 2025 and 2026');
  const res = JSON.parse(fs.readFileSync(RESEARCH, 'utf8'));
  check(res.folds.every(f => +f.fit.split('-')[1] < f.season && JSON.stringify(committed.walkForward[f.season]) === JSON.stringify({ games: f.alpha.games, logloss: f.alpha.logloss, acc: f.alpha.acc, mae: f.alpha.mae })),
    'each fold fitted on the seasons before it alone, and the model file\'s walk-forward research/alpha.json\'s');
  check(JSON.stringify(res.design) === JSON.stringify(D) && res.trials.every(t => !('2026' in t) && !('2027' in t)), 'the design research/alpha.json chose, and no trial read 2026 or the season in play');
  const refit = A.fitLive(ctx, D, +committed.fitSeasons.split('-')[1]);
  check(JSON.stringify(refit.coef) === JSON.stringify(committed.params.coef) && refit.k === committed.params.k && refit.fitSeasons === committed.fitSeasons && +committed.fitSeasons.split('-')[1] < inPlay,
    `the fitted numbers are the fit of their seasons (${committed.fitSeasons}), finished seasons, the season in play never in it`);
}

console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
