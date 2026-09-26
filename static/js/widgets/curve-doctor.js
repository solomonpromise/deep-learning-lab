/* Curve Doctor — diagnose a training run from its loss curves alone.
   A random case is drawn from the patterns you have learned; pick a diagnosis, then read why.
   props.patterns: list of pattern keys to include (default: the four basics). */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var PATTERNS = {
    healthy: { label: 'Healthy', why: 'Both curves fall and stay close, then flatten together. The model is learning something that transfers to unseen data.',
      gen: function (r, n) { return curves(n, function (t) { return 0.08 + 0.62 * Math.exp(-t / 16); }, function (t) { return 0.12 + 0.6 * Math.exp(-t / 16); }, r, 0.008); } },
    overfit: { label: 'Overfitting', why: 'Training loss keeps falling, but validation loss bottoms out and then <strong>rises</strong>: the model has started memorising the training set. Keep the weights from the validation minimum (early stopping), or regularise.',
      gen: function (r, n) { return curves(n, function (t) { return 0.03 + 0.67 * Math.exp(-t / 12); }, function (t) { return 0.3 + 0.4 * Math.exp(-t / 9) + 0.006 * Math.max(0, t - 14) + 0.00009 * Math.pow(Math.max(0, t - 14), 2); }, r, 0.008); } },
    underfit: { label: 'Underfitting', why: 'Both curves flatten early at a <strong>high</strong> value and stay close together. The model (or its features) cannot capture the pattern: try more capacity, better features, or a higher learning rate, and check for bugs such as a missing activation.',
      gen: function (r, n) { return curves(n, function (t) { return 0.6 + 0.1 * Math.exp(-t / 6); }, function (t) { return 0.61 + 0.1 * Math.exp(-t / 6); }, r, 0.006); } },
    lrhigh: { label: 'Learning rate too high', why: 'Violent spikes and thrashing from the very first epochs, never settling. Every step overshoots the valley. Lower the learning rate (often by 10×).',
      gen: function (r, n) { return curves(n, function (t) { return 0.55 + 0.25 * Math.abs(Math.sin(t * 1.7 + r() * 3)) + 0.2 * r(); }, function (t) { return 0.58 + 0.25 * Math.abs(Math.sin(t * 1.3 + r() * 3)) + 0.2 * r(); }, r, 0.01); } },
    lrlow: { label: 'Learning rate too low', why: 'The loss falls slowly and almost linearly and is <strong>still falling</strong> at the end: nothing looks broken, but it is crawling. Raise the learning rate (an LR range test finds a good one).',
      gen: function (r, n) { return curves(n, function (t) { return 0.7 - 0.0045 * t; }, function (t) { return 0.71 - 0.0043 * t; }, r, 0.004); } },
    diverge: { label: 'Diverging (NaN)', why: 'The loss explodes upwards and the run ends in <code>inf</code>/<code>NaN</code>. The causes are usually a far-too-high learning rate, un-normalised inputs, or exploding gradients (clip them).',
      gen: function (r, n) { return curves(n, function (t) { return t < 10 ? 0.7 - 0.02 * t : 0.5 * Math.exp((t - 10) / 5); }, function (t) { return t < 10 ? 0.72 - 0.02 * t : 0.55 * Math.exp((t - 10) / 5); }, r, 0.01, 22); } },
    leak: { label: 'Suspicious validation', why: 'Validation loss sits far <strong>below</strong> training loss the whole time. Dropout can cause a small gap like this, but a large, persistent one suggests the validation data is easier or leaked (duplicates, a target leak). Check the split before celebrating.',
      gen: function (r, n) { return curves(n, function (t) { return 0.25 + 0.45 * Math.exp(-t / 14); }, function (t) { return 0.05 + 0.35 * Math.exp(-t / 10); }, r, 0.008); } },
    nozero: { label: 'Accumulating gradients (no zero_grad)', why: 'The loss falls, then swings back up and oscillates without settling, and no learning-rate change quite fixes it. Gradients from every step are piling up in <code>.grad</code>. Look for a missing <code>optimizer.zero_grad()</code>.',
      gen: function (r, n) { return curves(n, function (t) { return 0.35 + 0.3 * Math.abs(Math.sin(t / 4.5)) * (0.6 + t / 90) + 0.03 * r(); }, function (t) { return 0.37 + 0.3 * Math.abs(Math.sin(t / 4.5)) * (0.6 + t / 90) + 0.03 * r(); }, r, 0.004); } }
  };
  function curves(n, ft, fv, r, noise, stop) {
    var tr = [], va = [];
    for (var t = 0; t < (stop || n); t++) { tr.push(Math.max(0.005, ft(t) + (r() - 0.5) * noise * 2)); va.push(Math.max(0.005, fv(t) + (r() - 0.5) * noise * 3)); }
    return { tr: tr, va: va };
  }
  window.DLP.widgets['curve-doctor'] = function (root, props) {
    props = props || {};
    var keys = props.patterns || ['healthy', 'overfit', 'underfit', 'lrhigh'];
    var P = L.palette(), seed = 7, cur = null, data = null, score = 0, seen = 0, answered = false, order = [];
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var title = L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Patient #1' });
    left.appendChild(title);
    var cv = L.canvas(left, 0.55, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c0, label: 'training loss' }, { color: P.c1, label: 'validation loss' }]));
    var q = L.el('div', { class: 'w-note', html: '<strong>What is your diagnosis?</strong>' });
    var opts = L.el('div', { class: 'quiz-options' });
    var why = L.el('div', { class: 'w-msg', hidden: 'hidden' });
    var stat = L.stat('Score', '0 / 0');
    var nextBtn = L.button('Next patient ' + L.icon('arrow-right'), function () { newCase(); }, 'primary');
    right.appendChild(q); right.appendChild(opts); right.appendChild(why); right.appendChild(L.el('div', { class: 'w-row' }, [nextBtn, stat.el]));

    function newCase() {
      if (!order.length) { order = keys.slice(); for (var i = order.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = order[i]; order[i] = order[j]; order[j] = t; } }
      cur = order.pop(); seed++;
      data = PATTERNS[cur].gen(L.rng(seed * 13 + 5), 60);
      answered = false; why.hidden = true; seen++;
      title.innerHTML = L.icon('pulse') + ' Patient #' + seen;
      opts.innerHTML = '';
      keys.forEach(function (k, i) {
        var b = L.el('button', { class: 'opt', type: 'button', html: '<span class="opt-letter">' + 'ABCDEFGH'[i] + '</span><span>' + PATTERNS[k].label + '</span>' });
        b.addEventListener('click', function () {
          if (answered) return; answered = true;
          Array.prototype.forEach.call(opts.children, function (x, xi) { x.disabled = true; if (keys[xi] === cur) x.classList.add('is-correct'); });
          if (k === cur) score++; else b.classList.add('is-wrong');
          stat.set(score + ' / ' + seen);
          why.hidden = false; why.className = 'w-msg ' + (k === cur ? 'good' : 'bad');
          why.innerHTML = '<strong>' + (k === cur ? 'Correct: ' : 'Not quite. It\'s ') + PATTERNS[cur].label + '.</strong> ' + PATTERNS[cur].why;
        });
        opts.appendChild(b);
      });
      stat.set(score + ' / ' + (seen - 1));
      draw();
    }
    function draw() {
      if (!cv || !data) return;
      P = L.palette();
      L.lineChart(cv.ctx, cv.w, cv.h, [{ color: P.c0, values: data.tr }, { color: P.c1, values: data.va }], { xlabel: 'epoch', ymin: 0, ymax: cur === 'diverge' ? 3 : 1 });
      if (cur === 'diverge') { var ctx = cv.ctx; ctx.fillStyle = P.red; ctx.font = '700 12px Inter, system-ui, sans-serif'; ctx.fillText('loss = NaN (run stopped)', cv.w - 170, 24); }
    }
    L.onTheme(draw);
    newCase();
  };
})();
