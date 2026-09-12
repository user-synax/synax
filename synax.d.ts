/**
 * Type declarations for the `synax` package.
 *
 * Written by hand because the project has no TypeScript dependency (zero
 * runtime deps, and Bun's bundler does not emit `.d.ts`), but kept faithful to
 * `src/`. If you change the public surface in `src/`, update this file to match.
 */

// ---------------------------------------------------------------------------
// Tokens
// ---------------------------------------------------------------------------

export declare const TokenType: {
  SET: "SET";
  PRINT: "PRINT";
  IF: "IF";
  ELSE: "ELSE";
  END: "END";
  FN: "FN";
  FOR: "FOR";
  IN: "IN";
  NUMBER: "NUMBER";
  STRING: "STRING";
  IDENT: "IDENT";
  EQUALS: "EQUALS";
  PLUS: "PLUS";
  MINUS: "MINUS";
  STAR: "STAR";
  SLASH: "SLASH";
  EQEQ: "EQEQ";
  BANGEQ: "BANGEQ";
  GT: "GT";
  LT: "LT";
  GTEQ: "GTEQ";
  LTEQ: "LTEQ";
  DOTDOT: "DOTDOT";
  LPAREN: "LPAREN";
  RPAREN: "RPAREN";
  COMMA: "COMMA";
  NEWLINE: "NEWLINE";
  EOF: "EOF";
};

export type TokenType = (typeof TokenType)[keyof typeof TokenType];

export interface Token {
  readonly type: TokenType;
  /** The raw source text this token was scanned from (`""` for EOF). */
  readonly lexeme: string;
  /** Decoded value for NUMBER (number) and STRING (string) tokens. */
  readonly value?: string | number;
  /** 1-based line the token starts on. */
  readonly line: number;
  /** 1-based column of the token's first character. */
  readonly column: number;
}

/** Raised for malformed input. `line` and `column` are 1-based. */
export declare class LexerError extends Error {
  readonly line: number;
  readonly column: number;
  /** How many characters the error spans. */
  readonly length: number;
  /** The message without the appended `(line N)` context. */
  readonly reason: string;
  constructor(reason: string, line: number, column: number, length?: number);
}

export declare class ParserError extends Error {
  readonly line: number;
  readonly column: number;
  readonly length: number;
  readonly reason: string;
  constructor(reason: string, line: number, column: number, length?: number);
}

// ---------------------------------------------------------------------------
// AST
// ---------------------------------------------------------------------------

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
  readonly value: string;
  readonly line: number;
}

export interface Identifier {
  readonly kind: "Identifier";
  readonly name: string;
  readonly line: number;
}

export interface BinaryExpr {
  readonly kind: "BinaryExpr";
  readonly operator: BinaryOperator;
  readonly left: Expression;
  readonly right: Expression;
  readonly line: number;
}

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

export interface VarDecl {
  readonly kind: "VarDecl";
  readonly name: string;
  readonly value: Expression;
  readonly line: number;
}

export interface PrintStmt {
  readonly kind: "PrintStmt";
  readonly argument: Expression;
  readonly line: number;
}

export interface IfStmt {
  readonly kind: "IfStmt";
  readonly condition: Expression;
  readonly thenBranch: Statement[];
  readonly elseBranch: Statement[] | null;
  readonly line: number;
}

export interface FnDecl {
  readonly kind: "FnDecl";
  readonly name: string;
  readonly params: string[];
  readonly body: Statement[];
  readonly line: number;
}

export interface ForStmt {
  readonly kind: "ForStmt";
  readonly variable: string;
  readonly start: Expression;
  readonly end: Expression;
  readonly body: Statement[];
  readonly line: number;
}

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

export interface Program {
  readonly kind: "Program";
  readonly body: Statement[];
  readonly line: number;
}

export type Node = Program | Statement | Expression;

// ---------------------------------------------------------------------------
// API
// ---------------------------------------------------------------------------

export declare class Lexer {
  /** The Synax source text being scanned. */
  readonly source: string;
  constructor(source: string);
  /** Scan the whole source; the result ends with exactly one EOF token. */
  tokenize(): Token[];
}

export declare class Parser {
  /** The tokens being parsed; expected to end with an EOF sentinel. */
  readonly tokens: readonly Token[];
  constructor(tokens: readonly Token[]);
  /** Parse the whole token stream into a `Program`. */
  parse(): Program;
}

/**
 * Translate a parsed `Program` into JavaScript source (no trailing newline;
 * `""` for an empty program).
 */
export declare function generate(program: Program): string;

/** A positioned error, ready to render. All positions are 1-based. */
export interface Diagnostic {
  readonly file: string;
  readonly line: number;
  readonly column: number;
  /** Characters to underline; at least 1. */
  readonly length: number;
  readonly reason: string;
}

/**
 * Render `diagnostic` against `source` as a `file:line:column` header plus a
 * code frame underlining the offending characters.
 */
export declare function formatDiagnostic(
  diagnostic: Diagnostic,
  source: string,
): string;
