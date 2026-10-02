// Build and serve first. CHANNEL=chrome BASE=http://localhost:8794/ node scripts/dev/module5.mjs
// Check every new figure in its real section; block external services during tests.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { chromium } from 'playwright';
const BASE=process.env.BASE || 'http://localhost:8000/';
const AXE=fs.readFileSync(createRequire(import.meta.url).resolve('axe-core/axe.min.js'),'utf8');
const manifest=JSON.parse(fs.readFileSync(new URL('../../static/img/module-5/figures.json',import.meta.url),'utf8'));
const browser=await chromium.launch(process.env.CHANNEL?{channel:process.env.CHANNEL}:{});
const errors=[];
let cases=0;
try {
  for(const view of [{width:1440,height:900},{width:1280,height:800},{width:390,height:844}])for(const theme of ['light','dark']) {
    const ctx=await browser.newContext({viewport:view,colorScheme:theme,reducedMotion:'reduce'});
    await ctx.route('**/*',r=>new URL(r.request().url()).origin===new URL(BASE).origin?r.continue():r.abort());
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    for(const lid of ['5.1','5.2','5.3','5.4']) {
      const url='module-5/lesson-'+lid.replace('.','-')+'.html';await p.goto(BASE+url);
      const figures=await p.locator('figure').evaluateAll(nodes=>nodes.filter(n=>/^Figure 5\./.test(n.querySelector('figcaption')?.textContent?.trim()||'')).map(n=>({section:n.closest('[data-section]')?.id,caption:n.querySelector('figcaption').textContent,alt:n.querySelector('img')?.alt})));
      assert.equal(figures.length,Object.keys(manifest).filter(n=>n.startsWith(lid+'.')).length);
      for(const f of figures) {
        const number=f.caption.match(/^Figure (5\.\d\.\d)/)[1];assert.equal(f.alt,manifest[number].alt);assert.equal(f.caption.includes(manifest[number].caption),true);
        await p.goto(BASE+url+'#'+f.section);const img=p.getByAltText(f.alt,{exact:true});await img.scrollIntoViewIfNeeded();
        await img.evaluate(el=>el.decode());assert(await img.isVisible());
        assert(await img.evaluate(el=>el.naturalWidth>=1800&&el.complete));
        assert((await p.evaluate(()=>document.documentElement.scrollWidth))<=view.width);
        await img.click();await p.locator('.lightbox').waitFor({state:'visible'});await p.keyboard.press('Escape');await p.locator('.lightbox').waitFor({state:'hidden'});
        if(view.width!==1280) {
          await p.addScriptTag({content:AXE});
          const violations=await p.evaluate(()=>window.axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa']}}).then(r=>r.violations.map(v=>({id:v.id,targets:v.nodes.map(n=>n.target)}))));
          assert.deepEqual(violations,[],number+' '+view.width+' '+theme+' accessibility');
        }
        if(view.width===1440&&theme==='light'&&number==='5.1.1')await p.screenshot({path:'.shots/module5/lesson-5-1-pipeline.png',fullPage:true});
        if(view.width===390&&theme==='light'&&number==='5.3.2')await p.screenshot({path:'.shots/module5/lesson-5-3-matrix-phone.png',fullPage:true});
        cases++;
      }
    }
    console.log(view.width+' '+theme+': all ten figures, captions and zoom controls passed.');await ctx.close();
  }
  assert.deepEqual(errors,[]);console.log(cases+' figure/viewport/theme checks passed; no JavaScript errors.');
} finally {await browser.close();}
