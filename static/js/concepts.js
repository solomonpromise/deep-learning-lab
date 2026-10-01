/* Concept map: glossary terms in the module whose lessons teach them, with the "builds on" links from
   concepts.yaml drawn between them on a dark panel. Each concept's dot shows how far you are with the lesson that
   teaches it. Selecting a concept draws what it builds on (solid) and what it leads to (dashed) and fades the
   rest; "All links" shows every link. The side panel has the definition, both lists and where it is taught.
   Narrow screens get the same concepts as a list per module, without lines.
   Data: static/concepts.js (build) and the mastery model (progress.js). */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var page = $('[data-concepts-page]');
  if (!page || !window.DLP_CONCEPTS) return;
  var ROOT = document.body.getAttribute('data-root') || '';
  var nodes = window.DLP_CONCEPTS.nodes, byKey = {}, children = {}, selected = null, showAll = false;
  nodes.forEach(function (n) { byKey[n.key] = n; children[n.key] = []; });
  nodes.forEach(function (n) { n.builds_on.forEach(function (p) { if (children[p]) children[p].push(n.key); }); });
  var mapEl = $('[data-cm-map]'), layer = $('[data-cm-cols]'), svg = $('[data-cm-svg]'), panel = $('[data-cm-panel]');
  var STEP = 21.5, TOP = 64, PAD = 36, ZIG = 36, LIST_BELOW = 640;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function depth(k, memo) { if (memo[k] != null) return memo[k]; memo[k] = 0; var d = 0; byKey[k].builds_on.forEach(function (p) { if (byKey[p]) d = Math.max(d, depth(p, memo) + 1); }); return (memo[k] = d); }
  $('[data-cm-count]').textContent = 'Concept map · ' + nodes.length + ' concepts';

  window.DLP.mastery.all(function (mods) {
    var lessons = {}, status = {};
    mods.forEach(function (m) { m.lessons.forEach(function (l) { lessons[l.id] = l; }); });
    nodes.forEach(function (n) { status[n.key] = n.home && lessons[n.home] ? lessons[n.home].status : 'none'; });
    var order = Object.keys(lessons), memo = {};
    var groups = mods.map(function (m) { return { label: 'Module ' + m.number, title: m.title, items: [] }; });
    var later = { label: 'Not taught yet', title: 'Not in the published lessons yet', items: [] };
    nodes.forEach(function (n) { var g = groups[mods.map(function (m) { return m.number; }).indexOf(n.module)] || later; g.items.push(n); });
    if (later.items.length) groups.push(later);
    groups = groups.filter(function (g) { return g.items.length; });
    // within a module: in lesson order, then foundations before what rests on them
    groups.forEach(function (g) {
      g.items.sort(function (a, b) { return (order.indexOf(a.home) - order.indexOf(b.home)) || (depth(a.key, memo) - depth(b.key, memo)) || a.term.localeCompare(b.term); });
    });
    var tallest = Math.max.apply(null, groups.map(function (g) { return g.items.length; })), pos = {}, listMode = false;

    function nodeButton(n, style) {
      return '<button type="button" class="cn st-' + status[n.key] + '" data-key="' + n.key + '"' + (style ? ' style="' + style + '"' : '') +
        ' title="' + esc(n.term) + (n.home ? ', taught in Lesson ' + n.home : '') + '"><i class="cn-dot st-' + status[n.key] + '"></i><span>' + esc(n.term) + '</span></button>';
    }
    function layout() {
      var W = mapEl.clientWidth;
      listMode = W < LIST_BELOW;
      mapEl.classList.toggle('is-list', listMode);
      if (listMode) {
        mapEl.style.height = '';
        svg.innerHTML = '';
        layer.innerHTML = groups.map(function (g) {
          return '<section class="cn-group"><h2 class="mono-label">' + esc(g.label) + ' <span>' + esc(g.title) + '</span></h2><div>' + g.items.map(function (n) { return nodeButton(n); }).join('') + '</div></section>';
        }).join('');
      } else {
        var colW = (W - PAD * 2) / groups.length, H = tallest * STEP, html = '';
        groups.forEach(function (g, c) {
          var x0 = PAD + c * colW;
          html += '<span class="mono-label cn-col" style="left:' + x0 + 'px">' + esc(g.label) + '</span>';
          g.items.forEach(function (n, j) {
            var x = x0 + (j % 2 ? ZIG : 0), y = TOP + (j + 0.5) * (H / g.items.length);
            pos[n.key] = { x: x + 6, y: y, col: c };
            html += nodeButton(n, 'left:' + x + 'px;top:' + y + 'px;max-width:' + Math.max(80, colW - (j % 2 ? ZIG : 0) - 8) + 'px');
          });
        });
        mapEl.style.height = (TOP + H + 28) + 'px';
        layer.innerHTML = html;
      }
      $$('.cn', layer).forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-key'), true); }); });
      if (selected) mark();
      search();
    }
    function edge(a, b) {
      var p = pos[a], q = pos[b];
      if (p.col === q.col) return 'M' + p.x + ' ' + p.y + 'C' + (p.x - 26) + ' ' + p.y + ',' + (q.x - 26) + ' ' + q.y + ',' + q.x + ' ' + q.y;
      var mx = (p.x + q.x) / 2;
      return 'M' + p.x + ' ' + p.y + 'C' + mx + ' ' + p.y + ',' + mx + ' ' + q.y + ',' + q.x + ' ' + q.y;
    }
    function draw() {
      if (listMode) return;
      svg.setAttribute('viewBox', '0 0 ' + mapEl.clientWidth + ' ' + mapEl.clientHeight);
      var back = [], front = [];
      nodes.forEach(function (n) {
        n.builds_on.forEach(function (p) {
          if (!pos[p] || !pos[n.key]) return;
          var d = edge(p, n.key);
          if (n.key === selected) front.push('<path class="ce ce-up" d="' + d + '"/>');
          else if (p === selected) front.push('<path class="ce ce-down" d="' + d + '"/>');
          else back.push('<path class="ce" d="' + d + '"/>');
        });
      });
      svg.innerHTML = back.join('') + front.join('');
    }
    function mark() {
      var n = byKey[selected], up = {}, down = {};
      n.builds_on.forEach(function (k) { up[k] = 1; });
      children[selected].forEach(function (k) { down[k] = 1; });
      mapEl.classList.toggle('show-all', showAll);
      mapEl.classList.toggle('has-sel', !!selected);
      $$('.cn', layer).forEach(function (b) {
        var k = b.getAttribute('data-key');
        b.classList.toggle('is-sel', k === selected); b.classList.toggle('is-up', !!up[k]); b.classList.toggle('is-down', !!down[k]);
        b.setAttribute('aria-pressed', k === selected ? 'true' : 'false');
      });
      draw();
    }

    function chip(k) { return '<button type="button" class="cn-chip" data-go="' + k + '"><i class="cn-dot st-' + status[k] + '"></i>' + esc(byKey[k].term) + '</button>'; }
    function lessonLink(id) { var l = lessons[id]; return l ? '<a href="' + ROOT + l.url + '">Lesson ' + id + ' · ' + esc(l.title) + '</a>' : 'Lesson ' + id; }
    function select(key, fromClick) {
      selected = key;
      var n = byKey[key], up = n.builds_on.filter(function (k) { return byKey[k]; }), down = children[key], st = status[key], home = n.home && lessons[n.home];
      var also = n.lessons.filter(function (id) { return id !== n.home; });
      panel.innerHTML =
        '<span class="mono-label cp-k"><i class="cn-dot st-' + st + '"></i>Selected' + (n.home ? ' · ' + window.DLP.mastery.label[st].toLowerCase() : '') + '</span>' +
        '<h2>' + esc(n.term) + '</h2><div class="cp-def">' + n.def + '</div>' +
        '<span class="mono-label cp-h">Builds on</span>' + (up.length ? '<div class="cp-chips">' + up.map(chip).join('') + '</div>' : '<p class="cp-none">Nothing here: it is a starting point.</p>') +
        (down.length ? '<span class="mono-label cp-h">Leads to</span><div class="cp-chips">' + down.map(chip).join('') + '</div>' : '') +
        '<div class="cp-taught"><span class="mono-label cp-h">Taught in</span>' + (n.home ? '<p>' + lessonLink(n.home) + '</p>' : '<p class="cp-none">Not in the published lessons yet.</p>') +
          (also.length ? '<p class="cp-also">Also used in ' + also.map(function (id) { return lessons[id] ? '<a href="' + ROOT + lessons[id].url + '">' + id + '</a>' : id; }).join(' · ') + '</p>' : '') +
          (n.later.length ? '<ul class="cp-later">' + n.later.map(function (l) { return '<li><strong>Module ' + l.module + '</strong>, ' + esc(l.title) + ': ' + esc(l.why) + '</li>'; }).join('') + '</ul>' : '') +
        '</div>' +
        '<div class="cp-acts">' + (home ? '<a class="btn btn-sm" href="' + ROOT + home.url + '"><svg class="ic"><use href="#i-book"/></svg> Open the lesson</a>' : '') +
          '<a class="btn btn-sm btn-ghost" href="' + ROOT + 'glossary.html#' + key + '">Glossary entry</a>' +
          '<button type="button" class="cp-back" data-cm-back>Back to the map</button></div>';
      $$('[data-go]', panel).forEach(function (b) { b.addEventListener('click', function () { select(b.getAttribute('data-go'), true); }); });
      $('[data-cm-back]', panel).addEventListener('click', function () { var b = $('.cn.is-sel', layer); jumpTo(b); if (b) b.focus({ preventScroll: true }); });
      if (window.DLP.renderMath) window.DLP.renderMath(panel);
      history.replaceState(null, '', '#c=' + key);
      mark();
      if (fromClick && window.innerWidth <= 1100) jumpTo(panel);   // stacked layout: the details sit below the map
    }
    function jumpTo(el) {
      if (!el) return;
      var bar = $('.topbar');
      window.scrollTo({ top: Math.max(0, el.getBoundingClientRect().top + window.scrollY - (bar ? bar.offsetHeight : 0) - 12), behavior: 'instant' });
    }

    var input = $('[data-cm-search]');
    function search() {
      var q = input.value.trim().toLowerCase();
      mapEl.classList.toggle('is-searching', !!q);
      $$('.cn', layer).forEach(function (b) { b.classList.toggle('is-match', !!q && b.textContent.toLowerCase().indexOf(q) >= 0); });
    }
    input.addEventListener('input', search);
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      var m = $('.cn.is-match', layer);
      if (m) { e.preventDefault(); select(m.getAttribute('data-key'), true); }
    });
    $$('[data-cm-links]').forEach(function (b) {
      b.addEventListener('click', function () {
        showAll = b.getAttribute('data-cm-links') === 'all';
        $$('[data-cm-links]').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
        mark();
      });
    });
    var lastW = 0;
    function relayout() { if (mapEl.clientWidth !== lastW) { lastW = mapEl.clientWidth; layout(); } }
    if ('ResizeObserver' in window) new ResizeObserver(relayout).observe(mapEl); else window.addEventListener('resize', relayout);
    lastW = mapEl.clientWidth; layout();
    var fromHash = /#c=([\w-]+)/.exec(location.hash);
    select(fromHash && byKey[fromHash[1]] ? fromHash[1] : (byKey.backpropagation ? 'backpropagation' : nodes[0].key), false);
  });
})();
