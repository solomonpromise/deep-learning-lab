/* DL or not? — a rule-of-thumb decision helper: gradient boosting vs a neural network.
   Encodes the heuristic from Lesson 1.1 §7: deep learning pays off where the raw signal is
   high-dimensional, redundant and structured in ways humans cannot easily write down. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var QUESTIONS = [
    { key: 'type', label: 'What does one example look like?', options: [
      { value: 'table', label: 'Rows of meaningful columns', s: -3, why: 'Curated tabular columns are already a good representation. Someone did the feature engineering when they designed the schema.' },
      { value: 'image', label: 'Images', s: 4, why: 'Pixels are high-dimensional and meaning lives in the relationships between them. That is exactly what learned features are for.' },
      { value: 'text', label: 'Text', s: 4, why: 'Raw text defeats manual feature engineering, and pretrained language models transfer well.' },
      { value: 'audio', label: 'Audio / signals', s: 3, why: 'Waveforms are long, redundant and structured across scales, which suits learned representations.' }] },
    { key: 'n', label: 'How many labelled examples?', options: [
      { value: 's', label: '< 5,000', s: -2, why: 'Small data favours strong defaults like gradient boosting, unless you can fine-tune a pretrained model (Module 7).' },
      { value: 'm', label: '5k – 500k', s: 0, why: 'Medium data: both families are viable, so run a fair bake-off (Module 4).' },
      { value: 'l', label: '> 500k', s: 1, why: 'Large data gives a network room to learn its own representation.' }] },
    { key: 'feat', label: 'Could an expert write the key features down?', options: [
      { value: 'yes', label: 'Yes, easily', s: -2, why: 'If you can write the features, a simple model on good features is fast, cheap and interpretable.' },
      { value: 'part', label: 'Partly', s: 0, why: 'Partial knowledge: hand-made features plus a strong tabular model is often the practical first step.' },
      { value: 'no', label: 'No one knows how', s: 3, why: 'When nobody can write the features, you need a method that discovers them. That is the reason deep learning exists.' }] },
    { key: 'con', label: 'Your constraints?', options: [
      { value: 'fast', label: 'Deadline Friday, must explain', s: -2, why: 'Tight time and a need for explanations favour gradient boosting: fewer knobs and free feature importances.' },
      { value: 'none', label: 'Accuracy first', s: 1, why: 'If raw accuracy matters most and you can afford the experiments, try both and let the evidence decide.' }] }
  ];

  window.DLP.widgets['dl-or-not'] = function (root) {
    var ans = { type: 'table', n: 'm', feat: 'part', con: 'fast' };
    var grid = L.el('div', { class: 'w-grid2' });
    var qs = L.el('div', { class: 'w-col' }), out = L.el('div', { class: 'w-col' });
    grid.appendChild(qs); grid.appendChild(out); root.appendChild(grid);
    QUESTIONS.forEach(function (q) {
      var seg = L.segmented({ label: q.label, value: ans[q.key], options: q.options.map(function (o) { return { value: o.value, label: o.label }; }), onChange: function (v) { ans[q.key] = v; update(); } });
      qs.appendChild(L.el('div', { class: 'dh-q' }, [L.el('span', { text: q.label }), seg.el]));
    });
    var verdict = L.el('div', { class: 'dh-verdict' });
    out.appendChild(verdict);
    out.appendChild(L.el('p', { class: 'w-note', html: 'A rule of thumb, not a law. The professional answer is always <strong>“run a fair comparison”</strong>, which Module 4 teaches you to do.' }));

    function update() {
      var score = 0, reasons = [];
      QUESTIONS.forEach(function (q) { var o = q.options.filter(function (x) { return x.value === ans[q.key]; })[0]; score += o.s; reasons.push(o.why); });
      var pos = L.clamp(50 + score * 5.5, 4, 96);
      var title, icon;
      if (score <= -3) { title = 'Start with gradient boosting'; icon = 'blocks'; }
      else if (score >= 4) { title = 'Deep learning is the natural fit'; icon = 'layers'; }
      else { title = 'Toss-up: run both and compare'; icon = 'scale'; }
      verdict.innerHTML = '<h5>' + L.icon(icon) + ' ' + title + '</h5>' +
        '<div class="dh-meter"><i style="left:' + pos + '%"></i></div><div class="dh-scale"><span>Gradient boosting</span><span>Neural network</span></div>' +
        '<ul class="w-note" style="padding-left:1.1em;margin:10px 0 0">' + reasons.map(function (r) { return '<li style="margin:4px 0">' + r + '</li>'; }).join('') + '</ul>';
    }
    update();
  };
})();
