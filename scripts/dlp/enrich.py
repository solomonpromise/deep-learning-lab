"""Apply the hand-written teaching layer (enrichments/<lesson>.yaml) to a parsed lesson.

The enrichment file never edits the notebook. It adds things around it:
widgets, explainers, predictions, step-by-step walkthroughs, answers to the
lesson's questions, line-by-line code notes, takeaways and a final quiz.
Anchors are text snippets, so re-exporting a notebook does not break them.
"""
from __future__ import annotations

import html
import json
import re
from pathlib import Path

import yaml

from .notebook import Lesson, Section
from .render import MarkdownRenderer
from .text import inline_md


class EnrichmentError(Exception):
    pass


def load(path: Path) -> dict:
    if not path.exists():
        return {}
    return yaml.safe_load(path.read_text(encoding="utf-8")) or {}


def _norm(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip().lower()


class Enricher:
    def __init__(self, renderer: MarkdownRenderer):
        self.r = renderer
        self.warnings: list[str] = []

    # ------------------------------------------------------------ helpers
    def md(self, text: str | None) -> str:
        return self.r.render(text or "") if text else ""

    def warn(self, lesson: Lesson, msg: str) -> None:
        self.warnings.append(f"[{lesson.id}] {msg}")

    def _all_sections(self, lesson: Lesson) -> list[Section]:
        return lesson.sections

    # ------------------------------------------------------------ public
    def apply(self, lesson: Lesson, data: dict) -> dict:
        """Mutates lesson; returns lesson-level extras for the template."""
        extras = {
            "summary_html": self.md(data.get("summary")),
            "big_picture": self._insert_block(data["big_picture"]) if data.get("big_picture") else None,
            "takeaways": [inline_md(t) if "\n" not in t else self.md(t) for t in data.get("takeaways", [])],
            "quiz": self._quiz_block({"questions": data.get("quiz", [])}) if data.get("quiz") else None,
            "widgets": set(),
        }
        for item in data.get("inserts", []) or []:
            self._insert(lesson, item, extras)
        self._answers(lesson, data.get("answers", {}) or {})
        self._explain(lesson, data.get("explain", []) or [])
        for s in lesson.sections:
            for b in s.blocks:
                if b["kind"] == "widget":
                    extras["widgets"].add(b["name"])
        if extras["big_picture"] and extras["big_picture"]["kind"] == "widget":
            extras["widgets"].add(extras["big_picture"]["name"])
        return extras

    # ------------------------------------------------------------ inserts
    def _insert(self, lesson: Lesson, item: dict, extras: dict) -> None:
        block = self._insert_block(item)
        sec_num = item.get("section")
        sections = [s for s in lesson.sections if sec_num is None or str(s.num) == str(sec_num) or s.id == str(sec_num)]
        if not sections:
            self.warn(lesson, f"insert: section {sec_num!r} not found — skipped ({item.get('type')})")
            return
        where = None
        for key in ("after", "before"):
            if item.get(key):
                needle = _norm(item[key])
                for s in sections:
                    for i, b in enumerate(s.blocks):
                        hay = _norm(b.get("src", "") + " " + b.get("title", ""))
                        if needle in hay and not b.get("_ins"):
                            j = i + 1 if key == "after" else i
                            # keep YAML order when several inserts share an anchor
                            while key == "after" and j < len(s.blocks) and s.blocks[j].get("_ins"):
                                j += 1
                            where = (s, j)
                            break
                    if where:
                        break
                if not where:
                    self.warn(lesson, f"insert: anchor {key}={item[key][:50]!r} not found — placed at end of section")
        if where is None:
            s = sections[0]
            at = item.get("at", "end")
            where = (s, 0 if at == "start" else len(s.blocks))
        s, idx = where
        block["_ins"] = True
        s.blocks.insert(idx, block)

    def _insert_block(self, item: dict) -> dict:
        t = item.get("type", "explainer")
        if t == "widget":
            return {"kind": "widget", "name": item["name"], "title": item.get("title", ""),
                    "caption_html": self.md(item.get("caption")),
                    "intro_html": self.md(item.get("intro")),
                    "props": json.dumps(item.get("props", {})),
                    "height": item.get("height"), "src": item.get("title", "")}
        if t == "explainer":
            return {"kind": "explainer", "style": item.get("style", "plain"), "title": item.get("title", ""),
                    "icon": item.get("icon"), "html": self.md(item.get("md")),
                    "collapsed": bool(item.get("collapsed", item.get("style") == "deep")),
                    "src": item.get("title", "")}
        if t == "predict":
            return {"kind": "predict", "prompt_html": self.md(item.get("prompt")),
                    "mode": item.get("mode", "choice"), "options": [inline_md(o) for o in item.get("options", [])],
                    "answer": item.get("answer"), "unit": item.get("unit", ""),
                    "tolerance": item.get("tolerance", 0), "min": item.get("min", 0), "max": item.get("max", 1),
                    "step": item.get("step", 0.01),
                    "reveal_html": self.md(item.get("reveal")), "id": item.get("id", ""), "src": ""}
        if t == "steps":
            return {"kind": "steps", "title": item.get("title", ""), "intro_html": self.md(item.get("intro")),
                    "steps": [{"title": st.get("title", ""), "html": self.md(st.get("md")),
                               "visual": st.get("svg") or st.get("html") or ""} for st in item.get("steps", [])],
                    "src": item.get("title", "")}
        if t == "compare":
            return {"kind": "compare", "title": item.get("title", ""),
                    "items": [{"title": c.get("title", ""), "tone": c.get("tone", ""), "icon": c.get("icon", ""),
                               "html": self.md(c.get("md"))} for c in item.get("items", [])],
                    "src": item.get("title", "")}
        if t == "figure":
            return {"kind": "figure", "html": item.get("svg") or item.get("html", ""),
                    "caption_html": self.md(item.get("caption")), "src": item.get("caption", "")}
        if t == "quiz":
            return self._quiz_block(item)
        if t == "html":
            return {"kind": "raw", "html": item.get("html", ""), "src": ""}
        raise EnrichmentError(f"unknown insert type {t!r}")

    def _quiz_block(self, item: dict) -> dict:
        qs = []
        for q in item.get("questions", []):
            qs.append({"q_html": self.md(q["q"]), "options": [inline_md(str(o)) for o in q["options"]],
                       "answer": int(q["answer"]), "why_html": self.md(q.get("why"))})
        return {"kind": "quiz", "title": item.get("title", "Quick check"), "questions": qs, "src": ""}

    # ------------------------------------------------------------ answers
    def _answers(self, lesson: Lesson, answers: dict) -> None:
        blocks = {}
        for s in lesson.sections:
            for b in s.blocks:
                if b["kind"] == "questions":
                    blocks[b["id"]] = b
        for part in lesson.preamble.get("intro", []):
            for b in part["blocks"]:
                if b["kind"] == "questions":
                    blocks[b["id"]] = b
        for qid, ans in answers.items():
            b = blocks.get(str(qid))
            if b is None:
                self.warn(lesson, f"answers: question block {qid} not found")
                continue
            if isinstance(ans, str):
                ans = [ans]
            if len(ans) != len(b["items"]):
                self.warn(lesson, f"answers: block {qid} has {len(b['items'])} question(s) but {len(ans)} answer(s)")
            for item, a in zip(b["items"], ans):
                item["answer_html"] = self.md(a)
        missing = [qid for qid, b in blocks.items() if not all(it.get("answer_html") for it in b["items"])]
        if missing and answers:
            self.warn(lesson, f"answers missing for question blocks: {', '.join(missing)}")

    # ------------------------------------------------------------ code notes
    def _explain(self, lesson: Lesson, notes: list[dict]) -> None:
        code_blocks = [b for s in lesson.sections for b in s.blocks if b["kind"] == "code"]
        code_blocks += lesson.preamble.get("setup_blocks", [])
        for note in notes:
            needle = note["cell"]
            target = next((b for b in code_blocks if needle in b["src"]), None)
            if target is None:
                self.warn(lesson, f"explain: code cell containing {needle[:40]!r} not found")
                continue
            line_notes = []
            for ln in note.get("lines", []):
                idx = next((i for i, raw in enumerate(target["src"].split("\n")) if ln["match"] in raw), None)
                if idx is None:
                    self.warn(lesson, f"explain: line {ln['match'][:40]!r} not found in cell {needle[:30]!r}")
                    continue
                line_notes.append({"line": idx, "html": self.md(ln["note"])})
            target["note_map"] = {n["line"]: k + 1 for k, n in enumerate(line_notes)}
            target["explain"] = {"summary_html": self.md(note.get("summary")), "lines": line_notes,
                                 "title": note.get("title", "What this code does")}
