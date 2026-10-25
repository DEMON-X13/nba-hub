/* Gradient-boosted trees in plain Node, for The Joker (tools/joker.js).
 *
 * The NFL hub's Joker is scikit-learn's HistGradientBoostingClassifier: binomial deviance, depth 4, 25 rounds,
 * learning rate 0.1, at least 5 games in a leaf. This is the same algorithm without the histograms: every split is
 * the exact best over the node's sorted values, not over 255 bins, so it is the same method and not bit for bit the
 * same trees. The job has no dependencies (Node 22 alone), which is why it is written out here.
 *
 * Each round fits one tree to the loss's gradient g and hessian h at the current scores:
 *   binomial deviance (y is 0 or 1):  p = 1 / (1 + e^-F),  g = p - y,  h = p (1 - p),  start at the log-odds of mean y
 *   squared error (y is a number):    g = F - y,  h = 1,  start at mean y
 * A node's split is the one with the largest gain G_L^2/H_L + G_R^2/H_R - G^2/H over every feature and every threshold
 * between two neighbouring values of it (the midpoint; a value at or below the threshold goes left), each side keeping
 * minLeaf samples and minHess of hessian; a node splits only when that gain is above zero (1e-12 here, so a split that
 * gains nothing but rounding is not made), and never below depth `depth` (the root is depth 0, so depth 4 is 16 leaves
 * at most: scikit-learn's max_leaf_nodes of 31 never binds). A leaf's value is -G/H times the learning rate. No L2
 * penalty, no subsampling, no early stopping, as the NFL's settings have it.
 *
 * Deterministic: samples are presorted by value with ties in index order, features are tried in column order and
 * thresholds upwards, and a later candidate replaces the best only when its gain is strictly larger, so the same rows
 * give the same trees and the same numbers on every machine. The inputs must be finite numbers: impute first.
 *
 *   fit(X, y, opts)    X an array of rows (arrays of numbers), y the targets; returns { loss, base, lr, trees, ... }
 *   raw(model, x)      the summed score of one row
 *   predict(model, x)  the chance (binomial) or the value (squared) of one row
 */
'use strict';

const DEFAULTS = { loss: 'binomial', rounds: 25, lr: 0.1, depth: 4, minLeaf: 5, minHess: 1e-3 };
const MIN_GAIN = 1e-12;
const sigmoid = z => 1 / (1 + Math.exp(-z));

function fit(X, y, opts = {}) {
  const o = { ...DEFAULTS, ...opts };
  if (o.loss !== 'binomial' && o.loss !== 'squared') throw new Error('gbm: loss must be binomial or squared');
  const n = y.length, F = n ? X[0].length : 0;
  if (!n) throw new Error('gbm: no rows to fit');
  const cols = [];
  for (let f = 0; f < F; f++) {
    const c = new Float64Array(n);
    for (let i = 0; i < n; i++) { const v = X[i][f]; if (!Number.isFinite(v)) throw new Error(`gbm: row ${i} column ${f} is not a finite number`); c[i] = v; }
    cols.push(c);
  }
  for (let i = 0; i < n; i++) if (!Number.isFinite(y[i]) || (o.loss === 'binomial' && y[i] !== 0 && y[i] !== 1)) throw new Error(`gbm: target ${i} is not usable`);
  const order = cols.map(c => {
    const idx = Array.from({ length: n }, (_, i) => i);
    idx.sort((a, b) => c[a] - c[b] || a - b);
    return Int32Array.from(idx);
  });
  let m = 0; for (let i = 0; i < n; i++) m += y[i]; m /= n;
  /* all one class: the log-odds would be infinite, so the start is held a hair inside it (scikit-learn would refuse) */
  const base = o.loss === 'binomial' ? Math.log(Math.min(Math.max(m, 1e-12), 1 - 1e-12) / (1 - Math.min(Math.max(m, 1e-12), 1 - 1e-12))) : m;
  const score = new Float64Array(n).fill(base), g = new Float64Array(n), h = new Float64Array(n);
  const trees = [];
  for (let r = 0; r < o.rounds; r++) {
    for (let i = 0; i < n; i++) {
      if (o.loss === 'binomial') { const p = sigmoid(score[i]); g[i] = p - y[i]; h[i] = p * (1 - p); }
      else { g[i] = score[i] - y[i]; h[i] = 1; }
    }
    const { tree, leafOf } = grow(cols, order, g, h, o);
    for (let i = 0; i < n; i++) score[i] += tree[leafOf[i]].v;
    trees.push(tree);
  }
  return { loss: o.loss, base, lr: o.lr, rounds: o.rounds, depth: o.depth, minLeaf: o.minLeaf, minHess: o.minHess, features: F, trees };
}

