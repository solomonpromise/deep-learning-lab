"""Import the reviewed Day 5/6 snapshots into the app's canonical notebooks.

Run before scripts/build.py. Original author files and their snapshots stay intact.
Image briefs are inventoried for the subsequent visual pass, not shown as prose.
Only existing, reviewed figures are reused during this content migration.
"""
from pathlib import Path
import argparse
import base64
import hashlib
import json
import re
import sys

import nbformat
import yaml

from module56_edits import edit
from module56_checks import questions
from module56_docstrings import docstrings
from module56_visuals import CAPTIONS, attachment, inserts, load_manifest, add_worked_figures

ROOT = Path(__file__).resolve().parents[2]
SOURCES = Path(__file__).parent / 'notebook_sources'
TITLES = {5: 'Learning Representations from Images and Text', 6: 'Transformers and Attention Mechanisms'}
REUSE = {
    '5.2.1': ('cnn-whole.png', 'Conceptual CNN pipeline from an image through convolution and pooling to learned features and class scores.', 'A CNN learns local, shared filters before a classifier combines their features. This overview is schematic; the exact dimensions of this lesson\'s model are traced in section 4.'),
    '5.4.1': ('rnn-unrolled.png', 'An RNN applies the same update cell across a sequence, carrying a changing hidden state forward.', 'The update weights are shared across steps; the hidden state changes with the input and previous state.'),
    '6.5.2': ('transformer-whole.png', 'An encoder-decoder Transformer connects source representations to causal decoder blocks through cross-attention.', 'The source is encoded once. The decoder combines causal target self-attention with cross-attention to the encoded source. Residual connections and normalisation are omitted from this overview.'),
}
PROMPT = re.compile(r'^>\s*🖼️?\s*\*IMAGE\s+([\d.]+)\s*[—–-]\s*([^\n]+)$', re.M)
CHECK = re.compile(r'^>\s*\*\*Check yourself (\d+)\.\*\*\s*(.+)$', re.M)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('modules', type=int, nargs='*', default=[5, 6])
    args = parser.parse_args()
    if any(m not in [5, 6] for m in args.modules):
        parser.error('This importer accepts only modules 5 and 6.')
    manifest = json.loads((SOURCES / 'manifest.json').read_text())
    results_file = SOURCES / 'results_adjustments.json'
    adjustments = json.loads(results_file.read_text()) if results_file.exists() else {}
    inventory = []
    visual_manifest = load_manifest(ROOT)
    for module in args.modules:
        candidates = []
        for path in sorted(SOURCES.glob(f'{module}.*.ipynb')):
            lid = path.stem
            source = nbformat.read(path, as_version=4)
            old_code = [c.source for c in source.cells if c.cell_type == 'code']
            # The author's answer appendix is attached next to each question in the
            # portable notebook; the app uses its existing reveal-answer controls.
            appendix = next(c.source for c in source.cells if c.source.startswith('## Answers to Check Yourself'))
            answers = {int(n): a.strip() for n, a in re.findall(r'^\*\*(\d+)\.\*\*\s*(.*?)(?=^\*\*\d+\.\*\*|\Z)', appendix, re.M | re.S)}
            title = source.cells[0].source.splitlines()[0].split(' ', 2)[2]
            cells, checks, section, question_answers = [], [], 0, {}
            for index, original in enumerate(source.cells):
                if original.source.startswith('## Answers to Check Yourself'):
                    continue
                cell = nbformat.from_dict(dict(original))
                text = edit(lid, index, original.source, cell.cell_type)
                for old, new in adjustments.get(lid, {}).get(str(index), []):
                    assert old in text, (lid, index, old)
                    text = text.replace(old, new)
                if cell.cell_type == 'markdown':
                    if index == 1:
                        text += '''

**Environment and results.** The saved outputs record one CPU reference run; random seeds reduce variation but do not guarantee identical numbers across computers. Read the comparisons as evidence from that run. Training times depend on your hardware.

If packages are missing, install them into your notebook environment, then restart the kernel and run from the beginning:

```text
%pip install torch==2.14.1 numpy==2.5.4 pandas==3.0.6 matplotlib==3.11.2 scikit-learn==1.9.1 scipy==1.18.1
```
'''
                    if index == 0:
                        text = re.sub(r'^# .*\n', f'# Module {module} — {TITLES[module]}\n\n## Lesson {lid} — {title}\n', text, count=1)
                        text = re.sub(r'\*\*Module \d+ · Note \d+\*\*\n', '', text)
                        text = re.sub(r'\*\*By the end of this note you will be able to:\*\*', '### Learning objectives', text)
                        text = text.replace('**Before you start:**', '### Prerequisites\n\n')
                        # The source's key question is also the short course-map summary.
                        goal = re.search(r'\*\*Key question:\*\*\s*\*(.*?)\*', text).group(1)
                    numbered = re.search(r'^## (\d+)\.', text, re.M)
                    if numbered:
                        section = int(numbered[1])
                    for match in PROMPT.finditer(text):
                        inventory.append(dict(id=match[1], lesson=lid, section=section, source_cell=index,
                                              prompt=match[2], status='complete' if match[1] in visual_manifest else ('existing illustration reused' if match[1] in REUSE else 'planned')))
                    figures = []
                    def visual(match):
                        number = match[1]
                        if number in visual_manifest:
                            row = visual_manifest[number]
                            filename, payload = attachment(ROOT, row)
                            figures.append((filename, payload))
                            return f'![{row["alt"]}](attachment:{filename})\n\n*Figure {number}. {CAPTIONS[number]}*'
                        if number not in REUSE:
                            return ''
                        filename, alt, caption = REUSE[number]
                        payload = base64.b64encode((ROOT/'static/img/curriculum-v2'/filename).read_bytes()).decode()
                        figures.append((filename, payload))
                        return f'![{alt}](attachment:{filename})\n\n*Figure {number}. {caption}*'
                    text = PROMPT.sub(visual, text)
                    def check(match):
                        n, question = int(match[1]), match[2].strip()
                        answer = edit(lid, -n, answers[n], 'markdown')
                        for old, new in adjustments.get(lid, {}).get('answers', []):
                            answer = answer.replace(old, new)
                        checks.append((section, question, answer))
                        return f'**Check yourself.**\n\n1. {question}\n\n<details>\n<summary>Worked answer</summary>\n\n{answer}\n\n</details>'
                    text = CHECK.sub(check, text)
                    if figures:
                        cell.attachments = {name: {'image/png': payload} for name, payload in figures}
                cell.source = text.strip()
                cell.metadata['author_source_cell'] = index
                cells.append(cell)
            assert len(checks) == len(answers), (lid, len(checks), len(answers))
            cells = add_worked_figures(cells, lid, ROOT)
            nb = nbformat.v4.new_notebook(cells=cells, metadata=source.metadata)
            nb.metadata['curriculum'] = dict(version=3, source=manifest[lid]['source'],
                snapshot=manifest[lid]['snapshot'], source_sha256=manifest[lid]['sha256'], coverage='classroom')
            target = ROOT/f'notes/module-{module}/lesson-{lid}.ipynb'
            target.parent.mkdir(exist_ok=True)
            new_code = [c for c in nb.cells if c.cell_type == 'code']
            executable_changed = old_code != [c.source for c in new_code]
            nb.metadata['curriculum']['reference_outputs'] = not executable_changed
            # Preserve freshly verified output when rebuilding prose/assessments.
            previous = nbformat.read(target, as_version=4) if target.exists() else None
            pcode = [c for c in previous.cells if c.cell_type == 'code'] if previous else []
            if executable_changed and previous and previous.metadata.get('curriculum', {}).get('version') == 3 and [c.source for c in pcode] == [c.source for c in new_code]:
                for before, after in zip(pcode, new_code):
                    after.execution_count, after.outputs = before.execution_count, before.outputs
            elif executable_changed:
                for cell in new_code:
                    cell.execution_count, cell.outputs = None, []
            nbformat.validate(nb)
            nbformat.write(nb, target)
            sys.path.insert(0, str(ROOT/'scripts'))
            from dlp.notebook import LessonParser
            from dlp.render import MarkdownRenderer, AssetStore
            from dlp.text import Terminology
            parsed = LessonParser(MarkdownRenderer(Terminology([])), Terminology([])).parse(
                target, lid, AssetStore(Path('/tmp/dlp-new-notes-assets'), 'assets'), '../', TITLES[module])
            for sec in parsed.sections:
                qs = [b for b in sec.blocks if b['kind'] == 'questions']
                expected = [a for n, _, a in checks if n == sec.num]
                assert len(qs) == len(expected), (lid, sec.id, len(qs), len(expected))
                for q, answer in zip(qs, expected):
                    question_answers[q['id']] = [answer]
            cps = questions(lid)
            sections = [s for s in parsed.sections if s.num is not None]
            assert len(cps) == len(sections), (lid, len(cps), len(sections))
            cpdata = {s.num: dict(questions=[q]) for s, q in zip(sections, cps)}
            # Preserve the author's summaries and glossary within the lesson. The
            # app wrap-up adds only a short assessment, not another duplicate summary.
            enrichment = dict(summary=goal, answers=question_answers, portable_notebook_checks=True,
                              assessment_revision='day56-v3',
                              inserts=inserts(lid),
                              docstrings=docstrings(nb),
                              quiz=[cps[i] for i in sorted(set([0, len(cps)//2, len(cps)-1]))])
            (ROOT/f'enrichments/{lid}.yaml').write_text(yaml.safe_dump(enrichment, sort_keys=False, allow_unicode=True))
            (ROOT/f'enrichments/{lid}.checkpoints.yaml').write_text(yaml.safe_dump(
                dict(skill=title, sections=cpdata, assessment_revision='day56-v3'), sort_keys=False, allow_unicode=True))
            candidates.append((lid, cps))
            print(lid, title, '|', len(sections), 'sections |', len(checks), 'answered checks')
        selected = []
        for depth in range(2):
            for lid, cps in candidates:
                if len(selected) == 8:
                    break
                sec = min(depth, len(cps)-1)
                q = dict(cps[sec]); q['why'] += f' Reread Lesson {lid}, section {sec+1}.'
                selected.append(q)
        (ROOT/f'enrichments/module-{module}.challenge.yaml').write_text(yaml.safe_dump(
            dict(title=f'Module {module} challenge: {TITLES[module]}', pass_mark=0.75, questions=selected,
                 assessment_revision='day56-v3'),
            sort_keys=False, allow_unicode=True))
    out = ROOT/'docs/curriculum/module56-visual-requests.json'
    prior = json.loads(out.read_text()) if out.exists() else []
    inventory += [r for r in prior if int(r['lesson'][0]) not in args.modules]
    out.write_text(json.dumps(sorted(inventory, key=lambda r: tuple(map(int, r['id'].split('.')))), indent=2, ensure_ascii=False)+'\n')


if __name__ == '__main__':
    main()
