/* One-off: the market's lines on past games, for the backtest (tools/backtest.js).
 *
 *   node tools/fetch_odds_hist.js [--from 2023 --to 2026] [--budget 90]   (seasons; minutes)
 *
 * ESPN's game summary carries a pickcenter: each provider's moneylines, spread and total on the game, as they
 * stood at the close. For every final regular-season or playoff game with an ESPN id from the first season to the
 * last, this reads it once and writes data/odds_hist.csv, one row per game: the provider used (the first of
 * DraftKings, ESPN BET, consensus, then any, that has both moneylines), both moneylines, the home spread and the
 * total, and the opening numbers where the summary carries them. A game already in the file is not asked again,
 * so a run stopped by its time budget is finished by the next. The first pickcenter read is kept as
 * data/sample_pickcenter.json. Exits 1 only if nothing at all could be read.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const OUT = path.join(L.ROOT, 'data', 'odds_hist.csv');
const COLS = ['game_id', 'season', 'date', 'type', 'provider', 'home_ml', 'away_ml', 'home_line', 'total', 'home_ml_open', 'away_ml_open', 'home_line_open', 'total_open', 'n_providers'];
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const FROM = +opt('--from', 2023), TO = +opt('--to', 2026), BUDGET = +opt('--budget', 90) * 60000;
const PREFER = [/draft\s*kings/i, /espn\s*bet/i, /consensus/i];
const sleep = ms => new Promise(r => setTimeout(r, ms));
const ml = v => { if (v == null || v === '') return ''; if (/^(EVEN|PK)$/i.test(String(v))) return '100'; const n = parseInt(String(v).replace('+', ''), 10); return Number.isFinite(n) && Math.abs(n) >= 100 ? String(n) : ''; };
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? String(n) : ''; };

/* one provider's entry -> its numbers, from whichever form it uses (the older homeTeamOdds.moneyLine, the newer moneyline.home.close.odds) */
function readEntry(e) {
  const side = s => { const o = e[s + 'TeamOdds'] || {}, n = (e.moneyline || {})[s] || {};
    const am = x => x && (x.american ?? x.alternateDisplayValue ?? x.value);
    return { close: ml(o.moneyLine) || ml(am(o.close && o.close.moneyLine)) || ml(am(o.current && o.current.moneyLine)) || ml(n.close && n.close.odds) || ml(n.current && n.current.odds),
             open: ml(o.open && o.open.moneyLine && (o.open.moneyLine.american ?? o.open.moneyLine.value)) || ml(n.open && n.open.odds) }; };
  const h = side('home'), a = side('away');
  const sp = e.pointSpread || {}, tot = e.total || {};
  const line = num(e.spread) || num(sp.home && sp.home.close && sp.home.close.line);
  const lineOpen = num(sp.home && sp.home.open && sp.home.open.line) || num(e.homeTeamOdds && e.homeTeamOdds.open && e.homeTeamOdds.open.pointSpread && (e.homeTeamOdds.open.pointSpread.american ?? e.homeTeamOdds.open.pointSpread.value));
  const t = num(e.overUnder) || num(tot.over && tot.over.close && String(tot.over.close.line || '').replace(/^[ou]/i, ''));
  const tOpen = num(tot.over && tot.over.open && String(tot.over.open.line || '').replace(/^[ou]/i, '')) || num(e.open && e.open.total && (e.open.total.american ?? e.open.total.value));
  return { provider: (e.provider && e.provider.name) || '', home_ml: h.close, away_ml: a.close, home_line: line, total: t, home_ml_open: h.open, away_ml_open: a.open, home_line_open: lineOpen, total_open: tOpen };
}
function pick(entries) {
  const read = entries.map(readEntry);
  for (const re of PREFER) { const r = read.find(x => re.test(x.provider) && x.home_ml && x.away_ml); if (r) return r; }
  return read.find(x => x.home_ml && x.away_ml) || read.find(x => x.home_line) || null;
}

