/* The props shadow ledger's check: the ledger and its graded lines as tools/props.js just wrote them, against the last
 * commit's, the record, the box scores and the games table.
 *
 *   node tools/props_check.js [--prev-dir DIR | --no-prev] [--now ISO]
 *
 * The job runs it right after tools/props.js; a failure fails that step, which puts the props data files back as the
 * last commit had them (so a broken ledger is never committed) and turns the run red. It fails when:
 *   - the bar is not the one registered (props_ledger.BAR), its numbers not lines 30000, edge 0.03, ci [0.05, 0.95],
 *     boot 10000, seed 0 (held here on their own, so an edit to BAR and the ledger together still fails), or not the last
 *     commit's, or registered after a call;
 *   - a call was made at or after its tip-off, or names a fit the ledger does not hold;
 *   - a call the last commit had frozen, or whose tip-off has passed, is gone, open again or changed in any field (its
 *     tip, the time it was made, its fit, any player's numbers); the one change allowed is a rewrite by this run, made
 *     before the tip, of a call the last commit had not frozen. A fit, a freeze time or a grade once written is never
 *     changed;
 *   - the graded lines the last commit had are not, byte for byte, the start of the file; a graded line is not what
 *     the frozen call, the fit, DraftKings' closing line and the box score give (the model's chance, the market's fair
 *     chance, the stat); a game's lines are not exactly its closing lines on players with a call who played; a game
 *     graded is not final, frozen and read; a frozen call that can be graded is left ungraded;
 *   - a verdict is written before the sample is in, is missing once it is, does not follow from the first 30,000
 *     graded lines, or differs from the last commit's;
 *   - the summary does not follow from the calls and the lines;
 *   - the record (data/props_<season>.csv, data/props_reads.json) lost or changed a game the last commit had read.
 * Without --prev-dir the last commit's files are read with git show HEAD:<file> (none there: the first run, held to
 * the rules on its own). NBA_NOW stands in for the clock. Ends "props check: 0 failures" (exit 0) or lists each
 * failure (exit 1).
 */
'use strict';
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const L = require('./lib');
const PM = require('./props');
const PL = require('./props_ledger');
const REC = require('./props_record');

const args = process.argv.slice(2);
const opt = k => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const DATA = process.env.NBA_DATA_DIR || path.join(L.ROOT, 'data');

