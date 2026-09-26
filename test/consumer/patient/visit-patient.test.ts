import assert from "node:assert/strict";
import test from "node:test";

import type { Appointment } from "@/lib/consumer/api/types";
import { ageAtVisitDate, prescriptionPatientFields } from "@/lib/consumer/features/visit-patient";

test("ageAtVisitDate counts whole years on the Colombo visit day", () => {
  assert.equal(ageAtVisitDate("1990-06-15", "2026-06-14T09:00:00+05:30"), 35);
  assert.equal(ageAtVisitDate("1990-06-15", "2026-06-15T09:00:00+05:30"), 36);
  assert.equal(ageAtVisitDate("1990-06-15", "2026-06-14T20:00:00Z"), 36);
});

test("prescriptionPatientFields uses the visit snapshot and locks when complete", () => {
  const appt = {
    startAt: "2026-02-01T10:00:00Z",
    visitPatient: { name: "Child", dateOfBirth: "2015-01-10", sex: "female", weightKg: 21.5, allergies: null },
  } as Appointment;
  assert.deepEqual(prescriptionPatientFields(appt), {
    name: "Child",
    age: "11",
    sex: "female",
    weightKg: "21.5",
    allergies: "",
    locked: true,
  });
});
