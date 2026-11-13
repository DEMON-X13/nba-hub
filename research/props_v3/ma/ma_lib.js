/* MA's machinery (PLAN.md section 1): the data, the replay, the projection layer P23 and the stat mix, for every line
 * DraftKings posted. Research only.
 *
 * The data. The box scores and team boxes of 2020-21 (research/props_v3/cache/box2021/, fetched by fetch_box2021.js) and
 * of 2021-22 to 2025-26 (data/), parsed by tools/props.js's own loadBoxes and loadTeamBoxes (through a temporary folder
 * of links, as props_v2's cut2026.js does), and data/games.csv's finals of the same seasons. No file of 2026-27 is
 * opened, and a box row of a later game throws. A data folder may be handed in instead (the blindfold check, D7): it is
 * read the same way.
 *
 * The replay is tools/props.js's replay, line for line (its order, its updates, its features read before a day's
 * results), with one addition: before a day's results, every player DraftKings posted a line for in that day's games is
 * read off the replay's state (his features, his club, the game's expected pace, his opponent's defence), whatever the
 * day's boxes say. A player's club is the club whose box last listed him, dressed or not, on an earlier date (PLAN.md
 * 1.5): a player with no box on record, or whose club on record is neither of the game's two clubs, is out of the sample
 * (`club: null`). He is projected only with a game played on record (tools/props.js's rule). Nothing of the day's own
 * boxes enters a read: they are processed after it. `verifyReplay` checks the copy against tools/props.js's replay.
 *
 * P23 (PLAN.md 1.1 step 2): tools/props.js's means at a nominal 30 minutes and the game's expected pace, with P23's
 * constants (ma/p23_fit.js: tools/props.js's own fit on 2021-22, 2020-21 warming up), and its negative binomial's
 * variance curve per stat. The stat mix (1.1 steps 3 to 5): DraftKings' implied mean on each line under P23's negative
 * binomial, the player-game's level kappa (the precision-weighted mean of log(implied / P23), weights the implied mean's
 * square over P23's variance at it, over every posted line with a projection), and d = logit m - logit q, m the P23 mix
 * at that level priced at the line. Outcomes are attached apart (`attachOutcomes`), for the scorer alone.
 */
'use strict';
const fs = require('fs');
const os = require('os');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const PM = require(path.join(ROOT, 'tools', 'props.js'));
const L = require(path.join(ROOT, 'tools', 'lib.js'));
const PF = require(path.join(ROOT, 'tools', 'props_feed.js'));
const { STATS, COMBOS, H_SET } = PM;
const CACHE = path.join(ROOT, 'research', 'props_v3', 'cache');
const BOX2021 = path.join(CACHE, 'box2021');
const SEASONS = [2021, 2022, 2023, 2024, 2025, 2026];
const NOMINAL_MIN = 30;
const POS = ['G', 'F', 'C'];
const zeros = () => Object.fromEntries(STATS.map(k => [k, 0]));
const EPS = 1e-6, clip = p => Math.min(Math.max(p, EPS), 1 - EPS), logit = p => { const q = clip(p); return Math.log(q / (1 - q)); };
const implied = a => (a > 0 ? 100 / (a + 100) : -a / (-a + 100));

