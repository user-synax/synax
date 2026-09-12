import { expect, test } from "bun:test";

import { Lexer } from "../src/lexer";

// Trivial smoke test: proves the test runner, TypeScript, and module resolution
// all work. Replace/extend once `Lexer.tokenize()` is implemented.
test("Lexer stores the source it is constructed with", () => {
  const lexer = new Lexer("let x = 1");

  expect(lexer.source).toBe("let x = 1");
});

// TODO: add real tokenization tests (token kinds, positions, error cases).
