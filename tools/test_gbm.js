/* tools/gbm.js on small made-up sets whose answers are worked out by hand in the comments.
 *
 *   node tools/test_gbm.js     exits 1 on the first failure
 */
'use strict';
const assert = require('assert');
const G = require('./gbm');

let n = 0;
const near = (a, b, msg, eps = 1e-12) => { assert.ok(Math.abs(a - b) <= eps, `${msg}: ${a} is not ${b}`); n++; };
const eq = (a, b, msg) => { assert.deepStrictEqual(a, b, msg); n++; };
const col = v => v.map(x => [x]);

/* 1. squared error, one split. x 1..10, y 0 five times then 10 five times: the start is the mean, 5; every residual
   g = 5 - y is +5 on the left and -5 on the right, so the best cut is between 5 and 6 (t = 5.5) with gain
   25^2/5 + 25^2/5 - 0 = 250, and the leaves are -(25)/5 = -5 and +5 at learning rate 1: exactly 0 and 10 */
{
  const x = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10], y = [0, 0, 0, 0, 0, 10, 10, 10, 10, 10];
  const m = G.fit(col(x), y, { loss: 'squared', rounds: 1, lr: 1, depth: 1, minLeaf: 1 });
  near(m.base, 5, 'start at the mean');
  eq(m.trees[0][0].f, 0, 'splits on the one feature'); near(m.trees[0][0].t, 5.5, 'cut between 5 and 6');
  x.forEach((v, i) => near(G.predict(m, [v]), y[i], `fits ${v}`));
  /* at learning rate 0.1 each round closes a tenth of the gap: after r rounds 5 -/+ 5(1 - 0.9^r) */
  const m2 = G.fit(col(x), y, { loss: 'squared', rounds: 2, lr: 0.1, depth: 1, minLeaf: 1 });
  near(G.predict(m2, [1]), 4.05, 'two rounds, left: 5 - 0.5 - 0.45');
  near(G.predict(m2, [10]), 5.95, 'two rounds, right');
  const m25 = G.fit(col(x), y, { loss: 'squared', rounds: 25, lr: 0.1, depth: 1, minLeaf: 1 });
  near(G.predict(m25, [3]), 5 - 5 * (1 - Math.pow(0.9, 25)), 'twenty-five rounds', 1e-9);
  near(G.predict(m, [5.5]), 0, 'a value on the threshold goes left');
  near(G.predict(m, [5.6]), 10, 'just past it goes right');
}

/* 2. binomial deviance, one split. x 1..4, y 0 0 1 1: the start is log(0.5/0.5) = 0, so p = 0.5 everywhere, g = p - y
   is +0.5, +0.5, -0.5, -0.5 and h = 0.25. The cut is at 2.5; the left leaf is -(1)/(0.5) = -2, the right +2, so the
   chances are 1/(1+e^2) = 0.1192 and 0.8808 at learning rate 1 */
{
  const m = G.fit(col([1, 2, 3, 4]), [0, 0, 1, 1], { rounds: 1, lr: 1, depth: 1, minLeaf: 1 });
  near(m.base, 0, 'log-odds of a half');
  near(m.trees[0][0].t, 2.5, 'cut at 2.5');
  near(G.raw(m, [1]), -2, 'left leaf -2'); near(G.raw(m, [4]), 2, 'right leaf +2');
  near(G.predict(m, [2]), 1 / (1 + Math.exp(2)), 'chance on the left');
  /* the start is the log-odds of the base rate: 1 in 4 is log(1/3) */
  const m0 = G.fit(col([1, 2, 3, 4]), [0, 0, 0, 1], { rounds: 0 });
  near(m0.base, Math.log(1 / 3), 'start at the log-odds of a quarter');
  near(G.predict(m0, [9]), 0.25, 'no trees: the base rate');
  /* second round by hand at learning rate 0.1: after round one the scores are -0.2 and +0.2; p = 1/(1+e^0.2) on the
     left, g = p, h = p(1-p), and the left leaf adds -0.1 * (2p)/(2p(1-p)) = -0.1/(1-p) */
  const m2 = G.fit(col([1, 2, 3, 4]), [0, 0, 1, 1], { rounds: 2, lr: 0.1, depth: 1, minLeaf: 1 });
  const p = 1 / (1 + Math.exp(0.2));
  near(G.raw(m2, [1]), -0.2 - 0.1 / (1 - p), 'second round, by hand');
  near(G.raw(m2, [4]), 0.2 + 0.1 / (1 - p), 'second round mirrors');
}

