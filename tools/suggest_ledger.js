/* The suggestions record: what Suggested Parlays said of each night before it locked, frozen there, and what happened
 * to it (README "Suggested Parlays"). The NFL hub's props/build/suggest_ledger.js, on this hub's page.
 *
 *   now=$(date -u +%Y-%m-%dT%H:%M:%SZ) && SUGGEST_NOW=$now node tools/suggest_ledger.js && SUGGEST_NOW=$now node tools/suggest_check.js
 *                                                                     (the job, after the tests: one clock for the two)
 *
 * night (since the owner's call of 7 November 2026): each night's one set, across every game of the night (an Eastern
 * date's games but preseason), its three levels Safe (the likeliest 2-leg parlay), Medium (the likeliest of 2 to 5 legs
 * paying $4 or more on $1) and Aggressive (the likeliest of 2 to 5 paying $8 or more), on the night's team legs at
 * DraftKings' prices and, on every set the page with them takes from 23:00 UTC on 7 November 2026, DraftKings' main lines on its players at DraftKings' own
 * fair chance (the owner's call of that day, "Add at DraftKings' odds"), by the builder's own sums, on the lines feed's
 * two dates (the dates the job reads DraftKings' lines
 * for, so a night's set is taken the night before too: the job's runs land hours late). Taken from the published page
 * itself: index.html booted in jsdom on the state.json just published and lines.json just read, the window's clock held
 * at the run's time, read by the page's own spTakes and spEntry, so the record holds exactly the set the tab shows.
 * Keyed season|date|first tip|<season>_<date>_NIGHT, its pool beside it (each leg's key, price and chance, each game's
 * side and total together), so the guard works each level out again. A set LOCKS 2 hours before the night's first
 * tip-off (the page's spLockAt): while the lock is to come a run rewrites the entry whenever the set has changed (lines
 * read), keeping it otherwise; from the first run at or after the lock it stands as the last run before the lock left
 * it, and nothing changes but its grade, and, before the first tip-off, a level holding a player the report has listed
 * since: that level alone is built again from the lines at hand (the page's spRebuildOut), marked `updated` {pid, name,
 * reason, at} with its own pool, and recorded in the entry's `updates` (replaceRuledOut; a set of team legs alone, which
 * no report moves, never is). GitHub starts this repo's
 * runs 3 to 9 hours late, so that is the last publish before the lock, whenever it was; a night no run reached before
 * its lock has no entry (the page then builds its own set once, says it is not the site's, and keeps it in the visitor's
 * browser), and an entry not yet locked whose night is no longer to come as it was (its first tip-off moved before the
 * lock) is dropped. A night once locked stays locked: an entry whose own lock has passed holds its night though ESPN
 * moves the first tip-off later (no new set is taken on later lines), and one whose night has locked at a first tip-off
 * moved earlier stays as it was. No set is taken of a night DraftKings has posted no line for (the lines feed's second
 * date, read a day ahead, mostly): one an earlier run took stays, and with none the page builds its own from the lock.
 *
 * featured (until 7 November 2026): each game on national TV's own three levels, taken by the rule before. No set is
 * taken there any more; one still to lock is dropped, as the job drops a set no longer offered, and the rest stand as
 * they were taken (sets taken before 5 November 2026 with Extreme, a fourth level), graded as before, the summary
 * keeping their record.
 *
 * Grading. From its first tip-off, each level of this season's entries is graded by the page's own settlement
 * (NBA_GRADE.legResult, the one X Parlays grades by: a game's legs on its final score, a push on the line; a player's on
 * his box line, read from state.json's week of box scores or data/box_<season>.csv, a push on a whole line, void when he
 * has no line, as a book voids a player who did not play): a leg lost loses the parlay; a push or a void drops out as a
 * book drops it, the rest paid at the builder's own price on the legs left (parlayDec: the whole price when none dropped,
 * a same-game remainder priced together); every leg a push or void is a push, the stake back; pending while a game or its
 * box is out, unless a leg has already lost (a night's legs finish game by game: a book settles the parlay lost at once). A grade once complete is never undone by a state that can no longer settle it, and another season's entries
 * keep the grades they have. night_summary and featured_summary per level, each season's night (or game) and level once,
 * from the last key that holds it, as the tab's record pills count them (the pills draw the night's, each titled with the
 * featured record).
 *
 * The guard (tools/suggest_check.js check, on its own rules, and for each set or level this run took on its own reading
 * of the same state.json and lines.json: every player line, every two legs of a game by its own copula): the new ledger
 * against the file the run started from, then,
 * where that differs from it, against the last commit's (git show HEAD); a ledger that fails is not written, the file is
 * put back as it was (the last commit's where the file on disk had itself moved a locked entry), and the run exits 1.
 * The job's step then puts the last commit's file back and turns that step red; the record never holds back state.json
 * or the data.
 *
 * SUGGEST_NOW is the run's clock: the job hands the same instant to this script and to suggest_check.js after it, so the
 * check reads which sets are locked at the instant this run rewrote or froze them (a lock passing in the seconds the
 * script runs would otherwise read as a locked set moved). SUGGEST_ROOT (the folder the page and its files are read from:
 * index.html, state.json, lines.json, data/box_<season>.csv), SUGGEST_LEDGER and SUGGEST_PREV ('none' skips the last
 * commit) are for the test, tools/test_suggest_ledger.js. Needs jsdom (tools/node_modules, the tests' npm ci). Exit 0: written, or unchanged and not
 * written. Exit 1: refused, nothing written. The last line starts "suggest ledger:".
 */
