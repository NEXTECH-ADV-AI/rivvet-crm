/**
 * node:test runs source .ts files directly (Node 22.6+/23.6+ native TS type
 * stripping, no build step). Source files use extensionless relative
 * imports (e.g. `from "../seed"`), which Vite's bundler resolution accepts
 * but Node's plain ESM resolver does not. This hook retries a failed
 * extensionless resolution by appending .ts / .tsx / an index file, so the
 * repo's existing import style does not have to change just to be testable
 * under `node --test`.
 *
 * Registered via `--import ./scripts/test-ts-resolve-register.mjs` from the
 * "test" npm script. Test-only; never imported by app or build code.
 */

const CANDIDATE_SUFFIXES = [".ts", ".tsx", "/index.ts", "/index.tsx"];
// Only these count as "already has an extension". A specifier like
// "./activity-service.server" is NOT extensioned — ".server" is a filename
// suffix (mirroring *.server.ts server-only convention), not a module type.
const KNOWN_EXTENSIONS = /\.(ts|tsx|mts|cts|js|jsx|mjs|cjs|json|node)$/;

export async function resolve(specifier, context, nextResolve) {
  try {
    return await nextResolve(specifier, context);
  } catch (err) {
    const hasExtension = KNOWN_EXTENSIONS.test(specifier);
    const isRelative = specifier.startsWith("./") || specifier.startsWith("../");
    if (err?.code === "ERR_MODULE_NOT_FOUND" && isRelative && !hasExtension) {
      for (const suffix of CANDIDATE_SUFFIXES) {
        try {
          return await nextResolve(specifier + suffix, context);
        } catch {
          // try next candidate
        }
      }
    }
    throw err;
  }
}
