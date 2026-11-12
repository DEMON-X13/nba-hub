/* How far back ESPN's game summaries keep a box score the hub could read, and what each carries: four games a season
 * (two finals on each of two regular-season dates), from 1992-93 to 2023-24. Research only: it keeps the shape of each
 * answer (which fields, how many athletes, which flags, the form a minutes or plus-minus value takes, the did-not-play
 * reasons), never a stat, a score or a line, and writes research/props_v3/results/espn_depth.json. Three requests a
 * date (the day's scoreboard, two summaries).
 *
 *   node research/props_v3/espn_depth.js
 *
 * No 2022-23 (the one-shot test's season) or 2026-27 (the season in play) game is asked for. Seasons from 2004-05 on
 * take the regular-season dates nearest 1 December and 1 March with five or more games in data/games.csv (whose ESPN
 * ids start in 2021-22, so every game's id is read off the scoreboard); earlier seasons fixed early-December and
 * early-March dates (the 1998-99 lockout season's from February). A form is one of: whole (digits), signed (a sign and
 * digits), zero ('0'), clock (m:ss), dash ('--'), blank ('' or none) or other. Each summary is also kept as one compact
 * record (its event, date, whether it has a box, and per side the counts above), so a season's gaps show game by game.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

const ROOT = path.join(__dirname, '..', '..');
const OUT = path.join(__dirname, 'results', 'espn_depth.json');
const SITE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
const SKIP = new Set([2023, 2027]);
const FIRST = 1993, LAST = 2024, PER_DATE = 2;
const EARLY = { 1999: ['1999-02-24', '1999-04-07'] };
for (let s = FIRST; s <= 2004; s++) if (!EARLY[s]) EARLY[s] = [`${s - 1}-12-03`, `${s}-03-04`];

const getJSON = url => {
  const o = execFileSync('curl', ['-sS', '-m', '30', '-w', '\n%{http_code}', url], { encoding: 'utf8', maxBuffer: 64 << 20 });
  const k = o.lastIndexOf('\n'), code = o.slice(k + 1);
  return { code, json: code === '200' ? JSON.parse(o.slice(0, k)) : null };
};
const G = fs.readFileSync(path.join(ROOT, 'data', 'games.csv'), 'utf8').trim().split('\n'), gh = G.shift().split(','), gc = n => gh.indexOf(n);
function datesFor(season) {
  if (EARLY[season]) return EARLY[season];
  const per = {};
  for (const l of G) { const v = l.split(','); if (+v[gc('season')] === season && v[gc('type')] === 'REG') per[v[gc('date')]] = (per[v[gc('date')]] || 0) + 1; }
  const near = t => Object.keys(per).filter(d => per[d] >= 5).sort((a, b) => Math.abs(Date.parse(a) - t) - Math.abs(Date.parse(b) - t) || (a < b ? -1 : 1))[0];
  return [near(Date.parse(`${season - 1}-12-01`)), near(Date.parse(`${season}-03-01`))];
}
const formOf = x => { const s = x == null ? '' : String(x).trim(); return s === '' ? 'blank' : s === '--' ? 'dash' : s === '0' ? 'zero' : /^\d+$/.test(s) ? 'whole' : /^[+-]\d+$/.test(s) ? 'signed' : /^\d+:\d\d$/.test(s) ? 'clock' : 'other'; };
const add = (m, k, n = 1) => { m[k] = (m[k] || 0) + n; return m; };

function shapeOf(j) {
  const box = j.boxscore || {}, comp = ((j.header || {}).competitions || [])[0] || {};
  const sides = (box.players || []).map(tp => {
    const st = (tp.statistics || [])[0] || {}, keys = st.keys || [], labels = st.labels || [];
    const ath = st.athletes || [];
    const ix = (k, l) => keys.indexOf(k) >= 0 ? keys.indexOf(k) : labels.indexOf(l);
    const mi = ix('minutes', 'MIN'), pi = ix('plusMinus', '+/-');
    const played = ath.filter(a => !a.didNotPlay && (a.stats || []).length);
    const minForm = {}, pmForm = {};
    for (const a of played) { add(minForm, mi < 0 ? 'blank' : formOf(a.stats[mi])); add(pmForm, pi < 0 ? 'blank' : formOf(a.stats[pi])); }
    const dnp = ath.filter(a => a.didNotPlay);
    return { athletes: ath.length, starters: ath.filter(a => a.starter).length, played: played.length, minForm, pmForm,
      minWhole: (minForm.whole || 0) + (minForm.zero || 0),
      flags: [...new Set(ath.flatMap(a => Object.keys(a).filter(k => k !== 'athlete' && k !== 'stats')))].sort(),
      didNotPlay: dnp.length, dnpWithReason: dnp.filter(a => a.reason).length, reasons: [...new Set(dnp.map(a => a.reason).filter(Boolean))].sort(),
      ejected: ath.filter(a => a.ejected).length, keys: keys.length };
  });
  const inj = (j.injuries || []).flatMap(t => t.injuries || []);
  const injDates = inj.map(x => String(x.date || '').slice(0, 10)).filter(Boolean).sort();
  return { boxscoreAvailable: comp.boxscoreAvailable === true, boxscoreSource: comp.boxscoreSource || null, sides,
    teamStatistics: (box.teams || []).map(t => (t.statistics || []).length), plays: (j.plays || []).length,
    officials: ((j.gameInfo || {}).officials || []).length, pickcenter: (j.pickcenter || []).length,
    injuriesListed: inj.length, injuriesDated: injDates.length ? [injDates[0], injDates[injDates.length - 1]] : null };
}

const seasons = []; for (let s = FIRST; s <= LAST; s++) if (!SKIP.has(s)) seasons.push(s);
const out = { generated: null, what: 'research/props_v3/espn_depth.js: four games a season (two finals on each of two regular-season dates), the shape of each ESPN game summary (fields, flags, the forms values take, counts, did-not-play reasons); no stat, score or line is kept',
  requests: 0, skipped: [...SKIP], seasons: {} };
for (const s of seasons) {
  const agg = { dates: [], games: [], summaries: 0, withBox: 0, sides: 0, sidesFiveStarters: 0, played: 0, minForm: {}, pmForm: {}, didNotPlay: 0, dnpWithReason: 0,
    reasons: new Set(), flags: new Set(), withPlays: 0, withOfficials: 0, withPickcenter: 0, withTeamStatistics: 0, injuriesDated: [], sources: {}, errors: [] };
  for (const d of datesFor(s)) {
    agg.dates.push(d);
    let sb;
    try { sb = getJSON(`${SITE}scoreboard?limit=100&dates=${d.replace(/-/g, '')}`); out.requests++; } catch (e) { agg.errors.push(`${d} scoreboard: ${String(e.message).split('\n')[0]}`); continue; }
    const fin = (sb.json ? sb.json.events || [] : []).filter(e => (((e.status || {}).type || {}).completed)).slice(0, PER_DATE);
    for (const e of fin) {
      let su;
      try { su = getJSON(`${SITE}summary?event=${e.id}`); out.requests++; } catch (err) { agg.errors.push(`${e.id}: ${String(err.message).split('\n')[0]}`); continue; }
      if (!su.json) { agg.errors.push(`${e.id}: HTTP ${su.code}`); continue; }
      const sh = shapeOf(su.json);
      agg.summaries++;
      agg.games.push({ event: String(e.id), date: d, box: sh.sides.some(x => x.athletes > 0), source: sh.boxscoreSource, plays: sh.plays,
        sides: sh.sides.map(x => ({ athletes: x.athletes, starters: x.starters, played: x.played, minWhole: x.minWhole, pmSigned: x.pmForm.signed || 0, pmZero: x.pmForm.zero || 0, dnp: x.didNotPlay, dnpWithReason: x.dnpWithReason })) });
      add(agg.sources, sh.boxscoreSource || 'none');
      if (sh.sides.some(x => x.athletes > 0)) agg.withBox++;
      for (const x of sh.sides) {
        agg.sides++; if (x.starters === 5) agg.sidesFiveStarters++;
        agg.played += x.played; agg.didNotPlay += x.didNotPlay; agg.dnpWithReason += x.dnpWithReason;
        for (const [k, n] of Object.entries(x.minForm)) add(agg.minForm, k, n);
        for (const [k, n] of Object.entries(x.pmForm)) add(agg.pmForm, k, n);
        x.reasons.forEach(r => agg.reasons.add(r)); x.flags.forEach(f => agg.flags.add(f));
      }
      if (sh.plays) agg.withPlays++; if (sh.officials) agg.withOfficials++; if (sh.pickcenter) agg.withPickcenter++;
      if (sh.teamStatistics.some(n => n > 0)) agg.withTeamStatistics++;
      if (sh.injuriesDated) agg.injuriesDated.push(...sh.injuriesDated);
    }
  }
  const dated = agg.injuriesDated.sort();
  out.seasons[s] = { ...agg, reasons: [...agg.reasons].sort().slice(0, 12), reasonsDistinct: agg.reasons.size, flags: [...agg.flags].sort(),
    injuriesDated: dated.length ? [dated[0], dated[dated.length - 1]] : null };
  const a = out.seasons[s];
  console.log(s, a.dates.join(' '), `summaries ${a.summaries}, box ${a.withBox}, sides 5 starters ${a.sidesFiveStarters}/${a.sides}, played ${a.played} min ${JSON.stringify(a.minForm)} pm ${JSON.stringify(a.pmForm)}, dnp ${a.didNotPlay} reasoned ${a.dnpWithReason}, pbp ${a.withPlays}, ${a.errors.length ? a.errors.join('; ') : ''}`);
}
out.generated = new Date().toISOString().slice(0, 16) + 'Z';
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n');
console.log(`wrote ${path.relative(ROOT, OUT)} (${out.requests} requests)`);
