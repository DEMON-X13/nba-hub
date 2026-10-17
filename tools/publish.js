/* Write state.json, the one file the site loads.
 *
 *   node tools/publish.js
 *
 * From the games table, both models' files, the predictions log and the injury report:
 *   slate     every game from yesterday to ten days out, with the model's numbers, the lineups, who is
 *             out and what it costs, the market line, and the score once final
 *   record    the season's finals with the number the site published before each (predictions.csv),
 *             graded straight up and against the line that was on the table at the time
 *   teams     strength, offence, defence, coach, pace, the team Elo, and who is out
 *   players   every rated player with his overall Elo on the ladder (THE LADDER below), offence, defence, minutes,
 *             team
 *   coaches   every rated coach, with his overall Elo
 *   backtest  the models' holdout report, so the site can say what the numbers are worth
 *   vsMarket  research/backtest.json's summary, the Record tab's table against the market
 *   finals    every final of this season and the last by id, the score a bet is graded on once its game has left
 *             the slate (pending: past games not yet read final)
 *   props, boxes, corr  the props model's block, the recent box lines a player's leg is graded from and the
 *             same-game table (README "Player props" and "Same-game parlays")
 * Nothing a visitor does reaches this file; only the job writes it.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const DATA = path.join(L.ROOT, 'data');
const OUT = path.join(L.ROOT, 'state.json');
const read = f => JSON.parse(fs.readFileSync(path.join(L.ROOT, f), 'utf8'));
const csv = f => { const p = path.join(DATA, f); if (!fs.existsSync(p)) return []; const lines = fs.readFileSync(p, 'utf8').trim().split('\n'); const h = lines.shift().split(','); return lines.filter(Boolean).map(l => { const v = l.split(','); const o = {}; h.forEach((k, i) => { o[k] = v[i] === undefined ? '' : v[i]; }); return o; }); };
const num = v => v === '' || v === undefined ? null : +v;

function main() {
  const model = read('model.json'), players = read('players.json');
  const games = L.readGames();
  const preds = Object.fromEntries(csv('predictions.csv').map(r => [r.game_id, r]));
  const inj = fs.existsSync(path.join(DATA, 'injuries.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'injuries.json'), 'utf8')) : { teams: {} };
  const now = new Date(), nowIso = now.toISOString().slice(0, 16) + 'Z';
  const today = L.etDate(now);
  const from = L.addDays(today, -1), to = L.addDays(today, 10);
  /* the season in play is the latest one with a game on the slate's horizon, not the calendar's: on July 1 the
     calendar turns to next season with no game in it, and the record, the finals visitors' bets grade from and the
     Record tab would all go blank for the summer. It turns when the new schedule's first game is ten days off */
  const season = Math.max(...games.filter(g => g.date <= to).map(g => +g.season), 0) || L.seasonOf(today);

  const slate = games.filter(g => g.date >= from && g.date <= to).map(g => {
    const u = players.upcoming[g.game_id] || null, t = model.upcoming[g.game_id] || null, p = preds[g.game_id] || null;
    /* once a game has tipped (by status, or by its tip time while ESPN still calls it scheduled), its numbers are the
       ones logged before tip-off, which the record grades: a run landing during the game would re-price it on news
       from after the tip. The lineups shown stay the run's */
    const started = g.status !== 'scheduled' || (g.tip && g.tip <= nowIso);
    const frozen = started && p ? { pHome: +p.pHome, spread: +p.spread, total: +p.total, pace: u ? u.pace : undefined, home: u ? u.home : undefined, away: u ? u.away : undefined } : null;
    /* espn: ESPN's event id, which the page's props read (Refresh odds) asks for DraftKings' player props by; the
       press's own scoreboard read gives it too, and this stands in when that day's scoreboard does not answer */
    return { id: g.game_id, date: g.date, tip: g.tip || '', type: g.type, away: g.away, home: g.home, neutral: +g.neutral === 1, status: g.status, espn: g.espn_id || '',
      awayScore: num(g.away_score), homeScore: num(g.home_score), line: num(g.home_line), totalLine: num(g.total),
      ml: g.home_ml || g.away_ml ? { home: num(g.home_ml), away: num(g.away_ml) } : null,
      model: frozen || (u ? { pHome: u.pHome, spread: u.spread, total: u.total, pace: u.pace, home: u.home, away: u.away }
        : p ? { pHome: +p.pHome, spread: +p.spread, total: +p.total } : null),
      team: t ? { pHome: t.pHome, spread: t.spread } : p && p.team_pHome ? { pHome: +p.team_pHome } : null };
  });

  /* the season's record: only games the site had a number on before tip-off */
  const record = games.filter(g => g.status === 'final' && g.type !== 'PRE' && +g.season === season && preds[g.game_id]).map(g => {
    const p = preds[g.game_id];
    const mov = +g.home_score - +g.away_score;
    const pick = +p.pHome >= 0.5 ? g.home : g.away;
    const su = mov === 0 ? null : (pick === g.home) === (mov > 0);
    const line = num(p.home_line);
    let ats = null;                                   // the model's side against the line, from the home side's spread
    /* a model number equal to the line takes no side, so it is not graded either way */
    if (line !== null && +p.spread !== line) { const modelHome = +p.spread < line; const cover = mov + line; ats = cover === 0 ? null : modelHome === (cover > 0); }
    const tl = num(p.total_line); let ou = null;
    if (tl !== null && +p.total !== tl) { const tot = +g.home_score + +g.away_score; ou = tot === tl ? null : (+p.total > tl) === (tot > tl); }
    return { id: g.game_id, date: g.date, away: g.away, home: g.home, awayScore: +g.away_score, homeScore: +g.home_score, pHome: +p.pHome, spread: +p.spread, total: +p.total,
      line, totalLine: tl, pick, su, ats, ou };
  });

  const teams = {};
  for (const t of L.TEAMS) {
    const pt = players.teams[t] || {}, mt = model.teams[t] || {};
    teams[t] = { strength: pt.strength, offence: pt.offence, defence: pt.defence, coach: pt.coach, coachElo: pt.coachElo, pace: pt.pace, elo: mt.elo, out: pt.out || [] };
  }
  /* a player's club is the one whose ESPN roster lists him today; the model only knows the last club he played for,
     which is last season's for everyone who moved over the summer. With the rosters read, a player on none is FA */
  const ros = fs.existsSync(path.join(DATA, 'rosters_espn.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'rosters_espn.json'), 'utf8')) : { teams: {} };
  const at = t => (ros.asOf && ros.asOf[t]) || ros.date || '';   // a player on two rosters (one kept from an earlier read) is the later read's
  const clubOf = {}; for (const [t, list] of Object.entries(ros.teams || {})) for (const a of list || []) if (a.id && (clubOf[a.id] === undefined || at(t) > at(clubOf[a.id]))) clubOf[a.id] = t;
  const rostersRead = Object.values(ros.teams || {}).filter(l => l && l.length >= 10).length >= 25;
  const plist = Object.entries(players.players).map(([id, p]) => ({ id, ...p, team: clubOf[id] || (rostersRead ? 'FA' : p.team) })).sort((a, b) => b.elo - a.elo);
  /* a coach's club is shown only while he coaches it; a club's coach with under ten games rated (a new or interim
     one) is listed at the rating the model prices his games with */
  const current = Object.fromEntries(L.TEAMS.map(t => [t, (players.teams[t] || {}).coach]).filter(([, c]) => c));
  const coachedBy = Object.fromEntries(Object.entries(current).map(([t, c]) => [c, t]));
  const coaches = Object.entries(players.coaches).map(([name, c]) => ({ name, ...c, team: coachedBy[name] || '' }));
  for (const [t, name] of Object.entries(current)) if (!players.coaches[name]) coaches.push({ name, team: t, elo: players.teams[t].coachElo || 0, games: players.teams[t].coachGames || 0 });
  coaches.sort((a, b) => b.elo - a.elo);

  /* THE LADDER, as the NFL hub draws it: a rating shown on a bell curve, 1500 plus 100 points for every standard
     deviation above the ranked pool's average, so the tier shields (Wood under 1350, then Iron, Bronze, Silver, Gold,
     Platinum, Diamond, Master and Elite 50 points apart, the HOF gem from 1750) split the pool the way a ranked ladder
     does. The pool: rostered players with ten minutes or more a game over twenty games or more (every listed player
     is shown on its curve), and coaches with ten games rated. The order is untouched; the models never read it */
  const curve = vals => { const n = vals.length, m = n ? vals.reduce((a, x) => a + x, 0) / n : 0, sd = n > 1 ? Math.sqrt(vals.reduce((a, x) => a + (x - m) ** 2, 0) / n) : 0;
    return { n, mean: +m.toFixed(2), sd: +sd.toFixed(2), show: v => sd > 0 ? Math.round(1500 + 100 * (v - m) / sd) : 1500 }; };
  let pool = plist.filter(p => p.team !== 'FA' && p.min >= 10 && p.games >= 20);
  if (pool.length < 30) pool = plist;                       // too few to make a curve of: everyone
  const pc = curve(pool.map(p => p.elo)), cc = curve(coaches.filter(c => c.games >= 10).map(c => c.elo));
  const inPool = new Set(pool.map(p => p.id));
  for (const p of plist) { p.rating = pc.show(p.elo); if (inPool.has(p.id)) p.ranked = true; }
  for (const c of coaches) { c.rating = cc.show(c.elo); if (c.games >= 10) c.ranked = true; }
  for (const p of plist) { delete p.elo; delete p.last; }    // the page shows the rating and offence and defence; the raw sum and the last game date are the model's

  /* opening night: the first regular-season game on or after today, once the schedule shows it */
  const opener = games.filter(g => g.type === 'REG' && g.date >= today).map(g => g.date).sort()[0] || null;
  /* every final of the season in play and the one before it, preseason included: a visitor's pick or locked bet
     grades from this once its game has left the ten-day slate, through the summer and the new season's turn. The
     id carries the date and teams */
  const finals = {};
  for (const g of games) if (g.status === 'final' && (+g.season === season || +g.season === season - 1)) finals[g.game_id] = [+g.away_score, +g.home_score];
  /* the season's past games the table holds and has not finished (a final not read yet): the page voids a bet only on
     a game missing from every list, so these must not look missing */
  const pending = games.filter(g => g.status !== 'final' && g.date < from && (+g.season === season || +g.season === season - 1)).map(g => g.game_id);
  /* the walk-forward backtest against the closing line (tools/backtest.js), with the lineups known: what the
     model and the Parlay Builder's suggestions did on seasons the model never saw, beside what the market expected */
  const btFile = path.join(L.ROOT, 'research', 'backtest.json');
  const btm = fs.existsSync(btFile) ? JSON.parse(fs.readFileSync(btFile, 'utf8')) : null;
  const tierOf = t => t && { parlays: t.parlays, won: t.won, exp: t.expMarketPower, units: t.units, units90: t.units90 };
  const vsMarket = btm ? { generated: btm.generated, seasons: Object.values(btm.seasons).filter(x => x.lineup === 'known' && x.priced).sort((a, b) => a.season - b.season).map(x => ({
    season: x.season, games: x.priced, logloss: x.logloss, straightUp: x.straightUp, against: x.modelPicks.againstMarket,
    tiers: Object.fromEntries(['safe', 'med', 'aggr', 'value'].filter(k => x.parlays[k]).map(k => [k, tierOf(x.parlays[k])])), twoFav: tierOf(x.baseline && x.baseline.twoFavourites) })) } : null;
  const props = propsState(slate, nowIso);
  const boxes = boxesState(games, today), corr = corrState();
  const state = { season, opening: opener, finals, pending, injuriesAsOf: inj.date || null, vsMarket, props, boxes, corr, generated: new Date().toISOString().slice(0, 16) + 'Z', asOf: players.asOf, today,
    slate, record, teams, players: plist, coaches,
    backtest: { player: players.report, fitSeasons: players.fitSeasons, holdoutSeasons: players.holdoutSeasons, team: { fit: model.fit, holdout: model.holdout, fitSeasons: model.fitSeasons, holdoutSeasons: model.holdoutSeasons } },
    params: { player: players.params, team: model.params } };
  const body = JSON.stringify(state);
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  /* only the timestamp differs on a quiet day: leave the file alone then (the top-level stamp, not the first
     "generated" in the text, which is vsMarket's) */
  const strip = s => { try { const o = JSON.parse(s); delete o.generated; return JSON.stringify(o); } catch (e) { return s; } };
  if (strip(body) !== strip(before)) fs.writeFileSync(OUT, body);
  L.log(`state.json: ${slate.length} games on the slate ${from}..${to}, ${record.length} graded this season, ${plist.length} players, ${coaches.length} coaches, ${(body.length / 1024).toFixed(0)} KB, ${strip(body) !== strip(before) ? 'written' : 'unchanged'}`);
}
/* The props model's numbers for the page (tools/props.js writes props.json; README "Player props"): the projections for
   the slate's games not yet started, the distribution's constants so the page can price any line DraftKings posts, the
   measured fair-chance rules, the walk-forward and market tests in brief, and the shadow ledger's running numbers. The
   model is on trial: nothing here is a suggestion, and the page says so */
const PROPS_BASE = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'];
function propsState(slate, nowIso) {
  const f = path.join(L.ROOT, 'props.json');
  if (!fs.existsSync(f)) return null;
  const pj = JSON.parse(fs.readFileSync(f, 'utf8'));
  const open = new Set(slate.filter(g => g.status === 'scheduled' && !(g.tip && g.tip <= nowIso)).map(g => g.id));
  const games = {};
  for (const [gid, g] of Object.entries(pj.upcoming || {})) {
    if (!open.has(gid)) continue;
    const players = {};
    for (const [team, list] of Object.entries(g.players)) for (const p of list) players[p.id] = [p.name, team, p.pos, p.min, ...PROPS_BASE.map(k => p.mu[k]), p.dd, p.td];
    games[gid] = { tip: g.tip, away: g.away, home: g.home, players };
  }
  const lf = path.join(DATA, 'props_shadow.json');
  const lg = fs.existsSync(lf) ? JSON.parse(fs.readFileSync(lf, 'utf8')) : null;
  const ledger = lg ? { registered: lg.bar_registered, bar: { lines: lg.bar.lines, passIf: lg.bar.pass_if, otherwise: lg.bar.otherwise, before: lg.bar.before }, decision: lg.decision ? { verdict: lg.decision.verdict, decidedAt: lg.decision.decided_at, lines: lg.decision.lines } : null,
    summary: lg.summary ? { standing: lg.summary.standing, gradedGames: lg.summary.graded_games, lines: lg.summary.compared, voids: lg.summary.voids, scores: lg.summary.scores, flat: lg.summary.flat, toCome: lg.summary.to_come } : null } : null;
  const rs = pj.research;
  const research = rs ? { market: (rs.folds.find(x => x.market) || {}).market || null } : null;   // the page shows the archive test
  /* on trial until a change of its own says otherwise: a PASS makes the model a candidate, it never moves the page by itself */
  return { onTrial: true, build: pj.generated, asOf: pj.asOf, fitSeasons: pj.fitSeasons,
    stats: ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'], combos: { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] },
    layout: ['name', 'team', 'pos', 'min'].concat(PROPS_BASE, ['dd', 'td']), horizonGameDays: 5, minShown: 8,
    dist: { kind: 'negative binomial', var: pj.params.var, rule: pj.distribution },
    fair: pj.fair, games, ledger, research };
}
/* What a visitor's player leg is graded from (README "Same-game parlays"): the box score of every final of the last
   BOX_DAYS days, regular season and playoffs (preseason games get no box score), as fetch_box.js wrote it. One line a
   player who played: [points, rebounds, assists, threes made, steals, blocks], by ESPN athlete id; a player the box
   lists as not playing, or does not list, is not there, and DraftKings voids a leg on a player who does not play. A
   final with no box read yet is not there at all, so a leg on it waits. The page writes a leg's grade into the
   visitor's own Bet Build once it is made, so the window only has to cover the days between a final and the visitor's
   next look; a leg still ungraded after it is read from data/box_<season>.csv, which Pages serves too */
const BOX_DAYS = 7;
const BOX_LINE = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'];
function boxesState(games, today) {
  const from = L.addDays(today, -BOX_DAYS);
  const want = new Set(games.filter(g => g.status === 'final' && g.type !== 'PRE' && g.date >= from && g.date <= today).map(g => g.game_id));
  const out = {};
  for (const season of [...new Set([...want].map(id => id.split('_')[0]))].sort()) {
    for (const r of csv(`box_${season}.csv`)) {
      if (!want.has(r.game_id)) continue;
      const g = out[r.game_id] = out[r.game_id] || {};
      if (+r.dnp === 1) continue;
      g[r.player_id] = [+r.pts, +r.orb + +r.drb, +r.ast, +r.tpm, +r.stl, +r.blk];
    }
  }
  return { from, days: BOX_DAYS, line: BOX_LINE, games: out };
}
/* The same-game table the builder prices two legs of one game with (tools/corr.js writes data/corr.json, measured on
   the finished seasons; README "Same-game parlays"): the rho between two legs' hits, the pairs never joined, and the
   same-game hold, the NFL hub's, untested here */
function corrState() {
  const f = path.join(DATA, 'corr.json');
  if (!fs.existsSync(f)) return null;
  const c = JSON.parse(fs.readFileSync(f, 'utf8'));
  return { measured: c.measured, rho: c.rho, refused: c.refused.pairs, hold: c.hold.value, holdTested: !!c.hold.tested };
}
module.exports = { propsState, boxesState, corrState };
if (require.main === module) main();
