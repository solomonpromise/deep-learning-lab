/* Section-by-section lessons, with optional distraction-free read mode.
   Existing section hashes, learner records, notebooks, labs and checkpoints stay connected. */
(function () {
  'use strict';
  var $ = function(s,r) { return (r||document).querySelector(s); };
  var $$ = function(s,r) { return Array.from((r||document).querySelectorAll(s)); };
  var lesson=$('[data-lesson]'); if (!lesson) return;
  var LID=lesson.dataset.lesson, store=window.DLP.store;
  var start=$('#start'), big=$('.big-picture'), hero=$('.lesson-hero'), end=$('.lesson-end');
  var pages=[[start,big].filter(Boolean)].concat($$('[data-section]').map(function(s) { return [s]; }));
  var page=0, readMode=!!store.get('focus',false), whole=false;
  var bar=document.createElement('nav'); bar.className='rd-section-nav'; bar.setAttribute('aria-label','Section navigation');
  bar.innerHTML='<button class="btn btn-ghost" type="button" data-flow-prev>Previous section</button><span class="rd-flow-count" data-flow-count></span><button class="btn btn-ghost" type="button" data-flow-complete>Mark section complete</button><button class="btn" type="button" data-flow-next>Next section</button><button class="rd-flow-whole" type="button" data-flow-whole>Show whole lesson</button>';
  end.insertAdjacentElement('beforebegin',bar);
  var toggles=$$('[data-focus-slot]').map(function(slot) { var b=document.createElement('button'); b.type='button'; b.className='btn btn-ghost focus-toggle'; b.setAttribute('aria-keyshortcuts','F'); slot.replaceWith(b); return b; });
  function owner(target) { return pages.findIndex(function(els) { return els.some(function(el) { return el===target || el.contains(target); }); }); }
  function currentSection() { return pages[page][0]; }
  function paint() {
    document.body.classList.toggle('focus-mode',readMode); document.body.classList.toggle('rd-section-view',!whole);
    pages.forEach(function(els,i) { els.forEach(function(el) { el.classList.toggle('focus-hidden',!whole && i!==page); }); });
    if (end) end.classList.toggle('focus-hidden',!whole && page!==pages.length-1);
    $$('[data-discussion], .mastery-panel').forEach(function(el) { el.classList.toggle('focus-hidden',!whole && page!==pages.length-1); });
    $$('[data-toc-link]').forEach(function(a) { var active=a.dataset.tocLink===currentSection().id; a.classList.toggle('focus-current',!whole && active); if(active && !whole)a.setAttribute('aria-current','step');else a.removeAttribute('aria-current'); });
    toggles.forEach(function(b) { b.textContent=readMode?'Leave read mode · F':'Read mode · F'; b.setAttribute('aria-pressed',String(readMode)); });
    $('[data-flow-prev]',bar).disabled=page===0;
    $('[data-flow-next]',bar).disabled=page===pages.length-1;
    $('[data-flow-count]',bar).textContent=page===0?'Before you start':page+' / '+(pages.length-1)+' sections';
    var complete=$('[data-flow-complete]',bar), section=currentSection(); complete.hidden=page===0 || whole;
    var read=((store.get('progress',{})[LID]||{}).read||[]).includes(section.id);
    complete.disabled=read; complete.textContent=read?'Section complete':'Mark section complete';
    $('[data-flow-whole]',bar).textContent=whole?'Return to sections':'Show whole lesson';
    $('[data-flow-count]',bar).hidden=whole; $('[data-flow-prev]',bar).hidden=whole; $('[data-flow-next]',bar).hidden=whole;
    var where=$('[data-lb-where]'); if (where && !whole) where.textContent=page===0?'Before you start':page+' of '+(pages.length-1)+' · '+($('h2',section)||{}).textContent;
    if (window.DLP.revealAround) window.DLP.revealAround();
    if (window.DLP.mountAll) window.DLP.mountAll(whole ? lesson : currentSection());
    window.dispatchEvent(new Event('resize')); window.dispatchEvent(new Event('scroll'));
  }
  function show(i,scroll,target,updateHash) {
    page=Math.max(0,Math.min(pages.length-1,i)); store.set('focus:page:'+LID,page); paint();
    if (updateHash!==false) history.replaceState(null,'','#'+(target||currentSection()).id);
    if (scroll!==false) { var el=target && target!==currentSection() ? target : hero; window.scrollTo({top:Math.max(0,el.getBoundingClientRect().top+window.scrollY-(readMode?24:96)),behavior:'instant'}); }
  }
  window.DLP.lessonNavigation={step:function(delta) { if(whole) { whole=false; } show(page+delta); }};
  $('[data-flow-prev]',bar).addEventListener('click',function() { show(page-1); });
  $('[data-flow-next]',bar).addEventListener('click',function() { show(page+1); });
  $('[data-flow-complete]',bar).addEventListener('click',function() { document.dispatchEvent(new CustomEvent('dlp:section-read',{detail:{id:currentSection().id}})); setTimeout(paint,350); });
  $('[data-flow-whole]',bar).addEventListener('click',function() { whole=!whole; paint(); window.scrollTo({top:hero.getBoundingClientRect().top+window.scrollY-96,behavior:'instant'}); });
  function toggleRead() { readMode=!readMode; store.set('focus',readMode); paint(); }
  toggles.forEach(function(b) { b.addEventListener('click',toggleRead); });
  document.addEventListener('click',function(e) {
    var a=e.target.closest('a[href^="#"]'); if(!a || a.hash.length<2 || e.ctrlKey||e.metaKey||e.shiftKey||e.altKey)return;
    var target=document.getElementById(decodeURIComponent(a.hash.slice(1))); var i=target?owner(target):-1;
    if(i<0 || whole)return; e.preventDefault(); show(i,true,target);
  },true);
  function followHash() { var target=document.getElementById(decodeURIComponent(location.hash.slice(1)));var i=target?owner(target):-1;if(i>=0)show(i,true,target,false); }
  window.addEventListener('hashchange',followHash);
  document.addEventListener('keydown',function(e) {
    var t=document.activeElement||{};if(/INPUT|TEXTAREA|SELECT/.test(t.tagName||'')||t.isContentEditable||e.metaKey||e.ctrlKey)return;
    if(e.key.toLowerCase()==='f'&&!e.altKey&&!e.shiftKey){e.preventDefault();toggleRead();}
    else if(e.key==='Escape'&&readMode&&!$('[data-search-modal]:not([hidden])')&&!$('.tutor-panel:not([hidden])'))toggleRead();
    else if(e.altKey && !whole && (e.key==='ArrowLeft'||e.key==='ArrowRight')){e.preventDefault();e.stopImmediatePropagation();show(page+(e.key==='ArrowRight'?1:-1));}
  },true);
  var target=document.getElementById(decodeURIComponent(location.hash.slice(1))), fromHash=target?owner(target):-1;
  show(fromHash>=0?fromHash:Math.max(0,Math.min(pages.length-1,store.get('focus:page:'+LID,0))),false,null,false);
  if(fromHash>=0)requestAnimationFrame(function(){show(fromHash,true,target,false);});
})();
