"""Check outline coverage, portable notebook renders and actual built downloads."""
from pathlib import Path
import ast
import base64
import hashlib
import io
import json
import os
import re
import sys
from urllib.parse import unquote
import nbformat
from nbconvert import HTMLExporter
from bs4 import BeautifulSoup
from PIL import Image
import yaml

ROOT = Path(__file__).resolve().parents[2]
# A venv can inherit nbconvert from its base interpreter without inheriting its
# shared templates in Jupyter's default search path.
os.environ['JUPYTER_PATH'] = os.pathsep.join(filter(None, [
    os.environ.get('JUPYTER_PATH'), str(Path(sys.base_prefix)/'share/jupyter')]))
# The reviewed author snapshots define the twelve replacement lessons.
expected = {}
sys.path.insert(0, str(Path(__file__).parent))
from module56_edits import edit
for path in sorted((ROOT/'scripts/authoring/notebook_sources').glob('*.ipynb')):
    source = nbformat.read(path, as_version=4)
    lid = path.stem
    source_md = '\n'.join(edit(lid, i, cell.source, 'markdown')
                          for i, cell in enumerate(source.cells) if cell.cell_type == 'markdown')
    expected[lid] = dict(title=source.cells[0].source.splitlines()[0].split(' ', 2)[2],
                         sections=re.findall(r'^## \d+\. (.+)$', source_md, re.M))


def normalise(text):
    return re.sub(r'[^a-z0-9]+','',text.casefold())


def executable_ast(source):
    tree=ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node,(ast.FunctionDef,ast.AsyncFunctionDef,ast.ClassDef)) and node.body and isinstance(node.body[0],ast.Expr) and isinstance(node.body[0].value,ast.Constant) and isinstance(node.body[0].value.value,str):
            node.body=node.body[1:]
    return ast.dump(tree,include_attributes=False)


report={}
exporter=HTMLExporter()
for lid,row in expected.items():
    path=ROOT/f'notes/module-{lid[0]}/lesson-{lid}.ipynb'
    nb=nbformat.read(path,as_version=4);nbformat.validate(nb)
    markdown='\n'.join(c.source for c in nb.cells if c.cell_type=='markdown')
    title=re.search(r'^## Lesson [\d.]+ — (.+)$',markdown,re.M).group(1)
    headings=re.findall(r'^## \d+\. (.+)$',markdown,re.M)
    assert normalise(title)==normalise(row['title']),(lid,'title',title,row['title'])
    assert list(map(normalise,headings))==list(map(normalise,row['sections'])),(lid,'subsections',headings,row['sections'])
    assert not re.search(r'\{\{(?:figure|common|hf|cnn|imdb|classifier|attention)',markdown),lid
    code=[c for c in nb.cells if c.cell_type=='code']
    assert all(c.execution_count is not None for c in code),(lid,'unexecuted cell')
    assert all(o.output_type!='error' for c in code for o in c.outputs),lid
    pictures=0
    for cell in nb.cells:
        for attachment in cell.get('attachments',{}).values():
            for mime,payload in attachment.items():
                if mime.startswith('image/'):
                    Image.open(io.BytesIO(base64.b64decode(payload))).verify();pictures+=1
        for output in cell.get('outputs',[]):
            if 'image/png' in output.get('data',{}):
                Image.open(io.BytesIO(base64.b64decode(output.data['image/png']))).verify();pictures+=1
    assert pictures>0,(lid,'no actual image')
    html,_=exporter.from_notebook_node(nb)
    assert 'src="attachment:' not in html,(lid,'offline image unresolved')
    soup=BeautifulSoup((ROOT/f'dist/module-{lid[0]}/lesson-{lid.replace(".","-")}.html').read_text(),'html.parser')
    download=soup.select_one('a[download][href$=".ipynb"]')
    assert download,(lid,'missing app download')
    downloaded=ROOT/'dist'/unquote(download['href'].removeprefix('../'))
    actual=nbformat.read(downloaded,as_version=4);nbformat.validate(actual)
    dcode=[c for c in actual.cells if c.cell_type=='code']
    assert len(code)==len(dcode),lid
    for original,exported in zip(code,dcode):
        assert executable_ast(original.source)==executable_ast(exported.source),(lid,'download changes executable code')
        assert original.outputs==exported.outputs,(lid,'download lost actual outputs')
    for img in soup.select('article.lesson img'):
        url=img.get('src','')
        if url.startswith('../'):
            target=ROOT/'dist'/url.removeprefix('../')
            assert target.is_file(),(lid,'broken web image',url)
        assert img.get('alt'),(lid,'missing alternative text')
    enrichment=yaml.safe_load((ROOT/f'enrichments/{lid}.checkpoints.yaml').read_text())
    assert set(enrichment['sections'])==set(range(1,len(headings)+1)),(lid,'checkpoint coverage')
    report[lid]={'outline_subsections':len(headings),'code_cells':len(code),'images':pictures,
                 'offline_render':'passed','actual_download':'passed'}
assert len(report)==12,len(report)
(ROOT/'docs/curriculum/verification-report.json').write_text(json.dumps(report,indent=2)+'\n')
print(f'{len(report)} notebooks: exact outline coverage, all code executed, {sum(r["images"] for r in report.values())} real images/plots, portable HTML renders, and built downloads verified.')
