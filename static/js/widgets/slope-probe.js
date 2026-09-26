/* Slope Probe — a gradient is a local slope.
   The real loss of Lesson 1.2's network as ONE weight (v1 = W2[0,0]) changes, everything else fixed.
   Shows the tangent (true slope), the finite-difference secant for a chosen ε, and gradient-descent steps. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var X0 = [[0.5, -1.0], [1.5, 0.5], [-1.0, 1.0], [0.0, -0.5]], Y0 = [1, 1, 0, 0];
  var W1 = [[0.50, -0.20], [0.30, 0.80]], b1 = [0.10, -0.15], W2b = -0.40, b2 = 0.20;
  function loss(v1) {
    var s = 0;
    X0.forEach(function (x, k) {
      var a = [0, 1].map(function (j) { return Math.max(0, x[0] * W1[0][j] + x[1] * W1[1][j] + b1[j]); });
      var p = 1 / (1 + Math.exp(-(a[0] * v1 + a[1] * W2b + b2)));
      s += -(Y0[k] * Math.log(p) + (1 - Y0[k]) * Math.log(1 - p));
    });
    return s / 4;
  }
  function slope(v) { var h = 1e-6; return (loss(v + h) - loss(v - h)) / (2 * h); }

  window.DLP.widgets['slope-probe'] = function (root) {
    var P = L.palette(), v = 0.70, logEps = -1, lr = 5, trail = [];
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.66, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c0, label: 'loss as v₁ changes' }, { color: P.c1, label: 'tangent: the true slope' }, { color: P.c3, label: 'finite-difference secant' }]));
    var sV = L.slider({ label: 'Weight v₁ = W2[0,0]', min: -1.5, max: 3, step: 0.01, value: v, format: function (x) { return x.toFixed(2); }, onInput: function (x) { v = x; trail = []; draw(); } });
    var sE = L.slider({ label: 'Nudge size ε (finite difference)', min: -5, max: 0.3, step: 0.1, value: logEps, format: function (x) { return Math.pow(10, x).toExponential(0); }, onInput: function (x) { logEps = x; draw(); } });
    var sL = L.slider({ label: 'Learning rate η for a step', min: 0.5, max: 30, step: 0.5, value: lr, format: function (x) { return x.toFixed(1); }, onInput: function (x) { lr = x; } });
    var stS = L.stat('True slope ∂L/∂v₁', '—', 'hero'), stF = L.stat('Finite-difference estimate', '—'), stErr = L.stat('Estimate error', '—');
    var btn = L.button(L.icon('play') + ' Take a gradient-descent step', function () { trail.push(v); v = v - lr * slope(v); v = Math.max(-1.5, Math.min(3, v)); sV.set(v); draw(); }, 'primary');
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(sV.el); right.appendChild(L.el('div', { class: 'w-stats' }, [stS.el, stF.el, stErr.el])); right.appendChild(sE.el); right.appendChild(sL.el); right.appendChild(btn); right.appendChild(msg);

    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, W = cv.w, H = cv.h, lo = -1.5, hi = 3, ys = [];
      for (var i = 0; i <= 200; i++) ys.push(loss(lo + (hi - lo) * i / 200));
      var ymin = Math.min.apply(null, ys) - 0.02, ymax = Math.max.apply(null, ys) + 0.02;
      var X = function (x) { return 36 + (x - lo) / (hi - lo) * (W - 46); }, Y = function (y) { return H - 26 - (y - ymin) / (ymax - ymin) * (H - 40); };
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(36, H - 26); ctx.lineTo(W - 10, H - 26); ctx.stroke();
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif';
      [-1, 0, 1, 2, 3].forEach(function (t) { ctx.fillText(String(t), X(t) - 3, H - 10); });
      ctx.fillText('loss', 4, 14);
      ctx.strokeStyle = P.c0; ctx.lineWidth = 2.5; ctx.beginPath();
      ys.forEach(function (y, i) { var x = lo + (hi - lo) * i / 200; if (i) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y)); }); ctx.stroke();
      var L0 = loss(v), m = slope(v), eps = Math.pow(10, logEps), fd = (loss(v + eps) - L0) / eps;
      // tangent
      ctx.strokeStyle = P.c1; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(v - 0.8), Y(L0 - 0.8 * m)); ctx.lineTo(X(v + 0.8), Y(L0 + 0.8 * m)); ctx.stroke();
      // secant
      if (eps > 0.02) {
        ctx.strokeStyle = P.c3; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(X(v - 0.3), Y(L0 - 0.3 * fd)); ctx.lineTo(X(v + eps + 0.3), Y(L0 + (eps + 0.3) * fd)); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = P.c3; ctx.beginPath(); ctx.arc(X(v + eps), Y(loss(v + eps)), 4, 0, 7); ctx.fill();
      }
      trail.forEach(function (t, i) { ctx.fillStyle = P.ink3; ctx.globalAlpha = 0.3 + 0.7 * i / Math.max(1, trail.length); ctx.beginPath(); ctx.arc(X(t), Y(loss(t)), 4, 0, 7); ctx.fill(); });
      ctx.globalAlpha = 1;
      ctx.fillStyle = P.c1; ctx.strokeStyle = P.surface; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(v), Y(L0), 6.5, 0, 7); ctx.fill(); ctx.stroke();
      stS.set((m >= 0 ? '+' : '') + m.toFixed(4)); stF.set((fd >= 0 ? '+' : '') + fd.toFixed(4)); stErr.set(Math.abs(fd - m).toExponential(1));
      msg.className = 'w-msg';
      msg.innerHTML = 'Slope <strong>' + (m < 0 ? 'negative' : 'positive') + '</strong>: increasing v₁ would make the loss go <strong>' + (m < 0 ? 'down' : 'up') + '</strong>, so gradient descent will <strong>' + (m < 0 ? 'increase' : 'decrease') + '</strong> it. ' +
        (Math.abs(m) < 0.005 ? 'The slope is almost zero: we are near the bottom of this slice. ' : '') +
        (eps > 0.2 ? 'With a big ε the secant is a poor estimate of the tangent: it averages the slope over too wide a range.' : eps < 1e-4 ? 'A tiny ε gives an excellent estimate (in real code, far too tiny an ε suffers from floating-point round-off).' : '');
    }
    L.onTheme(draw);
    draw();
  };
})();
