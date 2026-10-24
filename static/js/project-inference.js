/* Inference only: the exported checkpoints are learned in the companion notebooks. */
(function(root,factory){
  var api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.DLPProjectInference=api;
})(typeof window!=='undefined'?window:this,function(){
  'use strict';
  function affine(weight,bias,input){return weight.map(function(row,i){var sum=bias[i];for(var j=0;j<row.length;j++)sum+=row[j]*input[j];return sum;});}
  function sigmoid(x){return x>=0?1/(1+Math.exp(-x)):Math.exp(x)/(1+Math.exp(x));}
  function softmax(logits){var m=Math.max.apply(null,logits),p=logits.map(function(x){return Math.exp(x-m);}),sum=p.reduce(function(a,b){return a+b;},0);return p.map(function(x){return x/sum;});}
  function studentVector(bundle,row){
    var x=[];
    bundle.categories.forEach(function(c){
      var value=Number(row[c.name]),known=c.frequent.indexOf(value)>=0;
      if(!Number.isFinite(value))throw new Error('All student features must be numeric.');
      c.frequent.forEach(function(k){x.push(value===k?1:0);});
      if(c.has_infrequent)x.push(known?0:1);
    });
    bundle.numeric.forEach(function(name,i){var value=Number(row[name]);if(!Number.isFinite(value))throw new Error('All student features must be numeric.');x.push(Math.fround((value-bundle.mean[i])/bundle.scale[i]));});
    return x;
  }
  function student(bundle,row){var x=studentVector(bundle,row);bundle.layers.forEach(function(layer,i){x=affine(layer.weight,layer.bias,x);if(i<bundle.layers.length-1)x=x.map(function(v){return Math.max(0,v);});});return sigmoid(x[0]);}
  function validateWindow(window){
    if(!Array.isArray(window)||window.length!==128||window.some(function(row){return !Array.isArray(row)||row.length!==9||row.some(function(v){return typeof v!=='number'||!Number.isFinite(v);});}))throw new Error('Use 128 rows × 9 finite numbers, without a header, in the documented sensor order.');
  }
  function activity(bundle,kind,window){
    validateWindow(window);
    var p=bundle.models[kind];if(!p)throw new Error('Unknown recurrent model.');
    var n=p['rnn.weight_hh_l0'][0].length,h=Array(n).fill(0),cell=Array(n).fill(0);
    window.forEach(function(row){
      var x=row.map(function(v,j){return Math.fround((v-bundle.mu[j])/bundle.sd[j]);});
      var gi=affine(p['rnn.weight_ih_l0'],p['rnn.bias_ih_l0'],x),gh=affine(p['rnn.weight_hh_l0'],p['rnn.bias_hh_l0'],h),next=Array(n);
      for(var i=0;i<n;i++){
        if(kind==='RNN')next[i]=Math.tanh(gi[i]+gh[i]);
        else if(kind==='LSTM'){
          var input=sigmoid(gi[i]+gh[i]),forget=sigmoid(gi[n+i]+gh[n+i]),candidate=Math.tanh(gi[2*n+i]+gh[2*n+i]),output=sigmoid(gi[3*n+i]+gh[3*n+i]);
          cell[i]=forget*cell[i]+input*candidate;next[i]=output*Math.tanh(cell[i]);
        }else{
          var reset=sigmoid(gi[i]+gh[i]),update=sigmoid(gi[n+i]+gh[n+i]),candidate=Math.tanh(gi[2*n+i]+reset*gh[2*n+i]);
          next[i]=(1-update)*candidate+update*h[i];
        }
      }
      h=next;
    });
    return softmax(affine(p['head.weight'],p['head.bias'],h));
  }
  function parseCSV(text){
    var lines=text.trim().split(/\r?\n/);var window=lines.map(function(line){return line.split(',').map(function(x){return x.trim()===''?NaN:Number(x.trim());});});validateWindow(window);return window;
  }
  return {student:student,studentVector:studentVector,activity:activity,parseCSV:parseCSV};
});
