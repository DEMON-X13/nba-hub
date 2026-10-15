/* DraftKings' NBA player props as ESPN's public feed carries them: one game's answer -> its main lines, its "k+"
 * ladders and its Yes markets. No dependencies, no I/O: the job (tools/props.js, the closing lines it records) and
 * the page (the props view on the Refresh odds press) read the same answer the same way, so the page carries a copy
 * of propParse and its pieces line for line, held to this file by the smoke on recorded answers (tools/fixtures/).
 *
 *   https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/<E>/competitions/<E>/odds/100/propBets
 *     ?lang=en&region=us&limit=1000&page=<n>
 *
 * The answer (provider 100 is DraftKings, the only one ESPN lists for the NBA) is {count, pageIndex, pageSize,
 * pageCount, items}; limit=1000 is honoured, so a game is one page (690 items at most so far), and a reader asks for
 * the next page while pageIndex < pageCount. A 404 whose body says "No propBets found" means DraftKings has posted
 * nothing for the game (yet, or any more). access-control-allow-origin is *, so a browser reads it with a plain GET.
 * Each item carries the market (type id and name), the athlete (a $ref ending /athletes/<id>: ESPN's athlete id,
 * which is this hub's player id everywhere), the line (current.target.value) and DraftKings' American price
 * (odds.american.value, a string such as "-112", "+117" or "EVEN"). There is no Over/Under field and no DraftKings
 * outcome id on a player item; lastUpdated runs about three hours ahead of UTC while labelled Z, so nothing here
 * reads it (a read is dated by the reader's clock).
 *
 * The rules (the scoping study of 15 October 2026, 48,106 items):
 *   - A main line comes as two adjacent items with the same market, athlete and line: the FIRST is the Over. On the
 *     8,569 archived pairs with a "k+" rung at line + 0.5 (the same bet as the Over), the first item's price was the
 *     nearer one 96.8% of the time and 3,162 of 3,162 where the two sides are 8 or more points of implied chance
 *     apart; settled on the box scores, reading the first as the Over gives a log loss of 0.680, the other way 0.729.
 *   - The cross-check: a pair the rung at line + 0.5 contradicts is dropped. Contradicts = the rung's implied chance
 *     is within 10 points of one side (so it can be the same bet: the archive keeps a few junk rungs 15+ points off),
 *     nearer the second item than the first, and the pair's two sides are at least 3 points apart (closer than that
 *     a rung cannot tell them apart, which is where the 3.2% of misses sit).
 *   - A market, athlete and line with other than two items, or two items that are not adjacent, is no pair: dropped.
 *   - Where one athlete has two lines for one stat (12 of 12,420 archived), the main line is the one whose two sides
 *     are nearest even; the other is counted as an alternate and dropped.
 *   - A price that is not a number of 100 or more either way (or EVEN) is no price; a line that is not a number is
 *     no line. Milestones ("k+") are a Yes price on reaching k; double-double and triple-double a Yes price.
 * Team markets, quarters, halves, first basket and the like are left out.
 */
'use strict';

const PROP_URL = (e, page) => `https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${e}/competitions/${e}/odds/100/propBets?lang=en&region=us&limit=1000&page=${page}`;
/* market type id -> this hub's stat code (pts points, reb rebounds, ast assists, tpm threes made, stl steals, blk
   blocks, pra points + rebounds + assists, pr points + rebounds, pa points + assists, ar assists + rebounds, sb steals
   + blocks) */
const PROP_MAIN = { 1: 'pts', 2: 'ast', 3: 'reb', 4: 'tpm', 5: 'stl', 6: 'blk', 87: 'pa', 88: 'pr', 89: 'ar', 90: 'pra', 91: 'sb' };
const PROP_MILE = { 218: 'pts', 219: 'ast', 220: 'reb', 221: 'tpm', 222: 'stl', 223: 'blk', 225: 'pra', 226: 'pa', 227: 'pr' };
const PROP_YES = { 92: 'dd', 93: 'td' };
const PROP_STATS = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'];

