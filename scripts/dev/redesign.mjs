// Integration checks for the approved design's new navigation and section flow.
// Build first, serve dist/, then CHANNEL=chrome BASE=http://localhost:8000/ node scripts/dev/redesign.mjs
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { chromium } from 'playwright';
import { sampleLearner } from './sample-learner.mjs';
const BASE=process.env.BASE || 'http://localhost:8000/';
const browser=await chromium.launch(process.env.CHANNEL ? {channel:process.env.CHANNEL} : {});
const errors=[];
async function context(opts={}) {
  const ctx=await browser.newContext({viewport:{width:1440,height:900},reducedMotion:'reduce',...opts});
  // Test local interactions without calling live tutor, sync, analytics or discussions.
  await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(BASE).origin?r.continue():r.abort());
  ctx.on('page',p=>p.on('pageerror',e=>errors.push(e.message)));
  return ctx;
}
const ctx=await context(), p=await ctx.newPage();
try {
  await p.goto(BASE+'index.html');
  assert.match(await p.locator('h1').innerText(),/Understand/);
  await p.locator('[data-object=shoe]').click();
  assert.equal(await p.locator('[data-prediction]').innerText(),'Shoe');
  for(let i=0;i<3;i++)await p.locator('[data-forward]').click();
  assert.equal(await p.locator('[data-layer="3"]').getAttribute('aria-pressed'),'true');
  assert.match(await p.locator('[data-rep-caption]').innerText(),/Shoe/);
  await p.getByRole('button',{name:'Search the course',exact:true}).click();
  await p.locator('[data-search-input]').fill('gradient');
  await p.locator('[data-search-results] a').first().waitFor();
  await p.keyboard.press('Escape');
  console.log('Homepage network and course search passed.');

  await p.goto(BASE+'module-1/lesson-1-1.html#s3');
  await p.locator('#s3').waitFor({state:'visible'});
  assert.equal(await p.locator('[data-section]:visible').count(),1);
  assert.equal(await p.locator('#s4').isVisible(),false);
  await p.locator('[data-flow-complete]').click();
  await p.waitForFunction(()=>JSON.parse(localStorage.getItem('dlp:progress')||'{}')['1.1']?.read?.includes('s3'));
  const read=await p.evaluate(()=>JSON.parse(localStorage.getItem('dlp:progress'))['1.1'].read);
  assert(!read.includes('s4'),'Hiding a section must not mark it read');
  await p.reload();await p.locator('#s3').waitFor({state:'visible'});
  assert.equal(await p.locator('[data-section]:visible').count(),1);
  await p.locator('[data-flow-next]').click();assert.equal(await p.locator('#s4').isVisible(),true);
  await p.keyboard.press('f');assert.equal(await p.locator('.topbar').isVisible(),false);
  await p.keyboard.press('f');assert.equal(await p.locator('.topbar').isVisible(),true);
  await p.goto(BASE+'module-1/lesson-1-1.html#cp-3');
  await p.locator('#cp-3').waitFor({state:'visible'});
  assert.equal(await p.locator('#s3').isVisible(),true);
  const q=p.locator('#cp-3 [data-cp-q]').first(), answer=await q.getAttribute('data-answer'), qid=await q.getAttribute('data-cp-q');
  await q.locator('[data-opt="'+answer+'"]').click();
  await p.waitForFunction(id=>!!window.DLP.record.answerOf(id),qid);
  assert.equal(await p.evaluate(id=>window.DLP.record.answerOf(id).ok,qid),true);
  const reflection=p.locator('#s3 .qitem').first();await reflection.locator('[data-note-toggle]').click();
  await reflection.locator('textarea').fill('More examples cannot bend a linear decision boundary.');
  await reflection.locator('textarea').blur();
  await p.getByRole('button',{name:'Ask tutor',exact:true}).click();
  assert.equal(await p.locator('.tutor-panel').isVisible(),true);
  assert.match(await p.locator('[data-t-context]').innerText(),/1.1/);
  await p.locator('[data-t-close]').click();
  await p.locator('[data-flow-whole]').click();
  assert((await p.locator('[data-section]:visible').count())>1);
  await p.locator('[data-flow-whole]').click();assert.equal(await p.locator('[data-section]:visible').count(),1);
  console.log('Section navigation, read mode, deep links, persistence, checkpoints, notes and tutor passed.');

  await p.goto(BASE+'dashboard.html');await p.locator('[data-resume] .btn').waitFor();
  assert.match(await p.locator('[data-workspace-title]').innerText(),/Welcome back/);
  assert.match(await p.locator('[data-resume] .btn').getAttribute('href'),/lesson-1-1/);
  await p.goto(BASE+'curriculum.html');assert.equal(await p.locator('.rd-curriculum-row').count(),10);assert.equal(await p.locator('.rd-curriculum-lessons li').count(),19);
  await p.goto(BASE+'reference.html');assert.equal(await p.locator('.rd-reference-grid a').count(),2);
  await p.goto(BASE+'module-10/index.html');assert.match(await p.locator('main').innerText(),/not published yet/);
  console.log('Workspace, full curriculum, reference and roadmap passed.');

  const map=fs.readFileSync(new URL('../../dist/static/course-map.js',import.meta.url),'utf8');
  const C=JSON.parse(map.slice(map.indexOf('=')+1,-1));
  let sections=0,labs=0;
  for(const module of C.modules.filter(m=>m.available))for(const lesson of module.lessons) {
    await p.goto(BASE+lesson.url);await p.locator('[data-flow-next]').waitFor();
    assert.equal(await p.locator('[data-code]').count()>0,true);
    for(const sec of lesson.secs){
      await p.goto(BASE+lesson.url+'#'+sec[0]);await p.locator('#'+sec[0]).waitFor({state:'visible'});
      assert.equal(await p.locator('[data-section]:visible').count(),1);
      assert.equal(await p.locator('[data-section]:visible').getAttribute('id'),sec[0]);
      assert.equal(await p.locator('.widget-loading:visible').count(),0);
      assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=1440);
      sections++;labs+=await p.locator('[data-section]:visible [data-mounted]').count();
    }
  }
  console.log('All published lessons: '+sections+' section destinations, '+labs+' labs mounted without errors.');
  for(const view of [{width:1280,height:800},{width:390,height:844}])for(const theme of ['light','dark']) {
    await p.setViewportSize(view);await p.emulateMedia({colorScheme:theme});
    for(const sec of C.modules[0].lessons[0].secs) {
      await p.goto(BASE+C.modules[0].lessons[0].url+'#'+sec[0]);await p.locator('#'+sec[0]).waitFor({state:'visible'});
      assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=view.width, 'Lesson 1.1 '+sec[0]+' overflows '+view.width);
    }
  }
  await p.setViewportSize({width:1440,height:900});await p.emulateMedia({colorScheme:'light'});
  await p.goto(BASE+'index.html');fs.mkdirSync('.shots/forest',{recursive:true});await p.screenshot({path:'.shots/forest/home-approved.png'});
  console.log('Every Lesson 1.1 section fits laptop and phone widths in both themes.');


  const sample=await context();await sample.addInitScript(s=>{if(!/^https?:$/.test(location.protocol))return; for(const [k,v]of Object.entries(s))localStorage.setItem(k,v)},sampleLearner());
  const sp=await sample.newPage();await sp.goto(BASE+'dashboard.html');await sp.locator('[data-resume] .btn').waitFor();
  assert.match(await sp.locator('[data-resume] .btn').getAttribute('href'),/lesson-3-3/);
  await sp.screenshot({path:'.shots/forest/dashboard-returning.png'});
  await sp.goto(BASE+'review.html');await sp.locator('[data-rv-round]').waitFor({state:'visible'});
  await sp.locator('[data-rv-options] button').first().click();await sp.locator('[data-rv-next]').waitFor({state:'visible'});
  console.log('Existing learner progress and scheduled review preserved.');await sample.close();
  const phone=await context({viewport:{width:390,height:844}}), mobile=await phone.newPage();await mobile.goto(BASE+'index.html');
  await mobile.getByRole('button',{name:'Show course navigation',exact:true}).click();assert.equal(await mobile.locator('.sidebar').isVisible(),true);
  await mobile.keyboard.press('Escape');assert.equal(await mobile.locator('.sidebar').isVisible(),false);
  await mobile.goto(BASE+'module-1/lesson-1-1.html#s3');await mobile.locator('[data-spine-open]').click();await mobile.locator('body.spine-open').waitFor();
  await mobile.locator('[data-toc-link=s4]').click();assert.equal(await mobile.locator('#s4').isVisible(),true);
  await mobile.locator('[data-sec-step="1"]').click();assert.equal(await mobile.locator('#s5').isVisible(),true);
  assert.equal(await mobile.locator('#s4').isVisible(),false);
  assert((await mobile.evaluate(()=>document.documentElement.scrollWidth))<=390);
  await mobile.screenshot({path:'.shots/forest/lesson-phone.png'});
  console.log('Phone navigation and lesson section drawer passed.');await phone.close();
  assert.deepEqual(errors,[]);console.log('No JavaScript errors.');
} finally { await ctx.close();await browser.close(); }
