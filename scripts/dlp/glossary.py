"""Glossary: hover definitions for technical terms, first use per section."""
from __future__ import annotations

import html
import re
from pathlib import Path

import yaml
from bs4 import BeautifulSoup, NavigableString

from .text import inline_md, slugify

SKIP_TAGS = {"code", "pre", "a", "h1", "h2", "h3", "h4", "h5", "button", "script", "style", "summary",
             "label", "textarea", "svg", "figcaption", "th", "kbd"}
SKIP_CLASSES = {"math", "term", "no-gloss", "code-cell", "widget", "qanswer-body", "sec-head", "out"}


class Glossary:
    def __init__(self, path: Path):
        data = yaml.safe_load(path.read_text(encoding="utf-8")) if path.exists() else []
        self.entries = []
        for e in data or []:
            key = slugify(e["term"])
            forms = [e["term"]] + list(e.get("aliases", []))
            self.entries.append({
                "key": key, "term": e["term"], "def_html": inline_md(e["def"].strip()),
                "def_text": e["def"].strip(), "module": e.get("module"), "forms": forms,
                "see": e.get("see", []),
            })
        self.by_key = {e["key"]: e for e in self.entries}
        pairs = []
        for e in self.entries:
            for f in e["forms"]:
                pairs.append((f, e["key"]))
        pairs.sort(key=lambda p: -len(p[0]))
        self.pattern = None
        if pairs:
            alt = "|".join(re.escape(f) for f, _ in pairs)
            self.pattern = re.compile(rf"(?<![\w-])({alt})(?![\w-])", re.I)
        self.lookup = {f.lower(): k for f, k in pairs}
        self.used_in: dict[str, list[tuple[str, str]]] = {}

    def as_js(self) -> dict:
        return {e["key"]: {"t": e["term"], "d": e["def_html"]} for e in self.entries}

    def annotate(self, page_html: str, page_label: str, page_url: str) -> str:
        """Wrap the first use of each term in each <section class='lsec'>."""
        if not self.pattern:
            return page_html
        soup = BeautifulSoup(page_html, "html.parser")
        body = soup.find(attrs={"data-gloss-root": True})
        if body is None:
            return page_html
        scopes = body.find_all("section", class_="lsec") or [body]
        for scope in scopes:
            used: set[str] = set()
            for node in list(scope.find_all(string=True)):
                if not isinstance(node, NavigableString) or not node.strip():
                    continue
                if self._skip(node):
                    continue
                text = str(node)
                pieces = []
                pos = 0
                for m in self.pattern.finditer(text):
                    key = self.lookup.get(m.group(1).lower())
                    if key is None or key in used:
                        continue
                    used.add(key)
                    pieces.append(html.escape(text[pos:m.start()], quote=False))
                    pieces.append(f'<span class="term" tabindex="0" role="button" data-term="{key}">'
                                  f'{html.escape(m.group(1), quote=False)}</span>')
                    pos = m.end()
                    refs = self.used_in.setdefault(key, [])
                    if (page_label, page_url) not in refs:
                        refs.append((page_label, page_url))
                if pieces:
                    pieces.append(html.escape(text[pos:], quote=False))
                    node.replace_with(BeautifulSoup("".join(pieces), "html.parser"))
        return str(soup)

    @staticmethod
    def _skip(node) -> bool:
        for parent in node.parents:
            if parent.name in SKIP_TAGS:
                return True
            cls = set(parent.get("class") or [])
            if cls & SKIP_CLASSES:
                return True
            if parent.has_attr("data-gloss-root"):
                return False
        return False
