/* Momentum Valley — Lesson 3.1's stretched bowl f(x, y) = 0.05·x² + y², with plain SGD and SGD + momentum
   run side by side at the same learning rate (PyTorch's rule: v ← β·v + g,  p ← p − lr·v).
   Per direction the update is linear, so its fate is set by the roots of z² − (1 + β − lr·h)·z + β = 0
   (h = curvature: 0.1 along x, 2 along y). The largest |z| is the per-step shrink factor; above 1 it diverges. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var H = [0.1, 2.0], START = [-9, 2.5];
  var PRESETS = [
    { label: 'Lesson: lr 0.85, β 0.30', lr: 0.85, beta: 0.3 },
    { label: 'β = 0.9', lr: 0.85, beta: 0.9 },
    { label: 'lr 1.05: SGD diverges', lr: 1.05, beta: 0.3 },
    { label: 'Tiny lr 0.05', lr: 0.05, beta: 0.9 }
  ];
  function f(p) { return 0.05 * p[0] * p[0] + p[1] * p[1]; }
  function run(lr, beta, steps) {
    var p = START.slice(), v = [0, 0], path = [p.slice()];
    for (var s = 0; s < steps; s++) {
      for (var k = 0; k < 2; k++) { var g = H[k] * p[k]; v[k] = beta * v[k] + g; p[k] -= lr * v[k]; }
      path.push(p.slice());
      if (!isFinite(p[0]) || Math.abs(p[0]) > 1e6 || Math.abs(p[1]) > 1e6) break;
    }
    return path;
  }
  function rate(lr, beta, h) {          // largest |root| of z^2 - (1 + beta - lr h) z + beta
    var b = 1 + beta - lr * h, disc = b * b - 4 * beta;
    if (disc < 0) return Math.sqrt(beta);
    var s = Math.sqrt(disc);
    return Math.max(Math.abs((b + s) / 2), Math.abs((b - s) / 2));
  }
  window.DLP.widgets['momentum-valley'] = function (root) {
    var P = L.palette(), lr = 0.85, beta = 0.3, steps = 40;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.5, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.ink3, label: 'plain SGD (β = 0)' }, { color: P.c0, label: 'SGD + momentum' }, { color: P.c2, label: 'minimum' }]));
    var presets = L.el('div', { class: 'w-row' });
    var sLr = L.slider({ label: 'learning rate', min: 0.05, max: 1.4, step: 0.05, value: lr, format: function (v) { return v.toFixed(2); }, onInput: function (v) { lr = v; draw(); } });
    var sB = L.slider({ label: 'momentum β', min: 0, max: 0.95, step: 0.05, value: beta, format: function (v) { return v.toFixed(2); }, onInput: function (v) { beta = v; draw(); } });
    var sS = L.slider({ label: 'steps', min: 10, max: 120, step: 10, value: steps, onInput: function (v) { steps = v; draw(); } });
    PRESETS.forEach(function (pr) { presets.appendChild(L.button(pr.label, function () { lr = pr.lr; beta = pr.beta; sLr.set(lr); sB.set(beta); draw(); })); });
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    right.appendChild(presets); right.appendChild(sLr.el); right.appendChild(sB.el); right.appendChild(sS.el); right.appendChild(stats); right.appendChild(msg);

    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, X = function (x) { return (x + 10) / 20 * w; }, Y = function (y) { return h / 2 - y / 3 * (h / 2); };
      ctx.clearRect(0, 0, w, h);
      ctx.lineWidth = 1; ctx.strokeStyle = P.line2;
      [0.02, 0.1, 0.3, 0.8, 1.8, 3.5, 6, 9].forEach(function (c) {            // ellipses 0.05x² + y² = c
        ctx.beginPath(); ctx.ellipse(X(0), Y(0), Math.sqrt(c / 0.05) / 20 * w, Math.sqrt(c) / 3 * (h / 2), 0, 0, 7); ctx.stroke();
      });
      function path(pts, color, width) {
        ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
        ctx.beginPath();
        pts.forEach(function (p, i) { var px = L.clamp(X(p[0]), -50, w + 50), py = L.clamp(Y(p[1]), -50, h + 50); if (i) ctx.lineTo(px, py); else ctx.moveTo(px, py); });
        ctx.stroke();
        pts.forEach(function (p) { var px = X(p[0]), py = Y(p[1]); if (px > -5 && px < w + 5 && py > -5 && py < h + 5) { ctx.beginPath(); ctx.arc(px, py, 2.3, 0, 7); ctx.fill(); } });
      }
      var sgd = run(lr, 0, steps), mom = run(lr, beta, steps);
      path(sgd, P.ink3, 1.3); path(mom, P.c0, 1.8);
      ctx.fillStyle = P.c2; ctx.beginPath(); ctx.arc(X(0), Y(0), 5, 0, 7); ctx.fill();
      ctx.fillStyle = P.ink; ctx.fillRect(X(START[0]) - 4, Y(START[1]) - 4, 8, 8);
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText('x: shallow direction →', 8, h - 8); ctx.save(); ctx.translate(12, 18); ctx.fillText('y: steep ↕', 0, 0); ctx.restore();

      var rS = Math.max(rate(lr, 0, H[0]), rate(lr, 0, H[1])), rM = Math.max(rate(lr, beta, H[0]), rate(lr, beta, H[1]));
      var lS = f(sgd[sgd.length - 1]), lM = f(mom[mom.length - 1]);
      function fmt(v) { return !isFinite(v) || v > 1e5 ? 'diverged' : v < 1e-3 ? v.toExponential(1) : v.toFixed(3); }
      stats.innerHTML = '';
      [['SGD loss after ' + steps, fmt(lS), lS > 1e5 || !isFinite(lS) ? 'bad' : ''],
       ['Momentum loss after ' + steps, fmt(lM), lM > 1e5 || !isFinite(lM) ? 'bad' : lM < lS ? 'good' : ''],
       ['SGD shrink / step', rS.toFixed(3), rS >= 1 ? 'bad' : ''],
       ['Momentum shrink / step', rM.toFixed(3), rM >= 1 ? 'bad' : rM < rS ? 'good' : '']
      ].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      var yMult = 1 - lr * 2;
      if (rS >= 1 && rM < 1) {
        msg.className = 'w-msg good';
        msg.innerHTML = '<strong>Plain SGD diverges; momentum does not.</strong> In the steep direction SGD multiplies <em>y</em> by 1 − 2·lr = ' + yMult.toFixed(2) + ' every step, and that size is above 1. With momentum the limit on this bowl moves out to <strong>lr &lt; 1 + β = ' + (1 + beta).toFixed(2) + '</strong>: here, momentum makes a larger learning rate <em>stable</em>, not the reverse.';
      } else if (rM >= 1 && rS >= 1) {
        msg.className = 'w-msg bad';
        msg.innerHTML = 'Both diverge: every step overshoots the steep walls by more than it corrects. On this bowl SGD needs lr &lt; 1 and momentum needs lr &lt; 1 + β.';
      } else if (beta >= 0.75 && lM > lS) {
        msg.className = 'w-msg warn';
        msg.innerHTML = '<strong>High momentum here is slow, not unstable.</strong> With β = ' + beta.toFixed(2) + ' the velocity keeps overshooting and the path <em>rings</em> around the minimum: each oscillation shrinks by only √β ≈ ' + Math.sqrt(beta).toFixed(3) + ' per step. In this ringing regime that figure does not depend on the learning rate at all: β, not lr, sets how fast the path settles.';
      } else if (lM < lS) {
        msg.className = 'w-msg good';
        msg.innerHTML = 'Momentum wins: the steep-direction bounces cancel inside the velocity, while the steady pull along the valley floor adds up. Worst-direction shrink per step: ' + rS.toFixed(3) + ' for SGD, ' + rM.toFixed(3) + ' with momentum.';
      } else {
        msg.className = 'w-msg';
        msg.innerHTML = 'Similar results. Try the presets: the lesson\'s setting, β = 0.9, and a learning rate that breaks plain SGD.';
      }
    }
    L.onTheme(draw);
    draw();
  };
})();
