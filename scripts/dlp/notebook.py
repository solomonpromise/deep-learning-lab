"""Parse a lesson notebook into a structured Lesson (preamble + sections + blocks)."""
from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from pathlib import Path

from .docstrings import inject as inject_docstrings
from .render import AssetStore, MarkdownRenderer, highlight_lines, is_shell_cell, render_outputs
from .text import FENCE_OPEN, Terminology, inline_md, md_to_plain, slugify

HEADING = re.compile(r"^(#{1,6})\s+(.*?)\s*#*\s*$")
MODULE_HEADING = re.compile(r"^(?:Day|Module)\s+(\d+)\s*[—–:-]\s*(.+)$", re.I)
LESSON_HEADING = re.compile(r"^(?:Note|Lesson)\s+(\d+)\.(\d+)\s*[—–:-]\s*(.+)$", re.I)
NUMBERED = re.compile(r"^(\d+)\.\s+(.+)$")
IMAGE_LABEL = re.compile(r"^\s*>\s*\*\*\s*🖼️?\s*IMAGE\s+([\d.]+)\s*[—–-]\s*(.+?)\s*\*\*\s*(?:\n\s*>\s*)*$", re.S)
NEXT_FILE = re.compile(r"^\s*\*\*Next:?\*\*.*?\.ipynb.*$", re.M | re.I)
# "> **🖼 Image prompt** — …" is an author's note describing an image still to be made: hidden on the site
IMAGE_PROMPT = re.compile(r"^[ \t]*>[ \t]*\*\*[ \t]*🖼️?[ \t]*Image prompt[ \t]*\*\*.*(?:\n[ \t]*>.*)*\n?", re.M | re.I)
WRITEFILE = re.compile(r"^\s*%%writefile\s+(?:-a\s+)?(\S+)")
# Syntax highlighting for files written with %%writefile, by extension (anything else: plain text)
FILE_LANGS = {".py": "python", ".yaml": "yaml", ".yml": "yaml", ".md": "markdown", ".toml": "toml",
              ".json": "json", ".cfg": "ini", ".ini": "ini", ".sh": "bash"}

Q_KINDS = {
    "check": ["question", "questions", "questions to sit with", "check your understanding", "check yourself",
              "self-check", "quick check", "questions to answer"],
    "think": ["think before you continue", "stop and think", "pause and think", "predict", "predict first",
              "before you run", "make a prediction"],
    "try": ["try it", "try this", "your turn", "exercise", "challenge", "mini-lab", "lab"],
}
Q_LABEL = re.compile(r"^\*\*(?P<label>[^*]{3,60}?)\*\*\s*(?P<rest>.*)$")
LIST_ITEM = re.compile(r"^\s{0,3}(?:\d+[.)]|[-*+])\s+(.*)$")


def question_kind(label: str) -> str | None:
    norm = label.strip().rstrip(".:!?").strip().lower()
    for kind, labels in Q_KINDS.items():
        if norm in labels:
            return kind
    return None


# ------------------------------------------------------------------ data model
@dataclass
class Section:
    num: int | None
    title: str
    id: str
    kind: str = "section"            # section | conclusion | transition
    blocks: list[dict] = field(default_factory=list)
    subs: list[dict] = field(default_factory=list)
    plain: list[str] = field(default_factory=list)

    @property
    def title_html(self) -> str:
        return inline_md(self.title)


@dataclass
class Lesson:
    id: str
    module: int
    number: int
    title: str
    module_title: str
    source: Path
    preamble: dict
    sections: list[Section]
    word_count: int = 0
    code_cells: int = 0
    figures: int = 0
    defs: list = field(default_factory=list)          # every (cell, DefInfo) shown to learners
    doc_missing: list = field(default_factory=list)   # (cell, qualname) still without a docstring
    doc_thin: list = field(default_factory=list)      # (cell, qualname) with a one-line docstring despite arguments
    image_prompts: list = field(default_factory=list) # cells whose image-prompt placeholder was hidden

    @property
    def slug(self) -> str:
        return f"lesson-{self.module}-{self.number}"

    @property
    def title_html(self) -> str:
        return inline_md(self.title)


