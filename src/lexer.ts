/**
 * Synax lexer — turns raw source text into a flat stream of tokens.
 *
 * TODO: implement tokenization.
 *   1. Define the token representation (kind, lexeme, line/column) — share it
 *      with the parser via `src/ast.ts`.
 *   2. Walk `this.source` character by character, skipping whitespace and
 *      comments.
 *   3. Recognize literals (numbers, strings, booleans, null), identifiers,
 *      keywords, and punctuation/operators.
 *   4. Report errors with accurate source positions (unterminated strings,
 *      illegal characters, ...).
 */

export class Lexer {
  /** The Synax source text being scanned. */
  readonly source: string;

  constructor(source: string) {
    this.source = source;
  }

  /**
   * TODO: scan `this.source` and return every token, ending with an EOF token.
   *
   * Return type is `never` until the token type exists in `src/ast.ts`.
   */
  tokenize(): never {
    throw new Error("Lexer.tokenize() is not implemented yet");
  }
}
