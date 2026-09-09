import type { AdminRole } from "@/lib/api/types";

declare module "next-auth" {
  interface Session {
    /** Admin realm roles, most-privileged first. Empty means "not an admin". */
    roles: AdminRole[];
    /** Epoch milliseconds at which this session hard-expires. */
    expiresAt: number;
    /**
     * Set when the access token could not be refreshed. The console treats a
     * session carrying this as signed out rather than pretending it works.
     */
    error?: "RefreshFailed" | "SecondFactorRequired";
    user: {
      id?: string;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    accessToken?: string;
    refreshToken?: string;
    idToken?: string;
    /** Epoch milliseconds. */
    accessTokenExpiresAt?: number;
    roles?: AdminRole[];
    subject?: string;
    error?: "RefreshFailed" | "SecondFactorRequired";
  }
}

export {};
