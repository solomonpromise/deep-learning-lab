/* Tensor Shapes — see shapes instead of imagining them.
   Tabs: Rank (what 0-D … 4-D tensors mean in deep learning), Reshape (same numbers, new shape),
   Broadcast (the stretching rules, and the (N,) vs (N,1) trap), Matmul (inner dims must match).
   props.tabs: optional list to limit the tabs shown, props.start: initial tab. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var css = '.ts-grid{display:inline-grid;gap:3px;padding:6px;border-radius:10px;background:var(--surface-2);border:1px solid var(--line)}' +
    '.ts-cell{width:30px;height:30px;border-radius:6px;display:grid;place-items:center;font:600 11px var(--mono);color:#fff;transition:all .25s}' +
    '.ts-cell.ghost{opacity:.35;outline:1.5px dashed var(--ink-3);outline-offset:-2px}.ts-cell.hl{box-shadow:0 0 0 3px var(--ink)}' +
    '.ts-stage{display:flex;flex-wrap:wrap;align-items:center;gap:14px;justify-content:center;padding:14px;min-height:150px;border-radius:14px;background:var(--surface);border:1px dashed var(--line-2)}' +
    '.ts-op{font:700 20px var(--mono);color:var(--ink-2)}.ts-label{font:600 12px var(--mono);color:var(--ink-2);text-align:center;margin-top:4px}' +
    '.ts-stack{position:relative}.ts-stack .ts-grid{position:absolute}.ts-shape{font:700 13px var(--mono);padding:3px 9px;border-radius:8px;background:var(--accent-soft);color:var(--accent-ink)}' +
    '.ts-err{color:var(--red);font:700 13px var(--mono)}';
  function injectCss() { if (document.getElementById('ts-css')) return; var s = document.createElement('style'); s.id = 'ts-css'; s.textContent = css; document.head.appendChild(s); }

  function color(i, n) { var h = 210 + (i / Math.max(1, n - 1)) * 140; return 'hsl(' + (h % 360) + ' 62% 52%)'; }
  function grid(rows, cols, cellFn) {
    var g = L.el('div', { class: 'ts-grid', style: 'grid-template-columns:repeat(' + cols + ',30px)' });
    for (var r = 0; r < rows; r++) for (var c = 0; c < cols; c++) { var cell = L.el('div', { class: 'ts-cell' }); cellFn(cell, r, c); g.appendChild(cell); }
    return g;
  }
  function labelled(node, text) { return L.el('div', {}, [node, L.el('div', { class: 'ts-label', text: text })]); }

  window.DLP.widgets['tensor-shapes'] = function (root, props) {
    props = props || {};
    injectCss();
    var tabsAll = [{ value: 'rank', label: 'Ranks' }, { value: 'reshape', label: 'Reshape' }, { value: 'broadcast', label: 'Broadcasting' }, { value: 'matmul', label: 'Matrix multiply' }];
    var tabs = props.tabs ? tabsAll.filter(function (t) { return props.tabs.indexOf(t.value) >= 0; }) : tabsAll;
    var mode = props.start || tabs[0].value;
    var seg = L.segmented({ value: mode, options: tabs, onChange: function (v) { mode = v; render(); } });
    var controls = L.el('div', { class: 'w-row' }), stage = L.el('div', { class: 'ts-stage' }), note = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [seg.el, controls, stage, note]));
    var st = { rank: 2, shape: '3,4', a: '3,1', b: '1,4', m: 3, k: 2, k2: 2, n: 3 };

    function render() {
      controls.innerHTML = ''; stage.innerHTML = '';
      if (mode === 'rank') rank(); else if (mode === 'reshape') reshape(); else if (mode === 'broadcast') broadcast(); else matmul();
    }

    function rank() {
      var info = [
        { s: '()', what: 'a scalar: a single loss value', draw: function () { return grid(1, 1, function (c) { c.style.background = color(0, 1); c.textContent = '3.1'; }); } },
        { s: '(4,)', what: 'a vector: one embedding, or one row of features', draw: function () { return grid(1, 4, function (c, r, k) { c.style.background = color(k, 4); }); } },
        { s: '(3, 4)', what: 'a matrix: a batch of 3 rows × 4 features: (batch, features)', draw: function () { return grid(3, 4, function (c, r, k) { c.style.background = color(r * 4 + k, 12); }); } },
        { s: '(2, 3, 4)', what: 'a 3-tensor: 2 sequences × 3 tokens × 4 features: (batch, tokens, features)', draw: function () { return stack(2, 3, 4); } },
        { s: '(2, 3, 3, 3)', what: 'a 4-tensor: 2 images × 3 colour channels × 3×3 pixels: (batch, channels, height, width)', draw: function () { var w = L.el('div', { class: 'w-row', style: 'gap:28px' }); for (var i = 0; i < 2; i++) w.appendChild(labelled(stack(3, 3, 3, i), 'image ' + (i + 1))); return w; } }
      ];
      controls.appendChild(L.segmented({ value: st.rank, options: [0, 1, 2, 3, 4].map(function (r) { return { value: r, label: 'rank ' + r }; }), onChange: function (v) { st.rank = v; render(); } }).el);
      var it = info[st.rank];
      stage.appendChild(it.draw());
      stage.appendChild(L.el('span', { class: 'ts-shape', text: 'shape ' + it.s }));
      note.innerHTML = '<strong>Rank ' + st.rank + '</strong> means ' + st.rank + ' ax' + (st.rank === 1 ? 'is' : 'es') + ', so the shape has ' + st.rank + ' number' + (st.rank === 1 ? '' : 's') + '. In deep learning this is typically ' + it.what + '. Almost every shape error comes from confusing two of these, or losing track of which axis is the batch.';
    }
    function stack(depth, rows, cols, seed) {
      var box = L.el('div', { class: 'ts-stack', style: 'width:' + (cols * 33 + 12 + (depth - 1) * 14) + 'px;height:' + (rows * 33 + 12 + (depth - 1) * 14) + 'px' });
      for (var d = depth - 1; d >= 0; d--) {
        var g = grid(rows, cols, function (c, r, k) { c.style.background = color(d * rows * cols + r * cols + k, depth * rows * cols); c.style.width = c.style.height = '30px'; });
        g.style.left = (d * 14) + 'px'; g.style.top = ((depth - 1 - d) * 14) + 'px'; g.style.opacity = d === 0 ? 1 : 0.85;
        box.appendChild(g);
      }
      return box;
    }

    function reshape() {
      var shapes = ['12', '3,4', '4,3', '2,6', '6,2', '12,1', '1,12', '2,2,3'];
      controls.appendChild(L.segmented({ value: st.shape, options: shapes.map(function (s) { return { value: s, label: '(' + s + (s.indexOf(',') < 0 ? ',' : '') + ')' }; }), onChange: function (v) { st.shape = v; render(); } }).el);
      var dims = st.shape.split(',').map(Number);
      var src = grid(1, 12, function (c, r, k) { c.style.background = color(k, 12); c.textContent = k; });
      src.style.gridTemplateColumns = 'repeat(12,30px)';
      stage.appendChild(labelled(src, 'torch.arange(12)  shape (12,)'));
      stage.appendChild(L.el('span', { class: 'ts-op', text: '→' }));
      var out;
      if (dims.length === 3) {
        out = L.el('div', { class: 'w-row', style: 'gap:10px' });
        for (var d = 0; d < dims[0]; d++) out.appendChild(grid(dims[1], dims[2], (function (dd) { return function (c, r, k) { var i = dd * dims[1] * dims[2] + r * dims[2] + k; c.style.background = color(i, 12); c.textContent = i; }; })(d)));
      } else {
        var rows = dims.length === 1 ? 1 : dims[0], cols = dims.length === 1 ? dims[0] : dims[1];
        out = grid(rows, cols, function (c, r, k) { var i = r * cols + k; c.style.background = color(i, 12); c.textContent = i; });
      }
      stage.appendChild(labelled(out, '.reshape(' + st.shape + ')  shape (' + st.shape + (dims.length === 1 ? ',' : '') + ')'));
      note.innerHTML = 'Reshape never moves or changes a number: it re-reads the <strong>same 12 values in the same order</strong> (row by row) into a new shape. The product of the dimensions must stay 12, which is why <code>reshape(3, -1)</code> can infer the 4. ' +
        (st.shape === '12,1' ? '<strong>(12, 1)</strong> is what <code>unsqueeze(1)</code> gives you: the column shape a one-output network produces.' : st.shape === '2,2,3' ? 'A 3-D reshape is just more levels of the same row-by-row reading.' : '');
    }

    function parse(s) { return s.split(',').map(function (x) { return +x; }); }
    function bshape(a, b) {
      var n = Math.max(a.length, b.length), out = [];
      for (var i = 0; i < n; i++) {
        var x = a[a.length - n + i] || 1, y = b[b.length - n + i] || 1;
        if (i < n - a.length) x = 1; if (i < n - b.length) y = 1;
        if (x !== y && x !== 1 && y !== 1) return null;
        out.push(Math.max(x, y));
      }
      return out;
    }
    function broadcast() {
      var opts = ['3,1', '1,4', '3,4', '4', '3', '1', '4,1'];
      var sa = L.segmented({ value: st.a, options: opts.map(function (s) { return { value: s, label: 'A (' + s + (s.indexOf(',') < 0 ? ',' : '') + ')' }; }), onChange: function (v) { st.a = v; render(); } });
      var sb = L.segmented({ value: st.b, options: opts.map(function (s) { return { value: s, label: 'B (' + s + (s.indexOf(',') < 0 ? ',' : '') + ')' }; }), onChange: function (v) { st.b = v; render(); } });
      controls.appendChild(L.el('div', { class: 'w-col', style: 'gap:6px' }, [sa.el, sb.el]));
      var a = parse(st.a), b = parse(st.b), out = bshape(a, b);
      function as2(s) { return s.length === 1 ? [1, s[0]] : s; }
      var A2 = as2(a), B2 = as2(b);
      function tensorView(dims, tint, target) {
        var rows = target ? target[0] : dims[0], cols = target ? target[1] : dims[1];
        return grid(rows, cols, function (c, r, k) {
          var real = r < dims[0] && k < dims[1];
          c.style.background = tint;
          if (!real) c.classList.add('ghost');
        });
      }
      var T = out ? as2(out) : null;
      stage.appendChild(labelled(tensorView(A2, 'var(--c0)', T), 'A ' + '(' + st.a + (a.length === 1 ? ',' : '') + ')' + (T ? ' stretched' : '')));
      stage.appendChild(L.el('span', { class: 'ts-op', text: '+' }));
      stage.appendChild(labelled(tensorView(B2, 'var(--c1)', T), 'B ' + '(' + st.b + (b.length === 1 ? ',' : '') + ')' + (T ? ' stretched' : '')));
      stage.appendChild(L.el('span', { class: 'ts-op', text: '=' }));
      if (!out) {
        stage.appendChild(L.el('span', { class: 'ts-err', text: 'RuntimeError: sizes do not match' }));
        note.className = 'w-msg bad';
        note.innerHTML = '<strong>Not broadcastable.</strong> Line the shapes up from the <em>right</em>. Each pair of dimensions must be equal, or one of them must be 1. Here ' + st.a + ' vs ' + st.b + ' has a pair that is neither.';
        return;
      }
      var O2 = as2(out);
      stage.appendChild(labelled(grid(O2[0], O2[1], function (c) { c.style.background = 'var(--violet)'; }), 'result (' + out.join(', ') + (out.length === 1 ? ',' : '') + ')'));
      var trap = (st.a === '4' && st.b === '4,1') || (st.a === '4,1' && st.b === '4') || (st.a === '3' && st.b === '3,1');
      note.className = 'w-msg' + (trap ? ' warn' : '');
      note.innerHTML = 'Line the shapes up from the right; a dimension of size 1 (or a missing one) is <strong>stretched</strong> to match (the dashed ghost cells: no memory is copied). ' +
        (trap ? '<strong>This is the classic silent bug:</strong> predictions shaped (N, 1) combined with labels shaped (N,) broadcast to an (N, N) matrix. No error is raised, and a loss computed on it is quietly wrong. Fix it with <code>unsqueeze(1)</code> or <code>squeeze(1)</code>.' : 'Adding a bias of shape (4,) to activations of shape (3, 4) is exactly this rule: the same bias row is reused for every example.');
    }

    function matmul() {
      var mk = function (label, key, min, max) { return L.slider({ label: label, min: min, max: max, step: 1, value: st[key], onInput: function (v) { st[key] = v; render(); } }).el; };
      controls.appendChild(L.el('div', { class: 'w-grid2 even', style: 'width:100%' }, [
        L.el('div', { class: 'w-col' }, [mk('A rows (batch size)', 'm', 1, 5), mk('A columns (features in)', 'k', 1, 5)]),
        L.el('div', { class: 'w-col' }, [mk('B rows (must equal A\'s columns)', 'k2', 1, 5), mk('B columns (neurons out)', 'n', 1, 5)])
      ]));
      var ok = st.k === st.k2, sel = { r: 0, c: 0 };
      var gA = grid(st.m, st.k, function (c, r) { c.style.background = 'var(--c0)'; c.dataset.r = r; });
      var gB = grid(st.k2, st.n, function (c, r, k) { c.style.background = 'var(--c1)'; c.dataset.c = k; });
      stage.appendChild(labelled(gA, 'A (' + st.m + ', ' + st.k + ')'));
      stage.appendChild(L.el('span', { class: 'ts-op', text: '@' }));
      stage.appendChild(labelled(gB, 'B (' + st.k2 + ', ' + st.n + ')'));
      stage.appendChild(L.el('span', { class: 'ts-op', text: '=' }));
      if (!ok) {
        stage.appendChild(L.el('span', { class: 'ts-err', text: 'mat1 and mat2 shapes cannot be multiplied' }));
        note.className = 'w-msg bad';
        note.innerHTML = '<strong>Inner dimensions differ (' + st.k + ' vs ' + st.k2 + ').</strong> Every output number is a dot product of a <em>row</em> of A with a <em>column</em> of B, so they must have the same length. Fixes: transpose one side (<code>B.T</code>) or check which layer produced the wrong width.';
        return;
      }
      var gC = grid(st.m, st.n, function (c, r, k) {
        c.style.background = 'var(--violet)'; c.style.cursor = 'pointer';
        c.addEventListener('mouseenter', function () { hl(r, k); });
        c.addEventListener('click', function () { hl(r, k); });
      });
      stage.appendChild(labelled(gC, 'result (' + st.m + ', ' + st.n + ')'));
      function hl(r, k) {
        Array.prototype.forEach.call(gA.children, function (c) { c.classList.toggle('hl', +c.dataset.r === r); });
        Array.prototype.forEach.call(gB.children, function (c) { c.classList.toggle('hl', +c.dataset.c === k); });
        Array.prototype.forEach.call(gC.children, function (c, i) { c.classList.toggle('hl', i === r * st.n + k); });
        note.className = 'w-msg good';
        note.innerHTML = 'Result cell (' + r + ', ' + k + ') = row ' + r + ' of A · column ' + k + ' of B, a dot product of length ' + st.k + '. <strong>(' + st.m + ', [' + st.k + ']) @ ([' + st.k2 + '], ' + st.n + ') → (' + st.m + ', ' + st.n + ')</strong>: the inner dimensions meet and vanish; the outer ones survive. In a layer, A is the batch of inputs and B is the weight matrix.';
      }
      hl(0, 0);
    }
    render();
  };
})();
