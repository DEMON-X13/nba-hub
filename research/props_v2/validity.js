/* The validity check the README's 2023-24 test must pass before its bar is applied: are DraftKings' provider-40 lines
 * pre-game prices, read the right way round? Written, with its thresholds, before any of those lines is fetched; the
 * thresholds are validity_lib.js's TH, which validity_calib.js derives (README, "The validity check").
 *
 *   node research/props_v2/validity.js
 *       the references, on the 2026 play-in and playoff archive (data/props_2026.csv, the 2026 fold): writes
 *       results/validity_ref.json, which holds the thresholds and the archive's figures they are read against
 *   node research/props_v2/validity.js --lines research/props_v2/cache/props40_2024.csv --season 2024 [--to 2024-04-14]
 *       the check on the fetched lines (fetch_dk40.js's cache: its csv and props40_reads.json beside it), the regular
 *       season to --to: writes research/props_v2/cache/validity_2024.json (gitignored) and prints the verdict. Each file
 *       is read once, and the SHA-256 of the bytes read goes into the verdict's file (`files`), so test2024.js scores
 *       only the very bytes this check read; every such run is also added, one line, to validity_2024_runs.jsonl beside
 *       it (when, the hashes, the counts and the verdict), which test2024.js reports beside its result. Neither moves a
 *       check or a threshold, and the archive's references are written as before.
 *
 * What it reads: DraftKings' prices, the feed's stamps and the box scores, and three things tools/props.js's walk-forward
 * makes from the box scores before tip, with the fold's constants (the 2026 fold for the archive; the 2024 fold, fitted
 * on 2023, for 2023-24): a player's projected minutes, which picks V2's lines; the naive forecaster V3 sets DraftKings
 * against (his own average before the game, on the spread tools/props.js fitNaiveVar fits on the seasons before); and
 * V3's yardstick, the walk-forward's own gain over that naive forecaster at its own median line (validity_lib.js). No
 * candidate is scored, and no model's chance of DraftKings' line. Six base stats: points, rebounds, assists, threes,
 * steals, blocks. A player who did not play is void; a line equal to the stat (none at half points) is a push and left
 * out.
 *
 * The checks (all decided on the fetched lines, once, before A or tools/props.js is scored on them):
 *   V0 the first item is the Over: on every stat, DraftKings' fair chance (the whole margin on the Over) scores a lower
 *      log loss reading the first item as the Over than reading it as the Under.
 *   V1 timing, from the feed: the share of graded lines whose last_updated (the later of the pair's two items) falls
 *      before the event's scheduled start, read as given (a stamp before the start is before it in the reading three
 *      hours earlier too). Pre-game is SHOWN only if that share is 95% or more; otherwise it is NOT SHOWN by the feed
 *      (the 85-game sample's stamps fell about 5.4 hours after the start), rests on V2 and V3, and every report of the
 *      test says "pre-game inferred, not shown".
 *   V2 the prices know nothing of the minutes played: on lines of players projected 24 or more minutes who played their
 *      side's previous game (a player back from a missed game may be on a minutes limit a pre-game price knows of: in the
 *      2023-24 regular season such players left early 2.8% of the time, the rest 0.8%), DraftKings' mean fair chance of
 *      the Over where he then played under 12 (an early exit: an injury, foul trouble, a blowout, which a price made
 *      before tip cannot see) less its mean where he played 12 or more, each stat's difference weighted by its early
 *      exit lines. Holds if that is -0.05 or above, on 40 early exits (player-games) or more; fewer cannot decide it, and
 *      the test is then VOID. A price read after the exit sits far lower: every archive line read at a quarter of its
 *      game moves the figure by -0.23 (validity_calib.js).
 *   V3 the prices know no more of the result than a pre-game price does, set against the season's own yardstick: per
 *      stat, DraftKings' gain over the naive forecaster in log loss (the naive's less DraftKings', on the same lines),
 *      less the yardstick's gain on the same players, games and stats. Holds if, on every stat, that is at most the
 *      archive's same figure plus the stat's slack (points 0.025, rebounds 0.015, assists 0.02, threes, steals and
 *      blocks 0.015). The yardstick carries the regime: on the box scores alone its gain is 0.015 to 0.026 higher on
 *      rebounds, steals and blocks in a regular season than on the archive's playoffs, which the first version of this
 *      check (the gain alone, against the archive's plus 0.02) would have read as in-game knowledge.
 *   Verdict: V0, V2 and V3 must all hold for the bar to be applied; if any fails, the test is VOID (neither PASS nor
 *   FAIL) and the lines settle nothing. V1 decides only whether the result is reported as on lines shown, or inferred,
 *   to be pre-game.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const PR = require('../../tools/props.js');
const REC = require('../../tools/props_record.js');
const SL = require('./cand_select_lib.js');
const V = require('./validity_lib.js');

const OUTD = path.join(__dirname, 'results');
const { BASE, TH, ll } = V;
const arg = k => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null; };
const LINES = arg('--lines'), S = LINES ? +arg('--season') : 2026, TO = arg('--to') || (S === 2024 ? '2024-04-14' : null);
if (LINES && !(S >= 2023 && S <= 2026)) throw new Error('--season must be a season up to 2026');
const r4 = x => x == null || !isFinite(x) ? null : Math.round(x * 1e4) / 1e4;
const mean = a => a.length ? a.reduce((s, x) => s + x, 0) / a.length : null;
const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

const D = SL.loadAll();
const research = JSON.parse(fs.readFileSync(path.join(SL.ROOT, 'research', 'props.json'), 'utf8'));
const gameOf = new Map(D.games.map(g => [g.game_id, g]));

/* the lines: the archive, or the fetched csv (the record's columns, then last_updated) cut to the season's regular season */
let rec, startOf = null, fetched = null;
if (!LINES) rec = REC.readRecord(2026);
else {
  const csvF = V.readFetched(LINES), readsF = V.readFetched(path.join(path.dirname(LINES), 'props40_reads.json'));
  fetched = { csv: csvF.sha256, reads: readsF.sha256 };
  const t = csvF.text.trim().split('\n'), head = t.shift();
  if (head !== 'game_id,player_id,stat,line,over,under,last_updated') throw new Error(`${LINES}: not fetch_dk40.js's columns`);
  rec = t.map(l => { const v = l.split(','); return { game_id: v[0], player_id: v[1], stat: v[2], line: +v[3], over: +v[4], under: +v[5], lu: v[6] }; })
    .filter(l => { const g = gameOf.get(l.game_id); return g && g.season === S && g.type === 'REG' && (!TO || g.date <= TO); });
  const reads = JSON.parse(readsF.text);
  startOf = new Map(Object.entries(reads).map(([k, v]) => [k, v.start || null]));
}
const G = V.gradeLines(D, research, S, rec), L = G.L;
log(`${LINES || 'the 2026 archive'}: ${rec.filter(l => BASE.includes(l.stat)).length} base-stat lines on ${G.games.size} games (fold ${S})`);
log(`graded ${L.length} (void ${G.voids}, no projection ${G.noProjection}, pushes ${G.pushes})`);
const byGameCI = (xs, f) => { const m = new Map(); for (const x of xs) { const v = m.get(x.game) || [0, 0]; v[0] += f(x); v[1]++; m.set(x.game, v); } return PR.bootCI([...m.values()]); };

