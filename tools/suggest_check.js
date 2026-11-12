/* The suggestions record's guard (README "Suggested Parlays"): data/suggest_ledger.json held to its rules, worked out
 * here on their own from the file, the clock and the last commit's file, never from the page.
 *
 * Two maps. `night` is the record since the owner's call of 7 November 2026: one set a night across every game of the
 * night, its three levels each the likeliest parlay the night's legs make by its own rule (NIGHT_LEVELS below, since
 * NOCAP_FROM, 8 November 2026: Safe 2 legs or more paying $2 or more on $1, Medium $4, Aggressive $8, no leg limit;
 * before it NIGHT_LEVELS_OLD: Safe 2 legs, Medium 2 to 5 paying $4 or more, Aggressive 2 to 5 paying $8). Its legs were the team legs alone
 * on 7 November 2026's set; every set taken from PL_FROM (the night after) also holds DraftKings' player main lines at
 * DraftKings' own fair chance (the owner's call of that day, "Add at DraftKings' odds"; its pool carries `pl`, its counts
 * of player lines, and its games' legs together as `pairs` and `sets`). It fails when:
 *   - an entry lacks its night, games, tip-off, lock, levels, pool or time taken; is not keyed season|date|first
 *     tip|<season>_<date>_NIGHT on its own fields; a game of it is preseason, of another season, date or clubs than its
 *     id, or tips off on another Eastern date (Intl) than the night's; its tip-off is not its games' first, or its last
 *     not their last; its lock is not exactly 2 hours before its first tip-off; it was taken at or after its lock;
 *   - its levels are not the three in order with their sizes and floors; a level holds a leg of no game of the night, a
 *     player's leg on a set of the team rule (or, on the player-leg rule, one that is not a main line over or under with
 *     both prices on a stat the page offers), a leg twice, two legs of one player, two side bets or two totals of one
 *     game, a count of legs outside its range, a leg not in the entry's pool at its own price and chance, a price under
 *     its floor, or a chance or price that is not its legs' as the pool has them; its pool holds a player's leg at any
 *     chance but DraftKings' fair chance by this file's own reading (plFair) or outside the band, or, while the set is
 *     still to lock, a player the state's report lists (anything but Probable), on a game's out list, or not placed by
 *     the props model on one of the game's clubs; a set of the team rule is taken from PL_FROM; or, worked out here on the
 *     pool by its own enumeration of every parlay the level's rule takes (one side, one total and one leg a player a
 *     game, the pool's chance and price of each leg and of each game's legs together, multiplied across games; for a set
 *     or level the run took, on THE GUARD'S OWN READING of the run's lines.json and state.json: every player leg read
 *     again, its counts held to the pool's, and every two legs of a game by its own copula), a parlay the rule ranks
 *     above it (likelier, then dearer,
 *     then fewer legs, then the legs' ids; two within NIGHT_TIE, the page's own tolerance, are level), or a level empty
 *     where a parlay meets its rule; its pool holds no leg and none left out by a rule (taken before DraftKings had
 *     posted any line of the night: the job takes no such set);
 *   - a grade is on it before its first tip-off, or does not follow its legs (as below);
 *   - a second set of one night is taken at or after another set of it locked (a night once locked stays locked, though
 *     ESPN moves its first tip-off later);
 *   - after the lock a level built again (its `updated` {pid, name, reason, at}, recorded in the entry's `updates`) is
 *     held to its own pool (the level's `pool`), which must hold that player nowhere, and so must the level, its mark the
 *     last of its updates, each made between the lock and the first tip-off, and (against the file it is held to, on the
 *     run's state) each replacement new since that file for a player the state lists, its level's own pool holding no
 *     player the state holds out;
 *   - against the file the run started from (or the last commit's): an entry whose lock had passed is gone or changed in
 *     anything but its grade and a level built again for a player listed since (only on the player-leg rule: a set of
 *     team legs alone is never built again, as no report moves it); the night map itself gone where that file has one; with the run's time known, a new or changed
 *     entry that is not that run's before its lock; another season's entry graded anew; and night_summary not following
 *     from the entries.
 * `featured` is the per-game record before it, its rules as they were (the job takes no new set there since, and drops
 * one still to lock), held as below.
 *
 *   node tools/suggest_check.js [--prev FILE | --no-prev] [--now ISO]
 *
 * The job runs it right after tools/suggest_ledger.js, which runs the same check() before it writes, on the script's own
 * clock (SUGGEST_NOW, the one instant the job hands the two, so a set the script rewrote a second before its lock is not
 * read here as locked and moved); a failure fails that step, which puts the ledger back as the last commit had it, and the
 * record never holds back state.json or the data. It fails when:
 *   - an entry lacks its game, tip-off, lock, networks, levels or time taken; is not keyed season|date|tip|game id on its
 *     own fields; its game id is not of its season, Eastern date and clubs; its date is not its tip-off's Eastern date (the
 *     time zone database, Intl); it is not a featured game by its own stored networks and type (on national TV, never a
 *     preseason game: FEATURED_TV below, this file's own copy of the page's, judges a set still to lock; a set past its
 *     lock stands on the rule it was taken under, so it needs only a network and no preseason, and a network dropped
 *     since never jams the record); its lock is not exactly 2 hours before its
 *     tip-off; it was taken at or after its lock; its levels are not the three (Safe 2 legs, Medium 3, Aggressive 4) in
 *     order, or the four with Extreme (5 legs) after them of a set the page that drew four took (THE CUTOVER, THREE_FROM
 *     below); a level holds a leg of another game, a count of legs not its own, a player twice, two side bets or two
 *     totals;
 *   - a replacement (updates) names no level the set holds (Extreme on a set of three among them), no player or no time,
 *     or was made outside its lock to tip-off or after the clock; a level's mark (updated) is not the last replacement
 *     recorded for it, or the level still holds the player;
 *   - a grade is on an entry before its tip-off, or does not follow its legs (a leg lost loses and pays 0, though another
 *     leg is still out; otherwise any leg out is pending; every leg a push or void is a push and pays 1; otherwise won,
 *     paying over 1, exactly its price when every leg won, and with a leg dropped at most the legs left's prices
 *     multiplied and exactly that where each game is left one leg);
 *   - against the file the run started from (or, by the command line, the last commit's): an entry whose lock had passed
 *     is gone or changed in anything but its grade and its replaced levels; its record of replacements rewritten; its
 *     levels changed; a level changed with no replacement recorded, or replaced for a player it did not hold; a
 *     replacement recorded for a level that did not change; with the run's time known, a replacement or a new or changed
 *     entry that is not that run's, or an entry taken at or after its lock; and an entry of another season than the
 *     season in play graded anew;
 *   - the summary does not follow from the entries.
 * SUGGEST_LEDGER names another ledger, SUGGEST_NOW another clock, SUGGEST_STATE another state.json (its season and who
 * is held out), SUGGEST_LINES another lines.json (the guard's own reading of a set new since the last commit). Ends
 * "suggest check: 0 failures" (exit 0) or lists each failure (exit 1).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
/* the copula the builder's same-game sums stand on (its joint2, bvnUpper and rhoFor are the page's line for line): the
   guard's own figures for every two legs of one game (THE GUARD'S OWN READING, below) */
const CJ = require('./corr');
const { normCdf, normInv } = require('./props');
const ROOT = path.resolve(__dirname, '..');
const LEDGER_REL = 'data/suggest_ledger.json';
/* the levels the record takes (the page's SP_TIERS: a page with others is refused by the job), and each one's legs.
   OLD_TIERS are the four every set held until the owner took Extreme, the 5-leg level, off Suggested Parlays on 5 November
   2026 ("get rid of the extreme section as well"): the entries taken before keep it, its legs and grades as they are, and
   the summary keeps its record under its own key, from those entries alone */
const TIERS = ['safe', 'med', 'aggr'], OLD_TIERS = [...TIERS, 'xtrm'];
const LABELS = { safe: 'Safe', med: 'Medium', aggr: 'Aggressive', xtrm: 'Extreme' }, LEGS = { safe: 2, med: 3, aggr: 4, xtrm: 5 };
/* THE CUTOVER. THREE_FROM is 03:00 UTC on 5 November 2026, just before the commit that took Extreme off: every set in the
   ledger then was taken before it (the last at 00:29 that morning), by the page that drew four levels, and every run of the
   new page takes three, after it. A set holds the four only where it was taken before THREE_FROM, or where the file it is
   held to (the run's start, or the last commit's) already holds it with the four and the same time taken: a run of the
   old page that landed after THREE_FROM, before the change reached main, is then never refused for it (no old set
   refused), while a set new or taken again since that file must be the three (no new set carries Extreme). With no file
   to hold it to (--no-prev), THREE_FROM alone: a ledger holding such a late old-page set then fails, which the job never
   runs (it always holds the file to the last commit's), and the test holds the real ledger to itself, never to no file */
const THREE_FROM = '2026-11-05T03:00:00Z';
const LOCK_MS = 2 * 3600e3;
/* this file's own copy of the page's featured rule: a game on any national network ESPN lists, less those named here */
const FEATURED_TV = { except: [] };
/* THE NIGHT (the owner's call of 7 November 2026): this file's own copy of the page's SP_LEVELS, [id, label, the fewest
   legs, the most (null: no limit), the least decimal price]; the job refuses a page whose levels are not these.
   NO LEG LIMIT (the owner's call of 8 November 2026: "we can eliminate maximum legs for all the sections, it can be
   multiple legs as long as it meets the criteria of safe, med, aggressive and meets min payout requirements", Safe's
   floor $2 on $1, his choice): every set taken from NOCAP_FROM is held to NIGHT_LEVELS, each level the likeliest parlay
   of 2 legs or more, no most, whose price meets its floor; a set taken before keeps the rule it was taken under,
   NIGHT_LEVELS_OLD (Safe the likeliest pair with no floor, Medium and Aggressive 2 to 5 legs), its levels' heads saying
   which (nightRule). NOCAP_FROM is 18:00 UTC on 8 November 2026, before the change could reach main: a set of the old
   heads taken from it is refused, unless the file it is held to holds it as it is, taken at the same time (a run of the
   old page that landed after NOCAP_FROM, before the change: as PL_FROM keeps a set of team legs alone), and a set of
   the new heads is held to the new rule whenever it was taken */
/* WITH A PLAYER (the owner's call of 10 November 2026, a screenshot of that night's levels, every one team legs alone:
   "why is it still only showing team legs and not players"): every set taken from PLAYER_FROM is held to NIGHT_LEVELS,
   its heads carrying need: 'player' (the page's sixth field): each level the likeliest parlay of 2 legs or more, no most,
   paying its floor, that holds at least one player leg, wherever the pool makes one; where it makes none, the likeliest
   without one (the rule before), saying why in its nopl ('lines': no player line read for the night's games, its pool's
   pl counting none read, held, unplaced or priced with no margin; 'fit': lines read and none that makes the level). A
   set taken before keeps the rule it was taken under, NIGHT_LEVELS_NOCAP (from NOCAP_FROM) or NIGHT_LEVELS_OLD, its
   heads saying which; one of the NOCAP heads taken from PLAYER_FROM is refused unless the file it is held to holds it as
   it is, taken at the same time (a run of the page before the change that landed after PLAYER_FROM). PLAYER_FROM is
   18:00 UTC on 10 November 2026, before the change could reach main and before that night's lock (22:30 UTC) */
const NIGHT_LEVELS = [['safe', 'Safe', 2, null, 2, 'player'], ['med', 'Medium', 2, null, 4, 'player'], ['aggr', 'Aggressive', 2, null, 8, 'player']];
const NIGHT_LEVELS_NOCAP = [['safe', 'Safe', 2, null, 2], ['med', 'Medium', 2, null, 4], ['aggr', 'Aggressive', 2, null, 8]];
const NIGHT_LEVELS_OLD = [['safe', 'Safe', 2, 2, 0], ['med', 'Medium', 2, 5, 4], ['aggr', 'Aggressive', 2, 5, 8]];
const NOCAP_FROM = '2026-11-08T18:00:00Z';
const PLAYER_FROM = '2026-11-10T18:00:00Z';
/* why a level of the rule with a player holds none: this file's own reading of its pool's counts (no player line read,
   held, unplaced or priced with no margin: 'lines'; else 'fit') */
const NOPL = ['lines', 'fit'];
const noPlOf = c => !isMap(c) || !((+c.lines || 0) + (+c.held || 0) + (+c.none || 0) + (+c.vig || 0)) ? 'lines' : 'fit';
/* which rule a night entry's levels are of, by their heads: 'player', 'nocap', 'old', or null where they are none */
const headsOf = (e, LV) => Array.isArray(e && e.tiers) && e.tiers.length === LV.length && e.tiers.every((x, i) => isMap(x) && x.id === LV[i][0] && x.min === LV[i][2] && x.max === LV[i][3] && x.price === LV[i][4]
  && (LV[i][5] === 'fair' ? x.need === undefined && x.chance === 'fair' : x.need === LV[i][5] && x.chance === undefined));
const nightRule = e => headsOf(e, NIGHT_LEVELS_RULER) ? 'fair' : headsOf(e, NIGHT_LEVELS) ? 'player' : headsOf(e, NIGHT_LEVELS_NOCAP) ? 'nocap' : headsOf(e, NIGHT_LEVELS_OLD) ? 'old' : null;
/* the old rule's heads allowed: taken before NOCAP_FROM, or held so, taken at the same time, by the file it is held to */
const oldOk = (e, pe) => Date.parse(e.taken_at) < Date.parse(NOCAP_FROM) || (isMap(pe) && nightRule(pe) === 'old' && pe.taken_at === e.taken_at);
/* the NOCAP rule's heads (no player leg asked of a level) allowed: taken before PLAYER_FROM, or held so, taken at the same
   time, by the file it is held to */
const nocapOk = (e, pe) => Date.parse(e.taken_at) < Date.parse(PLAYER_FROM) || (isMap(pe) && nightRule(pe) === 'nocap' && pe.taken_at === e.taken_at);
const NIGHT_IDS = NIGHT_LEVELS.map(l => l[0]), TEAM_KINDS = ['ml', 'spread', 'total'];
/* the pool keeps chances and prices whole, as the page's search ranked them (a level keeps its chance to 4 places and
   its price to 3, which the guard never ranks on): two parlays within NIGHT_TIE, the page's own SP_TIE, are level, and
   the tie goes by the rule's own order, as the page's spBetter takes it. A product worked in another order differs in
   its last bits, far inside it */
const NIGHT_TIE = 1e-12;
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v);
const canon = v => JSON.stringify(v, (k, x) => isMap(x) ? Object.keys(x).sort().reduce((o, y) => (o[y] = x[y], o), {}) : x);
const callOf = e => { const { grade, ...c } = e || {}; return c; };
const r4 = v => v == null || !isFinite(v) ? null : Math.round(v * 1e4) / 1e4;
const r3 = v => v == null || !isFinite(v) ? null : Math.round(v * 1e3) / 1e3;
const minIso = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
const NYD = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' });
/* the Eastern date of an instant, through the time zone database */
const etDateOf = ms => NYD.format(new Date(ms));
const keyOf = e => `${e.season}|${e.date}|${e.tip}|${e.gid}`;
const nightKeyOf = e => `${e.season}|${e.date}|${e.tip}|${e.nid}`;
const nightIdOf = (season, date) => `${season}_${String(date).replace(/-/g, '')}_NIGHT`;
/* a night entry taken before DraftKings had posted any line of the night: its pool holds no leg and none left out by a
   rule. The job takes none such (the page builds its own set from the lock instead), and the guard refuses one */
const nightNoLines = e => !!e && isMap(e.pool) && Array.isArray(e.pool.legs) && !e.pool.legs.length && !e.pool.band && !e.pool.far && !e.pool.noId && !e.pool.vig;
/* the entry that holds a night once locked: one of its season and night whose own lock (2 hours before the first tip-off
   it was taken at) has passed by now, whatever the night's first tip-off is since. A night once locked stays locked: the
   job takes no new set of it, and the guard refuses one taken after such an entry's lock */