/* "+117" -> 117, "-112" -> -112, "EVEN" -> 100; anything else (OFF, blank, |n| under 100) -> null */
function propAmerican(v) {
  if (v == null) return null;
  const t = String(v).trim().toUpperCase();
  if (t === 'EVEN' || t === 'EV') return 100;
  if (!/^[+-]?\d+$/.test(t)) return null;
  const n = parseInt(t, 10);
  return Math.abs(n) >= 100 ? n : null;
}
const propImplied = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100);
const propAthlete = it => { const m = /\/athletes\/(\d+)/.exec(String(((it && it.athlete) || {}).$ref || '')); return m ? m[1] : ''; };
const propLine = it => { const v = it && it.current && it.current.target ? it.current.target.value : null; return typeof v === 'number' && Number.isFinite(v) ? v : (v != null && v !== '' && Number.isFinite(+v) ? +v : null); };
const propTypeId = it => { const id = it && it.type ? parseInt(it.type.id, 10) : NaN; return Number.isFinite(id) ? id : null; };
const propPrice = it => propAmerican(it && it.odds && it.odds.american ? it.odds.american.value : null);

/* one answer's pages -> their items in the feed's order, or null when an answer is not a propBets page */
function propItems(pages) {
  const out = [];
  for (const p of pages || []) {
    if (!p || typeof p !== 'object' || !Array.isArray(p.items)) return null;
    for (const it of p.items) out.push(it);
  }
  return out;
}

/* items (every page, in order) -> { mains, ladders, yes, dropped }
     mains:   [{ player, stat, line, over, under }]   one a player and stat: the main line, DraftKings' two prices
     ladders: [{ player, stat, k, price }]            a Yes price on reaching k ("k+"), k ascending within a player and stat
     yes:     [{ player, market, price }]             market dd (double-double) or td (triple-double)
     dropped: counts of what was left out and why (unpaired, contradicted, alternate, noPrice) */
function propParse(items) {
  const dropped = { unpaired: 0, contradicted: 0, alternate: 0, noPrice: 0 };
  const mains = [], ladders = [], yes = [];
  const groups = new Map(), rung = new Map();
  (items || []).forEach((it, i) => {
    const id = propTypeId(it), player = propAthlete(it);
    if (id == null || !player) return;
    if (PROP_MAIN[id]) {
      const line = propLine(it);
      if (line == null) { dropped.unpaired++; return; }
      const key = id + '|' + player + '|' + line;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key).push({ i, it });
    } else if (PROP_MILE[id]) {
      const k = propLine(it), price = propPrice(it);
      if (k == null || price == null || k < 1 || k !== Math.round(k)) { dropped.noPrice++; return; }
      const key = PROP_MILE[id] + '|' + player + '|' + k;
      if (rung.has(key)) return;                                  // a rung listed twice keeps its first price
      rung.set(key, price);
      ladders.push({ player, stat: PROP_MILE[id], k, price });
    } else if (PROP_YES[id]) {
      const price = propPrice(it);
      if (price == null) { dropped.noPrice++; return; }
      if (yes.some(y => y.player === player && y.market === PROP_YES[id])) return;
      yes.push({ player, market: PROP_YES[id], price });
    }
  });
  /* main lines: exactly two adjacent items, the first the Over; then the rung cross-check; then one line a stat */
  const cand = new Map();
  for (const [key, g] of groups) {
    const [id, player, line] = key.split('|');
    if (g.length !== 2 || g[1].i !== g[0].i + 1) { dropped.unpaired += g.length; continue; }
    const over = propPrice(g[0].it), under = propPrice(g[1].it);
    if (over == null || under == null) { dropped.noPrice++; continue; }
    const stat = PROP_MAIN[id], ln = +line;
    const r = rung.get(stat + '|' + player + '|' + (ln + 0.5));
    if (r != null) {
      const io = propImplied(over), iu = propImplied(under), ir = propImplied(r);
      const dO = Math.abs(ir - io), dU = Math.abs(ir - iu);
      if (Math.min(dO, dU) <= 0.10 && dU < dO && Math.abs(io - iu) >= 0.03) { dropped.contradicted++; continue; }
    }
    const k2 = stat + '|' + player;
    if (!cand.has(k2)) cand.set(k2, []);
    cand.get(k2).push({ player, stat, line: ln, over, under });
  }
  for (const list of cand.values()) {
    list.sort((a, b) => Math.abs(propImplied(a.over) - propImplied(a.under)) - Math.abs(propImplied(b.over) - propImplied(b.under)) || a.line - b.line);
    mains.push(list[0]);
    dropped.alternate += list.length - 1;
  }
  const order = s => PROP_STATS.indexOf(s);
  mains.sort((a, b) => a.player < b.player ? -1 : a.player > b.player ? 1 : order(a.stat) - order(b.stat));
  ladders.sort((a, b) => a.player < b.player ? -1 : a.player > b.player ? 1 : order(a.stat) - order(b.stat) || a.k - b.k);
  yes.sort((a, b) => a.player < b.player ? -1 : a.player > b.player ? 1 : a.market < b.market ? -1 : 1);
  return { mains, ladders, yes, dropped };
}

