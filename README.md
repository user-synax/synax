# Synax

Synax is a custom scripting language that transpiles to JavaScript. You write
Synax source; the `synax` CLI compiles it down to plain, readable JavaScript.

The language is still being designed — the authoritative description of its
grammar and semantics lives in [SPEC.md](./SPEC.md).

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

## Getting started

```sh
bun install                       # install dependencies (none yet)
bun test                          # run the test suite
bun run src/cli.ts <file>         # compile a Synax source file to stdout
bun run src/cli.ts examples/loop.snx
```

The compiler prints JavaScript to stdout and diagnostics to stderr, exiting
non-zero on a lexer, parser, or file error, so it works in a shell pipeline.

There is also a `bun run build` script that bundles the CLI into `dist/`.

## Project layout

| Path             | Purpose                              |
| ---------------- | ------------------------------------ |
| `src/lexer.ts`   | Source text → tokens                 |
| `src/ast.ts`     | AST node type definitions            |
| `src/parser.ts`  | Tokens → AST                         |
| `src/codegen.ts` | AST → JavaScript                     |
| `src/cli.ts`     | Command-line entrypoint              |
| `src/index.ts`   | Public API re-exports                |
| `examples/`      | Sample `.snx` programs               |
| `tests/`         | Test suite (`bun test`)              |
| `SPEC.md`        | Language specification               |
