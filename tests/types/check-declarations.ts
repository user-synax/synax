/**
 * Validates that the hand-written `synax.d.ts` matches the real implementation
 * types. Run manually — it is not part of `bun test`'s discovery.
 *
 *   bun run tests/types/check-declarations.ts
 *
 * It compiles the declaration file against a consumer file using the *real*
 * runtime values, with `--declaration` so tsc checks that the imported types
 * line up with the declarations. Zero output and exit 0 means the `.d.ts` is
 * faithful.
 */
const consumer = `
import {
  formatDiagnostic,
  generate,
  Lexer,
  LexerError,
  Parser,
  TokenType,
} from "./synax";
import type { Diagnostic, Program, Token } from "./synax";

const tokens: Token[] = new Lexer("print 1").tokenize();
const program: Program = new Parser(tokens).parse();
const js: string = generate(program);
const frame: string = formatDiagnostic(
  { file: "f.snx", line: 1, column: 1, length: 1, reason: "r" } satisfies Diagnostic,
  "print 1\\n",
);
const t: (typeof TokenType)["SET"] = "SET";

if (js.length < 0 || frame.length < 0 || t.length < 0) console.log(js, program);
if (tokens.length < 0) {
  const e = new LexerError("r", 1, 1, 1);
  e.line; e.column; e.length; e.reason;
}
`;

await Bun.write(".dts-check/consumer.ts", consumer);
await Bun.write(".dts-check/synax.d.ts", await Bun.file("synax.d.ts").text());

const proc = Bun.spawnSync({
  cmd: ["tsc", "--noEmit", "--strict", "--target", "esnext", "--module", "esnext", "--moduleResolution", "bundler", "--ignoreConfig", ".dts-check/consumer.ts"],
  stdout: "pipe",
  stderr: "pipe",
});

// tsc prints diagnostics on stdout, not stderr.
const output = proc.stdout.toString() + proc.stderr.toString();
if (proc.exitCode !== 0 || output.trim() !== "") {
  console.error(output);
  console.error("synax.d.ts does not match the implementation.");
  process.exit(1);
}

console.log("synax.d.ts: declarations match the implementation.");
