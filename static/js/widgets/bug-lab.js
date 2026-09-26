/* Bug Lab — the three silent bugs of Lesson 1.3, reproduced live on the spirals.
   Same data, same network, same number of epochs; exactly one change per run. No error is ever raised. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var BUGS = {
    ok: { label: 'Working reference', opts: { activation: 'relu', lr: 0.01 }, color: 'c0' },
    nozero: { label: 'Bug 1: no zero_grad()', opts: { activation: 'relu', lr: 0.01, noZeroGrad: true }, color: 'c1' },
    linear: { label: 'Bug 2: no activation', opts: { activation: 'linear', lr: 0.01 }, color: 'c2' },
    lrhigh: { label: 'Bug 3: lr = 5.0', opts: { activation: 'relu', lr: 5.0 }, color: 'c3' }
  };
  var EPOCHS = 600;
  window.DLP.widgets['bug-lab'] = function (root) {
    var P = L.palette(), runs = {}, queue = [], busy = false;
    var data = L.spirals({ n: 500, noise: 0.04, revolutions: 2.5, seed: 42 }), split = L.split(data, 0.25, 0);
    var btns = L.el('div', { class: 'w-row' });
    Object.keys(BUGS).forEach(function (k) { btns.appendChild(L.button(BUGS[k].label, function () { enqueue([k]); })); });
    btns.appendChild(L.button(L.icon('play') + ' Run all four', function () { enqueue(Object.keys(BUGS)); }, 'primary'));
    var chartBox = L.el('div', { class: 'w-panel' }, [L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Training loss, ' + EPOCHS + ' full-batch epochs (Adam)' })]);
    var cv = L.canvas(chartBox, 0.36, draw);
    var legend = L.el('div', {});
    chartBox.appendChild(legend);
    var table = L.el('div', {});
    var status = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [btns, chartBox, table, status]));

    function enqueue(keys) { keys.forEach(function (k) { if (queue.indexOf(k) < 0) queue.push(k); runs[k] = null; }); if (!busy) runNext(); paint(); }
    function runNext() {
      var k = queue.shift();
      if (!k) { busy = false; paint(); return; }
      busy = true;
      var o = BUGS[k].opts;
      var net = new L.MLP([2, 32, 32, 1], { activation: o.activation, lr: o.lr, seed: 42, noZeroGrad: o.noZeroGrad });
      var r = L.rng(1), run = { hist: [], done: false }; runs[k] = run;
      function chunk() {
        var t0 = performance.now();
        while (run.hist.length < EPOCHS && performance.now() - t0 < 30) {
          var loss = net.epoch(split.train.X, split.train.y, split.train.X.length, r);
          run.hist.push(isFinite(loss) ? loss : NaN);
        }
        draw();
        status.innerHTML = 'Training <strong>' + BUGS[k].label + '</strong>… epoch ' + run.hist.length + ' / ' + EPOCHS;
        if (run.hist.length < EPOCHS) setTimeout(chunk, 0);
        else { run.done = true; run.acc = L.accuracy(net, split.test.X, split.test.y); paint(); runNext(); }
      }
      chunk();
    }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var series = Object.keys(BUGS).filter(function (k) { return runs[k]; }).map(function (k) {
        return { color: P[BUGS[k].color], values: runs[k].hist.map(function (v) { return Math.min(v, 1.2); }) };
      });
      L.lineChart(cv.ctx, cv.w, cv.h, series.length ? series : [{ color: P.ink3, values: [NaN] }], { xlabel: 'epoch', ymin: 0, ymax: 1.2 });
    }
    function paint() {
      P = L.palette();
      legend.innerHTML = '';
      legend.appendChild(L.legend(Object.keys(BUGS).map(function (k) { return { color: P[BUGS[k].color], label: BUGS[k].label }; })));
      var rows = Object.keys(BUGS).filter(function (k) { return runs[k] && runs[k].done; });
      table.innerHTML = rows.length ? '<div class="table-wrap" style="margin:0"><table><thead><tr><th>run</th><th>final train loss</th><th>validation accuracy</th><th>error raised?</th></tr></thead><tbody>' +
        rows.map(function (k) { var h = runs[k].hist; return '<tr><td>' + BUGS[k].label + '</td><td>' + (isFinite(h[h.length - 1]) ? h[h.length - 1].toFixed(4) : 'NaN') + '</td><td><strong>' + L.fmtPct(runs[k].acc) + '</strong></td><td>none</td></tr>'; }).join('') + '</tbody></table></div>' : '';
      if (!busy) {
        var done = rows.length;
        status.className = 'w-msg' + (done ? '' : '');
        status.innerHTML = done ? '<strong>Every run finished without a single error message</strong>, yet only one of them actually learned. The <em>shape</em> of the curve and a check on held-out accuracy are the only alarms you get. (Network: 2→32→32→1 in your browser; numbers differ a little from the notebook\'s 64-unit PyTorch model, but the signatures are the same.)'
          : 'Press <strong>Run all four</strong> (about 10 seconds) or run one bug at a time. Predict each curve\'s shape before you look.';
      }
    }
    L.onTheme(function () { draw(); paint(); });
    paint(); draw();
  };
})();
