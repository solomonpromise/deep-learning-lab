/* Project interfaces. Predictions run locally; training stays in the notebooks. */
(function(){
  'use strict';
  var page=document.querySelector('[data-project]');if(!page)return;
  var root=document.body.dataset.root||'',status=page.querySelector('[data-project-status]'),api=window.DLPProjectInference;
  function el(tag,text,cls){var node=document.createElement(tag);if(text!==undefined)node.textContent=text;if(cls)node.className=cls;return node;}
  function say(message,error){status.textContent=message;status.classList.toggle('is-error',!!error);}
  function bars(container,rows){
    var table=el('table',undefined,'project-probabilities'),caption=el('caption','Model probabilities');table.appendChild(caption);var head=el('thead'),tr=el('tr');['Class','Probability'].forEach(function(t){var th=el('th',t);th.scope='col';tr.appendChild(th);});head.appendChild(tr);table.appendChild(head);var body=el('tbody');
    rows.forEach(function(row){var tr=el('tr'),label=el('th',row[0]),value=el('td');label.scope='row';value.appendChild(el('span',(row[1]*100).toFixed(1)+'%'));var meter=el('span',undefined,'project-meter');meter.setAttribute('aria-hidden','true');var fill=el('i');fill.style.width=(row[1]*100)+'%';meter.appendChild(fill);value.appendChild(meter);tr.append(label,value);body.appendChild(tr);});table.appendChild(body);container.appendChild(table);
  }
  async function bundle(id){var response=await fetch(root+'static/labs/'+id+'/model.json');if(!response.ok)throw new Error('The saved model could not be loaded.');return response.json();}
  function download(name,text){var link=document.createElement('a'),url=URL.createObjectURL(new Blob([text],{type:'text/csv;charset=utf-8'}));link.href=url;link.download=name;link.click();setTimeout(function(){URL.revokeObjectURL(url);},1000);}
  async function student(){
    var model=await bundle('student-dropout'),form=page.querySelector('[data-student-form]'),result=page.querySelector('[data-student-result]');
    function reset(){Array.from(form.elements).forEach(function(input){if(!input.name)return;input[input.type==='checkbox'?'checked':'value']=input.type==='checkbox'?!!model.example[input.name]:model.example[input.name];});result.replaceChildren(el('p','Run a prediction to see the model score and support flag.'));say('Saved MLP ready. Inputs and predictions stay in your browser.');}
    function predict(event){
      event.preventDefault();if(!form.reportValidity())return;
      var row=Object.assign({},model.example);Array.from(form.elements).forEach(function(input){if(input.name)row[input.name]=input.type==='checkbox'?(input.checked?1:0):Number(input.value);});
      if(row['Curricular units 1st sem (approved)']>row['Curricular units 1st sem (enrolled)']){say('Units passed cannot exceed units enrolled. Adjust the inputs and try again.',true);return;}
      var probability=api.student(model,row);result.replaceChildren(el('p',(probability*100).toFixed(1)+'% estimated dropout score','project-score'),el('p',probability>=model.threshold?'Flag for a support conversation':'No support flag at this threshold'),el('p','Validation-selected threshold: '+(model.threshold*100).toFixed(1)+'%.','project-small'));
      say('Prediction complete. The saved model ran on your device.');
    }
    form.addEventListener('submit',predict);page.querySelector('[data-student-reset]').addEventListener('click',reset);page.querySelector('[data-project-run]').disabled=false;page.querySelector('[data-student-reset]').disabled=false;reset();
  }
  async function activity(){
    var model=await bundle('activity-recognition'),pick=page.querySelector('[data-activity-example]'),kind=page.querySelector('[data-activity-model]'),channels=page.querySelector('[data-activity-channels]'),result=page.querySelector('[data-activity-result]'),chart=page.querySelector('[data-activity-chart]'),upload=page.querySelector('[data-activity-upload]'),save=page.querySelector('[data-activity-download]'),windowData=null,recordingName='';
    pick.replaceChildren();Object.keys(model.examples).forEach(function(name){var option=el('option',name);option.value=name;pick.appendChild(option);});kind.value=model.selected;pick.disabled=false;save.disabled=false;
    function plot(){
      var ns='http://www.w3.org/2000/svg',svg=document.createElementNS(ns,'svg'),offset=Number(channels.value),width=600,height=240,left=50,top=20,bottom=205;
      svg.setAttribute('viewBox','0 0 '+width+' '+height);svg.setAttribute('role','img');svg.setAttribute('aria-label',channels.selectedOptions[0].text+' over a 2.56-second recording; x, y and z channels.');
      var values=windowData.flatMap(function(row){return row.slice(offset,offset+3);}),min=Math.min.apply(null,values),max=Math.max.apply(null,values),span=max-min||1;min-=span*.05;max+=span*.05;
      function text(x,y,value){var t=document.createElementNS(ns,'text');t.setAttribute('x',x);t.setAttribute('y',y);t.textContent=value;svg.appendChild(t);}
      var axis=document.createElementNS(ns,'path');axis.setAttribute('d','M50 20V205H585');axis.setAttribute('class','project-chart-axis');svg.appendChild(axis);text(2,28,max.toFixed(2));text(2,205,min.toFixed(2));text(50,230,'0 s');text(535,230,'2.54 s');
      ['x','y','z'].forEach(function(name,j){var line=document.createElementNS(ns,'polyline');line.setAttribute('points',windowData.map(function(row,i){return (left+i/127*535).toFixed(2)+','+(bottom-(row[offset+j]-min)/(max-min)*(bottom-top)).toFixed(2);}).join(' '));line.setAttribute('class','project-signal signal-'+j);svg.appendChild(line);text(320+j*60,15,name);svg.lastChild.setAttribute('class','signal-label-'+j);});
      chart.replaceChildren(svg);var details=el('details'),summary=el('summary','First five sensor rows (all nine channels)');details.appendChild(summary);details.appendChild(el('pre',windowData.slice(0,5).map(function(row){return row.map(function(v){return v.toFixed(4);}).join(', ');}).join('\n')));chart.appendChild(details);
    }
    function run(){
      if(!windowData)return;var probabilities=api.activity(model,kind.value,windowData),ranked=model.activities.map(function(name,i){return [name,probabilities[i]];}).sort(function(a,b){return b[1]-a[1];});
      result.replaceChildren(el('p',ranked[0][0],'project-score'),el('p',recordingName,'project-small'));bars(result,ranked);plot();say(kind.value+' prediction complete. A confident prediction can still be wrong; compare it with the recording label.');
    }
    function example(){if(!model.examples[pick.value])return;windowData=model.examples[pick.value];recordingName='Known recording label: '+pick.value;upload.value='';run();}
    pick.addEventListener('change',example);kind.addEventListener('change',run);channels.addEventListener('change',function(){if(windowData)plot();});
    upload.addEventListener('change',async function(){
      var file=upload.files[0];if(!file)return;
      try{if(file.size>1024*1024)throw new Error('Choose a CSV smaller than 1 MB.');var parsed=api.parseCSV(await file.text());windowData=parsed;pick.selectedIndex=-1;recordingName='Uploaded recording: '+file.name+' · true activity unknown';run();}
      catch(error){say(error.message,true);}
    });
    save.addEventListener('click',function(){if(windowData)download('sensor-window-128x9.csv',windowData.map(function(row){return row.join(',');}).join('\n')+'\n');});example();
  }
  if(page.dataset.project==='waste-sorter'){
    var button=page.querySelector('[data-project-load]'),frame=page.querySelector('[data-project-frame]');
    function currentTheme(){return document.documentElement.dataset.theme||(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');}
    new MutationObserver(function(){if(frame.contentWindow)frame.contentWindow.postMessage({type:'dlp-project-theme',theme:currentTheme()},location.origin);}).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
    button.addEventListener('click',function(){frame.hidden=false;frame.src=frame.dataset.appSrc+'?theme='+currentTheme();button.hidden=true;say('Loading the app and trained model. The status inside the app will show when it is ready.');});
    window.addEventListener('message',function(event){if(event.origin===location.origin&&event.source===frame.contentWindow&&event.data&&event.data.type==='dlp-project-height'&&Number.isFinite(event.data.height))frame.style.height=Math.max(600,Math.min(2600,event.data.height+20))+'px';});
  }else{(page.dataset.project==='student-dropout'?student():activity()).catch(function(error){say('Could not prepare the demo. Reload this page or use the downloadable Python app. '+error.message,true);});}
})();
