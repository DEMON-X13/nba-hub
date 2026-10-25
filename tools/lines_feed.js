/* DraftKings' game lines as ESPN's scoreboard carries them: one event -> its moneylines, its spread and its total, each
 * with DraftKings' two prices, and each outcome's betslip id. No dependencies but props_feed.js's price reader, no I/O:
 * the job (tools/lines.js, which publishes lines.json) and the page (Refresh odds, your parlay) read an answer the same
 * way. The page carries oddsDkHref, oddsIdOk and oddsGameLines below line for line (they are its own text, copied here
 * whole, names and all), and the smoke holds the copies to this file, the text and the results on the recorded answers
 * in tools/fixtures/ (SMOKE_ONLY=lines).
 *
 * The rules are the page's (README "The lines feed"):
 *   - Only DraftKings' odds object (provider 100) is read: another book's gives nothing.
 *   - The moneylines are the scoreboard parse's own (tools/fetch.js parseDay's home_ml and away_ml), both or neither.
 *   - The spread is taken only on the number the parse took (its home_line, from the odds' details) with the away side
 *     on its negative, and the total only with its Over and Under on one number, the parse's total; each with both of
 *     DraftKings' prices, so a side is never priced beside a stale other.
 *   - A betslip id is read from ESPN's link (the gateway's preurl names the event and the outcome) and kept only in its
 *     outcome's shape naming its own number (0ML<n>_1 home, _3 away; 0HC<n>N150_1 the home side at -1.5; 0OU<n>O22150_1
 *     the Over 221.5), so an id left from an older number never goes on a slip at the wrong line. Player props carry no
 *     id on ESPN's feed.
 */
'use strict';
const { propAmerican } = require('./props_feed');

/* DraftKings' betslip id on one of ESPN's links: the gateway's preurl names the event and the outcome; only the two
   are kept, never the gateway (it carries ESPN's tags). Not a URL, or not DraftKings': none */
function oddsDkHref(href) {
  try {
    if (typeof href !== 'string' || !href) return null;
    let u = new URL(href);
    const pre = u.searchParams.get('preurl');
    if (pre) u = new URL(pre);
    if (!/(^|\.)draftkings\.com$/i.test(u.hostname)) return null;
    const ev = /\/event\/(\d+)/.exec(u.pathname), id = u.searchParams.get('outcomes');
    return { event: ev ? ev[1] : null, id: id || null };
  } catch (e) { return null; }
}
/* an id is kept only in its outcome's shape and naming this line's own number (a spread's N150 is -1.5 and P150 +1.5,
   a total's O22150 the Over 221.5), so an id left from an older number never goes on a slip at the wrong line */
function oddsIdOk(kind, side, id, line) {
  if (typeof id !== 'string') return false;
  const end = side === 'home' || side === 'over' ? 1 : 3;
  let m;
  if (kind === 'ml') return !!(m = /^0ML\d+_([13])$/.exec(id)) && +m[1] === end;
  if (kind === 'spread') return !!(m = /^0HC\d+([NP])(\d+)_([13])$/.exec(id)) && +m[3] === end && (m[1] === 'N' ? -1 : 1) * +m[2] / 100 === line;
  if (kind === 'total') return !!(m = /^0OU\d+([OU])(\d+)_([13])$/.exec(id)) && +m[3] === end && m[1] === (side === 'over' ? 'O' : 'U') && +m[2] / 100 === line;
  return false;
}
/* one event's DraftKings game lines for your parlay: the moneylines the parse took (the page's), the spread and the
   total with their own two prices, each only where its number is the one the page shows, and each outcome's betslip id
   where ESPN's link carries one. Not DraftKings' odds: none */
