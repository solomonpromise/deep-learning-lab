/* Mastery: what "done" means for a lesson, computed from the learning record rather than from scrolling.
   A lesson is MASTERED when at least 80% of it has been read, 80% of its checkpoint questions are answered
   with at least 70% right, and its quiz is fully answered with at least 70% right. PRACTISED means at least
   half the checkpoints are answered or the quiz is finished; STARTED means anything at all has happened.
   Module challenges (on each module page) award a badge at their pass mark; badges fill the certificate when it is switched on.
   Loaded on every page, after app.js. Exposes window.DLP.mastery. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ROOT = document.body.getAttribute('data-root') || '';
  var R = window.DLP.record, store = window.DLP.store;
  var STATUS_LABEL = { none: 'Not started', started: 'In progress', practised: 'Practised', mastered: 'Mastered' };

  function loadCourse(cb) {
    if (window.DLP_COURSE) return cb(window.DLP_COURSE);
    var s = document.createElement('script');
    s.src = ROOT + 'static/course-map.js';
    s.onload = function () { cb(window.DLP_COURSE); };
    document.head.appendChild(s);
  }
  function tally(ids) {
    var done = 0, right = 0;
    ids.forEach(function (q) { var a = R.answerOf(q); if (a) { done++; if (a.ok) right++; } });
    return { done: done, right: right, total: ids.length };
  }
  function lessonState(l) {
    var p = (store.get('progress', {})[l.id]) || {};
    var read = Math.min(1, p.pct || 0), cp = tally(l.cp || []), quiz = tally(l.quiz || []);
    var ex = (l.ex || []).filter(function (id) { var e = R.explainOf(id); return e; }).length;
    var labs = R.labsTried(l.id).filter(function (n) { return (l.labs || []).indexOf(n) >= 0; }).length;
    var cpAcc = cp.done ? cp.right / cp.done : 0, quizAcc = quiz.done ? quiz.right / quiz.done : 0;
    var status = 'none';
    if (read > 0.03 || cp.done || quiz.done || labs) status = 'started';
    if ((cp.total && cp.done >= cp.total * 0.5) || (quiz.total && quiz.done === quiz.total)) status = 'practised';
    if (read >= 0.8 && (!cp.total || (cp.done >= cp.total * 0.8 && cpAcc >= 0.7)) && (!quiz.total || (quiz.done === quiz.total && quizAcc >= 0.7))) status = 'mastered';
    // strength for the skills map: how much of the lesson you have shown you can do
    var strength = 0.2 * read + 0.4 * (cp.total ? cp.right / cp.total : read) + 0.3 * (quiz.total ? quiz.right / quiz.total : read) + 0.1 * ((l.labs || []).length ? labs / l.labs.length : read);
    return { id: l.id, title: l.title, skill: l.skill || l.title, url: l.url, read: read, cp: cp, quiz: quiz, explained: ex, nExplain: (l.ex || []).length,
             labs: { tried: labs, total: (l.labs || []).length }, status: status, strength: strength };
  }
  function moduleState(m) {
    var lessons = m.lessons.map(lessonState), ch = m.challenge ? R.challengeOf(m.challenge.id) : null;
    return { number: m.number, title: m.title, color: m.color, url: m.url, available: m.available, lessons: lessons,
             mastered: lessons.filter(function (l) { return l.status === 'mastered'; }).length,
             challenge: m.challenge ? { id: m.challenge.id, title: m.challenge.title, n: m.challenge.n, pass: m.challenge.pass_mark, best: ch ? ch.best : null, passed: !!(ch && ch.passed), t: ch ? ch.t : null } : null };
  }
  function all(cb) { loadCourse(function (c) { cb(c.modules.filter(function (m) { return m.available; }).map(moduleState)); }); }
  window.DLP.mastery = { all: all, label: STATUS_LABEL, loadCourse: loadCourse };

  /* ------------------------------------------------------------ sidebar: mastered lessons get a filled mark */
  function paintSidebar(mods) {
    mods.forEach(function (m) {
      m.lessons.forEach(function (l) {
        $$('[data-progress-dot="' + l.id + '"]').forEach(function (d) { d.classList.toggle('is-mastered', l.status === 'mastered'); d.title = STATUS_LABEL[l.status]; });
        $$('[data-lesson-status="' + l.id + '"]').forEach(function (d) { d.classList.toggle('is-mastered', l.status === 'mastered'); d.setAttribute('title', STATUS_LABEL[l.status]); });
      });
    });
  }

  /* ------------------------------------------------------------ lesson page: the mastery panel */
  var lessonEl = $('[data-lesson]'), panel = null;
  if (lessonEl) {
    panel = document.createElement('section');
    panel.className = 'mastery-panel'; panel.setAttribute('aria-live', 'polite');
    var end = $('.lesson-end');
    if (end) end.parentNode.insertBefore(panel, end);
  }
  function bar(label, v, text, icon) {
    return '<div class="mp-row"><span class="mp-label"><svg class="ic"><use href="#i-' + icon + '"/></svg> ' + label + '</span>' +
      '<span class="mp-bar"><span style="width:' + Math.round(v * 100) + '%"></span></span><span class="mp-val">' + text + '</span></div>';
  }
  var wasMastered = null;
  function paintPanel(mods) {
    if (!panel) return;
    var id = lessonEl.getAttribute('data-lesson'), l = null;
    mods.forEach(function (m) { m.lessons.forEach(function (x) { if (x.id === id) l = x; }); });
    if (!l) return;
    if (wasMastered === false && l.status === 'mastered' && window.DLP.confetti) window.DLP.confetti(panel);
    wasMastered = l.status === 'mastered';
    if (l.status === 'mastered') { var p = store.get('progress', {}); if (!(p[id] || {}).done) { p[id] = Object.assign({}, p[id], { done: true }); store.set('progress', p); } }
    var todo = [];
    if (l.read < 0.8) todo.push('read to the end (' + Math.round(l.read * 100) + '% so far)');
    if (l.cp.total && (l.cp.done < l.cp.total * 0.8 || (l.cp.done && l.cp.right / l.cp.done < 0.7))) todo.push('answer the checkpoints (' + l.cp.done + ' of ' + l.cp.total + ', ' + l.cp.right + ' right)');
    if (l.quiz.total && (l.quiz.done < l.quiz.total || l.quiz.right / l.quiz.total < 0.7)) todo.push('score at least 70% on the quiz (' + l.quiz.right + ' of ' + l.quiz.total + ' right)');
    panel.innerHTML = '<div class="mp-head"><span class="mp-status s-' + l.status + '">' + (l.status === 'mastered' ? '<svg class="ic"><use href="#i-award"/></svg> ' : '') + STATUS_LABEL[l.status] + '</span>' +
      '<strong>Your mastery of this lesson</strong></div>' +
      bar('Read', l.read, Math.round(l.read * 100) + '%', 'book') +
      (l.cp.total ? bar('Checkpoints', l.cp.done ? l.cp.right / l.cp.total : 0, l.cp.right + ' / ' + l.cp.total + ' right', 'flag') : '') +
      (l.quiz.total ? bar('Quiz', l.quiz.right / l.quiz.total, l.quiz.right + ' / ' + l.quiz.total + ' right', 'grad') : '') +
      (l.labs.total ? bar('Labs tried', l.labs.tried / l.labs.total, l.labs.tried + ' / ' + l.labs.total, 'flask') : '') +
      '<p class="mp-note">' + (l.status === 'mastered' ? 'Mastered. Its questions will come back in your <a href="' + ROOT + 'review.html">daily review</a> to keep it fresh.'
        : 'To master it: ' + todo.join('; ') + '.') + '</p>';
  }

  /* ------------------------------------------------------------ module page: the challenge */
  $$('[data-mchallenge]').forEach(function (box) {
    var id = box.getAttribute('data-mchallenge'), pass = parseFloat(box.getAttribute('data-pass')) || 0.75, mod = box.getAttribute('data-module');
    var qs = $$('[data-mc-q]', box), status = $('[data-mc-status]', box), foot = $('[data-mc-foot]', box), picks = {};
    function mark(q, pick) {
      var ans = q.getAttribute('data-answer');
      q.classList.add('is-answered');
      $$('.opt', q).forEach(function (x) {
        x.disabled = true;
        x.classList.toggle('is-correct', x.getAttribute('data-opt') === ans);
        x.classList.toggle('is-picked', x.getAttribute('data-opt') === String(pick));
        x.classList.toggle('is-wrong', x.getAttribute('data-opt') === String(pick) && String(pick) !== ans);
      });
      var why = $('.quiz-why', q); why.hidden = false; if (window.DLP.renderMath) window.DLP.renderMath(why);
    }
    function paint(fresh) {
      var n = Object.keys(picks).length, right = Object.keys(picks).filter(function (k) { return picks[k].ok; }).length, ok = right / qs.length >= pass;
      if (fresh && n === qs.length) R.challenge(id, right, true, { passed: ok });
      var best = R.challengeOf(id);
      status.innerHTML = best && best.passed ? '<span class="mc-passed"><svg class="ic"><use href="#i-award"/></svg> Badge earned</span>' : n ? right + ' / ' + qs.length + ' right' : '';
      if (n < qs.length) { foot.hidden = true; return; }
      if (fresh && ok && window.DLP.confetti) window.DLP.confetti(status);
      foot.hidden = false;
      foot.className = 'mc-foot ' + (ok ? 'good' : 'warn');
      foot.innerHTML = (ok ? '<strong>Passed: ' + right + ' of ' + qs.length + '.</strong> The Module ' + mod + ' badge is yours. ' + (document.body.hasAttribute('data-cert') ? '<a href="' + ROOT + 'progress.html#certificate">See your certificate</a>.' : '<a href="' + ROOT + 'progress.html">See your badges</a>.')
        : '<strong>' + right + ' of ' + qs.length + ' right; the pass mark is ' + Math.ceil(pass * qs.length) + '.</strong> Read the explanations, revisit the lessons they point to, and try again.') +
        ' <button class="chip-btn" data-mc-retry><svg class="ic"><use href="#i-refresh"/></svg> Try again</button>';
      $('[data-mc-retry]', foot).addEventListener('click', function () {
        picks = {};
        qs.forEach(function (q) { q.classList.remove('is-answered'); $$('.opt', q).forEach(function (x) { x.disabled = false; x.classList.remove('is-correct', 'is-picked', 'is-wrong'); }); $('.quiz-why', q).hidden = true; });
        paint(false); qs[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
      });
    }
    qs.forEach(function (q) {
      var qid = q.getAttribute('data-mc-q'), prev = R.answerOf(qid);
      if (prev && prev.pick != null && R.challengeOf(id)) { picks[qid] = { ok: prev.ok }; mark(q, prev.pick); }
      $$('.opt', q).forEach(function (o) {
        o.addEventListener('click', function () {
          if (q.classList.contains('is-answered')) return;
          var pick = o.getAttribute('data-opt'), ok = pick === q.getAttribute('data-answer');
          mark(q, pick); picks[qid] = { ok: ok };
          R.answer(qid, ok, { kind: 'challenge', pick: pick });
          paint(Object.keys(picks).length === qs.length);
        });
      });
    });
    paint(false);
  });

  function refresh() { all(function (mods) { paintSidebar(mods); paintPanel(mods); document.dispatchEvent(new CustomEvent('dlp:mastery', { detail: mods })); }); }
  refresh();
  var t; document.addEventListener('dlp:record', function () { clearTimeout(t); t = setTimeout(refresh, 150); });
  window.addEventListener('scroll', function () { clearTimeout(t); t = setTimeout(refresh, 800); }, { passive: true });
})();
