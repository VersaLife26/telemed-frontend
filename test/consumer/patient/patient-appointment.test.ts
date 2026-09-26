import assert from "node:assert/strict";
import test from "node:test";

import {
  appointmentAction,
  appointmentDoctorName,
  colomboHour,
  firstName,
  formatVisitClock,
  formatVisitDate,
  greetingForHour,
  isUpcomingAppointment,
  pickNextAppointment,
  resolveDoctorNames,
  statusLabel,
  statusTone,
  uniqueDoctorIds,
} from "@/lib/consumer/features/patient-appointment";
import type { Appointment } from "@/lib/consumer/api/types";

function appt(partial: Partial<Appointment>): Appointment {
  return {
    id: "a1",
    patientId: "p1",
    doctorId: "d1",
    startAt: "2099-01-01T04:00:00Z",
    endAt: "2099-01-01T04:30:00Z",
    status: "confirmed",
    feeCents: 250000,
    currency: "LKR",
    visitPatient: { name: "Pat", dateOfBirth: "1990-01-01", sex: null, weightKg: null, allergies: null },
    intake: { symptoms: "fever", visitRelation: null },
    paymentDueAt: null,
    confirmedAt: null,
    completedAt: null,
    noShowAt: null,
    cancelledAt: null,
    cancelledBy: null,
    cancellationReason: null,
    refundPercent: null,
    isTest: false,
    createdAt: "2098-12-01T00:00:00Z",
    ...partial,
  };
}

test("pending payment routes to checkout", () => {
  assert.deepEqual(appointmentAction("appt-1", "pendingPayment"), {
    href: "/appointments/appt-1/payment",
    label: "Pay",
  });
});

test("confirmed routes to the call lobby", () => {
  assert.deepEqual(appointmentAction("appt-1", "confirmed"), {
    href: "/appointments/appt-1/call",
    label: "Join",
  });
});

test("completed routes to the visit summary", () => {
  assert.equal(appointmentAction("appt-1", "completed")?.href, "/appointments/appt-1/summary");
});

test("cancelled and no-show have no primary action", () => {
  assert.equal(appointmentAction("appt-1", "cancelled"), null);
  assert.equal(appointmentAction("appt-1", "noShow"), null);
});

test("status labels are readable", () => {
  assert.equal(statusLabel("pendingPayment"), "Pay now");
  assert.equal(statusLabel("noShow"), "No-show");
  assert.equal(statusTone("pendingPayment"), "amber");
  assert.equal(statusTone("confirmed"), "teal");
  assert.equal(statusTone("noShow"), "danger");
});

test("completed, cancelled and no-show visits are not upcoming", () => {
  assert.equal(isUpcomingAppointment(appt({ status: "completed" })), false);
  assert.equal(isUpcomingAppointment(appt({ status: "noShow" })), false);
  assert.equal(isUpcomingAppointment(appt({ status: "cancelled" })), false);
  assert.equal(isUpcomingAppointment(appt({ status: "confirmed" })), true);
  assert.equal(isUpcomingAppointment(appt({ status: "pendingPayment" })), true);
});

test("pickNextAppointment chooses the soonest live visit", () => {
  const later = appt({ id: "later", status: "confirmed", startAt: "2099-12-02T10:00:00Z" });
  const sooner = appt({ id: "sooner", status: "pendingPayment", startAt: "2099-12-01T10:00:00Z" });
  const done = appt({ id: "done", status: "completed", startAt: "2099-01-01T10:00:00Z" });
  assert.equal(pickNextAppointment([later, done, sooner])?.id, "sooner");
});

test("formatVisitClock reads an ISO instant in the given zone", () => {
  assert.equal(formatVisitClock("2026-09-13T03:30:00Z"), "09:00");
  assert.equal(formatVisitClock("2026-09-13T03:30:00Z", "UTC"), "03:30");
  assert.equal(formatVisitClock(undefined), "—");
});

test("formatVisitDate names today and tomorrow in the given zone", () => {
  const now = new Date("2026-09-13T12:00:00Z");
  assert.equal(formatVisitDate("2026-09-13T15:00:00Z", now), "Today");
  assert.equal(formatVisitDate("2026-09-13T20:00:00Z", now), "Tomorrow");
  assert.equal(formatVisitDate("2026-09-13T20:00:00Z", now, "UTC"), "Today");
});

test("greetingForHour splits the day", () => {
  assert.equal(greetingForHour(8), "Good morning");
  assert.equal(greetingForHour(13), "Good afternoon");
  assert.equal(greetingForHour(20), "Good evening");
});

test("firstName takes the given name", () => {
  assert.equal(firstName("Maya Perera"), "Maya");
  assert.equal(firstName("  "), null);
});

test("colomboHour is a 0-23 number", () => {
  const hour = colomboHour(new Date("2026-09-13T18:30:00Z"));
  assert.equal(hour, 0);
});

test("appointmentDoctorName uses the directory name, else a generic label", () => {
  assert.equal(appointmentDoctorName(appt({ doctorId: "doc-1" }), { "doc-1": "Dr Perera" }), "Dr Perera");
  assert.equal(appointmentDoctorName(appt({ doctorId: "doc-2" }), { "doc-1": "Dr Perera" }), "Consultation");
  assert.equal(appointmentDoctorName({ id: "a1" }), "Consultation");
});

test("uniqueDoctorIds keeps first-seen order", () => {
  assert.deepEqual(
    uniqueDoctorIds([appt({ doctorId: "a" }), appt({ doctorId: "b" }), appt({ doctorId: "a" })]),
    ["a", "b"],
  );
});

test("resolveDoctorNames fetches each doctor once and drops failures", async () => {
  const fetched: string[] = [];
  const names = await resolveDoctorNames(
    [appt({ id: "1", doctorId: "doc-1" }), appt({ id: "2", doctorId: "doc-2" }), appt({ id: "3", doctorId: "doc-1" })],
    async (id) => {
      fetched.push(id);
      if (id === "doc-2") throw new Error("gone");
      return { displayName: "Dr Perera" };
    },
  );
  assert.deepEqual(fetched, ["doc-1", "doc-2"]);
  assert.deepEqual(names, { "doc-1": "Dr Perera" });
});