function readOut() {
  if (!fs.existsSync(OUT)) return new Map();
  const lines = fs.readFileSync(OUT, 'utf8').trim().split('\n'); const head = lines.shift().split(',');
  return new Map(lines.filter(Boolean).map(l => { const v = l.split(','); const o = {}; head.forEach((h, i) => { o[h] = v[i] ?? ''; }); return [o.game_id, o]; }));
}
function writeOut(map) {
  const rows = [...map.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : 1);
  fs.writeFileSync(OUT, [COLS.join(',')].concat(rows.map(r => COLS.map(c => String(r[c] ?? '').replace(/,/g, ' ')).join(','))).join('\n') + '\n');
}

async function main() {
  const started = Date.now();
  const have = readOut();
  /* a game already in the file with its moneylines is done; one written with none is asked again (the core feed below) */
  const done = id => { const r = have.get(id); return r && r.home_ml && r.away_ml; };
  const games = L.readGames().filter(g => g.status === 'final' && g.type !== 'PRE' && +g.season >= FROM && +g.season <= TO && g.espn_id && !done(g.game_id));
  L.log(`${games.length} games to read (${have.size} already in the file), seasons ${FROM}-${TO}`);
  let read = 0, empty = 0, failed = 0, core = 0, sampled = fs.existsSync(path.join(L.ROOT, 'data', 'sample_pickcenter.json'));
  let coreSampled = fs.existsSync(path.join(L.ROOT, 'data', 'sample_core_odds.json'));
  /* the core feed lists the providers' odds; an item may be only a $ref to follow */
  async function coreOdds(id) {
    try {
      const j = await L.getJSON(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${id}/competitions/${id}/odds?limit=50`);
      if (!coreSampled) { coreSampled = true; fs.writeFileSync(path.join(L.ROOT, 'data', 'sample_core_odds.json'), JSON.stringify(j, null, 1).slice(0, 200000) + '\n'); }
      const out = [];
      for (const it of (j.items || []).slice(0, 12)) {
        if (it.provider || it.homeTeamOdds || it.details) out.push(it);
        else if (it.$ref) { try { out.push(await L.getJSON(String(it.$ref).replace(/^http:/, 'https:'))); } catch (e) {} }
      }
      return out;
    } catch (e) { return []; }
  }
  const queue = games.slice();
  async function worker() {
    while (queue.length) {
      if (Date.now() - started > BUDGET) return;
      const g = queue.shift();
      try {
        const j = await L.getJSON(`https://site.api.espn.com/apis/site/v2/sports/basketball/nba/summary?event=${g.espn_id}`);
        let pc = j.pickcenter || [];
        if (!sampled && pc.length) { sampled = true; fs.writeFileSync(path.join(L.ROOT, 'data', 'sample_pickcenter.json'), JSON.stringify(pc, null, 1) + '\n'); }
        let p = pick(pc);
        /* the summary has no pickcenter for 2023-24, 2024-25 and the autumn of 2025: ESPN's core feed keeps each
           event's odds from the providers, which may carry them */
        if (!p || !p.home_ml) {
          const items = await coreOdds(g.espn_id);
          const q = pick(items); if (q && (q.home_ml || !p)) { p = q; pc = items; core++; }
        }
        have.set(g.game_id, { game_id: g.game_id, season: g.season, date: g.date, type: g.type, n_providers: pc.length, ...(p || { provider: '' }) });
        if (p) read++; else empty++;
      } catch (e) { failed++; if (failed <= 10) L.log(`${g.game_id}: ${e.message}`); }
      if ((read + empty) % 250 === 0 && read + empty) { L.log(`${read + empty} read (${empty} with no lines), ${failed} failed`); writeOut(have); }
      await sleep(120);
    }
  }
  await Promise.all([worker(), worker(), worker()]);
  writeOut(have);
  const left = queue.length;
  L.log(`odds history: ${read} games with lines (${core} from the core feed), ${empty} with none, ${failed} failed, ${left} left for the next run; ${have.size} in the file`);
  if (!read && !empty && games.length) process.exit(1);
}
module.exports = { readEntry, pick };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
