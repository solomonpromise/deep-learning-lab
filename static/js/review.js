/* Daily review: spaced repetition over every checkpoint and quiz question the learner has answered.
   The schedule lives in the learning record (static/js/record.js): a miss comes back tomorrow, a first-time
   right answer in a week, and every right answer in review pushes the question further out
   (1, 3, 7, 16, 35 days, then 90). The questions themselves come from static/question-bank.js. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var page = $('[data-review-page]');
  if (!page) return;
  var R = window.DLP.record, ROOT = document.body.getAttribute('data-root') || '';
  var bank = {}, queue = [], at = 0, right = 0, mode = 'due', SESSION = 15;
  var card = $('[data-rv-card]'), summary = $('[data-rv-summary]'), done = $('[data-rv-done]');

  function load(cb) {
    if (window.DLP_BANK) return cb();
    var s = document.createElement('script');
    s.src = ROOT + 'static/question-bank.js';
    s.onload = cb; s.onerror = function () { summary.innerHTML = '<p>Could not load the questions. Check your connection and reload.</p>'; };
    document.head.appendChild(s);
  }
  function shuffle(a) { for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
  function fmtDay(key) {
    var p = key.split('-'), d = new Date(+p[0], +p[1] - 1, +p[2]), today = R.dayKey(), diff = Math.round((d - new Date(today.split('-')[0], today.split('-')[1] - 1, today.split('-')[2])) / 86400000);
    return diff <= 0 ? 'today' : diff === 1 ? 'tomorrow' : diff < 7 ? 'in ' + diff + ' days' : d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function scheduleInfo() {
    var rec = R.get(), ids = Object.keys(rec.review).filter(function (q) { return bank[q]; });
    var upcoming = ids.map(function (q) { return rec.review[q].due; }).filter(function (d) { return d > R.dayKey(); }).sort();
    return { total: ids.length, due: R.due().filter(function (q) { return bank[q]; }).length, next: upcoming[0] || null,
             nextCount: upcoming.filter(function (d) { return d === upcoming[0]; }).length,
             mastered: ids.filter(function (q) { return rec.review[q].box >= 5; }).length };
  }
  function paintSummary() {
    var s = scheduleInfo(), st = R.streak();
    summary.innerHTML =
      '<div class="rv-stats">' +
        '<div class="rv-stat"><strong>' + s.due + '</strong><span>due now</span></div>' +
        '<div class="rv-stat"><strong>' + s.total + '</strong><span>in your review deck</span></div>' +
        '<div class="rv-stat"><strong>' + s.mastered + '</strong><span>well remembered</span></div>' +
        '<div class="rv-stat"><strong>' + st.current + '</strong><span>day streak</span></div>' +
      '</div>' +
      (s.due ? '<button class="btn" data-rv-start><svg class="ic"><use href="#i-play"/></svg> Review ' + Math.min(SESSION, s.due) + ' question' + (Math.min(SESSION, s.due) === 1 ? '' : 's') + (s.due > SESSION ? ' (of ' + s.due + ')' : '') + '</button>'
        : s.total ? '<p class="rv-empty"><svg class="ic"><use href="#i-check"/></svg> Nothing is due. ' + (s.next ? 'Next: ' + s.nextCount + ' question' + (s.nextCount === 1 ? '' : 's') + ' ' + fmtDay(s.next) + '.' : '') + '</p>'
        : '<p class="rv-empty">Your deck is empty. Answer the checkpoints and quizzes in the lessons, and each question joins your review deck.</p>');
    var b = $('[data-rv-start]', summary);
    if (b) b.addEventListener('click', function () { start('due'); });
  }
  function start(kind, lesson) {
    mode = kind; at = 0; right = 0;
    if (kind === 'due') queue = R.due().filter(function (q) { return bank[q]; }).slice(0, SESSION);
    else queue = shuffle(Object.keys(bank).filter(function (q) { return bank[q].l === lesson; })).slice(0, 10);
    if (!queue.length) return;
    summary.hidden = true; done.hidden = true; card.hidden = false;
    show();
    card.scrollIntoView({ block: 'start', behavior: 'smooth' });
  }
  function show() {
    var q = bank[queue[at]];
    $('[data-rv-from]', card).textContent = 'Lesson ' + q.l + ' · ' + (q.s === 'quiz' ? 'end-of-lesson quiz' : 'checkpoint, §' + q.s + ' ' + q.st);
    $('[data-rv-count]', card).textContent = (at + 1) + ' / ' + queue.length;
    $('[data-rv-bar]', card).style.width = (100 * at / queue.length) + '%';
    $('[data-rv-q]', card).innerHTML = q.q;
    var opts = $('[data-rv-options]', card); opts.innerHTML = '';
    q.o.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'opt';
      b.innerHTML = '<span class="opt-letter">' + 'ABCDEFG'[i] + '</span><span>' + o + '</span>';
      b.addEventListener('click', function () { answer(i); });
      opts.appendChild(b);
    });
    $('[data-rv-why]', card).hidden = true; $('[data-rv-actions]', card).hidden = true;
    $('[data-rv-link]', card).href = ROOT + q.u;
    if (window.DLP.renderMath) window.DLP.renderMath(card);
    var first = $('.opt', opts); if (first) first.focus({ preventScroll: true });
  }
  function answer(i) {
    var q = bank[queue[at]], ok = i === q.a;
    Array.prototype.forEach.call($('[data-rv-options]', card).children, function (b, k) {
      b.disabled = true;
      if (k === q.a) b.classList.add('is-correct');
      if (k === i) b.classList.add('is-picked');
      if (k === i && !ok) b.classList.add('is-wrong');
    });
    if (ok) right++;
    if (mode === 'due') R.reviewAnswer(queue[at], ok); else R.answer(queue[at], ok, { kind: 'practice', lesson: q.l });
    var why = $('[data-rv-why]', card), r = R.reviewOf(queue[at]);
    why.innerHTML = (q.w || '') + (r ? '<p class="rv-next-due">' + (ok ? 'Next time: ' : 'It comes back ') + (r.box >= 6 ? 'in about three months.' : fmtDay(r.due) + '.') + '</p>' : '');
    why.hidden = false; $('[data-rv-actions]', card).hidden = false;
    $('span', $('[data-rv-next]', card)).textContent = at === queue.length - 1 ? 'Finish' : 'Next question';
    if (window.DLP.renderMath) window.DLP.renderMath(why);
    $('[data-rv-next]', card).focus({ preventScroll: true });
  }
  $('[data-rv-next]', card).addEventListener('click', function () {
    if (at < queue.length - 1) { at++; show(); return; }
    card.hidden = true; summary.hidden = false; paintSummary();
    done.hidden = false;
    done.innerHTML = '<h2>' + (right === queue.length ? 'All ' + right + ' right.' : right + ' of ' + queue.length + ' right.') + '</h2><p>' +
      (mode === 'due' ? 'The ones you missed come back tomorrow; the rest move further out.' : 'Practice answers count toward your record; missed ones join your review deck.') + '</p>';
    if (right === queue.length && queue.length >= 5) done.classList.add('rv-perfect'); else done.classList.remove('rv-perfect');
    done.scrollIntoView({ block: 'center', behavior: 'smooth' });
  });
  $('[data-rv-practice]').addEventListener('click', function () { start('practice', $('[data-rv-lesson]').value); });
  document.addEventListener('keydown', function (e) {
    if (card.hidden || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    var n = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()];
    var btns = $('[data-rv-options]', card).children;
    if (n != null && btns[n] && !btns[n].disabled) { e.preventDefault(); btns[n].click(); }
  });

  load(function () {
    (window.DLP_BANK || []).forEach(function (q) { bank[q.id] = q; });
    var last = R.get().answers, lessons = {};
    Object.keys(last).forEach(function (k) { if (bank[k]) lessons[bank[k].l] = Math.max(lessons[bank[k].l] || 0, last[k].t); });
    var recent = Object.keys(lessons).sort(function (a, b) { return lessons[b] - lessons[a]; })[0];
    if (recent) $('[data-rv-lesson]').value = recent;
    paintSummary();
    var practise = /^#practice=([\d.]+)$/.exec(location.hash);
    if (practise && $('[data-rv-lesson] option[value="' + practise[1] + '"]')) { $('[data-rv-lesson]').value = practise[1]; start('practice', practise[1]); }
    else if (location.hash === '#start' && R.due().length) start('due');
  });
})();
