/* The props shadow ledger: the model's call on every player in every game to come, frozen at tip-off, graded after
 * the final against DraftKings' closing main lines, and judged once against a bar written down before its first call.
 *
 *   tools/props.js runs it in the job, after the projections; tools/props_check.js holds it to the last commit's.
 *
 * Why. The props model (tools/props.js) beat a naive own-average baseline on every stat in every walk-forward season,
 * and lost to DraftKings' closing lines on the 83 archived 2026 play-in and playoff games (README "Player props"). ESPN
 * keeps no regular-season lines, so whether it can beat DraftKings on the regular season can only be learnt from now on.
 * Until the bar below is passed, the page shows the model as on trial: beside DraftKings' line and fair chance, never in
 * a suggestion, and never with the words "model says" or "edge".
 *
 * What a call is. For each game to come (not yet tipped), the projections the run hands the page: for every player
 * projected MIN_SHOWN minutes or more, his minutes, the mean of each of the eleven stats, and his double- and
 * triple-double chances; the spread of each stat is the fit's (fits[call.fit].var, negative binomial with variance
 * A x mean^B), so the call is the whole distribution. A call is rewritten by any run before tip-off whose numbers
 * differ, and frozen by the first run at or after it (the tip the call holds or the one games.csv now gives, whichever
 * is earlier, or once games.csv calls the game live or final): from then on it never changes.
 *
 * The grade. Once the game is final, its box score is in and DraftKings' closing lines have been read (the record,
 * tools/props_record.js), every closing main line on a player with a call is graded: the model's chance of the Over
 * (P(stat >= floor(line) + 1) from the frozen mean and the fit's spread), DraftKings' fair chance (the whole margin on
 * the Over: 1 - implied(Under), the method that scored best on the archive) and the stat from the box score. A player
 * who did not play is void (DraftKings voids the bet), a line on a player with no call is counted and not graded.
 * The lines are appended to data/props_shadow_lines.csv in grading order (game_id, player_id, stat, p_model,
 * p_market, y; the line and prices are the record's, data/props_<season>.csv), never rewritten.
 *
 * The bar (BAR below, written into the ledger before its first call and held there by props_check.js, its numbers
 * with it: lines 30000, edge 0.03, ci [0.05, 0.95], boot 10000, seed 0; the verdict is worked from the ledger's copy):
 * decided once 30,000 lines are graded over or under (about five weeks of the regular season at 120 lines a game), on
 * the first 30,000 in grading order: PASS only if the model beats DraftKings' fair chance on both log loss and Brier
 * with bootstrap 90% intervals (resampling games, the bar's own bootstrap, barCI) wholly below zero, and flat one-unit
 * bets where the model's chance of a side is 3 points or more above the chance its price implies are up; otherwise
 * FAIL, and the calls stop. Until then the summary gives the running numbers and how many of the 30,000 are in, never a
 * verdict or a word of passing.
 *
 * Files: data/props_shadow.json (the bar, the fits, the calls, the verdict, the summary; one call a line) and
 * data/props_shadow_lines.csv (the graded lines). Never edited by hand: they are the record.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const L = require('./lib');
const F = require('./props_feed');
const PM = require('./props');
const REC = require('./props_record');

const DATA = process.env.NBA_DATA_DIR || path.join(L.ROOT, 'data');
const LEDGER = () => process.env.NBA_PROPS_LEDGER || path.join(DATA, 'props_shadow.json');
const LINES = () => process.env.NBA_PROPS_LINES || path.join(DATA, 'props_shadow_lines.csv');
const LEDGER_REL = 'data/props_shadow.json';
const LINE_COLS = ['game_id', 'player_id', 'stat', 'p_model', 'p_market', 'y'];
const CALL_LAYOUT = ['min'].concat(PM.ALL, ['dd', 'td']);

/* The pre-registered bar. Set 2026-10-15, before the ledger's first call; props_check.js fails a ledger whose bar is
   not this one or not the last commit's. Its numbers are written into it (lines, edge, ci, boot, seed) and the verdict
   is worked from the ledger's own copy of them (decide(rows, at, Lg.bar)), so no constant in the code can move it. */
