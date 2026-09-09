import assert from "node:assert/strict";
import test from "node:test";

import {
  adminUpstreamPath,
  clientAddress,
  forwardingHeaders,
  safeContentType,
  sameOriginRequest,
} from "@/lib/admin/api/upstream";
import { canCallApi, canVisit, groupForApiPath } from "@/lib/admin/rbac";
import { safeNextPath } from "@/lib/admin/auth/redirect";

// ---------------------------------------------------------------------------
// Path validation — the proxy must not reach past /api/v1/admin/*
// ---------------------------------------------------------------------------

test("adminUpstreamPath accepts the real admin surface", () => {
  const accepted = [
    ["api", "v1", "admin", "doctors", "pending"],
    ["api", "v1", "admin", "finance", "commission-rules"],
    ["api", "v1", "admin", "doctors", "3f8d1c2e-0a4b-4c5d-8e9f-0a1b2c3d4e5f", "verify"],
    ["api", "v1", "admin", "finance", "reports", "payments.csv"],
    ["api", "v1", "admin", "config", "commission_rules"],
    ["api", "v1", "admin", "me"],
  ];
  for (const segments of accepted) {
    assert.equal(
      adminUpstreamPath(segments),
      segments.join("/"),
      `${segments.join("/")} should be proxied`,
    );
  }
});

test("adminUpstreamPath refuses everything that is not the admin surface", () => {
  const refused: Array<[string[], string]> = [
    [["api", "v1", "payments", "intent"], "a non-admin platform path"],
    [["api", "v1", "records", "x", "download"], "the PHI surface"],
    // `startsWith("api/v1/admin")` on the JOINED string accepted all of these,
    // because a string prefix is not a path boundary.
    [["api", "v1", "admins"], "an upstream whose name merely begins with admin"],
    [["api", "v1", "administration", "keys"], "the same, one segment longer"],
    [["api", "v1", "admin-internal", "x"], "the same, hyphenated"],
    // Traversal, in the shapes that survive one round of URL decoding.
    [["api", "v1", "admin", "..", "..", "internal", "doctors"], "climbing out"],
    [["api", "v1", "admin", "doctors", "..", "..", "..", "v1", "records"], "climbing sideways"],
    [["api", "v1", "admin", "."], "a bare dot segment"],
    // Segment splicing: Next.js decodes %2F before we ever see it.
    [["api", "v1", "admin", "doctors/../../../internal"], "a decoded slash"],
    [["api", "v1", "admin", "doctors\\..\\..\\internal"], "a decoded backslash"],
    // Authority and query confusion.
    [["api", "v1", "admin", "x?next=http://evil.example"], "a query smuggled into a segment"],
    [["api", "v1", "admin", "x#frag"], "a fragment smuggled into a segment"],
    [["api", "v1", "admin", "evil.example:8080"], "an authority-shaped segment"],
    [["api", "v1", "admin", "user@evil.example"], "a userinfo-shaped segment"],
    [["api", "v1", "admin", "x%2f..%2fy"], "a double-encoded traversal"],
    [["api", "v1", "admin", "x\r\nX-Injected: 1"], "CRLF"],
    [["api", "v1", "admin"], "the prefix with nothing under it"],
    [["api", "v1", "admin", ""], "an empty trailing segment"],
  ];
  for (const [segments, why] of refused) {
    assert.equal(adminUpstreamPath(segments), null, `should refuse ${why}`);
  }
});

// ---------------------------------------------------------------------------
// RBAC on the API surface
// ---------------------------------------------------------------------------

test("canCallApi mirrors the Go rbac.Matrix, group for group", () => {
  const cases: Array<[string[], string, boolean]> = [
    // finance: {finance, super_admin}
    [["support"], "/api/v1/admin/finance/commission-rules", false],
    [["ops"], "/api/v1/admin/finance/commission-rules", false],
    [["admin"], "/api/v1/admin/finance/payout-batches", false],
    [["finance"], "/api/v1/admin/finance/commission-rules", true],
    [["super_admin"], "/api/v1/admin/finance/payout-batches", true],
    // admin_users: {super_admin}
    [["admin"], "/api/v1/admin/admin-users", false],
    [["finance"], "/api/v1/admin/admin-users", false],
    [["super_admin"], "/api/v1/admin/admin-users", true],
    // config: {super_admin, ops, finance}
    [["support"], "/api/v1/admin/config/fee_caps", false],
    [["ops"], "/api/v1/admin/config/fee_caps", true],
    // audit vs audit_export
    [["support"], "/api/v1/admin/audit", true],
    [["support"], "/api/v1/admin/audit/export", false],
    [["admin"], "/api/v1/admin/audit/export", false],
    [["finance"], "/api/v1/admin/audit/export", true],
    // open to all five
    [["support"], "/api/v1/admin/doctors/pending", true],
    [["support"], "/api/v1/admin/notifications/unread-count", true],
    [["support"], "/api/v1/admin/disputes", true],
    [["support"], "/api/v1/admin/me", true],
  ];
  for (const [roles, path, want] of cases) {
    assert.equal(
      canCallApi(roles as never, path),
      want,
      `${roles.join("+")} -> ${path} should be ${want ? "allowed" : "refused"}`,
    );
  }
});

