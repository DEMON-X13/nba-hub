/* The validity check the README's 2023-24 test must pass before its bar is applied: are DraftKings' provider-40 lines
 * pre-game prices, read the right way round? Written, with its thresholds, before any of those lines is fetched.
 *
 *   node research/props_v2/validity.js
 *       the references, on the 2026 play-in and playoff archive (data/props_2026.csv, the 2026 fold): writes
 *       results/validity_ref.json, which holds the thresholds below and the archive's figures they are read against
 *   node research/props_v2/validity.js --lines research/props_v2/cache/props40_2024.csv --season 2024 [--to 2024-04-14]
 *       the check on the fetched lines (fetch_dk40.js's cache: its csv and props40_reads.json beside it), the regular
 *       season to --to: writes research/props_v2/cache/validity_2024.json (gitignored) and prints the verdict
 *
 * DraftKings' prices, the feed's own stamps and the box scores only. No candidate, and no model's chance of a line, is
 * scored. Two box-score quantities known before tip are read, each the walk-forward's as tools/props.js makes it, with
 * the fold's constants (the 2026 fold for the archive, the 2024 fold, fitted on 2023, for 2023-24): the player's
 * projected minutes, and the naive forecaster (his own average before the game, on the spread tools/props.js fitNaiveVar
 * fits on the seasons before), priced at DraftKings' line. Six base stats: points, rebounds, assists, threes, steals,
 * blocks. A player who did not play is void; a line equal to the stat (none at half points) is a push and left out.
 *
 * The checks (all decided on the fetched lines, once, before A or tools/props.js is scored on them):
 *   V0 the first item is the Over: on every stat, DraftKings' fair chance (the whole margin on the Over) scores a lower
 *      log loss reading the first item as the Over than reading it as the Under.
 *   V1 timing, from the feed: the share of graded lines whose last_updated (the later of the pair's two items) falls
 *      before the event's scheduled start, read as given (a stamp before the start is before it in the reading three
 *      hours earlier too). Pre-game is SHOWN only if that share is 95% or more; otherwise it is NOT SHOWN by the feed
 *      (the 85-game sample's stamps fell about 5.4 hours after the start), rests on V2 and V3, and every report of the
 *      test says "pre-game inferred, not shown".
 *   V2 the prices know nothing of the minutes played: on lines of players projected 24 or more minutes, DraftKings' mean
 *      fair chance of the Over where he then played under 12 (an early exit: an injury, foul trouble, a blowout, which a
 *      price made before tip cannot see) less its mean where he played 12 or more, each stat's difference weighted by
 *      its early exits. Holds if that is -0.05 or above (a price made after the exit would sit tens of points lower),
 *      on 100 early-exit lines or more (fewer cannot decide it, and the test is then VOID; a regular season has far
 *      more; the archive's 41 are a reference, not a test).
 *   V3 the prices know no more of the result than a pre-game price does: per stat, DraftKings' gain over the naive
 *      forecaster in log loss (the naive's less DraftKings', on the same lines). Holds if, on every stat, the 2023-24
 *      gain is at most the archive's gain on that stat plus 0.02. This is the score-likeness check, threes and blocks
 *      named: their raw log loss in the sample sat below the archive's (2023-24: 0.647 and 0.606 against 0.665 and
 *      0.635), which a mix of lower, more lopsided lines explains if the naive forecaster scores lower on the same lines
 *      too, and a price that saw part of the game does not.
 *   Verdict: V0, V2 and V3 must all hold for the bar to be applied; if any fails, the test is VOID (neither PASS nor
 *   FAIL) and the lines settle nothing. V1 decides only whether the result is reported as on lines shown, or inferred,
 *   to be pre-game.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const F = require('../../tools/props_feed.js');
const REC = require('../../tools/props_record.js');
const SL = require('./cand_select_lib.js');

const OUTD = path.join(__dirname, 'results');
const BASE = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'];
const TH = { v1ShareBeforeStart: 0.95, v2MinProjected: 24, v2ExitUnder: 12, v2Floor: -0.05, v2MinExits: 100, v3Slack: 0.02 };
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const LINES = arg('--lines'), S = LINES ? +arg('--season') : 2026, TO = arg('--to') || (S === 2024 ? '2024-04-14' : null);
if (LINES && !(S >= 2023 && S <= 2026)) throw new Error('--season must be a season up to 2026');
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const clip = SL.clip;
const ll = (p, o) => o ? -Math.log(clip(p)) : -Math.log(1 - clip(p));
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const D = SL.loadAll();
const research = JSON.parse(fs.readFileSync(path.join(SL.ROOT, 'research', 'props.json'), 'utf8'));
const P = research.folds.find(f => f.season === S).params;
const NV = PR.fitNaiveVar(D.rows, r => r.season >= PR.FIRST + 1 && r.season < S);
const gameOf = new Map(D.games.map(g => [g.game_id, g]));

/* the lines: the archive, or the fetched csv (the record's columns, then last_updated) cut to the season's regular season */
let rec, stampOf = null, startOf = null;
if (!LINES) rec = REC.readRecord(2026);
else {
  const t = fs.readFileSync(LINES, 'utf8').trim().split('\n'), head = t.shift();
  if (head !== 'game_id,player_id,stat,line,over,under,last_updated') throw new Error(`${LINES}: not fetch_dk40.js's columns`);
  rec = t.map(l => { const v = l.split(','); return { game_id: v[0], player_id: v[1], stat: v[2], line: +v[3], over: +v[4], under: +v[5], lu: v[6] }; })
    .filter(l => { const g = gameOf.get(l.game_id); return g && g.season === S && g.type === 'REG' && (!TO || g.date <= TO); });
  const reads = JSON.parse(fs.readFileSync(path.join(path.dirname(LINES), 'props40_reads.json'), 'utf8'));
  startOf = new Map(Object.entries(reads).map(([k, v]) => [k, v.start || null]));
  stampOf = true;
}
rec = rec.filter(l => BASE.includes(l.stat));
const games = new Set(rec.map(l => l.game_id));
log(`${LINES || 'the 2026 archive'}: ${rec.length} base-stat lines on ${games.size} games (fold ${S})`);
const pr = PR.project(D.rows, P, r => games.has(r.game));
const at = new Map(); for (const [i, x] of pr) at.set(D.rows[i].game + '|' + D.rows[i].id, { x, r: D.rows[i] });
const played = new Set();
for (const gid of games) for (const side of Object.values(D.boxes[gid] || {})) for (const r of side) if (r.min > 0 && !r.dnp) played.add(gid + '|' + r.id);

