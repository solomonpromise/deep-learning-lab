// Accessibility check of the built site with axe-core (WCAG 2.1 A and AA: contrast, names, labels, landmarks …),
// in light and dark, with the same sample learner as the screenshots.
//
//   make serve                                              # in one terminal
//   npm install --no-save playwright axe-core               # once
//   CHANNEL=chrome node scripts/dev/a11y.mjs                # the standard pages
//   CHANNEL=chrome node scripts/dev/a11y.mjs review.html    # just these
//
// Options (environment): BASE=http://localhost:8000/  WIDTH=1440  FRESH=1 (no learner data)  VERBOSE=1 (every element)
// Exits 1 when anything is found, so it can gate a commit.
import { chromium } from 'playwright';
import { createRequire } from 'node:module';
import fs from 'node:fs';
import { sampleLearner } from './sample-learner.mjs';

const BASE = process.env.BASE || 'http://localhost:8000/';
const AXE = fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'), 'utf8');
const standard = ['index.html', 'module-3/index.html', 'module-1/lesson-1-1.html', 'review.html', 'progress.html', 'concepts.html', 'glossary.html', 'guide.html', '404.html'];
const pages = process.argv.slice(2).length ? process.argv.slice(2) : standard;
const learner = process.env.FRESH ? null : sampleLearner();
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
let problems = 0;
for (const url of pages) {
  for (const scheme of ['light', 'dark']) {
    const ctx = await browser.newContext({ viewport: { width: +(process.env.WIDTH || 1440), height: 900 }, colorScheme: scheme, reducedMotion: 'reduce' });
    if (learner) await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded', '1'); } }, learner);
    const page = await ctx.newPage();
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    // show everything as a reader can: revealed blocks, and long code cells expanded (axe cannot see through the fade mask)
    await page.evaluate(() => {
      document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-in', 'no-anim'));
      document.querySelectorAll('.code-cell.is-long').forEach(c => c.classList.add('is-expanded'));
    });
    await page.waitForTimeout(400);
    await page.addScriptTag({ content: AXE });
    const res = await page.evaluate(() => window.axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
    const v = res.violations;
    problems += v.length;
    console.log(`${(url + ' [' + scheme + ']').padEnd(40)} ${v.length ? v.length + ' rule(s) broken' : 'clean'}`);
    for (const r of v) {
      console.log(`  ${r.id} (${r.impact}): ${r.help}, ${r.nodes.length} element(s)`);
      for (const n of r.nodes.slice(0, process.env.VERBOSE ? 99 : 3)) console.log(`    ${n.target.join(' ')}  ${(n.any[0] || n.all[0] || {}).message || ''}`.slice(0, 220));
    }
    await ctx.close();
  }
}
await browser.close();
process.exit(problems ? 1 : 0);
