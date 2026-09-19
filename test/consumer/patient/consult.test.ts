import assert from "node:assert/strict";
import test from "node:test";

import {
  admitDisabled,
  admitPath,
  afterEndPath,
  callPath,
  canAdmit,
  canMarkNoShow,
  earlyJoinPath,
  earlyJoinRespondPath,
  endConsultBody,
  endPath,
  isPastLateJoinCutoff,
  isWaiting,
  isWithinLateJoinGrace,
  joinPath,
  LATE_JOIN_CUTOFF_MS,
  minutesLate,
  noShowPath,
  readyForNextPath,
  shouldConnectMedia,
  shouldEnterCall,
  waitingRoomPath,
  waitingRoomPollPath,
} from "@/lib/consumer/features/consult";

test("join, ready-for-next, and early-join are keyed by appointment id", () => {
  assert.equal(joinPath("appt-1"), "/consultations/appt-1/join");
  assert.equal(callPath("appt-1"), "/appointments/appt-1/call");
  assert.equal(readyForNextPath("appt-1"), "/consultations/appt-1/ready-for-next");
  assert.equal(readyForNextPath(), "/consultations/ready-for-next");
  assert.equal(earlyJoinPath("appt-1"), "/consultations/appt-1/early-join");
  assert.equal(earlyJoinRespondPath("appt-1", "accept"), "/consultations/appt-1/early-join/accept");
  assert.equal(waitingRoomPath("appt-1"), "/appointments/appt-1/waiting-room");
});

test("waiting-room poll, admit, and end are keyed by consultation id", () => {
  assert.equal(waitingRoomPollPath("c-9"), "/consultations/c-9/waiting-room");
  assert.equal(admitPath("c-9"), "/consultations/c-9/admit");
  assert.equal(endPath("c-9"), "/consultations/c-9/end");
});

test("the patient enters the call once join or consult is active", () => {
  assert.equal(shouldEnterCall("waiting", "waiting"), false);
  assert.equal(shouldEnterCall("active", "waiting"), true);
  assert.equal(shouldEnterCall("waiting", "active"), true);
});

test("LiveKit connects on the same active statuses", () => {
  assert.equal(shouldConnectMedia("active", "waiting"), true);
  assert.equal(shouldConnectMedia("waiting", "active"), true);
  assert.equal(shouldConnectMedia("waiting", "waiting"), false);
});

test("isWaiting covers scheduled, waiting, and join=waiting", () => {
  assert.equal(isWaiting("scheduled"), true);
  assert.equal(isWaiting("waiting"), true);
  assert.equal(isWaiting("active", "waiting"), true);
  assert.equal(isWaiting("ended"), false);
});

test("only the doctor can admit, and not while the consult is still scheduled", () => {
  assert.equal(canAdmit("doctor", "waiting"), true);
  assert.equal(canAdmit("patient", "waiting"), false);
  assert.equal(canAdmit("doctor", "scheduled"), false);
  assert.equal(canAdmit("doctor", "active"), false);
  assert.equal(admitDisabled("scheduled"), true);
  assert.equal(admitDisabled("waiting"), false);
});

test("ending a consult sends reason completed", () => {
  assert.deepEqual(endConsultBody(), { reason: "completed" });
});

test("after end the doctor writes notes and the patient sees the summary", () => {
  assert.equal(afterEndPath("doctor", "appt-1"), "/appointments/appt-1/clinical-notes");
  assert.equal(afterEndPath("patient", "appt-1"), "/appointments/appt-1/summary");
});

test("the booked slot is the join window and no-show is not used", () => {
  assert.equal(LATE_JOIN_CUTOFF_MS, 15 * 60 * 1000);
  assert.equal(noShowPath("appt-1"), "/appointments/appt-1/no-show");

  const start = "2026-09-12T10:00:00.000Z";
  const fiveLate = Date.parse(start) + 5 * 60 * 1000;
  const elevenLate = Date.parse(start) + 11 * 60 * 1000;
  const sixteenLate = Date.parse(start) + 16 * 60 * 1000;

  assert.equal(minutesLate(start, fiveLate), 5);
  assert.equal(isWithinLateJoinGrace(start, fiveLate), true);
  assert.equal(isPastLateJoinCutoff(start, elevenLate), false);
  assert.equal(isPastLateJoinCutoff(start, sixteenLate), true);
  assert.equal(canMarkNoShow("patient", "scheduled", start, fiveLate), false);
  assert.equal(canMarkNoShow("doctor", "scheduled", start, fiveLate), false);
});
