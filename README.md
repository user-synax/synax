# Synax

Synax is a custom scripting language that transpiles to JavaScript. You write
Synax source; the `synax` CLI compiles it down to plain, readable JavaScript.

The language is still being designed — the authoritative description of its
grammar and semantics lives in [SPEC.md](./SPEC.md). There is also
[synax.html](./synax.html): a single-file docs page with a live in-browser
playground (the whole compiler is inlined — open it, no server needed).

## Status

The pipeline is implemented end to end: source is lexed, parsed into an AST, and
compiled to JavaScript. See SPEC.md §9 for what is deliberately out of scope.

Two semantics were decided while building the code generator:

- `for i in 1..5` is **inclusive** of the upper bound (compiles to `i <= 5`).
- `+` keeps JavaScript's coercion, so `"n=" + 5` concatenates rather than
erroring.

## Requirements

- [Bun](https://bun.sh) — package manager, test runner, and runtime

No external dependencies are used; everything runs on the Bun standard library.

## Install

The package ships a `synax` binary and a typed library API:

```sh
bun add synax          # or: npm install synax
```

Compile a file with the CLI:

```sh
synax program.snx                # prints JavaScript to stdout
synax examples/loop.snx          # ships with the package
```

Or use it from code:

```ts
import { generate, Lexer, Parser } from "synax";

const source = 'print "Hello, World!"';
const js = generate(new Parser(new Lexer(source).tokenize()).parse());
```

## Getting started (from source)

```sh
bun install                       # install dependencies (none yet)
bun test                          # run the test suite
bun run src/cli.ts <file>         # compile a Synax source file to stdout
bun run src/cli.ts examples/loop.snx
bun run build                     # bundle the CLI and library into dist/
bun run docs                      # regenerate synax.html (docs + playground)
```

The compiler prints JavaScript to stdout and diagnostics to stderr, exiting
non-zero on a lexer, parser, or file error, so it works in a shell pipeline.
Diagnostics point at the source:

```
examples/bad.snx:1:7: error: Unexpected character "@"
  1 | print @
    |       ^
```

Set `SYNAX_DEBUG=1` to include a stack trace for an internal compiler error.

There is also a `bun run build` script that bundles the CLI into `dist/`.

## Project layout

| Path             | Purpose                              |
| ---------------- | ------------------------------------ |
| `src/lexer.ts`   | Source text → tokens                 |
| `src/ast.ts`     | AST node type definitions            |
| `src/parser.ts`  | Tokens → AST                         |
| `src/codegen.ts` | AST → JavaScript                     |
| `src/diagnostics.ts` | Positioned errors → code frames  |
| `src/cli.ts`     | Command-line entrypoint              |
| `src/index.ts`   | Public API re-exports                |
| `examples/`      | Sample `.snx` programs               |
| `tests/`         | Test suite (`bun test`)              |
| `SPEC.md`        | Language specification               |
| `synax.d.ts`     | Type declarations for the published package |
