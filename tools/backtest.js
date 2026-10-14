/* Backtest: the model and the Parlay Builder's suggestions against the market, on seasons the model never saw.
 *
 *   node tools/backtest.js          needs data/odds_hist.csv (tools/fetch_odds_hist.js); writes research/backtest.json
 *
 * The model's number on each game is the player model's pre-game chance, replayed with the walk-forward
 * parameters in research.json: each season on the parameters fitted on the seasons before it alone (2023-24 on
 * 2022-23's, 2024-25 on 2022-24's, 2025-26 on 2022-25's), so no season is called by parameters that saw it. Two lineups bound
 * what the site sees: "known" (the players who did play, on their projected minutes: a perfect injury report)
 * and "prior" (the previous game's lineup: no report at all). The site runs on the day's injury report,
 * between the two.
 *
 * The market is the closing line from ESPN's game summaries (DraftKings first). Its chance is the two
 * moneylines with the book's cut taken out. The suggested parlays are built by the page's own code: the
 * suggestion functions are lifted out of app/nba_hub.html and run unchanged on each day's games, on the
 * default band (ALL), and graded as DraftKings would: every leg must win, paid at the product of the
 * legs' closing prices. Units are per $1 staked.
 *
 * Each odds row is held to tools/fetch_odds_hist.js's check(): in-game prices are not a closing line and the game
 * is left out; a spread whose favourite is not the moneyline's, or an impossible total, is left out of the ATS or
 * the over/under count alone. A game priced as a pick'em (equal moneylines) has no market side, so the model's
 * pick there is counted apart from its picks with and against the market. research/backtest_games.csv carries
 * every game with which of its numbers were used, so the summary can be worked out from it alone.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const vm = require('vm');
const L = require('./lib');
const E = require('./elo');
const PM = require('./players');
const { check } = require('./fetch_odds_hist');

const ROOT = L.ROOT;
const OUT = path.join(ROOT, 'research', 'backtest.json');
const SEASONS = [2024, 2025, 2026];

/* ---------- the page's own suggestion code, run as is ---------- */
function pageSuggest() {
  const html = fs.readFileSync(path.join(ROOT, 'app', 'nba_hub.html'), 'utf8');
  const grab = (startRe, endRe) => { const a = html.search(startRe); const b = html.slice(a).search(endRe); if (a < 0 || b < 0) throw new Error('page code not found: ' + startRe); return html.slice(a, a + b); };
  const code = [
    grab(/const amToDec = /, /\n/),
    grab(/const band = c => /, /\n/),
    grab(/const BK_TIERS = /, /\n\/\* ---------- the Bet Build/),
  ].join('\n') + '\n;({ suggest, band, amToDec, VALUE_EDGE });';
  return vm.runInNewContext(code, {});
}

function readCsv(f) {
  if (!fs.existsSync(f)) return [];
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n'); const h = lines.shift().split(',');
  return lines.filter(Boolean).map(l => { const v = l.split(','); const o = {}; h.forEach((k, i) => { o[k] = v[i] ?? ''; }); return o; });
}

/* the replay's pre-game numbers for every final it scores, zipped back onto the games in the replay's own order */
function modelNumbers(P, mode, ctx) {
  const R = PM.replay(P, ctx, mode, true);
  const scored = ctx.games.filter(g => g.status === 'final' && ctx.boxes[g.game_id] && ctx.boxes[g.game_id][g.home] && ctx.boxes[g.game_id][g.away] && g.season > PM.WARM_TO);
  if (scored.length !== R.recs.length) throw new Error(`replay scored ${R.recs.length} games, expected ${scored.length}`);
  const out = {};
  scored.forEach((g, i) => {
    const r = R.recs[i];
    if (r.season !== g.season || r.mov !== +g.home_score - +g.away_score) throw new Error('replay order does not match the games at ' + g.game_id);
    out[g.game_id] = { pHome: r.pHome, spread: -r.d / ctx.situP.scale, total: r.expTotal };
  });
  return out;
}

