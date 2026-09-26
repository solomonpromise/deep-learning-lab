/* .gitignore Lab — edit the rules and watch which files of the Lesson 2.4 project git would keep.
   Implements the gitignore rules the lesson depends on: comments, `!` negation, a trailing slash for
   directories only, a leading or middle slash to anchor a pattern to the root, `*`, `?`, `[...]`, `**`,
   last match wins, and "a file inside an ignored directory cannot be re-included". Like
   `git check-ignore -v`, it shows which line decided each file. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  // kind: source (must be tracked), record (worth tracking), generated (should be ignored), secret (must be ignored)
  var FILES = [
    ['.gitignore', 'source'], ['README.md', 'source'], ['requirements.txt', 'source'],
    ['configs/baseline.yaml', 'source'], ['configs/wide.yaml', 'source'],
    ['src/__init__.py', 'source'], ['src/data/__init__.py', 'source'], ['src/data/dataset.py', 'source'],
    ['src/data/__pycache__/dataset.cpython-313.pyc', 'generated'],
    ['src/models/mlp.py', 'source'], ['src/evaluation/metrics.py', 'source'],
    ['src/training/train.py', 'source'], ['src/inference/predict.py', 'source'],
    ['tests/test_shapes.py', 'source'],
    ['data/bank-full.csv', 'generated'],
    ['checkpoints/baseline.pt', 'generated'], ['checkpoints/baseline_results.json', 'record'],
    ['notebooks/explore.ipynb', 'source'], ['notebooks/.ipynb_checkpoints/explore-checkpoint.ipynb', 'generated'],
    ['.venv/pyvenv.cfg', 'generated'], ['.pytest_cache/README.md', 'generated'],
    ['.env', 'secret']
  ];
  var LESSON = '# Data -- regenerable by src/data/dataset.py\n/data/\n*.csv\n*.npz\n*.zip\n\n# Model artifacts -- regenerable by src/training/train.py\ncheckpoints/\n*.pt\n*.pth\n*.onnx\n\n# Environments\n.venv/\nvenv/\nenv/\n\n# Python\n__pycache__/\n*.py[cod]\n*.egg-info/\n.pytest_cache/\n\n# Notebooks\n.ipynb_checkpoints/\n\n# Secrets -- never commit these\n.env\n*.key\ncredentials.json';
  var PRESETS = [
    { label: '<code>data/</code>  (the trap)', text: 'data/\ncheckpoints/\n__pycache__/\n.pytest_cache/\n.ipynb_checkpoints/\n.venv/\n.env' },
    { label: '<code>/data/</code>  (anchored)', text: '/data/\ncheckpoints/\n__pycache__/\n.pytest_cache/\n.ipynb_checkpoints/\n.venv/\n.env' },
    { label: 'The lesson\'s .gitignore', text: LESSON },
    { label: 'Re-include results (broken)', text: LESSON + '\n\n# keep the run records?\n!checkpoints/*_results.json' },
    { label: 'Re-include results (works)', text: LESSON.replace('checkpoints/\n', 'checkpoints/*\n') + '\n\n# keep the run records\n!checkpoints/*_results.json' }
  ];

  function globToRe(g) {
    var re = '', i = 0;
    while (i < g.length) {
      var ch = g[i];
      if (ch === '*') {
        if (g[i + 1] === '*') {
          if (g[i + 2] === '/') { re += '(?:.*/)?'; i += 3; continue; }
          re += '.*'; i += 2; continue;
        }
        re += '[^/]*';
      } else if (ch === '?') re += '[^/]';
      else if (ch === '[') {
        var j = g.indexOf(']', i + 1);
        if (j < 0) { re += '\\['; } else { re += '[' + g.slice(i + 1, j).replace(/^!/, '^').replace(/\\/g, '\\\\') + ']'; i = j; }
      } else re += ch.replace(/[.+^${}()|\\]/g, '\\$&');
      i++;
    }
    return new RegExp('^' + re + '$');
  }
  function parse(text) {
    return text.split('\n').map(function (raw, k) {
      var line = raw.replace(/\s+$/, '');
      if (!line || line[0] === '#') return null;
      var neg = line[0] === '!'; var pat = neg ? line.slice(1) : line;
      var dirOnly = /\/$/.test(pat); if (dirOnly) pat = pat.slice(0, -1);
      var anchored = pat.indexOf('/') >= 0; pat = pat.replace(/^\//, '');
      if (!pat) return null;
      return { n: k + 1, text: line, neg: neg, dirOnly: dirOnly, anchored: anchored, re: globToRe(pat) };
    }).filter(Boolean);
  }
  function lastMatch(rules, path, isDir) {
    var hit = null, base = path.split('/').pop();
    rules.forEach(function (r) {
      if (r.dirOnly && !isDir) return;
      if (r.re.test(r.anchored ? path : base)) hit = r;
    });
    return hit;
  }
  function decide(rules, path) {
    var parts = path.split('/');
    for (var d = 1; d < parts.length; d++) {        // an ignored parent directory wins outright
      var dir = parts.slice(0, d).join('/'), r = lastMatch(rules, dir, true);
      if (r && !r.neg) {
        var own = lastMatch(rules, path, false);
        return { ignored: true, rule: r, via: dir + '/', blockedNeg: own && own.neg ? own : null };
      }
    }
    var m = lastMatch(rules, path, false);
    return { ignored: !!(m && !m.neg), rule: m };
  }

  window.DLP.widgets['gitignore-lab'] = function (root) {
    var ta = L.el('textarea', { class: 'gi-text', spellcheck: 'false', 'aria-label': '.gitignore rules', rows: 12 });
    ta.value = PRESETS[0].text;
    var presets = L.el('div', { class: 'w-row gi-presets' });
    PRESETS.forEach(function (p) { presets.appendChild(L.button(p.label, function () { ta.value = p.text; paint(); })); });
    var list = L.el('div', { class: 'gi-list' });
    var stats = L.el('div', { class: 'w-stats' }), msg = L.el('div', { class: 'w-msg' });
    root.appendChild(L.el('div', { class: 'w-col' }, [
      presets,
      L.el('div', { class: 'w-grid2 even' }, [
        L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-panel-title', html: L.icon('pencil') + ' .gitignore (edit me)' }), ta]),
        L.el('div', { class: 'w-col' }, [L.el('div', { class: 'w-panel-title', html: L.icon('layers') + ' What git would do' }), list])
      ]),
      stats, msg
    ]));
    ta.addEventListener('input', paint);

    function paint() {
      var rules = parse(ta.value), lostSrc = [], keptGen = 0, keptSecret = false, blocked = null, record = null;
      list.innerHTML = '';
      FILES.forEach(function (f) {
        var d = decide(rules, f[0]), kind = f[1];
        var bad = (kind === 'source' && d.ignored) || (kind === 'secret' && !d.ignored);
        var warn = (kind === 'generated' && !d.ignored) || (kind === 'record' && d.ignored);
        if (kind === 'source' && d.ignored) lostSrc.push(f[0]);
        if (kind === 'generated' && !d.ignored) keptGen++;
        if (kind === 'secret' && !d.ignored) keptSecret = true;
        if (kind === 'record') record = d;
        if (d.blockedNeg) blocked = d;
        var why = d.rule ? '.gitignore:' + d.rule.n + ': ' + d.rule.text + (d.via ? '   (matches ' + d.via + ')' : '') : null;
        list.appendChild(L.el('div', { class: 'gi-file' + (bad ? ' bad' : warn ? ' warn' : '') }, [
          L.el('span', { class: 'w-tag ' + (d.ignored ? '' : 'good'), text: d.ignored ? 'ignored' : 'tracked' }),
          L.el('code', { class: 'gi-path' + (d.ignored ? ' off' : ''), text: f[0] }),
          why ? L.el('span', { class: 'gi-why', text: why }) : null
        ]));
      });
      stats.innerHTML = '';
      [['Source files lost', String(lostSrc.length), lostSrc.length ? 'bad' : 'good'],
       ['Generated files tracked', String(keptGen), keptGen ? 'bad' : 'good'],
       ['Secret committed?', keptSecret ? 'yes' : 'no', keptSecret ? 'bad' : 'good'],
       ['Results JSON', record && !record.ignored ? 'tracked' : 'ignored', record && !record.ignored ? 'good' : '']
      ].forEach(function (s) { stats.appendChild(L.stat(s[0], s[1], s[2]).el); });
      if (lostSrc.length) {
        msg.className = 'w-msg bad';
        msg.innerHTML = '<strong>' + lostSrc.map(function (p) { return '<code>' + p + '</code>'; }).join(', ') + ' would never be committed.</strong> ' +
          'A pattern without a leading or middle slash matches at <em>every</em> level of the tree, so <code>data/</code> also matches <code>src/data/</code>. Your tests pass locally; whoever clones the repository gets an <code>ImportError</code>.';
      } else if (keptSecret) {
        msg.className = 'w-msg bad';
        msg.innerHTML = '<code>.env</code> would be committed. Once a secret is in git history, deleting the file does not remove it: rotate the key.';
      } else if (blocked) {
        msg.className = 'w-msg warn';
        msg.innerHTML = 'Line ' + blocked.blockedNeg.n + ' (<code>' + blocked.blockedNeg.text + '</code>) tries to re-include a file, but its folder <code>' + blocked.via + '</code> is excluded by line ' + blocked.rule.n + '. Git does not look inside an excluded directory, so the <code>!</code> rule never gets a chance. Exclude the folder\'s <em>contents</em> instead (<code>checkpoints/*</code>), then re-include.';
      } else if (keptGen) {
        msg.className = 'w-msg warn';
        msg.innerHTML = 'No source is lost, but ' + keptGen + ' generated file' + (keptGen > 1 ? 's are' : ' is') + ' tracked. Everything that can be regenerated from what you commit should stay out of history.';
      } else {
        msg.className = 'w-msg good';
        msg.innerHTML = 'Every source file is tracked and everything regenerable is excluded.' + (record && !record.ignored ? ' The run record is committed alongside its config, while the heavy <code>.pt</code> stays out.' : ' The results JSON is ignored with the rest of <code>checkpoints/</code>: to commit it, use <code>git add -f</code> or try the last preset.');
      }
    }
    paint();
  };
})();
