import { handlers } from "@/auth";

/**
 * Auth.js route handlers: /api/auth/signin, /callback, /session, /signout.
 * Node runtime because the Keycloak token exchange runs here.
 */
export const runtime = "nodejs";

export const { GET, POST } = handlers;
