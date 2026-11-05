/* The job's numbers behind a game's three windows in the Player props view (README "The game's three windows"), on
 * made-up data, each expected figure worked out by hand in the comments beside it:
 *
 *   node tools/test_gamewin.js
 *
 * 1. publish.js teamStatsState (THE TEAM STATS) on a made-up season's team boxes, scores and box minutes: the games it
 *    counts (regular-season finals and the NBA Cup final; never a preseason, play-in or playoff game, a final missing a
 *    side's team box or a figure in it, a game still to play or another season's), every stat and its rank (fewer is
 *    better where it is, ties by club code), an overtime's minutes from the box and 48 where the box has none.
 * 2. props.js oppTable: each club's defence as the projections take it, from oppFactor: the ratio, the multiplier
 *    ratio^opp[k] and the rank (1 allows the least, ties by club code), and no multiplier with no exponent fitted.
 * 3. props.js liveProjections on a made-up replay: each game's opp is oppTable's for the game's season (a new season's
 *    allowed halved, as the projections take it), the club defending under its own code, and its multiplier is the one
 *    the projections used: a player's mean with the matchup is his mean without it times the opponent's multiplier.
 * 4. publish.js propsState carries opp to the page compactly ([ratio, mult, rank], oppCols), and nothing on a props.json
 *    written before it.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const PUB = require('./publish');
const PJ = require('./props');
let fails = 0; const ok = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-gamewin-'));
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);
/* a part that throws is a failure, said, and the next part still runs */
const part = (name, fn) => { console.log(name); try { fn(); } catch (e) { ok(false, `${name.replace(/^\d+\. /, '')} threw: ${e && e.stack ? e.stack.split('\n').slice(0, 2).join(' ') : e}`); } };

