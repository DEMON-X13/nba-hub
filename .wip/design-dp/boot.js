/* Boot a built NBA Hub page in jsdom on a folder of the job's files, at a fixed clock (as ../alt/probe.js does).
 *   const { boot } = require('./boot'); const w = await boot({ site, page, now });
 * site: a folder holding state.json, lines.json (and pickem.json, history.json); page: the built index.html to boot
 * (default: site/index.html); now: an ISO time. Every other request answers 404. Returns the window once S.slate is up
 * and lines.json is loaded (pbLinesLoad). */
'use strict';
const fs = require('fs'), path = require('path');
const REPO = path.resolve(__dirname, '../repo');
const { JSDOM, VirtualConsole } = require(path.join(REPO, 'tools/node_modules/jsdom'));
const PAGE_URL = 'https://demon-x13.github.io/nba-hub/';
async function boot({ site, page, now, files }) {
  const NOW = Date.parse(now);
  const html = fs.readFileSync(page || path.join(site, 'index.html'), 'utf8').replace(/<link[^>]*fonts[^>]*>/g, '');
  const vc = new VirtualConsole(); const errs = [];
  vc.on('jsdomError', e => { if (!/navigation|Could not parse CSS/i.test(String(e && e.message))) errs.push(String(e.message)); });
  const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: PAGE_URL, virtualConsole: vc,
    beforeParse(w) {
      w.confirm = () => true; w.alert = () => {}; w.scrollTo = () => {};
      if (!w.CSS) w.CSS = { escape: v => String(v).replace(/[^\w-]/g, c => '\\' + c) };
      const D0 = w.Date; class D extends D0 { constructor(...a) { if (a.length) super(...a); else super(NOW); } static now() { return NOW; } } w.Date = D;
      w.fetch = u => { const url = new URL(String(u), PAGE_URL), rel = url.pathname.replace(/^\/nba-hub\//, '');
        const f = files && files[rel] ? files[rel] : path.join(site, rel);
        if (/^(state|lines|pickem|history)\.json$/.test(rel) && fs.existsSync(f)) { const t = fs.readFileSync(f, 'utf8');
          return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t }); }
        return Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' }); };
    } });
  const w = dom.window, sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 600 && !w.eval("typeof S !== 'undefined' && !!S && !!S.slate"); i++) await sleep(50);
  await w.eval('pbLinesLoad()');
  w.__errs = errs;
  return w;
}
module.exports = { boot, REPO };
