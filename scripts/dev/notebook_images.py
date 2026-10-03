"""Verify real app downloads contain portable figures and preserve saved outputs.

Build and serve first, then run:
python scripts/dev/notebook_images.py --base http://localhost:8794/ --compare-ref HEAD
"""
import argparse
import base64
import io
import json
import subprocess
from pathlib import Path
from urllib.parse import urljoin
from urllib.request import urlopen

import nbformat
from nbconvert import HTMLExporter
from bs4 import BeautifulSoup
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--base', default='http://localhost:8000/')
    parser.add_argument('--compare-ref', help='Also verify code and outputs against this Git revision')
    args = parser.parse_args()
    manifest = json.loads((ROOT / 'static/img/course-figures/figures.json').read_text())
    module5 = json.loads((ROOT / 'static/img/module-5/figures.json').read_text())
    manifest += [dict(number=number, lesson='.'.join(number.split('.')[:2]), **row)
                 for number, row in module5.items()]
    diagrams = outputs = lessons = 0
    for path in sorted((ROOT / 'notes').glob('module-*/*.ipynb')):
        lid = path.stem.removeprefix('lesson-')
        if not lid[0].isdigit():
            continue
        source = json.loads(path.read_text())
        lesson_url = urljoin(args.base, f'module-{lid.split(".")[0]}/lesson-{lid.replace(".", "-")}.html')
        page = BeautifulSoup(urlopen(lesson_url).read(), 'html.parser')
        link = page.select_one('a[download][href$=".ipynb"]')
        assert link, f'{lid}: missing notebook download'
        downloaded = json.loads(urlopen(urljoin(lesson_url, link['href'])).read())
        nbformat.validate(nbformat.from_dict(downloaded))
        # Check an actual offline notebook render, not just the presence of bytes.
        rendered, _ = HTMLExporter().from_notebook_node(nbformat.reads(json.dumps(downloaded), as_version=4))
        assert len(source['cells']) == len(downloaded['cells']), lid
        original = None
        if args.compare_ref:
            original = json.loads(subprocess.check_output(
                ['git', 'show', f'{args.compare_ref}:{path.relative_to(ROOT)}'], cwd=ROOT))
            assert len(original['cells']) == len(source['cells']), lid
        for index, (cell, exported) in enumerate(zip(source['cells'], downloaded['cells'])):
            assert cell.get('attachments') == exported.get('attachments'), f'{lid}:{index}: attachments'
            assert cell.get('outputs') == exported.get('outputs'), f'{lid}:{index}: saved outputs'
            if original and cell['cell_type'] == 'code':
                assert cell['source'] == original['cells'][index]['source'], f'{lid}:{index}: code changed'
                assert cell.get('outputs') == original['cells'][index].get('outputs'), f'{lid}:{index}: results changed'
            elif original and not any(key in cell.get('metadata', {}) for key in ['dlp_figure', 'dlp_figure_label']):
                assert cell['source'] == original['cells'][index]['source'], f'{lid}:{index}: prose changed'
            for output in exported.get('outputs', []):
                if 'image/png' in output.get('data', {}):
                    Image.open(io.BytesIO(base64.b64decode(output['data']['image/png']))).verify()
                    outputs += 1
            number = cell.get('metadata', {}).get('dlp_figure')
            if not number:
                continue
            name = f'figure-{number}.png'
            png_b64 = exported['attachments'][name]['image/png']
            assert f'attachment:{name}' not in rendered, f'{number}: unresolved offline image'
            assert f'data:image/png;base64,{png_b64}' in rendered, f'{number}: missing offline PNG'
            row = next((r for r in manifest if r['number'] == number), None)
            assert row is not None and row['lesson'] == lid
            if 'cell' in row:
                assert row['cell'] == index
            name = f'figure-{number}.png'
            assert f'attachment:{name}' in ''.join(exported['source'])
            png = base64.b64decode(exported['attachments'][name]['image/png'])
            with Image.open(io.BytesIO(png)) as image:
                assert image.width == 1920, number
                image.verify()
            figures = [f for f in page.select('figure') if f.select_one('figcaption') and
                       f.select_one('figcaption').get_text().startswith(f'Figure {number}.')]
            assert len(figures) == 1, f'{number}: missing/duplicate web figure'
            assert figures[0].img['alt'] == row['alt'], number
            assert row['caption'] in figures[0].get_text(), number
            with Image.open(io.BytesIO(urlopen(urljoin(lesson_url, figures[0].img['src'])).read())) as image:
                assert image.width == 1920, number
                image.verify()
            diagrams += 1
        lessons += 1
    assert diagrams == len(manifest) == 42
    print(f'{lessons} real notebook downloads: {diagrams} portable teaching diagrams; '
          f'{outputs} saved plot/photo outputs intact. All notebooks valid.')


if __name__ == '__main__':
    main()
