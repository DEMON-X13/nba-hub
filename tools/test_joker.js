/* The Joker's rows and runs (tools/joker.js) on made-up seasons, and its two promises on the real data.
 *
 *   node tools/test_joker.js            the made-up cases, then the real data's (about ten seconds in all)
 *   node tools/test_joker.js --quick    the made-up cases alone
 *
 * The promise that matters most is the leakage check: a game's row built the morning it is played, with nothing of
 * that day final, is the row it has once it is final and the training reads it. The rest: the running form by hand
 * (the first game sets it, 0.1 a game after, 0.7 carried toward the league at a season's turn), rest, back to backs,
 * three in four, time zones, altitude and a neutral site, the series, a dated coach change, the previous game's top
 * player, the market and check()'s refusals, a team's first game of a season, a club with no box score, a postponed
 * game, a preseason game, determinism, and a run's file: its shape, no call without a moneyline, the input rows frozen
 * at tip, a quiet rerun, and the refusal of a season the trees were never fitted for.
 */
'use strict';
const assert = require('assert');
const fs = require('fs');
const J = require('./joker');

let n = 0;
const ok = (c, msg) => { assert.ok(c, msg); n++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };
const near = (a, b, msg, eps = 1e-9) => { assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} is not ${b}`); n++; };
const addDays = (iso, k) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + k); return d.toISOString().slice(0, 10); };
const SITU = { K: 20, hfa: 60, carry: 0.7, b2b: 40, three4: 5, rest3: 5, alt: 60, scale: 26.73 };
const PMP = { ke: 0.5, kc: 0.05, carryP: 0.7, carryC: 0.5, prior: 1.25, rookie: -80, clip: 20, minGames: 8, blend: 0.1, pm: 0, pmClip: 15, winK: 6, shrink: 0, recency: 0, postMult: 0.5, wexp: 0.5, tz: 10 };
const inputs = r => JSON.stringify({ num: r.num, cat: r.cat, market: r.market });

/* ---------- a made-up league ---------- */
/* one final with its team box and box score: s = [fgm, fga, tpm, tpa, ftm, fta, orb, drb, tov] a side, mins a side */
function final(D, o) {
  const g = { game_id: o.id || `${o.season}_${o.date.replace(/-/g, '')}_${o.away}_${o.home}`, season: o.season, date: o.date, type: o.type || 'REG', away: o.away, home: o.home,
    away_score: o.as === undefined ? '' : String(o.as), home_score: o.hs === undefined ? '' : String(o.hs), neutral: o.neutral || 0, status: o.status || 'final',
    home_line: o.line === undefined ? '' : String(o.line), total: o.total === undefined ? '' : String(o.total), tip: o.tip || '', home_ml: o.hml === undefined ? '' : String(o.hml), away_ml: o.aml === undefined ? '' : String(o.aml) };
  D.games.push(g);
  if (g.status !== 'final') return g;
  const side = (t, opp, home, s, mins, pts) => {
    if (!s) return;
    D.teamStats[g.game_id + ':' + t] = { 'fieldGoalsMade-fieldGoalsAttempted': `${s[0]}-${s[1]}`, 'threePointFieldGoalsMade-threePointFieldGoalsAttempted': `${s[2]}-${s[3]}`,
      'freeThrowsMade-freeThrowsAttempted': `${s[4]}-${s[5]}`, offensiveRebounds: String(s[6]), defensiveRebounds: String(s[7]), totalTurnovers: String(s[8]), turnovers: String(s[8]) };
    const rows = mins.map((m, i) => ({ game_id: g.game_id, date: g.date, team: t, opp, home, player_id: t + i, name: `${t} ${'abcdefghij'[i]}`, pos: 'G', starter: i < 5 ? 1 : 0, min: m,
      fga: Math.round(s[1] * m / 240), fta: Math.round(s[5] * m / 240), orb: Math.round(s[6] * m / 240), tov: Math.round(s[8] * m / 240), pts: Math.round(pts * m / 240), pm: '', dnp: 0 }));
    (D.boxes[g.game_id] = D.boxes[g.game_id] || {})[t] = rows;
  };
  side(g.home, g.away, 1, o.sh, o.mh || [48, 48, 48, 48, 48], o.hs);
  side(g.away, g.home, 0, o.sa, o.ma || [48, 48, 48, 48, 48], o.as);
  return g;
}
const empty = () => ({ games: [], boxes: {}, teamStats: {}, odds: {}, raptor: {}, coachOf: (s, t) => t + ' coach' });
const odds = (D, gid, hml, aml, line, total, open) => { D.odds[gid] = { game_id: gid, provider: 'DraftKings', home_ml: String(hml), away_ml: String(aml), home_line: line === undefined ? '' : String(line), total: total === undefined ? '' : String(total), ...(open || {}) }; };

/* a league of six clubs over two seasons, three games a night, a play-off series, a neutral site and a season to come */
function league() {
  const D = empty();
  const T = ['BOS', 'NYK', 'DEN', 'LAL', 'MIA', 'PHX'], power = { BOS: 4, NYK: 1, DEN: 3, LAL: 0, MIA: -1, PHX: -3 };
  const rounds = [[0, 1, 2, 3, 4, 5], [0, 2, 1, 4, 3, 5], [0, 3, 1, 5, 2, 4], [0, 4, 1, 3, 2, 5], [0, 5, 1, 2, 3, 4]];
  let seed = 3; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const stat = (pts) => { const fga = 80 + Math.floor(rnd() * 15), fta = 15 + Math.floor(rnd() * 12); return [Math.round(fga * 0.47), fga, 12 + Math.floor(rnd() * 6), 33 + Math.floor(rnd() * 8), Math.round(fta * 0.78), fta, 8 + Math.floor(rnd() * 6), 30 + Math.floor(rnd() * 8), 11 + Math.floor(rnd() * 6)]; };
  const mins = [36, 34, 32, 30, 30, 28, 26, 24];
  for (const [season, start] of [[2022, '2021-10-19'], [2023, '2022-10-18'], [2024, '2023-10-24']]) {
    let date = start;
    for (let k = 0; k < (season === 2024 ? 6 : 20); k++) {
      const r = rounds[k % 5];
      for (let q = 0; q < 6; q += 2) {
        const flip = (k + q) % 2, home = T[r[q + flip]], away = T[r[q + 1 - flip]];
        const edge = power[home] - power[away] + 2 + (rnd() - 0.5) * 18;
        const hs = 108 + Math.round(edge / 2), as = 108 - Math.round(edge / 2) + (Math.round(edge / 2) * 2 === Math.round(edge) ? 0 : 1);
        const p = 1 / (1 + Math.exp(-(power[home] - power[away] + 2) * 0.12));
        const hml = p >= 0.5 ? -Math.round(100 * p / (1 - p) * 1.04) : Math.round(100 * (1 - p) / p * 0.96), aml = p >= 0.5 ? Math.round(100 * p / (1 - p) * 0.96) : -Math.round(100 * (1 - p) / p * 1.04);
        const line = -Math.round((power[home] - power[away] + 2) * 2) / 2 * 1.5, neutral = season === 2023 && k === 9 && q === 0 ? 1 : 0;
        const live = season === 2024 && k >= 3;
        const o = { season, date, home, away, neutral, mh: mins, ma: mins };
        if (live) Object.assign(o, { status: 'scheduled', tip: date + 'T23:30Z', ...(k === 5 && q === 4 ? {} : { hml: Math.abs(hml) < 100 ? -110 : hml, aml: Math.abs(aml) < 100 ? -110 : aml, line, total: 221.5 }) });
        else Object.assign(o, { hs: hs === as ? hs + 1 : hs, as, sh: stat(hs), sa: stat(as) });
        if (season === 2024 && !live) Object.assign(o, { hml: Math.abs(hml) < 100 ? -110 : hml, aml: Math.abs(aml) < 100 ? -110 : aml, line, total: 221.5 });
        const g = final(D, o);
        if (season === 2023 && !(k === 4 && q === 2)) odds(D, g.game_id, Math.abs(hml) < 100 ? -110 : hml, Math.abs(aml) < 100 ? -110 : aml, line, 222.5);
      }
      date = addDays(date, k % 3 === 2 ? 1 : 2);
    }
    if (season === 2023) {
      /* a three-game series, BOS at home twice, then at NYK */
      for (const [i, home, away, hs, as] of [[0, 'BOS', 'NYK', 112, 104], [1, 'BOS', 'NYK', 99, 101], [2, 'NYK', 'BOS', 110, 108]]) {
        const g = final(D, { season, date: addDays('2023-04-20', 2 * i), type: 'POST', home, away, hs, as, sh: stat(hs), sa: stat(as), mh: mins, ma: mins });
        odds(D, g.game_id, -150, 130, -3.5, 218.5);
      }
    }
  }
  D.coachOf = (s, t, d) => t === 'NYK' && s === 2023 && d >= '2022-11-20' ? 'NYK second coach' : t + ' coach';
  return D;
}
/* the data as it stood the morning of `date`: that day and every later one not played yet, with no box score */
function truncate(D, date) {
  const gone = new Set(D.games.filter(g => g.date >= date).map(g => g.game_id));
  const boxes = {}; for (const k of Object.keys(D.boxes)) if (!gone.has(k)) boxes[k] = D.boxes[k];
  const teamStats = {}; for (const k of Object.keys(D.teamStats)) if (!gone.has(k.split(':')[0])) teamStats[k] = D.teamStats[k];
  return { ...D, boxes, teamStats, games: D.games.map(g => gone.has(g.game_id) ? { ...g, status: 'scheduled', home_score: '', away_score: '' } : g) };
}

/* ---------- 1. the leakage check, and determinism ---------- */
{
  const D = league();
  const full = J.build(D, PMP, SITU).rows, byId = Object.fromEntries(full.map(r => [r.id, r]));
  eq(JSON.stringify(J.build(D, PMP, SITU).rows), JSON.stringify(full), 'the same data builds the same rows');
  const finals = full.filter(r => r.final && r.season === 2023);
  ok(finals.length > 50, 'the made-up season has its games');
  /* every date of 2022-23, the play-offs among them: the morning's rows are the training rows */
  const dates = [...new Set(finals.map(r => r.date))];
  for (const d of dates) {
    const morning = J.build(truncate(D, d), PMP, SITU).rows;
    for (const r of morning.filter(x => x.date === d)) eq(inputs(r), inputs(byId[r.id]), `${r.id}: the row before tip is the row once final`);
    if (d === dates[8]) {
      /* not vacuous: a game three days on, built that morning, does not yet know what the days between bring */
      const later = morning.find(x => x.date > addDays(d, 2) && x.season === 2023);
      ok(inputs(later) !== inputs(byId[later.id]), 'a game days away is built on less than it will be');
      ok(later.num.n_h < byId[later.id].num.n_h || later.num.n_a < byId[later.id].num.n_a, 'its games-played count is behind');
    }
  }
  const post = full.filter(r => r.type === 'POST');
  eq(post.map(r => [r.num.series_game, r.num.series_diff, r.num.post]), [[1, 0, 1], [2, 1, 1], [3, 0, 1]], 'series game and the home side\'s lead');
  const neutral = full.find(r => r.num.neutral === 1);
  ok(neutral && neutral.num.alt_home === 0 && neutral.num.tz_h === 0 && neutral.num.tz_a === 0, 'a neutral site: no altitude, no time zones');
  const coach = full.filter(r => r.home === 'NYK' && r.season === 2023);
  ok(coach.some(r => r.cat.coach_h === 'NYK coach') && coach.some(r => r.cat.coach_h === 'NYK second coach'), 'a dated coach change');
  eq(coach.filter(r => r.date < '2022-11-20').every(r => r.cat.coach_h === 'NYK coach'), true, 'the first coach before the change');
  const nomk = full.find(r => r.season === 2023 && r.final && !r.market.ok);
  ok(nomk && nomk.num.mk_p === null, 'a final with no closing moneyline has no market');
  /* the trees fit to the bit the same way twice */
  const train = full.filter(r => r.final && r.market.ok && r.season === 2023);
  const a = J.fitJoker(train, J.DESIGNS[1]), b = J.fitJoker(train, J.DESIGNS[1]);
  eq(JSON.stringify(a), JSON.stringify(b), 'the same rows fit the same trees');
  eq(a.sha, b.sha, 'and the same training hash');
}

/* ---------- 2. the running form, rest and travel, by hand ---------- */
{
  const D = empty();
  const B1 = [40, 80, 10, 30, 20, 25, 10, 30, 15], L1 = [38, 85, 12, 36, 15, 20, 12, 32, 12];
  const B2 = [39, 84, 11, 33, 12, 16, 11, 31, 10], L2 = [37, 82, 9, 28, 16, 22, 9, 35, 14];
  final(D, { season: 2022, date: '2021-10-20', home: 'BOS', away: 'LAL', hs: 110, as: 103, sh: B1, sa: L1 });
  final(D, { season: 2022, date: '2021-10-22', home: 'LAL', away: 'BOS', hs: 99, as: 101, sh: L2, sa: B2, mh: [44, 52, 48, 50, 46] });
  final(D, { season: 2022, date: '2021-10-23', home: 'BOS', away: 'LAL', type: 'PRE', hs: 150, as: 60, sh: B1, sa: L1 });   // never a row, never counted
  final(D, { season: 2023, date: '2022-10-19', home: 'BOS', away: 'LAL', hs: 105, as: 100, sh: B1, sa: L1 });
  final(D, { season: 2023, date: '2022-10-20', home: 'DEN', away: 'LAL', hs: 120, as: 110, sh: B2, sa: L2 });
  final(D, { season: 2023, date: '2022-10-21', home: 'DEN', away: 'BOS', neutral: 1, hs: 101, as: 111, sh: B1, sa: null });   // BOS has no box score
  final(D, { season: 2023, date: '2022-10-22', home: 'LAL', away: 'DEN', hs: 104, as: 100, sh: L1, sa: B2 });
  final(D, { season: 2023, date: '2022-10-23', home: 'BOS', away: 'DEN', hs: 104, as: 100, sh: B1, sa: B2 });
  D.coachOf = (s, t, d) => t === 'LAL' && d >= '2022-10-21' ? 'LAL second coach' : t + ' coach';
  const rows = J.build(D, PMP, SITU, { from: 2022 }).rows, R = id => rows.find(r => r.date === id);
  ok(!rows.some(r => r.type === 'PRE'), 'no preseason row');
  /* the side's numbers in a game: possessions fga - orb + tov + 0.44 fta (at least 60), points per 100, pace per 48 */
  const poss = s => Math.max(s[1] - s[6] + s[8] + 0.44 * s[5], 60), rtg = (pts, s) => 100 * pts / poss(s);
  const oB1 = rtg(110, B1), oL1 = rtg(103, L1), oL2 = rtg(99, L2), oB2 = rtg(101, B2);
  /* game 2: LAL at home, two days after Boston: both sides set by game 1 alone */
  const g2 = R('2021-10-22');
  near(g2.num.ortg_h, oL1, 'the first game sets the offence'); near(g2.num.drtg_h, oB1, 'and what was allowed');
  near(g2.num.pace_h, poss(L1), 'pace: possessions over 240 minutes, times 240');
  near(g2.num.ortg_a, oB1, 'Boston\'s offence'); eq([g2.num.n_h, g2.num.n_a], [1, 1], 'one game each');
  eq([g2.num.rest_h, g2.num.rest_a, g2.num.b2b_h, g2.num.three4_h], [2, 2, 0, 0], 'two days\' rest');
  eq([g2.num.tz_h, g2.num.tz_a], [3, 3], 'Boston to Los Angeles on two days: three hours each');
  near(g2.num.net, (oL1 - oB1) - (oB1 - oL1), 'net rating');
  near(g2.num.efg_h, (38 + 0.5 * 12) / 85, 'effective field goal rate');
  near(g2.num.orb_h, 12 / (12 + 30), 'offensive rebound rate against the other side\'s defensive boards');
  near(g2.num.dtov_h, 15 / poss(B1), 'turnovers forced, a possession');
  /* the league's running mean: the first side sets it, each side after moves it 0.005 of the way */
  let lm = oB1; lm += 0.005 * (oL1 - lm); lm += 0.005 * (oL2 - lm); lm += 0.005 * (oB2 - lm);
  /* game 3, a new season: Boston carried 0.7 toward the league from its 0.1-a-game average, no games yet, ten days' rest */
  const g3 = R('2022-10-19');
  const bos = oB1 + 0.1 * (oB2 - oB1), bosAllowed = oL1 + 0.1 * (oL2 - oL1);
  near(g3.num.ortg_h, lm + 0.7 * (bos - lm), 'the season\'s turn carries the offence 0.7 toward the league');
  near(g3.num.drtg_h, lm + 0.7 * (bosAllowed - lm), 'and the defence');
  eq([g3.num.n_h, g3.num.rest_h, g3.num.rest_a, g3.num.tz_a, g3.num.day], [0, 10, 10, 0, 0], 'a first game: no games, ten days, no travel, day 0');
  eq(g3.cat.star_h, 'BOS a', 'the top player by minutes in the previous game (all 48s: the first listed)');
  eq(g3.cat.star_a, 'LAL b', 'Los Angeles\'s 52-minute man');
  eq(g3.num.series_game + g3.num.post, 0, 'a regular-season game');
  /* game 4: Los Angeles at Denver the next day: altitude, a back to back, two hours */
  const g4 = R('2022-10-20');
  eq([g4.num.alt_home, g4.num.b2b_a, g4.num.rest_a, g4.num.tz_a, g4.num.tz_h], [1, 1, 1, 2, 0], 'altitude, back to back, Boston to Denver');
  ok(g4.num.ortg_h === null && g4.num.n_h === 0, 'a club with no games on record has no running numbers');
  eq(g4.cat.coach_a, 'LAL coach', 'before the coach change');
  /* game 5 at a neutral site: no altitude, no time zones whatever the trip */
  const g5 = R('2022-10-21');
  eq([g5.num.neutral, g5.num.alt_home, g5.num.tz_h, g5.num.tz_a, g5.num.b2b_h], [1, 0, 0, 0, 1], 'neutral site');
  /* game 6: Los Angeles home on 22 October after the 19th and the 20th: three in four nights; one hour from Denver */
  const g6 = R('2022-10-22');
  eq([g6.num.three4_h, g6.num.rest_h, g6.num.tz_h, g6.num.tz_a], [1, 2, 1, 0], 'three in four, a Denver trip; Denver came from a neutral site');
  eq(g6.cat.coach_h, 'LAL second coach', 'after the dated change');
  /* game 7: Boston after the neutral game it has no box score for: that game taught its running numbers nothing */
  const g7 = R('2022-10-23');
  eq(g7.num.n_h, 1, 'a game with no box score is not counted');
  near(g7.num.ortg_h, rows.find(r => r.date === '2022-10-21').num.ortg_a, 'its numbers stand where they were');
  eq(g7.num.n_a, 2, 'Denver: three games played, its game with Boston (no box score for Boston) not counted');
  /* the preseason blow-out of 23 October 2021 moved nothing: game 3's carry above already proves it */
}

/* ---------- 3. the market and check() ---------- */
{
  const g = { game_id: 'x', home_ml: '', away_ml: '', home_line: '', total: '' };
  eq(J.market(g, {}).ok, false, 'no line anywhere: no market');
  const m = J.market(g, { x: { home_ml: '-200', away_ml: '170', home_line: '-5.5', total: '221.5', provider: 'DraftKings' } });
  near(m.p, (1 / 1.5) / (1 / 1.5 + 1 / 2.7), 'the two implied chances over their sum');
  eq([m.line, m.total], [-5.5, 221.5], 'the line and total');
  eq(J.market(g, { x: { home_ml: '-200', away_ml: '', home_line: '-5.5' } }).ok, false, 'one moneyline is no market');
  eq(J.market(g, { x: { home_ml: '-200', away_ml: '170', provider: 'DraftKings - Live Odds' } }).ok, false, 'in-game prices are not a closing line');
  eq(J.market(g, { x: { home_ml: '-200', away_ml: '170', home_line: '+6', total: '150' } }).line, null, 'a line whose favourite is not the moneyline\'s is missing');
  eq(J.market(g, { x: { home_ml: '-200', away_ml: '170', home_line: '+6', total: '150' } }).total, null, 'a total no game is posted at is missing');
  const live = J.market({ ...g, home_ml: '-120', away_ml: '100', home_line: '-1.5', total: '230' }, { x: { home_ml: '-300', away_ml: '250' } });
  eq(live.ml, [-120, 100], 'the job\'s own read in games.csv comes first');
  const open = J.market(g, { x: { home_ml: '-200', away_ml: '170', home_ml_open: '-150', away_ml_open: '130', home_line_open: '-3.5', total_open: '220' } }, true);
  eq([open.ml, open.line], [[-150, 130], -3.5], 'the opening line, for the sensitivity');
}

/* ---------- 4. a postponed game ---------- */
{
  const D = league();
  const target = D.games.find(g => g.season === 2024 && g.status === 'scheduled' && g.home_ml !== '');
  const D2 = { ...D, games: D.games.filter(g => g !== target) };
  const a = J.build(D, PMP, SITU).rows, b = J.build(D2, PMP, SITU).rows;
  ok(a.some(r => r.id === target.game_id) && !b.some(r => r.id === target.game_id), 'a postponed game leaves the rows');
  const other = r => r.home !== target.home && r.home !== target.away && r.away !== target.home && r.away !== target.away;
  eq(b.filter(other).map(inputs), a.filter(other).map(inputs), 'the other clubs\' rows do not move');
}

/* ---------- 5. a run: the file, the calls, the inputs log ---------- */
{
  const D = league();
  const rows = J.build(D, PMP, SITU).rows;
  const train = rows.filter(r => r.final && r.market.ok && r.season === 2023);
  const F = J.fitJoker(train, J.DESIGNS[0]);
  const params = { design: 'base', spread: 'trees', hyper: J.HYPER, fitSeasons: [2023], rows: F.rows, trainSha256: F.sha, playerParams: PMP, teamParams: SITU,
    columns: { num: F.enc.num, cat: F.enc.cat, medians: F.enc.medians, levels: F.enc.levels }, scale: F.scale, win: F.win, margin: F.margin };
  const wf = { 2024: { games: 1, logloss: 0.6, acc: 0.6, mae: 11 } };
  const run1 = J.score(D, params, null, { now: '2023-10-28T12:00Z', walkForward: wf });
  const o = run1.out;
  eq(Object.keys(o).sort(), ['about', 'fitSeasons', 'games', 'id', 'inputs', 'name', 'params', 'status', 'upcoming', 'version', 'walkForward'].sort(), 'the contract\'s keys, and the inputs log');
  eq([o.id, o.name, o.status], ['joker', 'The Joker', { ok: true }], 'its name and status');
  const s24 = rows.filter(r => r.season === 2024);
  eq(Object.keys(o.games).sort(), s24.filter(r => r.market.ok).map(r => r.id).sort(), 'a call on every game of the season with a moneyline, finals and to come');
  eq(Object.keys(o.upcoming).sort(), s24.filter(r => r.market.ok && !r.final).map(r => r.id).sort(), 'upcoming: the ones not final');
  const noline = s24.filter(r => !r.final && !r.market.ok);
  ok(noline.length === 1 && !o.games[noline[0].id], 'a game with no moneyline posted gets no call');
  eq(run1.noLine, 1, 'and the run counts it');
  for (const [id, c] of Object.entries(o.games)) {
    ok(c.pHome > 0 && c.pHome < 1 && c.pHome === +c.pHome.toFixed(4), `${id}: a chance to four places`);
    ok(Number.isFinite(c.spread) && c.spread === +c.spread.toFixed(1), `${id}: a spread to one place`);
  }
  for (const id of Object.keys(o.upcoming)) eq(o.upcoming[id], o.games[id], `${id}: upcoming is games' call`);
  /* the call on a final is the trees on its pre-tip row: the same as the morning it was played */
  const fin = s24.find(r => r.final && r.market.ok);
  const morning = J.score(truncate(D, fin.date), params, null, { now: fin.date + 'T12:00Z', walkForward: wf }).out;
  eq(morning.upcoming[fin.id], o.games[fin.id], 'a final\'s call is the call it had that morning');
  eq(morning.inputs.rows[fin.id].num, J.NUM.map(c => fin.num[c] === null ? null : +fin.num[c].toFixed(4)), 'the morning logged its input row');
  /* the inputs log: every game to come not yet tipped, then frozen */
  eq(Object.keys(o.inputs.rows).sort(), Object.keys(o.upcoming).sort(), 'an input row for every call still to tip');
  eq(o.inputs.columns, { num: J.NUM, cat: J.CAT }, 'the log names its columns');
  const first = Object.keys(o.upcoming).sort()[0], g = D.games.find(x => x.game_id === first);
  const later = J.score(D, params, o, { now: '2023-10-28T13:00Z', walkForward: wf }).out;
  eq(JSON.stringify(later), JSON.stringify(o), 'a quiet rerun gives the same file, stamps and all');
  /* the line moves after tip: the frozen row stays, the call follows the line (the ledger, not this file, freezes calls) */
  const moved = { ...D, games: D.games.map(x => x.game_id === first ? { ...x, home_ml: '-400', away_ml: '320' } : x) };
  const after = J.score(moved, params, o, { now: g.tip, walkForward: wf }).out;
  eq(after.inputs.rows[first], o.inputs.rows[first], 'frozen at tip: the row is never rewritten');
  const before = J.score(moved, params, o, { now: '2023-10-28T18:00Z', walkForward: wf }).out;
  ok(before.inputs.rows[first].at === '2023-10-28T18:00Z' && before.inputs.rows[first].ml[0] === -400, 'before tip a changed line rewrites the row, with its stamp');
  const quiet = Object.keys(o.upcoming).find(id => id !== first);
  eq(before.inputs.rows[quiet], o.inputs.rows[quiet], 'an unchanged row keeps its stamp');
  /* a game that loses its line before tip keeps its last row; a postponed one leaves the log */
  const lost = { ...D, games: D.games.map(x => x.game_id === quiet ? { ...x, home_ml: '', away_ml: '' } : x) };
  const l = J.score(lost, params, o, { now: '2023-10-28T14:00Z', walkForward: wf }).out;
  ok(!l.upcoming[quiet] && l.inputs.rows[quiet] && JSON.stringify(l.inputs.rows[quiet]) === JSON.stringify(o.inputs.rows[quiet]), 'no line now: no call, the last row kept');
  const gone = { ...D, games: D.games.filter(x => x.game_id !== quiet) };
  ok(!J.score(gone, params, o, { now: '2023-10-28T14:00Z', walkForward: wf }).out.inputs.rows[quiet], 'a postponed game leaves the log');
  /* a season the trees were never fitted for is refused */
  const far = { ...D, games: D.games.concat([{ ...D.games[D.games.length - 1], game_id: '2025_x', season: 2025, date: '2024-10-22', status: 'scheduled' }]) };
  assert.throws(() => J.score(far, params, null, { walkForward: wf }), /fitted on seasons up to 2023: refit/); n++;
  /* the file as written: one entry a line where it is long, and JSON that reads back as the same object */
  const text = J.pretty(o);
  eq(JSON.parse(text), JSON.parse(JSON.stringify(o)), 'the written file reads back as the run');
  ok(text.split('\n').some(l => /^  "[^"]+": \{"pHome"/.test(l)), 'one call a line');
}

