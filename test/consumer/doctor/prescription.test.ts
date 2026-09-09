import assert from "node:assert/strict";
import test from "node:test";

import type { Doctor, FormularyDrug } from "@/lib/consumer/api/types";
import {
  blankItem,
  canSearchFormulary,
  completeLines,
  fieldsFromDrug,
  fromIssued,
  issueError,
  issuePayload,
  lookupPath,
  prescriptionPagePath,
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

test("lookup and page paths are keyed by appointment", () => {
  assert.equal(lookupPath("appt-1"), "/prescriptions?appointment_id=appt-1");
  assert.equal(prescriptionPagePath("appt-1"), "/appointments/appt-1/prescription");
});
