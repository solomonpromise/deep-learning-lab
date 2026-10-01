/* The "My progress" page, a training log: headline numbers, this week and the weekly goal, what to do next,
   26 weeks of study days, the skills map (one tile per lesson, coloured by strength on the activation scale),
   module badges and lab challenges. All computed in this browser from the learning record (record.js) and the
   mastery model (progress.js). The sync panel at the foot is drawn by sync.js. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var page = $('[data-progress-page]');
  if (!page) return;
  var R = window.DLP.record, M = window.DLP.mastery, store = window.DLP.store, ROOT = document.body.getAttribute('data-root') || '';
  var DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(n) { return '<svg class="ic"><use href="#i-' + n + '"/></svg>'; }
  function plural(n, one, many) { return n + ' ' + (n === 1 ? one : (many || one + 's')); }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  // the activation scale, by how much of a lesson you have shown you can do
  function band(l) { return l.status === 'none' ? 0 : l.strength >= 0.85 ? 4 : l.strength >= 0.7 ? 3 : l.strength >= 0.45 ? 2 : 1; }

  /* ---------------------------------------------------------- headline numbers */
  function paintNums(mods) {
    var lessons = 0, mastered = 0, answers = R.get().answers, asked = 0, first = 0;
    mods.forEach(function (m) { lessons += m.lessons.length; mastered += m.mastered; });
    Object.keys(answers).forEach(function (k) {   // checkpoint, quiz and module challenge questions; code exercises are not questions
      if (!/^[cqm]:/.test(k)) return;
      asked++; if (answers[k].first) first++;
    });
    var dd = page.querySelectorAll('[data-pg-nums] dd');
    dd[0].innerHTML = '<strong>' + mastered + '</strong><span> / ' + lessons + '</span>';
    dd[1].innerHTML = '<strong>' + (asked ? Math.round(100 * first / asked) + '%' : '–') + '</strong>';
    dd[2].innerHTML = '<strong>' + asked + '</strong>';
  }

  /* ---------------------------------------------------------- this week, and the goal */
  function paintWeek() {
    var st = R.streak(), wk = R.week();
    $('[data-pg-week]').innerHTML =
      '<div class="log-week-main"><span class="mono-label">This week</span>' +
        '<div class="log-streak">' + icon('fire') + '<strong>' + (st.current ? st.current + '-day streak' : 'No streak yet') + '</strong></div>' +
        '<ol class="t-days">' + wk.days.map(function (d, i) {
          var lv = d.n >= 6 ? 3 : d.n >= 3 ? 2 : d.n ? 1 : 0;
          return '<li class="lv-' + lv + (d.future ? ' is-future' : '') + '" title="' + d.day + (d.n ? ' · ' + plural(d.n, 'thing') + ' done' : '') + '"><i></i><span>' + DAYS[i] + '</span></li>';
        }).join('') + '</ol></div>' +
      '<div class="log-goal"><label for="log-goal">Weekly goal</label>' +
        '<select id="log-goal" data-goal>' + [1, 2, 3, 4, 5, 6, 7].map(function (n) {
          return '<option value="' + n + '"' + (n === wk.goal ? ' selected' : '') + '>' + plural(n, 'day') + ' a week</option>';
        }).join('') + '</select>' +
        '<span class="log-goal-note">' + wk.active + ' done · best streak ' + plural(st.best, 'day') + '</span></div>';
    $('[data-goal]').addEventListener('change', function (e) { R.setGoal(+e.target.value); paintWeek(); });
  }

  /* ---------------------------------------------------------- do next */
  function paintNext(mods) {
    var due = R.due().length, last = store.get('last', null), weakest = null, items = [];
    mods.forEach(function (m) { m.lessons.forEach(function (l) { if (l.status !== 'none' && l.status !== 'mastered' && (!weakest || l.strength < weakest.strength)) weakest = l; }); });
    function row(href, ic, html) { return '<a class="log-do" href="' + href + '">' + icon(ic) + '<span>' + html + '</span>' + icon('chevron-right') + '</a>'; }
    if (due) items.push(row(ROOT + 'review.html', 'cards', '<strong>' + plural(due, 'question') + ' due</strong> in your daily review'));
    if (last && last.url) {
      var at = M.resumeAt(last.id);
      items.push(row(ROOT + esc(last.url) + (at ? '#' + at.id : ''), 'play', '<strong>Continue Lesson ' + esc(last.id) + '</strong>' +
        (at ? ' at ' + esc(at.label) + (at.label !== at.title ? ', ' + esc(at.title) : '') : ' where you left off')));
    }
    if (weakest) items.push(row(ROOT + 'review.html#practice=' + weakest.id, 'target', '<strong>Strengthen ' + esc(weakest.skill) + '</strong>, your weakest skill so far (' + Math.round(weakest.strength * 100) + '%)'));
    if (!items.length) {
      var first = mods[0] && mods[0].lessons[0];
      if (first) items.push(row(ROOT + first.url, 'play', '<strong>Start Lesson ' + first.id + '</strong>, ' + esc(first.title)));
    }
    $('[data-pg-next]').innerHTML = items.join('');
  }

  /* ---------------------------------------------------------- study days: 26 weeks, Monday first */
  function paintHeat() {
    var WEEKS = 26, days = R.days(), el = $('[data-pg-heat]'), today = new Date(), todayKey = R.dayKey(), active = 0, cells = [];
    var start = new Date(today.getFullYear(), today.getMonth(), today.getDate() - ((today.getDay() + 6) % 7) - 7 * (WEEKS - 1)), lastMonth = -1;
    ['Mon', '', 'Wed', '', 'Fri', '', 'Sun'].forEach(function (d, i) { if (d) cells.push('<span class="lh-d" style="grid-area:' + (i + 2) + '/1">' + d + '</span>'); });
    for (var w = 0; w < WEEKS; w++) {
      var monday = new Date(start.getFullYear(), start.getMonth(), start.getDate() + w * 7);
      if (monday.getMonth() !== lastMonth) {
        lastMonth = monday.getMonth();
        if (w < WEEKS - 2) cells.push('<span class="lh-m" style="grid-area:1/' + (w + 2) + '">' + monday.toLocaleDateString(undefined, { month: 'short' }) + '</span>');
      }
      for (var d = 0; d < 7; d++) {
        var date = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + d), key = R.dayKey(date), n = days[key] || 0;
        if (key > todayKey) continue;
        if (n) active++;
        var lv = !n ? '' : n < 3 ? 'h1' : n < 5 ? 'h2' : n < 8 ? 'h3' : 'h4';
        cells.push('<i class="' + lv + '" style="grid-area:' + (d + 2) + '/' + (w + 2) + '" title="' + date.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) + (n ? ': ' + plural(n, 'thing') + ' done' : '') + '"></i>');
      }
    }
    el.style.setProperty('--weeks', WEEKS);
    el.innerHTML = cells.join('');
    el.setAttribute('aria-label', plural(active, 'study day') + ' in the last ' + WEEKS + ' weeks');
    $('[data-pg-days-note]').textContent = plural(active, 'day') + ' in the last ' + WEEKS + ' weeks';
  }

  /* ---------------------------------------------------------- skills map: modules down, lessons across */
  function paintSkills(mods) {
    var cols = Math.max.apply(null, mods.map(function (m) { return m.lessons.length; }));
    $('[data-pg-skills]').innerHTML = mods.map(function (m) {
      return '<div class="sk2-row" style="--cols:' + cols + '"><a class="sk2-mod" href="' + ROOT + m.url + '"><strong>' + pad2(m.number) + '</strong><span>' + esc(m.short) + '</span></a>' +
        m.lessons.map(function (l) {
          var pct = Math.round(l.strength * 100);
          var detail = 'read ' + Math.round(l.read * 100) + '%' + (l.cp.total ? ', checkpoints ' + l.cp.right + ' of ' + l.cp.total + ' right' : '') +
            (l.quiz.total ? ', quiz ' + l.quiz.right + ' of ' + l.quiz.total : '') + (l.labs.total ? ', labs ' + l.labs.tried + ' of ' + l.labs.total : '');
          return '<a class="sk2 s' + band(l) + '" href="' + ROOT + l.url + '" title="Lesson ' + l.id + ' · ' + esc(l.title) + ': ' + detail + '">' +
            '<span class="sk2-top"><span>' + l.id + '</span><span>' + pct + '%</span></span>' +
            '<span class="sk2-name">' + esc(l.skill) + '</span><span class="sk2-st">' + M.label[l.status] + '</span></a>';
        }).join('') + '</div>';
    }).join('');
  }

  /* ---------------------------------------------------------- module badges */
  function paintBadges(mods) {
    $('[data-pg-badges]').innerHTML = mods.map(function (m) {
      var c = m.challenge, earned = c && c.passed;
      var note = !c ? 'No challenge yet' : earned ? 'Earned · ' + c.best + ' of ' + c.n
        : c.best != null ? 'Best ' + c.best + ' of ' + c.n + ' · pass ' + Math.ceil(c.pass * c.n) : 'Take the challenge';
      return '<a class="log-badge' + (earned ? ' is-earned' : '') + '" href="' + ROOT + m.url + (c ? '#challenge' : '') + '" title="Module ' + m.number + ' · ' + esc(m.title) + '">' +
        '<span class="log-medal" aria-hidden="true">' + pad2(m.number) + '</span><span class="sr-only">Module ' + m.number + ': </span><span class="log-badge-t">' + note + '</span></a>';
    }).join('');
  }

  /* ---------------------------------------------------------- lab challenges in the lessons you have reached */
  function paintChallenges(mods) {
    var status = {};
    mods.forEach(function (m) { m.lessons.forEach(function (l) { status[l.id] = l.status; }); });
    M.loadCourse(function (course) {
      var shown = [], later = 0;
      course.modules.forEach(function (m) { m.lessons.forEach(function (l) { (l.challenges || []).forEach(function (c) {
        var r = R.challengeOf(c.id);
        if (r || (status[l.id] && status[l.id] !== 'none')) shown.push({ c: c, l: l, r: r }); else later++;
      }); }); });
      if (!shown.length && !later) { $('[data-pg-challenges]').innerHTML = '<p class="log-empty">No lab challenges yet.</p>'; return; }
      $('[data-pg-challenges]').innerHTML = shown.map(function (it) {
        var r = it.r, best = r && r.best != null ? (Number.isInteger(r.best) ? r.best : +r.best.toFixed(3)) : null;
        return '<div class="log-ch-row' + (r && r.passed ? ' is-passed' : '') + '"><span class="log-ch-t">' + esc(it.c.title) + ' <span>· ' + it.l.id + ' ' + esc(it.c.lab.split(':')[0]) + '</span></span>' +
          '<span class="log-ch-r">' + (r && r.passed ? icon('check') : '') + (best != null ? best : '–') + '</span>' +
          '<a href="' + ROOT + it.l.url + '">' + (r ? (r.passed ? 'Improve' : 'Try again') : 'Try it') + '<span class="sr-only">: ' + esc(it.c.title) + '</span></a></div>';
      }).join('') + (later ? '<div class="log-ch-row is-later">' + (shown.length ? plural(later, 'more', 'more') : plural(later, 'challenge')) + ' in lessons you have not reached</div>' : '');
    });
  }

  /* ---------------------------------------------------------- certificate (only when switched on in course.yaml) */
  function paintCert(mods) {
    var box = $('[data-pg-cert]');
    if (!box) return;
    var earned = mods.filter(function (m) { return m.challenge && m.challenge.passed; }), name = store.get('cert:name', '');
    if (!earned.length) {
      box.innerHTML = '<p>Pass a module challenge, on each module\'s page, to earn its badge. Your certificate lists every module you have passed, so it grows with you.</p>';
      return;
    }
    box.innerHTML = '<p>You have passed ' + plural(earned.length, 'module challenge') + '. Add the name you want on it, then open the certificate to print it, save it as a PDF, or get a link that anyone can verify.</p>' +
      '<div class="pg-cert-row"><label class="sr-only" for="cert-name">Name on the certificate</label><input id="cert-name" data-cert-name type="text" maxlength="60" placeholder="Your name as it should appear" value="' + esc(name) + '">' +
      '<a class="btn" data-cert-open href="' + ROOT + 'certificate.html">' + icon('trophy') + ' Open my certificate</a></div>';
    $('[data-cert-name]').addEventListener('input', function (e) { store.set('cert:name', e.target.value.trim()); });
  }

  function paintAll(mods) {
    paintNums(mods); paintWeek(); paintNext(mods); paintHeat(); paintSkills(mods); paintBadges(mods); paintChallenges(mods); paintCert(mods);
  }
  M.all(paintAll);
  document.addEventListener('dlp:mastery', function (e) { paintAll(e.detail); });
})();
