/* Run Python on the page: code cells marked runnable, and code exercises.
   Python itself (Pyodide) runs in static/js/pyworker.js, started on the first Run and reused afterwards.
   Code cells share one namespace per lesson, like a notebook: running a cell first runs any earlier
   runnable cells that have not run yet. Exercises run in their own fresh namespace on every Check. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var ROOT = document.body.getAttribute('data-root') || '';
  var worker = null, seq = 0, waiting = {}, statusListeners = [], lastStatus = '';
  var LESSON = ($('[data-lesson]') || { getAttribute: function () { return ''; } }).getAttribute('data-lesson');

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function onStatus(fn) { statusListeners.push(fn); if (lastStatus) fn(lastStatus); }
  function start() {
    if (worker) return worker;
    if (location.protocol === 'file:') throw new Error('Running Python needs the site to be served over http(s), not opened from disk.');
    worker = new Worker(ROOT + 'static/js/pyworker.js', { type: 'module' });
    worker.onmessage = function (e) {
      var m = e.data;
      if (m.type === 'status') { lastStatus = m.text; statusListeners.forEach(function (f) { f(m.text); }); return; }
      var w = waiting[m.id]; if (!w) return;
      if (m.type === 'stream') { w.onStream && w.onStream(m.name, m.text); return; }
      if (m.type === 'done') { clearTimeout(w.timer); delete waiting[m.id]; w.resolve(m); }
    };
    worker.onerror = function (e) { Object.keys(waiting).forEach(function (id) { waiting[id].resolve({ error: 'Python could not start: ' + (e.message || 'network error') }); delete waiting[id]; }); worker = null; };
    return worker;
  }
  // run(code, {ns, fresh, onStream}) -> Promise<{result, figures, error, seconds}>
  function run(code, opts) {
    opts = opts || {};
    return new Promise(function (resolve) {
      var w;
      try { w = start(); } catch (err) { resolve({ error: err.message }); return; }
      var id = ++seq;
      waiting[id] = { resolve: resolve, onStream: opts.onStream, timer: setTimeout(function () {
        if (!waiting[id]) return;
        delete waiting[id]; worker.terminate(); worker = null; lastStatus = '';
        resolve({ error: 'Stopped after 90 seconds. Python was restarted, so earlier cells will run again next time.' });
        resetLessonState();
      }, 90000) };
      w.postMessage({ type: 'run', id: id, code: code, ns: opts.ns, fresh: !!opts.fresh });
    });
  }
  window.DLP = window.DLP || {};
  window.DLP.py = { run: run, onStatus: onStatus };

  // notebook magics and shell lines cannot run here
  function prepare(src) { return src.split('\n').map(function (l) { return /^\s*[%!]/.test(l) ? '# (skipped in the browser) ' + l.trim() : l; }).join('\n'); }
  function renderOut(box, res, streamed) {
    var html = '';
    if (streamed) html += '<pre class="py-stream">' + esc(streamed) + '</pre>';
    if (res.result != null) html += '<pre class="py-result">' + esc(res.result) + '</pre>';
    (res.figures || []).forEach(function (b64) { if (/^[A-Za-z0-9+/=]+$/.test(b64)) html += '<img class="py-fig zoomable" alt="Plot produced by this code" src="data:image/png;base64,' + b64 + '">'; });
    if (res.error) html += '<pre class="py-error">' + esc(res.error) + '</pre>';
    if (!html) html = '<p class="py-none">Ran without output' + (res.seconds != null ? ' (' + res.seconds.toFixed(1) + ' s)' : '') + '.</p>';
    box.innerHTML = html; box.hidden = false;
  }

  /* ------------------------------------------------------------ runnable code cells */
  var cells = $$('[data-code][data-runnable]'), done = new Set(), busy = false;
  function resetLessonState() { done = new Set(); cells.forEach(function (c) { c.classList.remove('py-ran'); }); }
  function source(cell) { var ed = $('.py-editor', cell); return ed ? ed.value : ($('.code-src', cell) || {}).value || ''; }
  function setStatus(cell, text) { var s = $('.py-status', cell); if (s) { s.textContent = text; s.hidden = !text; } }
  async function runCell(cell) {
    if (busy) return;
    busy = true;
    var idx = cells.indexOf(cell), btn = $('[data-py-run]', cell);
    cells.forEach(function (c) { var b = $('[data-py-run]', c); if (b) b.disabled = true; });
    var unsub = function (t) { if (t !== 'ready') setStatus(cell, t); };
    onStatus(unsub);
    try {
      for (var i = 0; i < idx; i++) {                             // notebook semantics: earlier cells first
        if (done.has(i)) continue;
        setStatus(cell, 'Running earlier cell ' + (i + 1) + ' of ' + idx + '…');
        var r0 = await run(prepare(source(cells[i])), { ns: 'lesson:' + LESSON });
        done.add(i); cells[i].classList.add('py-ran');
        var out0 = $('.py-out', cells[i]);
        if (r0.error) { renderOut(out0, r0, ''); setStatus(cell, ''); renderOut($('.py-out', cell), { error: 'An earlier cell failed (see its output above), so this one was not run.\n\n' + r0.error.split('\n').slice(-1)[0] }, ''); return; }
      }
      setStatus(cell, 'Running…');
      var streamed = '';
      var res = await run(prepare(source(cell)), { ns: 'lesson:' + LESSON, onStream: function (_, t) { streamed += t; } });
      done.add(idx); cell.classList.add('py-ran');
      setStatus(cell, res.error ? '' : 'Ran in ' + (res.seconds || 0).toFixed(1) + ' s');
      renderOut($('.py-out', cell), res, streamed);
      if (window.DLP.record) window.DLP.record.lab(LESSON, 'python');
    } finally {
      busy = false; statusListeners.splice(statusListeners.indexOf(unsub), 1);
      cells.forEach(function (c) { var b = $('[data-py-run]', c); if (b) b.disabled = false; });
      if (btn) btn.focus();
    }
  }
  function editor(value) {
    var ta = document.createElement('textarea');
    ta.className = 'py-editor'; ta.spellcheck = false; ta.value = value; ta.setAttribute('aria-label', 'Python code');
    function size() { ta.style.height = 'auto'; ta.style.height = Math.min(640, ta.scrollHeight + 4) + 'px'; }
    ta.addEventListener('input', size);
    ta.addEventListener('keydown', function (e) {
      if (e.key === 'Tab' && !e.shiftKey) { e.preventDefault(); var s = ta.selectionStart; ta.setRangeText('    ', s, ta.selectionEnd, 'end'); size(); }
      if (e.key === 'Enter' && (e.shiftKey || e.metaKey || e.ctrlKey)) { e.preventDefault(); ta.dispatchEvent(new CustomEvent('dlp:run', { bubbles: true })); }
    });
    setTimeout(size, 0);
    return ta;
  }
  cells.forEach(function (cell) {
    $('[data-py-run]', cell).addEventListener('click', function () { runCell(cell); });
    var edit = $('[data-py-edit]', cell);
    if (edit) edit.addEventListener('click', function () {
      var ed = $('.py-editor', cell), pre = $('pre.code', cell);
      if (ed) { ed.remove(); pre.hidden = false; $('span', edit).textContent = 'Edit'; cell.classList.remove('is-editing'); return; }
      ed = editor(($('.code-src', cell) || {}).value || '');
      ed.addEventListener('dlp:run', function () { runCell(cell); });
      pre.hidden = true; pre.insertAdjacentElement('afterend', ed); ed.focus();
      $('span', edit).textContent = 'Undo edits'; cell.classList.add('is-editing');
    });
  });

  /* ------------------------------------------------------------ code exercises */
  $$('[data-exercise]').forEach(function (ex) {
    var id = ex.getAttribute('data-exercise'), spec = {};
    try { spec = JSON.parse($('[data-ex-spec]', ex).textContent); } catch (e) { return; }
    var holder = $('.ex-editor', ex), out = $('.py-out', ex), verdict = $('.ex-verdict', ex), hintBox = $('.ex-hints', ex);
    var saved = window.DLP.store ? window.DLP.store.get('code:' + id, null) : null;
    var ta = editor(saved || spec.starter);
    holder.appendChild(ta);
    var t; ta.addEventListener('input', function () { clearTimeout(t); t = setTimeout(function () { if (window.DLP.store) window.DLP.store.set('code:' + id, ta.value); }, 300); });
    var hintsShown = 0, attempts = 0, solBtn = $('[data-ex-solution]', ex), status = $('.py-status', ex);
    var prev = window.DLP.record && window.DLP.record.answerOf(id);
    if (prev && prev.ok) { ex.classList.add('is-passed'); verdict.hidden = false; verdict.className = 'ex-verdict good'; verdict.innerHTML = '<svg class="ic"><use href="#i-check"/></svg> Passed before. Run it again any time.'; }
    function busyUi(b, label) { $$('button', ex).forEach(function (x) { x.disabled = b; }); status.textContent = label || ''; status.hidden = !label; }
    onStatus(function (s) { if (!status.hidden && s !== 'ready') status.textContent = s; });
    ta.addEventListener('dlp:run', function () { check(); });
    $('[data-ex-run]', ex).addEventListener('click', async function () {
      busyUi(true, 'Running…'); var streamed = '';
      var res = await run(ta.value, { ns: id, fresh: true, onStream: function (_, s) { streamed += s; } });
      busyUi(false); renderOut(out, res, streamed);
    });
    async function check() {
      busyUi(true, 'Checking…'); attempts++;
      var streamed = '';
      var res = await run(ta.value + '\n\n# ---- checks ----\n' + spec.check, { ns: id, fresh: true, onStream: function (_, s) { streamed += s; } });
      busyUi(false);
      var ok = !res.error;
      verdict.hidden = false;
      if (ok) {
        verdict.className = 'ex-verdict good';
        verdict.innerHTML = '<svg class="ic"><use href="#i-check"/></svg> <strong>All checks passed.</strong> ' + (spec.success || '');
        ex.classList.add('is-passed'); out.hidden = true;
      } else {
        var last = res.error.trim().split('\n').pop();
        var assertion = /AssertionError:?\s*(.*)$/.exec(last);
        verdict.className = 'ex-verdict bad';
        var blank = /name '_{3,}' is not defined/.test(res.error);
        verdict.innerHTML = '<strong>Not yet.</strong> ' + (blank ? 'Replace every <code>___</code> with your own code first.' : esc(assertion ? (assertion[1] || 'A check failed.') : last));
        renderOut(out, { error: res.error, figures: res.figures }, streamed);
      }
      if (window.DLP.record) window.DLP.record.answer(id, ok, { kind: 'exercise', lesson: LESSON });
      if (attempts >= 1 && solBtn) solBtn.hidden = false;
      return ok;
    }
    $('[data-ex-check]', ex).addEventListener('click', check);
    var hintBtn = $('[data-ex-hint]', ex);
    if (hintBtn) hintBtn.addEventListener('click', function () {
      if (hintsShown >= (spec.hints || []).length) return;
      var li = document.createElement('li'); li.innerHTML = spec.hints_html[hintsShown++]; hintBox.appendChild(li); hintBox.hidden = false;
      if (window.DLP.renderMath) window.DLP.renderMath(hintBox);
      if (hintsShown >= spec.hints.length) hintBtn.disabled = true;
      if (hintsShown >= 2 && solBtn) solBtn.hidden = false;
    });
    if (solBtn) solBtn.addEventListener('click', function () {
      if (!confirm('Replace your code with the model solution? Your version is kept in this browser until you edit again.')) return;
      ta.value = spec.solution; ta.dispatchEvent(new Event('input'));
    });
    $('[data-ex-reset]', ex).addEventListener('click', function () { ta.value = spec.starter; ta.dispatchEvent(new Event('input')); verdict.hidden = true; out.hidden = true; });
  });
})();
