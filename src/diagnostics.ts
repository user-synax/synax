/**
 * Diagnostic rendering.
 *
 * Turns a positioned compiler error into a readable message that points at the
 * offending line of Synax source:
 *
 *   examples/bad.snx:1:7: error: Unexpected character "@"
 *     1 | print @
 *       |       ^
 *
 * This module is deliberately dependency-free: it renders a plain `Diagnostic`,
 * so the lexer/parser error classes do not need to be imported here.
 */

/** A positioned error, ready to render. All positions are 1-based. */
export interface Diagnostic {
  readonly file: string;
  /** 1-based line. */
  readonly line: number;
  /** 1-based column. */
  readonly column: number;
  /** Characters to underline; at least 1. */
  readonly length: number;
  /** The message, without any positional suffix. */
  readonly reason: string;
}

/** Indentation before the line-number gutter. */
const LEAD = "  ";

/**
 * Render `diagnostic` against `source`, including a code frame when the line
 * can be located.
 *
 * @returns A multi-line string with no trailing newline.
 */
export function formatDiagnostic(diagnostic: Diagnostic, source: string): string {
  const { file, line, column, length, reason } = diagnostic;
  const header = `${file}:${line}:${column}: error: ${reason}`;

  // Split on \r?\n so CRLF files do not leave a stray \r in the frame.
  const sourceLine = source.split(/\r?\n/)[line - 1];

  // Nothing useful to show for a missing line, or the empty line that EOF
  // errors point at when the file ends with a newline.
  if (sourceLine === undefined || sourceLine.trim() === "") return header;

  // Clamp to the line: an EOF error points one past the last character.
  const start = Math.max(0, Math.min(column - 1, sourceLine.length));
  const span = Math.max(1, Math.min(length, sourceLine.length - start));

  const number = String(line);
  const gutter = " ".repeat(number.length);

  // Replace every non-tab character with a space so the caret keeps whatever
  // tab alignment the rendered line above it has.
  const padding = sourceLine.slice(0, start).replace(/[^\t]/g, " ");

  const rendered = `${LEAD}${number} | ${sourceLine}`;
  const caretLine = `${LEAD}${gutter} | ${padding}${"^".repeat(span)}`;

  return `${header}\n${rendered}\n${caretLine}`;
}
