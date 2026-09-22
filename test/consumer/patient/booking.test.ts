import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingBody,
  bookingError,
  bookingVisitError,
  paymentPath,
} from "@/lib/consumer/features/booking";

test("bookingError requires a slot from the doctor page", () => {
  assert.equal(bookingError(""), "Pick a time on the doctor’s page first.");
  assert.equal(bookingError("slot-1"), null);
});

test("bookingBody nests symptoms under intake and visit snapshot", () => {
  assert.deepEqual(
    bookingBody("slot-1", "doc-9", "fever", { name: "Pat", dob: "1990-01-01" }),
    {
      slot_id: "slot-1",
      doctor_id: "doc-9",
      visit_patient_name: "Pat",
      visit_patient_dob: "1990-01-01",
      intake: { symptoms: "fever" },
    },
  );
});

test("bookingVisitError requires profile DOB for self bookings", () => {
  assert.equal(bookingVisitError("self", "Pat", "", ""), "Add your date of birth under Profile before booking.");
  assert.equal(bookingVisitError("self", "Pat", "", "1990-03-03"), null);
});

test("paymentPath is the mock checkout for that appointment", () => {
  assert.equal(paymentPath("appt-1"), "/appointments/appt-1/payment");
});
