"""Package the app's actual downloadable notebooks, pinned environment and reference data."""
from pathlib import Path
import json,re,zipfile
ROOT=Path(__file__).resolve().parents[2]
def main():
    paths=[p for p in sorted((ROOT/'dist/notebooks').glob('*.ipynb')) if re.match(r'Lesson_[78]\.',p.name)]
    assert len(paths)==14
    target=ROOT/'docs/curriculum/modules-7-8-notebooks.zip'
    with zipfile.ZipFile(target,'w',zipfile.ZIP_DEFLATED) as z:
        for p in paths:z.write(p,f'module-{p.name[7]}/{p.name}')
        source=ROOT/'scripts/authoring/module78_sources'
        for p in source.glob('requirements*.txt'):z.write(p,p.name)
        z.write(ROOT/'static/notebook-support/module78/requirements.txt','static/notebook-support/module78/requirements.txt')
        z.write(source/'revisions.json','artifact-revisions.json')
        for p in (source/'reference_results').glob('*.json'):z.write(p,'results/'+p.name)
        for filename in ['manifest.json','generation-provenance.json']:z.write(ROOT/'static/img/module78-visuals'/filename,'visuals/'+filename)
        z.writestr('README.txt','''Modules 7 and 8 — 14 replacement self-study notebooks

Read notes and saved outputs offline. All 38 requested figures and seven extra
worked visual companions are embedded. The web app adds paused walkthroughs.
Conceptual diagrams are explanatory; numerical charts identify reference runs.

Class: 7.1–7.5; 8.1–8.5 and 8.7.
Further learning: 7.6, 7.7, 8.6. Section 7 of 8.5 is an extension.

Use Python 3.12. Create a separate environment; install requirements.txt, then
restart the kernel and Run All. Public model/data downloads need internet access.
No paid API is used. Store all lesson notebooks in one working folder if you want
the experiments to share results. If using these module subfolders, move the
provided results folder into your current notebook working folder as needed.
8.4, 8.5 and 8.7 also restore missing reference results from labelled embedded data.
Existing result files are preserved. Execute 8.3–8.5 to write your own comparisons.

results/*.json are ORIGINAL AUTHOR REFERENCE artifacts, not fresh training runs.
Saved notebook outputs likewise preserve the author's CPU reference results,
with approved explanatory corrections. Independent fresh-kernel verification is
recorded in the project, separately from these original results. Timings and
scores can vary across hardware/software. Seeds and revision pins do not ensure
cross-platform exactness. Treat repeatedly inspected test results as teaching
results; obtain a fresh final test before making new model-selection claims.

Original Day 7 and Day 8 notebooks remain unchanged. Corrected canonical copies,
source hashes, image prompts/provenance and verification records live in the repo.
''')
    print('Packaged',len(paths),'notebooks:',target,'bytes:',target.stat().st_size)
if __name__=='__main__':main()
