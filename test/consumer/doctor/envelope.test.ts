import assert from "node:assert/strict";
import test from "node:test";

import { ApiError, isNotFound, parseEnvelope } from "@/lib/consumer/api/envelope";

test("parseEnvelope unwraps a { data } success body", () => {
  assert.deepEqual(parseEnvelope({ data: { id: "a1" }, meta: { page: 1 } }), { id: "a1" });
});

test("parseEnvelope returns a bare payload when there is no envelope", () => {
  assert.equal(parseEnvelope("ok"), "ok");
  assert.deepEqual(parseEnvelope({ id: "raw" }), { id: "raw" });
});

test("isNotFound is true only for an ApiError with status 404", () => {
  assert.equal(isNotFound(new ApiError(404, { message: "missing" })), true);
  assert.equal(isNotFound(new ApiError(400, { message: "bad" })), false);
  assert.equal(isNotFound(new Error("missing")), false);
});
