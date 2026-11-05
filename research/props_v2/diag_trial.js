/* Diagnosis of the props trial's loss to DraftKings (read only; nothing here is fitted, chosen or scored as a
 * candidate on the 2026-27 season).
 *
 *   node research/props_v2/diag_trial.js     writes research/props_v2/diag_trial.md and results/diag_trial.json
 *
 * What it reads. The trial: data/props_shadow.json (each game's frozen call: the player's minutes and eleven means, the
 * fit's spreads), data/props_shadow_lines.csv (the graded lines: the model's chance of the Over, DraftKings' fair
 * chance, the stat), data/props_2027.csv (the closing line and its two prices), and the box scores (who played, how
 * long, who started). The comparison: DraftKings' closing lines of the 2026 play-in and playoffs (data/props_2026.csv)
 * against the 2026 fold's model (research/props.json, fitted on 2023-2025), projected as the walk-forward projects them
 * (the box's list as the side), which reproduces README "Against DraftKings' closing lines".
 *
 * How the call is taken apart. tools/props.js's replay is run over every final (its own exported functions, unchanged),
 * and each trial game's row gives what the model knew before tip-off: the player's base minutes b (baseMin), his rate
 * per minute of each stat (rateOf: his weighted rate shrunk toward his position's), the pace factor and the opponent
 * factor. The frozen call's minutes m over b is the side's scale; the call's mean over m is the rate the call used,
 * which the replay's rate x pace x opponent reproduces (the match is printed). A line's error, mean minus stat, is then
 *   minutes      mu x (1 - actual / m)                 what the call would have said at the minutes he played
 *   pace, opp.   actual x rate x (pace x opp - 1)      the two adjustments, at the minutes he played
 *   rate         actual x rate - stat                  his rate itself against what he did per minute
 * (and a residual, the call against the replay's reproduction, a few hundredths). The same runs on the 2026 archive.
 *
 * Diagnostics on 2026-27 below that use a what-if (the walk-forward's minutes on the trial's games: who dressed, known
 * after the fact) are hindsight, said so, and are not candidates.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const PM = require(path.join(ROOT, 'tools', 'props.js'));
const F = require(path.join(ROOT, 'tools', 'props_feed.js'));
const DATA = path.join(ROOT, 'data');
const OUT_MD = path.join(__dirname, 'diag_trial.md');
const OUT_JSON = path.join(__dirname, 'results', 'diag_trial.json');
const LAYOUT = ['min'].concat(PM.ALL, ['dd', 'td']);
const STATS = PM.STATS, COMBOS = PM.COMBOS, ALL = PM.ALL;
const partsOf = k => COMBOS[k] || [k];
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const imp = F.propImplied;
const r1 = x => x == null || !isFinite(x) ? '' : (Math.round(x * 10) / 10).toFixed(1);
const r2 = x => x == null || !isFinite(x) ? '' : (Math.round(x * 100) / 100).toFixed(2);
const r3 = x => x == null || !isFinite(x) ? '' : (Math.round(x * 1000) / 1000).toFixed(3);
const r4 = x => x == null || !isFinite(x) ? '' : (Math.round(x * 1e4) / 1e4).toFixed(4);
const pc = x => x == null || !isFinite(x) ? '' : (100 * x).toFixed(1) + '%';
const sg = (x, f = r2) => x == null || !isFinite(x) ? '' : (x > 0 ? '+' : '') + f(x);
const csv = f => { const ls = fs.readFileSync(f, 'utf8').trim().split('\n'); const h = ls.shift().split(','); return ls.map(l => { const v = l.split(','); const o = {}; h.forEach((c, i) => { o[c] = v[i]; }); return o; }); };
const median = a => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : null; };
const avg = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const STAT_NAME = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', tpm: 'Threes', stl: 'Steals', blk: 'Blocks', pra: 'Pts+reb+ast', pr: 'Pts+reb', pa: 'Pts+ast', ar: 'Ast+reb', sb: 'Stl+blk' };

/* ---------- the replay: what the model knew before each game (tools/props.js, unchanged) ---------- */
const games = PM.loadGames(), boxes = PM.loadBoxes(), teamStats = PM.loadTeamBoxes();
const gameById = new Map(games.map(g => [g.game_id, g]));
/* the pace a game was actually played at: the two sides' possessions per 48, averaged (tools/props.js gamePace) */
const actPaceOf = gid => { const g = gameById.get(gid), bx = boxes[gid]; if (!g || !bx || !bx[g.home] || !bx[g.away]) return null; return (PM.gamePace(bx[g.home], teamStats[gid + ':' + g.home]) + PM.gamePace(bx[g.away], teamStats[gid + ':' + g.away])) / 2; };
const R = PM.replay(games, boxes, teamStats, { collect: true, from: 2023 });
const rowAt = new Map(); R.rows.forEach((r, i) => rowAt.set(r.game + '|' + r.id, i));

/* the box's own columns the loader drops: starter */
const boxInfo = new Map();
const appear = {};                  // player -> [{date, season, type, team, min}] of games played
for (const s of [2025, 2026, 2027]) for (const r of csv(path.join(DATA, `box_${s}.csv`))) {
  boxInfo.set(r.game_id + '|' + r.player_id, { starter: +r.starter === 1, min: +r.min || 0, dnp: +r.dnp === 1, team: r.team });
  const g = gameById.get(r.game_id);
  if ((+r.min || 0) > 0 && +r.dnp !== 1 && g) (appear[r.player_id] = appear[r.player_id] || []).push({ date: r.date, season: s, type: g.type, team: r.team, min: +r.min });
}
for (const a of Object.values(appear)) a.sort((x, y) => x.date < y.date ? -1 : 1);
/* a player's usual minutes before a date: his season's appearances if 3 or more, else last regular season's if 10 or more */
function usualMin(id, date, season) {
  const a = (appear[id] || []).filter(x => x.date < date);
  const cur = a.filter(x => x.season === season); if (cur.length >= 3) return avg(cur.map(x => x.min));
  const prev = a.filter(x => x.season === season - 1 && x.type === 'REG'); if (prev.length >= 10) return avg(prev.map(x => x.min));
  return cur.length ? avg(cur.map(x => x.min)) : null;
}
function lastTeamBefore(id, season) { const a = (appear[id] || []).filter(x => x.season === season - 1); return a.length ? a[a.length - 1].team : null; }

