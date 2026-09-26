/* Pixel Lab — why raw pixels defeat hand-written features.
   Pick or draw an 8×8 digit, see it as 64 numbers, shift it by one pixel and watch the numbers change;
   then try the "total ink" feature on 3 vs 8. Data: sklearn load_digits (same as Lesson 1.1). */
(function () {
  'use strict';
  var L = window.DLP.lib;

  window.DLP.widgets['pixel-lab'] = function (root) {
    root.innerHTML = '<div class="widget-loading">Loading digits…</div>';
    L.loadScript('static/js/data/digits.js', function () { build(root, window.DLP.data.digits); });
  };

  function build(root, D) {
    root.innerHTML = '';
    var P = L.palette();
    var cur = D.gallery[9].px.slice(), orig = cur.slice(), label = D.gallery[9].label;
    var tabs = L.segmented({ options: [{ value: 'pixels', label: 'A digit is 64 numbers' }, { value: 'ink', label: 'Try a hand-made feature' }], value: 'pixels', onChange: function (v) { paneA.hidden = v !== 'pixels'; paneB.hidden = v !== 'ink'; if (v === 'ink') drawHist(); } });
    root.appendChild(tabs.el);
    var paneA = L.el('div', { style: 'margin-top:14px' }), paneB = L.el('div', { style: 'margin-top:14px', hidden: 'hidden' });
    root.appendChild(paneA); root.appendChild(paneB);

    /* ------------ pane A: pixels */
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    paneA.appendChild(L.el('div', { class: 'w-grid2 even' }, [left, right]));
    var thumbs = L.el('div', { class: 'px-thumbs', role: 'listbox', 'aria-label': 'Example digits' });
    var gridEl = L.el('div', { class: 'px-grid', title: 'Draw on me' });
    var cells = [];
    for (var i = 0; i < 64; i++) { var c = L.el('div'); cells.push(c); gridEl.appendChild(c); }
    var vec = L.el('div', { class: 'px-vector', 'aria-label': 'The 64 pixel values' });
    var vcells = [];
    for (var k = 0; k < 64; k++) { var s = L.el('span', { text: '0' }); vcells.push(s); vec.appendChild(s); }
    var changedStat = L.stat('Numbers changed by the shift', '0 / 64', 'hero');
    var info = L.el('div', { class: 'w-msg' });

    left.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('image') + ' Pick a digit (or draw on the grid)' }));
    left.appendChild(thumbs);
    left.appendChild(L.el('div', { class: 'w-center' }, [gridEl]));
    left.appendChild(L.el('div', { class: 'w-row', style: 'justify-content:center' }, [
      L.button('Shift right →', function () { shift(1, 0); }),
      L.button('Shift down ↓', function () { shift(0, 1); }),
      L.button(L.icon('refresh') + ' Reset', function () { cur = orig.slice(); paint(); }),
      L.button('Clear & draw', function () { cur = new Array(64).fill(0); orig = cur.slice(); label = '?'; paint(); })
    ]));
    right.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('database') + ' What the model actually receives' }));
    right.appendChild(vec);
    right.appendChild(changedStat.el);
    right.appendChild(info);

    D.gallery.forEach(function (g, gi) {
      if (gi % 3 !== 0 && gi % 3 !== 1) return;
      var cv = document.createElement('canvas'); cv.width = 8; cv.height = 8;
      var ctx = cv.getContext('2d'), img = ctx.createImageData(8, 8);
      g.px.forEach(function (v, j) { var t = 255 - Math.round(v / 16 * 255); img.data[j * 4] = img.data[j * 4 + 1] = img.data[j * 4 + 2] = t; img.data[j * 4 + 3] = 255; });
      ctx.putImageData(img, 0, 0); cv.style.imageRendering = 'pixelated';
      var b = L.el('button', { type: 'button', 'aria-label': 'Digit ' + g.label }, [cv]);
      b.addEventListener('click', function () { cur = g.px.slice(); orig = cur.slice(); label = g.label; $$thumb(b); paint(); });
      thumbs.appendChild(b);
    });
    function $$thumb(b) { Array.prototype.forEach.call(thumbs.children, function (x) { x.classList.toggle('is-on', x === b); }); }

    function shift(dx, dy) {
      var n = new Array(64).fill(0);
      for (var r = 0; r < 8; r++) for (var c2 = 0; c2 < 8; c2++) {
        var sr = r - dy, sc = c2 - dx;
        if (sr >= 0 && sr < 8 && sc >= 0 && sc < 8) n[r * 8 + c2] = cur[sr * 8 + sc];
      }
      cur = n; paint();
    }

    var drawing = false;
    function paintAt(e) {
      var r = gridEl.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 8, y = (e.clientY - r.top) / r.height * 8;
      var cx = Math.floor(x), cy = Math.floor(y);
      if (cx < 0 || cy < 0 || cx > 7 || cy > 7) return;
      cur[cy * 8 + cx] = 16;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(function (d) { var nx = cx + d[0], ny = cy + d[1]; if (nx >= 0 && ny >= 0 && nx < 8 && ny < 8) cur[ny * 8 + nx] = Math.max(cur[ny * 8 + nx], 7); });
      orig = cur.slice(); label = '?'; paint();
    }
    gridEl.addEventListener('pointerdown', function (e) { drawing = true; gridEl.setPointerCapture(e.pointerId); paintAt(e); });
    gridEl.addEventListener('pointermove', function (e) { if (drawing) paintAt(e); });
    gridEl.addEventListener('pointerup', function () { drawing = false; });

    function paint() {
      P = L.palette();
      var ink = L.hexToRgb(P.ink), paper = L.hexToRgb(P.surface), changed = 0;
      for (var j = 0; j < 64; j++) {
        var col = L.mix(paper, ink, cur[j] / 16);
        cells[j].style.background = 'rgb(' + col.map(Math.round).join(',') + ')';
        vcells[j].textContent = cur[j];
        var ch = cur[j] !== orig[j]; if (ch) changed++;
        vcells[j].classList.toggle('changed', ch);
      }
      changedStat.set(changed + ' / 64');
      var inkv = cur.reduce(function (a, b) { return a + b; }, 0) / 64;
      info.className = 'w-msg' + (changed > 10 ? ' warn' : '');
      info.innerHTML = changed
        ? 'Moving the digit by one pixel changed <strong>' + changed + ' of the 64 numbers</strong>, yet a human still sees exactly the same ' + (label === '?' ? 'shape' : label) + '. The meaning lives in the <em>relationships</em> between pixels, not in any fixed position.'
        : 'This ' + (label === '?' ? 'drawing' : '“' + label + '”') + ' reaches a model as the 64 numbers on the left of this panel (0 = blank, 16 = full ink). Average ink: <strong>' + inkv.toFixed(2) + '</strong>. Now shift it by one pixel.';
    }

    /* ------------ pane B: ink feature */
    var hl = L.el('div', { class: 'w-col' }), hr = L.el('div', { class: 'w-col' });
    paneB.appendChild(L.el('div', { class: 'w-grid2' }, [hl, hr]));
    hl.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' Feature: “how much ink” (mean pixel value), digits 3 vs 8' }));
    var hc = L.canvas(hl, 0.55, function () { drawHist(); }, { cls: 'framed' });
    hl.appendChild(L.legend([{ color: P.c0, label: 'digit 3 (' + D.ink3.length + ')' }, { color: P.c1, label: 'digit 8 (' + D.ink8.length + ')' }]));
    var thr = D.threshold;
    var sThr = L.slider({ label: 'Rule: predict “8” if ink is above…', min: 2, max: 8, step: 0.05, value: thr, format: function (v) { return v.toFixed(2); }, onInput: function (v) { thr = v; drawHist(); } });
    var accStat = L.stat('Accuracy of this rule', '—', 'hero');
    var bestBtn = L.button('Find the best threshold', function () {
      var best = thr, bestA = 0;
      for (var t = 2; t <= 8; t += 0.01) { var a = acc(t); if (a > bestA) { bestA = a; best = t; } }
      thr = best; sThr.set(best); drawHist();
    });
    var hmsg = L.el('div', { class: 'w-msg' });
    hr.appendChild(sThr.el); hr.appendChild(accStat.el); hr.appendChild(bestBtn); hr.appendChild(hmsg);
    function acc(t) {
      var ok = 0;
      D.ink3.forEach(function (v) { if (v <= t) ok++; }); D.ink8.forEach(function (v) { if (v > t) ok++; });
      return ok / (D.ink3.length + D.ink8.length);
    }
    function drawHist() {
      if (!hc) return;
      P = L.palette();
      var ctx = hc.ctx, w = hc.w, h = hc.h, lo = 2, hi = 8, nb = 30, pad = { l: 30, r: 10, t: 12, b: 26 };
      ctx.clearRect(0, 0, w, h);
      function bins(arr) { var b = new Array(nb).fill(0); arr.forEach(function (v) { var k = Math.floor((v - lo) / (hi - lo) * nb); if (k >= 0 && k < nb) b[k]++; }); return b; }
      var b3 = bins(D.ink3), b8 = bins(D.ink8), mx = Math.max.apply(null, b3.concat(b8));
      var bw = (w - pad.l - pad.r) / nb;
      ctx.strokeStyle = P.line; ctx.beginPath(); ctx.moveTo(pad.l, h - pad.b + 0.5); ctx.lineTo(w - pad.r, h - pad.b + 0.5); ctx.stroke();
      [[b3, P.c0], [b8, P.c1]].forEach(function (pair) {
        ctx.fillStyle = pair[1]; ctx.globalAlpha = 0.55;
        pair[0].forEach(function (v, k) { var bh = v / mx * (h - pad.t - pad.b); ctx.fillRect(pad.l + k * bw + 1, h - pad.b - bh, bw - 2, bh); });
      });
      ctx.globalAlpha = 1;
      var tx = pad.l + (thr - lo) / (hi - lo) * (w - pad.l - pad.r);
      ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.moveTo(tx, pad.t); ctx.lineTo(tx, h - pad.b); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif'; ctx.textAlign = 'center';
      for (var t = 2; t <= 8; t += 1) ctx.fillText(String(t), pad.l + (t - lo) / (hi - lo) * (w - pad.l - pad.r), h - 8);
      ctx.textAlign = 'left'; ctx.fillStyle = P.ink2; ctx.fillText('← “3”', tx - 42, pad.t + 10); ctx.fillText('“8” →', tx + 6, pad.t + 10);
      var a = acc(thr);
      accStat.set(L.fmtPct(a));
      hmsg.className = 'w-msg' + (a < 0.7 ? ' warn' : '');
      hmsg.innerHTML = 'The two histograms sit almost on top of each other, so no threshold separates them well. The best you can do is about <strong>' + L.fmtPct(bestAcc) + '</strong>, and this was the <em>easy</em> pair on tiny 8×8 images. Hand-written pixel features run out of road fast.';
    }
    var bestAcc = 0; for (var t = 2; t <= 8; t += 0.01) bestAcc = Math.max(bestAcc, acc(t));
    L.onTheme(function () { paint(); drawHist(); });
    $$thumb(thumbs.children[6]);
    paint();
  }
})();
