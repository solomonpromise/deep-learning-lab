"""Copy visually reviewed built-in imagegen selections into the portable lesson sources."""
from pathlib import Path
import hashlib
import json
import shutil
from PIL import Image
from module56_visuals import CAPTIONS

ROOT=Path(__file__).resolve().parents[2]
ASSETS=ROOT/'static/img/module56-visuals'

def main():
    briefs=json.loads((ROOT/'docs/curriculum/module56-visual-requests.json').read_text())
    selection=json.loads((ASSETS/'selection.json').read_text())
    base={r['id']:r for p in sorted(ASSETS.glob('module*-generation.json')) for r in json.loads(p.read_text())}
    revisions={r['key']:r for p in sorted(ASSETS.glob('module*-revisions.json')) for r in json.loads(p.read_text())}
    manifest={}; provenance=[]
    for brief in briefs:
        number=brief['id']; original=base[number]; key=selection.get(number,number)
        chosen=original if key==number else revisions[key]
        source=Path(chosen['generated_path']); target=ASSETS/('figure-'+number.replace('.','-')+'.png')
        shutil.copy2(source,target)
        with Image.open(target) as im:
            im.verify()
        with Image.open(target) as im: size=im.size
        title=brief['prompt'].split('.*',1)[0]
        alt=title+'. '+CAPTIONS[number].split('. ')[0]+'.'
        manifest[number]=dict(file=str(target.relative_to(ROOT)),title=title,alt=alt,
            caption=CAPTIONS[number],lesson=brief['lesson'],section=brief['section'],source_cell=brief['source_cell'],
            sha256=hashlib.sha256(target.read_bytes()).hexdigest(),dimensions=list(size),
            mode='built-in image_gen',reviewed=True)
        provenance.append(dict(id=number,original_brief=brief['prompt'],generation=original,
            revisions=[r for k,r in revisions.items() if k.startswith(number+'-')],
            selected=key,selected_generated_path=str(source),workspace_file=str(target.relative_to(ROOT)),
            review='Inspected labels, dimensions, arithmetic, arrows, and distinction between schematic and measured content.'))
    assert len(manifest)==37
    (ASSETS/'manifest.json').write_text(json.dumps(manifest,indent=2,ensure_ascii=False)+'\n')
    (ASSETS/'provenance.json').write_text(json.dumps(provenance,indent=2,ensure_ascii=False)+'\n')
    print('Copied 37 reviewed illustrations; wrote captions, hashes, placement and prompt provenance.')

if __name__=='__main__': main()
