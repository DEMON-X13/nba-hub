/* Write state.json, the one file the site loads.
 *
 *   node tools/publish.js
 *
 * From the games table, both models' files, the predictions log and the injury report:
 *   slate     every game from yesterday to ten days out, with the model's numbers, the lineups, who is
 *             out and what it costs, the market line, and the score once final
 *   record    the season's finals with the number the site published before each (predictions.csv),
 *             graded straight up and against the line that was on the table at the time
 *   teams     strength, offence, defence, coach, pace, the team Elo, and the injured
 *   players   every rated player with offence, defence, minutes, team
 *   coaches   every rated coach
 *   backtest  the models' holdout report, so the site can say what the numbers are worth
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
    return { id: g.game_id, date: g.date, tip: g.tip || '', type: g.type, away: g.away, home: g.home, neutral: +g.neutral === 1, status: g.status,
      awayScore: num(g.away_score), homeScore: num(g.home_score), line: num(g.home_line), totalLine: num(g.total),
      ml: g.home_ml || g.away_ml ? { home: num(g.home_ml), away: num(g.away_ml) } : null,
      model: frozen || (u ? { pHome: u.pHome, spread: u.spread, total: u.total, pace: u.pace, home: u.home, away: u.away }
        : p ? { pHome: +p.pHome, spread: +p.spread, total: +p.total } : null),
      team: t ? { pHome: t.pHome, spread: t.spread } : p && p.team_pHome ? { pHome: +p.team_pHome } : null,
      published: p ? { pHome: +p.pHome, spread: +p.spread, total: +p.total, line: num(p.home_line), totalLine: num(p.total_line), at: p.logged } : null };
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
      line, totalLine: tl, pick, su, ats, ou, teamPick: p.team_pHome ? (+p.team_pHome >= 0.5 ? g.home : g.away) : null };
  });

  const teams = {};
  for (const t of L.TEAMS) {
    const pt = players.teams[t] || {}, mt = model.teams[t] || {};
    teams[t] = { strength: pt.strength, offence: pt.offence, defence: pt.defence, coach: pt.coach, coachElo: pt.coachElo, pace: pt.pace, elo: mt.elo, out: pt.out || [],
      injuries: (inj.teams[t] || []).map(x => ({ id: x.id, name: x.name, pos: x.pos, status: x.status, detail: x.detail, returns: x.returns || '' })) };
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
  const names = {};
  for (const p of plist) names[p.id] = p.name;

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
  const state = { season, opening: opener, finals, pending, injuriesAsOf: inj.date || null, vsMarket, generated: new Date().toISOString().slice(0, 16) + 'Z', asOf: players.asOf, today, modelBuild: players.generated, teamModelBuild: model.generated,
    slate, record, teams, players: plist, coaches, names,
    backtest: { player: players.report, fitSeasons: players.fitSeasons, holdoutSeasons: players.holdoutSeasons, team: { fit: model.fit, holdout: model.holdout, fitSeasons: model.fitSeasons, holdoutSeasons: model.holdoutSeasons } },
    params: { player: players.params, team: model.params } };
  const body = JSON.stringify(state);
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  /* only the timestamp differs on a quiet day: leave the file alone then */
  const strip = s => s.replace(/"generated":"[^"]*"/, '');
  if (strip(body) !== strip(before)) fs.writeFileSync(OUT, body);
  L.log(`state.json: ${slate.length} games on the slate ${from}..${to}, ${record.length} graded this season, ${plist.length} players, ${coaches.length} coaches, ${(body.length / 1024).toFixed(0)} KB, ${strip(body) !== strip(before) ? 'written' : 'unchanged'}`);
}
if (require.main === module) main();
