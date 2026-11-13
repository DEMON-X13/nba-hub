/* The test's validity checks V0 to V3 (PLAN.md 3.4): research/props_v2/validity.js's checks, line for line, with its
 * three inputs made something the caller hands in (PLAN.md: "a change of the script's inputs"). Research only.
 *
 *   node research/props_v3/test/validity_ma.js --reproduce
 *       on 2023-24 with validity.js's own inputs (props_v2's data, research/props.json's 2024 fold, the naive spread
 *       fitted on 2022-23): every figure must be validity.js's own (research/props_v2/cache/validity_2024.json) to the
 *       digit, or it throws. This is the test of the change: nothing of 2022-23's lines is read.
 *   node research/props_v3/test/validity_ma.js --test
 *       THE TEST STEP ONLY, after the preregistration: on DraftKings' 2022-23 lines (research/props_v2/cache/
 *       props40_2023.csv, the only reader of its stamp being V1), with P23 (frozen/ma_frozen.json's constants, fitted on
 *       2021-22) for the projections and the yardstick, the naive spread fitted on 2021-22, and MA's data (2020-21 to
 *       2025-26 boxes): writes research/props_v3/cache/validity_2023.json. Thresholds: validity_lib.js's TH, checked
 *       against research/props_v2/results/validity_ref.json as validity.js checks them.
 *
 * The checks, as validity.js states them: V0 the first item is the Over on every stat; V1 timing, from the stamps
 * (decides only how the result is worded); V2 DraftKings' mean fair chance on early exits less on the rest of the same
 * players, -0.05 or above on 40 exits or more; V3 per stat, DraftKings' gain over the naive forecaster less the
 * yardstick's, at most the archive's figure plus its slack.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..', '..');
const PR = require(path.join(ROOT, 'tools', 'props.js'));
const F = require(path.join(ROOT, 'tools', 'props_feed.js'));
const SL = require(path.join(ROOT, 'research', 'props_v2', 'cand_select_lib.js'));
const VL = require(path.join(ROOT, 'research', 'props_v2', 'validity_lib.js'));
const { BASE, TH, ll, sfAt, previousPlayed } = VL;
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;

/* validity_lib.js gradeLines, with P and NV handed in (there: research/props.json's fold S and the naive spread on the
   seasons before S) */
