/* Daily review: spaced repetition over every checkpoint and quiz question the learner has answered.
   The schedule lives in the learning record (static/js/record.js): a miss comes back tomorrow, a first-time
   right answer in a week, and every right answer in review pushes the question further out
   (1, 3, 7, 16, 35 days, then 90). The questions themselves come from static/question-bank.js.
   The page opens straight into a round of up to 15 due questions. Keys: A–D or 1–4 answer, Enter goes on,
   Esc stops the round (what was answered is already recorded). Between rounds it says how the round went
   and what is next. "Practise a lesson" runs 10 random questions from one lesson the same way. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var page = $('[data-review-page]');
  if (!page) return;
  var R = window.DLP.record, store = window.DLP.store, ROOT = document.body.getAttribute('data-root') || '';
  var ROUND = 15, PRACTICE = 10, LETTERS = 'ABCDEFG';
  var bank = {}, run = null, rounds = 0;
  var round = $('[data-rv-round]'), card = $('[data-rv-card]'), opts = $('[data-rv-options]'), state = $('[data-rv-state]');
  var status = document.createElement('p');
  status.className = 'sr-only'; status.setAttribute('aria-live', 'polite'); card.appendChild(status);

  function load(cb) {
    if (window.DLP_BANK) return cb();
    var s = document.createElement('script');
    s.src = ROOT + 'static/question-bank.js';
    s.onload = cb;
    s.onerror = function () { showState('<p class="rv-sum">Could not load the questions. Check your connection and reload the page.</p>'); };
    document.head.appendChild(s);
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function plain(html) { var d = document.createElement('div'); d.innerHTML = html; return (d.textContent || '').trim(); }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function shuffle(a) { for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(Math.random() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
  function reduced() { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; }

  /* ---------------------------------------------------------- dates */
  function keyDate(key) { var p = key.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function daysFromToday(key) { return Math.round((keyDate(key) - keyDate(R.dayKey())) / 86400000); }
  function fmtDay(key) {
    var d = daysFromToday(key);
    return d <= 0 ? 'today' : d === 1 ? 'tomorrow' : d < 7 ? keyDate(key).toLocaleDateString(undefined, { weekday: 'long' })
      : keyDate(key).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
  }
  function ago(t) {
    var d = Math.round((keyDate(R.dayKey()) - keyDate(R.dayKey(new Date(t)))) / 86400000);
    return d <= 0 ? 'today' : d === 1 ? 'yesterday' : d < 14 ? d + ' days ago' : d < 60 ? Math.round(d / 7) + ' weeks ago' : Math.round(d / 30) + ' months ago';
  }
  function backIn(r) {
    var d = daysFromToday(r.due);
    return d <= 1 ? 'tomorrow' : d < 25 ? 'in ' + d + ' days' : d < 60 ? 'in about a month' : 'in about three months';
  }

  /* ---------------------------------------------------------- the queue */
  function dueIds() { return R.due().filter(function (q) { return bank[q]; }); }
  function byLesson(a, b) {
    var x = a.split('.').map(Number), y = b.split('.').map(Number);
    return x[0] - y[0] || x[1] - y[1];
  }
  function deck() {
    var rec = R.get(), ids = Object.keys(rec.review).filter(function (q) { return bank[q]; }), today = R.dayKey();
    var later = ids.map(function (q) { return rec.review[q].due; }).filter(function (d) { return d > today; }).sort();
    return { total: ids.length, strong: ids.filter(function (q) { return rec.review[q].box >= 5; }).length,
             next: later[0] || null, nextCount: later.filter(function (d) { return d === later[0]; }).length, later: later };
  }

  /* ---------------------------------------------------------- side panel: what is due, and by lesson */
  function paintSide() {
    var due = dueIds(), n = due.length, info = deck();
    $('[data-rv-due]').textContent = n;
    $('[data-rv-due-note]').innerHTML = n > ROUND ? 'due today,<br>in rounds of ' + ROUND : n ? 'due today,<br>one round' :
      info.next ? 'due today.<br>Next: ' + info.nextCount + ' ' + fmtDay(info.next) : 'due today';
    var list = $('[data-rv-list]'), rows = $('[data-rv-rows]'), html = '';
    if (n) {
      var per = {}, titles = {};
      due.forEach(function (q) { var l = bank[q].l; per[l] = (per[l] || 0) + 1; titles[l] = bank[q].lt; });
      html = Object.keys(per).sort(byLesson).map(function (l) {
        return '<li><span class="rv-l">' + l + '</span><span class="rv-t" title="' + esc(titles[l]) + '">' + esc(titles[l]) + '</span><span class="rv-n">' + per[l] + '</span></li>';
      }).join('');
      $('[data-rv-list-k]').textContent = 'Due by lesson';
    } else if (info.later.length) {
      var days = {};
      info.later.forEach(function (d) { days[d] = (days[d] || 0) + 1; });
      html = Object.keys(days).sort().slice(0, 6).map(function (d) {
        var t = fmtDay(d);
        return '<li class="is-day"><span class="rv-t">' + t.charAt(0).toUpperCase() + t.slice(1) + '</span><span class="rv-n">' + days[d] + '</span></li>';
      }).join('');
      $('[data-rv-list-k]').textContent = 'Coming up';
    }
    rows.innerHTML = html;
    list.hidden = !html;
  }

  /* ---------------------------------------------------------- a round */
  function start(mode, lesson, fromClick) {
    var ids = mode === 'due' ? dueIds().slice(0, ROUND)
      : shuffle(Object.keys(bank).filter(function (q) { return bank[q].l === lesson; })).slice(0, PRACTICE);
    if (!ids.length) return;
    if (mode === 'due') rounds++;
    run = { mode: mode, lesson: lesson, ids: ids, res: [], at: 0, answered: false, round: rounds };
    state.hidden = true; round.hidden = false;
    document.body.classList.add('rv-running');
    show();
    if (fromClick) { window.scrollTo(0, 0); $('[data-rv-q]').focus({ preventScroll: true }); }
  }
  function paintHead() {
    var n = run.ids.length, right = 0, missed = 0, skipped = 0;
    run.res.forEach(function (r) { if (r === 'ok') right++; else if (r === 'bad') missed++; else if (r === 'skip') skipped++; });
    $('[data-rv-where]').textContent = (run.mode === 'due' ? 'Round ' + run.round : 'Practice · Lesson ' + run.lesson) + ' · question ' + (run.at + 1) + ' of ' + n;
    $('[data-rv-tally]').textContent = right + missed + skipped ? [right + ' right', missed + ' missed'].concat(skipped ? [skipped + ' skipped'] : []).join(' · ') : '';
    $('[data-rv-frac]').textContent = (run.at + 1) + '/' + n;
    paintSegs($('[data-rv-segs]'), run);
  }
  function paintSegs(el, r) {
    el.style.setProperty('--n', r.ids.length);
    el.innerHTML = r.ids.map(function (q, i) {
      var s = r.res[i];
      return '<i class="' + (s === 'ok' ? 'is-ok' : s === 'bad' ? 'is-bad' : s === 'skip' ? 'is-skip' : i === r.at && !r.done ? 'is-now' : '') + '"></i>';
    }).join('');
  }
  function show() {
    var id = run.ids[run.at], q = bank[id], seen = R.answerOf(id), quiz = q.s === 'quiz';
    run.answered = false;
    $('[data-rv-from]').textContent = 'From Lesson ' + q.l + ' · ' + (quiz ? 'end-of-lesson quiz' : '§' + q.s + ' checkpoint');
    $('[data-rv-seen]').textContent = seen ? 'last seen ' + ago(seen.t) : '';
    $('[data-rv-q]').innerHTML = q.q;
    opts.innerHTML = '';
    q.o.forEach(function (o, i) {
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'opt'; b.setAttribute('data-opt', i);
      b.innerHTML = '<span class="opt-letter">' + LETTERS[i] + '</span><span class="opt-t">' + o + '</span><span class="opt-mark"></span>';
      b.addEventListener('click', function () { answer(i); });
      opts.appendChild(b);
    });
    var link = $('[data-rv-link]');
    link.href = ROOT + (q.r || q.u);
    $('[data-rv-link-long]').textContent = quiz ? 'Reread the wrap-up of Lesson ' + q.l : 'Reread §' + q.s + ' of Lesson ' + q.l;
    $('[data-rv-link-short]').textContent = quiz ? 'Reread the wrap-up' : 'Reread §' + q.s;
    $('[data-rv-hint]').hidden = false;
    $('[data-rv-why]').hidden = true;
    $('[data-rv-when]').hidden = true;
    $('[data-rv-skip]').hidden = false;
    $('[data-rv-next]').hidden = true;
    status.textContent = '';
    paintHead();
    if (window.DLP.renderMath) window.DLP.renderMath(card);
  }
  function answer(i) {
    if (!run || run.answered) return;
    var id = run.ids[run.at], q = bank[id], ok = i === q.a;
    run.answered = true;
    run.res[run.at] = ok ? 'ok' : 'bad';
    $$('.opt', opts).forEach(function (b, k) {
      b.disabled = true;
      if (k === q.a) { b.classList.add('is-correct'); $('.opt-mark', b).innerHTML = '<svg class="ic"><use href="#i-check"/></svg> ' + (k === i ? 'Your answer' : 'Correct'); }
      else if (k === i) { b.classList.add('is-wrong'); $('.opt-mark', b).innerHTML = '<svg class="ic"><use href="#i-x"/></svg> Your answer'; }
      else b.classList.add('is-dim');
      if (k === i) b.classList.add('is-picked');
    });
    if (run.mode === 'due') R.reviewAnswer(id, ok); else R.answer(id, ok, { kind: 'practice', lesson: q.l, pick: i });

    var why = $('[data-rv-why]'), when = $('[data-rv-when]'), r = R.reviewOf(id), last = run.at === run.ids.length - 1;
    why.innerHTML = q.w ? (/^\s*<p>/.test(q.w) ? q.w.replace(/<p>/, '<p><b>Why:</b> ') : '<p><b>Why:</b></p>' + q.w) : '';
    why.hidden = !q.w;
    var back = r ? backIn(r) : '', whenText = r ? (ok ? 'Right: back ' + back : 'Missed, so it comes back ' + back) : '';
    $('span', when).textContent = whenText;
    when.hidden = !r;
    $('[data-rv-hint]').hidden = true;
    $('[data-rv-skip]').hidden = true;
    var next = $('[data-rv-next]');
    $('span', next).textContent = last ? (run.mode === 'due' ? 'Finish the round' : 'Finish') : 'Next question';
    next.hidden = false;
    status.textContent = ok ? 'Right.' + (r ? ' It comes back ' + back + '.' : '')
      : 'Not quite. The answer is ' + LETTERS[q.a] + ': ' + plain(q.o[q.a]) + '.' + (r ? ' It comes back ' + back + '.' : '');
    paintHead(); paintSide();
    if (window.DLP.renderMath) window.DLP.renderMath(why);
    next.focus({ preventScroll: true });
    // bring the explanation into view: on a phone it sits below the options, above the fixed action bar
    var phone = window.matchMedia('(max-width: 720px)').matches, target = phone ? (when.hidden ? why : when) : $('.rv-acts', card);
    if (target.getBoundingClientRect().bottom > window.innerHeight - (phone ? 90 : 0)) target.scrollIntoView({ block: 'nearest', behavior: reduced() ? 'auto' : 'smooth' });
  }
  function next() {
    if (!run || (!run.answered && run.res[run.at] !== 'skip')) return;
    if (run.at < run.ids.length - 1) {
      run.at++;
      show();
      window.scrollTo(0, 0);
      $('[data-rv-q]').focus({ preventScroll: true });
    } else finish(false);
  }
  function skip() { if (!run || run.answered) return; run.res[run.at] = 'skip'; next(); }
  function stop() { if (run) finish(true); }

  /* ---------------------------------------------------------- between rounds */
  function showState(html, kind) {
    state.innerHTML = html; state.hidden = false; round.hidden = true;
    state.setAttribute('data-kind', kind || '');
    document.body.classList.remove('rv-running');
    if (window.DLP.renderMath) window.DLP.renderMath(state);
  }
  state.addEventListener('click', function (e) {
    if (e.target.closest('[data-rv-again]')) start('due', null, true);
    else if (e.target.closest('[data-rv-to-practice]')) {
      e.preventDefault();
      $('[data-rv-practice-box]').scrollIntoView({ block: 'start', behavior: reduced() ? 'auto' : 'smooth' });
      $('[data-rv-lesson]').focus({ preventScroll: true });
    }
  });
  function deckLine(info) {
    return info.total ? '<p class="rv-deck">' + plural(info.total, 'question') + ' in your deck' + (info.strong ? ' · ' + info.strong + ' well remembered' : '') + '</p>' : '';
  }
  // the lesson you were in, or the first lesson if you have not opened one yet
  function continueLink() {
    var last = store && store.get('last'), first = $('[data-rv-lesson] option'), q = first && Object.keys(bank).map(function (k) { return bank[k]; })
      .filter(function (b) { return b.l === first.value; })[0];
    if (last && last.url) return '<a class="btn" href="' + ROOT + esc(last.url) + '"><svg class="ic"><use href="#i-book"/></svg> Continue Lesson ' + esc(last.id) + '</a>';
    if (q) return '<a class="btn" href="' + ROOT + esc(q.u.split('#')[0]) + '"><svg class="ic"><use href="#i-play"/></svg> Start Lesson ' + esc(q.l) + '</a>';
    return '<a class="btn" href="' + ROOT + 'index.html"><svg class="ic"><use href="#i-layers"/></svg> Back to the course</a>';
  }
  function finish(stopped) {
    var r = run, right = 0, missed = [], skipped = 0;
    r.res.forEach(function (s, i) { if (s === 'ok') right++; else if (s === 'bad') missed.push(r.ids[i]); else if (s === 'skip') skipped++; });
    var answered = right + missed.length, due = dueIds().length, info = deck(), early = stopped && r.res.length < r.ids.length;
    r.done = true; run = null;
    var label = (r.mode === 'due' ? 'Round ' + r.round : 'Practice · Lesson ' + r.lesson) + (early ? ' stopped' : ' done');

    var head = answered ? (right === answered ? 'All ' + answered + ' right' : right + ' of ' + answered + ' right') : 'Stopped before any answers';
    var sum = [];
    if (answered && r.mode === 'due') {
      if (missed.length) sum.push((missed.length === 1 ? 'The one you missed comes' : 'The ' + missed.length + ' you missed come') + ' back tomorrow.');
      if (right) sum.push(missed.length ? (right === 1 ? 'The one you got right moves' : 'The ' + right + ' you got right move') + ' further out.'
        : (right === 1 ? 'It moves' : 'They all move') + ' further out.');
    } else if (answered) sum.push('Every answer joins your review deck. ' + (missed.length ? 'The ones you missed come back tomorrow.' : 'They come back in a week.'));
    if (r.mode === 'due' && (skipped || early)) {
      var left = r.ids.length - answered;
      sum.push(plural(left, 'question') + ' from this round ' + (left === 1 ? 'is' : 'are') + ' still due.');
    }

    var list = missed.length ? '<span class="mono-label rv-sub">Worth rereading</span><ul class="rv-missed">' + missed.map(function (id) {
      var q = bank[id];
      return '<li><span class="rv-l">' + q.l + (q.s === 'quiz' ? ' · quiz' : ' · §' + q.s) + '</span><span class="rv-mq">' + esc(plain(q.q)) + '</span>' +
        '<a href="' + ROOT + esc(q.r || q.u) + '">Reread</a></li>';
    }).join('') + '</ul>' : '';

    showState('<span class="mono-label rv-k">' + label + '</span>' +
      '<div class="rv-segs is-done" aria-hidden="true"></div>' +
      '<h2 class="rv-score">' + head + '</h2>' +
      (sum.length ? '<p class="rv-sum">' + sum.join(' ') + '</p>' : '') + list +
      '<div class="rv-state-acts">' + nextActs(due, info, true) + '</div>' + deckLine(info), 'done');
    paintSegs($('.rv-segs', state), r);
    paintSide();
    window.scrollTo(0, 0);
    state.focus({ preventScroll: true });
  }
  // what to do next: another round while anything is due, otherwise back to the lessons or practice
  function nextActs(due, info, afterRound) {
    if (due) return '<button class="btn" type="button" data-rv-again><svg class="ic"><use href="#i-play"/></svg> Start round ' + (rounds + 1) + '</button>' +
      '<span class="rv-left">' + plural(due, 'question') + ' ' + (afterRound ? 'still ' : '') + 'due today</span>';
    return (afterRound ? '<p class="rv-clear"><svg class="ic"><use href="#i-check"/></svg> That is everything due today.' +
      (info.next ? ' Next: ' + plural(info.nextCount, 'question') + ' ' + fmtDay(info.next) + '.' : '') + '</p>' : '') +
      continueLink() + '<a class="btn btn-ghost" href="#rv-lesson" data-rv-to-practice>Practise a lesson</a>';
  }
  function idle() {
    var info = deck(), due = dueIds().length;
    if (!info.total) {
      showState('<span class="mono-label rv-k">Daily review</span><h2 class="rv-score">Your review deck is empty</h2>' +
        '<p class="rv-sum">Every checkpoint and quiz question you answer in a lesson joins your deck, and comes back here just before you would forget it.</p>' +
        '<div class="rv-state-acts">' + continueLink() + '</div>', 'idle');
    } else {
      showState('<span class="mono-label rv-k">Daily review</span><h2 class="rv-score">' + (due ? plural(due, 'question') + ' due today' : 'Nothing is due today') + '</h2>' +
        '<p class="rv-sum">' + (due ? 'A round is up to ' + ROUND + ' questions and takes a few minutes.'
          : (info.next ? 'Next: ' + plural(info.nextCount, 'question') + ' ' + fmtDay(info.next) + '. ' : '') + 'Keep going with the lessons, or practise one below.') + '</p>' +
        '<div class="rv-state-acts">' + nextActs(due, info, false) + '</div>' + deckLine(info), 'idle');
    }
  }

  /* ---------------------------------------------------------- controls and keys */
  $('[data-rv-next]').addEventListener('click', next);
  $('[data-rv-skip]').addEventListener('click', skip);
  $$('[data-rv-stop]').forEach(function (b) { b.addEventListener('click', stop); });
  $('[data-rv-practice]').addEventListener('click', function () { start('practice', $('[data-rv-lesson]').value, true); });
  function overlayOpen() {
    var search = $('[data-search-modal]'), lb = $('[data-lightbox]');
    return (search && !search.hidden) || (lb && !lb.hidden) || document.body.classList.contains('tutor-open') || $('.tb-menu[open]');
  }
  // capture phase: see the key before app.js closes an overlay with it, so one Esc does not also stop the round
  document.addEventListener('keydown', function (e) {
    var t = e.target || {};
    if (e.metaKey || e.ctrlKey || e.altKey || e.defaultPrevented || overlayOpen()) return;
    if (/INPUT|TEXTAREA|SELECT/.test(t.tagName || '') || t.isContentEditable) return;
    var control = t.closest && t.closest('a, button, summary');
    if (!run) {
      var again = !state.hidden && $('[data-rv-again]', state);
      if (e.key === 'Enter' && again && !control) { e.preventDefault(); again.click(); }
      return;
    }
    if (e.key === 'Escape') { e.preventDefault(); stop(); return; }
    if (e.key === 'Enter') { if (run.answered && !control) { e.preventDefault(); next(); } return; }
    var n = { 1: 0, 2: 1, 3: 2, 4: 3, a: 0, b: 1, c: 2, d: 3 }[e.key.toLowerCase()];
    if (n != null && !run.answered && opts.children[n]) { e.preventDefault(); answer(n); }
  }, true);
  document.addEventListener('dlp:record', function (e) {
    // the record arrived from another device: refresh the counts, and the "nothing due" screen if it is showing
    if (e.detail && e.detail.type === 'replace') { paintSide(); if (!run && state.getAttribute('data-kind') === 'idle') idle(); }
  });

  showState('<p class="rv-sum">Loading your questions…</p>');
  load(function () {
    (window.DLP_BANK || []).forEach(function (q) { bank[q.id] = q; });
    // the practice picker starts on the lesson you answered something in most recently
    var answers = R.get().answers, lessons = {};
    Object.keys(answers).forEach(function (k) { if (bank[k]) lessons[bank[k].l] = Math.max(lessons[bank[k].l] || 0, answers[k].t); });
    var recent = Object.keys(lessons).sort(function (a, b) { return lessons[b] - lessons[a]; })[0];
    if (recent) $('[data-rv-lesson]').value = recent;
    paintSide();
    var practise = /^#practice=([\d.]+)$/.exec(location.hash);
    if (practise && $('[data-rv-lesson] option[value="' + practise[1] + '"]')) { $('[data-rv-lesson]').value = practise[1]; start('practice', practise[1]); }
    else if (dueIds().length) start('due');
    else idle();
  });
})();
