/* AI tutor — a context-aware chat panel backed by Qwen on Groq.
   Two ways to connect:
     1. Personal key  : a learner pastes their own Groq key; it is stored only in this browser
                        and sent only to api.groq.com. When one is saved it is always used, so keen
                        learners stay off the course key's shared rate limit.
     2. Course proxy  (course.yaml → tutor.endpoint): the API key lives on the server, never in this page.
                        Used by everyone who has not saved a key of their own.
   The tutor always receives the current lesson, the section being read, an outline of the whole
   course (static/course-map.js, written by the build) and, for any other lesson or module the learner
   mentions ("Module 2", "Lesson 3.4", "day 4"), that lesson's summary, objectives and sections.
   From a question card it also gets the question, the learner's answer and the reference answer. */
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
  var pageModule = lesson ? lesson.module : (function () { var el = document.getElementById('dlp-module-ctx'); try { return el ? JSON.parse(el.textContent).module : null; } catch (e) { return null; } })();
  var chatKey = 'tutor:chat:' + (lesson ? lesson.id : pageModule ? 'module-' + pageModule : 'general');
  var selfSrc = (document.currentScript && document.currentScript.src) || ($('script[src*="static/js/tutor.js"]') || {}).src || '';
  var siteRoot = selfSrc.replace(/static\/js\/tutor\.js.*$/, ''), assetVersion = (selfSrc.match(/\?v=[^&#]*/) || [''])[0];
  var history = sessionGet(chatKey, []);
  var busy = false, controller = null, libsReady = false;

  function sessionGet(k, d) { try { var v = sessionStorage.getItem('dlp:' + k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function sessionSet(k, v) { try { sessionStorage.setItem('dlp:' + k, JSON.stringify(v)); } catch (e) {} }
  function personalKey() { return store.get('tutor:key', ''); }
  function connected() { return !!CFG.endpoint || !!personalKey(); }
  function usingOwnKey() { return !!personalKey(); }                // a saved key wins over the course proxy
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
  // The top bar carries the launcher, so nothing floats over the page. Pages without one fall back to the floating button.
  var launchers = $$('[data-tutor-open]');
  if (!launchers.length) document.body.appendChild(fab);
  document.body.appendChild(panel);
  var body = $('[data-t-body]', panel), input = $('[data-t-input]', panel), ctxEl = $('[data-t-context]', panel);

  $('[data-t-sub]', panel).textContent = (CFG.model_label || CFG.model || '') + (CFG.provider ? ' · ' + CFG.provider : '');
  fab.addEventListener('click', function () { toggle(true); });
  launchers.forEach(function (b) { b.setAttribute('aria-expanded', 'false'); b.addEventListener('click', function () { toggle(panel.hidden); }); });
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
    launchers.forEach(function (b) { b.setAttribute('aria-expanded', open ? 'true' : 'false'); b.classList.toggle('is-on', open); });
    if (!open && launchers[0] && panel.contains(document.activeElement)) launchers[0].focus();
    if (open) { loadLibs(function () { render(); }); loadCourse(function () {}); updateContext(); setTimeout(function () { input.focus(); }, 30); }
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
  function sectionInfo(limit) {
    var s = currentSection();
    if (!s) return null;
    var h = s.id === 'start' ? null : $('h2', s);
    var clone = s.cloneNode(true);
    $$('.widget, .code-cell pre, .qactions, textarea, script, .qanswer', clone).forEach(function (n) { n.remove(); });
    var text = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim();
    var num = $('.sec-num', s);
    return { id: s.id, title: h ? h.textContent.trim() : 'Before you start', num: num ? num.textContent.trim() : '', text: text.slice(0, limit || 9000) };
  }
  function updateContext() {
    var si = sectionInfo();
    ctxEl.innerHTML = lesson
      ? icon('book') + ' <span>Lesson ' + esc(lesson.id) + (si ? ' · ' + esc(si.num ? '§' + si.num + ' ' : '') + esc(si.title) : '') + '</span>'
      : icon('book') + ' <span>' + (pageModule ? 'Module ' + esc(pageModule) + ' overview' : 'General course questions') + '</span>';
  }
  window.addEventListener('scroll', function () { if (!panel.hidden) updateContext(); }, { passive: true });

  /* ------------------------------------------------------------ the rest of the course */
  var courseWaiters = null;
  function loadCourse(cb) {
    if (window.DLP_COURSE || !siteRoot) return cb();
    if (courseWaiters) { courseWaiters.push(cb); return; }
    courseWaiters = [cb];
    var s = document.createElement('script');
    s.src = siteRoot + 'static/course-map.js' + assetVersion;
    s.onload = s.onerror = function () { var w = courseWaiters; courseWaiters = null; w.forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  }
  var NUMBER_WORDS = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10,
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7, eighth: 8, ninth: 9, tenth: 10 };
  function findLesson(id) {
    var found = null;
    (window.DLP_COURSE ? window.DLP_COURSE.modules : []).forEach(function (m) { m.lessons.forEach(function (l) { if (l.id === id) found = l; }); });
    return found;
  }
  function findModule(n) {
    return (window.DLP_COURSE ? window.DLP_COURSE.modules : []).filter(function (m) { return m.number === n; })[0] || null;
  }
  // Modules and lessons named in the learner's recent messages: "Module 2", "day four", "Lesson 3.4", "note 4.2", "2.3".
  function mentioned(texts) {
    var mods = [], ids = [], text = texts.join('\n').toLowerCase(), m;
    var modRe = /\b(?:module|day)s?\s+(?:no\.?\s*)?(\d{1,2}|[a-z]+)\b/g;
    while ((m = modRe.exec(text))) {
      var n = /^\d+$/.test(m[1]) ? +m[1] : NUMBER_WORDS[m[1]];
      if (n && findModule(n) && mods.indexOf(n) < 0) mods.push(n);
    }
    var idRe = /(^|[^\d.])(\d{1,2})\.(\d{1,2})(?![\d.])/g;
    while ((m = idRe.exec(text))) {
      var id = +m[2] + '.' + +m[3];
      if (findLesson(id) && ids.indexOf(id) < 0) ids.push(id);
    }
    return { modules: mods, lessons: ids };
  }
  function lessonNotes(l) {
    var t = '### Lesson ' + l.id + ': ' + l.title + ' (' + siteRoot + l.url + ')';
    if (l.summary) t += '\nSummary: ' + l.summary.slice(0, 900);
    if (l.objectives && l.objectives.length) t += '\nObjectives: ' + l.objectives.map(function (o) { return o.replace(/[;.,\s]+$/, ''); }).join('; ').slice(0, 700);
    if (l.sections && l.sections.length) t += '\nSections: ' + l.sections.map(function (x, i) { return (i + 1) + '. ' + x; }).join('; ').slice(0, 600);
    return t;
  }
  function courseOutline() {
    if (!window.DLP_COURSE) return '';
    return '# Course outline: every module and lesson on this site\n' + window.DLP_COURSE.modules.map(function (m) {
      if (!m.available) return 'Module ' + m.number + ': ' + m.title + ' (not published on the site yet)';
      return 'Module ' + m.number + ': ' + m.title + '\n' + m.lessons.map(function (l) {
        return '  ' + l.id + ' ' + l.title + ' (' + siteRoot + l.url + ')' + (lesson && lesson.id === l.id ? '  <- the learner is reading this lesson' : '');
      }).join('\n');
    }).join('\n');
  }
  function mentionedNotes(texts) {
    if (!window.DLP_COURSE) return '';
    var ref = mentioned(texts), parts = [], used = {};
    if (!lesson && pageModule && ref.modules.indexOf(pageModule) < 0) ref.modules.unshift(pageModule);
    ref.modules.forEach(function (n) {
      var m = findModule(n);
      if (!m.available) { parts.push('## Module ' + n + ': ' + m.title + '\nNot published on the site yet; only its title is known.'); return; }
      parts.push('## Module ' + n + ': ' + m.title + '\n' + m.lessons.map(function (l) { used[l.id] = true; return lessonNotes(l); }).join('\n\n'));
    });
    ref.lessons.forEach(function (id) {
      if (used[id] || (lesson && lesson.id === id)) return;
      parts.push(lessonNotes(findLesson(id)));
    });
    var text = parts.join('\n\n');
    return text ? '# Notes on the parts of the course the learner mentioned\n' + text.slice(0, 9000) : '';
  }

  function systemPrompt(extra, texts) {
    var p = [
      'You are the friendly, precise AI tutor of the course "' + (CFG.course || 'Modern Deep Learning & AI Engineering') + '".',
      'Learners already know Python, data science and classical machine learning; this course teaches deep learning engineering with PyTorch.',
      'How to teach: plain English first, then the precise term; short paragraphs; concrete numbers and tiny examples; PyTorch for code; LaTeX between $...$ for maths.',
      'Keep answers focused (usually under 250 words) unless the learner asks for more. Use markdown. End with a quick check question when it helps learning.',
      'Ground your answers in the lesson context below. Do not invent results that the lesson does not show; if something is uncertain, say so.',
      'You can also see an outline of the whole course, and notes on any other module or lesson the learner mentions. Use them for questions about other parts of the course: say which lesson covers the topic, summarise it from the notes, and link to it. Never tell the learner you cannot see other modules or lessons. If they need more detail than the notes give, say so and suggest opening that lesson, where you will see its full text. For a module marked as not published yet, say only what its title tells you.',
      'If asked something outside the course, answer briefly and connect it back to deep learning.',
      'When checking a learner\'s answer: say what is right, what is missing or wrong, and give a hint toward the reference answer rather than simply pasting it.'
    ].join('\n');
    if (lesson) {
      p += '\n\n# Current lesson\nModule ' + lesson.module + ': ' + lesson.module_title + '\nLesson ' + lesson.id + ': ' + lesson.title;
      if (lesson.summary) p += '\nSummary: ' + lesson.summary;
      if (lesson.objectives && lesson.objectives.length) p += '\nObjectives:\n- ' + lesson.objectives.join('\n- ');
    }
    else if (pageModule) p += '\n\n# The learner is on the overview page of Module ' + pageModule + '.';
    var outline = courseOutline(), notes = mentionedNotes(texts || []);
    if (outline) p += '\n\n' + outline;
    if (notes) p += '\n\n' + notes;
    var si = lesson ? sectionInfo(notes ? 3500 : 9000) : null;
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
    var recent = history.filter(function (m) { return m.role === 'user'; }).slice(-3).map(function (m) { return m.content; });
    loadCourse(function () {
    var messages = [{ role: 'system', content: systemPrompt(opts.extra, recent) }].concat(
      history.slice(0, -1).slice(-12).map(function (m) { return { role: m.role, content: m.content }; }));
    stream(messages, function (delta) { reply.content += delta; renderLast(); },
      function (err) {
        busy = false; setBusy(false);
        if (err) reply.content += (reply.content ? '\n\n' : '') + '⚠️ ' + err;
        if (!reply.content) reply.content = '⚠️ No answer came back. Please try again.';
        sessionSet(chatKey, history); render();
      });
    });
  }

  function stream(messages, onDelta, onDone) {
    controller = window.AbortController ? new AbortController() : null;
    var url, headers = { 'Content-Type': 'application/json' }, payload;
    var own = usingOwnKey();
    if (!own) {
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
        if (!res.ok) return res.text().then(function (t) { throw new Error(explain(res.status, t, own)); });
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
  function explain(status, text, own) {
    var msg = '';
    try { msg = JSON.parse(text).error.message; } catch (e) { msg = text.slice(0, 200); }
    if (status === 401) return own ? 'Your Groq key was rejected (401). Check it in the tutor settings, or remove it' + (CFG.endpoint ? ' to use the course connection.' : '.') : 'The course tutor could not authenticate (401).';
    if (status === 429) return own ? 'Your Groq key has reached its rate limit. Wait a minute and try again.' : 'The tutor is busy (rate limit reached). Wait a minute and try again.';
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
    // Pinned versions with Subresource Integrity: the browser refuses a file whose bytes differ from these hashes,
    // so a tampered CDN copy cannot run on the page (and read a learner's saved key). Update both together.
    [['https://cdn.jsdelivr.net/npm/marked@12.0.2/marked.min.js', 'sha384-/TQbtLCAerC3jgaim+N78RZSDYV7ryeoBCVqTuzRrFec2akfBkHS7ACQ3PQhvMVi'],
     ['https://cdn.jsdelivr.net/npm/dompurify@3.1.6/dist/purify.min.js', 'sha384-+VfUPEb0PdtChMwmBcBmykRMDd+v6D/oFmB3rZM/puCMDYcIvF968OimRh4KQY9a']].forEach(function (lib) {
      var s = document.createElement('script');
      s.src = lib[0]; s.integrity = lib[1]; s.crossOrigin = 'anonymous';
      s.onload = done; s.onerror = done; document.head.appendChild(s);
    });
  }
  function md(text) {
    var maths = [];
    var safe = text.replace(/\$\$([\s\S]+?)\$\$/g, function (_, t) { maths.push([t, true]); return 'MATHQ' + (maths.length - 1) + 'Z'; })
      .replace(/\$([^\s$][^$\n]*?[^\s\\$])\$|\$([^\s$])\$/g, function (_, t, t2) { maths.push([t || t2, false]); return 'MATHQ' + (maths.length - 1) + 'Z'; });
    // Markdown only when the sanitiser loaded too; otherwise plain escaped text, never unsanitised HTML.
    var html = window.marked && window.DOMPurify ? window.DOMPurify.sanitize(window.marked.parse(safe, { breaks: true }))
      : '<p>' + esc(safe).replace(/\n/g, '<br>') + '</p>';
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
        ? '<p><strong>Hi! I\'m your tutor for this course.</strong></p><p>I can see ' + (lesson ? 'the lesson and the section you\'re reading, plus ' : '') + 'an outline of the whole course. Ask me anything, including about other modules and lessons, or start with one of the suggestions below.</p><p class="muted">Tip: select any text in the lesson and press <em>Ask tutor</em>. Question cards also have an <em>Ask the tutor</em> button that can check your written answer.</p>'
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
      ? (usingOwnKey()
        ? '<p><strong>Using your own Groq key</strong> (' + esc(CFG.model_label || CFG.model) + ').</p><p>Remove it to go back to the course connection.</p>'
        : '<p><strong>Connected to the course tutor</strong> (' + esc(CFG.model_label || CFG.model) + ' on ' + esc(CFG.provider || 'Groq') + ').</p><p>Optional: save your own free Groq key and it will be used instead, so you are not sharing the course\'s rate limit. It is stored only in this browser and sent only to Groq.</p>')
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

  /* ------------------------------------------------------------ grading "explain it back" answers */
  // Streams feedback on a learner's short explanation, judged against the course's key points.
  // onDelta(textSoFar); onDone(err, verdict: 'solid'|'partly'|'notyet', text).
  function grade(o, onDelta, onDone) {
    if (!connected()) return onDone('not-connected');
    loadLibs(function () {
      var sec = o.section, h = sec ? $('h2', sec) : null, text = '';
      if (sec) {
        var clone = sec.cloneNode(true);
        $$('.widget, .code-cell pre, .qactions, textarea, script, .qanswer, .checkpoint', clone).forEach(function (n) { n.remove(); });
        text = (clone.innerText || clone.textContent || '').replace(/\n{3,}/g, '\n\n').trim().slice(0, 7000);
      }
      var sys = [
        'You are checking a learner\'s short "explain it back" answer in the course "' + (CFG.course || 'Deep Learning Lab') + '".',
        'Judge it against the key points below. Be warm, specific and brief (at most 90 words).',
        'Reply in exactly this shape:',
        'VERDICT: solid | partly | not yet   (one of these three, on the first line)',
        'Then: one sentence on what is right; one on what is missing or wrong (if anything); one hint that moves them toward the missing idea.',
        'Do not paste the key points. Do not ask a follow-up question. Use $...$ for maths.',
        '"solid" = the main idea is right and nothing important is wrong, even if worded differently or briefer. "partly" = on the way but a key idea is missing or muddled. "not yet" = the main idea is missing or wrong.',
        lesson ? '\n# Lesson ' + lesson.id + ': ' + lesson.title : '',
        h ? '# Section: ' + h.textContent.trim() + '\n' + text : '',
        '\n# The prompt the learner answered\n' + (o.prompt || ''),
        '\n# Key points (reference, do not paste)\n' + (o.key || '')
      ].join('\n');
      var out = '';
      stream([{ role: 'system', content: sys }, { role: 'user', content: 'My explanation: ' + o.answer }],
        function (d) { out += d; onDelta(out); },
        function (err) {
          if (err && !out) return onDone(err);
          var m = /VERDICT:\s*(solid|partly|not\s*yet)/i.exec(out), v = m ? m[1].toLowerCase().replace(/\s+/g, '') : 'partly';
          onDone(null, v, out);
        });
    });
  }

  window.DLP = window.DLP || {};
  window.DLP.tutor = { open: function () { toggle(true); }, ask: function (q, o) { toggle(true); send(q, o); },
    grade: grade, render: function (t) { return md(t); }, connected: connected };
})();
