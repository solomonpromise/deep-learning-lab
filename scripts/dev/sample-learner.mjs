// The sample learner the dev scripts load into the browser: partway through Module 3, with a streak, reviews due,
// two module badges and some sections read. Used by screenshots.mjs and a11y.mjs.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');   // decoded, so paths with spaces work

export function sampleLearner() {
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
      progress[l.id] = { pct: 1, done: true, read: (l.secs || []).map(x => x[0]) };
      for (const q of ids) { const ok = rnd() > 0.12; rec.answers[q] = { n: 1, right: +ok, ok, first: ok, t: now }; rec.review[q] = { box: ok ? 3 : 1, due: rnd() > 0.8 ? ago(0) : ago(-5), t: now }; }
      for (const n of (l.labs || []).slice(0, 2)) rec.labs[`${l.id}|${n}`] = now;
      for (const id of (l.ex || [])) rec.explain[id] = { v: rnd() > 0.3 ? 'solid' : 'partly', t: now, by: 'self' };
    } else if (partial[l.id]) {
      // sections read in order, as far as the lesson's progress goes (so "pick up where you left off" has a section)
      progress[l.id] = { pct: partial[l.id], read: (l.secs || []).slice(0, Math.floor((l.secs || []).length * partial[l.id])).map(x => x[0]) };
      for (const q of (l.cp || []).slice(0, Math.floor((l.cp || []).length * partial[l.id] * 0.8))) { const ok = rnd() > 0.35; rec.answers[q] = { n: 1, right: +ok, ok, first: ok, t: now }; rec.review[q] = { box: ok ? 2 : 1, due: ago(0), t: now }; }
    }
  }
  for (let i = 0; i < 70; i++) if (i < 6 || rnd() > 0.45) rec.days[ago(i)] = 1 + Math.floor(rnd() * 9);
  rec.challenges['module-1'] = { best: 7, passed: true, t: now - 20 * 864e5 };
  rec.challenges['module-2'] = { best: 6, passed: true, t: now - 6 * 864e5 };
  return { 'dlp:rec': JSON.stringify(rec), 'dlp:progress': JSON.stringify(progress), 'dlp:last': JSON.stringify({ id: '3.3', url: 'module-3/lesson-3-3.html' }) };
}
