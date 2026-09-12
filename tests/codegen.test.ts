import { describe, expect, test } from "bun:test";

import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { generate } from "../src/codegen";

/** Lex + parse + generate — the full pipeline minus file I/O. */
function compile(source: string): string {
  return generate(new Parser(new Lexer(source).tokenize()).parse());
}

/** Compile `source`, run the resulting JS, and collect everything it logged. */
function run(source: string): unknown[] {
  const output: unknown[] = [];
  const original = console.log;

  console.log = ((...args: unknown[]) => {
    output.push(...args);
  }) as typeof console.log;

  try {
    new Function(compile(source))();
  } finally {
    console.log = original;
  }

  return output;
}

/** Join lines into a source string, so indentation in tests stays readable. */
function src(...lines: string[]): string {
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

describe("set", () => {
  test("declares with `let`", () => {
    expect(compile("set x = 5")).toBe("let x = 5;");
  });

  test("reassignment drops the `let` (SPEC §6)", () => {
    expect(compile(src("set x = 5", "set x = 6", "print x"))).toBe(
      src("let x = 5;", "x = 6;", "console.log(x);"),
    );
  });

  test("only the first `set` of a name in a scope declares", () => {
    expect(compile(src("set x = 1", "set x = 2", "set x = 3"))).toBe(
      src("let x = 1;", "x = 2;", "x = 3;"),
    );
  });

  test("a name first set inside an `if` shares the function scope", () => {
    expect(compile(src("set x = 1", "if x", "    set x = 2", "end", "print x"))).toBe(
      src("let x = 1;", "if (x) {", "  x = 2;", "}", "console.log(x);"),
    );
  });
});

describe("print", () => {
  test("becomes console.log", () => {
    expect(compile('print "hi"')).toBe('console.log("hi");');
  });

  test("prints a number literal", () => {
    expect(compile("print 42")).toBe("console.log(42);");
  });

  test("prints a float literal", () => {
    expect(compile("print 3.14")).toBe("console.log(3.14);");
  });

  test("escapes string contents into valid JS", () => {
    expect(compile('print "He said \\"hi\\""')).toBe(
      'console.log("He said \\"hi\\"");',
    );
  });

  test("decoded escapes are re-escaped for JS", () => {
    // Source contains a literal backslash-t; the lexer decodes it to a tab,
    // which JSON.stringify then re-encodes.
    expect(compile('print "a\\tb"')).toBe('console.log("a\\tb");');
  });
});

describe("expression statements", () => {
  test("a bare call keeps its arguments", () => {
    expect(compile('greet("Ayush")')).toBe('greet("Ayush");');
  });

  test("comma-separated arguments", () => {
    expect(compile("add(1, x, 3)")).toBe("add(1, x, 3);");
  });

  test("a no-argument call", () => {
    expect(compile("go()")).toBe("go();");
  });
});

// ---------------------------------------------------------------------------
// Blocks and indentation
// ---------------------------------------------------------------------------

describe("if / else", () => {
  test("if without else", () => {
    expect(compile(src("if x", "    print 1", "end"))).toBe(
      src("if (x) {", "  console.log(1);", "}"),
    );
  });

  test("if with else", () => {
    expect(compile(src("if x", "    print 1", "else", "    print 2", "end"))).toBe(
      src("if (x) {", "  console.log(1);", "} else {", "  console.log(2);", "}"),
    );
  });

  test("nested ifs increase indentation", () => {
    expect(compile(src("if a", "    if b", "        print 1", "    end", "end"))).toBe(
      src(
        "if (a) {",
        "  if (b) {",
        "    console.log(1);",
        "  }",
        "}",
      ),
    );
  });

  test("an empty branch emits an empty block", () => {
    expect(compile(src("if x", "end"))).toBe("if (x) {}");
  });
});

describe("fn", () => {
  test("becomes a function declaration", () => {
    expect(
      compile(src("fn greet(name)", '    print "Hello, " + name', "end")),
    ).toBe(
      src("function greet(name) {", '  console.log("Hello, " + name);', "}"),
    );
  });

  test("no parameters", () => {
    expect(compile(src("fn ping()", "    print 1", "end"))).toBe(
      src("function ping() {", "  console.log(1);", "}"),
    );
  });

  test("multiple parameters stay in order", () => {
    expect(compile(src("fn add(a, b)", "    print a + b", "end"))).toBe(
      src("function add(a, b) {", "  console.log(a + b);", "}"),
    );
  });

  test("parameters count as declared, so `set` on one assigns", () => {
    expect(compile(src("fn f(n)", "    set n = 2", "    print n", "end"))).toBe(
      src("function f(n) {", "  n = 2;", "  console.log(n);", "}"),
    );
  });

  test("a name declared inside a function does not leak out", () => {
    expect(compile(src("fn f()", "    set y = 1", "end", "set y = 2"))).toBe(
      src("function f() {", "  let y = 1;", "}", "let y = 2;"),
    );
  });
});

describe("for", () => {
  test("is INCLUSIVE, so the test is `i <= end`", () => {
    expect(compile(src("for i in 1..5", "    print i", "end"))).toBe(
      src("for (let i = 1; i <= 5; i++) {", "  console.log(i);", "}"),
    );
  });

  test("range bounds may be expressions", () => {
    expect(compile(src("for i in a + 1..n * 2", "    print i", "end"))).toBe(
      src(
        "for (let i = a + 1; i <= n * 2; i++) {",
        "  console.log(i);",
        "}",
      ),
    );
  });
});

// ---------------------------------------------------------------------------
// Expressions: numbers, calls, and parenthesization
// ---------------------------------------------------------------------------

describe("operator precedence in the output", () => {
  test("`1 + 2 * 3` needs no parentheses", () => {
    expect(compile("print 1 + 2 * 3")).toBe("console.log(1 + 2 * 3);");
  });

  test("`(1 + 2) * 3` keeps the parentheses that change the meaning", () => {
    expect(compile("print (1 + 2) * 3")).toBe("console.log((1 + 2) * 3);");
  });

  test("left-associative `1 - 2 - 3` needs none", () => {
    expect(compile("print 1 - 2 - 3")).toBe("console.log(1 - 2 - 3);");
  });

  test("a right-nested `1 - (2 - 3)` keeps its parentheses", () => {
    expect(compile("print 1 - (2 - 3)")).toBe("console.log(1 - (2 - 3));");
  });

  test("comparison binds loosest, so no parens around `1 + 2`", () => {
    expect(compile("print 1 + 2 == 3")).toBe("console.log(1 + 2 == 3);");
  });

  test("every comparison operator passes through unchanged", () => {
    for (const operator of ["==", "!=", ">", "<", ">=", "<="]) {
      expect(compile(`print a ${operator} b`)).toBe(`console.log(a ${operator} b);`);
    }
  });

  test("all four arithmetic operators pass through", () => {
    expect(compile("print a + b - c * d / e")).toBe(
      "console.log(a + b - c * d / e);",
    );
  });
});

describe("empty program", () => {
  test("emits nothing", () => {
    expect(compile("")).toBe("");
  });

  test("only blank lines emits nothing", () => {
    expect(compile("\n\n")).toBe("");
  });
});

// ---------------------------------------------------------------------------
// The five example programs from SPEC.md section 8, to exact JS
// ---------------------------------------------------------------------------

describe("SPEC.md section 8 programs", () => {
  test("Hello World", () => {
    expect(compile('print "Hello, World!"')).toBe('console.log("Hello, World!");');
  });

  test("Variable + print", () => {
    expect(compile(src("set x = 5", "print x"))).toBe(
      src("let x = 5;", "console.log(x);"),
    );
  });

  test("If / else", () => {
    const source = src(
      "set age = 19",
      "",
      "if age >= 18",
      '    print "adult"',
      "else",
      '    print "minor"',
      "end",
    );

    expect(compile(source)).toBe(
      src(
        "let age = 19;",
        "if (age >= 18) {",
        '  console.log("adult");',
        "} else {",
        '  console.log("minor");',
        "}",
      ),
    );
  });

  test("Function", () => {
    const source = src(
      "fn greet(name)",
      '    print "Hello, " + name',
      "end",
      "",
      'greet("Ayush")',
    );

    expect(compile(source)).toBe(
      src(
        "function greet(name) {",
        '  console.log("Hello, " + name);',
        "}",
        'greet("Ayush");',
      ),
    );
  });

  test("Loop", () => {
    expect(compile(src("for i in 1..5", "    print i", "end"))).toBe(
      src("for (let i = 1; i <= 5; i++) {", "  console.log(i);", "}"),
    );
  });
});

// ---------------------------------------------------------------------------
// Runtime: actually execute the generated JS
// ---------------------------------------------------------------------------

describe("generated code runs", () => {
  test("the Loop program prints 1 through 5 — 5 included", () => {
    expect(run(src("for i in 1..5", "    print i", "end"))).toEqual([
      1, 2, 3, 4, 5,
    ]);
  });

  test("the If / else program takes the then-branch at 19", () => {
    const source = src(
      "set age = 19",
      "if age >= 18",
      '    print "adult"',
      "else",
      '    print "minor"',
      "end",
    );

    expect(run(source)).toEqual(["adult"]);
  });

  test("the If / else program takes the else-branch at 15", () => {
    const source = src(
      "set age = 15",
      "if age >= 18",
      '    print "adult"',
      "else",
      '    print "minor"',
      "end",
    );

    expect(run(source)).toEqual(["minor"]);
  });

  test("the Function program calls greet", () => {
    const source = src(
      "fn greet(name)",
      '    print "Hello, " + name',
      "end",
      "",
      'greet("Ayush")',
    );

    expect(run(source)).toEqual(["Hello, Ayush"]);
  });

  test("`+` coerces a number to a string, as decided", () => {
    expect(run(src("set n = 5", 'print "n=" + n'))).toEqual(["n=5"]);
  });

  test("reassignment at runtime mutates the original binding", () => {
    expect(run(src("set x = 1", "set x = 2", "print x"))).toEqual([2]);
  });
});
