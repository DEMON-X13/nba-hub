/* Tests for the lines feed (tools/lines.js, tools/lines_feed.js), on ESPN answers recorded in tools/fixtures/ and made-up
 * ones, through a stubbed reader and a scratch file: no network, and the real lines.json is never written.
 *
 *   node tools/test_lines.js        must end "all good"
 *
 * 1. the parse: the next two Eastern dates with a game to come and nothing else asked for (one scoreboard a date, one
 *    propBets read a game, by ESPN's id); each game's DraftKings game lines worked out here from the recorded answer on
 *    their own (prices, the spread's number, each betslip id) and as tools/lines_feed.js reads them, and back; opening
 *    night's props as tools/props_feed.js parses them; a 404 as none posted; every entry in the file's shape
 * 2. the drops: a game ESPN calls live, one past its tip by its fresh tip, one that tips during the read, a final, a
 *    preseason game, a game no longer to come in the last file, a junk entry in the last file; another book's odds, a
 *    spread or total on another number, ids naming another number, no odds at all
 * 3. the last good read: a day's scoreboard refused or junk, a game missing from its day's answer, one game's props
 *    refused: each half kept as last read, with its own time, while the rest is read afresh; a half never read is null,
 *    a game never read at all is left out; nothing answering at all leaves the file byte for byte and exits 1
 * 4. the quiet run: the same answers again write nothing (the file's time too); a moved price rewrites that half alone,
 *    with a new time, and the file's
 * 5. the committed lines.json, where there is one, held to the file's shape
 */
'use strict';
const fs = require('fs'), path = require('path'), os = require('os'), cp = require('child_process');
process.env.NBA_FETCH_PAUSE_MS = '0';
const ROOT = path.resolve(__dirname, '..');
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'nba-lines-'));
const FILE = path.join(tmp, 'lines.json');
const F = require('./fetch');
const PF = require('./props_feed');
const LF = require('./lines_feed');
const LN = require('./lines');

let fails = 0; const check = (c, m) => { if (!c) { fails++; console.log('  FAIL', m); } else console.log('  ok  ', m); };
const FIX = path.join(ROOT, 'tools', 'fixtures');
const fix = f => JSON.parse(fs.readFileSync(path.join(FIX, f), 'utf8'));
const clone = x => JSON.parse(JSON.stringify(x));
const SB20 = fix('scoreboard_20261020.json'), SB25 = fix('scoreboard_20261025.json'), SB27 = fix('scoreboard_20261027.json'), PB = fix('propbets_401909088.json');
/* games.csv as fetch.js would have it from the same answers */
const rowsOf = j => F.parseDay(clone(j));
const T = s => new Date(s);
/* a clock that moves a second each time it is read, from `start` */
const ticking = start => { let t = Date.parse(start); return () => new Date((t += 1000) - 1000); };
/* the stubbed reader: `answers` maps a scoreboard date (YYYYMMDD) or an event id (props) to an answer, an Error to
   throw, or a function of the page number; anything else is a 404 */
function reader(answers) {
  const asked = [];
  const get = async url => {
    asked.push(url);
    if (/_=/.test(url)) throw new Error('the stub is handed URLs before their cache-buster');
    let m = /scoreboard\?limit=100&dates=(\d{8})$/.exec(url), a;
    if (m) a = answers[m[1]];
    else if ((m = /events\/(\d+)\/competitions\/\1\/odds\/100\/propBets\?lang=en&region=us&limit=1000&page=(\d+)$/.exec(url))) { a = answers[m[1]]; if (typeof a === 'function') a = a(+m[2]); }
    else throw new Error('HTTP 404 ' + url);
    if (a instanceof Error) throw a;
    if (a === undefined) throw new Error('HTTP 404 ' + url);
    return clone(a);
  };
  return { get, asked };
}
const quiet = () => {};
const go = (games, answers, start, prevFile) => {
  const r = reader(answers);
  return LN.run({ games, get: r.get, clock: ticking(start), log: quiet, file: prevFile || FILE }).then(res => ({ ...res, asked: r.asked, file: fs.existsSync(prevFile || FILE) ? fs.readFileSync(prevFile || FILE, 'utf8') : null }));
};
const readOut = () => JSON.parse(fs.readFileSync(FILE, 'utf8'));
const del = () => { try { fs.unlinkSync(FILE); } catch (e) { /* none */ } };

