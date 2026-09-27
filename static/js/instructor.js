/* Instructor view: the anonymous answer counts kept by the course API (GET /api/stats), joined with the
   question bank and the course map so every row shows its question and lesson. Needs the STATS_TOKEN that
   was set on the Worker (`npx wrangler secret put STATS_TOKEN`); the token is kept only in this browser. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var page = $('[data-instructor]');
  if (!page) return;
  var API = (page.getAttribute('data-api') || '').replace(/\/$/, ''), ROOT = document.body.getAttribute('data-root') || '', store = window.DLP.store;
  var out = $('[data-in-out]'), tokenIn = $('[data-in-token]');
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function load(src, test, cb) { if (test()) return cb(); var s = document.createElement('script'); s.src = ROOT + src; s.onload = cb; document.head.appendChild(s); }
  function pct(r, w) { return r + w ? Math.round(100 * r / (r + w)) + '%' : '—'; }
  function strip(html) { var d = document.createElement('div'); d.innerHTML = html || ''; return d.textContent.trim(); }
  tokenIn.value = store.get('instructor:token', '');
  $('[data-in-form]').addEventListener('submit', function (e) { e.preventDefault(); store.set('instructor:token', tokenIn.value.trim()); fetchStats(); });
  function fetchStats() {
    if (!API) { out.innerHTML = '<p>No course API is configured (course.yaml → services.api).</p>'; return; }
    out.innerHTML = '<p class="muted">Loading…</p>';
    fetch(API + '/api/stats', { headers: { Authorization: 'Bearer ' + tokenIn.value.trim() } })
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || r.status); return j; }); })
      .then(function (data) {
        load('static/question-bank.js', function () { return window.DLP_BANK; }, function () {
          load('static/course-map.js', function () { return window.DLP_COURSE; }, function () { render(data); });
        });
      }).catch(function (err) { out.innerHTML = '<p class="in-error">' + esc(err.message) + '</p>'; });
  }
  function render(data) {
    var bank = {}; (window.DLP_BANK || []).forEach(function (q) { bank[q.id] = q; });
    var lessons = {}; window.DLP_COURSE.modules.forEach(function (m) { m.lessons.forEach(function (l) { lessons[l.id] = l; }); });
    var rows = data.stats || [], byLesson = {}, labs = [], explains = [], questions = [], total = 0;
    rows.forEach(function (r) {
      var n = r.right + r.wrong; total += n;
      var kind = r.qid.split(':')[0], lid = r.qid.split(':')[1];
      if (kind === 'lab') { labs.push({ name: r.qid.slice(4), n: r.right }); return; }
      if (kind === 'e') { explains.push(r); }
      if (kind === 'c' || kind === 'q') questions.push(r);
      if (lessons[lid]) {
        var b = byLesson[lid] = byLesson[lid] || { cpR: 0, cpW: 0, qR: 0, qW: 0, eR: 0, eW: 0 };
        if (kind === 'c') { b.cpR += r.right; b.cpW += r.wrong; }
        if (kind === 'q') { b.qR += r.right; b.qW += r.wrong; }
        if (kind === 'e') { b.eR += r.right; b.eW += r.wrong; }
      }
    });
    var minN = 5;
    var hardest = questions.filter(function (r) { return r.right + r.wrong >= minN && bank[r.qid]; })
      .sort(function (a, b) { return a.right / (a.right + a.wrong) - b.right / (b.right + b.wrong); }).slice(0, 15);
    var modQ = rows.filter(function (r) { return /^m:/.test(r.qid); });
    labs.sort(function (a, b) { return b.n - a.n; });
    out.innerHTML =
      '<div class="rv-stats"><div class="rv-stat"><strong>' + total + '</strong><span>answers recorded</span></div><div class="rv-stat"><strong>' + data.synced_learners + '</strong><span>learners using sync</span></div><div class="rv-stat"><strong>' + data.certificates + '</strong><span>certificates issued</span></div></div>' +
      '<h2>By lesson</h2><div class="table-wrap"><table class="pg-table"><thead><tr><th>Lesson</th><th>Checkpoint answers</th><th>% right</th><th>Quiz answers</th><th>% right</th><th>"Explain it back" solid</th></tr></thead><tbody>' +
      Object.keys(lessons).map(function (id) { var b = byLesson[id] || { cpR: 0, cpW: 0, qR: 0, qW: 0, eR: 0, eW: 0 };
        return '<tr><td><a href="' + ROOT + lessons[id].url + '">' + id + ' · ' + esc(lessons[id].title) + '</a></td><td>' + (b.cpR + b.cpW) + '</td><td>' + pct(b.cpR, b.cpW) + '</td><td>' + (b.qR + b.qW) + '</td><td>' + pct(b.qR, b.qW) + '</td><td>' + pct(b.eR, b.eW) + ' of ' + (b.eR + b.eW) + '</td></tr>'; }).join('') +
      '</tbody></table></div>' +
      '<h2>Hardest questions <span class="muted">(at least ' + minN + ' answers)</span></h2>' +
      (hardest.length ? '<ol class="in-hard">' + hardest.map(function (r) { var q = bank[r.qid];
        return '<li><div class="in-q">' + esc(strip(q.q)) + '</div><div class="in-meta"><strong>' + pct(r.right, r.wrong) + ' right</strong> of ' + (r.right + r.wrong) + ' · <a href="' + ROOT + q.u + '">Lesson ' + q.l + (q.s === 'quiz' ? ' quiz' : ', §' + q.s) + '</a> · correct: ' + esc(strip(q.o[q.a])) + '</div></li>'; }).join('') + '</ol>'
        : '<p class="muted">Not enough answers yet.</p>') +
      '<h2>Module challenges</h2>' + (modQ.length ? '<div class="table-wrap"><table class="pg-table"><thead><tr><th>Question</th><th>Answers</th><th>% right</th></tr></thead><tbody>' + modQ.map(function (r) { return '<tr><td>' + esc(r.qid) + '</td><td>' + (r.right + r.wrong) + '</td><td>' + pct(r.right, r.wrong) + '</td></tr>'; }).join('') + '</tbody></table></div>' : '<p class="muted">No module challenge answers yet.</p>') +
      '<h2>Labs used</h2>' + (labs.length ? '<ol class="in-labs">' + labs.slice(0, 40).map(function (l) { return '<li><code>' + esc(l.name) + '</code> ' + l.n + '</li>'; }).join('') + '</ol>' : '<p class="muted">No lab use recorded yet.</p>');
  }
  if (tokenIn.value) fetchStats();
})();
