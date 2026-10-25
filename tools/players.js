/* The player, coach and matchup model.
 *
 *   node tools/players.js          replay the box scores with the params in players.json,
 *                                      write ratings, the report and tonight's numbers
 *   node tools/players.js fit      search the params on the fit seasons first
 *
 * Every player carries two ratings, offence and defence, in Elo points for a player on the floor all
 * game. A team's strength for a game is 1500 plus the coach plus each player's ratings weighted by his
 * share of the minutes (five shares in all), so a team is exactly the sum of who plays and how much.
 * Before a game the home side gets the court, altitude and rest terms the team model fitted, and a side on two days'
 * rest or less loses a little for every time zone it has crossed since its last game (TRAVEL).
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
 * Tonight's strength uses projected minutes: each available player's average over his last eight
 * appearances, filled to 240 in rotation order, with the injury report's absences removed by their return
 * dates (makeLiveLineup says the rule). The report
 * shows the model three ways on the holdout: with the actual minutes (what perfect lineup knowledge
 * is worth), with who played and projected minutes (what a good injury report gets), and with the
 * previous game's lineup (no report at all), beside the team Elo on the same games.
 *
 * Seasons: box scores start in 2022. 2022 warms up, 2023-2025 fit, 2026 held out; "research" walks forward
 * season by season (fit on the seasons before, score the season cold) and writes research.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');
const E = require('./elo');

const DATA = path.join(L.ROOT, 'data');
const OUT = path.join(L.ROOT, 'players.json');
const MODEL = path.join(L.ROOT, 'model.json');
const FIRST = 2022, WARM_TO = 2022, FIT_TO = 2025;
const DEFAULT = { ke: 0.4, kc: 0.05, carryP: 0.6, carryC: 0.5, prior: 1.25, rookie: -60, clip: 30, minGames: 8, blend: 0.1,
  pm: 0, pmClip: 15, winK: 0, shrink: 0, recency: 0, postMult: 1, wexp: 1, tz: 0 };
const GRID = {
  ke: [0.2, 0.3, 0.4, 0.5, 0.6, 0.75, 1, 1.25],
  kc: [0, 0.05, 0.1, 0.2, 0.3, 0.5],
  carryP: [0.4, 0.5, 0.6, 0.7, 0.8, 0.9],
  carryC: [0.5, 0.7, 0.9, 1],
  prior: [0.75, 1, 1.25, 1.5, 2],
  rookie: [-100, -80, -60, -40, -20],
  clip: [10, 15, 20, 30, 40],
  minGames: [5, 8, 10, 15],
  blend: [0, 0.1, 0.2, 0.3, 0.4, 0.5],           // share of the team Elo's difference in the final number
  pm: [0, 0.25, 0.5, 0.75, 1, 1.5, 2],            // Elo per point of a player's own plus-minus above his share of the margin
  pmClip: [8, 12, 15, 20, 30],
  winK: [0, 2, 4, 6, 8, 12],                      // an Elo update on the result itself, beside the efficiency one
  shrink: [0, 0.002, 0.005, 0.01, 0.02],          // per-game pull toward the player's prior
  recency: [0, 0.1, 0.2, 0.3],                    // minutes projection: weight decay per game back (0 = plain mean)
  postMult: [0.5, 0.75, 1, 1.25, 1.5],            // the efficiency update in the playoffs, times this
  wexp: [0.5, 0.75, 1, 1.25, 1.5],                // the update falls on players by minutes share to this power
  tz: [0, 2, 4, 6, 10],                           // Elo off a side per hour of time zone crossed since a game two days or less before (TZ)
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
      r.pm = r.pm === '' ? '' : +r.pm;
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
/* a side's possessions, points and minutes in one game. The points are the final score where it is given: a
   player ESPN lists with no id and no stats (a Chicago rookie in 43 games of 2025-26) would leave a sum of the
   player rows short, by up to 9 points */
