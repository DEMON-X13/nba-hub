// Times the prototype search on every case the task lists: each real night of tools/fixtures/sp_nights.json, 10
// November's pre-lock files, the committed files' 11 and 12 November nights, one- and two-game cuts of them, and the
// filter cases (Player unders off, Overs only, Teams only, Players only, shortest -300). Writes results.json beside it.
//   node run_all.js [group ...]      groups: alt10 alt11 repo11 repo12 fx (default all)
'use strict';
const fs = require('fs'), path = require('path');
const { boot, REPO } = require('./boot');
const { PAGE_POOL } = require('./pool');
const { PAGE_SEARCH2 } = require('./search2');
const ALT = path.resolve(__dirname, '..', '..', 'alt', 'site');
const FX = JSON.parse(fs.readFileSync(path.join(REPO, 'tools', 'fixtures', 'sp_nights.json'), 'utf8'));
const FILTERS = {
  default: {},
  unders_off: { k: { under: false } },
  overs_only: { k: { ml: false, ats: false, total: false, under: false } },
  teams_only: { k: { over: false, under: false } },
  players_only: { k: { ml: false, ats: false, total: false } },
  short300: { short: -300 },
};
const want = process.argv.slice(2);
const on = g => !want.length || want.includes(g);
const results = [];
async function runNight(w, label, getLegsExpr, gids, opt) {
  /* the whole night, each one-game cut, two-game cuts (all pairs, or the first `pairs` of them) */
  const cuts = [['all', null]];
  for (const g of gids) cuts.push(['1:' + g.slice(14), [g]]);
  const pairs = []; for (let i = 0; i < gids.length; i++) for (let j = i + 1; j < gids.length; j++) pairs.push([gids[i], gids[j]]);
  for (const p of pairs.slice(0, opt.pairs == null ? pairs.length : opt.pairs)) cuts.push(['2:' + p.map(g => g.slice(14)).join('+'), p]);
  for (const [fname, filt] of Object.entries(FILTERS)) {
    if (opt.filters && !opt.filters.includes(fname)) continue;
    for (const [cname, cut] of cuts) {
      if (cname !== 'all' && opt.cutFilters && !opt.cutFilters.includes(fname)) continue;
      const r = w.eval(`(() => { const legs0 = ${getLegsExpr(filt)}, cut = ${JSON.stringify(cut)};
        const legs = cut ? legs0.filter(l => cut.includes(l.gid)) : legs0; const out = { legs: legs.length, lv: [] };
        let tot = 0;
        for (const F of [2, 4, 8]) { SG_CACHE.clear(); const z = BNB2.level(legs, F, { cap: 4e6 }); tot += z.ms || 0;
          out.lv.push({ F, ms: z.ms, kind: z.kind, n0: z.n0, p: z.p, d: z.d, C: z.C, Ps: z.Ps, nodes: z.nodes, capped: z.capped, orth: z.orth, ghk: z.ghk, why: z.why,
            legs: z.legs ? z.legs.map(l => l.name + ' ' + l.label + ' ' + l.price) : null }); }
        out.ms = tot; return out; })()`);
      results.push({ night: label, filter: fname, cut: cname, ...r });
      const lv = r.lv.map(x => `${x.F}:${x.ms == null ? '-' : x.ms.toFixed(0)}ms/${x.kind ? x.kind[0] : '-'}${x.n0 || ''}${x.capped ? '!CAP' : ''}`).join(' ');
      console.log(`${label.padEnd(8)} ${fname.padEnd(13)} ${cname.padEnd(16)} legs ${String(r.legs).padStart(4)}  set ${r.ms.toFixed(0).padStart(5)} ms  ${lv}`);
    }
  }
}
(async () => {
  if (on('alt10') || on('alt11')) {
    const w = await boot({ data: ALT, now: '2026-11-10T21:57:09Z' }); w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2);
    for (const [grp, nid] of [['alt10', '2027_20261110_NIGHT'], ['alt11', '2027_20261111_NIGHT']]) {
      if (!on(grp)) continue;
      const gids = w.eval(`spTakes().find(n => n.id === '${nid}').games.filter(spToTip).map(g => g.id).sort()`);
      await runNight(w, grp, f => `bnbPoolFair(spTakes().find(n => n.id === '${nid}'), ${JSON.stringify(f)}).legs`, gids, grp === 'alt11' ? { pairs: 6, filters: ['default', 'short300'] } : {});
    }
  }
  if (on('repo11') || on('repo12')) {
    const w = await boot({ data: REPO, now: '2026-11-11T22:55:00Z' }); w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2);
    for (const [grp, nid] of [['repo11', '2027_20261111_NIGHT'], ['repo12', '2027_20261112_NIGHT']]) {
      if (!on(grp)) continue;
      const N = w.eval(`(() => { const N = spTakes().find(n => n.id === '${nid}'); return N ? N.games.filter(spToTip).map(g => g.id).sort() : null; })()`);
      if (!N) { console.log('no night', nid); continue; }
      await runNight(w, grp, f => `bnbPoolFair(spTakes().find(n => n.id === '${nid}'), ${JSON.stringify(f)}).legs`, N, grp === 'repo11' ? { pairs: 12 } : {});
    }
  }
  if (on('fx')) {
    const w = await boot({ data: REPO, now: '2026-11-11T22:55:00Z' }); w.eval(PAGE_POOL); w.eval(PAGE_SEARCH2);
    w.eval(`S.corr = ${JSON.stringify(FX.corr)}`);
    for (const [name, night] of Object.entries(FX.nights)) {
      w.eval(`window.__FXN = ${JSON.stringify(night)}`);
      const gids = Object.keys(night.games).sort();
      await runNight(w, 'fx:' + name, f => `bnbFixtureLegs(window.__FXN, ${JSON.stringify(f)})`, gids,
        name === 'nov7' ? { pairs: 21 } : name === 'nov10' ? { pairs: 15 } : { pairs: 4, cutFilters: ['default'] });
    }
  }
  fs.writeFileSync(path.join(__dirname, 'results' + (want.length ? '_' + want.join('_') : '') + '.json'), JSON.stringify(results, null, 1));
  const all = results.flatMap(r => r.lv.map(x => ({ ...x, night: r.night, filter: r.filter, cut: r.cut })));
  const slow = [...all].sort((a, b) => (b.ms || 0) - (a.ms || 0)).slice(0, 12);
  console.log('\nslowest levels:'); for (const x of slow) console.log(`  ${x.ms && x.ms.toFixed(0)} ms  ${x.night} ${x.filter} ${x.cut} F=${x.F} ${x.kind} n0=${x.n0} nodes=${x.nodes} orth=${x.orth} ghk=${x.ghk}${x.capped ? ' CAPPED' : ''}`);
  const sets = [...results].sort((a, b) => b.ms - a.ms).slice(0, 8);
  console.log('slowest sets:'); for (const r of sets) console.log(`  ${r.ms.toFixed(0)} ms  ${r.night} ${r.filter} ${r.cut} (${r.legs} legs)`);
  console.log(`levels ${all.length}, capped ${all.filter(x => x.capped).length}, over 300 ms ${all.filter(x => x.ms > 300).length}, sets over 300 ms ${results.filter(r => r.ms > 300).length}, sets over 1 s ${results.filter(r => r.ms > 1000).length}`);
  process.exit(0);
})();
