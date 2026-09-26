/* Tiny Net — "be the optimiser" on the exact 2-2-1 network of Lesson 1.2.
   Modes: Forward (trace one example), Backward (walk backprop in 5 steps), Update (one gradient step),
   Train (loop it and watch the loss fall). Every number matches the notebook. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var NS = 'http://www.w3.org/2000/svg';
  var X0 = [[0.5, -1.0], [1.5, 0.5], [-1.0, 1.0], [0.0, -0.5]];
  var Y0 = [1, 1, 0, 0];
  function init() { return { W1: [[0.50, -0.20], [0.30, 0.80]], b1: [0.10, -0.15], W2: [0.70, -0.40], b2: 0.20 }; }
  var sig = function (z) { return 1 / (1 + Math.exp(-z)); };
  var f4 = function (v) { return (Math.abs(v) < 5e-5 ? 0 : v).toFixed(4); };
  var f2 = function (v) { return (Math.abs(v) < 5e-3 ? 0 : v).toFixed(2); };
  var sgn = function (v) { return v < 0 ? '(' + f2(v) + ')' : f2(v); };

  function forward(p) {
    var out = { Z1: [], A1: [], Z2: [], A2: [], loss: 0, lossEach: [] };
    X0.forEach(function (x, k) {
      var z1 = [0, 1].map(function (j) { return x[0] * p.W1[0][j] + x[1] * p.W1[1][j] + p.b1[j]; });
      var a1 = z1.map(function (z) { return Math.max(0, z); });
      var z2 = a1[0] * p.W2[0] + a1[1] * p.W2[1] + p.b2, a2 = sig(z2);
      var l = -(Y0[k] * Math.log(Math.max(a2, 1e-12)) + (1 - Y0[k]) * Math.log(Math.max(1 - a2, 1e-12)));
      out.Z1.push(z1); out.A1.push(a1); out.Z2.push(z2); out.A2.push(a2); out.lossEach.push(l); out.loss += l / 4;
    });
    return out;
  }
  function backward(p, f) {
    var N = 4, g = { dZ2: [], dW2: [0, 0], db2: 0, dA1: [], dZ1: [], dW1: [[0, 0], [0, 0]], db1: [0, 0] };
    for (var k = 0; k < N; k++) {
      var d = (f.A2[k] - Y0[k]) / N; g.dZ2.push(d);
      g.dW2[0] += f.A1[k][0] * d; g.dW2[1] += f.A1[k][1] * d; g.db2 += d;
      var dA = [d * p.W2[0], d * p.W2[1]]; g.dA1.push(dA);
      var dZ = [dA[0] * (f.Z1[k][0] > 0 ? 1 : 0), dA[1] * (f.Z1[k][1] > 0 ? 1 : 0)]; g.dZ1.push(dZ);
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) g.dW1[i][j] += X0[k][i] * dZ[j];
      g.db1[0] += dZ[0]; g.db1[1] += dZ[1];
    }
    return g;
  }
  function step(p, g, lr) {
    return {
      W1: p.W1.map(function (r, i) { return r.map(function (w, j) { return w - lr * g.dW1[i][j]; }); }),
      b1: p.b1.map(function (b, j) { return b - lr * g.db1[j]; }),
      W2: p.W2.map(function (w, j) { return w - lr * g.dW2[j]; }),
      b2: p.b2 - lr * g.db2
    };
  }

  window.DLP.widgets['tiny-net'] = function (root, props) {
    var P = L.palette(), p = init(), mode = props.mode || 'forward', ex = 0, bstep = 0, lr = 0.5, lastUpdate = null, history = [];
    var seg = L.segmented({ options: [
      { value: 'forward', label: '1 · Forward' }, { value: 'backward', label: '2 · Backward' },
      { value: 'update', label: '3 · Update' }, { value: 'train', label: '4 · Train' }], value: mode,
      onChange: function (v) { mode = v; render(); } });
    var top = L.el('div', { class: 'w-row', style: 'justify-content:space-between' }, [seg.el]);
    var resetBtn = L.button(L.icon('refresh') + ' Reset to the lesson\'s weights', function () { p = init(); history = []; lastUpdate = null; bstep = 0; render(); });
    top.appendChild(resetBtn);
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 660 300'); svg.setAttribute('class', 'pf-svg'); svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'Two-input, two-hidden, one-output network with live values');
    var controls = L.el('div', { class: 'w-row' });
    var panel = L.el('div', { class: 'w-panel', style: 'font-size:.9rem' });
    root.appendChild(L.el('div', { class: 'w-col' }, [top, svg, controls, panel]));

    function mk(tag, attrs, parent) { var e = document.createElementNS(NS, tag); Object.keys(attrs).forEach(function (k) { e.setAttribute(k, attrs[k]); }); (parent || svg).appendChild(e); return e; }
    function txt(x, y, s, o) {
      o = o || {};
      var t = mk('text', { x: x, y: y, 'text-anchor': o.anchor || 'middle', fill: o.fill || P.ink, 'font-size': o.size || 13, 'font-weight': o.weight || 500, 'font-family': o.mono ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif' }, o.parent);
      t.textContent = s; return t;
    }
    var POS = { x: [[80, 85], [80, 215]], h: [[320, 85], [320, 215]], o: [520, 150], l: [615, 150] };

    function drawNet(f, g, hi) {
      P = L.palette();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      var k = ex, showG = mode === 'backward' || mode === 'update';
      // edges input -> hidden
      for (var i = 0; i < 2; i++) for (var j = 0; j < 2; j++) {
        var a = POS.x[i], b = POS.h[j], w = p.W1[i][j];
        var gradOn = showG && g && (bstep >= 4 || mode === 'update');
        var col = gradOn ? (g.dW1[i][j] > 0 ? P.red : P.c0) : (w >= 0 ? P.c0 : P.c1);
        var width = gradOn ? 1.5 + Math.min(7, Math.abs(g.dW1[i][j]) * 50) : 1 + Math.min(5, Math.abs(w) * 4);
        mk('line', { x1: a[0] + 30, y1: a[1], x2: b[0] - 34, y2: b[1], stroke: col, 'stroke-width': width, opacity: hi && hi.indexOf('W1') < 0 ? 0.25 : 0.85 });
        var tx = a[0] + 30 + (b[0] - a[0] - 64) * (i === j ? 0.5 : 0.3), ty = a[1] + (b[1] - a[1]) * (i === j ? 0.5 : 0.3);
        var label = 'w' + (i + 1) + (j + 1) + '=' + f2(w) + (gradOn ? '  ∂' + f4(g.dW1[i][j]) : '');
        edgeLabel(tx, ty - 8, label, gradOn);
      }
      for (var j2 = 0; j2 < 2; j2++) {
        var h = POS.h[j2], w2 = p.W2[j2], gradOn2 = showG && g && (bstep >= 1 || mode === 'update');
        var col2 = gradOn2 ? (g.dW2[j2] > 0 ? P.red : P.c0) : (w2 >= 0 ? P.c0 : P.c1);
        mk('line', { x1: h[0] + 34, y1: h[1], x2: POS.o[0] - 34, y2: POS.o[1], stroke: col2, 'stroke-width': gradOn2 ? 1.5 + Math.min(7, Math.abs(g.dW2[j2]) * 50) : 1 + Math.min(5, Math.abs(w2) * 4), opacity: hi && hi.indexOf('W2') < 0 ? 0.25 : 0.85 });
        edgeLabel((h[0] + POS.o[0]) / 2, (h[1] + POS.o[1]) / 2 - 10, 'v' + (j2 + 1) + '=' + f2(w2) + (gradOn2 ? '  ∂' + f4(g.dW2[j2]) : ''), gradOn2);
      }
      mk('line', { x1: POS.o[0] + 34, y1: POS.o[1], x2: POS.l[0] - 34, y2: POS.l[1], stroke: P.line2, 'stroke-width': 2 });
      // nodes
      var dead = f ? f.A1[k].map(function (a) { return a === 0; }) : [false, false];
      for (var n = 0; n < 2; n++) node(POS.x[n][0], POS.x[n][1], 'x' + (n + 1), f2(X0[k][n]), P.surface2, P.line2);
      for (var m = 0; m < 2; m++) {
        var hp = POS.h[m];
        node(hp[0], hp[1], 'h' + (m + 1), f ? 'z=' + f2(f.Z1[k][m]) : '', dead[m] ? P.surface2 : (P.dark ? '#16263d' : '#e8f1fc'), dead[m] ? P.line2 : P.c0, f ? 'a=' + f2(f.A1[k][m]) : '', dead[m]);
        txt(hp[0], hp[1] + 50, 'bias ' + f2(p.b1[m]) + (showG && g && (bstep >= 4 || mode === 'update') ? '  ∂' + f4(g.db1[m]) : ''), { size: 11, fill: P.ink3, mono: true });
        if (dead[m] && f) txt(hp[0], hp[1] - 42, 'ReLU off → 0', { size: 11, fill: P.red, weight: 700 });
      }
      node(POS.o[0], POS.o[1], 'ŷ', f ? f4(f.A2[k]) : '', P.dark ? '#2e1c14' : '#fdeee6', P.c1, f ? 'z=' + f2(f.Z2[k]) : '');
      txt(POS.o[0], POS.o[1] + 50, 'bias ' + f2(p.b2) + (showG && g && (bstep >= 1 || mode === 'update') ? '  ∂' + f4(g.db2) : ''), { size: 11, fill: P.ink3, mono: true });
      mk('rect', { x: POS.l[0] - 34, y: POS.l[1] - 30, width: 68, height: 60, rx: 12, fill: P.surface, stroke: P.ink2, 'stroke-width': 1.5 });
      txt(POS.l[0], POS.l[1] - 8, 'loss', { size: 12, fill: P.ink3 });
      txt(POS.l[0], POS.l[1] + 12, f ? f4(f.lossEach[k]) : '', { size: 13, weight: 700, mono: true });
      txt(POS.l[0], POS.l[1] + 48, 'y = ' + Y0[k], { size: 12, fill: P.ink2, weight: 600 });
    }
    function edgeLabel(x, y, s, grad) {
      var t = txt(x, y, s, { size: 10.5, mono: true, fill: grad ? P.ink : P.ink2 });
      try { var bb = t.getBBox(); var r = mk('rect', { x: bb.x - 4, y: bb.y - 1, width: bb.width + 8, height: bb.height + 2, rx: 5, fill: P.surface, opacity: 0.92 }); svg.insertBefore(r, t); } catch (e) {}
    }
    function node(x, y, name, v1, fill, stroke, v2, dead) {
      mk('circle', { cx: x, cy: y, r: 32, fill: fill, stroke: stroke, 'stroke-width': 2, 'stroke-dasharray': dead ? '4 3' : '' });
      txt(x, y - 10, name, { size: 12, fill: P.ink3, weight: 700 });
      txt(x, y + 6, v1, { size: 11.5, mono: true, weight: 600 });
      if (v2) txt(x, y + 20, v2, { size: 11.5, mono: true, weight: 700, fill: dead ? P.red : P.ink });
    }

    function exampleButtons() {
      var s = L.segmented({ label: 'Training example', value: ex, options: X0.map(function (x, k) { return { value: k, label: 'Example ' + (k + 1) + ' (y=' + Y0[k] + ')' }; }), onChange: function (v) { ex = v; render(); } });
      return s.el;
    }

    function render() {
      var f = forward(p), g = backward(p, f);
      controls.innerHTML = ''; panel.innerHTML = '';
      if (mode === 'forward') {
        controls.appendChild(exampleButtons());
        drawNet(f, null);
        var x = X0[ex], z = f.Z1[ex];
        panel.innerHTML =
          '<div class="w-panel-title">' + L.icon('arrow-right') + ' Forward pass for example ' + (ex + 1) + ', x = [' + f2(x[0]) + ', ' + f2(x[1]) + ']</div>' +
          '<ol class="w-note" style="padding-left:1.2em;margin:0;display:grid;gap:4px">' +
          '<li>Hidden 1: z = ' + sgn(x[0]) + '×' + sgn(p.W1[0][0]) + ' + ' + sgn(x[1]) + '×' + sgn(p.W1[1][0]) + ' + ' + sgn(p.b1[0]) + ' = <strong>' + f2(z[0]) + '</strong> → ReLU → <strong>' + f2(f.A1[ex][0]) + '</strong></li>' +
          '<li>Hidden 2: z = ' + sgn(x[0]) + '×' + sgn(p.W1[0][1]) + ' + ' + sgn(x[1]) + '×' + sgn(p.W1[1][1]) + ' + ' + sgn(p.b1[1]) + ' = <strong>' + f2(z[1]) + '</strong> → ReLU → <strong>' + f2(f.A1[ex][1]) + '</strong>' + (f.A1[ex][1] === 0 || f.A1[ex][0] === 0 ? ' <span class="w-tag bad">a negative z is clamped to 0</span>' : '') + '</li>' +
          '<li>Output: z = ' + f2(f.A1[ex][0]) + '×' + sgn(p.W2[0]) + ' + ' + f2(f.A1[ex][1]) + '×' + sgn(p.W2[1]) + ' + ' + sgn(p.b2) + ' = <strong>' + f4(f.Z2[ex]) + '</strong> → sigmoid → ŷ = <strong>' + f4(f.A2[ex]) + '</strong></li>' +
          '<li>Loss for this example (truth y = ' + Y0[ex] + '): −log(' + (Y0[ex] ? 'ŷ' : '1 − ŷ') + ') = <strong>' + f4(f.lossEach[ex]) + '</strong>. Mean loss over all four examples: <strong>' + f4(f.loss) + '</strong></li></ol>';
      } else if (mode === 'backward') {
        var steps = [
          { t: 'Start at the loss: “prediction minus truth”', hi: [], body: 'dZ2 = (ŷ − y) / N for each example:<br><code>' + g.dZ2.map(f4).join('  ') + '</code><br>Positive = the prediction was too high, negative = too low. Example 4 (ŷ=' + f2(f.A2[3]) + ', y=0) produces the largest push.' },
          { t: 'Blame the output weights', hi: ['W2'], body: 'dW2 = A1ᵀ · dZ2. Each output weight is blamed in proportion to how active its hidden neuron was:<br>∂v1 = <strong>' + f4(g.dW2[0]) + '</strong>, ∂v2 = <strong>' + f4(g.dW2[1]) + '</strong>, and the bias sees every example: ∂b2 = <strong>' + f4(g.db2) + '</strong>' },
          { t: 'Send the error back to the hidden neurons', hi: ['W2'], body: 'dA1 = dZ2 · W2ᵀ. The error is shared out <em>in proportion to the connecting weights</em>. A big weight means a big share of the blame.<br><code>' + g.dA1.map(function (r) { return '[' + r.map(f4).join(', ') + ']'; }).join(' ') + '</code>' },
          { t: 'Pass through ReLU: the on/off switch', hi: [], body: 'dZ1 = dA1 × (Z1 > 0). Wherever a neuron was switched off (z ≤ 0), its gradient becomes exactly 0. <strong>No activity, no responsibility.</strong><br><code>' + g.dZ1.map(function (r) { return '[' + r.map(f4).join(', ') + ']'; }).join(' ') + '</code>' },
          { t: 'Blame the first-layer weights', hi: ['W1'], body: 'dW1 = Xᵀ · dZ1 and db1 = column sums of dZ1:<br>∂W1 = <code>[[' + g.dW1[0].map(f4).join(', ') + '], [' + g.dW1[1].map(f4).join(', ') + ']]</code>, ∂b1 = <code>[' + g.db1.map(f4).join(', ') + ']</code><br>Every one of the 9 parameters now has a gradient, and they match the brute-force numbers in Section 6.' }
        ];
        var s = steps[bstep];
        drawNet(f, g, s.hi.length ? s.hi : null);
        controls.appendChild(L.button(L.icon('arrow-left') + ' Back', function () { bstep = Math.max(0, bstep - 1); render(); }));
        controls.appendChild(L.el('span', { class: 'w-tag info', text: 'Step ' + (bstep + 1) + ' of 5' }));
        controls.appendChild(L.button('Next ' + L.icon('arrow-right'), function () { bstep = Math.min(4, bstep + 1); render(); }, 'primary'));
        panel.innerHTML = '<div class="w-panel-title">' + L.icon('refresh') + ' Backward step ' + (bstep + 1) + ': ' + s.t + '</div><p class="w-note">' + s.body + '</p><p class="w-note" style="margin-top:6px;color:var(--ink-3)">Edge colours now show gradients: <span style="color:var(--red);font-weight:700">red</span> = increasing this weight would <em>raise</em> the loss, <span style="color:var(--c0);font-weight:700">blue</span> = would lower it. Thicker = larger gradient.</p>';
      } else if (mode === 'update') {
        drawNet(f, g);
        var sl = L.slider({ label: 'Learning rate η', min: 0.05, max: 8, step: 0.05, value: lr, format: function (v) { return v.toFixed(2); }, onInput: function (v) { lr = v; } });
        controls.appendChild(L.el('div', { style: 'flex:1;min-width:220px' }, [sl.el]));
        controls.appendChild(L.button(L.icon('play') + ' Apply one update', function () {
          var before = f.loss, np = step(p, g, lr), after = forward(np).loss;
          lastUpdate = { before: before, after: after, old: p, g: g, lr: lr, neu: np }; p = np; render();
        }, 'primary'));
        var rows = '';
        if (lastUpdate) {
          var u = lastUpdate, list = [['w11', u.old.W1[0][0], u.g.dW1[0][0], u.neu.W1[0][0]], ['w21', u.old.W1[1][0], u.g.dW1[1][0], u.neu.W1[1][0]], ['w12', u.old.W1[0][1], u.g.dW1[0][1], u.neu.W1[0][1]], ['w22', u.old.W1[1][1], u.g.dW1[1][1], u.neu.W1[1][1]], ['bias h1', u.old.b1[0], u.g.db1[0], u.neu.b1[0]], ['bias h2', u.old.b1[1], u.g.db1[1], u.neu.b1[1]], ['v1', u.old.W2[0], u.g.dW2[0], u.neu.W2[0]], ['v2', u.old.W2[1], u.g.dW2[1], u.neu.W2[1]], ['bias out', u.old.b2, u.g.db2, u.neu.b2]];
          rows = '<div class="table-wrap" style="margin:8px 0 0"><table><thead><tr><th>parameter</th><th>old</th><th>gradient</th><th>− η × gradient</th><th>new</th></tr></thead><tbody>' +
            list.map(function (r) { return '<tr><td>' + r[0] + '</td><td>' + f4(r[1]) + '</td><td>' + f4(r[2]) + '</td><td>' + f4(-u.lr * r[2]) + '</td><td><strong>' + f4(r[3]) + '</strong></td></tr>'; }).join('') + '</tbody></table></div>' +
            '<p class="w-note" style="margin-top:8px">Loss before: <strong>' + f4(u.before) + '</strong> → after: <strong>' + f4(u.after) + '</strong> ' +
            (u.after < u.before ? '<span class="w-tag good">went down by ' + f4(u.before - u.after) + '</span>' : '<span class="w-tag bad">went UP: the step overshot</span>') + '</p>';
        }
        panel.innerHTML = '<div class="w-panel-title">' + L.icon('tune') + ' One update: w ← w − η · ∂L/∂w</div><p class="w-note">Current mean loss: <strong>' + f4(f.loss) + '</strong>. Press the button to move all 9 parameters one step <em>against</em> their gradients. With η = 0.5 you reproduce the lesson (0.5869 → 0.5593). Try η = 8 and see what a too-large step does.</p>' + rows;
      } else {
        drawNet(f, null);
        var slr = L.slider({ label: 'Learning rate η', min: 0.01, max: 8, step: 0.01, value: lr, format: function (v) { return v.toFixed(2); }, onInput: function (v) { lr = v; } });
        controls.appendChild(L.el('div', { style: 'flex:1;min-width:220px' }, [slr.el]));
        controls.appendChild(L.button(L.icon('play') + ' Train 300 epochs', function () {
          history = []; var q = init();
          for (var e = 0; e < 300; e++) { var ff = forward(q); history.push(ff.loss); q = step(q, backward(q, ff), lr); if (!isFinite(ff.loss)) break; }
          p = q; render();
        }, 'primary'));
        var box = L.el('div', { class: 'w-col' });
        panel.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('pulse') + ' The loss curve: forward → backward → update, 300 times' }));
        panel.appendChild(box);
        if (history.length) {
          var acc = f.A2.filter(function (a, k) { return (a > 0.5 ? 1 : 0) === Y0[k]; }).length / 4;
          L.canvas(box, 0.36, function (ctx, w, h) { L.lineChart(ctx, w, h, [{ color: P.c0, values: history }], { xlabel: 'epoch', ymin: 0 }); });
          box.appendChild(L.el('p', { class: 'w-note', html: 'Start loss <strong>' + f4(history[0]) + '</strong> → final <strong>' + f4(history[history.length - 1]) + '</strong>, accuracy on the 4 examples <strong>' + acc * 100 + '%</strong>. ' +
            (lr < 0.05 ? 'Crawling: the loss falls, but so slowly you can\'t tell learning from stuck.' : lr > 4 ? 'Unstable: steps overshoot the valley. Look for oscillation or a plateau at a bad value.' : 'Steep at first, where gradients are large, then flattening as the slopes shrink.') }));
        } else box.appendChild(L.el('p', { class: 'w-note', text: 'Pick a learning rate and press Train. Training restarts from the lesson\'s initial weights each time.' }));
      }
    }
    L.onTheme(render);
    render();
  };
})();