/* the team's previous game (back-to-backs) */
const teamDates = {};
for (const g of games) if (g.type !== 'PRE') for (const t of [g.home, g.away]) (teamDates[t] = teamDates[t] || new Set()).add(g.date);
const addDays = (iso, n) => { const d = new Date(iso + 'T12:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const b2b = (t, date) => teamDates[t] && teamDates[t].has(addDays(date, -1));

/* the injury report as the job logged it, a snapshot a day: the latest at or before the game's date */
const injBy = {};
for (const r of csv(path.join(DATA, 'injuries_log.csv'))) ((injBy[r.date] = injBy[r.date] || {})[r.team] = injBy[r.date][r.team] || []).push(r);
const injDates = Object.keys(injBy).sort();
function reportOut(team, date) {
  let d = null; for (const x of injDates) if (x <= date) d = x;
  if (!d) return [];
  return ((injBy[d] || {})[team] || []).filter(x => /^(out|susp)/i.test(x.status)).map(x => x.player_id);
}

/* ---------- a line's numbers ---------- */
/* the replay's pieces for one player in one game, under constants P: base minutes, and per stat the rate, pace and
   opponent factors */
function pieces(row, P) {
  const f = row.f, b = PM.baseMin(f, P.min);
  const pf = f.pace && P.gamma ? Math.pow(row.expPace / f.pace, P.gamma) : 1;
  const ap = actPaceOf(row.game);
  const pfAct = f.pace && P.gamma && ap ? Math.pow(ap / f.pace, P.gamma) : pf;
  const out = { b, pf, pfAct, rate: {}, of: {}, post: {} };
  for (const k of STATS) {
    const R_ = P.rate[k];
    out.rate[k] = (f.acc[R_.h].y[k] + R_.m * f.posRate[k]) / (f.acc[R_.h].m + R_.m);
    out.of[k] = row.oppF && P.opp ? Math.pow(row.oppF[k], P.opp[k]) : 1;
    out.post[k] = row.type === 'POST' ? P.post[k] : 1;
  }
  return out;
}
/* mean minus stat, taken apart (the header) */
function decompose(L) {
  const a = L.amin, m = L.m, pz = L.pz;
  const d = { total: L.mu - L.y, minutes: 0, pace: 0, paceMiss: 0, opp: 0, post: 0, rate: 0, resid: 0 };
  if (!(m > 0) || !pz) return null;
  let rebuilt = 0;
  for (const k of partsOf(L.stat)) {
    const r = pz.rate[k], pf = pz.pf, of = pz.of[k], po = pz.post[k];
    const muK = L.muParts[k];
    rebuilt += m * r * pf * of * po;
    d.minutes += muK * (1 - a / m);
    d.pace += a * r * (pf - 1);
    d.paceMiss += a * r * (pf - pz.pfAct);
    d.opp += a * r * pf * (of - 1);
    d.post += a * r * pf * of * (po - 1);
    d.rate += a * r - L.yParts[k];
    d.resid += a / m * (muK - m * r * pf * of * po);
  }
  d.rebuilt = rebuilt;
  return d;
}

/* ---------- the trial ---------- */
const ledger = JSON.parse(fs.readFileSync(path.join(DATA, 'props_shadow.json'), 'utf8'));
const graded = csv(path.join(DATA, 'props_shadow_lines.csv')).map(r => ({ ...r, p_model: +r.p_model, p_market: +r.p_market, y: +r.y }));
const rec27 = new Map(csv(path.join(DATA, 'props_2027.csv')).map(r => [r.game_id + '|' + r.player_id + '|' + r.stat, { line: +r.line, over: +r.over, under: +r.under }]));
const LIVE = JSON.parse(fs.readFileSync(path.join(ROOT, 'props.json'), 'utf8')).params;
const fitIds = Object.keys(ledger.fits);
const fitOf = id => ledger.fits[id];

const trial = [];
let noRow = 0, pMismatch = 0;
for (const g of graded) {
  const call = ledger.calls[g.game_id], c = call.players[g.player_id], fit = fitOf(call.fit);
  const lr = rec27.get(g.game_id + '|' + g.player_id + '|' + g.stat);
  const game = gameById.get(g.game_id), bx = boxInfo.get(g.game_id + '|' + g.player_id);
  const ri = rowAt.get(g.game_id + '|' + g.player_id), row = ri === undefined ? null : R.rows[ri];
  if (!row) noRow++;
  const mu = c[LAYOUT.indexOf(g.stat)], m = c[0];
  const muParts = Object.fromEntries(partsOf(g.stat).map(k => [k, c[LAYOUT.indexOf(k)]]));
  const yParts = row ? Object.fromEntries(partsOf(g.stat).map(k => [k, row.y[k]])) : null;
  const v = PM.nbVar(mu, fit.var[g.stat]);
  const pCheck = PM.pOver(lr.line, mu, v);
  if (Math.abs(pCheck - g.p_model) > 0.0001) pMismatch++;
  const team = bx.team, opp = team === game.home ? game.away : game.home;
  trial.push({ src: 'trial', game: g.game_id, date: game.date, id: g.player_id, stat: g.stat, line: lr.line, over: lr.over, under: lr.under,
    pModel: g.p_model, pMarket: g.p_market, y: g.y, o: g.y > lr.line ? 1 : 0, mu, sd: Math.sqrt(v), m, amin: bx.min, starter: bx.starter, team, opp,
    nCur: row ? row.f.nCur : null, prevN: row ? row.f.prevN : null, row, pz: row ? pieces(row, LIVE) : null, muParts, yParts,
    b2b: b2b(team, game.date), oppB2b: b2b(opp, game.date), spread: game.home_line === '' ? null : Math.abs(+game.home_line), total: game.total === '' ? null : +game.total,
    newClub: (() => { const t = lastTeamBefore(g.player_id, 2027); return t == null ? 'none' : t !== team ? 'new' : 'same'; })() });
}

/* each trial side: the call's players, who played, who was out on the report, who played with no call */
const sideInfo = new Map();
for (const gid of new Set(trial.map(x => x.game))) {
  const call = ledger.calls[gid], game = gameById.get(gid);
  for (const t of [game.home, game.away]) {
    const listed = (boxes[gid] || {})[t] || [];
    const playedIds = new Set(listed.filter(r => r.min > 0 && !r.dnp).map(r => r.id));
    const calledHere = Object.entries(call.players).filter(([id]) => { const b = boxInfo.get(gid + '|' + id); if (b) return b.team === t; const a = appear[id]; return a && a.length && a.filter(x => x.date < game.date).slice(-1)[0] && a.filter(x => x.date < game.date).slice(-1)[0].team === t; });
    const lateScratch = calledHere.filter(([id, c]) => !playedIds.has(id) && c[0] >= 20).map(([id, c]) => ({ id, m: c[0] }));
    const uncalled = listed.filter(r => r.min >= 15 && !r.dnp && !call.players[r.id]).map(r => ({ id: r.id, min: r.min }));
    const outs = reportOut(t, game.date).map(id => ({ id, usual: usualMin(id, game.date, game.season) })).filter(x => x.usual != null && x.usual >= 24);
    const calledMin = calledHere.filter(([id]) => playedIds.has(id)).reduce((s, [, c]) => s + c[0], 0);
    const calledActual = calledHere.filter(([id]) => playedIds.has(id)).reduce((s, [id]) => s + boxInfo.get(gid + '|' + id).min, 0);
    sideInfo.set(gid + ':' + t, { lateScratch, uncalled, outs, calledMin, calledActual, nCalled: calledHere.length });
  }
}
for (const x of trial) { const s = sideInfo.get(x.game + ':' + x.team); x.side = s; }

/* every called player who played (the minutes, on players rather than lines) */
const trialPlayers = [];
for (const gid of new Set(trial.map(x => x.game))) {
  const call = ledger.calls[gid];
  for (const [id, c] of Object.entries(call.players)) {
    const bx = boxInfo.get(gid + '|' + id); if (!bx || bx.min <= 0 || bx.dnp) continue;
    const ri = rowAt.get(gid + '|' + id), row = ri === undefined ? null : R.rows[ri];
    trialPlayers.push({ game: gid, id, m: c[0], amin: bx.min, starter: bx.starter, b: row ? PM.baseMin(row.f, LIVE.min) : null, nCur: row ? row.f.nCur : null, mu: Object.fromEntries(ALL.map(k => [k, c[LAYOUT.indexOf(k)]])), y: row ? row.y : null, row, team: bx.team });
  }
}

/* the walk-forward's minutes on the trial's games, under the live constants: the side the box lists (who dressed,
   hindsight), as the backtest projects it */
const sel27 = new Set(trial.map(x => x.game));
const wfProj = PM.project(R.rows, LIVE, r => sel27.has(r.game));
const wfAt = new Map(); for (const [i, x] of wfProj) wfAt.set(R.rows[i].game + '|' + R.rows[i].id, x);
for (const x of trial) {
  const w = wfAt.get(x.game + '|' + x.id); x.wf = w || null;
  if (w) { const v = PM.nbVar(w.mu[x.stat], LIVE.var[x.stat]); x.pWf = PM.pOver(x.line, w.mu[x.stat], v); x.muWf = w.mu[x.stat]; x.mWf = w.m; }
}

/* ---------- the 2026 archive: the 2026 fold's model on the play-in and playoff lines ---------- */
const RS = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props.json'), 'utf8'));
const P26 = RS.folds.find(f => f.season === 2026).params;
const rec26 = csv(path.join(DATA, 'props_2026.csv')).map(r => ({ game_id: r.game_id, player_id: r.player_id, stat: r.stat, line: +r.line, over: +r.over, under: +r.under }));
const games26 = new Set(rec26.map(r => r.game_id));
const pr26 = PM.project(R.rows, P26, r => games26.has(r.game));
const at26 = new Map(); for (const [i, x] of pr26) at26.set(R.rows[i].game + '|' + R.rows[i].id, { x, r: R.rows[i] });
const archive = [];
for (const l of rec26) {
  const a = at26.get(l.game_id + '|' + l.player_id); if (!a) continue;
  const bx = boxInfo.get(l.game_id + '|' + l.player_id); if (!bx || bx.min <= 0 || bx.dnp) continue;
  const mu = a.x.mu[l.stat], y = PM.yOf(a.r.y, l.stat); if (y === l.line) continue;
  const v = PM.nbVar(mu, P26.var[l.stat]);
  const game = gameById.get(l.game_id), team = bx.team, opp = team === game.home ? game.away : game.home;
  archive.push({ src: 'archive', game: l.game_id, date: game.date, id: l.player_id, stat: l.stat, line: l.line, over: l.over, under: l.under,
    pModel: PM.pOver(l.line, mu, v), pMarket: F.propFairOver(l.over, l.under), y, o: y > l.line ? 1 : 0, mu, sd: Math.sqrt(v), m: a.x.m, amin: bx.min, starter: bx.starter, team, opp,
    nCur: a.r.f.nCur, row: a.r, pz: pieces(a.r, P26), muParts: Object.fromEntries(partsOf(l.stat).map(k => [k, a.x.mu[k]])), yParts: Object.fromEntries(partsOf(l.stat).map(k => [k, a.r.y[k]])),
    b2b: b2b(team, game.date), oppB2b: b2b(opp, game.date), type: game.type });
}

/* ---------- scores of a group of lines ---------- */
const ll = (p, o) => o ? -Math.log(clip(p)) : -Math.log(1 - clip(p));
function flat(lines, edge = 0.03) {
  const out = { over: { bets: 0, won: 0, units: 0 }, under: { bets: 0, won: 0, units: 0 } };
  for (const x of lines) {
    const eo = x.pModel - imp(x.over), eu = (1 - x.pModel) - imp(x.under);
    const side = eo >= edge && eo >= eu ? 'over' : eu >= edge ? 'under' : null;
    if (!side) continue;
    const price = side === 'over' ? x.over : x.under, b = out[side];
    b.bets++;
    const won = side === 'over' ? x.o === 1 : x.o === 0;
    if (won) { b.won++; b.units += price > 0 ? price / 100 : 100 / -price; } else b.units -= 1;
  }
  return out;
}
const sideOfBet = (x, edge = 0.03) => { const eo = x.pModel - imp(x.over), eu = (1 - x.pModel) - imp(x.under); return eo >= edge && eo >= eu ? 'over' : eu >= edge ? 'under' : null; };
function scores(lines, ci = false) {
  if (!lines.length) return null;
  const n = lines.length;
  const s = { n, games: new Set(lines.map(x => x.game)).size, overRate: avg(lines.map(x => x.o)), modelSaid: avg(lines.map(x => x.pModel)), marketSaid: avg(lines.map(x => x.pMarket)),
    llDiff: avg(lines.map(x => ll(x.pModel, x.o) - ll(x.pMarket, x.o))), brDiff: avg(lines.map(x => (x.pModel - x.o) ** 2 - (x.pMarket - x.o) ** 2)),
    llModel: avg(lines.map(x => ll(x.pModel, x.o))), llMarket: avg(lines.map(x => ll(x.pMarket, x.o))),
    bias: avg(lines.map(x => x.mu - x.y)), muMinusLine: avg(lines.map(x => x.mu - x.line)), lineMinusY: avg(lines.map(x => x.line - x.y)), flat: flat(lines) };
  if (ci) { const m = new Map(); for (const x of lines) { const v = m.get(x.game) || [0, 0]; v[0] += ll(x.pModel, x.o) - ll(x.pMarket, x.o); v[1]++; m.set(x.game, v); } s.llCi = PM.bootCI([...m.values()], 2000, 0); }
  return s;
}
const fu = f => f.bets ? `${f.bets}, ${f.won}, ${sg(f.units, r1)} (${sg(100 * f.units / f.bets, r1)}%)` : '0';
const HEAD = '| | Lines | Over hit | Model said | DK fair said | Log loss, model - DK | Brier, model - DK | Mean - stat | Mean - line | 3-pt Overs: bets, won, units (ROI) | 3-pt Unders |';
const SEP = '|---|---|---|---|---|---|---|---|---|---|---|';
const rowMd = (label, s) => s ? `| ${label} | ${s.n} | ${pc(s.overRate)} | ${pc(s.modelSaid)} | ${pc(s.marketSaid)} | ${sg(s.llDiff, r4)}${s.llCi ? ` [${sg(s.llCi[0], r4)}, ${sg(s.llCi[1], r4)}]` : ''} | ${sg(s.brDiff, r4)} | ${sg(s.bias)} | ${sg(s.muMinusLine)} | ${fu(s.flat.over)} | ${fu(s.flat.under)} |` : `| ${label} | 0 | | | | | | | | | |`;
function table(title, groups, lines, note) {
  const out = [`### ${title}`, ''];
  if (note) out.push(note, '');
  out.push(HEAD, SEP);
  const J = {};
  for (const [label, pred] of groups) { const sub = lines.filter(pred); const s = scores(sub, sub.length >= 300); J[label] = s; out.push(rowMd(label, s)); }
  out.push('');
  return { md: out.join('\n'), json: J };
}

/* ---------- the tables ---------- */
const md = [], J = { generated: new Date().toISOString().slice(0, 16) + 'Z' };
const push = (key, t) => { md.push(t.md); J[key] = t.json; };
const statGroups = ALL.map(k => [STAT_NAME[k], x => x.stat === k]);
const all = [['All', () => true]];

/* checks: the replay reproduces the calls */
const recon = trial.filter(x => x.pz && STATS.includes(x.stat)).map(x => { const k = x.stat; const reb = x.m * x.pz.rate[k] * x.pz.pf * x.pz.of[k]; return x.mu > 0.05 ? Math.abs(reb / x.mu - 1) : 0; });
const reconArc = archive.filter(x => STATS.includes(x.stat)).map(x => { const k = x.stat; const reb = x.m * x.pz.rate[k] * x.pz.pf * x.pz.of[k] * x.pz.post[k]; return x.mu > 0.05 ? Math.abs(reb / x.mu - 1) : 0; });
const s27 = scores(trial, true), s26 = scores(archive, true);
J.checks = { trialLines: trial.length, pModelMismatch: pMismatch, noReplayRow: noRow, fits: fitIds, reconMedianRelErr: median(recon), reconP90: [...recon].sort((a, b) => a - b)[Math.floor(recon.length * 0.9)], archiveLines: archive.length, archiveReconMedian: median(reconArc), trial: s27, archive: s26 };

md.push(`# Why the props trial loses to DraftKings: a diagnosis

Read only. Written by \`research/props_v2/diag_trial.js\` (\`node research/props_v2/diag_trial.js\`) on ${J.generated}, from the
trial's frozen calls (\`data/props_shadow.json\`), its graded lines (\`data/props_shadow_lines.csv\`), DraftKings' closing
lines and prices (\`data/props_2027.csv\`), the box scores, the injury log and the schedule; the comparison is the 2026
play-in and playoff archive (\`data/props_2026.csv\`) against the 2026 fold's model (fitted on 2023-2025), as README "Against
DraftKings' closing lines" scores it. **Nothing here is fitted, chosen or scored on 2026-27**: the tables describe where
the frozen model lost, and the what-ifs on 2026-27 (marked hindsight) only say which piece the loss comes from.

Checks: ${trial.length} trial lines (the ledger's ${ledger.summary.lines_graded}), each line's model chance recomputed from the frozen call and the fit
${pMismatch ? `(${pMismatch} differ)` : '(all agree to 4 decimals)'}; the replay of tools/props.js reproduces each call's mean from its minutes, rate, pace and
opponent factor to a median ${(100 * median(recon)).toFixed(2)}% (90th percentile ${(100 * J.checks.reconP90).toFixed(2)}%), so the decomposition below is of the
call itself. Archive: ${archive.length} lines, log loss model - DK ${sg(s26.llDiff, r4)} [${sg(s26.llCi[0], r4)}, ${sg(s26.llCi[1], r4)}] (README: 11,395 lines, +0.0147).

Columns: lines; how often the Over hit; the model's mean chance of the Over; DraftKings' fair chance (the whole margin
on the Over); log loss and Brier, model minus DraftKings (positive: the model is worse; a 90% interval resampling
games where a group has 300 lines or more); the model's mean minus the stat (its bias); the model's mean minus the line;
flat one-unit bets at a 3-point edge over the price's implied chance, as the bar counts them.
`);

push('byStat', table('1. By stat (trial)', all.concat(statGroups), trial));
push('archiveByStat', table('1b. By stat (2026 play-in and playoffs archive)', all.concat(statGroups), archive));

/* 2. side: the bets by stat */
{
  const out = ['### 2. The 3-point bets by side and stat (trial)', '',
    'Each bet: the side whose model chance is 3 points or more above its price\'s implied chance. "Said" is the model\'s chance of that side, "won" the rate it won, "fair" DraftKings\' fair chance of it.', '',
    '| Stat | Overs: bets | said | won | fair | units | Unders: bets | said | won | fair | units |', '|---|---|---|---|---|---|---|---|---|---|---|'];
  const Jt = {};
  const side = (lines, s) => { const b = lines.filter(x => sideOfBet(x) === s); if (!b.length) return null; const f = flat(b)[s]; return { bets: b.length, said: avg(b.map(x => s === 'over' ? x.pModel : 1 - x.pModel)), won: f.won / f.bets, fair: avg(b.map(x => s === 'over' ? x.pMarket : 1 - x.pMarket)), units: f.units }; };
  const cell = c => c ? `${c.bets} | ${pc(c.said)} | ${pc(c.won)} | ${pc(c.fair)} | ${sg(c.units, r1)}` : '0 | | | |';
  for (const [label, pred] of all.concat(statGroups)) { const sub = trial.filter(pred); const o = side(sub, 'over'), u = side(sub, 'under'); Jt[label] = { over: o, under: u }; out.push(`| ${label} | ${cell(o)} | ${cell(u)} |`); }
  out.push('');
  const subA = archive; const oA = side(subA, 'over'), uA = side(subA, 'under'); Jt.archive = { over: oA, under: uA };
  out.push(`Archive (2026 playoffs), all stats: Overs ${cell(oA).replace(/ \| /g, ', ')}; Unders ${cell(uA).replace(/ \| /g, ', ')}.`, '');
  md.push(out.join('\n')); J.bySide = Jt;
}

/* 3. line size: quartiles of the line within each stat */
{
  const q = {}; for (const k of ALL) { const ls = trial.filter(x => x.stat === k).map(x => x.line).sort((a, b) => a - b); q[k] = [0.25, 0.5, 0.75].map(p => ls[Math.floor(p * ls.length)]); }
  const qOf = x => { const t = q[x.stat]; return x.line <= t[0] ? 0 : x.line <= t[1] ? 1 : x.line <= t[2] ? 2 : 3; };
  push('byLineSize', table('3. By line size (trial; quartiles of the line within its stat)', [0, 1, 2, 3].map(i => [['Smallest quarter', 'Second', 'Third', 'Largest quarter'][i], x => qOf(x) === i]), trial,
    'Quartile cut points: ' + ALL.map(k => `${k} ${q[k].join('/')}`).join(', ') + '.'));
  push('byPointsLine', table('3b. Points lines by size (trial)', [['under 10', x => x.line < 10], ['10 to 15.5', x => x.line >= 10 && x.line < 16], ['16 to 21.5', x => x.line >= 16 && x.line < 22], ['22 to 27.5', x => x.line >= 22 && x.line < 28], ['28 and up', x => x.line >= 28]], trial.filter(x => x.stat === 'pts')));
}

/* 4. minutes tiers */
const minTiers = [['under 20', v => v < 20], ['20 to 26', v => v >= 20 && v < 26], ['26 to 30', v => v >= 26 && v < 30], ['30 to 34', v => v >= 30 && v < 34], ['34 and up', v => v >= 34]];
push('byProjMin', table('4. By projected minutes (trial: the frozen call\'s)', minTiers.map(([l, f]) => [l, x => f(x.m)]), trial));
push('byActMin', table('4b. By minutes actually played (trial; hindsight)', minTiers.map(([l, f]) => [l, x => f(x.amin)]), trial));
push('byMinErr', table('4c. By minutes played minus projected (trial; hindsight)', [['8 or more under', x => x.amin - x.m <= -8], ['3 to 8 under', x => x.amin - x.m > -8 && x.amin - x.m <= -3], ['within 3', x => Math.abs(x.amin - x.m) < 3], ['3 to 8 over', x => x.amin - x.m >= 3 && x.amin - x.m < 8], ['8 or more over', x => x.amin - x.m >= 8]], trial));
push('archiveByProjMin', table('4d. By projected minutes (archive)', minTiers.map(([l, f]) => [l, x => f(x.m)]), archive));

/* 5. starter, bench */
push('byStarter', table('5. Starter or bench (trial; the box\'s starter flag)', [['Started', x => x.starter], ['Came off the bench', x => !x.starter]], trial));
push('archiveByStarter', table('5b. Starter or bench (archive)', [['Started', x => x.starter], ['Came off the bench', x => !x.starter]], archive));

/* 6. games this season */
push('byGames', table('6. By his games this season before this one (trial)', [['0 to 5', x => x.nCur <= 5], ['6 to 15', x => x.nCur >= 6 && x.nCur <= 15], ['16 or more', x => x.nCur >= 16], ['  of which 0 (his season opener)', x => x.nCur === 0], ['  1 to 2', x => x.nCur >= 1 && x.nCur <= 2], ['  3 to 5', x => x.nCur >= 3 && x.nCur <= 5]], trial,
  'The trial runs 20 October to 4 November 2026, so no player has 16 games yet; the finer rows split the first bucket.'));
push('byClub', table('6b. Same club as last season or a new one (trial)', [['Same club', x => x.newClub === 'same'], ['New club', x => x.newClub === 'new'], ['No game last season (rookie, back from a year out)', x => x.newClub === 'none']], trial));
push('archiveByGames', table('6c. By his games this season (archive: the playoffs, so nearly all 16+)', [['0 to 15', x => x.nCur <= 15], ['16 or more', x => x.nCur >= 16]], archive));

/* 7. teammates out */
push('byTeammate', table('7. Teammates out (trial)', [
  ['A teammate of 24+ usual minutes Out on the day\'s report', x => x.side.outs.length > 0],
  ['No such teammate on the report', x => x.side.outs.length === 0],
  ['A called teammate (projected 20+) did not play: a late scratch', x => x.side.lateScratch.length > 0],
  ['A teammate played 15+ minutes with no call', x => x.side.uncalled.length > 0],
  ['Neither surprise', x => !x.side.lateScratch.length && !x.side.uncalled.length]], trial,
  'The call already drops the report\'s absentees and scales the side (tools/props.js sideScale); a late scratch or an uncalled player is what the call could not know. "Usual minutes": his appearances this season if 3 or more, else last regular season\'s.'));

/* 8. back-to-backs */
push('byB2b', table('8. Back-to-backs (trial)', [['His club on the second night of a back-to-back', x => x.b2b], ['His club rested', x => !x.b2b], ['The opponent on a back-to-back', x => x.oppB2b], ['Neither', x => !x.b2b && !x.oppB2b]], trial));
push('bySpread', table('8b. By the game\'s point spread (trial; blowout risk)', [['Spread under 4', x => x.spread != null && x.spread < 4], ['4 to 7.5', x => x.spread != null && x.spread >= 4 && x.spread < 8], ['8 or more', x => x.spread != null && x.spread >= 8]], trial));

/* 9. the gap between the model's mean and the line, and between its chance and DraftKings' */
push('byGapSd', table('9. By the model\'s mean minus the line, in the model\'s own standard deviations (trial)', [['under -0.5 sd', x => (x.mu - x.line) / x.sd < -0.5], ['-0.5 to -0.15', x => (x.mu - x.line) / x.sd >= -0.5 && (x.mu - x.line) / x.sd < -0.15], ['-0.15 to +0.15', x => Math.abs((x.mu - x.line) / x.sd) <= 0.15], ['+0.15 to +0.5', x => (x.mu - x.line) / x.sd > 0.15 && (x.mu - x.line) / x.sd <= 0.5], ['over +0.5 sd', x => (x.mu - x.line) / x.sd > 0.5]], trial));
const gapG = [['DK 10+ points above the model', x => x.pModel - x.pMarket <= -0.10], ['DK 5 to 10 above', x => x.pModel - x.pMarket > -0.10 && x.pModel - x.pMarket <= -0.05], ['within 5', x => Math.abs(x.pModel - x.pMarket) < 0.05], ['model 5 to 10 above', x => x.pModel - x.pMarket >= 0.05 && x.pModel - x.pMarket < 0.10], ['model 10+ above', x => x.pModel - x.pMarket >= 0.10]];
push('byDisagree', table('9b. By the model\'s chance of the Over minus DraftKings\' fair chance (trial): who is right when they disagree', gapG, trial));
push('archiveByDisagree', table('9c. The same on the archive', gapG, archive));
/* 9d. how much of the loss sits where the two disagree most */
{
  const tot = trial.reduce((s, x) => s + ll(x.pModel, x.o) - ll(x.pMarket, x.o), 0);
  const big = trial.filter(x => Math.abs(x.pModel - x.pMarket) >= 0.10);
  const bigS = big.reduce((s, x) => s + ll(x.pModel, x.o) - ll(x.pMarket, x.o), 0);
  const totA = archive.reduce((s, x) => s + ll(x.pModel, x.o) - ll(x.pMarket, x.o), 0);
  const bigA = archive.filter(x => Math.abs(x.pModel - x.pMarket) >= 0.10);
  const bigAS = bigA.reduce((s, x) => s + ll(x.pModel, x.o) - ll(x.pMarket, x.o), 0);
  J.lossShare = { trial: { lines: big.length, share: bigS / tot, of: trial.length }, archive: { lines: bigA.length, share: bigAS / totA, of: archive.length } };
  md.push(`### 9d. Where the log loss is lost\n\nThe ${big.length} trial lines (${pc(big.length / trial.length)}) where the model's chance of the Over and DraftKings' fair chance differ by 10 points or more carry ${pc(bigS / tot)} of the model's whole log-loss deficit; on the archive, ${bigA.length} lines (${pc(bigA.length / archive.length)}) carry ${pc(bigAS / totA)}.\n`);
}


/* 10. calibration */
{
  const bins = [[0, 0.3], [0.3, 0.4], [0.4, 0.45], [0.45, 0.5], [0.5, 0.55], [0.55, 0.6], [0.6, 0.7], [0.7, 1.01]];
  const out = ['### 10. Calibration: the chance of the Over said against what happened', '', '| Chance said | Model: lines | said | Over hit | DraftKings: lines | said | Over hit | Archive model: lines | said | hit |', '|---|---|---|---|---|---|---|---|---|---|'];
  const Jt = [];
  for (const [lo, hi] of bins) {
    const a = trial.filter(x => x.pModel >= lo && x.pModel < hi), b = trial.filter(x => x.pMarket >= lo && x.pMarket < hi), c = archive.filter(x => x.pModel >= lo && x.pModel < hi);
    const cell = (s, key) => s.length ? `${s.length} | ${pc(avg(s.map(x => x[key])))} | ${pc(avg(s.map(x => x.o)))}` : '0 | |';
    out.push(`| ${(100 * lo).toFixed(0)}-${Math.min(100, 100 * hi).toFixed(0)}% | ${cell(a, 'pModel')} | ${cell(b, 'pMarket')} | ${cell(c, 'pModel')} |`);
    Jt.push({ lo, hi, model: a.length ? [a.length, avg(a.map(x => x.pModel)), avg(a.map(x => x.o))] : null, market: b.length ? [b.length, avg(b.map(x => x.pMarket)), avg(b.map(x => x.o))] : null, archive: c.length ? [c.length, avg(c.map(x => x.pModel)), avg(c.map(x => x.o))] : null });
  }
  const sharp = s => avg(s.map(x => Math.abs(x.pModel - 0.5))), sharpM = s => avg(s.map(x => Math.abs(x.pMarket - 0.5)));
  out.push('', `How far from 50% each says, on average: the model ${pc(sharp(trial))}, DraftKings ${pc(sharpM(trial))} (archive: model ${pc(sharp(archive))}, DraftKings ${pc(sharpM(archive))}).`, '');
  md.push(out.join('\n')); J.calibration = Jt; J.sharp = { model: sharp(trial), market: sharpM(trial), archiveModel: sharp(archive), archiveMarket: sharpM(archive) };
}

/* 11. bias per stat and per minutes tier, taken apart */
function biasTable(title, lines, groups) {
  const out = [`### ${title}`, '', '| | Lines | Mean - stat | minutes | pace missed | opponent | playoffs | rate, at the pace played | residual | (the pace factor applied) | Minutes said | played |', '|---|---|---|---|---|---|---|---|---|---|---|---|'];
  const Jt = {};
  for (const [label, pred] of groups) {
    const sub = lines.filter(pred).map(x => ({ x, d: decompose(x) })).filter(z => z.d);
    if (!sub.length) { out.push(`| ${label} | 0 | | | | | | | | | | |`); continue; }
    const a = key => avg(sub.map(z => z.d[key]));
    const row = { n: sub.length, total: a('total'), minutes: a('minutes'), pace: a('pace'), paceMiss: a('paceMiss'), opp: a('opp'), post: a('post'), rate: a('rate'), resid: a('resid'), m: avg(sub.map(z => z.x.m)), amin: avg(sub.map(z => z.x.amin)) };
    Jt[label] = row;
    row.rateAtPace = row.rate + row.pace - row.paceMiss;
    out.push(`| ${label} | ${row.n} | ${sg(row.total)} | ${sg(row.minutes)} | ${sg(row.paceMiss)} | ${sg(row.opp)} | ${sg(row.post)} | ${sg(row.rateAtPace)} | ${sg(row.resid)} | (${sg(row.pace)}) | ${r1(row.m)} | ${r1(row.amin)} |`);
  }
  out.push('');
  return { md: out.join('\n'), json: Jt };
}
const biasNote = 'Mean minus stat on the graded lines (positive: the model said too much), split into parts that add up: minutes (the call\'s mean against the same mean at the minutes he played); pace missed (the pace factor against the one the game\'s played pace would have given: his rate x minutes played x (expected - played pace) / his recent games\' pace); the opponent factor at the minutes he played; the playoff factor (archive only); and the rate at the pace played (his projected rate per minute, before the opponent, at the game\'s played pace and the minutes he played, minus the stat). In brackets, the whole pace factor the call applied (pace missed plus the part the game bore out, which the rate column already holds).';
md.push('### 11. Where the bias comes from\n\n' + biasNote + '\n');
push('biasByStat', biasTable('11a. By stat (trial)', trial, all.concat(statGroups)));
push('biasByMin', biasTable('11b. By projected minutes (trial)', trial, minTiers.map(([l, f]) => [l, x => f(x.m)])));
push('biasByMinPts', biasTable('11c. Points lines by projected minutes (trial)', trial.filter(x => x.stat === 'pts'), minTiers.map(([l, f]) => [l, x => f(x.m)])));
push('biasByStarter', biasTable('11c2. Starter or bench (trial)', trial, [['Started', x => x.starter], ['Came off the bench', x => !x.starter]]));
push('biasByGames', biasTable('11d. By games this season (trial)', trial, [['0 to 2', x => x.nCur <= 2], ['3 to 5', x => x.nCur >= 3 && x.nCur <= 5], ['6 or more', x => x.nCur >= 6]]));
push('biasArchive', biasTable('11e. By stat (archive)', archive, all.concat(statGroups)));
push('biasArchiveMin', biasTable('11f. By projected minutes (archive)', archive, minTiers.map(([l, f]) => [l, x => f(x.m)])));
{
  /* the bias on the over bets alone: what made the model take the Over */
  const ob = trial.filter(x => sideOfBet(x) === 'over'), ub = trial.filter(x => sideOfBet(x) === 'under');
  push('biasBets', biasTable('11g. On the 3-point bets (trial)', trial, [['Over bets', x => sideOfBet(x) === 'over'], ['Under bets', x => sideOfBet(x) === 'under'], ['No bet', x => !sideOfBet(x)]]));
  J.betsMinutes = { over: { m: avg(ob.map(x => x.m)), amin: avg(ob.map(x => x.amin)), mWf: avg(ob.filter(x => x.mWf != null).map(x => x.mWf)) }, under: { m: avg(ub.map(x => x.m)), amin: avg(ub.map(x => x.amin)), mWf: avg(ub.filter(x => x.mWf != null).map(x => x.mWf)) } };
}

/* 12. minutes on players (every called player who played) */
{
  const out = ['### 12. Minutes, on every called player who played (trial)', '', '| Projected | Players | Said | Played | Said - played | Mean abs. error | Walk-forward rule on the box\'s side (hindsight): said | its error | Base b (before the side\'s scale) | Side scale m / b |', '|---|---|---|---|---|---|---|---|---|---|'];
  const Jt = {};
  for (const [label, f] of [['All', () => true]].concat(minTiers)) {
    const sub = trialPlayers.filter(x => f(x.m)); if (!sub.length) continue;
    const wf = sub.map(x => wfAt.get(x.game + '|' + x.id)).filter(Boolean);
    const wfS = sub.filter(x => wfAt.get(x.game + '|' + x.id));
    const row = { n: sub.length, m: avg(sub.map(x => x.m)), amin: avg(sub.map(x => x.amin)), bias: avg(sub.map(x => x.m - x.amin)), mae: avg(sub.map(x => Math.abs(x.m - x.amin))),
      wfM: avg(wf.map(w => w.m)), wfMae: avg(wfS.map(x => Math.abs(wfAt.get(x.game + '|' + x.id).m - x.amin))), b: avg(sub.filter(x => x.b != null).map(x => x.b)), scale: median(sub.filter(x => x.b > 0).map(x => x.m / x.b)) };
    Jt[label] = row;
    out.push(`| ${label} | ${row.n} | ${r1(row.m)} | ${r1(row.amin)} | ${sg(row.bias)} | ${r2(row.mae)} | ${r1(row.wfM)} | ${r2(row.wfMae)} | ${r1(row.b)} | ${r3(row.scale)} |`);
  }
  /* sides: the call's minutes over the side against what those players played */
  const sides = [...sideInfo.values()];
  const sumCalled = avg(sides.map(s => s.calledMin)), sumActual = avg(sides.map(s => s.calledActual));
  out.push('', `A side's called players who played: said ${r1(sumCalled)} minutes, played ${r1(sumActual)} (a game has 240, more in overtime). Sides with a late scratch (a called player of 20+ who did not play): ${sides.filter(s => s.lateScratch.length).length} of ${sides.length}; with a player of 15+ minutes and no call: ${sides.filter(s => s.uncalled.length).length}.`, '');
  md.push(out.join('\n')); J.minutes = Jt; J.sides = { n: sides.length, calledMin: sumCalled, calledActual: sumActual, late: sides.filter(s => s.lateScratch.length).length, uncalled: sides.filter(s => s.uncalled.length).length };
}

/* 13. pace and the league's rates: the trial's games against what the model expected, and against earlier seasons */
{
  const out = ['### 13. Pace and the league\'s scoring, expected against played', ''];
  const paceRows = (sel) => { const seen = new Map(); for (const r of R.rows) { if (!sel(r) || seen.has(r.game)) continue; const g = gameById.get(r.game); const bx = boxes[r.game]; if (!bx || !bx[g.home] || !bx[g.away]) continue; const act = (PM.gamePace(bx[g.home], teamStats[r.game + ':' + g.home]) + PM.gamePace(bx[g.away], teamStats[r.game + ':' + g.away])) / 2; seen.set(r.game, { exp: r.expPace, act }); } return [...seen.values()]; };
  const firstDays = (season, n) => { const ds = [...new Set(games.filter(g => g.season === season && g.type === 'REG').map(g => g.date))].sort().slice(0, n); return new Set(ds); };
  const nDays = new Set(trial.map(x => x.date)).size;
  out.push('| Games | Count | Expected pace | Played | Played - expected |', '|---|---|---|---|---|');
  const Jt = {};
  const prow = (label, rows) => { const e = avg(rows.map(x => x.exp)), a = avg(rows.map(x => x.act)); Jt[label] = { n: rows.length, exp: e, act: a }; out.push(`| ${label} | ${rows.length} | ${r2(e)} | ${r2(a)} | ${sg(a - e)} |`); };
  prow('Trial games (2026-27)', paceRows(r => sel27.has(r.game)));
  for (const s of [2024, 2025, 2026]) { const d = firstDays(s, nDays); prow(`${s - 1}-${String(s).slice(2)}: its first ${nDays} game days`, paceRows(r => r.season === s && d.has(r.date) && r.type === 'REG')); }
  for (const s of [2024, 2025, 2026]) prow(`${s - 1}-${String(s).slice(2)}: whole regular season`, paceRows(r => r.season === s && r.type === 'REG'));
  out.push('');
  /* the league's per-minute rate, as played, against the rate the model carried in (rate per minute before pace and
     opponent, weighted by minutes played), on every player with a replay row */
  out.push('Per 36 minutes, every player who played: the rate the model carried into the game (his rate before pace and opponent) against what was made.', '',
    '| Games | Player-games | Points: carried in | made | Rebounds | made | Assists | made | Threes | made |', '|---|---|---|---|---|---|---|---|---|---|');
  const rateRows = (label, sel, P) => {
    const rs = R.rows.filter(r => sel(r) && r.played && r.f.n > 0);
    const cell = k => { let c = 0, y = 0, mm = 0; for (const r of rs) { const R_ = P.rate[k], f = r.f; const rt = (f.acc[R_.h].y[k] + R_.m * f.posRate[k]) / (f.acc[R_.h].m + R_.m); c += rt * r.min; y += r.y[k]; mm += r.min; } return [36 * c / mm, 36 * y / mm]; };
    const v = Object.fromEntries(['pts', 'reb', 'ast', 'tpm'].map(k => [k, cell(k)]));
    Jt['rate:' + label] = { n: rs.length, ...v };
    out.push(`| ${label} | ${rs.length} | ${['pts', 'reb', 'ast', 'tpm'].map(k => `${r2(v[k][0])} | ${r2(v[k][1])}`).join(' | ')} |`);
  };
  rateRows('Trial games (2026-27)', r => sel27.has(r.game), LIVE);
  for (const s of [2024, 2025, 2026]) { const d = firstDays(s, nDays); rateRows(`${s - 1}-${String(s).slice(2)}: first ${nDays} game days`, r => r.season === s && d.has(r.date) && r.type === 'REG', LIVE); }
  for (const s of [2024, 2025, 2026]) rateRows(`${s - 1}-${String(s).slice(2)}: whole regular season`, r => r.season === s && r.type === 'REG', LIVE);
  rateRows('2026 play-in and playoffs (fold model\'s rates)', r => games26.has(r.game), P26);
  out.push('', 'The earlier seasons\' rows use the live constants\' rate rule on the replay (a description of the rule, not a refit); the replay\'s rows are every player the box lists who played and had a game on record.', '');
  md.push(out.join('\n')); J.pace = Jt;
}

/* 13b. the season's start: scoring, the opponent factor and the minutes rule in this and earlier seasons' opening weeks */
{
  const nDays = new Set(trial.map(x => x.date)).size;
  const firstDays = (season, n) => new Set([...new Set(games.filter(g => g.season === season && g.type === 'REG' && g.status === 'final').map(g => g.date))].sort().slice(0, n));
  const out = ['### 13b. The season\'s opening weeks, this season and the three before', '',
    `The first ${nDays} regular-season game days of each season (the trial's span). Points: both teams' points a game; the posted total where games.csv has one. Opponent factor: the factor the model applied (the opponent's allowed rate over the league's, to the fitted power), averaged over every player-game's minutes, points and rebounds. Minutes: the walk-forward rule on the box's side, each season by its own fold's constants (fitted on the seasons before it; the trial's row by the live constants), on players projected 8 or more who played, as the ledger calls them.`, '',
    '| Season | Games | Points a game | Posted total | Opponent factor, points | rebounds | Minutes: players | said - played | of the side: said | played |', '|---|---|---|---|---|---|---|---|---|---|'];
  const Jt = {};
  const foldP = s => s === 2027 ? LIVE : RS.folds.find(f => f.season === s).params;
  for (const s of [2024, 2025, 2026, 2027]) {
    const d = firstDays(s, nDays), P = foldP(s);
    const gs = games.filter(g => g.season === s && g.type === 'REG' && g.status === 'final' && d.has(g.date));
    const ppg = avg(gs.map(g => +g.away_score + +g.home_score)), tot = gs.filter(g => g.total !== '').map(g => +g.total);
    const rs = R.rows.filter(r => r.season === s && d.has(r.date) && r.type === 'REG' && r.played && r.f.n > 0);
    const ofAvg = k => { let w = 0, v = 0; for (const r of rs) { const f = Math.pow(r.oppF[k], P.opp[k]); v += f * r.min; w += r.min; } return v / w; };
    const pr = PM.project(R.rows, P, r => r.season === s && d.has(r.date) && r.type === 'REG');
    let n = 0, bias = 0; const bySide = new Map();
    for (const [i, x] of pr) { const r = R.rows[i]; if (x.m < 8) continue; n++; bias += x.m - r.min; const v = bySide.get(r.sideKey) || [0, 0]; v[0] += x.m; v[1] += r.min; bySide.set(r.sideKey, v); }
    const sides = [...bySide.values()];
    const row = { games: gs.length, ppg, posted: tot.length ? avg(tot) : null, ofPts: ofAvg('pts'), ofReb: ofAvg('reb'), n, minBias: bias / n, sideSaid: avg(sides.map(v => v[0])), sidePlayed: avg(sides.map(v => v[1])) };
    Jt[s] = row;
    out.push(`| ${s - 1}-${String(s).slice(2)} | ${row.games} | ${r1(row.ppg)} | ${row.posted == null ? '' : r1(row.posted)} | ${r3(row.ofPts)} | ${r3(row.ofReb)} | ${row.n} | ${sg(row.minBias)} | ${r1(row.sideSaid)} | ${r1(row.sidePlayed)} |`);
  }
  out.push('');
  const allR = games.filter(g => g.type === 'REG' && g.status === 'final');
  for (const s of [2024, 2025, 2026]) Jt['season' + s] = avg(allR.filter(g => g.season === s).map(g => +g.away_score + +g.home_score));
  out.push(`Whole regular seasons, points a game: 2023-24 ${r1(Jt.season2024)}, 2024-25 ${r1(Jt.season2025)}, 2025-26 ${r1(Jt.season2026)}. The minutes rows of the trial's games here are the walk-forward rule's on the box's side, not the frozen calls' (those are in table 12).`, '');
  md.push(out.join('\n')); J.openers = Jt;
}

/* 14. the spread: the call's variance against the squared error it made */
{
  const out = ['### 14. The spread: squared error against the variance the call said', '', 'On the graded lines: the mean of (stat - mean)^2 over the mean of the call\'s variance (1.00 is right; above, the spread is too narrow). The walk-forward column is the same ratio on the 2026 regular season\'s backtest rows (box\'s side, constants fitted on 2023-2025), where the spreads were fitted on such rows.', '',
    '| Stat | Trial: ratio | at the walk-forward\'s minutes (hindsight) | 2026 regular season walk-forward | Archive |', '|---|---|---|---|---|'];
  const pr26r = PM.project(R.rows, P26, r => r.season === 2026 && r.type === 'REG');
  const Jt = {};
  for (const k of ALL) {
    const t = trial.filter(x => x.stat === k), a = archive.filter(x => x.stat === k);
    const ratio = (ls, varOf, muOf) => { let e = 0, v = 0, n = 0; for (const x of ls) { const mu = muOf(x); if (mu == null) continue; e += (x.y - mu) ** 2; v += varOf(x, mu); n++; } return n ? e / v : null; };
    const rt = ratio(t, x => x.sd * x.sd, x => x.mu), rw = ratio(t, (x, mu) => PM.nbVar(mu, LIVE.var[k]), x => x.muWf);
    let e = 0, v = 0; for (const [i, z] of pr26r) { const r = R.rows[i]; const y = PM.yOf(r.y, k); e += (y - z.mu[k]) ** 2; v += PM.nbVar(z.mu[k], P26.var[k]); }
    const ra = ratio(a, x => x.sd * x.sd, x => x.mu);
    Jt[k] = { trial: rt, trialWf: rw, wf2026: e / v, archive: ra };
    out.push(`| ${STAT_NAME[k]} | ${r3(rt)} | ${r3(rw)} | ${r3(e / v)} | ${r3(ra)} |`);
  }
  out.push('');
  md.push(out.join('\n')); J.spread = Jt;
}

/* 15. what-ifs on the trial (hindsight, diagnosis only): the call at the walk-forward's minutes, at the minutes he
   played, and the log loss each would have had */
{
  const out = ['### 15. Which piece costs the log loss (trial; what-ifs with hindsight, diagnosis only, not candidates)', '',
    'Each row prices every graded line again with one piece of the call replaced, the rest and the fit\'s spread as they were. "The minutes he played" is the call\'s rate times his actual minutes (the call\'s mean x played / said): a perfect minutes forecast, which no model has. "Walk-forward minutes" is tools/props.js\'s own backtest rule on the box\'s side (who dressed, known after the fact). Lines where the replay has no row are left out of every row.', '',
    '| Version | Lines | Model said | Over hit | Log loss, model - DK | 3-pt Overs | 3-pt Unders |', '|---|---|---|---|---|---|---|'];
  const base = trial.filter(x => x.muWf != null && x.m > 0);
  const variant = (label, pf) => { const ls = base.map(x => ({ ...x, pModel: pf(x) })); const s = scores(ls, true); out.push(`| ${label} | ${s.n} | ${pc(s.modelSaid)} | ${pc(s.overRate)} | ${sg(s.llDiff, r4)} [${sg(s.llCi[0], r4)}, ${sg(s.llCi[1], r4)}] | ${fu(s.flat.over)} | ${fu(s.flat.under)} |`); return s; };
  const Jt = {};
  Jt.call = variant('The frozen call', x => x.pModel);
  Jt.wf = variant('Walk-forward minutes (the box\'s side)', x => x.pWf);
  const atMin = x => { const mu = x.mu * x.amin / x.m; return PM.pOver(x.line, mu, PM.nbVar(mu, LIVE.var[x.stat])); };
  Jt.actual = variant('The minutes he played', atMin);
  const noPaceOpp = x => { if (!x.pz) return x.pModel; let mu = 0; for (const k of partsOf(x.stat)) mu += x.muParts[k] / (x.pz.pf * x.pz.of[k]); return PM.pOver(x.line, mu, PM.nbVar(mu, LIVE.var[x.stat])); };
  Jt.noPaceOpp = variant('No pace or opponent factor', noPaceOpp);
  const noPace = x => { if (!x.pz) return x.pModel; let mu = 0; for (const k of partsOf(x.stat)) mu += x.muParts[k] / x.pz.pf; return PM.pOver(x.line, mu, PM.nbVar(mu, LIVE.var[x.stat])); };
  Jt.noPace = variant('No pace factor', noPace);
  const wfRatio = J.spread;
  const narrowed = x => PM.pOver(x.line, x.mu, x.sd * x.sd * wfRatio[x.stat].wf2026);
  Jt.narrow = variant('Spread scaled to the 2026 regular season walk-forward\'s own ratio (table 14; no 2026-27 number)', narrowed);
  const half = x => clip(0.5 * x.pModel + 0.5 * x.pMarket);
  Jt.half = variant('Halfway to DraftKings\' fair chance (a yardstick only)', half);
  out.push('');
  const arc = archive.map(x => ({ ...x, pModel: PM.pOver(x.line, x.mu, x.sd * x.sd * wfRatio[x.stat].wf2026) }));
  const sa = scores(arc, true);
  Jt.archiveNarrow = sa;
  out.push(`On the archive the same narrowed spread says the Over ${pc(sa.modelSaid)} (as fitted ${pc(s26.modelSaid)}; it happened ${pc(s26.overRate)}), log loss model - DK ${sg(sa.llDiff, r4)} (as fitted ${sg(s26.llDiff, r4)}).`, '');
  md.push(out.join('\n')); J.whatIf = Jt;
}

/* ---------- the findings, from the numbers above ---------- */
{
  const A = J.byStat.All, Dov = J.byDisagree['model 10+ above'], Dun = J.byDisagree['DK 10+ points above the model'];
  const cal = J.calibration, lo = cal[0].model, hi = cal[cal.length - 1].model;
  const ob = J.biasBets['Over bets'], ub = J.biasBets['Under bets'];
  const bA = J.biasByStat.All, bP = J.biasByStat.Points, bArc = J.biasArchive.All;
  const op = J.openers, pace = J.pace, sd = J.bySide.All;
  const rt = pace['rate:Trial games (2026-27)'], rPrev = ['2023-24: first 15 game days', '2024-25: first 15 game days', '2025-26: first 15 game days'].map(k => pace['rate:' + k]);
  const pPrev = ['2023-24: its first 15 game days', '2024-25: its first 15 game days', '2025-26: its first 15 game days'].map(k => pace[k]);
  const bench = J.byStarter['Came off the bench'], big = J.biasByMin['34 and up'];
  const f = [];
  f.push('## Findings', '',
    `The trial, ${A.n} lines on ${A.games} games: log loss ${sg(A.llDiff, r4)} against DraftKings, the Over ${pc(A.overRate)} where the model said ${pc(A.modelSaid)} and DraftKings ${pc(A.marketSaid)}. Three things account for the loss, the first by far the largest.`, '',
    `**1. The model is far too sure of itself: it prices its own mean as if it were known.** Its chances sit ${pc(J.sharp.model)} from 50% on average where DraftKings' sit ${pc(J.sharp.market)} (archive: ${pc(J.sharp.archiveModel)} against ${pc(J.sharp.archiveMarket)}). Where it said the Over under 30%, the Over hit ${pc(lo[2])} (said ${pc(lo[1])}); where it said 70% or more, ${pc(hi[2])} (said ${pc(hi[1])}). The ${J.lossShare.trial.lines} lines (${pc(J.lossShare.trial.lines / J.lossShare.trial.of)}) where it and DraftKings differ by 10 points or more carry ${pc(J.lossShare.trial.share)} of its log-loss deficit (archive: ${pc(J.lossShare.archive.share)}), and there DraftKings was right: with the model 10+ above, the Over hit ${pc(Dov.overRate)} where the model said ${pc(Dov.modelSaid)} and DraftKings ${pc(Dov.marketSaid)}; with DraftKings 10+ above, ${pc(Dun.overRate)} where the model said ${pc(Dun.modelSaid)} and DraftKings ${pc(Dun.marketSaid)}. Within 5 points of each other the two are nearly level (${sg(J.byDisagree['within 5'].llDiff, r4)}). It is not the outcome's spread: the squared errors are smaller than the variance the call said (points ${r3(J.spread.pts.trial)} of it, pts+reb+ast ${r3(J.spread.pra.trial)}; the 2026 walk-forward's own ${r3(J.spread.pts.wf2026)} and ${r3(J.spread.pra.wf2026)}), and narrowing it to the walk-forward's ratio makes the loss worse (${sg(J.whatIf.narrow.llDiff, r4)}). The missing piece is the uncertainty in the mean itself, which a negative binomial around a point mean leaves out; a yardstick, not a candidate: halfway to DraftKings' fair chance the deficit is ${sg(J.whatIf.half.llDiff, r4)}. The archive shows the same, so this is the model, not the season.`, '',
    `**2. The disagreements are mostly minutes, and the minutes rule over-hands minutes to the players it calls.** On the 3-point Over bets the call said ${r1(ob.m)} minutes and they played ${r1(ob.amin)} (minutes ${sg(ob.minutes)} of the ${sg(ob.total)} the mean ran over the stat, the rate ${sg(ob.rateAtPace)}); on the Under bets it said ${r1(ub.m)} and they played ${r1(ub.amin)} (${sg(ub.minutes)} of ${sg(ub.total)}). The call's minutes miss by ${r2(J.minutes.All.mae)} a player, no worse than the walk-forward rule on the side the box lists (${r2(J.minutes.All.wfMae)}; priced on those minutes the loss is the same, ${sg(J.whatIf.wf.llDiff, r4)}), so live availability (the roster less the report) is not the problem: the rule is, against a market that knows rotations, restrictions and roles. Every opening fortnight the rule gives the called players more minutes than they play (${[2024, 2025, 2026, 2027].map(s => sg(op[s].minBias)).join(', ')} a player in 2023-24 to 2026-27, the walk-forward rule on the box's side; in the trial a side's called players who played were said ${r1(J.sides.calledMin)} minutes and played ${r1(J.sides.calledActual)}), the rest going to players it has no call for (rookies without a game on record, the deep bench: ${J.sides.uncalled} of ${J.sides.n} trial sides had one play 15 minutes or more). It is worst at the ends: projected 34+, said ${r1(big.m)} and played ${r1(big.amin)} (minutes ${sg(big.minutes)} of ${sg(big.total)}); off the bench the model said the Over ${pc(bench.modelSaid)} where it hit ${pc(bench.overRate)}.`, '',
    `**3. A season-specific lean to the Over: the mean ran ${sg(bA.total)} a line over the stat (points ${sg(bP.total)}, pts+reb ${sg(J.biasByStat['Pts+reb'].total)}).** Of the ${sg(bA.total)}: minutes ${sg(bA.minutes)}, pace missed ${sg(bA.paceMiss)}, the opponent factor ${sg(bA.opp)}, the rate at the pace played ${sg(bA.rateAtPace)} (points: ${sg(bP.minutes)}, ${sg(bP.paceMiss)}, ${sg(bP.opp)}, ${sg(bP.rateAtPace)}). The league scored less: ${r1(op[2027].ppg)} points a game against ${r1(op.season2026)} last season and ${r1(op[2026].ppg)} in its opening fortnight (the posted totals averaged ${r1(op[2027].posted)}, so the market ran high too). The model expected a pace of ${r2(pace['Trial games (2026-27)'].exp)} and the games were played at ${r2(pace['Trial games (2026-27)'].act)} (${sg(pace['Trial games (2026-27)'].act - pace['Trial games (2026-27)'].exp)}; the three openers before, ${pPrev.map(x => sg(x.act - x.exp)).join(', ')}); the points rate it carried in from last season was ${r2(rt.pts[0])} per 36 minutes where ${r2(rt.pts[1])} was made (the three openers before: ${rPrev.map(x => sg(x.pts[0] - x.pts[1])).join(', ')}); the opponent factor averages above 1 every opening fortnight (${[2024, 2025, 2026, 2027].map(s => r3(op[s].ofPts)).join(', ')} on points). Taking the pace and opponent factors off alone brings the Over to ${pc(J.whatIf.noPaceOpp.modelSaid)} (log loss ${sg(J.whatIf.noPaceOpp.llDiff, r4)}): the lean is real but only a slice of the loss. In money it is worse than in log loss because DraftKings puts its margin on the Over: the Over bets said ${pc(sd.over.said)}, won ${pc(sd.over.won)} (fair ${pc(sd.over.fair)}), ${sg(sd.over.units, r1)} units; the Unders said ${pc(sd.under.said)}, won ${pc(sd.under.won)} (fair ${pc(sd.under.fair)}), ${sg(sd.under.units, r1)}: both sides about as over-sure, the price punishing the Overs. In the 2026 playoffs it leaned the other way (the Over said ${pc(J.checks.archive.modelSaid)}, hit ${pc(J.checks.archive.overRate)}): the playoff factor (${sg(bArc.post)} a line) and the opponent factor (${sg(bArc.opp)}) outweighed the rate it carried in (${sg(bArc.rateAtPace)}) and the minutes (${sg(bArc.minutes)}), leaving the mean level with the stat (${sg(bArc.total)}) but its chance of the Over low; there the Unders won. The lean's sign moves with the season and its context; the over-sureness (1) and the minutes (2) do not.`, '',
    `**The other splits** (tables 3 to 8) sharpen these rather than add a cause. By his games this season: his season opener ${sg(J.byGames['  of which 0 (his season opener)'].llDiff, r4)}, 1-2 games ${sg(J.byGames['  1 to 2'].llDiff, r4)}, 3-5 ${sg(J.byGames['  3 to 5'].llDiff, r4)}, 6+ ${sg(J.byGames['6 to 15'].llDiff, r4)} (no player has 16 yet); a new club ${sg(J.byClub['New club'].llDiff, r4)} against the same club ${sg(J.byClub['Same club'].llDiff, r4)}; the largest quarter of lines ${sg(J.byLineSize['Largest quarter'].llDiff, r4)} against the smallest ${sg(J.byLineSize['Smallest quarter'].llDiff, r4)} (the largest lines' Overs ${sg(J.byLineSize['Largest quarter'].flat.over.units, r1)} units on ${J.byLineSize['Largest quarter'].flat.over.bets}); bench ${sg(J.byStarter['Came off the bench'].llDiff, r4)} against starters ${sg(J.byStarter['Started'].llDiff, r4)}; a late scratch on his side (a called teammate of 20+ who did not play) ${sg(J.byTeammate['A called teammate (projected 20+) did not play: a late scratch'].llDiff, r4)} and an uncalled teammate playing 15+ ${sg(J.byTeammate['A teammate played 15+ minutes with no call'].llDiff, r4)} against neither ${sg(J.byTeammate['Neither surprise'].llDiff, r4)}; a rotation teammate Out on the report ${sg(J.byTeammate['A teammate of 24+ usual minutes Out on the day\'s report'].llDiff, r4)} against none ${sg(J.byTeammate['No such teammate on the report'].llDiff, r4)}; his club on a back-to-back ${sg(J.byB2b['His club on the second night of a back-to-back'].llDiff, r4)} against rested ${sg(J.byB2b['His club rested'].llDiff, r4)}; the point spread no pattern. The worst cells are where the minutes are least known (a new season's first game, a new club, a surprise on the side); the model is level with DraftKings (its interval reaching zero) only in small corners: steals, blocks, a player 1-2 games into the season, the opponent on a back-to-back.`, '',
    'What this suggests for a second model (said here, decided in the study, on seasons up to 2026 only): carry the uncertainty of the mean into the chance (a minutes distribution, or a mean shrunk toward a market-free prior with its own error), and treat the minutes as the first thing to get right (who takes the uncalled minutes, the stars\' early-season minutes, the bench\'s role), before any rate refinement; season-start pace and the opponent factor\'s level are small, checkable corrections.', '');
  md.splice(1, 0, f.join('\n'));
}

fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(J, (k, v) => typeof v === 'number' ? Math.round(v * 1e5) / 1e5 : v, 1) + '\n');
fs.writeFileSync(OUT_MD, md.join('\n') + '\n');
console.log(`written ${path.relative(ROOT, OUT_MD)} and ${path.relative(ROOT, OUT_JSON)}; trial ${trial.length} lines, archive ${archive.length}`);
