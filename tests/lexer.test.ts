import { describe, expect, test } from "bun:test";

import { Lexer, LexerError, TokenType } from "../src/lexer";
import type { Token } from "../src/lexer";

/** Tokenize `source`, dropping the trailing EOF for compact assertions. */
function tokenize(source: string): Token[] {
  const tokens = new Lexer(source).tokenize();
  expect(tokens.at(-1)?.type).toBe(TokenType.EOF);
  return tokens.slice(0, -1);
}

/** `[type, lexeme]` pairs — concise but still order-sensitive. */
function pairs(source: string): Array<[TokenType, string]> {
  return tokenize(source).map((t) => [t.type, t.lexeme]);
}

/** Just the token types, for cases where the lexeme is obvious. */
function types(source: string): TokenType[] {
  return tokenize(source).map((t) => t.type);
}

// ---------------------------------------------------------------------------
// Keywords
// ---------------------------------------------------------------------------

describe("keywords", () => {
  // Each keyword is its own token type, not a shared KEYWORD type.
  const keywords: Array<[string, TokenType]> = [
    ["set", TokenType.SET],
    ["print", TokenType.PRINT],
    ["if", TokenType.IF],
    ["else", TokenType.ELSE],
    ["end", TokenType.END],
    ["fn", TokenType.FN],
    ["for", TokenType.FOR],
    ["in", TokenType.IN],
  ];

  for (const [text, type] of keywords) {
    test(`"${text}" lexes as ${type}`, () => {
      expect(tokenize(text)).toEqual([
        { type, lexeme: text, line: 1 },
      ]);
    });
  }

  test("keywords are only recognised as whole words", () => {
    // `iffy` starts with `if` but must stay an identifier.
    expect(types("iffy forter setting")).toEqual([
      TokenType.IDENT,
      TokenType.IDENT,
      TokenType.IDENT,
    ]);
  });

  test("keywords are case-sensitive", () => {
    expect(types("Set PRINT")).toEqual([TokenType.IDENT, TokenType.IDENT]);
  });
});

// ---------------------------------------------------------------------------
// Identifiers and numbers
// ---------------------------------------------------------------------------

describe("identifiers", () => {
  test("lexes a plain identifier", () => {
    expect(tokenize("name")).toEqual([
      { type: TokenType.IDENT, lexeme: "name", line: 1 },
    ]);
  });

  test("allows leading underscores and inner digits", () => {
    expect(types("_tmp value2 a_1_b")).toEqual([
      TokenType.IDENT,
      TokenType.IDENT,
      TokenType.IDENT,
    ]);
  });
});

describe("numbers", () => {
  test("lexes an integer", () => {
    expect(tokenize("42")).toEqual([
      { type: TokenType.NUMBER, lexeme: "42", value: 42, line: 1 },
    ]);
  });

  test("lexes a float", () => {
    expect(tokenize("3.14")).toEqual([
      { type: TokenType.NUMBER, lexeme: "3.14", value: 3.14, line: 1 },
    ]);
  });

  test("does not allow a leading dot", () => {
    // `.5` is invalid: the `.` is not a token on its own, so this throws.
    expect(() => tokenize(".5")).toThrow(LexerError);
  });

  test("a `..` range is not swallowed by the number scanner", () => {
    expect(pairs("1..5")).toEqual([
      [TokenType.NUMBER, "1"],
      [TokenType.DOTDOT, ".."],
      [TokenType.NUMBER, "5"],
    ]);
  });
});

// ---------------------------------------------------------------------------
// Strings
// ---------------------------------------------------------------------------

describe("strings", () => {
  test("lexes a simple string", () => {
    expect(tokenize('"Hello, World!"')).toEqual([
      {
        type: TokenType.STRING,
        lexeme: '"Hello, World!"',
        value: "Hello, World!",
        line: 1,
      },
    ]);
  });

  test("decodes escape sequences", () => {
    const [token] = tokenize('"a\\nb\\tc\\"d\\\\e"');

    expect(token?.value).toBe('a\nb\tc"d\\e');
    // The lexeme keeps the raw, undecoded source text.
    expect(token?.lexeme).toBe('"a\\nb\\tc\\"d\\\\e"');
  });

  test("does not treat `=`, `,`, `#` or `..` inside a string as tokens", () => {
    expect(tokenize('"a = b, c .. d # e"')).toEqual([
      {
        type: TokenType.STRING,
        lexeme: '"a = b, c .. d # e"',
        value: "a = b, c .. d # e",
        line: 1,
      },
    ]);
  });

  test("throws on an unterminated string", () => {
    expect(() => tokenize('print "oops')).toThrow(LexerError);
    expect(() => tokenize('print "oops')).toThrow(/Unterminated string \(line 1\)/);
  });

  test("reports the line the unterminated string started on", () => {
    expect(() => tokenize('print "ok"\nprint "oops')).toThrow(/\(line 2\)/);
  });
});

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

