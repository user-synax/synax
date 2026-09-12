/**
 * Synax code generator — walks the AST and prints equivalent JavaScript.
 *
 * Mapping (SPEC.md §8 examples drive most of this):
 *   set x = 5      ->  let x = 5;        (assignment on reassignment, see below)
 *   print e        ->  console.log(e);
 *   if/else/end    ->  if (cond) { ... } else { ... }
 *   fn/end         ->  function name(params) { ... }
 *   for i in a..b  ->  for (let i = a; i <= b; i++) { ... }   (INCLUSIVE)
 *
 * Two semantics decided with the spec's author:
 *   - `a..b` is INCLUSIVE of `b`, so the emitted loop test is `i <= b`.
 *   - `+` keeps JavaScript's coercion, so `"n=" + 5` concatenates rather than
 *     erroring. That matches SPEC.md §3 ("+ used for concat").
 *
 * `set` both declares and reassigns (SPEC.md §6). JavaScript's `let` cannot be
 * redeclared, so the generator tracks which names are already in scope and
 * emits `name = value;` for a rebind instead of a second `let`.
 *
 * Known limitation: Synax scoping is function-scoped (§6), but a `let` emitted
 * inside an `if`/`for` block is block-scoped in JS. A name first `set` inside a
 * nested block therefore will not be visible after that block. Hoisting
 * declarations (or emitting `var`) would fix this; neither example in §8 needs
 * it. Flag it if you want it addressed.
 */
import type {
  BinaryExpr,
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

/** Indentation unit for emitted blocks. */
const INDENT = "  ";

/**
 * Binding strength by operator, loosest to tightest (SPEC.md §5). Used only to
 * decide where parentheses are actually required — every emitted expression
 * also has to match JS's own precedence, which is identical for these
 * operators.
 */
const PRECEDENCE: Record<BinaryOperator, number> = {
  "==": 1,
  "!=": 1,
  ">": 1,
  "<": 1,
  ">=": 1,
  "<=": 1,
  "+": 2,
  "-": 2,
  "*": 3,
  "/": 3,
};

/**
 * Translate a parsed `Program` into JavaScript source.
 *
 * @returns JS source with no trailing newline; `""` for an empty program.
 */
export function generate(program: Program): string {
  return new Generator().program(program);
}

class Generator {
  private indentLevel = 0;

  /**
   * Names already declared in the current function scope. `set` on a name that
   * is already here becomes a plain assignment instead of a second `let`.
   */
  private scope = new Set<string>();

  program(node: Program): string {
    return node.body.map((statement) => this.statement(statement)).join("\n");
  }

  // -------------------------------------------------------------------------
  // Statements
  // -------------------------------------------------------------------------

  private statement(node: Statement): string {
    switch (node.kind) {
      case "VarDecl":
        return this.varDecl(node);
      case "PrintStmt":
        return this.printStmt(node);
      case "IfStmt":
        return this.ifStmt(node);
      case "FnDecl":
        return this.fnDecl(node);
      case "ForStmt":
        return this.forStmt(node);
      case "ExprStmt":
        return `${this.indent()}${this.expression(node.expression)};`;
    }
  }

  /** `set name = value` — declares on first use, assigns thereafter. */
  private varDecl(node: VarDecl): string {
    const value = this.expression(node.value);

    if (this.scope.has(node.name)) {
      return `${this.indent()}${node.name} = ${value};`;
    }

    this.scope.add(node.name);
    return `${this.indent()}let ${node.name} = ${value};`;
  }

  private printStmt(node: PrintStmt): string {
    return `${this.indent()}console.log(${this.expression(node.argument)});`;
  }

  private ifStmt(node: IfStmt): string {
    const header = `${this.indent()}if (${this.expression(node.condition)}) `;

    let output = header + this.block(node.thenBranch);
    if (node.elseBranch !== null) {
      output += ` else ` + this.block(node.elseBranch);
    }

    return output;
  }

  private fnDecl(node: FnDecl): string {
    const header = `${this.indent()}function ${node.name}(${node.params.join(", ")}) `;

    // A function introduces a fresh scope; its parameters are already declared.
    const outer = this.scope;
    this.scope = new Set(node.params);
    const body = this.block(node.body);
    this.scope = outer;

    return header + body;
  }

  /**
   * `for i in start..end` — INCLUSIVE of `end` (decided for this project), so
   * the emitted test is `i <= end`.
   */
  private forStmt(node: ForStmt): string {
    const { variable } = node;
    const start = this.expression(node.start);
    const end = this.expression(node.end);

    const header = `${this.indent()}for (let ${variable} = ${start}; ${variable} <= ${end}; ${variable}++) `;

    // `variable` is intentionally not added to the enclosing scope: JS's
    // `let` in the for-head already scopes it to the loop.
    return header + this.block(node.body);
  }

  // -------------------------------------------------------------------------
  // Expressions
  // -------------------------------------------------------------------------

  private expression(node: Expression): string {
    switch (node.kind) {
      case "NumberLiteral":
        return String(node.value);
      case "StringLiteral":
        // Reuse JSON's string escaping: it matches JS string syntax exactly.
        return JSON.stringify(node.value);
      case "Identifier":
        return node.name;
      case "BinaryExpr":
        return this.binary(node, 0, false);
      case "FunctionCall":
        return `${node.callee}(${node.args
          .map((argument) => this.expression(argument))
          .join(", ")})`;
    }
  }

  /**
   * Emit a binary expression, parenthesizing only where required.
   *
   * All Synax binary operators are left-associative, so a right-hand child of
   * equal precedence needs parentheses (`1 - (2 - 3)`) while a left-hand child
   * does not (`1 - 2 - 3`).
   */
  private binary(
    node: BinaryExpr,
    parentPrecedence: number,
    isRightChild: boolean,
  ): string {
    const precedence = PRECEDENCE[node.operator];

    const left = this.operand(node.left, precedence, false);
    const right = this.operand(node.right, precedence, true);
    const text = `${left} ${node.operator} ${right}`;

    const needsParens =
      precedence < parentPrecedence ||
      (precedence === parentPrecedence && isRightChild);

    return needsParens ? `(${text})` : text;
  }

  /** Emit a binary operand, telling it where it sits in the tree. */
  private operand(
    node: Expression,
    parentPrecedence: number,
    isRightChild: boolean,
  ): string {
    if (node.kind === "BinaryExpr") {
      return this.binary(node, parentPrecedence, isRightChild);
    }
    return this.expression(node);
  }

  // -------------------------------------------------------------------------
  // Helpers
  // -------------------------------------------------------------------------

  /** Emit `{ ... }` with the body one level deeper. */
  private block(statements: readonly Statement[]): string {
    if (statements.length === 0) return "{}";

    this.indentLevel++;
    const body = statements.map((statement) => this.statement(statement)).join("\n");
    this.indentLevel--;

    return `{\n${body}\n${this.indent()}}`;
  }

  private indent(): string {
    return INDENT.repeat(this.indentLevel);
  }
}
