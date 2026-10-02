/* Home page: the "today" band for a returning learner, "Your network" (the course drawn as a network, one layer per
   module and one node per lesson, lit by mastery), and the module rows. A first visit (no study day on record yet)
   shows the welcome and the untrained network instead of the today band. Loaded on the home page only, after
   progress.js (uses DLP.mastery and DLP.record). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var home = $('[data-home]');
  if (!home || !window.DLP || !window.DLP.mastery) return;
  var ROOT = document.body.getAttribute('data-root') || '';
  var R = window.DLP.record, store = window.DLP.store, M = window.DLP.mastery;
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var FILL = { started: '#3b528b', practised: '#21918c', mastered: '#fde725' };
  var DAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function icon(name) { return '<svg class="ic"><use href="#i-' + name + '"/></svg>'; }

  var state = null;   // { C, mods, byId, order, returning, current }
  function load(cb) {
    M.loadCourse(function (C) {
      M.all(function (mods) {
        var byId = {}, order = [];
        C.modules.forEach(function (m) { m.lessons.forEach(function (l) { byId[l.id] = { map: l, module: m }; order.push(l.id); }); });
        mods.forEach(function (m) { m.lessons.forEach(function (l) { if (byId[l.id]) byId[l.id].st = l; }); });
        var last = store.get('last', null), current = last && byId[last.id] ? last.id : null;
        state = { C: C, mods: mods, byId: byId, order: order, returning: Object.keys(R.days()).length > 0, current: current };
        cb(state);
      });
    });
  }

  /* ------------------------------------------------------------ today band */
  function resumeCard(s) {
    var id = s.current || s.order[0], L = s.byId[id], prog = (store.get('progress', {})[id]) || {};
    // a finished lesson points on to the next one that is not mastered yet
    if ((prog.pct || 0) >= 0.98 || (L.st && L.st.status === 'mastered')) {
      for (var i = s.order.indexOf(id) + 1; i < s.order.length; i++) {
        var n = s.byId[s.order[i]];
        if (n.module.available && !(n.st && n.st.status === 'mastered')) { id = s.order[i]; L = n; prog = (store.get('progress', {})[id]) || {}; break; }
      }
    }
    var l = L.map, secs = l.secs || [], read = prog.read || [], next = 0;
    while (next < secs.length && read.indexOf(secs[next][0]) >= 0) next++;
    if (next >= secs.length) next = Math.max(0, secs.length - 1);
    var sec = secs[next] || ['start', null, 'Before you start'], pct = Math.round((prog.pct || 0) * 100);
    var left = Math.max(1, Math.round((l.minutes || 0) * (1 - (prog.pct || 0)))), label = sec[1] != null ? '§' + sec[1] : sec[2];
    var fresh = !read.length && !((prog.pct || 0) > 0.03);
    return '<span class="mono-label t-k">' + (fresh ? 'Up next' : 'Pick up where you left off') + '</span>' +
      '<span class="t-where">Module ' + L.module.number + ' · Lesson ' + esc(l.id) + '</span>' +
      '<h2 class="t-title"><a href="' + ROOT + l.url + '">' + esc(l.title) + '</a></h2>' +
      '<ol class="t-secs" aria-hidden="true">' + secs.map(function (x, i) { return '<li class="' + (read.indexOf(x[0]) >= 0 ? 'is-read' : '') + (i === next && !fresh ? ' is-next' : '') + '"></li>'; }).join('') + '</ol>' +
      '<p class="t-next">' + (fresh ? '<strong>' + secs.length + ' sections</strong>' : '<strong>' + (sec[1] != null ? '§' + sec[1] + ' ' : '') + esc(sec[2]) + '</strong>') +
      ' <span class="t-meta">' + (fresh ? 'about ' + (l.minutes || 0) + ' min' : pct + '% read · about ' + left + ' min left') + '</span></p>' +
      '<div class="t-actions"><a class="btn btn-lg" href="' + ROOT + l.url + (fresh ? '' : '#' + sec[0]) + '">' + icon('play') + ' ' + (fresh ? 'Start Lesson ' + esc(l.id) : 'Resume at ' + esc(label)) + '</a>' +
      '<a class="t-link" href="' + ROOT + L.module.url + '">Module overview</a></div>';
  }
  function reviewCard() {
    var due = R.due(), per = {};
    due.forEach(function (q) { var m = /(\d+)\.\d+/.exec(q); if (m) per[m[1]] = (per[m[1]] || 0) + 1; });
    var rows = Object.keys(per).sort(function (a, b) { return a - b; }).slice(0, 4);
    return '<span class="mono-label t-k">Daily review</span>' +
      '<a class="t-big" href="' + ROOT + 'review.html' + (due.length ? '#start' : '') + '"><strong>' + due.length + '</strong><span>' + (due.length === 1 ? 'question' : 'questions') + '<br>due today</span></a>' +
      (due.length ? '<ul class="t-mods">' + rows.map(function (m) { return '<li><span>Module ' + m + '</span><span class="t-n">' + per[m] + '</span></li>'; }).join('') + '</ul>'
                  : '<p class="t-note">Nothing due. Questions you answer in lessons come back here on a schedule.</p>') +
      '<a class="btn btn-ghost t-cta" href="' + ROOT + 'review.html' + (due.length ? '#start' : '') + '">' + icon('cards') + ' ' +
      (due.length > 15 ? 'Start a 15-question round' : due.length ? 'Review all ' + due.length : 'Open daily review') + '</a>';
  }
  function weekCard() {
    var st = R.streak(), wk = R.week(), togo = wk.goal - wk.active;
    return '<span class="mono-label t-k">This week</span>' +
      '<div class="t-streak">' + icon('fire') + '<strong>' + (st.current ? st.current + '-day streak' : 'No streak yet') + '</strong></div>' +
      '<ol class="t-days">' + wk.days.map(function (d, i) {
        var lv = d.n >= 6 ? 3 : d.n >= 3 ? 2 : d.n ? 1 : 0;
        return '<li class="lv-' + lv + (d.future ? ' is-future' : '') + '" title="' + d.day + (d.n ? ' · ' + d.n + ' things done' : '') + '"><i></i><span>' + DAYS[i] + '</span></li>';
      }).join('') + '</ol>' +
      '<p class="t-goal"><strong>' + wk.active + ' of ' + wk.goal + ' study days</strong>' +
      (togo <= 0 ? 'Weekly goal met. Anything more is a bonus.' : togo === 1 ? 'One more day this week meets your goal.' : togo + ' more days this week meet your goal.') + '</p>' +
      '<a class="t-link" href="' + ROOT + 'progress.html">Open your training log ' + icon('arrow-right') + '</a>';
  }
  // a first visit sees the landing page; a returning learner sees today, unless they asked for the introduction
  function introAsked() { return location.hash === '#about-course'; }
  function paintToday(s) {
    var today = $('[data-today]'), intro = s.returning && introAsked();
    $$('[data-welcome]').forEach(function (el) { el.hidden = s.returning && !intro; });
    $$('[data-returning]').forEach(function (el) { el.hidden = !s.returning || intro; });
    var bar = $('[data-intro-bar]'); if (bar) bar.hidden = !intro;
    if (!today) return;
    today.hidden = !s.returning || intro;
    if (!s.returning || intro) return;
    $('[data-resume]', today).innerHTML = resumeCard(s);
    $('[data-review]', today).innerHTML = reviewCard();
    $('[data-week]', today).innerHTML = weekCard();
  }

  /* ------------------------------------------------------------ module rows */
  function paintRows(s) {
    s.mods.forEach(function (m) {
      var row = $('[data-mrow="' + m.number + '"]');
      if (!row) return;
      m.lessons.forEach(function (l) { var seg = $('[data-seg="' + l.id + '"]', row); if (seg) { seg.className = 'st-' + l.status; seg.title = l.id + ' · ' + l.title + ' · ' + M.label[l.status]; } });
      $('[data-mrow-count]', row).textContent = m.mastered + ' of ' + m.lessons.length + ' mastered';
      row.classList.toggle('is-full', m.mastered === m.lessons.length);
      var go = $('[data-mrow-go]', row), cur = s.current && s.byId[s.current];
      if (cur && cur.module.number === m.number && !(cur.st && cur.st.status === 'mastered')) {
        go.className = 'btn btn-sm mrow-go'; go.href = ROOT + cur.map.url; go.innerHTML = 'Continue ' + esc(s.current) + ' ' + icon('arrow-right');
      } else { go.className = 'btn btn-ghost btn-sm mrow-go'; go.href = ROOT + m.url; go.innerHTML = 'Open ' + icon('arrow-right'); }
    });
  }

  /* ------------------------------------------------------------ your network */
  function layers(s) {
    return s.C.modules.map(function (m) {
      return { m: m, soon: !m.available, nodes: m.available ? m.lessons.map(function (l) { var b = s.byId[l.id]; return { id: l.id, title: l.title, url: l.url, status: b.st ? b.st.status : 'none' }; })
                                                        : [{ soon: true }, { soon: true }, { soon: true }] };
    });
  }
  function edge(a, b, vertical) {
    if (vertical) { var dy = (b.y - a.y) / 2; return 'M' + a.x + ' ' + a.y + 'C' + a.x + ' ' + (a.y + dy) + ' ' + b.x + ' ' + (b.y - dy) + ' ' + b.x + ' ' + b.y; }
    var dx = (b.x - a.x) / 2;
    return 'M' + a.x + ' ' + a.y + 'C' + (a.x + dx) + ' ' + a.y + ' ' + (b.x - dx) + ' ' + b.y + ' ' + b.x + ' ' + b.y;
  }
  function drawNet(s) {
    var stage = $('[data-net-stage]');
    if (!stage) return;
    var L = layers(s), vertical = stage.clientWidth < 640, W, H;
    var live = L.filter(function (l) { return !l.soon; }), soon = L.filter(function (l) { return l.soon; });
    if (vertical) {
      W = 340; var rowH = 58, top = 22;
      live.forEach(function (l, i) { var n = l.nodes.length; l.nodes.forEach(function (d, j) { d.x = 64 + (j + 0.5) * (266 / n); d.y = top + i * rowH; }); l.lx = 14; l.ly = top + i * rowH; });
      var sy = top + live.length * rowH;
      soon.forEach(function (l, i) { l.nodes = [{ soon: true, x: 64 + (i + 0.5) * (266 / soon.length), y: sy }]; });
      H = sy + (soon.length ? 40 : 0);
      var soonRow = { soon: true, nodes: soon.map(function (l) { return l.nodes[0]; }) };
    } else {
      W = 1200; H = 330; var cy = 140, step = 54, total = Math.max(1, live.length - 1) + (soon.length ? 0.68 + (soon.length - 1) * 0.43 : 0), unit = 1090 / total, x = 60;
      L.forEach(function (l, i) {
        if (i) x += l.soon ? (L[i - 1].soon ? 0.43 : 0.68) * unit : unit;
        l.x = x;
        l.nodes.forEach(function (d, j) { d.x = x; d.y = cy + (j - (l.nodes.length - 1) / 2) * step; });
      });
    }
    var EL = vertical ? live.concat(soon.length ? [soonRow] : []) : L;   // phones draw the coming-soon modules as one row
    var out = [], dots = [], eid = 0, here = null;
    // edges between consecutive layers; lit when the source lesson is practised or mastered
    for (var i = 0; i + 1 < EL.length; i++) {
      EL[i].nodes.forEach(function (a) {
        EL[i + 1].nodes.forEach(function (b) {
          var lit = !a.soon && (a.status === 'practised' || a.status === 'mastered'), id = 'ne' + (eid++);
          var cls = a.soon || b.soon ? 'ne ne-soon' : lit ? 'ne ne-lit' : a.status === 'started' ? 'ne ne-started' : 'ne';
          out.push('<path id="' + id + '" class="' + cls + '"' + (lit ? ' style="stroke:' + FILL[a.status] + '"' : '') + ' d="' + edge(a, b, vertical) + '"/>');
          if (lit && !b.soon) dots.push(id);
        });
      });
    }
    // first visit: a few signals leave the first lesson, as an invitation
    if (!s.returning && !dots.length) out.forEach(function (p, k) { if (EL[1] && k < EL[0].nodes.length * EL[1].nodes.length && k % 2 === 0) dots.push('ne' + k); });
    var g = ['<g class="ne-g">' + out.join('') + '</g>'];
    if (!reduce) {
      var pick = dots.filter(function (_, k) { return dots.length <= 18 || k % Math.ceil(dots.length / 18) === 0; });
      g.push('<g class="nd-g">' + pick.map(function (id, k) {
        var dur = (2.6 + (k % 5) * 0.35).toFixed(2);
        return '<circle r="2.6" class="nd"><animateMotion dur="' + dur + 's" begin="-' + ((k * 0.77) % 3).toFixed(2) + 's" repeatCount="indefinite"><mpath href="#' + id + '"/></animateMotion></circle>';
      }).join('') + '</g>');
    }
    // nodes
    var cur = s.current || (!s.returning ? s.order[0] : null), nodes = [];
    EL.forEach(function (l) {
      l.nodes.forEach(function (d) {
        if (d.soon) { nodes.push('<circle class="nn nn-soon" cx="' + d.x + '" cy="' + d.y + '" r="' + (vertical ? 6 : 7) + '"/>'); return; }
        var r = vertical ? 11 : 9;
        if (d.id === cur) here = d;
        nodes.push('<a href="' + ROOT + d.url + '" tabindex="-1"><title>' + esc(d.id + ' ' + d.title + ' · ' + M.label[d.status]) + '</title>' +
          '<circle class="nn st-' + d.status + '" cx="' + d.x + '" cy="' + d.y + '" r="' + r + '"' + (FILL[d.status] ? ' style="fill:' + FILL[d.status] + ';stroke:' + FILL[d.status] + '"' : '') + '/>' +
          (vertical ? '' : '<text class="nl" x="' + (d.x + 14) + '" y="' + (d.y + 4) + '">' + esc(d.id) + '</text>') + '</a>');
      });
    });
    g.push('<g class="nn-g">' + nodes.join('') + '</g>');
    // where you are
    if (here) {
      g.push('<circle class="net-here" cx="' + here.x + '" cy="' + here.y + '" r="' + (vertical ? 17 : 15) + '"/>');
      if (!vertical) {
        var text = s.returning ? 'You are here' : 'Start here: ' + here.id + ' ' + here.title, w = Math.round(text.length * 6.9 + 40);
        var px = s.returning ? here.x + 40 : Math.max(8, here.x - 14), py = s.returning ? here.y - 14 : L[0].nodes[L[0].nodes.length - 1].y + 40;
        px = Math.min(px, W - w - 8);
        g.push('<a class="net-pill" href="' + ROOT + here.url + '" tabindex="-1"><rect x="' + px + '" y="' + py + '" width="' + w + '" height="28" rx="14"/>' +
          '<path d="M' + (px + 15) + ' ' + (py + 9) + 'l8 5-8 5z"/><text x="' + (px + 30) + '" y="' + (py + 18.5) + '">' + esc(text) + '</text></a>');
      }
    }
    // module labels
    var labels = [];
    if (vertical) {
      live.forEach(function (l) { labels.push('<text class="nm-num" x="' + l.lx + '" y="' + (l.ly + 4) + '">' + pad(l.m.number) + '</text>'); });
      if (soon.length) labels.push('<text class="nm-t" x="14" y="' + (H - 6) + '">' + pad(soon[0].m.number) + '–' + pad(soon[soon.length - 1].m.number) + ' coming soon</text>');
    } else {
      live.forEach(function (l) { labels.push('<text class="nm-num" x="' + l.x + '" y="292" text-anchor="middle">' + pad(l.m.number) + '</text><text class="nm-t" x="' + l.x + '" y="310" text-anchor="middle">' + esc(l.m.short || l.m.title) + '</text>'); });
      soon.forEach(function (l) { labels.push('<text class="nm-num is-soon" x="' + l.x + '" y="292" text-anchor="middle">' + pad(l.m.number) + '</text>'); });
      if (soon.length) {
        var mid = (soon[0].x + soon[soon.length - 1].x) / 2;
        labels.push('<text class="nm-t" x="' + mid + '" y="310" text-anchor="middle">Coming soon: ' + esc(soon.map(function (l) { return l.m.short || l.m.title; }).join(', ')) + '</text>');
      }
    }
    g.push('<g>' + labels.join('') + '</g>');
    stage.innerHTML = '<svg class="net-svg' + (vertical ? ' is-vertical' : '') + '" viewBox="0 0 ' + W + ' ' + H + '" aria-hidden="true" focusable="false">' + g.join('') + '</svg>';
    stage.setAttribute('data-mode', vertical ? 'v' : 'h');
  }
  function paintNetHead(s) {
    var n = 0, total = 0;
    s.mods.forEach(function (m) { n += m.mastered; total += m.lessons.length; });
    var cur = s.current && s.byId[s.current];
    $('[data-net-summary]').textContent = n + ' of ' + total + ' lessons mastered.' + (cur ? ' You are on Lesson ' + s.current + ', ' + cur.map.title + '.' : '');
    if (!s.returning) return;
    $('[data-net-k]').textContent = 'Your network';
    $('[data-net-title]').textContent = n + ' of ' + total + ' lessons mastered';
    $('[data-net-lead]').textContent = s.C.modules.length + ' modules, one layer each. A lesson’s node lights up as you master it; signals flow along what you have learned.';
  }

  function paint() { load(function (s) { paintToday(s); paintRows(s); paintNetHead(s); drawNet(s); }); }
  paint();
  window.addEventListener('hashchange', function () {
    if (!state) return;
    paintToday(state);
    if (introAsked()) window.scrollTo(0, 0);
  });
  var t;
  document.addEventListener('dlp:record', function () { clearTimeout(t); t = setTimeout(paint, 200); });
  window.addEventListener('resize', function () {
    var stage = $('[data-net-stage]'), mode = stage && stage.getAttribute('data-mode');
    if (state && stage && ((stage.clientWidth < 640) !== (mode === 'v'))) drawNet(state);
  });
})();
