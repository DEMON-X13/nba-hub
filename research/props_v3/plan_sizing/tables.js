/* PLAN.md's sizing tables, drawn from the committed results (research only: SIZING).
 *   node research/props_v3/plan_sizing/tables.js  -> research/props_v3/results/plan_tables.md (a second)
 */
'use strict';
const fs = require('fs');
const path = require('path');
const R = path.join(__dirname, '..', 'results');
const J2 = JSON.parse(fs.readFileSync(path.join(R, 'plan_sizing2.json'), 'utf8'));
const J1 = JSON.parse(fs.readFileSync(path.join(R, 'plan_sizing.json'), 'utf8'));
const LC = JSON.parse(fs.readFileSync(path.join(R, 'plan_leakcheck.json'), 'utf8'));
const BC = JSON.parse(fs.readFileSync(path.join(R, 'plan_bootcheck.json'), 'utf8'));
const { B_MIN, ORTH_MIN, M_LL, M_BR } = J2.bar;
const e = v => (v == null || !Number.isFinite(v) ? '–' : (v * 1e4).toFixed(1));        // log loss in units of 1e-4
const f2 = v => (v == null || !Number.isFinite(v) ? '–' : v.toFixed(2));
const SPL = [['chrono', 'Chronological'], ['alternate0', 'Alternate A|B'], ['alternate1', 'Alternate B|A']];
const lines = [];
const p = s => lines.push(s);
p('# PLAN.md sizing tables (development data only)');
p('');
p(`Drawn by \`plan_sizing/tables.js\` from \`plan_sizing.json\`, \`plan_sizing2.json\`, \`plan_leakcheck.json\` and \`plan_bootcheck.json\`. Log-loss and Brier differences are in units of 0.0001 (negative: the nudge helps). The bar sized: T1, b's 90% interval above ${B_MIN} with at least ${ORTH_MIN} of the nudge outside the family's span; T2, the log-loss difference's 90% interval below -${M_LL * 1e4} (x 0.0001), Brier's below -${M_BR * 1e4}, no stat's log-loss interval wholly above 0. The family F has ${J2.family} columns. The stand-in forecaster is tools/props.js's 2024 fold (fitted on 2022-23 box scores): a size, never a candidate.`);
p('');
p('## A. The stand-in nudges, on lines they were not fitted on');
p('');
p('| Split | Nudge | T1: b [90%] | orth | T1 | T2: log loss [90%] | Brier [90%] | T2 | power T1 / T2 (1,100 games) | at half the effect |');
p('|---|---|---|---|---|---|---|---|---|---|');
for (const [k, lab] of SPL) for (const n of ['S_mix', 'S_d']) { const c = J2.splits[k].stand[n];
  p(`| ${lab} (${J2.splits[k].games} games) | ${n} | ${f2(c.t1.b)} [${f2(c.t1.lo)}, ${f2(c.t1.hi)}] | ${f2(c.t1.orth)} | ${c.met.T1 ? 'met' : 'not met'} | ${e(c.t2.ll)} [${e(c.t2.llCi[0])}, ${e(c.t2.llCi[1])}] | ${e(c.t2.br)} [${e(c.t2.brCi[0])}, ${e(c.t2.brCi[1])}] | ${c.met.T2 ? 'met' : 'not met'} | ${f2(c.power.T1)} / ${f2(Math.min(c.power.T2ll, c.power.T2br))} | ${f2(c.power.T1_halfEffect)} / ${f2(Math.min(c.power.T2ll_halfEffect, c.power.T2br_halfEffect))} |`); }
{ const F = J2.forwardChained; for (const n of ['S_mix', 'S_d']) { const c = F[n];
  p(`| Forward-chained, Dec to Apr (${F.games} games) | ${n} | ${f2(c.t1.b)} [${f2(c.t1.lo)}, ${f2(c.t1.hi)}] | ${f2(c.t1.orth)} | ${c.t1.lo > B_MIN && c.t1.orth >= ORTH_MIN ? 'met' : 'not met'} | ${e(c.t2.ll)} [${e(c.t2.llCi[0])}, ${e(c.t2.llCi[1])}] | ${e(c.t2.br)} [${e(c.t2.brCi[0])}, ${e(c.t2.brCi[1])}] | ${c.t2.llCi[1] < -M_LL && c.t2.brCi[1] < -M_BR ? 'met' : 'not met'} | ${f2(c.power.T1)} / ${f2(Math.min(c.power.T2ll, c.power.T2br))} | ${f2(c.power.T1_halfEffect)} / ${f2(Math.min(c.power.T2ll_halfEffect, c.power.T2br_halfEffect))} |`); } }
{ const A = J2.archive; p(`| The archive, frozen on all 2023-24 (${A.games} games, spent) | S_mix | ${f2(A.t1.b)} [${f2(A.t1.lo)}, ${f2(A.t1.hi)}] | ${f2(A.t1.orth)} | | ${e(A.t2.ll)} [${e(A.t2.llCi[0])}, ${e(A.t2.llCi[1])}] | ${e(A.t2.br)} | | | |`); }
p('');
p('## B. Every information-free rival, against the bar (the margin by which each fails)');
p('');
p('"On q": fitted on top of DraftKings\' fair chance, as a rival would be built. "Held out": features F does not hold, fitted the candidate\'s way (jointly with F), to size the margin against a rival nobody named. T1 margin: B_MIN less the interval\'s lower bound (positive: fails); "span" where the rival lies in F\'s span (no b). T2 margin: the interval\'s upper bound plus M_LL (positive: fails).');
p('');
p('| Rival | ' + SPL.map(s => `${s[1]}: T1 margin, T2 margin`).join(' | ') + ' |');
p('|---|' + SPL.map(() => '---|').join(''));
const rivRow = (lab, get) => p(`| ${lab} | ` + SPL.map(([k]) => { const c = get(J2.splits[k]); if (!c || c.singular) return 'singular'; const t1 = c.t1.collinear || c.t1.orth < ORTH_MIN ? `span (orth ${c.t1.orth == null ? '–' : c.t1.orth.toExponential(0)})` : f2(B_MIN - c.t1.lo); return `${t1}, ${e(c.t2.llCi[1] + M_LL)}`; }).join(' | ') + ' |');
for (const k of Object.keys(J2.splits.chrono.named)) rivRow(`${k} (on q)`, s => s.named[k]);
for (const k of Object.keys(J2.splits.chrono.namedAsCandidate)) rivRow(`${k} (the candidate's way)`, s => s.namedAsCandidate[k]);
for (const k of Object.keys(J2.splits.chrono.held)) rivRow(`${k} (held out)`, s => s.held[k]);
p('| S_mix shuffled across players (within stat and month) | ' + SPL.map(([k]) => { const sh = J2.splits[k].shuffled; return `${f2(B_MIN - Math.max(...sh.map(z => z.lo)))} (closest of ${sh.length}), ${e(Math.min(...sh.map(z => z.llHi)) + M_LL)}`; }).join(' | ') + ' |');
const all = []; for (const [k] of SPL) { const s = J2.splits[k]; for (const c of [...Object.values(s.named), ...Object.values(s.namedAsCandidate), ...Object.values(s.held)]) if (c && !c.singular) all.push(c); }
const t1c = all.filter(c => !c.t1.collinear && c.t1.orth >= ORTH_MIN).map(c => B_MIN - c.t1.lo), nz = all.filter(c => c.t2.llCi[0] !== 0 || c.t2.llCi[1] !== 0), t2c = nz.map(c => c.t2.llCi[1] + M_LL);
p('');
p(`Of ${all.length} rival fits (three splits), none meets T1 or T2. The closest to T1, with at least ${ORTH_MIN} of its variance outside F: margin ${f2(Math.min(...t1c))}; the closest to T2 among rivals whose nudge is not zero: margin ${e(Math.min(...t2c))} (x 0.0001); a rival whose nudge comes out zero (a month its training half never held) fails T2 by M_LL exactly. Every shuffle fails both.`);
p('');
p('## C. The stand-in candidate\'s calibration by stat (forward-chained, December to April)');
p('');
p('P(Over) = sigm(a + s logit p) on each stat\'s lines; "said less hit" is the mean chance less the Over rate, in points. MA is the stand-in candidate (its information-free part frozen with the nudge).');
p('');
p('| Stat | Lines | MA: slope [90%] | MA: said less hit | DraftKings\' fair chance: slope [90%] | said less hit | the nudge\'s T2 on the stat [90%] |');
p('|---|---|---|---|---|---|---|');
{ const c = J2.forwardChained.S_mix; for (const [s, v] of Object.entries(c.calib)) p(`| ${s} | ${v.ma.n} | ${f2(v.ma.s)} [${f2(v.ma.sLo)}, ${f2(v.ma.sHi)}] | ${(100 * (v.ma.said - v.ma.hit)).toFixed(2)} | ${f2(v.q.s)} [${f2(v.q.sLo)}, ${f2(v.q.sHi)}] | ${(100 * (v.q.said - v.q.hit)).toFixed(2)} | ${e(c.byStat[s].ll)} [${e(c.byStat[s].llCi[0])}, ${e(c.byStat[s].llCi[1])}] |`);
  p(''); p(`The stand-in candidate less DraftKings' fair chance (forward-chained): log loss ${e(c.maLessQ.ll)} [${e(c.maLessQ.llCi[0])}, ${e(c.maLessQ.llCi[1])}], Brier ${e(c.maLessQ.br)} [${e(c.maLessQ.brCi[0])}, ${e(c.maLessQ.brCi[1])}]; less tools/props.js ${e(c.maLessToolsProps.ll)} [${e(c.maLessToolsProps.llCi[0])}, ${e(c.maLessToolsProps.llCi[1])}].`); }