function sideTotals(rows, stats, score) {
  let fga = 0, fta = 0, orb = 0, tov = 0, pts = 0, min = 0;
  for (const r of rows) { fga += r.fga; fta += r.fta; orb += r.orb; tov += r.tov; pts += r.pts; min += r.min; }
  if (score !== '' && score != null && Number.isFinite(+score) && +score > 0) pts = +score;
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
/* a new season's minutes start from a player's last five regular-season games: a playoff run's 42-48 minutes in a
   seven-man rotation would price a contender's opening week as six players and no bench */
const newSeasonMins = p => (p.reg && p.reg.length ? p.reg : p.mins).slice(-5);
/* opening weeks run faster than the season before: the first three weeks' pace over the league's pace as the season
   before ended (lgPace, which weighs its last few hundred games) was +1.33, +1.17 and +1.96 possessions in 2022-23 to
   2024-25, measured before the held-out 2025-26 (which ran +2.35) */
const EARLY_PACE = 1.5;
/* the home edge is learned as the games come, not taken fixed from the team model (60 Elo, fitted on 2008-2022):
   home teams win less than they did, and with 60 the model gave the home side 58% on average where it won 54.5-55.5%
   and the market said 55%, and expected home margins of +2.5 where they were +1.8 to +2.3. After each final at a home
   venue the edge moves HFA_K of the way toward what the margin said, about a season's worth of games deep */
const HFA_K = 0.001;
/* TRAVEL: jet lag on short rest. Each club's home time zone; a game's venue is its home club's (a neutral site's is not
   known, so a game there neither takes the term nor gives the next game a venue to have come from). A side whose
   previous game was two days or less before loses P.tz Elo for every hour between that venue's clock and this one's,
   both read on this game's date (Phoenix keeps no summer time, so from March it sits with the Pacific clubs, and a
   club that stays put over the clocks' change has crossed nothing). Walked forward on 2023-24 and 2024-25 with the
   fit choosing it from the seasons before each, it lowered the log loss and the spread error in both (README) */
const TZ = { ATL: 'America/New_York', BOS: 'America/New_York', BKN: 'America/New_York', CHA: 'America/New_York', CHI: 'America/Chicago',
  CLE: 'America/New_York', DAL: 'America/Chicago', DEN: 'America/Denver', DET: 'America/Detroit', GSW: 'America/Los_Angeles',
  HOU: 'America/Chicago', IND: 'America/Indiana/Indianapolis', LAC: 'America/Los_Angeles', LAL: 'America/Los_Angeles', MEM: 'America/Chicago',
  MIA: 'America/New_York', MIL: 'America/Chicago', MIN: 'America/Chicago', NOP: 'America/Chicago', NYK: 'America/New_York',
  OKC: 'America/Chicago', ORL: 'America/New_York', PHI: 'America/New_York', PHX: 'America/Phoenix', POR: 'America/Los_Angeles',
  SAC: 'America/Los_Angeles', SAS: 'America/Chicago', TOR: 'America/Toronto', UTA: 'America/Denver', WAS: 'America/New_York' };
const tzMemo = {};
/* a zone's hours from UTC on a date, read at 5pm UTC (morning on the West Coast, after every zone's 2am change of clocks) */
function tzHours(zone, date) {
  const k = zone + date;
  if (tzMemo[k] === undefined) {
    const name = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'shortOffset' }).formatToParts(new Date(date + 'T17:00:00Z')).find(x => x.type === 'timeZoneName').value;
    const m = /GMT([+-]\d+)(?::(\d+))?/.exec(name);
    tzMemo[k] = m ? +m[1] + Math.sign(+m[1]) * (m[2] ? +m[2] / 60 : 0) : 0;
  }
  return tzMemo[k];
}
const dayGap = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 86400000);
function replay(P, ctx, mode, collect) {
  const { games, boxes, teamStats, coachOf, raptor, situP } = ctx;
  const players = {}, coaches = {}, dates = {}, ahead = {}, seasonOf = {}, pace = {}, lastLineup = {};   // ahead: games still to play (elo.js)
  let lg = 112, lgDay = 112, lgDate = '';         // lgDay: the league's efficiency as the day began, for scoring a final
  let lgPace = 99;                                  // the league's regular-season pace, possessions per 48
  let hfa = situP.hfa;                              // the home edge in Elo, learned (HFA_K)
  /* travel: a club's last final's venue ({date, zone}, zone null at a neutral site) as the games pass, and the venues of
     its games still to play, so a game two days out reads the one before it as elo.js's ahead does for rest */
  const venue = {}, aheadVenue = {};
  const recs = [], upcoming = {};
  /* THE HISTORY (ctx.hist, which only main sets, on the replay it publishes): each player's, coach's and club's rating
     after every final from ctx.hist.from on, each season's ladder as the season ended, and each rating as it entered
     the season the replay ends in, for the page's rating-over-time windows (publish.js turns them into history.json).
     A player's and a club's rating is centred as main centres today's, on the league's average player as that day
     ended (hsShift), so a line moves with the player or the club and not with the league's average, and a point once
     written never changes. It records and never changes a number the model uses */
  const HS = collect && ctx.hist ? ctx.hist : null;
  if (HS) Object.assign(HS, { players: {}, coaches: {}, teams: {}, games: [], curves: {}, shifts: [], start: { players: {}, coaches: {}, teams: {} }, now: { teams: {} } });
  let hsSeason = null, hsDay = null, hsDaySeason = null, hsPend = []; const hsFirst = {}, hsTeamSeason = {}, hsRot = {};
  /* a club's strength in the history is its recent rotation's, not one night's lineup: everyone who played in its last
     five games of the season and plays for it still, at projected minutes filled to 240 as today's strength is. One
     night's lineup would move a club 50 points for the stars who sat a blowout or a back to back */
  const rotStrength = (t, coach) => {
    const ids = new Set(); for (const list of (hsRot[t] || { games: [] }).games) for (const id of list) ids.add(id);
    const X = strength(fill240([...ids].map(id => players[id]).filter(p => p && p.team === t).map(p => [p, projected(p, false)])));
    return E.MEAN + coach.c + X.O + X.D;
  };
  const getP = (r, season) => {
    let p = players[r.player_id];
    if (!p) {
      const rp = raptor[norm(r.name)];
      const usePrior = rp && rp.season < season + 1 && rp.mp >= 500;
      const o0 = usePrior ? rp.o * P.prior * situP.scale : P.rookie / 2, d0 = usePrior ? rp.d * P.prior * situP.scale : P.rookie / 2;
      p = players[r.player_id] = { name: r.name, pos: r.pos, o: o0, d: d0, o0, d0,
        n: 0, mins: [], team: r.team, last: '', season, prior: usePrior ? 'raptor' : 'rookie' };
      if (HS) HS.start.players[r.player_id] = [season, o0 + d0];
    }
    if (p.season !== season) { p.o *= P.carryP; p.d *= P.carryP; p.season = season; p.mins = newSeasonMins(p); if (HS) HS.start.players[r.player_id] = [season, p.o + p.d]; }
    return p;
  };
  const getC = (name, season) => {
    let c = coaches[name];
    if (!c) { c = coaches[name] = { c: 0, n: 0, season, team: '' }; if (HS) HS.start.coaches[name] = [season, 0]; }
    if (c.season !== season) { c.c *= P.carryC; c.season = season; if (HS) HS.start.coaches[name] = [season, c.c]; }
    return c;
  };
  /* strength of one side from a list of [player, minutes]; also its offence and defence and the weights */
  const strength = list => {
    const tot = list.reduce((s, x) => s + x[1], 0) || 1;
    let O = 0, D = 0, W2 = 0; const ws = [];
    for (const [p, m] of list) { const w = m / tot * 5; const u = Math.pow(w, P.wexp); ws.push([p, w, u]); O += w * p.o; D += w * p.d; W2 += w * u; }
    return { O, D, W2, ws };                        // W2 = sum of w*u, so a team-wide surprise of x moves the team's sum by exactly x
  };
  const projected = (p, starter) => {
    if (!p.mins.length) return starter ? 26 : 12;
    const m = p.mins.slice(-P.minGames);
    if (!P.recency) return mean(m);
    let sw = 0, sm = 0;
    for (let i = 0; i < m.length; i++) { const w = Math.pow(1 - P.recency, m.length - 1 - i); sw += w; sm += w * m[i]; }
    return sm / sw;
  };
  const lineupFor = (team, rows, how, season) => {
    /* rows: this game's box rows for the team (with min); how: actual | known | naive | live */
    if (how === 'actual') return rows.filter(r => r.min > 0).map(r => [getP(r, season), r.min]);
    if (how === 'known') return rows.filter(r => r.min > 0).map(r => { const p = getP(r, season); return [p, projected(p, r.starter)]; });
    /* naive: the previous game's lineup, projected minutes */
    const prev = lastLineup[team];
    if (!prev) return rows.filter(r => r.min > 0).map(r => { const p = getP(r, season); return [p, projected(p, r.starter)]; });
    return prev.map(([p, starter]) => [p, projected(p, starter)]);
  };

  /* the display shift as a day ended: the minutes-weighted average player's rating, as main finds today's, every player
     read as he enters the day's season (one not carried into it yet carried, with his new season's minutes) */
  const hsShift = (date, season) => {
    let sv = 0, sw = 0; const from = L.addDays(date, -400);
    for (const p of Object.values(players)) {
      if (!(p.last >= from)) continue;
      const turn = p.season < season, mins = turn ? newSeasonMins(p) : p.mins;
      if (!mins.length) continue;
      const w = mean(mins.slice(-P.minGames)) * mins.length; sv += w * (turn ? (p.o + p.d) * P.carryP : p.o + p.d); sw += w;
    }
    return sw ? sv / sw : 0;
  };
  /* a day's points, centred once the day's games are all in */
  const hsFlush = () => {
    if (hsDay === null) return;
    const sh = hsShift(hsDay, hsDaySeason); HS.shifts.push([hsDay, sh]);
    for (const [kind, key, d, v, ref] of hsPend) (HS[kind][key] = HS[kind][key] || []).push([d, v - (kind === 'teams' ? 5 * sh : sh), ref]);
    hsPend = []; hsDay = null;
  };
  /* a finished season's ladder, as publish.js draws today's: players with twenty games or more at ten minutes or more who
     played in it, centred as its last day ended, and every coach with ten games or more */
  const hsCurve = S0 => {
    const stat = vals => { const n = vals.length, m = n ? vals.reduce((a, x) => a + x, 0) / n : 0; return { n, mean: m, sd: n > 1 ? Math.sqrt(vals.reduce((a, x) => a + (x - m) ** 2, 0) / n) : 0 }; };
    const pl = Object.values(players).filter(p => p.last >= (hsFirst[S0] || '9') && p.n >= 20 && mean(p.mins.slice(-P.minGames)) >= 10);
    const sh = pl.length ? hsShift(pl.reduce((m, p) => p.last > m ? p.last : m, ''), S0) : 0;
    HS.curves[S0] = { p: stat(pl.map(p => p.o + p.d - sh)), c: stat(Object.values(coaches).filter(c => c.n >= 10).map(c => c.c)) };
  };
  for (const g of games) {
    if (HS) { if (hsDay !== null && g.date !== hsDay) hsFlush();
      if (hsSeason !== null && g.season > hsSeason) hsCurve(hsSeason);
      if (hsSeason === null || g.season > hsSeason) hsSeason = g.season; }
    if (g.date !== lgDate) { lgDay = lg; lgDate = g.date; }
    /* a club's pace starts each season at the league's regular-season pace plus the opening weeks' bump: carried
       over, it was the club's last ten games, a playoff run's slow games included, so a new season's totals came out
       5 to 7 points under the actual totals and the posted lines */
    for (const t of [g.home, g.away]) {
      if (pace[t] === undefined) pace[t] = 99;
      if (seasonOf[t] !== g.season) { if (seasonOf[t] !== undefined) pace[t] = lgPace + EARLY_PACE; seasonOf[t] = g.season; dates[t] = []; ahead[t] = []; aheadVenue[t] = []; }
    }
    const neutral = g.neutral === 1;
    const sd = t => g.status === 'final' ? dates[t] : dates[t].concat(ahead[t]).sort().slice(-4);
    const SP = { ...situP, hfa };
    const vz = neutral ? null : TZ[g.home] || null;
    const lag = t => {
      if (!P.tz || vz == null) return 0;
      let v = venue[t];
      if (g.status !== 'final') for (const a of aheadVenue[t]) if (a.date < g.date && (!v || a.date >= v.date)) v = a;
      if (!v || v.zone == null || dayGap(v.date, g.date) > 2) return 0;
      return P.tz * Math.abs(tzHours(vz, g.date) - tzHours(v.zone, g.date));
    };
    const sh = E.situ(SP, sd(g.home), g.date, true, g.home, neutral) - lag(g.home), sa = E.situ(SP, sd(g.away), g.date, false, g.away, neutral) - lag(g.away);
    const chN = coachOf(g.season, g.home, g.date), caN = coachOf(g.season, g.away, g.date);
    const ch = getC(chN, g.season), ca = getC(caN, g.season);
    ch.team = g.home; ca.team = g.away;
    const box = boxes[g.game_id];
    const expPace = (pace[g.home] + pace[g.away]) / 2;

    if (g.status !== 'final') {
      if (g.type !== 'PRE') for (const t of [g.home, g.away]) { ahead[t].push(g.date); aheadVenue[t].push({ date: g.date, zone: vz }); }   // its rest and travel terms are read above
      if (!collect) continue;
      /* the first game of a new season rolls every player over once, as a final would have done one by one:
         carried part way toward zero, minutes history trimmed. Without it the opening slate would be priced on
         last June's ratings; done before any lineup is chosen, so a card and the Teams tab see the same players */
      for (const [id, p] of Object.entries(players)) if (p.season < g.season) { p.o *= P.carryP; p.d *= P.carryP; p.season = g.season; p.mins = newSeasonMins(p); if (HS) HS.start.players[id] = [g.season, p.o + p.d]; }
      /* a club yet to play this season starts at its last rotation, carried (its first final replaces it with that
         game's players) */
      if (HS) for (const [t, c] of [[g.home, ch], [g.away, ca]]) if (hsTeamSeason[t] !== g.season && hsRot[t] && !(HS.start.teams[t] && HS.start.teams[t][0] === g.season)) HS.start.teams[t] = [g.season, rotStrength(t, c)];
      const live = ctx.liveLineup(g, players, projected, getP);
      const H = strength(live.home.list), A = strength(live.away.list);
      const own = (ch.c + H.O + H.D + sh) - (ca.c + A.O + A.D + sa);
      const td = ctx.teamDiff[g.game_id];
      const diff = td === undefined ? own : (1 - P.blend) * own + P.blend * td;
      const eh = lg + (H.O - A.D) / situP.scale + (sh - sa) / (2 * situP.scale), ea = lg + (A.O - H.D) / situP.scale - (sh - sa) / (2 * situP.scale);
      upcoming[g.game_id] = { pHome: +E.prob(diff).toFixed(4), spread: +(-diff / situP.scale * expPace / 100).toFixed(1), total: +((eh + ea) * expPace / 100).toFixed(1),
        pace: +expPace.toFixed(1), home: sideReport(g.home, H, ch, live.home), away: sideReport(g.away, A, ca, live.away) };
      continue;
    }
    for (const t of [g.home, g.away]) venue[t] = { date: g.date, zone: vz };   // where it was played is known with or without a box score
    if (!box || !box[g.home] || !box[g.away]) continue;      // no box score for it: nothing to learn, nothing to score
    const th = sideTotals(box[g.home], teamStats[g.game_id + ':' + g.home], g.home_score), ta = sideTotals(box[g.away], teamStats[g.game_id + ':' + g.away], g.away_score);
    const oh = 100 * th.pts / th.poss, oa = 100 * ta.pts / ta.poss;

    if (collect && g.season > WARM_TO) {
      const Hm = strength(lineupFor(g.home, box[g.home], mode, g.season)), Am = strength(lineupFor(g.away, box[g.away], mode, g.season));
      /* a club's start: its first game's players as they took the floor, carried into the season */
      if (HS) for (const [t, c] of [[g.home, ch], [g.away, ca]]) if (hsTeamSeason[t] !== g.season) {
        hsTeamSeason[t] = g.season; const X = strength(fill240(lineupFor(t, box[t], 'known', g.season))); HS.start.teams[t] = [g.season, E.MEAN + c.c + X.O + X.D]; }
      const own = (ch.c + Hm.O + Hm.D + sh) - (ca.c + Am.O + Am.D + sa);
      const td = ctx.teamDiff[g.game_id];
      const diff = td === undefined ? own : (1 - P.blend) * own + P.blend * td;
      /* the expected total is scored on the league's efficiency before the day's games: a same-day final earlier in
         the list may have tipped later (win chances and spreads never read lg) */
      const eh = lgDay + (Hm.O - Am.D) / situP.scale + (sh - sa) / (2 * situP.scale), ea = lgDay + (Am.O - Hm.D) / situP.scale - (sh - sa) / (2 * situP.scale);
      recs.push({ season: g.season, d: diff, pHome: E.prob(diff), spread: -diff / situP.scale * expPace / 100, mov: +g.home_score - +g.away_score, total: +g.home_score + +g.away_score, expTotal: (eh + ea) * expPace / 100 });
    }
    /* update with what actually happened */
    const H = strength(lineupFor(g.home, box[g.home], 'actual', g.season)), A = strength(lineupFor(g.away, box[g.away], 'actual', g.season));
    const eh = lg + (H.O - A.D) / situP.scale + (sh - sa) / (2 * situP.scale), ea = lg + (A.O - H.D) / situP.scale - (sh - sa) / (2 * situP.scale);
    const clip = x => Math.max(-P.clip, Math.min(P.clip, x));
    const surH = clip(oh - eh), surA = clip(oa - ea);
    const ke = P.ke * (g.type === 'POST' ? P.postMult : 1);
    /* the result itself, beside the efficiency: the win surprise in Elo, split over both sides of the ball */
    const mov = +g.home_score - +g.away_score;
    const dH = (E.MEAN + ch.c + H.O + H.D + sh) - (E.MEAN + ca.c + A.O + A.D + sa);
    const winSur = P.winK ? P.winK * ((mov > 0 ? 1 : 0) - E.prob(dH)) : 0;
    if (!neutral) hfa += HFA_K * (mov * situP.scale - dH);
    for (const [p, w, u] of H.ws) { p.o += (ke * surH + winSur / 2) * u / H.W2; p.d += (-ke * surA + winSur / 2) * u / H.W2; }
    for (const [p, w, u] of A.ws) { p.o += (ke * surA - winSur / 2) * u / A.W2; p.d += (-ke * surH - winSur / 2) * u / A.W2; }
    ch.c += P.kc * (surH - surA); ca.c -= P.kc * (surH - surA); ch.n++; ca.n++;
    /* each player's own plus-minus against his share of the team's margin: tells teammates apart */
    if (P.pm) for (const [t, rows, sign] of [[g.home, box[g.home], 1], [g.away, box[g.away], -1]]) {
      const M = sign * mov;
      const tot = rows.reduce((s, r) => s + r.min, 0) || 240;
      for (const r of rows) {
        if (r.min <= 0 || r.pm === '' || r.pm === undefined) continue;
        const p = getP(r, g.season);
        const s = Math.max(-P.pmClip, Math.min(P.pmClip, (+r.pm || 0) - M * r.min / (tot / 5)));
        p.o += P.pm * s / 2; p.d += P.pm * s / 2;
      }
    }
    if (P.shrink) for (const rows of [box[g.home], box[g.away]]) for (const r of rows) { if (r.min <= 0) continue; const p = getP(r, g.season); p.o += P.shrink * (p.o0 - p.o); p.d += P.shrink * (p.d0 - p.d); }
    lg += 0.005 * ((oh + oa) / 2 - lg);
    pace[g.home] += 0.1 * (th.poss * 240 / th.min - pace[g.home]); pace[g.away] += 0.1 * (ta.poss * 240 / ta.min - pace[g.away]);
    if (g.type !== 'POST') lgPace += 0.005 * ((th.poss * 240 / th.min + ta.poss * 240 / ta.min) / 2 - lgPace);
    for (const [t, rows] of [[g.home, box[g.home]], [g.away, box[g.away]]]) {
      const lineup = [];
      for (const r of rows) {
        const p = getP(r, g.season); p.team = t; p.last = g.date; p.pos = r.pos || p.pos;
        if (r.min > 0) { p.mins.push(r.min); if (p.mins.length > 15) p.mins.shift(); p.n++; lineup.push([p, r.starter]);
          if (g.type !== 'POST') { (p.reg = p.reg || []).push(r.min); if (p.reg.length > 15) p.reg.shift(); } }
      }
      lastLineup[t] = lineup;
      dates[t].push(g.date); if (dates[t].length > 4) dates[t].shift();
    }
    if (HS) {
      if (!hsFirst[g.season] || g.date < hsFirst[g.season]) hsFirst[g.season] = g.date;
      if (g.date >= HS.from) {
        /* each player who played, his coach and his club (its recent rotation), after the game;
           the reference is the game's place in HS.games, twice over, plus one for the home side */
        const ref = HS.games.push(g.game_id) - 1;
        hsDay = g.date; hsDaySeason = g.season;
        for (const [t, rows, home, c, cn] of [[g.home, box[g.home], 1, ch, chN], [g.away, box[g.away], 0, ca, caN]]) {
          const played = [];
          for (const r of rows) if (r.min > 0) { const p = players[r.player_id]; hsPend.push(['players', r.player_id, g.date, p.o + p.d, ref * 2 + home]); played.push(r.player_id); }
          if (!hsRot[t] || hsRot[t].season !== g.season) hsRot[t] = { season: g.season, games: [] };
          hsRot[t].games.push(played); if (hsRot[t].games.length > 5) hsRot[t].games.shift();
          hsPend.push(['teams', t, g.date, rotStrength(t, c), ref * 2 + home]);
          (HS.coaches[cn] = HS.coaches[cn] || []).push([g.date, c.c, ref * 2 + home]);   // a coach's rating needs no centring
        }
      }
    }
  }
  /* the season the replay ends in, the shift its starts are centred on (as its first day of finals ended; none yet in
     the preseason, when main's own is used), and each club's rotation as it stands with its coach today, its last
     point: a club yet to play this season stands at its last rotation, carried */
  if (HS) {
    hsFlush(); HS.season = hsSeason;
    const first = HS.shifts.find(([d]) => hsFirst[hsSeason] && d === hsFirst[hsSeason]);
    HS.startShift = first ? first[1] : null;
    for (const t of Object.keys(hsRot)) HS.now.teams[t] = rotStrength(t, coaches[coachOf(hsSeason, t, '9999-12-31')] || { c: 0 });
  }
  return { players, coaches, pace, lg, hfa, recs, upcoming, getP };
}
/* The history as players.json carries it: the points already centred on their own days (replay), the starts of the
   season the replay ends in centred as its first day of finals ended (or as today, in the preseason), each club's last
   point centred on today's shift, which main computes, and the day-by-day shifts themselves, so a point can be held to
   the rating it was. Only the players the file lists; every coach and club */
