#!/usr/bin/env python3
"""Build the learning platform from the lesson notebooks.

    python scripts/build.py                 build the site into dist/
    python scripts/build.py --sync          import notebooks from ../Day N first
    python scripts/build.py --serve         build, then serve on http://localhost:8000
    python scripts/build.py --questions 1.1 list a lesson's question blocks (for writing answers)

Everything the learner sees comes from three places:
  notes/module-N/lesson-N.M.ipynb   the teaching notebooks (content, code, outputs, figures)
  enrichments/N.M.yaml              the teaching layer: widgets, explainers, answers, quizzes
  course.yaml / glossary.yaml       course map, terminology and the glossary
"""
from __future__ import annotations

import argparse
import http.server
import json
import os
import re
import shutil
import socketserver
import subprocess
import sys
import time
from functools import partial
from pathlib import Path

import yaml
from jinja2 import Environment, FileSystemLoader, select_autoescape

sys.path.insert(0, str(Path(__file__).resolve().parent))

from dlp.enrich import Enricher, load as load_enrichment  # noqa: E402
from dlp.glossary import Glossary  # noqa: E402
from dlp.notebook import Lesson, LessonParser  # noqa: E402
from dlp.render import AssetStore, MarkdownRenderer  # noqa: E402
from dlp.text import Terminology, inline_md  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
DIST = ROOT / "dist"
NOTES = ROOT / "notes"
ENRICH = ROOT / "enrichments"

MODULE_COLORS = ["#2a78d6", "#eb6834", "#1baf7a", "#7a5af0", "#e0558c", "#d99400", "#1f9d55",
                 "#e34948", "#0e8a9a", "#8a6a3c"]


def lesson_sort_key(p: Path):
    m = re.search(r"lesson-(\d+)\.(\d+)", p.name)
    return (int(m.group(1)), int(m.group(2))) if m else (999, 999)


def reading_minutes(lesson: Lesson) -> int:
    return max(5, round(lesson.word_count / 190 + lesson.code_cells * 0.6))


