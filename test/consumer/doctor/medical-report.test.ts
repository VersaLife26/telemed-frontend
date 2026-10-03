import assert from "node:assert/strict";
import test from "node:test";

import {
  blankReport,
  issueReportError,
  issueReportPayload,
  medicalReportByIdPagePath,
  medicalReportPagePath,
  medicalReportPath,
  medicalReportPdfPath,
  needsLeaveDates,
} from "@/lib/consumer/features/medical-report";

test("medical report paths are keyed by appointment or report id", () => {
  assert.equal(medicalReportPath("appt-1"), "/appointments/appt-1/medical-report");
  assert.equal(medicalReportPagePath("appt-1"), "/appointments/appt-1/medical-report");
  assert.equal(medicalReportPdfPath("mr-1"), "/medical-reports/mr-1/pdf");
  assert.equal(medicalReportByIdPagePath("mr-1"), "/medical-reports/mr-1");
});

test("unfit and restricted require leave dates", () => {
  assert.equal(needsLeaveDates("notAssessed"), false);
  assert.equal(needsLeaveDates("fit"), false);
  assert.equal(needsLeaveDates("unfit"), true);
  assert.equal(needsLeaveDates("restricted"), true);
});

test("issueReportError needs impression and leave dates when unfit", () => {
  assert.equal(issueReportError(blankReport()), "Add a clinical impression — a short statement of what you found.");
  const ready = { ...blankReport(), clinicalImpression: "Viral illness" };
  assert.equal(issueReportError(ready), null);
  assert.equal(
    issueReportError({ ...ready, fitness: "unfit" }),
    "Leave start and end dates are required when the patient is unfit or restricted.",
  );
  assert.equal(
    issueReportError({ ...ready, fitness: "unfit", leaveFrom: "2026-10-04", leaveUntil: "2026-10-03" }),
    "Leave cannot end before it starts.",
  );
  assert.equal(
    issueReportError({ ...ready, fitness: "unfit", leaveFrom: "2026-10-03", leaveUntil: "2026-10-04" }),
    null,
  );
});

test("issueReportPayload trims fields and drops empty leave when not assessed", () => {
  const body = issueReportPayload({
    ...blankReport(),
    addressee: "  HR department  ",
    clinicalImpression: " Acute viral illness ",
    findings: " Fever ",
    advice: "  ",
    fitness: "unfit",
    leaveFrom: "2026-10-03",
    leaveUntil: "2026-10-04",
    returnToWorkOn: "2026-10-05",
    fitnessNotes: " Rest. ",
  });
  assert.equal(body.addressee, "HR department");
  assert.equal(body.clinicalImpression, "Acute viral illness");
  assert.equal(body.findings, "Fever");
  assert.equal(body.advice, null);
  assert.equal(body.fitness, "unfit");
  assert.equal(body.leaveFrom, "2026-10-03");
  assert.equal(body.returnToWorkOn, "2026-10-05");
  assert.equal(body.fitnessNotes, "Rest.");
});
