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
  doctorLobbyCopy,
  earlyJoinPath,
  earlyJoinRespondPath,
  endConsultBody,
  endPath,
  hubUrlFor,
  isConsultTerminal,
  isPastLateJoinCutoff,
  isWaiting,
  isWithinLateJoinGrace,
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
  assert.equal(
    earlyJoinRespondPath("appt-1", "decline"),
    "/appointments/appt-1/consultation/early-join/decline",
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
  assert.equal(canAdmit("doctor", ""), false);
  assert.equal(admitDisabled("scheduled"), true);
});

test("the doctor lobby does not treat a failed join as a waiting patient", () => {
  assert.equal(doctorLobbyCopy("waiting"), "Patient is in the waiting room.");
  assert.equal(
    doctorLobbyCopy("scheduled"),
    "Waiting for the patient to join. The booked slot is the visit window.",
  );
  assert.equal(
    doctorLobbyCopy(""),
    "Waiting for the patient to join. The booked slot is the visit window.",
  );
  assert.equal(
    consultJoinError(new ApiError(409, { status: 409, code: "join_window_closed" }), "doctor"),
    "This visit isn’t open yet, or it has already ended.",
  );
});

test("ending a consult sends reason completed and the doctor goes to notes", () => {
  assert.deepEqual(endConsultBody(), { reason: "completed" });
  assert.equal(afterEndPath("doctor", "appt-1"), "/appointments/appt-1/clinical-notes");
  assert.equal(afterEndPath("patient", "appt-1"), "/appointments/appt-1/summary");
});

test("join is allowed for the booked slot; doctors do not mark no-show", () => {
  assert.equal(LATE_JOIN_CUTOFF_MS, 15 * 60 * 1000);
  assert.equal(noShowPath("appt-1"), "/appointments/appt-1/no-show");

  const start = "2026-09-12T10:00:00.000Z";
  const fiveLate = Date.parse(start) + 5 * 60 * 1000;
  const elevenLate = Date.parse(start) + 11 * 60 * 1000;
  const sixteenLate = Date.parse(start) + 16 * 60 * 1000;

  assert.equal(minutesLate(start, fiveLate), 5);
  assert.equal(isWithinLateJoinGrace(start, fiveLate), true);
  assert.equal(isPastLateJoinCutoff(start, fiveLate), false);
  assert.equal(isWithinLateJoinGrace(start, elevenLate), true);
  assert.equal(isPastLateJoinCutoff(start, elevenLate), false);
  assert.equal(isPastLateJoinCutoff(start, sixteenLate), true);

  assert.equal(canMarkNoShow("doctor", "scheduled", start, fiveLate), false);
  assert.equal(canMarkNoShow("doctor", "confirmed", start, fiveLate), false);
  assert.equal(canMarkNoShow("patient", "scheduled", start, fiveLate), false);
});