'use strict';
const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const SC = require('./suggest_check');
const ROOT = path.resolve(__dirname, '..');
const SROOT = process.env.SUGGEST_ROOT ? path.resolve(process.env.SUGGEST_ROOT) : ROOT;
const LEDGER = process.env.SUGGEST_LEDGER || path.join(ROOT, SC.LEDGER_REL);
const PAGE_URL = 'https://demon-x13.github.io/nba-hub/';
const SINCE = '2026-10-25';
const { NIGHT_LEVELS, NIGHT_IDS, LOCK_MS, canon, callOf } = SC;
const isMap = v => !!v && typeof v === 'object' && !Array.isArray(v);
const r3 = v => v == null || !isFinite(v) ? null : Math.round(v * 1e3) / 1e3;
const iso = ms => new Date(ms).toISOString().replace(/\.\d{3}Z$/, 'Z');
const readText = f => { try { return fs.readFileSync(f, 'utf8'); } catch (e) { return null; } };
const parse = t => { if (t == null) return null; try { return JSON.parse(t); } catch (e) { return undefined; } };
function nowMs() {
  const v = process.env.SUGGEST_NOW; if (!v) return Date.now();
  const t = Date.parse(v); if (!isFinite(t)) throw new Error('SUGGEST_NOW is not a time: ' + v);
  return t;
}
/* the last published ledger: SUGGEST_PREV, else the last commit's (null when there is none) */
function prevText() {
  const p = process.env.SUGGEST_PREV;
  if (p === 'none') return null;
  if (p) return readText(p);
  const r = cp.spawnSync('git', ['show', 'HEAD:' + SC.LEDGER_REL], { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
  return r.status === 0 && r.stdout.trim() ? r.stdout : null;
}

/* ---- the page, booted as a visitor's browser boots it, on the run's clock ---- */
function boot(now) {
  const { JSDOM, VirtualConsole } = require(path.join(__dirname, 'node_modules', 'jsdom'));
  const html = fs.readFileSync(path.join(SROOT, 'index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const errs = [], asked = [];
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/navigation|Could not parse CSS/i.test(String(e && e.message))) errs.push('jsdom: ' + (e && e.message)); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: PAGE_URL, virtualConsole: vc,
    beforeParse(w) {
      w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
      if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
      /* the window's clock is the run's, held still: a boot of a few seconds must not carry the page past a lock or a
         tip-off the script, on the same instant, still counts as to come */
      const D0 = w.Date;
      class D extends D0 { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } }
      w.Date = D;
      w.addEventListener('error', e => errs.push(e.message));
      /* the published files from this checkout, and nothing else: the record itself answers 404, so the page builds every
         set from the data, never from the ledger; ESPN is never asked */
      w.fetch = u => {
        const url = new URL(String(u), PAGE_URL), rel = url.pathname.replace(/^\/nba-hub\//, '');
        asked.push(rel);
        const ok = t => Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t });
        if (url.host === 'demon-x13.github.io' && rel !== SC.LEDGER_REL && /^(state|lines|pickem|history)\.json$|^data\/box_\d{4}\.csv$|^liveparlays\/parlays\.json$/.test(rel)) {
          const t = readText(path.join(SROOT, rel)); if (t != null) return ok(t); }
        return Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' });
      };
    } });
  return { w: dom.window, errs, asked };
}
const sleep = ms => new Promise(r => setTimeout(r, ms));
/* the page up, on the state and lines.json from this checkout, with everything the record reads */
async function ready(w, errs, state) {
  for (let i = 0; i < 600 && !w.eval("typeof S !== 'undefined' && !!S && !!S.slate"); i++) await sleep(50);
  const why = [];
  if (!w.eval("typeof S !== 'undefined' && !!S && !!S.slate")) return ['the page did not load state.json'];
  if (w.eval('S.generated') !== state.generated) why.push('the page did not load this checkout\'s state.json');
  const missing = ['spTakes', 'spEntry', 'spLockAt', 'spOutWhy', 'spRebuildOut', 'pbLinesLoad', 'parlayDec', 'pbSlipOf'].filter(f => w.eval(`typeof ${f}`) !== 'function');
  if (missing.length) return [...why, 'the page has no Suggested Parlays nights to take (no ' + missing.join(', ') + ')'];
  if (!w.NBA_GRADE || typeof w.NBA_GRADE.legResult !== 'function') why.push('the page has no settlement to grade by (NBA_GRADE)');
  if (JSON.stringify(w.eval("typeof SP_LEVELS !== 'undefined' ? SP_LEVELS : []")) !== JSON.stringify(NIGHT_LEVELS)) why.push("the page's levels are not the three this record keeps (Safe a pair, Medium 2 to 5 legs paying $4+, Aggressive 2 to 5 paying $8+)");
  if (w.eval('SP_LOCK_MS') !== LOCK_MS) why.push('the page locks a set at another time than 2 hours before its first tip-off');
  try { await w.eval('pbLinesLoad()'); } catch (e) { why.push('lines.json threw: ' + e.message); }
  if (!w.eval('LINES')) why.push('lines.json did not load, so the page would build every set with no DraftKings line');
  if (errs.length) why.push('the page threw: ' + errs.slice(0, 3).join('; '));
  return why;
}

