/* Threshold Explorer — ranking vs classification on an imbalanced problem.
   Simulated validation scores shaped like the Bank Marketing MLP (≈11.7% positives, ROC-AUC ≈ 0.80).
   Move the decision threshold, or pick a call budget (top-k), and see precision, recall and lift.
   Toggle class weighting: probabilities shift upwards, the ranking (and so AUC/AP) does not change.
   props: { n, positives, separation, weighting (bool), budget (bool) } */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['threshold-explorer'] = function (root, props) {
    props = props || {};
    var P = L.palette(), N = props.n || 6782, NP = props.positives || 794, sep = props.separation || 1.25;
    var thr = 0.5, budget = 20, weighted = false, mode = 'threshold';
    var r = L.rng(21), base = [];
    for (var i = 0; i < N; i++) { var pos = i < NP; base.push({ y: pos ? 1 : 0, z: pos ? -2.35 + sep + 1.05 * r.normal() : -2.35 + 1.0 * r.normal() }); }
    var shift = Math.log((N - NP) / NP);
    function probs() { return base.map(function (d) { return { y: d.y, p: 1 / (1 + Math.exp(-(d.z + (weighted ? shift : 0)))) }; }); }
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    var tabs = L.segmented({ value: mode, options: [{ value: 'threshold', label: 'Classify at a threshold' }, { value: 'budget', label: 'Rank and call the top k%' }], onChange: function (v) { mode = v; sT.el.hidden = v !== 'threshold'; sB.el.hidden = v !== 'budget'; draw(); } });
    root.appendChild(L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-row' }, [tabs.el].concat(props.weighting === false ? [] : [L.segmented({ value: 'no', options: [{ value: 'no', label: 'Unweighted loss' }, { value: 'yes', label: 'pos_weight = ' + Math.exp(shift).toFixed(2) }], onChange: function (v) { weighted = v === 'yes'; draw(); } }).el])), L.el('div', { class: 'w-grid2' }, [left, right])]));
    var cv = L.canvas(left, 0.55, draw, { cls: 'framed' });
    left.appendChild(L.legend([{ color: P.c0, label: 'did not subscribe (' + (N - NP).toLocaleString() + ')' }, { color: P.c1, label: 'subscribed (' + NP.toLocaleString() + ')' }]));
    var sT = L.slider({ label: 'Decision threshold', min: 0.02, max: 0.98, step: 0.01, value: thr, format: function (v) { return v.toFixed(2); }, onInput: function (v) { thr = v; draw(); } });
    var sB = L.slider({ label: 'Call budget: top k% of customers by score', min: 1, max: 60, step: 1, value: budget, format: function (v) { return v + '%'; }, onInput: function (v) { budget = v; draw(); } });
    sB.el.hidden = true;
    var cm = L.el('div', {}), stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    right.appendChild(sT.el); right.appendChild(sB.el); right.appendChild(stats); right.appendChild(cm); right.appendChild(msg);
    function draw() {
      if (!cv) return;
      P = L.palette();
      var d = probs(), sel;
      if (mode === 'threshold') sel = d.map(function (x) { return x.p >= thr; });
      else {
        var k = Math.round(N * budget / 100), order = d.map(function (x, i) { return i; }).sort(function (a, b) { return d[b].p - d[a].p; });
        sel = new Array(N).fill(false); for (var q = 0; q < k; q++) sel[order[q]] = true;
      }
      var tp = 0, fp = 0, fn = 0, tn = 0, meanP = 0;
      d.forEach(function (x, i) { meanP += x.p / N; if (sel[i] && x.y) tp++; else if (sel[i]) fp++; else if (x.y) fn++; else tn++; });
      var prec = tp / Math.max(1, tp + fp), rec = tp / NP, f1 = 2 * prec * rec / Math.max(1e-9, prec + rec), lift = prec / (NP / N);
      // histogram
      var ctx = cv.ctx, W = cv.w, H = cv.h, nb = 40, bins0 = new Array(nb).fill(0), bins1 = new Array(nb).fill(0);
      d.forEach(function (x) { var b = Math.min(nb - 1, Math.floor(x.p * nb)); if (x.y) bins1[b]++; else bins0[b]++; });
      var mx = Math.log10(Math.max.apply(null, bins0.concat(bins1)) + 1), bw = (W - 20) / nb;
      ctx.clearRect(0, 0, W, H);
      [[bins0, P.c0], [bins1, P.c1]].forEach(function (pair) {
        ctx.fillStyle = pair[1]; ctx.globalAlpha = 0.6;
        pair[0].forEach(function (v, b) { var h = Math.log10(v + 1) / mx * (H - 34); ctx.fillRect(10 + b * bw + 1, H - 20 - h, bw - 2, h); });
      });
      ctx.globalAlpha = 1;
      var cut = mode === 'threshold' ? thr : (function () { var ps = d.map(function (x) { return x.p; }).sort(function (a, b) { return b - a; }); return ps[Math.max(0, Math.round(N * budget / 100) - 1)]; })();
      var cx = 10 + cut * (W - 20);
      ctx.fillStyle = P.dark ? 'rgba(255,255,255,.06)' : 'rgba(0,0,0,.05)'; ctx.fillRect(cx, 8, W - 10 - cx, H - 28);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, H - 20); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText('0', 8, H - 6); ctx.fillText('predicted probability →', W / 2 - 55, H - 6); ctx.fillText('1', W - 16, H - 6); ctx.fillText('count (log scale)', 14, 18);
      ctx.fillStyle = P.ink2; ctx.fillText(mode === 'threshold' ? 'act →' : 'called →', cx + 6, 22);
      stats.innerHTML = '';
      [['Precision', L.fmtPct(prec), 'hero'], ['Recall', L.fmtPct(rec), 'hero'], [mode === 'threshold' ? 'F1' : 'Lift vs random', mode === 'threshold' ? f1.toFixed(3) : lift.toFixed(2) + '×'], ['Mean predicted P', meanP.toFixed(3)]].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      cm.innerHTML = '<div class="table-wrap" style="margin:0"><table><thead><tr><th></th><th>predicted / called: yes</th><th>no</th></tr></thead><tbody>' +
        '<tr><th>actually subscribed</th><td style="color:var(--green);font-weight:700">' + tp + ' TP</td><td>' + fn + ' FN (missed)</td></tr>' +
        '<tr><th>did not subscribe</th><td style="color:var(--red)">' + fp + ' FP (wasted calls)</td><td>' + tn + ' TN</td></tr></tbody></table></div>';
      msg.className = 'w-msg';
      msg.innerHTML = mode === 'threshold'
        ? 'A threshold turns scores into yes/no. Lower it: more subscribers caught (recall ↑) but more wasted calls (precision ↓). ' + (weighted ? '<strong>With pos_weight</strong> every probability is pushed up (mean predicted P ' + meanP.toFixed(2) + ' vs a true rate of 0.117), so the same 0.5 threshold now flags far more people. The <em>order</em> of customers hasn\'t changed at all.' : 'At 0.5 an imbalanced model flags few people: high precision, low recall.')
        : 'No threshold needed: sort customers by score and call the top ' + budget + '%. You reach <strong>' + L.fmtPct(rec) + '</strong> of all subscribers with a hit rate of ' + L.fmtPct(prec) + ', <strong>' + lift.toFixed(2) + '×</strong> better than calling at random. ' + (weighted ? 'Switching class weighting on changes nothing here: weighting shifts probabilities but keeps the ranking.' : 'This is why ranking metrics (ROC-AUC, AP) fit a fixed call budget.');
    }
    L.onTheme(draw);
    draw();
  };
})();
