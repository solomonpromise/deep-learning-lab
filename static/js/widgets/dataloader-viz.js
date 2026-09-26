/* DataLoader Visualiser — how a Dataset's examples become batches.
   The dataset is stored in file order with the positives bunched at the end (like the Bank file's drift).
   Change batch_size, shuffle and drop_last, and start new epochs to see what the training loop receives. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['dataloader-viz'] = function (root) {
    var P = L.palette(), N = 22, bs = 4, shuffle = false, dropLast = false, epoch = 1, seed = 1;
    var labels = []; for (var i = 0; i < N; i++) labels.push(i >= 16 ? 1 : (i === 7 ? 1 : 0));
    var controls = L.el('div', { class: 'w-grid2 even' });
    var sBS = L.slider({ label: 'batch_size', min: 1, max: 11, step: 1, value: bs, onInput: function (v) { bs = v; paint(); } });
    var segS = L.segmented({ value: 'false', options: [{ value: 'false', label: 'shuffle=False' }, { value: 'true', label: 'shuffle=True' }], onChange: function (v) { shuffle = v === 'true'; paint(); } });
    var segD = L.segmented({ value: 'false', options: [{ value: 'false', label: 'drop_last=False' }, { value: 'true', label: 'drop_last=True' }], onChange: function (v) { dropLast = v === 'true'; paint(); } });
    var btn = L.button(L.icon('refresh') + ' Next epoch', function () { epoch++; seed++; paint(); }, 'primary');
    controls.appendChild(L.el('div', { class: 'w-col' }, [sBS.el, btn]));
    controls.appendChild(L.el('div', { class: 'w-col' }, [segS.el, segD.el]));
    var ds = L.el('div', {}), out = L.el('div', { class: 'w-col' }), msg = L.el('div', { class: 'w-msg' }), code = L.el('pre', { class: 'diagram', style: 'margin:0' });
    root.appendChild(L.el('div', { class: 'w-col' }, [controls, code, L.el('div', { class: 'w-panel-title', html: L.icon('database') + ' Dataset: ' + N + ' examples in storage order (orange = positive label)' }), ds, L.el('div', { class: 'w-panel-title', html: L.icon('layers') + ' What the training loop receives' }), out, msg]));
    function ball(i, dim) {
      return '<span style="display:inline-grid;place-items:center;width:28px;height:28px;border-radius:50%;margin:2px;font:700 11px var(--mono);color:#fff;background:' + (labels[i] ? P.c1 : P.c0) + ';' + (dim ? 'opacity:.3;outline:2px dashed var(--red);outline-offset:1px' : '') + '">' + i + '</span>';
    }
    function paint() {
      P = L.palette();
      var order = []; for (var i = 0; i < N; i++) order.push(i);
      if (shuffle) { var r = L.rng(seed * 7919); for (var k = N - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)), t = order[k]; order[k] = order[j]; order[j] = t; } }
      ds.innerHTML = '<div style="line-height:0">' + labels.map(function (_, idx) { return ball(idx); }).join('') + '</div>';
      var batches = []; for (var s = 0; s < N; s += bs) batches.push(order.slice(s, s + bs));
      var partial = batches.length && batches[batches.length - 1].length < bs;
      var html = '';
      batches.forEach(function (b, bi) {
        var dropped = partial && dropLast && bi === batches.length - 1;
        var rate = b.filter(function (x) { return labels[x]; }).length / b.length;
        html += '<div style="display:flex;align-items:center;gap:10px;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);' + (dropped ? 'opacity:.6' : '') + '"><span class="w-tag" style="min-width:78px;justify-content:center">batch ' + bi + '</span><span style="line-height:0">' + b.map(function (x) { return ball(x, dropped); }).join('') + '</span><span class="w-note" style="margin-left:auto;white-space:nowrap">' + (dropped ? '<strong style="color:var(--red)">dropped</strong>' : 'x: (' + b.length + ', F) · positives ' + Math.round(rate * 100) + '%') + '</span></div>';
      });
      out.innerHTML = html;
      var nb = dropLast && partial ? batches.length - 1 : batches.length;
      code.textContent = 'loader = DataLoader(ds, batch_size=' + bs + ', shuffle=' + (shuffle ? 'True' : 'False') + ', drop_last=' + (dropLast ? 'True' : 'False') + ')\nlen(loader) = ' + nb + '      # epoch ' + epoch;
      msg.className = 'w-msg' + (!shuffle ? ' warn' : ' good');
      msg.innerHTML = (!shuffle
        ? '<strong>No shuffle:</strong> batches follow storage order, so early batches are almost all negative and the last ones mostly positive. Consecutive gradient updates are correlated with the file order. Fine for validation; wrong for training.'
        : '<strong>Shuffled:</strong> each batch is a random mix, closer to the overall rate. Press <em>Next epoch</em>: the order changes every epoch, so the model never sees the same batches twice.') +
        (partial ? ' The last batch has only ' + batches[batches.length - 1].length + ' example' + (batches[batches.length - 1].length === 1 ? '' : 's') + (dropLast ? ', and <code>drop_last=True</code> throws it away (useful in training with BatchNorm, never in validation).' : ', which is usually fine.') : ' ' + N + ' divides evenly by ' + bs + ', so there is no partial batch.');
    }
    L.onTheme(paint);
    paint();
  };
})();