/* ---------- data ---------- */
function linkDir(files) {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'props_v3-ma-'));
  for (const f of files) fs.symlinkSync(path.resolve(f), path.join(tmp, path.basename(f)));
  return tmp;
}
/* every box and team-box file of the seasons MA reads, from the 2020-21 cache and data/ (or a folder handed in) */
function dataFiles(dir) {
  if (dir) return fs.readdirSync(dir).filter(f => /^(box_\d{4}\.csv|teambox_\d{4}\.jsonl)$/.test(f)).map(f => path.join(dir, f));
  const out = [path.join(BOX2021, 'box_2021.csv'), path.join(BOX2021, 'teambox_2021.jsonl')];
  for (const s of SEASONS.slice(1)) out.push(path.join(ROOT, 'data', `box_${s}.csv`), path.join(ROOT, 'data', `teambox_${s}.jsonl`));
  for (const f of out) if (!fs.existsSync(f)) throw new Error(`${path.relative(ROOT, f)} is not there`);
  return out;
}
function readGamesCsv(file) {
  const t = fs.readFileSync(file, 'utf8').trim().split('\n'), h = t.shift().split(',');
  return t.map(l => { const v = l.split(','), o = {}; h.forEach((k, i) => { o[k] = v[i] === undefined ? '' : v[i]; }); return o; });
}
/* the games tools/props.js's loadGames keeps (no preseason; final, scheduled or live), of MA's seasons, in its order */
function gamesOf(file, maxSeason = 2026) {
  const g = readGamesCsv(file).filter(r => +r.season >= SEASONS[0] && +r.season <= maxSeason && r.type !== 'PRE' && ['final', 'scheduled', 'live'].includes(r.status));
  g.forEach(r => { r.season = +r.season; r.neutral = +r.neutral; });
  g.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : 1);
  return g;
}
function loadData(opts = {}) {
  const files = dataFiles(opts.dir), tmp = linkDir(files);
  let boxes, tbox;
  try { boxes = PM.loadBoxes(tmp); tbox = PM.loadTeamBoxes(tmp); } finally { fs.rmSync(tmp, { recursive: true, force: true }); }
  const late = Object.keys(boxes).filter(k => +k.slice(0, 4) > 2026).concat(Object.keys(tbox).filter(k => +k.slice(0, 4) > 2026));
  if (late.length) throw new Error(`a box score after 2025-26 was read: ${late.slice(0, 3).join(', ')}`);
  /* a box with no minutes is unusable (data.md section 4): ESPN's six 2021 play-in summaries carry no stats. Such a game
     is left out of the replay, its box and team boxes dropped, as a game with no box is */
  const dropped = [];
  for (const [gid, sides] of Object.entries(boxes)) {
    const mins = Object.values(sides).map(rs => rs.reduce((s, r) => s + (r.dnp ? 0 : r.min), 0));
    if (mins.some(m => m < 200)) { dropped.push(gid); delete boxes[gid]; for (const k of Object.keys(tbox)) if (k.startsWith(gid + ':')) delete tbox[k]; }
  }
  const games = gamesOf(opts.games || path.join(ROOT, 'data', 'games.csv'));
  return { games, boxes, tbox, dropped, files: files.map(f => path.relative(ROOT, f)) };
}

