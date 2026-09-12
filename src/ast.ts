/**
 * Synax abstract syntax tree.
 *
 * The parser (`src/parser.ts`) turns a flat token stream into these nodes; the
 * code generator (`src/codegen.ts`) walks them. Every node carries a 1-based
 * `line` — the line of the node's first token — so later stages can report
 * positioned errors without re-deriving them from the source.
 *
 * Note: `Token` / `TokenType` deliberately still live in `src/lexer.ts` (see the
 * NOTE at the top of that file). This module defines only the tree itself, so it
 * has no imports.
 */

// ---------------------------------------------------------------------------
// Expressions
// ---------------------------------------------------------------------------

/** The operator spellings shared by every binary expression. */
export type BinaryOperator =
  | "=="
  | "!="
  | ">"
  | "<"
  | ">="
  | "<="
  | "+"
  | "-"
  | "*"
  | "/";

export interface NumberLiteral {
  readonly kind: "NumberLiteral";
  readonly value: number;
  readonly line: number;
}

export interface StringLiteral {
  readonly kind: "StringLiteral";
  /** The decoded value (escapes already applied), without the quotes. */
  readonly value: string;
  readonly line: number;
}

export interface Identifier {
  readonly kind: "Identifier";
  readonly name: string;
  readonly line: number;
}

/**
 * `left <operator> right`. `line` is the line of the left-most operand, i.e. the
 * first token of the whole expression.
 */
export interface BinaryExpr {
  readonly kind: "BinaryExpr";
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
  readonly line: number;
}

/** `callee(arg, ...)`. Per the grammar the callee is always a bare identifier. */
export interface FunctionCall {
  readonly kind: "FunctionCall";
  readonly callee: string;
  readonly args: Expression[];
  readonly line: number;
}

export type Expression =
  | NumberLiteral
  | StringLiteral
  | Identifier
  | BinaryExpr
  | FunctionCall;

// ---------------------------------------------------------------------------
// Statements
// ---------------------------------------------------------------------------

/** `set name = expression` — also used for reassignment (see SPEC.md §6). */
export interface VarDecl {
  readonly kind: "VarDecl";
  readonly name: string;
  readonly value: Expression;
  readonly line: number;
}

/** `print expression`. */
export interface PrintStmt {
  readonly kind: "PrintStmt";
  readonly argument: Expression;
  readonly line: number;
}

/** `if condition <thenBranch> (else <elseBranch>)? end`. */
export interface IfStmt {
  readonly kind: "IfStmt";
  readonly condition: Expression;
  readonly thenBranch: Statement[];
  /** `null` when the `if` has no `else` — distinct from an empty else block. */
  readonly elseBranch: Statement[] | null;
  readonly line: number;
}

/** `fn name(params) <body> end`. */
export interface FnDecl {
  readonly kind: "FnDecl";
  readonly name: string;
  readonly params: string[];
  readonly body: Statement[];
  readonly line: number;
}

/** `for variable in start..end <body> end`. */
export interface ForStmt {
  readonly kind: "ForStmt";
  readonly variable: string;
  readonly start: Expression;
  readonly end: Expression;
  readonly body: Statement[];
  readonly line: number;
}

/** A bare expression used as a statement, e.g. a function call. */
export interface ExprStmt {
  readonly kind: "ExprStmt";
  readonly expression: Expression;
  readonly line: number;
}

export type Statement =
  | VarDecl
  | PrintStmt
  | IfStmt
  | FnDecl
  | ForStmt
  | ExprStmt;

// ---------------------------------------------------------------------------
// Root
// ---------------------------------------------------------------------------

export interface Program {
  readonly kind: "Program";
  readonly body: Statement[];
  readonly line: number;
}

/** Any node in the tree. */
export type Node = Program | Statement | Expression;
