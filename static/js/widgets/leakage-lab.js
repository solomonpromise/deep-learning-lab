/* Leakage Lab — the score your split reports against the score the model earns in real use.
   A synthetic calling campaign shaped like Lesson 4.1 §9: 150 calling days, 40 calls per day, and a success
   rate that varies strongly from day to day. Each call has one genuinely useful input and one noise input.
   A logistic regression is trained in the browser (gradient descent) under the pipeline you choose:
   - split: random rows, or whole days held out (group split);
   - the "day success rate" column, computed from training rows only (target encoding), on or off;
   - the scaler fitted on training rows only, or on every row.
   "Reported" is ROC-AUC on the test part of the split. "In real use" is ROC-AUC on 120 brand-new days generated
   the same way, which is what deployment looks like: every day is a new day. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var DAYS = 150, PER_DAY = 40, NEW_DAYS = 120;

  function makeDays(nDays, seed, startId) {
    var r = L.rng(seed), rows = [];
    for (var d = 0; d < nDays; d++) {
      var dayLogit = -1.2 + 1.6 * r.normal();                  // strong day effect, like the calling-day rates in 4.1
      for (var i = 0; i < PER_DAY; i++) {
        var x1 = r.normal(), x2 = r.normal();
        var p = 1 / (1 + Math.exp(-(dayLogit + 0.9 * x1)));
        rows.push({ day: startId + d, x1: x1, x2: x2, y: r() < p ? 1 : 0 });
      }
    }
    return rows;
  }
  function auc(scores, y) {
    var idx = scores.map(function (_, i) { return i; }).sort(function (a, b) { return scores[a] - scores[b]; });
    var pos = 0, neg = 0, rankSum = 0;
    idx.forEach(function (id, k) { if (y[id]) { pos++; rankSum += k + 1; } else neg++; });
    return pos && neg ? (rankSum - pos * (pos + 1) / 2) / (pos * neg) : 0.5;
  }
  function fitLR(X, y) {
    var d = X[0].length, w = new Float64Array(d), b = 0, n = X.length;
    for (var it = 0; it < 300; it++) {
      var gw = new Float64Array(d), gb = 0;
      for (var i = 0; i < n; i++) {
        var z = b; for (var j = 0; j < d; j++) z += w[j] * X[i][j];
        var e = 1 / (1 + Math.exp(-z)) - y[i]; gb += e;
        for (var j2 = 0; j2 < d; j2++) gw[j2] += e * X[i][j2];
      }
      for (var j3 = 0; j3 < d; j3++) w[j3] -= 0.5 * (gw[j3] / n + 1e-3 * w[j3]);
      b -= 0.5 * gb / n;
    }
    return function (x) { var z = b; for (var j = 0; j < d; j++) z += w[j] * x[j]; return z; };
  }

  window.DLP.widgets['leakage-lab'] = function (root) {
    var pool = makeDays(DAYS, 7, 0), future = makeDays(NEW_DAYS, 99, 1000);
    var cfg = { split: 'random', dayRate: true, scaleAll: false }, history = [];
    var P = L.palette();

    var segSplit = L.segmented({ label: 'How the rows are split', value: cfg.split, options: [{ label: 'Random rows', value: 'random' }, { label: 'Whole days held out', value: 'group' }], onChange: function (v) { cfg.split = v; run(); } });
    function toggle(key, label) {
      var b = L.el('button', { type: 'button', class: 'w-btn ll-toggle', 'aria-pressed': String(cfg[key]) });
      function paint() { b.setAttribute('aria-pressed', String(cfg[key])); b.innerHTML = (cfg[key] ? L.icon('check') : '<span class="ll-box"></span>') + ' ' + label; b.classList.toggle('is-on', cfg[key]); }
      b.addEventListener('click', function () { cfg[key] = !cfg[key]; paint(); run(); });
      paint(); return b;
    }
    var tDay = toggle('dayRate', 'Add "day success rate" (from training rows)'), tScale = toggle('scaleAll', 'Fit the scaler on every row');
    var holder = L.el('div'), stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' }), hist = L.el('div', { class: 'll-hist' });
    root.appendChild(L.el('div', { class: 'w-col' }, [segSplit.el, L.el('div', { class: 'w-row' }, [tDay, tScale]), holder, stats, msg, hist]));
    var cv = L.canvas(holder, 0.26, draw, { cls: 'framed', label: 'Reported score against the score in real use' });
    var last = null;

    function features(rows, rate, prior, scaler) {
      return rows.map(function (r) {
        var f = [r.x1, r.x2];
        if (cfg.dayRate) f.push(rate[r.day] != null ? rate[r.day] : prior);
        return f.map(function (v, j) { return (v - scaler.m[j]) / scaler.s[j]; });
      });
    }
    function run() {
      // split
      var rnd = L.rng(3), train = [], test = [];
      if (cfg.split === 'random') pool.forEach(function (r) { (rnd() < 0.8 ? train : test).push(r); });
      else { var held = {}; for (var d = 0; d < DAYS; d++) held[d] = rnd() >= 0.8; pool.forEach(function (r) { (held[r.day] ? test : train).push(r); }); }
      // target encoding from training rows only (smoothed toward the overall rate)
      var sum = {}, cnt = {}, prior = train.reduce(function (s, r) { return s + r.y; }, 0) / train.length, rate = {};
      train.forEach(function (r) { sum[r.day] = (sum[r.day] || 0) + r.y; cnt[r.day] = (cnt[r.day] || 0) + 1; });
      Object.keys(cnt).forEach(function (d) { rate[d] = (sum[d] + prior * 5) / (cnt[d] + 5); });
      // scaler
      var raw = function (rows) { return rows.map(function (r) { var f = [r.x1, r.x2]; if (cfg.dayRate) f.push(rate[r.day] != null ? rate[r.day] : prior); return f; }); };
      var fitRows = raw(cfg.scaleAll ? pool : train), dim = fitRows[0].length, m = [], s = [];
      for (var j = 0; j < dim; j++) {
        var mu = fitRows.reduce(function (a, f) { return a + f[j]; }, 0) / fitRows.length;
        var sd = Math.sqrt(fitRows.reduce(function (a, f) { return a + (f[j] - mu) * (f[j] - mu); }, 0) / fitRows.length) || 1;
        m.push(mu); s.push(sd);
      }
      var sc = { m: m, s: s };
      var model = fitLR(features(train, rate, prior, sc), train.map(function (r) { return r.y; }));
      var rep = auc(features(test, rate, prior, sc).map(model), test.map(function (r) { return r.y; }));
      var real = auc(features(future, rate, prior, sc).map(model), future.map(function (r) { return r.y; }));
      last = { rep: rep, real: real };
      history.unshift({ label: (cfg.split === 'random' ? 'random rows' : 'whole days') + (cfg.dayRate ? ' + day rate' : '') + (cfg.scaleAll ? ' + scaler on all rows' : ''), rep: rep, real: real });
      history = history.filter(function (h, i) { return history.findIndex(function (x) { return x.label === h.label; }) === i; }).slice(0, 6);
      if (window.DLP.record) { var le = document.querySelector('[data-lesson]'); window.DLP.record.lab(le ? le.getAttribute('data-lesson') : '', 'leakage-lab'); }
      paint();
    }
    function paint() {
      stats.innerHTML = '';
      var gap = last.rep - last.real;
      [['Reported (test split)', last.rep.toFixed(3)], ['In real use (new days)', last.real.toFixed(3)], ['Reported − real', (gap >= 0 ? '+' : '') + gap.toFixed(3), gap > 0.03 ? 'bad' : 'good']].forEach(function (x) { stats.appendChild(L.stat(x[0], x[1], x[2]).el); });
      msg.className = 'w-msg ' + (gap > 0.03 ? 'bad' : 'good');
      msg.innerHTML = cfg.dayRate && cfg.split === 'random'
        ? '<strong>The split is flattering the model by ' + gap.toFixed(3) + ' AUC.</strong> A test call\'s day is almost always also in training, so the day-rate column hands it a summary of its neighbours\' answers. In real use every day is new, the column falls back to the average, and the score drops. No row was on both sides; the leak travelled through the group.'
        : cfg.dayRate ? '<strong>Holding out whole days makes the report honest.</strong> The test days, like real future days, were never in training, so the day-rate column is no help there, and the reported score matches real use.'
        : cfg.scaleAll ? 'Fitting the scaler on every row changes almost nothing here: with thousands of training rows, a few hundred more barely move an average and a spread. Keep the train-only rule anyway: the same mistake with a step that reads the labels (like the day-rate column) is expensive.'
        : 'Without the day-rate column, both splits give nearly the same honest estimate. Now switch the column on and watch the random split\'s report pull away from reality.';
      hist.innerHTML = '<div class="w-panel-title">' + L.icon('list-check') + ' Pipelines you have tried</div><table class="cl-table"><thead><tr><th>pipeline</th><td><strong>reported</strong></td><td><strong>real use</strong></td></tr></thead><tbody>' +
        history.map(function (h) { return '<tr><th>' + h.label + '</th><td>' + h.rep.toFixed(3) + '</td><td>' + h.real.toFixed(3) + '</td></tr>'; }).join('') + '</tbody></table>';
      draw();
    }
    function draw() {
      if (!cv || !last) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, lo = 0.5, hi = 0.9, X = function (v) { return 150 + (w - 190) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo); };
      ctx.clearRect(0, 0, w, h); ctx.font = '12px Inter, system-ui, sans-serif';
      [['Reported', last.rep, P.c0], ['In real use', last.real, P.c1]].forEach(function (b, i) {
        var y = 18 + i * (h - 50) / 2, bh = Math.min(26, (h - 60) / 2);
        ctx.fillStyle = P.ink2; ctx.textAlign = 'right'; ctx.fillText(b[0], 140, y + bh / 2 + 4);
        ctx.fillStyle = P.surface2; ctx.fillRect(X(lo), y, X(hi) - X(lo), bh);
        ctx.fillStyle = b[2]; ctx.fillRect(X(lo), y, X(b[1]) - X(lo), bh);
        ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText(b[1].toFixed(3), X(b[1]) + 6, y + bh / 2 + 4);
      });
      ctx.fillStyle = P.ink3; ctx.textAlign = 'center';
      for (var t = 0.5; t <= 0.901; t += 0.1) ctx.fillText(t.toFixed(1), X(t), h - 8);
      ctx.textAlign = 'left';
    }
    L.onTheme(draw);
    run();
  };
})();
