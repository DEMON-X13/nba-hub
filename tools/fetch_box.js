/* Box scores, the injury report and the coaches, from ESPN's public feeds.
 *
 *   node nba-hub/tools/fetch_box.js                 every final from the 2022 season on that has no box score yet,
 *                                               then today's injury report and each team's coach
 *   node nba-hub/tools/fetch_box.js --from 2022 --to 2026 --budget 300   (seasons, minutes)
 *   node nba-hub/tools/fetch_box.js --offline summary.json                (parse one saved payload, for tests)
 *
 * Writes, per season, nba-hub/data/box_<season>.csv (one row per player per game: minutes and the box line)
 * and nba-hub/data/teambox_<season>.jsonl (one line per team per game: every team statistic the feed gives).
 * A game's ESPN id comes from the games table when the daily fetch stored it, else from the scoreboard
 * for that day (one request per day, so a season of history costs about 1,500 requests). The first
 * payload read is saved as nba-hub/data/sample_summary.json for inspection. A game whose payload cannot be
 * parsed is logged and skipped; the run fails only if nothing at all could be read.
 *
 * nba-hub/data/injuries.json is today's report (status per player per team) and nba-hub/data/injuries_log.csv
 * keeps one line per player per day so availability can be replayed later. nba-hub/data/coaches_espn.json
 * is each team's head coach as the roster feed lists them today, and nba-hub/data/rosters_espn.json the roster.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const L = require('./lib');

const DATA = path.join(L.ROOT, 'nba-hub', 'data');
const BASE = 'https://site.api.espn.com/apis/site/v2/sports/basketball/nba/';
const args = process.argv.slice(2);
const opt = (k, d) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : d; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const FROM = +opt('--from', 2022), TO = +opt('--to', 9999), BUDGET = +opt('--budget', 300) * 60000;

const PCOLS = ['game_id', 'date', 'team', 'opp', 'home', 'player_id', 'name', 'pos', 'starter', 'min', 'fgm', 'fga', 'tpm', 'tpa', 'ftm', 'fta', 'orb', 'drb', 'ast', 'stl', 'blk', 'tov', 'pf', 'pm', 'pts', 'dnp'];
/* the feed names a column two ways: a key and a label; take whichever it gives */
const KEYS = {
  min: ['minutes', 'MIN'], fg: ['fieldGoalsMade-fieldGoalsAttempted', 'FG'], tp: ['threePointFieldGoalsMade-threePointFieldGoalsAttempted', '3PT'],
  ft: ['freeThrowsMade-freeThrowsAttempted', 'FT'], orb: ['offensiveRebounds', 'OREB'], drb: ['defensiveRebounds', 'DREB'], ast: ['assists', 'AST'],
  stl: ['steals', 'STL'], blk: ['blocks', 'BLK'], tov: ['turnovers', 'TO'], pf: ['fouls', 'PF'], pm: ['plusMinus', '+/-'], pts: ['points', 'PTS'],
};
const clean = s => String(s == null ? '' : s).replace(/[,\n"]/g, ' ').trim();
const int = v => { const n = parseInt(String(v == null ? '' : v).replace('+', ''), 10); return Number.isFinite(n) ? n : ''; };
const pair = v => { const m = /^\s*(\d+)\s*-\s*(\d+)/.exec(String(v == null ? '' : v)); return m ? [+m[1], +m[2]] : ['', '']; };

/* one summary payload -> player rows and team rows for the game g */
function parseSummary(j, g) {
  const box = j.boxscore || {};
  const players = [], teams = [];
  for (const tp of box.players || []) {
    const ab = L.fromEspn(tp.team && tp.team.abbreviation);
    if (ab !== g.home && ab !== g.away) continue;
    const home = ab === g.home ? 1 : 0, opp = home ? g.away : g.home;
    const st = (tp.statistics || [])[0];
    if (!st) continue;
    const keys = st.keys || [], labels = st.labels || st.names || [];
    const col = k => { let i = keys.indexOf(KEYS[k][0]); if (i < 0) i = labels.indexOf(KEYS[k][1]); return i; };
    const ix = Object.fromEntries(Object.keys(KEYS).map(k => [k, col(k)]));
    if (ix.min < 0 || ix.pts < 0) throw new Error('box columns not recognised: ' + JSON.stringify(keys.length ? keys : labels));
    for (const a of st.athletes || []) {
      const s = a.stats || [];
      const get = k => ix[k] >= 0 ? s[ix[k]] : undefined;
      const dnp = a.didNotPlay || !s.length || s.every(x => x === '' || x == null) ? 1 : 0;
      const [fgm, fga] = pair(get('fg')), [tpm, tpa] = pair(get('tp')), [ftm, fta] = pair(get('ft'));
      const ath = a.athlete || {};
      players.push({ game_id: g.game_id, date: g.date, team: ab, opp, home, player_id: String(ath.id || ''), name: clean(ath.displayName || ath.shortName),
        pos: clean(ath.position && ath.position.abbreviation), starter: a.starter ? 1 : 0, min: dnp ? 0 : (int(get('min')) || 0),
        fgm: dnp ? '' : fgm, fga: dnp ? '' : fga, tpm: dnp ? '' : tpm, tpa: dnp ? '' : tpa, ftm: dnp ? '' : ftm, fta: dnp ? '' : fta,
        orb: dnp ? '' : int(get('orb')), drb: dnp ? '' : int(get('drb')), ast: dnp ? '' : int(get('ast')), stl: dnp ? '' : int(get('stl')),
        blk: dnp ? '' : int(get('blk')), tov: dnp ? '' : int(get('tov')), pf: dnp ? '' : int(get('pf')), pm: dnp ? '' : int(get('pm')),
        pts: dnp ? '' : int(get('pts')), dnp });
    }
  }
  for (const tb of box.teams || []) {
    const ab = L.fromEspn(tb.team && tb.team.abbreviation);
    if (ab !== g.home && ab !== g.away) continue;
    const stats = {};
    for (const s of tb.statistics || []) if (s.name) stats[s.name] = s.displayValue;
    teams.push({ game_id: g.game_id, date: g.date, team: ab, opp: ab === g.home ? g.away : g.home, home: ab === g.home ? 1 : 0, stats });
  }
  if (players.length < 10) throw new Error('only ' + players.length + ' player rows');
  return { players, teams };
}

function readBox(season) {
  const f = path.join(DATA, `box_${season}.csv`);
  if (!fs.existsSync(f)) return { rows: [], have: new Set() };
  const lines = fs.readFileSync(f, 'utf8').trim().split('\n'); lines.shift();
  const rows = lines.map(l => { const v = l.split(','); const o = {}; PCOLS.forEach((c, i) => { o[c] = v[i] === undefined ? '' : v[i]; }); return o; });
  return { rows, have: new Set(rows.map(r => r.game_id)) };
}
function writeBox(season, rows, teamLines) {
  rows.sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : a.game_id < b.game_id ? -1 : a.game_id > b.game_id ? 1 : a.team < b.team ? -1 : a.team > b.team ? 1 : b.min - a.min);
  fs.writeFileSync(path.join(DATA, `box_${season}.csv`), [PCOLS.join(',')].concat(rows.map(r => PCOLS.map(c => r[c] === undefined ? '' : r[c]).join(','))).join('\n') + '\n');
  const f = path.join(DATA, `teambox_${season}.jsonl`);
  const old = fs.existsSync(f) ? fs.readFileSync(f, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l)) : [];
  const byKey = new Map(old.map(t => [t.game_id + ':' + t.team, t]));
  for (const t of teamLines) byKey.set(t.game_id + ':' + t.team, t);
  const all = [...byKey.values()].sort((a, b) => a.date < b.date ? -1 : a.date > b.date ? 1 : (a.game_id + a.team) < (b.game_id + b.team) ? -1 : 1);
  fs.writeFileSync(f, all.map(t => JSON.stringify(t)).join('\n') + '\n');
}

