import assert from "node:assert/strict";
import test from "node:test";

import { scopedPatients } from "@/lib/consumer/features/vault";
import { servedBy } from "@/lib/surface-routes";

test("File Station hides other patients during a call", () => {
  const patients = [
    { patientId: "p1", fullName: "Amal", lastConsultationAt: "2026-09-01T00:00:00Z", accessExpiresAt: "2026-12-01T00:00:00Z" },
    { patientId: "p2", fullName: "Nisha", lastConsultationAt: "2026-09-01T00:00:00Z", accessExpiresAt: "2026-12-01T00:00:00Z" },
  ];
  assert.deepEqual(
    scopedPatients(patients, "p2").map((p) => p.patientId),
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

test("the doctor surface publishes /appointments for visit history", () => {
  assert.equal(servedBy("doctor", "/appointments"), true);
  assert.equal(servedBy("doctor", "/appointments/appt-1/visit"), true);
});
