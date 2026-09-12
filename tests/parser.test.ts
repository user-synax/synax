import { describe, expect, test } from "bun:test";

import { Lexer } from "../src/lexer";
import { Parser, ParserError } from "../src/parser";
import type { Program } from "../src/ast";

/** Lex + parse `source`, the way the CLI pipeline will. */
function parse(source: string): Program {
  return new Parser(new Lexer(source).tokenize()).parse();
}

/** Join lines into a source string, so indentation in tests stays readable. */
function src(...lines: string[]): string {
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Each statement type in isolation
// ---------------------------------------------------------------------------

describe("varDecl", () => {
  test("`set x = 5`", () => {
    expect(parse("set x = 5")).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "VarDecl",
          name: "x",
          value: { kind: "NumberLiteral", value: 5, line: 1 },
          line: 1,
        },
      ],
    });
  });

  test("the right-hand side can be any expression", () => {
    expect(parse("set total = a + b * 2")).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "VarDecl",
          name: "total",
          value: {
            kind: "BinaryExpr",
            operator: "+",
            line: 1,
            left: { kind: "Identifier", name: "a", line: 1 },
            right: {
              kind: "BinaryExpr",
              operator: "*",
              line: 1,
              left: { kind: "Identifier", name: "b", line: 1 },
              right: { kind: "NumberLiteral", value: 2, line: 1 },
            },
          },
          line: 1,
        },
      ],
    });
  });
});

describe("printStmt", () => {
  test("`print x`", () => {
    expect(parse("print x")).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "PrintStmt",
          argument: { kind: "Identifier", name: "x", line: 1 },
          line: 1,
        },
      ],
    });
  });

  test("`print \"hi\"`", () => {
    expect(parse('print "hi"')).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "PrintStmt",
          argument: { kind: "StringLiteral", value: "hi", line: 1 },
          line: 1,
        },
      ],
    });
  });
});

describe("ifStmt", () => {
  test("without an else branch has `elseBranch: null`", () => {
    expect(parse(src("if x", "    print 1", "end"))).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "IfStmt",
          line: 1,
          condition: { kind: "Identifier", name: "x", line: 1 },
          thenBranch: [
            {
              kind: "PrintStmt",
              line: 2,
              argument: { kind: "NumberLiteral", value: 1, line: 2 },
            },
          ],
          elseBranch: null,
        },
      ],
    });
  });

  test("with an else branch keeps both blocks", () => {
    expect(parse(src("if x", "    print 1", "else", "    print 2", "end"))).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "IfStmt",
          line: 1,
          condition: { kind: "Identifier", name: "x", line: 1 },
          thenBranch: [
            {
              kind: "PrintStmt",
              line: 2,
              argument: { kind: "NumberLiteral", value: 1, line: 2 },
            },
          ],
          elseBranch: [
            {
              kind: "PrintStmt",
              line: 4,
              argument: { kind: "NumberLiteral", value: 2, line: 4 },
            },
          ],
        },
      ],
    });
  });
});

describe("fnDecl", () => {
  test("`fn add(a, b) ... end` records params and body", () => {
    expect(parse(src("fn add(a, b)", "    print a + b", "end"))).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "FnDecl",
          name: "add",
          params: ["a", "b"],
          line: 1,
          body: [
            {
              kind: "PrintStmt",
              line: 2,
              argument: {
                kind: "BinaryExpr",
                operator: "+",
                line: 2,
                left: { kind: "Identifier", name: "a", line: 2 },
                right: { kind: "Identifier", name: "b", line: 2 },
              },
            },
          ],
        },
      ],
    });
  });

  test("a function with no parameters", () => {
    expect(parse(src("fn greet()", '    print "hi"', "end"))).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "FnDecl",
          name: "greet",
          params: [],
          line: 1,
          body: [
            {
              kind: "PrintStmt",
              line: 2,
              argument: { kind: "StringLiteral", value: "hi", line: 2 },
            },
          ],
        },
      ],
    });
  });
});

