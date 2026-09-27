/* Predict Rounds — commit to a prediction, then see the lesson's real result, one round at a time.
   Rounds come from the lesson's enrichment file (props.rounds), so any lesson can use it:
     { q: "question (markdown-free HTML allowed)", options: [...], answer: 1,
       reveal: "what actually happened and why",
       bars: [["Gradient boosting", 0.8160], ["Neural network", 0.8016]],   // optional result bars
       lo: 0.75, hi: 0.85, digits: 4 }                                        // optional bar scale
   props.title_done: text shown with the final score. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  window.DLP.widgets['predict-rounds'] = function (root, props) {
    var rounds = (props && props.rounds) || [], at = 0, picks = [], P = L.palette();
    var head = L.el('div', { class: 'cl-head' }), q = L.el('div', { class: 'pr-q' }), opts = L.el('div', { class: 'quiz-options' });
    var reveal = L.el('div', { class: 'w-msg' }), holder = L.el('div'), nav = L.el('div', { class: 'w-row' });
    var dots = L.el('div', { class: 'pr-dots', 'aria-hidden': 'true' });
    root.appendChild(L.el('div', { class: 'w-col' }, [head, dots, q, opts, holder, reveal, nav]));
    var cv = L.canvas(holder, 0.2, draw, { cls: 'framed', label: 'The real result of this round' });
    var lessonId = (document.querySelector('[data-lesson]') || { getAttribute: function () { return ''; } }).getAttribute('data-lesson');
    var widgetKey = (props && props.key) || 'predict-rounds';

    function score() { return picks.filter(function (p, i) { return p === rounds[i].answer; }).length; }
    function paint() {
      var r = rounds[at], picked = picks[at];
      head.innerHTML = '<span class="cl-count">Round ' + (at + 1) + ' of ' + rounds.length + '</span><span class="cl-score">' + L.icon('target') + ' ' + score() + ' right so far</span>';
      dots.innerHTML = rounds.map(function (_, i) { var p = picks[i]; return '<i class="' + (i === at ? 'is-now ' : '') + (p == null ? '' : p === rounds[i].answer ? 'is-right' : 'is-wrong') + '"></i>'; }).join('');
      q.innerHTML = r.q;
      opts.innerHTML = '';
      r.options.forEach(function (o, i) {
        var b = L.el('button', { type: 'button', class: 'opt', html: '<span class="opt-letter">' + 'ABCDEF'[i] + '</span><span>' + o + '</span>' });
        if (picked != null) { b.disabled = true; if (i === r.answer) b.classList.add('is-correct'); if (i === picked) b.classList.add('is-picked'); if (i === picked && i !== r.answer) b.classList.add('is-wrong'); }
        b.addEventListener('click', function () {
          if (picks[at] != null) return;
          picks[at] = i;
          if (window.DLP.record) window.DLP.record.answer('lab:' + widgetKey + ':' + (at + 1), i === r.answer, { kind: 'challenge', lesson: lessonId });
          if (at === rounds.length - 1 && window.DLP.record) window.DLP.record.challenge(widgetKey, score(), true, { passed: score() >= Math.ceil(rounds.length * 0.7) });
          paint();
        });
        opts.appendChild(b);
      });
      holder.hidden = picked == null || !r.bars;
      reveal.hidden = picked == null;
      if (picked != null) {
        reveal.className = 'w-msg ' + (picked === r.answer ? 'good' : 'warn');
        reveal.innerHTML = '<strong>' + (picked === r.answer ? 'Right.' : 'The result: ' + r.options[r.answer] + '.') + '</strong> ' + r.reveal +
          (at === rounds.length - 1 ? '<br><strong>You predicted ' + score() + ' of ' + rounds.length + ' correctly.</strong> ' + ((props && props.title_done) || '') : '');
      }
      nav.innerHTML = '';
      if (at > 0) nav.appendChild(L.button(L.icon('arrow-left') + ' Back', function () { at--; paint(); }));
      if (picked != null && at < rounds.length - 1) nav.appendChild(L.button('Next round ' + L.icon('arrow-right'), function () { at++; paint(); }, 'primary'));
      if (picked != null && at === rounds.length - 1) nav.appendChild(L.button(L.icon('refresh') + ' Play again', function () { picks = []; at = 0; paint(); }));
      draw();
    }
    function draw() {
      var r = rounds[at];
      if (!cv || !r || !r.bars || picks[at] == null) return;
      P = L.palette();
      var ctx = cv.ctx, w = cv.w, n = r.bars.length, h = cv.h, lo = r.lo != null ? r.lo : 0, hi = r.hi != null ? r.hi : Math.max.apply(null, r.bars.map(function (b) { return b[1]; })) * 1.1;
      var X = function (v) { return 170 + (w - 230) * (Math.max(lo, Math.min(hi, v)) - lo) / (hi - lo || 1); };
      ctx.clearRect(0, 0, w, h); ctx.font = '12px Inter, system-ui, sans-serif';
      var colors = [P.c0, P.c1, P.c2, P.c3];
      r.bars.forEach(function (b, i) {
        var bh = Math.min(22, (h - 16) / n - 6), y = 8 + i * (bh + 6);
        ctx.fillStyle = P.ink2; ctx.textAlign = 'right'; ctx.fillText(b[0], 160, y + bh / 2 + 4);
        ctx.fillStyle = P.surface2; ctx.fillRect(X(lo), y, X(hi) - X(lo), bh);
        ctx.fillStyle = colors[i % 4]; ctx.fillRect(X(lo), y, Math.max(2, X(b[1]) - X(lo)), bh);
        ctx.fillStyle = P.ink; ctx.textAlign = 'left'; ctx.fillText(b[2] || b[1].toFixed(r.digits != null ? r.digits : 3), X(b[1]) + 6, y + bh / 2 + 4);
      });
      ctx.textAlign = 'left';
    }
    L.onTheme(draw);
    if (rounds.length) paint(); else root.textContent = 'No rounds configured.';
  };
})();
