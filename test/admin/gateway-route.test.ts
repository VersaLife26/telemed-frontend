import assert from "node:assert/strict";
import http from "node:http";
import test, { after, before } from "node:test";
import type { AddressInfo } from "node:net";


/**
 * The BFF proxy, driven end to end.
 *
 * This is the file that matters. `app/api/gateway/[...path]/route.ts` forwards
 * a bearer token good for every admin route the caller's role reaches, so the
 * question "what does it refuse" cannot be answered by reading it — the checks
 * have to be watched failing.
 *
 * Real in this test: the route handler, the RBAC matrix, the path validator,
 * the same-origin check, the forwarding-header logic, and an actual HTTP
 * upstream that records every request it receives, so "the gateway was never
 * called" is an observation rather than an assumption.
 *
 * Nothing is stubbed. The caller's identity arrives the way Cloudflare Access
 * delivers it -- a JWT in the Cf-Access-Jwt-Assertion header -- and the role
 * comes back from the same in-process upstream the proxy forwards to, which
 * answers /api/v1/admin/me. That is the real seam, end to end.
 */

const CONSOLE_ORIGIN = "https://admin.yourapp.lk";
/**
 * A decodable (never verified) Access JWT. The console reads `email` out of
 * it; telemed-backend is what checks the signature.
 */
const ACCESS_TOKEN = [
  Buffer.from(JSON.stringify({ alg: "RS256" })).toString("base64url"),
  Buffer.from(JSON.stringify({ email: "ops@clinic.lk", exp: 4102444800 })).toString("base64url"),
  "signature-not-checked",
].join(".");

/** What /api/v1/admin/me answers for the current test. */
let currentRole: string | null = "super_admin";
/** When true, /me fails, standing in for a backend that cannot be reached. */
let meUnreachable = false;

interface Seen {
  method: string;
  url: string;
  authorization: string | undefined;
  forwardedFor: string | undefined;
  realIp: string | undefined;
  origin: string | undefined;
  body: string;
}

let upstream: http.Server;
let seen: Seen[] = [];
let nextUpstreamResponse: { status: number; contentType: string; body: string } = {
  status: 200,
  contentType: "application/json",
  body: JSON.stringify({ data: "ok" }),
};

let handler: (req: Request, ctx: { params: Promise<{ path: string[] }> }) => Promise<Response>;

before(async () => {
  upstream = http.createServer((req, res) => {
    // The console asks who the caller is before proxying anything. Answer it
    // here and keep it out of `seen`, which is about the PROXIED call.
    if ((req.url ?? "").startsWith("/api/v1/admin/me")) {
      if (meUnreachable) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      if (currentRole === null) {
        res.writeHead(403, { "content-type": "application/json" });
        res.end("{}");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          data: { email: "ops@clinic.lk", display_name: "Ops", role: currentRole, active: true },
        }),
      );
      return;
    }

    const chunks: Buffer[] = [];
    req.on("data", (c: Buffer) => chunks.push(c));
    req.on("end", () => {
      seen.push({
        method: req.method ?? "",
        url: req.url ?? "",
        authorization: header(req, "authorization"),
        forwardedFor: header(req, "x-forwarded-for"),
        realIp: header(req, "x-real-ip"),
        origin: header(req, "origin"),
        body: Buffer.concat(chunks).toString("utf8"),
      });
      res.writeHead(nextUpstreamResponse.status, {
        "content-type": nextUpstreamResponse.contentType,
        "x-request-id": "req-from-upstream",
      });
      res.end(nextUpstreamResponse.body);
    });
  });

  await new Promise<void>((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  const { port } = upstream.address() as AddressInfo;

  // Must be set before the first serverEnv() call, which caches.
  process.env.TELEMED_API_URL = `http://127.0.0.1:${port}`;
  process.env.TELEMED_API_TIMEOUT_MS = "4000";

  const route = await import("@/app/api/gateway/[...path]/route");
  handler = route.GET as typeof handler;
});

after(async () => {
  await new Promise<void>((resolve) => upstream.close(() => resolve()));
});

function header(req: http.IncomingMessage, name: string): string | undefined {
  const value = req.headers[name];
  return Array.isArray(value) ? value[0] : value;
}

interface CallOptions {
  method?: string;
  roles?: string[];
  session?: "none" | "unreachable" | "valid";
  headers?: Record<string, string>;
  body?: string;
  query?: string;
}

