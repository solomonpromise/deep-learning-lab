"""Verify migration fidelity, answered exercises, routes and real app downloads."""
from pathlib import Path
import ast
import hashlib
import json
import re
import sys
from urllib.parse import unquote

import nbformat
from bs4 import BeautifulSoup
import yaml
from module56_edits import edit

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT/'scripts'))
from dlp.notebook import LessonParser
from dlp.render import AssetStore, MarkdownRenderer
from dlp.text import Terminology


def executable(source):
    """Ignore documentation additions when comparing executable Python."""
    tree = ast.parse(source)
    for node in ast.walk(tree):
        if isinstance(node, (ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            if node.body and isinstance(node.body[0], ast.Expr) and isinstance(node.body[0].value, ast.Constant) and isinstance(node.body[0].value.value, str):
                node.body = node.body[1:]
    return ast.dump(tree, include_attributes=False)


def main():
    sources = json.loads((ROOT/'scripts/authoring/notebook_sources/manifest.json').read_text())
    runs = json.loads((ROOT/'docs/curriculum/module56-execution-report.json').read_text())
    visuals = json.loads((ROOT/'docs/curriculum/module56-visual-requests.json').read_text())
    cfg = yaml.safe_load((ROOT/'course.yaml').read_text())
    assert len(sources) == len(runs) == 12
    assert len(visuals) == 37
    assert len({v['id'] for v in visuals}) == 37
    image_manifest = json.loads((ROOT/'static/img/module56-visuals/manifest.json').read_text())
    assert set(image_manifest) == {v['id'] for v in visuals}
    assert all(v['status'] == 'complete' for v in visuals)
    for row in image_manifest.values():
        assert row['reviewed']
        assert hashlib.sha256((ROOT/row['file']).read_bytes()).hexdigest() == row['sha256']
    module6 = next(m for m in cfg['modules'] if m['number'] == 6)
    assert module6['classroom_lessons'] == [f'6.{i}' for i in range(1, 7)]
    assert not module6.get('further_learning_lessons')
    report = {}
    for lid, row in sources.items():
        original = Path(row['source'])
        assert hashlib.sha256(original.read_bytes()).hexdigest() == row['sha256'], (lid, 'author source changed')
        assert hashlib.sha256((ROOT/row['snapshot']).read_bytes()).hexdigest() == row['sha256']
        path = ROOT/f'notes/module-{lid[0]}/lesson-{lid}.ipynb'
        nb = nbformat.read(path, as_version=4)
        nbformat.validate(nb)
        markdown = '\n'.join(c.source for c in nb.cells if c.cell_type == 'markdown')
        assert '🖼' not in markdown, (lid, 'image brief leaked into learner prose')
        for number,visual_row in image_manifest.items():
            if visual_row['lesson'] != lid: continue
            cell = next(c for c in nb.cells if c.metadata.get('author_source_cell') == visual_row['source_cell'])
            filename = Path(visual_row['file']).name
            assert f'attachment:{filename}' in cell.source
            import base64
            payload=base64.b64decode(cell.attachments[filename]['image/png'])
            assert hashlib.sha256(payload).hexdigest() == visual_row['sha256'], (number,'attachment mismatch')
        if lid.startswith('6.'):
            assert '*(Extension)*' not in markdown
        codes = [c for c in nb.cells if c.cell_type == 'code']
        source_nb = nbformat.read(ROOT/row['snapshot'], as_version=4)
        expected_code = [edit(lid, i, c.source, 'code')
                         for i, c in enumerate(source_nb.cells) if c.cell_type == 'code']
        assert [executable(c.source) for c in codes] == [executable(c) for c in expected_code], (lid, 'unreviewed executable change')
        assert runs[lid]['status'] == 'passed' and runs[lid]['code_cells'] == len(codes)
        assert all(c.execution_count is not None for c in codes)
        assert not any(o.output_type == 'error' for c in codes for o in c.outputs)
        enrichment = yaml.safe_load((ROOT/f'enrichments/{lid}.yaml').read_text())
        parser = LessonParser(MarkdownRenderer(Terminology([])), Terminology([]))
        parsed = parser.parse(path, lid, AssetStore(Path('/tmp/dlp-migration-check'), 'assets'), '../', '', docstrings=enrichment['docstrings'])
        assert not parsed.doc_missing and not parsed.doc_thin, (lid, parsed.doc_missing, parsed.doc_thin)
        checkpoints = yaml.safe_load((ROOT/f'enrichments/{lid}.checkpoints.yaml').read_text())
        assert set(checkpoints['sections']) == {s.num for s in parsed.sections if s.num is not None}
        question_ids = {b['id'] for s in parsed.sections for b in s.blocks if b['kind'] == 'questions'}
        assert question_ids == set(enrichment['answers']), (lid, 'missing worked answers')
        html_path = ROOT/f'dist/module-{lid[0]}/lesson-{lid.replace(".", "-")}.html'
        soup = BeautifulSoup(html_path.read_text(), 'html.parser')
        assert soup.select_one('h1.lesson-title').get_text(' ', strip=True) == parsed.title
        download = soup.select_one('a[download][href$=".ipynb"]')
        exported = nbformat.read(ROOT/'dist'/unquote(download['href'].removeprefix('../')), as_version=4)
        exported_code = [c for c in exported.cells if c.cell_type == 'code']
        assert len(codes) == len(exported_code)
        for a, b in zip(codes, exported_code):
            assert executable(a.source) == executable(b.source), (lid, 'changed downloadable executable')
            assert a.outputs == b.outputs, (lid, 'downloaded outputs changed')
        assert len(soup.select('.checkpoint')) == len(checkpoints['sections']), (lid, 'web checkpoint count')
        for item in enrichment.get('inserts',[]):
            if item.get('name') == 'concept-motion':
                assert soup.select_one(f'#s{item["section"]} [data-widget="concept-motion"]'), (lid,item)
        report[lid] = dict(numbered_sections=len(checkpoints['sections']), code_cells=len(codes),
                           worked_checks=len(question_ids), source_unchanged=True, execution='passed', download='passed')
    assert sum(r['numbered_sections'] for r in report.values()) == 84
    assert sum(r['code_cells'] for r in report.values()) == 201
    bank_text = (ROOT/'dist/static/question-bank.js').read_text()
    bank = json.loads(bank_text.removeprefix('window.DLP_BANK=').strip().removesuffix(';'))
    for question in bank:
        if question['l'].startswith(('5.', '6.')):
            assert question['id'].endswith(':day56-v3'), question['id']
        else:
            assert not question['id'].endswith(':day56-v3'), question['id']
    retired = BeautifulSoup((ROOT/'dist/module-6/lesson-6-7.html').read_text(), 'html.parser')
    assert retired.select_one('meta[http-equiv="refresh"]')['content'].endswith('lesson-6-1.html#s8')
    body = BeautifulSoup((ROOT/'dist/module-6/index.html').read_text(), 'html.parser')
    assert not body.select('a[href="lesson-6-7.html"]')
    checks = ROOT/'docs/curriculum/module56-verification-report.json'
    checks.write_text(json.dumps(report, indent=2)+'\n')
    print('12 replacement notebooks: 84 sections, 201 executed cells, complete worked answers, unchanged author sources and valid app downloads.')


if __name__ == '__main__':
    main()