const L = []; let voids = 0, noProjection = 0, pushes = 0;
for (const l of rec) {
  const k = l.game_id + '|' + l.player_id;
  if (!played.has(k)) { voids++; continue; }
  const a = at.get(k); if (!a) { noProjection++; continue; }
  const y = PR.yOf(a.r.y, l.stat); if (y === l.line) { pushes++; continue; }
  const nv = SL.naiveMean(a.r.f, l.stat), nn = nv == null ? null : Math.max(nv, 0.01);
  L.push({ game: l.game_id, stat: l.stat, o: y > l.line ? 1 : 0, q: F.propFairOver(l.over, l.under), qSwap: 1 - F.propImplied(l.over),
    pn: nn == null ? null : PR.nbSf(Math.floor(l.line) + 1, nn, PR.nbVar(nn, NV[l.stat])), m: a.x.m, mAct: a.r.min, lu: l.lu || null });
}
log(`graded ${L.length} (void ${voids}, no projection ${noProjection}, pushes ${pushes})`);
const byGameCI = (xs, f) => { const m = new Map(); for (const x of xs) { const v = m.get(x.game) || [0, 0]; v[0] += f(x); v[1]++; m.set(x.game, v); } return PR.bootCI([...m.values()]); };

const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v2/validity.js: DraftKings\' prices, the feed\'s stamps and the box scores only; no candidate is scored',
  lines: LINES || 'data/props_2026.csv (the 2026 play-in and playoffs)', fold: S, thresholds: TH, graded: L.length, games: games.size, v0: {}, v2: { byStat: {} }, v3: {} };
/* V0 */
for (const k of BASE) { const xs = L.filter(x => x.stat === k); if (!xs.length) continue;
  out.v0[k] = { n: xs.length, firstIsOver: r4(mean(xs.map(x => ll(x.q, x.o)))), firstIsUnder: r4(mean(xs.map(x => ll(x.qSwap, x.o)))) }; }
