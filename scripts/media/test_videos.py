"""Run with PYTHONPATH=scripts python -m unittest discover -s scripts/media -p 'test_*.py'."""
import copy,functools,http.client,http.server,json,os,re,tempfile,threading,unittest
from pathlib import Path
from unittest.mock import patch
from types import SimpleNamespace
from dlp.videos import VideoLibrary,VideoError
from dlp.media_server import MediaRequestHandler

ROOT=Path(__file__).resolve().parents[2]

class CatalogTests(unittest.TestCase):
    def setUp(self):
        self.tmp=tempfile.TemporaryDirectory();self.addCleanup(self.tmp.cleanup);self.root=Path(self.tmp.name)
        self.catalog=json.loads((ROOT/'media/videos.json').read_text());self.row=copy.deepcopy(self.catalog['videos'][0]);self.catalog['videos']=[self.row]
        folder=self.root/'static/media/videos'/self.row['id'];folder.mkdir(parents=True)
        for name in ['poster.jpg','captions.en.vtt','transcript.json']:(folder/name).write_bytes((ROOT/'static/media/videos'/self.row['id']/name).read_bytes())
        (self.root/'media').mkdir()
    def library(self):
        (self.root/'media/videos.json').write_text(json.dumps(self.catalog))
        with patch.dict(os.environ,{'DLP_MEDIA_MODE':'remote'}):return VideoLibrary(self.root,self.root/'dist')
    def test_missing_section_rejected(self):
        with self.assertRaisesRegex(VideoError,'no unique section'):self.library().attach(SimpleNamespace(id=self.row['lesson'],sections=[]),None)
    def test_unplaced_video_rejected(self):
        with self.assertRaisesRegex(VideoError,'not found'):self.library().verify_placements()
    def test_unreviewed_content_rejected(self):
        self.row['reviewed']=False
        with self.assertRaisesRegex(VideoError,'reviewed'):self.library()
    def test_unsafe_remote_url_rejected_even_in_auto_mode(self):
        self.row['url']='javascript:alert(1)'
        with self.assertRaisesRegex(VideoError,'HTTPS'):self.library()
    def test_out_of_bounds_transcript_rejected(self):
        p=self.root/'static/media/videos'/self.row['id']/'transcript.json';x=json.loads(p.read_text());x['segments'][0]['end']=99999;p.write_text(json.dumps(x))
        with self.assertRaisesRegex(VideoError,'timing'):self.library()
    def test_caption_timing_and_assets_for_every_video(self):
        with patch.dict(os.environ,{'DLP_MEDIA_MODE':'remote'}):library=VideoLibrary(ROOT,ROOT/'dist')
        def seconds(stamp):
            h,m,s=stamp.split(':');return int(h)*3600+int(m)*60+float(s)
        self.assertEqual(len(library.catalog['videos']),11)
        for row in library.catalog['videos']:
            text=(ROOT/'static/media/videos'/row['id']/'captions.en.vtt').read_text();self.assertTrue(text.startswith('WEBVTT\n'))
            cues=re.findall(r'(\d\d:\d\d:\d\d\.\d{3}) --> (\d\d:\d\d:\d\d\.\d{3})\n([^\n]+)',text);self.assertTrue(cues,row['id']);previous=0
            for a,b,body in cues:
                start,end=seconds(a),seconds(b)
                self.assertGreaterEqual(start,previous-.001,row['id']);self.assertLess(start,end);self.assertLessEqual(end,row['duration_seconds']+.001);previous=end

class RangeTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.tmp=tempfile.TemporaryDirectory();cls.payload=bytes(range(256))*16;(Path(cls.tmp.name)/'clip.mp4').write_bytes(cls.payload)
        class QuietHandler(MediaRequestHandler):
            def log_message(self,*args):pass
        cls.server=http.server.ThreadingHTTPServer(('127.0.0.1',0),functools.partial(QuietHandler,directory=cls.tmp.name));cls.thread=threading.Thread(target=cls.server.serve_forever,daemon=True);cls.thread.start()
    @classmethod
    def tearDownClass(cls):cls.server.shutdown();cls.server.server_close();cls.tmp.cleanup()
    def request(self,range=None,method='GET'):
        conn=http.client.HTTPConnection('127.0.0.1',self.server.server_port);conn.request(method,'/clip.mp4',headers={'Range':range} if range else {});r=conn.getresponse();result=(r.status,dict(r.getheaders()),r.read());conn.close();return result
    def test_exact_range(self):
        status,headers,data=self.request('bytes=200-299');self.assertEqual(status,206);self.assertEqual(data,self.payload[200:300]);self.assertEqual(headers['Content-Range'],'bytes 200-299/4096')
    def test_suffix_and_open_range(self):
        self.assertEqual(self.request('bytes=-10')[2],self.payload[-10:]);self.assertEqual(self.request('bytes=4000-')[2],self.payload[4000:])
    def test_out_of_bounds_and_invalid_range(self):
        for header in ['bytes=9000-','bytes=9-1','bytes=-0','bytes=0-1,9-10']:
            status,headers,data=self.request(header);self.assertEqual(status,416,header);self.assertEqual(data,b'')
    def test_head_and_whole_file(self):
        status,headers,data=self.request('bytes=0-10','HEAD');self.assertEqual(status,206);self.assertEqual(headers['Content-Length'],'11');self.assertEqual(data,b'')
        self.assertEqual(self.request()[2],self.payload)

if __name__=='__main__':unittest.main()
