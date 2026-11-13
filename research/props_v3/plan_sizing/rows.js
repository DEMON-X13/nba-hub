/* PLAN.md's sizing checks, step 1: the development lines as one table (research only: SIZING, no candidate).
 *
 *   node research/props_v3/plan_sizing/rows.js
 *   writes research/props_v3/cache/plan_sizing/rows_<set>.json (gitignored; about 3 minutes)
 *
 * Two sets of DraftKings' lines, both development data under the plan's rules:
 *   2024     DraftKings' 2023-24 regular-season lines on provider 40, from cache/dk40_2024_lines.csv (the lines without
 *            last_updated, written by lines_clean.js: this loader refuses any file with a seventh column), the window
 *            props_v2's test scored (REG, 24 October 2023 to 14 April 2024), the six base stats, both prices
 *   archive  DraftKings' 2026 play-in and playoff closing lines (data/props_2026.csv, provider 100): SPENT, development
 *            only; the six base stats alone, since the plan's candidate prices those
 *
 * EVERY posted line is kept, graded or not (a player who did not play is void, one with no projection has no call, a
 * line he landed exactly on is a push), so that any aggregate over a game, a night or a player's lines (the stat mix's
 * common level, a night factor) can be built from every line posted and never from the graded ones (lesson L4).
 *
 * The forecaster is a STAND-IN, used only to size the plan's bar: tools/props.js's walk-forward folds as props_v2
 * stored them (research/props_v2/results/fold_params.json: the 2024 fold fitted on 2022-23 box scores, the 2026 fold on
 * 2022-23 to 2024-25), projected through research/props_v2/cand_fix_lib.js on the box score's list of who dressed, as
 * why_lines.js projects them. Both folds carry 2022-23's box-score outcomes, so no candidate may stand on them (data.md
 * section 6): the plan's candidate refits its projection layer without 2022-23. This table is not that layer.
 *
 * Inputs a candidate could have before tip-off are kept apart from outcomes: `o`, `y`, `minPlayed` and `status` are
 * outcomes (read by the scorer only); everything else is known before the game (the box scores of earlier games, the
 * schedule, the posted prices). The one exception, said: the stand-in's projection uses the game's own list of who
 * dressed for the side's minutes, which is hindsight. The stat mix rescales the projection to DraftKings' level, so the
 * sizing reads its minutes only through the level's weights, the raw disagreement (S_d), the level part (S_mixlvl) and
 * the leak check's choice of early exits; the plan's candidate does not use that list.
 *
 * Nothing of 2022-23's DraftKings lines exists on disk or is read; the replay walks the 2021-22 and 2022-23 box scores
 * as history and collects rows only from 2023-24 on, as why_lines.js does.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const PM = require(path.join(ROOT, 'tools', 'props.js'));
const F = require(path.join(ROOT, 'tools', 'props_feed.js'));
const C = require(path.join(ROOT, 'research', 'props_v2', 'cand_fix_lib.js'));
const OUT = path.join(ROOT, 'research', 'props_v3', 'cache', 'plan_sizing');
const LINES24 = path.join(ROOT, 'research', 'props_v3', 'cache', 'dk40_2024_lines.csv');
const STARTS24 = path.join(ROOT, 'research', 'props_v3', 'cache', 'dk40_2024_starts.csv');
const t0 = Date.now();
const log = m => console.log(`[${((Date.now() - t0) / 1000).toFixed(0)}s] ${m}`);
const csvRows = file => { const t = fs.readFileSync(file, 'utf8').split('\n').filter(Boolean); const h = t.shift().split(','); return { h, rows: t.map(l => l.split(',')) }; };

const Dd = C.loadData();
const R = C.replayX(Dd.games, Dd.boxes, Dd.tbox, { collect: true, from: 2024 });
if (R.rows.some(r => r.season < 2024)) throw new Error('a row of a season before 2023-24 was collected');
if (R.rows.some(r => r.season > C.LAST)) throw new Error('a row after 2026');
const rows = R.rows, sides = C.sidesOf(rows);
const gameOf = new Map(Dd.games.map(g => [g.game_id, g]));
const foldP = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v2', 'results', 'fold_params.json'), 'utf8'));
log(`replay: ${rows.length} rows from 2023-24 on`);

/* the game lines, the closing ones odds_hist.csv carries; only the two development sets' seasons are kept (2024,
   2026), so no 2022-23 row is ever parsed into a number here */
const oh = new Map();
{ const { h, rows: rr } = csvRows(path.join(ROOT, 'data', 'odds_hist.csv')); const ix = k => h.indexOf(k);
  for (const v of rr) { const s = +v[ix('season')]; if (s !== 2024 && s !== 2026) continue; oh.set(v[ix('game_id')], { homeLine: v[ix('home_line')] === '' ? null : +v[ix('home_line')], total: v[ix('total')] === '' ? null : +v[ix('total')] }); } }

