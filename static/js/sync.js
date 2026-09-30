/* Sync across devices, anonymous answer counts, and verifiable certificates, through the course API
   (tutor-proxy/api.js, configured in course.yaml → services.api).

   Sync is off until the learner turns it on. Then their learning record, reading progress and notes are
   kept under a private 20-character code; entering that code (or opening the link) on another device
   merges the two, newest answer winning, so nothing is lost on either side. The tutor key is never synced.

   Anonymous counts send only a question id and whether the answer was right: no name, code or device id.
   They can be switched off on the My progress page, and are off by default when the browser sends
   "Do Not Track". Loaded on every page, after progress.js. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var cfgEl = document.getElementById('dlp-services');
  var CFG = {}; try { CFG = JSON.parse(cfgEl ? cfgEl.textContent : '{}'); } catch (e) {}
  var API = (CFG.api || '').replace(/\/$/, '');
  var R = window.DLP.record, store = window.DLP.store, ROOT = document.body.getAttribute('data-root') || '';
  if (!API || !R) return;
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function icon(n) { return '<svg class="ic"><use href="#i-' + n + '"/></svg>'; }
  function api(method, path, body, opts) {
    return fetch(API + '/api/' + path, Object.assign({ method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined }, opts || {}))
      .then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error((j.error && j.error.message) || ('HTTP ' + r.status)); return j; }); });
  }

  /* ------------------------------------------------------------ anonymous answer counts */
  // a local preview (make serve, or the files opened from disk) doesn't count unless switched on, so testing leaves the real counts alone
  var LOCAL = location.protocol === 'file:' || /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  var statsOn = store.get('stats:on', !LOCAL && navigator.doNotTrack !== '1' && CFG.anonymous_stats !== false);
  var queue = [], flushTimer = null;
  function enqueue(ev) {
    if (!statsOn) return;
    queue.push(ev);
    clearTimeout(flushTimer); flushTimer = setTimeout(flush, 15000);
    if (queue.length >= 40) flush();
  }
  function flush(beacon) {
    if (!queue.length) return;
    var body = JSON.stringify({ events: queue.splice(0, 200) });
    if (beacon && navigator.sendBeacon) { navigator.sendBeacon(API + '/api/stats', new Blob([body], { type: 'text/plain' })); return; }
    fetch(API + '/api/stats', { method: 'POST', headers: { 'Content-Type': 'text/plain' }, body: body, keepalive: true }).catch(function () {});
  }
  document.addEventListener('dlp:record', function (e) {
    var d = e.detail || {};
    if (d.type === 'answer' && d.kind !== 'review' && d.kind !== 'practice') enqueue({ q: d.qid, ok: !!d.ok });
    else if (d.type === 'explain') enqueue({ q: d.id, ok: d.verdict === 'solid' });
    else if (d.type === 'lab') enqueue({ q: 'lab:' + d.lesson + '|' + d.name, ok: true });
    if (d.type !== 'replace') schedulePush();
  });
  addEventListener('pagehide', function () { flush(true); pushNow(true); });
  document.addEventListener('visibilitychange', function () { if (document.visibilityState === 'hidden') { flush(true); pushNow(true); } });

  /* ------------------------------------------------------------ sync */
  var code = store.get('sync:code', ''), pushTimer = null, busy = false, lastSync = store.get('sync:last', 0), dirty = false;
  function fmtCode(c) { return c.replace(/(.{4})(?!$)/g, '$1-'); }
  function localNotes() {
    var out = {};
    try { for (var i = 0; i < localStorage.length; i++) { var k = localStorage.key(i); if (/^dlp:(note|code):/.test(k)) out[k] = localStorage.getItem(k); } } catch (e) {}
    return out;
  }
  function snapshot() {
    return { v: 1, rec: R.get(), progress: store.get('progress', {}), notes: localNotes(), cert: store.get('cert:name', ''), goalT: R.get().t, t: Date.now() };
  }
  function newer(x, y) { return !x || ((y && y.t) || 0) > ((x && x.t) || 0) ? y : x; }
  function mergeRec(a, b) {
    if (!b || b.v !== 1) return a; if (!a || a.v !== 1) return b;
    var out = R.blank();
    ['answers', 'explain', 'review'].forEach(function (k) {
      out[k] = Object.assign({}, a[k]);
      Object.keys(b[k] || {}).forEach(function (id) { out[k][id] = newer(out[k][id], b[k][id]); });
    });
    out.labs = Object.assign({}, b.labs || {}, a.labs || {});
    out.days = Object.assign({}, a.days || {});
    Object.keys(b.days || {}).forEach(function (d) { out.days[d] = Math.max(out.days[d] || 0, b.days[d]); });
    out.challenges = Object.assign({}, a.challenges || {});
    Object.keys(b.challenges || {}).forEach(function (id) {
      var x = out.challenges[id] || {}, y = b.challenges[id];
      out.challenges[id] = { best: Math.max(x.best == null ? -1 : x.best, y.best == null ? -1 : y.best), passed: !!(x.passed || y.passed), t: Math.max(x.t || 0, y.t || 0) };
      if (out.challenges[id].best < 0) out.challenges[id].best = null;
    });
    out.goal = (a.t || 0) >= (b.t || 0) ? a.goal : b.goal;
    out.t = Math.max(a.t || 0, b.t || 0);
    return out;
  }
  function mergeProgress(a, b) {
    var out = Object.assign({}, a);
    Object.keys(b || {}).forEach(function (id) {
      var x = out[id] || {}, y = b[id] || {}, read = {};
      (x.read || []).concat(y.read || []).forEach(function (s) { read[s] = 1; });
      out[id] = { read: Object.keys(read), pct: Math.max(x.pct || 0, y.pct || 0), done: !!(x.done || y.done) };
    });
    return out;
  }
  function apply(remote) {
    if (!remote || remote.v !== 1) return;
    var merged = mergeRec(R.get(), remote.rec);
    R.replace(merged);
    store.set('progress', mergeProgress(store.get('progress', {}), remote.progress));
    Object.keys(remote.notes || {}).forEach(function (k) {
      if (!/^dlp:(note|code):/.test(k)) return;
      try { if (!localStorage.getItem(k)) localStorage.setItem(k, remote.notes[k]); } catch (e) {}
    });
    if (!store.get('cert:name', '') && remote.cert) store.set('cert:name', remote.cert);
  }
  function pullMergePush() {
    if (!code || busy) return Promise.resolve();
    busy = true; paintPanel('Syncing…');
    return api('GET', 'sync/' + code).then(function (res) { apply(res.data); return api('PUT', 'sync/' + code, { data: snapshot() }); })
      .then(function () { lastSync = Date.now(); store.set('sync:last', lastSync); dirty = false; busy = false; paintPanel(); })
      .catch(function (err) { busy = false; paintPanel('Could not sync: ' + err.message); });
  }
  function schedulePush() { if (!code) return; dirty = true; clearTimeout(pushTimer); pushTimer = setTimeout(pushNow, 5000); }
  function pushNow(leaving) {
    if (!code || !dirty) return;
    dirty = false; clearTimeout(pushTimer);
    // on leaving the page, a keepalive request saves without waiting for the merge round-trip
    if (leaving) { try { fetch(API + '/api/sync/' + code, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ data: snapshot() }), keepalive: true }); } catch (e) {} return; }
    pullMergePush();
  }
  function turnOn() {
    return api('POST', 'sync').then(function (res) { code = res.code; store.set('sync:code', code); dirty = true; return pullMergePush(); })
      .catch(function (err) { paintPanel('Could not turn on sync: ' + err.message); });
  }
  function connect(raw) {
    var c = String(raw || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (!/^[ABCDEFGHJKMNPQRSTVWXYZ23456789]{20}$/.test(c)) { paintPanel('That does not look like a sync code: it has 20 letters and digits.'); return Promise.resolve(); }
    code = c; store.set('sync:code', code); dirty = true;
    return pullMergePush();
  }
  window.DLP.sync = { now: pullMergePush, code: function () { return code; } };

  // a link from another device: …/progress.html#sync=CODE
  var m = /[#&]sync=([A-Za-z0-9-]{20,30})/.exec(location.hash);
  if (m) {
    var incoming = m[1].toUpperCase().replace(/-/g, '');
    history.replaceState(null, '', location.pathname + location.search + '#sync');
    if (incoming !== code && confirm('Connect this browser to your synced progress? Your progress here and there will be combined.')) connect(incoming);
  } else if (code && Date.now() - lastSync > 60000) pullMergePush();

  /* ------------------------------------------------------------ the panel on the My progress page */
  function paintPanel(note) {
    var el = $('[data-pg-sync]');
    if (!el) return;
    var link = (location.origin + location.pathname).replace(/[^/]*$/, '') + 'progress.html#sync=' + code;
    el.innerHTML = '<h2>' + icon('sync') + ' Sync across devices</h2>' +
      (code ? '<div class="sy-card on"><p><strong>Sync is on.</strong> This browser saves your answers, reading progress and notes under your private code' +
          (lastSync ? ' (last synced ' + new Date(lastSync).toLocaleString() + ')' : '') + '.</p>' +
          '<div class="sy-code" aria-label="Your sync code">' + esc(fmtCode(code)) + '</div>' +
          '<div class="sy-actions"><button class="btn btn-sm" data-sy-copy-link>' + icon('link') + ' Copy link for another device</button><button class="chip-btn" data-sy-copy>' + icon('copy') + ' Copy code</button>' +
          '<button class="chip-btn" data-sy-now>' + icon('refresh') + ' Sync now</button><button class="chip-btn" data-sy-off>Turn off on this browser</button></div>' +
          '<p class="muted sy-small">Keep the code private: anyone who has it can see and change this progress. To stop syncing everywhere, turn it off on each device.</p></div>'
        : '<div class="sy-card"><p>Your progress lives in this browser. Turn on sync to keep it under a private code that you can use on your phone, another computer, or after clearing this browser. No account, no email.</p>' +
          '<div class="sy-actions"><button class="btn btn-sm" data-sy-on>' + icon('sync') + ' Turn on sync</button></div>' +
          '<div class="sy-connect"><label for="sy-code-in">Already have a code from another device?</label><input id="sy-code-in" data-sy-in placeholder="XXXX-XXXX-XXXX-XXXX-XXXX" autocomplete="off" spellcheck="false"><button class="chip-btn" data-sy-connect>Connect</button></div></div>') +
      (note ? '<p class="sy-note" role="status">' + esc(note) + '</p>' : '') +
      '<label class="sy-stats"><input type="checkbox" data-sy-stats' + (statsOn ? ' checked' : '') + '> Share anonymous answer counts to help improve the course. Only a question id and right or wrong are sent: no name, code or device id.</label>';
    var on = $('[data-sy-on]', el); if (on) on.addEventListener('click', turnOn);
    var cn = $('[data-sy-connect]', el); if (cn) cn.addEventListener('click', function () { connect($('[data-sy-in]', el).value); });
    var cp = $('[data-sy-copy]', el); if (cp) cp.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(fmtCode(code)); cp.innerHTML = icon('check') + ' Copied'; });
    var cl = $('[data-sy-copy-link]', el); if (cl) cl.addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(link); cl.innerHTML = icon('check') + ' Link copied'; });
    var nw = $('[data-sy-now]', el); if (nw) nw.addEventListener('click', function () { dirty = true; pullMergePush(); });
    var off = $('[data-sy-off]', el); if (off) off.addEventListener('click', function () {
      if (!confirm('Stop syncing this browser? Your progress stays here, and stays saved under the code for your other devices.')) return;
      code = ''; store.set('sync:code', ''); paintPanel('Sync is off on this browser.');
    });
    $('[data-sy-stats]', el).addEventListener('change', function (e) { statsOn = e.target.checked; store.set('stats:on', statsOn); if (!statsOn) queue = []; });
  }
  paintPanel();

  /* ------------------------------------------------------------ verifiable certificates */
  document.addEventListener('dlp:cert-ready', function (e) {
    var btn = $('[data-cert-issue]'), share = $('[data-cert-share]'), cert = window.DLP.certificate;
    if (!btn || !e.detail.modules.length) return;
    btn.hidden = false;
    var issued = store.get('cert:issued', null);
    function showLink(id) {
      var url = (location.origin + location.pathname) + '?id=' + id;
      share.hidden = false;
      share.innerHTML = icon('check') + ' <strong>Verifiable link:</strong> <a href="' + esc(url) + '">' + esc(url) + '</a> <button class="chip-btn" data-cert-copy>' + icon('copy') + ' Copy</button>';
      $('[data-cert-copy]', share).addEventListener('click', function () { navigator.clipboard && navigator.clipboard.writeText(url); });
      cert.setVerified({ id: id });
    }
    var d = e.detail, key = JSON.stringify([d.name, d.modules.map(function (m) { return m.number; })]);
    if (issued && issued.key === key) showLink(issued.id);
    btn.addEventListener('click', function () {
      var data = cert.data();
      if (!data.name) { $('[data-cert-name]').focus(); share.hidden = false; share.textContent = 'Add your name first: it is printed on the certificate.'; return; }
      btn.disabled = true;
      api('POST', 'cert', data).then(function (res) {
        store.set('cert:issued', { id: res.id, key: JSON.stringify([data.name, data.modules.map(function (m) { return m.number; })]) });
        showLink(res.id); btn.disabled = false;
      }).catch(function (err) { btn.disabled = false; share.hidden = false; share.textContent = 'Could not record the certificate: ' + err.message; });
    });
  });
  document.addEventListener('dlp:cert-view', function (e) {
    var lead = $('[data-cert-lead]');
    api('GET', 'cert/' + encodeURIComponent(e.detail.id)).then(function (res) {
      var r = res.record;
      window.DLP.certificate.setData({ name: r.name, modules: r.modules, lessons: r.lessons, correct: r.correct, date: r.date });
      window.DLP.certificate.setVerified({ id: res.id });
      lead.innerHTML = icon('check') + ' <strong>Verified.</strong> This certificate was issued by ' + esc(document.title.split(' — ').pop()) + ' on ' + esc(r.issued) + ' to ' + esc(r.name) + '.';
    }).catch(function (err) { lead.textContent = 'This certificate could not be verified: ' + err.message; });
  });
})();
