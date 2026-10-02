"""Audit the stylesheets against what the site actually uses.

    python3 scripts/build.py                 # the audit reads dist/, so build first
    python3 scripts/dev/css_audit.py         # report
    python3 scripts/dev/css_audit.py --fix   # also delete dead selectors from site.css and learn.css
    python3 scripts/dev/css_audit.py --fix --all   # … and from activation.css and widgets.css

Reports, per stylesheet:
- dead selectors: a class in the selector appears nowhere in templates/, static/js/, scripts/ or the built
  dist/ pages and data (so no page can match it). Classes built in JavaScript from a prefix, like 'lv-' + n,
  count as used when the prefix appears quoted.
- clashes: a selector that uses a syntax-highlighting class (Pygments: .nf, .sa, .nn …) outside code, which
  would restyle tokens inside every code cell. Scope those to .code, .hl or an SVG class.
--fix only touches site.css and learn.css unless --all is given. Read the report before fixing: a class that only
ever appears in content still to come (a new lesson, a new widget) would be reported as dead.
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CSS = ["static/css/site.css", "static/css/learn.css", "static/css/widgets.css", "static/css/activation.css"]
FIXABLE = {"static/css/site.css", "static/css/learn.css"}
CLASS = re.compile(r"(?<![\w-])\.(-?[A-Za-z_][\w-]*)")


def corpus() -> str:
    """Where class names can come from. HTML counts only through class attributes (so a word in the lesson text
    does not keep a class alive); scripts count in full, since they build markup in strings."""
    parts = []
    for pattern in ["templates/**/*.html", "dist/**/*.html", "dist/static/question-bank.js"]:
        for f in ROOT.glob(pattern):
            parts += re.findall(r'class=\\?"([^"\\]*)', f.read_text(encoding="utf-8", errors="ignore"))
    for pattern in ["static/js/**/*.js", "scripts/**/*.py"]:
        for f in ROOT.glob(pattern):
            if f.name != "css_audit.py":
                parts.append(f.read_text(encoding="utf-8", errors="ignore"))
    return "\n".join(parts)


def used(name: str, text: str, cache: dict) -> bool:
    if name not in cache:
        ok = re.search(r"(?<![\w-])" + re.escape(name) + r"(?![\w-])", text) is not None
        if not ok and "-" in name:                       # built from a prefix: 'lv-' + n, "st-" + status, s-{{ … }}
            prefix = name[: name.rindex("-") + 1]
            ok = re.search(r"['\"\s]" + re.escape(prefix) + r"(['\"]\s*\+|\{\{)", text) is not None
        cache[name] = ok
    return cache[name]


def rules(css: str):
    """Yield (start, end, selector_text) for every style rule, descending into @media, @supports and @container."""
    i, n = 0, len(css)
    stack = []
    sel_start = 0
    while i < n:
        if css.startswith("/*", i):
            i = css.index("*/", i) + 2
            sel_start = i
            continue
        c = css[i]
        if c == "{":
            head = css[sel_start:i].strip()
            if head.startswith("@"):
                if head.startswith(("@media", "@supports", "@container", "@layer")):
                    stack.append("group")
                    sel_start = i + 1
                else:                                    # @keyframes, @font-face, @page: skip the whole block
                    depth, j = 1, i + 1
                    while depth:
                        depth += {"{": 1, "}": -1}.get(css[j], 0)
                        j += 1
                    i = sel_start = j
                    continue
            else:
                j = css.index("}", i)
                yield sel_start, j + 1, css[sel_start:i]
                i = sel_start = j + 1
                continue
        elif c == "}":
            if stack:
                stack.pop()
            sel_start = i + 1
        i += 1


def main() -> int:
    fix, every = "--fix" in sys.argv, "--all" in sys.argv
    text, cache = corpus(), {}
    try:
        from pygments.token import STANDARD_TYPES
        tokens = {v for v in STANDARD_TYPES.values() if v}
    except ImportError:
        tokens = set()
    for t in tokens:                                     # code can contain any token the highlighter knows
        cache[t] = True
    total_dead = 0
    for rel in CSS:
        path = ROOT / rel
        css = path.read_text(encoding="utf-8")
        edits, dead_here, clashes = [], [], []
        for start, end, sel in rules(css):
            # the selector text may begin with blank lines or a comment's tail: work on the trimmed list
            lead = len(sel) - len(sel.lstrip())
            selectors = [s.strip() for s in sel.split(",")]
            keep = []
            for s in selectors:
                names = CLASS.findall(re.sub(r"::?[\w-]+(\([^)]*\))?", "", s))
                if names and not all(used(c, text, cache) for c in names):
                    dead_here.append((css.count("\n", 0, start + lead) + 1, s))
                else:
                    keep.append(s)
                if tokens and any(c in tokens for c in names) and not re.search(r"\.(code|hl|highlight|codehilite)\b|svg", s):
                    clashes.append((css.count("\n", 0, start + lead) + 1, s))
            if len(keep) != len(selectors):
                edits.append((start + lead, end, keep, css[start + lead:end]))
        total_dead += len(dead_here)
        print(f"{rel}: {len(dead_here)} dead selector(s), {len(clashes)} clash(es)")
        for line, s in dead_here:
            print(f"  dead   {line}: {s[:110]}")
        for line, s in clashes:
            print(f"  clash  {line}: {s[:110]}")
        if fix and (every or rel in FIXABLE) and edits:
            for start, end, keep, block in reversed(edits):
                body = block[block.index("{"):]
                new = (", ".join(keep) + " " + body) if keep else ""
                if not keep:                             # drop the rule and the line break after it
                    while end < len(css) and css[end] == "\n":
                        end += 1
                        break
                css = css[:start] + new + css[end:]
            path.write_text(css, encoding="utf-8")
            print(f"  removed from {rel}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
