/* Lesson discussion with giscus (GitHub Discussions). Nothing is loaded from giscus.app until the learner
   presses "Show the discussion"; after that, later lessons open it automatically when scrolled to.
   The giscus theme follows the site's light/dark mode. */
(function () {
  'use strict';
  var box = document.querySelector('[data-discussion]');
  if (!box) return;
  var store = window.DLP.store, btn = box.querySelector('[data-disc-load]'), frame = box.querySelector('[data-disc-frame]'), loaded = false;
  function theme() { return (window.DLP.theme && window.DLP.theme() === 'dark') ? 'dark' : 'light'; }
  function load() {
    if (loaded) return;
    loaded = true; btn.hidden = true; box.querySelector('[data-disc-note]').hidden = true;
    store.set('disc:auto', true);
    var s = document.createElement('script');
    s.src = 'https://giscus.app/client.js';
    var attrs = { repo: box.dataset.repo, 'repo-id': box.dataset.repoId, category: box.dataset.category, 'category-id': box.dataset.categoryId,
      mapping: 'specific', term: box.dataset.term, strict: '1', 'reactions-enabled': '1', 'emit-metadata': '0', 'input-position': 'top',
      theme: theme(), lang: 'en', loading: 'lazy' };
    Object.keys(attrs).forEach(function (k) { s.setAttribute('data-' + k, attrs[k]); });
    s.crossOrigin = 'anonymous'; s.async = true;
    frame.appendChild(s);
  }
  btn.addEventListener('click', load);
  if (store.get('disc:auto', false) && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (en) { if (en[0].isIntersecting) { io.disconnect(); load(); } }, { rootMargin: '600px 0px' });
    io.observe(box);
  }
  if (location.hash === '#discussion') load();
  document.addEventListener('dlp:theme', function () {
    var f = frame.querySelector('iframe.giscus-frame');
    if (f) f.contentWindow.postMessage({ giscus: { setConfig: { theme: theme() } } }, 'https://giscus.app');
  });
})();