part('1. the team stats (publish.js teamStatsState)', () => {
  const S = 2031;
  const G = (id, date, type, away, home, as, hs, o = {}) => ({ game_id: `${S}_${date.replace(/-/g, '')}_${away}_${home}_${id}`, season: String(o.season || S), date, type, away, home,
    away_score: as === null ? '' : String(as), home_score: hs === null ? '' : String(hs), neutral: o.neutral ? '1' : '0', status: o.status || 'final', tip: date + 'T23:00Z' });
  /* the four finals counted */
  const g1 = G('g1', '2030-10-21', 'REG', 'BOS', 'NYK', 110, 100);                 // BOS 110 at NYK 100, box 240 a side
  const g2 = G('g2', '2030-10-23', 'REG', 'MIA', 'BOS', 120, 118);                 // MIA 120 at BOS 118, one overtime (box 265 a side)
  const g3 = G('g3', '2030-10-25', 'REG', 'NYK', 'MIA', 99, 105);                  // NYK 99 at MIA 105, no box: 48 minutes
  const cupF = G('cf', '2030-12-16', 'REG', 'BOS', 'NYK', 115, 108, { neutral: 1 }); // the NBA Cup final: counted
  /* the Cup's semifinals (no team box, so not counted; they make the final the Cup's), and what is never counted */
  const semi1 = G('s1', '2030-12-13', 'REG', 'BOS', 'PHX', 101, 99, { neutral: 1 }), semi2 = G('s2', '2030-12-13', 'REG', 'MIA', 'NYK', 98, 104, { neutral: 1 });
  const pre = G('pre', '2030-10-10', 'PRE', 'LAL', 'NYK', 90, 140);                 // preseason, team boxes in
  const noSide = G('ns', '2030-10-27', 'REG', 'LAL', 'BOS', 90, 140);              // LAL's team box missing
  const noAst = G('na', '2030-10-28', 'REG', 'BOS', 'MIA', 80, 150);               // MIA's team box has no assists
  const post = G('po', '2031-04-25', 'POST', 'NYK', 'BOS', 90, 140);               // a playoff game, team boxes in
  const sched = G('sc', '2031-04-30', 'REG', 'NYK', 'MIA', null, null, { status: 'scheduled' });
  const other = G('ot', '2030-04-01', 'REG', 'BOS', 'NYK', 90, 140, { season: S - 1 });   // last season's, its rows in this file
  /* the play-in: LAL's 83rd final, past its 82 (the 82 against PHX have no team box) */
  const lalPhx = Array.from({ length: 82 }, (_, i) => G('lp' + i, `2031-0${1 + Math.floor(i / 28)}-${String(1 + (i % 28)).padStart(2, '0')}`, 'REG', 'LAL', 'PHX', 100, 101));
  const playin = G('pi', '2031-04-15', 'REG', 'LAL', 'MIA', 90, 140);
  const games = [g1, g2, g3, cupF, semi1, semi2, pre, noSide, noAst, post, sched, other, ...lalPhx, playin];
  const off = PUB.offFinals(games, S);
  ok(off[cupF.game_id] === 'cup' && off[playin.game_id] === 'playin', 'the made-up season has its NBA Cup final and a play-in game, as offFinals marks them');
  /* team boxes: [fgm, fga, 3pm, 3pa, ftm, fta, orb, tov, reb, ast, stl, blk] */
  const box = a => ({ 'fieldGoalsMade-fieldGoalsAttempted': `${a[0]}-${a[1]}`, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted': `${a[2]}-${a[3]}`, 'freeThrowsMade-freeThrowsAttempted': `${a[4]}-${a[5]}`,
    offensiveRebounds: String(a[6]), totalTurnovers: String(a[7]), turnovers: String(a[7] - 1), totalRebounds: String(a[8]), assists: String(a[9]), steals: String(a[10]), blocks: String(a[11]) });
  const B = {
    [g1.game_id]: { BOS: [40, 85, 12, 30, 18, 22, 10, 12, 45, 25, 8, 5], NYK: [38, 88, 10, 32, 14, 20, 12, 14, 44, 22, 7, 4] },
    [g2.game_id]: { MIA: [44, 95, 14, 35, 18, 24, 11, 13, 50, 28, 9, 6], BOS: [43, 97, 13, 38, 19, 25, 13, 15, 49, 26, 7, 3] },
    [g3.game_id]: { NYK: [36, 84, 9, 29, 18, 22, 9, 16, 40, 20, 10, 6], MIA: [39, 86, 12, 33, 15, 20, 10, 11, 46, 24, 9, 5] },
    [cupF.game_id]: { BOS: [42, 90, 15, 36, 16, 20, 12, 10, 48, 27, 6, 7], NYK: [40, 89, 11, 31, 17, 23, 10, 13, 42, 23, 8, 4] } };
  const big = [60, 90, 30, 40, 40, 40, 30, 1, 80, 60, 30, 30];                       // a line that would move every number were it counted
  for (const g of [pre, post, other, playin]) B[g.game_id] = { [g.away]: big, [g.home]: big };
  B[noSide.game_id] = { BOS: big };
  B[noAst.game_id] = { BOS: big, MIA: big };
  const lines = [];
  for (const [gid, sides] of Object.entries(B)) for (const [t, a] of Object.entries(sides)) { const st = box(a); if (gid === noAst.game_id && t === 'MIA') delete st.assists; lines.push(JSON.stringify({ game_id: gid, team: t, stats: st })); }
  lines.splice(2, 0, 'not json', '');                                                 // a broken line and a blank one are passed over
  fs.writeFileSync(path.join(TMP, `teambox_${S}.jsonl`), lines.join('\n') + '\n');
  /* box minutes: five players a side, 48 each in g1 and the Cup final (240), 53 in g2 (265, one overtime); none for g3 */
  const head = 'game_id,date,team,opp,home,player_id,name,pos,starter,min,fgm,fga,tpm,tpa,ftm,fta,orb,drb,ast,stl,blk,tov,pf,pm,pts,dnp';
  const brows = [];
  for (const [g, m] of [[g1, 48], [g2, 53], [cupF, 48]]) for (const t of [g.away, g.home]) for (let i = 0; i < 5; i++) brows.push(`${g.game_id},${g.date},${t},x,0,${t}${i},P,G,1,${m},0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0`);
  fs.writeFileSync(path.join(TMP, `box_${S}.csv`), head + '\n' + brows.join('\n') + '\n');
  const T = PUB.teamStatsState(games, S, TMP);
  /* possessions, FGA - ORB + TOV + 0.44 FTA, each side's averaged with its opponent's:
       g1   BOS 85-10+12+9.68 = 96.68   NYK 88-12+14+8.80 = 98.80    -> 97.74,  48 min
       g2   MIA 95-11+13+10.56 = 107.56 BOS 97-13+15+11.00 = 110.00  -> 108.78, 53 min
       g3   NYK 84-9+16+9.68 = 100.68   MIA 86-10+11+8.80 = 95.80    -> 98.24,  48 min (no box)
       cup  BOS 90-12+10+8.80 = 96.80   NYK 89-10+13+10.12 = 102.12  -> 99.46,  48 min
     BOS  g1, g2, cup: 343 for, 328 against, 305.98 possessions, 149 minutes
       pd 15/3 = 5.0  ppg 114.333 -> 114.3  pa 109.333 -> 109.3  ortg 112.099 -> 112.1  drtg 107.196 -> 107.2  pace 98.571 -> 98.6
       fg 125/272 = 45.956 -> 46.0  tp 40/104 = 38.462 -> 38.5  tpm 13.333 -> 13.3  reb 142/3 = 47.3  ast 78/3 = 26.0  tov 37/3 = 12.3
       stl 21/3 = 7.0  blk 15/3 = 5.0
     NYK  g1, g3, cup: 307 for, 330 against, 295.44 possessions, 144 minutes
       pd -23/3 = -7.667 -> -7.7  ppg 102.3  pa 110.0  ortg 103.913 -> 103.9  drtg 111.698 -> 111.7  pace 98.48 -> 98.5
       fg 114/261 = 43.678 -> 43.7  tp 30/92 = 32.609 -> 32.6  tpm 10.0  reb 42.0  ast 65/3 = 21.7  tov 43/3 = 14.3  stl 25/3 = 8.3  blk 14/3 = 4.7
     MIA  g2, g3: 225 for, 217 against, 207.02 possessions, 101 minutes
       pd 4.0  ppg 112.5  pa 108.5  ortg 108.685 -> 108.7  drtg 104.821 -> 104.8  pace 98.386 -> 98.4
       fg 83/181 = 45.856 -> 45.9  tp 26/68 = 38.235 -> 38.2  tpm 13.0  reb 48.0  ast 26.0  tov 12.0  stl 9.0  blk 5.5
     ranks, 1 the best: ast BOS 26.0 and MIA 26.0 level, BOS first by code; pa, drtg and tov the fewest first; pace the fastest */
  const want = {
    BOS: { g: 3, last: '2030-12-16', pd: [5, 1], ppg: [114.3, 1], pa: [109.3, 2], ortg: [112.1, 1], drtg: [107.2, 2], pace: [98.6, 1], fg: [46, 1], tp: [38.5, 1], tpm: [13.3, 1], reb: [47.3, 2], ast: [26, 1], tov: [12.3, 2], stl: [7, 3], blk: [5, 2] },
    MIA: { g: 2, last: '2030-10-25', pd: [4, 2], ppg: [112.5, 2], pa: [108.5, 1], ortg: [108.7, 2], drtg: [104.8, 1], pace: [98.4, 3], fg: [45.9, 2], tp: [38.2, 2], tpm: [13, 2], reb: [48, 1], ast: [26, 2], tov: [12, 1], stl: [9, 1], blk: [5.5, 1] },
    NYK: { g: 3, last: '2030-12-16', pd: [-7.7, 3], ppg: [102.3, 3], pa: [110, 3], ortg: [103.9, 3], drtg: [111.7, 3], pace: [98.5, 2], fg: [43.7, 3], tp: [32.6, 3], tpm: [10, 3], reb: [42, 3], ast: [21.7, 3], tov: [14.3, 3], stl: [8.3, 2], blk: [4.7, 3] } };
  ok(T.v === 1 && T.season === S && T.games === 4 && T.through === '2030-12-16', `four finals counted (the Cup final among them), through its date (${T.games}, ${T.through})`);
  ok(eq(Object.keys(T.clubs), ['BOS', 'MIA', 'NYK']), `only the clubs with a game counted, LAL none (${Object.keys(T.clubs).join(', ')})`);
  for (const t of ['BOS', 'MIA', 'NYK']) { const bad = Object.keys(want[t]).filter(k => !eq(T.clubs[t][k], want[t][k]));
    ok(!bad.length && eq(Object.keys(T.clubs[t]), Object.keys(want[t])), `${t}: every stat and its rank as worked by hand${bad.length ? ': ' + bad.map(k => `${k} ${JSON.stringify(T.clubs[t][k])} not ${JSON.stringify(want[t][k])}`).join(', ') : ''}`); }
  ok(eq(PUB.TS_STATS.map(x => x[0]), ['pd', 'ppg', 'pa', 'ortg', 'drtg', 'pace', 'fg', 'tp', 'tpm', 'reb', 'ast', 'tov', 'stl', 'blk']) && PUB.TS_STATS.filter(x => x[1] < 0).map(x => x[0]).join() === 'pa,drtg,tov' && PUB.TS_STATS.find(x => x[0] === 'pace')[1] === 0,
    'the fourteen stats, fewer better on points allowed, defensive rating and turnovers, pace neither');
  /* a season with no team box file, and one with no final yet */
  const E = PUB.teamStatsState(games, S + 1, TMP);
  ok(E.games === 0 && E.through === null && eq(E.clubs, {}), 'a season with nothing counted yet lists no club');
  /* a lone overtime read from the box: two overtimes (290 a side) are 58 minutes */
  const two = G('2o', '2030-11-01', 'REG', 'LAL', 'PHX', 130, 128), D2 = path.join(TMP, 'two'); fs.mkdirSync(D2);
  fs.writeFileSync(path.join(D2, `teambox_${S}.jsonl`), [JSON.stringify({ game_id: two.game_id, team: 'LAL', stats: box([50, 100, 10, 30, 20, 25, 10, 10, 50, 30, 5, 5]) }), JSON.stringify({ game_id: two.game_id, team: 'PHX', stats: box([50, 100, 10, 30, 20, 25, 10, 10, 50, 30, 5, 5]) })].join('\n'));
  fs.writeFileSync(path.join(D2, `box_${S}.csv`), head + '\n' + ['LAL', 'PHX'].flatMap(t => Array.from({ length: 5 }, (_, i) => `${two.game_id},${two.date},${t},x,0,${t}${i},P,G,1,58,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0`)).join('\n') + '\n');
  const T2 = PUB.teamStatsState([two], S, D2);
  /* 100 - 10 + 10 + 11 = 111 possessions a side; 48 x 111 / 58 = 91.862 -> 91.9; level pace, LAL first by code */
  ok(eq(T2.clubs.LAL.pace, [91.9, 1]) && eq(T2.clubs.PHX.pace, [91.9, 2]) && eq(T2.clubs.LAL.ortg, [117.1, 1]), `two overtimes read as 58 minutes (pace 91.9), a level pace ranked by club code (${JSON.stringify(T2.clubs.LAL.pace)} ${JSON.stringify(T2.clubs.PHX.pace)})`);
});

