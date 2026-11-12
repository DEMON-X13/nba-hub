/* The tables why_it_failed.md quotes, drawn from the three result files and nothing else (research only).
 *
 *   node research/props_v3/why_tables.js     reads results/why_trial.json, why_lines_archive.json, why_lines_2024.json
 *                                            and writes results/why_tables.md (a second; computes no new number)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, 'results');
const rd = f => JSON.parse(fs.readFileSync(path.join(R, f), 'utf8'));
const TR = rd('why_trial.json'), AR = rd('why_lines_archive.json'), Y4 = rd('why_lines_2024.json');
const fx_ = d => x => { if (x == null || !isFinite(x)) return '–'; const t = (+x).toFixed(d); return /^-0\.0*$/.test(t) ? t.slice(1) : t.replace('-', '−'); };
const f2 = fx_(2), f3 = fx_(3), f4 = fx_(4);
const sg = (x, f = f4) => { if (x == null || !isFinite(x)) return '–'; const a = f(Math.abs(x)); return (/^[0.]+$/.test(a) ? '' : x > 0 ? '+' : '−') + a; };
const pc = (x, d = 1) => (x == null || !isFinite(x) ? '–' : (100 * x).toFixed(d) + '%');
const ci = (c, f = f4, s = true) => (c ? `[${s ? sg(c[0], f) : f(c[0])}, ${s ? sg(c[1], f) : f(c[1])}]` : '');
const pcCi = c => (c ? `[${pc(c[0], 0)}, ${pc(c[1], 0)}]` : '');
const pcS = x => pc(x, 0).replace('-', '−');
const NAME = { pts: 'Points', reb: 'Rebounds', ast: 'Assists', tpm: 'Threes', stl: 'Steals', blk: 'Blocks', pra: 'Pts+reb+ast', pr: 'Pts+reb', pa: 'Pts+ast', ar: 'Ast+reb', sb: 'Stl+blk' };
const SETS = [['The trial (2026-27, 20 Oct to 4 Nov)', TR, true], ['The 2026 play-in and playoffs (archive)', AR, false], ['DraftKings 2023-24 regular season', Y4, false]];
const P = (J, trial) => (trial ? J : J.toolsProps);                 // the trial's file has its blocks at the top
const md = [];
const h = t => md.push('', `### ${t}`, '');
const row = cells => md.push('| ' + cells.join(' | ') + ' |');

h('A. The gap, rebuilt from the raw inputs (model less DraftKings; positive: DraftKings is better; 90% intervals resampling games)');
row(['Set', 'Lines', 'Games', 'Log loss: model / DraftKings', 'Difference [90%]', 'Brier difference [90%]']); row(['---', '---', '---', '---', '---', '---']);
for (const [label, J, trial] of SETS) {
  const s = trial ? J.reproduce.here : J.toolsProps.reproduce, c = trial ? J.reproduce.llDiffCi_toolsPropsBootCI : J.toolsProps.reproduce.llDiffCi_toolsPropsBootCI, cb = trial ? J.reproduce.brDiffCi_toolsPropsBootCI : J.toolsProps.reproduce.brDiffCi_toolsPropsBootCI;
  row([label + ', tools/props.js', trial ? J.reproduce.lines : s.lines, trial ? J.reproduce.games : s.games, `${f4(s.llModel)} / ${f4(s.llMarket)}`, `${sg(s.llDiff)} ${ci(c)}`, `${sg(s.brDiff)} ${ci(cb)}`]);
  if (trial) { const b = J.baseStats; row(['  of which the six base stats', b.lines, b.games, `${f4(b.llModel)} / ${f4(b.llMarket)}`, `${sg(b.llDiff)} ${ci(b.llDiffCi)}`, `${sg(b.brDiff)} ${ci(b.brDiffCi)}`]); }
  if (!trial) { const a = J.A.reproduce; row([label + ', candidate A', a.lines, a.games, `${f4(a.llModel)} / ${f4(a.llMarket)}`, `${sg(a.llDiff)} ${ci(a.llDiffCi_toolsPropsBootCI)}`, `${sg(a.brDiff)} ${ci(a.brDiffCi_toolsPropsBootCI)}`]); }
}

h('B. How sure each is: the average distance of its chance from 50%, and its calibration slope (1 is right; under 1 too sure)');
row(['Set', 'Model: from 50%', 'DraftKings: from 50%', 'Model slope [90%]', 'DraftKings slope [90%]', 'Candidate A slope [90%]']); row(['---', '---', '---', '---', '---', '---']);
for (const [label, J, trial] of SETS) {
  const S = P(J, trial).sureness.pooled;
  row([label, pc(S.modelFrom50), pc(S.marketFrom50), `${f2(S.model.slope)} ${ci(S.model.slopeCi, f2, false)}`, `${f2(S.market.slope)} ${ci(S.market.slopeCi, f2, false)}`, trial ? '–' : `${f2(J.A.sureness.pooled.model.slope)} ${ci(J.A.sureness.pooled.model.slopeCi, f2, false)}`]);
  if (trial) for (const [lab, key] of [['  of which the six base stats', 'baseStats'], ['  of which the five combos', 'combos']]) { const Z = J.sureness[key]; row([lab + ` (${Z.lines} lines)`, pc(Z.modelFrom50), pc(Z.marketFrom50), `${f2(Z.model.slope)} ${ci(Z.model.slopeCi, f2, false)}`, `${f2(Z.market.slope)} ${ci(Z.market.slopeCi, f2, false)}`, '–']); }
}
md.push('', 'The chance said, in bands, against how often the Over went in (the trial):', '');
row(['Chance said', 'Model: lines', 'said', 'hit', 'DraftKings: lines', 'said', 'hit']); row(['---', '---', '---', '---', '---', '---', '---']);
for (const b of TR.sureness.table) row([b.band, b.model.lines, pc(b.model.said), pc(b.model.hit), b.market.lines, pc(b.market.said), pc(b.market.hit)]);

h('C. The calibration slope by stat: model / DraftKings [90%]');
row(['Stat', 'Trial: model', 'Trial: DraftKings', 'Archive: model', 'Archive: DraftKings', '2023-24: model', '2023-24: DraftKings']); row(['---', '---', '---', '---', '---', '---', '---']);
for (const k of Object.keys(NAME)) {
  const c = (J, trial) => { const s = P(J, trial).sureness.byStat[k]; return s ? [`${f2(s.model.slope)} ${ci(s.model.slopeCi, f2, false)}`, `${f2(s.market.slope)} ${ci(s.market.slopeCi, f2, false)}`] : ['–', '–']; };
  row([NAME[k], ...c(TR, true), ...c(AR, false), ...c(Y4, false)]);
}

h('D. Where the gap sits: lines where the two disagree by 10 points or more');
row(['Set', 'Share of lines', 'Share of the gap', 'Model 10+ higher: model said / DraftKings / the Over hit', 'DraftKings 10+ higher: model said / DraftKings / hit']); row(['---', '---', '---', '---', '---']);
for (const [label, J, trial] of SETS) {
  const W = P(J, trial).where, far = W.find(w => w.label.startsWith('apart')), mh = W.find(w => w.label === 'model 10+ above'), dh = W.find(w => w.label.startsWith('DraftKings 10+'));
  row([label, pc(far.share), pc(far.gapShare), `${pc(mh.modelSaid)} / ${pc(mh.marketSaid)} / ${pc(mh.overHit)} (${mh.lines} lines)`, `${pc(dh.modelSaid)} / ${pc(dh.marketSaid)} / ${pc(dh.overHit)} (${dh.lines} lines)`]);
}

h('E. The gap taken apart (each part at most, by a recalibration fitted on the very lines: an upper bound, not a candidate)');
row(['Set', 'Gap', 'The Over lean', 'Over-sureness', 'Information DraftKings had', 'Slope a recalibration needs']); row(['---', '---', '---', '---', '---', '---']);
for (const [label, J, trial] of SETS) {
  const G = trial ? J.gapParts.pooled : J.toolsProps.parts.pooled;
  const slope = trial ? G.model.bothCoef[1] : G.recalibratedSlope, info = trial ? G.model.both - G.market.raw : G.informationPart;
  row([label, f4(G.gap), `${f4(G.leanPart)} (${pc(G.shares.lean, 0)})`, `${f4(G.overSurePart)} (${pc(G.shares.overSure, 0)})`, `${f4(info)} (${pc(G.shares.information, 0)})`, f2(slope)]);
  if (trial) for (const [lab, key] of [['  of which the six base stats', 'baseStats'], ['  of which the five combos', 'combos']]) { const Z = J.gapParts[key]; row([lab, f4(Z.gap), `${f4(Z.leanPart)} (${pc(Z.shares.lean, 0)})`, `${f4(Z.overSurePart)} (${pc(Z.shares.overSure, 0)})`, `${f4(Z.model.both - Z.market.raw)} (${pc(Z.shares.information, 0)})`, f2(Z.model.bothCoef[1])]); }
}
md.push('', 'By stat (the gap, then lean / over-sureness / information):', '');
row(['Stat', 'Trial', 'Archive', '2023-24']); row(['---', '---', '---', '---']);
for (const k of Object.keys(NAME)) {
  const c = (J, trial) => { const G = trial ? J.gapParts.byStat[k] : J.toolsProps.parts.byStat[k]; if (!G) return '–'; const info = trial ? G.model.both - G.market.raw : G.informationPart; return `${sg(G.gap)}: ${sg(G.leanPart)} / ${sg(G.overSurePart)} / ${sg(info)}`; };
  row([NAME[k], c(TR, true), c(AR, false), c(Y4, false)]);
}

h('F. When they disagreed, whose number the result landed on, and through what');
md.push('Slope of what happened (the stat less the model\'s mean) on DraftKings\' disagreement (the mean its price implies less the model\'s), in the model\'s standard deviations: 1 means the result landed, on average, at DraftKings\' number; 0 at the model\'s. The minutes share is the part of that which came through the minutes played rather than the production per minute.', '');
row(['Lines', 'Trial: slope [90%]', 'Trial: minutes share [90%]', 'Archive: slope', 'Archive: minutes share', '2023-24: slope', '2023-24: minutes share']); row(['---', '---', '---', '---', '---', '---', '---']);
const fx = (v) => (v ? [`${f2(v.slopeTotal)} ${v.slopeTotalCi ? ci(v.slopeTotalCi, f2, false) : ''}`, v.slopeTotalCi && v.slopeTotalCi[0] > 0 ? `${pcS(v.minutesShare)} [${pcS(v.minutesShareCi[0])}, ${pcS(v.minutesShareCi[1])}]` : '– (no disagreement came true to split)'] : ['–', '–']);
const mins = J => J.minutes || J.toolsProps.minutes;
row(['All', ...fx(mins(TR).pooled), ...fx(mins(AR).pooled), ...fx(mins(Y4).pooled)]);
row(['The six base stats', ...fx(mins(TR).baseStats), '–', '–', ...fx(mins(Y4).pooled)]);
row(['Started', ...fx(mins(TR).starters), ...fx(mins(AR).starters), ...fx(mins(Y4).starters)]);
row(['Off the bench', ...fx(mins(TR).bench), ...fx(mins(AR).bench), ...fx(mins(Y4).bench)]);
for (const k of Object.keys(NAME)) row([NAME[k], ...fx(mins(TR).byStat[k]), ...fx(mins(AR).byStat[k]), ...fx(mins(Y4).byStat[k])]);
md.push('', `The trial's late news (lines on a side where a called teammate projected 20+ minutes did not play, or a teammate played 15+ with no call: ${mins(TR).lineCounts.eitherLateNews} of ${TR.reproduce.lines} lines): slope ${f2(mins(TR).lateNews.slopeTotal)}, minutes share ${pc(mins(TR).lateNews.minutesShare, 0)} ${pcCi(mins(TR).lateNews.minutesShareCi)}; lines with no late news (and the player not on the day's report): slope ${f2(mins(TR).noLateNews.slopeTotal)}, minutes share ${pc(mins(TR).noLateNews.minutesShare, 0)} ${pcCi(mins(TR).noLateNews.minutesShareCi)}. The late-news lines carry ${pc(mins(TR).contributions.lateNews.ofMinutesCov, 0)} of the minutes part on ${pc(mins(TR).contributions.lateNews.ofLines, 0)} of the lines: beyond the no-news lines' rate per line, ${pc(mins(TR).lateNewsExcess.share, 0)} ${pcCi(mins(TR).lateNewsExcess.ci)} of the minutes part. The calls were made a median ${f2(mins(TR).callAgeHours.median)} hours before tip-off.`);
const Y4m = mins(Y4);
md.push('', `2023-24, every line on the box score's list of who dressed (so no inactive news was missing): his first game of the season ${Y4m.firstGameOfSeason ? `slope ${f2(Y4m.firstGameOfSeason.slopeTotal)}, minutes ${pc(Y4m.firstGameOfSeason.minutesShare, 0)}` : '–'}; back after 3+ missed games ${Y4m.backFrom3PlusMissed ? `slope ${f2(Y4m.backFrom3PlusMissed.slopeTotal)}, minutes ${pc(Y4m.backFrom3PlusMissed.minutesShare, 0)}` : '–'}; his first 10 games for a new club ${Y4m.newClubFirst10 ? `slope ${f2(Y4m.newClubFirst10.slopeTotal)}, minutes ${pc(Y4m.newClubFirst10.minutesShare, 0)}` : '–'}; every other line ${Y4m.regular ? `slope ${f2(Y4m.regular.slopeTotal)}, minutes ${pc(Y4m.regular.minutesShare, 0)} ${pcCi(Y4m.regular.minutesShareCi)}` : '–'}.`);
md.push('', 'Minutes said and played where they disagreed most:', '');
row(['Set', 'Model 10+ higher on the Over: said / played', 'DraftKings 10+ higher: said / played', 'Within 5 points: said / played']); row(['---', '---', '---', '---']);
for (const [label, J] of SETS) { const g = mins(J).disagreementGroups; row([label, `${f2(g.modelHigher10.minutesSaid)} / ${f2(g.modelHigher10.minutesPlayed)}`, `${f2(g.dkHigher10.minutesSaid)} / ${f2(g.dkHigher10.minutesPlayed)}`, `${f2(g.within5.minutesSaid)} / ${f2(g.within5.minutesPlayed)}`]); }
{ const p = mins(TR).disagreementGroups; md.push('', `The trial's points lines: where the model was 10+ points higher on the Over (${p.modelHigher10.points.lines} lines) it said ${f2(p.modelHigher10.points.modelMean)} points, DraftKings' price implied ${f2(p.modelHigher10.points.dkImpliedMean)}, the line averaged ${f2(p.modelHigher10.points.line)} and they scored ${f2(p.modelHigher10.points.scored)}; where DraftKings was 10+ higher (${p.dkHigher10.points.lines}), ${f2(p.dkHigher10.points.modelMean)}, ${f2(p.dkHigher10.points.dkImpliedMean)}, ${f2(p.dkHigher10.points.line)} and ${f2(p.dkHigher10.points.scored)}.`); }

h('G. The Over lean');
row(['Set', 'Model said the Over / it hit / DraftKings said', 'Mean less the stat', 'One shift removes, at most (share of the gap)', 'A shift each month removes, at most']); row(['---', '---', '---', '---', '---']);
{ const L = TR.lean; row(['The trial', `${pc(L.overSaid)} / ${pc(L.overHit)} / ${pc(L.overDK)}`, sg(L.meanMinusStat, f2), `${f4(L.shiftInLogit.gain)} (${pc(L.shiftInLogit.shareOfGap)})`, '–']); }
for (const [label, J] of SETS.slice(1)) { const L = J.toolsProps.lean; row([label, `${pc(L.overSaid)} / ${pc(L.overHit)} / ${pc(L.overDK)}`, sg(L.meanMinusStat, f2), `${f4(L.oneShift.gain)} (${pc(L.oneShift.shareOfGap)})`, `${f4(L.shiftEachMonth.gain)} (${pc(L.shiftEachMonth.shareOfGap)})`]); }
if (Y4.toolsProps.lean.octNov) { const o = Y4.toolsProps.lean.octNov; md.push('', `2023-24's first two months (${o.lines} lines): the model said the Over ${pc(o.overSaid)}, it hit ${pc(o.overHit)}; removing that lean in sample gains ${f4(o.gain)} a line there, ${pc(o.shareOfSeasonGap)} of the season's gap.`); }
md.push('', `Removing the trial's lean from the means instead (each stat's mean moved by its own average error, the spread unchanged) makes its log loss worse, ${f4(TR.lean.meanShift.llBefore)} to ${f4(TR.lean.meanShift.llAfter)}: the model's distribution already shaded the Over at a line near its mean.`);

h('H. Month by month, DraftKings 2023-24 (tools/props.js; candidate A beside it)');
row(['Month', 'Lines', 'Gap [90%]', 'A\'s gap', 'Model said / hit / DraftKings', 'Mean less stat', 'Calibration slope', 'Lean removed, at most']); row(['---', '---', '---', '---', '---', '---', '---', '---']);
for (const [mo, v] of Object.entries(Y4.toolsProps.byMonth)) row([mo, v.lines, `${sg(v.llDiff)} ${ci(v.llDiffCi)}`, sg(Y4.A.byMonth[mo] && Y4.A.byMonth[mo].llDiff), `${pc(v.modelSaid)} / ${pc(v.overHit)} / ${pc(v.marketSaid)}`, sg(v.meanMinusStat, f2), f2(v.calibSlope), f4(v.leanGain)]);
md.push('', 'The gap by stat and month (2023-24, tools/props.js):', '');
const stats24 = ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'];
row(['Month', ...stats24.map(k => NAME[k])]); row(['---', ...stats24.map(() => '---')]);
for (const [mo, v] of Object.entries(Y4.toolsProps.byMonth)) row([mo, ...stats24.map(k => (v.byStat[k] ? sg(v.byStat[k].llDiff) : '–'))]);

h('I. The gap by stat (tools/props.js; 90% intervals resampling games)');
row(['Stat', 'Trial', 'Archive', '2023-24']); row(['---', '---', '---', '---']);
for (const k of Object.keys(NAME)) {
  const c = s => (s ? `${sg(s.llDiff)} ${ci(s.llDiffCi)}` : '–');
  row([NAME[k], c(TR.byStat[k]), c(AR.toolsProps.byStat[k]), c(Y4.toolsProps.byStat[k])]);
}
md.push('', 'Candidate A by stat, 2023-24: ' + stats24.map(k => `${NAME[k]} ${sg(Y4.A.byStat[k].llDiff)} ${ci(Y4.A.byStat[k].llDiffCi)}`).join('; ') + '.');

h('J. Where minutes are least known: the gap by kind of line (tools/props.js)');
row(['Lines', 'Trial: lines, gap [90%]', 'Trial: minutes said / played', '2023-24: lines, gap [90%]', '2023-24: minutes said / played']); row(['---', '---', '---', '---', '---']);
{
  const Rt = Object.fromEntries(TR.roles.map(r => [r.label, r])), Ry = Object.fromEntries(Y4.toolsProps.roles.map(r => [r.label, r]));
  const pairs = [['his first game of the season', 'his first game of the season'], ['a new club (another club last season)', 'his first 10 games for a new club'], [null, 'back after missing 3+ of his club\'s games'],
    ['started', 'started'], ['off the bench', 'off the bench'], ['projected under 20 minutes', 'projected under 20 minutes'], ['projected 20 to 30', 'projected 20 to 30'], ['projected 30 to 34', 'projected 30 to 34'], ['projected 34+', 'projected 34+'],
    ['a late scratch or an uncalled teammate on his side', null], ['neither', null]];
  const cell = r => (r && r.llDiff != null ? [`${r.lines}, ${sg(r.llDiff)} ${ci(r.llDiffCi)}`, `${f2(r.minutesSaid)} / ${f2(r.minutesPlayed)}`] : ['–', '–']);
  for (const [a, b] of pairs) row([a || b, ...cell(a && Rt[a]), ...cell(b && Ry[b])]);
  md.push('', '(The trial\'s "new club" is a player whose last appearance of 2025-26 was for another club, in the trial\'s first two weeks; 2023-24\'s is his first 10 games for a new club.)');
}

h('K. What the model adds beyond DraftKings\' price: the share w of its disagreement worth keeping (fitted on the lines; 0 is nothing)');
row(['Stat', 'Trial: w [90%]', 'Archive: w [90%]', '2023-24: w [90%]']); row(['---', '---', '---', '---']);
const bw = (J, trial, k) => { const B = trial ? J.beyond : J.toolsProps.beyond; const b = k ? B.byStat[k] : B.pooled; return b ? `${f2(b.w)} ${ci(b.wCi, f2)}` : '–'; };
row(['All, pooled', bw(TR, true), bw(AR, false), bw(Y4, false)]);
row(['The six base stats, pooled', `${f2(TR.beyond.baseStats.w)} ${ci(TR.beyond.baseStats.wCi, f2)}`, '–', bw(Y4, false)]);
for (const k of Object.keys(NAME)) row([NAME[k], bw(TR, true, k), bw(AR, false, k), bw(Y4, false, k)]);
md.push('', `Candidate A, pooled: archive ${f2(AR.A.beyond.pooled.w)} ${ci(AR.A.beyond.pooled.wCi, f2)}, 2023-24 ${f2(Y4.A.beyond.pooled.w)} ${ci(Y4.A.beyond.pooled.wCi, f2)}. With a free intercept and a free weight on DraftKings' own chance, the trial's pooled w is ${f2(TR.beyond.pooled.wFree)} ${ci(TR.beyond.pooled.wFreeCi, f2)}, the archive's ${f2(AR.toolsProps.beyond.pooled.wFree)} ${ci(AR.toolsProps.beyond.pooled.wFreeCi, f2)}, 2023-24's ${f2(Y4.toolsProps.beyond.pooled.wFree)} ${ci(Y4.toolsProps.beyond.pooled.wFreeCi, f2)}. Keeping that share, in sample, gains ${f4(TR.beyond.pooled.llGainInSample)} log loss on the trial, ${f4(AR.toolsProps.beyond.pooled.llGainInSample)} on the archive and ${f4(Y4.toolsProps.beyond.pooled.llGainInSample)} on 2023-24.`);

fs.writeFileSync(path.join(R, 'why_tables.md'), '# The tables of why_it_failed.md\n\nDrawn by `node research/props_v3/why_tables.js` from `results/why_trial.json`, `results/why_lines_archive.json` and `results/why_lines_2024.json`; it computes no number of its own.\n' + md.join('\n') + '\n');
console.log('wrote research/props_v3/results/why_tables.md');
