/* Tests for the Alpha Model (tools/alpha.js, models/alpha.json, research/alpha.json). No network; nothing written in
 * the repo (a scratch folder under the system's temp for the files a test writes); about fifteen seconds. The job runs
 * it straight after the model, on the data as it stands, so it holds in every phase of a season: the season in play
 * with no final yet (its schedule is pulled 30 days before opening night), opening night, mid-season, the playoffs and
 * the summer; and nothing in it fails because an old final's box score was back-filled.
 *
 *   node tools/test_alpha.js       must end "all good"
 *
 * 1. no leakage, on the real data: the day's games read as games to come (the day and everything after it not yet
 *    played) and read again once final give the same inputs, and the same call, to the last digit (home, Elo, rest,
 *    back to back, net rating, the usual rotation, the previous game's rotation), on the season in play's last day with
 *    a final, else (no final yet) the last day with a final of any season; every call in `games` is the one the
 *    walk-forward makes, on the previous game's rotation, and today's roster and report move none of them; each club's
 *    first game of the season in play is called with no drop
 * 2. the state by hand, on a made-up league: the Elo update (home and neutral), the net rating's first step, a club's
 *    first game of a season (the carry, no rest edge, no previous game, and in `games` no drop, whoever last played for
 *    the club), a neutral site (no home court, no altitude, the call turned exactly over when the clubs swap sides), a
 *    postponed game (no final moves, no rating moves, a call of its own), a club with no box score (the Elo learns,
 *    nothing else; no NaN), every player out (a floor)
 * 3. tonight's rotation on made-up reports, through the hub's own makeLiveLineup: Out, Day-To-Day returning after the
 *    game and on it, Out on the report's own day, suspended, a debutant (no cost), a player traded in and out; and a
 *    report that does not read (the games to come on the previous game's rotation, the status saying so)
 * 4. the fit: least squares and the slope on planted data, and the fit's own conditions on a frozen made-up league; the
 *    call is the formula; a margin of 0 is an even chance
 * 5. determinism and a quiet day: the same data gives the same file, and a second write writes nothing; a run that
 *    refuses keeps the last calls and says why, and a model file that does not read is left as it is
 * 6. the model file: the contract's shape whatever its status, every game of the season in play called, the fit's
 *    seasons before the season in play, the walk-forward research/alpha.json's, no fold fitted on its own season; a
 *    refit of the fit's seasons on today's data is printed as a note, never a failure
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
const inputs = r => JSON.stringify([r.x, ['usual', 'pretip'].map(k => [r.drop.home[k], r.drop.away[k]])]);
/* the contract's shape: its keys in order, {pHome, spread} for every call, every chance inside (0, 1), and a status
   that is {ok: true} (with a note where a game to come could not be read on today's report) or a refusal's {ok: false,
   why}, which keeps the last good calls */
const KEYS = ['id', 'name', 'version', 'about', 'fitSeasons', 'params', 'walkForward', 'games', 'upcoming', 'status', 'generated'];
const okStatus = s => !!s && (s.ok === true ? Object.keys(s).every(k => k === 'ok' || (k === 'note' && typeof s.note === 'string' && s.note.length > 0))
  : s.ok === false && Object.keys(s).length === 2 && typeof s.why === 'string' && s.why.length > 0);
const shape = m => JSON.stringify(Object.keys(m)) === JSON.stringify(KEYS) && m.id === 'alpha' && m.name === 'Alpha Model' && okStatus(m.status)
  && Object.values(m.games).concat(Object.values(m.upcoming)).every(c => JSON.stringify(Object.keys(c)) === '["pHome","spread"]' && c.pHome > 0 && c.pHome < 1 && Number.isFinite(c.spread));
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* what a call logs, kept out of the test's own output and handed back, for a check that an error is logged */
const quiet = f => { const log = L.log, said = []; L.log = m => said.push(String(m)); try { return [f(), said]; } finally { L.log = log; } };

