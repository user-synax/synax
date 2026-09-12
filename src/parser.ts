/**
 * Synax parser — turns a token stream into an abstract syntax tree.
 *
 * TODO: implement parsing.
 *   1. Take the token list produced by the `Lexer` (see `src/lexer.ts`).
 *   2. Write one recursive-descent method per grammar production, or use
 *      Pratt/precedence-climbing for expressions.
 *   3. Build and return nodes defined in `src/ast.ts`.
 *   4. Throw positioned errors and (optionally) synchronize so a single bad
 *      statement does not abort the whole file.
 */

export class Parser {
  /** The tokens being parsed; typed as `unknown` until `src/ast.ts` exists. */
  readonly tokens: readonly unknown[];

  constructor(tokens: readonly unknown[] = []) {
    this.tokens = tokens;
  }

  /**
   * TODO: consume `this.tokens` and return the program's AST root.
   *
   * Return type is `never` until the AST node types exist in `src/ast.ts`.
   */
  parse(): never {
    throw new Error("Parser.parse() is not implemented yet");
  }
}