out.v0.holds = Object.values(out.v0).every(v => v.firstIsOver < v.firstIsUnder);
/* V1 */
if (stampOf) {
  const dated = L.filter(x => x.lu && startOf.get(x.game));
  const before = dated.filter(x => Date.parse(x.lu) < Date.parse(startOf.get(x.game)));
  const hours = dated.map(x => (Date.parse(x.lu) - Date.parse(startOf.get(x.game))) / 3.6e6).sort((a, b) => a - b);
  out.v1 = { dated: dated.length, undated: L.length - dated.length, shareBeforeStart: r4(before.length / L.length), hoursAfterStartMedian: hours.length ? r4(hours[Math.floor(hours.length / 2)]) : null };
  out.v1.preGame = out.v1.shareBeforeStart >= TH.v1ShareBeforeStart ? 'shown' : 'not shown by the feed: inferred from V2 and V3';
} else out.v1 = { note: 'the archive carries no stamps (data/props_2026.csv is the record\'s six columns)' };
/* V2 */
let wsum = 0, wd = 0;
for (const k of BASE) {
  const base = L.filter(x => x.stat === k && x.m >= TH.v2MinProjected), exit = base.filter(x => x.mAct < TH.v2ExitUnder), rest = base.filter(x => x.mAct >= TH.v2ExitUnder);
  if (!exit.length || !rest.length) continue;
  const d = mean(exit.map(x => x.q)) - mean(rest.map(x => x.q));
  out.v2.byStat[k] = { exits: exit.length, rest: rest.length, fairOverExits: r4(mean(exit.map(x => x.q))), fairOverRest: r4(mean(rest.map(x => x.q))), diff: r4(d), overHitExits: r4(mean(exit.map(x => x.o))), overHitRest: r4(mean(rest.map(x => x.o))) };
  wsum += exit.length; wd += exit.length * d;
}
out.v2.exits = wsum; out.v2.diff = wsum ? r4(wd / wsum) : null;
/* V3 */
for (const k of BASE) { const xs = L.filter(x => x.stat === k && x.pn != null); if (!xs.length) continue;
  const f = x => ll(x.pn, x.o) - ll(x.q, x.o);
  out.v3[k] = { n: xs.length, draftKings: r4(mean(xs.map(x => ll(x.q, x.o)))), naive: r4(mean(xs.map(x => ll(x.pn, x.o)))), gain: r4(mean(xs.map(f))), gainCi90: byGameCI(xs, f) }; }

if (!LINES) {
  out.note = 'references only: the thresholds are applied to fetched lines, never to the archive';
  fs.writeFileSync(path.join(OUTD, 'validity_ref.json'), JSON.stringify(out, null, 1) + '\n');
  log('the references written to results/validity_ref.json');
} else {
  const ref = JSON.parse(fs.readFileSync(path.join(OUTD, 'validity_ref.json'), 'utf8'));
  if (JSON.stringify(ref.thresholds) !== JSON.stringify(TH)) throw new Error('the thresholds are not the ones registered in results/validity_ref.json');
  out.v2.holds = out.v2.diff != null && out.v2.exits >= TH.v2MinExits && out.v2.diff >= TH.v2Floor;
  out.v3.against = Object.fromEntries(BASE.map(k => [k, { gain: out.v3[k] && out.v3[k].gain, archive: ref.v3[k].gain, limit: r4(ref.v3[k].gain + TH.v3Slack) }]));
  out.v3.holds = BASE.every(k => out.v3[k] && out.v3[k].gain <= ref.v3[k].gain + TH.v3Slack);
  out.verdict = out.v0.holds && out.v2.holds && out.v3.holds ? `the bar applies (pre-game ${out.v1.preGame})` : 'VOID: the lines settle nothing';
  fs.writeFileSync(path.join(path.dirname(LINES), `validity_${S}.json`), JSON.stringify(out, null, 1) + '\n');
  log(`verdict: ${out.verdict}`);
}
console.log(JSON.stringify({ v0: out.v0, v1: out.v1, v2: out.v2, v3: out.v3 }, null, 1));
