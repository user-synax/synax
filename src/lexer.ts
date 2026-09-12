/**
 * Synax lexer — turns raw source text into a flat stream of tokens.
 *
 * Synax has no semicolons, so a NEWLINE token marks the end of a statement.
 * The lexer therefore emits one NEWLINE per line break instead of collapsing
 * runs of them; blank lines produce extra NEWLINE tokens and it is up to the
 * parser to skip them.
 *
 * Line breaks that do NOT produce a NEWLINE token:
 *   - line breaks inside a `/# ... #/` multi-line comment
 *   - (a `#` single-line comment stops *before* its line break, so that break
 *     still yields a NEWLINE — which is what we want for statement separators)
 *
 * NOTE: `Token` / `TokenType` / `LexerError` live here for now. They can move to
 * `src/ast.ts` once the AST node types are defined (see the TODO there).
 */

/** Every distinct kind of token Synax can produce. */
export const TokenType = {
  // Keywords — each is its own token type.
  SET: "SET",
  PRINT: "PRINT",
  IF: "IF",
  ELSE: "ELSE",
  END: "END",
  FN: "FN",
  FOR: "FOR",
  IN: "IN",

  // Literals.
  NUMBER: "NUMBER",
  STRING: "STRING",

  // Identifier.
  IDENT: "IDENT",

  // Operators.
  EQUALS: "EQUALS",
  PLUS: "PLUS",
  MINUS: "MINUS",
  STAR: "STAR",
  SLASH: "SLASH",
  EQEQ: "EQEQ",
  BANGEQ: "BANGEQ",
  GT: "GT",
  LT: "LT",
  GTEQ: "GTEQ",
  LTEQ: "LTEQ",
  DOTDOT: "DOTDOT",

  // Punctuation.
  LPAREN: "LPAREN",
  RPAREN: "RPAREN",
  COMMA: "COMMA",

  // Structural.
  NEWLINE: "NEWLINE",
  EOF: "EOF",
} as const;

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export interface Token {
  readonly type: TokenType;
  /**
   * The raw source text this token was scanned from. The only exception is the
   * EOF sentinel, whose lexeme is `""`.
   */
  readonly lexeme: string;
  /**
   * Decoded literal value, present only on NUMBER and STRING tokens: the
   * numeric value, and the string's contents with escapes already applied.
   */
  readonly value?: string | number;
  /** 1-based line the token starts on. */
  readonly line: number;
  /** 1-based column of the token's first character. */
  readonly column: number;
}

/** Raised for malformed input. `line` and `column` are 1-based. */
export class LexerError extends Error {
  readonly line: number;
  readonly column: number;
  /** How many characters the error spans; used to underline the source. */
  readonly length: number;
  /** The message on its own, without the appended `(line N)` context. */
  readonly reason: string;

  constructor(reason: string, line: number, column: number, length = 1) {
    super(`${reason} (line ${line})`);
    this.name = "LexerError";
    this.reason = reason;
    this.line = line;
    this.column = column;
    this.length = length;
  }
}

const KEYWORDS: ReadonlyMap<string, TokenType> = new Map([
  ["set", TokenType.SET],
  ["print", TokenType.PRINT],
  ["if", TokenType.IF],
  ["else", TokenType.ELSE],
  ["end", TokenType.END],
  ["fn", TokenType.FN],
  ["for", TokenType.FOR],
  ["in", TokenType.IN],
]);

/**
 * Two-character operators. These are matched BEFORE the single-character table
 * (maximal munch), so `>=` cannot degrade into `>` followed by `=`.
 */
const TWO_CHAR_OPERATORS: ReadonlyMap<string, TokenType> = new Map([
  ["==", TokenType.EQEQ],
  ["!=", TokenType.BANGEQ],
  [">=", TokenType.GTEQ],
  ["<=", TokenType.LTEQ],
  ["..", TokenType.DOTDOT],
]);

