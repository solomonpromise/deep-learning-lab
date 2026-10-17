"""Package the actual built notebook downloads, with their environment instructions."""
from pathlib import Path
import re
import zipfile

ROOT = Path(__file__).resolve().parents[2]


def main():
    notebooks = [p for p in sorted((ROOT/'dist/notebooks').glob('*.ipynb'))
                 if re.match(r'Lesson_([56])\.', p.name)]
    assert len(notebooks) == 12, [str(p) for p in notebooks]
    focused=ROOT/'docs/curriculum/modules-5-6-notebooks.zip'
    with zipfile.ZipFile(focused,'w',zipfile.ZIP_DEFLATED) as archive:
        selected=[p for p in notebooks if re.match(r'Lesson_[56]\.',p.name)]
        assert len(selected)==12
        for path in selected:
            module=re.match(r'Lesson_(\d+)\.',path.name)[1]
            archive.write(path,f'module-{module}/{path.name}')
        archive.write(ROOT/'scripts/authoring/notebook_sources/requirements.txt','requirements.txt')
        archive.write(ROOT/'static/img/module56-visuals/provenance.json','image-prompts-and-provenance.json')
        archive.writestr('README.txt','''Modules 5–6: 12 replacement self-study notebooks

All 37 requested generated illustrations and six additional numerical worked
figures are embedded with captions. Saved reference outputs are included.
All Module 6 lessons and sections are classroom material.

For execution, install requirements.txt in a separate notebook environment.
Initial public dataset downloads require network access. Reading saved outputs
and images works offline. Numerical results may differ across hardware/software.
The web app adds six paused step-by-step visual walkthroughs; their static worked
companions are embedded here. Conceptual illustrations are not measured results.
''')
    print(f'Packaged 12 replacement notebook downloads: {focused.relative_to(ROOT)}')


if __name__ == '__main__':
    main()
