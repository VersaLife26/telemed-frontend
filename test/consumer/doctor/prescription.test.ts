import assert from "node:assert/strict";
import test from "node:test";

import type { Doctor, FormularyDrug } from "@/lib/consumer/api/types";
import {
  blankItem,
  canSearchFormulary,
  completeLines,
  doctorCredentialsText,
  fieldsFromDrug,
  fromIssued,
  issueError,
  issuePayload,
  lookupPath,
  looksLikePdf,
  messageFromPdfDownloadFailure,
  prescriptionPagePath,
  prescriptionPdfPath,
} from "@/lib/consumer/features/prescription";

const doctor: Doctor = {
  id: "d1",
  display_name: "Dr Silva",
  slmc_number: "slmc123",
  bio: "MD",
};

test("fromIssued falls back to one blank line", () => {
  assert.equal(fromIssued(undefined).length, 1);
  assert.equal(fromIssued([])[0]?.drug_name, "");
  assert.equal(fromIssued([{ drug_name: "Paracetamol", dosage: "500mg", frequency: "TDS", duration_days: 3, quantity: 9 }])[0]?.key, "issued-0");
});

test("completeLines require name, dosage, and frequency", () => {
  const items = [
    { ...blankItem("a"), drug_name: "Para", dosage: "500mg", frequency: "TDS" },
    { ...blankItem("b"), drug_name: "Incomplete", dosage: "", frequency: "OD" },
  ];
  assert.equal(completeLines(items).length, 1);
});

test("issueError covers name, SLMC, and at least one complete line", () => {
  const line = { ...blankItem(), drug_name: "Para", dosage: "500mg", frequency: "TDS" };
  assert.equal(issueError("  ", doctor, [line]), "Patient name is required on the PDF.");
  assert.equal(issueError("Pat", { ...doctor, slmc_number: "" }, [line]), "Your profile is missing an SLMC number.");
  assert.equal(issueError("Pat", doctor, [blankItem()]), "Add at least one drug with name, dosage, and frequency.");
  assert.equal(issueError("Pat", doctor, [line]), null);
});

test("issuePayload uppercases SLMC and drops incomplete lines", () => {
  const body = issuePayload({
    appointmentId: "appt-1",
    doctor,
    patientName: "  Ana  ",
    patientAge: "34",
    items: [
      { ...blankItem("a"), drug_name: "Para", dosage: "500mg", frequency: "TDS", duration_days: 5, quantity: 10 },
      blankItem("b"),
    ],
  });
  assert.equal(body.patient_name, "Ana");
  assert.equal(body.patient_age, 34);
  assert.equal(body.doctor_slmc, "SLMC123");
  assert.equal(body.clinic_name, "VersaLife Telemedicine");
  assert.equal(body.items.length, 1);
  assert.equal(body.items[0]?.drug_name, "Para");
});

test("formulary search needs two characters and copies strength/form", () => {
  assert.equal(canSearchFormulary("p"), false);
  assert.equal(canSearchFormulary("pa"), true);
  const drug: FormularyDrug = {
    id: "f1",
    name: "Paracetamol",
    strength: "500mg",
    form: "tablet",
    is_generic: true,
  };
  assert.deepEqual(fieldsFromDrug(drug), {
    drug_name: "Paracetamol",
    strength: "500mg",
    form: "tablet",
    is_generic: true,
  });
});

test("doctorCredentialsText prints the real degree and university, not the bio", () => {
  const withQuals: Doctor = {
    ...doctor,
    bio: "Loves hiking.",
    qualifications: [
      { degree: "MBBS", institution: "University of Colombo", year: 2010 },
      { degree: "MD (Family Medicine)", institution: "University of Colombo", year: 2015 },
    ],
  };
  const text = doctorCredentialsText(withQuals);
  assert.ok(text.includes("MBBS"), "expected the degree to appear");
  assert.ok(text.includes("MD (Family Medicine)"), "expected the second degree to appear");
  assert.ok(text.includes("University: University of Colombo"), "expected a labeled university line");
  assert.ok(!text.includes("Loves hiking"), "must not fall back to bio when qualifications exist");
});

test("doctorCredentialsText falls back to bio when there are no structured qualifications", () => {
  assert.equal(doctorCredentialsText(doctor), "MD");
  assert.equal(doctorCredentialsText(null), "");
});

test("issuePayload sends the doctor's real credentials, not their bio", () => {
  const withQuals: Doctor = {
    ...doctor,
    bio: "Loves hiking.",
    qualifications: [{ degree: "MBBS", institution: "University of Colombo", year: 2010 }],
  };
  const body = issuePayload({
    appointmentId: "appt-1",
    doctor: withQuals,
    patientName: "Ana",
    patientAge: "34",
    items: [{ ...blankItem("a"), drug_name: "Para", dosage: "500mg", frequency: "TDS", duration_days: 5, quantity: 10 }],
  });
  assert.ok(body.doctor_qualifications.includes("MBBS"));
  assert.ok(body.doctor_qualifications.includes("University of Colombo"));
  assert.ok(!body.doctor_qualifications.includes("hiking"));
});

test("lookup and page paths are keyed by appointment", () => {
  assert.equal(lookupPath("appt-1"), "/prescriptions?appointment_id=appt-1");
  assert.equal(prescriptionPagePath("appt-1"), "/appointments/appt-1/prescription");
  assert.equal(prescriptionPdfPath("rx-1"), "/prescriptions/rx-1/pdf");
});

test("looksLikePdf requires the %PDF- header, not the Content-Type", () => {
  const encoder = new TextEncoder();
  assert.equal(looksLikePdf(encoder.encode("%PDF-1.4\n%")), true);
  assert.equal(looksLikePdf(encoder.encode('{"data":{"pdf_url":"https://example"}}')), false);
  assert.equal(looksLikePdf(encoder.encode("%PD")), false);
});

test("messageFromPdfDownloadFailure explains a stale pdf_url envelope", () => {
  const msg = messageFromPdfDownloadFailure(
    200,
    "application/json",
    JSON.stringify({ data: { pdf_url: "https://api.example/api/v1/files/x", expires_in_seconds: 86400 } }),
  );
  assert.ok(msg.includes("not being served yet"), msg);
});

test("messageFromPdfDownloadFailure prefers the API's own message", () => {
  assert.equal(
    messageFromPdfDownloadFailure(404, "application/json", JSON.stringify({ code: "NOT_FOUND", message: "resource not found" })),
    "resource not found",
  );
});
