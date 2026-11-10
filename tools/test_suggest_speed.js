/* The time Suggested Parlays' search takes (the review of 8 November 2026): with no leg limit the levels are the page's
 * exact branch and bound (README "Suggested Parlays", "The search, and why it is exact"), and the tab builds the night's
 * set when it opens, so a night it cannot settle in a few seconds freezes the page, and the job's record step with it.
 *
 *   node tools/test_suggest_speed.js     ends "N checks passed"; exit 1 otherwise (about half a minute; needs jsdom;
 *                                        SPEED_PAGE=<file> runs it on another built page, SPEED_ONLY=rootH,rootM its
 *                                        named cases alone, SL_VERBOSE=1 prints every check)
 *
 * The built page (index.html) is booted in jsdom and handed the nights of tools/fixtures/sp_nights.json, each the pool of
 * legs the page's own spPool built, on its same-game table; each level is searched as spBuild searches it (the team legs
 * alone first, as the parlay to beat, then every leg), timed, and stopped at its limit. Held:
 *   - 7 November 2026's night of 7 games, every level;
 *   - each of its games alone as a night (the NBA Cup's knockout nights and most playoff nights are one or two games),
 *     Safe and Medium; Aggressive on the four games it settles in seconds;
 *   - two and three of its games together, every level;
 *   - the review's heavy-favourite nights (8 games at -900, 8 at -400 with 32 player lines a game, 7 November's player
 *     lines with every home side -600 to -1000, three of its games at -400, -350 and -300), every level;
 *   - since the rule with a player (the owner's call of 10 November 2026: each level holds at least one player leg
 *     wherever the night's legs make such a parlay), 10 November 2026's night (6 games, the page's own pool on the
 *     committed lines.json and state.json at 17:00 UTC) and a night whose only player legs are long shots (8 games at
 *     -900 with every player leg at 45% to 53%, where a level with a player costs most of a leg's chance), every level.
 * Each level is searched as spBuild searches it (spRule: the best of every parlay, and where it holds no player leg the
 * best holding one, spSearchPl) and held to its answer as the exact search gave it (legs, chance and price: on 8
 * November 2026, and where the rule with a player moved it, on 10 November 2026, each such answer held there to the
 * record's guard's own reading of the same legs, every pair by its own copula, its own groups and its own enumeration
 * with the rule's word), so a change that makes it faster by making it wrong fails here too, and to its rule (2 legs or
 * more, its floor on $1, and a player leg: every fixture night has one).
 *
 * Not held, said: three of 7 November's games alone as an Aggressive night take longer, WAS at OKC about 19 s, NYK at CLE
 * about 51 s and BKN at ATL about 2 minutes in jsdom, every leg a player's line at DraftKings' fair chance so thousands of
 * parlays sit within a hair of $8 at the same chance; the page before the change took over 100 s on each. */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
const { JSDOM, VirtualConsole } = require('./node_modules/jsdom');
const FX = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sp_nights.json'), 'utf8'));

