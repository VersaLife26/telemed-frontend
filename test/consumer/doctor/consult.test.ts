import assert from "node:assert/strict";
import test from "node:test";

import {
  admitDisabled,
  admitPath,
  afterEndPath,
  callPath,
  canAdmit,
  endConsultBody,
  endPath,
  isWaiting,
  joinPath,
  shouldConnectMedia,
  shouldEnterCall,
  waitingRoomPollPath,
} from "@/lib/consumer/features/consult";

test("join and call paths are keyed by appointment id", () => {
  assert.equal(joinPath("appt-1"), "/consultations/appt-1/join");
  assert.equal(callPath("appt-1"), "/appointments/appt-1/call");
});

test("waiting-room poll, admit, and end are keyed by consultation id", () => {
  assert.equal(waitingRoomPollPath("c-9"), "/consultations/c-9/waiting-room");
  assert.equal(admitPath("c-9"), "/consultations/c-9/admit");
  assert.equal(endPath("c-9"), "/consultations/c-9/end");
});

test("the doctor enters the call once join or consult is active", () => {
  assert.equal(shouldEnterCall("waiting", "waiting"), false);
  assert.equal(shouldEnterCall("active", "waiting"), true);
  assert.equal(shouldConnectMedia("waiting", "active"), true);
});

test("admit is doctor-only and disabled until the patient has joined", () => {
  assert.equal(isWaiting("waiting"), true);
  assert.equal(canAdmit("doctor", "waiting"), true);
  assert.equal(canAdmit("patient", "waiting"), false);
  assert.equal(canAdmit("doctor", "scheduled"), false);
  assert.equal(admitDisabled("scheduled"), true);
});

test("ending a consult sends reason completed and the doctor goes to notes", () => {
  assert.deepEqual(endConsultBody(), { reason: "completed" });
  assert.equal(afterEndPath("doctor", "appt-1"), "/appointments/appt-1/clinical-notes");
  assert.equal(afterEndPath("patient", "appt-1"), "/appointments/appt-1/summary");
});