/* 3. min leaf. y 6 then five 0s: the mean is 1 and g = 1 - y is -5, then +1 five times. Cutting off the 6 alone would
   be best but leaves one sample; with minLeaf 2 the candidates are t = 2.5 (gain (-4)^2/2 + 4^2/4 - 0 = 12), t = 3.5
   (3 + 3 = 6) and t = 4.5 (1 + 2 = 3), so the cut is 2.5 with leaves 2 and -1: predictions 3 and 0 */
{
  const m = G.fit(col([1, 2, 3, 4, 5, 6]), [6, 0, 0, 0, 0, 0], { loss: 'squared', rounds: 1, lr: 1, depth: 1, minLeaf: 2 });
  near(m.trees[0][0].t, 2.5, 'min leaf moves the cut');
  near(G.predict(m, [1]), 3, 'left of the cut'); near(G.predict(m, [6]), 0, 'right of the cut');
  /* the same by the hessian: with squared error every sample's hessian is 1, so minHess 3 asks for three a side and the
     cut is t = 3.5 */
  const mh = G.fit(col([1, 2, 3, 4, 5, 6]), [6, 0, 0, 0, 0, 0], { loss: 'squared', rounds: 1, lr: 1, depth: 1, minLeaf: 1, minHess: 3 });
  near(mh.trees[0][0].t, 3.5, 'min hessian moves the cut');
  /* a node with fewer than two leaves' worth of samples does not split at all */
  const m1 = G.fit(col([1, 2, 3]), [9, 0, 0], { loss: 'squared', rounds: 1, lr: 1, depth: 4, minLeaf: 2 });
  eq(m1.trees[0].length, 1, 'three samples, min leaf 2: one leaf');
  near(G.predict(m1, [1]), 3, 'that leaf is the mean');
}

/* 4. depth two. x0 splits the rows into y = 0 0 0 0 and y = 2 2 6 6, x1 splits the second half again. The start is 2,
   g = 2 - y = 2 2 2 2 0 0 -4 -4. At the root x0's cut gains 8^2/4 + 8^2/4 - 0 = 32 and x1's only 4 + 4 = 8, so x0 goes
   first; the left child is all 0 (every cut gains nothing, so it stays a leaf at -8/4 = -2, predicting 0); the right
   child cuts on x1 (gain 0 + 64/2 - 64/4 = 16) into 0 (predicting 2) and +4 (predicting 6). Exact fit at rate 1 */
{
  const X = [[0, 0], [0, 0], [0, 1], [0, 1], [1, 0], [1, 0], [1, 1], [1, 1]], y = [0, 0, 0, 0, 2, 2, 6, 6];
  const m = G.fit(X, y, { loss: 'squared', rounds: 1, lr: 1, depth: 2, minLeaf: 1 });
  const t = m.trees[0];
  eq(t[0].f, 0, 'root on x0');
  eq(t[t[0].l].v !== undefined, true, 'the pure side stays a leaf');
  eq(t[t[0].r].f, 1, 'the other side on x1');
  X.forEach((x, i) => near(G.predict(m, x), y[i], `depth two fits row ${i}`));
  eq(t.length, 5, 'root, two children, two grandchildren');
  /* at depth 1 the same rows stop at the root's cut: 0 and the mean of 2 2 6 6, 4 */
  const m1 = G.fit(X, y, { loss: 'squared', rounds: 1, lr: 1, depth: 1, minLeaf: 1 });
  near(G.predict(m1, [1, 1]), 4, 'depth one stops at the root');
}