function historyOut(HS, shift, playersOut) {
  if (!HS) return null;
  const season = HS.season, r1 = v => +v.toFixed(1);
  const day = d => Math.round((Date.parse(d + 'T12:00:00Z') - Date.parse(HS.from + 'T12:00:00Z')) / 86400000);   // days from the first
  const pts = (series, keep) => Object.fromEntries(Object.entries(series).filter(([k]) => keep(k)).map(([k, list]) => [k, list.map(([d, v, ref]) => [day(d), r1(v), ref])]));
  const ss = HS.startShift === null || HS.startShift === undefined ? shift : HS.startShift;
  const starts = (st, keep, sh) => Object.fromEntries(Object.entries(st).filter(([k, [s0]]) => s0 === season && keep(k)).map(([k, [, v]]) => [k, r1(v - sh)]));
  const curve = c => ({ n: c.n, mean: +c.mean.toFixed(3), sd: +c.sd.toFixed(3) });
  const isP = id => !!playersOut[id], any = () => true;
  return { from: HS.from, season, games: HS.games,
    curves: Object.fromEntries(Object.entries(HS.curves).filter(([s0]) => +s0 < season && +s0 >= season - 1).map(([s0, c]) => [s0, { p: curve(c.p), c: curve(c.c) }])),
    shift: +shift.toFixed(3), shifts: HS.shifts.filter(([d]) => d >= HS.from).map(([d, v]) => [day(d), +v.toFixed(3)]),
    players: pts(HS.players, isP), coaches: pts(HS.coaches, any), teams: pts(HS.teams, any),
    start: { players: starts(HS.start.players, isP, ss), coaches: starts(HS.start.coaches, any, 0), teams: starts(HS.start.teams, any, 5 * ss) },
    now: { teams: Object.fromEntries(Object.entries(HS.now.teams).map(([t, v]) => [t, r1(v - 5 * shift)])) } };
}
/* a list of [player, projected minutes] filled into a game's 240 minutes in rotation order, as makeLiveLineup fills
   today's: the longest first, each given his minutes until they run out, a player left under 4 dropped */