p('');
p('By split (slope [90%], said less hit):');
p('');
p('| Split | ' + ['pts', 'reb', 'ast', 'tpm', 'stl', 'blk'].join(' | ') + ' |');
p('|---|---|---|---|---|---|---|');
for (const [k, lab] of SPL) { const c = J2.splits[k].stand.S_mix.calib;
  p(`| ${lab}, MA | ` + Object.values(c).map(v => `${f2(v.ma.s)} [${f2(v.ma.sLo)}, ${f2(v.ma.sHi)}], ${(100 * (v.ma.said - v.ma.hit)).toFixed(1)}`).join(' | ') + ' |');
  p(`| ${lab}, DraftKings | ` + Object.values(c).map(v => `${f2(v.q.s)} [${f2(v.q.sLo)}, ${f2(v.q.sHi)}], ${(100 * (v.q.said - v.q.hit)).toFixed(1)}`).join(' | ') + ' |'); }
p('');
p('## D. Is the stat mix an artefact? (`plan_leakcheck.json`)');
p('');
p(`- Early exits (projected 24+ minutes, played his club's previous game, played under 12): ${LC.earlyExits.lines} lines on ${LC.earlyExits.playerGames} player-games; the nudge moves their chance by ${(100 * LC.earlyExits.nudgeShiftExit).toFixed(2)} points on average, the rest's ${(100 * LC.earlyExits.nudgeShiftRest).toFixed(2)}; DraftKings said ${(100 * LC.earlyExits.dkExit).toFixed(1)}% and ${(100 * LC.earlyExits.dkRest).toFixed(1)}%.`);
p(`- The level read without the points line: the gain on the other stats ${e(LC.anchors.levelWithoutPoints_nonPoints.ll)} [${e(LC.anchors.levelWithoutPoints_nonPoints.llCi[0])}, ${e(LC.anchors.levelWithoutPoints_nonPoints.llCi[1])}], as built ${e(LC.anchors.asBuilt_nonPoints.ll)}, from points alone ${e(LC.anchors.levelFromPointsAlone_nonPoints.ll)}.`);
p(`- Correlation with the minutes surprise (played less projected), per player-game: the nudge ${LC.minutesSurprise.corrMeanNudgeWithSurprise.toFixed(3)}; the raw disagreement ${LC.minutesSurprise.corrRawDisagreementWithSurprise.toFixed(3)}; DraftKings' level ${LC.minutesSurprise.corrDKLevelWithSurprise.toFixed(3)}.`);
p(`- Where his points line is posted: ${e(LC.pointsPosted.with.ll)}; where it is not: ${e(LC.pointsPosted.without.ll)} (${LC.pointsPosted.without.lines} lines).`);
p('');
p('## E. The interval for T1: cluster-robust against the game-clustered bootstrap (`plan_bootcheck.json`)');
p('');
p(`Chronological split, S_mix: robust b ${f2(BC.robust.b)} [${f2(BC.robust.lo)}, ${f2(BC.robust.hi)}], standard error ${BC.robust.se.toFixed(3)}; bootstrap (${BC.bootstrap.resamples} resamples of games) [${f2(BC.bootstrap.lo)}, ${f2(BC.bootstrap.hi)}], standard deviation ${BC.bootstrap.sd.toFixed(3)}.`);
p('');
p('## F. Round 1 (the small family), kept for the record');
p('');
p('With a family of per-stat intercepts, logit q, logit of the implied Over, the total, the spread\'s size and the generic mix, and pooled hinges, favourite, home, month and night/game features (52 columns), three rivals met T1 on the alternate-nights split:');
p('');
for (const k of ['R4_month', 'R7_game', 'R_all']) p(`- ${k}: ${SPL.slice(1).map(([s, lab]) => { const c = J1.splits[s].rivals[k]; return `${lab} b ${f2(c.t1.b)} [${f2(c.t1.lo)}, ${f2(c.t1.hi)}]`; }).join('; ')}`);
p('');
p('which is why F is the union of the named rivals\' features (round 2).');
fs.writeFileSync(path.join(R, 'plan_tables.md'), lines.join('\n') + '\n');
console.log(lines.join('\n'));
