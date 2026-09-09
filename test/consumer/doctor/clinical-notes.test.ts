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
  emptyDraft,
  finalisePayload,
  hasSoapContent,
  removeDiagnosis,
  savePayload,
  setPrimary,
  shouldAutosave,
} from "@/lib/consumer/features/clinical-notes";

const dengue: Icd10Code = { code: "A90", description: "Dengue fever" };
const e11: Icd10Code = { code: "E11", description: "Type 2 diabetes" };

test("SOAP has the four sections in order", () => {
  assert.deepEqual(
    SOAP_SECTIONS.map((s) => s.key),
    ["subjective", "objective", "assessment", "plan"],
  );
});

test("applyNote fills blanks for missing SOAP fields", () => {
  const note: ClinicalNote = {
    id: "n1",
    appointment_id: "appt-1",
    subjective: "fever",
    version: 2,
  };
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
  assert.equal(hasSoapContent(empty, [{ code: "A90" }]), true);
});

test("autosave skips a signed note; ICD search needs two characters", () => {
  assert.equal(shouldAutosave("draft"), true);
  assert.equal(shouldAutosave("finalised"), false);
  assert.equal(canSearchReference("d"), false);
  assert.equal(canSearchReference("de"), true);
});

test("the first diagnosis is primary; duplicates and the 10-code cap are ignored", () => {
  const first = addDiagnosis([], dengue);
  assert.deepEqual(first, [{ code: "A90", description: "Dengue fever", is_primary: true }]);
  assert.equal(addDiagnosis(first, dengue), first);

  let many: ClinicalNoteDiagnosis[] = first;
  for (let i = 0; i < MAX_DIAGNOSES; i++) {
    many = addDiagnosis(many, { code: `X${i}`, description: `code ${i}` });
  }
  assert.equal(many.length, MAX_DIAGNOSES);
});

test("removing the primary promotes the next remaining code", () => {
  const both = addDiagnosis(addDiagnosis([], dengue), e11);
  const left = removeDiagnosis(both, "A90");
  assert.equal(left.length, 1);
  assert.equal(left[0]?.code, "E11");
  assert.equal(left[0]?.is_primary, true);
});

test("setPrimary is exclusive", () => {
  const both = addDiagnosis(addDiagnosis([], dengue), e11);
  const next = setPrimary(both, "E11");
  assert.equal(next.find((d) => d.code === "E11")?.is_primary, true);
  assert.equal(next.find((d) => d.code === "A90")?.is_primary, false);
});

test("save and finalise payloads carry version", () => {
  const draft = { ...emptyDraft(), assessment: "dengue" };
  const dx = addDiagnosis([], dengue);
  assert.deepEqual(savePayload("appt-1", draft, dx, 3), {
    appointment_id: "appt-1",
    ...draft,
    diagnoses: [{ code: "A90", is_primary: true }],
    version: 3,
  });
  assert.deepEqual(finalisePayload(3), { version: 3 });
});

test("amend requires a reason of at least 3 characters", () => {
  assert.equal(amendReasonError("ab"), "Amendment reason must be at least 3 characters.");
  assert.equal(amendReasonError(" typo "), null);
  const payload = amendPayload(emptyDraft(), [], " typo ", 4);
  assert.equal(payload.amendment_reason, "typo");
  assert.equal(payload.version, 4);
});
