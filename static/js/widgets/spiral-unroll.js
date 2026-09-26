/* Spiral Unroll — animate the change of representation from (x1, x2) to (radius, aligned angle).
   Same points, same labels, different description: in the new space one straight line separates the arms. */
(function () {
  'use strict';
  var L = window.DLP.lib;

  window.DLP.widgets['spiral-unroll'] = function (root) {
    var P = L.palette(), rev = 2.5, TAU = Math.PI * 2;
    var data = L.spirals({ n: 260, noise: 0.03, revolutions: rev, seed: 5 });
    var pts = data.X.map(function (p, i) {
      var r = Math.hypot(p[0], p[1]), th = Math.atan2(p[1], p[0]);
      var a = th - r * rev * TAU;                     // aligned angle
      var b = ((a + Math.PI / 2) % TAU + TAU) % TAU;  // shift so the two arms sit at π/2 and 3π/2
      return { x: p[0], y: p[1], r: r, b: b, c: data.y[i] };
    });
    var t = 0, playing = false, dir = 1;

    var wrap = L.el('div', { class: 'w-col' });
    root.appendChild(wrap);
    var cv = L.canvas(wrap, 0.62, draw, { cls: 'framed', maxHeight: 440 });
    var status = L.el('div', { class: 'w-msg' });
    var slider = L.slider({ label: 'Representation', min: 0, max: 1, step: 0.001, value: 0, format: function (v) { return v < 0.02 ? 'original (x1, x2)' : v > 0.98 ? 'unrolled (r, α)' : 'morphing…'; }, onInput: function (v) { t = v; playing = false; btn.innerHTML = L.icon('play') + ' Play'; draw(); } });
    var btn = L.button(L.icon('play') + ' Play', function () { playing = !playing; if (playing) { if (t >= 1) dir = -1; if (t <= 0) dir = 1; loop.start(); } btn.innerHTML = playing ? L.icon('pause') + ' Pause' : L.icon('play') + ' Play'; }, 'primary');
    wrap.appendChild(L.el('div', { class: 'w-grid2 even', style: 'align-items:center' }, [slider.el, L.el('div', { class: 'w-row', style: 'justify-content:flex-end' }, [btn])]));
    wrap.appendChild(status);
    wrap.appendChild(L.legend([{ color: P.c0, label: 'class 0' }, { color: P.c1, label: 'class 1' }]));

    var loop = L.loop(root, function () {
      if (!playing) { loop.stop(); return; }
      t += dir * 0.006;
      if (t >= 1) { t = 1; playing = false; btn.innerHTML = L.icon('refresh') + ' Play back'; }
      if (t <= 0) { t = 0; playing = false; btn.innerHTML = L.icon('play') + ' Play'; }
      slider.set(t); draw();
    });

    function ease(x) { return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2; }

    function draw() {
      if (!cv) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, h = cv.h, e = ease(t), pad = 34;
      ctx.clearRect(0, 0, w, h);
      // geometry of the two views
      var side = Math.min(w, h) - 2 * pad;
      var ox = w / 2, oy = h / 2;
      var A = function (p) { return [ox + p.x / 1.15 * side / 2, oy - p.y / 1.15 * side / 2]; };
      var bw = w - 2 * pad - 20, bh = h - 2 * pad;
      var B = function (p) { return [pad + 20 + p.r / 1.1 * bw, pad + (1 - p.b / TAU) * bh]; };
      // axes for the unrolled view fade in
      ctx.globalAlpha = e;
      ctx.strokeStyle = P.line2; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(pad + 20, pad); ctx.lineTo(pad + 20, pad + bh); ctx.lineTo(pad + 20 + bw, pad + bh); ctx.stroke();
      ctx.fillStyle = P.ink3; ctx.font = '11px Inter, system-ui, sans-serif';
      ctx.fillText('radius r →', pad + 20 + bw - 60, pad + bh + 16);
      ctx.save(); ctx.translate(pad + 6, pad + bh / 2 + 40); ctx.rotate(-Math.PI / 2); ctx.fillText('aligned angle α →', 0, 0); ctx.restore();
      ctx.globalAlpha = 1;
      // points
      for (var i = 0; i < pts.length; i++) {
        var a = A(pts[i]), b = B(pts[i]);
        var x = a[0] + (b[0] - a[0]) * e, y = a[1] + (b[1] - a[1]) * e;
        ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 7); ctx.fillStyle = pts[i].c ? P.c1 : P.c0; ctx.fill();
      }
      // the one straight line that now separates them
      if (e > 0.85) {
        var k = (e - 0.85) / 0.15, yl = pad + bh / 2;
        ctx.globalAlpha = k; ctx.strokeStyle = P.ink; ctx.lineWidth = 2; ctx.setLineDash([7, 5]);
        ctx.beginPath(); ctx.moveTo(pad + 20, yl); ctx.lineTo(pad + 20 + bw * k, yl); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = P.ink; ctx.font = '600 12px Inter, system-ui, sans-serif';
        ctx.fillText('one straight line is enough', pad + 30, yl - 8);
        ctx.globalAlpha = 1;
      }
      status.className = 'w-msg' + (t > 0.98 ? ' good' : '');
      status.innerHTML = t < 0.02
        ? '<strong>Original space (x1, x2).</strong> Walk outward along either arm and you cross from one class to the other again and again. No single straight line survives that journey.'
        : t > 0.98
          ? '<strong>Unrolled space (r, α).</strong> Each point is now described by its distance from the centre and its angle after removing the twist. Arm A sits in one band and arm B in the other, so a linear model separates them almost perfectly.'
          : 'Every dot is moving from its (x1, x2) position to its (r, α) position. <strong>No point changes class. Only the description changes.</strong>';
    }
    L.onTheme(draw);
    draw();
  };
})();
