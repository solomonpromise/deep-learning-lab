const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'../..'),api=require(root+'/static/js/project-inference.js');
const fixture=JSON.parse(fs.readFileSync(__dirname+'/inference-fixtures.json'));
const student=JSON.parse(fs.readFileSync(root+'/static/labs/student-dropout/model.json'));
const activity=JSON.parse(fs.readFileSync(root+'/static/labs/activity-recognition/model.json'));
let maximum=0;
for(const test of fixture.student){const error=Math.abs(api.student(student,test.row)-test.probability);maximum=Math.max(maximum,error);assert(error<1e-5,`MLP mismatch ${error}`);}
for(const test of fixture.activity){const actual=api.activity(activity,test.kind,test.window);actual.forEach((p,i)=>{const error=Math.abs(p-test.probabilities[i]);maximum=Math.max(maximum,error);assert(error<1e-5,`${test.kind} mismatch ${error}`);});assert(Math.abs(actual.reduce((a,b)=>a+b)-1)<1e-12);}
for(const invalid of ['1,2,3','',Array(128).fill(Array(9).fill('NaN').join(',')).join('\n')])assert.throws(()=>api.parseCSV(invalid));
const text=fixture.activity[0].window.map(row=>row.join(',')).join('\n');assert.deepEqual(api.parseCSV(text),fixture.activity[0].window);
console.log(`${fixture.student.length} student records and ${fixture.activity.length} sequence/model comparisons agree with PyTorch; max absolute probability error ${maximum.toExponential(2)}. Invalid CSV input rejected.`);
