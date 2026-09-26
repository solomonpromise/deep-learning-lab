/* Spiral Lab — train three models on the two-spirals problem, live in the browser.
   Lesson 1.1: linear model on raw (x1, x2), linear model on hand-engineered polar features,
   and a small neural network on raw (x1, x2). */
(function () {
  'use strict';
  var L = window.DLP.lib;

  var MODELS = {
    linear: { name: 'Logistic regression', sub: 'raw x1, x2 — one straight line', short: 'Linear · raw' },
    features: { name: 'Logistic regression + your features', sub: 'r, sin α, cos α written by hand', short: 'Linear · engineered' },
    network: { name: 'Neural network', sub: 'raw x1, x2 — learns its own features', short: 'Network · raw' }
  };

  window.DLP.widgets['spiral-lab'] = function (root, props) {
    props = props || {};
    var P = L.palette();
    var state = {
      model: props.model || 'linear', rev: 2.5, noise: 0.04, n: 500, offset: 0, hidden: 32, depth: 2,
      training: false, epoch: 0, losses: [], net: null, feat: null, done: false, rnd: L.rng(3), maxEpochs: 0
    };
    var data, split;

    /* ---------------- layout */
    var modelBtns = {};
    var modelRow = L.el('div', { class: 'sl-models', role: 'radiogroup', 'aria-label': 'Choose a model' });
    Object.keys(MODELS).forEach(function (k) {
      var b = L.el('button', { type: 'button', class: 'sl-model', role: 'radio' }, [L.el('b', { text: MODELS[k].name }), L.el('span', { text: MODELS[k].sub })]);
      b.addEventListener('click', function () { setModel(k); });
      modelBtns[k] = b; modelRow.appendChild(b);
    });

    var left = L.el('div', { class: 'w-col' });
    var right = L.el('div', { class: 'w-col' });
    var grid = L.el('div', { class: 'w-grid2' }, [left, right]);
    root.appendChild(modelRow);
    root.appendChild(L.el('div', { style: 'height:14px' }));
    root.appendChild(grid);

    var canvasWrap = L.el('div', { class: 'w-rel' });
    left.appendChild(canvasWrap);
    var legend = L.legend([{ color: P.c0, label: 'class 0 (arm A)' }, { color: P.c1, label: 'class 1 (arm B)' }]);
    left.appendChild(legend);

    var msg = L.el('div', { class: 'w-msg' });
    var stAcc = L.stat('Test accuracy', '—', 'hero');
    var stTrain = L.stat('Train accuracy', '—');
    var stEpoch = L.stat('Epochs', '0');
    var stParams = L.stat('Parameters', '—');
    var stats = L.el('div', { class: 'w-stats' }, [stAcc.el, stTrain.el, stEpoch.el, stParams.el]);

    var btnTrain = L.button(L.icon('play') + ' Train', function () { toggleTrain(); }, 'primary');
    var btnReset = L.button(L.icon('refresh') + ' Reset', function () { resetModel(); draw(); });
    var btnRow = L.el('div', { class: 'w-row' }, [btnTrain, btnReset]);

    var lossBox = L.el('div', { class: 'w-panel' }, [L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Training loss (lower is better)' })]);
    var lossChart = L.canvas(lossBox, 0.32, function (ctx, w, h) { drawLoss(ctx, w, h); });

    var sRev = L.slider({ label: 'Spiral turns', min: 1, max: 3.5, step: 0.25, value: state.rev, format: function (v) { return v.toFixed(2); }, onChange: function (v) { state.rev = v; regen(); } });
    var sNoise = L.slider({ label: 'Noise', min: 0, max: 0.15, step: 0.01, value: state.noise, format: function (v) { return v.toFixed(2); }, onChange: function (v) { state.noise = v; regen(); } });
    var sN = L.slider({ label: 'Points per class', min: 25, max: 500, step: 25, value: state.n, onChange: function (v) { state.n = v; regen(); } });
    var sOff = L.slider({ label: 'Move the centre →', min: 0, max: 0.6, step: 0.05, value: 0, format: function (v) { return '(' + v.toFixed(2) + ', 0)'; }, hint: 'Hand-written features assume the centre is (0, 0).', onChange: function (v) { state.offset = v; regen(); } });
    var sHidden = L.slider({ label: 'Hidden units per layer', min: 2, max: 48, step: 2, value: state.hidden, onChange: function (v) { state.hidden = v; resetModel(); draw(); } });
    var sDepth = L.slider({ label: 'Hidden layers', min: 1, max: 3, step: 1, value: state.depth, onChange: function (v) { state.depth = v; resetModel(); draw(); } });
    var netControls = L.el('div', { class: 'w-col' }, [sHidden.el, sDepth.el]);

    var dataPanel = L.el('details', { class: 'w-panel', open: 'open' }, [
      L.el('summary', { class: 'w-panel-title', style: 'cursor:pointer', html: L.icon('database') + ' The data' }),
      L.el('div', { class: 'w-col' }, [sRev.el, sNoise.el, sN.el, sOff.el])
    ]);
    var netPanel = L.el('div', { class: 'w-panel' }, [L.el('div', { class: 'w-panel-title', html: L.icon('layers') + ' Network size' }), netControls]);

    right.appendChild(stats);
    right.appendChild(btnRow);
    right.appendChild(msg);
    right.appendChild(lossBox);
    right.appendChild(netPanel);
    right.appendChild(dataPanel);

    // peek inside
    var peek = L.el('details', { class: 'w-panel', style: 'margin-top:14px' });
    peek.appendChild(L.el('summary', { class: 'w-panel-title', style: 'cursor:pointer;margin:0', html: L.icon('eye') + ' Peek inside the network: what each hidden unit responds to' }));
    var peekBody = L.el('div', { style: 'margin-top:10px' });
    peek.appendChild(peekBody);
    peekBody.appendChild(L.el('p', { class: 'w-note', html: 'Each square is one hidden unit, drawn over the same input space as the big plot. <strong>Dark = the unit fires strongly.</strong> Layer 1 units can only draw straight edges (each is a line through the plane). Layer 2 units combine those edges into curved regions. The output layer is just a logistic regression sitting on top of them.' }));
    var l1Label = L.el('div', { class: 'sl-layer-label', text: 'Hidden layer 1 — simple features (straight edges)' });
    var l1Grid = L.el('div', { class: 'sl-units' });
    var l2Label = L.el('div', { class: 'sl-layer-label', text: 'Hidden layer 2 — combinations of layer-1 features (curves)' });
    var l2Grid = L.el('div', { class: 'sl-units' });
    peekBody.appendChild(l1Label); peekBody.appendChild(l1Grid); peekBody.appendChild(l2Label); peekBody.appendChild(l2Grid);
    root.appendChild(peek);

    /* ---------------- main plot */
    var plot = L.canvas(canvasWrap, 1, function () { draw(); }, { cls: 'framed', maxHeight: 520 });
    var map = document.createElement('canvas'), MAPN = 56;
    map.width = MAPN; map.height = MAPN;
    var range = 1.25;

    function feats(pt) {
      // polar_features from the lesson: assumes the spiral is centred at (0, 0)
      var r = Math.sqrt(pt[0] * pt[0] + pt[1] * pt[1]), th = Math.atan2(pt[1], pt[0]);
      var a = th - r * (state.rev * 2 * Math.PI);
      return [pt[0], pt[1], r, Math.sin(a), Math.cos(a)];
    }
    function inputFor(pt) { return state.model === 'features' ? feats(pt) : pt; }

    function regen() {
      data = L.spirals({ n: state.n, noise: state.noise, revolutions: state.rev, cx: state.offset, seed: 42 });
      split = L.split(data, 0.25, 0);
      range = 1.2 + state.offset;
      resetModel();
      draw();
    }

    function resetModel() {
      state.training = false; state.epoch = 0; state.losses = []; state.done = false;
      var sizes;
      if (state.model === 'network') {
        sizes = [2]; for (var i = 0; i < state.depth; i++) sizes.push(state.hidden); sizes.push(1);
        state.net = new L.MLP(sizes, { activation: 'relu', lr: 0.01, seed: 11 });
        state.maxEpochs = 600;
      } else {
        sizes = [state.model === 'features' ? 5 : 2, 1];
        state.net = new L.MLP(sizes, { activation: 'linear', lr: 0.05, seed: 11 });
        state.maxEpochs = 250;
      }
      netPanel.style.display = state.model === 'network' ? '' : 'none';
      peek.style.display = state.model === 'network' ? '' : 'none';
      stParams.set(state.net.nParams().toLocaleString());
      btnTrain.innerHTML = L.icon('play') + ' Train';
      updateStats();
      setMessage();
    }

    function setModel(k) {
      state.model = k;
      Object.keys(modelBtns).forEach(function (m) { modelBtns[m].classList.toggle('is-on', m === k); modelBtns[m].setAttribute('aria-checked', m === k ? 'true' : 'false'); });
      resetModel(); draw();
    }

    function toggleTrain() {
      if (state.done) { resetModel(); }
      state.training = !state.training;
      btnTrain.innerHTML = state.training ? L.icon('pause') + ' Pause' : L.icon('play') + ' Train';
      if (state.training) loop.start();
      setMessage();
    }

    var trX, trY;
    var loop = L.loop(root, function () {
      if (!state.training) { loop.stop(); return; }
      var t0 = performance.now(), budget = 14, did = 0;
      trX = split.train.X.map(inputFor); trY = split.train.y;
      var batch = state.model === 'network' ? 64 : trX.length;
      while (performance.now() - t0 < budget && state.epoch < state.maxEpochs) {
        var loss = state.net.epoch(trX, trY, batch, state.rnd);
        state.epoch++; did++;
        state.losses.push(loss);
        if (state.model !== 'network' && did > 40) break;
      }
      if (state.epoch >= state.maxEpochs) {
        state.training = false; state.done = true;
        btnTrain.innerHTML = L.icon('refresh') + ' Train again';
      }
      updateStats(); draw(); lossChart.redraw();
      if (state.model === 'network' && (state.epoch % 10 === 0 || state.done) && peek.open) drawUnits();
      if (state.done) setMessage();
    });

    function updateStats() {
      var acc = split ? L.accuracy(state.net, split.test.X, split.test.y, state.model === 'features' ? feats : null) : 0;
      var tacc = split ? L.accuracy(state.net, split.train.X, split.train.y, state.model === 'features' ? feats : null) : 0;
      stAcc.set(state.epoch ? L.fmtPct(acc) : '—');
      stTrain.set(state.epoch ? L.fmtPct(tacc) : '—');
      stEpoch.set(state.epoch.toLocaleString());
      state.acc = acc; state.tacc = tacc;
    }

    function setMessage() {
      var m = state.model, a = state.acc || 0;
      var text, cls = 'w-msg';
      if (!state.epoch) {
        text = m === 'linear' ? 'Press <strong>Train</strong>. Before you do: how well can one straight line separate two interleaved spirals?'
          : m === 'features' ? 'Same linear model, but it now sees <strong>r, sin α and cos α</strong>, the features you wrote using your knowledge of how the spirals were generated.'
          : 'The network gets only the raw <strong>x1, x2</strong>. Press Train and watch the boundary bend as the network builds its own features.';
      } else if (!state.done) {
        text = (state.training ? 'Training… ' : 'Paused. ') + 'Each epoch is one full pass over the ' + split.train.X.length + ' training points; the loss curve below should fall.';
      } else if (m === 'linear') {
        text = '<strong>' + L.fmtPct(a) + '.</strong> One flat region per class and a single straight seam. Nothing is broken: a straight line simply cannot trace a coil. The limitation is the <em>model class</em>, not the code or the data.';
        cls += ' warn';
      } else if (m === 'features') {
        text = state.offset > 0.01
          ? '<strong>' + L.fmtPct(a) + '.</strong> You moved the centre, and the hand-written features still measure radius and angle from (0, 0). They quietly stopped describing the spiral. <strong>Hand-engineered features are brittle.</strong> Now try the network with the same offset.'
          : '<strong>' + L.fmtPct(a) + '.</strong> Same straight line, but drawn in a better space. The problem was never the classifier; it was the <em>representation</em>. The catch: you had to know how the data was generated.';
        cls += state.offset > 0.01 ? ' bad' : ' good';
      } else {
        text = '<strong>' + L.fmtPct(a) + '</strong> from raw coordinates, with no feature engineering. The earlier layers built the features (open “Peek inside” below), and the last layer is just a logistic regression on top of them.' +
          (state.n <= 75 ? ' With so few points, compare train and test accuracy: a gap means the network memorised instead of generalising.' : '');
        cls += ' good';
      }
      msg.className = cls; msg.innerHTML = text;
    }

    /* ---------------- drawing */
    function toCanvas(x, y, w, h) { return [(x + range - state.offset * 0) / (2 * range) * w, (1 - (y + range) / (2 * range)) * h]; }

    function draw() {
      if (!split) return;
      P = L.palette();
      var ctx = plot.ctx, w = plot.w, h = plot.h;
      ctx.clearRect(0, 0, w, h);
      // decision map
      if (state.epoch > 0) {
        var mctx = map.getContext('2d'), img = mctx.createImageData(MAPN, MAPN);
        var c0 = L.hexToRgb(P.c0), c1 = L.hexToRgb(P.c1), bg = L.hexToRgb(P.surface2);
        for (var j = 0; j < MAPN; j++) for (var i = 0; i < MAPN; i++) {
          var x = -range + (i + 0.5) / MAPN * 2 * range, y = range - (j + 0.5) / MAPN * 2 * range;
          var p = state.net.predictProba(inputFor([x, y]));
          var conf = Math.abs(p - 0.5) * 2, base = p > 0.5 ? c1 : c0;
          var col = L.mix(bg, base, 0.18 + 0.32 * conf);
          var k = (j * MAPN + i) * 4; img.data[k] = col[0]; img.data[k + 1] = col[1]; img.data[k + 2] = col[2]; img.data[k + 3] = 255;
        }
        mctx.putImageData(img, 0, 0);
        ctx.save(); ctx.imageSmoothingEnabled = true; ctx.drawImage(map, 0, 0, w, h); ctx.restore();
      }
      // axes
      ctx.strokeStyle = P.line2; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      var o = toCanvas(0, 0, w, h);
      ctx.beginPath(); ctx.moveTo(0, o[1]); ctx.lineTo(w, o[1]); ctx.moveTo(o[0], 0); ctx.lineTo(o[0], h); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillText('x1', w - 18, o[1] - 6); ctx.fillText('x2', o[0] + 6, 14);
      // points
      var rad = w < 380 ? 2.2 : 2.8;
      function pts(set, ring) {
        for (var n = 0; n < set.X.length; n++) {
          var c = toCanvas(set.X[n][0], set.X[n][1], w, h);
          ctx.beginPath(); ctx.arc(c[0], c[1], rad, 0, 7);
          ctx.fillStyle = set.y[n] ? P.c1 : P.c0; ctx.fill();
          if (ring) { ctx.lineWidth = 1; ctx.strokeStyle = P.surface; ctx.stroke(); }
        }
      }
      pts(split.train, false);
      pts(split.test, true);
      if (state.offset > 0.01) {
        var cc = toCanvas(state.offset, 0, w, h);
        ctx.strokeStyle = P.ink; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(cc[0] - 6, cc[1]); ctx.lineTo(cc[0] + 6, cc[1]); ctx.moveTo(cc[0], cc[1] - 6); ctx.lineTo(cc[0], cc[1] + 6); ctx.stroke();
        ctx.fillStyle = P.ink2; ctx.fillText('true centre', cc[0] + 8, cc[1] - 8);
      }
    }

    function drawLoss(ctx, w, h) {
      L.lineChart(ctx, w, h, [{ color: P.c3 || P.ink, values: state.losses.length ? state.losses : [NaN] }], { xlabel: 'epoch', padL: 40 });
    }

    var unitCanvases = [];
    function drawUnits() {
      if (state.model !== 'network') return;
      var net = state.net, N = 22;
      if (!unitCanvases.length) {
        for (var q = 0; q < 16; q++) {
          var c = document.createElement('canvas'); c.width = N; c.height = N;
          unitCanvases.push(c); (q < 8 ? l1Grid : l2Grid).appendChild(c);
        }
      }
      var nUnits1 = Math.min(8, net.sizes[1]), nUnits2 = net.sizes.length > 3 ? Math.min(8, net.sizes[2]) : 0;
      l2Label.style.display = l2Grid.style.display = nUnits2 ? '' : 'none';
      var acts1 = [], acts2 = [];
      for (var j = 0; j < N; j++) for (var i = 0; i < N; i++) {
        var x = -range + (i + 0.5) / N * 2 * range, y = range - (j + 0.5) / N * 2 * range;
        var f = net.forward([x, y]).acts;
        acts1.push(Float64Array.from(f[1])); if (nUnits2) acts2.push(Float64Array.from(f[2]));
      }
      var ink = L.hexToRgb(P.c0), paper = L.hexToRgb(P.surface);
      function paint(canvas, acts, u) {
        var mx = 1e-9; acts.forEach(function (a) { mx = Math.max(mx, a[u]); });
        var ctx = canvas.getContext('2d'), img = ctx.createImageData(N, N);
        acts.forEach(function (a, k) { var t = a[u] / mx, col = L.mix(paper, ink, Math.min(1, t)); img.data[k * 4] = col[0]; img.data[k * 4 + 1] = col[1]; img.data[k * 4 + 2] = col[2]; img.data[k * 4 + 3] = 255; });
        ctx.putImageData(img, 0, 0);
      }
      for (var u = 0; u < 8; u++) {
        unitCanvases[u].style.visibility = u < nUnits1 ? 'visible' : 'hidden';
        if (u < nUnits1) paint(unitCanvases[u], acts1, u);
        unitCanvases[8 + u].style.visibility = u < nUnits2 ? 'visible' : 'hidden';
        if (u < nUnits2) paint(unitCanvases[8 + u], acts2, u);
      }
    }
    peek.addEventListener('toggle', function () { if (peek.open && state.epoch) drawUnits(); });

    L.onTheme(function () { P = L.palette(); legend.replaceWith(legend = L.legend([{ color: P.c0, label: 'class 0 (arm A)' }, { color: P.c1, label: 'class 1 (arm B)' }])); draw(); lossChart.redraw(); if (peek.open) drawUnits(); });

    setModel(state.model);
    regen();
  };
})();
