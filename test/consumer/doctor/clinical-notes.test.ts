import assert from "node:assert/strict";
import test from "node:test";

import type { ClinicalNote, ClinicalNoteDiagnosis, Icd10Code } from "@/lib/consumer/api/types";
import {
  MAX_DIAGNOSES,
  SOAP_SECTIONS,
  addDiagnosis,
  amendPayload,
  amendReasonError,
  applyNote,
  canSearchReference,
  clinicalNotePath,
  emptyDraft,
  finalisePayload,
  hasSoapContent,
  removeDiagnosis,
  savePayload,
  setPrimary,
  shouldAutosave,
  soapUnchanged,
} from "@/lib/consumer/features/clinical-notes";

const dengue: Icd10Code = { code: "A90", display: "Dengue fever", category: "A" };
const e11: Icd10Code = { code: "E11", display: "Type 2 diabetes", category: "E" };

test("SOAP has the four sections in order", () => {
  assert.deepEqual(
    SOAP_SECTIONS.map((s) => s.key),
    ["subjective", "objective", "assessment", "plan"],
  );
});

test("applyNote fills blanks for missing SOAP fields", () => {
  const note = { subjective: "fever", objective: "", assessment: "", plan: "" } as ClinicalNote;
  assert.deepEqual(applyNote(note), {
    subjective: "fever",
    objective: "",
    assessment: "",
    plan: "",
  });
});

test("hasSoapContent is true for any SOAP text or a diagnosis", () => {
  const empty = emptyDraft();
  assert.equal(hasSoapContent(empty, []), false);
  assert.equal(hasSoapContent({ ...empty, plan: "rest" }, []), true);
  assert.equal(hasSoapContent(empty, [{ code: "A90", display: "Dengue fever", isPrimary: true }]), true);
});

test("autosave skips a signed note; ICD search needs two characters", () => {
  assert.equal(shouldAutosave("draft"), true);
  assert.equal(shouldAutosave("finalised"), false);
  assert.equal(canSearchReference("d"), false);
  assert.equal(canSearchReference("de"), true);
});

test("the first diagnosis is primary; duplicates and the 10-code cap are ignored", () => {
  const first = addDiagnosis([], dengue);
  assert.deepEqual(first, [{ code: "A90", display: "Dengue fever", isPrimary: true }]);
  assert.equal(addDiagnosis(first, dengue), first);

  let many: ClinicalNoteDiagnosis[] = first;
  for (let i = 0; i < MAX_DIAGNOSES; i++) {
    many = addDiagnosis(many, { code: `X${i}`, display: `code ${i}`, category: "X" });
  }
  assert.equal(many.length, MAX_DIAGNOSES);
});

test("removing the primary promotes the next remaining code", () => {
  const both = addDiagnosis(addDiagnosis([], dengue), e11);
  const left = removeDiagnosis(both, "A90");
  assert.equal(left.length, 1);
  assert.equal(left[0]?.code, "E11");
  assert.equal(left[0]?.isPrimary, true);
  assert.equal(both[1]?.isPrimary, false, "removal must not mutate the previous list");
});

test("setPrimary is exclusive", () => {
  const both = addDiagnosis(addDiagnosis([], dengue), e11);
  const next = setPrimary(both, "E11");
  assert.equal(next.find((d) => d.code === "E11")?.isPrimary, true);
  assert.equal(next.find((d) => d.code === "A90")?.isPrimary, false);
});

test("save and finalise payloads carry version; diagnoses send code and isPrimary only", () => {
  const draft = { ...emptyDraft(), assessment: "dengue" };
  const dx = addDiagnosis([], dengue);
  assert.deepEqual(savePayload(draft, dx, 3), {
    ...draft,
    diagnoses: [{ code: "A90", isPrimary: true }],
    version: 3,
  });
  assert.equal(savePayload(draft, dx, null).version, null);
  assert.deepEqual(finalisePayload(3), { version: 3 });
});

test("clinical note paths are keyed by appointment", () => {
  assert.equal(clinicalNotePath("appt-1"), "/appointments/appt-1/clinical-note");
  assert.equal(clinicalNotePath("appt-1", "finalise"), "/appointments/appt-1/clinical-note/finalise");
  assert.equal(clinicalNotePath("appt-1", "amend"), "/appointments/appt-1/clinical-note/amend");
});

test("amend requires a reason of at least 3 characters", () => {
  assert.equal(amendReasonError("ab"), "Amendment reason must be at least 3 characters.");
  assert.equal(amendReasonError(" typo "), null);
  const payload = amendPayload(emptyDraft(), [], " typo ", 4);
  assert.equal(payload.reason, "typo");
  assert.equal(payload.version, 4);
});

test("an amendment is a no-op until SOAP or diagnoses actually change", () => {
  const draft = { ...emptyDraft(), subjective: "fever" };
  const dx = addDiagnosis([], dengue);
  assert.equal(soapUnchanged(draft, { ...draft }, dx, [...dx]), true);
  assert.equal(soapUnchanged({ ...draft, plan: "rest" }, draft, dx, dx), false);
  assert.equal(soapUnchanged(draft, draft, addDiagnosis(dx, e11), dx), false);
});