function fill240(list) {
  const top = []; let left = 240;
  for (const [p, m] of [...list].sort((a, b) => b[1] - a[1])) { if (left <= 0) break; const give = Math.min(m, left); if (give >= 4) top.push([p, give]); left -= give; }
  return top;
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

/* who is available for a game, with projected minutes.
   ESPN's NBA report says only Out or Day-To-Day, with a return date, so a listed player is out for a game before his
   return date, and an Out player for the report's own day whatever it says; with no return date, Out is out. A
   suspension is out. A player on two clubs' rosters (one kept from an earlier read, see fetch_box.js) belongs to the
   later read. A player on a roster with no game on record yet (a rookie, a signing from abroad) plays at his prior,
   the rookie rating or RAPTOR's, for DEBUT_MIN minutes, as the backtested lineups do */
const DEBUT_MIN = 12;
function makeLiveLineup(ctx) {
  const inj = fs.existsSync(path.join(DATA, 'injuries.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'injuries.json'), 'utf8')) : { teams: {} };
  const ros = fs.existsSync(path.join(DATA, 'rosters_espn.json')) ? JSON.parse(fs.readFileSync(path.join(DATA, 'rosters_espn.json'), 'utf8')) : null;
  const OUT = /^out/i, SUSP = /^(suspended|suspension)/i;
  const owner = {}, named = {};
  if (ros) { const at = t => (ros.asOf && ros.asOf[t]) || ros.date || '';
    for (const [t, list] of Object.entries(ros.teams || {})) for (const a of list || []) { if (!a.id) continue; named[a.id] = a; if (owner[a.id] === undefined || at(t) > at(owner[a.id])) owner[a.id] = t; } }
  return (g, players, projected, getP) => {
    const isOut = x => { const s = x.status || ''; if (SUSP.test(s)) return true;
      return x.returns ? g.date < x.returns || (OUT.test(s) && g.date <= (inj.date || '')) : OUT.test(s); };
    const side = team => {
      const status = {}; for (const x of (inj.teams[team] || [])) if (isOut(x)) status[x.id] = x.status;
      let ids;
      if (ros && ros.teams[team] && ros.teams[team].length >= 10) ids = ros.teams[team].map(a => a.id).filter(id => owner[id] === team);
      else ids = Object.keys(players).filter(id => players[id].team === team);
      const list = [], out = [];
      for (const id of ids) {
        let p = players[id];
        if (!p && getP && named[id]) p = getP({ player_id: id, name: named[id].name, pos: named[id].pos, team }, g.season);
        if (!p) continue;
        p.id = id;
        /* a player with minutes is projected from them; one with no game on record yet gets DEBUT_MIN; one on record
           with no minutes (only DNPs) is not projected to play. A debutant out is not listed among the absences: he
           costs the side nothing it would have had */
        const debut = !p.mins.length && !p.last;
        const m = p.mins.length ? projected(p, false) : debut ? DEBUT_MIN : 0;
        if (status[id]) { if (m && !debut) out.push({ p, status: status[id], min: m }); continue; }
        if (m) list.push([p, m]);
      }
      list.sort((a, b) => b[1] - a[1]);
      /* fill the game's 240 minutes in rotation order: each player gets his projected minutes until they run
         out, so the starters keep their real workload and a long summer roster's end of bench drops off
         (spreading 240 over thirteen projections squeezed a 36-minute star to 25) */
      const top = []; let left = 240;
      for (const [p, m] of list) { if (left <= 0) break; const give = Math.min(m, left); if (give >= 4) top.push([p, give]); left -= give; }
      return { list: top, out, coach: ctx.coachOf(g.season, team, g.date) };
    };
    return { home: side(g.home), away: side(g.away) };
  };
}

function fit(ctx, from = WARM_TO, to = FIT_TO, start = DEFAULT, passes = 5) {
  let P = { ...start };
  const lossOf = p => score(replay(p, ctx, 'known', true).recs, from, to, ctx.situP.scale).logloss;
  let best = lossOf(P), moved = true, pass = 0;
  while (moved && pass < passes) {
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

/* Walk forward: for each season from 2024 on, fit on the seasons before it and score it cold. Then the
   ablations: the params fitted on everything but the last season, with each feature switched off in turn. */
function research(ctx) {
  /* the finished seasons only: a season with games still to play is not a fold (in October it is a few weeks of games,
     and scoring on it would move the final fit onto the held-out season); in the summer every season is finished */
  const toPlay = ctx.games.filter(g => g.status !== 'final').map(g => g.season), inPlay = toPlay.length ? Math.max(...toPlay) : Infinity;
  const seasons = [...new Set(ctx.games.filter(g => g.status === 'final' && ctx.boxes[g.game_id] && g.season < inPlay).map(g => g.season))].sort();
  const folds = [];
  for (const S of seasons) {
    if (S <= WARM_TO + 1) continue;
    L.log(`fold ${S}: fitting on ${WARM_TO + 1}-${S - 1}`);
    const P = fit(ctx, WARM_TO, S - 1, DEFAULT, 3);
    const fold = { season: S, params: P };
    for (const mode of ['actual', 'known', 'naive']) fold[mode] = score(replay(P, ctx, mode, true).recs, S - 1, S, ctx.situP.scale);
    fold.teamElo = score(ctx.teamRecs.filter(r => r.season === S), S - 1, S, ctx.situP.scale); delete fold.teamElo.totalMae;
    folds.push(fold);
    L.log(`fold ${S}: team Elo ${fold.teamElo.logloss} / ${(fold.teamElo.acc * 100).toFixed(1)}% | known ${fold.known.logloss} / ${(fold.known.acc * 100).toFixed(1)}% / ${fold.known.mae}`);
  }
  const last = seasons[seasons.length - 1];
  const P = fit(ctx, WARM_TO, last - 1, DEFAULT, 4);
  const base = score(replay(P, ctx, 'known', true).recs, last - 1, last, ctx.situP.scale);
  const ablations = { full: base };
  const off = { pm: 0, winK: 0, shrink: 0, recency: 0, postMult: 1, wexp: 1, kc: 0, blend: 0, prior: 0, rookie: 0, tz: 0 };
  for (const [k, v] of Object.entries(off)) {
    if (P[k] === v) { ablations['without ' + k] = 'not used'; continue; }
    ablations['without ' + k] = score(replay({ ...P, [k]: v }, ctx, 'known', true).recs, last - 1, last, ctx.situP.scale);
  }
  return { folds, finalFit: `${WARM_TO + 1}-${last - 1}`, finalParams: P, ablationsOn: last, ablations };
}

function main() {
  const model = JSON.parse(fs.readFileSync(MODEL, 'utf8'));
  const situP = model.params;
  const games = L.readGames().filter(g => +g.season >= FIRST && ((g.status === 'final' && g.type !== 'PRE') || g.status === 'scheduled' || g.status === 'live'));
  games.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const ctx = { games, boxes: loadBoxes(), teamStats: loadTeamBoxes(), coachOf: loadCoaches(), raptor: loadRaptor(), situP, teamDiff: {} };
  ctx.liveLineup = makeLiveLineup(ctx);
  /* the team Elo's own pre-game difference for every game, finals and the slate, for the blend and the comparison */
  const everything = L.readGames().filter(g => (g.status === 'final' && g.type !== 'PRE') || g.status === 'scheduled' || g.status === 'live');
  everything.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const TE = E.replay(situP, everything, true);
  ctx.teamRecs = TE.recs.map(r => ({ ...r, total: 0, expTotal: 0 }));
  for (const r of TE.recs) ctx.teamDiff[`${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`] = r.d;
  for (const [id, u] of Object.entries(TE.upcoming)) ctx.teamDiff[id] = -u.spread * situP.scale;
  const withBox = games.filter(g => g.status === 'final' && ctx.boxes[g.game_id]).length;
  L.log(`${withBox} finals with a box score, ${Object.keys(ctx.raptor).length} RAPTOR priors`);
  if (!withBox) { L.log('no box scores yet: nothing to do'); return; }
  const prev = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : null;
  let P = prev ? { ...DEFAULT, ...prev.params } : { ...DEFAULT };
  if (process.argv[2] === 'research') {
    const R = research(ctx);
    fs.writeFileSync(path.join(L.ROOT, 'research.json'), JSON.stringify(R, null, 1) + '\n');
    L.log('research.json written'); P = R.finalParams;
  }
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

  const finals = games.filter(g => g.status === 'final' && ctx.boxes[g.game_id]);
  const asOf = finals[finals.length - 1].date, season = finals[finals.length - 1].season;
  /* the history runs from the first final of the season before the one the replay ends in: the season of the last final,
     or the next one once its schedule is out (the preseason), into which the replay has already carried every rating */
  const hseason = games.reduce((m, g) => Math.max(m, g.season), season);
  ctx.hist = { from: (finals.find(g => g.season >= hseason - 1) || finals[0]).date };
  const R = replay(P, ctx, 'known', true);
  const HS = ctx.hist; ctx.hist = null;
  /* only differences between ratings matter to the model, so for display the league's minutes-weighted
     average player is set to zero on each side (shifting every offence or every defence by the same
     amount changes no prediction, since both lineups carry five shares) */
  let shiftP = 0;
  { let so = 0, sd = 0, sw = 0;
    for (const p of Object.values(R.players)) if (p.last >= L.addDays(asOf, -400) && p.mins.length) { const w = mean(p.mins.slice(-P.minGames)) * p.mins.length; so += w * p.o; sd += w * p.d; sw += w; }
    if (sw) {
      const mo = so / sw, md = sd / sw; shiftP = mo + md;
      for (const p of Object.values(R.players)) { p.o -= mo; p.d -= md; }
      /* the slate was priced before this shift: move its displayed levels by the same amount so a card and the
         Teams tab agree (a difference between two sides, and so every chance and spread, is unchanged) */
      for (const u of Object.values(R.upcoming)) for (const side of [u.home, u.away]) {
        side.offence = +(side.offence - 5 * mo).toFixed(1); side.defence = +(side.defence - 5 * md).toFixed(1); side.strength = +(side.strength - 5 * (mo + md)).toFixed(1);
        for (const x of side.lineup) { const w = x.min / 48; x.o = Math.round(x.o - mo); x.d = Math.round(x.d - md); x.adds = +(x.adds - w * (mo + md)).toFixed(1); }
        for (const x of side.out) x.costs = +(x.costs - x.min / 48 * (mo + md)).toFixed(1);
      }
    } }
  const playersOut = {};
  for (const [id, p] of Object.entries(R.players)) if (p.n >= 5 && p.last >= L.addDays(asOf, -400))
    playersOut[id] = { name: p.name, pos: p.pos, team: p.team, o: +p.o.toFixed(1), d: +p.d.toFixed(1), elo: +(p.o + p.d).toFixed(1), min: +mean(p.mins.slice(-P.minGames)).toFixed(1), games: p.n, last: p.last, prior: p.prior };
  const coachesOut = {};
  for (const [name, c] of Object.entries(R.coaches)) if (c.n >= 10) coachesOut[name] = { team: c.team, elo: +c.c.toFixed(1), games: c.n };
  const teams = {};
  for (const t of L.TEAMS) {
    const today = L.etDate(new Date());
    const g = { season: L.seasonOf(today), home: t, away: t, date: today, neutral: 0 };   // today's coach and roster, the season the slate is in
    const live = ctx.liveLineup(g, R.players, (p) => p.mins.length ? mean(p.mins.slice(-P.minGames)) : 0, R.getP);
    const tot = live.home.list.reduce((s, x) => s + x[1], 0) || 1;
    let O = 0, D = 0; for (const [p, m] of live.home.list) { O += m / tot * 5 * p.o; D += m / tot * 5 * p.d; }
    const coach = R.coaches[live.home.coach] || { c: 0 };
    teams[t] = { strength: +(E.MEAN + coach.c + O + D).toFixed(1), offence: +O.toFixed(1), defence: +D.toFixed(1), coach: live.home.coach, coachElo: +coach.c.toFixed(1), coachGames: coach.n || 0, pace: +R.pace[t].toFixed(1),
      out: live.home.out.map(x => `${x.p.name} (${x.status})`) };
  }
  const out = { name: 'NBA player model', params: P, fitSeasons: `${WARM_TO + 1}-${FIT_TO}`, holdoutSeasons: `${FIT_TO + 1}-${season}`, report, leagueEfficiency: +R.lg.toFixed(1), homeEdge: +R.hfa.toFixed(1),
    asOf, season, games: finals.length, teams, coaches: coachesOut, players: playersOut, upcoming: R.upcoming, history: historyOut(HS, shiftP, playersOut) };
  const same = prev && JSON.stringify({ ...prev, generated: undefined }) === JSON.stringify({ ...out, generated: undefined });
  out.generated = same ? prev.generated : new Date().toISOString().slice(0, 16) + 'Z';
  /* the history one series a line, so a run's change to it is the lines of those who played */
  const H = out.history, block = (k, v) => ['players', 'coaches', 'teams'].includes(k) && v && typeof v === 'object'
    ? '{' + Object.entries(v).map(([id, ser]) => `\n   ${JSON.stringify(id)}: ${JSON.stringify(ser)}`).join(',') + '\n  }' : JSON.stringify(v);
  const histText = H ? '{' + Object.entries(H).map(([k, v]) => `\n  ${JSON.stringify(k)}: ${block(k, v)}`).join(',') + '\n }' : 'null';
  const body = JSON.stringify({ ...out, history: '\u0000HISTORY\u0000' }, null, 1).replace('"\\u0000HISTORY\\u0000"', () => histText) + '\n';
  if (!prev || body !== fs.readFileSync(OUT, 'utf8')) fs.writeFileSync(OUT, body);
  logPredictions(games, R.upcoming, ctx);
  const f = m => `${m.logloss} / ${(m.acc * 100).toFixed(1)}% / ${m.mae}`;
  L.log(`holdout (logloss / straight up / spread error): team Elo ${f(report.teamElo.holdout)} | actual minutes ${f(report.actual.holdout)} | known lineup ${f(report.known.holdout)} | previous lineup ${f(report.naive.holdout)} | totals error ${report.known.holdout.totalMae}`);
  const top = Object.values(playersOut).sort((a, b) => b.elo - a.elo).slice(0, 8).map(p => `${p.name} ${p.elo}`).join(', ');
  L.log('top players: ' + top);
  L.log('top coaches: ' + Object.entries(coachesOut).sort((a, b) => b[1].elo - a[1].elo).slice(0, 5).map(([n, c]) => `${n} ${c.elo}`).join(', '));
  L.log(`players.json ${same ? 'unchanged' : 'written'}, ${Object.keys(R.upcoming).length} upcoming`);
}
/* data/predictions.csv: the model's number on each game as published before it was played,
   so the record is what the site showed and not a replay. A game not yet final is rewritten each run
   (the last pre-game number wins); a final's row is left alone. The market line stored is the one the
   games table carried at the time. */
function logPredictions(games, upcoming, ctx) {
  const f = path.join(DATA, 'predictions.csv');
  const head = 'game_id,date,away,home,pHome,spread,total,team_pHome,home_line,total_line,logged';
  const rows = new Map();
  if (fs.existsSync(f)) for (const l of fs.readFileSync(f, 'utf8').trim().split('\n').slice(1)) { if (l) rows.set(l.split(',')[0], l); }
  const final = new Set(games.filter(g => g.status === 'final').map(g => g.game_id));
  const stamp = new Date().toISOString().slice(0, 16) + 'Z';
  let n = 0;
  for (const g of games) {
    if (final.has(g.game_id) || !upcoming[g.game_id] || g.type === 'PRE') continue;      // preseason is shown, never graded
    /* frozen at tip-off: once a game has started (or its tip time has passed) its logged number is the record's and is
       never rewritten, whenever a late run lands */
    if (g.status !== 'scheduled' || (g.tip && g.tip <= stamp)) continue;
    const u = upcoming[g.game_id];
    const td = ctx.teamDiff[g.game_id];
    const teamP = td === undefined ? '' : E.prob(td).toFixed(4);
    const old = rows.get(g.game_id);
    const line = [g.game_id, g.date, g.away, g.home, u.pHome, u.spread, u.total, teamP, g.home_line || '', g.total || '', stamp].join(',');
    /* unchanged numbers keep their old stamp, so a quiet rerun rewrites nothing */
    if (old && old.split(',').slice(0, 10).join(',') === line.split(',').slice(0, 10).join(',')) continue;
    rows.set(g.game_id, line); n++;
  }
  const bodyOut = [head].concat([...rows.values()].sort()).join('\n') + '\n';
  const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : '';
  if (bodyOut !== before) fs.writeFileSync(f, bodyOut);
  L.log(`predictions.csv: ${rows.size} rows, ${n} written this run`);
}

if (require.main === module) main();
module.exports = { replay, score, fit, research, loadBoxes, loadTeamBoxes, loadCoaches, loadRaptor, makeLiveLineup, DEFAULT, FIRST, WARM_TO, FIT_TO };
