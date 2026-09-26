/* Project Map — the bank_marketing_project repository built in Lesson 2.4, file by file.
   Pick a file to read it the way the lesson recommends: what it is responsible for, what goes in, what
   comes out, which assumptions must hold and what protects them, plus what it imports and who imports it. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var FILES = [
    { p: 'README.md', kind: 'docs', git: true,
      job: 'The front door: the problem, the data and its traps, the metrics, how to train and how to score new rows, in the twelve sections Module 10 asks for.',
      inp: 'Nothing. It is written for a person.', out: 'A reader who can run the project without asking the author.',
      keep: 'Quoted numbers stay true. The README points at <code>checkpoints/&lt;run&gt;_results.json</code> instead of copying numbers that go stale.',
      guard: 'Review. Nothing automatic checks prose.' },
    { p: 'requirements.txt', kind: 'config', git: true,
      job: 'The direct dependencies, each pinned to the version the project was run and tested with.',
      inp: '—', out: '<code>pip install -r requirements.txt</code> recreates the environment.',
      keep: 'The installed PyTorch build matches the hardware. The file says to install torch with the platform command first.',
      guard: 'The dependency-check cell in Section 2 (<code>torch.__version__</code>, CUDA/MPS availability).' },
    { p: '.gitignore', kind: 'config', git: true,
      job: 'Everything git must never see: regenerable data and checkpoints, environments, caches, secrets.',
      inp: '—', out: 'A repository that holds only what cannot be regenerated.',
      keep: 'No source file is caught by a pattern. <code>/data/</code> is anchored so that <code>src/data/</code> survives.',
      guard: 'The Section 6 check that every <code>.py</code> file under <code>src/</code> and <code>tests/</code> is tracked.' },
    { p: 'configs/baseline.yaml', kind: 'config', git: true, readBy: ['src/training/train.py'],
      job: 'One experiment, fully described: seed, device, batch sizes, <code>hidden_sizes: [64, 32]</code>, learning rate, epochs, patience, output folder.',
      inp: '—', out: 'A dict (<code>yaml.safe_load</code>) that <code>main()</code> reads every setting from.',
      keep: 'Every value that changes between runs lives here, not in the code.',
      guard: 'It is copied into the checkpoint and the results JSON, so each result carries its recipe.' },
    { p: 'configs/wide.yaml', kind: 'config', git: true, readBy: ['src/training/train.py'],
      job: 'A second experiment: <code>hidden_sizes: [256, 128, 64]</code>, everything else identical.',
      inp: '—', out: 'Same shape of dict as baseline.yaml.',
      keep: 'Only the setting under test differs, so the diff between the two files <em>is</em> the experiment.',
      guard: 'A diff against baseline.yaml (Section 5 prints it).' },
    { p: 'src/data/dataset.py', kind: 'module', git: true, imports: [], reads: 'data/bank-full.csv',
      job: 'Turn the raw UCI CSV into encoded float32 arrays and DataLoaders.',
      inp: '<code>data_dir</code>, <code>seed</code>, batch sizes.',
      out: 'A dict of <code>X_train</code>/<code>y_train</code>/<code>X_val</code>/…/<code>feature_names</code>; three DataLoaders with labels shaped <code>(N, 1)</code>.',
      keep: '<code>duration</code> is dropped (a target leak). One-hot columns and the scaler come from the training split only. The same seed gives the same stratified 70/15/15 split.',
      guard: 'The seed in the config; <code>reindex(columns=names)</code> forces validation and test onto the training columns.' },
    { p: 'src/models/mlp.py', kind: 'module', git: true, imports: [],
      job: '<code>DenseBlock</code>, <code>BankMLP</code> and <code>count_parameters</code>: the architecture, and nothing about training.',
      inp: '<code>in_features</code>, <code>hidden_sizes</code>; a batch shaped <code>(N, in_features)</code>.',
      out: 'Raw logits shaped <code>(N, 1)</code>.',
      keep: 'No sigmoid in <code>forward</code>. Blocks live in an <code>nn.ModuleList</code> so the optimizer can see them.',
      guard: 'Four of the six tests: forward shape, parameter count, logits not probabilities, configurable depth.' },
    { p: 'src/evaluation/metrics.py', kind: 'module', git: true, imports: [],
      job: '<code>evaluate</code> (loss, ROC-AUC, average precision) and <code>recall_at_budget</code>.',
      inp: 'A model, a loader, the loss function, the device; or scores and labels.',
      out: 'A dict of metrics plus the raw probabilities and labels; a recall fraction.',
      keep: '<code>model.eval()</code> and <code>no_grad()</code> during evaluation; ranking metrics computed once over the whole split. Accuracy is deliberately not the headline.',
      guard: 'Its separation: inference and notebooks can import it without pulling in an optimizer.' },
    { p: 'src/training/train.py', kind: 'entry', git: true, imports: ['src/data/dataset.py', 'src/evaluation/metrics.py', 'src/models/mlp.py'],
      reads: 'configs/*.yaml', writes: ['checkpoints/baseline.pt', 'checkpoints/baseline_results.json'],
      job: 'The entry point: read a config, seed, build data/model/optimizer, train with early stopping, evaluate, save.',
      inp: '<code>python -m src.training.train --config configs/baseline.yaml</code>',
      out: '<code>checkpoints/&lt;run&gt;.pt</code>, <code>checkpoints/&lt;run&gt;_results.json</code> and a printed log.',
      keep: 'Run from the project root so <code>src</code> is importable. The test split is scored only after the best epoch has been chosen.',
      guard: 'The tests run first; the results JSON records the config, history and metrics of every run.' },
    { p: 'src/inference/predict.py', kind: 'module', git: true, imports: ['src/models/mlp.py'], reads: 'checkpoints/baseline.pt',
      job: '<code>load_model</code>, <code>predict_proba</code> and <code>rank_by_score</code>: scoring, with no training code at all.',
      inp: 'A checkpoint path; features already encoded by dataset.py, one row or many.',
      out: 'P(subscribe) per row; the indices of the top-k rows.',
      keep: 'Inputs are encoded exactly as in training. The checkpoint carries <code>config</code> and <code>in_features</code> so the architecture can be rebuilt.',
      guard: '<code>test_single_row_inference</code>; it never imports train.py, so serving cannot drag in the optimizer.' },
    { p: 'tests/test_shapes.py', kind: 'test', git: true, imports: ['src/models/mlp.py', 'src/inference/predict.py'],
      job: 'Six contract tests that train nothing and run in about half a second.',
      inp: '<code>python -m pytest tests/ -v</code>', out: 'Pass/fail per contract, exit code 0 when all pass.',
      keep: 'They test the plumbing, not the model quality.',
      guard: 'They <em>are</em> the guard: run them before every training run.' },
    { p: '__init__.py  (×7)', kind: 'module', git: true,
      job: 'Empty files that mark <code>src/</code>, its five sub-folders and <code>tests/</code> as packages.',
      inp: '—', out: '<code>from src.models.mlp import BankMLP</code> resolves.',
      keep: 'Every folder you import from has one.', guard: 'An <code>ImportError</code> the moment one is missing.' },
    { p: 'data/bank-full.csv', kind: 'generated', git: false, writer: 'src/data/dataset.py',
      job: 'The raw dataset, 45,211 rows, about 4.5 MB.',
      inp: 'Downloaded from UCI by <code>download()</code> when missing.', out: 'Read by <code>load_splits()</code>.',
      keep: 'The download URL and the preprocessing in dataset.py describe it more precisely than the file would.',
      guard: '<code>/data/</code> in .gitignore (anchored).' },
    { p: 'checkpoints/baseline.pt', kind: 'generated', git: false, writer: 'src/training/train.py',
      job: 'The trained weights plus optimizer state, best epoch, config, <code>in_features</code> and the torch version (71 KB).',
      inp: 'Written at the end of every run.', out: 'Loaded by <code>load_model()</code>.',
      keep: 'Anyone can regenerate it from the committed code and config.',
      guard: '<code>checkpoints/</code> and <code>*.pt</code> in .gitignore. To share one, use a release or a model hub, not git.' },
    { p: 'checkpoints/baseline_results.json', kind: 'generated', git: false, writer: 'src/training/train.py',
      job: 'The run record: config, best epoch, per-epoch history, validation and test metrics, torch version.',
      inp: 'Written at the end of every run.', out: 'Read by you, six weeks later, to answer "which settings gave 0.80?".',
      keep: 'Small and worth committing next to its config. The <code>checkpoints/</code> rule hides it, so it needs <code>git add -f</code> or a re-include rule (see the .gitignore lab).',
      guard: 'Nothing yet: that is the gap Section 6 points at.' },
    { p: 'notebooks/', kind: 'folder', git: true,
      job: 'Empty for now. Exploration and reports live here and <em>import</em> from <code>src/</code> instead of copying code.',
      inp: '—', out: '—', keep: 'Notebooks call the project; the project never depends on a notebook.', guard: 'nbstripout keeps outputs out of commits.' },
    { p: 'app/', kind: 'folder', git: true,
      job: 'Empty for now. A serving app arrives in Modules 9–10 and will import <code>src/inference</code>.',
      inp: '—', out: '—', keep: 'It depends on inference, never on training.', guard: '—' }
  ];
  var KIND = { docs: ['docs', ''], config: ['config', 'info'], module: ['module', 'info'], entry: ['entry point', 'good'], test: ['test', 'good'], generated: ['generated', 'bad'], folder: ['folder', ''] };

  window.DLP.widgets['project-map'] = function (root) {
    var sel = 'src/training/train.py';
    var tree = L.el('div', { class: 'pm-tree', role: 'listbox', 'aria-label': 'Project files' });
    var detail = L.el('div', { class: 'w-panel pm-detail' });
    root.appendChild(L.el('div', { class: 'w-grid2 even' }, [
      L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-panel-title', html: L.icon('layers') + ' bank_marketing_project/' }), tree]),
      detail
    ]));
    function byPath(p) { return FILES.filter(function (f) { return f.p === p; })[0]; }
    function chip(p) {
      var b = L.el('button', { type: 'button', class: 'pm-chip', text: p });
      b.addEventListener('click', function () { if (byPath(p)) { sel = p; paint(); } });
      return b;
    }
    function row(label, html) { return L.el('div', { class: 'pm-row' }, [L.el('span', { class: 'pm-k', text: label }), L.el('span', { class: 'pm-v', html: html })]); }
    function paint() {
      tree.innerHTML = '';
      FILES.forEach(function (f) {
        var depth = f.p.indexOf('__init__') === 0 ? 0 : Math.max(0, f.p.replace(/\/$/, '').split('/').length - 1);
        var name = f.p.replace(/\/$/, '').split('/').pop() + (/\/$/.test(f.p) ? '/' : '');
        var dir = f.p.indexOf('/') > 0 && !/\/$/.test(f.p) ? f.p.slice(0, f.p.lastIndexOf('/') + 1) : '';
        var b = L.el('button', { type: 'button', role: 'option', 'aria-selected': f.p === sel ? 'true' : 'false', class: 'pm-file' + (f.p === sel ? ' is-on' : '') + (f.git ? '' : ' ignored') }, [
          L.el('span', { class: 'pm-name', html: '<span class="pm-dir">' + dir + '</span>' + name }),
          L.el('span', { class: 'w-tag ' + KIND[f.kind][1], text: KIND[f.kind][0] })
        ]);
        b.style.paddingLeft = (10 + depth * 4) + 'px';
        b.addEventListener('click', function () { sel = f.p; paint(); });
        tree.appendChild(b);
      });
      var f = byPath(sel);
      detail.innerHTML = '';
      detail.appendChild(L.el('div', { class: 'pm-title' }, [L.el('code', { text: f.p }), L.el('span', { class: 'w-tag ' + (f.git ? 'good' : 'bad'), text: f.git ? 'committed' : 'ignored by git' })]));
      detail.appendChild(row('Responsible for', f.job));
      detail.appendChild(row('Goes in', f.inp));
      detail.appendChild(row('Comes out', f.out));
      detail.appendChild(row('Must stay true', f.keep));
      detail.appendChild(row('Protected by', f.guard));
      var imports = f.imports || [];
      var importedBy = FILES.filter(function (g) { return (g.imports || []).indexOf(f.p) >= 0; }).map(function (g) { return g.p; });
      var links = L.el('div', { class: 'pm-links' });
      function group(label, items) { if (!items.length) return; links.appendChild(L.el('span', { class: 'pm-k', text: label })); var w = L.el('div', { class: 'pm-chips' }); items.forEach(function (p) { w.appendChild(chip(p)); }); links.appendChild(w); }
      group('Imports from src', imports);
      group('Imported by', importedBy);
      group('Read by', f.readBy || []);
      group('Written by', f.writer ? [f.writer] : []);
      group('Writes', f.writes || []);
      if (links.childNodes.length) detail.appendChild(links);
      if (f.p === 'src/inference/predict.py') detail.appendChild(L.el('div', { class: 'w-msg good', html: 'Inference imports the model and nothing else from <code>src</code>. A server that scores customers never loads the training loop, the optimizer or the data download.' }));
      if (f.p === 'src/training/train.py') detail.appendChild(L.el('div', { class: 'w-msg', html: 'Nothing imports <code>train.py</code>: it is a program, started with <code>python -m</code>. Everything it needs comes from the three library modules and one config file.' }));
    }
    paint();
  };
})();
