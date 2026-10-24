"""Local preview handler with single byte ranges for native video seeking."""
from __future__ import annotations
import http.server
import re
from pathlib import Path

class MediaRequestHandler(http.server.SimpleHTTPRequestHandler):
    def send_head(self):
        self._media_range=None
        header=self.headers.get('Range')
        path=Path(self.translate_path(self.path))
        # Ordinary files and conditional requests retain the standard library behavior.
        if not header or path.suffix.lower()!='.mp4' or not path.is_file() or self.headers.get('If-Range'):
            return super().send_head()
        size=path.stat().st_size
        match=re.fullmatch(r'bytes=(\d*)-(\d*)',header)
        start=end=None
        if match and any(match.groups()):
            a,b=match.groups()
            if a:start=int(a);end=min(int(b),size-1) if b else size-1
            else:start=max(0,size-int(b));end=size-1
        if start is None or not (0<=start<=end<size):
            self.send_response(416);self.send_header('Content-Range',f'bytes */{size}');self.send_header('Content-Length','0');self.end_headers();return None
        stream=path.open('rb');stream.seek(start);self._media_range=(start,end)
        self.send_response(206)
        self.send_header('Content-Type','video/mp4');self.send_header('Accept-Ranges','bytes')
        self.send_header('Content-Range',f'bytes {start}-{end}/{size}')
        self.send_header('Content-Length',str(end-start+1));self.end_headers()
        return stream

    def copyfile(self,source,outputfile):
        if self._media_range is None:return super().copyfile(source,outputfile)
        remaining=self._media_range[1]-self._media_range[0]+1
        try:
            while remaining:
                chunk=source.read(min(65536,remaining))
                if not chunk:break
                outputfile.write(chunk);remaining-=len(chunk)
        except (BrokenPipeError,ConnectionResetError):
            pass  # The learner sought elsewhere or left the page.