const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v2/validity.js: DraftKings\' prices, the feed\'s stamps and the box scores, with the walk-forward\'s projected minutes, naive forecaster and yardstick; no candidate is scored, and no model\'s chance of DraftKings\' line',
  lines: LINES || 'data/props_2026.csv (the 2026 play-in and playoffs)', fold: S, thresholds: TH, graded: L.length, games: G.games.size, v0: {}, v2: { byStat: {} }, v3: {} };
/* V0 */
for (const k of BASE) { const xs = L.filter(x => x.stat === k); if (!xs.length) continue;
  out.v0[k] = { n: xs.length, firstIsOver: r4(mean(xs.map(x => ll(x.q, x.o)))), firstIsUnder: r4(mean(xs.map(x => ll(x.qSwap, x.o)))) }; }
out.v0.holds = Object.values(out.v0).every(v => v.firstIsOver < v.firstIsUnder);
/* V1 */
if (startOf) {
  const dated = L.filter(x => x.lu && startOf.get(x.game));
  const before = dated.filter(x => Date.parse(x.lu) < Date.parse(startOf.get(x.game)));
  const hours = dated.map(x => (Date.parse(x.lu) - Date.parse(startOf.get(x.game))) / 3.6e6).sort((a, b) => a - b);
  out.v1 = { dated: dated.length, undated: L.length - dated.length, shareBeforeStart: r4(before.length / L.length), hoursAfterStartMedian: hours.length ? r4(hours[Math.floor(hours.length / 2)]) : null };
  out.v1.preGame = out.v1.shareBeforeStart >= TH.v1ShareBeforeStart ? 'shown' : 'not shown by the feed: inferred from V2 and V3';
} else out.v1 = { note: 'the archive carries no stamps (data/props_2026.csv is the record\'s six columns)' };
/* V2 */
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
/* V3 */
for (const k of BASE) { const xs = L.filter(x => x.stat === k && x.pn != null); if (!xs.length) continue;
  const gain = x => ll(x.pn, x.o) - ll(x.q, x.o), f = x => gain(x) - x.gP;
  out.v3[k] = { n: xs.length, draftKings: r4(mean(xs.map(x => ll(x.q, x.o)))), naive: r4(mean(xs.map(x => ll(x.pn, x.o)))), gain: r4(mean(xs.map(gain))),
    yardstick: r4(mean(xs.map(x => x.gP))), figure: r4(mean(xs.map(f))), figureCi90: byGameCI(xs, f) }; }

