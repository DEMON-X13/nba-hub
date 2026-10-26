/* The suggestions record: what Suggested Parlays said of each game on national TV before it locked, frozen there, and
 * what happened to it (README "Suggested Parlays"). The NFL hub's props/build/suggest_ledger.js, on this hub's page.
 *
 *   now=$(date -u +%Y-%m-%dT%H:%M:%SZ) && SUGGEST_NOW=$now node tools/suggest_ledger.js && SUGGEST_NOW=$now node tools/suggest_check.js
 *                                                                     (the job, after the tests: one clock for the two)
 *
 * featured: each featured game's own four levels on the Suggested Parlays tab, Safe, Medium, Aggressive and Extreme, 2
 * to 5 legs from that game alone: a game on any national network ESPN's scoreboard lists (the slate's tv), never a
 * preseason game, on the lines feed's two dates (the dates the job reads DraftKings' lines for: a game further out has no
 * line yet, and would be four empty levels). Taken from the published page itself: index.html booted in jsdom on the
 * state.json just published and lines.json just read, the window's clock held at the run's time, read by the page's own
 * spTakes, spSet and spTierOut, so the record holds exactly the sets the tab shows (every featured game's, from its first
 * run, though the tab sets out one night at a time). Keyed season|date|tip|game id. A set LOCKS 2 hours before its
 * tip-off (the page's spLockAt): while the lock is to come a run rewrites the entry whenever the set has changed (lines
 * read, a player listed); from the first run at or after the lock it stands as the last run before the lock left it.
 * GitHub starts this repo's runs 3 to 9 hours late, so that is the last publish before the lock, whenever it was; a game
 * no run reached before its lock has no entry (the page then builds its own set once, says it is not the site's, and
 * keeps it in the visitor's browser), and an entry not yet locked whose game is no longer a featured game to come (off
 * national TV, a tip-off moved, postponed) is dropped. One change is allowed after the lock, on any run before tip-off
 * (the NFL owner's call, "Replace that level only"): a level holding a player the page's own rule now keeps out of every
 * set (spOutWhy: the game's out lists, or any listing on today's injury report) is built again from the data at hand by
 * the page's spRebuild, that level alone, and carries `updated` {pid, name, reason, at}, the same written into the entry's
 * `updates` beside the level's id. From tip-off nothing changes but the grade.
 *
 * Grading. From tip-off, each level of this season's entries is graded by the page's own settlement (NBA_GRADE.legResult,
 * the one X Parlays grades by: a game's legs on its final score, a push on the line; a player's on his box line, read
 * from state.json's week of box scores or data/box_<season>.csv, a push on a whole line, void when he has no line, as a
 * book voids a player who did not play): a leg lost loses the parlay; a push or a void drops out as a book drops it, the
 * rest paid at the builder's own price on the legs left (parlayDec: the whole price when none dropped, a same-game
 * remainder priced together); every leg a push or void is a push, the stake back; pending while a game or its box is
 * out. A grade once complete is never undone by a state that can no longer settle it, and another season's entries keep
 * the grades they have. featured_summary per level, each season's game and level once, from the last key that holds it,
 * as the tab's record pills count it.
 *
 * The guard (tools/suggest_check.js check, on its own rules): the new ledger against the file the run started from, then,
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
const { TIERS, LABELS, LOCK_MS, canon, callOf } = SC;
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
  const missing = ['spTakes', 'spSet', 'spTierOut', 'spLockAt', 'spOutWhy', 'spRebuild', 'pbLinesLoad', 'parlayDec', 'pbSlipOf'].filter(f => w.eval(`typeof ${f}`) !== 'function');
  if (missing.length) return [...why, 'the page has no Suggested Parlays sets to take (no ' + missing.join(', ') + ')'];
  if (!w.NBA_GRADE || typeof w.NBA_GRADE.legResult !== 'function') why.push('the page has no settlement to grade by (NBA_GRADE)');
  if (w.eval('PB_TIERS').map(t => t[0] + ':' + t[1] + ':' + t[2]).join() !== TIERS.map(id => `${id}:${LABELS[id]}:${SC.LEGS[id]}`).join()) why.push("the page's levels are not the four this record keeps");
  if (w.eval('SP_LOCK_MS') !== LOCK_MS) why.push('the page locks a set at another time than 2 hours before tip-off');
  try { await w.eval('pbLinesLoad()'); } catch (e) { why.push('lines.json threw: ' + e.message); }
  if (!w.eval('LINES')) why.push('lines.json did not load, so the page would build every set with no DraftKings line');
  if (errs.length) why.push('the page threw: ' + errs.slice(0, 3).join('; '));
  return why;
}

/* ---- the featured sets the tab shows now, each game whose lock is still to come ---- */
function takeFeatured(w, now) {
  const games = w.eval('spTakes()'), lockAt = w.eval('spLockAt'), set = w.eval('spSet'), out = w.eval('spTierOut'), S = w.eval('S'), takes = [];
  let locked = 0;
  for (const g of games) {
    const tip = Date.parse(g.tip), lock = lockAt(g);
    if (!(tip > now)) throw new Error(`${g.id}, a game still to come, tips off at or before the clock`);
    if (lock !== tip - LOCK_MS) throw new Error(`the page locks ${g.id} at another time than 2 hours before its tip-off`);
    /* from the lock its entry stands as the last run before it left it, or there is none */
    if (!(now < lock)) { locked++; continue; }
    const s = set(g.id); if (!s) throw new Error(`the page has no set for ${g.id}`);
    const entry = { season: S.season, date: g.date, gid: g.id, away: g.away, home: g.home, type: g.type, tip: g.tip, lock: SC.minIso(lock), tv: [...g.tv], generated: S.generated,
      pool: { pref: s.pref, thin: s.thin, mkt: s.mkt, far: s.far, held: s.held }, tiers: s.tiers.map(t => JSON.parse(JSON.stringify(out(t)))) };
    takes.push({ key: SC.keyOf(entry), entry });
  }
  return { games: games.length, locked, takes };
}

