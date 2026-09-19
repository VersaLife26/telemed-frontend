import assert from "node:assert/strict";
import test from "node:test";

import {
  appointmentAction,
  appointmentDoctorName,
  colomboHour,
  firstName,
  formatVisitClock,
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
  return { id: "a1", ...partial };
}

test("pending payment routes to checkout", () => {
  assert.deepEqual(appointmentAction("appt-1", "pending_payment"), {
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

test("cancelled has no primary action", () => {
  assert.equal(appointmentAction("appt-1", "cancelled"), null);
});

test("status labels are readable", () => {
  assert.equal(statusLabel("pending_payment"), "Pay now");
  assert.equal(statusTone("pending_payment"), "amber");
  assert.equal(statusTone("confirmed"), "teal");
});

test("completed visits are not upcoming", () => {
  assert.equal(isUpcomingAppointment(appt({ status: "completed" })), false);
  assert.equal(isUpcomingAppointment(appt({ status: "confirmed" })), true);
});

test("pickNextAppointment chooses the soonest live visit", () => {
  const later = appt({
    id: "later",
    status: "confirmed",
    start_at: "2099-12-02T10:00:00Z",
  });
  const sooner = appt({
    id: "sooner",
    status: "pending_payment",
    start_at: "2099-12-01T10:00:00Z",
  });
  const done = appt({
    id: "done",
    status: "completed",
    start_at: "2099-01-01T10:00:00Z",
  });
  assert.equal(pickNextAppointment([later, done, sooner])?.id, "sooner");
});

test("formatVisitClock reads an ISO instant", () => {
  assert.match(formatVisitClock("2026-09-13T09:00:00+05:30"), /^\d{2}:\d{2}$/);
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

test("appointmentDoctorName prefers counterpart then directory then specialty", () => {
  assert.equal(
    appointmentDoctorName(appt({ counterpart_name: "Dr Silva", specialty: "cardiology" })),
    "Dr Silva",
  );
  assert.equal(
    appointmentDoctorName(appt({ doctor_id: "doc-1", specialty: "cardiology" }), {
      "doc-1": "Dr Perera",
    }),
    "Dr Perera",
  );
  assert.equal(appointmentDoctorName(appt({ specialty: "cardiology" })), "Cardiology");
});

test("uniqueDoctorIds keeps first-seen order", () => {
  assert.deepEqual(
    uniqueDoctorIds([
      appt({ doctor_id: "a" }),
      appt({ doctor_id: "b" }),
      appt({ doctor_id: "a" }),
      appt({}),
    ]),
    ["a", "b"],
  );
});

test("resolveDoctorNames fetches only visits missing counterpart_name", async () => {
  const fetched: string[] = [];
  const names = await resolveDoctorNames(
    [
      appt({ id: "1", doctor_id: "doc-1", counterpart_name: "Dr Silva" }),
      appt({ id: "2", doctor_id: "doc-2" }),
    ],
    async (id) => {
      fetched.push(id);
      return { display_name: "Dr Perera" };
    },
  );
  assert.deepEqual(fetched, ["doc-2"]);
  assert.deepEqual(names, { "doc-2": "Dr Perera" });
});
