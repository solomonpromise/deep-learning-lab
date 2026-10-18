"""Import the author's immutable Day 7/8 sources with approved corrections and portable images."""
from pathlib import Path
import argparse,base64,copy,hashlib,json,re,sys
import nbformat,yaml
from module78_edits import edit
from module78_checks import questions
from module78_docstrings import docstrings
from module78_visuals import add_worked_figures,inserts
ROOT=Path(__file__).resolve().parents[2]
SOURCES=Path(__file__).parent/'module78_sources'
TITLES={7:'Pretrained Models and the Hugging Face Ecosystem',8:'Efficient Fine-Tuning and Data Engineering'}
PROMPT=re.compile(r'^>\s*🖼️?\s*\*IMAGE\s+([\d.]+)\s*[—–-]\s*([^\n]+)$',re.M)
CHECK=re.compile(r'^>\s*\*\*Check yourself (\d+)\.\*\*\s*(.+)$',re.M)

def main():
    parser=argparse.ArgumentParser(description=__doc__);parser.add_argument('modules',nargs='*',type=int,default=[7,8]);args=parser.parse_args()
    manifest=json.loads((SOURCES/'manifest.json').read_text())
    vp=ROOT/'static/img/module78-visuals/manifest.json';visuals=json.loads(vp.read_text()) if vp.exists() else {}
    for m in args.modules:
        assert m in [7,8];challenge=[]
        for path in sorted(SOURCES.glob(f'{m}.*.ipynb')):
            lid=path.stem;source=nbformat.read(path,as_version=4)
            appendix=next(c.source for c in source.cells if c.source.startswith('## Answers to Check Yourself'))
            answers={int(n):a.strip() for n,a in re.findall(r'^\*\*(\d+)\.\*\*\s*(.*?)(?=^\*\*\d+\.\*\*|\Z)',appendix,re.M|re.S)}
            title=source.cells[0].source.splitlines()[0].split(' ',2)[2]
            cells=[];checks=[];section=0
            for index,original in enumerate(source.cells):
                if original.source.startswith('## Answers to Check Yourself'):continue
                cell=copy.deepcopy(original);text=edit(lid,index,original.source,cell.cell_type)
                if cell.cell_type=='markdown':
                    if index==0:
                        text=re.sub(r'^# .*\n',f'# Module {m} — {TITLES[m]}\n\n## Lesson {lid} — {title}\n',text,count=1)
                        text=re.sub(r'\*\*Module \d+ · Note \d+\*\*\n','',text)
                        text=text.replace('**By the end of this note you will be able to:**','### Learning objectives').replace('**Before you start:**','### Prerequisites\n\n')
                        goal=re.search(r'\*\*Key question:\*\*\s*\*(.*?)\*',text)[1]
                        text+='\n\n**Environment and reference results.** Use Python 3.12 and [requirements.txt](../static/notebook-support/module78/requirements.txt) (also supplied at the root of the Module 7/8 notebook bundle). Install packages into a separate environment, restart the kernel, and run from the beginning. The saved outputs are the author\'s CPU reference run, with approved explanatory corrections. Seeds and artifact revisions reduce variation; numbers and timings can differ across hardware. No account or paid API is required for the public teaching models. Initial model/data downloads require internet access.'
                        if lid in ['8.4','8.5','8.7']:text+='\n\n**Comparison artifacts.** Missing baseline result files are restored from bundled, clearly labelled author reference data. Existing result files are preserved. Run 8.3–8.5 in the same working folder to replace these with your own experiments. The encoded reference payload in setup is delivery data; you do not need to decipher it to study the model code.'
                    numbered=re.search(r'^## (\d+)\.',text,re.M)
                    if numbered:section=int(numbered[1])
                    figures={}
                    def visual(match):
                        number=match[1]
                        if number not in visuals:return ''
                        row=visuals[number];p=ROOT/row['file'];figures[p.name]={'image/png':base64.b64encode(p.read_bytes()).decode()}
                        return f'![{row["alt"]}](attachment:{p.name})\n\n*Figure {number}. {row["caption"]}*'
                    text=PROMPT.sub(visual,text)
                    def check(match):
                        n=int(match[1]);q=match[2].strip();answer=edit(lid,-n,answers[n],'markdown');checks.append((section,q,answer))
                        return f'**Check yourself.**\n\n1. {q}\n\n<details>\n<summary>Worked answer</summary>\n\n{answer}\n\n</details>'
                    text=CHECK.sub(check,text)
                    if figures:cell.attachments={**cell.get('attachments',{}),**figures}
                if lid=='8.6' and index==35:
                    for output in cell.get('outputs',[]):
                        if output.output_type=='stream':
                            output.text=output.text.replace('fits a GPU of:', 'storage estimate below:').replace('QLoRA, 4-bit weights (adapters tiny)', 'Illustrative 4-bit base layout')
                cell.source=text.strip();cell.metadata['author_source_cell']=index;cells.append(cell)
            assert len(checks)==len(answers),(lid,len(checks),len(answers))
            cells=add_worked_figures(cells,lid,ROOT)
            nb=nbformat.v4.new_notebook(cells=cells,metadata=copy.deepcopy(source.metadata))
            coverage='further learning' if lid in ['7.6','7.7','8.6'] else 'classroom'
            nb.metadata['curriculum']=dict(version='day78-v1',source=manifest[lid]['source'],source_sha256=manifest[lid]['sha256'],coverage=coverage,outputs='author CPU reference run; independent verification recorded separately')
            target=ROOT/f'notes/module-{m}/lesson-{lid}.ipynb';target.parent.mkdir(exist_ok=True)
            nbformat.validate(nb);nbformat.write(nb,target)
            sys.path.insert(0,str(ROOT/'scripts'))
            from dlp.notebook import LessonParser
            from dlp.render import MarkdownRenderer,AssetStore
            from dlp.text import Terminology
            parsed=LessonParser(MarkdownRenderer(Terminology([])),Terminology([])).parse(target,lid,AssetStore(Path('/tmp/dlp-day78-assets'),'assets'),'../',TITLES[m])
            qa={}
            for sec in parsed.sections:
                qs=[b for b in sec.blocks if b['kind']=='questions'];expected=[a for s,q,a in checks if s==sec.num]
                assert len(qs)==len(expected),(lid,sec.id,len(qs),len(expected))
                for q,a in zip(qs,expected):qa[q['id']]=[a]
            cps=questions(lid);sections=[s for s in parsed.sections if s.num is not None];assert len(cps)==len(sections),(lid,len(cps),len(sections))
            enrichment=dict(summary=goal,answers=qa,portable_notebook_checks=True,assessment_revision='day78-v1',docstrings=docstrings(nb),inserts=inserts(lid),quiz=[cps[i] for i in sorted(set([0,len(cps)//2,len(cps)-1]))])
            (ROOT/f'enrichments/{lid}.yaml').write_text(yaml.safe_dump(enrichment,sort_keys=False,allow_unicode=True))
            (ROOT/f'enrichments/{lid}.checkpoints.yaml').write_text(yaml.safe_dump(dict(skill=title,sections={s.num:dict(questions=[q]) for s,q in zip(sections,cps)},assessment_revision='day78-v1'),sort_keys=False,allow_unicode=True))
            challenge.append(cps[0])
            if lid.endswith(".7"):challenge.append(cps[-1])
            print(lid,title,'|',len(sections),'sections |',len(checks),'worked answers')
        (ROOT/f'enrichments/module-{m}.challenge.yaml').write_text(yaml.safe_dump(dict(title=f'Module {m} challenge: {TITLES[m]}',pass_mark=.75,questions=challenge[:8],assessment_revision='day78-v1'),sort_keys=False,allow_unicode=True))

if __name__=='__main__':main()
