"""Rendering: markdown → HTML, code → highlighted HTML, outputs → HTML."""
from __future__ import annotations

import base64
import hashlib
import html
import io
import re
from pathlib import Path

from bs4 import BeautifulSoup, NavigableString
from markdown_it import MarkdownIt
from pygments import lex
from pygments.formatters import HtmlFormatter
from pygments.lexers import BashLexer, PythonLexer, TextLexer, get_lexer_by_name
from pygments.token import Comment, String

from .text import MathStash, Terminology, map_prose, slugify, strip_ansi

try:
    from PIL import Image
except ImportError:  # pragma: no cover
    Image = None

_FORMATTER = HtmlFormatter(nowrap=True)


# =========================================================== assets
class AssetStore:
    """Collects images (attachments + plot outputs) and writes them once."""

    def __init__(self, out_dir: Path, url_prefix: str):
        self.out_dir = out_dir
        self.url_prefix = url_prefix  # relative to site root, e.g. "assets/lessons/1.1"
        self.files: dict[str, bytes] = {}
        self.meta: dict[str, tuple[int, int]] = {}

    def add_png(self, data_b64: str, lossless: bool = False) -> tuple[str, int, int]:
        raw = base64.b64decode(data_b64)
        digest = hashlib.sha1(raw).hexdigest()[:12]
        ext, payload, size = "png", raw, (0, 0)
        if Image is not None:
            try:
                im = Image.open(io.BytesIO(raw))
                size = im.size
                if im.mode in ("P", "LA"):
                    im = im.convert("RGBA")
                buf = io.BytesIO()
                if lossless:
                    im.save(buf, "WEBP", lossless=True, method=4)
                else:
                    im.save(buf, "WEBP", quality=88, method=4)
                if buf.tell() < len(raw):
                    ext, payload = "webp", buf.getvalue()
            except Exception:
                pass
        name = f"{digest}.{ext}"
        self.files[name] = payload
        self.meta[name] = size
        return f"{self.url_prefix}/{name}", size[0], size[1]

    def write(self) -> None:
        self.out_dir.mkdir(parents=True, exist_ok=True)
        for name, payload in self.files.items():
            target = self.out_dir / name
            if not target.exists() or target.stat().st_size != len(payload):
                target.write_bytes(payload)


# =========================================================== code highlighting
def _lexer_for(lang: str):
    lang = (lang or "").strip().lower()
    if lang in ("", "text", "txt", "plain", "output"):
        return TextLexer()
    if lang in ("sh", "shell", "bash", "zsh", "console"):
        return BashLexer()
    try:
        return get_lexer_by_name(lang)
    except Exception:
        return TextLexer()


def highlight_lines(code: str, lang: str = "python", term: Terminology | None = None) -> tuple[list[str], str]:
    """Return (list of highlighted HTML lines, source text actually shown).

    Terminology is applied to comments and docstrings only.
    """
    lexer = _lexer_for(lang)
    tokens = []
    for ttype, value in lex(code, lexer):
        if term is not None and (ttype in Comment or ttype in String.Doc):
            value = term.apply(value)
        tokens.append((ttype, value))
    shown = "".join(v for _, v in tokens)
    buf = io.StringIO()
    _FORMATTER.format(iter(tokens), buf)
    out = buf.getvalue()
    if out.endswith("\n"):
        out = out[:-1]
    if shown.endswith("\n"):
        shown = shown[:-1]
    return out.split("\n"), shown


def is_shell_cell(src: str) -> bool:
    first = src.strip().split("\n", 1)[0].strip()
    return bool(re.match(r"^(!|%)?(pip|conda|uv|git|python|mkdir|cd|ls|cat|echo|source|export|brew|curl|wget)\b", first)) \
        and not re.match(r"^(python)\s*=", first)


