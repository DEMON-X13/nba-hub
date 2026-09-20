/* Write nba-hub/state.json, the one file the site loads.
 *
 *   node nba-hub/tools/publish.js
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

const DATA = path.join(L.ROOT, 'nba-hub', 'data');
const OUT = path.join(L.ROOT, 'nba-hub', 'state.json');
const read = f => JSON.parse(fs.readFileSync(path.join(L.ROOT, 'nba-hub', f), 'utf8'));
const csv = f => { const p = path.join(DATA, f); if (!fs.existsSync(p)) return []; const lines = fs.readFileSync(p, 'utf8').trim().split('\n'); const h = lines.shift().split(','); return lines.filter(Boolean).map(l => { const v = l.split(','); const o = {}; h.forEach((k, i) => { o[k] = v[i] === undefined ? '' : v[i]; }); return o; }); };
const num = v => v === '' || v === undefined ? null : +v;

function main() {
  const model = read('model.json'), players = read('players.json');
  const games = L.readGames();
  const preds = Object.fromEntries(csv('predictions.csv').map(r => [r.game_id, r]));
  const inj = fs.existsSync(path.join(DATA, 'injuries.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'injuries.json'), 'utf8')) : { teams: {} };
  const today = L.etDate(new Date());
  const season = L.seasonOf(today);
  const from = L.addDays(today, -1), to = L.addDays(today, 10);

  const slate = games.filter(g => g.date >= from && g.date <= to).map(g => {
    const u = players.upcoming[g.game_id] || null, t = model.upcoming[g.game_id] || null, p = preds[g.game_id] || null;
    return { id: g.game_id, date: g.date, tip: g.tip || '', type: g.type, away: g.away, home: g.home, neutral: +g.neutral === 1, status: g.status,
      awayScore: num(g.away_score), homeScore: num(g.home_score), line: num(g.home_line), totalLine: num(g.total),
      model: u ? { pHome: u.pHome, spread: u.spread, total: u.total, pace: u.pace, home: u.home, away: u.away }
        : p ? { pHome: +p.pHome, spread: +p.spread, total: +p.total } : null,
      team: t ? { pHome: t.pHome, spread: t.spread } : p && p.team_pHome ? { pHome: +p.team_pHome } : null,
      published: p ? { pHome: +p.pHome, spread: +p.spread, total: +p.total, line: num(p.home_line), totalLine: num(p.total_line), at: p.logged } : null };
  });

  /* the season's record: only games the site had a number on before tip-off */
  const record = games.filter(g => g.status === 'final' && +g.season === season && preds[g.game_id]).map(g => {
    const p = preds[g.game_id];
    const mov = +g.home_score - +g.away_score;
    const pick = +p.pHome >= 0.5 ? g.home : g.away;
    const su = mov === 0 ? null : (pick === g.home) === (mov > 0);
    const line = num(p.home_line);
    let ats = null;                                   // the model's side against the line, from the home side's spread
    if (line !== null) { const modelHome = +p.spread < line; const cover = mov + line; ats = cover === 0 ? null : modelHome === (cover > 0); }
    const tl = num(p.total_line); let ou = null;
    if (tl !== null) { const tot = +g.home_score + +g.away_score; ou = tot === tl ? null : (+p.total > tl) === (tot > tl); }
    return { id: g.game_id, date: g.date, away: g.away, home: g.home, awayScore: +g.away_score, homeScore: +g.home_score, pHome: +p.pHome, spread: +p.spread, total: +p.total,
      line, totalLine: tl, pick, su, ats, ou, teamPick: p.team_pHome ? (+p.team_pHome >= 0.5 ? g.home : g.away) : null };
  });

  const teams = {};
  for (const t of L.TEAMS) {
    const pt = players.teams[t] || {}, mt = model.teams[t] || {};
    teams[t] = { strength: pt.strength, offence: pt.offence, defence: pt.defence, coach: pt.coach, coachElo: pt.coachElo, pace: pt.pace, elo: mt.elo, out: pt.out || [],
      injuries: (inj.teams[t] || []).map(x => ({ id: x.id, name: x.name, pos: x.pos, status: x.status, detail: x.detail, returns: x.returns || '' })) };
  }
  const plist = Object.entries(players.players).map(([id, p]) => ({ id, ...p })).sort((a, b) => b.elo - a.elo);
  const coaches = Object.entries(players.coaches).map(([name, c]) => ({ name, ...c })).sort((a, b) => b.elo - a.elo);
  const names = {};
  for (const p of plist) names[p.id] = p.name;

  const state = { season, generated: new Date().toISOString().slice(0, 16) + 'Z', asOf: players.asOf, today, modelBuild: players.generated, teamModelBuild: model.generated,
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
main();
