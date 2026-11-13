/* THE TEST STEP ONLY: the one-shot fetch's gate and its public record (PLAN.md 3.1 and 3.4, as revised after the review
 * of 13 November 2026, findings F3 and F4). WRITTEN AND TESTED IN A SANDBOX (test/machinery_check.js), NEVER RUN on the
 * real feed. Research only.
 *
 *   PROPS_V3_PREREG=<sha> PROPS_V3_BRANCH=<branch> node research/props_v3/test/fetch_record.js gate|start|finish
 *
 * The gate (before any request to the feed):
 *   - <sha> holds research/props_v3/PREREG.md, PREREG_HASHES.json and PREREG_AUDIT.md, and is on origin's <branch>
 *     (fetched afresh: pushed, not only committed);
 *   - the audit reads "verdict: sound" on a line of its own, and names the SHA-256 of the PREREG.md and the
 *     PREREG_HASHES.json it audited ("audited PREREG.md sha256 <hex>", "audited PREREG_HASHES.json sha256 <hex>"),
 *     each equal to that file as <sha> holds it: a preregistration edited after its audit is refused;
 *   - the fetch's record, research/props_v3/test/fetch_2023.json, is read from every commit on origin that ever held it
 *     (any branch, the whole history), never from the cache: with none, the decision is "start"; with every version
 *     naming this <sha> and none finished, "resume" (an interrupted fetch run again under the same preregistration,
 *     fetch_dk40.js keeping what an earlier read found by its own rule); with a finished version, refused, unless
 *     PROPS_V3_RECOVER=1, when it is "recover" (the cache lost after the fetch: fetched again, and the clean lines must
 *     come out byte for byte as the record holds them, or finish refuses and nothing can be scored); any version naming
 *     another preregistration: refused.
 * start: writes the record (the preregistration, the branch, the window, the time), commits it alone and pushes it to
 *   origin's <branch>, then reads origin again and refuses unless the record is there: nothing is fetched before the
 *   fetch's start is public.
 * finish: after fetch_dk40.js and the cleaner, the SHA-256 of the fetched csv, its reads, the request log and the clean
 *   lines and starts, the requests' and rows' counts, and the time; committed alone and pushed as start's. On a recovery
 *   the clean lines' and starts' SHA-256 must equal the finished record's; the recovery is appended to it.
 * The scorer (test/score.js) takes the clean lines' SHA-256 from the finished record on origin, never from the cache.
 * Every function takes the repository's root, so the sandbox check can run them on a repository of its own.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const REC = 'research/props_v3/test/fetch_2023.json';
const FROM = '2022-10-18', TO = '2023-04-09';
const sha256 = buf => crypto.createHash('sha256').update(buf).digest('hex');
const git = (root, args, opts = {}) => execFileSync('git', args, { cwd: root, encoding: opts.buffer ? null : 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1 << 28 });
const tryGit = (root, args, opts) => { try { return git(root, args, opts); } catch (e) { return null; } };
const refuse = m => { const e = new Error(`refused: ${m}`); e.refused = true; return e; };

/* the preregistration at <sha>, held to its audit */
function checkPrereg(root, sha, branch) {
  if (!/^[0-9a-f]{7,40}$/.test(sha || '')) throw refuse('no preregistration commit (PROPS_V3_PREREG)');
  if (!/^[A-Za-z0-9._/-]+$/.test(branch || '')) throw refuse('no branch (PROPS_V3_BRANCH)');
  const full = (tryGit(root, ['rev-parse', '--verify', `${sha}^{commit}`]) || '').trim();
  if (!full) throw refuse(`${sha} is not a commit here`);
  const file = f => tryGit(root, ['show', `${full}:research/props_v3/${f}`], { buffer: true });
  const P = file('PREREG.md'), H = file('PREREG_HASHES.json'), A = file('PREREG_AUDIT.md');
  if (!P) throw refuse(`${sha} holds no research/props_v3/PREREG.md`);
  if (!H) throw refuse(`${sha} holds no research/props_v3/PREREG_HASHES.json`);
  if (!A) throw refuse(`${sha} holds no research/props_v3/PREREG_AUDIT.md`);
  const audit = A.toString('utf8').split('\n').map(l => l.trim());
  if (!audit.includes('verdict: sound')) throw refuse(`${sha}'s audit has no line reading "verdict: sound"`);
  for (const [f, buf] of [['PREREG.md', P], ['PREREG_HASHES.json', H]]) {
    const line = audit.find(l => l.startsWith(`audited ${f} sha256 `)), said = line ? line.split(' ').pop() : null;
    if (!said) throw refuse(`${sha}'s audit does not name the SHA-256 of the ${f} it audited`);
    if (said !== sha256(buf)) throw refuse(`${f} at ${sha} is not the one its audit audited (audited ${said.slice(0, 12)}, held ${sha256(buf).slice(0, 12)}): edited after the audit`);
  }
  git(root, ['fetch', '--quiet', 'origin']);
  if (tryGit(root, ['merge-base', '--is-ancestor', full, `refs/remotes/origin/${branch}`]) === null) throw refuse(`${sha} is not on origin's ${branch} (pushed)`);
  return full;
}
/* every version of the record origin has ever held, oldest first */
function recordVersions(root) {
  git(root, ['fetch', '--quiet', 'origin']);
  const commits = (tryGit(root, ['log', '--remotes=origin', '--format=%H', '--reverse', '--', REC]) || '').split('\n').filter(Boolean);
  const out = [];
  for (const c of commits) { const t = tryGit(root, ['show', `${c}:${REC}`]); if (t == null) continue; let j; try { j = JSON.parse(t); } catch (e) { throw refuse(`the record at ${c} does not read`); } out.push({ commit: c, rec: j }); }
  return out;
}
function decide(root, sha, branch, env = process.env) {
  const full = checkPrereg(root, sha, branch), vs = recordVersions(root);
  if (!vs.length) return { decision: 'start', prereg: full };
  const other = vs.find(v => v.rec.prereg !== full);
  if (other) throw refuse(`origin holds the fetch's record under another preregistration (${String(other.rec.prereg).slice(0, 12)}, ${other.commit.slice(0, 12)})`);
  const fin = vs.filter(v => v.rec.finished);
  if (fin.length) { if (env.PROPS_V3_RECOVER === '1') return { decision: 'recover', prereg: full, record: fin[fin.length - 1].rec }; throw refuse(`the 2022-23 fetch has run already under ${full.slice(0, 12)} (finished ${fin[fin.length - 1].rec.finished}, ${fin[fin.length - 1].commit.slice(0, 12)}); a lost cache is fetched again only with PROPS_V3_RECOVER=1`); }
  return { decision: 'resume', prereg: full, record: vs[vs.length - 1].rec };
}
/* commit the record alone, push it to origin's branch, and read it back from origin */
function publish(root, branch, rec, msg) {
  const f = path.join(root, REC); fs.mkdirSync(path.dirname(f), { recursive: true });
  fs.writeFileSync(f, JSON.stringify(rec, null, 1) + '\n');
  git(root, ['add', '--', REC]); git(root, ['commit', '--quiet', '-m', msg, '--', REC]);
  git(root, ['push', '--quiet', 'origin', `HEAD:refs/heads/${branch}`]);
  const back = recordVersions(root).pop();
  if (!back || JSON.stringify(back.rec) !== JSON.stringify(rec)) throw refuse('the record is not on origin after the push');
  return back.commit;
}
function start(root, sha, branch, env = process.env) {
  const d = decide(root, sha, branch, env);
  if (d.decision !== 'start') return d;
  const rec = { v: 1, what: "the one-shot test's fetch of DraftKings' 2022-23 provider-40 lines (PLAN.md 3.1)", prereg: d.prereg, branch, window: [FROM, TO], started: new Date().toISOString() };
  d.commit = publish(root, branch, rec, `props_v3: the 2022-23 fetch started under preregistration ${d.prereg.slice(0, 12)}`);
  return d;
}
function filesNow(root) {
  const p = f => path.join(root, f);
  const F = { csv: 'research/props_v2/cache/props40_2023.csv', reads: 'research/props_v2/cache/props40_reads.json', requests: `research/props_v3/cache/fetch_dk40_${FROM}_${TO}.requests.tsv`, lines: 'research/props_v3/cache/dk40_2023_lines.csv', starts: 'research/props_v3/cache/dk40_2023_starts.csv' };
  const out = { sha256: {}, counts: {} };
  for (const [k, f] of Object.entries(F)) { if (!fs.existsSync(p(f))) throw refuse(`${f} is not there`); out.sha256[f] = sha256(fs.readFileSync(p(f))); }
  const req = fs.readFileSync(p(F.requests), 'utf8').split('\n').filter(l => l && !/^(started|finished)\t/.test(l));
  const status = {}; for (const l of req) { const c = l.split('\t')[2] || ''; status[c] = (status[c] || 0) + 1; }
  out.counts = { requests: req.length, byStatus: status, cleanRows: fs.readFileSync(p(F.lines), 'utf8').split('\n').filter(Boolean).length - 1 };
  return out;
}
function finish(root, sha, branch, env = process.env) {
  const vs = recordVersions(root), full = checkPrereg(root, sha, branch);
  if (!vs.length || vs.some(v => v.rec.prereg !== full)) throw refuse('no started record of this preregistration on origin');
  const last = vs[vs.length - 1].rec, now = filesNow(root);
  if (last.finished) {
    if (env.PROPS_V3_RECOVER !== '1') throw refuse('the fetch is finished already');
    for (const f of ['research/props_v3/cache/dk40_2023_lines.csv', 'research/props_v3/cache/dk40_2023_starts.csv']) if (now.sha256[f] !== last.sha256[f]) throw refuse(`the recovered ${path.basename(f)} is not the one the fetch recorded: nothing can be scored on it`);
    const rec = { ...last, recovered: [...(last.recovered || []), { at: new Date().toISOString(), sha256: now.sha256, counts: now.counts }] };
    return { decision: 'recovered', commit: publish(root, branch, rec, `props_v3: the 2022-23 lines recovered under preregistration ${full.slice(0, 12)}, byte for byte`) };
  }
  const rec = { ...last, finished: new Date().toISOString(), sha256: now.sha256, counts: now.counts };
  return { decision: 'finished', commit: publish(root, branch, rec, `props_v3: the 2022-23 fetch finished under preregistration ${full.slice(0, 12)}`) };
}
/* the finished record on origin, for the scorer */
function finishedRecord(root, sha) {
  const vs = recordVersions(root);
  if (!vs.length) throw refuse('origin holds no record of the 2022-23 fetch');
  if (vs.some(v => v.rec.prereg !== vs[0].rec.prereg)) throw refuse('origin holds records under two preregistrations');
  const fin = vs.filter(v => v.rec.finished);
  if (!fin.length) throw refuse('the 2022-23 fetch is not finished on origin');
  const full = (tryGit(root, ['rev-parse', '--verify', `${sha}^{commit}`]) || '').trim();
  if (fin[fin.length - 1].rec.prereg !== full) throw refuse('the finished record names another preregistration');
  return { commit: fin[fin.length - 1].commit, rec: fin[fin.length - 1].rec };
}
module.exports = { REC, FROM, TO, checkPrereg, recordVersions, decide, start, finish, finishedRecord, sha256 };
if (require.main === module) {
  const root = path.resolve(__dirname, '..', '..', '..'), cmd = process.argv[2], sha = process.env.PROPS_V3_PREREG, branch = process.env.PROPS_V3_BRANCH;
  try {
    const r = cmd === 'gate' ? decide(root, sha, branch) : cmd === 'start' ? start(root, sha, branch) : cmd === 'finish' ? finish(root, sha, branch) : null;
    if (!r) { console.error('usage: gate | start | finish'); process.exit(2); }
    console.log(r.decision);
  } catch (e) { console.error(e.message); process.exit(1); }
}
