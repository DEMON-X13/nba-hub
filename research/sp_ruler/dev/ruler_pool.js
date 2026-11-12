/* ---------- THE RULER: the pool on its filters (sets taken from RULER_FROM) ---------- (dev copy) */
const SPR_SHORT = [null, -500, -300, -200];
function spRulerClean(v) {
  const o = v && typeof v === 'object' ? v : {}, k = {};
  for (const [id] of PB_KINDS) k[id] = !(o.k && o.k[id] === false);
  const off = Array.isArray(o.off) ? [...new Set(o.off.filter(x => typeof x === 'string' && /^[\w-]{3,40}$/.test(x)))].slice(-64) : [];
  const st = Array.isArray(o.st) ? [...new Set(o.st.filter(x => PROP_STATS.includes(x)))] : [];
  return { k, off, st, short: SPR_SHORT.includes(o.short) ? o.short : null };
}
const spRulerAll = v => { const u = spRulerClean(v); return PB_KINDS.every(([id]) => u.k[id]) && !u.off.length && !u.st.length && u.short == null; };
function spRulerAllows(l, u) {
  return !!u.k[pbKind(l)] && !u.off.includes(l.gid || l.id) && !(l.kind === 'prop' && u.st.includes(l.stat)) && !(u.short != null && !(l.price >= u.short));
}
/* one candidate leg on the ruler: DraftKings' price and the other side's on file with a margin, its fair chance (legFair)
   in the band, a game line's betslip id where its game carries ids, and the filters. Returns the ruler leg or the reason it
   is left out ('vig', 'band', 'noId', 'filt'); a player leg's reasons are counted in pl */
function spRulerLeg(v0, isPl, u) {
  if (!Number.isFinite(v0.price) || !v0.price) return 'band';
  if (!Number.isFinite(v0.other) || !v0.other || propImplied(v0.price) + propImplied(v0.other) < 1) return 'vig';
  const f = legFair(v0); if (!f || f.est || !(f.p > 0 && f.p < 1) || !(f.p >= PB_PMIN && f.p < PB_PMAX)) return 'band';
  if (!isPl && v0.dkOn && !v0.dk) return 'noId';
  if (!spRulerAllows(v0, u)) return 'filt';
  const l = { ...v0, pm: v0.p, p: f.p, thin: true, ruler: true };
  if (isPl) l.pl = true; if (l.kind === 'total') l.market = true; else delete l.market;
  return l;
}
function spRulerPool(N, v) {
  const u = spRulerClean(v), games = N.games.filter(spToTip), legs = [], cnt = { band: 0, noId: 0, vig: 0, filt: 0 };
  const pl = { lines: 0, band: 0, held: 0, none: 0, vig: 0, filt: 0 };
  const take = (v0, isPl) => { const r = spRulerLeg(v0, isPl, u); if (typeof r === 'string') { if (isPl) pl[r === 'noId' ? 'band' : r]++; else cnt[r]++; } else legs.push(r); };
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
      for (const side of ['over', 'under']) {
        pl.lines++;
        take(pbView({ ...base, kind: 'prop', pid: m.player, name: w.name, team: w.team, at: pr.at, stat: m.stat, mk: 'main', line: m.line, side, odds: side === 'over' ? m.over : m.under, other: side === 'over' ? m.under : m.over }), true);
      }
    }
  }
  legs.sort(pbOrd);
  return { games, legs, band: cnt.band, far: 0, noId: cnt.noId, vig: cnt.vig, filt: cnt.filt, pl, u, rule: 'fair' };
}
