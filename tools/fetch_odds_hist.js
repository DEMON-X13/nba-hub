/* One-off: the market's lines on past games, for the backtest (tools/backtest.js).
 *
 *   node tools/fetch_odds_hist.js [--from 2023 --to 2026] [--budget 90]   (seasons; minutes)
 *
 * ESPN's game summary carries a pickcenter: each provider's moneylines, spread and total on the game, as they
 * stood at the close. For every final regular-season or playoff game with an ESPN id from the first season to the
 * last, this reads it once and writes data/odds_hist.csv, one row per game: the provider used (the first of
 * DraftKings, ESPN BET, consensus, then any, that has both moneylines), both moneylines, the home spread and the
 * total, and the opening numbers where the summary carries them. A game already in the file is not asked again,
 * so a run stopped by its time budget is finished by the next. Exits 1 only if nothing at all could be read.
 * The backfill of 2023-2026 is done (data/odds_hist.csv); it is run by hand, from a machine that reaches ESPN, only
 * to add a season. Going forward the daily job keeps each game's closing moneylines in games.csv.
 *
 * In-game prices ("DraftKings - Live Odds") are never taken. The home spread is read from the provider's own
 * line ("CLE -5.5", as tools/fetch.js reads it) before its bare `spread` field, which had the wrong sign on a
 * few 2024 games. A row is checked against itself (check()): a spread whose favourite is not the moneyline's,
 * past a pick'em's noise, or a total no NBA game is posted at, is not written, and a row already in the file
 * that fails the check, or holds in-game prices, is read again.
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
const dec = am => am > 0 ? 1 + am / 100 : 1 + 100 / -am;

/* a row's numbers against each other: the moneylines a closing pair (not in-game), the spread's favourite the
   moneyline's (where they name different favourites, the spread must be within 3 points of the one the moneylines
   imply, about 30 points a unit of chance near a pick'em: -105/-115 against +1.5 is noise, -142 against +2 is not),
   the total one an NBA game is posted at */
function check(r) {
  const out = { ml: !!(r.home_ml && r.away_ml) && !/live/i.test(r.provider || ''), line: r.home_line !== '' && r.home_line != null, total: r.total !== '' && r.total != null };
  if (out.total) { const t = +r.total; out.total = t >= 170 && t <= 290; }
  if (out.line && out.ml && +r.home_line !== 0) {
    const ph = (1 / dec(+r.home_ml)) / (1 / dec(+r.home_ml) + 1 / dec(+r.away_ml)), line = +r.home_line;
    if ((line < 0) !== (ph > 0.5) && ph !== 0.5 && Math.abs(line + 30 * (ph - 0.5)) >= 3) out.line = false;
  }
  return out;
}

/* one provider's entry -> its numbers, from whichever form it uses (the older homeTeamOdds.moneyLine, the newer moneyline.home.close.odds) */
function readEntry(e, homeAb) {
  const side = s => { const o = e[s + 'TeamOdds'] || {}, n = (e.moneyline || {})[s] || {};
    const am = x => x && (x.american ?? x.alternateDisplayValue ?? x.value);
    return { close: ml(o.moneyLine) || ml(am(o.close && o.close.moneyLine)) || ml(am(o.current && o.current.moneyLine)) || ml(n.close && n.close.odds) || ml(n.current && n.current.odds),
             open: ml(o.open && o.open.moneyLine && (o.open.moneyLine.american ?? o.open.moneyLine.value)) || ml(n.open && n.open.odds) }; };
  const h = side('home'), a = side('away');
  const sp = e.pointSpread || {}, tot = e.total || {};
  const m = homeAb && typeof e.details === 'string' && /^([A-Z]+)\s+([-+]?\d+(\.\d+)?)/.exec(e.details.trim());
  const fromDetails = m ? String(L.fromEspn(m[1]) === homeAb ? +m[2] : -m[2]) : homeAb && /^(EVEN|PK)\b/i.test(String(e.details || '').trim()) ? '0' : '';
  const hc = e.homeTeamOdds && e.homeTeamOdds.close && e.homeTeamOdds.close.pointSpread;
  const line = fromDetails || num(hc && (hc.american ?? hc.value)) || num(e.spread) || num(sp.home && sp.home.close && sp.home.close.line);
  const lineOpen = num(sp.home && sp.home.open && sp.home.open.line) || num(e.homeTeamOdds && e.homeTeamOdds.open && e.homeTeamOdds.open.pointSpread && (e.homeTeamOdds.open.pointSpread.american ?? e.homeTeamOdds.open.pointSpread.value));
  const t = num(e.overUnder) || num(tot.over && tot.over.close && String(tot.over.close.line || '').replace(/^[ou]/i, ''));
  const tOpen = num(tot.over && tot.over.open && String(tot.over.open.line || '').replace(/^[ou]/i, '')) || num(e.open && e.open.total && (e.open.total.american ?? e.open.total.value));
  return { provider: (e.provider && e.provider.name) || '', home_ml: h.close, away_ml: a.close, home_line: line, total: t, home_ml_open: h.open, away_ml_open: a.open, home_line_open: lineOpen, total_open: tOpen };
}
function pick(entries, homeAb) {
  const read = entries.map(e => readEntry(e, homeAb)).filter(x => !/live/i.test(x.provider));   // in-game prices are not a closing line
  const clean = x => { const c = check(x); return { ...x, home_line: c.line ? x.home_line : '', total: c.total ? x.total : '' }; };
  for (const re of PREFER) { const r = read.find(x => re.test(x.provider) && x.home_ml && x.away_ml); if (r) return clean(r); }
  const r = read.find(x => x.home_ml && x.away_ml) || read.find(x => x.home_line);
  return r ? clean(r) : null;
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
  /* a game already in the file with its moneylines, a spread and a total that pass check() is done; any other is
     asked again (the core feed below) */
  const done = id => { const r = have.get(id); if (!r) return false; const c = check(r); return c.ml && c.line && c.total; };
  const games = L.readGames().filter(g => g.status === 'final' && g.type !== 'PRE' && +g.season >= FROM && +g.season <= TO && g.espn_id && !done(g.game_id));
  L.log(`${games.length} games to read (${have.size} already in the file), seasons ${FROM}-${TO}`);
  let read = 0, empty = 0, failed = 0, core = 0;
  /* the core feed lists the providers' odds; an item may be only a $ref to follow */
  async function coreOdds(id) {
    try {
      const j = await L.getJSON(`https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${id}/competitions/${id}/odds?limit=50`);
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
        let p = pick(pc, g.home);
        /* the summary has no pickcenter for 2023-24, 2024-25 and the autumn of 2025: ESPN's core feed keeps each
           event's odds from the providers, which may carry them */
        if (!p || !p.home_ml) {
          const items = await coreOdds(g.espn_id);
          const q = pick(items, g.home); if (q && (q.home_ml || !p)) { p = q; pc = items; core++; }
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
module.exports = { readEntry, pick, check };
if (require.main === module) main().catch(e => { console.error(e); process.exit(1); });
