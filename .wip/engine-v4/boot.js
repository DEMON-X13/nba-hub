// boot a built page in jsdom on a site folder's json files at a clock; returns the window
const fs = require('fs'), path = require('path');
const { JSDOM, VirtualConsole } = require('/tmp/claude-0/-home-user-nfl-hub/6f17938d-1fb6-5f59-b7af-9eaa219afdc9/scratchpad/spfilter/eng/tools/node_modules/jsdom');
const PAGE_URL = 'https://demon-x13.github.io/nba-hub/';
async function boot({ page, site, now, repo }) {
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
        let f = null;
        if (/^(state|lines|pickem|history)\.json$/.test(rel) && site) f = path.join(site, rel);
        else if (repo && !/suggest_ledger/.test(rel) && /^[\w./-]+$/.test(rel)) f = path.join(repo, rel);
        if (f && fs.existsSync(f) && fs.statSync(f).isFile()) { const t = fs.readFileSync(f, 'utf8');
          return Promise.resolve({ ok: true, status: 200, json: async () => JSON.parse(t), text: async () => t }); }
        return Promise.resolve({ ok: false, status: 404, json: async () => { throw new Error('404'); }, text: async () => '' }); };
    } });
  const w = dom.window, sleep = ms => new Promise(r => setTimeout(r, ms));
  for (let i = 0; i < 600 && !w.eval("typeof S !== 'undefined' && !!S && !!S.slate"); i++) await sleep(50);
  await w.eval('pbLinesLoad()');
  w.__errs = errs;
  return w;
}
module.exports = { boot };