function main() {
  const S = pageSuggest();
  const research = JSON.parse(fs.readFileSync(path.join(ROOT, 'research.json'), 'utf8'));
  const situP = JSON.parse(fs.readFileSync(path.join(ROOT, 'model.json'), 'utf8')).params;
  const games = L.readGames().filter(g => +g.season >= PM.FIRST && g.status === 'final' && g.type !== 'PRE');
  games.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  const ctx = { games, boxes: PM.loadBoxes(), teamStats: PM.loadTeamBoxes(), coachOf: PM.loadCoaches(), raptor: PM.loadRaptor(), situP, teamDiff: {} };
  ctx.liveLineup = PM.makeLiveLineup(ctx);
  const all = L.readGames().filter(g => g.status === 'final' && g.type !== 'PRE'); all.forEach(g => { g.season = +g.season; g.neutral = +g.neutral; });
  for (const r of E.replay(situP, all, true).recs) ctx.teamDiff[`${r.season}_${r.date.replace(/-/g, '')}_${r.away}_${r.home}`] = r.d;

  const odds = Object.fromEntries(readCsv(path.join(ROOT, 'data', 'odds_hist.csv')).map(r => [r.game_id, r]));
  const byId = Object.fromEntries(games.map(g => [g.game_id, g]));
  const fold = s => research.folds.find(f => f.season === s);
  const report = { generated: new Date().toISOString().slice(0, 16) + 'Z', seasons: {}, notes: [] };

  const rowsOut = [];
  for (const mode of ['known', 'naive']) {
    const nums = {};
    for (const s of SEASONS) { const f = fold(s); if (!f) throw new Error('no walk-forward fold for ' + s); Object.assign(nums, Object.fromEntries(Object.entries(modelNumbers(f.params, mode, ctx)).filter(([id]) => byId[id].season === s))); }
    for (const g of games) if (SEASONS.includes(g.season) && nums[g.game_id]) { const o = odds[g.game_id] || {}, m = nums[g.game_id];
      const c = check(o);
      rowsOut.push([g.game_id, g.season, g.date, g.type, mode, g.away, g.home, g.away_score, g.home_score, m.pHome.toFixed(6), m.spread.toFixed(4), m.total.toFixed(4), o.provider || '', o.home_ml || '', o.away_ml || '', o.home_line || '', o.total || '', +c.ml, +(c.ml && c.line), +(c.ml && c.total)].join(',')); }
    for (const s of SEASONS) {
      const key = `${s}:${mode}`;
      const gs = games.filter(g => g.season === s && nums[g.game_id]);
      const priced = gs.filter(g => odds[g.game_id] && check(odds[g.game_id]).ml);   // in-game prices are not a closing line
      /* ---- the model against the market, game by game ---- */
      let n = 0, mHit = 0, kHit = 0, llM = 0, llK = 0, brM = 0, brK = 0, agree = 0, agreeHit = 0, dis = 0, disHit = 0, disUnits = 0, agreeUnits = 0, pk = 0, pkHit = 0, pkUnits = 0;
      const providers = {};
      let ats = 0, atsW = 0, ou = 0, ouW = 0;
      const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
      for (const g of priced) {
        const o = odds[g.game_id], m = nums[g.game_id];
        const hd = 1 / S.amToDec(+o.home_ml), ad = 1 / S.amToDec(+o.away_ml), mk = hd / (hd + ad);
        const y = +g.home_score > +g.away_score ? 1 : 0;
        n++; mHit += (m.pHome >= 0.5) === (y === 1); kHit += (mk >= 0.5) === (y === 1);
        llM -= Math.log(clip(y ? m.pHome : 1 - m.pHome)); llK -= Math.log(clip(y ? mk : 1 - mk));
        brM += (m.pHome - y) ** 2; brK += (mk - y) ** 2;
        const pick = m.pHome >= 0.5 ? g.home : g.away, pickMk = pick === g.home ? mk : 1 - mk, won = (pick === g.home) === (y === 1);
        const dec = S.amToDec(+(pick === g.home ? o.home_ml : o.away_ml)), u = won ? dec - 1 : -1;
        if (mk === 0.5) { pk++; pkHit += won; pkUnits += u; } else if (pickMk > 0.5) { agree++; agreeHit += won; agreeUnits += u; } else { dis++; disHit += won; disUnits += u; }
        const pv = providers[o.provider] = providers[o.provider] || { games: 0, straightUnits: 0 }; pv.games++; pv.straightUnits += u;
        const c = check(o);
        if (c.line) { const line = +o.home_line, mov = +g.home_score - +g.away_score, cover = mov + line; if (cover !== 0) { ats++; atsW += (m.spread < line) === (cover > 0); } }
        if (c.total) { const tl = +o.total, tot = +g.home_score + +g.away_score; if (tot !== tl) { ou++; ouW += (m.total > tl) === (tot > tl); } }
      }
      /* ---- the Parlay Builder's suggestions, day by day, by the page's own code ---- */
      if (!n) { report.seasons[key] = { season: s, lineup: mode, games: gs.length, priced: 0 }; L.log(`${key}: no closing lines`); continue; }
      const days = [...new Set(priced.map(g => g.date))].sort();
      const tiers = {}; const add = (id, t, won) => { const a = tiers[id] = tiers[id] || { parlays: 0, won: 0, expMarket: 0, expModel: 0, units: 0, legs: 0, days: 0 };
        a.parlays++; a.won += won; a.expMarket += t.p; a.expModel += t.pModel ?? t.legs.reduce((q, x) => q * x.conf, 1); a.units += won ? t.dec - 1 : -1; a.legs += t.legs.length; };
      const straight = { bets: 0, won: 0, units: 0 };
      for (const d of days) {
        const pool = priced.filter(g => g.date === d).map(g => {
          const o = odds[g.game_id], m = nums[g.game_id], pick = m.pHome >= 0.5 ? g.home : g.away, conf = Math.max(m.pHome, 1 - m.pHome);
          const hd = 1 / S.amToDec(+o.home_ml), ad = 1 / S.amToDec(+o.away_ml), ph = hd / (hd + ad);
          return { g, pick, conf, tc: S.band(conf)[0], px: { am: +(pick === g.home ? o.home_ml : o.away_ml), est: false }, mp: pick === g.home ? ph : 1 - ph };
        });
        const won = x => (x.pick === x.g.home) === (+x.g.home_score > +x.g.away_score);
        const r = S.suggest(pool);
        for (const t of r.tiers) add(t.id, t, t.legs.every(won));
        if (r.value) add('value', r.value, r.value.legs.every(won));
        for (const x of pool) { straight.bets++; straight.won += won(x); straight.units += won(x) ? S.amToDec(x.px.am) - 1 : -1; }
      }
      for (const t of Object.values(tiers)) { t.avgLegs = +(t.legs / t.parlays).toFixed(2); delete t.legs; delete t.days; t.expMarket = +t.expMarket.toFixed(1); t.expModel = +t.expModel.toFixed(1); t.units = +t.units.toFixed(2); t.roi = +(t.units / t.parlays).toFixed(3); }
      report.seasons[key] = {
        season: s, lineup: mode, games: gs.length, priced: n, days: days.length,
        straightUp: { model: +(mHit / n).toFixed(4), market: +(kHit / n).toFixed(4) },
        logloss: { model: +(llM / n).toFixed(4), market: +(llK / n).toFixed(4) }, brier: { model: +(brM / n).toFixed(4), market: +(brK / n).toFixed(4) },
        modelPicks: { withMarket: { n: agree, won: agreeHit, rate: +(agreeHit / agree).toFixed(4), units: +agreeUnits.toFixed(2) }, againstMarket: { n: dis, won: disHit, rate: dis ? +(disHit / dis).toFixed(4) : null, units: +disUnits.toFixed(2) },
          pickem: { n: pk, won: pkHit, rate: pk ? +(pkHit / pk).toFixed(4) : null, units: +pkUnits.toFixed(2) } },
        providers: Object.fromEntries(Object.entries(providers).map(([k, v]) => [k, { games: v.games, straightUnits: +v.straightUnits.toFixed(2) }])),
        ats: { n: ats, won: atsW, rate: ats ? +(atsW / ats).toFixed(4) : null }, overUnder: { n: ou, won: ouW, rate: ou ? +(ouW / ou).toFixed(4) : null },
        straight: { ...straight, units: +straight.units.toFixed(2), roi: +(straight.units / straight.bets).toFixed(3) },
        parlays: tiers,
      };
      L.log(`${key}: ${n} priced of ${gs.length} | SU model ${(mHit / n * 100).toFixed(1)}% market ${(kHit / n * 100).toFixed(1)}% | logloss ${(llM / n).toFixed(4)} vs ${(llK / n).toFixed(4)} | with market ${agreeHit}/${agree}, against ${disHit}/${dis} | ATS ${atsW}/${ats} | ` +
        Object.entries(tiers).map(([k, t]) => `${k} ${t.won}/${t.parlays} (mkt ${t.expMarket}) ${t.units >= 0 ? '+' : ''}${t.units}u`).join(' | '));
    }
  }
  /* the games the model scored that the summary leaves out, and why; a final it did not score (no box score for a
     side) is not in either count */
  const scoredIds = new Set(rowsOut.map(r => r.split(',')[0]));
  const inSeasons = games.filter(g => SEASONS.includes(g.season));
  const noRow = inSeasons.filter(g => scoredIds.has(g.game_id) && !(odds[g.game_id] && odds[g.game_id].home_ml));
  const inGame = inSeasons.filter(g => scoredIds.has(g.game_id) && odds[g.game_id] && odds[g.game_id].home_ml && !check(odds[g.game_id]).ml);
  const unscored = inSeasons.filter(g => !scoredIds.has(g.game_id));
  const badLine = inSeasons.filter(g => scoredIds.has(g.game_id) && odds[g.game_id] && check(odds[g.game_id]).ml && !check(odds[g.game_id]).line);
  const badTotal = inSeasons.filter(g => scoredIds.has(g.game_id) && odds[g.game_id] && check(odds[g.game_id]).ml && !check(odds[g.game_id]).total);
  const list = a => a.map(g => g.game_id).join(' ');
  if (noRow.length) report.notes.push(`${noRow.length} games have no closing moneylines in data/odds_hist.csv and are left out: ${list(noRow)}.`);
  if (inGame.length) report.notes.push(`${inGame.length} games carry only in-game prices (a live book) and are left out: ${list(inGame)}.`);
  if (badLine.length) report.notes.push(`${badLine.length} games have no usable spread (missing, or its favourite not the moneyline's) and are left out of ATS only: ${list(badLine)}.`);
  if (badTotal.length) report.notes.push(`${badTotal.length} games have no usable total and are left out of the over/under only: ${list(badTotal)}.`);
  if (unscored.length) report.notes.push(`${unscored.length} finals the model did not score (a side's box score is missing) are not counted: ${list(unscored)}.`);
  report.notes.push('A pick\'em (equal moneylines) has no market side: the model\'s picks there are counted under modelPicks.pickem, not with or against the market.');
  report.notes.push('The book changes within seasons: DraftKings for the 2024 regular season, ESPN BET for most of its playoffs, ESPN BET for all of 2025, ESPN BET to late November 2025 and DraftKings after. ESPN BET rounds to fives and takes about 1 point more margin on heavy favourites, so its seasons pay favourite-heavy parlays a little less. `providers` gives each season\'s games and straight-bet units by book.');
  report.notes.push('The confidence bands are the page\'s own, on the chance rounded to the whole percent: 54.5% is 55%.');
  const missing = noRow.length + inGame.length;
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  fs.writeFileSync(OUT, JSON.stringify(report, null, 1) + '\n');
  /* every game's numbers, so the summary can be checked from scratch */
  fs.writeFileSync(path.join(ROOT, 'research', 'backtest_games.csv'), 'game_id,season,date,type,lineup,away,home,away_score,home_score,model_p_home,model_home_spread,model_total,provider,home_ml,away_ml,home_line,total,ml_used,line_used,total_used\n' + rowsOut.join('\n') + '\n');
  L.log(`research/backtest.json written${missing ? ` (${missing} games without lines left out)` : ''}`);
}
if (require.main === module) main();
module.exports = { pageSuggest };
