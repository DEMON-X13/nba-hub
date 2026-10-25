/* The suggestions record's guard (README "Suggested Parlays"): data/suggest_ledger.json held to its rules, worked out
 * here on their own from the file, the clock and the last commit's file, never from the page.
 *
 *   node tools/suggest_check.js [--prev FILE | --no-prev] [--now ISO]
 *
 * The job runs it right after tools/suggest_ledger.js, which runs the same check() before it writes; a failure fails
 * that step, which puts the ledger back as the last commit had it, and the record never holds back state.json or the
 * data. It fails when:
 *   - an entry lacks its game, tip-off, lock, networks, levels or time taken; is not keyed season|date|tip|game id on its
 *     own fields; its game id is not of its season, Eastern date and clubs; its date is not its tip-off's Eastern date (the
 *     time zone database, Intl); it is not a featured game by its own stored networks and type (on national TV, never a
 *     preseason game: FEATURED_TV below, this file's own copy of the page's); its lock is not exactly 2 hours before its
 *     tip-off; it was taken at or after its lock; its levels are not the four (Safe 2 legs, Medium 3, Aggressive 4,
 *     Extreme 5) in order; a level holds a leg of another game, a count of legs not its own, a player twice, two side bets
 *     or two totals;
 *   - a replacement (updates) names no level, player or time, or was made outside its lock to tip-off or after the clock;
 *     a level's mark (updated) is not the last replacement recorded for it, or the level still holds the player;
 *   - a grade is on an entry before its tip-off, or does not follow its legs (a leg lost loses and pays 0; every leg a push
 *     or void is a push and pays 1; otherwise won, paying over 1, and exactly its price when every leg won);
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
/* the levels (the page's PB_TIERS: a page with others is refused by the job), and each one's legs */
const TIERS = ['safe', 'med', 'aggr', 'xtrm'], LABELS = { safe: 'Safe', med: 'Medium', aggr: 'Aggressive', xtrm: 'Extreme' }, LEGS = { safe: 2, med: 3, aggr: 4, xtrm: 5 };
const LOCK_MS = 2 * 3600e3;
/* this file's own copy of the page's featured rule: a game on any national network ESPN lists, less those named here */
const FEATURED_TV = { except: [] };
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
const featuredOf = e => !!e && e.type !== 'PRE' && Array.isArray(e.tv) && e.tv.some(n => typeof n === 'string' && n && !FEATURED_TV.except.includes(n));
const HOW = 'The suggestions record, written by tools/suggest_ledger.js in the job and held by tools/suggest_check.js. featured: each '
  + 'game on national TV\'s four parlays on the Suggested Parlays tab (Safe, Medium, Aggressive, Extreme, 2 to 5 legs from that game '
  + 'alone, every bet type; a player\'s chance is the props model\'s, on trial), taken from the published page on the state just '
  + 'published and DraftKings\' lines in lines.json, keyed season|date|tip|game, rewritten while the set\'s lock (2 hours before '
  + 'tip-off) is to come and locked from it, so each entry is the set as the job last published it before the lock; from the lock to '
  + 'tip-off a level holding a player the injury report has since listed is built again, that level alone, and recorded in updates. '
  + 'From tip-off it is graded as a book settles it, by the page\'s own settlement (the scores, and each player\'s box line: a player '
  + 'with none did not play, void): a leg lost loses; a push or void leg drops out and the rest are paid at the builder\'s price on '
  + 'the legs left; every leg a push or void is a push, the stake back; the payout on a $1 stake. featured_summary: per level, the '
  + 'parlays graded won or lost (each season\'s game and level once), won, the wins expected by DraftKings\' fair chance and by the '
  + 'model\'s, and units on $1. Never edited by hand: the check refuses a ledger whose locked entries moved.';

/* the summary, as the tab's record pills count it (spRecSum): each season's game and level once, from the last key that
   holds it (a tip-off ESPN moved makes a new key) */