(async () => {
  console.log('1. the parse, on the recorded answers');
  /* the table: opening night, Sunday 25 October and Tuesday 27 October, read on the morning of opening night */
  const g20 = rowsOf(SB20), g25 = rowsOf(SB25), g27 = rowsOf(SB27), table = [...g20, ...g25, ...g27];
  const answers = { 20261020: SB20, 20261025: SB25, 20261027: SB27, 401909088: PB };
  del();
  let r = await go(table, answers, '2026-10-20T12:00:00Z');
  const sbAsked = r.asked.filter(u => /scoreboard/.test(u)), pbAsked = r.asked.filter(u => /propBets/.test(u)).map(u => /events\/(\d+)/.exec(u)[1]);
  check(JSON.stringify(sbAsked.map(u => u.slice(-8)).sort()) === '["20261020","20261025"]', `one scoreboard request for each of the next two dates with a game to come, and none for the third (${sbAsked.map(u => u.slice(-8)).join(', ')})`);
  check(JSON.stringify(pbAsked.sort()) === JSON.stringify([...g20, ...g25].map(g => g.espn_id).sort()), `one propBets request a game of those two dates, by ESPN's event id (${pbAsked.length})`);
  check(!r.failed && r.written && r.file === LN.stringify(readOut()), 'the file is written, in its own text');
  let out = readOut();
  check(out.v === 1 && Object.keys(out.games).length === 10 && Object.keys(out.games).every(k => [...g20, ...g25].some(g => g.game_id === k)), `it holds the ten games of the two dates (${Object.keys(out.games).length})`);
  check(r.file.split('\n').length === 13 && r.file.split('\n').slice(1, 11).every(l => /^"\d{4}_\d{8}_[A-Z]{3}_[A-Z]{3}":\{"at":/.test(l)), 'one line a game, by game id, so a change is that line\'s diff');
  const bd = out.games['2027_20261020_BOS_DET'];
  check(JSON.stringify(bd.ml) === '{"home":-115,"away":-105}' && JSON.stringify(bd.spread) === '{"line":-1.5,"home":-108,"away":-112}' && JSON.stringify(bd.total) === '{"line":221.5,"over":-115,"under":-105}',
    "Celtics at Pistons: DraftKings' moneylines DET -115 BOS -105, the spread DET -1.5 at -108 / BOS +1.5 at -112, the total 221.5 Over -115 Under -105, as the answer has them");
  check(JSON.stringify(bd.ids) === '{"event":"34510070","ml":{"home":"0ML85841510_1","away":"0ML85841510_3"},"spread":{"home":"0HC85841510N150_1","away":"0HC85841510P150_3"},"total":{"over":"0OU85841510O22150_1","under":"0OU85841510U22150_3"}}',
    "and each outcome's betslip id and the event, from ESPN's DraftKings links");
  /* every game, worked out here from the answer on its own: DraftKings' odds object, its close prices and the ids in the
     links' preurl, each id only where it names its own outcome and number */
  const own = (e, row) => {
    const o = (e.competitions[0].odds || [])[0];
    if (!o || String(o.provider && o.provider.id) !== '100') return { ml: null, spread: null, total: null, ids: null };
    const am = v => { const t = String(v).toUpperCase(); return t === 'EVEN' ? 100 : /^[+-]?\d+$/.test(t) && Math.abs(+t) >= 100 ? +t : null; };
    const idIn = x => { try { const u = new URL(new URL(x.close.link.href).searchParams.get('preurl')); return [/\/event\/(\d+)/.exec(u.pathname)[1], u.searchParams.get('outcomes')]; } catch (err) { return [null, null]; } };
    const ml = row.home_ml && row.away_ml ? { home: +row.home_ml, away: +row.away_ml } : null;
    const hl = parseFloat(o.pointSpread.home.close.line), tl = parseFloat(o.total.over.close.line.slice(1));
    const spread = row.home_line !== '' && hl === +row.home_line ? { line: hl, home: am(o.pointSpread.home.close.odds), away: am(o.pointSpread.away.close.odds) } : null;
    const total = row.total !== '' && tl === +row.total ? { line: tl, over: am(o.total.over.close.odds), under: am(o.total.under.close.odds) } : null;
    const n = x => Math.round(Math.abs(x) * 100);
    const want = { ml: ml && ['ML\\d+', 'ML\\d+'], spread: spread && [`HC\\d+${spread.line < 0 ? 'N' : 'P'}${n(spread.line)}`, `HC\\d+${spread.line > 0 ? 'N' : 'P'}${n(spread.line)}`], total: total && [`OU\\d+O${n(total.line)}`, `OU\\d+U${n(total.line)}`] };
    const side = (k, i) => { const x = k === 'ml' ? o.moneyline[i ? 'away' : 'home'] : k === 'spread' ? o.pointSpread[i ? 'away' : 'home'] : o.total[i ? 'under' : 'over']; const [, id] = idIn(x); return id && new RegExp(`^0${want[k][i]}_${i ? 3 : 1}$`).test(id) ? id : null; };
    const ids = { event: idIn(o.moneyline.home)[0], ml: ml ? { home: side('ml', 0), away: side('ml', 1) } : null, spread: spread ? { home: side('spread', 0), away: side('spread', 1) } : null, total: total ? { over: side('total', 0), under: side('total', 1) } : null };
    return { ml, spread, total, ids };
  };
  const evs = new Map([...SB20.events, ...SB25.events].map(e => [e.id, e]));
  const mine = Object.fromEntries([...g20, ...g25].map(g => [g.game_id, own(evs.get(g.espn_id), g)]));
  const theirs = Object.fromEntries(Object.entries(out.games).map(([k, x]) => [k, { ml: x.ml, spread: x.spread, total: x.total, ids: x.ids }]));
  const off = Object.keys(mine).filter(k => JSON.stringify(mine[k]) !== JSON.stringify(theirs[k]));
  check(!off.length && Object.values(theirs).every(x => x.ml && x.spread && x.total && x.ids.ml.home && x.ids.total.under), `every game's lines and ids are the answer's, worked out here on their own (10 games, all with DraftKings' three lines and their ids)${off.length ? `: differ ${off.join(', ')}` : ''}`);
  check(Object.entries(out.games).every(([k, x]) => { const g = [...g20, ...g25].find(y => y.game_id === k); return JSON.stringify(LF.linesGl(x)) === JSON.stringify(LF.oddsGameLines(evs.get(g.espn_id), g)); }),
    "each is what the page's own reading gives (oddsGameLines, the smoke holds its text to tools/lines_feed.js's), and back again to that shape (linesGl)");
  const P20 = PF.propParse(PB.items);
  check(JSON.stringify(bd.props.mains) === JSON.stringify(P20.mains) && JSON.stringify(bd.props.ladders) === JSON.stringify(P20.ladders) && JSON.stringify(bd.props.yes) === JSON.stringify(P20.yes) && bd.props.mains.length === 16 && bd.props.ladders.length === 138 && bd.props.yes.length === 4,
    `its props are opening night's answer as tools/props_feed.js parses it: ${bd.props.mains.length} main lines, ${bd.props.ladders.length} rungs, ${bd.props.yes.length} Yes prices`);
  check(Object.entries(out.games).filter(([k]) => k !== '2027_20261020_BOS_DET').every(([, x]) => x.props && !x.props.mains.length && !x.props.ladders.length && !x.props.yes.length && /Z$/.test(x.props.at)), 'a game whose props answer 404 ("No propBets found") holds empty lists: none posted yet, dated');
  check(Object.entries(out.games).every(([k, x]) => LN.entryBad(k, x) === null), 'every entry meets the file\'s rules');
  check(Object.values(out.games).every(x => x.espn === [...g20, ...g25].find(g => g.espn_id === x.espn).espn_id) && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(out.at) && Object.values(out.games).every(x => x.at <= out.at && x.props.at <= out.at && x.at >= '2026-10-20T12:00:00Z'),
    'each entry names its ESPN event, and is dated by when its answers came back, before the file\'s own time');

  console.log('1b. made-up answers');
  {
    /* a game with two pages of props, rungs and Yes prices; one with no odds; one with another book's */
    const ev = clone(SB25.events[0]), id = ev.id;
    const page = (items, i, n) => ({ count: 9, pageIndex: i, pageSize: 1000, pageCount: n, items });
    const it = (type, pid, line, price) => ({ athlete: { $ref: `http://x/athletes/${pid}?lang=en` }, type: { id: String(type) }, odds: { american: { value: price } }, current: { target: { value: line } } });
    const p1 = [it(1, '11', 20.5, '-110'), it(1, '11', 20.5, '-120'), it(218, '11', 25, '+150')], p2 = [it(3, '12', 8.5, '+105'), it(3, '12', 8.5, '-135'), it(92, '12', null, '+300'), it(93, '12', null, 'OFF')];
    const noOdds = clone(SB25.events[1]); noOdds.competitions[0].odds = [];
    const other = clone(SB25.events[2]); other.competitions[0].odds[0].provider = { id: '58', name: 'ESPN BET' };
    const sb = { events: [ev, noOdds, other] }, gs = rowsOf(sb);
    del();
    r = await go(gs, { 20261025: sb, [id]: n => page(n === 1 ? p1 : p2, n, 2), [noOdds.id]: page([], 1, 1), [other.id]: new Error('HTTP 404 x') }, '2026-10-25T12:00:00Z');
    out = readOut();
    const a = out.games[gs[0].game_id], b = out.games[gs[1].game_id], c = out.games[gs[2].game_id];
    check(r.asked.filter(u => u.includes(`events/${id}/`)).length === 2 && JSON.stringify(a.props.mains) === JSON.stringify(PF.propParse(p1.concat(p2)).mains) && a.props.mains.length === 2 && a.props.ladders.length === 1 && a.props.yes.length === 1,
      'a game whose props run to two pages is read to the last, and parsed whole (two main lines, a rung, a Yes price; an OFF price dropped)');
    check(b.ml === null && b.spread === null && b.total === null && b.ids === null && /Z$/.test(b.at) && b.props && !b.props.mains.length, 'a game with no odds yet: no line, dated, and an empty props page is none posted');
    check(c.ml === null && c.spread === null && c.total === null && c.ids === null, "another book's odds give no line (DraftKings' only)");
  }

  console.log('1c. the reader');
  {
    /* getJSON on a stubbed fetch: what goes out, and which refusals are tried again */
    const real = globalThis.fetch, calls = [];
    const stub = seq => { let i = 0; globalThis.fetch = async (url, opt) => { calls.push({ url, opt }); const a = seq[Math.min(i++, seq.length - 1)]; if (a instanceof Error) throw a; return { ok: a === 200, status: a, json: async () => ({ events: [] }) }; }; };
    const tryGet = async u => { try { return { j: await LN.getJSON(u) }; } catch (e) { return { e: String(e.message) }; } };
    try {
      stub([503, 200]); calls.length = 0; let x = await tryGet(LN.SB + '20261025');
      check(x.j && calls.length === 2 && calls.every(c => /dates=20261025&_=\d{13}$/.test(c.url) && c.opt.cache === 'no-store' && c.opt.headers === undefined && c.opt.signal), 'a 503 is tried once more; every request is a plain GET with no headers of its own, past any cache (no-store and a cache-buster), with a timeout');
      stub([new TypeError('fetch failed'), 200]); calls.length = 0; x = await tryGet('https://x/y');
      check(x.j && calls.length === 2 && /^https:\/\/x\/y\?_=\d+$/.test(calls[0].url), 'so is a request that never answers or is reset');
      stub([404]); calls.length = 0; x = await tryGet(LN.SB + '20261025');
      check(calls.length === 1 && /^HTTP 404 /.test(x.e), 'a 404 is answered at once, as "HTTP 404" (propRead\'s none posted)');
      stub([503, 503]); calls.length = 0; x = await tryGet(LN.SB + '20261025');
      check(calls.length === 2 && /^HTTP 503 /.test(x.e), 'two refusals are a failed read');
    } finally { globalThis.fetch = real; }
  }

  console.log('2. the drops');
  {
    /* read at 4 PM Eastern, before every game's tip by games.csv: the first game ESPN now calls live (its tip moved
       earlier), the second with ESPN's own tip moved before the clock, a final, a preseason game, and a spread and a
       total on other numbers */
    const sb = clone(SB25), gs = rowsOf(SB25);
    const live = sb.events[0], movedTip = sb.events[1];
    live.competitions[0].status.type = { name: 'STATUS_IN_PROGRESS', completed: false };
    movedTip.date = '2026-10-25T19:00Z';
    const fin = { ...gs[3], status: 'final', away_score: '100', home_score: '101' }, pre = { ...gs[4], type: 'PRE' };
    const spreadOff = sb.events[5].competitions[0].odds[0]; spreadOff.pointSpread.home.close.line = '-9.5'; spreadOff.pointSpread.away.close.line = '+9.5';
    spreadOff.total.over.close.link.href = spreadOff.total.over.close.link.href.replace(/O(\d+)_1/, 'O99950_1');
    const totalOff = sb.events[6].competitions[0].odds[0]; totalOff.total.under.close.line = 'u250.5';
    const table = gs.map(g => g.game_id === fin.game_id ? fin : g.game_id === pre.game_id ? pre : g);
    /* the last file: a game no longer to come (yesterday's), and a junk entry */
    fs.writeFileSync(FILE, LN.stringify({ v: 1, at: '2026-10-24T12:00:00Z', games: { '2027_20261024_BOS_NYK': { at: '2026-10-24T12:00:00Z', espn: '1', ml: { home: -150, away: 130 }, spread: null, total: null, ids: null, props: null }, '2027_20261025_XXX_YYY': { junk: 1 } } }));
    check(LN.toCome(table, T('2026-10-25T20:00:00Z')).length === 5, 'by games.csv, five of the seven are still to come at 4 PM Eastern (a final and a preseason game are not)');
    r = await go(table, { 20261025: sb }, '2026-10-25T20:00:00Z');
    out = readOut();
    const has = g => !!out.games[g.game_id];
    check(!has(gs[0]) && !r.asked.some(u => u.includes(`events/${live.id}/`)), 'a game ESPN calls live is dropped, and its props not asked for');
    check(!has(gs[1]) && !r.asked.some(u => u.includes(`events/${movedTip.id}/`)), "one past its tip by ESPN's own tip is dropped too");
    check(!has(fin) && !has(pre) && !r.asked.some(u => u.includes(`events/${fin.espn_id}/`) || u.includes(`events/${pre.espn_id}/`)), 'a final and a preseason game are never asked for, nor kept');
    check(JSON.stringify(Object.keys(out.games)) === JSON.stringify([gs[2], gs[5], gs[6]].map(g => g.game_id).sort()) && !out.games['2027_20261024_BOS_NYK'] && !out.games['2027_20261025_XXX_YYY'],
      `the three games still to come are kept, and the last file's game no longer to come and its junk entry leave it (${Object.keys(out.games).join(', ')})`);
    const s5 = out.games[gs[5].game_id], s6 = out.games[gs[6].game_id];
    check(s5.spread === null && s5.ml && s5.total && s5.ids.spread === null && s5.ids.total.over === null && s5.ids.total.under, 'a spread on another number than the line shown is not taken (the moneylines and total are), and an id naming another number is no id');
    check(s6.total === null && s6.ids.total === null && s6.ml && s6.spread, 'a total with its Over and Under on two numbers is not taken');
    /* a game that tips while its reads are out: the clock starts two seconds before its tip and moves a second an answer */
    del();
    const g2 = gs[2];
    r = await go([g2], { 20261025: SB25, [g2.espn_id]: PB }, new Date(Date.parse(g2.tip) - 2000).toISOString());
    check(r.asked.length === 2 && r.n.tipped === 1 && JSON.stringify(readOut().games) === '{}', 'one that tips while its reads are out is read and not taken');
    /* the window moves on: once every game of a date has tipped, the next two dates are the ones after it */
    const late = [...g25.map(g => ({ ...g })), ...g27, { ...g27[0], game_id: '2027_20261029_BOS_NYK', date: '2026-10-29', tip: '2026-10-29T23:30Z', espn_id: '9' }];
    del();
    r = await go(late, { 20261025: SB25, 20261027: SB27 }, '2026-10-26T06:00:00Z');
    check(JSON.stringify(r.asked.filter(u => /scoreboard/.test(u)).map(u => u.slice(-8)).sort()) === '["20261027","20261029"]', 'once every game of a date has tipped, the next two dates with a game to come are read');
    check(JSON.stringify(LN.toCome([{ ...g25[6], tip: '2026-10-26T01:00Z' }, { ...g25[6], game_id: 'x', tip: '2026-10-26T02:30Z' }], T('2026-10-26T02:00:00Z')).map(g => g.game_id)) === '["x"]',
      "a late game on an Eastern date counts as that date's while it is still to come (10:30 PM ET on the 25th, read at 10:00 PM ET)");
  }

  console.log('3. the last good read');
  {
    const gs = [...g20, ...g25];
    del();
    await go(gs, answers, '2026-10-20T12:00:00Z');
    const first = readOut();
    /* the 20th's scoreboard refused twice (both tries), the 25th's answers but without one of its games; Celtics at
       Pistons' props refused, every other game's read afresh with a rung moved */
    const sb25 = clone(SB25); const gone = sb25.events.splice(3, 1)[0];
    const moved = clone(PB); moved.items.find(x => x.type.id === '218').odds.american.value = '+999';
    const ans2 = { 20261020: new Error('HTTP 503 x'), 20261025: sb25, 401909088: new Error('HTTP 500 x') };
    for (const g of gs) if (g.espn_id !== '401909088') ans2[g.espn_id] = { count: 2, pageIndex: 1, pageCount: 1, items: PB.items.slice(0, 2) };
    r = await go(gs, ans2, '2026-10-20T13:00:00Z');
    const second = readOut();
    const same = (k, h) => JSON.stringify(h === 'props' ? first.games[k].props : [first.games[k].at, first.games[k].ml, first.games[k].spread, first.games[k].total, first.games[k].ids]) === JSON.stringify(h === 'props' ? second.games[k].props : [second.games[k].at, second.games[k].ml, second.games[k].spread, second.games[k].total, second.games[k].ids]);
    check(g20.every(g => same(g.game_id, 'lines')), "a date whose scoreboard is refused keeps each game's game lines as last read, with that read's time");
    check(same('2027_20261020_BOS_DET', 'props'), "a game whose props are refused keeps them as last read, with that read's time");
    const goneId = gs.find(g => g.espn_id === gone.id).game_id;
    check(same(goneId, 'lines') && second.games[goneId].props.at > first.games[goneId].props.at, 'a game missing from its day\'s answer keeps its game lines; its props, read, are new');
    check(second.at > first.at && second.games[g25[0].game_id].at === first.games[g25[0].game_id].at, 'a game read again with the same lines keeps its time; the file has its new one');
    /* a junk day, and games never read before: a half not read is null, a game with neither half is left out */
    del();
    const fresh = [...g20];
    r = await go(fresh, { 20261020: { not: 'a scoreboard' }, 401909088: PB, 401909089: new Error('HTTP 500 x'), 401909090: new TypeError('fetch failed') }, '2026-10-20T12:00:00Z');
    out = readOut();
    check(out.games['2027_20261020_BOS_DET'] && out.games['2027_20261020_BOS_DET'].at === null && out.games['2027_20261020_BOS_DET'].ml === null && out.games['2027_20261020_BOS_DET'].props.mains.length === 16 && LN.entryBad('2027_20261020_BOS_DET', out.games['2027_20261020_BOS_DET']) === null,
      'a junk scoreboard answer is a failed read: a game never read before holds its props and no game lines (at null)');
    check(!out.games['2027_20261020_PHI_NYK'] && !out.games['2027_20261020_OKC_SAS'], 'a game neither of whose halves has ever been read is left out');
    /* a last read under another ESPN event id is another game's: not carried */
    const other = { ...out.games['2027_20261020_BOS_DET'], espn: '999', at: '2026-10-19T12:00:00Z', ml: { home: -150, away: 130 } };
    fs.writeFileSync(FILE, LN.stringify({ v: 1, at: '2026-10-19T12:00:00Z', games: { '2027_20261020_BOS_DET': other } }));
    r = await go([g20[0]], { 20261020: new Error('HTTP 503 x'), 401909088: new Error('HTTP 404 x') }, '2026-10-20T12:00:00Z');
    const oth = readOut().games['2027_20261020_BOS_DET'];
    check(!r.failed && oth.at === null && oth.ml === null && oth.props && !oth.props.mains.length, 'a last read under another ESPN event id is not carried for the game: its game lines, refused, are none read (at null)');
    fs.writeFileSync(FILE, LN.stringify({ v: 1, at: '2026-10-19T12:00:00Z', games: { '2027_20261020_BOS_DET': { ...other, espn: '401909088' } } }));
    r = await go([g20[0]], { 20261020: new Error('HTTP 503 x'), 401909088: new Error('HTTP 503 x') }, '2026-10-20T12:00:00Z');
    check(r.failed, 'and with nothing answering, the run fails');
    r = await go([g20[0]], { 20261020: new Error('HTTP 503 x'), 401909088: new Error('HTTP 404 x') }, '2026-10-20T12:00:00Z');
    check(!r.failed && readOut().games['2027_20261020_BOS_DET'].ml.home === -150 && readOut().games['2027_20261020_BOS_DET'].at === '2026-10-19T12:00:00Z', 'under its own id it is carried (a 404 on the props is an answer: none posted)');
    del(); await go(fresh, { 20261020: { not: 'a scoreboard' }, 401909088: PB, 401909089: new Error('HTTP 500 x'), 401909090: new TypeError('fetch failed') }, '2026-10-20T12:00:00Z');
    /* nothing answering: the file stays byte for byte and the run says it failed */
    const keep = fs.readFileSync(FILE, 'utf8');
    r = await go(gs, Object.fromEntries([20261020, 20261025, ...gs.map(g => g.espn_id)].map(k => [k, new TypeError('fetch failed')])), '2026-10-20T14:00:00Z');
    check(r.failed && !r.written && fs.readFileSync(FILE, 'utf8') === keep, 'when nothing answers at all the file is left exactly as it was, and the run fails');
    /* and from the command line: exit 1, the file untouched (fetch made to fail, the table made up, both in a preload) */
    const pre = path.join(tmp, 'pre.js');
    fs.writeFileSync(pre, `const L = require(${JSON.stringify(path.join(ROOT, 'tools', 'lib.js'))}); const tip = new Date(Date.now() + 86400e3);
L.readGames = () => [{ game_id: '2027_20990101_BOS_NYK', season: '2027', date: L.etDate(tip), type: 'REG', away: 'BOS', home: 'NYK', status: 'scheduled', espn_id: '7', tip: tip.toISOString().slice(0, 16) + 'Z' }];
globalThis.fetch = async () => { throw new TypeError('fetch failed'); };\n`);
    const cli = cp.spawnSync(process.execPath, ['-r', pre, path.join(ROOT, 'tools', 'lines.js')], { env: { ...process.env, NBA_LINES_FILE: FILE, NBA_FETCH_PAUSE_MS: '0' }, encoding: 'utf8' });
    check(cli.status === 1 && fs.readFileSync(FILE, 'utf8') === keep && /nothing answered/.test(cli.stdout), `node tools/lines.js exits 1 with the file untouched when ESPN cannot be reached (${cli.status}: ${(cli.stdout + cli.stderr).trim().split('\n').pop()})`);
  }

  console.log('4. the quiet run');
  {
    const gs = [...g20, ...g25];
    del();
    await go(gs, answers, '2026-10-20T12:00:00Z');
    const t1 = fs.readFileSync(FILE, 'utf8'), m1 = fs.statSync(FILE).mtimeMs;
    await new Promise(res => setTimeout(res, 20));
    r = await go(gs, answers, '2026-10-20T15:00:00Z');
    check(!r.written && fs.readFileSync(FILE, 'utf8') === t1 && fs.statSync(FILE).mtimeMs === m1, 'the same answers three hours later write nothing: the file, its time and every game\'s, as they were');
    /* one moneyline moves, one game's props move */
    const sb = clone(SB25); sb.events[2].competitions[0].odds[0].moneyline.home.close.odds = '-999';
    const pb = clone(PB); pb.items[0].odds.american.value = '-150';
    r = await go(gs, { ...answers, 20261025: sb, 401909088: pb }, '2026-10-20T16:00:00Z');
    const a = JSON.parse(t1), b = readOut(), k2 = g25.find(g => g.espn_id === sb.events[2].id).game_id;
    const changedLines = Object.keys(b.games).filter(k => b.games[k].at !== a.games[k].at), changedProps = Object.keys(b.games).filter(k => b.games[k].props.at !== a.games[k].props.at);
    check(r.written && b.at > a.at && JSON.stringify(changedLines) === JSON.stringify([k2]) && b.games[k2].ml.home === -999, `a moved moneyline rewrites that game's lines alone, with the new time (${changedLines.join(', ')})`);
    check(JSON.stringify(changedProps) === '["2027_20261020_BOS_DET"]' && b.games['2027_20261020_BOS_DET'].at === a.games['2027_20261020_BOS_DET'].at, "moved props rewrite that game's props alone, its game lines keeping their time");
    const diff = r.file.split('\n').filter(l => !t1.split('\n').includes(l));
    check(diff.length === 3 && diff[0].startsWith('{"v":1,"at":'), 'the change is those two games\' lines and the file\'s time');
  }

  console.log('5. the committed lines.json');
  {
    const real = path.join(ROOT, 'lines.json');
    if (!fs.existsSync(real)) console.log('  (none committed yet)');
    else {
      const text = fs.readFileSync(real, 'utf8'), j = JSON.parse(text);
      const bad = Object.entries(j.games || {}).map(([k, x]) => [k, LN.entryBad(k, x)]).filter(([, w]) => w);
      check(j.v === 1 && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}Z$/.test(j.at) && text === LN.stringify(j) && !bad.length, `the committed file is in its shape and its own text${bad.length ? `: ${bad.map(x => x.join(': ')).join('; ')}` : ` (${Object.keys(j.games).length} games)`}`);
      check(Object.values(j.games).every(x => x.at === null || x.at <= j.at) && Object.values(j.games).every(x => !x.props || x.props.at <= j.at), 'no entry is dated after the file');
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(fails ? `${fails} FAILED` : 'all good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