describe("forStmt", () => {
  test("`for i in 1..5 ... end`", () => {
    expect(parse(src("for i in 1..5", "    print i", "end"))).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "ForStmt",
          variable: "i",
          line: 1,
          start: { kind: "NumberLiteral", value: 1, line: 1 },
          end: { kind: "NumberLiteral", value: 5, line: 1 },
          body: [
            {
              kind: "PrintStmt",
              line: 2,
              argument: { kind: "Identifier", name: "i", line: 2 },
            },
          ],
        },
      ],
    });
  });
});

describe("exprStmt", () => {
  test("a bare function call", () => {
    expect(parse('greet("Ayush")')).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "ExprStmt",
          line: 1,
          expression: {
            kind: "FunctionCall",
            callee: "greet",
            line: 1,
            args: [{ kind: "StringLiteral", value: "Ayush", line: 1 }],
          },
        },
      ],
    });
  });

  test("a call with several comma-separated args", () => {
    expect(parse("add(1, x, 3)")).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "ExprStmt",
          line: 1,
          expression: {
            kind: "FunctionCall",
            callee: "add",
            line: 1,
            args: [
              { kind: "NumberLiteral", value: 1, line: 1 },
              { kind: "Identifier", name: "x", line: 1 },
              { kind: "NumberLiteral", value: 3, line: 1 },
            ],
          },
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Precedence and associativity
// ---------------------------------------------------------------------------

describe("expression precedence", () => {
  test("`1 + 2 * 3` nests the multiplication inside the addition", () => {
    expect(parse("print 1 + 2 * 3")).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "PrintStmt",
          line: 1,
          argument: {
            kind: "BinaryExpr",
            operator: "+",
            line: 1,
            left: { kind: "NumberLiteral", value: 1, line: 1 },
            right: {
              kind: "BinaryExpr",
              operator: "*",
              line: 1,
              left: { kind: "NumberLiteral", value: 2, line: 1 },
              right: { kind: "NumberLiteral", value: 3, line: 1 },
            },
          },
        },
      ],
    });
  });

  test("`2 * 3 + 1` also nests the multiplication, on the other side", () => {
    const program = parse("print 2 * 3 + 1");
    const statement = program.body[0] as { argument: unknown };

    expect(statement.argument).toEqual({
      kind: "BinaryExpr",
      operator: "+",
      line: 1,
      left: {
        kind: "BinaryExpr",
        operator: "*",
        line: 1,
        left: { kind: "NumberLiteral", value: 2, line: 1 },
        right: { kind: "NumberLiteral", value: 3, line: 1 },
      },
      right: { kind: "NumberLiteral", value: 1, line: 1 },
    });
  });

  test("comparison binds loosest: `1 + 2 == 3`", () => {
    const program = parse("print 1 + 2 == 3");
    const statement = program.body[0] as { argument: unknown };

    expect(statement.argument).toEqual({
      kind: "BinaryExpr",
      operator: "==",
      line: 1,
      left: {
        kind: "BinaryExpr",
        operator: "+",
        line: 1,
        left: { kind: "NumberLiteral", value: 1, line: 1 },
        right: { kind: "NumberLiteral", value: 2, line: 1 },
      },
      right: { kind: "NumberLiteral", value: 3, line: 1 },
    });
  });

  test("binary operators are left-associative: `1 - 2 - 3`", () => {
    const program = parse("print 1 - 2 - 3");
    const statement = program.body[0] as { argument: unknown };

    expect(statement.argument).toEqual({
      kind: "BinaryExpr",
      operator: "-",
      line: 1,
      left: {
        kind: "BinaryExpr",
        operator: "-",
        line: 1,
        left: { kind: "NumberLiteral", value: 1, line: 1 },
        right: { kind: "NumberLiteral", value: 2, line: 1 },
      },
      right: { kind: "NumberLiteral", value: 3, line: 1 },
    });
  });

  test("parentheses override precedence: `(1 + 2) * 3`", () => {
    const program = parse("print (1 + 2) * 3");
    const statement = program.body[0] as { argument: unknown };

    expect(statement.argument).toEqual({
      kind: "BinaryExpr",
      operator: "*",
      line: 1,
      left: {
        kind: "BinaryExpr",
        operator: "+",
        line: 1,
        left: { kind: "NumberLiteral", value: 1, line: 1 },
        right: { kind: "NumberLiteral", value: 2, line: 1 },
      },
      right: { kind: "NumberLiteral", value: 3, line: 1 },
    });
  });

  test("every comparison operator maps to its own node", () => {
    for (const operator of ["==", "!=", ">", "<", ">=", "<="] as const) {
      const program = parse(`print a ${operator} b`);
      const statement = program.body[0] as { argument: unknown };

      expect(statement.argument).toEqual({
        kind: "BinaryExpr",
        operator,
        line: 1,
        left: { kind: "Identifier", name: "a", line: 1 },
        right: { kind: "Identifier", name: "b", line: 1 },
      });
    }
  });
});

