#!/usr/bin/env python3
"""Local stand-in for the tutor proxy, for testing on your own machine.

    GROQ_API_KEY=gsk_... python scripts/tutor_dev_proxy.py      (listens on http://localhost:8787)

Then set `tutor.endpoint: "http://localhost:8787"` in course.yaml, rebuild and open the site locally.
It behaves like tutor-proxy/worker.js: adds the tutor rules, forwards to Groq, streams the reply.
"""
import json
import os
import urllib.request
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import yaml

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CFG = yaml.safe_load(open(os.path.join(ROOT, "course.yaml"), encoding="utf-8")).get("tutor", {})
KEY = os.environ.get("GROQ_API_KEY", "")
RULES = ("You are the AI tutor built into the Deep Learning Lab course website. Help learners understand "
         "deep learning, machine learning, PyTorch and the course lessons; decline unrelated tasks.")


class Handler(BaseHTTPRequestHandler):
    def _cors(self):
        self.send_header("Access-Control-Allow-Origin", self.headers.get("Origin") or "*")
        self.send_header("Access-Control-Allow-Methods", "POST, OPTIONS")
        self.send_header("Access-Control-Allow-Headers", "Content-Type")

    def do_OPTIONS(self):
        self.send_response(204); self._cors(); self.end_headers()

    def do_POST(self):
        body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", 0))) or b"{}")
        msgs = body.get("messages", [])
        context = msgs[0]["content"] if msgs and msgs[0].get("role") == "system" else ""
        msgs = [m for m in msgs if m.get("role") in ("user", "assistant")][-12:]
        payload = {"model": CFG.get("model", "qwen/qwen3.8-27b"), "stream": True, "temperature": 0.4,
                   "max_completion_tokens": 1400,
                   "messages": [{"role": "system", "content": RULES + "\n\n" + context[:24000]}] + msgs}
        if CFG.get("reasoning_effort"):
            payload.update(reasoning_effort=CFG["reasoning_effort"], reasoning_format="hidden")
        req = urllib.request.Request("https://api.groq.com/openai/v1/chat/completions",
                                     data=json.dumps(payload).encode(), method="POST",
                                     headers={"Authorization": f"Bearer {KEY}", "Content-Type": "application/json",
                                              "User-Agent": "deep-learning-lab-dev-proxy"})
        try:
            upstream = urllib.request.urlopen(req)
        except urllib.error.HTTPError as e:
            self.send_response(e.code); self._cors(); self.send_header("Content-Type", "application/json")
            self.end_headers(); self.wfile.write(e.read()); return
        self.send_response(200); self._cors()
        self.send_header("Content-Type", "text/event-stream"); self.send_header("Cache-Control", "no-cache")
        self.end_headers()
        for line in upstream:
            self.wfile.write(line); self.wfile.flush()


if __name__ == "__main__":
    if not KEY:
        raise SystemExit("Set GROQ_API_KEY first:  GROQ_API_KEY=gsk_... python scripts/tutor_dev_proxy.py")
    print("Tutor dev proxy on http://localhost:8787")
    ThreadingHTTPServer(("", 8787), Handler).serve_forever()
