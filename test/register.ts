/**
 * Module resolution for `npm test`.
 *
 * Node 24 strips TypeScript types natively, so the tests need no transpiler.
 * What it does not do is understand the three things this project's imports
 * rely on, so they are taught here rather than by adding a test framework:
 *
 *   - `@/x`        → `<repo root>/x`, the tsconfig path alias;
 *   - `server-only` → an empty module (its real entry point throws by design,
 *                     which is the whole point of it in the app and useless in
 *                     a test process);
 *   - `next-auth/jwt` → a stub whose `getToken` returns whatever the test set,
 *                     so a route handler can be driven with a chosen session
 *                     without a Keycloak, a cookie or an AUTH_SECRET.
 *
 * `next/server` resolves fine once the `.js` extension is supplied.
 *
 * Everything else resolves normally, so the code under test is the code that
 * ships — no mocks of the proxy, the RBAC matrix or the path validator.
 */
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

// fileURLToPath, not URL.pathname: pathname is percent-encoded, so a checkout
// under a directory with a space in its name resolves to ".../New%20Versalife"
// and every "@/..." import then fails to resolve.
const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..");

const CANDIDATES = [".ts", ".tsx", "/index.ts", "/index.tsx", ".js", ".json", ""];

function resolveFile(base: string): string | null {
  for (const suffix of CANDIDATES) {
    const candidate = base + suffix;
    if (candidate.endsWith("/")) continue;
    if (existsSync(candidate)) return pathToFileURL(candidate).href;
  }
  return null;
}

function resolveAlias(specifier: string): string | null {
  return resolveFile(path.join(root, specifier.slice(2)));
}

/**
 * `./x` and `../x` inside a `.ts` file. Node's ESM resolver requires an
 * extension; the app's source is written for a bundler and does not have one.
 */
function resolveRelative(specifier: string, parentURL: string | undefined): string | null {
  if (!parentURL?.startsWith("file:")) return null;
  // fileURLToPath again: see the note on `here`.
  const parent = path.dirname(fileURLToPath(parentURL));
  return resolveFile(path.resolve(parent, specifier));
}

const STUBS: Record<string, string> = {
  "server-only": pathToFileURL(path.join(here, "stubs", "server-only.ts")).href,
  "next-auth/jwt": pathToFileURL(path.join(here, "stubs", "next-auth-jwt.ts")).href,
};

/** `.ts`/`.tsx` must be announced explicitly, or Node parses them as plain JS. */
function formatFor(url: string): "module-typescript" | "module" {
  return url.endsWith(".ts") || url.endsWith(".tsx") ? "module-typescript" : "module";
}

registerHooks({
  resolve(specifier, context, nextResolve) {
    const stub = STUBS[specifier];
    if (stub) return { url: stub, shortCircuit: true, format: formatFor(stub) };

    if (specifier.startsWith("@/")) {
      const url = resolveAlias(specifier);
      if (url) return { url, shortCircuit: true, format: formatFor(url) };
    }

    if (specifier.startsWith("./") || specifier.startsWith("../")) {
      const url = resolveRelative(specifier, context.parentURL);
      if (url) return { url, shortCircuit: true, format: formatFor(url) };
    }

    if (specifier === "next/server") {
      return nextResolve("next/server.js", context);
    }

    return nextResolve(specifier, context);
  },
});