/* ---------- the replay: tools/props.js's, with the posted players read before each day's results ---------- */
/* tools/props.js newPlayer (not exported), verbatim */
function newPlayer(row, season) {
  const acc = {}; for (const h of H_SET) acc[h] = { m: 0, y: zeros() };
  return { id: row.id, name: row.name, pos: row.pos || 'F', team: row.team, season, cur: [], reg: [], prevReg: [], acc, pace: 0, paceW: 0, n: 0, last: '',
    seasonY: zeros(), seasonN: 0, seasonDD: 0, seasonTD: 0, prevY: null, prevN: 0, prevDD: null, prevTD: null };
}
const EARLY_PACE = 1.5, LG_DECAY = Math.pow(0.5, 1 / 25000), OPP_H = PM.OPP_H;
/* posted: Map date -> [{ game, player }] (every posted player of that date's games); onRead(read) for each */
function replayMA(games, boxes, teamStats, posted, onRead, opts = {}) {
  const players = {}, pace = {}, seasonOfTeam = {};
  let lgPace = 99, lastFinal = '';
  const lgPos = Object.fromEntries(POS.map(p => [p, { m: 0, y: zeros() }]));
  const allowed = {}, lgAll = { m: 0, y: zeros() };
  const rows = [];
  const byDate = {};
  for (const g of games) (byDate[g.date] = byDate[g.date] || []).push(g);
  const gameById = new Map(games.map(g => [g.game_id, g]));
  /* each club's recent games, for the secondaries: per game the minutes of each listed player and whether he played */
  const clubLog = {};
  const getP = (r, season) => { let p = players[r.id]; if (!p) p = players[r.id] = newPlayer(r, season); PM.rollSeason(p, season); return p; };
  const dates = [...new Set([...Object.keys(byDate), ...(posted ? posted.keys() : [])])].sort();
  for (const date of dates) {
    const day = (byDate[date] || []).filter(g => g.status === 'final' && boxes[g.game_id] && boxes[g.game_id][g.home] && boxes[g.game_id][g.away]);
    for (const g of day) for (const t of [g.home, g.away]) {
      if (pace[t] === undefined) pace[t] = 99;
      if (seasonOfTeam[t] !== g.season) { if (seasonOfTeam[t] !== undefined) pace[t] = lgPace + EARLY_PACE; seasonOfTeam[t] = g.season; }
    }
    /* the posted players: read before the day's results (MA's addition). A game's clubs come from the schedule */
    if (posted && posted.has(date)) for (const { game, player } of posted.get(date)) {
      const g = gameById.get(game);
      if (!g) { onRead({ game, player, date, club: null, why: 'no schedule row' }); continue; }
      const p = players[player];
      if (!p) { onRead({ game, player, date, club: null, why: 'no box on record' }); continue; }
      const club = p.team;
      if (club !== g.home && club !== g.away) { onRead({ game, player, date, club: null, why: 'club on record not in the game', clubOnRecord: club }); continue; }
      const opp = club === g.home ? g.away : g.home;
      /* a club's pace at a new season's first game: as the replay sets it at that game (the same rule, read ahead) */
      const paceOf = t => (pace[t] === undefined ? 99 : seasonOfTeam[t] !== g.season && seasonOfTeam[t] !== undefined ? lgPace + EARLY_PACE : pace[t]);
      const expPace = (paceOf(g.home) + paceOf(g.away)) / 2;
      PM.rollSeason(p, g.season);
      const f = PM.features(p, lgPos);
      const oppF = PM.oppFactor(allowed[opp], lgAll);
      onRead({ game, player, date, season: g.season, type: g.type, club, opp, home: club === g.home ? 1 : 0, pos: p.pos, n: p.n, f, expPace, oppF,
        clubLog: (clubLog[club] || []).slice(), lastDate: p.last });   // a copy: the replay goes on pushing to its own
    }
    if (!day.length) continue;
    if (opts.collect) for (const g of day) {
      if (g.season < (opts.from || PM.FIRST + 1)) continue;
      const expPace = (pace[g.home] + pace[g.away]) / 2;
      for (const [t, opp] of [[g.home, g.away], [g.away, g.home]]) {
        for (const r of boxes[g.game_id][t]) {
          const p = players[r.id];
          if (!p || !p.n) continue;
          PM.rollSeason(p, g.season);
          rows.push({ game: g.game_id, season: g.season, type: g.type, date, team: t, opp, id: r.id, played: r.min > 0 && !r.dnp, f: PM.features(p, lgPos), expPace, oppF: PM.oppFactor(allowed[opp], lgAll), min: r.min, y: r.y, sideKey: g.game_id + ':' + t });
        }
      }
    }
    for (const g of day) {
      const pc = {};
      for (const t of [g.home, g.away]) pc[t] = PM.gamePace(boxes[g.game_id][t], teamStats[g.game_id + ':' + t]);
      for (const t of [g.home, g.away]) {
        for (const r of boxes[g.game_id][t]) {
          const p = getP(r, g.season); p.team = t; p.name = r.name || p.name; if (r.pos) p.pos = r.pos;
          if (r.min <= 0 || r.dnp) continue;
          p.n++; p.last = date; p.cur.push(r.min); if (p.cur.length > 100) p.cur.shift();
          if (g.type === 'REG') { p.reg.push({ season: g.season, min: r.min }); if (p.reg.length > 100) p.reg.shift(); }
          for (const h of H_SET) { const d = Math.pow(0.5, 1 / h), a = p.acc[h]; a.m = a.m * d + r.min; for (const k of STATS) a.y[k] = a.y[k] * d + r.y[k]; }
          const dp = Math.pow(0.5, 1 / 25); p.pace = p.pace * dp + pc[t] * r.min; p.paceW = p.paceW * dp + r.min;
          for (const k of STATS) p.seasonY[k] += r.y[k]; p.seasonN++;
          const dd = PM.doubles(r.y); if (dd >= 2) p.seasonDD++; if (dd >= 3) p.seasonTD++;
          const lp = lgPos[p.pos] || lgPos.F; lp.m = lp.m * LG_DECAY + r.min; for (const k of STATS) lp.y[k] = lp.y[k] * LG_DECAY + r.y[k];
        }
      }
      for (const [t, opp] of [[g.home, g.away], [g.away, g.home]]) {
        const a = allowed[opp] = allowed[opp] || { m: 0, y: zeros(), season: g.season };
        if (a.season !== g.season) { a.m *= 0.5; for (const k of STATS) a.y[k] *= 0.5; a.season = g.season; }
        const d = Math.pow(0.5, 1 / OPP_H); let m = 0; const y = zeros();
        for (const r of boxes[g.game_id][t]) { if (r.min <= 0 || r.dnp) continue; m += r.min; for (const k of STATS) y[k] += r.y[k]; }
        a.m = a.m * d + m; for (const k of STATS) a.y[k] = a.y[k] * d + y[k];
        const dl = Math.pow(0.5, 1 / (OPP_H * 15)); lgAll.m = lgAll.m * dl + m; for (const k of STATS) lgAll.y[k] = lgAll.y[k] * dl + y[k];
      }
      pace[g.home] += 0.1 * (pc[g.home] - pace[g.home]); pace[g.away] += 0.1 * (pc[g.away] - pace[g.away]);
      if (g.type !== 'POST') lgPace += 0.005 * ((pc[g.home] + pc[g.away]) / 2 - lgPace);
      /* MA's addition, after the results: each club's game kept for the secondaries (read only on later dates) */
      for (const t of [g.home, g.away]) {
        const log = clubLog[t] = clubLog[t] || [];
        log.push({ date, season: g.season, min: Object.fromEntries(boxes[g.game_id][t].map(r => [r.id, r.min > 0 && !r.dnp ? r.min : 0])) });
        if (log.length > 6) log.shift();
      }
      lastFinal = date;
    }
  }
  return { rows, players, pace, lgPace, lgPos, seasonOfTeam, lastFinal, allowed, lgAll };
}
/* the copy against tools/props.js's own replay: the same rows (features, pace, opponent) for the box-listed players */
function verifyReplay(D, from) {
  const a = PM.replay(D.games, D.boxes, D.tbox, { collect: true, from }).rows, b = replayMA(D.games, D.boxes, D.tbox, null, null, { collect: true, from }).rows;
  if (a.length !== b.length) throw new Error(`the replay's copy collects ${b.length} rows where tools/props.js collects ${a.length}`);
  for (let i = 0; i < a.length; i++) if (JSON.stringify(a[i]) !== JSON.stringify(b[i])) throw new Error(`the replay's copy differs at row ${i} (${a[i].game} ${a[i].id})`);
  return a.length;
}