/**
 * Single-character tokens. Note the deliberate omissions: there is no `.`
 * (only `..` exists), no `!` (only `!=`), and `#` / `/#` never reach here
 * because comments are handled first.
 */
const ONE_CHAR_TOKENS: ReadonlyMap<string, TokenType> = new Map([
  ["=", TokenType.EQUALS],
  ["+", TokenType.PLUS],
  ["-", TokenType.MINUS],
  ["*", TokenType.STAR],
  ["/", TokenType.SLASH],
  [">", TokenType.GT],
  ["<", TokenType.LT],
  ["(", TokenType.LPAREN],
  [")", TokenType.RPAREN],
  [",", TokenType.COMMA],
]);

/** Escape sequences understood inside a double-quoted string. */
const ESCAPES: ReadonlyMap<string, string> = new Map([
  ["n", "\n"],
  ["t", "\t"],
  ['"', '"'],
  ["\\", "\\"],
]);

function isDigit(char: string | undefined): boolean {
  return char !== undefined && char >= "0" && char <= "9";
}

function isLetter(char: string | undefined): boolean {
  return (
    char !== undefined &&
    ((char >= "a" && char <= "z") || (char >= "A" && char <= "Z"))
  );
}

function isIdentifierStart(char: string | undefined): boolean {
  return isLetter(char) || char === "_";
}

function isIdentifierPart(char: string | undefined): boolean {
  return isIdentifierStart(char) || isDigit(char);
}

export class Lexer {
  /** The Synax source text being scanned. */
  readonly source: string;

  private index = 0;
  private line = 1;
  /** Index of the first character on the current line, for column math. */
  private lineStart = 0;

  constructor(source: string) {
    this.source = source;
  }

  /** 1-based column of the cursor. */
  private get column(): number {
    return this.index - this.lineStart + 1;
  }

  /**
   * Scan the whole source and return its tokens, always ending with exactly one
   * EOF token.
   *
   * @throws {LexerError} on an unexpected character, an unterminated string, an
   * unrecognised escape sequence, or an unterminated multi-line comment.
   */
  tokenize(): Token[] {
    // Reset so a single Lexer instance can be tokenized more than once.
    this.index = 0;
    this.line = 1;
    this.lineStart = 0;

    const tokens: Token[] = [];

    while (true) {
      const char = this.source[this.index];
      if (char === undefined) break;

      // Horizontal whitespace. `\r` is dropped so CRLF files behave exactly
      // like LF ones: one NEWLINE per line break.
      if (char === " " || char === "\t" || char === "\r") {
        this.index++;
        continue;
      }

      if (char === "\n") {
        tokens.push({
          type: TokenType.NEWLINE,
          lexeme: "\n",
          line: this.line,
          column: this.column,
        });
        this.index++;
        this.line++;
        this.lineStart = this.index;
        continue;
      }

      if (char === "#") {
        this.skipLineComment();
        continue;
      }

      if (char === "/" && this.source[this.index + 1] === "#") {
        this.skipBlockComment();
        continue;
      }

      if (char === '"') {
        tokens.push(this.readString());
        continue;
      }

      if (isDigit(char)) {
        tokens.push(this.readNumber());
        continue;
      }

      if (isIdentifierStart(char)) {
        tokens.push(this.readIdentifier());
        continue;
      }

      const operator = this.readOperator();
      if (operator !== undefined) {
        tokens.push(operator);
        continue;
      }

      throw new LexerError(
        `Unexpected character ${JSON.stringify(char)}`,
        this.line,
        this.column,
      );
    }

    tokens.push({
      type: TokenType.EOF,
      lexeme: "",
      line: this.line,
      column: this.column,
    });
    return tokens;
  }

  /** Consume `#` and everything up to — but not including — the line break. */
  private skipLineComment(): void {
    this.index++; // the `#`

    while (true) {
      const char = this.source[this.index];
      if (char === undefined || char === "\n") return;
      this.index++;
    }
  }