/* ---- the night sets the tab shows, each night of the lines feed's dates whose lock is still to come ----
   have: the night map as the run found it. keep: the nights whose entries the drop below must leave as they are (one
   locked, or held, or with no line posted this run) */
function takeNights(w, now, have) {
  const nights = w.eval('spTakes()'), lockAt = w.eval('spLockAt'), entry = w.eval('spEntry'), season = w.eval('S.season'), takes = [], keep = new Set();
  let locked = 0; const held = [], empty = [];
  for (const N of nights) {
    const tip = Date.parse(N.tip), lock = lockAt(N);
    if (lock !== tip - LOCK_MS) throw new Error(`the page locks ${N.id} at another time than 2 hours before its first tip-off`);
    /* from the lock its entry stands as the last run before it left it, or there is none (an entry kept at a first
       tip-off ESPN has moved earlier since, its own lock still to come, is the night's, and stays) */
    if (!(now < lock)) { locked++; keep.add(N.id); continue; }
    /* a night once locked stays locked: an entry of it whose own lock has passed, at a first tip-off ESPN has moved later
       since, is the night's set, and no new one is taken on later lines (SC.nightHeld) */
    const was = SC.nightHeld(have, season, N.id, now);
    if (was) { held.push(`${N.id} (locked at ${SC.minIso(Date.parse(was.tip) - LOCK_MS)})`); keep.add(N.id); continue; }
    if (!(tip > now)) throw new Error(`${N.id}, a night still to lock, tips off at or before the clock`);
    const e = entry(N.id); if (!e) throw new Error(`the page has no set for ${N.id}`);
    const x = JSON.parse(JSON.stringify(e));
    if (x.tiers.map(t => t.id).join() !== NIGHT_IDS.join()) throw new Error(`the page's set for ${N.id} is not its three levels`);
    /* no line posted yet for any game of the night (the lines feed's second date, a day ahead): no set is taken, and one
       an earlier run took stays as it was; until a run reads the lines the page builds its own from the lock */
    if (SC.nightNoLines(x)) { empty.push(N.id); keep.add(N.id); continue; }
    takes.push({ key: SC.nightKeyOf(x), entry: x });
  }
  return { nights: nights.length, locked, held, empty, takes, keep };
}

/* ---- a locked night, from its lock to its first tip-off: a level holding a player the report has listed since built
   again from the lines at hand, that level alone (the page's spRebuildOut, its pool with it), recorded in updates ---- */
