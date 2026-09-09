import assert from "node:assert/strict";
import test from "node:test";

import { gatewayUrl, shouldForwardBody } from "@/lib/consumer/proxy";

test("gatewayUrl joins /api/v1 and encodes each segment", () => {
  assert.equal(
    gatewayUrl("http://localhost:8080", ["clinical-notes", "appt-1"]),
    "http://localhost:8080/api/v1/clinical-notes/appt-1",
  );
  assert.equal(
    gatewayUrl("http://localhost:8080/", ["prescriptions"], "?appointment_id=a 1"),
    "http://localhost:8080/api/v1/prescriptions?appointment_id=a 1",
  );
});

test("shouldForwardBody skips GET and HEAD only", () => {
  assert.equal(shouldForwardBody("GET"), false);
  assert.equal(shouldForwardBody("HEAD"), false);
  assert.equal(shouldForwardBody("POST"), true);
  assert.equal(shouldForwardBody("DELETE"), true);
});

test("isNullBodyStatus covers 204/205/304 only", async () => {
  const { isNullBodyStatus } = await import("@/lib/consumer/proxy");
  assert.equal(isNullBodyStatus(204), true);
  assert.equal(isNullBodyStatus(205), true);
  assert.equal(isNullBodyStatus(304), true);
  assert.equal(isNullBodyStatus(200), false);
});