describe("comments", () => {
  test("a `#` comment is skipped but its newline is not", () => {
    expect(pairs("set x = 1 # trailing\nprint x")).toEqual([
      [TokenType.SET, "set"],
      [TokenType.IDENT, "x"],
      [TokenType.EQUALS, "="],
      [TokenType.NUMBER, "1"],
      [TokenType.NEWLINE, "\n"],
      [TokenType.PRINT, "print"],
      [TokenType.IDENT, "x"],
    ]);
  });

  test("a whole-line `#` comment emits only the newline", () => {
    expect(types("# just a comment\nset x = 1")).toEqual([
      TokenType.NEWLINE,
      TokenType.SET,
      TokenType.IDENT,
      TokenType.EQUALS,
      TokenType.NUMBER,
    ]);
  });

  test("a `/# #/` comment is skipped, including its newlines", () => {
    const source = 'set x = 1\n/# comment\nspanning lines\nwith = symbols #/\nprint x';

    // The comment swallows three line breaks (ends of lines 2, 3 and 4 up to
    // `#/`), so only the breaks *outside* it survive: the one ending line 1 and
    // the one ending line 4 after `#/`.
    expect(pairs(source)).toEqual([
      [TokenType.SET, "set"],
      [TokenType.IDENT, "x"],
      [TokenType.EQUALS, "="],
      [TokenType.NUMBER, "1"],
      [TokenType.NEWLINE, "\n"],
      [TokenType.NEWLINE, "\n"],
      [TokenType.PRINT, "print"],
      [TokenType.IDENT, "x"],
    ]);
  });

  test("a `/# #/` comment on its own line still leaves the surrounding breaks", () => {
    // Regression guard for the case above: the comment spans no *statements*,
    // but it does hide every newline between its markers.
    expect(types("a\n/# x\ny\nz #/\nb")).toEqual([
      TokenType.IDENT,
      TokenType.NEWLINE,
      TokenType.NEWLINE,
      TokenType.IDENT,
    ]);
  });

  test("a `/# #/` comment can sit mid-expression", () => {
    expect(pairs("1 /# inline #/ + 2")).toEqual([
      [TokenType.NUMBER, "1"],
      [TokenType.PLUS, "+"],
      [TokenType.NUMBER, "2"],
    ]);
  });

  test("throws on an unterminated `/#` comment", () => {
    expect(() => tokenize("/# never closed")).toThrow(/Unterminated multi-line comment/);
  });
});

// ---------------------------------------------------------------------------
// Operators — maximal munch
// ---------------------------------------------------------------------------

describe("operators", () => {
  const singleChar: Array<[string, TokenType]> = [
    ["+", TokenType.PLUS],
    ["-", TokenType.MINUS],
    ["*", TokenType.STAR],
    ["/", TokenType.SLASH],
    ["(", TokenType.LPAREN],
    [")", TokenType.RPAREN],
    [",", TokenType.COMMA],
  ];

  for (const [text, type] of singleChar) {
    test(`"${text}" lexes as ${type}`, () => {
      expect(pairs(text)).toEqual([[type, text]]);
    });
  }

  test("`=` lexes as EQUALS", () => {
    expect(pairs("=")).toEqual([[TokenType.EQUALS, "="]]);
  });

  // Each two-character operator next to its one-character prefix. If the lexer
  // checks the one-character table first, these all fail.
  const twoChar: Array<[string, TokenType]> = [
    ["==", TokenType.EQEQ],
    ["!=", TokenType.BANGEQ],
    [">=", TokenType.GTEQ],
    ["<=", TokenType.LTEQ],
    ["..", TokenType.DOTDOT],
  ];

  for (const [text, type] of twoChar) {
    test(`"${text}" lexes as one ${type}, not two tokens`, () => {
      expect(pairs(text)).toEqual([[type, text]]);
    });
  }

  test("`>` and `<` still lex when not followed by `=`", () => {
    expect(pairs("> <")).toEqual([
      [TokenType.GT, ">"],
      [TokenType.LT, "<"],
    ]);
  });

  test("`a > b` and `a >= b` differ by exactly one token", () => {
    expect(types("a > b")).toEqual([TokenType.IDENT, TokenType.GT, TokenType.IDENT]);
    expect(types("a >= b")).toEqual([TokenType.IDENT, TokenType.GTEQ, TokenType.IDENT]);
  });

  test("`x == 5`", () => {
    expect(pairs("x == 5")).toEqual([
      [TokenType.IDENT, "x"],
      [TokenType.EQEQ, "=="],
      [TokenType.NUMBER, "5"],
    ]);
  });

  test("`x != 5`", () => {
    expect(pairs("x != 5")).toEqual([
      [TokenType.IDENT, "x"],
      [TokenType.BANGEQ, "!="],
      [TokenType.NUMBER, "5"],
    ]);
  });

  test("`a >= 18` never degrades into `>` followed by `=`", () => {
    expect(pairs("a >= 18")).toEqual([
      [TokenType.IDENT, "a"],
      [TokenType.GTEQ, ">="],
      [TokenType.NUMBER, "18"],
    ]);
  });

  test("`<=` does not become `<` plus `=`", () => {
    expect(pairs("a <= 18")).toEqual([
      [TokenType.IDENT, "a"],
      [TokenType.LTEQ, "<="],
      [TokenType.NUMBER, "18"],
    ]);
  });

  test("a lone `.` is rejected", () => {
    expect(() => tokenize("1. 2")).toThrow(LexerError);
  });
});

