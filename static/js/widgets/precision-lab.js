/* Precision Lab — what fp32, fp16 and bf16 can hold, and why fp16 training needs a loss scaler.
   "Store a number": type or pick a value and see what each format actually keeps, computed with IEEE rounding
   (round-to-nearest-even; fp16 with subnormals and overflow to inf; bf16 as the top 16 bits of fp32).
   "Loss scaling": a realistic spread of gradient magnitudes (log-normal, centred near 1e-6). In fp16 everything
   below the smallest subnormal (≈ 6e-8) becomes exactly 0 and stops learning; multiplying the loss by a scale
   shifts every gradient right, and anything above 65,504 overflows, which is when GradScaler skips a step
   and lowers the scale. bf16 keeps fp32's range, so nothing vanishes and no scaler is needed. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var F16_MAX = 65504, F16_MIN_SUB = Math.pow(2, -24), F16_MIN_NORMAL = Math.pow(2, -14);

  function rne(v) { var f = Math.floor(v), d = v - f; return d > 0.5 ? f + 1 : d < 0.5 ? f : (f % 2 === 0 ? f : f + 1); }
  function toF16(x) {
    if (!isFinite(x) || x === 0) return x;
    var s = x < 0 ? -1 : 1, a = Math.abs(x), v;
    if (a < F16_MIN_NORMAL) v = rne(a / F16_MIN_SUB) * F16_MIN_SUB;
    else { var e = Math.floor(Math.log2(a)), step = Math.pow(2, e - 10); v = rne(a / step) * step; }
    if (v > F16_MAX) return s * Infinity;
    return s * v;
  }
  var buf = new ArrayBuffer(4), f32 = new Float32Array(buf), u32 = new Uint32Array(buf);
  function toBF16(x) {
    if (!isFinite(x)) return x;
    f32[0] = x; var b = u32[0], lsb = (b >>> 16) & 1;
    b = (b + 0x7fff + lsb) >>> 0; u32[0] = (b & 0xffff0000) >>> 0;
    return f32[0];
  }
  function fmt(v) {
    if (v === 0) return '0';
    if (!isFinite(v)) return v > 0 ? 'inf' : '−inf';
    var a = Math.abs(v);
    return a >= 1e5 || a < 1e-3 ? v.toExponential(6).replace(/\.?0+e/, 'e') : String(+v.toPrecision(9));
  }

  window.DLP.widgets['precision-lab'] = function (root) {
    var tab = 'store', value = 70000, scalePow = 0, useBF16 = false;
    var P = L.palette();
    var seg = L.segmented({ label: 'View', value: tab, options: [{ label: 'Store a number', value: 'store' }, { label: 'Loss scaling', value: 'scale' }],
      onChange: function (v) { tab = v; paint(); } });
    // --- store view
    var input = L.el('input', { type: 'text', class: 'pl-input', value: '70000', 'aria-label': 'Number to store', inputmode: 'decimal' });
    input.addEventListener('input', function () { var v = parseFloat(input.value.replace(/[,\s]/g, '')); if (!isNaN(v)) { value = v; paint(); } });
    var presets = L.el('div', { class: 'w-row pl-presets' }, [['70000', 'too big for fp16'], ['1e-8', 'too small for fp16'], ['1.0001', 'fine detail'], ['0.1', 'no exact binary'], ['65504', 'fp16 maximum'], ['3.14159265', 'π']].map(function (p) {
      return L.button('<code>' + p[0] + '</code>', function () { input.value = p[0]; value = parseFloat(p[0]); paint(); });
    }));
    var table = L.el('div', { class: 'pl-table' });
    var storeView = L.el('div', { class: 'w-col' }, [L.el('label', { class: 'w-label', text: 'Type a number, or pick one' }), input, presets, table]);
    // --- scaling view
    var sScale = L.slider({ label: 'Loss scale', min: 0, max: 30, step: 1, value: 0, format: function (v) { return '2^' + v + ' = ' + Math.pow(2, v).toLocaleString('en-US'); }, onInput: function (v) { scalePow = v; paint(); } });
    var fmtSeg = L.segmented({ label: 'Number format for the gradients', value: 'f16', options: [{ label: 'fp16', value: 'f16' }, { label: 'bf16', value: 'bf16' }], onChange: function (v) { useBF16 = v === 'bf16'; paint(); } });
    var scaleView = L.el('div', { class: 'w-col' }, [fmtSeg.el, sScale.el]);
    var cv, stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    var canvasHolder = L.el('div');
    root.appendChild(L.el('div', { class: 'w-col' }, [seg.el, storeView, scaleView, canvasHolder, stats, msg]));
    cv = L.canvas(canvasHolder, 0.34, draw, { cls: 'framed' });

    // gradient magnitudes: log-normal around 1e-6, deterministic
    var grads = (function () { var r = L.rng(4), g = []; for (var i = 0; i < 4000; i++) g.push(Math.pow(10, -6 + 1.4 * r.normal())); return g; })();

    function paint() {
      storeView.hidden = tab !== 'store'; scaleView.hidden = tab !== 'scale';
      stats.innerHTML = '';
      if (tab === 'store') paintStore(); else paintScale();
      draw();
    }
    function paintStore() {
      var rowsHtml = '<table class="cl-table pl-t"><thead><tr><th>format</th><th>bytes</th><th>stored value</th><th>error</th></tr></thead><tbody>';
      [['fp32', 4, Math.fround(value)], ['fp16', 2, toF16(value)], ['bf16', 2, toBF16(value)]].forEach(function (f) {
        var err = !isFinite(f[2]) ? 'overflow' : f[2] === 0 && value !== 0 ? 'underflow: became 0' : value === 0 ? '0' : (Math.abs(f[2] - value) / Math.abs(value) * 100).toPrecision(2) + '%';
        var bad = !isFinite(f[2]) || (f[2] === 0 && value !== 0);
        rowsHtml += '<tr' + (bad ? ' class="pl-bad"' : '') + '><th>' + f[0] + '</th><td>' + f[1] + '</td><td>' + fmt(f[2]) + '</td><td>' + err + '</td></tr>';
      });
      table.innerHTML = rowsHtml + '</tbody></table>';
      var h = toF16(value), b = toBF16(value);
      msg.className = 'w-msg' + ((!isFinite(h) || (h === 0 && value !== 0)) ? ' warn' : '');
      msg.innerHTML = !isFinite(h) ? '<strong>fp16 overflowed to infinity.</strong> Its largest value is 65,504. bf16 still holds it (as ' + fmt(b) + '), because it keeps fp32\'s range and gives up precision instead.'
        : h === 0 && value !== 0 ? '<strong>fp16 rounded it to exactly 0.</strong> Its smallest positive value is about 6e-8. A gradient this small stops training that weight. bf16 keeps it: ' + fmt(b) + '.'
        : Math.abs(b - value) > Math.abs(h - value) ? 'Both formats hold it, but <strong>bf16 is coarser</strong>: near 1.0 it can only step by 0.0078, fp16 by 0.00098. That is usually harmless for training, because gradient descent is noisy anyway.'
        : 'All three formats hold this value; the error column shows how much of it each one keeps.';
    }
    function paintScale() {
      var s = Math.pow(2, scalePow), zero = 0, inf = 0;
      grads.forEach(function (g) { var v = useBF16 ? toBF16(g * s) : toF16(g * s); if (v === 0) zero++; else if (!isFinite(v)) inf++; });
      root.dispatchEvent(new CustomEvent('dlp:metrics', { bubbles: true, detail: { view: 'scale', format: useBF16 ? 'bf16' : 'fp16', zeroPct: zero / grads.length * 100, infPct: inf / grads.length * 100, scalePow: scalePow } }));
      [['Gradients that became 0', (zero / grads.length * 100).toFixed(1) + '%', zero ? 'bad' : 'good'], ['Overflowed to inf', (inf / grads.length * 100).toFixed(1) + '%', inf ? 'bad' : 'good'], ['Loss scale', '2^' + scalePow]].forEach(function (x) { stats.appendChild(L.stat(x[0], x[1], x[2]).el); });
      msg.className = 'w-msg' + (zero || inf ? ' warn' : ' good');
      msg.innerHTML = useBF16 ? '<strong>bf16 has fp32\'s range</strong>, so none of these gradients vanish, even without scaling. That is why bf16 training needs no GradScaler.'
        : inf ? '<strong>Some scaled gradients overflowed.</strong> GradScaler would skip this optimizer step and halve the scale. Skipping a step now and then is the correct behaviour, not a bug.'
        : zero / grads.length > 0.01 ? '<strong>' + (zero / grads.length * 100).toFixed(0) + '% of the gradients became exactly 0 in fp16</strong>, so those weights stop learning and nothing warns you. Raise the loss scale to shift them into range.'
        : 'Scaled by 2^' + scalePow + ', every gradient fits in fp16. Before the optimizer step the scaler divides them back down (in fp32), so the update is unchanged.';
    }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h;
      ctx.clearRect(0, 0, w, h);
      ctx.font = '11px Inter, system-ui, sans-serif';
      if (tab === 'store') {
        // representable ranges on a log axis, with the current value marked
        var lo = -46, hi = 40, X = function (e) { return 60 + (w - 80) * (e - lo) / (hi - lo); };
        var rows = [['fp32', -45.2, -37.9, 38.5, P.c0], ['fp16', -7.2, -4.2, 4.8, P.c1], ['bf16', -40, -37.9, 38.5, P.c2]];
        rows.forEach(function (r, i) {
          var y = 22 + i * ((h - 50) / 3);
          ctx.fillStyle = P.ink2; ctx.textAlign = 'right'; ctx.fillText(r[0], 50, y + 10);
          ctx.fillStyle = r[4]; ctx.globalAlpha = 0.35; ctx.fillRect(X(r[1]), y, X(r[2]) - X(r[1]), 16);
          ctx.globalAlpha = 0.85; ctx.fillRect(X(r[2]), y, X(r[3]) - X(r[2]), 16); ctx.globalAlpha = 1;
        });
        ctx.fillStyle = P.ink3; ctx.textAlign = 'center';
        [-40, -30, -20, -10, 0, 10, 20, 30, 40].forEach(function (e) { ctx.fillText('1e' + e, X(e), h - 8); });
        if (value) {
          var ev = Math.log10(Math.abs(value));
          ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(ev), 12); ctx.lineTo(X(ev), h - 24); ctx.stroke();
        }
        ctx.textAlign = 'left';
        return;
      }
      // histogram of log10 |gradient × scale|
      var s = Math.pow(2, scalePow), lo2 = -14, hi2 = 8, bins = 88, counts = new Array(bins).fill(0);
      grads.forEach(function (g) { var e = Math.log10(g * s), k = Math.floor((e - lo2) / (hi2 - lo2) * bins); if (k >= 0 && k < bins) counts[k]++; });
      var mx = Math.max.apply(null, counts), X2 = function (e) { return 30 + (w - 50) * (e - lo2) / (hi2 - lo2); };
      var under = Math.log10(useBF16 ? 9.2e-41 : F16_MIN_SUB / 2), over = Math.log10(useBF16 ? 3.39e38 : 65520);
      ctx.fillStyle = P.dark ? 'rgba(236,106,105,.14)' : 'rgba(214,60,59,.10)';
      if (under > lo2) ctx.fillRect(X2(lo2), 8, X2(under) - X2(lo2), h - 36);
      if (over < hi2) ctx.fillRect(X2(over), 8, X2(hi2) - X2(over), h - 36);
      for (var k = 0; k < bins; k++) {
        var e0 = lo2 + (hi2 - lo2) * k / bins, bh = (h - 44) * counts[k] / mx, bad = e0 < under || e0 >= over;
        ctx.fillStyle = bad ? P.red : P.c0;
        ctx.fillRect(X2(e0) + 0.5, h - 28 - bh, Math.max(1, (w - 50) / bins - 1), bh);
      }
      ctx.fillStyle = P.ink3; ctx.textAlign = 'center';
      for (var t = -14; t <= 8; t += 2) ctx.fillText('1e' + t, X2(t), h - 10);
      if (!useBF16) { ctx.fillStyle = P.red; ctx.fillText('becomes 0 in fp16', X2(Math.max(lo2 + 1.6, under - 1.8)), 22); ctx.fillText('inf', X2(Math.min(hi2 - 0.4, over + 0.8)), 22); }
      ctx.textAlign = 'left';
    }
    L.onTheme(draw);
    paint();
  };
})();
