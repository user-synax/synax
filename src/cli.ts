#!/usr/bin/env bun
/**
 * Synax CLI entrypoint.
 *
 * Usage:
 *   bun run src/cli.ts <file>
 *
 * Reads a Synax source file, runs it through the pipeline
 * (`Lexer` -> `Parser` -> `generate`) and writes the resulting JavaScript to
 * stdout.
 *
 * Diagnostics go to stderr as a positioned message plus a code frame, with a
 * non-zero exit code — never a raw stack trace:
 *
 *   examples/bad.snx:1:7: error: Unexpected character "@"
 *     1 | print @
 *       |       ^
 *
 * Set `SYNAX_DEBUG=1` to include the stack for an internal compiler error.
 */
import { generate } from "./codegen";
import { formatDiagnostic } from "./diagnostics";
import { Lexer, LexerError } from "./lexer";
import { Parser, ParserError } from "./parser";

const USAGE = "Usage: synax <file>";

export async function main(
  argv: readonly string[] = Bun.argv.slice(2),
): Promise<void> {
  const filePath = argv[0];

  if (filePath === undefined) {
    console.error(USAGE);
    process.exitCode = 1;
    return;
  }

  let source: string;
  try {
    source = await Bun.file(filePath).text();
  } catch (error) {
    console.error(
      `synax: cannot read '${filePath}': ${describeReadFailure(error)}`,
    );
    process.exitCode = 1;
    return;
  }

  try {
    const tokens = new Lexer(source).tokenize();
    const ast = new Parser(tokens).parse();
    console.log(generate(ast));
  } catch (error) {
    process.exitCode = 1;

    // Expected diagnostics: a positioned message and a code frame.
    if (error instanceof LexerError || error instanceof ParserError) {
      console.error(
        formatDiagnostic(
          {
            file: filePath,
            line: error.line,
            column: error.column,
            length: error.length,
            reason: error.reason,
          },
          source,
        ),
      );
      return;
    }

    // A bug in the compiler rather than in the input. Keep it to one line by
    // default so it reads as a diagnostic, not a crash.
    console.error(`synax: internal error: ${describeError(error)}`);
    if (process.env["SYNAX_DEBUG"]) console.error(error);
  }
}

/** Turn a filesystem error into a short, human-readable reason. */
function describeReadFailure(error: unknown): string {
  switch ((error as { code?: unknown }).code) {
    case "ENOENT":
      return "no such file";
    case "EISDIR":
      return "is a directory";
    case "EACCES":
      return "permission denied";
    default:
      return "could not be read";
  }
}

function describeError(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

if (import.meta.main) {
  await main();
}
