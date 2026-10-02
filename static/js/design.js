/* Approved design interactions. Uses the real learner record; no prototype sample state. */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.from((r || document).querySelectorAll(s)); };
  var homeReturn = $('[data-home-return]');
  if (homeReturn && window.DLP.record) homeReturn.hidden = !Object.keys(window.DLP.record.days()).length && !window.DLP.store.get('last', null);
  var diagram = $('[data-representation]');
  if (!diagram) return;
  var object = 'mug', layer = 0;
  var objects = {
    mug: { name: 'Mug', path: '<path d="M23 25H66V69Q44 86 23 69Z"/><path d="M66 31H77Q91 49 77 60H66" fill="none"/><path d="M33 17Q26 10 34 3M49 17Q42 10 50 3" fill="none"/>', parts: 'a curved handle and a vessel', shape: '<path d="M10 7H29V31Q20 38 10 31Z"/><path d="M29 12H35Q43 21 35 28H29" fill="none"/>' },
    shoe: { name: 'Shoe', path: '<path d="M11 54 23 28 41 35 46 46 77 55Q89 57 89 72H10Z"/><path d="M11 66H87M32 37 43 42M29 43 45 49M25 50 40 55" fill="none"/>', parts: 'a sole and a raised heel', shape: '<path d="M5 25 12 9 22 13 25 19 37 26 39 34H4Z"/><path d="M5 29H37" fill="none"/>' },
    leaf: { name: 'Leaf', path: '<path d="M21 76Q3 15 78 8Q91 72 21 76Z"/><path d="M14 88 72 17M34 61 26 35M46 48 70 49M55 37 52 21" fill="none"/>', parts: 'a pointed outline and branching veins', shape: '<path d="M9 34Q1 6 35 4Q39 33 9 34Z"/><path d="M6 40 32 8" fill="none"/>' }
  };
  var titles = ['Start with the pixels.', 'Early layers find local patterns.', 'Deeper layers combine the patterns.', 'A representation becomes a prediction.'];
  function tile(x,y,content,active,scale) {
    return '<g transform="translate('+x+' '+y+')"><rect width="46" height="46" rx="2" fill="var(--surface)" stroke="'+(active?'var(--accent)':'var(--line-2)')+'"/><g transform="translate(3 3) scale('+(scale || 1)+')" fill="none" stroke="'+(active?'var(--accent)':'var(--ink-3)')+'" stroke-width="1.8">'+content+'</g></g>';
  }
  function paint() {
    var o = objects[object], edges = '', channels = '';
    var xs = [165,280,390], ys = [[80,144,208],[97,165,233],[91,135,179,223]];
    for (var stage=0; stage<2; stage++) ys[stage].forEach(function(y) { ys[stage+1].forEach(function(yy) { edges += '<path d="M'+(xs[stage]+(stage?46:46))+' '+(y+23)+'C'+(xs[stage]+74)+' '+(y+23)+' '+(xs[stage+1]-27)+' '+(yy+23)+' '+xs[stage+1]+' '+(yy+23)+'"/>'; }); });
    ys[0].forEach(function(y,i) { channels += tile(165,y, ['<path d="M7 32 15 10H33"/>','<path d="M12 6Q37 7 33 23Q29 36 7 33"/>','<path d="M5 28 34 10M9 34 36 15"/>'][i], layer===1); });
    ys[1].forEach(function(y,i) { channels += tile(280,y, i===0?o.shape:i===1?'<path d="M8 10Q30 3 32 20Q28 33 8 29Z"/>':'<path d="M6 30H35M9 8V29M16 13 30 17"/>', layer===2); });
    ys[2].forEach(function(y,i) { channels += '<circle cx="403" cy="'+(y+23)+'" r="12" fill="'+(layer===3?'var(--a4)':'var(--surface-3)')+'" stroke="var(--accent)"/>'; });
    var input = '<g transform="translate(22 111)"><rect width="106" height="112" rx="3" fill="var(--surface)" stroke="'+(layer===0?'var(--accent)':'var(--line-2)')+'"/><g transform="translate(5 10)" fill="var(--surface-3)" stroke="var(--ink)" stroke-width="3" stroke-linejoin="round">'+o.path+'</g></g>';
    var output = '<g transform="translate(479 121)"><rect width="100" height="90" rx="3" fill="'+(layer===3?'var(--a4)':'var(--surface)')+'" stroke="var(--accent)"/><text x="50" y="30" text-anchor="middle" fill="'+(layer===3?'#202d28':'var(--ink-3)')+'" font-size="13">PREDICTION</text><text x="50" y="60" text-anchor="middle" fill="'+(layer===3?'#202d28':'var(--accent)')+'" font-size="24" font-weight="700">'+o.name+'</text></g>';
    $('[data-network-image]',diagram).innerHTML = '<svg viewBox="0 0 600 320" role="img" aria-label="An image of a '+o.name.toLowerCase()+' passes through three layers of learned features before the network predicts '+o.name.toLowerCase()+'"><g fill="none" stroke="var(--line-2)" stroke-width="1.2">'+edges+'<path d="M128 166H165M416 113 479 155M416 157 479 161M416 201 479 170M416 245 479 178"/></g>'+input+channels+output+'<g fill="var(--ink-3)" font-family="var(--mono)" font-size="14" text-anchor="middle"><text x="75" y="273">IMAGE</text><text x="188" y="295">EDGES</text><text x="303" y="310">PARTS</text><text x="403" y="273">FEATURES</text></g></svg>';
    $('[data-rep-title]',diagram).textContent = titles[layer];
    $('[data-rep-caption]',diagram).textContent = [
      'The network receives numbers describing an image. No one gives it a rule for recognising a '+o.name.toLowerCase()+'.',
      'Learned filters respond to edges, curves and textures. Each feature map keeps a different part of the evidence.',
      'Patterns combine into larger structures: '+o.parts+'. These representations are learned from examples.',
      'The final layer combines the learned features to score the possible labels. Here the strongest response is “'+o.name+'”.'
    ][layer];
    $('[data-prediction]',diagram).textContent = o.name;
    $$('[data-object]',diagram).forEach(function(b) { b.setAttribute('aria-pressed', String(b.dataset.object === object)); });
    $$('[data-layer]',diagram).forEach(function(b) { b.setAttribute('aria-pressed', String(+b.dataset.layer === layer)); });
    $('[data-forward]',diagram).innerHTML = (layer===3?'Start again':'Follow the signal')+' <svg class="ic"><use href="#i-arrow-right"/></svg>';
  }
  $$('[data-object]',diagram).forEach(function(b) { b.addEventListener('click',function() { object=b.dataset.object; layer=0; paint(); }); });
  $$('[data-layer]',diagram).forEach(function(b) { b.addEventListener('click',function() { layer=+b.dataset.layer; paint(); }); });
  $('[data-forward]',diagram).addEventListener('click',function() { layer=(layer+1)%4; paint(); });
  paint();
})();