function replaceRuledOut(w, Nm, now, runAt, said) {
  const season = w.eval('S.season'), why = w.eval('spOutWhy'), rebuild = w.eval('spRebuildOut'), byId = w.eval('spById');
  for (const [key, e] of Object.entries(Nm)) {
    const tip = Date.parse(e.tip);
    if (!(tip - LOCK_MS <= now && now < tip) || +e.season !== +season || !Array.isArray(e.tiers) || !e.pool || !e.pool.pl) continue;
    /* the night as the slate has it now: one whose first tip-off moved since the lock is held as it was */
    const N = byId(e.nid); if (!N || N.tip !== e.tip) continue;
    e.tiers.forEach((t, i) => {
      if (!t || !Array.isArray(t.legs)) return;
      const l = t.legs.find(x => x.kind === 'prop' && why(x.pid, x.id)); if (!l) return;
      const upd = { pid: String(l.pid), name: l.name, reason: why(l.pid, l.id), at: runAt };
      const nt = rebuild(e.nid, t.id, upd); if (!nt) return;
      e.tiers[i] = JSON.parse(JSON.stringify(nt));
      e.updates = [...(Array.isArray(e.updates) ? e.updates : []), { tier: t.id, ...upd }];
      said.push(`replaced ${key} ${t.id}: ${l.name} ${upd.reason}`);
    });
  }
}

/* ---- a level's grade, by the page's own settlement ---- */
const RES = { won: 'win', lost: 'loss', push: 'push', void: 'void' };
function gradeTier(w, t) {
  const result = w.NBA_GRADE.legResult, parlayDec = w.eval('parlayDec');
  const legs = t.legs.map(l => RES[result(JSON.parse(JSON.stringify(l)))] || null);
  /* a leg lost loses the parlay at once, as a book settles it, though another leg's game is still to finish (a night's
     legs finish game by game) */
  if (legs.includes('loss')) return { result: 'lost', legs, payout: 0 };
  if (legs.some(x => x == null)) return { result: 'pending', legs };
  const left = t.legs.filter((l, i) => legs[i] === 'win');
  if (!left.length) return { result: 'push', legs, payout: 1 };
  const payout = left.length === t.legs.length ? t.dec : r3(parlayDec(left.map(l => ({ leg: JSON.parse(JSON.stringify(l)), ml: l.odds }))));
  return { result: 'won', legs, payout };
}
const DONE = new Set(['won', 'lost', 'push']);
/* the box files a grade may need (a player's leg on a game older than state.json's week of box lines), read first through
   the page's own reader, so its settlement answers at once */
async function boxesFor(w, F, now, season) {
  const from = w.eval('S.boxes && S.boxes.from'), need = new Set();
  for (const e of Object.values(F)) if (Date.parse(e.tip) <= now && +e.season === +season && (!from || e.date < from) && (e.tiers || []).some(t => t && (t.legs || []).some(l => l.kind === 'prop'))) need.add(String(e.season));
  for (const s of need) await w.eval('boxCsvRead')(s);
}
function gradeAll(w, F, now, season) {
  /* F: either map, the featured sets graded from their tip-off and the night's from its first */
  for (const e of Object.values(F)) {
    if (!(Date.parse(e.tip) <= now) || +e.season !== +season) continue;
    const g = {};
    for (const t of e.tiers || []) {
      if (!t || !Array.isArray(t.legs)) continue;
      const was = (e.grade || {})[t.id], now1 = gradeTier(w, t);
      g[t.id] = now1.result === 'pending' && was && DONE.has(was.result) ? was : now1;
    }
    e.grade = g;
  }
}

