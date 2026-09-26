/* Broadcast Bug — predictions (N,) against targets (N,1) silently become an N×N comparison.
   The heatmap shows every prediction compared with every target; only the diagonal is meaningful. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['broadcast-bug'] = function (root) {
    var P = L.palette(), N = 6, quality = 0.95, seed = 3;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    left.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('blocks') + ' (preds − targets)² for every pair: shape (N, N)' }));
    var cv = L.canvas(left, 1, draw, { cls: 'framed', maxHeight: 380 });
    left.appendChild(L.legend([{ color: P.green, label: 'diagonal: a prediction vs its OWN target' }, { color: P.c1, label: 'off-diagonal: vs someone else\'s target' }]));
    var sN = L.slider({ label: 'Batch size N', min: 2, max: 32, step: 1, value: N, onInput: function (v) { N = v; draw(); } });
    var sQ = L.slider({ label: 'How good the model is', min: 0, max: 1, step: 0.01, value: quality, format: function (v) { return v < 0.2 ? 'untrained' : v > 0.9 ? 'nearly perfect' : 'mediocre'; }, onInput: function (v) { quality = v; draw(); } });
    var stR = L.stat('Correct loss (N,) vs (N,)', '—'), stW = L.stat('Broadcast loss (N,) vs (N,1)', '—'), stX = L.stat('Ratio', '—', 'hero');
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(sN.el); right.appendChild(sQ.el);
    right.appendChild(L.el('div', { class: 'w-stats' }, [stR.el, stW.el]));
    right.appendChild(stX.el); right.appendChild(msg);
    function draw() {
      if (!cv) return;
      P = L.palette();
      var r = L.rng(seed), t = [], p = [];
      for (var i = 0; i < N; i++) { t.push(1 + 2 * i); }
      for (var j = 0; j < N; j++) p.push(quality * t[j] + (1 - quality) * (t[N >> 1]) + (r() - 0.5) * 0.6 * (1.05 - quality) * 4);
      var right_ = 0, wrong = 0, mx = 0, M = [];
      for (var a = 0; a < N; a++) { M.push([]); for (var b = 0; b < N; b++) { var e = (p[b] - t[a]) * (p[b] - t[a]); M[a].push(e); wrong += e; mx = Math.max(mx, e); } right_ += (p[a] - t[a]) * (p[a] - t[a]); }
      right_ /= N; wrong /= N * N;
      var ctx = cv.ctx, W = cv.w, H = cv.h, cs = Math.min(W, H) / N;
      ctx.clearRect(0, 0, W, H);
      var diag = L.hexToRgb(P.green), off = L.hexToRgb(P.c1), bg = L.hexToRgb(P.surface2);
      for (var y = 0; y < N; y++) for (var x = 0; x < N; x++) {
        var k = Math.sqrt(M[y][x] / (mx || 1)), c = L.mix(bg, x === y ? diag : off, 0.15 + 0.85 * k);
        ctx.fillStyle = 'rgb(' + c.map(Math.round).join(',') + ')';
        ctx.fillRect(x * cs + 1, y * cs + 1, cs - 2, cs - 2);
        if (x === y) { ctx.strokeStyle = P.green; ctx.lineWidth = 2; ctx.strokeRect(x * cs + 2, y * cs + 2, cs - 4, cs - 4); }
      }
      stR.set(right_.toFixed(4)); stW.set(wrong.toFixed(4));
      var ratio = wrong / Math.max(right_, 1e-9);
      stX.set(ratio >= 100 ? Math.round(ratio).toLocaleString() + '× too large' : ratio.toFixed(2) + '×');
      msg.className = 'w-msg' + (quality > 0.9 ? ' bad' : ' warn');
      msg.innerHTML = 'Only <strong>' + N + ' of ' + (N * N) + '</strong> comparisons (' + (100 / N).toFixed(1) + '%) pair a prediction with its own target. ' +
        (quality > 0.9 ? 'With a good model the broadcast loss is <strong>huge</strong>, so training looks like it refuses to learn, when in fact it learned fine and you measured it wrong.'
          : 'With a mediocre model the two losses are <strong>close</strong>, so nothing looks wrong, yet the model is optimising the wrong objective: pulling every prediction towards the <em>average</em> target. This is the version that goes unnoticed.') +
        ' Defence: <code>assert preds.shape == targets.shape</code>.';
    }
    L.onTheme(draw);
    draw();
  };
})();
