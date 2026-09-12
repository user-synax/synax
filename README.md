# Synax

Synax is a custom scripting language that transpiles to JavaScript. You write
Synax source; the `synax` CLI compiles it down to plain, readable JavaScript.

The language is still being designed — the authoritative description of its
grammar and semantics lives in [SPEC.md](./SPEC.md).

## Status

**Scaffolding only.** The lexer, parser, and code generator are stubs that throw
`not implemented` errors. Look for the `TODO` comments in `src/` to find where
each stage's logic belongs.

## Requirements

- [Bun](https://bun.sh) — package manager, test runner, and runtime

No external dependencies are used; everything runs on the Bun standard library.

## Getting started

```sh
bun install                 # install dependencies (none yet)
bun test                    # run the test suite
bun run src/cli.ts <file>   # compile a Synax source file
```

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
| `tests/`         | Test suite (`bun test`)              |
| `SPEC.md`        | Language specification               |