/* ---- a locked set, from its lock to tip-off: a level holding a player since listed built again, that level alone ---- */
function replaceRuledOut(w, F, now, runAt, said) {
  const S = w.eval('S'), why = w.eval('spOutWhy'), rebuild = w.eval('spRebuild'), out = w.eval('spTierOut');
  for (const [key, e] of Object.entries(F)) {
    const tip = Date.parse(e.tip);
    if (!(tip - LOCK_MS <= now && now < tip) || +e.season !== +S.season || !Array.isArray(e.tiers)) continue;
    /* the game as the slate has it now: one moved since the lock is another key's, and left alone */
    const g = S.slate.find(x => x.id === e.gid); if (!g || g.tip !== e.tip || g.status !== 'scheduled') continue;
    e.tiers.forEach((t, i) => {
      if (!t || !Array.isArray(t.legs)) return;
      const l = t.legs.find(x => x.kind === 'prop' && why(x.pid, e.gid)); if (!l) return;
      const nt = rebuild(e.gid, t.id); if (!nt) return;
      const upd = { pid: l.pid, name: l.name, reason: why(l.pid, e.gid), at: runAt };
      e.tiers[i] = { ...JSON.parse(JSON.stringify(out(nt))), updated: upd };
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
  if (legs.some(x => x == null)) return { result: 'pending', legs };
  if (legs.includes('loss')) return { result: 'lost', legs, payout: 0 };
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
  next.how = SC.HOW; next.since = base.since || SINCE; next.featured = isMap(next.featured) ? next.featured : {};
  const F = next.featured, said = [];
  /* the featured sets: each game's rewritten while its lock is to come, when the set has changed */
  const take = takeFeatured(w, now), keys = new Set(take.takes.map(x => x.key));
  for (const [key, e] of Object.entries(F))
    if (now < Date.parse(e.tip) - LOCK_MS && !keys.has(key)) { delete F[key]; said.push(`dropped ${key}, no longer a featured game to come`); }
  for (const { key, entry } of take.takes) {
    const old = F[key], { generated, ...fresh } = entry;
    const same = old && (() => { const { taken_at, generated: g0, ...o } = callOf(old); return canon(o) === canon(fresh); })();
    if (!same) { F[key] = { ...entry, taken_at: runAt }; said.push(`${old ? 'rewrote' : 'took'} ${key}`); }
    else said.push(`${key} unchanged`);
  }
  if (!take.games) said.push('no featured game on the lines feed\'s dates');
  else if (take.locked) said.push(`${take.locked} featured set${take.locked === 1 ? '' : 's'} locked`);
  replaceRuledOut(w, F, now, runAt, said);
  await boxesFor(w, F, now, season);
  gradeAll(w, F, now, season);
  next.featured = Object.fromEntries(Object.keys(F).sort().map(k => [k, F[k]]));
  next.featured_summary = SC.summarize(next.featured);

  const bad = SC.check(next, start, now, runAt, season);
  const moved = (L, prev) => SC.lockedMoved(L, prev, now, null);
  if (head && headText !== startText) bad.push(...moved(next, head).map(b => 'against the last commit: ' + b));
  if (bad.length) {
    for (const b of bad) console.log('FAIL ' + b);
    /* the file put back: the last commit's where the file on disk had itself moved a locked entry */
    const startBad = !!(head && start && moved(start, head).length), back = startBad ? headText : startText;
    if (back == null) { try { fs.unlinkSync(LEDGER); } catch (e) {} } else if (readText(LEDGER) !== back) fs.writeFileSync(LEDGER, back);
    console.log(`suggest ledger: refused, ${bad.length} failure${bad.length === 1 ? '' : 's'}; the ${startBad ? "last commit's" : 'last good'} ledger stays`);
    return 1;
  }
  const q = next.featured_summary, rec = TIERS.map(id => `${id} ${q.tiers[id].won}/${q.tiers[id].graded}`).join(', ');
  const tail = `${q.entries} set${q.entries === 1 ? '' : 's'}, ${q.pending} level${q.pending === 1 ? '' : 's'} pending, won/graded ${rec}`;
  if (start && canon({ ...next, updated: null }) === canon({ ...start, updated: null })) { console.log(`suggest ledger: unchanged (${said.join('; ')}); ${tail}`); return 0; }
  next.updated = runAt;
  const out = { how: next.how, since: next.since, updated: next.updated, featured_summary: next.featured_summary, featured: next.featured };
  fs.mkdirSync(path.dirname(LEDGER), { recursive: true });
  fs.writeFileSync(LEDGER, SC.dumps(out) + '\n');
  console.log(`suggest ledger: written (${said.join('; ')}); ${tail}`);
  return 0;
}
module.exports = { gradeTier, takeFeatured, SINCE };
if (require.main === module) {
  main().then(code => process.exit(code), e => { console.log('suggest ledger: refused: ' + (e && e.message || e)); process.exit(1); });
}
