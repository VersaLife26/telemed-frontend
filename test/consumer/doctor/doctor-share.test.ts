import assert from "node:assert/strict";
import test from "node:test";

import {
  doctorInitials,
  doctorPublicUrl,
  doctorShareBioLine,
  doctorShareDescription,
  doctorShareImageUrl,
  isDoctorId,
  patientAppHost,
} from "@/lib/consumer/features/doctor-share";

const ID = "3f1a6b7c-0000-4000-8000-00000000000a";

test("public profile url points at the patient site", () => {
  assert.equal(doctorPublicUrl(ID, "https://patient.versalifehealth.com"), `https://patient.versalifehealth.com/doctors/${ID}`);
  assert.equal(
    doctorShareImageUrl(ID, "https://patient.versalifehealth.com/"),
    `https://patient.versalifehealth.com/doctors/${ID}/share-image`,
  );
  const previous = process.env.NEXT_PUBLIC_PATIENT_APP_URL;
  delete process.env.NEXT_PUBLIC_PATIENT_APP_URL;
  assert.equal(patientAppHost(), "patient.versalifehealth.com");
  if (previous === undefined) delete process.env.NEXT_PUBLIC_PATIENT_APP_URL;
  else process.env.NEXT_PUBLIC_PATIENT_APP_URL = previous;
  assert.equal(isDoctorId(ID), true);
  assert.equal(isDoctorId("not-a-doctor"), false);
});

test("share description carries specialty, experience, fee and the first bio line", () => {
  const text = doctorShareDescription({
    specialty: "Cardiology",
    experienceYears: 12,
    feeLabel: "LKR 2,500.00",
    bio: "Heart clinic in Colombo.\nSecond line stays off the card.",
  });
  assert.equal(
    text,
    "Cardiology · 12 years experience · LKR 2,500.00 — Heart clinic in Colombo.",
  );
  assert.equal(doctorShareBioLine("  \n  Evening clinics.\n"), "Evening clinics.");
  assert.equal(doctorShareDescription({}), "Book a consultation on VersaLife Health");
});

test("initials use the first two name parts", () => {
  assert.equal(doctorInitials("Amara Perera"), "AP");
  assert.equal(doctorInitials("Nimal"), "N");
  assert.equal(doctorInitials("   "), "DR");
});