part('2. each club\'s defence (props.js oppTable)', () => {
  const teams = ['BOS', 'LAL', 'MIA', 'NYK'];
  /* the league: per minute pts 0.2, reb 0.09, ast 0.05, tpm 0.025, stl 0.016, blk 0.01 */
  const lg = { m: 10000, y: { pts: 2000, reb: 900, ast: 500, tpm: 250, stl: 160, blk: 100 } };
  const allowed = { BOS: { m: 2400, y: { pts: 528, reb: 216, ast: 132, tpm: 60, stl: 38.4, blk: 24 } }, MIA: { m: 1200, y: { pts: 216, reb: 129.6, ast: 54, tpm: 36, stl: 19.2, blk: 9.6 } } };
  const exps = { pts: 1, reb: 0.75, ast: 1, tpm: 0.75, stl: 1, blk: 1 };
  const D = PJ.oppTable(t => allowed[t], lg, exps, teams);
  /* ratio = ((allowed + 2,400 x league rate) / (minutes + 2,400)) / league rate:
       BOS pts (528 + 480) / 4,800 = 0.21 -> 1.05      reb (216 + 216) / 4,800 = 0.09 -> 1.0     ast (132 + 120) / 4,800 -> 1.05
           tpm, stl, blk -> 1.0
       MIA pts (216 + 480) / 3,600 = 0.19333 -> 0.9667  reb (129.6 + 216) / 3,600 = 0.096 -> 1.0667   ast 0.04833 -> 0.9667
           tpm (36 + 60) / 3,600 -> 1.0667  stl 1.0  blk (9.6 + 24) / 3,600 = 0.009333 -> 0.9333
       LAL, NYK nothing on record -> 1.0 everywhere
     multiplier ratio^opp[k]: MIA reb and tpm 1.066667^0.75 = 1.049595 -> 1.0496; the rest the ratio (exponent 1) or 1
     ranks, the least allowed first, ties by club code */
  const want = {
    BOS: { pts: [1.05, 1.05, 4], reb: [1, 1, 1], ast: [1.05, 1.05, 4], tpm: [1, 1, 1], stl: [1, 1, 1], blk: [1, 1, 2] },
    LAL: { pts: [1, 1, 2], reb: [1, 1, 2], ast: [1, 1, 2], tpm: [1, 1, 2], stl: [1, 1, 2], blk: [1, 1, 3] },
    MIA: { pts: [0.9667, 0.9667, 1], reb: [1.0667, 1.0496, 4], ast: [0.9667, 0.9667, 1], tpm: [1.0667, 1.0496, 4], stl: [1, 1, 3], blk: [0.9333, 0.9333, 1] },
    NYK: { pts: [1, 1, 3], reb: [1, 1, 3], ast: [1, 1, 3], tpm: [1, 1, 3], stl: [1, 1, 4], blk: [1, 1, 4] } };
  for (const t of teams) { const got = Object.fromEntries(PJ.STATS.map(k => [k, [D[t][k].ratio, D[t][k].mult, D[t][k].rank]]));
    ok(eq(got, want[t]), `${t}: ratio, multiplier and rank on every stat as worked by hand${eq(got, want[t]) ? '' : ': ' + JSON.stringify(got)}`); }
  const ratioOf = (t, k) => { const a = allowed[t], lr = lg.y[k] / lg.m; return a ? ((a.y[k] + PJ.OPP_SHRINK * lr) / (a.m + PJ.OPP_SHRINK)) / lr : 1; };
  ok(teams.every(t => PJ.STATS.every(k => Math.abs(D[t][k].ratio - ratioOf(t, k)) < 5e-5 && Math.abs(PJ.oppFactor(allowed[t], lg)[k] - ratioOf(t, k)) < 1e-12)), 'the ratio is oppFactor\'s, the shrink 2,400 minutes');
  const N = PJ.oppTable(t => allowed[t], lg, null, teams);
  ok(teams.every(t => PJ.STATS.every(k => N[t][k].mult === 1 && N[t][k].ratio === D[t][k].ratio && N[t][k].rank === D[t][k].rank)), 'with no exponent fitted every multiplier is 1, as means() then takes no opponent term');
  const all = PJ.oppTable(() => undefined, lg, exps);
  ok(Object.keys(all).length === 30 && PJ.STATS.every(k => Object.values(all).map(x => x[k].rank).sort((a, b) => a - b).join() === Array.from({ length: 30 }, (_, i) => i + 1).join()), 'the league\'s 30 clubs by default, each stat ranked 1 to 30 once');
});

