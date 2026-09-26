/* Scale Contours — why feature scale matters to gradient descent.
   A two-weight loss surface whose curvature ratio equals the ratio of the features' variances.
   Unscaled features give a long, narrow valley: gradient descent zig-zags and crawls. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['scale-contours'] = function (root, props) {
    props = props || {};
    var P = L.palette();
    var st = { ratio: props.ratio || 40, eta: 0.9, path: [], w: null, steps: 0, running: false, done: false };
    var start = [-2.6, 2.4];
    var tol = 0.02;
    var names = props.names || ['weight on tenure', 'weight on TotalCharges'];

    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.8, draw, { cls: 'framed', maxHeight: 440 });

    var seg = L.segmented({ options: [{ value: 'raw', label: 'Raw features' }, { value: 'std', label: 'Standardised' }], value: 'raw', onChange: function (v) { st.ratio = v === 'std' ? 1 : sRatio.get(); sRatio.input.disabled = v === 'std'; reset(); } });
    var sRatio = L.slider({ label: 'How much larger one feature\'s scale is', min: 1, max: 80, step: 1, value: st.ratio, format: function (v) { return v + '×'; }, onInput: function (v) { if (seg.get() === 'raw') { st.ratio = v; reset(); } } });
    var sEta = L.slider({ label: 'Learning rate (as a fraction of the largest stable step)', min: 0.1, max: 1.9, step: 0.05, value: st.eta, format: function (v) { return v.toFixed(2); }, onInput: function (v) { st.eta = v; reset(); } });
    var stSteps = L.stat('Steps taken', '0', 'hero');
    var stLoss = L.stat('Loss', '—');
    var btn = L.button(L.icon('play') + ' Run gradient descent', function () { if (st.done) reset(); st.running = !st.running; btn.innerHTML = st.running ? L.icon('pause') + ' Pause' : L.icon('play') + ' Run gradient descent'; if (st.running) loop.start(); }, 'primary');
    var btnStep = L.button('One step', function () { step(); draw(); });
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(seg.el);
    right.appendChild(sRatio.el);
    right.appendChild(sEta.el);
    right.appendChild(L.el('div', { class: 'w-stats' }, [stSteps.el, stLoss.el]));
    right.appendChild(L.el('div', { class: 'w-row' }, [btn, btnStep]));
    right.appendChild(msg);

    // loss = 0.5 * (a*w1^2 + b*w2^2); a = 1 (small-scale feature), b = ratio (large-scale feature)
    function curv() { return [1, st.ratio]; }
    function loss(w) { var c = curv(); return 0.5 * (c[0] * w[0] * w[0] + c[1] * w[1] * w[1]); }
    function reset() {
      st.w = start.slice(); st.path = [st.w.slice()]; st.steps = 0; st.running = false; st.done = false;
      btn.innerHTML = L.icon('play') + ' Run gradient descent';
      update(); draw();
    }
    function step() {
      if (st.done) return;
      var c = curv(), lr = st.eta / Math.max(c[0], c[1]);
      st.w = [st.w[0] - lr * c[0] * st.w[0], st.w[1] - lr * c[1] * st.w[1]];
      st.path.push(st.w.slice()); st.steps++;
      var diverged = Math.abs(st.w[0]) > 50 || Math.abs(st.w[1]) > 50;
      if (loss(st.w) < tol * tol || st.steps >= 400 || diverged) { st.done = true; st.running = false; btn.innerHTML = L.icon('refresh') + ' Run again'; st.diverged = diverged; }
      update();
    }
    function update() {
      stSteps.set(st.steps + (st.done && !st.diverged && st.steps < 400 ? ' ✓' : ''));
      var lv = loss(st.w); stLoss.set(isFinite(lv) && lv < 1e6 ? lv.toFixed(4) : '∞');
      var c = curv();
      if (!st.steps) msg.className = 'w-msg', msg.innerHTML = st.ratio === 1
        ? 'Both features on the same scale: the loss surface is a round bowl, and <strong>the gradient points straight at the minimum</strong>.'
        : 'One feature is <strong>' + st.ratio + '×</strong> larger in scale, so the bowl is ' + st.ratio + '× steeper in that direction: a long, narrow valley. Press run and watch the path.';
      else if (st.done && st.diverged) msg.className = 'w-msg bad', msg.innerHTML = 'Diverged. Above 2.0 the step overshoots the steep direction further every time. The <strong>steepest</strong> direction decides the largest safe learning rate.';
      else if (st.done && st.steps >= 400) msg.className = 'w-msg warn', msg.innerHTML = 'Still not there after 400 steps. The learning rate had to be small enough for the steep direction, so progress along the gentle direction is painfully slow.';
      else if (st.done) msg.className = 'w-msg good', msg.innerHTML = 'Reached the minimum in <strong>' + st.steps + ' steps</strong>.' + (st.ratio > 1 ? ' Switch to <em>Standardised</em> and compare.' : ' Now switch back to raw features and compare.');
    }
    var W = 3.2;
    function tc(w, cw, ch) { return [cw / 2 + w[0] / W * cw / 2, ch / 2 - w[1] / W * ch / 2]; }
    function draw() {
      if (!cv || !st.w) return;
      P = L.palette();
      var ctx = cv.ctx, cw = cv.w, ch = cv.h, c = curv();
      ctx.clearRect(0, 0, cw, ch);
      // contours (ellipses), sequential blue: inner = darker
      var levels = [0.02, 0.1, 0.3, 0.7, 1.4, 2.5, 4, 6, 9];
      for (var i = levels.length - 1; i >= 0; i--) {
        var rx = Math.sqrt(2 * levels[i] / c[0]), ry = Math.sqrt(2 * levels[i] / c[1]);
        ctx.beginPath(); ctx.ellipse(cw / 2, ch / 2, rx / W * cw / 2, ry / W * ch / 2, 0, 0, 7);
        ctx.strokeStyle = P.c0; ctx.globalAlpha = 0.15 + 0.6 * (1 - i / levels.length); ctx.lineWidth = 1.2; ctx.stroke();
      }
      ctx.globalAlpha = 1;
      // axes
      ctx.strokeStyle = P.line2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(0, ch / 2); ctx.lineTo(cw, ch / 2); ctx.moveTo(cw / 2, 0); ctx.lineTo(cw / 2, ch); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText(names[0] + ' →', cw - 8 - ctx.measureText(names[0] + ' →').width, ch / 2 - 8);
      ctx.save(); ctx.translate(cw / 2 + 14, 10); ctx.rotate(Math.PI / 2); ctx.fillText(names[1] + ' →', 0, 0); ctx.restore();
      // minimum
      ctx.fillStyle = P.green; ctx.beginPath(); ctx.arc(cw / 2, ch / 2, 5, 0, 7); ctx.fill();
      // path
      ctx.strokeStyle = P.c1; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.beginPath();
      st.path.forEach(function (w, k) { var p = tc(w, cw, ch); if (k) ctx.lineTo(p[0], p[1]); else ctx.moveTo(p[0], p[1]); }); ctx.stroke();
      st.path.forEach(function (w, k) { var p = tc(w, cw, ch); ctx.beginPath(); ctx.arc(p[0], p[1], k === 0 ? 5 : 3, 0, 7); ctx.fillStyle = P.c1; ctx.fill(); ctx.strokeStyle = P.surface; ctx.lineWidth = 1.5; ctx.stroke(); });
    }
    var last = 0;
    var loop = L.loop(root, function (t) {
      if (!st.running) { loop.stop(); return; }
      if (t - last > 70) { last = t; step(); draw(); }
    });
    L.onTheme(draw);
    reset();
  };
})();