# ------------------------------------------------------------------ stage 1: flatten cells
def split_markdown_cell(src: str) -> list[tuple]:
    """Split a markdown cell into ('heading', level, text) and ('md', text) items."""
    items: list[tuple] = []
    buf: list[str] = []
    in_fence = None
    for line in src.split("\n"):
        fm = FENCE_OPEN.match(line)
        if fm:
            fence = fm.group(2)
            if in_fence is None:
                in_fence = fence[0] * 3
            elif line.strip().startswith(in_fence) and line.strip().strip(in_fence[0]) == "":
                in_fence = None
            buf.append(line)
            continue
        hm = HEADING.match(line) if in_fence is None else None
        if hm:
            if "".join(buf).strip():
                items.append(("md", "\n".join(buf).strip("\n")))
            buf = []
            items.append(("heading", len(hm.group(1)), hm.group(2).strip()))
        else:
            buf.append(line)
    if "".join(buf).strip():
        items.append(("md", "\n".join(buf).strip("\n")))
    return items


def flatten(nb: dict) -> list[tuple]:
    items: list[tuple] = []
    for idx, cell in enumerate(nb.get("cells", [])):
        src = "".join(cell.get("source", ""))
        if cell.get("cell_type") == "markdown":
            for it in split_markdown_cell(src):
                if it[0] == "md":
                    items.append(("md", it[1], cell.get("attachments") or {}, idx))
                else:
                    items.append(it)
        elif cell.get("cell_type") == "code":
            if src.strip() or cell.get("outputs"):
                items.append(("code", src, cell.get("outputs", []), idx))
    return items


# ------------------------------------------------------------------ question blocks
def split_questions(md: str) -> list[tuple]:
    """Separate question/exercise prompts from surrounding prose.

    Returns a list of ('md', text) and ('q', kind, label, intro, [items]) tuples.
    """
    lines = md.split("\n")
    out: list[tuple] = []
    prose: list[str] = []
    i = 0
    while i < len(lines):
        m = Q_LABEL.match(lines[i].strip())
        kind = question_kind(m.group("label")) if m else None
        if not kind:
            prose.append(lines[i])
            i += 1
            continue
        if "\n".join(prose).strip():
            out.append(("md", "\n".join(prose).strip("\n")))
        prose = []
        label = m.group("label").strip().rstrip(".:").strip()
        rest = m.group("rest").strip().lstrip(".:").strip()
        intro_lines = [rest] if rest else []
        i += 1
        # paragraph continuation of the label line
        while i < len(lines) and lines[i].strip() and not LIST_ITEM.match(lines[i]) and not Q_LABEL.match(lines[i].strip()):
            intro_lines.append(lines[i].strip())
            i += 1
        # optional list of questions
        items: list[str] = []
        j = i
        while j < len(lines) and not lines[j].strip():
            j += 1
        if j < len(lines) and LIST_ITEM.match(lines[j]):
            i = j
            current: list[str] | None = None
            while i < len(lines):
                line = lines[i]
                lm = LIST_ITEM.match(line)
                if lm:
                    if current is not None:
                        items.append(" ".join(current).strip())
                    current = [lm.group(1).strip()]
                elif not line.strip():
                    # blank: end of list unless the next non-blank line continues it
                    k = i + 1
                    while k < len(lines) and not lines[k].strip():
                        k += 1
                    if k >= len(lines) or not (LIST_ITEM.match(lines[k]) or lines[k].startswith("   ")):
                        i = k
                        break
                elif current is not None and (line.startswith(" ") or not Q_LABEL.match(line.strip())):
                    if Q_LABEL.match(line.strip()):
                        break
                    current.append(line.strip())
                else:
                    break
                i += 1
            if current is not None:
                items.append(" ".join(current).strip())
        intro = " ".join(intro_lines).strip()
        if not items and intro:
            items, intro = [intro], ""
        out.append(("q", kind, label, intro, items))
    if "\n".join(prose).strip():
        out.append(("md", "\n".join(prose).strip("\n")))
    return out


