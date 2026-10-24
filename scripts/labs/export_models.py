"""Export trusted teaching checkpoints to small, inspectable browser bundles.

Requires the lab's Python environment. No training or source-folder writes occur.
The browser uses the exact learned weights, preprocessing statistics and thresholds.
"""
import json
from pathlib import Path
import joblib,numpy as np,pandas as pd,torch
from torch import nn
ROOT=Path(__file__).resolve().parents[2]

class MLP(nn.Module):
    def __init__(self,n):
        super().__init__();self.net=nn.Sequential(nn.Linear(n,32),nn.ReLU(),nn.Dropout(.2),nn.Linear(32,16),nn.ReLU(),nn.Dropout(.2),nn.Linear(16,1))
    def forward(self,x):return self.net(x).squeeze(-1)

class Sequence(nn.Module):
    def __init__(self,kind):
        super().__init__();self.rnn={'RNN':nn.RNN,'LSTM':nn.LSTM,'GRU':nn.GRU}[kind](9,64,batch_first=True);self.head=nn.Linear(64,6)
    def forward(self,x):return self.head(self.rnn(x)[0][:,-1])

def write(path,value):
    path.parent.mkdir(parents=True,exist_ok=True);path.write_text(json.dumps(value,separators=(',',':'),allow_nan=False)+'\n')

def main():
    lab=ROOT/'labs/student-dropout';pre=joblib.load(lab/'artifacts/preprocessor.joblib');cfg=json.loads((lab/'artifacts/preprocessor_columns.json').read_text());example=json.loads((lab/'artifacts/example_student.json').read_text())
    encoder=pre.named_transformers_['categories'];scaler=pre.named_transformers_['numbers'];category=[]
    for name,values,infrequent in zip(cfg['nominal'],encoder.categories_,encoder.infrequent_categories_):
        inf=[] if infrequent is None else infrequent.tolist();category.append(dict(name=name,frequent=[float(v) for v in values if v not in inf],has_infrequent=infrequent is not None))
    state=torch.load(lab/'artifacts/mlp.pt',map_location='cpu',weights_only=True);model=MLP(state['net.0.weight'].shape[1]);model.load_state_dict(state);model.eval()
    bundle=dict(threshold=cfg['threshold'],example=example,categories=category,numeric=cfg['numeric'],mean=scaler.mean_.tolist(),scale=scaler.scale_.tolist(),layers=[dict(weight=state[f'net.{i}.weight'].tolist(),bias=state[f'net.{i}.bias'].tolist()) for i in [0,3,6]])
    write(ROOT/'static/labs/student-dropout/model.json',bundle)
    df=pd.read_csv(lab/'data/data.csv',sep=';');df.columns=[c.strip() for c in df.columns];records=df.sample(30,random_state=5)[cfg['nominal']+cfg['numeric']].to_dict('records');records.append(example)
    # Include unseen category mapping, beyond the common in-vocabulary rows.
    records.append({**example,cfg['nominal'][0]:999999})
    with torch.no_grad():expected=model(torch.tensor(pre.transform(pd.DataFrame(records)).astype(np.float32))).sigmoid().tolist()
    tests=dict(student=[dict(row=r,probability=p) for r,p in zip(records,expected)],activity=[])
    lab=ROOT/'labs/activity-recognition';scale=json.loads((lab/'artifacts/scaling.json').read_text());selected=json.loads((lab/'artifacts/app_model.json').read_text())['model'];examples=dict(np.load(lab/'artifacts/examples.npz'));models={};instances={}
    for kind in ['RNN','LSTM','GRU']:
        state=torch.load(lab/'artifacts'/f'{kind.lower()}.pt',map_location='cpu',weights_only=True);models[kind]={k:v.tolist() for k,v in state.items()};model=Sequence(kind);model.load_state_dict(state);model.eval();instances[kind]=model
    write(ROOT/'static/labs/activity-recognition/model.json',dict(**scale,selected=selected,models=models,examples={k:v.tolist() for k,v in examples.items()}))
    mu,sd=np.array(scale['mu']),np.array(scale['sd'])
    for name,window in examples.items():
        x=torch.tensor(((window-mu)/sd)[None].astype(np.float32))
        for kind,model in instances.items():
            with torch.no_grad():prob=model(x).softmax(1)[0].tolist()
            tests['activity'].append(dict(name=name,kind=kind,window=window.tolist(),probabilities=prob))
    write(ROOT/'scripts/labs/inference-fixtures.json',tests)
    print('Exported the MLP and all three recurrent checkpoints; reference predictions saved.')

if __name__=='__main__':
    main()
