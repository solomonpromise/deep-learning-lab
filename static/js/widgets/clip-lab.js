/* Clip Lab — one step off a cliff, with and without gradient clipping.
   Loss surface f(x, y) = 0.05·(x² + 3y²) + 3·σ(12·(x − 1)): a gentle bowl with a steep cliff at x = 1, the
   landscape Lesson 3.3 §4 describes. Plain gradient descent starts on the high side (x = 3). When it reaches
   the cliff face the gradient is enormous and one step throws the parameters far away; clip_grad_norm_
   rescales the gradient to at most max_norm before the step, keeping its direction and capping its length. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var MAX_NORMS = [0.1, 0.25, 0.5, 1, 2, 5];
  function sig(v) { return 1 / (1 + Math.exp(-v)); }
  function f(x, y) { return 0.05 * (x * x + 3 * y * y) + 3 * sig(12 * (x - 1)); }
  function grad(x, y) { var s = sig(12 * (x - 1)); return [0.1 * x + 36 * s * (1 - s), 0.3 * y]; }
  function path(lr, clip, maxNorm, steps) {
    var p = [3, 1.2], out = [p.slice()], worst = 0;
    for (var t = 0; t < steps; t++) {
      var g = grad(p[0], p[1]), n = Math.hypot(g[0], g[1]);
      worst = Math.max(worst, n);
      if (clip && n > maxNorm) { g = [g[0] * maxNorm / n, g[1] * maxNorm / n]; }
      p = [p[0] - lr * g[0], p[1] - lr * g[1]];
      out.push(p.slice());
    }
    return { pts: out, worst: worst };
  }
  window.DLP.widgets['clip-lab'] = function (root) {
    var lr = 1.0, mIdx = 3, steps = 40, P = L.palette();
    var sLr = L.slider({ label: 'Learning rate', min: 0.2, max: 2, step: 0.1, value: lr, format: function (v) { return v.toFixed(1); }, onInput: function (v) { lr = v; paint(); } });
    var sM = L.slider({ label: 'max_norm for clipping', min: 0, max: MAX_NORMS.length - 1, step: 1, value: mIdx, format: function (i) { return String(MAX_NORMS[i]); }, onInput: function (i) { mIdx = i; paint(); } });
    var holder = L.el('div'), stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [holder, L.el('div', { class: 'w-grid2 even' }, [sLr.el, sM.el]),
      L.legend([{ label: 'no clipping', color: L.css('--c1') }, { label: 'clip_grad_norm_', color: L.css('--c0') }]), stats, msg]));
    var cv = L.canvas(holder, 0.5, draw, { cls: 'framed', label: 'Loss surface with a cliff and two descent paths' });
    var A, B;
    function paint() {
      A = path(lr, false, 0, steps); B = path(lr, true, MAX_NORMS[mIdx], steps);
      var jump = 0; for (var i = 1; i < A.pts.length; i++) jump = Math.max(jump, Math.hypot(A.pts[i][0] - A.pts[i - 1][0], A.pts[i][1] - A.pts[i - 1][1]));
      var arrive = function (pts) { for (var k = 0; k < pts.length; k++) if (Math.hypot(pts[k][0], pts[k][1]) < 0.3) return k; return null; };
      var ta = arrive(A.pts), tb = arrive(B.pts);
      stats.innerHTML = '';
      [['Largest gradient norm met', A.worst.toFixed(1)], ['Biggest single step, unclipped', jump.toFixed(2), jump > 3 ? 'bad' : ''],
       ['Steps to reach the minimum, unclipped', ta == null ? 'not within ' + steps : String(ta), ta == null || (tb != null && ta > tb) ? 'bad' : ''],
       ['Steps to reach the minimum, clipped', tb == null ? 'not within ' + steps : String(tb), tb != null ? 'good' : '']]
        .forEach(function (x) { stats.appendChild(L.stat(x[0], x[1], x[2]).el); });
      msg.className = 'w-msg' + (jump > 3 ? ' warn' : '');
      msg.innerHTML = jump > 3
        ? 'On the cliff face the gradient norm reaches <strong>' + A.worst.toFixed(0) + '</strong>, so one unclipped step moves the parameters <strong>' + jump.toFixed(1) + '</strong> units and throws them far past the minimum. Clipping keeps the same direction but caps each step at learning rate × max_norm = ' + (lr * MAX_NORMS[mIdx]).toFixed(2) + ', so the path walks down the cliff instead. Clipping protects the update; it does not explain why the gradient was huge.'
        : 'At this learning rate even the unclipped path copes with the cliff. Raise the learning rate and watch the unclipped step explode.';
      draw();
    }
    function draw() {
      if (!cv || !A) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, x0 = -8, x1 = 4, y0 = -2.5, y1 = 2.5;
      var X = function (x) { return (x - x0) / (x1 - x0) * w; }, Y = function (y) { return h - (y - y0) / (y1 - y0) * h; };
      var img = ctx.createImageData(Math.max(1, Math.floor(w / 3)), Math.max(1, Math.floor(h / 3))), lo = L.hexToRgb(P.surface), hi = L.hexToRgb(P.dark ? '#2b3a52' : '#c9dcf3');
      for (var j = 0; j < img.height; j++) for (var i = 0; i < img.width; i++) {
        var xx = x0 + (i + 0.5) / img.width * (x1 - x0), yy = y1 - (j + 0.5) / img.height * (y1 - y0);
        var v = Math.min(1, f(xx, yy) / 5), c = L.mix(lo, hi, v), k = (j * img.width + i) * 4;
        img.data[k] = c[0]; img.data[k + 1] = c[1]; img.data[k + 2] = c[2]; img.data[k + 3] = 255;
      }
      var tmp = document.createElement('canvas'); tmp.width = img.width; tmp.height = img.height; tmp.getContext('2d').putImageData(img, 0, 0);
      ctx.clearRect(0, 0, w, h); ctx.imageSmoothingEnabled = true; ctx.drawImage(tmp, 0, 0, w, h);
      ctx.strokeStyle = P.ink3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(1), 0); ctx.lineTo(X(1), h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText('cliff', X(1) + 4, 14); ctx.fillText('minimum', X(0) - 20, Y(0) + 18);
      ctx.fillStyle = P.ink; ctx.beginPath(); ctx.arc(X(0), Y(0), 3, 0, 7); ctx.fill();
      [[A, P.c1], [B, P.c0]].forEach(function (pp) {
        ctx.strokeStyle = pp[1]; ctx.fillStyle = pp[1]; ctx.lineWidth = 2;
        ctx.beginPath(); pp[0].pts.forEach(function (p, i) { var px = X(Math.max(x0 - 1, Math.min(x1 + 1, p[0]))), py = Y(Math.max(y0 - 1, Math.min(y1 + 1, p[1]))); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); }); ctx.stroke();
        pp[0].pts.forEach(function (p) { ctx.beginPath(); ctx.arc(X(Math.max(x0, Math.min(x1, p[0]))), Y(Math.max(y0, Math.min(y1, p[1]))), 2.4, 0, 7); ctx.fill(); });
      });
    }
    L.onTheme(draw);
    paint();
  };
})();
