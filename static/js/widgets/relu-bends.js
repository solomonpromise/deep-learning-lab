/* ReLU Bends — why non-linearity is structurally necessary.
   A 1 → H → 1 network on a single input x. Without an activation, any number of units still gives a
   straight line (the layers collapse). With ReLU, every unit adds a "hinge", and hinges build curves. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['relu-bends'] = function (root) {
    var P = L.palette(), H = 4, act = 'relu', seed = 3, net;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.62, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c3, label: 'network output f(x)' }, { color: P.ink3, label: 'each hidden unit\'s contribution' }]));
    var seg = L.segmented({ value: act, options: [{ value: 'none', label: 'No activation' }, { value: 'relu', label: 'ReLU' }], onChange: function (v) { act = v; draw(); } });
    var sH = L.slider({ label: 'Hidden units', min: 1, max: 12, step: 1, value: H, onInput: function (v) { H = v; build(); draw(); } });
    var btn = L.button(L.icon('refresh') + ' New random weights', function () { seed++; build(); draw(); }, 'primary');
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('tune') + ' Build a network' }));
    right.appendChild(seg.el); right.appendChild(sH.el); right.appendChild(btn); right.appendChild(msg);

    function build() {
      var r = L.rng(seed * 101 + H);
      net = [];
      for (var j = 0; j < H; j++) {
        // place each unit's hinge inside the visible range so every bend can be seen
        var w = (r() < 0.5 ? -1 : 1) * (0.6 + r() * 1.6), k = -2.6 + 5.2 * r();
        net.push({ w: w, b: -w * k, v: (r() < 0.5 ? -1 : 1) * (0.4 + r() * 1.2) });
      }
      net.b2 = r.normal() * 0.5;
    }
    function unit(u, x) { var z = u.w * x + u.b; return u.v * (act === 'relu' ? Math.max(0, z) : z); }
    function out(x) { var s = net.b2; for (var j = 0; j < net.length; j++) s += unit(net[j], x); return s; }
    function draw() {
      if (!cv || !net) return;
      P = L.palette();
      var c = cv.ctx, w = cv.w, h = cv.h, lo = -3, hi = 3, ys = [];
      for (var i = 0; i <= 240; i++) ys.push(out(lo + (hi - lo) * i / 240));
      var ymin = Math.min.apply(null, ys), ymax = Math.max.apply(null, ys), pad = (ymax - ymin) * 0.15 + 0.5;
      ymin -= pad; ymax += pad;
      var X = function (x) { return (x - lo) / (hi - lo) * w; }, Y = function (y) { return h - (y - ymin) / (ymax - ymin) * h; };
      c.clearRect(0, 0, w, h);
      c.strokeStyle = P.line; c.lineWidth = 1; c.beginPath(); c.moveTo(0, Y(0)); c.lineTo(w, Y(0)); c.moveTo(X(0), 0); c.lineTo(X(0), h); c.stroke();
      net.forEach(function (u) {
        c.strokeStyle = P.ink3; c.globalAlpha = 0.45; c.lineWidth = 1.2; c.beginPath();
        for (var i = 0; i <= 120; i++) { var x = lo + (hi - lo) * i / 120, yy = Y(unit(u, x)); if (i) c.lineTo(X(x), yy); else c.moveTo(X(x), yy); }
        c.stroke(); c.globalAlpha = 1;
        if (act === 'relu' && Math.abs(u.w) > 1e-6) {
          var k = -u.b / u.w;
          if (k > lo && k < hi) { c.fillStyle = P.c1; c.beginPath(); c.arc(X(k), Y(out(k)), 4, 0, 7); c.fill(); }
        }
      });
      c.strokeStyle = P.c3; c.lineWidth = 3; c.beginPath();
      ys.forEach(function (y, i) { var x = lo + (hi - lo) * i / 240; if (i) c.lineTo(X(x), Y(y)); else c.moveTo(X(x), Y(y)); });
      c.stroke();
      c.fillStyle = P.ink3; c.font = '11px Inter, system-ui, sans-serif'; c.fillText('x →', w - 24, Y(0) - 6);
      var bends = act === 'relu' ? net.filter(function (u) { var k = -u.b / u.w; return k > lo && k < hi; }).length : 0;
      msg.className = 'w-msg' + (act === 'none' ? ' warn' : ' good');
      msg.innerHTML = act === 'none'
        ? '<strong>A straight line, whatever the weights and however many units.</strong> Each unit is linear, and a sum of linear functions is linear: the whole network collapses to <em>one</em> linear layer, f(x) = w′·x + b′. Add units, re-randomise: it never bends.'
        : '<strong>' + bends + ' bend' + (bends === 1 ? '' : 's') + '</strong> (orange dots). Each ReLU unit is flat, then straight: a <em>hinge</em>. Adding hinges together gives a piecewise-linear curve, and with enough units it can approximate almost any shape. That one small act of clipping is what makes depth meaningful.';
    }
    L.onTheme(draw);
    build(); draw();
  };
})();
