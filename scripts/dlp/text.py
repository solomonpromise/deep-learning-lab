"""Text helpers: protecting code and math, terminology, slugs, plain text."""
from __future__ import annotations

import html
import re
import unicodedata

FENCE_OPEN = re.compile(r"^(\s*)(`{3,}|~{3,})(.*)$")
INLINE_CODE = re.compile(r"(`+)(.+?)\1", re.S)


def split_code(text: str) -> list[tuple[bool, str]]:
    """Split markdown into (is_code, chunk) segments.

    Fenced blocks and inline code spans are code; everything else is prose.
    Transformations (math, terminology) are only ever applied to prose.
    """
    segments: list[tuple[bool, str]] = []
    prose: list[str] = []
    lines = text.split("\n")
    i = 0
    while i < len(lines):
        m = FENCE_OPEN.match(lines[i])
        if m:
            fence = m.group(2)
            block = [lines[i]]
            i += 1
            while i < len(lines):
                block.append(lines[i])
                if lines[i].strip().startswith(fence[0] * len(fence)) and lines[i].strip().strip(fence[0]) == "":
                    i += 1
                    break
                i += 1
            if prose:
                segments.extend(_split_inline("\n".join(prose) + "\n"))
                prose = []
            segments.append((True, "\n".join(block) + ("\n" if i < len(lines) else "")))
            continue
        prose.append(lines[i])
        i += 1
    if prose:
        segments.extend(_split_inline("\n".join(prose)))
    return segments


def _split_inline(text: str) -> list[tuple[bool, str]]:
    out: list[tuple[bool, str]] = []
    pos = 0
    for m in INLINE_CODE.finditer(text):
        if m.start() > pos:
            out.append((False, text[pos:m.start()]))
        out.append((True, m.group(0)))
        pos = m.end()
    if pos < len(text):
        out.append((False, text[pos:]))
    return out


def map_prose(text: str, fn) -> str:
    """Apply fn to the prose parts of markdown only."""
    return "".join(chunk if is_code else fn(chunk) for is_code, chunk in split_code(text))


# ----------------------------------------------------------------- math
DISPLAY_MATH = re.compile(r"\$\$(.+?)\$\$", re.S)
INLINE_MATH = re.compile(r"(?<![\\$\w])\$(?=[^\s$])((?:\\\$|[^$\n])+?)(?<=[^\s\\])\$(?![\d$])")


class MathStash:
    """Swap LaTeX for placeholders before markdown rendering, restore after."""

    def __init__(self) -> None:
        self.items: list[tuple[str, bool]] = []

    def _put(self, tex: str, display: bool) -> str:
        self.items.append((tex.strip(), display))
        return f"MATHPH{len(self.items) - 1}XEND"

    def protect(self, prose: str) -> str:
        prose = DISPLAY_MATH.sub(lambda m: self._put(m.group(1), True), prose)
        prose = INLINE_MATH.sub(lambda m: self._put(m.group(1), False), prose)
        return prose

    def restore(self, rendered: str) -> str:
        def repl(m: re.Match) -> str:
            tex, display = self.items[int(m.group(1))]
            esc = html.escape(tex, quote=True)
            if display:
                return f'<div class="math math-display" data-tex="{esc}">\\[{esc}\\]</div>'
            return f'<span class="math" data-tex="{esc}">\\({esc}\\)</span>'

        rendered = re.sub(r"<p>\s*(MATHPH(\d+)XEND)\s*</p>",
                          lambda m: repl(re.match(r"MATHPH(\d+)XEND", m.group(1))), rendered)
        return re.sub(r"MATHPH(\d+)XEND", repl, rendered)


# ----------------------------------------------------------------- terminology
class Terminology:
    def __init__(self, rules: list[list[str]]):
        self.rules = [(re.compile(pat), rep) for pat, rep in rules]

    def apply(self, text: str) -> str:
        for pat, rep in self.rules:
            text = pat.sub(rep, text)
        return text


# ----------------------------------------------------------------- misc
def slugify(value: str, max_len: int = 60) -> str:
    value = unicodedata.normalize("NFKD", value).encode("ascii", "ignore").decode()
    value = re.sub(r"[`*_]", "", value)
    value = re.sub(r"[^\w\s-]", "", value).strip().lower()
    value = re.sub(r"[-\s]+", "-", value)
    return value[:max_len].strip("-")


ANSI = re.compile(r"\x1b\[[0-9;?]*[A-Za-z]")


def strip_ansi(s: str) -> str:
    return ANSI.sub("", s)


def md_to_plain(md: str) -> str:
    """Rough markdown → plain text (for search and matching)."""
    s = re.sub(r"```.*?```", " ", md, flags=re.S)
    s = re.sub(r"<[^>]+>", " ", s)
    s = re.sub(r"!\[[^\]]*\]\([^)]*\)", " ", s)
    s = re.sub(r"\[([^\]]+)\]\([^)]*\)", r"\1", s)
    s = re.sub(r"[#>*_`|]", " ", s)
    s = re.sub(r"\$+", "", s)
    return re.sub(r"\s+", " ", s).strip()


def inline_md(text: str) -> str:
    """Tiny inline-markdown renderer for short strings (titles, list items)."""
    esc = html.escape(text, quote=False)
    esc = re.sub(r"`([^`]+)`", r"<code>\1</code>", esc)
    esc = re.sub(r"\*\*([^*]+)\*\*", r"<strong>\1</strong>", esc)
    esc = re.sub(r"(?<!\w)\*([^*]+)\*(?!\w)", r"<em>\1</em>", esc)
    return esc
