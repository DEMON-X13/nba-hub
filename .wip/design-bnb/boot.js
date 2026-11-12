// Boot the built NBA Hub page in jsdom on a folder of data files, its clock fixed (as tools/test_suggest_speed.js and
// ../alt/probe.js do), and hand back the window. Prototype only: nothing here writes anything.
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '..', 'repo');
const { JSDOM, VirtualConsole } = require(path.join(REPO, 'tools', 'node_modules', 'jsdom'));
const PAGE_URL = 'https://demon-x13.github.io/nba-hub/';

async function boot({ page = path.join(REPO, 'index.html'), data = REPO, now }) {
  const NOW = Date.parse(now);
  const html = fs.readFileSync(page, 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', e => { if (!/navigation|Could not parse CSS/i.test(String(e && e.message))) errs.push(String(e.message)); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: PAGE_URL, virtualConsole: vc,
    beforeParse(w) {
      w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
      if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
      const D0 = w.Date; class D extends D0 { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } w.Date = D;
      w.fetch = u => { const url = new URL(String(u), PAGE_URL), rel = url.pathname.replace(/^\/nba-hub\//, '');
        const f = path.join(data, rel);
        if (/suggest_ledger/.test(rel) || !/^[\w./-]+$/.test(rel) || !fs.existsSync(f) || !fs.statSync(f).isFile()) return Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' });
        const t = fs.readFileSync(f, 'utf8'); return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t }); };
    } });
  const w = dom.window, sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 600 && !w.eval("typeof S !== 'undefined' && !!S && !!S.slate && typeof spPool === 'function'"); i++) await sleep(50);
  await w.eval('pbLinesLoad()');
  w.__errs = errs;
  return w;
}
module.exports = { boot, REPO };
