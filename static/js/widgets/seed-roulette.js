/* Seed Roulette — train the same small network ten times and watch the score move when nothing that matters changed.
   A 2 → 16 → 16 → 1 ReLU network (Adam, lr 0.01, batch 32, 40 epochs) learns a noisy two-spiral problem
   (one turn, 150 points per class, noise 0.2) in the browser. "Seed" changes only the starting weights and the batch order;
   "Split" changes only which 30% of the points are held out for testing; "Both" changes both. The learner first
   commits to a guess for the spread, as in Lesson 4.2 §8, then the runs appear one by one. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var N_PER_CLASS = 150, NOISE = 0.2, REVOLUTIONS = 1.0, EPOCHS = 40, BATCH = 32;

  function trainOnce(data, splitSeed, modelSeed) {
    var sp = L.split(data, 0.3, splitSeed);
    var net = new L.MLP([2, 16, 16, 1], { lr: 0.01, seed: modelSeed });
    var rnd = L.rng(modelSeed * 7919 + 13);
    for (var e = 0; e < EPOCHS; e++) net.epoch(sp.train.X, sp.train.y, BATCH, rnd);
    return L.accuracy(net, sp.test.X, sp.test.y);
  }
  function mean(a) { return a.reduce(function (s, x) { return s + x; }, 0) / a.length; }
  function sd(a) { if (a.length < 2) return 0; var m = mean(a); return Math.sqrt(a.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (a.length - 1)); }

  window.DLP.widgets['seed-roulette'] = function (root) {
    var data = L.spirals({ n: N_PER_CLASS, noise: NOISE, revolutions: REVOLUTIONS, seed: 11 });
    var mode = 'seed', runs = [], busy = false, guess = null, batchNo = 0;
    var P = L.palette();

    var seg = L.segmented({
      label: 'What changes between runs', value: mode,
      options: [{ label: 'Seed only', value: 'seed' }, { label: 'Split only', value: 'split' }, { label: 'Both', value: 'both' }],
      onChange: function (v) { mode = v; runs = []; batchNo = 0; draw(); paintStats(); }
    });
    var guessSlider = L.slider({ label: 'Your guess: gap between the best and worst of 10 runs', min: 0, max: 20, step: 0.5, value: 2,
      format: function (v) { return v.toFixed(1) + ' points'; } });
    var lockBtn = L.button(L.icon('target') + ' Lock in my guess', function () {
      guess = guessSlider.get(); guessSlider.input.disabled = true; lockBtn.disabled = true; runBtn.disabled = false; paintStats();
    });
    var runBtn = L.button(L.icon('play') + ' Run 10 experiments', function () { run(10); }, 'primary');
    runBtn.disabled = true;
    var resetBtn = L.button(L.icon('refresh') + ' Clear', function () { runs = []; batchNo = 0; draw(); paintStats(); });

    var cv = L.canvas(root, 0.32, draw, { cls: 'framed', label: 'Test accuracy of each run, as dots on a line' });
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [
      seg.el,
      L.el('div', { class: 'w-panel' }, [L.el('div', { class: 'w-panel-title', html: L.icon('target') + ' Predict first' }), guessSlider.el, L.el('div', { class: 'w-row' }, [lockBtn])]),
      L.el('div', { class: 'w-row' }, [runBtn, resetBtn]), stats, msg
    ]));

    function run(n) {
      if (busy) return;
      busy = true; runBtn.disabled = true;
      var i = 0; batchNo++;
      function next() {
        if (i >= n) { busy = false; runBtn.disabled = false; runBtn.innerHTML = L.icon('play') + ' Run 10 more'; paintStats(); return; }
        var k = runs.length;
        var splitSeed = mode === 'seed' ? 101 : 101 + k * 17, modelSeed = mode === 'split' ? 5 : 5 + k * 31;
        runs.push({ acc: trainOnce(data, splitSeed, modelSeed), batch: batchNo });
        i++; draw(); paintStats();
        setTimeout(next, 0);
      }
      next();
    }

    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, lo = 0.70, hi = 1.0;
      var X = function (v) { return 36 + (w - 72) * (Math.min(hi, Math.max(lo, v)) - lo) / (hi - lo); };
      var y0 = h * 0.64;
      ctx.clearRect(0, 0, w, h);
      var accs = runs.map(function (r) { return r.acc; });
      if (accs.length >= 3) {
        var m = mean(accs), s = sd(accs);
        ctx.fillStyle = P.dark ? 'rgba(75,147,234,.16)' : 'rgba(42,120,214,.12)';
        ctx.fillRect(X(m - 2 * s), 14, Math.max(2, X(m + 2 * s) - X(m - 2 * s)), h - 46);
        ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
        ctx.fillText('mean ± 2 sd', X(m), 28);
      }
      ctx.strokeStyle = P.line2; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(36, y0); ctx.lineTo(w - 36, y0); ctx.stroke();
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      for (var t = 0.70; t <= 1.0001; t += 0.05) { ctx.fillText(Math.round(t * 100) + '%', X(t), h - 12); ctx.beginPath(); ctx.moveTo(X(t), y0 - 4); ctx.lineTo(X(t), y0 + 4); ctx.stroke(); }
      runs.forEach(function (r, i) {
        ctx.fillStyle = r.batch === batchNo ? P.c0 : P.ink3;
        ctx.beginPath(); ctx.arc(X(r.acc), y0 - 10 - (i % 4) * 8, 4.5, 0, 7); ctx.fill();
      });
      if (!runs.length) { ctx.fillStyle = P.ink3; ctx.font = '13px Inter, system-ui, sans-serif'; ctx.fillText(guess == null ? 'Lock in a guess, then run the experiments' : 'Press "Run 10 experiments"', w / 2, y0 - 26); }
      ctx.textAlign = 'left';
    }

    function paintStats() {
      var accs = runs.map(function (r) { return r.acc; });
      stats.innerHTML = '';
      if (!accs.length) {
        msg.className = 'w-msg';
        msg.innerHTML = guess == null
          ? 'Every run uses the same data, the same network, the same learning rate and the same number of epochs. Before running anything: how far apart do you think the best and the worst test accuracy of ten runs will be?'
          : 'Guess locked at <strong>' + guess.toFixed(1) + ' points</strong>. Now run the experiments.';
        return;
      }
      var m = mean(accs), s = sd(accs), range = (Math.max.apply(null, accs) - Math.min.apply(null, accs)) * 100;
      [['Runs', String(accs.length)], ['Mean test accuracy', L.fmtPct(m)], ['Standard deviation', (s * 100).toFixed(2) + ' pts'],
       ['Best − worst', range.toFixed(1) + ' pts']].forEach(function (x) { stats.appendChild(L.stat(x[0], x[1]).el); });
      var what = mode === 'seed' ? 'Only the starting weights and batch order changed.' : mode === 'split' ? 'Only the choice of test rows changed.' : 'Both the seed and the split changed.';
      var verdict = guess == null ? '' : Math.abs(range - guess) <= 1.5 ? ' Your guess of ' + guess.toFixed(1) + ' points was close.' :
        range > guess ? ' That is <strong>more</strong> than your guess of ' + guess.toFixed(1) + ' points, which is the usual surprise.' : ' That is less than your guess of ' + guess.toFixed(1) + ' points.';
      msg.className = 'w-msg' + (range > 3 ? ' warn' : '');
      msg.innerHTML = what + ' The best and worst runs are <strong>' + range.toFixed(1) + ' points apart</strong>.' + verdict +
        (accs.length >= 5 ? ' So a change to this model that "improves" accuracy by less than about <strong>' + (2 * s * 100).toFixed(1) + ' points</strong> (2 standard deviations) is not a result yet.' +
          (mode !== 'both' ? ' Now switch to ' + (mode === 'seed' ? '"Split only"' : '"Seed only"') + ' and compare the two kinds of noise, as Lesson 4.2 §8 does.' : '') : '');
    }

    L.onTheme(draw);
    draw(); paintStats();
  };
})();
