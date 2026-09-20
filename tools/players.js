/* The player, coach and matchup model.
 *
 *   node nba-hub/tools/players.js          replay the box scores with the params in nba-hub/players.json,
 *                                      write ratings, the report and tonight's numbers
 *   node nba-hub/tools/players.js fit      search the params on the fit seasons first
 *
 * Every player carries two ratings, offence and defence, in Elo points for a player on the floor all
 * game. A team's strength for a game is 1500 plus the coach plus each player's ratings weighted by his
 * share of the minutes (five shares in all), so a team is exactly the sum of who plays and how much.
 * Before a game the home side gets the court, altitude and rest terms the team model fitted.
 *
 * After a final, each side's offensive efficiency (points per 100 possessions) is compared with what
 * the ratings expected. The surprise moves the offence of the players who were on the floor, by their
 * minutes, and the defence of the players they faced, the other way. The coach moves with the margin
 * surprise. So a player who plays 36 minutes of a game his team wins by more than expected gains on
 * offence if the points came, on defence if the stops came, and a garbage-time player barely moves.
 *
 * Priors: a player's first rating is his last FiveThirtyEight RAPTOR (2020-2022, by name); a player
 * with none starts as a rookie, below average. Ratings carry part way toward zero each season.
 *
 * Tonight's strength uses projected minutes: each available player's average over his last ten
 * appearances, scaled to 240, with the injury report's Out and Doubtful players removed. The report
 * shows the model three ways on the holdout: with the actual minutes (what perfect lineup knowledge
 * is worth), with who played and projected minutes (what a good injury report gets), and with the
 * previous game's lineup (no report at all), beside the team Elo on the same games.
 *
 * Seasons: box scores start in 2022. 2022 warms up, 2023-2024 fit, 2025 on hold out.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const E = require('./elo');

const DATA = path.join(L.ROOT, 'nba-hub', 'data');
const OUT = path.join(L.ROOT, 'nba-hub', 'players.json');
const MODEL = path.join(L.ROOT, 'nba-hub', 'model.json');
const FIRST = 2022, WARM_TO = 2022, FIT_TO = 2024;
const DEFAULT = { ke: 1, kc: 0.2, carryP: 0.6, carryC: 0.8, prior: 1.25, rookie: -60, clip: 15, minGames: 10, blend: 0 };
const GRID = {
  ke: [0.3, 0.4, 0.5, 0.6, 0.75, 0.9, 1, 1.25, 1.5, 2],
  kc: [0, 0.05, 0.1, 0.2, 0.3, 0.5, 1],
  carryP: [0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  carryC: [0.5, 0.7, 0.8, 0.9, 1],
  prior: [0.5, 0.75, 1, 1.25, 1.5, 2],
  rookie: [-100, -80, -60, -40, -20],
  clip: [5, 8, 10, 12, 15, 20, 30],
  minGames: [5, 8, 10, 15],
  blend: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6],           // share of the team Elo's difference in the final number
};
const PCOLS = ['game_id', 'date', 'team', 'opp', 'home', 'player_id', 'name', 'pos', 'starter', 'min', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pm', 'pts', 'dnp'];
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/\b(jr|sr|ii|iii|iv)\b/g, '').replace(/[^a-z]/g, '');
const mean = a => a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0;

/* ---------- data ---------- */
function loadBoxes() {
  const byGame = {};
  for (const f of fs.readdirSync(DATA).filter(f => /^box_\d{4}\.csv$/.test(f))) {
    const lines = fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n'); lines.shift();
    for (const l of lines) {
      const v = l.split(','); const r = {}; PCOLS.forEach((c, i) => { r[c] = v[i] === undefined ? '' : v[i]; });
      r.min = +r.min || 0; r.dnp = +r.dnp; r.starter = +r.starter;
      for (const k of ['fga', 'fta', 'orb', 'tov', 'pts']) r[k] = r[k] === '' ? 0 : +r[k];
      (byGame[r.game_id] = byGame[r.game_id] || {})[r.team] = ((byGame[r.game_id] || {})[r.team] || []).concat([r]);
    }
  }
  return byGame;
}
function loadTeamBoxes() {
  const m = {};
  for (const f of fs.readdirSync(DATA).filter(f => /^teambox_\d{4}\.jsonl$/.test(f)))
    for (const l of fs.readFileSync(path.join(DATA, f), 'utf8').trim().split('\n')) { if (!l) continue; const t = JSON.parse(l); m[t.game_id + ':' + t.team] = t.stats; }
  return m;
}
const pairN = v => { const m = /^\s*(\d+)\s*-\s*(\d+)/.exec(String(v || '')); return m ? [+m[1], +m[2]] : null; };
/* possessions and points for one side of a game: the team totals when the feed gave them, else the players summed */
function sideTotals(rows, stats) {
  let fga = 0, fta = 0, orb = 0, tov = 0, pts = 0, min = 0;
  for (const r of rows) { fga += r.fga; fta += r.fta; orb += r.orb; tov += r.tov; pts += r.pts; min += r.min; }
  if (stats) {
    const fg = pairN(stats['fieldGoalsMade-fieldGoalsAttempted']), ft = pairN(stats['freeThrowsMade-freeThrowsAttempted']);
    if (fg) fga = fg[1]; if (ft) fta = ft[1];
    if (stats.offensiveRebounds) orb = +stats.offensiveRebounds || orb;
    const t = +stats.totalTurnovers || +stats.turnovers; if (t) tov = t;
  }
  return { poss: Math.max(fga - orb + tov + 0.44 * fta, 60), pts, min: Math.max(min, 240) };
}
function loadCoaches() {
  const rows = fs.readFileSync(path.join(DATA, 'coaches.csv'), 'utf8').trim().split('\n').slice(1).map(l => { const [season, team, coach, from] = l.split(','); return { season: +season, team, coach, from: from || '' }; });
  const espn = fs.existsSync(path.join(DATA, 'coaches_espn.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'coaches_espn.json'), 'utf8')) : null;
  const last = Math.max(...rows.map(r => r.season));
  return (season, team, date) => {
    const c = rows.filter(r => r.season === season && r.team === team && r.from <= date).sort((a, b) => a.from < b.from ? 1 : -1)[0];
    if (c) return c.coach;
    if (espn && espn.teams[team] && espn.teams[team].name) return espn.teams[team].name;
    const prev = rows.filter(r => r.season === last && r.team === team).sort((a, b) => a.from < b.from ? 1 : -1)[0];
    return prev ? prev.coach : team + ' coach';
  };
}
function loadRaptor() {
  const f = path.join(DATA, 'raptor.csv');
  const by = {};
  if (!fs.existsSync(f)) return by;
  for (const l of fs.readFileSync(f, 'utf8').trim().split('\n').slice(1)) {
    const [name, season, mp, o, d] = l.split(',');
    const k = norm(name);
    if (!by[k] || +season > by[k].season) by[k] = { season: +season, mp: +mp, o: +o, d: +d };
  }
  return by;
}

/* ---------- the model ---------- */
function replay(P, ctx, mode, collect) {
  const { games, boxes, teamStats, coachOf, raptor, situP } = ctx;
  const players = {}, coaches = {}, dates = {}, seasonOf = {}, pace = {}, lastLineup = {};
  let lg = 112;
  const recs = [], upcoming = {};
  const getP = (r, season) => {
    let p = players[r.player_id];
    if (!p) {
      const rp = raptor[norm(r.name)];
      const usePrior = rp && rp.season < season + 1 && rp.mp >= 500;
      p = players[r.player_id] = { name: r.name, pos: r.pos, o: usePrior ? rp.o * P.prior * situP.scale : P.rookie / 2, d: usePrior ? rp.d * P.prior * situP.scale : P.rookie / 2,
        n: 0, mins: [], team: r.team, last: '', season, prior: usePrior ? 'raptor' : 'rookie' };
    }
    if (p.season !== season) { p.o *= P.carryP; p.d *= P.carryP; p.season = season; p.mins = p.mins.slice(-5); }
    return p;
  };
  const getC = (name, season) => {
    let c = coaches[name];
    if (!c) c = coaches[name] = { c: 0, n: 0, season, team: '' };
    if (c.season !== season) { c.c *= P.carryC; c.season = season; }
    return c;
  };
  /* strength of one side from a list of [player, minutes]; also its offence and defence and the weights */
  const strength = list => {
    const tot = list.reduce((s, x) => s + x[1], 0) || 1;
    let O = 0, D = 0, W2 = 0; const ws = [];
    for (const [p, m] of list) { const w = m / tot * 5; ws.push([p, w]); O += w * p.o; D += w * p.d; W2 += w * w; }
    return { O, D, W2, ws };
  };
  const projected = (p, starter) => p.mins.length ? mean(p.mins.slice(-P.minGames)) : (starter ? 26 : 12);
  const lineupFor = (team, rows, how, season) => {
    /* rows: this game's box rows for the team (with min); how: actual | known | naive | live */
    if (how === 'actual') return rows.filter(r => r.min > 0).map(r => [getP(r, season), r.min]);
    if (how === 'known') return rows.filter(r => r.min > 0).map(r => { const p = getP(r, season); return [p, projected(p, r.starter)]; });
    /* naive: the previous game's lineup, projected minutes */
    const prev = lastLineup[team];
    if (!prev) return rows.filter(r => r.min > 0).map(r => { const p = getP(r, season); return [p, projected(p, r.starter)]; });
    return prev.map(([p, starter]) => [p, projected(p, starter)]);
  };

  for (const g of games) {
    for (const t of [g.home, g.away]) {
      if (seasonOf[t] !== g.season) { seasonOf[t] = g.season; dates[t] = []; }
      if (pace[t] === undefined) pace[t] = 99;
    }
    const neutral = g.neutral === 1;
    const sh = E.situ(situP, dates[g.home], g.date, true, g.home, neutral), sa = E.situ(situP, dates[g.away], g.date, false, g.away, neutral);
    const ch = getC(coachOf(g.season, g.home, g.date), g.season), ca = getC(coachOf(g.season, g.away, g.date), g.season);
    ch.team = g.home; ca.team = g.away;
    const box = boxes[g.game_id];
    const expPace = (pace[g.home] + pace[g.away]) / 2;

    if (g.status !== 'final') {
      if (!collect) continue;
      const live = ctx.liveLineup(g, players, projected);
      const H = strength(live.home.list), A = strength(live.away.list);
      const own = (ch.c + H.O + H.D + sh) - (ca.c + A.O + A.D + sa);
      const td = ctx.teamDiff[g.game_id];
      const diff = td === undefined ? own : (1 - P.blend) * own + P.blend * td;
      const eh = lg + (H.O - A.D) / situP.scale + (sh - sa) / (2 * situP.scale), ea = lg + (A.O - H.D) / situP.scale - (sh - sa) / (2 * situP.scale);
      upcoming[g.game_id] = { pHome: +E.prob(diff).toFixed(4), spread: +(-diff / situP.scale * expPace / 100).toFixed(1), total: +((eh + ea) * expPace / 100).toFixed(1),
        pace: +expPace.toFixed(1), home: sideReport(g.home, H, ch, live.home), away: sideReport(g.away, A, ca, live.away) };
      continue;
    }
    if (!box || !box[g.home] || !box[g.away]) continue;      // no box score for it: nothing to learn, nothing to score
    const th = sideTotals(box[g.home], teamStats[g.game_id + ':' + g.home]), ta = sideTotals(box[g.away], teamStats[g.game_id + ':' + g.away]);
    const oh = 100 * th.pts / th.poss, oa = 100 * ta.pts / ta.poss;

    if (collect && g.season > WARM_TO) {
      const Hm = strength(lineupFor(g.home, box[g.home], mode, g.season)), Am = strength(lineupFor(g.away, box[g.away], mode, g.season));
      const own = (ch.c + Hm.O + Hm.D + sh) - (ca.c + Am.O + Am.D + sa);
      const td = ctx.teamDiff[g.game_id];
      const diff = td === undefined ? own : (1 - P.blend) * own + P.blend * td;
      const eh = lg + (Hm.O - Am.D) / situP.scale + (sh - sa) / (2 * situP.scale), ea = lg + (Am.O - Hm.D) / situP.scale - (sh - sa) / (2 * situP.scale);
      recs.push({ season: g.season, d: diff, pHome: E.prob(diff), mov: +g.home_score - +g.away_score, total: +g.home_score + +g.away_score, expTotal: (eh + ea) * expPace / 100 });
    }
    /* update with what actually happened */
    const H = strength(lineupFor(g.home, box[g.home], 'actual', g.season)), A = strength(lineupFor(g.away, box[g.away], 'actual', g.season));
    const eh = lg + (H.O - A.D) / situP.scale + (sh - sa) / (2 * situP.scale), ea = lg + (A.O - H.D) / situP.scale - (sh - sa) / (2 * situP.scale);
    const clip = x => Math.max(-P.clip, Math.min(P.clip, x));
    const surH = clip(oh - eh), surA = clip(oa - ea);
    for (const [p, w] of H.ws) { p.o += P.ke * surH * w / H.W2; p.d -= P.ke * surA * w / H.W2; }
    for (const [p, w] of A.ws) { p.o += P.ke * surA * w / A.W2; p.d -= P.ke * surH * w / A.W2; }
    ch.c += P.kc * (surH - surA); ca.c -= P.kc * (surH - surA); ch.n++; ca.n++;
    lg += 0.005 * ((oh + oa) / 2 - lg);
    pace[g.home] += 0.1 * (th.poss * 240 / th.min - pace[g.home]); pace[g.away] += 0.1 * (ta.poss * 240 / ta.min - pace[g.away]);
    for (const [t, rows] of [[g.home, box[g.home]], [g.away, box[g.away]]]) {
      const lineup = [];
      for (const r of rows) {
        const p = getP(r, g.season); p.team = t; p.last = g.date; p.pos = r.pos || p.pos;
        if (r.min > 0) { p.mins.push(r.min); if (p.mins.length > 15) p.mins.shift(); p.n++; lineup.push([p, r.starter]); }
      }
      lastLineup[t] = lineup;
      dates[t].push(g.date); if (dates[t].length > 4) dates[t].shift();
    }
  }
  return { players, coaches, pace, lg, recs, upcoming };
}
function sideReport(team, S, coach, live) {
  return { team, strength: +(E.MEAN + coach.c + S.O + S.D).toFixed(1), offence: +S.O.toFixed(1), defence: +S.D.toFixed(1), coach: { name: live.coach || '', elo: +coach.c.toFixed(1) },
    lineup: S.ws.map(([p, w]) => ({ id: p.id, name: p.name, pos: p.pos, min: +(w * 48).toFixed(0), o: +p.o.toFixed(0), d: +p.d.toFixed(0), adds: +(w * (p.o + p.d)).toFixed(1) })).sort((a, b) => b.min - a.min),
    out: live.out.map(x => ({ id: x.p.id, name: x.p.name, status: x.status, min: +x.min.toFixed(0), costs: +(x.min / 48 * (x.p.o + x.p.d)).toFixed(1) })).sort((a, b) => a.costs - b.costs) };
}

function score(recs, from, to, scale) {
  let ll = 0, n = 0, right = 0, ae = 0, at = 0;
  for (const r of recs) {
    if (r.season <= from || r.season > to) continue;
    const p = Math.min(Math.max(r.pHome, 1e-6), 1 - 1e-6), y = r.mov > 0 ? 1 : 0;
    ll -= y * Math.log(p) + (1 - y) * Math.log(1 - p); n++;
    if ((r.pHome >= 0.5) === (y === 1)) right++;
    ae += Math.abs(r.mov - r.d / scale); at += Math.abs(r.total - r.expTotal);
  }
  return n ? { games: n, logloss: +(ll / n).toFixed(5), acc: +(right / n).toFixed(4), mae: +(ae / n).toFixed(2), totalMae: +(at / n).toFixed(2) } : { games: 0 };
}

/* who is available tonight, with projected minutes */
function makeLiveLineup(ctx) {
  const inj = fs.existsSync(path.join(DATA, 'injuries.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'injuries.json'), 'utf8')) : { teams: {} };
  const ros = fs.existsSync(path.join(DATA, 'rosters_espn.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'rosters_espn.json'), 'utf8')) : null;
  const OUT_RE = /^(out|doubtful|suspended|suspension)/i;
  return (g, players, projected) => {
    const side = team => {
      const status = {}; for (const x of (inj.teams[team] || [])) status[x.id] = x.status;
      let ids;
      if (ros && ros.teams[team] && ros.teams[team].length >= 10) ids = ros.teams[team].map(a => a.id);
      else ids = Object.keys(players).filter(id => players[id].team === team);
      const list = [], out = [];
      for (const id of ids) {
        const p = players[id];
        if (!p) continue;                                           // no box score on record: not projected to play
        p.id = id;
        const m = p.mins.length ? projected(p, false) : 0;        // a player with no minutes on record is not projected to play
        if (OUT_RE.test(status[id] || '')) { if (m) out.push({ p, status: status[id], min: m }); continue; }
        if (m) list.push([p, m]);
      }
      list.sort((a, b) => b[1] - a[1]);
      const top = list.slice(0, 13);                              // a rotation is at most thirteen deep
      return { list: top, out, coach: ctx.coachOf(g.season, team, g.date) };
    };
    return { home: side(g.home), away: side(g.away) };
  };
}

function fit(ctx) {
  let P = { ...DEFAULT };
  const lossOf = p => score(replay(p, ctx, 'known', true).recs, WARM_TO, FIT_TO, ctx.situP.scale).logloss;
  let best = lossOf(P), moved = true, pass = 0;
  while (moved && pass < 5) {
    moved = false; pass++;
    for (const k of Object.keys(GRID)) for (const v of GRID[k]) {
      if (v === P[k]) continue;
      const q = { ...P, [k]: v }, l = lossOf(q);
      if (l < best - 1e-7) { best = l; P = q; moved = true; }
    }
    L.log(`fit pass ${pass}: logloss ${best.toFixed(5)} ${JSON.stringify(P)}`);
  }
  return P;
}

function main() {
  const model = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
  const situP = model.params;
  const games = L.readGames().filter(g => +g.season >= FIRST && (g.status === 'final' || g.status === 'scheduled' || g.status === 'live'));
  games.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const ctx = { games, boxes: loadBoxes(), teamStats: loadTeamBoxes(), coachOf: loadCoaches(), raptor: loadRaptor(), situP, teamDiff: {} };
  ctx.liveLineup = makeLiveLineup(ctx);
  /* the team Elo's own pre-game difference for every game, finals and the slate, for the blend and the comparison */
  const everything = L.readGames().filter(g => g.status === 'final' || g.status === 'scheduled' || g.status === 'live');
  everything.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const TE = E.replay(situP, everything, true);
  for (const r of TE.recs) ctx.teamDiff[`${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`] = r.d;
  for (const [id, u] of Object.entries(TE.upcoming)) ctx.teamDiff[id] = -u.spread * situP.scale;
  const withBox = games.filter(g => g.status === 'final' && ctx.boxes[g.game_id]).length;
  L.log(`${withBox} finals with a box score, ${Object.keys(ctx.raptor).length} RAPTOR priors`);
  if (!withBox) { L.log('no box scores yet: nothing to do'); return; }
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  let P = prev ? { ...DEFAULT, ...prev.params } : { ...DEFAULT };
  if (process.argv[2] === 'fit') P = fit(ctx);

  const report = {};
  for (const mode of ['actual', 'known', 'naive']) {
    const R = replay(P, ctx, mode, true);
    report[mode] = { fit: score(R.recs, WARM_TO, FIT_TO, situP.scale), holdout: score(R.recs, FIT_TO, 9999, situP.scale) };
  }
  /* the team Elo on the same games, for the comparison */
  const boxed = new Set(games.filter(g => g.status === 'final' && ctx.boxes[g.game_id]).map(g => g.game_id));
  const TR = TE.recs.filter(r => boxed.has(`${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`)).map(r => ({ ...r, total: 0, expTotal: 0 }));
  report.teamElo = { fit: score(TR, WARM_TO, FIT_TO, situP.scale), holdout: score(TR, FIT_TO, 9999, situP.scale) };
  delete report.teamElo.fit.totalMae; delete report.teamElo.holdout.totalMae;

  const R = replay(P, ctx, 'known', true);
  const finals = games.filter(g => g.status === 'final' && ctx.boxes[g.game_id]);
  const asOf = finals[finals.length - 1].date, season = finals[finals.length - 1].season;
  /* only differences between ratings matter to the model, so for display the league's minutes-weighted
     average player is set to zero on each side (shifting every offence or every defence by the same
     amount changes no prediction, since both lineups carry five shares) */
  { let so = 0, sd = 0, sw = 0;
    for (const p of Object.values(R.players)) if (p.last >= L.addDays(asOf, -400) && p.mins.length) { const w = mean(p.mins.slice(-P.minGames)) * p.mins.length; so += w * p.o; sd += w * p.d; sw += w; }
    if (sw) for (const p of Object.values(R.players)) { p.o -= so / sw; p.d -= sd / sw; } }
  const playersOut = {};
  for (const [id, p] of Object.entries(R.players)) if (p.n >= 5 && p.last >= L.addDays(asOf, -400))
    playersOut[id] = { name: p.name, pos: p.pos, team: p.team, o: +p.o.toFixed(1), d: +p.d.toFixed(1), elo: +(p.o + p.d).toFixed(1), min: +mean(p.mins.slice(-P.minGames)).toFixed(1), games: p.n, last: p.last, prior: p.prior };
  const coachesOut = {};
  for (const [name, c] of Object.entries(R.coaches)) if (c.n >= 10) coachesOut[name] = { team: c.team, elo: +c.c.toFixed(1), games: c.n };
  const teams = {};
  for (const t of L.TEAMS) {
    const g = { season: season + (asOf < `${season}-07-01` ? 0 : 1), home: t, away: t, date: asOf, neutral: 0 };
    const live = ctx.liveLineup(g, R.players, (p) => p.mins.length ? mean(p.mins.slice(-P.minGames)) : 0);
    const tot = live.home.list.reduce((s, x) => s + x[1], 0) || 1;
    let O = 0, D = 0; for (const [p, m] of live.home.list) { O += m / tot * 5 * p.o; D += m / tot * 5 * p.d; }
    const coach = R.coaches[live.home.coach] || { c: 0 };
    teams[t] = { strength: +(E.MEAN + coach.c + O + D).toFixed(1), offence: +O.toFixed(1), defence: +D.toFixed(1), coach: live.home.coach, coachElo: +coach.c.toFixed(1), pace: +R.pace[t].toFixed(1),
      out: live.home.out.map(x => `${x.p.name} (${x.status})`) };
  }
  const out = { name: 'NBA player model', params: P, fitSeasons: `${WARM_TO + 1}-${FIT_TO}`, holdoutSeasons: `${FIT_TO + 1}-${season}`, report, leagueEfficiency: +R.lg.toFixed(1),
    asOf, season, games: finals.length, teams, coaches: coachesOut, players: playersOut, upcoming: R.upcoming };
  const same = prev && JSON.stringify({ ...prev, generated: undefined }) === JSON.stringify({ ...out, generated: undefined });
  out.generated = same ? prev.generated : new Date().toISOString().slice(0, 16) + 'Z';
  const body = JSON.stringify(out, null, 1) + '\n';
  if (!prev || body !== fs.readFileSync(OUT, 'utf8')) fs.writeFileSync(OUT, body);
  const f = m => `${m.logloss} / ${(m.acc * 100).toFixed(1)}% / ${m.mae}`;
  L.log(`holdout (logloss / straight up / spread error): team Elo ${f(report.teamElo.holdout)} | actual minutes ${f(report.actual.holdout)} | known lineup ${f(report.known.holdout)} | previous lineup ${f(report.naive.holdout)} | totals error ${report.known.holdout.totalMae}`);
  const top = Object.values(playersOut).sort((a, b) => b.elo - a.elo).slice(0, 8).map(p => `${p.name} ${p.elo}`).join(', ');
  L.log('top players: ' + top);
  L.log('top coaches: ' + Object.entries(coachesOut).sort((a, b) => b[1].elo - a[1].elo).slice(0, 5).map(([n, c]) => `${n} ${c.elo}`).join(', '));
  L.log(`players.json ${same ? 'unchanged' : 'written'}, ${Object.keys(R.upcoming).length} upcoming`);
}
if (require.main === module) main();
module.exports = { replay, score };
