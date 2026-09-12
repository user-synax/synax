/**
 * Builds `synax.html` — a single standalone file: language docs plus a live
 * playground (edit Synax, see JS, run it), with the entire compiler and UI
 * script inlined. No network, no build artifacts to serve; double-click it.
 *
 *   bun run scripts/build-docs.ts
 *
 * Runtime deps: Bun only.
 */
import { $ } from "bun";

const OUT = "synax.html";

// ---------------------------------------------------------------------------
// 1. Bundle the compiler for the browser and prove it works before embedding.
// ---------------------------------------------------------------------------

const build = await Bun.build({
  entrypoints: ["./scripts/browser-entry.ts"],
  target: "browser",
  format: "iife",
  minify: true,
});

if (!build.success) {
  console.error("browser bundle failed:", build.logs);
  process.exit(1);
}

const bundle = await build.outputs[0]!.text();

// Smoke-test the bundle the same way the page will use it: evaluate, then
// compile+execute a program. A compiler that references Bun/Node globals would
// throw here.
const verified = new Function(
  `${bundle};\n` +
    `const api = globalThis.Synax;\n` +
    `if (!api || typeof api.generate !== "function") throw new Error("Synax global missing");\n` +
    `let ok = false;\n` +
    `const log = console.log; console.log = () => { ok = true; };\n` +
    `try { new Function(api.generate(new api.Parser(new api.Lexer('print "ok"').tokenize()).parse()))(); }\n` +
    `finally { console.log = log; }\n` +
    `if (!ok) throw new Error("bundle compile+run smoke test failed");\n`,
)(); // throws on any failure; returns undefined on success.

console.log(`compiler bundle: ${(bundle.length / 1024).toFixed(1)} KB (smoke test passed)`);

// ---------------------------------------------------------------------------
// 2. The UI script, inlined verbatim into the page.
// ---------------------------------------------------------------------------

const UI_SCRIPT = String.raw`
(function () {
  "use strict";

  var Synax = globalThis.Synax;

  var EXAMPLES = {
    "Hello World": 'print "Hello, World!"\n',
    "Variables": "set x = 5\nprint x\n",
    "If / else": [
      "set age = 19",
      "",
      "if age >= 18",
      '    print "adult"',
      "else",
      '    print "minor"',
      "end",
      ""
    ].join("\n"),
    "Function": [
      "fn greet(name)",
      '    print "Hello, " + name',
      "end",
      "",
      'greet("Ayush")',
      ""
    ].join("\n"),
    "Loop": "for i in 1..5\n    print i\nend\n",
    "Fibonacci": [
      "fn fib(a, b, n)",
      "    if n > 0",
      "        print a",
      "        fib(b, a + b, n - 1)",
      "    end",
      "end",
      "",
      "fib(0, 1, 10)",
      ""
    ].join("\n"),
    "FizzBuzz": [
      "# FizzBuzz for 1..15.",
      "set fizz = 0",
      "set buzz = 0",
      "for i in 1..15",
      "    set fizz = fizz + 1",
      "    set buzz = buzz + 1",
      "    if fizz == 3",
      "        set fizz = 0",
      "    end",
      "    if buzz == 5",
      "        set buzz = 0",
      "    end",
      "    if fizz == 0",
      "        if buzz == 0",
      '            print "FizzBuzz"',
      "        else",
      '            print "Fizz"',
      "        end",
      "    else",
      "        if buzz == 0",
      '            print "Buzz"',
      "        else",
      "            print i",
      "        end",
      "    end",
      "end",
      ""
    ].join("\n")
  };

  var $editor = document.getElementById("editor");
  var $js = document.getElementById("js");
  var $output = document.getElementById("output");
  var $diagnostic = document.getElementById("diagnostic");
  var $run = document.getElementById("run");
  var $examples = document.getElementById("examples");

  // Captured console.log calls from the executed program.
  var captured = [];

  function render() {
    $js.textContent = "";
    $diagnostic.textContent = "";
    $diagnostic.className = "diagnostic";
    try {
      var ast = new Synax.Parser(new Synax.Lexer($editor.value).tokenize()).parse();
      $js.textContent = Synax.generate(ast);
    } catch (error) {
      if (error && (error.name === "LexerError" || error.name === "ParserError")) {
        $diagnostic.textContent = Synax.formatDiagnostic(
          {
            file: "program.snx",
            line: error.line,
            column: error.column,
            length: error.length,
            reason: error.reason,
          },
          $editor.value,
        );
        $diagnostic.className = "diagnostic error";
      } else {
        $diagnostic.textContent = "internal error: " + error;
        $diagnostic.className = "diagnostic error";
      }
      $js.textContent = "";
    }
  }

  function runProgram() {
    $output.textContent = "";
    if ($js.textContent.trim() === "") return;
    captured = [];
    var log = console.log;
    console.log = function () {
      for (var i = 0; i < arguments.length; i++) captured.push(String(arguments[i]));
    };
    try {
      new Function($js.textContent)();
    } catch (error) {
      captured.push("RuntimeError: " + error.message);
    } finally {
      console.log = log;
    }
    $output.textContent = captured.length ? captured.join("\n") : "(no output)";
    $output.className = "output";
  }

  function selectExample() {
    var program = EXAMPLES[$examples.value];
    if (program === undefined) return;
    $editor.value = program;
    render();
    runProgram();
  }

  $editor.addEventListener("input", render);
  $run.addEventListener("click", runProgram);
  $examples.addEventListener("change", selectExample);

  // Initial state: load an example so the page is alive on first open.
  $examples.value = "If / else";
  selectExample();
})();
`;

