/* Tests for the ELO Model (tools/elo_model.js, models/elo.json, research/elo.json). No network; nothing written in the
 * repo (a scratch folder under the system's temp for the files a test writes); about ten seconds.
 *
 *   node tools/test_elo_model.js       must end "all good"
 *
 * 1. no leakage: on the real data, the day's games read as games to come (the day and everything after it not yet
 *    played) and read again once final give the same inputs, and the same call, to the last digit: the previous game's
 *    rotation, the injury log's and the back to backs; and no row of a season is moved by a later season's games
 * 2. the ratings by hand, on a made-up league: every morning of a season rebuilt as it stood, the first final's update,
 *    a row that did not play, the left-early skip once and the second short game rated, the offseason carry, a club's
 *    first game of a season, a neutral site, a postponed game, a club with no box score, the strength's slots and ties,
 *    the positions
 * 3. tonight's rotation on made-up reports, through the hub's own makeLiveLineup: Out, Day-To-Day returning after the
 *    game and on it, Out on the report's own day, suspended, a debutant at twelve minutes, a player traded
 * 4. the fit: planted weights recovered; equal clubs at a neutral site an even chance, the home court leaning home; the
 *    call is the formula, its pick and its spread on the same side
 * 5. determinism and a quiet day: the same data gives the same file, a box file's row order changes nothing, and a
 *    second write writes nothing
 * 6. the committed files: the contract's shape, every game of the season in play called, the fitted numbers the fit
 *    of the finished seasons, the walk-forward research/elo.json's, no fold fitted on its own season
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os');
const E = require('./elo_model');
const L = require('./lib');

let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const near = (a, b, e = 1e-9) => Math.abs(a - b) <= e;
const MODEL = path.join(L.ROOT, 'models', 'elo.json'), RESEARCH = path.join(L.ROOT, 'research', 'elo.json');
const committed = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
const D = committed.params.design, M = committed.params;
const inputs = r => JSON.stringify([r.x.pretip, r.x.log, r.b2b]);
/* the data as it stood the morning of `cut`: that day's games and every later one unplayed, their box scores not in */
const morning = (c, cut) => {
  const b = { ...c, boxes: { ...c.boxes }, games: c.games.map(g => g.date >= cut ? { ...g, final: false, status: 'scheduled', hs: null, as: null } : g) };
  for (const g of c.games) if (g.date >= cut) delete b.boxes[g.id];
  return b;
};

console.log('1. no leakage: a game read before its tip-off and once final');
const ctx = E.load();
{
  const full = E.replay(D, ctx).rows, byId = Object.fromEntries(full.map(r => [r.id, r]));
  const { inPlay } = E.seasons(ctx);
  const lastDay = ctx.games.filter(g => g.final && g.season === inPlay).map(g => g.date).sort().pop();
  for (const cut of [lastDay, '2026-01-15']) {
    const rows = E.replay(D, morning(ctx, cut)).rows.filter(r => r.date === cut);
    const same = rows.filter(r => inputs(r) === inputs(byId[r.id]));
    check(rows.length > 0 && same.length === rows.length, `${cut}: all ${rows.length} games' inputs the same before and after (${rows.length - same.length} differ)`);
    if (cut === lastDay) {
      const calls = rows.filter(r => JSON.stringify(E.callOf(r, M, D)) === JSON.stringify(E.callOf(byId[r.id], M, D)));
      check(calls.length === rows.length && rows.every(r => E.modeOf(byId[r.id]) === 'log' && r.x.log), `${cut}: the call once final is the one made before tip-off on that day's injury log`);
    }
  }
  const cut = '2025-10-01', early = E.replay(D, { ...ctx, games: ctx.games.filter(g => g.date < cut) }).rows;
  const diff = early.filter(r => JSON.stringify(r.x) !== JSON.stringify(byId[r.id].x) || r.b2b !== byId[r.id].b2b);
  check(early.length > 5000 && diff.length === 0, `every row through 2024-25 (${early.length}) the same with and without the seasons after it, who played among them`);
}

console.log('2. the ratings by hand, on a made-up league');
/* four clubs, two seasons of twenty days, two games a day, each club's ten players at fixed minutes, plus-minus and Game
   Score from a fixed seed, and an injury log through the second season with one player of each club Out each day */
