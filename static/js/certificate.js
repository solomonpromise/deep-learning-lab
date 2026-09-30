/* The certificate, drawn on a canvas so the screen, the printout and the downloaded image are identical.
   It lists the modules whose challenge the learner has passed (from the learning record). With the course
   sync service configured (course.yaml → sync.endpoint), "Get a verifiable link" records the certificate
   on the server and returns an id; certificate.html?id=… then shows the server's copy to anyone. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var page = $('[data-cert-page]');
  if (!page) return;
  var store = window.DLP.store, M = window.DLP.mastery, R = window.DLP.record;
  var canvas = $('[data-cert-canvas]'), ctx = canvas.getContext('2d'), W = 1600, H = 1131;
  canvas.width = W; canvas.height = H;
  var COURSE = page.getAttribute('data-course'), BRAND = page.getAttribute('data-brand'), SITE = page.getAttribute('data-site');
  var data = null, verified = null;
  var params = new URLSearchParams(location.search), viewId = params.get('id');

  function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }
  function fitText(text, maxW, size, weight, family) {
    var s = size; do { ctx.font = weight + ' ' + s + 'px ' + family; s -= 2; } while (ctx.measureText(text).width > maxW && s > 20);
  }
  function logo(x, y, size) {
    ctx.fillStyle = '#2a78d6'; roundRect(x, y, size, size, size / 4); ctx.fill();
    var s = size / 32, n = [[7, 9], [7, 23], [16, 16], [25, 9], [25, 23]];
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.8 * s;
    [[0, 2], [1, 2], [2, 3], [2, 4]].forEach(function (e) { ctx.beginPath(); ctx.moveTo(x + n[e[0]][0] * s, y + n[e[0]][1] * s); ctx.lineTo(x + n[e[1]][0] * s, y + n[e[1]][1] * s); ctx.stroke(); });
    ctx.fillStyle = '#fff'; n.forEach(function (p, i) { ctx.beginPath(); ctx.arc(x + p[0] * s, y + p[1] * s, (i === 2 ? 3.4 : 3) * s, 0, 7); ctx.fill(); });
  }
  function draw() {
    var serif = 'Georgia, "Times New Roman", serif', sans = 'Inter, system-ui, -apple-system, sans-serif';
    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = '#fbfaf6'; ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = '#1c2a3f'; ctx.lineWidth = 6; ctx.strokeRect(40, 40, W - 80, H - 80);
    ctx.strokeStyle = '#b9a36a'; ctx.lineWidth = 2; ctx.strokeRect(62, 62, W - 124, H - 124);
    logo(W / 2 - 34, 110, 68);
    ctx.textAlign = 'center'; ctx.fillStyle = '#6b6a63'; ctx.font = '600 22px ' + sans; ctx.fillText(BRAND.toUpperCase(), W / 2, 214);
    ctx.fillStyle = '#1c2a3f'; ctx.font = '400 64px ' + serif; ctx.fillText('Certificate of Achievement', W / 2, 300);
    ctx.fillStyle = '#45443f'; ctx.font = '400 26px ' + serif; ctx.fillText('This certifies that', W / 2, 368);
    var name = (data && data.name) || 'Your name';
    fitText(name, W - 360, 72, 'italic 400', serif); ctx.fillStyle = data && data.name ? '#111' : '#b5b2a8'; ctx.fillText(name, W / 2, 458);
    ctx.strokeStyle = '#b9a36a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(W / 2 - 360, 482); ctx.lineTo(W / 2 + 360, 482); ctx.stroke();
    ctx.fillStyle = '#45443f'; ctx.font = '400 26px ' + serif;
    ctx.fillText('has passed the module challenges below in the course', W / 2, 540);
    fitText(COURSE, W - 300, 38, '700', sans); ctx.fillStyle = '#1c2a3f'; ctx.fillText(COURSE, W / 2, 592);
    var mods = (data && data.modules) || [], y = 660, colW = 640, gap = 40, x0 = W / 2 - colW - gap / 2;
    ctx.textAlign = 'left';
    mods.forEach(function (m, i) {
      var cx = mods.length === 1 ? W / 2 - colW / 2 : x0 + (i % 2) * (colW + gap), cy = y + Math.floor(i / 2) * 76;
      ctx.fillStyle = '#ffffff'; roundRect(cx, cy, colW, 60, 12); ctx.fill(); ctx.strokeStyle = '#e4e2da'; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = m.color || '#2a78d6'; ctx.beginPath(); ctx.arc(cx + 34, cy + 30, 18, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.font = '700 18px ' + sans; ctx.textAlign = 'center'; ctx.fillText(String(m.number), cx + 34, cy + 36);
      ctx.textAlign = 'left'; ctx.fillStyle = '#111'; fitText('Module ' + m.number + ' · ' + m.title, colW - 90, 22, '600', sans); ctx.fillText('Module ' + m.number + ' · ' + m.title, cx + 66, cy + 38);
    });
    if (!mods.length) { ctx.textAlign = 'center'; ctx.fillStyle = '#b5b2a8'; ctx.font = 'italic 24px ' + serif; ctx.fillText('No module challenges passed yet', W / 2, y + 36); }
    ctx.textAlign = 'center'; ctx.fillStyle = '#6b6a63'; ctx.font = '400 20px ' + sans;
    var sub = data ? data.lessons + ' lesson' + (data.lessons === 1 ? '' : 's') + ' mastered · ' + data.correct + ' checkpoint and quiz questions answered correctly' : '';
    ctx.fillText(sub, W / 2, H - 200);
    ctx.textAlign = 'left'; ctx.fillStyle = '#45443f'; ctx.font = '400 20px ' + sans;
    ctx.fillText('Issued ' + ((data && data.date) || ''), 120, H - 120);
    ctx.textAlign = 'right';
    ctx.fillText(verified ? 'Certificate ' + verified.id + ' · verify at ' + SITE.replace(/^https?:\/\//, '') + 'certificate.html?id=' + verified.id : SITE.replace(/^https?:\/\//, '').replace(/\/$/, ''), W - 120, H - 120);
    canvas.setAttribute('aria-label', 'Certificate of Achievement for ' + name + ', ' + COURSE + ': ' + mods.map(function (m) { return 'Module ' + m.number; }).join(', '));
  }
  function local(cb) {
    M.all(function (mods) {
      var passed = mods.filter(function (m) { return m.challenge && m.challenge.passed; });
      var answers = R.get().answers, correct = Object.keys(answers).filter(function (k) { return /^[cq]:/.test(k) && answers[k].ok; }).length;
      var last = passed.reduce(function (t, m) { return Math.max(t, m.challenge.t || 0); }, 0);
      cb({ name: store.get('cert:name', ''), modules: passed.map(function (m) { return { number: m.number, title: m.title, color: m.color }; }),
           lessons: mods.reduce(function (s, m) { return s + m.mastered; }, 0), correct: correct,
           date: new Date(last || Date.now()).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) });
    });
  }
  var nameInput = $('[data-cert-name]');
  nameInput.addEventListener('input', function () { store.set('cert:name', nameInput.value.trim()); if (data) { data.name = nameInput.value.trim(); verified = null; draw(); } });
  $('[data-cert-print]').addEventListener('click', function () { window.print(); });
  $('[data-cert-png]').addEventListener('click', function () {
    canvas.toBlob(function (b) { var a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'certificate-' + ((data && data.name) || 'deep-learning-lab').toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.png'; a.click(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 2000); });
  });
  window.DLP.certificate = { setVerified: function (v) { verified = v; draw(); }, data: function () { return data; }, redraw: draw, setData: function (d) { data = d; draw(); } };

  if (viewId) {
    // someone else's certificate: shown from the server's record by sync.js, not from this browser
    $('[data-cert-controls]').hidden = true;
    $('[data-cert-heading]').textContent = 'Certificate';
    $('[data-cert-lead]').textContent = 'Checking this certificate…';
    draw();
    document.dispatchEvent(new CustomEvent('dlp:cert-view', { detail: { id: viewId } }));
    return;
  }
  local(function (d) {
    data = d; nameInput.value = d.name;
    $('[data-cert-note]').textContent = d.modules.length ? '' : 'Pass a module challenge on any module page to add it here.';
    draw();
    document.dispatchEvent(new CustomEvent('dlp:cert-ready', { detail: d }));
  });
})();