class Builder:
    def __init__(self, dist: Path = DIST):
        self.dist = dist
        self.cfg = yaml.safe_load((ROOT / "course.yaml").read_text(encoding="utf-8"))
        self.term = Terminology(self.cfg.get("terminology", []))
        self.renderer = MarkdownRenderer(self.term, self.cfg.get("markdown_fixes", []))
        self.parser = LessonParser(self.renderer, self.term)
        self.enricher = Enricher(self.renderer)
        self.glossary = Glossary(ROOT / "glossary.yaml")
        self.env = Environment(loader=FileSystemLoader(str(ROOT / "templates")),
                               autoescape=select_autoescape(["html"]), trim_blocks=True, lstrip_blocks=True)
        self.env.filters["md_inline"] = inline_md
        self.env.globals["now"] = time.strftime("%Y-%m-%d")
        self.env.globals["v"] = time.strftime("%Y%m%d%H%M%S")  # cache-buster for css/js

    # ------------------------------------------------------------------ discovery
    def discover(self) -> list[tuple[str, Path]]:
        found = []
        for p in sorted(NOTES.glob("module-*/lesson-*.ipynb"), key=lesson_sort_key):
            m = re.search(r"lesson-(\d+\.\d+)", p.name)
            if m:
                found.append((m.group(1), p))
        return found

    # ------------------------------------------------------------------ build
    def build(self) -> int:
        t0 = time.time()
        if self.dist.exists():
            for child in self.dist.iterdir():
                if child.name == "assets":
                    continue
                shutil.rmtree(child) if child.is_dir() else child.unlink()
        self.dist.mkdir(parents=True, exist_ok=True)
        shutil.copytree(ROOT / "static", self.dist / "static", dirs_exist_ok=True)

        modules_cfg = {m["number"]: m for m in self.cfg["modules"]}
        lessons: list[Lesson] = []
        extras: dict[str, dict] = {}
        assets: dict[str, AssetStore] = {}
        for lid, path in self.discover():
            store = AssetStore(self.dist / "assets" / "lessons" / lid, f"assets/lessons/{lid}")
            mod_n = int(lid.split(".")[0])
            fallback = modules_cfg.get(mod_n, {}).get("title", f"Module {mod_n}")
            lesson = self.parser.parse(path, lid, store, "../", fallback)
            data = load_enrichment(ENRICH / f"{lid}.yaml")
            extras[lid] = self.enricher.apply(lesson, data)
            extras[lid]["enriched"] = bool(data)
            lessons.append(lesson)
            assets[lid] = store
            store.write()
            print(f"  ✓ {lid}  {lesson.title}  ({len(lesson.sections)} sections, "
                  f"{len(store.files)} images{', enriched' if data else ''})")

        # ---- navigation model
        nav = []
        for i, mcfg in enumerate(self.cfg["modules"]):
            n = mcfg["number"]
            mls = [l for l in lessons if l.module == n]
            nav.append({
                **mcfg, "color": MODULE_COLORS[(n - 1) % len(MODULE_COLORS)],
                "available": bool(mls), "url": f"module-{n}/index.html",
                "lessons": [{"id": l.id, "title": l.title, "url": f"module-{n}/{l.slug}.html",
                             "minutes": reading_minutes(l), "sections": len(l.sections)} for l in mls],
                "minutes": sum(reading_minutes(l) for l in mls),
            })
        flat = [le for m in nav for le in m["lessons"]]
        stats = {
            "modules": sum(1 for m in nav if m["available"]),
            "lessons": len(lessons),
            "sections": sum(len(l.sections) for l in lessons),
            "code": sum(l.code_cells for l in lessons),
            "figures": sum(l.figures for l in lessons),
            "labs": sum(len(e["widgets"]) for e in extras.values()),
            "questions": sum(1 for l in lessons for s in l.sections for b in s.blocks if b["kind"] == "questions"),
        }
        tutor = dict(self.cfg.get("tutor") or {})
        tutor["course"] = self.cfg["course"]["title"]
        common = {"course": self.cfg["course"], "nav": nav, "stats": stats,
                  "glossary_js": json.dumps(self.glossary.as_js()),
                  "tutor_js": json.dumps(tutor).replace("</", "<\\/")}

        # ---- pages
        self._page("home.html", "index.html", root="", page="home", **common)
        self._page("glossary.html", "glossary.html", root="", page="glossary",
                   entries=sorted(self.glossary.entries, key=lambda e: e["term"].lower()), **common)
        self._page("guide.html", "guide.html", root="", page="guide", **common)
        search_docs = []
        for m in nav:
            if not m["available"]:
                continue
            mls = [l for l in lessons if l.module == m["number"]]
            self._page("module.html", f"module-{m['number']}/index.html", root="../", page="module",
                       module=m, lessons=mls, reading=reading_minutes, extras=extras, **common)
            for l in mls:
                idx = next(i for i, le in enumerate(flat) if le["id"] == l.id)
                prev_l = flat[idx - 1] if idx > 0 else None
                next_l = flat[idx + 1] if idx + 1 < len(flat) else None
                nb_name = f"Lesson_{l.id}_{re.sub(r'[^A-Za-z0-9]+', '_', l.title).strip('_')}.ipynb"
                (self.dist / "notebooks").mkdir(exist_ok=True)
                shutil.copy2(l.source, self.dist / "notebooks" / nb_name)
                colab = ""
                repo = self.cfg["course"].get("github_repo")
                if repo:
                    branch = self.cfg["course"].get("github_branch", "main")
                    colab = (f"https://colab.research.google.com/github/{repo}/blob/{branch}/"
                             f"notes/module-{l.module}/lesson-{l.id}.ipynb")
                url = f"module-{l.module}/{l.slug}.html"
                strip = lambda h: re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", h or "")).strip()
                lesson_ctx = json.dumps({
                    "id": l.id, "module": l.module, "module_title": m["title"], "title": l.title,
                    "summary": strip(extras[l.id]["summary_html"]) or strip(l.preamble.get("goal_html")),
                    "objectives": [strip(o) for o in l.preamble["objectives"]],
                }, ensure_ascii=False).replace("</", "<\\/")
                self._page("lesson.html", url, root="../", page="lesson", module=m, lesson=l,
                           ex=extras[l.id], prev_l=prev_l, next_l=next_l, minutes=reading_minutes(l),
                           notebook_url=f"../notebooks/{nb_name}", colab_url=colab,
                           widgets=sorted(extras[l.id]["widgets"]), gloss=True,
                           gloss_label=f"Lesson {l.id}", gloss_url=url, lesson_ctx=lesson_ctx, **common)
                for s in l.sections:
                    search_docs.append({"l": l.id, "lt": l.title, "s": s.title, "u": f"{url}#{s.id}",
                                        "x": " ".join(s.plain)[:1400]})
                search_docs.append({"l": l.id, "lt": l.title, "s": "Overview", "u": url,
                                    "x": re.sub(r"<[^>]+>", " ", " ".join(l.preamble["objectives"]))[:800]})
        # glossary page again now that usage is known
        self._page("glossary.html", "glossary.html", root="", page="glossary",
                   entries=sorted(self.glossary.entries, key=lambda e: e["term"].lower()),
                   used_in=self.glossary.used_in, **common)
        for e in self.glossary.entries:
            search_docs.append({"l": "Glossary", "lt": "Glossary", "s": e["term"], "u": f"glossary.html#{e['key']}",
                                "x": e["def_text"]})
        (self.dist / "static" / "search-index.js").write_text(
            "window.DLP_SEARCH=" + json.dumps(search_docs, ensure_ascii=False, separators=(",", ":")) + ";",
            encoding="utf-8")
        (self.dist / ".nojekyll").write_text("")
        self._page("404.html", "404.html", root="", page="404", **common)

        # prune stale lesson asset folders
        live = {lid for lid, _ in self.discover()}
        for d in (self.dist / "assets" / "lessons").glob("*"):
            if d.name not in live:
                shutil.rmtree(d)
            else:
                keep = set(assets[d.name].files)
                for f in d.iterdir():
                    if f.name not in keep:
                        f.unlink()

        if self.enricher.warnings:
            print("\nWarnings:")
            for w in self.enricher.warnings:
                print("  ⚠", w)
        shown = self.dist.relative_to(ROOT) if self.dist.is_relative_to(ROOT) else self.dist
        print(f"\nBuilt {len(lessons)} lessons in {time.time() - t0:.1f}s → {shown}/")
        return 0

    def _page(self, template: str, out: str, **ctx) -> None:
        html = self.env.get_template(template).render(**ctx)
        if ctx.get("gloss"):
            html = self.glossary.annotate(html, ctx["gloss_label"], ctx["gloss_url"])
        target = self.dist / out
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")

    # ------------------------------------------------------------------ authoring helper
    def list_questions(self, lid: str) -> None:
        path = NOTES / f"module-{lid.split('.')[0]}" / f"lesson-{lid}.ipynb"
        lesson = self.parser.parse(path, lid, AssetStore(Path("/tmp/dlp-null"), "x"), "", "")
        for s in lesson.sections:
            for b in s.blocks:
                if b["kind"] == "questions":
                    print(f'\n"{b["id"]}":   # §{s.num} {s.title} — {b["label"]}')
                    for q in b["items"]:
                        print("   -", q["text"][:160])


def serve(port: int) -> None:
    handler = partial(http.server.SimpleHTTPRequestHandler, directory=str(DIST))
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer(("", port), handler) as httpd:
        print(f"Serving http://localhost:{port}  (Ctrl+C to stop)")
        httpd.serve_forever()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--sync", action="store_true", help="import notebooks from the Day folders first")
    ap.add_argument("--serve", action="store_true", help="serve dist/ after building")
    ap.add_argument("--port", type=int, default=int(os.environ.get("PORT", 8000)))
    ap.add_argument("--questions", metavar="LESSON", help="print question blocks of a lesson and exit")
    args = ap.parse_args()
    if args.sync:
        rc = subprocess.call([sys.executable, str(ROOT / "scripts" / "sync_notes.py")])
        if rc:
            return rc
    b = Builder()
    if args.questions:
        b.list_questions(args.questions)
        return 0
    rc = b.build()
    if args.serve and rc == 0:
        serve(args.port)
    return rc


if __name__ == "__main__":
    sys.exit(main())
