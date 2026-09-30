/* Lab challenges: a goal attached to a lab in the enrichment file (see README). Labs report what they just
   measured with   root.dispatchEvent(new CustomEvent('dlp:metrics', { bubbles: true, detail: { … } }))
   and this script checks those numbers against the challenge's `require` list. A pass is saved in the learning
   record; the best result is sent (anonymously) to the course API, which answers with the share of earlier
   results it beats. "Share" copies a sentence and a link, or opens the device's share sheet. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var R = window.DLP.record, store = window.DLP.store;
  var cfgEl = document.getElementById('dlp-services'), SVC = {};
  try { SVC = JSON.parse(cfgEl ? cfgEl.textContent : '{}'); } catch (e) {}
  var API = (SVC.api || '').replace(/\/$/, '');
  var LESSON = ($('[data-lesson]') || { getAttribute: function () { return ''; } }).getAttribute('data-lesson');
  var OPS = {
    '>=': function (a, b) { return a >= b; }, '<=': function (a, b) { return a <= b; }, '>': function (a, b) { return a > b; },
    '<': function (a, b) { return a < b; }, '==': function (a, b) { return a === b; }, '!=': function (a, b) { return a !== b; }
  };
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function fmt(v, spec) { return typeof v === 'number' ? (spec.digits ? v.toFixed(spec.digits) : String(Math.round(v * 1000) / 1000)) : String(v); }
  function fill(template, m) {
    return template.replace(/\{(\w+)(%?)\}/g, function (_, k, pct) { var v = m[k]; return v == null ? '' : pct ? (v * 100).toFixed(1) + '%' : typeof v === 'number' ? String(Math.round(v * 1000) / 1000) : String(v); });
  }

  $$('[data-lab-challenge]').forEach(function (box) {
    var spec; try { spec = JSON.parse(box.getAttribute('data-lab-challenge')); } catch (e) { return; }
    var fig = box.closest('[data-widget]'), stateEl = $('[data-lch-state]', box), result = $('[data-lch-result]', box);
    var higher = spec.better !== 'lower', saved = R.challengeOf(spec.id), lastMetrics = store.get('lch:' + spec.id, null);
    function better(a, b) { return b == null || (higher ? a > b : a < b); }
    // "not yet" hints wait until the learner has actually used the lab
    var touched = false;
    ['pointerdown', 'keydown', 'input'].forEach(function (t) { fig.addEventListener(t, function () { touched = true; }, true); });
    function paintState() {
      var c = R.challengeOf(spec.id);
      stateEl.innerHTML = c && c.passed ? '<svg class="ic"><use href="#i-check"/></svg> Passed' + (spec.score && c.best != null ? ' · best ' + esc(fmt(c.best, spec)) + (spec.unit ? ' ' + esc(spec.unit) : '') : '') : 'Not passed yet';
      box.classList.toggle('is-passed', !!(c && c.passed));
    }
    function share(m) {
      var text = (spec.share ? fill(spec.share, m) : 'I passed the "' + spec.title + '" challenge') + ' in Deep Learning Lab.';
      var url = location.origin + location.pathname + '#' + (fig.closest('[data-section]') || { id: '' }).id;
      if (navigator.share) { navigator.share({ title: spec.title, text: text, url: url }).catch(function () {}); return; }
      if (navigator.clipboard) navigator.clipboard.writeText(text + ' ' + url);
      var b = $('[data-lch-share]', result); if (b) b.innerHTML = '<svg class="ic"><use href="#i-check"/></svg> Copied';
    }
    function showResult(m, passed, improved, rank) {
      result.hidden = false;
      var score = spec.score ? m[spec.score] : null;
      result.className = 'lch-result ' + (passed ? 'good' : '');
      result.innerHTML = passed
        ? '<strong>' + (improved ? 'Challenge passed' + (score != null && saved && saved.best != null ? ': a new best' : '') : 'Passed again') + '.</strong> ' +
          (score != null ? 'Your result: <strong>' + esc(fmt(score, spec)) + (spec.unit ? ' ' + esc(spec.unit) : '') + '</strong>. ' : '') +
          (rank ? rank + ' ' : '') + '<button class="chip-btn" data-lch-share><svg class="ic"><use href="#i-share"/></svg> Share</button>'
        : 'Not yet: ' + spec.require.filter(function (r) { return !(OPS[r[1]] || OPS['=='])(m[r[0]], r[2]); }).map(function (r) { return esc(r[3] || (r[0] + ' ' + r[1] + ' ' + r[2])); }).join('; ') + '.';
      var sb = $('[data-lch-share]', result); if (sb) sb.addEventListener('click', function () { share(m); });
    }
    fig.addEventListener('dlp:metrics', function (e) {
      var m = e.detail || {};
      var passed = spec.require.every(function (r) { var op = OPS[r[1]] || OPS['==']; return m[r[0]] !== undefined && op(m[r[0]], r[2]); });
      var relevant = spec.require.some(function (r) { return m[r[0]] !== undefined; });
      if (!relevant) return;
      if (!passed) { if (touched && !(R.challengeOf(spec.id) || {}).passed) showResult(m, false); return; }
      var score = spec.score ? m[spec.score] : 1, prev = R.challengeOf(spec.id), improved = !prev || !prev.passed || better(score, prev.best);
      saved = prev;
      R.challenge(spec.id, score, higher, { passed: true });
      store.set('lch:' + spec.id, m);
      paintState();
      if (!improved) { showResult(m, true, false, ''); return; }
      if (window.DLP.confetti) window.DLP.confetti(stateEl);
      showResult(m, true, true, API ? '<span class="lch-rank">Comparing with other learners…</span>' : '');
      if (!API) return;
      fetch(API + '/api/challenge', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: spec.id, value: score, better: spec.better }) })
        .then(function (r) { return r.json(); })
        .then(function (res) {
          var rank = res.n ? 'Better than <strong>' + Math.round(res.beat * 100) + '%</strong> of ' + res.n + ' earlier result' + (res.n === 1 ? '' : 's') + '.' : 'You are the first to post a result.';
          showResult(m, true, true, rank);
        }).catch(function () { showResult(m, true, true, ''); });
    });
    paintState();
    if (saved && saved.passed && lastMetrics) showResult(lastMetrics, true, false, '');
  });
})();