async function call(segments: string[], options: CallOptions = {}): Promise<Response> {
  const {
    method = "GET",
    roles = ["super_admin"],
    session = "valid",
    headers: extra = {},
    body,
    query = "",
  } = options;

  currentRole = roles[0] ?? null;
  meUnreachable = session === "unreachable";

  const url = `${CONSOLE_ORIGIN}/api/gateway/${segments.join("/")}${query}`;
  const requestHeaders: Record<string, string> = {
    // What ingress-nginx puts on a request that reaches this pod.
    "x-forwarded-for": "203.0.113.9",
    // What Cloudflare Access puts on a request it has authenticated. Absent
    // for session: "none", which is a request that never went through Access.
    ...(session === "none" ? {} : { "cf-access-jwt-assertion": ACCESS_TOKEN }),
    ...extra,
  };
  if (method !== "GET" && method !== "HEAD" && !("origin" in requestHeaders)) {
    requestHeaders.origin = CONSOLE_ORIGIN;
  }

  const request = new Request(url, {
    method,
    headers: requestHeaders,
    ...(body === undefined ? {} : { body }),
  });

  const { GET, POST, PUT, PATCH, DELETE } = await import("@/app/api/gateway/[...path]/route");
  const dispatch: Record<string, typeof handler> = {
    GET: GET as typeof handler,
    POST: POST as typeof handler,
    PUT: PUT as typeof handler,
    PATCH: PATCH as typeof handler,
    DELETE: DELETE as typeof handler,
  };
  const fn = dispatch[method] ?? (GET as typeof handler);
  return fn(request, { params: Promise.resolve({ path: segments }) });
}

test.beforeEach(() => {
  seen = [];
  currentRole = "super_admin";
  meUnreachable = false;
  nextUpstreamResponse = {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: "ok" }),
  };
});

// ---------------------------------------------------------------------------

test("a support admin cannot edit commission rules through the proxy", async () => {
  const response = await call(["api", "v1", "admin", "finance", "commission-rules"], {
    method: "PUT",
    roles: ["support"],
    body: JSON.stringify({ value: { default_commission_percent: 0 }, previous_version: 3 }),
  });

  assert.equal(response.status, 403);
  assert.equal((await response.json()).code, "FORBIDDEN");
  assert.deepEqual(seen, [], "the gateway must never have been called");
});

test("ops cannot edit commission rules through the proxy either", async () => {
  const response = await call(["api", "v1", "admin", "finance", "commission-rules"], {
    method: "PUT",
    roles: ["ops"],
    body: "{}",
  });
  assert.equal(response.status, 403);
  assert.equal(seen.length, 0);
});

test("finance can, and the request that reaches the gateway is the right one", async () => {
  const response = await call(["api", "v1", "admin", "finance", "commission-rules"], {
    method: "PUT",
    roles: ["finance"],
    body: JSON.stringify({ value: { default_commission_percent: 18 } }),
  });

  assert.equal(response.status, 200);
  assert.equal(seen.length, 1);
  const call1 = seen[0]!;
  assert.equal(call1.method, "PUT");
  assert.equal(call1.url, "/api/v1/admin/finance/commission-rules");
  assert.equal(call1.authorization, `Bearer ${ACCESS_TOKEN}`);
  assert.equal(call1.origin, CONSOLE_ORIGIN);
  assert.match(call1.body, /default_commission_percent/);
});

test("only super_admin reaches the admin-users surface", async () => {
  for (const role of ["admin", "ops", "finance", "support"]) {
    const response = await call(["api", "v1", "admin", "admin-users"], { roles: [role] });
    assert.equal(response.status, 403, `${role} must not reach /admin-users`);
  }
  assert.equal(seen.length, 0);

  const ok = await call(["api", "v1", "admin", "admin-users"], { roles: ["super_admin"] });
  assert.equal(ok.status, 200);
  assert.equal(seen.length, 1);
});

test("the bulk audit export is finance-or-super_admin, the paged read is not", async () => {
  for (const role of ["admin", "ops", "support"]) {
    const refused = await call(["api", "v1", "admin", "audit", "export"], {
      roles: [role],
      query: "?from=2026-01-01T00:00:00Z",
    });
    assert.equal(refused.status, 403, `${role} must not bulk-export the audit trail`);

    const allowed = await call(["api", "v1", "admin", "audit"], { roles: [role] });
    assert.equal(allowed.status, 200, `${role} may still read a page of it`);
  }
  const exported = await call(["api", "v1", "admin", "audit", "export"], { roles: ["finance"] });
  assert.equal(exported.status, 200);
});

test("an admin path the matrix does not name is refused, not forwarded", async () => {
  for (const path of [
    ["api", "v1", "admin", "impersonate", "someone"],
    ["api", "v1", "admin", "brand-new-feature"],
    ["api", "v1", "admin", "records", "abc"],
  ]) {
    const response = await call(path, { roles: ["super_admin"], method: "POST", body: "{}" });
    assert.equal(response.status, 403, `${path.join("/")} must fail closed`);
  }
  assert.deepEqual(seen, []);
});

test("ops cannot edit commission rules through the sysconfig key either (F18)", async () => {
  for (const path of [
    ["api", "v1", "admin", "configs", "commission_rules"],
    ["api", "v1", "admin", "config", "commission_rules"],
  ]) {
    const refused = await call(path, {
      roles: ["ops"],
      method: "PUT",
      body: JSON.stringify({ value: { default_percent: 0 } }),
    });
    assert.equal(refused.status, 403, `${path.join("/")} must not be an ops route`);
  }
  assert.deepEqual(seen, [], "the gateway must never see an ops commission edit");

  // ops keeps every other config key, exactly as the backend matrix says.
  const allowed = await call(["api", "v1", "admin", "configs", "feature_flags"], {
    roles: ["ops"],
    method: "PUT",
    body: "{}",
  });
  assert.equal(allowed.status, 200);
});