function nightHeld(M, season, nid, now) {
  for (const k of Object.keys(M || {}).sort()) { const e = M[k]; if (isMap(e) && +e.season === +season && e.nid === nid && lockOf(e) <= now) return e; }
  return null;
}
const featuredOf = e => !!e && e.type !== 'PRE' && Array.isArray(e.tv) && e.tv.some(n => typeof n === 'string' && n && !FEATURED_TV.except.includes(n));
const HOW = 'The suggestions record, written by tools/suggest_ledger.js in the job and held by tools/suggest_check.js. night (since 7 '
  + 'November 2026, the owner\'s call): each night\'s one set on the Suggested Parlays tab, across every game of the night (the first '
  + 'Eastern date with a game to tip, never preseason), its team legs (moneyline, spread, total, at DraftKings\' prices in '
  + 'lines.json and the builder\'s chance, 45% to 97%, none far off DraftKings, no value bar) and, on every set the page with player legs takes from 23:00 UTC on 7 November 2026, '
  + 'DraftKings\' main lines on players (over and under, both prices, at DraftKings\' own fair chance, never the props model\'s, 45% to 97%, '
  + 'none on a player the report lists or the props model does not place in the game), one side, one total and one leg a player a game: from '
  + NOCAP_FROM + ' (the owner\'s call of 8 November 2026) each level the likeliest parlay of 2 legs or more, no leg limit, paying its floor on $1, '
  + 'Safe $2, Medium $4, Aggressive $8; before it Safe the likeliest 2-leg parlay, Medium the likeliest of 2 to 5 legs paying $4 or more, '
  + 'Aggressive the likeliest of 2 to 5 paying $8 or more; from ' + PLAYER_FROM + ' (the owner\'s call of 10 November 2026) each level the likeliest '
  + 'such parlay holding at least one player leg wherever the pool makes one, else the likeliest without one, saying why (nopl: lines, no player '
  + 'line read; fit, none that makes the level), its levels\' heads carrying need: player; by the builder\'s own sums; keyed season|date|first tip|<season>_<date>_NIGHT, its pool kept beside it (every team leg\'s key, '
  + 'price and chance, each game\'s side and total together, and the player legs and games\' legs together that come within 1% of a level\'s '
  + 'chance: pl counts the player lines read, out of the band, held out and cut) so the check works every level out again, rewritten while '
  + 'the night\'s lock (2 hours before its first tip-off) is to come and locked from it (held so though its first tip-off moves later; '
  + 'no set is taken of a night DraftKings has posted no line for); from the lock to the first tip-off a level holding a player the report '
  + 'has since listed is built again, that level alone, on its own pool, and recorded in updates; graded leg by leg as its games finish. '
  + 'night_summary: per level, as below (its exp_model the wins expected by each level\'s own chance, the one it was ranked on: the model\'s on team legs, DraftKings\' fair chance on player legs), from the night map alone. featured (until 7 November 2026): each '
  + 'game on national TV\'s three parlays on the Suggested Parlays tab (Safe, Medium, Aggressive, 2 to 4 legs from that game alone, '
  + 'every bet type; a player\'s chance is the props model\'s, on trial; a set taken by the page that drew four, before ' + THREE_FROM
  + ' or by a run of it that landed after, holds a fourth, Extreme, 5 legs, kept and graded as it was), taken from the published '
  + 'page on the state just published and DraftKings\' lines in lines.json, keyed season|date|tip|game, rewritten while the set\'s lock (2 hours before '
  + 'tip-off) is to come and locked from it, so each entry is the set as the job last published it before the lock; from the lock to '
  + 'tip-off a level holding a player the injury report has since listed is built again, that level alone, and recorded in updates. '
  + 'From tip-off it is graded as a book settles it, by the page\'s own settlement (the scores, and each player\'s box line: a player '
  + 'with none did not play, void): a leg lost loses; a push or void leg drops out and the rest are paid at the builder\'s price on '
  + 'the legs left; every leg a push or void is a push, the stake back; the payout on a $1 stake. featured_summary: per level, the '
  + 'parlays graded won or lost (each season\'s game and level once), won, the wins expected by DraftKings\' fair chance and by the '
  + 'model\'s, and units on $1, Extreme\'s from the sets that hold it (taken by the page that drew four: before ' + THREE_FROM + ', or by a '
  + 'run of it that landed after), kept as history. Never edited by hand: '
  + 'the check refuses a ledger whose locked entries moved.';

/* the summary, as the tab's record pills count it (spRecSum): each season's game and level once, from the last key that
   holds it (a tip-off ESPN moved makes a new key). Extreme keeps its key, from the sets that hold it (the page that drew
   four took them: before THREE_FROM, or in a run of it that landed after; no run of the new page takes it), and its levels
   still to settle count in pending; the pills draw the three */
const blankTiers = () => Object.fromEntries(OLD_TIERS.map(id => [id, { label: LABELS[id], graded: 0, won: 0, lost: 0, push: 0, exp_fair: 0, fair_n: 0, exp_model: 0, units: 0 }]));
function summarize(F) {
  const out = blankTiers(), last = new Map(); let graded = 0, updates = 0, pending = 0;
  for (const key of Object.keys(F || {}).sort()) {
    const e = F[key]; updates += Array.isArray(e.updates) ? e.updates.length : 0;
    if (!e.grade) continue; graded++;
    for (const t of e.tiers || []) { const g = e.grade[t && t.id]; if (!g || !out[t.id] || !Array.isArray(t.legs)) continue; last.set([e.season, e.gid, t.id].join('|'), { t, g }); }
  }
  for (const { t, g } of last.values()) {
    const s = out[t.id];
    if (g.result === 'pending') { pending++; continue; }
    if (g.result === 'push') { s.push++; continue; }
    s.graded++; if (g.result === 'won') s.won++; else s.lost++;
    s.exp_model += t.p; if (t.fair != null) { s.exp_fair += t.fair; s.fair_n++; }
    s.units += g.payout - 1;
  }
  for (const id of OLD_TIERS) { const s = out[id]; s.exp_fair = r4(s.exp_fair); s.exp_model = r4(s.exp_model); s.units = r3(s.units); }
  const games = new Set(Object.values(F || {}).map(e => e.season + '|' + e.gid)).size;
  return { tiers: out, pending, games, entries: Object.keys(F || {}).length, graded_entries: graded, updates };
}
/* the night map's summary, as the tab's pills count it: each season's night and level once, from the last key that
   holds it (a first tip-off moved makes a new key), its levels still to settle in pending */
function summarizeNight(N) {
  const out = Object.fromEntries(NIGHT_LEVELS.map(([id, label]) => [id, { label, graded: 0, won: 0, lost: 0, push: 0, exp_fair: 0, fair_n: 0, exp_model: 0, units: 0 }]));
  const last = new Map(); let graded = 0, pending = 0;
  for (const key of Object.keys(N || {}).sort()) {
    const e = N[key]; if (!e.grade) continue; graded++;
    for (const t of e.tiers || []) { const g = e.grade[t && t.id]; if (!g || !out[t.id] || !Array.isArray(t.legs)) continue; last.set([e.season, e.nid, t.id].join('|'), { t, g }); }
  }
  for (const { t, g } of last.values()) {
    const s = out[t.id];
    if (g.result === 'pending') { pending++; continue; }
    if (g.result === 'push') { s.push++; continue; }
    s.graded++; if (g.result === 'won') s.won++; else s.lost++;
    s.exp_model += t.p; if (t.fair != null) { s.exp_fair += t.fair; s.fair_n++; }
    s.units += g.payout - 1;
  }
  for (const id of NIGHT_IDS) { const s = out[id]; s.exp_fair = r4(s.exp_fair); s.exp_model = r4(s.exp_model); s.units = r3(s.units); }
  const nights = new Set(Object.values(N || {}).map(e => e.season + '|' + e.nid)).size;
  return { tiers: out, pending, nights, entries: Object.keys(N || {}).length, graded_entries: graded };
}
/* the file's own style: one entry a line (and each summary on one), so a run's diff is the entries it took or graded */
function dumps(L) {
  const head = ['how', 'since', 'updated', 'featured_summary', 'night_summary'].filter(k => k in L).map(k => ` ${JSON.stringify(k)}: ${JSON.stringify(L[k])}`);
  const map = M => { const keys = Object.keys(M || {}); return keys.length ? '{\n' + keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(M[k])}`).join(',\n') + '\n }' : '{}'; };
  return '{\n' + [...head, ` "featured": ${map(L.featured)}`, ...('night' in L ? [` "night": ${map(L.night)}`] : [])].join(',\n') + '\n}';
}

/* ---- the guard: every failure as a sentence ---- */
function gradeBad(key, e) {
  const bad = [];
  for (const [id, g] of Object.entries(e.grade || {})) {
    const tier = (e.tiers || []).find(x => x && x.id === id);
    if (!tier || !tier.legs) { bad.push(`${key} ${id}: a grade for a level with no parlay`); continue; }
    const s = (g && g.legs) || [];
    const ok = s.length === tier.legs.length && s.every(x => x == null || ['win', 'loss', 'push', 'void'].includes(x));
    const want = !ok ? null : s.includes('loss') ? 'lost' : s.some(x => x == null) ? 'pending' : s.every(x => x !== 'win') ? 'push' : 'won';
    if (!ok || !g || g.result !== want) { bad.push(`${key} ${id}: graded ${g && g.result} on legs ${JSON.stringify(s)}`); continue; }
    if (want === 'lost' && g.payout !== 0) bad.push(`${key} ${id}: a loss paying ${g.payout}`);
    if (want === 'push' && g.payout !== 1) bad.push(`${key} ${id}: a push paying ${g.payout}`);
    if (want === 'won' && !(g.payout > 1)) bad.push(`${key} ${id}: a win paying ${g.payout}`);
    if (want === 'won' && s.every(x => x === 'win') && g.payout !== tier.dec) bad.push(`${key} ${id}: every leg won and it pays ${g.payout}, not its price ${tier.dec}`);
    /* a win with a leg dropped (a push, or a void: a player who did not play, routine since the night's sets hold
       player legs) pays the builder's price on the legs left, to the thousandth: at most those legs' prices multiplied
       (a game's legs together never pay more: the builder's same-game price is the lower of that and HOLD over their
       implied joint chance), and exactly that where each game is left one leg. Until the review of 7 November 2026 any
       payout over 1 passed here, its whole price and more */
    if (want === 'won' && !s.every(x => x === 'win')) {
      const left = tier.legs.filter((l, i) => s[i] === 'win'), per = new Map();
      for (const l of left) per.set(l && l.id, (per.get(l && l.id) || 0) + 1);
      if (!left.every(l => isMap(l) && isFinite(l.odds) && l.odds)) { bad.push(`${key} ${id}: won with a leg dropped, and a leg left has no price`); continue; }
      const prod = left.reduce((t, l) => t * decOf(l.odds), 1);
      if (g.payout > prod + 5e-4 + 1e-9) bad.push(`${key} ${id}: won with a leg dropped, paying ${g.payout}, over the legs left's prices multiplied (${r3(prod)})`);
      else if ([...per.values()].every(c => c === 1) && Math.abs(g.payout - prod) > 5e-4 + 1e-9) bad.push(`${key} ${id}: won with a leg dropped, paying ${g.payout}, not the legs left's price (${r3(prod)}: one leg a game)`);
    }
  }
  return bad;
}
const holds = (t, pid) => !!(t && Array.isArray(t.legs) && t.legs.some(l => l && l.kind === 'prop' && l.pid === pid));
/* the four levels a set may hold (THE CUTOVER): taken before THREE_FROM, or held so, taken at the same time, by the file it
   is held to (pe: that file's entry under the same key) */
const fourOk = (e, pe) => Date.parse(e.taken_at) < Date.parse(THREE_FROM)
  || (isMap(pe) && Array.isArray(pe.tiers) && pe.tiers.map(x => x && x.id).join() === OLD_TIERS.join() && pe.taken_at === e.taken_at);
/* one entry on its own: its key, its game, its night, its lock, its legs, its replacements, its grades. pe: the entry
   under its key in the file it is held to, if any */
function entryBad(key, e, now, pe) {
  const bad = [], t = s => Date.parse(s);
  if (!isMap(e) || !e.gid || !e.tip || !e.lock || !e.taken_at || !e.date || !Array.isArray(e.tiers) || !Array.isArray(e.tv)) return [`${key}: no game, tip-off, lock, date, networks, levels or time taken`];
  if (key !== keyOf(e)) bad.push(`${key}: not keyed on its own season, date, tip-off and game (${keyOf(e)})`);
  const [gs, gd, ga, gh] = String(e.gid).split('_');
  if (+gs !== +e.season || gd !== String(e.date).replace(/-/g, '') || ga !== e.away || gh !== e.home) bad.push(`${key}: its game id is not of its season, date and clubs`);
  if (!isFinite(t(e.tip))) bad.push(`${key}: its tip-off ${e.tip} is not a time`);
  else {
    if (etDateOf(t(e.tip)) !== e.date) bad.push(`${key}: tips off ${e.tip}, which is ${etDateOf(t(e.tip))} in New York, not ${e.date}`);
    if (e.lock !== minIso(t(e.tip) - LOCK_MS)) bad.push(`${key}: locks at ${e.lock}, not 2 hours before its tip-off`);
    if (!(t(e.taken_at) < t(e.tip) - LOCK_MS)) bad.push(`${key}: taken at ${e.taken_at}, at or after its lock`);
  }
  /* today's FEATURED_TV.except judges only a set still to lock (one on a network dropped since is dropped by the job); a
     set past its lock stands on the rule it was taken under, so it needs only a network and no preseason: a network
     dropped later never fails every locked or graded set on it, which the record could then never get past */
  const lockedAt = isFinite(t(e.tip)) && t(e.tip) - LOCK_MS <= now;
  if (!(lockedAt ? e.type !== 'PRE' && e.tv.some(n => typeof n === 'string' && n) : featuredOf(e))) bad.push(`${key}: not a featured game by its own networks (${JSON.stringify(e.tv)}) and type (${e.type})`);
  const ids = e.tiers.map(x => x && x.id).join();
  if (ids === OLD_TIERS.join()) { if (!fourOk(e, pe)) bad.push(`${key}: taken at ${e.taken_at} with Extreme, a level the record has not taken since ${THREE_FROM}`); }
  else if (ids !== TIERS.join()) bad.push(`${key}: its levels are not the three (Safe, Medium, Aggressive)`);
  for (const x of e.tiers) {
    if (!isMap(x)) continue;
    if (x.n !== LEGS[x.id]) bad.push(`${key} ${x.id}: a level of ${x.n} legs, not ${LEGS[x.id]}`);
    if (!Array.isArray(x.legs)) continue;
    if (x.legs.length !== LEGS[x.id]) bad.push(`${key} ${x.id}: ${x.legs.length} legs on a level of ${LEGS[x.id]}`);
    if (x.legs.some(l => !isMap(l) || l.id !== e.gid)) bad.push(`${key} ${x.id}: a leg on another game than ${e.gid}`);
    const pl = x.legs.filter(l => l && l.kind === 'prop').map(l => l.pid), side = x.legs.filter(l => l && (l.kind === 'ml' || l.kind === 'spread')).length, tot = x.legs.filter(l => l && l.kind === 'total').length;
    if (new Set(pl).size < pl.length || side > 1 || tot > 1) bad.push(`${key} ${x.id}: a player twice, two side bets or two totals`);
  }
  const U = e.updates == null ? [] : e.updates;
  if (!Array.isArray(U)) bad.push(`${key}: its replacements are not a list`);
  else {
    for (const u of U) {
      /* a level of this set's own: Extreme only on a set that holds it (on a three-level set a replacement naming it belongs
         to no level, so no rule below would ever look at it) */
      if (!isMap(u) || !OLD_TIERS.includes(u.tier) || !e.tiers.some(x => isMap(x) && x.id === u.tier) || !u.pid || !u.at) { bad.push(`${key}: a replacement that names no level of its set, player or time`); continue; }
      if (!(t(u.at) >= t(e.tip) - LOCK_MS && t(u.at) < t(e.tip) && t(u.at) <= now)) bad.push(`${key} ${u.tier}: replaced at ${u.at}, not between its lock and its tip-off`);
    }
    for (const x of e.tiers) {
      if (!isMap(x)) continue;
      const mine = U.filter(u => isMap(u) && u.tier === x.id), lastU = mine[mine.length - 1];
      if (x.updated != null || lastU) {
        const { tier, ...want } = lastU || {};
        if (!lastU || canon(x.updated) !== canon(want)) bad.push(`${key} ${x.id}: its mark of a replacement is not the last one recorded for it`);
        else if (holds(x, lastU.pid)) bad.push(`${key} ${x.id}: replaced for ${lastU.pid}, and still holds him`);
      }
    }
  }
  if (e.grade && !(t(e.tip) <= now)) bad.push(`${key}: graded before its tip-off`);
  bad.push(...gradeBad(key, e));
  return bad;
}
/* ---- THE NIGHT: an entry on its own, and its levels worked out again on its pool ----
   THE PLAYER LEGS (the owner's call of 7 November 2026, "Add at DraftKings' odds"). An entry whose pool carries `pl` is
   the player-leg rule's: its pool holds the night's team legs as before ([key, price, the model's chance]) and the player
   legs a level could take ([key, price, DraftKings' fair chance, the other side's price]: a main line, over or under, on
   a stat the page offers, both prices on file, the chance this file's own reading of the page's rule, the whole margin
   on the Over), each game's legs together ([places..., their joint chance, their price]: pairs of two, sets of three or
   more), one leg a player, one side and one total a game. An entry without `pl` is the team rule's (team legs alone, a
   game's side and total its one pair), taken before PL_FROM, or by a run of the page before the change that landed after
   it, held so by the file it is held to (as THE CUTOVER holds Extreme above). PL_FROM is 23:00 UTC on 7 November 2026,
   after that night's set (taken at 19:12, team legs alone) locked: every night set taken after is the player-leg rule's */
