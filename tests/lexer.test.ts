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

/**
 * The exact expected shape of a token, including position. Keeps the full-token
 * assertions below readable now that tokens carry a column.
 */
function tok(
  type: TokenType,
  lexeme: string,
  line: number,
  column: number,
  value?: string | number,
): Token {
  return value === undefined
    ? { type, lexeme, line, column }
    : { type, lexeme, value, line, column };
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
      expect(tokenize(text)).toEqual([tok(type, text, 1, 1)]);
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
    expect(tokenize("name")).toEqual([tok(TokenType.IDENT, "name", 1, 1)]);
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
    expect(tokenize("42")).toEqual([tok(TokenType.NUMBER, "42", 1, 1, 42)]);
  });

  test("lexes a float", () => {
    expect(tokenize("3.14")).toEqual([
      tok(TokenType.NUMBER, "3.14", 1, 1, 3.14),
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
      tok(TokenType.STRING, '"Hello, World!"', 1, 1, "Hello, World!"),
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
      tok(TokenType.STRING, '"a = b, c .. d # e"', 1, 1, "a = b, c .. d # e"),
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

    expect(tokens).toEqual([tok(TokenType.EOF, "", 1, 1)]);
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

  test("tracks 1-based columns and resets them each line", () => {
    const tokens = tokenize("set x = 1\nprint x");

    expect(tokens.map((t) => t.column)).toEqual([1, 5, 7, 9, 10, 1, 7]);
  });

  test("a tab advances the column", () => {
    // One tab, then `print`: the token starts at column 2.
    expect(tokenize("\tprint")[0]?.column).toBe(2);
  });

  test("a two-character operator reports its own column", () => {
    const gteq = tokenize("a >= 18").find((t) => t.type === TokenType.GTEQ);

    expect(gteq?.column).toBe(3);
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
      tok(TokenType.SET, "set", 1, 1),
      tok(TokenType.IDENT, "age", 1, 5),
      tok(TokenType.EQUALS, "=", 1, 9),
      tok(TokenType.NUMBER, "19", 1, 11, 19),
      tok(TokenType.NEWLINE, "\n", 1, 13),
      tok(TokenType.NEWLINE, "\n", 2, 1),
      tok(TokenType.IF, "if", 3, 1),
      tok(TokenType.IDENT, "age", 3, 4),
      tok(TokenType.GTEQ, ">=", 3, 8),
      tok(TokenType.NUMBER, "18", 3, 11, 18),
      tok(TokenType.NEWLINE, "\n", 3, 13),
      tok(TokenType.PRINT, "print", 4, 5),
      tok(TokenType.STRING, '"adult"', 4, 11, "adult"),
      tok(TokenType.NEWLINE, "\n", 4, 18),
      tok(TokenType.ELSE, "else", 5, 1),
      tok(TokenType.NEWLINE, "\n", 5, 5),
      tok(TokenType.PRINT, "print", 6, 5),
      tok(TokenType.STRING, '"minor"', 6, 11, "minor"),
      tok(TokenType.NEWLINE, "\n", 6, 18),
      tok(TokenType.END, "end", 7, 1),
      tok(TokenType.NEWLINE, "\n", 7, 4),
    ]);

    // ...and exactly one trailing EOF, on the line after the last newline.
    expect(new Lexer(source).tokenize().at(-1)).toEqual(tok(TokenType.EOF, "", 8, 1));
  });
});
