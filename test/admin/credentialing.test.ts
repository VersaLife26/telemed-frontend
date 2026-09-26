import assert from "node:assert/strict";
import test from "node:test";

import {
  CHECKLIST_ITEMS,
  allChecksPassed,
  answeredCount,
  checklistBody,
  failedItems,
  outstandingItems,
} from "@/lib/admin/credentialing";
import type { Checklist } from "@/lib/admin/api/types";

const yes = { ok: true, byAdminId: "a", at: "2026-01-01T00:00:00Z" };
const no = { ok: false, byAdminId: "a", at: "2026-01-01T00:00:00Z" };
const empty: Checklist = {
  slmcFormat: null,
  slmcRegistry: null,
  experience: null,
  nicMatch: null,
  photoClarity: null,
};

test("checklist PUT body carries only the item being answered", () => {
  // Every field of UpdateChecklistRequest is optional and an absent field is
  // left untouched, so sending the others would overwrite colleagues' answers.
  assert.deepEqual(checklistBody("nicMatch", false), { nicMatch: false });
  assert.deepEqual(Object.keys(checklistBody("slmcFormat", true)), ["slmcFormat"]);
});

test("every checklist item key is a field the API's ChecklistDto has", () => {
  assert.deepEqual(
    CHECKLIST_ITEMS.map((item) => item.key).sort(),
    Object.keys(empty).sort(),
  );
});

test("null means unanswered, and only five yeses permit approval", () => {
  assert.equal(answeredCount(empty), 0);
  assert.equal(outstandingItems(empty).length, 5);
  assert.equal(allChecksPassed(empty), false);

  const partial: Checklist = { ...empty, slmcFormat: yes, nicMatch: no };
  assert.equal(answeredCount(partial), 2);
  assert.deepEqual(failedItems(partial).map((i) => i.key), ["nicMatch"]);
  assert.equal(allChecksPassed(partial), false);

  const all: Checklist = {
    slmcFormat: yes,
    slmcRegistry: yes,
    experience: yes,
    nicMatch: yes,
    photoClarity: yes,
  };
  assert.equal(allChecksPassed(all), true);
  assert.equal(allChecksPassed(undefined), false);
});
