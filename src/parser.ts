/**
 * Synax parser — turns the token stream from `src/lexer.ts` into an AST
 * (`src/ast.ts`) via straightforward recursive descent.
 *
 * Grammar (SPEC.md §4), one method per rule:
 *
 *   statement   := varDecl | printStmt | ifStmt | fnDecl | forStmt | exprStmt
 *   varDecl     := "set" IDENT "=" expression
 *   printStmt   := "print" expression
 *   ifStmt      := "if" expression statement* ("else" statement*)? "end"
 *   fnDecl      := "fn" IDENT "(" paramList? ")" statement* "end"
 *   forStmt     := "for" IDENT "in" expression ".." expression statement* "end"
 *   exprStmt    := expression
 *   expression  := comparison
 *   comparison  := term ((">=" | "<=" | ">" | "<" | "==" | "!=") term)*
 *   term        := factor (("+" | "-") factor)*
 *   factor      := primary (("*" | "/") primary)*
 *   primary     := NUMBER | STRING | IDENT | "(" expression ")" | functionCall
 *
 * Precedence is lowest-to-highest as written, all left-associative (SPEC.md §5).
 *
 * Since Synax has no semicolons, NEWLINE is the statement separator. Blank lines
 * produce runs of NEWLINE tokens; those are skipped rather than becoming empty
 * statements.
 */
import type { Token } from "./lexer";
import { TokenType } from "./lexer";
import type {
  BinaryOperator,
  Expression,
  FnDecl,
  ForStmt,
  IfStmt,
  PrintStmt,
  Program,
  Statement,
  VarDecl,
} from "./ast";

/**
 * Raised for malformed token streams. `line` and `column` are 1-based.
 * Mirrors `LexerError` so diagnostics can be rendered the same way.
 */
export class ParserError extends Error {
  readonly line: number;
  readonly column: number;
  /** How many characters the error spans; used to underline the source. */
  readonly length: number;
  /** The message on its own, without the appended `(line N)` context. */
  readonly reason: string;

  constructor(reason: string, line: number, column: number, length = 1) {
    super(`${reason} (line ${line})`);
    this.name = "ParserError";
    this.reason = reason;
    this.line = line;
    this.column = column;
    this.length = length;
  }
}

/** Operator token types, grouped by precedence level (loosest first). */
const COMPARISON_OPERATORS: ReadonlyMap<TokenType, BinaryOperator> = new Map([
  [TokenType.GTEQ, ">="],
  [TokenType.LTEQ, "<="],
  [TokenType.GT, ">"],
  [TokenType.LT, "<"],
  [TokenType.EQEQ, "=="],
  [TokenType.BANGEQ, "!="],
]);

const ADDITIVE_OPERATORS: ReadonlyMap<TokenType, BinaryOperator> = new Map([
  [TokenType.PLUS, "+"],
  [TokenType.MINUS, "-"],
]);

const MULTIPLICATIVE_OPERATORS: ReadonlyMap<TokenType, BinaryOperator> = new Map([
  [TokenType.STAR, "*"],
  [TokenType.SLASH, "/"],
]);

/**
 * Token types that end a statement block. `if` and `for`/`fn` bodies stop at
 * `end`; `if` then-bodies also stop at `else`.
 */
const END: readonly TokenType[] = [TokenType.END];
const ELSE_OR_END: readonly TokenType[] = [TokenType.ELSE, TokenType.END];

/** Human-readable token name for error messages. */
function describe(token: Token): string {
  switch (token.type) {
    case TokenType.EOF:
      return "end of input";
    case TokenType.NEWLINE:
      return "end of line";
    default:
      return `'${token.lexeme}'`;
  }
}

export class Parser {
  /** The tokens being parsed; expected to end with an EOF sentinel. */
  readonly tokens: readonly Token[];

  private index = 0;

  constructor(tokens: readonly Token[] = []) {
    this.tokens = tokens;
  }

  /**
   * Parse the whole token stream into a `Program`.
   *
   * Consumes every token up to and including EOF; if any token is left over the
   * parser has a bug and throws rather than silently stopping.
   *
   * @throws {ParserError} on an unexpected or malformed token sequence.
   */
  parse(): Program {
    this.index = 0;

    const first = this.peek();
    const body = this.parseStatements([]);

    const token = this.peek();
    if (token.type !== TokenType.EOF) {
      throw this.error(token, `Unexpected ${describe(token)} after program`);
    }

    return { kind: "Program", body, line: first.line };
  }

  // -------------------------------------------------------------------------
  // Statements
  // -------------------------------------------------------------------------

