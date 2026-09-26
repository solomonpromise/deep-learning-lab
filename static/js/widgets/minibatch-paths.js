/* Mini-batch Paths — full-batch vs mini-batch gradient descent on the same loss surface.
   A two-weight linear regression: same data, same learning rate, same number of epochs.
   Full batch takes one exact step per epoch; mini-batches take N/B noisy steps per epoch. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['minibatch-paths'] = function (root) {
    var P = L.palette(), N = 512, B = 32, E = 4, lr = 0.08;
    var r = L.rng(11), X = [], Y = [], wTrue = [1.4, -0.6];
    for (var i = 0; i < N; i++) {
      var a = r.normal(), b = 0.55 * a + 0.85 * r.normal();
      X.push([a, b]); Y.push(wTrue[0] * a + wTrue[1] * b + 0.7 * r.normal());
    }
    function loss(w, idx) {
      var s = 0, n = idx ? idx.length : N;
      for (var k = 0; k < n; k++) { var j = idx ? idx[k] : k, e = X[j][0] * w[0] + X[j][1] * w[1] - Y[j]; s += e * e; }
      return s / (2 * n);
    }
    function grad(w, idx) {
      var g = [0, 0], n = idx ? idx.length : N;
      for (var k = 0; k < n; k++) { var j = idx ? idx[k] : k, e = X[j][0] * w[0] + X[j][1] * w[1] - Y[j]; g[0] += e * X[j][0]; g[1] += e * X[j][1]; }
      return [g[0] / n, g[1] / n];
    }
    var pathF = [], pathM = [], histF = [], histM = [], w0 = [-1.6, 1.9];
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.85, draw, { cls: 'framed', maxHeight: 440 });
    left.appendChild(L.legend([{ color: P.c0, label: 'full batch: 1 exact step per epoch' }, { color: P.c1, label: 'mini-batch: N/B noisy steps per epoch' }]));
    var sB = L.slider({ label: 'Batch size B', min: 0, max: 6, step: 1, value: 2, format: function (v) { return String([8, 16, 32, 64, 128, 256, 512][v]); }, onInput: function (v) { B = [8, 16, 32, 64, 128, 256, 512][v]; run(); } });
    var sE = L.slider({ label: 'Epochs (passes over all 512 rows)', min: 1, max: 10, step: 1, value: E, onInput: function (v) { E = v; run(); } });
    var stU = L.stat('Updates, full batch', '—'), stM = L.stat('Updates, mini-batch', '—'), stLF = L.stat('Final loss, full', '—'), stLM = L.stat('Final loss, mini', '—'), stC = L.stat('Gradient agreement (cosine)', '—');
    var lossBox = L.el('div', { class: 'w-panel' }, [L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Loss on all data, after each epoch' })]);
    var lc = L.canvas(lossBox, 0.42, function (ctx, w, h) { L.lineChart(ctx, w, h, [{ color: P.c0, values: histF.length ? histF : [NaN] }, { color: P.c1, values: histM.length ? histM : [NaN] }], { xlabel: 'epoch', ymin: 0 }); });
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(sB.el); right.appendChild(sE.el);
    right.appendChild(L.el('div', { class: 'w-stats' }, [stU.el, stM.el, stLF.el, stLM.el]));
    right.appendChild(stC.el); right.appendChild(lossBox); right.appendChild(msg);

    function run() {
      var rr = L.rng(5), wf = w0.slice(), wm = w0.slice(), idx = [], i;
      for (i = 0; i < N; i++) idx.push(i);
      pathF = [wf.slice()]; pathM = [wm.slice()]; histF = [loss(wf)]; histM = [loss(wm)];
      var cosSum = 0, cosN = 0;
      for (var e = 0; e < E; e++) {
        var g = grad(wf); wf = [wf[0] - lr * g[0], wf[1] - lr * g[1]]; pathF.push(wf.slice()); histF.push(loss(wf));
        for (var k = N - 1; k > 0; k--) { var j = Math.floor(rr() * (k + 1)), t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
        for (var s = 0; s < N; s += B) {
          var b = idx.slice(s, s + B), gb = grad(wm, b), gf = grad(wm);
          var dot = gb[0] * gf[0] + gb[1] * gf[1], nb = Math.hypot(gb[0], gb[1]), nf = Math.hypot(gf[0], gf[1]);
          if (nb > 0 && nf > 0) { cosSum += dot / (nb * nf); cosN++; }
          wm = [wm[0] - lr * gb[0], wm[1] - lr * gb[1]]; pathM.push(wm.slice());
        }
        histM.push(loss(wm));
      }
      stU.set(E.toLocaleString()); stM.set((E * Math.ceil(N / B)).toLocaleString());
      stLF.set(histF[histF.length - 1].toFixed(3)); stLM.set(histM[histM.length - 1].toFixed(3));
      stC.set(cosN ? (cosSum / cosN).toFixed(3) : '—');
      msg.className = 'w-msg';
      msg.innerHTML = B === N
        ? 'With B = 512 the "mini-batch" <em>is</em> the whole dataset: both runs are identical, one exact step per epoch.'
        : 'Both runs saw every row ' + E + ' time' + (E > 1 ? 's' : '') + '. The full-batch run moved only <strong>' + E + '</strong> time' + (E > 1 ? 's' : '') + '; the mini-batch run moved <strong>' + (E * Math.ceil(N / B)) + '</strong> times, each step computed from just ' + B + ' rows. Smaller batches mean more (and noisier) updates per epoch: the path wiggles, but it gets much further.';
      draw(); lc.redraw();
    }
    function draw() {
      if (!cv || !pathF.length) return;
      P = L.palette();
      var ctx = cv.ctx, W = cv.w, H = cv.h, lo0 = -2.2, hi0 = 2.4, lo1 = -1.6, hi1 = 2.4, G = 70;
      var toX = function (v) { return (v - lo0) / (hi0 - lo0) * W; }, toY = function (v) { return H - (v - lo1) / (hi1 - lo1) * H; };
      var vals = [], mx = 0, mn = 1e9;
      for (var gy = 0; gy < G; gy++) for (var gx = 0; gx < G; gx++) {
        var v = loss([lo0 + (gx + 0.5) / G * (hi0 - lo0), hi1 - (gy + 0.5) / G * (hi1 - lo1)]);
        vals.push(v); mx = Math.max(mx, v); mn = Math.min(mn, v);
      }
      var off = document.createElement('canvas'); off.width = G; off.height = G;
      var octx = off.getContext('2d'), id = octx.createImageData(G, G), lowC = L.hexToRgb(P.surface2), highC = L.hexToRgb(P.c0);
      vals.forEach(function (v, k) { var t = Math.pow((v - mn) / (mx - mn), 0.45), c = L.mix(highC, lowC, t); c = L.mix(c, lowC, 0.55); id.data[k * 4] = c[0]; id.data[k * 4 + 1] = c[1]; id.data[k * 4 + 2] = c[2]; id.data[k * 4 + 3] = 255; });
      octx.putImageData(id, 0, 0);
      ctx.clearRect(0, 0, W, H); ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, W, H);
      function path(pts, col, dot) {
        ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
        pts.forEach(function (p, k) { if (k) ctx.lineTo(toX(p[0]), toY(p[1])); else ctx.moveTo(toX(p[0]), toY(p[1])); }); ctx.stroke();
        pts.forEach(function (p, k) { if (dot || k === pts.length - 1) { ctx.fillStyle = col; ctx.beginPath(); ctx.arc(toX(p[0]), toY(p[1]), k === pts.length - 1 ? 5 : 3.5, 0, 7); ctx.fill(); } });
      }
      path(pathM, P.c1, false); path(pathF, P.c0, true);
      ctx.fillStyle = P.green; ctx.beginPath(); ctx.arc(toX(wTrue[0]), toY(wTrue[1]), 5, 0, 7); ctx.fill();
      ctx.fillStyle = P.ink2; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText('start', toX(w0[0]) + 8, toY(w0[1])); ctx.fillText('best weights', toX(wTrue[0]) + 8, toY(wTrue[1]) + 4);
    }
    L.onTheme(function () { draw(); lc.redraw(); });
    run();
  };
})();
