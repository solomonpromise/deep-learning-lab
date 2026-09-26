/* Gradient Flow — Lesson 3.3's per-layer gradient probe, computed live.
   A deep MLP (width 64) runs one real forward and backward pass on 128 random rows with 61 standardised
   features and a 30%-positive label, using BCE-with-logits. Each bar is the Frobenius norm of one weight
   matrix's gradient, log scale, layer 1 = closest to the input. Choose the activation, the initialisation
   (PyTorch's default nn.Linear init, Kaiming normal, or far too large), LayerNorm / BatchNorm after each hidden
   linear layer, and residual blocks x + act(Wx + b), as in the notebook's deep_net and deep_residual. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var B = 128, D = 61, W = 64;
  var PRESETS = [
    { label: 'Sigmoid', act: 'sigmoid', init: 'default', norm: 'none', res: false },
    { label: 'ReLU', act: 'relu', init: 'default', norm: 'none', res: false },
    { label: 'ReLU + LayerNorm', act: 'relu', init: 'default', norm: 'ln', res: false },
    { label: 'ReLU + BatchNorm', act: 'relu', init: 'default', norm: 'bn', res: false },
    { label: 'ReLU + residual', act: 'relu', init: 'default', norm: 'none', res: true },
    { label: 'ReLU, Kaiming init', act: 'relu', init: 'kaiming', norm: 'none', res: false },
    { label: 'Too-large init', act: 'relu', init: 'big', norm: 'none', res: false }
  ];
  function matmul(A, n, k, Bm, m) {            // (n×k)·(k×m)
    var C = new Float64Array(n * m);
    for (var i = 0; i < n; i++) for (var p = 0; p < k; p++) { var a = A[i * k + p]; if (a === 0) continue; for (var j = 0; j < m; j++) C[i * m + j] += a * Bm[p * m + j]; }
    return C;
  }
  function act(kind, v) { return kind === 'relu' ? (v > 0 ? v : 0) : kind === 'tanh' ? Math.tanh(v) : 1 / (1 + Math.exp(-v)); }
  function dact(kind, v, out) { return kind === 'relu' ? (v > 0 ? 1 : 0) : kind === 'tanh' ? 1 - out * out : out * (1 - out); }
  function normFwd(Z, rows, cols, axis) {       // axis 'row' = LayerNorm, 'col' = BatchNorm (train mode)
    var Xh = new Float64Array(Z.length), S = [];
    var outer = axis === 'row' ? rows : cols, inner = axis === 'row' ? cols : rows;
    for (var o = 0; o < outer; o++) {
      var mu = 0, v = 0, idx = function (t) { return axis === 'row' ? o * cols + t : t * cols + o; };
      for (var t = 0; t < inner; t++) mu += Z[idx(t)]; mu /= inner;
      for (t = 0; t < inner; t++) { var d = Z[idx(t)] - mu; v += d * d; } v /= inner;
      var sd = Math.sqrt(v + 1e-5); S.push(sd);
      for (t = 0; t < inner; t++) Xh[idx(t)] = (Z[idx(t)] - mu) / sd;
    }
    return { Xh: Xh, S: S };
  }
  function normBwd(dXh, Xh, S, rows, cols, axis) {
    var dZ = new Float64Array(dXh.length), outer = axis === 'row' ? rows : cols, inner = axis === 'row' ? cols : rows;
    for (var o = 0; o < outer; o++) {
      var idx = function (t) { return axis === 'row' ? o * cols + t : t * cols + o; }, m1 = 0, m2 = 0;
      for (var t = 0; t < inner; t++) { m1 += dXh[idx(t)]; m2 += dXh[idx(t)] * Xh[idx(t)]; }
      m1 /= inner; m2 /= inner;
      for (t = 0; t < inner; t++) dZ[idx(t)] = (dXh[idx(t)] - m1 - Xh[idx(t)] * m2) / S[o];
    }
    return dZ;
  }
  function probe(cfg) {
    var r = L.rng(cfg.seed || 0), depth = cfg.depth, i, j;
    var X = new Float64Array(B * D), y = [];
    for (i = 0; i < B * D; i++) X[i] = r.normal();
    for (i = 0; i < B; i++) y.push(r() < 0.3 ? 1 : 0);
    var layers = [];
    for (var l = 0; l < depth; l++) {
      var fin = l === 0 ? D : W, fout = l === depth - 1 ? 1 : W, Wt = new Float64Array(fin * fout), bb = new Float64Array(fout), bound = 1 / Math.sqrt(fin);
      for (i = 0; i < Wt.length; i++) Wt[i] = cfg.init === 'kaiming' ? r.normal() * Math.sqrt(2 / fin) : cfg.init === 'big' ? r.normal() * 1.5 : (r() * 2 - 1) * bound;
      for (i = 0; i < fout; i++) bb[i] = cfg.init === 'kaiming' ? 0 : (r() * 2 - 1) * bound;
      layers.push({ fin: fin, fout: fout, W: Wt, b: bb, hidden: l > 0 && l < depth - 1 });
    }
    if (cfg.perturb) layers[cfg.perturb.l].W[cfg.perturb.idx] += cfg.perturb.eps;   // for gradient checks
    var h = X, cache = [];
    layers.forEach(function (Ly, l) {
      var Z = matmul(h, B, Ly.fin, Ly.W, Ly.fout);
      for (i = 0; i < B; i++) for (j = 0; j < Ly.fout; j++) Z[i * Ly.fout + j] += Ly.b[j];
      var c = { hin: h, Z: Z };
      if (l === depth - 1) { c.out = Z; cache.push(c); return; }
      var N = Z;
      if (Ly.hidden && cfg.norm !== 'none') { var nf = normFwd(Z, B, W, cfg.norm === 'ln' ? 'row' : 'col'); N = nf.Xh; c.nf = nf; }
      var A = new Float64Array(N.length);
      for (i = 0; i < N.length; i++) A[i] = act(cfg.act, N[i]);
      c.N = N; c.A = A;
      var H = A;
      if (Ly.hidden && cfg.res) { H = new Float64Array(A.length); for (i = 0; i < A.length; i++) H[i] = h[i] + A[i]; }
      cache.push(c); h = H;
    });
    var out = cache[depth - 1].out, dOut = new Float64Array(B), loss = 0;
    for (i = 0; i < B; i++) { var p = 1 / (1 + Math.exp(-out[i])); dOut[i] = (p - y[i]) / B; loss += -(y[i] ? Math.log(Math.max(p, 1e-300)) : Math.log(Math.max(1 - p, 1e-300))); }
    var norms = new Array(depth), grads = [], g = dOut, finite = isFinite(loss);
    for (l = depth - 1; l >= 0; l--) {
      var Ly = layers[l], c = cache[l], dZ;
      if (l === depth - 1) dZ = g;
      else {
        var dA = g, dN = new Float64Array(dA.length);
        for (i = 0; i < dA.length; i++) dN[i] = dA[i] * dact(cfg.act, c.N[i], c.A[i]);
        dZ = c.nf ? normBwd(dN, c.nf.Xh, c.nf.S, B, W, cfg.norm === 'ln' ? 'row' : 'col') : dN;
      }
      var s = 0, keep = cfg.keep ? new Float64Array(Ly.fin * Ly.fout) : null;   // dW = hin^T dZ
      for (var a = 0; a < Ly.fin; a++) for (var bcol = 0; bcol < Ly.fout; bcol++) {
        var v = 0; for (i = 0; i < B; i++) v += c.hin[i * Ly.fin + a] * dZ[i * Ly.fout + bcol]; s += v * v;
        if (keep) keep[a * Ly.fout + bcol] = v;
      }
      norms[l] = Math.sqrt(s);
      if (keep) grads[l] = keep;
      if (l > 0) {
        var WT = new Float64Array(Ly.fout * Ly.fin);
        for (a = 0; a < Ly.fin; a++) for (bcol = 0; bcol < Ly.fout; bcol++) WT[bcol * Ly.fin + a] = Ly.W[a * Ly.fout + bcol];
        var dH = matmul(dZ, B, Ly.fout, WT, Ly.fin);
        if (Ly.hidden && cfg.res) for (i = 0; i < dH.length; i++) dH[i] += g[i];
        g = dH;
      }
    }
    return { norms: norms, loss: loss / B, finite: finite, grads: grads };
  }
  window.DLP.lib.gradientProbe = probe;
  window.DLP.widgets['gradient-flow'] = function (root, props) {
    props = props || {};
    var P = L.palette(), cfg = { act: 'sigmoid', init: 'default', norm: 'none', res: false, depth: props.depth || 12, seed: 0 };
    var presets = L.el('div', { class: 'w-row' });
    PRESETS.forEach(function (pr) { presets.appendChild(L.button(pr.label, function () { cfg.act = pr.act; cfg.init = pr.init; cfg.norm = pr.norm; cfg.res = pr.res; sync(); run(); })); });
    var sAct = L.segmented({ value: cfg.act, options: [{ value: 'sigmoid', label: 'sigmoid' }, { value: 'tanh', label: 'tanh' }, { value: 'relu', label: 'ReLU' }], onChange: function (v) { cfg.act = v; run(); } });
    var sInit = L.segmented({ value: cfg.init, options: [{ value: 'default', label: 'PyTorch default init' }, { value: 'kaiming', label: 'Kaiming' }, { value: 'big', label: 'std 1.5' }], onChange: function (v) { cfg.init = v; run(); } });
    var sNorm = L.segmented({ value: cfg.norm, options: [{ value: 'none', label: 'no norm' }, { value: 'ln', label: 'LayerNorm' }, { value: 'bn', label: 'BatchNorm' }], onChange: function (v) { cfg.norm = v; run(); } });
    var sRes = L.segmented({ value: 'plain', options: [{ value: 'plain', label: 'f(x)' }, { value: 'res', label: 'x + f(x)' }], onChange: function (v) { cfg.res = v === 'res'; run(); } });
    var sDepth = L.slider({ label: 'layers (weight matrices)', min: 3, max: 24, step: 1, value: cfg.depth, onChange: function (v) { cfg.depth = v; run(); }, onInput: function (v) { cfg.depth = v; } });
    var cv = L.canvas(root, 0.36, draw, { cls: 'framed' });
    var controls = L.el('div', { class: 'w-grid2 even' }, [L.el('div', { class: 'w-col' }, [sAct.el, sInit.el, sNorm.el]), L.el('div', { class: 'w-col' }, [sRes.el, sDepth.el])]);
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [presets, controls, stats, msg]));
    root.insertBefore(cv.el, root.firstChild);
    var res = null;
    function sync() { sAct.set(cfg.act); sInit.set(cfg.init); sNorm.set(cfg.norm); sRes.set(cfg.res ? 'res' : 'plain'); }
    function run() { res = probe(cfg); draw(); }
    function draw() {
      if (!cv || !res) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, n = res.norms.length, lo = -12, hi = 12, padL = 46, padB = 26;
      var Y = function (v) { var lg = Math.log10(Math.max(v, 1e-30)); return 10 + (h - 10 - padB) * (1 - (L.clamp(lg, lo, hi) - lo) / (hi - lo)); };
      ctx.clearRect(0, 0, w, h);
      ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = P.ink3; ctx.strokeStyle = P.line; ctx.textAlign = 'right';
      for (var e = lo; e <= hi; e += 4) { var yy = Math.round(Y(Math.pow(10, e))) + 0.5; ctx.beginPath(); ctx.moveTo(padL, yy); ctx.lineTo(w - 8, yy); ctx.stroke(); ctx.fillText('1e' + e, padL - 6, yy + 4); }
      var max = Math.max.apply(null, res.norms), bw = (w - padL - 12) / n;
      res.norms.forEach(function (v, i) {
        var frozen = v < max * 1e-6;
        ctx.fillStyle = frozen ? P.line2 : L.css('--c0');
        var top = Y(v), base = Y(1e-12);
        ctx.fillRect(padL + i * bw + 2, top, Math.max(2, bw - 4), base - top);
        ctx.fillStyle = P.ink3; ctx.textAlign = 'center';
        if (n <= 16 || i % 2 === 0) ctx.fillText(String(i + 1), padL + i * bw + bw / 2, h - 10);
      });
      ctx.textAlign = 'left'; ctx.fillStyle = P.ink3; ctx.fillText('layer 1 = input side  ·  grey = below a millionth of the largest (effectively frozen)', padL + 4, 22);
      var first = res.norms[0], mid = res.norms[Math.floor(n / 2)], last = res.norms[n - 1], ratio = last / Math.max(first, 1e-30);
      var frozenN = res.norms.filter(function (v) { return v < max * 1e-6; }).length;
      function f(v) { return isFinite(v) ? v.toExponential(2) : 'NaN'; }
      stats.innerHTML = '';
      [['first layer', f(first)], ['middle', f(mid)], ['last layer', f(last)], ['last / first', f(ratio), ratio > 1e3 || ratio < 1e-3 ? 'bad' : 'good'], ['frozen layers', String(frozenN), frozenN ? 'bad' : '']].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      var total = Math.sqrt(res.norms.reduce(function (s, v) { return s + v * v; }, 0));
      msg.className = 'w-msg' + (ratio > 1e3 || total > 1e3 || !res.finite ? ' bad' : ' good');
      msg.innerHTML = !res.finite || total > 1e3 ? '<strong>Exploding.</strong> The gradient norms are enormous (total about ' + total.toExponential(1) + '): one optimizer step would throw the weights far away. Clip, and fix the initialisation.'
        : ratio > 1e3 ? '<strong>Vanishing.</strong> The first layer receives ' + ratio.toExponential(1) + ' times less gradient than the last. Every layer on the way down multiplies the signal by roughly (activation slope) × (weight scale), and here that product is below 1.'
        : '<strong>Healthy profile.</strong> Every layer receives a gradient within about three orders of magnitude of the others (last/first ' + ratio.toExponential(1) + ').';
    }
    L.onTheme(draw);
    run();
  };
})();