function headFile(rel) {
  try { return execFileSync('git', ['show', `HEAD:${rel}`], { cwd: L.ROOT, encoding: 'utf8', maxBuffer: 1 << 28, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (e) { return null; }
}
function prevFiles() {
  if (args.includes('--no-prev')) return null;
  const dir = opt('--prev-dir');
  const get = name => {
    if (dir) { const f = path.join(dir, name); return fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : null; }
    return headFile('data/' + name);
  };
  const ledger = get('props_shadow.json');
  if (ledger == null) return null;
  const rec = {};
  for (const f of fs.readdirSync(DATA).filter(f => /^props_\d{4}\.csv$/.test(f))) { const t = get(f); if (t != null) rec[f] = t; }
  return { ledger: JSON.parse(ledger), lines: get('props_shadow_lines.csv') || '', reads: JSON.parse(get('props_reads.json') || '{}'), record: rec };
}

function check({ Lg, lineText, prev, games, boxes, now }) {
  const bad = [];
  const nowIso = new Date(now).toISOString().slice(0, 16) + 'Z';
  const byId = new Map(games.map(g => [g.game_id, g]));
  /* the bar */
  if (JSON.stringify(Lg.bar) !== JSON.stringify(PL.BAR)) bad.push('the bar in the ledger is not the one registered (props_ledger.BAR)');
  /* its numbers, which the verdict is worked from: a 90% interval of 10,000 resamples, seed 0, a 3-point edge, 30,000 lines */
  { const b = Lg.bar || {};
    if (!(b.lines === 30000 && b.edge === 0.03 && Array.isArray(b.ci) && b.ci.length === 2 && b.ci[0] === 0.05 && b.ci[1] === 0.95 && b.boot === 10000 && b.seed === 0))
      bad.push(`the bar's numbers are not the registered ones (lines 30000, edge 0.03, ci [0.05, 0.95], boot 10000, seed 0): ${JSON.stringify({ lines: b.lines, edge: b.edge, ci: b.ci, boot: b.boot, seed: b.seed })}`); }
  if (prev && (JSON.stringify(prev.ledger.bar) !== JSON.stringify(Lg.bar) || prev.ledger.bar_registered !== Lg.bar_registered)) bad.push('the bar or its registration time differs from the last commit\'s');
  /* every call */
  for (const [gid, c] of Object.entries(Lg.calls)) {
    if (!(c.called_at < c.tip)) bad.push(`${gid}: called at ${c.called_at}, at or after its tip-off ${c.tip}`);
    if (!Lg.bar_registered || c.called_at < Lg.bar_registered) bad.push(`${gid}: called at ${c.called_at}, before the bar was registered (${Lg.bar_registered})`);
    if (!Lg.fits[c.fit]) bad.push(`${gid}: its fit ${c.fit} is not in the ledger`);
    if (c.graded && !c.frozen) bad.push(`${gid}: graded but not frozen`);
    for (const [pid, arr] of Object.entries(c.players || {})) if (!Array.isArray(arr) || arr.length !== PL.CALL_LAYOUT.length || arr.some(x => typeof x !== 'number' || !Number.isFinite(x))) { bad.push(`${gid}: player ${pid}'s call is not ${PL.CALL_LAYOUT.length} numbers`); break; }
  }
  /* nothing frozen moved */
  if (prev) {
    for (const [id, f] of Object.entries(prev.ledger.fits || {})) if (Lg.fits[id] && JSON.stringify(Lg.fits[id]) !== JSON.stringify(f)) bad.push(`fit ${id} changed`);
    for (const [gid, pc] of Object.entries(prev.ledger.calls || {})) {
      const tipped = pc.frozen || pc.tip <= nowIso;
      const c = Lg.calls[gid];
      if (!tipped) continue;
      if (!c) { bad.push(`${gid}: a call frozen at tip-off (${pc.tip}) is gone`); continue; }
      if (pc.frozen && !c.frozen) bad.push(`${gid}: a frozen call is open again`);
      if (pc.frozen && pc.frozen_at !== c.frozen_at) bad.push(`${gid}: its freeze time changed`);
      if (pc.graded && JSON.stringify(pc.graded) !== JSON.stringify(c.graded)) bad.push(`${gid}: its grade changed`);
      if (pc.frozen && !Lg.fits[c.fit]) bad.push(`${gid}: the fit it was frozen with is gone`);
      const diff = PL.CALL_FIELDS.filter(k => JSON.stringify(pc[k]) !== JSON.stringify(c[k]));
      if (!diff.length) continue;
      const rewrite = !pc.frozen && c.called_at === Lg.run_at && pc.called_at < c.called_at && c.called_at < pc.tip && c.called_at < c.tip;
      if (!rewrite) bad.push(`${gid}: the call changed after tip-off (${diff.join(', ')})`);
    }
    if (prev.ledger.decision && JSON.stringify(prev.ledger.decision) !== JSON.stringify(Lg.decision)) bad.push('the verdict differs from the last commit\'s');
  }
  /* the graded lines: the last commit's are the file's start, and every line is what its sources give */
  const fileLines = lineText.split('\n').filter(Boolean);
  if (fileLines.length && fileLines[0] !== PL.LINE_COLS.join(',')) bad.push('the graded lines file has the wrong header');
  if (prev && prev.lines) {
    const pl = prev.lines.split('\n').filter(Boolean);
    if (pl.length > fileLines.length || pl.some((l, i) => fileLines[i] !== l)) bad.push('the graded lines the last commit had are not, unchanged, the start of the file');
  }
  const rows = fileLines.slice(1).map(l => { const v = l.split(','); return { game_id: v[0], player_id: v[1], stat: v[2], p_model: +v[3], p_market: +v[4], y: +v[5], raw: l }; });
  const seasons = [...new Set(Object.keys(Lg.calls).map(gid => +gid.slice(0, 4)))];
  const recIdx = PL.recordIndex(seasons);
  const byGame = new Map(); for (const r of rows) { if (!byGame.has(r.game_id)) byGame.set(r.game_id, []); byGame.get(r.game_id).push(r.raw); }
  for (const gid of byGame.keys()) if (!Lg.calls[gid] || !Lg.calls[gid].graded) bad.push(`${gid}: graded lines for a game the ledger has not graded`);
  /* a game's lines sit together, in grading order (by the grade's time, then tip-off, then game id) */
  { const seen = []; for (const r of rows) if (seen[seen.length - 1] !== r.game_id) seen.push(r.game_id);
    if (new Set(seen).size !== seen.length) bad.push('a game\'s graded lines are not together');
    const ord = gid => { const c = Lg.calls[gid] || {}; return [(c.graded || {}).at || '', c.tip || '', gid]; };
    for (let i = 1; i < seen.length; i++) { const a = ord(seen[i - 1]), b = ord(seen[i]); if (a[0] > b[0] || (a[0] === b[0] && (a[1] > b[1] || (a[1] === b[1] && a[2] > b[2])))) { bad.push(`${seen[i]}: graded lines out of grading order`); break; } } }
  for (const [gid, c] of Object.entries(Lg.calls)) {
    const g = byId.get(gid);
    if (c.graded) {
      if (!PL.gradeable(gid, g, boxes, recIdx.reads)) { bad.push(`${gid}: graded, but not final with its box score and closing lines read`); continue; }
      const want = PL.gradeGame(gid, c, recIdx.by.get(gid) || [], boxes, Lg.fits[c.fit] || { var: {} });
      const have = byGame.get(gid) || [];
      const wantText = want.rows.map(PL.lineText);
      if (JSON.stringify(wantText) !== JSON.stringify(have)) {
        const i = wantText.findIndex((t, j) => t !== have[j]);
        bad.push(`${gid}: its graded lines are not what the frozen call, the closing lines and the box score give (${have.length} written, ${wantText.length} due${i >= 0 ? `; first difference: ${have[i] || 'none'} where ${wantText[i]}` : ''})`);
      }
      if (c.graded.lines !== want.rows.length || c.graded.voids !== want.voids || c.graded.noCall !== want.noCall) bad.push(`${gid}: its grade's counts are not the lines'`);
    } else if (c.frozen && PL.gradeable(gid, g, boxes, recIdx.reads)) bad.push(`${gid}: final, box score and closing lines in, and left ungraded`);
  }
  /* the verdict */
  const cmp = PL.compared(rows, recIdx);
  if (Lg.decision) {
    const want = PL.decide(cmp, new Date(Lg.decision.decided_at.replace('Z', ':00Z')), Lg.bar);
    if (JSON.stringify(want) !== JSON.stringify(Lg.decision)) bad.push(`the verdict does not follow from the first ${Lg.bar.lines} graded lines`);
  } else if (cmp.length >= Lg.bar.lines) bad.push(`${Lg.bar.lines} lines are in and no verdict was written`);
  /* the summary */
  const want = PL.summarize(Lg, rows, recIdx);
  if (JSON.stringify(want) !== JSON.stringify(Lg.summary)) bad.push('the summary does not follow from the calls and the lines');
  /* the record: a game read once is never rewritten or lost */
  if (prev) {
    const reads = REC.readReads();
    for (const [gid, r] of Object.entries(prev.reads)) {
      if (!['ok', 'none'].includes(r.status)) continue;
      if (JSON.stringify(reads[gid]) !== JSON.stringify(r)) bad.push(`${gid}: its closing-lines read changed or was lost`);
    }
    for (const [f, text] of Object.entries(prev.record)) {
      const mine = fs.existsSync(path.join(DATA, f)) ? fs.readFileSync(path.join(DATA, f), 'utf8') : '';
      const group = t => { const m = new Map(); for (const l of t.split('\n').slice(1).filter(Boolean)) { const g = l.split(',')[0]; m.set(g, (m.get(g) || '') + l + '\n'); } return m; };
      const a = group(text), b = group(mine);
      for (const [g, t] of a) if (b.get(g) !== t) { bad.push(`${f}: ${g}'s closing lines changed or were lost`); }
    }
  }
  {
    const reads = REC.readReads();
    const counts = new Map();
    for (const f of fs.readdirSync(DATA).filter(f => /^props_\d{4}\.csv$/.test(f))) for (const r of REC.readRecord(+f.slice(6, 10))) counts.set(r.game_id, (counts.get(r.game_id) || 0) + 1);
    for (const [gid, n] of counts) if (!reads[gid] || reads[gid].status !== 'ok' || reads[gid].lines !== n) bad.push(`${gid}: ${n} closing lines in the record, its read says ${reads[gid] ? `${reads[gid].status}, ${reads[gid].lines}` : 'nothing'}`);
    for (const [gid, r] of Object.entries(reads)) if (r.status === 'ok' && !counts.has(gid) && r.lines > 0) bad.push(`${gid}: read with ${r.lines} lines, none in the record`);
  }
  return bad;
}

function main() {
  const now = opt('--now') ? new Date(opt('--now')) : process.env.NBA_NOW ? new Date(process.env.NBA_NOW) : new Date();
  const Lg = PL.readLedger();
  if (!Lg) { console.log('props check: no ledger yet, nothing to check'); return 0; }
  const lineText = fs.existsSync(PL.LINES()) ? fs.readFileSync(PL.LINES(), 'utf8') : '';
  const prev = prevFiles();
  const games = L.readGames();
  const boxes = PM.loadBoxes(DATA);
  const bad = check({ Lg, lineText, prev, games, boxes, now });
  for (const b of bad) console.log('FAIL', b);
  console.log(`props check: ${bad.length} failures${prev ? '' : ' (no earlier ledger to hold it to)'}`);
  return bad.length ? 1 : 0;
}

module.exports = { check, prevFiles };
if (require.main === module) process.exit(main());