console.log('1. no leakage: a game read before its tip-off and once final');
const ctx = A.load();
const M = committed.params;
const { inPlay } = A.seasons(ctx), label = `${inPlay - 1}-${String(inPlay).slice(2)}`;
const full = A.replay(D, ctx).rows, byId = Object.fromEntries(full.map(r => [r.id, r]));
/* the model file as today's data makes it, on today's roster and report */
const b1 = A.build(ctx, M, committed.walkForward, A.liveProvider());
{
  /* before opening night the season in play has no final: the last day with one of any season stands in */
  const finalDays = s => ctx.games.filter(g => g.final && (s === undefined || g.season === s)).map(g => g.date).sort();
  const lastDay = finalDays(inPlay).pop() || finalDays().pop();
  for (const cut of [lastDay, '2026-01-15']) {
    /* the data as it stood that morning: the day's games and every later one unplayed, their box scores not in */
    const before = { ...ctx, boxes: { ...ctx.boxes }, games: ctx.games.map(g => g.date >= cut ? { ...g, final: false, status: 'scheduled', hs: null, as: null } : g) };
    for (const g of ctx.games) if (g.date >= cut) delete before.boxes[g.id];
    const rows = A.replay(D, before).rows.filter(r => r.date === cut);
    const alike = rows.filter(r => inputs(r) === inputs(byId[r.id]));
    check(rows.length > 0 && alike.length === rows.length, `${cut}: all ${rows.length} games' inputs the same before and after (${rows.length - alike.length} differ)`);
    if (cut === lastDay) {
      const calls = rows.filter(r => same(A.callOf(r, M, 'pretip'), A.callOf(byId[r.id], M, 'pretip')));
      check(calls.length === rows.length, `${cut}${finalDays(inPlay).length ? '' : ` (${label} has no final yet: the last day with one)`}: the call once final is the one made before tip-off, on the previous game's rotation`);
    }
  }
  /* the fit's rows are read the same way: no row of a season is moved by a later season's games */
  const cut = '2025-10-01', before = { ...ctx, games: ctx.games.filter(g => g.date < cut) };
  const early = A.replay(D, before).rows, diff = early.filter(r => inputs(r) !== inputs(byId[r.id]) || JSON.stringify(r.drop.home.known) !== JSON.stringify(byId[r.id].drop.home.known));
  check(early.length > 20000 && diff.length === 0, `every row through 2024-25 (${early.length}) the same with and without the seasons after it`);

  /* the model file's games, which the Pick'em Record takes for a game played before Alpha's first published call: every
     call the walk-forward's, on the previous game's rotation, final, under way or to come; and today's roster and report
     move none of them (here every player out tonight), only upcoming */
  const inSeason = full.filter(r => r.season === inPlay), nFinal = inSeason.filter(r => r.final).length;
  check(inSeason.length > 0 && inSeason.length === Object.keys(b1.games).length && inSeason.every(r => same(b1.games[r.id], A.callOf(r, M, 'pretip'))),
    `every call in games on the previous game's rotation, as the walk-forward calls a game (${inSeason.length}: ${nFinal} final, ${inSeason.length - nFinal} not)`);
  const b0 = A.build(ctx, M, committed.walkForward, () => []), toCome = Object.keys(b1.upcoming);
  check(same(b0.games, b1.games) && (!toCome.length || toCome.some(id => !same(b0.upcoming[id], b1.upcoming[id]))), `today's roster and report move no call in games, only upcoming (${toCome.length} to come)`);
  /* each club's first game of the season in play: no previous game of the season, so no drop in its call, whoever last
     played for the club (the injury log's reading, which these calls were made on before, put players gone for years in
     an opener's rotation) */
  const firsts = {};
  for (const r of inSeason) for (const side of ['home', 'away']) if (!firsts[r[side]]) firsts[r[side]] = r.drop[side];
  const fd = Object.values(firsts);
  check(fd.length > 0 && fd.every(d => d.pretip === 0), `each club's first game of ${label} (${fd.length} clubs): no drop in its call`);
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
  const c = { games, boxes, poss };
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
  /* and in the model file's games: AAA's best player sat out its last game of 2023 and its bench of 2023 (AAA6 to AAA9)
     never plays again, and the first game of 2024 is called with no drop on either side, as the walk-forward calls it,
     while the usual rotation (theirs among it) is there and AAA's drop comes in from its second game */
  const left = league(c => {
    const last = c.games.filter(g => g.season === 2023 && c.boxes[g.id].AAA).pop(); c.boxes[last.id].AAA = c.boxes[last.id].AAA.filter(r => r.id !== 'AAA0');
    for (const g of c.games) if (g.season === 2024 && c.boxes[g.id].AAA) c.boxes[g.id].AAA = c.boxes[g.id].AAA.filter(r => +r.id.slice(3) < 6);
  });
  const lb = A.build(left, committed.params, {}, null), lr = A.replay(D, left).rows.filter(r => r.season === 2024);
  const opener = lr.filter(r => r.date === lr[0].date), second = lr.filter(r => r.home === 'AAA' || r.away === 'AAA')[1];
  const m0 = r => committed.params.feats.reduce((s, f) => s + (f === 'rot' ? 0 : committed.params.coef[f] * r.x[f]), 0);
  check(opener.length === 2 && opener.every(r => r.drop.home.usual !== null && r.drop.away.usual !== null && r.drop.home.pretip === 0 && r.drop.away.pretip === 0
    && same(lb.games[r.id], { pHome: +(1 / (1 + Math.exp(-committed.params.k * m0(r)))).toFixed(4), spread: +(-m0(r)).toFixed(1) }))
    && second.drop[second.home === 'AAA' ? 'home' : 'away'].pretip !== 0, 'a new season in games: each club\'s first game called with no drop, whoever last played for it; AAA\'s drop from its second game');
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
  /* a report that does not read: the error is not swallowed: the game to come is called on its previous game's
     rotation, the status says so, and games is as it is with the report */
  fs.writeFileSync(path.join(dir, 'data', 'injuries.json'), '{"date": "2024-03-10", "teams": {');
  const [broken, said] = quiet(() => A.liveProvider(path.join(dir, 'tools', 'players.js')));
  const bb = A.build(withGame, M, {}, broken), bg = A.build(withGame, M, {}, A.liveProvider(make));
  check(/did not read/.test(broken.why || '') && said.length === 1 && said[0].includes(broken.why) && bb.status.ok === true && bb.status.note === `${broken.why}: 1 game to come called on each club's previous game's rotation` && okStatus(bb.status) && same(bg.status, { ok: true }),
    `a report that does not read: said in the status ("${bb.status.note}")`);
  check(same(bb.upcoming[game.id], A.callOf(row, M, 'pretip')) && same(bg.upcoming[game.id], A.callOf(row, M, 'live')) && same(bb.games, bg.games),
    'a report that does not read: the game to come called on its previous game\'s rotation, games the same as with the report');
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
  /* the fit procedure on a frozen made-up league where players miss games (so the rotation term moves): at the fitted
     numbers every term's column is orthogonal to the margin's residual (the normal equations) and the slope's score
     equation is 0; the live fit is that fit, rounded, on its seasons. The design's own terms but the rest gap alone:
     in this league a rest edge comes only from a back to back, so the two are one column */
  const miss = league(c => c.games.forEach((g, i) => { if (i % 3 === 0) c.boxes[g.id][g.home] = c.boxes[g.id][g.home].filter(r => r.id !== g.home + (i % 10)); }));
  const DF = { ...D, rest: 'gap' }, mr = A.replay(DF, miss).rows, F = A.fit(mr, DF, DF.fitFrom, 2023), tr = mr.filter(r => r.final && r.box && r.season <= 2023);
  const XF = tr.map(r => F.feats.map(f => f === 'rot' ? r.drop.home[DF.fitMode] - r.drop.away[DF.fitMode] : r.x[f])), mm0 = XF.map(x => x.reduce((s, v, i) => s + v * F.coef[F.feats[i]], 0));
  const normal = F.feats.map((f, p) => Math.abs(tr.reduce((s, r, i) => s + XF[i][p] * (r.mov - mm0[i]), 0)) / tr.reduce((s, r, i) => s + Math.abs(XF[i][p] * r.mov), 1));
  const score = Math.abs(tr.reduce((s, r, i) => s + (1 / (1 + Math.exp(-F.k * mm0[i])) - (r.mov > 0 ? 1 : 0)) * mm0[i], 0)) / tr.reduce((s, r, i) => s + Math.abs(mm0[i]), 1);
  check(F.games === tr.length && tr.length > 30 && new Set(XF.map(x => x[F.feats.indexOf('rot')])).size > 10 && normal.every(v => v < 1e-9) && score < 1e-9,
    `the fit on a frozen made-up league (${tr.length} games): the normal equations and the slope's score equation hold (largest ${Math.max(...normal, score).toExponential(1)})`);
  const lf = A.fitLive(miss, DF, 2023);
  check(lf.fitSeasons === `${DF.fitFrom}-2023` && F.feats.every(f => lf.coef[f] === +F.coef[f].toFixed(6)) && lf.k === +F.k.toFixed(6) && same(lf, A.fitLive(miss, DF, 2023)), 'the live fit is that fit on its seasons, and the same twice');
  const r = A.replay(D, LG).rows[50];
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
  const b2 = A.build(ctx, committed.params, committed.walkForward, A.liveProvider());
  check(same(b1, b2), 'the same data, the same model file');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-write-')), f = path.join(dir, 'models', 'alpha.json');
  const first = A.write(f, { ...b1 }, null), stamp = JSON.parse(fs.readFileSync(f, 'utf8')).generated;
  const again = A.write(f, { ...b2 }, JSON.parse(fs.readFileSync(f, 'utf8')));
  check(first && !again && JSON.parse(fs.readFileSync(f, 'utf8')).generated === stamp, 'a second run on the same data writes nothing and keeps the stamp');
  fs.rmSync(dir, { recursive: true, force: true });

  /* a run that refuses keeps the last good calls and says why (a games table with no final; a research file that does
     not read); a model file that does not read is left as it is, for the job to put the last commit's back */
  const rd = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha-run-')), out = path.join(rd, 'models', 'alpha.json');
  for (const d of ['data', 'models', 'research']) fs.mkdirSync(path.join(rd, d));
  const head = 'game_id,season,date,type,away,home,away_score,home_score,neutral,status\n';
  const refusal = (csv, edit) => { fs.writeFileSync(path.join(rd, 'data', 'games.csv'), head + csv); fs.copyFileSync(MODEL, out); if (edit) edit(); const [code, said] = quiet(() => A.run(rd, '', () => null)); return [code, fs.readFileSync(out, 'utf8'), said]; };
  for (const [what, csv, edit, why] of [
    ['a games table with no final', '2027_20261101_BBB_AAA,2027,2026-11-01,REG,BBB,AAA,,,0,scheduled\n', null, /^no finals in data\/games\.csv$/],
    ['a research file that does not read', '2027_20261101_BBB_AAA,2027,2026-11-01,REG,BBB,AAA,100,101,0,final\n', () => fs.writeFileSync(path.join(rd, 'research', 'alpha.json'), '{"design":'), /^research\/alpha\.json does not read/]]) {
    const [code, body, said] = refusal(csv, edit), m = JSON.parse(body);
    check(code === 1 && m.status.ok === false && why.test(m.status.why) && said.some(l => l.startsWith('alpha failed: ') && l.includes(m.status.why)) && shape(m) && same(m.games, committed.games) && same(m.upcoming, committed.upcoming) && same(m.params, committed.params),
      `a run that refuses (${what}): exit 1, the last calls kept, status {ok: false, why: "${m.status.why}"}`);
  }
  fs.writeFileSync(out, '{"id": "alpha",');
  const [badCode, badSaid] = quiet(() => A.run(rd, '', () => null));
  check(badCode === 1 && fs.readFileSync(out, 'utf8') === '{"id": "alpha",' && badSaid.some(l => /^alpha failed: models\/alpha\.json does not read/.test(l)), 'a model file that does not read: exit 1, said, the file left as it is');
  fs.rmSync(rd, { recursive: true, force: true });

  console.log('6. the model file');
  check(shape(committed) && shape({ ...b1, generated: 'x' }), `the contract's shape: its keys in order, {pHome, spread} for every call, every chance inside (0, 1), the status ${JSON.stringify(committed.status)}`);
  const all = L.readGames();
  const want = all.filter(g => +g.season === inPlay && g.type !== 'PRE' && ['final', 'scheduled', 'live'].includes(g.status)).map(g => g.game_id).sort();
  const toCome = all.filter(g => g.type !== 'PRE' && ['scheduled', 'live'].includes(g.status)).map(g => g.game_id).sort();
  check(JSON.stringify(Object.keys(b1.games).sort()) === JSON.stringify(want) && JSON.stringify(Object.keys(b1.upcoming).sort()) === JSON.stringify(toCome), `every regular-season and playoff game of ${inPlay - 1}-${String(inPlay).slice(2)} called (${want.length}), the ${toCome.length} to come apart, no preseason game`);
  check(['2024', '2025', '2026'].every(s => committed.walkForward[s] && committed.walkForward[s].games > 1000 && committed.walkForward[s].logloss > 0.5), 'the walk-forward: 2024, 2025 and 2026');
  const res = JSON.parse(fs.readFileSync(RESEARCH, 'utf8'));
  check(res.folds.every(f => +f.fit.split('-')[1] < f.season && JSON.stringify(committed.walkForward[f.season]) === JSON.stringify({ games: f.alpha.games, logloss: f.alpha.logloss, acc: f.alpha.acc, mae: f.alpha.mae })),
    'each fold fitted on the seasons before it alone, and the model file\'s walk-forward research/alpha.json\'s');
  check(JSON.stringify(res.design) === JSON.stringify(D) && res.trials.every(t => !('2026' in t) && !('2027' in t)), 'the design research/alpha.json chose, and no trial read 2026 or the season in play');
  const [from, to] = committed.fitSeasons.split('-').map(Number);
  check(committed.fitSeasons === M.fitSeasons && from === D.fitFrom && to < inPlay && same(M.feats, Object.keys(M.coef)) && M.feats.every(f => Number.isFinite(M.coef[f])) && M.k > 0,
    `the fitted numbers' seasons (${committed.fitSeasons}) are before the season in play (${label}), never it`);
  /* the fit on today's data: ESPN back-fills an old final's box score now and then, which moves a refit a little; a
     note, never a failure (the fit itself is held on frozen data in 4) */
  const refit = A.fitLive(ctx, D, to), moved = Math.max(...M.feats.map(f => Math.abs(refit.coef[f] - M.coef[f]) / Math.abs(M.coef[f])));
  console.log(`  note a refit of ${committed.fitSeasons} on today's data: ${refit.fit.games} games (the file's ${M.fit.games}), the largest coefficient ${moved ? `moved ${(100 * moved).toFixed(4)}%` : 'unmoved'}, k ${refit.k} (the file's ${M.k})`);
  const boxed = Object.fromEntries(A.FOLDS.map(S => [S, full.filter(r => r.final && r.box && r.season === S).length]));
  console.log(`  note the walk-forward's games ${A.FOLDS.map(S => `${S} ${committed.walkForward[S].games}`).join(', ')}; today's regular-season and playoff finals with both box scores ${A.FOLDS.map(S => `${S} ${boxed[S]}`).join(', ')}`);
}

console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
