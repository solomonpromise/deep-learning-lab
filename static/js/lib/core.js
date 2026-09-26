/* Shared toolkit for the interactive widgets:
   seeded RNG, datasets, a tiny neural network with Adam, UI controls and canvas helpers. */
(function () {
  'use strict';
  var DLP = (window.DLP = window.DLP || {});
  DLP.widgets = DLP.widgets || {};
  DLP.data = DLP.data || {};
  var L = (DLP.lib = DLP.lib || {});

  /* ------------------------------------------------------------ random */
  L.rng = function (seed) {
    var a = (seed >>> 0) || 1;
    var r = function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
    r.normal = function () { var u = 1 - r(), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    return r;
  };

  /* Two interleaved spirals — the same generator as Lesson 1.1. */
  L.spirals = function (opts) {
    var n = opts.n || 500, noise = opts.noise == null ? 0.04 : opts.noise, rev = opts.revolutions || 2.5;
    var cx = opts.cx || 0, cy = opts.cy || 0, r = L.rng(opts.seed || 42), X = [], y = [];
    for (var c = 0; c < 2; c++) {
      for (var i = 0; i < n; i++) {
        var t = Math.sqrt(r()) * rev * 2 * Math.PI, rad = t / (rev * 2 * Math.PI), th = t + c * Math.PI;
        X.push([rad * Math.cos(th) + noise * r.normal() + cx, rad * Math.sin(th) + noise * r.normal() + cy]);
        y.push(c);
      }
    }
    // shuffle
    for (var k = y.length - 1; k > 0; k--) {
      var j = Math.floor(r() * (k + 1)), tx = X[k], ty = y[k];
      X[k] = X[j]; y[k] = y[j]; X[j] = tx; y[j] = ty;
    }
    return { X: X, y: y };
  };

  L.split = function (data, testFrac, seed) {
    var n = data.y.length, idx = [], r = L.rng(seed || 7);
    for (var i = 0; i < n; i++) idx.push(i);
    for (var k = n - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)); var t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
    var nt = Math.round(n * testFrac), te = idx.slice(0, nt), tr = idx.slice(nt);
    var pick = function (ids) { return { X: ids.map(function (i) { return data.X[i]; }), y: ids.map(function (i) { return data.y[i]; }) }; };
    return { train: pick(tr), test: pick(te) };
  };

  /* ------------------------------------------------------------ tiny MLP (binary output) */
  // sizes e.g. [2, 16, 16, 1]; activation 'relu' | 'tanh' | 'linear'
  function MLP(sizes, opts) {
    opts = opts || {};
    this.sizes = sizes; this.act = opts.activation || 'relu';
    this.lr = opts.lr || 0.01; this.t = 0;
    var r = L.rng(opts.seed || 1);
    this.W = []; this.b = []; this.mW = []; this.vW = []; this.mb = []; this.vb = [];
    for (var l = 0; l < sizes.length - 1; l++) {
      var fi = sizes[l], fo = sizes[l + 1], std = this.act === 'relu' ? Math.sqrt(2 / fi) : Math.sqrt(1 / fi);
      var W = new Float64Array(fi * fo);
      for (var i = 0; i < W.length; i++) W[i] = r.normal() * std;
      this.W.push(W); this.b.push(new Float64Array(fo));
      this.mW.push(new Float64Array(fi * fo)); this.vW.push(new Float64Array(fi * fo));
      this.mb.push(new Float64Array(fo)); this.vb.push(new Float64Array(fo));
    }
  }
  MLP.prototype.nParams = function () {
    var s = 0; for (var l = 0; l < this.W.length; l++) s += this.W[l].length + this.b[l].length; return s;
  };
  // Preallocated buffers: activations a[l], pre-activations z[l], deltas d[l], gradient accumulators.
  MLP.prototype._buffers = function () {
    if (this.a) return;
    var S = this.sizes; this.a = []; this.z = []; this.d = []; this.gW = []; this.gb = [];
    this.code = this.act === 'relu' ? 0 : this.act === 'tanh' ? 1 : 2;
    for (var l = 0; l < S.length; l++) { this.a.push(new Float64Array(S[l])); this.z.push(new Float64Array(S[l])); this.d.push(new Float64Array(S[l])); }
    for (var k = 0; k < this.W.length; k++) { this.gW.push(new Float64Array(this.W[k].length)); this.gb.push(new Float64Array(this.b[k].length)); }
  };
  // Forward one example. Returns {acts, zs}: SHARED buffers, copy them if you need to keep them.
  MLP.prototype.forward = function (x) {
    this._buffers();
    var S = this.sizes, nl = this.W.length, a0 = this.a[0], code = this.code;
    for (var i = 0; i < S[0]; i++) a0[i] = x[i];
    for (var l = 0; l < nl; l++) {
      var fi = S[l], fo = S[l + 1], W = this.W[l], b = this.b[l], a = this.a[l], z = this.z[l + 1], out = this.a[l + 1], last = l === nl - 1;
      for (var j = 0; j < fo; j++) z[j] = b[j];
      for (var i2 = 0; i2 < fi; i2++) {
        var ai = a[i2]; if (ai === 0) continue;
        var row = i2 * fo;
        for (var j2 = 0; j2 < fo; j2++) z[j2] += ai * W[row + j2];
      }
      if (last || code === 2) for (var j3 = 0; j3 < fo; j3++) out[j3] = z[j3];
      else if (code === 0) for (var j4 = 0; j4 < fo; j4++) out[j4] = z[j4] > 0 ? z[j4] : 0;
      else for (var j5 = 0; j5 < fo; j5++) out[j5] = Math.tanh(z[j5]);
    }
    return { acts: this.a, zs: this.z };
  };
  MLP.prototype.predictProba = function (x) {
    this.forward(x); var z = this.a[this.a.length - 1][0];
    return 1 / (1 + Math.exp(-z));
  };
  // Accumulate gradients for examples X[idx[from..to)], then take one Adam step; returns mean BCE loss.
  MLP.prototype._batch = function (X, y, idx, from, to) {
    this._buffers();
    var S = this.sizes, nl = this.W.length, code = this.code, loss = 0, n = to - from, l, i, j;
    for (l = 0; l < nl; l++) { this.gW[l].fill(0); this.gb[l].fill(0); }
    for (var k = from; k < to; k++) {
      var id = idx[k];
      this.forward(X[id]);
      var logit = this.a[nl][0], p = 1 / (1 + Math.exp(-logit)), t = y[id];
      loss += -(t * Math.log(p + 1e-7) + (1 - t) * Math.log(1 - p + 1e-7));
      this.d[nl][0] = p - t;
      for (l = nl - 1; l >= 0; l--) {
        var fi = S[l], fo = S[l + 1], a = this.a[l], W = this.W[l], gW = this.gW[l], gb = this.gb[l], dl = this.d[l + 1];
        for (j = 0; j < fo; j++) gb[j] += dl[j];
        for (i = 0; i < fi; i++) {
          var ai = a[i]; if (ai === 0) continue;
          var row = i * fo;
          for (j = 0; j < fo; j++) gW[row + j] += ai * dl[j];
        }
        if (l > 0) {
          var prev = this.d[l], zp = this.z[l], ap = this.a[l];
          for (i = 0; i < fi; i++) {
            var sum = 0, row2 = i * fo;
            for (j = 0; j < fo; j++) sum += W[row2 + j] * dl[j];
            prev[i] = sum * (code === 0 ? (zp[i] > 0 ? 1 : 0) : code === 1 ? 1 - ap[i] * ap[i] : 1);
          }
        }
      }
    }
    this._adam(this.gW, this.gb, n);
    return loss / n;
  };
  // Backwards-compatible: train on arrays X, y as a single batch.
  MLP.prototype.trainBatch = function (X, y) {
    var idx = new Int32Array(X.length); for (var i = 0; i < idx.length; i++) idx[i] = i;
    return this._batch(X, y, idx, 0, X.length);
  };
  MLP.prototype._adam = function (gW, gb, n) {
    var b1 = 0.9, b2 = 0.999, e = 1e-8; this.t++;
    var c1 = 1 - Math.pow(b1, this.t), c2 = 1 - Math.pow(b2, this.t), lr = this.lr;
    for (var l = 0; l < this.W.length; l++) {
      for (var s = 0; s < 2; s++) {
        var P = s ? this.b[l] : this.W[l], G = s ? gb[l] : gW[l], M = s ? this.mb[l] : this.mW[l], V = s ? this.vb[l] : this.vW[l];
        for (var i = 0; i < P.length; i++) {
          var g = G[i] / n;
          M[i] = b1 * M[i] + (1 - b1) * g; V[i] = b2 * V[i] + (1 - b2) * g * g;
          P[i] -= lr * (M[i] / c1) / (Math.sqrt(V[i] / c2) + e);
        }
      }
    }
  };
  MLP.prototype.epoch = function (X, y, batch, rnd) {
    var n = X.length;
    if (!this._idx || this._idx.length !== n) { this._idx = new Int32Array(n); for (var i = 0; i < n; i++) this._idx[i] = i; }
    var idx = this._idx;
    for (var k = n - 1; k > 0; k--) { var j = Math.floor(rnd() * (k + 1)); var t = idx[k]; idx[k] = idx[j]; idx[j] = t; }
    var tot = 0, nb = 0;
    for (var s = 0; s < n; s += batch) { tot += this._batch(X, y, idx, s, Math.min(n, s + batch)); nb++; }
    return tot / nb;
  };
  L.MLP = MLP;

  L.accuracy = function (model, X, y, feat) {
    var ok = 0;
    for (var i = 0; i < X.length; i++) { var p = model.predictProba(feat ? feat(X[i]) : X[i]); if ((p > 0.5 ? 1 : 0) === y[i]) ok++; }
    return X.length ? ok / X.length : 0;
  };

  /* ------------------------------------------------------------ DOM helpers */
  L.el = function (tag, attrs, kids) {
    var e = document.createElement(tag);
    if (attrs) Object.keys(attrs).forEach(function (k) {
      if (k === 'class') e.className = attrs[k];
      else if (k === 'html') e.innerHTML = attrs[k];
      else if (k === 'text') e.textContent = attrs[k];
      else if (k.slice(0, 2) === 'on') e.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] !== null && attrs[k] !== undefined && attrs[k] !== false) e.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (c) { if (c != null) e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  };
  L.icon = function (name) { return '<svg class="ic"><use href="#i-' + name + '"/></svg>'; };

  // slider: returns {el, input, get, set}
  L.slider = function (o) {
    var out = L.el('output', { class: 'w-val' });
    var input = L.el('input', { type: 'range', min: o.min, max: o.max, step: o.step || 1, value: o.value, 'aria-label': o.label });
    var fmt = o.format || function (v) { return v; };
    function paint() { out.textContent = fmt(+input.value); var p = (input.value - o.min) / (o.max - o.min) * 100; input.style.setProperty('--p', p + '%'); }
    input.addEventListener('input', function () { paint(); if (o.onInput) o.onInput(+input.value); });
    input.addEventListener('change', function () { if (o.onChange) o.onChange(+input.value); });
    paint();
    var wrap = L.el('label', { class: 'w-slider' }, [L.el('span', { class: 'w-label' }, [o.label, out]), input]);
    if (o.hint) wrap.appendChild(L.el('span', { class: 'w-hint', text: o.hint }));
    return { el: wrap, input: input, get: function () { return +input.value; }, set: function (v) { input.value = v; paint(); } };
  };
  // segmented control
  L.segmented = function (o) {
    var wrap = L.el('div', { class: 'w-seg', role: 'radiogroup', 'aria-label': o.label || '' });
    var val = o.value;
    var btns = o.options.map(function (op) {
      var b = L.el('button', { type: 'button', role: 'radio', class: 'w-seg-btn', html: op.label });
      b.addEventListener('click', function () { set(op.value, true); });
      b._v = op.value; wrap.appendChild(b); return b;
    });
    function set(v, fire) {
      val = v;
      btns.forEach(function (b) { var on = b._v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on ? 'true' : 'false'); });
      if (fire && o.onChange) o.onChange(v);
    }
    set(val, false);
    return { el: wrap, get: function () { return val; }, set: set };
  };
  L.button = function (label, onClick, cls) {
    return L.el('button', { type: 'button', class: 'w-btn ' + (cls || ''), html: label, onclick: onClick });
  };
  L.stat = function (label, value, cls) {
    var v = L.el('span', { class: 'w-stat-v', html: value });
    var el = L.el('div', { class: 'w-stat ' + (cls || '') }, [L.el('span', { class: 'w-stat-k', text: label }), v]);
    return { el: el, set: function (x) { v.innerHTML = x; } };
  };

  /* ------------------------------------------------------------ theme colours */
  L.css = function (name) { return getComputedStyle(document.documentElement).getPropertyValue(name).trim(); };
  L.palette = function () {
    return {
      c0: L.css('--c0'), c1: L.css('--c1'), c2: L.css('--aqua'), c3: L.css('--violet'), c4: L.css('--yellow'),
      ink: L.css('--ink'), ink2: L.css('--ink-2'), ink3: L.css('--ink-3'), line: L.css('--line'), line2: L.css('--line-2'),
      surface: L.css('--surface'), surface2: L.css('--surface-2'), bg: L.css('--bg'), green: L.css('--green'), red: L.css('--red'),
      dark: (DLP.theme ? DLP.theme() : 'light') === 'dark'
    };
  };
  L.onTheme = function (cb) { document.addEventListener('dlp:theme', function () { setTimeout(cb, 0); }); };
  L.hexToRgb = function (hex) {
    hex = hex.replace('#', ''); if (hex.length === 3) hex = hex.split('').map(function (c) { return c + c; }).join('');
    var n = parseInt(hex, 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  };
  L.mix = function (a, b, t) { return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t]; };

  /* ------------------------------------------------------------ canvas */
  // Responsive HiDPI canvas. aspect = height / width. Calls draw(ctx, w, h) on resize.
  L.canvas = function (parent, aspect, draw, opts) {
    opts = opts || {};
    var c = L.el('canvas', { class: 'w-canvas' + (opts.cls ? ' ' + opts.cls : '') });
    parent.appendChild(c);
    var ctx = c.getContext('2d'), api = { el: c, ctx: ctx, w: 0, h: 0 };
    function resize() {
      var w = c.parentNode ? c.parentNode.clientWidth : 300;
      if (opts.maxWidth) w = Math.min(w, opts.maxWidth);
      var h = Math.round(w * aspect), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (opts.maxHeight && h > opts.maxHeight) { h = opts.maxHeight; w = Math.round(h / aspect); }
      c.style.width = w + 'px'; c.style.height = h + 'px';
      c.width = Math.round(w * dpr); c.height = Math.round(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      api.w = w; api.h = h;
      if (draw) draw(ctx, w, h);
    }
    api.resize = resize; api.redraw = function () { if (draw) draw(ctx, api.w, api.h); };
    if ('ResizeObserver' in window) { var last = 0; new ResizeObserver(function () { var w = c.parentNode.clientWidth; if (Math.abs(w - last) > 2) { last = w; resize(); } }).observe(parent); }
    else window.addEventListener('resize', resize);
    resize();
    return api;
  };

  // Minimal line chart for loss curves etc. series: [{name, color, values:[...], dashed}]
  L.lineChart = function (ctx, w, h, series, o) {
    o = o || {};
    var P = L.palette(), pad = { l: o.padL || 44, r: 12, t: 14, b: o.xlabel ? 34 : 24 };
    ctx.clearRect(0, 0, w, h);
    var n = 0, lo = Infinity, hi = -Infinity;
    series.forEach(function (s) { n = Math.max(n, s.values.length); s.values.forEach(function (v) { if (isFinite(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
    if (o.ymin != null) lo = o.ymin; if (o.ymax != null) hi = o.ymax;
    if (!isFinite(lo) || !isFinite(hi)) { lo = 0; hi = 1; }
    if (hi - lo < 1e-9) { hi = lo + 1; }
    var span = hi - lo; if (o.ymin == null) lo -= span * 0.05; if (o.ymax == null) hi += span * 0.05;
    var X = function (i) { return pad.l + (w - pad.l - pad.r) * (n > 1 ? i / (n - 1) : 0); };
    var Y = function (v) { return pad.t + (h - pad.t - pad.b) * (1 - (v - lo) / (hi - lo)); };
    ctx.font = '11px Inter, system-ui, sans-serif'; ctx.fillStyle = P.ink3; ctx.strokeStyle = P.line; ctx.lineWidth = 1;
    for (var g = 0; g <= 4; g++) {
      var v = lo + (hi - lo) * g / 4, yy = Math.round(Y(v)) + 0.5;
      ctx.beginPath(); ctx.moveTo(pad.l, yy); ctx.lineTo(w - pad.r, yy); ctx.stroke();
      ctx.textAlign = 'right'; ctx.textBaseline = 'middle'; ctx.fillText(o.fmt ? o.fmt(v) : (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(2)), pad.l - 6, yy);
    }
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    if (o.xlabel) ctx.fillText(o.xlabel, pad.l + (w - pad.l - pad.r) / 2, h - 16);
    ctx.textAlign = 'left'; ctx.fillText('0', pad.l, h - pad.b + 6); ctx.textAlign = 'right'; ctx.fillText(String(n - 1 + (o.xoffset || 0)), w - pad.r, h - pad.b + 6);
    series.forEach(function (s) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.setLineDash(s.dashed ? [5, 4] : []);
      ctx.beginPath(); var started = false;
      s.values.forEach(function (v, i) {
        if (!isFinite(v)) return;
        var yy = Y(Math.max(lo, Math.min(hi, v)));
        if (!started) { ctx.moveTo(X(i), yy); started = true; } else ctx.lineTo(X(i), yy);
      });
      ctx.stroke(); ctx.setLineDash([]);
      var last = s.values.length - 1;
      if (last >= 0 && isFinite(s.values[last])) {
        ctx.fillStyle = s.color; ctx.strokeStyle = P.surface; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(X(last), Y(Math.max(lo, Math.min(hi, s.values[last]))), 4, 0, 7); ctx.fill(); ctx.stroke();
      }
    });
    return { X: X, Y: Y, lo: lo, hi: hi };
  };

  L.legend = function (items) {
    return L.el('div', { class: 'w-legend' }, items.map(function (it) {
      return L.el('span', { class: 'w-legend-item' }, [L.el('i', { style: 'background:' + it.color + (it.dashed ? ';height:2px;border-radius:0' : '') }), it.label]);
    }));
  };

  // load a data script once (works from file:// too)
  var loaded = {};
  L.loadScript = function (path, cb) {
    if (loaded[path] === true) return cb();
    if (loaded[path]) return loaded[path].push(cb);
    loaded[path] = [cb];
    var s = document.createElement('script');
    s.src = (document.body.getAttribute('data-root') || '') + path;
    s.onload = function () { var q = loaded[path]; loaded[path] = true; q.forEach(function (f) { f(); }); };
    document.head.appendChild(s);
  };

  L.fmtPct = function (v) { return (v * 100).toFixed(1) + '%'; };
  L.clamp = function (v, a, b) { return Math.max(a, Math.min(b, v)); };
  L.reducedMotion = function () { return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches; };
  // run a callback while the element is visible, via requestAnimationFrame
  L.loop = function (el, step) {
    var visible = true, running = false, raf = 0;
    function tick(t) { if (!running) return; step(t); raf = requestAnimationFrame(tick); }
    var api = {
      start: function () { if (running) return; running = true; if (visible) raf = requestAnimationFrame(tick); },
      stop: function () { running = false; cancelAnimationFrame(raf); },
      get running() { return running; }
    };
    if ('IntersectionObserver' in window) new IntersectionObserver(function (en) {
      visible = en[0].isIntersecting;
      if (visible && running) { cancelAnimationFrame(raf); raf = requestAnimationFrame(tick); }
      else cancelAnimationFrame(raf);
    }).observe(el);
    return api;
  };
})();
