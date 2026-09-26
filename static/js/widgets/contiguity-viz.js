/* Contiguity — why view() sometimes refuses and reshape() copies.
   The same 12 numbers live in one strip of memory. Walk the tensor in reading order and watch
   which memory cells are visited: in order (contiguous) or jumping around (after .t() / permute). */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['contiguity-viz'] = function (root) {
    var P = L.palette(), mode = 'x', step = -1, timer = null;
    var seg = L.segmented({ value: mode, options: [{ value: 'x', label: 'x = arange(12).reshape(3, 4)' }, { value: 't', label: 'x.t()  (transpose)' }, { value: 'c', label: 'x.t().contiguous()' }], onChange: function (v) { mode = v; step = -1; stop(); render(); } });
    var mem = L.el('div', { style: 'display:grid;grid-template-columns:repeat(12,1fr);gap:4px' });
    var logical = L.el('div', { style: 'display:inline-grid;gap:4px' });
    var info = L.el('div', { class: 'w-msg' });
    var btn = L.button(L.icon('play') + ' Walk in reading order', function () { play(); }, 'primary');
    var stride = L.el('div', { class: 'w-note', style: 'font-family:var(--mono)' });
    root.appendChild(L.el('div', { class: 'w-col' }, [seg.el,
      L.el('div', { class: 'w-panel-title', html: L.icon('database') + ' Memory: one flat strip of 12 slots' }), mem,
      L.el('div', { class: 'w-grid2', style: 'align-items:center' }, [L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-panel-title', html: L.icon('blocks') + ' What the tensor looks like (logical view)' }), logical]), L.el('div', { class: 'w-col' }, [stride, btn])]),
      info]));
    function layout() {
      // returns {rows, cols, memIndex(r,c), memory contents, strides}
      if (mode === 'x') return { rows: 3, cols: 4, at: function (r, c) { return r * 4 + c; }, data: range(12), strides: '(4, 1)', contiguous: true };
      if (mode === 't') return { rows: 4, cols: 3, at: function (r, c) { return c * 4 + r; }, data: range(12), strides: '(1, 4)', contiguous: false };
      var d = []; for (var r = 0; r < 4; r++) for (var c = 0; c < 3; c++) d.push(c * 4 + r);
      return { rows: 4, cols: 3, at: function (r, c) { return r * 3 + c; }, data: d, strides: '(3, 1)', contiguous: true };
    }
    function range(n) { var a = []; for (var i = 0; i < n; i++) a.push(i); return a; }
    function cell(txt, bg, extra) { return L.el('div', { style: 'height:38px;border-radius:8px;display:grid;place-items:center;font:700 13px var(--mono);color:#fff;background:' + bg + ';transition:all .2s;' + (extra || ''), text: String(txt) }); }
    function col(v) { return 'hsl(' + (210 + v * 11) + ' 60% 50%)'; }
    function render() {
      P = L.palette();
      var Lo = layout();
      mem.innerHTML = ''; logical.innerHTML = '';
      logical.style.gridTemplateColumns = 'repeat(' + Lo.cols + ', 44px)';
      var visitOrder = [];
      for (var r = 0; r < Lo.rows; r++) for (var c = 0; c < Lo.cols; c++) visitOrder.push(Lo.at(r, c));
      Lo.data.forEach(function (v, i) {
        var active = step >= 0 && visitOrder[step] === i, visited = step >= 0 && visitOrder.slice(0, step).indexOf(i) >= 0;
        mem.appendChild(cell(v, col(v), (active ? 'box-shadow:0 0 0 3px var(--ink);transform:translateY(-3px);' : '') + (visited ? 'opacity:.45;' : '')));
      });
      for (var r2 = 0; r2 < Lo.rows; r2++) for (var c2 = 0; c2 < Lo.cols; c2++) {
        var k = r2 * Lo.cols + c2, m = Lo.at(r2, c2), v2 = Lo.data[m];
        logical.appendChild(cell(v2, col(v2), (k === step ? 'box-shadow:0 0 0 3px var(--ink);transform:scale(1.08);' : '') + (step >= 0 && k < step ? 'opacity:.45;' : '')));
      }
      var jumps = [];
      for (var q = 1; q < visitOrder.length; q++) jumps.push(visitOrder[q] - visitOrder[q - 1]);
      stride.innerHTML = 'shape = (' + Lo.rows + ', ' + Lo.cols + ')<br>stride = ' + Lo.strides + '<br>is_contiguous() = <strong style="color:' + (Lo.contiguous ? 'var(--green)' : 'var(--red)') + '">' + Lo.contiguous + '</strong>' +
        (step >= 0 ? '<br>memory slots visited so far: ' + visitOrder.slice(0, step + 1).join(' → ') : '');
      info.className = 'w-msg' + (Lo.contiguous ? ' good' : ' warn');
      info.innerHTML = mode === 'x' ? 'Reading the tensor row by row visits memory slots <strong>0, 1, 2, … in order</strong>. That is what <em>contiguous</em> means, so <code>view()</code> can reinterpret the strip as any shape just by changing the strides. No data moves.'
        : mode === 't' ? '<code>.t()</code> moved <strong>nothing</strong> in memory: it only swapped the strides to (1, 4). Reading the transposed tensor row by row now <strong>jumps</strong> through memory (0 → 4 → 8 → 1 …). No single stride pattern describes that order as a flat vector, so <code>view(12)</code> refuses; <code>reshape(12)</code> quietly <em>copies</em> the data into a new, ordered strip.'
        : '<code>.contiguous()</code> made a <strong>copy</strong> with the memory rewritten in the transposed reading order. Now the strip is in order again, and <code>view()</code> works. This copy is exactly what <code>reshape()</code> does for you automatically when it has to.';
    }
    function stop() { if (timer) clearInterval(timer); timer = null; }
    function play() {
      stop(); step = -1;
      timer = setInterval(function () { step++; if (step >= 12) { stop(); step = 11; } render(); }, 380);
    }
    L.onTheme(render);
    render();
  };
})();
