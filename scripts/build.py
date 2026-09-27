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

from dlp.docstrings import inject as inject_docstrings  # noqa: E402
from dlp.enrich import Enricher, load as load_enrichment  # noqa: E402
from dlp.glossary import Glossary  # noqa: E402
from dlp.notebook import Lesson, LessonParser  # noqa: E402
from dlp.render import AssetStore, MarkdownRenderer  # noqa: E402
from dlp.social import render_card  # noqa: E402
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


def _words(html: str | None) -> int:
    return len(re.sub(r"<[^>]+>", " ", html or "").split())


def teaching_words(lesson: Lesson, ex: dict) -> int:
    """Words the teaching layer adds to the notes: explainers, walkthroughs, code notes, answers (counted at half,
    since they are read after answering), the summary and the takeaways."""
    n = _words(ex["summary_html"]) + sum(_words(t) for t in ex["takeaways"])
    for s in lesson.sections:
        for b in s.blocks:
            if b.get("_ins"):
                n += sum(_words(b.get(k)) for k in ("html", "intro_html", "caption_html", "prompt_html", "reveal_html"))
                n += sum(_words(st["html"]) for st in b.get("steps", []))
                if b["kind"] == "compare":
                    n += sum(_words(c["html"]) for c in b["items"])
            if b["kind"] == "questions":
                n += sum(_words(it.get("answer_html")) for it in b["items"]) // 2
            if b["kind"] == "code" and b.get("explain"):
                n += _words(b["explain"]["summary_html"]) + sum(_words(x["html"]) for x in b["explain"]["lines"])
    return n


