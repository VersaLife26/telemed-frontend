import assert from "node:assert/strict";
import test from "node:test";

import type { ClinicalNote } from "@/lib/consumer/api/types";
import {
  SUMMARY_POLL_MAX_ATTEMPTS,
  clinicalNotePath,
  noteVisibleToPatient,
  prescriptionLookupPath,
  shouldStopPolling,
} from "@/lib/consumer/features/visit-summary";

const draft: ClinicalNote = {
  id: "n1",
  appointmentId: "appt-1",
  doctorId: "d1",
  patientId: "p1",
  subjective: "",
  objective: "",
  assessment: "",
  plan: "",
  status: "draft",
  finalisedAt: null,
  revision: 1,
  version: 1,
  diagnoses: [],
  createdAt: "",
  updatedAt: "",
};

const signed: ClinicalNote = { ...draft, status: "finalised" };

test("patients only see a finalised note", () => {
  assert.equal(noteVisibleToPatient(null), false);
  assert.equal(noteVisibleToPatient(draft), false);
  assert.equal(noteVisibleToPatient(signed), true);
});

test("polling stops after a signed note plus prescription, or after 30 attempts", () => {
  assert.equal(SUMMARY_POLL_MAX_ATTEMPTS, 30);
  assert.equal(shouldStopPolling({ noteFinalised: true, haveRx: true, attempts: 1 }), true);
  assert.equal(shouldStopPolling({ noteFinalised: true, haveRx: false, attempts: 1 }), false);
  assert.equal(shouldStopPolling({ noteFinalised: false, haveRx: true, attempts: 1 }), false);
  assert.equal(shouldStopPolling({ noteFinalised: false, haveRx: false, attempts: 31 }), true);
  assert.equal(shouldStopPolling({ noteFinalised: false, haveRx: false, attempts: 30 }), false);
});

test("summary looks up notes and prescription by appointment", () => {
  assert.equal(clinicalNotePath("appt-1"), "/appointments/appt-1/clinical-note");
  assert.equal(prescriptionLookupPath("appt-1"), "/appointments/appt-1/prescription");
});
