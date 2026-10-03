// Build and serve first. CHANNEL=chrome BASE=http://localhost:8794/ node scripts/dev/course-figures.mjs
// Inspect the real figure sections and zoom controls without contacting external services.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const BASE=process.env.BASE || 'http://localhost:8000/';
const AXE=fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../../static/img/course-figures/figures.json',import.meta.url),'utf8'));
const browser=await chromium.launch(process.env.CHANNEL?{channel:process.env.CHANNEL}:{});
const errors=[];
const accessibility=[];
let cases=0;
fs.mkdirSync('.shots/other-modules',{recursive:true});
try {
  for(const view of [{width:1440,height:900},{width:1280,height:800},{width:390,height:844}])for(const theme of ['light','dark']) {
    const ctx=await browser.newContext({viewport:view,colorScheme:theme,reducedMotion:'reduce'});
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(BASE).origin?r.continue():r.abort());
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    for(const lid of [...new Set(manifest.map(r=>r.lesson))]) {
      const url='module-'+lid.split('.')[0]+'/lesson-'+lid.replace('.','-')+'.html';
      await p.goto(BASE+url);
      const figures=await p.locator('figure').evaluateAll(nodes=>nodes.filter(n=>/^Figure [1-4]\./.test(n.querySelector('figcaption')?.textContent?.trim()||'')).map(n=>({section:n.closest('[data-section]')?.id,caption:n.querySelector('figcaption').textContent.trim(),alt:n.querySelector('img')?.alt})));
      assert.equal(figures.length,manifest.filter(r=>r.lesson===lid).length,lid);
      for(const f of figures) {
        const number=f.caption.match(/^Figure ([1-4]\.\d+\.\d+)/)[1], row=manifest.find(r=>r.number===number);
        assert.equal(f.alt,row.alt);assert(f.caption.includes(row.caption));
        await p.goto(BASE+url+'#'+f.section);
        const img=p.getByAltText(f.alt,{exact:true});await img.scrollIntoViewIfNeeded();await img.evaluate(el=>el.decode());
        assert(await img.isVisible());assert(await img.evaluate(el=>el.naturalWidth===1920&&el.complete));
        assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=view.width,number+' horizontal overflow');
        await img.click();await p.locator('.lightbox').waitFor({state:'visible'});
        await p.keyboard.press('Escape');await p.locator('.lightbox').waitFor({state:'hidden'});
        if(view.width!==1280) {
          // Expand long cells so axe reads their text without the collapse fade mask.
          await p.evaluate(()=>document.querySelectorAll('.code-cell.is-long').forEach(c=>c.classList.add('is-expanded')));
          await p.addScriptTag({content:AXE});
          const violations=await p.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))));
          if(violations.length)accessibility.push({number,width:view.width,theme,violations});
        }
        if(['1.2.3','2.1.2','3.4.2','4.3.1'].includes(number)&&view.width!==1280) {
          await p.screenshot({path:'.shots/other-modules/figure-'+number+'-'+view.width+'-'+theme+'.png'});
        }
        cases++;
      }
    }
    console.log(view.width+' '+theme+': all 32 diagrams, captions and zoom controls passed.');await ctx.close();
  }
  assert.deepEqual(errors,[]);assert.deepEqual(accessibility,[],'Figure section accessibility');
  console.log(cases+' figure/viewport/theme checks passed; no JavaScript errors.');
} finally {await browser.close();}