/* 5. no gain, no split: exclusive-or. Each feature alone leaves both halves at the same mean, so every cut gains zero and
   the tree is one leaf at the mean, however deep it may grow (a greedy tree cannot see the pair) */
{
  const X = [[0, 0], [0, 1], [1, 0], [1, 1]], y = [0, 1, 1, 0];
  const m = G.fit(X, y, { loss: 'squared', rounds: 3, lr: 1, depth: 4, minLeaf: 1 });
  m.trees.forEach((t, i) => eq(t.length, 1, `round ${i}: one leaf`));
  X.forEach(x => near(G.predict(m, x), 0.5, 'the mean'));
}

/* 6. ties: two identical columns give the same gain, and the first one keeps the split; identical values are never cut
   between */
{
  const X = [[1, 1], [2, 2], [3, 3], [4, 4]], y = [0, 0, 5, 5];
  const m = G.fit(X, y, { loss: 'squared', rounds: 1, lr: 1, depth: 1, minLeaf: 1 });
  eq(m.trees[0][0].f, 0, 'the first of two equal features');
  const mt = G.fit(col([1, 1, 1, 2]), [0, 5, 5, 5], { loss: 'squared', rounds: 1, lr: 1, depth: 1, minLeaf: 1 });
  near(mt.trees[0][0].t, 1.5, 'the cut is between distinct values only');
  near(G.predict(mt, [1]), 10 / 3, 'the tied values stay together');
}

/* 7. deterministic: the same rows in the same order give the same trees, to the bit; and the model survives JSON */
{
  let seed = 7; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const X = [], y = [];
  for (let i = 0; i < 400; i++) { const a = rnd(), b = rnd(), c = Math.floor(rnd() * 4); X.push([a, b, c]); y.push(rnd() < 0.2 + 0.6 * a * (c > 1 ? 1 : 0.5) ? 1 : 0); }
  const m1 = G.fit(X, y), m2 = G.fit(X, y);
  eq(JSON.stringify(m1), JSON.stringify(m2), 'same rows, same trees');
  const back = JSON.parse(JSON.stringify(m1));
  X.slice(0, 50).forEach((x, i) => eq(G.predict(back, x), G.predict(m1, x), `same chance after JSON, row ${i}`));
  eq(m1.trees.length, 25, 'twenty-five rounds by default');
  m1.trees.forEach((t, i) => { const leaves = t.filter(nd => nd.v !== undefined).length; assert.ok(leaves <= 16, `tree ${i}: ${leaves} leaves`); n++; });
  /* every leaf of a depth-4 tree keeps at least 5 of the 400 rows: count them through the trees */
  for (const t of m1.trees.slice(0, 5)) {
    const count = {};
    for (const x of X) { let k = 0; while (t[k].v === undefined) k = x[t[k].f] <= t[k].t ? t[k].l : t[k].r; count[k] = (count[k] || 0) + 1; }
    Object.values(count).forEach(c => { assert.ok(c >= 5, 'a leaf under five rows'); n++; });
  }
  /* the fit lowers the deviance against the base rate */
  const ll = p => -y.reduce((s, v, i) => s + (v ? Math.log(p(X[i])) : Math.log(1 - p(X[i]))), 0) / y.length;
  const rate = y.reduce((s, v) => s + v, 0) / y.length;
  assert.ok(ll(x => G.predict(m1, x)) < ll(() => rate), 'the trees beat the base rate in sample'); n++;
}

/* 8. refusals: a missing value (impute first), a binomial target that is not 0 or 1 */
{
  assert.throws(() => G.fit([[1], [NaN]], [0, 1]), /finite/); n++;
  assert.throws(() => G.fit([[1], [2]], [0, 2]), /target/); n++;
  assert.throws(() => G.fit([[1]], [0], { loss: 'huber' }), /loss/); n++;
}

console.log(`test_gbm: ${n} checks passed`);