  /**
   * Parse statements until EOF or one of `terminators`, skipping blank lines.
   * The terminator itself is left unconsumed for the caller to handle.
   */
  private parseStatements(terminators: readonly TokenType[]): Statement[] {
    const statements: Statement[] = [];

    while (true) {
      this.skipNewlines();

      const token = this.peek();
      if (token.type === TokenType.EOF || terminators.includes(token.type)) {
        return statements;
      }

      statements.push(this.parseStatement());

      // A statement must be followed by a line break, EOF, or the end of the
      // block. Otherwise two statements have been squashed onto one line, which
      // Synax has no way to express without semicolons.
      const next = this.peek();
      if (
        next.type !== TokenType.NEWLINE &&
        next.type !== TokenType.EOF &&
        !terminators.includes(next.type)
      ) {
        throw this.error(
          next,
          `Expected end of statement but found ${describe(next)}`,
        );
      }
    }
  }

  private parseStatement(): Statement {
    switch (this.peek().type) {
      case TokenType.SET:
        return this.parseVarDecl();
      case TokenType.PRINT:
        return this.parsePrintStmt();
      case TokenType.IF:
        return this.parseIfStmt();
      case TokenType.FN:
        return this.parseFnDecl();
      case TokenType.FOR:
        return this.parseForStmt();
      default:
        return this.parseExprStmt();
    }
  }

  /** varDecl := "set" IDENT "=" expression */
  private parseVarDecl(): VarDecl {
    const keyword = this.expect(TokenType.SET, "'set'");
    const name = this.expect(TokenType.IDENT, "a variable name after 'set'");
    this.expect(TokenType.EQUALS, "'=' after the variable name");
    const value = this.parseExpression();

    return { kind: "VarDecl", name: name.lexeme, value, line: keyword.line };
  }

  /** printStmt := "print" expression */
  private parsePrintStmt(): PrintStmt {
    const keyword = this.expect(TokenType.PRINT, "'print'");
    const argument = this.parseExpression();

    return { kind: "PrintStmt", argument, line: keyword.line };
  }

  /** ifStmt := "if" expression statement* ("else" statement*)? "end" */
  private parseIfStmt(): IfStmt {
    const keyword = this.expect(TokenType.IF, "'if'");
    const condition = this.parseExpression();

    const thenBranch = this.parseStatements(ELSE_OR_END);

    let elseBranch: Statement[] | null = null;
    if (this.peek().type === TokenType.ELSE) {
      this.advance();
      elseBranch = this.parseStatements(END);
    }

    this.expect(TokenType.END, "'end' to close the 'if'");

    return { kind: "IfStmt", condition, thenBranch, elseBranch, line: keyword.line };
  }

  /** fnDecl := "fn" IDENT "(" paramList? ")" statement* "end" */
  private parseFnDecl(): FnDecl {
    const keyword = this.expect(TokenType.FN, "'fn'");
    const name = this.expect(TokenType.IDENT, "a function name after 'fn'");
    this.expect(TokenType.LPAREN, "'(' after the function name");

    const params: string[] = [];
    if (this.peek().type !== TokenType.RPAREN) {
      params.push(this.expect(TokenType.IDENT, "a parameter name").lexeme);
      while (this.peek().type === TokenType.COMMA) {
        this.advance();
        params.push(this.expect(TokenType.IDENT, "a parameter name").lexeme);
      }
    }

    this.expect(TokenType.RPAREN, "')' after the parameter list");

    const body = this.parseStatements(END);
    this.expect(TokenType.END, "'end' to close the function body");

    return { kind: "FnDecl", name: name.lexeme, params, body, line: keyword.line };
  }

  /** forStmt := "for" IDENT "in" expression ".." expression statement* "end" */
  private parseForStmt(): ForStmt {
    const keyword = this.expect(TokenType.FOR, "'for'");
    const variable = this.expect(TokenType.IDENT, "a loop variable after 'for'");
    this.expect(TokenType.IN, "'in' after the loop variable");
    const start = this.parseExpression();
    this.expect(TokenType.DOTDOT, "'..' between the range bounds");
    const end = this.parseExpression();

    const body = this.parseStatements(END);
    this.expect(TokenType.END, "'end' to close the 'for' loop");

    return {
      kind: "ForStmt",
      variable: variable.lexeme,
      start,
      end,
      body,
      line: keyword.line,
    };
  }

  /** exprStmt := expression */
  private parseExprStmt(): Statement {
    const expression = this.parseExpression();
    return { kind: "ExprStmt", expression, line: expression.line };
  }

