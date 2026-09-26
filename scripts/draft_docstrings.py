#!/usr/bin/env python3
"""Draft docstrings for a lesson's undocumented functions and classes with an AI model.

    GROQ_API_KEY=gsk_... python scripts/draft_docstrings.py 5.1          (or: make docstrings L=5.1)
    GROQ_API_KEY=gsk_... python scripts/draft_docstrings.py 5.1 --all    also redo one-line docstrings

For every function or class in the lesson that has no docstring (or, with --all, only a
one-line docstring on a function that takes arguments), the model receives the code cell
and writes a Google-style docstring in the course's house style. Drafts are saved to
``enrichments/N.M.docstrings.yaml``, a separate file, so:

  * the build uses them immediately (they appear on the site and in the download),
  * anything you write by hand under ``docstrings:`` in ``enrichments/N.M.yaml`` wins,
  * you can review, edit or delete the draft file at any time.

Always read the drafts before publishing: they are a starting point, not the final word.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

import yaml

sys.path.insert(0, str(Path(__file__).resolve().parent))
from dlp.docstrings import find_defs, inject, is_thin  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent
GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"

STYLE = """You write docstrings for the teaching code of a deep learning course
(learners know Python and classical ML; the course teaches PyTorch and deep learning engineering).

House style (Google style):
1. First line: one sentence summary in the imperative or descriptive mood, ending with a period.
2. Blank line, then 1-3 short plain-English sentences: what it does and why it exists in the lesson.
3. "Args:" section: every parameter except self/cls, with meaning, expected type/shape
   (e.g. "shape ``(N, F)``") and units or valid values when relevant.
4. "Returns:" (or "Yields:") describing type, shape and meaning. Omit for functions returning None.
5. "Raises:" only if the code raises explicitly.
6. Classes: summary + what the class represents; list important attributes under "Attributes:" if useful.
Use double backticks for code, like ``torch.no_grad()``. Be precise; never invent behaviour the code
does not have. Output ONLY the docstring text, without surrounding quotes or markdown fences."""


def ask(key: str, model: str, cell: str, qualname: str) -> str:
    """Request one docstring from the model and return its cleaned text."""
    body = {
        "model": model,
        "temperature": 0.2,
        "max_completion_tokens": 900,
        "messages": [
            {"role": "system", "content": STYLE},
            {"role": "user", "content": f"Code cell:\n```python\n{cell}\n```\n\n"
                                        f"Write the docstring for `{qualname}`."},
        ],
    }
    if "qwen" in model:
        body.update(reasoning_effort="low", reasoning_format="hidden")
    req = urllib.request.Request(GROQ_URL, data=json.dumps(body).encode(), method="POST",
                                 headers={"Authorization": f"Bearer {key}", "Content-Type": "application/json",
                                          "User-Agent": "deep-learning-lab-docstrings"})
    for attempt in range(4):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                text = json.load(r)["choices"][0]["message"]["content"]
            break
        except urllib.error.HTTPError as e:
            if e.code == 429 and attempt < 3:
                time.sleep(8 * (attempt + 1))
                continue
            raise SystemExit(f"Groq error {e.code}: {e.read()[:300]!r}")
    text = text.strip().strip("`")
    if text.startswith(("python\n", "text\n")):
        text = text.split("\n", 1)[1]
    return text.strip().strip('"').strip("'").strip()


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("lesson", help='lesson id, e.g. "5.1"')
    ap.add_argument("--all", action="store_true", help="also replace one-line docstrings on functions with arguments")
    ap.add_argument("--dry-run", action="store_true", help="list what would be drafted, without calling the model")
    args = ap.parse_args()

    lid = args.lesson
    nb_path = ROOT / "notes" / f"module-{lid.split('.')[0]}" / f"lesson-{lid}.ipynb"
    if not nb_path.exists():
        raise SystemExit(f"No notebook at {nb_path}. Run `make sync` first.")
    cfg = yaml.safe_load((ROOT / "course.yaml").read_text(encoding="utf-8"))
    model = (cfg.get("tutor") or {}).get("model", "qwen/qwen3.8-27b")
    manual = (yaml.safe_load((ROOT / "enrichments" / f"{lid}.yaml").read_text(encoding="utf-8"))
              if (ROOT / "enrichments" / f"{lid}.yaml").exists() else {}) or {}
    manual_docs = manual.get("docstrings") or {}
    draft_path = ROOT / "enrichments" / f"{lid}.docstrings.yaml"
    drafts = (yaml.safe_load(draft_path.read_text(encoding="utf-8")) or {}) if draft_path.exists() else {}

    todo: list[tuple[str, str]] = []
    nb = json.loads(nb_path.read_text(encoding="utf-8"))
    for cell in nb.get("cells", []):
        if cell.get("cell_type") != "code":
            continue
        code = "".join(cell.get("source", ""))
        for qualname, node in find_defs(code):
            if qualname in manual_docs or qualname in drafts or any(q == qualname for q, _ in todo):
                continue
            import ast
            doc = ast.get_docstring(node)
            if not doc or (args.all and is_thin(node, doc)):
                todo.append((qualname, code))

    if not todo:
        print(f"Lesson {lid}: every function and class already has a docstring.")
        return 0
    print(f"Lesson {lid}: {len(todo)} docstring(s) to draft with {model}:")
    for q, _ in todo:
        print("  -", q)
    if args.dry_run:
        return 0
    key = os.environ.get("GROQ_API_KEY")
    if not key:
        raise SystemExit("Set GROQ_API_KEY to draft docstrings (the key is only used locally, never saved).")

    for qualname, code in todo:
        print(f"  drafting {qualname} …", flush=True)
        text = ask(key, model, code, qualname)
        # sanity check: the draft must produce valid Python when inserted
        inject(code, {qualname: text})
        drafts[qualname] = text

    header = ("# DRAFT docstrings generated by scripts/draft_docstrings.py.\n"
              "# Review and edit before publishing. Hand-written entries under `docstrings:`\n"
              f"# in enrichments/{lid}.yaml take precedence over these.\n")
    draft_path.write_text(header + yaml.safe_dump(drafts, sort_keys=True, allow_unicode=True, width=100),
                          encoding="utf-8")
    print(f"\nSaved {len(todo)} draft(s) to {draft_path.relative_to(ROOT)}. Review them, then run `make build`.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