def lesson_minutes(lesson: Lesson, ex: dict) -> int:
    """An honest time for the whole lesson: reading the notes and the teaching layer, the code,
    about 3 minutes per lab, and the checkpoints and quiz."""
    labs = sum(1 for s in lesson.sections for b in s.blocks if b["kind"] == "widget")
    cps = sum(len(c["questions"]) for c in ex["checkpoints"])
    explains = sum(1 for c in ex["checkpoints"] if c["explain"])
    quiz = len(ex["quiz"]["questions"]) if ex["quiz"] else 0
    words = lesson.word_count + teaching_words(lesson, ex)
    return max(5, round(words / 200 + lesson.code_cells * 0.6 + labs * 3 + cps * 0.75 + explains * 1.5 + quiz * 0.5))


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
            data = load_enrichment(ENRICH / f"{lid}.yaml")
            lesson = self.parser.parse(path, lid, store, "../", fallback, docstrings=docmap_for(lid, data))
            for cell, qual in dict.fromkeys(lesson.doc_missing):
                self.enricher.warnings.append(f"[{lid}] no docstring for `{qual}` (code cell {cell}); add it under `docstrings:`")
            for cell, qual in dict.fromkeys(lesson.doc_thin):
                self.enricher.warnings.append(f"[{lid}] one-line docstring for `{qual}` (code cell {cell}); document its arguments under `docstrings:`")
            extras[lid] = self.enricher.apply(lesson, data)
            extras[lid]["enriched"] = bool(data)
            cp_data = load_enrichment(ENRICH / f"{lid}.checkpoints.yaml")
            extras[lid]["checkpoints"] = self.enricher.checkpoints(lesson, cp_data)
            extras[lid]["skill"] = cp_data.get("skill") or lesson.title
            extras[lid]["minutes"] = lesson_minutes(lesson, extras[lid])
            extras[lid]["python"] = self._mark_runnable(lesson) or any(
                b["kind"] == "exercise" for s in lesson.sections for b in s.blocks)
            lessons.append(lesson)
            assets[lid] = store
            store.write()
            print(f"  ✓ {lid}  {lesson.title}  ({len(lesson.sections)} sections, "
                  f"{len(store.files)} images"
                  + (f", {len(lesson.image_prompts)} image prompt(s) hidden" if lesson.image_prompts else "")
                  + f"{', enriched' if data else ''})")

        # ---- module challenges (enrichments/module-N.challenge.yaml)
        challenges = {m["number"]: self.enricher.module_challenge(m["number"], load_enrichment(ENRICH / f"module-{m['number']}.challenge.yaml"))
                      for m in self.cfg["modules"]}

        # ---- navigation model
        nav = []
        for i, mcfg in enumerate(self.cfg["modules"]):
            n = mcfg["number"]
            mls = [l for l in lessons if l.module == n]
            nav.append({
                **mcfg, "color": MODULE_COLORS[(n - 1) % len(MODULE_COLORS)],
                "available": bool(mls), "url": f"module-{n}/index.html",
                "lessons": [{"id": l.id, "title": l.title, "url": f"module-{n}/{l.slug}.html",
                             "minutes": extras[l.id]["minutes"], "sections": len(l.sections)} for l in mls],
                "minutes": sum(extras[l.id]["minutes"] for l in mls),
                "challenge": challenges.get(n) if mls else None,
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
        stats["practice"] = sum(len(c["questions"]) for e in extras.values() for c in e["checkpoints"]) + \
            sum(len((e["quiz"] or {}).get("questions", [])) for e in extras.values())
        self._social_cards(nav, lessons, extras, stats)
        tutor = dict(self.cfg.get("tutor") or {})
        tutor["course"] = self.cfg["course"]["title"]
        common = {"course": self.cfg["course"], "nav": nav, "stats": stats,
                  "site_url": (self.cfg["course"].get("site_url") or "").rstrip("/") + "/",
                  "glossary_js": json.dumps(self.glossary.as_js()),
                  "tutor_js": json.dumps(tutor).replace("</", "<\\/"),
                  "services": self.cfg.get("services") or {},
                  "services_js": json.dumps(self.cfg.get("services") or {}).replace("</", "<\\/")}

        # ---- pages
        def strip(html):
            text = re.sub(r"\s+", " ", re.sub(r"<[^>]+>", " ", html or "")).strip()
            return re.sub(r"([(\[]) ", r"\1", re.sub(r" ([,.;:!?)\]])", r"\1", text))

        self._page("home.html", "index.html", root="", page="home", **common)
        self._page("glossary.html", "glossary.html", root="", page="glossary",
                   entries=sorted(self.glossary.entries, key=lambda e: e["term"].lower()), **common)
        self._page("guide.html", "guide.html", root="", page="guide", **common)
        self._page("review.html", "review.html", root="", page="review", **common)
        self._page("progress.html", "progress.html", root="", page="progress", **common)
        self._page("certificate.html", "certificate.html", root="", page="certificate", **common)
        self._page("instructor.html", "instructor.html", root="", page="instructor", **common)
        search_docs = []
        for m in nav:
            if not m["available"]:
                continue
            mls = [l for l in lessons if l.module == m["number"]]
            self._page("module.html", f"module-{m['number']}/index.html", root="../", page="module",
                       og_image=f"assets/og/module-{m['number']}.png", module=m, lessons=mls, reading=lambda le: extras[le.id]["minutes"], extras=extras, **common)
            for l in mls:
                idx = next(i for i, le in enumerate(flat) if le["id"] == l.id)
                prev_l = flat[idx - 1] if idx > 0 else None
                next_l = flat[idx + 1] if idx + 1 < len(flat) else None
                nb_name = f"Lesson_{l.id}_{re.sub(r'[^A-Za-z0-9]+', '_', l.title).strip('_')}.ipynb"
                (self.dist / "notebooks").mkdir(exist_ok=True)
                write_documented_notebook(l.source, self.dist / "notebooks" / nb_name,
                                          docmap_for(l.id, load_enrichment(ENRICH / f"{l.id}.yaml")))
                colab = ""
                repo = self.cfg["course"].get("github_repo")
                if repo:
                    branch = self.cfg["course"].get("github_branch", "main")
                    colab = (f"https://colab.research.google.com/github/{repo}/blob/{branch}/"
                             f"notes/module-{l.module}/lesson-{l.id}.ipynb")
                url = f"module-{l.module}/{l.slug}.html"
                lesson_ctx = json.dumps({
                    "id": l.id, "module": l.module, "module_title": m["title"], "title": l.title,
                    "summary": strip(extras[l.id]["summary_html"]) or strip(l.preamble.get("goal_html")),
                    "objectives": [strip(o) for o in l.preamble["objectives"]],
                }, ensure_ascii=False).replace("</", "<\\/")
                summary = strip(extras[l.id]["summary_html"]) or strip(l.preamble.get("goal_html"))
                meta_desc = summary if len(summary) <= 200 else summary[:197].rsplit(" ", 1)[0] + "…"
                self._page("lesson.html", url, root="../", page="lesson", module=m, lesson=l,
                           og_image=f"assets/og/lesson-{l.id}.png", meta_desc=meta_desc,
                           ex=extras[l.id], prev_l=prev_l, next_l=next_l, minutes=extras[l.id]["minutes"],
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
        # the tutor's map of the whole course, so it can answer about lessons other than the open one
        by_id = {l.id: l for l in lessons}
        course_map = {"modules": [{
            "number": m["number"], "title": m["title"], "available": m["available"], "color": m["color"], "url": m["url"],
            "challenge": {"id": m["challenge"]["id"], "title": m["challenge"]["title"], "n": len(m["challenge"]["questions"]),
                          "pass_mark": m["challenge"]["pass_mark"]} if m.get("challenge") else None,
            "lessons": [{
                "id": le["id"], "title": le["title"], "url": le["url"],
                "summary": strip(extras[le["id"]]["summary_html"]) or strip(by_id[le["id"]].preamble.get("goal_html")),
                "objectives": [strip(o) for o in by_id[le["id"]].preamble["objectives"]],
                "sections": [s.title for s in by_id[le["id"]].sections if s.kind == "section"],
                "skill": extras[le["id"]]["skill"],
                "cp": [q["id"] for c in extras[le["id"]]["checkpoints"] for q in c["questions"]],
                "ex": [c["explain"]["id"] for c in extras[le["id"]]["checkpoints"] if c["explain"]],
                "quiz": [q["id"] for q in (extras[le["id"]]["quiz"] or {}).get("questions", [])],
                "labs": sorted(extras[le["id"]]["widgets"]),
                "n_sections": sum(1 for s in by_id[le["id"]].sections),
            } for le in m["lessons"]],
        } for m in nav]}
        (self.dist / "static" / "course-map.js").write_text(
            "window.DLP_COURSE=" + json.dumps(course_map, ensure_ascii=False, separators=(",", ":")) + ";",
            encoding="utf-8")
        # every checkpoint and quiz question, for the review page
        bank = []
        for l in lessons:
            url = f"module-{l.module}/{l.slug}.html"
            for c in extras[l.id]["checkpoints"]:
                for q in c["questions"]:
                    bank.append({"id": q["id"], "l": l.id, "lt": l.title, "s": c["sec"], "st": strip(c["title"]),
                                 "u": f"{url}#cp-{c['sec']}", "q": q["q_html"], "o": q["options"], "a": q["answer"],
                                 "w": q["why_html"]})
            for q in (extras[l.id]["quiz"] or {}).get("questions", []):
                bank.append({"id": q["id"], "l": l.id, "lt": l.title, "s": "quiz", "st": "End-of-lesson quiz",
                             "u": f"{url}#wrap-up", "q": q["q_html"], "o": q["options"], "a": q["answer"], "w": q["why_html"]})
        (self.dist / "static" / "question-bank.js").write_text(
            "window.DLP_BANK=" + json.dumps(bank, ensure_ascii=False, separators=(",", ":")) + ";", encoding="utf-8")
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
        ctx.setdefault("og_image", "assets/og/home.png")
        ctx["page_path"] = "" if out == "index.html" else out
        html = self.env.get_template(template).render(**ctx)
        if ctx.get("gloss"):
            html = self.glossary.annotate(html, ctx["gloss_label"], ctx["gloss_url"])
        target = self.dist / out
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(html, encoding="utf-8")

    def _mark_runnable(self, lesson: Lesson) -> bool:
        """Flag the code cells that can run in the browser (course.yaml → run_in_browser)."""
        cfg = self.cfg.get("run_in_browser") or {}
        if lesson.id not in [str(x) for x in cfg.get("lessons", [])]:
            return False
        skip = [re.compile(pat, re.M) for pat in cfg.get("skip", [])]
        allow = [re.compile(pat, re.M) for pat in cfg.get("allow", [])]
        blocks = list(lesson.preamble.get("setup_blocks", []))
        blocks += [b for part in lesson.preamble.get("intro", []) for b in part["blocks"]]
        blocks += [b for s in lesson.sections for b in s.blocks]
        n = 0
        for b in blocks:
            if b.get("kind") == "code" and b.get("lang", "python") == "python" and not b.get("file"):
                src = b["source"]
                if re.search(r"^\s*(!|%pip|pip install)", src, re.M):       # installs never run here
                    continue
                if any(pat.search(src) for pat in skip) and not any(pat.search(src) for pat in allow):
                    continue
                b["runnable"] = True
                n += 1
        return n > 0

    def _social_cards(self, nav: list, lessons: list, extras: dict, stats: dict) -> None:
        """The images shown when a page is shared (Open Graph / Twitter cards)."""
        c = self.cfg["course"]
        site = (c.get("site_url") or "").replace("https://", "").rstrip("/")
        og = self.dist / "assets" / "og"
        common = dict(brand=c["short_title"], course=c["title"], site=site)
        render_card(og / "home.png", kicker=f"{c['hours']}-hour course · {c['hands_on']} hands-on", title=c["title"],
                    subtitle=c["tagline"], chips=[f"{stats['lessons']} lessons", f"{stats['labs']} interactive labs",
                                                  f"{stats['practice']} practice questions"], **common)
        by_id = {l.id: l for l in lessons}
        for m in nav:
            if not m["available"]:
                continue
            render_card(og / f"module-{m['number']}.png", kicker=f"Module {m['number']}", title=m["title"],
                        subtitle=f"“{m['question']}”" if m.get("question") else "", accent=m["color"],
                        chips=[f"{len(m['lessons'])} lessons", f"~{m['minutes'] / 60:.1f} hours"], **common)
            for le in m["lessons"]:
                ex = extras[le["id"]]
                chips = [f"~{ex['minutes']} min"]
                if ex["widgets"]:
                    chips.append(f"{len(ex['widgets'])} interactive lab{'s' if len(ex['widgets']) != 1 else ''}")
                if ex["checkpoints"]:
                    chips.append(f"{len(ex['checkpoints'])} checkpoints")
                render_card(og / f"lesson-{le['id']}.png", kicker=f"Module {m['number']} · Lesson {le['id']}",
                            title=by_id[le["id"]].title, accent=m["color"], chips=chips, **common)

    # ------------------------------------------------------------------ authoring helper
    def list_defs(self, lid: str) -> None:
        """Print every function/class in a lesson with its current docstring (authoring helper)."""
        path = NOTES / f"module-{lid.split('.')[0]}" / f"lesson-{lid}.ipynb"
        data = load_enrichment(ENRICH / f"{lid}.yaml")
        lesson = self.parser.parse(path, lid, AssetStore(Path("/tmp/dlp-null"), "x"), "", "",
                                   docstrings=docmap_for(lid, data))
        seen = set()
        for cell, d in lesson.defs:
            if d.qualname in seen:
                continue
            seen.add(d.qualname)
            state = "MISSING" if not d.docstring else f"{len(d.docstring.splitlines())} lines"
            print(f"cell {cell:>3}  {d.qualname:<40} {state:<9} {d.signature[:90]}")

    def list_questions(self, lid: str) -> None:
        path = NOTES / f"module-{lid.split('.')[0]}" / f"lesson-{lid}.ipynb"
        lesson = self.parser.parse(path, lid, AssetStore(Path("/tmp/dlp-null"), "x"), "", "")
        for s in lesson.sections:
            for b in s.blocks:
                if b["kind"] == "questions":
                    print(f'\n"{b["id"]}":   # §{s.num} {s.title} — {b["label"]}')
                    for q in b["items"]:
                        print("   -", q["text"][:160])


def docmap_for(lid: str, data: dict) -> dict:
    """All docstrings for a lesson: AI drafts (``N.M.docstrings.yaml``) overridden by hand-written ones."""
    drafts_path = ENRICH / f"{lid}.docstrings.yaml"
    drafts = (yaml.safe_load(drafts_path.read_text(encoding="utf-8")) or {}) if drafts_path.exists() else {}
    return {**drafts, **(data.get("docstrings") or {})}


def write_documented_notebook(src: Path, dest: Path, docmap: dict | None) -> None:
    """Copy a lesson notebook for download, with the lesson's docstrings inserted.

    Outputs and markdown are untouched; only the source of code cells that define
    functions or classes changes. The original notebook in ``notes/`` is never modified.
    """
    nb = json.loads(src.read_text(encoding="utf-8"))
    if docmap:
        for cell in nb.get("cells", []):
            if cell.get("cell_type") != "code":
                continue
            code = "".join(cell.get("source", ""))
            new = inject_docstrings(code, docmap).code
            if new != code:
                cell["source"] = new.splitlines(keepends=True)
    dest.write_text(json.dumps(nb, ensure_ascii=False, indent=1), encoding="utf-8")


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
    ap.add_argument("--defs", metavar="LESSON", help="print functions/classes of a lesson and their docstring status")
    args = ap.parse_args()
    if args.sync:
        rc = subprocess.call([sys.executable, str(ROOT / "scripts" / "sync_notes.py")])
        if rc:
            return rc
    b = Builder()
    if args.questions:
        b.list_questions(args.questions)
        return 0
    if args.defs:
        b.list_defs(args.defs)
        return 0
    rc = b.build()
    if args.serve and rc == 0:
        serve(args.port)
    return rc


if __name__ == "__main__":
    sys.exit(main())
