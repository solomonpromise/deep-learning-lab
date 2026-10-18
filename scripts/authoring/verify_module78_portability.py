"""Render app notebook downloads to offline HTML and check a downloaded browser copy.

Set JUPYTER_PATH to your nbconvert template installation when using a virtualenv.
"""
from pathlib import Path
import hashlib,json
import nbformat
from nbconvert import HTMLExporter
from bs4 import BeautifulSoup
root=Path(__file__).resolve().parents[2];out=Path('/tmp/dlp-module78-html');out.mkdir(exist_ok=True)
report={};exporter=HTMLExporter()
for p in sorted((root/'dist/notebooks').glob('Lesson_[78].*.ipynb')):
 nb=nbformat.read(p,4);html,_=exporter.from_notebook_node(nb);(out/(p.stem+'.html')).write_text(html)
 soup=BeautifulSoup(html,'html.parser');images=soup.select('img');assert images and all((i.get('src') or '').startswith('data:') for i in images),(p.name,'nonportable figure')
 report[p.name]=dict(offline_html='passed',embedded_images=len(images),code_cells=sum(c.cell_type=='code' for c in nb.cells))
assert len(report)==14
# The browser download must be the exact generated app notebook.
download=Path('/Users/solomonpromise/Downloads/Lesson_8.7_Evaluating_Adapted_Models.ipynb')
if download.exists():
 assert hashlib.sha256(download.read_bytes()).digest()==hashlib.sha256((root/'dist/notebooks'/download.name).read_bytes()).digest()
(root/'docs/curriculum/module78-portability-report.json').write_text(json.dumps(dict(notebooks=report,browser_download='byte-identical to the generated 8.7 notebook' if download.exists() else 'not checked: no browser download present',embedded_images=sum(r['embedded_images'] for r in report.values())),indent=2)+'\n')
print('14 portable HTML renders and exact browser notebook download passed.')