async function main() {
  const now = nowMs(), runAt = iso(now);
  const startText = readText(LEDGER), headText = prevText();
  const start = parse(startText), head = parse(headText);
  if (start === undefined) throw new Error(LEDGER + ' is not JSON');
  const stateText = readText(path.join(SROOT, 'state.json')); if (stateText == null) throw new Error('no state.json in ' + SROOT);
  const state = JSON.parse(stateText);
  const { w, errs } = boot(now);
  const why = await ready(w, errs, state);
  if (why.length) throw new Error(why.join('; '));
  const season = w.eval('S.season');

  const base = start || { how: SC.HOW, since: SINCE, updated: null, featured_summary: null, featured: {} };
  const next = JSON.parse(JSON.stringify(base));
  next.how = SC.HOW; next.since = base.since || SINCE; next.featured = isMap(next.featured) ? next.featured : {}; next.night = isMap(next.night) ? next.night : {};
  const F = next.featured, N = next.night, said = [];
  /* the per-game sets of the rule before 7 November 2026: none is taken any more, so one still to lock is no longer
     offered and is dropped, as the job always dropped such a set */
  for (const [key, e] of Object.entries(F))
    if (now < Date.parse(e.tip) - LOCK_MS) { delete F[key]; said.push(`dropped ${key}, a per-game set no longer offered`); }
  /* the night sets: each night's rewritten while its lock is to come, when the set has changed */
  const take = takeNights(w, now, N), keys = new Set(take.takes.map(x => x.key));
  for (const [key, e] of Object.entries(N))
    if (now < Date.parse(e.tip) - LOCK_MS && !keys.has(key) && !take.keep.has(e.nid)) { delete N[key]; said.push(`dropped ${key}, no longer a night to come as it was`); }
  for (const { key, entry } of take.takes) {
    const old = N[key], { generated, ...fresh } = entry;
    const same = old && (() => { const { taken_at, generated: g0, ...o } = callOf(old); return canon(o) === canon(fresh); })();
    if (!same) { N[key] = { ...entry, taken_at: runAt }; said.push(`${old ? 'rewrote' : 'took'} ${key}`); }
    else said.push(`${key} unchanged`);
  }
  if (!take.nights) said.push('no night on the lines feed\'s dates');
  else if (take.locked) said.push(`${take.locked} night set${take.locked === 1 ? '' : 's'} locked`);
  for (const h of take.held) said.push(`${h} held: its first tip-off moved after the lock, and no new set is taken`);
  for (const id of take.empty) said.push(`no set of ${id}: DraftKings has posted no line for its games yet`);
  replaceRuledOut(w, N, now, runAt, said);
  await boxesFor(w, F, now, season); await boxesFor(w, N, now, season);
  gradeAll(w, F, now, season); gradeAll(w, N, now, season);
  next.featured = Object.fromEntries(Object.keys(F).sort().map(k => [k, F[k]]));
  next.featured_summary = SC.summarize(next.featured);
  next.night = Object.fromEntries(Object.keys(N).sort().map(k => [k, N[k]]));
  next.night_summary = SC.summarizeNight(next.night);

  /* the guard holds every set and level this run took to its own reading of the same state.json and lines.json */
  const lines = parse(readText(path.join(SROOT, 'lines.json'))) || null;
  const bad = SC.check(next, start, now, runAt, season, state, lines);
  const moved = (L, prev) => [...SC.lockedMoved(L, prev, now, null), ...SC.nightMoved(L, prev, now, null)];
  if (head && headText !== startText) bad.push(...moved(next, head).map(b => 'against the last commit: ' + b));
  if (bad.length) {
    for (const b of bad) console.log('FAIL ' + b);
    /* the file put back: the last commit's where the file on disk had itself moved a locked entry */
    const startBad = !!(head && start && moved(start, head).length), back = startBad ? headText : startText;
    if (back == null) { try { fs.unlinkSync(LEDGER); } catch (e) {} } else if (readText(LEDGER) !== back) fs.writeFileSync(LEDGER, back);
    console.log(`suggest ledger: refused, ${bad.length} failure${bad.length === 1 ? '' : 's'}; the ${startBad ? "last commit's" : 'last good'} ledger stays`);
    return 1;
  }
  const q = next.night_summary, rec = NIGHT_IDS.map(id => `${id} ${q.tiers[id].won}/${q.tiers[id].graded}`).join(', '), f = next.featured_summary;
  const tail = `${q.entries} night set${q.entries === 1 ? '' : 's'}, ${q.pending} level${q.pending === 1 ? '' : 's'} pending, won/graded ${rec}; ${f.entries} featured set${f.entries === 1 ? '' : 's'} from before, ${f.pending} pending`;
  if (start && canon({ ...next, updated: null }) === canon({ ...start, updated: null })) { console.log(`suggest ledger: unchanged (${said.join('; ')}); ${tail}`); return 0; }
  next.updated = runAt;
  const out = { how: next.how, since: next.since, updated: next.updated, featured_summary: next.featured_summary, night_summary: next.night_summary, featured: next.featured, night: next.night };
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, SC.dumps(out) + '\n');
  console.log(`suggest ledger: written (${said.join('; ')}); ${tail}`);
  return 0;
}
module.exports = { gradeTier, takeNights, replaceRuledOut, SINCE };
if (require.main === module) {
  main().then(code => process.exit(code), e => { console.log('suggest ledger: refused: ' + (e && e.message || e)); process.exit(1); });
}
