/**
 * Synax public API surface.
 *
 * TODO: re-export the AST node types from `./ast` once they are defined (they
 * will need `export type { ... }` under `verbatimModuleSyntax`).
 */
export { generate } from "./codegen";
export { formatDiagnostic } from "./diagnostics";
export type { Diagnostic } from "./diagnostics";
export { Lexer, LexerError } from "./lexer";
export { Parser, ParserError } from "./parser";
