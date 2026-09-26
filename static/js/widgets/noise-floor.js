/* Noise Floor — how far a validation score moves when only the split changes.
   Dots: the lesson's ten ROC-AUCs for one configuration and one seed on ten different train/validation splits.
   The band is mean ± 2 standard deviations. Two configurations whose gap is smaller than that band have not
   been told apart. "Ten more splits" draws new scores from a normal distribution with the measured spread. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['noise-floor'] = function (root, props) {
    props = props || {};
    var base = props.values || [0.7777, 0.7874, 0.7714, 0.7857, 0.7928, 0.7410, 0.7789, 0.7582, 0.7899, 0.7797];
    var vals = base.slice(), gap = 0.012, seed = 3, measured = true;
    var P = L.palette();
    var cv = L.canvas(root, 0.3, draw, { cls: 'framed' });
    var sG = L.slider({ label: 'config A beats config B by', min: 0, max: 0.08, step: 0.002, value: gap, format: function (v) { return v.toFixed(3) + ' AUC'; }, onInput: function (v) { gap = v; draw(); } });
    var row = L.el('div', { class: 'w-row' }, [
      L.button(L.icon('refresh') + ' Ten more splits', function () { var r = L.rng(seed++), m = mean(base), s = sd(base); vals = base.map(function () { return m + s * r.normal(); }); measured = false; draw(); }),
      L.button('The lesson\'s ten splits', function () { vals = base.slice(); measured = true; draw(); })
    ]);
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [sG.el, row, stats, msg]));
    function mean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
    function sd(a) { var m = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / a.length); }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, lo = 0.72, hi = 0.84, X = function (v) { return 30 + (w - 60) * (v - lo) / (hi - lo); };
      var m = mean(vals), s = sd(vals), y0 = h * 0.62;
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = P.dark ? 'rgba(75,147,234,.16)' : 'rgba(42,120,214,.12)';
      ctx.fillRect(X(m - 2 * s), 10, X(m + 2 * s) - X(m - 2 * s), h - 40);
      ctx.strokeStyle = P.line2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(30, y0); ctx.lineTo(w - 30, y0); ctx.stroke();
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      for (var t = 0.72; t <= 0.8401; t += 0.02) { ctx.fillText(t.toFixed(2), X(t), h - 10); ctx.beginPath(); ctx.moveTo(X(t), y0 - 4); ctx.lineTo(X(t), y0 + 4); ctx.stroke(); }
      ctx.fillText('noise floor: mean ± 2 sd', X(m), 24);
      vals.forEach(function (v, i) { ctx.fillStyle = P.ink2; ctx.beginPath(); ctx.arc(X(v), y0 + ((i % 3) - 1) * 7, 4, 0, 7); ctx.fill(); });
      var a = m + gap / 2, b = m - gap / 2;
      [[b, 'B', P.c1], [a, 'A', P.c0]].forEach(function (c) {
        ctx.strokeStyle = c[2]; ctx.fillStyle = c[2]; ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.moveTo(X(c[0]), y0 - 34); ctx.lineTo(X(c[0]), y0 - 12); ctx.stroke();
        ctx.font = '700 12px Inter, system-ui, sans-serif'; ctx.fillText(c[1], X(c[0]), y0 - 38);
      });
      ctx.textAlign = 'left';
      stats.innerHTML = '';
      [['Mean AUC', m.toFixed(4)], ['Standard deviation', s.toFixed(4)], ['2 sd', (2 * s).toFixed(3)], ['A − B', gap.toFixed(3), gap > 2 * s ? 'good' : 'bad']].forEach(function (x) { stats.appendChild(L.stat(x[0], x[1], x[2]).el); });
      msg.className = 'w-msg ' + (gap > 2 * s ? 'good' : 'warn');
      msg.innerHTML = (measured ? 'The dots are the lesson\'s ten measurements: one configuration, one seed, ten splits. ' : 'Ten new splits drawn with the measured spread: the band itself moves. ') +
        (gap > 2 * s ? '<strong>A gap of ' + gap.toFixed(3) + ' is wider than the band.</strong> Still check it on more splits or seeds before calling it an improvement.'
          : '<strong>A beat B. A did not beat B.</strong> A gap of ' + gap.toFixed(3) + ' is smaller than the ordinary movement of this score between splits, so this experiment cannot tell the two apart.');
    }
    L.onTheme(draw);
    draw();
  };
})();