if (!LINES) {
  out.note = 'references only: the thresholds are applied to fetched lines, never to the archive';
  fs.writeFileSync(path.join(OUTD, 'validity_ref.json'), JSON.stringify(out, null, 1) + '\n');
  log('the references written to results/validity_ref.json');
} else {
  const ref = JSON.parse(fs.readFileSync(path.join(OUTD, 'validity_ref.json'), 'utf8'));
  if (JSON.stringify(ref.thresholds) !== JSON.stringify(TH)) throw new Error('the thresholds are not the ones registered in results/validity_ref.json');
  out.v2.holds = out.v2.diff != null && out.v2.exits >= TH.v2MinExits && out.v2.diff >= TH.v2Floor;
  out.v3.against = Object.fromEntries(BASE.map(k => [k, { figure: out.v3[k] && out.v3[k].figure, archive: ref.v3[k].figure, limit: r4(ref.v3[k].figure + TH.v3Slack[k]) }]));
  out.v3.holds = BASE.every(k => out.v3[k] && out.v3[k].figure <= ref.v3[k].figure + TH.v3Slack[k]);
  out.verdict = out.v0.holds && out.v2.holds && out.v3.holds ? `the bar applies (pre-game ${out.v1.preGame})` : 'VOID: the lines settle nothing';
  out.files = fetched;
  fs.writeFileSync(path.join(path.dirname(LINES), `validity_${S}.json`), JSON.stringify(out, null, 1) + '\n');
  fs.appendFileSync(path.join(path.dirname(LINES), `validity_${S}_runs.jsonl`), JSON.stringify({ generated: out.generated, files: out.files, graded: out.graded, games: out.games, verdict: out.verdict }) + '\n');
  log(`verdict: ${out.verdict}`);
}
console.log(JSON.stringify({ v0: out.v0, v1: out.v1, v2: out.v2, v3: out.v3 }, null, 1));