async function boxes(games) {
  const started = Date.now();
  const need = games.filter(g => g.status === 'final' && +g.season >= FROM && +g.season <= TO);
  const bySeason = {};
  for (const g of need) (bySeason[g.season] = bySeason[g.season] || []).push(g);
  let read = 0, failed = 0, skipped = 0, idLookups = 0;
  const savedIds = {};
  for (const season of Object.keys(bySeason).sort()) {
    const { rows, have } = readBox(season);
    const fresh = [], teamLines = [];
    const todo = bySeason[season].filter(g => !have.has(g.game_id));
    if (!todo.length) { skipped += bySeason[season].length; continue; }
    L.log(`season ${season}: ${todo.length} games without a box score`);
    const dayIds = {};
    for (const g of todo) {
      if (Date.now() - started > BUDGET) { L.log('time budget spent; the rest waits for the next run'); break; }
      let id = g.espn_id;
      if (!id) {
        if (!dayIds[g.date]) {
          try {
            idLookups++;
            const j = await L.getJSON(BASE + 'scoreboard?limit=100&dates=' + g.date.replace(/-/g, ''));
            dayIds[g.date] = {};
            for (const e of j.events || []) {
              const c = e.competitions && e.competitions[0]; if (!c) continue;
              const h = c.competitors.find(x => x.homeAway === 'home'), a = c.competitors.find(x => x.homeAway === 'away');
              if (h && a) dayIds[g.date][L.fromEspn(a.team.abbreviation) + '@' + L.fromEspn(h.team.abbreviation)] = String(e.id);
            }
            await sleep(250);
          } catch (e) { L.log(`${g.date} scoreboard: ${e.message}`); dayIds[g.date] = {}; }
        }
        id = dayIds[g.date][g.away + '@' + g.home];
        if (!id) { failed++; L.log(`${g.game_id}: no ESPN id for it on that day's scoreboard`); continue; }
        savedIds[g.game_id] = id;
      }
      try {
        const j = await L.getJSON(BASE + 'summary?event=' + id);
        const sample = path.join(DATA, 'sample_summary.json');
        if (!fs.existsSync(sample)) fs.writeFileSync(sample, JSON.stringify(j, null, 1));
        const out = parseSummary(j, g);
        if (read === 0) {
          const st = j.boxscore.players[0].statistics[0];
          L.log(`first box read: ${g.game_id}, keys ${JSON.stringify(st.keys || st.labels || st.names)}, team stats ${Object.keys(out.teams[0].stats).join('/')}`);
        }
        fresh.push(...out.players); teamLines.push(...out.teams); read++;
        if (read % 100 === 0) L.log(`${read} box scores read (${g.date})`);
      } catch (e) { failed++; L.log(`${g.game_id} (${id}): ${e.message}`); }
      await sleep(250);
    }
    if (fresh.length) writeBox(season, rows.concat(fresh), teamLines);
    L.log(`season ${season}: ${fresh.length} player rows added`);
  }
  if (Object.keys(savedIds).length) {
    const all = L.readGames();
    for (const r of all) if (savedIds[r.game_id]) r.espn_id = savedIds[r.game_id];
    L.writeGames(all);
  }
  L.log(`box scores: ${read} read, ${failed} failed, ${skipped} already had, ${idLookups} scoreboard lookups`);
  return read;
}

