/* Loss vs Accuracy — why we train on a smooth loss, not on accuracy.
   Tab 1: turn one weight and watch accuracy jump in steps while the loss changes smoothly.
   Tab 2: the binary cross-entropy penalty — confident and wrong is expensive. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var XS = [-2.2, -1.4, -0.7, -0.2, 0.3, 0.9, 1.5, 2.3], YS = [0, 0, 0, 1, 0, 1, 1, 1];
  var sig = function (z) { return 1 / (1 + Math.exp(-z)); };
  function stats(w) {
    var loss = 0, ok = 0;
    XS.forEach(function (x, i) { var p = sig(w * x + 0.1); loss += -(YS[i] * Math.log(p) + (1 - YS[i]) * Math.log(1 - p)); if ((p > 0.5 ? 1 : 0) === YS[i]) ok++; });
    return { loss: loss / XS.length, acc: ok / XS.length };
  }
  window.DLP.widgets['loss-vs-accuracy'] = function (root) {
    var P = L.palette(), w = -1.0, py = 0.7, yt = 1;
    var tabs = L.segmented({ value: 'a', options: [{ value: 'a', label: 'Why not optimise accuracy?' }, { value: 'b', label: 'The cross-entropy penalty' }], onChange: function (v) { A.hidden = v !== 'a'; B.hidden = v !== 'b'; drawAll(); } });
    root.appendChild(tabs.el);
    var A = L.el('div', { style: 'margin-top:14px' }), B = L.el('div', { style: 'margin-top:14px', hidden: 'hidden' });
    root.appendChild(A); root.appendChild(B);

    var aL = L.el('div', { class: 'w-col' }), aR = L.el('div', { class: 'w-col' });
    A.appendChild(L.el('div', { class: 'w-grid2' }, [aL, aR]));
    aL.appendChild(L.el('div', { class: 'w-panel-title', html: 'Accuracy as the weight changes' }));
    var cAcc = L.canvas(aL, 0.34, drawA, { cls: 'framed' });
    aL.appendChild(L.el('div', { class: 'w-panel-title', html: 'Loss (binary cross-entropy) as the weight changes' }));
    var cLoss = L.canvas(aL, 0.34, drawA, { cls: 'framed' });
    var sW = L.slider({ label: 'Model weight w', min: -3, max: 6, step: 0.01, value: w, format: function (v) { return v.toFixed(2); }, onInput: function (v) { w = v; drawA(); } });
    var stA = L.stat('Accuracy', '—'), stL = L.stat('Loss', '—');
    var msgA = L.el('div', { class: 'w-msg' });
    aR.appendChild(L.el('p', { class: 'w-note', html: 'A one-weight model, <code>p = sigmoid(w·x + 0.1)</code>, on 8 labelled points. Slide the weight slowly and compare the two plots.' }));
    aR.appendChild(sW.el); aR.appendChild(L.el('div', { class: 'w-stats' }, [stA.el, stL.el])); aR.appendChild(msgA);

    function curve(c, fn, lo, hi, ylo, yhi, color, step) {
      var ctx = c.ctx, W = c.w, H = c.h, X = function (v) { return (v - lo) / (hi - lo) * W; }, Y = function (v) { return H - 6 - (v - ylo) / (yhi - ylo) * (H - 12); };
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = color; ctx.lineWidth = 2.5; ctx.beginPath();
      var prev = null;
      for (var i = 0; i <= 400; i++) {
        var x = lo + (hi - lo) * i / 400, y = fn(x);
        if (i === 0) ctx.moveTo(X(x), Y(y));
        else if (step && prev !== y) { ctx.lineTo(X(x), Y(prev)); ctx.lineTo(X(x), Y(y)); }
        else ctx.lineTo(X(x), Y(y));
        prev = y;
      }
      ctx.stroke();
      ctx.strokeStyle = P.ink; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(w), 0); ctx.lineTo(X(w), H); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = color; ctx.strokeStyle = P.surface; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(w), Y(fn(w)), 5.5, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.ink3; ctx.font = '10.5px Inter, system-ui, sans-serif'; ctx.fillText(yhi.toFixed(1), 4, 12); ctx.fillText(ylo.toFixed(1), 4, H - 4);
    }
    function drawA() {
      if (!cAcc || !cLoss) return;
      P = L.palette();
      var s = stats(w);
      curve(cAcc, function (x) { return stats(x).acc; }, -3, 6, 0.3, 1, P.c1, true);
      curve(cLoss, function (x) { return stats(x).loss; }, -3, 6, 0, 2.2, P.c0, false);
      stA.set(L.fmtPct(s.acc)); stL.set(s.loss.toFixed(4));
      msgA.innerHTML = 'Accuracy is <strong>flat, flat, flat, then a sudden jump</strong>: nudging w by a tiny amount usually changes nothing, so it has no useful slope. The loss changes smoothly everywhere, so its slope always says <em>which way</em> to move w and <em>how much</em> it matters. <strong>Train on the loss; report the accuracy.</strong>';
    }

    var bL = L.el('div', { class: 'w-col' }), bR = L.el('div', { class: 'w-col' });
    B.appendChild(L.el('div', { class: 'w-grid2' }, [bL, bR]));
    var cB = L.canvas(bL, 0.6, drawB, { cls: 'framed' });
    bL.appendChild(L.legend([{ color: P.c0, label: 'true label = 1: loss = −log(p)' }, { color: P.c1, label: 'true label = 0: loss = −log(1 − p)' }]));
    var segY = L.segmented({ value: 1, options: [{ value: 1, label: 'True label = 1' }, { value: 0, label: 'True label = 0' }], onChange: function (v) { yt = v; drawB(); } });
    var sP = L.slider({ label: 'Predicted probability of class 1', min: 0.01, max: 0.99, step: 0.01, value: py, format: function (v) { return v.toFixed(2); }, onInput: function (v) { py = v; drawB(); } });
    var stB = L.stat('Loss for this prediction', '—', 'hero');
    var msgB = L.el('div', { class: 'w-msg' });
    bR.appendChild(segY.el); bR.appendChild(sP.el); bR.appendChild(stB.el); bR.appendChild(msgB);
    function drawB() {
      if (!cB) return;
      P = L.palette();
      var ctx = cB.ctx, W = cB.w, H = cB.h, X = function (p) { return 30 + p * (W - 40); }, Y = function (v) { return H - 24 - Math.min(5, v) / 5 * (H - 36); };
      ctx.clearRect(0, 0, W, H);
      ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(30, H - 24); ctx.lineTo(W - 10, H - 24); ctx.moveTo(30, 8); ctx.lineTo(30, H - 24); ctx.stroke();
      [[1, P.c0], [0, P.c1]].forEach(function (pair) {
        ctx.strokeStyle = pair[1]; ctx.lineWidth = pair[0] === yt ? 3 : 1.5; ctx.globalAlpha = pair[0] === yt ? 1 : 0.35; ctx.beginPath();
        for (var i = 1; i < 200; i++) { var p = i / 200, v = pair[0] ? -Math.log(p) : -Math.log(1 - p); if (i === 1) ctx.moveTo(X(p), Y(v)); else ctx.lineTo(X(p), Y(v)); }
        ctx.stroke(); ctx.globalAlpha = 1;
      });
      var loss = yt ? -Math.log(py) : -Math.log(1 - py);
      ctx.fillStyle = yt ? P.c0 : P.c1; ctx.strokeStyle = P.surface; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(py), Y(loss), 6, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText('0', 26, H - 8); ctx.fillText('1', W - 14, H - 8); ctx.fillText('predicted p →', W / 2 - 30, H - 8); ctx.fillText('5', 16, 14);
      stB.set(loss.toFixed(3));
      var correct = (py > 0.5 ? 1 : 0) === yt, conf = Math.abs(py - 0.5) * 2;
      msgB.className = 'w-msg' + (correct ? ' good' : conf > 0.6 ? ' bad' : ' warn');
      msgB.innerHTML = correct
        ? (conf > 0.8 ? 'Confident and right: a tiny loss.' : 'Right, but unsure: a moderate loss. Training will still push it to be more confident.')
        : (conf > 0.6 ? '<strong>Confident and wrong: a huge loss.</strong> This is where cross-entropy punishes hardest, and the gradient is largest.' : 'Wrong, but unsure: a noticeable loss.');
    }
    function drawAll() { drawA(); drawB(); }
    L.onTheme(drawAll);
    drawAll();
  };
})();
