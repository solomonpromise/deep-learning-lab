/* Dropout Lab — one hidden layer of 12 units feeding one output, for one fixed input row.
   Training mode: each unit is zeroed with probability p and the survivors are multiplied by 1/(1−p)
   ("inverted dropout", what nn.Dropout does), so the output is right on average but different every pass.
   Evaluation mode: nothing is dropped or scaled, so the output is the same every time. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var ACT = [0.9, 0.1, 1.4, 0.0, 0.6, 1.1, 0.3, 0.8, 0.0, 1.7, 0.5, 0.2];
  var W = [0.8, -0.5, 0.6, 0.3, -0.9, 0.7, 0.4, -0.3, 0.9, 0.5, -0.6, 0.2];
  window.DLP.widgets['dropout-lab'] = function (root) {
    var P = L.palette(), p = 0.5, mode = 'train', seed = 1, history = [], mask = null;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var seg = L.segmented({ value: 'train', options: [{ value: 'train', label: '<code>model.train()</code>' }, { value: 'eval', label: '<code>model.eval()</code>' }], onChange: function (v) { mode = v; history = []; pass(); } });
    var sP = L.slider({ label: 'dropout probability p', min: 0, max: 0.9, step: 0.1, value: p, format: function (v) { return v.toFixed(1); }, onInput: function (v) { p = v; history = []; pass(); } });
    var btn = L.button(L.icon('play') + ' Same input, forward pass again', function () { pass(); }, 'primary');
    var cv = L.canvas(left, 0.5, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c0, label: 'kept (scaled by 1/(1−p) in training)' }, { color: P.line2, label: 'dropped' }]));
    var outs = L.el('div', { class: 'w-panel' });
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    right.appendChild(seg.el); right.appendChild(sP.el); right.appendChild(btn); right.appendChild(outs); right.appendChild(stats); right.appendChild(msg);
    var exact = ACT.reduce(function (s, a, i) { return s + a * W[i]; }, 0);
    function pass() {
      var r = L.rng(seed++);
      mask = ACT.map(function () { return mode === 'train' && r() < p ? 0 : 1; });
      var scale = mode === 'train' && p < 1 ? 1 / (1 - p) : 1;
      var y = ACT.reduce(function (s, a, i) { return s + a * mask[i] * scale * W[i]; }, 0);
      history.push(y); if (history.length > 12) history.shift();
      draw();
    }
    function draw() {
      if (!cv || !mask) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, n = ACT.length, bw = (w - 40) / n, scale = mode === 'train' ? 1 / (1 - p) : 1, top = 3.6;
      ctx.clearRect(0, 0, w, h);
      ACT.forEach(function (a, i) {
        var x = 20 + i * bw, kept = mask[i] === 1, v = kept ? a * scale : 0, hh = (h - 50) * Math.min(v, top) / top;
        ctx.fillStyle = kept ? P.c0 : P.line2;
        ctx.globalAlpha = kept ? 0.9 : 0.6;
        ctx.fillRect(x + 3, h - 30 - (kept ? hh : 6), bw - 6, kept ? hh : 6);
        ctx.globalAlpha = 1;
        if (kept && scale > 1 && a > 0) { ctx.strokeStyle = P.ink3; ctx.setLineDash([3, 3]); var h0 = (h - 50) * a / top; ctx.strokeRect(x + 3, h - 30 - h0, bw - 6, h0); ctx.setLineDash([]); }
        ctx.fillStyle = kept ? P.ink3 : P.red; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText(kept ? 'h' + (i + 1) : '×', x + bw / 2, h - 12);
      });
      ctx.textAlign = 'left'; ctx.fillStyle = P.ink3;
      ctx.fillText(mode === 'train' ? 'dashed outline = activation before the ×' + scale.toFixed(2) + ' rescale' : 'evaluation: every unit, unscaled', 20, 16);
      outs.innerHTML = '<div class="w-panel-title">Output of the last ' + history.length + ' passes (same input, same weights)</div><div class="do-outs">' +
        history.map(function (y) { return '<code>' + y.toFixed(3) + '</code>'; }).join(' ') + '</div>';
      var mean = history.reduce(function (s, y) { return s + y; }, 0) / history.length;
      var spread = Math.max.apply(null, history) - Math.min.apply(null, history);
      stats.innerHTML = '';
      [['Eval-mode output', exact.toFixed(3)], ['Mean of passes', mean.toFixed(3)], ['Spread of passes', spread.toFixed(3), spread > 1e-9 ? 'bad' : 'good']].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      msg.className = 'w-msg' + (mode === 'eval' ? ' good' : '');
      msg.innerHTML = mode === 'eval'
        ? '<strong>Deterministic.</strong> In evaluation mode <code>nn.Dropout</code> passes everything through unchanged, so the same input gives the same output on every pass. That is the model you validate and deploy.'
        : p === 0 ? 'With p = 0 dropout does nothing, even in training mode.'
        : '<strong>A different output on every pass.</strong> Each unit is dropped with probability ' + p.toFixed(1) + ' and the survivors are multiplied by 1/(1−p) = ' + scale.toFixed(2) + ', so the output is right <em>on average</em> (compare the mean with the eval-mode output after a few passes). Validating in this mode is the bug of Section 7: noisy, and usually worse.';
    }
    L.onTheme(draw);
    pass();
  };
})();
