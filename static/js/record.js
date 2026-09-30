/* Deep Learning Lab — the learner's record.
   Everything a learner answers, tries and reviews, kept in this browser under one key so that
   sync can carry it to another device. Pages write through DLP.record; anything that wants to
   react (review queue, streaks, mastery, sync, anonymous stats) listens for the 'dlp:record' event.
   Loaded before app.js on every page. */
(function () {
  'use strict';
  var KEY = 'dlp:rec';
  var DAY = 86400000;
  // Leitner boxes: a missed question comes back tomorrow; each correct review pushes it further out.
  var INTERVALS = [0, 1, 3, 7, 16, 35];

  function load() {
    try { var v = JSON.parse(localStorage.getItem(KEY) || 'null'); if (v && v.v === 1) return v; } catch (e) {}
    return blank();
  }
  function blank() { return { v: 1, answers: {}, explain: {}, labs: {}, review: {}, days: {}, goal: { days: 3 }, challenges: {}, t: 0 }; }
  var rec = load();
  function save() {
    rec.t = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(rec)); } catch (e) { /* private mode */ }
  }
  function emit(detail) { document.dispatchEvent(new CustomEvent('dlp:record', { detail: detail })); }

  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function dayKey(d) { d = d || new Date(); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function addDays(key, n) { var p = key.split('-'); return dayKey(new Date(+p[0], +p[1] - 1, +p[2] + n)); }
  function touch() { var k = dayKey(); rec.days[k] = (rec.days[k] || 0) + 1; }

  function schedule(qid, ok, firstTry) {
    var r = rec.review[qid], box;
    if (!ok) box = 1;
    else if (r) box = r.box + 1;
    else box = firstTry ? 3 : 2;            // right first time: check it again in a week
    if (box > 5) { rec.review[qid] = { box: 6, due: addDays(dayKey(), 90), t: Date.now() }; return; }
    rec.review[qid] = { box: box, due: addDays(dayKey(), INTERVALS[box]), t: Date.now() };
  }

  var R = {
    dayKey: dayKey,
    /* a question answered anywhere: a checkpoint, the lesson quiz, a module challenge or the review page.
       qid: "c:1.1:3:1" (checkpoint), "q:1.1:2" (quiz), "m:2:4" (module challenge) */
    answer: function (qid, ok, info) {
      info = info || {};
      var a = rec.answers[qid], first = !a;
      a = a || { n: 0, right: 0 };
      a.n += 1; if (ok) a.right += 1;
      a.ok = !!ok; a.t = Date.now();
      if (info.pick != null) a.pick = info.pick;
      if (first) a.first = !!ok;
      rec.answers[qid] = a;
      if (info.kind !== 'challenge' && info.kind !== 'exercise') schedule(qid, ok, first);
      touch(); save();
      emit({ type: 'answer', qid: qid, ok: !!ok, first: first, kind: info.kind || '', lesson: info.lesson || '' });
    },
    answerOf: function (qid) { return rec.answers[qid] || null; },
    // "explain it back": verdict is 'solid' | 'partly' | 'notyet', from the tutor or the learner's own rating
    explain: function (id, verdict, info) {
      rec.explain[id] = { v: verdict, t: Date.now(), by: (info && info.by) || 'self' };
      touch(); save();
      emit({ type: 'explain', id: id, verdict: verdict, lesson: (info && info.lesson) || '' });
    },
    explainOf: function (id) { return rec.explain[id] || null; },
    // a lab the learner actually used (first interaction), per lesson
    lab: function (lesson, name) {
      var k = lesson + '|' + name;
      if (rec.labs[k]) return;
      rec.labs[k] = Date.now(); touch(); save();
      emit({ type: 'lab', lesson: lesson, name: name });
    },
    labsTried: function (lesson) {
      return Object.keys(rec.labs).filter(function (k) { return k.split('|')[0] === lesson; }).map(function (k) { return k.split('|')[1]; });
    },
    // a section read counts as activity for the streak
    activity: function () { touch(); save(); emit({ type: 'activity' }); },
    challenge: function (id, value, higherIsBetter, info) {
      var c = rec.challenges[id] || {}, better = c.best == null || (higherIsBetter ? value > c.best : value < c.best);
      if (info && info.passed) c.passed = true;
      if (better) c.best = value;
      c.t = Date.now(); rec.challenges[id] = c; touch(); save();
      emit({ type: 'challenge', id: id, value: value, best: c.best, improved: better, passed: !!c.passed });
      return c;
    },
    challengeOf: function (id) { return rec.challenges[id] || null; },

    /* ---------------------------------------------------------- review queue */
    due: function (limit) {
      var today = dayKey();
      var ids = Object.keys(rec.review).filter(function (q) { return rec.review[q].due <= today; });
      ids.sort(function (a, b) { var A = rec.review[a], B = rec.review[b]; return A.box - B.box || (A.due < B.due ? -1 : 1); });
      return limit ? ids.slice(0, limit) : ids;
    },
    reviewOf: function (qid) { return rec.review[qid] || null; },
    reviewAnswer: function (qid, ok) { R.answer(qid, ok, { kind: 'review' }); },

    /* ---------------------------------------------------------- streaks and goals */
    streak: function () {
      var today = dayKey(), cur = 0, k = rec.days[today] ? today : addDays(today, -1);
      while (rec.days[k]) { cur++; k = addDays(k, -1); }
      var keys = Object.keys(rec.days).sort(), best = 0, run = 0, prev = null;
      keys.forEach(function (d) { run = prev && addDays(prev, 1) === d ? run + 1 : 1; best = Math.max(best, run); prev = d; });
      return { current: cur, best: Math.max(best, cur), today: !!rec.days[today] };
    },
    week: function () {
      var now = new Date(), dow = (now.getDay() + 6) % 7, monday = dayKey(new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow));
      var days = [], active = 0;
      for (var i = 0; i < 7; i++) { var k = addDays(monday, i); days.push({ day: k, n: rec.days[k] || 0, future: k > dayKey() }); if (rec.days[k]) active++; }
      return { days: days, active: active, goal: (rec.goal && rec.goal.days) || 3 };
    },
    setGoal: function (n) { rec.goal = { days: n }; save(); emit({ type: 'goal', days: n }); },
    days: function () { return rec.days; },

    /* ---------------------------------------------------------- whole record (sync) */
    get: function () { return rec; },
    replace: function (next) { if (next && next.v === 1) { rec = next; save(); emit({ type: 'replace' }); } },
    blank: blank
  };
  window.DLP = window.DLP || {};
  window.DLP.record = R;
  window.addEventListener('storage', function (e) { if (e.key === KEY) { rec = load(); emit({ type: 'replace' }); } });
})();