test("the proxy will not reach outside /api/v1/admin, whoever asks", async () => {
  for (const path of [
    ["api", "v1", "records", "abc", "download"],
    ["api", "v1", "payments", "intent"],
    ["api", "v1", "admins"],
    ["api", "v1", "administration", "keys"],
    ["api", "v1", "admin", "..", "..", "v1", "records"],
    ["api", "v1", "admin", "doctors/../../../v1/records"],
  ]) {
    const response = await call(path, { roles: ["super_admin"] });
    assert.equal(response.status, 403, `${path.join("/")} must be refused`);
  }
  assert.deepEqual(seen, [], "no request may leave with an admin token on it");
});

test("a request that did not come through Access is 401, with no upstream call", async () => {
  const none = await call(["api", "v1", "admin", "doctors", "pending"], { session: "none" });
  assert.equal(none.status, 401);
  assert.deepEqual(seen, []);
});

test("a backend that cannot confirm the role is 503, not 401 and not a pass-through", async () => {
  // The distinction matters during an incident. 401 would tell an admin whose
  // Access session is perfectly good to sign in again, which fixes nothing and
  // sends them round a loop; treating it as "no roles" would be worse still,
  // silently removing everyone's access exactly when someone needs it.
  const unreachable = await call(["api", "v1", "admin", "doctors", "pending"], {
    session: "unreachable",
  });
  assert.equal(unreachable.status, 503);
  assert.deepEqual(seen, [], "nothing may be proxied when the caller's role is unknown");
});

test("passing Access with no admin_users row is 403, not 401", async () => {
  // Access admitted them, so they are authenticated; this platform simply
  // grants them nothing. Answering 401 would invite another sign-in.
  const noRow = await call(["api", "v1", "admin", "doctors", "pending"], { roles: [] });
  assert.equal(noRow.status, 403);
  assert.deepEqual(seen, []);
});

test("a cross-origin state change is refused before the session is even read", async () => {
  const response = await call(["api", "v1", "admin", "users", "abc", "suspend"], {
    method: "POST",
    roles: ["super_admin"],
    headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    body: JSON.stringify({ reason: "x" }),
  });
  assert.equal(response.status, 403);
  assert.equal((await response.json()).message, "cross-origin requests are not proxied");
  assert.deepEqual(seen, []);
});

test("the caller's X-Forwarded-For never reaches the gateway", async () => {
  await call(["api", "v1", "admin", "doctors", "pending"], {
    roles: ["super_admin"],
    // 192.0.2.50 stands in for an address the caller knows is allowlisted.
    headers: { "x-forwarded-for": "192.0.2.50, 203.0.113.9" },
  });

  assert.equal(seen.length, 1);
  const forwarded = seen[0]!.forwardedFor;
  assert.equal(forwarded, "203.0.113.9", "only the address the ingress observed goes upstream");
  assert.equal(seen[0]!.realIp, "203.0.113.9");
  assert.ok(!forwarded!.includes("192.0.2.50"), "the caller's claim must not survive the hop");
});

test("with no forwarding header at all the proxy invents nothing", async () => {
  await call(["api", "v1", "admin", "doctors", "pending"], {
    roles: ["super_admin"],
    headers: { "x-forwarded-for": "" },
  });
  assert.equal(seen.length, 1);
  assert.equal(seen[0]!.forwardedFor, undefined);
  assert.equal(seen[0]!.realIp, undefined);
});

test("the access token is never visible in a proxied response", async () => {
  nextUpstreamResponse = {
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({ data: { note: "a normal response" } }),
  };
  const response = await call(["api", "v1", "admin", "doctors", "pending"], {
    roles: ["super_admin"],
  });

  const body = await response.text();
  assert.ok(!body.includes(ACCESS_TOKEN));
  for (const [, value] of response.headers) {
    assert.ok(!value.includes(ACCESS_TOKEN), "no response header may echo the bearer token");
  }
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.equal(response.headers.get("x-content-type-options"), "nosniff");
});

test("an upstream that answers text/html cannot render on the console's origin", async () => {
  nextUpstreamResponse = {
    status: 200,
    contentType: "text/html; charset=utf-8",
    body: "<script>fetch('/api/gateway/api/v1/admin/audit/export')</script>",
  };
  const response = await call(["api", "v1", "admin", "doctors", "pending"], {
    roles: ["super_admin"],
  });

  assert.equal(response.headers.get("content-type"), "application/octet-stream");
  assert.equal(response.headers.get("content-disposition"), "attachment");
});

test("methods outside the five the console uses are not proxied", async () => {
  const request = new Request(`${CONSOLE_ORIGIN}/api/gateway/api/v1/admin/doctors/pending`, {
    method: "OPTIONS",
  });
  currentRole = "super_admin";
  const { GET } = await import("@/app/api/gateway/[...path]/route");
  const response = await (GET as typeof handler)(request, {
    params: Promise.resolve({ path: ["api", "v1", "admin", "doctors", "pending"] }),
  });
  assert.equal(response.status, 405);
  assert.deepEqual(seen, []);
});