const POS = ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'C', 'G', 'F'], MIN = [36, 34, 32, 30, 28, 24, 20, 16, 12, 8];
function league(edit) {
  const T = ['AAA', 'BBB', 'CCC', 'DDD'];
  let seed = 7; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const games = [], boxes = {}, injLog = {};
  const pairs = [[[0, 1], [2, 3]], [[0, 2], [1, 3]], [[0, 3], [1, 2]], [[1, 0], [3, 2]], [[2, 0], [3, 1]], [[3, 0], [2, 1]]];
  for (const season of [2022, 2023]) for (let d = 0; d < 20; d++) {
    const day = L.addDays(`${season - 1}-11-01`, d * 2);
    for (const [j, [h, a]] of pairs[d % 6].entries()) {
      /* the second game of every fourth day is played the day after, so some clubs play back to backs */
      const date = j && d % 4 === 1 ? L.addDays(day, 1) : day;
      const home = T[h], away = T[a], hs = 100 + Math.floor(rnd() * 25), as = 98 + Math.floor(rnd() * 25);
      const id = `${season}_${date.replace(/-/g, '')}_${away}_${home}`;
      games.push({ id, season, date, type: 'REG', home, away, neutral: false, final: true, status: 'final', hs, as, tip: date + 'T23:00Z' });
      boxes[id] = {};
      /* one of each side's bench (players 5 to 9) sits each game, so the rotation a game is read on is not always
         the one that plays it */
      for (const [t, s] of [[home, hs - as], [away, as - hs]]) {
        const sits = 5 + Math.floor(rnd() * 5);
        boxes[id][t] = MIN.map((m, i) => i === sits ? { id: t + i, name: t + i, pos: POS[i], min: 0, dnp: 1, gs: 0, pm: 0 }
          : { id: t + i, name: t + i, pos: POS[i], min: m, dnp: 0, gs: m * (0.3 - i * 0.02) + rnd() * 4, pm: Math.round(s * m / 240 + (rnd() - 0.5) * 6 + (4 - i)) });
      }
    }
    if (season === 2023) for (const t of T) for (const dd of [0, 1]) { const date = L.addDays(day, dd); ((injLog[date] = injLog[date] || {})[t] = [{ id: t + (d % 10), status: 'Out' }, { id: t + ((d + 3) % 10), status: 'Day-To-Day' }]); }
  }
  const order = c => c.games.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
  const c = { games, boxes, injLog, logDates: [] };
  order(c); if (edit) { edit(c); order(c); }
  c.logDates = Object.keys(c.injLog).sort();
  return c;
}
const LG = league();
const R = E.replay(D, LG);
{
  /* every morning of the second season, as it stood, against the season played through */
  const byId = Object.fromEntries(R.rows.map(r => [r.id, r]));
  const days = [...new Set(LG.games.filter(g => g.season === 2023).map(g => g.date))];
  const bad = days.filter(cut => E.replay(D, morning(LG, cut)).rows.filter(r => r.date === cut).some(r => inputs(r) !== inputs(byId[r.id])));
  check(days.length > 20 && bad.length === 0 && R.rows.filter(r => r.season === 2023).every(r => r.x.log), `every one of ${days.length} mornings of a made-up season: the day's inputs, the injury log's rotation among them, as they are once final`);

  /* the first final by hand: everyone at 1500 against units at 1500, the typical game the first day's default */
  const first = LG.games[0], one = E.replay(D, { ...LG, games: [first] });
  const [mu, sd] = { gs: [9, 7], pm: [0, 10], mix: [9, 13] }[D.score];
  const r0 = LG.boxes[first.id][first.home][0], v = D.score === 'gs' ? r0.gs : D.score === 'pm' ? r0.pm : r0.gs + r0.pm;
  const S = 1 / (1 + Math.exp(-1.5 * Math.max(-3, Math.min(3, (v - mu) / sd)))), w = Math.min(1, r0.min / D.volume);
  const start = first.season > E.FIRST ? D.newR : 1500;
  check(near(one.players[r0.id].R, start + D.k[0] * w * (S - 0.5), 1e-9) && one.players[r0.id].n === 1, `the first final by hand: ${r0.id} ${v.toFixed(1)} against a typical ${mu}, ${(start + D.k[0] * w * (S - 0.5)).toFixed(3)}`);
  const unit = Object.keys(one.units).find(k => k.startsWith(first.away + '|'));
  const ds = LG.boxes[first.id][first.home].filter(r => r.min > 0 && (D.groups === 'one' ? 'R' : E.groupOf(r.pos)) === unit.split('|')[1]).map(r => {
    const x = D.score === 'gs' ? r.gs : D.score === 'pm' ? r.pm : r.gs + r.pm, s = 1 / (1 + Math.exp(-1.5 * Math.max(-3, Math.min(3, (x - mu) / sd))));
    return Math.min(1, r.min / D.volume) * (s - 0.5); });
  check(near(one.units[unit], 1500 - D.kUnit * ds.reduce((a, b) => a + b, 0) / ds.length, 1e-9), `the opposing unit by hand: ${unit} moved by ${D.kUnit} times the mean surprise of the players it faced`);

  /* a row that did not play is not rated and does not count as a game played */
  const dnp = league(c => { const g = c.games[0]; c.boxes[g.id][g.home].push({ id: 'AAAX', name: 'X', pos: 'G', min: 0, dnp: 1, gs: 0, pm: 0 }, { id: 'AAAY', name: 'Y', pos: 'F', min: 0, dnp: 0, gs: 0, pm: 0 }); });
  const Rd = E.replay(D, dnp);
  check(!Rd.players.AAAX && !Rd.players.AAAY && JSON.stringify(Rd.rows) === JSON.stringify(R.rows), 'a did-not-play row and a row with no minutes: not rated, nobody moved, no game counted');

  /* left early: three games at 36 minutes, then 8 (skipped), then 8 again (rated, a smaller role) */
  const aaa = LG.games.filter(g => g.home === 'AAA' || g.away === 'AAA');
  const short = league(c => { for (const k of [3, 4]) { const g = aaa[k]; c.boxes[g.id] = JSON.parse(JSON.stringify(c.boxes[g.id])); c.boxes[g.id].AAA[0].min = 8; } });
  const nAfter = k => E.replay(D, { ...short, games: short.games.filter(g => g.date <= aaa[k].date) }).players.AAA0;
  const p2 = nAfter(2), p3 = nAfter(3), p4 = nAfter(4);
  check(p2.n === 3 && p3.n === 3 && p3.R === p2.R && p3.short === true, 'left early: a starter\'s 8 minutes after three games of 36 is not rated');
  check(p4.n === 4 && p4.R !== p3.R && p4.short === false, 'left early: a second short game in a row is rated (a smaller role, not an injury)');

  /* the offseason: every rating and unit carried 0.75 toward 1500, minutes started from the last five regular-season games */
  const end = E.replay(D, { ...LG, games: LG.games.filter(g => g.season === 2022) });
  const open = LG.games.find(g => g.season === 2023), turn = E.replay(D, morning({ ...LG, games: LG.games.filter(g => g.date <= open.date) }, open.date));
  check(Object.keys(end.players).every(id => near(turn.players[id].R, 1500 + D.carry * (end.players[id].R - 1500), 1e-9)) && Object.keys(end.units).every(k => near(turn.units[k], 1500 + D.carry * (end.units[k] - 1500), 1e-9)),
    `the offseason: every player and unit carried ${D.carry} of the way (${Object.keys(end.players).length} players, ${Object.keys(end.units).length} units)`);
  /* a club's first game of a season: last season's last game's players, at their carried ratings; no back to back */
  const lastOf = t => LG.games.filter(g => g.season === 2022 && (g.home === t || g.away === t)).pop();
  const rot = t => LG.boxes[lastOf(t).id][t].filter(r => r.min > 0).map(r => [turn.players[r.id], MIN[+r.id.slice(3)]]);
  const fr = R.rows.find(r => r.id === open.id), sh = E.strength(rot(open.home), D), sa = E.strength(rot(open.away), D);
  check(fr.b2b === 0 && JSON.stringify(fr.x.pretip) === JSON.stringify([1, ...Object.keys(sh).map(g => (sh[g] - sa[g]) / 100)]), 'a club\'s first game of a season: its last game\'s rotation at the carried ratings, no back to back');
  const firstEver = R.rows[0];
  check(firstEver.x.pretip.slice(1).every(v => v === 0) && firstEver.x.pretip[0] === 1, 'a club\'s first game ever: no rotation on record, every slot at the replacement level, even');

  /* a neutral site: no home court, and the clubs swapped give the call turned exactly over */
  const k = LG.games.findIndex(g => g.season === 2023 && g.date > '2022-11-10');
  const neutral = league(c => { c.games[k] = { ...c.games[k], neutral: true }; });
  const swapped = league(c => { const g = c.games[k], id = `${g.season}_${g.date.replace(/-/g, '')}_${g.home}_${g.away}`;
    c.games[k] = { ...g, id, home: g.away, away: g.home, hs: g.as, as: g.hs, neutral: true }; c.boxes[id] = c.boxes[g.id]; delete c.boxes[g.id]; });
  const ri = LG.games[k].id, rn = E.replay(D, neutral), rs = E.replay(D, swapped);
  const n1 = rn.rows.find(r => r.id === ri), s1 = rs.rows.find(r => r.home === n1.away && r.date === n1.date && r.away === n1.home), home = R.rows.find(r => r.id === ri);
  check(home.x.pretip[0] === 1 && n1.x.pretip[0] === 0 && n1.x.log[0] === 0, 'a neutral site: no home court, on every reading of who plays');
  check(near(E.logit(n1, M, D, 'pretip'), -E.logit(s1, M, D, 'pretip'), 1e-12) && near(E.callOf(n1, M, D).pHome + E.callOf(s1, M, D).pHome, 1, 1e-4) && E.callOf(n1, M, D).spread === -E.callOf(s1, M, D).spread,
    'a neutral site: the clubs swapped, the chance and the spread turned exactly over');
  check(Object.keys(rn.players).every(id => near(rn.players[id].R, rs.players[id].R, 1e-9)), 'a neutral site: the ratings move the same whichever club is listed at home');

  /* a postponed game: dropped by load(); one left in the table as scheduled on a past day moves no final's inputs and no
     rating, and gets a call of its own */
  const pg = LG.games[30];
  const stuck = league(c => { c.games.push({ ...pg, id: pg.id + 'X', date: L.addDays(pg.date, -1), final: false, status: 'scheduled', hs: null, as: null }); });
  const Rs = E.replay(D, stuck), base = Object.fromEntries(R.rows.map(r => [r.id, inputs(r)]));
  check(Rs.rows.filter(r => r.final).every(r => base[r.id] === inputs(r)) && Object.keys(R.players).every(id => R.players[id].R === Rs.players[id].R), 'a postponed game left as scheduled: no final\'s inputs and no rating moved');
  const ps = Rs.rows.find(r => r.id === pg.id + 'X');
  check(ps && !ps.final && Number.isFinite(E.callOf(ps, M, D).pHome), 'a postponed game left as scheduled: a call of its own, among the games to come');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elo-model-load-'));
  fs.mkdirSync(path.join(dir, 'data'));
  const head = L.COLS.join(','), line = (id, date, away, home, st, hs, as) => [id, 2023, date, 'REG', away, home, hs, as, 0, st, '', '', 'espn', '', '', '', ''].join(',');
  const csv = rows => [head, ...rows].join('\n') + '\n';
  fs.writeFileSync(path.join(dir, 'data', 'games.csv'), csv([line('2023_20221101_BBB_AAA', '2022-11-01', 'BBB', 'AAA', 'final', 100, 90), line('2023_20221102_CCC_AAA', '2022-11-02', 'CCC', 'AAA', 'postponed', '', ''),
    line('2023_20221103_DDD_AAA', '2022-11-03', 'DDD', 'AAA', 'scheduled', '', ''), [ '2023_20221104_DDD_BBB', 2023, '2022-11-04', 'PRE', 'DDD', 'BBB', '', '', 0, 'scheduled', '', '', 'espn', '', '', '', ''].join(',')]));
  const boxHead = 'game_id,date,team,opp,home,player_id,name,pos,starter,min,fgm,fga,tpm,tpa,ftm,fta,orb,drb,ast,stl,blk,tov,pf,pm,pts,dnp';
  const brow = (id, t, o, h, pid, pos, min, pm, pts) => [id, '2022-11-01', t, o, h, pid, 'P' + pid, pos, 1, min, 4, 9, 1, 3, 2, 2, 1, 4, 3, 1, 0, 2, 2, pm, pts, min ? 0 : 1].join(',');
  const boxRows = [brow('2023_20221101_BBB_AAA', 'AAA', 'BBB', 1, '9', 'G', 30, 5, 11), brow('2023_20221101_BBB_AAA', 'AAA', 'BBB', 1, '12', 'C', 25, 3, 8), brow('2023_20221101_BBB_AAA', 'BBB', 'AAA', 0, '3', 'F', 0, 0, 0), brow('2023_20221101_BBB_AAA', 'BBB', 'AAA', 0, '7', 'SF', 33, -5, 14)];
  fs.writeFileSync(path.join(dir, 'data', 'box_2023.csv'), [boxHead, ...boxRows].join('\n') + '\n');
  const c1 = E.load(dir);
  fs.writeFileSync(path.join(dir, 'data', 'box_2023.csv'), [boxHead, ...boxRows.reverse()].join('\n') + '\n');
  const c2 = E.load(dir);
  check(c1.games.map(g => g.id).join() === '2023_20221101_BBB_AAA,2023_20221103_DDD_AAA', 'load(): a postponed game and a preseason game left out, the final and the game to come kept');
  const sides = c => ['AAA', 'BBB'].map(t => c.boxes['2023_20221101_BBB_AAA'][t]);
  check(JSON.stringify(sides(c1)) === JSON.stringify(sides(c2)) && JSON.stringify(c1.games) === JSON.stringify(c2.games) && c1.boxes['2023_20221101_BBB_AAA'].AAA.map(r => r.id).join() === '12,9', 'load(): a box file\'s row order changes nothing (each side sorted by player id)');
  fs.rmSync(dir, { recursive: true, force: true });

  /* a club with no box score: a final with none is still called and moves nobody; the next game reads the rotation of
     the last game that had one; a club that never had one is all replacement level, every number finite */
  const nb = LG.games[25];
  const noBox = league(c => { delete c.boxes[nb.id]; });
  const before = E.replay(D, { ...noBox, games: noBox.games.filter(g => g.date < nb.date) }), after = E.replay(D, { ...noBox, games: noBox.games.filter(g => g.date <= nb.date) });
  const theirs = id => id.startsWith(nb.home) || id.startsWith(nb.away);
  check(Object.keys(after.players).filter(theirs).every(id => after.players[id].R === before.players[id].R && after.players[id].n === before.players[id].n), 'a final with no box score: nobody on either club moved');
  const rowNb = E.replay(D, noBox).rows.find(r => r.id === nb.id);
  check(rowNb && rowNb.box === false && rowNb.x.pretip && rowNb.mov === nb.hs - nb.as && Number.isFinite(E.callOf(rowNb, M, D).pHome), 'a final with no box score: called on its pre-game rotation, scored on its result');
  const lone = league(c => { for (let i = 0; i < 6; i++) { const g = c.games[60 + i]; c.games.push({ ...g, id: g.id.replace(g.away, 'EEE'), away: 'EEE' }); } });
  const le = E.replay(D, lone).rows.filter(r => r.away === 'EEE');
  check(le.length === 6 && le.every(r => Number.isFinite(E.callOf(r, M, D).pHome) && Number.isFinite(E.callOf(r, M, D).spread) && r.x.pretip.every(Number.isFinite)), 'a club that never had a box score: every slot at the replacement level, a finite call');

  /* the strength by hand: the slots by position and the fill at 1450; two players level on minutes in either order */
  const P = (id, group, R) => ({ id, group, R });
  const gfc = { ...D, groups: 'gfc' }, one1 = { ...D, groups: 'one' };
  const s3 = E.strength([[P('a', 'G', 1600), 30], [P('b', 'G', 1550), 34], [P('c', 'F', 1520), 20]], gfc);
  check(near(s3.G, (1600 + 0.7 * 1550 + 0.45 * 1450) / 2.15) && near(s3.F, (1520 + 1.15 * 1450) / 2.15) && s3.C === 1450, 'by position: the picked sorted by rating, weighted 1, 0.7, 0.45, empty slots at 1450');
  const ten = [40, 40, 40, 40, 40, 35, 5, 5].map((m, i) => [P('p' + i, 'G', 1400 + 30 * i), m]);
  const a1 = E.strength(ten, one1), a2 = E.strength([...ten].reverse(), one1), cut = E.fill240([...ten].reverse());
  check(JSON.stringify(a1) === JSON.stringify(a2) && cut.some(([p]) => p.id === 'p6') && !cut.some(([p]) => p.id === 'p7'), 'two players level on minutes at the 240 cut: the same one taken in any order (by id), the same strength');
  check(near(a1.R, [1580, 1550, 1520, 1490, 1460, 1430, 1400, 1450].reduce((s, r, i) => s + r * E.DEPTHS.one.R[i], 0) / E.DEPTHS.one.R.reduce((s, x) => s + x, 0)), 'one rotation: the seven who fit in 240 minutes sorted by rating, the empty eighth slot (the lightest weight) at 1450');
  check(['G', 'PG', 'SG'].every(p => E.groupOf(p) === 'G') && ['F', 'SF', 'PF'].every(p => E.groupOf(p) === 'F') && E.groupOf('C') === 'C' && E.groupOf('', 'C') === 'C' && E.groupOf('NA') === 'F',
    'the positions: PG and SG guards, SF and PF forwards, C; none or another takes the player\'s last, else F');
}

