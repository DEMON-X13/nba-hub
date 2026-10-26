/* The calls ledger's check (tools/calls.js), run by the job before the commit: the record grades frozen calls, so a
 * frozen call that moved, or a call logged after its game tipped, would rewrite the record.
 *
 *   node tools/calls_check.js          exit 1, saying why, when data/calls.json breaks a rule
 *
 * Held against the last commit's file (git show HEAD:data/calls.json) and data/games.csv:
 *   - a call the last commit had on a game that has since tipped is still there, unchanged (frozen calls never move);
 *   - a published call was logged before its game's tip (its at earlier than the tip);
 *   - a backtest call is on a game that tipped at or before the model's first published call (none published: any game
 *     played), tipped read as tools/calls.js reads it, at or before the minute: a run's first published calls are stamped
 *     with its own minute, and a game tipping in that minute is one calls.js backfills;
 *   - every call's pick is the side its chance favours, its chance between 0 and 1, its game a REG or POST game of the
 *     file's season, its src published or backtest.
 * A first file (no last commit to hold it to) is held to the last three rules alone.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const L = require('./lib');
const { MODELS, tipped } = require('./calls');

function check(doc, last, games, now) {
  const bad = [], byId = Object.fromEntries(games.map(g => [g.game_id, g]));
  for (const id of MODELS) {
    const calls = (doc.calls && doc.calls[id]) || {};
    const pubs = Object.values(calls).filter(c => c.src === 'published').map(c => c.at).sort();
    const firstPub = pubs[0] || null;
    for (const [gid, c] of Object.entries(calls)) {
      const g = byId[gid];
      if (!g || +g.season !== doc.season || g.type === 'PRE') { bad.push(`${id} ${gid}: not a REG or POST game of ${doc.season}`); continue; }
      if (!(c.pHome >= 0 && c.pHome <= 1) || c.pick !== (c.pHome >= 0.5 ? g.home : g.away)) bad.push(`${id} ${gid}: pick ${c.pick} is not the side ${c.pHome} favours`);
      if (c.src === 'published') { if (g.tip && !(c.at < g.tip)) bad.push(`${id} ${gid}: published at ${c.at}, at or after its tip ${g.tip}`); }
      else if (c.src === 'backtest') { if (!tipped(g, now)) bad.push(`${id} ${gid}: a backtest call on a game still to tip`);
        else if (firstPub && !(g.tip && g.tip <= firstPub)) bad.push(`${id} ${gid}: a backtest call on a game that tipped after ${id}'s first published call (${firstPub})`); }
      else bad.push(`${id} ${gid}: src ${c.src}`);
    }
    if (last && last.season === doc.season) for (const [gid, c] of Object.entries((last.calls && last.calls[id]) || {})) {
      const g = byId[gid]; if (!g || !tipped(g, now)) continue;
      const now1 = calls[gid];
      if (!now1) bad.push(`${id} ${gid}: a frozen call was dropped`);
      else if (JSON.stringify(now1) !== JSON.stringify(c)) bad.push(`${id} ${gid}: a frozen call moved (${JSON.stringify(c)} to ${JSON.stringify(now1)})`);
    }
  }
  return bad;
}

function main() {
  const now = process.env.CALLS_NOW || new Date().toISOString().slice(0, 16) + 'Z';
  const f = path.join(L.ROOT, 'data', 'calls.json');
  if (!fs.existsSync(f)) { L.log('calls check: no data/calls.json yet'); return; }
  const doc = JSON.parse(fs.readFileSync(f, 'utf8'));
  let last = null;
  try { last = JSON.parse(execSync('git show HEAD:data/calls.json', { cwd: L.ROOT, stdio: ['ignore', 'pipe', 'ignore'] }).toString()); } catch (e) { last = null; }
  const bad = check(doc, last, L.readGames(), now);
  if (bad.length) { console.error(`calls check: ${bad.length} problem${bad.length === 1 ? '' : 's'}\n  ` + bad.slice(0, 40).join('\n  ')); process.exit(1); }
  L.log(`calls check: ${MODELS.map(id => `${id} ${Object.keys(doc.calls[id] || {}).length}`).join(', ')}, all frozen calls as the last commit had them`);
}
if (require.main === module) main();
module.exports = { check };
