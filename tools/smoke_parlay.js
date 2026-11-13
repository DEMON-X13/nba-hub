/* The Parlay Builder, a section of the viewer smoke test (README "Parlay Builder"): run by tools/smoke.js, alone with
 *
 *   SMOKE_ONLY=pb node tools/smoke.js
 *
 * The tab (app/parts/parlay.html) is the NFL hub's Parlay Builder on the NBA's lines: its choices, the Top 50 lines they
 * make and the builder. Here the built page boots in jsdom on a made-up slate a day or two ahead (so every case holds at
 * any hour on any day, the off-season included), a made-up lines.json in the shape tools/lines.js writes, a props block
 * of its own and a stubbed ESPN, and every number it states is worked out here on this file's own copies of its rules,
 * never read from the page: the game bets (gbOwn, since the owner's call of 13 November 2026, "yes move to DK"): every
 * moneyline and spread of a game the model rates and total of any game at DraftKings' fair chance, its two prices with the
 * margin taken out in proportion, both on file with a margin (summing to more than 1), 45% to 97%, a betslip id at its
 * number where its game's lines carry ids, one side a line (the likelier of the sides that qualify, a tie to the home side
 * or the over), the moneylines and spreads then the totals, each by expected on $1 at the fair chance then the fair chance
 * then the key, the lines left out counted a line at a time, no Value mark, no model column, the model's chance in a
 * moneyline's or spread's title alone, each rule part shown to bite on made-up games of its own (3a); the player part
 * after them, a props trial's lines by the
 * rule they kept (qualOwn: the props model's chance from 45% to 97% at or above the price's implied chance, 3 points above
 * it a Value pick, 15 points above DraftKings' fair chance left out, a player today's injury report lists left out,
 * Day-To-Day among them, a probable one kept; each bet once, sameBetOwn: a milestone k+ is the main Over at k - 0.5) or,
 * once the props trial is stopped early as a FAIL (a made-up decision with early, tools/props_ledger.js EARLY_STOP), the
 * Player lines at DraftKings' fair chance (plOwn, mixOwn), the room shared (topOwn: 25 each where there are that many, 50
 * in all, PB_TOP_N_OWN), each chance by tools/props.js's distribution, research/sigma.json's sigma and tools/props_feed.js's
 * fair-chance rules; the notes, the lead and the foot word for word, the on-trial mark on every trial player line and
 * nowhere else, the Value mark on a trial's Value pick and nowhere else, the levels the tab draws nowhere (getPbTiers) on
 * their own rule as before, the Bet amount, the builder's numbers by data/corr.json and tools/corr.js (two legs of one game
 * exactly), the same-game refusals with their reasons, Add, Added and Remove, a game
 * that tips while the page is open, nothing read before the tab opens and nothing stored by a press; then the real
 * state.json and lines.json, on what the day offers. Every request is recorded.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { JSDOM } = require('jsdom');

module.exports = async function parlayBuilder({ check, pageFile, ROOT }) {
  console.log('Parlay Builder');
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const clone = x => JSON.parse(JSON.stringify(x));
  const txt = el => el ? el.textContent.replace(/\s+/g, ' ').trim() : '';
  const PJ = require('./props'), PF = require('./props_feed'), CJ = require('./corr'), PUB = require('./publish'), SG = require('./sigma');
  const REAL = JSON.parse(fs.readFileSync(path.join(ROOT, 'state.json'), 'utf8'));
  const CT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'corr.json'), 'utf8')), HOLD = CT.hold.value;
  const SIG_FILE = JSON.parse(fs.readFileSync(path.join(ROOT, 'research', 'sigma.json'), 'utf8'));
  const etDate = ms => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(ms));
  const ymd = d => d.replace(/-/g, '');
  const at = ms => new Date(ms).toISOString().slice(0, 19) + 'Z', tipAt = ms => new Date(ms).toISOString().slice(0, 16) + 'Z';
  const SEASON = REAL.season;

  /* ---------- this file's own copies of the rules ---------- */
  const PB_TOP_N_OWN = 50, EDGE_OWN = 0.03, PMIN_OWN = 0.45, PMAX_OWN = 0.97, FAR_OWN = 0.15, SIGMA_OWN = SIG_FILE.sigma;
  const imp = a => a > 0 ? 100 / (a + 100) : -a / (-a + 100), decOf = a => a > 0 ? 1 + a / 100 : 1 + 100 / -a;
  const keyOwn = l => l.kind === 'prop' ? [l.id, 'prop', l.pid, l.stat, l.mk, l.mk === 'main' ? l.line : l.mk === 'mile' ? l.k : '', l.side].join('|') : [l.id, l.kind, l.side, l.line == null ? '' : l.line].join('|');
  const cmpKey = (a, b) => { const x = keyOwn(a), y = keyOwn(b); return x < y ? -1 : x > y ? 1 : 0; };
  const COMBO = { pra: ['pts', 'reb', 'ast'], pr: ['pts', 'reb'], pa: ['pts', 'ast'], ar: ['ast', 'reb'], sb: ['stl', 'blk'] };
  const LAY = ['name', 'team', 'pos', 'min', 'pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'dd', 'td'];
  const muOwn = (row, k) => k in COMBO ? Math.round(COMBO[k].reduce((t, s) => t + row[LAY.indexOf(s)], 0) * 100) / 100 : row[LAY.indexOf(k)];
  /* the model's chance of a leg, on the state st: a moneyline the player model's; a spread Phi((m + h) / sigma), m the
     side's expected margin; a total the market's own, its two prices in proportion; a player's tools/props.js's
     distribution on the props block's mean */
  function modelOwn(l, st) {
    if (l.kind === 'total') return l.other == null ? 0.5 : imp(l.odds) / (imp(l.odds) + imp(l.other));
    const g = st.slate.find(x => x.id === l.id);
    if (l.kind === 'ml') return l.side === g.home ? g.model.pHome : 1 - g.model.pHome;
    if (l.kind === 'spread') { if (!Number.isFinite(g.model.spread)) return null; const m = l.side === g.home ? -g.model.spread : g.model.spread; return SG.Phi((m + l.line) / SIGMA_OWN); }
    const row = st.props.games[l.id].players[l.pid], V = st.props.dist.var;
    if (l.mk === 'yes') return row[LAY.indexOf(l.stat)];
    const mu = muOwn(row, l.stat), v = PJ.nbVar(mu, V[l.stat]);
    if (l.mk === 'mile') return PJ.nbSf(l.k, mu, v);
    const o = PJ.pOver(l.line, mu, v); return l.side === 'under' ? 1 - o : o;
  }
  /* DraftKings' fair chance: a main line's whole margin on the Over, a milestone's or a Yes price's by the rung rule (est.),
     a team line's two prices in proportion */
  function fairOwn(l, st) {
    if (l.kind === 'prop') {
      if (l.mk === 'main') return l.other == null ? null : { p: l.side === 'under' ? imp(l.odds) : 1 - imp(l.other), est: false };
      const F = st.props.fair, a = l.mk === 'mile' ? F.rung.a[l.stat] : F.yes.a[l.stat]; return { p: PF.propFairRung(l.odds, a), est: true };
    }
    return l.other == null ? null : { p: imp(l.odds) / (imp(l.odds) + imp(l.other)), est: false };
  }
  const BOX_OWN = { ml: 'ml', spread: 'ats', total: 'total' };
  const boxOwn = l => l.kind === 'prop' ? (l.side === 'under' ? 'under' : 'over') : BOX_OWN[l.kind];
  /* the games: the next two Eastern dates with a game still to tip that is not preseason, on the clock now */
  function gamesOwn(st) {
    const now = Date.now(), today = etDate(now), live = g => g.status === 'scheduled' && !(g.tip && Date.parse(g.tip) <= now);
    const ds = [...new Set(st.slate.filter(g => g.type !== 'PRE' && g.date >= today && live(g)).map(g => g.date))].sort().slice(0, 2);
    return st.slate.filter(g => ds.includes(g.date) && g.type !== 'PRE' && live(g));
  }
  /* a game's player props: the newer, by its time, of lines.json's and a press's (a press's 'none' read is its props with no
     line), or null where neither has read them */
  const prOwn = (e, p) => { const pub = e && e.props ? e.props : null, live = p && p.props ? p.props : null;
    return live && (!pub || Date.parse(live.at) > Date.parse(pub.at)) ? live : pub; };
  /* every leg with DraftKings' price on the games, as this file reads the lines (the newer of lines.json and a press): a
     moneyline and a spread of a game the model rates, a total of any game (the page's pbPriced and pbTotals, as the
     ruler's guard reads them, tools/suggest_check.js teamOwn; until the review of 13 November 2026 this file asked the
     model of a total too, which the page never did, so a page dropping such a game's total passed and the right one would
     have failed) */
  function candidatesOwn(st, L, press, brk = {}) {
    const out = [];
    for (const g of gamesOwn(st)) {
      const e = L && L.games && L.games[g.id], p = press && press[g.id];
      const gl = p && p.gl ? p.gl : e && e.at ? e : null, glAt = p && p.gl ? p.gl.at : e ? e.at : null;
      const ids = gl && gl.ids, on = !!(ids && (ids.event || ['ml', 'spread', 'total'].some(k => ids[k] && Object.values(ids[k]).some(Boolean))));
      const id = (k, s) => (ids && ids[k] && ids[k][s]) || null;
      const base = { id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip };
      if (gl && g.model) {
        if (gl.ml) for (const s of ['away', 'home']) out.push({ ...base, at: glAt, kind: 'ml', side: g[s], line: null, odds: gl.ml[s], other: gl.ml[s === 'home' ? 'away' : 'home'], dk: id('ml', s), on });
        if (gl.spread) for (const s of ['away', 'home']) out.push({ ...base, at: glAt, kind: 'spread', side: g[s], line: s === 'home' ? gl.spread.line : -gl.spread.line, odds: gl.spread[s], other: gl.spread[s === 'home' ? 'away' : 'home'], dk: id('spread', s), on });
      }
      if (gl && gl.total && (g.model || !brk.tmodel)) for (const s of ['over', 'under']) out.push({ ...base, at: glAt, kind: 'total', side: s, line: gl.total.line, odds: gl.total[s], other: gl.total[s === 'over' ? 'under' : 'over'], dk: id('total', s), on });
      const pr = prOwn(e, p), pg = st.props && st.props.games && st.props.games[g.id];
      const failed = st.props && st.props.ledger && st.props.ledger.decision && st.props.ledger.decision.verdict === 'FAIL';
      if (!pr || !pg || failed) continue;
      const out0 = new Set(['away', 'home'].flatMap(s => ((g.model && g.model[s] && g.model[s].out) || []).map(x => x.id)));
      const who = pid => { const r = pg.players[pid]; return r && !out0.has(pid) && (r[1] === g.away || r[1] === g.home) ? r : null; };
      /* listed on today's report, anything but Probable (ESPN's Day-To-Day is the NBA's questionable): held out */
      const rep = (st.report && st.report.players) || {}, held = pid => Array.isArray(rep[pid]) && !/^probable/i.test(String(rep[pid][1] || '').trim());
      for (const m of pr.mains) { const r = who(m.player); if (!r) continue; const b = { ...base, kind: 'prop', pid: m.player, name: r[0], team: r[1], at: pr.at, held: held(m.player) };
        out.push({ ...b, stat: m.stat, mk: 'main', line: m.line, side: 'over', odds: m.over, other: m.under }, { ...b, stat: m.stat, mk: 'main', line: m.line, side: 'under', odds: m.under, other: m.over }); }
      for (const m of pr.ladders) { const r = who(m.player); if (r) out.push({ ...base, kind: 'prop', pid: m.player, name: r[0], team: r[1], at: pr.at, stat: m.stat, mk: 'mile', k: m.k, side: 'yes', odds: m.price, other: null, held: held(m.player) }); }
      for (const y of pr.yes) { const r = who(y.player); if (r) out.push({ ...base, kind: 'prop', pid: y.player, name: r[0], team: r[1], at: pr.at, stat: y.market, mk: 'yes', side: 'yes', odds: y.price, other: null, held: held(y.player) }); }
    }
    return out.filter(l => Number.isFinite(l.odds) && l.odds !== 0).map(l => ({ ...l, p: modelOwn(l, st), fc: fairOwn(l, st) }));
  }
  /* the levels' rule (pbLegs, the pool of the four levels the tab draws nowhere: getPbTiers) and a props trial's player
     lines: 'value', 'thin', 'total', or why it is out ('band', 'edge', 'far', 'noId', 'held', 'box'). Until 13 November 2026
     it was the Top 50's game bets' rule too */
  function qualOwn(l, ticks) {
    if (!ticks.k[boxOwn(l)] || ticks.off.includes(l.id)) return 'box';
    if (!(l.p >= PMIN_OWN && l.p < PMAX_OWN)) return 'band';
    if (l.kind === 'total') return l.on && !l.dk ? 'noId' : 'total';
    const edge = l.p - imp(l.odds);
    if (edge < 0) return 'edge';
    if (l.fc && l.p - l.fc.p >= FAR_OWN - 1e-9) return 'far';
    if (l.on && !l.dk) return 'noId';
    if (l.held) return 'held';
    return edge >= EDGE_OWN ? 'value' : 'thin';
  }
  /* each bet once: a milestone k+ is the main Over at k - 0.5 on a half-point line, wherever that main Over qualifies */
  function sameBetOwn(list) {
    const mains = new Set(list.filter(l => l.kind === 'prop' && l.mk === 'main' && l.side === 'over' && Math.abs(l.line % 1) === 0.5).map(l => `${l.id}|${l.pid}|${l.stat}|${l.line + 0.5}`));
    return l => l.kind === 'prop' && l.mk === 'mile' && mains.has(`${l.id}|${l.pid}|${l.stat}|${l.k}`);
  }
  /* the game bets (the owner's call of 13 November 2026, "yes move to DK"), on this file's own reading, never the page's
     pbGameBets: every moneyline, spread and total with DraftKings' price on the ticked games, at DraftKings' fair chance (its
     two prices with the margin taken out in proportion), both prices on file ('price' where one is missing) with a margin
     (their implied chances summing to more than 1: else 'vig'), the fair chance 45% to 97% ('band'), and DraftKings' betslip
     id at its number where its game's lines carry ids ('noId'); no model chance compared (no edge, no Value pick, no far-off
     guard, no model band). A margin is the two implied chances summing to more than 1, to a billionth: a sum of exactly 1
     (-105 and +105, +100 both ways) is no margin, whose row would read +$0.00 expected on $1 (the review of 13 November
     2026). One side a line (a game's moneyline, its spread, its total): the likelier by the fair chance to 1e-9 of the
     sides that qualify, a tie to the home side or the over. The order: the moneylines and spreads, then the totals, each by
     what $1 is expected to return at the fair chance (to 1e-9), then the fair chance (to 1e-9), then the key. Counted a line
     at a time (its game and kind): a line priced with no margin (vig), and a line none of whose sides is listed where a side
     was left out for want of an id (noId). brk plants a broken rule here, to show a case bites: 'model' (ranked at the
     model's chance), 'far' (the old far-off guard back), 'mband' (the model's band back), 'both' (both sides of a line),
     'key' (a tie to the lower key), 'lean' (a tie to the side the model favours), 'home' (the home side or the over always),
     'edge' (the model's chance at or above the price's implied one), 'totals' (the totals ranked with the rest), 'nofair' (a
     tie on the expected return to the key, the fair chance skipped), 'vig' (no margin needed), 'vig1' (a sum of exactly 1
     let through: the test "under 1" as it was), 'sides' (each count a side at a time, as it was), 'tmodel' (a total only
     of a game the model rates, this file's reading before the review), 'rev' (the order reversed) */
  const ev9 = v => Math.round(v * 1e9), fairTOwn = l => imp(l.odds) / (imp(l.odds) + imp(l.other));
  function gbQualOwn(l, ticks, brk = {}) {
    if (!ticks.k[boxOwn(l)] || ticks.off.includes(l.id)) return 'box';
    if (!Number.isFinite(l.odds) || !l.odds || !Number.isFinite(l.other) || !l.other) return 'price';
    if (!brk.vig && imp(l.odds) + imp(l.other) < (brk.vig1 ? 1 : 1 + 1e-9)) return 'vig';
    const f = fairTOwn(l); if (!(f >= PMIN_OWN && f < PMAX_OWN)) return 'band';
    if (brk.mband && !(l.p >= PMIN_OWN && l.p < PMAX_OWN)) return 'mband';
    if (brk.far && l.p != null && l.p - f >= FAR_OWN - 1e-9) return 'far';
    if (brk.edge && !(l.p != null && l.p >= imp(l.odds))) return 'edge';
    return l.on && !l.dk ? 'noId' : 'ok';
  }
  function sideOwn(x, y, brk = {}) {
    if (brk.home) return x.kind === 'total' ? x.side === 'over' : x.side === x.home;
    if (ev9(x.p) !== ev9(y.p)) return ev9(x.p) > ev9(y.p);
    if (brk.key) return cmpKey(x, y) < 0;
    if (brk.lean && x.pm != null && y.pm != null && ev9(x.pm) !== ev9(y.pm)) return x.pm > y.pm;
    return x.kind === 'total' ? x.side === 'over' && y.side !== 'over' : x.side === x.home && y.side !== y.home;
  }
  function gbOwn(cands, ticks, brk = {}) {
    const q = cands.filter(l => l.kind !== 'prop').map(l => ({ l, q: gbQualOwn(l, ticks, brk) })), keep = new Map();
    for (const { l, q: w } of q) { if (w !== 'ok') continue;
      const x = { ...l, pm: Number.isFinite(l.p) ? l.p : null, p: fairTOwn(l) }, k = brk.both ? keyOwn(l) : l.id + '|' + l.kind, y = keep.get(k);
      if (!y || sideOwn(x, y, brk)) keep.set(k, x); }
    const legs = [...keep.values()].map(l => ({ ...l, dec: decOf(l.odds), part: 'game' })).map(l => ({ ...l, ev: l.p * l.dec - 1 }));
    const by = l => brk.model ? (l.pm != null ? l.pm * l.dec - 1 : -1) : l.ev;
    const rank = list => [...list].sort((a, b) => (ev9(by(b)) - ev9(by(a))) || (brk.nofair ? 0 : ev9(b.p) - ev9(a.p)) || cmpKey(a, b));
    let all = brk.totals ? rank(legs) : [...rank(legs.filter(l => l.kind !== 'total')), ...rank(legs.filter(l => l.kind === 'total'))];
    if (brk.rev) all = all.reverse();
    const lineOf = l => l.id + '|' + l.kind, listed = new Set(legs.map(lineOf)), lines = w => new Set(q.filter(x => x.q === w).map(x => lineOf(x.l)));
    const noId = brk.sides ? q.filter(x => x.q === 'noId').length : [...lines('noId')].filter(k => !listed.has(k)).length;
    return { q, legs, all, noId, vig: brk.sides ? q.filter(x => x.q === 'vig').length : lines('vig').size };
  }
  /* a props trial's player lines (decision null: the props model's chance, on trial), by the rule they kept: its Value
     picks, then its thin-edge lines, each by what $1 is expected to make at that chance, each bet once */
  function trialOwn(cands, ticks) {
    const q = cands.filter(l => l.kind === 'prop').map(l => ({ l, q: qualOwn(l, ticks) }));
    const part = k => q.filter(x => x.q === k).map(x => x.l), V = part('value'), T = part('thin'), same = sameBetOwn([...V, ...T]);
    const rank = list => list.filter(l => !same(l)).map(l => ({ ...l, dec: decOf(l.odds), ev: l.p * decOf(l.odds) - 1 })).sort((a, b) => (b.ev - a.ev) || cmpKey(a, b));
    return { q, all: [...rank(V).map(l => ({ ...l, part: 'value' })), ...rank(T).map(l => ({ ...l, part: 'other' }))], same: [...V, ...T].filter(same).length };
  }
  /* the Player lines once the props model has failed (the owner's ask of 10 November 2026), on this file's own reading of
     the night pool's player rule, never the page's pbPlayerLines: every player's main line on the ticked games (the newer of
     lines.json and a press), a stat the page offers, both prices on file; a player the props block places on one of the
     game's clubs and the game's out lists do not name; no line with no margin (its two implied chances summing under 1,
     counted: vig); each side at DraftKings' fair chance, the whole margin on the Over (an Under its own implied chance, an
     Over 1 less the Under's), 45% to 97%, its box ticked; a line that would be listed on a player today's report lists
     (anything but Probable) held out and counted; of a line's sides still in, the likelier (ties within 1e-9 to the
     lower key) */
  const PROP_STATS_OWN = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk', 'pra', 'pr', 'pa', 'ar', 'sb'], TOP_MIN_OWN = 25;
  const STAT_OWN = { pts: 'points', reb: 'rebounds', ast: 'assists', tpm: 'threes', stl: 'steals', blk: 'blocks', pra: 'points + rebounds + assists', pr: 'points + rebounds', pa: 'points + assists', ar: 'assists + rebounds', sb: 'steals + blocks' };
  const likelyOwn = (a, b) => (Math.abs(b.p - a.p) > 1e-9 ? b.p - a.p : 0) || cmpKey(a, b);
  const failedOwn = st => !!(st.props && st.props.ledger && st.props.ledger.decision && st.props.ledger.decision.verdict === 'FAIL');
  function plOwn(st, L, ticks, press, relax = {}) {
    const legs = [], rep = (st.report && st.report.players) || {}; let held = 0, vig = 0, posted = 0;
    for (const g of gamesOwn(st)) {
      if (ticks.off.includes(g.id)) continue;
      const e = L && L.games && L.games[g.id], p = press && press[g.id], pr = prOwn(e, p);
      if (!pr || !Array.isArray(pr.mains)) continue;
      if (pr.mains.length) posted++;
      const pg = st.props && st.props.games && st.props.games[g.id];
      const outs = new Set(['away', 'home'].flatMap(s => ((g.model && g.model[s] && g.model[s].out) || []).map(x => x.id)));
      for (const m of pr.mains) {
        if (!m || (!relax.stat && !PROP_STATS_OWN.includes(m.stat)) || (!relax.both && (![m.line, m.over, m.under].every(Number.isFinite) || !m.over || !m.under))) continue;
        const r = pg && pg.players && pg.players[m.player]; if (!r || outs.has(m.player) || (!relax.club && r[1] !== g.away && r[1] !== g.home)) continue;
        if (relax.both && !Number.isFinite(m.under)) { if (Number.isFinite(m.over) && imp(m.over) >= PMIN_OWN && imp(m.over) < PMAX_OWN && ticks.k.over) legs.push({ id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip, kind: 'prop', pid: m.player, name: r[0], team: r[1], at: pr.at, stat: m.stat, mk: 'main', line: m.line, side: 'over', odds: m.over, other: null, p: imp(m.over) }); continue; }
        if (imp(m.over) + imp(m.under) < 1) { vig++; continue; }
        const b = { id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip, kind: 'prop', pid: m.player, name: r[0], team: r[1], at: pr.at, stat: m.stat, mk: 'main', line: m.line };
        const sides = [{ ...b, side: 'over', odds: m.over, other: m.under, p: 1 - imp(m.under) }, { ...b, side: 'under', odds: m.under, other: m.over, p: imp(m.under) }]
          .filter(l => l.p > 0 && l.p < 1 && l.p >= PMIN_OWN && l.p < PMAX_OWN && ticks.k[l.side]);
        if (!sides.length) continue;
        if (Array.isArray(rep[m.player]) && !/^probable/i.test(String(rep[m.player][1] || '').trim())) { held++; continue; }
        legs.push(sides.sort(likelyOwn)[0]);
      }
    }
    return { legs, held, vig, posted };
  }
  /* the mix: round 1 each stat's likeliest, round 2 each stat's second, a stat run out skipped, each round likeliest first */
  function mixOwn(legs) {
    const by = {}; for (const l of legs) (by[l.stat] = by[l.stat] || []).push(l);
    const lists = Object.values(by).map(x => [...x].sort(likelyOwn)), n = Math.max(0, ...lists.map(x => x.length)), out = [];
    for (let r = 0; r < n; r++) out.push(...lists.map(x => x[r]).filter(Boolean).sort(likelyOwn));
    return out;
  }
  /* the whole list: the game bets (gbOwn), then the player part: on a FAIL the Player lines (plOwn, mixed), on a props trial
     its player lines (trialOwn); G game rows and P player rows qualifying, g = min(G, max(25, 50 - P)) of the game bets and
     min(P, 50 - g) of the player part */
  function topOwn(st, L, ticks, press, brk) {
    const cands = candidatesOwn(st, L, press, brk), gb = gbOwn(cands, ticks, brk), failed = failedOwn(st);
    const tr = failed ? null : trialOwn(cands, ticks), pl = failed ? plOwn(st, L, ticks, press) : { legs: [], held: 0, vig: 0, posted: 0 };
    const P = failed ? mixOwn(pl.legs).map(l => ({ ...l, dec: decOf(l.odds), ev: l.p * decOf(l.odds) - 1, part: 'player' })) : tr.all;
    const g = Math.min(gb.all.length, Math.max(TOP_MIN_OWN, PB_TOP_N_OWN - P.length)), n = Math.min(P.length, PB_TOP_N_OWN - g);
    return { rows: [...gb.all.slice(0, g), ...P.slice(0, n)], g, n, G: gb.all.length, P: P.length, over: gb.all.length + P.length, gb, tr, pl, same: tr ? tr.same : 0 };
  }
  const pbIsOwn = l => !!l && l.thin === false && !l.market;
  const TICKS_ALL = { k: { ml: true, ats: true, total: true, over: true, under: true }, off: [] };
  const pct = v => (v * 100).toFixed(0) + '%', m1 = v => (v < -0.0005 ? '−' : '+') + '$' + Math.abs(v).toFixed(2);
  const am = a => (a > 0 ? '+' : '') + Math.round(a);
  /* a drawn row, read: its key, its part, its rank, what it shows */
  const rowRead = li => { const c = [...li.querySelectorAll('.pb-tc b')].map(b => b.textContent.trim());
    return { key: li.querySelector('[data-pb-leg]').dataset.pbLeg, part: li.dataset.pbGrp, rank: +li.dataset.pbRow, rk: li.querySelector('.pb-trk').textContent.trim(), price: c[0], model: c[1], fair: c[2], win: c[3], ev: c[4],
      value: !!li.querySelector('.pb-valmark'), trial: !!li.querySelector('.pb-trial'), label: li.querySelector('.nm small').childNodes[0].textContent }; };
  /* what the own list says each row shows */
  const rowWant = (l, i) => ({ key: keyOwn(l), part: l.part, rank: i + 1, rk: String(i + 1), price: am(l.odds), model: pct(l.p), fair: l.fc ? pct(l.fc.p) : '–', win: m1(l.dec - 1), ev: m1(l.ev), value: l.part === 'value', trial: l.kind === 'prop' });
  /* a Player lines row or (since 13 November 2026) a game bet's, read: its price, DraftKings' fair chance, wins and expected
     on $1 under their four labels, the fair figure's title, and no model figure, Value mark, trial mark or far-off flag
     anywhere in it */
  const plRead = li => { const c = [...li.querySelectorAll('.pb-tc b')].map(b => b.textContent.trim()), fb = li.querySelector('[data-pb-fair]');
    return { key: li.querySelector('[data-pb-leg]').dataset.pbLeg, part: li.dataset.pbGrp, rank: +li.dataset.pbRow, rk: li.querySelector('.pb-trk').textContent.trim(), price: c[0], fair: c[1], win: c[2], ev: c[3],
      cols: [...li.querySelectorAll('.pb-tc small')].map(x => x.textContent.trim()).join('|'), label: li.querySelector('.nm small').textContent.trim(),
      marks: !!li.querySelector('.pb-valmark, .pb-trial, [data-pb-model], .faroff'), name: txt(li.querySelector('.glance-name') || li.querySelector('.nm')), title: fb ? fb.getAttribute('title') : null }; };
  const plWant = (l, i) => ({ key: keyOwn(l), part: 'player', rank: i + 1, rk: String(i + 1), price: am(l.odds), fair: pct(l.p), win: m1(l.dec - 1), ev: m1(l.ev),
    cols: 'price|fair|wins on $1|expected on $1', label: `${l.side === 'under' ? 'Under' : 'Over'} ${l.line} ${STAT_OWN[l.stat]}`, marks: false, name: l.name,
    title: 'DraftKings’ fair chance: its two prices with the margin taken out, the whole margin on the Over' });
  /* a game bet's row, as this file says it: its team's nickname or the game ("Hawks at Bulls"), the bet ("To win", "To cover
     -3.5", "Over 226.5 points"), DraftKings' price and fair chance, wins and expected on $1 at it, and the model's chance in
     the fair figure's title alone, where the model rates the leg: a moneyline or a spread, never a total (the hub has no
     model of a total: legModel's total is the market's own, the very fair chance; the review of 13 November 2026) */
  const NICK_OWN = { ATL: 'Hawks', BOS: 'Celtics', BKN: 'Nets', CHA: 'Hornets', CHI: 'Bulls', CLE: 'Cavaliers', DAL: 'Mavericks', DEN: 'Nuggets', DET: 'Pistons', GSW: 'Warriors', HOU: 'Rockets', IND: 'Pacers', LAC: 'Clippers', LAL: 'Lakers', MEM: 'Grizzlies',
    MIA: 'Heat', MIL: 'Bucks', MIN: 'Timberwolves', NOP: 'Pelicans', NYK: 'Knicks', OKC: 'Thunder', ORL: 'Magic', PHI: '76ers', PHX: 'Suns', POR: 'Trail Blazers', SAC: 'Kings', SAS: 'Spurs', TOR: 'Raptors', UTA: 'Jazz', WAS: 'Wizards' };
  const spOwn = v => (v > 0 ? '+' : '') + v.toFixed(1).replace('.0', '');
  const gbLabelOwn = l => l.kind === 'ml' ? 'To win' : l.kind === 'spread' ? `To cover ${spOwn(l.line)}` : `${l.side === 'under' ? 'Under' : 'Over'} ${l.line} points`;
  const gbNameOwn = l => l.kind === 'total' ? `${NICK_OWN[l.away]} at ${NICK_OWN[l.home]}` : NICK_OWN[l.side];
  const gbTitleOwn = l => `DraftKings’ fair chance: its two prices with the margin taken out in proportion${l.pm != null && l.kind !== 'total' ? `. The model’s chance: ${pct(l.pm)} (not what the list is ranked on)` : ''}`;
  const gbWant = (l, i) => ({ key: keyOwn(l), part: 'game', rank: i + 1, rk: String(i + 1), price: am(l.odds), fair: pct(l.p), win: m1(l.dec - 1), ev: m1(l.ev),
    cols: 'price|fair|wins on $1|expected on $1', label: gbLabelOwn(l), marks: false, name: gbNameOwn(l), title: gbTitleOwn(l) });
  /* the drawn list against this file's own, row for row (a game row by rowRead, a player row by plRead): the rows that differ */
  const listBad = (got, want) => want.map((l, i) => [l, got[i]]).filter(([l, li]) => { if (!li) return true;
    const i = want.indexOf(l);
    if (l.part === 'player') return JSON.stringify(plRead(li)) !== JSON.stringify(plWant(l, i));
    if (l.part === 'game') return JSON.stringify(plRead(li)) !== JSON.stringify(gbWant(l, i));
    const g = rowRead(li); return JSON.stringify(rowWant(l, i)) !== JSON.stringify({ key: g.key, part: g.part, rank: g.rank, rk: g.rk, price: g.price, model: g.model, fair: g.fair, win: g.win, ev: g.ev, value: g.value, trial: g.trial }); })
    .map(([l, li]) => `${keyOwn(l)} got ${li ? JSON.stringify(li.dataset.pbGrp === 'player' || li.dataset.pbGrp === 'game' ? plRead(li) : rowRead(li)) : 'nothing'}`);

  /* ---------- the harness ---------- */
  function load(st, o = {}) {
    const html = fs.readFileSync(pageFile('index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
    const errors = [], requests = [], timers = [];
    const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/',
      beforeParse(w) {
        w.fetch = async (url, opt) => { url = String(url); requests.push({ url, opt });
          if (/espn\.com/.test(url)) return o.espn ? o.espn(url, opt) : { ok: false, status: 404, json: async () => ({}) };
          if (/lines\.json/.test(url)) { const L = typeof o.lines === 'function' ? o.lines() : o.lines; if (L === undefined || L === 404) return { ok: false, status: 404, json: async () => ({}) };
            if (L === 'junk') return { ok: true, status: 200, json: async () => { throw new SyntaxError('Unexpected token <'); } };
            return { ok: true, status: 200, json: async () => clone(L) }; }
          if (/state\.json/.test(url)) return { ok: true, status: 200, json: async () => clone(st) };
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' }; };
        w.scrollTo = () => {}; w.confirm = () => (o.confirm !== undefined ? o.confirm : true);
        if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
        if (o.mine) w.localStorage.setItem('nba_hub_2027', JSON.stringify(o.mine));
        if (o.tab) w.localStorage.setItem('nba_hub_2027:tab', o.tab);
        for (const k of ['setTimeout', 'setInterval']) { const real = w[k]; w[k] = function (fn, ms, ...a) { timers.push({ k, fn, ms }); return real.call(w, fn, ms, ...a); }; }
        w.addEventListener('error', e => errors.push(e.message));
      } });
    const w = dom.window;
    return { w, d: w.document, errors, requests, timers };
  }
  async function provoke(p) {
    for (let round = 0, seen = 0; round < 3 && seen < p.timers.length; round++) { const due = p.timers.slice(seen); seen = p.timers.length; for (const t of due) if (typeof t.fn === 'function') try { t.fn(); } catch (e) { p.errors.push(e.message); } }
    for (const [x, type] of [[p.w, 'focus'], [p.d, 'visibilitychange'], [p.w, 'pageshow'], [p.w, 'online'], [p.w, 'resize'], [p.w, 'scroll']]) x.dispatchEvent(new p.w.Event(type));
    await sleep(50);
  }
  const linesReqs = p => p.requests.filter(x => /lines\.json/.test(x.url));
  const espnReqs = p => p.requests.filter(x => /espn\.com/.test(x.url));
  const dump = s => { const o = {}; for (let i = 0; i < s.length; i++) { const k = s.key(i); o[k] = s.getItem(k); } return o; };
  const stored = w => JSON.stringify([dump(w.localStorage), dump(w.sessionStorage)]);
  const mine = w => JSON.parse(w.localStorage.getItem('nba_hub_2027') || '{}');
  const openTab = async p => { p.d.querySelector('#nav button[data-tab=parlay]').click(); await sleep(60); };
  const rows = p => [...p.d.querySelectorAll('#pbPanel li.pb-trow')];
  const addBtn = (p, key) => p.d.querySelector(`#pbPanel [data-pb-leg="${key.replace(/"/g, '\\"')}"]`);

  /* ---------- the made-up slate, a day and two ahead ---------- */
  /* the dates are tomorrow and the two days after (Eastern), each game at 23:00 UTC or a few minutes on (7pm EDT, 6pm EST),
     so every game is on its own date at any hour the test runs, and at least eighteen hours off */
  const now = Date.now(), H = 3600e3;
  const addDay = (d, n) => { const x = new Date(d + 'T12:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10); };
  const D1 = addDay(etDate(now), 1), D2 = addDay(D1, 1), D3 = addDay(D2, 1), at23 = d => Date.parse(d + 'T23:00:00Z');
  const T1 = at23(D1), T2 = at23(D2), T3 = at23(D3);
  const gid = (ms, a, h) => `${SEASON}_${ymd(etDate(ms))}_${a}_${h}`;
  const side = (t, out) => ({ team: t, strength: 1500, offence: 0, defence: 0, coach: { name: 'Coach', elo: 0 }, lineup: [], out: out || [] });
  const game = (ms, a, h, model, o) => ({ id: gid(ms, a, h), date: etDate(ms), tip: tipAt(ms), type: 'REG', away: a, home: h, neutral: false, status: 'scheduled', espn: '7' + String(ms).slice(-6), awayScore: null, homeScore: null,
    line: null, totalLine: null, ml: null, model: { pHome: 0.5, spread: 0, total: 228, pace: 99, home: side(h), away: side(a), ...model }, team: { pHome: 0.5 }, published: null, ...o });
  const A1 = game(T1, 'BOS', 'NYK', { pHome: 0.62, spread: -7, total: 229.4, home: side('NYK', [{ id: '8100007', name: 'Gus Out', status: 'Out', min: 30, costs: 40 }]) });
  const A2 = game(T1 + 30 * 60e3, 'LAL', 'GSW', { pHome: 0.45, spread: 2, total: 231.2 });
  const A3 = game(T2, 'MIA', 'ORL', { pHome: 0.70, spread: -6, total: 224 });
  const A4 = { ...game(T2 + 30 * 60e3, 'DEN', 'PHX', { pHome: 0.8, spread: -9 }), type: 'PRE' };
  const A5 = game(T3, 'CHI', 'DET', { pHome: 0.8, spread: -9 });
  const A6 = game(now - H, 'SAC', 'POR', { pHome: 0.8, spread: -9 });
  const SLATE = [A1, A2, A3, A4, A5, A6];
  const VAR = { pts: [7.2, 0.73], reb: [1.76, 0.88], ast: [1.3, 0.99], tpm: [1.23, 1.0], stl: [1.1, 0.98], blk: [1.25, 1.12], pra: [9.66, 0.67], pr: [8.17, 0.72], pa: [6.43, 0.78], ar: [2.7, 0.76], sb: [1.2, 0.97] };
  const P = (name, team, pos, pts, reb, ast, dd, extra) => [name, team, pos, 32, pts, reb, ast, 1.5, 1.0, (extra && extra.blk) || 0.5, dd || 0.05, 0.01];
  const props = { onTrial: true, build: 'test', asOf: D1, fitSeasons: '2023-2026', horizonGameDays: 5, minShown: 8, stats: PJ.ALL, combos: COMBO, layout: LAY, dist: { kind: 'negative binomial', var: VAR }, fair: PJ.FAIR,
    ledger: { registered: '2026-10-15T11:35Z', bar: { lines: 30000 }, decision: null, summary: { lines: 4321, gradedGames: 40 } }, research: null,
    games: {
      [A1.id]: { tip: A1.tip, away: 'BOS', home: 'NYK', players: {
        '8100001': P('Ace Guard', 'BOS', 'G', 27.5, 4, 3), '8100002': P('Bo Wing', 'NYK', 'F', 12, 8.0, 2), '8100003': [...P('Cy Center', 'NYK', 'C', 10, 10.3, 2.9)],
        '8100005': P('Eli Forward', 'NYK', 'F', 16.8, 5, 2), '8100006': P('Fay Blocker', 'BOS', 'C', 9, 7, 1, 0.1, { blk: 1.8 }), '8100007': P('Gus Out', 'NYK', 'G', 14, 3, 4), '8100004': P('Hal Board', 'NYK', 'C', 14, 11, 2, 0.62), '8100008': P('Ivy Doubt', 'NYK', 'G', 18, 3, 3) } },
      [A2.id]: { tip: A2.tip, away: 'LAL', home: 'GSW', players: { '8100001': P('Ace Guard', 'LAL', 'G', 27.5, 4, 3) } } } };
  /* today's report: Ivy Doubt Day-To-Day (held out of every list, as every suggested set holds him), Eli Forward Probable
     (he plays) */
  const REPORT = { date: etDate(now), players: { '8100008': ['NYK', 'Day-To-Day', 'Ankle Sprain', ''], '8100005': ['NYK', 'Probable', 'Knee', ''] } };
  const ST = (o = {}) => ({ ...clone(REAL), today: etDate(now), generated: at(now - 2 * H), injuriesAsOf: etDate(now), slate: clone(SLATE), props: clone(props), corr: PUB.corrState(), report: clone(REPORT), ...o });
  const RD = at(now - 90 * 60e3);
  const ids = (n, sp, tl) => ({ event: '90' + n, ml: { home: `0ML90${n}_1`, away: `0ML90${n}_3` }, spread: sp != null ? { home: `0HC90${n}${sp < 0 ? 'N' : 'P'}${Math.round(Math.abs(sp) * 100)}_1`, away: `0HC90${n}${sp < 0 ? 'P' : 'N'}${Math.round(Math.abs(sp) * 100)}_3` } : null, total: tl != null ? { over: `0OU90${n}O${Math.round(tl * 100)}_1`, under: `0OU90${n}U${Math.round(tl * 100)}_3` } : null });
  const LINES = { v: 1, at: RD, games: {
    [A1.id]: { at: RD, espn: A1.espn, ml: { home: -150, away: 130 }, spread: { line: -3.5, home: -110, away: -110 }, total: { line: 226.5, over: -110, under: -110 }, ids: ids(1, -3.5, 226.5),
      props: { at: RD, mains: [
        { player: '8100001', stat: 'pts', line: 24.5, over: -110, under: -110 }, { player: '8100001', stat: 'pra', line: 36.5, over: 100, under: -120 },
        { player: '8100002', stat: 'reb', line: 7, over: -110, under: -110 }, { player: '8100003', stat: 'reb', line: 9.5, over: -150, under: 120 }, { player: '8100003', stat: 'ast', line: 3.5, over: 120, under: -150 },
        { player: '8100005', stat: 'pts', line: 15.5, over: -105, under: -115 }, { player: '8100006', stat: 'blk', line: 0.5, over: 200, under: -250 },
        { player: '8100007', stat: 'pts', line: 10.5, over: -110, under: -110 }, { player: '8100099', stat: 'pts', line: 8.5, over: -110, under: -110 },
        { player: '8100008', stat: 'pts', line: 15.5, over: -110, under: -110 }],
        ladders: [{ player: '8100001', stat: 'pts', k: 25, price: -115 }, { player: '8100001', stat: 'pts', k: 30, price: 250 }, { player: '8100002', stat: 'reb', k: 8, price: 105 },
          { player: '8100003', stat: 'reb', k: 10, price: 100 }, { player: '8100003', stat: 'ast', k: 3, price: -110 }, { player: '8100005', stat: 'pts', k: 16, price: 105 }, { player: '8100007', stat: 'pts', k: 12, price: 100 }],
        yes: [{ player: '8100004', market: 'dd', price: -150 }, { player: '8100004', market: 'td', price: 1500 }] } },
    [A2.id]: { at: RD, espn: A2.espn, ml: { home: 120, away: -140 }, spread: null, total: { line: 230.5, over: 120, under: null }, ids: null,
      props: { at: RD, mains: [], ladders: [{ player: '8100001', stat: 'pts', k: 25, price: -115 }], yes: [] } },
    [A3.id]: { at: RD, espn: A3.espn, ml: { home: -200, away: 170 }, spread: { line: -5.5, home: -110, away: -110 }, total: null, ids: { ...ids(3, -5.5, null), ml: { home: null, away: '0ML903_3' } }, props: null },
    [A4.id]: { at: RD, espn: A4.espn, ml: { home: -150, away: 130 }, spread: null, total: null, ids: null, props: null },
    [A5.id]: { at: RD, espn: A5.espn, ml: { home: -150, away: 130 }, spread: null, total: null, ids: null, props: null },
    [A6.id]: { at: RD, espn: A6.espn, ml: { home: -150, away: 130 }, spread: null, total: null, ids: null, props: null } } };
  check(D1 < D2 && D2 < D3 && etDate(now) < D1, `the made-up games fall on three dates after today (${D1}, ${D2}, ${D3}), so the horizon is the first two`);

  /* ---------- 1. nothing read before the tab opens; then lines.json once, no-store ---------- */
  let p = load(ST(), { lines: LINES });
  await sleep(300);
  await provoke(p);
  check(!linesReqs(p).length && !espnReqs(p).length, `nothing is read before the Parlay Builder opens: not lines.json, not ESPN, on load or on any timer or event (${p.timers.length} timers fired)`);
  await openTab(p);
  for (const t of ['slate', 'teams', 'parlay']) { p.d.querySelector(`#nav button[data-tab=${t}]`).click(); await sleep(20); }
  await provoke(p);
  const lr = linesReqs(p);
  check(lr.length === 1 && lr[0].opt && lr[0].opt.cache === 'no-store' && !lr[0].opt.headers && /^lines\.json$/.test(lr[0].url) && !espnReqs(p).length, `opening the tab reads lines.json once, no-store, and opening it again reads nothing (${lr.length} reads)`);
  const tab = p.d.getElementById('tab-parlay'), panel = p.d.getElementById('pbPanel'), body = p.d.getElementById('parlayBody');
  check(tab.firstElementChild === panel && panel.nextElementSibling === body && !body.nextElementSibling && tab.children.length === 2, 'the tab is the panel over the builder, and nothing else');
  check(p.d.getElementById('oddsBar').hidden && panel.querySelector('[data-espn-refresh="pb"]') && body.querySelector('[data-espn-refresh="builder"]'), "the board's odds bar is not over the tab: its own Refresh odds is in the controls and in the builder");
  for (const b of p.d.querySelectorAll('#tab-parlay [data-espn-refresh]')) { const st = p.d.getElementById(b.getAttribute('aria-describedby'));
    check(b.tagName === 'BUTTON' && p.w.getComputedStyle(b).minHeight === '44px' && st && st.getAttribute('role') === 'status' && st.getAttribute('aria-live') === 'polite' && /DraftKings' lines and player props as published/.test(st.textContent),
      `the ${b.dataset.espnRefresh === 'pb' ? "controls'" : "builder's"} Refresh odds is a 44px button with its own polite status line, saying when the lines were published ("${txt(st).slice(0, 70)}")`); }
  check(/^Top 50 lines/.test(txt(panel.querySelector('h2'))) && txt(panel.querySelector('.pb-hd .pb-pill')) === `${p.w.eval(`dayName(${JSON.stringify(D1)})`)} ${p.w.eval(`dayNum(${JSON.stringify(D1)})`)} & ${p.w.eval(`dayName(${JSON.stringify(D2)})`)} ${p.w.eval(`dayNum(${JSON.stringify(D2)})`)}`, `headed "Top 50 lines", with the two dates (${txt(panel.querySelector('.pb-hd'))})`);

  /* ---------- 2. the games: the two dates, by day, never preseason, never started ---------- */
  const gameIds = () => [...p.d.querySelectorAll('#pbPanel [data-pb-game]')].map(x => x.dataset.pbGame);
  check(JSON.stringify(gameIds()) === JSON.stringify([A1.id, A2.id, A3.id]), `the games are every game still to tip on the two dates, never preseason, not the third date's, not one that has tipped (${gameIds().join(', ')})`);
  const days = [...p.d.querySelectorAll('#pbPanel .pb-gday')].map(x => [txt(x.querySelector('h3')), [...x.querySelectorAll('[data-pb-game]')].map(c => c.dataset.pbGame)]);
  check(days.length === 2 && days[0][1].join() === [A1.id, A2.id].join() && days[1][1].join() === A3.id && /^\w{3} \w{3} \d{1,2}$/.test(days[0][0]), `listed under their day (${days.map(x => x[0]).join(' / ')})`);
  check([...p.d.querySelectorAll('#pbPanel [data-pb-game]')].every(c => c.checked) && p.d.querySelector('#pbPanel details.pb-games').open && /All 3/.test(txt(p.d.querySelector('#pbPanel .pb-games summary'))), 'all ticked to start, the list open on a wide screen');

  /* ---------- 3. the list: which legs, their part, order and numbers, each bet once ----------
     On the trial (the fixture's ledger has no decision): the game bets at DraftKings' fair chance (gbOwn), then the props
     model's player lines by the rule they kept (trialOwn: its Value picks, then its other lines, each bet once); q0 is every
     leg on the rule the levels and a trial's player lines keep (qualOwn), which until 13 November 2026 the game bets kept */
  const st0 = ST(), cands = candidatesOwn(st0, LINES), own = topOwn(st0, LINES, TICKS_ALL), q0 = cands.map(l => ({ l, q: qualOwn(l, TICKS_ALL) }));
  const want = (e, v) => e && e.q === v, inList = l => own.rows.some(r => keyOwn(r) === keyOwn(l));
  const ace25 = q0.find(e => e.l.id === A1.id && e.l.pid === '8100001' && e.l.mk === 'mile' && e.l.k === 25), ace25b = q0.find(e => e.l.id === A2.id && e.l.pid === '8100001' && e.l.k === 25);
  const aceO = q0.find(e => e.l.pid === '8100001' && e.l.stat === 'pts' && e.l.mk === 'main' && e.l.side === 'over');
  const bo8 = q0.find(e => e.l.pid === '8100002' && e.l.mk === 'mile'), boO = q0.find(e => e.l.pid === '8100002' && e.l.mk === 'main' && e.l.side === 'over');
  const cyU = q0.find(e => e.l.pid === '8100003' && e.l.stat === 'ast' && e.l.mk === 'main' && e.l.side === 'under'), cy3 = q0.find(e => e.l.pid === '8100003' && e.l.stat === 'ast' && e.l.mk === 'mile');
  const cy10 = q0.find(e => e.l.pid === '8100003' && e.l.stat === 'reb' && e.l.mk === 'mile'), cyRO = q0.find(e => e.l.pid === '8100003' && e.l.stat === 'reb' && e.l.mk === 'main' && e.l.side === 'over');
  const eli16 = q0.find(e => e.l.pid === '8100005' && e.l.mk === 'mile'), eliO = q0.find(e => e.l.pid === '8100005' && e.l.mk === 'main' && e.l.side === 'over');
  /* the cases bite: each is what this file says it is before the page is held to it */
  check(want(aceO, 'value') && want(ace25, 'value') && !inList(ace25.l) && inList(aceO.l), "a milestone that is the same bet as a qualifying main Over (Ace Guard's 25+ points and Over 24.5) is left out, the main line kept");
  check(want(boO, 'value') && boO.l.line === 7 && want(bo8, 'value') && inList(bo8.l), "a whole-number main Over (Bo Wing's rebounds Over 7, a push at 7) leaves his 8+ in");
  check(want(cyU, 'value') && ['thin', 'value'].includes(cy3.q) && inList(cy3.l), "an Under main line (Cy Center's assists Under 3.5) leaves a milestone on the same stat in");
  check(cyRO.q === 'edge' && want(cy10, 'value') && inList(cy10.l), "a milestone whose main Over does not qualify (Cy Center's 10+ rebounds, Over 9.5 at -150) is kept");
  check(want(eliO, 'thin') && want(eli16, 'value') && !inList(eli16.l) && inList(eliO.l), "a Value-pick milestone is left out for its thin-edge main Over (Eli Forward's 16+ points, Over 15.5)");
  check(want(ace25b, 'value') && inList(ace25b.l), 'the same milestone in another game is kept');
  check(q0.some(e => e.l.pid === '8100006' && e.q === 'far') && !q0.some(e => e.l.pid === '8100007' || e.l.pid === '8100099'), "a line far off DraftKings' fair chance is left out (Fay Blocker), and a player the report has out or the model does not project is never a leg");
  const ivyO = q0.find(e => e.l.pid === '8100008' && e.l.mk === 'main' && e.l.side === 'over'), nHeld = q0.filter(e => e.q === 'held').length;
  check(ivyO && ivyO.q === 'held' && qualOwn({ ...ivyO.l, held: false }, TICKS_ALL) === 'value' && !inList(ivyO.l) && nHeld === 1,
    "a player today's report lists Day-To-Day (Ivy Doubt, Over 15.5 points) has a line that would be a Value pick by its price and chance, and it is held out, as every suggested set holds him");
  check(want(eliO, 'thin') && inList(eliO.l), 'a player the report lists as Probable (Eli Forward) plays, and his line is listed');
  /* the game bets (13 November 2026), worked by hand: the Knicks to win (-150 / +130: 58% fair, the Celtics' 42% out of the
     band), the Lakers to win (-140 / +120: 56%), the Knicks to cover -3.5 and the Magic to cover -5.5 (-110 both ways: 50%
     a side, a tie, the home side), then the Celtics at the Knicks' Over 226.5 (-110 both ways, the over); by expected on $1,
     the moneylines' tighter margins first, the two spreads level on it and on the fair chance, the earlier key first. The
     Magic to win (64% fair) has no betslip id where its game's lines carry ids, the Heat (36%) is out of the band, and the
     Lakers at the Warriors' total is priced on its Over alone (+120), so it has no fair chance: until 13 November 2026 it
     was listed at 50%, after every thin-edge line */
  const GK = (g, kind, side, line) => keyOwn({ id: g.id, kind, side, line: line == null ? null : line }), gq = (g, kind, side) => own.gb.q.find(e => e.l.id === g.id && e.l.kind === kind && e.l.side === side);
  const HAND_GB = [GK(A1, 'ml', 'NYK'), GK(A2, 'ml', 'LAL'), GK(A1, 'spread', 'NYK', -3.5), GK(A3, 'spread', 'ORL', -5.5), GK(A1, 'total', 'over', 226.5)];
  check(JSON.stringify(own.gb.all.map(keyOwn)) === JSON.stringify(HAND_GB) && gq(A1, 'ml', 'BOS').q === 'band' && gq(A3, 'ml', 'MIA').q === 'band' && gq(A1, 'spread', 'BOS').q === 'ok' && gq(A1, 'total', 'under').q === 'ok' && gq(A2, 'total', 'over').q === 'price',
    `the game bets on this file's own rule are the hand-worked five, in order (${own.gb.all.map(keyOwn).join(', ')}), the Celtics' and the Heat's moneylines out of the band, the Celtics +3.5 and the Under in it but the other side taken, the one-sided total out`);
  const a3ml = gq(A3, 'ml', 'ORL');
  check(a3ml && a3ml.q === 'noId' && imp(-200) / (imp(-200) + imp(170)) > PMIN_OWN && !inList(a3ml.l), "a game bet in the band with no betslip id at its line, where its game's lines carry ids, is left out (the Magic to win, 64% fair)");
  const got = rows(p), badL = listBad(got, own.rows);
  check(got.length === own.rows.length && !badL.length && own.g === 5 && own.n > 5, `the list is exactly this file's: ${own.rows.length} lines, the ${own.g} game bets at DraftKings' price and fair chance with what $1 wins and is expected to return at it, each with the model's chance in its title alone, then the props model's ${own.n} lines on trial, each its part, rank, price, model chance, fair chance, wins and expected on $1, Value and on-trial marks${badL.length ? ': ' + badL.slice(0, 2).join(' | ') : ''}`);
  const parts = got.map(li => li.dataset.pbGrp);
  check(parts.slice(0, own.g).every(x => x === 'game') && parts.slice(own.g).every(x => x === 'value' || x === 'other') && parts.indexOf('other') > parts.lastIndexOf('value') && parts.lastIndexOf('value') >= own.g,
    "the game bets come first (the moneylines and spreads, then the total), then the props model's Value picks, then its other lines");
  check(got.every((li, i) => !!li.querySelector('.pb-trial') === (own.rows[i].kind === 'prop')) && got.every((li, i) => !!li.querySelector('.pb-valmark') === (own.rows[i].part === 'value')) && got.slice(0, own.g).every(li => !li.querySelector('.pb-valmark, .pb-trial, [data-pb-model], .faroff')),
    'every player line wears the on-trial mark and no game bet does; every Value pick (the props model\'s, on a player line) wears Value, and no game bet wears a Value mark, a model figure or a far-off flag');
  const trialMk = p.d.querySelector('#pbPanel .pb-trial');
  check(trialMk && /on trial/.test(trialMk.textContent) && /props model is on trial/.test(trialMk.title) && /4,321 of the 30,000/.test(trialMk.title), `the on-trial mark is titled with what it means ("${trialMk && trialMk.title.slice(0, 90)}")`);
  const secs = [...p.d.querySelectorAll('#pbPanel h3.pb-topsec')].map(h => [h.dataset.pbSec, txt(h)]), olV = p.d.querySelector('#pbPanel ol.pb-top[data-pb-sec="value"]'), olO = p.d.querySelector('#pbPanel ol.pb-top[data-pb-sec="other"]');
  const nV = own.rows.filter(r => r.part === 'value').length, nO = own.rows.filter(r => r.part === 'other').length;
  check(JSON.stringify(secs) === JSON.stringify([['game', `Game bets ${own.g}`], ['value', `Value picks ${nV}`], ['other', `Other lines ${nO}`]]) && olV && olV.getAttribute('start') === String(own.g + 1) && olO && olO.getAttribute('start') === String(own.g + nV + 1)
    && !p.d.querySelector('#pbPanel ol.pb-top[data-pb-sec="game"]').hasAttribute('start'),
    `three parts under their headings, each counted, the ranks running on (${secs.map(x => x[1]).join(' / ')}, starts ${olV && olV.getAttribute('start')} and ${olO && olO.getAttribute('start')})`);
  const notes = [...p.d.querySelectorAll('#pbPanel .pb-note')].map(txt).join(' | ');
  check(new RegExp(`${nHeld} line is left out: it is on a player today’s injury report lists \\(Day-To-Day among them`).test(notes) && p.w.getPbTop().held === nHeld, `the notes count the line held out for the report (${p.w.getPbTop().held})`);
  check(/1 line is left out: the props model rates it 15 points or more above DraftKings’ fair chance/.test(notes) && /1 line is left out: the list takes a game’s moneyline, spread or total only with DraftKings’ betslip id/.test(notes) && !/Value pick|never Value|come last/.test(notes)
    && p.w.getPbTop().far === 1 && p.w.getPbTop().noId === 1, `the notes say what was left out and why: a player line far off the market (the props model's), a game bet with no betslip id; none speaks of Value picks or the totals (${notes.slice(0, 160)})`);
  check(/the props model’s, which is on trial/.test(txt(p.d.querySelector('#pbPanel .pb-lead'))) && (txt(panel).match(/on trial, not yet shown to beat DraftKings/g) || []).length === 1, 'the lead says once that a player\'s chance is the props model\'s, on trial');
  /* the trial's foot and its game list's name, word for word (the review of 13 November 2026: the side a game bet offers
     is the likelier with a betslip id, and its order the moneylines and spreads, then the totals) */
  { const FOOT_TRIAL_OWN = `Game bets at DraftKings’ fair chance, its two prices with the margin taken out in proportion, 45% to 97%, one side a line, the likelier with a betslip id where its game has ids: moneylines and spreads, then totals, each by expected on $1, then the fair chance. Player lines at the props model’s chance, on trial: 45% to 97% and at or above the price’s implied chance, 3 points above it a Value pick, ${Math.round(FAR_OWN * 100)} points above DraftKings’ fair chance left out, a milestone that is the same bet as a main line shown as the main line; the Value picks first, each part by expected on $1. Each part gets ${TOP_MIN_OWN} where it has that many. Players today’s injury report holds out are left out.`;
    const footT = txt(p.d.querySelector('#pbPanel .pb-foot')), olGT = p.d.querySelector('#pbPanel ol.pb-top[data-pb-sec="game"]'), nameT = olGT && olGT.getAttribute('aria-label');
    check(footT === FOOT_TRIAL_OWN && nameT === `The ${own.g} game bets on your picks at DraftKings’ odds: moneylines and spreads, then totals, each by expected return on $1`,
      `on the trial the foot and the game bets' list name are this file's own, word for word (${footT === FOOT_TRIAL_OWN ? 'the same' : `got "${footT.slice(0, 160)}"`}${nameT && /then totals/.test(nameT) ? '' : ` | list "${nameT}"`})`); }
  check(own.same === 2 && p.w.getPbTop().same === 2, `two milestones are left out as the same bet as their main line (${p.w.getPbTop().same})`);
  /* the early stop (tools/props_ledger.js EARLY_STOP, the owner's call of 5 November 2026): its FAIL, in the shape
     publish.js writes, takes the props model's chance off the list; since 10 November 2026 (the owner's ask: "why is it
     still only showing team legs and not players") the list takes players' main lines again, after the game bets, at
     DraftKings' own fair chance with no model claim, by the night pool's player rule (this file's own plOwn), a mix of
     stats each stat's likeliest first (mixOwn), the room shared (topOwn: each part 25 where it has that many) */
  {
    const PLx = require('./props_ledger'), FAIL_DEC = { verdict: 'FAIL', decidedAt: '2026-11-05T18:00Z', lines: 12298, games: 121, scores: { lines: 12298, logloss_diff: 0.018439, brier_diff: 0.008278 },
      flat: { edge: 0.03, all: { bets: 6027, won: 3084, units: -222.81 } }, early: { at: PLx.EARLY_STOP.at, by: PLx.EARLY_STOP.by, why: PLx.EARLY_STOP.why } };
    const STF = (o = {}) => { const s = ST(o); s.props.ledger = { ...s.props.ledger, decision: clone(FAIL_DEC) }; return s; }, stF = STF();
    const pf = load(stF, { lines: LINES }); await sleep(300); await openTab(pf);
    const ownF = topOwn(stF, LINES, TICKS_ALL), gotLi = rows(pf), notesF = [...pf.d.querySelectorAll('#pbPanel .pb-note')].map(txt).join(' | ');
    /* the cases bite: Ace Guard's points and points + rebounds + assists, Bo Wing's rebounds, Cy Center's rebounds (his Over
       the likelier side: -150, so 54.5% at DraftKings' fair chance against the Under's 45.5%) and assists, Eli Forward's
       points (Probable, so he plays) and Fay Blocker's blocks are listed, each on the likelier side; Ivy Doubt's points
       held out for the report; Gus Out (the game's out list) and a player the props block does not place never a line */
    const KF = (pid, stat, line, side) => `${A1.id}|prop|${pid}|${stat}|main|${line}|${side}`;
    const HAND = [KF('8100006', 'blk', 0.5, 'under'), KF('8100003', 'ast', 3.5, 'under'), KF('8100001', 'pra', 36.5, 'under'), KF('8100003', 'reb', 9.5, 'over'), KF('8100005', 'pts', 15.5, 'under'), KF('8100001', 'pts', 24.5, 'under'), KF('8100002', 'reb', 7, 'under')];
    const plRowsF = ownF.rows.filter(r => r.part === 'player');
    check(JSON.stringify(plRowsF.map(keyOwn)) === JSON.stringify(HAND) && ownF.pl.held === 1 && !ownF.pl.legs.some(l => ['8100007', '8100099', '8100008'].includes(l.pid)) && Math.abs(ownF.pl.legs.find(l => l.stat === 'reb' && l.pid === '8100003').p - (1 - imp(120))) < 1e-15,
      `the cases bite: on this file's own rule the seven player lines are the hand-worked ones, in the mix's order (two ties, the points + rebounds + assists Under and Cy Center's rebounds Over at 54.5%, and Ace Guard's and Bo Wing's at 52.4%, each to the lower key), Ivy Doubt held out (${ownF.pl.held}), Gus Out and an unplaced player never a line`);
    check(ownF.g === ownF.G && ownF.n === ownF.P && ownF.rows.length === ownF.G + ownF.P && ownF.rows.slice(0, ownF.G).every(r => r.part !== 'player'), `with ${ownF.G} game rows and ${ownF.P} player rows both fit: the game bets first, then the player lines`);
    const badF = listBad(gotLi, ownF.rows);
    const topF = pf.w.getPbTop().rows.map(l => l.sk);
    check(gotLi.length === ownF.rows.length && !badF.length && !pf.errors.length && JSON.stringify(topF) === JSON.stringify(ownF.rows.map(keyOwn)), `after the FAIL the list is exactly this file's own, line for line: ${ownF.G} game bets at DraftKings' fair chance, then ${ownF.P} player lines, each at DraftKings' price and fair chance with what $1 wins and is expected to return at it${badF.length ? ': ' + badF.slice(0, 2).join(' | ') : ''}${pf.errors.length ? ': ' + pf.errors.join(' | ') : ''}`);
    const plLis = gotLi.filter(li => li.dataset.pbGrp === 'player');
    check(plLis.length === ownF.P && gotLi.length && gotLi.every(li => !li.querySelector('.pb-valmark, .pb-trial, [data-pb-model], .faroff')) && !pf.d.querySelector('#pbPanel .pb-valmark, #pbPanel [data-pb-model], #pbPanel .faroff, #pbPanel .pb-trial')
      && gotLi.every(li => ['game', 'player'].includes(li.dataset.pbGrp)),
      'no line on the list wears a Value mark, a model figure, a far-off flag or a trial mark, a game bet or a player line, and there is none anywhere on the panel');
    const fay = plRowsF.find(r => r.pid === '8100006'), ace = plRowsF.find(r => r.pid === '8100001' && r.stat === 'pts'), cyO = plRowsF.find(r => r.side === 'over');
    const fayLi = fay && gotLi.find(li => li.querySelector(`[data-pb-leg="${keyOwn(fay)}"]`));
    check(fayLi && plRead(fayLi).ev === '+$0.00' && cyO && plWant(cyO, 0).ev === m1((1 - imp(120)) * decOf(-150) - 1) && cyO.ev < -0.05 && cyO.ev > -0.2,
      `an Under is expected to return $0 on $1 at DraftKings' fair chance, an Over less (Cy Center's rebounds Over at -150: ${m1(cyO.ev)})`);
    /* the columns: until 13 November 2026 a player row's four cells sat on the game rows' five-column grid, the model's
       column left empty (the review of 10 November 2026); since the game bets have no model figure either, every row of a
       list with no model figure (pb-cols4 on the card) has its four cells on four columns, none placed; jsdom computes the
       cascade (not the layout: the screenshots measure that) */
    { const cs = li => pf.w.getComputedStyle(li.querySelector('.pb-tcs')), cells = li => [...li.querySelectorAll('.pb-tc')].map(c => pf.w.getComputedStyle(c).gridColumnStart || 'auto');
      const gLi = gotLi.find(li => li.dataset.pbGrp === 'game'), pLi = gotLi.find(li => li.dataset.pbGrp === 'player');
      check(gLi && pLi && pf.d.getElementById('pbCard').classList.contains('pb-cols4') && gotLi.every(li => cs(li).gridTemplateColumns === cs(gLi).gridTemplateColumns && cells(li).join() === 'auto,auto,auto,auto') && /repeat\(4,/.test(cs(gLi).gridTemplateColumns),
        `every row's four cells sit on four columns, the game bets' and the player lines' alike, with no empty model column (${gLi ? cs(gLi).gridTemplateColumns + ' ' + cells(gLi).join() : 'none'})`); }
    const secsF = [...pf.d.querySelectorAll('#pbPanel h3.pb-topsec')].map(h => [h.dataset.pbSec, txt(h)]), olP = pf.d.querySelector('#pbPanel ol.pb-top[data-pb-sec="player"]'), olG = pf.d.querySelector('#pbPanel ol.pb-top[data-pb-sec="game"]');
    const subP = olP && olP.previousElementSibling, subG = olG && olG.previousElementSibling;
    check(JSON.stringify(secsF) === JSON.stringify([['game', `Game bets ${ownF.G}`], ['player', `Player lines ${ownF.P}`]]) && subG && subG.classList.contains('pb-topsub') && txt(subG) === 'At DraftKings’ odds: no model claim.' && !olG.hasAttribute('start')
      && olG.getAttribute('aria-label') === `The ${ownF.G} game bets on your picks at DraftKings’ odds: moneylines and spreads, then totals, each by expected return on $1`
      && subP && subP.classList.contains('pb-topsub') && txt(subP) === 'At DraftKings’ odds: no model claim.' && olP.getAttribute('start') === String(ownF.G + 1)
      && olP.getAttribute('aria-label') === `Then ${ownF.P} player lines at DraftKings’ odds, a mix of stats, each stat’s likeliest first` && !pf.d.querySelector('#pbPanel [data-pb-sec="value"], #pbPanel [data-pb-sec="other"], #pbPanel [data-pb-novalue]'),
      `two parts, "Game bets" and "Player lines", each counted, each with one short line under it, the ranks running on from the game bets; no Value picks or Other lines part (${secsF.map(x => x[1]).join(' / ')}, start ${olP && olP.getAttribute('start')})`);
    check(!/takes none|has no player lines|on trial/.test(txt(pf.d.getElementById('pbPanel'))) && !/failed its shadow ledger/.test(notesF),
      `nothing on the tab says the list takes no player line, or calls the model on trial (${notesF.slice(0, 120)})`);
    check(new RegExp(`^${ownF.pl.held} line is left out: it is on a player today’s injury report lists`).test(notesF.split(' | ').find(t => /injury report/.test(t)) || '') && pf.w.getPbTop().held === ownF.pl.held,
      `the note counts the player line held out for the report (${pf.w.getPbTop().held})`);
    const leadF = txt(pf.d.querySelector('#pbPanel .pb-lead')), footF = txt(pf.d.querySelector('#pbPanel .pb-foot'));
    /* the lead and the foot after the FAIL, word for word (13 November 2026: every line at DraftKings' fair chance, said in a
       few words; until then the foot said the game bets' model chance, Value bar and far-off rule apart from the Player
       lines' rules, the review of 10 November 2026); never that a line returns or breaks even */
    const OFF_OWN = 'the props model’s trial was stopped early as a FAIL on 5 November 2026';
    const LEAD_OWN = 'Every line on the bet types and games ticked here, at DraftKings’ odds: the game bets, then the player lines, 50 at most. Add any of them to the builder below.';
    /* (the review of 13 November 2026) the side a line offers said a part at a time: a game bet's likelier side with a
       betslip id (the other is listed where the likelier has none), a player line's the likelier the boxes leave */
    const FOOT_OWN = `Every line at DraftKings’ fair chance, its two prices with the margin taken out (in proportion on a game bet, all on the Over on a player line), 45% to 97%, one side a line. Game bets: the likelier side with a betslip id where its game has ids; moneylines and spreads, then totals, each by expected on $1, then the fair chance. Player lines: the likelier side the boxes leave; a mix of stats, each stat’s likeliest first. Each part gets ${TOP_MIN_OWN} where it has that many. Players today’s injury report holds out are left out.`;
    check(leadF === LEAD_OWN && footF === FOOT_OWN && !/Value|model chance|far off|on trial|breaks? even|even money/i.test(leadF + ' ' + footF + ' ' + notesF),
      `the lead and the foot are this file's own, word for word, every line at DraftKings' odds, and nothing on them or the notes speaks of Value picks, a model chance, the far-off rule or a line breaking even (${footF === FOOT_OWN ? 'the same' : `got "${footF.slice(0, 160)}"`}${leadF === LEAD_OWN ? '' : ` | lead "${leadF.slice(0, 120)}"`})`);
    /* a player's leg the reader adds by hand still shows the model's chance, muted, titled that the trial stopped and that
       no list or set takes it; its mark reads "failed trial", titled that its chance there is DraftKings' fair chance
       (section 8 holds the builder's rows); the bar's own FAIL (no early) is said as that */
    const T_EARLY = 'The props model’s trial was stopped early as a FAIL on 5 November 2026, the owner’s call: it was not shown to beat DraftKings’ closing lines, so this chance is the model’s, for reference only, and no list or set takes it';
    const M_EARLY = 'The props model’s trial was stopped early as a FAIL on 5 November 2026, the owner’s call: it was not shown to beat DraftKings’ closing lines, so this leg’s chance is DraftKings’ fair chance, and the props model’s own, beside it, is for reference only';
    const markF = pf.d.createElement('div'); markF.innerHTML = pf.w.pbTrialMark({ kind: 'prop' });
    check(pf.w.pbTrialTitle() === T_EARLY && markF.querySelector('.pb-trial') && markF.querySelector('.pb-trial').textContent === 'failed trial' && markF.querySelector('.pb-trial').title === M_EARLY,
      `a player leg's mark reads "failed trial", titled with the stop, and the muted chance's title says it is the model's for reference ("${pf.w.pbTrialTitle().slice(0, 100)}")`);
    const titleBar = pf.w.eval('(() => { const d = S.props.ledger.decision, e = d.early; delete d.early; try { return pbTrialTitle(); } finally { d.early = e; } })()');
    check(titleBar === 'The props model failed its shadow ledger’s bar against DraftKings’ closing lines, so this chance is the model’s, for reference only, and no list or set takes it', `the bar's own FAIL is said as a failed bar ("${titleBar.slice(0, 80)}")`);

    /* Add: a player line goes in the builder exactly as a night set's player leg does (pbSlipOf's fields, in that order: the
       leg a game's Player props stores), drawn there at DraftKings' fair chance with the props model's muted and marked
       "failed trial", as every player leg after the FAIL; with the Knicks to win beside it the builder's sums are this
       file's own copula of DraftKings' fair chances and of the model's, and its same-game price */
    {
      const fayKey = keyOwn(fay), mlKey = keyOwn({ id: A1.id, kind: 'ml', side: 'NYK', line: null });
      const ppPctOwn = v => v < 0.005 ? '<1%' : v > 0.995 ? '>99%' : Math.round(v * 100) + '%', confOwn = v => { const r = Math.round(v * 100); return r >= 70 ? 'HIGH' : r >= 45 ? 'MED' : 'LOW'; };
      /* his name opens the matchup bubble on the leg as a night set's card hands it: DraftKings' price and fair chance, the
         props model's after them, muted and marked failed trial */
      { const nb = addBtn(pf, fayKey).closest('li').querySelector('.glance-name'); nb.click(); await sleep(30);
        const gb = pf.d.getElementById('glanceBox'), gN = k => txt(gb && gb.querySelector(`[data-glance-legbox] [data-glance-n="${k}"]`)), mdl = gb && gb.querySelector('[data-glance-legbox] [data-glance-n="model"]');
        const dts = gb ? [...gb.querySelectorAll('[data-glance-legbox] dt')].map(txt).join('|') : '';
        check(nb.dataset.glance === 'p:8100006' && gb && !gb.hidden && gN('label') === 'Under 0.5 blocks' && gN('price') === '−250' && gN('fair') === ppPctOwn(imp(-250)) && gN('model') === ppPctOwn(modelOwn({ ...fay, odds: -250 }, stF))
          && dts === 'Price|Fair|Model' && mdl.closest('dd').classList.contains('glance-q') && mdl.closest('dd').querySelector('[data-glance-failed]'),
          `a player line's name opens his matchup bubble on that leg: price, DraftKings' fair chance, then the props model's muted, marked failed trial (${gb ? txt(gb.querySelector('[data-glance-legbox]')) : 'none'})`);
        nb.click(); await sleep(20); }
      let b = addBtn(pf, fayKey); b.focus(); b.click(); await sleep(20); b = addBtn(pf, fayKey);
      const fayLeg = { id: A1.id, away: 'BOS', home: 'NYK', date: A1.date, tip: A1.tip, kind: 'prop', pid: '8100006', name: 'Fay Blocker', team: 'BOS', at: RD, stat: 'blk', mk: 'main', line: 0.5, side: 'under', odds: -250, other: 200 };
      const slF = () => mine(pf.w).slip.legs;
      check(slF().length === 1 && JSON.stringify(slF()[0]) === JSON.stringify(fayLeg) && b && b.textContent === 'Added' && b.getAttribute('aria-pressed') === 'true' && pf.d.activeElement === b,
        `Add puts Fay Blocker's Under 0.5 blocks in the builder exactly as a night set's player leg goes in, the button reading Added, the focus kept (${JSON.stringify(slF()[0])})`);
      const trF = () => pf.d.querySelector(`#pbBuild tr.legrow[data-pb-row="${fayKey}"]`), fFair = imp(-250), fMod = modelOwn(fayLeg, stF);
      const cell = trF() && trF().querySelector('[data-h="Chance"]');
      check(cell && txt(cell.querySelector('[data-pb-fp]')) === ppPctOwn(fFair) && txt(cell.querySelector('.pb-conf')) === confOwn(fFair) && txt(cell.querySelector('[data-pb-mv]')) === `props model ${ppPctOwn(fMod)}` && txt(cell.querySelector('.pb-trial[data-pb-failed]')) === 'failed trial' && !trF().querySelector('.faroff'),
        `its builder row is a player leg's after the FAIL: DraftKings' fair chance first with its band, the props model's muted and marked failed trial (${txt(cell)})`);
      addBtn(pf, mlKey).click(); await sleep(20);
      const L2 = slF(), rhoF = CJ.rhoFor(CT, { game: A1.id, kind: 'blk', player: '8100006', team: 'BOS', side: 'under', home: 'NYK' }, { game: A1.id, kind: 'win', team: 'NYK', side: 'NYK', home: 'NYK' }) || 0;
      const fML = imp(-150) / (imp(-150) + imp(130)), fairW = CJ.joint2(fFair, fML, rhoF), modW = CJ.joint2(fMod, 0.62, rhoF), mult = decOf(-250) * decOf(-150), decW = Math.min(mult, HOLD / CJ.joint2(imp(-250), imp(-150), rhoF));
      const heroF = pf.d.querySelector('#pbBuild .pb-box.hero'), payF = pf.d.querySelector('#pbBuild [data-payout]');
      check(L2.length === 2 && heroF && Math.abs(+heroF.querySelector('[data-fair]').dataset.fair - fairW) < 1e-9 && Math.abs(+heroF.querySelector('[data-model]').dataset.model - modW) < 1e-9 && payF && Math.abs(+payF.dataset.payout - 20 * decW) < 1e-9
        && txt(heroF.querySelector('[data-model]')).endsWith('its player leg the props model’s, which failed its trial'),
        `with the Knicks to win beside it, the builder prices the two as this file's copula does: DraftKings' fair chance ${(fairW * 100).toFixed(2)}%, the model's ${(modW * 100).toFixed(2)}% (rho ${rhoF}), $20 paying ${(20 * decW).toFixed(2)} at the same-game price`);
      addBtn(pf, fayKey).click(); await sleep(20);
      check(slF().length === 1 && slF()[0].kind === 'ml' && addBtn(pf, fayKey).textContent === 'Add', 'a second press on the player line takes it out');
      pf.d.getElementById('pClear').click(); await sleep(20);
    }

    /* the ticks: Player overs off takes every Over off (and a line's Under, in the band, takes its place: Cy Center's
       rebounds Under at 45.5%), Player unders off every Under, a game unticked its lines */
    const mineT = (k, off = []) => ({ picks: {}, build: [], slip: { legs: [], stake: 20 }, pb: { k: { ml: true, ats: true, total: true, over: true, under: true, ...k }, off } });
    /* this file's own words where DraftKings has posted no player main line on the ticked games: as of the oldest read that
       found none, or not read yet (did not load, where lines.json did not load) */
    const whenF = ms => new Date(ms).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    const noPlOwnF = (L, ids, press) => { const n = ids.length, of = k => k === n ? (k === 1 ? 'your game' : `your ${k} games`) : `${k} of your ${n} games`;
      const pr = id => prOwn(L && L.games[id], press && press[id]), read = ids.filter(pr), ats = read.map(id => Date.parse(pr(id).at)).filter(Number.isFinite), out = [];
      if (read.length) out.push(`No DraftKings player lines yet for ${of(read.length)}${ats.length ? ` (as of ${whenF(Math.min(...ats))})` : ''}.`);
      if (read.length < n) out.push(`DraftKings’ player lines for ${of(n - read.length)} ${L ? 'have not been read yet' : 'did not load'}.`);
      return out.join(' '); };
    for (const [k, off, what] of [[{ over: false }, [], 'Player overs off'], [{ under: false }, [], 'Player unders off'], [{}, [A1.id], 'the Celtics at the Knicks unticked'], [{ ml: false, ats: false, total: false }, [], 'Players only']]) {
      const T = { k: { ...TICKS_ALL.k, ...k }, off }, qt = load(stF, { lines: LINES, tab: 'parlay', mine: mineT(k, off) }); await sleep(300);
      const ownT = topOwn(stF, LINES, T), gotT = rows(qt), badT = listBad(gotT, ownT.rows), pT = ownT.rows.filter(r => r.part === 'player');
      const bites = what === 'Player overs off' ? pT.some(r => keyOwn(r) === KF('8100003', 'reb', 9.5, 'under')) && pT.every(r => r.side === 'under')
        : what === 'Player unders off' ? pT.length > 0 && pT.every(r => r.side === 'over') : what === 'Players only' ? ownT.G === 0 && pT.length === 7 : pT.length === 0 && ownT.G > 0;
      const noteOk = what !== 'the Celtics at the Knicks unticked' || [...qt.d.querySelectorAll('#pbPanel .pb-note')].map(txt).filter(t => t === noPlOwnF(LINES, [A2.id, A3.id])).length === 1;
      check(bites && noteOk && gotT.length === ownT.rows.length && !badT.length && !qt.errors.length && (what !== 'Players only' || (!qt.d.querySelector('#pbPanel [data-pb-sec="game"], #pbPanel [data-pb-sec="value"], #pbPanel [data-pb-sec="other"]') && !qt.d.querySelector('#pbPanel ol[data-pb-sec="player"]').hasAttribute('start'))),
        `${what}: the list is this file's own on those ticks (${ownT.G} game bets, ${pT.length} player lines${what === 'Player overs off' ? ", Cy Center's rebounds Under in his Over's place" : what === 'the Celtics at the Knicks unticked' ? ', and a note that the other games have no player line, counting the ticked games alone' : ''})${badT.length ? ': ' + badT.slice(0, 2).join(' | ') : ''}${qt.errors.length ? ': ' + qt.errors.join(' | ') : ''}`);
      /* the levels the tab draws nowhere (getPbTiers, kept for the checks and the card's 'pb' kicker): their pool takes no
         player leg after the FAIL, so an empty level says that, never that DraftKings has posted none, which on these ticks
         it has (the review of 10 November 2026) */
      if (what === 'Players only') { const whys = qt.w.getPbTiers().tiers.map(t => t.why || '');
        check(ownT.pl.posted > 0 && whys.length === 4 && whys.every(t => t === `No player lines: ${OFF_OWN}, so these levels take none.`),
          `Players only, with DraftKings' player lines posted: each of the four levels the tab draws nowhere says its pool takes no player line after the FAIL ("${whys[0]}")`); }
    }

    /* a line DraftKings prices with no margin (both sides +105: implied 48.8% each, 97.6% in all) is never a player line */
    {
      const LV = clone(LINES); LV.games[A1.id].props.mains.push({ player: '8100002', stat: 'ast', line: 2.5, over: 105, under: 105 });
      const ownV = topOwn(stF, LV, TICKS_ALL), qv = load(stF, { lines: LV, tab: 'parlay' }); await sleep(300);
      const vKey = s => KF('8100002', 'ast', 2.5, s), badV = listBad(rows(qv), ownV.rows);
      check(ownV.pl.vig === 1 && ownV.P === ownF.P && !ownV.rows.some(r => [vKey('over'), vKey('under')].includes(keyOwn(r))) && !addBtn(qv, vKey('over')) && !addBtn(qv, vKey('under')) && qv.w.getPbTop().vig === 1 && !badV.length,
        `a player's line priced with no margin (Bo Wing's assists at +105 both ways) is left out, as the night pool leaves it out (${ownV.pl.vig})`);
    }

    /* each part of the night pool's player rule the fixture's own lines never met (the review of 10 November 2026): a main
       on a stat the page offers no line for (turnovers), one on a player the props block places on a third club (the Heat,
       in the Celtics at the Knicks), and one with no Under price. Each would be listed with its own rule switched off (this
       file's plOwn, relaxed), and none is; the list is otherwise ownF's */
    {
      const stX = STF(); stX.props.games[A1.id].players['8100010'] = P('Zed Away', 'MIA', 'G', 12, 3, 2);
      const LX = clone(LINES); LX.games[A1.id].props.mains.push({ player: '8100002', stat: 'tov', line: 2.5, over: -110, under: -110 }, { player: '8100010', stat: 'pts', line: 11.5, over: -110, under: -110 }, { player: '8100005', stat: 'reb', line: 4.5, over: -110, under: null });
      const XK = [KF('8100002', 'tov', 2.5, 'under'), KF('8100010', 'pts', 11.5, 'under'), KF('8100005', 'reb', 4.5, 'over')], inLegs = (o, k) => o.legs.some(l => keyOwn(l) === k);
      const ownX = topOwn(stX, LX, TICKS_ALL), qx = load(stX, { lines: LX, tab: 'parlay' }); await sleep(300);
      const bites = inLegs(plOwn(stX, LX, TICKS_ALL, null, { stat: true }), XK[0]) && inLegs(plOwn(stX, LX, TICKS_ALL, null, { club: true }), XK[1]) && inLegs(plOwn(stX, LX, TICKS_ALL, null, { both: true }), XK[2])
        && !XK.some(k => inLegs(ownX.pl, k));
      const badX = listBad(rows(qx), ownX.rows);
      check(bites && JSON.stringify(ownX.rows.map(keyOwn)) === JSON.stringify(ownF.rows.map(keyOwn)) && !badX.length && !XK.some(k => addBtn(qx, k)) && !rows(qx).some(li => /tov|Zed Away/.test(li.querySelector('[data-pb-leg]').dataset.pbLeg + txt(li))) && !qx.errors.length,
        `a main on a stat the page offers no line for, one on a player of a third club and one with no Under price are never Player lines, each listed were its own rule off; the list is otherwise as before${badX.length ? ': ' + badX.slice(0, 2).join(' | ') : ''}${qx.errors.length ? ': ' + qx.errors.join(' | ') : ''}`);
    }

    /* a Refresh odds press after the FAIL (the review of 10 November 2026: no check held the Player lines to one). ESPN's
       scoreboard refuses (503), so the game lines stay lines.json's, and the props read answers the Celtics at the Knicks
       with DraftKings' newer lines (Ace Guard's points gone, Cy Center's rebounds moved to 10.5 at -130/+105, Bo Wing's
       assists added at +115/-140) and the other two games with none posted (404). The Player lines follow the newer read;
       a read older than lines.json's is never taken; a newer one planted with no scoreboard read moves the list (the
       list's signature carries the read); a newer 'none' read on every game takes them all off, said as of the press */
    {
      const TYPE_OWN = { pts: 1, ast: 2, reb: 3, tpm: 4, stl: 5, blk: 6, pa: 87, pr: 88, ar: 89, pra: 90, sb: 91 };
      const PRESS_MAINS = clone(LINES.games[A1.id].props.mains).filter(m => !(m.player === '8100001' && m.stat === 'pts'));
      Object.assign(PRESS_MAINS.find(m => m.player === '8100003' && m.stat === 'reb'), { line: 10.5, over: -130, under: 105 });
      PRESS_MAINS.push({ player: '8100002', stat: 'ast', line: 3.5, over: 115, under: -140 });
      const item = (eid, m, sideP) => ({ competition: { $ref: `http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events/${eid}/competitions/${eid}?lang=en&region=us` },
        athlete: { $ref: `http://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/seasons/${SEASON}/athletes/${m.player}?lang=en&region=us` }, type: { id: String(TYPE_OWN[m.stat]) },
        odds: { american: { value: (sideP > 0 ? '+' : '') + sideP } }, current: { target: { value: m.line, displayValue: String(m.line) } } });
      const PAGE_A1 = { count: PRESS_MAINS.length * 2, pageIndex: 1, pageSize: 1000, pageCount: 1, items: PRESS_MAINS.flatMap(m => [item(A1.espn, m, m.over), item(A1.espn, m, m.under)]) };
      const espnF = ok => async url => { const m = /\/events\/(\d+)\/competitions\/\1\/odds\/100\/propBets/.exec(url);
        if (!m) return { ok: false, status: 503, json: async () => ({}) };
        if (ok && m[1] === A1.espn) return { ok: true, status: 200, json: async () => clone(PAGE_A1) };
        return { ok: false, status: 404, json: async () => ({ error: { message: `No propBets found for eventId ${m[1]} and provider 100`, code: 404 } }) }; };
      const pressF = async qp => { const t0 = Date.now(), bt = qp.d.querySelector('#pbPanel [data-espn-refresh="pb"]'); bt.click(); await sleep(30);
        for (let i = 0; i < 400 && qp.d.getElementById('oddsBar').classList.contains('busy'); i++) await sleep(25);
        await sleep(60); const t1 = Date.now(), mins = []; for (let t = Math.floor(t0 / 60e3) * 60e3; t <= t1; t += 60e3) mins.push(t); return { t0, t1, mins }; };
      const pressOf = (atA1, mainsA1, atRest) => ({ [A1.id]: { props: { at: atA1, mains: mainsA1, ladders: [], yes: [] } }, [A2.id]: { props: { at: atRest, mains: [], ladders: [], yes: [] } }, [A3.id]: { props: { at: atRest, mains: [], ladders: [], yes: [] } } });
      const plKeys = o => o.rows.filter(r => r.part === 'player').map(keyOwn), ownNew = topOwn(stF, LINES, TICKS_ALL, pressOf(at(now), PRESS_MAINS, at(now)));
      const nk = plKeys(ownNew), ok0 = plKeys(ownF);
      check(nk.includes(KF('8100003', 'reb', 10.5, 'over')) && !nk.includes(KF('8100003', 'reb', 9.5, 'over')) && ok0.includes(KF('8100003', 'reb', 9.5, 'over')) && nk.includes(KF('8100002', 'ast', 3.5, 'under')) && !ok0.includes(KF('8100002', 'ast', 3.5, 'under'))
        && !nk.includes(KF('8100001', 'pts', 24.5, 'under')) && ok0.includes(KF('8100001', 'pts', 24.5, 'under')) && JSON.stringify(ownNew.rows.filter(r => r.part !== 'player').map(keyOwn)) === JSON.stringify(ownF.rows.filter(r => r.part !== 'player').map(keyOwn)),
        "the press case bites: on this file's own reading the newer read moves Cy Center's rebounds to 10.5, adds Bo Wing's assists Under and takes Ace Guard's points off, the game bets as before");
      /* a real press */
      let qp = load(stF, { lines: LINES, espn: espnF(true), tab: 'parlay' }); await sleep(300);
      const before = rows(qp).filter(li => li.dataset.pbGrp === 'player').map(li => plRead(li).key);
      const { t0, t1 } = await pressF(qp), ownP = topOwn(stF, LINES, TICKS_ALL, pressOf(at(t1), PRESS_MAINS, at(t1))), badP = listBad(rows(qp), ownP.rows);
      check(JSON.stringify(before) === JSON.stringify(ok0) && rows(qp).length === ownP.rows.length && !badP.length && JSON.stringify(qp.w.getPbTop().rows.map(l => l.sk)) === JSON.stringify(ownP.rows.map(keyOwn)) && !qp.errors.length,
        `a Refresh odds press whose player lines are newer than lines.json's: the Player lines are the press's, row for row (${ownP.P} lines), the game bets lines.json's${badP.length ? ': ' + badP.slice(0, 2).join(' | ') : ''}${qp.errors.length ? ': ' + qp.errors.join(' | ') : ''}`);
      /* a read older than lines.json's, planted (a press always reads now): never taken; then the same read made newer,
         planted with no scoreboard read, so only the props read moves: the list follows it */
      qp = load(stF, { lines: LINES, tab: 'parlay' }); await sleep(300);
      qp.w.eval(`PP_LIVE[${JSON.stringify(A1.id)}] = ${JSON.stringify({ status: 'ok', at: at(Date.parse(RD) - 30 * 60e3), mains: PRESS_MAINS, ladders: [], yes: [] })}; renderPb();`); await sleep(30);
      const ownOld = topOwn(stF, LINES, TICKS_ALL, pressOf(at(Date.parse(RD) - 30 * 60e3), PRESS_MAINS, null)), badO = listBad(rows(qp), ownOld.rows);
      check(JSON.stringify(plKeys(ownOld)) === JSON.stringify(ok0) && rows(qp).length === ownOld.rows.length && !badO.length && !qp.errors.length,
        `a press read older than lines.json's is never taken: the Player lines stay lines.json's${badO.length ? ': ' + badO.slice(0, 2).join(' | ') : ''}`);
      qp.w.eval(`PP_LIVE[${JSON.stringify(A1.id)}].at = ${JSON.stringify(at(Date.now()))}; renderPb();`); await sleep(30);
      const ownN2 = topOwn(stF, LINES, TICKS_ALL, pressOf(at(Date.now()), PRESS_MAINS, null)), badN2 = listBad(rows(qp), ownN2.rows);
      check(JSON.stringify(plKeys(ownN2)) === JSON.stringify(nk) && rows(qp).length === ownN2.rows.length && !badN2.length && !qp.errors.length,
        `the same read made newer than lines.json's, with no scoreboard read beside it: the list is drawn again on it${badN2.length ? ': ' + badN2.slice(0, 2).join(' | ') : ''}`);
      /* a press that finds no player line posted on any game: the list is the game bets alone, and the note is as of the press */
      qp = load(stF, { lines: LINES, espn: espnF(false), tab: 'parlay' }); await sleep(300);
      const pn = await pressF(qp), ownZ = topOwn(stF, LINES, TICKS_ALL, pressOf(at(pn.t1), [], at(pn.t1))), badZ = listBad(rows(qp), ownZ.rows);
      const notesZ = [...qp.d.querySelectorAll('#pbPanel .pb-note')].map(txt), saysZ = pn.mins.map(m => `No DraftKings player lines yet for your 3 games (as of ${whenF(m)}).`);
      check(ownZ.P === 0 && ownZ.G === ownF.G && rows(qp).length === ownZ.rows.length && !badZ.length && notesZ.filter(t => saysZ.includes(t)).length === 1 && !qp.d.querySelector('#pbPanel [data-pb-sec="player"]') && !qp.errors.length,
        `a press that finds no player line posted (404 on every game): no Player lines, the game bets alone, and the note dated by the press ("${notesZ.find(t => /player lines/.test(t)) || 'none'}")${badZ.length ? ': ' + badZ.slice(0, 2).join(' | ') : ''}`);
    }

    /* no player lines yet (the 13-line case the owner met, the game bets alone): the list is the game bets, and one line
       says DraftKings has posted none, as of when, or that none has been read, or did not load */
    {
      const IDS3F = [A1.id, A2.id, A3.id], noMains = L => { const x = clone(L); for (const id of Object.keys(x.games)) if (x.games[id].props) x.games[id].props.mains = []; return x; };
      const L0 = noMains(LINES), Lall0 = clone(L0), Lnone = clone(LINES);
      Lall0.games[A3.id].props = { at: RD, mains: [], ladders: [], yes: [] }; for (const id of IDS3F) Lnone.games[id].props = null;
      const Ldiff = clone(Lall0); Ldiff.games[A2.id].props.at = at(now - 6 * H);
      /* each case: the lines, the boxes changed, the games unticked; one game alone ticked says "your game" (never read, and
         read with none), and with both player boxes off nothing is said of player lines (the review of 10 November 2026) */
      const TEAMS_K = { over: false, under: false }, PLAYERS_K = { ml: false, ats: false, total: false };
      for (const [L, k, off, what] of [[L0, {}, [], 'no player main line on any game (two read, one never)'], [Lall0, {}, [], 'none on all three, each read'], [Ldiff, {}, [], 'none on all three, read at two times: as of the older'], [Lnone, {}, [], 'none read'],
        [Lall0, PLAYERS_K, [], 'none, Players only'], ['junk', PLAYERS_K, [], 'lines.json not loading, Players only'], [Lnone, {}, [A1.id, A3.id], 'one game ticked, its player lines never read'], [L0, {}, [A1.id, A3.id], 'one game ticked, read with none'],
        [L0, TEAMS_K, [], 'none, both player boxes off']]) {
        const Lo = L === 'junk' ? null : L, qn = load(stF, { lines: L, tab: 'parlay', mine: mineT(k, off) }); await sleep(300);
        const T = { k: { ...TICKS_ALL.k, ...k }, off }, ownN = Lo ? topOwn(stF, Lo, T) : { rows: [], G: 0, P: 0 }, say = T.k.over || T.k.under ? noPlOwnF(Lo, IDS3F.filter(id => !off.includes(id))) : '';
        const gotN = rows(qn), noteN = [...qn.d.querySelectorAll('#pbPanel .pb-note')].map(txt), noneN = txt(qn.d.querySelector('#pbPanel .pb-top-none'));
        const ok = ownN.P === 0 && gotN.length === ownN.rows.length && !listBad(gotN, ownN.rows).length && !qn.d.querySelector('#pbPanel [data-pb-sec="player"]')
          && (!say ? ownN.rows.length && !noneN && !noteN.some(t => /player lines/.test(t)) : ownN.rows.length ? noteN.filter(t => t === say).length === 1 && !noneN : noneN === say) && !qn.errors.length;
        check(ok, `${what}: no player line, the list the game bets alone (${ownN.rows.length}), and ${!say ? 'nothing said of player lines' : `${ownN.rows.length ? 'a note' : 'the empty line'} says, word for word, "${say}"`}${ok ? '' : ` (got "${ownN.rows.length ? noteN.join(' | ') : noneN}")`}${qn.errors.length ? ': ' + qn.errors.join(' | ') : ''}`);
      }
      check(noPlOwnF(L0, IDS3F) === `No DraftKings player lines yet for 2 of your 3 games (as of ${whenF(Date.parse(RD))}). DraftKings’ player lines for 1 of your 3 games have not been read yet.` && noPlOwnF(Lnone, IDS3F) === 'DraftKings’ player lines for your 3 games have not been read yet.'
        && noPlOwnF(Lnone, [A2.id]) === 'DraftKings’ player lines for your game have not been read yet.' && noPlOwnF(L0, [A2.id]) === `No DraftKings player lines yet for your game (as of ${whenF(Date.parse(RD))}).`,
        "the cases bite: this file's own words for two games read with none and one never read, and for none read");
    }

    /* the mix on a made-up game of its own: eight players on four stats, the Under the likelier side but on one line at +100
       (both sides 50%, the tie to the lower key: the Over), a tie inside a stat (two points Unders at -212) and one across
       stats in a round (a rebounds and an assists Under at -150). Worked by hand: round 1 the steals .80, points .70, then
       the rebounds and assists tied at .60 (the lower key, his id, first); round 2 the points .6795 and rebounds .5495; then
       the points alone, .6795, .6599 and the Over at .50 */
    {
      const MX = { '8200001': ['Mo One', 'pts', 24.5, 150, -233], '8200002': ['Mo Two', 'pts', 19.5, 160, -212], '8200009': ['Mo Nine', 'pts', 14.5, 160, -212], '8200003': ['Mo Three', 'pts', 11.5, 150, -194],
        '8200004': ['Mo Four', 'pts', 8.5, -120, 100], '8200005': ['Mo Five', 'reb', 6.5, 120, -150], '8200006': ['Mo Six', 'reb', 4.5, 100, -122], '8200007': ['Mo Seven', 'ast', 3.5, 120, -150], '8200008': ['Mo Eight', 'stl', 0.5, 250, -400] };
      const stM = STF(); stM.props.games[A1.id].players = Object.fromEntries(Object.entries(MX).map(([pid, x]) => [pid, P(x[0], 'NYK', 'G', 14, 4, 3)]));
      const LM = clone(LINES); LM.games[A1.id].props = { at: RD, mains: Object.entries(MX).map(([pid, x]) => ({ player: pid, stat: x[1], line: x[2], over: x[3], under: x[4] })), ladders: [], yes: [] };
      const MK = (pid, side) => KF(pid, MX[pid][1], MX[pid][2], side);
      const HANDM = [MK('8200008', 'under'), MK('8200001', 'under'), MK('8200005', 'under'), MK('8200007', 'under'), MK('8200002', 'under'), MK('8200006', 'under'), MK('8200009', 'under'), MK('8200003', 'under'), MK('8200004', 'over')];
      const ownM = topOwn(stM, LM, TICKS_ALL), plM = ownM.rows.filter(r => r.part === 'player'), legsM = ownM.pl.legs;
      const flat = [...legsM].sort(likelyOwn).map(keyOwn), unsorted = (() => { const by = {}; for (const l of legsM) (by[l.stat] = by[l.stat] || []).push(l); const ls = Object.values(by).map(x => [...x].sort(likelyOwn)), out = [];
        for (let r = 0; r < 5; r++) out.push(...ls.map(x => x[r]).filter(Boolean)); return out.map(keyOwn); })();
      const noKey = [...legsM].sort((a, b) => b.p - a.p);
      check(JSON.stringify(plM.map(keyOwn)) === JSON.stringify(HANDM) && JSON.stringify(flat) !== JSON.stringify(HANDM) && JSON.stringify(unsorted) !== JSON.stringify(HANDM) && legsM.find(l => l.pid === '8200004').side === 'over',
        "the mix case bites: this file's own order is the hand-worked one, and neither the plain order by chance nor rounds left in the stats' own order gives it; the +100 line's tie goes to its Over");
      const qm = load(stM, { lines: LM, tab: 'parlay' }); await sleep(300);
      const gotM = rows(qm).filter(li => li.dataset.pbGrp === 'player').map(plRead), badM = listBad(rows(qm), ownM.rows);
      check(JSON.stringify(gotM.map(x => x.key)) === JSON.stringify(HANDM) && !badM.length && !qm.errors.length, `the page's Player lines are that mix, row for row${badM.length ? ': ' + badM.slice(0, 2).join(' | ') : ''}${qm.errors.length ? ': ' + qm.errors.join(' | ') : ''}`);
      check(noKey.length === 9, 'and the case has its nine lines');
    }

    /* the room on sixty made-up games, Moneyline and the player boxes ticked: each moneyline at -110 both ways qualifying
       (50% a side at DraftKings' fair chance, a tie, the home side), or, in one state, only the first ten (the rest at -10000
       / +5000: 98% and 2%, outside the band), each game one player's points line DraftKings prices -150 to -209 on the Under */
    {
      const TM = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
      const mk60 = () => { const G = [], pg = {};
        for (let i = 0; i < 60; i++) { const ms = (i < 30 ? T1 : T2) + (i % 30) * 60e3, a = TM[i % 30], h = TM[(i % 30 + (i < 30 ? 1 : 2)) % 30];
          const g = game(ms, a, h, { pHome: 0.5, spread: -3 }); G.push(g);
          pg[g.id] = { tip: g.tip, away: a, home: h, players: { [String(8300000 + i)]: P('Pl ' + i, h, 'G', 15, 4, 3) } }; }
        const s = STF({ slate: G }); s.props.games = pg; s.report = { date: etDate(now), players: {} }; return s; };
      const L60 = (st, qual, nPl) => { const L = { v: 1, at: RD, games: {} };
        st.slate.forEach((g, i) => { L.games[g.id] = { at: RD, espn: g.espn, ml: i < qual ? { home: -110, away: -110 } : { home: -10000, away: 5000 }, spread: null, total: null, ids: { event: '8' + i, ml: { home: `0ML8${i}_1`, away: `0ML8${i}_3` }, spread: null, total: null },
          props: { at: RD, mains: i < nPl ? [{ player: String(8300000 + i), stat: 'pts', line: 14.5, over: 120, under: -150 - i }] : [], ladders: [], yes: [] } }; }); return L; };
      const K60 = { ml: true, ats: false, total: false, over: true, under: true };
      for (const [qual, nPl, wG, wP] of [[60, 60, 25, 25], [60, 10, 40, 10], [10, 60, 10, 40], [60, 0, 50, 0]]) {
        const s = mk60(), L = L60(s, qual, nPl), T = { k: K60, off: [] }, own6 = topOwn(s, L, T);
        const q6 = load(s, { lines: L, tab: 'parlay', mine: mineT(K60) }); await sleep(400);
        const got6 = rows(q6), bad6 = listBad(got6, own6.rows), sec6 = [...q6.d.querySelectorAll('#pbPanel h3.pb-topsec')].map(txt).join('|');
        check(own6.G === qual && own6.P === nPl && own6.g === wG && own6.n === wP && got6.length === wG + wP && !bad6.length && sec6 === [wG ? 'Game bets ' + wG : '', wP ? 'Player lines ' + wP : ''].filter(Boolean).join('|') && q6.w.getPbTop().over === qual + nPl && !q6.errors.length,
          `${qual} game bets and ${nPl} player lines qualifying: ${wG} game bets then ${wP} player lines (${sec6})${bad6.length ? ': ' + bad6.slice(0, 2).join(' | ') : ''}${q6.errors.length ? ': ' + q6.errors.join(' | ') : ''}`);
      }
    }

    /* 3a. the game bets' rule, part by part (the owner's call of 13 November 2026, "yes move to DK"), on fifteen made-up games
       of their own tomorrow, after the FAIL with no player line, at any hour; each case worked by hand, and each shown to
       bite, that is, to give another list or count with its part of the rule broken on this file's own copy (gbOwn's brk):
       B1 CLE at DEN, B2 DET at HOU, B3 IND at LAC: moneylines at -110 both ways (50% a side, a tie, the home side), the model
         rating the home side 80% (30 points over its fair chance: the old far-off guard's), 44% (under the old model band)
         and 50.5% (under the price's implied 52.4%: the old edge); each listed, the home side;
       B4 ATL at WAS: the Wizards -2.5 and the Hawks +2.5 at -110 both ways, a tie: the home side, never the Hawks, whom a tie
         by the key, or by the model's lean (57% to 43%), would list;
       B5 MEM at MIL: the Bucks -1.5 at +100, the Grizzlies +1.5 at -120: 47.8% and 52.2%, both in the band: the Grizzlies,
         though the model rates the Bucks 62%;
       B6 MIN at NOP: the total 220.5 at -102 both ways: the Over, after every moneyline and spread though its margin is the
         tightest of all, its title the fair chance alone (the hub has no model of a total);
       B7 OKC at PHI: -105 both ways: the 76ers, first, the tightest margin of the moneylines and spreads;
       B8 POR at SAC: the Kings -250 (68.2%), and B9 SAS at TOR: the Raptors -152 (57.6%): their margins the -110 lines' to
         the ninth place, so the higher fair chance first, then the -110 lines by the key;
       B10 BKN at CHA: the Hornets -4.5 at -115, the Nets +4.5 at -105, the game with no model spread: the Hornets, the title
         with no model chance;
       B11 GSW at LAL: +105 both ways, priced under no margin: neither side, one line counted;
       B12 BOS at CHI: the Bulls -130 with no betslip id where the game's lines carry ids: the Celtics +110 (45.7%, in the band,
         with their id), the likelier side with an id; no line counted left out, the moneyline being on the list;
       (the review of 13 November 2026)
       B13 DAL at MIA: the Heat -105 and the Mavericks +105, and the total 214.5 at +100 both ways, each priced at exactly no
         margin (implied chances summing to 1: either side would be listed first, +$0.00 expected): neither listed, two lines
         counted; its spread, -3.5 at -110 both ways, with no betslip id on either side where the game's lines carry ids: one
         line left out, counted once (a count a side at a time said two);
       B14 NYK at ORL: the Magic -6.5 at -115 (51.1%) with their id, the Knicks +6.5 at -105 (48.9%) with none: the Magic, and
         no line counted left out (a count a side at a time said one); level with the Hornets on the expected return and the
         fair chance, so after them by the key;
       B15 PHX at UTA, a game the model does not rate (no model), its moneyline, spread and total priced with their ids: its
         total alone (the Over, -110 both ways), after the Timberwolves at the Pelicans, as the page's pbTotals and the
         ruler's guard read a total of any game; no moneyline or spread (pbPriced reads only a game the model rates) */
    {
      const B = (i, a, h, model) => game(T1 + i * 60e3, a, h, { pHome: 0.5, spread: 0, ...model });
      const BG = [B(1, 'CLE', 'DEN', { pHome: 0.80 }), B(2, 'DET', 'HOU', { pHome: 0.44 }), B(3, 'IND', 'LAC', { pHome: 0.505 }), B(4, 'ATL', 'WAS', { spread: 0 }), B(5, 'MEM', 'MIL', { spread: -6 }), B(6, 'MIN', 'NOP', {}),
        B(7, 'OKC', 'PHI', {}), B(8, 'POR', 'SAC', { pHome: 0.70 }), B(9, 'SAS', 'TOR', { pHome: 0.60 }), B(10, 'BKN', 'CHA', { spread: null }), B(11, 'GSW', 'LAL', {}), B(12, 'BOS', 'CHI', { pHome: 0.55 }),
        B(13, 'DAL', 'MIA', { pHome: 0.60 }), B(14, 'NYK', 'ORL', { spread: -4 }), { ...B(15, 'PHX', 'UTA', {}), model: null }];
      const ml = (h, a) => ({ home: h, away: a }), sp = (line, h, a) => ({ line, home: h, away: a });
      const LB = { v: 1, at: RD, games: {} }, put = (g, o) => { LB.games[g.id] = { at: RD, espn: g.espn, ml: null, spread: null, total: null, ids: null, props: null, ...o }; };
      put(BG[0], { ml: ml(-110, -110) }); put(BG[1], { ml: ml(-110, -110) }); put(BG[2], { ml: ml(-110, -110) }); put(BG[3], { spread: sp(-2.5, -110, -110) }); put(BG[4], { spread: sp(-1.5, 100, -120) });
      put(BG[5], { total: { line: 220.5, over: -102, under: -102 } }); put(BG[6], { ml: ml(-105, -105) }); put(BG[7], { ml: ml(-250, 200) }); put(BG[8], { ml: ml(-152, 125) });
      put(BG[9], { spread: sp(-4.5, -115, -105) }); put(BG[10], { ml: ml(105, 105) }); put(BG[11], { ml: ml(-130, 110), ids: { event: '9912', ml: { home: null, away: '0ML9912_3' }, spread: null, total: null } });
      put(BG[12], { ml: ml(-105, 105), spread: sp(-3.5, -110, -110), total: { line: 214.5, over: 100, under: 100 },
        ids: { event: '9913', ml: { home: '0ML9913_1', away: '0ML9913_3' }, spread: { home: null, away: null }, total: { over: '0OU9913O2145_1', under: '0OU9913U2145_3' } } });
      put(BG[13], { spread: sp(-6.5, -115, -105), ids: { event: '9914', ml: null, spread: { home: '0HC9914N650_1', away: null }, total: null } });
      put(BG[14], { ml: ml(-150, 130), spread: sp(-3.5, -110, -110), total: { line: 225.5, over: -110, under: -110 },
        ids: { event: '9915', ml: { home: '0ML9915_1', away: '0ML9915_3' }, spread: { home: '0HC9915N350_1', away: '0HC9915P350_3' }, total: { over: '0OU9915O2255_1', under: '0OU9915U2255_3' } } });
      const stB = STF({ slate: BG }); stB.props.games = {}; stB.report = { date: etDate(now), players: {} };
      const [B1, B2, B3, B4, B5, B6, B7, B8, B9, B10, B11, B12, B13, B14, B15] = BG, GK = (g, kind, side, line) => keyOwn({ id: g.id, kind, side, line: line == null ? null : line });
      const K = { phi: GK(B7, 'ml', 'PHI'), bos: GK(B12, 'ml', 'BOS'), mem: GK(B5, 'spread', 'MEM', 1.5), cha: GK(B10, 'spread', 'CHA', -4.5), orl: GK(B14, 'spread', 'ORL', -6.5), sac: GK(B8, 'ml', 'SAC'), tor: GK(B9, 'ml', 'TOR'),
        was: GK(B4, 'spread', 'WAS', -2.5), den: GK(B1, 'ml', 'DEN'), hou: GK(B2, 'ml', 'HOU'), lac: GK(B3, 'ml', 'LAC'), nop: GK(B6, 'total', 'over', 220.5), uta: GK(B15, 'total', 'over', 225.5) };
      const HANDB = [K.phi, K.bos, K.mem, K.cha, K.orl, K.sac, K.tor, K.was, K.den, K.hou, K.lac, K.nop, K.uta];
      const ownB = topOwn(stB, LB, TICKS_ALL), keysOf = o => JSON.stringify(o.rows.map(keyOwn)), keysB = keysOf(ownB);
      const ev = x => x.ev, eB = k => ownB.rows.find(r => keyOwn(r) === k);
      check(keysB === JSON.stringify(HANDB) && ownB.gb.noId === 1 && ownB.gb.vig === 3 && ev9(ev(eB(K.sac))) === ev9(ev(eB(K.was))) && ev9(ev(eB(K.tor))) === ev9(ev(eB(K.den)))
        && ev9(ev(eB(K.cha))) === ev9(ev(eB(K.orl))) && ev9(eB(K.cha).p) === ev9(eB(K.orl).p) && eB(K.cha).pm === null && eB(K.den).pm === 0.8 && Math.abs(eB(K.nop).pm - eB(K.nop).p) < 1e-15,
        `the game bets' cases, on this file's own rule, are the hand-worked thirteen, in order (${ownB.rows.map(r => r.side).join(', ')}): the Celtics for the Bulls with no id, the Warriors at the Lakers and the Heat's and the Mavericks' moneyline and total priced with no margin (three lines), the Heat's spread with no id either way left out (one line), the Magic with their id listed, the Suns at the Jazz's total though the model rates the game not, the Kings, the Raptors and the -110 lines level on the expected return to the ninth place, the Hornets and the Magic level on it and on the fair chance`);
      const BITES = [['far', 'the old far-off guard (the Cavaliers for the Nuggets)'], ['mband', "the model's band (the Pistons for the Rockets)"], ['edge', "the model's edge (no Pacers or Clippers)"], ['model', "ranked at the model's chance"], ['rev', 'the order reversed'],
        ['both', 'both sides of a line'], ['key', 'a tie to the lower key (the Hawks)'], ['lean', "a tie to the model's lean (the Hawks)"], ['home', 'the home side always (the Bucks)'], ['totals', 'the totals ranked with the rest'], ['nofair', 'the fair chance skipped on a tie'], ['vig', 'no margin needed'],
        ['vig1', 'a sum of exactly 1 let through (the Heat to win, then the Over at the Heat, each +$0.00)'], ['tmodel', 'a total only of a game the model rates (no Suns at the Jazz)']];
      const bit = BITES.filter(([b]) => keysOf(topOwn(stB, LB, TICKS_ALL, null, { [b]: true })) !== keysB);
      check(bit.length === BITES.length, `each part of the rule bites: with it broken this file's own list differs (${bit.length} of ${BITES.length}${bit.length < BITES.length ? ': not ' + BITES.filter(x => !bit.includes(x)).map(x => x[1]).join(', ') : ''})`);
      const sidesB = topOwn(stB, LB, TICKS_ALL, null, { sides: true }).gb, vig1B = topOwn(stB, LB, TICKS_ALL, null, { vig1: true }).gb;
      check(sidesB.noId === 4 && sidesB.vig === 6 && vig1B.vig === 1,
        `the counts bite: a line at a time 1 left out for want of an id and 3 priced with no margin, where a side at a time says ${sidesB.noId} and ${sidesB.vig}, and the test "under 1" ${vig1B.vig}`);
      const qb = load(stB, { lines: LB, tab: 'parlay' }); await sleep(300);
      const gotB = rows(qb), badB = listBad(gotB, ownB.rows), topB = qb.w.getPbTop(), notesB = [...qb.d.querySelectorAll('#pbPanel .pb-note')].map(txt);
      check(gotB.length === HANDB.length && !badB.length && JSON.stringify(topB.rows.map(l => l.sk)) === keysB && topB.noId === 1 && topB.gVig === 3 && topB.gb === HANDB.length && !qb.errors.length,
        `the page's game bets are those thirteen, row for row: DraftKings' price and fair chance, what $1 wins and is expected to return at it, the bet, the team or game, and the model's chance in a moneyline's or spread's fair figure's title alone (none on the Hornets' line or a total), the counts a line at a time (${topB.noId} and ${topB.gVig})${badB.length ? ': ' + badB.slice(0, 2).join(' | ') : ''}${qb.errors.length ? ': ' + qb.errors.join(' | ') : ''}`);
      const tt = k => { const li = gotB.find(x => x.querySelector('[data-pb-leg]').dataset.pbLeg === k); return li ? li.querySelector('[data-pb-fair]').getAttribute('title') : null; };
      const FAIR_T = 'DraftKings’ fair chance: its two prices with the margin taken out in proportion';
      check(tt(K.den) === FAIR_T + '. The model’s chance: 80% (not what the list is ranked on)' && tt(K.cha) === FAIR_T && tt(K.nop) === FAIR_T && tt(K.uta) === FAIR_T
        && !qb.d.querySelector('#pbPanel .pb-valmark, #pbPanel [data-pb-model], #pbPanel .faroff, #pbPanel .pb-trial') && !/model/i.test(gotB.map(li => txt(li)).join(' ')),
        `no model column, Value mark or far-off flag: the model's chance is quiet information in a moneyline's or spread's title ("${tt(K.den)}"), and none where the model rates none or on a total ("${tt(K.nop)}")`);
      check(notesB.includes('1 line is left out: the list takes a game’s moneyline, spread or total only with DraftKings’ betslip id at its number, and ESPN’s feed carried none for it when it was read.') && !notesB.some(t => /15 points|far off|Value|model/.test(t)),
        `the notes say the Heat's spread was left out for want of a betslip id, one line, and nothing of a model or a Value pick (${notesB.join(' | ').slice(0, 140)})`);
      check(!gotB.some(li => /\+\$0\.00/.test(txt(li))), 'no game bet reads +$0.00 expected on $1: a line priced with no margin is never listed');
    }
    /* on the trial there is no Player lines part: the props model's chance is the list's, as before */
    check(!p.d.querySelector('#pbPanel [data-pb-sec="player"], #pbPanel [data-pb-grp="player"]'), 'on the trial the list has no Player lines part');
  }

  /* the engine the levels are built by (drawn nowhere on this tab: Suggested Parlays will draw them), on the same legs:
     each level's chance, price and fair chance the builder's own sums, and its card marking every player leg on trial
     and every Value pick Value, and nothing else */
  {
    const T = p.w.getPbTiers(), built = T.tiers.filter(t => t.legs);
    const sums = built.map(t => { const r = JSON.parse(p.w.eval(`(() => { const t = getPbTiers().tiers.find(x => x.id === ${JSON.stringify(t.id)}); const L = t.legs; return JSON.stringify({ p: parlayProb(L).corr, d: parlayDec(L.map(l => ({ leg: l, ml: l.price }))), f: parlayFair(L) }); })()`)); return { t, r }; });
    check(built.length === 4 && sums.every(({ t, r }) => Math.abs(t.corr - r.p) < 1e-12 && Math.abs(t.dec - r.d) < 1e-12 && Math.abs(t.fair.p - r.f.p) < 1e-12 && t.legs.length === t.n),
      `the four levels (${built.map(t => t.id + ' ' + t.legs.length).join(', ')}) are priced by the builder's own parlayProb, parlayDec and parlayFair`);
    check(built.every(t => t.legs.every(l => q0.some(e => keyOwn(e.l) === l.sk && ['value', 'thin', 'total'].includes(e.q)) && (pbIsOwn(l) === (q0.find(e => keyOwn(e.l) === l.sk).q === 'value')))),
      'every leg a level takes qualifies by this file\'s rule, and is a Value pick exactly where this file says');
    const box = p.d.createElement('div'); box.innerHTML = built.map(t => p.w.pbTierCard(t) + p.w.pbTierCard(t, { quiet: true })).join('');
    const lis = [...box.querySelectorAll('.pb-legs li')], legsOf = built.flatMap(t => [...t.legs, ...t.legs]);
    check(lis.length === legsOf.length && lis.every((li, i) => !!li.querySelector('.pb-trial') === (legsOf[i].kind === 'prop') && !!li.querySelector('.pb-valmark') === pbIsOwn(legsOf[i])),
      "a level's card marks each player leg on trial, each Value pick Value, and nothing else");
    check(built.some(t => t.thin) ? box.querySelectorAll('.pb-thin').length === built.filter(t => t.thin).length + built.filter(t => t.mkt).length : true, "the quiet card (o.quiet) leaves out the lines saying why a leg is not a Value pick, which the other draws");
    /* a level's Add to builder puts exactly its legs in the builder, which then prices them as the level did */
    const med = built.find(t => t.id === 'med'), host = p.d.createElement('div'); host.innerHTML = p.w.pbTierCard(med); p.d.getElementById('pbPanel').appendChild(host);
    host.querySelector('[data-pb-add="med"]').click(); await sleep(30);
    const inB = mine(p.w).slip.legs, payB = p.d.querySelector('#pbBuild [data-payout]');
    check(inB.length === med.legs.length && med.legs.every(l => inB.some(x => keyOwn(x) === l.sk)) && payB && Math.abs(+payB.dataset.payout - 20 * med.dec) < 1e-9,
      `a level's Add to builder puts exactly its ${med.legs.length} legs in the builder, which pays what the level said on the Bet amount`);
    p.d.getElementById('pClear').click(); await sleep(20);
    check(!mine(p.w).slip.legs.length, 'and Clear ALL empties it again');
  }

  /* ---------- 4. the controls: 44px, and every choice the reader's own ---------- */
  const h44 = el => el && p.w.getComputedStyle(el).minHeight === '44px';
  const ctl = [...p.d.querySelectorAll('#pbPanel [data-pb-mix], #pbPanel .pb-chip, #pbPanel .pb-games summary, #pbPanel [data-pb-games], #pbPanel [data-pb-leg], #pbPanel .pb-amt')];
  check(ctl.length > 10 && ctl.every(h44) && [...p.d.querySelectorAll('#pbPanel .pb-g')].every(x => p.w.getComputedStyle(x).minHeight === '48px'), `every control is 44px (${ctl.length}, and each game 48px)`);
  check(p.d.querySelector('#pbPanel [data-pb-mix="all"]').getAttribute('aria-pressed') === 'true' && p.d.querySelector('#pbPanel .pb-seg').getAttribute('role') === 'group', 'the mix All is lit to start');
  const mixTo = async k => { p.d.querySelector(`#pbPanel [data-pb-mix="${k}"]`).click(); await sleep(20); };
  await mixTo('teams');
  check(rows(p).every(li => !li.querySelector('.pb-trial')) && rows(p).length === topOwn(st0, LINES, { k: { ml: true, ats: true, total: true, over: false, under: false }, off: [] }).rows.length && p.d.activeElement === p.d.querySelector('#pbPanel [data-pb-mix="teams"]'),
    'Teams only: no player line, the list this file makes on the team boxes, the focus kept on the button');
  check(JSON.stringify(mine(p.w).pb.k) === '{"ml":true,"ats":true,"total":true,"over":false,"under":false}', 'and the boxes are saved in the page\'s own key');
  await mixTo('players');
  check(rows(p).length && rows(p).every(li => li.querySelector('.pb-trial')), 'Players only: player lines alone');
  const kind = p.d.querySelector('#pbPanel [data-pb-kind="under"]'); kind.click(); await sleep(20);
  check(!p.d.querySelector('#pbPanel [data-pb-mix].on') && rows(p).length && rows(p).every(li => !/\|prop\|.*\|under$/.test(rowRead(li).key)) && p.d.activeElement === p.d.querySelector('#pbPanel [data-pb-kind="under"]'), 'Player unders unticked by hand lights no mix, and the list keeps no player Under');
  await mixTo('all');
  check(rows(p).some(li => rowRead(li).key.startsWith(A2.id)), 'the Lakers at the Warriors have lines on the list');
  p.d.querySelector(`#pbPanel [data-pb-game="${A2.id}"]`).click(); await sleep(20);
  check(!rows(p).some(li => rowRead(li).key.startsWith(A2.id)) && /2 of 3/.test(txt(p.d.querySelector('#pbPanel .pb-games summary'))) && JSON.stringify(mine(p.w).pb.off) === JSON.stringify([A2.id]) && p.d.activeElement === p.d.querySelector(`#pbPanel [data-pb-game="${A2.id}"]`), 'a game unticked leaves the list, the summary says 2 of 3, it is saved, the focus kept on its box');
  p.d.querySelector('#pbPanel [data-pb-games="none"]').click(); await sleep(20);
  check(/No games ticked/.test(txt(p.d.querySelector('#pbPanel .pb-top-none'))), 'None empties the list, and says why');
  p.d.querySelector('#pbPanel [data-pb-games="all"]').click(); await sleep(20);
  check(rows(p).length === own.rows.length && !mine(p.w).pb.off.length, 'All brings them back');
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 5. Add, Added, Remove, and the same-game refusals ---------- */
  const k = l => keyOwn(l), aceKey = k(aceO.l), onGb = (kind, side) => own.gb.all.find(r => r.id === A1.id && r.kind === kind && r.side === side);
  const mlH = onGb('ml', 'NYK'), spH = onGb('spread', 'NYK'), totO = onGb('total', 'over'), praU = q0.find(e => e.l.pid === '8100001' && e.l.stat === 'pra' && e.l.side === 'under');
  check(mlH && spH && totO && own.rows.some(r => r === mlH) && own.rows.some(r => r === spH) && own.rows.some(r => r === totO) && praU.q === 'value', "the cases: the Knicks to win, to cover -3.5 and the total's Over are game bets on the list, Ace Guard's points + rebounds + assists Under the props model's Value pick");
  let b = addBtn(p, aceKey); b.focus(); b.click(); await sleep(20);
  b = addBtn(p, aceKey);
  const sl = () => mine(p.w).slip.legs;
  const aceLeg = { id: A1.id, away: 'BOS', home: 'NYK', date: A1.date, tip: A1.tip, kind: 'prop', pid: '8100001', name: 'Ace Guard', team: 'BOS', at: RD, stat: 'pts', mk: 'main', line: 24.5, side: 'over', odds: -110, other: -110 };
  check(sl().length === 1 && JSON.stringify(sl()[0]) === JSON.stringify(aceLeg), `Add puts the leg in the builder exactly as a game's Player props would, dated by its read (${JSON.stringify(sl()[0])})`);
  check(b.textContent === 'Added' && b.getAttribute('aria-pressed') === 'true' && p.d.activeElement === b && /^Remove Ace Guard, Over 24\.5 points, from the builder$/.test(b.getAttribute('aria-label')), 'its button reads Added, pressed, named for taking it out, the focus kept on it');
  check(p.d.getElementById('nLegs').textContent === '1' && !p.d.getElementById('nLegs').hidden, "the tab's badge counts the builder's legs");
  addBtn(p, k(praU.l)).click(); await sleep(20);
  const no = rows(p).find(li => rowRead(li).key === k(praU.l)).querySelector('.pb-no');
  check(sl().length === 1 && no && /^Not added: Ace Guard's points over 24\.5 and pts \+ reb \+ ast share a part/.test(no.textContent) && /share a part/.test(p.d.getElementById('pbSaid').textContent) && p.d.getElementById('pbSaid').getAttribute('aria-live') === 'polite',
    `a leg the NBA's same-game rules refuse is refused, and why is said at its row and in the builder's status line ("${no && no.textContent}")`);
  addBtn(p, k(mlH)).click(); await sleep(20); addBtn(p, k(spH)).click(); await sleep(20);
  check(sl().length === 2 && /^Not added: One side bet a game: your parlay already has Knicks to win/.test(txt(rows(p).find(li => rowRead(li).key === k(spH)).querySelector('.pb-no'))), 'the moneyline and the spread of one game are refused together, and said so');
  addBtn(p, k(totO)).click(); await sleep(20);
  const a3v = q0.find(e => e.l.id === A2.id && e.l.mk === 'mile');
  addBtn(p, k(a3v.l)).click(); await sleep(20);
  check(sl().length === 4 && !p.d.querySelector('#pbPanel .pb-no'), 'the total and a leg of another game join, and the refusal line is gone once something else is done');
  addBtn(p, k(mlH)).click(); await sleep(20);
  check(sl().length === 3 && addBtn(p, k(mlH)).textContent === 'Add', 'a second press on an Added line takes it out');

  /* a leg on a player the report holds out, added by hand (from a game's Player props, or kept from before he was listed):
     his builder row wears his status, titled with why the list and the sets hold him out; a probable player's wears none */
  { const ivyLeg = { ...aceLeg, pid: '8100008', name: 'Ivy Doubt', team: 'NYK', line: 15.5 }, eliLeg = { ...aceLeg, pid: '8100005', name: 'Eli Forward', team: 'NYK', line: 15.5, odds: -105, other: -115 };
    const q4 = load(ST(), { lines: LINES, mine: { picks: {}, build: [], slip: { legs: [ivyLeg, eliLeg], stake: 20 } }, tab: 'parlay' }); await sleep(300);
    const rowsB = [...q4.d.querySelectorAll('#pbBuild tr.legrow')], rI = rowsB.find(tr => tr.dataset.pbRow === keyOwn(ivyLeg)), rE = rowsB.find(tr => tr.dataset.pbRow === keyOwn(eliLeg)), chip = rI && rI.querySelector('[data-pb-held]');
    check(rowsB.length === 2 && chip && txt(chip) === 'DAY-TO-DAY' && /^On today's injury report: listed day-to-day \(ankle sprain\), so held out of the Top 50 lines and every suggested parlay$/.test(chip.title) && rE && !rE.querySelector('.pb-inj') && q4.errors.length === 0,
      `a Day-To-Day player's leg added by hand wears DAY-TO-DAY in the builder, titled with why (${chip ? txt(chip) + ': ' + chip.title : 'no chip'}); a probable player's wears nothing`); }

  /* ---------- 6. the builder's numbers, worked out here ---------- */
  const Lb = sl(), desc = l => l.kind === 'prop' ? { game: l.id, kind: l.stat, player: l.pid, team: l.team, side: l.side, home: l.home } : { game: l.id, kind: { ml: 'win', spread: 'cover', total: 'over' }[l.kind], team: l.kind === 'total' ? '' : l.side, side: l.side, home: l.home };
  const rho = (a, b) => CJ.rhoFor(CT, desc(a), desc(b)) || 0;
  const groups = ls => { const m = new Map(); for (const l of ls) { if (!m.has(l.id)) m.set(l.id, []); m.get(l.id).push(l); } return [...m.values()]; };
  const joint = (ps, ls) => ps.length === 1 ? ps[0] : CJ.joint2(ps[0], ps[1], rho(ls[0], ls[1]));
  const ownPrice = ls => { let dec = 1, prod = 1, fair = 1, model = 1;
    for (const g of groups(ls)) { const mult = g.reduce((t, l) => t * decOf(l.odds), 1); prod *= mult; dec *= g.length > 1 ? Math.min(mult, HOLD / joint(g.map(l => imp(l.odds)), g)) : mult;
      fair *= joint(g.map(l => fairOwn(l, st0).p), g); model *= joint(g.map(l => modelOwn(l, st0)), g); }
    return { dec, prod, fair, model }; };
  const amOwn = v => v >= 0.5 ? -Math.round(100 * v / (1 - v)) : Math.round(100 * (1 - v) / v);
  const ob = ownPrice(Lb), pbPage = JSON.parse(p.w.eval(`(() => { const L = pbOrder(M.slip.legs).map(l => pbView(l)); return JSON.stringify({ p: parlayProb(L), f: parlayFair(L), d: parlayDec(L.map(l => ({ leg: l, ml: l.price }))) }); })()`));
  check(groups(Lb).some(g => g.length === 2) && Math.abs(pbPage.p.corr - ob.model) < 1e-9 && Math.abs(pbPage.f.p - ob.fair) < 1e-9 && Math.abs(pbPage.d - ob.dec) < 1e-9 && pbPage.f.est && ob.dec < ob.prod,
    `the page's parlayProb, parlayFair and parlayDec on the builder's legs (two of one game, one of another) are this file's: the copula of the model's chances (${ob.model.toFixed(5)}), of DraftKings' fair chances (${ob.fair.toFixed(5)}, est.), and min(the prices multiplied, ${HOLD} / J) (${ob.dec.toFixed(4)}, under the product ${ob.prod.toFixed(4)})`);
  const bd = p.d.getElementById('pbBuild'), hero = bd.querySelector('.pb-box.hero'), payout = bd.querySelector('[data-payout]'), conf = bd.querySelector('.pb-box.tier');
  const bandOwn = v => { const r = Math.round(v * 100) / 100; return r >= 0.75 ? 'HIGH' : r >= 0.6 ? 'MED' : r >= 0.55 ? 'LOW' : 'UNDER 55%'; };
  check(hero && hero.querySelector('[data-fair]').textContent === (ob.fair * 100).toFixed(1) + '%' && /^fair chance all 3 land, est\.$/.test(txt(hero.querySelector('span'))) && txt(hero.querySelector('[data-model]')) === `model says ${(ob.model * 100).toFixed(1)}%, on trial`,
    `the builder leads with DraftKings' fair chance, the model's beside it, on trial with a player leg in (${txt(hero)})`);
  check(payout && Math.abs(+payout.dataset.payout - 20 * ob.dec) < 1e-9 && payout.textContent === '$' + (20 * ob.dec).toFixed(2) && conf && txt(conf.querySelector('b')) === bandOwn(ob.fair) && txt(bd.querySelectorAll('.pb-box')[1].querySelector('b')) === am(amOwn(ob.model)),
    `what $20 pays at the same-game price, the confidence band on the fair chance (${txt(conf)}), the fair price for the model's chance`);
  const lr2 = [...bd.querySelectorAll('tr.legrow')], ordOwn = [...Lb].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) || nameOwn(a).localeCompare(nameOwn(b)) || cmpKey(a, b));
  function nameOwn(l) { const nk = t => ({ BOS: 'Celtics', NYK: 'Knicks', LAL: 'Lakers', GSW: 'Warriors', MIA: 'Heat', ORL: 'Magic' })[t] || t; return l.kind === 'prop' ? l.name : l.kind === 'total' ? `${nk(l.away)} at ${nk(l.home)}` : nk(l.side); }
  check(lr2.length === 3 && lr2.every((tr, i) => tr.dataset.pbRow === keyOwn(ordOwn[i])) && lr2.every((tr, i) => !!tr.querySelector('.pb-trial') === (ordOwn[i].kind === 'prop')),
    `its rows are the legs in the builder's order, the day then the name (${ordOwn.map(nameOwn).join(', ')}), each player's chance marked on trial`);
  const rowAce = lr2.find(tr => tr.dataset.pbRow === aceKey);
  check(rowAce && txt(rowAce.querySelector('[data-pb-p]')) === pct(modelOwn(aceLeg, st0)) && txt(rowAce.querySelector('.legfair')) === `fair ${pct(1 - imp(-110))}` && /Not on DraftKings’ slip yet: no betslip id in ESPN’s feed/.test(txt(rowAce)) && /^-110 real/.test(txt(rowAce.querySelector('.pb-px'))),
    `a player's row: the model's chance, DraftKings' fair chance, the line that he goes on DraftKings' slip by hand, DraftKings' price (${txt(rowAce)})`);
  const rowTot = lr2.find(tr => tr.dataset.pbRow === k(totO));
  check(rowTot && !rowTot.querySelector('.dkslip') && txt(rowTot.querySelector('[data-pb-p]')) === '50%', "the total, with its betslip id, carries no slip line, its chance the market's own (50%)");
  check(bd.querySelector('[data-sl-why]') && /untested on the NBA/.test(txt(bd.querySelector('[data-sl-why]'))) && /\$\d/.test(txt(bd.querySelector('[data-sl-why]'))), 'the same-game note: what multiplying would say, and the hold said untested');
  check([...bd.querySelectorAll('[data-drop], #pFinish, #pClear, [data-stake-chip], #pStake, #pBook')].every(h44), 'every builder control is 44px');
  check(p.d.querySelector('.pb-move') && p.d.querySelectorAll('.pb-move tbody tr').length === 1, 'the legs that move together are listed');

  /* ---------- 7. the Bet amount: one number, $1 to $100,000, cents kept ---------- */
  const SR = [['25', 25], [' 40 ', 40], ['7.5', 7.5], ['12.346', 12.35], ['$1,250', 1250], ['0.4', 1], ['100001', 100000], ['1e3', 1000], [60, 60], ['', null], ['  ', null], ['abc', null], ['-5', null], ['0', null], ['NaN', null], ['Infinity', null], [NaN, null], [Infinity, null], [-3, null], [0, null], [null, null], [undefined, null], [true, null], [{}, null]];
  const srBad = SR.filter(([v, want]) => { const g = p.w.eval(`stakeRead(${v === undefined ? 'undefined' : typeof v === 'number' && !isFinite(v) ? String(v) : JSON.stringify(v)})`); return g !== want; });
  check(!srBad.length, `stakeRead: an amount in dollars, $ and commas allowed, to the cent, $1 to $100,000, and nothing else an amount (${SR.length} cases)${srBad.length ? ': ' + JSON.stringify(srBad) : ''}`);
  const pbS = p.d.getElementById('pbStake');
  check(pbS && pbS.value === '20' && pbS.min === '1' && pbS.max === '100000' && pbS.getAttribute('inputmode') === 'decimal' && p.d.getElementById(pbS.getAttribute('aria-describedby')), 'the Bet amount box starts at $20, $1 to $100,000, the decimal keypad, its hint beside it');
  pbS.value = '37.5'; pbS.dispatchEvent(new p.w.Event('input', { bubbles: true })); await sleep(320);
  check(mine(p.w).stake === 37.5 && +p.d.getElementById('pStake').value === 37.5 && Math.abs(+p.d.querySelector('[data-payout]').dataset.payout - 37.5 * ob.dec) < 1e-9, 'typing an amount sets it, saved, and the builder follows a moment later');
  pbS.value = ''; pbS.dispatchEvent(new p.w.Event('input', { bubbles: true })); pbS.dispatchEvent(new p.w.Event('change', { bubbles: true })); await sleep(20);
  check(mine(p.w).stake === 37.5 && +pbS.value === 37.5, 'a box left empty, no amount, leaves the amount as it was');
  p.d.querySelector('[data-stake-chip="50"]').click(); await sleep(20);
  check(mine(p.w).stake === 50 && p.d.getElementById('pbStake').value === '50' && p.d.querySelector('[data-stake-chip="50"]').getAttribute('aria-pressed') === 'true' && p.d.querySelector('[data-payout]').textContent === '$' + (50 * ob.dec).toFixed(2), "the builder's one-tap amounts set the same number");
  const ps = p.d.getElementById('pStake'); ps.value = '12.5'; ps.dispatchEvent(new p.w.Event('input', { bubbles: true })); await sleep(10);
  check(p.d.getElementById('pbStake').value === '12.50' || p.d.getElementById('pbStake').value === '12.5', "the builder's own stake box sets it too, the panel's box following as it is typed");
  ps.dispatchEvent(new p.w.Event('change', { bubbles: true })); await sleep(20);
  check(mine(p.w).stake === 12.5 && !/NaN|Infinity|undefined/.test(txt(p.d.getElementById('tab-parlay'))), 'nothing drawn from it is NaN');
  for (const [v, want] of [['abc', 20], [-4, 20], [0, 20], [null, 20], ['<b>', 20], [250000, 100000], [12.5, 12.5]]) {
    const q2 = load(ST(), { lines: LINES, mine: { picks: {}, build: [], slip: { legs: [], stake: 20 }, stake: v }, tab: 'parlay' }); await sleep(300);
    check(q2.d.getElementById('pbStake') && +q2.d.getElementById('pbStake').value === want && q2.errors.length === 0, `a saved amount of ${JSON.stringify(v)} reads as $${want}`); }
  { const q3 = load(ST(), { lines: LINES, mine: { picks: {}, build: [], slip: { legs: [], stake: 33 } }, tab: 'parlay' }); await sleep(300);
    check(q3.d.getElementById('pbStake').value === '33', "where no Bet amount was saved, the old builder's stake is read as it, once"); }

  /* ---------- 8. Finish, Clear ALL, a game that tips while the page is open ---------- */
  p.d.getElementById('pFinish').click(); await sleep(20);
  const card = p.w.PARLAY_CARD.current(), money0 = [...p.d.querySelectorAll('#pcView .pc-money b')].map(x => x.textContent);
  check(!p.d.getElementById('pcBack').hidden && card && card.legs.length === 3 && card.stake === 12.5 && money0[0] === '$12.50' && money0[1] === '$' + (12.5 * ob.dec).toFixed(2) && [...p.d.querySelectorAll('#pcView .pc-legs li')].length === 3, "Finish parlay opens the card on the builder's legs and its Bet amount");
  check([...p.d.querySelectorAll('#pcView .pc-legs .pc-who')].map(x => x.textContent).join('|') === ordOwn.map(nameOwn).join('|') && txt(p.d.querySelector('#pcView .pc-price')).replace('−', '-') === am(ob.dec >= 2 ? (ob.dec - 1) * 100 : -100 / (ob.dec - 1)),
    "the card lists them in the builder's order, at the builder's price");
  p.d.getElementById('pcClose').click(); await sleep(20);
  check(p.d.activeElement === p.d.getElementById('pFinish'), 'closing the card gives the focus back to Finish parlay');
  /* A1 tips a second and a half from now */
  p.w.eval(`S.slate.find(g => g.id === ${JSON.stringify(A1.id)}).tip = ${JSON.stringify(new Date(Date.now() + 1500).toISOString())}`);
  await sleep(1700);
  for (const t of p.timers.filter(t => t.k === 'setInterval' && t.ms === 30000)) t.fn();
  await sleep(30);
  check(!gameIds().includes(A1.id) && !rows(p).some(li => rowRead(li).key.startsWith(A1.id)) && sl().length === 1 && /BOS at NYK has tipped off: its 2 legs left your parlay\./.test(p.d.getElementById('slSaid').textContent),
    `a game that tips while the page is open leaves the games, the list and the builder at the half-minute look, said once ("${p.d.getElementById('slSaid').textContent}")`);
  p.w.confirm = () => false; p.d.getElementById('pClear').click(); await sleep(20);
  check(sl().length === 1, 'Clear ALL asks first, and a no keeps the legs');
  p.w.confirm = () => true; p.d.getElementById('pClear').click(); await sleep(20);
  check(!sl().length && p.d.getElementById('pbTitle') && p.d.activeElement === p.d.getElementById('pbTitle') && /Add a line from the Top 50 above/.test(txt(p.d.getElementById('pbBuild'))), 'and a yes empties the builder, which says how to fill it');
  check(p.errors.length === 0, 'no script errors: ' + p.errors.join(' | '));

  /* ---------- 9. a press: newer reads over lines.json, in memory, nothing stored ---------- */
  {
    const ESPN_CODE = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
    const ev = (g, hml, aml) => ({ id: g.espn, date: g.tip, season: { year: SEASON, type: 2 }, competitions: [{ neutralSite: false, status: { type: { name: 'STATUS_SCHEDULED', completed: false } },
      odds: [{ provider: { id: '100', name: 'DraftKings' }, details: `${ESPN_CODE[g.home] || g.home} -1.5`, overUnder: 226.5, moneyline: { home: { close: { odds: hml } }, away: { close: { odds: aml } } } }],
      competitors: [{ homeAway: 'home', team: { abbreviation: ESPN_CODE[g.home] || g.home }, score: '0' }, { homeAway: 'away', team: { abbreviation: ESPN_CODE[g.away] || g.away }, score: '0' }] }] });
    const sb = { [ymd(A1.date)]: { events: [ev(A1, '-125', '+105'), ev(A2, '+120', '-140')] }, [ymd(A3.date)]: { events: [ev(A3, '-200', '+170')] } };
    const espn = async url => { const m = /dates=(\d{8})/.exec(url); if (/propBets/.test(url)) return { ok: false, status: 404, json: async () => ({ error: { code: 404 } }) };
      return { ok: true, status: 200, json: async () => clone(sb[m && m[1]] || { events: [] }) }; };
    const q = load(ST(), { lines: LINES, espn, tab: 'parlay' }); await sleep(300);
    const before = stored(q.w), mlKey = keyOwn({ id: A1.id, kind: 'ml', side: 'NYK', line: null });
    const rowOf = key => [...q.d.querySelectorAll('#pbPanel li.pb-trow')].find(li => rowRead(li).key === key);
    const fairPct = (a, b) => pct(imp(a) / (imp(a) + imp(b)));
    check(rowOf(mlKey) && plRead(rowOf(mlKey)).price === '-150' && plRead(rowOf(mlKey)).fair === fairPct(-150, 130) && plRead(rowOf(mlKey)).part === 'game', `before a press the Knicks' moneyline is lines.json's, -150, a game bet at its fair chance (${rowOf(mlKey) && plRead(rowOf(mlKey)).fair})`);
    const bt = q.d.querySelector('#pbPanel [data-espn-refresh]'); bt.focus(); bt.click(); await sleep(30);
    for (let i = 0; i < 400 && q.d.getElementById('oddsBar').classList.contains('busy'); i++) await sleep(25);
    await sleep(60);
    const r1 = rowOf(mlKey);
    check(r1 && plRead(r1).price === '-125' && plRead(r1).fair === fairPct(-125, 105) && plRead(r1).part === 'game' && !plRead(r1).marks && !q.d.querySelector('#pbPanel .pb-valmark'), `after a press the Knicks' moneyline is DraftKings' newer -125, at its fair chance with the margin out (${r1 && plRead(r1).fair}), no Value mark anywhere (${r1 && JSON.stringify(plRead(r1))})`);
    check(!q.d.querySelector(`#pbPanel [data-pb-leg^="${A1.id}|prop"]`), "and the press's props read (none posted, a 404) is newer than lines.json's, so the game has no player lines");
    check(stored(q.w) === before, 'nothing is stored by the press');
    check(q.d.activeElement && q.d.activeElement.dataset.espnRefresh === 'pb' && /DraftKings' lines from ESPN, read/.test(txt(q.d.getElementById('espnSt-pb'))), `the focus is back on the pressed button, its status line saying what was read ("${txt(q.d.getElementById('espnSt-pb')).slice(0, 80)}")`);
    const q2 = load(ST(), { lines: LINES, espn, tab: 'parlay' }); await sleep(300);
    const li2 = [...q2.d.querySelectorAll('#pbPanel li.pb-trow')].find(x => rowRead(x).key === mlKey);
    check(li2 && rowRead(li2).price === '-150' && !espnReqs(q2).length, 'a reload is the published lines again, and reads nothing from ESPN');
    check(q.errors.length === 0 && q2.errors.length === 0, 'no script errors: ' + q.errors.concat(q2.errors).join(' | '));
  }

  /* ---------- 9b. why the list is empty: no DraftKings line yet, on some games or all, or none qualifying ----------
     The owner's question of 7 November 2026 ("why is there no available parlay legs being recommended for tomorrows
     games? i think something must have broke"): on Friday evening Saturday's seven games had no DraftKings line read yet,
     and the list said "No line on your picks qualifies yet", as if lines were there and failed. Each case here is made
     up (lines.json's entries with no game line, as the job writes a game DraftKings has not priced; lines no team leg
     takes), worked out on this file's own reading of the lines and its own words, never the page's pbTopWhy; then a press
     that reads the games and finds no line dates the sentence by the press */
  {
    const NOGL = g => ({ at: RD, espn: g.espn, ml: null, spread: null, total: null, ids: null, props: null });
    /* lines no game bet takes on these games' numbers: each side's DraftKings fair chance outside 45% to 97% (98% and 2%;
       until 13 November 2026 each favourite under the model's chance, which no rule reads now: the cases bite below, on this
       file's own rule) */
    const COLD = { [A1.id]: { ml: { home: -10000, away: 5000 }, spread: { line: -3.5, home: -10000, away: 5000 } },
      [A2.id]: { ml: { home: 5000, away: -10000 }, spread: { line: -3.5, home: 5000, away: -10000 } },
      [A3.id]: { ml: { home: -10000, away: 5000 }, spread: { line: -3.5, home: -10000, away: 5000 } } };
    const cold = g => ({ at: RD, espn: g.espn, ...COLD[g.id], total: null, ids: null, props: null });
    const Lof = (games, at = RD) => ({ v: 1, at, games: Object.fromEntries(games.filter(Boolean).map(x => [x[0], x[1]])) });
    const IDS3 = [A1.id, A2.id, A3.id];
    const whenOwn = iso => new Date(iso).toLocaleString(undefined, { weekday: 'short', hour: 'numeric', minute: '2-digit' });
    /* this file's own reading: a game has DraftKings' game lines where its entry was read with a moneyline, spread or
       total, or a press found them. One with none was covered by a read where lines.json holds it with its game lines read
       (the entry's own at set: then "as of" the file's own at) or a press read it (its time), the later; the games all had
       none as of the oldest of those. A game no read covered (L null: lines.json did not load; no entry; its props alone)
       is not one DraftKings has none for: its lines "have not been read yet", or "did not load" */
    const hasGlOwn = (L, id, press) => !!((press && press[id] && press[id].lines) || (L && L.games[id] && L.games[id].at && (L.games[id].ml || L.games[id].spread || L.games[id].total)));
    const asOfOwn = (L, id, press) => { const t = [L && L.games[id] && L.games[id].at ? L.at : null, press && press[id] ? press[id].at : null].filter(Boolean).map(Date.parse); return t.length ? Math.max(...t) : null; };
    function noGlOwn(L, ids, press) {
      const miss = ids.filter(id => !hasGlOwn(L, id, press));
      if (!miss.length) return '';
      const of = n => n === ids.length ? (n === 1 ? 'your game' : `your ${n} games`) : `${n} of your ${ids.length} games`;
      const read = miss.filter(id => asOfOwn(L, id, press) != null), unread = miss.filter(id => asOfOwn(L, id, press) == null), out = [];
      if (read.length) out.push(`No DraftKings lines yet for ${of(read.length)} (as of ${whenOwn(Math.min(...read.map(id => asOfOwn(L, id, press))))}).`);
      if (unread.length) out.push(`DraftKings’ lines for ${of(unread.length)} ${L ? 'have not been read yet' : 'did not load'}.`);
      out.push(L ? 'The job reads them through the day; Refresh odds reads them now.' : 'Refresh odds reads them now.');
      return out.join(' ');
    }
    const TEAMS_OWN = { k: { ml: true, ats: true, total: true, over: false, under: false }, off: [] };
    const NOPL_OWN = 'No player prices yet: none have been read for these games; the job reads DraftKings\' player props through the day, and Refresh odds reads them now.';
    const mineK = k => ({ picks: {}, build: [], slip: { legs: [], stake: 20 }, pb: { k, off: [] } });
    const why = q => txt(q.d.querySelector('#pbPanel .pb-top-none'));
    const notesOf = q => [...q.d.querySelectorAll('#pbPanel .pb-note')].map(txt);
    /* L: the lines.json the page is served (an object, or 'junk' / 404 for a file that does not load) */
    const caseOf = async (L, k, wantWhy, what, wantRows = 0) => {
      const q = load(ST(), { lines: L, tab: 'parlay', mine: mineK(k) }); await sleep(300);
      const n = q.d.querySelectorAll('#pbPanel li.pb-trow').length, w = why(q);
      check(n === wantRows && w === wantWhy && !q.errors.length, `${what}: "${w}"${n !== wantRows ? ` (${n} rows)` : ''}${q.errors.length ? ': ' + q.errors.join(' | ') : ''}`);
      return q;
    };
    /* the cases bite: on this file's own rule, the cold lines leave nothing on the team boxes, and a game with no entry
       has no line */
    const ownRows = L => topOwn(ST(), L, TEAMS_OWN).rows.length;
    const Lall = Lof(IDS3.map(id => [id, NOGL(SLATE.find(g => g.id === id))]));
    const Lsome = Lof([[A1.id, cold(A1)], [A2.id, NOGL(A2)], [A3.id, NOGL(A3)]]), Lsome2 = Lof([[A1.id, cold(A1)], [A2.id, cold(A2)], [A3.id, NOGL(A3)]]);
    const Lcold = Lof(IDS3.map(id => [id, cold(SLATE.find(g => g.id === id))])), Lhot = Lof([[A1.id, LINES.games[A1.id]], [A2.id, NOGL(A2)], [A3.id, NOGL(A3)]]);
    /* a game whose entry holds its props alone (its game lines never read: at null), as tools/lines.js writes one; one with
       a spread alone, one with a total alone (at prices no leg takes: the total's two sides 98% and 2% with the margin out) */
    const PROPS_ONLY = g => ({ at: null, espn: g.espn, ml: null, spread: null, total: null, ids: null, props: { at: RD, mains: [], ladders: [], yes: [] } });
    const SPREAD_ONLY = g => ({ at: RD, espn: g.espn, ml: null, spread: COLD[g.id].spread, total: null, ids: null, props: null });
    const TOTAL_ONLY = g => ({ at: RD, espn: g.espn, ml: null, spread: null, total: { line: 228.5, over: -10000, under: 5000 }, ids: null, props: null });
    const Lprops = Lof(IDS3.map(id => [id, PROPS_ONLY(SLATE.find(g => g.id === id))])), Lmix = Lof([[A1.id, cold(A1)], [A2.id, NOGL(A2)]]);
    const Lhalf = Lof([[A1.id, SPREAD_ONLY(A1)], [A2.id, TOTAL_ONLY(A2)], [A3.id, NOGL(A3)]]);
    check(!ownRows(Lall) && !ownRows(Lsome) && !ownRows(Lsome2) && !ownRows(Lcold) && ownRows(Lhot) > 0 && IDS3.every(id => hasGlOwn(Lcold, id) && !hasGlOwn(Lall, id)),
      'the cases bite: on this file\'s own rule no team leg qualifies on the cold lines, the qualifying one does, and an entry with no game line is none');
    check(!ownRows(Lhalf) && !ownRows(Lmix) && !ownRows(Lprops) && hasGlOwn(Lhalf, A1.id) && hasGlOwn(Lhalf, A2.id) && !hasGlOwn(Lhalf, A3.id) && !Lhalf.games[A1.id].ml && !Lhalf.games[A2.id].ml && IDS3.every(id => asOfOwn(Lprops, id) == null && asOfOwn(Lall, id) != null) && asOfOwn(null, A1.id) == null,
      'and the new ones: a spread alone and a total alone are lines (no moneyline in either), none of them qualifying; an entry with its props alone, or a file that did not load, is no read of the game lines');
    /* 1. no line on any ticked game */
    const w1 = noGlOwn(Lall, IDS3);
    check(w1 === `No DraftKings lines yet for your 3 games (as of ${whenOwn(RD)}). The job reads them through the day; Refresh odds reads them now.`, `this file's own words for three games with none: "${w1}"`);
    let q = await caseOf(Lall, TEAMS_OWN.k, w1, 'no DraftKings line on any of the 3 ticked games, team bet types: the list says so plainly, as of lines.json\'s own time, never that a line failed to qualify');
    check(!/qualif/.test(why(q)) && !notesOf(q).some(t => /No DraftKings lines yet/.test(t)) && !/last read/.test(why(q)), 'and nothing on the tab says a line failed to qualify, nor says it twice in the notes, nor dates it "last read"');
    await caseOf(Lall, TICKS_ALL.k, `${w1} ${NOPL_OWN}`, 'the same with player bet types ticked: then, a sentence of its own, why there are no player lines');
    await caseOf(Lall, { ml: false, ats: false, total: false, over: true, under: true }, NOPL_OWN, 'player bet types alone: the player-lines reason alone, no game-line sentence');
    /* 1b. games no read has covered: no entry, an entry with its props alone, lines.json that did not load (junk, a 404):
       never "No DraftKings lines yet", which the page cannot know */
    const NEVER = 'DraftKings’ lines for your 3 games have not been read yet. The job reads them through the day; Refresh odds reads them now.';
    const ERR = 'DraftKings’ lines for your 3 games did not load. Refresh odds reads them now.';
    check(noGlOwn(Lof([]), IDS3) === NEVER && noGlOwn(Lprops, IDS3) === NEVER && noGlOwn(null, IDS3) === ERR, `this file's own words for games no read covered: "${noGlOwn(Lof([]), IDS3)}", and with lines.json not loading "${noGlOwn(null, IDS3)}"`);
    q = await caseOf(Lof([]), TEAMS_OWN.k, NEVER, 'no game in lines.json at all (never read): not read yet, never that DraftKings has none');
    await caseOf(Lprops, TEAMS_OWN.k, NEVER, 'every game in lines.json with its props alone (its game lines never read, at null): not read yet, and no time');
    for (const [L, nm] of [['junk', 'not JSON'], [404, 'a 404']]) {
      q = await caseOf(L, TEAMS_OWN.k, ERR, `lines.json that does not load (${nm}): the lines did not load, never that DraftKings has none`);
      check(notesOf(q).some(t => /^DraftKings’ published lines did not load/.test(t)) && !/No DraftKings lines yet/.test(why(q)) && !notesOf(q).some(t => /No DraftKings lines yet/.test(t)),
        `and the note over it says the same (${nm}): the two lines on the tab agree`);
      await caseOf(L, TICKS_ALL.k, `${ERR} ${NOPL_OWN}`, `the same (${nm}) with player bet types ticked: the player-lines reason after`);
    }
    /* 2. lines on some of the ticked games, none of them qualifying; then one that does, which the list shows with a note */
    const w2 = noGlOwn(Lsome, IDS3), w2b = noGlOwn(Lsome2, IDS3);
    check(/^No DraftKings lines yet for 2 of your 3 games \(as of / .test(w2) && /^No DraftKings lines yet for 1 of your 3 games /.test(w2b), `this file's own counts: "${w2.slice(0, 50)}…", "${w2b.slice(0, 50)}…"`);
    await caseOf(Lsome, TEAMS_OWN.k, `${w2} No line on the other game qualifies yet.`, 'lines on 1 of the 3 games, none qualifying: how many have none, as of when, then that the other game\'s lines do not qualify');
    await caseOf(Lsome2, TEAMS_OWN.k, `${w2b} No line on the other 2 games qualifies yet.`, 'lines on 2 of the 3, none qualifying');
    await caseOf(Lsome, TICKS_ALL.k, `${w2} No line on the other game qualifies yet. ${NOPL_OWN}`, 'and with player bet types ticked, the player-lines reason after');
    const wh = noGlOwn(Lhalf, IDS3);
    check(wh === `No DraftKings lines yet for 1 of your 3 games (as of ${whenOwn(RD)}). The job reads them through the day; Refresh odds reads them now.`, `this file's own words with a spread alone on one game and a total alone on another: "${wh}"`);
    await caseOf(Lhalf, TEAMS_OWN.k, `${wh} No line on the other 2 games qualifies yet.`, 'a spread alone, a total alone and a game with none: the first two are lines (none qualifying), the third has none');
    const wm = noGlOwn(Lmix, IDS3);
    check(wm === `No DraftKings lines yet for 1 of your 3 games (as of ${whenOwn(RD)}). DraftKings’ lines for 1 of your 3 games have not been read yet. The job reads them through the day; Refresh odds reads them now.`, `this file's own words with lines on one game, none on one and one never read: "${wm}"`);
    await caseOf(Lmix, TEAMS_OWN.k, `${wm} No line on the other game qualifies yet.`, 'lines on 1 of the 3 (none qualifying), none on 1, 1 never read: each said apart');
    q = await caseOf(Lhot, TEAMS_OWN.k, '', 'lines on 1 of the 3 games that qualify: the list has them, and no empty line', ownRows(Lhot));
    check(notesOf(q).filter(t => t === w2).length === 1, `and a note says, word for word, which games have no line yet ("${notesOf(q).find(t => /DraftKings lines yet/.test(t)) || 'none'}")`);
    const Lhot2 = Lof([[A1.id, LINES.games[A1.id]], [A2.id, NOGL(A2)]]), wn = noGlOwn(Lhot2, IDS3);
    q = await caseOf(Lhot2, TEAMS_OWN.k, '', 'lines on 1 that qualify, none on 1, 1 never read: the list has them', ownRows(Lhot2));
    check(notesOf(q).filter(t => t === wn).length === 1 && /have not been read yet/.test(wn), `and its note says each apart, word for word ("${notesOf(q).find(t => /DraftKings/.test(t) && /yet/.test(t)) || 'none'}")`);
    /* 3. lines on every ticked game, none qualifying: the "none qualifies" line, and no game-line sentence */
    await caseOf(Lcold, TEAMS_OWN.k, 'No line on your picks qualifies yet: tick more games or bet types.', 'lines on all 3, none qualifying, team bet types: none qualifies, tick more');
    q = await caseOf(Lcold, TICKS_ALL.k, `No line on your picks qualifies yet. ${NOPL_OWN}`, 'and with player bet types ticked: none qualifies, then the player-lines reason');
    check(!notesOf(q).some(t => /No DraftKings lines yet|have not been read yet/.test(t)), 'no note says a game has no line when every one has');
    /* 4. a press that reads the three games and finds no line posted dates the sentence by the press; one whose read of a
       date fails leaves that date's games as of the file's time, and the sentence as of the older; one after lines.json
       failed to load turns "did not load" into none, as of the press */
    {
      const ESPN_CODE = { GSW: 'GS', NOP: 'NO', NYK: 'NY', SAS: 'SA', UTA: 'UTAH', WAS: 'WSH' };
      const ev = g => ({ id: g.espn, date: g.tip, season: { year: SEASON, type: 2 }, competitions: [{ neutralSite: false, status: { type: { name: 'STATUS_SCHEDULED', completed: false } }, odds: [],
        competitors: [{ homeAway: 'home', team: { abbreviation: ESPN_CODE[g.home] || g.home }, score: '0' }, { homeAway: 'away', team: { abbreviation: ESPN_CODE[g.away] || g.away }, score: '0' }] }] });
      const sb = { [ymd(A1.date)]: { events: [ev(A1), ev(A2)] }, [ymd(A3.date)]: { events: [ev(A3)] } };
      const espnOf = down => async url => { const m = /dates=(\d{8})/.exec(url); if (/propBets/.test(url)) return { ok: false, status: 404, json: async () => ({ error: { code: 404 } }) };
        if (m && down && m[1] === down) return { ok: false, status: 503, json: async () => ({}) };
        return { ok: true, status: 200, json: async () => clone(sb[m && m[1]] || { events: [] }) }; };
      const press = async qp => { const t0 = Date.now(); qp.d.querySelector('#pbPanel [data-espn-refresh="pb"]').click(); await sleep(30);
        for (let i = 0; i < 400 && qp.d.getElementById('oddsBar').classList.contains('busy'); i++) await sleep(25);
        await sleep(60); const t1 = Date.now(), mins = []; for (let t = Math.floor(t0 / 60e3) * 60e3; t <= t1; t += 60e3) mins.push(new Date(t).toISOString()); return mins; };
      const LoldAt = at(now - 30 * H), Lold = { ...Lall, at: LoldAt };
      let qp = load(ST(), { lines: Lold, espn: espnOf(null), tab: 'parlay', mine: mineK(TEAMS_OWN.k) }); await sleep(300);
      check(why(qp) === noGlOwn(Lold, IDS3) && why(qp).includes(`(as of ${whenOwn(LoldAt)})`), `before the press the sentence gives lines.json's own time, a day old ("${why(qp).slice(0, 80)}")`);
      let mins = await press(qp), wants = mins.map(m => noGlOwn(Lold, IDS3, Object.fromEntries(IDS3.map(id => [id, { at: m, lines: false }]))));
      check(wants.includes(why(qp)) && !qp.errors.length, `after a press that finds no line, the sentence is dated by the press ("${why(qp)}")${qp.errors.length ? ': ' + qp.errors.join(' | ') : ''}`);
      qp = load(ST(), { lines: Lold, espn: espnOf(ymd(A3.date)), tab: 'parlay', mine: mineK(TEAMS_OWN.k) }); await sleep(300);
      mins = await press(qp); wants = mins.map(m => noGlOwn(Lold, IDS3, { [A1.id]: { at: m, lines: false }, [A2.id]: { at: m, lines: false } }));
      check(wants.includes(why(qp)) && why(qp).includes(`(as of ${whenOwn(LoldAt)})`) && !qp.errors.length, `a press that reads one date and fails the other: the sentence is as of the older of the games' own times, lines.json's, never the press's ("${why(qp)}")`);
      qp = load(ST(), { lines: 'junk', espn: espnOf(null), tab: 'parlay', mine: mineK(TEAMS_OWN.k) }); await sleep(300);
      check(why(qp) === ERR, `with lines.json not loading, before a press: "${why(qp)}"`);
      mins = await press(qp); wants = mins.map(m => noGlOwn(null, IDS3, Object.fromEntries(IDS3.map(id => [id, { at: m, lines: false }]))));
      check(wants.includes(why(qp)) && /^No DraftKings lines yet for your 3 games \(as of [^)]+\)\. Refresh odds reads them now\.$/.test(why(qp)) && !qp.errors.length, `and after a press that reads them all and finds no line: none, as of the press ("${why(qp)}")`);
    }
  }

  /* ---------- 10. the 50-line cut, on sixty made-up games ----------
     Moneyline only, on the trial with no player line: game i's home side at -(120 + i), its away side at +100, so each
     game's home side is the likelier (52.2% at game 0 to 56.2% at game 59, DraftKings' fair chance) and its margin grows
     with i: the order by expected on $1 is the games' own, and the list the first 50, games 50 to 59 left off (until 13
     November 2026 the cut was held on the model's Value picks and thin-edge lines) */
  {
    const TM = ['ATL', 'BOS', 'BKN', 'CHA', 'CHI', 'CLE', 'DAL', 'DEN', 'DET', 'GSW', 'HOU', 'IND', 'LAC', 'LAL', 'MEM', 'MIA', 'MIL', 'MIN', 'NOP', 'NYK', 'OKC', 'ORL', 'PHI', 'PHX', 'POR', 'SAC', 'SAS', 'TOR', 'UTA', 'WAS'];
    const G60 = [], L60 = { v: 1, at: RD, games: {} };
    for (let i = 0; i < 60; i++) {
      const ms = (i < 30 ? T1 : T2) + (i % 30) * 60e3, a = TM[i % 30], h = TM[(i % 30 + (i < 30 ? 1 : 2)) % 30];
      const g = game(ms, a, h, { pHome: 0.5, spread: -3 }); G60.push(g);
      L60.games[g.id] = { at: RD, espn: g.espn, ml: { home: -(120 + i), away: 100 }, spread: null, total: null, ids: { event: '8' + i, ml: { home: `0ML8${i}_1`, away: `0ML8${i}_3` }, spread: null, total: null }, props: null };
    }
    const st60 = ST({ slate: G60, props: { ...clone(props), games: {} } }), T60 = { k: { ml: true, ats: false, total: false, over: false, under: false }, off: [] };
    const q = load(st60, { lines: L60, tab: 'parlay', mine: { picks: {}, build: [], slip: { legs: [], stake: 20 }, pb: T60 } }); await sleep(400);
    const lis = rows(q), wantK = G60.slice(0, 50).map(g => keyOwn({ id: g.id, kind: 'ml', side: g.home, line: null }));
    const own60 = topOwn(st60, L60, T60), bad60 = listBad(lis, own60.rows);
    check(lis.length === 50 && JSON.stringify(lis.map(li => li.querySelector('[data-pb-leg]').dataset.pbLeg)) === JSON.stringify(wantK) && JSON.stringify(own60.rows.map(keyOwn)) === JSON.stringify(wantK) && !bad60.length,
      `sixty games, Moneyline only: the list is the first 50 of their order, each game's home side by its margin, the tightest first (-120 to -169), games 50 to 59 left off${bad60.length ? ': ' + bad60.slice(0, 2).join(' | ') : ''}`);
    check(own60.over === 60 && q.w.getPbTop().over === 60 && own60.G === 60 && own60.g === 50, 'and 60 qualified for the 50 the list holds');
    const sec = [...q.d.querySelectorAll('#pbPanel h3.pb-topsec')].map(txt);
    check(sec.join('|') === 'Game bets 50' && /^Top 50 lines/.test(txt(q.d.querySelector('#pbPanel h2'))) && !q.d.querySelector('#pbPanel .pb-trial, #pbPanel .pb-valmark'), 'under "Top 50 lines", one part, "Game bets 50", no on-trial or Value mark on a game bet');
    check(q.errors.length === 0, 'no script errors: ' + q.errors.join(' | '));
  }

  /* ---------- 11. lines.json that does not load, and the off-season ---------- */
  {
    const q = load(ST(), { lines: 'junk', tab: 'parlay' }); await sleep(300);
    const none = txt(q.d.querySelector('#pbPanel .pb-top-none'));
    check(/The published lines did not load/.test(txt(q.d.getElementById('espnSt-pb'))) && /did not load/.test(txt(q.d.querySelector('#pbPanel .pb-note'))) && !q.d.querySelectorAll('#pbPanel li.pb-trow').length && q.errors.length === 0
      && none.startsWith('DraftKings’ lines for your 3 games did not load. Refresh odds reads them now.') && !/No DraftKings lines yet|qualif/.test(none), `a lines.json that does not load lists nothing, says so in the status line, the note and the empty line alike ("${none.slice(0, 90)}"), and throws nothing`);
    const q2 = load(ST({ slate: [A4, A6].map(clone) }), { lines: LINES, tab: 'parlay' }); await sleep(300);
    check(/No game is left to build a parlay from/.test(txt(q2.d.getElementById('pbPanel'))) && !q2.d.getElementById('pbStake') && q2.errors.length === 0, 'with no game to come but a preseason one, the tab says there is nothing to build from, with no controls');
  }

  /* ---------- 12. the real state.json and lines.json, on what the day offers ---------- */
  {
    const LF = path.join(ROOT, 'lines.json'), realLines = fs.existsSync(LF) ? JSON.parse(fs.readFileSync(LF, 'utf8')) : undefined;
    const q = load(REAL, { lines: realLines, tab: 'parlay' }); await sleep(600);
    const st = { ...REAL, today: etDate(Date.now()) }, games = gamesOwn(st), soon = games.some(g => Math.abs(Date.parse(g.tip) - Date.now()) < 120e3);
    const r = [...q.d.querySelectorAll('#pbPanel li.pb-trow')].map(rowRead);
    if (!games.length) check(/No game is left/.test(txt(q.d.getElementById('pbPanel'))), 'on the real state with no game to come, the tab says there is nothing to build from');
    else if (soon) check(true, 'on the real state a game tips within two minutes: the list is not compared this run');
    else {
      /* the game bets and, once the props model has failed, the Player lines at DraftKings' odds (topOwn) */
      const ownR = topOwn(st, realLines, TICKS_ALL), lis = [...q.d.querySelectorAll('#pbPanel li.pb-trow')], badR = listBad(lis, ownR.rows);
      check(r.length === ownR.rows.length && !badR.length, `on the real state and lines.json, the list is this file's own, line for line (${r.length} lines over ${games.length} games: ${ownR.g} game bets of ${ownR.G}, ${ownR.n} player lines of ${ownR.P})${badR.length ? ': ' + badR.slice(0, 2).join(' | ') : ''}`);
      const topR = q.w.getPbTop(), totR = lis.filter(li => li.dataset.pbGrp === 'game' && /\|total\|/.test(li.querySelector('[data-pb-leg]').dataset.pbLeg)).map(li => li.querySelector('[data-pb-fair]').getAttribute('title'));
      check(topR.noId === ownR.gb.noId && topR.gVig === ownR.gb.vig && totR.every(t => !/model/i.test(t)),
        `on the real files the game bets left out are counted a line at a time, as this file counts them (${topR.noId} for want of an id, ${topR.gVig} priced with no margin), and no total's title names a model chance (${totR.length} totals)`);
    }
    check(!/\bNaN\b|\bundefined\b/.test(txt(q.d.getElementById('tab-parlay'))) && q.errors.length === 0, 'the real tab shows no NaN or undefined and throws nothing');
    check(SIGMA_OWN === +q.w.eval('SIGMA') && SIG_FILE.fold === 2026 && SIG_FILE.lineup === 'known', `the page prices a spread on research/sigma.json's sigma (${SIGMA_OWN}, the 2026 fold, lineup known)`);
  }
};
