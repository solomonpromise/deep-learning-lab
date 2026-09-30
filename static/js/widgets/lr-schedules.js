/* LR Schedules — the learning rate each epoch trains with, under four common schedules. The values are exactly
   what PyTorch computes when scheduler.step() is called once per epoch: constant, StepLR, CosineAnnealingLR, and
   linear warmup followed by cosine (LinearLR + CosineAnnealingLR chained with SequentialLR). */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['lr-schedules'] = function (root, props) {
    props = props || {};
    var P = L.palette(), base = props.lr || 1e-2, E = props.epochs || 15, stepSize = 5, gamma = 0.1, warm = 2, logY = true;
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var axis = L.segmented({ value: 'log', options: [{ value: 'log', label: 'log axis' }, { value: 'lin', label: 'linear axis' }], onChange: function (v) { logY = v === 'log'; draw(); } });
    left.appendChild(axis.el);
    var cv = L.canvas(left, 0.56, draw, { cls: 'framed' });
    var legend = L.el('div'); left.appendChild(legend);
    var sE = L.slider({ label: 'epochs', min: 5, max: 60, step: 1, value: E, onInput: function (v) { E = v; draw(); } });
    var sS = L.slider({ label: 'StepLR step_size', min: 1, max: 20, step: 1, value: stepSize, onInput: function (v) { stepSize = v; draw(); } });
    var sG = L.slider({ label: 'StepLR gamma', min: 0.1, max: 0.9, step: 0.05, value: gamma, format: function (v) { return v.toFixed(2); }, onInput: function (v) { gamma = v; draw(); } });
    var sW = L.slider({ label: 'warmup epochs', min: 0, max: 10, step: 1, value: warm, onInput: function (v) { warm = v; draw(); } });
    var code = L.el('pre', { class: 'nbs-code lrs-code' });
    var msg = L.el('div', { class: 'w-msg' });
    right.appendChild(sE.el); right.appendChild(sS.el); right.appendChild(sG.el); right.appendChild(sW.el); right.appendChild(code); right.appendChild(msg);

    function cosine(e, T, lr0) { return lr0 * (1 + Math.cos(Math.PI * e / T)) / 2; }
    function series() {
      var c = [], s = [], k = [], wc = [], w = Math.min(warm, E - 1);
      for (var e = 0; e < E; e++) {
        c.push(base);
        s.push(base * Math.pow(gamma, Math.floor(e / stepSize)));
        k.push(cosine(e, E, base));
        wc.push(e < w ? base * (0.1 + 0.9 * e / w) : cosine(e - w, E - w, base));
      }
      return { constant: c, step: s, cosine: k, warm: wc };
    }
    function fmt(v) { return v >= 1e-3 ? v.toFixed(4).replace(/0+$/, '').replace(/\.$/, '') : v.toExponential(1); }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var S = series(), floor = base * 1e-3;
      var tr = function (arr) { return arr.map(function (v) { return logY ? Math.log10(Math.max(v, floor)) : v; }); };
      var lines = [
        { key: 'constant', label: 'constant', color: P.ink3, dashed: true },
        { key: 'step', label: 'StepLR', color: P.c0 },
        { key: 'cosine', label: 'cosine', color: P.c1 },
        { key: 'warm', label: 'warmup + cosine', color: P.c3 }
      ];
      L.lineChart(cv.ctx, cv.w, cv.h, lines.map(function (l) { return { color: l.color, dashed: l.dashed, values: tr(S[l.key]) }; }),
        { xlabel: 'epoch (the rate that epoch trains with)', padL: 52, xoffset: 1, ymin: logY ? Math.log10(floor) : 0, ymax: logY ? Math.log10(base) + 1 : base * 1.05,
          fmt: function (v) { return logY ? '1e' + Math.round(v) : v.toFixed(3); } });
      legend.innerHTML = ''; legend.appendChild(L.legend(lines.map(function (l) { return { color: l.color, label: l.label, dashed: l.dashed }; })));
      var w = Math.min(warm, E - 1);
      code.textContent =
        'opt = torch.optim.AdamW(model.parameters(), lr=' + base + ')\n\n' +
        'StepLR(opt, step_size=' + stepSize + ', gamma=' + gamma.toFixed(2).replace(/0$/, '') + ')\n' +
        'CosineAnnealingLR(opt, T_max=' + E + ')\n' +
        (w > 0 ? 'SequentialLR(opt, [\n    LinearLR(opt, start_factor=0.1, total_iters=' + w + '),\n    CosineAnnealingLR(opt, T_max=' + (E - w) + ')],\n    milestones=[' + w + '])' : 'warmup 0 → plain CosineAnnealingLR(opt, T_max=' + E + ')') +
        '\n\n# call sched.step() once after each epoch';
      var drops = Math.floor((E - 1) / stepSize);
      msg.innerHTML = 'Last epoch trains at: StepLR <strong>' + fmt(S.step[E - 1]) + '</strong> (' + drops + ' drop' + (drops === 1 ? '' : 's') + '), cosine <strong>' + fmt(S.cosine[E - 1]) + '</strong>, warmup + cosine <strong>' + fmt(S.warm[E - 1]) + '</strong>. ' +
        (gamma <= 0.1 && drops >= 2 ? 'Two drops of ×0.1 leave StepLR at 1/100 of the start: the last epochs barely move the weights. ' : '') +
        (w > 0 ? 'Warmup spends the first ' + w + ' epoch' + (w > 1 ? 's' : '') + ' below the full rate, so a freshly initialised model is not hit with full-size steps.' : '');
    }
    L.onTheme(draw);
    draw();
  };
})();
