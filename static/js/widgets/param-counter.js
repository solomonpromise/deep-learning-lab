/* Parameter Counter — parameters and memory of a stack of Linear layers, from their widths alone.
   props.widths: initial widths string, props.training: show training memory (weights + grads + Adam). */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var BYTES = { fp32: 4, fp16: 2, bf16: 2, int8: 1 };
  function fmtB(b) { return b >= 1e9 ? (b / 1e9).toFixed(2) + ' GB' : b >= 1e6 ? (b / 1e6).toFixed(2) + ' MB' : b >= 1e3 ? (b / 1e3).toFixed(1) + ' KB' : b + ' B'; }
  window.DLP.widgets['param-counter'] = function (root, props) {
    props = props || {};
    var widths = props.widths || '50, 64, 32, 1', dtype = 'fp32';
    var input = L.el('input', { type: 'text', value: widths, 'aria-label': 'Layer widths', style: 'width:100%;padding:10px 12px;border-radius:10px;border:1px solid var(--line-2);background:var(--surface);color:var(--ink);font:600 14px var(--mono)' });
    var presets = L.el('div', { class: 'w-row' });
    [['Bank MLP', '50, 64, 32, 1'], ['Spiral net', '2, 64, 64, 1'], ['MNIST MLP', '784, 512, 256, 10'], ['10 × Linear(1000,1000)', '1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000, 1000'], ['GPT-2-sized FFN', '768, 3072, 768']].forEach(function (p) {
      presets.appendChild(L.button(p[0], function () { input.value = p[1]; paint(); }));
    });
    var seg = L.segmented({ value: dtype, options: [{ value: 'fp32', label: 'float32 (4 B)' }, { value: 'fp16', label: 'float16 (2 B)' }, { value: 'bf16', label: 'bfloat16 (2 B)' }, { value: 'int8', label: 'int8 (1 B)' }], onChange: function (v) { dtype = v; paint(); } });
    var table = L.el('div', {}), stats = L.el('div', { class: 'w-stats' });
    root.appendChild(L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-panel-title', html: L.icon('layers') + ' Layer widths, input first (comma-separated)' }), input, presets, seg.el, stats, table]));
    input.addEventListener('input', paint);
    function paint() {
      var w = input.value.split(/[,\s]+/).map(Number).filter(function (x) { return x > 0 && isFinite(x); });
      if (w.length < 2) { table.innerHTML = '<p class="w-note">Enter at least two widths.</p>'; stats.innerHTML = ''; return; }
      var rows = [], total = 0;
      for (var i = 0; i < w.length - 1; i++) { var wt = w[i] * w[i + 1], b = w[i + 1]; total += wt + b; rows.push([w[i] + ' → ' + w[i + 1], wt, b, wt + b]); }
      var big = rows.reduce(function (a, r) { return r[3] > a[3] ? r : a; }, rows[0]);
      var bytes = total * BYTES[dtype];
      stats.innerHTML = '';
      [['Parameters', total.toLocaleString(), 'hero'], ['Weights in memory', fmtB(bytes)], ['Training with Adam (≈4×)', fmtB(bytes * 4)]].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      table.innerHTML = '<div class="table-wrap" style="margin:0"><table><thead><tr><th>layer</th><th>weights</th><th>biases</th><th>total</th><th>share</th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr' + (r === big ? ' style="font-weight:700"' : '') + '><td><code>' + r[0] + '</code></td><td>' + r[1].toLocaleString() + '</td><td>' + r[2].toLocaleString() + '</td><td>' + r[3].toLocaleString() + '</td><td>' + (100 * r[3] / total).toFixed(1) + '%</td></tr>'; }).join('') +
        '</tbody></table></div><p class="w-note" style="margin-top:8px">Each layer contributes <code>in × out + out</code>. Memory = parameters × bytes per number. Training with Adam needs roughly 4× the weights (weights + gradients + two Adam moments), <em>before</em> counting activations (Lesson 4.3).</p>';
    }
    paint();
  };
})();
