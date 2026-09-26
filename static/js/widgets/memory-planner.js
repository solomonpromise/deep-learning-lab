/* Memory Planner — the bytes a run needs before it starts, from the parameter count, the number format, the
   optimizer, the trainable share and the batch.
   Model states use the lesson's arithmetic (bytes per number × copies). Mixed precision is counted the standard
   way (Rajbhandari et al., ZeRO, 2020): 16-bit weights and gradients, plus an fp32 master copy and fp32 optimizer
   averages, 16 bytes per trained weight with AdamW. "Pure 16-bit" puts everything in 2 bytes, as the lesson's
   "fp16 weights" row does. Frozen weights (trainable share below 100%) need no gradient and no optimizer state.
   Activations: for the two MLPs, the lesson's forward-hook count per row (every layer output, in fp32); for the
   Transformers, the GPT-style estimate of Korthikanti et al. (2022): s·h·(34 + 5·a·s/h) bytes per layer and
   sequence in 16-bit (doubled for fp32), or about 2·s·h per layer plus one full layer with full gradient
   checkpointing. Inference keeps no activations for a backward pass, so none are counted. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var GB = Math.pow(1024, 3), MB = Math.pow(1024, 2);
  var MODELS = {
    day3: { label: 'Day 3 net', n: 5377, row: 772, kind: 'mlp' },
    wide: { label: 'wide net', n: 1102849, row: 16388, kind: 'mlp' },
    bert: { label: 'BERT-base', n: 110e6, h: 768, layers: 12, heads: 12, kind: 'tf', smax: 9 },
    b7: { label: '7B', n: 7e9, h: 4096, layers: 32, heads: 32, kind: 'tf', smax: 12 }
  };
  var JOBS = { inference: 0, sgd: 0, momentum: 1, adamw: 2 };
  // bytes per number: w = weights being trained, g = gradients, m = fp32 master copy, s = each optimizer copy,
  // f = frozen (or inference) weights, a = activation bytes relative to fp32
  var PREC = {
    fp32: { w: 4, g: 4, m: 0, s: 4, f: 4, a: 1 },
    mixed: { w: 2, g: 2, m: 4, s: 4, f: 2, a: 0.5 },
    bf16: { w: 2, g: 2, m: 0, s: 2, f: 2, a: 0.5 },
    q4: { w: 2, g: 2, m: 4, s: 4, f: 0.5, a: 0.5 }
  };
  var GPUS = [[15, 'free T4'], [24, '24 GB'], [80, '80 GB']];

  window.DLP.widgets['memory-planner'] = function (root, props) {
    props = props || {};
    var st = { model: props.model || 'b7', job: props.job || 'adamw', prec: props.precision || 'fp32', share: 0, batch: 3, seq: 9, ckpt: 'stored' };
    var P = L.palette();
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-grid2' }, [left, right]));
    var cv = L.canvas(left, 0.3, draw, { cls: 'framed' });
    var legend = L.el('div'); left.appendChild(legend);
    var perWeight = L.el('div', { class: 'mp-line' }); left.appendChild(perWeight);
    var stats = L.el('div', { class: 'w-stats' }); left.appendChild(stats);
    var msg = L.el('div', { class: 'w-msg' }); left.appendChild(msg);

    function field(label, ctl) { return L.el('div', { class: 'mp-field' }, [L.el('span', { class: 'w-label', text: label }), ctl.el]); }
    var sModel = L.segmented({ value: st.model, options: Object.keys(MODELS).map(function (k) { return { value: k, label: MODELS[k].label }; }), onChange: function (v) { st.model = v; sync(); } });
    var sJob = L.segmented({ value: st.job, options: [{ value: 'inference', label: 'inference' }, { value: 'sgd', label: 'SGD' }, { value: 'momentum', label: 'momentum' }, { value: 'adamw', label: 'AdamW' }], onChange: function (v) { st.job = v; sync(); } });
    var sPrec = L.segmented({ value: st.prec, options: [{ value: 'fp32', label: 'fp32' }, { value: 'mixed', label: 'mixed' }, { value: 'bf16', label: 'pure 16-bit' }, { value: 'q4', label: '4-bit frozen' }], onChange: function (v) { st.prec = v; sync(); } });
    var sShare = L.slider({ label: 'share of weights trained', min: -3, max: 0, step: 0.1, value: st.share, format: function (v) { return fmtShare(Math.pow(10, v)); }, onInput: function (v) { st.share = v; draw(); } });
    var sBatch = L.slider({ label: 'batch size', min: 0, max: 14, step: 1, value: st.batch, format: function (v) { return Math.pow(2, v).toLocaleString('en-US'); }, onInput: function (v) { st.batch = v; draw(); } });
    var sSeq = L.slider({ label: 'sequence length (tokens)', min: 7, max: 12, step: 1, value: st.seq, format: function (v) { return Math.pow(2, v).toLocaleString('en-US'); }, onInput: function (v) { st.seq = v; draw(); } });
    var sCkpt = L.segmented({ value: st.ckpt, options: [{ value: 'stored', label: 'activations stored' }, { value: 'ckpt', label: 'gradient checkpointing' }], onChange: function (v) { st.ckpt = v; draw(); } });
    var seqWrap = L.el('div', { class: 'w-col' }, [sSeq.el, sCkpt.el]);
    [field('Model', sModel), field('Job', sJob), field('Number format', sPrec)].forEach(function (f) { right.appendChild(f); });
    right.appendChild(sShare.el); right.appendChild(sBatch.el); right.appendChild(seqWrap);

    function fmtShare(s) { return s >= 0.995 ? '100% (full training)' : (s * 100 < 1 ? (s * 100).toFixed(1) : (s * 100).toFixed(0)) + '%'; }
    function fmtBytes(b) {
      if (b < 1024) return Math.round(b) + ' B';
      if (b < MB) return (b / 1024).toFixed(1) + ' KB';
      if (b < GB) return (b / MB).toFixed(b < 10 * MB ? 2 : 1) + ' MB';
      return (b / GB).toFixed(b < 10 * GB ? 2 : 1) + ' GB';
    }
    function num(x) { return (Math.round(x * 10) / 10).toString(); }
    function sync() {
      var m = MODELS[st.model];
      var bmax = m.kind === 'tf' ? 7 : 14;
      sBatch.input.max = bmax; if (st.batch > bmax) { st.batch = bmax; } sBatch.set(st.batch);
      if (m.kind === 'tf') { sSeq.input.max = m.smax; if (st.seq > m.smax) st.seq = m.smax; sSeq.set(st.seq); }
      seqWrap.style.display = m.kind === 'tf' && st.job !== 'inference' ? '' : 'none';
      sShare.el.style.display = st.job === 'inference' ? 'none' : '';
      sBatch.el.style.display = st.job === 'inference' ? 'none' : '';
      draw();
    }
    function compute() {
      var m = MODELS[st.model], p = PREC[st.prec], inf = st.job === 'inference';
      var t = inf ? 0 : Math.pow(10, st.share); if (t > 0.995) t = 1;
      var trained = m.n * t, frozen = m.n - trained, B = Math.pow(2, st.batch), s = Math.pow(2, st.seq);
      var r = { weights: frozen * p.f + trained * p.w, master: trained * p.m, grads: trained * p.g, state: trained * JOBS[st.job] * p.s, acts: 0 };
      if (!inf) {
        if (m.kind === 'mlp') r.acts = m.row * B * p.a;
        else {
          var full = s * m.h * (34 + 5 * m.heads * s / m.h);            // 16-bit bytes, one layer, one sequence
          var perSeq = st.ckpt === 'ckpt' ? 2 * s * m.h * m.layers + full : full * m.layers;
          r.acts = perSeq * B * (p.a * 2);
        }
      }
      r.states = r.weights + r.master + r.grads + r.state;
      r.total = r.states + r.acts; r.t = t; r.B = B; r.s = s; r.inf = inf;
      return r;
    }
    function draw() {
      if (!cv) return;
      P = L.palette();
      var r = compute(), ctx = cv.ctx, w = cv.w, h = cv.h;
      var segs = [
        { k: 'weights', label: 'weights', c: P.c0 }, { k: 'master', label: 'fp32 master copy', c: P.c2 },
        { k: 'grads', label: 'gradients', c: P.c1 }, { k: 'state', label: 'optimizer state', c: P.c3 },
        { k: 'acts', label: 'activations', c: P.c4 }
      ];
      var tg = r.total / GB, maxG = tg * 1.12;
      if (tg > 1.5 && tg < 80) { for (var i = 0; i < GPUS.length; i++) if (GPUS[i][0] > tg) { maxG = Math.max(maxG, GPUS[i][0] * 1.08); break; } }
      var x0 = 12, x1 = w - 12, y = Math.round(h * 0.42), bh = Math.round(h * 0.28);
      var X = function (g) { return x0 + (x1 - x0) * g / maxG; };
      ctx.clearRect(0, 0, w, h);
      ctx.fillStyle = P.surface2; ctx.fillRect(x0, y, x1 - x0, bh);
      var acc = 0;
      segs.forEach(function (sg) {
        var v = r[sg.k] / GB; if (v <= 0) return;
        ctx.fillStyle = sg.c; ctx.fillRect(X(acc), y, Math.max(1, X(acc + v) - X(acc)), bh); acc += v;
      });
      ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textBaseline = 'alphabetic';
      var lastX = -1e9, raised = false;
      GPUS.forEach(function (g) {
        if (g[0] >= maxG) return;
        var gx = X(g[0]), up = gx - lastX < 58 && !raised;     // stagger labels that would overlap
        raised = up; lastX = gx;
        ctx.strokeStyle = P.red; ctx.lineWidth = 1.6; ctx.setLineDash([5, 4]);
        ctx.beginPath(); ctx.moveTo(gx, y - (up ? 30 : 16)); ctx.lineTo(gx, y + bh + 6); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = P.red; ctx.textAlign = gx > w - 60 ? 'right' : gx < 40 ? 'left' : 'center';
        ctx.fillText(g[1], gx < 40 ? gx - 4 : gx, y - (up ? 34 : 20));
      });
      ctx.fillStyle = P.ink; ctx.font = '700 13px Inter, system-ui, sans-serif';
      var endX = X(acc), label = fmtBytes(r.total);
      ctx.textAlign = endX > w * 0.75 ? 'right' : 'left';
      ctx.fillText(label, endX > w * 0.75 ? Math.min(endX, x1) : endX + 6, y + bh + 22);
      ctx.fillStyle = P.ink3; ctx.font = '600 11px Inter, system-ui, sans-serif'; ctx.textAlign = 'left';
      ctx.fillText('0', x0, y + bh + 22 > h - 4 ? h - 4 : y + bh + 22);
      legend.innerHTML = '';
      legend.appendChild(L.legend(segs.filter(function (sg) { return r[sg.k] > 0; }).map(function (sg) { return { color: sg.c, label: sg.label + ' ' + fmtBytes(r[sg.k]) }; })));
      var p = PREC[st.prec], parts = [];
      if (r.t > 0) {
        parts.push('weights ' + num(p.w)); if (p.m) parts.push('master ' + p.m); parts.push('gradients ' + p.g);
        if (JOBS[st.job]) parts.push((JOBS[st.job] === 2 ? 'two averages ' : 'momentum ') + JOBS[st.job] * p.s);
      }
      var perTrained = p.w + p.m + p.g + JOBS[st.job] * p.s;
      perWeight.innerHTML = r.inf ? 'Per weight: <strong>' + num(p.f) + ' bytes</strong> (weights only)' :
        'Per trained weight: ' + parts.join(' + ') + ' = <strong>' + num(perTrained) + ' bytes</strong>' + (r.t < 1 ? ' · per frozen weight: <strong>' + num(p.f) + '</strong>' : '');
      stats.innerHTML = '';
      var fits = r.total / GB < 1 ? 'any machine' : r.total / GB <= 15 ? 'free T4' : r.total / GB <= 24 ? '24 GB GPU' : r.total / GB <= 80 ? '80 GB GPU' : 'no single GPU';
      [['Total', fmtBytes(r.total), 'hero'], ['Model states', fmtBytes(r.states)], ['Activations', r.inf ? 'freed' : fmtBytes(r.acts)], ['Fits on', fits, r.total / GB > 80 ? 'bad' : r.total / GB <= 24 ? 'good' : '']]
        .forEach(function (x) { stats.appendChild(L.stat(x[0], x[1], x[2]).el); });
      msg.className = 'w-msg' + (st.prec === 'bf16' && !r.inf ? ' warn' : '');
      msg.innerHTML = message(r);
    }
    function message(r) {
      var m = MODELS[st.model];
      if (r.inf) return 'No backward pass, so no gradients and no optimizer state. Under <code>torch.no_grad()</code> each layer\'s output is freed once the next layer has used it, so only the weights count here. (A language model generating text also keeps a KV cache, which grows with the context: Day 9.)';
      if (st.prec === 'bf16') return '<strong>Pure 16-bit is the lesson\'s "fp16 weights" row.</strong> It halves the model states, but a bf16 weight near 1.0 cannot move by less than about 0.004 (Section 3), so small AdamW steps round away. Real runs keep an fp32 master copy: switch to <em>mixed</em> to see what that costs.';
      if (st.prec === 'mixed' && r.t === 1 && st.job === 'adamw') return '<strong>Mixed precision costs the same 16 bytes per trained weight as fp32.</strong> What it halves is the activations, and on the right hardware it is faster. PyTorch\'s <code>autocast</code> reaches the same total a different way: fp32 weights and gradients, plus 16-bit working copies made during each step.';
      if (st.prec === 'q4' && r.t === 1) return 'With every weight trained, nothing is frozen, so there is nothing to quantise: this is plain mixed precision. Lower the share of weights trained to see QLoRA.';
      if (r.t < 1) return 'Frozen weights need no gradient and no optimizer state, so the total is now mostly the frozen model itself (' + fmtBytes(m.n * (1 - r.t) * PREC[st.prec].f) + '). Shrinking the adapters further barely helps; storing the frozen weights in fewer bits does' + (st.prec === 'q4' ? ', as here.' : ': try <em>4-bit frozen</em>.');
      if (r.states > 80 * GB) return 'The model states alone need <strong>' + fmtBytes(r.states) + '</strong>, more than an 80 GB card holds, so no batch size can make this fit. Switching to <em>mixed</em> will not help either; freezing most of the weights, or sharding the states across GPUs, will.';
      if (m.kind === 'tf' && r.acts > r.states) return 'Here the <strong>activations</strong> outweigh the model states. Halve the batch, shorten the sequences, or turn on gradient checkpointing, and watch which term moves. Attention adds a term that grows with the <em>square</em> of the sequence length.';
      if (m.kind === 'mlp') return 'Model states are fixed by the architecture; activations are ' + fmtBytes(m.row * PREC[st.prec].a) + ' per row, so they grow in a straight line with the batch. Slide the batch to 16,384 on the wide net to reproduce the lesson\'s "61 times the weights".';
      return 'Weights, gradients and optimizer state are fixed by the model and the optimizer; only the activations depend on the batch.';
    }
    L.onTheme(draw);
    sync();
  };
})();