function gradeLinesWith(D, P, NV, rec) {
  rec = rec.filter(l => BASE.includes(l.stat));
  const games = new Set(rec.map(l => l.game_id));
  const pr = PR.project(D.rows, P, r => games.has(r.game));
  const at = new Map(); for (const [i, x] of pr) at.set(D.rows[i].game + '|' + D.rows[i].id, { x, r: D.rows[i] });
  const played = new Set();
  for (const gid of games) for (const side of Object.values(D.boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);
  const prevOf = previousPlayed(D);
  const L = []; let voids = 0, noProjection = 0, pushes = 0;
  for (const l of rec) {
    const k = l.game_id + '|' + l.player_id;
    if (!played.has(k)) { voids++; continue; }
    const a = at.get(k); if (!a) { noProjection++; continue; }
    const y = PR.yOf(a.r.y, l.stat); if (y === l.line) { pushes++; continue; }
    const nv = SL.naiveMean(a.r.f, l.stat), nn = nv == null ? null : Math.max(nv, 0.01);
    const mu = a.x.mu[l.stat], mm = Math.max(mu, 0.01), Lm = Math.floor(mu) + 0.5, om = y > Lm ? 1 : 0;
    L.push({ game: l.game_id, player: l.player_id, stat: l.stat, line: l.line, y, o: y > l.line ? 1 : 0,
      q: F.propFairOver(l.over, l.under), qSwap: 1 - F.propImplied(l.over),
      pn: nn == null ? null : sfAt(l.line, nn, NV[l.stat]),
      gP: nn == null ? null : ll(sfAt(Lm, nn, NV[l.stat]), om) - ll(sfAt(Lm, mm, P.var[l.stat]), om),
      m: a.x.m, mAct: a.r.min, prev: prevOf.has(k) ? prevOf.get(k) : null, lu: l.lu || null });
  }
  return { L, voids, noProjection, pushes, games };
}
/* validity.js's V0 to V3 blocks, line for line, on graded lines L */
function checks(G, startOf, ref) {
  const L = G.L;
  const byGameCI = (xs, f) => { const m = new Map(); for (const x of xs) { const v = m.get(x.game) || [0, 0]; v[0] += f(x); v[1]++; m.set(x.game, v); } return PR.bootCI([...m.values()]); };
  const out = { thresholds: TH, graded: L.length, games: G.games.size, v0: {}, v2: { byStat: {} }, v3: {} };
  for (const k of BASE) { const xs = L.filter(x => x.stat === k); if (!xs.length) continue;
    out.v0[k] = { n: xs.length, firstIsOver: r4(mean(xs.map(x => ll(x.q, x.o)))), firstIsUnder: r4(mean(xs.map(x => ll(x.qSwap, x.o)))) }; }
  out.v0.holds = Object.values(out.v0).every(v => v.firstIsOver < v.firstIsUnder);
  if (startOf) {
    const dated = L.filter(x => x.lu && startOf.get(x.game));
    const before = dated.filter(x => Date.parse(x.lu) < Date.parse(startOf.get(x.game)));
    const hours = dated.map(x => (Date.parse(x.lu) - Date.parse(startOf.get(x.game))) / 3.6e6).sort((a, b) => a - b);
    out.v1 = { dated: dated.length, undated: L.length - dated.length, shareBeforeStart: r4(before.length / L.length), hoursAfterStartMedian: hours.length ? r4(hours[Math.floor(hours.length / 2)]) : null };
    out.v1.preGame = out.v1.shareBeforeStart >= TH.v1ShareBeforeStart ? 'shown' : 'not shown by the feed: inferred from V2 and V3';
  }
  const v2Lines = L.filter(x => x.m >= TH.v2MinProjected && (!TH.v2PlayedPrevious || x.prev === true));
  let wsum = 0, wd = 0;
  for (const k of BASE) {
    const base = v2Lines.filter(x => x.stat === k), exit = base.filter(x => x.mAct < TH.v2ExitUnder), rest = base.filter(x => x.mAct >= TH.v2ExitUnder);
    if (!exit.length || !rest.length) continue;
    const d = mean(exit.map(x => x.q)) - mean(rest.map(x => x.q));
    out.v2.byStat[k] = { exitLines: exit.length, rest: rest.length, fairOverExits: r4(mean(exit.map(x => x.q))), fairOverRest: r4(mean(rest.map(x => x.q))), diff: r4(d), overHitExits: r4(mean(exit.map(x => x.o))), overHitRest: r4(mean(rest.map(x => x.o))) };
    wsum += exit.length; wd += exit.length * d;
  }
  out.v2.exitLines = wsum; out.v2.exits = new Set(v2Lines.filter(x => x.mAct < TH.v2ExitUnder).map(x => x.game + '|' + x.player)).size;
  out.v2.leftOut = L.filter(x => x.m >= TH.v2MinProjected).length - v2Lines.length;
  out.v2.diff = wsum ? r4(wd / wsum) : null;
  for (const k of BASE) { const xs = L.filter(x => x.stat === k && x.pn != null); if (!xs.length) continue;
    const gain = x => ll(x.pn, x.o) - ll(x.q, x.o), f = x => gain(x) - x.gP;
    out.v3[k] = { n: xs.length, draftKings: r4(mean(xs.map(x => ll(x.q, x.o)))), naive: r4(mean(xs.map(x => ll(x.pn, x.o)))), gain: r4(mean(xs.map(gain))),
      yardstick: r4(mean(xs.map(x => x.gP))), figure: r4(mean(xs.map(f))), figureCi90: byGameCI(xs, f) }; }
  if (JSON.stringify(ref.thresholds) !== JSON.stringify(TH)) throw new Error('the thresholds are not the ones registered in results/validity_ref.json');
  out.v2.holds = out.v2.diff != null && out.v2.exits >= TH.v2MinExits && out.v2.diff >= TH.v2Floor;
  out.v3.against = Object.fromEntries(BASE.map(k => [k, { figure: out.v3[k] && out.v3[k].figure, archive: ref.v3[k].figure, limit: r4(ref.v3[k].figure + TH.v3Slack[k]) }]));
  out.v3.holds = BASE.every(k => out.v3[k] && out.v3[k].figure <= ref.v3[k].figure + TH.v3Slack[k]);
  out.holds = out.v0.holds && out.v2.holds && out.v3.holds;
  return out;
}
/* the fetched csv (the record's columns, then last_updated) and its reads, cut to a season's regular-season window */
function readFetchedLines(file, gameOf, season, from, to, leaveOut = new Set()) {
  const csvF = VL.readFetched(file), readsF = VL.readFetched(path.join(path.dirname(file), 'props40_reads.json'));
  const t = csvF.text.trim().split('\n'), head = t.shift();
  if (head !== 'game_id,player_id,stat,line,over,under,last_updated') throw new Error(`${file}: not fetch_dk40.js's columns`);
  const rec = t.map(l => { const v = l.split(','); return { game_id: v[0], player_id: v[1], stat: v[2], line: +v[3], over: +v[4], under: +v[5], lu: v[6] }; })
    .filter(l => { const g = gameOf.get(l.game_id); return g && g.season === season && g.type === 'REG' && (!from || g.date >= from) && (!to || g.date <= to) && !leaveOut.has(l.game_id); });
  const reads = JSON.parse(readsF.text);
  return { rec, startOf: new Map(Object.entries(reads).map(([k, v]) => [k, v.start || null])), files: { csv: csvF.sha256, reads: readsF.sha256 } };
}
const REF = () => JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v2', 'results', 'validity_ref.json'), 'utf8'));

function reproduce() {
  const D = SL.loadAll(), research = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props.json'), 'utf8')), gameOf = new Map(D.games.map(g => [g.game_id, g]));
  const P = research.folds.find(f => f.season === 2024).params, NV = PR.fitNaiveVar(D.rows, r => r.season >= PR.FIRST + 1 && r.season < 2024);
  const { rec, startOf } = readFetchedLines(path.join(ROOT, 'research', 'props_v2', 'cache', 'props40_2024.csv'), gameOf, 2024, null, '2024-04-14');
  const out = checks(gradeLinesWith(D, P, NV, rec), startOf, REF());
  const want = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'props_v2', 'cache', 'validity_2024.json'), 'utf8'));
  const diffs = [];
  for (const k of ['graded', 'games', 'v0', 'v1', 'v2', 'v3']) if (JSON.stringify(out[k]) !== JSON.stringify(want[k])) diffs.push(k);
  if (diffs.length) throw new Error(`validity_ma.js does not give back validity.js's figures on 2023-24: ${diffs.join(', ')}`);
  return { graded: out.graded, games: out.games, v0holds: out.v0.holds, v1: out.v1.preGame, v2: out.v2.diff, v3holds: out.v3.holds, same: true };
}
module.exports = { gradeLinesWith, checks, readFetchedLines, REF, reproduce };

if (require.main === module) {
  if (process.argv.includes('--reproduce')) { console.log(JSON.stringify(reproduce())); }
  else if (process.argv.includes('--test')) { throw new Error('the test mode runs only from research/props_v3/test/score.js, after the preregistration'); }
  else { console.error('usage: --reproduce'); process.exit(1); }
}