const PL_FROM = '2026-11-07T23:00:00Z';
const PL_STATS = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'];
const PL_BAND = [0.45, 0.97];
const plOk = (e, pe) => Date.parse(e.taken_at) < Date.parse(PL_FROM) || (isMap(pe) && isMap(pe.pool) && !pe.pool.pl && pe.taken_at === e.taken_at);
const impOf = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100);
/* this file's own reading of DraftKings' fair chance of a player's main line (the page's legFair: the whole margin on the
   Over, so the Over's is 1 less the Under's implied chance, and the Under's that chance) */
const plFair = (side, price, other) => side === 'under' ? 1 - (1 - impOf(price)) : 1 - impOf(other);
const legKey = l => l.kind === 'prop' ? [l.id, 'prop', l.pid, l.stat, l.mk, l.mk === 'main' ? l.line : l.mk === 'mile' ? l.k : '', l.side].join('|') : [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
const decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
/* two legs of one game that go together: never one leg twice, one leg a player, one side and one total */
const fitsTwo = (a, b) => a.sk !== b.sk && !(a.pid && a.pid === b.pid) && !(a.side && b.side) && !(a.tot && b.tot);
/* the pool as kept: its legs, game by game, each game's options (a leg alone, or its legs together at the pool's own
   joint chance and price), or null where it is not the pool's shape. pl: the player-leg rule's pool */
function nightPool(e, P0) {
  const P = P0 || (e && e.pool); if (!isMap(P) || !Array.isArray(P.legs) || !Array.isArray(P.pairs)) return null;
  const pl = isMap(P.pl), legs = [];
  for (const x of P.legs) {
    if (!Array.isArray(x) || typeof x[0] !== 'string' || !isFinite(x[1]) || x[1] === 0 || !(x[2] > 0 && x[2] < 1)) return null;
    const f = x[0].split('|'), [gid, kind] = f;
    if (TEAM_KINDS.includes(kind)) {
      if (x.length !== 3) return null;
      /* a total of the player-leg rule's pool at its two prices' fair chance, so never over its own price's (a line priced
         with no margin is left out: the page's spPool) */
      if (pl && kind === 'total' && x[2] > impOf(x[1]) + 1e-12) return null;
      legs.push({ sk: x[0], gid, kind, side: kind !== 'total', tot: kind === 'total', pid: null, s: f[2], home: String(gid).split('_')[3], odds: x[1], p: x[2], d: decOf(x[1]) });
    } else if (kind === 'prop' && pl) {
      /* a player's main line: gid|prop|pid|stat|main|line|side, both prices, its chance DraftKings' fair chance */
      const [, , pid, stat, mk, line, sd] = f;
      if (x.length !== 4 || f.length !== 7 || !pid || !PL_STATS.includes(stat) || mk !== 'main' || !['over', 'under'].includes(sd) || !isFinite(+line) || line === '' || !isFinite(x[3]) || x[3] === 0) return null;
      if (Math.abs(x[2] - plFair(sd, x[1], x[3])) > 1e-9 || !(x[2] >= PL_BAND[0] && x[2] < PL_BAND[1])) return null;
      if (impOf(x[1]) + impOf(x[3]) < 1) return null;
      legs.push({ sk: x[0], gid, kind, side: false, tot: false, pid, stat, s: sd, line: +line, home: String(gid).split('_')[3], odds: x[1], other: x[3], p: x[2], d: decOf(x[1]) });
    } else return null;
  }
  if (new Set(legs.map(l => l.sk)).size !== legs.length) return null;
  const games = new Map();
  for (const l of legs) { if (!games.has(l.gid)) games.set(l.gid, []); games.get(l.gid).push({ legs: [l], p: l.p, d: l.d }); }
  const sets = [...P.pairs, ...(pl && Array.isArray(P.sets) ? P.sets : [])];
  if (!pl && P.sets != null) return null;
  for (const x of sets) {
    if (!Array.isArray(x) || x.length < 4 || (x.length > 4 && !pl)) return null;
    const L = x.slice(0, -2).map(i => legs[i]), pj = x[x.length - 2], dj = x[x.length - 1];
    if (L.some(l => !l) || new Set(L).size !== L.length || L.some(l => l.gid !== L[0].gid)) return null;
    if (L.some((a, i) => L.some((b, k) => k > i && !fitsTwo(a, b)))) return null;
    if (!pl && !(L.length === 2 && L[0].tot !== L[1].tot)) return null;
    if (!(pj > 0 && pj <= Math.min(...L.map(l => l.p)) + 1e-6) || !(dj > 1 && dj <= L.reduce((t, l) => t * l.d, 1) + 1e-6)) return null;
    games.get(L[0].gid).push({ legs: L, p: pj, d: dj });
  }
  return { legs, games: [...games.values()], pl };
}
/* c ranks above b by a level's rule: likelier, then dearer, then fewer legs, then the legs' ids */
const nightBetter = (c, b) => !b || c.p > b.p + NIGHT_TIE || (Math.abs(c.p - b.p) <= NIGHT_TIE && (c.d > b.d + NIGHT_TIE || (Math.abs(c.d - b.d) <= NIGHT_TIE && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
/* every parlay of the pool the level's rule takes, the best by the rule (from inc, a parlay to beat, where one is given);
   each game gives nothing or one of its options, of any size the level allows (no most since NOCAP_FROM). Walked game by
   game, the games taken in the order of the most any of their options returns on $1 (a side the model rates over its
   price first), each game's options by chance; a branch let go once its chance is under the best's (a parlay's chance is
   the product of its games' own, each at most 1, and the options after one too unlikely are less likely still), or, with
   a floor F, once no parlay of it can reach the best by this file's own reading of what is left (the frontier, below): a
   later game's option returning at most 1 on $1 lands at most 1 and returns at most 1, so a parlay of the branch (chance
   p, price d) that uses the later games' options K returning more than 1 and pays F lands at most min(p x prod P_K,
   p x d x prod E_K / F) (its chance is its return over its price); the most of that over every such K is worked from
   the Pareto frontier of (prod P_K, prod E_K) over the later games, built from the last game back, a point whose chance is
   under the best's to begin with left out (a branch's chance is at most 1, and the best only rises), and kept to 256
   points by putting neighbours together at their larger chance and larger return, which only raises it; read by halving,
   the lesser of the two rising one way and falling the other */
const NIGHT_FRONT = 256;
function nightBest(pool, [, , lo, hi0, F], inc, needPl) {
  const hi = hi0 == null ? Infinity : hi0;
  let best = inc || null; const chosen = [], better = nightBetter;
  const G = pool.games.map(os => os.filter(o => o.legs.length <= hi).sort((a, b) => b.p - a.p))
    .map(os => ({ os, top: os.reduce((t, o) => Math.max(t, o.p * o.d), 0), maxP: os.length ? os[0].p : 0 }))
    .sort((a, b) => (b.top - a.top) || (b.maxP - a.maxP)).map(g => g.os);
  /* with a player (needPl, the rule from PLAYER_FROM): a parlay is ranked only where some option of it holds a player's
     leg, and a branch holding none yet is let go once its chance times the likeliest such option of a later game (each
     at most 1, and the rest of its parlay's at most 1 too) is under the best's, and at once where no later game has such
     an option (nothing of the branch can be ranked, best or no best: the review of 10 November 2026 found the walk with
     no best yet, on a night with no player line, listing every parlay of the night, hours on ten games) */
  const plOpt = o => o.legs.some(l => l.pid), mPl = new Array(G.length + 1).fill(0);
  for (let j = G.length - 1; j >= 0; j--) mPl[j] = Math.max(mPl[j + 1], G[j].reduce((t, o) => plOpt(o) ? Math.max(t, o.p) : t, 0));
  const m = G.length, FR = new Array(m + 1); FR[m] = [[1, 1]];
  const thin = pts => {
    pts.sort((a, b) => (b[0] - a[0]) || (b[1] - a[1]));
    const out = []; let mb = -Infinity; for (const q of pts) if (q[1] > mb) { out.push(q); mb = q[1]; }
    if (out.length <= NIGHT_FRONT) return out;
    const k = Math.ceil(out.length / NIGHT_FRONT), z = [];
    for (let i = 0; i < out.length; i += k) { const b = out.slice(i, i + k); z.push([b[0][0], b[b.length - 1][1]]); }
    return z;
  };
  const th0 = best ? best.p - NIGHT_TIE : -Infinity, ok = q => q[1] > 1 && q[0] * (1 + 1e-12) >= th0;
  for (let j = m - 1; j >= 0; j--) {
    const pts = thin(G[j].map(o => [o.p * (1 + 1e-12), o.p * o.d * (1 + 1e-12)]).filter(ok)), all = [...FR[j + 1]];
    for (const [A, B] of FR[j + 1]) for (const [a, b] of pts) { const q = [A * a, B * b]; if (ok(q)) all.push(q); }
    FR[j] = thin(all);
  }
  const reach = (j, p, u) => { const F2 = FR[j], f = i => Math.min(p * F2[i][0], u * F2[i][1]); let lo = 0, hi2 = F2.length - 1;
    while (lo < hi2) { const mid = (lo + hi2) >> 1; if (p * F2[mid][0] > u * F2[mid][1]) lo = mid + 1; else hi2 = mid; }
    return Math.max(f(lo), lo > 0 ? f(lo - 1) : 0) * (1 + 1e-12); };
  const cut = () => best ? best.p - NIGHT_TIE : -Infinity;
  (function walk(i, p, d, n, hp) {
    if (p < cut()) return;
    if (n >= lo && d >= F - 1e-9 && (!needPl || hp)) { const ids = chosen.flatMap(o => o.legs.map(l => l.sk)).sort().join(','), c = { p, d, n, ids };
      if (better(c, best)) best = c; }
    if (i === m || n >= hi) return;
    if (needPl && !hp && (!(mPl[i] > 0) || p * mPl[i] * (1 + 1e-12) < cut())) return;
    if (F && best && reach(i, p, p * d / F) < cut()) return;
    walk(i + 1, p, d, n, hp);
    for (const o of G[i]) {
      if (p * o.p < cut()) break;
      const n2 = n + o.legs.length; if (n2 > hi) continue;
      if (F && best && reach(i + 1, p * o.p, p * d * o.p * o.d / F) < cut()) continue;
      chosen.push(o); walk(i + 1, p * o.p, d * o.d, n2, hp || plOpt(o)); chosen.pop();
    }
  })(0, 1, 1, 0, false);
  return best;
}
/* why a player is held out by the state the guard reads (this file's own copy of the page's rule, pbHeldWhy: the game's
   out lists, else any listing on today's report but probable), or why the props model has no row for him on one of the
   game's two clubs; null where he may be taken */
const plOut = (g, pid) => !!(g && g.model && [g.model.away, g.model.home].filter(Boolean).some(s => (s.out || []).some(y => String(y.id) === String(pid))));
const plRow = (state, gid, pid) => { const G = state && state.props && isMap(state.props.games) ? state.props.games[gid] : null; const r = isMap(G) && isMap(G.players) ? G.players[pid] : null; return Array.isArray(r) ? r : null; };
/* why the page's own rule (spOutWhy, the Parlay Builder's pbHeldWhy) holds a player out: the game's out lists, else any
   listing on today's report but probable; null where it does not */
function plListed(state, gid, pid) {
  if (!state) return null;
  const g = (state.slate || []).find(x => x.id === gid);
  if (plOut(g, pid)) return 'on the game\'s out list';
  const r = state.report && isMap(state.report.players) ? state.report.players[pid] : null;
  if (Array.isArray(r) && !/^probable/i.test(String(r[1] || '').trim())) return `listed ${String(r[1] || '').toLowerCase()} on the report`;
  return null;
}
function plHeld(state, gid, pid) {
  if (!state) return null;
  const why = plListed(state, gid, pid); if (why) return why;
  const g = (state.slate || []).find(x => x.id === gid), row = plRow(state, gid, pid);
  if (!row) return 'not projected by the props model in the game';
  if (!g || (row[1] !== g.away && row[1] !== g.home)) return 'not on either club of the game';
  return null;
}

/* ---- THE GUARD'S OWN READING (the review of 7 November 2026) ----
   The pool a set keeps is gathered by the page's own walk (its spPoolOut runs the search again, keeping what comes
   within 1% of a level), so a branch that walk wrongly let go would leave a leg out of the pool and the guard's
   enumeration on it would agree with the page. So for a set of the player-leg rule the run took (new or changed since
   the file it is held to, its lock to come), and for a level the run built again, the guard reads, from the run's own
   lines.json and state.json (check()'s o.lines and state; the command line reads the checkout's, or SUGGEST_LINES and
   SUGGEST_STATE), every player's main line of the night's games still to tip at the take again by its own copy of the
   page's rules (plOwn), holds the pool's counts and every player leg it kept to that reading, works every two legs of one
   game that go together (one leg a player, one side and one total) out by its own copula (tools/corr.js: joint2 at
   rhoFor's correlation, the price the lower of the two prices multiplied and HOLD over their implied joint chance, the
   builder's two-leg sums line for line), holds the pool's own pairs to it, and ranks each level again over every leg
   alone and every such pair of every leg read, and the pool's groups of three legs or more of one game, each held under
   its own pairs' chances (nightFull). So each level is the best its rule takes over every parlay whose games each give one
   or two legs, worked out here from the files alone; a parlay with three legs or more of one game is ranked over the
   groups the record keeps (what the page's walk gathers: README "Suggested Parlays", "The record's guard") */
const PL_COUNT_WORDS = { lines: 'read', band: 'out of the band', held: 'held out', none: 'not placed', vig: 'priced with no margin' };
/* the player legs of a night's games still to tip at an instant, read from lines.json by the page's rules: a main line
   on a stat the page offers with both prices (else skipped), on a player the props model projects in the game on one of
   its clubs and not on its out lists (else none), whom the report does not list (else held), priced with a margin (else
   vig), each side at DraftKings' fair chance (plFair), 45% to 97% (else band) */
function plOwn(state, lines, games, at) {
  const out = { legs: [], lines: 0, band: 0, held: 0, none: 0, vig: 0 };
  for (const eg of games || []) {
    const g = (state.slate || []).find(x => x.id === (eg && eg.gid));
    if (!g || g.type === 'PRE' || g.status !== 'scheduled' || !(Date.parse(g.tip) > at)) continue;
    const x = lines && isMap(lines.games) ? lines.games[g.id] : null, pr = isMap(x) && isMap(x.props) ? x.props : null;
    if (!pr || !Array.isArray(pr.mains)) continue;
    for (const m of pr.mains) {
      if (!m || !PL_STATS.includes(m.stat) || !Number.isFinite(m.line) || !Number.isFinite(m.over) || !Number.isFinite(m.under) || !m.over || !m.under) continue;
      const pid = String(m.player), row = plRow(state, g.id, pid);
      if (!row || plOut(g, pid) || (row[1] !== g.away && row[1] !== g.home)) { out.none += 2; continue; }
      if (plListed(state, g.id, pid)) { out.held += 2; continue; }
      if (impOf(m.over) + impOf(m.under) < 1) { out.vig += 2; continue; }
      for (const [sd, odds, other] of [['over', m.over, m.under], ['under', m.under, m.over]]) {
        out.lines++;
        const p = plFair(sd, odds, other);
        if (!(p > 0 && p < 1) || !(p >= PL_BAND[0] && p < PL_BAND[1])) { out.band++; continue; }
        out.legs.push({ sk: [g.id, 'prop', pid, m.stat, 'main', m.line, sd].join('|'), gid: g.id, kind: 'prop', side: false, tot: false, pid, stat: m.stat, s: sd, line: m.line, team: row[1], home: g.home, odds, other, p, d: decOf(odds) });
      }
    }
  }
  return out;
}
/* a leg as the copula reads it (the page's sgLeg) */
const KIND_OF = { ml: 'win', spread: 'cover', total: 'over' };
const clOf = l => l.kind === 'prop' ? { game: l.gid, kind: l.stat, player: l.pid, team: l.team, side: l.s, home: l.home } : { game: l.gid, kind: KIND_OF[l.kind], team: l.kind === 'total' ? '' : l.s, side: l.s, home: l.home };
/* two legs of one game together by the builder's own two-leg sums: their chance the copula's at their own chances, their
   price the lower of the two prices multiplied and HOLD over their implied joint chance, the legs in the key's order */
function pairOwn(corr, a, b) {
  const [x, y] = a.sk < b.sk ? [a, b] : [b, a], rho = CJ.rhoFor(corr.rho, clOf(x), clOf(y)) || 0;
  const J = CJ.joint2(impOf(x.odds), impOf(y.odds), rho), mult = decOf(x.odds) * decOf(y.odds);
  return { p: CJ.joint2(x.p, y.p, rho), d: J > 0 && isFinite(J) ? Math.min(mult, corr.hold / J) : mult };
}
/* this file's own copy of the page's spPosDef: a game's legs stand on its variables (a player's stat, the home side's win
   and its cover, the over), each leg its variable or its negative (an Under, the away side: rhoFor's signs), so every
   group of them a parlay may hold is positive definite wherever the variables' matrix is (a Cholesky factor, the
   builder's own threshold) */
function gamePosDef(corr, L) {
  const vars = new Map(), sgnOf = l => l.kind === 'prop' || l.kind === 'total' ? (l.s === 'under' ? -1 : 1) : (l.s === l.home ? 1 : -1);
  for (const l of L) { const k = l.kind === 'prop' ? `p|${l.pid}|${l.stat}` : `t|${l.kind === 'spread' ? 'cover' : l.kind}`; if (!vars.has(k)) vars.set(k, { l, s: sgnOf(l) }); }
  const V = [...vars.values()], n = V.length, A = V.map((a, i) => V.map((b, j) => i === j ? 1 : a.s * b.s * (CJ.rhoFor(corr.rho, clOf(a.l), clOf(b.l)) || 0)));
  const C = A.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let x = A[i][j]; for (let k = 0; k < j; k++) x -= C[i][k] * C[j][k];
    if (i === j) { if (x <= 1e-9) return false; C[i][i] = Math.sqrt(x); } else C[i][j] = x / C[j][j]; }
  return true;
}
/* THE GUARD'S OWN GROUPS (the review of 8 November 2026). With no leg limit a level often stands on three legs or more of
   one game, and the page keeps such a group in the pool only where its own search met it: a page that missed a deep winner
   (a leg limit put back, a cut too keen) would keep none, and the guard, ranking over the kept pool and its own pairs,
   would pass the level it took, or a level left empty. So the guard builds groups of its own in every game whose table is
   positive definite (gamePosDef: there the builder never shrinks a group's matrix), on its own copula of the table's
   correlations (ownJoint: one leg's chance; two by joint2; three by Simpson's rule over the first leg's normal with the
   other two by bvnUpper; four or more by the GHK sum on its own Halton points, OWN_SIMS of them), each priced as the
   builder prices a game's legs (their prices multiplied, or the hold over their joint chance at the prices' implied
   chances, the lower):
   - each game's chains: its legs that may go together taken greedily, the likeliest first, and again the best return on
     $1 first, every prefix of three legs or more up to OWN_MAX, a chain stopping once its chance is under the least of
     the levels' or it pays the highest floor;
   - each level's own groups of a game grown by one leg, each of the OWN_TOP likeliest of that game's legs that go with it.
   It is not every group (no search here is exhaustive over a game's thousands), but it is the groups a deep winner is
   made of on the nights that hid one (a leg limit put back left a night of heavy Unders empty, where Safe is 9 legs). Its
   figures are this file's own and not the builder's GHK sum, so each counts for less by OWN_TOL, its chance and its price
   both: an own group outranks a level, or fills an empty one, only by more than the two sums can differ */
const OWN_TOL = 5e-3, OWN_MAX = 12, OWN_TOP = 12, OWN_SIMS = 10000;
const OWN_PRIMES = [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 53, 59, 61, 67, 71, 73, 79, 83, 89, 97, 101, 103, 107, 109, 113];
const OWN_HAL = [];
const ownHal = i => OWN_HAL[i] || (OWN_HAL[i] = Float64Array.from({ length: OWN_SIMS }, (_, s) => { let f = 1, r = 0, k = s + 1; const b = OWN_PRIMES[i]; while (k > 0) { f /= b; r += f * (k % b); k = Math.floor(k / b); } return r; }));
function ownChol(R) {
  const n = R.length, C = R.map(() => new Array(n).fill(0));
  for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) { let x = R[i][j]; for (let k = 0; k < j; k++) x -= C[i][k] * C[j][k];
    if (i === j) { if (x <= 1e-9) return null; C[i][i] = Math.sqrt(x); } else C[i][j] = x / C[j][j]; }
  return C;
}
const ownPhi = z => Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
/* the chance all of a game's legs land, at chances ps, on correlations R (positive definite); null where it is not */
function ownJoint(R, ps) {
  const n = ps.length; if (n === 1) return ps[0];
  if (ps.some(q => !(q > 0 && q < 1))) return null;
  const t = ps.map(q => normInv(1 - q));
  if (n === 2) return CJ.bvnUpper(t[0], t[1], R[0][1]);
  const C = ownChol(R); if (!C) return null;
  if (n === 3) {
    const r1 = R[0][1], r2 = R[0][2], s1 = Math.sqrt(1 - r1 * r1), s2 = Math.sqrt(1 - r2 * r2), rc = (R[1][2] - r1 * r2) / (s1 * s2);
    const a = t[0], b = Math.max(a, 0) + 9, N = 1000, h = (b - a) / N; let sum = 0;
    for (let i = 0; i <= N; i++) { const z = a + i * h, w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; sum += w * ownPhi(z) * CJ.bvnUpper((t[1] - r1 * z) / s1, (t[2] - r2 * z) / s2, rc); }
    return Math.min(1, Math.max(0, sum * h / 3));
  }
  if (n - 1 > OWN_PRIMES.length) return null;
  const H = C.slice(0, n - 1).map((_, i) => ownHal(i)), y = new Array(n); let sum = 0;
  for (let s = 0; s < OWN_SIMS; s++) {
    let w = 1;
    for (let i = 0; i < n; i++) {
      let m = 0; for (let k = 0; k < i; k++) m += C[i][k] * y[k];
      const lo = normCdf((t[i] - m) / C[i][i]), q = 1 - lo; w *= q; if (!(w > 0)) break;
      if (i < n - 1) y[i] = normInv(Math.min(1 - 1e-15, lo + H[i][s] * q));
    }
    sum += w > 0 ? w : 0;
  }
  return sum / OWN_SIMS;
}
/* a game's legs together by this file's own copula: their chance, and their price as the builder prices them */
function ownFig(corr, L) {
  const T = [...L].sort((a, b) => a.sk < b.sk ? -1 : 1), R = T.map((a, i) => T.map((b, j) => i === j ? 1 : (CJ.rhoFor(corr.rho, clOf(a), clOf(b)) || 0)));
  const p = ownJoint(R, T.map(l => l.p)), J = ownJoint(R, T.map(l => impOf(l.odds))), prod = T.reduce((x, l) => x * l.d, 1);
  if (p == null || J == null) return null;
  return { p, d: J > 0 ? Math.min(prod, corr.hold / J) : prod };
}
/* the game's own groups (above): options of three legs or more, at their own figures less OWN_TOL, none the pool keeps */
function ownGroups(corr, L, seeds, pmin, Fmax, has) {
  const out = [], seen = new Set(has), fitsAll = (T, x) => T.every(y => fitsTwo(y, x));
  const add = T => { if (T.length < 3) return null; const k = T.map(l => l.sk).sort().join('~'); if (seen.has(k)) return null; seen.add(k);
    const f = ownFig(corr, T); if (!f) return null;
    const o = { legs: [...T].sort((a, b) => a.sk < b.sk ? -1 : 1), p: f.p / (1 + OWN_TOL), d: f.d / (1 + OWN_TOL), own: true }; out.push(o); return f; };
  const byP = [...L].sort((a, b) => (b.p - a.p) || (a.sk < b.sk ? -1 : 1)), byE = [...L].sort((a, b) => (b.p * b.d - a.p * a.d) || (b.p - a.p) || (a.sk < b.sk ? -1 : 1));
  for (const order of [byP, byE]) {
    const T = [];
    for (const x of order) {
      if (T.length >= OWN_MAX) break;
      if (!fitsAll(T, x)) continue;
      T.push(x); if (T.length < 3) continue;
      const f = add(T) || ownFig(corr, T); if (!f || f.p < pmin / (1 + OWN_TOL) || f.d >= Fmax * (1 + OWN_TOL)) break;
    }
  }
  for (const G of seeds) if (G.length >= 2) {
    for (const x of byP.filter(x => !G.some(y => y.sk === x.sk) && fitsAll(G, x)).slice(0, OWN_TOP)) add([...G, x]);
  }
  return out;
}
/* a pool (P as kept, kept: nightPool's reading of it) held to this file's own reading of the run's files, and the pool the
   levels are ranked on here: the kept team legs, every player leg read, every two legs of one game together by pairOwn,
   and the kept groups of three legs or more (each at most its own pairs' chance). tag names the pool in the words */
function nightFull(key, P, kept, state, lines, games, at, tag, tiers) {
  const bad = [], own = plOwn(state, lines, games, at), c = isMap(P.pl) ? P.pl : {}, w = tag ? ` (${tag})` : '';
  const corr = state && state.corr && isMap(state.corr.rho) && state.corr.hold > 0 ? state.corr : null;
  if (!corr) return { bad: [`${key}${w}: the run's state.json has no same-game table, so the guard cannot work its pairs out`], pool: null };
  for (const k of Object.keys(PL_COUNT_WORDS)) if (c[k] !== own[k]) bad.push(`${key}${w}: its pool counts ${c[k]} player lines ${PL_COUNT_WORDS[k]}, where this file's own reading of the run's lines.json and state.json counts ${own[k]}`);
  const keptPl = kept.legs.filter(l => l.pid), at2 = new Map(own.legs.map(l => [l.sk, l]));
  if (c.cut !== own.legs.length - keptPl.length) bad.push(`${key}${w}: its pool says ${c.cut} player legs in the band were left out, where this file's own reading has ${own.legs.length} in the band and the pool keeps ${keptPl.length}`);
  for (const l of keptPl) { const o = at2.get(l.sk); if (!o || o.odds !== l.odds || o.other !== l.other || o.p !== l.p) bad.push(`${key}${w}: its pool keeps ${l.sk} at ${l.odds}, ${l.p}, which is no player leg of the run's lines.json by this file's own reading`); }
  const legs = [...kept.legs.filter(l => !l.pid), ...own.legs], byG = new Map();
  for (const l of legs) { if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(l); }
  /* the kept pool's own pairs held to pairOwn */
  for (const os of kept.games) for (const o of os) if (o.legs.length === 2) {
    const [a, b] = o.legs.map(l => l.pid ? at2.get(l.sk) : l);
    if (!a || !b) continue;   /* a leg no player leg read: said above */
    const f = pairOwn(corr, a, b);
    if (Math.abs(f.p - o.p) > 1e-12 || Math.abs(f.d - o.d) > 1e-9) bad.push(`${key}${w}: its pool keeps ${a.sk} with ${b.sk} at ${o.p}, ${o.d}, where the builder's two-leg sums give ${f.p}, ${f.d}`);
  }
  const games2 = [];
  for (const [gid, L] of byG) {
    const os = L.map(l => ({ legs: [l], p: l.p, d: l.d }));
    const pair = new Map();
    for (let i = 0; i < L.length; i++) for (let k = i + 1; k < L.length; k++) { const a = L[i], b = L[k]; if (!fitsTwo(a, b)) continue;
      const f = pairOwn(corr, a, b); const o = { legs: a.sk < b.sk ? [a, b] : [b, a], p: f.p, d: f.d }; os.push(o); pair.set(o.legs.map(l => l.sk).join('~'), f.p); }
    /* a group of three legs or more lands no oftener than two of its legs together, on the copula of the table's own
       correlations wherever the game's matrix is positive definite (this file's own check, gamePosDef: then the builder
       never shrinks a group's matrix); where it is not, the builder shrinks a group's correlations toward 0, so the cap
       is two legs at max(rho, 0) (the review of 8 November 2026) */
    const pd = gamePosDef(corr, L), capOf = (a, b) => pd ? (pair.has(a.sk + '~' + b.sk) ? pair.get(a.sk + '~' + b.sk) : pair.get(b.sk + '~' + a.sk)) : CJ.joint2(a.p, b.p, Math.max(0, CJ.rhoFor(corr.rho, clOf(a), clOf(b)) || 0));
    for (const o of (kept.games.find(g => g[0].legs[0].gid === gid) || [])) if (o.legs.length >= 3) {
      const ks = o.legs.map(l => l.sk).sort(), cap = Math.min(...o.legs.flatMap((a, i) => o.legs.slice(i + 1).map(b => { const v = capOf(a, b); return v == null ? Infinity : v; })));
      if (!(o.p <= cap + 1e-9)) bad.push(`${key}${w}: its pool keeps ${ks.join(' with ')} at ${o.p}, over the chance two of them land together by the builder's own sums (${cap})`);
      os.push(o);
    }
    /* the guard's own groups of three legs or more (above), where the game's table is positive definite */
    if (pd) { const has = os.filter(o => o.legs.length >= 3).map(o => o.legs.map(l => l.sk).sort().join('~')), bySk = new Map(L.map(l => [l.sk, l]));
      const seeds = (Array.isArray(tiers) ? tiers : []).filter(t => isMap(t) && Array.isArray(t.legs)).map(t => t.legs.map(l => bySk.get(legKey(l))).filter(Boolean)).filter(T => T.length >= 2 && T.every(l => l.gid === gid));
      const lvP = (Array.isArray(tiers) ? tiers : []).filter(t => isMap(t) && Array.isArray(t.legs) && t.p > 0), pmin = lvP.length === 3 ? Math.min(...lvP.map(t => +t.p)) : 0;
      os.push(...ownGroups(corr, L, seeds, pmin, Math.max(...NIGHT_LEVELS.map(l => l[4])), has)); }
    games2.push(os);
  }
  return { bad, pool: { legs, games: games2, pl: true } };
}
/* one level against a pool (the entry's, or its own where it was built again): its legs, its figures and its rank */
function nightLevelBad(key, x, lv, pool, ids, pl, tag, plc) {
  const bad = [], [id, label, lo, hi, F, need] = lv, w = tag ? ` (${tag})` : '';
  if (x.label !== label || x.min !== lo || x.max !== hi || x.price !== F || x.need !== need) bad.push(`${key} ${id}: not the level's own label, range, floor and rule (${label}, ${hi == null ? `${lo} legs or more` : `${lo} to ${hi} legs`}, ${F || 'no floor'}${need ? ', with a player' : ''})`);
  /* WITH A PLAYER: a level holding none says why (nopl), as this file reads its pool's counts; no other level says so */
  const hasP = Array.isArray(x.legs) && x.legs.some(l => isMap(l) && l.kind === 'prop');
  if (need && Array.isArray(x.legs) && !hasP) { if (!NOPL.includes(x.nopl)) bad.push(`${key} ${id}: holds no player leg and says no why (nopl)`); else if (x.nopl !== noPlOf(plc)) bad.push(`${key} ${id}: holds no player leg "${x.nopl}", where its pool's counts say "${noPlOf(plc)}"`); }
  else if (x.nopl !== undefined) bad.push(`${key} ${id}: says why it holds no player leg (nopl ${x.nopl}), where ${need ? 'it holds one or is empty' : 'its rule asks none'}`);
  if (!Array.isArray(x.legs)) {
    if (typeof x.why !== 'string' || !x.why) bad.push(`${key} ${id}: neither legs nor why`);
    else if (pool) { const b = nightBest(pool, lv); if (b) bad.push(`${key} ${id}: empty, and the pool${w} makes a parlay its rule takes (${b.ids}, ${(b.p * 100).toFixed(2)}%, ${b.d.toFixed(3)})`); }
    return bad;
  }
  const L = x.legs;
  if (L.length < lo || (hi != null && L.length > hi)) bad.push(`${key} ${id}: ${L.length} legs, outside its ${hi == null ? `${lo} or more` : `${lo} to ${hi}`}`);
  if (L.some(l => !isMap(l) || !ids.has(l.id))) { bad.push(`${key} ${id}: a leg on no game of the night`); return bad; }
  if (L.some(l => !TEAM_KINDS.includes(l.kind) && !(pl && l.kind === 'prop'))) { bad.push(`${key} ${id}: ${pl ? 'a leg that is neither a team leg nor a player\'s line' : 'a player\'s leg (the night set took team legs alone before the player-leg rule)'}`); return bad; }
  if (L.some(l => l.kind === 'prop' && (l.mk !== 'main' || !['over', 'under'].includes(l.side) || !PL_STATS.includes(l.stat) || !isFinite(l.odds) || !isFinite(l.other)))) { bad.push(`${key} ${id}: a player's leg that is not a main line, over or under, with both prices, on a stat the page offers`); return bad; }
  const ks = L.map(legKey);
  if (new Set(ks).size < ks.length) bad.push(`${key} ${id}: a leg twice`);
  const pids = L.filter(l => l.kind === 'prop').map(l => String(l.pid));
  if (new Set(pids).size < pids.length) bad.push(`${key} ${id}: two legs of one player`);
  const per = new Map(); for (const l of L) { if (l.kind === 'prop') continue; const g = per.get(l.id) || { side: 0, total: 0 }; g[l.kind === 'total' ? 'total' : 'side']++; per.set(l.id, g); }
  if ([...per.values()].some(g => g.side > 1 || g.total > 1)) bad.push(`${key} ${id}: two side bets or two totals of one game`);
  if (!(x.dec >= F - 1e-9)) bad.push(`${key} ${id}: pays ${x.dec} on $1, under its floor ${F}`);
  if (!pool) return bad;
  /* the level's own chance and price as the pool has them: each game's legs alone or together */
  const byG = new Map(); for (const l of L) { if (!byG.has(l.id)) byG.set(l.id, []); byG.get(l.id).push(legKey(l)); }
  let pc = 1, dc = 1, inPool = true;
  for (const [gid, sk] of byG) {
    const opt = (pool.games.find(gg => gg[0].legs[0].gid === gid) || []).find(o => o.legs.length === sk.length && o.legs.every(l => sk.includes(l.sk)));
    if (!opt) { inPool = false; break; }
    pc *= opt.p; dc *= opt.d;
  }
  const at = new Map(pool.legs.map(l => [l.sk, l]));
  if (!inPool || L.some(l => { const q = at.get(legKey(l)); return !q || q.odds !== l.odds || Math.abs(q.p - l.p) > 5e-5; })) { bad.push(`${key} ${id}: a leg, or a game's legs together, not in its pool${w} at its own price and chance`); return bad; }
  if (Math.abs(pc - x.p) > 1e-4 || Math.abs(dc - x.dec) > 1e-3) bad.push(`${key} ${id}: its chance ${x.p} and price ${x.dec} are not its legs' as its pool${w} has them (${pc.toFixed(5)}, ${dc.toFixed(4)})`);
  if (!(dc >= F - 1e-6)) bad.push(`${key} ${id}: its legs pay ${dc.toFixed(4)} on $1 by its pool${w}, under its floor ${F}`);
  const mine = ks.slice().sort().join(','), inc = { p: pc, d: dc, n: L.length, ids: mine };
  /* WITH A PLAYER: a level holding one is ranked over every parlay holding one (this file's own enumeration with the
     rule's word); a level holding none is ranked over every parlay, and stands only where the pool makes no parlay
     holding one that its rule takes */
  if (need && !hasP) { const bp = nightBest(pool, lv, null, true);
    if (bp) bad.push(`${key} ${id}: holds no player leg, and the pool${w} makes a parlay holding one that its rule takes (${bp.ids}, ${(bp.p * 100).toFixed(3)}%, ${bp.d.toFixed(3)})`); }
  const b = nightBest(pool, lv, inc, !!need && hasP);
  if (b && b !== inc && b.ids !== mine && nightBetter(b, inc))
    bad.push(`${key} ${id}: not the likeliest its rule takes${w}${need && hasP ? ' with a player' : ''}: ${b.ids} (${(b.p * 100).toFixed(3)}%, ${b.d.toFixed(3)}) over its ${mine} (${(pc * 100).toFixed(3)}%, ${dc.toFixed(3)})`);
  return bad;
}
/* one night entry. pe: the entry under its key in the file it is held to; state: the state.json the run published (who
   is held out now: a set still to lock holds no such player); lines: the lines.json the run read (with the state, a set
   or a level the run took is held to this file's own reading of them: THE GUARD'S OWN READING) */
function nightEntryBad(key, e, now, pe, state, lines) {
  const bad = [], t = s => Date.parse(s);
  if (!isMap(e) || !e.nid || !e.tip || !e.last || !e.lock || !e.taken_at || !e.date || !Array.isArray(e.games) || !e.games.length || !Array.isArray(e.tiers) || !isMap(e.pool)) return [`${key}: no night, games, tip-off, lock, date, levels, pool or time taken`];
  if (key !== nightKeyOf(e)) bad.push(`${key}: not keyed on its own season, date, first tip-off and night (${nightKeyOf(e)})`);
  if (e.nid !== nightIdOf(e.season, e.date)) bad.push(`${key}: its night id ${e.nid} is not of its season and date`);
  const ids = new Set();
  for (const g of e.games) {
    const [gs, gd, ga, gh] = String(g && g.gid).split('_');
    if (!isMap(g) || +gs !== +e.season || gd !== String(e.date).replace(/-/g, '') || ga !== g.away || gh !== g.home) { bad.push(`${key}: a game ${g && g.gid} not of its season, date and clubs`); continue; }
    if (g.type === 'PRE') bad.push(`${key}: ${g.gid} is a preseason game`);
    if (!isFinite(t(g.tip)) || etDateOf(t(g.tip)) !== e.date) bad.push(`${key}: ${g.gid} tips off ${g.tip}, not on ${e.date} in New York`);
    ids.add(g.gid);
  }
  const tips = e.games.map(g => t(g && g.tip)).filter(isFinite);
  if (tips.length && (t(e.tip) !== Math.min(...tips) || !e.games.some(g => g.tip === e.tip))) bad.push(`${key}: its tip-off ${e.tip} is not its games' first`);
  if (tips.length && (t(e.last) !== Math.max(...tips) || !e.games.some(g => g.tip === e.last))) bad.push(`${key}: its last tip-off ${e.last} is not its games' last`);
  if (!isFinite(t(e.tip))) bad.push(`${key}: its tip-off ${e.tip} is not a time`);
  else {
    if (etDateOf(t(e.tip)) !== e.date) bad.push(`${key}: tips off ${e.tip}, which is ${etDateOf(t(e.tip))} in New York, not ${e.date}`);
    if (e.lock !== minIso(t(e.tip) - LOCK_MS)) bad.push(`${key}: locks at ${e.lock}, not 2 hours before its first tip-off`);
    if (!(t(e.taken_at) < t(e.tip) - LOCK_MS)) bad.push(`${key}: taken at ${e.taken_at}, at or after its lock`);
  }
  if (e.tiers.map(x => x && x.id).join() !== NIGHT_IDS.join()) bad.push(`${key}: its levels are not the three (Safe, Medium, Aggressive)`);
  /* NO LEG LIMIT: the rule its levels' heads say, the old one only on a set taken before NOCAP_FROM or held so */
  const rule = nightRule(e), LV = rule === 'fair' ? NIGHT_LEVELS_RULER : rule === 'old' ? NIGHT_LEVELS_OLD : rule === 'nocap' ? NIGHT_LEVELS_NOCAP : NIGHT_LEVELS;
  if (!rule) bad.push(`${key}: its levels' heads are neither the ruler's (${NIGHT_LEVELS_RULER.map(l => `${l[1]} ${l[2]}+ legs paying $${l[4]}+ at DraftKings' fair chance`).join(', ')}) nor the ones before ${RULER_FROM}, ${PLAYER_FROM} and ${NOCAP_FROM}`);
  /* ONE RULER: a set of an older rule's heads taken from RULER_FROM, or one of the ruler's taken before it, only as the file
     it is held to holds it, taken at the same time */
  else if (rule !== 'fair' && !rulerOk(e, pe)) bad.push(`${key}: taken at ${e.taken_at} under a rule before the ruler (its heads the ${rule === 'player' ? 'rule with a player' : rule === 'nocap' ? 'rule of 8 November' : 'rule before 8 November'}), which the record has not taken since ${RULER_FROM}`);
  else if (rule === 'fair' && !rulerLateOk(e, pe)) bad.push(`${key}: taken at ${e.taken_at} under the ruler, before its cutoff ${RULER_FROM}`);
  else if (rule === 'old' && !oldOk(e, pe)) bad.push(`${key}: taken at ${e.taken_at} with a leg limit (Safe a pair with no floor, Medium and Aggressive 5 legs at most), a rule the record has not taken since ${NOCAP_FROM}`);
  else if (rule === 'nocap' && !nocapOk(e, pe)) bad.push(`${key}: taken at ${e.taken_at} with no player leg asked of a level, a rule the record has not taken since ${PLAYER_FROM}`);
  const pl = isMap(e.pool.pl);
  if (rule === 'fair') return [...bad, ...rulerEntryBad(key, e, now, pe, state, lines, LV, ids), ...nightUpdatesBad(key, e, now)];
  if (rule === 'player' && !pl) bad.push(`${key}: the rule with a player on a pool of team legs alone`);
  if (!pl && !plOk(e, pe)) bad.push(`${key}: taken at ${e.taken_at} with team legs alone, a rule the record has not taken since ${PL_FROM} (no player legs in its pool)`);
  if (pl) { const c = e.pool.pl; if (!['lines', 'band', 'held', 'none', 'vig', 'cut'].every(k => Number.isInteger(c[k]) && c[k] >= 0)) bad.push(`${key}: its player legs' counts are not counts`); }
  const pool = nightPool(e);
  if (!pool) bad.push(`${key}: its pool is not a pool of ${pl ? 'team legs and players\' main lines, at DraftKings\' fair chance for a player, each line priced with a margin, with each game\'s legs together' : 'team legs, with each game\'s side and total together'}`);
  else if (pool.legs.some(l => !ids.has(l.gid))) bad.push(`${key}: its pool holds a leg of no game of the night`);
  else if (nightNoLines(e)) bad.push(`${key}: taken with no DraftKings line posted for any game of the night (no set is taken until one is)`);
  /* a set still to lock takes no player the injury report lists, and none the props model does not place in his game */
  if (pool && pl && state && isFinite(t(e.tip)) && now < t(e.tip) - LOCK_MS && +state.season === +e.season)
    for (const l of pool.legs) if (l.pid) { const why = plHeld(state, l.gid, l.pid); if (why) { bad.push(`${key}: its pool holds ${l.sk}, a player ${why}`); break; } }
  /* a set of the player-leg rule the run took (new or changed since the file it is held to, its lock to come), on the
     run's state.json and lines.json: its pool held to this file's own reading of them, and its levels ranked over every
     leg and pair that reading makes (nightFull) */
  const own = !!(pool && pl && state && lines && +state.season === +e.season && isFinite(t(e.tip)) && now < t(e.tip) - LOCK_MS && (!pe || canon(callOf(e)) !== canon(callOf(pe))));
  let rank = pool;
  if (own) {
    if (e.generated !== state.generated) bad.push(`${key}: taken at ${e.taken_at} on a state.json of ${e.generated}, not the run's (${state.generated})`);
    const F = nightFull(key, e.pool, pool, state, lines, e.games, t(e.taken_at), null, e.tiers); bad.push(...F.bad); if (F.pool) rank = F.pool;
  }
  e.tiers.forEach((x, i) => {
    const lv = LV[i]; if (!isMap(x) || !lv || x.id !== lv[0]) return;
    /* a level built again after the lock for a player ruled out is held to its own pool, which holds him nowhere; one the
       run built (changed since the file it is held to, before the first tip-off) held to this file's own reading of the
       run's files as its pool was, at the time it was built */
    if (x.updated != null) {
      const op = nightPool(e, x.pool);
      if (!pl || !op) { bad.push(`${key} ${x.id}: built again${pl ? ' with no pool of its own' : ', on a set of the team rule'}`); return; }
      if (op.legs.some(l => l.pid && String(l.pid) === String(x.updated.pid))) bad.push(`${key} ${x.id}: built again for ${x.updated.pid}, and its pool still holds him`);
      if (op.legs.some(l => !ids.has(l.gid))) bad.push(`${key} ${x.id}: its own pool holds a leg of no game of the night`);
      let rk = op;
      const pt = pe && Array.isArray(pe.tiers) ? pe.tiers[i] : null;
      if (state && lines && +state.season === +e.season && isFinite(t(e.tip)) && now < t(e.tip) && isFinite(t(x.updated.at)) && (!pt || canon(pt) !== canon(x))) {
        const F = nightFull(`${key} ${x.id}`, x.pool, op, state, lines, e.games, t(x.updated.at), 'its own'); bad.push(...F.bad); if (F.pool) rk = F.pool; }
      bad.push(...nightLevelBad(key, x, lv, rk, ids, true, 'its own', isMap(x.pool) ? x.pool.pl : null));
      return;
    }
    if (x.pool != null) bad.push(`${key} ${x.id}: a pool of its own, never built again`);
    bad.push(...nightLevelBad(key, x, lv, rank, ids, pl, own ? 'this file\'s own reading of the run\'s files' : null, e.pool.pl));
    /* a set the run took is held to the pool it keeps too, as it will be on every run from its lock: a kept pool that
       cannot make its own level is refused at the take, never first at the lock (the review of 8 November 2026) */
    if (own && rank !== pool) bad.push(...nightLevelBad(key, x, lv, pool, ids, pl, 'its pool as kept', e.pool.pl));
  });
  return [...bad, ...nightUpdatesBad(key, e, now)];
}
/* a night entry's record of replacements and its grades, whatever its rule */
function nightUpdatesBad(key, e, now) {
  const bad = [], t = s => Date.parse(s);
  /* its record of replacements: each a level of the set, a player and a time between the lock and the first tip-off */
  const U = e.updates == null ? [] : e.updates;
  if (!Array.isArray(U)) bad.push(`${key}: its replacements are not a list`);
  else {
    for (const u of U) {
      if (!isMap(u) || !NIGHT_IDS.includes(u.tier) || !u.pid || !u.at) { bad.push(`${key}: a replacement that names no level of its set, player or time`); continue; }
      if (!(t(u.at) >= t(e.tip) - LOCK_MS && t(u.at) < t(e.tip) && t(u.at) <= now)) bad.push(`${key} ${u.tier}: replaced at ${u.at}, not between its lock and its first tip-off`);
    }
    for (const x of e.tiers) {
      if (!isMap(x)) continue;
      const mine = U.filter(u => isMap(u) && u.tier === x.id), lastU = mine[mine.length - 1];
      if (x.updated != null || lastU) {
        const { tier, ...want } = lastU || {};
        if (!lastU || canon(x.updated) !== canon(want)) bad.push(`${key} ${x.id}: its mark of a replacement is not the last one recorded for it`);
        else if (holds(x, lastU.pid)) bad.push(`${key} ${x.id}: replaced for ${lastU.pid}, and still holds him`);
      }
    }
  }
  if (e.grade && !(t(e.tip) <= now)) bad.push(`${key}: graded before its first tip-off`);
  bad.push(...gradeBad(key, e));
  return bad;
}
/* ---- ONE RULER (the owner's call of 11 November 2026) ----
   Every set taken from RULER_FROM is the ruler's (its heads carry chance: 'fair', NIGHT_LEVELS_RULER): its legs, team
   and player alike, at DraftKings' fair chance (a team line's two prices with the margin out in proportion, a player's
   main line's whole margin on the Over), on the default filters (every bet type, every game, every stat, any price),
   each level within half a percent of the likeliest parlay paying its floor, the fewest legs any such parlay has, the
   likeliest of that many within 0.1% (the page's THE RULER SEARCH, whose comment is the proof). This file holds such a
   level BY PROPERTY, on its own: a valid parlay (two legs or more, one leg a player, one side and one total a game, every
   leg in the kept pool at its kept price and fair chance, each game's legs at the kept group's figures, held to this
   file's own copula), paying its floor, and at a chance of (1 - TAU_G) times THIS FILE'S OWN UPPER BOUND on the likeliest
   paying parlay or more (rulerBound, below: written apart from the page's search, it never finds a parlay). At the take
   the bound is worked on this file's own reading of the run's files (every team leg and player main line of the night's
   games still to tip, as the page's pool reads them); from the lock on the pool as kept (its levels' legs are all in it).
   TAU_G is 1%: the page's TAU (0.5%, the rule's own tolerance), its ETA (0.1%, the search's precision), the bound's slack
   (its price cells round every unit's price up, and a same-game group of the bound stands on the HOLD envelope: on real
   nights at the default filters it sits within 0.2% of the best parlay, research/sp_ruler/engine.md) and the builder's
   GHK sum against this file's copula (0.05%), with room. The fewest-legs choice is presentation: the tests hold it, this
   file does not. A set of an older rule's heads taken from RULER_FROM is refused unless the file it is held to holds it
   so, taken at the same time (a run of the page before the change, landing after RULER_FROM: the PLAYER_FROM pattern), and
   a set of the ruler's heads taken before it the same (the page takes the ruler's sets from RULER_FROM alone).
   RULER_FROM is the page's SP_RULER_FROM (the job refuses a page whose cutoff is another). PLACEHOLDER: the build step
   left it at an hour still to come; the finish step sets it. SUGGEST_RULER_FROM moves it for the test alone */
const RULER_FROM_SET = '2026-11-13T15:00:00Z';
const RULER_FROM = process.env.SUGGEST_RULER_FROM || RULER_FROM_SET;
const NIGHT_LEVELS_RULER = [['safe', 'Safe', 2, null, 2, 'fair'], ['med', 'Medium', 2, null, 4, 'fair'], ['aggr', 'Aggressive', 2, null, 8, 'fair']];
const TAU_G = 0.01;
const rulerOk = (e, pe) => Date.parse(e.taken_at) < Date.parse(RULER_FROM) || (isMap(pe) && nightRule(pe) === nightRule(e) && pe.taken_at === e.taken_at);
const rulerLateOk = (e, pe) => Date.parse(e.taken_at) >= Date.parse(RULER_FROM) || (isMap(pe) && nightRule(pe) === 'fair' && pe.taken_at === e.taken_at);
/* this file's own reading of a team line's fair chance (the page's legFair: the two prices with the margin out in
   proportion) */
const teamFair = (price, other) => { const i = impOf(price), o = impOf(other); return i / (i + o); };
/* tools/lines_feed.js linesGl, line for line (the page's own copy): a lines.json entry -> the game lines, or null */
function glOwn(x) {
  if (!isMap(x) || !(x.ml || x.spread || x.total)) return null;
  const id = (k, s) => (x.ids && x.ids[k] && x.ids[k][s]) || null, out = { event: (x.ids && x.ids.event) || null };
  if (x.ml) out.ml = { home: { odds: x.ml.home, id: id('ml', 'home') }, away: { odds: x.ml.away, id: id('ml', 'away') } };
  if (x.spread) out.spread = { home: { line: x.spread.line, odds: x.spread.home, id: id('spread', 'home') }, away: { line: -x.spread.line, odds: x.spread.away, id: id('spread', 'away') } };
  if (x.total) out.total = { line: x.total.line, over: { odds: x.total.over, id: id('total', 'over') }, under: { odds: x.total.under, id: id('total', 'under') } };
  return out;
}
const glCarries = gl => !!gl && (!!gl.event || ['ml', 'spread'].some(k => gl[k] && (gl[k].home.id || gl[k].away.id)) || !!(gl.total && (gl.total.over.id || gl.total.under.id)));
const TEAM_COUNT_WORDS = { band: 'out of the band', noId: 'with no DraftKings id', vig: 'priced with no margin' };
/* the team legs of a night's games still to tip at an instant, read from lines.json by the page's rules (pbPriced and
   pbTotals: a moneyline and a spread of a game the model rates, a total of any game), each at DraftKings' fair chance with
   both prices on file and a margin (else vig), 45% to 97% (else band), a game line's betslip id where its game's lines carry
   ids (else noId) */
function teamOwn(state, lines, games, at) {
  const out = { legs: [], band: 0, noId: 0, vig: 0 };
  for (const eg of games || []) {
    const g = (state.slate || []).find(x => x.id === (eg && eg.gid));
    if (!g || g.type === 'PRE' || g.status !== 'scheduled' || !(Date.parse(g.tip) > at)) continue;
    const gl = glOwn(lines && isMap(lines.games) ? lines.games[g.id] : null); if (!gl) continue;
    const on = glCarries(gl), take = (kind, side, line, odds, other, id) => {
      if (!isFinite(odds) || !odds) { out.band++; return; }
      if (!isFinite(other) || !other || impOf(odds) + impOf(other) < 1) { out.vig++; return; }
      const p = teamFair(odds, other); if (!(p >= PL_BAND[0] && p < PL_BAND[1])) { out.band++; return; }
      if (on && !id) { out.noId++; return; }
      out.legs.push({ sk: [g.id, kind, side, line == null ? '' : line].join('|'), gid: g.id, kind, side: kind !== 'total', tot: kind === 'total', pid: null, s: side, line, home: g.home, odds, other, p, d: decOf(odds) });
    };
    if (g.model) {
      if (gl.ml) for (const s of ['away', 'home']) take('ml', g[s], null, gl.ml[s].odds, gl.ml[s === 'home' ? 'away' : 'home'].odds, gl.ml[s].id);
      if (gl.spread) for (const s of ['away', 'home']) take('spread', g[s], gl.spread[s].line, gl.spread[s].odds, gl.spread[s === 'home' ? 'away' : 'home'].odds, gl.spread[s].id);
    }
    if (gl.total) for (const s of ['over', 'under']) take('total', s, gl.total.line, gl.total[s].odds, gl.total[s === 'over' ? 'under' : 'over'].odds, gl.total[s].id);
  }
  return out;
}
/* the ruler's pool as kept ({rule: 'fair', legs: [[key, price, fair, other]], sets: [[places..., chance, price]], band,
   noId, vig, pl}): its legs, each game's kept groups, or null where it is not that shape. Every leg's fair chance is this
   file's own reading of its two prices, each priced with a margin and in the band; each group two legs or more of one
   game that go together, its chance at most its least likely leg's and its price at most its legs' prices multiplied */
function nightPoolRuler(P) {
  if (!isMap(P) || P.rule !== 'fair' || !Array.isArray(P.legs) || !Array.isArray(P.sets) || !isMap(P.pl)) return null;
  const legs = [];
  for (const x of P.legs) {
    if (!Array.isArray(x) || x.length !== 4 || typeof x[0] !== 'string' || !isFinite(x[1]) || !x[1] || !isFinite(x[3]) || !x[3] || !(x[2] > 0 && x[2] < 1)) return null;
    if (impOf(x[1]) + impOf(x[3]) < 1 || !(x[2] >= PL_BAND[0] && x[2] < PL_BAND[1])) return null;
    const f = x[0].split('|'), [gid, kind] = f;
    if (TEAM_KINDS.includes(kind)) {
      if (f.length !== 4 || Math.abs(x[2] - teamFair(x[1], x[3])) > 1e-9) return null;
      legs.push({ sk: x[0], gid, kind, side: kind !== 'total', tot: kind === 'total', pid: null, s: f[2], line: f[3] === '' ? null : +f[3], home: String(gid).split('_')[3], odds: x[1], other: x[3], p: x[2], d: decOf(x[1]) });
    } else if (kind === 'prop') {
      const [, , pid, stat, mk, line, sd] = f;
      if (f.length !== 7 || !pid || !PL_STATS.includes(stat) || mk !== 'main' || !['over', 'under'].includes(sd) || !isFinite(+line) || line === '') return null;
      if (Math.abs(x[2] - plFair(sd, x[1], x[3])) > 1e-9) return null;
      legs.push({ sk: x[0], gid, kind, side: false, tot: false, pid, stat, s: sd, line: +line, home: String(gid).split('_')[3], odds: x[1], other: x[3], p: x[2], d: decOf(x[1]) });
    } else return null;
  }
  if (new Set(legs.map(l => l.sk)).size !== legs.length) return null;
  const groups = new Map();
  for (const x of P.sets) {
    if (!Array.isArray(x) || x.length < 4) return null;
    const L = x.slice(0, -2).map(i => legs[i]), pj = x[x.length - 2], dj = x[x.length - 1];
    if (L.some(l => !l) || new Set(L).size !== L.length || L.some(l => l.gid !== L[0].gid)) return null;
    if (L.some((a, i) => L.some((b, k) => k > i && !fitsTwo(a, b)))) return null;
    if (!(pj > 0 && pj <= Math.min(...L.map(l => l.p)) + 1e-6) || !(dj > 1 && dj <= L.reduce((t, l) => t * l.d, 1) + 1e-6)) return null;
    groups.set(L.map(l => l.sk).sort().join('~'), { legs: L, p: pj, d: dj });
  }
  return { legs, groups, rule: 'fair' };
}
/* THIS FILE'S OWN UPPER BOUND on the likeliest parlay paying F of a set of legs (one leg a player, one side and one total a
   game, two legs or more), never ranking one: a dynamic programme over the night's games on a grid of log prices (cells of
   RB_W; every unit's log price rounded UP to its cell, every cell from ln F on one, so the programme admits every parlay
   that pays F and some that fall short by under a cell a unit, which only raises the bound), keeping in each cell and count
   of legs (none, one, two or more) the most chance any choice of the games so far lands at.
   First the legs alone (a game gives nothing or one leg, exactly: its fair chance and its price). A parlay holding two legs
   or more of a game returns at most HOLD on $1 (RB_SIG more, for the builder's GHK sum against the copula): such a group
   lands no oftener than its legs' implied joint chance J (each leg's fair chance is at most its implied chance, so its event
   lies inside its event at the implied thresholds) and is priced at most HOLD / J, and every other unit returns at most $1.
   So it lands at most HOLD / F, and where the legs alone already reach that (every night of three games or more at the
   default filters: a short Under returns $1) the bound is theirs. Otherwise a game also gives:
   - two legs that go together, exactly, by this file's own two-leg sums (pairOwn: the builder's own, line for line);
   - three legs or more, by the HOLD envelope above, and at most the s likeliest legs of the game together in the one-factor
     copula at the game's largest correlation (Slepian's inequality: those correlations are at least every pair's, and the
     orthant rises in each chance), s = 3 for groups of three, 4 for more;
   - where that envelope raises the bound by more than RB_TRY (a game or two, where a same-game group can be the answer),
     the game's triples that could reach the bound without them, worked out exactly by this file's own copula (ownFig: its
     chance and its price as the builder prices them, RB_SIG wider), each a unit of its own, the envelope then from four
     legs; a triple left out is one whose one-factor bound is under that bound, so no parlay holding it can raise it (a
     parlay's chance is at most each of its units'); a game whose table is not positive definite (the builder may shrink
     its groups' correlations) or with more than RB_TRIPLES such triples keeps the envelope from three legs.
   Every one of those is an upper bound, so the least of them is. No parlay's chance is ever over it. Its slack, against the
   page's levels on every real night's cut (research/sp_ruler): within 0.06% on whole nights, and up to 0.6% on a night of
   one game at $4, where the envelope stands over a game's many triples */
const RB_W = 2e-4, RB_SIG = 1e-3, RB_TRIPLES = 3000, RB_TRY = 2e-3;
/* the one-factor copula's chance that legs at chances ps all land, every pair correlated m (0 <= m < 1): Simpson's rule
   over the factor, 160 pieces on [-8, 8] */
function oneFactor(ps, m) {
  if (!(m > 0)) return ps.reduce((a, b) => a * b, 1);
  const t = ps.map(q => normInv(1 - q)), sm = Math.sqrt(m), sr = Math.sqrt(1 - m), N = 160, a = -8, h = 16 / N; let s = 0;
  for (let i = 0; i <= N; i++) { const z = a + i * h, w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; let f = Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI);
    for (const ti of t) f *= 1 - normCdf((ti - sm * z) / sr); s += w * f; }
  return Math.min(1, s * h / 3);
}
function rulerBound(legs, corr, F, info) {
  if (!(F > 1)) return null;
  const NC = Math.ceil(Math.log(F) / RB_W - 1e-9), H = corr.hold * (1 + RB_SIG), byG = new Map();
  for (const l of legs) { if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(l); }
  const cellOf = d => Math.min(NC, Math.max(0, Math.ceil(Math.log(d) / RB_W + 1e-9)));
  const frontier = pts => { const best = new Map(); for (const [j, c] of pts) if (!(best.get(j) >= c)) best.set(j, c);
    const fr = []; let mx = -1; for (const j of [...best.keys()].sort((a, b) => b - a)) { const c = best.get(j); if (c > mx) { fr.push([j, c]); mx = c; } } return fr; };
  const G = [...byG.values()].map(L => ({ L, one: frontier(L.map(l => [cellOf(l.d), l.p])), two: [], three: null, cap3: 0, cap4: 0 }));
  /* the programme over the games, each game's units as they stand */
  const run = () => {
    let A = [new Float64Array(NC + 1), new Float64Array(NC + 1), new Float64Array(NC + 1)]; A[0][0] = 1;
    const merge = (B, src, fr, k) => { for (let s = 0; s < 3; s++) { const a = src[s], to = B[Math.min(2, s + k)];
      for (let i = 0; i <= NC; i++) { const v = a[i]; if (!(v > 0)) continue; for (const [j, c] of fr) { const t = Math.min(NC, i + j), x = v * c; if (x > to[t]) to[t] = x; } } } };
    for (const g of G) {
      const B = A.map(a => Float64Array.from(a));
      merge(B, A, g.one, 1); if (g.two.length) merge(B, A, g.two, 2); if (g.three) merge(B, A, g.three, 3);
      const cap = g.three ? g.cap4 : g.cap3;
      if (cap > 0) {
        /* a group of the envelope in cell j (its price over e^((j-1)w)) lands at most min(cap, H e^-((j-1)w)): up to jc the
           cap binds, so jc alone matters there; past it H e^-((t-1)w) times the most of v_i e^(iw) over i <= t - jc - 1 */
        const jc = Math.max(1, Math.min(NC, Math.floor(Math.log(H / cap) / RB_W) + 1));
        for (let s = 0; s < 3; s++) { const a = A[s], to = B[2]; let run = 0;
          for (let i = 0; i <= NC; i++) { const v = a[i]; if (!(v > 0)) continue; const t = Math.min(NC, i + jc), x = v * cap; if (x > to[t]) to[t] = x; }
          for (let t = 0; t <= NC; t++) { const i = t - jc - 1; if (i >= 0 && a[i] > 0) run = Math.max(run, a[i] * Math.exp(i * RB_W));
            if (run > 0) { const x = H * Math.exp(-(t - 1) * RB_W) * run; if (x > to[t]) to[t] = x; } } }
      }
      A = B;
    }
    return A[2][NC];
  };
  const g1 = run(), roof = H / F;
  if (info) Object.assign(info, { one: g1, roof, stage: 1, triples: 0 });
  if (g1 >= roof) return g1;
  /* groups can matter: the pairs exactly, the envelope's caps */
  for (const g of G) {
    const L = g.L, pts = []; let m = 0;
    for (let i = 0; i < L.length; i++) for (let k = i + 1; k < L.length; k++) { const a = L[i], b = L[k]; if (!fitsTwo(a, b)) continue;
      const [x, y] = a.sk < b.sk ? [a, b] : [b, a], rho = CJ.rhoFor(corr.rho, clOf(x), clOf(y)) || 0; m = Math.max(m, Math.abs(rho));
      const J = CJ.joint2(impOf(x.odds), impOf(y.odds), rho), mult = x.d * y.d;
      pts.push([cellOf(J > 0 && isFinite(J) ? Math.min(mult, corr.hold / J) : mult), CJ.joint2(x.p, y.p, rho)]); }
    const ps = L.map(l => l.p).sort((a, b) => b - a); g.m = Math.min(0.999, m); g.two = frontier(pts);
    g.cap3 = ps.length >= 3 ? Math.min(H, oneFactor(ps.slice(0, 3), g.m) * (1 + RB_SIG)) : 0;
    g.cap4 = ps.length >= 4 ? Math.min(H, oneFactor(ps.slice(0, 4), g.m) * (1 + RB_SIG)) : 0;
  }
  const b0 = Math.min(roof, run());
  const keep = G.map(g => [g.cap3, g.cap4]); for (const g of G) { g.cap3 = 0; g.cap4 = 0; }
  const g2 = run(); G.forEach((g, i) => { g.cap3 = keep[i][0]; g.cap4 = keep[i][1]; });
  if (info) Object.assign(info, { stage: 2, env: b0, two: g2 });
  if (!(b0 > g2 * (1 + RB_TRY))) return b0;
  /* the triples that could raise it, counted on their one-factor bound first, then worked out exactly */
  let any = false;
  for (const g of G) {
    if (g.cap3 <= g2 || !gamePosDef(corr, g.L)) continue;
    const L = [...g.L].sort((a, b) => (b.p - a.p) || (a.sk < b.sk ? -1 : 1)), cand = []; let over = false;
    const ub = (a, b, c) => oneFactor([a.p, b.p, c.p], g.m) * (1 + RB_SIG);
    for (let i = 0; i + 2 < L.length && !over; i++) { if (ub(L[i], L[i + 1], L[i + 2]) <= g2) break;
      for (let k = i + 1; k + 1 < L.length && !over; k++) { if (!fitsTwo(L[i], L[k])) continue; if (ub(L[i], L[k], L[k + 1]) <= g2) break;
        for (let q = k + 1; q < L.length; q++) { const c = L[q]; if (ub(L[i], L[k], c) <= g2) break; if (!fitsTwo(L[i], c) || !fitsTwo(L[k], c)) continue;
          if (cand.length >= RB_TRIPLES) { over = true; break; } cand.push([L[i], L[k], c]); } } }
    if (over) continue;
    const out = []; let bad = false;
    for (const T of cand) { const f = ownFig(corr, T); if (!f) { bad = true; break; } out.push([cellOf(f.d * (1 + RB_SIG)), Math.min(1, f.p * (1 + RB_SIG))]); }
    if (bad) continue;
    g.three = frontier(out); any = true; if (info) info.triples += cand.length;
  }
  if (!any) return b0;
  const b = run();
  if (info) Object.assign(info, { stage: 3, exact: b });
  return Math.min(b0, b);
}
/* whether some parlay the rule takes pays F, by its legs alone and its pairs (a level empty where one does is refused):
   each game's dearest leg, or its dearest pair by the builder's two-leg sums, multiplied across the games */
function rulerPays(legs, corr, F) {
  const byG = new Map(); for (const l of legs) { if (!byG.has(l.gid)) byG.set(l.gid, []); byG.get(l.gid).push(l); }
  const opts = [];
  for (const L of byG.values()) {
    const one = Math.max(...L.map(l => l.d)), top = [...L].sort((a, b) => b.d - a.d).slice(0, 16); let two = 0;
    if (corr) for (let i = 0; i < top.length; i++) for (let k = i + 1; k < top.length; k++) if (fitsTwo(top[i], top[k])) two = Math.max(two, pairOwn(corr, top[i], top[k]).d);
    opts.push({ one, two });
  }
  /* singles across two games or more, or one game's pair with any singles of the rest */
  const ones = opts.map(o => o.one).sort((a, b) => b - a), all = ones.reduce((t, d) => t * d, 1);
  if (opts.length >= 2 && all >= F - 1e-9) return true;
  return opts.some((o, i) => o.two > 0 && o.two * opts.reduce((t, q, k) => k === i ? t : t * q.one, 1) >= F - 1e-9);
}
/* one ruler level held by property: its head, its legs (a valid parlay of the pool's legs at their kept figures), its
   chance and price (the pool's figures multiplied), its floor, and its chance against the bound (null: not held to one) */
function rulerLevelBad(key, x, lv, pool, ids, bound, tag, F0, legsAll, corr) {
  const bad = [], [id, label, lo, hi, F] = lv, w = tag ? ` (${tag})` : '';
  if (x.label !== label || x.min !== lo || x.max !== hi || x.price !== F || x.chance !== 'fair' || x.need !== undefined) bad.push(`${key} ${id}: not the ruler's own label, range, floor and chance (${label}, ${lo} legs or more, $${F}, at DraftKings' fair chance)`);
  if (x.nopl !== undefined) bad.push(`${key} ${id}: says why it holds no player leg (nopl ${x.nopl}), where the ruler asks none`);
  if (x.gap !== undefined) bad.push(`${key} ${id}: a level the search did not settle (gap ${x.gap}): the record takes none`);
  if (!Array.isArray(x.legs)) {
    if (typeof x.why !== 'string' || !x.why) bad.push(`${key} ${id}: neither legs nor why`);
    else if (legsAll && rulerPays(legsAll, corr, F)) bad.push(`${key} ${id}: empty, and the legs${w} make a parlay paying $${F} or more`);
    return bad;
  }
  const L = x.legs;
  if (L.length < lo) bad.push(`${key} ${id}: ${L.length} leg${L.length === 1 ? '' : 's'}, under its ${lo}`);
  if (L.some(l => !isMap(l) || !ids.has(l.id))) { bad.push(`${key} ${id}: a leg on no game of the night`); return bad; }
  if (L.some(l => !TEAM_KINDS.includes(l.kind) && l.kind !== 'prop')) { bad.push(`${key} ${id}: a leg that is neither a team leg nor a player's line`); return bad; }
  if (L.some(l => l.kind === 'prop' && (l.mk !== 'main' || !['over', 'under'].includes(l.side) || !PL_STATS.includes(l.stat) || !isFinite(l.odds) || !isFinite(l.other)))) { bad.push(`${key} ${id}: a player's leg that is not a main line, over or under, with both prices, on a stat the page offers`); return bad; }
  const ks = L.map(legKey);
  if (new Set(ks).size < ks.length) bad.push(`${key} ${id}: a leg twice`);
  const pids = L.filter(l => l.kind === 'prop').map(l => String(l.pid));
  if (new Set(pids).size < pids.length) bad.push(`${key} ${id}: two legs of one player`);
  const per = new Map(); for (const l of L) { if (l.kind === 'prop') continue; const g = per.get(l.id) || { side: 0, total: 0 }; g[l.kind === 'total' ? 'total' : 'side']++; per.set(l.id, g); }
  if ([...per.values()].some(g => g.side > 1 || g.total > 1)) bad.push(`${key} ${id}: two side bets or two totals of one game`);
  if (!(x.dec >= F - 1e-9)) bad.push(`${key} ${id}: pays ${x.dec} on $1, under its floor ${F}`);
  if (!pool) return bad;
  const at = new Map(pool.legs.map(l => [l.sk, l]));
  if (L.some(l => { const q = at.get(legKey(l)); return !q || q.odds !== l.odds || q.other !== l.other || Math.abs(q.p - l.p) > 5e-5 || Math.abs(q.p - l.fair) > 5e-5; })) { bad.push(`${key} ${id}: a leg not in its pool${w} at its own prices and fair chance`); return bad; }
  const byG = new Map(); for (const l of L) { if (!byG.has(l.id)) byG.set(l.id, []); byG.get(l.id).push(legKey(l)); }
  let pc = 1, dc = 1;
  for (const sk of byG.values()) {
    if (sk.length === 1) { const q = at.get(sk[0]); pc *= q.p; dc *= q.d; continue; }
    const g = pool.groups.get([...sk].sort().join('~'));
    if (!g) { bad.push(`${key} ${id}: a game's legs together not kept in its pool${w} with their figures`); return bad; }
    pc *= g.p; dc *= g.d;
  }
  if (Math.abs(pc - x.p) > 1e-4 || Math.abs(pc - (x.fair == null ? NaN : x.fair)) > 1e-4 || Math.abs(dc - x.dec) > 1e-3) bad.push(`${key} ${id}: its chance ${x.p}, fair chance ${x.fair} and price ${x.dec} are not its legs' as its pool${w} has them (${pc.toFixed(5)}, ${dc.toFixed(4)})`);
  if (!(dc >= F - 1e-6)) bad.push(`${key} ${id}: its legs pay ${dc.toFixed(4)} on $1 by its pool${w}, under its floor ${F}`);
  if (bound != null && !(pc >= (1 - TAU_G) * bound)) bad.push(`${key} ${id}: lands ${(pc * 100).toFixed(3)}%, under ${((1 - TAU_G) * 100).toFixed(0)}% of this file's own bound on the likeliest parlay paying $${F}${w} (${(bound * 100).toFixed(3)}%)`);
  return bad;
}
/* a ruler pool (P as kept, kept: its reading) held to this file's own reading of the run's files at an instant, and the legs
   and figures the bound is worked on there; tag names the pool in the words */
function rulerFull(key, P, kept, state, lines, games, at, tag) {
  const bad = [], w = tag ? ` (${tag})` : '', pl = plOwn(state, lines, games, at), tm = teamOwn(state, lines, games, at), c = P.pl;
  const corr = state && state.corr && isMap(state.corr.rho) && state.corr.hold > 0 ? state.corr : null;
  if (!corr) return { bad: [`${key}${w}: the run's state.json has no same-game table, so the guard cannot work its bound out`], legs: null, corr: null };
  for (const k of Object.keys(PL_COUNT_WORDS)) if (c[k] !== pl[k]) bad.push(`${key}${w}: its pool counts ${c[k]} player lines ${PL_COUNT_WORDS[k]}, where this file's own reading of the run's lines.json and state.json counts ${pl[k]}`);
  for (const k of Object.keys(TEAM_COUNT_WORDS)) if ((P[k] || 0) !== tm[k]) bad.push(`${key}${w}: its pool counts ${P[k] || 0} team legs ${TEAM_COUNT_WORDS[k]}, where this file's own reading counts ${tm[k]}`);
  const keptPl = kept.legs.filter(l => l.pid), keptTm = kept.legs.filter(l => !l.pid), plAt = new Map(pl.legs.map(l => [l.sk, l])), tmAt = new Map(tm.legs.map(l => [l.sk, l]));
  if (c.cut !== pl.legs.length - keptPl.length) bad.push(`${key}${w}: its pool says ${c.cut} player legs in the band were left out, where this file's own reading has ${pl.legs.length} in the band and the pool keeps ${keptPl.length}`);
  for (const l of keptPl) { const o = plAt.get(l.sk); if (!o || o.odds !== l.odds || o.other !== l.other || o.p !== l.p) bad.push(`${key}${w}: its pool keeps ${l.sk} at ${l.odds}, ${l.p}, which is no player leg of the run's lines.json by this file's own reading`); }
  for (const l of keptTm) { const o = tmAt.get(l.sk); if (!o || o.odds !== l.odds || o.other !== l.other || o.p !== l.p) bad.push(`${key}${w}: its pool keeps ${l.sk} at ${l.odds}, ${l.p}, which is no team leg of the run's lines.json by this file's own reading`); }
  for (const l of tm.legs) if (!kept.legs.some(k => k.sk === l.sk)) bad.push(`${key}${w}: its pool leaves out ${l.sk}, a team leg of the run's lines.json by this file's own reading`);
  /* the kept groups held to this file's own copula: two legs exactly (the builder's two-leg sums), more within OWN_TOL */
  for (const g of kept.groups.values()) {
    const f = g.legs.length === 2 ? pairOwn(corr, g.legs[0], g.legs[1]) : ownFig(corr, g.legs);
    if (!f) { bad.push(`${key}${w}: its pool keeps ${g.legs.map(l => l.sk).join(' with ')}, which this file's own copula cannot work out`); continue; }
    const tol = g.legs.length === 2 ? [1e-12, 1e-9] : [OWN_TOL * f.p, OWN_TOL * f.d];
    if (Math.abs(f.p - g.p) > tol[0] || Math.abs(f.d - g.d) > tol[1]) bad.push(`${key}${w}: its pool keeps ${g.legs.map(l => l.sk).join(' with ')} at ${g.p}, ${g.d}, where this file's own copula gives ${f.p}, ${f.d}`);
  }
  return { bad, legs: [...tm.legs, ...pl.legs], corr };
}
/* a ruler entry's pool and levels (its key, games, tip-offs and lock are held before, its replacements and grades after):
   the pool as kept; while its lock is to come, no player the report lists; a set the run took (new or changed since the
   file it is held to, its lock to come) held to this file's own reading of the run's files, each level by property against
   the bound worked there; otherwise each level against the bound on its pool as kept (where the run's state has the
   same-game table); a level built again after the lock against its own pool, and, built by this run, this file's own
   reading at the time it was built */
function rulerEntryBad(key, e, now, pe, state, lines, LV, ids) {
  const bad = [], t = s => Date.parse(s), pool = nightPoolRuler(e.pool);
  if (!pool) return [`${key}: its pool is not the ruler's (team legs and players' main lines, each [key, price, DraftKings' fair chance, the other side's price], priced with a margin and in the band, and each level's same-game groups)`];
  if (pool.legs.some(l => !ids.has(l.gid))) return [`${key}: its pool holds a leg of no game of the night`];
  if (nightNoLines(e)) bad.push(`${key}: taken with no DraftKings line posted for any game of the night (no set is taken until one is)`);
  const toLock = isFinite(t(e.tip)) && now < t(e.tip) - LOCK_MS, same = !!state && +state.season === +e.season;
  if (same && toLock) for (const l of pool.legs) if (l.pid) { const why = plHeld(state, l.gid, l.pid); if (why) { bad.push(`${key}: its pool holds ${l.sk}, a player ${why}`); break; } }
  const corr = state && state.corr && isMap(state.corr.rho) && state.corr.hold > 0 ? state.corr : null;
  const own = !!(same && lines && toLock && (!pe || canon(callOf(e)) !== canon(callOf(pe))));
  let legsAll = null;
  if (own) {
    if (e.generated !== state.generated) bad.push(`${key}: taken at ${e.taken_at} on a state.json of ${e.generated}, not the run's (${state.generated})`);
    const R = rulerFull(key, e.pool, pool, state, lines, e.games, t(e.taken_at), null); bad.push(...R.bad); legsAll = R.legs;
  }
  const B = new Map(), boundOf = (legs, F) => { if (!legs || !corr) return null; const k = F; if (!B.has(k)) B.set(k, rulerBound(legs, corr, F)); return B.get(k); };
  e.tiers.forEach((x, i) => {
    const lv = LV[i]; if (!isMap(x) || !lv || x.id !== lv[0]) return;
    if (x.updated != null) {
      const op = nightPoolRuler(x.pool);
      if (!op) { bad.push(`${key} ${x.id}: built again with no ruler pool of its own`); return; }
      if (op.legs.some(l => l.pid && String(l.pid) === String(x.updated.pid))) bad.push(`${key} ${x.id}: built again for ${x.updated.pid}, and its pool still holds him`);
      if (op.legs.some(l => !ids.has(l.gid))) bad.push(`${key} ${x.id}: its own pool holds a leg of no game of the night`);
      const pt = pe && Array.isArray(pe.tiers) ? pe.tiers[i] : null;
      let legs = op.legs;
      if (same && lines && isFinite(t(e.tip)) && now < t(e.tip) && isFinite(t(x.updated.at)) && (!pt || canon(pt) !== canon(x))) {
        const R = rulerFull(`${key} ${x.id}`, x.pool, op, state, lines, e.games, t(x.updated.at), 'its own'); bad.push(...R.bad); if (R.legs) legs = R.legs; }
      bad.push(...rulerLevelBad(key, x, lv, op, ids, corr ? rulerBound(legs, corr, lv[4]) : null, 'its own', null, legs, corr));
      return;
    }
    if (x.pool != null) bad.push(`${key} ${x.id}: a pool of its own, never built again`);
    const legs = legsAll || pool.legs;
    bad.push(...rulerLevelBad(key, x, lv, pool, ids, boundOf(legs, lv[4]), own ? 'this file\'s own reading of the run\'s files' : 'its pool as kept', null, legs, corr));
  });
  return bad;
}
/* the night entries prev had locked (their lock passed by now) that L has lost or changed beyond a grade and the levels
   a player listed since let a run replace (between the lock and the first tip-off, recorded in updates, which only
   grows). runAt: the replacements new since prev are that run's (null: unknown); state: the state.json of the run that
   made them, where known (each run commits, so what is new since the last commit is that run's): each such replacement
   for a player it lists (the page's own rule, plListed), and the level built again holding, in its own pool, no player it
   holds out or the props model does not place (plHeld) */
function nightMoved(L, prev, now, runAt, state) {
  const bad = [], N = (L && L.night) || {};
  for (const [key, pe] of Object.entries((prev && prev.night) || {})) {
    if (!isMap(pe) || !(lockOf(pe) <= now)) continue;
    const e = N[key], at = minIso(lockOf(pe));
    if (!e) { bad.push(`${key}: a night set locked at ${at} is gone`); continue; }
    const strip = x => { const { grade, tiers, updates, ...c } = x || {}; return c; };
    const moved = diffKeys(strip(e), strip(pe));
    if (moved.length) { bad.push(`${key}: a night set locked at ${at}, and changed (${moved.join(', ')})`); continue; }
    const pu = Array.isArray(pe.updates) ? pe.updates : [], u = Array.isArray(e.updates) ? e.updates : [];
    if ((e.updates != null) !== (pe.updates != null) && !(pe.updates == null && u.length)) { bad.push(`${key}: a night set locked at ${at}, and its record of replacements changed`); continue; }
    if (u.length < pu.length || canon(u.slice(0, pu.length)) !== canon(pu)) { bad.push(`${key}: a night set locked at ${at}, and its record of replacements rewritten`); continue; }
    const fresh = u.slice(pu.length), T = e.tiers || [], PT = pe.tiers || [];
    if (!Array.isArray(e.tiers) || T.length !== PT.length || T.some((x, i) => !x || !PT[i] || x.id !== PT[i].id)) { bad.push(`${key}: a night set locked at ${at}, and its levels changed`); continue; }
    if (fresh.length && !isMap(pe.pool.pl)) { bad.push(`${key}: a night set of team legs alone, locked at ${at}, and a level replaced`); continue; }
    if (runAt != null && fresh.some(x => !x || x.at !== runAt)) bad.push(`${key}: locked at ${at}, and a replacement recorded that is not this run's`);
    T.forEach((x, i) => {
      const mine = fresh.filter(y => y && y.tier === x.id), same = canon(x) === canon(PT[i]);
      if (same) { if (mine.length) bad.push(`${key} ${x.id}: a replacement recorded for a level that did not change`); return; }
      if (!mine.length) { bad.push(`${key}: a night set locked at ${at}, and changed (tiers): ${x.id} with no player listed since the lock`); return; }
      if (runAt != null && mine.length > 1) bad.push(`${key} ${x.id}: replaced more than once by one run`);
      if (!holds(PT[i], mine[0].pid)) { bad.push(`${key} ${x.id}: replaced for ${mine[0].pid}, who was not on the level as it was`); return; }
      if (state && +state.season === +e.season) {
        for (const u of mine) { const l = PT[i].legs.find(y => y && y.kind === 'prop' && y.pid === u.pid);
          if (l && !plListed(state, l.id, u.pid)) bad.push(`${key} ${x.id}: replaced for ${u.pid} (${u.reason || 'no reason'}), whom the run's state.json does not list`); }
        const op = isMap(x.pool) && x.pool.rule === 'fair' ? nightPoolRuler(x.pool) : nightPool(e, x.pool);
        if (op) for (const l of op.legs) if (l.pid) { const why = plHeld(state, l.gid, l.pid); if (why) { bad.push(`${key} ${x.id}: built again on a pool holding ${l.sk}, a player ${why}`); break; } }
      }
    });
  }
  return bad;
}
const diffKeys = (a, b) => [...new Set([...Object.keys(a || {}), ...Object.keys(b || {})])].filter(k => canon((a || {})[k]) !== canon((b || {})[k]));
const lockOf = e => Date.parse(e && e.tip) - LOCK_MS;
/* the entries prev had locked (their lock passed by now) that L has lost or changed beyond a grade and the levels a
   player listed since let a run replace. runAt: the replacements new since prev are that run's (null: unknown, as
   against the last commit, which an earlier run's replacement not yet committed may also have moved past) */
function lockedMoved(L, prev, now, runAt) {
  const bad = [], F = (L && L.featured) || {};
  for (const [key, pe] of Object.entries((prev && prev.featured) || {})) {
    if (!isMap(pe) || !(lockOf(pe) <= now)) continue;
    const e = F[key], at = minIso(lockOf(pe));
    if (!e) { bad.push(`${key}: a set locked at ${at} is gone`); continue; }
    const strip = x => { const { grade, tiers, updates, ...c } = x || {}; return c; };
    const moved = diffKeys(strip(e), strip(pe));
    if (moved.length) { bad.push(`${key}: locked at ${at}, and changed (${moved.join(', ')})`); continue; }
    const pu = Array.isArray(pe.updates) ? pe.updates : [], u = Array.isArray(e.updates) ? e.updates : [];
    if (u.length < pu.length || canon(u.slice(0, pu.length)) !== canon(pu)) { bad.push(`${key}: locked at ${at}, and its record of replacements rewritten`); continue; }
    const fresh = u.slice(pu.length), T = e.tiers || [], PT = pe.tiers || [];
    if (!Array.isArray(e.tiers) || T.length !== PT.length || T.some((t, i) => !t || !PT[i] || t.id !== PT[i].id)) { bad.push(`${key}: locked at ${at}, and its levels changed`); continue; }
    if (runAt != null && fresh.some(x => !x || x.at !== runAt)) bad.push(`${key}: locked at ${at}, and a replacement recorded that is not this run's`);
    T.forEach((t, i) => {
      const mine = fresh.filter(x => x && x.tier === t.id), same = canon(t) === canon(PT[i]);
      if (same) { if (mine.length) bad.push(`${key} ${t.id}: a replacement recorded for a level that did not change`); return; }
      if (!mine.length) { bad.push(`${key} ${t.id}: locked at ${at}, and changed with no player listed`); return; }
      if (runAt != null && mine.length > 1) bad.push(`${key} ${t.id}: replaced more than once by one run`);
      if (!holds(PT[i], mine[0].pid)) bad.push(`${key} ${t.id}: replaced for ${mine[0].pid}, who was not on the level as it was locked`);
    });
  }
  return bad;
}
/* the whole file. prev: the file the run started from (or the last commit's); runAt: the run's own time, when known;
   season: the season in play (an entry of another one is never graded anew); state and lines: the run's state.json and
   lines.json, where known (THE GUARD'S OWN READING, and who is held out now) */
function check(L, prev, now, runAt, season, state, lines) {
  const bad = [], F = (L && L.featured) || {};
  if (!isMap(L) || !isMap(L.featured)) return ['the ledger has no featured map'];
  const PF = prev && isMap(prev.featured) ? prev.featured : {};
  for (const [key, e] of Object.entries(F)) bad.push(...entryBad(key, e, now, PF[key]));
  if (prev && isMap(prev.featured)) {
    bad.push(...lockedMoved(L, prev, now, runAt));
    for (const [key, e] of Object.entries(F)) {
      const pe = prev.featured[key];
      if (pe && lockOf(pe) <= now) {   /* a locked set: lockedMoved's rules, and another season's grade stands */
        if (season != null && +e.season !== +season && canon(e.grade) !== canon(pe.grade)) bad.push(`${key}: an entry of the ${e.season} season graded anew in ${season}`);
        continue; }
      if (pe && canon(callOf(e)) === canon(callOf(pe))) continue;
      if (runAt != null && (e.taken_at !== runAt || !(now < lockOf(e)))) bad.push(`${key}: new or changed, and not taken by this run before its lock`);
    }
  }
  if (canon(L.featured_summary) !== canon(summarize(F))) bad.push('the summary does not follow from the entries');
  /* the night map: absent only from a file written before 7 November 2026, so required wherever the file it is held to
     has one (a ledger that drops it, and its summary, must never pass every night rule by having none) */
  const prevNight = !!(prev && isMap(prev.night));
  if ('night' in L || 'night_summary' in L || prevNight) {
    const N = isMap(L.night) ? L.night : null;
    if (!N) return [...bad, !('night' in L) ? 'the ledger\'s night map is gone, where the file it is held to has one' : 'the ledger\'s night map is not a map'];
    const PN0 = prev && isMap(prev.night) ? prev.night : {};
    for (const [key, e] of Object.entries(N)) bad.push(...nightEntryBad(key, e, now, PN0[key], state, lines));
    /* a night once locked stays locked: no second set of a night taken at or after another set of it locked (a first
       tip-off ESPN moved later after the lock makes a new key, which the job never takes) */
    const byNight = new Map();
    for (const [key, e] of Object.entries(N)) if (isMap(e) && e.nid) { const k = `${e.season}|${e.nid}`; if (!byNight.has(k)) byNight.set(k, []); byNight.get(k).push([key, e]); }
    for (const list of byNight.values()) for (const [ka, a] of list) for (const [kb, b] of list)
      if (ka !== kb && isFinite(lockOf(a)) && Date.parse(b.taken_at) >= lockOf(a)) bad.push(`${kb}: a second set of ${b.nid}, taken at ${b.taken_at}, at or after its night locked at ${minIso(lockOf(a))} (${ka})`);
    const PN = prev && isMap(prev.night) ? prev.night : null;
    if (prev) {
      bad.push(...nightMoved(L, prev, now, runAt, state));
      for (const [key, e] of Object.entries(N)) {
        const pe = PN ? PN[key] : null;
        if (pe && lockOf(pe) <= now) { if (season != null && +e.season !== +season && canon(e.grade) !== canon(pe.grade)) bad.push(`${key}: a night of the ${e.season} season graded anew in ${season}`); continue; }
        if (pe && canon(callOf(e)) === canon(callOf(pe))) continue;
        if (runAt != null && (e.taken_at !== runAt || !(now < lockOf(e)))) bad.push(`${key}: new or changed, and not taken by this run before its lock`);
      }
    }
    if (canon(L.night_summary) !== canon(summarizeNight(N))) bad.push('the night summary does not follow from the night entries');
  }
  return bad;
}

function main() {
  const args = process.argv.slice(2), opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
  const file = process.env.SUGGEST_LEDGER || path.join(ROOT, LEDGER_REL);
  const nowArg = opt('--now') || process.env.SUGGEST_NOW, now = nowArg ? Date.parse(nowArg) : Date.now();
  if (!isFinite(now)) { console.log('suggest check: the clock is not a time: ' + nowArg); return 1; }
  if (!fs.existsSync(file)) { console.log('suggest check: no ledger yet, 0 failures'); return 0; }
  let L; try { L = JSON.parse(fs.readFileSync(file, 'utf8')); } catch (e) { console.log('suggest check: the ledger is not JSON'); return 1; }
  let prev = null;
  if (!args.includes('--no-prev')) {
    const t = opt('--prev') ? (fs.existsSync(opt('--prev')) ? fs.readFileSync(opt('--prev'), 'utf8') : null)
      : (() => { const r = cp.spawnSync('git', ['show', 'HEAD:' + LEDGER_REL], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 }); return r.status === 0 && r.stdout.trim() ? r.stdout : null; })();
    try { prev = t ? JSON.parse(t) : null; } catch (e) { prev = null; }
  }
  let season = null, state = null;
  try { state = JSON.parse(fs.readFileSync(process.env.SUGGEST_STATE || path.join(ROOT, 'state.json'), 'utf8')); season = state.season; } catch (e) { season = null; state = null; }
  /* the lines.json the run read (SUGGEST_LINES, else the checkout's: the job runs this right after the script, on the
     same files), for THE GUARD'S OWN READING of the sets new since the last commit */
  let lines = null;
  try { lines = JSON.parse(fs.readFileSync(process.env.SUGGEST_LINES || path.join(ROOT, 'lines.json'), 'utf8')); } catch (e) { lines = null; }
  const bad = check(L, prev, now, null, season, state, lines);
  if (bad.length) { for (const b of bad.slice(0, 60)) console.log('FAIL ' + b); console.log(`suggest check: ${bad.length} failure${bad.length === 1 ? '' : 's'}`); return 1; }
  const s = L.featured_summary || summarize(L.featured), q = L.night_summary || summarizeNight(L.night || {});
  console.log(`suggest check: 0 failures (${q.entries} night set${q.entries === 1 ? '' : 's'}, ${q.graded_entries} graded; ${s.entries} featured set${s.entries === 1 ? '' : 's'} from before, ${s.graded_entries} graded, ${s.updates} replacement${s.updates === 1 ? '' : 's'}${prev ? '; every locked set as the last commit had it' : '; no last commit to hold it to'})`);
  return 0;
}
module.exports = { ownGroups, ownFig, check, entryBad, lockedMoved, gradeBad, summarize, summarizeNight, dumps, canon, callOf, keyOf, nightKeyOf, nightIdOf, nightEntryBad, nightLevelBad, nightMoved, nightPool, nightBest, nightBetter, nightNoLines, nightHeld, featuredOf, etDateOf, minIso, plFair, plHeld, plListed, plOwn, pairOwn, nightFull, gamePosDef, legKey,
  PL_FROM, PL_STATS, PL_BAND, NOCAP_FROM, NIGHT_LEVELS_OLD, nightRule, oldOk, PLAYER_FROM, NIGHT_LEVELS_NOCAP, nocapOk, noPlOf, NOPL,
  TIERS, OLD_TIERS, THREE_FROM, LABELS, LEGS, LOCK_MS, FEATURED_TV, NIGHT_LEVELS, NIGHT_IDS, NIGHT_TIE, HOW, LEDGER_REL,
  RULER_FROM, RULER_FROM_SET, NIGHT_LEVELS_RULER, TAU_G, RB_W, RB_SIG, oneFactor, rulerOk, rulerLateOk, teamFair, teamOwn, glOwn, nightPoolRuler, rulerBound, rulerPays, rulerLevelBad, rulerFull, rulerEntryBad, nightUpdatesBad };
if (require.main === module) process.exit(main());
