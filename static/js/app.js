/* Deep Learning Lab — page behaviour.
   Plain script (no modules) so the site also works when opened from disk. */
(function () {
  'use strict';

  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };
  var ROOT = document.body.getAttribute('data-root') || '';

  /* ------------------------------------------------------------ storage */
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem('dlp:' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem('dlp:' + k, JSON.stringify(v)); } catch (e) { /* private mode */ } }
  };
  window.DLP = window.DLP || {};
  window.DLP.store = store;

  /* ------------------------------------------------------------ theme */
  function currentTheme() {
    var t = document.documentElement.getAttribute('data-theme');
    if (t) return t;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  window.DLP.theme = currentTheme;
  $$('[data-theme-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var next = currentTheme() === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      try { localStorage.setItem('dlp-theme', next); } catch (e) {}
      document.dispatchEvent(new CustomEvent('dlp:theme', { detail: next }));
    });
  });
  if (window.matchMedia) {
    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', function () {
      document.dispatchEvent(new CustomEvent('dlp:theme', { detail: currentTheme() }));
    });
  }

  /* ------------------------------------------------------------ sidebar */
  $$('[data-nav-toggle]').forEach(function (b) { b.addEventListener('click', function () { document.body.classList.toggle('nav-open'); }); });
  $$('[data-nav-close]').forEach(function (b) { b.addEventListener('click', function () { document.body.classList.remove('nav-open'); }); });
  $$('[data-side-toggle]').forEach(function (b) {
    b.addEventListener('click', function () {
      var m = b.closest('.side-module');
      var open = !m.classList.contains('is-open');
      m.classList.toggle('is-open', open);
      b.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  });
  var activeSide = $('.side-lessons a.is-active');
  if (activeSide) { try { activeSide.scrollIntoView({ block: 'center' }); } catch (e) {} }

  /* ------------------------------------------------------------ progress model */
  function progress() { return store.get('progress', {}); }
  function setLesson(id, patch) {
    var p = progress(); p[id] = Object.assign({}, p[id] || {}, patch); store.set('progress', p); paintProgress();
  }
  function paintProgress() {
    var p = progress();
    $$('[data-progress-dot]').forEach(function (d) {
      var s = p[d.getAttribute('data-progress-dot')] || {};
      d.classList.toggle('is-done', !!s.done);
      d.classList.toggle('is-started', !s.done && (s.pct || 0) > 0.03);
    });
    $$('[data-lesson-status]').forEach(function (d) {
      var s = p[d.getAttribute('data-lesson-status')] || {};
      d.classList.toggle('is-done', !!s.done);
      d.classList.toggle('is-started', !s.done && (s.pct || 0) > 0.03);
      if (s.done) d.innerHTML = '<svg class="ic"><use href="#i-check"/></svg>';
    });
    $$('[data-module-progress]').forEach(function (el) {
      var ids = (el.getAttribute('data-lessons') || '').split(',').filter(Boolean);
      var done = ids.filter(function (i) { return p[i] && p[i].done; }).length;
      $('.bar span', el).style.width = (ids.length ? 100 * done / ids.length : 0) + '%';
      $('.label', el).textContent = done + ' of ' + ids.length + ' lessons complete';
    });
    $$('[data-module-ring]').forEach(function (ring) {
      var card = ring.closest('.path-node');
      var dots = $$('[data-progress-dot]', card);
      if (!dots.length) return;
      var done = dots.filter(function (d) { return d.classList.contains('is-done'); }).length;
      $('.ring-fill', ring).setAttribute('stroke-dasharray', (100 * done / dots.length) + ' 100');
    });
    var cont = $('[data-continue]');
    if (cont) {
      var last = store.get('last', null);
      if (last && last.url) {
        cont.setAttribute('href', ROOT + last.url);
        $('span', cont).textContent = 'Continue: Lesson ' + last.id;
      }
    }
    $$('[data-complete]').forEach(function (btn) {
      var s = p[btn.getAttribute('data-complete')] || {};
      btn.classList.toggle('is-done', !!s.done);
      $('span', btn).textContent = s.done ? 'Completed — click to undo' : 'Mark lesson as complete';
    });
  }
  $$('[data-complete]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var id = btn.getAttribute('data-complete');
      var s = progress()[id] || {};
      setLesson(id, { done: !s.done, pct: 1 });
      if (!s.done) confetti(btn);
    });
  });
  paintProgress();

  function confetti(anchor) {
    var r = anchor.getBoundingClientRect();
    var colors = ['#2a78d6', '#eb6834', '#1baf7a', '#6a55e0', '#d99400'];
    for (var i = 0; i < 26; i++) {
      var s = document.createElement('span');
      s.style.cssText = 'position:fixed;z-index:99;width:8px;height:8px;border-radius:2px;pointer-events:none;left:' +
        (r.left + r.width / 2) + 'px;top:' + (r.top + r.height / 2) + 'px;background:' + colors[i % colors.length];
      document.body.appendChild(s);
      var a = Math.random() * Math.PI * 2, v = 80 + Math.random() * 140;
      s.animate([{ transform: 'translate(0,0) rotate(0)', opacity: 1 },
        { transform: 'translate(' + Math.cos(a) * v + 'px,' + (Math.sin(a) * v - 60) + 'px) rotate(' + (Math.random() * 540) + 'deg)', opacity: 0 }],
        { duration: 900 + Math.random() * 400, easing: 'cubic-bezier(.2,.7,.3,1)' }).onfinish = (function (el) { return function () { el.remove(); }; })(s);
    }
  }

  /* ------------------------------------------------------------ lesson page */
  var lessonEl = $('[data-lesson]');
  if (lessonEl) {
    var LID = lessonEl.getAttribute('data-lesson');
    var link = $('[data-lesson-link="' + LID + '"]');
    store.set('last', { id: LID, url: link ? link.getAttribute('href').replace(ROOT, '') : location.pathname });
    var sections = $$('[data-section]');
    var tocLinks = {};
    $$('[data-toc-link]').forEach(function (a) { tocLinks[a.getAttribute('data-toc-link')] = a; });
    var readSet = new Set((progress()[LID] || {}).read || []);
    sections.forEach(function (s) { if (readSet.has(s.id)) { s.classList.add('is-read'); if (tocLinks[s.id]) tocLinks[s.id].classList.add('is-read'); } });
    var bar = $('.read-progress span');
    var lp = $('[data-lesson-progress]');
    var ticking = false;
    function onScroll() {
      ticking = false;
      var doc = document.documentElement;
      var max = doc.scrollHeight - window.innerHeight;
      var pct = max > 0 ? Math.min(1, window.scrollY / max) : 0;
      if (bar) bar.style.width = (pct * 100) + '%';
      // active section = last one whose top is above 35% of the viewport
      var active = null, line = window.innerHeight * 0.35;
      var start = $('#start');
      if (start && start.getBoundingClientRect().top < line) active = 'start';
      for (var i = 0; i < sections.length; i++) {
        var r = sections[i].getBoundingClientRect();
        if (r.top < line) active = sections[i].id;
        if (r.bottom < window.innerHeight * 0.6 && !readSet.has(sections[i].id)) {
          readSet.add(sections[i].id);
          sections[i].classList.add('is-read');
          if (tocLinks[sections[i].id]) tocLinks[sections[i].id].classList.add('is-read');
          saveRead();
          if (window.DLP.record) window.DLP.record.activity();
        }
      }
      Object.keys(tocLinks).forEach(function (k) { tocLinks[k].classList.toggle('is-active', k === active); });
      if (active && tocLinks[active]) {
        var inner = $('.toc-inner');
        var ar = tocLinks[active].getBoundingClientRect(), ir = inner.getBoundingClientRect();
        if (ar.top < ir.top + 20 || ar.bottom > ir.bottom - 20) inner.scrollTop += ar.top - ir.top - ir.height / 3;
      }
    }
    var saveTimer = null;
    function saveRead() {
      clearTimeout(saveTimer);
      saveTimer = setTimeout(function () {
        var pct = sections.length ? readSet.size / sections.length : 0;
        setLesson(LID, { read: Array.from(readSet), pct: pct });
        paintLessonProgress();
      }, 300);
    }
    function paintLessonProgress() {
      if (!lp) return;
      var pct = sections.length ? readSet.size / sections.length : 0;
      $('.bar span', lp).style.width = Math.round(pct * 100) + '%';
      $('.label', lp).textContent = Math.round(pct * 100) + '% read · ' + readSet.size + ' of ' + sections.length + ' sections';
    }
    paintLessonProgress();
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    // keyboard: alt + arrows for prev/next
    document.addEventListener('keydown', function (e) {
      if (!e.altKey) return;
      var t = e.key === 'ArrowLeft' ? $('.pager-link.prev') : e.key === 'ArrowRight' ? $('.pager-link.next') : null;
      if (t) { e.preventDefault(); location.href = t.href; }
    });
  }

  /* ------------------------------------------------------------ reveal on scroll */
  if ('IntersectionObserver' in window) {
    var ro = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { en.target.classList.add('is-in'); ro.unobserve(en.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    $$('.reveal').forEach(function (el) { ro.observe(el); });
  } else {
    $$('.reveal').forEach(function (el) { el.classList.add('is-in'); });
  }

  /* ------------------------------------------------------------ code cells */
  $$('[data-copy]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var src = $('.code-src', btn.closest('[data-code]')).value;
      var done = function () { btn.innerHTML = '<svg class="ic"><use href="#i-check"/></svg>'; setTimeout(function () { btn.innerHTML = '<svg class="ic"><use href="#i-copy"/></svg>'; }, 1400); };
      if (navigator.clipboard) navigator.clipboard.writeText(src).then(done, done);
      else { var ta = document.createElement('textarea'); ta.value = src; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); done(); }
    });
  });
  $$('[data-code-expand]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cell = btn.closest('[data-code]');
      var on = cell.classList.toggle('is-expanded');
      $('span', btn).textContent = on ? 'Collapse' : 'Show all ' + $$('.ln', cell).length + ' lines';
    });
  });
  $$('[data-explain-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var cell = btn.closest('[data-code]');
      var off = cell.classList.toggle('explain-off');
      btn.setAttribute('aria-expanded', off ? 'false' : 'true');
      $('span', btn).textContent = off ? 'Explain this code' : 'Hide explanation';
    });
  });
  // hovering a note highlights its line and vice versa
  $$('[data-code]').forEach(function (cell) {
    $$('[data-note-for]', cell).forEach(function (li) {
      var n = li.getAttribute('data-note-for');
      var line = $('.ln[data-note="' + n + '"]', cell);
      if (!line) return;
      li.addEventListener('mouseenter', function () { line.classList.add('is-hl'); });
      li.addEventListener('mouseleave', function () { line.classList.remove('is-hl'); });
      line.addEventListener('mouseenter', function () { li.classList.add('is-hl'); });
      line.addEventListener('mouseleave', function () { li.classList.remove('is-hl'); });
    });
  });
  $$('[data-out-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var out = btn.closest('.out');
      var c = out.classList.toggle('is-collapsed');
      btn.textContent = c ? btn.textContent.replace('Hide', 'Show') : 'Hide output';
    });
  });

  /* ------------------------------------------------------------ questions */
  $$('[data-answer-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var item = btn.closest('.qitem');
      var ans = $('.qanswer', item);
      var show = ans.hasAttribute('hidden');
      ans.toggleAttribute('hidden', !show);
      btn.setAttribute('aria-expanded', show ? 'true' : 'false');
      $('span', btn).textContent = show ? 'Hide explanation' : 'Show explanation';
      if (show) renderMath(ans);
    });
  });
  $$('.qnote').forEach(function (ta) {
    var key = 'note:' + (lessonEl ? lessonEl.getAttribute('data-lesson') : '') + ':' + ta.getAttribute('data-note-key');
    var saved = store.get(key, '');
    if (saved) { ta.value = saved; ta.hidden = false; var b = $('[data-note-toggle]', ta.closest('.qitem')); if (b) b.classList.add('is-on'); }
    var t;
    ta.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { store.set(key, ta.value); }, 250); });
  });
  $$('[data-note-toggle]').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var ta = $('.qnote', btn.closest('.qitem'));
      ta.hidden = !ta.hidden;
      btn.classList.toggle('is-on', !ta.hidden);
      if (!ta.hidden) ta.focus();
    });
  });

  /* ------------------------------------------------------------ predict */
  $$('[data-predict]').forEach(function (box) {
    var reveal = $('.predict-reveal', box);
    var answer = box.getAttribute('data-answer');
    if (box.getAttribute('data-mode') === 'choice') {
      $$('.opt', box).forEach(function (o) {
        o.addEventListener('click', function () {
          $$('.opt', box).forEach(function (x) {
            x.disabled = true;
            if (x.getAttribute('data-opt') === answer) x.classList.add('is-correct');
          });
          if (o.getAttribute('data-opt') !== answer) o.classList.add('is-wrong');
          o.classList.add('is-picked');
          reveal.hidden = false; renderMath(reveal);
        });
      });
    } else {
      var range = $('[data-predict-range]', box), out = $('[data-predict-out]', box);
      range.addEventListener('input', function () { out.textContent = range.value; });
      $('[data-predict-lock]', box).addEventListener('click', function (e) {
        var guess = parseFloat(range.value), ans = parseFloat(answer), tol = parseFloat(box.getAttribute('data-tolerance')) || 0;
        range.disabled = true; e.target.disabled = true;
        var diff = Math.abs(guess - ans);
        var verdict = document.createElement('p');
        verdict.innerHTML = '<strong>Your guess: ' + guess + '. Actual: ' + ans + '.</strong> ' +
          (diff <= tol ? 'Spot on — your intuition is calibrated.' : 'Off by ' + (Math.round(diff * 1000) / 1000) + '. Read on to see why.');
        reveal.insertBefore(verdict, reveal.firstChild);
        reveal.hidden = false; renderMath(reveal);
      });
    }
  });

  /* ------------------------------------------------------------ multiple choice (quiz + checkpoints) */
  var REC = window.DLP.record;
  var LESSON_ID = lessonEl ? lessonEl.getAttribute('data-lesson') : '';
  // Show a question as answered: lock the options, mark right and wrong, reveal the explanation.
  function showChoice(q, pick, whySel) {
    var ans = q.getAttribute('data-answer');
    q.classList.add('is-answered');
    $$('.opt', q).forEach(function (x) {
      x.disabled = true;
      x.classList.toggle('is-correct', x.getAttribute('data-opt') === ans);
      x.classList.toggle('is-picked', x.getAttribute('data-opt') === String(pick));
      x.classList.toggle('is-wrong', x.getAttribute('data-opt') === String(pick) && String(pick) !== ans);
    });
    var why = $(whySel, q); if (why) { why.hidden = false; renderMath(why); }
  }
  function resetChoice(q, whySel) {
    q.classList.remove('is-answered');
    $$('.opt', q).forEach(function (x) { x.disabled = false; x.classList.remove('is-correct', 'is-picked', 'is-wrong'); });
    var why = $(whySel, q); if (why) why.hidden = true;
  }
  function wireChoices(q, whySel, onAnswer) {
    $$('.opt', q).forEach(function (o) {
      o.addEventListener('click', function () {
        if (q.classList.contains('is-answered')) return;
        var pick = o.getAttribute('data-opt'), ok = pick === q.getAttribute('data-answer');
        showChoice(q, pick, whySel);
        onAnswer(ok, pick);
      });
    });
  }

  /* ------------------------------------------------------------ quiz */
  $$('[data-quiz]').forEach(function (quiz) {
    var qs = $$('[data-quiz-q]', quiz), score = $('[data-quiz-score]', quiz), foot = $('[data-quiz-foot]', quiz);
    var state = {};   // qid -> ok, for this attempt
    function paint() {
      var answered = Object.keys(state).length, right = Object.keys(state).filter(function (k) { return state[k]; }).length;
      score.textContent = answered ? right + ' / ' + qs.length + ' correct' : qs.length + ' questions';
      if (foot) foot.hidden = answered < qs.length;
      return { answered: answered, right: right };
    }
    qs.forEach(function (q, i) {
      var qid = q.getAttribute('data-qid') || ('quiz:' + i);
      var prev = REC && q.getAttribute('data-qid') ? REC.answerOf(qid) : null;
      if (prev && prev.pick != null) { showChoice(q, prev.pick, '.quiz-why'); state[qid] = prev.ok; }
      wireChoices(q, '.quiz-why', function (ok, pick) {
        state[qid] = ok;
        if (REC && q.getAttribute('data-qid')) REC.answer(qid, ok, { kind: 'quiz', lesson: LESSON_ID, pick: pick });
        var p = paint();
        if (p.answered === qs.length && p.right === qs.length) confetti(score);
      });
    });
    if (foot) $('[data-quiz-retry]', foot).addEventListener('click', function () {
      state = {}; qs.forEach(function (q) { resetChoice(q, '.quiz-why'); }); paint();
      qs[0].scrollIntoView({ block: 'center', behavior: 'smooth' });
    });
    paint();
  });

  /* ------------------------------------------------------------ checkpoints */
  var VERDICT = { solid: 'Solid', partly: 'Partly there', notyet: 'Not yet' };
  $$('[data-checkpoint]').forEach(function (cp) {
    var qs = $$('[data-cp-q]', cp), score = $('[data-cp-score]', cp), sec = cp.getAttribute('data-sec');
    function paint() {
      var done = 0, right = 0;
      qs.forEach(function (q) { var a = REC.answerOf(q.getAttribute('data-cp-q')); if (a) { done++; if (a.ok) right++; } });
      var ex = $('[data-cp-explain]', cp), exv = ex ? REC.explainOf(ex.getAttribute('data-cp-explain')) : null;
      score.innerHTML = done === qs.length && qs.length ? '<svg class="ic"><use href="#i-check"/></svg> ' + right + ' / ' + qs.length + (exv ? ' · ' + VERDICT[exv.v] : '') : '';
      var complete = done === qs.length;
      cp.classList.toggle('is-done', complete);
      var tl = $('[data-toc-link="' + (cp.closest('[data-section]') || {}).id + '"]');
      if (tl) tl.classList.toggle('cp-done', complete);
      cp.dispatchEvent(new CustomEvent('dlp:checkpoint', { bubbles: true, detail: { sec: sec, complete: complete } }));
    }
    qs.forEach(function (q) {
      var qid = q.getAttribute('data-cp-q'), prev = REC.answerOf(qid);
      if (prev && prev.pick != null) showChoice(q, prev.pick, '.cp-why');
      wireChoices(q, '.cp-why', function (ok, pick) { REC.answer(qid, ok, { kind: 'checkpoint', lesson: LESSON_ID, pick: pick }); paint(); });
    });
    var ex = $('[data-cp-explain]', cp);
    if (ex) wireExplain(ex, paint);
    paint();
  });
  function wireExplain(ex, paint) {
    var id = ex.getAttribute('data-cp-explain'), ta = $('.cp-input', ex), fb = $('[data-cp-feedback]', ex);
    var keyBox = $('[data-cp-keybox]', ex), keyBtn = $('[data-cp-key]', ex), checkBtn = $('[data-cp-check]', ex);
    var ref = {}; try { ref = JSON.parse($('[data-cp-ref]', ex).textContent); } catch (e) {}
    var noteKey = 'note:' + LESSON_ID + ':' + ta.getAttribute('data-note-key'), t;
    ta.value = store.get(noteKey, '');
    ta.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { store.set(noteKey, ta.value); }, 250); });
    var prev = REC.explainOf(id);
    if (prev) markVerdict(prev.v);
    function markVerdict(v) {
      ex.setAttribute('data-verdict', v);
      $$('[data-self]', ex).forEach(function (b) { b.classList.toggle('is-on', b.getAttribute('data-self') === v); });
    }
    function showKey(show) {
      keyBox.hidden = !show; keyBtn.setAttribute('aria-expanded', show ? 'true' : 'false');
      $('span', keyBtn).textContent = show ? 'Hide key points' : 'Show key points';
      if (show) renderMath(keyBox);
    }
    keyBtn.addEventListener('click', function () { showKey(keyBox.hidden); });
    $$('[data-self]', ex).forEach(function (b) {
      b.addEventListener('click', function () { var v = b.getAttribute('data-self'); REC.explain(id, v, { lesson: LESSON_ID, by: 'self' }); markVerdict(v); paint(); });
    });
    checkBtn.addEventListener('click', function () {
      var answer = ta.value.trim();
      if (answer.length < 12) { ta.focus(); ta.classList.add('is-nudged'); setTimeout(function () { ta.classList.remove('is-nudged'); }, 600); return; }
      var tutor = window.DLP.tutor;
      if (!tutor || !tutor.grade) { showKey(true); return; }
      checkBtn.disabled = true; $('span', checkBtn).textContent = 'Checking…';
      fb.hidden = false; fb.className = 'cp-feedback prose'; fb.innerHTML = '<span class="tutor-typing"><i></i><i></i><i></i></span>';
      tutor.grade({ prompt: ref.prompt, key: ref.key, answer: answer, section: ex.closest('[data-section]') }, function (text) {
        fb.innerHTML = tutor.render(text.replace(/^\s*VERDICT:[^\n]*\n?/i, ''));
      }, function (err, verdict, text) {
        checkBtn.disabled = false; $('span', checkBtn).textContent = 'Check again';
        if (err) {
          fb.innerHTML = '<p>' + (err === 'not-connected' ? 'The tutor is not connected, so compare your answer with the key points instead.' : 'The tutor could not check this right now (' + err + '). Compare with the key points instead.') + '</p>';
          showKey(true); return;
        }
        fb.innerHTML = '<p class="cp-verdict v-' + verdict + '">' + VERDICT[verdict] + '</p>' + tutor.render(text.replace(/^\s*VERDICT:[^\n]*\n?/i, ''));
        fb.className = 'cp-feedback prose v-' + verdict;
        REC.explain(id, verdict, { lesson: LESSON_ID, by: 'tutor' }); markVerdict(verdict); paint();
        $('span', keyBtn).textContent = keyBox.hidden ? 'Show key points' : 'Hide key points';
      });
    });
  }

  /* ------------------------------------------------------------ labs used (for mastery) */
  if (lessonEl && REC) {
    $$('[data-widget]').forEach(function (fig) {
      function used() { REC.lab(LESSON_ID, fig.getAttribute('data-widget')); fig.removeEventListener('pointerdown', used, true); fig.removeEventListener('keydown', used, true); }
      fig.addEventListener('pointerdown', used, true);
      fig.addEventListener('keydown', used, true);
    });
  }

  /* ------------------------------------------------------------ stepper */
  $$('[data-stepper]').forEach(function (st) {
    var frames = $$('[data-step]', st), dots = $$('[data-step-go]', st), i = 0;
    function go(n) {
      i = Math.max(0, Math.min(frames.length - 1, n));
      frames.forEach(function (f, k) { f.classList.toggle('is-active', k === i); });
      dots.forEach(function (d, k) { d.classList.toggle('is-active', k === i); d.classList.toggle('is-done', k < i); });
      $('[data-step-count]', st).textContent = (i + 1) + ' / ' + frames.length;
      $('[data-step-prev]', st).disabled = i === 0;
      $('[data-step-next]', st).innerHTML = i === frames.length - 1 ? 'Start again <svg class="ic"><use href="#i-refresh"/></svg>' : 'Next <svg class="ic"><use href="#i-arrow-right"/></svg>';
      renderMath(frames[i]);
      frames[i].dispatchEvent(new CustomEvent('dlp:step', { bubbles: true, detail: i }));
    }
    $('[data-step-prev]', st).addEventListener('click', function () { go(i - 1); });
    $('[data-step-next]', st).addEventListener('click', function () { go(i === frames.length - 1 ? 0 : i + 1); });
    dots.forEach(function (d) { d.addEventListener('click', function () { go(+d.getAttribute('data-step-go')); }); });
    go(0);
  });

  /* ------------------------------------------------------------ lightbox */
  var lb = $('[data-lightbox]');
  document.addEventListener('click', function (e) {
    var img = e.target.closest && e.target.closest('img.zoomable');
    if (img && lb) { $('img', lb).src = img.currentSrc || img.src; $('img', lb).alt = img.alt; lb.hidden = false; }
  });
  if (lb) lb.addEventListener('click', function () { lb.hidden = true; });

  /* ------------------------------------------------------------ glossary popover */
  var pop = $('[data-term-pop]');
  var GL = window.DLP_GLOSSARY || {};
  var popFor = null, hideTimer = null;
  function showTerm(el) {
    var d = GL[el.getAttribute('data-term')];
    if (!d || !pop) return;
    clearTimeout(hideTimer);
    popFor = el;
    pop.innerHTML = '<strong>' + d.t + '</strong>' + d.d + ' <a href="' + ROOT + 'glossary.html#' + el.getAttribute('data-term') + '">Glossary →</a>';
    pop.hidden = false;
    var r = el.getBoundingClientRect(), pw = Math.min(340, window.innerWidth - 24);
    pop.style.maxWidth = pw + 'px';
    var left = Math.max(12, Math.min(window.innerWidth - pw - 12, r.left + r.width / 2 - pw / 2));
    pop.style.left = left + 'px';
    var ph = pop.offsetHeight;
    pop.style.top = (r.top - ph - 10 > 70 ? r.top - ph - 10 : r.bottom + 10) + 'px';
  }
  function hideTerm() { hideTimer = setTimeout(function () { if (pop) pop.hidden = true; popFor = null; }, 120); }
  $$('.term[data-term]').forEach(function (el) {
    el.addEventListener('mouseenter', function () { showTerm(el); });
    el.addEventListener('mouseleave', hideTerm);
    el.addEventListener('focus', function () { showTerm(el); });
    el.addEventListener('blur', hideTerm);
    el.addEventListener('click', function (e) { e.preventDefault(); if (popFor === el && !pop.hidden) { pop.hidden = true; popFor = null; } else showTerm(el); });
  });
  if (pop) { pop.addEventListener('mouseenter', function () { clearTimeout(hideTimer); }); pop.addEventListener('mouseleave', hideTerm); }
  window.addEventListener('scroll', function () { if (pop && !pop.hidden) { pop.hidden = true; popFor = null; } }, { passive: true });

  // glossary page filter
  var gf = $('[data-gloss-filter]');
  if (gf) gf.addEventListener('input', function () {
    var q = gf.value.trim().toLowerCase();
    $$('[data-gloss-item]').forEach(function (it) { it.hidden = q && it.getAttribute('data-gloss-item').indexOf(q) === -1; });
    $$('.gloss-letter').forEach(function (l) { l.hidden = !!q; });
  });

  /* ------------------------------------------------------------ search */
  var modal = $('[data-search-modal]'), input = $('[data-search-input]'), results = $('[data-search-results]');
  var sel = 0, hits = [];
  function loadIndex(cb) {
    if (window.DLP_SEARCH) return cb();
    var s = document.createElement('script');
    s.src = ROOT + 'static/search-index.js';
    s.onload = cb; document.head.appendChild(s);
  }
  function openSearch() { modal.hidden = false; input.value = ''; results.innerHTML = '<li class="search-empty">Type to search every lesson, section and glossary term.</li>'; setTimeout(function () { input.focus(); }, 10); loadIndex(function () {}); }
  function closeSearch() { modal.hidden = true; }
  function escapeHtml(s) { return s.replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function runSearch() {
    var q = input.value.trim().toLowerCase();
    if (!q) { results.innerHTML = ''; return; }
    var words = q.split(/\s+/).filter(Boolean);
    hits = [];
    (window.DLP_SEARCH || []).forEach(function (d) {
      var title = (d.s + ' ' + d.lt).toLowerCase(), body = d.x.toLowerCase(), score = 0;
      for (var i = 0; i < words.length; i++) {
        var w = words[i], inT = title.indexOf(w), inB = body.indexOf(w);
        if (inT === -1 && inB === -1) return;
        score += (inT !== -1 ? 10 : 0) + (inB !== -1 ? 2 + Math.min(4, body.split(w).length - 1) : 0);
      }
      if (d.s.toLowerCase() === q) score += 30;
      hits.push({ d: d, score: score });
    });
    hits.sort(function (a, b) { return b.score - a.score; });
    hits = hits.slice(0, 30);
    sel = 0;
    if (!hits.length) { results.innerHTML = '<li class="search-empty">No matches for “' + escapeHtml(q) + '”.</li>'; return; }
    results.innerHTML = hits.map(function (h, i) {
      var d = h.d, body = d.x, pos = body.toLowerCase().indexOf(words[0]);
      var start = Math.max(0, pos - 60), snip = (start > 0 ? '…' : '') + body.slice(start, start + 200);
      snip = escapeHtml(snip);
      words.forEach(function (w) { snip = snip.replace(new RegExp('(' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'), '<mark>$1</mark>'); });
      return '<li><a href="' + ROOT + d.u + '"' + (i === 0 ? ' class="is-active"' : '') + '><div class="sr-meta">' +
        (d.l === 'Glossary' ? 'Glossary' : 'Lesson ' + d.l + ' · ' + escapeHtml(d.lt)) + '</div><div class="sr-title">' + escapeHtml(d.s) + '</div><div class="sr-snip">' + snip + '</div></a></li>';
    }).join('');
  }
  if (modal) {
    $$('[data-search-open]').forEach(function (b) { b.addEventListener('click', openSearch); });
    $('[data-search-close]').addEventListener('click', closeSearch);
    modal.addEventListener('click', function (e) { if (e.target === modal) closeSearch(); });
    input.addEventListener('input', function () { loadIndex(runSearch); });
    input.addEventListener('keydown', function (e) {
      var links = $$('a', results);
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        sel = (sel + (e.key === 'ArrowDown' ? 1 : -1) + links.length) % Math.max(1, links.length);
        links.forEach(function (a, i) { a.classList.toggle('is-active', i === sel); });
        if (links[sel]) links[sel].scrollIntoView({ block: 'nearest' });
      } else if (e.key === 'Enter' && links[sel]) { location.href = links[sel].href; closeSearch(); }
    });
    results.addEventListener('click', function (e) { if (e.target.closest('a')) closeSearch(); });
  }
  document.addEventListener('keydown', function (e) {
    var typing = /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '');
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); modal.hidden ? openSearch() : closeSearch(); }
    else if (e.key === '/' && !typing && modal && modal.hidden) { e.preventDefault(); openSearch(); }
    else if (e.key === 'Escape') { if (modal) closeSearch(); if (lb) lb.hidden = true; if (pop) pop.hidden = true; document.body.classList.remove('nav-open'); }
  });

  /* ------------------------------------------------------------ math */
  function renderMath(root) {
    if (!window.katex) return;
    $$('.math[data-tex]:not([data-done])', root).forEach(function (el) {
      try {
        window.katex.render(el.getAttribute('data-tex'), el, { displayMode: el.classList.contains('math-display'), throwOnError: false, strict: false });
        el.setAttribute('data-done', '1');
      } catch (e) { /* leave the TeX visible */ }
    });
  }
  window.DLP.renderMath = renderMath;
  renderMath(document);

  /* ------------------------------------------------------------ widgets */
  var registry = (window.DLP.widgets = window.DLP.widgets || {});
  function mountWidget(fig) {
    if (fig.getAttribute('data-mounted')) return;
    var name = fig.getAttribute('data-widget'), fn = registry[name], mount = $('.widget-mount', fig);
    if (!fn) { mount.innerHTML = '<div class="widget-loading">Interactive “' + name + '” is not available.</div>'; return; }
    fig.setAttribute('data-mounted', '1');
    var props = {};
    try { props = JSON.parse(fig.getAttribute('data-props') || '{}'); } catch (e) {}
    mount.innerHTML = '';
    try { fn(mount, props, fig); } catch (err) { mount.innerHTML = '<div class="widget-loading">Could not start this interactive.</div>'; console.error(err); }
    renderMath(fig);
  }
  var widgets = $$('[data-widget]');
  if ('IntersectionObserver' in window) {
    var wo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) { if (en.isIntersecting) { mountWidget(en.target); wo.unobserve(en.target); } });
    }, { rootMargin: '400px 0px' });
    widgets.forEach(function (w) { wo.observe(w); });
  } else widgets.forEach(mountWidget);

  /* ------------------------------------------------------------ home hero animation */
  var hc = $('[data-hero-canvas]');
  if (hc) heroNetwork(hc);
  function heroNetwork(canvas) {
    var ctx = canvas.getContext('2d'), W, H, dpr = Math.min(2, window.devicePixelRatio || 1), nodes = [], layers = [4, 6, 6, 3], t0 = performance.now();
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    function size() {
      var r = canvas.getBoundingClientRect(); W = r.width; H = r.height; canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      nodes = [];
      var x0 = W * 0.58, x1 = W * 0.95;
      layers.forEach(function (n, li) {
        for (var i = 0; i < n; i++) nodes.push({ l: li, x: x0 + (x1 - x0) * li / (layers.length - 1), y: H * (0.18 + 0.64 * (i + 0.5) / n) });
      });
    }
    function col(v) { return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }
    function draw(now) {
      var t = (now - t0) / 1000;
      ctx.clearRect(0, 0, W, H);
      if (W < 700) { if (!reduce) requestAnimationFrame(draw); return; }
      var line = col('--line-2'), a = col('--c0'), b = col('--c1');
      for (var i = 0; i < nodes.length; i++) for (var j = 0; j < nodes.length; j++) {
        var p = nodes[i], q = nodes[j];
        if (q.l !== p.l + 1) continue;
        ctx.strokeStyle = line; ctx.globalAlpha = 0.55; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
        var phase = ((t * 0.45 + (i * 7 + j * 3) % 10 / 10) % 1);
        if (((i + j) % 3) === 0) {
          ctx.globalAlpha = 0.9; ctx.fillStyle = (i + j) % 2 ? a : b;
          ctx.beginPath(); ctx.arc(p.x + (q.x - p.x) * phase, p.y + (q.y - p.y) * phase, 2.2, 0, 7); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      nodes.forEach(function (n, k) {
        var pulse = 0.5 + 0.5 * Math.sin(t * 1.6 + k);
        ctx.fillStyle = col('--surface'); ctx.strokeStyle = n.l === 0 ? a : n.l === layers.length - 1 ? b : col('--violet');
        ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(n.x, n.y, 7 + pulse * 1.5, 0, 7); ctx.fill(); ctx.stroke();
      });
      if (!reduce) requestAnimationFrame(draw);
    }
    size(); window.addEventListener('resize', size); requestAnimationFrame(draw);
    document.addEventListener('dlp:theme', function () { if (reduce) requestAnimationFrame(draw); });
  }
})();
