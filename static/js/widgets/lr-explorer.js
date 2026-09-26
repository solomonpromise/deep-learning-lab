/* Learning-Rate Explorer — the same gradient, three completely different outcomes.
   A ball rolls down a loss curve using w ← w − η·slope. Too small crawls, about right converges,
   too large overshoots, oscillates or diverges. props.curve: 'bowl' (default) | 'asym' */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['lr-explorer'] = function (root, props) {
    props = props || {};
    var P = L.palette(), lr = 0.1, w0 = -2.2, path = [], running = false;
    var Lf = function (w) { return 0.5 * (w - 1) * (w - 1) + 0.15 * Math.sin(3 * w) * (props.bumpy ? 1 : 0) + 0.1; };
    var dL = function (w) { var h = 1e-5; return (Lf(w + h) - Lf(w - h)) / (2 * h); };
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.62, draw, { cls: 'framed' });
    var presets = L.el('div', { class: 'w-row' });
    [['Too small (0.05)', 0.05], ['About right (0.6)', 0.6], ['Oscillating (1.7)', 1.7], ['Too large (2.1)', 2.1]].forEach(function (pr) {
      presets.appendChild(L.button(pr[0], function () { sLR.set(pr[1]); lr = pr[1]; reset(); run(); }));
    });
    var sLR = L.slider({ label: 'Learning rate η', min: 0.01, max: 2.2, step: 0.01, value: lr, format: function (v) { return v.toFixed(2); }, onInput: function (v) { lr = v; reset(); } });
    var btn = L.button(L.icon('play') + ' Run 25 steps', function () { reset(); run(); }, 'primary');
    var lossBox = L.el('div', { class: 'w-panel' }, [L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Loss after each step' })]);
    var lc = L.canvas(lossBox, 0.42, function (ctx, w, h) { L.lineChart(ctx, w, h, [{ color: P.c0, values: path.length ? path.map(Lf) : [NaN] }], { xlabel: 'step', ymin: 0, ymax: Math.max(0.6, Math.min(12, path.length ? Math.max.apply(null, path.map(Lf)) : 1)) }); });
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(sLR.el); right.appendChild(presets); right.appendChild(btn); right.appendChild(lossBox); right.appendChild(msg);

    function reset() { path = [w0]; running = false; draw(); lc.redraw(); setMsg(); }
    var last = 0;
    var loop = L.loop(root, function (t) {
      if (!running) { loop.stop(); return; }
      if (t - last < 110) return;
      last = t;
      var w = path[path.length - 1], nw = w - lr * dL(w);
      path.push(nw);
      if (path.length > 25 || Math.abs(nw) > 30) { running = false; setMsg(); }
      draw(); lc.redraw();
    });
    function run() { running = true; loop.start(); }
    function setMsg() {
      var r = 1 - lr;   // on a quadratic with curvature 1, each step multiplies the distance to the minimum by (1 − η)
      msg.className = 'w-msg' + (lr < 0.15 ? ' warn' : lr < 1 ? ' good' : lr < 2 ? ' warn' : ' bad');
      msg.innerHTML = lr < 0.15 ? '<strong>Too small.</strong> Every step goes the right way, but so slowly that after 25 steps you can barely tell learning from being stuck. Nothing looks broken, which is why this wastes so much time.'
        : lr < 1 ? '<strong>About right.</strong> Big early steps where the slope is steep, then smaller ones as the slope shrinks near the bottom.'
        : lr < 2 ? '<strong>Overshooting.</strong> Each step jumps past the minimum to the other side of the valley. It still converges here, but the loss curve zig-zags.'
        : '<strong>Too large: diverging.</strong> Each jump lands <em>higher</em> up the opposite wall than it started, so the loss grows every step. On a real network this ends in <code>inf</code> or <code>NaN</code>.';
      msg.innerHTML += ' <span class="muted">(Each step multiplies the distance to the minimum by ' + r.toFixed(2) + '.)</span>';
    }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, W = cv.w, H = cv.h, lo = -3.2, hi = 5.2, ymax = Lf(-3.2) + 0.3;
      var X = function (w) { return (w - lo) / (hi - lo) * W; }, Y = function (v) { return H - 16 - Math.min(v, ymax) / ymax * (H - 28); };
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = P.c0; ctx.lineWidth = 2.5; ctx.beginPath();
      for (var i = 0; i <= 200; i++) { var w = lo + (hi - lo) * i / 200; if (i) ctx.lineTo(X(w), Y(Lf(w))); else ctx.moveTo(X(w), Y(Lf(w))); }
      ctx.stroke();
      ctx.fillStyle = P.green; ctx.beginPath(); ctx.arc(X(1), Y(Lf(1)), 4, 0, 7); ctx.fill();
      ctx.strokeStyle = P.c1; ctx.lineWidth = 1.5; ctx.beginPath();
      path.forEach(function (w, k) { var x = X(Math.max(lo, Math.min(hi, w))), y = Y(Lf(w)); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }); ctx.stroke();
      path.forEach(function (w, k) {
        ctx.fillStyle = P.c1; ctx.globalAlpha = k === path.length - 1 ? 1 : 0.45;
        ctx.beginPath(); ctx.arc(X(Math.max(lo, Math.min(hi, w))), Y(Lf(w)), k === path.length - 1 ? 7 : 3.5, 0, 7); ctx.fill();
      });
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText('parameter w →', W - 90, H - 3); ctx.fillText('loss', 6, 14);
    }
    L.onTheme(function () { draw(); lc.redraw(); });
    reset();
  };
})();
