// The night's pool on ONE RULER (every leg at DraftKings' fair chance, legFair), with the filters, as page code
// evaluated in the booted window. Prototype of the change's spPoolFair; the page's own spPool is left untouched.
'use strict';
const PAGE_POOL = String.raw`
/* the filters: mix boxes (ml, ats, total, over, under), games off, stats off, shortest leg (an American price: a leg
   priced shorter than it is left out; null keeps every leg) */
window.bnbFilt = function (f) {
  f = f || {}; const k = {}; for (const id of ['ml', 'ats', 'total', 'over', 'under']) k[id] = !(f.k && f.k[id] === false);
  return { k, off: Array.isArray(f.off) ? f.off : [], stats: Array.isArray(f.stats) ? f.stats : [], short: Number.isFinite(f.short) ? f.short : null };
};
window.bnbAllows = function (l, f) {
  const kind = l.kind === 'ml' ? 'ml' : l.kind === 'spread' ? 'ats' : l.kind === 'total' ? 'total' : l.side === 'under' ? 'under' : 'over';
  if (!f.k[kind]) return false;
  if (f.off.includes(l.gid || l.id)) return false;
  if (l.kind === 'prop' && f.stats.includes(l.stat)) return false;
  if (f.short != null && l.price < f.short) return false;
  return true;
};
/* every leg of the night's games still to tip at DraftKings' fair chance: the team legs' two prices in proportion, a
   total's the same, a player's main line with the whole margin on the Over (legFair); the builder's band 45% to 97% on
   that chance; no far-off guard (no model chance ranks a leg); the betslip id rule on game legs; no line priced with no
   margin. The model's chance rides along as pm (information only) */
window.bnbPoolFair = function (N, filt) {
  const f = bnbFilt(filt), games = N.games.filter(spToTip), legs = [];
  const noVig = (a, b) => propImplied(a) + propImplied(b) < 1;
  const team = c => {
    if (!Number.isFinite(c.price) || c.price === 0 || !Number.isFinite(c.other) || !c.other) return;
    if (noVig(c.price, c.other)) return;
    const fr = legFair(c); if (!fr || fr.est || !(fr.p > 0 && fr.p < 1)) return;
    if (!(fr.p >= PB_PMIN && fr.p < PB_PMAX)) return;
    if (c.dkOn && !c.dk) return;
    const l = { ...c, pm: c.p, p: fr.p, thin: true }; if (c.kind === 'total') l.market = true;
    if (bnbAllows(l, f)) legs.push(l);
  };
  for (const c of pbPriced(games)) if (c.kind === 'ml' || c.kind === 'spread') team(c);
  for (const g of games) for (const c of pbTotals(g)) team(c);
  for (const g of games) {
    const pr = pbPr(g.id); if (!pr || !Array.isArray(pr.mains)) continue;
    const base = { id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip };
    for (const m of pr.mains) {
      if (!m || !PROP_STATS.includes(m.stat) || !Number.isFinite(m.line) || !Number.isFinite(m.over) || !Number.isFinite(m.under) || !m.over || !m.under) continue;
      const w = pbWho(g, m.player); if (!w || spOutWhy(m.player, g.id) || noVig(m.over, m.under)) continue;
      for (const side of ['over', 'under']) {
        const v = pbView({ ...base, kind: 'prop', pid: m.player, name: w.name, team: w.team, at: pr.at, stat: m.stat, mk: 'main', line: m.line, side, odds: side === 'over' ? m.over : m.under, other: side === 'over' ? m.under : m.over });
        const fr = legFair(v); if (!fr || fr.est || !(fr.p >= PB_PMIN && fr.p < PB_PMAX)) continue;
        const l = { ...v, pm: v.p, p: fr.p, thin: true, pl: true };
        if (bnbAllows(l, f)) legs.push(l);
      }
    }
  }
  legs.sort(pbOrd);
  return { games, legs };
};
/* a fixture night's legs (tools/fixtures/sp_nights.json rows) back to the page's legs, each at its fair chance */
window.bnbFixtureLegs = function (night, filt) {
  const f = bnbFilt(filt), out = [];
  const skOf = l => l.kind === 'prop' ? [l.gid, 'prop', l.pid, l.stat, l.mk, l.line, l.side].join('|') : [l.gid, l.kind, l.side, l.line == null ? '' : l.line].join('|');
  for (const a of night.legs) {
    const [away, home, tip] = night.games[a[0]];
    let l;
    if (a[1] === 'prop') { const [gid, kind, pid, tm, opp, stat, mk, line, side, odds, other, p] = a;
      l = { id: gid, away, home, tip, kind, pid, team: tm, stat, mk, line, side, odds, other, gid, p, price: odds, opp, name: 'P' + pid, pl: true }; }
    else { const [gid, kind, side, line, odds, other, p, tm, opp] = a;
      l = { id: gid, away, home, tip, kind, side, line, odds, other, gid, p, price: odds, team: tm, opp, name: side };
      if (kind === 'total') l.market = true; }
    l.sk = skOf(l); l.date = tip.slice(0, 10);
    const fr = legFair(l); if (!fr || !(fr.p >= PB_PMIN && fr.p < PB_PMAX)) continue;
    l.pm = l.p; l.p = fr.p;
    if (bnbAllows(l, f)) out.push(l);
  }
  return out.sort((a, b) => a.sk < b.sk ? -1 : a.sk > b.sk ? 1 : 0);
};
`;
module.exports = { PAGE_POOL };
