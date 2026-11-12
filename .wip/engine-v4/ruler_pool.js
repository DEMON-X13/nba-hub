/* ---------- THE RULER: the pool on its filters (sets taken from RULER_FROM) ----------
   The owner's call of 11 November 2026, after a night of team filler like the Knicks at -1040 in the sets: "i dont want to
   never use team odds. i want it to be like the nfl stuff where i can turn on and off filters to fit what I want. i just
   find it hard to believe that team odds are always the best and always overtake player legs". So every leg of a set
   taken from RULER_FROM stands on one ruler, DraftKings' own fair chance (legFair, as the rest of the page reads it: a
   team line's and a total's two prices with the margin taken out in proportion, a player's main line with the whole
   margin on the Over), and a set is built on the visitor's filters (the site's own set, the record's, on every filter on):
   - the five boxes the Parlay Builder's mix sets (pbKind: Moneyline, Spread, Game total, Player overs, Player unders);
   - the night's games, any of them off;
   - the player stats the page offers (PROP_STATS), any of them off;
   - the shortest leg: Any, -500, -300 or -200 (a leg priced shorter than it, such as -1040 against -300, is left out).
   The team model's chance rides along (pm) as information for a title, never ranking a leg; no leg carries a Value mark
   (thin true on every leg) and there is no far-off guard (a leg's chance is DraftKings' own, so it is never far off it).
   Every other rule is spPool's: DraftKings' price with both sides on file and a margin (a line priced with no margin is
   left out, vig, a team line now too: under one ruler no leg may return over its price), the builder's band (45% to 97%
   by the fair chance), the betslip id rule on game lines, a player's main line on a stat the page offers on a player the
   props model places on one of the game's clubs whom the report does not list. Counted: band, noId, vig, filt (the
   filters' own), and the player lines' pl as spPool counts them, with pl.filt */
const SPR_SHORT = [null, -500, -300, -200];
/* the filters as kept: { k: the five boxes, off: the games off, st: the stats off, short: the shortest leg or null }.
   Anything not of that shape reads as every filter on */
function spRulerClean(v) {
  const o = v && typeof v === 'object' ? v : {}, k = {};
  for (const [id] of PB_KINDS) k[id] = !(o.k && o.k[id] === false);
  const off = Array.isArray(o.off) ? [...new Set(o.off.filter(x => typeof x === 'string' && /^[\w-]{3,40}$/.test(x)))].slice(-64) : [];
  const st = Array.isArray(o.st) ? [...new Set(o.st.filter(x => PROP_STATS.includes(x)))] : [];
  return { k, off, st, short: SPR_SHORT.includes(o.short) ? o.short : null };
}
/* every filter on: the site's own set */
const spRulerAll = v => { const u = spRulerClean(v); return PB_KINDS.every(([id]) => u.k[id]) && !u.off.length && !u.st.length && u.short == null; };
/* a leg on the filters: its box on, its game on, its stat on (a player's), and no shorter than the shortest leg */
function spRulerAllows(l, u) {
  return !!u.k[pbKind(l)] && !u.off.includes(l.gid || l.id) && !(l.kind === 'prop' && u.st.includes(l.stat)) && !(u.short != null && !(l.price >= u.short));
}
function spRulerPool(N, v) {
  const u = spRulerClean(v), games = N.games.filter(spToTip), legs = [];
  let band = 0, noId = 0, vig = 0, filt = 0;
  const pl = { lines: 0, band: 0, held: 0, none: 0, vig: 0, filt: 0 }, noVig = (a, b) => propImplied(a) + propImplied(b) < 1;
  const take = (v0, isPl) => {
    if (!Number.isFinite(v0.price) || !v0.price) return;
    if (!Number.isFinite(v0.other) || !v0.other || noVig(v0.price, v0.other)) { if (isPl) pl.vig++; else vig++; return; }
    const f = legFair(v0); if (!f || f.est || !(f.p >= PB_PMIN && f.p < PB_PMAX)) { if (isPl) pl.band++; else band++; return; }
    if (!isPl && v0.dkOn && !v0.dk) { noId++; return; }
    if (!spRulerAllows(v0, u)) { if (isPl) pl.filt++; else filt++; return; }
    const l = { ...v0, pm: v0.p, p: f.p, thin: true, ruler: true };
    if (isPl) l.pl = true; if (l.kind === 'total') l.market = true; else delete l.market;
    legs.push(l);
  };
  for (const c of pbPriced(games)) if (c.kind === 'ml' || c.kind === 'spread') take(c, false);
  for (const g of games) for (const c of pbTotals(g)) take(c, false);
  for (const g of games) {
    const pr = pbPr(g.id); if (!pr || !Array.isArray(pr.mains)) continue;
    const base = { id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip };
    for (const m of pr.mains) {
      if (!m || !PROP_STATS.includes(m.stat) || !Number.isFinite(m.line) || !Number.isFinite(m.over) || !Number.isFinite(m.under) || !m.over || !m.under) continue;
      const w = pbWho(g, m.player);
      if (!w) { pl.none += 2; continue; }
      if (spOutWhy(m.player, g.id)) { pl.held += 2; continue; }
      if (noVig(m.over, m.under)) { pl.vig += 2; continue; }
      for (const side of ['over', 'under']) {
        pl.lines++;
        const v0 = pbView({ ...base, kind: 'prop', pid: m.player, name: w.name, team: w.team, at: pr.at, stat: m.stat, mk: 'main', line: m.line, side, odds: side === 'over' ? m.over : m.under, other: side === 'over' ? m.under : m.over });
        const f = legFair(v0); if (!f || f.est || !(f.p >= PB_PMIN && f.p < PB_PMAX)) { pl.band++; continue; }
        if (!spRulerAllows(v0, u)) { pl.filt++; continue; }
        legs.push({ ...v0, pm: v0.p, p: f.p, thin: true, pl: true, ruler: true });
      }
    }
  }
  legs.sort(pbOrd);
  return { games, legs, band, far: 0, noId, vig, filt, pl, u, rule: 'fair' };
}
