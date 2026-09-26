/* One-hot Explorer — ordinal codes invent distances; one-hot keeps every category equally far apart.
   Shows both encodings of the same categories and the distance between every pair under each. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var CATS = ['admin.', 'blue-collar', 'management', 'retired', 'student'];
  window.DLP.widgets['onehot-viz'] = function (root) {
    var P = L.palette(), sel = 0, mode = 'ordinal';
    var seg = L.segmented({ value: mode, options: [{ value: 'ordinal', label: 'Ordinal codes (0, 1, 2 …)' }, { value: 'onehot', label: 'One-hot columns' }], onChange: function (v) { mode = v; paint(); } });
    var left = L.el('div', { class: 'w-col' }), right = L.el('div', { class: 'w-col' });
    var msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [seg.el, L.el('div', { class: 'w-grid2 even' }, [left, right]), msg]));
    function vec(i) { return mode === 'ordinal' ? [i] : CATS.map(function (_, k) { return k === i ? 1 : 0; }); }
    function dist(a, b) { var va = vec(a), vb = vec(b), s = 0; for (var k = 0; k < va.length; k++) s += (va[k] - vb[k]) * (va[k] - vb[k]); return Math.sqrt(s); }
    function paint() {
      P = L.palette();
      var cols = mode === 'ordinal' ? ['job_code'] : CATS.map(function (c) { return 'job_' + c; });
      var t = '<div class="w-panel-title">' + L.icon('database') + ' What the model receives (click a row)</div><div class="table-wrap" style="margin:0"><table><thead><tr><th>job</th>' + cols.map(function (c) { return '<th>' + c + '</th>'; }).join('') + '</tr></thead><tbody>' +
        CATS.map(function (c, i) { return '<tr data-row="' + i + '" style="cursor:pointer;' + (i === sel ? 'background:var(--accent-soft)' : '') + '"><td><strong>' + c + '</strong></td>' + vec(i).map(function (v) { return '<td style="text-align:center;font-family:var(--mono);' + (v ? 'color:var(--accent-ink);font-weight:700' : 'color:var(--ink-3)') + '">' + v + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></div>';
      left.innerHTML = t;
      Array.prototype.forEach.call(left.querySelectorAll('[data-row]'), function (tr) { tr.addEventListener('click', function () { sel = +tr.getAttribute('data-row'); paint(); }); });
      var mx = mode === 'ordinal' ? 4 : Math.SQRT2;
      var d = '<div class="w-panel-title">' + L.icon('scale') + ' Distance from <em>' + CATS[sel] + '</em> to every job</div>';
      CATS.forEach(function (c, i) {
        var v = dist(sel, i), pct = v / mx * 100;
        d += '<div class="rb-row" style="grid-template-columns:100px 1fr 50px"><span>' + c + '</span><span class="rb-track"><span class="rb-bar" style="width:' + pct + '%;background:' + (mode === 'ordinal' ? P.c1 : P.c0) + '"></span></span><span class="rb-val">' + v.toFixed(2) + '</span></div>';
      });
      right.innerHTML = d;
      msg.className = 'w-msg' + (mode === 'ordinal' ? ' warn' : ' good');
      msg.innerHTML = mode === 'ordinal'
        ? 'With codes 0–4 the model sees <strong>' + CATS[sel] + '</strong> as ' + (sel === 0 ? '4 units away from student but only 1 from blue-collar' : 'closer to some jobs than others') + ', and it can learn "higher code → more likely to subscribe". Those distances and that order are <strong>invented</strong> by the order we listed the categories in.'
        : 'Every job is exactly <strong>√2 ≈ 1.41</strong> from every other: category membership with no fake order. The price is width: one column per category (9 categorical columns become 44 here). For thousands of categories you would use a learned <em>embedding</em> instead (Module 5).';
    }
    paint();
  };
})();
