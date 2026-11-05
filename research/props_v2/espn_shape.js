/* What ESPN's feed still holds for an older game, by provider, read the way tools/props_feed.js reads DraftKings' answer.
 *
 *   node research/props_v2/espn_shape.js            writes results/espn_shape.json (counts only: no line or price is kept)
 *
 * For each (event, provider): every page of propBets at limit 1000, through curl (the container's proxy), held in memory;
 * the market types it carries; propParse's main lines, ladders and Yes prices; the main lines by stat; how many of their
 * players the box score lists as playing (ESPN's athlete id is the hub's player id); and, as a check that the first item
 * of a pair is still the Over for this provider, the share of graded main lines that went over beside the mean fair Over
 * (the whole margin on the Over) and the share of pairs whose first item is nearer the "k+" rung at line + 0.5. Seasons
 * up to 2026 only; nothing is fitted or scored against a model.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const F = require('../../tools/props_feed.js');
const PR = require('../../tools/props.js');

const OUTD = path.join(__dirname, 'results');
const B = 'https://sports.core.api.espn.com/v2/sports/basketball/leagues/nba/events';
const CASES = [
  ['2023_20230416_LAC_PHX', '401540757', 40], ['2023_20230416_LAC_PHX', '401540757', 47],
  ['2024_20240421_DAL_LAC', '401654763', 40], ['2024_20240421_DAL_LAC', '401654763', 58],
  ['2025_20241101_BOS_CHA', '401704698', 58], ['2025_20250301_BKN_DET', '401705427', 58], ['2025_20250301_BKN_DET', '401705427', 59],
  ['2025_20250420_GSW_HOU', '401767823', 58],
  ['2026_20251022_BKN_CHA', '401809933', 58], ['2026_20260115_ATL_POR', '401810440', 100], ['2026_20260417_CHA_ORL', '401866758', 100],
];
const get = url => { const t = execFileSync('curl', ['-sS', '-m', '30', url], { encoding: 'utf8', maxBuffer: 64 << 20 }); return JSON.parse(t); };
function readAll(E, p) {
  const pages = [];
  for (let page = 1; page <= 20; page++) {
    const j = get(`${B}/${E}/competitions/${E}/odds/${p}/propBets?lang=en&region=us&limit=1000&page=${page}`);
    if (!j || !Array.isArray(j.items)) return { status: 'none', pages };
    pages.push(j); if (page >= (+j.pageCount || 1)) break;
  }
  return { status: 'ok', items: F.propItems(pages) };
}
const boxes = PR.loadBoxes();
const out = [];
for (const [gid, E, p] of CASES) {
  const r = readAll(E, p);
  if (r.status !== 'ok') { out.push({ gid, E, provider: p, status: r.status }); continue; }
  const types = {}; for (const it of r.items) { const k = (it.type && (it.type.id + ' ' + (it.type.name || ''))) || '?'; types[k] = (types[k] || 0) + 1; }
  const P = F.propParse(r.items);
  const played = {}; for (const rows of Object.values(boxes[gid] || {})) for (const b of rows) if (b.min > 0 && !b.dnp) played[b.id] = b.y;
  const byStat = {}; let onBox = 0, over = 0, fair = 0, n = 0, near = 0, nearN = 0;
  const rung = new Map(P.ladders.map(l => [l.player + '|' + l.stat + '|' + l.k, l.price]));
  for (const m of P.mains) {
    byStat[m.stat] = (byStat[m.stat] || 0) + 1;
    const y = played[m.player];
    if (y) { onBox++; const v = PR.yOf(y, m.stat); if (v !== m.line) { n++; over += v > m.line ? 1 : 0; fair += F.propFairOver(m.over, m.under); } }
    const rp = rung.get(m.player + '|' + m.stat + '|' + (m.line + 0.5));
    if (rp != null) { nearN++; const ir = F.propImplied(rp); if (Math.abs(ir - F.propImplied(m.over)) <= Math.abs(ir - F.propImplied(m.under))) near++; }
  }
  const lastUpdated = r.items.map(it => it.lastUpdated).filter(Boolean).sort();
  out.push({ gid, E, provider: p, status: 'ok', items: r.items.length, types, mains: P.mains.length, ladders: P.ladders.length, yes: P.yes.length, dropped: P.dropped, byStat,
    mainsOnPlayersWhoPlayed: onBox, graded: n, overRate: n ? +(over / n).toFixed(3) : null, meanFairOver: n ? +(fair / n).toFixed(3) : null,
    firstNearerRung: nearN ? `${near}/${nearN}` : null, lastUpdatedRange: [lastUpdated[0], lastUpdated[lastUpdated.length - 1]] });
  const o = out[out.length - 1];
  console.log(gid, p, `items ${o.items} mains ${o.mains} (on players who played ${o.mainsOnPlayersWhoPlayed}) ladders ${o.ladders} yes ${o.yes}`, JSON.stringify(o.byStat), `over ${o.overRate} fair ${o.meanFairOver} first-nearer ${o.firstNearerRung}`, JSON.stringify(o.dropped), o.lastUpdatedRange.join(' .. '));
  console.log('   types:', JSON.stringify(o.types));
}
fs.mkdirSync(OUTD, { recursive: true });
fs.writeFileSync(path.join(OUTD, 'espn_shape.json'), JSON.stringify({ generated: new Date().toISOString().slice(0, 16) + 'Z', what: 'research/props_v2/espn_shape.js: what ESPN keeps for older games, by provider (counts only)', cases: out }, null, 1) + '\n');
