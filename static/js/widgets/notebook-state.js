/* Notebook State — hidden state, reproduced. Four cells from Lesson 2.4 that can be run in any order,
   with Jupyter-style execution counts. The saved output of the print cell depends on the order the cells
   ran, which the saved notebook does not record. "Restart & run all" is the only order a reader can assume. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var CELLS = [
    { id: 'A', code: 'threshold = 0.5' },
    { id: 'B', code: 'def classify(p):\n    return "yes" if p >= threshold else "no"' },
    { id: 'C', code: 'print(classify(0.6))' },
    { id: 'D', code: 'threshold = 0.9     # a cell you ran, then scrolled past' }
  ];
  window.DLP.widgets['notebook-state'] = function (root) {
    var state;
    function reset() { state = { vars: {}, count: 0, cells: CELLS.map(function () { return { n: null, out: null, err: false }; }), log: [] }; }
    reset();
    var list = L.el('div', { class: 'nbs-cells' });
    var kernel = L.el('div', { class: 'w-panel' });
    var stats = L.el('div', { class: 'w-stats' });
    var msg = L.el('div', { class: 'w-msg' });
    var controls = L.el('div', { class: 'w-row' }, [
      L.button(L.icon('refresh') + ' Restart kernel', function () { reset(); paint(); }),
      L.button(L.icon('play') + ' Restart &amp; run all', function () { reset(); for (var i = 0; i < CELLS.length; i++) run(i); paint(); }, 'primary')
    ]);
    root.appendChild(L.el('div', { class: 'w-grid2' }, [
      L.el('div', { class: 'w-col' }, [list, controls]),
      L.el('div', { class: 'w-col' }, [kernel, stats, msg])
    ]));

    function run(i) {
      var c = state.cells[i], v = state.vars;
      state.count += 1; c.n = state.count; c.out = null; c.err = false;
      if (i === 0) v.threshold = 0.5;
      if (i === 1) v.classify = true;
      if (i === 3) v.threshold = 0.9;
      if (i === 2) {
        if (!v.classify) { c.out = "NameError: name 'classify' is not defined"; c.err = true; }
        else if (v.threshold === undefined) { c.out = "NameError: name 'threshold' is not defined"; c.err = true; }
        else c.out = 0.6 >= v.threshold ? 'yes' : 'no';
      }
      state.log.push(CELLS[i].id);
    }

    function paint() {
      list.innerHTML = '';
      CELLS.forEach(function (cell, i) {
        var s = state.cells[i];
        var btn = L.el('button', { type: 'button', class: 'nbs-run', 'aria-label': 'Run cell ' + cell.id, html: L.icon('play') });
        btn.addEventListener('click', function () { run(i); paint(); });
        var box = L.el('div', { class: 'nbs-cell' + (s.n ? ' ran' : '') }, [
          L.el('div', { class: 'nbs-gutter' }, [btn, L.el('span', { class: 'nbs-count', text: '[' + (s.n || ' ') + ']:' })]),
          L.el('pre', { class: 'nbs-code', text: cell.code })
        ]);
        list.appendChild(box);
        if (s.out !== null) list.appendChild(L.el('pre', { class: 'nbs-out' + (s.err ? ' err' : ''), text: s.out }));
      });

      kernel.innerHTML = '';
      kernel.appendChild(L.el('div', { class: 'w-panel-title', html: L.icon('database') + ' What the kernel holds right now' }));
      var v = state.vars;
      kernel.appendChild(L.el('pre', { class: 'nbs-vars', text:
        'threshold = ' + (v.threshold === undefined ? '(not defined)' : v.threshold) + '\n' +
        'classify  = ' + (v.classify ? '<function classify>' : '(not defined)') }));
      kernel.appendChild(L.el('p', { class: 'w-note', html: 'Order you ran: <code>' + (state.log.join(' → ') || 'nothing yet') + '</code>' }));

      var ran = state.cells.map(function (c, i) { return { n: c.n, i: i }; }).filter(function (c) { return c.n; });
      var inOrder = ran.every(function (c, k) { return k === 0 || c.n > ran[k - 1].n; });
      var rerun = state.log.length > ran.length;
      var c = state.cells[2];
      stats.innerHTML = '';
      [['Cells run', String(state.log.length)],
       ['Saved output of cell C', c.out === null ? '—' : c.err ? 'error' : c.out, c.out === null ? '' : c.err || c.out !== 'yes' ? 'bad' : 'good'],
       ['Top-to-bottom order?', ran.length ? (inOrder && !rerun ? 'yes' : 'no') : '—', ran.length ? (inOrder && !rerun ? 'good' : 'bad') : '']
      ].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });

      if (!state.log.length) {
        msg.className = 'w-msg';
        msg.innerHTML = 'Run the cells in any order with the ▶ buttons. The number in brackets is the execution count Jupyter saves with each cell. Try <strong>A, B, C</strong>, then <strong>D, C</strong>.';
      } else if (c.err) {
        msg.className = 'w-msg bad';
        msg.innerHTML = '<strong>Cell C failed</strong> because something it depends on has not run yet. A function body looks up global names only when it is <em>called</em>, so defining <code>classify</code> before <code>threshold</code> exists is fine; calling it is not.';
      } else if (c.out === 'no') {
        msg.className = 'w-msg bad';
        msg.innerHTML = '<strong>The saved output says "no", and nobody reading top to bottom can reproduce it.</strong> Cell C read <code>threshold = 0.9</code> from cell D, which sits <em>below</em> it. The file keeps the output and a count of [' + c.n + '], not the sequence of state changes behind it. <strong>Restart &amp; run all</strong> gives "yes".';
      } else if (c.out === 'yes' && (!inOrder || rerun)) {
        msg.className = 'w-msg warn';
        msg.innerHTML = 'Cell C says "yes", but the counts are not in top-to-bottom order, so a reader cannot be sure how that output was produced. <strong>Restart &amp; run all</strong> is the only history a reader can assume.';
      } else if (c.out === 'yes') {
        msg.className = 'w-msg good';
        msg.innerHTML = 'Counts increase top to bottom, so the saved output matches what a fresh run produces. That is the state <strong>Restart &amp; run all</strong> guarantees, and the state a script run from the command line always starts from.';
      } else {
        msg.className = 'w-msg';
        msg.innerHTML = 'Now run cell C to print the classification.';
      }
    }
    paint();
  };
})();
