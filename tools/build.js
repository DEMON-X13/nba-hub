/* Build the two NBA Hub pages from the one app file.
 *
 *   node nba-hub/tools/build.js
 *
 *   nba-hub/index.html   the public viewer
 *   nba-hub/admin.html   the same page with a Data tab: the published file at a glance, backup and
 *                        restore of this browser's picks and tickets
 *
 * Both load nba-hub/state.json (written by publish.js). A visitor's picks, parlay legs and tickets live in
 * the browser under one key shared by the two pages.
 */
'use strict';
const fs = require('fs');
const path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const app = fs.readFileSync(path.join(ROOT, 'nba-hub', 'app', 'nba_hub.html'), 'utf8');
const write = (name, body) => { const f = path.join(ROOT, 'nba-hub', name); const before = fs.existsSync(f) ? fs.readFileSync(f, 'utf8') : ''; if (before !== body) fs.writeFileSync(f, body); console.log(`${name}: ${(body.length / 1024).toFixed(0)} KB ${before !== body ? 'written' : 'unchanged'}`); };
write('index.html', app);
write('admin.html', app.replace('<script>\n\'use strict\';', '<script>window.ADMIN = true;</script>\n<script>\n\'use strict\';'));
