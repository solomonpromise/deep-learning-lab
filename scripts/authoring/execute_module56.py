"""Run replacement notes in clean CPU kernels and record reproducible validation.

Execute with the environment installed from notebook_sources/requirements.txt.
Downloads only the public teaching datasets requested by the notebooks.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import sys
import time

import nbformat
from nbclient import NotebookClient

ROOT = Path(__file__).resolve().parents[2]


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('lessons', nargs='+')
    args = parser.parse_args()
    kernels = Path('/tmp/dlp-day56-jupyter/kernels/dlp-day56')
    kernels.mkdir(parents=True, exist_ok=True)
    (kernels/'kernel.json').write_text(json.dumps(dict(
        argv=[sys.executable, '-m', 'ipykernel_launcher', '-f', '{connection_file}'],
        display_name='DLP Day 5/6 verification', language='python')))
    os.environ.update(JUPYTER_PATH='/tmp/dlp-day56-jupyter', MPLCONFIGDIR='/tmp/dlp-matplotlib',
                      OMP_NUM_THREADS='1', OPENBLAS_NUM_THREADS='1', MKL_NUM_THREADS='1')
    work = Path('/tmp/dlp-day56-execution')
    work.mkdir(exist_ok=True)
    # Reuse complete public downloads from earlier course verification.
    fashion = Path('/tmp/dlp-course-execution/data/fashion-mnist')
    if fashion.exists():
        shutil.copytree(fashion, work/'data/fashion', dirs_exist_ok=True)
    shakespeare = Path('/tmp/dlp-course-execution/data/tiny-shakespeare.txt')
    if shakespeare.exists():
        (work/'data/shakespeare').mkdir(parents=True, exist_ok=True)
        shutil.copy2(shakespeare, work/'data/shakespeare/input.txt')
    report_path = ROOT/'docs/curriculum/module56-execution-report.json'
    report = json.loads(report_path.read_text()) if report_path.exists() else {}
    for lid in args.lessons:
        path = ROOT/f'notes/module-{lid[0]}/lesson-{lid}.ipynb'
        nb = nbformat.read(path, as_version=4)
        started = time.time()
        print('RUN', lid, flush=True)
        def completed(cell, cell_index, **kwargs):
            if cell.cell_type == 'code':
                print(f'  {lid}: code cell {cell_index} complete', flush=True)
        try:
            NotebookClient(nb, timeout=1800, kernel_name='dlp-day56',
                on_cell_executed=completed, resources={'metadata': {'path': str(work)}}).execute()
        except Exception:
            failed = Path('/tmp')/f'dlp-failed-{lid}.ipynb'
            nbformat.write(nb, failed)
            print('FAILED notebook saved to', failed, flush=True)
            raise
        nbformat.validate(nb)
        runs = Path('/tmp/dlp-day56-verified-runs')
        runs.mkdir(exist_ok=True)
        nbformat.write(nb, runs/f'{lid}.ipynb')
        # An independent verification run can vary slightly across CPU platforms.
        # Keep the author's internally consistent reference outputs for unchanged
        # experiments, and refresh canonical outputs where executable code changed.
        if not nb.metadata.get('curriculum', {}).get('reference_outputs', False):
            nbformat.write(nb, path)
        code = [c for c in nb.cells if c.cell_type == 'code']
        assert all(c.execution_count is not None for c in code)
        assert not any(o.output_type == 'error' for c in code for o in c.outputs)
        report[lid] = dict(status='passed', code_cells=len(code),
            plot_outputs=sum('image/png' in o.get('data', {}) for c in code for o in c.outputs),
            seconds=round(time.time()-started, 2), python=sys.version.split()[0],
            interpreter=sys.executable, threads=1)
        report_path.write_text(json.dumps(report, indent=2)+'\n')
        print('PASS', lid, report[lid], flush=True)


if __name__ == '__main__':
    main()