// ---------------------------------------------------------------------------
// The five example programs from SPEC.md section 8
// ---------------------------------------------------------------------------

describe("SPEC.md section 8 — Hello World", () => {
  test("`print \"Hello, World!\"`", () => {
    expect(parse('print "Hello, World!"')).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "PrintStmt",
          line: 1,
          argument: { kind: "StringLiteral", value: "Hello, World!", line: 1 },
        },
      ],
    });
  });
});

describe("SPEC.md section 8 — Variable + print", () => {
  test("`set x = 5` then `print x`", () => {
    expect(parse(src("set x = 5", "print x"))).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "VarDecl",
          name: "x",
          value: { kind: "NumberLiteral", value: 5, line: 1 },
          line: 1,
        },
        {
          kind: "PrintStmt",
          line: 2,
          argument: { kind: "Identifier", name: "x", line: 2 },
        },
      ],
    });
  });
});

describe("SPEC.md section 8 — If / else", () => {
  test("the blank line is skipped and both branches are captured", () => {
    const source = src(
      "set age = 19",
      "",
      "if age >= 18",
      '    print "adult"',
      "else",
      '    print "minor"',
      "end",
    );

    expect(parse(source)).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "VarDecl",
          name: "age",
          value: { kind: "NumberLiteral", value: 19, line: 1 },
          line: 1,
        },
        {
          kind: "IfStmt",
          line: 3,
          condition: {
            kind: "BinaryExpr",
            operator: ">=",
            line: 3,
            left: { kind: "Identifier", name: "age", line: 3 },
            right: { kind: "NumberLiteral", value: 18, line: 3 },
          },
          thenBranch: [
            {
              kind: "PrintStmt",
              line: 4,
              argument: { kind: "StringLiteral", value: "adult", line: 4 },
            },
          ],
          elseBranch: [
            {
              kind: "PrintStmt",
              line: 6,
              argument: { kind: "StringLiteral", value: "minor", line: 6 },
            },
          ],
        },
      ],
    });
  });
});

describe("SPEC.md section 8 — Function", () => {
  test("a `fn` declaration followed by a call", () => {
    const source = src(
      "fn greet(name)",
      '    print "Hello, " + name',
      "end",
      "",
      'greet("Ayush")',
    );

    expect(parse(source)).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "FnDecl",
          name: "greet",
          params: ["name"],
          line: 1,
          body: [
            {
              kind: "PrintStmt",
              line: 2,
              argument: {
                kind: "BinaryExpr",
                operator: "+",
                line: 2,
                left: { kind: "StringLiteral", value: "Hello, ", line: 2 },
                right: { kind: "Identifier", name: "name", line: 2 },
              },
            },
          ],
        },
        {
          kind: "ExprStmt",
          line: 5,
          expression: {
            kind: "FunctionCall",
            callee: "greet",
            line: 5,
            args: [{ kind: "StringLiteral", value: "Ayush", line: 5 }],
          },
        },
      ],
    });
  });
});