/* ---------- 6. the real data ---------- */
if (!process.argv.includes('--quick')) {
  const t0 = Date.now();
  const D = J.load();
  const season = Math.max(...D.games.map(g => g.season));
  const days = [...new Set(D.games.filter(g => g.season === season && g.status === 'final').map(g => g.date))].sort();
  if (days.length) {
    /* the leakage check on the job's own files: the last day with finals, rebuilt as that morning saw it */
    const d = days[days.length - 1];
    const full = J.build(D, D.pmLive, D.situP).rows, morning = J.build(truncate(D, d), D.pmLive, D.situP).rows;
    const today = morning.filter(r => r.date === d);
    ok(today.length > 0, 'the real day has games');
    for (const r of today) eq(inputs(r), inputs(full.find(x => x.id === r.id)), `${r.id}: the morning's row is the final's`);
  }
  if (fs.existsSync(J.OUT)) {
    const o = JSON.parse(fs.readFileSync(J.OUT, 'utf8'));
    for (const k of ['id', 'name', 'version', 'about', 'fitSeasons', 'params', 'walkForward', 'games', 'upcoming', 'status', 'generated']) ok(k in o, `models/joker.json has ${k}`);
    eq(o.id, 'joker', 'its id');
    if (o.status.ok) {
      for (const Y of ['2024', '2025', '2026']) ok(o.walkForward[Y] && o.walkForward[Y].games > 1000 && o.walkForward[Y].logloss > 0 && o.walkForward[Y].acc > 0 && o.walkForward[Y].mae > 0, `the walk-forward's ${Y}`);
      const S = Math.max(...o.fitSeasons);
      const mine = D.games.filter(g => g.season === S + 1);
      const priced = new Set(mine.filter(g => g.home_ml !== '' && g.away_ml !== '').map(g => g.game_id));
      for (const id of Object.keys(o.games)) ok(priced.has(id), `${id}: called, and it has a moneyline`);
      for (const id of Object.keys(o.upcoming)) ok(mine.find(g => g.game_id === id).status !== 'final' && o.games[id], `${id}: to come`);
      eq(o.fitSeasons, J.FIT_SEASONS, 'fitted on 2022-23 to 2025-26');
    }
  }
  console.log(`test_joker: the real data in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
}

console.log(`test_joker: ${n} checks passed`);
