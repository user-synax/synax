import { describe, expect, test } from "bun:test";

const CLI = `${import.meta.dir}/../src/cli.ts`;
const EXAMPLES = `${import.meta.dir}/../examples`;
const FIXTURES = `${import.meta.dir}/fixtures`;

interface CliResult {
  readonly exitCode: number;
  readonly stdout: string;
  readonly stderr: string;
}

/** Run the real CLI in a subprocess, the way a user would. */
function cli(...args: readonly string[]): CliResult {
  const result = Bun.spawnSync({
    cmd: [process.execPath, CLI, ...args],
    stdout: "pipe",
    stderr: "pipe",
  });

  return {
    exitCode: result.exitCode,
    stdout: result.stdout.toString(),
    stderr: result.stderr.toString(),
  };
}

// ---------------------------------------------------------------------------
// Compiling the example programs
// ---------------------------------------------------------------------------

describe("compiling a file", () => {
  test("hello.snx", () => {
    const result = cli(`${EXAMPLES}/hello.snx`);

    expect(result.exitCode).toBe(0);
    expect(result.stderr).toBe("");
    expect(result.stdout).toBe('console.log("Hello, World!");\n');
  });

  test("variables.snx", () => {
    const result = cli(`${EXAMPLES}/variables.snx`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe('let x = 5;\nconsole.log(x);\n');
  });

  test("if-else.snx", () => {
    const result = cli(`${EXAMPLES}/if-else.snx`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      [
        "let age = 19;",
        "if (age >= 18) {",
        '  console.log("adult");',
        "} else {",
        '  console.log("minor");',
        "}",
        "",
      ].join("\n"),
    );
  });

  test("greet.snx", () => {
    const result = cli(`${EXAMPLES}/greet.snx`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      [
        "function greet(name) {",
        '  console.log("Hello, " + name);',
        "}",
        'greet("Ayush");',
        "",
      ].join("\n"),
    );
  });

  test("loop.snx keeps the inclusive bound", () => {
    const result = cli(`${EXAMPLES}/loop.snx`);

    expect(result.exitCode).toBe(0);
    expect(result.stdout).toBe(
      ['for (let i = 1; i <= 5; i++) {', "  console.log(i);", "}", ""].join("\n"),
    );
  });
});

// ---------------------------------------------------------------------------
// Diagnostics
// ---------------------------------------------------------------------------

describe("diagnostics", () => {
  test("no arguments prints usage and fails", () => {
    const result = cli();

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("Usage: synax <file>");
  });

  test("a missing file reports a friendly error instead of throwing", () => {
    const result = cli(`${EXAMPLES}/does-not-exist.snx`);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("cannot read");
    expect(result.stderr).toContain("does-not-exist.snx");
    expect(result.stderr).toContain("no such file");
    // A raw stack trace would mean the error escaping the CLI.
    expect(result.stderr).not.toContain("    at ");
  });

  test("a lexer error is reported with file:line:column and a code frame", () => {
    const result = cli(`${FIXTURES}/bad-character.snx`);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain(
      'bad-character.snx:1:7: error: Unexpected character "@"',
    );
    // The frame shows the offending source line and underlines the character.
    expect(result.stderr).toContain("  1 | print @");
    expect(result.stderr).toContain("^");
    expect(result.stderr).not.toContain("    at ");
  });

  test("a parser error is reported with file:line:column", () => {
    const result = cli(`${FIXTURES}/missing-end.snx`);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    // The fixture ends with a newline, so the EOF token that `end` is missing
    // from sits at line 3, column 1 — the empty line after `print 1`.
    expect(result.stderr).toContain(
      "missing-end.snx:3:1: error: Expected 'end' to close the 'if'",
    );
    expect(result.stderr).not.toContain("    at ");
  });

  test("the frame underlines the whole offending token", () => {
    const result = cli(`${FIXTURES}/squashed-statements.snx`);

    expect(result.exitCode).toBe(1);
    expect(result.stderr).toContain(
      "squashed-statements.snx:1:9: error: Expected end of statement but found 'print'",
    );
    expect(result.stderr).toContain("print 1 print 2");
    // The second `print` (5 characters) is underlined, not just its first char.
    expect(result.stderr).toContain("^".repeat(5));
  });
});
