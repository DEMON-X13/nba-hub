/* The calls ledger: each of the game models ported from the NFL hub (the Alpha Model, the Joker, the ELO Model) calls
 * every game of the season in play, and the Pick'em Record grades the call the site published before tip-off, never one
 * worked out again after the game.
 *
 *   node tools/calls.js          read models/<id>.json, write data/calls.json
 *
 * THE CALLS. A game still to tip takes the model's call of this run (an unchanged chance keeps its old stamp, so a quiet
 * run writes nothing); from tip-off (its status no longer scheduled, or its tip time passed) the call is frozen and never
 * written again. A game played before a model's first published call (the model is new, or the season is) gets one call
 * on pre-tip information by the model fitted on earlier seasons only (its `games` replay), marked src 'backtest' and
 * frozen like the rest; a game a publishing model missed (it could not run that day) gets none. A model whose file is
 * missing or says it could not run adds nothing and keeps what it had. The Player Model's and Team Elo's calls are
 * data/predictions.csv's, frozen the same way by players.js. tools/calls_check.js holds the file to the last commit.
 *
 * data/calls.json: { season, about, calls: { alpha: { <game id>: { pick, pHome, at, src } }, joker: {...}, elo: {...} } }
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const OUT = path.join(L.ROOT, 'data', 'calls.json');
const MODELS = ['alpha', 'joker', 'elo'];
const ABOUT = 'Each model\'s call on each game of the season in play, as published before tip-off and frozen from it; src backtest: a game played before the model\'s first published call, called on pre-tip information by the model fitted on earlier seasons only. Written by tools/calls.js, never by hand.';

/* the season in play: the latest with a regular-season or playoff game on or before ten days from today, as publish.js
   picks it */
function seasonInPlay(games, today) {
  const to = L.addDays(today, 10);
  return Math.max(...games.filter(g => g.type !== 'PRE' && g.date <= to).map(g => +g.season), 0);
}
const tipped = (g, now) => g.status !== 'scheduled' || (!!g.tip && g.tip <= now);

function build(doc, games, models, now) {
  const today = L.etDate(new Date(Date.parse(now)));
  const season = seasonInPlay(games, today);
  const ours = games.filter(g => +g.season === season && g.type !== 'PRE');
  const out = { season, about: ABOUT, calls: {} };
  const keepOld = doc && doc.season === season ? doc.calls || {} : {};
  for (const id of MODELS) {
    const prev = keepOld[id] || {}, m = models[id], calls = {};
    const pubs = Object.values(prev).filter(c => c.src === 'published').map(c => c.at).sort();
    const firstPub = pubs[0] || null;
    const ok = m && (!m.status || m.status.ok !== false);
    for (const g of ours) {
      const was = prev[g.game_id];
      if (tipped(g, now)) {
        if (was) { calls[g.game_id] = was; continue; }
        /* a game played before the model's first published call: one honest call from its replay, frozen */
        const r = ok && m.games && m.games[g.game_id];
        if (r && isFinite(r.pHome) && (!firstPub || (g.tip && g.tip < firstPub)))
          calls[g.game_id] = { pick: r.pHome >= 0.5 ? g.home : g.away, pHome: +(+r.pHome).toFixed(4), at: now, src: 'backtest' };
        continue;
      }
      /* still to tip: this run's call, or the last one if the model could not run */
      const u = ok ? m.upcoming && m.upcoming[g.game_id] : null;
      if (u && isFinite(u.pHome)) {
        const pHome = +(+u.pHome).toFixed(4);
        calls[g.game_id] = was && was.src === 'published' && was.pHome === pHome ? was : { pick: pHome >= 0.5 ? g.home : g.away, pHome, at: now, src: 'published' };
      } else if (!ok && was) calls[g.game_id] = was;
    }
    out.calls[id] = Object.fromEntries(Object.entries(calls).sort((a, b) => a[0] < b[0] ? -1 : 1));
  }
  return out;
}

function main() {
  const now = process.env.CALLS_NOW || new Date().toISOString().slice(0, 16) + 'Z';
  const games = L.readGames();
  const models = {};
  for (const id of MODELS) { const f = path.join(L.ROOT, 'models', id + '.json'); if (fs.existsSync(f)) try { models[id] = JSON.parse(fs.readFileSync(f, 'utf8')); } catch (e) { L.log(`calls: models/${id}.json does not read: ${e.message}`); } }
  const before = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  const doc = before ? JSON.parse(before) : null;
  const out = build(doc, games, models, now);
  /* one call a line, so a run's change is the lines of the games it called */
  const body = '{\n "season": ' + out.season + ',\n "about": ' + JSON.stringify(out.about) + ',\n "calls": {' + MODELS.map(id => `\n  ${JSON.stringify(id)}: {` + Object.entries(out.calls[id]).map(([g, c]) => `\n   ${JSON.stringify(g)}: ${JSON.stringify(c)}`).join(',') + (Object.keys(out.calls[id]).length ? '\n  }' : '}')).join(',') + '\n }\n}\n';
  if (body !== before) fs.writeFileSync(OUT, body);
  L.log(`calls.json: ${MODELS.map(id => `${id} ${Object.keys(out.calls[id]).length} (${Object.values(out.calls[id]).filter(c => c.src === 'backtest').length} backtest)`).join(', ')} | ${body !== before ? 'written' : 'unchanged'}`);
}
if (require.main === module) main();
module.exports = { build, seasonInPlay, tipped, MODELS };
