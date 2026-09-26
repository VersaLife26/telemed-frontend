import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, hasCode, isNotFound, problemMessage } from "@/lib/consumer/api/errors";
import { totalPages } from "@/lib/consumer/api/types";

test("isNotFound is true only for an ApiError with status 404", () => {
  assert.equal(isNotFound(new ApiError(404, { title: "Not Found" })), true);
  assert.equal(isNotFound(new ApiError(400, { detail: "bad" })), false);
  assert.equal(isNotFound(new Error("missing")), false);
  assert.equal(isNotFound(null), false);
});

test("ApiError reads detail and exposes the problem code", () => {
  const err = new ApiError(409, { code: "slot_unavailable", detail: "That time is no longer available." });
  assert.equal(err.status, 409);
  assert.equal(err.message, "That time is no longer available.");
  assert.equal(err.code, "slot_unavailable");
  assert.equal(hasCode(err, "slot_unavailable"), true);
  assert.equal(hasCode(err, "patient_overlap"), false);
});

test("problemMessage falls back to the first validation error, then title", () => {
  assert.equal(
    problemMessage({ title: "One or more validation errors occurred.", errors: { "visitPatient.dateOfBirth": ["Required"] } }, "x"),
    "Required",
  );
  assert.equal(problemMessage({ title: "Conflict" }, "x"), "Conflict");
  assert.equal(problemMessage(null, "fallback"), "fallback");
});

test("totalPages is derived from total and pageSize", () => {
  assert.equal(totalPages({ total: 0, pageSize: 20 }), 1);
  assert.equal(totalPages({ total: 41, pageSize: 20 }), 3);
});
