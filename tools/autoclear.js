/* Clear X's finished parlays from X Parlays two Eastern days after their last game.
 *
 *   node tools/autoclear.js [--games data/games.csv] [--file liveparlays/parlays.json] [--today YYYY-MM-DD]
 *
 * A finished parlay stays on X Parlays, in full, on its game day and the whole of the next day, then clears itself on
 * every device (the NFL hub owner's rule, carried over with the tab). This marks it in the file the way Claude marks one
 * by hand, "cleared": true, so it stays in the file as history and the page neither draws it nor reads its games;
 * "cleared_on" (the Eastern date) and "cleared_by": "auto" say when and how, and nothing reads them.
 *
 * A parlay is cleared when every one of its games is final in data/games.csv (status final, or both scores filled) and
 * the date of its last game (games.csv's date, an Eastern date) is two or more days before today in US Eastern time: a
 * Saturday night's parlays clear on Monday. A game games.csv no longer lists counts as played on its date and void, as
 * the page grades it (ESPN drops a postponed game and the job with it, and the page voids a leg on a game of this season
 * or the last that is on no published list two days after its date: app/nba_hub.html offList), so it clears two days
 * after that date like any other. Nothing else is touched: a parlay already cleared, one with a game that has no final
 * yet, a leg pointing at no game, a game id not in the site's shape or of an older season stays as it is. The file is
 * written only when a parlay was cleared, in its own style (JSON.stringify with a one-space indent), with "updated"
 * moved to now, since that is when the page's list changed.
 *
 * Run by the job (.github/workflows/update.yml) after fetch.js has written games.csv; tools/test_autoclear.js is its
 * test. No dependencies: Node 22 alone.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');

const ID = /^(\d{4})_(\d{4})(\d{2})(\d{2})_([A-Z]{2,3})_([A-Z]{2,3})$/;
const etToday = (now = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
const days = (a, b) => Math.round((Date.parse(a + 'T12:00:00Z') - Date.parse(b + 'T12:00:00Z')) / 86400000);

/* games.csv's text -> { games: Map game_id -> { date, done }, season: the latest season it holds } */
function finals(text) {
  const lines = String(text || '').trim().split('\n'), head = (lines.shift() || '').split(','), ix = k => head.indexOf(k);
  const games = new Map(); let season = 0;
  for (const ln of lines) {
    const v = ln.split(','), gid = (v[ix('game_id')] || '').trim(), date = (v[ix('date')] || '').trim();
    if (!gid || !/^\d{4}-\d\d-\d\d$/.test(date)) continue;
    const done = (v[ix('status')] || '').trim() === 'final' || ((v[ix('home_score')] || '').trim() !== '' && (v[ix('away_score')] || '').trim() !== '');
    games.set(gid, { date, done });
    season = Math.max(season, +(v[ix('season')] || 0) || 0);
  }
  return { games, season };
}
/* the ids of the parlays to clear today, in the file's order */
function toClear(doc, fin, today) {
  const games = doc && Array.isArray(doc.games) ? doc.games : [], ids = [];
  for (const p of (doc && Array.isArray(doc.parlays) ? doc.parlays : [])) {
    if (!p || typeof p !== 'object' || Array.isArray(p) || p.cleared === true) continue;
    const legs = Array.isArray(p.legs) ? p.legs : [];
    if (!legs.length) continue;
    let last = '', ok = true;
    for (const l of legs) {
      const ixg = l && typeof l === 'object' ? l.game : null;
      const gid = Number.isInteger(ixg) && ixg >= 0 && ixg < games.length ? games[ixg] : null;
      const g = typeof gid === 'string' ? fin.games.get(gid) : null;
      let date = null;
      if (g) { if (g.done) date = g.date; }
      else {
        /* on no list: played on its date and void once the page says so, two days after it, for this season or the last */
        const m = typeof gid === 'string' ? ID.exec(gid) : null;
        const d = m ? `${m[2]}-${m[3]}-${m[4]}` : null;
        if (m && +m[1] >= fin.season - 1 && days(today, d) >= 2) date = d;
      }
      if (!date) { ok = false; break; }
      if (date > last) last = date;
    }
    if (ok && days(today, last) >= 2) ids.push(p.id);
  }
  return ids;
}
function apply(doc, ids, today, now) {
  const want = new Set(ids);
  for (const p of doc.parlays || []) if (p && typeof p === 'object' && want.has(p.id) && p.cleared !== true) { p.cleared = true; p.cleared_on = today; p.cleared_by = 'auto'; }
  doc.updated = now;
  return doc;
}
const dumps = doc => JSON.stringify(doc, null, 1) + '\n';

function main(argv, out = console.log) {
  const opt = (k, d) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : d; };
  const gamesF = path.resolve(opt('--games', path.join(ROOT, 'data', 'games.csv'))), file = path.resolve(opt('--file', path.join(ROOT, 'liveparlays', 'parlays.json')));
  const now = new Date(), today = opt('--today', etToday(now));
  if (!/^\d{4}-\d\d-\d\d$/.test(String(today)) || !Number.isFinite(Date.parse(today + 'T12:00:00Z'))) { out(`autoclear: --today must be a date, YYYY-MM-DD (got ${today})`); return 2; }
  const doc = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!doc || typeof doc !== 'object' || !Array.isArray(doc.parlays)) throw new Error(`${file} is not a parlay file`);
  const ids = toClear(doc, finals(fs.readFileSync(gamesF, 'utf8')), today);
  if (!ids.length) { out('autoclear: nothing to clear'); return 0; }
  apply(doc, ids, today, now.toISOString().slice(0, 19) + 'Z');
  fs.writeFileSync(file, dumps(doc));
  out(`autoclear: cleared ${ids.length}: ${ids.join(', ')}`);
  return 0;
}

module.exports = { finals, toClear, apply, dumps, etToday, main };
if (require.main === module) process.exit(main(process.argv.slice(2)));
