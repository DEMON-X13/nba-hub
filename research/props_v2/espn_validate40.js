/* Can DraftKings' older answers on ESPN (provider 40, 2022-23 to April 2024) be used as closing lines? A sample of games,
 * read whole and held in memory; only counts and DraftKings' own scores are kept.
 *
 *   node research/props_v2/espn_validate40.js       writes results/espn_validate40.json
 *
 * The sample: from results/espn_coverage.tsv, every 10th game of 2022-23's and of 2023-24's regular seasons that answered
 * for provider 40, and every playoff game of either that answered. For each: the event's start time (ESPN's event), every
 * propBets page, tools/props_feed.js propParse, and the box score (ESPN's athlete id is the hub's player id). Measured:
 *   - main lines a game, by stat; items that are not main lines (turnovers and the rest)
 *   - main lines on players the box lists as playing, not playing or not at all
 *   - the margin (the two implied chances summed, less 1)
 *   - which item of a pair is the Over: the log loss of DraftKings' fair chance (the whole margin on the Over) reading the
 *     first item as the Over, and reading it as the Under (README "DraftKings' props on ESPN's feed": 0.680 against 0.729
 *     on provider 100's archive)
 *   - whether the prices are pre-game: the log loss and Brier of the fair chance against the 2026 playoff archive's 0.6788
 *     and 0.2430 (a price taken during the game would know part of the result and score far lower), the share of Overs,
 *     and the items' lastUpdated against the start time (lastUpdated runs about three hours ahead of UTC on provider 100's
 *     answers; on these it is read as given and the gap reported both ways)
 * Nothing is fitted, and no model is scored on these lines: they are kept clean as a possible held-out set.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const F = require('../../tools/props_feed.js');
const PR = require('../../tools/props.js');
const OUTD = path.join(__dirname, 'results');
const B = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events';
const get = url => JSON.parse(execFileSync('curl', ['-sS', '-m', '30', url], { encoding: 'utf8', maxBuffer: 64 << 20 }));
const clip = p => Math.min(Math.max(p, 1e-6), 1 - 1e-6);
const r4 = x => Math.round(x * 1e4) / 1e4;
const quant = (a, q) => { const s = [...a].sort((x, y) => x - y); if (!s.length) return null; const i = (s.length - 1) * q, lo = Math.floor(i), hi = Math.ceil(i); return s[lo] + (s[hi] - s[lo]) * (i - lo); };

const cov = fs.readFileSync(path.join(OUTD, 'espn_coverage.tsv'), 'utf8').trim().split('\n').slice(1).map(l => l.split('\t'))
  .filter(v => v[5] === '40' && v[6] === '200' && +v[7] > 0 && (v[1] === '2023' || v[1] === '2024'));
const sample = [];
for (const s of ['2023', '2024']) {
  const reg = cov.filter(v => v[1] === s && v[2] === 'REG'); reg.forEach((v, i) => { if (i % 10 === 0) sample.push(v); });
  cov.filter(v => v[1] === s && v[2] === 'POST').forEach(v => sample.push(v));
}
const boxes = PR.loadBoxes();
const agg = {}; const per = [];
const A = k => agg[k] = agg[k] || { games: 0, items: 0, mains: 0, byStat: {}, nonMain: {}, played: 0, notPlayed: 0, notOnBox: 0, margins: [], st: {}, llFirstOver: 0, llFirstUnder: 0, br: 0, over: 0, fair: 0, n: 0, gapH: [] };
for (const v of sample) {
  const [gid, season, type, , E] = v;
  const ev = get(`${B}/${E}?lang=en&region=us`);
  const start = Date.parse(ev.date);
  const pages = [];
  for (let page = 1; page <= 20; page++) { const j = get(`${B}/${E}/competitions/${E}/odds/40/propBets?lang=en&region=us&limit=1000&page=${page}`); if (!j || !Array.isArray(j.items)) break; pages.push(j); if (page >= (+j.pageCount || 1)) break; }
  const items = F.propItems(pages);
  const P = F.propParse(items);
  const box = {}; for (const rows of Object.values(boxes[gid] || {})) for (const b of rows) box[b.id] = b;
  const a = A(`${season} ${type === 'POST' ? 'playoffs' : 'regular season'}`);
  a.games++; a.items += items.length; a.mains += P.mains.length;
  for (const it of items) { const id = F.propTypeId(it); if (!F.PROP_MAIN[id]) { const k = it.type ? it.type.name : '?'; a.nonMain[k] = (a.nonMain[k] || 0) + 1; } }
  for (const m of P.mains) {
    a.byStat[m.stat] = (a.byStat[m.stat] || 0) + 1;
    const io = F.propImplied(m.over), iu = F.propImplied(m.under); a.margins.push(io + iu - 1);
    const b = box[m.player];
    if (!b) { a.notOnBox++; continue; }
    if (!(b.min > 0) || b.dnp) { a.notPlayed++; continue; }
    a.played++;
    const y = PR.yOf(b.y, m.stat); if (y === m.line) continue;
    const o = y > m.line ? 1 : 0, pf = clip(1 - iu), pr = clip(1 - io);      // first item read as the Over / as the Under
    a.llFirstOver -= o ? Math.log(pf) : Math.log(1 - pf); a.llFirstUnder -= o ? Math.log(pr) : Math.log(1 - pr);
    a.br += (pf - o) ** 2; a.over += o; a.fair += pf; a.n++;
    const t = a.st[m.stat] = a.st[m.stat] || { n: 0, llO: 0, llU: 0, over: 0, fair: 0, even: 0 };
    t.n++; t.llO -= o ? Math.log(pf) : Math.log(1 - pf); t.llU -= o ? Math.log(pr) : Math.log(1 - pr); t.over += o; t.fair += pf; t.even += Math.abs(pf - 0.5) <= 0.1 ? 1 : 0;
  }
  const lu = items.map(it => Date.parse(it.lastUpdated)).filter(Number.isFinite);
  const gap = lu.length ? (Math.max(...lu) - start) / 3.6e6 : null;
  if (gap != null) a.gapH.push(gap);
  per.push({ gid, E, items: items.length, mains: P.mains.length, start: ev.date, lastUpdatedMax: lu.length ? new Date(Math.max(...lu)).toISOString().slice(0, 16) + 'Z' : null, hoursAfterStart: gap == null ? null : Math.round(gap * 100) / 100 });
}
const out = {};
for (const [k, a] of Object.entries(agg)) out[k] = { games: a.games, itemsPerGame: Math.round(a.items / a.games), mainsPerGame: Math.round(a.mains / a.games), byStat: a.byStat, nonMainItems: a.nonMain,
  onPlayersWhoPlayed: a.played, onPlayersListedNotPlaying: a.notPlayed, onPlayersNotOnBox: a.notOnBox, graded: a.n,
  marginMedian: r4(quant(a.margins, 0.5)), marginP10: r4(quant(a.margins, 0.1)), marginP90: r4(quant(a.margins, 0.9)),
  loglossFirstIsOver: r4(a.llFirstOver / a.n), loglossFirstIsUnder: r4(a.llFirstUnder / a.n), brier: r4(a.br / a.n), overRate: r4(a.over / a.n), meanFairOver: r4(a.fair / a.n),
  byStatScores: Object.fromEntries(Object.entries(a.st).map(([k, t]) => [k, { n: t.n, llFirstIsOver: r4(t.llO / t.n), llFirstIsUnder: r4(t.llU / t.n), overRate: r4(t.over / t.n), meanFairOver: r4(t.fair / t.n), shareFair40to60: r4(t.even / t.n) }])),
  lastUpdatedHoursAfterStart: { p10: r4(quant(a.gapH, 0.1)), median: r4(quant(a.gapH, 0.5)), p90: r4(quant(a.gapH, 0.9)) } };
/* the same by stat on the 2026 playoff archive (provider 100, data/props_2026.csv, its sides known), for comparison */
{
  const REC = require('../../tools/props_record.js');
  const st = {};
  for (const l of REC.readRecord(2026)) {
    const b = (Object.values(boxes[l.game_id] || {}).flat()).find(x => x.id === l.player_id);
    if (!b || !(b.min > 0) || b.dnp) continue;
    const y = PR.yOf(b.y, l.stat); if (y === l.line) continue;
    const o = y > l.line ? 1 : 0, pf = clip(F.propFairOver(l.over, l.under));
    const t = st[l.stat] = st[l.stat] || { n: 0, ll: 0, over: 0, fair: 0, even: 0 };
    t.n++; t.ll -= o ? Math.log(pf) : Math.log(1 - pf); t.over += o; t.fair += pf; t.even += Math.abs(pf - 0.5) <= 0.1 ? 1 : 0;
  }
  out['2026 play-in and playoffs archive (provider 100), for comparison'] = { byStatScores: Object.fromEntries(Object.entries(st).map(([k, t]) => [k, { n: t.n, ll: r4(t.ll / t.n), overRate: r4(t.over / t.n), meanFairOver: r4(t.fair / t.n), shareFair40to60: r4(t.even / t.n) }])) };
}
fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, 'espn_validate40.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v2/espn_validate40.js: DraftKings provider 40 on ESPN, a sample checked (counts and DraftKings\' own scores only)', groups: out, games: per }, null, 1) + '\n');
for (const [k, g] of Object.entries(out)) { console.log(k); console.table(g.byStatScores); }
console.table(per.slice(0, 12));
