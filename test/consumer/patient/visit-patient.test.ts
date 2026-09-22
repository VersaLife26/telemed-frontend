import assert from "node:assert/strict";
import test from "node:test";

import type { Appointment } from "@/lib/consumer/api/types";
import { ageAtVisitDate, prescriptionPatientFields } from "@/lib/consumer/features/visit-patient";

test("ageAtVisitDate counts whole years on the visit day", () => {
  assert.equal(ageAtVisitDate("1990-06-15", "2026-06-14T09:00:00+05:30"), 35);
  assert.equal(ageAtVisitDate("1990-06-15", "2026-06-15T09:00:00+05:30"), 36);
});

test("prescriptionPatientFields prefers visit snapshot and locks when complete", () => {
  const appt = {
    visit_patient_name: "Child",
    visit_patient_dob: "2015-01-10",
    start_at: "2026-02-01T10:00:00Z",
  } as Appointment;
  const fields = prescriptionPatientFields(appt);
  assert.equal(fields.name, "Child");
  assert.equal(fields.age, "11");
  assert.equal(fields.locked, true);
});