test("canCallApi fails closed on a path the matrix does not name", () => {
  assert.equal(canCallApi(["super_admin"], "/api/v1/admin/impersonate/1"), false);
  assert.equal(canCallApi(["super_admin"], "/api/v1/admin/anything-new"), false);
  assert.equal(canCallApi(["super_admin"], "/api/v1/admin/records/x"), false);
  assert.equal(canCallApi([], "/api/v1/admin/me"), false);
  assert.equal(groupForApiPath("/api/v1/admin/not-a-real-group"), null);
});

test("the F18 escape hatch is closed at this console: ops cannot reach commission rules by any spelling", () => {
  // admin-service's GroupConfig includes `ops`, and commission_rules is stored
  // as a sysconfig key, so an ops admin refused on /finance/commission-rules
  // gets the same row through the config endpoint. Longest prefix wins, so the
  // commission key is bound to the finance group here whichever route the
  // console ends up calling.
  for (const path of [
    "/api/v1/admin/configs/commission_rules",
    "/api/v1/admin/config/commission_rules",
    "/api/v1/admin/finance/commission-rules",
  ]) {
    assert.equal(canCallApi(["ops"], path), false, `ops must not reach ${path}`);
    assert.equal(canCallApi(["support"], path), false, `support must not reach ${path}`);
    assert.equal(canCallApi(["finance"], path), true, `finance must reach ${path}`);
    assert.equal(canCallApi(["super_admin"], path), true, `super_admin must reach ${path}`);
  }
  // Every other config key is still ops-editable, as the backend matrix says.
  assert.equal(canCallApi(["ops"], "/api/v1/admin/configs/feature_flags"), true);
  assert.equal(canCallApi(["ops"], "/api/v1/admin/config/fee_caps"), true);
  assert.equal(canCallApi(["support"], "/api/v1/admin/configs/feature_flags"), false);
});

test("both spellings of the drifted routes carry the same role check", () => {
  assert.equal(groupForApiPath("/api/v1/admin/admin-users"), "admin_users");
  assert.equal(groupForApiPath("/api/v1/admin/admins/abc"), "admin_users");
  assert.equal(groupForApiPath("/api/v1/admin/config/fee_caps"), "config");
  assert.equal(groupForApiPath("/api/v1/admin/configs/fee_caps"), "config");
  assert.equal(canCallApi(["finance"], "/api/v1/admin/admins"), false);
});

test("the query string cannot smuggle a caller past the group check", () => {
  assert.equal(canCallApi(["support"], "/api/v1/admin/finance/ledger?x=/audit"), false);
  assert.equal(canCallApi(["support"], "/api/v1/admin/audit/export?from=2020-01-01"), false);
  assert.equal(canCallApi(["finance"], "/api/v1/admin/audit/export?from=2020-01-01"), true);
});

test("canVisit still passes unguarded PAGE paths — and that is why the BFF needs its own check", () => {
  // Recorded so the difference between the two functions is a fact in the test
  // suite rather than a comment. `proxy.ts` uses canVisit; it returns true for
  // every /api/gateway path, which is precisely the fail-open the route
  // handler's own canCallApi call closes.
  assert.equal(canVisit(["support"], "/api/gateway/api/v1/admin/finance/commission-rules"), true);
  assert.equal(canCallApi(["support"], "/api/v1/admin/finance/commission-rules"), false);
});

// ---------------------------------------------------------------------------
// Client address — what the gateway's IP allowlist is evaluated against
// ---------------------------------------------------------------------------

function headers(init: Record<string, string>): Headers {
  return new Headers(init);
}

test("clientAddress believes the hop in front of us, never the caller", () => {
  // Ingress-nginx in append mode: the caller's fiction is on the left, the
  // address nginx actually observed is on the right.
  assert.equal(
    clientAddress(headers({ "x-forwarded-for": "10.1.2.3, 203.0.113.9" })),
    "203.0.113.9",
  );
  // Replace mode: one entry, and it is the truth.
  assert.equal(clientAddress(headers({ "x-forwarded-for": "203.0.113.9" })), "203.0.113.9");
  // X-Real-IP wins: nginx writes it from $remote_addr and a client cannot
  // contribute to it.
  assert.equal(
    clientAddress(
      headers({ "x-real-ip": "203.0.113.9", "x-forwarded-for": "10.0.0.1, 198.51.100.7" }),
    ),
    "203.0.113.9",
  );
  // The pre-fix behaviour was to forward the header verbatim, so a caller who
  // wrote `X-Forwarded-For: <an allowlisted office address>` had it read as the
  // FIRST entry by the gateway's allowlist. That value is now ignored.
  const spoofed = clientAddress(headers({ "x-forwarded-for": "192.0.2.50, 203.0.113.9" }));
  assert.notEqual(spoofed, "192.0.2.50");
  assert.equal(spoofed, "203.0.113.9");
});

