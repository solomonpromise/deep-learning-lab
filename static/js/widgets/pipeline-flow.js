/* Pipeline Flow — classical ML vs deep learning pipelines, animated.
   Click any stage for an explanation; toggle to see where the human work goes in each. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var NS = 'http://www.w3.org/2000/svg';

  var STAGES = {
    ml: [
      { id: 'raw', label: 'Raw data', y: 40, text: '<h5>Raw data</h5><p>The same starting point in both worlds: rows of a table, pixels, audio samples or text.</p>' },
      { id: 'fe', label: 'Feature engineering', y: 120, human: true, text: '<h5>Feature engineering: written by a person</h5><p>You decide what the model gets to look at: ratios, log transforms, interaction terms, aggregations. This is where your <strong>domain knowledge</strong> enters, and it is usually the most important step in classical ML.</p>' },
      { id: 'algo', label: 'ML algorithm', y: 200, text: '<h5>ML algorithm</h5><p>Logistic regression, a random forest or gradient boosting fits coefficients or split points <em>on top of the features you wrote</em>. It never changes the description of the data it was given.</p>' },
      { id: 'pred', label: 'Prediction', y: 280, text: '<h5>Prediction</h5><p>The quality ceiling is set by the features: a perfect algorithm cannot recover information your features left out.</p>' }
    ],
    dl: [
      { id: 'raw2', label: 'Raw data', y: 40, text: '<h5>Raw data</h5><p>Closer to the raw signal: pixels, waveforms, tokens, or the raw columns.</p>' },
      { id: 'l1', label: 'Layer 1: simple features', y: 110, learned: true, text: '<h5>Early layers: simple learned features</h5><p>The first layer turns the raw input into many new numbers, for example edges and directions. Its weights are <strong>fitted by gradient descent</strong>, not written by hand.</p>' },
      { id: 'l2', label: 'Layer 2: combinations', y: 170, learned: true, text: '<h5>Deeper layers: combinations</h5><p>Each layer builds more useful descriptions out of the previous layer\'s features: curves from edges, shapes from curves. This stack <em>is</em> the feature engineering, learned jointly with the task.</p>' },
      { id: 'head', label: 'Output layer', y: 230, text: '<h5>Output layer</h5><p>Often just a logistic regression, the same kind of model that fails on raw spirals. It succeeds because it sits on top of a representation the network built for itself.</p>' },
      { id: 'pred2', label: 'Prediction', y: 290, text: '<h5>Prediction</h5><p>Features and classifier are trained <strong>together</strong>, end to end, by one loss function.</p>' }
    ]
  };
  var HUMAN_DL = [
    { label: 'you: data & labels', x: 552, y: 32, w: 126 },
    { label: 'you: input scaling', x: 404, y: 88, w: 118 },
    { label: 'you: architecture', x: 560, y: 215, w: 118 },
    { label: 'you: loss design', x: 564, y: 282, w: 114 }
  ];

  window.DLP.widgets['pipeline-flow'] = function (root) {
    var P = L.palette(), showWork = false, sel = null;
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 720 340'); svg.setAttribute('class', 'pf-svg'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Classical machine learning pipeline next to the deep learning pipeline');
    var toggle = L.segmented({ options: [{ value: 'flow', label: 'Watch the data flow' }, { value: 'work', label: 'Where does the human work go?' }], value: 'flow', onChange: function (v) { showWork = v === 'work'; render(); } });
    var detail = L.el('div', { class: 'w-panel pf-detail', html: '<p class="w-note">Click any box to see what happens at that stage.</p>' });
    root.appendChild(L.el('div', { class: 'pf-wrap' }, [L.el('div', { class: 'w-row' }, [toggle.el]), svg, detail]));

    function mk(tag, attrs, parent) { var e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); (parent || svg).appendChild(e); return e; }
    var particles = [];

    function render() {
      P = L.palette();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      particles = [];
      var cols = [{ key: 'ml', x: 40, title: 'Classical machine learning' }, { key: 'dl', x: 400, title: 'Deep learning' }];
      mk('line', { x1: 360, y1: 10, x2: 360, y2: 330, stroke: P.line2, 'stroke-dasharray': '4 5' });
      cols.forEach(function (c) {
        var t = mk('text', { x: c.x + 140, y: 18, 'text-anchor': 'middle', fill: P.ink, 'font-size': 15, 'font-weight': 700, 'font-family': 'Inter, system-ui, sans-serif' }); t.textContent = c.title;
        var st = STAGES[c.key];
        // flow line
        mk('line', { x1: c.x + 140, y1: st[0].y + 18, x2: c.x + 140, y2: st[st.length - 1].y + 18, stroke: P.line2, 'stroke-width': 2 });
        if (c.key === 'dl') {
          mk('rect', { x: c.x - 4, y: 98, width: 288, height: 106, rx: 14, fill: 'none', stroke: P.c0, 'stroke-width': 1.5, 'stroke-dasharray': '6 5' });
          var lt = mk('text', { x: c.x + 284, y: 94, 'text-anchor': 'end', fill: P.c0, 'font-size': 11, 'font-weight': 700, 'font-family': 'Inter, system-ui, sans-serif' }); lt.textContent = 'LEARNED, NOT WRITTEN';
        }
        st.forEach(function (s) {
          var hot = showWork && s.human;
          var g = mk('g', { class: 'pf-stage' + (sel === s.id ? ' is-sel' : ''), tabindex: 0, role: 'button', 'aria-label': s.label });
          var fill = hot ? P.c1 : s.learned ? (P.dark ? '#16263d' : '#e8f1fc') : P.surface2;
          var stroke = hot ? P.c1 : s.learned ? P.c0 : P.line2;
          mk('rect', { x: c.x, y: s.y, width: 280, height: s.learned ? 44 : 38, rx: 10, fill: fill, stroke: stroke, 'stroke-width': 1.5 }, g);
          var tx = mk('text', { x: c.x + 140, y: s.y + (s.learned ? 27 : 24), 'text-anchor': 'middle', fill: hot ? '#fff' : P.ink, 'font-size': 13.5, 'font-weight': 600, 'font-family': 'Inter, system-ui, sans-serif' }, g);
          tx.textContent = s.label;
          if (s.human) {
            var hx = c.x + 296, hy = s.y + 19;
            mk('circle', { cx: hx + 8, cy: hy - 6, r: 5, fill: P.c1 }, g);
            mk('path', { d: 'M' + (hx) + ' ' + (hy + 10) + ' q8 -14 16 0', fill: P.c1 }, g);
            var ht = mk('text', { x: hx - 2, y: hy + 24, fill: P.ink2, 'font-size': 10, 'font-family': 'Inter, system-ui, sans-serif' }, g); ht.textContent = 'you';
          }
          g.addEventListener('click', function () { sel = s.id; detail.innerHTML = s.text; render(); });
          g.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sel = s.id; detail.innerHTML = s.text; render(); } });
        });
        // particles
        for (var i = 0; i < 5; i++) {
          var p = mk('circle', { r: 4.5, cx: c.x + 140, cy: 0, fill: P.c0, opacity: 0.9 });
          particles.push({ el: p, col: c.key, phase: i / 5, x: c.x + 140 });
        }
      });
      if (showWork) {
        HUMAN_DL.forEach(function (tag) {
          var gg = mk('g', {});
          mk('rect', { x: tag.x, y: tag.y - 10, width: tag.w, height: 20, rx: 10, fill: P.c1 }, gg);
          var tt = mk('text', { x: tag.x + tag.w / 2, y: tag.y + 4, 'text-anchor': 'middle', fill: '#fff', 'font-size': 10.5, 'font-weight': 700, 'font-family': 'Inter, system-ui, sans-serif' }, gg);
          tt.textContent = tag.label;
        });
        detail.innerHTML = '<h5>The work does not disappear. It moves.</h5><p>In classical ML, human effort goes into <strong>writing features</strong>. In deep learning it moves to <strong>data preparation and labels, input scaling, architecture choice and loss design</strong> (the orange tags). Those are still human decisions, made at a higher level of abstraction.</p>';
      }
    }

    var t0 = performance.now();
    var loop = L.loop(root, function (now) {
      var t = (now - t0) / 1000;
      particles.forEach(function (p) {
        var f = (t * 0.22 + p.phase) % 1;
        var st = STAGES[p.col], y0 = st[0].y + 19, y1 = st[st.length - 1].y + 19, y = y0 + (y1 - y0) * f;
        p.el.setAttribute('cy', y);
        var col;
        if (p.col === 'ml') col = y > 140 ? P.c1 : P.c0;                          // changed abruptly, by hand
        else { var k = L.clamp((y - 110) / 120, 0, 1); col = 'rgb(' + L.mix(L.hexToRgb(P.c0), L.hexToRgb(P.c1), k).map(Math.round).join(',') + ')'; }  // changed gradually, by layers
        p.el.setAttribute('fill', col);
        p.el.setAttribute('opacity', f < 0.05 ? f / 0.05 : f > 0.95 ? (1 - f) / 0.05 : 0.9);
      });
    });
    render();
    if (!L.reducedMotion()) loop.start();
    L.onTheme(render);
  };
})();
