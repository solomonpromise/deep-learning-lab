"""Publish project notebooks and small runnable demos alongside the lesson curriculum."""
from __future__ import annotations
import json,re,shutil,zipfile
from pathlib import Path
from .render import AssetStore
from .notebook import LessonParser

STUDENT_FIELDS=[
 dict(name='Age at enrollment',label='Age at enrolment',min=17,max=70,step=1),
 dict(name='Curricular units 1st sem (enrolled)',label='First-semester units enrolled',min=0,max=26,step=1),
 dict(name='Curricular units 1st sem (approved)',label='First-semester units passed',min=0,max=26,step=1),
 dict(name='Curricular units 1st sem (grade)',label='First-semester average grade (0–20)',min=0,max=20,step='any'),
]

def load_projects(root:Path):
    path=root/'labs/catalog.json'
    if not path.exists():return []
    projects=json.loads(path.read_text())['labs'];ids=set()
    for project in projects:
        identifier=project['id']
        if not re.fullmatch('[a-z0-9]+(?:-[a-z0-9]+)*',identifier) or identifier in ids:raise ValueError('Invalid or duplicate project ID')
        ids.add(identifier)
        for name in ['lab.ipynb','app.py','requirements.txt','README.md']:
            if not (root/'labs'/identifier/name).is_file():raise ValueError(f'Missing project file: {identifier}/{name}')
        project.update(url=f'projects/{identifier}.html',notebook_url=f'../downloads/{identifier}/lab.ipynb',bundle_url=f'../downloads/{identifier}.zip')
    return projects

def build_projects(builder,common,flat,search_docs):
    projects=common['projects'];root=Path(__file__).resolve().parents[2]
    builder._page('projects.html','projects.html',root='',page='projects',**common)
    lookup={lesson['id']:lesson for lesson in flat}
    for project in projects:
        folder=root/'labs'/project['id'];download=builder.dist/'downloads'/project['id'];download.mkdir(parents=True,exist_ok=True)
        project['related']=[]
        for identifier in project['lessons']:
            if identifier not in lookup:raise ValueError('Unknown related lesson: '+identifier)
            project['related'].append(lookup[identifier])
        # Explicit import folders contain only teaching code, small artifacts and attributed data.
        for source in folder.rglob('*'):
            if source.is_file() and not any(x.startswith('.') or x=='__pycache__' for x in source.relative_to(folder).parts):
                target=download/source.relative_to(folder);target.parent.mkdir(parents=True,exist_ok=True);shutil.copy2(source,target)
        with zipfile.ZipFile(builder.dist/'downloads'/f"{project['id']}.zip",'w',zipfile.ZIP_DEFLATED) as archive:
            for source in sorted(download.rglob('*')):
                if source.is_file():archive.write(source,project['id']+'/'+str(source.relative_to(download)))
        store=AssetStore(builder.dist/'assets/projects'/project['id'],f"assets/projects/{project['id']}")
        # Separate IDs keep project reading and code out of the course's lesson/progress counts.
        parser=LessonParser(builder.renderer,builder.term)
        lab=parser.parse(folder/'lab.ipynb',f"0.{project['number']}",store,'../','Project labs');store.write()
        builder._page('project.html',project['url'],root='../',page='project',project=project,lab=lab,student_fields=STUDENT_FIELDS,**common)
        for section in lab.sections:
            search_docs.append(dict(l=f"Lab {project['number']}",lt=project['title'],s=section.title,u=project['url']+'#'+section.id,x=' '.join(section.plain)[:1400]))