console.log('3. tonight\'s rotation through makeLiveLineup, on made-up reports');
{
  /* players.js read on a scratch folder's report and rosters: the hub's own rule, run on made-up files */
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elo-model-test-'));
  fs.mkdirSync(path.join(dir, 'tools')); fs.mkdirSync(path.join(dir, 'data'));
  for (const f of ['lib.js', 'elo.js', 'players.js']) fs.copyFileSync(path.join(__dirname, f), path.join(dir, 'tools', f));
  const date = '2023-01-20';
  const report = { date, teams: { AAA: [
    { id: 'AAA0', status: 'Out', returns: '' },                       // Out, no return date: out
    { id: 'AAA1', status: 'Day-To-Day', returns: '2023-01-22' },      // returns after the game: out
    { id: 'AAA2', status: 'Day-To-Day', returns: '2023-01-20' },      // returns on the game's day: plays
    { id: 'AAA3', status: 'Suspension', returns: '' },                // suspended: out
    { id: 'AAA4', status: 'Out', returns: '2023-01-19' },             // Out on the report's own day, whatever the date says
  ] } };
  const roster = (t, extra = [], less = []) => Array.from({ length: 10 }, (_, i) => t + i).filter(id => !less.includes(id)).concat(extra).map(id => ({ id, name: id, pos: 'G' }));
  fs.writeFileSync(path.join(dir, 'data', 'injuries.json'), JSON.stringify(report));
  fs.writeFileSync(path.join(dir, 'data', 'rosters_espn.json'), JSON.stringify({ date, teams: { AAA: roster('AAA', ['NEW1', 'BBB5']), BBB: roster('BBB', ['NEW2'], ['BBB5']) } }));
  const make = require(path.join(dir, 'tools', 'players.js')).makeLiveLineup({ coachOf: () => '' });
  const game = { id: `2023_${date.replace(/-/g, '')}_BBB_AAA`, season: 2023, date, type: 'REG', home: 'AAA', away: 'BBB', neutral: false, final: false, status: 'scheduled', hs: null, as: null, tip: '' };
  const withGame = league(c => c.games.push(game));
  const lists = {};
  const live = E.liveProvider(make), spy = (g, t, ...rest) => { const l = live(g, t, ...rest); lists[t] = l; return l; };
  const Rl = E.replay(D, withGame, { live: spy }), row = Rl.rows.find(r => r.id === game.id);
  const ids = t => new Set(lists[t].map(([p]) => p.id)), aaa = ids('AAA'), bbb = ids('BBB');
  check(!aaa.has('AAA0') && !aaa.has('AAA1') && !aaa.has('AAA3') && !aaa.has('AAA4'), 'Out, Day-To-Day returning after the game, suspended, and Out on the report\'s own day: none plays');
  check(aaa.has('AAA2') && aaa.has('AAA5'), 'Day-To-Day returning on the game\'s day plays, as does everyone not listed');
  check(aaa.has('BBB5') && !bbb.has('BBB5'), 'a player traded: on his new club\'s rotation, off his old one\'s');
  const debut = lists.AAA.find(([p]) => p.id === 'NEW1');
  check(debut && debut[1] === 12 && Rl.players.NEW1 && Rl.players.NEW1.R === D.newR, `a debutant plays twelve minutes, last in the rotation order, at a new player's ${D.newR}`);
  check(E.modeOf(row) === 'live' && row.x.live && row.x.live[1] < row.x.pretip[1], `the game is called on tonight's report, AAA weaker with four of its rotation out (${row.x.live[1].toFixed(3)} against ${row.x.pretip[1].toFixed(3)} on its last game's)`);
  const call = E.callOf(row, M, D);
  check(call.pHome === +(1 / (1 + Math.exp(-E.logit(row, M, D, 'live')))).toFixed(4), 'the live call is the formula on tonight\'s rotation');
  fs.rmSync(dir, { recursive: true, force: true });
}

