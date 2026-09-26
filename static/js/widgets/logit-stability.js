/* Logit Stability — why the loss takes logits, not probabilities.
   Compares BCEWithLogitsLoss (stable), sigmoid → BCELoss in float32 (saturates and clamps at 100),
   and the "double sigmoid" bug (sigmoid in forward + BCEWithLogitsLoss). */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var f32 = Math.fround;
  function sig32(z) { return f32(1 / (1 + Math.exp(-f32(z)))); }
  function stable(z, y) { return Math.max(z, 0) - z * y + Math.log1p(Math.exp(-Math.abs(z))); }
  function naive(z, y) {
    var p = sig32(z);
    var l1 = p > 0 ? Math.max(Math.log(p), -100) : -100, l0 = (1 - p) > 0 ? Math.max(Math.log(f32(1 - p)), -100) : -100;
    return -(y * l1 + (1 - y) * l0);
  }
  function dbl(z, y) { return stable(1 / (1 + Math.exp(-z)), y); }
  window.DLP.widgets['logit-stability'] = function (root) {
    var P = L.palette(), z = 20, y = 0, show = { stable: true, naive: true, dbl: false };
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.62, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c0, label: 'BCEWithLogitsLoss(z, y)' }, { color: P.c1, label: 'BCELoss(sigmoid(z), y), float32' }, { color: P.c3, label: 'BCEWithLogitsLoss(sigmoid(z), y): the double-sigmoid bug' }]));
    var segY = L.segmented({ value: 0, options: [{ value: 1, label: 'true label y = 1' }, { value: 0, label: 'true label y = 0' }], onChange: function (v) { y = v; draw(); } });
    var sZ = L.slider({ label: 'Model output: logit z', min: -40, max: 40, step: 0.5, value: z, format: function (v) { return v.toFixed(1); }, onInput: function (v) { z = v; draw(); } });
    var chk = L.segmented({ value: 'two', options: [{ value: 'two', label: 'Compare the two losses' }, { value: 'all', label: 'Also show the double-sigmoid bug' }], onChange: function (v) { show.dbl = v === 'all'; draw(); } });
    var stS = L.stat('Stable loss', '—'), stN = L.stat('Naive loss', '—'), stP = L.stat('sigmoid(z) in float32', '—');
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(segY.el); right.appendChild(sZ.el); right.appendChild(chk.el);
    right.appendChild(L.el('div', { class: 'w-stats' }, [stS.el, stN.el, stP.el])); right.appendChild(msg);
    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, W = cv.w, H = cv.h, lo = -40, hi = 40, ymax = 105;
      var X = function (v) { return 34 + (v - lo) / (hi - lo) * (W - 44); }, Y = function (v) { return H - 22 - Math.min(v, ymax) / ymax * (H - 34); };
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = P.line; ctx.lineWidth = 1;
      [0, 25, 50, 75, 100].forEach(function (g) { ctx.beginPath(); ctx.moveTo(34, Y(g)); ctx.lineTo(W - 10, Y(g)); ctx.stroke(); });
      ctx.fillStyle = P.ink3; ctx.font = '10.5px Inter, system-ui, sans-serif';
      [0, 50, 100].forEach(function (g) { ctx.fillText(String(g), 6, Y(g) + 4); });
      [-40, -20, 0, 20, 40].forEach(function (g) { ctx.fillText(String(g), X(g) - 6, H - 6); });
      function curve(fn, col, width) {
        ctx.strokeStyle = col; ctx.lineWidth = width; ctx.beginPath();
        for (var i = 0; i <= 400; i++) { var zz = lo + (hi - lo) * i / 400, v = fn(zz, y); if (i) ctx.lineTo(X(zz), Y(v)); else ctx.moveTo(X(zz), Y(v)); }
        ctx.stroke();
      }
      curve(naive, P.c1, 3.5); curve(stable, P.c0, 2);
      if (show.dbl) curve(dbl, P.c3, 2.5);
      ctx.setLineDash([4, 4]); ctx.strokeStyle = P.ink; ctx.beginPath(); ctx.moveTo(X(z), 8); ctx.lineTo(X(z), H - 22); ctx.stroke(); ctx.setLineDash([]);
      var s = stable(z, y), n = naive(z, y), p = sig32(z);
      stS.set(s.toFixed(4)); stN.set(n.toFixed(4)); stP.set(p === 1 ? '1.0 exactly' : p === 0 ? '0.0 exactly' : p.toExponential(3));
      var wrong = (y === 1 && z < 0) || (y === 0 && z > 0), saturated = (p === 1 && y === 0) || (p === 0 && y === 1);
      msg.className = 'w-msg' + (saturated ? ' bad' : show.dbl ? ' warn' : '');
      msg.innerHTML = (saturated
        ? '<strong>The naive path has broken.</strong> In float32 the sigmoid of ' + z.toFixed(1) + ' rounds to exactly ' + (p === 1 ? '1' : '0') + ', so it needs log(0) = −∞; <code>BCELoss</code> clamps that to 100. Every logit beyond this point gives the <em>same</em> loss, a flat line with no slope, so the optimiser gets no signal about which way to move. The stable loss is ' + s.toFixed(1) + ', still proportional to how wrong the model is.'
        : wrong ? 'Confidently wrong, but both losses still agree here. Push the logit further to find where float32 gives out (about |z| ≈ 17 for y = 0).'
          : 'On the correct side both losses agree and shrink towards 0.') +
        (show.dbl ? ' <strong>Double sigmoid (violet):</strong> the loss receives numbers squeezed into (0, 1) instead of free logits, so it can never go below ' + (y ? '0.31' : '0.69') + ' however right the model is, and its slope is tiny everywhere. It trains badly without ever raising an error.' : '');
    }
    L.onTheme(draw);
    draw();
  };
})();
