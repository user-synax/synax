#!/usr/bin/env bun
/**
 * Synax CLI entrypoint.
 *
 * Usage:
 *   bun run src/cli.ts <file>
 *
 * TODO: the pipeline below is wired up but every stage is still a stub, so
 * running this today throws "not implemented". Remaining work:
 *   - resolve the path and read the source file (done, but error handling for
 *     missing/unreadable files still needs to be added)
 *   - lex -> parse -> generate
 *   - decide where the output goes (stdout vs. a `.js` file next to the input)
 *   - surface lexer/parser errors with file name, line, and column
 */
import { generate } from "./codegen";
import { Lexer } from "./lexer";
import { Parser } from "./parser";

const USAGE = "Usage: synax <file>";

export async function main(
  argv: readonly string[] = Bun.argv.slice(2),
): Promise<void> {
  const filePath = argv[0];

  if (!filePath) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  // TODO: handle a missing file / unreadable path with a friendly message.
  const source = await Bun.file(filePath).text();

  // TODO: these all throw until the individual stages are implemented.
  const tokens = new Lexer(source).tokenize();
  const ast = new Parser(tokens).parse();
  const output = generate(ast);

  // TODO: write `output` to stdout, or to a file when an `--out` flag is given.
  console.log(output);
}

if (import.meta.main) {
  await main();
}
