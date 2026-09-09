/**
 * Stand-in for `next-auth/jwt`.
 *
 * `getToken` decrypts the Auth.js session cookie. Reproducing that in a test
 * would mean minting a real JWE with a real AUTH_SECRET, which tests the
 * library rather than this console. What the tests need is the seam *after*
 * decryption: "the caller has this token and these roles". So the stub returns
 * whatever `setSessionToken` last set.
 *
 * Note what is deliberately NOT stubbed: the route handler, the RBAC matrix,
 * the path validator, the forwarding-header logic and the upstream fetch are
 * all the real thing.
 */

export interface StubJwt {
  accessToken?: string;
  roles?: string[];
  error?: string;
}

let current: StubJwt | null = null;

/** Sets what the next `getToken()` call returns. `null` means "no session". */
export function setSessionToken(token: StubJwt | null): void {
  current = token;
}

export async function getToken(): Promise<StubJwt | null> {
  return current;
}
