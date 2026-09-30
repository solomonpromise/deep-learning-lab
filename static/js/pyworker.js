/* Python in the browser (Pyodide), in a Web Worker.
   The worker has no access to the page or its localStorage, so code run here (and the Pyodide runtime
   loaded from the CDN) cannot read anything the page stores, such as a learner's saved tutor key.
   Messages in:  {type: 'run', id, code, ns, fresh}
   Messages out: {type: 'status', text} · {type: 'stream', id, name, text} ·
                 {type: 'done', id, result, figures, error, seconds} */
// A module worker (new Worker(url, {type: 'module'})): Pyodide is loaded with a standard import.
var PYODIDE = 'https://cdn.jsdelivr.net/pyodide/v314.0.7/full/';
var loadPyodide = null;

var py = null, current = null;
var HELPERS = [
  'import ast, base64, io, os, sys, warnings',
  'os.environ["MPLBACKEND"] = "Agg"',
  'warnings.filterwarnings("ignore", message=".*non-interactive.*")',
  'warnings.filterwarnings("ignore", message=".*FigureCanvasAgg.*")',
  '__dlp_spaces = {}',
  'def __dlp_space(name, fresh):',
  '    if fresh or name not in __dlp_spaces:',
  '        __dlp_spaces[name] = {"__name__": "__main__"}',
  '    return __dlp_spaces[name]',
  'def __dlp_run(src, name, fresh):',
  '    g = __dlp_space(name, fresh)',
  '    tree = ast.parse(src)',
  '    last = None',
  '    if tree.body and isinstance(tree.body[-1], ast.Expr):',
  '        last = ast.Expression(tree.body.pop().value)',
  '    exec(compile(tree, "<cell>", "exec"), g)',
  '    if last is not None:',
  '        v = eval(compile(last, "<cell>", "eval"), g)',
  '        if v is not None:',
  '            return repr(v)',
  '    return None',
  'def __dlp_figs():',
  '    if "matplotlib.pyplot" not in sys.modules:',
  '        return []',
  '    import matplotlib.pyplot as plt',
  '    out = []',
  '    for n in plt.get_fignums():',
  '        buf = io.BytesIO()',
  '        plt.figure(n).savefig(buf, format="png", dpi=80, bbox_inches="tight")',
  '        out.append(base64.b64encode(buf.getvalue()).decode())',
  '    plt.close("all")',
  '    return out'
].join('\n');

function status(text) { postMessage({ type: 'status', text: text }); }

var ready = (async function () {
  status('Starting Python in your browser…');
  loadPyodide = (await import(PYODIDE + 'pyodide.mjs')).loadPyodide;
  py = await loadPyodide({ indexURL: PYODIDE });
  py.setStdout({ batched: function (t) { if (current != null) postMessage({ type: 'stream', id: current, name: 'stdout', text: t + '\n' }); } });
  py.setStderr({ batched: function (t) { if (current != null) postMessage({ type: 'stream', id: current, name: 'stderr', text: t + '\n' }); } });
  py.runPython(HELPERS);
  // let urllib and pandas.read_csv fetch over HTTPS (synchronous requests are allowed in a worker)
  try { await py.loadPackage('pyodide-http'); py.runPython('import pyodide_http; pyodide_http.patch_all()'); } catch (e) { /* optional */ }
  status('ready');
})();

self.onmessage = async function (e) {
  var m = e.data;
  if (m.type !== 'run') return;
  var t0 = Date.now();
  try {
    await ready;
    current = m.id;
    var imports = [];
    try { imports = py.pyodide_py.code.find_imports(m.code).toJs(); } catch (err) { /* syntax errors surface on run */ }
    if (imports.length) {
      status('Loading ' + imports.filter(function (x) { return !/^(os|sys|time|math|random|re|json|io|ast|warnings|itertools|functools|collections|copy|pathlib|typing|dataclasses|__future__|textwrap|string|statistics)$/.test(x); }).join(', ') + '…');
      await py.loadPackagesFromImports(m.code);
    }
    status('ready');
    var run = py.globals.get('__dlp_run'), figs = py.globals.get('__dlp_figs');
    var result = run(m.code, m.ns || 'lesson', !!m.fresh);
    var figures = figs().toJs();
    run.destroy(); figs.destroy();
    postMessage({ type: 'done', id: m.id, result: result == null ? null : String(result), figures: figures, seconds: (Date.now() - t0) / 1000 });
  } catch (err) {
    var msg = String(err && err.message || err);
    // keep the Python part of the traceback: drop Pyodide's own frames above "<cell>"
    var cut = msg.indexOf('File "<cell>"');
    if (cut > 0) msg = 'Traceback (most recent call last):\n  ' + msg.slice(cut);
    var figures2 = [];
    try { var f2 = py.globals.get('__dlp_figs'); figures2 = f2().toJs(); f2.destroy(); } catch (e2) { /* ignore */ }
    postMessage({ type: 'done', id: m.id, error: msg, figures: figures2, seconds: (Date.now() - t0) / 1000 });
  } finally {
    current = null;
  }
};