describe("SPEC.md section 8 — Loop", () => {
  test("`for i in 1..5`", () => {
    expect(parse(src("for i in 1..5", "    print i", "end"))).toEqual({
      kind: "Program",
      line: 1,
      body: [
        {
          kind: "ForStmt",
          variable: "i",
          line: 1,
          start: { kind: "NumberLiteral", value: 1, line: 1 },
          end: { kind: "NumberLiteral", value: 5, line: 1 },
          body: [
            {
              kind: "PrintStmt",
              line: 2,
              argument: { kind: "Identifier", name: "i", line: 2 },
            },
          ],
        },
      ],
    });
  });
});

// ---------------------------------------------------------------------------
// Structure: NEWLINE handling and EOF consumption
// ---------------------------------------------------------------------------

describe("statement separation", () => {
  test("an empty program parses to an empty body", () => {
    expect(parse("")).toEqual({ kind: "Program", body: [], line: 1 });
  });

  test("blank lines are not empty statements", () => {
    expect(parse("\n\n\n")).toEqual({ kind: "Program", body: [], line: 1 });
  });

  test("a trailing newline is fine", () => {
    const program = parse("set x = 1\n");

    expect(program.body).toHaveLength(1);
  });

  test("CRLF line endings parse the same as LF", () => {
    expect(parse("set x = 1\r\nprint x")).toEqual(parse("set x = 1\nprint x"));
  });

  test("two statements squashed onto one line are rejected", () => {
    expect(() => parse("print 1 print 2")).toThrow(ParserError);
    expect(() => parse("print 1 print 2")).toThrow(
      /Expected end of statement but found 'print' \(line 1\)/,
    );
  });
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

describe("errors", () => {
  test("a missing `end` throws ParserError", () => {
    const source = src("if x >= 1", '    print "adult"');

    expect(() => parse(source)).toThrow(ParserError);
  });

  test("a missing `end` reports the line where it was expected", () => {
    const source = src("if x >= 1", '    print "adult"');

    try {
      parse(source);
      throw new Error("expected parse to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ParserError);
      // EOF sits on line 2 because there is no trailing newline.
      expect((error as ParserError).line).toBe(2);
    }
  });

  test("the message names what was expected vs. what was found", () => {
    const source = src("if x >= 1", '    print "adult"');

    expect(() => parse(source)).toThrow(
      /Expected 'end' to close the 'if' but found end of input \(line 2\)/,
    );
  });

  test("a missing `=` reports the offending line", () => {
    try {
      parse("set x 5");
      throw new Error("expected parse to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ParserError);
      expect((error as ParserError).line).toBe(1);
      expect((error as Error).message).toMatch(
        /Expected '=' after the variable name but found '5'/,
      );
    }
  });

  test("a missing `end` on a later line reports that line", () => {
    const source = src(
      "set ok = 1",
      "if x",
      "    print 1",
      "    print 2",
    );

    try {
      parse(source);
      throw new Error("expected parse to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(ParserError);
      // EOF sits on the last line (4) because there is no trailing newline.
      expect((error as ParserError).line).toBe(4);
    }
  });

  test("a stray `end` at top level is rejected", () => {
    expect(() => parse("end")).toThrow(ParserError);
    expect(() => parse("end")).toThrow(/Expected an expression but found 'end'/);
  });

  test("a missing expression after `print` is rejected", () => {
    expect(() => parse("print\n")).toThrow(
      /Expected an expression but found end of line/,
    );
  });

  test("an unknown statement start fails loudly rather than stopping early", () => {
    // A `,` cannot begin a statement; the parser must not silently return an
    // empty program.
    expect(() => parse(", x")).toThrow(ParserError);
  });
});