console.log('4. the fit and the call');
{
  let seed = 3; const rnd = () => (seed = (seed * 48271) % 2147483647) / 2147483647;
  const X = [], y = [];
  for (let i = 0; i < 40000; i++) { const x = [rnd() < 0.9 ? 1 : 0, (rnd() - 0.5) * 2, (rnd() - 0.5) * 2]; X.push(x); y.push(rnd() < 1 / (1 + Math.exp(-(0.3 * x[0] + 1.2 * x[1] - 0.6 * x[2]))) ? 1 : 0); }
  const w = E.logistic(X, y, 0.5);
  check(Math.abs(w[0] - 0.3) < 0.05 && Math.abs(w[1] - 1.2) < 0.06 && Math.abs(w[2] + 0.6) < 0.06, `the logistic recovers planted weights (0.3, 1.2, -0.6): ${w.map(v => v.toFixed(3)).join(', ')}`);
  const at = x => 1 / (1 + Math.exp(-x.reduce((s, v, i) => s + v * w[i], 0)));
  check(near(at([0, 0, 0]), 0.5, 1e-9) && at([1, 0, 0]) > 0.53, `no intercept: two equal clubs at a neutral site are 50/50, at the home court ${(at([1, 0, 0]) * 100).toFixed(1)}%`);
  const r = R.rows[60], z = E.logit(r, M, D, E.modeOf(r)), c = E.callOf(r, M, D);
  check(c.pHome === +(1 / (1 + Math.exp(-z))).toFixed(4) && c.spread === +(-M.slope * z).toFixed(1), 'the call is the formula: the logistic of the weights, the spread the logit times the slope as a home line');
  check(R.rows.every(r => { const k = E.callOf(r, M, D); return k.spread === 0 || (k.pHome > 0.5) === (k.spread < 0); }), 'the pick and the spread never disagree: a home favourite has a home line under zero');
  const F = E.fit(R.rows, D, 2022, 2022);
  check(F.games === R.rows.filter(r => r.season === 2022 && r.mov !== 0).length && F.seasons === '2022-2022', 'a fit reads only the seasons it names, every decided final of them');
}

