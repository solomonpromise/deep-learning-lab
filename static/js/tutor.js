/* AI tutor — a context-aware chat panel backed by Qwen on Groq.
   Two ways to connect:
     1. Course proxy  (course.yaml → tutor.endpoint): the API key lives on the server, never in this page.
     2. Personal key  : a learner pastes their own Groq key; it is stored only in this browser
                        and sent only to api.groq.com.
   The tutor always receives the current lesson, the section being read, and (when relevant)
   the question, the learner's own answer and the course's reference answer. */
(function () {
  'use strict';
  var cfgEl = document.getElementById('dlp-tutor-config');
  if (!cfgEl) return;
  var CFG = JSON.parse(cfgEl.textContent || '{}');
  if (!CFG.enabled) return;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var store = (window.DLP && window.DLP.store) || { get: function (k, d) { return d; }, set: function () {} };
  var GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions';
  var lesson = (function () { var el = document.getElementById('dlp-lesson-ctx'); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } })();
  var chatKey = 'tutor:chat:' + (lesson ? lesson.id : 'general');
  var history = sessionGet(chatKey, []);
  var busy = false, controller = null, libsReady = false;

  function sessionGet(k, d) { try { var v = sessionStorage.getItem('dlp:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function sessionSet(k, v) { try { sessionStorage.setItem('dlp:' + k, JSON.stringify(v)); } catch (e) {} }
  function personalKey() { return store.get('tutor:key', ''); }
  function connected() { return !!CFG.endpoint || !!personalKey(); }
  function icon(n) { return '<svg class="ic"><use href="#i-' + n + '"/></svg>'; }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  /* ------------------------------------------------------------ UI */
  var fab = document.createElement('button');
  fab.className = 'tutor-fab'; fab.type = 'button';
  fab.innerHTML = icon('sparkles') + '<span>Ask the tutor</span>';
  fab.setAttribute('aria-label', 'Open the AI tutor');
  var panel = document.createElement('aside');
  panel.className = 'tutor-panel'; panel.hidden = true; panel.setAttribute('aria-label', 'AI tutor');
  panel.innerHTML =
    '<header class="tutor-head">' +
      '<span class="tutor-avatar">' + icon('sparkles') + '</span>' +
      '<div class="tutor-title"><strong>' + esc(CFG.name || 'AI Tutor') + '</strong><span class="tutor-sub" data-t-sub></span></div>' +
      '<button class="icon-btn sm" data-t-settings aria-label="Tutor settings" title="Settings">' + icon('tune') + '</button>' +
      '<button class="icon-btn sm" data-t-clear aria-label="Clear conversation" title="Clear conversation">' + icon('refresh') + '</button>' +
      '<button class="icon-btn sm" data-t-close aria-label="Close tutor">' + icon('x') + '</button>' +
    '</header>' +
    '<div class="tutor-context" data-t-context></div>' +
    '<div class="tutor-body" data-t-body></div>' +
    '<div class="tutor-quick" data-t-quick></div>' +
    '<form class="tutor-form" data-t-form>' +
      '<textarea rows="1" placeholder="Ask anything about this lesson…" data-t-input></textarea>' +
      '<button class="tutor-send" type="submit" aria-label="Send" data-t-send>' + icon('arrow-right') + '</button>' +
    '</form>' +
    '<div class="tutor-foot">AI answers can be wrong. Check them against the lesson.</div>';
  document.body.appendChild(fab);
  document.body.appendChild(panel);
  var body = $('[data-t-body]', panel), input = $('[data-t-input]', panel), ctxEl = $('[data-t-context]', panel);

  $('[data-t-sub]', panel).textContent = (CFG.model_label || CFG.model || '') + (CFG.provider ? ' · ' + CFG.provider : '');
  fab.addEventListener('click', function () { toggle(true); });
  $('[data-t-close]', panel).addEventListener('click', function () { toggle(false); });
  $('[data-t-clear]', panel).addEventListener('click', function () { if (controller) controller.abort(); history = []; sessionSet(chatKey, history); render(); });
  $('[data-t-settings]', panel).addEventListener('click', function () { showSettings(); });
  $('[data-t-form]', panel).addEventListener('submit', function (e) { e.preventDefault(); send(input.value); });
  input.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(input.value); } });
  input.addEventListener('input', autosize);
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) toggle(false); });

  function autosize() { input.style.height = 'auto'; input.style.height = Math.min(160, input.scrollHeight) + 'px'; }
  function toggle(open) {
    panel.hidden = !open; fab.hidden = open; document.body.classList.toggle('tutor-open', open);
    if (open) { loadLibs(function () { render(); }); updateContext(); setTimeout(function () { input.focus(); }, 30); }
  }

  var QUICK = [
    { label: 'Explain this section simply', prompt: 'Explain the section I am reading in simple terms, step by step, with a small concrete example.' },
    { label: 'Give me an analogy', prompt: 'Give me an intuitive analogy for the main idea of the section I am reading, then say where the analogy breaks down.' },
    { label: 'Quiz me', prompt: 'Ask me 3 short questions (one at a time is fine) to check I understood the section I am reading. Wait for my answers before revealing solutions.' },
    { label: 'Summarise the lesson', prompt: 'Summarise this whole lesson in 5 bullet points, then list the 3 ideas I must not forget.' }
  ];
  function renderQuick() {
    var q = $('[data-t-quick]', panel);
    q.innerHTML = '';
    if (history.length > 2) return;
    QUICK.forEach(function (it) {
      var b = document.createElement('button'); b.type = 'button'; b.className = 'chip-btn'; b.textContent = it.label;
      b.addEventListener('click', function () { send(it.prompt, { display: it.label }); });
      q.appendChild(b);
    });
  }

  /* ------------------------------------------------------------ context */
  function currentSection() {
    var secs = $$('[data-section], #start'), line = window.innerHeight * 0.4, cur = null;
    secs.forEach(function (s) { if (s.getBoundingClientRect().top < line) cur = s; });
    return cur || secs[0] || null;
  }
  function sectionInfo() {
    var s = currentSection();
    if (!s) return null;
    var h = s.id === 'start' ? null : $('h2', s);
    var clone = s.cloneNode(true);
    $$('.widget, .code-cell pre, .qactions, textarea, script, .qanswer', clone).forEach(function (n) { n.remove(); });
    var text = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    var num = $('.sec-num', s);
    return { id: s.id, title: h ? h.textContent.trim() : 'Before you start', num: num ? num.textContent.trim() : '', text: text.slice(0, 9000) };
  }
  function updateContext() {
    var si = sectionInfo();
    ctxEl.innerHTML = lesson
      ? icon('book') + ' <span>Lesson ' + esc(lesson.id) + (si ? ' · ' + esc(si.num ? '§' + si.num + ' ' : '') + esc(si.title) : '') + '</span>'
      : icon('book') + ' <span>General course questions</span>';
  }
  window.addEventListener('scroll', function () { if (!panel.hidden) updateContext(); }, { passive: true });

  function systemPrompt(extra) {
    var p = [
      'You are the friendly, precise AI tutor of the course "' + (CFG.course || 'Modern Deep Learning & AI Engineering') + '".',
      'Learners already know Python, data science and classical machine learning; this course teaches deep learning engineering with PyTorch.',
      'How to teach: plain English first, then the precise term; short paragraphs; concrete numbers and tiny examples; PyTorch for code; LaTeX between $...$ for maths.',
      'Keep answers focused (usually under 250 words) unless the learner asks for more. Use markdown. End with a quick check question when it helps learning.',
      'Ground your answers in the lesson context below. Do not invent results that the lesson does not show; if something is uncertain, say so.',
      'If asked something outside the course, answer briefly and connect it back to deep learning.',
      'When checking a learner\'s answer: say what is right, what is missing or wrong, and give a hint toward the reference answer rather than simply pasting it.'
    ].join('\n');
    if (lesson) {
      p += '\n\n# Current lesson\nModule ' + lesson.module + ': ' + lesson.module_title + '\nLesson ' + lesson.id + ': ' + lesson.title;
      if (lesson.summary) p += '\nSummary: ' + lesson.summary;
      if (lesson.objectives && lesson.objectives.length) p += '\nObjectives:\n- ' + lesson.objectives.join('\n- ');
    }
    var si = sectionInfo();
    if (si && si.text) p += '\n\n# Section the learner is reading: ' + (si.num ? si.num + '. ' : '') + si.title + '\n' + si.text;
    if (extra) p += '\n\n' + extra;
    return p;
  }

  /* ------------------------------------------------------------ talking to the model */
  function send(text, opts) {
    opts = opts || {};
    text = (text || '').trim();
    if (!text || busy) return;
    if (!connected()) { showSettings(true); return; }
    input.value = ''; autosize();
    history.push({ role: 'user', content: text, display: opts.display || null });
    var reply = { role: 'assistant', content: '' };
    history.push(reply);
    render();
    busy = true; setBusy(true);
    var messages = [{ role: 'system', content: systemPrompt(opts.extra) }].concat(
      history.slice(0, -1).slice(-12).map(function (m) { return { role: m.role, content: m.content }; }));
    stream(messages, function (delta) { reply.content += delta; renderLast(); },
      function (err) {
        busy = false; setBusy(false);
        if (err) reply.content += (reply.content ? '\n\n' : '') + '⚠️ ' + err;
        if (!reply.content) reply.content = '⚠️ No answer came back. Please try again.';
        sessionSet(chatKey, history); render();
      });
  }

  function stream(messages, onDelta, onDone) {
    controller = window.AbortController ? new AbortController() : null;
    var url, headers = { 'Content-Type': 'application/json' }, payload;
    if (CFG.endpoint) {
      url = CFG.endpoint;
      payload = { messages: messages, lesson: lesson ? lesson.id : null };
    } else {
      url = GROQ_URL;
      headers.Authorization = 'Bearer ' + personalKey();
      payload = { model: CFG.model, messages: messages, stream: true, temperature: 0.4, max_completion_tokens: 1400 };
      if (CFG.reasoning_effort) { payload.reasoning_effort = CFG.reasoning_effort; payload.reasoning_format = 'hidden'; }
    }
    fetch(url, { method: 'POST', headers: headers, body: JSON.stringify(payload), signal: controller ? controller.signal : undefined })
      .then(function (res) {
        if (!res.ok) return res.text().then(function (t) { throw new Error(explain(res.status, t)); });
        var reader = res.body.getReader(), dec = new TextDecoder(), buf = '';
        function pump() {
          return reader.read().then(function (r) {
            if (r.done) { onDone(); return; }
            buf += dec.decode(r.value, { stream: true });
            var lines = buf.split('\n'); buf = lines.pop();
            lines.forEach(function (line) {
              line = line.trim();
              if (!line.startsWith('data:')) return;
              var data = line.slice(5).trim();
              if (data === '[DONE]') return;
              try {
                var j = JSON.parse(data), d = j.choices && j.choices[0] && j.choices[0].delta;
                if (d && d.content) onDelta(d.content);
                if (j.error) onDelta('\n\n⚠️ ' + (j.error.message || 'error'));
              } catch (e) { /* partial line */ }
            });
            return pump();
          });
        }
        return pump();
      })
      .catch(function (e) { onDone(e.name === 'AbortError' ? 'Stopped.' : (e.message || 'Could not reach the tutor.')); });
  }
  function explain(status, text) {
    var msg = '';
    try { msg = JSON.parse(text).error.message; } catch (e) { msg = text.slice(0, 200); }
    if (status === 401) return 'The API key was rejected (401). Check it in the tutor settings.';
    if (status === 429) return 'The tutor is busy (rate limit reached). Wait a minute and try again.';
    if (status === 403) return 'This site is not allowed to use the tutor service (403).';
    return 'Tutor error ' + status + (msg ? ': ' + msg : '');
  }
  function setBusy(b) {
    var btn = $('[data-t-send]', panel);
    btn.innerHTML = b ? icon('pause') : icon('arrow-right');
    btn.setAttribute('aria-label', b ? 'Stop' : 'Send');
    btn.onclick = b ? function (e) { e.preventDefault(); if (controller) controller.abort(); } : null;
  }

  /* ------------------------------------------------------------ rendering */
  function loadLibs(cb) {
    if (libsReady || (window.marked && window.DOMPurify)) { libsReady = true; return cb(); }
    var n = 0;
    function done() { if (++n === 2) { libsReady = true; cb(); } }
    ['https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js', 'https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js'].forEach(function (src) {
      var s = document.createElement('script'); s.src = src; s.onload = done; s.onerror = done; document.head.appendChild(s);
    });
  }
  function md(text) {
    var maths = [];
    var safe = text.replace(/\$\$([\s\S]+?)\$\$/g, function (_, t) { maths.push([t, true]); return 'MATHQ' + (maths.length - 1) + 'Z'; })
      .replace(/\$([^\s$][^$\n]*?[^\s\\$])\$|\$([^\s$])\$/g, function (_, t, t2) { maths.push([t || t2, false]); return 'MATHQ' + (maths.length - 1) + 'Z'; });
    var html = window.marked ? window.marked.parse(safe, { breaks: true }) : '<p>' + esc(safe).replace(/\n/g, '<br>') + '</p>';
    if (window.DOMPurify) html = window.DOMPurify.sanitize(html);
    return html.replace(/MATHQ(\d+)Z/g, function (_, i) {
      var m = maths[+i];
      if (window.katex) { try { return window.katex.renderToString(m[0], { displayMode: m[1], throwOnError: false }); } catch (e) {} }
      return esc(m[0]);
    });
  }
  function bubble(m, i) {
    var div = document.createElement('div');
    div.className = 'tmsg tmsg-' + m.role;
    if (m.role === 'user') div.innerHTML = '<div class="tmsg-text">' + esc(m.display || m.content) + '</div>';
    else div.innerHTML = '<div class="tmsg-text prose">' + (m.content ? md(m.content) : '<span class="tutor-typing"><i></i><i></i><i></i></span>') + '</div>';
    div.setAttribute('data-i', i);
    return div;
  }
  function render() {
    body.innerHTML = '';
    if (!history.length) {
      var hello = document.createElement('div');
      hello.className = 'tutor-hello';
      hello.innerHTML = connected()
        ? '<p><strong>Hi! I\'m your tutor for this course.</strong></p><p>I can see the lesson and the section you\'re reading. Ask me anything, or start with one of the suggestions below.</p><p class="muted">Tip: select any text in the lesson and press <em>Ask tutor</em>. Question cards also have an <em>Ask the tutor</em> button that can check your written answer.</p>'
        : notConnectedHtml();
      body.appendChild(hello);
      wireKeyForm(hello);
    }
    history.forEach(function (m, i) { body.appendChild(bubble(m, i)); });
    renderQuick();
    body.scrollTop = body.scrollHeight;
  }
  function renderLast() {
    var last = body.lastElementChild;
    if (!last) return render();
    var m = history[history.length - 1];
    $('.tmsg-text', last).innerHTML = md(m.content);
    body.scrollTop = body.scrollHeight;
  }
  function notConnectedHtml() {
    return '<p><strong>The tutor isn\'t connected yet.</strong></p>' +
      '<p>You can use it right now with your own free Groq API key. It is stored only in this browser and sent only to Groq.</p>' +
      keyFormHtml() +
      '<p class="muted">Get a key at <a href="https://console.groq.com/keys" target="_blank" rel="noopener">console.groq.com/keys</a>.</p>';
  }
  function keyFormHtml() {
    return '<form class="tutor-keyform" data-t-keyform><input type="password" autocomplete="off" placeholder="gsk_…" value="' + esc(personalKey()) + '" aria-label="Groq API key">' +
      '<button class="btn btn-sm" type="submit">Save</button>' + (personalKey() ? '<button class="btn btn-sm btn-ghost" type="button" data-t-forget>Remove</button>' : '') + '</form>';
  }
  function wireKeyForm(root) {
    var f = $('[data-t-keyform]', root);
    if (!f) return;
    f.addEventListener('submit', function (e) { e.preventDefault(); store.set('tutor:key', $('input', f).value.trim()); render(); });
    var forget = $('[data-t-forget]', f);
    if (forget) forget.addEventListener('click', function () { store.set('tutor:key', ''); render(); });
  }
  function showSettings(needKey) {
    var box = document.createElement('div');
    box.className = 'tutor-hello';
    box.innerHTML = (CFG.endpoint
      ? '<p><strong>Connected to the course tutor</strong> (' + esc(CFG.model_label || CFG.model) + ' on ' + esc(CFG.provider || 'Groq') + ').</p><p>You can optionally use your own Groq key instead; the course connection is used whenever it is available.</p>'
      : (needKey ? '<p><strong>Add a key to start chatting.</strong></p>' : '<p><strong>Tutor settings</strong></p>') +
        '<p>Paste your own free Groq API key. It is stored only in this browser and sent only to Groq.</p>') +
      keyFormHtml() + '<p class="muted">Model: <code>' + esc(CFG.model) + '</code></p>';
    body.appendChild(box); wireKeyForm(box); body.scrollTop = body.scrollHeight;
  }

  /* ------------------------------------------------------------ entry points in the lesson */
  // 1. "Ask the tutor" on question cards: check the learner's answer or give a hint
  $$('.qitem').forEach(function (item) {
    var actions = $('.qactions', item);
    if (!actions) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip-btn tutor-chip'; b.innerHTML = icon('sparkles') + ' Ask the tutor';
    b.addEventListener('click', function () {
      var q = ($('.qtext', item).innerText || '').trim();
      var mine = ($('.qnote', item) || {}).value || '';
      var ref = $('.qanswer-body', item) ? $('.qanswer-body', item).innerText.trim() : '';
      var extra = '# The question\n' + q + (ref ? '\n\n# Reference answer from the course (do not paste it verbatim)\n' + ref : '');
      toggle(true);
      if (mine.trim()) send('Here is my answer to this question. Please check it and help me improve it:\n\n"' + q + '"\n\nMy answer: ' + mine.trim(), { extra: extra, display: 'Check my answer: “' + q.slice(0, 90) + (q.length > 90 ? '…' : '') + '”' });
      else send('Give me a hint (not the full answer) for this question: "' + q + '"', { extra: extra, display: 'Hint please: “' + q.slice(0, 90) + (q.length > 90 ? '…' : '') + '”' });
    });
    actions.appendChild(b);
  });
  // 2. "Explain" on code cells
  $$('[data-code]').forEach(function (cell) {
    var acts = $('.code-actions', cell);
    if (!acts) return;
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'chip-btn accent tutor-chip'; b.innerHTML = icon('sparkles') + ' <span>Tutor</span>';
    b.title = 'Ask the tutor to explain this code';
    b.addEventListener('click', function () {
      var src = ($('.code-src', cell) || {}).value || '';
      var out = $$('.out-text', cell).map(function (o) { return o.textContent; }).join('\n').slice(0, 2500);
      toggle(true);
      send('Explain this code line by line, then explain what its output shows:\n\n```python\n' + src.slice(0, 5000) + '\n```' + (out ? '\n\nOutput:\n```\n' + out + '\n```' : ''), { display: 'Explain this code cell' });
    });
    acts.insertBefore(b, acts.firstChild);
  });
  // 3. Select text → "Ask tutor"
  var selBtn = document.createElement('button');
  selBtn.type = 'button'; selBtn.className = 'tutor-select'; selBtn.hidden = true;
  selBtn.innerHTML = icon('sparkles') + ' Ask tutor';
  document.body.appendChild(selBtn);
  var selText = '';
  document.addEventListener('mouseup', function (e) {
    if (panel.contains(e.target) || e.target === selBtn) return;
    setTimeout(function () {
      var sel = window.getSelection(), t = sel ? sel.toString().trim() : '';
      if (!t || t.length < 3 || !sel.rangeCount || !$('[data-gloss-root]') || !$('[data-gloss-root]').contains(sel.anchorNode)) { selBtn.hidden = true; return; }
      var r = sel.getRangeAt(0).getBoundingClientRect();
      selText = t.slice(0, 1200);
      selBtn.style.left = Math.min(window.innerWidth - 130, Math.max(8, r.left + r.width / 2 - 55)) + 'px';
      selBtn.style.top = Math.max(70, r.top - 42) + 'px';
      selBtn.hidden = false;
    }, 10);
  });
  selBtn.addEventListener('click', function () {
    selBtn.hidden = true; toggle(true);
    send('Explain this passage from the lesson in simpler terms, with an example:\n\n"' + selText + '"', { display: 'Explain: “' + selText.slice(0, 100) + (selText.length > 100 ? '…' : '') + '”' });
  });
  window.addEventListener('scroll', function () { selBtn.hidden = true; }, { passive: true });

  window.DLP = window.DLP || {};
  window.DLP.tutor = { open: function () { toggle(true); }, ask: function (q, o) { toggle(true); send(q, o); } };
})();
