"""Docstrings for every function and class shown to learners.

The teaching notebooks are never edited. Instead, each lesson's enrichment file can
provide a ``docstrings:`` mapping from a *qualified name* to a docstring, and this module
inserts (or replaces) that docstring in the displayed code and in the downloadable
notebook. Qualified names follow Python's ``__qualname__`` style:

    make_spirals              a top-level function
    SpiralNet                 a class
    SpiralNet.forward         a method
    encode_features.finish    a function defined inside another function

Anything still undocumented after injection is reported by the build, so gaps in new
modules are caught automatically.
"""
from __future__ import annotations

import ast
import re
from dataclasses import dataclass, field

MAGIC = re.compile(r"^\s*[!%]")
# A docstring starting with "Placeholder" marks a stub the notebook replaces further down
# (e.g. a helper defined early so a function can refer to it). It is left exactly as written.
PLACEHOLDER = re.compile(r"^\s*placeholder\b", re.I)


@dataclass
class DefInfo:
    """One function or class definition found in a code cell.

    Attributes:
        qualname: Dotted name such as ``"SpiralNet.forward"``.
        kind: ``"class"`` or ``"function"``.
        lineno: 1-based line of the ``def``/``class`` keyword.
        docstring: The docstring currently in the source, or ``None``.
        signature: The first line of the definition, for reports.
    """

    qualname: str
    kind: str
    lineno: int
    docstring: str | None
    signature: str


@dataclass
class InjectResult:
    """What happened to one code cell.

    Attributes:
        code: The source code after docstrings were inserted or replaced.
        defs: Every definition found in the cell (after injection).
        missing: Qualified names that still have no docstring.
        applied: Qualified names whose docstring came from the enrichment file.
    """

    code: str
    defs: list[DefInfo] = field(default_factory=list)
    missing: list[str] = field(default_factory=list)
    thin: list[str] = field(default_factory=list)
    applied: list[str] = field(default_factory=list)


def _parseable(code: str) -> str:
    """Blank out notebook magics (``!pip``, ``%time``) so ``ast`` can parse the rest.

    Line numbers are preserved because each magic line becomes an empty line.
    """
    return "\n".join("" if MAGIC.match(line) else line for line in code.split("\n"))


def find_defs(code: str) -> list[tuple[str, ast.AST]]:
    """Return ``(qualified_name, node)`` for every function and class in ``code``.

    Nested definitions are included and named with their parents, e.g. ``make_hook.hook``.
    Returns an empty list when the cell is not valid Python.
    """
    try:
        tree = ast.parse(_parseable(code))
    except SyntaxError:
        return []
    found: list[tuple[str, ast.AST]] = []

    def visit(node: ast.AST, prefix: str) -> None:
        for child in ast.iter_child_nodes(node):
            if isinstance(child, (ast.FunctionDef, ast.AsyncFunctionDef, ast.ClassDef)):
                name = f"{prefix}.{child.name}" if prefix else child.name
                found.append((name, child))
                visit(child, name)
            else:
                visit(child, prefix)

    visit(tree, "")
    return found


def _format(doc: str, indent: str) -> list[str]:
    """Turn docstring text into indented source lines wrapped in triple quotes."""
    text = doc.strip("\n").rstrip()
    text = text.replace('"""', "'''")
    prefix = 'r"""' if "\\" in text else '"""'
    lines = text.split("\n")
    if len(lines) == 1:
        return [f'{indent}{prefix}{lines[0]}"""']
    out = [f"{indent}{prefix}{lines[0]}"]
    out += [(indent + line) if line.strip() else "" for line in lines[1:]]
    out.append(f'{indent}"""')
    return out


def inject(code: str, docmap: dict[str, str] | None) -> InjectResult:
    """Insert or replace docstrings in one code cell.

    Args:
        code: The cell's source code.
        docmap: ``{qualified_name: docstring}`` from the lesson's enrichment file.
            A name present here always wins over an existing docstring.

    Returns:
        An :class:`InjectResult` with the new code, the definitions it contains,
        and the names that still lack a docstring.
    """
    docmap = docmap or {}
    defs = find_defs(code)
    if not defs:
        return InjectResult(code=code)
    lines = code.split("\n")
    applied: list[str] = []
    # Edit from the bottom up so earlier line numbers stay valid.
    for qualname, node in sorted(defs, key=lambda d: -d[1].lineno):
        doc = docmap.get(qualname)
        if doc is None:
            continue
        body = node.body
        first = body[0]
        has_doc = (isinstance(first, ast.Expr) and isinstance(getattr(first, "value", None), ast.Constant)
                   and isinstance(first.value.value, str))
        if has_doc and PLACEHOLDER.match(first.value.value):
            continue
        if first.lineno == node.lineno:
            # one-line definition: "def f(x): return x"  ->  split header and body
            line = lines[node.lineno - 1]
            header, rest = line[:first.col_offset].rstrip(), line[first.col_offset:]
            indent = re.match(r"\s*", line).group(0) + "    "
            new = [header] + _format(doc, indent) + ([] if has_doc else [indent + rest])
            lines[node.lineno - 1:node.lineno] = new
        else:
            indent = re.match(r"\s*", lines[first.lineno - 1]).group(0)
            if has_doc:
                lines[first.lineno - 1:first.end_lineno] = _format(doc, indent)
            else:
                lines[first.lineno - 1:first.lineno - 1] = _format(doc, indent)
        applied.append(qualname)
    new_code = "\n".join(lines)
    result = InjectResult(code=new_code, applied=applied)
    for qualname, node in find_defs(new_code):
        ds = ast.get_docstring(node)
        sig = new_code.split("\n")[node.lineno - 1].strip()
        result.defs.append(DefInfo(qualname, "class" if isinstance(node, ast.ClassDef) else "function",
                                   node.lineno, ds, sig))
        if not ds:
            result.missing.append(qualname)
        elif is_thin(node, ds) and not PLACEHOLDER.match(ds):
            result.thin.append(qualname)
    return result


def is_thin(node: ast.AST, doc: str) -> bool:
    """True when a docstring is a bare one-liner on something that takes arguments.

    A function with parameters (other than ``self``/``cls``) should explain them, so a
    single summary line is flagged. Classes and argument-free functions may stay short.
    """
    if isinstance(node, ast.ClassDef):
        return False
    args = [a.arg for a in node.args.args + node.args.kwonlyargs if a.arg not in ("self", "cls")]
    if node.args.vararg or node.args.kwarg:
        args.append("*")
    return bool(args) and len(doc.strip().splitlines()) < 2
