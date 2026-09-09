/**
 * Stand-in for the `server-only` package.
 *
 * The real one throws on import outside a React Server Component, which is
 * exactly what makes it useful in the app and useless in a test process. The
 * guard it provides is enforced at build time by Next.js, and `npm run build`
 * is part of the verification for this repo, so nothing is lost by replacing it
 * here.
 */
export {};
