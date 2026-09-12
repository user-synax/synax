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
    // A raw stack trace would mean the error escaping the CLI.
    expect(result.stderr).not.toContain("at ");
  });

  test("a lexer error is reported with the file and line", () => {
    const result = cli(`${FIXTURES}/bad-character.snx`);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("bad-character.snx");
    expect(result.stderr).toContain("Unexpected character");
    expect(result.stderr).toContain("(line 1)");
  });

  test("a parser error is reported with the file and line", () => {
    const result = cli(`${FIXTURES}/missing-end.snx`);

    expect(result.exitCode).toBe(1);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("missing-end.snx");
    expect(result.stderr).toContain("Expected 'end'");
    // The fixture ends with a newline, so the EOF token that `end` is missing
    // from sits on line 3 (the empty line after `print 1`), not line 2.
    expect(result.stderr).toContain("(line 3)");
  });
});
