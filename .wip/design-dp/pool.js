/* The one-ruler pool, in the page's realm (evaluated into the booted window): every team leg (each side's moneyline and
 * spread, the total's over and under) and every player's main line, over and under, of the night's games still to tip,
 * each at DraftKings' fair chance by the page's own legFair (a team line's two prices in proportion, a main line's whole
 * margin on the Over), held to the builder's band (45% to 97%) on that chance, never the model's; no far-off guard (the
 * model's chance ranks nothing). Then the filters: the bet-type boxes (ml, ats, total, over, under), the games ticked
 * off, the stats ticked off, and the shortest leg (null: any; -500, -300, -200: no leg shorter than that).
 * A prototype of what the first build called spPoolFair; it reads only the page's primitives. */
module.exports = String.raw`
var DP_KINDS = ['ml', 'ats', 'total', 'over', 'under'];
function dpUi(o) {
  o = o || {};
  const k = {}; for (const x of DP_KINDS) k[x] = !(o.k && o.k[x] === false);
  return { k, off: Array.isArray(o.off) ? o.off.slice() : [], st: Array.isArray(o.st) ? o.st.slice() : [], short: Number.isFinite(o.short) ? o.short : null };
}
const dpKind = l => l.kind === 'ml' ? 'ml' : l.kind === 'spread' ? 'ats' : l.kind === 'total' ? 'total' : l.side === 'under' ? 'under' : 'over';
function dpPool(N, uo) {
  const u = dpUi(uo), games = N.games.filter(spToTip), legs = [];
  const cnt = { band: 0, noId: 0, vig: 0, held: 0, none: 0, kind: 0, game: 0, stat: 0, short: 0, lines: 0 };
  const noVig = (a, b) => propImplied(a) + propImplied(b) < 1;
  const take = (v, nm) => {
    if (!u.k[dpKind(v)]) { cnt.kind++; return; }
    if (u.off.includes(v.gid)) { cnt.game++; return; }
    if (v.kind === 'prop' && u.st.includes(v.stat)) { cnt.stat++; return; }
    if (u.short != null && v.price < 0 && v.price < u.short) { cnt.short++; return; }
    const f = legFair(v); if (!f || f.est || !(f.p > 0 && f.p < 1)) { cnt.band++; return; }
    if (!(f.p >= PB_PMIN && f.p < PB_PMAX)) { cnt.band++; return; }
    legs.push(Object.assign({}, v, { pm: v.p, p: f.p, thin: true, pl: v.kind === 'prop' }));
  };
  for (const g of games) {
    const base = { id: g.id, away: g.away, home: g.home, date: g.date, tip: g.tip }, gl = pbGl(g.id), on = pbCarries(gl);
    if (gl) {
      const b = Object.assign({}, base, { at: gl.at });
      const team = (kind, s, line, odds, other, dk) => {
        if (!Number.isFinite(odds) || !odds || !Number.isFinite(other) || !other) { cnt.band++; return; }
        if (noVig(odds, other)) { cnt.vig++; return; }
        const v = pbView(Object.assign({}, b, { kind, side: s, line, odds, other, dk: dk || null }), on);
        if (v.dkOn && !v.dk) { cnt.noId++; return; }
        take(v);
      };
      if (gl.ml) for (const s of ['away', 'home']) team('ml', g[s], null, gl.ml[s].odds, gl.ml[s === 'home' ? 'away' : 'home'].odds, gl.ml[s].id);
      if (gl.spread) for (const s of ['away', 'home']) team('spread', g[s], gl.spread[s].line, gl.spread[s].odds, gl.spread[s === 'home' ? 'away' : 'home'].odds, gl.spread[s].id);
      if (gl.total) for (const s of ['over', 'under']) { const v0 = gl.total[s], o0 = gl.total[s === 'over' ? 'under' : 'over'];
        if (!Number.isFinite(v0.odds) || !Number.isFinite(o0.odds) || !v0.odds || !o0.odds) { cnt.band++; continue; }
        if (noVig(v0.odds, o0.odds)) { cnt.vig++; continue; }
        const v = pbView(Object.assign({}, b, { kind: 'total', side: s, line: gl.total.line, odds: v0.odds, other: o0.odds, dk: v0.id || null }), on);
        if (v.dkOn && !v.dk) { cnt.noId++; continue; }
        take(v); }
    }
    const pr = pbPr(g.id); if (!pr || !Array.isArray(pr.mains)) continue;
    for (const m of pr.mains) {
      if (!m || !PROP_STATS.includes(m.stat) || !Number.isFinite(m.line) || !Number.isFinite(m.over) || !Number.isFinite(m.under) || !m.over || !m.under) continue;
      const w = pbWho(g, m.player);
      if (!w) { cnt.none += 2; continue; }
      if (spOutWhy(m.player, g.id)) { cnt.held += 2; continue; }
      if (noVig(m.over, m.under)) { cnt.vig += 2; continue; }
      for (const side of ['over', 'under']) { cnt.lines++;
        take(pbView(Object.assign({}, base, { kind: 'prop', pid: m.player, name: w.name, team: w.team, at: pr.at, stat: m.stat, mk: 'main', line: m.line, side, odds: side === 'over' ? m.over : m.under, other: side === 'over' ? m.under : m.over }))); }
    }
  }
  legs.sort(pbOrd);
  return { games, legs, cnt, u };
}
`;
