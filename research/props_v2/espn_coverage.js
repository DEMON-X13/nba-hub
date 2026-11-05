/* Which past games does ESPN's feed still answer DraftKings' player props for? One limit=1 request a game a provider:
 * only the HTTP status and the item count are read, no line is kept.
 *
 *   node research/props_v2/espn_coverage.js         writes results/espn_coverage.tsv and results/espn_coverage.json
 *   node research/props_v2/espn_coverage.js --early writes results/espn_coverage_early.*: every fourth game of 2020-21
 *                                                    and 2021-22 (seasons 2021 and 2022), providers 40 and 100
 *
 * DraftKings is provider 100 on ESPN now and was provider 40 before (the odds list of a 2023 or 2024 playoff game names
 * 40 "DraftKings"; research/props_v2/espn_probe.sh). Every game of 2025-26 (season 2026, regular season and play-in and
 * playoffs) is asked of provider 100 (and of 40 one game in four); every fourth game of 2022-23 to 2024-25 (seasons
 * 2023-2025) is asked of both. Six requests at a time, through curl (the container's proxy).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFile } = require('child_process');
const ROOT = path.join(__dirname, '..', '..');
const OUTD = path.join(__dirname, 'results');
const B = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events';

const lines = fs.readFileSync(path.join(ROOT, 'data', 'games.csv'), 'utf8').trim().split('\n');
const h = lines.shift().split(',');
const col = n => h.indexOf(n);
const EARLY = process.argv.includes('--early');
const [S0, S1] = EARLY ? [2021, 2022] : [2023, 2026];
const TAG = EARLY ? 'espn_coverage_early' : 'espn_coverage';
const games = lines.map(l => l.split(',')).map(v => ({ id: v[col('game_id')], season: +v[col('season')], date: v[col('date')], type: v[col('type')], espn: v[col('espn_id')], status: v[col('status')] }))
  .filter(g => g.season >= S0 && g.season <= S1 && g.type !== 'PRE' && g.status === 'final' && g.espn)
  .sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.id < b.id ? -1 : 1);
const jobs = [];
games.forEach((g, i) => {
  if (g.season === 2026) { jobs.push([g, 100]); if (i % 4 === 0) jobs.push([g, 40]); }
  else if (i % 4 === 0) { jobs.push([g, 100]); jobs.push([g, 40]); }
});
const ask = (g, p) => new Promise(res => execFile('curl', ['-sS', '-m', '30', '-w', '\n%{http_code}', `${B}/${g.espn}/competitions/${g.espn}/odds/${p}/propBets?lang=en&region=us&limit=1`], { encoding: 'utf8' }, (err, out) => {
  const s = String(out || ''), k = s.lastIndexOf('\n'), code = s.slice(k + 1), body = s.slice(0, k);
  let n = null; try { n = JSON.parse(body).count ?? 0; } catch (e) { n = null; }
  res({ g, p, code: err && !code ? 'err' : code, n });
}));
(async () => {
  const res = []; let next = 0;
  const worker = async () => { while (next < jobs.length) { const j = jobs[next++]; const r = await ask(...j); if (r.code !== '200' && r.code !== '404') { const r2 = await ask(...j); res.push(r2); } else res.push(r); } };
  await Promise.all(Array.from({ length: 6 }, worker));
  res.sort((a, b) => a.g.date < b.g.date ? -1 : a.g.date > b.g.date ? 1 : a.g.id < b.g.id ? -1 : a.g.id > b.g.id ? 1 : a.p - b.p);
  const at = new Date().toISOString().slice(0, 16) + 'Z';
  fs.mkdirSync(OUTD, { recursive: true });
  fs.writeFileSync(path.join(OUTD, TAG + '.tsv'), 'game_id\tseason\ttype\tdate\tespn_id\tprovider\thttp\titems\n' + res.map(r => [r.g.id, r.g.season, r.g.type, r.g.date, r.g.espn, r.p, r.code, r.n].join('\t')).join('\n') + '\n');
  /* by season, kind of game and month: asked, answered with items */
  const sum = {};
  for (const r of res) {
    const kind = r.g.type === 'POST' ? 'playoffs' : (r.g.season === 2026 && r.g.date >= '2026-04-14') ? 'play-in' : 'regular season';
    const k = `${r.g.season}|${kind}|${r.g.date.slice(0, 7)}|${r.p}`;
    const s = sum[k] = sum[k] || { season: r.g.season, kind, month: r.g.date.slice(0, 7), provider: r.p, asked: 0, withProps: 0, notFound: 0, other: 0, items: [] };
    s.asked++; if (r.code === '200' && r.n > 0) { s.withProps++; s.items.push(r.n); } else if (r.code === '404') s.notFound++; else s.other++;
  }
  const rows = Object.values(sum).map(s => { const it = s.items.sort((a, b) => a - b); return { ...s, items: undefined, medianItems: it.length ? it[Math.floor(it.length / 2)] : null }; });
  fs.writeFileSync(path.join(OUTD, TAG + '.json'), JSON.stringify({ generated: at, what: 'research/props_v2/espn_coverage.js: which past games ESPN answers DraftKings player props for (provider 100 now, 40 before); counts only', requests: res.length, rows }, null, 1) + '\n');
  console.table(rows.map(r => ({ season: r.season, kind: r.kind, month: r.month, p: r.provider, asked: r.asked, withProps: r.withProps, notFound: r.notFound, other: r.other, medItems: r.medianItems })));
})();