test("clientAddress returns null rather than inventing an address", () => {
  assert.equal(clientAddress(headers({})), null);
  assert.equal(clientAddress(headers({ "x-forwarded-for": "" })), null);
  assert.equal(clientAddress(headers({ "x-forwarded-for": "not-an-ip" })), null);
  assert.equal(clientAddress(headers({ "x-real-ip": "evil.example" })), null);
  // The old fallback was the string "127.0.0.1", which is inside every default
  // trusted-proxy range and inside most dev allowlists. Claiming loopback when
  // you do not know is the wrong direction to fail.
  assert.deepEqual(forwardingHeaders(headers({})), {});
});

test("clientAddress strips ports and brackets, and keeps IPv6", () => {
  assert.equal(clientAddress(headers({ "x-real-ip": "203.0.113.9:51514" })), "203.0.113.9");
  assert.equal(clientAddress(headers({ "x-real-ip": "[2001:db8::1]:443" })), "2001:db8::1");
  assert.equal(clientAddress(headers({ "x-forwarded-for": "2001:db8::1" })), "2001:db8::1");
  assert.equal(clientAddress(headers({ "x-real-ip": "999.1.1.1" })), null);
});

test("forwardingHeaders sets both headers to one resolved value", () => {
  const out = forwardingHeaders(headers({ "x-forwarded-for": "10.1.2.3, 203.0.113.9" }));
  assert.deepEqual(out, { "X-Forwarded-For": "203.0.113.9", "X-Real-IP": "203.0.113.9" });
});

// ---------------------------------------------------------------------------
// Same-origin
// ---------------------------------------------------------------------------

test("sameOriginRequest refuses cross-site state changes and allows same-origin ones", () => {
  const origin = "https://admin.yourapp.lk";
  assert.equal(
    sameOriginRequest("PUT", headers({ origin, "sec-fetch-site": "same-origin" }), origin),
    true,
  );
  assert.equal(sameOriginRequest("POST", headers({ origin }), origin), true);
  assert.equal(sameOriginRequest("POST", headers({ "sec-fetch-site": "same-origin" }), origin), true);
  assert.equal(
    sameOriginRequest("POST", headers({ origin: "https://evil.example" }), origin),
    false,
  );
  assert.equal(sameOriginRequest("POST", headers({ "sec-fetch-site": "cross-site" }), origin), false);
  // A top-level form POST from another site: Sec-Fetch-Site: none, no Origin.
  assert.equal(sameOriginRequest("POST", headers({ "sec-fetch-site": "none" }), origin), false);
  assert.equal(sameOriginRequest("POST", headers({}), origin), false);
  // Reads are exempt: a CSV download is a navigation and carries neither.
  assert.equal(sameOriginRequest("GET", headers({}), origin), true);
});

// ---------------------------------------------------------------------------
// Response shaping
// ---------------------------------------------------------------------------

test("safeContentType relabels anything a browser would render as a document", () => {
  assert.deepEqual(safeContentType("application/json"), {
    contentType: "application/json",
    attachment: false,
  });
  assert.deepEqual(safeContentType("text/csv; charset=utf-8"), {
    contentType: "text/csv; charset=utf-8",
    attachment: false,
  });
  for (const hostile of [
    "text/html",
    "text/html; charset=utf-8",
    "image/svg+xml",
    "application/xhtml+xml",
    "application/xml",
    null,
  ]) {
    assert.deepEqual(
      safeContentType(hostile),
      { contentType: "application/octet-stream", attachment: true },
      `${hostile} must not be handed back with its own label`,
    );
  }
});

// ---------------------------------------------------------------------------
// Open redirect
// ---------------------------------------------------------------------------

test("safeNextPath refuses every off-origin target", () => {
  const hostile = [
    "//evil.example",
    "//evil.example/path",
    "/\\evil.example",
    "/\\/evil.example",
    "\\\\evil.example",
    "https://evil.example",
    "http://evil.example",
    "javascript:alert(1)",
    "//evil.example\\@admin.yourapp.lk",
    "/\tevil",
    "/\nSet-Cookie: x=1",
    "/\r\nLocation: https://evil.example",
    "",
    undefined,
  ];
  for (const raw of hostile) {
    assert.equal(safeNextPath(raw), "/", `safeNextPath(${JSON.stringify(raw)}) must be "/"`);
  }
});

test("safeNextPath keeps genuine console paths intact", () => {
  assert.equal(safeNextPath("/payments"), "/payments");
  assert.equal(safeNextPath("/doctors/3f8d1c2e-0a4b-4c5d-8e9f-0a1b2c3d4e5f"), "/doctors/3f8d1c2e-0a4b-4c5d-8e9f-0a1b2c3d4e5f");
  assert.equal(safeNextPath("/audit?action=doctor.approved&page=2"), "/audit?action=doctor.approved&page=2");
  assert.equal(safeNextPath("/"), "/");
});