# =========================================================== markdown
class MarkdownRenderer:
    def __init__(self, terminology: Terminology, fixes: list | None = None):
        self.term = terminology
        self.fixes = [(re.compile(a), b) for a, b in (fixes or [])]
        self.md = MarkdownIt("commonmark", {"html": True, "typographer": True}).enable(["table", "strikethrough"])
        self.md.options["highlight"] = self._highlight

    def _highlight(self, code: str, lang: str, attrs: str) -> str:
        lang = (lang or "").strip()
        if lang in ("", "text", "txt", "plain"):
            return ""  # default escaping, styled as a diagram block
        lines, _ = highlight_lines(code, lang, self.term)
        return "\n".join(lines)

    def render(self, text: str, attachments: dict | None = None, assets: AssetStore | None = None,
               root: str = "") -> str:
        text = strip_anchor_tags(text)
        for pat, rep in self.fixes:
            text = pat.sub(rep, text)
        stash = MathStash()
        text = map_prose(text, lambda s: stash.protect(self.term.apply(s)))
        if attachments and assets:
            text = self._resolve_attachments(text, attachments, assets, root)
        rendered = self.md.render(text)
        rendered = stash.restore(rendered)
        return postprocess_html(rendered)

    @staticmethod
    def _resolve_attachments(text: str, attachments: dict, assets: AssetStore, root: str) -> str:
        def repl(m: re.Match) -> str:
            name = m.group(1)
            att = attachments.get(name) or {}
            for mime in ("image/png", "image/jpeg", "image/gif"):
                if mime in att:
                    url, w, h = assets.add_png(att[mime]) if mime == "image/png" else (None, 0, 0)
                    if url is None:
                        digest = hashlib.sha1(att[mime].encode()).hexdigest()[:12]
                        ext = mime.split("/")[1]
                        assets.files[f"{digest}.{ext}"] = base64.b64decode(att[mime])
                        url = f"{assets.url_prefix}/{digest}.{ext}"
                    return root + url
            return m.group(0)

        return re.sub(r"attachment:([^\s\"')]+)", repl, text)


def strip_anchor_tags(text: str) -> str:
    return re.sub(r"<a\s+(?:id|name)=\"[^\"]*\"\s*>\s*</a>\s*", "", text)


def postprocess_html(fragment: str) -> str:
    soup = BeautifulSoup(fragment, "html.parser")
    # centred wrappers from notebooks → plain containers
    for div in soup.find_all("div", attrs={"align": True}):
        del div["align"]
        div["class"] = div.get("class", []) + ["nb-center"]
    # images → lazy, responsive, zoomable figures
    for img in soup.find_all("img"):
        img["loading"] = "lazy"
        img["decoding"] = "async"
        width = img.get("width")
        if width:
            del img["width"]
            img["style"] = f"max-width:min(100%, {int(re.sub(r'[^0-9]', '', width) or 900)}px)"
        img["class"] = img.get("class", []) + ["zoomable"]
        if not img.get("alt"):
            img["alt"] = "Diagram"
    for div in soup.find_all("div", class_="nb-center"):
        imgs = div.find_all("img")
        if len(imgs) == 1:
            fig = soup.new_tag("figure", attrs={"class": "figure"})
            img = imgs[0].extract()
            fig.append(img)
            # a <p><b>Figure N.</b> caption</p> in the same wrapper becomes the caption
            cap_text = div.get_text(" ", strip=True)
            if cap_text:
                cap = soup.new_tag("figcaption")
                p = next((p for p in div.find_all("p") if p.get_text(strip=True)), None)
                if p is not None and p.get_text(strip=True):
                    for child in list(p.children):
                        cap.append(child.extract())
                else:
                    cap.string = cap_text
                fig.append(cap)
            div.replace_with(fig)
        elif not div.get_text(strip=True) and not div.find(["img", "table", "svg"]):
            div.decompose()
    for p in soup.find_all("p"):
        if not p.get_text(strip=True) and not p.find(["img", "span", "br"]):
            p.decompose()
    # standalone markdown images → figures
    for p in soup.find_all("p"):
        kids = [c for c in p.children if not (isinstance(c, NavigableString) and not c.strip())]
        if len(kids) == 1 and getattr(kids[0], "name", None) == "img":
            fig = soup.new_tag("figure", attrs={"class": "figure"})
            fig.append(kids[0].extract())
            p.replace_with(fig)
    # tables scroll horizontally on phones
    for table in soup.find_all("table"):
        if table.parent is not None and "table-wrap" not in (table.parent.get("class") or []):
            wrap = soup.new_tag("div", attrs={"class": "table-wrap"})
            table.wrap(wrap)
    # blockquotes are key ideas
    for bq in soup.find_all("blockquote"):
        bq["class"] = bq.get("class", []) + ["keyidea"]
    # ``` text``` diagrams
    for pre in soup.find_all("pre"):
        code = pre.find("code")
        if code is not None and not (code.get("class") or []):
            pre["class"] = pre.get("class", []) + ["diagram"]
        elif code is not None:
            pre["class"] = pre.get("class", []) + ["hl"]
    # links
    for a in soup.find_all("a", href=True):
        if a["href"].startswith("http"):
            a["target"] = "_blank"
            a["rel"] = "noopener"
    # headings inside a body get anchors
    for h in soup.find_all(["h3", "h4", "h5"]):
        if not h.get("id"):
            h["id"] = "h-" + slugify(h.get_text())
    return str(soup)