function oddsGameLines(e, r) {
  const c = e && e.competitions && e.competitions[0], o = c && (c.odds || [])[0];
  if (!o || !(String((o.provider || {}).id) === '100' || /^draft\s*kings$/i.test(String((o.provider || {}).name || '')))) return null;
  const at = x => x && (x.close || x.current) || null, link = x => { const k = at(x); return k && k.link ? oddsDkHref(k.link.href) : null; };
  const out = { event: null };
  const evl = oddsDkHref(o.link && o.link.href); if (evl && evl.event) out.event = evl.event;
  const idOf = (kind, side, x, line) => { const h = link(x); if (h && h.event && !out.event) out.event = h.event; return h && oddsIdOk(kind, side, h.id, line) ? h.id : null; };
  const ml = o.moneyline || {};
  if (r.home_ml !== '' && r.away_ml !== '') out.ml = { home: { odds: +r.home_ml, id: idOf('ml', 'home', ml.home) }, away: { odds: +r.away_ml, id: idOf('ml', 'away', ml.away) } };
  const ps = o.pointSpread || {}, ph = at(ps.home), pa = at(ps.away);
  if (ph && pa && r.home_line !== '') {
    const hl = parseFloat(ph.line), al = parseFloat(pa.line), ho = propAmerican(ph.odds), ao = propAmerican(pa.odds);
    if (Number.isFinite(hl) && Number.isFinite(al) && hl === +r.home_line && al === -hl && ho != null && ao != null)
      out.spread = { home: { line: hl, odds: ho, id: idOf('spread', 'home', ps.home, hl) }, away: { line: al, odds: ao, id: idOf('spread', 'away', ps.away, al) } };
  }
  const tt = o.total || {}, tov = at(tt.over), tun = at(tt.under);
  if (tov && tun && r.total !== '') {
    const lo = parseFloat(String(tov.line).replace(/^[ou]/i, '')), lu = parseFloat(String(tun.line).replace(/^[ou]/i, '')), oo = propAmerican(tov.odds), uo = propAmerican(tun.odds);
    if (Number.isFinite(lo) && lo === lu && lo === +r.total && oo != null && uo != null)
      out.total = { line: lo, over: { odds: oo, id: idOf('total', 'over', tt.over, lo) }, under: { odds: uo, id: idOf('total', 'under', tt.under, lo) } };
  }
  return out.ml || out.spread || out.total ? out : null;
}

/* oddsGameLines' answer -> a game's lines as lines.json keeps them: the prices first (spread.line is the home side's
   number, the away side's its negative), then every betslip id apart; each null where DraftKings posted none or the
   answer named another number, and ids null where there is not one */
function linesOf(gl) {
  const ml = gl && gl.ml, sp = gl && gl.spread, tt = gl && gl.total;
  const ids = gl ? { event: gl.event || null, ml: ml ? { home: ml.home.id, away: ml.away.id } : null,
    spread: sp ? { home: sp.home.id, away: sp.away.id } : null, total: tt ? { over: tt.over.id, under: tt.under.id } : null } : null;
  const any = ids && (ids.event || [ids.ml, ids.spread, ids.total].some(x => x && Object.values(x).some(Boolean)));
  return { ml: ml ? { home: ml.home.odds, away: ml.away.odds } : null,
    spread: sp ? { line: sp.home.line, home: sp.home.odds, away: sp.away.odds } : null,
    total: tt ? { line: tt.line, over: tt.over.odds, under: tt.under.odds } : null,
    ids: any ? ids : null };
}
/* and back: a lines.json entry -> the shape oddsGameLines gives (what the page keeps in SG_LINES), or null where the
   entry has no line; linesGl(linesOf(gl)) is gl */
function linesGl(x) {
  if (!x || !(x.ml || x.spread || x.total)) return null;
  const id = (k, s) => (x.ids && x.ids[k] && x.ids[k][s]) || null;
  const out = { event: (x.ids && x.ids.event) || null };
  if (x.ml) out.ml = { home: { odds: x.ml.home, id: id('ml', 'home') }, away: { odds: x.ml.away, id: id('ml', 'away') } };
  if (x.spread) out.spread = { home: { line: x.spread.line, odds: x.spread.home, id: id('spread', 'home') }, away: { line: -x.spread.line, odds: x.spread.away, id: id('spread', 'away') } };
  if (x.total) out.total = { line: x.total.line, over: { odds: x.total.over, id: id('total', 'over') }, under: { odds: x.total.under, id: id('total', 'under') } };
  return out;
}

module.exports = { oddsDkHref, oddsIdOk, oddsGameLines, linesOf, linesGl };
