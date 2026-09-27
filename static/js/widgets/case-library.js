/* Case Library — diagnose broken training runs the way Lesson 3.4's protocol orders the checks.
   Each case shows its loss curves and the free Tier 0 evidence (finite losses, metric against chance and
   the majority rate, the spread of the predictions, the first loss). Tier 1 (gradient profile, dead units)
   and Tier 2 (the 20-row overfit test, a second evaluation) cost points to reveal, because in a real
   project they cost time. Pick a diagnosis, then the fix you would test first. The numbers follow the
   runs in Lessons 1.3, 3.1–3.4 and 4.1; the curves are drawn from them, not re-trained here.
   props.cases: optional list of case ids to include (default: all). */
(function () {
  'use strict';
  var L = window.DLP.lib;

  function curve(n, f, seed, noise) {
    var r = L.rng(seed || 1), out = [];
    for (var e = 1; e <= n; e++) out.push(f(e) + (noise || 0) * r.normal());
    return out;
  }
  var DIAG = {
    lr_high: 'Learning rate too high: the model collapsed',
    lr_low: 'Learning rate too low: the run is undertrained',
    overreg: 'Over-regularised: too constrained to separate the classes',
    overfit: 'Overfitting: training past the best checkpoint',
    val_leak: 'Validation leakage: the validation rows are not unseen',
    target_leak: 'Target leakage: a feature from after the outcome',
    bad_init: 'Initialisation far too large',
    vanishing: 'Vanishing gradients in a deep plain stack',
    no_eval: 'Evaluating in training mode (dropout still on)',
    broadcast: 'Shape bug: (N, 1) against (N,) broadcasts in the loss',
    no_zero_grad: 'Gradients never cleared (missing zero_grad)',
    unscaled: 'Unscaled inputs: one feature dominates the updates'
  };
  var CASES = [
    { id: 'lr_high', story: 'German Credit (30% "bad"), the Module 3 MLP, AdamW, lr = 0.5, 40 epochs.',
      train: curve(40, function (e) { return 0.61 + 0.5 * Math.exp(-e / 1.2); }, 1, 0.004), val: curve(40, function (e) { return 0.616 + 0.3 * Math.exp(-e / 1.5); }, 2, 0.003),
      t0: [['Losses finite?', 'yes'], ['Final val loss', '0.616 (constant base-rate prediction: 0.611)'], ['Val ROC-AUC', '0.503 (chance 0.500)'], ['Val accuracy', '0.700 (majority 0.700)'], ['Predictions', '2 distinct values, 0.20 to 0.35'], ['First loss', '0.70 (expected ≈ 0.61)']],
      t1: [['Gradient norm, first / last layer', '3e-4 / 2e-3'], ['Dead ReLU units, layer 1', '61%']],
      t2: [['Overfit 20 rows at lr 1e-3', 'passes: loss → 0.002']],
      fixes: ['Lower the learning rate to 1e-3 and retrain from scratch', 'Lower the learning rate for the remaining epochs of this run', 'Add dropout 0.5'], fix: 0,
      why: 'A loss sitting on the constant base-rate value, AUC at chance and two distinct predictions mean the model collapsed to (almost) one answer. Large updates killed most first-layer ReLUs (61% dead), and dead units get no gradient, so the run cannot recover: restart with a sensible learning rate.' },
    { id: 'lr_low', story: 'German Credit, the same MLP, AdamW, lr = 1e-4, 40 epochs.',
      train: curve(40, function (e) { return 0.53 + 0.17 * Math.exp(-e / 22); }, 3, 0.002), val: curve(40, function (e) { return 0.54 + 0.14 * Math.exp(-e / 24); }, 4, 0.002),
      t0: [['Losses finite?', 'yes'], ['Val ROC-AUC', '0.780, still rising; final = best'], ['Val accuracy', '0.704 (majority 0.700)'], ['Predictions', '250 distinct, 0.11 to 0.62'], ['First loss', '0.69 (expected ≈ 0.61)']],
      t1: [['Gradient norm, first / last layer', '0.08 / 0.12 (healthy, flat)'], ['Dead ReLU units, layer 1', '0%']],
      t2: [['Overfit 20 rows', 'passes, slowly (400 steps)']],
      fixes: ['Raise the learning rate (or run an LR range test) and compare at the same budget', 'Collect more data', 'Remove a hidden layer'], fix: 0,
      why: 'Both curves are still descending at the last epoch and the best AUC is the final one: the run was cut short, not maxed out. Nothing is broken, which is why this one is dangerous: do not report 0.78 as the model\'s capability until optimisation has finished.' },
    { id: 'overreg', story: 'German Credit, a (16, 8) MLP with dropout 0.8 and weight decay 1.0.',
      train: curve(40, function (e) { return 0.60 + 0.1 * Math.exp(-e / 6); }, 5, 0.004), val: curve(40, function (e) { return 0.585 + 0.09 * Math.exp(-e / 6); }, 6, 0.003),
      t0: [['Losses finite?', 'yes'], ['Val ROC-AUC', '0.830 (reference best 0.816)'], ['Val accuracy', '0.700 (majority 0.700)'], ['Predictions', 'all between 0.28 and 0.42; none above 0.5'], ['Train ROC-AUC', '0.841']],
      t1: [['Gradient norm, first / last layer', '0.05 / 0.09'], ['Weight norm', '2.1 (reference 19.0)']],
      t2: [['Overfit 20 rows', 'fails: loss stuck at 0.58']],
      fixes: ['Reduce dropout and weight decay, keep the small network', 'Raise the learning rate', 'Add more epochs'], fix: 0,
      why: 'AUC looks excellent, but accuracy equals the majority rate and every prediction sits in a narrow band below 0.5: the model ranks, but never decides "bad". Only AUC + accuracy + prediction range together reveal it. Heavy constraints also stop it memorising even 20 rows.' },
    { id: 'overfit', story: 'German Credit, 500 training rows, a (256, 128) MLP (98 parameters per row), no regularisation, 60 epochs.',
      train: curve(60, function (e) { return 0.58 * Math.exp(-e / 7); }, 7, 0.004), val: curve(60, function (e) { return 0.47 + (e < 5 ? 0.12 * (5 - e) / 4 : 0.022 * (e - 5)); }, 8, 0.01),
      t0: [['Losses finite?', 'yes'], ['Train ROC-AUC / loss', '1.000 / 0.0006'], ['Val loss', 'best 0.473 at epoch 5, final 1.59'], ['Val ROC-AUC', 'best 0.819, final 0.742'], ['Predictions', '69% above 0.99 or below 0.01']],
      t1: [['Gradient norm, first / last layer', '0.02 / 0.03 (tiny: fits training data)']],
      t2: [['Two evaluations of the same model', 'identical']],
      fixes: ['Early stopping that restores the best epoch (and/or a smaller model)', 'Raise the learning rate', 'Evaluate on the training set'], fix: 0,
      why: 'Training keeps improving while validation loss turns up after epoch 5 and predictions become extremely confident. Keep the best checkpoint (early stopping with restore), then try capacity, weight decay or dropout, and judge them against the noise floor.' },
    { id: 'val_leak', story: 'German Credit, the reference configuration, but the split was rebuilt by a colleague.',
      train: curve(40, function (e) { return 0.6 * Math.exp(-e / 7); }, 9, 0.004), val: curve(40, function (e) { return 0.6 * Math.exp(-e / 7) - 0.005; }, 10, 0.004),
      t0: [['Losses finite?', 'yes'], ['Val ROC-AUC', '1.000'], ['Val accuracy', '1.000 (majority 0.720)'], ['Validation − training gap', '+0.000'], ['Reference val AUC on this data', '0.816']],
      t1: [['Gradient profile', 'healthy']],
      t2: [['Rows appearing in both train and validation', '250 of 250']],
      fixes: ['Rebuild the split so validation rows are genuinely held out (check overlaps, groups, duplicates)', 'Add dropout', 'Lower the learning rate'], fix: 0,
      why: 'On 500 rows a truly unseen validation set cannot reproduce training behaviour exactly. A perfect score that beats a sensible baseline by a mile is an investigation trigger. Here the validation rows were copied from training.' },
    { id: 'target_leak', story: 'Bank Marketing, the Module 2 MLP, all 16 columns including `duration`.',
      train: curve(20, function (e) { return 0.18 + 0.2 * Math.exp(-e / 3); }, 11, 0.003), val: curve(20, function (e) { return 0.205 + 0.18 * Math.exp(-e / 3); }, 12, 0.003),
      t0: [['Losses finite?', 'yes'], ['Val ROC-AUC', '0.926'], ['Same model without `duration`', '0.785'], ['Val accuracy', '0.908 (majority 0.883)'], ['Predictions', 'well spread, 0.00 to 0.99']],
      t1: [['Gradient profile', 'healthy'], ['Dead units', '2%']],
      t2: [['Overfit 20 rows', 'passes']],
      fixes: ['Drop `duration`: it only exists after the call, when the answer is known', 'Train longer', 'Use gradient boosting instead'], fix: 0,
      why: 'Every internal diagnostic passes. Only the plausibility check fires: +0.14 AUC from one column is far more than a sensible baseline explains. Call length is known only after the call has ended, so the model reads the future. Statistics cannot catch this; knowing when each feature exists can.' },
    { id: 'bad_init', story: 'German Credit, the reference MLP with weights drawn from N(0, 3²).',
      train: curve(40, function (e) { return 20 + 620 * Math.exp(-e / 5); }, 13, 3), val: curve(40, function (e) { return 60 + 700 * Math.exp(-e / 7); }, 14, 6),
      t0: [['Losses finite?', 'yes'], ['First loss', '641.7 (expected ≈ 0.61 for a 30% base rate)'], ['Val ROC-AUC', '0.602'], ['Val accuracy', '0.640 (majority 0.700)'], ['Predictions', '7 distinct, 0.00 to 1.00']],
      t1: [['Gradient norm, first / last layer', '1.2e2 / 3.4e2 (reference ≈ 1e-1)']],
      t2: [['Overfit 20 rows', 'erratic, does not settle']],
      fixes: ['Use the default (or Kaiming) initialisation and retrain', 'Clip gradients at 1.0 and continue', 'Train for 400 epochs'], fix: 0,
      why: 'The first loss is three orders of magnitude above the base-rate entropy, before training could mask anything. Oversized weights create oversized pre-activations and gradients. Clipping would hide the symptom; the cause is the starting scale.' },
    { id: 'vanishing', story: 'A 16-layer plain MLP with sigmoid activations, German Credit, AdamW 1e-3.',
      train: curve(40, function (e) { return 0.61 + 0.02 * Math.exp(-e / 30); }, 15, 0.002), val: curve(40, function (e) { return 0.612 + 0.02 * Math.exp(-e / 30); }, 16, 0.002),
      t0: [['Losses finite?', 'yes'], ['Val ROC-AUC', '0.58'], ['Val accuracy', '0.700 (majority 0.700)'], ['Predictions', 'narrow: 0.27 to 0.33']],
      t1: [['Gradient norm, first / last layer', '2e-10 / 1.1 (ratio 5e9)'], ['Per-layer profile', 'falls by ~4× per layer toward the input']],
      t2: [['Overfit 20 rows', 'fails in 500 steps']],
      fixes: ['Use ReLU with normalisation or residual connections (or fewer layers)', 'Raise the learning rate 100×', 'Add weight decay'], fix: 0,
      why: 'The loss barely moves and the per-layer probe shows the early layers receive a gradient nine orders of magnitude smaller than the last. Sigmoid slopes are at most 0.25, and sixteen of them multiply. The fix is structural: ReLU, LayerNorm/BatchNorm, residual connections, or a shallower network.' },
    { id: 'no_eval', story: 'German Credit, MLP with dropout 0.5, validation computed inside the training loop.',
      train: curve(40, function (e) { return 0.35 + 0.28 * Math.exp(-e / 8); }, 17, 0.006), val: curve(40, function (e) { return 0.5 + 0.1 * Math.exp(-e / 6); }, 18, 0.03),
      t0: [['Losses finite?', 'yes'], ['Val ROC-AUC', 'jumps between 0.70 and 0.75 epoch to epoch'], ['Val accuracy', '0.72 (majority 0.70)'], ['Predictions', 'well spread']],
      t1: [['Gradient profile', 'healthy']],
      t2: [['Evaluate the same model twice', '0.751, then 0.709']],
      fixes: ['Call model.eval() (and torch.no_grad()) before scoring; model.train() when training resumes', 'Lower the learning rate', 'Evaluate on more rows'], fix: 0,
      why: 'Deterministic evaluation of fixed weights on fixed data must give identical numbers. Two different answers mean randomness is still active: dropout in training mode. Scores are noisy and systematically worse than the deployed model would be.' },
    { id: 'broadcast', story: 'A regression MLP (house prices, standardised target), MSELoss, predictions shape (256, 1), targets shape (256,).',
      train: curve(40, function (e) { return 1.0 + 0.4 * Math.exp(-e / 3); }, 19, 0.01), val: curve(40, function (e) { return 1.02 + 0.4 * Math.exp(-e / 3); }, 20, 0.01),
      t0: [['Losses finite?', 'yes'], ['Final loss', '≈ 1.0 ≈ the variance of the target'], ['Predictions', 'all close to the mean target'], ['UserWarning in the log', '"Using a target size different to the input size"']],
      t1: [['Gradient profile', 'healthy'], ['Shape of (preds − targets)', '(256, 256)']],
      t2: [['Overfit 20 rows', 'fails: loss stays near the variance']],
      fixes: ['Make the shapes match (targets.unsqueeze(1) or preds.squeeze(1)) and assert them before the loss', 'Use a larger model', 'Standardise the inputs again'], fix: 0,
      why: 'Every prediction is scored against every target, so the best the model can do is predict the mean: loss ≈ variance, predictions collapsed to the mean. The warning scrolls past in epoch 1. A shape assertion before the loss catches it in the first step.' },
    { id: 'no_zero_grad', story: 'The spiral network from Lesson 1.3, Adam 0.01, but the loop never calls optimizer.zero_grad().',
      train: curve(60, function (e) { return 0.55 + 0.25 * Math.sin(e / 2.3) * Math.exp(-e / 80); }, 21, 0.05), val: curve(60, function (e) { return 0.58 + 0.25 * Math.sin(e / 2.3 + 0.4) * Math.exp(-e / 80); }, 22, 0.05),
      t0: [['Losses finite?', 'yes'], ['Final loss / val accuracy', '0.82 / 0.556'], ['Predictions', 'swing between extremes from epoch to epoch']],
      t1: [['Gradient norm over training', 'grows every step (accumulating)']],
      t2: [['Same run with a 10× smaller learning rate', 'still unstable']],
      fixes: ['Call optimizer.zero_grad() once per step, before backward()', 'Lower the learning rate further', 'Add gradient clipping'], fix: 0,
      why: 'Gradients add up across steps, so the effective step keeps growing: erratic training that no learning-rate change quite fixes. The growing gradient norm is the tell.' },
    { id: 'unscaled', story: 'Telco churn, the Module 1 MLP on raw columns: tenure 0–72, TotalCharges 0–8,672.',
      train: curve(40, function (e) { return 0.52 + 0.08 * Math.exp(-e / 25); }, 23, 0.012), val: curve(40, function (e) { return 0.53 + 0.07 * Math.exp(-e / 25); }, 24, 0.012),
      t0: [['Losses finite?', 'yes'], ['Val ROC-AUC', '0.70 (standardised version: 0.83)'], ['Predictions', 'spread, but driven by one column'], ['Feature ranges', 'tenure 0–72, TotalCharges 0–8,672']],
      t1: [['Gradient share of the TotalCharges weight', '94% of the first layer\'s gradient norm']],
      t2: [['Overfit 20 rows', 'slow and zig-zagging']],
      fixes: ['Standardise the inputs (fit the scaler on training rows only)', 'Raise the learning rate', 'Drop TotalCharges'], fix: 0,
      why: 'A feature measured in thousands dominates every update while features measured in tens are barely moved. Standardising makes the loss surface far better conditioned (Lesson 3.1 §1, Lesson 1.1 §9).' }
  ];
  var COST = { t1: 1, t2: 2 };

  window.DLP.widgets['case-library'] = function (root, props) {
    props = props || {};
    var pool = CASES.filter(function (c) { return !props.cases || props.cases.indexOf(c.id) >= 0; });
    var r = L.rng(Date.now() % 100000), order = pool.map(function (_, i) { return i; });
    function shuffle(a) { for (var k = a.length - 1; k > 0; k--) { var j = Math.floor(r() * (k + 1)), t = a[k]; a[k] = a[j]; a[j] = t; } return a; }
    shuffle(order);
    var at = 0, score = 0, maxScore = 0, solved = 0, streak = 0, state;
    var P = L.palette();

    var head = L.el('div', { class: 'cl-head' }), story = L.el('div', { class: 'cl-story' });
    var evidence = L.el('div', { class: 'cl-evidence' });
    var ask = L.el('div', { class: 'cl-ask' }), msg = L.el('div', { class: 'w-msg' }), nav = L.el('div', { class: 'w-row' });
    var left = L.el('div', { class: 'w-col' });
    root.appendChild(L.el('div', { class: 'w-col' }, [head, story, L.el('div', { class: 'w-grid2' }, [left, evidence]), ask, msg, nav]));
    var cv = L.canvas(left, 0.62, draw, { cls: 'framed', label: 'Training and validation loss curves for this case' });
    left.appendChild(L.legend([{ label: 'training loss', color: L.css('--c0') }, { label: 'validation loss', color: L.css('--c1') }]));

    function current() { return pool[order[at]]; }
    function start() {
      var c = current();
      state = { t1: false, t2: false, diag: null, fix: null, spent: 0, options: shuffle(Object.keys(DIAG).filter(function (k) { return k !== c.id; })).slice(0, 4).concat([c.id]) };
      shuffle(state.options);
      state.fixOrder = shuffle(c.fixes.map(function (_, i) { return i; }));
      paint();
    }
    function rows(list) {
      return '<table class="cl-table">' + list.map(function (x) { return '<tr><th>' + x[0] + '</th><td>' + x[1] + '</td></tr>'; }).join('') + '</table>';
    }
    function tier(key, label, hint) {
      var c = current(), box = L.el('div', { class: 'cl-tier' });
      if (key === 't0' || state[key]) box.innerHTML = '<div class="cl-tier-head">' + label + '</div>' + rows(c[key]);
      else {
        box.innerHTML = '<div class="cl-tier-head">' + label + '</div><p class="muted">' + hint + '</p>';
        var b = L.button(L.icon('eye') + ' Reveal (−' + COST[key] + ' point' + (COST[key] > 1 ? 's' : '') + ')', function () { state[key] = true; state.spent += COST[key]; paint(); });
        b.disabled = state.diag !== null && state.fix !== null;
        box.appendChild(b);
      }
      return box;
    }
    function paint() {
      var c = current();
      head.innerHTML = '<span class="cl-count">Case ' + (at + 1) + ' of ' + pool.length + '</span><span class="cl-score">' + L.icon('target') + ' ' + score + ' / ' + maxScore + ' points' + (streak > 1 ? ' · ' + streak + ' in a row' : '') + '</span>';
      story.innerHTML = '<strong>The run:</strong> ' + c.story;
      evidence.innerHTML = '';
      evidence.appendChild(tier('t0', 'Tier 0 · free', ''));
      evidence.appendChild(tier('t1', 'Tier 1 · look inside', 'Gradient profile and dead units.'));
      evidence.appendChild(tier('t2', 'Tier 2 · run something', 'The 20-row overfit test or a second evaluation.'));
      ask.innerHTML = '';
      var q1 = L.el('div', { class: 'cl-q' }, [L.el('div', { class: 'cl-q-title', text: 'Your diagnosis' })]);
      var opts1 = L.el('div', { class: 'quiz-options' });
      state.options.forEach(function (k) {
        var b = L.el('button', { type: 'button', class: 'opt', html: '<span>' + DIAG[k] + '</span>' });
        if (state.diag !== null) { b.disabled = true; if (k === c.id) b.classList.add('is-correct'); if (k === state.diag && k !== c.id) b.classList.add('is-wrong'); if (k === state.diag) b.classList.add('is-picked'); }
        b.addEventListener('click', function () { if (state.diag !== null) return; state.diag = k; paint(); });
        opts1.appendChild(b);
      });
      q1.appendChild(opts1); ask.appendChild(q1);
      if (state.diag !== null) {
        var q2 = L.el('div', { class: 'cl-q' }, [L.el('div', { class: 'cl-q-title', text: 'The fix you would test first' })]);
        var opts2 = L.el('div', { class: 'quiz-options' });
        state.fixOrder.forEach(function (i) {
          var b = L.el('button', { type: 'button', class: 'opt', html: '<span>' + c.fixes[i] + '</span>' });
          if (state.fix !== null) { b.disabled = true; if (i === c.fix) b.classList.add('is-correct'); if (i === state.fix && i !== c.fix) b.classList.add('is-wrong'); if (i === state.fix) b.classList.add('is-picked'); }
          b.addEventListener('click', function () { if (state.fix !== null) return; state.fix = i; finish(); });
          opts2.appendChild(b);
        });
        q2.appendChild(opts2); ask.appendChild(q2);
      }
      nav.innerHTML = '';
      if (state.fix !== null) {
        var last = at === pool.length - 1;
        nav.appendChild(L.button(last ? L.icon('refresh') + ' Start a new round' : 'Next case ' + L.icon('arrow-right'), function () {
          if (last) { at = 0; score = 0; maxScore = 0; solved = 0; streak = 0; shuffle(order); } else at++;
          start();
        }, 'primary'));
      }
      if (state.fix === null) {
        msg.className = 'w-msg';
        msg.innerHTML = state.diag === null ? 'Read the curves and the free evidence first. Reveal deeper evidence only if you need it: a correct diagnosis is worth 3 points and the right first fix 2, minus what you spent.' : 'Now choose the change you would test first.';
      }
      draw();
    }
    function finish() {
      var c = current(), okD = state.diag === c.id, okF = state.fix === c.fix;
      var pts = Math.max(0, (okD ? 3 : 0) + (okF ? 2 : 0) - state.spent);
      score += pts; maxScore += 5;
      if (okD && okF) { solved++; streak++; } else streak = 0;
      if (window.DLP.record) {
        var lesson = (document.querySelector('[data-lesson]') || { getAttribute: function () { return ''; } }).getAttribute('data-lesson');
        window.DLP.record.answer('lab:case-library:' + c.id, okD && okF, { kind: 'challenge', lesson: lesson });
        if (at === pool.length - 1) window.DLP.record.challenge('case-library', score, true, { passed: score >= pool.length * 3 });
        if (at === pool.length - 1) root.dispatchEvent(new CustomEvent('dlp:metrics', { bubbles: true, detail: { roundScore: score, maxScore: maxScore, solved: solved, done: true } }));
      }
      msg.className = 'w-msg ' + (okD && okF ? 'good' : okD ? 'warn' : 'bad');
      msg.innerHTML = '<strong>' + (okD ? 'Right diagnosis' : 'Not quite: ' + DIAG[c.id]) + (okF ? ', right first fix.' : okD ? ', but a different first fix.' : '.') + '</strong> +' + pts + ' point' + (pts === 1 ? '' : 's') + (state.spent ? ' (spent ' + state.spent + ' on evidence)' : ' with free evidence only') + '. ' + c.why +
        (at === pool.length - 1 ? '<br><strong>Round complete: ' + score + ' of ' + maxScore + ' points, ' + solved + ' of ' + pool.length + ' cases fully solved.</strong>' : '');
      paint();
    }
    function draw() {
      if (!cv || !state) return;
      P = L.palette();
      var c = current();
      L.lineChart(cv.ctx, cv.w, cv.h, [{ name: 'train', color: P.c0, values: c.train }, { name: 'val', color: P.c1, values: c.val }], { xlabel: 'epoch', xoffset: 1 });
    }
    L.onTheme(draw);
    start();
  };
})();
