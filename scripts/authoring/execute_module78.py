"""Independently execute corrected Module 7/8 notes in fresh kernels.

Use the pinned Python 3.12 environment. All execution writes go to /tmp.
Author source files and their reference outputs remain unchanged.
"""
import argparse,json,os,sys,time
from pathlib import Path
import nbformat
from nbclient import NotebookClient
ROOT=Path(__file__).resolve().parents[2]

def main():
    ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('lessons',nargs='+');ap.add_argument('--report',default='docs/curriculum/module78-execution-report.json');ap.add_argument('--workdir',default='/tmp/dlp-module78-execution');args=ap.parse_args()
    work=Path(args.workdir);work.mkdir(exist_ok=True)
    kernels=Path('/tmp/dlp-module78-jupyter/kernels/dlp-module78');kernels.mkdir(parents=True,exist_ok=True)
    (kernels/'kernel.json').write_text(json.dumps(dict(argv=[sys.executable,'-m','ipykernel_launcher','-f','{connection_file}'],display_name='Module 7/8 independent verification',language='python')))
    os.environ.update(JUPYTER_PATH='/tmp/dlp-module78-jupyter',MPLCONFIGDIR='/tmp/dlp-matplotlib',OMP_NUM_THREADS='1',MKL_NUM_THREADS='1',OPENBLAS_NUM_THREADS='1',PYTHONDONTWRITEBYTECODE='1',HF_HOME='/tmp/dlp-module78-hf',HF_HUB_DISABLE_IMPLICIT_TOKEN='1')
    reportfile=ROOT/args.report;report=json.loads(reportfile.read_text()) if reportfile.exists() else {}
    runs=Path('/tmp/dlp-module78-verified-runs');runs.mkdir(exist_ok=True)
    for lid in args.lessons:
        p=ROOT/f'notes/module-{lid[0]}/lesson-{lid}.ipynb';nb=nbformat.read(p,as_version=4);started=time.time()
        for c in nb.cells:
            if c.cell_type=='code':c.execution_count=None;c.outputs=[]
        print('RUN',lid,flush=True)
        def done(cell,cell_index,**kwargs):
            if cell.cell_type=='code':print(' ',lid,'cell',cell_index,'complete',flush=True)
        try:
            NotebookClient(nb,timeout=2400,kernel_name='dlp-module78',on_cell_executed=done,resources={'metadata':{'path':str(work)}}).execute()
        except Exception as e:
            nbformat.write(nb,runs/f'failed-{lid}.ipynb');report[lid]=dict(status='failed',error=str(e)[-2000:]);reportfile.write_text(json.dumps(report,indent=2)+'\n');raise
        codes=[c for c in nb.cells if c.cell_type=='code'];assert all(c.execution_count is not None for c in codes);assert not any(o.output_type=='error' for c in codes for o in c.outputs)
        nbformat.write(nb,runs/f'{lid}.ipynb')
        report[lid]=dict(status='passed',code_cells=len(codes),seconds=round(time.time()-started,2),python=sys.version.split()[0],outputs='independent run retained separately; canonical outputs are labelled author reference results')
        reportfile.write_text(json.dumps(report,indent=2)+'\n');print('PASS',lid,report[lid],flush=True)

if __name__=='__main__':main()