/* the team list once: id and display name to this site's code */
let teamMap = null;
async function teamIds() {
  if (teamMap) return teamMap;
  const j = await L.getJSON(BASE + 'teams?limit=40');
  const list = ((((j.sports || [])[0] || {}).leagues || [])[0] || {}).teams || [];
  teamMap = { byId: {}, byName: {}, list: [] };
  for (const t of list) {
    const ab = L.fromEspn(t.team && t.team.abbreviation);
    if (!L.TEAMS.includes(ab)) continue;
    teamMap.byId[String(t.team.id)] = ab; teamMap.byName[t.team.displayName] = ab; teamMap.list.push({ id: t.team.id, ab });
  }
  return teamMap;
}

async function injuries() {
  const today = L.etDate(new Date());
  const j = await L.getJSON(BASE + 'injuries');
  const sample = path.join(DATA, 'sample_injuries.json');
  if (!fs.existsSync(sample)) fs.writeFileSync(sample, JSON.stringify(j, null, 1));
  const ids = await teamIds();
  const teams = {};
  const lines = [];
  for (const t of j.injuries || []) {
    /* the feed names a team by id and display name; abbreviation only sometimes */
    const ab = L.fromEspn(t.abbreviation || (t.team && t.team.abbreviation) || '') || ids.byId[String(t.id || (t.team && t.team.id) || '')] || ids.byName[t.displayName] || '';
    const list = [];
    for (const inj of t.injuries || []) {
      const a = inj.athlete || {};
      /* the feed gives no athlete id field; the id is in the player's page link (…/player/_/id/4712863/…) */
      const href = ((a.links || [])[0] || {}).href || (a.headshot && a.headshot.href) || '';
      const m = /\/id\/(\d+)/.exec(href) || /\/(\d+)\.png/.exec(href);
      const d = inj.details || {};
      const row = { id: String(a.id || (m && m[1]) || ''), name: clean(a.displayName || a.fullName || inj.displayName), pos: clean(a.position && (a.position.abbreviation || a.position.name)),
        status: clean(inj.status || (inj.type && inj.type.description)), detail: clean([d.type, d.detail].filter(Boolean).join(' ') || inj.shortComment || ''), date: inj.date ? String(inj.date).slice(0, 10) : '',
        returns: d.returnDate ? String(d.returnDate).slice(0, 10) : '' };
      list.push(row);
      lines.push([today, ab, row.id, row.name, row.status].join(','));
    }
    if (ab) teams[ab] = list; else L.log(`injuries: team not recognised: ${JSON.stringify({ id: t.id, name: t.displayName })}`);
  }
  fs.writeFileSync(path.join(DATA, 'injuries.json'), JSON.stringify({ date: today, teams }, null, 1) + '\n');
  const logf = path.join(DATA, 'injuries_log.csv');
  let old = fs.existsSync(logf) ? fs.readFileSync(logf, 'utf8').trim().split('\n') : ['date,team,player_id,name,status'];
  old = old.filter(l => !l.startsWith(today + ','));            // today's lines are replaced, so a rerun is a no-op
  fs.writeFileSync(logf, old.concat(lines).join('\n') + '\n');
  L.log(`injuries: ${lines.length} players listed across ${Object.keys(teams).length} teams`);
}

