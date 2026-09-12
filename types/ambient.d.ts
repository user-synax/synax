/**
 * Minimal ambient type declarations for the Bun runtime and test runner.
 *
 * This project deliberately has zero dependencies, including dev-time ones, so
 * there is no `@types/bun` to lean on. This file declares just enough of the
 * Bun-flavoured globals that `src/` and `tests/` actually use for
 * `bun run typecheck` (tsc --noEmit) to pass cleanly.
 *
 * It is intentionally permissive (index signatures) rather than exhaustive:
 * exactness here would mean hand-maintaining a copy of Bun's real API surface,
 * which would drift. Anything not declared here is a signal that the code has
 * reached for an API worth declaring deliberately.
 *
 * Loaded via `"types": ["./types/ambient.d.ts"]` in tsconfig.json.
 */

// ---------------------------------------------------------------------------
// Runtime entry point: `Bun`
// ---------------------------------------------------------------------------

declare const Bun: {
  /** Absolute path of the current entrypoint script. */
  readonly main: string;
  /** Command-line arguments after the script path (bun run x.ts a b -> a b). */
  readonly argv: string[];

  /** Read a file into a string. */
  file(path: string): { text(): Promise<string> };

  /** Spawn a subprocess and wait for it to finish. */
  spawnSync(options: {
    cmd: readonly string[];
    cwd?: string;
    stdout?: "pipe" | "inherit";
    stderr?: "pipe" | "inherit";
    stdin?: "pipe" | "inherit";
  }): {
    readonly exitCode: number;
    readonly stdout: Uint8Array;
    readonly stderr: Uint8Array;
  };

  /** Shell tagged-template helper ($`cmd ${arg}`), awaited. */
  $(strings: TemplateStringsArray, ...values: unknown[]): Promise<{
    readonly exitCode: number;
    readonly stdout: string;
    readonly stderr: string;
  }>;

  /** Write a file, creating parent directories as needed. */
  write(path: string, data: string): Promise<number>;

  /** Environment variables. */
  readonly env: Record<string, string | undefined>;
};

// ---------------------------------------------------------------------------
// Node-compat globals used by the CLI
// ---------------------------------------------------------------------------

declare const console: {
  log(...values: unknown[]): void;
  error(...values: unknown[]): void;
  warn(...values: unknown[]): void;
};

declare const process: {
  /** Exit code the process will finish with. */
  exitCode: number;
  /** Environment variables. */
  readonly env: Record<string, string | undefined>;
  /** Absolute path of the running executable. */
  readonly execPath: string;
  /** Terminate the process immediately. */
  exit(code?: number): never;
};

// ---------------------------------------------------------------------------
// import.meta extras beyond the ECMAScript standard
// ---------------------------------------------------------------------------

interface ImportMeta {
  /** True when this file is the entrypoint of the current `bun run`. */
  readonly main: boolean;
  /** Absolute directory of the current file. */
  readonly dir: string;
  /** Absolute path of the current file. */
  readonly filename: string;
  /** Absolute URL of the current file (file://...). */
  readonly url: string;
}

// ---------------------------------------------------------------------------
// Test runner: `bun:test`
// ---------------------------------------------------------------------------

declare module "bun:test" {
  /** Define a single test case. */
  export function test(name: string, fn: () => void | Promise<void>): void;
  export { test as it };

  /** Group related test cases. */
  export function describe(
    name: string,
    fn: () => void,
  ): void;

  /** Assert API. Deliberately a permissive single-call signature. */
  export function expect(actual: unknown): {
    toBe(expected: unknown): void;
    toEqual(expected: unknown): void;
    toStrictEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(expected: unknown): void;
    toHaveLength(length: number): void;
    toMatch(pattern: string | RegExp): void;
    /** Pass a class/Error constructor to assert `actual instanceof it`. */
    toThrow(expected?: string | RegExp | Function): void;
    toBeInstanceOf(expected: Function): void;
    resolves: { toBe(expected: unknown): void; toEqual(expected: unknown): void };
    rejects: { toThrow(expected?: string | RegExp | Function): void };
    not: {
      toBe(expected: unknown): void;
      toEqual(expected: unknown): void;
      toContain(expected: unknown): void;
      toMatch(pattern: string | RegExp): void;
      toThrow(expected?: string | RegExp | Function): void;
      toBeInstanceOf(expected: Function): void;
    };
  };

  /** Run `fn` before each test in the current scope. */
  export function beforeEach(fn: () => void | Promise<void>): void;
  /** Run `fn` after each test in the current scope. */
  export function afterEach(fn: () => void | Promise<void>): void;
  /** Run `fn` once before all tests in the current scope. */
  export function beforeAll(fn: () => void | Promise<void>): void;
  /** Run `fn` once after all tests in the current scope. */
  export function afterAll(fn: () => void | Promise<void>): void;
}
