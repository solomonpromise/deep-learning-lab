/* Paired Lab — why comparing two models on the same splits beats comparing their averages.
   Each simulated split has a difficulty shared by both models (normal, sd = "shared"), and each model adds its
   own wobble (normal, sd = "own"). Model B is truly better by "gap". Left: every split as an arrow from A's
   score to B's. Right: the split-by-split differences, where the shared part has cancelled.
   Unpaired: Welch's t on the two sets of scores. Paired: t on the differences, and a count of wins.
   "The lesson's ten splits" shows the measured network (A) and boosting (B) test AUCs. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var NET = [0.7776, 0.8098, 0.7850, 0.7795, 0.7906, 0.7952, 0.8144, 0.8034, 0.8101, 0.7904];
  var GB = [0.7903, 0.8174, 0.7923, 0.7936, 0.7983, 0.7969, 0.8164, 0.8169, 0.8127, 0.7993];
  function tcrit(df) {                                 // two-sided 95% critical value (Cornish-Fisher expansion)
    var z = 1.959964, z3 = z * z * z, z5 = z3 * z * z;
    return z + (z3 + z) / (4 * df) + (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df);
  }
  window.DLP.widgets['paired-lab'] = function (root, props) {
    props = props || {};
    var st = { gap: 0.008, shared: 0.013, own: 0.002, k: 10, seed: 1, real: !!props.real };
    var A = [], B = [];
    var P = L.palette();
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.55, draw, { cls: 'framed' });
    var legend = L.el('div'); left.appendChild(legend);
    var stats = L.el('div', { class: 'w-stats' }); left.appendChild(stats);
    var msg = L.el('div', { class: 'w-msg' }); left.appendChild(msg);
    function sim() { st.real = false; simulate(); draw(); }
    var sGap = L.slider({ label: 'true gap, B minus A', min: 0, max: 0.02, step: 0.001, value: st.gap, format: function (v) { return v.toFixed(3); }, onInput: function (v) { st.gap = v; sim(); } });
    var sShared = L.slider({ label: 'shared split difficulty (sd)', min: 0, max: 0.02, step: 0.001, value: st.shared, format: function (v) { return v.toFixed(3); }, onInput: function (v) { st.shared = v; sim(); } });
    var sOwn = L.slider({ label: 'each model\'s own wobble (sd)', min: 0.0005, max: 0.01, step: 0.0005, value: st.own, format: function (v) { return v.toFixed(4); }, onInput: function (v) { st.own = v; sim(); } });
    var sK = L.slider({ label: 'number of splits', min: 3, max: 40, step: 1, value: st.k, onInput: function (v) { st.k = v; sim(); } });
    var row = L.el('div', { class: 'w-row' }, [
      L.button(L.icon('refresh') + ' New splits', function () { st.seed++; sim(); }),
      L.button('The lesson\'s ten splits', function () { st.real = true; simulate(); draw(); })
    ]);
    [sGap.el, sShared.el, sOwn.el, sK.el, row].forEach(function (e) { right.appendChild(e); });

    function simulate() {
      if (st.real) { A = NET.slice(); B = GB.slice(); return; }
      var r = L.rng(st.seed * 7919 + 13);
      A = []; B = [];
      for (var i = 0; i < st.k; i++) {
        var d = st.shared * r.normal();
        A.push(0.80 + d + st.own * r.normal());
        B.push(0.80 + st.gap + d + st.own * r.normal());
      }
    }
    function mean(v) { return v.reduce(function (s, x) { return s + x; }, 0) / v.length; }
    function sd(v) { var m = mean(v); return Math.sqrt(v.reduce(function (s, x) { return s + (x - m) * (x - m); }, 0) / (v.length - 1)); }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, k = A.length;
      var D = B.map(function (b, i) { return b - A[i]; });
      var all = A.concat(B), lo = Math.min.apply(null, all), hi = Math.max.apply(null, all), pad = (hi - lo) * 0.08 + 0.001;
      lo -= pad; hi += pad;
      var dlo = Math.min(-0.004, Math.min.apply(null, D)), dhi = Math.max(0.004, Math.max.apply(null, D)), dp = (dhi - dlo) * 0.1;
      dlo -= dp; dhi += dp;
      var split = Math.round(w * 0.6), top = 26, bottom = h - 24, rowH = (bottom - top) / k;
      var X = function (v) { return 12 + (split - 30) * (v - lo) / (hi - lo); };
      var X2 = function (v) { return split + 14 + (w - split - 26) * (v - dlo) / (dhi - dlo); };
      ctx.clearRect(0, 0, w, h);
      ctx.font = '700 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center'; ctx.fillStyle = P.ink2;
      ctx.fillText('each split: A → B', (12 + split - 18) / 2, 14);
      ctx.fillText('B − A', (split + 14 + w - 12) / 2, 14);
      ctx.strokeStyle = P.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(split, 4); ctx.lineTo(split, h - 4); ctx.stroke();
      var zx = X2(0);
      ctx.strokeStyle = P.ink3; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(zx, top - 4); ctx.lineTo(zx, bottom); ctx.stroke(); ctx.setLineDash([]);
      var md = mean(D), se = k > 1 ? sd(D) / Math.sqrt(k) : 0, tc = tcrit(Math.max(1, k - 1));
      ctx.fillStyle = P.dark ? 'rgba(52,199,89,.16)' : 'rgba(46,160,67,.13)';
      ctx.fillRect(X2(md - tc * se), top - 4, Math.max(2, X2(md + tc * se) - X2(md - tc * se)), bottom - top + 4);
      for (var i = 0; i < k; i++) {
        var y = top + rowH * (i + 0.5), xa = X(A[i]), xb = X(B[i]);
        ctx.strokeStyle = P.ink3; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xb, y); ctx.stroke();
        if (Math.abs(xb - xa) > 6) { var dir = xb > xa ? 1 : -1; ctx.fillStyle = P.ink3; ctx.beginPath(); ctx.moveTo(xb - dir * 3, y); ctx.lineTo(xb - dir * 8, y - 3.5); ctx.lineTo(xb - dir * 8, y + 3.5); ctx.fill(); }
        var r = Math.max(2, Math.min(4, rowH * 0.32));
        ctx.fillStyle = P.c0; ctx.beginPath(); ctx.arc(xa, y, r, 0, 7); ctx.fill();
        ctx.fillStyle = P.c1; ctx.beginPath(); ctx.arc(xb, y, r, 0, 7); ctx.fill();
        ctx.fillStyle = D[i] > 0 ? P.green : P.red; ctx.beginPath(); ctx.arc(X2(D[i]), y, r + 0.5, 0, 7); ctx.fill();
      }
      ctx.fillStyle = P.ink3; ctx.font = '600 10.5px Inter, system-ui, sans-serif';
      ctx.textAlign = 'left'; ctx.fillText(lo.toFixed(3), 12, h - 8);
      ctx.textAlign = 'right'; ctx.fillText(hi.toFixed(3), split - 18, h - 8);
      ctx.textAlign = 'center'; ctx.fillText('0', zx, h - 8);
      legend.innerHTML = '';
      legend.appendChild(L.legend([{ color: P.c0, label: st.real ? 'A: neural network' : 'model A' }, { color: P.c1, label: st.real ? 'B: gradient boosting' : 'model B' }, { color: P.green, label: 'B − A, with its 95% interval' }]));
      var gap = mean(B) - mean(A), tu = gap / Math.sqrt((sd(A) * sd(A) + sd(B) * sd(B)) / k), tp = se > 0 ? md / se : 0;
      var wins = D.filter(function (d) { return d > 0; }).length;
      var unpairedReal = Math.abs(tu) > tc, pairedReal = Math.abs(tp) > tc;
      stats.innerHTML = '';
      [['Gap in averages', (gap >= 0 ? '+' : '') + gap.toFixed(4)], ['Each model\'s spread', sd(A).toFixed(4) + ' / ' + sd(B).toFixed(4)], ['Spread of B − A', sd(D).toFixed(4)], ['B ahead on', wins + ' of ' + k, wins === k ? 'good' : wins <= k / 2 ? 'bad' : '']]
        .forEach(function (x) { stats.appendChild(L.stat(x[0], x[1], x[2]).el); });
      msg.className = 'w-msg ' + (pairedReal && !unpairedReal ? 'good' : pairedReal ? 'good' : 'warn');
      msg.innerHTML = (st.real ? '<strong>The lesson\'s measurements.</strong> ' : '') +
        'Unpaired, the gap is ' + Math.abs(tu).toFixed(1) + ' standard errors: <strong>' + (unpairedReal ? 'clear' : 'inconclusive') + '</strong>. ' +
        'Paired, it is ' + Math.abs(tp).toFixed(1) + ': <strong>' + (pairedReal ? (tp > 0 ? 'B is better' : 'A is better') : 'still inconclusive') + '</strong>' +
        (pairedReal && !unpairedReal ? ', because the shared split difficulty cancels in the subtraction.' : '.') +
        (!st.real && st.gap === 0 ? ' The true gap is zero here, so any "finding" is luck: press <em>New splits</em> a few times.' : '') +
        (!st.real && st.shared < st.own ? ' With little shared difficulty, pairing has little to cancel.' : '');
    }
    L.onTheme(draw);
    simulate(); draw();
  };
})();
