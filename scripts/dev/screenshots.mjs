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
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.env.BASE || 'http://localhost:8000/';
const OUT = process.env.OUT || '.shots';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // decoded, so paths with spaces work
fs.mkdirSync(OUT, { recursive: true });

// ---------------------------------------------------------------- the sample learner
function sampleLearner() {
  const src = fs.readFileSync(path.join(ROOT, 'dist', 'static', 'course-map.js'), 'utf8');
  const C = JSON.parse(src.slice(src.indexOf('=') + 1).trim().replace(/;$/, ''));
  const pad = n => String(n).padStart(2, '0');
  const key = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const ago = n => { const d = new Date(); d.setDate(d.getDate() - n); return key(d); };
  const now = Date.now();
  const rec = { v: 1, answers: {}, explain: {}, labs: {}, review: {}, days: {}, goal: { days: 4 }, challenges: {}, t: now };
  const progress = {};
  let seed = 7; const rnd = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
  const mastered = new Set(['1.1', '1.2', '1.3', '2.1', '2.2', '2.3', '2.4', '3.1']);
  const partial = { '3.2': 0.9, '3.3': 0.45 };
  for (const m of C.modules.filter(m => m.available)) for (const l of m.lessons) {
    const ids = (l.cp || []).concat(l.quiz || []);
    if (mastered.has(l.id)) {
      progress[l.id] = { pct: 1, done: true };
      for (const q of ids) { const ok = rnd() > 0.12; rec.answers[q] = { n: 1, right: +ok, ok, first: ok, t: now }; rec.review[q] = { box: ok ? 3 : 1, due: rnd() > 0.8 ? ago(0) : ago(-5), t: now }; }
      for (const n of (l.labs || []).slice(0, 2)) rec.labs[`${l.id}|${n}`] = now;
      for (const id of (l.ex || [])) rec.explain[id] = { v: rnd() > 0.3 ? 'solid' : 'partly', t: now, by: 'self' };
    } else if (partial[l.id]) {
      progress[l.id] = { pct: partial[l.id] };
      for (const q of (l.cp || []).slice(0, Math.floor((l.cp || []).length * partial[l.id] * 0.8))) { const ok = rnd() > 0.35; rec.answers[q] = { n: 1, right: +ok, ok, first: ok, t: now }; rec.review[q] = { box: ok ? 2 : 1, due: ago(0), t: now }; }
    }
  }
  for (let i = 0; i < 70; i++) if (i < 6 || rnd() > 0.45) rec.days[ago(i)] = 1 + Math.floor(rnd() * 9);
  rec.challenges['module-1'] = { best: 7, passed: true, t: now - 20 * 864e5 };
  rec.challenges['module-2'] = { best: 6, passed: true, t: now - 6 * 864e5 };
  return { 'dlp:rec': JSON.stringify(rec), 'dlp:progress': JSON.stringify(progress), 'dlp:last': JSON.stringify({ id: '3.3', url: 'module-3/lesson-3-3.html' }) };
}

// ---------------------------------------------------------------- what to capture
const pages = process.argv.slice(2);
const standard = ['index.html', 'module-3/index.html', 'module-1/lesson-1-1.html', 'review.html', 'progress.html', 'concepts.html', 'glossary.html', 'guide.html', '404.html'];
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