/* DraftKings' fair chance of the Over on a main line, from its two prices. The method is the one that scored best
   on the 83 archived 2026 play-in and playoff games (tools/props.js market, README "Player props"): the whole
   margin on the Over, so the fair Over is 1 minus the Under's implied chance. Overs are the side the book shades on
   player props (archived Overs hit 45.9% where the two prices split evenly said 49.0%) */
function propFairOver(over, under) {
  if (over == null || under == null) return null;
  return 1 - propImplied(under);
}

/* A "k+" rung's or a Yes market's fair chance, estimated from its one price (README "Player props"; the constants are
   in state.json's props.fair, measured on the archive): a rung carries a margin about `a` points of chance over the
   main line's fair Over, flat from 30% to 70% and scaled toward 0 and 1 beyond; a double- or triple-double's Yes price
   is its fair chance times c. Both are estimates: the page marks them est. */
function propFairRung(price, a) {
  if (price == null || !(a >= 0)) return null;
  const I = propImplied(price);
  const f = I < 0.3 ? I * (1 - a / 0.3) : I <= 0.7 ? I - a : 1 - (1 - I) * (1 + a / 0.3);
  return Math.min(1, Math.max(0, f));
}
function propFairYes(price, c) { return price == null || !(c > 0) ? null : Math.min(1, propImplied(price) / c); }

/* Read one game's answer, every page, with getJSON(url) (it throws Error('HTTP <code> ...') on a refusal, as
   lib.getJSON does). Returns { status: 'ok', items } | { status: 'none' } (a 404: nothing posted) |
   { status: 'failed', error } (any other refusal, a timeout, or an answer that is not a propBets page). */
async function propRead(espnId, getJSON) {
  const pages = [];
  for (let page = 1; page <= 20; page++) {
    let j;
    try { j = await getJSON(PROP_URL(espnId, page)); } catch (e) {
      const m = /HTTP (\d{3})/.exec(String(e && e.message || e));
      if (m && m[1] === '404' && page === 1) return { status: 'none' };
      return { status: 'failed', error: String(e && e.message || e) };
    }
    if (!j || typeof j !== 'object' || !Array.isArray(j.items)) {
      if (page === 1 && j && j.error && +j.error.code === 404) return { status: 'none' };
      return { status: 'failed', error: 'not a propBets answer' };
    }
    pages.push(j);
    const count = +j.pageCount || 1;
    if (page >= count) break;
  }
  return { status: 'ok', items: propItems(pages) };
}

module.exports = { PROP_URL, PROP_MAIN, PROP_MILE, PROP_YES, PROP_STATS, propAmerican, propImplied, propAthlete, propLine, propTypeId, propPrice, propItems, propParse, propFairOver, propFairRung, propFairYes, propRead };
