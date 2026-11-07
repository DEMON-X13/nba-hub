/* The suggestions record's guard (README "Suggested Parlays"): data/suggest_ledger.json held to its rules, worked out
 * here on their own from the file, the clock and the last commit's file, never from the page.
 *
 * Two maps. `night` is the record since the owner's call of 7 November 2026: one set a night across every game of the
 * night, its three levels each the likeliest parlay the night's team legs make by its own rule (NIGHT_LEVELS below:
 * Safe 2 legs, Medium 2 to 5 paying $4 or more on $1, Aggressive 2 to 5 paying $8 or more), and it fails when:
 *   - an entry lacks its night, games, tip-off, lock, levels, pool or time taken; is not keyed season|date|first
 *     tip|<season>_<date>_NIGHT on its own fields; a game of it is preseason, of another season, date or clubs than its
 *     id, or tips off on another Eastern date (Intl) than the night's; its tip-off is not its games' first, or its last
 *     not their last; its lock is not exactly 2 hours before its first tip-off; it was taken at or after its lock;
 *   - its levels are not the three in order with their sizes and floors; a level holds a leg of no game of the night, a
 *     player's leg, a leg twice, two side bets or two totals of one game, a count of legs outside its range, a leg not
 *     in the entry's pool at its own price and chance, a price under its floor, or a chance or price that is not its
 *     legs' as the pool has them; or, worked out here on the pool by its own enumeration of every parlay the level's
 *     rule takes (one side and one total a game, the pool's chance and price of each leg and of each game's two legs
 *     together, multiplied across games, the pool kept whole), a parlay the rule ranks above it (likelier, then dearer,
 *     then fewer legs, then the legs' ids; two within NIGHT_TIE, the page's own tolerance, are level), or a level empty
 *     where a parlay meets its rule; its pool holds no leg and none left out by a rule (taken before DraftKings had
 *     posted any line of the night: the job takes no such set);
 *   - a grade is on it before its first tip-off, or does not follow its legs (as below);
 *   - a second set of one night is taken at or after another set of it locked (a night once locked stays locked, though
 *     ESPN moves its first tip-off later);
 *   - against the file the run started from (or the last commit's): an entry whose lock had passed is gone or changed in
 *     anything but its grade (a night set is never built again after its lock: it holds team legs alone, which no
 *     report moves); the night map itself gone where that file has one; with the run's time known, a new or changed
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
 *     paying over 1, and exactly its price when every leg won);
 *   - against the file the run started from (or, by the command line, the last commit's): an entry whose lock had passed
 *     is gone or changed in anything but its grade and its replaced levels; its record of replacements rewritten; its
 *     levels changed; a level changed with no replacement recorded, or replaced for a player it did not hold; a
 *     replacement recorded for a level that did not change; with the run's time known, a replacement or a new or changed
 *     entry that is not that run's, or an entry taken at or after its lock; and an entry of another season than the
 *     season in play graded anew;
 *   - the summary does not follow from the entries.
 * SUGGEST_LEDGER names another ledger, SUGGEST_NOW another clock, SUGGEST_STATE another state.json (its season). Ends
 * "suggest check: 0 failures" (exit 0) or lists each failure (exit 1).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
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
   legs, the most, the least decimal price]; the job refuses a page whose levels are not these */