const BAR = {
  lines: 30000,
  edge: 0.03,                       // a flat bet: the model's chance of its side at least this far above its price's implied chance
  ci: [0.05, 0.95],                 // the interval: these percentiles of the resampled mean difference (a 90% interval)
  boot: 10000,                      // resamples of the sample's games
  seed: 0,                          // the resampling's seed (mulberry32, barCI below)
  sample: 'the first 30,000 graded lines that went over or under (a push drops out), in the order they were graded (data/props_shadow_lines.csv\'s order: games by grading run, then tip-off, then game id; within a game by player id and stat)',
  pass_if: [
    'log loss: the model\'s chance of the Over minus DraftKings\' fair chance (the whole margin on the Over, 1 - implied(Under)), chances clipped to 1e-6: its bootstrap 90% interval wholly below 0 (10,000 resamples of the games in the sample, seed 0, the 5th to 95th percentile of the resampled mean difference)',
    'Brier score: the same, its interval wholly below 0',
    'flat one-unit bets on the side whose model chance is 3 points or more above the chance its closing price implies (the margin left in), at that price, are up in units on those lines (more than 0; no bets is not up)',
  ],
  otherwise: 'FAIL: the calls stop (lines already frozen are still graded), and the page never puts a prop in a suggestion or says "model says" or "edge" on one',
  if_pass: 'PASS makes the model a candidate to be shown as more than on trial, by a change of its own; nothing on the page moves by itself',
  before: 'no verdict before 30,000: until then the summary gives the running numbers and how many of the 30,000 are in, never a verdict or a word of passing',
};
/* the bar's own bootstrap (not the research code's): groups = [[sum of differences, count]] one a game; bar.boot
   resamples of the games with replacement, drawn by mulberry32 seeded with bar.seed (each draw the game at
   floor(u x n)); each resample's mean is its sum over its count; the result is the sorted means at floor(q x boot) for
   q in bar.ci, to six decimals */
