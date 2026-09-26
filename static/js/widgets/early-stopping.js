/* Early Stopping — keep the best weights, not the last.
   A realistic validation-loss curve (falls, bottoms out, creeps up, with noise). Tune patience and
   min_delta and watch where training stops and which epoch's weights are restored. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['early-stopping'] = function (root, props) {
    props = props || {};
    var P = L.palette(), patience = props.patience || 5, minDelta = 0.0001, noise = 0.0015, E = 40, seed = 4;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.58, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c0, label: 'training loss' }, { color: P.c1, label: 'validation loss' }]));
    var sP = L.slider({ label: 'patience (epochs without improvement)', min: 1, max: 12, step: 1, value: patience, onInput: function (v) { patience = v; draw(); } });
    var sD = L.slider({ label: 'min_delta (smallest improvement that counts)', min: 0, max: 0.004, step: 0.0001, value: minDelta, format: function (v) { return v.toFixed(4); }, onInput: function (v) { minDelta = v; draw(); } });
    var sN = L.slider({ label: 'noise in the validation measurement', min: 0, max: 0.006, step: 0.0005, value: noise, format: function (v) { return v.toFixed(4); }, onInput: function (v) { noise = v; draw(); } });
    var btn = L.button(L.icon('refresh') + ' Another training run', function () { seed++; draw(); });
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    right.appendChild(sP.el); right.appendChild(sD.el); right.appendChild(sN.el); right.appendChild(btn); right.appendChild(stats); right.appendChild(msg);
    function curves() {
      var r = L.rng(seed), tr = [], va = [];
      for (var t = 1; t <= E; t++) {
        tr.push(0.262 + 0.12 * Math.exp(-t / 2.2) - 0.0006 * t + 0.0008 * r.normal());
        va.push(0.2845 + 0.028 * Math.exp(-t / 2.6) + 0.00009 * Math.pow(Math.max(0, t - 11), 2) + noise * r.normal());
      }
      return { tr: tr, va: va };
    }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var c = curves(), best = Infinity, bestE = 0, wait = 0, stopE = E, trueBest = 0;
      for (var e = 0; e < E; e++) {
        if (c.va[e] < best - minDelta) { best = c.va[e]; bestE = e + 1; wait = 0; }
        else { wait++; if (wait >= patience) { stopE = e + 1; break; } }
      }
      c.va.forEach(function (v, i) { if (v < c.va[trueBest]) trueBest = i; });
      var ch = L.lineChart(cv.ctx, cv.w, cv.h, [{ color: P.c0, values: c.tr }, { color: P.c1, values: c.va }], { xlabel: 'epoch', padL: 44, xoffset: 1 });
      var ctx = cv.ctx;
      ctx.fillStyle = P.dark ? 'rgba(236,106,105,.12)' : 'rgba(214,60,59,.08)';
      ctx.fillRect(ch.X(stopE - 1), 8, ch.X(E - 1) - ch.X(stopE - 1), cv.h - 30);
      ctx.fillStyle = P.green; ctx.strokeStyle = P.surface; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ch.X(bestE - 1), ch.Y(c.va[bestE - 1]), 6, 0, 7); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = P.red; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(ch.X(stopE - 1), 8); ctx.lineTo(ch.X(stopE - 1), cv.h - 22); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = P.ink2; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(stopE < E ? 'stop at ' + stopE : 'never stopped', Math.min(cv.w - 90, ch.X(stopE - 1) + 5), 20);
      stats.innerHTML = '';
      [['Best epoch (restored)', String(bestE), 'good'], ['Stopped at epoch', stopE < E ? String(stopE) : E + ' (budget)'], ['Epochs saved', String(E - stopE)], ['Missed true minimum by', String(Math.abs(trueBest + 1 - bestE)) + ' ep']].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      msg.className = 'w-msg';
      msg.innerHTML = 'Training keeps a running best. Each epoch that fails to beat it by at least <code>min_delta</code> adds one to a counter; when the counter reaches <code>patience</code>, training stops and the <strong>best</strong> weights (green dot) are restored, not the last ones. ' +
        (patience <= 2 ? 'With very low patience a single noisy epoch can stop training too early.' : patience >= 10 ? 'High patience is safe but wastes epochs past the minimum.' : '') +
        (noise > 0.004 ? ' With a noisy validation measurement, the "best" epoch is partly luck: that is what min_delta and a larger validation set protect against.' : '');
    }
    L.onTheme(draw);
    draw();
  };
})();