let n = 0; const fails = [], notes = [];
const chk = (ok, msg) => { n++; if (!ok) fails.push(msg); if (process.env.SL_VERBOSE) console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${msg}`); };
function end() {
  for (const x of notes) console.log('  ' + x);
  for (const f of fails) console.log('  FAIL: ' + f);
  console.log(fails.length ? `${n} checks, ${fails.length} failed` : `${n} checks passed`);
  process.exit(fails.length ? 1 : 0);
}
process.on('uncaughtException', e => { chk(false, 'the test stopped: ' + (e && e.stack || e)); end(); });

/* the fixture's rows back to the page's legs */
const skOf = l => l.kind === 'prop' ? [l.gid, 'prop', l.pid, l.stat, l.mk, l.line, l.side].join('|') : [l.gid, l.kind, l.side, l.line == null ? '' : l.line].join('|');
function legsOf(night) {
  return night.legs.map(a => { const [away, home, tip] = night.games[a[0]];
    if (a[1] === 'prop') { const [gid, kind, pid, team, opp, stat, mk, line, side, odds, other, p] = a; const l = { id: gid, away, home, tip, kind, pid, team, stat, mk, line, side, odds, other, gid, sk: '', p, price: odds, opp }; l.sk = skOf(l); return l; }
    const [gid, kind, side, line, odds, other, p, team, opp] = a; const l = { id: gid, away, home, tip, kind, side, line, odds, other, gid, sk: '', p, price: odds, team, opp }; l.sk = skOf(l); return l; });
}

async function boot(nowIso) {
  const now = Date.parse(nowIso), html = fs.readFileSync(process.env.SPEED_PAGE || path.join(ROOT, 'index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const vc = new VirtualConsole();
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://demon-x13.github.io/nba-hub/', virtualConsole: vc,
    beforeParse(w) {
      w.scrollTo = () => {}; if (!w.CSS) w.CSS = { escape: v => String(v) };
      const D0 = w.Date; class D extends D0 { constructor(...a) { if (a.length) super(...a); else super(now); } static now() { return now; } } w.Date = D;
      /* the repo's own files, never the ledger; nothing from the network */
      w.fetch = u => { const rel = new URL(String(u), 'https://demon-x13.github.io/nba-hub/').pathname.replace(/^\/nba-hub\//, ''), f = path.join(ROOT, rel);
        if (/suggest_ledger/.test(rel) || !/^[\w./-]+$/.test(rel) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' });
        const t = fs.readFileSync(f, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t }); };
    } });
  const w = dom.window;
  for (let i = 0; i < 400 && !w.eval("typeof S!=='undefined'&&!!S&&!!S.slate&&typeof spSearch==='function'"); i++) await new Promise(r => setTimeout(r, 30));
  return w;
}

/* each level's answer as the exact search gave it on 8 November 2026: its legs' keys, its chance and its price */
const G7 = ['BKN_ATL', 'DEN_IND', 'HOU_PHX', 'NYK_CLE', 'ORL_GSW', 'SAS_POR', 'WAS_OKC'];
const ID = s => s.split(',').map(x => x.startsWith('2027_') ? x : '2027_' + x).sort().join(',');
/* the levels the rule with a player moved (10 November 2026), each before it a parlay of team legs alone: 7 November's
   Safe (the Pacers +8.5 and the Thunder to win, 51.38% at 2.2099), the two and three games' Safe (the same), 8 games at
   -900's Safe (seven moneylines, 55.78% at 2.0908) and 7 November's player lines at -600 to -1000's Safe (six moneylines,
   54.26% at 2.0131) */
const WANT = {
  'nov7:safe': [ID('20261107_NYK_CLE|ml|NYK|,20261107_SAS_POR|prop|5104157|stl|main|1.5|under'), 0.513388, 2.1111],
  'nov7:med': [ID('20261107_DEN_IND|spread|IND|8.5,20261107_HOU_PHX|prop|2991230|stl|main|1.5|under,20261107_NYK_CLE|ml|NYK|'), 0.320856, 4.0262],
  'nov7:aggr': [ID('20261107_DEN_IND|spread|IND|8.5,20261107_HOU_PHX|spread|PHX|6.5,20261107_NYK_CLE|ml|NYK|,20261107_SAS_POR|prop|5105565|tpm|main|1.5|under'), 0.178307, 8.0072],
  'BKN_ATL:safe': [ID('20261107_BKN_ATL|ml|ATL|,20261107_BKN_ATL|prop|3064514|ast|main|4.5|under'), 0.439236, 2.0153],
  'BKN_ATL:med': [ID('20261107_BKN_ATL|prop|3064514|tpm|main|1.5|under,20261107_BKN_ATL|prop|4278039|stl|main|1.5|under,20261107_BKN_ATL|prop|4278104|pr|main|30.5|under'), 0.223987, 4.0002],
  'DEN_IND:safe': [ID('20261107_DEN_IND|prop|3112335|blk|main|1.5|under,20261107_DEN_IND|spread|IND|8.5'), 0.445836, 2.3876],
  'DEN_IND:med': [ID('20261107_DEN_IND|prop|3112335|blk|main|1.5|under,20261107_DEN_IND|prop|4431767|pa|main|15.5|under,20261107_DEN_IND|spread|IND|8.5'), 0.261524, 4.0120],
  'DEN_IND:aggr': [ID('20261107_DEN_IND|prop|3112335|blk|main|1.5|under,20261107_DEN_IND|prop|4017837|pts|main|10.5|under,20261107_DEN_IND|prop|4395712|ar|main|10.5|under,20261107_DEN_IND|spread|IND|8.5'), 0.136246, 8.0317],
  'HOU_PHX:safe': [ID('20261107_HOU_PHX|prop|4278585|tpm|main|2.5|under,20261107_HOU_PHX|prop|4684740|stl|main|1.5|under'), 0.446147, 2.0083],
  'HOU_PHX:med': [ID('20261107_HOU_PHX|prop|3155526|tpm|main|1.5|under,20261107_HOU_PHX|spread|PHX|6.5'), 0.246493, 4.0536],
  'HOU_PHX:aggr': [ID('20261107_HOU_PHX|prop|4601023|ar|main|8.5|under,20261107_HOU_PHX|prop|4684740|stl|main|1.5|under,20261107_HOU_PHX|prop|5203685|reb|main|5.5|under,20261107_HOU_PHX|spread|PHX|6.5'), 0.125051, 8.0088],
  'NYK_CLE:safe': [ID('20261107_NYK_CLE|ml|NYK|,20261107_NYK_CLE|prop|4432158|tpm|main|1.5|under'), 0.471904, 2.0471],
  'NYK_CLE:med': [ID('20261107_NYK_CLE|ml|NYK|,20261107_NYK_CLE|prop|3914044|tpm|main|2.5|under,20261107_NYK_CLE|prop|3934672|tpm|main|2.5|under'), 0.245473, 4.0054],
  'ORL_GSW:safe': [ID('20261107_ORL_GSW|prop|4066320|tpm|main|3.5|under,20261107_ORL_GSW|prop|4712849|stl|main|1.5|under'), 0.431312, 2.0774],
  'ORL_GSW:med': [ID('20261107_ORL_GSW|prop|4702382|reb|main|3.5|under,20261107_ORL_GSW|spread|ORL|5.5'), 0.240637, 4.0603],
  'ORL_GSW:aggr': [ID('20261107_ORL_GSW|prop|4566434|ast|main|6.5|under,20261107_ORL_GSW|prop|4702382|pts|main|11.5|under,20261107_ORL_GSW|spread|ORL|5.5'), 0.121797, 8.0073],
  'SAS_POR:safe': [ID('20261107_SAS_POR|prop|4066259|tpm|main|1.5|under,20261107_SAS_POR|prop|5105565|tpm|main|1.5|under'), 0.446639, 2.0061],
  'SAS_POR:med': [ID('20261107_SAS_POR|prop|6606|ar|main|7.5|under,20261107_SAS_POR|spread|POR|4.5'), 0.239058, 4.0443],
  'SAS_POR:aggr': [ID('20261107_SAS_POR|prop|5105565|blk|main|1.5|under,20261107_SAS_POR|prop|6606|pts|main|19.5|under,20261107_SAS_POR|spread|POR|4.5'), 0.120939, 8.0056],
  'WAS_OKC:safe': [ID('20261107_WAS_OKC|prop|4900671|stl|main|1.5|under,20261107_WAS_OKC|prop|5160992|ast|main|2.5|under'), 0.447622, 2.0017],
  'WAS_OKC:med': [ID('20261107_WAS_OKC|prop|5142718|stl|main|1.5|under,20261107_WAS_OKC|prop|5160992|blk|main|1.5|under,20261107_WAS_OKC|spread|WAS|12.5'), 0.237449, 4.0084],
  'two:safe': [ID('20261107_DEN_IND|prop|3112335|blk|main|1.5|under,20261107_WAS_OKC|prop|4900671|stl|main|1.5|under'), 0.479737, 2.0845],
  'two:med': [ID('20261107_DEN_IND|spread|IND|8.5,20261107_WAS_OKC|prop|5142718|reb|main|4.5|under'), 0.295629, 4.0318],
  'two:aggr': [ID('20261107_DEN_IND|spread|IND|8.5,20261107_WAS_OKC|prop|4900671|reb|main|4.5|under,20261107_WAS_OKC|prop|5142718|ast|main|2.5|under,20261107_WAS_OKC|spread|WAS|12.5'), 0.141348, 8.0035],
  'three:safe': [ID('20261107_DEN_IND|prop|3112335|blk|main|1.5|under,20261107_WAS_OKC|prop|4900671|stl|main|1.5|under'), 0.479737, 2.0845],
  'three:med': [ID('20261107_DEN_IND|spread|IND|8.5,20261107_ORL_GSW|prop|4566434|ast|main|6.5|under'), 0.297024, 4.0129],
  'three:aggr': [ID('20261107_DEN_IND|spread|IND|8.5,20261107_ORL_GSW|spread|ORL|5.5,20261107_WAS_OKC|prop|4900671|ast|main|3.5|under'), 0.161102, 8.0195],
  'rootB:safe': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|ml|CHA|,20261117_CHI_CLE|ml|CLE|,20261117_DAL_DEN|prop|9500030|pts|main|11.5|under'), 0.523380, 2.0409],
  'rootB:med': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|ml|CHA|,20261117_CHI_CLE|ml|CLE|,20261117_DAL_DEN|ml|DEN|,20261117_DET_GSW|ml|GSW|,20261117_HOU_IND|prop|9500053|pts|main|11.5|under,20261117_LAC_LAL|ml|LAL|,20261117_MEM_MIA|prop|9500070|ast|main|4.5|under'), 0.282535, 4.0383],
  'rootB:aggr': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|ml|CHA|,20261117_CHI_CLE|ml|CLE|,20261117_DAL_DEN|ml|DEN|,20261117_DET_GSW|ml|GSW|,20261117_HOU_IND|prop|9500053|reb|main|4.5|under,20261117_LAC_LAL|prop|9500062|reb|main|9.5|under,20261117_MEM_MIA|prop|9500072|pts|main|25.5|under'), 0.139454, 8.0038],
  'root_d:safe': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|prop|9500012|pts|main|21.5|under'), 0.507023, 2.0216],
  'root_d:med': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|ml|CHA|,20261117_CHI_CLE|ml|CLE|,20261117_DAL_DEN|ml|DEN|,20261117_DET_GSW|prop|9500043|pts|main|25.5|under'), 0.273418, 4.0371],
  'root_d:aggr': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|ml|CHA|,20261117_CHI_CLE|ml|CLE|,20261117_DAL_DEN|ml|DEN|,20261117_DET_GSW|ml|GSW|,20261117_HOU_IND|ml|IND|,20261117_LAC_LAL|ml|LAL|,20261117_MEM_MIA|prop|9500073|reb|main|9.5|under'), 0.144982, 8.1989],
  'rootH:safe': [ID('20261107_BKN_ATL|ml|ATL|,20261107_DEN_IND|ml|IND|,20261107_NYK_CLE|ml|CLE|,20261107_WAS_OKC|prop|4900671|stl|main|1.5|under'), 0.522804, 2.0014],
  'rootH:med': [ID('20261107_BKN_ATL|ml|ATL|,20261107_DEN_IND|prop|3064290|pts|main|12.5|under,20261107_HOU_PHX|ml|PHX|,20261107_NYK_CLE|ml|CLE|,20261107_ORL_GSW|ml|GSW|,20261107_SAS_POR|ml|POR|,20261107_WAS_OKC|ml|OKC|'), 0.272940, 4.0041],
  'rootH:aggr': [ID('20261107_BKN_ATL|ml|ATL|,20261107_DEN_IND|prop|3936299|tpm|main|2.5|under,20261107_HOU_PHX|ml|PHX|,20261107_NYK_CLE|ml|CLE|,20261107_ORL_GSW|ml|GSW|,20261107_SAS_POR|prop|4845367|tpm|main|1.5|under,20261107_WAS_OKC|ml|OKC|'), 0.134857, 8.0075],
  'rootM:safe': [ID('20261107_DEN_IND|ml|IND|,20261107_HOU_PHX|prop|4433192|tpm|main|1.5|under'), 0.511071, 2.0000],
  'rootM:med': [ID('20261107_BKN_ATL|prop|2490149|tpm|main|1.5|under,20261107_DEN_IND|ml|IND|,20261107_HOU_PHX|prop|4433192|tpm|main|1.5|under'), 0.255536, 4.0000],
  'rootM:aggr': [ID('20261107_BKN_ATL|prop|4431680|ast|main|2.5|under,20261107_DEN_IND|prop|3936299|ar|main|10.5|under,20261107_HOU_PHX|prop|4601023|pts|main|6.5|under'), 0.124997, 8.0002],
  'nov10:safe': [ID('20261110_BOS_PHI|prop|3059318|pr|main|28.5|under,20261110_MIL_NYK|ml|NYK|'), 0.499166, 2.0021],
  'nov10:med': [ID('20261110_BOS_PHI|prop|4397424|pts|main|9.5|under,20261110_OKC_POR|ml|POR|'), 0.279505, 4.0091],
  'nov10:aggr': [ID('20261110_BOS_PHI|prop|3078576|tpm|main|1.5|under,20261110_OKC_POR|ml|POR|,20261110_ORL_SAC|spread|SAC|6.5'), 0.148667, 8.0162],
  'rootL:safe': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|prop|9700008|tpm|main|4.5|under'), 0.471220, 2.1693],
  'rootL:med': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|ml|CHA|,20261117_CHI_CLE|ml|CLE|,20261117_DAL_DEN|ml|DEN|,20261117_DET_GSW|ml|GSW|,20261117_HOU_IND|ml|IND|,20261117_LAC_LAL|ml|LAL|,20261117_MEM_MIA|prop|9700044|tpm|main|4.5|under'), 0.285726, 4.0819],
  'rootL:aggr': [ID('20261117_ATL_BOS|ml|BOS|,20261117_BKN_CHA|ml|CHA|,20261117_CHI_CLE|ml|CLE|,20261117_DAL_DEN|ml|DEN|,20261117_DET_GSW|ml|GSW|,20261117_HOU_IND|ml|IND|,20261117_LAC_LAL|prop|9700038|ast|main|4.5|under,20261117_MEM_MIA|prop|9700044|tpm|main|4.5|under'), 0.141169, 8.0822],
};
/* the limits, in jsdom: each several times what the slowest level of its kind took on 8 November 2026 (a whole night 0.2 s,
   a game alone 1.1 s, a game alone's Aggressive 7.8 s, a few games 2.9 s), so a slower machine passes and a search that
   loses a bound does not */
const LIMIT = { night: 6000, one: 8000, oneAggr: 30000, few: 12000 };
const CASES = [
  ['nov7', 'nov7', null, ['safe', 'med', 'aggr'], 'night', "7 November's night"],
  ...G7.map(g => [g, 'nov7', [g], ['safe', 'med'].concat(['DEN_IND', 'ORL_GSW', 'SAS_POR', 'HOU_PHX'].includes(g) ? ['aggr'] : []), 'one', `${g.replace('_', ' at ')} alone`]),
  ['two', 'nov7', ['DEN_IND', 'WAS_OKC'], ['safe', 'med', 'aggr'], 'few', 'DEN at IND and WAS at OKC together'],
  ['three', 'nov7', ['DEN_IND', 'WAS_OKC', 'ORL_GSW'], ['safe', 'med', 'aggr'], 'few', 'DEN at IND, WAS at OKC and ORL at GSW together'],
  ['rootB', 'rootB', null, ['safe', 'med', 'aggr'], 'few', '8 games at -900'],
  ['root_d', 'root_d', null, ['safe', 'med', 'aggr'], 'few', '8 games at -400 with 32 player lines a game'],
  ['rootH', 'rootH', null, ['safe', 'med', 'aggr'], 'few', "7 November's player lines, every home side -600 to -1000"],
  ['rootM', 'rootM', null, ['safe', 'med', 'aggr'], 'few', "three of 7 November's games at -400, -350 and -300"],
  ['nov10', 'nov10', null, ['safe', 'med', 'aggr'], 'night', "10 November's night"],
  ['rootL', 'rootL', null, ['safe', 'med', 'aggr'], 'few', '8 games at -900 whose only player legs are long shots'],
];

(async () => {
  console.log('the search\'s time on the fixture\'s nights');
  const w = await boot(FX.nights.nov7.at);
  chk(w.eval("typeof spSearch==='function'&&typeof spPrep==='function'"), 'the page boots with its search');
  w.eval(`S.corr = ${JSON.stringify(FX.corr)}`);
  const LV = JSON.parse(w.eval('JSON.stringify(SP_LEVELS)'));
  chk(LV.map(l => `${l[0]}:${l[2]}:${l[3]}:${l[4]}:${l[5]}`).join() === 'safe:2:null:2:player,med:2:null:4:player,aggr:2:null:8:player', `the levels are the rule's, 2 legs or more with no most, $2, $4 and $8, each with a player (${LV.map(l => l.join(' ')).join('; ')})`);
  /* a search past its limit is stopped where it next works a game's groups or a parlay's figures */
  const og = w.spGroups, of = w.spFig; let stopAt = Infinity;
  w.spGroups = function (...a) { if (Date.now() > stopAt) throw new Error('over its limit'); return og.apply(this, a); };
  w.spFig = function (...a) { if (Date.now() > stopAt) throw new Error('over its limit'); return of.apply(this, a); };
  const pools = {};
  const ONLY = (process.env.SPEED_ONLY || '').split(',').filter(Boolean);
  for (const [name, night, gs, lvs, kind, what] of CASES.filter(c => !ONLY.length || ONLY.includes(c[0]))) {
    const all = pools[night] || (pools[night] = legsOf(FX.nights[night])), legs = gs ? all.filter(l => gs.some(g => l.gid.endsWith('_' + g))) : all;
    for (const lid of lvs) {
      const lv = LV.find(l => l[0] === lid), lim = kind === 'one' && lid === 'aggr' ? LIMIT.oneAggr : LIMIT[kind];
      w.eval('SG_CACHE.clear()');
      const t0 = Date.now(); stopAt = t0 + lim; let r = null, nopl = null, err = '';
      try { const X = w.spPrep({ legs }), Xt = w.spPrep({ legs: legs.filter(l => l.kind !== 'prop') }); const inc = Xt.games.length ? w.spSearch(Xt, lv) : null;
        const rr = w.spRule(X, lv, inc, { pl: { lines: legs.filter(l => l.kind === 'prop').length, held: 0, none: 0, vig: 0 } }); r = rr.r; nopl = rr.nopl; }
      catch (e) { err = String(e && e.message || e); }
      const ms = Date.now() - t0; stopAt = Infinity;
      const want = WANT[`${name}:${lid}`], got = r ? [r.ids.split(',').sort().join(','), r.p, r.d] : null;
      chk(!err && ms <= lim, `${what}: ${lid} is searched in ${ms} ms, within ${lim / 1000} s (${legs.length} legs${err ? '; ' + err : ''})`);
      chk(!err && !!r && !nopl && r.legs.some(l => l.kind === 'prop'), `${what}: ${lid} holds a player leg, as the rule asks wherever the night's legs make such a parlay (${err || (r ? (nopl ? 'none: ' + nopl : r.legs.filter(l => l.kind === 'prop').length + ' of ' + r.n) : 'no parlay')})`);
      chk(!err && !!got && !!want && got[0] === want[0] && Math.abs(got[1] - want[1]) < 5e-7 && Math.abs(got[2] - want[2]) < 5e-5 && r.n >= 2 && r.d >= lv[4] - 1e-9,
        `${what}: ${lid} is the exact search's answer, ${want ? `${want[0].split(',').length} legs at ${(want[1] * 100).toFixed(2)}% paying ${want[2]}` : 'none on file'}${got ? ` (got ${got[0].split(',').length} legs at ${(got[1] * 100).toFixed(4)}% paying ${got[2].toFixed(4)})` : ' (got none)'}`);
    }
  }
  w.spGroups = og; w.spFig = of;
  if (!ONLY.length) notes.push('not held: WAS at OKC, NYK at CLE and BKN at ATL alone as an Aggressive night (about 19 s, 51 s and 2 minutes)');
  end();
})();