function barRng(seed) { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
function barCI(groups, bar) {
  if (!groups.length) return null;
  const R = barRng(bar.seed), n = groups.length, means = new Float64Array(bar.boot);
  for (let b = 0; b < bar.boot; b++) { let s = 0, c = 0; for (let j = 0; j < n; j++) { const g = groups[Math.floor(R() * n)]; s += g[0]; c += g[1]; } means[b] = c ? s / c : 0; }
  means.sort();
  const r6 = x => Math.round(x * 1e6) / 1e6;
  return bar.ci.map(q => r6(means[Math.min(bar.boot - 1, Math.floor(q * bar.boot))]));
}
const CALL_FIELDS = ['tip', 'called_at', 'fit', 'players'];

const iso = d => new Date(d).toISOString().slice(0, 16) + 'Z';
const r4s = x => x.toFixed(4);
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const fitId = params => crypto.createHash('sha256').update(JSON.stringify({ var: params.var, rho: params.rho })).digest('hex').slice(0, 12);

/* ---------- files ---------- */
function newLedger(at) {
  return { what: 'The props shadow ledger (tools/props_ledger.js, README "Player props"): the props model\'s call on every player in every game to come, frozen at tip-off and graded after the final against DraftKings\' closing main lines, beside DraftKings\' fair chance. The page shows the model as on trial until the bar is passed.',
    model: 'tools/props.js', bar: BAR, bar_registered: iso(at), run_at: iso(at), fits: {}, decision: null, summary: null, calls: {} };
}
function readLedger(f = LEDGER()) { return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null; }
/* one call a line, so a run's change is a few lines of diff */
function stringify(Lg) {
  const top = Object.entries(Lg).filter(([k]) => k !== 'calls').map(([k, v]) => ` ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  const calls = Object.entries(Lg.calls || {}).map(([k, v]) => `  ${JSON.stringify(k)}: ${JSON.stringify(v)}`);
  return '{\n' + top.join(',\n') + ',\n "calls": {' + (calls.length ? '\n' + calls.join(',\n') + '\n ' : '') + '}\n}\n';
}
function readLines(f = LINES()) {
  if (!fs.existsSync(f)) return [];
  const ls = fs.readFileSync(f, 'utf8').split('\n').filter(Boolean);
  if (ls.shift() !== LINE_COLS.join(',')) throw new Error(`${path.basename(f)}: unexpected header`);
  return ls.map(l => { const v = l.split(','); return { game_id: v[0], player_id: v[1], stat: v[2], p_model: +v[3], p_market: +v[4], y: +v[5], raw: l }; });
}
const lineText = r => [r.game_id, r.player_id, r.stat, r4s(r.p_model), r4s(r.p_market), r.y].join(',');

/* ---------- grading ---------- */
/* the record for the seasons in question: game id -> its rows, and each game's read */
function recordIndex(seasons) {
  const by = new Map();
  for (const s of seasons) for (const r of REC.readRecord(s)) { if (!by.has(r.game_id)) by.set(r.game_id, []); by.get(r.game_id).push(r); }
  return { by, reads: REC.readReads() };
}
const keyOf = (game, player, stat) => game + '|' + player + '|' + stat;
/* one game's graded lines from its frozen call, its closing lines and its box score (boxes: props.loadBoxes()) */
function gradeGame(gid, call, recRows, boxes, fit) {
  const box = boxes[gid] || {}, played = {};
  for (const rows of Object.values(box)) for (const r of rows) played[r.id] = r;
  const out = [], n = { voids: 0, noCall: 0 };
  const order = s => PM.ALL.indexOf(s);
  const rec = [...recRows].sort((a, b) => a.player_id < b.player_id ? -1 : a.player_id > b.player_id ? 1 : order(a.stat) - order(b.stat));
  for (const l of rec) {
    const c = call.players[l.player_id];
    if (!c) { n.noCall++; continue; }
    const b = played[l.player_id];
    if (!b || b.min <= 0 || b.dnp) { n.voids++; continue; }
    const mu = c[CALL_LAYOUT.indexOf(l.stat)];
    const g = PM.gradeLine(l.line, l.over, l.under, mu, fit.var[l.stat], PM.yOf(b.y, l.stat));
    out.push({ game_id: gid, player_id: l.player_id, stat: l.stat, p_model: +r4s(g.pModel), p_market: +r4s(g.pMarket), y: PM.yOf(b.y, l.stat) });
  }
  return { rows: out, ...n };
}
/* a graded game can be graded once it is final, its box score is in and its closing lines were read (or are known
   not to be there) */
function gradeable(gid, g, boxes, reads) {
  if (!g || g.status !== 'final') return false;
  const b = boxes[gid]; if (!b || !b[g.home] || !b[g.away]) return false;
  const r = reads[gid]; return !!r && ['ok', 'none', 'gave_up'].includes(r.status);
}

/* ---------- the summary and the bar ---------- */
/* graded lines joined to their closing prices: the lines the bar counts, in file order */
function compared(lines, recIdx) {
  const price = new Map();
  for (const rows of recIdx.by.values()) for (const r of rows) price.set(keyOf(r.game_id, r.player_id, r.stat), r);
  const out = [];
  for (const x of lines) {
    const r = price.get(keyOf(x.game_id, x.player_id, x.stat));
    if (!r) continue;
    const result = x.y > r.line ? 'over' : x.y < r.line ? 'under' : 'push';
    if (result === 'push') continue;
    out.push({ game: x.game_id, stat: x.stat, pModel: x.p_model, pMarket: x.p_market, over: r.over, under: r.under, result });
  }
  return out;
}
function scores(rows, bar = BAR) {
  if (!rows.length) return null;
  const o = x => x.result === 'over' ? 1 : 0;
  const ll = p => x => { const q = clip(p(x)); return o(x) ? -Math.log(q) : -Math.log(1 - q); };
  const br = p => x => (p(x) - o(x)) ** 2;
  const pm = x => x.pModel, pq = x => x.pMarket;
  const avg = f => rows.reduce((s, x) => s + f(x), 0) / rows.length;
  const groups = (f, g) => { const m = new Map(); for (const x of rows) { const v = m.get(x.game) || [0, 0]; v[0] += f(x) - g(x); v[1]++; m.set(x.game, v); } return [...m.values()]; };
  const r6 = x => Math.round(x * 1e6) / 1e6;
  return { lines: rows.length, games: new Set(rows.map(x => x.game)).size, over_rate: r6(avg(o)), model_said: r6(avg(pm)), market_said: r6(avg(pq)),
    model: { logloss: r6(avg(ll(pm))), brier: r6(avg(br(pm))) }, market: { logloss: r6(avg(ll(pq))), brier: r6(avg(br(pq))) },
    logloss_diff: r6(avg(ll(pm)) - avg(ll(pq))), logloss_diff_ci90: barCI(groups(ll(pm), ll(pq)), bar),
    brier_diff: r6(avg(br(pm)) - avg(br(pq))), brier_diff_ci90: barCI(groups(br(pm), br(pq)), bar) };
}
/* flat one-unit bets at the closing price on the side whose model chance is bar.edge or more above the chance its price
   implies (the margin left in), the side with the larger gap where both are; worked here, not by the research code */
function flat(rows, bar = BAR) {
  const out = { over: { bets: 0, won: 0, units: 0 }, under: { bets: 0, won: 0, units: 0 } };
  for (const x of rows) {
    if (x.result === 'push') continue;
    const eo = x.pModel - F.propImplied(x.over), eu = (1 - x.pModel) - F.propImplied(x.under);
    const side = eo >= bar.edge && eo >= eu ? 'over' : eu >= bar.edge ? 'under' : null;
    if (!side) continue;
    const price = side === 'over' ? x.over : x.under, b = out[side];
    b.bets++;
    if (x.result === side) { b.won++; b.units += price > 0 ? price / 100 : 100 / -price; } else b.units -= 1;
  }
  const r2 = x => Math.round(x * 100) / 100;
  for (const b of Object.values(out)) b.units = r2(b.units);
  return { edge: bar.edge, over: out.over, under: out.under, all: { bets: out.over.bets + out.under.bets, won: out.over.won + out.under.won, units: r2(out.over.units + out.under.units) } };
}
function standing(n, decision, bar = BAR) {
  if (decision) return `decided at ${decision.lines} lines on ${decision.decided_at}: ${decision.verdict}`;
  return `${n} of ${bar.lines} graded lines toward the verdict; the bar is judged at ${bar.lines}, not before`;
}
/* the verdict, worked from the bar as the ledger holds it (never from a constant in the code) */
function decide(rows, at, bar = BAR) {
  if (rows.length < bar.lines) return null;
  const sample = rows.slice(0, bar.lines), sc = scores(sample, bar), fl = flat(sample, bar);
  const ok = sc.logloss_diff_ci90[1] < 0 && sc.brier_diff_ci90[1] < 0 && fl.all.units > 0;
  return { verdict: ok ? 'PASS' : 'FAIL', decided_at: iso(at), lines: bar.lines, games: sc.games, last_game: sample[sample.length - 1].game, scores: sc, flat: fl };
}
function summarize(Lg, lines, recIdx) {
  const calls = Object.values(Lg.calls);
  const rows = compared(lines, recIdx);
  const graded = calls.filter(c => c.graded);
  return {
    calls: calls.length, to_come: calls.filter(c => !c.frozen).length, frozen_awaiting_grade: calls.filter(c => c.frozen && !c.graded).length,
    graded_games: graded.length, lines_graded: lines.length, pushes: lines.length - rows.length,
    voids: graded.reduce((s, c) => s + c.graded.voids, 0), no_call: graded.reduce((s, c) => s + c.graded.noCall, 0),
    compared: rows.length, scores: scores(rows, Lg.bar), flat: rows.length ? flat(rows, Lg.bar) : null,
    standing: standing(Math.min(rows.length, Lg.bar.lines), Lg.decision, Lg.bar),
  };
}

/* ---------- the run ---------- */
function callOf(gm, fid, now) {
  const players = {};
  for (const list of Object.values(gm.players)) for (const p of list) players[p.id] = CALL_LAYOUT.map(k => k === 'min' ? p.min : k === 'dd' || k === 'td' ? p[k] : p.mu[k]);
  return { tip: gm.tip, called_at: iso(now), fit: fid, players, frozen: false, frozen_at: null, graded: null };
}
const sameCall = (a, b) => a.tip === b.tip && a.fit === b.fit && JSON.stringify(a.players) === JSON.stringify(b.players);
function started(call, g, now) {
  const nowIso = iso(now);
  if (g && (g.status === 'live' || g.status === 'final')) return true;
  const tip = [call.tip, g && g.tip].filter(Boolean).sort()[0];
  return !!tip && tip <= nowIso;
}
/* upcoming: tools/props.js liveProjections(); params: the constants in use; games: the games table (props.loadGames or
   lib.readGames); boxes: props.loadBoxes() */
function run({ upcoming, params, games, now = new Date(), boxes = null, log = L.log, write = true }) {
  const old = readLedger();
  if (old && JSON.stringify(old.bar) !== JSON.stringify(BAR)) throw new Error('the bar in the ledger is not the one registered (BAR): nothing is written');
  const Lg = old ? JSON.parse(JSON.stringify(old)) : newLedger(now);
  const fid = fitId(params);
  if (!Lg.fits[fid]) Lg.fits[fid] = { var: params.var, rho: params.rho, registered: iso(now) };
  const byId = new Map(games.map(g => [g.game_id, g]));
  const n = { made: 0, rewritten: 0, frozen: 0, graded: 0, dropped: 0, lines: 0 };
  /* 1. freeze what has started; drop a call whose game left the schedule before it tipped */
  for (const gid of Object.keys(Lg.calls)) {
    const c = Lg.calls[gid], g = byId.get(gid);
    if (c.frozen) continue;
    if (started(c, g, now)) { c.frozen = true; c.frozen_at = iso(now); n.frozen++; }
    else if (!g) { delete Lg.calls[gid]; n.dropped++; }
  }
  /* 2. grade what is final, has its box score and its closing lines */
  const seasons = [...new Set(Object.keys(Lg.calls).map(gid => +gid.slice(0, 4)))];
  const recIdx = recordIndex(seasons);
  const todo = Object.entries(Lg.calls).filter(([gid, c]) => c.frozen && !c.graded).map(([gid]) => gid)
    .sort((a, b) => { const ta = Lg.calls[a].tip, tb = Lg.calls[b].tip; return ta < tb ? -1 : ta > tb ? 1 : a < b ? -1 : 1; });
  let fresh = [];
  if (todo.length) {
    boxes = boxes || PM.loadBoxes(DATA);
    for (const gid of todo) {
      const g = byId.get(gid);
      if (!gradeable(gid, g, boxes, recIdx.reads)) continue;
      const c = Lg.calls[gid];
      const gr = gradeGame(gid, c, recIdx.by.get(gid) || [], boxes, Lg.fits[c.fit]);
      fresh = fresh.concat(gr.rows);
      c.graded = { at: iso(now), lines: gr.rows.length, voids: gr.voids, noCall: gr.noCall };
      n.graded++; n.lines += gr.rows.length;
    }
  }
  const lines = readLines().concat(fresh);
  /* 3. the verdict, once the sample is in; never revisited */
  if (!Lg.decision) Lg.decision = decide(compared(lines, recIdx), now, Lg.bar);
  const stopped = !!Lg.decision && Lg.decision.verdict === 'FAIL';
  /* 4. a call for every game to come (none once the bar has failed) */
  if (stopped) { for (const gid of Object.keys(Lg.calls)) if (!Lg.calls[gid].frozen) { delete Lg.calls[gid]; n.dropped++; } }
  else for (const [gid, gm] of Object.entries(upcoming || {})) {
    const oldC = Lg.calls[gid];
    if (oldC && oldC.frozen) continue;
    if (started({ tip: gm.tip }, byId.get(gid), now)) continue;      // never a call at or after tip-off
    const c = callOf(gm, fid, now);
    if (!Object.keys(c.players).length) continue;
    if (!oldC) { Lg.calls[gid] = c; n.made++; }
    else if (!sameCall(oldC, c)) { Lg.calls[gid] = c; n.rewritten++; }
  }
  Lg.calls = Object.fromEntries(Object.entries(Lg.calls).sort((a, b) => a[1].tip < b[1].tip ? -1 : a[1].tip > b[1].tip ? 1 : a[0] < b[0] ? -1 : 1));
  /* fits no call uses and none graded with are not kept */
  const used = new Set(Object.values(Lg.calls).map(c => c.fit));
  for (const k of Object.keys(Lg.fits)) if (!used.has(k)) delete Lg.fits[k];
  Lg.summary = summarize(Lg, lines, recIdx);
  const body = x => stringify({ ...x, run_at: '' });
  const changed = !old || body(old) !== body(Lg) || fresh.length > 0;
  if (changed && write) {
    Lg.run_at = iso(now);
    fs.writeFileSync(LEDGER(), stringify(Lg));
    if (fresh.length) {
      const f = LINES();
      if (!fs.existsSync(f)) fs.writeFileSync(f, LINE_COLS.join(',') + '\n');
      fs.appendFileSync(f, fresh.map(lineText).join('\n') + '\n');
    }
  }
  const s = Lg.summary;
  log(`props ledger: ${s.calls} calls (${s.to_come} to come, ${s.frozen_awaiting_grade} frozen awaiting a grade, ${s.graded_games} games graded) | this run: ${n.made} made, ${n.rewritten} rewritten, ${n.frozen} frozen, ${n.graded} graded (${n.lines} lines), ${n.dropped} dropped | ${changed ? 'written' : 'nothing changed'}`);
  log(`  where it stands: ${s.standing}${s.scores ? `; on ${s.compared} lines log loss model ${s.scores.model.logloss.toFixed(4)} DraftKings ${s.scores.market.logloss.toFixed(4)}, Brier ${s.scores.model.brier.toFixed(4)} vs ${s.scores.market.brier.toFixed(4)}` : ''}`);
  return { ledger: Lg, n, changed };
}

module.exports = { BAR, barCI, barRng, LEDGER, LINES, LEDGER_REL, LINE_COLS, CALL_LAYOUT, CALL_FIELDS, fitId, newLedger, readLedger, stringify, readLines, lineText, recordIndex, gradeGame, gradeable, compared, scores, flat, decide, summarize, started, callOf, run };

/* node tools/props_ledger.js init: write the ledger with the bar and no call, so the bar is on record before the first
   call is made (the job's first run then makes them); refuses if a ledger is already there */
if (require.main === module) {
  if (process.argv[2] === 'init') {
    if (fs.existsSync(LEDGER())) { console.error(`${LEDGER_REL} is already there: nothing written`); process.exit(1); }
    const Lg = newLedger(process.env.NBA_NOW ? new Date(process.env.NBA_NOW) : new Date());
    Lg.summary = summarize(Lg, [], { by: new Map(), reads: {} });
    fs.writeFileSync(LEDGER(), stringify(Lg));
    console.log(`${LEDGER_REL}: the bar registered at ${Lg.bar_registered}, no calls yet`);
  } else { console.error('usage: node tools/props_ledger.js init'); process.exit(1); }
}
