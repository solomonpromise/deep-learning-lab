/* Results Bars — animated side-by-side comparison of recorded results.
   props: { metrics: [{ title, note, better: 'higher'|'lower', unit, digits, max, rows: [{ label, value, series }] }], footnote } */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['results-bars'] = function (root, props) {
    var P = L.palette();
    var wrap = L.el('div', { class: 'rb-wrap' });
    root.appendChild(wrap);
    var bars = [];
    (props.metrics || []).forEach(function (m) {
      var box = L.el('div', { class: 'rb-metric' });
      box.appendChild(L.el('h5', { html: m.title + (m.note ? ' <span>' + m.note + '</span>' : '') }));
      var best = m.rows.reduce(function (a, r) { return (m.better === 'lower' ? r.value < a.value : r.value > a.value) ? r : a; }, m.rows[0]);
      var max = m.max || Math.max.apply(null, m.rows.map(function (r) { return r.value; })) * 1.08;
      var min = m.min || 0;
      m.rows.forEach(function (r) {
        var bar = L.el('span', { class: 'rb-bar' });
        var color = r.series === 1 ? P.c1 : r.series === 2 ? P.c2 : r.series === 3 ? P.c3 : P.c0;
        bar.style.background = color;
        var label = L.el('span', { html: r.label + (r === best && m.rows.length > 1 ? ' <span class="w-tag good win">best</span>' : '') });
        box.appendChild(L.el('div', { class: 'rb-row' }, [label, L.el('span', { class: 'rb-track' }, [bar]),
          L.el('span', { class: 'rb-val', text: r.value.toFixed(m.digits == null ? 3 : m.digits) + (m.unit || '') })]));
        bars.push({ el: bar, pct: 100 * (r.value - min) / (max - min), series: r.series });
      });
      wrap.appendChild(box);
    });
    if (props.footnote) wrap.appendChild(L.el('p', { class: 'w-note', html: props.footnote }));
    function grow() { bars.forEach(function (b, i) { setTimeout(function () { b.el.style.width = b.pct + '%'; }, 120 * i); }); }
    if ('IntersectionObserver' in window) {
      var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { grow(); io.disconnect(); } }, { threshold: 0.4 });
      io.observe(root);
    } else grow();
    L.onTheme(function () {
      P = L.palette();
      bars.forEach(function (b) { b.el.style.background = b.series === 1 ? P.c1 : b.series === 2 ? P.c2 : b.series === 3 ? P.c3 : P.c0; });
    });
  };
})();