// ---------------------------------------------------------------------------
// 3. The page.
// ---------------------------------------------------------------------------

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Synax — a small scripting language that compiles to JavaScript</title>
<style>
  :root {
    --bg: #0f1115; --panel: #161a22; --border: #2a3040;
    --text: #e6e9f0; --muted: #9aa3b5; --accent: #7aa2f7;
    --error: #f7768e; --ok: #9ece6a; --mono: ui-monospace, "Cascadia Code", Consolas, monospace;
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--text);
         font: 16px/1.6 system-ui, -apple-system, "Segoe UI", sans-serif; }
  main { max-width: 980px; margin: 0 auto; padding: 24px 20px 80px; }
  h1 { font-size: 2rem; margin: 0 0 4px; }
  h1 .accent { color: var(--accent); }
  .tagline { color: var(--muted); margin: 0 0 28px; }
  h2 { font-size: 1.25rem; margin: 36px 0 12px; border-bottom: 1px solid var(--border); padding-bottom: 6px; }
  code, pre { font-family: var(--mono); font-size: 0.92em; }
  code { background: var(--panel); border: 1px solid var(--border); border-radius: 4px; padding: 1px 5px; }
  pre { background: var(--panel); border: 1px solid var(--border); border-radius: 8px;
        padding: 12px 14px; overflow-x: auto; line-height: 1.5; }
  table { border-collapse: collapse; width: 100%; font-size: 0.95em; }
  th, td { text-align: left; padding: 7px 10px; border-bottom: 1px solid var(--border); }
  th { color: var(--muted); font-weight: 600; }
  td code { white-space: nowrap; }
  .playground { background: var(--panel); border: 1px solid var(--border); border-radius: 10px; padding: 14px; }
  .pg-bar { display: flex; gap: 10px; align-items: center; margin-bottom: 10px; flex-wrap: wrap; }
  .pg-bar label { color: var(--muted); font-size: 0.9em; }
  select, button {
    font: inherit; background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 6px; padding: 6px 12px;
  }
  button { background: var(--accent); color: #0b0e14; font-weight: 600; cursor: pointer; border: none; }
  .panes { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }
  @media (max-width: 760px) { .panes { grid-template-columns: 1fr; } }
  .pane { display: flex; flex-direction: column; min-width: 0; }
  .pane h3 { margin: 0 0 6px; font-size: 0.85rem; color: var(--muted);
             text-transform: uppercase; letter-spacing: 0.06em; font-weight: 600; }
  textarea, .output, .js, .diagnostic {
    font-family: var(--mono); font-size: 13.5px; line-height: 1.5;
    background: var(--bg); color: var(--text);
    border: 1px solid var(--border); border-radius: 8px; padding: 10px 12px;
    white-space: pre; overflow: auto;
  }
  textarea { width: 100%; height: 300px; resize: vertical; }
  .output, .js { min-height: 120px; max-height: 300px; }
  .diagnostic { border-color: var(--error); color: var(--error); margin-top: 10px; display: none; }
  .diagnostic.error { display: block; }
  .footnote { color: var(--muted); font-size: 0.9em; margin-top: 8px; }
  details summary { cursor: pointer; color: var(--accent); }
  details pre { margin-top: 8px; }
</style>
</head>
<body>
<main>
  <h1><span class="accent">synax</span> — no braces, no semicolons</h1>
  <p class="tagline">A small scripting language that compiles to plain, readable JavaScript.
     Reads closer to plain English than Python.</p>

  <h2>Try it right here</h2>
  <div class="playground">
    <div class="pg-bar">
      <label for="examples">Examples:</label>
      <select id="examples">
        <option>Hello World</option>
        <option>Variables</option>
        <option>If / else</option>
        <option>Function</option>
        <option>Loop</option>
        <option>Fibonacci</option>
        <option>FizzBuzz</option>
      </select>
      <button id="run" type="button">Run ▶</button>
      <span class="footnote">The full compiler is inlined in this page — everything runs locally.</span>
    </div>
    <div class="panes">
      <div class="pane">
        <h3>program.snx</h3>
        <textarea id="editor" spellcheck="false"></textarea>
      </div>
      <div class="pane">
        <h3>JavaScript</h3>
        <div id="js" class="js"></div>
      </div>
    </div>
    <div id="diagnostic" class="diagnostic"></div>
    <h3 style="margin-top:12px">Output</h3>
    <div id="output" class="output">(press Run)</div>
  </div>

  <h2>Install &amp; run locally</h2>
  <pre>npm install synax        # or: bun add synax
synax program.snx        # prints JavaScript to stdout
synax program.snx | node # compile and run it</pre>

  <h2>The language in one table</h2>
  <table>
    <tr><th>Construct</th><th>Syntax</th><th>Compiles to</th></tr>
    <tr><td>Declare / assign</td><td><code>set x = 5</code></td><td><code>let x = 5;</code> (later <code>set</code>s reassign)</td></tr>
    <tr><td>Print</td><td><code>print e</code></td><td><code>console.log(e);</code></td></tr>
    <tr><td>If / else</td><td><code>if c … else … end</code></td><td><code>if (c) { … } else { … }</code></td></tr>
    <tr><td>Function</td><td><code>fn f(a, b) … end</code></td><td><code>function f(a, b) { … }</code></td></tr>
    <tr><td>Loop</td><td><code>for i in 1..5 … end</code></td><td><code>for (let i = 1; i &lt;= 5; i++) { … }</code> — inclusive</td></tr>
    <tr><td>Call</td><td><code>f(x, y)</code></td><td><code>f(x, y);</code></td></tr>
    <tr><td>Comment</td><td><code># line &nbsp;/# block #/</code></td><td>stripped</td></tr>
    <tr><td>Strings</td><td><code>"a\\nb"</code></td><td><code>\\n \\t \\" \\\\</code> escapes decoded</td></tr>
    <tr><td>Operators</td><td><code>+ - * / == != &gt; &lt; &gt;= &lt;=</code></td><td>same precedence as JS; <code>+</code> coerces like JS</td></tr>
  </table>

  <h2>From source</h2>
  <pre># clone the repo, then:
bun install
bun test                     # 158 tests
bun run src/cli.ts examples/fizzbuzz.snx
bun run scripts/build-docs.ts   # regenerate this page</pre>

  <p class="footnote">Spec: <code>SPEC.md</code> · License: MIT · v0.0.1</p>
</main>
<script>${bundle}</script>
<script>${UI_SCRIPT}</script>
</body>
</html>
`;

await Bun.write(OUT, HTML);
console.log(`wrote ${OUT} (${(HTML.length / 1024).toFixed(1)} KB)`);
