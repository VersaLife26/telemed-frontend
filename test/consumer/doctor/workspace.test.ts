import assert from "node:assert/strict";
import test from "node:test";

import { scopedPatients } from "@/lib/consumer/features/vault";
import { servedBy } from "@/lib/surface-routes";

test("File Station hides other patients during a call", () => {
  const patients = [
    { user_id: "p1", name: "Amal" },
    { user_id: "p2", name: "Nisha" },
  ];
  assert.deepEqual(
    scopedPatients(patients, "p2").map((p) => p.user_id),
    ["p2"],
  );
  assert.equal(scopedPatients(patients).length, 2);
  assert.equal(scopedPatients(patients, null).length, 2);
});

test("the doctor surface publishes /workspace", () => {
  assert.equal(servedBy("doctor", "/workspace"), true);
  assert.equal(servedBy("patient", "/workspace"), false);
  assert.equal(servedBy("doctor", "/api/auth/refresh"), true);
});