async function coaches() {
  const today = L.etDate(new Date());
  const ids = await teamIds();
  const out = {}, rosters = {};
  for (const { id, ab } of ids.list) {
    try {
      const r = await L.getJSON(BASE + `teams/${id}/roster`);
      const c = (r.coach || [])[0];
      out[ab] = c ? { id: String(c.id || ''), name: clean([c.firstName, c.lastName].filter(Boolean).join(' ')), experience: c.experience } : null;
      rosters[ab] = (r.athletes || []).map(a => ({ id: String(a.id || ''), name: clean(a.displayName || a.fullName), pos: clean(a.position && a.position.abbreviation),
        status: clean(a.status && a.status.type), injured: !!(a.injuries && a.injuries.length) }));
      await sleep(200);
    } catch (e) { out[ab] = null; L.log(`${ab} roster: ${e.message}`); }
  }
  fs.writeFileSync(path.join(DATA, 'coaches_espn.json'), JSON.stringify({ date: today, teams: out }, null, 1) + '\n');
  fs.writeFileSync(path.join(DATA, 'rosters_espn.json'), JSON.stringify({ date: today, teams: rosters }, null, 1) + '\n');
  L.log(`coaches: ${Object.values(out).filter(Boolean).length} of ${Object.keys(out).length} teams; rosters: ${Object.values(rosters).reduce((n, r) => n + r.length, 0)} players`);
}

async function main() {
  const offline = opt('--offline');
  if (offline) {
    const j = JSON.parse(fs.readFileSync(offline, 'utf8'));
    const g = { game_id: 'test', date: '2026-01-01', home: opt('--home', 'HOME'), away: opt('--away', 'AWAY') };
    console.log(JSON.stringify(parseSummary(j, g), null, 1)); return;
  }
  const games = L.readGames();
  const read = await boxes(games);
  let extras = 0;
  for (const step of [injuries, coaches]) {
    try { await step(); extras++; } catch (e) { L.log(`${step.name}: ${e.message}`); }
  }
  if (read === 0 && extras === 0 && games.some(g => g.status === 'final' && +g.season >= FROM)) {
    const { have } = readBox(String(Math.max(...games.filter(g => g.status === 'final').map(g => +g.season))));
    if (!have.size) { console.error('nothing could be read from ESPN'); process.exit(1); }
  }
}

module.exports = { parseSummary };
if (require.main === module) main().catch(e => { console.error(e.message || e); process.exit(1); });
