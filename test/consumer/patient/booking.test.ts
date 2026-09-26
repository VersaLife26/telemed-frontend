import assert from "node:assert/strict";
import test from "node:test";

import {
  bookingBody,
  bookingError,
  bookingVisitError,
  intakePath,
  paymentPath,
} from "@/lib/consumer/features/booking";

test("bookingError requires a slot from the doctor page and some symptoms", () => {
  assert.equal(bookingError("", "fever"), "Pick a time on the doctor’s page first.");
  assert.equal(bookingError("2026-09-21T04:00:00Z", "  "), "Tell the doctor briefly what the visit is about.");
  assert.equal(bookingError("2026-09-21T04:00:00Z", "fever"), null);
});

test("bookingBody sends the slot instant verbatim with the visit patient and intake", () => {
  assert.deepEqual(
    bookingBody("doc-9", "2026-09-21T04:00:00+00:00", " fever ", { name: " Pat ", dob: "1990-01-01" }),
    {
      doctorId: "doc-9",
      startAt: "2026-09-21T04:00:00+00:00",
      visitPatient: { name: "Pat", dateOfBirth: "1990-01-01", sex: null, weightKg: null, allergies: null },
      intake: { symptoms: "fever", visitRelation: null },
    },
  );
});

test("bookingBody carries optional visit fields and the relation for someone else", () => {
  const body = bookingBody("doc-9", "2026-09-21T04:00:00Z", "cough", {
    name: "Child",
    dob: "2015-01-10",
    sex: "female",
    weightKg: "21.37",
    allergies: " Penicillin ",
    relation: " daughter ",
  });
  assert.deepEqual(body.visitPatient, {
    name: "Child",
    dateOfBirth: "2015-01-10",
    sex: "female",
    weightKg: 21.4,
    allergies: "Penicillin",
  });
  assert.equal(body.intake.visitRelation, "daughter");
});

test("bookingVisitError requires profile DOB for self bookings", () => {
  assert.equal(bookingVisitError("self", "Pat", "", ""), "Add your date of birth under Profile before booking.");
  assert.equal(bookingVisitError("self", "Pat", "", "1990-03-03"), null);
});

test("paymentPath is the checkout for that appointment", () => {
  assert.equal(paymentPath("appt-1"), "/appointments/appt-1/payment");
});

test("intakePath carries the slot instant and the doctor's zone", () => {
  const url = new URL(intakePath("doc-9", "2026-09-21T04:00:00+00:00", "Asia/Colombo"), "http://x");
  assert.equal(url.pathname, "/doctors/doc-9/intake");
  assert.equal(url.searchParams.get("startAt"), "2026-09-21T04:00:00+00:00");
  assert.equal(url.searchParams.get("tz"), "Asia/Colombo");
});
