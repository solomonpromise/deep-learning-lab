/* Focus mode — one section of a lesson at a time.
   Page 0 is the lesson's opening (hero and "Before you start"); then one page per section; the wrap-up
   (takeaways and quiz) is the last page. "Next" waits until the section's checkpoint questions are answered,
   with "Skip for now" always available. The choice to use focus mode, and the page each lesson was left on,
   are remembered in this browser. The full page stays one click away. Loaded on lesson pages only. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var lesson = $('[data-lesson]');
  if (!lesson) return;
  var LID = lesson.getAttribute('data-lesson'), store = window.DLP.store, REC = window.DLP.record;
  var hero = $('.lesson-hero'), start = $('#start'), bigPicture = $('.big-picture'), end = $('.lesson-end');
  var pages = [[hero, bigPicture, start].filter(Boolean)].concat($$('[data-section]').map(function (s) { return [s]; }));
  var titles = ['Before you start'].concat($$('[data-section]').map(function (s) { var h = $('h2', s); return h ? h.textContent.trim() : ''; }));
  var nums = [''].concat($$('[data-section]').map(function (s) { var n = $('.sec-num', s); return n && /\d/.test(n.textContent) ? n.textContent.trim() : ''; }));
  var on = false, page = 0, skipped = {};

  var toggle = document.createElement('button');
  toggle.type = 'button'; toggle.className = 'btn btn-ghost focus-toggle'; toggle.setAttribute('aria-pressed', 'false');
  var actions = $('.hero-actions');
  if (actions) actions.appendChild(toggle);

  var bar = document.createElement('nav');
  bar.className = 'focus-bar'; bar.setAttribute('aria-label', 'Section navigation'); bar.hidden = true;
  bar.innerHTML = '<button type="button" class="btn btn-ghost btn-sm" data-focus-prev><svg class="ic"><use href="#i-arrow-left"/></svg> <span>Back</span></button>' +
    '<div class="focus-where"><span class="focus-count" data-focus-count></span><span class="focus-title" data-focus-title></span><span class="focus-dots" data-focus-dots aria-hidden="true"></span></div>' +
    '<div class="focus-next-wrap"><button type="button" class="btn btn-sm" data-focus-next><span>Next</span> <svg class="ic"><use href="#i-arrow-right"/></svg></button>' +
    '<button type="button" class="focus-skip" data-focus-skip hidden>Skip for now</button></div>' +
    '<button type="button" class="icon-btn sm focus-exit" data-focus-exit title="Show the whole lesson" aria-label="Show the whole lesson"><svg class="ic"><use href="#i-list-check"/></svg></button>';
  document.body.appendChild(bar);
  var prevBtn = $('[data-focus-prev]', bar), nextBtn = $('[data-focus-next]', bar), skipBtn = $('[data-focus-skip]', bar);

  function pageOf(el) {
    for (var i = 0; i < pages.length; i++) for (var k = 0; k < pages[i].length; k++) if (pages[i][k] === el || pages[i][k].contains(el)) return i;
    return -1;
  }
  // a section's checkpoint is "done" when every question in it has an answer on record
  function pending(i) {
    if (skipped[i]) return 0;
    var n = 0;
    pages[i].forEach(function (el) { $$('[data-cp-q]', el).forEach(function (q) { if (!REC || !REC.answerOf(q.getAttribute('data-cp-q'))) n++; }); });
    return n;
  }
  function paintToggle() {
    toggle.setAttribute('aria-pressed', on ? 'true' : 'false');
    toggle.innerHTML = on ? '<svg class="ic"><use href="#i-list-check"/></svg> Show the whole lesson' : '<svg class="ic"><use href="#i-eye"/></svg> Focus mode: one section at a time';
  }
  function show(i, scroll) {
    page = Math.max(0, Math.min(pages.length - 1, i));
    var all = [hero, bigPicture, start].concat($$('[data-section]')).filter(Boolean);
    all.forEach(function (el) { el.classList.toggle('focus-hidden', pages[page].indexOf(el) < 0); });
    if (end) end.classList.toggle('focus-hidden', page !== pages.length - 1);
    $$('[data-discussion], .mastery-panel').forEach(function (el) { el.classList.toggle('focus-hidden', page !== pages.length - 1); });
    $$('[data-toc-link]').forEach(function (a) { a.classList.toggle('focus-current', pageOf(document.getElementById(a.getAttribute('data-toc-link'))) === page); });
    store.set('focus:page:' + LID, page);
    paintBar();
    if (window.DLP.revealAround) window.DLP.revealAround();
    if (scroll !== false) window.scrollTo({ top: Math.max(0, pages[page][0].getBoundingClientRect().top + window.scrollY - 76), behavior: 'instant' });
    window.dispatchEvent(new Event('scroll'));
  }
  function paintBar() {
    var last = page === pages.length - 1, wait = pending(page);
    $('[data-focus-count]', bar).textContent = page === 0 ? 'Start' : (nums[page] ? 'Section ' + nums[page] : '') + ' · ' + page + ' of ' + (pages.length - 1);
    $('[data-focus-title]', bar).textContent = titles[page];
    $('[data-focus-dots]', bar).innerHTML = pages.map(function (_, i) { return '<i class="' + (i === page ? 'is-now' : i < page ? 'is-past' : '') + '"></i>'; }).join('');
    prevBtn.disabled = page === 0;
    var nextLink = $('.pager-link.next');
    if (last) {
      $('span', nextBtn).textContent = nextLink ? 'Next lesson' : 'Finished';
      nextBtn.disabled = !nextLink; skipBtn.hidden = true; nextBtn.classList.remove('is-waiting');
    } else if (wait) {
      $('span', nextBtn).textContent = 'Answer the checkpoint (' + wait + ' left)';
      nextBtn.classList.add('is-waiting'); nextBtn.disabled = false; skipBtn.hidden = false;
    } else {
      $('span', nextBtn).textContent = 'Next: ' + (nums[page + 1] ? '§' + nums[page + 1] + ' ' : '') + titles[page + 1];
      nextBtn.classList.remove('is-waiting'); nextBtn.disabled = false; skipBtn.hidden = true;
    }
  }
  function next() {
    if (page === pages.length - 1) { var n = $('.pager-link.next'); if (n) location.href = n.href; return; }
    if (pending(page)) {                                                       // take the learner to the first unanswered question
      var cp = $('.checkpoint', pages[page][pages[page].length - 1]) || $('.checkpoint', pages[page][0]);
      if (cp) { cp.classList.add('is-in', 'focus-nudge'); cp.scrollIntoView({ block: 'center', behavior: 'smooth' }); setTimeout(function () { cp.classList.remove('focus-nudge'); }, 900); }
      return;
    }
    show(page + 1);
  }
  function setMode(v, remember) {
    on = v; document.body.classList.toggle('focus-mode', on); bar.hidden = !on;
    if (remember !== false) store.set('focus', on);
    paintToggle();
    if (on) {
      var fromHash = location.hash ? pageOf(document.getElementById(location.hash.slice(1))) : -1;
      show(fromHash >= 0 ? fromHash : store.get('focus:page:' + LID, 0));
    } else {
      var here = pages[page][0];
      $$('.focus-hidden').forEach(function (el) { el.classList.remove('focus-hidden'); });
      $$('.focus-current').forEach(function (el) { el.classList.remove('focus-current'); });
      if (window.DLP.revealAround) window.DLP.revealAround();
      if (here) window.scrollTo({ top: here.getBoundingClientRect().top + window.scrollY - 76, behavior: 'instant' });
    }
  }

  toggle.addEventListener('click', function () { setMode(!on); });
  $('[data-focus-exit]', bar).addEventListener('click', function () { setMode(false); });
  prevBtn.addEventListener('click', function () { show(page - 1); });
  nextBtn.addEventListener('click', next);
  skipBtn.addEventListener('click', function () { skipped[page] = true; show(page + 1); });
  document.addEventListener('dlp:checkpoint', function () { if (on) paintBar(); });
  // in focus mode, in-page links (contents, cross-references) open the page that holds their target
  document.addEventListener('click', function (e) {
    if (!on) return;
    var a = e.target.closest && e.target.closest('a[href^="#"]');
    if (!a || a.getAttribute('href').length < 2) return;
    var target = document.getElementById(a.getAttribute('href').slice(1)), i = target ? pageOf(target) : -1;
    if (i < 0) return;
    e.preventDefault();
    if (i !== page) show(i, false);
    setTimeout(function () { target.scrollIntoView({ block: 'start' }); if (window.DLP.revealAround) window.DLP.revealAround(); }, 0);
    history.replaceState(null, '', '#' + target.id);
  }, true);
  document.addEventListener('keydown', function (e) {
    if (!on || !e.altKey || /INPUT|TEXTAREA|SELECT/.test((document.activeElement || {}).tagName || '')) return;
    if (e.key === 'ArrowRight') { e.preventDefault(); e.stopImmediatePropagation(); next(); }
    else if (e.key === 'ArrowLeft') { e.preventDefault(); e.stopImmediatePropagation(); show(page - 1); }
  }, true);

  paintToggle();
  if (store.get('focus', false)) setMode(true, false);
})();
