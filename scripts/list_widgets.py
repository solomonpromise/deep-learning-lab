#!/usr/bin/env python3
"""Print the README's table of interactive labs: every file in static/js/widgets/, the first
line of its header comment, and the lessons whose enrichment file uses it.

    python scripts/list_widgets.py            print the table
    python scripts/list_widgets.py --readme   rewrite the table inside README.md
"""
from __future__ import annotations

import re
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
START, END = "<!-- widgets:start -->", "<!-- widgets:end -->"


def used_in() -> dict[str, list[str]]:
    uses: dict[str, list[str]] = {}
    for f in sorted(ROOT.glob("enrichments/[0-9]*.yaml")):
        if f.name.count(".") > 2:          # N.M.checkpoints.yaml, N.M.docstrings.yaml
            continue
        data = yaml.safe_load(f.read_text(encoding="utf-8")) or {}
        items = list(data.get("inserts") or []) + ([data["big_picture"]] if data.get("big_picture") else [])
        for item in items:
            if item.get("type") == "widget":
                uses.setdefault(item["name"], [])
                if f.stem not in uses[item["name"]]:
                    uses[item["name"]].append(f.stem)
    return uses


def table() -> str:
    uses = used_in()
    rows = ["| Name | What it does | Used in |", "|---|---|---|"]
    for f in sorted((ROOT / "static/js/widgets").glob("*.js")):
        head = re.sub(r"\s+", " ", f.read_text(encoding="utf-8").split("*/", 1)[0].lstrip("/* \n")).strip()
        what = head.split(" — ", 1)[1] if " — " in head else head
        what = re.split(r"(?<=[a-z0-9)])\.\s", what, maxsplit=1)[0]          # the first sentence
        rows.append(f"| `{f.stem}` | {what.rstrip('.')} | {', '.join(uses.get(f.stem, [])) or '—'} |")
    return "\n".join(rows)


def main() -> int:
    t = table()
    if "--readme" not in sys.argv:
        print(t)
        return 0
    readme = ROOT / "README.md"
    text = readme.read_text(encoding="utf-8")
    if START not in text:
        print(f"README.md has no {START} … {END} markers", file=sys.stderr)
        return 1
    text = re.sub(re.escape(START) + r".*?" + re.escape(END), f"{START}\n{t}\n{END}", text, flags=re.S)
    readme.write_text(text, encoding="utf-8")
    print(f"README.md: {t.count(chr(10)) - 1} labs listed")
    return 0


if __name__ == "__main__":
    sys.exit(main())