console.log('5. determinism and a quiet day');
{
  const one = E.replay(D, LG).rows, two = E.replay(D, LG).rows;
  check(JSON.stringify(one) === JSON.stringify(two), 'the same data, the same rows');
  const b1 = E.build(ctx, committed.params, committed.walkForward, E.liveProvider()), b2 = E.build(ctx, committed.params, committed.walkForward, E.liveProvider());
  check(JSON.stringify(b1) === JSON.stringify(b2), 'the same data, the same model file');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'elo-model-write-')), f = path.join(dir, 'models', 'elo.json');
  const first = E.write(f, { ...b1 }, null), stamp = JSON.parse(fs.readFileSync(f, 'utf8')).generated;
  const again = E.write(f, { ...b2 }, JSON.parse(fs.readFileSync(f, 'utf8')));
  check(first && !again && JSON.parse(fs.readFileSync(f, 'utf8')).generated === stamp, 'a second run on the same data writes nothing and keeps the stamp');
  fs.rmSync(dir, { recursive: true, force: true });

  console.log('6. the committed files');
  const keys = ['id', 'name', 'version', 'about', 'fitSeasons', 'params', 'walkForward', 'games', 'upcoming', 'status', 'generated'];
  const shape = m => JSON.stringify(Object.keys(m)) === JSON.stringify(keys) && m.id === 'elo' && m.name === 'ELO Model' && m.status && m.status.ok === true
    && Object.values(m.games).concat(Object.values(m.upcoming)).every(c => JSON.stringify(Object.keys(c)) === '["pHome","spread"]' && c.pHome > 0 && c.pHome < 1 && Number.isFinite(c.spread));
  check(shape(committed) && shape({ ...b1, generated: 'x' }), 'the contract\'s shape: its keys in order, {pHome, spread} for every call, every chance inside (0, 1)');
  check(JSON.stringify(b1.games) === JSON.stringify(committed.games) && JSON.stringify(b1.upcoming) === JSON.stringify(committed.upcoming), 'the committed calls are this code\'s on the committed data');
  const { inPlay } = E.seasons(ctx), all = L.readGames();
  const want = all.filter(g => +g.season === inPlay && g.type !== 'PRE' && ['final', 'scheduled', 'live'].includes(g.status)).map(g => g.game_id).sort();
  const toCome = all.filter(g => +g.season >= E.FIRST && g.type !== 'PRE' && ['scheduled', 'live'].includes(g.status)).map(g => g.game_id).sort();
  check(JSON.stringify(Object.keys(b1.games).sort()) === JSON.stringify(want) && JSON.stringify(Object.keys(b1.upcoming).sort()) === JSON.stringify(toCome), `every regular-season and playoff game of ${inPlay - 1}-${String(inPlay).slice(2)} called (${want.length}), the ${toCome.length} to come apart, no preseason game`);
  check(['2024', '2025', '2026'].every(s => committed.walkForward[s] && committed.walkForward[s].games > 1000 && committed.walkForward[s].logloss > 0.5), 'the walk-forward: 2024, 2025 and 2026');
  const res = JSON.parse(fs.readFileSync(RESEARCH, 'utf8'));
  check(res.folds.every(f => +f.fitted.split('-')[1] < f.season && JSON.stringify(committed.walkForward[f.season]) === JSON.stringify({ games: f.elo.games, logloss: f.elo.logloss, acc: f.elo.acc, mae: f.elo.mae })),
    'each fold fitted on the seasons before it alone, and the model file\'s walk-forward research/elo.json\'s');
  const finals = s => all.filter(g => +g.season === s && g.status === 'final' && g.type !== 'PRE' && +g.home_score !== +g.away_score).length;
  check(res.folds.every(f => f.elo.games === finals(f.season)), `each fold scores every decided regular-season and playoff final of its season (${res.folds.map(f => f.elo.games).join(', ')})`);
  check(JSON.stringify(res.design) === JSON.stringify(D) && res.trials.every(t => !('2026' in t) && !('2027' in t)), 'the design research/elo.json chose, and no trial read 2026 or the season in play');
  const refit = E.fitLive(ctx, D, res, +committed.fitSeasons.split('-')[1]);
  check(JSON.stringify(refit) === JSON.stringify(committed.params) && +committed.fitSeasons.split('-')[1] < inPlay,
    `the fitted numbers are the fit of their seasons (${committed.fitSeasons}), finished seasons, the season in play never in it, sigma the 2026 fold's (${committed.params.sigma})`);
}

console.log(fails ? `${fails} failed` : 'all good');
process.exit(fails ? 1 : 0);
