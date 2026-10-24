"""Inspect, transcribe and optimize local teaching videos; never modify source files.

Run in a separate media environment with imageio-ffmpeg, av and faster-whisper.
Video binaries and unreviewed transcripts stay under ignored .local-media/.
Only reviewed captions, posters and the teaching placement catalog enter Git.
"""
from __future__ import annotations
import argparse,hashlib,json,os,re,subprocess,time
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
FILES={
 'neural-network-learning':'How_a_Neural_Network_Learns.mp4',
 'cnn-learning':'how-a-cnn-learns.mp4',
 'rnn-learning':'how-an-rnn-learns.mp4',
 'text-representations':'how-networks-learn-from-text.mp4',
 'transformer-overview':'module-6-film-1-what-is-a-transformer.mp4',
 'transformer-inputs':'module-6-film-2-getting-text-ready.mp4',
 'attention-step-by-step':'module-6-film-3-attention-step-by-step.mp4',
 'masks-heads-positions':'module-6-film-4-masks-heads-and-positions.mp4',
 'transformer-block':'module-6-film-5-the-transformer-block.mp4',
 'assembling-language-model':'module-6-film-6-assembling-a-language-model.mp4',
 'training-transformer':'module-6-film-7-training-a-transformer.mp4',
}

def metadata(ffmpeg,p):
    result=subprocess.run([ffmpeg,'-hide_banner','-i',str(p)],capture_output=True,text=True)
    text=result.stderr
    d=re.search(r'Duration: (\d+):(\d+):([\d.]+)',text)
    video=re.search(r'Video: (\w+).*? \b(\d{2,5})x(\d{2,5})\b.*? ([\d.]+) fps',text)
    audio=re.search(r'Audio: (\w+)',text)
    if not d or not video:raise ValueError('Could not inspect video: '+str(p)+'\n'+text)
    return dict(duration_seconds=round(int(d[1])*3600+int(d[2])*60+float(d[3]),3),width=int(video[2]),height=int(video[3]),codec=video[1],fps=float(video[4]),audio_codec=audio[1] if audio else None,pixel_format='yuv420p' if 'yuv420p' in text else '')

def inspect(source,selected):
 import imageio_ffmpeg
 ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();inventory={}
 for key in selected:
  p=source/FILES[key]
  meta=metadata(ffmpeg,p);duration=meta['duration_seconds']
  row=dict(id=key,filename=p.name,source_sha256=hashlib.sha256(p.read_bytes()).hexdigest(),source_bytes=p.stat().st_size,**meta)
  inventory[key]=row;folder=ROOT/'.local-media/review'/key;folder.mkdir(parents=True,exist_ok=True)
  for i in range(16):
   at=2+(duration-4)*i/15
   subprocess.run([ffmpeg,'-nostdin','-hide_banner','-loglevel','error','-ss',str(at),'-i',str(p),'-frames:v','1','-vf','scale=640:-2','-q:v','3','-y',str(folder/f'{i:02d}.jpg')],check=True)
  (folder/'sample-times.json').write_text(json.dumps([round(2+(duration-4)*i/15,2) for i in range(16)]))
  print('INSPECT',key,round(duration,1),row['width'],row['height'],flush=True)
 target=ROOT/'docs/media/video-source-inventory.json';previous=json.loads(target.read_text()) if target.exists() else {};previous.update(inventory);target.write_text(json.dumps(previous,indent=2)+'\n')

def transcribe(source,selected,model_path):
 os.environ['HF_HUB_DISABLE_IMPLICIT_TOKEN']='1'
 from faster_whisper import WhisperModel
 import numpy as np,imageio_ffmpeg
 ffmpeg=imageio_ffmpeg.get_ffmpeg_exe()
 model=WhisperModel(model_path,device='cpu',compute_type='int8',cpu_threads=6)
 folder=ROOT/'.local-media/transcripts';folder.mkdir(parents=True,exist_ok=True)
 for key in selected:
  target=folder/f'{key}.json'
  if target.exists():print('CACHED',key,flush=True);continue
  begin=time.monotonic()
  decoded=subprocess.run([ffmpeg,'-nostdin','-hide_banner','-loglevel','error','-i',str(source/FILES[key]),'-vn','-ac','1','-ar','16000','-f','f32le','pipe:1'],capture_output=True,check=True).stdout
  audio=np.frombuffer(decoded,dtype=np.float32)
  segments,info=model.transcribe(audio,language='en',beam_size=5,vad_filter=True,word_timestamps=True,condition_on_previous_text=False,initial_prompt='An educational lesson about neural networks, PyTorch, CNNs, RNNs, LSTMs, GRUs, tokenization, embeddings, Transformers, queries, keys, values, softmax, layer normalization and backpropagation.')
  rows=[]
  for segment in segments:
   rows.append(dict(start=round(segment.start,3),end=round(segment.end,3),text=segment.text.strip(),words=[dict(start=round(w.start,3),end=round(w.end,3),word=w.word) for w in segment.words or []]))
  target.write_text(json.dumps(dict(model='Systran/faster-whisper-base.en',reviewed=False,segments=rows),indent=2)+'\n')
  print('TRANSCRIBED',key,len(rows),'segments',round(time.monotonic()-begin,1),'seconds',flush=True)

def encode(source,selected):
 import imageio_ffmpeg
 ffmpeg=imageio_ffmpeg.get_ffmpeg_exe();folder=ROOT/'.local-media/encoded';folder.mkdir(parents=True,exist_ok=True)
 inventory_path=ROOT/'docs/media/video-source-inventory.json';inventory=json.loads(inventory_path.read_text())
 for key in selected:
  target=folder/f'{key}.mp4';original=source/FILES[key]
  if not target.exists():
   partial=folder/f'{key}.partial.mp4'
   cmd=[ffmpeg,'-nostdin','-hide_banner','-loglevel','error','-i',str(original),'-map','0:v:0','-map','0:a:0?','-vf',"scale=w='min(1920,iw)':h=-2",'-r',str(min(inventory[key]['fps'],30)),'-c:v','libx264','-preset','medium','-crf','25','-pix_fmt','yuv420p','-c:a','aac','-b:a','96k','-movflags','+faststart','-threads','4','-y',str(partial)]
   subprocess.run(cmd,check=True);partial.replace(target)
  meta=metadata(ffmpeg,target);duration=meta['duration_seconds']
  assert abs(duration-inventory[key]['duration_seconds'])<.15,(key,'duration changed')
  assert meta['codec']=='h264' and meta['pixel_format']=='yuv420p'
  assert meta['audio_codec'],(key,'audio missing')
  row=dict(bytes=target.stat().st_size,sha256=hashlib.sha256(target.read_bytes()).hexdigest(),**meta)
  inventory[key]['web']=row;inventory_path.write_text(json.dumps(inventory,indent=2)+'\n');print('ENCODED',key,row['bytes'],flush=True)

def main():
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('mode',choices=['inspect','transcribe','encode']);ap.add_argument('--source',type=Path,required=True);ap.add_argument('--model',default='/tmp/dlp-video-base-en');ap.add_argument('--ids',nargs='*');args=ap.parse_args();selected=args.ids or list(FILES)
 assert all(k in FILES for k in selected)
 if args.mode=='inspect':inspect(args.source,selected)
 elif args.mode=='transcribe':transcribe(args.source,selected,args.model)
 else:encode(args.source,selected)

if __name__=='__main__':main()
