/* The "My progress" page: streak and weekly goal, a 16-week activity calendar, the skills map,
   module badges, lesson-by-lesson mastery and the certificate. All computed in this browser from the
   learning record (record.js) and the mastery model (progress.js). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var page = $('[data-progress-page]');
  if (!page) return;
  var R = window.DLP.record, M = window.DLP.mastery, store = window.DLP.store, ROOT = document.body.getAttribute('data-root') || '';
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(n) { return '<svg class="ic"><use href="#i-' + n + '"/></svg>'; }

  function paintStreak() {
    var s = R.streak();
    $('[data-pg-streak]').innerHTML = '<div class="pg-big">' + icon('fire') + '<strong>' + s.current + '</strong></div><div class="pg-cap">day streak' + (s.today ? '' : s.current ? ': study today to keep it' : '') + '</div><div class="pg-sub">Best: ' + s.best + ' day' + (s.best === 1 ? '' : 's') + '</div>';
  }
  function paintGoal() {
    var w = R.week(), pct = Math.min(1, w.active / w.goal), C = 2 * Math.PI * 34;
    var days = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
    $('[data-pg-goal]').innerHTML =
      '<div class="pg-ring"><svg viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="ring-bg"/><circle cx="40" cy="40" r="34" class="ring-fg" stroke-dasharray="' + (C * pct) + ' ' + C + '" transform="rotate(-90 40 40)"/></svg><span>' + w.active + '/' + w.goal + '</span></div>' +
      '<div><div class="pg-cap">study days this week</div><div class="pg-days">' + w.days.map(function (d, i) { return '<i class="' + (d.n ? 'on' : d.future ? 'future' : '') + '" title="' + d.day + '">' + days[i] + '</i>'; }).join('') + '</div>' +
      '<label class="pg-goal-set">Weekly goal <select data-goal>' + [1, 2, 3, 4, 5, 6, 7].map(function (n) { return '<option value="' + n + '"' + (n === w.goal ? ' selected' : '') + '>' + n + ' day' + (n > 1 ? 's' : '') + '</option>'; }).join('') + '</select></label></div>';
    $('[data-goal]').addEventListener('change', function (e) { R.setGoal(+e.target.value); paintGoal(); });
  }
  function paintNext(mods) {
    var due = R.due().length, last = store.get('last', null), weakest = null;
    mods.forEach(function (m) { m.lessons.forEach(function (l) { if (l.status !== 'none' && l.status !== 'mastered' && (!weakest || l.strength < weakest.strength)) weakest = l; }); });
    var items = [];
    if (due) items.push('<a class="pg-todo" href="' + ROOT + 'review.html#start">' + icon('cards') + '<span><strong>' + due + ' question' + (due === 1 ? '' : 's') + ' due</strong> in your daily review</span></a>');
    if (last && last.url) items.push('<a class="pg-todo" href="' + ROOT + last.url + '">' + icon('play') + '<span><strong>Continue Lesson ' + esc(last.id) + '</strong> where you left off</span></a>');
    if (weakest) items.push('<a class="pg-todo" href="' + ROOT + weakest.url + '">' + icon('target') + '<span><strong>Strengthen ' + esc(weakest.skill) + '</strong> (Lesson ' + weakest.id + ', ' + M.label[weakest.status].toLowerCase() + ')</span></a>');
    if (!items.length) items.push('<a class="pg-todo" href="' + ROOT + 'module-1/lesson-1-1.html">' + icon('play') + '<span><strong>Start with Lesson 1.1</strong></span></a>');
    $('[data-pg-next]').innerHTML = '<div class="pg-cap">Next up</div>' + items.join('');
  }
  function paintHeat() {
    var days = R.days(), el = $('[data-pg-heat]'), today = new Date(), cells = [], total = 0, active = 0;
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 7 * 15);
    for (var w = 0; w < 16; w++) {
      var col = '<div class="hc">';
      for (var d = 0; d < 7; d++) {
        var date = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7 + d), key = R.dayKey(date), n = days[key] || 0;
        var lvl = date > today ? 'f' : n === 0 ? 0 : n < 5 ? 1 : n < 15 ? 2 : n < 40 ? 3 : 4;
        if (n) { active++; total += n; }
        col += '<i class="l' + lvl + '" title="' + key + (n ? ': ' + n + ' activit' + (n === 1 ? 'y' : 'ies') : '') + '"></i>';
      }
      cells.push(col + '</div>');
    }
    el.innerHTML = cells.join('');
    el.setAttribute('aria-label', active + ' active days in the last 16 weeks');
  }
  function paintSkills(mods) {
    var box = $('[data-pg-skills]');
    box.innerHTML = mods.map(function (m) {
      return '<div class="sk-mod" style="--mc:' + m.color + '"><div class="sk-mod-title">Module ' + m.number + ' · ' + esc(m.title) + '</div><div class="sk-row">' +
        m.lessons.map(function (l) {
          var pct = Math.round(l.strength * 100);
          return '<a class="sk-tile s-' + l.status + '" href="' + ROOT + l.url + '" style="--p:' + pct + '%" title="' + esc(l.title) + ': ' + M.label[l.status] + ', ' + pct + '%">' +
            '<span class="sk-id">' + l.id + '</span><span class="sk-name">' + esc(l.skill) + '</span><span class="sk-meter"><span></span></span><span class="sk-status">' + M.label[l.status] + '</span></a>';
        }).join('') + '</div></div>';
    }).join('');
    var started = [];
    mods.forEach(function (m) { m.lessons.forEach(function (l) { if (l.status !== 'none' && l.status !== 'mastered') started.push(l); }); });
    started.sort(function (a, b) { return a.strength - b.strength; });
    $('[data-pg-weak]').innerHTML = started.length ? '<div class="pg-cap">Weakest skills you have started</div><div class="pg-weak-row">' + started.slice(0, 3).map(function (l) {
      return '<span class="pg-weak-item"><strong>' + esc(l.skill) + '</strong> ' + Math.round(l.strength * 100) + '% <a href="' + ROOT + 'review.html#practice=' + l.id + '">Practise</a> · <a href="' + ROOT + l.url + '">Open lesson</a></span>';
    }).join('') + '</div>' : '';
  }
  function paintBadges(mods) {
    $('[data-pg-badges]').innerHTML = mods.map(function (m) {
      var c = m.challenge;
      return '<a class="pg-badge' + (c && c.passed ? ' earned' : '') + '" style="--mc:' + m.color + '" href="' + ROOT + m.url + '#challenge">' +
        '<span class="pg-badge-medal">' + icon('award') + '<b>' + m.number + '</b></span><span class="pg-badge-t">' + esc(m.title) + '</span>' +
        '<span class="pg-badge-s">' + (!c ? 'No challenge yet' : c.passed ? 'Earned · best ' + c.best + '/' + c.n : c.best != null ? 'Best ' + c.best + '/' + c.n + ' · pass ' + Math.ceil(c.pass * c.n) : 'Take the challenge') + '</span>' +
        '<span class="pg-badge-l">' + m.mastered + ' of ' + m.lessons.length + ' lessons mastered</span></a>';
    }).join('');
  }
  function paintTable(mods) {
    var rows = '<thead><tr><th>Lesson</th><th>Status</th><th>Read</th><th>Checkpoints</th><th>Quiz</th><th>Labs</th></tr></thead><tbody>';
    mods.forEach(function (m) {
      m.lessons.forEach(function (l) {
        rows += '<tr><td><a href="' + ROOT + l.url + '">' + l.id + ' · ' + esc(l.title) + '</a></td><td><span class="mp-status s-' + l.status + '">' + M.label[l.status] + '</span></td>' +
          '<td>' + Math.round(l.read * 100) + '%</td><td>' + (l.cp.total ? l.cp.right + '/' + l.cp.total : '—') + '</td><td>' + (l.quiz.total ? l.quiz.right + '/' + l.quiz.total : '—') + '</td><td>' + (l.labs.total ? l.labs.tried + '/' + l.labs.total : '—') + '</td></tr>';
      });
    });
    $('[data-pg-table]').innerHTML = rows + '</tbody>';
  }
  function paintCert(mods) {
    var earned = mods.filter(function (m) { return m.challenge && m.challenge.passed; }), name = store.get('cert:name', '');
    var box = $('[data-pg-cert]');
    if (!earned.length) {
      box.innerHTML = '<p class="muted">Pass a module challenge (on each module\'s overview page) to earn its badge. Your certificate lists every module you have passed, so it grows with you.</p>' +
        '<div class="pg-cert-locked">' + icon('lock') + ' No modules passed yet: ' + mods.filter(function (m) { return m.challenge; }).map(function (m) { return '<a href="' + ROOT + m.url + '#challenge">Module ' + m.number + '</a>'; }).join(' · ') + '</div>';
      return;
    }
    box.innerHTML = '<p class="muted">You have passed ' + earned.length + ' module challenge' + (earned.length === 1 ? '' : 's') + '. Add the name you want on it, then open the certificate to print it, save it as a PDF, download an image, or get a link that anyone can verify.</p>' +
      '<div class="pg-cert-row"><label class="sr-only" for="cert-name">Name on the certificate</label><input id="cert-name" data-cert-name type="text" maxlength="60" placeholder="Your name as it should appear" value="' + esc(name) + '">' +
      '<a class="btn" data-cert-open href="' + ROOT + 'certificate.html">' + icon('trophy') + ' Open my certificate</a></div>';
    $('[data-cert-name]').addEventListener('input', function (e) { store.set('cert:name', e.target.value.trim()); });
  }
  function paintAll(mods) { paintStreak(); paintGoal(); paintNext(mods); paintHeat(); paintSkills(mods); paintBadges(mods); paintTable(mods); paintCert(mods); }
  M.all(paintAll);
  document.addEventListener('dlp:mastery', function (e) { paintAll(e.detail); });
})();
