/* What the site actually published before each preseason game, graded.
 *
 *   node research/retro_preseason.js     (from the repo root; reads git history)
 *
 * For every 2026-27 preseason game that is final in data/games.csv, the last state.json committed before its
 * tip-off is the number visitors saw: its model chance, pick, spread and total, and the market line it showed.
 * Those are graded against the final score. Where a day's games had moneylines published, the Parlay Builder's
 * suggestions are rebuilt from that snapshot by the page's own code and graded too. Writes
 * research/retro_preseason.json.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const L = require(path.join(ROOT, 'tools', 'lib'));
const { pageSuggest } = require(path.join(ROOT, 'tools', 'backtest'));

const sh = c => execSync(c, { cwd: ROOT, encoding: 'utf8', maxBuffer: 1 << 28 });
const commits = sh("git log --format='%H %cI' -- state.json").trim().split('\n').map(l => { const [h, t] = l.split(' '); return { h, t: new Date(t).toISOString() }; }).reverse();
const snaps = commits.map(c => { try { return { ...c, s: JSON.parse(sh(`git show ${c.h}:state.json`)) }; } catch (e) { return null; } }).filter(Boolean);
const finals = L.readGames().filter(g => g.type === 'PRE' && +g.season === 2027 && g.status === 'final');
const S = pageSuggest();
const games = [];
for (const g of finals) {
  const tip = g.tip ? new Date(g.tip.replace(/Z$/, ':00Z')).toISOString() : `${g.date}T23:00:00.000Z`;
  const before = snaps.filter(x => x.t < tip && (x.s.slate || []).some(y => y.id === g.game_id && y.model));
  if (!before.length) continue;
  const snap = before[before.length - 1], y = snap.s.slate.find(z => z.id === g.game_id);
  const pick = y.model.pHome >= 0.5 ? g.home : g.away, conf = Math.max(y.model.pHome, 1 - y.model.pHome);
  const mov = +g.home_score - +g.away_score, won = (pick === g.home) === (mov > 0);
  const fav = y.line == null ? null : y.line < 0 ? g.home : y.line > 0 ? g.away : null;
  let ats = null; if (y.line != null) { const c = mov + y.line; if (c) ats = (y.model.spread < y.line) === (c > 0); }
  games.push({ id: g.game_id, date: g.date, game: `${g.away} at ${g.home}`, score: `${g.away_score}-${g.home_score}`, published: snap.t.slice(0, 16) + 'Z', tip,
    pick, conf: +conf.toFixed(3), won, line: y.line, marketFav: fav, withMarket: fav ? fav === pick : null, ats, ml: y.ml || null });
}
/* the Parlay Builder on the days that had moneylines published: the last snapshot before the day's first tip */
const parlays = [];
for (const day of [...new Set(games.filter(x => x.ml).map(x => x.date))].sort()) {
  const first = finals.filter(g => g.date === day).map(g => new Date(g.tip.replace(/Z$/, ':00Z')).toISOString()).sort()[0];
  const snap = snaps.filter(x => x.t < first).pop(); if (!snap) continue;
  const pool = snap.s.slate.filter(y => y.date === day && y.model && y.ml && y.ml.home != null && y.ml.away != null).map(y => {
    const pick = y.model.pHome >= 0.5 ? y.home : y.away, conf = Math.max(y.model.pHome, 1 - y.model.pHome);
    const hd = 1 / S.amToDec(y.ml.home), ad = 1 / S.amToDec(y.ml.away), ph = hd / (hd + ad);
    return { g: y, pick, conf, tc: S.band(conf)[0], px: { am: pick === y.home ? y.ml.home : y.ml.away, est: false }, mp: pick === y.home ? ph : 1 - ph };
  });
  const r = S.suggest(pool);
  const res = x => { const f = finals.find(g => g.game_id === x.g.id); if (!f) return null; return (x.pick === f.home) === (+f.home_score > +f.away_score); };
  for (const t of r.tiers.concat(r.value ? [r.value] : [])) {
    const rs = t.legs.map(res);
    parlays.push({ day, published: snap.t.slice(0, 16) + 'Z', tier: t.id, legs: t.legs.map(x => `${x.pick} (${x.g.away} at ${x.g.home}) ${x.px.am > 0 ? '+' : ''}${x.px.am}`), chance: +t.p.toFixed(3), odds: +t.dec.toFixed(2),
      result: rs.includes(false) ? 'lost' : rs.includes(null) ? 'pending' : 'won' });
  }
}
const sum = a => ({ n: a.length, won: a.filter(x => x.won).length });
const out = { generated: new Date().toISOString().slice(0, 16) + 'Z', snapshots: snaps.length, gradedGames: games.length,
  straightUp: sum(games), withMarket: sum(games.filter(x => x.withMarket === true)), againstMarket: sum(games.filter(x => x.withMarket === false)),
  ats: { n: games.filter(x => x.ats !== null).length, won: games.filter(x => x.ats === true).length }, games, parlays };
fs.writeFileSync(path.join(ROOT, 'research', 'retro_preseason.json'), JSON.stringify(out, null, 1) + '\n');
console.log(`preseason as published: ${out.straightUp.won}-${out.straightUp.n - out.straightUp.won} straight up over ${games.length} games (${snaps.length} snapshots);`,
  `with the market ${out.withMarket.won}/${out.withMarket.n}, against it ${out.againstMarket.won}/${out.againstMarket.n}; ATS ${out.ats.won}/${out.ats.n}; parlays: ${parlays.map(p => `${p.day} ${p.tier} ${p.result}`).join(', ') || 'none graded yet'}`);