  // -------------------------------------------------------------------------
  // Expressions
  // -------------------------------------------------------------------------

  /** expression := comparison */
  private parseExpression(): Expression {
    return this.parseComparison();
  }

  /** comparison := term (comparisonOp term)* — left-associative, loosest. */
  private parseComparison(): Expression {
    return this.parseBinary(
      () => this.parseTerm(),
      COMPARISON_OPERATORS,
    );
  }

  /** term := factor (("+" | "-") factor)* */
  private parseTerm(): Expression {
    return this.parseBinary(
      () => this.parseFactor(),
      ADDITIVE_OPERATORS,
    );
  }

  /** factor := primary (("*" | "/") primary)* — tightest binary level. */
  private parseFactor(): Expression {
    return this.parseBinary(
      () => this.parsePrimary(),
      MULTIPLICATIVE_OPERATORS,
    );
  }

  /**
   * Shared loop for the left-associative binary levels: parse one `operand`,
   * then keep folding `operator operand` into the left-hand side.
   */
  private parseBinary(
    operand: () => Expression,
    operators: ReadonlyMap<TokenType, BinaryOperator>,
  ): Expression {
    let left = operand();

    while (true) {
      const operator = operators.get(this.peek().type);
      if (operator === undefined) return left;

      this.advance();
      const right = operand();
      left = { kind: "BinaryExpr", operator, left, right, line: left.line };
    }
  }

  /**
   * primary := NUMBER | STRING | IDENT | "(" expression ")" | functionCall
   */
  private parsePrimary(): Expression {
    const token = this.peek();

    switch (token.type) {
      case TokenType.NUMBER: {
        this.advance();
        const value =
          typeof token.value === "number" ? token.value : Number(token.lexeme);
        return { kind: "NumberLiteral", value, line: token.line };
      }

      case TokenType.STRING: {
        this.advance();
        const value =
          typeof token.value === "string"
            ? token.value
            : token.lexeme.slice(1, -1);
        return { kind: "StringLiteral", value, line: token.line };
      }

      case TokenType.IDENT: {
        this.advance();
        // An identifier followed by `(` is a function call (grammar: functionCall).
        if (this.peek().type === TokenType.LPAREN) {
          return this.finishFunctionCall(token);
        }
        return { kind: "Identifier", name: token.lexeme, line: token.line };
      }

      case TokenType.LPAREN: {
        // Grouping only affects the tree's shape through precedence, so it does
        // not need its own node.
        this.advance();
        const expression = this.parseExpression();
        this.expect(TokenType.RPAREN, "')' to close the group");
        return expression;
      }

      default:
        throw this.error(token, `Expected an expression but found ${describe(token)}`);
    }
  }

  /** functionCall := IDENT "(" argList? ")" — the callee identifier is already consumed. */
  private finishFunctionCall(callee: Token): Expression {
    this.expect(TokenType.LPAREN, "'('");

    const args: Expression[] = [];
    if (this.peek().type !== TokenType.RPAREN) {
      args.push(this.parseExpression());
      while (this.peek().type === TokenType.COMMA) {
        this.advance();
        args.push(this.parseExpression());
      }
    }

    this.expect(TokenType.RPAREN, "')' to close the argument list");

    return {
      kind: "FunctionCall",
      callee: callee.lexeme,
      args,
      line: callee.line,
    };
  }

  // -------------------------------------------------------------------------
  // Token helpers
  // -------------------------------------------------------------------------

  /** The token `offset` positions ahead of the cursor (default: the cursor). */
  private peek(offset = 0): Token {
    const token = this.tokens[this.index + offset];
    if (token === undefined) {
      // Unreachable: `Lexer.tokenize()` always appends an EOF sentinel, and we
      // never advance past it without first observing it.
      throw new Error("Parser ran past the end of the token stream");
    }
    return token;
  }

  private advance(): Token {
    const token = this.peek();
    this.index++;
    return token;
  }

  /** Consume a token of `type`, or throw naming what was expected. */
  private expect(type: TokenType, description: string): Token {
    const token = this.peek();
    if (token.type !== type) {
      throw this.error(token, `Expected ${description} but found ${describe(token)}`);
    }
    this.index++;
    return token;
  }

  private skipNewlines(): void {
    while (this.peek().type === TokenType.NEWLINE) this.advance();
  }

  /** Build an error positioned at `token`, spanning its whole lexeme. */
  private error(token: Token, message: string): ParserError {
    return new ParserError(
      message,
      token.line,
      token.column,
      Math.max(token.lexeme.length, 1),
    );
  }
}
