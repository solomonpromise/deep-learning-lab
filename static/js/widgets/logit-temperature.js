/* Logit Temperature — what loss, ROC-AUC and accuracy can each see.
   250 simulated validation rows (30% positive) with calibrated logits and ROC-AUC ≈ 0.80. Multiply every
   logit by k (more or less confident) or add a constant b (shift every probability up or down) and watch
   which metric notices. Scaling keeps the order and the sign; shifting keeps only the order. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  function data() {
    var r = L.rng(11), d = 1.35, prior = Math.log(0.3 / 0.7), rows = [];
    for (var i = 0; i < 250; i++) {
      var y = i < 75 ? 1 : 0, x = r.normal() + (y ? d : 0);
      rows.push({ y: y, z: prior + d * x - d * d / 2 });   // the exact log-odds for this binormal setup
    }
    return rows;
  }
  function auc(rows, k) {
    var s = rows.slice().sort(function (a, b) { return a.z - b.z; }), rank = 0, pos = 0, sumR = 0;
    s.forEach(function (row, i) { if (row.y) { sumR += i + 1; pos++; } });
    var neg = s.length - pos;
    return k === 0 ? 0.5 : (sumR - pos * (pos + 1) / 2) / (pos * neg);
  }
  window.DLP.widgets['logit-temperature'] = function (root, props) {
    props = props || {};
    var P = L.palette(), rows = data(), k = props.k || 1, b = 0;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.56, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c0, label: 'actual: good' }, { color: P.c1, label: 'actual: bad' }]));
    var sK = L.slider({ label: 'multiply every logit by k', min: -1.3, max: 1.3, step: 0.01, value: Math.log10(k), format: function (v) { return '×' + Math.pow(10, v).toFixed(2); }, onInput: function (v) { k = Math.pow(10, v); draw(); } });
    var sB = L.slider({ label: 'then add b to every logit', min: -4, max: 4, step: 0.1, value: 0, format: function (v) { return (v >= 0 ? '+' : '') + v.toFixed(1); }, onInput: function (v) { b = v; draw(); } });
    var presets = L.el('div', { class: 'w-row' }, [
      L.button('Calibrated', function () { set(1, 0); }),
      L.button('Overfitted: ×8', function () { set(8, 0); }),
      L.button('Bug: ×3', function () { set(3, 0); }),
      L.button('Too cautious: ×0.3, −1', function () { set(0.3, -1); })
    ]);
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    right.appendChild(presets); right.appendChild(sK.el); right.appendChild(sB.el); right.appendChild(stats); right.appendChild(msg);
    function set(kk, bb) { k = kk; b = bb; sK.set(Math.log10(k)); sB.set(b); draw(); }
    function sig(z) { return 1 / (1 + Math.exp(-z)); }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, bins = 25, hg = [new Array(bins).fill(0), new Array(bins).fill(0)];
      var loss = 0, correct = 0, extreme = 0, above = 0;
      rows.forEach(function (row) {
        var p = sig(k * row.z + b), pc = Math.min(1 - 1e-12, Math.max(1e-12, p));
        loss += -(row.y ? Math.log(pc) : Math.log(1 - pc));
        if ((p > 0.5 ? 1 : 0) === row.y) correct++;
        if (p > 0.99 || p < 0.01) extreme++;
        if (p > 0.5) above++;
        hg[row.y][Math.min(bins - 1, Math.floor(p * bins))]++;
      });
      loss /= rows.length;
      ctx.clearRect(0, 0, w, h);
      var pad = 24, max = Math.max.apply(null, hg[0].concat(hg[1])) || 1, bw = (w - 2 * pad) / bins;
      [0, 1].forEach(function (y) {
        ctx.fillStyle = y ? P.c1 : P.c0; ctx.globalAlpha = 0.72;
        hg[y].forEach(function (c, i) { var hh = (h - 2 * pad) * c / max; ctx.fillRect(pad + i * bw + (y ? bw / 2 : 1), h - pad - hh, bw / 2 - 1, hh); });
      });
      ctx.globalAlpha = 1;
      ctx.strokeStyle = P.ink3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad + (w - 2 * pad) / 2, 8); ctx.lineTo(pad + (w - 2 * pad) / 2, h - pad); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('0', pad, h - 8); ctx.fillText('0.5', w / 2, h - 8); ctx.fillText('1', w - pad, h - 8); ctx.fillText('predicted P(bad)', w / 2, 14);
      ctx.textAlign = 'left';
      var A = auc(rows, k);
      stats.innerHTML = '';
      [['ROC-AUC', A.toFixed(3), ''], ['Log loss', loss.toFixed(3), loss > 0.7 ? 'bad' : loss < 0.51 ? 'good' : ''], ['Accuracy @ 0.5', L.fmtPct(correct / rows.length), ''], ['Beyond 0.01 / 0.99', L.fmtPct(extreme / rows.length), extreme / rows.length > 0.3 ? 'bad' : ''], ['Flagged bad (> 0.5)', String(above)]].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      msg.className = 'w-msg';
      msg.innerHTML = '<strong>ROC-AUC never moves:</strong> scaling by a positive k and adding b both keep every row in the same order. ' +
        (b === 0 ? 'Accuracy at 0.5 cannot move either while b = 0, because <code>σ(k·z) &gt; 0.5</code> exactly when <code>z &gt; 0</code>. Only the <strong>loss</strong> sees the change of confidence' + (k > 1.5 ? ': confident mistakes now cost far more.' : k < 0.7 ? ': every prediction is hedged towards 0.5.' : '.') :
          'Shifting by b moves rows across the 0.5 line, so <strong>accuracy changes too</strong>' + (above === 0 ? ', and here nothing is flagged bad at all: the over-regularised model of Section 9.' : '.'));
    }
    L.onTheme(draw);
    draw();
  };
})();
