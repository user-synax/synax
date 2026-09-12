import { describe, expect, test } from "bun:test";

import { formatDiagnostic } from "../src/diagnostics";
import type { Diagnostic } from "../src/diagnostics";

function diag(overrides: Partial<Diagnostic> = {}): Diagnostic {
  return {
    file: "pgm.snx",
    line: 1,
    column: 1,
    length: 1,
    reason: "boom",
    ...overrides,
  };
}

/** The caret row must point at the same index as the reported character. */
function expectCaretAligned(output: string, character: string): void {
  const [, sourceRow, caretRow] = output.split("\n");
  expect(caretRow?.indexOf("^")).toBe(sourceRow?.indexOf(character));
}

describe("formatDiagnostic", () => {
  test("renders file:line:column, the source line, and a caret", () => {
    const output = formatDiagnostic(
      diag({ line: 1, column: 7, reason: 'Unexpected character "@"' }),
      "print @\n",
    );

    expect(output.split("\n")).toEqual([
      'pgm.snx:1:7: error: Unexpected character "@"',
      "  1 | print @",
      "    |       ^",
    ]);
  });

  test("the caret lines up with the offending character", () => {
    const output = formatDiagnostic(
      diag({ column: 15 }),
      "    set x = 1 @ 2\n",
    );

    expectCaretAligned(output, "@");
  });

  test("underlines a whole token when given a length", () => {
    const output = formatDiagnostic(
      diag({ column: 11, length: 7 }),
      '    print "adult"\n',
    );

    expect(output).toContain('    print "adult"');
    expect(output).toContain("^".repeat(7));
  });

  test("keeps the gutter aligned on a multi-digit line", () => {
    const output = formatDiagnostic(
      diag({ line: 10, column: 7 }),
      `${"ok\n".repeat(9)}print @\n`,
    );

    expect(output.split("\n")[1]).toContain("10 | print @");
    expectCaretAligned(output, "@");
  });

  test("preserves tabs so the caret stays aligned", () => {
    const output = formatDiagnostic(diag({ column: 8 }), "\tprint @\n");

    expectCaretAligned(output, "@");
  });

  test("shows only the header for a position past the last line", () => {
    expect(formatDiagnostic(diag({ line: 5, column: 1 }), "set x = 1\n")).toBe(
      "pgm.snx:5:1: error: boom",
    );
  });

  test("shows only the header when the line is blank", () => {
    expect(formatDiagnostic(diag({ line: 2, column: 1 }), "ok\n\n")).toBe(
      "pgm.snx:2:1: error: boom",
    );
  });

  test("handles CRLF sources without a stray carriage return", () => {
    const output = formatDiagnostic(
      diag({ line: 2, column: 7 }),
      "set x = 1\r\nprint @\r\n",
    );

    expect(output).not.toContain("\r");
    expect(output).toContain("print @");
    expectCaretAligned(output, "@");
  });
});
