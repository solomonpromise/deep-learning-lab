/* Neuron Playground — one neuron: weighted sum + bias, then an activation.
   Shows the arithmetic, the activation curve with the current z, and what the neuron "sees" across the input plane. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var ACTS = {
    none: { label: 'None (linear)', f: function (z) { return z; } },
    relu: { label: 'ReLU', f: function (z) { return Math.max(0, z); } },
    sigmoid: { label: 'Sigmoid', f: function (z) { return 1 / (1 + Math.exp(-z)); } },
    tanh: { label: 'Tanh', f: function (z) { return Math.tanh(z); } }
  };
  window.DLP.widgets['neuron-playground'] = function (root) {
    var P = L.palette();
    var s = { x1: 0.5, x2: -1.0, w1: 0.5, w2: 0.3, b: 0.1, act: 'relu' };
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var eq = L.el('div', { class: 'w-panel', style: 'font-family:var(--mono);font-size:.84rem;line-height:1.8' });
    left.appendChild(eq);
    var plotsRow = L.el('div', { class: 'w-grid2 even' });
    var curveBox = L.el('div', { class: 'w-col' }), planeBox = L.el('div', { class: 'w-col' });
    plotsRow.appendChild(curveBox); plotsRow.appendChild(planeBox); left.appendChild(plotsRow);
    curveBox.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Activation f(z)' }));
    planeBox.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('eye') + ' Output across the input plane' }));
    var curve = L.canvas(curveBox, 0.8, draw, { cls: 'framed' });
    var plane = L.canvas(planeBox, 0.8, draw, { cls: 'framed' });
    var msg = L.el('div', { class: 'w-msg' });
    left.appendChild(msg);

    var seg = L.segmented({ value: s.act, options: Object.keys(ACTS).map(function (k) { return { value: k, label: ACTS[k].label }; }), onChange: function (v) { s.act = v; draw(); } });
    right.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('tune') + ' Activation function' }));
    right.appendChild(seg.el);
    [['x1', 'Input x₁', -2, 2], ['x2', 'Input x₂', -2, 2], ['w1', 'Weight w₁ (learned)', -2, 2], ['w2', 'Weight w₂ (learned)', -2, 2], ['b', 'Bias b (learned)', -2, 2]].forEach(function (d) {
      right.appendChild(L.slider({ label: d[1], min: d[2], max: d[3], step: 0.05, value: s[d[0]], format: function (v) { return v.toFixed(2); }, onInput: function (v) { s[d[0]] = v; draw(); } }).el);
    });

    function draw() {
      if (!plane || !curve) return;
      P = L.palette();
      var f = ACTS[s.act].f, z = s.w1 * s.x1 + s.w2 * s.x2 + s.b, a = f(z);
      eq.innerHTML = 'z = w₁·x₁ + w₂·x₂ + b<br>&nbsp;&nbsp;= ' + s.w1.toFixed(2) + '×' + s.x1.toFixed(2) + ' + ' + s.w2.toFixed(2) + '×' + s.x2.toFixed(2) + ' + ' + s.b.toFixed(2) + ' = <strong>' + z.toFixed(3) + '</strong><br>a = ' + ACTS[s.act].label.split(' ')[0] + '(z) = <strong>' + a.toFixed(3) + '</strong>';
      // activation curve
      var c = curve.ctx, w = curve.w, h = curve.h, lo = -4, hi = 4, ylo = s.act === 'none' ? -4 : s.act === 'relu' ? -0.5 : s.act === 'tanh' ? -1.2 : -0.2, yhi = s.act === 'none' || s.act === 'relu' ? 4 : 1.2;
      var X = function (v) { return (v - lo) / (hi - lo) * w; }, Y = function (v) { return h - (v - ylo) / (yhi - ylo) * h; };
      c.clearRect(0, 0, w, h);
      c.strokeStyle = P.line2; c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(w, Y(0)); c.moveTo(X(0), 0); c.lineTo(X(0), h); c.stroke();
      c.strokeStyle = P.c3; c.lineWidth = 2.5; c.beginPath();
      for (var i = 0; i <= 200; i++) { var zz = lo + (hi - lo) * i / 200, yy = Y(Math.max(ylo, Math.min(yhi, f(zz)))); if (i) c.lineTo(X(zz), yy); else c.moveTo(X(zz), yy); }
      c.stroke();
      var zc = Math.max(lo, Math.min(hi, z));
      c.setLineDash([4, 4]); c.strokeStyle = P.ink3; c.beginPath(); c.moveTo(X(zc), Y(0)); c.lineTo(X(zc), Y(Math.max(ylo, Math.min(yhi, a)))); c.stroke(); c.setLineDash([]);
      c.fillStyle = P.c1; c.strokeStyle = P.surface; c.lineWidth = 2; c.beginPath(); c.arc(X(zc), Y(Math.max(ylo, Math.min(yhi, a))), 6, 0, 7); c.fill(); c.stroke();
      c.fillStyle = P.ink3; c.font = '11px Inter, system-ui, sans-serif'; c.fillText('z →', w - 24, Y(0) - 5);
      // input plane
      var pc = plane.ctx, pw = plane.w, ph = plane.h, N = 50, img = pc.createImageData(N, N), vals = [], mx = 1e-9, mn = 1e9;
      for (var j = 0; j < N; j++) for (var k = 0; k < N; k++) {
        var x1 = -2 + 4 * (k + 0.5) / N, x2 = 2 - 4 * (j + 0.5) / N, v = f(s.w1 * x1 + s.w2 * x2 + s.b);
        vals.push(v); mx = Math.max(mx, v); mn = Math.min(mn, v);
      }
      var low = L.hexToRgb(P.c1), high = L.hexToRgb(P.c0), mid = L.hexToRgb(P.surface2);
      vals.forEach(function (v, q) {
        var t = (v - mn) / Math.max(1e-9, mx - mn), col = t > 0.5 ? L.mix(mid, high, (t - 0.5) * 2) : L.mix(mid, low, (0.5 - t) * 2);
        img.data[q * 4] = col[0]; img.data[q * 4 + 1] = col[1]; img.data[q * 4 + 2] = col[2]; img.data[q * 4 + 3] = 255;
      });
      var off = document.createElement('canvas'); off.width = N; off.height = N; off.getContext('2d').putImageData(img, 0, 0);
      pc.clearRect(0, 0, pw, ph); pc.imageSmoothingEnabled = true; pc.drawImage(off, 0, 0, pw, ph);
      // boundary z = 0 : w1 x1 + w2 x2 + b = 0
      var toP = function (x1, x2) { return [(x1 + 2) / 4 * pw, (2 - x2) / 4 * ph]; };
      if (Math.abs(s.w2) > 1e-6 || Math.abs(s.w1) > 1e-6) {
        var pts = Math.abs(s.w2) > Math.abs(s.w1) ? [[-2, (-s.b - s.w1 * -2) / s.w2], [2, (-s.b - s.w1 * 2) / s.w2]] : [[(-s.b - s.w2 * -2) / s.w1, -2], [(-s.b - s.w2 * 2) / s.w1, 2]];
        var p1 = toP(pts[0][0], pts[0][1]), p2 = toP(pts[1][0], pts[1][1]);
        pc.strokeStyle = P.ink; pc.lineWidth = 2; pc.setLineDash([6, 4]); pc.beginPath(); pc.moveTo(p1[0], p1[1]); pc.lineTo(p2[0], p2[1]); pc.stroke(); pc.setLineDash([]);
      }
      var cp = toP(s.x1, s.x2);
      pc.fillStyle = P.ink; pc.strokeStyle = P.surface; pc.lineWidth = 2; pc.beginPath(); pc.arc(cp[0], cp[1], 6, 0, 7); pc.fill(); pc.stroke();
      msg.className = 'w-msg' + (s.act === 'relu' && z <= 0 ? ' warn' : '');
      msg.innerHTML = (s.act === 'relu' && z <= 0 ? '<strong>This neuron is switched off for this input.</strong> z is negative, so ReLU outputs exactly 0: the neuron contributes nothing, and no gradient flows back through it for this example. ' : '') +
        'The dashed line in the right-hand plot is where <strong>z = 0</strong>: a neuron on its own always splits the plane with a <em>straight</em> line. ' +
        (s.act === 'none' ? 'With no activation the output is just z, a linear model.' : 'The activation only reshapes the output on either side of that line; curved boundaries appear when you <em>combine</em> many neurons.') +
        ' Changing <strong>b</strong> slides the line without rotating it. That is why a neuron needs a bias.';
    }
    L.onTheme(draw);
    draw();
  };
})();
