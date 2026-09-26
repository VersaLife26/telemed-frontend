import assert from "node:assert/strict";
import test from "node:test";

import { servedBy } from "@/lib/surface-routes";
import {
  TERMS_HREF,
  applyDocumentPath,
  applyDocuments,
  doctorApplyError,
  doctorApplyPayload,
  formatAvailabilityNotes,
  parseLocations,
  readApplyError,
  rupeesToCents,
  type DoctorApplyForm,
} from "@/lib/consumer/features/doctor-apply";

function completeForm(overrides: Partial<DoctorApplyForm> = {}): DoctorApplyForm {
  const file = { size: 12, name: "x.png" } as File;
  return {
    firstName: "Amila",
    lastName: "Perera",
    email: "amila@example.com",
    password: "secure-pass",
    confirmPassword: "secure-pass",
    phone: "+94771234567",
    slmcNumber: "12345",
    languages: ["en", "si"],
    languageOther: "",
    pgimBoardCertified: true,
    medicalSchool: "University of Colombo",
    qualifications: "MBBS, MD",
    consultationMinutes: "30",
    feeLkr: "2500",
    availableDays: [1, 2, 3, 4, 5],
    availableStart: "09:00",
    availableEnd: "17:00",
    availabilityExtra: "",
    isGeneralPractitioner: true,
    specialty: "cardiology",
    experienceYears: "8",
    practicingLocations: "Nawaloka\nAsiri",
    bankName: "Commercial Bank",
    bankBranch: "Colombo 07",
    accountNumber: "1234567890",
    accountName: "Amila Perera",
    termsAccepted: true,
    signature: file,
    seal: file,
    slmcCertificate: file,
    ...overrides,
  };
}

test("rupees become cents on the wire", () => {
  assert.equal(rupeesToCents("2500"), 250000);
  assert.equal(rupeesToCents("-1"), null);
});

test("availability notes join consultation length, days and hours", () => {
  assert.equal(
    formatAvailabilityNotes([1, 5], "09:00", "13:00", "evenings by request", 30),
    "30 min per consultation. Mon, Fri 09:00–13:00. evenings by request",
  );
});

test("locations split on commas and newlines", () => {
  assert.deepEqual(parseLocations("Nawaloka, Asiri\nLanka Hospital"), [
    "Nawaloka",
    "Asiri",
    "Lanka Hospital",
  ]);
});

test("a complete form has no error and keeps specialty independent of GP", () => {
  const form = completeForm();
  assert.equal(doctorApplyError(form), null);
  const payload = doctorApplyPayload(form);
  assert.equal(payload.specialtyCode, "cardiology");
  assert.equal(payload.isGeneralPractitioner, true);
  assert.equal(payload.feeCents, 250000);
  assert.match(payload.availabilityNotes, /30 min per consultation/);
  assert.deepEqual(payload.practicingLocations, ["Nawaloka", "Asiri"]);
  assert.equal(payload.termsAccepted, true);
  assert.equal(payload.password, "secure-pass");
  assert.equal(payload.phone, "+94771234567");
  assert.equal(payload.languageOther, null);
  assert.equal(payload.qualificationsText, "MBBS, MD");
  assert.deepEqual(payload.bank, {
    bankName: "Commercial Bank",
    branchName: "Colombo 07",
    accountNumber: "1234567890",
    accountName: "Amila Perera",
  });
  assert.deepEqual(
    applyDocuments(form).map((d) => d.type),
    ["signature", "seal", "slmcCertificate"],
  );
});

test("local mobile numbers are sent as E.164", () => {
  const payload = doctorApplyPayload(completeForm({ phone: "0771234567" }));
  assert.equal(payload.phone, "+94771234567");
  assert.match(
    doctorApplyError(completeForm({ phone: "0112345678" })) ?? "",
    /Sri Lankan mobile/i,
  );
});

test("apply errors include field reasons from the API", () => {
  assert.equal(
    readApplyError(
      {
        title: "One or more validation errors occurred.",
        status: 400,
        errors: { phone: ["Enter a valid Sri Lankan mobile number."] },
      },
      "fallback",
    ),
    "phone: Enter a valid Sri Lankan mobile number.",
  );
  assert.equal(
    readApplyError({ status: 409, detail: "An application already exists.", code: "application_exists" }, "fallback"),
    "An application already exists.",
  );
  assert.equal(readApplyError(null, "fallback"), "fallback");
});

test("password is required and must match confirmation", () => {
  assert.match(
    doctorApplyError(completeForm({ password: "short" })) ?? "",
    /password/i,
  );
  assert.match(
    doctorApplyError(completeForm({ confirmPassword: "different-pass" })) ?? "",
    /confirmation/i,
  );
});

test("other language requires a name", () => {
  assert.match(
    doctorApplyError(completeForm({ languages: ["other"], languageOther: "" })) ?? "",
    /other language/i,
  );
});

test("consultation length must be between 5 and 240 minutes", () => {
  assert.match(
    doctorApplyError(completeForm({ consultationMinutes: "2" })) ?? "",
    /minutes/i,
  );
  assert.match(
    doctorApplyError(completeForm({ consultationMinutes: "" })) ?? "",
    /minutes/i,
  );
});

test("terms must be accepted", () => {
  assert.match(
    doctorApplyError(completeForm({ termsAccepted: false })) ?? "",
    /service retention/i,
  );
});

test("bank details are required", () => {
  assert.match(doctorApplyError(completeForm({ accountNumber: "" })) ?? "", /Bank/i);
});

test("document upload path is keyed by application id and document type", () => {
  assert.equal(
    applyDocumentPath("aaaa-bbbb", "slmcCertificate"),
    "/doctor-applications/aaaa-bbbb/documents/slmcCertificate",
  );
});

test("the retention agreement is on the doctor surface", () => {
  assert.equal(TERMS_HREF, "/legal/service-retention-agreement");
  assert.equal(servedBy("doctor", TERMS_HREF), true);
  assert.equal(servedBy("patient", TERMS_HREF), false);
});