# =========================================================== outputs
IPYTHON_NOISE = re.compile(r"^The history saving thread hit an unexpected error.*(?:\n|$)", re.M)


def _stream_text(text: str) -> str:
    text = IPYTHON_NOISE.sub("", strip_ansi(text))
    # emulate carriage returns (progress bars)
    lines = []
    for line in text.split("\n"):
        if "\r" in line:
            line = line.rsplit("\r", 1)[-1] or line.split("\r")[-2]
        lines.append(line)
    return "\n".join(lines)


def sanitize_html_output(raw: str) -> str | None:
    soup = BeautifulSoup(raw, "html.parser")
    for tag in soup.find_all(["style", "script", "iframe", "link"]):
        tag.decompose()
    table = soup.find("table")
    if table is None:
        return None
    for tag in soup.find_all(True):
        for attr in list(tag.attrs):
            if attr not in ("colspan", "rowspan"):
                del tag[attr]
    table["class"] = ["df"]
    shape_note = ""
    tail = soup.find_all("p")
    if tail:
        shape_note = f'<div class="df-shape">{html.escape(tail[-1].get_text(" ", strip=True))}</div>'
    return f'<div class="table-wrap df-wrap">{table}</div>{shape_note}'


def render_outputs(outputs: list[dict], assets: AssetStore, root: str) -> list[dict]:
    """Normalise notebook outputs into simple dicts the templates understand."""
    result: list[dict] = []
    for out in outputs:
        otype = out.get("output_type")
        if otype == "stream":
            text = _stream_text("".join(out.get("text", "")))
            if not text.strip():
                continue
            name = out.get("name", "stdout")
            # merge consecutive streams of the same kind
            if result and result[-1]["type"] == "text" and result[-1].get("stream") == name:
                result[-1]["text"] += text
            else:
                result.append({"type": "text", "stream": name, "text": text})
        elif otype in ("execute_result", "display_data"):
            data = out.get("data", {})
            if "image/png" in data:
                url, w, h = assets.add_png(data["image/png"])
                result.append({"type": "image", "src": root + url, "w": w, "h": h})
            elif "image/svg+xml" in data:
                svg = "".join(data["image/svg+xml"])
                result.append({"type": "svg", "html": svg})
            elif "text/html" in data and (safe := sanitize_html_output("".join(data["text/html"]))):
                result.append({"type": "html", "html": safe})
            elif "text/plain" in data:
                text = strip_ansi("".join(data["text/plain"]))
                if re.fullmatch(r"<(Figure|matplotlib)[^>]*>", text.strip()):
                    continue
                result.append({"type": "text", "stream": "result", "text": text})
        elif otype == "error":
            tb = strip_ansi("\n".join(out.get("traceback", [])))
            result.append({"type": "error", "ename": out.get("ename", "Error"),
                           "evalue": strip_ansi(out.get("evalue", "")), "text": tb})
    for r in result:
        if r["type"] in ("text", "error"):
            r["text"] = r["text"].rstrip("\n")
            r["lines"] = r["text"].count("\n") + 1
    return [r for r in result if r["type"] != "text" or r["text"].strip()]
