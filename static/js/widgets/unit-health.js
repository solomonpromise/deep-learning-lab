/* Unit Health — watch every hidden unit of a real network: identical twins from a symmetric start,
   dead ReLUs from a learning rate that is too large.
   A 2 → 24 → 24 → 1 ReLU network (Adam, batch 32, 25 epochs) trains in the browser on two spirals with 1.25 turns.
   Initialisation: PyTorch-style default (He normal), all zeros, every weight 0.1, or N(0, 3²).
   Each tile is one hidden unit; its colour is the share of training rows on which it is active (output > 0).
   A crossed tile is dead: inactive on every row, so it receives no gradient and cannot recover.
   "Distinct units" counts layer-1 units whose incoming weights differ, which is how Lesson 3.3 §2 exposes symmetry. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var H = 24, LRS = [0.001, 0.003, 0.01, 0.03, 0.1, 0.3, 0.5, 1.0];

  window.DLP.widgets['unit-health'] = function (root) {
    var data = L.spirals({ n: 200, noise: 0.05, seed: 21, revolutions: 1.25 }), sp = L.split(data, 0.25, 3);
    var init = 'default', lrIdx = 2, net = null, epoch = 0, busy = false, losses = [], P = L.palette();

    var segInit = L.segmented({ label: 'Initialisation', value: init, options: [
      { label: 'Default', value: 'default' }, { label: 'All zeros', value: 'zeros' }, { label: 'All 0.1', value: 'const' }, { label: 'N(0, 3²)', value: 'big' }],
      onChange: function (v) { init = v; reset(); } });
    var sLr = L.slider({ label: 'Learning rate (Adam)', min: 0, max: LRS.length - 1, step: 1, value: lrIdx, format: function (i) { return String(LRS[i]); }, onChange: function (i) { lrIdx = i; reset(); } });
    var trainBtn = L.button(L.icon('play') + ' Train 25 epochs', function () { train(); }, 'primary');
    var resetBtn = L.button(L.icon('refresh') + ' Reset', function () { reset(); });
    var grid1 = L.el('div', { class: 'uh-grid', role: 'img' }), grid2 = L.el('div', { class: 'uh-grid', role: 'img' });
    var chartHolder = L.el('div'), stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [
      L.el('div', { class: 'w-grid2 even' }, [segInit.el, sLr.el]),
      L.el('div', { class: 'w-row' }, [trainBtn, resetBtn]),
      L.el('div', { class: 'w-grid2 even' }, [
        L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-panel-title', html: L.icon('layers') + ' Hidden layer 1 (24 units)' }), grid1, L.el('div', { class: 'w-panel-title', html: L.icon('layers') + ' Hidden layer 2 (24 units)' }), grid2,
          L.el('div', { class: 'uh-key', html: '<span><i style="background:var(--c0)"></i>active on most rows</span><span><i style="background:var(--surface-3)"></i>rarely active</span><span><i class="dead"></i>dead</span>' })]),
        L.el('div', { class: 'w-col' }, [chartHolder, stats])
      ]), msg
    ]));
    var cv = L.canvas(chartHolder, 0.62, draw, { cls: 'framed', label: 'Training loss by epoch' });

    function build() {
      var m = new L.MLP([2, H, H, 1], { lr: LRS[lrIdx], seed: 4 });
      if (init !== 'default') {
        var r = L.rng(8);
        m.W.forEach(function (W) { for (var i = 0; i < W.length; i++) W[i] = init === 'zeros' ? 0 : init === 'const' ? 0.1 : 3 * r.normal(); });
      }
      return m;
    }
    function reset() { net = build(); epoch = 0; losses = []; busy = false; trainBtn.disabled = false; trainBtn.innerHTML = L.icon('play') + ' Train 25 epochs'; paint(); }
    function train() {
      if (busy) return; busy = true; trainBtn.disabled = true;
      var rnd = L.rng(100 + epoch), target = epoch + 25;
      function step() {
        for (var k = 0; k < 3 && epoch < target; k++) {
          var loss = net.epoch(sp.train.X, sp.train.y, 32, rnd);
          losses.push(isFinite(loss) ? loss : NaN); epoch++;
        }
        paint();
        if (epoch < target) later(step);
        else {
          busy = false; trainBtn.disabled = false; trainBtn.innerHTML = L.icon('play') + ' Train 25 more';
          var act = activity(), dead1 = act[0].filter(function (a) { return a === 0; }).length;
          root.dispatchEvent(new CustomEvent('dlp:metrics', { bubbles: true, detail: { init: init, lr: LRS[lrIdx], epochs: epoch, testAcc: L.accuracy(net, sp.test.X, sp.test.y), dead1: dead1 } })); if (window.DLP.record) { var le = document.querySelector('[data-lesson]'); window.DLP.record.lab(le ? le.getAttribute('data-lesson') : '', 'unit-health'); } }
      }
      later(step);
    }
    // next frame when visible; keep going (without drawing frames) when the tab is in the background
    function later(fn) { return document.hidden ? setTimeout(fn, 0) : requestAnimationFrame(fn); }
    function activity() {
      var act = [new Float64Array(H), new Float64Array(H)], X = sp.train.X;
      for (var i = 0; i < X.length; i++) {
        var f = net.forward(X[i]);
        for (var j = 0; j < H; j++) { if (f.acts[1][j] > 0) act[0][j]++; if (f.acts[2][j] > 0) act[1][j]++; }
      }
      return act.map(function (a) { return Array.prototype.map.call(a, function (v) { return v / X.length; }); });
    }
    function distinct() {
      var W = net.W[0], b = net.b[0], seen = {};
      for (var j = 0; j < H; j++) { seen[[W[j].toFixed(5), W[H + j].toFixed(5), b[j].toFixed(5)].join(',')] = 1; }
      return Object.keys(seen).length;
    }
    function tiles(el, act) {
      P = L.palette();
      var c0 = L.hexToRgb(P.c0), bg = L.hexToRgb(P.surface2);
      el.innerHTML = '';
      act.forEach(function (a, j) {
        var t = L.el('i', { title: 'unit ' + (j + 1) + ': active on ' + Math.round(a * 100) + '% of rows' });
        if (a === 0) t.className = 'dead';
        else t.style.background = 'rgb(' + L.mix(bg, c0, 0.25 + 0.75 * a).map(Math.round).join(',') + ')';
        el.appendChild(t);
      });
    }
    function paint() {
      var act = activity(), dead1 = act[0].filter(function (a) { return a === 0; }).length, dead2 = act[1].filter(function (a) { return a === 0; }).length;
      tiles(grid1, act[0]); tiles(grid2, act[1]);
      grid1.setAttribute('aria-label', 'Layer 1: ' + dead1 + ' of 24 units dead'); grid2.setAttribute('aria-label', 'Layer 2: ' + dead2 + ' of 24 units dead');
      var acc = L.accuracy(net, sp.test.X, sp.test.y), dist = distinct();
      stats.innerHTML = '';
      [['Epochs', String(epoch)], ['Test accuracy', L.fmtPct(acc)], ['Dead units, layer 1', dead1 + ' / 24', dead1 > 6 ? 'bad' : ''], ['Dead units, layer 2', dead2 + ' / 24', dead2 > 6 ? 'bad' : ''], ['Distinct units, layer 1', dist + ' / 24', dist < 4 ? 'bad' : '']]
        .forEach(function (x) { stats.appendChild(L.stat(x[0], x[1], x[2]).el); });
      var lr = LRS[lrIdx];
      msg.className = 'w-msg' + ((init === 'zeros' || init === 'const' || dead1 > 10 || (epoch && acc < 0.7)) ? ' warn' : '');
      msg.innerHTML = !epoch ? (init === 'zeros' ? 'Every weight starts at exactly 0. Predict before training: will the hidden units learn different things?' : init === 'const' ? 'Every weight starts at 0.1. The units are not zero, but they are all the same. Will they specialise?' : init === 'big' ? 'Weights drawn with standard deviation 3: the first forward pass produces huge pre-activations.' : 'Press Train. Then try a learning rate of 0.5 or 1.0, and the other initialisations.')
        : init === 'zeros' ? '<strong>Nothing in the hidden layers can move.</strong> With every weight at 0, every hidden output is 0, ReLU\'s slope at 0 is 0, and no gradient reaches the hidden weights: every unit is "dead" from the start. Accuracy stays at chance.'
        : init === 'const' ? '<strong>' + dist + ' distinct unit' + (dist === 1 ? '' : 's') + ' out of 24.</strong> Identical starting weights give identical outputs, identical gradients and identical updates, so the units stay twins forever. That is symmetry, and random initialisation exists to break it.'
        : dead1 + dead2 > 12 ? '<strong>' + (dead1 + dead2) + ' of 48 units are dead.</strong> At learning rate ' + lr + ', large updates pushed their pre-activations below zero for every row; with zero output and zero slope they get no gradient, and lowering the learning rate now would not revive them. Restart with a smaller rate.'
        : init === 'big' ? 'The oversized start makes training erratic (look at the first losses). The default initialisation keeps activations in a sensible range from the first step.'
        : 'Healthy: most units are active on some rows and inactive on others, which is what lets ReLU networks bend their boundaries. A few dead units are normal in an over-parameterised network.';
      draw();
    }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var vals = losses.map(function (v) { return Math.min(v, 3); });
      L.lineChart(cv.ctx, cv.w, cv.h, [{ name: 'loss', color: P.c0, values: vals.length ? vals : [NaN] }], { xlabel: 'epoch', ymin: 0 });
    }
    L.onTheme(function () { paint(); });
    reset();
  };
})();
