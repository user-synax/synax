#!/usr/bin/env bun
/**
 * Synax CLI entrypoint.
 *
 * Usage:
 *   bun run src/cli.ts <file>
 *
 * Reads a Synax source file, runs it through the pipeline
 * (`Lexer` -> `Parser` -> `generate`) and writes the resulting JavaScript to
 * stdout. Diagnostics go to stderr with a non-zero exit code, so the CLI is
 * usable from a shell pipeline.
 */
import { generate } from "./codegen";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParserError } from "./parser";

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

  let source: string;
  try {
    source = await Bun.file(filePath).text();
  } catch {
    console.error(`synax: cannot read '${filePath}'`);
    process.exitCode = 1;
    return;
  }

  try {
    const tokens = new Lexer(source).tokenize();
    const ast = new Parser(tokens).parse();
    // `generate` returns source with no trailing newline; console.log adds one.
    console.log(generate(ast));
  } catch (error) {
    // Lexer and parser errors already carry a line number in their message,
    // so prefixing the file is enough to make a usable diagnostic.
    if (error instanceof LexerError || error instanceof ParserError) {
      console.error(`${filePath}: ${error.message}`);
      process.exitCode = 1;
      return;
    }

    throw error;
  }
}

if (import.meta.main) {
  await main();
}
