import assert from "node:assert/strict";
import test from "node:test";

import type { FormularyDrug, PrescriptionItem } from "@/lib/consumer/api/types";
import {
  blankItem,
  canSearchFormulary,
  completeLines,
  fieldsFromDrug,
  fromIssued,
  issueError,
  issuePayload,
  looksLikePdf,
  messageFromPdfDownloadFailure,
  prescriptionPagePath,
  prescriptionPath,
  prescriptionPdfPath,
  stampPath,
} from "@/lib/consumer/features/prescription";

const issuedLine: PrescriptionItem = {
  drugId: null,
  drugName: "Paracetamol",
  strength: "500mg",
  form: "tablet",
  dosage: "1 tablet",
  frequency: "TDS",
  durationDays: 3,
  quantity: 9,
  instructions: null,
  isGeneric: true,
  sortOrder: 0,
};

test("fromIssued falls back to one blank line and keeps sort order", () => {
  assert.equal(fromIssued(undefined).length, 1);
  assert.equal(fromIssued([])[0]?.drugName, "");
  const lines = fromIssued([
    { ...issuedLine, drugName: "Second", sortOrder: 1 },
    issuedLine,
  ]);
  assert.equal(lines[0]?.drugName, "Paracetamol");
  assert.equal(lines[0]?.key, "issued-0");
  assert.equal(lines[0]?.instructions, "");
  assert.equal(lines[1]?.drugName, "Second");
});

test("completeLines require name, dosage, and frequency", () => {
  const items = [
    { ...blankItem("a"), drugName: "Para", dosage: "500mg", frequency: "TDS" },
    { ...blankItem("b"), drugName: "Incomplete", dosage: "", frequency: "OD" },
  ];
  assert.equal(completeLines(items).length, 1);
});

test("issueError needs at least one complete line", () => {
  const line = { ...blankItem(), drugName: "Para", dosage: "500mg", frequency: "TDS" };
  assert.equal(issueError([blankItem()]), "Add at least one drug with name, dosage, and frequency.");
  assert.equal(issueError([line]), null);
});

test("issuePayload sends only drug lines; the server snapshots doctor and patient", () => {
  const body = issuePayload([
    {
      ...blankItem("a"),
      drugId: "drug-1",
      drugName: " Para ",
      strength: "500mg",
      dosage: "500mg",
      frequency: "TDS",
      durationDays: 5,
      quantity: 10,
    },
    blankItem("b"),
  ]);
  assert.deepEqual(Object.keys(body), ["items"]);
  assert.deepEqual(body.items, [
    {
      drugId: "drug-1",
      drugName: "Para",
      strength: "500mg",
      form: null,
      dosage: "500mg",
      frequency: "TDS",
      durationDays: 5,
      quantity: 10,
      instructions: null,
      isGeneric: false,
    },
  ]);
});

test("formulary search needs two characters and copies id, strength and form", () => {
  assert.equal(canSearchFormulary("p"), false);
  assert.equal(canSearchFormulary("pa"), true);
  const drug: FormularyDrug = {
    id: "f1",
    name: "Paracetamol",
    genericName: "Paracetamol",
    strength: "500mg",
    form: "tablet",
    manufacturer: null,
    category: null,
    isControlled: false,
    isGeneric: true,
  };
  assert.deepEqual(fieldsFromDrug(drug), {
    drugId: "f1",
    drugName: "Paracetamol",
    strength: "500mg",
    form: "tablet",
    isGeneric: true,
  });
});

test("prescription paths are keyed by appointment; stamps live under /doctors/me", () => {
  assert.equal(prescriptionPath("appt-1"), "/appointments/appt-1/prescription");
  assert.equal(prescriptionPagePath("appt-1"), "/appointments/appt-1/prescription");
  assert.equal(prescriptionPdfPath("rx-1"), "/prescriptions/rx-1/pdf");
  assert.equal(stampPath("signature"), "/doctors/me/signature");
  assert.equal(stampPath("seal"), "/doctors/me/seal");
});

test("looksLikePdf requires the %PDF- header, not the Content-Type", () => {
  const encoder = new TextEncoder();
  assert.equal(looksLikePdf(encoder.encode("%PDF-1.4\n%")), true);
  assert.equal(looksLikePdf(encoder.encode('{"detail":"nope"}')), false);
  assert.equal(looksLikePdf(encoder.encode("%PD")), false);
});

test("messageFromPdfDownloadFailure prefers the problem detail", () => {
  assert.equal(
    messageFromPdfDownloadFailure(
      404,
      "application/problem+json",
      JSON.stringify({ status: 404, title: "Not Found", detail: "Prescription not found." }),
    ),
    "Prescription not found.",
  );
});

test("messageFromPdfDownloadFailure falls back to status and type for a non-JSON body", () => {
  assert.equal(
    messageFromPdfDownloadFailure(502, "text/html", "<html>"),
    "Could not download the prescription PDF. (502 text/html)",
  );
});
