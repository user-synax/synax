/**
 * Browser entrypoint for the docs playground.
 *
 * `src/index.ts` only re-exports, and Bun's IIFE output neither returns a value
 * nor honours `globalName`, so this wrapper assigns the API onto `globalThis`
 * explicitly. `scripts/build-docs.ts` bundles this file and inlines the result
 * into `synax.html`, where it exposes `window.Synax`.
 */
import * as Synax from "../src/index";

(globalThis as unknown as { Synax: typeof Synax }).Synax = Synax;
