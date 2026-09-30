/* Concept map: glossary terms in the module that introduces them, with the "builds on" links from
   concepts.yaml drawn between them. Selecting a concept highlights everything it rests on (upstream) and
   everything that rests on it (downstream), and the panel lists its lessons and where it comes back later.
   Data: static/concepts.js (build) and the course map; mastery marks concepts from lessons you have mastered. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var page = $('[data-concepts-page]');
  if (!page || !window.DLP_CONCEPTS) return;
  var ROOT = document.body.getAttribute('data-root') || '';
  var nodes = window.DLP_CONCEPTS.nodes, byKey = {}, children = {}, selected = null;
  nodes.forEach(function (n) { byKey[n.key] = n; children[n.key] = []; });
  nodes.forEach(function (n) { n.builds_on.forEach(function (p) { if (children[p]) children[p].push(n.key); }); });
  var mapEl = $('[data-cm-map]'), cols = $('[data-cm-cols]'), svg = $('[data-cm-svg]'), panel = $('[data-cm-panel]');
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function closure(start, next) { var seen = {}, stack = [start]; while (stack.length) { var k = stack.pop(); next(k).forEach(function (j) { if (!seen[j]) { seen[j] = 1; stack.push(j); } }); } return seen; }
  function depth(k, memo) { memo = memo || {}; if (memo[k] != null) return memo[k]; memo[k] = 0; var d = 0; byKey[k].builds_on.forEach(function (p) { if (byKey[p]) d = Math.max(d, depth(p, memo) + 1); }); return (memo[k] = d); }

  window.DLP.mastery.all(function (mods) {
    var lessons = {}, mastered = {}, courseMods = {};
    mods.forEach(function (m) { courseMods[m.number] = m; m.lessons.forEach(function (l) { lessons[l.id] = l; if (l.status === 'mastered') mastered[l.id] = 1; }); });
    var order = Object.keys(lessons);
    var groups = mods.map(function (m) { return { number: m.number, title: m.title, color: m.color, items: [] }; });
    var later = { number: null, title: 'Not in the published lessons yet', color: 'var(--ink-3)', items: [] };
    nodes.forEach(function (n) { var g = groups.filter(function (x) { return x.number === n.module; })[0] || later; g.items.push(n); });
    if (later.items.length) groups.push(later);
    var memo = {};
    groups.forEach(function (g) {
      g.items.sort(function (a, b) { return (order.indexOf(a.home) - order.indexOf(b.home)) || (depth(a.key, memo) - depth(b.key, memo)) || a.term.localeCompare(b.term); });
    });
    cols.innerHTML = groups.map(function (g) {
      return '<div class="cm-col" style="--mc:' + g.color + '"><div class="cm-col-head">' + (g.number ? 'Module ' + g.number + '<span>' + esc(g.title) + '</span>' : esc(g.title)) + '</div>' +
        g.items.map(function (n, i) {
          var head = n.home && (i === 0 || g.items[i - 1].home !== n.home) ? '<span class="cm-lesson" title="' + esc(lessons[n.home] ? lessons[n.home].title : '') + '">Lesson ' + n.home + '</span>' : '';
          return head + '<button type="button" class="cm-node' + (n.home && mastered[n.home] ? ' known' : '') + '" data-key="' + n.key + '" title="' + esc(n.term) + (n.home ? ', taught in Lesson ' + n.home : '') + '">' + esc(n.term) + '</button>';
        }).join('') + '</div>';
    }).join('');
    $$('.cm-node', cols).forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-key'), true); }); });

    function center(key, side) {
      var el = $('.cm-node[data-key="' + key + '"]', cols), box = mapEl.getBoundingClientRect(), r = el.getBoundingClientRect();
      return { x: (side === 'r' ? r.right : r.left) - box.left, y: r.top + r.height / 2 - box.top, col: el.parentNode };
    }
    function drawLines() {
      var box = mapEl.getBoundingClientRect(), show = $('[data-cm-lines]').checked && window.innerWidth > 760;
      svg.setAttribute('width', box.width); svg.setAttribute('height', box.height); svg.setAttribute('viewBox', '0 0 ' + box.width + ' ' + box.height);
      if (!show) { svg.innerHTML = ''; return; }
      var up = selected ? closure(selected, function (k) { return byKey[k].builds_on; }) : {}, down = selected ? closure(selected, function (k) { return children[k]; }) : {};
      var paths = [];
      nodes.forEach(function (n) {
        n.builds_on.forEach(function (p) {
          if (!byKey[p]) return;
          var a = center(p, 'r'), b = center(n.key, 'l'), same = a.col === b.col;
          if (same) { a = center(p, 'r'); b = center(n.key, 'r'); }
          var cls = 'cm-edge', onUp = selected && (n.key === selected || up[n.key]) && (up[p] || p === selected) , onDown = selected && (down[n.key] || n.key === selected) && (down[p] || p === selected);
          if (selected && up[p] && (up[n.key] || n.key === selected)) cls += ' up';
          else if (selected && (p === selected || down[p]) && down[n.key]) cls += ' down';
          else if (selected) cls += ' dim';
          var d = same ? 'M' + a.x + ' ' + a.y + ' C' + (a.x + 40) + ' ' + a.y + ',' + (b.x + 40) + ' ' + b.y + ',' + b.x + ' ' + b.y
            : 'M' + a.x + ' ' + a.y + ' C' + (a.x + (b.x - a.x) / 2) + ' ' + a.y + ',' + (a.x + (b.x - a.x) / 2) + ' ' + b.y + ',' + b.x + ' ' + b.y;
          paths.push('<path class="' + cls + '" d="' + d + '"/>');
          void onUp; void onDown;
        });
      });
      svg.innerHTML = paths.join('');
    }
    function chip(k) { return '<button type="button" class="cm-chip" data-go="' + k + '">' + esc(byKey[k].term) + '</button>'; }
    function lessonLink(id) { var l = lessons[id]; return l ? '<a href="' + ROOT + l.url + '">Lesson ' + id + ' · ' + esc(l.title) + '</a>' + (mastered[id] ? ' <span class="cm-mastered">mastered</span>' : '') : 'Lesson ' + id; }
    function select(key, scroll) {
      selected = key;
      var n = byKey[key], up = closure(key, function (k) { return byKey[k].builds_on; }), down = closure(key, function (k) { return children[k]; });
      $$('.cm-node', cols).forEach(function (b) {
        var k = b.getAttribute('data-key');
        b.classList.toggle('is-sel', k === key); b.classList.toggle('is-up', !!up[k]); b.classList.toggle('is-down', !!down[k]);
        b.classList.toggle('is-dim', k !== key && !up[k] && !down[k]);
      });
      panel.innerHTML = '<h2>' + esc(n.term) + '</h2><div class="cm-def">' + n.def + '</div>' +
        (n.builds_on.length ? '<h3>Builds on</h3><div class="cm-chips">' + n.builds_on.filter(function (k) { return byKey[k]; }).map(chip).join('') + '</div>' : '<p class="muted">A starting point: it builds on nothing else here.</p>') +
        (children[key].length ? '<h3>Leads to</h3><div class="cm-chips">' + children[key].map(chip).join('') + '</div>' : '') +
        (n.home ? '<h3>Taught in</h3><p>' + lessonLink(n.home) + '</p>' + (n.lessons[0] !== n.home ? '<p class="cm-small">First mentioned in Lesson ' + n.lessons[0] + '.</p>' : '') : '<h3>In the lessons</h3><p class="muted">Not used in the published lessons yet.</p>') +
        (n.lessons.length > 1 ? '<h3>Also used in</h3><ul class="cm-list">' + n.lessons.filter(function (id) { return id !== n.home; }).map(function (id) { return '<li>' + lessonLink(id) + '</li>'; }).join('') + '</ul>' : '') +
        (n.later.length ? '<h3>Later in the course</h3><ul class="cm-list">' + n.later.map(function (l) { return '<li><strong>Module ' + l.module + '</strong> ' + esc(l.title) + ': ' + esc(l.why) + (courseMods[l.module] ? '' : ' <span class="muted">(coming soon)</span>') + '</li>'; }).join('') + '</ul>' : '') +
        '<p class="cm-foot"><a href="' + ROOT + 'glossary.html#' + key + '">In the glossary</a><button type="button" class="cm-back" data-cm-back>Back to the map</button></p>';
      $$('[data-go]', panel).forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-go'), true); }); });
      $('[data-cm-back]', panel).addEventListener('click', function () { jumpTo($('.cm-node.is-sel', cols)); });
      if (window.DLP.renderMath) window.DLP.renderMath(panel);
      history.replaceState(null, '', '#c=' + key);
      drawLines();
      if (scroll && window.innerWidth <= 1180) jumpTo(panel);             // stacked layout: the details sit below the map
    }
    function jumpTo(el) {
      var bar = document.querySelector('.topbar');
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 12), behavior: 'instant' });
    }
    var search = $('[data-cm-search]');
    search.addEventListener('input', function () {
      var q = search.value.trim().toLowerCase();
      $$('.cm-node', cols).forEach(function (b) { b.classList.toggle('is-match', !!q && b.textContent.toLowerCase().indexOf(q) >= 0); });
    });
    search.addEventListener('keydown', function (e) { if (e.key === 'Enter') { var m = $('.cm-node.is-match', cols); if (m) select(m.getAttribute('data-key'), true); } });
    $('[data-cm-lines]').addEventListener('change', drawLines);
    if ('ResizeObserver' in window) new ResizeObserver(function () { drawLines(); }).observe(mapEl); else window.addEventListener('resize', drawLines);
    var fromHash = /#c=([\w-]+)/.exec(location.hash);
    select(fromHash && byKey[fromHash[1]] ? fromHash[1] : (byKey['backpropagation'] ? 'backpropagation' : nodes[0].key), false);
  });
})();