/* one tree, grown a level at a time: at each level every node that may split is scanned over each feature's sorted
   samples once, so a level costs one pass over the rows per feature */
function grow(cols, order, g, h, o) {
  const n = g.length, F = cols.length;
  const nodeOf = new Int32Array(n);                 // the node each sample sits in
  const nodes = [{ depth: 0, G: 0, H: 0, N: n }];
  for (let i = 0; i < n; i++) { nodes[0].G += g[i]; nodes[0].H += h[i]; }
  let level = [0];
  while (level.length) {
    const open = level.filter(k => nodes[k].depth < o.depth && nodes[k].N >= 2 * o.minLeaf && nodes[k].H >= 2 * o.minHess);
    if (!open.length) break;
    const slot = new Int32Array(nodes.length).fill(-1);
    open.forEach((k, j) => { slot[k] = j; });
    const J = open.length;
    const best = open.map(() => ({ gain: MIN_GAIN, f: -1, t: 0 }));
    const GL = new Float64Array(J), HL = new Float64Array(J), NL = new Int32Array(J), prev = new Float64Array(J);
    for (let f = 0; f < F; f++) {
      GL.fill(0); HL.fill(0); NL.fill(0);
      const c = cols[f], ord = order[f];
      for (let q = 0; q < n; q++) {
        const i = ord[q], j = slot[nodeOf[i]];
        if (j < 0) continue;
        const v = c[i];
        if (NL[j] > 0 && v !== prev[j]) {
          const nd = nodes[open[j]], NR = nd.N - NL[j], HR = nd.H - HL[j];
          if (NL[j] >= o.minLeaf && NR >= o.minLeaf && HL[j] >= o.minHess && HR >= o.minHess) {
            const GR = nd.G - GL[j];
            const gain = GL[j] * GL[j] / HL[j] + GR * GR / HR - nd.G * nd.G / nd.H;
            if (gain > best[j].gain) {
              let t = prev[j] + (v - prev[j]) / 2;
              if (!(t < v)) t = prev[j];                // two neighbouring doubles: the midpoint rounds onto the upper one
              best[j] = { gain, f, t };
            }
          }
        }
        GL[j] += g[i]; HL[j] += h[i]; NL[j]++; prev[j] = v;
      }
    }
    const next = [];
    for (let j = 0; j < J; j++) {
      const b = best[j];
      if (b.f < 0) continue;
      const k = open[j], nd = nodes[k];
      const L = nodes.length, R = L + 1;
      nodes.push({ depth: nd.depth + 1, G: 0, H: 0, N: 0 }, { depth: nd.depth + 1, G: 0, H: 0, N: 0 });
      nd.f = b.f; nd.t = b.t; nd.l = L; nd.r = R;
      next.push(L, R);
    }
    if (!next.length) break;
    /* move each sample of a node that split to its side, in index order so the sums are always added the same way */
    for (let i = 0; i < n; i++) {
      const nd = nodes[nodeOf[i]];
      if (nd.l === undefined) continue;
      const c = cols[nd.f][i] <= nd.t ? nd.l : nd.r;
      nodeOf[i] = c; nodes[c].G += g[i]; nodes[c].H += h[i]; nodes[c].N++;
    }
    level = next;
  }
  /* the tree as it is kept: an inner node {f, t, l, r}, a leaf {v}; node numbers are their places in the array */
  const tree = nodes.map(nd => nd.l !== undefined ? { f: nd.f, t: nd.t, l: nd.l, r: nd.r } : { v: nd.H > 0 ? -nd.G / nd.H * o.lr : 0 });
  return { tree, leafOf: nodeOf };
}

function raw(model, x) {
  let s = model.base;
  for (const tree of model.trees) {
    let k = 0;
    while (tree[k].v === undefined) k = x[tree[k].f] <= tree[k].t ? tree[k].l : tree[k].r;
    s += tree[k].v;
  }
  return s;
}
const predict = (model, x) => model.loss === 'binomial' ? sigmoid(raw(model, x)) : raw(model, x);

module.exports = { fit, raw, predict, sigmoid, DEFAULTS };