function linesOf(set) {
  if (set === '2024') {
    const { h, rows: rr } = csvRows(LINES24);
    if (h.join(',') !== 'game_id,player_id,stat,line,over,under') throw new Error(`${path.relative(ROOT, LINES24)}: not the six clean columns (a seventh, last_updated, is refused)`);
    if (rr.some(v => v.length !== 6)) throw new Error('a row with other than six fields');
    const starts = new Map(csvRows(STARTS24).rows.map(v => [v[0], v[1]]));
    const out = [];
    for (const v of rr) {
      const g = gameOf.get(v[0]);
      if (!g || g.type !== 'REG' || g.date < '2023-10-24' || g.date > '2024-04-14' || !PM.STATS.includes(v[2])) continue;
      const over = F.propAmerican(v[4]), under = F.propAmerican(v[5]);
      if (over == null || under == null || !Number.isFinite(+v[3])) continue;
      out.push({ game: v[0], player: v[1], stat: v[2], line: +v[3], over, under, start: starts.get(v[0]) || null });
    }
    return out;
  }
  if (set === 'archive') {
    const { h, rows: rr } = csvRows(path.join(ROOT, 'data', 'props_2026.csv'));
    if (h.join(',') !== 'game_id,player_id,stat,line,over,under') throw new Error('props_2026.csv: not its six columns');
    const out = [];
    for (const v of rr) {
      if (!PM.STATS.includes(v[2])) continue;
      const over = F.propAmerican(v[4]), under = F.propAmerican(v[5]);
      if (over == null || under == null || !Number.isFinite(+v[3])) continue;
      out.push({ game: v[0], player: v[1], stat: v[2], line: +v[3], over, under, start: null });
    }
    return out;
  }
  throw new Error(set);
}

for (const set of ['2024', 'archive']) {
  const rec = linesOf(set);
  const P = foldP[set === '2024' ? '2024' : '2026'];
  const games = new Set(rec.map(r => r.game));
  const pr = C.projectX(rows, sides, P, {}, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(rows[i].game + '|' + rows[i].id, { x, r: rows[i] });
  /* who is on the game's box at all, and who played: the grading's (outcomes) */
  const listed = new Map();
  for (const gid of games) for (const [team, side] of Object.entries(Dd.boxes[gid] || {})) for (const r of side) listed.set(gid + '|' + r.id, { team, played: r.min > 0 && !r.dnp, min: r.min, y: r.y });
  const posOf = new Map(); for (const r of rows) if (games.has(r.game)) posOf.set(r.game + '|' + r.id, r.f.pos);
  const out = []; const n = { graded: 0, void: 0, nocall: 0, push: 0 };
  for (const l of rec) {
    const k = l.game + '|' + l.player, g = gameOf.get(l.game), b = listed.get(k), a = at.get(k);
    const o = { set, game: l.game, date: g.date, month: g.date.slice(0, 7), type: g.type, start: l.start, player: l.player, stat: l.stat, line: l.line, over: l.over, under: l.under,
      home: b ? (b.team === g.home ? 1 : 0) : null, team: b ? b.team : null, pos: posOf.get(k) || null };
    const gl = oh.get(l.game); o.homeLine = gl ? gl.homeLine : null; o.total = gl ? gl.total : null;
    if (a) {
      const r = a.r, x = a.x;
      Object.assign(o, { mu: x.mu[l.stat], v: x.v[l.stat], ab: P.var[l.stat], mproj: x.m, nCur: r.f.nCur, prevN: r.f.prevN, missed: r.x ? r.x.missed : null, newTeam: r.x ? r.x.newTeam : null,
        teamN: r.x ? r.x.teamN : null, naive: r.f.naive[l.stat], posRate: r.f.posRate[l.stat], oppF: r.oppF ? r.oppF[l.stat] : null,
        cur5: r.f.cur.length ? r.f.cur.slice(-5).reduce((s, z) => s + z, 0) / Math.min(5, r.f.cur.length) : null,
        cur30: r.f.cur.length ? r.f.cur.reduce((s, z) => s + z, 0) / r.f.cur.length : null, prevMean: r.f.prevMean });
    }
    /* outcomes, for the scorer alone */
    if (!b || !b.played) { o.status = 'void'; n.void++; }
    else if (!a) { o.status = 'nocall'; n.nocall++; }
    else { const y = PM.yOf(b.y, l.stat); o.y = y; o.minPlayed = b.min; if (y === l.line) { o.status = 'push'; n.push++; } else { o.status = 'graded'; o.o = y > l.line ? 1 : 0; n.graded++; } }
    out.push(o);
  }
  const file = path.join(OUT, `rows_${set}.json`);
  fs.writeFileSync(file, JSON.stringify({ set, fold: set === '2024' ? 'tools/props.js 2024 fold (fitted on 2022-23)' : 'tools/props.js 2026 fold (fitted on 2022-23 to 2024-25)', counts: { posted: rec.length, ...n }, lines: out }));
  log(`${set}: ${rec.length} posted lines on ${games.size} games; graded ${n.graded}, void ${n.void}, no call ${n.nocall}, push ${n.push} -> ${path.relative(ROOT, file)}`);
}