part('3. the projections\' own multiplier (props.js liveProjections)', () => {
  const P = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'props.json'), 'utf8')).params;
  /* a made-up season: four clubs, eight players each, ten finals, then a game to come this season and one the next */
  const S = 2031, clubs = ['BOS', 'LAL', 'MIA', 'NYK'], pos = ['G', 'G', 'F', 'F', 'C', 'G', 'F', 'C'];
  const games = [], boxes = {};
  let day = 0;
  const date = n => { const d = new Date(Date.UTC(2030, 9, 21 + n)); return d.toISOString().slice(0, 10); };
  const pairs = [['BOS', 'NYK'], ['LAL', 'MIA'], ['MIA', 'BOS'], ['NYK', 'LAL'], ['BOS', 'LAL'], ['MIA', 'NYK'], ['LAL', 'BOS'], ['NYK', 'MIA'], ['BOS', 'MIA'], ['LAL', 'NYK']];
  const strong = { BOS: 1.25, LAL: 0.8, MIA: 1, NYK: 1.1 };          // how much a club's opponents score: BOS's defence the leakiest
  for (const [a, h] of pairs) { const d = date(day++), gid = `${S}_${d.replace(/-/g, '')}_${a}_${h}`;
    games.push({ game_id: gid, season: S, date: d, type: 'REG', away: a, home: h, status: 'final', neutral: 0, tip: d + 'T23:00Z' });
    boxes[gid] = {};
    for (const t of [a, h]) { const o = t === a ? h : a; boxes[gid][t] = pos.map((p, i) => { const min = [36, 34, 32, 30, 28, 24, 20, 16][i], f = strong[o] * (1 + i % 3 / 10);
      return { id: `${t}${i}`, name: `${t} Player ${i}`, pos: p, team: t, min, dnp: false, fga: Math.round(min / 2.5), fta: Math.round(min / 8), orb: i % 3, tov: 1 + i % 2,
        y: { pts: Math.round(min * 0.5 * f), reb: Math.round(min * (p === 'C' ? 0.3 : 0.15) * f), ast: Math.round(min * (p === 'G' ? 0.2 : 0.07) * f), tpm: Math.round(min * 0.06 * f), stl: Math.round(min * 0.03 * f), blk: Math.round(min * 0.02 * f) } }; }); } }
  const next = date(day + 1), after = date(day + 2);
  const g1 = { game_id: `${S}_${next.replace(/-/g, '')}_NYK_BOS`, season: S, date: next, type: 'REG', away: 'NYK', home: 'BOS', status: 'scheduled', neutral: 0, tip: next + 'T23:00Z' };
  const g2 = { game_id: `${S + 1}_${after.replace(/-/g, '')}_LAL_MIA`, season: S + 1, date: after, type: 'REG', away: 'LAL', home: 'MIA', status: 'scheduled', neutral: 0, tip: after + 'T23:00Z' };
  const all = games.concat([g1, g2]), now = new Date(date(day) + 'T15:00:00Z'), dir = path.join(TMP, 'live'); fs.mkdirSync(dir);
  const R = PJ.replay(games, boxes, {}, {});
  const live = PJ.liveProjections(R, P, all, now, dir), bare = PJ.liveProjections(R, { ...P, opp: undefined }, all, now, dir);
  ok(live[g1.game_id] && live[g2.game_id], 'both games projected');
  /* the game's season's allowed, as the projections read it: this season's as kept, a new season's at half */
  const allowedFor = g => t => { const a = R.allowed[t]; if (!a || a.season === g.season) return a; return { m: a.m * 0.5, y: Object.fromEntries(PJ.STATS.map(k => [k, a.y[k] * 0.5])) }; };
  for (const g of [g1, g2]) { const D = PJ.oppTable(allowedFor(g), R.lgAll, P.opp), L1 = live[g.game_id];
    ok(eq(Object.keys(L1.opp), [g.away, g.home]) && eq(L1.opp[g.away], D[g.away]) && eq(L1.opp[g.home], D[g.home]), `${g.game_id}: opp is oppTable's for the game's season, each club its own defence`);
    /* the multiplier the projection used: with the matchup = without it x the opponent's multiplier (both published to
       two decimals, the multiplier to four) */
    let n = 0, worst = 0;
    for (const t of [g.away, g.home]) { const opp = t === g.away ? g.home : g.away;
      for (const p of L1.players[t]) { const b = bare[g.game_id].players[t].find(x => x.id === p.id);
        for (const k of PJ.STATS) { const d = Math.abs(p.mu[k] - b.mu[k] * L1.opp[opp][k].mult); worst = Math.max(worst, d); n++; } } }
    ok(n > 40 && worst <= 0.012, `${g.game_id}: each of ${n} projected stats is his mean without the matchup times the opponent's multiplier (largest gap ${worst.toFixed(4)}, rounding)`); }
  const halved = PJ.oppTable(allowedFor(g2), R.lgAll, P.opp), kept = PJ.oppTable(t => R.allowed[t], R.lgAll, P.opp);
  ok(clubs.some(t => kept[t].pts.ratio !== halved[t].pts.ratio) && eq(live[g2.game_id].opp.LAL, halved.LAL), 'a new season\'s game takes what each club allowed at half, as its projections do');
  /* the clubs the replay never saw sit at 1, so BOS, whose opponents scored the most, is the league's 30th on points */
  ok(live[g1.game_id].opp.BOS.pts.ratio > 1 && live[g1.game_id].opp.BOS.pts.rank === 30 && live[g1.game_id].opp.NYK.pts.rank < 30, `BOS, whose opponents scored the most, allows the most points a minute: 30th of the league's 30 (${JSON.stringify(live[g1.game_id].opp.BOS.pts)})`);
  /* and the check above can tell: the other club's multiplier misses by far more than rounding */
  { const g = g1, L1 = live[g.game_id]; let worst = 0;
    for (const p of L1.players[g.away]) { const b = bare[g.game_id].players[g.away].find(x => x.id === p.id); worst = Math.max(worst, Math.abs(p.mu.pts - b.mu.pts * L1.opp[g.away].pts.mult)); }
    ok(worst > 0.05, `the wrong club's multiplier (NYK's own on NYK's players) misses by ${worst.toFixed(3)}, so the check above tells them apart`); }
});

