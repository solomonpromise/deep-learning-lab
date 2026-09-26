/* Training Loop — the six canonical lines, executed one at a time on a model you can watch.
   A two-parameter line fit (ŷ = w·x + b) keeps every number visible. Toggle the classic bug
   (no optimizer.zero_grad()) and watch .grad pile up and the updates run away. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var XS = [-1, 0, 1, 2, 3], YS = [-1.1, 1.2, 2.8, 5.1, 7.0];      // roughly y = 2x + 1
  var LINES = [
    { code: 'model.train()', tip: '<strong>Training mode.</strong> Only matters for dropout and batch-norm, but the habit prevents bugs later.' },
    { code: 'optimizer.zero_grad()', tip: '<strong>Clear every <code>.grad</code> to 0.</strong> PyTorch <em>adds</em> new gradients to whatever is already stored.' },
    { code: 'preds = model(X)', tip: '<strong>Forward pass.</strong> Compute predictions (and silently record the computational graph).' },
    { code: 'loss = loss_fn(preds, y)', tip: '<strong>Loss.</strong> One number measuring how wrong the predictions are (mean squared error here).' },
    { code: 'loss.backward()', tip: '<strong>Backward pass.</strong> Compute ∂loss/∂w and ∂loss/∂b and <em>add</em> them into <code>.grad</code>.' },
    { code: 'optimizer.step()', tip: '<strong>Update.</strong> w ← w − lr·w.grad and b ← b − lr·b.grad (plain SGD, lr = 0.05).' }
  ];
  window.DLP.widgets['training-loop'] = function (root) {
    var P = L.palette(), bug = false, line = -1, epoch = 0, playing = false;
    var s = { w: -0.5, b: 0, gw: 0, gb: 0, preds: null, loss: null, hist: [] }, lr = 0.05;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2 even' }, [left, right]));
    var code = L.el('div', { class: 'code-cell', style: 'margin:0' });
    var pre = L.el('pre', { class: 'code', style: 'padding:10px 0' });
    var lineEls = LINES.map(function (l, i) {
      var sp = L.el('span', { class: 'ln', html: (i === 0 ? '<span class="k">for</span> epoch <span class="ow">in</span> range(epochs):\n    ' : '    ') + '<span class="n">' + l.code + '</span>' });
      return sp;
    });
    var head = L.el('span', { class: 'ln', html: '<span class="c1"># the canonical PyTorch training loop</span>' });
    var codeEl = L.el('code', {}, [head].concat(lineEls));
    pre.appendChild(codeEl); code.appendChild(pre); left.appendChild(code);
    var tip = L.el('div', { class: 'w-msg' });
    left.appendChild(tip);
    var btnStep = L.button('Run next line ' + L.icon('arrow-right'), function () { next(); }, 'primary');
    var btnPlay = L.button(L.icon('play') + ' Auto-play', function () { playing = !playing; btnPlay.innerHTML = playing ? L.icon('pause') + ' Pause' : L.icon('play') + ' Auto-play'; if (playing) loop.start(); });
    var btnReset = L.button(L.icon('refresh') + ' Reset', function () { reset(); });
    left.appendChild(L.el('div', { class: 'w-row' }, [btnStep, btnPlay, btnReset]));
    var bugSeg = L.segmented({ value: 'ok', options: [{ value: 'ok', label: 'Correct loop' }, { value: 'bug', label: 'Bug: delete zero_grad()' }], onChange: function (v) { bug = v === 'bug'; reset(); } });
    left.appendChild(bugSeg.el);

    var cv = L.canvas(right, 0.62, draw, { cls: 'framed' });
    var bars = L.el('div', { class: 'w-panel' });
    right.appendChild(bars);
    var lossBox = L.el('div', { class: 'w-panel' }, [L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Loss after each epoch' })]);
    var lc = L.canvas(lossBox, 0.3, function (ctx, w, h) { L.lineChart(ctx, w, h, [{ color: bug ? P.red : P.c0, values: s.hist.length ? s.hist : [NaN] }], { xlabel: 'epoch', ymin: 0 }); });
    right.appendChild(lossBox);

    function reset() { s = { w: -0.5, b: 0, gw: 0, gb: 0, preds: null, loss: null, hist: [] }; line = -1; epoch = 0; playing = false; btnPlay.innerHTML = L.icon('play') + ' Auto-play'; paint(); draw(); lc.redraw(); }
    function next() {
      line = (line + 1) % LINES.length;
      if (line === 0) epoch++;
      if (line === 1 && !bug) { s.gw = 0; s.gb = 0; }
      if (line === 2) s.preds = XS.map(function (x) { return s.w * x + s.b; });
      if (line === 3) { var m = 0; XS.forEach(function (x, i) { var e = s.w * x + s.b - YS[i]; m += e * e; }); s.loss = m / XS.length; }
      if (line === 4) { var gw = 0, gb = 0; XS.forEach(function (x, i) { var e = s.w * x + s.b - YS[i]; gw += 2 * e * x / XS.length; gb += 2 * e / XS.length; }); s.gw += gw; s.gb += gb; }
      if (line === 5) { s.w -= lr * s.gw; s.b -= lr * s.gb; s.hist.push(s.loss); lc.redraw(); }
      paint(); draw();
    }
    var last = 0;
    var loop = L.loop(root, function (t) { if (!playing) { loop.stop(); return; } if (t - last > (epoch < 3 ? 650 : 140)) { last = t; next(); if (epoch > 60 || Math.abs(s.w) > 1e4) { playing = false; btnPlay.innerHTML = L.icon('play') + ' Auto-play'; } } });

    function bar(label, v, max, col) {
      var pct = Math.min(100, Math.abs(v) / max * 50);
      return '<div style="display:grid;grid-template-columns:78px 1fr 70px;gap:8px;align-items:center;margin:5px 0;font-size:.82rem">' +
        '<code>' + label + '</code><div style="position:relative;height:14px;background:var(--surface);border-radius:4px;border:1px solid var(--line)">' +
        '<div style="position:absolute;top:0;bottom:0;left:50%;width:1px;background:var(--line-2)"></div>' +
        '<div style="position:absolute;top:1px;bottom:1px;border-radius:3px;background:' + col + ';' + (v >= 0 ? 'left:50%;width:' + pct + '%' : 'right:50%;width:' + pct + '%') + ';transition:all .3s"></div></div>' +
        '<span style="font-family:var(--mono);text-align:right">' + (Math.abs(v) > 999 ? v.toExponential(1) : v.toFixed(3)) + '</span></div>';
    }
    function paint() {
      P = L.palette();
      lineEls.forEach(function (el, i) {
        el.classList.toggle('is-hl', i === line);
        el.style.textDecoration = bug && i === 1 ? 'line-through' : '';
        el.style.opacity = bug && i === 1 ? 0.45 : 1;
      });
      tip.className = 'w-msg' + (bug && line === 1 ? ' bad' : '');
      tip.innerHTML = line < 0 ? 'Press <strong>Run next line</strong> to execute the loop one line at a time.' :
        '<strong>Epoch ' + epoch + ', line ' + (line + 1) + ':</strong> ' + (bug && line === 1 ? '<strong>Skipped!</strong> The old gradients stay in <code>.grad</code>, and the next backward pass adds on top of them.' : LINES[line].tip);
      bars.innerHTML = '<div class="w-panel-title">' + L.icon('database') + ' Parameters and their .grad</div>' +
        bar('w', s.w, 4, P.c0) + bar('b', s.b, 4, P.c0) + bar('w.grad', s.gw, bug ? Math.max(10, Math.abs(s.gw)) : 10, bug ? P.red : P.c1) + bar('b.grad', s.gb, bug ? Math.max(10, Math.abs(s.gb)) : 10, bug ? P.red : P.c1) +
        '<p class="w-note" style="margin-top:6px">loss = <strong>' + (s.loss == null ? '—' : s.loss.toFixed(3)) + '</strong>' +
        (bug && epoch > 2 ? ' · <span style="color:var(--red);font-weight:700">.grad now holds the SUM of ' + epoch + ' epochs of gradients: the steps overshoot and the fit swings.</span>' : '') + '</p>';
    }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, W = cv.w, H = cv.h, X = function (x) { return 20 + (x + 1.5) / 5 * (W - 40); }, Y = function (y) { return H - 20 - (y + 3) / 13 * (H - 40); };
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(X(-1.5), Y(0)); ctx.lineTo(X(3.5), Y(0)); ctx.moveTo(X(0), Y(-3)); ctx.lineTo(X(0), Y(10)); ctx.stroke();
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, W, H); ctx.clip();
      ctx.strokeStyle = bug ? P.red : P.c1; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(X(-1.5), Y(s.w * -1.5 + s.b)); ctx.lineTo(X(3.5), Y(s.w * 3.5 + s.b)); ctx.stroke();
      ctx.restore();
      XS.forEach(function (x, i) {
        ctx.fillStyle = P.c0; ctx.strokeStyle = P.surface; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(x), Y(YS[i]), 5, 0, 7); ctx.fill(); ctx.stroke();
        if (s.preds && line >= 2) { ctx.strokeStyle = P.ink3; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(x), Y(YS[i])); ctx.lineTo(X(x), Y(s.w * x + s.b)); ctx.stroke(); ctx.setLineDash([]); }
      });
      ctx.fillStyle = P.ink2; ctx.font = '12px Inter, system-ui, sans-serif'; ctx.fillText('ŷ = ' + s.w.toFixed(2) + '·x + ' + s.b.toFixed(2), 12, 18);
    }
    L.onTheme(function () { paint(); draw(); lc.redraw(); });
    reset();
  };
})();
