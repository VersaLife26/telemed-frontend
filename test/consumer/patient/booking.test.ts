import assert from "node:assert/strict";
import test from "node:test";

import { bookingBody, bookingError, paymentPath } from "@/lib/consumer/features/booking";

test("bookingError requires a slot from the doctor page", () => {
  assert.equal(bookingError(""), "Pick a time on the doctor’s page first.");
  assert.equal(bookingError("slot-1"), null);
});

test("bookingBody nests symptoms under intake", () => {
  assert.deepEqual(bookingBody("slot-1", "doc-9", "fever"), {
    slot_id: "slot-1",
    doctor_id: "doc-9",
    intake: { symptoms: "fever" },
  });
});

test("paymentPath is the mock checkout for that appointment", () => {
  assert.equal(paymentPath("appt-1"), "/appointments/appt-1/payment");
});
