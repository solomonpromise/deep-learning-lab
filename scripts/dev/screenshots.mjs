// Screenshot the built site the way the redesign was checked: a sample learner partway through
// Module 3 (streak, reviews due, two badges), desktop and phone, light and dark.
//
//   make serve                                   # in one terminal: builds and serves http://localhost:8000
//   npm install --no-save playwright && npx playwright install chromium   # once
//   node scripts/dev/screenshots.mjs             # the standard set, into .shots/
//   node scripts/dev/screenshots.mjs index.html module-1/lesson-1-1.html   # just these pages
//
// Options (environment): BASE=http://localhost:8000/  OUT=.shots  FRESH=1 (no learner data)
//   CHANNEL=chrome uses the installed Google Chrome instead of Playwright's own Chromium (no browser download)
// Prints each page's scroll width (anything wider than the viewport is a sideways-scroll bug) and any JS errors.
import { chromium } from 'playwright';
import { sampleLearner } from './sample-learner.mjs';
import fs from 'node:fs';
import path from 'node:path';

const BASE = process.env.BASE || 'http://localhost:8000/';
const OUT = process.env.OUT || '.shots';
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- what to capture
const pages = process.argv.slice(2);
const standard = ['index.html', 'dashboard.html', 'curriculum.html', 'reference.html', 'module-3/index.html', 'module-1/lesson-1-1.html', 'review.html', 'progress.html', 'concepts.html', 'glossary.html', 'guide.html', 'about.html', '404.html'];
const views = [
  { tag: 'desktop', w: 1440, h: 900 },
  { tag: 'laptop', w: 1280, h: 800 },
  { tag: 'phone', w: 390, h: 844 },
  { tag: 'desktop-dark', w: 1440, h: 900, dark: true },
];

const learner = process.env.FRESH ? null : sampleLearner();
const browser = await chromium.launch(process.env.CHANNEL ? { channel: process.env.CHANNEL } : {});
const errors = [];
for (const url of (pages.length ? pages : standard)) {
  for (const v of views) {
    const ctx = await browser.newContext({ viewport: { width: v.w, height: v.h }, colorScheme: v.dark ? 'dark' : 'light', isMobile: v.w < 500, hasTouch: v.w < 500 });
    if (learner) await ctx.addInitScript(s => { if (!sessionStorage.getItem('seeded')) { for (const k in s) localStorage.setItem(k, s[k]); sessionStorage.setItem('seeded', '1'); } }, learner);
    const page = await ctx.newPage();
    page.on('pageerror', e => errors.push(`${url} [${v.tag}]: ${e.message}`));
    await page.goto(BASE + url, { waitUntil: 'networkidle' });
    await page.addStyleTag({ content: 'html{scroll-behavior:auto!important}' });      // smooth scroll spoils screenshots
    await page.evaluate(() => { document.querySelectorAll('.reveal').forEach(e => e.classList.add('is-in', 'no-anim')); window.DLP?.mountAll?.(); });
    await page.waitForTimeout(800);
    const name = `${url.replace(/\//g, '_').replace(/\.html$/, '')}-${v.tag}`;
    await page.screenshot({ path: path.join(OUT, name + '.png'), fullPage: true });
    const sw = await page.evaluate(() => document.documentElement.scrollWidth);
    console.log(`${name.padEnd(44)} scrollWidth ${sw}${sw > v.w ? '  <-- sideways scroll' : ''}`);
    await ctx.close();
  }
}
await browser.close();
console.log(errors.length ? 'JS errors:\n' + errors.join('\n') : 'No JS errors.');