# ------------------------------------------------------------------ preamble classification
def preamble_role(title: str) -> str:
    t = title.lower()
    if "table of contents" in t or t.strip() == "contents":
        return "contents"
    if "goal" in t or "outcome" in t:
        return "goal"
    if "objective" in t:
        return "objectives"
    if "dataset" in t or "data used" in t:
        return "dataset"
    if "runtime" in t:
        return "runtime"
    if "setup" in t or "environment" in t or "install" in t:
        return "setup"
    return "intro"


# ------------------------------------------------------------------ main parser
class LessonParser:
    def __init__(self, renderer: MarkdownRenderer, term: Terminology):
        self.renderer = renderer
        self.term = term

    def parse(self, path: Path, lesson_id: str, assets: AssetStore, root: str,
              fallback_module_title: str, docstrings: dict | None = None) -> Lesson:
        """Parse one lesson notebook into a :class:`Lesson`.

        Args:
            path: The notebook file.
            lesson_id: ``"N.M"``.
            assets: Where extracted images are collected.
            root: Relative path from the page to the site root (``"../"``).
            fallback_module_title: Used if the notebook has no ``# Day N — Title`` heading.
            docstrings: ``{qualified_name: docstring}`` inserted into the displayed code.
        """
        self.docmap = docstrings or {}
        self._defs, self._missing, self._thin, self._prompts = [], [], [], []
        nb = json.loads(path.read_text(encoding="utf-8"))
        items = flatten(nb)
        module_n, lesson_n = (int(x) for x in lesson_id.split("."))
        module_title = fallback_module_title
        title = f"Lesson {lesson_id}"

        pre_parts: list[dict] = [{"title": "", "role": "intro", "items": []}]
        sections: list[Section] = []
        current: Section | None = None
        seen_nums: set[int] = set()

        for it in items:
            if it[0] == "heading":
                _, level, text = it
                mm = MODULE_HEADING.match(text)
                lm = LESSON_HEADING.match(text)
                if level == 1 and mm:
                    module_title = mm.group(2).strip()
                    continue
                if lm and level <= 3:
                    title = lm.group(3).strip()
                    continue
                num = NUMBERED.match(text)
                if level == 2 and num:
                    n = int(num.group(1))
                    sec_title = num.group(2).strip()
                    sid = f"s{n}" if n not in seen_nums else f"s{n}-{slugify(sec_title)}"
                    seen_nums.add(n)
                    current = Section(num=n, title=sec_title, id=sid, kind=self._section_kind(sec_title))
                    sections.append(current)
                    continue
                if level <= 2 and current is not None:
                    current = Section(num=None, title=text, id=slugify(text) or f"part-{len(sections)}",
                                      kind=self._section_kind(text))
                    sections.append(current)
                    continue
                if current is None:
                    pre_parts.append({"title": text, "role": preamble_role(text), "items": []})
                    continue
                current.blocks.append({"kind": "subheading", "level": min(level, 4), "title": text,
                                       "title_html": inline_md(self.term.apply(text)),
                                       "id": f"{current.id}-{slugify(text)}", "src": text})
                if level <= 3:
                    current.subs.append({"id": f"{current.id}-{slugify(text)}", "title": self.term.apply(text)})
                continue
            if current is None:
                pre_parts[-1]["items"].append(it)
            else:
                current.blocks.extend(self._blocks_for(it, current, assets, root))

        # Terminology in titles
        title = self.term.apply(title)
        for s in sections:
            s.title = self.term.apply(s.title)

        preamble = self._build_preamble(pre_parts, assets, root)
        lesson = Lesson(id=lesson_id, module=module_n, number=lesson_n, title=title,
                        module_title=module_title, source=path, preamble=preamble, sections=sections)
        self._finalise(lesson)
        lesson.defs, lesson.doc_missing, lesson.doc_thin = self._defs, self._missing, self._thin
        lesson.image_prompts = self._prompts
        return lesson

    @staticmethod
    def _section_kind(title: str) -> str:
        t = title.lower()
        if t.startswith("transition") or t.startswith("next up") or t.startswith("what comes next"):
            return "transition"
        if "conclusion" in t or t in ("summary", "wrap-up", "wrap up"):
            return "conclusion"
        return "section"

    # -------------------------------------------------------------- blocks
    def _blocks_for(self, it: tuple, section: Section | None, assets: AssetStore, root: str,
                    role: str | None = None) -> list[dict]:
        if it[0] == "code":
            return [self._code_block(it[1], it[2], it[3], assets, root, role)]
        _, text, attachments, idx = it
        text = NEXT_FILE.sub("", text)
        if IMAGE_PROMPT.search(text):
            self._prompts.append(idx)
            text = IMAGE_PROMPT.sub("", text)
        if not text.strip():
            return []
        lab = IMAGE_LABEL.match(text)
        if lab:
            return [{"kind": "image-label", "number": lab.group(1), "title": self.term.apply(lab.group(2)), "src": text}]
        blocks = []
        for part in split_questions(text):
            if part[0] == "md":
                html = self.renderer.render(part[1], attachments, assets, root)
                if html.strip():
                    blocks.append({"kind": "md", "html": html, "src": part[1], "cell": idx})
            else:
                _, kind, label, intro, qs = part
                blocks.append({
                    "kind": "questions", "qtype": kind, "label": self.term.apply(label),
                    "intro_html": self._inline(intro), "src": label + " " + intro + " " + " ".join(qs),
                    "items": [{"html": self._inline(q), "text": q} for q in qs],
                })
        return blocks

    def _inline(self, text: str) -> str:
        if not text:
            return ""
        html = self.renderer.render(text)
        # unwrap a single paragraph
        m = re.fullmatch(r"\s*<p>(.*)</p>\s*", html, re.S)
        return m.group(1) if m and "<p>" not in m.group(1) else html

    def _code_block(self, src: str, outputs: list, idx: int, assets: AssetStore, root: str,
                    role: str | None) -> dict:
        wf = WRITEFILE.match(src)
        file = wf.group(1) if wf else None
        shell = file is None and is_shell_cell(src)
        lang = "bash" if shell else FILE_LANGS.get(Path(file).suffix.lower(), "text") if file else "python"
        code = src.rstrip()
        if shell:
            code = re.sub(r"^[!%]", "", code, flags=re.M)
        elif lang == "python":
            res = inject_docstrings(code, getattr(self, "docmap", {}))
            code = res.code
            self._defs.extend((idx, d) for d in res.defs)
            self._missing.extend((idx, q) for q in res.missing)
            self._thin.extend((idx, q) for q in res.thin)
        lines, shown = highlight_lines(code, lang, self.term)
        outs = render_outputs(outputs, assets, root)
        stripped = code.strip()
        if role is None:
            if shell:
                role = "shell"
            elif "\n" not in stripped and len(stripped) < 60 and "=" not in stripped \
                    and not re.match(r"^(import|from|print|def|class|for|if|with|plt\.)", stripped):
                role = "inspect"
            else:
                role = "normal"
        for o in outs:
            o["collapsed"] = (o["type"] in ("text", "error") and o["lines"] > 28) or \
                             (shell and o["type"] == "text")
        return {"kind": "code", "lang": lang, "file": file, "lines": lines, "source": shown, "outputs": outs,
                "role": role, "cell": idx, "src": code, "n_lines": len(lines)}

    # -------------------------------------------------------------- preamble
    def _build_preamble(self, parts: list[dict], assets: AssetStore, root: str) -> dict:
        pre = {"goal_html": "", "outcome_html": "", "goal_extra_html": "", "objectives": [],
               "objectives_intro": "", "dataset_html": "", "runtime_html": "", "setup_blocks": [],
               "intro": []}
        for part in parts:
            role = part["role"]
            md_texts = [it[1] for it in part["items"] if it[0] == "md"]
            text = "\n\n".join(md_texts)
            atts: dict = {}
            for it in part["items"]:
                if it[0] == "md":
                    atts.update(it[2])
            if role == "contents":
                # keep anything that is not the list itself (e.g. an estimated runtime note)
                keep = "\n".join(l for l in text.split("\n") if not LIST_ITEM.match(l) and not re.match(r"^\s{2,}\S", l))
                if keep.strip():
                    pre["intro"].append({"title": "", "blocks": self._blocks_list(
                        [("md", keep, atts, -1)], assets, root)})
                continue
            if role == "goal":
                self._split_goal(text, pre, atts, assets, root)
                if pre["goal_html"] or pre["goal_extra_html"]:
                    continue
            if role == "objectives":
                intro, items = [], []
                for line in text.split("\n"):
                    lm = LIST_ITEM.match(line)
                    if lm:
                        items.append(lm.group(1).strip())
                    elif line.strip() and items and line.startswith(" "):
                        items[-1] += " " + line.strip()
                    elif line.strip() and not items:
                        intro.append(line.strip())
                pre["objectives"] = [self._inline(self.term.apply(x)) for x in items]
                pre["objectives_intro"] = self._inline(" ".join(intro))
                continue
            if role == "dataset":
                pre["dataset_html"] += self.renderer.render(text, atts, assets, root)
                continue
            if role == "runtime":
                pre["runtime_html"] += self.renderer.render(text, atts, assets, root)
                continue
            if role == "setup":
                blocks = self._blocks_list(part["items"], assets, root, role="setup")
                pre["setup_blocks"].extend(blocks)
                continue
            blocks = self._blocks_list(part["items"], assets, root)
            if part["title"] or blocks:
                pre["intro"].append({"title": self.term.apply(part["title"]), "blocks": blocks,
                                     "id": "intro-" + slugify(part["title"] or "start")})
        return pre

    def _blocks_list(self, items: list, assets: AssetStore, root: str, role: str | None = None) -> list[dict]:
        out: list[dict] = []
        for it in items:
            out.extend(self._blocks_for(it, None, assets, root, role=role if it[0] == "code" else None))
        return attach_image_labels(out)

    def _split_goal(self, text: str, pre: dict, atts: dict, assets: AssetStore, root: str) -> None:
        goal = re.search(r"\*\*Goal[.:]?\*\*[.:]?\s*(.+?)(?=\n\s*\*\*Outcome|\Z)", text, re.S)
        outcome = re.search(r"\*\*Outcome[.:]?\*\*[.:]?\s*(.+?)(?=\n\s*###|\Z)", text, re.S)
        if goal:
            pre["goal_html"] = self.renderer.render(goal.group(1).strip(), atts, assets, root)
        if outcome:
            pre["outcome_html"] = self.renderer.render(outcome.group(1).strip(), atts, assets, root)
        if not goal and not outcome and text.strip():
            pre["goal_extra_html"] = self.renderer.render(text, atts, assets, root)

    # -------------------------------------------------------------- finishing
    def _finalise(self, lesson: Lesson) -> None:
        words = 0
        for s in lesson.sections:
            s.blocks = attach_image_labels(s.blocks)
            qn = 0
            for b in s.blocks:
                if b["kind"] == "questions":
                    qn += 1
                    b["id"] = f"{s.num if s.num is not None else s.id}-{qn}"
                if b["kind"] in ("md", "questions"):
                    plain = md_to_plain(b["src"])
                    s.plain.append(plain)
                    words += len(plain.split())
                elif b["kind"] == "code":
                    lesson.code_cells += 1
                if b["kind"] == "md" and "<figure" in b["html"]:
                    lesson.figures += b["html"].count("<figure")
                if b["kind"] == "code":
                    lesson.figures += sum(1 for o in b["outputs"] if o["type"] == "image")
        # preamble questions get ids too
        qn = 0
        for part in lesson.preamble["intro"]:
            for b in part["blocks"]:
                if b["kind"] == "questions":
                    qn += 1
                    b["id"] = f"0-{qn}"
        lesson.word_count = words


def attach_image_labels(blocks: list[dict]) -> list[dict]:
    """Turn '🖼️ IMAGE x — title' markers into captions of the next figure."""
    out: list[dict] = []
    pending: dict | None = None
    for b in blocks:
        if b["kind"] == "image-label":
            pending = b
            continue
        if pending is not None and b["kind"] == "md" and "<figure" in b["html"]:
            cap = f'<span class="fig-num">Figure {pending["number"]}</span> {inline_md(pending["title"])}'
            if "<figcaption>" in b["html"]:
                b["html"] = re.sub(r"<figcaption>.*?</figcaption>", f"<figcaption>{cap}</figcaption>",
                                   b["html"], count=1, flags=re.S)
            else:
                b["html"] = b["html"].replace("</figure>", f"<figcaption>{cap}</figcaption></figure>", 1)
            pending = None
        out.append(b)
    return out
