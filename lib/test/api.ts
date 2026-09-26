import type { components } from "@/lib/api/schema";
import { browserApi } from "@/lib/consumer/api/client";

/**
 * Client for the API's /api/v1/test/* switches.
 *
 * Everything goes through the same-origin proxy at /api/proxy, which adds the
 * X-Test-Secret header from the server-only TEST_SECRET. The browser never
 * holds the secret.
 */

export type CapturedMessage = components["schemas"]["CapturedMessageDto"];
export type MessageChannel = components["schemas"]["MessageChannel"];
export type InstantMeeting = components["schemas"]["InstantMeetingDto"];

export function fetchCapturedMessages(channel?: MessageChannel): Promise<CapturedMessage[]> {
  const q = channel ? `?channel=${encodeURIComponent(channel)}` : "";
  return browserApi<CapturedMessage[]>(`/test/captured-messages${q}`);
}

export function clearCapturedMessages(): Promise<void> {
  return browserApi<void>("/test/captured-messages", { method: "DELETE" });
}

/** Needs a signed-in patient or doctor; the counterpart must hold the other role. */
export function createInstantMeeting(counterpart: string): Promise<InstantMeeting> {
  const value = counterpart.trim();
  const body = value.includes("@")
    ? { counterpartEmail: value }
    : /^[0-9a-f-]{36}$/i.test(value)
      ? { counterpartUserId: value }
      : { counterpartPhone: value };
  return browserApi<InstantMeeting>("/test/instant-meetings", { method: "POST", body });
}

/** The code in a captured English OTP message ("Your VersaLife code is 123456."), if any. */
export function otpCodeOf(body: string): string | null {
  return /\bcode is (\d{4,8})\b/.exec(body)?.[1] ?? null;
}

/** Sends a real OTP through the real auth route, whose delivery the capture sender records. */
export function sendOtp(phone: string): Promise<unknown> {
  // The production route, not a test-only shortcut: the point is to exercise
  // the actual send path -- its validation, its rate limiter, its templates --
  // and only swap the final delivery.
  return browserApi("/auth/otp/send", {
    method: "POST",
    body: { phone, language: "en" },
  });
}

export function verifyOtp(phone: string, code: string): Promise<unknown> {
  return browserApi("/auth/otp/verify", {
    method: "POST",
    body: { phone, code },
  });
}