// ---------------------------------------------------------------------------
// Structural tokens and line numbers
// ---------------------------------------------------------------------------

describe("structure", () => {
  test("emits one NEWLINE per line break, including blank lines", () => {
    expect(types("a\n\nb\n")).toEqual([
      TokenType.IDENT,
      TokenType.NEWLINE,
      TokenType.NEWLINE,
      TokenType.IDENT,
      TokenType.NEWLINE,
    ]);
  });

  test("always ends with exactly one EOF token", () => {
    const tokens = new Lexer("").tokenize();

    expect(tokens).toEqual([{ type: TokenType.EOF, lexeme: "", line: 1 }]);
  });

  test("EOF carries an empty lexeme", () => {
    const tokens = new Lexer("set x = 1").tokenize();
    const eof = tokens.at(-1);

    expect(eof?.type).toBe(TokenType.EOF);
    expect(eof?.lexeme).toBe("");
  });

  test("tracks line numbers across statements", () => {
    const tokens = tokenize("set x = 1\nprint x\n\nif x >= 1\nend");

    expect(tokens.map((t) => t.line)).toEqual([
      1, 1, 1, 1, // set x = 1
      1, // NEWLINE
      2, 2, // print x
      2, // NEWLINE
      3, // NEWLINE (blank line)
      4, 4, 4, 4, // if x >= 1
      4, // NEWLINE
      5, // end
    ]);
  });

  test("a `\\r\\n` line break is a single NEWLINE, not two", () => {
    expect(types("set x = 1\r\nprint x")).toEqual([
      TokenType.SET,
      TokenType.IDENT,
      TokenType.EQUALS,
      TokenType.NUMBER,
      TokenType.NEWLINE,
      TokenType.PRINT,
      TokenType.IDENT,
    ]);
  });
});

// ---------------------------------------------------------------------------
// Errors
// ---------------------------------------------------------------------------

describe("errors", () => {
  test("throws on an unexpected character, naming it and the line", () => {
    expect(() => tokenize("set x = 1\n@ invalid")).toThrow(
      /Unexpected character "@" \(line 2\)/,
    );
  });

  test("throws on an invalid escape sequence", () => {
    expect(() => tokenize('"a\\qb"')).toThrow(/Invalid escape sequence/);
  });

  test("LexerError exposes the failing line", () => {
    try {
      tokenize("@");
      throw new Error("expected tokenize to throw");
    } catch (error) {
      expect(error).toBeInstanceOf(LexerError);
      expect((error as LexerError).line).toBe(1);
    }
  });
});

// ---------------------------------------------------------------------------
// End-to-end: the "If / else" program from SPEC.md section 8
// ---------------------------------------------------------------------------

describe("SPEC.md section 8 — If / else example", () => {
  const source = [
    "set age = 19",
    "",
    "if age >= 18",
    '    print "adult"',
    "else",
    '    print "minor"',
    "end",
    "",
  ].join("\n");

  test("produces the exact token sequence", () => {
    const tokens = tokenize(source);

    expect(tokens).toEqual([
      { type: TokenType.SET, lexeme: "set", line: 1 },
      { type: TokenType.IDENT, lexeme: "age", line: 1 },
      { type: TokenType.EQUALS, lexeme: "=", line: 1 },
      { type: TokenType.NUMBER, lexeme: "19", value: 19, line: 1 },
      { type: TokenType.NEWLINE, lexeme: "\n", line: 1 },
      { type: TokenType.NEWLINE, lexeme: "\n", line: 2 },
      { type: TokenType.IF, lexeme: "if", line: 3 },
      { type: TokenType.IDENT, lexeme: "age", line: 3 },
      { type: TokenType.GTEQ, lexeme: ">=", line: 3 },
      { type: TokenType.NUMBER, lexeme: "18", value: 18, line: 3 },
      { type: TokenType.NEWLINE, lexeme: "\n", line: 3 },
      { type: TokenType.PRINT, lexeme: "print", line: 4 },
      { type: TokenType.STRING, lexeme: '"adult"', value: "adult", line: 4 },
      { type: TokenType.NEWLINE, lexeme: "\n", line: 4 },
      { type: TokenType.ELSE, lexeme: "else", line: 5 },
      { type: TokenType.NEWLINE, lexeme: "\n", line: 5 },
      { type: TokenType.PRINT, lexeme: "print", line: 6 },
      { type: TokenType.STRING, lexeme: '"minor"', value: "minor", line: 6 },
      { type: TokenType.NEWLINE, lexeme: "\n", line: 6 },
      { type: TokenType.END, lexeme: "end", line: 7 },
      { type: TokenType.NEWLINE, lexeme: "\n", line: 7 },
    ]);

    // ...and exactly one trailing EOF, on the line after the last newline.
    expect(new Lexer(source).tokenize().at(-1)).toEqual({
      type: TokenType.EOF,
      lexeme: "",
      line: 8,
    });
  });
});
