#!/usr/bin/env python3
"""Import lesson notebooks from the teaching folders into notes/.

Usage:  python scripts/sync_notes.py            (or: make sync)

The script scans the folders listed under `sources.folders` in course.yaml
(by default ../Day 1, ../Day 2, …), works out which lesson every notebook
belongs to (from its "## Note N.M" heading, or from its file name), and copies
the best version of each lesson to notes/module-N/lesson-N.M.ipynb.

When a lesson exists in several versions, the file whose name contains one of
`sources.prefer` wins (e.g. "_self_sufficient"), otherwise the newest file.
Lessons listed in `sources.locked` are never overwritten.
"""
from __future__ import annotations

import glob
import hashlib
import json
import re
import shutil
import sys
from pathlib import Path

import yaml

ROOT = Path(__file__).resolve().parent.parent
NOTES = ROOT / "notes"

LESSON_HEADING = re.compile(r"^#{1,3}\s*(?:Note|Lesson)\s+(\d+)\.(\d+)\b", re.M | re.I)
LESSON_FILENAME = re.compile(r"(\d+)[._](\d+)")


def lesson_id(path: Path) -> str | None:
    """Return "N.M" for a notebook, or None if it is not a lesson."""
    try:
        nb = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return None
    for cell in nb.get("cells", [])[:6]:
        if cell.get("cell_type") != "markdown":
            continue
        m = LESSON_HEADING.search("".join(cell.get("source", "")))
        if m:
            return f"{int(m.group(1))}.{int(m.group(2))}"
    m = LESSON_FILENAME.search(path.stem)
    return f"{int(m.group(1))}.{int(m.group(2))}" if m else None


def rank(path: Path, prefer: list[str]) -> tuple:
    name = path.name.lower()
    pref = next((i for i, word in enumerate(prefer) if word.lower() in name), len(prefer))
    # lower preference index first, then newest first, then shortest name
    return (pref, -path.stat().st_mtime, len(name))


def sha(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()[:16]


def main() -> int:
    cfg = yaml.safe_load((ROOT / "course.yaml").read_text(encoding="utf-8"))
    src_cfg = cfg.get("sources", {})
    prefer = src_cfg.get("prefer", [])
    locked = {str(x) for x in src_cfg.get("locked", [])}

    candidates: dict[str, list[Path]] = {}
    for pattern in src_cfg.get("folders", []):
        for folder in sorted(glob.glob(str(ROOT / pattern))):
            for nb_path in sorted(Path(folder).glob("*.ipynb")):
                if nb_path.name.startswith("."):
                    continue
                lid = lesson_id(nb_path)
                if lid:
                    candidates.setdefault(lid, []).append(nb_path)

    if not candidates:
        print("No lesson notebooks found. Check `sources.folders` in course.yaml.")
        return 1

    manifest_path = NOTES / "sources.json"
    manifest = json.loads(manifest_path.read_text()) if manifest_path.exists() else {}

    def sort_key(lid: str):
        a, b = lid.split(".")
        return int(a), int(b)

    changed = 0
    for lid in sorted(candidates, key=sort_key):
        module = lid.split(".")[0]
        dest = NOTES / f"module-{module}" / f"lesson-{lid}.ipynb"
        options = sorted(candidates[lid], key=lambda p: rank(p, prefer))
        chosen = options[0]
        others = ", ".join(p.name for p in options[1:])
        if lid in locked and dest.exists():
            print(f"  {lid:>5}  locked — keeping curated notebook")
            continue
        digest = sha(chosen)
        if dest.exists() and manifest.get(lid, {}).get("sha") == digest:
            status = "unchanged"
        else:
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(chosen, dest)
            status = "updated"
            changed += 1
        manifest[lid] = {
            "source": str(chosen.relative_to(ROOT.parent)),
            "sha": digest,
            "ignored_variants": [p.name for p in options[1:]],
        }
        print(f"  {lid:>5}  {status:9}  ← {chosen.parent.name}/{chosen.name}"
              + (f"   (ignored: {others})" if others else ""))

    manifest_path.write_text(json.dumps(manifest, indent=2, sort_keys=True))
    print(f"\n{changed} lesson notebook(s) copied into notes/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
