import { describe, expect, test } from "bun:test";

import { Lexer } from "../src/lexer";
import { Parser } from "../src/parser";
import { generate } from "../src/codegen";

/**
 * End-to-end MVP smoke tests: read a real `.snx` file from `examples/`, compile
 * it through the whole pipeline, execute the emitted JavaScript, and check the
 * output. These are the "does the language actually work" tests.
 */

const EXAMPLES = `${import.meta.dir}/../examples`;

async function compileFile(name: string): Promise<string> {
  const source = await Bun.file(`${EXAMPLES}/${name}`).text();
  return generate(new Parser(new Lexer(source).tokenize()).parse());
}

/** Compile an example, run it, and collect everything it logged. */
async function runFile(name: string): Promise<unknown[]> {
  const output: unknown[] = [];
  const original = console.log;

  console.log = ((...args: unknown[]) => {
    output.push(...args);
  }) as typeof console.log;

  try {
    new Function(await compileFile(name))();
  } finally {
    console.log = original;
  }

  return output;
}

describe("example programs run end to end", () => {
  test("fibonacci.snx prints the first 10 Fibonacci numbers", async () => {
    expect(await runFile("fibonacci.snx")).toEqual([
      0, 1, 1, 2, 3, 5, 8, 13, 21, 34,
    ]);
  });

  test("fizzbuzz.snx prints the correct 1..15 sequence", async () => {
    expect(await runFile("fizzbuzz.snx")).toEqual([
      1,
      2,
      "Fizz",
      4,
      "Buzz",
      "Fizz",
      7,
      8,
      "Fizz",
      "Buzz",
      11,
      "Fizz",
      13,
      14,
      "FizzBuzz",
    ]);
  });

  test("the other examples still compile", async () => {
    for (const name of [
      "hello.snx",
      "variables.snx",
      "if-else.snx",
      "greet.snx",
      "loop.snx",
    ]) {
      expect(await compileFile(name)).not.toBe("");
    }
  });
});
