/**
 * Synax code generator — walks an AST and prints JavaScript source.
 *
 * TODO: implement code generation.
 *   1. Accept the AST root produced by the `Parser` (see `src/parser.ts`).
 *   2. Recursively walk each node and emit the equivalent JavaScript.
 *   3. Preserve operator precedence by parenthesizing where needed, and emit
 *      source maps back to the original Synax positions.
 *
 * @param _ast The AST root to translate. Typed as `unknown` until the node
 *   types exist in `src/ast.ts`.
 * @returns JavaScript source text.
 */
export function generate(_ast: unknown): never {
  throw new Error("generate() is not implemented yet");
}
