/* Small, exact worked examples. Paused by default; no model inference is implied. */
(function () {
  'use strict';
  var L = window.DLP.lib;
  var words = ['the', 'cat', 'sat', 'down'];
  var image = [[0,0,1,0,0],[0,1,1,0,0],[0,1,1,1,0],[0,0,1,1,0],[0,0,0,0,0]];
  var kernel = [[1,0,-1],[1,0,-1],[1,0,-1]];
  var scores = [[1,0,0,0],[0,2,0,0],[0,2,1,0],[0,1,1,2]];
  var values = [[1,0],[0,2],[2,1],[1,3]];
  function softmax(xs) { var m = Math.max.apply(null,xs), ex = xs.map(function(x){return Math.exp(x-m);}), sum=ex.reduce(function(a,b){return a+b;},0); return ex.map(function(x){return x/sum;}); }
  function tile(value, active, extra) { return '<span class="cm-tile'+(active?' is-current':'')+(extra?' '+extra:'')+'">'+value+'</span>'; }
  function grid(rows, selected, labels) {
    return '<div class="cm-grid" style="--cm-cols:'+rows[0].length+'">'+rows.map(function(row,r){return row.map(function(v,c){return tile(v,selected&&selected(r,c),labels&&labels(r,c));}).join('');}).join('')+'</div>';
  }
  function panel(title, html) { return '<div class="cm-panel"><h4>'+title+'</h4>'+html+'</div>'; }
  function arrow() { return '<span class="cm-arrow" aria-hidden="true">→</span>'; }
  var scenes = {
    flatten: {n:4, draw:function(s){
      var a=[[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16]];
      return {html:panel('Image · 4 × 4',grid(a,function(r){return r===s;}))+arrow()+panel('Vector · 16 values','<div class="cm-vector">'+a.flat().map(function(v,i){return tile(v,Math.floor(i/4)===s);}).join('')+'</div>'),
        text:'Row '+(s+1)+' becomes vector positions '+(4*s)+'–'+(4*s+3)+' (zero-based). Every value stays in row order. With the original dimensions, reshape recovers the grid exactly. Notice that vertical neighbours differ by 4 vector positions; a dense layer has no built-in rule to treat them as neighbours.'};
    }},
    convolution:{n:9,draw:function(s){
      var r=Math.floor(s/3),c=s%3, sum=0, terms=[];
      for(var y=0;y<3;y++)for(var x=0;x<3;x++){sum+=image[r+y][c+x]*kernel[y][x];terms.push(image[r+y][c+x]+'×'+kernel[y][x]);}
      var out=Array.from({length:3},function(_,yy){return Array.from({length:3},function(_,xx){var v=0;for(var j=0;j<3;j++)for(var k=0;k<3;k++)v+=image[yy+j][xx+k]*kernel[j][k];return yy*3+xx<=s?v:'·';});});
      return {html:panel('Input · 5 × 5',grid(image,function(y,x){return y>=r&&y<r+3&&x>=c&&x<c+3;}))+arrow()+panel('Same filter at every position',grid(kernel))+arrow()+panel('Output · 3 × 3',grid(out,function(y,x){return y===r&&x===c;})),
        text:'Output ['+r+', '+c+'] = '+terms.join(' + ')+' = '+sum+'. Stride 1, no padding, no bias or activation. This is the cross-correlation operation called convolution in PyTorch. The nine filter weights stay the same as the window moves.'};
    }},
    memory:{n:5,draw:function(s){
      var f=0.9,i=0.1,g=0.5,o=0.8,old=1,kept=f*old,added=i*g,cell=kept+added,h=o*Math.tanh(cell);
      var cards=[['Previous memory','cₜ₋₁ = 1'],['Forget gate','0.9 × 1 = 0.90'],['Write new content','0.1 × 0.5 = 0.05'],['New cell state','0.90 + 0.05 = 0.95'],['Hidden output','0.8 × tanh(0.95) = '+h.toFixed(3)]];
      return {html:'<div class="cm-path">'+cards.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:[
        'A scalar worked example stands in for one coordinate of the cell state. The gates and candidate are supplied here, not learned by this animation.',
        'The forget gate retains 90% of the old memory along the direct cell-state path. A gate near 1 helps preserve that path; it does not guarantee every gradient is preserved.',
        'The input gate admits 10% of the candidate. The candidate can be negative; a gate is between 0 and 1.',
        'The LSTM adds retained memory and gated candidate: cₜ = fₜ × cₜ₋₁ + iₜ × gₜ. Vector LSTMs do these products coordinate by coordinate.',
        'The output gate exposes a bounded view of the cell: hₜ = oₜ × tanh(cₜ). Cell state and hidden state have different jobs.'
      ][s]};
    }},
    attention:{n:4,draw:function(s){
      var w=softmax(scores[s].slice(0,s+1)),out=[0,0];w.forEach(function(a,j){out[0]+=a*values[j][0];out[1]+=a*values[j][1];});
      var rows=words.map(function(word,j){return '<tr'+(j===s?' class="is-current"':'')+'><th scope="row">'+word+'</th><td>'+ (j<=s?scores[s][j]:'masked')+'</td><td>'+ (j<=s?w[j].toFixed(3):'0')+'</td><td>['+values[j].join(', ')+']</td></tr>';}).join('');
      return {html:panel('Query position: '+words[s],'<table class="cm-table"><thead><tr><th>Key token</th><th>Scaled score</th><th>Weight</th><th>Value</th></tr></thead><tbody>'+rows+'</tbody></table>')+arrow()+panel('Weighted value sum','<p class="cm-result">['+out.map(function(x){return x.toFixed(3);}).join(', ')+']</p><p>weights sum to '+w.reduce(function(a,b){return a+b;},0).toFixed(3)+'</p>'),text:'Causal attention for “'+words[s]+'”: future positions are masked before softmax. The remaining weights are non-negative and sum to 1; they mix value vectors, not raw words. Scores and values are a fixed teaching example, not a trained model’s measurements.'};
    }},
    norm:{n:4,draw:function(s){
      var input=[1,2,3,6],mean=3,variance=3.5,sd=Math.sqrt(variance+1e-5),norm=input.map(function(x){return (x-mean)/sd;}),affine=norm.map(function(x){return 1.5*x+0.2;});
      var rows=[input,input.map(function(x){return x-mean;}),norm,affine], titles=['Input coordinates','Subtract mean 3','Divide by √(3.5 + ε)','Learned scale 1.5, shift 0.2'];
      return {html:panel('One token · 4 coordinates','<div class="cm-vector">'+input.map(function(x){return tile(x);}).join('')+'</div>')+arrow()+panel(titles[s],'<div class="cm-vector">'+rows[s].map(function(x){return tile(x.toFixed(3),true);}).join('')+'</div>'),text:[
        'LayerNorm operates across the coordinates of each token independently. Here one token has four coordinates. It does not average different tokens together.',
        'Mean = (1 + 2 + 3 + 6) / 4 = 3. Centring subtracts 3 from each coordinate and preserves their differences.',
        'Population variance = (4 + 1 + 0 + 9) / 4 = 3.5. Divide centred values by √(3.5 + ε), with ε = 0.00001. Coordinates remain different; they are not flattened to the same value.',
        'A learned scale and shift follow normalisation. This example uses the same scale 1.5 and shift 0.2 for every coordinate; a real LayerNorm learns a separate pair per coordinate. The affine output need not have mean 0 or variance 1.'
      ][s]};
    }},
    generation:{n:12,draw:function(s){
      var round=Math.floor(s/4),phase=s%4,append=['T','h','o'],context='ROMEO:↵'+append.slice(0,round).join(''),labels=['Read current context','Compute last-position logits','Sample one next character','Append and repeat'];
      var shown=context+(phase===3?append[round]:'');
      return {html:'<div class="cm-path">'+labels.map(function(label,j){return '<div class="cm-stage'+(j===phase?' is-current':'')+'"><h4>'+(j+1)+'. '+label+'</h4><p>'+(j===0?context:j===1?'logits → probabilities':j===2?'chosen: '+append[round]:shown)+'</p></div>';}).join(arrow())+'</div>',text:'Generation round '+(round+1)+', step '+(phase+1)+': '+labels[phase]+'. '+[
        'Use the available context, cropping to the model’s context limit when needed. ↵ denotes a newline.',
        'The model may compute all positions, but the next character is chosen from the final position’s distribution.',
        'Temperature and top-k/top-p can change this distribution. Here the chosen characters T, h, o are prescribed for illustration; no language model runs in this widget.',
        'The chosen character becomes part of the next input. Model weights stay fixed throughout generation; no loss, backpropagation or optimizer step occurs.'
      ][phase]};
    }}
  };
  /* Module 7/8 worked sequences */
  scenes["padding78"]={n:4,draw:function(s){var steps=[["Tokenize two inputs", "A: [101, 42, 102] · B: [101, 17, 25, 102]", "IDs are arbitrary vocabulary indices in this toy example; 101/102 mark boundaries and 0 is padding."], ["Pad this batch", "A: [101, 42, 102, 0] · B unchanged", "The longest example has four tokens, so the shorter example receives one padding position."], ["Construct masks", "A: [1, 1, 1, 0] · B: [1, 1, 1, 1]", "The mask allows attention to real tokens and prevents attending to the padded key. This is not a causal future-token mask."], ["Run fixed weights", "IDs + masks → logits → label", "Padding creates a batch shape; it does not restore content discarded by truncation. Inference changes no weights."]];return {html:'<div class="cm-path">'+steps.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+(j+1)+'. '+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:steps[s][2]};}};
  scenes["service78"]={n:4,draw:function(s){var steps=[["Validate the input", "Empty input → reject", "Validation happens before model inference. A model score cannot repair an invalid request."], ["Check the declared domain", "Flagged out of domain → hold back", "This course uses a review-likeness heuristic, which can falsely accept or reject inputs."], ["Apply a confidence threshold", "Illustration: 0.88 ≥ 0.80 → answer", "These are invented decision-rule values, not a measurement of model calibration."], ["Abstain when required", "Illustration: 0.63 < 0.80 → abstain", "The source run answers 909, abstains on confidence for 79, and flags 12 as out of domain. All 91 non-answered cases form the held-back group."]];return {html:'<div class="cm-path">'+steps.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+(j+1)+'. '+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:steps[s][2]};}};
  scenes["quantize78"]={n:4,draw:function(s){var steps=[["Choose an illustrative scale", "w = 0.806 · scale = 0.01", "This scalar example illustrates uniform rounding. The notebook separately measures an actual quantized model."], ["Round to an integer", "q = round(0.806 / 0.01) = 81", "81 is inside signed int8 range. A full quantizer must define clipping and how scales are selected."], ["Reconstruct the value", "ŵ = 81 × 0.01 = 0.810", "The integer and scale together approximate the original value."], ["Measure reconstruction error", "ŵ − w = 0.004", "Smaller weight error need not imply an equal change in application quality. Measure quality, latency and peak memory on the intended workload."]];return {html:'<div class="cm-path">'+steps.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+(j+1)+'. '+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:steps[s][2]};}};
  scenes["split78"]={n:4,draw:function(s){var steps=[["Find identical examples", "A: “good film” · B: “bad film” · C: “good film”", "This exact-match toy policy groups A and C; real preprocessing and near-duplicate policies must be declared."], ["Group before splitting", "Group 1: {A, C} · Group 2: {B}", "Splitting rows first could place the same text in train and test and inflate evaluation."], ["Assign whole groups", "Train: {A, C} · Test: {B}", "This two-group example explains the boundary; it is far too small for a useful model evaluation."], ["Fit only on train", "Learn preprocessing from train → apply to test", "Test data never supplies gradients or fitted vocabulary/statistics under this protocol. Validation is a separate group-held-out split."]];return {html:'<div class="cm-path">'+steps.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+(j+1)+'. '+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:steps[s][2]};}};
  scenes["finetune78"]={n:4,draw:function(s){var steps=[["Training forward pass", "Training batch → logits → loss", "The labels of this training batch define the optimization objective."], ["Backward and update", "loss.backward() → optimizer.step()", "Trainable parameters change; clear gradients as required before the next accumulation cycle."], ["Validation checkpoint", "No gradients · score saved checkpoint", "Validation selects settings and checkpoints. It does not directly update weights in this training loop."], ["Final test reporting", "Selected setup → held-out test", "Repeatedly tuning after inspecting test results requires a fresh final test for an unbiased report."]];return {html:'<div class="cm-path">'+steps.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+(j+1)+'. '+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:steps[s][2]};}};
  scenes["lora78"]={n:4,draw:function(s){var steps=[["Freeze a 2 × 2 base", "W₀ = [[1, 0], [0, 1]] · x = [2, 1]", "Use rank r = 1 and α = 1, so α/r = 1. This tiny matrix is an illustration, not a measured trained adapter."], ["Initialize the adapter", "A = [[0.2, −0.1]] · B = [[0], [0]]", "A starts random; B starts zero. Ax = 0.3, but BAx = [0, 0]. The initial combined adapter update is zero."], ["After an illustrative update", "B = [[0.5], [−0.2]] · A held as shown", "For illustration, B changes to these supplied values. We are not deriving an optimizer step or running training here."], ["Add the low-rank path", "W₀x + BAx = [2, 1] + [0.15, −0.06] = [2.15, 0.94]", "The base remains frozen while adapters train. A task head may also train; include it when counting trainable parameters."]];return {html:'<div class="cm-path">'+steps.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+(j+1)+'. '+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:steps[s][2]};}};
  scenes["sft78"]={n:4,draw:function(s){var steps=[["Format a toy exchange", "Input tokens: [USER, hi, ASSISTANT, hello, EOS]", "These names stand for token IDs in a simplified assistant-only supervised fine-tuning example."], ["Keep context visible", "Attention mask: [1, 1, 1, 1, 1]", "All five positions are real tokens. A separate causal attention mask prevents future-token access."], ["Mask prompt targets", "Labels: [−100, −100, −100, hello, EOS]", "−100 means ignore this target in cross-entropy. It does not hide the prompt from the model."], ["Apply causal shifting", "logits at ASSISTANT → hello; logits at hello → EOS", "Causal-LM loss aligns logits[:-1] with labels[1:]. Only assistant-response targets contribute here. LoRA changes selected parameters during training."]];return {html:'<div class="cm-path">'+steps.map(function(a,j){return '<div class="cm-stage'+(j===s?' is-current':'')+'"><h4>'+(j+1)+'. '+a[0]+'</h4><p>'+a[1]+'</p></div>';}).join(arrow())+'</div>',text:steps[s][2]};}};
  /* End Module 7/8 sequences */
  window.DLP.widgets['concept-motion']=function(root,props){
    var scene=scenes[props.scene];if(!scene)throw new Error('Unknown concept-motion scene');
    var step=0,timer=null,controls=L.el('div',{class:'cm-controls'}),stage=L.el('div',{class:'cm-scene'}),status=L.el('p',{class:'cm-count'}),narration=L.el('p',{class:'cm-narration','aria-live':'polite','aria-atomic':'true'});
    var prev=L.el('button',{type:'button',text:'Previous step'}),play=L.el('button',{type:'button',text:'Play', 'aria-pressed':'false'}),next=L.el('button',{type:'button',text:'Next step'}),reset=L.el('button',{type:'button',text:'Reset'});
    [prev,play,next,reset].forEach(function(e){controls.appendChild(e);});
    root.appendChild(L.el('div',{class:'concept-motion'},[controls,status,stage,narration]));
    function pause(){if(timer)clearInterval(timer);timer=null;play.textContent='Play';play.setAttribute('aria-pressed','false');narration.setAttribute('aria-live','polite');}
    function draw(){var frame=scene.draw(step);stage.innerHTML=frame.html;narration.textContent=frame.text;status.textContent='Step '+(step+1)+' of '+scene.n;prev.disabled=step===0;next.disabled=step===scene.n-1;}
    prev.addEventListener('click',function(){pause();step=Math.max(0,step-1);draw();});
    next.addEventListener('click',function(){pause();step=Math.min(scene.n-1,step+1);draw();});
    reset.addEventListener('click',function(){pause();step=0;draw();});
    play.addEventListener('click',function(){if(timer){pause();return;}if(step===scene.n-1)step=0;play.textContent='Pause';play.setAttribute('aria-pressed','true');narration.setAttribute('aria-live','off');draw();timer=setInterval(function(){if(document.hidden||!root.closest('section')||root.closest('section').hidden){pause();return;}step++;draw();if(step===scene.n-1)pause();},window.matchMedia('(prefers-reduced-motion: reduce)').matches?4000:2400);});
    document.addEventListener('visibilitychange',function(){if(document.hidden)pause();});
    if('IntersectionObserver' in window)new IntersectionObserver(function(entries){if(!entries[0].isIntersecting)pause();}).observe(root);
    draw();
  };
})();