const blankTiers = () => Object.fromEntries(TIERS.map(id => [id, { label: LABELS[id], graded: 0, won: 0, lost: 0, push: 0, exp_fair: 0, fair_n: 0, exp_model: 0, units: 0 }]));
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
  for (const id of TIERS) { const s = out[id]; s.exp_fair = r4(s.exp_fair); s.exp_model = r4(s.exp_model); s.units = r3(s.units); }
  const games = new Set(Object.values(F || {}).map(e => e.season + '|' + e.gid)).size;
  return { tiers: out, pending, games, entries: Object.keys(F || {}).length, graded_entries: graded, updates };
}
/* the file's own style: one entry a line (and the summary on one), so a run's diff is the entries it took or graded */
function dumps(L) {
  const head = ['how', 'since', 'updated', 'featured_summary'].filter(k => k in L).map(k => ` ${JSON.stringify(k)}: ${JSON.stringify(L[k])}`);
  const F = L.featured || {}, keys = Object.keys(F);
  const body = keys.length ? '{\n' + keys.map(k => `  ${JSON.stringify(k)}: ${JSON.stringify(F[k])}`).join(',\n') + '\n }' : '{}';
  return '{\n' + [...head, ` "featured": ${body}`].join(',\n') + '\n}';
}

/* ---- the guard: every failure as a sentence ---- */
function gradeBad(key, e) {
  const bad = [];
  for (const [id, g] of Object.entries(e.grade || {})) {
    const tier = (e.tiers || []).find(x => x && x.id === id);
    if (!tier || !tier.legs) { bad.push(`${key} ${id}: a grade for a level with no parlay`); continue; }
    const s = (g && g.legs) || [];
    const ok = s.length === tier.legs.length && s.every(x => x == null || ['win', 'loss', 'push', 'void'].includes(x));
    const want = !ok ? null : s.some(x => x == null) ? 'pending' : s.includes('loss') ? 'lost' : s.every(x => x !== 'win') ? 'push' : 'won';
    if (!ok || !g || g.result !== want) { bad.push(`${key} ${id}: graded ${g && g.result} on legs ${JSON.stringify(s)}`); continue; }
    if (want === 'lost' && g.payout !== 0) bad.push(`${key} ${id}: a loss paying ${g.payout}`);
    if (want === 'push' && g.payout !== 1) bad.push(`${key} ${id}: a push paying ${g.payout}`);
    if (want === 'won' && !(g.payout > 1)) bad.push(`${key} ${id}: a win paying ${g.payout}`);
    if (want === 'won' && s.every(x => x === 'win') && g.payout !== tier.dec) bad.push(`${key} ${id}: every leg won and it pays ${g.payout}, not its price ${tier.dec}`);
  }
  return bad;
}
const holds = (t, pid) => !!(t && Array.isArray(t.legs) && t.legs.some(l => l && l.kind === 'prop' && l.pid === pid));
/* one entry on its own: its key, its game, its night, its lock, its legs, its replacements, its grades */
function entryBad(key, e, now) {
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
  if (!featuredOf(e)) bad.push(`${key}: not a featured game by its own networks (${JSON.stringify(e.tv)}) and type (${e.type})`);
  if (e.tiers.map(x => x && x.id).join() !== TIERS.join()) bad.push(`${key}: its levels are not the four`);
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
      if (!isMap(u) || !TIERS.includes(u.tier) || !u.pid || !u.at) { bad.push(`${key}: a replacement that names no level, player or time`); continue; }
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
  for (const [key, e] of Object.entries(F)) bad.push(...entryBad(key, e, now));
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
  const s = L.featured_summary || summarize(L.featured);
  console.log(`suggest check: 0 failures (${s.entries} set${s.entries === 1 ? '' : 's'}, ${s.graded_entries} graded, ${s.updates} replacement${s.updates === 1 ? '' : 's'}${prev ? ', every locked set as the last commit had it' : ', no last commit to hold it to'})`);
  return 0;
}
module.exports = { check, entryBad, lockedMoved, gradeBad, summarize, dumps, canon, callOf, keyOf, featuredOf, etDateOf, minIso, TIERS, LABELS, LEGS, LOCK_MS, FEATURED_TV, HOW, LEDGER_REL };
if (require.main === module) process.exit(main());