/* ---------- P23 and the stat mix ---------- */
const meansAt = (rd, P, minutes) => PM.means(rd.f, minutes, rd.expPace, rd.type === 'POST', P, rd.oppF);
/* DraftKings' implied mean on a line under P23's negative binomial for its stat (why_lib.js impliedMean's rule) */
function impliedMean(line, q, ab) {
  let lo = 1e-4, hi = Math.max(4 * line + 20, 10);
  const f = mu => PM.pOver(line, mu, PM.nbVar(mu, ab));
  if (q <= f(lo)) return lo;
  while (f(hi) < q && hi < 1e4) hi *= 2;
  for (let it = 0; it < 60; it++) { const mid = (lo + hi) / 2; if (f(mid) < q) lo = mid; else hi = mid; }
  return (lo + hi) / 2;
}
/* the secondaries' inputs (PLAN.md 1.3), from earlier boxes alone */
function secondaries(rd, P) {
  const cur = rd.f.cur || [], mean = a => a.reduce((s, z) => s + z, 0) / a.length;
  const trend = cur.length >= 6 ? Math.max(-1, Math.min(1, Math.log((mean(cur.slice(-3)) + 1) / (mean(cur.slice(-13, -3)) + 1)))) : 0;
  const log = (rd.clubLog || []).filter(e => e.season === rd.season), last5 = log.slice(-5), prev = log.length ? log[log.length - 1] : null;
  let tot = 0, out = 0;
  if (prev) for (const e of last5) for (const [id, m] of Object.entries(e.min)) { tot += m; if (id !== rd.player && !(prev.min[id] > 0)) out += m; }
  const outShare = tot > 0 ? out / tot : 0;
  const ret = rd.f.nCur > 0 && prev && !(prev.min[rd.player] > 0) ? 1 : 0;
  const own = Math.max(0, Math.min(46, PM.baseMin(rd.f, P.min)));
  return { trend, outShare, ret, early: rd.f.nCur < 10 ? 1 : 0, ownMin: own };
}
/* every posted line of a set -> MA's pre-game table. lines: [{ game, player, stat, line, over, under, start }] */
function buildRows(lines, D, P) {
  const byDate = new Map(), gameById = new Map(D.games.map(g => [g.game_id, g]));
  const want = new Map();
  for (const l of lines) { const g = gameById.get(l.game); const date = g ? g.date : null; if (!date) continue; const k = l.game + '|' + l.player; if (want.has(k)) continue; want.set(k, date); if (!byDate.has(date)) byDate.set(date, []); byDate.get(date).push({ game: l.game, player: l.player }); }
  const reads = new Map();
  replayMA(D.games, D.boxes, D.tbox, byDate, rd => { reads.set(rd.game + '|' + rd.player, rd); });
  const out = [];
  for (const l of lines) {
    const g = gameById.get(l.game), rd = reads.get(l.game + '|' + l.player);
    const x = { game: l.game, player: l.player, stat: l.stat, line: l.line, over: l.over, under: l.under, start: l.start || null,
      date: g ? g.date : null, month: g ? g.date.slice(0, 7) : null, type: g ? g.type : null, season: g ? g.season : null };
    x.Io = implied(x.over); x.Iu = implied(x.under); x.q = 1 - x.Iu; x.M = x.Io + x.Iu - 1; x.zq = logit(x.q); x.zo = logit(x.Io);
    x.ab = P.var[l.stat];
    if (!rd || !rd.club) { x.club = null; x.why = rd ? rd.why : 'not read'; out.push(x); continue; }
    Object.assign(x, { club: rd.club, opp: rd.opp, home: rd.home, pos: rd.pos, nCur: rd.f.nCur, posRate: rd.f.posRate[l.stat] });
    if (rd.n > 0) {
      const mu = meansAt(rd, P, NOMINAL_MIN)[l.stat];
      x.mu = mu; x.muDK = impliedMean(l.line, x.q, x.ab);
      const sec = secondaries(rd, P); Object.assign(x, sec);
      x.muOwn = meansAt(rd, P, sec.ownMin)[l.stat];
    }
    out.push(x);
  }
  /* the stat mix, per player-game, over every posted line with a projection (PLAN.md 1.1 steps 4 and 5) */
  const pg = new Map(); for (const x of out) { const k = x.game + '|' + x.player; if (!pg.has(k)) pg.set(k, []); pg.get(k).push(x); }
  for (const [, a] of pg) {
    for (const x of a) x.nPl = a.length;
    const p = a.filter(x => x.mu != null);
    if (!p.length) continue;
    let sw = 0, sr = 0; for (const x of p) { const w = x.muDK * x.muDK / PM.nbVar(x.muDK, x.ab); sw += w; sr += w * (Math.log(x.muDK) - Math.log(x.mu)); }
    const kap = sr / sw;
    for (const x of p) {
      const mu2 = x.mu * Math.exp(kap); x.kap = kap; x.nProj = p.length;
      x.pMix = PM.pOver(x.line, mu2, PM.nbVar(mu2, x.ab)); x.d = logit(x.pMix) - x.zq;
      x.pOwn = PM.pOver(x.line, x.muOwn, PM.nbVar(x.muOwn, x.ab)); x.dLvl = logit(x.pOwn) - logit(x.pMix);
    }
  }
  return out;
}
/* the outcomes, from the game's own box (the scorer's alone): played, the stat, the grade */
function attachOutcomes(rows, boxes) {
  const n = { graded: 0, void: 0, push: 0, out: 0 };
  for (const x of rows) {
    const b = boxes[x.game]; let r = null;
    if (b) for (const side of Object.values(b)) for (const z of side) if (z.id === x.player) r = z;
    if (!r || !(r.min > 0) || r.dnp) { x.status = 'void'; } else {
      const y = PM.yOf(r.y, x.stat); x.y = y; x.minPlayed = r.min;
      if (y === x.line) x.status = 'push'; else { x.status = 'graded'; x.o = y > x.line ? 1 : 0; }
    }
    if (!x.club) { n.out++; } else n[x.status]++;
  }
  return n;
}
/* the line loaders: six clean columns only (PLAN.md 1.5, L1) */
function readLines6(file) {
  const t = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean), h = t.shift();
  if (h !== 'game_id,player_id,stat,line,over,under') throw new Error(`${path.relative(ROOT, file)}: not the six clean columns (a seventh, last_updated, is refused)`);
  return t.map(l => { const v = l.split(','); if (v.length !== 6) throw new Error(`${path.relative(ROOT, file)}: a row with other than six fields`); return v; });
}
function lines2024(gamesById, file) {
  const rr = readLines6(file || path.join(CACHE, 'dk40_2024_lines.csv'));
  const starts = file ? new Map() : new Map(fs.readFileSync(path.join(CACHE, 'dk40_2024_starts.csv'), 'utf8').split('\n').filter(Boolean).slice(1).map(l => l.split(',')));
  const out = [];
  for (const v of rr) {
    const g = gamesById.get(v[0]);
    if (!g || g.type !== 'REG' || g.date < '2023-10-24' || g.date > '2024-04-14' || !STATS.includes(v[2])) continue;
    const over = PF.propAmerican(v[4]), under = PF.propAmerican(v[5]);
    if (over == null || under == null || !Number.isFinite(+v[3])) continue;
    out.push({ game: v[0], player: v[1], stat: v[2], line: +v[3], over, under, start: starts.get(v[0]) || null });
  }
  return out;
}
function linesArchive() {
  const rr = readLines6(path.join(ROOT, 'data', 'props_2026.csv')), out = [];
  for (const v of rr) { if (!STATS.includes(v[2])) continue; const over = PF.propAmerican(v[4]), under = PF.propAmerican(v[5]); if (over == null || under == null || !Number.isFinite(+v[3])) continue; out.push({ game: v[0], player: v[1], stat: v[2], line: +v[3], over, under, start: null }); }
  return out;
}

module.exports = { ROOT, CACHE, PM, STATS, NOMINAL_MIN, loadData, gamesOf, readGamesCsv, replayMA, verifyReplay, meansAt, impliedMean, secondaries, buildRows, attachOutcomes, readLines6, lines2024, linesArchive, logit, implied };
