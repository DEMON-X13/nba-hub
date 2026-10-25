/* Build the two NBA Hub pages from the one app file.
 *
 *   node tools/build.js
 *
 *   index.html   the public viewer
 *   admin.html   the same page with a Data tab: the published file at a glance, backup and
 *                        restore of this browser's own saved data (the Bet Build, the builder's settings,
 *                        your parlay)
 *
 * The app file may name parts, app/parts/<name>.html, each set in whole at its <!--part:name--> marker. The parlay card
 * (card) and the matchup bubble (glance) must neither fetch nor store: the build stops if either does.
 *
 * Both load state.json (written by publish.js). A visitor's bets, builder settings and parlay legs live in
 * the browser under one key shared by the two pages.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..');
/* parts: a section that lives in a file of its own, app/parts/<name>.html, is set in at its marker <!--part:name-->, so
   the page stays one file while its sections are written apart. A marker with no file, or a file with no marker, stops
   the build */
const PARTS = path.join(ROOT, 'app', 'parts');
let app = fs.readFileSync(path.join(ROOT, 'app', 'nba_hub.html'), 'utf8');
const files = fs.existsSync(PARTS) ? fs.readdirSync(PARTS).filter(f => /^[a-z0-9_-]+\.html$/.test(f)).map(f => f.slice(0, -5)) : [];
const marks = [...app.matchAll(/<!--part:([a-z0-9_-]+)-->/g)].map(m => m[1]);
for (const m of marks) if (!files.includes(m)) throw new Error(`build: <!--part:${m}--> has no app/parts/${m}.html`);
for (const f of files) if (!marks.includes(f)) throw new Error(`build: app/parts/${f}.html has no <!--part:${f}--> marker`);
/* the parlay card and the matchup bubble read what the page already has and keep nothing (README "The parlay card", "The
   matchup bubble"): a part of theirs that fetches, or touches a browser store, stops the build */
const KEEPS_NOTHING = { card: /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|document\.cookie/, glance: /\bfetch\s*\(|localStorage|sessionStorage|indexedDB|document\.cookie/ };
for (const m of marks) { const body = fs.readFileSync(path.join(PARTS, m + '.html'), 'utf8');
  if (KEEPS_NOTHING[m] && KEEPS_NOTHING[m].test(body)) throw new Error(`build: app/parts/${m}.html fetches or stores (${KEEPS_NOTHING[m].exec(body)[0]}), which it must not`);
  app = app.replace(`<!--part:${m}-->`, () => body); }
const write = (name, body) => { const f = path.join(ROOT, name); const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; if (before !== body) fs.writeFileSync(f, body); console.log(`${name}: ${(body.length / 1024).toFixed(0)} KB ${before !== body ? 'written' : 'unchanged'}`); };
write('index.html', app);
write('admin.html', app.replace('<script>\n\'use strict\';', '<script>window.ADMIN = true;</script>\n<script>\n\'use strict\';'));
