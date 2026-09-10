import { API_BASE_URL } from "@/lib/consumer/env";
import { browserApi } from "@/lib/consumer/api/client";

/**
 * Client for the backend's /api/v1/test/* surface.
 *
 * Everything except the websocket goes through the existing same-origin proxy
 * at /api/proxy, so the test page inherits the CORS and base-URL handling the
 * rest of the app already has rather than re-deriving it.
 */

export type TestStatus = {
  test_mode: boolean;
  env: string;
  version: string;
  signal_path: string;
  outbox_enabled: boolean;
  stun_configured: boolean;
  turn_configured: boolean;
  max_peers_per_room: number;
};

export type OutboxMessage = {
  id: string;
  kind: "sms" | "email" | "push" | "in_app";
  to: string;
  subject?: string;
  body: string;
  provider: string;
  code?: string;
  at: string;
};

export type RoomGrant = {
  room: string;
  identity: string;
  token: string;
  signal_path: string;
  ice_servers: { urls: string[]; username?: string; credential?: string }[];
  expires_in_seconds: number;
};

export function fetchStatus(): Promise<TestStatus> {
  return browserApi<TestStatus>("/test/status");
}

export function fetchOutbox(kind?: string): Promise<{ messages: OutboxMessage[] }> {
  const q = kind ? `?kind=${encodeURIComponent(kind)}` : "";
  return browserApi<{ messages: OutboxMessage[] }>(`/test/outbox${q}`);
}

export function clearOutbox(): Promise<void> {
  return browserApi<void>("/test/outbox", { method: "DELETE" });
}

export function latestMessage(kind: string, to: string): Promise<OutboxMessage> {
  return browserApi<OutboxMessage>(
    `/test/outbox/latest?kind=${encodeURIComponent(kind)}&to=${encodeURIComponent(to)}`,
  );
}

export function createRoom(room: string, identity: string): Promise<RoomGrant> {
  return browserApi<RoomGrant>("/test/rooms", { method: "POST", body: { room, identity } });
}

/**
 * Builds the signalling websocket URL.
 *
 * This one does NOT go through /api/proxy: a Next route handler cannot proxy a
 * websocket upgrade, so the browser connects to the backend directly. The
 * consequence is that NEXT_PUBLIC_API_BASE_URL has to be reachable from the
 * device running the test -- "localhost" works on the same machine and fails
 * from a phone on the LAN, which is the first thing to check when a two-device
 * test will not connect.
 */
export function signalUrl(grant: RoomGrant): string {
  const base = API_BASE_URL.replace(/^http/, "ws");
  return `${base}${grant.signal_path}?token=${encodeURIComponent(grant.token)}`;
}

/** Sends a real OTP through the real auth route, which test mode captures. */
export function sendOtp(phone: string): Promise<unknown> {
  // The production route, not a test-only shortcut: the point is to exercise
  // the actual send path -- its validation, its rate limiter, its templates --
  // and only swap the final delivery. A dedicated test endpoint that generated
  // a code directly would pass while the real one was broken.
  return browserApi("/auth/otp/send", {
    method: "POST",
    body: { phone, purpose: "login", language: "en" },
  });
}

export function verifyOtp(phone: string, code: string): Promise<unknown> {
  // The field is "otp", not "code". The handler rejects unknown fields
  // outright rather than ignoring them, so this is a 400 rather than a
  // silently failed verification.
  return browserApi("/auth/otp/verify", {
    method: "POST",
    body: { phone, otp: code, purpose: "login", device_id: "test-page" },
  });
}
