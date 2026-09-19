import { cookies } from "next/headers";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/consumer/env";
import { ACCESS_MAX_AGE, REFRESH_MAX_AGE, authCookieOptions } from "@/lib/consumer/auth/cookie-options";

export async function setAuthCookies(accessToken: string, refreshToken: string) {
  const jar = await cookies();
  jar.set(ACCESS_COOKIE, accessToken, authCookieOptions(ACCESS_MAX_AGE));
  jar.set(REFRESH_COOKIE, refreshToken, authCookieOptions(REFRESH_MAX_AGE));
}

export async function clearAuthCookies() {
  const jar = await cookies();
  jar.delete(ACCESS_COOKIE);
  jar.delete(REFRESH_COOKIE);
}

export async function getAccessToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(ACCESS_COOKIE)?.value;
}

export async function getRefreshToken(): Promise<string | undefined> {
  const jar = await cookies();
  return jar.get(REFRESH_COOKIE)?.value;
}
