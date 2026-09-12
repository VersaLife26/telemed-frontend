/**
 * Reading the Cloudflare Access JWT off a request.
 *
 * Deliberately its own module with no `server-only` marker and no imports:
 * `proxy.ts` runs in the edge runtime, where `next/headers` and the env
 * validation that `./access.ts` pulls in are not available. This half is a
 * pure function over headers and is safe everywhere.
 */

/** The header Cloudflare Access sets on requests it has authenticated. */
export const ACCESS_JWT_HEADER = "cf-access-jwt-assertion";

/** The cookie Access sets in the browser alongside it. */
export const ACCESS_JWT_COOKIE = "CF_Authorization";

/** Anything carrying request headers: a Request, or `await headers()`. */
export type HeaderSource = Request | { headers: Headers };

/** Extracts the Access JWT, or null when Access did not authenticate this request. */
export function accessJwtFrom(source: HeaderSource): string | null {
  const header = source.headers.get(ACCESS_JWT_HEADER);
  if (header && header.trim() !== "") return header.trim();

  // The cookie is the fallback rather than the primary: a header cannot be
  // sent cross-site by a browser, so preferring it keeps the obvious CSRF
  // shape out of the way.
  const cookie = source.headers.get("cookie");
  if (!cookie) return null;
  for (const part of cookie.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === ACCESS_JWT_COOKIE) {
      const value = rest.join("=").trim();
      return value === "" ? null : value;
    }
  }
  return null;
}