  /**
   * Consume `/#` through the matching `#/`. Line breaks inside are counted but
   * never emitted as NEWLINE tokens. Nesting is not supported.
   */
  private skipBlockComment(): void {
    const startLine = this.line;
    const startColumn = this.column;
    this.index += 2; // the `/#`

    while (true) {
      const char = this.source[this.index];

      if (char === undefined) {
        throw new LexerError(
          "Unterminated multi-line comment",
          startLine,
          startColumn,
          2,
        );
      }

      if (char === "#" && this.source[this.index + 1] === "/") {
        this.index += 2;
        return;
      }

      if (char === "\n") {
        this.line++;
        this.index++;
        this.lineStart = this.index;
        continue;
      }

      this.index++;
    }
  }

  /** Scan a double-quoted string, decoding escapes. */
  private readString(): Token {
    const line = this.line;
    const column = this.column;
    const start = this.index;
    this.index++; // the opening quote

    let value = "";

    while (true) {
      const char = this.source[this.index];

      // A string may not span lines, so a line break here means the closing
      // quote is missing.
      if (char === undefined || char === "\n") {
        throw new LexerError("Unterminated string", line, column);
      }

      if (char === '"') {
        this.index++; // the closing quote
        const lexeme = this.source.slice(start, this.index);
        return { type: TokenType.STRING, lexeme, value, line, column };
      }

      if (char === "\\") {
        const escaped = this.source[this.index + 1];
        const decoded = escaped === undefined ? undefined : ESCAPES.get(escaped);

        if (decoded === undefined) {
          throw new LexerError(
            `Invalid escape sequence \\${escaped ?? ""}`,
            this.line,
            this.column,
            2,
          );
        }

        value += decoded;
        this.index += 2;
        continue;
      }

      value += char;
      this.index++;
    }
  }

  /** Scan an integer or float literal. No leading dots, no exponents. */
  private readNumber(): Token {
    const line = this.line;
    const column = this.column;
    const start = this.index;

    while (isDigit(this.source[this.index])) this.index++;

    // Only treat the `.` as a decimal point when a digit follows it, so `1..5`
    // lexes as NUMBER(1) DOTDOT NUMBER(5) rather than NUMBER(1.) + junk.
    if (
      this.source[this.index] === "." &&
      isDigit(this.source[this.index + 1])
    ) {
      this.index++;
      while (isDigit(this.source[this.index])) this.index++;
    }

    const lexeme = this.source.slice(start, this.index);
    return {
      type: TokenType.NUMBER,
      lexeme,
      value: Number(lexeme),
      line,
      column,
    };
  }

  /** Scan an identifier, then reclassify it if it is a keyword. */
  private readIdentifier(): Token {
    const line = this.line;
    const column = this.column;
    const start = this.index;

    while (isIdentifierPart(this.source[this.index])) this.index++;

    const lexeme = this.source.slice(start, this.index);
    return {
      type: KEYWORDS.get(lexeme) ?? TokenType.IDENT,
      lexeme,
      line,
      column,
    };
  }

  /**
   * Match the longest operator at the cursor, or `undefined` if the character
   * starts no known operator.
   */
  private readOperator(): Token | undefined {
    const line = this.line;
    const column = this.column;

    // Maximal munch: try two characters before one, so `>=`, `==`, `!=`, `<=`
    // and `..` win over their one-character prefixes.
    const two = this.source.slice(this.index, this.index + 2);
    const twoType = TWO_CHAR_OPERATORS.get(two);
    if (twoType !== undefined) {
      this.index += 2;
      return { type: twoType, lexeme: two, line, column };
    }

    const one = this.source[this.index];
    if (one === undefined) return undefined;

    const oneType = ONE_CHAR_TOKENS.get(one);
    if (oneType === undefined) return undefined;

    this.index += 1;
    return { type: oneType, lexeme: one, line, column };
  }
}
