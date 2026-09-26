/* Loss Contract — what shapes and dtypes each loss function expects, and what happens if you get it wrong.
   Behaviour matches current PyTorch (checked against torch 2.x). */
(function () {
  'use strict';
  var L = window.DLP.lib;
  // Verified against PyTorch 2.x: [loss][output shape][target shape][target dtype] -> outcome
  var ERR_CE_DT = 'RuntimeError: expected target dtype to be Long or Byte, but got Float. Cast with <code>labels.long()</code>.';
  var ERR_CE_2D = 'RuntimeError: 0D or 1D target tensor expected, multi-target not supported. Class-index targets must be shape (N,): use <code>labels.squeeze(1)</code>.';
  var ERR_PROB = 'RuntimeError: Expected floating point type for target with class probabilities. A target shaped like the logits is read as <em>probabilities</em> and must be float.';
  var CE_NOT_NC = 'CrossEntropyLoss wants logits of shape <strong>(N, C)</strong>, one score per class.';
  var ERR_BCE_SIZE = 'ValueError: Target size must be the same as input size. Make the shapes identical (<code>unsqueeze(1)</code> / <code>squeeze(1)</code>).';
  var ERR_BCE_DT = 'RuntimeError: result type Float can\'t be cast to the desired output type Long. BCE targets must be <strong>float</strong> 0.0/1.0: <code>labels.float()</code>.';
  var MSE_SILENT = '<strong>No error</strong>, only a UserWarning that scrolls past. The shapes <strong>broadcast</strong> to a bigger matrix and every prediction is compared with every target. The silent bug.';
  var MSE_ERR = 'RuntimeError: the size of tensor a must match the size of tensor b. The shapes cannot broadcast.';
  function verdict(loss, out, tgt, dt) {
    if (loss === 'ce') {
      if (out === 'NC') {
        if (tgt === 'N') return dt === 'long' ? { k: 'ok', t: '<strong>Correct.</strong> Logits (N, C) plus class indices (N,) as <code>long</code>. Softmax is applied inside the loss, so don\'t apply it yourself.' } : { k: 'err', t: ERR_CE_DT };
        if (tgt === 'N1') return { k: 'err', t: ERR_CE_2D };
        return dt === 'float' ? { k: 'warn', t: 'Accepted as <em>class probabilities</em> (soft labels, e.g. label smoothing or distillation). Correct only if each row is a probability distribution. For ordinary labels, pass indices of shape (N,).' } : { k: 'err', t: ERR_PROB };
      }
      if (out === 'N') return tgt === 'N' && dt === 'float' ? { k: 'silent', t: '<strong>Runs, and is meaningless.</strong> A 1-D input of length N is read as <em>one</em> example with N classes, and the float target as its probability distribution. ' + CE_NOT_NC } : { k: 'err', t: (tgt === 'N' ? ERR_PROB : ERR_CE_2D) + ' ' + CE_NOT_NC };
      if (tgt === 'N1' && dt === 'float') return { k: 'silent', t: '<strong>Runs, and is meaningless.</strong> One output column means one class, and softmax over a single class is always 1, so the loss is always 0 and nothing is learned. ' + CE_NOT_NC };
      if (tgt === 'N' && dt === 'long') return { k: 'err', t: 'IndexError: Target is out of bounds. With one output column there is only class 0. ' + CE_NOT_NC };
      return { k: 'err', t: (tgt === 'N' ? ERR_CE_DT : tgt === 'N1' ? ERR_PROB : ERR_CE_2D) + ' ' + CE_NOT_NC };
    }
    if (loss === 'bce') {
      if (out !== tgt) return { k: 'err', t: ERR_BCE_SIZE };
      if (dt === 'long') return { k: 'err', t: ERR_BCE_DT };
      if (out === 'NC') return { k: 'warn', t: 'Runs. (N, C) outputs with (N, C) float targets is the <em>multi-label</em> setup: each class is an independent yes/no. For one binary label, use one output column.' };
      return { k: 'ok', t: '<strong>Correct.</strong> Logits and float 0/1 targets of <em>identical</em> shape. The sigmoid is applied inside the loss.' };
    }
    if (out === tgt) return { k: 'ok', t: '<strong>Correct.</strong> Same shape.' + (dt === 'long' ? ' (Integer targets are promoted to float automatically; casting explicitly is still cleaner.)' : '') };
    if ((out === 'N' && tgt === 'NC') || (out === 'NC' && tgt === 'N')) return { k: 'err', t: MSE_ERR };
    return { k: 'silent', t: MSE_SILENT };
  }
  window.DLP.widgets['loss-contract'] = function (root) {
    var s = { loss: 'ce', out: 'NC', tgt: 'N', dt: 'float' };
    var box = L.el('div', { class: 'w-col' });
    root.appendChild(box);
    var qs = [
      ['loss', 'Loss function', [['ce', 'CrossEntropyLoss'], ['bce', 'BCEWithLogitsLoss'], ['mse', 'MSELoss']]],
      ['out', 'Model output shape', [['N', '(N,)'], ['N1', '(N, 1)'], ['NC', '(N, C)']]],
      ['tgt', 'Target shape', [['N', '(N,)'], ['N1', '(N, 1)'], ['NC', '(N, C)']]],
      ['dt', 'Target dtype', [['float', 'float32'], ['long', 'int64 (long)']]]
    ];
    var res = L.el('div', { class: 'dh-verdict' });
    qs.forEach(function (q) {
      box.appendChild(L.el('div', { class: 'dh-q' }, [L.el('span', { text: q[1] }), L.segmented({ value: s[q[0]], options: q[2].map(function (o) { return { value: o[0], label: o[1] }; }), onChange: function (v) { s[q[0]] = v; paint(); } }).el]));
    });
    box.appendChild(res);
    function paint() {
      var v = verdict(s.loss, s.out, s.tgt, s.dt);
      var meta = { ok: ['check', 'var(--green)', 'Works'], err: ['x', 'var(--red)', 'Raises an error (the lucky case)'], silent: ['alert', 'var(--orange)', 'Runs silently, WRONG result'], warn: ['info', 'var(--yellow)', 'Runs, but check your intent'] }[v.k];
      res.style.borderColor = meta[1];
      res.innerHTML = '<h5 style="color:' + meta[1] + '">' + L.icon(meta[0]) + ' ' + meta[2] + '</h5><p class="w-note" style="margin:0">' + v.t + '</p>';
    }
    paint();
  };
})();
