import assert from "node:assert/strict";
import test from "node:test";

import { ApiError } from "@/lib/consumer/api/errors";
import {
  admitDisabled,
  admitPath,
  afterEndPath,
  callPath,
  consultationPath,
  canAdmit,
  canMarkNoShow,
  consultJoinError,
  earlyJoinPath,
  earlyJoinRespondPath,
  endConsultBody,
  endPath,
  hubUrlFor,
  isConsultTerminal,
  isBeforeJoinWindow,
  isJoinWindow,
  isPastLateJoinCutoff,
  isWaiting,
  isWithinLateJoinGrace,
  JOIN_WINDOW_BEFORE_MS,
  joinPath,
  LATE_JOIN_CUTOFF_MS,
  minutesLate,
  noShowPath,
  qualityPath,
  readyForNextPath,
  shouldConnectMedia,
  shouldEnterCall,
  waitingRoomPath,
  waitingRoomPollPath,
} from "@/lib/consumer/features/consult";

test("every consultation endpoint is keyed by appointment id", () => {
  assert.equal(joinPath("appt-1"), "/appointments/appt-1/consultation/join");
  assert.equal(consultationPath("appt-1"), "/appointments/appt-1/consultation");
  assert.equal(readyForNextPath("appt-1"), "/appointments/appt-1/consultation/ready-for-next");
  assert.equal(earlyJoinPath("appt-1"), "/appointments/appt-1/consultation/early-join");
  assert.equal(
    earlyJoinRespondPath("appt-1", "accept"),
    "/appointments/appt-1/consultation/early-join/accept",
  );
  assert.equal(waitingRoomPollPath("appt-1"), "/appointments/appt-1/consultation/waiting-room");
  assert.equal(admitPath("appt-1"), "/appointments/appt-1/consultation/admit");
  assert.equal(endPath("appt-1"), "/appointments/appt-1/consultation/end");
  assert.equal(qualityPath("appt-1"), "/appointments/appt-1/consultation/quality");
});

test("app routes for the call and the waiting room", () => {
  assert.equal(callPath("appt-1"), "/appointments/appt-1/call");
  assert.equal(waitingRoomPath("appt-1"), "/appointments/appt-1/waiting-room");
});

test("the hub URL is absolutised against the API origin and carries the room token", () => {
  assert.equal(
    hubUrlFor({ hubUrl: "/hubs/consultation", roomToken: "a b+c" }, "https://api.example.lk"),
    "https://api.example.lk/hubs/consultation?roomToken=a+b%2Bc",
  );
  assert.equal(
    hubUrlFor({ hubUrl: "https://rt.example.lk/hubs/consultation", roomToken: "t" }, "https://api.example.lk"),
    "https://rt.example.lk/hubs/consultation?roomToken=t",
  );
});

test("ended and abandoned are terminal", () => {
  assert.equal(isConsultTerminal("ended"), true);
  assert.equal(isConsultTerminal("abandoned"), true);
  assert.equal(isConsultTerminal("active"), false);
  assert.equal(isConsultTerminal("waiting"), false);
});

test("the patient enters the call once join or consult is active", () => {
  assert.equal(shouldEnterCall("waiting", "waiting"), false);
  assert.equal(shouldEnterCall("active", "waiting"), true);
  assert.equal(shouldEnterCall("waiting", "active"), true);
});

test("media connects on the same active statuses", () => {
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

test("the lobby opens 15 minutes before the booked start and closes at the slot end", () => {
  const start = "2026-09-12T10:00:00.000Z";
  const end = "2026-09-12T10:15:00.000Z";
  const hourBefore = Date.parse(start) - 60 * 60 * 1000;
  const fourteenBefore = Date.parse(start) - 14 * 60 * 1000;
  const sixteenAfter = Date.parse(start) + 16 * 60 * 1000;

  assert.equal(JOIN_WINDOW_BEFORE_MS, 15 * 60 * 1000);
  assert.equal(isBeforeJoinWindow(start, hourBefore), true);
  assert.equal(isJoinWindow(start, end, hourBefore), false);
  assert.equal(isJoinWindow(start, end, fourteenBefore), true);
  assert.equal(isJoinWindow(start, end, Date.parse(start)), true);
  assert.equal(isJoinWindow(start, end, sixteenAfter), false);
});

test("closed-room join errors tell the patient to come back from appointments", () => {
  for (const code of ["too_early", "join_window_closed", "consultation_ended", "not_confirmed"]) {
    assert.equal(
      consultJoinError(new ApiError(409, { status: 409, code })),
      "This visit isn’t open yet, or it has already ended. Join from Appointments when it is time.",
    );
  }
  assert.equal(
    consultJoinError(new ApiError(404, { status: 404, detail: "Appointment not found." })),
    "Appointment not found.",
  );
});
