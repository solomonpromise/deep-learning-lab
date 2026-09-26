/* Module Registry — what nn.Module can see, and what the optimizer therefore updates.
   BrokenNet keeps two layers in a plain Python list (invisible); FixedNet uses nn.ModuleList. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var NS = 'http://www.w3.org/2000/svg';
  var NODES = [
    { id: 'fc1', label: 'fc1 = nn.Linear(6, 8)', params: 56, x: 30, y: 60 },
    { id: 'h0', label: 'hidden_layers[0] = nn.Linear(8, 8)', params: 72, x: 30, y: 130, inList: true },
    { id: 'h1', label: 'hidden_layers[1] = nn.Linear(8, 8)', params: 72, x: 30, y: 190, inList: true },
    { id: 'out', label: 'out = nn.Linear(8, 1)', params: 9, x: 30, y: 260 }
  ];
  window.DLP.widgets['module-registry'] = function (root) {
    var P = L.palette(), fixed = false, stepped = false;
    var seg = L.segmented({ value: 'broken', options: [{ value: 'broken', label: 'BrokenNet: plain Python list' }, { value: 'fixed', label: 'FixedNet: nn.ModuleList' }], onChange: function (v) { fixed = v === 'fixed'; stepped = false; draw(); } });
    var btn = L.button(L.icon('play') + ' Run loss.backward() + optimizer.step()', function () { stepped = true; draw(); }, 'primary');
    var svg = document.createElementNS(NS, 'svg'); svg.setAttribute('viewBox', '0 0 640 320'); svg.setAttribute('class', 'pf-svg');
    var stats = L.el('div', { class: 'w-stats' });
    var msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-row' }, [seg.el, btn]), svg, stats, msg]));
    function mk(tag, a, parent) { var e = document.createElementNS(NS, tag); Object.keys(a).forEach(function (k) { e.setAttribute(k, a[k]); }); (parent || svg).appendChild(e); return e; }
    function text(x, y, s, o) { o = o || {}; var t = mk('text', { x: x, y: y, fill: o.fill || P.ink, 'font-size': o.size || 12.5, 'font-weight': o.weight || 600, 'font-family': o.mono ? 'JetBrains Mono, monospace' : 'Inter, system-ui, sans-serif', 'text-anchor': o.anchor || 'start' }); t.textContent = s; return t; }
    function draw() {
      P = L.palette();
      while (svg.firstChild) svg.removeChild(svg.firstChild);
      mk('rect', { x: 10, y: 10, width: 400, height: 300, rx: 16, fill: 'none', stroke: P.line2, 'stroke-dasharray': '6 5' });
      text(24, 36, (fixed ? 'FixedNet' : 'BrokenNet') + '  (nn.Module)', { size: 14, weight: 800 });
      if (true) {
        mk('rect', { x: 22, y: 104, width: 376, height: 130, rx: 12, fill: 'none', stroke: fixed ? P.c0 : P.red, 'stroke-width': 1.5, 'stroke-dasharray': fixed ? '' : '4 4' });
        text(34, 122, fixed ? 'self.hidden_layers = nn.ModuleList([...])' : 'self.hidden_layers = [ ... ]   ← a plain list', { size: 11, mono: true, fill: fixed ? P.c0 : P.red });
      }
      var total = 0;
      NODES.forEach(function (n) {
        var registered = !n.inList || fixed, y = n.inList ? n.y + 8 : n.y;
        if (registered) total += n.params;
        var fill = registered ? (P.dark ? '#13261a' : '#e4f4e8') : (P.dark ? '#2e1717' : '#fcebea');
        var stroke = registered ? P.green : P.red;
        mk('rect', { x: n.x + (n.inList ? 16 : 0), y: y, width: n.inList ? 344 : 360, height: 36, rx: 10, fill: fill, stroke: stroke, 'stroke-width': 1.6, 'stroke-dasharray': registered ? '' : '5 4' });
        text(n.x + (n.inList ? 30 : 14), y + 23, n.label, { size: 12, mono: true });
        text(n.x + (n.inList ? 350 : 350), y + 23, n.params + ' params', { size: 11, anchor: 'end', fill: P.ink2 });
        var bx = 430, by = y + 18;
        mk('line', { x1: n.x + 360, y1: by, x2: bx, y2: by, stroke: P.line2, 'stroke-dasharray': '3 3' });
        var status = !registered ? 'invisible to the optimizer' : stepped ? 'updated ✓' : 'in model.parameters()';
        mk('rect', { x: bx, y: by - 13, width: 196, height: 26, rx: 13, fill: !registered ? P.red : stepped ? P.green : P.surface2, opacity: registered && !stepped ? 1 : 0.95 });
        text(bx + 98, by + 5, stepped && !registered ? 'never updated ✗' : status, { size: 11.5, anchor: 'middle', fill: !registered || stepped ? '#fff' : P.ink2, weight: 700 });
      });
      stats.innerHTML = '';
      [['Parameters the optimizer sees', total.toLocaleString(), fixed ? 'good' : 'bad'], ['Parameters in the forward pass', '209'], ['Silently frozen', (209 - total).toLocaleString(), fixed ? '' : 'bad']].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      msg.className = 'w-msg' + (fixed ? ' good' : ' bad');
      msg.innerHTML = fixed
        ? '<strong>Every layer is registered.</strong> <code>nn.ModuleList</code> tells PyTorch "these are child modules", so their weights appear in <code>model.parameters()</code>, move with <code>.to(device)</code>, get saved in <code>state_dict()</code> and are updated by the optimizer.'
        : '<strong>No error, no warning, and 144 weights that never learn.</strong> Both hidden layers run in <code>forward</code> and even receive gradients, but they live in a plain Python list, so <code>model.parameters()</code> never yields them and the optimizer never touches them. They stay at their random initial values. ' + (stepped ? 'You just stepped: only fc1 and out changed.' : 'Press the button to take a training step.');
    }
    L.onTheme(draw);
    draw();
  };
})();
