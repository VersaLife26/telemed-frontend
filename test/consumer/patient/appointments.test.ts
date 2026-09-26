import assert from "node:assert/strict";
import test from "node:test";

import {
  appointmentReschedulePath,
  appointmentsListPath,
  isConfirmedAppointment,
} from "@/lib/consumer/features/appointments";

test("appointments list path pages through the caller's bookings", () => {
  assert.equal(appointmentsListPath(), "/appointments?pageSize=50");
  assert.equal(appointmentsListPath(5), "/appointments?pageSize=5");
});

test("reschedule requests are nested under the appointment", () => {
  assert.equal(appointmentReschedulePath("appt-1"), "/appointments/appt-1/reschedule-requests");
});

test("only confirmed visits can carry a pending reschedule or early-join offer", () => {
  assert.equal(isConfirmedAppointment({ status: "confirmed" }), true);
  assert.equal(isConfirmedAppointment({ status: "pendingPayment" }), false);
  assert.equal(isConfirmedAppointment({ status: "cancelled" }), false);
});