part('4. what state.json carries (publish.js propsState)', () => {
  const tip = new Date(Date.now() + 864e5).toISOString().slice(0, 16) + 'Z', gid = '2031_20301021_BOS_NYK';
  const mk = withOpp => ({ generated: 'x', asOf: '2030-10-20', fitSeasons: '2023-2026', params: { var: {} }, distribution: 'nb', fair: {}, research: null,
    upcoming: { [gid]: { tip, away: 'BOS', home: 'NYK', players: { BOS: [{ id: '1', name: 'A', pos: 'G', min: 30, mu: { pts: 20, reb: 4, ast: 5, tpm: 2, stl: 1, blk: 0.5 }, dd: 0.1, td: 0 }], NYK: [] },
      ...(withOpp ? { opp: { BOS: Object.fromEntries(PJ.STATS.map((k, i) => [k, { ratio: 1 + i / 100, mult: 1 + i / 200, rank: i + 1 }])), NYK: Object.fromEntries(PJ.STATS.map(k => [k, { ratio: 0.98, mult: 0.99, rank: 30 }])) } } : {}) } } });
  const slate = [{ id: gid, status: 'scheduled', tip }], nowIso = new Date().toISOString().slice(0, 16) + 'Z';
  const ps = PUB.propsState(slate, nowIso, mk(true)), pg = ps.games[gid];
  ok(eq(ps.oppCols, ['ratio', 'mult', 'rank']) && eq(pg.opp.BOS.reb, [1.01, 1.005, 2]) && eq(pg.opp.NYK.blk, [0.98, 0.99, 30]) && eq(Object.keys(pg.opp.BOS), PJ.STATS),
    'each club\'s defence on each base stat as [ratio, multiplier, rank], oppCols naming them');
  ok(!('opp' in PUB.propsState(slate, nowIso, mk(false)).games[gid]), 'a props.json written before the table carries none: the page says it is not published yet');
});

fs.rmSync(TMP, { recursive: true, force: true });
console.log(fails ? `${fails} FAILED` : 'all good');
process.exit(fails ? 1 : 0);