const NIGHT_LEVELS = [['safe', 'Safe', 2, 2, 0], ['med', 'Medium', 2, 5, 4], ['aggr', 'Aggressive', 2, 5, 8]];
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
const nightNoLines = e => !!e && isMap(e.pool) && Array.isArray(e.pool.legs) && !e.pool.legs.length && !e.pool.band && !e.pool.far && !e.pool.noId;
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
  + 'Eastern date with a game to tip, never preseason), its team legs alone (moneyline, spread, total, at DraftKings\' prices in '
  + 'lines.json and the builder\'s chance, 45% to 97%, none far off DraftKings, no value bar), one side and one total a game: Safe the '
  + 'likeliest 2-leg parlay, Medium the likeliest of 2 to 5 legs paying $4 or more on $1, Aggressive the likeliest of 2 to 5 paying $8 '
  + 'or more, by the builder\'s own sums; keyed season|date|first tip|<season>_<date>_NIGHT, its pool kept beside it (each leg\'s key, '
  + 'price and chance, each game\'s two legs\' joint chance and price) so the check works every level out again, rewritten while '
  + 'the night\'s lock (2 hours before its first tip-off) is to come and locked from it (held so though its first tip-off moves later; '
  + 'no set is taken of a night DraftKings has posted no line for), graded leg by leg as its games finish. '
  + 'night_summary: per level, as below, from the night map alone. featured (until 7 November 2026): each '
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
/* ---- THE NIGHT: an entry on its own, and its levels worked out again on its pool ---- */
const legKey = l => [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
const decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
/* the pool as kept: its legs, game by game, each game's options (a leg alone, or its side and total together, at the
   pool's own joint chance and price), or null where it is not the pool's shape */
function nightPool(e) {
  const P = e && e.pool; if (!isMap(P) || !Array.isArray(P.legs) || !Array.isArray(P.pairs)) return null;
  const legs = [];
  for (const x of P.legs) {
    if (!Array.isArray(x) || x.length !== 3 || typeof x[0] !== 'string' || !isFinite(x[1]) || x[1] === 0 || !(x[2] > 0 && x[2] < 1)) return null;
    const [gid, kind, side, line] = x[0].split('|');
    if (!TEAM_KINDS.includes(kind)) return null;
    legs.push({ sk: x[0], gid, kind, side, line, odds: x[1], p: x[2], d: decOf(x[1]) });
  }
  if (new Set(legs.map(l => l.sk)).size !== legs.length) return null;
  const games = new Map();
  for (const l of legs) { if (!games.has(l.gid)) games.set(l.gid, []); games.get(l.gid).push({ legs: [l], p: l.p, d: l.d }); }
  for (const x of P.pairs) {
    if (!Array.isArray(x) || x.length !== 4) return null;
    const a = legs[x[0]], b = legs[x[1]];
    if (!a || !b || a.gid !== b.gid || (a.kind === 'total') === (b.kind === 'total') || !(x[2] > 0 && x[2] <= Math.min(a.p, b.p) + 1e-6) || !(x[3] > 1 && x[3] <= a.d * b.d + 1e-6)) return null;
    games.get(a.gid).push({ legs: [a, b], p: x[2], d: x[3] });
  }
  return { legs, games: [...games.values()] };
}
/* every parlay of the pool the level's rule takes, the best by the rule: likelier, then dearer, then fewer legs, then the
   legs' ids; each game gives nothing or one of its options. Walked game by game, a branch let go once its chance is
   under the best's (a parlay's chance is the product of its games' own, each at most 1) */
/* c ranks above b by a level's rule: likelier, then dearer, then fewer legs, then the legs' ids */
const nightBetter = (c, b) => !b || c.p > b.p + NIGHT_TIE || (Math.abs(c.p - b.p) <= NIGHT_TIE && (c.d > b.d + NIGHT_TIE || (Math.abs(c.d - b.d) <= NIGHT_TIE && (c.n < b.n || (c.n === b.n && c.ids < b.ids)))));
function nightBest(pool, [, , lo, hi, F]) {
  let best = null; const chosen = [], better = nightBetter;
  (function walk(i, p, d, n) {
    if (best && p < best.p - NIGHT_TIE) return;
    if (n >= lo && d >= F - 1e-9) { const ids = chosen.flatMap(o => o.legs.map(l => l.sk)).sort().join(','), c = { p, d, n, ids };
      if (better(c, best)) best = c; }
    if (i === pool.games.length || n === hi) return;
    walk(i + 1, p, d, n);
    for (const o of pool.games[i]) if (n + o.legs.length <= hi) { chosen.push(o); walk(i + 1, p * o.p, d * o.d, n + o.legs.length); chosen.pop(); }
  })(0, 1, 1, 0);
  return best;
}
function nightEntryBad(key, e, now) {
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
  const pool = nightPool(e);
  if (!pool) bad.push(`${key}: its pool is not a pool of team legs, with each game's side and total together`);
  else if (pool.legs.some(l => !ids.has(l.gid))) bad.push(`${key}: its pool holds a leg of no game of the night`);
  else if (nightNoLines(e)) bad.push(`${key}: taken with no DraftKings line posted for any game of the night (no set is taken until one is)`);
  e.tiers.forEach((x, i) => {
    const lv = NIGHT_LEVELS[i]; if (!isMap(x) || !lv || x.id !== lv[0]) return;
    const [id, label, lo, hi, F] = lv;
    if (x.label !== label || x.min !== lo || x.max !== hi || x.price !== F) bad.push(`${key} ${id}: not the level's own label, range and floor (${label}, ${lo} to ${hi} legs, ${F || 'no floor'})`);
    if (!Array.isArray(x.legs)) {
      if (typeof x.why !== 'string' || !x.why) bad.push(`${key} ${id}: neither legs nor why`);
      else if (pool) { const b = nightBest(pool, lv); if (b) bad.push(`${key} ${id}: empty, and the pool makes a parlay its rule takes (${b.ids}, ${(b.p * 100).toFixed(2)}%, ${b.d.toFixed(3)})`); }
      return;
    }
    const L = x.legs;
    if (L.length < lo || L.length > hi) bad.push(`${key} ${id}: ${L.length} legs, outside its ${lo} to ${hi}`);
    if (L.some(l => !isMap(l) || !ids.has(l.id))) { bad.push(`${key} ${id}: a leg on no game of the night`); return; }
    if (L.some(l => !TEAM_KINDS.includes(l.kind))) { bad.push(`${key} ${id}: a player's leg (the night set takes team legs alone)`); return; }
    const ks = L.map(legKey);
    if (new Set(ks).size < ks.length) bad.push(`${key} ${id}: a leg twice`);
    const per = new Map(); for (const l of L) { const g = per.get(l.id) || { side: 0, total: 0 }; g[l.kind === 'total' ? 'total' : 'side']++; per.set(l.id, g); }
    if ([...per.values()].some(g => g.side > 1 || g.total > 1)) bad.push(`${key} ${id}: two side bets or two totals of one game`);
    if (!(x.dec >= F - 1e-9)) bad.push(`${key} ${id}: pays ${x.dec} on $1, under its floor ${F}`);
    if (!pool) return;
    /* the level's own chance and price as the pool has them: each game's legs alone or together */
    const byG = new Map(); for (const l of L) { if (!byG.has(l.id)) byG.set(l.id, []); byG.get(l.id).push(legKey(l)); }
    let pc = 1, dc = 1, inPool = true;
    for (const [gid, sk] of byG) {
      const opt = (pool.games.find(gg => gg[0].legs[0].gid === gid) || []).find(o => o.legs.length === sk.length && o.legs.every(l => sk.includes(l.sk)));
      if (!opt) { inPool = false; break; }
      pc *= opt.p; dc *= opt.d;
    }
    const at = new Map(pool.legs.map(l => [l.sk, l]));
    if (!inPool || L.some(l => { const q = at.get(legKey(l)); return !q || q.odds !== l.odds || Math.abs(q.p - l.p) > 5e-5; })) { bad.push(`${key} ${id}: a leg, or a game's two legs, not in its pool at its own price and chance`); return; }
    if (Math.abs(pc - x.p) > 1e-4 || Math.abs(dc - x.dec) > 1e-3) bad.push(`${key} ${id}: its chance ${x.p} and price ${x.dec} are not its legs' as its pool has them (${pc.toFixed(5)}, ${dc.toFixed(4)})`);
    if (!(dc >= F - 1e-6)) bad.push(`${key} ${id}: its legs pay ${dc.toFixed(4)} on $1 by its pool, under its floor ${F}`);
    const b = nightBest(pool, lv), mine = ks.slice().sort().join(',');
    if (b && b.ids !== mine && nightBetter(b, { p: pc, d: dc, n: L.length, ids: mine }))
      bad.push(`${key} ${id}: not the likeliest its rule takes: ${b.ids} (${(b.p * 100).toFixed(3)}%, ${b.d.toFixed(3)}) over its ${mine} (${(pc * 100).toFixed(3)}%, ${dc.toFixed(3)})`);
  });
  if (e.grade && !(t(e.tip) <= now)) bad.push(`${key}: graded before its first tip-off`);
  bad.push(...gradeBad(key, e));
  return bad;
}
/* the night entries prev had locked (their lock passed by now) that L has lost or changed in anything but a grade */
function nightMoved(L, prev, now) {
  const bad = [], N = (L && L.night) || {};
  for (const [key, pe] of Object.entries((prev && prev.night) || {})) {
    if (!isMap(pe) || !(lockOf(pe) <= now)) continue;
    const e = N[key], at = minIso(lockOf(pe));
    if (!e) { bad.push(`${key}: a night set locked at ${at} is gone`); continue; }
    if (canon(callOf(e)) !== canon(callOf(pe))) bad.push(`${key}: a night set locked at ${at}, and changed (${diffKeys(callOf(e), callOf(pe)).join(', ')})`);
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
   season: the season in play (an entry of another one is never graded anew) */
function check(L, prev, now, runAt, season) {
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
    for (const [key, e] of Object.entries(N)) bad.push(...nightEntryBad(key, e, now));
    /* a night once locked stays locked: no second set of a night taken at or after another set of it locked (a first
       tip-off ESPN moved later after the lock makes a new key, which the job never takes) */
    const byNight = new Map();
    for (const [key, e] of Object.entries(N)) if (isMap(e) && e.nid) { const k = `${e.season}|${e.nid}`; if (!byNight.has(k)) byNight.set(k, []); byNight.get(k).push([key, e]); }
    for (const list of byNight.values()) for (const [ka, a] of list) for (const [kb, b] of list)
      if (ka !== kb && isFinite(lockOf(a)) && Date.parse(b.taken_at) >= lockOf(a)) bad.push(`${kb}: a second set of ${b.nid}, taken at ${b.taken_at}, at or after its night locked at ${minIso(lockOf(a))} (${ka})`);
    const PN = prev && isMap(prev.night) ? prev.night : null;
    if (prev) {
      bad.push(...nightMoved(L, prev, now));
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
  let season = null;
  try { season = JSON.parse(fs.readFileSync(process.env.SUGGEST_STATE || path.join(ROOT, 'state.json'), 'utf8')).season; } catch (e) { season = null; }
  const bad = check(L, prev, now, null, season);
  if (bad.length) { for (const b of bad.slice(0, 60)) console.log('FAIL ' + b); console.log(`suggest check: ${bad.length} failure${bad.length === 1 ? '' : 's'}`); return 1; }
  const s = L.featured_summary || summarize(L.featured), q = L.night_summary || summarizeNight(L.night || {});
  console.log(`suggest check: 0 failures (${q.entries} night set${q.entries === 1 ? '' : 's'}, ${q.graded_entries} graded; ${s.entries} featured set${s.entries === 1 ? '' : 's'} from before, ${s.graded_entries} graded, ${s.updates} replacement${s.updates === 1 ? '' : 's'}${prev ? '; every locked set as the last commit had it' : '; no last commit to hold it to'})`);
  return 0;
}
module.exports = { check, entryBad, lockedMoved, gradeBad, summarize, summarizeNight, dumps, canon, callOf, keyOf, nightKeyOf, nightIdOf, nightEntryBad, nightMoved, nightPool, nightBest, nightBetter, nightNoLines, nightHeld, featuredOf, etDateOf, minIso,
  TIERS, OLD_TIERS, THREE_FROM, LABELS, LEGS, LOCK_MS, FEATURED_TV, NIGHT_LEVELS, NIGHT_IDS, NIGHT_TIE, HOW, LEDGER_REL };
if (require.main === module) process.exit(main());
